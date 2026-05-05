# SWARM-501 工单审批流程系统 Specifications

## 需求与背景

### 业务目标
实现完整的工单审批流程系统，支持工单状态机驱动和多级审批链管理。审批人可在前端页面完成审批操作（通过/驳回/转交）。

### 核心功能
| 功能模块 | 描述 |
|---------|------|
| WorkOrderStateMachine | 工单状态流转控制引擎 |
| ApprovalChain | 审批链配置，支持多级审批人顺序/并行审批 |
| 审批操作 API | 提交审批、通过、驳回、转交、退回 |
| 审批管理页面 | 审批列表 + 审批详情 + 审批操作组件 |

### 技术栈约束
- **后端**：Python/FastAPI 或 Node.js/Express（按现有项目约定）
- **前端**：React + TypeScript + Ant Design
- **数据库**：PostgreSQL + Redis（缓存）
- **状态机**：XState 或自研状态机框架

---

## 当前 Phase 对应实施目标

### Phase 1 - 核心工单审批系统 MVP

本次 Iteration 1 聚焦于以下交付物：

| 功能模块 | 交付内容 | 优先级 |
|---------|---------|--------|
| 状态机引擎 | WorkOrderStateMachine 核心逻辑实现 | P0 |
| 审批链模型 | ApprovalChain 数据结构 + CRUD API | P0 |
| 审批操作 API | 提交审批、审批通过、审批驳回、转交 | P0 |
| 审批管理页面 | 审批列表 + 审批详情 + 审批操作组件 | P0 |
| 审批历史记录 | 所有操作记录审计日志 | P1 |

### 里程碑定义

- ✅ 工单可从任意合法状态流转到下一状态
- ✅ 审批链可配置（支持并行/串行审批节点）
- ✅ 审批人可看到待审批工单列表
- ✅ 审批人可执行通过/驳回/转交操作
- ✅ 所有操作记录审计日志

---

## 边界约束

### 明确包含
- ✅ 工单状态机定义与状态流转规则
- ✅ 审批链配置管理（审批节点、审批人、审批顺序）
- ✅ 审批操作 API（提交、通过、驳回、转交、退回）
- ✅ 审批历史记录与审计日志
- ✅ 前端审批列表页 + 审批详情页
- ✅ 审批通知机制（站内信/邮件，可选）

### 明确不包含
- ❌ 工单创建/编辑功能（由其他迭代负责）
- ❌ 工单抄送/知会功能
- ❌ 审批条件表达式引擎（复杂条件配置）
- ❌ 移动端审批页面
- ❌ 审批超时自动处理
- ❌ 批量审批操作
- ❌ 审批流程设计器（可视化配置）

---

## 验收测试基准 (ATB)

### ATB-1：状态机核心逻辑测试

**测试框架**：pytest

```python
# tests/unit/test_workorder_state_machine.py

def test_state_machine_initial_state():
    """工单初始状态应为 DRAFT（草稿）"""
    wo = WorkOrder()
    sm = WorkOrderStateMachine(wo)
    assert sm.current_state == WorkOrderState.DRAFT

def test_submit_triggers_approval():
    """提交操作将工单状态从 DRAFT 流转到 PENDING_APPROVAL"""
    wo = WorkOrder(id="WO-001")
    sm = WorkOrderStateMachine(wo)
    sm.submit()
    assert sm.current_state == WorkOrderState.PENDING_APPROVAL

def test_approve_completes_workflow():
    """审批通过将工单状态从 APPROVAL_IN_PROGRESS 流转到 APPROVED"""
    wo = WorkOrder(id="WO-001", state=WorkOrderState.APPROVAL_IN_PROGRESS)
    sm = WorkOrderStateMachine(wo)
    result = sm.approve(approver_id="user-001")
    assert sm.current_state == WorkOrderState.APPROVED
    assert result.success == True

def test_reject_transitions_to_rejected():
    """审批驳回将工单状态流转到 REJECTED"""
    wo = WorkOrder(id="WO-001", state=WorkOrderState.APPROVAL_IN_PROGRESS)
    sm = WorkOrderStateMachine(wo)
    result = sm.reject(approver_id="user-001", reason="材料不全")
    assert sm.current_state == WorkOrderState.REJECTED

def test_invalid_transition_raises_error():
    """非法状态流转应抛出 InvalidTransitionError"""
    wo = WorkOrder(id="WO-001", state=WorkOrderState.DRAFT)
    sm = WorkOrderStateMachine(wo)
    with pytest.raises(InvalidTransitionError):
        sm.approve(approver_id="user-001")

def test_state_transition_callbacks():
    """状态流转应触发预置回调（on_enter_xxx, on_exit_xxx）"""
    wo = WorkOrder(id="WO-001")
    sm = WorkOrderStateMachine(wo)
    callbacks_called = []
    sm.on_enter_approved.append(lambda: callbacks_called.append("enter_approved"))
    sm.submit()
    sm.approve(approver_id="user-001")
    assert "enter_approved" in callbacks_called
```

