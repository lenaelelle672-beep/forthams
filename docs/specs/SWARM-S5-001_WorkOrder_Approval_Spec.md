# SWARM-S5-001 工单审批流程 Specifications

## 需求与背景

### 业务场景
GSD（Global Service Desk）系统需要支持标准化的工单审批流程。用户可在前端提交审批工单，后端基于状态机实现审批节点的自动流转，审批结果（通过/驳回）触发对应的通知机制。

### 核心能力要求
| 能力项 | 描述 |
|--------|------|
| 工单创建 | 用户填写工单表单并提交，系统初始化审批状态为 `PENDING` |
| 状态机流转 | 审批节点按预定义规则自动流转：`PENDING` → `APPROVING` → `APPROVED` / `REJECTED` |
| 审批动作 | 审批人可执行通过（approve）或驳回（reject）操作 |
| 通知触发 | 审批完成后自动向消息队列投递 `ApprovalResultEvent` 事件 |
| 乐观锁控制 | 并发审批场景下，通过 `version` 字段防止重复操作 |

### 技术驱动因素
- **状态机引擎**：统一工单状态管理，避免硬编码状态判断（参考 `src/state_machine/approval_state_machine.py`）
- **领域实体**：工单实体包含 `submit()`、`approve()`、`reject()` 等核心方法（参考 `src/domain/entities/work_order.py`）
- **审批链服务**：支持审批节点链的创建与执行（参考 `src/services/approval_chain_service.py`）
- **通知服务**：审批结果变更时自动触发 WebSocket / Email / Webhook 通知（参考 `src/services/notification_service.py`）

---

## 当前 Phase 对应实施目标

### Phase 1: 核心状态机与工单创建 (Day 1-9)
**目标**：实现工单的基础 CRUD + 状态机流转框架

| 交付物 | 说明 | 关联文件 |
|--------|------|----------|
| 工单数据模型 | 包含工单号、标题、申请人、当前状态、审批节点链、版本号 | `src/models/workorder.py` |
| 状态机引擎 | 预定义状态 + Guard 校验逻辑 + 状态转换规则 | `src/state_machine/approval_state_machine.py` |
| 工单创建 API | `POST /api/v1/work-orders` 返回工单 ID + 状态=PENDING | `tests/api/test_workorder_api.py` |
| 状态流转 API | `POST /api/v1/work-orders/{id}/approve` / `reject` | `src/api/routes/work_orders.py` |
| 审批动作 API | `POST /api/v1/approvals/{id}/execute` | `tests/api/test_work_order_approve.py` |

### Phase 2: 前端交互与通知集成 (Day 10-14)
**目标**：完成前端表单与通知服务对接

| 交付物 | 说明 | 关联文件 |
|--------|------|----------|
| 工单提交表单 | React 组件，支持表单校验与提交 | `frontend/src/router/approval.ts` |
| 审批操作界面 | 审批人可查看详情并执行审批 | `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` |
| 通知触发器 | 审批完成后向消息队列投递通知事件 | `src/notifications/events.py` |
| 通知消费者 | Email + 企业微信 Webhook 通道 | `src/infrastructure/messaging/consumers/notification_consumer.py` |

---

## 边界约束

### 功能边界
```
[约束项] 不支持的功能范围
├─ 多级会签审批（Phase 3 独立交付）
├─ 审批时限自动催办
├─ 工单转发与委托
├─ 移动端离线提交
└─ 审批意见版本回溯
```

### 技术边界
| 约束维度 | 具体限制 |
|----------|----------|
| 状态机实现 | 仅支持单向线性流转，不支持条件分支 |
| 通知渠道 | 仅支持 Email + 企业微信 Webhook |
| 并发控制 | 乐观锁机制，`version` 字段控制，冲突时返回 HTTP 409 |
| 工单数量上限 | 单用户同一时间最多 50 个 PENDING 工单 |
| 审批角色 | 仅 `ADMIN` / `APPROVER` 角色可执行审批操作 |

### 数据约束
```
工单状态枚举 (WorkOrderState):
  - DRAFT        # 草稿
  - PENDING     # 待提交
  - APPROVING   # 审批中
  - APPROVED    # 已通过
  - REJECTED    # 已驳回
  - CANCELLED   # 已撤销
  - CLOSED      # 已关闭

状态流转规则:
  DRAFT → PENDING          (submit 动作)
  PENDING → APPROVING      (submit 确认)
  APPROVING → APPROVED     (approve 动作)
  APPROVING → REJECTED     (reject 动作，附 reason)
  REJECTED → DRAFT         (revise 动作，重新编辑)
  APPROVED → CLOSED        (close 动作)
  APPROVED/REJECTED → CANCELLED (cancel 动作，仅限创建者)
  PENDING/REJECTED → CANCELLED   (cancel 动作)
```

---

