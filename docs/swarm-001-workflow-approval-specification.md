# SWARM-001 工单审批流程 - 规格指导文档

## 需求与背景

### 业务场景

工单审批流程是组织内部处理各类申请（请假、报销、采购、设备领用等）的核心业务流程。本系统需支持用户在线提交工单、实时追踪审批进度、自动化状态流转以及及时的通知推送。

### 核心痛点

- 传统纸质审批流程冗长，状态不透明
- 审批人无法及时获知待审批事项
- 缺乏统一的状态管理和追溯能力

### 目标用户

| 角色 | 权限范围 |
|------|----------|
| 申请人 | 提交工单、查看自己提交的工单状态 |
| 审批人 | 查看待审批列表、审批/拒绝工单 |
| 管理员 | 配置审批流程、查看全部工单数据 |

---

## 当前 Phase 对应实施目标

### Phase 1: 核心审批链路（当前迭代）

| 功能模块 | 具体目标 |
|----------|----------|
| 工单创建 | 支持用户填写工单表单并提交 |
| 状态机流转 | 实现 Pending → Approved/Rejected 基础流转 |
| 审批通知 | 审批完成后触发站内消息通知 |
| 状态查询 | 用户可查看本人工单的当前状态 |

### Phase 2: 增强功能（后续迭代）

- 多级审批链配置
- 审批人委托机制
- 工单催办与撤回

### Phase 3: 高级特性（远期规划）

- 审批时效 SLA 监控
- 数据统计与报表
- 移动端适配

---

## 边界约束

### 技术边界

| 约束项 | 限制条件 |
|--------|----------|
| 单次工单附件 | ≤ 5 个文件，单文件 ≤ 10MB |
| 工单字段上限 | 自定义字段 ≤ 20 个 |
| 审批链路深度 | Phase 1 仅支持单级审批 |
| 并发审批 | 同一工单同时仅允许 1 人操作 |
| 通知渠道 | Phase 1 仅支持站内通知 |

### 数据边界

- 工单数据保留周期：永久（软删除后保留 90 天）
- 审批历史记录不可篡改
- 状态变更需记录操作人、时间戳、变更原因

### 安全边界

- 用户仅能查看/操作自己发起或有审批权限的工单
- 敏感字段（如金额）需脱敏展示
- 所有 API 需鉴权访问

---

## 验收测试基准 (ATB)

### 单元测试 (pytest)

#### 1. 状态机流转测试

```python
# tests/unit/test_workflow_state_machine.py

def test_pending_to_approved_transition():
    """验收：状态为 PENDING 时可流转至 APPROVED"""
    workflow = WorkOrderWorkflow()
    result = workflow.transition("PENDING", "APPROVE", role="approver")
    assert result.state == "APPROVED"
    assert result.timestamp is not None

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
```

#### 2. 权限校验测试

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
```

#### 3. 通知机制测试

```python
# tests/unit/test_notification.py

def test_notification_sent_on_approval():
    """验收：审批完成后生成站内通知"""
    with patch("services.NotificationService.send") as mock_send:
        handler = ApprovalHandler()
        handler.process("order_123", "APPROVED")
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert "order_123" in call_args[1].get("content", "")
```

---

### 集成测试 (pytest + pytest-asyncio)

#### 4. 端到端工单流程测试

```python
# tests/integration/test_workorder_e2e.py

@pytest.mark.asyncio
async def test_full_approval_flow():
    """验收：完整审批流程 - 创建→审批→通知→状态更新"""
    # 1. 创建工单
    response = await client.post("/api/v1/workorders", json={
        "title": "采购申请",
        "type": "PURCHASE",
        "content": "测试内容"
    })
    assert response.status_code == 201
    order_id = response.json()["id"]
    
    # 2. 审批人审批
    approve_response = await client.post(
        f"/api/v1/workorders/{order_id}/approve",
        json={"action": "APPROVE", "comment": "同意"}
    )
    assert approve_response.status_code == 200
    
    # 3. 验证状态变更
    status_response = await client.get(f"/api/v1/workorders/{order_id}")
    assert status_response.json()["state"] == "APPROVED"
    
    # 4. 验证通知已发送
    notification = await db.notifications.find_one({"order_id": order_id})
    assert notification is not None
    assert notification["type"] == "APPROVAL_RESULT"
```

#### 5. 并发操作冲突测试

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
```

---

### E2E 测试 (Playwright)

#### 6. 用户提交流程测试

