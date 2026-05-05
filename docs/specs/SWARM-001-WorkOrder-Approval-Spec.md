# SWARM-001 工单审批流程 规格指导文档

**文档版本**: v1.0  
**任务编号**: SWARM-001  
**迭代周期**: Iteration 1  
**状态**: 已批准

---

## 1. 需求与背景

### 1.1 业务场景

工单审批是企业内部流程管理的核心环节，涉及资源分配、权限管控与事务追踪。当前系统缺失统一的审批链路机制，导致：

| 问题 | 影响 |
|------|------|
| 审批流程不透明 | 无状态追踪，审批节点不可见 |
| 通知滞后 | 状态变更依赖人工传递，信息不对称 |
| 扩展性差 | 硬编码审批逻辑，新增审批类型需改动核心代码 |

### 1.2 核心需求

| 需求编号 | 描述 | 优先级 |
|---------|------|--------|
| REQ-001 | 用户可通过前端界面提交工单审批申请 | P0 |
| REQ-002 | 后端通过状态机驱动审批链路，支持状态流转 | P0 |
| REQ-003 | 审批状态变更时自动触发通知机制 | P0 |
| REQ-004 | 审批记录持久化，支持历史追溯 | P1 |

### 1.3 关键实体定义

```
┌─────────────────────────────────────────────────────────────────┐
│                        核心实体关系图                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐      1:N      ┌──────────────────┐          │
│   │  WorkOrder  │──────────────▶│ ApprovalStage    │          │
│   │             │               │                  │          │
│   │ - id        │               │ - id             │          │
│   │ - title     │               │ - workorder_id   │          │
│   │ - content   │               │ - stage_order     │          │
│   │ - status    │◀──────────────│ - status          │          │
│   │ - creator   │   状态同步     │ - approver_id    │          │
│   └─────────────┘               └──────────────────┘          │
│          │                              │                       │
│          │ 触发                          │ 触发                  │
│          ▼                              ▼                       │
│   ┌─────────────┐               ┌──────────────────┐            │
│   │Notification│               │ ApprovalRecord   │            │
│   │   Event    │               │ (历史不可变)      │            │
│   └─────────────┘               └──────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

> **说明**：本规格文档对应 **Phase 1: 核心审批链路构建** 阶段。后续迭代将扩展多级审批、条件分支等高级特性。

### 2.1 Phase 1 实施范围

```
┌───────────────────────────────────────────────────────────────┐
│                         Phase 1 边界                           │
├───────────────────────────────────────────────────────────────┤
│  ✓ 单级直线审批（提交 → 审批 → 通过/拒绝）                     │
│  ✓ 状态机核心流转逻辑                                          │
│  ✓ 基础通知触发（邮件/站内信）                                  │
│  ✓ 审批记录持久化                                              │
├───────────────────────────────────────────────────────────────┤
│  ✗ 多级审批（Phase 2）                                         │
│  ✗ 条件分支审批（Phase 2）                                      │
│  ✗ 委托/转交审批（Phase 3）                                     │
│  ✗ 移动端专属流程（Phase 3）                                     │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 状态机定义

```
                          ┌──────────┐
                          │SUBMITTED │
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
```

**状态枚举定义**：

| 状态值 | 说明 | 可转换至 |
|--------|------|----------|
| `SUBMITTED` | 已提交，待系统处理 | `PENDING` |
| `PENDING` | 待审批 | `APPROVED`, `REJECTED` |
| `APPROVED` | 已通过（终态） | - |
| `REJECTED` | 已拒绝（终态） | - |

**状态转换规则**：

| 当前状态 | 触发事件 | 目标状态 | 前提条件 |
|----------|----------|----------|----------|
| SUBMITTED | `submit` | PENDING | 工单必填字段完整 |
| PENDING | `approve` | APPROVED | 当前用户为审批人 |
| PENDING | `reject` | REJECTED | 当前用户为审批人 + 提供拒绝原因 |

### 2.3 通知事件定义

