# SWARM-001 工单审批流程系统 - 规格指导文档
**版本**: Iteration 1.0  
**状态**: 正式发布  
**最后更新**: 2024-XX-XX

---

## 需求与背景

### 业务场景

某企业需要一套标准化的工单审批流程系统，用于处理内部各类审批事项。本系统为资产管理系统（AMS）的核心子模块，支持以下业务流程：

1. **工单发起**：用户可在前端发起工单（如采购申请、费用报销、项目立项、资产退役等）
2. **审批流程**：审批人可对工单进行审批操作（通过/拒绝/退回）
3. **实时通知**：审批结果实时通知相关人员（通过 WebSocket/SSE 推送）
4. **状态追踪**：全流程状态透明化，可查询历史记录

### 现有痛点

| 痛点 | 现状 | 期望 |
|------|------|------|
| 流程不透明 | 口头审批，进度不可查 | 全程可追踪 |
| 通知滞后 | 审批完成后需人工电话通知 | 实时推送 |
| 状态混乱 | Excel 记录状态，人工维护易出错 | 状态机驱动 |
| 多端协作 | 仅支持 PC 端操作 | 前后端分离，支持多端 |
| 审计缺失 | 无操作记录，难以追溯 | 全链路操作日志 |

### 预期收益

- **审批周期缩短 40%**（通过实时通知与状态透明化）
- **流程合规性 100%**（状态机强制约束流转规则）
- **操作可审计性 100%**（全链路操作日志）
- **多端支持**（支持 PC/iOS/Android）

---

## 当前 Phase 对应实施目标

### Phase 拆解总览

```
SWARM-001 工单审批流程系统
│
├── Phase 1: 核心状态机与工单基础 CRUD（本次 Iteration 目标）
│   ├── 工单实体建模
│   ├── 状态机设计与实现
│   ├── 工单创建 API
│   ├── 工单查询/详情 API
│   ├── 审批链模型（ApprovalChain, ApprovalStep）
│   ├── 通知服务骨架（NotificationPublisher）
│   └── 审计日志基础设施（AuditLogStorage）
│
├── Phase 2: 审批流程与角色权限
│   ├── 审批人指定规则
│   ├── 审批操作 API（通过/拒绝/退回）
│   ├── 审批历史记录
│   └── 权限验证与 JWT 集成
│
├── Phase 3: 实时通知系统
│   ├── WebSocket/SSE 服务端实现
│   ├── 客户端订阅机制
│   ├── 通知模板与分发
│   └── Redis Pub/Sub 集成
│
└── Phase 4: 前端完整交互与优化
    ├── 工单发起页面
    ├── 审批工作台
    ├── 通知展示组件
    └── 移动端适配
```

### Phase 1 具体实施范围

| 模块 | 功能点 | 优先级 | 交付文件 |
|------|--------|--------|----------|
| 后端-模型层 | Ticket 模型定义（字段、类型、约束） | P0 | `src/models/approval_chain.py` |
| 后端-状态机 | 状态定义、合法转换规则、转换验证 | P0 | `src/state_machine/approval_state_machine.py` |
| 后端-API | POST /api/tickets 创建工单 | P0 | `src/api/routers/retirement_router.py` |
| 后端-API | GET /api/tickets/{id} 查询工单 | P0 | `src/api/routers/retirement_router.py` |
| 后端-API | GET /api/tickets 列表查询（分页/筛选） | P1 | `src/api/routers/retirement_router.py` |
| 通知-骨架 | 状态变更事件发布机制 | P0 | `src/services/notification_service.py` |
| 审计-骨架 | 审计日志记录 | P0 | `src/api/middleware/audit_logger.py` |
| 前端-Store | 工单状态管理 | P1 | `frontend/src/stores/approvalStore.ts` |
| 前端-Router | 工单路由配置 | P1 | `frontend/src/router/approval.ts` |
| 前端-测试 | E2E 测试覆盖 | P1 | `frontend/tests/e2e/approval.spec.ts` |
| 前端-单元 | Service 单元测试 | P1 | `frontend/src/services/approvalService.test.ts` |
| 类型定义 | TypeScript 类型扩展 | P1 | `frontend/src/types/asset.types.ts` |

### Phase 1 交付物清单

#### 后端交付物

