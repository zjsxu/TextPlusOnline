const Redis = require('redis');
const config = require('../config/config');
const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // 创建主客户端
      this.client = Redis.createClient({
        url: config.database.redis.url,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // 创建发布订阅客户端
      this.subscriber = this.client.duplicate();
      this.publisher = this.client.duplicate();

      // 连接所有客户端
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      this.isConnected = true;
      logger.info('Redis connected successfully');

      // 设置事件监听
      this.setupEventListeners();

      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  setupEventListeners() {
    // 主客户端事件
    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('end', () => {
      logger.info('Redis client connection ended');
      this.isConnected = false;
    });

    // 订阅客户端事件
    this.subscriber.on('error', (err) => {
      logger.error('Redis subscriber error:', err);
    });

    this.publisher.on('error', (err) => {
      logger.error('Redis publisher error:', err);
    });
  }

  // 基础操作方法
  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, expireSeconds = null) {
    try {
      const serialized = JSON.stringify(value);
      if (expireSeconds) {
        await this.client.setEx(key, expireSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error:', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error: error.message });
      return false;
    }
  }

  async expire(key, seconds) {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, seconds, error: error.message });
      return false;
    }
  }

  // 哈希操作
  async hget(key, field) {
    try {
      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis HGET error:', { key, field, error: error.message });
      return null;
    }
  }

  async hset(key, field, value) {
    try {
      const serialized = JSON.stringify(value);
      await this.client.hSet(key, field, serialized);
      return true;
    } catch (error) {
      logger.error('Redis HSET error:', { key, field, error: error.message });
      return false;
    }
  }

  async hgetall(key) {
    try {
      const hash = await this.client.hGetAll(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      return result;
    } catch (error) {
      logger.error('Redis HGETALL error:', { key, error: error.message });
      return {};
    }
  }

  async hdel(key, field) {
    try {
      const result = await this.client.hDel(key, field);
      return result > 0;
    } catch (error) {
      logger.error('Redis HDEL error:', { key, field, error: error.message });
      return false;
    }
  }

  // 列表操作
  async lpush(key, ...values) {
    try {
      const serialized = values.map(v => JSON.stringify(v));
      const result = await this.client.lPush(key, serialized);
      return result;
    } catch (error) {
      logger.error('Redis LPUSH error:', { key, error: error.message });
      return 0;
    }
  }

  async rpop(key) {
    try {
      const value = await this.client.rPop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis RPOP error:', { key, error: error.message });
      return null;
    }
  }

  async llen(key) {
    try {
      return await this.client.lLen(key);
    } catch (error) {
      logger.error('Redis LLEN error:', { key, error: error.message });
      return 0;
    }
  }

  async lrange(key, start, stop) {
    try {
      const values = await this.client.lRange(key, start, stop);
      return values.map(v => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    } catch (error) {
      logger.error('Redis LRANGE error:', { key, start, stop, error: error.message });
      return [];
    }
  }

  // 集合操作
  async sadd(key, ...members) {
    try {
      const serialized = members.map(m => JSON.stringify(m));
      return await this.client.sAdd(key, serialized);
    } catch (error) {
      logger.error('Redis SADD error:', { key, error: error.message });
      return 0;
    }
  }

  async smembers(key) {
    try {
      const members = await this.client.sMembers(key);
      return members.map(m => {
        try {
          return JSON.parse(m);
        } catch {
          return m;
        }
      });
    } catch (error) {
      logger.error('Redis SMEMBERS error:', { key, error: error.message });
      return [];
    }
  }

  async srem(key, member) {
    try {
      const serialized = JSON.stringify(member);
      return await this.client.sRem(key, serialized);
    } catch (error) {
      logger.error('Redis SREM error:', { key, error: error.message });
      return 0;
    }
  }

  // 有序集合操作
  async zadd(key, score, member) {
    try {
      const serialized = JSON.stringify(member);
      return await this.client.zAdd(key, { score, value: serialized });
    } catch (error) {
      logger.error('Redis ZADD error:', { key, score, error: error.message });
      return 0;
    }
  }

  async zrange(key, start, stop, withScores = false) {
    try {
      const options = withScores ? { REV: false, WITHSCORES: true } : {};
      const result = await this.client.zRange(key, start, stop, options);
      
      if (withScores) {
        const parsed = [];
        for (let i = 0; i < result.length; i += 2) {
          try {
            parsed.push({
              member: JSON.parse(result[i]),
              score: parseFloat(result[i + 1])
            });
          } catch {
            parsed.push({
              member: result[i],
              score: parseFloat(result[i + 1])
            });
          }
        }
        return parsed;
      } else {
        return result.map(r => {
          try {
            return JSON.parse(r);
          } catch {
            return r;
          }
        });
      }
    } catch (error) {
      logger.error('Redis ZRANGE error:', { key, start, stop, error: error.message });
      return [];
    }
  }

  // 发布订阅
  async publish(channel, message) {
    try {
      const serialized = JSON.stringify(message);
      const result = await this.publisher.publish(channel, serialized);
      return result;
    } catch (error) {
      logger.error('Redis PUBLISH error:', { channel, error: error.message });
      return 0;
    }
  }

  async subscribe(channel, callback) {
    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch {
          callback(message);
        }
      });
      logger.info(`Subscribed to Redis channel: ${channel}`);
    } catch (error) {
      logger.error('Redis SUBSCRIBE error:', { channel, error: error.message });
    }
  }

  async unsubscribe(channel) {
    try {
      await this.subscriber.unsubscribe(channel);
      logger.info(`Unsubscribed from Redis channel: ${channel}`);
    } catch (error) {
      logger.error('Redis UNSUBSCRIBE error:', { channel, error: error.message });
    }
  }

  // 缓存相关方法
  async cacheSet(key, value, ttlSeconds = 3600) {
    return await this.set(`cache:${key}`, value, ttlSeconds);
  }

  async cacheGet(key) {
    return await this.get(`cache:${key}`);
  }

  async cacheDel(key) {
    return await this.del(`cache:${key}`);
  }

  // 会话管理
  async setSession(sessionId, sessionData, ttlSeconds = 1800) {
    return await this.set(`session:${sessionId}`, sessionData, ttlSeconds);
  }

  async getSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId) {
    return await this.del(`session:${sessionId}`);
  }

  async extendSession(sessionId, ttlSeconds = 1800) {
    return await this.expire(`session:${sessionId}`, ttlSeconds);
  }

  // 实时统计
  async incrementCounter(key, amount = 1) {
    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      logger.error('Redis INCRBY error:', { key, amount, error: error.message });
      return 0;
    }
  }

  async getCounter(key) {
    try {
      const value = await this.client.get(key);
      return value ? parseInt(value) : 0;
    } catch (error) {
      logger.error('Redis counter GET error:', { key, error: error.message });
      return 0;
    }
  }

  async resetCounter(key) {
    return await this.del(key);
  }

  // 限流
  async checkRateLimit(key, limit, windowSeconds) {
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return {
        allowed: current <= limit,
        current,
        limit,
        resetTime: Date.now() + (windowSeconds * 1000)
      };
    } catch (error) {
      logger.error('Redis rate limit error:', { key, error: error.message });
      return { allowed: true, current: 0, limit, resetTime: Date.now() };
    }
  }

  // 队列操作
  async enqueue(queueName, job) {
    const jobData = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: job,
      createdAt: new Date().toISOString(),
      attempts: 0
    };
    
    return await this.lpush(`queue:${queueName}`, jobData);
  }

  async dequeue(queueName) {
    return await this.rpop(`queue:${queueName}`);
  }

  async getQueueLength(queueName) {
    return await this.llen(`queue:${queueName}`);
  }

  // 健康检查
  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis PING error:', error);
      return false;
    }
  }

  async getInfo() {
    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      logger.error('Redis INFO error:', error);
      return null;
    }
  }

  getHealth() {
    return {
      connected: this.isConnected,
      ready: this.client?.isReady || false
    };
  }

  async close() {
    try {
      if (this.client) await this.client.quit();
      if (this.subscriber) await this.subscriber.quit();
      if (this.publisher) await this.publisher.quit();
      
      this.isConnected = false;
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections:', error);
    }
  }
}

// 创建单例实例
const redisService = new RedisService();

module.exports = redisService;