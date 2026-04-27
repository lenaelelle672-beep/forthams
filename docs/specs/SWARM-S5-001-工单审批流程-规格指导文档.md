# 【SWARM-S5-001】工单审批流程 - 规格指导文档

## Iteration 1

---

## 1. 需求与背景

### 1.1 业务场景

某企业内部资产管理系统（AMS）需要实现完整的工单审批流程，覆盖从工单创建、提交审批、审批处理到最终归档的全生命周期管理。该系统服务于企业资产管理部门的审批人员、申请人和系统管理员。

### 1.2 核心功能需求

本次迭代（Iteration 1）聚焦于以下核心功能：

| 功能模块 | 功能描述 | 优先级 |
|----------|----------|--------|
| 前端审批页面 | 为审批人员提供直观的工单列表查看、详情浏览、一键审批/驳回操作界面 | P0 |
| 后端状态机 | 实现工单状态的精确流转控制，确保状态变更的合法性与可追溯性 | P0 |
| 通知机制 | 在关键状态变更时自动触发通知，触达相关干系人 | P1 |
| 审批历史追踪 | 完整记录审批操作的各项数据，支持审计回溯 | P1 |

### 1.3 技术栈约束

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | Vue 3 + TypeScript | 使用 Composition API |
| UI 组件库 | Element Plus | 企业级 Vue 3 组件库 |
| 前端路由 | Vue Router 4 | history 模式 |
| 状态管理 | Pinia | Vue 3 官方推荐状态管理 |
| 后端框架 | Python FastAPI / Java Spring | 混合架构 |
| 数据库 | PostgreSQL | 主数据存储 |
| 缓存层 | Redis | 热数据缓存、状态存储 |
| 状态机 | 自定义 StateMachine 类 | 基于 `backend/state_machine/workorder_state.py` |
| 通知系统 | EventPublisher | 事件发布订阅模式 |

### 1.4 业务规则

| 规则编号 | 规则描述 |
|----------|----------|
| BR-001 | 工单状态流转：`draft → pending → approving → approved/rejected → archived` |
| BR-002 | 审批权限：仅指定审批角色可执行审批操作，后端必须二次校验 |
| BR-003 | 驳回操作：需填写驳回原因，支持驳回至任意前置状态 |
| BR-004 | 并发控制：使用乐观锁机制，防止同一工单被并发审批 |
| BR-005 | 幂等性：重复提交同一操作应返回一致结果 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 划分总览

| Phase | 名称 | 目标 | 迭代次数 |
|-------|------|------|----------|
| Phase 1 | 基础设施层 (Foundation) | 构建数据模型与基础后端框架 | 1 |
| Phase 2 | 核心业务层 (Core Business) | 实现工单 CRUD 与状态流转逻辑 | 1-2 |
| Phase 3 | 前端交互层 (UI Layer) | 构建审批人员操作界面 | 2 |
| Phase 4 | 通知机制层 (Notification Layer) | 实现状态变更的自动通知 | 2 |

### 2.2 Iteration 1 实施目标

本次迭代为系统的基础搭建阶段，重点在于验证核心路径的打通。

#### Phase 1: 基础设施层 (Foundation)

**目标**：构建工单审批系统的数据模型与基础后端框架

| 任务项 | 具体内容 | 交付物 | 依赖文件 |
|--------|----------|--------|----------|
| 1.1 | 数据库表设计 | 工单主表、审批记录表、状态变更日志表 | `alembic/versions/001_create_workorder_tables.py` |
| 1.2 | 后端项目初始化 | FastAPI 项目结构、依赖配置 | `src/main.py` |
| 1.3 | 状态机基础实现 | State Machine 核心类定义 | `backend/state_machine/workorder_state.py` |
| 1.4 | 领域实体定义 | WorkOrder、ApprovalStage 等实体类 | `src/domain/entities/work_order.py` |

#### Phase 2: 核心业务层 (Core Business)

**目标**：实现工单 CRUD 与状态流转逻辑

