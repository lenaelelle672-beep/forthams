# 工单审批流程 Specifications

> **版本**: v1.0  
> **创建日期**: 2024  
> **适用范围**: SWARM-001 工单审批流程迭代实施

---

## 1. 需求与背景

### 1.1 业务场景

工单审批是企业运维/客服系统的核心链路。当用户提交工单后，需经过运维/客服/管理员等多角色依次审批才能流转至终态。当前系统缺失审批闭环能力，导致：

- **审批节点分散**：审批动作依赖于线下沟通，流程不透明
- **状态变更滞后**：申请人无法实时知晓工单处理进度
- **审批动作无追溯**：缺乏完整的审计日志，无法满足合规要求

### 1.2 用户价值

| 角色 | 收益 |
|------|------|
| 申请人 | 实时知晓工单处理进度，减少重复催促 |
| 审批人 | 在统一界面完成审批操作，减少跨系统切换 |
| 管理员 | 全链路审计追溯，满足合规审计需求 |

### 1.3 核心功能清单

| 功能点 | 描述 |
|--------|------|
| 审批通过 | 审批人确认工单内容，流转至下一节点或终态 |
| 审批驳回 | 审批人拒绝工单，填写驳回理由，申请人修改后重新提交 |
| 审批转交 | 审批人将工单转交给其他用户处理 |
| 审批历史 | 完整记录所有审批动作的时间、操作人、结果 |
| 实时通知 | WebSocket 推送审批状态变更 |
| Email 通知 | 异步发送邮件通知相关人员 |

---

## 2. 当前 Phase 对应实施目标

**参照 Plan.md Phase 拆解：Phase 2 - 审批流程核心实现**

### 2.1 目标层级映射

| 目标编号 | 具体交付物 | 状态 |
|----------|------------|------|
| P2.1 | 前端审批UI：审批/驳回/转交三按钮 + 审批历史时间轴 | 待实现 |
| P2.2 | 后端状态机：7状态流转引擎 + 状态变更持久化 | 待实现 |
| P2.3 | 实时通知：WebSocket 推送 + Email 异步发送 | 待实现 |

### 2.2 数据模型依赖

```
┌─────────────────────────────────────────────────────────┐
│                    待修改文件清单                        │
├─────────────────────────────────────────────────────────┤
│ frontend/tests/e2e/approval_history.spec.ts             │
│ frontend/tests/e2e/approval.spec.ts                     │
│ frontend/src/mocks/workOrderHandlers.ts                  │
│ frontend/tests/unit/retirementService.test.ts            │
│ frontend/src/app/pages/OperationLogDashboard/           │
│               components/TrendChart.tsx                 │
└─────────────────────────────────────────────────────────┘
```

### 2.3 核心服务组件

| 服务组件 | 职责 | 待修改文件 |
|----------|------|------------|
| `ApprovalService` | 审批操作编排 | `src/services/approval_service.ts` |
| `NotificationService` | 通知发送编排 | `src/services/notification_service.ts` |
| `RetirementService` | 报废审批流程 | `src/services/retirement_service.ts` |
| `StatusHistoryService` | 状态历史记录 | `src/services/status_history_service.ts` |
| `ApprovalChainService` | 审批链管理 | `src/services/approval_chain_service.ts` |

---

## 3. 边界约束

### 3.1 明确范围

```
✓ 支持的审批动作: APPROVE / REJECT / TRANSFER
✓ 状态机状态: PENDING → APPROVED | REJECTED | TRANSFERRED → CLOSED
✓ 通知渠道: WebSocket (实时) + Email (异步)
✓ 转交目标: 仅支持系统内用户选择
✓ 审批历史: 完整持久化，支持查询
✓ 幂等性: 重复审批返回 409 Conflict
✓ 权限校验: 仅审批人可执行审批操作
```

### 3.2 明确排除

```
✗ 不会实现: 多级会签审批（同一节点多人同时审批）
✗ 不会实现: 审批时限与自动驳回（超时自动处理）
✗ 不会实现: 移动端原生通知集成（APNs / FCM）
✗ 不会实现: 审批委托/代理机制（长期委托他人审批）
✗ 不会实现: 条件审批规则引擎（基于规则的自动审批）
```

### 3.3 技术约束

| 约束项 | 说明 |
|--------|------|
| WebSocket 重连 | 断线自动重连，最多重试 5 次 |
| Email 异步队列 | 使用 Celery 任务队列，失败重试 3 次 |
| 状态机原子性 | 状态变更使用数据库事务保证一致性 |
| API 响应时间 | 审批操作 < 500ms（不含通知发送） |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 审批操作功能测试

| 测试用例 | 前置条件 | 操作步骤 | 物理期待 |
|----------|----------|----------|----------|
| TC-001 | 存在 PENDING 状态工单 | 点击「审批通过」按钮 | 工单状态变更为 APPROVED，页面刷新展示新状态 |
| TC-002 | 存在 PENDING 状态工单 | 点击「驳回」按钮，输入理由 | 工单状态变更为 REJECTED，驳回理由入库 |
| TC-003 | 存在 PENDING 状态工单 | 点击「转交」→ 选择目标用户 | 工单转移至目标用户，原审批人收到通知 |

