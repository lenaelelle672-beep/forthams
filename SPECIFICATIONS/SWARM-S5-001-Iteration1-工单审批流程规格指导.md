# 【SWARM-S5-001】工单审批流程 - 规格指导文档
## Iteration 1

---

## 1. 需求与背景

### 1.1 业务场景

某企业内部工单审批系统需要实现完整的审批流程，覆盖从工单提交到最终审批完成的全生命周期管理。本文档定义 Iteration 1 的实施范围与技术规格。

### 1.2 核心功能需求

| 需求编号 | 功能描述 | 优先级 |
|----------|----------|--------|
| F-001 | 前端审批页面：审批人员可查看工单列表、详情，执行批准/驳回操作 | P0 |
| F-002 | 后端状态机：实现工单状态的精确流转控制与合法性校验 | P0 |
| F-003 | 通知机制：关键状态变更时自动触发通知，触达相关干系人 | P1 |

### 1.3 技术栈约束

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | Vue 3 + Element Plus + TypeScript |
| 后端框架 | Python FastAPI + Pydantic |
| 数据库 | PostgreSQL |
| 缓存层 | Redis |
| 状态机 | 自定义 StateMachine 实现 |
| 通知通道 | 站内通知（邮件通道待后续迭代） |

### 1.4 业务规则

| 规则编号 | 规则描述 |
|----------|----------|
| BR-001 | 工单状态流转：`草稿 → 待审批 → 审批中 → 已通过/已驳回 → 已归档` |
| BR-002 | 审批权限：仅指定审批角色可执行审批操作，后端必须二次校验 |
| BR-003 | 驳回操作：需填写驳回原因，支持驳回至任意前置状态 |
| BR-004 | 并发控制：使用乐观锁机制，防止同一工单被并发审批 |

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 基础设施层 (Foundation)

**目标**：构建工单审批系统的数据模型与基础后端框架

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 1.1 数据库表设计 | 工单主表、审批记录表、状态变更日志表 | SQL Schema (`alembic/versions/`) |
| 1.2 后端项目初始化 | FastAPI 项目结构、依赖配置 | 可运行的 API 骨架 |
| 1.3 状态机基础实现 | State Machine 核心类定义 | `src/state_machine/approval_state_machine.py` |

### Phase 2: 核心业务层 (Core Business)

**目标**：实现工单 CRUD 与状态流转逻辑

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 2.1 工单 CRUD API | 创建、查询、更新、删除接口 | RESTful API Endpoints (`src/api/routes/work_orders.py`) |
| 2.2 状态流转引擎 | 状态机规则引擎、合法性校验 | `TransitionEngine` 类 |
| 2.3 审批记录持久化 | 审批动作与理由的存储 | 审批日志写入逻辑 |

### Phase 3: 前端交互层 (UI Layer)

**目标**：构建审批人员操作界面

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 3.1 工单列表页 | 筛选、排序、分页列表展示 | Vue Component |
| 3.2 工单详情页 | 完整信息展示、审批历史时间线 | Vue Component (`frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx`) |
| 3.3 审批操作面板 | 批准/驳回按钮、原因输入框 | Vue Component |

### Phase 4: 通知机制层 (Notification Layer)

**目标**：实现状态变更的自动通知

| 任务项 | 具体内容 | 交付物 |
|--------|----------|--------|
| 4.1 通知触发器 | 状态变更事件的发布 | `src/notifications/events.py` EventPublisher |
| 4.2 通知通道 | 站内通知发送 | `src/application/services/notification_service.py` |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 约束内容 |
|--------|----------|
| 审批范围 | 本次迭代仅实现单级审批，不支持多级审批链 |
| 通知渠道 | 仅实现站内通知，邮件通道作为扩展项待后续迭代 |
| 附件功能 | 本次迭代不包含工单附件上传 |
| 多租户 | 暂不考虑，多租户场景待后续迭代 |

### 3.2 技术边界

