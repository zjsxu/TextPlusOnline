@echo off
chcp 65001 >nul
title TextDiff+ Analytics System

echo 🚀 启动 TextDiff+ Analytics System...
echo 🚀 Starting TextDiff+ Analytics System...

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    echo ❌ Node.js not found, please install Node.js first
    pause
    exit /b 1
)

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 未安装，请先安装 Python
    echo ❌ Python not found, please install Python first
    pause
    exit /b 1
)

echo ✅ 环境检查通过
echo ✅ Environment check passed

REM 进入后台目录
cd analytics-backend

echo 📦 检查依赖...
echo 📦 Checking dependencies...

if not exist "node_modules" (
    echo 📥 安装依赖...
    echo 📥 Installing dependencies...
    npm install
)

echo 🔧 启动后台服务...
echo 🔧 Starting backend service...

REM 启动后台服务
start /b node test-simple.js

REM 等待服务启动
timeout /t 3 /nobreak >nul

REM 返回主目录
cd ..

echo 🌐 启动前端服务...
echo 🌐 Starting frontend service...

REM 启动HTTP服务器
start /b python -m http.server 8080

REM 等待前端服务启动
timeout /t 2 /nobreak >nul

echo.
echo 🎉 系统启动完成！
echo 🎉 System started successfully!
echo.
echo 📊 管理员仪表板: http://localhost:8080/admin-dashboard.html
echo 📊 Admin Dashboard: http://localhost:8080/admin-dashboard.html
echo.
echo 🔗 API端点:
echo 🔗 API Endpoints:
echo    - 健康检查 ^| Health: http://localhost:3001/health
echo    - 实时统计 ^| Real-time: http://localhost:3001/api/analytics/real-time
echo.
echo 🌐 正在打开管理员仪表板...
echo 🌐 Opening admin dashboard...

REM 自动打开浏览器
start http://localhost:8080/admin-dashboard.html

echo.
echo 🛑 按任意键停止服务
echo 🛑 Press any key to stop services
pause >nul

REM 停止服务
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1

echo ✅ 服务已停止
echo ✅ Services stopped
pause