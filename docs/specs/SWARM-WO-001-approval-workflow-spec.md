# [SWARM-WO-001] 工单审批流程规格指导文档

**版本**: 1.0  
**迭代**: Iteration 1  
**任务 ID**: SWARM-WO-001  
**日期**: 2025-01-XX

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是企业内部运维/服务请求的核心流转机制。当前系统缺失在线审批能力，审批人需通过线下渠道（邮件/IM/口头）确认，导致：

- **审批记录不可追溯**：缺少完整的审批操作审计日志
- **状态同步滞后**：工单状态变更无法实时反映
- **审计合规风险**：无法满足监管要求的审批留痕

### 1.2 核心功能需求

| 编号 | 功能点 | 描述 |
|------|--------|------|
| WO-F01 | 工单提交 | 用户创建工单，填写必填字段后提交 |
| WO-F02 | 审批页面 | 审批人查看待审批工单列表，进行通过/驳回操作 |
| WO-F03 | 状态机 | 工单状态在 `PENDING → APPROVED / REJECTED → CLOSED` 之间流转 |
| WO-F04 | 通知机制 | 状态变更时触发通知（邮件/站内信） |

### 1.3 用户角色

| 角色 | 权限 |
|------|------|
| `requester` | 提交工单、查看自己的工单状态 |
| `approver` | 审批工单、查看分配给自己的待审批工单 |
| `admin` | 全量工单管理 |

---

## 2. 当前 Phase 对应实施目标

> **注**: 本文档对照 `plan.md` 中 Phase 2 (审批流程核心) 的交付范围

### Phase 实施规划

```
Phase 1 (已交付): 数据模型定义、工单 CRUD 基础接口
Phase 2 (本次):   审批流程 + 状态机 + 通知机制
Phase 3 (规划中): 审批链（多级审批）、加签/转交
```

### Phase 2 交付物清单

| 交付物 ID | 具体内容 | 涉及文件 |
|-----------|----------|----------|
| `WO-API-201` | 提交工单接口 `POST /api/v1/work-orders` | `src/api/routes/work_orders.py` |
| `WO-API-202` | 获取审批列表 `GET /api/v1/work-orders/pending` | `src/api/routes/work_orders.py` |
| `WO-API-203` | 审批操作接口 `POST /api/v1/work-orders/{id}/approve` | `src/api/routes/work_orders.py` |
| `WO-API-204` | 驳回操作接口 `POST /api/v1/work-orders/{id}/reject` | `src/api/routes/work_orders.py` |
| `WO-SVC-001` | 状态机服务（状态转换规则引擎） | `src/state_machine/approval_state_machine.py` |
| `WO-SVC-002` | 通知服务（事件驱动通知分发） | `src/application/services/notification_service.py` |
| `WO-FE-001` | 审批管理前端页面 | `frontend/src/components/approval/ApprovalPanel.tsx` |

---

## 3. 边界约束

### 3.1 约束范围 (In-Scope)

```
✅ 工单状态机定义与强制校验
✅ 审批人单级审批
✅ 状态变更触发通知
✅ 前端审批操作界面
✅ API 鉴权（基于现有 RBAC）
✅ 审批记录持久化（操作人/时间/备注）
```

### 3.2 约束范围 (Out-of-Scope)

```
❌ 多级审批链（A → B → C 串行审批）
❌ 审批加签/转交
❌ 工单内容编辑（提交后不可修改）
❌ 移动端原生应用
❌ 离线审批（草稿箱）
❌ 批量审批
```

### 3.3 技术约束

| 约束项 | 限制 |
|--------|------|
| 状态机实现 | 优先使用数据库乐观锁，禁用分布式锁 |
| 通知渠道 | 初期仅支持邮件 + 站内信，不含 SMS/企微 |
| 前端框架 | React 18 + Ant Design 5 |
| API 响应时间 | P95 < 500ms |
| 并发控制 | 乐观锁版本号校验 |
| 数据持久化 | 审批记录必须含操作人/时间/备注 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 工单提交功能

**物理测试用例**:

