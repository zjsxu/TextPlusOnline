# Admin Analytics Dashboard Design Document

## Overview

管理员后台分析仪表板是一个实时数据监控和分析系统，为TextDiff+网站运营者提供全面的用户行为分析、访问统计和性能监控功能。系统采用现代化的微服务架构，支持实时数据处理、隐私保护和移动端访问。

## Architecture

### 系统架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Admin Panel   │
│   (TextDiff+)   │◄──►│                 │◄──►│   Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Data Collector  │    │ Analytics API   │    │ Notification    │
│ Service         │    │ Service         │    │ Service         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Message Queue   │    │ Data Processing │    │ Report          │
│ (Redis/RabbitMQ)│    │ Engine          │    │ Generator       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Time Series DB  │    │ Analytics DB    │    │ File Storage    │
│ (InfluxDB)      │    │ (PostgreSQL)    │    │ (MinIO/S3)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 技术栈选择

**后端服务:**
- Node.js + Express.js (API服务)
- Python + FastAPI (数据处理引擎)
- Redis (消息队列和缓存)
- InfluxDB (时序数据存储)
- PostgreSQL (关系型数据存储)

**前端界面:**
- React.js + TypeScript (管理员仪表板)
- Chart.js / D3.js (数据可视化)
- Tailwind CSS (响应式设计)
- PWA (移动端支持)

**基础设施:**
- Docker + Kubernetes (容器化部署)
- Nginx (反向代理和负载均衡)
- Let's Encrypt (HTTPS证书)
- Prometheus + Grafana (系统监控)

## Components and Interfaces

### 1. Data Collector Service

**职责:** 从前端收集用户行为数据并进行初步处理

**接口:**
```typescript
interface DataCollectorAPI {
  // 收集页面访问事件
  collectPageView(event: PageViewEvent): Promise<void>
  
  // 收集功能使用事件
  collectFeatureUsage(event: FeatureUsageEvent): Promise<void>
  
  // 收集用户会话事件
  collectSessionEvent(event: SessionEvent): Promise<void>
  
  // 批量收集事件
  collectBatchEvents(events: AnalyticsEvent[]): Promise<void>
}

interface PageViewEvent {
  sessionId: string
  timestamp: Date
  url: string
  referrer?: string
  userAgent: string
  screenResolution: string
  language: string
  anonymizedIP: string
}

interface FeatureUsageEvent {
  sessionId: string
  timestamp: Date
  feature: string
  action: string
  parameters: Record<string, any>
  duration?: number
}
```

### 2. Analytics API Service

**职责:** 提供数据查询和分析接口

**接口:**
```typescript
interface AnalyticsAPI {
  // 获取实时统计
  getRealTimeStats(): Promise<RealTimeStats>
  
  // 获取历史数据
  getHistoricalData(query: HistoricalQuery): Promise<HistoricalData>
  
  // 获取功能使用统计
  getFeatureUsage(timeRange: TimeRange): Promise<FeatureUsageStats>
  
  // 获取用户地理分布
  getGeographicDistribution(timeRange: TimeRange): Promise<GeographicData>
}

interface RealTimeStats {
  onlineUsers: number
  currentSessions: number
  recentEvents: AnalyticsEvent[]
  systemHealth: SystemHealth
}

interface HistoricalQuery {
  startDate: Date
  endDate: Date
  granularity: 'hour' | 'day' | 'week' | 'month'
  metrics: string[]
  filters?: Record<string, any>
}
```

### 3. Admin Dashboard Service

**职责:** 提供管理员界面和用户认证

**接口:**
```typescript
interface AdminDashboardAPI {
  // 用户认证
  authenticate(credentials: AdminCredentials): Promise<AuthToken>
  
  // 获取仪表板配置
  getDashboardConfig(userId: string): Promise<DashboardConfig>
  
  // 更新仪表板配置
  updateDashboardConfig(userId: string, config: DashboardConfig): Promise<void>
  
  // 生成报告
  generateReport(request: ReportRequest): Promise<ReportResponse>
}

interface DashboardConfig {
  widgets: Widget[]
  refreshInterval: number
  alertSettings: AlertSettings
  theme: 'light' | 'dark'
}
```

### 4. Notification Service

**职责:** 处理报警通知和消息推送