| 任务项 | 具体内容 | 交付物 | 依赖文件 |
|--------|----------|--------|----------|
| 2.1 | 工单 CRUD API | 创建、查询、更新、删除接口 | `src/api/routers/workorder_router.py` |
| 2.2 | 状态流转引擎 | 状态机规则引擎、合法性校验 | `src/domain/state_machine/retirement_state_machine.py` |
| 2.3 | 审批记录持久化 | 审批动作与理由的存储 | `src/services/approval_service.py` |
| 2.4 | 审批服务实现 | 审批通过/驳回/退回逻辑 | `backend/services/approval_service.py` |

#### Phase 3: 前端交互层 (UI Layer)

**目标**：构建审批人员操作界面

| 任务项 | 具体内容 | 交付物 | 依赖文件 |
|--------|----------|--------|----------|
| 3.1 | 工单列表页 | 筛选、排序、分页列表展示 | `frontend/src/pages/WorkOrder/types/workOrder.ts` |
| 3.2 | 工单详情页 | 完整信息展示、审批历史时间线 | `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` |
| 3.3 | 审批操作面板 | 批准/驳回按钮、原因输入框 | `frontend/src/stores/approvalStore.ts` |
| 3.4 | 前端状态管理 | Pinia Store 实现 | `frontend/src/store/approvalStore.ts` |

#### Phase 4: 通知机制层 (Notification Layer)

**目标**：实现状态变更的自动通知

| 任务项 | 具体内容 | 交付物 | 依赖文件 |
|--------|----------|--------|----------|
| 4.1 | 通知事件定义 | 状态变更事件的 Event 类 | `src/notifications/events.py` |
| 4.2 | 事件发布器 | EventPublisher 实现 | `src/infrastructure/messaging/publisher.py` |
| 4.3 | 通知消费者 | NotificationConsumer 实现 | `src/infrastructure/messaging/consumers/notification_consumer.py` |
| 4.4 | 通知服务 | 站内通知发送逻辑 | `src/services/notification_service.py` |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 约束内容 | 备注 |
|--------|----------|------|
| 审批粒度 | 本次迭代仅实现单级审批，不支持多级审批链 | 多级审批链在后续迭代实现 |
| 通知渠道 | 仅实现站内通知，邮件通道作为扩展项待后续迭代 | 预留扩展接口 |
| 并发控制 | 使用乐观锁机制，防止同一工单被并发审批 | 依赖数据库行锁 |
| 数据隔离 | 多租户场景暂不考虑，单租户实现 | 预留 TenantContext |
| 附件功能 | 本次迭代不包含附件上传功能 | 后续迭代扩展 |
| 审批退回 | 仅支持驳回至 `draft` 或 `pending` 状态 | 不支持跨级退回 |

### 3.2 技术边界

| 约束项 | 约束内容 | 备注 |
|--------|----------|------|
| API 版本 | v1 固定为 `/api/v1/workorders/*` | 遵循 RESTful 规范 |
| 前端路由 | 使用 Vue Router 4，路由模式为 history | `frontend/router/index.ts` |
| 认证机制 | 本次迭代使用简化的 token 认证，不对接 SSO | `backend/src/main/java/com/ams/config/JwtAuthenticationFilter.java` |
| 缓存策略 | Redis 仅用于热点数据缓存，不作为主存储 | 数据最终持久化至 PostgreSQL |
| 日志规范 | 使用结构化日志，JSON 格式输出 | 便于 ELK 采集分析 |

### 3.3 性能约束

| 指标 | 目标值 | 说明 |
|------|--------|------|
| API 响应时间 (P95) | < 200ms | 单次 API 调用 |
| 列表查询响应时间 | < 500ms | 1000 条数据量 |
| 前端首屏加载时间 | < 2s | 包含首屏关键数据 |
| 状态变更延迟 | < 100ms | 状态写入到通知触发 |
| 并发审批处理 | 支持 50 QPS | 无锁冲突、数据一致 |

### 3.4 安全约束

