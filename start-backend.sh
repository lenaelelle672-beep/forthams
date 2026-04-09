#!/bin/bash

echo "================================="
echo "  启动资产管理系统 - 后端"
echo "================================="

cd backend

echo "检查MySQL连接..."
mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ MySQL连接成功"
    echo "初始化数据库..."
    mysql -uroot -proot ams_db < docs/design/database_schema.sql 2>/dev/null
    echo "✅ 数据库初始化完成"
else
    echo "⚠️  MySQL连接失败,请确保MySQL已启动并配置正确"
    echo "  默认配置: host=localhost, port=3306, user=root, password=root"
    exit 1
fi

echo ""
echo "启动Spring Boot应用..."
mvn spring-boot:run