- [x] `src/models/approval_chain.py` - 审批链模型（ApprovalChain, ApprovalStep, Node, Edge）
- [x] `src/models/asset_retirement.py` - 资产退役模型（AssetRetirementRequest）
- [x] `src/state_machine/approval_state_machine.py` - 审批状态机核心
- [x] `src/state_machine/retirement_state_machine.py` - 退役状态机
- [x] `src/services/approval_chain_service.py` - 审批链服务
- [x] `src/services/approval_service.py` - 审批服务
- [x] `src/services/retirement_service.py` - 退役服务（含状态转换逻辑）
- [x] `src/services/notification_service.py` - 通知服务（NotificationPublisher, RedisPublisher）
- [x] `src/api/routers/retirement_router.py` - RESTful API 端点
- [x] `src/api/middleware/audit_logger.py` - 审计日志中间件
- [x] `src/services/field_mapping_engine.py` - 字段映射引擎
- [ ] `tests/backend/test_ticket_crud.py` - CRUD 单元测试（待创建）
- [ ] `tests/backend/test_state_machine.py` - 状态机测试（待创建）

#### 前端交付物

- [ ] `frontend/src/stores/approvalStore.ts` - 工单状态管理（待修改）
- [ ] `frontend/src/router/approval.ts` - 工单路由配置（待修改）
- [ ] `frontend/tests/e2e/approval.spec.ts` - E2E 测试（待修改）
- [ ] `frontend/src/services/approvalService.test.ts` - Service 单元测试（待修改）
- [ ] `frontend/src/types/asset.types.ts` - 类型定义扩展（待修改）

---

## 边界约束

### 功能边界

| 约束项 | 说明 | 归属 Phase |
|--------|------|------------|
| 本次不含复杂审批流程 | 仅支持单级线性审批，Phase 2 支持多级审批 | Phase 2 |
| 本次不含实时推送 | 仅预留事件发布接口，Phase 3 实现 WebSocket/SSE | Phase 3 |
| 本次不含附件上传 | 文件上传功能不在本次范围内 | 待定 |
| 本次不含批量审批 | 仅支持单工单逐个审批 | Phase 2 |
| 本次不含审批代理 | 审批权限不可委托 | Phase 2 |
| 本次不含催办功能 | 审批超时提醒 | Phase 3 |

### 技术约束

| 约束项 | 具体要求 | 备注 |
|--------|----------|------|
| 后端框架 | Python FastAPI | 异步优先 |
| 数据库 | PostgreSQL 13+ / SQLite（开发环境） | ORM: SQLAlchemy 2.0 |
| 状态机库 | 自实现状态机 + `transitions` 库 | 见 `src/state_machine/` |
| 消息队列 | Redis Pub/Sub（预留） | Phase 3 实现 |
| 前端框架 | Vue 3 + TypeScript | Composition API |
| UI 组件库 | shadcn-vue / Ant Design Vue | 待选定 |
| 状态管理 | Pinia | `approvalStore.ts` |
| API 风格 | RESTful，JSON 格式 | JWT Bearer Token |
| 测试框架 | pytest（后端）、Playwright（E2E）、Vitest（前端单元） | - |

### 非功能约束

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| API 响应时间 | P95 < 200ms | Prometheus metrics |
| 并发支持 | 100 QPS | locust 压测 |
| 可用性 | 99.9% | 季度 SLA |
| 代码覆盖率 | 后端 > 80%，前端 > 70% | pytest-cov / Vitest coverage |
| 安全性 | OWASP Top 10 合规 | 安全扫描 |

---

## 验收测试基准 (ATB)

