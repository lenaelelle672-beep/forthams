# [SWARM-WO-001] 工单审批流程规格指导文档

**版本**: 1.0  
**迭代**: Iteration 1  
**日期**: 2025-01-XX  
**任务**: 工单审批流程：前端审批页面 + 后端状态机 + 通知机制

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是企业内部运维/服务请求的核心流转机制。当前系统缺失在线审批能力，审批人需通过线下渠道（邮件/IM/口头）确认，导致：

- 审批记录不可追溯
- 状态同步滞后
- 审计合规风险

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

### Phase 2 实施范围

```
Phase 1 (已交付): 数据模型定义、工单 CRUD 基础接口
Phase 2 (本次):   审批流程 + 状态机 + 通知机制
Phase 3 (规划中): 审批链（多级审批）、加签/转交
```

### 2.1 交付物清单

| 交付物 | 具体内容 | 状态 |
|--------|----------|------|
| `WO-API-201` | 提交工单接口 `POST /api/v1/work-orders` | 待实现 |
| `WO-API-202` | 获取审批列表 `GET /api/v1/work-orders/pending` | 待实现 |
| `WO-API-203` | 审批操作接口 `POST /api/v1/work-orders/{id}/approve` | 待实现 |
| `WO-API-204` | 驳回操作接口 `POST /api/v1/work-orders/{id}/reject` | 待实现 |
| `WO-SVC-001` | 状态机服务（状态转换规则引擎） | 待实现 |
| `WO-NOTIFY-001` | 通知服务（事件驱动通知分发） | 待实现 |
| `WO-FE-001` | 审批管理前端页面 | 待实现 |

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
❌ 审批时限/超时自动处理
```

### 3.3 技术约束

| 约束项 | 限制 |
|--------|------|
| 状态机实现 | 优先使用数据库乐观锁，禁用分布式锁 |
| 通知渠道 | 初期仅支持邮件 + 站内信，不含 SMS/企微 |
| 前端框架 | React 18 + Ant Design 5 |
| API 响应时间 | P95 < 500ms |
| 并发处理 | 乐观锁保证幂等性 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 工单提交功能

**物理测试用例**:

```python
# tests/api/test_work_order_submission.py

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

def test_submit_work_order_missing_required_fields():
    """ATB-1.2: 缺少必填字段时返回 422"""
    payload = {"title": "仅标题"}
    response = api_client.post("/api/v1/work-orders", json=payload)
    assert response.status_code == 422

def test_submit_work_order_unauthorized():
    """ATB-1.3: 未认证请求返回 401"""
    response = unauthenticated_client.post("/api/v1/work-orders", json={...})
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
    assert any(item["id"] == work_order.id for item in response.json()["items"])

def test_get_pending_approvals_as_requester():
    """ATB-2.2: 普通用户访问待审批列表返回 403"""
    response = api_client.get("/api/v1/work-orders/pending")
    assert response.status_code == 403
```

### 4.3 ATB-3: 审批操作 (通过)

**物理测试用例**:

```python
# tests/api/test_approval_action.py