```python
# tests/api/test_work_order_submit.py

def test_submit_work_order_success():
    """ATB-1.1: 有效用户提交工单，返回 201 且状态为 PENDING"""
    payload = {
        "title": "服务器扩容申请",
        "description": "生产环境 CPU 使用率超 80%",
        "priority": "HIGH",
        "category": "INFRASTRUCTURE"
    }
    response = api_client.post("/api/v1/work-orders", json=payload)
    
    assert response.status_code == 201
    assert response.json()["status"] == "PENDING"
    assert response.json()["id"] is not None
    assert response.json()["created_at"] is not None

def test_submit_work_order_missing_required_fields():
    """ATB-1.2: 缺少必填字段时返回 422"""
    payload = {"title": "仅标题"}
    response = api_client.post("/api/v1/work-orders", json=payload)
    
    assert response.status_code == 422
    assert "validation_error" in response.json()["code"]

def test_submit_work_order_unauthorized():
    """ATB-1.3: 未认证请求返回 401"""
    response = unauthenticated_client.post("/api/v1/work-orders", json=payload)
    
    assert response.status_code == 401
```

### 4.2 ATB-2: 待审批列表查询

**物理测试用例**:

```python
# tests/api/test_approval_list.py

def test_get_pending_approvals_as_approver():
    """ATB-2.1: 审批人角色可获取自己待审批工单列表"""
    # Setup: 创建分配给当前审批人的工单
    work_order = create_work_order(approver_id=get_current_user_id())
    
    response = api_client.get("/api/v1/work-orders/pending")
    
    assert response.status_code == 200
    assert "items" in response.json()
    assert any(item["id"] == work_order.id for item in response.json()["items"])

def test_get_pending_approvals_as_requester():
    """ATB-2.2: 普通用户访问待审批列表返回 403"""
    response = api_client.get("/api/v1/work-orders/pending")
    
    assert response.status_code == 403
```

### 4.3 ATB-3: 审批操作 (通过)

**物理测试用例**:

```python
# tests/api/test_work_order_approve.py

def test_approve_work_order_success():
    """ATB-3.1: 审批人通过工单，状态变为 APPROVED"""
    work_order = create_work_order(status="PENDING")
    payload = {"comment": "同意扩容，联系运维执行"}
    
    response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/approve",
        json=payload
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"

def test_approve_work_order_database_record():
    """ATB-3.2: 数据库记录审批人信息"""
    work_order = create_work_order(status="PENDING")
    current_user = get_current_user()
    
    api_client.post(f"/api/v1/work-orders/{work_order.id}/approve", json={})
    
    db_record = db.query(WorkOrder).get(work_order.id)
    assert db_record.approved_by == current_user.id
    assert db_record.approved_at is not None

def test_approve_already_approved_work_order():
    """ATB-3.3: 重复审批返回 409 Conflict"""
    response = api_client.post(
        f"/api/v1/work-orders/{already_approved_id}/approve",
        json={}
    )
    
    assert response.status_code == 409
    assert "conflict" in response.json()["code"].lower()

def test_approve_without_permission():
    """ATB-3.4: 非分配审批人操作返回 403"""
    work_order = create_work_order(approver_id=different_user.id)
    
    response = other_approver_client.post(
        f"/api/v1/work-orders/{work_order.id}/approve",
        json={}
    )
    
    assert response.status_code == 403
```

### 4.4 ATB-4: 驳回操作

**物理测试用例**:

```python
# tests/api/test_work_order_reject.py

def test_reject_work_order_requires_reason():
    """ATB-4.1: 驳回操作必须填写驳回原因"""
    work_order = create_work_order(status="PENDING")
    
    response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/reject",
        json={}
    )
    
    assert response.status_code == 422
    assert "reason" in response.json()["errors"]

def test_reject_work_order_success():
    """ATB-4.2: 驳回后状态变为 REJECTED"""
    work_order = create_work_order(status="PENDING")
    
    response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/reject",
        json={"reason": "资源不足，暂缓执行"}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "REJECTED"
    assert response.json()["reject_reason"] == "资源不足，暂缓执行"
```