### ATB-1: 工单创建功能

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-1.1 | 正常创建工单 | 用户已登录，获取有效 JWT | POST /api/tickets with payload | 返回 201，body 含 id, status="DRAFT" | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_create_ticket_success` |
| ATB-1.2 | 必填字段缺失 | 无 | POST /api/tickets without title | 返回 422，body 含 validation error | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_create_ticket_validation_error` |
| ATB-1.3 | 未授权创建 | 无 token | POST /api/tickets | 返回 401 | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_create_ticket_unauthorized` |
| ATB-1.4 | 创建资产退役工单 | 用户已登录 | POST /api/retirement with asset_id | 返回 201，工单状态为 PENDING_APPROVAL | 集成测试 | `pytest tests/api/test_retirement_api.py::test_create_retirement_request` |

### ATB-2: 工单查询功能

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-2.1 | 按 ID 查询详情 | 存在工单 ID=1 | GET /api/tickets/1 | 返回 200，body 含完整工单信息 | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_get_ticket_by_id` |
| ATB-2.2 | 查询不存在的工单 | 无 ID=999 | GET /api/tickets/999 | 返回 404 | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_get_ticket_not_found` |
| ATB-2.3 | 列表分页查询 | 数据库有 >10 条工单 | GET /api/tickets?page=1&page_size=10 | 返回 200，body 含 items, total, page | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_list_tickets_pagination` |
| ATB-2.4 | 按状态筛选 | 数据库有 DRAFT 和 SUBMITTED 工单 | GET /api/tickets?status=DRAFT | 返回 200，items 全为 DRAFT 状态 | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_list_tickets_filter_by_status` |
| ATB-2.5 | 按申请人筛选 | 数据库有多个申请人的工单 | GET /api/tickets?creator_id={uuid} | 返回 200，仅返回该申请人的工单 | 单元测试 | `pytest tests/backend/test_ticket_crud.py::test_list_tickets_filter_by_creator` |

### ATB-3: 状态机核心

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-3.1 | 合法状态转换-Draft to Submitted | 工单状态=DRAFT | 调用 `state_machine.submit(order_id)` | 状态变更为 SUBMITTED，无异常 | 单元测试 | `pytest tests/state_machine/test_retirement_sm.py::test_valid_transition_draft_to_submitted` |
| ATB-3.2 | 非法状态转换-Submitted to Submitted | 工单状态=SUBMITTED | 调用 `state_machine.submit(order_id)` | 抛出 `InvalidStateTransitionError` | 单元测试 | `pytest tests/state_machine/test_retirement_sm.py::test_invalid_transition_submitted_to_submitted` |
| ATB-3.3 | 状态转换规则完整性 | 枚举所有状态 | 尝试所有可能的状态对 | 仅允许的状态对成功，其余拒绝 | 单元测试 | `pytest tests/state_machine/test_retirement_sm.py::test_all_valid_transitions` |
| ATB-3.4 | 状态转换触发事件 | EventBus 已注册监听器 | 触发状态转换 | 监听器收到 "ticket.status.changed" 事件 | 单元测试 | `pytest tests/services/test_retirement_service.py::test_state_change_publishes_event` |
| ATB-3.5 | 退役状态机-完整流程 | 工单状态=PENDING_APPROVAL | 依次调用 approve() -> retire() -> dispose() | 状态依次变更，最终为 DISPOSED | 集成测试 | `pytest tests/services/test_retirement_service.py::test_full_retirement_flow` |

### ATB-4: 通知服务骨架

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-4.1 | 审批通过通知发布 | NotificationPublisher 已初始化 | 调用 `publisher.publish_approval(request_id, result)` | 事件包含 request_id, action="APPROVED" | 单元测试 | `pytest tests/services/test_notification_service.py::test_publish_approval_notification` |
| ATB-4.2 | 审批拒绝通知发布 | NotificationPublisher 已初始化 | 调用 `publisher.publish_rejection(request_id, reason)` | 事件包含 request_id, action="REJECTED" | 单元测试 | `pytest tests/services/test_notification_service.py::test_publish_rejection_notification` |
| ATB-4.3 | 事件负载结构验证 | 无 | 触发任意通知发布 | payload 包含 timestamp, request_id, action, actor_id | 单元测试 | `pytest tests/services/test_notification_service.py::test_notification_payload_structure` |
| ATB-4.4 | Redis Publisher 集成 | Redis 服务可用 | 调用 `RedisPublisher.publish(event)` | Redis channel 收到消息 | 集成测试 | `pytest tests/services/test_notification_service.py::test_redis_publisher_integration` |

### ATB-5: 审计日志

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-5.1 | 操作审计记录 | AuditLogStorage 已初始化 | 执行任意状态转换 | 数据库含对应审计日志记录 | 单元测试 | `pytest tests/test_audit_aspect.py::test_operation_audit_logged` |
| ATB-5.2 | 审计日志字段完整性 | 无 | 执行 retire() 操作 | 日志包含 actor_id, action, old_status, new_status, timestamp | 单元测试 | `pytest tests/test_audit_aspect.py::test_audit_log_fields` |
| ATB-5.3 | 退役专项审计 | RetirementAuditLogger 已初始化 | 执行 retire() -> dispose() | 退役流程审计日志链完整 | 单元测试 | `pytest tests/test_audit_aspect.py::test_retirement_audit_chain` |

### ATB-6: 前端展示与交互

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-6.1 | 工单列表页面渲染 | 后端 API 可用 | 访问 /tickets 页面 | 页面显示工单列表，无 JS 错误 | E2E 测试 | `npx playwright test tests/frontend/ticket-list.spec.ts` |
| ATB-6.2 | 工单列表分页交互 | 列表页加载完成 | 点击"下一页"按钮 | 列表更新为第二页数据 | E2E 测试 | `npx playwright test tests/frontend/ticket-list.spec.ts --grep "pagination"` |
| ATB-6.3 | 工单详情页渲染 | 存在工单 ID=1 | 访问 /tickets/1 | 页面显示工单完整信息，状态正确展示 | E2E 测试 | `npx playwright test tests/frontend/ticket-detail.spec.ts` |
| ATB-6.4 | Store 状态管理 | Vitest 环境 | 调用 approvalStore.submitForApproval() | Store 状态正确更新，API 调用正确 | 单元测试 | `npx vitest run frontend/src/stores/approvalStore.test.ts` |
| ATB-6.5 | Service 层测试覆盖 | Vitest 环境 | 运行 approvalService 测试 | 测试覆盖 submitForApproval, getApprovalChain 等方法 | 单元测试 | `npx vitest run frontend/src/services/approvalService.test.ts` |

### ATB-7: API 端点集成

| 测试编号 | 测试描述 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 | 物理测试命令 |
|----------|----------|----------|----------|----------|----------|--------------|
| ATB-7.1 | 审批操作 API | 工单状态=SUBMITTED，审批人已授权 | POST /api/retirement/{id}/approve | 返回 200，工单状态变更为 APPROVED | 集成测试 | `pytest tests/api/test_approval_api.py::test_approve_retirement` |
| ATB-7.2 | 拒绝操作 API | 工单状态=SUBMITTED | POST /api/retirement/{id}/reject | 返回 200，工单状态变更为 REJECTED | 集成测试 | `pytest tests/api/test_approval_api.py::test_reject_retirement` |
| ATB-7.3 | 数据脱敏验证 | 无 | GET /api/tickets（任意） | 返回数据不含敏感字段（password, token） | 安全测试 | `pytest tests/api/test_data_masking.py::test_sensitive_data_masked` |

---

## 开发切入层级序列

### 层级架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 5: 前端交互层                   │
│         (Vue 页面组件、Playwright E2E 测试)               │
│   Components: approvalStore.ts, router/approval.ts       │
├─────────────────────────────────────────────────────────┤
│                    Layer 4: API 网关层                   │
│         (FastAPI Routes、Request Validation)             │
│   File: src/api/routers/retirement_router.py            │
├─────────────────────────────────────────────────────────┤
│                    Layer 3: 业务逻辑层                   │
│         (Service 层、状态机、事务管理)                    │
│   Files: approval_service.py, retirement_service.py,    │
│          notification_service.py                        │
├─────────────────────────────────────────────────────────┤
│                    Layer 2: 数据访问层                   │
│         (SQLAlchemy ORM、Repository 模式)                │
│   Files: src/models/approval_chain.py,                  │
│          src/models/asset_retirement.py                │
├─────────────────────────────────────────────────────────┤
│                    Layer 1: 基础设施层                   │
│      (数据库连接、EventBus、配置管理、日志)               │
│   Files: audit_logger.py, field_mapping_engine.py       │
└─────────────────────────────────────────────────────────┘
```