| 事件类型 | 触发时机 | 通知对象 | 消息模板 |
|----------|----------|----------|----------|
| `workorder.submitted` | 工单提交成功 | 审批人 | 「{creator} 提交了工单 {title}，请及时审批」 |
| `workorder.approved` | 审批通过 | 工单创建者 | 「您提交的工单 {title} 已通过审批」 |
| `workorder.rejected` | 审批拒绝 | 工单创建者 | 「您提交的工单 {title} 未通过审批，原因：{reason}」 |

---

## 3. 边界约束

### 3.1 技术约束

| 约束维度 | 具体约束 | 约束来源 |
|----------|----------|----------|
| 技术栈 | 后端基于 Java/Spring Boot | 技术栈统一 |
| 技术栈 | 状态机使用 `WorkOrderStateMachine` 类实现 | 现有实现 |
| 技术栈 | 通知服务基于异步消息队列 | 性能要求 |
| 数据 | 工单表主键使用 UUID | 分布式兼容性 |
| 数据 | 审批记录不可物理删除，仅标记 `deleted=true` | 审计合规 |
| 性能 | 单次审批状态变更响应时间 ≤ 500ms | SLA 要求 |
| 安全 | 审批操作需校验操作用户与审批人身份一致性 | 安全基线 |
| 接口 | 统一响应格式使用 JSON `{code, data, message}` | 接口规范 |

### 3.2 安全约束

```
┌─────────────────────────────────────────────────────────────┐
│                      安全校验流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 用户发起审批请求                                         │
│           │                                                 │
│           ▼                                                 │
│  2. 验证 JWT Token 有效性                                   │
│           │                                                 │
│           ├─ 无效 → 返回 401 Unauthorized                   │
│           │                                                 │
│           ▼                                                 │
│  3. 校验审批人身份: `_get_current_user_id() == approver_id` │
│           │                                                 │
│           ├─ 不匹配 → 返回 403 Forbidden                    │
│           │                                                 │
│           ▼                                                 │
│  4. 执行状态机转换                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 禁止事项

- **禁止**在前端硬编码审批状态值，应从后端获取配置
- **禁止**绕过状态机直接修改工单状态
- **禁止**在通知回调中执行长时间阻塞操作
- **禁止**重复审批同一工单（幂等性校验）

---

## 4. 验收测试基准 (ATB)

### 4.1 测试框架选型

| 测试层级 | 框架工具 | 覆盖范围 |
|----------|----------|----------|
| 单元测试 | `pytest` / `JUnit` | 状态机逻辑、服务层 |
| 集成测试 | `pytest` + `MockMvc` | API 接口测试 |
| E2E 测试 | `Playwright` / `Cypress` | 前端用户操作流程 |

---

### 4.2 ATB-001: 工单提交功能

**功能描述**：用户填写工单信息后，系统创建工单并进入 PENDING 状态

#### ATB-001.1 - 正常提交工单

```java
// JUnit 测试: ApprovalControllerTest.java
@Test
void testSubmitWorkOrderSuccess() {
    // Given
    WorkOrderDTO dto = WorkOrderDTO.builder()
        .title("服务器扩容申请")
        .content("因业务增长需扩容服务器")
        .priority("high")
        .build();
    
    // When
    ResultActions result = mockMvc.perform(post("/api/v1/workorders")
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(dto)));
    
    // Then
    result.andExpect(status().isCreated())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.status").value("PENDING"))
        .andExpect(jsonPath("$.message").value("工单提交成功"));
}
```

#### ATB-001.2 - 缺少必填字段

```java
@Test
void testSubmitWorkOrderMissingRequiredField() {
    // Given: 缺少 content 字段
    WorkOrderDTO dto = WorkOrderDTO.builder()
        .title("测试工单")
        .build();
    
    // When
    ResultActions result = mockMvc.perform(post("/api/v1/workorders")
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(dto)));
    
    // Then
    result.andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.data").isEmpty())
        .andExpect(jsonPath("$.message").exists());
}
```

#### ATB-001.3 - E2E 提交流程

```typescript
// Playwright: approval.spec.ts
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

