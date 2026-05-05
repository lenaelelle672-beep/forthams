# SWARM-001 工单审批流程规格指导文档

---

## 1. 需求与背景

### 1.1 业务场景

企业级工单审批系统需要支撑标准的三级审批流转机制，支持工单从创建到最终裁决的完整生命周期管理。

### 1.2 核心状态流转

```
[待审批] → [审批中] → [已批准]
                      ↘ [已拒绝]
```

### 1.3 功能边界

| 功能模块 | 说明 |
|---------|------|
| 状态机 | 定义工单状态枚举、合法流转路径、状态转换前置条件 |
| 工作流引擎 | 驱动审批流程按预设规则自动推进、触发通知 |
| 审批动作 API | 提供审批/拒绝/退回的 RESTful 接口 |
| 审批历史 | 记录每次审批操作的完整审计轨迹 |

---

## 2. 当前 Phase 对应实施目标

**Phase 1: 核心基础设施**
- 数据库模型定义（工单表、审批历史表）
- 状态机枚举与转换规则
- 基础 CRUD API

**Phase 2: 工作流引擎**
- 审批规则引擎（条件路由、层级推进）
- 自动通知触发机制
- 状态转换事务保证

**Phase 3: 前端审批页面**
- 审批工作台（待办列表）
- 审批操作界面（批准/拒绝/附言）
- 审批历史可视化

---

## 3. 边界约束

### 3.1 技术栈约束

- **后端**: Python 3.11+ / FastAPI
- **前端**: React 18+ / TypeScript
- **数据库**: PostgreSQL 14+
- **ORM**: SQLAlchemy 2.0+

### 3.2 状态机约束

```
状态枚举: PENDING, IN_REVIEW, APPROVED, REJECTED

合法流转矩阵:
┌───────────┬────────────────┐
│ 当前状态   │ 下一状态       │
├───────────┼────────────────┤
│ PENDING   │ IN_REVIEW      │
│ IN_REVIEW │ APPROVED       │
│ IN_REVIEW │ REJECTED       │
│ REJECTED  │ (终态，不可流转)│
│ APPROVED  │ (终态，不可流转)│
└───────────┴────────────────┘

前置条件:
- PENDING → IN_REVIEW: 需要指定审批人
- IN_REVIEW → APPROVED: 审批人权限校验通过
- IN_REVIEW → REJECTED: 必须填写拒绝理由（10-500字符）
```

### 3.3 性能约束

- 单次状态转换响应时间 < 200ms
- 历史记录查询响应时间 < 500ms
- 支持 100 并发审批操作

### 3.4 安全约束

- 审批操作需验证操作者身份与权限
- 拒绝理由必须非空且长度 10-500 字符
- 所有审批操作需记录操作者 IP 与时间戳

---

## 4. 验收测试基准 (ATB)

### Phase 1: 核心基础设施

#### ATB-1.1 状态机流转验证

```python
# tests/test_state_machine.py
import pytest
from app.models import TicketStatus
from app.services.state_machine import TicketStateMachine

def test_pending_to_in_review_legal_transition():
    """PENDING → IN_REVIEW 合法流转"""
    sm = TicketStateMachine()
    assert sm.can_transition(TicketStatus.PENDING, TicketStatus.IN_REVIEW) is True

def test_pending_cannot_jump_to_approved():
    """非法流转: PENDING 不能直接到 APPROVED"""
    sm = TicketStateMachine()
    assert sm.can_transition(TicketStatus.PENDING, TicketStatus.APPROVED) is False

def test_terminal_states_cannot_transition():
    """终态不可流转"""
    sm = TicketStateMachine()
    assert sm.can_transition(TicketStatus.APPROVED, TicketStatus.REJECTED) is False
    assert sm.can_transition(TicketStatus.REJECTED, TicketStatus.APPROVED) is False
```

**物理测试期待**: `pytest tests/test_state_machine.py -v` 返回 3 PASSED

#### ATB-1.2 数据库模型验证

```python
# tests/test_models.py
import pytest
from sqlalchemy import inspect
from app.models import Ticket, ApprovalHistory

def test_ticket_status_enum_values():
    """验证状态枚举值"""
    statuses = [s.value for s in TicketStatus]
    assert set(statuses) == {"PENDING", "IN_REVIEW", "APPROVED", "REJECTED"}

def test_approval_history_cascade_delete():
    """工单删除时历史记录级联删除"""
    # pytest-playwright 或数据库事务测试
    pass
```

