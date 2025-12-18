#!/bin/bash

# TextDiff+ Analytics Backend 部署脚本

echo "🚀 开始部署 TextDiff+ Analytics Backend..."

# 检查是否在正确的目录
if [ ! -d "analytics-backend" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

cd analytics-backend

# 检查必要文件
if [ ! -f "server.js" ]; then
    echo "❌ 错误: server.js 文件不存在"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ 错误: package.json 文件不存在"
    exit 1
fi

echo "📦 检查 Node.js 和 npm..."
node --version
npm --version

echo "📦 安装依赖..."
npm install

echo "🧪 测试服务器..."
timeout 10s npm start &
SERVER_PID=$!
sleep 5

# 测试健康检查
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ 服务器测试通过"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ 服务器测试失败"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎯 部署选项:"
echo "1. Railway (推荐)"
echo "2. Heroku"
echo "3. Render"
echo ""

read -p "选择部署平台 (1-3): " choice

case $choice in
    1)
        echo "🚂 准备 Railway 部署..."
        echo ""
        echo "请按照以下步骤部署到 Railway:"
        echo "1. 访问 https://railway.app"
        echo "2. 登录并创建新项目"
        echo "3. 连接到此 GitHub 仓库"
        echo "4. 选择 analytics-backend 文件夹"
        echo "5. Railway 会自动检测并部署"
        echo ""
        echo "部署完成后，您将获得类似这样的URL:"
        echo "https://your-app-name.railway.app"
        ;;
    2)
        echo "🟣 准备 Heroku 部署..."
        if command -v heroku &> /dev/null; then
            echo "创建 Heroku 应用..."
            heroku create textdiff-analytics-$(date +%s)
            echo "设置环境变量..."
            heroku config:set NODE_ENV=production
            heroku config:set CORS_ORIGIN=https://zjsxu.github.io
            echo "部署到 Heroku..."
            git add .
            git commit -m "Deploy analytics backend to Heroku"
            git push heroku main
        else
            echo "请先安装 Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli"
        fi
        ;;
    3)
        echo "🟢 准备 Render 部署..."
        echo ""
        echo "请按照以下步骤部署到 Render:"
        echo "1. 访问 https://render.com"
        echo "2. 登录并创建新的 Web Service"
        echo "3. 连接到此 GitHub 仓库"
        echo "4. 设置以下配置:"
        echo "   - Build Command: npm install"
        echo "   - Start Command: npm start"
        echo "   - Environment: Node"
        echo "5. 添加环境变量:"
        echo "   - NODE_ENV=production"
        echo "   - CORS_ORIGIN=https://zjsxu.github.io"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "📋 部署后的配置步骤:"
echo "1. 获取部署后的API URL (例如: https://your-app.railway.app)"
echo "2. 更新前端配置文件 js/analytics.js:"
echo "   productionBackendUrl: 'https://your-app.railway.app/api/analytics'"
echo "   enableProductionSend: true"
echo "3. 提交并推送到 GitHub Pages"
echo "4. 测试真实用户数据收集"
echo ""
echo "✅ 部署准备完成!"