### 详细开发序列

#### Phase 1 实施顺序（4 周迭代）

```
Week 1: 基础设施与数据层
│
├── 1.1 数据库模型定义
│   └── src/models/approval_chain.py
│       - ApprovalChain
│       - ApprovalStep
│       - Node
│       - Edge
│
├── 1.2 资产退役模型
│   └── src/models/asset_retirement.py
│       - AssetRetirementRequest
│       - RetirementStatus enum
│
├── 1.3 字段映射引擎
│   └── src/services/field_mapping_engine.py
│       - FieldMappingEngine
│       - field_to_approval_mapping()
│
└── 1.4 单元测试
    └── tests/test_entity_binding.py

Week 2: 业务逻辑与状态机
│
├── 2.1 审批状态机
│   └── src/state_machine/approval_state_machine.py
│       - ApprovalStateMachine
│       - valid_transitions 规则
│
├── 2.2 退役状态机
│   └── src/state_machine/retirement_state_machine.py
│       - RetirementStateMachine
│       - PENDING_APPROVAL → APPROVED → RETIRED → DISPOSED
│
├── 2.3 审批链服务
│   └── src/services/approval_chain_service.py
│       - get_approval_chain()
│       - get_current_step()
│
├── 2.4 审批服务
│   └── src/services/approval_service.py
│       - submit_for_approval()
│       - approve()
│       - reject()
│
├── 2.5 退役服务
│   └── src/services/retirement_service.py
│       - create_retirement_request()
│       - transition()
│       - approve(), reject(), dispose()
│
└── 2.6 单元测试
    ├── tests/state_machine/test_retirement_sm.py
    └── tests/services/test_retirement_service.py

Week 3: API 层与集成测试
│
├── 3.1 API 路由实现
│   └── src/api/routers/retirement_router.py
│       - POST /api/retirement
│       - GET /api/retirement/{id}
│       - POST /api/retirement/{id}/approve
│       - POST /api/retirement/{id}/reject
│       - POST /api/retirement/{id}/dispose
│
├── 3.2 审计日志中间件
│   └── src/api/middleware/audit_logger.py
│       - AuditLogStorage
│       - RetirementAuditLogger
│       - audit_logging_middleware
│
├── 3.3 通知服务骨架
│   └── src/services/notification_service.py
│       - NotificationPublisher
│       - RedisPublisher
│       - publish_approval()
│       - publish_rejection()
│
├── 3.4 认证依赖
│   └── src/api/deps/auth.py
│       - get_current_user()
│       - get_current_user_id()
│
└── 3.5 集成测试
    ├── tests/api/test_retirement_api.py
    ├── tests/api/test_approval_api.py
    └── tests/test_audit_aspect.py

Week 4: 前端实现与 E2E 测试
│
├── 4.1 前端 Store
│   └── frontend/src/stores/approvalStore.ts
│       - submitForApproval()
│       - loadApprovalChain()
│       - 状态管理逻辑
│
├── 4.2 前端 Router
│   └── frontend/src/router/approval.ts
│       - /tickets 列表路由
│       - /tickets/:id 详情路由
│       - /approval 工作台路由
│
├── 4.3 TypeScript 类型
│   └── frontend/src/types/asset.types.ts
│       - 添加 ApprovalChain 相关类型
│       - RetirementRequest 接口
│
├── 4.4 前端 Service 测试
│   └── frontend/src/services/approvalService.test.ts
│       - submitForApproval 测试
│       - getApprovalChain 测试
│
├── 4.5 E2E 测试
│   └── frontend/tests/e2e/approval.spec.ts
│       - 工单列表加载测试
│       - 工单详情展示测试
│       - 提交审批流程测试
│
└── 4.6 类型检查
    └── npx tsc --noEmit (全量通过)
```

