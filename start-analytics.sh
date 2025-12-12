#!/bin/bash

# TextDiff+ Analytics System 一键启动脚本
# One-click startup script for TextDiff+ Analytics System

echo "🚀 启动 TextDiff+ Analytics System..."
echo "🚀 Starting TextDiff+ Analytics System..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    echo "❌ Node.js not found, please install Node.js first"
    exit 1
fi

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python3"
    echo "❌ Python3 not found, please install Python3 first"
    exit 1
fi

echo "✅ 环境检查通过"
echo "✅ Environment check passed"

# 进入后台目录并启动服务
cd analytics-backend

echo "📦 检查依赖..."
echo "📦 Checking dependencies..."

if [ ! -d "node_modules" ]; then
    echo "📥 安装依赖..."
    echo "📥 Installing dependencies..."
    npm install
fi

echo "🔧 启动后台服务..."
echo "🔧 Starting backend service..."

# 启动简化版后台服务
node test-simple.js &
BACKEND_PID=$!

# 等待后台服务启动
sleep 3

# 检查后台服务是否启动成功
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ 后台服务启动成功 (PID: $BACKEND_PID)"
    echo "✅ Backend service started successfully (PID: $BACKEND_PID)"
else
    echo "❌ 后台服务启动失败"
    echo "❌ Backend service failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 返回主目录
cd ..

echo "🌐 启动前端服务..."
echo "🌐 Starting frontend service..."

# 启动HTTP服务器
python3 -m http.server 8080 &
FRONTEND_PID=$!

# 等待前端服务启动
sleep 2

echo ""
echo "🎉 系统启动完成！"
echo "🎉 System started successfully!"
echo ""
echo "📊 管理员仪表板: http://localhost:8080/admin-dashboard.html"
echo "📊 Admin Dashboard: http://localhost:8080/admin-dashboard.html"
echo ""
echo "🔗 API端点:"
echo "🔗 API Endpoints:"
echo "   - 健康检查 | Health: http://localhost:3001/health"
echo "   - 实时统计 | Real-time: http://localhost:3001/api/analytics/real-time"
echo ""
echo "🛑 停止服务请按 Ctrl+C"
echo "🛑 Press Ctrl+C to stop services"

# 保存PID到文件
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; echo "🛑 Stopping services..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f .backend.pid .frontend.pid; echo "✅ 服务已停止"; echo "✅ Services stopped"; exit 0' INT

# 保持脚本运行
wait