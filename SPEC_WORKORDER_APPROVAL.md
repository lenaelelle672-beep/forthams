# 工单审批流程 (SWARM-001) 规格指导文档

> **版本**: 1.0  
> **创建日期**: 2024  
> **状态**: APPROVED  
> **迭代周期**: Iteration 1

---

## 1. 需求与背景

### 1.1 业务场景

工单审批是企业运维/客服系统的核心链路。当用户提交工单后，需经过运维/客服/管理员等多角色依次审批才能流转至终态。

**当前痛点**:
- 审批节点分散于线下沟通，流程不可控
- 状态变更缺乏即时通知，用户体验差
- 审批动作无法追溯，审计维度缺失

### 1.2 功能范围

| 层级 | 交付内容 |
|------|----------|
| 前端 | 工单审批页面（审批/驳回/转交三按钮 + 审批历史时间轴） |
| 后端 | 状态机流转引擎（7状态）+ 审批记录持久化 |
| 通知 | WebSocket 实时推送 + Email 异步发送 |

### 1.3 用户价值

| 角色 | 收益 |
|------|------|
| 申请人 | 实时知晓工单处理进度，消除焦虑 |
| 审批人 | 在统一界面完成审批操作，减少切换成本 |
| 管理员 | 全链路审计追溯，支持合规审计 |

---

## 2. 当前 Phase 对应实施目标

**参照 Plan.md Phase 拆解：Phase 2 - 审批流程核心实现**

| 目标编号 | 目标层级 | 具体交付物 | 依赖关系 |
|----------|----------|------------|----------|
| P2.1 | 前端审批UI | `ApprovalActions.vue` + `ApprovalHistory.vue` + `TransferModal.vue` | 依赖 P2.3 API 完成 |
| P2.2 | 后端状态机 | `WorkOrderStateMachine` (7状态流转引擎) | 依赖数据模型 |
| P2.3 | API 路由 | POST approve/reject/transfer + GET history | 依赖 P2.2 状态机 |
| P2.4 | 实时通知 | WebSocket 推送 + Email 异步任务 | 依赖 P2.3 API 触发 |

---

## 3. 边界约束

### 3.1 明确范围

```
✓ 支持的审批动作: APPROVE / REJECT / TRANSFER
✓ 状态机状态: PENDING → APPROVED | REJECTED | TRANSFERRED → CLOSED
✓ 通知渠道: WebSocket (实时) + Email (异步)
✓ 转交目标: 仅支持系统内用户选择
✓ 审批历史: 完整持久化，支持查询
✓ 测试覆盖: E2E (Playwright) + Unit (Vitest) + Integration (pytest)
```

### 3.2 明确排除

```
✗ 不会实现: 多级会签审批
✗ 不会实现: 审批时限与自动驳回
✗ 不会实现: 移动端原生通知集成
✗ 不会实现: 审批委托/代理机制
✗ 不会实现: 批量审批操作
```

### 3.3 技术约束

| 约束项 | 限制值 |
|--------|--------|
| 最大转交层级 | 3 层 |
| 单次审批理由最大长度 | 500 字符 |
| WebSocket 重连间隔 | 3s |
| Email 异步队列 | Celery (Redis backend) |

---

## 4. 验收测试基准 (ATB)

### 4.1 变更文件清单

| 文件路径 | 变更类型 | 修改原因 |
|----------|----------|----------|
| `frontend/tests/e2e/approval_history.spec.ts` | 修改 | 验收审批历史时间轴功能 |
| `frontend/tests/e2e/approval.spec.ts` | 修改 | 验收审批操作（审批/驳回/转交） |
| `frontend/src/mocks/workOrderHandlers.ts` | 修改 | Mock 数据适配新状态机 |
| `frontend/tests/unit/retirementService.test.ts` | 修改 | 兼容状态变更通知逻辑 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 修改 | 图表数据源适配审批流数据 |

### 4.2 ATB-1: 审批操作功能测试 (AC-001)

