# [SWARM-WO-001] 工单审批流程规格指导文档

**版本**: 1.0  
**迭代**: Iteration 1  
**日期**: 2025-01-XX  
**任务**: 工单审批流程——前端审批页面 + 后端状态机 + 通知机制

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是企业内部运维/服务请求的核心流转机制。当前系统缺失在线审批能力，审批人需通过线下渠道（邮件/IM/口头）确认，导致：

- **审批记录不可追溯**：缺少系统化的审批日志
- **状态同步滞后**：工单状态更新依赖人工通知
- **审计合规风险**：无法满足财务/运维变更的审计要求

### 1.2 核心功能需求

| 编号 | 功能点 | 描述 |
|------|--------|------|
| WO-F01 | 工单提交 | 用户创建工单，填写必填字段后提交 |
| WO-F02 | 审批页面 | 审批人查看待审批工单列表，进行通过/驳回操作 |
| WO-F03 | 状态机 | 工单状态在 `PENDING → APPROVED / REJECTED → CLOSED` 之间流转 |
| WO-F04 | 通知机制 | 状态变更时触发通知（邮件/站内信） |

### 1.3 用户角色

| 角色 | 权限 |
|------|------|
| `requester` | 提交工单、查看自己的工单状态 |
| `approver` | 审批工单、查看分配给自己的待审批工单 |
| `admin` | 全量工单管理 |

### 1.4 涉及文件清单

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| 前端组件 | `frontend/src/components/approval/ApprovalPanel.tsx` | 审批操作 UI 面板 |
| 前端状态 | `frontend/src/stores/approvalStore.ts` | 审批状态管理 |
| 类型定义 | `frontend/src/pages/WorkOrder/types/workOrder.ts` | 工单类型 TS 接口 |
| 路由配置 | `frontend/src/router/approval.ts` | 审批路由定义 |
| 后端状态机 | `backend/src/main/java/com/ams/state/WorkOrderStateMachine.java` | 状态转换规则引擎 |

---

## 2. 当前 Phase 对应实施目标

> **注**: 本文档对照 `plan.md` 中 Phase 2（审批流程核心）的交付范围

### 2.1 Phase 规划

```
Phase 1 (已交付): 数据模型定义、工单 CRUD 基础接口
Phase 2 (本次):   审批流程 + 状态机 + 通知机制
Phase 3 (规划中): 审批链（多级审批）、加签/转交
```

### 2.2 Phase 2 交付物

| 交付物 ID | 交付内容 | 目标文件 |
|-----------|----------|----------|
| WO-API-201 | 提交工单接口 `POST /api/v1/work-orders` | 后端 Controller |
| WO-API-202 | 获取审批列表 `GET /api/v1/work-orders/pending` | 后端 Controller |
| WO-API-203 | 审批操作接口 `POST /api/v1/work-orders/{id}/approve` | 后端 Controller |
| WO-API-204 | 驳回操作接口 `POST /api/v1/work-orders/{id}/reject` | 后端 Controller |
| WO-SVC-001 | 状态机服务（状态转换规则引擎） | `WorkOrderStateMachine.java` |
| WO-SVC-002 | 通知服务（事件驱动通知分发） | `NotificationService.java` |
| WO-FE-001 | 审批管理前端页面 | `ApprovalPanel.tsx` |

---

## 3. 边界约束

### 3.1 In-Scope（约束范围内）

```
✅ 工单状态机定义与强制校验
✅ 审批人单级审批
✅ 状态变更触发通知
✅ 前端审批操作界面
✅ API 鉴权（基于现有 RBAC）
✅ 审批记录持久化（操作人/时间/备注）
```

### 3.2 Out-of-Scope（约束范围外）

```
❌ 多级审批链（A → B → C 串行审批）
❌ 审批加签/转交
❌ 工单内容编辑（提交后不可修改）
❌ 移动端原生应用
❌ 离线审批（草稿箱）
```

### 3.3 技术约束

| 约束项 | 限制 |
|--------|------|
| 状态机实现 | 使用数据库乐观锁，禁止分布式锁 |
| 通知渠道 | 初期仅支持邮件 + 站内信，不含 SMS/企微 |
| 前端框架 | React 18 + Ant Design 5 / Zustand |
| API 响应时间 | P95 < 500ms |
| 并发控制 | 乐观锁版本号机制 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 工单提交功能

