const { Pool } = require('pg');
const config = require('../config/config');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // 创建连接池
      this.pool = new Pool({
        connectionString: config.database.postgres.url,
        ...config.database.postgres.pool,
        ssl: config.env === 'production' ? { rejectUnauthorized: false } : false
      });

      // 测试连接
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('PostgreSQL connected successfully');

      // 设置连接池事件监听
      this.setupEventListeners();

      return this.pool;
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  setupEventListeners() {
    this.pool.on('connect', (client) => {
      logger.debug('New PostgreSQL client connected');
    });

    this.pool.on('error', (err, client) => {
      logger.error('PostgreSQL client error:', err);
    });

    this.pool.on('remove', (client) => {
      logger.debug('PostgreSQL client removed');
    });
  }

  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.performance('database_query', duration, {
        query: text.substring(0, 100),
        rowCount: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query error:', {
        error: error.message,
        query: text.substring(0, 100),
        params,
        duration
      });
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 用户会话相关方法
  async createSession(sessionData) {
    const query = `
      INSERT INTO user_sessions (
        session_id, start_time, anonymized_ip, user_agent, 
        country, city, referrer, landing_page
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_id) DO UPDATE SET
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [
      sessionData.sessionId,
      sessionData.startTime,
      sessionData.anonymizedIP,
      sessionData.userAgent,
      sessionData.country,
      sessionData.city,
      sessionData.referrer,
      sessionData.landingPage
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  async updateSession(sessionId, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (fields.length === 0) return null;

    const query = `
      UPDATE user_sessions 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE session_id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(sessionId);
    const result = await this.query(query, values);
    return result.rows[0];
  }

  async getSession(sessionId) {
    const query = 'SELECT * FROM user_sessions WHERE session_id = $1';
    const result = await this.query(query, [sessionId]);
    return result.rows[0];
  }

  async getActiveSessions(timeWindowMinutes = 30) {
    const query = `
      SELECT COUNT(*) as active_sessions
      FROM user_sessions 
      WHERE updated_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
    `;
    const result = await this.query(query);
    return parseInt(result.rows[0].active_sessions);
  }

  // 管理员用户相关方法
  async getAdminUser(username) {
    const query = 'SELECT * FROM admin_users WHERE username = $1 AND is_active = true';
    const result = await this.query(query, [username]);
    return result.rows[0];
  }

  async updateLastLogin(userId) {
    const query = `
      UPDATE admin_users 
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = $1
    `;
    await this.query(query, [userId]);
  }

  // 仪表板配置相关方法
  async getDashboardConfig(userId) {
    const query = `
      SELECT * FROM dashboard_configs 
      WHERE user_id = $1 AND is_default = true
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    const result = await this.query(query, [userId]);
    return result.rows[0];
  }

  async saveDashboardConfig(userId, config) {
    const query = `
      INSERT INTO dashboard_configs (
        user_id, config_name, widgets, refresh_interval, 
        alert_settings, theme, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) WHERE is_default = true
      DO UPDATE SET
        widgets = $3,
        refresh_interval = $4,
        alert_settings = $5,
        theme = $6,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      userId,
      config.configName || 'Default',
      JSON.stringify(config.widgets),
      config.refreshInterval,
      JSON.stringify(config.alertSettings),
      config.theme,
      true
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  // 报警规则相关方法
  async getActiveAlertRules() {
    const query = 'SELECT * FROM alert_rules WHERE is_active = true';
    const result = await this.query(query);
    return result.rows;
  }

  async createAlertRule(ruleData) {
    const query = `
      INSERT INTO alert_rules (
        rule_name, metric_name, condition_type, threshold_value,
        time_window, notification_channels, recipients, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      ruleData.ruleName,
      ruleData.metricName,
      ruleData.conditionType,
      ruleData.thresholdValue,
      ruleData.timeWindow,
      JSON.stringify(ruleData.notificationChannels),
      JSON.stringify(ruleData.recipients),
      ruleData.createdBy
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  async logAlert(ruleId, metricValue, message) {
    const query = `
      INSERT INTO alert_history (rule_id, triggered_at, metric_value, message)
      VALUES ($1, NOW(), $2, $3)
      RETURNING *
    `;

    const result = await this.query(query, [ruleId, metricValue, message]);
    return result.rows[0];
  }

  // 报告生成相关方法
  async createReportGeneration(reportData) {
    const query = `
      INSERT INTO report_generations (
        report_name, report_type, parameters, generated_by, share_token, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      reportData.reportName,
      reportData.reportType,
      JSON.stringify(reportData.parameters),
      reportData.generatedBy,
      reportData.shareToken,
      reportData.expiresAt
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  async updateReportGeneration(reportId, updateData) {
    const query = `
      UPDATE report_generations 
      SET status = $2, file_path = $3, file_size = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, [
      reportId,
      updateData.status,
      updateData.filePath,
      updateData.fileSize
    ]);
    return result.rows[0];
  }

  async getReportByShareToken(shareToken) {
    const query = `
      SELECT * FROM report_generations 
      WHERE share_token = $1 AND expires_at > NOW()
    `;
    const result = await this.query(query, [shareToken]);
    return result.rows[0];
  }

  // 系统配置相关方法
  async getSystemConfig(configKey) {
    const query = 'SELECT config_value FROM system_configs WHERE config_key = $1';
    const result = await this.query(query, [configKey]);
    return result.rows[0]?.config_value;
  }

  async setSystemConfig(configKey, configValue, updatedBy) {
    const query = `
      INSERT INTO system_configs (config_key, config_value, updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (config_key) DO UPDATE SET
        config_value = $2,
        updated_by = $3,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.query(query, [configKey, configValue, updatedBy]);
    return result.rows[0];
  }

  // 数据清理方法
  async cleanupOldData() {
    const retentionDays = config.dataRetention.sessionDays;
    
    const query = `
      DELETE FROM user_sessions 
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
    `;
    
    const result = await this.query(query);
    logger.info(`Cleaned up ${result.rowCount} old sessions`);
    return result.rowCount;
  }

  // 统计查询方法
  async getSessionStats(startDate, endDate, granularity = 'day') {
    const dateFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 'YYYY-MM-DD';
    
    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('${granularity}', start_time), '${dateFormat}') as time_bucket,
        COUNT(*) as sessions,
        COUNT(DISTINCT anonymized_ip) as unique_visitors,
        AVG(duration) as avg_duration,
        SUM(CASE WHEN bounced = true THEN 1 ELSE 0 END)::float / COUNT(*) as bounce_rate
      FROM user_sessions
      WHERE start_time >= $1 AND start_time <= $2
      GROUP BY time_bucket
      ORDER BY time_bucket
    `;

    const result = await this.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getTopPages(startDate, endDate, limit = 10) {
    const query = `
      SELECT 
        landing_page,
        COUNT(*) as visits,
        COUNT(DISTINCT anonymized_ip) as unique_visitors
      FROM user_sessions
      WHERE start_time >= $1 AND start_time <= $2
      GROUP BY landing_page
      ORDER BY visits DESC
      LIMIT $3
    `;

    const result = await this.query(query, [startDate, endDate, limit]);
    return result.rows;
  }

  async getGeographicDistribution(startDate, endDate) {
    const query = `
      SELECT 
        country,
        city,
        COUNT(*) as sessions,
        COUNT(DISTINCT anonymized_ip) as unique_visitors
      FROM user_sessions
      WHERE start_time >= $1 AND start_time <= $2 
        AND country IS NOT NULL
      GROUP BY country, city
      ORDER BY sessions DESC
    `;

    const result = await this.query(query, [startDate, endDate]);
    return result.rows;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL connection closed');
    }
  }

  getHealth() {
    return {
      connected: this.isConnected,
      totalConnections: this.pool?.totalCount || 0,
      idleConnections: this.pool?.idleCount || 0,
      waitingConnections: this.pool?.waitingCount || 0
    };
  }
}

// 创建单例实例
const databaseService = new DatabaseService();

module.exports = databaseService;