| 测试用例 | 前置条件 | 操作步骤 | 物理期待 |
|----------|----------|----------|----------|
| TC-001 | 存在 PENDING 状态工单 | 点击「审批通过」按钮 | 工单状态变更为 APPROVED，页面刷新展示新状态 |
| TC-002 | 存在 PENDING 状态工单 | 点击「驳回」按钮，输入理由 | 工单状态变更为 REJECTED，驳回理由入库 |
| TC-003 | 存在 PENDING 状态工单 | 点击「转交」→ 选择目标用户 | 工单转移至目标用户，原审批人收到通知 |

```typescript
// frontend/tests/e2e/approval.spec.ts
// TC-001: 审批通过状态流转
test('should transition to APPROVED when approve button clicked', async ({ page }) => {
  const workOrder = await createPendingWorkOrder();
  await page.goto(`/workorders/${workOrder.id}`);
  
  await page.click('[data-testid="btn-approve"]');
  await page.waitForSelector('[data-testid="status-badge"]');
  
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已审批');
  await expect(page.locator('.toast-notification')).toBeVisible();
});
```

### 4.3 ATB-2: 状态机一致性测试 (AC-002)

| 测试用例 | 验证点 |
|----------|--------|
| TC-010 | APPROVED 工单再次调用 approve 返回 409 Conflict |
| TC-011 | REJECTED 工单调用 transfer 返回 422 Unprocessable Entity |
| TC-012 | 非审批人调用审批返回 403 Forbidden |
| TC-013 | 状态变更后 created_at 不变，updated_at 更新 |

```python
# tests/unit/test_workorder_state_machine.py
def test_invalid_transition_rejected_to_transfer():
    """TC-011: 驳回后不可转交"""
    from src.state_machine.work_order_state_machine import WorkOrderStateMachine
    
    sm = WorkOrderStateMachine()
    sm.set_state(WorkOrderState.REJECTED)
    
    with pytest.raises(StateTransitionException) as exc_info:
        sm.transition(WorkOrderState.TRANSFERRED)
    
    assert "invalid_state_transition" in str(exc_info.value)
```

### 4.4 ATB-3: WebSocket 实时通知测试 (AC-004)

| 测试用例 | 验证点 |
|----------|--------|
| TC-020 | 审批通过后，目标连接 2s 内收到 status_update 事件 |
| TC-021 | 转交操作后，原审批人连接收到 transfer_notice 事件 |

```typescript
// frontend/tests/e2e/approval.spec.ts
test('should receive WebSocket notification on status change', async ({ page }) => {
  await page.goto('/workorders/1');
  
  // 验证 WebSocket 连接状态
  await expect(page.locator('.ws-status-indicator')).toHaveClass(/connected/);
  
  // 模拟外部审批操作
  await simulateExternalApproval(1);
  
  // 验证实时更新
  await expect(page.locator('.toast-notification')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已审批');
});
```

### 4.5 ATB-4: Email 异步通知测试 (AC-004)

| 测试用例 | 验证点 |
|----------|--------|
| TC-030 | 审批完成后，邮件队列产生一条记录 |
| TC-031 | 转交邮件包含原审批人、操作时间、转交原因 |

```python
# tests/test_service_integration.py
@celery_app.task
def test_email_queue_produced():
    """TC-030: Email 任务入队"""
    from src.services.notification_service import NotificationService
    
    service = NotificationService()
    service.send_approval_notification(
        work_order_id=1,
        action='APPROVED',
        operator_id=1
    )
    
    # 验证邮件任务入队
    assert EmailQueue.objects.filter(
        work_order_id=1,
        template='status_notification'
    ).exists()
```

### 4.6 ATB-5: 审批历史查询测试 (AC-003)

| 测试用例 | 验证点 |
|----------|--------|
| TC-040 | GET /workorders/{id}/history 返回完整审批链 |
| TC-041 | 历史记录包含操作人、时间戳、动作类型、备注 |

```typescript
// frontend/tests/e2e/approval_history.spec.ts
test('should display complete approval history timeline', async ({ page }) => {
  const workOrder = await createWorkOrderWithHistory();
  await page.goto(`/workorders/${workOrder.id}/history`);
  
  // 验证时间轴节点数量
  const timelineNodes = page.locator('.timeline-node');
  await expect(timelineNodes).toHaveCount(3); // submit -> approve -> closed
  
  // 验证节点内容
  await expect(page.locator('.timeline-node').first()).toContainText('提交工单');
  await expect(page.locator('.timeline-node').nth(1)).toContainText('审批通过');
});
```

