# 多阶段构建 - 前端
FROM node:20-alpine AS frontend-build

WORKDIR /app

# 复制 package 文件
COPY frontend/package*.json ./

# 安装完整构建依赖；Vite 与插件位于 devDependencies，生产镜像只复制 dist。
RUN npm ci

# 复制源代码
COPY frontend/ ./

# 构建生产版本
RUN npm run build

# 前端 Nginx 镜像
FROM nginx:alpine

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 删除默认配置
RUN rm /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
