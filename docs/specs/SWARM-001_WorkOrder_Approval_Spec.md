# SWARM-001 工单审批流程实现规格指导文档

**版本**: 1.0  
**迭代编号**: SWARM-001  
**生成日期**: 2025-01-20  
**状态**: Active  

---

## 1. 需求与背景

### 1.1 业务需求

实现工单审批流程，支持工单状态的完整生命周期管理。用户可在工单模块内完成审批提交操作，并触发相应的通知机制。

### 1.2 技术需求拆解

| 组件 | 需求项 | 状态 |
|------|--------|------|
| 后端 | 新增 `WorkOrderStatus` 状态机 | ✅ 已实现 |
| 后端 | 新增审批相关 API | ✅ 已实现 |
| 前端 | 新增审批页面（待审批列表） | ✅ 已实现 |
| 前端 | 新增审批操作按钮 | ✅ 已实现 |
| 集成 | 审批完成后触发通知 | ✅ 已实现 |

### 1.3 依赖上下文

- 本次实现依赖现有工单（WorkOrder）基础模型
- 通知模块（Notification Service）已存在，遵循现有集成规范
- 状态机实现位于 `src/state_machine/approval_state_machine.py`
- 审批服务实现位于 `src/services/approval_service.py`

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 后端核心层（状态机 + API）

**目标**：完成工单状态机设计与审批 API 开发

#### 交付物清单

| 交付物 | 文件路径 | 关键类/函数 |
|--------|----------|-------------|
| 状态枚举定义 | `src/models/enums.py` | `WorkOrderStatus` |
| 状态机实现 | `src/state_machine/approval_state_machine.py` | `ApprovalStateMachine` |
| 审批服务 | `src/services/approval_service.py` | `ApprovalService.submit_approval` |
| 审批链服务 | `src/services/approval_chain_service.py` | `ApprovalChainService` |
| 审批 API 路由 | `src/api/routes/work_orders.py` | `/api/v1/work-orders/{id}/approve` |

#### 关键实现细节

```python
# 状态机流转路径（定义于 src/state_machine/states.py）
DRAFT -> PENDING_APPROVAL -> APPROVED/REJECTED -> CLOSED

# 关键函数调用链
submit_approval (L64, approval_service.py)
  -> _execute_transition (L196)
    -> _dispatch_notification_events (L358)
      -> NotificationPublisher.publish()
        -> NotificationConsumer.process_messages()
          -> _deliver_approver_notification()
```

### Phase 2: 前端界面层

**目标**：完成审批页面开发与交互实现

#### 交付物清单

| 交付物 | 文件路径 | 组件类型 |
|--------|----------|----------|
| 审批仪表盘 | `frontend/src/app/pages/AuditDashboard/` | Page |
| 筛选栏组件 | `frontend/src/app/pages/AuditDashboard/components/FilterBar/` | Component |
| 审批类型饼图 | `frontend/src/app/pages/AuditDashboard/components/ActionTypePie/index.tsx` | Component |
| 审批服务 | `frontend/src/app/services/approvalService.ts` | Service |
| 审批 Store | `frontend/src/stores/approvalStore.ts` | State |

#### 关键交互逻辑

```
用户提交工单 -> API: POST /api/v1/work-orders/{id}/submit
    -> 状态变更为 PENDING_APPROVAL
    -> 触发通知至审批者

审批者操作 -> API: POST /api/v1/work-orders/{id}/approve | /reject
    -> 状态变更为 APPROVED | REJECTED
    -> 触发通知至申请人
```

### Phase 3: 集成验证层

**目标**：完成通知触发与端到端联调

#### 交付物清单

| 交付物 | 文件路径 | 描述 |
|--------|----------|------|
| 通知发布器 | `src/infrastructure/messaging/publisher.py` | NotificationPublisher |
| 通知消费者 | `src/infrastructure/messaging/consumers/notification_consumer.py` | NotificationConsumer |
| 通知服务 | `src/application/services/notification_service.py` | 业务层通知编排 |
| 通知事件 | `src/notifications/events.py` | 事件定义 |

