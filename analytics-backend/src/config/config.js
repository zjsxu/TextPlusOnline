require('dotenv').config();

const config = {
  // 环境配置
  env: process.env.NODE_ENV || 'development',
  
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0'
  },

  // 数据库配置
  database: {
    postgres: {
      url: process.env.POSTGRES_URL || 'postgresql://analytics:password@localhost:5432/analytics_db',
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000
      }
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    },
    influxdb: {
      url: process.env.INFLUXDB_URL || 'http://localhost:8086',
      token: process.env.INFLUXDB_TOKEN || 'analytics-token',
      org: process.env.INFLUXDB_ORG || 'textdiff',
      bucket: process.env.INFLUXDB_BUCKET || 'analytics'
    }
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://zjsxu.github.io'
  },

  // 限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // 邮件配置
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: process.env.EMAIL_FROM || 'noreply@textdiff.com'
  },

  // 短信配置
  sms: {
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    provider: process.env.SMS_PROVIDER || 'twilio'
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: true,
      filename: 'logs/analytics.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }
  },

  // 监控配置
  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    healthCheckInterval: 30000 // 30秒
  },

  // 报警配置
  alerts: {
    emailRecipients: process.env.ALERT_EMAIL_RECIPIENTS ? 
      process.env.ALERT_EMAIL_RECIPIENTS.split(',') : ['admin@example.com'],
    smsRecipients: process.env.ALERT_SMS_RECIPIENTS ? 
      process.env.ALERT_SMS_RECIPIENTS.split(',') : [],
    cooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES) || 15
  },

  // 文件存储配置
  storage: {
    type: process.env.STORAGE_TYPE || 'local', // 'local' or 's3'
    local: {
      reportsPath: 'reports/',
      maxFileSize: 50 * 1024 * 1024 // 50MB
    },
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || 'textdiff-analytics-reports'
    }
  },

  // 数据保留配置
  dataRetention: {
    sessionDays: parseInt(process.env.SESSION_RETENTION_DAYS) || 90,
    eventDays: parseInt(process.env.EVENT_RETENTION_DAYS) || 365,
    reportDays: parseInt(process.env.REPORT_RETENTION_DAYS) || 30
  },

  // 实时数据配置
  realTime: {
    updateIntervalMs: 5000, // 5秒更新间隔
    maxConcurrentConnections: 1000,
    sessionTimeoutMs: 30 * 60 * 1000 // 30分钟会话超时
  },

  // 安全配置
  security: {
    bcryptRounds: 10,
    maxLoginAttempts: 5,
    lockoutTimeMinutes: 15,
    passwordMinLength: 8
  }
};

// 验证必需的环境变量
const requiredEnvVars = [
  'POSTGRES_URL',
  'REDIS_URL',
  'INFLUXDB_URL',
  'INFLUXDB_TOKEN',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  if (config.env === 'production') {
    process.exit(1);
  }
}

module.exports = config;