# SWARM-S5-001 工单审批流程 Specifications

> **版本**: v1.0  
> **迭代**: Iteration 1  
> **状态**: Approved  
> **最后更新**: 2025-01-20

---

## 1. 需求与背景

### 1.1 业务场景

GSD（Global Service Desk）系统需要支持标准化的工单审批流程。用户可在前端提交审批工单，后端基于状态机实现审批节点的自动流转，审批结果（通过/驳回）触发对应的通知机制。

### 1.2 核心能力矩阵

| 能力项 | 描述 | 优先级 |
|--------|------|--------|
| 工单创建 | 用户填写工单表单并提交 | P0 |
| 状态机流转 | 审批节点按预定义规则自动流转 | P0 |
| 审批动作 | 审批人可执行通过/驳回操作 | P0 |
| 通知触发 | 审批结果变更时自动发送通知 | P1 |

### 1.3 技术驱动因素

- **统一状态管理**: 避免硬编码状态判断，通过状态机约束流转
- **审批流程可配置**: 降低业务变更成本
- **事件驱动通知**: 保障审批结果及时触达

---

## 2. 状态机模型

### 2.1 状态枚举定义

```python
class WorkOrderState(Enum):
    """工单状态枚举"""
    DRAFT = "DRAFT"           # 草稿（未提交）
    PENDING = "PENDING"       # 待审批
    APPROVING = "APPROVING"   # 审批中
    APPROVED = "APPROVED"     # 已通过
    REJECTED = "REJECTED"     # 已驳回
    CANCELLED = "CANCELLED"   # 已撤销
    CLOSED = "CLOSED"         # 已关闭
```

### 2.2 状态流转图

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
                    ▼                                                     │
┌─────────┐    ┌─────────┐    ┌───────────┐    ┌──────────┐    ┌───────┐ │
│  DRAFT  │───▶│ PENDING │───▶│ APPROVING │───▶│ APPROVED │───▶│ CLOSED│ │
└─────────┘    └─────────┘    └───────────┘    └──────────┘    └───────┘ │
     │              │              │               ▲                   │
     │              │              │               │                   │
     │              ▼              ▼               │                   │
     │         ┌───────────┐ ┌──────────┐         │                   │
     └────────▶│ CANCELLED │ │ REJECTED │─────────┘                   │
              └───────────┘ └──────────┘                               │
                                                                    │
              ┌───────────┐    ┌───────────┐                         │
              │ REJECTED  │───▶│  DRAFT    │ (可重新编辑提交)         │
              └───────────┘    └───────────┘                         │
```

### 2.3 流转规则定义

| 当前状态 | 触发动作 | 目标状态 | 前置条件 |
|----------|----------|----------|----------|
| DRAFT | submit | PENDING | 工单必填字段完整 |
| PENDING | start_approval | APPROVING | 审批链已初始化 |
| APPROVING | approve | APPROVED | 当前用户有审批权限 |
| APPROVING | reject | REJECTED | 必须提供驳回原因 |
| REJECTED | resubmit | PENDING | 仅创建者可操作 |
| APPROVED | close | CLOSED | 无后置审批节点 |
| APPROVED/REJECTED | cancel | CANCELLED | 仅创建者可操作 |

---

## 3. 数据模型

### 3.1 工单实体 (WorkOrder)

```python
class WorkOrder:
    """工单领域实体"""
    
    id: UUID                      # 工单唯一标识
    title: str                    # 工单标题 (max: 200)
    description: str              # 工单描述 (max: 2000)
    priority: Priority            # 优先级: LOW/MEDIUM/HIGH/CRITICAL
    category_id: UUID             # 工单分类ID
    status: WorkOrderState        # 当前状态
    applicant_id: UUID            # 申请人ID
    current_node_id: UUID | None  # 当前审批节点ID
    approval_chain_id: UUID       # 审批链ID
    version: int                  # 乐观锁版本号
    created_at: datetime
    updated_at: datetime