## 验收测试基准 (ATB)

### ATB-1: 工单创建

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-1.1 | `POST /api/v1/work-orders` with valid payload | HTTP 201, 返回工单 ID, 状态=PENDING, version=1 | pytest (`tests/api/test_workorder_api.py`) |
| ATB-1.2 | `POST /api/v1/work-orders` with missing required fields | HTTP 422, error_detail 包含缺失字段列表 | pytest |
| ATB-1.3 | 工单创建后状态机初始化 | 数据库 `work_orders` 表 status=PENDING, 初始节点链存在 | MySQL query |
| ATB-1.4 | 工单数量超限（≥50 条 PENDING） | HTTP 429 Too Many Requests, 错误码 WORKORDER_LIMIT_EXCEEDED | pytest |
| ATB-1.5 | 前端表单提交成功 | UI Toast 提示"工单已提交", 跳转详情页 | Playwright |

### ATB-2: 状态机流转

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-2.1 | `POST /api/v1/work-orders/{id}/approve` | HTTP 200, status 变更=APPROVED, 流转时间戳更新 | pytest (`tests/api/test_work_order_approve.py`) |
| ATB-2.2 | `POST /api/v1/work-orders/{id}/reject` with reason | HTTP 200, status=REJECTED, reason 字段存储 | pytest (`tests/api/test_work_order_reject.py`) |
| ATB-2.3 | 重复审批同一工单 | HTTP 409 Conflict, 错误码 DUPLICATE_APPROVAL | pytest |
| ATB-2.4 | 对非 APPROVING 状态工单执行审批 | HTTP 422 Unprocessable Entity, 错误码 INVALID_TRANSITION | pytest |
| ATB-2.5 | 无权限用户执行审批 | HTTP 403 Forbidden | pytest |
| ATB-2.6 | 审批时传入非法的 comment 长度 | HTTP 422, error: comment must be ≤ 500 chars | pytest |
| ATB-2.7 | 并发审批同一工单 | 仅一个请求成功，另一个返回 409 | pytest (concurrent) |

### ATB-3: 通知触发

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-3.1 | 工单审批通过后 | 消息队列存在 `type=APPROVAL_RESULT` 的 event, action=APPROVED | Redis/RabbitMQ client |
| ATB-3.2 | 工单审批驳回后 | 消息队列 event 包含 `rejected_by`, `reject_reason` | Redis/RabbitMQ client |
| ATB-3.3 | 通知消费者处理 | Email 已发送或 Webhook 已推送（Mock server 验证） | Mock server |
| ATB-3.4 | 通知发送失败重试 | 重试机制触发，3 次重试后进入死信队列 | pytest + mock |
| ATB-3.5 | 创建者撤销工单后通知 | event.action=CANCELLED, 投递至取消通知队列 | pytest |

### ATB-4: 边界与异常

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-4.1 | 乐观锁版本冲突 | HTTP 409, 错误码 OPTIMISTIC_LOCK_FAILED | pytest |
| ATB-4.2 | 工单创建者撤销已审批工单 | HTTP 400, 错误码 INVALID_TRANSITION | pytest |
| ATB-4.3 | 工单详情查询 | HTTP 200, 返回完整节点链与审批历史 | pytest |
| ATB-4.4 | 查询不存在的工单 | HTTP 404, 错误码 WORKORDER_NOT_FOUND | pytest |
| ATB-4.5 | StateMachine Guard 校验失败 | HTTP 422, 错误码 TRANSITION_GUARD_FAILED, 包含校验原因 | pytest |

---

## 开发切入层级序列

### Layer 1: 数据层 (Day 1-2)
```
/src/models/
├── workorder.py              # 工单数据模型 + WorkOrderState 枚举
├── approval_chain.py          # 审批链模型
├── approval_node.py           # 审批节点模型
└── enums.py                   # 通用枚举定义

/alembic/versions/
└── 001_create_workorder_tables.sql  # 数据库迁移脚本
```

### Layer 2: 状态机引擎 (Day 3-4)
```
/src/state_machine/
├── states.py                 # State 基类 + WorkOrderState 实现
├── transitions.py            # Transition 转换定义
├── guards.py                  # Guard 条件校验
└── approval_state_machine.py # 审批状态机核心引擎
    ├── class ApprovalStateMachine
    ├── def evaluate_approve_guard()
    ├── def evaluate_reject_guard()
    ├── def evaluate_optimistic_lock()
    └── def execute_transition()
```

### Layer 3: 领域层 (Day 4-5)
```
/src/domain/entities/
└── work_order.py             # WorkOrder 实体
    ├── def submit()
    ├── def approve()
    ├── def reject()
    ├── def cancel()
    └── def close()
```

### Layer 4: Repository 层 (Day 5-6)
```
/src/infrastructure/database/
├── models.py                  # ORM 模型
└── repositories.py            # WorkOrderRepository, ApprovalNodeRepository
```

