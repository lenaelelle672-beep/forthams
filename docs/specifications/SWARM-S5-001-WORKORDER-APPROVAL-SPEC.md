# 【SWARM-S5-001】工单审批流程 - 规格指导文档
## Iteration 1

---

## 需求与背景

### 业务场景

某企业内部工单审批系统需要实现完整的审批流程，覆盖从工单提交到最终审批完成的全生命周期管理。

### 核心功能需求

1. **前端审批页面**：为审批人员提供直观的工单列表查看、详情浏览、一键审批/驳回操作界面
2. **后端状态机**：实现工单状态的精确流转控制，确保状态变更的合法性与可追溯性
3. **通知机制**：在关键状态变更时自动触发通知，触达相关干系人

### 技术栈约束

| 层级 | 技术选型 |
|------|----------|
| 前端 | Vue 3 + Element Plus |
| 后端 | Python FastAPI |
| 数据库 | PostgreSQL |
| 状态存储 | Redis (缓存层) |

### 业务规则

- 工单状态流转：`待提交 → 待审批 → 审批中 → 已通过/已驳回 → 已归档`
- 审批权限：仅指定审批角色可执行审批操作
- 驳回操作：需填写驳回原因，支持驳回至任意前置状态

---

## 当前 Phase 对应实施目标

### Phase 1: 基础设施层 (Foundation)

**目标**：构建工单审批系统的数据模型与基础后端框架

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 1.1 数据库表设计 | 工单主表、审批记录表、状态变更日志表 | SQL Schema |
| 1.2 后端项目初始化 | FastAPI 项目结构、依赖配置 | 可运行的 API 骨架 |
| 1.3 状态机基础实现 | State Machine 核心类定义 | `state_machine.py` |

### Phase 2: 核心业务层 (Core Business)

**目标**：实现工单 CRUD 与状态流转逻辑

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 2.1 工单 CRUD API | 创建、查询、更新、删除接口 | RESTful API Endpoints |
| 2.2 状态流转引擎 | 状态机规则引擎、合法性校验 | `TransitionEngine` 类 |
| 2.3 审批记录持久化 | 审批动作与理由的存储 | 审批日志写入逻辑 |

### Phase 3: 前端交互层 (UI Layer)

**目标**：构建审批人员操作界面

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 3.1 工单列表页 | 筛选、排序、分页列表展示 | Vue Component |
| 3.2 工单详情页 | 完整信息展示、审批历史时间线 | Vue Component |
| 3.3 审批操作面板 | 批准/驳回按钮、原因输入框 | Vue Component |

### Phase 4: 通知机制层 (Notification Layer)

**目标**：实现状态变更的自动通知

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 4.1 通知触发器 | 状态变更事件的发布 | Event Publisher |
| 4.2 通知通道 | 邮件/站内信通知发送 | Notification Service |

---

## 边界约束

### 功能边界

| 约束项 | 约束内容 |
|--------|----------|
| 审批范围 | 本次迭代仅实现单级审批，不支持多级审批链 |
| 通知渠道 | 仅实现站内通知，邮件通道作为扩展项待后续迭代 |
| 并发控制 | 使用乐观锁机制，防止同一工单被并发审批 |
| 数据隔离 | 多租户场景暂不考虑，单租户实现 |

### 技术边界

| 约束项 | 约束内容 |
|--------|----------|
| API 版本 | v1 固定为 `/api/v1/workorders/*` |
| 前端路由 | 使用 Vue Router 4，路由模式为 history |
| 认证机制 | 本次迭代使用简化的 token 认证，不对接 SSO |
| 文件上传 | 本次迭代不包含附件功能 |

### 性能约束

| 指标 | 目标值 |
|------|--------|
| API 响应时间 (P95) | < 200ms |
| 列表查询响应时间 | < 500ms (1000条数据量) |
| 前端首屏加载时间 | < 2s |

### 安全约束

| 约束项 | 约束内容 |
|--------|----------|
| 输入校验 | 所有 API 入参必须经过 Pydantic 校验 |
| SQL 注入 | 使用 ORM 查询，禁止字符串拼接 SQL |
| XSS | 前端渲染用户输入必须做转义处理 |
| 审批权限 | 后端必须二次校验用户审批角色 |

