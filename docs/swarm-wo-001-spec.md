# SWARM-WO-001 工单审批流程规格指导文档

## 1. 需求与背景

### 1.1 业务背景
- 工单审批是企业运维/IT服务管理的核心流程
- 用户需提交工单、追踪审批进度、接收审批结果通知
- 当前缺少完整的前端审批页面、后端状态机、通知机制

### 1.2 功能范围
| 模块 | 功能点 |
|------|--------|
| WorkOrderApprovePage | 工单提交、审批进度查看、审批操作（通过/拒绝/转交） |
| WorkOrderStatusMachine | 状态流转引擎（草稿→待审批→审批中→已完成/已拒绝） |
| NotificationService | 审批结果通知（站内信、邮件可选） |

### 1.3 技术栈约束
- 前端：React + TypeScript + TailwindCSS
- 后端：Django REST Framework
- 数据库：PostgreSQL（通过 Django ORM）
- 消息队列：Redis（用于通知异步投递）

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 核心工单状态机 + 数据库模型
- **目标**：建立工单实体的状态流转基础
- **交付物**：
  - `WorkOrder` model（含状态字段、审批人关联、时间戳）
  - `WorkOrderStatusMachine` 状态机实现
  - 基础 API：创建工单、查询工单详情

### Phase 2: 前端审批页面
- **目标**：用户可提交工单、查看审批进度
- **交付物**：
  - `WorkOrderApprovePage` 页面组件
  - 工单列表视图、审批详情视图
  - 审批操作按钮（通过/拒绝）

### Phase 3: 通知机制
- **目标**：审批完成后实时通知申请人
- **交付物**：
  - `NotificationService` 服务
  - 站内通知记录表 `Notification`
  - 邮件通知（可选，需配置 SMTP）

---

## 3. 边界约束

### 3.1 功能边界
| 约束项 | 描述 |
|--------|------|
| 工单类型 | 仅支持单层级审批，不支持会签/或签 |
| 审批层级 | 单层级审批（申请人 → 审批人） |
| 通知范围 | 仅通知申请人，不支持群发 |
| 状态回退 | 拒绝后工单状态为 `REJECTED`，不支持重新激活 |

### 3.2 数据边界
| 约束项 | 描述 |
|--------|------|
| 工单标题 | 最大 200 字符 |
| 工单描述 | 最大 5000 字符 |
| 审批意见 | 最大 1000 字符 |
| 通知内容 | 最大 500 字符 |

### 3.3 非功能约束
| 约束项 | 描述 |
|--------|------|
| 并发控制 | 同一工单同时只允许一个审批操作（乐观锁） |
| 审计日志 | 所有状态变更需记录 `status_history` 表 |
| 响应时限 | API 响应时间 < 500ms（不含邮件发送） |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端状态机测试

#### ATB-001: 工单状态流转
```python
# pytest tests/test_status_machine.py

def test_submit_workorder_flow():
    """
    物理测试期待：
    1. 创建工单 → status = DRAFT
    2. 调用 submit() → status = PENDING_APPROVAL
    3. 审批通过 → status = APPROVED
    """
    wo = WorkOrder.objects.create(...)
    assert wo.status == WorkOrderStatus.DRAFT
    
    wo.submit()
    assert wo.status == WorkOrderStatus.PENDING_APPROVAL
    
    wo.approve(comment="OK")
    assert wo.status == WorkOrderStatus.APPROVED

def test_reject_workorder():
    """
    物理测试期待：
    1. 工单提交后审批拒绝
    2. status = REJECTED
    3. 无法再次审批（状态锁定）
    """
    wo = WorkOrder.objects.create(...)
    wo.submit()
    
    wo.reject(comment="材料不全")
    assert wo.status == WorkOrderStatus.REJECTED
    
    with pytest.raises(InvalidStateTransitionError):
        wo.approve()  # 应抛出异常

def test_invalid_transition():
    """
    物理测试期待：
    - DRAFT 状态直接 APPROVE 应抛出 InvalidStateTransitionError
    """
    wo = WorkOrder.objects.create(...)
    with pytest.raises(InvalidStateTransitionError):
        wo.approve()
```