---

## 3. 边界约束

### 3.1 状态机边界

#### 允许的状态流转

```
DRAFT ─────────────► PENDING_APPROVAL
  ▲                      │
  │                      ▼
  │               ┌──────┴──────┐
  └─────REJECTED◄──┤             ├────► APPROVED
                   └──────┬──────┘
                          │
                          ▼
                       CLOSED
```

#### 流转约束规则

| 起始状态 | 目标状态 | 触发条件 | 约束 |
|----------|----------|----------|------|
| DRAFT | PENDING_APPROVAL | submit | 工单内容已完整 |
| PENDING_APPROVAL | APPROVED | approve | 审批者权限 |
| PENDING_APPROVAL | REJECTED | reject | 必须提供拒绝原因 |
| APPROVED | CLOSED | close | 仅审批者可操作 |
| REJECTED | DRAFT | revise | 重置编辑权限 |

#### 非法流转（抛出 StateTransitionException）

- DRAFT → APPROVED
- DRAFT → REJECTED
- PENDING_APPROVAL → CLOSED
- APPROVED → PENDING_APPROVAL

### 3.2 API 边界

| 约束项 | 约束内容 | 实现位置 |
|--------|----------|----------|
| 权限校验 | 仅 `APPROVER` 角色可调用审批 API | `src/api/deps/auth.py` |
| 幂等性 | 重复审批返回 idempotent 响应 | `src/services/approval_service.py` |
| 参数校验 | 拒绝时必须提供 `rejectReason` (10-500 字符) | `src/api/routes/work_orders.py` |
| 并发控制 | 乐观锁版本号校验 | `src/state_machine/guards.py` |

### 3.3 前端边界

| 约束项 | 约束内容 | 验证文件 |
|--------|----------|----------|
| 权限控制 | 非审批者角色隐藏审批入口 | `frontend/src/composables/useApprovalPermission.ts` |
| 表单验证 | 拒绝原因即时校验 | `frontend/src/app/services/approvalService.ts` |
| 操作反馈 | Loading 态 + Toast 提示 | `frontend/src/stores/approvalStore.ts` |

### 3.4 通知边界

| 约束项 | 约束内容 | 实现位置 |
|--------|----------|----------|
| 触发时机 | 状态变更持久化后异步触发 | `src/application/services/notification_service.py` |
| 异步处理 | 通知失败不影响主流程 | `src/infrastructure/messaging/publisher.py` |
| 事件类型 | APPROVAL_PENDING, APPROVAL_GRANTED, APPROVAL_DENIED | `src/notifications/events.py` |

---

## 4. 验收测试基准 (ATB)

### 4.1 AC 验收标准映射

| AC ID | 验证方法 | 状态 | 测试文件 |
|-------|----------|------|----------|
| AC-001 | integration | ⚠️ 待验证 | `tests/integration/test_workorder_api.py` |
| AC-002 | integration | ⚠️ 待验证 | `tests/api/test_work_order_approve.py` |
| AC-003 | static_analysis | ⚠️ 待验证 | `tests/test_ac_003.py` |
| AC-004 | static_analysis | ⚠️ 待验证 | `tests/test_docstring_coverage.py` |
| AC-005 | unit_test | ⚠️ 待验证 | `tests/test_ac_005.py` |

### 4.2 后端验收测试

#### 4.2.1 状态机单元测试

**测试文件**: `tests/unit/test_state_machine.py`

