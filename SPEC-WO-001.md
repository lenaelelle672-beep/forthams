# 工单审批流程系统规格指导文档

**文档编号**: SPEC-WO-001  
**版本**: v1.0  
**迭代标识**: SWARM-001 Iteration 1

---

## 1. 需求与背景

### 1.1 业务需求描述

构建工单审批流程系统，实现以下核心能力：

1. **工单提交**: 用户通过前端界面提交工单审批请求，系统持久化工单数据并初始化审批状态
2. **状态机流转**: 后端根据预定义规则驱动工单状态转换，覆盖从提交至终态的完整生命周期
3. **通知提醒**: 审批状态变更时，通过通知机制异步推送提醒至对应审批人

### 1.2 技术上下文

- 后端采用 Python/FastAPI 框架（参考 `src/api/routers/workorder_router.py`, `src/application/services/work_order_service.py`）
- 前端为 TypeScript SPA 应用（Vue/React），通过 REST API 交互
- 通知服务支持多渠道（参考 `src/application/services/notification_service.py`, `src/notifications/events.py`）
- 状态机核心引擎位于 `src/state_machine/approval_state_machine.py`

### 1.3 当前迭代范围

本次迭代为 **SWARM-001 Iteration 1**，聚焦以下交付物：

| 交付物文件 | 说明 |
|-----------|------|
| `frontend/tests/unit/workorder_api.test.ts` | 工单 API 单元测试 |
| `frontend/tests/e2e/workorder_list.spec.ts` | 工单列表端到端测试 |
| `frontend/tests/e2e/approval.spec.ts` | 审批流程端到端测试 |
| `frontend/src/stores/approvalStore.test.ts` | 审批状态管理测试 |
| `frontend/src/api/workorder.ts` | 工单 API 接口封装 |

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 核心状态机与数据模型

| 子目标 | 交付物 | 验收标准 |
|--------|--------|----------|
| T1.1 工单数据模型 | Ticket Model + Migration (`src/models/ticket.py`) | 创建/读取/更新工单，数据库操作无异常 |
| T1.2 状态机核心引擎 | StateMachine Service (`src/state_machine/approval_state_machine.py`) | 指定状态流转合法、非法流转被拒绝 |
| T1.3 审批人分配逻辑 | ApprovalAssignment Service (`src/services/approval_service.py`) | 工单提交后自动/手动分配审批人 |
| T1.4 通知触发机制 | NotificationTrigger (`src/application/services/notification_service.py`) | 状态变更时触发通知事件（可配置开关） |

### 排除范围（后续迭代）

- 条件分支审批（多级审批）
- 审批委托/转交
- 审批时限与超时自动处理
- 前端可视化审批流设计器

---

## 3. 边界约束

### 3.1 功能性约束

| 约束编号 | 约束描述 | 违规处理 |
|----------|----------|----------|
| C-01 | 工单状态流转必须遵循预定义状态图，不得跳过中间状态 | 抛出 `InvalidStateTransitionError` |
| C-02 | 同一工单并发状态变更必须串行化，禁止脏写 | 使用数据库行级锁或乐观锁（参考 `src/api/middleware/idempotency_check.py`） |
| C-03 | 通知发送失败不得阻塞主业务事务 | 通知入队至消息队列，异步投递（`src/infrastructure/messaging/publisher.py`） |
| C-04 | 审批人不得审批自己提交的工单 | 校验 `submitter_id != approver_id`，返回 403 |
| C-05 | 终态（APPROVED/REJECTED）工单禁止再次流转 | 终态检测并拒绝操作，返回 409 |

### 3.2 非功能性约束

| 约束编号 | 约束描述 |
|----------|----------|
| P-01 | 工单状态变更 API 响应时间 ≤ 200ms（P99） |
| P-02 | 通知投递延迟 ≤ 5s（在消息队列正常情况下） |
| P-03 | 系统需支持单节点 100 TPS 的状态变更请求 |

### 3.3 状态机状态定义

```
DRAFT → PENDING → APPROVED → CLOSED
              ↓
          REJECTED → (可重新打开至 PENDING)
```