| 约束项 | 约束内容 |
|--------|----------|
| API 版本 | v1 固定为 `/api/v1/workorders/*` |
| 前端路由 | 使用 Vue Router 4，路由模式为 history |
| 认证机制 | 本次迭代使用简化的 token 认证，不对接 SSO |
| 状态存储 | PostgreSQL + Redis 双写（热数据 Redis，冷数据 PG） |

### 3.3 性能约束

| 指标 | 目标值 |
|------|--------|
| API 响应时间 (P95) | < 200ms |
| 列表查询响应时间 | < 500ms (1000条数据量) |
| 前端首屏加载时间 | < 2s |

### 3.4 安全约束

| 约束项 | 约束内容 |
|--------|----------|
| 输入校验 | 所有 API 入参必须经过 Pydantic 校验 |
| SQL 注入 | 使用 ORM 查询，禁止字符串拼接 SQL |
| XSS | 前端渲染用户输入必须做转义处理 |
| 审批权限 | 后端必须二次校验用户审批角色 |

---

## 4. 验收测试基准 (ATB)

### 4.1 物理测试脚本要求

所有测试用例需提供可执行的 pytest/playwright 测试脚本，测试脚本命名遵循规范：

- Python pytest: `test_<模块>_<功能点>.py`
- Playwright E2E: `<功能点>.spec.ts`

---

### 4.2 ATB-1: 数据库层测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| DB-001 | 工单表创建 | 执行 migrations 后，表结构符合 Schema 定义 | `tests/db/test_workorder_tables.py` |
| DB-002 | 审批记录表创建 | 审批记录表字段完整，外键约束生效 | `tests/db/test_workorder_tables.py` |
| DB-003 | 状态变更日志表创建 | 日志表字段完整，变更时间自动记录 | `tests/db/test_workorder_tables.py` |

---

### 4.3 ATB-2: 后端状态机测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| SM-001 | 合法状态流转 - 待审批→审批中 | 状态机返回成功，新状态为 `pending_approval` | `tests/state_machine/test_retirement_sm.py` |
| SM-002 | 合法状态流转 - 审批中→已通过 | 审批通过后状态变更为 `approved` | `tests/state_machine/test_retirement_sm.py` |
| SM-003 | 合法状态流转 - 审批中→已驳回 | 驳回操作成功，状态变更为 `rejected`，驳回原因已记录 | `tests/state_machine/test_retirement_sm.py` |
| SM-004 | 非法状态流转 - 已归档→审批中 | 状态机拒绝非法流转，抛出 `InvalidStateTransitionError` | `tests/unit/test_workorder_state_machine.py` |
| SM-005 | 状态重复提交校验 | 同一状态重复提交返回错误码 `DUPLICATE_TRANSITION` | `tests/unit/test_workorder_state_machine.py` |
| SM-006 | 审批权限校验 | 无审批权限用户调用审批接口返回 403 | `tests/api/test_work_order_approve.py` |

---

### 4.4 ATB-3: 后端 API 测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| API-001 | 创建工单 | POST `/api/v1/workorders` 返回 201，body 包含 `workorder_id` | `tests/api/test_workorder_api.py` |
| API-002 | 查询工单列表 | GET `/api/v1/workorders` 返回分页数据，默认 20 条/页 | `tests/api/test_workorder_api.py` |
| API-003 | 查询工单详情 | GET `/api/v1/workorders/{id}` 返回完整工单信息与审批历史 | `tests/integration/test_workorder_api.py` |
| API-004 | 提交审批 | POST `/api/v1/workorders/{id}/submit` 触发状态流转 | `tests/api/test_work_order_submit.py` |
| API-005 | 执行审批 | POST `/api/v1/workorders/{id}/approve` 返回 200，工单状态更新 | `tests/api/test_work_order_approve.py` |
| API-006 | 执行驳回 | POST `/api/v1/workorders/{id}/reject` 返回 200，驳回原因已持久化 | `tests/api/test_work_order_reject.py` |
| API-007 | 参数校验失败 | 无效参数请求返回 422，响应体包含校验错误详情 | `tests/api/test_workorder_api.py` |
| API-008 | 幂等性校验 | 重复提交同一审批请求返回 409 Conflict | `tests/api/test_work_order_idempotent.py` |

