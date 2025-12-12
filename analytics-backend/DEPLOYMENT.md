# Analytics Backend Deployment Guide

## 快速开始 | Quick Start

### 1. 环境要求 | Requirements

- Node.js 16+ 
- Docker & Docker Compose
- PostgreSQL 13+
- InfluxDB 2.0+
- Redis 6+

### 2. 本地开发 | Local Development

```bash
# 1. 安装依赖
cd analytics-backend
npm install

# 2. 启动数据库服务
docker-compose up -d

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置数据库连接

# 4. 初始化数据库
npm run db:init

# 5. 启动开发服务器
npm run dev
```

### 3. 生产部署 | Production Deployment

#### 使用Docker Compose (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd analytics-backend

# 2. 配置生产环境变量
cp .env.example .env.production
# 编辑 .env.production 文件

# 3. 构建并启动服务
docker-compose -f docker-compose.prod.yml up -d

# 4. 检查服务状态
docker-compose -f docker-compose.prod.yml ps
```

#### 手动部署

```bash
# 1. 安装依赖
npm ci --production

# 2. 构建应用
npm run build

# 3. 启动服务
npm start
```

### 4. 配置前端连接 | Frontend Configuration

在TextDiff+网站中配置后台连接：

```javascript
// 在页面加载后配置
window.textDiffAnalytics.configureBackend({
    backendUrl: 'https://your-analytics-api.com/api/analytics',
    batchInterval: 30000, // 30秒
    enabled: true
});
```

或者在HTML中直接配置：

```html
<script>
window.ANALYTICS_CONFIG = {
    backendUrl: 'https://your-analytics-api.com/api/analytics',
    batchInterval: 30000,
    enabled: true
};
</script>
```

### 5. API端点 | API Endpoints

#### 数据收集 | Data Collection
- `POST /api/analytics/events/page-view` - 页面访问事件
- `POST /api/analytics/events/feature-usage` - 功能使用事件
- `POST /api/analytics/events/session` - 会话事件
- `POST /api/analytics/events/batch` - 批量事件

#### 数据查询 | Data Query (需要认证)
- `GET /api/analytics/real-time` - 实时统计
- `GET /api/analytics/historical` - 历史数据
- `GET /api/analytics/performance` - 性能指标
- `GET /api/analytics/traffic-trend` - 流量趋势

#### 管理接口 | Admin APIs
- `GET /api/admin/dashboard` - 仪表板数据
- `GET /api/reports/generate` - 生成报告
- `GET /api/alerts/rules` - 报警规则

### 6. 环境变量配置 | Environment Variables

```bash
# 服务器配置
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/analytics
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=your-org
INFLUXDB_BUCKET=analytics
REDIS_URL=redis://localhost:6379

# 安全配置
JWT_SECRET=your-jwt-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# CORS配置
CORS_ORIGIN=https://your-textdiff-site.com

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/analytics.log
```

### 7. 监控和维护 | Monitoring & Maintenance

#### 健康检查
```bash
curl http://localhost:3001/api/analytics/health
```

#### 查看日志
```bash
# Docker环境
docker-compose logs -f analytics-api

# 直接部署
tail -f logs/analytics.log
```

#### 数据备份
```bash
# PostgreSQL备份
pg_dump analytics > backup_$(date +%Y%m%d).sql

# InfluxDB备份
influx backup /path/to/backup
```

### 8. 性能优化 | Performance Optimization

#### 数据库优化
- 定期清理过期数据
- 优化查询索引
- 配置连接池

#### 缓存策略
- Redis缓存热点数据
- 设置合理的TTL
- 使用批量操作

#### 监控指标
- 响应时间
- 错误率
- 内存使用
- 数据库连接数

### 9. 故障排除 | Troubleshooting

#### 常见问题

**连接失败**
```bash
# 检查服务状态
docker-compose ps
curl http://localhost:3001/health

# 检查网络连接
telnet localhost 3001
```

**数据库连接问题**
```bash
# 检查数据库状态
docker-compose exec postgres psql -U postgres -c "\l"
docker-compose exec influxdb influx ping
```

**内存不足**
```bash
# 检查内存使用
docker stats
free -h

# 调整Docker内存限制
# 在docker-compose.yml中添加memory限制
```

### 10. 安全建议 | Security Recommendations

1. **使用HTTPS** - 所有API通信必须加密
2. **JWT认证** - 管理接口需要有效的JWT令牌
3. **IP白名单** - 限制管理接口访问IP
4. **数据匿名化** - 自动处理敏感信息
5. **定期更新** - 保持依赖包最新版本

### 11. 扩展部署 | Scaling Deployment

#### 水平扩展
```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  analytics-api:
    deploy:
      replicas: 3
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

#### 负载均衡
```nginx
upstream analytics_backend {
    server analytics-api-1:3001;
    server analytics-api-2:3001;
    server analytics-api-3:3001;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://analytics_backend;
    }
}
```

### 12. 支持和文档 | Support & Documentation

- **API文档**: `/api/docs` (Swagger UI)
- **健康检查**: `/health`
- **指标监控**: `/metrics` (Prometheus格式)
- **日志查看**: 查看 `logs/` 目录

如有问题，请查看日志文件或联系技术支持。