### Layer 5: Service 层 (Day 6-8)
```
/src/services/
├── work_order_service.py      # 工单业务逻辑
├── approval_service.py         # 审批业务逻辑
│   └── def approve() → _execute_transition() → _dispatch_notification_events()
├── approval_chain_service.py   # 审批链服务
└── notification_service.py     # 通知服务接口

/src/application/services/
├── work_order_service.py       # 应用层工单服务
├── status_history_service.py   # 状态历史记录服务
└── notification_service.py     # 应用层通知服务
```

### Layer 6: API 层 (Day 8-9)
```
/src/api/routes/
└── work_orders.py             # 工单路由
    POST   /api/v1/work-orders          # 创建工单
    GET    /api/v1/work-orders/{id}     # 查询详情
    POST   /api/v1/work-orders/{id}/approve  # 审批通过
    POST   /api/v1/work-orders/{id}/reject   # 审批驳回
    DELETE /api/v1/work-orders/{id}     # 撤销工单

/src/api/schemas/
└── responses.py               # 统一响应模型

/src/application/commands/
├── create_work_order.py       # 创建工单命令
├── approve_work_order.py      # 审批通过命令
└── reject_work_order.py        # 审批驳回命令
```

### Layer 7: 通知消息层 (Day 10)
```
/src/notifications/
└── events.py                  # ApprovalResultEvent, WorkOrderCancelledEvent

/src/infrastructure/messaging/
├── publisher.py                # 事件发布器
└── consumers/
    └── notification_consumer.py  # 消息队列消费者
```

### Layer 8: 前端组件 (Day 11-14)
```
/frontend/src/router/
└── approval.ts                # 审批路由配置

/frontend/src/app/pages/AuditDashboard/components/FilterBar/
└── FilterBar.module.css       # 审批过滤栏样式

/frontend/src/services/
├── approvalService.ts          # 审批服务
└── workorderService.ts         # 工单服务

/frontend/src/pages/WorkOrder/
├── api/workOrderApi.ts         # 工单 API 调用
└── types/workOrder.ts          # 工单类型定义
```

### Layer 9: 集成测试 (Day 15)
```
/tests/api/
├── test_workorder_api.py       # 工单 API 测试 (当前聚焦文件)
├── test_work_order_approve.py  # 审批通过测试
├── test_work_order_reject.py   # 审批驳回测试
└── test_work_order_submit.py   # 工单提交测试

/tests/integration/
├── test_workorder_api.py       # 全链路流程测试
└── test_approval_chain.py      # 审批链集成测试

/tests/unit/
└── test_state_machine.py       # 状态机单元测试
```

---

## 附录：关键接口定义

### 创建工单
```yaml
POST /api/v1/work-orders
Request:
  title: string (required, max: 200)
  description: string (required, max: 2000)
  priority: enum [LOW, MEDIUM, HIGH, CRITICAL]
  category_id: string (required)
  metadata: object (optional)
Response:
  id: string (uuid)
  status: "PENDING"
  version: 1
  created_at: datetime (ISO8601)
  created_by: string
```

### 执行审批通过
```yaml
POST /api/v1/work-orders/{id}/approve
Request:
  comment: string (optional, max: 500)
  version: integer (required, 用于乐观锁)
Response:
  id: string
  status: "APPROVED"
  approved_by: string
  approved_at: datetime (ISO8601)
  version: 2
```

### 执行审批驳回
```yaml
POST /api/v1/work-orders/{id}/reject
Request:
  reason: string (required, max: 500)
  version: integer (required)
Response:
  id: string
  status: "REJECTED"
  rejected_by: string
  rejected_at: datetime (ISO8601)
  reject_reason: string
  version: 2
```

### 错误响应格式
```yaml
Error Response:
  code: string (错误码)
  message: string (错误描述)
  detail: object (可选，附加信息)
  timestamp: datetime
```

---

## 验收 Checklist

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | 工单创建 API 返回 201 + 工单 ID | ⬜ |
| 2 | 状态机流转符合预定义规则 | ⬜ |
| 3 | 审批通过触发 ApprovalResultEvent (action=APPROVED) | ⬜ |
| 4 | 审批驳回触发 ApprovalResultEvent (action=REJECTED) | ⬜ |
| 5 | 乐观锁冲突返回 HTTP 409 | ⬜ |
| 6 | 无效状态转换返回 HTTP 422 | ⬜ |
| 7 | 单元测试覆盖率 ≥ 80% | ⬜ |
| 8 | 所有函数包含 docstring (AC-004) | ⬜ |
| 9 | AST 静态检查通过 `python -m py_compile` (AC-003) | ⬜ |
| 10 | 模块 import 无 ImportError (AC-005) | ⬜ |