**接口:**
```typescript
interface NotificationService {
  // 发送邮件通知
  sendEmailAlert(alert: AlertMessage): Promise<void>
  
  // 发送短信通知
  sendSMSAlert(alert: AlertMessage): Promise<void>
  
  // 发送推送通知
  sendPushNotification(notification: PushMessage): Promise<void>
  
  // 配置通知规则
  configureAlertRules(rules: AlertRule[]): Promise<void>
}

interface AlertMessage {
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
  timestamp: Date
  severity: number
  recipients: string[]
}
```

## Data Models

### 1. 用户会话模型

```typescript
interface UserSession {
  sessionId: string
  startTime: Date
  endTime?: Date
  anonymizedIP: string
  userAgent: string
  country?: string
  city?: string
  referrer?: string
  landingPage: string
  exitPage?: string
  pageViews: number
  duration: number
  bounced: boolean
}
```

### 2. 事件数据模型

```typescript
interface AnalyticsEvent {
  eventId: string
  sessionId: string
  timestamp: Date
  eventType: 'page_view' | 'feature_usage' | 'error' | 'performance'
  category: string
  action: string
  label?: string
  value?: number
  customProperties: Record<string, any>
}
```

### 3. 聚合数据模型

```typescript
interface AggregatedMetrics {
  timeWindow: Date
  granularity: 'hour' | 'day' | 'week' | 'month'
  metrics: {
    pageViews: number
    uniqueVisitors: number
    sessions: number
    bounceRate: number
    avgSessionDuration: number
    topPages: PageMetric[]
    topFeatures: FeatureMetric[]
    errorRate: number
    avgResponseTime: number
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After reviewing all properties identified in the prework, I've identified several areas where properties can be consolidated:

- Properties 1.1-1.5 all relate to real-time data display and can be combined into comprehensive real-time functionality properties
- Properties 2.1-2.5 all relate to historical data analysis and can be consolidated into data aggregation properties  
- Properties 3.1-3.5 all relate to feature monitoring and can be combined into feature tracking properties
- Properties 4.1-4.5 all relate to privacy protection and can be consolidated into privacy compliance properties
- Properties 5.1-5.5 all relate to alerting and can be combined into notification system properties
- Properties 6.1-6.5 all relate to reporting and can be consolidated into report generation properties
- Properties 7.1-7.5 all relate to mobile support and can be combined into mobile compatibility properties

### Property 1: Real-time data collection and display
*For any* user interaction on the website, the system should collect the event data and update the admin dashboard within 5 seconds, displaying current online users and recent activity
**Validates: Requirements 1.1, 1.2, 1.4, 1.5**

### Property 2: Real-time trend visualization  
*For any* 24-hour period, when an administrator views the dashboard, the system should display accurate trend charts reflecting all user activities within that timeframe
**Validates: Requirements 1.3**

### Property 3: Historical data aggregation accuracy
*For any* time range query, the aggregated data (daily/weekly/monthly) should mathematically equal the sum of the underlying granular data points
**Validates: Requirements 2.1, 2.2**

### Property 4: Feature usage ranking consistency
*For any* set of feature usage data, the ranking displayed should correctly order features by usage frequency, and geographic/session statistics should accurately reflect the underlying data
**Validates: Requirements 2.3, 2.4, 2.5**

### Property 5: Comprehensive feature tracking
*For any* user action (file upload, text comparison, dictionary operation), the system should record all specified metadata (type, size, duration, complexity) accurately
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 6: Performance monitoring accuracy
*For any* system operation, the recorded response times and error rates should accurately reflect actual system performance within acceptable measurement tolerances
**Validates: Requirements 3.4, 3.5**

### Property 7: Privacy protection compliance
*For any* collected user data, all personal identifiers should be anonymized, only necessary statistical information should be stored, and HTTPS encryption should be used for all transmissions
**Validates: Requirements 4.1, 4.3, 4.5**

### Property 8: User consent and data deletion
*For any* user visiting the website, privacy notices should be displayed and consent recorded, and any data deletion requests should completely remove associated data
**Validates: Requirements 4.2, 4.4**

### Property 9: Alert threshold monitoring
*For any* configured alert rule, when metrics exceed the specified thresholds, appropriate notifications should be sent via the configured channels within the specified timeframe
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 10: Report generation completeness
*For any* report request, the generated output (PDF, CSV, JSON) should contain all requested metrics for the specified time range and be accessible via shareable links when requested
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 11: Automated reporting consistency
*For any* scheduled report (weekly/monthly), the system should automatically generate reports at the specified intervals with customizable content matching user selections
**Validates: Requirements 6.4, 6.5**

### Property 12: Mobile interface responsiveness
*For any* mobile device screen size, the dashboard interface should adapt appropriately, display optimized charts, and provide touch-friendly interactions with push notification support
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

## Error Handling

### 1. 数据收集错误处理

```typescript
class DataCollectionErrorHandler {
  // 处理网络连接失败
  handleNetworkError(event: AnalyticsEvent): void {
    // 本地缓存事件，稍后重试
    this.cacheEventLocally(event)
    this.scheduleRetry(event)
  }
  
