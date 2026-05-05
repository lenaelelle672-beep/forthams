# SWARM-S5-001 工单审批流程 Specifications

## 1. 需求与背景

### 1.1 业务场景

GSD (Global Service Desk) 系统需要支持标准化的工单审批流程。用户可在前端提交审批工单，后端基于状态机实现审批节点的自动流转，审批结果（通过/驳回）触发对应的通知机制。

### 1.2 核心能力要求

| 能力项 | 描述 |
|--------|------|
| **工单创建** | 用户填写工单表单并提交，状态机初始化审批节点链 |
| **状态机流转** | 审批节点按预定义规则自动流转（pending → approving → approved/rejected） |
| **审批动作** | 审批人可执行通过（approve）或驳回（reject）操作 |
| **通知触发** | 审批结果变更时自动向消息队列投递通知事件 |
| **乐观锁保护** | 并发审批场景下通过 version 字段防止重复操作 |

### 1.3 技术驱动因素

- **统一状态管理**：避免硬编码状态判断，状态机引擎集中管理流转规则
- **审批流程可配置**：审批节点链可扩展，降低业务变更成本
- **事件驱动通知**：审批完成后异步投递事件，通知服务解耦

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 核心状态机与工单创建

**目标**：实现工单的基础 CRUD + 状态机流转框架

| 交付物 | 文件路径 | 说明 |
|--------|----------|------|
| 状态机引擎 | `src/state_machine/approval_state_machine.py` | GuardEvaluator + 6 个流转规则 |
| 工单数据模型 | `src/models/workorder.py` | WorkOrder 主模型 |
| 工单实体 | `src/domain/entities/work_order.py` | 领域实体 + 核心方法 |
| 前端路由 | `frontend/src/router/approval.ts` | 审批页面路由配置 |

### Phase 2: 前端交互与通知集成

**目标**：完成前端表单与通知服务对接

| 交付物 | 文件路径 | 说明 |
|--------|----------|------|
| 工单提交表单 | 前端组件 | React 表单，支持校验 |
| 审批操作界面 | 前端组件 | 审批人可查看详情并执行操作 |
| 通知服务 | `src/services/notification_service.py` | Email + Webhook 双通道 |
| 样式文件 | `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 审批相关 UI 样式 |

---

## 3. 边界约束

### 3.1 功能边界

```
[约束项] 不支持的功能范围
├─ 多级会签审批（Phase 3 独立交付）
├─ 审批时限自动催办
├─ 工单转发与委托
├─ 移动端离线提交
└─ 审批意见模板管理
```

### 3.2 技术边界

| 约束维度 | 具体限制 |
|----------|----------|
| 状态机实现 | 仅支持单向线性流转，不支持条件分支 |
| 通知渠道 | 仅支持 Email + 企业微信 Webhook |
| 并发控制 | 乐观锁机制，version 字段控制 |
| 工单数量上限 | 单用户同一时间最多 50 个 PENDING 工单 |
| API 版本 | v1 版本，路径 `/api/v1/work-orders` |

### 3.3 数据约束

```
工单状态枚举:
  - PENDING      # 待提交/草稿
  - APPROVING    # 审批中
  - APPROVED     # 已通过
  - REJECTED     # 已驳回
  - CANCELLED    # 已撤销

审批节点状态:
  - PENDING
  - APPROVED
  - REJECTED

状态流转规则:
  PENDING → APPROVING      (提交动作: submit)
  APPROVING → APPROVED     (审批通过: approve)
  APPROVING → REJECTED     (审批驳回: reject, 需 reason)
  REJECTED → DRAFT         (退回修改: revise)
  APPROVED/REJECTED → CLOSED (关闭工单)
  APPROVED/REJECTED → CANCELLED (用户撤销，仅限创建者)
