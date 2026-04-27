# SWARM-S5-001 工单审批流程 - 规格指导文档

## 版本

| 属性 | 值 |
|------|-----|
| 文档标识 | SPEC-SWARM-S5-001 |
| 迭代版本 | V1.0 |
| 制定日期 | 2025-01-20 |

---

## 需求与背景

### 业务背景

工单审批流程是企业运维/ITIL流程的核心环节。当工单创建后流转至审批节点时，需由审批人执行"审批通过"或"审批驳回"操作，决定工单的后续走向。本需求覆盖工单状态机流转、审批接口实现、审批界面开发、以及审批触发后的通知机制。

### 功能范围

| 功能模块 | 具体内容 |
|---------|---------|
| 状态机实现 | 定义工单状态集合与状态转换规则，屏蔽非法状态跃迁 |
| 后端审批API | 提供审批/驳回REST接口，处理业务逻辑与持久化 |
| 前端审批UI | 审批人查看工单详情、执行审批操作、查看审批历史 |
| 待审批通知 | 工单进入待审批状态后，向审批人推送通知 |
| 审批历史记录 | 记录每次审批的时间、操作人、结果、意见 |

---

## 当前 Phase 对应实施目标

> 参照 plan.md Phase 拆解，本次 Iteration 1 定位为 **Phase 1: 核心链路实现**

### Phase 1 目标范围

```
Phase 1: 核心链路实现 (本次迭代)
├── 1.1 工单状态机建模与基础服务层
├── 1.2 审批API实现 (approve/reject)
├── 1.3 前端审批页面基础版本
└── 1.4 审批通知机制基础版本

Phase 2: 增强与扩展 (后续迭代)
├── 2.1 会签/或签审批模式
├── 2.2 审批权限细化与委托
└── 2.3 审批超时自动处理
```

**本次 Iteration 1 交付目标**：

- 工单状态机可工作，支持 `PENDING_APPROVAL` ↔ `APPROVED` / `REJECTED` 之间的转换
- 审批API可被前端调用，持久化审批结果至数据库
- 前端审批UI可展示工单详情并提供审批按钮
- 审批提交后触发通知消息至消息队列

---

## 边界约束

### 功能边界

| 约束项 | 具体说明 |
|-------|---------|
| 审批粒度 | 仅支持单工单审批，不支持批量审批 |
| 审批层级 | 仅支持单层级审批（不含会签/或签） |
| 状态约束 | 状态机强制约束：只有 `PENDING_APPROVAL` 状态的工单可被审批 |
| 通知范围 | 仅向当前审批人发送通知，不包含抄送 |
| 数据一致性 | 审批操作必须原子性完成：状态变更 + 历史记录 + 通知入队 |
| 幂等性 | 同一工单重复提交相同审批结果必须幂等处理，返回成功而非报错 |

### 技术边界

| 约束项 | 具体说明 |
|-------|---------|
| 前端框架 | 使用 React + Ant Design |
| 后端框架 | 使用 Python FastAPI |
| 数据库 | PostgreSQL，事务隔离级别 READ COMMITTED |
| 消息队列 | RabbitMQ / Redis Stream |
| API风格 | RESTful，JSON格式交互 |
| 认证方式 | Header携带 Bearer Token（Mock阶段可跳过） |

### 明确排除范围

- 审批流程配置化（审批节点由代码硬编码）
- 加签/转审功能
- 审批时效 SLA 监控
- 移动端适配

---

## 验收测试基准 (ATB)

### 核心验收条件