**验收标准**：
- 所有状态机单元测试通过率 100%
- 状态流转规则覆盖所有合法路径
- 非法状态流转被正确拦截

---

### ATB-2：审批链功能测试

**测试框架**：pytest

```python
# tests/unit/test_approval_chain.py

def test_create_approval_chain():
    """创建审批链应包含配置的所有审批节点"""
    chain = ApprovalChain(
        name="财务审批链",
        nodes=[
            ApprovalNode(order=1, role="部门主管", type="SEQUENTIAL"),
            ApprovalNode(order=2, role="财务经理", type="SEQUENTIAL"),
        ]
    )
    assert len(chain.nodes) == 2
    assert chain.nodes[0].order == 1

def test_chain_activates_first_node_on_submission():
    """工单提交后审批链应激活第一个审批节点"""
    wo = create_test_workorder()
    chain = create_test_approval_chain(wo.workorder_type)
    activated = chain.activate(wo_id=wo.id)
    assert activated.current_node.order == 1
    assert activated.status == "IN_PROGRESS"

def test_sequential_approval_advances_to_next_node():
    """串行审批中，当前节点审批通过后推进到下一节点"""
    chain = create_test_chain_with_nodes(3)
    chain.activate(wo_id="WO-001")
    chain.approve_current_node(approver_id="user-001")
    assert chain.current_node.order == 2

def test_parallel_approval_waits_for_all_nodes():
    """并行审批中，需所有并行节点审批通过才推进"""
    chain = ApprovalChain(
        nodes=[
            ApprovalNode(order=1, role="会签人A", type="PARALLEL"),
            ApprovalNode(order=1, role="会签人B", type="PARALLEL"),
            ApprovalNode(order=2, role="最终审批人", type="SEQUENTIAL"),
        ]
    )
    chain.activate(wo_id="WO-001")
    # 审批人会签节点A
    chain.approve_current_node(approver_id="user-001")
    # 仍停留在并行节点（因B未审批）
    assert chain.current_node.order == 1
    assert chain.pending_parallel_nodes == 1
    # 会签节点B审批
    chain.approve_current_node(approver_id="user-002")
    # 推进到下一节点
    assert chain.current_node.order == 2

def test_delegate_reassigns_approver():
    """转交操作应更新当前节点的审批人"""
    chain = create_test_chain_with_nodes(2)
    chain.activate(wo_id="WO-001")
    chain.delegate(from_user="user-001", to_user="user-003")
    assert chain.current_node.approver_id == "user-003"
```

**验收标准**：
- 审批链创建、激活、完成流程正常
- 串行审批节点按顺序推进
- 并行审批节点需全部通过才推进
- 转交操作正确更新审批人

---

### ATB-3：审批操作 API 测试

**测试框架**：pytest + FastAPI TestClient

