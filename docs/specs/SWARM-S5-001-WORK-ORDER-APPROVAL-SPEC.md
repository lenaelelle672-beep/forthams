# SWARM-S5-001 工单审批流程 Specifications

## 需求与背景

### 业务场景
GSD（Global Service Desk）系统需要支持标准化的工单审批流程。用户可在前端提交审批工单，后端基于状态机实现审批节点的自动流转，审批结果（通过/驳回）触发对应的通知机制。

### 核心能力要求

| 能力项 | 描述 | 优先级 |
|--------|------|--------|
| 工单创建 | 用户填写工单表单并提交至审批队列 | P0 |
| 状态机流转 | 审批节点按预定义规则自动流转 | P0 |
| 审批动作 | 审批人可执行通过/驳回操作 | P0 |
| 通知触发 | 审批结果变更时自动发送通知 | P1 |
| 审批历史 | 记录完整的审批轨迹和时间戳 | P1 |

### 技术驱动因素

- **统一状态管理**：通过状态机引擎统一管理工单状态流转，避免硬编码状态判断
- **审批流程可配置化**：审批链配置与业务逻辑解耦，降低业务变更成本
- **事件驱动通知**：基于发布-订阅模式，确保审批结果及时触达相关方

---

## 当前 Phase 对应实施目标

### Phase 1: 核心状态机与工单创建
**目标**: 实现工单的基础CRUD + 状态机流转框架

| 交付物 | 说明 | 文件路径 |
|--------|------|----------|
| 工单数据模型 | 包含工单号、标题、申请人、当前状态、审批节点链 | `src/models/workorder.py` |
| 状态机引擎 | 核心状态转换逻辑与守卫校验 | `src/state_machine/approval_state_machine.py` |
| 状态转换定义 | 预定义状态及转换规则 | `src/state_machine/transitions.py` |
| 状态守卫 | 状态转换前置条件校验 | `src/state_machine/guards.py` |
| 工单创建API | `POST /api/v1/work-orders` | `src/api/routes/work_orders.py` |
| 状态流转API | `POST /api/v1/work-orders/{id}/approve` / `reject` | `src/services/approval_service.py` |

### Phase 2: 前端交互与通知集成
**目标**: 完成前端表单与通知服务对接

| 交付物 | 说明 | 文件路径 |
|--------|------|----------|
| 工单提交表单 | React组件，支持表单校验 | `frontend/src/router/approval.ts` |
| 审批操作界面 | 审批人可查看详情并执行审批 | `frontend/src/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` |
| 通知触发器 | 审批完成后向消息队列投递通知事件 | `src/application/services/notification_service.py` |
| 通知消费者 | 消息队列消费者处理通知投递 | `src/infrastructure/messaging/consumers/notification_consumer.py` |

---

## 边界约束

### 功能边界

```
[支持的功能范围]
├─ 工单创建与提交
├─ 单级审批（通过/驳回）
├─ 审批历史记录
├─ 状态变更通知
└─ 乐观锁并发控制

[不支持的功能范围] — Phase 3 独立交付
├─ 多级会签审批
├─ 审批时限自动催办
├─ 工单转发与委托
├─ 移动端离线提交
└─ 审批意见模板
```

### 技术边界

| 约束维度 | 具体限制 | 来源 |
|----------|----------|------|
| 状态机实现 | 仅支持单向线性流转，不支持条件分支 | `transitions.py` |
| 通知渠道 | 仅支持Email + 企业微信Webhook | `notification_service.py` |
| 并发控制 | 乐观锁机制，version字段控制 | `approval_state_machine.py` |
| 工单数量上限 | 单用户同一时间最多50个PENDING工单 | `WorkOrderService` |
| 审批超时 | 无自动超时机制，需人工处理 | 范围外 |

### 数据约束