| 状态 | 描述 | 可执行动作 |
|------|------|-----------|
| DRAFT | 草稿状态（可选） | submit → PENDING |
| PENDING | 待审批 | approve → APPROVED, reject → REJECTED |
| APPROVED | 已批准 | close → CLOSED |
| REJECTED | 已拒绝 | reopen → PENDING |
| CLOSED | 已关闭（终态） | - |

---

## 4. 验收测试基准 (ATB)

### ATB-1: 工单生命周期测试

**测试文件**: `frontend/tests/unit/workorder_api.test.ts`

```typescript
// ATB-1: 验证工单从创建到终态的完整生命周期

describe('WorkOrder Lifecycle', () => {
  /**
   * 步骤1: 提交工单 → 状态应为 PENDING
   * 测试点: POST /api/workorders 创建工单
   * 预期: 返回 201, status = "PENDING"
   */
  it('should create workorder with PENDING status', async () => {
    const response = await workorderApi.create({
      title: '采购申请-测试',
      content: '需采购办公设备',
      type: 'PURCHASE'
    });
    expect(response.status).toBe(201);
    expect(response.data.status).toBe('PENDING');
  });

  /**
   * 步骤2: 审批通过 → 状态流转至 APPROVED
   * 测试点: POST /api/workorders/:id/approve
   * 预期: 返回 200, status = "APPROVED"
   */
  it('should transition to APPROVED after approval', async () => {
    const ticket = await createTestTicket();
    const response = await workorderApi.approve(ticket.id, {
      comment: '同意采购'
    });
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('APPROVED');
  });

  /**
   * 步骤3: 审批拒绝 → 状态流转至 REJECTED
   * 测试点: POST /api/workorders/:id/reject
   * 预期: 返回 200, status = "REJECTED"
   */
  it('should transition to REJECTED after rejection', async () => {
    const ticket = await createTestTicket();
    const response = await workorderApi.reject(ticket.id, {
      comment: '预算超支'
    });
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('REJECTED');
  });

  /**
   * 步骤4: 终态工单禁止再次流转
   * 测试点: 状态为 APPROVED 的工单再次调用 approve 接口
   * 预期: 返回 409 Conflict
   */
  it('should reject transition from terminal state', async () => {
    const ticket = await createApprovedTicket();
    const response = await workorderApi.approve(ticket.id, {});
    expect(response.status).toBe(409);
    expect(response.data.error_code).toBe('ALREADY_PROCESSED');
  });
});
```

### ATB-2: 状态机合法性校验测试

**测试文件**: `frontend/tests/unit/workorder_api.test.ts`

```typescript
// ATB-2: 验证状态机流转规则的合法性

describe('State Machine Rules', () => {
  const validTransitions = [
    { from: 'PENDING', action: 'approve', expected: 'APPROVED' },
    { from: 'PENDING', action: 'reject', expected: 'REJECTED' },
    { from: 'APPROVED', action: 'close', expected: 'CLOSED' },
    { from: 'REJECTED', action: 'reopen', expected: 'PENDING' },
  ];

  /**
   * 步骤5: 合法状态流转应成功
   * 测试点: 各种合法状态组合
   * 预期: 每种组合返回 200，状态正确更新
   */
  validTransitions.forEach(({ from, action, expected }) => {
    it(`should allow ${from} → ${action} → ${expected}`, async () => {
      const ticket = await createTicketWithStatus(from);
      const response = await workorderApi[action](ticket.id, {});
      expect(response.status).toBe(200);
      expect(response.data.status).toBe(expected);
    });
  });

  const invalidTransitions = [
    { from: 'PENDING', action: 'close', desc: '跳过审批直接关闭' },
    { from: 'REJECTED', action: 'approve', desc: '拒绝后不能直接批准' },
    { from: 'CLOSED', action: 'reopen', desc: '终态不能重新打开' },
  ];

  /**
   * 步骤6: 非法状态流转应抛出 InvalidStateTransitionError
   * 测试点: 各种非法状态组合
   * 预期: 返回 409，error_code = "INVALID_TRANSITION"
   */
  invalidTransitions.forEach(({ from, action, desc }) => {
    it(`should reject invalid transition: ${desc}`, async () => {
      const ticket = await createTicketWithStatus(from);
      const response = await workorderApi[action](ticket.id, {});
      expect(response.status).toBe(409);
      expect(response.data.error_code).toBe('INVALID_TRANSITION');
    });
  });
});
```