### 4.5 ATB-5: 状态机规则

**物理测试用例**:

```python
# tests/unit/test_state_machine.py

def test_state_transition_rules():
    """ATB-5.1: 验证状态机转换规则"""
    # PENDING → APPROVED ✓
    assert state_machine.can_transition("PENDING", "APPROVED") == True
    # PENDING → REJECTED ✓
    assert state_machine.can_transition("PENDING", "REJECTED") == True
    # APPROVED → PENDING ✗ (不可逆)
    assert state_machine.can_transition("APPROVED", "PENDING") == False
    # REJECTED → APPROVED ✗ (不可逆)
    assert state_machine.can_transition("REJECTED", "APPROVED") == False
    # PENDING → CLOSED ✗ (必须经过审批)
    assert state_machine.can_transition("PENDING", "CLOSED") == False

def test_concurrent_approval_handling():
    """ATB-5.2: 并发审批请求仅一次生效"""
    work_order = create_work_order(status="PENDING")
    
    # 模拟并发请求
    results = parallel_execute([
        lambda: api_client.post(
            f"/api/v1/work-orders/{work_order.id}/approve",
            json={}
        ),
        lambda: api_client.post(
            f"/api/v1/work-orders/{work_order.id}/approve",
            json={}
        )
    ])
    
    # 仅一个返回 200，另一个返回 409
    success_count = sum(1 for r in results if r.status_code == 200)
    conflict_count = sum(1 for r in results if r.status_code == 409)
    
    assert success_count == 1
    assert conflict_count == 1
```

### 4.6 ATB-6: 通知机制

**物理测试用例**:

```python
# tests/services/test_notification_service.py

def test_notification_sent_on_approval(mocker):
    """ATB-6.1: 工单通过时触发通知"""
    mock_email = mocker.patch("services.notification_service.send_email")
    work_order = create_work_order(requester_email="user@example.com")
    
    work_order.approve()
    
    mock_email.assert_called_once()
    call_args = mock_email.call_args
    assert "已通过" in call_args.kwargs["subject"]
    assert call_args.kwargs["to"] == "user@example.com"

def test_notification_sent_on_rejection(mocker):
    """ATB-6.2: 工单驳回时触发通知"""
    mock_email = mocker.patch("services.notification_service.send_email")
    work_order = create_work_order(requester_email="user@example.com")
    
    work_order.reject(reason="资源不足")
    
    mock_email.assert_called_once()
    call_args = mock_email.call_args
    assert "驳回" in call_args.kwargs["subject"]

def test_notification_on_submission(mocker):
    """ATB-6.3: 新工单提交时通知审批人"""
    mock_email = mocker.patch("services.notification_service.send_email")
    approver = create_approver(email="approver@example.com")
    work_order = create_work_order(approver_id=approver.id)
    
    work_order.submit()
    
    # 审批人收到通知
    call_args = mock_email.call_args
    assert call_args.kwargs["to"] == "approver@example.com"
```

### 4.7 ATB-7: 前端审批页面 (Playwright E2E)

**物理测试用例**:

```typescript
// tests/e2e/approval.spec.ts

import { test, expect } from '@playwright/test';

test('approval_page_renders_pending_list', async ({ page }) => {
  """ATB-7.1: 审批页面正确渲染待审批工单列表"""
  await page.goto('/approval');
  await page.waitForSelector('.work-order-list');
  
  const items = page.locator('.work-order-item');
  await expect(items.first).toBeVisible();
});

test('approve_action_updates_ui', async ({ page }) => {
  """ATB-7.2: 点击通过按钮后 UI 状态立即更新"""
  await page.goto('/approval');
  
  // 点击第一个审批项的通过按钮
  await page.click('[data-testid="approve-btn"]:first');
  await page.fill('[data-testid="comment-input"]', '同意执行');
  await page.click('[data-testid="confirm-btn"]');
  
  // ATB-7.3: 成功提示出现，工单从列表消失
  await expect(page.locator('.toast-success')).toContainText('审批成功');
  await expect(page.locator('.work-order-item')).toHaveCount(0);
});

test('reject_requires_reason', async ({ page }) => {
  """ATB-7.4: 驳回时未填写原因不可提交"""
  await page.goto('/approval');
  
  await page.click('[data-testid="reject-btn"]:first');
  await page.click('[data-testid="confirm-btn"]');
  
  await expect(page.locator('.error-message')).toContainText('请填写驳回原因');
});
```

