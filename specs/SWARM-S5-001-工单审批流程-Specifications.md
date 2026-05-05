# SWARM-S5-001 工单审批流程 Specifications

## 需求与背景

### 业务场景
GSD（Global Service Desk）系统需要支持标准化的工单审批流程。用户可在前端提交审批工单，后端基于状态机实现审批节点的自动流转，审批结果（通过/驳回）触发对应的通知机制。

### 核心能力要求
| 能力项 | 描述 |
|--------|------|
| 工单创建 | 用户填写工单表单并提交 |
| 状态机流转 | 审批节点按预定义规则自动流转 |
| 审批动作 | 审批人可执行通过/驳回操作 |
| 通知触发 | 审批结果变更时自动发送通知 |

### 技术驱动因素
- 统一工单状态管理，避免硬编码状态判断
- 审批流程可配置化，降低业务变更成本
- 事件驱动通知，保障审批结果及时触达

---

## 当前 Phase 对应实施目标

### Phase 1: 核心状态机与工单创建
**目标**: 实现工单的基础CRUD + 状态机流转框架

| 交付物 | 说明 |
|--------|------|
| 工单数据模型 | 包含工单号、标题、申请人、当前状态、审批节点链 |
| 状态机定义 | 预定义状态：`PENDING` → `APPROVING` → `APPROVED` / `REJECTED` |
| 工单创建API | `POST /api/v1/work-orders` |
| 状态流转API | `POST /api/v1/work-orders/{id}/approve` / `reject` |

### Phase 2: 前端交互与通知集成
**目标**: 完成前端表单与通知服务对接

| 交付物 | 说明 |
|--------|------|
| 工单提交表单 | React组件，支持表单校验 |
| 审批操作界面 | 审批人可查看详情并执行审批 |
| 通知触发器 | 审批完成后向消息队列投递通知事件 |

---

## 边界约束

### 功能边界
```
[约束项] 不支持的功能范围
├─ 多级会签审批（Phase3独立交付）
├─ 审批时限自动催办
├─ 工单转发与委托
└─ 移动端离线提交
```

### 技术边界
| 约束维度 | 具体限制 |
|----------|----------|
| 状态机实现 | 仅支持单向线性流转，不支持条件分支 |
| 通知渠道 | 仅支持Email + 企业微信Webhook |
| 并发控制 | 乐观锁机制，version字段控制 |
| 工单数量上限 | 单用户同一时间最多50个PENDING工单 |

### 数据约束
```
工单状态枚举: PENDING | APPROVING | APPROVED | REJECTED | CANCELLED
审批节点状态: PENDING | APPROVED | REJECTED
状态流转规则:
  - PENDING → APPROVING (提交动作)
  - APPROVING → APPROVED (审批通过)
  - APPROVING → REJECTED (审批驳回)
  - APPROVED/REJECTED → CANCELLED (用户撤销，仅限创建者)
```

---

## 验收测试基准 (ATB)

> **目标文件**: `tests/backend/test_state_machine.py`

### ATB-1: 工单创建

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-1.1 | POST `/api/v1/work-orders` with valid payload | HTTP 201, 返回工单ID, 状态=PENDING | pytest |
| ATB-1.2 | POST `/api/v1/work-orders` with missing required fields | HTTP 400, error_detail包含缺失字段 | pytest |
| ATB-1.3 | 工单创建后状态机初始化 | 数据库work_orders表status=PENDING, 初始节点链存在 | MySQL query |
| ATB-1.4 | 前端表单提交成功 | UI Toast提示"工单已提交", 跳转详情页 | Playwright |

### ATB-2: 状态机流转

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-2.1 | POST `/api/v1/work-orders/{id}/approve` | HTTP 200, status变更=APPROVED, 流转时间戳更新 | pytest |
| ATB-2.2 | POST `/api/v1/work-orders/{id}/reject` with reason | HTTP 200, status=REJECTED, reason字段存储 | pytest |
| ATB-2.3 | 重复审批同一工单 | HTTP 409 Conflict, 错误码DUPLICATE_APPROVAL | pytest |
| ATB-2.4 | 对非APPROVING状态工单执行审批 | HTTP 422 Unprocessable Entity | pytest |
| ATB-2.5 | 无权限用户执行审批 | HTTP 403 Forbidden | pytest |