```python
# 工单状态枚举
class WorkOrderState(Enum):
    DRAFT = "DRAFT"           # 草稿
    PENDING = "PENDING"       # 待提交
    APPROVING = "APPROVING"   # 审批中
    APPROVED = "APPROVED"     # 已通过
    REJECTED = "REJECTED"     # 已驳回
    CANCELLED = "CANCELLED"   # 已撤销
    CLOSED = "CLOSED"         # 已关闭

# 审批节点状态
class ApprovalNodeState(Enum):
    PENDING = "PENDING"       # 待审批
    APPROVED = "APPROVED"     # 已通过
    REJECTED = "REJECTED"     # 已驳回
    SKIPPED = "SKIPPED"       # 已跳过

# 状态流转规则
TRANSITIONS = {
    "submit": (WorkOrderState.PENDING, WorkOrderState.APPROVING),
    "approve": (WorkOrderState.APPROVING, WorkOrderState.APPROVED),
    "reject": (WorkOrderState.APPROVING, WorkOrderState.REJECTED),
    "cancel": (WorkOrderState.PENDING, WorkOrderState.CANCELLED),
    "close": (WorkOrderState.APPROVED, WorkOrderState.CLOSED),
    "revise": (WorkOrderState.REJECTED, WorkOrderState.DRAFT),
}
```

---

## 验收测试基准 (ATB)

### ATB-1: 工单创建

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 | 验证文件 |
|----------|--------------|----------|----------|----------|
| ATB-1.1 | POST `/api/v1/work-orders` with valid payload | HTTP 201, 返回工单ID, 状态=PENDING | pytest | `tests/api/test_work_order_submit.py` |
| ATB-1.2 | POST `/api/v1/work-orders` with missing required fields | HTTP 400, error_detail包含缺失字段 | pytest | `tests/api/test_work_order_validation.py` |
| ATB-1.3 | 工单创建后状态机初始化 | 数据库work_orders表status=PENDING, 初始节点链存在 | MySQL query | `tests/integration/test_workorder_api.py` |
| ATB-1.4 | 前端表单提交成功 | UI Toast提示"工单已提交", 跳转详情页 | Playwright | `frontend/tests/e2e/approval.spec.ts` |

### ATB-2: 状态机流转

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 | 验证文件 |
|----------|--------------|----------|----------|----------|
| ATB-2.1 | POST `/api/v1/work-orders/{id}/approve` | HTTP 200, status变更=APPROVED, 流转时间戳更新 | pytest | `tests/api/test_work_order_approve.py` |
| ATB-2.2 | POST `/api/v1/work-orders/{id}/reject` with reason | HTTP 200, status=REJECTED, reason字段存储 | pytest | `tests/api/test_work_order_reject.py` |
| ATB-2.3 | 重复审批同一工单 | HTTP 409 Conflict, 错误码DUPLICATE_APPROVAL | pytest | `tests/api/test_work_order_idempotent.py` |
| ATB-2.4 | 对非APPROVING状态工单执行审批 | HTTP 422 Unprocessable Entity | pytest | `tests/backend/test_state_machine.py` |
| ATB-2.5 | 无权限用户执行审批 | HTTP 403 Forbidden | pytest | `tests/api/test_approval_api.py` |
| ATB-2.6 | 并发审批同一工单 | 仅一个请求成功，另一个返回409 | pytest | `tests/concurrency/test_approve_race_condition.py` |

### ATB-3: 通知触发

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 | 验证文件 |
|----------|--------------|----------|----------|----------|
| ATB-3.1 | 工单审批通过后 | 消息队列存在type=APPROVAL_RESULT的event | Redis/RabbitMQ client | `tests/integration/test_approval_chain.py` |
| ATB-3.2 | 工单审批驳回后 | 消息队列event包含rejected_by, reject_reason | Redis/RabbitMQ client | `tests/integration/test_approval_chain.py` |
| ATB-3.3 | 通知消费者处理 | Email已发送或Webhook已推送 | Mock server验证 | `tests/backend/test_events.py` |
| ATB-3.4 | 通知发送失败重试 | 重试机制触发，3次重试后进入死信队列 | pytest + mock | `tests/backend/test_events.py` |

