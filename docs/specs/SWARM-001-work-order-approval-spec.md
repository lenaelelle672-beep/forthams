# SWARM-001 工单审批流程规格指导文档

## 需求与背景

### 业务背景

在资产管理系统中，支持用户提交工单（Work Order），由具有审批权限的管理员进行审批操作，形成完整的**申请 → 审批 → 通知**闭环流程。本规格文档对应 SWARM-001 的 Iteration 1 交付目标。

### 核心功能范围

| 功能模块 | 描述 | 迭代范围 |
|---------|------|---------|
| 工单提交 | 用户创建新工单，初始状态为 `DRAFT` | Iteration 1 |
| 状态流转 | 工单状态机控制：`DRAFT` → `SUBMITTED` → `APPROVED` / `REJECTED` | Iteration 1 |
| 审批操作 | 管理员执行 approve / reject 操作 | Iteration 1 |
| 审批页面 | 前端管理员工单列表及详情界面 | Phase 3 并行 |
| 结果通知 | 审批完成后触发通知（邮件/站内信） | Phase 4 |

### 关键角色

| 角色 | 职责 |
|------|------|
| **Requester（申请人）** | 提交工单的用户 |
| **Approver（审批人）** | 具有 `APPROVER` 或 `ADMIN` 角色的管理员 |
| **System** | 状态机执行者、通知触发者 |

---

## 当前 Phase 对应实施目标

### Phase 拆解总览

| Phase | 阶段名称 | 实施目标 | 依赖关系 |
|-------|---------|---------|---------|
| **Phase 1** | 核心状态机 + 数据模型 | 工单实体、状态枚举、状态机流转规则、基础 DAO/Repository | 无 |
| **Phase 2** | 审批 API 层 | 审批操作的后端 API（approve/reject），包含请求校验与权限控制 | Phase 1 |
| **Phase 3** | 前端审批界面 | 管理员工单列表页、详情页、审批操作按钮及确认交互 | Phase 2 接口契约 |
| **Phase 4** | 通知集成 | 审批结果通知（邮件/站内信）触发机制 | Phase 2 |

### 本次 Spec 对准范围

> **Iteration 1 聚焦 Phase 1 + Phase 2**，即：
> - 后端核心状态机与数据模型（`backend/src/main/java/com/ams/state/WorkOrderStateMachine.java`）
> - 审批操作 API（含权限校验）（`backend/src/main/java/com/ams/controller/WorkOrderController.java`）
> - 预留通知接口 `INotificationService.notify(WorkOrder)`
> - Phase 3 前端界面作为并行任务，不在本 iteration 约束内

---

## 边界约束

### 1. 状态机约束

#### 状态定义

```java
public enum WorkOrderState {
    DRAFT,       // 草稿状态（初始状态）
    SUBMITTED,   // 已提交（待审批）
    APPROVED,    // 已审批通过（终态）
    REJECTED     // 已拒绝（终态）
}
```

#### 状态流转图

```
┌─────────────┐    submit     ┌──────────────┐
│   DRAFT     │──────────────►│   SUBMITTED  │
└─────────────┘               └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                │                ▼
             ┌──────────────┐        │         ┌──────────────┐
             │  APPROVED    │        │         │  REJECTED    │
             └──────────────┘        │         └──────────────┘
                    ▲                ▼                ▲
                    │    approve    │    reject       │
                    │    comment    │    comment      │
                    └────────────────┴────────────────┘
```

#### 流转规则

| 当前状态 | 目标操作 | 目标状态 | 前置条件 |
|---------|---------|---------|---------|
| `DRAFT` | `submit` | `SUBMITTED` | 申请人本人执行 |
| `SUBMITTED` | `approve` | `APPROVED` | 审批人执行，且审批人 ≠ 申请人 |
| `SUBMITTED` | `reject` | `REJECTED` | 审批人执行，且审批人 ≠ 申请人 |
| `APPROVED` | 任意操作 | - | 返回当前状态（幂等） |
| `REJECTED` | 任意操作 | - | 返回当前状态（幂等） |

#### 关键约束

- **不可逆性**：`SUBMITTED` 只能流转至 `APPROVED` 或 `REJECTED`，不可回退至 `DRAFT`
- **幂等性**：`approve` / `reject` 对终态工单执行时返回当前状态，不抛出异常
- **自审批禁止**：审批人不能审批自己创建的工单

### 2. 权限约束

