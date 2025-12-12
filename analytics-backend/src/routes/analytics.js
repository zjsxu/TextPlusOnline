const express = require('express');
const router = express.Router();
const Joi = require('joi');

const DatabaseService = require('../services/DatabaseService');
const RedisService = require('../services/RedisService');
const InfluxDBService = require('../services/InfluxDBService');
const DataProcessingService = require('../services/DataProcessingService');
const RealTimeStatsService = require('../services/RealTimeStatsService');
const PrivacyService = require('../services/PrivacyService');
const AuthMiddleware = require('../middleware/auth');
const { redis: rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// 初始化服务实例
const dataProcessor = new DataProcessingService();
const realTimeStats = new RealTimeStatsService();

// 启动数据处理引擎
dataProcessor.start().catch(error => {
  logger.error('Failed to start data processing engine:', error);
});

// 数据验证模式
const pageViewSchema = Joi.object({
  sessionId: Joi.string().required().max(255),
  url: Joi.string().uri().required(),
  referrer: Joi.string().uri().allow('', null),
  userAgent: Joi.string().required().max(1000),
  screenResolution: Joi.string().pattern(/^\d+x\d+$/).required(),
  language: Joi.string().max(10).required(),
  timestamp: Joi.date().iso().default(() => new Date())
});

const featureUsageSchema = Joi.object({
  sessionId: Joi.string().required().max(255),
  feature: Joi.string().required().max(100),
  action: Joi.string().required().max(100),
  parameters: Joi.object().default({}),
  duration: Joi.number().integer().min(0).default(0),
  timestamp: Joi.date().iso().default(() => new Date())
});

const sessionEventSchema = Joi.object({
  sessionId: Joi.string().required().max(255),
  eventType: Joi.string().valid('start', 'end', 'heartbeat').required(),
  data: Joi.object().default({}),
  timestamp: Joi.date().iso().default(() => new Date())
});

const batchEventsSchema = Joi.object({
  events: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('page_view', 'feature_usage', 'session_event').required(),
      data: Joi.object().required()
    })
  ).min(1).max(100).required()
});

// 辅助函数：匿名化IP地址
function anonymizeIP(ip) {
  if (!ip) return 'unknown';
  
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  
  return 'unknown';
}

// 辅助函数：从User-Agent获取地理位置信息（简化版）
function getLocationFromUserAgent(userAgent, ip) {
  // 基于User-Agent和IP的简单地理位置检测
  // 生产环境建议集成MaxMind GeoIP或类似服务
  
  // 从User-Agent检测语言偏好
  const language = userAgent.match(/\b(zh-CN|zh-TW|en-US|en-GB|ja-JP|ko-KR)\b/i);
  
  // 基于语言推测大致地区（隐私友好的方式）
  if (language) {
    const lang = language[0].toLowerCase();
    if (lang.startsWith('zh-cn')) return { country: 'CN', city: 'Unknown' };
    if (lang.startsWith('zh-tw')) return { country: 'TW', city: 'Unknown' };
    if (lang.startsWith('ja')) return { country: 'JP', city: 'Unknown' };
    if (lang.startsWith('ko')) return { country: 'KR', city: 'Unknown' };
    if (lang.startsWith('en')) return { country: 'US', city: 'Unknown' };
  }
  
  // 默认返回未知地区
  return { country: 'Unknown', city: 'Unknown' };
}

