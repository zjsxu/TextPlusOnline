const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

// 导入配置和中间件
const config = require('./config/config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// 导入路由
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
const alertsRoutes = require('./routes/alerts');

// 导入服务
const DatabaseService = require('./services/DatabaseService');
const RedisService = require('./services/RedisService');
const InfluxDBService = require('./services/InfluxDBService');
const RealTimeService = require('./services/RealTimeService');

class AnalyticsApp {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST']
      }
    });
    
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupRealTime();
  }

  async initializeServices() {
    try {
      // 初始化数据库连接
      await DatabaseService.initialize();
      await RedisService.initialize();
      await InfluxDBService.initialize();
      
      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      process.exit(1);
    }
  }

  setupMiddleware() {
    // 安全中间件
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS配置
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // 基础中间件
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 日志中间件
    this.app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));

    // 限流中间件
    this.app.use('/api/', rateLimiter);

    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });
  }

  setupRoutes() {
    // API路由
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/reports', reportsRoutes);
    this.app.use('/api/alerts', alertsRoutes);

    // 根路径
    this.app.get('/', (req, res) => {
      res.json({
        name: 'TextDiff+ Analytics API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          analytics: '/api/analytics',
          admin: '/api/admin',
          reports: '/api/reports',
          alerts: '/api/alerts',
          health: '/health'
        }
      });
    });

    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler);

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // 优雅关闭
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  setupRealTime() {
    // 初始化实时服务
    this.realTimeService = new RealTimeService(this.io);
    
    // WebSocket连接处理
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      
      socket.on('join-admin', (data) => {
        socket.join('admin-dashboard');
        logger.info(`Admin joined dashboard: ${socket.id}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    
    try {
      // 关闭服务器
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // 关闭数据库连接
      await DatabaseService.close();
      await RedisService.close();
      await InfluxDBService.close();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  start() {
    const port = config.server.port;
    this.server.listen(port, () => {
      logger.info(`Analytics API server running on port ${port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`CORS origin: ${config.cors.origin}`);
    });
  }
}

// 启动应用
if (require.main === module) {
  const app = new AnalyticsApp();
  app.start();
}

module.exports = AnalyticsApp;