### 依赖关系图

```
┌─────────────────┐
│   数据库/Redis  │  ← 基础设施
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Models Layer   │  ← approval_chain.py, asset_retirement.py
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ State Machines  │  ← approval_state_machine.py, retirement_state_machine.py
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Services Layer │  ← approval_service.py, retirement_service.py,
│                 │    notification_service.py, field_mapping_engine.py
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Audit Middle.  │  ← audit_logger.py
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   API Routes    │  ← retirement_router.py
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Auth Deps      │  ← auth.py
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend Store  │  ← approvalStore.ts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Frontend UI    │  ← Vue Components
└─────────────────┘
```

### 关键路径（Critical Path）

```
Phase 1 关键路径 (M1 → M2 → M3 → M4 → M5):

M1: 数据层就绪
    └─→ approval_chain.py + asset_retirement.py + field_mapping_engine.py
    └─→ ATB-2.x 通过

M2: 状态机就绪
    └─→ retirement_state_machine.py + approval_state_machine.py
    └─→ ATB-3.x 通过

M3: 服务层就绪
    └─→ retirement_service.py + approval_service.py
    └─→ ATB-4.x, ATB-5.x 通过

M4: API 就绪
    └─→ retirement_router.py + audit_logger.py
    └─→ ATB-7.x 通过

M5: 前端就绪
    └─→ approvalStore.ts + router/approval.ts
    └─→ ATB-6.x 通过

最终交付: 所有 ATB 测试通过 → Phase 1 完成
```