| 约束项 | 约束内容 | 验证方式 |
|--------|----------|----------|
| 输入校验 | 所有 API 入参必须经过 Pydantic/Schema 校验 | `src/schemas/approval.py` |
| SQL 注入 | 使用 ORM 查询，禁止字符串拼接 SQL | SQLAlchemy ORM |
| XSS | 前端渲染用户输入必须做转义处理 | Vue 默认转义 |
| 审批权限 | 后端必须二次校验用户审批角色 | `backend/src/main/java/com/ams/service/ApprovalService.java` |
| CSRF | API 添加 CSRF Token 校验 | 中间件实现 |
| 敏感数据 | 密码、密钥等敏感信息加密存储 | AES-256 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试要求概述

所有测试用例需提供可执行的测试脚本，命名规范如下：

| 测试类型 | 脚本命名规范 | 测试框架 |
|----------|--------------|----------|
| 后端单元测试 | `test_<模块>_<功能点>.py` | pytest |
| 前端单元测试 | `<模块名>.test.ts` | Vitest |
| E2E 测试 | `<功能>.spec.ts` | Playwright |

### 4.2 数据库层测试 (DB)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| DB-001 | 工单表创建 | 执行 migrations 后，表结构符合 Schema 定义，字段完整 | `tests/backend/test_ticket_model.py` |
| DB-002 | 审批记录表创建 | 审批记录表字段完整，外键约束生效 | `tests/backend/test_ticket_api.py` |
| DB-003 | 状态变更日志表创建 | 日志表字段完整，变更时间自动记录 | `tests/unit/test_workorder_state_machine.py` |
| DB-004 | 索引创建验证 | 关键字段索引存在，查询性能符合预期 | `tests/backend/test_ticket_model.py` |

### 4.3 后端状态机测试 (SM)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| SM-001 | 合法状态流转 - draft→pending | 状态机返回成功，新状态为 `pending` | `tests/backend/test_state_machine.py` |
| SM-002 | 合法状态流转 - pending→approving | 审批人员接单后状态变更为 `approving` | `tests/backend/test_state_machine.py` |
| SM-003 | 合法状态流转 - approving→approved | 审批通过后状态变更为 `approved` | `tests/backend/test_state_machine.py` |
| SM-004 | 合法状态流转 - approving→rejected | 驳回操作成功，状态变更为 `rejected`，驳回原因已记录 | `tests/backend/test_state_machine.py` |
| SM-005 | 合法状态流转 - approved→archived | 归档操作后状态变更为 `archived`，进入终态 | `tests/backend/test_state_machine.py` |
| SM-006 | 非法状态流转 - archived→approving | 状态机拒绝非法流转，抛出 `StateTransitionException` | `tests/backend/test_state_machine.py` |
| SM-007 | 状态重复提交校验 | 同一状态重复提交返回错误码 `DUPLICATE_TRANSITION` | `tests/backend/test_ticket_api.py` |
| SM-008 | 审批权限校验 | 无审批权限用户调用审批接口返回 403 Forbidden | `tests/backend/test_approval_service.py` |

### 4.4 后端 API 测试 (API)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| API-001 | 创建工单 | POST `/api/v1/workorders` 返回 201，body 包含 `workorder_id` | `tests/backend/test_ticket_api.py` |
| API-002 | 查询工单列表 | GET `/api/v1/workorders` 返回分页数据，默认 20 条/页 | `tests/backend/test_ticket_api.py` |
| API-003 | 查询工单详情 | GET `/api/v1/workorders/{id}` 返回完整工单信息与审批历史 | `tests/backend/test_ticket_api.py` |
| API-004 | 提交审批 | POST `/api/v1/workorders/{id}/submit` 触发状态流转，返回 200 | `tests/api/test_work_order_submit.py` |
| API-005 | 执行审批 | POST `/api/v1/workorders/{id}/approve` 返回 200，工单状态更新 | `tests/api/test_work_order_approve.py` |
| API-006 | 执行驳回 | POST `/api/v1/workorders/{id}/reject` 返回 200，驳回原因已持久化 | `tests/api/test_work_order_reject.py` |
| API-007 | 参数校验失败 | 无效参数请求返回 422，响应体包含校验错误详情 | `tests/backend/test_ticket_api.py` |
| API-008 | 幂等性验证 | 相同操作重复请求返回相同结果，无副作用 | `tests/api/test_work_order_idempotent.py` |