| # | 验收项 | 测试方法 | 成功判定标准 |
|---|--------|---------|-------------|
| ATB-1 | 状态机正确流转 | pytest 单测 | `PENDING_APPROVAL` → `APPROVED` 转换返回新状态，`REJECTED` 同理 |
| ATB-2 | 非法状态转换被阻止 | pytest 异常测试 | 对 `COMPLETED` 状态工单调用审批接口，抛出 `InvalidStateTransitionError` |
| ATB-3 | 审批API返回正确结构 | pytest API测试 | POST `/api/v1/wo/{id}/approve` 返回 200，body 含 `status=APPROVED` |
| ATB-4 | 审批驳回API正确响应 | pytest API测试 | POST `/api/v1/wo/{id}/reject` 返回 200，body 含 `status=REJECTED` |
| ATB-5 | 审批历史被持久化 | pytest DB验证 | 审批后查询 `approval_history` 表，记录数+1，字段完整 |
| ATB-6 | 审批后通知入队 | pytest mock测试 | 审批后检查消息队列调用，参数含工单ID与审批人ID |
| ATB-7 | 前端审批页面可渲染 | Playwright E2E | 访问审批页面，审批按钮可见 |
| ATB-8 | 前端审批操作触发API | Playwright E2E | 点击审批按钮，网络请求包含正确工单ID与操作类型 |
| ATB-9 | 幂等性保障 | pytest 重复测试 | 同一工单提交两次审批，第二次返回200而非409 |
| ATB-10 | 待审批工单列表查询 | pytest API测试 | GET `/api/v1/wo/pending-approval?approver_id=X` 返回该审批人的待审工单列表 |

### ATB-1 详细测试用例（状态机）

```python
# tests/unit/test_state_machine.py
def test_pending_to_approved():
    wo = WorkOrder(id="WO-001", status=WorkOrderStatus.PENDING_APPROVAL)
    new_status = wo.transition(ApprovalAction.APPROVE)
    assert new_status == WorkOrderStatus.APPROVED

def test_pending_to_rejected():
    wo = WorkOrder(id="WO-001", status=WorkOrderStatus.PENDING_APPROVAL)
    new_status = wo.transition(ApprovalAction.REJECT)
    assert new_status == WorkOrderStatus.REJECTED

def test_invalid_transition_completed():
    wo = WorkOrder(id="WO-001", status=WorkOrderStatus.COMPLETED)
    with pytest.raises(InvalidStateTransitionError):
        wo.transition(ApprovalAction.APPROVE)
```

### ATB-3/ATB-4 详细测试用例（审批API）

```python
# tests/api/test_approval.py
def test_approve_endpoint_returns_200():
    response = client.post("/api/v1/wo/WO-001/approve", json={"comment": "OK"})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "APPROVED"

def test_reject_endpoint_returns_200():
    response = client.post("/api/v1/wo/WO-001/reject", json={"comment": "不符合要求"})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "REJECTED"
```

### ATB-7/ATB-8 详细测试用例（前端E2E）

```typescript
// tests/e2e/approval.spec.ts
test('审批页面渲染与操作', async ({ page }) => {
  await page.goto('/wo/approval/WO-001');
  await expect(page.getByRole('button', { name: '审批通过' })).toBeVisible();
  await expect(page.getByRole('button', { name: '审批驳回' })).toBeVisible();

  await page.getByRole('button', { name: '审批通过' }).click();
  await expect(page.getByText('审批成功')).toBeVisible();
});
```

---

## 开发切入层级序列

### 第一层：状态机与数据模型

```
1. 定义枚举 WorkOrderStatus
   - DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED

2. 定义枚举 ApprovalAction
   - SUBMIT, APPROVE, REJECT, CANCEL

3. 状态转换矩阵（硬编码）
   PENDING_APPROVAL + APPROVE → APPROVED
   PENDING_APPROVAL + REJECT  → REJECTED
   非法组合 → 抛出 InvalidStateTransitionError

4. 数据模型
   - WorkOrder: id, title, description, status, current_approver_id, created_at, updated_at
   - ApprovalHistory: id, wo_id, approver_id, action, comment, created_at
```

### 第二层：服务层（Business Logic）

```
文件: app/services/approval_service.py

函数: get_pending_approvals(approver_id: str) -> List[WorkOrder]
函数: approve_work_order(wo_id: str, approver_id: str, comment: str) -> WorkOrder
函数: reject_work_order(wo_id: str, approver_id: str, comment: str) -> WorkOrder

核心逻辑:
  1. 校验工单存在性
  2. 校验当前审批人权限
  3. 执行状态机转换
  4. 持久化状态变更
  5. 记录审批历史
  6. 发布通知消息
```