---

## 5. 开发切入层级序列

### 5.1 层级架构图

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Frontend (React)                          │
│  审批管理页面 / 工单提交表单                          │
├─────────────────────────────────────────────────────┤
│  Layer 3: API Controller                            │
│  审批路由 / 参数校验 / 权限拦截                       │
├─────────────────────────────────────────────────────┤
│  Layer 2: Domain Service (State Machine)            │
│  状态转换规则 / 业务校验 / 事件发布                   │
├─────────────────────────────────────────────────────┤
│  Layer 1: Data Access                              │
│  WorkOrder Model / Repository / Migration           │
├─────────────────────────────────────────────────────┤
│  Layer 0: Infrastructure                            │
│  通知服务 / 数据库事务 / 消息队列                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 开发顺序与任务拆解

| 顺序 | Layer | 任务 | 交付物 | 前置依赖 |
|------|-------|------|--------|----------|
| 1 | Layer 0 | 数据库迁移 - 添加审批字段 | `alembic/versions/xxx_add_approval_fields.sql` | 无 |
| 2 | Layer 1 | WorkOrder Model 扩展 | `src/models/workorder.py` | 1 |
| 3 | Layer 1 | Repository 层实现 | `src/infrastructure/database/repositories.py` | 2 |
| 4 | Layer 2 | 状态机服务开发 | `src/state_machine/approval_state_machine.py` | 2 |
| 5 | Layer 2 | 审批业务逻辑服务 | `src/application/services/approval_service.py` | 4 |
| 6 | Layer 3 | API 路由定义 | `src/api/routes/work_orders.py` | 5 |
| 7 | Layer 0 | 通知服务实现 | `src/application/services/notification_service.py` | 5 |
| 8 | Layer 4 | 前端审批页面开发 | `frontend/src/components/approval/ApprovalPanel.tsx` | 6 |
| 9 | All | ATB 测试编写与执行 | `tests/` 目录 | 7, 8 |

### 5.3 关键实现点

#### 5.3.1 状态机核心逻辑

```python
# src/state_machine/approval_state_machine.py
"""
工单审批状态机模块

状态流转:
    PENDING → APPROVED → CLOSED
         ↘ REJECTED
"""

from dataclasses import dataclass
from typing import Set, Optional
from enum import Enum

class WorkOrderStatus(Enum):
    """工单状态枚举"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"

class StateTransitionError(Exception):
    """状态转换异常"""
    pass

@dataclass
class WorkOrderStateMachine:
    """
    工单状态机
    
    负责管理工单状态流转规则，确保状态转换的合法性和一致性。
    """
    
    VALID_TRANSITIONS: dict = None
    
    def __init__(self):
        self.VALID_TRANSITIONS = {
            WorkOrderStatus.PENDING: {WorkOrderStatus.APPROVED, WorkOrderStatus.REJECTED},
            WorkOrderStatus.APPROVED: {WorkOrderStatus.CLOSED},
            WorkOrderStatus.REJECTED: set(),  # 终态，不可转换
            WorkOrderStatus.CLOSED: set()     # 终态，不可转换
        }
    
    def can_transition(self, current: str, target: str) -> bool:
        """
        检查状态转换是否合法
        
        Args:
            current: 当前状态
            target: 目标状态
            
        Returns:
            bool: 是否允许转换
        """
        try:
            current_state = WorkOrderStatus(current)
            target_state = WorkOrderStatus(target)
        except ValueError:
            return False
        
        allowed = self.VALID_TRANSITIONS.get(current_state, set())
        return target_state in allowed
    
    def transition(self, current: str, action: str) -> str:
        """
        执行状态转换
        
        Args:
            current: 当前状态
            action: 操作动作 (approve/reject/close)
            
        Returns:
            str: 转换后的状态
            
        Raises:
            StateTransitionError: 非法状态转换时抛出
        """
        mapping = {
            "approve": WorkOrderStatus.APPROVED,
            "reject": WorkOrderStatus.REJECTED,
            "close": WorkOrderStatus.CLOSED
        }
        
        if action not in mapping:
            raise StateTransitionError(f"Unknown action: {action}")
        
        next_state = mapping[action]
        
        if not self.can_transition(current, next_state.value):
            raise StateTransitionError(
                f"Invalid transition from {current} to {next_state.value}"
            )
        
        return next_state.value
```