def test_approve_work_order_success():
    """ATB-3.1: 审批人通过工单，状态变为 APPROVED"""
    work_order = create_work_order(status="PENDING")
    payload = {"comment": "同意扩容，联系运维执行"}
    response = api_client.post(f"/api/v1/work-orders/{work_order.id}/approve", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"
    
    # ATB-3.2: 数据库记录审批人信息
    db_record = db.query(WorkOrder).get(work_order.id)
    assert db_record.approved_by == current_user.id
    assert db_record.approved_at is not None

def test_approve_already_approved_work_order():
    """ATB-3.3: 重复审批返回 409 Conflict"""
    response = api_client.post(f"/api/v1/work-orders/{already_approved_id}/approve", json={})
    assert response.status_code == 409

def test_approve_without_permission():
    """ATB-3.4: 非分配审批人操作返回 403"""
    response = other_approver_client.post(f"/api/v1/work-orders/{work_order.id}/approve", json={})
    assert response.status_code == 403
```

### 4.4 ATB-4: 驳回操作

**物理测试用例**:

```python
# tests/api/test_rejection.py

def test_reject_work_order_requires_comment():
    """ATB-4.1: 驳回操作必须填写驳回原因"""
    response = api_client.post(f"/api/v1/work-orders/{work_order.id}/reject", json={})
    assert response.status_code == 422  # Validation error

def test_reject_work_order_success():
    """ATB-4.2: 驳回后状态变为 REJECTED"""
    response = api_client.post(
        f"/api/v1/work-orders/{work_order.id}/reject",
        json={"reason": "资源不足，暂缓执行"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "REJECTED"
```

### 4.5 ATB-5: 状态机规则

**物理测试用例**:

```python
# tests/domain/test_state_machine.py

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
        lambda: api_client.post(f"/api/v1/work-orders/{work_order.id}/approve", json={}),
        lambda: api_client.post(f"/api/v1/work-orders/{work_order.id}/approve", json={})
    ])
    # 仅一个返回 200，另一个返回 409
    success_count = sum(1 for r in results if r.status_code == 200)
    assert success_count == 1
```

### 4.6 ATB-6: 通知机制

**物理测试用例**:

```python
# tests/notification/test_notify_service.py

def test_notification_sent_on_approval(mocker):
    """ATB-6.1: 工单通过时触发通知"""
    mock_email = mocker.patch("services.notify.send_email")
    work_order = create_work_order(requester_email="user@example.com")
    
    work_order.approve()
    
    mock_email.assert_called_once()
    call_args = mock_email.call_args
    assert "已通过" in call_args.kwargs["subject"]

def test_notification_sent_on_rejection(mocker):
    """ATB-6.2: 工单驳回时触发通知"""
    mock_email = mocker.patch("services.notify.send_email")
    work_order = create_work_order()
    
    work_order.reject(reason="资源不足")
    
    mock_email.assert_called_once()
    call_args = mock_email.call_args
    assert "驳回" in call_args.kwargs["subject"]

def test_notification_on_submission(mocker):
    """ATB-6.3: 新工单提交时通知审批人"""
    mock_email = mocker.patch("services.notify.send_email")
    work_order = create_work_order(approver_email="approver@example.com")
    
    work_order.submit()
    
    # 审批人收到通知
    assert mock_email.call_args.kwargs["to"] == "approver@example.com"
```

### 4.7 ATB-7: 前端审批页面

**Playwright E2E 测试**:

```typescript
// tests/e2e/test_approval_page.spec.ts
import { test, expect, Page } from '@playwright/test';

async function setupApprovalPage(page: Page) {
  await page.goto('/approval');
  await page.waitForSelector('.work-order-list');
}

test('approval_page_renders_pending_list', async ({ page }) => {
  """ATB-7.1: 审批页面正确渲染待审批工单列表"""
  await setupApprovalPage(page);
  const items = page.locator('.work-order-item');
  await expect(items.first).toBeVisible();
});

test('approve_action_updates_ui', async ({ page }) => {
  """ATB-7.2: 点击通过按钮后 UI 状态立即更新"""
  await setupApprovalPage(page);
  await page.click('[data-testid="approve-btn"]:first');
  await page.fill('[data-testid="comment-input"]', '同意执行');
  await page.click('[data-testid="confirm-btn"]');
  
  // ATB-7.3: 成功提示出现，工单从列表消失
  await expect(page.locator('.toast-success')).toContainText('审批成功');
  await expect(page.locator('.work-order-item')).toHaveCount(0);
});

test('reject_requires_reason', async ({ page }) => {
  """ATB-7.4: 驳回时未填写原因不可提交"""
  await setupApprovalPage(page);
  await page.click('[data-testid="reject-btn"]:first');
  await page.click('[data-testid="confirm-btn"]');
  
  await expect(page.locator('.error-message')).toContainText('请填写驳回原因');
});
```

---

## 5. 开发切入层级序列

### 5.1 层级架构

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

| 顺序 | Layer | 任务 | 交付物 | 依赖 |
|------|-------|------|--------|------|
| 1 | Layer 0 | 数据库迁移 - 添加审批字段 | `migrations/xxx_add_approval_fields.sql` | 无 |
| 2 | Layer 1 | WorkOrder Model 扩展 | `models/work_order.py` | 1 |
| 3 | Layer 1 | Repository 层实现 | `repositories/work_order.py` | 2 |
| 4 | Layer 2 | 状态机服务开发 | `services/state_machine.py` | 2 |
| 5 | Layer 2 | 审批业务逻辑服务 | `services/approval_service.py` | 4 |
| 6 | Layer 3 | API 路由定义 | `api/v1/work_orders.py` | 5 |
| 7 | Layer 0 | 通知服务实现 | `services/notify_service.py` | 5 |
| 8 | Layer 4 | 前端审批页面开发 | `pages/approval/index.tsx` | 6 |
| 9 | All | ATB 测试编写与执行 | `tests/` 目录 | 7, 8 |

### 5.3 本次任务文件清单

| 序号 | 文件路径 | 修改类型 | 核心改动 |
|------|----------|----------|----------|
| 1 | `frontend/src/components/approval/ApprovalPanel.tsx` | 修改 | 审批操作面板组件 |
| 2 | `frontend/src/stores/approvalStore.ts` | 修改 | 审批状态管理 |
| 3 | `frontend/src/pages/WorkOrder/types/workOrder.ts` | 修改 | 工单类型定义 |
| 4 | `frontend/src/router/approval.ts` | 修改 | 审批路由配置 |
| 5 | `src/state_machine/approval_state_machine.py` | 修改 | 审批状态机核心逻辑 |

---

## 6. 附录

### 6.1 数据模型变更

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | ENUM | PENDING / APPROVED / REJECTED / CLOSED |
| `approver_id` | INT | 指定审批人 FK |
| `approved_by` | INT | 实际审批人 FK |
| `approved_at` | TIMESTAMP | 审批时间 |
| `reject_reason` | TEXT | 驳回原因 |
| `version` | INT | 乐观锁版本号 |

### 6.2 API 响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1001,
    "title": "服务器扩容",
    "status": "APPROVED",
    "approved_by": 5,
    "approved_at": "2025-01-15T10:30:00Z"
  }
}
```

### 6.3 状态流转图

```
                    ┌─────────────┐
                    │   PENDING   │ ←─── 工单提交
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
       ┌───────────┐            ┌───────────┐
       │ APPROVED  │            │ REJECTED  │
       └─────┬─────┘            └───────────┘
             │                         │
             ▼                         │
      ┌─────────────┐                   │
      │   CLOSED    │ ←─ 工单完成        │
      └─────────────┘                   │
                                         │
                              (终态，不可逆转)
```

---

**文档结束**