```typescript
// TC-001: 审批通过状态流转
describe('Approval Workflow', () => {
  it('should transition to APPROVED on approve action', async ({ page }) => {
    // Arrange: Navigate to pending work order
    await page.goto(`/workorders/${pendingWorkOrderId}`);
    await expect(page.locator('.status-badge')).toHaveText('待审批');
    
    // Act: Click approve button
    await page.click('[data-testid="approve-btn"]');
    await page.fill('[data-testid="approval-comment"]', '审批通过');
    await page.click('[data-testid="confirm-approve"]');
    
    // Assert: Status transitions to APPROVED
    await expect(page.locator('.status-badge')).toHaveText('已审批');
    await expect(page.locator('.toast-success')).toBeVisible();
  });
});
```

### 4.2 ATB-2: 状态机一致性测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-010 | APPROVED 工单再次调用 approve 返回 409 Conflict |
| TC-011 | REJECTED 工单调用 transfer 返回 422 Unprocessable Entity |
| TC-012 | 非审批人调用审批返回 403 Forbidden |
| TC-013 | 状态变更后 created_at 不变，updated_at 更新 |

```typescript
// TC-011: 驳回后不可转交（状态机非法转换）
describe('State Machine Transitions', () => {
  it('should reject transfer on REJECTED work order', async () => {
    // Arrange: Work order in REJECTED state
    const rejectedOrder = await createRejectedWorkOrder();
    
    // Act & Assert: Attempting transfer should fail
    const response = await api.post(
      `/api/v1/workorders/${rejectedOrder.id}/transfer`,
      { target_user_id: 2, operator_id: 1 }
    );
    
    expect(response.status).toBe(422);
    expect(response.json().error.code).toBe('invalid_state_transition');
  });
});
```

### 4.3 ATB-3: WebSocket 实时通知测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-020 | 审批通过后，目标连接 2s 内收到 status_update 事件 |
| TC-021 | 转交操作后，原审批人连接收到 transfer_notice 事件 |

```typescript
// TC-020: WebSocket 实时推送验证
describe('WebSocket Notifications', () => {
  it('should receive real-time update within 2 seconds', async ({ page }) => {
    // Arrange: Connect WebSocket and navigate to work order
    await page.goto(`/workorders/${workOrderId}`);
    await page.waitForSelector('.ws-status-indicator.connected');
    
    // Act: Simulate approval from another session
    await simulateExternalApproval(workOrderId);
    
    // Assert: UI updates automatically
    await expect(page.locator('.status-badge')).toHaveText('已审批');
    await expect(page.locator('.toast-notification')).toBeVisible();
  });
});
```

### 4.4 ATB-4: Email 异步通知测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-030 | 审批完成后，邮件队列产生一条记录 |
| TC-031 | 转交邮件包含原审批人、操作时间、转交原因 |

```typescript
// TC-030: Email 任务入队验证
describe('Email Notifications', () => {
  it('should enqueue email task after approval', async () => {
    // Act: Approve work order
    await approvalService.approve(workOrderId, operatorId);
    
    // Assert: Email task exists in queue
    const emailTask = await emailQueueRepository.findOne({
      workOrderId,
      template: 'status_notification'
    });
    expect(emailTask).toBeDefined();
    expect(emailTask.recipients).toContain(APPLICANT_EMAIL);
  });
});
```

### 4.5 ATB-5: 审批历史查询测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-040 | GET /workorders/{id}/history 返回完整审批链 |
| TC-041 | 历史记录包含操作人、时间戳、动作类型、备注 |

```typescript
// TC-041: 审批历史完整性验证
describe('Approval History', () => {
  it('should return complete audit trail', async () => {
    const history = await api.get(`/api/v1/workorders/${workOrderId}/history`);
    
    expect(history.data).toHaveLength(3);
    expect(history.data[0]).toMatchObject({
      action: 'SUBMIT',
      operator: 'applicant@example.com',
      timestamp: expect.toBeValidDate(),
      comment: null
    });
    expect(history.data[1]).toMatchObject({
      action: 'APPROVE',
      operator: 'approver@example.com',
      timestamp: expect.toBeValidDate(),
      comment: '审批通过'
    });
  });
});
```

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌─────────────────────────────────────────────────────────────┐
│                        Layer 6                              │
│                   Integration Tests                          │
│         tests/test_approval_api.ts                          │
│         tests/test_websocket_e2e.ts                         │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                        Layer 5                              │
│                   Notification Services                     │
│         src/services/websocket_manager.ts                   │
│         src/services/email_notification.ts                  │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                        Layer 4                              │
│                    Frontend Approval UI                      │
│         src/components/ApprovalActions.vue                  │
│         src/components/ApprovalHistory.vue                  │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                        Layer 3                              │
│                      API Routes                              │
│         src/api/v1/endpoints/approval.py                    │
│         src/api/v1/endpoints/history.py                     │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                        Layer 2                              │
│                    State Machine Engine                      │
│         src/services/state_machine.ts                       │
│         src/schemas/approval.ts                             │
└─────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────┐
│                        Layer 1                              │
│                      Data Models                             │
│         src/models/work_order.py                            │
│         src/models/approval_node.py                         │
│         src/models/approval_history.py                      │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 详细层级说明

