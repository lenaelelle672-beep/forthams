# SWARM-001 工单审批流程 - 规格指导文档

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是组织内部处理各类申请（请假、报销、采购、设备领用等）的核心业务流程。本系统需支持用户在线提交工单、实时追踪审批进度、自动化状态流转以及及时的通知推送。

### 1.2 核心痛点

| 痛点 | 描述 |
|------|------|
| 流程冗长 | 传统纸质审批流程环节多、耗时长 |
| 状态不透明 | 申请人无法实时了解工单审批进度 |
| 通知滞后 | 审批人无法及时获知待审批事项 |
| 追溯困难 | 缺乏统一的状态管理和操作审计能力 |

### 1.3 目标用户

| 角色 | 权限范围 |
|------|----------|
| 申请人 | 提交工单、查看自己提交的工单状态 |
| 审批人 | 查看待审批列表、执行审批/拒绝操作 |
| 管理员 | 配置审批流程、查看全部工单数据 |

### 1.4 功能概述

本迭代（Iteration 1）实现以下核心功能：

1. **工单创建**：用户可在前端填写工单表单并提交
2. **状态机流转**：实现 Pending → Approved/Rejected 基础流转逻辑
3. **审批通知**：审批完成后触发站内消息通知申请人
4. **状态查询**：用户可查看本人工单的当前状态

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 1: 核心审批链路（当前迭代）

| 功能模块 | 具体目标 | 交付物 |
|----------|----------|--------|
| 工单创建 | 支持用户填写工单表单并提交 | CreatePage.tsx, WorkOrderForm.tsx |
| 状态机流转 | 实现 Pending → Approved/Rejected | state_machine.py, transitions.py |
| 审批通知 | 审批完成后触发站内消息通知 | NotificationService, in_app_channel.py |
| 状态查询 | 用户可查看本人工单的当前状态 | MyListPage.tsx, DetailPage.tsx |

### 2.2 Phase 2: 增强功能（后续迭代）

| 功能模块 | 目标描述 |
|----------|----------|
| 多级审批链 | 支持配置多层级审批节点 |
| 审批委托 | 审批人可委托他人代为审批 |
| 工单撤回 | 申请人在审批前可撤回工单 |
| 催办机制 | 支持申请人催促审批进度 |

### 2.3 Phase 3: 高级特性（远期规划）

| 功能模块 | 目标描述 |
|----------|----------|
| 审批时效 SLA | 监控审批时效并提醒超期 |
| 数据统计报表 | 审批效率、周期等数据可视化 |
| 移动端适配 | 支持移动设备审批操作 |
| 集成第三方 |与企业微信、钉钉等集成 |

---

## 3. 边界约束

### 3.1 技术边界

| 约束项 | 限制条件 | 说明 |
|--------|----------|------|
| 单次工单附件 | ≤ 5 个文件 | 超出数量限制需分批提交 |
| 单文件大小 | ≤ 10MB | 超出限制拒绝上传 |
| 工单自定义字段 | ≤ 20 个 | 包含所有类型的自定义字段总数 |
| 审批链路深度 | Phase 1 仅支持单级审批 | 暂不支持多级审批链 |
| 并发审批 | 同一工单同时仅允许 1 人操作 | 需加锁防止并发冲突 |
| 通知渠道 | Phase 1 仅支持站内通知 | 后续迭代扩展邮件/短信 |
| API 版本 | 所有接口统一使用 `/api/v1/` 前缀 | 便于版本管理和灰度发布 |

### 3.2 数据边界

| 约束项 | 限制条件 |
|--------|----------|
| 数据保留周期 | 永久保存（软删除后保留 90 天） |
| 审批历史 | 不可篡改，需记录完整操作轨迹 |
| 状态变更审计 | 必须记录操作人、时间戳、变更原因 |

### 3.3 安全边界

| 约束项 | 限制条件 |
|--------|----------|
| 访问控制 | 用户仅能查看/操作有权限的工单 |
| 敏感字段 | 金额等敏感信息需脱敏展示 |
| 接口鉴权 | 所有 API 需 Token 鉴权 |
| 越权防护 | 申请人不能审批自己提交的工单 |

### 3.4 性能边界

| 指标 | 目标值 |
|------|--------|
| API 响应时间 | P95 < 500ms |
| 工单列表查询 | 支持分页，每页 ≤ 50 条 |
| 状态变更延迟 | 通知发送异步化，不阻塞主流程 |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (pytest)

#### 4.1.1 状态机流转测试