```python
# tests/api/test_approval_endpoints.py

def test_submit_for_approval_endpoint():
    """POST /api/workorders/{id}/submit 应触发审批流程"""
    response = client.post("/api/workorders/WO-001/submit")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "PENDING_APPROVAL"
    assert data["approval_chain_id"] is not None

def test_approve_endpoint_updates_state():
    """POST /api/workorders/{id}/approve 应审批通过工单"""
    # 前置：创建工单并提交
    setup_submitted_workorder("WO-002")
    response = client.post(
        "/api/workorders/WO-002/approve",
        json={"approver_id": "user-001", "comment": "同意"}
    )
    assert response.status_code == 200
    assert response.json()["state"] == "APPROVED"

def test_reject_endpoint_requires_reason():
    """POST /api/workorders/{id}/reject 必须提供驳回原因"""
    setup_submitted_workorder("WO-003")
    response = client.post(
        "/api/workorders/WO-003/reject",
        json={"approver_id": "user-001"}  # 缺少 reason
    )
    assert response.status_code == 422  # Validation Error

def test_reject_with_reason_succeeds():
    """POST /api/workorders/{id}/reject 带原因应驳回成功"""
    response = client.post(
        "/api/workorders/WO-003/reject",
        json={"approver_id": "user-001", "reason": "不符合报销标准"}
    )
    assert response.status_code == 200
    assert response.json()["state"] == "REJECTED"

def test_delegate_endpoint():
    """POST /api/workorders/{id}/delegate 应转交审批权"""
    response = client.post(
        "/api/workorders/WO-004/delegate",
        json={"from_user": "user-001", "to_user": "user-002"}
    )
    assert response.status_code == 200
    assert response.json()["current_approver"] == "user-002"

def test_approval_history_is_recorded():
    """每次审批操作应记录到历史表"""
    setup_submitted_workorder("WO-005")
    client.post("/api/workorders/WO-005/approve", json={"approver_id": "user-001"})
    history = client.get("/api/workorders/WO-005/approval-history")
    assert len(history.json()) == 1
    assert history.json()[0]["action"] == "APPROVE"
```

**验收标准**：
- 所有 API 端点返回正确状态码
- 参数校验生效（必填项、格式）
- 审批状态正确更新
- 审批历史正确记录

---

### ATB-4：审批列表页面 E2E 测试

**测试框架**：Playwright

```typescript
// tests/e2e/approval-list.spec.ts

test('审批人能看到待审批工单列表', async ({ page }) => {
  // 登录审批人账号
  await page.goto('/login');
  await page.fill('[data-testid="username"]', 'approver001');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-btn"]');
  
  // 进入待审批列表页
  await page.goto('/approval/list');
  
  // 验证列表显示待审批工单
  const pendingItems = page.locator('[data-testid="pending-workorder-item"]');
  await expect(pendingItems).toHaveCount(3);
  
  // 验证列表项包含关键信息
  await expect(page.locator('text=WO-001')).toBeVisible();
  await expect(page.locator('text=待审批')).toBeVisible();
  await expect(page.locator('text=提交人: 张三')).toBeVisible();
});

test('审批人可查看工单详情并执行审批', async ({ page }) => {
  await page.goto('/approval/list');
  
  // 点击第一个工单进入详情
  await page.click('[data-testid="pending-workorder-item"]:first-child');
  await page.waitForURL(/\/approval\/detail\/WO-\d+/);
  
  // 验证详情页显示完整信息
  await expect(page.locator('[data-testid="workorder-title"]')).toBeVisible();
  await expect(page.locator('[data-testid="approval-chain-status"]')).toBeVisible();
  await expect(page.locator('[data-testid="history-timeline"]')).toBeVisible();
  
  // 执行审批通过
  await page.click('[data-testid="approve-btn"]');
  await page.fill('[data-testid="approval-comment"]', '材料齐全，同意报销');
  await page.click('[data-testid="confirm-approve"]');
  
  // 验证成功提示
  await expect(page.locator('text=审批成功')).toBeVisible();
  
  // 验证状态已更新
  await page.goto('/approval/list');
  await expect(page.locator('text=WO-001')).not.toBeVisible();
});

test('审批人可驳回工单并填写原因', async ({ page }) => {
  await page.goto('/approval/detail/WO-002');
  
  // 点击驳回
  await page.click('[data-testid="reject-btn"]');
  
  // 填写驳回原因
  await page.fill('[data-testid="reject-reason"]', '发票金额与申请金额不符');
  await page.click('[data-testid="confirm-reject"]');
  
  // 验证驳回成功
  await expect(page.locator('text=工单已驳回')).toBeVisible();
  
  // 验证工单状态变为已驳回
  await page.goto('/workorders/WO-002');
  await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已驳回');
});

test('审批人可将工单转交给其他人', async ({ page }) => {
  await page.goto('/approval/detail/WO-003');
  
  // 点击转交
  await page.click('[data-testid="delegate-btn"]');
  
  // 选择目标审批人
  await page.selectOption('[data-testid="delegate-to"]', 'user-003');
  await page.click('[data-testid="confirm-delegate"]');
  
  // 验证转交成功提示
  await expect(page.locator('text=已转交给 user-003')).toBeVisible();
});
```

