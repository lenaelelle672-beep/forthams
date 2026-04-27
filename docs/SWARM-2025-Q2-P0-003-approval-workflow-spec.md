# SWARM-2025-Q2-P0-003 工单审批流程规格指导文档

## 需求与背景

### 基本信息

| 项目 | 内容 |
|------|------|
| 需求编号 | SWARM-2025-Q2-P0-003 |
| 需求名称 | 工单审批流程 |
| 当前迭代 | Iteration 2 |
| 核心诉求 | 用户可在前端审批页面完成工单审批操作，后端实现状态机流转并触发通知机制 |

### 业务背景

工单审批流程是企业资产管理系统（AMS）中的核心业务环节，贯穿工单从创建、审批、驳回、最终通过或关闭的完整生命周期。本次 Iteration 2 聚焦审批操作的前后端联动开发，确保审批动作触发后端状态机正确流转，并自动触发相应的通知机制。

### 既有约束（来自 Iteration 1）

- 工单基本 CRUD 功能已完成
- 工单状态枚举已定义：`PENDING_APPROVAL`、`APPROVED`、`REJECTED`、`CLOSED`
- 基础数据库表结构已创建（`work_orders` 表）
- API 路由框架已搭建（`/api/work-orders` 路由组）

### 本次迭代目标

本次 Iteration 2 需完成以下核心交付物：

1. **审批状态机引擎**：实现工单审批状态流转逻辑
2. **审批操作接口**：提供标准 REST API 供前端调用
3. **通知机制**：审批完成后自动触发通知，通知相关人员
4. **前端审批页面**：用户交互界面，支持审批通过/驳回操作

---

## 当前 Phase 对应实施目标

### Phase 层级对照

| Phase | 层级 | 职责说明 | 本次 Iteration 2 实施范围 |
|-------|------|----------|---------------------------|
| Phase 1 | 数据模型层 | 定义数据实体、表结构、状态枚举 | 审批记录表设计、乐观锁字段 |
| Phase 2 | 服务层 | 业务逻辑处理、状态机流转规则 | 审批状态机引擎、ApprovalService |
| Phase 3 | 接口层 | API 路由、请求校验、响应格式化 | 审批操作 REST API |
| Phase 4 | 通知层 | 消息生成、通知投递、订阅管理 | 通知触发机制、RabbitMQ 集成 |
| Phase 5 | 前端交互层 | UI 组件、用户交互、状态同步 | 审批页面组件、E2E 测试 |

### 本次 Spec 聚焦范围

```
┌─────────────────────────────────────────────────────────────────┐
│                        Iteration 2 范围                          │
├─────────────────────────────────────────────────────────────────┤
│  ✅ 审批状态机流转                                                 │
│  ✅ 审批操作接口 (approve/reject)                                  │
│  ✅ 审批记录持久化                                                 │
│  ✅ 通知触发机制                                                   │
│  ✅ 前端审批页面交互                                               │
├─────────────────────────────────────────────────────────────────┤
│  ⏭️ 下一迭代：多级审批链、历史记录查询、批量审批                    │
└─────────────────────────────────────────────────────────────────┘
```

### 技术选型

| 技术项 | 选型 | 说明 |
|--------|------|------|
| 后端框架 | FastAPI + SQLAlchemy | 异步 API、高性能 ORM |
| 前端框架 | React 18 + Ant Design 5 | 组件化开发、企业级 UI |
| 消息队列 | RabbitMQ | 通知消息异步投递 |
| 数据库 | PostgreSQL | 主数据存储 |
| API 风格 | RESTful | 标准化接口设计 |
| 状态管理 | Zustand | 前端轻量状态管理 |
| 测试框架 | pytest + Playwright | 后端单元/集成、前端 E2E |

---

## 边界约束

### 功能边界

| 约束类型 | 约束内容 | 违规处理 |
|----------|----------|----------|
| 审批权限 | 仅 `APPROVER` 角色可执行审批操作 | 非审批人调用返回 403 Forbidden |
| 状态前置条件 | 仅 `PENDING_APPROVAL` 状态的工单可执行审批 | 其他状态返回 409 Conflict |
| 审批意见 | 审批操作必须携带意见（`approval_comment`） | 缺失返回 422 Unprocessable Entity |
| 驳回意见必填 | 审批驳回时意见字段为必填项 | 为空返回 422 |
| 幂等性保障 | 重复提交同一审批操作应返回 200（不重复处理） | 已有记录则返回原结果 |
| 通知异步 | 通知机制采用异步触发，不阻塞审批主流程 | 响应时间 < 500ms |
| 并发控制 | 乐观锁机制（`version` 字段校验） | 避免竞态条件 |

