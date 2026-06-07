# 多阶段构建 - 后端
FROM maven:3.9-openjdk-17-slim AS backend-build

WORKDIR /app

# 复制 pom.xml 并下载依赖（利用 Docker 缓存）
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B

# 复制源代码
COPY backend/src ./src

# 编译打包
RUN mvn clean package -DskipTests -B

# 后端运行时镜像
FROM openjdk:17-slim

WORKDIR /app

# 添加时区数据以支持时间相关功能
RUN apt-get update && apt-get install -y tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制 JAR 包
COPY --from=backend-build /app/target/*.jar app.jar

# 暴露端口
EXPOSE 8080

# JVM 优化参数
ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC -XX:+UseContainerSupport"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# 启动应用
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]