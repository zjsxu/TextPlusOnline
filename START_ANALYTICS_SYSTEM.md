# 🚀 TextDiff+ Analytics System 启动指南

## 快速启动 (推荐新手)

### 1. 启动简化版后台服务

```bash
# 进入后台目录
cd analytics-backend

# 启动简化测试服务器 (不需要数据库)
node test-simple.js
```

看到这个输出表示启动成功：
```
🚀 Test Analytics API running on port 3001
📊 Health check: http://localhost:3001/health
📈 Real-time stats: http://localhost:3001/api/analytics/real-time
Ready for testing! 🎉
```

### 2. 配置TextDiff+网站连接后台

1. 打开你的TextDiff+网站 (https://zjsxu.github.io/TextPlusOnline/)
2. 滚动到页面底部，找到统计区域
3. 点击 **"配置后台服务 | Configure Backend"** 按钮
4. 输入后台URL: `http://localhost:3001/api/analytics`
5. 输入批量间隔: `30` (秒)
6. 点击确定

### 3. 测试连接

1. 点击 **"测试连接 | Test Connection"** 按钮
2. 如果看到"测试事件已发送"，说明连接成功
3. 点击 **"显示统计摘要 | Show Analytics Summary"** 查看状态

## 完整版启动 (需要数据库)

### 1. 启动数据库服务

```bash
cd analytics-backend

# 启动所有数据库服务 (PostgreSQL, InfluxDB, Redis)
docker-compose up -d

# 等待服务启动 (约1-2分钟)
docker-compose ps
```

### 2. 启动完整后台服务

```bash
# 安装依赖 (首次运行)
npm install

# 启动开发服务器
npm run dev
```

## 📊 查看用户数据的方法

### 方法1: 直接访问API (实时查看)

```bash
# 查看实时统计
curl http://localhost:3001/api/analytics/real-time | jq

# 查看健康状态
curl http://localhost:3001/health

# 查看最近24小时数据
curl "http://localhost:3001/api/analytics/historical?start=$(date -d '1 day ago' -Iseconds)&end=$(date -Iseconds)" | jq
```

### 方法2: 使用浏览器查看JSON数据

直接在浏览器中访问：
- **实时统计**: http://localhost:3001/api/analytics/real-time
- **健康检查**: http://localhost:3001/health
- **服务信息**: http://localhost:3001/

### 方法3: 使用测试页面 (推荐)

1. 启动本地HTTP服务器：
```bash
python3 -m http.server 8080
```

2. 访问测试页面：http://localhost:8080/test-frontend.html

3. 在测试页面中：
   - 配置后台连接
   - 发送测试事件
   - 查看实时数据

## 🔍 数据查看详解

### 实时统计数据包含：

```json
{
  "timestamp": "2025-12-12T03:10:52.888Z",
  "onlineUsers": 5,                    // 当前在线用户数
  "currentSessions": 3,                // 当前活跃会话数
  "eventsPerMinute": {
    "current": 15,                     // 当前分钟事件数
    "previous": 12                     // 上一分钟事件数
  },
  "recentEvents": [...],               // 最近10个事件
  "geographicDistribution": {          // 地理分布
    "CN": 8,
    "US": 2
  },
  "featureUsage": {                    // 功能使用统计
    "text_comparison": 5,
    "file_upload": 3,
    "dictionary_usage": 2
  },
  "systemHealth": {                    // 系统健康状态
    "status": "excellent",
    "score": 95,
    "errorRate": 0,
    "avgResponseTime": 69
  }
}
```

### 历史数据查询：

```bash
# 查看今天的数据
curl "http://localhost:3001/api/analytics/historical?start=$(date -d 'today' -Iseconds)&end=$(date -Iseconds)&granularity=hourly"

# 查看最近7天的数据
curl "http://localhost:3001/api/analytics/historical?start=$(date -d '7 days ago' -Iseconds)&end=$(date -Iseconds)&granularity=daily"

# 查看功能使用排行
curl "http://localhost:3001/api/analytics/features?limit=10"

# 查看地理分布
curl "http://localhost:3001/api/analytics/geographic"
```

## 📱 移动端查看

如果你想在手机上查看数据：

1. 确保手机和电脑在同一WiFi网络
2. 找到电脑的IP地址：
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr "IPv4"
```
3. 在手机浏览器访问：`http://你的IP地址:3001/api/analytics/real-time`

## 🛠 故障排除

### 问题1: 后台服务启动失败
```bash
# 检查端口是否被占用
lsof -i :3001

# 杀死占用端口的进程
kill -9 <PID>
```

### 问题2: 前端连接失败
- 检查后台服务是否运行：`curl http://localhost:3001/health`
- 检查CORS设置是否正确
- 确认URL配置正确

### 问题3: 没有数据显示
- 确保网站有用户访问
- 检查前端是否正确配置后台URL
- 查看浏览器控制台是否有错误

## 📈 数据监控建议

### 每日检查：
1. 访问 http://localhost:3001/api/analytics/real-time 查看实时数据
2. 检查在线用户数和活跃度
3. 查看功能使用排行

### 每周分析：
1. 导出历史数据进行趋势分析
2. 查看用户地理分布变化
3. 分析功能使用模式

### 性能监控：
1. 检查系统健康状态
2. 监控响应时间和错误率
3. 查看服务器资源使用情况

## 🔐 安全提醒

- **本地开发**: 当前配置仅适用于本地开发环境
- **生产部署**: 生产环境需要配置HTTPS和认证
- **数据隐私**: 系统已自动匿名化用户IP地址
- **访问控制**: 建议为管理接口添加密码保护

## 📞 获取帮助

如果遇到问题：
1. 查看服务器日志输出
2. 检查 `analytics-backend/logs/` 目录下的日志文件
3. 运行健康检查：`curl http://localhost:3001/health`
4. 查看本指南的故障排除部分

---

**下一步**: 当你熟悉基本操作后，可以考虑部署完整版系统以获得更强大的功能！