```typescript
// frontend/tests/e2e/approval.spec.ts
describe('WO-ATB-1: 工单提交', () => {
  it('ATB-1.1: 有效用户提交工单，返回 201 且状态为 PENDING', async () => {
    const payload = {
      title: '服务器扩容申请',
      description: '生产环境 CPU 使用率超 80%',
      priority: 'HIGH',
      category: 'INFRASTRUCTURE'
    };
    const response = await apiClient.post('/api/v1/work-orders', payload);
    expect(response.status).toBe(201);
    expect(response.data.status).toBe('PENDING');
  });

  it('ATB-1.2: 缺少必填字段时返回 422', async () => {
    const response = await apiClient.post('/api/v1/work-orders', { title: '仅标题' });
    expect(response.status).toBe(422);
  });

  it('ATB-1.3: 未认证请求返回 401', async () => {
    const response = await unauthenticatedClient.post('/api/v1/work-orders', {});
    expect(response.status).toBe(401);
  });
});
```

### 4.2 ATB-2: 待审批列表查询

```typescript
describe('WO-ATB-2: 待审批列表', () => {
  it('ATB-2.1: 审批人角色可获取自己待审批工单列表', async () => {
    const workOrder = await createWorkOrder({ approverId: getCurrentUserId() });
    const response = await apiClient.get('/api/v1/work-orders/pending');
    expect(response.status).toBe(200);
    expect(response.data.items.some(item => item.id === workOrder.id)).toBe(true);
  });

  it('ATB-2.2: 普通用户访问待审批列表返回 403', async () => {
    const response = await apiClient.get('/api/v1/work-orders/pending');
    expect(response.status).toBe(403);
  });
});
```

### 4.3 ATB-3: 审批操作（通过）

```typescript
describe('WO-ATB-3: 审批通过', () => {
  it('ATB-3.1: 审批人通过工单，状态变为 APPROVED', async () => {
    const workOrder = await createWorkOrder({ status: 'PENDING' });
    const payload = { comment: '同意扩容，联系运维执行' };
    
    const response = await apiClient.post(
      `/api/v1/work-orders/${workOrder.id}/approve`,
      payload
    );
    
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('APPROVED');
  });

  it('ATB-3.2: 数据库记录审批人信息', async () => {
    const dbRecord = await db.query(WorkOrder).findById(workOrder.id);
    expect(dbRecord.approvedBy).toBe(currentUser.id);
    expect(dbRecord.approvedAt).not.toBeNull();
  });

  it('ATB-3.3: 重复审批返回 409 Conflict', async () => {
    const response = await apiClient.post(
      `/api/v1/work-orders/${alreadyApprovedId}/approve`,
      {}
    );
    expect(response.status).toBe(409);
  });

  it('ATB-3.4: 非分配审批人操作返回 403', async () => {
    const response = await otherApproverClient.post(
      `/api/v1/work-orders/${workOrder.id}/approve`,
      {}
    );
    expect(response.status).toBe(403);
  });
});
```

### 4.4 ATB-4: 驳回操作

```typescript
describe('WO-ATB-4: 驳回操作', () => {
  it('ATB-4.1: 驳回操作必须填写驳回原因', async () => {
    const response = await apiClient.post(
      `/api/v1/work-orders/${workOrder.id}/reject`,
      {}
    );
    expect(response.status).toBe(422);
  });

  it('ATB-4.2: 驳回后状态变为 REJECTED', async () => {
    const response = await apiClient.post(
      `/api/v1/work-orders/${workOrder.id}/reject`,
      { reason: '资源不足，暂缓执行' }
    );
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('REJECTED');
  });
});
```

### 4.5 ATB-5: 状态机规则

```java
// backend/src/test/java/com/ams/service/WorkOrderStateMachineTest.java
class WorkOrderStateMachineTest {
    
    @Test
    void testStateTransitionRules() {
        // PENDING → APPROVED ✓
        assertTrue(stateMachine.canTransition("PENDING", "APPROVED"));
        // PENDING → REJECTED ✓
        assertTrue(stateMachine.canTransition("PENDING", "REJECTED"));
        // APPROVED → PENDING ✗ (不可逆)
        assertFalse(stateMachine.canTransition("APPROVED", "PENDING"));
        // REJECTED → APPROVED ✗ (不可逆)
        assertFalse(stateMachine.canTransition("REJECTED", "APPROVED"));
        // PENDING → CLOSED ✗ (必须经过审批)
        assertFalse(stateMachine.canTransition("PENDING", "CLOSED"));
    }

    @Test
    void testConcurrentApprovalHandling() {
        // 并发审批请求仅一次生效
        WorkOrder workOrder = createWorkOrder("PENDING");
        
        // 模拟并发请求
        List<Result> results = parallelExecute(
            () -> apiClient.post("/api/v1/work-orders/" + workOrder.id + "/approve", {}),
            () -> apiClient.post("/api/v1/work-orders/" + workOrder.id + "/approve", {})
        );
        
        // 仅一个返回 200，另一个返回 409
        long successCount = results.stream().filter(r -> r.status == 200).count();
        assertEquals(1, successCount);
    }
}
```

