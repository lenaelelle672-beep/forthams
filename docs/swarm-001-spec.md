# SWARM-001 工单审批流程规格指导文档

**文档版本**: v1.0  
**任务编号**: SWARM-001  
**迭代周期**: Iteration 1  
**状态**: 正式发布  
**最后更新**: 2024

---

## 1. 需求与背景

### 1.1 业务场景

工单审批是企业资产管理系统的核心流程，涉及资源分配、权限管控与事务追踪。当前系统缺失统一的审批链路机制，导致以下问题：

| 问题类型 | 具体表现 | 影响程度 |
|---------|---------|---------|
| 流程不透明 | 无状态追踪，审批节点不可见 | 高 |
| 通知滞后 | 状态变更依赖人工传递，信息不对称 | 高 |
| 扩展性差 | 硬编码审批逻辑，新增审批类型成本高 | 中 |

### 1.2 核心需求

| 需求编号 | 描述 | 优先级 | 来源 |
|---------|------|--------|------|
| REQ-001 | 用户可通过前端界面提交工单审批申请 | P0 | 业务方 |
| REQ-002 | 后端通过状态机驱动审批链路，支持状态流转 | P0 | 技术架构 |
| REQ-003 | 审批状态变更时自动触发通知机制 | P0 | 业务方 |
| REQ-004 | 审批记录持久化，支持历史追溯 | P1 | 合规要求 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 划分说明

> **Phase 定义原则**：本规格采用 MVP（最小可行产品）策略，Phase 1 聚焦核心链路验证，后续迭代逐步扩展高级特性。

### 2.2 Phase 1: 核心审批链路构建

**实施范围边界**：

```
┌─────────────────────────────────────────────────────────────┐
│                      Phase 1 包含范围                         │
├─────────────────────────────────────────────────────────────┤
│  ✓ 单级直线审批（提交 → 审批 → 通过/拒绝）                    │
│  ✓ 状态机核心流转逻辑                                         │
│  ✓ 基础通知触发（邮件/站内信）                                │
│  ✓ 审批记录持久化                                             │
├─────────────────────────────────────────────────────────────┤
│                      Phase 1 不包含                          │
├─────────────────────────────────────────────────────────────┤
│  ✗ 多级审批（→ Phase 2）                                     │
│  ✗ 条件分支审批（→ Phase 2）                                 │
│  ✗ 委托/转交审批（→ Phase 3）                                 │
│  ✗ 移动端专属流程（→ Phase 3）                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 状态机定义

**状态枚举**：

```python
class WorkOrderStatus(Enum):
    """工单状态枚举"""
    SUBMITTED = "SUBMITTED"   # 已提交，待审核
    PENDING = "PENDING"       # 审核中
    APPROVED = "APPROVED"     # 已通过
    REJECTED = "REJECTED"     # 已拒绝
```

**状态转换图**：

```
                    ┌──────────┐
                    │ SUBMITTED│
                    └────┬─────┘
                         │ submit()
                         ▼
                   ┌──────────┐
            ┌──────│ PENDING  │──────┐
            │      └──────────┘      │
            │ approve()         reject()
            ▼                        ▼
     ┌──────────┐            ┌──────────┐
     │ APPROVED │            │ REJECTED │
     └──────────┘            └──────────┘
