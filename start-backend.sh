#!/bin/bash
#
# =============================================================================
# 启动资产管理系统 - 后端
#
# 必需环境变量:
#   DB_PASSWORD  — MySQL 数据库密码
#   JWT_SECRET   — JWT 签名密钥（生产环境请使用足够长的随机字符串）
#
# 可选环境变量:
#   DB_URL                默认: jdbc:mysql://localhost:3306/ams_db
#   DB_USERNAME           默认: root
#   JWT_EXPIRATION        默认: 86400000 (24小时)
#   CORS_ALLOWED_ORIGINS  默认: http://localhost:5173
#
# 用法示例:
#   DB_PASSWORD=my_pass JWT_SECRET=my_secret ./start-backend.sh
# =============================================================================

echo "================================="
echo "  启动资产管理系统 - 后端"
echo "================================="

cd backend

# 检查必需环境变量
if [ -z "${DB_PASSWORD}" ]; then
    echo "❌ 错误: 环境变量 DB_PASSWORD 未设置"
    echo "  请通过环境变量设置密码: export DB_PASSWORD=your_mysql_password"
    echo "  用法: DB_PASSWORD=your_pass JWT_SECRET=your_secret ./start-backend.sh"
    exit 1
fi

if [ -z "${JWT_SECRET}" ]; then
    echo "❌ 错误: 环境变量 JWT_SECRET 未设置"
    echo "  请设置 JWT 签名密钥: export JWT_SECRET=your_jwt_secret"
    echo "  用法: DB_PASSWORD=your_pass JWT_SECRET=your_secret ./start-backend.sh"
    exit 1
fi

echo "检查MySQL连接..."
mysql -uroot -p"${DB_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ MySQL连接成功"
    echo "初始化数据库..."
    mysql -uroot -p"${DB_PASSWORD}" ams_db < src/main/resources/schema.sql 2>/dev/null
    echo "✅ 数据库初始化完成"
else
    echo "⚠️  MySQL连接失败,请确保MySQL已启动并配置正确"
    echo "  配置: host=localhost, port=3306, user=root, password=\$DB_PASSWORD"
    exit 1
fi

echo ""
echo "启动Spring Boot应用..."
mvn spring-boot:run