### ATB-4: 状态守卫校验

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 | 验证文件 |
|----------|--------------|----------|----------|----------|
| ATB-4.1 | PENDING状态执行approve | Guard返回False，抛出StateTransitionError | pytest | `tests/unit/test_state_machine.py` |
| ATB-4.2 | APPROVING状态执行submit | Guard返回False，抛出InvalidTransitionError | pytest | `tests/unit/test_state_machine.py` |
| ATB-4.3 | 非创建者执行cancel | Guard返回False，抛出PermissionDeniedError | pytest | `tests/backend/test_state_machine.py` |
| ATB-4.4 | 乐观锁版本不匹配 | Guard返回False，抛出OptimisticLockError | pytest | `tests/concurrency/test_approve_race_condition.py` |

### ATB-5: 边界与异常

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 | 验证文件 |
|----------|--------------|----------|----------|----------|
| ATB-5.1 | 工单数量超限（≥50条PENDING） | HTTP 429 Too Many Requests | pytest | `tests/api/test_work_order_validation.py` |
| ATB-5.2 | 工单创建者撤销已审批工单 | HTTP 400, 错误码INVALID_TRANSITION | pytest | `tests/api/test_work_order_reject.py` |
| ATB-5.3 | 工单详情查询 | HTTP 200, 返回完整节点链与审批历史 | pytest | `tests/api/test_workorder_api.py` |
| ATB-5.4 | 工单列表分页查询 | HTTP 200, 返回分页结果及总数 | pytest | `tests/api/test_workorder_api.py` |

---

## 开发切入层级序列

### Layer 1: 数据层 (Day 1-2)

```
/src/models/
├── workorder.py              # 工单数据模型 + 状态枚举
├── approval_node.py          # 审批节点模型
├── approval_chain.py         # 审批链模型
└── status_history.py         # 状态历史记录模型

/src/infrastructure/database/
├── models.py                 # ORM模型定义
└── repositories.py           # 数据仓储实现
```

**核心实现要点**:
- `WorkOrder` 模型必须包含: `id`, `title`, `description`, `status`, `version`, `created_by`, `created_at`
- `ApprovalNode` 模型必须包含: `id`, `work_order_id`, `approver_id`, `status`, `order`
- 乐观锁通过 `version` 字段实现

### Layer 2: 状态机引擎 (Day 3-4)

```
/src/state_machine/
├── approval_state_machine.py  # 状态机核心引擎
├── transitions.py              # 流转规则定义
├── guards.py                    # 流转前置校验守卫
└── states.py                   # 状态定义
```

**核心实现要点** — `src/state_machine/transitions.py`:

```python
# 状态转换定义必须包含以下转换规则
class WorkOrderTransitions:
    """工单状态转换定义"""
    
    SUBMIT = "submit"      # PENDING → APPROVING
    APPROVE = "approve"    # APPROVING → APPROVED
    REJECT = "reject"      # APPROVING → REJECTED
    CANCEL = "cancel"      # PENDING → CANCELLED
    CLOSE = "close"        # APPROVED → CLOSED
    REVISE = "revise"      # REJECTED → DRAFT
    
    @classmethod
    def get_allowed_transitions(cls, current_state: WorkOrderState) -> List[str]:
        """获取当前状态允许的转换列表"""
        pass
    
    @classmethod
    def validate_transition(cls, current_state: WorkOrderState, action: str) -> bool:
        """验证状态转换是否合法"""
        pass
```

**核心实现要点** — `src/state_machine/guards.py`:

