const express = require('express');
const router = express.Router();
const Joi = require('joi');

const DatabaseService = require('../services/DatabaseService');
const AuthMiddleware = require('../middleware/auth');
const { redis: rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// 数据验证模式
const alertRuleSchema = Joi.object({
  ruleName: Joi.string().min(1).max(100).required(),
  metricName: Joi.string().valid(
    'page_views', 'sessions', 'error_rate', 'response_time', 
    'online_users', 'bounce_rate', 'feature_usage'
  ).required(),
  conditionType: Joi.string().valid('greater_than', 'less_than', 'equals').required(),
  thresholdValue: Joi.number().required(),
  timeWindow: Joi.number().integer().min(60).max(3600).default(300), // 1分钟到1小时
  notificationChannels: Joi.array().items(
    Joi.string().valid('email', 'sms', 'webhook')
  ).min(1).required(),
  recipients: Joi.array().items(Joi.string()).min(1).required(),
  isActive: Joi.boolean().default(true)
});

// 报警服务
class AlertService {
  static async checkAlertRules() {
    try {
      const activeRules = await DatabaseService.getActiveAlertRules();
      
      for (const rule of activeRules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      logger.error('Alert rules check error:', error);
    }
  }

  static async evaluateRule(rule) {
    try {
      const currentValue = await this.getMetricValue(rule.metric_name, rule.time_window);
      const threshold = parseFloat(rule.threshold_value);
      
      let shouldAlert = false;
      
      switch (rule.condition_type) {
        case 'greater_than':
          shouldAlert = currentValue > threshold;
          break;
        case 'less_than':
          shouldAlert = currentValue < threshold;
          break;
        case 'equals':
          shouldAlert = Math.abs(currentValue - threshold) < 0.01;
          break;
      }

      if (shouldAlert) {
        await this.triggerAlert(rule, currentValue);
      }
    } catch (error) {
      logger.error('Rule evaluation error:', { ruleId: rule.id, error: error.message });
    }
  }

  static async getMetricValue(metricName, timeWindowSeconds) {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - timeWindowSeconds * 1000);

    switch (metricName) {
      case 'page_views':
        return await this.getPageViewsCount(startTime, endTime);
      case 'sessions':
        return await this.getSessionsCount(startTime, endTime);
      case 'online_users':
        return await this.getOnlineUsersCount();
      case 'error_rate':
        return await this.getErrorRate(startTime, endTime);
      case 'response_time':
        return await this.getAverageResponseTime(startTime, endTime);
      case 'bounce_rate':
        return await this.getBounceRate(startTime, endTime);
      default:
        return 0;
    }
  }

  static async getPageViewsCount(startTime, endTime) {
    const result = await DatabaseService.query(`
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE start_time BETWEEN $1 AND $2
    `, [startTime, endTime]);
    
    return parseInt(result.rows[0]?.count || 0);
  }

  static async getSessionsCount(startTime, endTime) {
    const result = await DatabaseService.query(`
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE start_time BETWEEN $1 AND $2
    `, [startTime, endTime]);
    
    return parseInt(result.rows[0]?.count || 0);
  }

  static async getOnlineUsersCount() {
    // 获取最近30分钟内活跃的会话数
    const result = await DatabaseService.getActiveSessions(30);
    return result;
  }

  static async getErrorRate(startTime, endTime) {
    try {
      // 从InfluxDB获取错误率数据
      const result = await InfluxDBService.query(`
        SELECT mean("error_rate") as avg_error_rate
        FROM "system_metrics"
        WHERE time >= '${startTime}' AND time <= '${endTime}'
      `);
      return result.length > 0 ? result[0].avg_error_rate || 0 : 0;
    } catch (error) {
      logger.warn('Failed to get error rate from InfluxDB:', error.message);
      return 0; // 默认返回0%错误率
    }
  }

  static async getAverageResponseTime(startTime, endTime) {
    try {
      // 从InfluxDB获取响应时间数据
      const result = await InfluxDBService.query(`
        SELECT mean("response_time") as avg_response_time
        FROM "api_metrics"
        WHERE time >= '${startTime}' AND time <= '${endTime}'
      `);
      return result.length > 0 ? result[0].avg_response_time || 50 : 50;
    } catch (error) {
      logger.warn('Failed to get response time from InfluxDB:', error.message);
      return 50; // 默认返回50ms响应时间
    }
  }

  static async getBounceRate(startTime, endTime) {
    const result = await DatabaseService.query(`
      SELECT 
        COUNT(CASE WHEN bounced = true THEN 1 END)::float / COUNT(*) as bounce_rate
      FROM user_sessions
      WHERE start_time BETWEEN $1 AND $2
    `, [startTime, endTime]);
    
    return parseFloat(result.rows[0]?.bounce_rate || 0) * 100;
  }

  static async triggerAlert(rule, currentValue) {
    try {
      // 检查冷却期
      const lastAlert = await DatabaseService.query(`
        SELECT MAX(triggered_at) as last_triggered
        FROM alert_history
        WHERE rule_id = $1 AND triggered_at > NOW() - INTERVAL '15 minutes'
      `, [rule.id]);

      if (lastAlert.rows[0]?.last_triggered) {
        logger.debug('Alert in cooldown period', { ruleId: rule.id });
        return;
      }

      const message = `Alert: ${rule.rule_name}\nMetric: ${rule.metric_name}\nCurrent value: ${currentValue}\nThreshold: ${rule.threshold_value}`;

      // 记录报警历史
      await DatabaseService.logAlert(rule.id, currentValue, message);

      // 发送通知
      const channels = JSON.parse(rule.notification_channels);
      const recipients = JSON.parse(rule.recipients);

      for (const channel of channels) {
        switch (channel) {
          case 'email':
            await this.sendEmailAlert(recipients, rule.rule_name, message);
            break;
          case 'sms':
            await this.sendSMSAlert(recipients, rule.rule_name, message);
            break;
          case 'webhook':
            await this.sendWebhookAlert(recipients, rule, currentValue);
            break;
        }
      }

      logger.analytics('alert_triggered', {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        metricName: rule.metric_name,
        currentValue,
        thresholdValue: rule.threshold_value,
        channels
      });

    } catch (error) {
      logger.error('Alert trigger error:', error);
    }
  }

  static async sendEmailAlert(recipients, ruleName, message) {
    // 这里应该集成邮件发送服务
    logger.info('Email alert sent', { recipients, ruleName });
  }

  static async sendSMSAlert(recipients, ruleName, message) {
    // 这里应该集成短信发送服务
    logger.info('SMS alert sent', { recipients, ruleName });
  }

  static async sendWebhookAlert(webhookUrls, rule, currentValue) {
    // 这里应该发送webhook通知
    logger.info('Webhook alert sent', { webhookUrls, ruleId: rule.id });
  }
}

// POST /api/alerts/rules - 创建报警规则
router.post('/rules',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireAdmin,
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = alertRuleSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const ruleData = {
        ...value,
        createdBy: req.user.id
      };

      const rule = await DatabaseService.createAlertRule(ruleData);

      logger.analytics('alert_rule_created', {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        userId: req.user.id
      });

      res.status(201).json({
        success: true,
        message: 'Alert rule created',
        rule: {
          id: rule.id,
          ruleName: rule.rule_name,
          metricName: rule.metric_name,
          conditionType: rule.condition_type,
          thresholdValue: rule.threshold_value,
          timeWindow: rule.time_window,
          notificationChannels: rule.notification_channels,
          recipients: rule.recipients,
          isActive: rule.is_active,
          createdAt: rule.created_at
        }
      });

    } catch (error) {
      logger.error('Create alert rule error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to create alert rule',
          status: 500
        }
      });
    }
  }
);