### 第三层：后端API

```
POST /api/v1/wo/{wo_id}/approve
  Request:  { "comment": "string" }
  Response: { "code": 0, "data": { "id": "...", "status": "APPROVED" } }

POST /api/v1/wo/{wo_id}/reject
  Request:  { "comment": "string" }
  Response: { "code": 0, "data": { "id": "...", "status": "REJECTED" } }

GET /api/v1/wo/pending-approval?approver_id={id}
  Response: { "code": 0, "data": [WorkOrder...] }
```

### 第四层：前端审批UI

```
页面: /wo/approval/[id]
组件结构:
  - WorkOrderDetailCard      # 工单基本信息展示
  - ApprovalActionBar        # 审批通过/驳回按钮
  - ApprovalHistoryTimeline  # 审批历史时间线
  - CommentInput             # 审批意见输入框

交互流程:
  1. 页面加载 → 调用 GET /api/v1/wo/{id} 获取工单详情
  2. 用户点击审批按钮 → 调用 POST /api/v1/wo/{id}/approve
  3. API返回成功 → 显示成功Toast → 刷新页面状态
```

### 第五层：通知机制

```
RabbitMQ Exchange: workorder.notifications
Routing Key: approval.pending

Message Payload:
{
  "event_type": "APPROVAL_REQUIRED",
  "wo_id": "WO-001",
  "approver_id": "USER-123",
  "wo_title": "服务器扩容申请",
  "timestamp": "2025-01-20T10:30:00Z"
}
```

### 开发顺序与依赖关系

```
Week 1 Day 1-2: 状态机与数据模型（无外部依赖）
Week 1 Day 3-4: 服务层业务逻辑（依赖层1）
Week 2 Day 1-2: 后端API接口（依赖层2）
Week 2 Day 3-5: 前端审批UI（依赖层3）
Week 3 Day 1-2: 通知机制集成（依赖层3）
Week 3 Day 3-5: 端到端测试与Bug修复
```

---

## API 规范摘要

### Approve 接口

```
POST /api/v1/wo/{wo_id}/approve
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "comment": "审批通过，同意实施"
}

Response 200:
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "WO-001",
    "status": "APPROVED",
    "updated_at": "2025-01-20T10:30:00Z",
    "approved_by": "USER-123"
  }
}

Response 400 (非法状态):
{
  "code": 40001,
  "message": "工单当前状态不允许审批操作"
}

Response 403 (无权限):
{
  "code": 40301,
  "message": "当前用户不是该工单的审批人"
}
```

### Reject 接口

```
POST /api/v1/wo/{wo_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "comment": "驳回：预算不足"
}

Response 200:
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "WO-001",
    "status": "REJECTED",
    "updated_at": "2025-01-20T10:30:00Z",
    "rejected_by": "USER-123"
  }
}
```

---

## 关键数据结构

```python
# 状态枚举
class WorkOrderStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

# 审批操作枚举
class ApprovalAction(str, Enum):
    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"

# 状态转换规则（硬编码）
STATE_TRANSITIONS = {
    (WorkOrderStatus.PENDING_APPROVAL, ApprovalAction.APPROVE): WorkOrderStatus.APPROVED,
    (WorkOrderStatus.PENDING_APPROVAL, ApprovalAction.REJECT): WorkOrderStatus.REJECTED,
}
```

---

## 异常处理规范

| 异常码 | 异常类 | 触发场景 | HTTP状态码 |
|-------|-------|---------|-----------|
| 40001 | `InvalidStateTransitionError` | 非法状态转换 | 400 |
| 40401 | `WorkOrderNotFoundError` | 工单不存在 | 404 |
| 40301 | `ApproverPermissionError` | 非审批人操作 | 403 |
| 40901 | `DuplicateApprovalError` | 重复审批（幂等处理后返回成功） | - |

---

*本规格文档为 SWARM-S5-001 Iteration 1 的实施基准，后续迭代需以此版本为基础进行扩展。*