#### 5.3.2 乐观锁防止并发审批

```python
# src/application/services/approval_service.py
"""
工单审批服务模块
"""

from typing import Optional
from datetime import datetime
from src.models.workorder import WorkOrder, WorkOrderStatus
from src.repositories.workorder_repository import WorkOrderRepository
from src.state_machine.approval_state_machine import WorkOrderStateMachine, StateTransitionError
from src.application.services.notification_service import NotificationService

class OptimisticLockError(Exception):
    """乐观锁冲突异常"""
    pass

class PermissionDeniedError(Exception):
    """权限不足异常"""
    pass

class ApprovalService:
    """
    工单审批服务
    
    负责处理工单审批的业务逻辑，包括审批通过、驳回等操作。
    """
    
    def __init__(
        self,
        repository: WorkOrderRepository,
        state_machine: WorkOrderStateMachine,
        notification_service: NotificationService
    ):
        self.repository = repository
        self.state_machine = state_machine
        self.notification_service = notification_service
    
    def approve(
        self,
        work_order_id: int,
        approver_id: int,
        comment: Optional[str] = None
    ) -> WorkOrder:
        """
        审批通过工单
        
        Args:
            work_order_id: 工单 ID
            approver_id: 审批人 ID
            comment: 审批备注
            
        Returns:
            WorkOrder: 更新后的工单
            
        Raises:
            OptimisticLockError: 并发冲突
            PermissionDeniedError: 无审批权限
            StateTransitionError: 状态转换非法
        """
        work_order = self.repository.get_by_id(work_order_id)
        
        # 权限校验
        if work_order.approver_id != approver_id:
            raise PermissionDeniedError(
                f"User {approver_id} is not authorized to approve this work order"
            )
        
        # 状态转换
        new_status = self.state_machine.transition(work_order.status, "approve")
        
        # 乐观锁更新
        affected_rows = self.repository.update_with_optimistic_lock(
            work_order_id,
            {
                "status": new_status,
                "approved_by": approver_id,
                "approved_at": datetime.utcnow(),
                "approved_comment": comment
            },
            expected_version=work_order.version
        )
        
        if affected_rows == 0:
            raise OptimisticLockError(
                "Work order has been modified by another user"
            )
        
        # 触发通知
        self.notification_service.notify_status_change(
            work_order_id=work_order_id,
            old_status=work_order.status,
            new_status=new_status,
            operator_id=approver_id
        )
        
        return self.repository.get_by_id(work_order_id)
    
    def reject(
        self,
        work_order_id: int,
        rejector_id: int,
        reason: str
    ) -> WorkOrder:
        """
        驳回工单
        
        Args:
            work_order_id: 工单 ID
            rejector_id: 驳回人 ID
            reason: 驳回原因 (必填)
            
        Returns:
            WorkOrder: 更新后的工单
        """
        if not reason or not reason.strip():
            raise ValueError("Reject reason is required")
        
        work_order = self.repository.get_by_id(work_order_id)
        
        # 权限校验
        if work_order.approver_id != rejector_id:
            raise PermissionDeniedError(
                f"User {rejector_id} is not authorized to reject this work order"
            )
        
        # 状态转换
        new_status = self.state_machine.transition(work_order.status, "reject")
        
        # 乐观锁更新
        affected_rows = self.repository.update_with_optimistic_lock(
            work_order_id,
            {
                "status": new_status,
                "reject_reason": reason,
                "rejected_by": rejector_id,
                "rejected_at": datetime.utcnow()
            },
            expected_version=work_order.version
        )
        
        if affected_rows == 0:
            raise OptimisticLockError(
                "Work order has been modified by another user"
            )
        
        # 触发通知
        self.notification_service.notify_status_change(
            work_order_id=work_order_id,
            old_status=work_order.status,
            new_status=new_status,
            operator_id=rejector_id,
            reason=reason
        )
        
        return self.repository.get_by_id(work_order_id)
```