  // 处理数据格式错误
  handleValidationError(event: AnalyticsEvent, error: ValidationError): void {
    // 记录错误日志，丢弃无效数据
    this.logError('Data validation failed', { event, error })
    this.incrementErrorMetric('validation_error')
  }
  
  // 处理存储失败
  handleStorageError(events: AnalyticsEvent[], error: StorageError): void {
    // 切换到备用存储，发送警报
    this.switchToBackupStorage()
    this.sendAlert('Storage system failure', error)
  }
}
```

### 2. 实时监控错误处理

```typescript
class RealTimeMonitorErrorHandler {
  // 处理连接中断
  handleConnectionLoss(): void {
    // 自动重连机制
    this.attemptReconnection()
    this.notifyAdminsOfOutage()
  }
  
  // 处理数据延迟
  handleDataDelay(delayMs: number): void {
    if (delayMs > this.maxAcceptableDelay) {
      this.sendPerformanceAlert('Data delay detected', delayMs)
    }
  }
}
```

### 3. 报告生成错误处理

```typescript
class ReportGenerationErrorHandler {
  // 处理报告生成失败
  handleReportGenerationFailure(request: ReportRequest, error: Error): void {
    // 重试机制
    this.retryReportGeneration(request)
    
    // 如果重试失败，通知用户
    if (this.retryCount > this.maxRetries) {
      this.notifyUserOfFailure(request.userId, error)
    }
  }
  
  // 处理大数据量报告
  handleLargeDatasetReport(request: ReportRequest): void {
    // 分批处理，异步生成
    this.processReportInBatches(request)
    this.notifyWhenComplete(request.userId)
  }
}
```

## Testing Strategy

### 单元测试策略

**数据收集模块测试:**
- 测试各种事件类型的数据收集准确性
- 验证数据验证和清洗逻辑
- 测试错误处理和重试机制

**数据聚合模块测试:**
- 测试不同时间粒度的数据聚合准确性
- 验证统计计算的正确性
- 测试大数据量处理性能

**通知系统测试:**
- 测试各种通知渠道的可靠性
- 验证报警规则的触发逻辑
- 测试通知去重和限流机制

### 属性基础测试策略

使用**Jest**和**Supertest**作为主要的属性基础测试框架，配置每个属性测试运行最少100次迭代以确保随机输入的充分覆盖。

**实时数据测试:**
- 生成随机用户行为事件，验证实时统计更新
- 测试并发用户访问下的数据一致性
- 验证5秒内数据更新的时间要求

**历史数据测试:**
- 生成大量历史数据，测试聚合计算准确性
- 验证不同时间范围查询的数据完整性
- 测试数据分页和排序功能

**隐私保护测试:**
- 输入包含个人信息的测试数据，验证匿名化处理
- 测试数据传输加密和存储安全
- 验证数据删除的完整性

**移动端测试:**
- 模拟不同屏幕尺寸和设备类型
- 测试触摸交互和响应式布局
- 验证推送通知功能

### 集成测试策略

**端到端数据流测试:**
- 从前端事件收集到后台数据展示的完整流程
- 测试多服务间的数据传递和同步
- 验证系统在高负载下的稳定性

**API接口测试:**
- 测试所有REST API的功能正确性
- 验证API响应时间和错误处理
- 测试API安全性和权限控制

**数据库集成测试:**
- 测试时序数据库和关系数据库的数据一致性
- 验证数据备份和恢复机制
- 测试数据库性能和扩展性

### 性能测试策略

**负载测试:**
- 模拟高并发用户访问场景
- 测试系统在峰值负载下的表现
- 验证自动扩缩容机制

**压力测试:**
- 测试系统的极限承载能力
- 验证系统在资源不足时的降级策略
- 测试故障恢复能力

**容量规划测试:**
- 评估不同用户规模下的资源需求
- 测试数据存储增长对性能的影响
- 验证系统扩展性设计