### 4.5 前端 UI 测试 (UI)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| UI-001 | 工单列表页加载 | 页面加载完成，工单列表正确渲染，数据条目数与 API 一致 | `frontend/tests/e2e/approval.spec.ts` |
| UI-002 | 工单列表筛选 | 筛选条件变更后，列表数据正确过滤 | `frontend/tests/e2e/workorder_list.spec.ts` |
| UI-003 | 工单列表分页 | 切换页码后，正确显示对应页数据 | `frontend/tests/e2e/workorder_list.spec.ts` |
| UI-004 | 工单详情页跳转 | 点击工单行跳转至详情页，URL 包含工单 ID | `tests/e2e/test_workorder_workflow.spec.ts` |
| UI-005 | 审批操作 - 批准 | 点击批准按钮，工单状态变更为「已通过」，页面提示成功 | `frontend/tests/e2e/approval.spec.ts` |
| UI-006 | 审批操作 - 驳回 | 点击驳回按钮，弹出原因输入框，填写后提交成功 | `frontend/tests/e2e/approval.spec.ts` |
| UI-007 | 审批历史时间线 | 详情页正确渲染审批历史，按时间倒序排列 | `frontend/tests/unit/test_approval_chain.py` |
| UI-008 | 无权限状态隐藏 | 无审批权限用户界面不显示审批操作按钮 | `frontend/tests/unit/test_approval_chain.py` |
| UI-009 | Store 状态同步 | 审批操作后，Pinia Store 状态与后端数据一致 | `frontend/src/stores/approvalStore.test.ts` |

### 4.6 通知机制测试 (NOTIFY)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| NOTIFY-001 | 审批通过通知 | 状态变更为 `approved` 后，触发通知事件，日志记录发送 | `tests/backend/test_events.py` |
| NOTIFY-002 | 工单驳回通知 | 状态变更为 `rejected` 后，触发通知事件，包含驳回原因 | `tests/backend/test_events.py` |
| NOTIFY-003 | 工单提交通知 | 状态变更为 `pending` 后，触发通知事件，通知审批人 | `tests/backend/test_events.py` |
| NOTIFY-004 | 通知事件格式 | 事件 payload 包含工单 ID、变更前后状态、操作人、时间戳 | `tests/backend/test_events.py` |
| NOTIFY-005 | 事件发布异步性 | 通知事件异步发布，不阻塞主流程响应时间 | `tests/backend/test_events.py` |

### 4.7 集成测试 (INT)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| INT-001 | 完整审批流程 | 创建工单 → 提交审批 → 审批通过 → 状态归档，全流程成功 | `tests/e2e/test_workorder_workflow.spec.ts` |
| INT-002 | 完整驳回流程 | 创建工单 → 提交审批 → 驳回 → 修改重提 → 审批通过 | `tests/e2e/test_workorder_workflow.spec.ts` |
| INT-003 | 并发审批防护 | 两个并发审批请求仅一个成功，另一个返回 409 Conflict | `tests/concurrency/test_approve_race_condition.py` |
| INT-004 | 审批链路追溯 | 任意状态下可追溯完整的审批历史记录 | `tests/integration/test_approval_operations.py` |

### 4.8 验收通过标准

| 验收标准 | 要求 | 验证方式 |
|----------|------|----------|
| AC-001 | User Task 完成验证：前端审批页面、后端状态机与通知机制正常工作 | 集成测试通过 |
| AC-002 | AST 静态检查通过：代码变更不引入新的语法错误 | `scripts/ast_dead_code_check.py` |
| AC-003 | Docstring 覆盖：所有修改的函数包含完整的文档注释 | `tests/verify_docstring.test.ts` |
| AC-004 | 模块导入验证：变更后的模块可被正常 import，不抛出 ImportError | `tests/test_ac_004.py` |

---