// POST /api/analytics/events/page-view - 收集页面访问事件
router.post('/events/page-view', 
  rateLimiter.dataCollection(),
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = pageViewSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const eventData = value;
      const anonymizedIP = anonymizeIP(req.ip);
      const location = getLocationFromUserAgent(eventData.userAgent, req.ip);

      // 检查或创建会话
      let session = await DatabaseService.getSession(eventData.sessionId);
      
      if (!session) {
        // 创建新会话
        session = await DatabaseService.createSession({
          sessionId: eventData.sessionId,
          startTime: eventData.timestamp,
          anonymizedIP,
          userAgent: eventData.userAgent,
          country: location.country,
          city: location.city,
          referrer: eventData.referrer,
          landingPage: eventData.url
        });
      } else {
        // 更新现有会话
        await DatabaseService.updateSession(eventData.sessionId, {
          page_views: (session.page_views || 0) + 1,
          end_time: eventData.timestamp
        });
      }

      // 创建统一的事件数据格式
      const unifiedEventData = {
        event: 'page_view',
        sessionId: eventData.sessionId,
        timestamp: eventData.timestamp,
        url: eventData.url,
        referrer: eventData.referrer,
        userAgent: eventData.userAgent,
        screenResolution: eventData.screenResolution,
        language: eventData.language,
        country: location.country,
        city: location.city,
        anonymizedIP
      };

      // 隐私保护处理
      const sanitizedData = await PrivacyService.sanitizeEventData(unifiedEventData);

      // 写入InfluxDB事件数据
      await InfluxDBService.writePageView({
        sessionId: sanitizedData.sessionId,
        url: sanitizedData.url,
        referrer: sanitizedData.referrer,
        country: sanitizedData.country,
        userAgent: sanitizedData.userAgent,
        screenWidth: parseInt(sanitizedData.screenResolution.split('x')[0]),
        screenHeight: parseInt(sanitizedData.screenResolution.split('x')[1]),
        timestamp: sanitizedData.timestamp
      });

      // 实时统计处理
      await realTimeStats.processEvent(sanitizedData);

      // 更新Redis实时统计
      await RedisService.sadd('active_sessions', eventData.sessionId);
      await RedisService.expire('active_sessions', 1800); // 30分钟过期
      await RedisService.incrementCounter('page_views_today');

      logger.analytics('page_view', {
        sessionId: eventData.sessionId,
        url: eventData.url,
        country: location.country
      });

      res.status(201).json({
        success: true,
        message: 'Page view recorded',
        sessionId: eventData.sessionId
      });

    } catch (error) {
      logger.error('Page view collection error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to record page view',
          status: 500
        }
      });
    }
  }
);

// POST /api/analytics/events/feature-usage - 收集功能使用事件
router.post('/events/feature-usage',
  rateLimiter.dataCollection(),
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = featureUsageSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const eventData = value;

      // 创建统一的事件数据格式
      const unifiedEventData = {
        event: 'feature_usage',
        sessionId: eventData.sessionId,
        timestamp: eventData.timestamp,
        feature: eventData.feature,
        action: eventData.action,
        duration: eventData.duration,
        parameters: eventData.parameters
      };

      // 隐私保护处理
      const sanitizedData = await PrivacyService.sanitizeEventData(unifiedEventData);

      // 写入InfluxDB事件数据
      await InfluxDBService.writeFeatureUsage({
        sessionId: sanitizedData.sessionId,
        feature: sanitizedData.feature,
        action: sanitizedData.action,
        duration: sanitizedData.duration,
        parameters: sanitizedData.parameters,
        timestamp: sanitizedData.timestamp
      });

      // 实时统计处理
      await realTimeStats.processEvent(sanitizedData);

      // 更新Redis统计
      await RedisService.incrementCounter(`feature_usage:${eventData.feature}`);
      await RedisService.zadd('popular_features', 1, eventData.feature);

      logger.analytics('feature_usage', {
        sessionId: eventData.sessionId,
        feature: eventData.feature,
        action: eventData.action,
        duration: eventData.duration
      });

      res.status(201).json({
        success: true,
        message: 'Feature usage recorded'
      });

    } catch (error) {
      logger.error('Feature usage collection error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to record feature usage',
          status: 500
        }
      });
    }
  }
);

// POST /api/analytics/events/session - 收集会话事件
router.post('/events/session',
  rateLimiter.dataCollection(),
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = sessionEventSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const eventData = value;

      if (eventData.eventType === 'end') {
        // 会话结束，更新会话信息
        const session = await DatabaseService.getSession(eventData.sessionId);
        if (session) {
          const duration = new Date(eventData.timestamp) - new Date(session.start_time);
          const bounced = (session.page_views || 0) <= 1;

          await DatabaseService.updateSession(eventData.sessionId, {
            end_time: eventData.timestamp,
            duration: Math.max(0, Math.floor(duration / 1000)),
            bounced
          });

          // 从活跃会话中移除
          await RedisService.srem('active_sessions', eventData.sessionId);
        }
      } else if (eventData.eventType === 'heartbeat') {
        // 心跳事件，延长会话过期时间
        await RedisService.extendSession(eventData.sessionId, 1800);
      }

      logger.analytics('session_event', {
        sessionId: eventData.sessionId,
        eventType: eventData.eventType
      });

      res.status(201).json({
        success: true,
        message: 'Session event recorded'
      });

    } catch (error) {
      logger.error('Session event collection error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to record session event',
          status: 500
        }
      });
    }
  }
);

