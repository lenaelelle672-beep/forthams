# SWARM-001 工单审批流程 规格指导文档

**文档版本**: v1.0  
**任务编号**: SWARM-001  
**迭代周期**: Iteration 1  
**状态**: 已批准 (Approved)  
**生效日期**: 2024年

---

## 1. 需求与背景

### 1.1 业务场景

工单审批是企业内部流程管理的核心环节，涉及资源分配、权限管控与事务追踪。当前系统缺失统一的审批链路机制，导致：

| 问题 | 影响 |
|------|------|
| **审批流程不透明** | 无状态追踪，审批节点不可见 |
| **通知滞后** | 状态变更依赖人工传递，信息不对称 |
| **扩展性差** | 硬编码审批逻辑，新增审批类型需改动核心代码 |

### 1.2 核心需求

| 需求编号 | 描述 | 优先级 |
|---------|------|--------|
| REQ-001 | 用户可通过前端界面提交工单审批申请 | **P0** |
| REQ-002 | 后端通过状态机驱动审批链路，支持状态流转 | **P0** |
| REQ-003 | 审批状态变更时自动触发通知机制 | **P0** |
| REQ-004 | 审批记录持久化，支持历史追溯 | P1 |

---

## 2. 当前 Phase 对应实施目标

> **说明**：本规格文档对应 **Phase 1: 核心审批链路构建** 阶段。后续迭代将扩展多级审批、条件分支等高级特性。

### 2.1 Phase 1 实施范围

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phase 1 边界                              │
├─────────────────────────────────────────────────────────────────┤
│  ✅ 单级直线审批（提交 → 审批 → 通过/拒绝）                       │
│  ✅ 状态机核心流转逻辑                                           │
│  ✅ 基础通知触发（邮件/站内信）                                   │
│  ✅ 审批记录持久化                                               │
├─────────────────────────────────────────────────────────────────┤
│  ❌ 多级审批（Phase 2）                                          │
│  ❌ 条件分支审批（Phase 2）                                      │
│  ❌ 委托/转交审批（Phase 3）                                      │
│  ❌ 移动端专属流程（Phase 3）                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 状态机定义

```
                    ┌──────────┐
                    │ SUBMITTED│
                    └────┬─────┘
                         │ submit
                         ▼
                   ┌──────────┐
            ┌──────│ PENDING  │──────┐
            │      └──────────┘      │
            │ approve           reject│
            ▼                        ▼
     ┌──────────┐            ┌──────────┐
     │ APPROVED │            │ REJECTED │
     └──────────┘            └──────────┘

状态枚举: [SUBMITTED, PENDING, APPROVED, REJECTED]
允许转换: SUBMITTED → PENDING, PENDING → APPROVED, PENDING → REJECTED
```

### 2.3 关键实体关系

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   WorkOrder     │       │ ApprovalStage   │       │NotificationEvent│
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id: UUID        │──1:N──│ workorder_id    │       │ id: UUID        │
│ title: str      │       │ stage_order: int│       │ event_type: str │
│ content: str    │       │ status: str     │◄─hook─│ recipient_id    │
│ status: str     │       │ approver_id     │       │ payload: dict   │
│ creator_id      │       │ comment: str    │       │ created_at      │
│ created_at      │       └─────────────────┘       └─────────────────┘
│ updated_at      │
└─────────────────┘
```

---

## 3. 边界约束

### 3.1 技术约束

| 约束维度 | 具体约束 | 约束来源 |
|---------|---------|---------|
| **技术栈** | 后端基于 Python/FastAPI 实现 | 技术栈统一 |
| **技术栈** | 状态机使用 `transitions` 库实现 | 技术选型 |
| **技术栈** | 通知服务基于异步消息队列（Redis Queue） | 性能要求 |
| **数据约束** | 工单表主键使用 UUID v4 | 分布式兼容性 |
| **数据约束** | 审批记录不可物理删除，仅标记无效 | 审计合规 |
| **性能约束** | 单次审批状态变更响应时间 ≤ 500ms | SLA 要求 |
| **安全约束** | 审批操作需校验操作用户与审批人身份一致性 | 安全基线 |
| **接口约束** | 统一响应格式使用 JSON，结构为 `{code, data, message}` | 接口规范 |

### 3.2 禁止事项

- **禁止**在前端硬编码审批状态值，应从后端获取配置
- **禁止**绕过状态机直接修改工单状态
- **禁止**在通知回调中执行长时间阻塞操作
- **禁止**在 Phase 1 实现多级审批链

---

## 4. 验收测试基准 (ATB)

### 4.1 测试框架选型

| 测试层级 | 框架工具 | 说明 |
|---------|---------|------|
| 单元测试 | `pytest` | 状态机逻辑、服务层 |
| 集成测试 | `pytest` + `httpx` | API 接口测试 |
| E2E 测试 | `Playwright` | 前端用户操作流程 |

---

### ATB-001: 工单提交功能

**功能描述**：用户填写工单信息后，系统创建工单并进入 PENDING 状态

**物理测试用例**：

```python
# pytest 测试文件: tests/api/test_workorder_submission.py