### 数据边界

| 实体 | 表名 | 说明 |
|------|------|------|
| WorkOrder | work_orders | 工单主体，包含 status、version 字段 |
| ApprovalRecord | approval_records | 审批记录，关联工单、审批人、结果 |
| NotificationTask | notification_tasks | 通知任务，待 RabbitMQ 消费 |

### 状态机边界

| 当前状态 | 允许的目标状态 | 触发事件 |
|----------|----------------|----------|
| PENDING_APPROVAL | APPROVED / REJECTED | approve / reject |
| APPROVED | CLOSED | close |
| REJECTED | （不可流转） | — |
| CLOSED | （终态） | — |

### 技术边界

| 边界项 | 限定范围 |
|--------|----------|
| 审批流程 | 仅支持单级审批（暂不支持多级审批链） |
| 审批链 | 由 ApprovalChainService 预留接口，本次不实现 |
| 通知渠道 | 仅 Email + WebSocket（短信通道后续迭代） |
| 批量审批 | 本次不实现，需 Iteration 3 规划 |

---

## 验收测试基准 (ATB)

### ATB-1：审批接口功能测试

| 测试编号 | 测试场景 | 测试步骤 | 物理测试期待 | 断言条件 |
|----------|----------|----------|--------------|----------|
| ATB-1.1 | 审批通过成功 | POST /api/work-orders/{id}/approve，携带有效 comment | 返回 200，工单状态变更为 APPROVED | `response.status_code == 200`<br>`response.json()["status"] == "APPROVED"`<br>`WorkOrder.status == "APPROVED"` |
| ATB-1.2 | 审批驳回成功 | POST /api/work-orders/{id}/reject，携带有效 comment | 返回 200，工单状态变更为 REJECTED | `response.status_code == 200`<br>`response.json()["status"] == "REJECTED"` |
| ATB-1.3 | 审批通过无意见 | POST /api/work-orders/{id}/approve，comment=null | 返回 422 | `response.status_code == 422`<br>`"comment" in response.json()["detail"]` |
| ATB-1.4 | 审批驳回无意见 | POST /api/work-orders/{id}/reject，comment=null | 返回 422 | `response.status_code == 422` |
| ATB-1.5 | 非待审批状态审批 | 工单状态为 APPROVED 时调用 approve 接口 | 返回 409 Conflict | `response.status_code == 409`<br>`"INVALID_STATE_TRANSITION" in response.json()["error_code"]` |
| ATB-1.6 | 非审批人权限 | 非 APPROVER 角色调用审批接口 | 返回 403 Forbidden | `response.status_code == 403` |
| ATB-1.7 | 工单不存在 | 对不存在的工单 ID 执行审批 | 返回 404 Not Found | `response.status_code == 404` |

### ATB-2：状态机流转测试

| 测试编号 | 测试场景 | 测试步骤 | 物理测试期待 | 断言条件 |
|----------|----------|----------|--------------|----------|
| ATB-2.1 | 审批通过流转 | 工单状态 PENDING_APPROVAL → 调用 approve | 状态变更为 APPROVED | `previous_status == "PENDING_APPROVAL"`<br>`new_status == "APPROVED"` |
| ATB-2.2 | 审批驳回流转 | 工单状态 PENDING_APPROVAL → 调用 reject | 状态变更为 REJECTED | `previous_status == "PENDING_APPROVAL"`<br>`new_status == "REJECTED"` |
| ATB-2.3 | 状态不可逆 | APPROVED 状态不可流转至 PENDING_APPROVAL | 流转失败返回 409 | `StateTransitionException` raised<br>`response.status_code == 409` |
| ATB-2.4 | 版本号递增 | 审批成功后 version 字段 +1 | version 字段正确更新 | `work_order.version == old_version + 1` |

### ATB-3：审批记录持久化测试

| 测试编号 | 测试场景 | 测试步骤 | 物理测试期待 | 断言条件 |
|----------|----------|----------|--------------|----------|
| ATB-3.1 | 审批记录生成 | 审批成功后查询 approval_records 表 | 新增一条审批记录 | `ApprovalRecord.query.count() == old_count + 1` |
| ATB-3.2 | 审批记录字段完整性 | 检查新生成的审批记录 | 字段值正确 | `record.work_order_id == work_order.id`<br>`record.approver_id == current_user.id`<br>`record.action == "APPROVE"`<br>`record.comment == submitted_comment` |
| ATB-3.3 | 审批记录关联查询 | 通过工单 ID 查询审批记录 | 可正确关联 | `record in work_order.approval_records` |