// POST /api/analytics/events/batch - 批量收集事件
router.post('/events/batch',
  rateLimiter.dataCollection(),
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = batchEventsSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const { events } = value;
      const results = [];

      // 处理每个事件
      for (const event of events) {
        try {
          let validationSchema;
          switch (event.type) {
            case 'page_view':
              validationSchema = pageViewSchema;
              break;
            case 'feature_usage':
              validationSchema = featureUsageSchema;
              break;
            case 'session_event':
              validationSchema = sessionEventSchema;
              break;
            default:
              throw new Error(`Unknown event type: ${event.type}`);
          }

          const { error: eventError, value: eventData } = validationSchema.validate(event.data);
          if (eventError) {
            results.push({
              success: false,
              error: eventError.details,
              eventType: event.type
            });
            continue;
          }

          // 根据事件类型处理
          if (event.type === 'page_view') {
            const anonymizedIP = anonymizeIP(req.ip);
            const location = getLocationFromUserAgent(eventData.userAgent, req.ip);

            await InfluxDBService.writePageView({
              sessionId: eventData.sessionId,
              url: eventData.url,
              referrer: eventData.referrer,
              country: location.country,
              userAgent: eventData.userAgent,
              timestamp: eventData.timestamp
            });
          } else if (event.type === 'feature_usage') {
            await InfluxDBService.writeFeatureUsage(eventData);
          }

          results.push({
            success: true,
            eventType: event.type
          });

        } catch (eventError) {
          results.push({
            success: false,
            error: eventError.message,
            eventType: event.type
          });
        }
      }

      // 强制刷新InfluxDB缓冲区
      await InfluxDBService.flush();

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      logger.analytics('batch_events', {
        totalEvents: events.length,
        successCount,
        failureCount
      });

      res.status(201).json({
        success: true,
        message: 'Batch events processed',
        summary: {
          total: events.length,
          successful: successCount,
          failed: failureCount
        },
        results
      });

    } catch (error) {
      logger.error('Batch events collection error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to process batch events',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/real-time - 获取实时统计（需要认证）
router.get('/real-time',
  AuthMiddleware.verifyToken,
  rateLimiter.apiQuery(),
  async (req, res) => {
    try {
      // 使用新的实时统计服务
      const realTimeData = await realTimeStats.getRealTimeStats();
      
      // 获取活跃会话数（兼容旧版本）
      const activeSessions = await RedisService.smembers('active_sessions');
      const legacyOnlineUsers = activeSessions.length;

      // 获取今日页面访问数
      const todayPageViews = await RedisService.getCounter('page_views_today');

      // 获取热门功能
      const popularFeatures = await RedisService.zrange('popular_features', 0, 4, true);

      // 系统健康状态
      const systemHealth = {
        database: DatabaseService.getHealth(),
        redis: RedisService.getHealth(),
        influxdb: await InfluxDBService.getHealth(),
        dataProcessor: dataProcessor.isProcessing,
        realTimeStats: true
      };

      // 合并新旧数据格式
      res.json({
        // 新格式数据
        ...realTimeData,
        
        // 兼容旧格式
        onlineUsers: Math.max(realTimeData.onlineUsers, legacyOnlineUsers),
        todayPageViews,
        popularFeatures: popularFeatures.map(f => ({
          feature: f.member,
          count: f.score
        })),
        systemHealth,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Real-time stats error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get real-time statistics',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/historical - 获取历史数据（需要认证）
router.get('/historical',
  AuthMiddleware.verifyToken,
  rateLimiter.apiQuery(),
  async (req, res) => {
    try {
      const {
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end = new Date().toISOString(),
        granularity = 'day',
        metrics = 'page_views,sessions,users'
      } = req.query;

      // 验证参数
      const validGranularities = ['hour', 'day', 'week', 'month'];
      if (!validGranularities.includes(granularity)) {
        return res.status(400).json({
          error: {
            message: 'Invalid granularity. Must be one of: ' + validGranularities.join(', '),
            status: 400
          }
        });
      }

      const requestedMetrics = metrics.split(',');
      const data = {};

      // 使用新的数据处理服务获取历史数据
      const historicalData = await dataProcessor.getHistoricalStats(
        new Date(start),
        new Date(end),
        granularity
      );

      // 获取会话统计
      if (requestedMetrics.includes('sessions') || requestedMetrics.includes('users')) {
        const sessionStats = await DatabaseService.getSessionStats(start, end, granularity);
        data.sessions = sessionStats;
      }

      // 获取页面访问趋势
      if (requestedMetrics.includes('page_views')) {
        const pageViewTrend = await InfluxDBService.getPageViewTrend(
          new Date(start).toISOString(),
          new Date(end).toISOString(),
          granularity === 'hour' ? '1h' : '1d'
        );
        data.pageViews = pageViewTrend;
      }

      // 获取功能使用统计
      if (requestedMetrics.includes('features')) {
        const featureStats = await InfluxDBService.getFeatureUsageStats(
          new Date(start).toISOString(),
          new Date(end).toISOString()
        );
        data.features = featureStats;
      }

      // 获取地理分布
      if (requestedMetrics.includes('geography')) {
        const geoDistribution = await InfluxDBService.getGeographicDistribution(
          new Date(start).toISOString(),
          new Date(end).toISOString()
        );
        data.geography = geoDistribution;
      }

      // 添加新的聚合数据
      data.aggregated = historicalData;

      res.json({
        data,
        query: {
          start,
          end,
          granularity,
          metrics: requestedMetrics
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Historical data error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get historical data',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/performance - 获取性能指标（需要认证）
router.get('/performance',
  AuthMiddleware.verifyToken,
  rateLimiter.apiQuery(),
  async (req, res) => {
    try {
      const performanceMetrics = await realTimeStats.getPerformanceMetrics();
      
      res.json({
        success: true,
        data: performanceMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Performance metrics error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get performance metrics',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/traffic-trend - 获取流量趋势（需要认证）
router.get('/traffic-trend',
  AuthMiddleware.verifyToken,
  rateLimiter.apiQuery(),
  async (req, res) => {
    try {
      const { minutes = 30 } = req.query;
      const trend = await realTimeStats.getTrafficTrend(parseInt(minutes));
      
      res.json({
        success: true,
        data: trend,
        query: { minutes: parseInt(minutes) },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Traffic trend error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get traffic trend',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/session/:sessionId - 获取会话详情（需要认证）
router.get('/session/:sessionId',
  AuthMiddleware.verifyToken,
  rateLimiter.apiQuery(),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const sessionDetails = await realTimeStats.getSessionDetails(sessionId);
      
      if (!sessionDetails) {
        return res.status(404).json({
          error: {
            message: 'Session not found',
            status: 404
          }
        });
      }
      
      const activityTimeline = realTimeStats.getUserActivityTimeline(sessionId);
      
      res.json({
        success: true,
        data: {
          session: sessionDetails,
          timeline: activityTimeline
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Session details error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get session details',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/aggregated - 获取聚合数据（需要认证）
router.get('/aggregated',
  AuthMiddleware.verifyToken,
  rateLimiter.apiQuery(),
  async (req, res) => {
    try {
      const {
        start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end = new Date().toISOString(),
        granularity = 'hourly'
      } = req.query;

      const aggregatedData = await dataProcessor.getHistoricalStats(
        new Date(start),
        new Date(end),
        granularity
      );
      
      res.json({
        success: true,
        data: aggregatedData,
        query: {
          start,
          end,
          granularity
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Aggregated data error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get aggregated data',
          status: 500
        }
      });
    }
  }
);

// GET /api/analytics/health - 健康检查
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: DatabaseService.getHealth(),
        redis: RedisService.getHealth(),
        influxdb: await InfluxDBService.getHealth(),
        dataProcessor: dataProcessor.isProcessing,
        realTimeStats: realTimeStats.getOnlineUserCount() >= 0
      }
    };

    // 检查是否所有服务都正常
    const allHealthy = Object.values(health.services).every(service => 
      service === true || service.connected || service.status === 'pass'
    );

    if (!allHealthy) {
      health.status = 'degraded';
      res.status(503);
    }

    res.json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;