#!/usr/bin/env node

/**
 * 简化测试脚本 - 不依赖外部数据库
 */

const express = require('express');
const cors = require('cors');

// 创建简单的测试服务器
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 真实数据存储
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
    version: '1.0.0-test'
  });
});

// 服务信息
app.get('/', (req, res) => {
  res.json({
    name: 'TextDiff+ Analytics API (Test Mode)',
    version: '1.0.0-test',
    status: 'running',
    endpoints: {
      health: '/health',
      analytics: '/api/analytics'
    }
  });
});

// 真实分析API
app.post('/api/analytics/events/page-view', (req, res) => {
  const event = {
    ...req.body,
    timestamp: new Date().toISOString(),
    type: 'page_view'
  };
  events.push(event);
  
  // 更新活跃会话
  updateActiveSession(event.sessionId);
  
  console.log('📈 Page view recorded:', event.sessionId);
  
  res.status(201).json({
    success: true,
    message: 'Page view recorded',
    sessionId: event.sessionId
  });
});

app.post('/api/analytics/events/feature-usage', (req, res) => {
  const event = {
    ...req.body,
    timestamp: new Date().toISOString(),
    type: 'feature_usage'
  };
  events.push(event);
  
  // 更新活跃会话
  updateActiveSession(event.sessionId);
  
  console.log('🎯 Feature usage recorded:', event.feature);
  
  res.status(201).json({
    success: true,
    message: 'Feature usage recorded'
  });
});

app.post('/api/analytics/events/session', (req, res) => {
  const event = {
    ...req.body,
    timestamp: new Date().toISOString(),
    type: 'session'
  };
  events.push(event);
  
  // 更新活跃会话
  if (event.sessionId) {
    if (event.eventType === 'end') {
      // 会话结束，从活跃列表中移除
      activeSessions.delete(event.sessionId);
    } else {
      updateActiveSession(event.sessionId);
    }
  }
  
  console.log('👤 Session event recorded:', event.eventType);
  
  res.status(201).json({
    success: true,
    message: 'Session event recorded'
  });
});

app.post('/api/analytics/events/batch', (req, res) => {
  const { events: batchEvents } = req.body;
  
  if (!Array.isArray(batchEvents)) {
    return res.status(400).json({
      error: 'Events must be an array'
    });
  }
  
  const processed = batchEvents.map(event => ({
    ...event,
    timestamp: new Date().toISOString(),
    processed: true
  }));
  
  events.push(...processed);
  
  // 更新活跃会话 (从批量事件中提取sessionId)
  processed.forEach(event => {
    // 尝试从多个位置提取sessionId
    const sessionId = event.data?.sessionId || event.sessionId || 
                     (event.data?.data && event.data.data.sessionId);
    if (sessionId) {
      updateActiveSession(sessionId);
      console.log('📊 Updated session from batch:', sessionId);
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
});

// 真实实时统计
app.get('/api/analytics/real-time', (req, res) => {
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
  
  // 计算地理分布 (基于真实用户数据)
  const geographicDistribution = {};
  recentEvents.forEach(event => {
    if (event.country) {
      geographicDistribution[event.country] = (geographicDistribution[event.country] || 0) + 1;
    }
  });
  
  const stats = {
    timestamp: now.toISOString(),
    onlineUsers: activeSessions.size, // 真实的在线用户数
    currentSessions: activeSessions.size,
    eventsPerMinute: {
      current: lastMinuteEvents.length,
      previous: 0 // 暂时设为0，需要历史数据才能计算
    },
    recentEvents: events.slice(-10),
    featureUsage: featureUsage,
    geographicDistribution: geographicDistribution,
    systemHealth: {
      status: 'excellent',
      score: 98,
      errorRate: 0,
      avgResponseTime: 45
    }
  };
  
  res.json({
    success: true,
    data: stats
  });
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

// 定期清理过期会话
setInterval(cleanupExpiredSessions, 60000); // 每分钟清理一次

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`🚀 Test Analytics API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Real-time stats: http://localhost:${PORT}/api/analytics/real-time`);
  console.log('');
  console.log('Ready for testing! 🎉');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Shutting down test server...');
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down test server...');
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});

module.exports = app;