---

## 验收测试基准 (ATB)

### 物理测试脚本要求

所有测试用例需提供可执行的 pytest/playwright 测试脚本，测试脚本命名遵循 `test_<模块>_<功能点>.py` 规范。

---

### ATB-1: 数据库层测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| DB-001 | 工单表创建 | 执行 migrations 后，表结构符合 Schema 定义 | `test_db_schema.py` |
| DB-002 | 审批记录表创建 | 审批记录表字段完整，外键约束生效 | `test_db_schema.py` |
| DB-003 | 状态变更日志表创建 | 日志表字段完整，变更时间自动记录 | `test_db_schema.py` |

---

### ATB-2: 后端状态机测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| SM-001 | 合法状态流转 - 待审批→审批中 | 状态机返回成功，新状态为 `pending_approval` | `test_state_machine.py` |
| SM-002 | 合法状态流转 - 审批中→已通过 | 审批通过后状态变更为 `approved` | `test_state_machine.py` |
| SM-003 | 合法状态流转 - 审批中→已驳回 | 驳回操作成功，状态变更为 `rejected`，驳回原因已记录 | `test_state_machine.py` |
| SM-004 | 非法状态流转 - 已归档→审批中 | 状态机拒绝非法流转，抛出 `InvalidTransitionError` | `test_state_machine.py` |
| SM-005 | 状态重复提交校验 | 同一状态重复提交返回错误码 `DUPLICATE_TRANSITION` | `test_state_machine.py` |
| SM-006 | 审批权限校验 | 无审批权限用户调用审批接口返回 403 | `test_approval_api.py` |

---

### ATB-3: 后端 API 测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| API-001 | 创建工单 | POST `/api/v1/workorders` 返回 201，body 包含 `workorder_id` | `test_workorder_api.py` |
| API-002 | 查询工单列表 | GET `/api/v1/workorders` 返回分页数据，默认 20 条/页 | `test_workorder_api.py` |
| API-003 | 查询工单详情 | GET `/api/v1/workorders/{id}` 返回完整工单信息与审批历史 | `test_workorder_api.py` |
| API-004 | 提交审批 | POST `/api/v1/workorders/{id}/submit` 触发状态流转 | `test_workorder_api.py` |
| API-005 | 执行审批 | POST `/api/v1/workorders/{id}/approve` 返回 200，工单状态更新 | `test_workorder_api.py` |
| API-006 | 执行驳回 | POST `/api/v1/workorders/{id}/reject` 返回 200，驳回原因已持久化 | `test_workorder_api.py` |
| API-007 | 参数校验失败 | 无效参数请求返回 422，响应体包含校验错误详情 | `test_workorder_api.py` |

---

### ATB-4: 前端 UI 测试 (Playwright)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| UI-001 | 工单列表页加载 | 页面加载完成，工单列表正确渲染，数据条目数与 API 一致 | `test_ui_list.spec.js` |
| UI-002 | 工单列表筛选 | 筛选条件变更后，列表数据正确过滤 | `test_ui_list.spec.js` |
| UI-003 | 工单详情页跳转 | 点击工单行跳转至详情页，URL 包含工单 ID | `test_ui_list.spec.js` |
| UI-004 | 审批操作 - 批准 | 点击批准按钮，工单状态变更为「已通过」，页面提示成功 | `test_ui_approval.spec.js` |
| UI-005 | 审批操作 - 驳回 | 点击驳回按钮，弹出原因输入框，填写后提交成功 | `test_ui_approval.spec.js` |
| UI-006 | 审批历史时间线 | 详情页正确渲染审批历史，按时间倒序排列 | `test_ui_detail.spec.js` |
| UI-007 | 无权限状态隐藏 | 无审批权限用户界面不显示审批操作按钮 | `test_ui_permission.spec.js` |

---