---

## 5. 验收标准 (AC) 对应实现策略

### 5.1 AC-001: 功能验收

**验证方法**: Integration Testing

**关键路径**:
```
User Login → Select WorkOrder → Click Approve → Verify Status Change → Verify Notification
```

**Pass Criteria**: 端到端流程无断点，所有状态转换符合状态机定义

### 5.2 AC-002: AST 静态检查 (Critical)

**验证方法**: Static Analysis

**实现要求**:
- 所有修改的 `.ts` 文件必须通过 TypeScript AST 解析
- 所有修改的 `.py` 文件必须通过 Python AST 解析
- 无语法错误，无未闭合的括号/引号

**Pass Criteria**: 
```bash
# TypeScript AST Check
npx tsc --noEmit --pretty

# Python AST Check  
python3 -m py_compile src/**/*.py
```

### 5.3 AC-003: Docstring 文档注释

**验证方法**: Static Analysis

**实现要求**:
- 所有 exported 函数必须包含 JSDoc/TSDoc 注释
- 所有类必须包含类级别 docstring
- 注释需包含: `@description`, `@param`, `@returns`

**Pass Criteria**: 
```bash
# Docstring Coverage Check
python3 tests/test_docstring_coverage.py --min-coverage 80%
```

### 5.4 AC-004: Import 正常 (Critical)

**验证方法**: Unit Testing

**实现要求**:
- 修改后的模块必须能正常被 import
- 无循环依赖引入
- Mock handlers 与实际模块接口兼容

**Pass Criteria**: 
```bash
# Import Check
python3 tests/test_ac_004.py
# 或
cd frontend && npm run type-check
```

---

## 6. 开发切入层级序列

### Layer 1: 数据模型层 (Day 1)

```
src/models/workorder.py          # 工单表 + status 字段 (已存在)
src/models/approval_node.py      # 审批节点表
src/models/status_history.py     # 状态历史表 (已存在)
```

**依赖关系**: 无前置依赖，优先完成

**关键代码**:
```python
class WorkOrderStatus(Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    TRANSFERRED = "TRANSFERRED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
```

### Layer 2: 状态机引擎 (Day 1-2)

```
src/state_machine/work_order_state_machine.py  # 状态流转规则引擎
src/schemas/approval.py                         # Pydantic 请求/响应模型
```

**依赖关系**: 依赖 Layer 1 数据模型

### Layer 3: API 路由层 (Day 2-3)

```
src/api/routes/work_orders.py         # POST approve/reject/transfer
src/api/routes/approval_history.py   # GET history
```

**依赖关系**: 依赖 Layer 2 状态机 + Layer 1 模型

### Layer 4: 前端审批UI (Day 3-4)

```
frontend/src/app/components/approval/
├── ApprovalActions.vue          # 审批/驳回/转交按钮组
├── ApprovalHistory.vue          # 审批时间轴
└── TransferModal.vue            # 转交用户选择弹窗
```

**依赖关系**: 依赖 Layer 3 API 完成接口对接

### Layer 5: 通知服务 (Day 4-5)

```
src/services/notification_service.py  # 通知编排层
src/notifications/
├── websocket_handler.py              # WebSocket 连接管理
└── tasks/email_notification.py       # Celery Email 异步任务
```

**依赖关系**: 依赖 Layer 3 API 触发通知

### Layer 6: 集成测试 (Day 5-6)

```
tests/
├── test_workorder_state_machine.py
├── test_workorder_api.py
├── test_websocket_e2e.py
└── test_email_task.py
```

**依赖关系**: 依赖全部 Layer 交付物

---

## 7. 关键依赖与数据流