```

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 工单创建

| 测试编号 | 物理测试用例 | 期待结果 | 验证方法 |
|----------|--------------|----------|----------|
| ATB-1.1 | POST `/api/v1/work-orders` with valid payload | HTTP 201, 返回工单 ID, status=PENDING | pytest |
| ATB-1.2 | POST `/api/v1/work-orders` with missing required fields | HTTP 400, error_detail 包含缺失字段 | pytest |
| ATB-1.3 | 工单创建后状态机初始化 | 数据库 work_orders 表 status=PENDING, 初始节点链存在 | SQL query |
| ATB-1.4 | 前端表单提交成功 | UI Toast 提示"工单已提交", 跳转详情页 | Playwright |
| ATB-1.5 | 工单数量超限（≥50 条 PENDING） | HTTP 429 Too Many Requests | pytest |

### 4.2 ATB-2: 状态机流转

| 测试编号 | 物理测试用例 | 期待结果 | 验证方法 |
|----------|--------------|----------|----------|
| ATB-2.1 | POST `/api/v1/work-orders/{id}/approve` | HTTP 200, status 变更=APPROVED, 流转时间戳更新 | pytest |
| ATB-2.2 | POST `/api/v1/work-orders/{id}/reject` with reason | HTTP 200, status=REJECTED, reason 字段存储 | pytest |
| ATB-2.3 | 重复审批同一工单 | HTTP 409 Conflict, 错误码 DUPLICATE_APPROVAL | pytest |
| ATB-2.4 | 对非 APPROVING 状态工单执行审批 | HTTP 422 Unprocessable Entity | pytest |
| ATB-2.5 | 无权限用户执行审批 | HTTP 403 Forbidden | pytest |
| ATB-2.6 | 并发审批同一工单 | 仅一个请求成功，另一个返回 409 | pytest (concurrent) |
| ATB-2.7 | GuardEvaluator 校验通过 | transition 执行成功 | pytest |

### 4.3 ATB-3: 通知触发

| 测试编号 | 物理测试用例 | 期待结果 | 验证方法 |
|----------|--------------|----------|----------|
| ATB-3.1 | 工单审批通过后 | 消息队列存在 type=APPROVAL_RESULT 的 event | Redis/RabbitMQ |
| ATB-3.2 | 工单审批驳回后 | 消息队列 event 包含 rejected_by, reject_reason | Redis/RabbitMQ |
| ATB-3.3 | 通知消费者处理 | Email 已发送或 Webhook 已推送 | Mock server |
| ATB-3.4 | 通知发送失败重试 | 重试机制触发，3 次重试后进入死信队列 | pytest + mock |

### 4.4 ATB-4: 边界与异常

| 测试编号 | 物理测试用例 | 期待结果 | 验证方法 |
|----------|--------------|----------|----------|
| ATB-4.1 | 工单创建者撤销已审批工单 | HTTP 400, 错误码 INVALID_TRANSITION | pytest |
| ATB-4.2 | 查询不存在的工单 | HTTP 404 Not Found | pytest |
| ATB-4.3 | version 字段不匹配（乐观锁） | HTTP 409 Conflict | pytest |
| ATB-4.4 | 审批意见超长（>500 字符） | HTTP 400, validation error | pytest |

---

## 5. 开发切入层级序列

### Layer 1: 数据层 (Day 1-2)

```
src/models/
├── workorder.py              # 工单数据模型 + 状态枚举
├── approval_chain.py         # 审批链模型
└── approval_node.py          # 审批节点模型
```

**关键类**:
- `WorkOrder`: id, title, description, status, version, created_by, created_at
- `ApprovalChain`: id, work_order_id, nodes[], current_node_index
- `ApprovalNode`: id, chain_id, status, approver_id, approved_at

### Layer 2: 状态机引擎 (Day 3-4)

```
src/state_machine/
├── approval_state_machine.py  # 状态机核心引擎 + GuardEvaluator
├── transitions.py             # 流转规则定义
└── guards.py                  # Guard 函数集合
```

**关键函数**:
- `GuardEvaluator.evaluate_guard()`: 执行流转前置校验
- `GuardEvaluator.evaluate_pending_to_approving()`: 提交校验
- `GuardEvaluator.evaluate_approving_to_approved()`: 通过校验
- `GuardEvaluator.evaluate_approving_to_rejected()`: 驳回校验
- `GuardEvaluator.evaluate_optimistic_lock()`: 乐观锁校验

### Layer 3: Repository 层 (Day 4-5)

```
src/infrastructure/database/
├── models.py                  # ORM 模型
└── repositories.py            # 数据访问层
```

### Layer 4: Domain 层 (Day 5-6)

```
src/domain/entities/
└── work_order.py              # 领域实体 + 核心方法
```

**关键方法**:
- `WorkOrder.submit()`: 提交工单，触发 PENDING → APPROVING
- `WorkOrder.approve()`: 审批通过，触发 APPROVING → APPROVED
- `WorkOrder.reject()`: 审批驳回，触发 APPROVING → REJECTED

### Layer 5: Service 层 (Day 6-8)

```
src/services/
├── approval_service.py        # 审批业务逻辑
├── approval_chain_service.py  # 审批链管理
└── notification_service.py    # 通知服务接口
```

**关键方法**:
- `ApprovalService.approve()`: 审批通过入口
- `ApprovalService.reject()`: 审批驳回入口
- `ApprovalChainService.build_chain()`: 构建审批节点链
- `NotificationService.dispatch()`: 触发通知事件

### Layer 6: API 层 (Day 8-10)

```
src/api/routes/
└── work_orders.py             # 工单路由
src/api/schemas/
└── responses.py               # 统一响应模型
```

**关键接口**:
```yaml
POST   /api/v1/work-orders              # 创建工单
GET    /api/v1/work-orders/{id}         # 查询工单详情
POST   /api/v1/work-orders/{id}/submit  # 提交工单
POST   /api/v1/work-orders/{id}/approve # 审批通过
POST   /api/v1/work-orders/{id}/reject  # 审批驳回
POST   /api/v1/work-orders/{id}/cancel  # 撤销工单
```

### Layer 7: 前端组件 (Day 11-14)

```
frontend/src/router/
└── approval.ts               # 审批页面路由配置