```python
class TestApprovalStateMachine:
    """验收点: 状态机流转逻辑正确性"""
    
    def test_valid_transition_draft_to_pending_approval(self):
        """
        验收点: DRAFT -> PENDING_APPROVAL 流转成功
        物理期待: 
        1. submit() 返回成功
        2. 状态更新为 PENDING_APPROVAL
        3. 触发 APPROVAL_PENDING 通知事件
        """
        
    def test_valid_transition_pending_to_approved(self):
        """
        验收点: PENDING_APPROVAL -> APPROVED 流转成功
        物理期待:
        1. approve() 返回成功
        2. 状态更新为 APPROVED
        3. 审批记录创建
        4. 触发 APPROVAL_GRANTED 通知事件
        """
        
    def test_valid_transition_pending_to_rejected(self):
        """
        验收点: PENDING_APPROVAL -> REJECTED 流转成功
        物理期待:
        1. reject() 返回成功（带 rejectReason）
        2. 状态更新为 REJECTED
        3. 拒绝记录创建
        4. 触发 APPROVAL_DENIED 通知事件
        """
        
    def test_invalid_transition_draft_to_approved_raises_exception(self):
        """
        验收点: 非法流转 DRAFT -> APPROVED 被拦截
        物理期待: 抛出 StateTransitionException
        """
        
    def test_rejected_to_draft_reopen_flow(self):
        """
        验收点: REJECTED -> DRAFT 重编辑流程
        物理期待:
        1. revise() 返回成功
        2. 状态回退至 DRAFT
        3. 清空 rejectReason
        """
```

#### 4.2.2 API 集成测试

**测试文件**: `tests/api/test_work_order_approve.py`

```python
class TestWorkOrderApproveAPI:
    """验收点: 审批 API 端点正确性"""
    
    def test_approve_endpoint_returns_200_for_authorized_approver(self, client, approver_token):
        """
        验收点: 授权审批者调用审批通过 API 成功
        物理期待:
        1. HTTP 200
        2. 响应包含 updated_work_order
        3. 数据库状态变更为 APPROVED
        """
        
    def test_approve_endpoint_returns_403_for_non_approver(self, client, regular_user_token):
        """
        验收点: 非审批者调用审批 API 被拒绝
        物理期待: HTTP 403, 错误码 PERMISSION_DENIED
        """
        
    def test_reject_endpoint_requires_reject_reason(self, client, approver_token):
        """
        验收点: 拒绝审批时必须提供拒绝原因
        物理期待: HTTP 400, 响应包含字段验证错误
        """
        
    def test_reject_reason_length_validation(self, client, approver_token):
        """
        验收点: 拒绝原因长度校验（10-500 字符）
        物理期待:
        1. < 10 字符: HTTP 400, REJECT_REASON_TOO_SHORT
        2. > 500 字符: HTTP 400, REJECT_REASON_TOO_LONG
        """
        
    def test_idempotent_approval_request(self, client, approver_token, already_approved_order):
        """
        验收点: 重复审批同一工单返回幂等响应
        物理期待:
        1. HTTP 200
        2. 响应状态码 IDEMPOTENT
        3. 提示"工单已审批"
        """
        
    def test_concurrent_approval_handling(self, client, approver_token, order_v1):
        """
        验收点: 并发审批场景下乐观锁生效
        物理期待:
        1. 旧版本操作失败
        2. HTTP 409 Conflict
        """
```

**测试文件**: `tests/api/test_work_order_reject.py`

```python
class TestWorkOrderRejectAPI:
    """验收点: 审批拒绝 API 正确性"""
    
    def test_reject_with_valid_reason(self, client, approver_token, pending_order):
        """
        验收点: 提供有效拒绝原因时拒绝成功
        物理期待:
        1. HTTP 200
        2. 状态变更为 REJECTED
        3. rejectReason 持久化
        """
        
    def test_reject_triggers_notification(self, client, approver_token, pending_order):
        """
        验收点: 拒绝操作触发申请人通知
        物理期待:
        1. NotificationPublisher 被调用
        2. 通知类型为 APPROVAL_DENIED
        """
```

### 4.3 前端验收测试

#### 4.3.1 E2E 审批流程测试

**测试文件**: `frontend/tests/e2e/approval.spec.ts`

