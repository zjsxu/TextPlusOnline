# TextDiff+ Analytics Backend

TextDiff+网站的后台分析系统，提供实时数据收集、用户行为分析和管理员仪表板功能。

## 🏗️ 系统架构

- **Node.js + Express.js**: API服务器
- **PostgreSQL**: 关系型数据存储
- **InfluxDB**: 时序数据存储
- **Redis**: 消息队列和缓存
- **Socket.IO**: 实时数据推送
- **Docker**: 容器化部署

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd analytics-backend

# 复制环境配置
cp .env.example .env

# 编辑环境变量
nano .env
```

### 2. 使用Docker启动（推荐）

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f analytics-api

# 停止服务
docker-compose down
```

### 3. 本地开发启动

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

## 📊 API接口

### 数据收集接口

```bash
# 收集页面访问事件
POST /api/analytics/events/page-view
Content-Type: application/json

{
  "sessionId": "session_123",
  "url": "https://zjsxu.github.io/TextPlusOnline/",
  "referrer": "https://google.com",
  "userAgent": "Mozilla/5.0...",
  "screenResolution": "1920x1080",
  "language": "zh-CN"
}

# 收集功能使用事件
POST /api/analytics/events/feature-usage
Content-Type: application/json

{
  "sessionId": "session_123",
  "feature": "text_comparison",
  "action": "compare",
  "parameters": {
    "textALength": 1250,
    "textBLength": 1180,
    "diffCount": 15
  },
  "duration": 2500
}
```

### 管理员接口

```bash
# 管理员登录
POST /api/admin/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

# 获取实时统计
GET /api/analytics/real-time
Authorization: Bearer <token>

# 获取历史数据
GET /api/analytics/historical?start=2024-01-01&end=2024-01-31&granularity=day
Authorization: Bearer <token>
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务端口 | `3001` |
| `POSTGRES_URL` | PostgreSQL连接字符串 | - |
| `REDIS_URL` | Redis连接字符串 | - |
| `INFLUXDB_URL` | InfluxDB连接地址 | - |
| `INFLUXDB_TOKEN` | InfluxDB访问令牌 | - |
| `JWT_SECRET` | JWT密钥 | - |
| `CORS_ORIGIN` | 允许的跨域来源 | `https://zjsxu.github.io` |

### 数据库配置

系统使用三个数据库：

1. **PostgreSQL**: 存储用户会话、管理员信息、配置等结构化数据
2. **InfluxDB**: 存储时序事件数据，支持高效的时间范围查询
3. **Redis**: 消息队列、缓存和会话存储

## 📈 监控和日志

### 健康检查

```bash
# 检查服务状态
curl http://localhost:3001/health

# 响应示例
{
  "status": "healthy",
  "timestamp": "2024-12-12T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### 日志文件

- `logs/analytics.log`: 应用日志
- `logs/error.log`: 错误日志

### 性能监控

系统内置性能监控，记录：
- API响应时间
- 数据库查询性能
- 内存和CPU使用情况
- 错误率统计

## 🔒 安全特性

- **HTTPS强制**: 所有API通信使用HTTPS加密
- **CORS保护**: 严格的跨域资源共享控制
- **JWT认证**: 管理员接口使用JWT令牌认证
- **限流保护**: API请求频率限制
- **数据匿名化**: 自动匿名化用户IP地址
- **输入验证**: 所有输入数据严格验证

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "Analytics API"

# 生成测试覆盖率报告
npm run test:coverage
```

## 📦 部署

### Docker部署

```bash
# 生产环境部署
docker-compose -f docker-compose.prod.yml up -d

# 更新服务
docker-compose pull
docker-compose up -d --no-deps analytics-api
```

### 手动部署

```bash
# 构建生产版本
npm run build

# 启动生产服务
NODE_ENV=production npm start
```

## 🔧 维护

### 数据清理

```bash
# 清理过期数据（90天前）
curl -X POST http://localhost:3001/api/admin/maintenance/cleanup \
  -H "Authorization: Bearer <token>"
```

### 备份数据库

```bash
# PostgreSQL备份
docker exec analytics-postgres pg_dump -U analytics analytics_db > backup.sql

# InfluxDB备份
docker exec analytics-influxdb influx backup /tmp/backup
```

## 📞 技术支持

如遇问题，请检查：

1. **日志文件**: 查看 `logs/` 目录下的日志
2. **服务状态**: 使用 `/health` 端点检查
3. **数据库连接**: 确认所有数据库服务正常运行
4. **环境变量**: 验证所有必需的环境变量已设置

## 🔄 更新日志

### v1.1.0 (2024-12-12)
- ✅ 新增数据处理和聚合引擎
- ✅ 实现实时统计计算服务
- ✅ 完善前端后台集成
- ✅ 添加批量数据发送功能
- ✅ 增强性能监控和流量趋势分析
- ✅ 完善部署文档和测试脚本

### v1.0.0 (2024-12-12)
- 初始版本发布
- 实时数据收集和展示
- 管理员仪表板基础架构
- 报警通知系统框架
- 报告生成功能框架