### 4.3 ATB-002: 状态机流转功能

**功能描述**：审批人对工单执行 approve/reject 操作，状态机驱动状态变更

#### ATB-002.1 - 有效审批通过

```java
// JUnit 测试: WorkOrderStateMachineTest.java
@Test
void testApproveTransitionValid() {
    // Given: PENDING 状态的工单
    WorkOrder workOrder = createPendingWorkOrder();
    WorkOrderStateMachine machine = new WorkOrderStateMachine(workOrder);
    
    // When
    machine.approve("approver_001", "同意扩容需求");
    
    // Then
    assertThat(workOrder.getStatus()).isEqualTo(WorkOrderStatus.APPROVED);
    assertThat(workOrder.getApprovedBy()).isEqualTo("approver_001");
}
```

#### ATB-002.2 - 有效审批拒绝

```java
@Test
void testRejectTransitionValid() {
    // Given
    WorkOrder workOrder = createPendingWorkOrder();
    WorkOrderStateMachine machine = new WorkOrderStateMachine(workOrder);
    
    // When
    machine.reject("approver_001", "资源不足");
    
    // Then
    assertThat(workOrder.getStatus()).isEqualTo(WorkOrderStatus.REJECTED);
    assertThat(workOrder.getRejectReason()).isEqualTo("资源不足");
}
```

#### ATB-002.3 - 非法状态转换检测

```java
@Test
void testInvalidTransition_ApprovedToPending() {
    // Given: APPROVED 状态（终态）
    WorkOrder workOrder = createApprovedWorkOrder();
    WorkOrderStateMachine machine = new WorkOrderStateMachine(workOrder);
    
    // When/Then: 尝试转换应抛出异常
    assertThatThrownBy(() -> machine.submit())
        .isInstanceOf(StateTransitionException.class)
        .hasMessageContaining("Invalid transition");
}
```

#### ATB-002.4 - 重复审批检测

```java
@Test
void testDuplicateApprovalRejected() {
    // Given: 已 APPROVED 的工单
    WorkOrder workOrder = createApprovedWorkOrder();
    WorkOrderStateMachine machine = new WorkOrderStateMachine(workOrder);
    
    // When/Then: 再次审批应抛出异常
    assertThatThrownBy(() -> machine.approve("approver_002", "再次同意"))
        .isInstanceOf(StateTransitionException.class);
}
```

---

### 4.4 ATB-003: 通知触发功能

**功能描述**：审批状态变更时，自动触发通知并投递至消息队列

#### ATB-003.1 - 审批通过触发通知

```java
// JUnit 测试: NotificationServiceTest.java
@Test
void testNotifyOnApproval() {
    // Given
    WorkOrder workOrder = createPendingWorkOrder();
    NotificationService notificationService = mock(NotificationService.class);
    
    // When
    approvalService.process(workOrder.getId(), "APPROVE", "approver_001");
    
    // Then
    verify(notificationService, times(1)).enqueueNotification(
        argThat(event -> 
            event.getEventType().equals("workorder.approved") &&
            event.getWorkOrderId().equals(workOrder.getId())
        )
    );
}
```

#### ATB-003.2 - 审批拒绝触发通知

```java
@Test
void testNotifyOnRejection() {
    // Given
    WorkOrder workOrder = createPendingWorkOrder();
    NotificationService notificationService = mock(NotificationService.class);
    
    // When
    approvalService.process(workOrder.getId(), "REJECT", "approver_001", "材料不全");
    
    // Then
    verify(notificationService, times(1)).enqueueNotification(
        argThat(event -> 
            event.getEventType().equals("workorder.rejected") &&
            event.getData().get("reject_reason").equals("材料不全")
        )
    );
}
```

#### ATB-003.3 - 通知消费者处理