---

### 4.5 ATB-4: 前端 UI 测试 (Playwright)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| UI-001 | 工单列表页加载 | 页面加载完成，工单列表正确渲染，数据条目数与 API 一致 | `frontend/tests/e2e/approval.spec.ts` |
| UI-002 | 工单列表筛选 | 筛选条件变更后，列表数据正确过滤 | `frontend/tests/e2e/approval.spec.ts` |
| UI-003 | 工单详情页跳转 | 点击工单行跳转至详情页，URL 包含工单 ID | `tests/e2e/test_workorder_workflow.spec.ts` |
| UI-004 | 审批操作 - 批准 | 点击批准按钮，工单状态变更为「已通过」，页面提示成功 | `frontend/tests/e2e/approval.spec.ts` |
| UI-005 | 审批操作 - 驳回 | 点击驳回按钮，弹出原因输入框，填写后提交成功 | `frontend/tests/e2e/approval.spec.ts` |
| UI-006 | 审批历史时间线 | 详情页正确渲染审批历史，按时间倒序排列 | `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` (单元测试) |
| UI-007 | 无权限状态隐藏 | 无审批权限用户界面不显示审批操作按钮 | `frontend/src/stores/approvalStore.test.ts` |

---

### 4.6 ATB-5: 通知机制测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| NOTIFY-001 | 审批通过通知 | 状态变更为「已通过」后，触发通知事件，日志记录发送 | `tests/backend/test_events.py` |
| NOTIFY-002 | 工单驳回通知 | 状态变更为「已驳回」后，触发通知事件，包含驳回原因 | `tests/backend/test_events.py` |
| NOTIFY-003 | 通知事件格式 | 事件 payload 包含工单 ID、变更前后状态、操作人、时间戳 | `tests/backend/test_events.py` |

---

### 4.7 ATB-6: 集成测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| INT-001 | 完整审批流程 | 创建工单 → 提交审批 → 审批通过 → 状态归档，全流程成功 | `tests/e2e/test_workorder_workflow.spec.ts` |
| INT-002 | 完整驳回流程 | 创建工单 → 提交审批 → 驳回 → 修改重提 → 审批通过 | `tests/e2e/test_workorder_workflow.spec.ts` |
| INT-003 | 并发审批防护 | 两个并发审批请求仅一个成功，另一个返回 409 冲突 | `tests/concurrency/test_approve_race_condition.py` |

---

## 5. 开发切入层级序列

### 5.1 开发顺序规划

```
Phase 1 (Foundation)
    │
    ├── Step 1.1: 数据库 Schema 设计 & migrations
    │       └── 输出: SQL migrations 文件 (`alembic/versions/`)
    │
    ├── Step 1.2: FastAPI 项目骨架搭建
    │       └── 输出: 可运行的 FastAPI 应用框架
    │
    └── Step 1.3: 状态机核心类实现
            └── 输出: StateMachine 类，具备状态流转能力
            └── 文件: `src/state_machine/approval_state_machine.py`

Phase 2 (Core Business)
    │
    ├── Step 2.1: 工单 CRUD API 实现
    │       └── 依赖: Step 1.1, 1.2
    │       └── 文件: `src/api/routes/work_orders.py`
    │
    ├── Step 2.2: 状态流转引擎 & 权限校验
    │       └── 依赖: Step 1.3
    │       └── 文件: `src/domain/services/retirement_service.py`
    │
    └── Step 2.3: 审批记录持久化
            └── 依赖: Step 2.1, 2.2
            └── 文件: `src/repositories/approval_chain_repository.py`

Phase 3 (UI Layer)
    │
    ├── Step 3.1: 工单列表页开发
    │       └── 依赖: Step 2.1
    │       └── 文件: `frontend/tests/e2e/approval.spec.ts`
    │
    ├── Step 3.2: 工单详情页开发
    │       └── 依赖: Step 2.3
    │       └── 文件: `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx`
    │
    └── Step 3.3: 审批操作面板开发
            └── 依赖: Step 2.2, 3.1, 3.2
            └── 文件: `frontend/src/stores/approvalStore.test.ts`

Phase 4 (Notification Layer)
    │
    ├── Step 4.1: 通知事件触发器接入
    │       └── 依赖: Step 2.2
    │       └── 文件: `src/notifications/events.py`
    │
    └── Step 4.2: 站内通知服务实现
            └── 依赖: Step 4.1
            └── 文件: `src/application/services/notification_service.py`

Phase 5 (Testing & Integration)
    │
    ├── Step 5.1: 后端单元测试 & 集成测试
    │       └── 依赖: Phase 1, 2
    │       └── 文件: `tests/unit/test_workorder_state_machine.py`
    │
    ├── Step 5.2: 前端 E2E 测试
    │       └── 依赖: Phase 3
    │       └── 文件: `tests/e2e/test_workorder_workflow.spec.ts`
    │
    └── Step 5.3: 通知机制测试
            └── 依赖: Phase 4
            └── 文件: `tests/backend/test_events.py`
```

