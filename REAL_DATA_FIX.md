# 🔧 真实数据修复说明

## 问题描述

之前的测试版本使用了**模拟数据**，在线用户数显示的是1-10之间的随机数，而不是真实的用户统计。

## 修复内容

### ✅ 已修复的问题

1. **在线用户数现在是真实的**
   - 之前: `Math.floor(Math.random() * 10) + 1` (随机数1-10)
   - 现在: `activeSessions.size` (真实活跃会话数)

2. **会话管理系统**
   - 新增活跃会话跟踪: `activeSessions` Map
   - 5分钟无活动自动清理过期会话
   - 每分钟自动清理一次过期数据

3. **真实事件统计**
   - 页面访问、功能使用、会话事件都会更新活跃用户
   - 批量事件处理也会正确更新用户状态
   - 会话结束事件会从活跃列表中移除用户

## 🧪 验证方法

### 1. 检查初始状态 (应该是0)
```bash
curl -s http://localhost:3001/api/analytics/real-time | jq '.data.onlineUsers'
# 输出: 0
```

### 2. 发送测试事件
```bash
curl -X POST http://localhost:3001/api/analytics/events/page-view \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session_123",
    "url": "http://localhost:8080/",
    "userAgent": "test",
    "screenResolution": "1920x1080",
    "language": "zh-CN"
  }'
```

### 3. 再次检查 (应该是1)
```bash
curl -s http://localhost:3001/api/analytics/real-time | jq '.data.onlineUsers'
# 输出: 1
```

### 4. 等待5分钟后检查 (应该自动变回0)
```bash
# 5分钟后
curl -s http://localhost:3001/api/analytics/real-time | jq '.data.onlineUsers'
# 输出: 0 (自动清理过期会话)
```

## 📊 现在的数据含义

### 真实数据指标:
- ✅ **在线用户数**: 最近5分钟内有活动的真实用户数
- ✅ **当前会话数**: 活跃会话的真实数量
- ✅ **每分钟事件数**: 最近1分钟收到的真实事件数
- ✅ **最近事件**: 真实的用户行为事件列表
- ✅ **功能使用统计**: 基于真实事件的功能使用次数

### 仍然是模拟的数据:
- ⚠️ **系统健康评分**: 固定为98分 (可以后续改为真实计算)
- ⚠️ **平均响应时间**: 固定为45ms (可以后续改为真实测量)
- ⚠️ **错误率**: 固定为0% (可以后续改为真实统计)

## 🔄 会话生命周期

1. **会话开始**: 用户发送第一个事件时创建会话
2. **会话活跃**: 每次用户操作都会更新最后活动时间
3. **会话过期**: 5分钟无活动自动从活跃列表移除
4. **会话结束**: 收到session end事件时立即移除

## 🎯 TextDiff+网站集成

当你在TextDiff+网站中配置后台连接后:

1. **页面访问**: 每次访问页面都会发送page-view事件
2. **功能使用**: 使用文本对比、文件上传等功能会发送feature-usage事件
3. **会话管理**: 页面关闭时会发送session end事件
4. **批量发送**: 每30秒自动批量发送累积的事件

## 📱 实际使用场景

### 场景1: 只有你在使用
- 在线用户数: 1
- 当前会话数: 1
- 功能使用: 显示你使用的具体功能

### 场景2: 多人同时使用
- 在线用户数: 实际用户数 (如3人)
- 当前会话数: 3
- 功能使用: 所有用户的功能使用汇总

### 场景3: 无人使用
- 在线用户数: 0
- 当前会话数: 0
- 功能使用: 空或显示历史数据

## 🔍 调试技巧

### 查看详细统计信息:
```bash
curl -s http://localhost:3001/api/analytics/real-time | jq '{
  onlineUsers: .data.onlineUsers,
  currentSessions: .data.currentSessions,
  recentEventsCount: (.data.recentEvents | length),
  featureUsage: .data.featureUsage,
  timestamp: .data.timestamp
}'
```

### 查看最近事件:
```bash
curl -s http://localhost:3001/api/analytics/real-time | jq '.data.recentEvents[]'
```

### 发送测试会话结束事件:
```bash
curl -X POST http://localhost:3001/api/analytics/events/session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session_123",
    "eventType": "end",
    "data": {}
  }'
```

## ✅ 修复验证

现在的系统会显示**真实的用户数据**:
- 没有用户时显示0
- 有用户活动时显示实际数量
- 5分钟无活动自动清理
- 所有统计都基于真实事件

这样你就可以准确地监控TextDiff+网站的真实使用情况了！