```python
# tests/unit/test_workflow_state_machine.py

def test_pending_to_approved_transition():
    """验收：状态为 PENDING 时可流转至 APPROVED"""
    workflow = WorkOrderWorkflow()
    result = workflow.transition("PENDING", "APPROVE", role="approver")
    assert result.state == "APPROVED"
    assert result.timestamp is not None
    assert result.operator is not None

def test_pending_to_rejected_transition():
    """验收：状态为 PENDING 时可流转至 REJECTED"""
    workflow = WorkOrderWorkflow()
    result = workflow.transition("PENDING", "REJECT", role="approver")
    assert result.state == "REJECTED"

def test_invalid_transition_blocked():
    """验收：非法状态流转被拒绝"""
    workflow = WorkOrderWorkflow()
    with pytest.raises(InvalidTransitionError):
        workflow.transition("APPROVED", "PENDING", role="approver")

def test_rejected_state_final():
    """验收：REJECTED 为终态，不可再次流转"""
    workflow = WorkOrderWorkflow()
    workflow.transition("PENDING", "REJECT", role="approver")
    with pytest.raises(FinalStateError):
        workflow.transition("REJECTED", "APPROVE", role="approver")

def test_approved_state_final():
    """验收：APPROVED 为终态，不可再次流转"""
    workflow = WorkOrderWorkflow()
    workflow.transition("PENDING", "APPROVE", role="approver")
    with pytest.raises(FinalStateError):
        workflow.transition("APPROVED", "REJECT", role="approver")
```

#### 4.1.2 权限校验测试

```python
# tests/unit/test_permission.py

def test_applicant_cannot_approve_own_order():
    """验收：申请人不能审批自己提交的工单"""
    order = WorkOrder(creator_id="user_001")
    permission = PermissionChecker()
    assert permission.can_approve(order, user_id="user_001") is False

def test_unauthorized_user_blocked():
    """验收：非审批人无法执行审批操作"""
    order = WorkOrder()
    permission = PermissionChecker()
    assert permission.can_approve(order, user_id="random_user") is False

def test_approver_can_approve_pending_order():
    """验收：审批人可正常审批待审批工单"""
    order = WorkOrder(status="PENDING")
    permission = PermissionChecker()
    assert permission.can_approve(order, user_id="approver_001") is True

def test_only_creator_can_view_own_orders():
    """验收：用户仅能查看自己创建的工单"""
    order = WorkOrder(creator_id="user_001")
    permission = PermissionChecker()
    assert permission.can_view(order, user_id="user_001") is True
    assert permission.can_view(order, user_id="user_002") is False
```

#### 4.1.3 通知机制测试

```python
# tests/unit/test_notification.py

def test_notification_sent_on_approval():
    """验收：审批通过后生成站内通知"""
    with patch("services.NotificationService.send") as mock_send:
        handler = ApprovalHandler()
        handler.process("order_123", "APPROVED")
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert "order_123" in call_args[1].get("content", "")

def test_notification_sent_on_rejection():
    """验收：审批拒绝后生成站内通知"""
    with patch("services.NotificationService.send") as mock_send:
        handler = ApprovalHandler()
        handler.process("order_123", "REJECTED")
        mock_send.assert_called_once()
        notification_type = mock_send.call_args[1].get("type")
        assert notification_type == "APPROVAL_RESULT"

def test_notification_includes_operator_info():
    """验收：通知内容包含审批人信息"""
    with patch("services.NotificationService.send") as mock_send:
        handler = ApprovalHandler()
        handler.process("order_123", "APPROVED", operator="admin")
        call_args = mock_send.call_args
        assert "admin" in call_args[1].get("content", "")
```

---

### 4.2 集成测试 (pytest + pytest-asyncio)

#### 4.2.1 端到端工单流程测试

