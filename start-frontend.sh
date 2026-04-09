#!/bin/bash

echo "================================="
echo "  启动资产管理系统 - 前端"
echo "================================="

cd frontend

if [ ! -d "node_modules" ]; then
    echo "检测到依赖未安装,正在安装..."
    npm install
fi

echo ""
echo "启动Vite开发服务器..."
npm run dev
