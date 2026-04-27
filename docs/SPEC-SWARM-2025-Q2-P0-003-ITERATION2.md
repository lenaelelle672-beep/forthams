# SWARM-2025-Q2-P0-003 工单审批流程规格指导文档

**Iteration 2** | **状态**: 实施中 | **通过率**: 20% (1/5 AC)

---

## 需求与背景

### 业务需求

| 项目 | 内容 |
|------|------|
| 需求编号 | SWARM-2025-Q2-P0-003 |
| 需求名称 | 工单审批流程 |
| 当前迭代 | Iteration 2 |
| 核心诉求 | 用户可在前端审批页面完成工单审批操作，后端实现状态机流转并触发通知机制 |

### 既有约束（来自 Iteration 1）

| 约束项 | 描述 |
|--------|------|
| 工单基本 CRUD | 已完成 |
| 状态枚举 | `PENDING_APPROVAL`、`APPROVED`、`REJECTED`、`CLOSED` |
| 数据模型 | `WorkOrder` 实体已定义，`version` 字段用于乐观锁 |

### 阻塞问题（Iteration 2）

| 问题编号 | 严重程度 | 描述 |
|----------|----------|------|
| AC-001 | 🔴 CRITICAL | 集成测试失败 (0/3 passed) — 状态机流转逻辑未调通 |
| AC-002 | 🔴 CRITICAL | 集成测试失败 (0/3 passed) — 审批操作接口未就绪 |
| AC-004 | 🔴 CRITICAL | Docstring 缺失 — 6处函数缺少文档注释 |
| AC-005 | 🔴 CRITICAL | ImportError — `ModuleNotFoundError: derState` 模块导入失败 |

---

## 当前 Phase 对应实施目标

### Phase 对照关系

| Phase | 层级 | 本次 Iteration 2 实施范围 | 优先级 |
|-------|------|---------------------------|--------|
| Phase 1 | 数据模型层 | 审批流程配置表、审批节点状态映射 | P1 |
| Phase 2 | 服务层 | 审批状态机流转引擎、审批动作处理服务 | P1 |
| Phase 3 | 接口层 | 审批操作 REST API、前端审批页面数据绑定 | P1 |
| Phase 4 | 通知层 | 审批结果通知触发、通知消息生成 | P2 |
| Phase 5 | 前端交互层 | 审批页面交互、审批结果反馈 | P2 |

### 本次 Spec 聚焦范围

本次 Iteration 2 规格指导聚焦以下交付物：

| 交付物 | 描述 | 阻塞 AC |
|--------|------|---------|
| **审批状态机** | 定义审批状态 `APPROVED`/`REJECTED` 的流转规则 | AC-001 |
| **审批操作接口** | `POST /api/work-orders/{id}/approve`、`POST /api/work-orders/{id}/reject` | AC-002 |
| **通知机制** | 审批完成后自动触发通知，通知订阅者（申请人、相关审批人） | - |
| **前端审批页面** | 审批操作 UI、审批结果展示 | AC-002 |

---

## 边界约束

### 功能边界

| 约束类型 | 约束内容 | 异常处理 |
|----------|----------|----------|
| 审批权限 | 仅 `APPROVER` 角色可执行审批操作 | 其他角色返回 403 |
| 状态前置条件 | 仅 `PENDING_APPROVAL` 状态的工单可执行审批 | 其他状态返回 409 |
| 幂等性 | 重复提交同一审批操作应返回 200（不重复处理） | - |
| 审批意见 | 审批操作必须携带意见（`approval_comment`） | 驳回时意见为必填，返回 422 |
| 通知异步 | 通知机制采用异步触发 | 不阻塞审批主流程 |
| 并发控制 | 乐观锁机制：`version` 字段校验 | 避免竞态条件，返回 409 |

### 技术边界

| 边界项 | 限定 | 影响文件 |
|--------|------|----------|
| 后端框架 | FastAPI + SQLAlchemy | `src/application/services/approval_service.py` |
| 前端框架 | React 18 + Ant Design 5 | `frontend/src/services/approvalService.ts` |
| 消息队列 | RabbitMQ（通知消息投递） | `src/application/services/notification_service.py` |
| 数据库 | PostgreSQL | `src/models/workorder.py` |
| API 风格 | RESTful | `src/api/routers/approval_router.py` |
| 审批流程 | 单级审批（暂不支持多级审批链） | - |

### 已知问题修复约束

| 问题 | 修复方案 | 相关文件 |
|------|----------|----------|
| `ModuleNotFoundError: derState` | 修正导入路径为 `src.state_machine.retirement_state_machine` | `src/application/services/notification_service.py` |
| Docstring 缺失 | 为所有导出函数添加文档注释 | `endless_daemon.py`, `notification_service.py` |

---

## 验收测试基准 (ATB)

### ATB-1：审批接口功能测试