#### ATB-002: 并发审批控制
```python
# pytest tests/test_concurrency.py

def test_concurrent_approval_lock():
    """
    物理测试期待：
    1. 两个并发请求同时审批同一工单
    2. 只有一个成功，另一个返回 409 Conflict
    """
    wo = WorkOrder.objects.create(status=WorkOrderStatus.PENDING_APPROVAL)
    
    with concurrent.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(approve_workorder, wo.id, user1),
            executor.submit(approve_workorder, wo.id, user2),
        ]
        results = [f.result() for f in futures]
    
    successes = [r for r in results if r.status_code == 200]
    assert len(successes) == 1
```

### 4.2 前端页面测试

#### ATB-003: 工单提交页面
```python
# playwright tests/test_workorder_page.py

def test_submit_workorder_page(client):
    """
    物理测试期待：
    1. 访问 /workorder/submit → 渲染工单提交表单
    2. 填写标题、描述、审批人
    3. 点击提交 → 显示成功提示
    4. 重定向至工单列表页
    """
    page.goto(f"{BASE_URL}/workorder/submit")
    page.fill("input[name='title']", "服务器扩容申请")
    page.fill("textarea[name='description']", "因业务增长...")
    page.select_option("select[name='approver']", "user_admin_001")
    
    page.click("button[type='submit']")
    
    expect(page.locator(".toast-success")).to_be_visible()
    expect(page).to_have_url(f"{BASE_URL}/workorder/list")
```

#### ATB-004: 审批进度查看
```python
# playwright tests/test_progress_view.py

def test_view_approval_progress(client):
    """
    物理测试期待：
    1. 工单详情页显示状态流转时间轴
    2. 当前状态高亮显示
    3. 已完成状态显示绿色勾选
    """
    wo = create_approved_workorder()
    page.goto(f"{BASE_URL}/workorder/{wo.id}")
    
    timeline = page.locator(".approval-timeline")
    expect(timeline).to_contain_text("待审批")
    expect(timeline.locator(".current")).to_contain_text("已完成")
```

#### ATB-005: 审批操作
```python
# playwright tests/test_approve_action.py

def test_approve_button(client):
    """
    物理测试期待：
    1. 审批人登录 → 进入审批页面
    2. 点击「通过」按钮 → 弹出审批意见输入框
    3. 输入意见 → 点击确认
    4. 状态更新为 APPROVED，显示成功提示
    """
    login_as_approver(client)
    page.goto(f"{BASE_URL}/workorder/{wo.id}/approve")
    
    page.click("button:has-text('通过')")
    page.fill("textarea[name='comment']", "同意")
    page.click("button:has-text('确认')")
    
    expect(page.locator(".status-badge")).to_have_text("已通过")
```

### 4.3 通知服务测试

#### ATB-006: 审批通过通知
```python
# pytest tests/test_notification.py

def test_approval_notification_created():
    """
    物理测试期待：
    1. 工单审批通过后
    2. 创建 Notification 记录
    3. recipient = 工单申请人
    4. content 包含工单标题和审批结果
    """
    wo = create_pending_workorder()
    wo.approve(comment="通过")
    
    notification = Notification.objects.get(recipient=wo.creator)
    assert "已通过" in notification.content
    assert notification.is_read == False

def test_notification_read_status():
    """
    物理测试期待：
    1. 用户点击通知 → is_read 更新为 True
    2. 通知列表中未读数减少
    """
    login_as_user(client)
    page.goto(f"{BASE_URL}/notifications")
    
    page.click(".notification-item:first-child")
    
    notification = Notification.objects.first()
    assert notification.is_read == True
```

### 4.4 API 契约测试

#### ATB-007: 工单 CRUD API
```python
# pytest tests/test_api.py

def test_create_workorder_api():
    """
    物理测试期待：
    POST /api/workorders/
    - 201 Created
    - 返回工单 ID 和初始状态
    """
    response = client.post("/api/workorders/", {
        "title": "测试工单",
        "description": "描述内容",
        "approver_id": 5
    })
    assert response.status_code == 201
    assert response.json()["status"] == "DRAFT"

def test_workorder_detail_api():
    """
    物理测试期待：
    GET /api/workorders/{id}/
    - 包含状态流转历史
    """
    response = client.get("/api/workorders/1/")
    data = response.json()
    assert "status_history" in data
    assert len(data["status_history"]) > 0
```