| 操作 | 权限要求 |
|------|---------|
| 创建工单 | 已认证用户（任意角色） |
| 提交工单 | 工单创建者本人 |
| 查看工单列表 | 工单创建者 **或** 具有 `APPROVER`/`ADMIN` 角色 |
| 查看工单详情 | 工单创建者 **或** 具有 `APPROVER`/`ADMIN` 角色 |
| 审批工单（approve/reject） | `role = APPROVER` **或** `role = ADMIN`，且审批人 ≠ 申请人 |

### 3. 数据约束

| 字段 | 类型 | 约束 |
|------|------|------|
| `id` | Long | 主键，自增 |
| `title` | String | 非空，最大 200 字符 |
| `description` | String | 非空，最大 2000 字符 |
| `requester_id` | Long | 非空，引用 `users.id` |
| `approver_id` | Long | 可空，审批通过/拒绝后必填 |
| `status` | Enum | 枚举值，受状态机控制 |
| `approval_comment` | String | 可空，最大 500 字符 |
| `created_at` | Timestamp | 自动写入 UTC 时间 |
| `submitted_at` | Timestamp | 提交时自动写入 |
| `approved_at` | Timestamp | 审批时自动写入 UTC 时间 |

### 4. 通知约束

- **触发时机**：状态机状态变更至 `APPROVED` 或 `REJECTED` 时
- **通知渠道**（Phase 4 实现）：邮件 + 站内信
- **本 iteration 预留**：通知接口 `INotificationService.notify(WorkOrder)`，具体实现留待 Phase 4

### 5. API 约束

| 端点 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/api/v1/work-orders` | POST | 创建工单 | 已认证用户 |
| `/api/v1/work-orders/{id}` | GET | 获取工单详情 | 创建者或审批人 |
| `/api/v1/work-orders` | GET | 查询工单列表 | 创建者或审批人 |
| `/api/v1/work-orders/{id}/submit` | POST | 提交工单 | 创建者本人 |
| `/api/v1/work-orders/{id}/approve` | POST | 审批通过 | 审批人（非本人） |
| `/api/v1/work-orders/{id}/reject` | POST | 审批拒绝 | 审批人（非本人） |

---

## 验收测试基准 (ATB)

### ATB-1: 状态机核心逻辑验证

**测试目标**：验证 `WorkOrderStateMachine` 类的状态流转逻辑

**测试文件**：`tests/unit/test_workorder_state_machine.py`

```python
# tests/unit/test_workorder_state_machine.py
"""
WorkOrderStateMachine 单元测试
验证状态机核心流转逻辑、非法流转拒绝、幂等性
"""
import pytest
from backend.src.main.java.com.ams.state import WorkOrderStateMachine, WorkOrderState, WorkOrder