| 测试编号 | 测试场景 | 物理测试期待 | 断言条件 |
|----------|----------|--------------|----------|
| `test_approve_success` | 审批通过 | `POST /api/work-orders/{id}/approve` 返回 200，工单状态变更为 `APPROVED` | `response.status_code == 200`<br>`WorkOrder.status == "APPROVED"` |
| `test_reject_success` | 审批驳回 | `POST /api/work-orders/{id}/reject` 返回 200，工单状态变更为 `REJECTED` | `response.status_code == 200`<br>`WorkOrder.status == "REJECTED"` |
| `test_approve_without_comment` | 审批通过无意见 | `POST /api/work-orders/{id}/approve` (comment=null) 返回 422 | `response.status_code == 422` |
| `test_reject_without_comment` | 审批驳回无意见 | `POST /api/work-orders/{id}/reject` (comment=null) 返回 422 | `response.status_code == 422` |
| `test_approve_invalid_status` | 非待审批状态 | 工单状态为 `APPROVED` 时调用审批接口返回 409 | `response.status_code == 409` |
| `test_approve_unauthorized` | 非审批人角色 | 非 APPROVER 角色调用返回 403 | `response.status_code == 403` |

**对应 AC**: AC-002

### ATB-2：状态机流转测试

| 测试编号 | 测试场景 | 物理测试期待 | 断言条件 |
|----------|----------|--------------|----------|
| `test_state_machine_approve_flow` | 审批通过流转 | `PENDING_APPROVAL` → `APPROVED` | `previous_status == "PENDING_APPROVAL"`<br>`new_status == "APPROVED"` |
| `test_state_machine_reject_flow` | 审批驳回流转 | `PENDING_APPROVAL` → `REJECTED` | `previous_status == "PENDING_APPROVAL"`<br>`new_status == "REJECTED"` |
| `test_state_machine_no_reverse` | 状态不可逆 | `APPROVED` → 不可流转至 `PENDING_APPROVAL` | 流转失败返回 409 |

**对应 AC**: AC-001

### ATB-3：审批记录持久化测试

| 测试编号 | 测试场景 | 物理测试期待 | 断言条件 |
|----------|----------|--------------|----------|
| `test_approval_record_created` | 审批记录生成 | 审批成功后数据库 `approval_records` 表新增记录 | `ApprovalRecord.count == 1`<br>`ApprovalRecord.work_order_id == work_order.id` |
| `test_approval_record_fields` | 审批记录字段完整性 | 审批记录包含审批人、审批时间、审批意见、结果 | `record.approver_id == current_user.id`<br>`record.comment == submitted_comment` |

**对应 AC**: AC-001, AC-002

### ATB-4：通知触发测试

| 测试编号 | 测试场景 | 物理测试期待 | 断言条件 |
|----------|----------|--------------|----------|
| `test_notification_triggered_on_approve` | 审批通过触发通知 | 审批成功后 RabbitMQ 队列产生通知消息 | `NotificationTask.status == "PENDING"`<br>`notification_type == "APPROVAL_RESULT"` |
| `test_notification_triggered_on_reject` | 审批驳回触发通知 | 审批驳回后 RabbitMQ 队列产生通知消息 | `NotificationTask.status == "PENDING"` |
| `test_notification_async` | 通知异步不阻塞 | 通知发送不影响审批接口响应时间 | `response.time < 500ms` |

**对应 AC**: AC-001

### ATB-5：并发控制测试

| 测试编号 | 测试场景 | 物理测试期待 | 断言条件 |
|----------|----------|--------------|----------|
| `test_concurrent_approval_optimistic_lock` | 并发审批乐观锁 | 两个并发审批请求只有一个成功 | 第一个返回 200，第二个返回 409 |

**对应 AC**: AC-001

### ATB-6：前端审批页面测试（Playwright）

| 测试编号 | 测试场景 | 物理测试期待 | 断言条件 |
|----------|----------|--------------|----------|
| `test_approval_page_loads` | 审批页面加载 | 导航至审批页面，页面正常渲染 | `page.title == "工单审批"`<br>`approve_button.is_visible() == True` |
| `test_approval_submit_approve` | 前端审批通过 | 点击审批通过按钮，弹出意见输入框，提交后显示成功 | `success_toast.visible == True` |
| `test_approval_submit_reject` | 前端审批驳回 | 点击驳回按钮，弹出意见输入框（必填验证），提交后显示成功 | `success_toast.visible == True` |
| `test_approval_page_state_sync` | 前端状态同步 | 审批完成后页面刷新，工单状态显示 `已通过`/`已驳回` | `status_display.text == "已通过"` |

**对应 AC**: AC-002

---

## 开发切入层级序列

### 开发时序（Phase 1 → Phase 5）

