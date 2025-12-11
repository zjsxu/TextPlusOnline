# 🚀 TextDiff+ 在线部署指南

## 📋 部署前准备

确保你的项目根目录包含以下文件：
- `index.html` - 主页面
- `style.css` - 样式文件
- `js/` 文件夹 - 所有JavaScript文件
- `dictionary/` 文件夹 - 词典文件（可选）

## 🌐 方案1：Vercel 部署（推荐）

### 1. 安装 Vercel CLI
```bash
npm install -g vercel
```

### 2. 登录 Vercel
```bash
vercel login
```

### 3. 部署项目
```bash
vercel --prod
```

### 4. 获取网址
部署完成后，你会得到一个网址，如：
`https://textdiff-plus-xxx.vercel.app`

## 🌍 方案2：Netlify 部署

### 方法A：拖拽部署
1. 访问 [netlify.com](https://netlify.com)
2. 注册/登录账号
3. 将整个项目文件夹拖拽到部署区域
4. 等待部署完成

### 方法B：Git 部署
1. 将代码推送到 GitHub
2. 在 Netlify 中连接 GitHub 仓库
3. 自动部署

## 📱 方案3：GitHub Pages

### 1. 推送到 GitHub
```bash
git add .
git commit -m "Deploy TextDiff+ online version"
git push origin main
```

### 2. 启用 GitHub Pages
1. 进入仓库设置
2. 找到 "Pages" 选项
3. 选择 "Deploy from a branch"
4. 选择 "main" 分支
5. 点击保存

### 3. 访问网址
`https://yourusername.github.io/your-repo-name`

## ✅ 部署后检查

访问你的网站，确保以下功能正常：
- [ ] 页面正常加载
- [ ] 可以粘贴文本进行对比
- [ ] 文件上传功能正常（PDF/TXT/DOCX）
- [ ] 右侧图表显示正常
- [ ] 词典管理功能正常
- [ ] 主题切换功能正常

## 🔧 常见问题

### Q: PDF文件无法处理
A: 确保网络连接正常，PDF.js需要从CDN加载

### Q: 图表不显示
A: 检查Chart.js是否正常加载

### Q: 文件上传失败
A: 这是纯前端版本，所有处理都在浏览器中进行

## 📊 性能优化建议

1. **启用CDN加速**：大多数平台自动提供
2. **启用Gzip压缩**：平台通常自动启用
3. **设置缓存策略**：静态文件自动缓存

## 🎯 用户使用指南

为用户创建简单的使用说明：

1. **访问网址**：直接打开部署后的网址
2. **上传文件**：支持PDF、TXT、DOCX格式
3. **粘贴文本**：也可以直接粘贴文本内容
4. **点击对比**：查看详细的对比结果
5. **查看分析**：右侧面板显示语义分析图表

## 📈 监控和维护

- **访问统计**：各平台都提供访问统计
- **错误监控**：查看浏览器控制台错误
- **用户反馈**：收集用户使用反馈

## 🔄 更新部署

当你更新代码后：
- **Vercel**: 运行 `vercel --prod`
- **Netlify**: 推送到Git仓库自动更新
- **GitHub Pages**: 推送到main分支自动更新

---

🎉 恭喜！你的TextDiff+工具现在可以在线使用了！