### 4.6 ATB-6: 通知机制

```java
// backend/src/test/java/com/ams/service/NotificationServiceTest.java
class NotificationServiceTest {
    
    @Mock
    private EmailService emailService;
    
    @Test
    void testNotificationSentOnApproval() {
        WorkOrder workOrder = createWorkOrder("requester@example.com");
        
        workOrder.approve();
        
        verify(emailService).send(argThat(email -> 
            email.getTo().equals("requester@example.com") &&
            email.getSubject().contains("已通过")
        ));
    }

    @Test
    void testNotificationSentOnRejection() {
        WorkOrder workOrder = createWorkOrder();
        
        workOrder.reject("资源不足");
        
        verify(emailService).send(argThat(email -> 
            email.getSubject().contains("驳回")
        ));
    }

    @Test
    void testNotificationOnSubmission() {
        WorkOrder workOrder = createWorkOrder("approver@example.com");
        
        workOrder.submit();
        
        verify(emailService).send(argThat(email -> 
            email.getTo().equals("approver@example.com")
        ));
    }
}
```

### 4.7 ATB-7: 前端审批页面

```typescript
// frontend/tests/e2e/approval.spec.ts
describe('WO-ATB-7: 前端审批页面', () => {
  it('ATB-7.1: 审批页面正确渲染待审批工单列表', async () => {
    await page.goto('/approval');
    await page.waitForSelector('.work-order-list');
    const items = page.locator('.work-order-item');
    await expect(items.first()).toBeVisible();
  });

  it('ATB-7.2: 点击通过按钮后 UI 状态立即更新', async () => {
    await page.goto('/approval');
    await page.click('[data-testid="approve-btn"]:first');
    await page.fill('[data-testid="comment-input"]', '同意执行');
    await page.click('[data-testid="confirm-btn"]');
    
    await expect(page.locator('.toast-success')).toContainText('审批成功');
    await expect(page.locator('.work-order-item')).toHaveCount(0);
  });

  it('ATB-7.3: 驳回时未填写原因不可提交', async () => {
    await page.goto('/approval');
    await page.click('[data-testid="reject-btn"]:first');
    await page.click('[data-testid="confirm-btn"]');
    
    await expect(page.locator('.error-message')).toContainText('请填写驳回原因');
  });
});
```

---

## 5. 开发切入层级序列

### 5.1 层级架构图

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Frontend (React)                         │
│  审批管理页面 / 工单提交表单                          │
├─────────────────────────────────────────────────────┤
│  Layer 3: API Controller                            │
│  审批路由 / 参数校验 / 权限拦截                       │
├─────────────────────────────────────────────────────┤
│  Layer 2: Domain Service (State Machine)            │
│  状态转换规则 / 业务校验 / 事件发布                   │
├─────────────────────────────────────────────────────┤
│  Layer 1: Data Access                              │
│  WorkOrder Model / Repository / Migration          │
├─────────────────────────────────────────────────────┤
│  Layer 0: Infrastructure                           │
│  通知服务 / 数据库事务 / 消息队列                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 开发顺序与任务拆解

| 顺序 | Layer | 任务 | 交付物 | 依赖 |
|------|-------|------|--------|------|
| 1 | Layer 1 | 确认 WorkOrder Entity 审批字段 | `WorkOrder.java` | 无 |
| 2 | Layer 2 | **状态机核心实现** | `WorkOrderStateMachine.java` | 1 |
| 3 | Layer 3 | API 路由定义与权限校验 | `WorkOrderController.java` | 2 |
| 4 | Layer 0 | 通知服务实现 | `NotificationService.java` | 3 |
| 5 | Layer 4 | 前端类型定义扩展 | `workOrder.ts` | 1 |
| 6 | Layer 4 | 审批状态管理 | `approvalStore.ts` | 5 |
| 7 | Layer 4 | 审批路由配置 | `approval.ts` | 6 |
| 8 | Layer 4 | 审批 UI 面板 | `ApprovalPanel.tsx` | 7 |
| 9 | All | ATB 测试执行 | `tests/` | 4, 8 |