```typescript
describe('Work Order Approval Flow', () => {
  test('approver can view pending approval list', async ({ page }) => {
    /*
     * 验收点: 审批者可查看待审批工单列表
     * 物理期待:
     * 1. 页面加载后显示工单列表
     * 2. 列表包含 PENDING_APPROVAL 状态工单
     * 3. 列表按提交时间升序排列
     */
  });
  
  test('approver can approve work order successfully', async ({ page }) => {
    /*
     * 验收点: 审批者执行审批通过操作
     * 物理期待:
     * 1. 点击审批通过按钮
     * 2. 弹出确认对话框
     * 3. 确认后显示成功 Toast
     * 4. 工单从待审批列表移除
     */
  });
  
  test('approver can reject work order with reason', async ({ page }) => {
    /*
     * 验收点: 审批者执行审批拒绝操作
     * 物理期待:
     * 1. 点击拒绝按钮
     * 2. 弹出拒绝原因输入框
     * 3. 输入有效拒绝原因（>10字符）
     * 4. 提交后显示成功 Toast
     * 5. 工单状态变更为 REJECTED
     */
  });
  
  test('reject reason validation prevents empty submission', async ({ page }) => {
    /*
     * 验收点: 拒绝原因表单校验
     * 物理期待:
     * 1. 输入少于 10 字符时提交按钮禁用
     * 2. 显示错误提示"拒绝原因至少 10 个字符"
     */
  });
  
  test('non-approver cannot access approval page', async ({ page, regularUser }) => {
    /*
     * 验收点: 非审批者角色无法访问审批页面
     * 物理期待: 访问审批路由重定向至 403 或首页
     */
  });
});
```

#### 4.3.2 前端单元测试

**测试文件**: `frontend/src/stores/approvalStore.test.ts`

```typescript
describe('ApprovalStore', () => {
  test('approve action calls API and updates state', async () => {
    /*
     * 验收点: 审批操作更新 Store 状态
     * 物理期待:
     * 1. 调用 approvalService.approve()
     * 2. Store 中工单状态更新
     * 3. 触发成功回调
     */
  });
});
```

### 4.4 集成验收测试

**测试文件**: `tests/integration/test_approval_chain.py`

```python
class TestApprovalNotificationIntegration:
    """验收点: 审批与通知集成正确性"""
    
    def test_approval_triggers_notification_to_applicant(self):
        """
        验收点: 审批通过后触发申请人通知
        物理期待:
        1. NotificationPublisher.publish() 被调用
        2. 通知类型为 APPROVAL_GRANTED
        3. 通知目标为工单创建者
        """
        
    def test_rejection_triggers_notification_with_reason(self):
        """
        验收点: 审批拒绝后触发申请人通知（含拒绝原因）
        物理期待:
        1. NotificationPublisher.publish() 被调用
        2. 通知类型为 APPROVAL_DENIED
        3. 通知内容包含 rejectReason
        """
        
    def test_notification_failure_does_not_rollback_approval(self):
        """
        验收点: 通知发送失败不影响审批流程
        物理期待:
        1. 模拟 NotificationPublisher 抛出异常
        2. 审批状态仍成功更新
        3. 异常被捕获并记录 error log
        """
```

### 4.5 静态分析验收

**测试文件**: `tests/test_ac_003.py`

```python
class TestASTStaticAnalysis:
    """验收点: 代码变更不引入语法错误"""
    
    def test_all_modified_files_parseable(self):
        """
        验收点: 所有修改的文件 AST 解析成功
        目标文件:
        - src/main.py
        - src/application/services/notification_service.py
        - frontend/src/app/pages/AuditDashboard/*.css
        - frontend/src/app/pages/AuditDashboard/components/ActionTypePie/index.tsx
        """
        
    def test_no_syntax_errors_in_imports(self):
        """
        验收点: 修改的模块可正常 import
        物理期待: python -c "import src.main" 不抛出 ImportError
        """
```

**测试文件**: `tests/test_docstring_coverage.py`

