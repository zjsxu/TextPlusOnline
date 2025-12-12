# 📊 如何使用 TextDiff+ Analytics System

## 🚀 快速开始 (3步搞定)

### 方法1: 一键启动 (推荐)

**macOS/Linux用户:**
```bash
./start-analytics.sh
```

**Windows用户:**
```cmd
start-analytics.bat
```

启动后会自动打开管理员仪表板: http://localhost:8080/admin-dashboard.html

### 方法2: 手动启动

1. **启动后台服务**
```bash
cd analytics-backend
node test-simple.js
```

2. **启动前端服务**
```bash
python3 -m http.server 8080
```

3. **打开管理员仪表板**
访问: http://localhost:8080/admin-dashboard.html

## 📊 查看用户数据的方式

### 1. 管理员仪表板 (推荐)
- **地址**: http://localhost:8080/admin-dashboard.html
- **功能**: 
  - 实时在线用户数
  - 功能使用排行
  - 地理分布统计
  - 系统性能监控
  - 最近事件列表
  - 自动刷新数据

### 2. 直接API访问
```bash
# 查看实时统计
curl http://localhost:3001/api/analytics/real-time

# 查看系统健康
curl http://localhost:3001/health

# 查看历史数据 (需要完整版)
curl "http://localhost:3001/api/analytics/historical?start=2025-12-11&end=2025-12-12"
```

### 3. 在TextDiff+网站中查看
1. 访问你的TextDiff+网站
2. 滚动到页面底部
3. 点击"配置后台服务"
4. 输入: `http://localhost:3001/api/analytics`
5. 点击"显示统计摘要"查看数据

## 🎯 主要功能说明

### 实时监控
- **在线用户数**: 当前正在使用网站的用户数量
- **活跃会话**: 当前活跃的用户会话数
- **每分钟事件**: 每分钟收到的用户行为事件数
- **系统健康**: 系统整体健康状态评分

### 用户行为分析
- **功能使用排行**: 哪些功能最受欢迎
- **地理分布**: 用户来自哪些国家/地区
- **访问趋势**: 用户访问的时间分布
- **会话分析**: 用户停留时间和跳出率

### 数据收集
系统会自动收集以下数据：
- 页面访问记录
- 功能使用统计 (文本对比、文件上传等)
- 用户会话信息
- 系统性能数据

## 🔧 常见问题解决

### Q: 后台服务启动失败
**A**: 检查端口3001是否被占用
```bash
# 查看端口占用
lsof -i :3001

# 杀死占用进程
kill -9 <PID>
```

### Q: 前端无法连接后台
**A**: 确认后台服务正在运行
```bash
curl http://localhost:3001/health
```

### Q: 没有数据显示
**A**: 确保TextDiff+网站有用户访问，并且已配置后台连接

### Q: 仪表板显示连接失败
**A**: 检查浏览器控制台错误，确认API地址正确

## 📱 移动端访问

如果想在手机上查看数据：

1. 确保手机和电脑在同一WiFi
2. 找到电脑IP地址:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr "IPv4"
```
3. 在手机浏览器访问: `http://你的IP:8080/admin-dashboard.html`

## 🔒 安全提醒

- 当前配置仅适用于本地开发
- 生产环境需要配置HTTPS和认证
- 系统已自动匿名化用户IP地址
- 不会收集任何个人敏感信息

## 📈 数据说明

### 数据类型
- **页面访问**: 用户访问网站页面的记录
- **功能使用**: 用户使用具体功能的统计
- **会话信息**: 用户访问会话的开始、结束时间
- **性能数据**: 系统响应时间、错误率等

### 数据存储
- **本地存储**: 数据存储在浏览器localStorage中
- **后台存储**: 数据发送到后台服务器进行聚合分析
- **隐私保护**: 所有个人信息都经过匿名化处理

## 🎉 下一步

当你熟悉基本操作后，可以：

1. **部署完整版**: 使用PostgreSQL和InfluxDB获得更强大的功能
2. **自定义分析**: 根据需要添加更多统计指标
3. **报告生成**: 实现定期报告和数据导出
4. **移动端优化**: 开发专门的移动端管理界面

---

**需要帮助?** 查看详细文档:
- 部署指南: `analytics-backend/DEPLOYMENT.md`
- 测试结果: `TEST_RESULTS.md`
- 项目进度: `PROGRESS_SUMMARY.md`