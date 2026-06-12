# ======================================================
# Stage 1: Frontend Build (Node 20)
# ======================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ======================================================
# Stage 2: Backend Build (Maven + JDK 17)
# ======================================================
FROM maven:3.9-eclipse-temurin-17 AS backend-builder
WORKDIR /build/backend
COPY backend/pom.xml ./
RUN mvn dependency:go-offline -B -q
COPY backend/ .
RUN mvn package -DskipTests -B -q

# ======================================================
# Stage 3: Runtime (JRE 17)
# ======================================================
FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl nginx tini \
    && rm -rf /var/lib/apt/lists/*

# 后端 JAR
COPY --from=backend-builder /build/backend/target/*.jar /app/app.jar

# 前端静态文件由 Nginx 在根路径托管，/api/* 反代到 Spring Boot。
COPY --from=frontend-builder /build/frontend/dist /app/static
COPY docker/single-container-nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/single-container-entrypoint.sh /app/entrypoint.sh

RUN rm -f /etc/nginx/sites-enabled/default \
    && chmod +x /app/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

ENTRYPOINT ["tini", "--", "/app/entrypoint.sh"]