### 里程碑定义

| 里程碑 | 完成标准 | 对应交付物 | ATB 覆盖 |
|--------|----------|------------|----------|
| M1: 数据层就绪 | 模型定义完成，迁移成功 | `approval_chain.py`, `asset_retirement.py` | ATB-2.1~2.5 |
| M2: 状态机就绪 | 状态机测试 100% 通过 | `retirement_state_machine.py`, `test_retirement_sm.py` | ATB-3.1~3.5 |
| M3: 服务层就绪 | 服务层测试覆盖 >80% | `retirement_service.py`, `test_retirement_service.py` | ATB-4.x, ATB-5.x |
| M4: API 就绪 | API 集成测试 100% 通过 | `retirement_router.py`, `test_approval_api.py` | ATB-7.1~7.3 |
| M5: 前端就绪 | E2E 测试 100% 通过，所有 AC 满足 | `approvalStore.ts`, `approval.spec.ts` | ATB-6.1~6.5 |
| **M6: Phase 1 交付** | **所有 ATB 测试通过** | **完整系统可通过 `docker-compose up` 启动** | **ATB-1~7 全部** |

---

## 附录

### A. 工单状态流转图（资产退役场景）

```
                              ┌─────────────────┐
                              │                 │
         create_request()     │  PENDING_APPROVAL│◄─────────────┐
      ──────────────────────► │                 │              │
                              └────────┬────────┘              │
                                       │                        │
                         ┌─────────────┴─────────────┐          │
                         │                           │          │
                    reject()                      approve()     │ resubmit()
                         │                           │          │ (Phase 2)
                         ▼                           ▼          │
               ┌─────────────────┐         ┌─────────────────┐  │
               │                 │         │                 │  │
               │    REJECTED     │         │    APPROVED     │  │
               │                 │         │                 │  │
               └─────────────────┘         └────────┬────────┘  │
                                                     │            │
                                                     │ retire()   │
                                                     ▼            │
                                           ┌─────────────────┐    │
                                           │                 │    │
                                           │     RETIRED     │────┘
                                           │                 │
                                           └────────┬────────┘
                                                    │
                                                    │ dispose()
                                                    ▼
                                          ┌─────────────────┐
                                          │                 │
                                          │    DISPOSED     │
                                          │                 │
                                          └─────────────────┘
```

### B. 审批状态机（通用工单场景）

```
┌─────────┐   submit()   ┌──────────────┐
│  DRAFT  │─────────────►│   SUBMITTED  │
└─────────┘              └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
         reject()           approve()          return()
              │                 │                 │
              ▼                 ▼                 ▼
       ┌──────────┐      ┌──────────┐      ┌──────────┐
       │          │      │          │      │          │
       │ REJECTED │      │ APPROVED │      │ RETURNED │
       │          │      │          │      │          │
       └──────────┘      └──────────┘      └────┬─────┘
                                                 │
                                            resubmit()
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   SUBMITTED  │
                                          └──────────────┘
```

### C. 数据模型字段定义

#### AssetRetirementRequest

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK | 主键 |
| asset_id | UUID | NOT NULL, FK | 关联资产 ID |
| status | Enum | NOT NULL | 当前状态 |
| reason | TEXT | NOT NULL | 退役原因 |
| estimated_value | DECIMAL | NULLABLE | 预估残值 |
| actual_value | DECIMAL | NULLABLE | 实际残值 |
| disposal_method | Enum | NULLABLE | 处置方式 |
| applicant_id | UUID | NOT NULL, FK | 申请人 ID |
| approver_id | UUID | NULLABLE, FK | 审批人 ID |
| approved_at | TIMESTAMP | NULLABLE | 审批时间 |
| retired_at | TIMESTAMP | NULLABLE | 退役时间 |
| disposed_at | TIMESTAMP | NULLABLE | 处置时间 |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

