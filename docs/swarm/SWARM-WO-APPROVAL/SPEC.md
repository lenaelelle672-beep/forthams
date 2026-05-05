# 工单审批流程规格指导文档

## 需求与背景

### 业务场景

工单审批流程是工单系统的核心流转环节，用于处理需要人工审批的工单。当前系统已完成工单的创建、分配、基础状态管理，但缺少审批决策功能，导致工单无法形成完整的生命周期闭环。

### 核心功能需求

| 功能模块 | 需求描述 |
|---------|---------|
| 审批页面 | 提供审批/驳回操作入口，展示审批历史时间线 |
| 状态机 | 实现 Pending → Approved/Rejected 状态流转 |
| 通知机制 | 审批动作触发相关人员通知 |

### 技术栈约束

- **前端**: Vue 3 + Element Plus + Pinia
- **后端**: FastAPI + SQLAlchemy + PostgreSQL
- **消息队列**: Redis (用于通知异步投递)
- **测试**: pytest + Playwright

---

## 当前 Phase 对应实施目标

参照 `plan.md` 中的 Phase 拆解，本次 Iteration 1 对准 **Phase 3: 审批流程实现**。

### Phase 3 目标分解

```
Phase 3: 审批流程实现
├── 3.1 审批 API 接口开发
│   ├── POST /api/wo/approvals/{id}/approve
│   └── POST /api/wo/approvals/{id}/reject
├── 3.2 状态机核心逻辑
│   ├── 状态转换校验
│   └── 状态持久化
├── 3.3 前端审批页面
│   ├── 审批/驳回按钮组件
│   └── 审批历史时间线组件
├── 3.4 通知触发集成
│   ├── 审批成功通知
│   └── 驳回通知
└── 3.5 单元测试覆盖
```

---

## 边界约束

### 功能边界

| 约束类型 | 具体约束 |
|---------|---------|
| 审批前置条件 | 工单必须处于 `Pending` 状态方可审批 |
| 权限约束 | 仅工单当前处理人具备审批权限 |
| 状态不可逆 | Approved/Rejected 为终态，不可再流转 |
| 驳回必填 | 驳回操作必须填写驳回原因（≥5字符） |
| 审批意见 | 审批操作可选填写意见（≤500字符） |

### 数据边界

| 实体 | 约束 |
|-----|------|
| ApprovalRecord | 审批记录表，记录审批人、时间、动作、意见 |
| WorkOrder | 状态字段更新为 Approved/Rejected |
| Notification | 通知消息异步投递至 Redis |

### 非功能边界

| 指标 | 约束值 |
|-----|-------|
| API 响应时间 | ≤500ms (不含网络延迟) |
| 审批历史查询 | 返回最近 50 条记录 |
| 通知投递延迟 | ≤3s |

---

## 验收测试基准 (ATB)

### 后端单元测试 (pytest)

#### ATB-001: 审批通过状态流转

```python
def test_approve_workorder_status_transition():
    """
    Given: 工单处于 Pending 状态
    When: 调用 POST /api/wo/approvals/{id}/approve
    Then: 
        - HTTP 200
        - 工单状态变更为 Approved
        - 返回工单更新后的完整对象
        - 创建审批记录
    """
```

#### ATB-002: 审批驳回状态流转

```python
def test_reject_workorder_status_transition():
    """
    Given: 工单处于 Pending 状态
    When: 调用 POST /api/wo/approvals/{id}/reject with {"reason": "驳回原因"}
    Then:
        - HTTP 200
        - 工单状态变更为 Rejected
        - 驳回原因持久化
    """
```

#### ATB-003: 非法状态转换校验

```python
def test_cannot_approve_already_approved():
    """
    Given: 工单已处于 Approved 状态
    When: 调用 POST /api/wo/approvals/{id}/approve
    Then:
        - HTTP 400
        - error_code = "INVALID_STATE_TRANSITION"
    """
```

#### ATB-004: 驳回原因必填校验

```python
def test_reject_requires_reason():
    """
    Given: 工单处于 Pending 状态
    When: 调用 POST /api/wo/approvals/{id}/reject with {} (空原因)
    Then:
        - HTTP 422
        - validation_error.reason = "required"
    """
```

#### ATB-005: 审批权限校验