#### 5.3.3 Repository 乐观锁实现

```python
# src/infrastructure/database/repositories.py
"""
数据库访问层 - 工单仓储
"""

from typing import Optional, Dict, Any
from sqlalchemy import update
from sqlalchemy.orm import Session

class WorkOrderRepository:
    """
    工单仓储
    
    提供工单数据的持久化操作。
    """
    
    def __init__(self, session: Session):
        self.session = session
    
    def update_with_optimistic_lock(
        self,
        work_order_id: int,
        updates: Dict[str, Any],
        expected_version: int
    ) -> int:
        """
        使用乐观锁更新工单
        
        Args:
            work_order_id: 工单 ID
            updates: 要更新的字段
            expected_version: 期望的版本号
            
        Returns:
            int: 受影响的行数 (0 表示版本冲突)
        """
        stmt = (
            update(WorkOrder)
            .where(
                WorkOrder.id == work_order_id,
                WorkOrder.version == expected_version
            )
            .values(
                **updates,
                version=expected_version + 1
            )
        )
        
        result = self.session.execute(stmt)
        self.session.commit()
        
        return result.rowcount
```

#### 5.3.4 事件驱动通知

```python
# src/application/services/notification_service.py
"""
通知服务模块
"""

from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class WorkOrderStatusChangedEvent:
    """
    工单状态变更事件
    
    用于触发通知的事件对象。
    """
    work_order_id: int
    work_order_title: str
    old_status: str
    new_status: str
    operator_id: int
    operator_name: str
    recipient_email: str
    reason: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

class NotificationService:
    """
    通知服务
    
    负责发送工单状态变更通知。
    """
    
    def __init__(self, email_client, in_app_client):
        self.email_client = email_client
        self.in_app_client = in_app_client
    
    def notify_status_change(
        self,
        work_order_id: int,
        old_status: str,
        new_status: str,
        operator_id: int,
        reason: Optional[str] = None
    ) -> None:
        """
        发送状态变更通知
        
        Args:
            work_order_id: 工单 ID
            old_status: 原状态
            new_status: 新状态
            operator_id: 操作人 ID
            reason: 原因 (驳回时必填)
        """
        # 获取工单详情
        work_order = self._get_work_order(work_order_id)
        operator = self._get_user(operator_id)
        
        event = WorkOrderStatusChangedEvent(
            work_order_id=work_order_id,
            work_order_title=work_order.title,
            old_status=old_status,
            new_status=new_status,
            operator_id=operator_id,
            operator_name=operator.name,
            recipient_email=work_order.requester_email,
            reason=reason
        )
        
        # 发送邮件通知
        self._send_email_notification(event)
        
        # 发送站内信通知
        self._send_in_app_notification(event)
    
    def _send_email_notification(self, event: WorkOrderStatusChangedEvent) -> None:
        """发送邮件通知"""
        status_text = {
            "APPROVED": "已通过",
            "REJECTED": "已驳回",
            "CLOSED": "已关闭"
        }
        
        subject = f"工单「{event.work_order_title}」{status_text.get(event.new_status, '状态变更')}"
        body = self._build_email_body(event)
        
        self.email_client.send(
            to=event.recipient_email,
            subject=subject,
            body=body
        )
    
    def _send_in_app_notification(self, event: WorkOrderStatusChangedEvent) -> None:
        """发送站内信通知"""
        message = self._build_in_app_message(event)
        
        self.in_app_client.send(
            user_id=event.work_order_id,  # 实际应为 requester_id
            message=message
        )
    
    def _build_email_body(self, event: WorkOrderStatusChangedEvent) -> str:
        """构建邮件正文"""
        lines = [
            f"工单标题: {event.work_order_title}",
            f"工单编号: {event.work_order_id}",
            f"操作人: {event.operator_name}",
            f"原状态: {event.old_status}",
            f"新状态: {event.new_status}",
        ]
        
        if event.reason:
            lines.append(f"原因: {event.reason}")
        
        lines.append(f"时间: {event.timestamp.isoformat()}")
        
        return "\n".join(lines)
    
    def _build_in_app_message(self, event: WorkOrderStatusChangedEvent) -> str:
        """构建站内信消息"""
        action = "通过" if event.new_status == "APPROVED" else "驳回"
        return f"您的工单「{event.work_order_title}」已被{action}"
```

