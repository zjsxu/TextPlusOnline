#!/usr/bin/env node

/**
 * Analytics Backend Test Script
 * 测试后台分析服务的基本功能
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.ANALYTICS_URL || 'http://localhost:3001';

// 测试数据
const testData = {
  pageView: {
    sessionId: 'test_session_' + Date.now(),
    url: 'https://test.com/page1',
    referrer: 'https://google.com',
    userAgent: 'Mozilla/5.0 (Test Browser)',
    screenResolution: '1920x1080',
    language: 'zh-CN',
    timestamp: new Date().toISOString()
  },
  
  featureUsage: {
    sessionId: 'test_session_' + Date.now(),
    feature: 'text_comparison',
    action: 'compare',
    parameters: {
      textALength: 1000,
      textBLength: 1200,
      diffCount: 50
    },
    duration: 2500,
    timestamp: new Date().toISOString()
  }
};

async function testEndpoint(method, endpoint, data = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
      console.log(`📄 Response:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Failed: ${response.status}`);
      console.log(`📄 Error:`, JSON.stringify(result, null, 2));
    }
    
    return { success: response.ok, data: result };
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Analytics Backend Tests');
  console.log(`🔗 Base URL: ${BASE_URL}`);
  
  const results = [];
  
  // 1. 健康检查
  results.push(await testEndpoint('GET', '/api/analytics/health'));
  
  // 2. 测试页面访问事件收集
  results.push(await testEndpoint('POST', '/api/analytics/events/page-view', testData.pageView));
  
  // 3. 测试功能使用事件收集
  results.push(await testEndpoint('POST', '/api/analytics/events/feature-usage', testData.featureUsage));
  
  // 4. 测试会话事件
  results.push(await testEndpoint('POST', '/api/analytics/events/session', {
    sessionId: testData.pageView.sessionId,
    eventType: 'heartbeat',
    data: {},
    timestamp: new Date().toISOString()
  }));
  
  // 5. 测试批量事件
  results.push(await testEndpoint('POST', '/api/analytics/events/batch', {
    events: [
      {
        type: 'page_view',
        data: testData.pageView
      },
      {
        type: 'feature_usage',
        data: testData.featureUsage
      }
    ]
  }));
  
  // 等待数据处理
  console.log('\n⏳ Waiting for data processing...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 6. 测试实时统计 (需要认证，可能会失败)
  results.push(await testEndpoint('GET', '/api/analytics/real-time'));
  
  // 7. 测试历史数据 (需要认证，可能会失败)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString();
  results.push(await testEndpoint('GET', `/api/analytics/historical?start=${yesterday}&end=${today}`));
  
  // 汇总结果
  console.log('\n📊 Test Results Summary:');
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Successful: ${successful}/${total}`);
  console.log(`❌ Failed: ${total - successful}/${total}`);
  
  if (successful === total) {
    console.log('\n🎉 All tests passed! Backend is working correctly.');
  } else if (successful >= total - 2) {
    console.log('\n⚠️  Most tests passed. Authentication-required endpoints may need admin token.');
  } else {
    console.log('\n🚨 Multiple tests failed. Please check backend configuration.');
  }
  
  return successful === total;
}

// 运行测试
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testEndpoint };