```python
def test_approve_forbidden_for_non_handler():
    """
    Given: 当前用户非工单处理人
    When: 调用 POST /api/wo/approvals/{id}/approve
    Then:
        - HTTP 403
        - error_code = "FORBIDDEN"
    """
```

#### ATB-006: 审批历史查询

```python
def test_get_approval_history():
    """
    Given: 工单存在 3 条审批记录
    When: 调用 GET /api/wo/approvals/{id}/history
    Then:
        - HTTP 200
        - 返回包含 3 条记录的列表
        - 每条记录包含: approver_id, action, comment, created_at
    """
```

#### ATB-007: 通知消息发送

```python
def test_notification_published_on_approval():
    """
    Given: 工单处于 Pending 状态
    When: 调用 POST /api/wo/approvals/{id}/approve
    Then:
        - Redis 收到类型为 approval_notification 的消息
        - 消息包含工单 ID、审批结果、审批人信息
    """
```

### 前端 E2E 测试 (Playwright)

#### ATB-101: 审批页面元素展示

```typescript
test('审批页面正确展示审批/驳回按钮和历史时间线', async ({ page }) => {
  await page.goto('/wo/approval/123');
  
  // 断言审批按钮存在
  await expect(page.getByRole('button', { name: '审批通过' })).toBeVisible();
  
  // 断言驳回按钮存在
  await expect(page.getByRole('button', { name: '驳回' })).toBeVisible();
  
  // 断言时间线容器存在
  await expect(page.locator('.approval-timeline')).toBeVisible();
});
```

#### ATB-102: 审批通过完整流程

```typescript
test('审批通过流程端到端', async ({ page }) => {
  await page.goto('/wo/approval/123');
  
  // 点击审批通过
  await page.getByRole('button', { name: '审批通过' }).click();
  
  // 填写审批意见(可选)
  await page.getByLabel('审批意见').fill('同意');
  
  // 确认提交
  await page.getByRole('button', { name: '确认' }).click();
  
  // 验证成功提示
  await expect(page.getByText('审批成功')).toBeVisible();
  
  // 验证状态更新
  await expect(page.locator('.wo-status')).toContainText('已通过');
  
  // 验证时间线新增记录
  await expect(page.locator('.timeline-item').last()).toContainText('审批通过');
});
```

#### ATB-103: 驳回流程必填原因

```typescript
test('驳回必须填写原因', async ({ page }) => {
  await page.goto('/wo/approval/123');
  
  // 点击驳回
  await page.getByRole('button', { name: '驳回' }).click();
  
  // 不填写原因直接提交
  await page.getByRole('button', { name: '确认' }).click();
  
  // 验证错误提示
  await expect(page.getByText('请输入驳回原因')).toBeVisible();
  
  // 填写原因后重新提交
  await page.getByLabel('驳回原因').fill('材料不全');
  await page.getByRole('button', { name: '确认' }).click();
  
  // 验证成功
  await expect(page.getByText('驳回成功')).toBeVisible();
});
```

#### ATB-104: 非处理人无审批入口

```typescript
test('非处理人看不到审批按钮', async ({ page }) => {
  // 使用非处理人账号登录
  await page.goto('/wo/approval/123');
  
  // 断言审批按钮不存在
  await expect(page.getByRole('button', { name: '审批通过' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: '驳回' })).not.toBeVisible();
  
  // 断言历史时间线仅展示
  await expect(page.locator('.approval-timeline')).toBeVisible();
});
```

---

## 开发切入层级序列