```python
# tests/integration/test_workorder_e2e.py

@pytest.mark.asyncio
async def test_full_approval_flow():
    """验收：完整审批流程 - 创建→审批→通知→状态更新"""
    # 1. 创建工单
    response = await client.post("/api/v1/workorders", json={
        "title": "采购申请",
        "type": "PURCHASE",
        "content": "测试内容",
        "priority": "NORMAL"
    })
    assert response.status_code == 201
    order_id = response.json()["id"]
    assert response.json()["status"] == "PENDING"
    
    # 2. 审批人审批
    approve_response = await client.post(
        f"/api/v1/workorders/{order_id}/approve",
        json={"action": "APPROVE", "comment": "同意"}
    )
    assert approve_response.status_code == 200
    
    # 3. 验证状态变更
    status_response = await client.get(f"/api/v1/workorders/{order_id}")
    assert status_response.json()["status"] == "APPROVED"
    
    # 4. 验证通知已发送
    notification = await db.notifications.find_one({"order_id": order_id})
    assert notification is not None
    assert notification["type"] == "APPROVAL_RESULT"
    assert notification["result"] == "APPROVED"

@pytest.mark.asyncio
async def test_rejection_flow():
    """验收：拒绝流程 - 创建→拒绝→状态更新→通知"""
    response = await client.post("/api/v1/workorders", json={
        "title": "测试申请",
        "type": "OTHER",
        "content": "测试拒绝流程"
    })
    order_id = response.json()["id"]
    
    reject_response = await client.post(
        f"/api/v1/workorders/{order_id}/approve",
        json={"action": "REJECT", "comment": "条件不符"}
    )
    assert reject_response.status_code == 200
    
    status_response = await client.get(f"/api/v1/workorders/{order_id}")
    assert status_response.json()["status"] == "REJECTED"
```

#### 4.2.2 并发操作冲突测试

```python
# tests/integration/test_concurrent_approval.py

def test_concurrent_approval_only_one_succeeds():
    """验收：同一工单同时审批，仅一操作成功"""
    order_id = create_test_order()
    
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(approve_order, order_id, user="approver_1"),
            executor.submit(approve_order, order_id, user="approver_2")
        ]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    success_count = sum(1 for r in results if r["status"] == 200)
    assert success_count == 1, "仅允许一个审批操作成功"
    
    # 验证只有一个最终状态
    final_state = db.get_order_status(order_id)
    assert final_state in ["APPROVED", "REJECTED"]

def test_concurrent_read_write_no_corruption():
    """验收：并发读写不导致数据损坏"""
    order_id = create_test_order()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = []
        for i in range(10):
            futures.append(executor.submit(
                query_order_status, order_id
            ))
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    # 所有查询应返回一致的状态
    states = set(results)
    assert len(states) == 1, "并发查询应返回一致状态"
```

#### 4.2.3 API 契约测试

```python
# tests/integration/test_api_contract.py

def test_workorder_create_api_contract():
    """验收：创建工单 API 符合接口契约"""
    response = client.post("/api/v1/workorders", json={
        "title": "Test",
        "type": "PURCHASE",
        "content": "Content"
    })
    
    # 验证响应结构
    data = response.json()
    assert "id" in data
    assert "status" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["status"] == "PENDING"

def test_workorder_status_api_contract():
    """验收：工单状态 API 返回完整信息"""
    order_id = create_test_order()
    response = client.get(f"/api/v1/workorders/{order_id}")
    
    data = response.json()
    required_fields = ["id", "title", "type", "status", "content", 
                       "creator_id", "created_at", "updated_at"]
    for field in required_fields:
        assert field in data, f"缺少必需字段: {field}"
```

---

### 4.3 E2E 测试 (Playwright)

#### 4.3.1 用户提交流程测试

```typescript
// tests/e2e/approval.spec.ts

import { test, expect } from '@playwright/test';

test.describe('工单审批流程 - 用户端', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('#username', 'test_user');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('用户可提交工单并追踪状态', async ({ page }) => {
    // 1. 进入创建工单页面
    await page.goto('/workorder/create');
    
    // 2. 填写工单表单
    await page.fill('#title', '设备采购申请');
    await page.selectOption('#type', 'PURCHASE');
    await page.fill('#content', '需要采购办公设备一批');
    await page.fill('#priority', 'NORMAL');
    
    // 3. 提交工单
    await page.click('button[type="submit"]');
    
    // 4. 验证提交成功并跳转详情页
    await expect(page).toHaveURL(/\/workorder\/\d+/);
    await expect(page.locator('.status-badge')).toHaveText('待审批');
    await expect(page.locator('.toast')).toContainText('提交成功');
    
    // 5. 记录工单号并验证列表页
    const orderId = page.url().split('/').pop();
    await page.goto('/workorder/my-list');
    await expect(page.locator(`tr[data-order-id="${orderId}"]`)).toBeVisible();
    await expect(page.locator(`tr[data-order-id="${orderId}"] .status`)).toHaveText('待审批');
  });

  test('用户可查看工单详情', async ({ page }) => {
    // 创建工单
    const orderId = await createTestOrder();
    
    // 查看详情
    await page.goto(`/workorder/${orderId}`);
    
    // 验证页面内容
    await expect(page.locator('.order-title')).toBeVisible();
    await expect(page.locator('.order-status')).toBeVisible();
    await expect(page.locator('.order-history')).toBeVisible();
  });
});
```