### 5.2 关键技术决策点

| 决策点 | 方案选型 | 决策依据 |
|--------|----------|----------|
| 状态存储介质 | PostgreSQL + Redis 双写 | 热数据走 Redis 加速查询，冷数据持久化至 PG |
| 状态变更事件 | 观察者模式 + Async Event | 解耦通知逻辑，支持后续扩展消息队列 |
| 前端状态管理 | Pinia Store | 与 Vue 3 深度集成，TypeScript 支持良好 |
| 权限校验层级 | 后端强制校验 + 前端路由守卫 | 双重保障，防止越权操作 |
| 并发控制 | 乐观锁 (version 字段) | 避免数据库锁竞争，适合高并发场景 |

---

## 附录 A: 状态机状态定义

```python
# src/domain/entities/work_order.py
class WorkOrderState(str, Enum):
    DRAFT = "draft"                    # 草稿/待提交
    PENDING_APPROVAL = "pending"       # 待审批
    APPROVING = "approving"            # 审批中
    APPROVED = "approved"              # 已通过
    REJECTED = "rejected"              # 已驳回
    ARCHIVED = "archived"              # 已归档
```

## 附录 B: 状态流转矩阵

| 当前状态 | 允许目标状态 | 触发操作 |
|----------|--------------|----------|
| draft | pending | submit |
| pending | approving | accept |
| approving | approved, rejected, pending | approve, reject, return |
| approved | archived | archive |
| rejected | draft, pending | revise_and_resubmit |
| archived | - | (终态) |

## 附录 C: 异常定义

| 异常类 | 定义位置 | 触发场景 |
|--------|----------|----------|
| `InvalidStateTransitionError` | `src/domain/state_machine/retirement_state_machine.py` | 非法状态流转尝试 |
| `ApprovalStepNotReachableError` | `src/domain/entities/approval_stage.py` | 审批步骤不可达 |
| `ConcurrentModificationError` | `src/models/workorder.py` | 并发修改冲突 |
| `IdempotencyError` | `src/models/workorder.py` | 幂等性校验失败 |

## 附录 D: 核心类型定义

```typescript
// frontend/src/types/workorder.types.ts
interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  applicant_id: string;
  approver_id?: string;
  created_at: string;
  updated_at: string;
  version: number;  // 乐观锁版本号
}

interface ApprovalRecord {
  id: string;
  workorder_id: string;
  action: 'approve' | 'reject' | 'delegate';
  approver_id: string;
  comment?: string;
  created_at: string;
}

type WorkOrderStatus = 'draft' | 'pending' | 'approving' | 'approved' | 'rejected' | 'archived';
```

---

**文档版本**: v1.0  
**创建日期**: Iteration 1  
**状态**: Draft - 待评审  
**Owner**: SWARM Team