```

### 3.2 审批节点 (ApprovalNode)

```python
class ApprovalNode:
    """审批节点"""
    
    id: UUID                      # 节点唯一标识
    chain_id: UUID                # 所属审批链ID
    order: int                    # 节点顺序
    approver_id: UUID             # 审批人ID
    status: NodeStatus            # PENDING/APPROVED/REJECTED
    comment: str | None           # 审批意见
    decided_at: datetime | None   # 审批时间
```

### 3.3 审批事件 (ApprovalEvent)

```python
class ApprovalEvent:
    """审批事件"""
    
    event_type: EventType         # APPROVAL_SUBMITTED/APPROVED/REJECTED
    work_order_id: UUID           # 工单ID
    actor_id: UUID                # 操作用户ID
    timestamp: datetime           # 事件时间
    payload: dict                 # 事件载荷
```

---

## 4. 前端交互规范

### 4.1 工单提交表单 (FilterBar 组件扩展)

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| title | Input | ✅ | max_length=200, min_length=5 |
| description | TextArea | ✅ | max_length=2000, min_length=10 |
| priority | Select | ✅ | enum: [LOW, MEDIUM, HIGH, CRITICAL] |
| category | TreeSelect | ✅ | 叶子节点 |
| attachments | File[] | ❌ | max: 5 files, 单个 max 10MB |

### 4.2 审批操作界面

```typescript
interface ApprovalActionsProps {
  workOrderId: string;
  currentStatus: WorkOrderState;
  canApprove: boolean;
  canReject: boolean;
  onApprove: (comment?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}
```

### 4.3 前端路由配置

```typescript
// frontend/src/router/approval.ts
export const approvalRoutes = [
  {
    path: '/work-orders',
    component: WorkOrderListPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/work-orders/create',
    component: WorkOrderFormPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/work-orders/:id',
    component: WorkOrderDetailPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/work-orders/:id/approve',
    component: ApprovalActionPage,
    meta: { requiresAuth: true, role: 'APPROVER' }
  }
];
```

---

## 5. 后端 API 规范

### 5.1 创建工单

```yaml
POST /api/v1/work-orders
Content-Type: application/json

Request:
  title: string (required, max: 200)
  description: string (required, max: 2000)
  priority: enum [LOW, MEDIUM, HIGH, CRITICAL]
  category_id: string (uuid, required)

Response (201 Created):
  id: string (uuid)
  title: string
  status: "PENDING"
  created_at: datetime (ISO 8601)
  approval_chain_id: string (uuid)

Errors:
  400: Validation failed (missing required fields)
  401: Unauthorized
  429: Too many pending work orders (limit: 50)
```

### 5.2 执行审批

```yaml
POST /api/v1/work-orders/{id}/approve
POST /api/v1/work-orders/{id}/reject

Request:
  comment: string (optional, max: 500)

Response (200 OK):
  id: string
  status: "APPROVED" | "REJECTED"
  approved_by: string (uuid)
  approved_at: datetime (ISO 8601)

Errors:
  400: Invalid transition
  403: No permission
  409: Duplicate approval (idempotency)
  422: Work order not in APPROVING state
```

### 5.3 查询工单

```yaml
GET /api/v1/work-orders/{id}

Response (200 OK):
  id: string
  title: string
  description: string
  priority: string
  status: string
  applicant: { id, name, email }
  approval_chain: [
    { id, order, approver, status, comment, decided_at }
  ]
  history: [
    { from_status, to_status, actor, timestamp }
  ]
```

---

## 6. 通知触发机制

### 6.1 事件类型

| 事件类型 | 触发时机 | 通知对象 |
|----------|----------|----------|
| APPROVAL_SUBMITTED | 工单提交成功 | 首个审批人 |
| APPROVAL_STARTED | 审批开始 | 申请人 |
| APPROVAL_COMPLETED | 审批通过 | 申请人 + 下游审批人 |
| APPROVAL_REJECTED | 审批驳回 | 申请人 |
| WORK_ORDER_CLOSED | 工单关闭 | 申请人 |

### 6.2 通知通道

```python
class NotificationChannel(Enum):
    EMAIL = "email"           # 邮件通知
    WEBHOOK = "webhook"       # 企业微信Webhook
    IN_APP = "in_app"         # 应用内通知
```

### 6.3 消息队列投递

```python
# 通知事件投递
notification_event = {
    "type": "APPROVAL_RESULT",
    "work_order_id": str(uuid),
    "result": "APPROVED" | "REJECTED",
    "actor_id": str(uuid),
    "timestamp": datetime.utcnow().isoformat(),
    "channels": ["EMAIL", "WEBHOOK"],
    "recipients": ["applicant@company.com", "manager@company.com"]
}
```

---

## 7. 边界约束

### 7.1 功能边界

```
[不包含的范围 - Phase 2+ 交付]
├─ 多级会签审批
├─ 条件分支审批
├─ 审批时限自动催办
├─ 工单转发与委托
├─ 移动端离线提交
└─ 审批意见模板
```

### 7.2 技术约束

| 维度 | 限制 |
|------|------|
| 状态机 | 仅支持单向线性流转 |
| 通知渠道 | Email + 企业微信Webhook |
| 并发控制 | 乐观锁 (version字段) |
| 单用户PENDING上限 | 50条 |
| 审批历史保留 | 永久 |
| 附件大小限制 | 单文件10MB，最多5个 |

### 7.3 数据约束

```python
# 状态枚举
WorkOrderState = Literal["DRAFT", "PENDING", "APPROVING", "APPROVED", "REJECTED", "CANCELLED", "CLOSED"]

# 节点状态
NodeStatus = Literal["PENDING", "APPROVED", "REJECTED"]

# 优先级
Priority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# 版本号递增规则
# - 每次状态变更必须 version += 1
# - 并发更新时检查 version match
```

---

## 8. 验收测试基准 (ATB)

### 8.1 工单创建测试

| 测试ID | 测试用例 | 期待结果 | 优先级 |
|--------|----------|----------|--------|
| ATB-1.1 | POST工单，payload完整有效 | HTTP 201, status=PENDING | P0 |
| ATB-1.2 | POST工单，缺少必填字段title | HTTP 400, error_detail标注title | P0 |
| ATB-1.3 | POST工单，title超长(>200字符) | HTTP 400, 错误码FIELD_TOO_LONG | P0 |
| ATB-1.4 | POST工单，category_id为非叶子节点 | HTTP 400, 错误码INVALID_CATEGORY | P1 |
| ATB-1.5 | 用户已有50条PENDING工单，再次提交 | HTTP 429, 错误码PENDING_LIMIT_EXCEEDED | P0 |
| ATB-1.6 | 前端表单提交成功 | UI Toast "工单已提交", 跳转详情页 | P0 |

### 8.2 状态机流转测试

| 测试ID | 测试用例 | 期待结果 | 优先级 |
|--------|----------|----------|--------|
| ATB-2.1 | submit: DRAFT → PENDING | 状态变更成功, approval_chain初始化 | P0 |
| ATB-2.2 | start_approval: PENDING → APPROVING | 当前节点激活, 通知首个审批人 | P0 |
| ATB-2.3 | approve: APPROVING → APPROVED | 状态变更, version+1, 触发通知 | P0 |
| ATB-2.4 | reject: APPROVING → REJECTED | 状态变更, 必须记录reason | P0 |
| ATB-2.5 | resubmit: REJECTED → PENDING | 仅创建者可操作 | P0 |
| ATB-2.6 | cancel: APPROVED → CANCELLED | 状态变更, 需校验权限 | P1 |
| ATB-2.7 | 对PENDING状态工单执行approve | HTTP 422, 错误码INVALID_TRANSITION | P0 |
| ATB-2.8 | 无审批权限用户执行approve | HTTP 403, 错误码PERMISSION_DENIED | P0 |
| ATB-2.9 | 重复审批同一工单 | HTTP 409, 错误码DUPLICATE_APPROVAL | P0 |
| ATB-2.10 | 并发审批同一工单 | 乐观锁生效, 仅一请求成功 | P0 |

### 8.3 通知触发测试

| 测试ID | 测试用例 | 期待结果 | 优先级 |
|--------|----------|----------|--------|
| ATB-3.1 | 工单审批通过 | MQ存在APPROVAL_RESULT事件 | P0 |
| ATB-3.2 | 工单审批驳回 | MQ事件包含rejected_by, reason | P0 |
| ATB-3.3 | 通知消费者处理 | Email已发送或Webhook已推送 | P0 |
| ATB-3.4 | MQ连接失败 | 本地重试3次, 之后进入死信队列 | P1 |
| ATB-3.5 | 重复事件投递 | 幂等处理, 不重复发送通知 | P1 |

### 8.4 并发与边界测试

| 测试ID | 测试用例 | 期待结果 | 优先级 |
|--------|----------|----------|--------|
| ATB-4.1 | 100个并发创建工单请求 | 均成功或均失败, 无数据不一致 | P0 |
| ATB-4.2 | 乐观锁version冲突 | 失败请求返回409, 数据不变 | P0 |
| ATB-4.3 | 工单详情查询 | 返回完整审批链 + 历史记录 | P1 |

---

## 9. 开发切入层级序列

### Layer 1: 数据层 (Day 1-2)

```
src/models/
├── workorder.py           # 工单数据模型 + 状态枚举
├── approval_node.py       # 审批节点模型
└── status_history.py      # 状态历史记录

src/infrastructure/database/
└── migrations/
    └── 001_create_workorder_tables.sql
```

**职责**: 定义数据表结构, 状态枚举, 字段校验

### Layer 2: 状态机引擎 (Day 3-4)

```
src/state_machine/
├── approval_state_machine.py  # 状态机核心引擎
├── guards.py                  # 流转守卫函数
└── transitions.py             # 流转规则定义

src/engine/
└── guards.py                  # 通用守卫实现
```

**职责**: 
- 定义状态流转规则
- 实现流转前置校验
- 提供状态查询接口

### Layer 3: 领域层 (Day 4-5)

```
src/domain/entities/
└── work_order.py              # 工单领域实体 + 核心方法

src/notifications/
└── events.py                  # 领域事件定义
```

**职责**:
- 工单实体行为封装
- 状态变更业务规则
- 事件发布

### Layer 4: Repository层 (Day 5-6)

```
src/infrastructure/database/
└── repositories.py            # 工单仓储实现

src/repositories/
└── retirement_repository.py   # 关联仓储
```

**职责**: 数据持久化, 查询封装

### Layer 5: Application Commands (Day 6-7)

```
src/application/commands/
├── create_work_order.py      # 创建工单命令
├── approve_work_order.py      # 审批通过命令
└── reject_work_order.py       # 审批驳回命令
```

**职责**: 请求处理, 业务编排, 事务边界

### Layer 6: Service层 (Day 7-8)

```
src/services/
├── work_order_service.py      # 工单业务服务
├── approval_service.py        # 审批业务服务
├── approval_chain_service.py  # 审批链服务
└── notification_service.py    # 通知服务

src/application/services/
├── work_order_service.py
├── notification_service.py
└── status_history_service.py
```

**职责**: 业务逻辑封装, 服务编排

### Layer 7: API层 (Day 8-9)

```
src/api/routes/
└── work_orders.py            # 工单路由

src/api/routers/
├── workorder_router.py
└── retirement_router.py

src/schemas/
└── approval.py               # Pydantic模型
```

**职责**: HTTP接口定义, 请求校验, 响应格式化

### Layer 8: 前端组件 (Day 9-12)

```
frontend/src/router/
└── approval.ts              # 审批路由配置

frontend/src/app/pages/AuditDashboard/components/FilterBar/
└── FilterBar.module.css     # 工单筛选组件样式

frontend/src/pages/WorkOrder/
├── WorkOrderList.tsx
├── WorkOrderForm.tsx
└── WorkOrderDetail.tsx
```

**职责**: 前端交互, 表单验证, UI展示

### Layer 9: 消息队列 (Day 12-13)

```
src/infrastructure/messaging/
├── publisher.py               # 事件发布器
└── consumers/
    └── notification_consumer.py # 通知消费者
```

**职责**: 异步消息投递, 通知发送

### Layer 10: 集成测试 (Day 14-15)

```
tests/
├── unit/
│   └── test_state_machine.py
├── integration/
│   └── test_workorder_api.py
└── e2e/
    └── approval.spec.ts
```

**职责**: 全链路验证, 端到端测试

---

## 10. 关键文件清单

### 交付物文件 (按相关度排序)

| 文件路径 | 相关度 | 行数 | 描述 |
|----------|--------|------|------|
| `src/application/commands/create_work_order.py` | - | - | 创建工单命令 [核心] |
| `frontend/src/router/approval.ts` | 3 | 144 | 前端审批路由配置 |
| `src/state_machine/approval_state_machine.py` | 3 | 162 | 状态机核心引擎 |
| `src/models/workorder.py` | 3 | 95 | 工单数据模型 |
| `src/domain/entities/work_order.py` | 3 | 282 | 工单领域实体 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 2 | 417 | 筛选组件样式 |

### 依赖文件 (需保持兼容)

| 文件路径 | 用途 |
|----------|------|
| `src/services/approval_service.py` | 审批服务 |
| `src/services/notification_service.py` | 通知服务 |
| `src/services/approval_chain_service.py` | 审批链服务 |
| `src/notifications/events.py` | 领域事件 |
| `src/application/services/status_history_service.py` | 状态历史服务 |

---

## 11. 验收标准汇总

| AC ID | 验收标准 | 验证方法 | 状态 |
|-------|----------|----------|------|
| AC-001 | 单元测试通过率 100% | pytest | pending |
| AC-002 | 集成测试通过率 100% | pytest | pending |
| AC-003 | AST静态检查通过 | py_compile | pending |
| AC-004 | 所有修改函数含docstring | 静态分析 | pending |
| AC-005 | 模块可正常import | 导入测试 | pending |

---

## 12. 非功能性要求

| 维度 | 要求 |
|------|------|
| 性能 | 工单创建API响应时间 < 500ms |
| 可用性 | 系统可用性 99.9% |
| 安全 | 审批操作需JWT鉴权, 操作日志留存 |
| 可观测性 | 所有状态变更记录审计日志 |

---

## 附录 A: 错误码定义

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| VALIDATION_ERROR | 400 | 请求参数校验失败 |
| INVALID_TRANSITION | 422 | 非法状态流转 |
| PERMISSION_DENIED | 403 | 无审批权限 |
| DUPLICATE_APPROVAL | 409 | 重复审批 |
| VERSION_CONFLICT | 409 | 乐观锁版本冲突 |
| PENDING_LIMIT_EXCEEDED | 429 | 待审批工单超限 |
| WORK_ORDER_NOT_FOUND | 404 | 工单不存在 |
| INTERNAL_ERROR | 500 | 内部错误 |

---

## 附录 B: 术语表

| 术语 | 定义 |
|------|------|
| WorkOrder | 工单, 审批流程的业务载体 |
| ApprovalChain | 审批链, 由多个ApprovalNode组成 |
| ApprovalNode | 审批节点, 代表一个审批环节 |
| StateMachine | 状态机, 约束状态流转规则 |
| Guard | 守卫, 流转前置条件校验 |