#### ATB-1.3 基础 API 验证

```python
# tests/test_api_tickets.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_ticket_returns_pending():
    """创建工单默认状态为 PENDING"""
    response = client.post("/api/tickets/", json={"title": "Test", "content": "Content"})
    assert response.status_code == 201
    assert response.json()["status"] == "PENDING"

def test_get_ticket_status():
    """查询工单状态"""
    response = client.get("/api/tickets/1/status")
    assert response.status_code == 200
    assert "status" in response.json()
```

**物理测试期待**: `pytest tests/test_api_tickets.py -v` 返回对应用例 PASSED

---

### Phase 2: 工作流引擎

#### ATB-2.1 审批规则验证

```python
# tests/test_workflow_engine.py
import pytest
from app.services.workflow import WorkflowEngine

def test_auto_assign_approver():
    """工单进入 IN_REVIEW 时自动分配审批人"""
    engine = WorkflowEngine()
    ticket = engine.process_transition(ticket_id=1, action="SUBMIT")
    assert ticket.approver_id is not None

def test_notification_triggered_on_transition():
    """状态转换触发通知"""
    # mock 通知服务
    with patch("app.services.notification.send") as mock_send:
        engine = WorkflowEngine()
        engine.process_transition(ticket_id=1, action="APPROVE")
        mock_send.assert_called_once()
```

#### ATB-2.2 拒绝理由验证

```python
# tests/test_workflow_engine.py
def test_reject_without_reason_fails():
    """拒绝操作缺少理由时抛出 ValidationError"""
    engine = WorkflowEngine()
    with pytest.raises(ValidationError) as exc_info:
        engine.process_transition(ticket_id=1, action="REJECT", reason="")
    assert "拒绝理由不能为空" in str(exc_info.value)

def test_reject_reason_length_validation():
    """拒绝理由长度校验"""
    engine = WorkflowEngine()
    with pytest.raises(ValidationError):
        engine.process_transition(ticket_id=1, action="REJECT", reason="太短")  # < 10 chars
```

**物理测试期待**: `pytest tests/test_workflow_engine.py -v` 返回 4 PASSED

#### ATB-2.3 审批 API 集成验证

```python
# tests/test_approval_api.py
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test_token_approver"}

def test_approve_ticket_api(auth_headers):
    """审批通过 API 端到端测试"""
    response = client.post(
        "/api/tickets/1/approve",
        headers=auth_headers,
        json={"comment": "同意"}
    )
    assert response.status_code == 200
    assert response.json()["new_status"] == "APPROVED"

def test_reject_ticket_requires_reason(auth_headers):
    """拒绝接口校验理由"""
    response = client.post(
        "/api/tickets/1/reject",
        headers=auth_headers,
        json={"reason": ""}
    )
    assert response.status_code == 422  # Validation Error
```

**物理测试期待**: `pytest tests/test_approval_api.py -v` 返回 2 PASSED

---

### Phase 3: 前端审批页面

#### ATB-3.1 审批工作台验证 (Playwright)

```typescript
// e2e/approval-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('审批工作台显示待办工单列表', async ({ page }) => {
  await page.goto('/approval/dashboard');
  await expect(page.locator('[data-testid="pending-tickets"]')).toBeVisible();
  const ticketCards = page.locator('[data-testid="ticket-card"]');
  await expect(ticketCards).toHaveCount(3); // 预期待审批数
});

test('审批操作成功反馈', async ({ page }) => {
  await page.goto('/approval/ticket/1');
  await page.click('[data-testid="approve-btn"]');
  await page.fill('[data-testid="comment-input"]', '审批通过');
  await page.click('[data-testid="confirm-btn"]');
  await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  await expect(page).toHaveURL('/approval/dashboard');
});
```

**物理测试期待**: `npx playwright test e2e/approval-workflow.spec.ts` 返回 2 PASSED

#### ATB-3.2 审批历史记录验证

```typescript
// e2e/history.spec.ts
test('审批历史时间线展示', async ({ page }) => {
  await page.goto('/approval/ticket/1/history');
  const historyItems = page.locator('[data-testid="history-item"]');
  await expect(historyItems).toHaveCount(3); // 提交、审批、终态
  await expect(historyItems.first()).toContainText('提交时间');
});
```

---

## 5. 开发切入层级序列