### ATB-4：通知触发测试

| 测试编号 | 测试场景 | 测试步骤 | 物理测试期待 | 断言条件 |
|----------|----------|----------|--------------|----------|
| ATB-4.1 | 审批通过通知触发 | 调用 approve 接口后检查通知队列 | RabbitMQ 产生通知消息 | `NotificationTask.query.count() == old_count + 1`<br>`task.notification_type == "APPROVAL_RESULT"`<br>`task.status == "PENDING"` |
| ATB-4.2 | 审批驳回通知触发 | 调用 reject 接口后检查通知队列 | RabbitMQ 产生通知消息 | `task.status == "PENDING"`<br>`task.recipients` 包含申请人 |
| ATB-4.3 | 通知异步不阻塞 | 计时审批接口响应时间 | 通知发送不阻塞主流程 | `response_time < 500ms` |
| ATB-4.4 | 通知消息内容 | 检查生成的 notification_tasks 记录 | 消息格式正确 | `task.title` 包含审批结果<br>`task.content` 包含工单信息 |

### ATB-5：并发控制测试

| 测试编号 | 测试场景 | 测试步骤 | 物理测试期待 | 断言条件 |
|----------|----------|----------|--------------|----------|
| ATB-5.1 | 并发审批乐观锁 | 两个并发审批请求同时到达 | 只有一个成功 | `first_response.status_code == 200`<br>`second_response.status_code == 409` |
| ATB-5.2 | 乐观锁版本校验 | 检查数据库中的 version 值 | 版本号无异常 | `db.commit()` 不抛出 `StaleDataError` |

### ATB-6：前端审批页面 E2E 测试（Playwright）

| 测试编号 | 测试场景 | 测试步骤 | 物理测试期待 | 断言条件 |
|----------|----------|----------|--------------|----------|
| ATB-6.1 | 审批页面加载 | 导航至 /approval 页面 | 页面正常渲染，按钮可见 | `await page.goto("/approval")`<br>`await expect(page.locator("text=审批")).toBeVisible()` |
| ATB-6.2 | 审批通过交互 | 选择工单 → 点击通过 → 填写意见 → 提交 | 显示成功提示，状态刷新 | `await successToast.waitFor()`<br>`await page.reload()`<br>`await expect(page.locator("text=已通过")).toBeVisible()` |
| ATB-6.3 | 审批驳回交互 | 选择工单 → 点击驳回 → 填写意见 → 提交 | 显示成功提示，状态刷新 | `await expect(page.locator("text=已驳回")).toBeVisible()` |
| ATB-6.4 | 意见必填校验 | 提交时不填写意见 | 显示校验错误 | `await expect(page.locator("text=请输入审批意见")).toBeVisible()` |
| ATB-6.5 | 前端状态同步 | 审批成功后 | 工单列表状态立即更新 | `await expect(page.locator("[data-status=APPROVED]")).toHaveCount(expected)` |

---

## 开发切入层级序列

### Phase 1：数据模型层

**目标**：定义审批相关数据结构和数据库表

```
Phase 1: 数据模型层
│
├── [1.1] 审批记录表设计 (approval_records)
│       ├── id (PK, UUID)
│       ├── work_order_id (FK → work_orders.id)
│       ├── approver_id (FK → users.id)
│       ├── action (ENUM: APPROVE, REJECT)
│       ├── comment (TEXT, nullable=False for REJECT)
│       ├── created_at (TIMESTAMP)
│       └── INDEX: (work_order_id), (approver_id)
│
├── [1.2] 通知任务表设计 (notification_tasks)
│       ├── id (PK, UUID)
│       ├── notification_type (ENUM: APPROVAL_RESULT)
│       ├── title (VARCHAR)
│       ├── content (TEXT)
│       ├── recipients (JSON: [user_id_list])
│       ├── status (ENUM: PENDING, SENT, FAILED)
│       ├── created_at (TIMESTAMP)
│       └── sent_at (TIMESTAMP, nullable)
│
└── [1.3] 工单表扩展
        └── 增加 version 字段（乐观锁，INTEGER, default=0）
```

**交付物**：
- 数据库迁移脚本：`migrations/versions/xxx_add_approval_tables.py`
- SQLAlchemy 模型：`src/models/approval_record.py`、`src/models/notification_task.py`

