/**
 * 数据处理和聚合引擎
 * Data Processing and Aggregation Engine
 */

const logger = require('../utils/logger');
const InfluxDBService = require('./InfluxDBService');
const DatabaseService = require('./DatabaseService');
const RedisService = require('./RedisService');

class DataProcessingService {
  constructor() {
    this.isProcessing = false;
    this.processingInterval = null;
    this.aggregationRules = new Map();
    
    this.initializeAggregationRules();
  }

  /**
   * 初始化聚合规则
   */
  initializeAggregationRules() {
    // 实时统计规则 (1分钟窗口)
    this.aggregationRules.set('realtime', {
      window: '1m',
      retention: '24h',
      metrics: ['page_views', 'active_users', 'feature_usage', 'errors']
    });

    // 小时级聚合规则
    this.aggregationRules.set('hourly', {
      window: '1h',
      retention: '30d',
      metrics: ['page_views', 'unique_visitors', 'session_duration', 'bounce_rate']
    });

    // 日级聚合规则
    this.aggregationRules.set('daily', {
      window: '1d',
      retention: '1y',
      metrics: ['page_views', 'unique_visitors', 'sessions', 'avg_session_duration']
    });

    // 周级聚合规则
    this.aggregationRules.set('weekly', {
      window: '1w',
      retention: '2y',
      metrics: ['page_views', 'unique_visitors', 'feature_popularity']
    });

    // 月级聚合规则
    this.aggregationRules.set('monthly', {
      window: '1mo',
      retention: '5y',
      metrics: ['page_views', 'unique_visitors', 'growth_metrics']
    });
  }

