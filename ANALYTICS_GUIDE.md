# 📊 TextDiff+ 网站统计使用指南

## 🎯 统计功能概述

TextDiff+ 现已集成完整的网站使用统计功能，帮助您了解工具的使用情况和用户行为。

### ✨ 统计功能特点

- **隐私保护**: 所有数据仅存储在用户浏览器本地，不上传到服务器
- **实时统计**: 自动记录用户的各种操作行为
- **详细分析**: 提供功能使用、会话时长、文件类型等详细统计
- **数据导出**: 支持导出统计数据进行进一步分析
- **Google Analytics集成**: 可选择集成GA4进行更专业的分析

## 📈 统计的数据类型

### 1. 基础访问数据
- **页面访问次数**: 记录网站被访问的次数
- **会话数量**: 统计独立访问会话
- **会话时长**: 记录用户在网站停留的时间
- **用户设备信息**: 屏幕分辨率、浏览器类型、语言设置

### 2. 功能使用统计
- **文件上传**: 记录上传的文件类型、大小分类
- **文本对比**: 统计对比的文本长度、差异数量
- **词典管理**: 记录词典的添加、导出、导入操作
- **主题切换**: 统计用户偏好的主题类型
- **词频分析**: 记录词频分析的使用频率

### 3. 用户行为数据
- **活动时间**: 记录用户的活跃时间段
- **功能偏好**: 分析最常用的功能模块
- **文件处理模式**: 统计处理的文件类型分布

## 🔧 如何查看统计数据

### 方法1: 网页内置统计面板
1. 滚动到页面底部的"网站使用统计"面板
2. 点击"显示统计摘要"按钮
3. 查看详细的使用统计信息

### 方法2: 导出数据分析
1. 点击"导出统计数据"按钮
2. 下载JSON格式的统计文件
3. 使用Excel、Python等工具进行深度分析

## 📊 Google Analytics 集成（可选）

如果您需要更专业的网站分析，可以集成Google Analytics 4：

### 设置步骤：

1. **创建GA4账户**
   - 访问 https://analytics.google.com
   - 创建新的GA4属性
   - 获取测量ID（格式：G-XXXXXXXXXX）

2. **配置测量ID**
   - 编辑 `js/google-analytics.js` 文件
   - 将 `YOUR_GA4_MEASUREMENT_ID` 替换为您的实际测量ID

3. **启用Google Analytics**
   - 在 `index.html` 中添加以下代码：
   ```html
   <script src="js/google-analytics.js"></script>
   <script>
     window.addEventListener('DOMContentLoaded', initGoogleAnalytics);
   </script>
   ```

### GA4 统计的事件类型：
- `page_view`: 页面访问
- `feature_usage`: 功能使用
- `session_end`: 会话结束

## 🔒 隐私保护说明

### 本地统计（默认）
- 所有数据存储在用户浏览器的localStorage中
- 数据不会发送到任何外部服务器
- 用户可以随时清除本地统计数据
- 符合最严格的隐私保护要求

### Google Analytics（可选）
- 已启用IP地址匿名化
- 禁用广告个性化信号
- 禁用Google信号收集
- 符合GDPR等隐私法规要求

## 📋 统计数据示例

### 统计摘要格式：
```json
{
  "totalEvents": 45,
  "pageViews": 8,
  "sessions": 3,
  "featureUsage": {
    "file_upload": 12,
    "text_comparison": 8,
    "dictionary_usage": 5,
    "theme_change": 2,
    "frequency_analysis": 6
  },
  "dateRange": {
    "start": "2024-12-11T10:30:00.000Z",
    "end": "2024-12-11T15:45:00.000Z"
  }
}
```

### 详细事件数据：
```json
{
  "event": "feature_usage",
  "timestamp": "2024-12-11T14:30:00.000Z",
  "sessionId": "session_1702301400000_abc123",
  "feature": "text_comparison",
  "details": {
    "textALength": 1250,
    "textBLength": 1180,
    "diffCount": 15,
    "textLengthCategory": "medium"
  }
}
```

## 🎯 统计数据的应用场景

### 1. 产品优化
- 了解最受欢迎的功能，优先优化
- 发现用户使用中的痛点
- 改进用户界面和交互设计

### 2. 学术研究
- 分析文本对比工具的使用模式
- 研究不同用户群体的行为差异
- 为学术论文提供使用数据支持

### 3. 使用报告
- 生成定期的使用情况报告
- 向资助方展示工具的实际使用效果
- 为工具推广提供数据支持

## 🛠️ 高级配置

### 自定义统计事件
如需添加自定义统计事件，可以在代码中调用：
```javascript
if (window.textDiffAnalytics) {
    window.textDiffAnalytics.trackFeatureUsage('custom_feature', {
        customParam1: 'value1',
        customParam2: 'value2'
    });
}
```

### 修改统计配置
编辑 `js/analytics.js` 文件中的相关参数：
- 本地存储的最大事件数量（默认100条）
- 统计事件的详细程度
- 数据清理和压缩策略

## 📞 技术支持

如果您在使用统计功能时遇到问题：

1. **检查浏览器控制台**: 查看是否有JavaScript错误
2. **确认浏览器兼容性**: 建议使用Chrome 80+、Firefox 75+等现代浏览器
3. **检查localStorage**: 确保浏览器允许本地存储
4. **清除缓存**: 如有异常，尝试清除浏览器缓存后重新访问

---

🎉 **现在您可以全面了解TextDiff+的使用情况，为工具优化和研究提供数据支持！**