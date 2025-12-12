FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY config/ ./config/

# 创建日志目录
RUN mkdir -p logs

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S analytics -u 1001

# 设置文件权限
RUN chown -R analytics:nodejs /app
USER analytics

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node src/health-check.js

# 启动应用
CMD ["npm", "start"]