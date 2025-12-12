const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const config = require('../config/config');
const logger = require('../utils/logger');

class InfluxDBService {
  constructor() {
    this.client = null;
    this.writeApi = null;
    this.queryApi = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      // 创建InfluxDB客户端
      this.client = new InfluxDB({
        url: config.database.influxdb.url,
        token: config.database.influxdb.token,
        timeout: 30000
      });

      // 创建写入和查询API
      this.writeApi = this.client.getWriteApi(
        config.database.influxdb.org,
        config.database.influxdb.bucket,
        'ms' // 毫秒精度
      );

      this.queryApi = this.client.getQueryApi(config.database.influxdb.org);

      // 配置写入选项
      this.writeApi.useDefaultTags({
        application: 'textdiff-analytics',
        version: '1.0.0'
      });

      // 测试连接
      await this.testConnection();

      this.isConnected = true;
      logger.info('InfluxDB connected successfully');

      // 设置错误处理
      this.setupErrorHandling();

      return this.client;
    } catch (error) {
      logger.error('Failed to connect to InfluxDB:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const query = `
        from(bucket: "${config.database.influxdb.bucket}")
        |> range(start: -1m)
        |> limit(n: 1)
      `;
      
      await this.queryApi.collectRows(query);
      logger.info('InfluxDB connection test successful');
    } catch (error) {
      // 如果是因为没有数据而失败，这是正常的
      if (error.message.includes('no data')) {
        logger.info('InfluxDB connection test successful (no data)');
      } else {
        throw error;
      }
    }
  }

  setupErrorHandling() {
    this.writeApi.addEventListener('error', (error) => {
      logger.error('InfluxDB write error:', error);
    });

    this.writeApi.addEventListener('finish', () => {
      logger.debug('InfluxDB write batch finished');
    });
  }

  // 写入事件数据
  async writeEvent(measurement, tags, fields, timestamp = null) {
    try {
      const point = new Point(measurement);
      
      // 添加标签
      Object.entries(tags).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          point.tag(key, String(value));
        }
      });

      // 添加字段
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (typeof value === 'number') {
            if (Number.isInteger(value)) {
              point.intField(key, value);
            } else {
              point.floatField(key, value);
            }
          } else if (typeof value === 'boolean') {
            point.booleanField(key, value);
          } else {
            point.stringField(key, String(value));
          }
        }
      });

      // 设置时间戳
      if (timestamp) {
        point.timestamp(new Date(timestamp));
      } else {
        point.timestamp(new Date());
      }

      this.writeApi.writePoint(point);
      
      // 定期刷新缓冲区
      if (Math.random() < 0.1) { // 10%的概率立即刷新
        await this.writeApi.flush();
      }

      return true;
    } catch (error) {
      logger.error('InfluxDB write event error:', {
        measurement,
        tags,
        fields,
        error: error.message
      });
      return false;
    }
  }

  // 页面访问事件
  async writePageView(eventData) {
    return await this.writeEvent('page_views', {
      session_id: eventData.sessionId,
      url: eventData.url,
      referrer: eventData.referrer || 'direct',
      country: eventData.country || 'unknown',
      device_type: this.getDeviceType(eventData.userAgent)
    }, {
      duration: eventData.duration || 0,
      screen_width: eventData.screenWidth || 0,
      screen_height: eventData.screenHeight || 0
    }, eventData.timestamp);
  }

  // 功能使用事件
  async writeFeatureUsage(eventData) {
    return await this.writeEvent('feature_usage', {
      session_id: eventData.sessionId,
      feature: eventData.feature,
      action: eventData.action
    }, {
      duration: eventData.duration || 0,
      success: eventData.success !== false,
      ...eventData.parameters
    }, eventData.timestamp);
  }

  // 性能指标
  async writePerformanceMetric(metricData) {
    return await this.writeEvent('performance_metrics', {
      metric_name: metricData.name,
      endpoint: metricData.endpoint || 'unknown'
    }, {
      value: metricData.value,
      response_time: metricData.responseTime || 0,
      memory_usage: metricData.memoryUsage || 0,
      cpu_usage: metricData.cpuUsage || 0
    }, metricData.timestamp);
  }

  // 错误事件
  async writeError(errorData) {
    return await this.writeEvent('errors', {
      error_type: errorData.type || 'unknown',
      endpoint: errorData.endpoint || 'unknown',
      user_agent: errorData.userAgent || 'unknown'
    }, {
      message: errorData.message || '',
      stack_trace: errorData.stackTrace || '',
      session_id: errorData.sessionId || ''
    }, errorData.timestamp);
  }

  // 系统指标
  async writeSystemMetric(metricData) {
    return await this.writeEvent('system_metrics', {
      metric_type: metricData.type,
      host: metricData.host || 'unknown'
    }, {
      value: metricData.value,
      cpu_percent: metricData.cpuPercent || 0,
      memory_percent: metricData.memoryPercent || 0,
      disk_usage: metricData.diskUsage || 0
    }, metricData.timestamp);
  }

  // 查询方法
  async queryData(fluxQuery) {
    try {
      const rows = await this.queryApi.collectRows(fluxQuery);
      return rows;
    } catch (error) {
      logger.error('InfluxDB query error:', {
        query: fluxQuery.substring(0, 200),
        error: error.message
      });
      return [];
    }
  }

  // 获取实时统计
  async getRealTimeStats(timeWindowMinutes = 5) {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: -${timeWindowMinutes}m)
      |> filter(fn: (r) => r._measurement == "page_views")
      |> group(columns: ["session_id"])
      |> count()
      |> group()
      |> sum()
    `;

    try {
      const rows = await this.queryData(query);
      return rows.length > 0 ? rows[0]._value : 0;
    } catch (error) {
      logger.error('Error getting real-time stats:', error);
      return 0;
    }
  }

  // 获取页面访问趋势
  async getPageViewTrend(startTime, endTime, granularity = '1h') {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "page_views")
      |> aggregateWindow(every: ${granularity}, fn: count, createEmpty: false)
      |> yield(name: "page_views")
    `;

    return await this.queryData(query);
  }

  // 获取功能使用统计
  async getFeatureUsageStats(startTime, endTime) {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "feature_usage")
      |> group(columns: ["feature"])
      |> count()
      |> sort(columns: ["_value"], desc: true)
    `;

    return await this.queryData(query);
  }