```python
class TestDocstringCoverage:
    """验收点: 所有修改的函数包含 docstring"""
    
    def test_all_functions_have_docstrings(self):
        """
        验收点: 新增和修改的函数有完整 docstring
        检查范围:
        - src/application/services/notification_service.py
        - src/services/approval_service.py
        - src/state_machine/approval_state_machine.py
        """
```

---

## 5. 开发切入层级序列

### 5.1 开发顺序与依赖关系

```
[Phase 1: 后端核心层]
    │
    ├── Step 1.1: 验证状态枚举定义
    │   └── 文件: src/models/enums.py
    │   └── 依赖: 现有 WorkOrder 模型
    │
    ├── Step 1.2: 验证状态机实现
    │   └── 文件: src/state_machine/approval_state_machine.py
    │   └── 依赖: WorkOrderStatus 枚举
    │
    ├── Step 1.3: 验证审批服务
    │   └── 文件: src/services/approval_service.py
    │   └── 依赖: StateMachine + 权限服务
    │
    ├── Step 1.4: 验证审批链服务
    │   └── 文件: src/services/approval_chain_service.py
    │   └── 依赖: ApprovalService
    │
    └── Step 1.5: 验证 API 路由
        └── 文件: src/api/routes/work_orders.py
        └── 依赖: ApprovalService

[Phase 2: 前端界面层] (依赖 Phase 1 API 完成)
    │
    ├── Step 2.1: 验证审批仪表盘页面
    │   └── 文件: frontend/src/app/pages/AuditDashboard/
    │   └── 依赖: Phase 1.5 API
    │
    ├── Step 2.2: 验证筛选栏组件
    │   └── 文件: frontend/src/app/pages/AuditDashboard/components/FilterBar/
    │   └── 依赖: Phase 2.1
    │
    ├── Step 2.3: 验证操作类型饼图
    │   └── 文件: frontend/src/app/pages/AuditDashboard/components/ActionTypePie/
    │   └── 依赖: Phase 2.1
    │
    └── Step 2.4: 验证审批 Store
        └── 文件: frontend/src/stores/approvalStore.ts
        └── 依赖: Phase 2.1 + Phase 1.5

[Phase 3: 集成验证层] (依赖 Phase 1 + Phase 2)
    │
    ├── Step 3.1: 验证通知发布器
    │   └── 文件: src/infrastructure/messaging/publisher.py
    │   └── 依赖: Phase 1.3
    │
    ├── Step 3.2: 验证通知消费者
    │   └── 文件: src/infrastructure/messaging/consumers/notification_consumer.py
    │   └── 依赖: Phase 3.1
    │
    ├── Step 3.3: 验证通知服务集成
    │   └── 文件: src/application/services/notification_service.py
    │   └── 依赖: Phase 3.1 + Phase 3.2
    │
    ├── Step 3.4: 验证 main.py 路由注册
    │   └── 文件: src/main.py
    │   └── 依赖: Phase 1 + Phase 3.3
    │
    └── Step 3.5: E2E 联调测试
        └── 文件: tests/e2e/approval.spec.ts
        └── 依赖: Phase 2 全部 + Phase 3.4
```

### 5.2 代码模块归属

| 模块 | 文件路径 | 关键行号 | 负责人 |
|------|----------|----------|--------|
| 状态枚举 | `src/models/enums.py` | - | Backend |
| 状态机 | `src/state_machine/approval_state_machine.py` | - | Backend |
| 审批服务 | `src/services/approval_service.py` | L64 (submit_approval) | Backend |
| 审批链服务 | `src/services/approval_chain_service.py` | - | Backend |
| 审批 API | `src/api/routes/work_orders.py` | - | Backend |
| 通知服务 | `src/application/services/notification_service.py` | - | Backend |
| 通知发布器 | `src/infrastructure/messaging/publisher.py` | - | Backend |
| 通知消费者 | `src/infrastructure/messaging/consumers/notification_consumer.py` | - | Backend |
| 主入口 | `src/main.py` | L593 (相关度: 3) | Backend |
| 审批仪表盘 | `frontend/src/app/pages/AuditDashboard/` | - | Frontend |
| 筛选栏 | `frontend/src/app/pages/AuditDashboard/components/FilterBar/` | L207 | Frontend |
| 操作饼图 | `frontend/src/app/pages/AuditDashboard/components/ActionTypePie/index.tsx` | L262 | Frontend |
| 审批 Store | `frontend/src/stores/approvalStore.ts` | - | Frontend |