### 5.3 核心实现点：WorkOrderStateMachine

```java
// backend/src/main/java/com/ams/state/WorkOrderStateMachine.java
package com.ams.state;

import com.ams.entity.WorkOrder;
import org.springframework.stereotype.Component;

/**
 * 工单审批状态机
 * 
 * 状态流转规则:
 * - PENDING → APPROVED (审批通过)
 * - PENDING → REJECTED (审批驳回)
 * - APPROVED → CLOSED (工单关闭)
 * - REJECTED → (终态，不可流转)
 * - CLOSED → (终态，不可流转)
 */
@Component
public class WorkOrderStateMachine {
    
    /** 允许的状态转换映射 */
    private static final Map<WorkOrderState, Set<WorkOrderState>> VALID_TRANSITIONS;
    
    static {
        VALID_TRANSITIONS = Map.of(
            WorkOrderState.PENDING, Set.of(
                WorkOrderState.APPROVED,
                WorkOrderState.REJECTED
            ),
            WorkOrderState.APPROVED, Set.of(
                WorkOrderState.CLOSED
            ),
            WorkOrderState.REJECTED, Set.of(),   // 终态
            WorkOrderState.CLOSED, Set.of()     // 终态
        );
    }
    
    /**
     * 校验状态转换是否合法
     *
     * @param current 当前状态
     * @param target   目标状态
     * @return true 如果转换合法
     * @throws StateTransitionException 如果转换非法
     */
    public boolean canTransition(WorkOrderState current, WorkOrderState target) {
        Set<WorkOrderState> allowed = VALID_TRANSITIONS.getOrDefault(current, Set.of());
        return allowed.contains(target);
    }
    
    /**
     * 执行状态转换
     *
     * @param workOrder 工单实体
     * @param action    操作类型 (APPROVE, REJECT, CLOSE)
     * @throws StateTransitionException 如果转换非法或工单已被其他操作修改
     */
    public void transition(WorkOrder workOrder, ApprovalAction action) {
        WorkOrderState nextState = mapActionToState(action);
        
        if (!canTransition(workOrder.getStatus(), nextState)) {
            throw new StateTransitionException(
                String.format("Cannot transition from %s to %s", 
                    workOrder.getStatus(), nextState)
            );
        }
        
        workOrder.setStatus(nextState);
    }
    
    /**
     * 将操作映射为目标状态
     */
    private WorkOrderState mapActionToState(ApprovalAction action) {
        return switch (action) {
            case APPROVE -> WorkOrderState.APPROVED;
            case REJECT -> WorkOrderState.REJECTED;
            case CLOSE -> WorkOrderState.CLOSED;
        };
    }
}
```

### 5.4 乐观锁防止并发审批

```java
// WorkOrderServiceImpl.java
@Service
public class WorkOrderServiceImpl implements WorkOrderService {
    
    @Autowired
    private WorkOrderMapper workOrderMapper;
    
    /**
     * 审批工单（乐观锁版本）
     */
    @Transactional
    public WorkOrder approve(Long workOrderId, Long approverId, String comment) {
        WorkOrder workOrder = workOrderMapper.selectById(workOrderId);
        
        // 状态校验
        if (workOrder.getStatus() != WorkOrderState.PENDING) {
            throw new BusinessException("工单状态不允许审批操作");
        }
        
        // 权限校验
        if (!workOrder.getApproverId().equals(approverId)) {
            throw new BusinessException("您不是该工单的指定审批人");
        }
        
        // 乐观锁更新
        WorkOrder update = new WorkOrder();
        update.setId(workOrderId);
        update.setStatus(WorkOrderState.APPROVED);
        update.setApprovedBy(approverId);
        update.setApprovedAt(LocalDateTime.now());
        update.setVersion(workOrder.getVersion()); // 乐观锁版本
        
        int affected = workOrderMapper.updateById(update);
        if (affected == 0) {
            throw new BusinessException("工单已被其他操作修改，请刷新后重试", 409);
        }
        
        // 发布审批成功事件
        eventPublisher.publish(new WorkOrderApprovedEvent(workOrder));
        
        return workOrderMapper.selectById(workOrderId);
    }
}
```