```

**允许转换规则**：

| 当前状态 | 允许操作 | 目标状态 | 触发条件 |
|---------|---------|---------|---------|
| SUBMITTED | submit | PENDING | 用户提交工单 |
| PENDING | approve | APPROVED | 审批人通过 |
| PENDING | reject | REJECTED | 审批人拒绝 |

**禁止转换**（需抛出 `StateTransitionError`）：

- APPROVED → 任何状态
- REJECTED → 任何状态
- PENDING → SUBMITTED
- SUBMITTED → APPROVED（跳过审核）

---

## 3. 边界约束

### 3.1 技术约束

| 约束维度 | 具体约束 | 约束来源 |
|---------|---------|---------|
| 语言框架 | 后端基于 Python/FastAPI 实现 | 技术栈统一 |
| 状态机 | 使用 `transitions` 库实现 | 技术选型 |
| 通知队列 | 基于 Redis Queue 异步消息 | 性能要求 |
| 主键策略 | 工单表主键使用 UUID v4 | 分布式兼容性 |
| 响应格式 | 统一 JSON 结构 `{code, data, message}` | 接口规范 |

### 3.2 数据约束

| 约束类型 | 约束内容 |
|---------|---------|
| 不可删除 | 审批记录不可物理删除，仅标记 `is_void=true` |
| 不可修改 | 已通过的审批记录内容不可变更 |
| 幂等性 | 重复提交相同工单应返回已有记录（非新建） |

### 3.3 性能约束

| 指标 | 阈值 | 说明 |
|-----|------|------|
| 状态变更响应时间 | ≤ 500ms | 单次 approve/reject 操作 |
| 通知投递延迟 | ≤ 2s | 消息入队到消费者处理 |
| 并发审批 | ≥ 100 TPS | 单工单并发审批请求处理 |

### 3.4 安全约束

| 约束项 | 描述 |
|-------|------|
| 身份校验 | 审批操作必须验证操作用户与审批人身份一致性 |
| 权限校验 | 非审批人角色不可执行 approve/reject |
| 审计日志 | 所有状态变更需记录操作人、时间、IP |

### 3.5 禁止事项

- **禁止**在前端硬编码审批状态值，应从后端获取配置
- **禁止**绕过状态机直接修改工单状态字段
- **禁止**在通知回调中执行长时间阻塞操作
- **禁止**在 Phase 1 实现多级审批链

---

## 4. 验收测试基准 (ATB)

### 4.1 测试策略

| 测试层级 | 框架工具 | 覆盖范围 |
|---------|---------|---------|
| 单元测试 | `pytest` | 状态机逻辑、服务层 |
| 集成测试 | `pytest` + `httpx` | API 接口、数据库交互 |
| E2E 测试 | `Playwright` | 前端用户操作流程 |

### 4.2 ATB-001: 工单提交功能

**功能描述**：用户填写工单信息后，系统创建工单并进入 PENDING 状态

**前置条件**：
- 用户已登录系统
- 用户具有工单提交权限

**物理测试用例**：

```python
# 文件: tests/api/test_workorder_submission.py

