const crypto = require('crypto');
const config = require('../config/config');
const DatabaseService = require('./DatabaseService');
const RedisService = require('./RedisService');
const logger = require('../utils/logger');

class PrivacyService {
  constructor() {
    this.saltRounds = config.security.bcryptRounds || 10;
    this.hashAlgorithm = 'sha256';
  }

  // IP地址匿名化
  anonymizeIP(ip) {
    if (!ip || ip === 'unknown') return 'unknown';

    try {
      // IPv4地址匿名化
      if (ip.includes('.') && !ip.includes(':')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
          // 保留前3个八位组，最后一个设为0
          return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
        }
      }

      // IPv6地址匿名化
      if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
          // 保留前4个组，其余设为0
          return parts.slice(0, 4).join(':') + '::';
        }
      }

      // 如果格式不识别，返回哈希值的前8位
      return this.hashString(ip).substring(0, 8);
    } catch (error) {
      logger.error('IP anonymization error:', error);
      return 'unknown';
    }
  }

  // 用户代理字符串清理
  sanitizeUserAgent(userAgent) {
    if (!userAgent) return 'unknown';

    try {
      // 移除可能包含个人信息的部分
      let sanitized = userAgent
        // 移除版本号中的详细信息
        .replace(/\([^)]*\)/g, '()')
        // 移除可能的用户名或个人标识
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
        // 移除可能的文件路径
        .replace(/[C-Z]:\\[^;)]+/g, '[path]')
        // 移除过长的字符串（可能包含个人信息）
        .replace(/\b\w{50,}\b/g, '[long_string]');

      // 限制长度
      if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500) + '...';
      }

      return sanitized;
    } catch (error) {
      logger.error('User agent sanitization error:', error);
      return 'unknown';
    }
  }

  // 生成匿名会话ID
  generateAnonymousSessionId(originalSessionId, userIP) {
    try {
      // 使用原始会话ID和IP的哈希值生成匿名ID
      const combined = `${originalSessionId}:${userIP}:${Date.now()}`;
      const hash = this.hashString(combined);
      return `anon_${hash.substring(0, 16)}`;
    } catch (error) {
      logger.error('Anonymous session ID generation error:', error);
      return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  // 字符串哈希
  hashString(str) {
    return crypto.createHash(this.hashAlgorithm).update(str).digest('hex');
  }

  // 敏感数据过滤
  filterSensitiveData(data) {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth',
      'email', 'phone', 'ssn', 'credit_card', 'passport',
      'name', 'address', 'birthday', 'age'
    ];

    const filtered = { ...data };

    // 递归过滤对象
    const filterObject = (obj) => {
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // 检查是否为敏感字段
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          obj[key] = '[filtered]';
        } else if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            obj[key] = value.map(item => 
              typeof item === 'object' ? filterObject({ ...item }) : item
            );
          } else {
            obj[key] = filterObject({ ...value });
          }
        } else if (typeof value === 'string') {
          // 检查字符串中是否包含敏感信息
          obj[key] = this.sanitizeString(value);
        }
      }
      return obj;
    };

    return filterObject(filtered);
  }

  // 字符串敏感信息清理
  sanitizeString(str) {
    if (!str || typeof str !== 'string') return str;

    try {
      let sanitized = str;

      // 移除邮箱地址
      sanitized = sanitized.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[email]'
      );

      // 移除电话号码
      sanitized = sanitized.replace(
        /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
        '[phone]'
      );

      // 移除信用卡号码
      sanitized = sanitized.replace(
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        '[credit_card]'
      );

      // 移除社会安全号码
      sanitized = sanitized.replace(
        /\b\d{3}-?\d{2}-?\d{4}\b/g,
        '[ssn]'
      );

      // 移除IP地址
      sanitized = sanitized.replace(
        /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        '[ip]'
      );

      return sanitized;
    } catch (error) {
      logger.error('String sanitization error:', error);
      return '[sanitization_error]';
    }
  }

  // 数据最小化 - 只保留必要的统计信息
  minimizeEventData(eventData) {
    const allowedFields = {
      page_view: [
        'sessionId', 'url', 'referrer', 'timestamp',
        'screenResolution', 'language', 'country', 'city'
      ],
      feature_usage: [
        'sessionId', 'feature', 'action', 'duration', 'timestamp',
        'success', 'errorType'
      ],
      session_event: [
        'sessionId', 'eventType', 'timestamp', 'duration'
      ]
    };

    const eventType = eventData.eventType || 'unknown';
    const allowed = allowedFields[eventType] || [];

    const minimized = {};
    for (const field of allowed) {
      if (eventData.hasOwnProperty(field)) {
        minimized[field] = eventData[field];
      }
    }

    // 特殊处理参数对象
    if (eventData.parameters && typeof eventData.parameters === 'object') {
      minimized.parameters = this.filterSensitiveData(eventData.parameters);
    }

    return minimized;
  }

  // 用户同意管理
  async recordUserConsent(sessionId, consentData) {
    try {
      const consentRecord = {
        sessionId,
        timestamp: new Date().toISOString(),
        consentGiven: consentData.analytics || false,
        consentVersion: consentData.version || '1.0',
        userAgent: this.sanitizeUserAgent(consentData.userAgent),
        ipHash: this.hashString(consentData.ip || 'unknown')
      };

      // 存储到Redis（临时）和数据库（永久）
      await RedisService.set(
        `consent:${sessionId}`,
        consentRecord,
        30 * 24 * 60 * 60 // 30天过期
      );

      // 如果用户同意，记录到数据库
      if (consentRecord.consentGiven) {
        await DatabaseService.query(`
          INSERT INTO user_consents (
            session_id, consent_given, consent_version, 
            user_agent_hash, ip_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (session_id) DO UPDATE SET
            consent_given = $2,
            consent_version = $3,
            updated_at = NOW()
        `, [
          sessionId,
          consentRecord.consentGiven,
          consentRecord.consentVersion,
          this.hashString(consentRecord.userAgent),
          consentRecord.ipHash
        ]);
      }

      logger.analytics('user_consent', {
        sessionId,
        consentGiven: consentRecord.consentGiven,
        version: consentRecord.consentVersion
      });

      return consentRecord;
    } catch (error) {
      logger.error('User consent recording error:', error);
      throw error;
    }
  }

  // 检查用户同意状态
  async checkUserConsent(sessionId) {
    try {
      // 首先检查Redis缓存
      const cachedConsent = await RedisService.get(`consent:${sessionId}`);
      if (cachedConsent) {
        return cachedConsent;
      }

      // 如果缓存中没有，检查数据库
      const result = await DatabaseService.query(
        'SELECT * FROM user_consents WHERE session_id = $1',
        [sessionId]
      );

      if (result.rows[0]) {
        const consent = {
          sessionId,
          consentGiven: result.rows[0].consent_given,
          consentVersion: result.rows[0].consent_version,
          timestamp: result.rows[0].created_at
        };

        // 缓存结果
        await RedisService.set(`consent:${sessionId}`, consent, 24 * 60 * 60);
        return consent;
      }

      return null;
    } catch (error) {
      logger.error('User consent check error:', error);
      return null;
    }
  }

  // 数据删除请求处理
  async processDataDeletionRequest(identifier, identifierType = 'session') {
    try {
      const deletionId = `deletion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Processing data deletion request', {
        deletionId,
        identifier: this.hashString(identifier),
        identifierType
      });

      let deletedRecords = 0;

      if (identifierType === 'session') {
        // 删除会话相关数据
        
        // 1. 删除PostgreSQL中的会话数据
        const sessionResult = await DatabaseService.query(
          'DELETE FROM user_sessions WHERE session_id = $1',
          [identifier]
        );
        deletedRecords += sessionResult.rowCount;

        // 2. 删除同意记录
        const consentResult = await DatabaseService.query(
          'DELETE FROM user_consents WHERE session_id = $1',
          [identifier]
        );
        deletedRecords += consentResult.rowCount;

        // 3. 删除Redis中的数据
        await RedisService.del(`session:${identifier}`);
        await RedisService.del(`consent:${identifier}`);
        await RedisService.srem('active_sessions', identifier);

        // 4. 删除InfluxDB中的事件数据
        // 注意：InfluxDB删除是异步的，可能需要一些时间
        await InfluxDBService.deleteOldData('page_views', 0); // 删除所有数据，需要更精确的过滤
        await InfluxDBService.deleteOldData('feature_usage', 0);

      } else if (identifierType === 'ip') {
        // 根据IP哈希删除数据
        const ipHash = this.hashString(identifier);
        
        const ipResult = await DatabaseService.query(
          'DELETE FROM user_sessions WHERE anonymized_ip = $1',
          [this.anonymizeIP(identifier)]
        );
        deletedRecords += ipResult.rowCount;
      }

      // 记录删除操作
      await DatabaseService.query(`
        INSERT INTO data_deletion_logs (
          deletion_id, identifier_hash, identifier_type, 
          records_deleted, requested_at, completed_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [
        deletionId,
        this.hashString(identifier),
        identifierType,
        deletedRecords
      ]);

      logger.analytics('data_deletion', {
        deletionId,
        identifierType,
        recordsDeleted: deletedRecords
      });

      return {
        deletionId,
        recordsDeleted: deletedRecords,
        status: 'completed',
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Data deletion error:', error);
      throw error;
    }
  }

  // 数据保留策略执行
  async enforceDataRetention() {
    try {
      const retentionDays = config.dataRetention.sessionDays;
      
      logger.info('Enforcing data retention policy', { retentionDays });

      // 删除过期的会话数据
      const sessionResult = await DatabaseService.query(`
        DELETE FROM user_sessions 
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
      `);

      // 删除过期的同意记录
      const consentResult = await DatabaseService.query(`
        DELETE FROM user_consents 
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
      `);

      // 删除InfluxDB中的过期数据
      await InfluxDBService.deleteOldData('page_views', retentionDays);
      await InfluxDBService.deleteOldData('feature_usage', retentionDays);

      const totalDeleted = sessionResult.rowCount + consentResult.rowCount;

      logger.analytics('data_retention', {
        retentionDays,
        sessionsDeleted: sessionResult.rowCount,
        consentsDeleted: consentResult.rowCount,
        totalDeleted
      });

      return {
        sessionsDeleted: sessionResult.rowCount,
        consentsDeleted: consentResult.rowCount,
        totalDeleted,
        retentionDays
      };

    } catch (error) {
      logger.error('Data retention enforcement error:', error);
      throw error;
    }
  }

  // 隐私合规检查
  async performPrivacyAudit() {
    try {
      const audit = {
        timestamp: new Date().toISOString(),
        checks: {}
      };

      // 检查数据匿名化
      const sampleSessions = await DatabaseService.query(`
        SELECT anonymized_ip, user_agent 
        FROM user_sessions 
        ORDER BY created_at DESC 
        LIMIT 100
      `);

      let anonymizationIssues = 0;
      for (const session of sampleSessions.rows) {
        // 检查IP是否正确匿名化
        if (session.anonymized_ip && session.anonymized_ip.includes('.')) {
          const parts = session.anonymized_ip.split('.');
          if (parts.length === 4 && parts[3] !== '0') {
            anonymizationIssues++;
          }
        }
      }

      audit.checks.anonymization = {
        passed: anonymizationIssues === 0,
        issues: anonymizationIssues,
        sampleSize: sampleSessions.rows.length
      };

      // 检查数据保留
      const oldestSession = await DatabaseService.query(`
        SELECT MIN(created_at) as oldest_date 
        FROM user_sessions
      `);

      const oldestDate = oldestSession.rows[0]?.oldest_date;
      const retentionDays = config.dataRetention.sessionDays;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      audit.checks.retention = {
        passed: !oldestDate || new Date(oldestDate) >= cutoffDate,
        oldestRecord: oldestDate,
        retentionPolicy: `${retentionDays} days`,
        cutoffDate: cutoffDate.toISOString()
      };

      // 检查同意记录
      const consentStats = await DatabaseService.query(`
        SELECT 
          COUNT(*) as total_consents,
          COUNT(CASE WHEN consent_given = true THEN 1 END) as consents_given,
          COUNT(CASE WHEN consent_given = false THEN 1 END) as consents_denied
        FROM user_consents
        WHERE created_at > NOW() - INTERVAL '30 days'
      `);

      audit.checks.consent = {
        totalConsents: parseInt(consentStats.rows[0]?.total_consents || 0),
        consentsGiven: parseInt(consentStats.rows[0]?.consents_given || 0),
        consentsDenied: parseInt(consentStats.rows[0]?.consents_denied || 0)
      };

      // 整体合规状态
      audit.overallCompliance = Object.values(audit.checks).every(check => 
        check.passed !== false
      );

      logger.analytics('privacy_audit', audit);

      return audit;

    } catch (error) {
      logger.error('Privacy audit error:', error);
      throw error;
    }
  }

  // 生成隐私报告
  async generatePrivacyReport(startDate, endDate) {
    try {
      const report = {
        period: { startDate, endDate },
        timestamp: new Date().toISOString(),
        dataCollection: {},
        userConsent: {},
        dataRetention: {},
        deletionRequests: {}
      };

      // 数据收集统计
      const collectionStats = await DatabaseService.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(DISTINCT anonymized_ip) as unique_ips,
          COUNT(DISTINCT DATE(created_at)) as active_days
        FROM user_sessions
        WHERE created_at BETWEEN $1 AND $2
      `, [startDate, endDate]);

      report.dataCollection = collectionStats.rows[0];

      // 用户同意统计
      const consentStats = await DatabaseService.query(`
        SELECT 
          COUNT(*) as total_consent_requests,
          COUNT(CASE WHEN consent_given = true THEN 1 END) as consents_given,
          COUNT(CASE WHEN consent_given = false THEN 1 END) as consents_denied,
          AVG(CASE WHEN consent_given = true THEN 1.0 ELSE 0.0 END) as consent_rate
        FROM user_consents
        WHERE created_at BETWEEN $1 AND $2
      `, [startDate, endDate]);

      report.userConsent = {
        ...consentStats.rows[0],
        consent_rate: parseFloat(consentStats.rows[0]?.consent_rate || 0).toFixed(2)
      };

      // 数据删除请求统计
      const deletionStats = await DatabaseService.query(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(records_deleted) as total_records_deleted,
          AVG(records_deleted) as avg_records_per_request
        FROM data_deletion_logs
        WHERE requested_at BETWEEN $1 AND $2
      `, [startDate, endDate]);

      report.deletionRequests = deletionStats.rows[0];

      return report;

    } catch (error) {
      logger.error('Privacy report generation error:', error);
      throw error;
    }
  }
}

// 创建单例实例
const privacyService = new PrivacyService();

module.exports = privacyService;