---

## 5. 开发切入层级序列

### Phase 1: 数据库模型 + 状态机
```
Layer 1: 数据层
├── models.py
│   ├── WorkOrder (id, title, description, status, creator_id, approver_id, created_at, updated_at)
│   ├── WorkOrderStatusHistory (id, workorder_id, from_status, to_status, operator_id, comment, timestamp)
│   └── Notification (id, recipient_id, title, content, is_read, created_at)
│
Layer 2: 业务逻辑层
├── status_machine.py
│   ├── WorkOrderStatusMachine
│   │   ├── DRAFT → PENDING_APPROVAL (submit)
│   │   ├── PENDING_APPROVAL → APPROVED (approve)
│   │   ├── PENDING_APPROVAL → REJECTED (reject)
│   │   └── State validation
│   └── InvalidStateTransitionError
│
Layer 3: API 层
├── views.py
│   ├── WorkOrderCreateView (POST)
│   ├── WorkOrderDetailView (GET)
│   ├── WorkOrderSubmitView (POST)
│   └── WorkOrderApproveView (POST)
└── serializers.py
    ├── WorkOrderCreateSerializer
    └── WorkOrderApprovalSerializer
```

### Phase 2: 前端页面
```
Layer 1: 页面组件
├── pages/WorkOrderApprovePage.tsx
│   ├── WorkOrderSubmitForm
│   ├── WorkOrderListView
│   ├── WorkOrderDetailView (含审批进度时间轴)
│   └── ApprovalActionPanel (通过/拒绝按钮 + 意见输入)
│
Layer 2: API 服务层
├── services/workOrderService.ts
│   ├── createWorkOrder()
│   ├── submitWorkOrder()
│   ├── approveWorkOrder()
│   └── getWorkOrderDetail()
│
Layer 3: 通知组件
├── components/NotificationBell.tsx
└── components/NotificationList.tsx
```

### Phase 3: 通知机制
```
Layer 1: 通知服务
├── notification_service.py
│   ├── NotificationService.create()
│   ├── NotificationService.send_email()
│   └── NotificationService.mark_read()
│
Layer 2: 信号触发
├── signals.py
│   ├── workorder_approved.connect()
│   └── workorder_rejected.connect()
│
Layer 3: 前端通知消费
├── hooks/useNotifications.ts
└── pages/NotificationPage.tsx
```

### 开发顺序与依赖关系

| 顺序 | 模块 | 依赖前置 |
|------|------|----------|
| 1 | WorkOrder model + 状态机 | 无 |
| 2 | WorkOrder CRUD API | 1 |
| 3 | WorkOrder 前端列表页 | 2 |
| 4 | WorkOrder 提交表单 | 2, 3 |
| 5 | 审批操作 API | 1, 2 |
| 6 | 审批详情页 | 3, 5 |
| 7 | Notification model + Service | 1 |
| 8 | 审批完成 → 创建通知 | 5, 7 |
| 9 | 通知列表页面 | 7 |

---

## 附录：数据模型定义

### WorkOrder
```
id: UUID (PK)
title: VARCHAR(200) NOT NULL
description: TEXT
status: ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')
creator_id: FK(User)
approver_id: FK(User)
created_at: TIMESTAMP
updated_at: TIMESTAMP
version: INTEGER (乐观锁)
```

### WorkOrderStatusHistory
```
id: UUID (PK)
workorder_id: FK(WorkOrder)
from_status: ENUM
to_status: ENUM
operator_id: FK(User)
comment: VARCHAR(1000)
created_at: TIMESTAMP
```

### Notification
```
id: UUID (PK)
recipient_id: FK(User)
title: VARCHAR(100)
content: VARCHAR(500)
is_read: BOOLEAN DEFAULT FALSE
related_workorder_id: FK(WorkOrder, nullable)
created_at: TIMESTAMP
```