**验收标准**：
- 待审批列表正确显示当前用户有权审批的工单
- 审批详情页展示完整工单信息和审批链状态
- 审批通过/驳回/转交操作成功执行
- 操作后页面状态正确更新
- 错误场景有友好提示

---

## 开发切入层级序列

### Phase 1 开发顺序

```
┌─────────────────────────────────────────────────────────────────┐
│  Level 1: 核心数据模型 & 基础设施                                 │
├─────────────────────────────────────────────────────────────────┤
│  1.1 数据库迁移                                                   │
│      - work_orders 表新增 state, approval_chain_id 字段          │
│      - approval_chains 表创建                                    │
│      - approval_chain_nodes 表创建                               │
│      - approval_history 表创建                                   │
│                                                                  │
│  1.2 领域模型定义                                                │
│      - WorkOrderState 枚举                                       │
│      - WorkOrder 实体类                                          │
│      - ApprovalChain 实体类                                       │
│      - ApprovalNode 实体类                                       │
│      - ApprovalHistory 实体类                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Level 2: 状态机引擎                                             │
├─────────────────────────────────────────────────────────────────┤
│  2.1 WorkOrderStateMachine 实现                                  │
│      - 状态定义                                                   │
│      - 状态流转规则                                               │
│      - 流转守卫（guard）                                         │
│      - 流转回调（callback）                                       │
│                                                                  │
│  2.2 状态流转 API                                                │
│      - submit_to_approval()                                      │
│      - approve()                                                 │
│      - reject()                                                   │
│      - return_to_requester()                                      │
│                                                                  │
│  2.3 状态机单测（pytest）                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Level 3: 审批链管理                                             │
├─────────────────────────────────────────────────────────────────┤
│  3.1 审批链 CRUD API                                             │
│      - POST /approval-chains (创建审批链)                        │
│      - GET /approval-chains/{id}                                │
│      - PUT /approval-chains/{id}                                │
│      - DELETE /approval-chains/{id}                             │
│                                                                  │
│  3.2 审批链执行引擎                                              │
│      - activate_chain()                                          │
│      - advance_to_next_node()                                    │
│      - complete_chain()                                          │
│                                                                  │
│  3.3 审批链单测（pytest）                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Level 4: 审批操作 API                                           │
├─────────────────────────────────────────────────────────────────┤
│  4.1 审批操作端点                                                │
│      - POST /workorders/{id}/submit                              │
│      - POST /workorders/{id}/approve                             │
│      - POST /workorders/{id}/reject                              │
│      - POST /workorders/{id}/delegate                            │
│      - POST /workorders/{id}/return                              │
│                                                                  │
│  4.2 待审批工单查询                                              │
│      - GET /approvals/pending (当前用户待审批列表)               │
│      - GET /workorders/{id}/approval-history                    │
│                                                                  │
│  4.3 API 集成测试（pytest + TestClient）                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Level 5: 前端审批页面                                           │
├─────────────────────────────────────────────────────────────────┤
│  5.1 审批列表页                                                  │
│      - 待我审批列表组件                                          │
│      - 我已审批列表组件                                          │
│      - 列表筛选与搜索                                            │
│                                                                  │
│  5.2 审批详情页                                                  │
│      - 工单信息展示                                              │
│      - 审批链状态可视化                                          │
│      - 审批历史时间线                                            │
│      - 审批操作按钮组                                            │
│                                                                  │
│  5.3 审批操作弹窗                                                │
│      - 通过确认弹窗（含批注输入）                                 │
│      - 驳回确认弹窗（必填驳回原因）                               │
│      - 转交弹窗（选择目标审批人）                                 │
│                                                                  │
│  5.4 E2E 测试（Playwright）                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Level 6: 通知与集成                                             │
├─────────────────────────────────────────────────────────────────┤
│  6.1 审批通知（可选，本期可延后）                                 │
│      - 新工单待审批通知                                          │
│      - 审批结果通知                                              │
│                                                                  │
│  6.2 审计日志增强                                                │
│      - 记录所有审批操作详情                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 前端文件修改清单

根据 AC 验收要求，需修改以下文件：

| 文件路径 | 修改内容 |
|---------|---------|
| `frontend/src/stores/approvalStore.ts` | 审批状态管理、状态机集成 |
| `frontend/tests/unit/retirementService.test.ts` | 单元测试覆盖 |
| `frontend/tests/e2e/approval.spec.ts` | E2E 审批流程测试 |
| `frontend/src/mocks/workOrderHandlers.ts` | Mock API 响应处理 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 仪表盘组件变更 |

### 技术债务 & 可延后项

| 项目 | 优先级 | 原因 |
|-----|-------|------|
| 审批条件表达式引擎 | P2 | 复杂需求，可后续迭代 |
| 批量审批操作 | P2 | 用户量上来后再实现 |
| 移动端适配 | P2 | 移动端使用场景待验证 |
| 审批超时自动处理 | P3 | 需配套通知系统 |

---

## 附录

### A. 状态机流转图

```
                    ┌──────────┐
                    │  DRAFT   │ ← 工单创建
                    └────┬─────┘
                         │ submit()
                         ↓
               ┌─────────────────────┐
               │  PENDING_APPROVAL  │ ← 等待分配审批链
               └─────────┬───────────┘
                         │ activate_chain()
                         ↓
              ┌──────────────────────┐
              │  APPROVAL_IN_PROGRESS│ ← 审批中
              └─────────┬────────────┘
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
     approve()     reject()      delegate()
          │             │             │
          ↓             ↓             ↓
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ APPROVED │  │ REJECTED │  │ (仍停留) │
    └────┬─────┘  └────┬─────┘  └──────────┘
         │             │
         ↓             │ resubmit()
   ┌──────────┐        │
   │ ARCHIVED │        │
   └──────────┘        ↓
                ┌──────────────┐
                │    DRAFT     │
                └──────────────┘