def test_submit_workorder_success():
    """
    ATB-001.1 - 正常提交工单
    预期: 返回 201，状态为 PENDING，message="工单提交成功"
    """
    payload = {
        "title": "服务器扩容申请",
        "content": "因业务增长需扩容服务器",
        "priority": "high"
    }
    response = client.post("/api/v1/workorders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["status"] == "PENDING"

def test_submit_workorder_missing_required_field():
    """
    ATB-001.2 - 缺少必填字段
    预期: 返回 422，data 为 None，message 包含校验错误信息
    """
    payload = {"title": "测试工单"}  # 缺少 content
    response = client.post("/api/v1/workorders", json=payload)
    assert response.status_code == 422
    assert response.json()["data"] is None
```

**Playwright E2E 场景**：

```typescript
// playwright/tests/workorder_flow.spec.ts

test('ATB-001-E2E: 用户完整提交工单流程', async ({ page }) => {
  await page.goto('/workorder/create');
  await page.fill('[data-testid="title-input"]', '服务器扩容申请');
  await page.fill('[data-testid="content-input"]', '详细描述...');
  await page.selectOption('[data-testid="priority-select"]', 'high');
  await page.click('[data-testid="submit-btn"]');
  
  // 验证页面跳转与成功提示
  await expect(page.locator('.toast-success')).toContainText('提交成功');
  await expect(page).toHaveURL(/\/workorder\/\w+/);
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('待审批');
});
```

---

### ATB-002: 状态机流转功能

**功能描述**：审批人对工单执行 approve/reject 操作，状态机驱动状态变更

**物理测试用例**：

```python
# pytest 测试文件: tests/unit/test_state_machine.py

def test_approve_transition_valid(initialized_workorder):
    """
    ATB-002.1 - 有效审批通过
    初始状态: PENDING
    操作: approve
    预期状态: APPROVED
    """
    machine = WorkOrderStateMachine(initialized_workorder)
    machine.approve(approver_id="user_approver_001")
    assert initialized_workorder.status == "APPROVED"

def test_reject_transition_valid(initialized_workorder):
    """
    ATB-002.2 - 有效审批拒绝
    初始状态: PENDING
    操作: reject
    预期状态: REJECTED
    """
    machine = WorkOrderStateMachine(initialized_workorder)
    machine.reject(approver_id="user_approver_001", reason="资源不足")
    assert initialized_workorder.status == "REJECTED"

def test_invalid_transition_approved_to_pending():
    """
    ATB-002.3 - 非法状态转换检测
    初始状态: APPROVED
    操作: 尝试转为 PENDING
    预期: 抛出 StateTransitionError
    """
    workorder = create_approved_workorder()
    machine = WorkOrderStateMachine(workorder)
    with pytest.raises(StateTransitionError) as exc_info:
        machine.submit()
    assert "Invalid transition" in str(exc_info.value)

def test_duplicate_approval_rejected(approved_workorder):
    """
    ATB-002.4 - 重复审批检测
    初始状态: APPROVED
    操作: 再次执行 approve
    预期: 抛出 StateTransitionError
    """
    machine = WorkOrderStateMachine(approved_workorder)
    with pytest.raises(StateTransitionError):
        machine.approve(approver_id="user_approver_002")
```

---

### ATB-003: 通知触发功能

**功能描述**：审批状态变更时，自动触发通知并投递至消息队列

**物理测试用例**：

```python
# pytest 测试文件: tests/unit/test_notification_trigger.py

@pytest.fixture
def mock_queue(mocker):
    """Mock Redis Queue"""
    return mocker.patch('app.services.notification.queue')

def test_notify_on_approval(initialized_workorder, mock_queue):
    """
    ATB-003.1 - 审批通过触发通知
    预期: 投递消息至队列，event_type="workorder.approved"
    """
    machine = WorkOrderStateMachine(initialized_workorder)
    machine.approve(approver_id="approver_001")
    
    mock_queue.enqueue.assert_called_once()
    call_args = mock_queue.enqueue.call_args
    assert call_args[0][0] == "send_notification"
    assert "workorder.approved" in call_args[1]["event_type"]

def test_notify_on_rejection(initialized_workorder, mock_queue):
    """
    ATB-003.2 - 审批拒绝触发通知
    预期: 投递消息至队列，event_type="workorder.rejected"，包含拒绝原因
    """
    machine = WorkOrderStateMachine(initialized_workorder)
    machine.reject(approver_id="approver_001", reason="材料不全")
    
    mock_queue.enqueue.assert_called_once()
    payload = mock_queue.enqueue.call_args[1]
    assert payload["event_type"] == "workorder.rejected"
    assert payload["data"]["reject_reason"] == "材料不全"
```

**异步通知消费者测试**：

```python
# pytest 测试文件: tests/integration/test_notification_consumer.py

def test_notification_consumer_processes_approval(app):
    """
    ATB-003.3 - 通知消费者处理审批通过消息
    预期: 发送邮件至工单创建者邮箱
    """
    with app.container.mail_provider.mock() as mock_mail:
        job = MockJob(payload={
            "event_type": "workorder.approved",
            "workorder_id": "uuid_test",
            "recipient_email": "creator@example.com"
        })
        
        process_notification_job(job)
        
        mock_mail.send.assert_called_once()
        assert "审批通过" in mock_mail.send.call_args[0][0].subject
```

---

### ATB-004: 审批记录持久化

**功能描述**：每次状态变更生成不可变的审批记录

**物理测试用例**：

```python
# pytest 测试文件: tests/unit/test_approval_record.py

def test_record_created_on_state_change(initialized_workorder):
    """
    ATB-004.1 - 状态变更时创建记录
    预期: 数据库新增一条 approval_records 记录
    """
    initial_count = ApprovalRecord.query.count()
    machine = WorkOrderStateMachine(initialized_workorder)
    machine.approve(approver_id="approver_001")
    
    assert ApprovalRecord.query.count() == initial_count + 1
    record = ApprovalRecord.query.filter_by(
        workorder_id=initialized_workorder.id
    ).first()
    assert record.action == "APPROVE"
    assert record.approver_id == "approver_001"

def test_record_immutable(approved_workorder):
    """
    ATB-004.2 - 审批记录不可修改
    预期: 更新操作抛出 PermissionError
    """
    record = ApprovalRecord.query.filter_by(
        workorder_id=approved_workorder.id
    ).first()
    with pytest.raises(PermissionError):
        record.action = "REJECT"
        db.session.commit()
```

---

### ATB-005: API 接口集成

**Playwright E2E 场景**：

```typescript
// playwright/tests/approver_flow.spec.ts

test('ATB-005-E2E: 审批人处理工单流程', async ({ page, loggedInAs }) => {
  // 以审批人身份登录
  await loggedInAs('approver');
  await page.goto('/approver/pending');
  
  // 进入工单详情
  await page.click('[data-testid="workorder-item"]:first-child');
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('待审批');
  
  // 执行审批通过
  await page.fill('[data-testid="comment-input"]', '同意扩容需求');
  await page.click('[data-testid="approve-btn"]');
  
  // 验证状态更新
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已通过');
  await expect(page.locator('[data-testid="history-item"]:last-child'))
    .toContainText('审批通过');
  
  // 验证发起人收到通知（检查模拟邮件）
  const emails = await getSentEmailsTo('creator@example.com');
  expect(emails).toContainEqual(
    expect.objectContaining({ subject: expect.stringContaining('审批通过') })
  );
});
```

---

## 5. 开发切入层级序列

### 5.1 开发顺序与依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层 (优先级最高)                                │
├─────────────────────────────────────────────────────────────────┤
│  任务: 定义 WorkOrder、ApprovalRecord 数据表结构                 │
│  文件: backend/models/workorder.py                              │
│  依赖: 无                                                       │
│  交付物:                                                        │
│    - WorkOrder Model (id, title, content, status, creator_id)  │
│    - ApprovalRecord Model (id, workorder_id, action, approver)  │
│    - Alembic 迁移脚本                                           │
│  测试: ATB-004 相关                                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 状态机核心层                                          │
├─────────────────────────────────────────────────────────────────┤
│  任务: 实现状态机流转逻辑与事件钩子                              │
│  文件: backend/services/workorder_service.py                    │
│  依赖: Layer 0                                                  │
│  交付物:                                                        │
│    - WorkOrderStateMachine 类                                   │
│    - 状态转换规则定义                                           │
│    - pre_submit / post_approve 等钩子方法                       │
│  测试: ATB-002 全部用例                                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: 业务服务层                                            │
├─────────────────────────────────────────────────────────────────┤
│  任务: 工单服务 + 审批服务                                      │
│  文件: backend/services/workorder_service.py                   │
│  依赖: Layer 0, Layer 1                                         │
│  交付物:                                                        │
│    - WorkOrderService.create()                                 │
│    - ApprovalService.process(workorder_id, action, approver)  │
│  测试: ATB-001.1, ATB-002.1, ATB-002.2                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: API 接口层                                            │
├─────────────────────────────────────────────────────────────────┤
│  任务: RESTful 接口实现                                         │
│  文件: backend/api/v1/workorders.py                            │
│  依赖: Layer 2                                                   │
│  交付物:                                                        │
│    - POST /api/v1/workorders (创建工单)                         │
│    - POST /api/v1/workorders/{id}/approve                      │
│    - POST /api/v1/workorders/{id}/reject                       │
│    - GET /api/v1/workorders/{id}/records                       │
│  测试: ATB-001.1, ATB-001.2, ATB-005-E2E 部分                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 通知服务层                                            │
├─────────────────────────────────────────────────────────────────┤
│  任务: 异步通知机制                                             │
│  文件: backend/services/notification_service.py                │
│  依赖: Layer 1 (状态机钩子)                                      │
│  交付物:                                                        │
│    - NotificationEvent 模型                                     │
│    - Redis Queue 任务定义                                      │
│    - 邮件/站内信发送 worker                                     │
│  测试: ATB-003 全部用例                                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 前端界面层                                            │
├─────────────────────────────────────────────────────────────────┤
│  任务: 前端工单提交与审批交互                                   │
│  文件: frontend/src/services/workorderService.ts                │
│  依赖: Layer 3 (API就绪)                                        │
│  交付物:                                                        │
│    - 工单创建表单                                               │
│    - 审批操作面板                                               │
│    - 审批历史展示                                               │
│  测试: ATB-001-E2E, ATB-005-E2E                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键里程碑

| 里程碑 | 完成标准 | 对应测试覆盖 |
|-------|---------|-------------|
| M1: 数据层就绪 | 迁移脚本执行成功，模型可 CRUD | `pytest tests/unit/test_models.py` |
| M2: 状态机可用 | 状态转换符合规范，异常拦截生效 | `pytest tests/unit/test_state_machine.py` |
| M3: API 就绪 | 接口响应格式符合规范，状态码正确 | `pytest tests/api/` |
| M4: 通知可达 | 状态变更触发队列消息，消费者正确投递 | `pytest tests/unit/test_notification_trigger.py` |
| M5: E2E 通过 | Playwright 全部场景通过 | `playwright test` |

---

## 6. 前端服务层实现要求

### 6.1 workorderService.ts 接口规范

根据 Phase 1 规格，前端 `workorderService.ts` 必须实现以下接口：

| 方法 | 描述 | ATB 关联 |
|------|------|----------|
| `createWorkOrder(data)` | 提交工单审批申请 | ATB-001 |
| `approveWorkOrder(id, comment)` | 审批通过 | ATB-002, ATB-005 |
| `rejectWorkOrder(id, reason)` | 审批拒绝 | ATB-002 |
| `getWorkOrderHistory(id)` | 获取审批历史 | ATB-004 |
| `getPendingWorkOrders()` | 获取待审批列表 | ATB-005 |

---

## 7. 附录

### 7.1 术语表

| 术语 | 定义 |
|-----|------|
| 状态机 | 维护对象状态及状态转换规则的有限状态自动机 |
| PENDING | 工单待审批状态 |
| 审批记录 | ApprovalRecord，不可变的状态变更历史条目 |

### 7.2 参考文档

- 状态机实现参考: `transitions` 库官方文档
- API 规范参考: `docs/api_contract.md`
- 前端组件规范参考: `frontend/docs/components.md`

---

**文档维护**：每次迭代结束后更新版本号与状态