## 5. 开发切入层级序列

### 5.1 开发顺序规划

```
Phase 1 (Foundation)
    │
    ├── Step 1.1: 数据库 Schema 设计 & migrations
    │       ├── 任务: 设计工单表、审批记录表、状态变更日志表
    │       ├── 输出: `alembic/versions/001_create_workorder_tables.py`
    │       └── 依赖: 无
    │
    ├── Step 1.2: 领域实体定义
    │       ├── 任务: 定义 WorkOrder、ApprovalStage 等核心实体
    │       ├── 输出: `src/domain/entities/work_order.py`
    │       └── 依赖: Step 1.1
    │
    ├── Step 1.3: 状态机核心类实现
    │       ├── 任务: 实现 StateMachine 类，具备状态流转能力
    │       ├── 输出: `backend/state_machine/workorder_state.py`
    │       └── 依赖: Step 1.2
    │
    └── Step 1.4: 后端项目骨架搭建
            ├── 任务: FastAPI 应用框架、依赖注入配置
            ├── 输出: `src/main.py`
            └── 依赖: Step 1.3

Phase 2 (Core Business)
    │
    ├── Step 2.1: 工单 CRUD API 实现
    │       ├── 任务: 实现工单创建、查询、更新、删除接口
    │       ├── 输出: `src/api/routers/workorder_router.py`
    │       └── 依赖: Step 1.4
    │
    ├── Step 2.2: 审批服务实现
    │       ├── 任务: 实现审批通过、驳回、退回逻辑
    │       ├── 输出: `backend/services/approval_service.py`
    │       └── 依赖: Step 1.3, 2.1
    │
    ├── Step 2.3: 状态流转引擎 & 权限校验
    │       ├── 任务: 状态机规则引擎、合法性校验、权限二次校验
    │       ├── 输出: `src/domain/state_machine/retirement_state_machine.py`
    │       └── 依赖: Step 1.3, 2.2
    │
    └── Step 2.4: 审批记录持久化
            ├── 任务: 审批动作与理由的存储、历史记录查询
            ├── 输出: `src/services/approval_service.py`
            └── 依赖: Step 2.2, 2.3

Phase 3 (UI Layer)
    │
    ├── Step 3.1: 工单列表页开发
    │       ├── 任务: 筛选、排序、分页列表展示
    │       ├── 输出: `frontend/src/pages/WorkOrder/types/workOrder.ts`
    │       └── 依赖: Step 2.1
    │
    ├── Step 3.2: 工单详情页开发
    │       ├── 任务: 完整信息展示、审批历史时间线
    │       ├── 输出: `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx`
    │       └── 依赖: Step 2.4, 3.1
    │
    ├── Step 3.3: 审批操作面板开发
    │       ├── 任务: 批准/驳回按钮、原因输入框
    │       ├── 输出: `frontend/src/stores/approvalStore.ts`
    │       └── 依赖: Step 2.3, 3.2
    │
    └── Step 3.4: 前端状态管理
            ├── 任务: Pinia Store 实现、API 集成
            ├── 输出: `frontend/src/store/approvalStore.ts`
            └── 依赖: Step 3.3

Phase 4 (Notification Layer)
    │
    ├── Step 4.1: 通知事件定义
    │       ├── 任务: 定义状态变更事件的 Event 类
    │       ├── 输出: `src/notifications/events.py`
    │       └── 依赖: Step 2.3
    │
    ├── Step 4.2: 事件发布器实现
    │       ├── 任务: EventPublisher 实现、事件总线搭建
    │       ├── 输出: `src/infrastructure/messaging/publisher.py`
    │       └── 依赖: Step 4.1
    │
    ├── Step 4.3: 通知消费者实现
    │       ├── 任务: NotificationConsumer 实现、消费逻辑
    │       ├── 输出: `src/infrastructure/messaging/consumers/notification_consumer.py`
    │       └── 依赖: Step 4.2
    │
    └── Step 4.4: 站内通知服务实现
            ├── 任务: 站内通知发送逻辑、消息模板
            ├── 输出: `src/services/notification_service.py`
            └── 依赖: Step 4.3

Phase 5 (Testing & Integration)
    │
    ├── Step 5.1: 后端单元测试 & 集成测试
    │       ├── 任务: 覆盖所有后端模块的测试用例
    │       ├── 输出: `tests/backend/`, `tests/unit/`
    │       └── 依赖: Phase 1, Phase 2
    │
    ├── Step 5.2: 前端 E2E 测试
    │       ├── 任务: 覆盖核心用户路径的端到端测试
    │       ├── 输出: `frontend/tests/e2e/`, `tests/e2e/`
    │       └── 依赖: Phase 3
    │
    └── Step 5.3: 通知机制测试
            ├── 任务: 事件发布、消费、通知发送全链路测试
            ├── 输出: `tests/backend/test_events.py`
            └── 依赖: Phase 4
```