frontend/src/app/pages/
└── AuditDashboard/components/FilterBar/
    └── FilterBar.module.css  # 审批相关 UI 样式

frontend/src/pages/WorkOrder/
├── types/workOrder.ts        # 工单类型定义
└── api/workOrderApi.ts       # 工单 API 调用
```

### Layer 8: 集成测试 (Day 15)

```
tests/
├── integration/
│   ├── test_workorder_api.py      # 全链路流程测试
│   └── test_approval_chain.py     # 审批链测试
├── e2e/
│   └── approval.spec.ts           # Playwright E2E 测试
└── concurrency/
    └── test_approve_race_condition.py  # 并发测试
```

---

## 6. 附录：关键接口定义

### 6.1 创建工单

```yaml
POST /api/v1/work-orders
Content-Type: application/json

Request:
  title: string (required, max: 200)
  description: string (required, max: 2000)
  priority: enum [LOW, MEDIUM, HIGH, CRITICAL]
  category_id: string (required)
  approver_ids: string[] (required, min: 1)

Response (201 Created):
  id: string (uuid)
  title: string
  status: "PENDING"
  version: integer
  created_at: datetime
  updated_at: datetime
```

### 6.2 执行审批

```yaml
POST /api/v1/work-orders/{id}/approve
POST /api/v1/work-orders/{id}/reject
Content-Type: application/json

Request:
  comment: string (optional, max: 500)
  version: integer (required, for optimistic lock)

Response (200 OK):
  id: string
  title: string
  status: "APPROVED" | "REJECTED"
  version: integer
  approved_by: string
  approved_at: datetime
  comment: string

Error Response (409 Conflict):
  code: "DUPLICATE_APPROVAL"
  message: "工单已被审批，请刷新后重试"
```

### 6.3 事件定义

```python
# src/notifications/events.py
class ApprovalResultEvent:
    event_type = "APPROVAL_RESULT"
    payload = {
        "work_order_id": str,
        "result": "APPROVED" | "REJECTED",
        "actor_id": str,
        "comment": str | None,
        "timestamp": datetime
    }
```

---

## 7. AC 验收 Checklist

| AC ID | 验收标准 | 验证方法 | 状态 |
|-------|----------|----------|------|
| AC-001 | 工单审批流程功能可用（前端提交 + 后端流转 + 通知触发） | 单元测试 | pending |
| AC-002 | 状态机正确处理 pending → approving → approved/rejected | 单元测试 | pending |
| AC-003 | 代码变更不引入新的语法错误 | AST 静态检查 | pending |
| AC-004 | 所有修改的函数包含 docstring 文档注释 | 静态分析 | pending |
| AC-005 | 变更后的模块可被正常 import 不抛出 ImportError | 单元测试 | pending |

---

## 8. 交付物清单

| 序号 | 文件路径 | 修改类型 | 负责人 |
|------|----------|----------|--------|
| 1 | `frontend/src/router/approval.ts` | 修改 | Frontend |
| 2 | `src/state_machine/approval_state_machine.py` | 修改 | Backend |
| 3 | `src/models/workorder.py` | 修改 | Backend |
| 4 | `src/domain/entities/work_order.py` | 修改 | Backend |
| 5 | `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 修改 | Frontend |

---

**文档版本**: v1.0  
**创建日期**: 2024  
**评审状态**: 待评审