### ATB-5: 通知机制测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| NOTIFY-001 | 审批通过通知 | 状态变更为「已通过」后，触发通知事件，日志记录发送 | `test_notification.py` |
| NOTIFY-002 | 工单驳回通知 | 状态变更为「已驳回」后，触发通知事件，包含驳回原因 | `test_notification.py` |
| NOTIFY-003 | 通知事件格式 | 事件 payload 包含工单 ID、变更前后状态、操作人、时间戳 | `test_notification.py` |

---

### ATB-6: 集成测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| INT-001 | 完整审批流程 | 创建工单 → 提交审批 → 审批通过 → 状态归档，全流程成功 | `test_integration_approval_flow.py` |
| INT-002 | 完整驳回流程 | 创建工单 → 提交审批 → 驳回 → 修改重提 → 审批通过 | `test_integration_reject_flow.py` |
| INT-003 | 并发审批防护 | 两个并发审批请求仅一个成功，另一个返回409冲突 | `test_concurrency.py` |

---

## 开发切入层级序列

### 开发顺序规划

```
Phase 1 (Foundation)
    │
    ├── Step 1.1: 数据库 Schema 设计 & migrations
    │       └── 输出: SQL migrations 文件
    │
    ├── Step 1.2: FastAPI 项目骨架搭建
    │       └── 输出: 可运行的 FastAPI 应用框架
    │
    └── Step 1.3: 状态机核心类实现
            └── 输出: StateMachine 类，具备状态流转能力

Phase 2 (Core Business)
    │
    ├── Step 2.1: 工单 CRUD API 实现
    │       └── 依赖: Step 1.1, 1.2
    │
    ├── Step 2.2: 状态流转引擎 & 权限校验
    │       └── 依赖: Step 1.3
    │
    └── Step 2.3: 审批记录持久化
            └── 依赖: Step 2.1, 2.2

Phase 3 (UI Layer)
    │
    ├── Step 3.1: 工单列表页开发
    │       └── 依赖: Step 2.1
    │
    ├── Step 3.2: 工单详情页开发
    │       └── 依赖: Step 2.3
    │
    └── Step 3.3: 审批操作面板开发
            └── 依赖: Step 2.2, 3.1, 3.2

Phase 4 (Notification Layer)
    │
    ├── Step 4.1: 通知事件触发器接入
    │       └── 依赖: Step 2.2
    │
    └── Step 4.2: 站内通知服务实现
            └── 依赖: Step 4.1

Phase 5 (Testing & Integration)
    │
    ├── Step 5.1: 后端单元测试 & 集成测试
    │       └── 依赖: Phase 1, 2
    │
    ├── Step 5.2: 前端 E2E 测试
    │       └── 依赖: Phase 3
    │
    └── Step 5.3: 通知机制测试
            └── 依赖: Phase 4
```

### 关键技术决策点

| 决策点 | 方案选型 | 决策依据 |
|--------|----------|----------|
| 状态存储介质 | PostgreSQL + Redis 双写 | 热数据走 Redis 加速查询，冷数据持久化至 PG |
| 状态变更事件 | 观察者模式 + Async Event | 解耦通知逻辑，支持后续扩展消息队列 |
| 前端状态管理 | Pinia Store | 与 Vue 3 深度集成，TypeScript 支持良好 |
| 权限校验层级 | 后端强制校验 + 前端路由守卫 | 双重保障，防止越权操作 |

---

## 附录：状态机状态定义

```python
class WorkOrderState(str, Enum):
    DRAFT = "draft"                    # 草稿/待提交
    PENDING_APPROVAL = "pending"       # 待审批
    APPROVING = "approving"            # 审批中
    APPROVED = "approved"              # 已通过
    REJECTED = "rejected"              # 已驳回
    ARCHIVED = "archived"              # 已归档
```

## 附录：状态流转矩阵

| 当前状态 | 允许目标状态 | 触发操作 |
|----------|--------------|----------|
| draft | pending | submit |
| pending | approving | accept |
| approving | approved, rejected, pending | approve, reject, return |
| approved | archived | archive |
| rejected | draft, pending | revise_and_resubmit |
| archived | - | (终态) |

---

**文档版本**: v1.0  
**创建日期**: Iteration 1  
**状态**: Draft - 待评审