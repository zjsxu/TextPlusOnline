/**
 * 实时统计计算服务
 * Real-time Statistics Calculation Service
 */

const logger = require('../utils/logger');
const RedisService = require('./RedisService');
const InfluxDBService = require('./InfluxDBService');
const PrivacyService = require('./PrivacyService');

class RealTimeStatsService {
  constructor() {
    this.activeUsers = new Map(); // sessionId -> lastActivity
    this.currentSessions = new Map(); // sessionId -> sessionData
    this.recentEvents = [];
    this.maxRecentEvents = 100;
    this.userActivityTimeout = 300000; // 5分钟无活动视为离线
    
    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 处理新的事件数据
   */
  async processEvent(eventData) {
    try {
      // 隐私保护处理
      const sanitizedEvent = await PrivacyService.sanitizeEventData(eventData);
      
      // 更新活跃用户
      await this.updateActiveUsers(sanitizedEvent);
      
      // 更新会话信息
      await this.updateSessionInfo(sanitizedEvent);
      
      // 添加到最近事件列表
      this.addToRecentEvents(sanitizedEvent);
      
      // 更新实时指标
      await this.updateRealTimeMetrics(sanitizedEvent);
      
      // 地理位置统计
      await this.updateGeographicStats(sanitizedEvent);
      
      logger.debug(`Processed real-time event: ${sanitizedEvent.event}`);
    } catch (error) {
      logger.error('Error processing real-time event:', error);
      throw error;
    }
  }

  /**
   * 更新活跃用户
   */
  async updateActiveUsers(eventData) {
    const { sessionId, timestamp } = eventData;
    const now = new Date(timestamp);
    
    // 更新用户最后活动时间
    this.activeUsers.set(sessionId, now);
    
    // 更新Redis中的在线用户数
    const onlineCount = this.getOnlineUserCount();
    await RedisService.setex('online_users_count', 60, onlineCount.toString());
    
    // 存储活跃用户列表到Redis (用于集群环境)
    const activeUsersList = Array.from(this.activeUsers.keys());
    await RedisService.setex('active_users_list', 60, JSON.stringify(activeUsersList));
  }

  /**
   * 更新会话信息
   */
  async updateSessionInfo(eventData) {
    const { sessionId, timestamp, event, userAgent, country, city } = eventData;
    
    if (!this.currentSessions.has(sessionId)) {
      // 新会话
      this.currentSessions.set(sessionId, {
        sessionId,
        startTime: new Date(timestamp),
        lastActivity: new Date(timestamp),
        pageViews: 0,
        events: [],
        userAgent: userAgent || 'Unknown',
        country: country || 'Unknown',
        city: city || 'Unknown',
        referrer: eventData.referrer || 'Direct'
      });
    }
    
    const session = this.currentSessions.get(sessionId);
    session.lastActivity = new Date(timestamp);
    session.events.push({
      event,
      timestamp,
      details: eventData.details || {}
    });
    
    if (event === 'page_view') {
      session.pageViews++;
    }
    
    // 更新Redis中的会话信息
    await RedisService.setex(
      `session:${sessionId}`, 
      1800, // 30分钟过期
      JSON.stringify(session)
    );
  }

  /**
   * 添加到最近事件列表
   */
  addToRecentEvents(eventData) {
    this.recentEvents.unshift({
      ...eventData,
      processedAt: new Date()
    });
    
    // 保持最近事件列表大小
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxRecentEvents);
    }
  }

  /**
   * 更新实时指标
   */
  async updateRealTimeMetrics(eventData) {
    const { event, feature, timestamp } = eventData;
    const minute = new Date(timestamp).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    
    // 更新分钟级计数器
    const counters = [
      `events:${minute}`,
      `${event}:${minute}`
    ];
    
    if (event === 'feature_usage' && feature) {
      counters.push(`feature:${feature}:${minute}`);
    }
    
    // 批量更新Redis计数器
    const pipeline = RedisService.pipeline();
    for (const counter of counters) {
      pipeline.incr(counter);
      pipeline.expire(counter, 3600); // 1小时过期
    }
    await pipeline.exec();
  }

  /**
   * 更新地理位置统计
   */
  async updateGeographicStats(eventData) {
    const { country, city, sessionId } = eventData;
    
    if (country && country !== 'Unknown') {
      // 更新国家统计
      await RedisService.zincrby('geo:countries', 1, country);
      
      if (city && city !== 'Unknown') {
        // 更新城市统计
        await RedisService.zincrby(`geo:cities:${country}`, 1, city);
      }
      
      // 设置过期时间 (24小时)
      await RedisService.expire('geo:countries', 86400);
      await RedisService.expire(`geo:cities:${country}`, 86400);
    }
  }

  /**
   * 获取在线用户数量
   */
  getOnlineUserCount() {
    const now = Date.now();
    let onlineCount = 0;
    
    for (const [sessionId, lastActivity] of this.activeUsers.entries()) {
      if (now - lastActivity.getTime() <= this.userActivityTimeout) {
        onlineCount++;
      }
    }
    
    return onlineCount;
  }

  /**
   * 获取当前会话数量
   */
  getCurrentSessionCount() {
    return this.currentSessions.size;
  }

  /**
   * 获取实时统计数据
   */
  async getRealTimeStats() {
    try {
      const now = new Date();
      const currentMinute = now.toISOString().slice(0, 16);
      const lastMinute = new Date(now.getTime() - 60000).toISOString().slice(0, 16);
      
      // 获取当前分钟和上一分钟的事件数
      const [currentEvents, lastMinuteEvents] = await Promise.all([
        RedisService.get(`events:${currentMinute}`) || '0',
        RedisService.get(`events:${lastMinute}`) || '0'
      ]);
      
      // 获取地理分布数据
      const topCountries = await RedisService.zrevrange('geo:countries', 0, 9, 'WITHSCORES');
      const geographicData = this.parseZsetResult(topCountries);
      
      // 获取功能使用统计
      const featureUsage = await this.getRecentFeatureUsage();
      
      // 计算系统健康状态
      const systemHealth = await this.calculateSystemHealth();
      
      return {
        timestamp: now,
        onlineUsers: this.getOnlineUserCount(),
        currentSessions: this.getCurrentSessionCount(),
        eventsPerMinute: {
          current: parseInt(currentEvents),
          previous: parseInt(lastMinuteEvents)
        },
        recentEvents: this.recentEvents.slice(0, 10), // 最近10个事件
        geographicDistribution: geographicData,
        featureUsage: featureUsage,
        systemHealth: systemHealth
      };
    } catch (error) {
      logger.error('Error getting real-time stats:', error);
      throw error;
    }
  }

  /**
   * 获取最近功能使用情况
   */
  async getRecentFeatureUsage() {
    const now = new Date();
    const features = {};
    
    // 获取最近5分钟的功能使用数据
    for (let i = 0; i < 5; i++) {
      const minute = new Date(now.getTime() - i * 60000).toISOString().slice(0, 16);
      const keys = await RedisService.keys(`feature:*:${minute}`);
      
      for (const key of keys) {
        const feature = key.split(':')[1];
        const count = await RedisService.get(key) || '0';
        features[feature] = (features[feature] || 0) + parseInt(count);
      }
    }
    
    return features;
  }

  /**
   * 计算系统健康状态
   */
  async calculateSystemHealth() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 300000);
      
      // 检查错误率
      const errorCount = await this.getEventCountInRange('error', fiveMinutesAgo, now);
      const totalEvents = await this.getEventCountInRange('*', fiveMinutesAgo, now);
      const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;
      
      // 检查响应时间 (从最近事件中获取)
      const recentResponseTimes = this.recentEvents
        .filter(e => e.response_time)
        .map(e => e.response_time)
        .slice(0, 20);
      
      const avgResponseTime = recentResponseTimes.length > 0
        ? recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length
        : 0;
      
      // 计算健康分数
      let healthScore = 100;
      if (errorRate > 5) healthScore -= 30;
      else if (errorRate > 1) healthScore -= 10;
      
      if (avgResponseTime > 2000) healthScore -= 20;
      else if (avgResponseTime > 1000) healthScore -= 10;
      
      const status = healthScore >= 90 ? 'excellent' : 
                    healthScore >= 70 ? 'good' : 
                    healthScore >= 50 ? 'warning' : 'critical';
      
      return {
        status,
        score: healthScore,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        lastUpdated: now
      };
    } catch (error) {
      logger.error('Error calculating system health:', error);
      return {
        status: 'unknown',
        score: 0,
        errorRate: 0,
        avgResponseTime: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * 获取时间范围内的事件数量
   */
  async getEventCountInRange(eventType, startTime, endTime) {
    let count = 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    while (start <= end) {
      const minute = start.toISOString().slice(0, 16);
      const key = eventType === '*' ? `events:${minute}` : `${eventType}:${minute}`;
      const minuteCount = await RedisService.get(key) || '0';
      count += parseInt(minuteCount);
      start.setMinutes(start.getMinutes() + 1);
    }
    
    return count;
  }

  /**
   * 解析Redis ZSET结果
   */
  parseZsetResult(result) {
    const data = {};
    for (let i = 0; i < result.length; i += 2) {
      data[result[i]] = parseInt(result[i + 1]);
    }
    return data;
  }

  /**
   * 获取会话详情
   */
  async getSessionDetails(sessionId) {
    try {
      const sessionData = await RedisService.get(`session:${sessionId}`);
      if (sessionData) {
        return JSON.parse(sessionData);
      }
      
      // 如果Redis中没有，从内存中获取
      return this.currentSessions.get(sessionId) || null;
    } catch (error) {
      logger.error('Error getting session details:', error);
      return null;
    }
  }

  /**
   * 获取用户活动时间线
   */
  getUserActivityTimeline(sessionId) {
    const session = this.currentSessions.get(sessionId);
    if (!session) {
      return [];
    }
    
    return session.events.map(event => ({
      timestamp: event.timestamp,
      event: event.event,
      details: event.details
    }));
  }

  /**
   * 启动清理定时器
   */
  startCleanupTimer() {
    // 每5分钟清理一次过期的用户和会话
    setInterval(() => {
      this.cleanupExpiredData();
    }, 300000);
  }

  /**
   * 清理过期数据
   */
  cleanupExpiredData() {
    const now = Date.now();
    
    // 清理过期的活跃用户
    for (const [sessionId, lastActivity] of this.activeUsers.entries()) {
      if (now - lastActivity.getTime() > this.userActivityTimeout) {
        this.activeUsers.delete(sessionId);
      }
    }
    
    // 清理过期的会话 (30分钟无活动)
    for (const [sessionId, session] of this.currentSessions.entries()) {
      if (now - session.lastActivity.getTime() > 1800000) { // 30分钟
        this.currentSessions.delete(sessionId);
      }
    }
    
    // 清理过期的最近事件 (保留最近1小时)
    const oneHourAgo = now - 3600000;
    this.recentEvents = this.recentEvents.filter(event => 
      new Date(event.timestamp).getTime() > oneHourAgo
    );
    
    logger.debug(`Cleanup completed: ${this.activeUsers.size} active users, ${this.currentSessions.size} sessions`);
  }

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 300000);
      
      // 获取最近5分钟的响应时间数据
      const responseTimes = this.recentEvents
        .filter(e => e.response_time && new Date(e.timestamp) >= fiveMinutesAgo)
        .map(e => e.response_time);
      
      if (responseTimes.length === 0) {
        return {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          p95ResponseTime: 0,
          throughput: 0
        };
      }
      
      responseTimes.sort((a, b) => a - b);
      
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const min = responseTimes[0];
      const max = responseTimes[responseTimes.length - 1];
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p95 = responseTimes[p95Index];
      
      // 计算吞吐量 (每分钟请求数)
      const throughput = (responseTimes.length / 5) * 60; // 转换为每分钟
      
      return {
        avgResponseTime: Math.round(avg),
        minResponseTime: min,
        maxResponseTime: max,
        p95ResponseTime: p95,
        throughput: Math.round(throughput)
      };
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      return {
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        throughput: 0
      };
    }
  }

  /**
   * 获取流量趋势
   */
  async getTrafficTrend(minutes = 30) {
    try {
      const now = new Date();
      const trend = [];
      
      for (let i = minutes - 1; i >= 0; i--) {
        const minute = new Date(now.getTime() - i * 60000).toISOString().slice(0, 16);
        const events = await RedisService.get(`events:${minute}`) || '0';
        const pageViews = await RedisService.get(`page_view:${minute}`) || '0';
        
        trend.push({
          timestamp: minute,
          events: parseInt(events),
          pageViews: parseInt(pageViews)
        });
      }
      
      return trend;
    } catch (error) {
      logger.error('Error getting traffic trend:', error);
      return [];
    }
  }
}

module.exports = RealTimeStatsService;