### 7.1 核心服务依赖图

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vue)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ApprovalPage │  │HistoryTimeline│  │ TransferModal   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼──────────────────┼─────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ POST /api/v1/workorders/{id}/approve                 │   │
│  │ POST /api/v1/workorders/{id}/reject                  │   │
│  │ POST /api/v1/workorders/{id}/transfer                │   │
│  │ GET  /api/v1/workorders/{id}/history                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Application Services                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Approval    │  │Notification │  │ WorkOrder           │  │
│  │ Service     │  │ Service     │  │ Service             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼──────────────────┼─────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│              State Machine Engine                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ WorkOrderStateMachine                               │     │
│  │ - validate_transition()                             │     │
│  │ - execute_transition()                             │     │
│  │ - emit_event()                                     │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 通知数据流

```
审批操作 → ApprovalService.approve()
         │
         ├──► WorkOrderStateMachine.transition()
         │         │
         │         └──► StatusHistoryService.record()
         │
         ├──► NotificationService.send()
         │         │
         │         ├──► [同步] WebSocket.push()
         │         │
         │         └──► [异步] EmailTask.delay()
         │
         └──► EventPublisher.publish(WorkOrderStatusChangedEvent)
```

---

## 8. 测试策略

### 8.1 测试金字塔

```
                    ┌───────────┐
                    │   E2E     │  ← 3 个测试 (approval.spec.ts)
                    │  Tests    │
                   ┌┴───────────┴┐
                   │ Integration │  ← 5 个测试 (test_workorder_api.py)
                   │   Tests     │
                  ┌┴─────────────┴┐
                  │    Unit      │  ← 10 个测试 (state_machine, service)
                  │   Tests      │
                 ┌┴──────────────┴┐
                 │    Static      │  ← AST, Docstring 检查
                 │   Analysis     │
                 └────────────────┘
```

### 8.2 测试执行顺序

```bash
# 1. 静态分析 (快速失败)
python3 tests/test_ast_analyzer.py
python3 tests/test_docstring_coverage.py

# 2. 单元测试
pytest tests/unit/test_workorder_state_machine.py -v

# 3. 集成测试
pytest tests/integration/test_workorder_api.py -v

# 4. 前端单元测试
cd frontend && npm run test:unit

# 5. E2E 测试 (最后执行)
cd frontend && npm run test:e2e
```

### 8.3 Mock 数据策略

**文件**: `frontend/src/mocks/workOrderHandlers.ts`

```typescript
// 关键 Mock 函数
export function setCurrentUser(userId: string): void {
  /**
   * 设置当前用户（用于测试不同权限场景）
   * @param userId - 用户ID
   */
  currentUserId = userId;
}

export function getCurrentUser(): string {
  /**
   * 获取当前用户
   * @returns 当前登录用户ID
   */
  return currentUserId;
}

export function getValidTransitions(): Record<WorkOrderStatus, WorkOrderStatus[]> {
  /**
   * 获取工单状态转换规则
   * @returns 状态到可转换状态的映射
   */
  return { ...VALID_TRANSITIONS };
}
```

---

## 9. 附录

### 9.1 API 接口契约

| 方法 | 路径 | 请求体 | 响应状态 |
|------|------|--------|----------|
| POST | `/api/v1/workorders/{id}/approve` | `{operator_id: number}` | 200 / 409 / 403 |
| POST | `/api/v1/workorders/{id}/reject` | `{operator_id: number, reason: string}` | 200 / 422 |
| POST | `/api/v1/workorders/{id}/transfer` | `{operator_id: number, target_user_id: number, reason: string}` | 200 / 422 |
| GET | `/api/v1/workorders/{id}/history` | - | 200 |

### 9.2 状态流转图

```
                    ┌─────────────┐
                    │   PENDING   │ ←── 工单提交
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  APPROVED   │ │  REJECTED   │ │ TRANSFERRED │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │               │               │
           ▼               ▼               ▼
    ┌─────────────────────────────────────────────┐
    │                  CLOSED                     │
    └─────────────────────────────────────────────┘
```

### 9.3 错误码定义

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| `INVALID_STATE_TRANSITION` | 422 | 状态机不允许的转换 |
| `ALREADY_PROCESSED` | 409 | 工单已处理，无法重复操作 |
| `PERMISSION_DENIED` | 403 | 当前用户无审批权限 |
| `WORKORDER_NOT_FOUND` | 404 | 工单不存在 |

---

## 10. 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2024 | 1.0 | 初始版本 | System |