### Phase 2：服务层

**目标**：实现审批业务逻辑和状态机流转规则

```
Phase 2: 服务层
│
├── [2.1] 审批状态机定义
│       ├── src/state_machine/approval_state_machine.py
│       │   ├── StateTransitionEngine 类
│       │   ├── validate_transition(current_state, action) → bool
│       │   └── execute_transition(work_order, action) → new_state
│       │
│       └── 流转规则矩阵
│           PENDING_APPROVAL → APPROVED (approve)
│           PENDING_APPROVAL → REJECTED (reject)
│
└── [2.2] ApprovalService
        ├── src/application/services/approval_service.py
        │   ├── approve(work_order_id, user_id, comment) → ApprovalResult
        │   ├── reject(work_order_id, user_id, comment) → ApprovalResult
        │   └── get_approval_history(work_order_id) → List[ApprovalRecord]
        │
        └── 通知触发调用
            └── notification_service.send_approval_notification()
```

**交付物**：
- 状态机引擎：`src/state_machine/approval_state_machine.py`
- 审批服务：`src/application/services/approval_service.py`
- 单元测试：`tests/unit/test_approval_service.py`

### Phase 3：接口层

**目标**：暴露 REST API 供前端调用

```
Phase 3: 接口层
│
├── [3.1] 审批 API 路由
│       ├── POST /api/work-orders/{work_order_id}/approve
│       │   ├── Request: { "comment": string }
│       │   ├── Response: { id, status, version, approval_record }
│       │   └── 权限: APPROVER 角色
│       │
│       └── POST /api/work-orders/{work_order_id}/reject
│           ├── Request: { "comment": string (required) }
│           ├── Response: { id, status, version, approval_record }
│           └── 权限: APPROVER 角色
│
└── [3.2] 权限校验中间件
        └── src/api/middleware/permission_check.py
            └── verify_approver_role(user_id) → bool
```

**交付物**：
- API 路由：`src/api/routers/approval_router.py`
- 请求 Schema：`src/api/schemas/approval_schemas.py`
- API 测试：`tests/api/test_approval_api.py`

### Phase 4：通知层

**目标**：实现审批结果通知的异步触发和投递

```
Phase 4: 通知层
│
├── [4.1] NotificationService 扩展
│       ├── src/application/services/notification_service.py
│       │   ├── send_approval_notification(approval_record)
│       │   │   ├── 构建通知消息（审批结果、工单信息）
│       │   │   ├── 确定接收人（申请人、相关人员）
│       │   │   └── 投递到 RabbitMQ
│       │   │
│       │   └── create_notification_task() → NotificationTask
│       │
│       └── RabbitMQ 配置
│           └── exchange: ams.notifications
│           └── queue: approval.notifications
│
└── [4.2] 通知消费者
        └── src/infrastructure/messaging/consumers/notification_consumer.py
            └── 消费消息 → 发送 Email/WebSocket
```

**交付物**：
- 通知服务：`src/application/services/notification_service.py`
- 消息生产者：`src/infrastructure/messaging/publisher.py`
- 集成测试：`tests/integration/test_approval_operations.py`

### Phase 5：前端交互层

**目标**：实现审批页面 UI 和用户交互

```
Phase 5: 前端交互层
│
├── [5.1] 审批页面组件
│       ├── src/pages/ApprovalPage/
│       │   ├── ApprovalPage.tsx
│       │   ├── ApprovalPage.module.css
│       │   ├── components/
│       │   │   ├── WorkOrderList.tsx
│       │   │   ├── ApprovalActions.tsx
│       │   │   ├── ApprovalModal.tsx
│       │   │   └── CommentInput.tsx
│       │   └── hooks/
│       │       └── useApprovalActions.ts
│       │
│       └── src/services/approvalService.ts
│           ├── approveWorkOrder(id, comment)
│           └── rejectWorkOrder(id, comment)
│
└── [5.2] E2E 测试
        └── tests/e2e/approval.spec.ts
            ├── test_approval_page_loads()
            ├── test_approve_work_order()
            └── test_reject_work_order()
```

**交付物**：
- 前端页面：`frontend/src/pages/ApprovalPage/`
- API 客户端：`frontend/src/api/approval.ts`
- E2E 测试：`tests/e2e/approval.spec.ts`

### 依赖关系与开发顺序