### 5.2 关键技术决策点

| 决策点 | 方案选型 | 决策依据 | 影响文件 |
|--------|----------|----------|----------|
| 状态存储介质 | PostgreSQL + Redis 双写 | 热数据走 Redis 加速查询，冷数据持久化至 PG | `src/infrastructure/database/models.py` |
| 状态变更事件 | 观察者模式 + Async Event | 解耦通知逻辑，支持后续扩展消息队列 | `src/notifications/events.py` |
| 前端状态管理 | Pinia Store | 与 Vue 3 深度集成，TypeScript 支持良好 | `frontend/src/store/approvalStore.ts` |
| 权限校验层级 | 后端强制校验 + 前端路由守卫 | 双重保障，防止越权操作 | `backend/src/main/java/com/ams/service/ApprovalService.java` |
| 并发控制策略 | 乐观锁 + 重试机制 | 避免数据库行锁带来的性能损耗 | `tests/concurrency/test_approve_race_condition.py` |
| API 版本管理 | URL 路径版本控制 | 简单直观，便于网关路由配置 | `src/api/routers/workorder_router.py` |

### 5.3 依赖关系矩阵

| 模块 | 依赖模块 | 依赖类型 | 说明 |
|------|----------|----------|------|
| `backend/state_machine/workorder_state.py` | `backend/state_machine/machine.py` | 继承 | 状态机基类 |
| `src/domain/entities/work_order.py` | `src/domain/entities/approval_stage.py` | 组合 | 审批阶段聚合根 |
| `src/api/routers/workorder_router.py` | `src/services/workorder_service.py` | 调用 | 业务逻辑层 |
| `src/services/workorder_service.py` | `src/domain/state_machine/retirement_state_machine.py` | 调用 | 状态流转引擎 |
| `src/services/approval_service.py` | `src/notifications/events.py` | 发布事件 | 审批完成触发通知 |
| `frontend/src/stores/approvalStore.ts` | `frontend/src/api/approval.ts` | 调用 | API 层封装 |
| `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` | `frontend/src/stores/approvalStore.ts` | 注入 | 状态管理 |

---

## 附录 A: 状态机状态定义

### A.1 状态枚举定义

```python
# backend/state_machine/workorder_state.py

class WorkOrderState(str, Enum):
    """
    工单状态枚举
    
    状态流转图:
    draft → pending → approving → approved → archived
                           ↓
                       rejected → draft/pending
    """
    DRAFT = "draft"                      # 草稿/待提交
    PENDING = "pending"                  # 待审批
    APPROVING = "approving"              # 审批中
    APPROVED = "approved"                # 已通过
    REJECTED = "rejected"                # 已驳回
    ARCHIVED = "archived"                # 已归档
```

### A.2 状态流转矩阵

| 当前状态 | 允许目标状态 | 触发操作 | 触发条件 |
|----------|--------------|----------|----------|
| draft | pending | submit | 工单内容校验通过 |
| pending | approving | accept | 审批人员接单 |
| pending | approving | auto_assign | 系统自动分配审批人 |
| approving | approved | approve | 审批通过 |
| approving | rejected | reject | 审批驳回，需填写原因 |
| approving | pending | return | 退回给申请人修改 |
| approved | archived | archive | 工单完结归档 |
| rejected | draft | revise | 申请人修改后重新提交 |
| rejected | pending | resubmit | 直接重新提交审批 |

