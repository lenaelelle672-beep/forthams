# 企业资产管理系统 (Asset Management System)

## 项目简介

这是一个功能完整的企业资产管理系统，涵盖资产全生命周期管理的核心功能。

## 技术栈

### 前端
- React 18.3.1
- React Router 7
- Tailwind CSS v4
- TypeScript
- Vite

### 后端
- Java 17+
- Spring Boot 3.x
- MySQL 8.0
- MyBatis-Plus
- Spring Security + JWT

## 项目结构

```
forthAMS/
├── frontend/          # 前端项目
├── backend/           # 后端项目
├── docs/             # 文档
│   ├── design/       # 设计文档
│   ├── api/          # API接口文档
│   └── figma/        # 前端原型
└── README.md
```

## 核心功能模块

### 1. 资产台账管理
- 资产信息录入、查询、修改、删除
- 资产分类管理
- 资产变更历史追溯
- 批量导入导出

### 2. 重要设备管理
- 设备维护保养记录
- 智能保养提醒
- 设备使用率监控
- 保养计划管理

### 3. RFID资产盘点
- 盘点任务创建
- RFID批量扫描
- 账实差异处理
- 盘点报告生成

### 4. 闲置资产管理
- 闲置资产识别
- 闲置公告发布
- 资产认领流程
- 处置记录管理

### 5. 资产赔偿管理
- 赔偿申请创建
- 赔偿审批流程
- 赔偿统计分析

### 6. 审批流程管理
- 多级审批流程
- 工单管理
- 审批历史追溯

### 7. 数据统计分析
- 资产价值趋势
- 资产分类分布
- 部门资产统计
- 维护费用分析

### 8. 系统设置
- 用户管理
- 角色权限
- 部门管理
- 系统集成配置

## 快速开始

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

访问: http://localhost:5173

### 后端启动

```bash
cd backend
mvn spring-boot:run
```

访问: http://localhost:8080

## 开发计划

### Phase 1 (当前)
- [x] 项目结构初始化
- [ ] 后端基础搭建
- [ ] 数据库设计
- [ ] 前端集成
- [ ] 用户认证模块
- [ ] 资产台账核心功能

### Phase 2 (计划中)
- RFID盘点模块增强
- 流程设计器集成
- 高级数据分析
- 移动端支持

## 开发者

- OpenClaw GAI Workflow

## 许可证

MIT License