  /**
   * 启动数据处理引擎
   */
  async start() {
    if (this.isProcessing) {
      logger.warn('Data processing engine is already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting data processing engine...');

    // 启动实时处理 (每分钟)
    this.processingInterval = setInterval(async () => {
      try {
        await this.processRealTimeData();
      } catch (error) {
        logger.error('Error in real-time data processing:', error);
      }
    }, 60000); // 1分钟

    // 启动定时聚合任务
    this.scheduleAggregationTasks();

    logger.info('Data processing engine started successfully');
  }

  /**
   * 停止数据处理引擎
   */
  async stop() {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    logger.info('Data processing engine stopped');
  }

  /**
   * 处理实时数据
   */
  async processRealTimeData() {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);

      // 获取最近1分钟的原始事件数据
      const events = await this.getEventsInTimeRange(oneMinuteAgo, now);
      
      if (events.length === 0) {
        return;
      }

      // 计算实时指标
      const metrics = await this.calculateRealTimeMetrics(events);
      
      // 存储到Redis缓存
      await this.cacheRealTimeMetrics(metrics);
      
      // 存储到InfluxDB
      await this.storeAggregatedMetrics('realtime', metrics, now);

      logger.debug(`Processed ${events.length} events for real-time metrics`);
    } catch (error) {
      logger.error('Error processing real-time data:', error);
      throw error;
    }
  }

  /**
   * 计算实时指标
   */
  async calculateRealTimeMetrics(events) {
    const metrics = {
      timestamp: new Date(),
      page_views: 0,
      active_users: new Set(),
      feature_usage: {},
      errors: 0,
      sessions: new Set(),
      response_times: [],
      geographic_distribution: {}
    };

    for (const event of events) {
      // 页面访问统计
      if (event.event === 'page_view') {
        metrics.page_views++;
        metrics.active_users.add(event.sessionId);
        metrics.sessions.add(event.sessionId);
        
        // 地理位置统计 (基于匿名化IP)
        if (event.country) {
          metrics.geographic_distribution[event.country] = 
            (metrics.geographic_distribution[event.country] || 0) + 1;
        }
      }

      // 功能使用统计
      if (event.event === 'feature_usage') {
        const feature = event.feature;
        metrics.feature_usage[feature] = (metrics.feature_usage[feature] || 0) + 1;
        metrics.active_users.add(event.sessionId);
      }

      // 错误统计
      if (event.event === 'error') {
        metrics.errors++;
      }

      // 性能统计
      if (event.response_time) {
        metrics.response_times.push(event.response_time);
      }
    }

    // 转换Set为数量
    metrics.active_users = metrics.active_users.size;
    metrics.sessions = metrics.sessions.size;

    // 计算平均响应时间
    if (metrics.response_times.length > 0) {
      metrics.avg_response_time = metrics.response_times.reduce((a, b) => a + b, 0) / metrics.response_times.length;
    }

    return metrics;
  }

  /**
   * 缓存实时指标到Redis
   */
  async cacheRealTimeMetrics(metrics) {
    const key = 'realtime_metrics';
    const ttl = 300; // 5分钟过期

    await RedisService.setex(key, ttl, JSON.stringify({
      ...metrics,
      cached_at: new Date().toISOString()
    }));

    // 更新在线用户列表
    await RedisService.setex('online_users', 300, metrics.active_users.toString());
  }

  /**
   * 存储聚合指标到InfluxDB
   */
  async storeAggregatedMetrics(granularity, metrics, timestamp) {
    const points = [];

    // 基础指标
    points.push({
      measurement: `${granularity}_metrics`,
      tags: {
        granularity: granularity
      },
      fields: {
        page_views: metrics.page_views || 0,
        active_users: metrics.active_users || 0,
        sessions: metrics.sessions || 0,
        errors: metrics.errors || 0,
        avg_response_time: metrics.avg_response_time || 0
      },
      timestamp: timestamp
    });

    // 功能使用指标
    for (const [feature, count] of Object.entries(metrics.feature_usage || {})) {
      points.push({
        measurement: `${granularity}_feature_usage`,
        tags: {
          granularity: granularity,
          feature: feature
        },
        fields: {
          usage_count: count
        },
        timestamp: timestamp
      });
    }

    // 地理分布指标
    for (const [country, count] of Object.entries(metrics.geographic_distribution || {})) {
      points.push({
        measurement: `${granularity}_geographic`,
        tags: {
          granularity: granularity,
          country: country
        },
        fields: {
          visitor_count: count
        },
        timestamp: timestamp
      });
    }

    await InfluxDBService.writePoints(points);
  }

  /**
   * 调度聚合任务
   */
  scheduleAggregationTasks() {
    // 每小时聚合 (在每小时的第5分钟执行)
    this.scheduleTask('0 5 * * * *', () => this.performHourlyAggregation());
    
    // 每日聚合 (在每天的00:10执行)
    this.scheduleTask('0 10 0 * * *', () => this.performDailyAggregation());
    
    // 每周聚合 (在每周一的00:15执行)
    this.scheduleTask('0 15 0 * * 1', () => this.performWeeklyAggregation());
    
    // 每月聚合 (在每月1日的00:20执行)
    this.scheduleTask('0 20 0 1 * *', () => this.performMonthlyAggregation());
  }

  /**
   * 调度单个任务
   */
  scheduleTask(cronExpression, task) {
    // 这里使用简单的定时器实现，实际生产环境建议使用node-cron
    const interval = this.parseCronToInterval(cronExpression);
    if (interval) {
      setInterval(task, interval);
    }
  }

  /**
   * 执行小时级聚合
   */
  async performHourlyAggregation() {
    try {
      logger.info('Starting hourly aggregation...');
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      
      const events = await this.getEventsInTimeRange(oneHourAgo, now);
      const metrics = await this.calculateHourlyMetrics(events);
      
      await this.storeAggregatedMetrics('hourly', metrics, now);
      
      logger.info(`Hourly aggregation completed: ${events.length} events processed`);
    } catch (error) {
      logger.error('Error in hourly aggregation:', error);
    }
  }

  /**
   * 执行日级聚合
   */
  async performDailyAggregation() {
    try {
      logger.info('Starting daily aggregation...');
      
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 86400000);
      
      const events = await this.getEventsInTimeRange(oneDayAgo, now);
      const metrics = await this.calculateDailyMetrics(events);
      
      await this.storeAggregatedMetrics('daily', metrics, now);
      
      logger.info(`Daily aggregation completed: ${events.length} events processed`);
    } catch (error) {
      logger.error('Error in daily aggregation:', error);
    }
  }

  /**
   * 执行周级聚合
   */
  async performWeeklyAggregation() {
    try {
      logger.info('Starting weekly aggregation...');
      
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 604800000);
      
      const events = await this.getEventsInTimeRange(oneWeekAgo, now);
      const metrics = await this.calculateWeeklyMetrics(events);
      
      await this.storeAggregatedMetrics('weekly', metrics, now);
      
      logger.info(`Weekly aggregation completed: ${events.length} events processed`);
    } catch (error) {
      logger.error('Error in weekly aggregation:', error);
    }
  }

  /**
   * 执行月级聚合
   */
  async performMonthlyAggregation() {
    try {
      logger.info('Starting monthly aggregation...');
      
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 2592000000); // 30天
      
      const events = await this.getEventsInTimeRange(oneMonthAgo, now);
      const metrics = await this.calculateMonthlyMetrics(events);
      
      await this.storeAggregatedMetrics('monthly', metrics, now);
      
      logger.info(`Monthly aggregation completed: ${events.length} events processed`);
    } catch (error) {
      logger.error('Error in monthly aggregation:', error);
    }
  }

  /**
   * 计算小时级指标
   */
  async calculateHourlyMetrics(events) {
    const sessions = new Map();
    const uniqueVisitors = new Set();
    const pageViews = events.filter(e => e.event === 'page_view').length;
    
    // 计算会话相关指标
    for (const event of events) {
      if (event.sessionId) {
        if (!sessions.has(event.sessionId)) {
          sessions.set(event.sessionId, {
            startTime: new Date(event.timestamp),
            endTime: new Date(event.timestamp),
            pageViews: 0,
            events: []
          });
        }
        
        const session = sessions.get(event.sessionId);
        session.endTime = new Date(event.timestamp);
        session.events.push(event);
        
        if (event.event === 'page_view') {
          session.pageViews++;
          uniqueVisitors.add(event.sessionId);
        }
      }
    }

    // 计算平均会话时长
    let totalSessionDuration = 0;
    let validSessions = 0;
    
    for (const session of sessions.values()) {
      const duration = session.endTime.getTime() - session.startTime.getTime();
      if (duration > 0 && duration < 3600000) { // 小于1小时的有效会话
        totalSessionDuration += duration;
        validSessions++;
      }
    }

    const avgSessionDuration = validSessions > 0 ? totalSessionDuration / validSessions : 0;
    
    // 计算跳出率 (只有一个页面访问的会话)
    const bouncedSessions = Array.from(sessions.values()).filter(s => s.pageViews === 1).length;
    const bounceRate = sessions.size > 0 ? (bouncedSessions / sessions.size) * 100 : 0;

    return {
      page_views: pageViews,
      unique_visitors: uniqueVisitors.size,
      sessions: sessions.size,
      avg_session_duration: Math.round(avgSessionDuration / 1000), // 转换为秒
      bounce_rate: Math.round(bounceRate * 100) / 100 // 保留2位小数
    };
  }

  /**
   * 计算日级指标
   */
  async calculateDailyMetrics(events) {
    const hourlyMetrics = await this.calculateHourlyMetrics(events);
    
    // 添加日级特有指标
    const featureUsage = {};
    const deviceTypes = {};
    const browsers = {};
    
    for (const event of events) {
      // 功能使用统计
      if (event.event === 'feature_usage' && event.feature) {
        featureUsage[event.feature] = (featureUsage[event.feature] || 0) + 1;
      }
      
      // 设备类型统计
      if (event.userAgent) {
        const deviceType = this.detectDeviceType(event.userAgent);
        deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;
      }
      
      // 浏览器统计
      if (event.userAgent) {
        const browser = this.detectBrowser(event.userAgent);
        browsers[browser] = (browsers[browser] || 0) + 1;
      }
    }

    return {
      ...hourlyMetrics,
      feature_usage: featureUsage,
      device_types: deviceTypes,
      browsers: browsers
    };
  }

  /**
   * 计算周级指标
   */
  async calculateWeeklyMetrics(events) {
    const dailyMetrics = await this.calculateDailyMetrics(events);
    
    // 添加周级趋势分析
    const dailyBreakdown = this.groupEventsByDay(events);
    const growthMetrics = this.calculateGrowthMetrics(dailyBreakdown);
    
    return {
      ...dailyMetrics,
      daily_breakdown: dailyBreakdown,
      growth_metrics: growthMetrics
    };
  }

  /**
   * 计算月级指标
   */
  async calculateMonthlyMetrics(events) {
    const weeklyMetrics = await this.calculateWeeklyMetrics(events);
    
    // 添加月级汇总
    const weeklyBreakdown = this.groupEventsByWeek(events);
    const monthlyTrends = this.calculateMonthlyTrends(weeklyBreakdown);
    
    return {
      ...weeklyMetrics,
      weekly_breakdown: weeklyBreakdown,
      monthly_trends: monthlyTrends
    };
  }

  /**
   * 获取时间范围内的事件数据
   */
  async getEventsInTimeRange(startTime, endTime) {
    try {
      const query = `
        SELECT * FROM events 
        WHERE time >= '${startTime.toISOString()}' 
        AND time < '${endTime.toISOString()}'
        ORDER BY time ASC
      `;
      
      const result = await InfluxDBService.query(query);
      return result || [];
    } catch (error) {
      logger.error('Error querying events:', error);
      return [];
    }
  }

  /**
   * 检测设备类型
   */
  detectDeviceType(userAgent) {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    } else if (/Tablet/.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * 检测浏览器
   */
  detectBrowser(userAgent) {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  /**
   * 按天分组事件
   */
  groupEventsByDay(events) {
    const groups = {};
    
    for (const event of events) {
      const day = new Date(event.timestamp).toISOString().split('T')[0];
      if (!groups[day]) {
        groups[day] = [];
      }
      groups[day].push(event);
    }
    
    return groups;
  }

  /**
   * 按周分组事件
   */
  groupEventsByWeek(events) {
    const groups = {};
    
    for (const event of events) {
      const date = new Date(event.timestamp);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const week = weekStart.toISOString().split('T')[0];
      
      if (!groups[week]) {
        groups[week] = [];
      }
      groups[week].push(event);
    }
    
    return groups;
  }

  /**
   * 计算增长指标
   */
  calculateGrowthMetrics(dailyBreakdown) {
    const days = Object.keys(dailyBreakdown).sort();
    if (days.length < 2) {
      return { growth_rate: 0, trend: 'stable' };
    }
    
    const firstDay = dailyBreakdown[days[0]].length;
    const lastDay = dailyBreakdown[days[days.length - 1]].length;
    
    const growthRate = firstDay > 0 ? ((lastDay - firstDay) / firstDay) * 100 : 0;
    const trend = growthRate > 5 ? 'growing' : growthRate < -5 ? 'declining' : 'stable';
    
    return { growth_rate: Math.round(growthRate * 100) / 100, trend };
  }

  /**
   * 计算月度趋势
   */
  calculateMonthlyTrends(weeklyBreakdown) {
    const weeks = Object.keys(weeklyBreakdown).sort();
    const trends = {
      total_events: 0,
      weekly_average: 0,
      peak_week: null,
      low_week: null
    };
    
    let maxEvents = 0;
    let minEvents = Infinity;
    
    for (const week of weeks) {
      const eventCount = weeklyBreakdown[week].length;
      trends.total_events += eventCount;
      
      if (eventCount > maxEvents) {
        maxEvents = eventCount;
        trends.peak_week = week;
      }
      
      if (eventCount < minEvents) {
        minEvents = eventCount;
        trends.low_week = week;
      }
    }
    
    trends.weekly_average = weeks.length > 0 ? Math.round(trends.total_events / weeks.length) : 0;
    
    return trends;
  }

  /**
   * 简单的cron表达式解析 (仅用于演示)
   */
  parseCronToInterval(cronExpression) {
    // 这是一个简化的实现，实际应该使用专业的cron库
    if (cronExpression === '0 5 * * * *') return 3600000; // 每小时
    if (cronExpression === '0 10 0 * * *') return 86400000; // 每天
    if (cronExpression === '0 15 0 * * 1') return 604800000; // 每周
    if (cronExpression === '0 20 0 1 * *') return 2592000000; // 每月
    return null;
  }

  /**
   * 获取实时统计数据
   */
  async getRealTimeStats() {
    try {
      const cached = await RedisService.get('realtime_metrics');
      if (cached) {
        return JSON.parse(cached);
      }
      
      // 如果缓存不存在，计算当前数据
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const events = await this.getEventsInTimeRange(oneMinuteAgo, now);
      
      return await this.calculateRealTimeMetrics(events);
    } catch (error) {
      logger.error('Error getting real-time stats:', error);
      throw error;
    }
  }

  /**
   * 获取历史统计数据
   */
  async getHistoricalStats(startTime, endTime, granularity = 'hourly') {
    try {
      const measurement = `${granularity}_metrics`;
      const query = `
        SELECT * FROM ${measurement}
        WHERE time >= '${startTime.toISOString()}'
        AND time < '${endTime.toISOString()}'
        ORDER BY time ASC
      `;
      
      const result = await InfluxDBService.query(query);
      return result || [];
    } catch (error) {
      logger.error('Error getting historical stats:', error);
      throw error;
    }
  }
}

module.exports = DataProcessingService;