class TestWorkOrderStateMachine:
    """ATB-1: 状态机流转核心逻辑"""

    def test_draft_initial_state(self):
        """
        [物理测试] 新建工单初始状态为 DRAFT
        期望：DRAFT = 0
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        assert wo.status == WorkOrderState.DRAFT

    def test_submit_transitions_draft_to_submitted(self):
        """
        [物理测试] DRAFT 工单提交后状态变为 SUBMITTED
        期望：status == SUBMITTED, submitted_at 非空
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        assert wo.status == WorkOrderState.SUBMITTED
        assert wo.submitted_at is not None

    def test_approve_transitions_submitted_to_approved(self):
        """
        [物理测试] SUBMITTED 工单审批通过后状态变为 APPROVED
        期望：status == APPROVED, approver_id 记录, approval_comment 记录, approved_at 非空
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.approve(wo, approver_id=99, comment="LGTM")
        
        assert wo.status == WorkOrderState.APPROVED
        assert wo.approver_id == 99
        assert wo.approval_comment == "LGTM"
        assert wo.approved_at is not None

    def test_reject_transitions_submitted_to_rejected(self):
        """
        [物理测试] SUBMITTED 工单审批拒绝后状态变为 REJECTED
        期望：status == REJECTED, approval_comment 记录
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.reject(wo, approver_id=99, comment="缺少必要信息")
        
        assert wo.status == WorkOrderState.REJECTED
        assert wo.approval_comment == "缺少必要信息"

    def test_invalid_transition_draft_to_approved_raises_exception(self):
        """
        [物理测试] DRAFT 状态不允许直接审批，抛出 InvalidStateTransitionException
        期望：StateTransitionException
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        
        with pytest.raises(InvalidStateTransitionException) as exc_info:
            WorkOrderStateMachine.approve(wo, approver_id=99)
        
        assert "DRAFT" in str(exc_info.value)
        assert "APPROVED" in str(exc_info.value)

    def test_self_approval_raises_exception(self):
        """
        [物理测试] 申请人不能审批自己的工单，抛出 SelfApprovalException
        期望：SelfApprovalException
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        
        with pytest.raises(SelfApprovalException):
            WorkOrderStateMachine.approve(wo, approver_id=1)  # 同一人

    def test_idempotent_approve_on_approved_wo(self):
        """
        [物理测试] 对已 APPROVED 工单重复执行 approve，幂等返回当前状态
        期望：状态不变，原审批人不变
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.approve(wo, approver_id=99, comment="First")
        
        original_status = wo.status
        WorkOrderStateMachine.approve(wo, approver_id=88, comment="Second")  # 不应报错
        
        assert wo.status == original_status
        assert wo.approver_id == 99  # 原审批人不被覆盖
        assert wo.approval_comment == "First"

    def test_idempotent_reject_on_rejected_wo(self):
        """
        [物理测试] 对已 REJECTED 工单重复执行 reject，幂等返回当前状态
        """
        wo = WorkOrder(title="Test WO", description="Test desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.reject(wo, approver_id=99, comment="First")
        
        original_status = wo.status
        WorkOrderStateMachine.reject(wo, approver_id=88, comment="Second")
        
        assert wo.status == original_status
        assert wo.approval_comment == "First"
```

### ATB-2: API 端点功能验证

**测试目标**：验证 `/api/v1/work-orders` 相关 API 的功能正确性

**测试文件**：`tests/api/test_work_order_approve.py`

```python
# tests/api/test_work_order_approve.py
"""
工单审批 API 集成测试
验证 HTTP 端点行为、权限校验、响应格式
"""
import pytest
from fastapi.testclient import TestClient


class TestWorkOrderApproveAPI:
    """ATB-2: 审批 API 端点功能验证"""

    def test_create_work_order_returns_201(self, client: TestClient, user_token: str):
        """
        [物理测试] POST /api/v1/work-orders 返回 201
        期望：body 含 id, status == DRAFT
        """
        response = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test description"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["status"] == "DRAFT"
        assert data["title"] == "Test WO"

    def test_submit_work_order_returns_200(self, client: TestClient, user_token: str):
        """
        [物理测试] POST /api/v1/work-orders/{id}/submit 返回 200
        期望：status == SUBMITTED
        """
        # 创建工单
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        
        # 提交工单
        submit_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/submit",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert submit_resp.status_code == 200
        assert submit_resp.json()["status"] == "SUBMITTED"

    def test_approve_work_order_returns_200(self, client: TestClient, user_token: str, approver_token: str):
        """
        [物理测试] POST /api/v1/work-orders/{id}/approve 返回 200
        期望：status == APPROVED, approver_id 记录
        """
        # 创建并提交工单
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        client.post(
            f"/api/v1/work-orders/{wo_id}/submit",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # 审批通过
        approve_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/approve",
            json={"comment": "Approved"},
            headers={"Authorization": f"Bearer {approver_token}"}
        )
        
        assert approve_resp.status_code == 200
        data = approve_resp.json()
        assert data["status"] == "APPROVED"
        assert data["approval_comment"] == "Approved"

    def test_reject_work_order_returns_200(self, client: TestClient, user_token: str, approver_token: str):
        """
        [物理测试] POST /api/v1/work-orders/{id}/reject 返回 200
        期望：status == REJECTED
        """
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        client.post(
            f"/api/v1/work-orders/{wo_id}/submit",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        reject_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/reject",
            json={"comment": "Rejected: incomplete info"},
            headers={"Authorization": f"Bearer {approver_token}"}
        )
        
        assert reject_resp.status_code == 200
        assert reject_resp.json()["status"] == "REJECTED"

    def test_self_approval_returns_403(self, client: TestClient, user_token: str):
        """
        [物理测试] 申请人自己审批工单返回 403
        期望：HTTP 403 Forbidden
        """
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        client.post(
            f"/api/v1/work-orders/{wo_id}/submit",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # 同一用户尝试审批自己的工单
        approve_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/approve",
            json={"comment": "Self-approve"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert approve_resp.status_code == 403

    def test_non_approver_role_returns_403(self, client: TestClient, user_token: str, regular_user_token: str):
        """
        [物理测试] 非审批人角色调用 approve/reject 返回 403
        期望：HTTP 403 Forbidden
        """
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        client.post(
            f"/api/v1/work-orders/{wo_id}/submit",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # 普通用户（非审批人）尝试审批
        approve_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/approve",
            json={"comment": "Unauthorized"},
            headers={"Authorization": f"Bearer {regular_user_token}"}
        )
        
        assert approve_resp.status_code == 403

    def test_approve_draft_work_order_returns_400(self, client: TestClient, user_token: str, approver_token: str):
        """
        [物理测试] 对 DRAFT 状态工单执行 approve 返回 400
        期望：HTTP 400 Bad Request
        """
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        # 不执行 submit，直接 approve
        
        approve_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/approve",
            json={"comment": "Approve draft"},
            headers={"Authorization": f"Bearer {approver_token}"}
        )
        
        assert approve_resp.status_code == 400

    def test_get_pending_work_orders_filter(self, client: TestClient, approver_token: str, submitted_wo_ids: list):
        """
        [物理测试] GET /api/v1/work-orders?status=SUBMITTED 仅返回待审批工单
        期望：返回列表仅含 SUBMITTED 状态的工单
        """
        response = client.get(
            "/api/v1/work-orders",
            params={"status": "SUBMITTED"},
            headers={"Authorization": f"Bearer {approver_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        for item in data["items"]:
            assert item["status"] == "SUBMITTED"
```

### ATB-3: 前端审批界面功能验证（Playwright）

**测试目标**：验证审批管理页面的用户交互流程

**测试文件**：`frontend/tests/e2e/approval.spec.ts`

```typescript
// frontend/tests/e2e/approval.spec.ts
/**
 * 审批页面 E2E 测试
 * 验证管理员审批流程的 UI 交互
 */
import { test, expect } from '@playwright/test';

test.describe('Work Order Approval Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'approver@company.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/admin/work-orders');
  });

  test('ATB-3.1: Approver sees pending work orders list', async ({ page }) => {
    /**
     * [物理测试] 审批人登录后可见待审批工单列表
     * 期望：工单列表加载，显示 status=SUBMITTED 的工单
     */
    await expect(page.locator('[data-testid="wo-table"]')).toBeVisible();
    const pendingRows = page.locator('[data-testid="wo-row"][data-status="SUBMITTED"]');
    await expect(pendingRows.first).toBeVisible();
    
    // 验证列表包含必要字段
    await expect(page.locator('[data-testid="wo-title"]').first).toBeVisible();
    await expect(page.locator('[data-testid="wo-requester"]').first).toBeVisible();
    await expect(page.locator('[data-testid="wo-created-at"]').first).toBeVisible();
  });

  test('ATB-3.2: Approve button triggers confirmation dialog', async ({ page }) => {
    /**
     * [物理测试] 点击审批通过按钮，弹出确认对话框
     * 期望：显示模态框，包含审批意见输入框
     */
    await page.click('[data-testid="wo-row"][data-status="SUBMITTED"]');
    await page.click('[data-testid="approve-btn"]');
    
    await expect(page.locator('[data-testid="approve-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="approval-comment-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-approve-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-btn"]')).toBeVisible();
  });

  test('ATB-3.3: Confirm approval updates status to APPROVED', async ({ page }) => {
    /**
     * [物理测试] 确认审批后，工单状态在 UI 中更新为 APPROVED
     * 期望：状态徽章变为 "APPROVED"，列表中不再显示在待审批区
     */
    const woId = await page.locator('[data-testid="wo-row"][data-status="SUBMITTED"]').first().getAttribute('data-wo-id');
    
    await page.click(`[data-testid="wo-row"][data-wo-id="${woId}"]`);
    await page.click('[data-testid="approve-btn"]');
    await page.fill('[data-testid="approval-comment-input"]', 'Approved by manager');
    await page.click('[data-testid="confirm-approve-btn"]');
    
    // 验证状态更新
    await expect(page.locator(`[data-testid="wo-row"][data-wo-id="${woId}"] [data-testid="status-badge"]`)).toHaveText('APPROVED');
    
    // 验证从待审批列表移除
    await page.reload();
    const approvedRow = page.locator(`[data-testid="wo-row"][data-wo-id="${woId}"]`);
    await expect(approvedRow).toBeHidden();
  });

  test('ATB-3.4: Reject requires comment', async ({ page }) => {
    /**
     * [物理测试] 拒绝操作必须填写审批意见，不填则阻止提交
     * 期望：点击确认拒绝时显示错误提示
     */
    const woId = await page.locator('[data-testid="wo-row"][data-status="SUBMITTED"]').first().getAttribute('data-wo-id');
    
    await page.click(`[data-testid="wo-row"][data-wo-id="${woId}"]`);
    await page.click('[data-testid="reject-btn"]');
    await page.click('[data-testid="confirm-reject-btn"]'); // 不填写意见
    
    await expect(page.locator('[data-testid="comment-error"]')).toContainText('审批意见不能为空');
  });

  test('ATB-3.5: Reject with comment updates status to REJECTED', async ({ page }) => {
    /**
     * [物理测试] 填写拒绝意见后确认，工单状态变为 REJECTED
     * 期望：状态徽章变为 "REJECTED"，记录拒绝意见
     */
    const woId = await page.locator('[data-testid="wo-row"][data-status="SUBMITTED"]').first().getAttribute('data-wo-id');
    
    await page.click(`[data-testid="wo-row"][data-wo-id="${woId}"]`);
    await page.click('[data-testid="reject-btn"]');
    await page.fill('[data-testid="approval-comment-input"]', 'Rejected: 缺少必要的附件');
    await page.click('[data-testid="confirm-reject-btn"]');
    
    await expect(page.locator(`[data-testid="wo-row"][data-wo-id="${woId}"] [data-testid="status-badge"]`)).toHaveText('REJECTED');
  });
});
```

### ATB-4: 通知接口契约验证

**测试目标**：验证状态变更时通知接口被正确调用

**测试文件**：`tests/unit/test_workorder_notification.py`

```python
# tests/unit/test_workorder_notification.py
"""
通知接口契约测试
验证状态机触发通知的调用时机和参数
"""
import pytest
from unittest.mock import Mock, MagicMock


class TestNotificationInterface:
    """ATB-4: 通知服务接口契约验证"""

    def test_notification_triggered_on_approval(self, mock_notification_service):
        """
        [物理测试] 工单审批通过后调用通知接口一次
        期望：notify 调用参数包含工单 ID 和 APPROVED 状态
        """
        wo = WorkOrder(title="Test", description="Desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.approve(wo, approver_id=99, comment="OK")
        
        mock_notification_service.notify.assert_called_once()
        call_args = mock_notification_service.notify.call_args[0][0]
        assert call_args.id == wo.id
        assert call_args.status == WorkOrderState.APPROVED

    def test_notification_triggered_on_rejection(self, mock_notification_service):
        """
        [物理测试] 工单审批拒绝后调用通知接口一次
        期望：notify 调用参数包含工单 ID 和 REJECTED 状态
        """
        wo = WorkOrder(title="Test", description="Desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.reject(wo, approver_id=99, comment="Incomplete")
        
        mock_notification_service.notify.assert_called_once()
        call_args = mock_notification_service.notify.call_args[0][0]
        assert call_args.id == wo.id
        assert call_args.status == WorkOrderState.REJECTED

    def test_no_notification_on_draft_submit(self, mock_notification_service):
        """
        [物理测试] DRAFT 状态创建不触发通知
        期望：submit 操作不调用 notify
        """
        wo = WorkOrder(title="Test", description="Desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        
        mock_notification_service.notify.assert_not_called()

    def test_no_notification_on_idempotent_operation(self, mock_notification_service):
        """
        [物理测试] 幂等操作不重复触发通知
        期望：重复 approve 已终态工单，notify 仅被调用一次
        """
        wo = WorkOrder(title="Test", description="Desc", requester_id=1)
        WorkOrderStateMachine.submit(wo, requester_id=1)
        WorkOrderStateMachine.approve(wo, approver_id=99, comment="OK")
        mock_notification_service.notify.assert_called_once()
        
        # 重复审批
        WorkOrderStateMachine.approve(wo, approver_id=88, comment="Again")
        
        # 通知仍为一次
        assert mock_notification_service.notify.call_count == 1
```

### ATB-5: 幂等性验证

**测试文件**：`tests/api/test_work_order_idempotent.py`

```python
# tests/api/test_work_order_idempotent.py
"""
工单审批幂等性测试
验证重复操作不会导致状态异常或副作用
"""
import pytest


class TestWorkOrderIdempotent:
    """ATB-5: 幂等性验证"""

    def test_repeated_approve_returns_same_response(self, client: TestClient, user_token: str, approver_token: str):
        """
        [物理测试] 重复执行 approve 返回相同的响应码和数据
        期望：两次请求均返回 200，status 不变
        """
        create_resp = client.post(
            "/api/v1/work-orders",
            json={"title": "Test WO", "description": "Test"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        wo_id = create_resp.json()["id"]
        client.post(
            f"/api/v1/work-orders/{wo_id}/submit",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        first_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/approve",
            json={"comment": "First"},
            headers={"Authorization": f"Bearer {approver_token}"}
        )
        
        second_resp = client.post(
            f"/api/v1/work-orders/{wo_id}/approve",
            json={"comment": "Second"},
            headers={"Authorization": f"Bearer {approver_token}"}
        )
        
        assert first_resp.status_code == 200
        assert second_resp.status_code == 200
        assert first_resp.json()["status"] == second_resp.json()["status"]
        assert first_resp.json()["approver_id"] == second_resp.json()["approver_id"]
```

---

## 开发切入层级序列

### Layer 0: 基础设施层（无外部依赖）

```
优先级：P0（阻塞其他所有层）

1. 数据库 Schema 设计
   文件：alembic/versions/001_create_workorder_tables.py
   内容：
   - work_orders 表（含 status 枚举映射）
   - 索引：requester_id, status, created_at
   - 字段：id, title, description, requester_id, approver_id, 
           status, approval_comment, created_at, submitted_at, approved_at

2. 领域模型（Domain Models）
   文件：src/models/workorder.py
   内容：
   - WorkOrder entity class
   - WorkOrderStatus enum (DRAFT, SUBMITTED, APPROVED, REJECTED)
   - InvalidStateTransitionError exception
   - SelfApprovalException exception
```

### Layer 1: 领域逻辑层（无 I/O 依赖）

```
优先级：P0

3. 状态机实现
   文件：src/state_machine/approval_state_machine.py 或 backend/src/main/java/com/ams/state/WorkOrderStateMachine.java
   
   方法：
   - WorkOrderStateMachine.submit(wo, requester_id) → transitions DRAFT → SUBMITTED
   - WorkOrderStateMachine.approve(wo, approver_id, comment) → transitions SUBMITTED → APPROVED
   - WorkOrderStateMachine.reject(wo, approver_id, comment) → transitions SUBMITTED → REJECTED
   - 内部方法：_validate_transition(from_state, to_state)
   - 内部方法：_record_approval(wo, approver_id, comment)
```

### Layer 2: 数据访问层

```
优先级：P1

4. Repository 接口与实现
   文件：src/repositories/workorder_repository.py
   
   方法：
   - IWorkOrderRepository.create(work_order) → WorkOrder
   - IWorkOrderRepository.get_by_id(id) → WorkOrder
   - IWorkOrderRepository.list_by_status(status) → List[WorkOrder]
   - IWorkOrderRepository.update(work_order) → WorkOrder
   - IWorkOrderRepository.list_pending_for_approver(approver_id) → List[WorkOrder]

5. 权限校验服务
   文件：src/services/permission_service.py
   
   方法：
   - IPermissionService.can_view(user_id, work_order_id) → bool
   - IPermissionService.can_approve(user_id, work_order_id) → bool
   - IPermissionService.is_approver(user_id) → bool
```

### Layer 3: 应用服务层

```
优先级：P1

6. 应用服务（Application Services）
   文件：src/services/work_order_service.py
   
   方法：
   - WorkOrderService.create(title, description, requester_id) → WorkOrder
   - WorkOrderService.submit(work_order_id, requester_id) → WorkOrder
   - WorkOrderService.approve(work_order_id, approver_id, comment) → WorkOrder
   - WorkOrderService.reject(work_order_id, approver_id, comment) → WorkOrder
   - WorkOrderService.get_pending_for_approver(approver_id) → List[WorkOrder]
```

### Layer 4: API 接口层

```
优先级：P2

7. API 路由定义
   文件：src/api/routers/workorder_router.py 或 backend/src/main/java/com/ams/controller/WorkOrderController.java
   
   端点：
   POST   /api/v1/work-orders              → create_work_order
   GET    /api/v1/work-orders              → list_work_orders
   GET    /api/v1/work-orders/{id}         → get_work_order
   POST   /api/v1/work-orders/{id}/submit  → submit_work_order
   POST   /api/v1/work-orders/{id}/approve → approve_work_order
   POST   /api/v1/work-orders/{id}/reject  → reject_work_order
```

### Layer 5: 通知集成层

```
优先级：P3（Phase 4 实现）

8. 通知服务接口（契约预留）
   文件：src/services/notification_service.py
   
   接口：
   interface INotificationService:
       def notify(work_order: WorkOrder) -> None
   
   实现留待 Phase 4：邮件通知、站内信通知
```

### Layer 6: 前端界面层（并行）

```
优先级：P2（并行，不在 iteration 约束内）

9. 前端组件（基于接口契约）
   文件：frontend/src/pages/WorkOrder/*
   
   组件：
   - WorkOrderListPage: 工单列表（含 status 筛选）
   - WorkOrderDetailPage: 工单详情（含审批按钮）
   - ApproveDialog: 审批通过对话框
   - RejectDialog: 审批拒绝对话框（含意见必填校验）
```

### 依赖关系图

```
Layer 0: 基础设施（Schema / Model）
    │
    ▼
Layer 1: 状态机（WorkOrderStateMachine）
    │                                    ◄── Phase 4
    ▼                                    │
Layer 2: Repository + Permission         ▼
    │                           Layer 5: 通知接口契约
    ▼                           (INotificationService)
Layer 3: Application Service
    │
    ├──► Layer 4: API Routes ─────────────────────────────┐
    │                                                      │
    └──► Layer 6: Frontend Components (并行)              │
                                                            │
                                               接口契约驱动 ◄┘
```

### 测试先行策略

| 顺序 | 层级 | 测试类型 | 目标 | 对应 ATB |
|------|------|---------|------|---------|
| 1 | Layer 1 | `pytest` 单元测试 | 状态机逻辑 100% 覆盖 | ATB-1 |
| 2 | Layer 2 | `pytest` 集成测试 | Repository + 权限校验 | - |
| 3 | Layer 3 | `pytest` 集成测试 | 应用服务编排 | ATB-5 |
| 4 | Layer 4 | `pytest` API 测试 | HTTP 端点验证 | ATB-2 |
| 5 | Layer 4 | `playwright` E2E 测试 | 审批页面用户流程 | ATB-3 |
| 6 | Layer 1 | `unittest.mock` | 通知接口契约 | ATB-4 |

---

## 附录

### A. 技术栈建议

| 组件 | 推荐技术 | 备选 |
|------|---------|------|
| 后端框架 | FastAPI | Flask |
| 状态机 | 自实现（轻量可控） | `pytransitions` |
| ORM | SQLAlchemy | Django ORM |
| 前端框架 | React + TypeScript | Vue |
| E2E 测试 | Playwright | Cypress |
| Mock 框架 | `pytest-mock` | `unittest.mock` |

### B. 文件修改清单（Iteration 1）

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `alembic/versions/001_create_workorder_tables.py` | 新增 | 工单表迁移 |
| `src/models/workorder.py` | 新增 | 领域模型 |
| `src/state_machine/approval_state_machine.py` | 新增 | 状态机 |
| `src/repositories/workorder_repository.py` | 新增 | 数据访问 |
| `src/services/work_order_service.py` | 新增 | 应用服务 |
| `src/services/notification_service.py` | 新增 | 通知接口契约 |
| `src/api/routers/workorder_router.py` | 新增 | API 路由 |
| `tests/unit/test_workorder_state_machine.py` | 新增 | ATB-1 |
| `tests/api/test_work_order_approve.py` | 新增 | ATB-2 |
| `tests/unit/test_workorder_notification.py` | 新增 | ATB-4 |
| `tests/api/test_work_order_idempotent.py` | 新增 | ATB-5 |
| `frontend/tests/e2e/approval.spec.ts` | 新增 | ATB-3 |

### C. AC 验收对照表

| AC ID | 验收标准 | 对应 ATB | 状态 |
|-------|---------|---------|------|
| AC-001 | 验证工单审批流程功能 | ATB-1, ATB-2, ATB-3 | pending |
| AC-002 | AST 静态检查通过（无语法错误） | - | pending |
| AC-003 | 所有函数包含 docstring | - | pending |
| AC-004 | 模块可正常 import | - | pending |

---

*文档版本：Iteration 1*
*创建日期：基于 SWARM-001 需求规格*
*最后更新：Builder 初始化*