---

## 6. 数据模型变更

### 6.1 数据库 Schema 变更

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT | PK | 工单主键 |
| `title` | VARCHAR(200) | NOT NULL | 工单标题 |
| `description` | TEXT | - | 工单描述 |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | 状态 |
| `priority` | ENUM | - | 优先级 |
| `category` | VARCHAR(50) | - | 类别 |
| `requester_id` | BIGINT | FK | 申请人 |
| `approver_id` | BIGINT | FK | 指定审批人 |
| `approved_by` | BIGINT | FK | 实际审批人 |
| `approved_at` | TIMESTAMP | - | 审批时间 |
| `approved_comment` | TEXT | - | 审批备注 |
| `reject_reason` | TEXT | - | 驳回原因 |
| `rejected_by` | BIGINT | FK | 驳回人 |
| `rejected_at` | TIMESTAMP | - | 驳回时间 |
| `version` | INT | NOT NULL, DEFAULT 0 | 乐观锁版本号 |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | 更新时间 |

### 6.2 状态枚举定义

```python
# src/models/enums.py
from enum import Enum

class WorkOrderStatus(str, Enum):
    """工单状态枚举"""
    PENDING = "PENDING"      # 待审批
    APPROVED = "APPROVED"    # 已通过
    REJECTED = "REJECTED"    # 已驳回
    CLOSED = "CLOSED"        # 已关闭
```

---

## 7. API 响应格式

### 7.1 成功响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1001,
    "title": "服务器扩容",
    "status": "APPROVED",
    "approved_by": 5,
    "approved_at": "2025-01-15T10:30:00Z",
    "approved_comment": "同意扩容，联系运维执行"
  }
}
```

### 7.2 错误响应

```json
{
  "code": 409,
  "message": "conflict",
  "errors": {
    "detail": "Work order has been modified by another user"
  }
}
```

---

## 8. 前端组件接口定义

### 8.1 ApprovalPanel Props

```typescript
// frontend/src/components/approval/ApprovalPanel.tsx

export interface ApprovalPanelProps {
  /** 当前登录用户 ID */
  userId: number;
  /** 当前登录用户角色 */
  userRole: 'requester' | 'approver' | 'admin';
  /** 审批完成回调 */
  onApprovalComplete?: (workOrderId: number, action: 'approve' | 'reject') => void;
  /** 工单提交成功回调 */
  onWorkOrderSubmit?: (workOrder: WorkOrder) => void;
}

export interface WorkOrder {
  id: number;
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
  requesterId: number;
  approverId: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## 附录

### A. 参考文档

- [State Machine Pattern](https://martinfowler.com/articles/dslWorkflow.html)
- [Optimistic Locking in PostgreSQL](https://www.postgresql.org/docs/current/sql-update.html)
- [Ant Design Table Component](https://ant.design/components/table/)

### B. 术语表

| 术语 | 定义 |
|------|------|
| ATB | Acceptance Test Benchmarks，验收测试基准 |
| Optimistic Lock | 乐观锁，通过版本号防止并发冲突 |
| State Machine | 状态机，定义状态转换规则的模型 |

---

**文档结束**