### 开发顺序

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: 数据模型层 (必须先行)                           │
├─────────────────────────────────────────────────────────┤
│  - 创建 ApprovalRecord 表 (approval_records)            │
│  - 添加 work_order 表状态枚举扩展                        │
│  - 编写迁移脚本                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 2: 状态机核心 (第二步)                             │
├─────────────────────────────────────────────────────────┤
│  - 状态机定义 (Pending → Approved/Rejected)             │
│  - 状态转换校验规则                                      │
│  - 状态持久化事务                                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 3: 业务逻辑层 (第三步)                             │
├─────────────────────────────────────────────────────────┤
│  - ApprovalService.approve()                           │
│  - ApprovalService.reject()                             │
│  - ApprovalService.get_history()                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 4: API 接口层 (第四步)                             │
├─────────────────────────────────────────────────────────┤
│  - POST /api/wo/approvals/{id}/approve                  │
│  - POST /api/wo/approvals/{id}/reject                  │
│  - GET  /api/wo/approvals/{id}/history                 │
│  - 路由注册与依赖注入                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 5: 通知集成 (第五步)                               │
├─────────────────────────────────────────────────────────┤
│  - NotificationPublisher 封装                            │
│  - 审批成功/驳回事件发布                                 │
│  - Redis 连接配置                                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 6: 前端页面 (第六步)                               │
├─────────────────────────────────────────────────────────┤
│  - ApprovalButtons.vue (审批/驳回按钮)                  │
│  - ApprovalTimeline.vue (历史时间线)                   │
│  - ApprovalPage.vue (整合页面)                          │
│  - 状态管理 (Pinia store)                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 7: 单元测试 (第七步)                               │
├─────────────────────────────────────────────────────────┤
│  - pytest 测试用例 (ATB-001 ~ ATB-007)                  │
│  - 覆盖率基线: ≥80%                                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Step 8: E2E 测试 (第八步)                               │
├─────────────────────────────────────────────────────────┤
│  - Playwright 测试用例 (ATB-101 ~ ATB-104)              │
│  - 关键路径覆盖: 100%                                   │
└─────────────────────────────────────────────────────────┘
```

### 关键技术点

| 层级 | 技术点 | 注意事项 |
|-----|-------|---------|
| 数据模型 | SQLAlchemy Enum | 使用 StateMachineEnum 统一管理状态 |
| 状态机 | FSM 模式 | 拒绝非法状态转换，抛出明确异常 |
| API | Pydantic Request/Response | 严格参数校验，统一错误格式 |
| 通知 | Redis Pub/Sub | 消息序列化 JSON，异常重试 |
| 前端 | Composition API | 按钮防抖，历史分页加载 |

---

## 附录：API 接口规格

### POST /api/wo/approvals/{id}/approve

**Request**
```json
{
  "comment": "同意此工单"
}
```

**Response 200**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "WO-20240101-001",
    "status": "Approved",
    "approved_by": "user_123",
    "approved_at": "2024-01-15T10:30:00Z",
    "comment": "同意此工单"
  }
}
```

### POST /api/wo/approvals/{id}/reject

**Request**
```json
{
  "reason": "驳回原因：材料不全"
}
```

**Response 200**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "WO-20240101-001",
    "status": "Rejected",
    "rejected_by": "user_123",
    "rejected_at": "2024-01-15T10:30:00Z",
    "reason": "驳回原因：材料不全"
  }
}
```

### GET /api/wo/approvals/{id}/history

**Response 200**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 3,
    "items": [
      {
        "id": "AR-001",
        "action": "reject",
        "operator_id": "user_123",
        "operator_name": "张三",
        "comment": "材料不全",
        "created_at": "2024-01-15T10:30:00Z"
      },
      {
        "id": "AR-002",
        "action": "approve",
        "operator_id": "user_124",
        "operator_name": "李四",
        "comment": "补充后同意",
        "created_at": "2024-01-15T11:00:00Z"
      }
    ]
  }
}
```

---

## 交付物清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `frontend/tests/e2e/approval.spec.ts` | 修改 | E2E 测试用例 (ATB-101 ~ ATB-104) |
| `frontend/src/stores/approvalStore.ts` | 修改 | Pinia 状态管理 |
| `frontend/src/services/approvalService.test.ts` | 修改 | 单元测试 |
| `frontend/src/router/approval.ts` | 修改 | 路由配置 |
| `frontend/src/types/approval.ts` | 修改 | TypeScript 类型定义 |

---

## 依赖关系

### 前置依赖

| 依赖项 | 来源 | 说明 |
|-------|-----|------|
| WorkOrder Status Enum | `src/models/enums.py` | 状态机定义 |
| ApprovalService | `src/services/approval_chain_service.py` | 业务逻辑 |
| ApprovalRouter | `src/api/routers/retirement_router.py` | API 路由 |

### 被依赖项

| 依赖项 | 去向 | 说明 |
|-------|-----|------|
| ApprovalRecord Model | 数据库 | 审批记录持久化 |
| NotificationService | `src/services/notification_service.py` | 通知发送 |