### 5.5 事件驱动通知

```java
// WorkOrderApprovedEvent.java
@Data
public class WorkOrderApprovedEvent {
    private final Long workOrderId;
    private final Long approverId;
    private final String approverName;
    private final LocalDateTime approvedAt;
}

// NotificationService.java
@Service
public class NotificationService {
    
    @EventListener
    public void handleWorkOrderApproved(WorkOrderApprovedEvent event) {
        WorkOrder workOrder = workOrderService.getById(event.getWorkOrderId());
        User requester = userService.getById(workOrder.getRequesterId());
        
        Notification notification = Notification.builder()
            .userId(requester.getId())
            .type(NotificationType.WORK_ORDER_APPROVED)
            .title("工单已通过审批")
            .content(String.format("您提交的工单「%s」已通过审批", workOrder.getTitle()))
            .referenceType("WORK_ORDER")
            .referenceId(workOrder.getId())
            .build();
        
        notificationRepository.save(notification);
        emailService.send(requester.getEmail(), notification.getTitle(), notification.getContent());
    }
    
    @EventListener
    public void handleWorkOrderRejected(WorkOrderRejectedEvent event) {
        // 类似实现...
    }
}
```

---

## 6. AC 验收清单

| AC ID | 验收条件 | 验证方法 | 状态 |
|-------|----------|----------|------|
| AC-001 | 完整功能验收：用户可提交工单并由审批人在线审批 | 集成测试 | pending |
| AC-002 | 代码变更不引入新的语法错误（AST 静态检查通过） | 静态分析 | pending |
| AC-003 | 所有修改的函数包含 docstring 文档注释 | 静态分析 | pending |
| AC-004 | 变更后的模块可被正常 import 不抛出 ImportError | 单元测试 | pending |

### 6.1 AC-002 静态检查命令

```bash
# Python 文件 AST 语法检查
python -m py_compile src/state_machine/approval_state_machine.py

# TypeScript 文件语法检查
npx tsc --noEmit frontend/src/components/approval/ApprovalPanel.tsx
npx tsc --noEmit frontend/src/stores/approvalStore.ts
npx tsc --noEmit frontend/src/pages/WorkOrder/types/workOrder.ts
npx tsc --noEmit frontend/src/router/approval.ts

# Java 文件编译检查
cd backend && ./mvnw compile
```

### 6.2 AC-003 Docstring 检查

```bash
# Python docstring 检查
python tests/test_docstring_coverage.py --files src/state_machine/approval_state_machine.py

# TypeScript JSDoc 检查
npx eslint --rule '{ "jsdoc/require-jsdoc": "error" }' \
  frontend/src/components/approval/ApprovalPanel.tsx \
  frontend/src/stores/approvalStore.ts
```

### 6.3 AC-004 Import 验证

```bash
# Python Import 检查
python -c "from src.state_machine.approval_state_machine import WorkOrderStateMachine"

# TypeScript Import 检查  
cd frontend && npx tsc --noEmit --skipLibCheck
```

---

## 7. 附录

### 7.1 数据模型变更

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | ENUM | PENDING / APPROVED / REJECTED / CLOSED |
| `approver_id` | BIGINT | 指定审批人 FK |
| `approved_by` | BIGINT | 实际审批人 FK |
| `approved_at` | TIMESTAMP | 审批时间 |
| `reject_reason` | TEXT | 驳回原因 |
| `version` | INT | 乐观锁版本号 |

### 7.2 API 响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1001,
    "title": "服务器扩容",
    "status": "APPROVED",
    "approvedBy": 5,
    "approvedAt": "2025-01-15T10:30:00Z"
  }
}
```

### 7.3 状态机状态定义

```java
// WorkOrderState.java
public enum WorkOrderState {
    PENDING("待审批"),
    APPROVED("已通过"),
    REJECTED("已驳回"),
    CLOSED("已关闭");
    
    private final String description;
    
    WorkOrderState(String description) {
        this.description = description;
    }
    
    public String getDescription() {
        return description;
    }
}
```

### 7.4 审批操作枚举

```java
// ApprovalAction.java
public enum ApprovalAction {
    APPROVE("通过"),
    REJECT("驳回"),
    CLOSE("关闭");
    
    private final String description;
    
    ApprovalAction(String description) {
        this.description = description;
    }
}
```

---

**文档结束**

---

*本规格文档为 Iteration 1 阶段指导文件，后续迭代将扩展多级审批、加签转交等功能。*