```python
class TransitionGuards:
    """状态转换守卫集合"""
    
    @staticmethod
    def can_submit(work_order: WorkOrder) -> GuardResult:
        """提交前校验"""
        pass
    
    @staticmethod
    def can_approve(work_order: WorkOrder, approver: User) -> GuardResult:
        """审批前校验"""
        pass
    
    @staticmethod
    def can_reject(work_order: WorkOrder, rejector: User, reason: str) -> GuardResult:
        """驳回前校验"""
        pass
    
    @staticmethod
    def can_cancel(work_order: WorkOrder, user: User) -> GuardResult:
        """撤销前校验"""
        pass
    
    @staticmethod
    def check_optimistic_lock(work_order: WorkOrder, expected_version: int) -> GuardResult:
        """乐观锁校验"""
        pass
```

### Layer 3: Repository层 (Day 4-5)

```
/src/infrastructure/database/repositories.py
```

**核心接口**:

```python
class WorkOrderRepository:
    """工单数据仓储"""
    
    def create(self, work_order: WorkOrder) -> WorkOrder:
        """创建工单"""
        pass
    
    def get_by_id(self, work_order_id: str) -> Optional[WorkOrder]:
        """根据ID查询工单"""
        pass
    
    def update_status(self, work_order_id: str, new_status: WorkOrderState, version: int) -> bool:
        """更新状态（乐观锁）"""
        pass
    
    def list_pending_by_user(self, user_id: str, limit: int = 50) -> List[WorkOrder]:
        """查询用户待审批工单"""
        pass
```

### Layer 4: Service层 (Day 6-7)

```
/src/services/
├── approval_service.py        # 审批业务逻辑
├── approval_chain_service.py   # 审批链服务
├── notification_service.py     # 通知服务接口
└── work_order_service.py       # 工单业务逻辑

/src/application/services/
├── notification_service.py     # 通知应用服务
├── work_order_service.py        # 工单应用服务
└── status_history_service.py    # 状态历史服务
```

**核心实现要点**:

```python
# src/services/approval_service.py
class ApprovalService:
    """审批服务"""
    
    def approve(self, work_order_id: str, approver_id: str, comment: str = None) -> WorkOrder:
        """
        执行审批通过
        
        流程:
        1. 获取工单并校验状态
        2. 执行守卫校验
        3. 更新工单状态
        4. 记录审批历史
        5. 触发通知事件
        """
        pass
    
    def reject(self, work_order_id: str, rejector_id: str, reason: str) -> WorkOrder:
        """
        执行审批驳回
        
        流程:
        1. 获取工单并校验状态
        2. 执行守卫校验（必须提供reason）
        3. 更新工单状态
        4. 记录审批历史
        5. 触发通知事件
        """
        pass
```

### Layer 5: API层 (Day 8-9)

```
/src/api/routes/
├── work_orders.py              # 工单路由

/src/api/schemas/
└── responses.py                 # 统一响应模型

/src/application/commands/
├── create_work_order.py         # 创建工单命令
├── approve_work_order.py        # 审批通过命令
└── reject_work_order.py         # 审批驳回命令
```

**核心接口定义**:

```yaml
# 创建工单
POST /api/v1/work-orders
Request:
  title: string (required, max: 200)
  description: string (required, max: 2000)
  priority: enum [LOW, MEDIUM, HIGH, CRITICAL]
  category_id: string (required)
  attachments: array[object] (optional)
Response:
  id: string (uuid)
  status: "PENDING"
  created_at: datetime
  approval_chain_id: string

# 执行审批通过
POST /api/v1/work-orders/{id}/approve
Request:
  comment: string (optional, max: 500)
  version: int (required, for optimistic lock)
Response:
  id: string
  status: "APPROVED"
  approved_by: string
  approved_at: datetime

# 执行审批驳回
POST /api/v1/work-orders/{id}/reject
Request:
  reason: string (required, max: 500)
  version: int (required, for optimistic lock)
Response:
  id: string
  status: "REJECTED"
  rejected_by: string
  rejected_at: datetime
  reject_reason: string
```

### Layer 6: 通知消费者 (Day 10)

```
/src/infrastructure/messaging/
├── publisher.py                     # 事件发布器
└── consumers/
    └── notification_consumer.py    # 通知消费者

/src/notifications/
└── events.py                        # 通知事件定义
```

