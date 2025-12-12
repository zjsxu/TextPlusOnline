const rateLimit = require('express-rate-limit');
const RedisService = require('../services/RedisService');
const config = require('../config/config');
const logger = require('../utils/logger');

// 基础限流中间件
const basicRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: {
      message: 'Too many requests, please try again later',
      status: 429,
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    
    res.status(429).json({
      error: {
        message: 'Too many requests, please try again later',
        status: 429,
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
      }
    });
  }
});

// 严格限流（用于认证端点）
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: {
    error: {
      message: 'Too many authentication attempts, please try again later',
      status: 429,
      retryAfter: 900 // 15分钟
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Strict rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    
    res.status(429).json({
      error: {
        message: 'Too many authentication attempts, please try again later',
        status: 429,
        retryAfter: 900
      }
    });
  }
});

// 自定义Redis限流中间件
class RedisRateLimiter {
  static create(options = {}) {
    const {
      windowMs = 15 * 60 * 1000,
      max = 100,
      keyGenerator = (req) => req.ip,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = options;

    return async (req, res, next) => {
      try {
        const key = `rate_limit:${keyGenerator(req)}`;
        const windowSeconds = Math.ceil(windowMs / 1000);
        
        const result = await RedisService.checkRateLimit(key, max, windowSeconds);
        
        // 设置响应头
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': Math.max(0, max - result.current),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
        });

        if (!result.allowed) {
          logger.security('Redis rate limit exceeded', {
            ip: req.ip,
            key,
            current: result.current,
            limit: max
          });

          return res.status(429).json({
            error: {
              message: 'Too many requests, please try again later',
              status: 429,
              retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
            }
          });
        }

        // 如果需要跳过成功/失败请求的计数，在响应后处理
        if (skipSuccessfulRequests || skipFailedRequests) {
          const originalSend = res.send;
          res.send = function(data) {
            const shouldSkip = 
              (skipSuccessfulRequests && res.statusCode < 400) ||
              (skipFailedRequests && res.statusCode >= 400);
            
            if (shouldSkip) {
              RedisService.incrementCounter(key, -1);
            }
            
            return originalSend.call(this, data);
          };
        }

        next();
      } catch (error) {
        logger.error('Rate limiter error:', error);
        // 如果Redis出错，允许请求通过
        next();
      }
    };
  }

  // 数据收集端点的限流
  static dataCollection() {
    return this.create({
      windowMs: 1 * 60 * 1000, // 1分钟
      max: 60, // 每分钟60次
      keyGenerator: (req) => {
        // 使用sessionId作为key，如果没有则使用IP
        const sessionId = req.body?.sessionId || req.query?.sessionId;
        return sessionId ? `session:${sessionId}` : `ip:${req.ip}`;
      },
      skipSuccessfulRequests: false,
      skipFailedRequests: true
    });
  }

  // 认证端点的限流
  static authentication() {
    return this.create({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 5, // 最多5次尝试
      keyGenerator: (req) => `auth:${req.ip}`,
      skipSuccessfulRequests: true,
      skipFailedRequests: false
    });
  }

  // API查询端点的限流
  static apiQuery() {
    return this.create({
      windowMs: 1 * 60 * 1000, // 1分钟
      max: 30, // 每分钟30次查询
      keyGenerator: (req) => {
        const userId = req.user?.id;
        return userId ? `user:${userId}` : `ip:${req.ip}`;
      }
    });
  }

  // 报告生成的限流
  static reportGeneration() {
    return this.create({
      windowMs: 60 * 60 * 1000, // 1小时
      max: 10, // 每小时最多10个报告
      keyGenerator: (req) => {
        const userId = req.user?.id;
        return `reports:${userId || req.ip}`;
      }
    });
  }
}

module.exports = {
  basic: basicRateLimit,
  strict: strictRateLimit,
  redis: RedisRateLimiter
};