```java
@Test
void testNotificationConsumerProcessesApproval() {
    // Given
    NotificationEvent event = NotificationEvent.builder()
        .eventType("workorder.approved")
        .workOrderId("uuid_test")
        .recipientEmail("creator@example.com")
        .build();
    
    // When
    notificationConsumer.process(event);
    
    // Then: 验证邮件发送
    verify(emailService).send(
        eq("creator@example.com"),
        argThat(email -> email.getSubject().contains("审批通过"))
    );
}
```

---

### 4.5 ATB-004: 审批记录持久化

**功能描述**：每次状态变更生成不可变的审批记录

#### ATB-004.1 - 状态变更时创建记录

```java
@Test
void testRecordCreatedOnStateChange() {
    // Given
    long initialCount = approvalRecordRepository.count();
    WorkOrder workOrder = createPendingWorkOrder();
    
    // When
    approvalService.process(workOrder.getId(), "APPROVE", "approver_001");
    
    // Then
    assertThat(approvalRecordRepository.count()).isEqualTo(initialCount + 1);
    
    ApprovalRecord record = approvalRecordRepository
        .findLatestByWorkOrderId(workOrder.getId());
    assertThat(record.getAction()).isEqualTo("APPROVE");
    assertThat(record.getApproverId()).isEqualTo("approver_001");
}
```

#### ATB-004.2 - 审批记录不可修改

```java
@Test
void testRecordImmutable() {
    // Given
    ApprovalRecord record = createApprovedRecord();
    
    // When/Then: 更新操作应被拦截
    record.setAction("REJECT");
    assertThatThrownBy(() -> approvalRecordRepository.save(record))
        .isInstanceOf(DataIntegrityViolationException.class);
}
```

---

### 4.6 ATB-005: API 接口集成

#### ATB-005.1 - E2E 审批人处理流程

```typescript
// Playwright: approval.spec.ts
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
});
```

#### ATB-005.2 - 前端 Store 单元测试