```

### B. 数据库关键字段

**work_orders**
```sql
state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
approval_chain_id UUID REFERENCES approval_chains(id),
current_node_order INT,
```

**approval_chains**
```sql
name VARCHAR(100),
workorder_type VARCHAR(50),
status VARCHAR(20), -- INACTIVE, IN_PROGRESS, COMPLETED, CANCELLED
```

**approval_chain_nodes**
```sql
chain_id UUID REFERENCES approval_chains(id),
order_num INT,
approver_type VARCHAR(20), -- ROLE, USER, DEPARTMENT_HEAD
approver_value VARCHAR(100), -- role_code or user_id
node_type VARCHAR(20), -- SEQUENTIAL, PARALLEL
```

### C. API 端点清单

| 方法 | 端点 | 描述 |
|-----|------|------|
| POST | `/api/workorders/{id}/submit` | 提交工单进入审批流程 |
| POST | `/api/workorders/{id}/approve` | 审批通过 |
| POST | `/api/workorders/{id}/reject` | 审批驳回 |
| POST | `/api/workorders/{id}/delegate` | 转交审批 |
| POST | `/api/workorders/{id}/return` | 退回修改 |
| GET | `/api/approvals/pending` | 获取当前用户待审批列表 |
| GET | `/api/workorders/{id}/approval-history` | 获取审批历史 |
| POST | `/api/approval-chains` | 创建审批链 |
| GET | `/api/approval-chains/{id}` | 获取审批链详情 |
| PUT | `/api/approval-chains/{id}` | 更新审批链 |
| DELETE | `/api/approval-chains/{id}` | 删除审批链 |

---

**文档版本**：v1.0  
**创建日期**：2025-01  
**维护者**：SWARM-501 Team  
**状态**：已批准进入 Phase 1 开发