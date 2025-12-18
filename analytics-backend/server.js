#!/usr/bin/env node

/**
 * TextDiff+ Analytics Backend Server
 * 生产环境服务器 - 用于云端部署
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: false, // 允许跨域请求
    crossOriginEmbedderPolicy: false
}));

// CORS配置 - 允许GitHub Pages和其他域名访问
app.use(cors({
    origin: [
        'https://zjsxu.github.io',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        /^https:\/\/.*\.github\.io$/,  // 允许所有GitHub Pages域名
        /^https:\/\/.*\.netlify\.app$/,  // 允许Netlify部署
        /^https:\/\/.*\.vercel\.app$/   // 允许Vercel部署
    ],
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// 基础中间件
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use(morgan('combined'));

// 数据存储 (生产环境应使用数据库)
let events = [];
let sessions = new Map();
let activeSessions = new Map(); // sessionId -> lastActivity
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10分钟无活动视为离线

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0-production',
        environment: process.env.NODE_ENV || 'production'
    });
});

// 根路径
app.get('/', (req, res) => {
    res.json({
        name: 'TextDiff+ Analytics API',
        version: '1.0.0-production',
        status: 'running',
        endpoints: {
            health: '/health',
            analytics: '/api/analytics',
            'real-time': '/api/analytics/real-time'
        },
        cors: {
            allowedOrigins: [
                'https://zjsxu.github.io',
                'http://localhost:8080'
            ]
        }
    });
});

// 页面访问事件
app.post('/api/analytics/events/page-view', (req, res) => {
    try {
        const event = {
            ...req.body,
            timestamp: new Date().toISOString(),
            type: 'page_view',
            ip: req.ip || req.connection.remoteAddress
        };
        
        events.push(event);
        updateActiveSession(event.sessionId);
        
        console.log('📈 Page view recorded:', event.sessionId, event.url);
        
        res.status(201).json({
            success: true,
            message: 'Page view recorded',
            sessionId: event.sessionId
        });
    } catch (error) {
        console.error('Error recording page view:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// 功能使用事件
app.post('/api/analytics/events/feature-usage', (req, res) => {
    try {
        const event = {
            ...req.body,
            timestamp: new Date().toISOString(),
            type: 'feature_usage',
            ip: req.ip || req.connection.remoteAddress
        };
        
        events.push(event);
        updateActiveSession(event.sessionId);
        
        console.log('🎯 Feature usage recorded:', event.feature, event.sessionId);
        
        res.status(201).json({
            success: true,
            message: 'Feature usage recorded'
        });
    } catch (error) {
        console.error('Error recording feature usage:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// 会话事件
app.post('/api/analytics/events/session', (req, res) => {
    try {
        const event = {
            ...req.body,
            timestamp: new Date().toISOString(),
            type: 'session',
            ip: req.ip || req.connection.remoteAddress
        };
        
        events.push(event);
        
        if (event.sessionId) {
            if (event.eventType === 'end') {
                activeSessions.delete(event.sessionId);
            } else {
                updateActiveSession(event.sessionId);
            }
        }
        
        console.log('👤 Session event recorded:', event.eventType, event.sessionId);
        
        res.status(201).json({
            success: true,
            message: 'Session event recorded'
        });
    } catch (error) {
        console.error('Error recording session event:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// 批量事件处理
app.post('/api/analytics/events/batch', (req, res) => {
    try {
        const { events: batchEvents } = req.body;
        
        if (!Array.isArray(batchEvents)) {
            return res.status(400).json({
                success: false,
                error: 'Events must be an array'
            });
        }
        
        const processed = batchEvents.map(event => ({
            ...event,
            timestamp: new Date().toISOString(),
            processed: true,
            ip: req.ip || req.connection.remoteAddress
        }));
        
        events.push(...processed);
        
        // 更新活跃会话
        processed.forEach(event => {
            const sessionId = event.data?.sessionId || event.sessionId || 
                             (event.data?.data && event.data.data.sessionId);
            if (sessionId) {
                updateActiveSession(sessionId);
            }
        });
        
        console.log('📦 Batch events recorded:', processed.length);
        
        res.status(201).json({
            success: true,
            message: 'Batch events processed',
            summary: {
                total: batchEvents.length,
                successful: processed.length,
                failed: 0
            }
        });
    } catch (error) {
        console.error('Error processing batch events:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// 实时统计查询
app.get('/api/analytics/real-time', (req, res) => {
    try {
        const now = new Date();
        
        // 清理过期会话
        cleanupExpiredSessions();
        
        // 计算最近5分钟的事件
        const recentEvents = events.filter(e => 
            new Date(e.timestamp) > new Date(now.getTime() - 5 * 60 * 1000)
        );
        
        // 计算最近1分钟的事件
        const lastMinuteEvents = events.filter(e => 
            new Date(e.timestamp) > new Date(now.getTime() - 60 * 1000)
        );
        
        // 计算功能使用统计
        const featureUsage = {};
        recentEvents.forEach(event => {
            if (event.feature) {
                featureUsage[event.feature] = (featureUsage[event.feature] || 0) + 1;
            }
        });
        
        // 计算地理分布 (基于语言偏好)
        const geographicDistribution = {};
        recentEvents.forEach(event => {
            if (event.language) {
                const region = getRegionFromLanguage(event.language);
                geographicDistribution[region] = (geographicDistribution[region] || 0) + 1;
            }
        });
        
        const stats = {
            timestamp: now.toISOString(),
            onlineUsers: activeSessions.size,
            currentSessions: activeSessions.size,
            eventsPerMinute: {
                current: lastMinuteEvents.length,
                previous: 0
            },
            recentEvents: events.slice(-20), // 最近20个事件
            featureUsage: featureUsage,
            geographicDistribution: geographicDistribution,
            systemHealth: {
                status: 'excellent',
                score: 98,
                errorRate: 0,
                avgResponseTime: 45
            },
            totalEvents: events.length
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting real-time stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// 辅助函数
function updateActiveSession(sessionId) {
    if (sessionId) {
        activeSessions.set(sessionId, new Date());
    }
}

function cleanupExpiredSessions() {
    const now = new Date();
    for (const [sessionId, lastActivity] of activeSessions.entries()) {
        if (now.getTime() - lastActivity.getTime() > SESSION_TIMEOUT) {
            activeSessions.delete(sessionId);
        }
    }
}

function getRegionFromLanguage(language) {
    const langMap = {
        'zh-CN': 'China',
        'zh-TW': 'Taiwan',
        'en-US': 'United States',
        'en-GB': 'United Kingdom',
        'ja-JP': 'Japan',
        'ko-KR': 'South Korea',
        'fr-FR': 'France',
        'de-DE': 'Germany',
        'es-ES': 'Spain'
    };
    
    return langMap[language] || 'Other';
}

// 定期清理过期会话
setInterval(cleanupExpiredSessions, 60000); // 每分钟清理一次

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});

// 错误处理
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 启动服务器
const server = app.listen(PORT, () => {
    console.log(`🚀 TextDiff+ Analytics API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`🌐 CORS enabled for GitHub Pages`);
    console.log(`📈 Health check: http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
});

module.exports = app;