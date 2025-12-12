const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// 创建日志目录
const fs = require('fs');
const logDir = path.dirname(config.logging.file.filename);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'analytics-api' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// 文件日志（仅在启用时）
if (config.logging.file.enabled) {
  logger.add(new winston.transports.File({
    filename: config.logging.file.filename,
    maxsize: config.logging.file.maxsize,
    maxFiles: config.logging.file.maxFiles,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));

  // 错误日志单独文件
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: config.logging.file.maxsize,
    maxFiles: config.logging.file.maxFiles,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

// 生产环境不输出debug日志到控制台
if (config.env === 'production') {
  logger.transports[0].level = 'info';
}

// 添加自定义方法
logger.analytics = (event, data = {}) => {
  logger.info('Analytics Event', {
    event,
    data,
    timestamp: new Date().toISOString()
  });
};

logger.security = (event, data = {}) => {
  logger.warn('Security Event', {
    event,
    data,
    timestamp: new Date().toISOString()
  });
};

logger.performance = (operation, duration, data = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration,
    data,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;