```python
# tests/e2e/test_user_submission.py

def test_user_can_submit_and_track_order(page: Page):
    """验收：用户可在前端提交工单并追踪状态"""
    # 1. 登录
    page.goto("/login")
    page.fill("#username", "test_user")
    page.fill("#password", "password")
    page.click("button[type='submit']")
    
    # 2. 提交工单
    page.goto("/workorder/create")
    page.fill("#title", "测试采购申请")
    page.select_option("#type", "PURCHASE")
    page.fill("#content", "测试描述内容")
    page.click("button[type='submit']")
    
    # 3. 验证提交成功并跳转详情页
    assert "/workorder/" in page.url
    assert page.locator(".status-badge").text_content() == "待审批"
    
    # 4. 查看工单列表
    page.goto("/workorder/my-list")
    assert page.locator("table .workorder-title").first.inner_text() == "测试采购申请"
```

#### 7. 审批人操作测试

```python
# tests/e2e/test_approver_workflow.py

def test_approver_can_approve_order(page: Page):
    """验收：审批人可查看待审批工单并执行审批"""
    # 1. 审批人登录
    login_as(page, "approver")
    
    # 2. 进入待审批列表
    page.goto("/approver/pending")
    assert page.locator(".pending-count").text_content() == "1"
    
    # 3. 点击审批
    page.click(".order-item:first-child .approve-btn")
    page.fill("textarea[name='comment']", "同意申请")
    page.click("#confirm-approve")
    
    # 4. 验证状态更新
    assert page.locator(".toast-message").text_content() == "审批成功"
    assert page.locator(".order-status").text_content() == "已通过"
```

---

### 测试覆盖率要求

| 测试类型 | 覆盖率门槛 |
|----------|------------|
| 状态机核心逻辑 | 100% 分支覆盖 |
| 权限校验逻辑 | 100% 分支覆盖 |
| API 端点 | 请求/响应格式 100% 覆盖 |
| E2E 核心流程 | 主路径 100% 覆盖 |

---

## 开发切入层级序列

### 层级 1: 数据模型层

```
src/
├── models/
│   ├── workorder.py          # 工单实体定义
│   ├── workflow_state.py     # 状态枚举与定义
│   ├── approval_record.py    # 审批记录实体
│   └── notification.py       # 通知实体
```

**交付物**：完成 ER 图更新，数据库 Migration 脚本

**前置依赖**：需求评审通过

---

### 层级 2: 状态机与业务规则层

```
src/
├── domain/
│   ├── workflow/
│   │   ├── state_machine.py  # 状态机核心引擎
│   │   ├── transitions.py    # 状态流转规则定义
│   │   └── validators.py     # 业务规则校验器
│   └── services/
│       ├── workorder_service.py   # 工单领域服务
│       └── approval_service.py    # 审批领域服务
```

**交付物**：
- 状态机可独立运行测试
- 业务规则单元测试通过

**前置依赖**：数据模型层完成

---

### 层级 3: 通知机制层

```
src/
├── notifications/
│   ├── handlers/
│   │   └── approval_handler.py   # 审批结果通知处理器
│   ├── channels/
│   │   └── in_app_channel.py     # 站内通知渠道实现
│   └── templates/
│       └── approval_result.html  # 通知模板
```

**交付物**：
- 通知发送单元测试通过
- 通知模板渲染验证

**前置依赖**：数据模型层完成

---

### 层级 4: API 接口层

```
src/
├── api/
│   └── v1/
│       ├── workorder_routes.py   # 工单 CRUD 路由
│       ├── approval_routes.py    # 审批操作路由
│       └── schemas/
│           ├── workorder.py      # 请求/响应 Pydantic 模型
│           └── approval.py
```

**交付物**：
- 所有 API 端点实现完成
- API 集成测试通过

**前置依赖**：层级 2、3 完成

---

### 层级 5: 前端交互层

```
src/
├── frontend/
│   ├── pages/
│   │   ├── workorder/
│   │   │   ├── CreatePage.tsx    # 工单创建页
│   │   │   ├── DetailPage.tsx    # 工单详情页
│   │   │   └── MyListPage.tsx    # 我的工单列表页
│   │   └── approver/
│   │       └── PendingPage.tsx   # 审批人待办页
│   └── components/
│       ├── WorkOrderForm.tsx
│       ├── StatusBadge.tsx
│       └── ApprovalActions.tsx
```

**交付物**：
- 所有页面组件实现完成
- E2E 测试通过

**前置依赖**：层级 4 API 联调完成

---

### 开发顺序矩阵

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

### 关键技术约束

1. **状态机实现**：必须使用开源状态机库（如 `transitions` 或 `python-statemachine`），禁止手写状态流转逻辑
2. **API 版本**：所有接口统一使用 `/api/v1/` 前缀
3. **异步处理**：通知发送必须异步执行，不阻塞主流程
4. **事务保证**：状态变更与审批记录必须在同一事务内完成