### ATB-3: 通知触发

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-3.1 | 工单审批通过后 | 消息队列存在type=APPROVAL_RESULT的event | Redis/RabbitMQ client |
| ATB-3.2 | 工单审批驳回后 | 消息队列event包含rejected_by, reject_reason | Redis/RabbitMQ client |
| ATB-3.3 | 通知消费者处理 | Email已发送或Webhook已推送 | Mock server验证 |
| ATB-3.4 | 通知发送失败重试 | 重试机制触发，3次重试后进入死信队列 | pytest + mock |

### ATB-4: 边界与异常

| 测试编号 | 物理测试用例 | 期待结果 | 测试工具 |
|----------|--------------|----------|----------|
| ATB-4.1 | 工单数量超限（≥50条PENDING） | HTTP 429 Too Many Requests | pytest |
| ATB-4.2 | 工单创建者撤销已审批工单 | HTTP 400, 错误码INVALID_TRANSITION | pytest |
| ATB-4.3 | 并发审批同一工单 | 仅一个请求成功，另一个返回409 | pytest (concurrent) |
| ATB-4.4 | 工单详情查询 | HTTP 200, 返回完整节点链与审批历史 | pytest |

---

## 开发切入层级序列

### Layer 1: 数据层 (Day 1-2)
```
/backend/app/models/
├── work_order.py          # 工单数据模型 + 状态枚举
├── approval_node.py       # 审批节点模型
└── work_order_history.py  # 审批历史记录

/backend/app/migrations/
└── 001_create_work_order_tables.sql
```

### Layer 2: 状态机引擎 (Day 3-4)
```
/backend/app/state_machine/
├── engine.py              # 状态机核心引擎
├── transitions.py         # 流转规则定义
└── validators.py          # 流转前置校验

/backend/app/events/
└── approval_events.py     # 状态变更事件定义
```

### Layer 3: Repository层 (Day 4-5)
```
/backend/app/repositories/
├── work_order_repo.py     # 工单仓储
└── approval_node_repo.py  # 审批节点仓储
```

### Layer 4: Service层 (Day 6-7)
```
/backend/app/services/
├── work_order_service.py  # 工单业务逻辑
├── approval_service.py    # 审批业务逻辑
└── notification_service.py # 通知服务接口
```

### Layer 5: API层 (Day 8-9)
```
/backend/app/api/v1/
├── work_orders.py         # 工单路由
└── approvals.py           # 审批路由

/backend/app/schemas/
├── work_order_schema.py   # Pydantic请求/响应模型
└── approval_schema.py
```

### Layer 6: 通知消费者 (Day 10)
```
/backend/app/workers/
├── notification_consumer.py  # 消息队列消费者
└── channels/
    ├── email_channel.py       # Email通知通道
    └── webhook_channel.py     # 企业微信Webhook通道
```

### Layer 7: 前端组件 (Day 11-14)
```
/frontend/src/pages/work-orders/
├── WorkOrderList.tsx       # 工单列表页
├── WorkOrderForm.tsx       # 工单提交表单
└── WorkOrderDetail.tsx     # 工单详情+审批操作

/frontend/src/components/
├── StatusBadge.tsx         # 状态徽章组件
└── ApprovalActions.tsx     # 审批操作组件
```

### Layer 8: 集成测试 (Day 15)
```
/tests/integration/
├── test_work_order_flow.py    # 全链路流程测试
└── test_notification_trigger.py # 通知触发测试

/tests/e2e/
└── work_order_approval.spec.ts  # Playwright E2E测试
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
Response:
  id: string (uuid)
  status: "PENDING"
  created_at: datetime
```

### 执行审批
```yaml
POST /api/v1/work-orders/{id}/approve
POST /api/v1/work-orders/{id}/reject
Request:
  comment: string (optional, max: 500)
Response:
  id: string
  status: "APPROVED" | "REJECTED"
  approved_by: string
  approved_at: datetime
```