class TestWorkOrderSubmission:
    """ATB-001 工单提交功能测试"""
    
    def test_submit_workorder_success(self, client, auth_headers):
        """
        ATB-001.1 - 正常提交工单
        
        预期:
        - HTTP 201 Created
        - code == 0
        - data.status == "PENDING"
        - message 包含"提交成功"
        """
        payload = {
            "title": "服务器扩容申请",
            "content": "因业务增长需扩容服务器",
            "priority": "high",
            "category": "resource_request"
        }
        response = client.post(
            "/api/v1/workorders",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == 0
        assert data["data"]["status"] == "PENDING"
        assert "id" in data["data"]

    def test_submit_workorder_missing_required_field(self, client, auth_headers):
        """
        ATB-001.2 - 缺少必填字段
        
        预期:
        - HTTP 422 Unprocessable Entity
        - data is None
        - message 包含字段校验错误
        """
        payload = {"title": "测试工单"}  # 缺少 content
        
        response = client.post(
            "/api/v1/workorders",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        assert response.json()["data"] is None

    def test_submit_workorder_duplicate(self, client, auth_headers, existing_workorder):
        """
        ATB-001.3 - 重复提交工单（幂等性）
        
        预期:
        - HTTP 200 OK（不重复创建）
        - 返回已有工单记录
        """
        payload = {
            "title": existing_workorder.title,
            "content": existing_workorder.content,
            "priority": "medium"
        }
        response = client.post(
            "/api/v1/workorders",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["data"]["id"] == existing_workorder.id
```

**E2E 测试场景**：

```typescript
// 文件: frontend/tests/e2e/approval.spec.ts

test('ATB-001-E2E: 用户完整提交工单流程', async ({ page }) => {
  // 1. 导航至工单创建页面
  await page.goto('/workorder/create');
  
  // 2. 填写工单表单
  await page.fill('[data-testid="title-input"]', '服务器扩容申请');
  await page.fill('[data-testid="content-input"]', '详细描述业务增长需求...');
  await page.selectOption('[data-testid="priority-select"]', 'high');
  
  // 3. 提交工单
  await page.click('[data-testid="submit-btn"]');
  
  // 4. 验证成功提示
  await expect(page.locator('.toast-success')).toContainText('提交成功');
  
  // 5. 验证页面跳转至详情页
  await expect(page).toHaveURL(/\/workorder\/\w+/);
  
  // 6. 验证状态显示
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('待审批');
});
```

---

### 4.3 ATB-002: 状态机流转功能

**功能描述**：审批人对工单执行 approve/reject 操作，状态机驱动状态变更

**前置条件**：
- 存在状态为 PENDING 的工单
- 当前用户为该工单的指定审批人

**物理测试用例**：

```python
# 文件: tests/unit/test_state_machine.py

class TestWorkOrderStateMachine:
    """ATB-002 状态机流转测试"""
    
    def test_approve_transition_valid(self, initialized_workorder):
        """
        ATB-002.1 - 有效审批通过
        
        初始状态: PENDING
        操作: approve(approver_id="approver_001")
        预期:
        - 状态变为 APPROVED
        - 触发 post_approve 钩子
        """
        machine = WorkOrderStateMachine(initialized_workorder)
        machine.approve(approver_id="approver_001")
        
        assert initialized_workorder.status == "APPROVED"
        assert initialized_workorder.approved_at is not None

    def test_reject_transition_valid(self, initialized_workorder):
        """
        ATB-002.2 - 有效审批拒绝
        
        初始状态: PENDING
        操作: reject(approver_id="approver_001", reason="资源不足")
        预期:
        - 状态变为 REJECTED
        - 拒绝原因被记录
        """
        machine = WorkOrderStateMachine(initialized_workorder)
        machine.reject(
            approver_id="approver_001",
            reason="资源不足"
        )
        
        assert initialized_workorder.status == "REJECTED"
        assert initialized_workorder.reject_reason == "资源不足"

    def test_invalid_transition_approved_to_pending(self):
        """
        ATB-002.3 - 非法状态转换检测
        
        初始状态: APPROVED
        操作: 尝试调用 submit()
        预期: 抛出 StateTransitionError
        """
        workorder = create_approved_workorder()
        machine = WorkOrderStateMachine(workorder)
        
        with pytest.raises(StateTransitionError) as exc_info:
            machine.submit()
        
        assert "Invalid transition" in str(exc_info.value)

    def test_duplicate_approval_rejected(self, approved_workorder):
        """
        ATB-002.4 - 重复审批检测
        
        初始状态: APPROVED
        操作: 再次执行 approve
        预期: 抛出 StateTransitionError
        """
        machine = WorkOrderStateMachine(approved_workorder)
        
        with pytest.raises(StateTransitionError):
            machine.approve(approver_id="user_approver_002")

    def test_unauthorized_approver_rejected(self, initialized_workorder):
        """
        ATB-002.5 - 非授权审批人检测
        
        初始状态: PENDING
        操作: 非指定审批人执行 approve
        预期: 抛出 PermissionError
        """
        machine = WorkOrderStateMachine(initialized_workorder)
        
        with pytest.raises(PermissionError):
            machine.approve(approver_id="unauthorized_user")
```

---

### 4.4 ATB-003: 通知触发功能

**功能描述**：审批状态变更时，自动触发通知并投递至消息队列

**前置条件**：
- Redis Queue 服务可用
- 通知消费者服务已启动

**物理测试用例**：

```python
# 文件: tests/unit/test_notification_trigger.py

class TestNotificationTrigger:
    """ATB-003 通知触发测试"""
    
    def test_notify_on_approval(self, initialized_workorder, mock_queue):
        """
        ATB-003.1 - 审批通过触发通知
        
        预期:
        - 调用 queue.enqueue() 一次
        - event_type == "workorder.approved"
        - payload 包含工单ID和审批人信息
        """
        machine = WorkOrderStateMachine(initialized_workorder)
        machine.approve(approver_id="approver_001")
        
        mock_queue.enqueue.assert_called_once()
        call_args = mock_queue.enqueue.call_args
        
        assert call_args[0][0] == "send_notification"
        payload = call_args[1]
        assert payload["event_type"] == "workorder.approved"
        assert payload["workorder_id"] == initialized_workorder.id

    def test_notify_on_rejection(self, initialized_workorder, mock_queue):
        """
        ATB-003.2 - 审批拒绝触发通知
        
        预期:
        - event_type == "workorder.rejected"
        - payload 包含拒绝原因
        """
        machine = WorkOrderStateMachine(initialized_workorder)
        machine.reject(
            approver_id="approver_001",
            reason="材料不全"
        )
        
        payload = mock_queue.enqueue.call_args[1]
        assert payload["event_type"] == "workorder.rejected"
        assert payload["data"]["reject_reason"] == "材料不全"

    def test_notification_consumer_processes_approval(self, app):
        """
        ATB-003.3 - 通知消费者处理审批通过消息
        
        预期:
        - 发送邮件至工单创建者邮箱
        - 邮件主题包含"审批通过"
        """
        with app.container.mail_provider.mock() as mock_mail:
            job = MockJob(payload={
                "event_type": "workorder.approved",
                "workorder_id": "uuid_test",
                "recipient_email": "creator@example.com",
                "workorder_title": "服务器扩容申请"
            })
            
            process_notification_job(job)
            
            mock_mail.send.assert_called_once()
            email = mock_mail.send.call_args[0][0]
            assert "审批通过" in email.subject
```

---

### 4.5 ATB-004: 审批记录持久化

**功能描述**：每次状态变更生成不可变的审批记录

**数据模型**：

```python
class ApprovalRecord(BaseModel):
    """审批记录模型"""
    id: str                           # UUID v4
    workorder_id: str                 # 关联工单ID
    action: Literal["SUBMIT", "APPROVE", "REJECT"]
    actor_id: str                     # 操作人ID
    actor_name: str                   # 操作人姓名
    comment: Optional[str]           # 审批意见
    metadata: Optional[dict]          # 扩展元数据（如拒绝原因）
    created_at: datetime             # 操作时间
    is_void: bool = False            # 作废标记（仅查询用）
```

**物理测试用例**：

```python
# 文件: tests/unit/test_approval_record.py

class TestApprovalRecord:
    """ATB-004 审批记录持久化测试"""
    
    def test_record_created_on_state_change(self, initialized_workorder):
        """
        ATB-004.1 - 状态变更时创建记录
        
        预期:
        - 数据库新增一条 approval_records 记录
        - action == "APPROVE"
        """
        initial_count = ApprovalRecord.query.count()
        
        machine = WorkOrderStateMachine(initialized_workorder)
        machine.approve(approver_id="approver_001")
        
        assert ApprovalRecord.query.count() == initial_count + 1
        
        record = ApprovalRecord.query.filter_by(
            workorder_id=initialized_workorder.id
        ).first()
        assert record.action == "APPROVE"
        assert record.actor_id == "approver_001"

    def test_record_immutable(self, approved_workorder):
        """
        ATB-004.2 - 审批记录不可修改
        
        预期:
        - 更新操作抛出 PermissionError
        - 记录内容未改变
        """
        record = ApprovalRecord.query.filter_by(
            workorder_id=approved_workorder.id
        ).first()
        original_action = record.action
        
        with pytest.raises(PermissionError):
            record.action = "REJECT"
            db.session.commit()
        
        db.session.rollback()
        assert record.action == original_action

    def test_record_not_physically_deleted(self, approved_workorder):
        """
        ATB-004.3 - 记录不物理删除
        
        预期:
        - 调用 delete() 后 is_void 标记为 True
        - 数据库记录仍存在
        """
        record = ApprovalRecord.query.filter_by(
            workorder_id=approved_workorder.id
        ).first()
        record.void()
        db.session.commit()
        
        # 记录仍存在但标记为 void
        assert ApprovalRecord.query.filter_by(id=record.id).first() is not None
        
        # 查询时应默认排除 void 记录
        active_records = ApprovalRecord.query.filter_by(
            workorder_id=approved_workorder.id,
            is_void=False
        ).all()
        assert len(active_records) == 0
```

---

### 4.6 ATB-005: API 接口集成

**E2E 测试场景**：

```typescript
// 文件: frontend/tests/e2e/approval.spec.ts

test('ATB-005-E2E: 审批人处理工单流程', async ({ page, loggedInAs }) => {
  // 1. 以审批人身份登录
  await loggedInAs('approver');
  
  // 2. 进入待审批工单列表
  await page.goto('/approver/pending');
  
  // 3. 进入工单详情
  await page.click('[data-testid="workorder-item"]:first-child');
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('待审批');
  
  // 4. 填写审批意见
  await page.fill('[data-testid="comment-input"]', '同意扩容需求');
  
  // 5. 执行审批通过
  await page.click('[data-testid="approve-btn"]');
  
  // 6. 验证状态更新
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已通过');
  
  // 7. 验证审批历史记录
  await expect(page.locator('[data-testid="history-item"]:last-child'))
    .toContainText('审批通过');
  
  // 8. 验证发起人收到通知（检查模拟邮件）
  const emails = await getSentEmailsTo('creator@example.com');
  expect(emails).toContainEqual(
    expect.objectContaining({ 
      subject: expect.stringContaining('审批通过') 
    })
  );
});

test('ATB-005-E2E: 审批人拒绝工单流程', async ({ page, loggedInAs }) => {
  await loggedInAs('approver');
  await page.goto('/approver/pending');
  await page.click('[data-testid="workorder-item"]:first-child');
  
  // 填写拒绝原因
  await page.fill('[data-testid="reject-reason-input"]', '预算不足');
  await page.click('[data-testid="reject-btn"]');
  
  // 验证状态更新
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已拒绝');
  
  // 验证拒绝原因显示
  await expect(page.locator('[data-testid="reject-reason"]')).toHaveText('预算不足');
});
```

---

## 5. 开发切入层级序列

### 5.1 开发层级依赖图

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层 (优先级最高)                                 │
├─────────────────────────────────────────────────────────────────┤
│  文件: backend/services/workorder_service.py (相关度: 4)        │
│  依赖: 无                                                       │
│  交付物:                                                        │
│    - WorkOrder 模型 (id, title, content, status, creator_id)   │
│    - ApprovalRecord 模型 (id, workorder_id, action, actor)     │
│    - Alembic 迁移脚本                                           │
│  测试: ATB-004 相关用例                                        │
│  入口点: domain/entities/work_order.py, domain/entities/approval_stage.py │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 状态机核心层                                          │
├─────────────────────────────────────────────────────────────────┤
│  文件: src/state_machine/approval_state_machine.py             │
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
│  文件: src/application/services/work_order_service.py          │
│  依赖: Layer 0, Layer 1                                         │
│  交付物:                                                        │
│    - WorkOrderService.create()                                 │
│    - ApprovalService.process(workorder_id, action, approver)   │
│  测试: ATB-001.1, ATB-002.1, ATB-002.2                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: API 接口层                                            │
├─────────────────────────────────────────────────────────────────┤
│  文件: src/api/routers/workorder_router.py                     │
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
│  文件: src/application/services/notification_service.py         │
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
│  文件: frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx │
│  依赖: Layer 3 (API就绪)                                        │
│  交付物:                                                        │
│    - 工单创建表单                                               │
│    - 审批操作面板                                               │
│    - 审批历史展示                                               │
│  测试: ATB-001-E2E, ATB-005-E2E                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键里程碑

| 里程碑 | 完成标准 | 对应测试覆盖 | 验证方法 |
|-------|---------|-------------|---------|
| M1: 数据层就绪 | 迁移脚本执行成功，模型可 CRUD | `pytest tests/unit/test_models.py` | 数据库查询验证 |
| M2: 状态机可用 | 状态转换符合规范，异常拦截生效 | `pytest tests/unit/test_state_machine.py` | 单元测试 |
| M3: API 就绪 | 接口响应格式符合规范，状态码正确 | `pytest tests/api/` | 接口测试 |
| M4: 通知可达 | 状态变更触发队列消息，消费者正确投递 | `pytest tests/unit/test_notification_trigger.py` | Mock 验证 |
| M5: E2E 通过 | Playwright 全部场景通过 | `playwright test` | E2E 测试 |

### 5.3 交付文件清单

根据 Localization Report，以下文件需被修改：

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `backend/services/workorder_service.py` | 修改 | 实现工单服务核心逻辑 |
| `frontend/tests/unit/test_approval_chain.py` | 修改 | 审批链单元测试 |
| `frontend/tests/e2e/approval.spec.ts` | 修改 | 审批 E2E 测试 |
| `frontend/src/stores/approvalStore.test.ts` | 修改 | 审批状态管理测试 |
| `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` | 修改 | 审批详情卡片组件 |

---

## 6. 附录

### 6.1 术语表

| 术语 | 定义 |
|-----|------|
| 状态机 | 维护对象状态及状态转换规则的有限状态自动机 |
| PENDING | 工单待审批状态 |
| 审批记录 | ApprovalRecord，不可变的状态变更历史条目 |
| 幂等性 | 同一操作多次执行结果与单次执行一致 |

### 6.2 参考文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 状态机实现参考 | `src/state_machine/approval_state_machine.py` | transitions 库使用示例 |
| API 规范 | `docs/api_contract.md` | RESTful 接口规范 |
| 前端组件规范 | `frontend/docs/components.md` | Vue 组件开发规范 |
| Notification 设计 | `src/notifications/events.py` | 通知事件定义 |

### 6.3 异常代码定义

| 错误码 | 错误类型 | 说明 |
|-------|---------|------|
| E1001 | StateTransitionError | 非法的状态转换 |
| E1002 | PermissionError | 权限不足 |
| E1003 | ValidationError | 参数校验失败 |
| E1004 | NotFoundError | 资源不存在 |

---

**文档结束**