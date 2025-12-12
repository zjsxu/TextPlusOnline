const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Joi = require('joi');

const DatabaseService = require('../services/DatabaseService');
const AuthMiddleware = require('../middleware/auth');
const { redis: rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// 数据验证模式
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).max(100).required()
});

const dashboardConfigSchema = Joi.object({
  widgets: Joi.array().items(Joi.object()).default([]),
  refreshInterval: Joi.number().integer().min(5).max(300).default(30),
  alertSettings: Joi.object().default({}),
  theme: Joi.string().valid('light', 'dark').default('light')
});

// POST /api/admin/auth/login - 管理员登录
router.post('/auth/login',
  rateLimiter.authentication(),
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const { username, password } = value;

      // 获取用户信息
      const user = await DatabaseService.getAdminUser(username);
      if (!user) {
        logger.security('Login attempt with invalid username', {
          username,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          error: {
            message: 'Invalid credentials',
            status: 401
          }
        });
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        logger.security('Login attempt with invalid password', {
          username,
          userId: user.id,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          error: {
            message: 'Invalid credentials',
            status: 401
          }
        });
      }

      // 检查账户状态
      if (!user.is_active) {
        logger.security('Login attempt with disabled account', {
          username,
          userId: user.id,
          ip: req.ip
        });

        return res.status(401).json({
          error: {
            message: 'Account is disabled',
            status: 401
          }
        });
      }

      // 生成JWT令牌
      const token = AuthMiddleware.generateToken(user.id);
      const refreshToken = AuthMiddleware.generateToken(user.id, '7d');

      // 更新最后登录时间
      await DatabaseService.updateLastLogin(user.id);

      logger.analytics('admin_login', {
        userId: user.id,
        username: user.username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Login successful',
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          lastLogin: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({
        error: {
          message: 'Login failed',
          status: 500
        }
      });
    }
  }
);

// POST /api/admin/auth/refresh - 刷新令牌
router.post('/auth/refresh', AuthMiddleware.refreshToken);

// POST /api/admin/auth/logout - 登出
router.post('/auth/logout', AuthMiddleware.logout);

// GET /api/admin/profile - 获取管理员资料
router.get('/profile',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const user = await DatabaseService.query(
        'SELECT id, username, email, role, last_login, created_at FROM admin_users WHERE id = $1',
        [req.user.id]
      );

      if (!user.rows[0]) {
        return res.status(404).json({
          error: {
            message: 'User not found',
            status: 404
          }
        });
      }

      res.json({
        user: user.rows[0]
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get profile',
          status: 500
        }
      });
    }
  }
);

// GET /api/admin/dashboard/config - 获取仪表板配置
router.get('/dashboard/config',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const config = await DatabaseService.getDashboardConfig(req.user.id);
      
      if (!config) {
        // 返回默认配置
        const defaultConfig = {
          widgets: [
            { type: 'real_time_stats', position: { x: 0, y: 0, w: 6, h: 4 } },
            { type: 'page_views_chart', position: { x: 6, y: 0, w: 6, h: 4 } },
            { type: 'feature_usage', position: { x: 0, y: 4, w: 4, h: 4 } },
            { type: 'geographic_map', position: { x: 4, y: 4, w: 8, h: 4 } }
          ],
          refreshInterval: 30,
          alertSettings: {
            emailEnabled: true,
            smsEnabled: false,
            webhookEnabled: false
          },
          theme: 'light'
        };

        return res.json({ config: defaultConfig });
      }

      res.json({
        config: {
          widgets: config.widgets,
          refreshInterval: config.refresh_interval,
          alertSettings: config.alert_settings,
          theme: config.theme
        }
      });

    } catch (error) {
      logger.error('Get dashboard config error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get dashboard configuration',
          status: 500
        }
      });
    }
  }
);

// PUT /api/admin/dashboard/config - 更新仪表板配置
router.put('/dashboard/config',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = dashboardConfigSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const config = await DatabaseService.saveDashboardConfig(req.user.id, value);

      logger.analytics('dashboard_config_updated', {
        userId: req.user.id,
        widgetCount: value.widgets.length,
        theme: value.theme
      });

      res.json({
        success: true,
        message: 'Dashboard configuration updated',
        config: {
          widgets: config.widgets,
          refreshInterval: config.refresh_interval,
          alertSettings: config.alert_settings,
          theme: config.theme
        }
      });

    } catch (error) {
      logger.error('Update dashboard config error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to update dashboard configuration',
          status: 500
        }
      });
    }
  }
);

// GET /api/admin/users - 获取管理员用户列表（仅超级管理员）
router.get('/users',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireSuperAdmin,
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const users = await DatabaseService.query(`
        SELECT id, username, email, role, is_active, last_login, created_at
        FROM admin_users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const totalResult = await DatabaseService.query('SELECT COUNT(*) FROM admin_users');
      const total = parseInt(totalResult.rows[0].count);

      res.json({
        users: users.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get users',
          status: 500
        }
      });
    }
  }
);

// GET /api/admin/system/status - 获取系统状态
router.get('/system/status',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      // 获取系统健康状态
      const dbHealth = DatabaseService.getHealth();
      const redisHealth = RedisService.getHealth();
      const influxHealth = await InfluxDBService.getHealth();

      // 获取系统统计
      const stats = await DatabaseService.query(`
        SELECT 
          (SELECT COUNT(*) FROM user_sessions WHERE created_at > NOW() - INTERVAL '24 hours') as sessions_today,
          (SELECT COUNT(*) FROM user_sessions WHERE created_at > NOW() - INTERVAL '7 days') as sessions_week,
          (SELECT COUNT(DISTINCT anonymized_ip) FROM user_sessions WHERE created_at > NOW() - INTERVAL '24 hours') as unique_visitors_today,
          (SELECT COUNT(*) FROM admin_users WHERE is_active = true) as active_admins
      `);

      // 获取存储使用情况
      const storageStats = await DatabaseService.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          (SELECT COUNT(*) FROM user_sessions) as total_sessions,
          (SELECT COUNT(*) FROM user_consents) as total_consents
      `);

      res.json({
        timestamp: new Date().toISOString(),
        health: {
          database: dbHealth,
          redis: redisHealth,
          influxdb: influxHealth,
          overall: dbHealth.connected && redisHealth.connected && influxHealth.connected
        },
        statistics: stats.rows[0],
        storage: storageStats.rows[0],
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });

    } catch (error) {
      logger.error('Get system status error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get system status',
          status: 500
        }
      });
    }
  }
);

// POST /api/admin/maintenance/cleanup - 执行数据清理
router.post('/maintenance/cleanup',
  AuthMiddleware.verifyToken,
  AuthMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const cleanupResult = await DatabaseService.cleanupOldData();
      
      logger.analytics('data_cleanup', {
        userId: req.user.id,
        recordsDeleted: cleanupResult
      });

      res.json({
        success: true,
        message: 'Data cleanup completed',
        recordsDeleted: cleanupResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Data cleanup error:', error);
      res.status(500).json({
        error: {
          message: 'Data cleanup failed',
          status: 500
        }
      });
    }
  }
);

module.exports = router;