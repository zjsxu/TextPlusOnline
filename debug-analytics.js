#!/usr/bin/env node

/**
 * Analytics System 完整诊断脚本
 * 检查前端到后台的完整数据流
 */

// 使用Node.js 18+内置的fetch，如果不支持则使用简单的http请求
const fetch = globalThis.fetch || require('node-fetch');

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:8080';

console.log('🔍 开始 Analytics System 完整诊断...\n');

// 测试数据
const testSessionId = 'diagnostic_' + Date.now();
const testEvents = {
  pageView: {
    sessionId: testSessionId,
    url: 'http://localhost:8080/test',
    referrer: 'http://google.com',
    userAgent: 'Diagnostic/1.0',
    screenResolution: '1920x1080',
    language: 'zh-CN',
    timestamp: new Date().toISOString()
  },
  featureUsage: {
    sessionId: testSessionId,
    feature: 'diagnostic_test',
    action: 'test_action',
    parameters: { test: true },
    duration: 1000,
    timestamp: new Date().toISOString()
  },
  sessionEnd: {
    sessionId: testSessionId,
    eventType: 'end',
    data: { sessionDuration: 5000, eventsCount: 2 },
    timestamp: new Date().toISOString()
  }
};

async function testAPI(method, endpoint, data = null) {
  try {
    console.log(`🧪 测试 ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
      console.log(`📤 发送数据:`, JSON.stringify(data, null, 2));
    }
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ 成功: ${response.status}`);
      console.log(`📥 响应:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ 失败: ${response.status}`);
      console.log(`📥 错误:`, JSON.stringify(result, null, 2));
    }
    
    console.log(''); // 空行分隔
    return { success: response.ok, data: result };
  } catch (error) {
    console.log(`💥 异常: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function checkRealTimeStats() {
  console.log('📊 检查实时统计数据...');
  const result = await testAPI('GET', '/api/analytics/real-time');
  
  if (result.success && result.data.data) {
    const stats = result.data.data;
    console.log('📈 当前统计:');
    console.log(`   在线用户: ${stats.onlineUsers}`);
    console.log(`   当前会话: ${stats.currentSessions}`);
    console.log(`   最近事件数: ${stats.recentEvents?.length || 0}`);
    console.log(`   功能使用: ${JSON.stringify(stats.featureUsage || {})}`);
    console.log(`   地理分布: ${JSON.stringify(stats.geographicDistribution || {})}`);
    console.log('');
    
    return stats;
  }
  
  return null;
}

async function runDiagnostics() {
  console.log('='.repeat(60));
  console.log('🏥 ANALYTICS SYSTEM 健康检查');
  console.log('='.repeat(60));
  
  // 1. 检查后台服务健康状态
  console.log('1️⃣ 检查后台服务健康状态');
  await testAPI('GET', '/health');
  
  // 2. 检查初始统计状态
  console.log('2️⃣ 检查初始统计状态');
  const initialStats = await checkRealTimeStats();
  
  // 3. 测试页面访问事件
  console.log('3️⃣ 测试页面访问事件');
  await testAPI('POST', '/api/analytics/events/page-view', testEvents.pageView);
  
  // 4. 测试功能使用事件
  console.log('4️⃣ 测试功能使用事件');
  await testAPI('POST', '/api/analytics/events/feature-usage', testEvents.featureUsage);
  
  // 5. 测试会话事件
  console.log('5️⃣ 测试会话事件');
  await testAPI('POST', '/api/analytics/events/session', testEvents.sessionEnd);
  
  // 6. 测试批量事件
  console.log('6️⃣ 测试批量事件');
  const batchEvents = {
    events: [
      { type: 'page_view', data: testEvents.pageView },
      { type: 'feature_usage', data: testEvents.featureUsage }
    ]
  };
  await testAPI('POST', '/api/analytics/events/batch', batchEvents);
  
  // 7. 检查最终统计状态
  console.log('7️⃣ 检查最终统计状态');
  const finalStats = await checkRealTimeStats();
  
  // 8. 数据对比分析
  console.log('8️⃣ 数据变化分析');
  if (initialStats && finalStats) {
    console.log('📊 数据变化对比:');
    console.log(`   在线用户: ${initialStats.onlineUsers} → ${finalStats.onlineUsers}`);
    console.log(`   事件数量: ${initialStats.recentEvents?.length || 0} → ${finalStats.recentEvents?.length || 0}`);
    
    const initialFeatures = Object.keys(initialStats.featureUsage || {}).length;
    const finalFeatures = Object.keys(finalStats.featureUsage || {}).length;
    console.log(`   功能使用类型: ${initialFeatures} → ${finalFeatures}`);
    
    if (finalFeatures > initialFeatures) {
      console.log('✅ 功能使用统计正常更新');
    } else {
      console.log('⚠️ 功能使用统计可能有问题');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 前端集成测试建议');
  console.log('='.repeat(60));
  
  console.log('1. 在浏览器中访问: http://localhost:8080/test-frontend.html');
  console.log('2. 点击"Configure Backend"配置后台地址');
  console.log('3. 点击各种测试按钮发送事件');
  console.log('4. 观察管理员仪表板的数据变化');
  console.log('');
  
  console.log('🔧 调试命令:');
  console.log('   查看实时数据: curl -s http://localhost:3001/api/analytics/real-time | jq');
  console.log('   查看最近事件: curl -s http://localhost:3001/api/analytics/real-time | jq ".data.recentEvents"');
  console.log('   查看功能使用: curl -s http://localhost:3001/api/analytics/real-time | jq ".data.featureUsage"');
  console.log('');
  
  console.log('✅ 诊断完成！');
}

// 运行诊断
if (require.main === module) {
  runDiagnostics().catch(error => {
    console.error('💥 诊断失败:', error);
    process.exit(1);
  });
}

module.exports = { runDiagnostics, testAPI, checkRealTimeStats };