### ATB-3: 审批人约束测试

**测试文件**: `frontend/tests/e2e/approval.spec.ts`

```typescript
// ATB-3: 验证审批人分配与自审批禁止约束

describe('Approval Assignment', () => {
  /**
   * 步骤7: 提交人不能审批自己的工单
   * 测试点: 用户 A 创建工单后尝试自审批
   * 预期: 返回 403, error_code = "SELF_APPROVAL_FORBIDDEN"
   */
  it('should prevent self-approval', async () => {
    // 登录用户 A
    await loginAs('user_a');
    
    // 创建工单
    const ticket = await workorderPage.createTicket({
      title: '自审批测试工单'
    });
    
    // 尝试自审批
    const response = await workorderApi.approve(ticket.id, {});
    expect(response.status).toBe(403);
    expect(response.data.error_code).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  /**
   * 步骤8: 指定审批人可正常审批
   * 测试点: 用户 B（审批人）审批用户 A 的工单
   * 预期: 返回 200, status = "APPROVED"
   */
  it('should allow assigned approver to approve', async () => {
    // 用户 A 创建工单
    await loginAs('user_a');
    const ticket = await workorderPage.createTicket({});
    
    // 用户 B（审批人）审批
    await loginAs('approver_b');
    const response = await workorderApi.approve(ticket.id, {
      comment: '审批通过'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('APPROVED');
  });
});
```

### ATB-4: 通知触发测试

**测试文件**: `frontend/src/stores/approvalStore.test.ts`

```typescript
// ATB-4: 验证状态变更时通知正确触发

describe('Notification Trigger', () => {
  /**
   * 步骤9: 状态变更发布 NotificationEvent
   * 测试点: 工单状态变更为 PENDING 时
   * 预期: EventBus 收到 TICKET_PENDING 事件
   */
  it('should emit notification event on status change', async () => {
    const eventBus = mockEventBus();
    const store = createApprovalStore({ eventBus });
    
    await store.createTicket({
      title: '测试工单',
      assignedApproverId: 'approver_001'
    });
    
    // 验证事件总线收到通知事件
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'TICKET_PENDING',
        payload: expect.objectContaining({
          ticket_id: expect.any(String),
          approver_id: 'approver_001'
        })
      })
    );
  });

  /**
   * 步骤10: 通知发送失败不阻塞主业务
   * 测试点: 模拟通知服务异常
   * 预期: 主业务（工单创建/审批）仍返回 200
   */
  it('should not block main transaction when notification fails', async () => {
    const notificationService = mockNotificationService({
      send: jest.fn().mockRejectedValue(new Error('SMTP timeout'))
    });
    
    const store = createApprovalStore({ notificationService });
    const response = await store.approveTicket('ticket_001', {});
    
    // 主业务仍应成功
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('APPROVED');
  });
});
```

### ATB-5: 并发控制测试

**测试文件**: `frontend/tests/e2e/workorder_list.spec.ts`