### 5.3 关键函数调用链

```
submit_approval (approval_service.py:64)
  │
  ├─► _execute_transition (approval_service.py:196)
  │     │
  │     ├─► WorkOrderGuards.can_transition()
  │     ├─► ApprovalChainService.process()
  │     └─► _dispatch_notification_events (approval_service.py:358)
  │           │
  │           └─► NotificationPublisher.publish()
  │                 │
  │                 └─► NotificationConsumer.process_messages()
  │                       │
  │                       └─► _deliver_approver_notification()
```

### 5.4 数据库迁移（如需）

```sql
-- 如需新增审批相关字段，执行迁移
ALTER TABLE work_orders ADD COLUMN approval_status VARCHAR(20) DEFAULT 'PENDING_APPROVAL';
ALTER TABLE work_orders ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE work_orders ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE work_orders ADD COLUMN reject_reason TEXT;
ALTER TABLE work_orders ADD COLUMN version INTEGER DEFAULT 0;  -- 乐观锁
```

---

## 6. 附录

### 6.1 API 规范摘要

| 方法 | 端点 | 请求体 | 响应码 |
|------|------|--------|--------|
| POST | `/api/v1/work-orders/{id}/submit` | `{}` | 200/400 |
| POST | `/api/v1/work-orders/{id}/approve` | `{"comment": "string"}` | 200/403/409 |
| POST | `/api/v1/work-orders/{id}/reject` | `{"rejectReason": "string"}` | 200/400/403/409 |
| POST | `/api/v1/work-orders/{id}/close` | `{}` | 200/403 |
| GET | `/api/v1/work-orders/pending-approval` | - | 200 |

### 6.2 错误码定义

| 错误码 | 含义 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_STATE_TRANSITION` | 非法状态流转 | 400 |
| `REJECT_REASON_REQUIRED` | 拒绝原因缺失 | 400 |
| `REJECT_REASON_TOO_SHORT` | 拒绝原因过短 (<10) | 400 |
| `REJECT_REASON_TOO_LONG` | 拒绝原因过长 (>500) | 400 |
| `ALREADY_PROCESSED` | 工单已处理（幂等响应） | 200 |
| `CONCURRENT_MODIFICATION` | 并发修改冲突 | 409 |
| `PERMISSION_DENIED` | 权限不足 | 403 |

### 6.3 通知事件类型

| 事件类型 | 触发时机 | 接收者 |
|----------|----------|--------|
| `APPROVAL_PENDING` | 工单提交审批 | 审批者 |
| `APPROVAL_GRANTED` | 审批通过 | 申请人 |
| `APPROVAL_DENIED` | 审批拒绝（含原因） | 申请人 |
| `WORK_ORDER_CLOSED` | 工单关闭 | 申请人 |

### 6.4 验收检查清单

```
□ AC-001: Integration 测试通过
□ AC-002: Integration 测试通过
□ AC-003: AST 静态分析无语法错误
□ AC-004: Docstring 覆盖率 100%
□ AC-005: 所有模块可正常 import
□ E2E: 审批流程端到端测试通过
□ 通知: 审批通知正确送达
□ 幂等: 重复审批返回正确响应
□ 并发: 乐观锁生效
□ 权限: 非审批者无法访问
```

---

**文档结束**

**生成时间**: 2025-01-20  
**文档版本**: 1.0  
**审核状态**: Pending Review