| 层级 | 前置依赖 | 可独立开发 | 并行开发候选 |
|------|----------|------------|--------------|
| Phase 1 | 无 | ✅ 是 | — |
| Phase 2 | Phase 1 | ✅ 是（可 mock 数据模型） | 与 Phase 1 可并行 |
| Phase 3 | Phase 2 | ⚠️ 需等服务接口定义 | — |
| Phase 4 | Phase 2 | ⚠️ 需等服务触发点 | 可与 Phase 3 并行 |
| Phase 5 | Phase 3 | ⚠️ 需等 API 接口契约 | — |

### 测试切入时机

| 测试类型 | 工具 | 切入 Phase | 前置条件 |
|----------|------|------------|----------|
| 单元测试 | pytest | Phase 2 完成后 | 服务层逻辑可独立验证 |
| 接口测试 | pytest + TestClient | Phase 3 完成后 | API 路由已注册 |
| 集成测试 | pytest + Real DB | Phase 4 完成后 | 通知机制已集成 |
| E2E 测试 | Playwright | Phase 5 完成后 | 前端页面可访问 |

---

## 附录

### A. 关键接口契约

#### 审批通过接口

```
POST /api/work-orders/{work_order_id}/approve
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "comment": "审批通过，同意执行"
}

Success Response (200 OK):
{
  "id": "wo-123",
  "status": "APPROVED",
  "version": 2,
  "approval_record": {
    "id": "ar-456",
    "work_order_id": "wo-123",
    "action": "APPROVE",
    "approver_id": "user-789",
    "comment": "审批通过，同意执行",
    "created_at": "2025-04-10T10:30:00Z"
  }
}

Error Responses:
- 403: { "error_code": "FORBIDDEN", "message": "无审批权限" }
- 404: { "error_code": "NOT_FOUND", "message": "工单不存在" }
- 409: { "error_code": "INVALID_STATE_TRANSITION", "message": "工单状态不允许审批" }
- 422: { "error_code": "VALIDATION_ERROR", "message": "审批意见不能为空" }
```

#### 审批驳回接口

```
POST /api/work-orders/{work_order_id}/reject
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "comment": "驳回：缺少关键附件"
}

Success Response (200 OK):
{
  "id": "wo-123",
  "status": "REJECTED",
  "version": 2,
  "approval_record": {
    "id": "ar-456",
    "work_order_id": "wo-123",
    "action": "REJECT",
    "approver_id": "user-789",
    "comment": "驳回：缺少关键附件",
    "created_at": "2025-04-10T10:30:00Z"
  }
}
```

### B. 数据库 Schema

```sql
-- approval_records 表
CREATE TABLE approval_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id),
    approver_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('APPROVE', 'REJECT')),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    CONSTRAINT fk_approver FOREIGN KEY (approver_id) REFERENCES users(id)
);
CREATE INDEX idx_approval_work_order ON approval_records(work_order_id);
CREATE INDEX idx_approval_approver ON approval_records(approver_id);

-- notification_tasks 表
CREATE TABLE notification_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    recipients JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_notification_status ON notification_tasks(status);

-- work_orders 表扩展
ALTER TABLE work_orders ADD COLUMN version INTEGER DEFAULT 0;
```

### C. 文件清单

| 文件路径 | 描述 | Phase |
|----------|------|-------|
| `migrations/versions/xxx_add_approval_tables.py` | 审批相关表迁移脚本 | Phase 1 |
| `src/models/approval_record.py` | 审批记录模型 | Phase 1 |
| `src/models/notification_task.py` | 通知任务模型 | Phase 1 |
| `src/state_machine/approval_state_machine.py` | 审批状态机引擎 | Phase 2 |
| `src/application/services/approval_service.py` | 审批服务 | Phase 2 |
| `src/api/routers/approval_router.py` | 审批 API 路由 | Phase 3 |
| `src/api/schemas/approval_schemas.py` | 审批请求/响应 Schema | Phase 3 |
| `src/application/services/notification_service.py` | 通知服务 | Phase 4 |
| `src/infrastructure/messaging/publisher.py` | RabbitMQ 消息发布者 | Phase 4 |
| `frontend/src/pages/ApprovalPage/ApprovalPage.tsx` | 审批页面组件 | Phase 5 |
| `frontend/src/api/approval.ts` | 审批 API 客户端 | Phase 5 |
| `tests/e2e/approval.spec.ts` | E2E 测试 | Phase 5 |

---

*文档版本：v1.0*  
*创建日期：2025-04-10*  
*所属迭代：SWARM-2025-Q2-P0-003 Iteration 2*