  // 获取地理分布
  async getGeographicDistribution(startTime, endTime) {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "page_views")
      |> group(columns: ["country"])
      |> count()
      |> sort(columns: ["_value"], desc: true)
    `;

    return await this.queryData(query);
  }

  // 获取性能指标
  async getPerformanceMetrics(startTime, endTime, metricName = null) {
    let filter = 'r._measurement == "performance_metrics"';
    if (metricName) {
      filter += ` and r.metric_name == "${metricName}"`;
    }

    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => ${filter})
      |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
    `;

    return await this.queryData(query);
  }

  // 获取错误率
  async getErrorRate(startTime, endTime, granularity = '1h') {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "errors")
      |> aggregateWindow(every: ${granularity}, fn: count, createEmpty: false)
    `;

    return await this.queryData(query);
  }

  // 获取用户会话分析
  async getSessionAnalysis(startTime, endTime) {
    const query = `
      sessions = from(bucket: "${config.database.influxdb.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "page_views")
        |> group(columns: ["session_id"])
        |> count()
        |> rename(columns: {_value: "page_count"})
      
      durations = from(bucket: "${config.database.influxdb.bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "page_views")
        |> group(columns: ["session_id"])
        |> sum(column: "duration")
        |> rename(columns: {_value: "total_duration"})
      
      join(tables: {sessions: sessions, durations: durations}, on: ["session_id"])
    `;

    return await this.queryData(query);
  }

  // 获取热门页面
  async getTopPages(startTime, endTime, limit = 10) {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "page_views")
      |> group(columns: ["url"])
      |> count()
      |> sort(columns: ["_value"], desc: true)
      |> limit(n: ${limit})
    `;

    return await this.queryData(query);
  }

  // 获取设备类型分布
  async getDeviceTypeDistribution(startTime, endTime) {
    const query = `
      from(bucket: "${config.database.influxdb.bucket}")
      |> range(start: ${startTime}, stop: ${endTime})
      |> filter(fn: (r) => r._measurement == "page_views")
      |> group(columns: ["device_type"])
      |> count()
    `;

    return await this.queryData(query);
  }

  // 辅助方法：从User-Agent判断设备类型
  getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  // 批量写入
  async writeBatch(points) {
    try {
      this.writeApi.writePoints(points);
      await this.writeApi.flush();
      return true;
    } catch (error) {
      logger.error('InfluxDB batch write error:', error);
      return false;
    }
  }

  // 强制刷新写入缓冲区
  async flush() {
    try {
      await this.writeApi.flush();
      return true;
    } catch (error) {
      logger.error('InfluxDB flush error:', error);
      return false;
    }
  }

  // 数据清理
  async deleteOldData(measurement, olderThanDays) {
    try {
      const deleteApi = this.client.getDeleteAPI();
      const start = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const stop = new Date();

      await deleteApi.postDelete({
        org: config.database.influxdb.org,
        bucket: config.database.influxdb.bucket,
        body: {
          start: start.toISOString(),
          stop: stop.toISOString(),
          predicate: `_measurement="${measurement}"`
        }
      });

      logger.info(`Deleted old ${measurement} data older than ${olderThanDays} days`);
      return true;
    } catch (error) {
      logger.error('InfluxDB delete error:', error);
      return false;
    }
  }

  // 健康检查
  async ping() {
    try {
      const health = await this.client.ping();
      return health.status === 'pass';
    } catch (error) {
      logger.error('InfluxDB ping error:', error);
      return false;
    }
  }

  async getHealth() {
    try {
      const health = await this.client.health();
      return {
        connected: this.isConnected,
        status: health.status,
        message: health.message,
        version: health.version
      };
    } catch (error) {
      return {
        connected: false,
        status: 'fail',
        message: error.message,
        version: 'unknown'
      };
    }
  }

  async close() {
    try {
      if (this.writeApi) {
        await this.writeApi.close();
      }
      this.isConnected = false;
      logger.info('InfluxDB connection closed');
    } catch (error) {
      logger.error('Error closing InfluxDB connection:', error);
    }
  }
}

// 创建单例实例
const influxDBService = new InfluxDBService();

module.exports = influxDBService;