#### 4.3.2 审批人操作测试

```typescript
// tests/e2e/approval.spec.ts

test.describe('工单审批流程 - 审批人端', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'approver');
  });

  test('审批人可查看待审批工单列表', async ({ page }) => {
    // 1. 进入待审批列表
    await page.goto('/approver/pending');
    
    // 2. 验证列表显示
    await expect(page.locator('.pending-count')).toBeVisible();
    await expect(page.locator('.order-item').first).toBeVisible();
    
    // 3. 验证工单信息完整
    const firstItem = page.locator('.order-item').first;
    await expect(firstItem.locator('.order-title')).toBeVisible();
    await expect(firstItem.locator('.order-type')).toBeVisible();
    await expect(firstItem.locator('.order-date')).toBeVisible();
  });

  test('审批人可批准工单', async ({ page }) => {
    // 1. 进入待审批列表
    await page.goto('/approver/pending');
    
    // 2. 点击审批按钮
    await page.locator('.order-item').first.locator('.approve-btn').click();
    
    // 3. 填写审批意见
    await page.fill('textarea[name="comment"]', '同意该申请');
    
    // 4. 确认审批
    await page.click('#confirm-approve');
    
    // 5. 验证成功提示
    await expect(page.locator('.toast')).toContainText('审批成功');
    
    // 6. 验证状态更新
    await expect(page.locator('.order-item').first.locator('.status'))
      .toHaveText('已通过');
  });

  test('审批人可拒绝工单', async ({ page }) => {
    await page.goto('/approver/pending');
    
    // 点击拒绝按钮
    await page.locator('.order-item').first.locator('.reject-btn').click();
    
    // 填写拒绝原因
    await page.fill('textarea[name="reason"]', '申请条件不符合要求');
    
    // 确认拒绝
    await page.click('#confirm-reject');
    
    // 验证状态更新
    await expect(page.locator('.order-item').first.locator('.status'))
      .toHaveText('已拒绝');
  });
});
```

#### 4.3.3 通知验证测试

```typescript
test('审批结果通知正确显示', async ({ page }) => {
  // 以申请人身份登录
  await loginAs(page, 'test_user');
  
  // 创建工单
  const orderId = await createTestOrder();
  
  // 模拟审批人审批
  await approveOrder(orderId);
  
  // 检查通知
  await page.goto('/notifications');
  
  // 验证通知列表
  await expect(page.locator('.notification-item').first).toBeVisible();
  await expect(page.locator('.notification-title')).toContainText('审批结果通知');
  await expect(page.locator('.notification-content')).toContainText(orderId);
  
  // 点击通知跳转详情
  await page.locator('.notification-item').first.click();
  await expect(page).toHaveURL(new RegExp(`/workorder/${orderId}`));
});
```

---

### 4.4 测试覆盖率要求

| 测试类型 | 覆盖率门槛 | 说明 |
|----------|------------|------|
| 状态机核心逻辑 | 100% 分支覆盖 | 所有状态流转路径 |
| 权限校验逻辑 | 100% 分支覆盖 | 所有权限判断分支 |
| API 端点 | 请求/响应格式 100% 覆盖 | 所有接口契约 |
| E2E 核心流程 | 主路径 100% 覆盖 | 审批完整链路 |

### 4.5 验收检查清单