```typescript
// ATB-5: 验证并发场景下的状态一致性

describe('Concurrency Control', () => {
  /**
   * 步骤11: 并发审批请求最终状态一致
   * 测试点: 同一工单同时发起 3 个审批请求
   * 预期: 仅 1 个请求成功（200），其余返回 409 Conflict
   */
  it('should serialize concurrent approval requests', async () => {
    const ticket = await createTestTicket();
    const concurrentRequests = 3;
    const results: number[] = [];
    
    // 并发发起请求
    const promises = Array(concurrentRequests).fill(null).map(() =>
      workorderApi.approve(ticket.id, {}).then(r => r.status)
    );
    
    results.push(...(await Promise.all(promises)));
    
    // 验证结果
    expect(results.filter(s => s === 200)).toHaveLength(1);
    expect(results.filter(s => s === 409)).toHaveLength(concurrentRequests - 1);
  });

  /**
   * 步骤12: 幂等性校验
   * 测试点: 同一审批人重复提交相同审批意见
   * 预期: 首次成功，后续返回幂等标识（200 但标注为重复）
   */
  it('should handle idempotent approval requests', async () => {
    const ticket = await createTestTicket();
    
    // 首次审批
    const first = await workorderApi.approve(ticket.id, {
      idempotencyKey: 'unique_key_001'
    });
    expect(first.status).toBe(200);
    
    // 重复请求（相同 idempotency key）
    const second = await workorderApi.approve(ticket.id, {
      idempotencyKey: 'unique_key_001'
    });
    expect(second.status).toBe(200);
    expect(second.data.idempotent).toBe(true);
  });
});
```

### ATB-6: 前端集成测试

**测试文件**: `frontend/tests/e2e/approval.spec.ts`

```typescript
// ATB-6: 前端 UI 集成验收

describe('Approval UI Integration', () => {
  beforeEach(async () => {
    await page.goto('/workorder/list');
  });

  /**
   * 步骤13: 工单列表展示正确状态
   * 测试点: 页面加载工单列表
   * 预期: 每条工单正确显示状态标签（颜色/图标对应）
   */
  it('should display correct status labels', async () => {
    await workorderListPage.waitForLoad();
    
    const statusLabels = await workorderListPage.getStatusLabels();
    expect(statusLabels).toEqual(expect.arrayContaining([
      { status: 'PENDING', label: '待审批', color: '#FFA500' },
      { status: 'APPROVED', label: '已批准', color: '#52C41A' },
      { status: 'REJECTED', label: '已拒绝', color: '#FF4D4F' },
    ]));
  });

  /**
   * 步骤14: 审批操作成功后 UI 状态同步更新
   * 测试点: 点击审批按钮后
   * 预期: 工单状态实时更新，无需刷新页面
   */
  it('should sync UI state after approval action', async () => {
    const ticket = await createTestTicket();
    await workorderListPage.gotoDetail(ticket.id);
    
    // 执行审批
    await approvalPage.clickApproveButton();
    await approvalPage.fillComment('同意');
    await approvalPage.submit();
    
    // 验证 UI 状态更新
    const statusText = await approvalPage.getCurrentStatus();
    expect(statusText).toBe('已批准');
  });
});
```

---

## 5. 开发切入层级序列

### 5.1 层级 L1: 数据持久层

**交付物**: Ticket Model + Database Migration

```
src/
├── models/
│   ├── ticket.py          # Ticket ORM Model (已存在)
│   ├── workorder.py       # WorkOrder Entity
│   └── status_history.py  # 状态变更历史
└── migrations/
    └── xxx_create_workorder_tables.py
```

**依赖关系**: 无前置依赖  
**测试桩**: 直接对数据库 CRUD 验证

---

### 5.2 层级 L2: 状态机引擎层

**交付物**: StateMachine Service + Transition Rules

```
src/
├── state_machine/
│   ├── approval_state_machine.py  # 状态机核心引擎 (已存在)
│   ├── transitions.py             # 状态流转规则
│   └── states.py                   # 状态定义
```

**依赖关系**: 依赖 L1 Ticket Model  
**测试桩**: Mock Model，验证状态机内部逻辑

---

### 5.3 层级 L3: 业务服务层

**交付物**: WorkOrderService + ApprovalService

```
src/
├── application/services/
│   ├── work_order_service.py  # 工单创建/查询聚合服务
│   └── notification_service.py # 通知服务 (已存在)
├── services/
│   ├── approval_service.py     # 审批操作编排服务 (已存在)
│   └── approval_chain_service.py # 审批链服务 (已存在)
```

**依赖关系**: 依赖 L2 StateMachine  
**测试桩**: Mock StateMachine，验证业务编排逻辑

---

### 5.4 层级 L4: API 接口层