```
Phase 1: 数据模型层
│
├── [1.1] 审批记录表设计 (approval_records)
│       ├── work_order_id (FK)
│       ├── approver_id
│       ├── action (APPROVE/REJECT)
│       ├── comment
│       └── created_at
│
└── [1.2] 工单表增加 version 字段（乐观锁）

Phase 2: 服务层
│
├── [2.1] 审批状态机定义
│       ├── StateTransitionEngine 类
│       └── 流转规则：PENDING_APPROVAL → APPROVED/REJECTED
│
└── [2.2] ApprovalService
        ├── approve(work_order_id, user_id, comment)
        └── reject(work_order_id, user_id, comment)

Phase 3: 接口层
│
├── [3.1] 审批 API 路由
│       ├── POST /api/work-orders/{id}/approve
│       └── POST /api/work-orders/{id}/reject
│
└── [3.2] 权限校验中间件（APPROVER 角色验证）

Phase 4: 通知层
│
├── [4.1] NotificationService
│       ├── send_approval_notification(approval_record)
│       └── 消息格式定义（通知类型、接收人、内容）
│
└── [4.2] RabbitMQ 消息生产者集成

Phase 5: 前端交互层
│
├── [5.1] 审批页面组件 (ApprovalPage.tsx)
│       ├── 审批意见输入
│       ├── 审批/驳回按钮
│       └── 审批结果反馈
│
└── [5.2] 前端状态管理（审批成功后工单状态刷新）
```

### 依赖关系说明

| 层级 | 前置依赖 | 可独立开发 |
|------|----------|-----------|
| Phase 1 | 无 | ✅ |
| Phase 2 | Phase 1（数据模型） | ✅（可 mock 数据模型） |
| Phase 3 | Phase 2（服务层） | ⚠️（需等服务层接口定义） |
| Phase 4 | Phase 2（服务层） | ⚠️（需等服务层触发点） |
| Phase 5 | Phase 3（API 接口） | ⚠️（需等接口契约） |

### 测试切入时机

| 测试类型 | 切入 Phase | 前置条件 |
|----------|------------|----------|
| 单元测试 (pytest) | Phase 2 完成后 | 服务层逻辑可独立验证 |
| 接口测试 (pytest + TestClient) | Phase 3 完成后 | API 路由已注册 |
| 集成测试 (pytest + 数据库) | Phase 4 完成后 | 通知机制已集成 |
| E2E 测试 (Playwright) | Phase 5 完成后 | 前端页面可访问 |

### 修复优先级序列

基于当前阻塞的 AC，修复优先级如下：

```
P0 (立即修复):
├── 1. AC-005: ModuleNotFoundError (derState)
│   └── 修复文件: src/application/services/notification_service.py
│       └── 修正导入: from src.state_machine.retirement_state_machine import ...
│
├── 2. AC-004: Docstring 缺失
│   ├── endless_daemon.py
│   └── src/application/services/notification_service.py
│
└── 3. AC-001/AC-002: 集成测试失败
    ├── 调通状态机流转逻辑
    ├── 实现审批操作接口
    └── 关联文件:
        ├── src/domain/services/approval_service.py
        ├── src/application/services/approval_service.py
        └── frontend/src/services/approvalService.ts

P1 (后续完善):
├── 通知机制集成
└── 前端审批页面交互
```

---

## 附录：关键接口契约

### 审批通过接口

```http
POST /api/work-orders/{work_order_id}/approve
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "comment": "审批通过，同意执行"
}

Response (200):
{
  "id": "wo-123",
  "status": "APPROVED",
  "version": 2,
  "approval_record": {
    "id": "ar-456",
    "action": "APPROVE",
    "approver_id": "user-789",
    "comment": "审批通过，同意执行",
    "created_at": "2025-04-10T10:30:00Z"
  }
}
```

### 审批驳回接口

```http
POST /api/work-orders/{work_order_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "comment": "驳回：缺少关键附件"
}

Response (200):
{
  "id": "wo-123",
  "status": "REJECTED",
  "version": 2,
  "approval_record": { ... }
}
```

### 错误响应

| status_code | error_code | 说明 |
|-------------|------------|------|
| 403 | `FORBIDDEN` | 无审批权限 |
| 409 | `INVALID_STATE_TRANSITION` | 工单状态不允许审批 |
| 422 | `VALIDATION_ERROR` | 审批意见缺失 |
| 404 | `NOT_FOUND` | 工单不存在 |

---

## 附录：聚焦文件说明

### `frontend/src/services/approvalService.ts`

**职责**: 前端审批服务层，负责与后端审批 API 交互

**核心方法**:

| 方法名 | 参数 | 返回值 | 描述 |
|--------|------|--------|------|
| `approveWorkOrder` | `workOrderId: string, comment: string` | `Promise<ApprovalResponse>` | 审批通过 |
| `rejectWorkOrder` | `workOrderId: string, comment: string` | `Promise<ApprovalResponse>` | 审批驳回 |
| `getApprovalHistory` | `workOrderId: string` | `Promise<ApprovalRecord[]>` | 获取审批历史 |

**类型定义**:

```typescript
interface ApprovalAction {
  workOrderId: string;
  action: 'APPROVE' | 'REJECT';
  comment: string;
}

interface ApprovalResponse {
  id: string;
  status: 'APPROVED' | 'REJECTED';
  version: number;
  approvalRecord: ApprovalRecord;
}

interface ApprovalRecord {
  id: string;
  action: string;
  approverId: string;
  comment: string;
  createdAt: string;
}
```

**注意事项**:
- 审批意见 `comment` 为必填字段
- 返回的 `version` 字段用于乐观锁校验
- 审批操作完成后需刷新工单状态

---

*文档版本: 1.0.0*  
*创建日期: 2025-04-10*  
*维护者: SWARM Team*  
*下次审查: Iteration 3 启动前*