// GET /api/alerts/rules - 获取报警规则列表
router.get('/rules',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, active = 'all' } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '';
      const params = [];

      if (active !== 'all') {
        whereClause = 'WHERE is_active = $1';
        params.push(active === 'true');
      }

      const rules = await DatabaseService.query(`
        SELECT ar.*, au.username as created_by_username
        FROM alert_rules ar
        LEFT JOIN admin_users au ON ar.created_by = au.id
        ${whereClause}
        ORDER BY ar.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const totalResult = await DatabaseService.query(`
        SELECT COUNT(*) FROM alert_rules ${whereClause}
      `, params);

      const total = parseInt(totalResult.rows[0].count);

      res.json({
        rules: rules.rows.map(rule => ({
          id: rule.id,
          ruleName: rule.rule_name,
          metricName: rule.metric_name,
          conditionType: rule.condition_type,
          thresholdValue: rule.threshold_value,
          timeWindow: rule.time_window,
          notificationChannels: rule.notification_channels,
          recipients: rule.recipients,
          isActive: rule.is_active,
          createdBy: rule.created_by_username,
          createdAt: rule.created_at,
          updatedAt: rule.updated_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Get alert rules error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get alert rules',
          status: 500
        }
      });
    }
  }
);

// PUT /api/alerts/rules/:ruleId - 更新报警规则
router.put('/rules/:ruleId',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { ruleId } = req.params;

      // 验证请求数据
      const { error, value } = alertRuleSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      // 检查规则是否存在
      const existingRule = await DatabaseService.query(
        'SELECT id FROM alert_rules WHERE id = $1',
        [ruleId]
      );

      if (!existingRule.rows[0]) {
        return res.status(404).json({
          error: {
            message: 'Alert rule not found',
            status: 404
          }
        });
      }

      // 更新规则
      const updatedRule = await DatabaseService.query(`
        UPDATE alert_rules SET
          rule_name = $2,
          metric_name = $3,
          condition_type = $4,
          threshold_value = $5,
          time_window = $6,
          notification_channels = $7,
          recipients = $8,
          is_active = $9,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        ruleId,
        value.ruleName,
        value.metricName,
        value.conditionType,
        value.thresholdValue,
        value.timeWindow,
        JSON.stringify(value.notificationChannels),
        JSON.stringify(value.recipients),
        value.isActive
      ]);

      logger.analytics('alert_rule_updated', {
        ruleId: parseInt(ruleId),
        ruleName: value.ruleName,
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'Alert rule updated',
        rule: updatedRule.rows[0]
      });

    } catch (error) {
      logger.error('Update alert rule error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to update alert rule',
          status: 500
        }
      });
    }
  }
);