**事件定义**:

```python
# src/notifications/events.py
class ApprovalResultEvent:
    """审批结果事件"""
    
    def __init__(self, work_order_id: str, result: str, actor_id: str, 
                 reason: str = None, timestamp: datetime = None):
        self.work_order_id = work_order_id
        self.result = result  # APPROVED or REJECTED
        self.actor_id = actor_id
        self.reason = reason
        self.timestamp = timestamp or datetime.utcnow()
    
    def to_message(self) -> dict:
        """序列化为消息队列格式"""
        pass
```

### Layer 7: 前端组件 (Day 11-14)

```
/frontend/src/router/
└── approval.ts                     # 审批路由配置

/frontend/src/pages/
├── WorkOrder/
│   ├── WorkOrderList.tsx          # 工单列表页
│   ├── WorkOrderForm.tsx          # 工单提交表单
│   └── WorkOrderDetail.tsx        # 工单详情页
└── AuditDashboard/
    └── components/
        └── FilterBar/
            └── FilterBar.module.css # 筛选栏样式

/frontend/src/services/
├── approvalService.ts             # 审批服务调用
└── workorderService.ts            # 工单服务调用
```

### Layer 8: 集成测试 (Day 15)

```
/tests/
├── unit/
│   └── test_state_machine.py      # 状态机单元测试
├── integration/
│   ├── test_workorder_api.py      # 工单API集成测试
│   └── test_approval_chain.py     # 审批链集成测试
├── api/
│   ├── test_work_order_submit.py  # 提交API测试
│   ├── test_work_order_approve.py # 审批通过API测试
│   └── test_work_order_reject.py  # 审批驳回API测试
├── concurrency/
│   └── test_approve_race_condition.py # 并发审批测试
└── e2e/
    └── approval.spec.ts            # Playwright E2E测试
```

---

## 附录

### A. 关键领域实体关系

```
WorkOrder (工单)
    │
    ├── status: WorkOrderState
    ├── version: int (乐观锁)
    ├── created_by: User
    │
    └── approval_chain: ApprovalChain
            │
            └── approval_nodes: List[ApprovalNode]
                    │
                    ├── approver: User
                    ├── status: ApprovalNodeState
                    └── order: int
```

### B. 状态流转图

```
                    ┌─────────────┐
                    │   DRAFT     │
                    └──────┬──────┘
                           │ save
                           ▼
                    ┌─────────────┐
         ┌─────────│   PENDING   │─────────┐
         │ cancel  └──────┬──────┘  submit  │
         │               │                │
         │               ▼                ▼
         │        ┌─────────────┐  ┌─────────────┐
         │        │  APPROVING  │◄─│  (submit)   │
         │        └──────┬──────┘  └─────────────┘
         │               │
         │        ┌──────┴──────┐
         │        │             │
         │        ▼             ▼
         │  ┌───────────┐ ┌───────────┐
         │  │ APPROVED  │ │ REJECTED  │
         │  └─────┬─────┘ └─────┬─────┘
         │        │ close       │ revise
         │        ▼             │
         │  ┌───────────┐       │
         │  │  CLOSED   │       │
         │  └───────────┘       │
         │                      │
         └──────────────────────┘
```

### C. 错误码定义

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| WORK_ORDER_NOT_FOUND | 404 | 工单不存在 |
| INVALID_TRANSITION | 422 | 非法的状态转换 |
| DUPLICATE_APPROVAL | 409 | 重复审批 |
| PERMISSION_DENIED | 403 | 无审批权限 |
| OPTIMISTIC_LOCK_FAILED | 409 | 乐观锁冲突 |
| WORK_ORDER_LIMIT_EXCEEDED | 429 | 工单数量超限 |
| VALIDATION_ERROR | 400 | 请求参数校验失败 |

---

## 文档变更历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-01-15 | GSD Team | 初始版本 |