```
┌─────────────────────────────────────────────────────────────────┐
│  Level 1: 数据库模型层 (Day 1)                                   │
│  ├── Ticket 模型 (id, title, content, status, created_at...)    │
│  ├── ApprovalHistory 模型 (id, ticket_id, action, operator...) │
│  └── 迁移脚本编写                                               │
├─────────────────────────────────────────────────────────────────┤
│  Level 2: 状态机核心 (Day 1-2)                                   │
│  ├── 状态枚举定义                                                │
│  ├── 状态转换规则引擎                                            │
│  ├── 前置条件校验                                                │
│  └── 单元测试覆盖                                                │
├─────────────────────────────────────────────────────────────────┤
│  Level 3: 基础 API (Day 2-3)                                    │
│  ├── POST /api/tickets (创建工单)                                │
│  ├── GET /api/tickets/{id} (查询详情)                           │
│  ├── GET /api/tickets/{id}/status (查询状态)                     │
│  └── 集成测试                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Level 4: 审批动作 API (Day 3-4)                                │
│  ├── POST /api/tickets/{id}/submit (提交审批)                    │
│  ├── POST /api/tickets/{id}/approve (批准)                      │
│  ├── POST /api/tickets/{id}/reject (拒绝)                       │
│  ├── 权限校验中间件                                              │
│  └── 端到端测试                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Level 5: 工作流引擎 (Day 4-5)                                  │
│  ├── 自动审批人分配                                              │
│  ├── 状态转换通知触发                                            │
│  ├── 审批超时处理                                                │
│  └── 事务回滚机制                                                │
├─────────────────────────────────────────────────────────────────┤
│  Level 6: 前端页面 (Day 5-7)                                    │
│  ├── 审批工作台 (待办列表)                                       │
│  ├── 审批详情页                                                  │
│  ├── 审批历史时间线                                              │
│  └── E2E 测试                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 依赖关系说明

```
Level 1 ──→ Level 2 ──→ Level 3 ──→ Level 4 ──→ Level 5 ──→ Level 6
  │            │           │           │           │
  └── 无依赖    └── 依赖L1   └── 依赖L2   └── 依赖L3   └── 依赖L4,L5
```

**强制前置条件**:
- Level 3 必须在 Level 2 单元测试全部通过后方可开发
- Level 4 必须在 Level 3 API 联调通过后方可开发
- Level 6 前端开发需后端 API 提供 Mock Server 或联调环境

---

## 6. API 规格摘要

| 方法 | 端点 | 请求体 | 响应状态 | 说明 |
|-----|------|--------|---------|------|
| POST | /api/tickets | `{title, content}` | 201 | 创建工单 |
| GET | /api/tickets/{id} | - | 200 | 查询工单 |
| POST | /api/tickets/{id}/submit | `{approver_id}` | 200 | 提交审批 |
| POST | /api/tickets/{id}/approve | `{comment?}` | 200 | 批准 |
| POST | /api/tickets/{id}/reject | `{reason}` | 200 | 拒绝 |
| GET | /api/tickets/{id}/history | - | 200 | 审批历史 |

---

## 附录: 类型定义规范

### 工单状态枚举

```typescript
enum TicketStatus {
  PENDING = 'PENDING',      // 待审批
  IN_REVIEW = 'IN_REVIEW', // 审批中
  APPROVED = 'APPROVED',   // 已批准
  REJECTED = 'REJECTED'    // 已拒绝
}
```

### 审批动作枚举

```typescript
enum ApprovalAction {
  SUBMIT = 'SUBMIT',       // 提交审批
  APPROVE = 'APPROVE',     // 批准
  REJECT = 'REJECT'        // 拒绝
}
```

### 状态转换规则

```typescript
interface StateTransitionRule {
  from: TicketStatus;
  to: TicketStatus;
  action: ApprovalAction;
  requiredFields?: string[];
  validation?: (context: TransitionContext) => boolean;
}
```

---

**文档版本**: SWARM-001-Iteration-1  
**生成时间**: 2024-XX-XX  
**状态**: APPROVED (Round 1)

---

## 交付物清单

| 文件 | 说明 | 优先级 |
|-----|------|--------|
| `frontend/src/types/workorder.types.ts` | 工单类型定义 | P0 |
| `backend/services/ticket_service.py` | 工单服务层 | P0 |
| `migrations/versions/20240101_000000_add_ticket_tables.py` | 数据库迁移 | P0 |
| `frontend/tests/unit/workorder_api.test.ts` | 单元测试 | P1 |
| `frontend/tests/e2e/workorder_list.spec.ts` | E2E 测试 | P1 |
| `frontend/tests/e2e/approval.spec.ts` | E2E 测试 | P1 |