---

## 附录 B: API 接口定义

### B.1 工单相关接口

| 接口 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 创建工单 | POST | `/api/v1/workorders` | 创建新工单 |
| 查询工单列表 | GET | `/api/v1/workorders` | 分页查询工单列表 |
| 查询工单详情 | GET | `/api/v1/workorders/{id}` | 获取工单详情及审批历史 |
| 更新工单 | PUT | `/api/v1/workorders/{id}` | 更新工单内容 |
| 删除工单 | DELETE | `/api/v1/workorders/{id}` | 删除工单（仅草稿状态） |
| 提交审批 | POST | `/api/v1/workorders/{id}/submit` | 提交工单进入审批流程 |
| 审批接单 | POST | `/api/v1/workorders/{id}/accept` | 审批人员接单 |
| 审批通过 | POST | `/api/v1/workorders/{id}/approve` | 审批通过 |
| 审批驳回 | POST | `/api/v1/workorders/{id}/reject` | 审批驳回 |
| 审批退回 | POST | `/api/v1/workorders/{id}/return` | 退回申请人修改 |
| 工单归档 | POST | `/api/v1/workorders/{id}/archive` | 工单归档 |

### B.2 通知相关接口

| 接口 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 查询通知列表 | GET | `/api/v1/notifications` | 获取当前用户通知列表 |
| 标记已读 | PUT | `/api/v1/notifications/{id}/read` | 标记通知为已读 |
| 全部已读 | PUT | `/api/v1/notifications/read-all` | 标记全部通知为已读 |

---

## 附录 C: 错误码定义

| 错误码 | 错误类型 | HTTP 状态码 | 描述 |
|--------|----------|-------------|------|
| `WORKORDER_NOT_FOUND` | BusinessException | 404 | 工单不存在 |
| `INVALID_STATE_TRANSITION` | StateTransitionException | 400 | 非法的状态流转 |
| `DUPLICATE_TRANSITION` | BusinessException | 409 | 重复的状态操作 |
| `APPROVAL_PERMISSION_DENIED` | BusinessException | 403 | 无审批权限 |
| `REJECT_REASON_REQUIRED` | ValidationException | 400 | 驳回时必须填写原因 |
| `CONCURRENT_MODIFICATION` | ConcurrentModificationError | 409 | 并发修改冲突 |
| `VALIDATION_ERROR` | ValidationException | 422 | 参数校验失败 |

---

## 附录 D: 变更文件清单

### D.1 Iteration 1 必须修改的文件

| 序号 | 文件路径 | 修改内容 | 优先级 |
|------|----------|----------|--------|
| 1 | `frontend/tests/unit/test_approval_chain.py` | 补充审批链路测试用例 | P0 |
| 2 | `frontend/tests/e2e/approval.spec.ts` | E2E 审批流程测试 | P0 |
| 3 | `frontend/src/stores/approvalStore.test.ts` | Store 单元测试 | P0 |
| 4 | `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` | 审批详情卡片组件 | P0 |
| 5 | `tests/e2e/test_workorder_workflow.spec.ts` | 后端 E2E 工作流测试 | P0 |

### D.2 关联依赖文件（可能需要同步修改）

| 序号 | 文件路径 | 关联说明 |
|------|----------|----------|
| 6 | `backend/state_machine/workorder_state.py` | 状态枚举定义 |
| 7 | `backend/services/approval_service.py` | 审批服务实现 |
| 8 | `src/notifications/events.py` | 通知事件定义 |
| 9 | `frontend/src/store/approvalStore.ts` | 前端状态管理 |
| 10 | `frontend/src/api/approval.ts` | 审批 API 封装 |

---

**文档版本**: v1.0  
**创建日期**: Iteration 1  
**状态**: Draft - 待评审  
**维护责任人**: [待指定]  
**下次评审时间**: Iteration 1 结束时