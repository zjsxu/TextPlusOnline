# TextDiff+ | 智能文本对比分析平台

一个现代化的全栈文本对比工具，支持 PDF、TXT、DOCX 文件的智能对比分析，具备语义分析、词频统计和自定义词典管理功能。

## ✨ 主要功能

- **📄 多格式支持**: 支持 PDF、TXT、DOCX 文件上传和文本提取
- **🔍 智能对比**: 基于 diff-match-patch 的高精度文本对比
- **🧠 语义分析**: 功能词识别和语气强度分析
- **📊 数据可视化**: 交互式图表展示分析结果
- **📈 词频统计**: 中英文词频分析和对比
- **📚 词典管理**: 自定义功能词词典，支持导入导出
- **🎨 主题系统**: 多种主题切换，支持暗色模式
- **📱 响应式设计**: 适配桌面和移动设备

## 🚀 快速开始

### 环境要求

- Node.js 16+ 
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

这将同时启动：
- 前端开发服务器 (http://localhost:3000)
- 后端 API 服务器 (http://localhost:5000)

### 生产部署

```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 📁 项目结构

```
textdiff-plus/
├── client/                 # 前端代码
│   ├── index.html         # 主页面
│   ├── styles/            # 样式文件
│   │   ├── main.css       # 主样式
│   │   ├── components.css # 组件样式
│   │   └── themes.css     # 主题样式
│   └── js/                # JavaScript 模块
│       ├── main.js        # 应用入口
│       └── modules/       # 功能模块
├── server/                # 后端代码
│   └── app.js            # Express 服务器
├── dictionary/           # 词典文件
│   └── function_words.json
├── package.json
└── README.md
```

## 🛠️ 技术栈

### 前端
- **Vanilla JavaScript** - 原生 ES6+ 模块化开发
- **Vite** - 现代化构建工具
- **Chart.js** - 数据可视化
- **diff-match-patch** - 文本对比算法

### 后端
- **Node.js + Express** - 服务器框架
- **Multer** - 文件上传处理
- **pdf-parse** - PDF 文本提取
- **mammoth** - DOCX 文件处理

## 📖 使用指南

### 1. 文本对比
1. 上传文件或粘贴文本到对应区域
2. 点击"开始对比分析"按钮
3. 查看并排对比结果和差异高亮

### 2. 语义分析
- 自动识别功能词并进行分类高亮
- 计算语气强度指数
- 生成语气变化分析报告

### 3. 词频统计
- 自动提取高频词汇
- 支持中英文分词
- 生成词频对比图表

### 4. 词典管理
- 添加自定义功能词
- 导入/导出词典文件
- 按类别管理词汇

## 🎨 主题定制

支持多种内置主题：
- 默认主题
- 暗色主题  
- 高对比度主题
- 蓝色主题
- 绿色主题

## 📝 API 接口

### 文件上传
```
POST /api/extract-text
Content-Type: multipart/form-data
```

### 词典管理
```
GET /api/dictionary          # 获取词典
POST /api/dictionary/save    # 保存词典
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [diff-match-patch](https://github.com/google/diff-match-patch) - 文本对比算法
- [Chart.js](https://www.chartjs.org/) - 图表库
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - PDF 解析
- [mammoth.js](https://github.com/mwilliamson/mammoth.js) - DOCX 处理

---

如有问题或建议，欢迎提交 Issue 或 Pull Request！