#### ApprovalChain

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK | 主键 |
| name | VARCHAR(255) | NOT NULL | 审批链名称 |
| description | TEXT | NULLABLE | 描述 |
| chain_type | Enum | NOT NULL | 链类型 |
| nodes | JSON | NOT NULL | 节点配置 |
| edges | JSON | NOT NULL | 边配置 |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | 是否启用 |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

#### ApprovalStep

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | UUID | PK | 主键 |
| chain_id | UUID | FK | 关联审批链 ID |
| step_order | INT | NOT NULL | 步骤顺序 |
| step_type | Enum | NOT NULL | 步骤类型 |
| approver_type | Enum | NOT NULL | 审批人类型 |
| approver_id | UUID | NULLABLE | 审批人 ID |
| approver_role | VARCHAR(100) | NULLABLE | 审批人角色 |
| timeout_hours | INT | NULLABLE | 超时时间 |
| auto_approve | BOOLEAN | DEFAULT FALSE | 自动审批 |

### D. API 端点清单（Phase 1）

| 方法 | 路径 | 描述 | 状态码 | 对应 ATB |
|------|------|------|--------|----------|
| POST | /api/retirement | 创建资产退役工单 | 201 | ATB-1.4 |
| GET | /api/retirement | 列表查询（分页+筛选） | 200 | ATB-2.3~2.5 |
| GET | /api/retirement/{id} | 详情查询 | 200 / 404 | ATB-2.1~2.2 |
| POST | /api/retirement/{id}/approve | 审批通过 | 200 | ATB-7.1 |
| POST | /api/retirement/{id}/reject | 审批拒绝 | 200 | ATB-7.2 |
| POST | /api/retirement/{id}/dispose | 资产处置 | 200 | - |
| GET | /api/retirement/{id}/progress | 进度查询 | 200 | - |
| GET | /api/retirement/{id}/history | 历史记录 | 200 | ATB-5.1 |

### E. 事件类型定义

```python
class TicketEvent(BaseModel):
    """工单事件负载结构"""
    event_id: str           # 事件唯一ID
    event_type: str         # 事件类型
    ticket_id: str           # 工单ID
    ticket_type: str         # 工单类型
    actor_id: str            # 操作人ID
    actor_name: str          # 操作人名称
    action: str              # 操作动作
    old_status: Optional[str] = None  # 原状态
    new_status: str          # 新状态
    timestamp: datetime      # 事件时间
    metadata: dict = {}      # 额外元数据


# 事件类型枚举
class TicketEventType(str, Enum):
    TICKET_CREATED = "ticket.created"
    TICKET_SUBMITTED = "ticket.submitted"
    TICKET_APPROVED = "ticket.approved"
    TICKET_REJECTED = "ticket.rejected"
    TICKET_RETURNED = "ticket.returned"
    TICKET_RETIRED = "ticket.retired"
    TICKET_DISPOSED = "ticket.disposed"
    TICKET_STATUS_CHANGED = "ticket.status.changed"
```

### F. 错误码定义

| 错误码 | 错误类型 | HTTP 状态码 | 说明 |
|--------|----------|-------------|------|
| TICKET_NOT_FOUND | ResourceNotFoundError | 404 | 工单不存在 |
| INVALID_STATE_TRANSITION | InvalidStateTransitionError | 400 | 非法状态转换 |
| VERSION_CONFLICT | VersionConflictError | 409 | 版本冲突 |
| UNAUTHORIZED_APPROVAL | UnauthorizedError | 403 | 无审批权限 |
| APPROVAL_CHAIN_NOT_FOUND | ResourceNotFoundError | 404 | 审批链不存在 |
| VALIDATION_ERROR | ValidationError | 422 | 请求参数校验失败 |

---

**文档版本历史**

| 版本 | 日期 | 变更说明 | 作者 |
|------|------|----------|------|
| 1.0 | 2024-XX-XX | 初始版本，定义 Phase 1 范围与 ATB | - |

---

## 评审意见（AC Criteria 审核）

```
✅ AC-001: User Task 范围明确，包含后端状态机、前端审批页面、实时通知
✅ AC-002: 代码变更通过 AST 静态检查（Python ast + TypeScript tsc --noEmit）
✅ AC-003: 所有修改的函数包含 docstring 文档注释（验证命令: pytest tests/test_docstring_coverage.py）
✅ AC-004: 变更后的模块可被正常 import（验证命令: pytest tests/test_ac_004.py）
```