| 序号 | 检查项 | 验证方法 | 通过标准 |
|------|--------|----------|----------|
| 1 | 工单可正常创建 | E2E 测试 | 状态为 PENDING |
| 2 | 审批人可见待审批列表 | E2E 测试 | 列表正常展示 |
| 3 | 审批操作正常流转状态 | 集成测试 | 状态正确变更 |
| 4 | 审批后发送通知 | 集成测试 | 通知记录存在 |
| 5 | 申请人可见审批结果 | E2E 测试 | 状态页面可查 |
| 6 | 非法流转被阻止 | 单元测试 | 抛出异常 |
| 7 | 权限校验生效 | 单元测试 | 无权限操作被拒 |
| 8 | 并发操作无冲突 | 集成测试 | 仅一操作成功 |

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     前端交互层 (L5)                          │
│  pages/*.tsx, components/*.tsx                              │
├─────────────────────────────────────────────────────────────┤
│                     API 接口层 (L4)                          │
│  routes/*.py, schemas/*.py                                  │
├─────────────────────────────────────────────────────────────┤
│                     通知机制层 (L3)                          │
│  handlers/*.py, channels/*.py, templates/*.html             │
├─────────────────────────────────────────────────────────────┤
│                     业务规则层 (L2)                          │
│  domain/services/*.py, domain/workflow/*.py                 │
├─────────────────────────────────────────────────────────────┤
│                     数据模型层 (L1)                          │
│  models/*.py, entities/*.py                                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 层级 1: 数据模型层

**目录结构：**
```
src/
├── models/
│   ├── workorder.py              # 工单实体定义
│   ├── workflow_state.py         # 状态枚举与定义
│   ├── approval_record.py        # 审批记录实体
│   └── notification.py           # 通知实体
├── entities/
│   ├── WorkOrder.java            # 工单实体 (Java)
│   ├── ApprovalRecord.java       # 审批记录实体
│   └── NotificationRecord.java   # 通知记录实体
```

**交付物：**
- [ ] 完成 ER 图设计文档
- [ ] 数据库 Migration 脚本
- [ ] 实体类定义完成

**前置依赖：** 需求评审通过

---

### 5.3 层级 2: 状态机与业务规则层

**目录结构：**
```
src/
├── domain/
│   ├── workflow/
│   │   ├── state_machine.py      # 状态机核心引擎
│   │   ├── transitions.py        # 状态流转规则定义
│   │   └── validators.py         # 业务规则校验器
│   └── services/
│       ├── workorder_service.py   # 工单领域服务
│       └── approval_service.py    # 审批领域服务
```

**核心组件：**

| 组件 | 职责 |
|------|------|
| `StateMachine` | 状态流转引擎，管理状态转换 |
| `Transition` | 定义状态转换规则和条件 |
| `Validator` | 校验业务规则是否满足 |
| `WorkOrderService` | 工单领域业务逻辑 |
| `ApprovalService` | 审批领域业务逻辑 |

**交付物：**
- [ ] 状态机可独立运行测试
- [ ] 业务规则单元测试通过
- [ ] 状态流转覆盖率 100%

**前置依赖：** 数据模型层完成

---

### 5.4 层级 3: 通知机制层

**目录结构：**
```
src/
├── notifications/
│   ├── handlers/
│   │   ├── __init__.py
│   │   └── approval_handler.py   # 审批结果通知处理器
│   ├── channels/
│   │   ├── __init__.py
│   │   └── in_app_channel.py     # 站内通知渠道实现
│   └── templates/
│       ├── __init__.py
│       └── approval_result.html  # 通知模板
```

**核心组件：**

| 组件 | 职责 |
|------|------|
| `ApprovalHandler` | 监听审批事件，触发通知 |
| `InAppChannel` | 站内通知发送实现 |
| `NotificationTemplate` | 通知内容模板 |

**交付物：**
- [ ] 通知发送单元测试通过
- [ ] 通知模板渲染验证
- [ ] 异步发送不阻塞主流程

**前置依赖：** 数据模型层完成

---

### 5.5 层级 4: API 接口层

**目录结构：**
```
src/
├── api/
│   └── v1/
│       ├── __init__.py
│       ├── workorder_routes.py   # 工单 CRUD 路由
│       ├── approval_routes.py     # 审批操作路由
│       └── schemas/
│           ├── __init__.py
│           ├── workorder.py      # 请求/响应 Pydantic 模型
│           └── approval.py       # 审批相关模型
```

**API 端点清单：**

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/workorders` | 创建工单 |
| GET | `/api/v1/workorders/{id}` | 获取工单详情 |
| GET | `/api/v1/workorders` | 获取工单列表 |
| GET | `/api/v1/workorders/my` | 获取我的工单 |
| POST | `/api/v1/workorders/{id}/approve` | 审批工单 |
| GET | `/api/v1/workorders/{id}/history` | 获取审批历史 |

**交付物：**
- [ ] 所有 API 端点实现完成
- [ ] API 集成测试通过
- [ ] 接口文档更新

**前置依赖：** 层级 2、3 完成

---

### 5.6 层级 5: 前端交互层

**目录结构：**
```
frontend/
├── pages/
│   ├── workorder/
│   │   ├── CreatePage.tsx        # 工单创建页
│   │   ├── DetailPage.tsx        # 工单详情页
│   │   └── MyListPage.tsx        # 我的工单列表页
│   └── approver/
│       ├── PendingPage.tsx       # 审批人待办页
│       └── HistoryPage.tsx      # 审批历史页
├── components/
│   ├── WorkOrderForm.tsx         # 工单表单组件
│   ├── StatusBadge.tsx           # 状态徽章组件
│   ├── ApprovalActions.tsx       # 审批操作组件
│   └── NotificationBell.tsx      # 通知铃铛组件
```

**核心页面：**

| 页面 | 路由 | 功能 |
|------|------|------|
| 创建工单 | `/workorder/create` | 填写并提交工单 |
| 工单详情 | `/workorder/:id` | 查看工单详情和审批历史 |
| 我的工单 | `/workorder/my-list` | 查看我提交的工单列表 |
| 待审批列表 | `/approver/pending` | 审批人查看待审批工单 |
| 审批历史 | `/approver/history` | 审批人查看审批历史 |

**交付物：**
- [ ] 所有页面组件实现完成
- [ ] E2E 测试通过
- [ ] 响应式布局适配

**前置依赖：** 层级 4 API 联调完成

---

### 5.7 开发顺序矩阵

| 阶段 | 层级 | 任务 | 输出物 | 依赖 |
|------|------|------|--------|------|
| S1 | L1 | 数据库建模与 Migration | migration.sql | 需求确认 |
| S2 | L1 | 实体类实现 | models/*.py | S1 |
| S3 | L2 | 状态机引擎实现 | state_machine.py | S2 |
| S4 | L2 | 业务规则校验器 | validators.py | S3 |
| S5 | L3 | 通知处理器实现 | handlers/*.py | S2 |
| S6 | L4 | API 路由开发 | routes/*.py | S4, S5 |
| S7 | L4 | API 集成测试 | tests/integration/* | S6 |
| S8 | L5 | 前端页面开发 | pages/*.tsx | S6 |
| S9 | L5 | E2E 测试 | tests/e2e/* | S8 |

---

### 5.8 关键技术约束

| 约束项 | 要求 | 原因 |
|--------|------|------|
| 状态机实现 | 必须使用开源状态机库 | 保证状态流转正确性 |
| API 版本 | 统一使用 `/api/v1/` 前缀 | 便于版本管理 |
| 异步处理 | 通知发送必须异步执行 | 不阻塞主流程 |
| 事务保证 | 状态变更与记录同一事务 | 保证数据一致性 |
| 权限校验 | 所有操作前校验权限 | 防止越权操作 |

---

## 6. 参考资料

### 6.1 相关文档

- [系统设计文档](./design_docs/workflow_design.md)
- [API 接口文档](./api_docs/workorder_api.md)
- [数据库设计文档](./db_schema/workorder_schema.md)

### 6.2 相关文件清单

| 文件路径 | 说明 |
|----------|------|
| `backend/src/main/java/com/ams/dto/ApprovalActionDTO.java` | 审批操作 DTO |
| `backend/src/main/java/com/ams/entity/WorkOrder.java` | 工单实体 |
| `backend/src/main/java/com/ams/service/ApprovalService.java` | 审批服务 |
| `backend/src/main/java/com/ams/service/NotificationService.java` | 通知服务 |
| `frontend/src/api/approval.ts` | 前端审批 API |
| `frontend/src/services/approvalService.ts` | 前端审批服务 |
| `frontend/tests/e2e/approval.spec.ts` | E2E 测试 |

---

## 7. 附录

### 7.1 状态流转图

```
                    ┌──────────────┐
                    │    PENDING   │
                    │    (待审批)   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            │            ▼
       ┌────────────┐      │     ┌────────────┐
       │  APPROVED  │      │     │  REJECTED  │
       │   (已通过)   │      │     │   (已拒绝)   │
       └────────────┘      │     └────────────┘
                           │
                           ▼
                    (终态，不可变更)
```

### 7.2 数据模型

**WorkOrder 实体：**
```
WorkOrder {
  id: Long (PK)
  title: String (not null)
  type: Enum (PURCHASE, REPAIR, RETIREMENT, OTHER)
  content: String
  priority: Enum (LOW, NORMAL, HIGH, URGENT)
  status: Enum (PENDING, APPROVED, REJECTED)
  creator_id: Long (FK)
  created_at: DateTime
  updated_at: DateTime
  deleted: Boolean (soft delete flag)
}
```

**ApprovalRecord 实体：**
```
ApprovalRecord {
  id: Long (PK)
  work_order_id: Long (FK)
  operator_id: Long (FK)
  action: Enum (APPROVE, REJECT)
  comment: String
  created_at: DateTime
}
```

### 7.3 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2024-01-15 | - | 初始版本 |