#### Layer 1: 数据模型层 (Day 1)

**核心文件**:
```
src/models/
├── work_order.py              # 工单表 + status 字段
├── approval_node.py           # 审批节点表（当前修改文件）
├── approval_history.py        # 审批历史表
└── user.py                    # 用户表（已有，扩展通知偏好）
```

**依赖关系**: 无前置依赖，优先完成

**修改要点** (针对 approval_node.py):
- 新增 `ApprovalNode` 模型类
- 定义节点状态枚举: `PENDING / APPROVED / REJECTED / TRANSFERRED`
- 添加 `work_order_id`、`assigned_to`、`deadline`、`created_at`、`updated_at` 字段

#### Layer 2: 状态机引擎 (Day 1-2)

**核心文件**:
```
src/services/state_machine.py   # 状态流转规则引擎
src/schemas/approval.py         # Pydantic 请求/响应模型
```

**依赖关系**: 依赖 Layer 1 数据模型

**状态流转规则**:
```python
VALID_TRANSITIONS = {
    'PENDING': ['APPROVED', 'REJECTED', 'TRANSFERRED'],
    'APPROVED': ['CLOSED'],
    'REJECTED': ['PENDING'],  # 申请人修改后重新提交
    'TRANSFERRED': ['APPROVED', 'REJECTED'],
    'CLOSED': []  # 终态，不可流转
}
```

#### Layer 3: API 路由层 (Day 2-3)

**核心文件**:
```
src/api/v1/endpoints/approval.py  # POST approve/reject/transfer
src/api/v1/endpoints/history.py   # GET history
```

**依赖关系**: 依赖 Layer 2 状态机 + Layer 1 模型

**API 接口契约**:

| 方法 | 路径 | 请求体 | 响应状态 |
|------|------|--------|----------|
| POST | `/api/v1/workorders/{id}/approve` | `{operator_id}` | 200 / 409 / 403 |
| POST | `/api/v1/workorders/{id}/reject` | `{operator_id, reason}` | 200 / 422 |
| POST | `/api/v1/workorders/{id}/transfer` | `{operator_id, target_user_id, reason}` | 200 / 422 |
| GET | `/api/v1/workorders/{id}/history` | - | 200 |

#### Layer 4: 前端审批UI (Day 3-4)

**核心文件**:
```
src/frontend/components/
├── ApprovalActions.vue          # 审批/驳回/转交按钮组
├── ApprovalHistory.vue          # 审批时间轴
└── TransferModal.vue            # 转交用户选择弹窗
```

**依赖关系**: 依赖 Layer 3 API 完成接口对接

#### Layer 5: 通知服务 (Day 4-5)

**核心文件**:
```
src/services/
├── websocket_manager.py     # WebSocket 连接管理
├── notification_service.py  # 通知编排层
└── tasks/
    └── email_notification.py # Celery Email 异步任务
```

**依赖关系**: 依赖 Layer 3 API 触发通知

#### Layer 6: 集成测试 (Day 5-6)

**核心文件**:
```
tests/
├── test_state_machine.py
├── test_approval_api.py
├── test_websocket_e2e.py
└── test_email_task.py
```

**依赖关系**: 依赖全部 Layer 交付物

---

## 附录

### A. AC 验收标准核对清单

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | 实现工单审批流程核心功能 | 集成测试 | 待验证 |
| AC-002 | 代码变更不引入语法错误 | AST 静态检查 | 待验证 |
| AC-003 | 所有修改函数包含 docstring | 静态分析 | 待验证 |
| AC-004 | 模块可正常 import | 单元测试 | 待验证 |

### B. 相关文档链接

| 文档 | 路径 |
|------|------|
| 测试模板 | `docs/testing/templates/E2ETestTemplate.spec.ts` |
| API 路由 | `src/api/routes/work_orders.py` |
| 状态机实现 | `backend/src/main/java/com/ams/state/WorkOrderStateMachine.java` |
| 审批服务 | `backend/src/main/java/com/ams/service/ApprovalService.java` |

### C. 修改文件清单

根据 SWARM-001 迭代要求，以下文件需要修改：

1. `frontend/tests/e2e/approval_history.spec.ts` - 审批历史 E2E 测试
2. `frontend/tests/e2e/approval.spec.ts` - 审批操作 E2E 测试
3. `frontend/src/mocks/workOrderHandlers.ts` - Mock 数据处理器
4. `frontend/tests/unit/retirementService.test.ts` - 报废服务单元测试
5. `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` - 趋势图表组件

---

**文档结束**