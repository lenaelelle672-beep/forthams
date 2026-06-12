# ============================================================
# Stage 1: 使用 Maven + Eclipse Temurin 17 编译打包
# ============================================================
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /build

# 先复制 pom.xml 和配置文件以利用 Docker 层缓存
COPY pom.xml ./
COPY src/main/resources/application.yml ./src/main/resources/application.yml

# 下载依赖（仅 pom.xml 变化时才会重新下载）
RUN mvn dependency:go-offline -B -q

# 复制全部源码
COPY src ./src

# 打包（跳过测试，Docker 构建环境不依赖数据库）
RUN mvn clean package -DskipTests -B -q

# ============================================================
# Stage 2: 使用 Eclipse Temurin 17 JRE 运行
# ============================================================
FROM eclipse-temurin:17-jre

WORKDIR /app

# 安装 curl 用于健康检查
RUN apt-get update -qq && apt-get install -y -qq curl && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制 JAR
COPY --from=build /build/target/*.jar ./app.jar

# 创建非 root 用户并切换
RUN groupadd -r ams && useradd -r -g ams ams && chown -R ams:ams /app
USER ams

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -sf http://localhost:8080/api/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