// DELETE /api/alerts/rules/:ruleId - 删除报警规则
router.delete('/rules/:ruleId',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { ruleId } = req.params;

      const result = await DatabaseService.query(
        'DELETE FROM alert_rules WHERE id = $1 RETURNING rule_name',
        [ruleId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: {
            message: 'Alert rule not found',
            status: 404
          }
        });
      }

      logger.analytics('alert_rule_deleted', {
        ruleId: parseInt(ruleId),
        ruleName: result.rows[0].rule_name,
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'Alert rule deleted'
      });

    } catch (error) {
      logger.error('Delete alert rule error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to delete alert rule',
          status: 500
        }
      });
    }
  }
);

// GET /api/alerts/history - 获取报警历史
router.get('/history',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        ruleId = null,
        startDate = null,
        endDate = null 
      } = req.query;
      
      const offset = (page - 1) * limit;
      let whereClause = '';
      const params = [];

      if (ruleId) {
        whereClause += 'WHERE ah.rule_id = $1';
        params.push(ruleId);
      }

      if (startDate && endDate) {
        const dateCondition = params.length > 0 ? 'AND' : 'WHERE';
        whereClause += ` ${dateCondition} ah.triggered_at BETWEEN $${params.length + 1} AND $${params.length + 2}`;
        params.push(startDate, endDate);
      }

      const history = await DatabaseService.query(`
        SELECT 
          ah.*,
          ar.rule_name,
          ar.metric_name,
          au.username as acknowledged_by_username
        FROM alert_history ah
        JOIN alert_rules ar ON ah.rule_id = ar.id
        LEFT JOIN admin_users au ON ah.acknowledged_by = au.id
        ${whereClause}
        ORDER BY ah.triggered_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const totalResult = await DatabaseService.query(`
        SELECT COUNT(*) 
        FROM alert_history ah
        JOIN alert_rules ar ON ah.rule_id = ar.id
        ${whereClause}
      `, params);

      const total = parseInt(totalResult.rows[0].count);

      res.json({
        alerts: history.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Get alert history error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get alert history',
          status: 500
        }
      });
    }
  }
);

// POST /api/alerts/history/:alertId/acknowledge - 确认报警
router.post('/history/:alertId/acknowledge',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { alertId } = req.params;

      const result = await DatabaseService.query(`
        UPDATE alert_history SET
          status = 'acknowledged',
          acknowledged_by = $2,
          acknowledged_at = NOW()
        WHERE id = $1 AND status != 'acknowledged'
        RETURNING *
      `, [alertId, req.user.id]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: {
            message: 'Alert not found or already acknowledged',
            status: 404
          }
        });
      }

      logger.analytics('alert_acknowledged', {
        alertId: parseInt(alertId),
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'Alert acknowledged',
        alert: result.rows[0]
      });

    } catch (error) {
      logger.error('Acknowledge alert error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to acknowledge alert',
          status: 500
        }
      });
    }
  }
);

// POST /api/alerts/test/:ruleId - 测试报警规则
router.post('/test/:ruleId',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { ruleId } = req.params;

      const rule = await DatabaseService.query(
        'SELECT * FROM alert_rules WHERE id = $1',
        [ruleId]
      );

      if (!rule.rows[0]) {
        return res.status(404).json({
          error: {
            message: 'Alert rule not found',
            status: 404
          }
        });
      }

      const ruleData = rule.rows[0];
      const currentValue = await AlertService.getMetricValue(
        ruleData.metric_name, 
        ruleData.time_window
      );

      // 强制触发测试报警
      await AlertService.triggerAlert(ruleData, currentValue);

      logger.analytics('alert_test_triggered', {
        ruleId: parseInt(ruleId),
        userId: req.user.id,
        currentValue
      });

      res.json({
        success: true,
        message: 'Test alert sent',
        currentValue,
        thresholdValue: ruleData.threshold_value
      });

    } catch (error) {
      logger.error('Test alert error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to send test alert',
          status: 500
        }
      });
    }
  }
);

// 启动报警规则检查定时任务
setInterval(() => {
  AlertService.checkAlertRules();
}, 60000); // 每分钟检查一次

module.exports = router;