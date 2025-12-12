const RedisService = require('./RedisService');
const DatabaseService = require('./DatabaseService');
const InfluxDBService = require('./InfluxDBService');
const logger = require('../utils/logger');

class RealTimeService {
  constructor(io) {
    this.io = io;
    this.updateInterval = 5000; // 5秒更新间隔
    this.isRunning = false;
    this.connectedClients = new Set();
    
    this.setupEventHandlers();
    this.startRealTimeUpdates();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Real-time client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // 客户端加入管理员房间
      socket.on('join-admin', (data) => {
        socket.join('admin-dashboard');
        logger.info(`Admin client joined dashboard: ${socket.id}`);
        
        // 立即发送当前统计数据
        this.sendCurrentStats(socket);
      });

      // 客户端请求特定数据
      socket.on('request-data', async (request) => {
        try {
          const data = await this.handleDataRequest(request);
          socket.emit('data-response', {
            requestId: request.id,
            data
          });
        } catch (error) {
          logger.error('Real-time data request error:', error);
          socket.emit('data-error', {
            requestId: request.id,
            error: error.message
          });
        }
      });

      // 客户端断开连接
      socket.on('disconnect', () => {
        logger.info(`Real-time client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // 错误处理
      socket.on('error', (error) => {
        logger.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }

  async sendCurrentStats(socket = null) {
    try {
      const stats = await this.getCurrentStats();
      
      if (socket) {
        // 发送给特定客户端
        socket.emit('real-time-stats', stats);
      } else {
        // 广播给所有管理员
        this.io.to('admin-dashboard').emit('real-time-stats', stats);
      }
    } catch (error) {
      logger.error('Send current stats error:', error);
    }
  }

  async getCurrentStats() {
    try {
      // 获取在线用户数
      const activeSessions = await RedisService.smembers('active_sessions');
      const onlineUsers = activeSessions.length;

      // 获取今日统计
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayStats = await DatabaseService.query(`
        SELECT 
          COUNT(*) as sessions_today,
          COUNT(DISTINCT anonymized_ip) as unique_visitors_today
        FROM user_sessions
        WHERE start_time >= $1
      `, [today]);

      // 获取最近1小时的页面访问数
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentPageViews = await DatabaseService.query(`
        SELECT COUNT(*) as recent_views
        FROM user_sessions
        WHERE start_time >= $1
      `, [oneHourAgo]);

      // 获取热门功能
      const popularFeatures = await RedisService.zrange('popular_features', 0, 4, true);

      // 获取最近的事件
      const recentEvents = await this.getRecentEvents(10);

      // 系统健康状态
      const systemHealth = {
        database: DatabaseService.getHealth(),
        redis: RedisService.getHealth(),
        influxdb: await InfluxDBService.getHealth()
      };

      // 性能指标
      const performanceMetrics = {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage()
      };

      return {
        timestamp: new Date().toISOString(),
        onlineUsers,
        sessionsToday: parseInt(todayStats.rows[0]?.sessions_today || 0),
        uniqueVisitorsToday: parseInt(todayStats.rows[0]?.unique_visitors_today || 0),
        recentPageViews: parseInt(recentPageViews.rows[0]?.recent_views || 0),
        popularFeatures: popularFeatures.map(f => ({
          feature: f.member,
          count: f.score
        })),
        recentEvents,
        systemHealth,
        performance: performanceMetrics
      };
    } catch (error) {
      logger.error('Get current stats error:', error);
      throw error;
    }
  }

  async getRecentEvents(limit = 10) {
    try {
      // 从Redis获取最近的事件
      const events = await RedisService.lrange('recent_events', 0, limit - 1);
      return events.reverse(); // 最新的在前面
    } catch (error) {
      logger.error('Get recent events error:', error);
      return [];
    }
  }

  async handleDataRequest(request) {
    const { type, parameters = {} } = request;

    switch (type) {
      case 'page_views_trend':
        return await this.getPageViewsTrend(parameters);
      
      case 'feature_usage_stats':
        return await this.getFeatureUsageStats(parameters);
      
      case 'geographic_distribution':
        return await this.getGeographicDistribution(parameters);
      
      case 'session_analysis':
        return await this.getSessionAnalysis(parameters);
      
      case 'error_rate':
        return await this.getErrorRate(parameters);
      
      default:
        throw new Error(`Unknown data request type: ${type}`);
    }
  }

  async getPageViewsTrend(parameters) {
    const {
      timeRange = '24h',
      granularity = '1h'
    } = parameters;

    const endTime = new Date();
    const startTime = new Date();

    // 设置时间范围
    switch (timeRange) {
      case '1h':
        startTime.setHours(startTime.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(startTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(startTime.getDate() - 30);
        break;
    }

    return await InfluxDBService.getPageViewTrend(
      startTime.toISOString(),
      endTime.toISOString(),
      granularity
    );
  }

  async getFeatureUsageStats(parameters) {
    const {
      timeRange = '24h'
    } = parameters;

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - (timeRange === '7d' ? 7 : 1));

    return await InfluxDBService.getFeatureUsageStats(
      startTime.toISOString(),
      endTime.toISOString()
    );
  }

  async getGeographicDistribution(parameters) {
    const {
      timeRange = '24h'
    } = parameters;

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - (timeRange === '7d' ? 7 : 1));

    return await DatabaseService.getGeographicDistribution(
      startTime.toISOString(),
      endTime.toISOString()
    );
  }

  async getSessionAnalysis(parameters) {
    const {
      timeRange = '24h'
    } = parameters;

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - (timeRange === '7d' ? 7 : 1));

    return await InfluxDBService.getSessionAnalysis(
      startTime.toISOString(),
      endTime.toISOString()
    );
  }

  async getErrorRate(parameters) {
    const {
      timeRange = '24h',
      granularity = '1h'
    } = parameters;

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - (timeRange === '7d' ? 7 : 1));

    return await InfluxDBService.getErrorRate(
      startTime.toISOString(),
      endTime.toISOString(),
      granularity
    );
  }

  // 记录实时事件
  async recordEvent(eventType, eventData) {
    try {
      const event = {
        type: eventType,
        data: eventData,
        timestamp: new Date().toISOString()
      };

      // 添加到Redis列表
      await RedisService.lpush('recent_events', event);
      
      // 保持最近100个事件
      const listLength = await RedisService.llen('recent_events');
      if (listLength > 100) {
        await RedisService.rpop('recent_events');
      }

      // 广播事件给所有连接的管理员
      this.io.to('admin-dashboard').emit('new-event', event);

      logger.analytics('real_time_event', {
        eventType,
        connectedClients: this.connectedClients.size
      });

    } catch (error) {
      logger.error('Record real-time event error:', error);
    }
  }

  // 发送系统通知
  async sendNotification(notification) {
    try {
      const notificationData = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        timestamp: new Date().toISOString(),
        persistent: notification.persistent || false
      };

      // 广播通知
      this.io.to('admin-dashboard').emit('notification', notificationData);

      // 如果是持久通知，存储到Redis
      if (notificationData.persistent) {
        await RedisService.lpush('persistent_notifications', notificationData);
        
        // 保持最近50个持久通知
        const listLength = await RedisService.llen('persistent_notifications');
        if (listLength > 50) {
          await RedisService.rpop('persistent_notifications');
        }
      }

      logger.analytics('notification_sent', {
        notificationType: notificationData.type,
        persistent: notificationData.persistent,
        connectedClients: this.connectedClients.size
      });

    } catch (error) {
      logger.error('Send notification error:', error);
    }
  }

  // 获取持久通知
  async getPersistentNotifications(limit = 20) {
    try {
      return await RedisService.lrange('persistent_notifications', 0, limit - 1);
    } catch (error) {
      logger.error('Get persistent notifications error:', error);
      return [];
    }
  }

  // 启动实时更新
  startRealTimeUpdates() {
    if (this.isRunning) return;

    this.isRunning = true;
    
    const updateLoop = async () => {
      try {
        if (this.connectedClients.size > 0) {
          await this.sendCurrentStats();
        }
      } catch (error) {
        logger.error('Real-time update error:', error);
      }

      if (this.isRunning) {
        setTimeout(updateLoop, this.updateInterval);
      }
    };

    updateLoop();
    logger.info('Real-time updates started');
  }

  // 停止实时更新
  stopRealTimeUpdates() {
    this.isRunning = false;
    logger.info('Real-time updates stopped');
  }

  // 获取连接统计
  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      adminRoomSize: this.io.sockets.adapter.rooms.get('admin-dashboard')?.size || 0,
      isRunning: this.isRunning,
      updateInterval: this.updateInterval
    };
  }

  // 设置更新间隔
  setUpdateInterval(intervalMs) {
    if (intervalMs >= 1000 && intervalMs <= 60000) {
      this.updateInterval = intervalMs;
      logger.info(`Real-time update interval set to ${intervalMs}ms`);
    } else {
      throw new Error('Update interval must be between 1000ms and 60000ms');
    }
  }

  // 广播自定义消息
  broadcastMessage(channel, message) {
    try {
      this.io.to(channel).emit('custom-message', {
        timestamp: new Date().toISOString(),
        message
      });

      logger.analytics('custom_message_broadcast', {
        channel,
        connectedClients: this.connectedClients.size
      });

    } catch (error) {
      logger.error('Broadcast message error:', error);
    }
  }

  // 清理资源
  cleanup() {
    this.stopRealTimeUpdates();
    this.connectedClients.clear();
    logger.info('Real-time service cleaned up');
  }
}

module.exports = RealTimeService;