**交付物**: REST API Endpoints + Request Validation

```
src/api/
├── routers/
│   ├── workorder_router.py  # /api/workorders/* (已存在)
│   └── approval_router.py   # /api/approvals/* (已存在)
```

**前端交付物**:
```
frontend/src/api/
└── workorder.ts  # 工单 API 接口封装
```

**依赖关系**: 依赖 L3 业务服务  
**测试桩**: 集成测试，使用真实 HTTP Client

---

### 5.5 开发时序图

```
Week 1 ──────────────────────────────────────────
        │
        ├─ L1: 数据模型 + Migration
        │   ├─ ATB-1.1 ~ 1.2 (工单CRUD)
        │   └─ ATB-1.3 ~ 1.4 (状态初始化)
        │
        ├─ L2: 状态机引擎
        │   ├─ ATB-2.1 ~ 2.3 (流转规则)
        │   └─ ATB-2.4 (非法流转拒绝)
        │
        └─ L3: 业务服务编排
            ├─ ATB-3.1 ~ 3.2 (审批人约束)
            └─ ATB-3.3 (并发控制初验)

Week 2 ──────────────────────────────────────────
        │
        ├─ L4: 通知服务 (异步)
        │   ├─ ATB-4.1 (事件触发)
        │   └─ ATB-4.2 (异步不阻塞)
        │
        ├─ L5: API 接口
        │   └─ 端到端集成测试
        │
        └─ ATB-6: 前端 UI 集成验收
```

---

## 6. 附录

### 6.1 错误码定义

| 错误码 | HTTP Status | 说明 |
|--------|-------------|------|
| `INVALID_TRANSITION` | 409 | 非法的状态流转 |
| `SELF_APPROVAL_FORBIDDEN` | 403 | 禁止自审批 |
| `ALREADY_PROCESSED` | 409 | 工单已处理完毕 |
| `CONCURRENT_MODIFICATION` | 409 | 并发修改冲突 |
| `TICKET_NOT_FOUND` | 404 | 工单不存在 |
| `UNAUTHORIZED_APPROVER` | 403 | 非授权审批人 |

### 6.2 API 接口清单

| 接口 | Method | 说明 |
|------|--------|------|
| `/api/workorders` | POST | 创建工单 |
| `/api/workorders` | GET | 查询工单列表 |
| `/api/workorders/:id` | GET | 获取工单详情 |
| `/api/workorders/:id/approve` | POST | 审批通过 |
| `/api/workorders/:id/reject` | POST | 审批拒绝 |
| `/api/workorders/:id/reopen` | POST | 重新打开工单 |
| `/api/workorders/:id/close` | POST | 关闭工单 |
| `/api/workorders/:id/history` | GET | 获取状态变更历史 |

### 6.3 事件类型定义

| 事件类型 | 触发时机 | 通知对象 |
|----------|----------|----------|
| `TICKET_CREATED` | 工单创建 | 审批人 |
| `TICKET_PENDING` | 工单提交待审批 | 审批人 |
| `TICKET_APPROVED` | 工单已批准 | 申请人 |
| `TICKET_REJECTED` | 工单已拒绝 | 申请人 |
| `TICKET_CLOSED` | 工单已关闭 | 申请人 |

---

## 7. 修改文件清单

根据 SWARM-001 迭代要求，以下文件需要修改：

| 序号 | 文件路径 | 修改内容 |
|------|----------|----------|
| 1 | `frontend/tests/unit/workorder_api.test.ts` | 新增 ATB-1, ATB-2 测试用例 |
| 2 | `frontend/tests/e2e/workorder_list.spec.ts` | 新增 ATB-5 并发测试用例 |
| 3 | `frontend/tests/e2e/approval.spec.ts` | 新增 ATB-3, ATB-6 测试用例 |
| 4 | `frontend/src/stores/approvalStore.test.ts` | 新增 ATB-4 通知触发测试 |
| 5 | `frontend/src/api/workorder.ts` | 完善工单 API 接口封装 |

---

*文档生成时间: 2025-01-15*
*最后更新: v1.0 - Initial Release*