```typescript
// approvalStore.test.ts
describe('approvalStore', () => {
  it('ATB-005.2: should update status after approval', async () => {
    // Given
    const store = createApprovalStore();
    await store.fetchWorkOrder('wo-123');
    
    // When
    await store.approve('wo-123', '同意');
    
    // Then
    expect(store.currentWorkOrder?.status).toBe('APPROVED');
    expect(store.history).toHaveLength(2);
  });
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
│  文件:                                                          │
│    - backend/src/main/java/com/ams/entity/WorkOrder.java       │
│    - backend/src/main/java/com/ams/entity/ApprovalRecord.java  │
│  依赖: 无                                                        │
│  交付物:                                                        │
│    - WorkOrder Entity (id, title, content, status, creatorId) │
│    - ApprovalRecord Entity (id, workorderId, action, approver) │
│  测试: ATB-004 相关                                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 状态机核心层                                          │
├─────────────────────────────────────────────────────────────────┤
│  任务: 实现状态机流转逻辑与事件钩子                              │
│  文件:                                                          │
│    - backend/src/main/java/com/ams/state/WorkOrderStateMachine.java
│    - backend/src/main/java/com/ams/state/WorkOrderState.java   │
│  依赖: Layer 0                                                   │
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
│  文件:                                                          │
│    - backend/src/main/java/com/ams/service/WorkOrderService.java
│    - backend/src/main/java/com/ams/service/ApprovalService.java │
│  依赖: Layer 0, Layer 1                                         │
│  交付物:                                                        │
│    - WorkOrderService.create()                                 │
│    - ApprovalService.process(workorderId, action, approver)    │
│  测试: ATB-001.1, ATB-002.1, ATB-002.2                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: API 接口层                                            │
├─────────────────────────────────────────────────────────────────┤
│  任务: RESTful 接口实现                                         │
│  文件:                                                          │
│    - backend/src/main/java/com/ams/controller/WorkOrderController.java
│    - backend/src/main/java/com/ams/controller/ApprovalController.java
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
│  文件:                                                          │
│    - backend/src/main/java/com/ams/service/NotificationService.java
│  依赖: Layer 1 (状态机钩子)                                      │
│  交付物:                                                        │
│    - NotificationEvent 实体                                     │
│    - 消息队列任务定义                                           │
│    - 邮件/站内信发送                                           │
│  测试: ATB-003 全部用例                                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 前端界面层                                            │
├─────────────────────────────────────────────────────────────────┤
│  任务: 前端工单提交与审批交互                                   │
│  文件:                                                          │
│    - frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx
│    - frontend/src/stores/approvalStore.ts                       │
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
| M1: 数据层就绪 | 实体类定义完整，ORM 映射正确 | `test_workorder_model.py` |
| M2: 状态机可用 | 状态转换符合规范，异常拦截生效 | `test_workorder_state_machine.py` |
| M3: API 就绪 | 接口响应格式符合规范，状态码正确 | `test_workorder_api.py` |
| M4: 通知可达 | 状态变更触发队列消息，消费者正确投递 | `test_notification_service.py` |
| M5: E2E 通过 | Playwright 全部场景通过 | `approval.spec.ts` |

---

## 6. 交付物清单

### 6.1 后端交付物

| 文件路径 | 修改类型 | 验收条件 |
|----------|----------|----------|
| `backend/src/main/java/com/ams/service/WorkOrderService.java` | 修改 | 通过 `test_workorder_service.py` |
| `backend/src/main/java/com/ams/service/NotificationService.java` | 修改 | 通过 `test_notification_service.py` |
| `backend/src/main/java/com/ams/state/WorkOrderStateMachine.java` | 新增/修改 | 通过 `test_workorder_state_machine.py` |
| `backend/src/main/java/com/ams/entity/WorkOrder.java` | 修改 | 包含 status, creatorId 字段 |
| `backend/src/main/java/com/ams/entity/ApprovalRecord.java` | 新增 | 不可变实体定义 |

### 6.2 前端交付物

| 文件路径 | 修改类型 | 验收条件 |
|----------|----------|----------|
| `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` | 修改 | E2E 测试通过 |
| `frontend/src/stores/approvalStore.ts` | 修改 | 单元测试通过 |
| `frontend/src/stores/approvalStore.test.ts` | 修改 | 全部用例通过 |
| `frontend/tests/unit/test_approval_chain.py` | 修改 | pytest 通过 |
| `frontend/tests/e2e/approval.spec.ts` | 修改 | Playwright 通过 |

### 6.3 测试交付物

| 测试文件 | 覆盖范围 |
|----------|----------|
| `tests/unit/test_workorder_service.py` | WorkOrderService 单元测试 |
| `tests/unit/test_workorder_state_machine.py` | 状态机转换测试 |
| `tests/unit/test_approval_chain.py` | 审批链路测试 |
| `tests/api/test_workorder_api.py` | API 接口测试 |
| `frontend/tests/e2e/approval.spec.ts` | 端到端测试 |

---

## 7. 附录

### 7.1 术语表

| 术语 | 定义 |
|------|------|
| 状态机 | 维护对象状态及状态转换规则的有限状态自动机 |
| PENDING | 工单待审批状态 |
| 审批记录 | ApprovalRecord，不可变的状态变更历史条目 |
| 幂等性 | 同一操作多次执行结果与单次执行一致 |

### 7.2 接口规范

**统一响应格式**：

```json
{
  "code": 0,
  "data": { ... },
  "message": "操作成功"
}
```

**错误码定义**：

| code | 说明 |
|------|------|
| 0 | 成功 |
| 1001 | 参数校验失败 |
| 2001 | 状态转换非法 |
| 3001 | 权限不足 |
| 4001 | 资源不存在 |

### 7.3 参考文档

- 状态机实现参考: `backend/src/main/java/com/ams/state/`
- API 规范参考: `docs/api_contract.md`
- 前端组件规范参考: `frontend/docs/components.md`

---

**文档结束**