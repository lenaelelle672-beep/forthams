# 【SWARM-S5-001】工单审批流程 - 规格指导文档

## Iteration 1

---

## 1. 需求与背景

### 1.1 业务场景

某企业内部资产管理系统需要实现完整的工单审批流程，覆盖从工单创建、提交审批、审批执行到最终归档的全生命周期管理。

### 1.2 核心功能需求

| 编号 | 功能模块 | 描述 |
|------|----------|------|
| F-001 | 前端审批页面 | 为审批人员提供工单列表查看、详情浏览、审批/驳回操作界面 |
| F-002 | 后端状态机 | 实现工单状态的精确流转控制，确保状态变更的合法性与可追溯性 |
| F-003 | 通知机制 | 在关键状态变更时自动触发通知，触达相关干系人 |

### 1.3 技术栈约束

| 层级 | 技术选型 | 文件路径 |
|------|----------|----------|
| 前端框架 | React 18 + TypeScript | `frontend/` |
| 前端路由 | React Router v6 | `frontend/src/app/routes.ts` |
| 状态管理 | Zustand | `frontend/src/stores/approvalStore.ts` |
| 后端框架 | Spring Boot (Java) | `backend/src/main/java/com/ams/` |
| 状态定义 | Enum + State Machine | `backend/src/main/java/com/ams/state/` |
| API 层 | RESTful | `backend/src/main/java/com/ams/controller/` |

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 状态机基础设施层

**目标**: 构建工单审批系统的状态模型与核心状态机

| 任务项 | 具体内容 | 交付物 | 关键文件 |
|--------|----------|--------|----------|
| 1.1 | 工单状态枚举定义 | `WorkOrderState` 枚举类 | `backend/src/main/java/com/ams/state/WorkOrderState.java` |
| 1.2 | 状态机核心类实现 | 状态流转引擎 | `backend/src/main/java/com/ams/state/WorkOrderStateMachine.java` |
| 1.3 | 状态转换异常定义 | 状态转换相关异常 | `backend/src/main/java/com/ams/state/StateTransitionException.java` |

### Phase 2: 核心业务服务层

**目标**: 实现工单 CRUD 与审批逻辑

| 任务项 | 具体内容 | 交付物 | 关键文件 |
|--------|----------|--------|----------|
| 2.1 | 工单服务实现 | 工单 CRUD API 控制器 | `backend/src/main/java/com/ams/controller/WorkOrderController.java` |
| 2.2 | 审批服务实现 | 审批操作服务类 | `backend/src/main/java/com/ams/service/ApprovalService.java` |
| 2.3 | 审批记录持久化 | 审批动作与理由的存储 | `backend/src/main/java/com/ams/entity/ApprovalRecord.java` |

### Phase 3: 前端交互层

**目标**: 构建审批人员操作界面

| 任务项 | 具体内容 | 交付物 | 关键文件 |
|--------|----------|--------|----------|
| 3.1 | 工单详情组件 | 工单信息展示、审批历史时间线 | `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` |
| 3.2 | 审批状态管理 | Zustand Store for 审批状态 | `frontend/src/stores/approvalStore.ts` |
| 3.3 | 审批操作 API | 前后端交互的 API 接口 | `frontend/src/services/approvalService.ts` |

### Phase 4: 通知机制层

**目标**: 实现状态变更的自动通知

| 任务项 | 具体内容 | 交付物 | 关键文件 |
|--------|----------|--------|----------|
| 4.1 | 通知事件发布 | 状态变更事件的发布 | `src/notifications/events.py` |
| 4.2 | 通知服务 | 站内通知/邮件通知发送 | `backend/src/main/java/com/ams/service/NotificationService.java` |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 约束内容 | 说明 |
|--------|----------|------|
| 审批级数 | 单级审批 | 本次迭代仅支持单级审批，不支持多级审批链 |
| 通知渠道 | 站内通知 | 邮件通道作为扩展项待后续迭代 |
| 并发控制 | 乐观锁机制 | 防止同一工单被并发审批 |
| 数据隔离 | 单租户 | 多租户场景暂不考虑 |

### 3.2 技术边界

| 约束项 | 约束内容 |
|--------|----------|
| API 版本 | v1 固定为 `/api/v1/workorders/*` |
| 前端路由 | React Router v6，路由模式为 history |
| 认证机制 | JWT Token 认证 |
| 文件上传 | 本次迭代不包含附件功能 |

### 3.3 性能约束

| 指标 | 目标值 |
|------|--------|
| API 响应时间 (P95) | < 200ms |
| 列表查询响应时间 | < 500ms (1000条数据量) |
| 前端首屏加载时间 | < 2s |

### 3.4 安全约束

| 约束项 | 约束内容 |
|--------|----------|
| 输入校验 | 所有 API 入参必须经过 JSR-303 校验 |
| SQL 注入 | 使用 JPA Repository 查询，禁止字符串拼接 SQL |
| XSS | 前端渲染用户输入必须做转义处理 |
| 审批权限 | 后端必须二次校验用户审批角色 |

---

## 4. 验收测试基准 (ATB)

### 4.1 物理测试脚本要求

所有测试用例需提供可执行的测试脚本，命名遵循规范：

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 单元测试 | `test_<模块>_<功能点>.py/ts` | `test_state_machine.py` |
| E2E 测试 | `<功能>.spec.ts` | `approval.spec.ts` |
| 集成测试 | `test_<模块>_integration.py` | `test_approval_operations.py` |

---

### ATB-1: 状态机层测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| SM-001 | 工单状态枚举定义 | `WorkOrderState` 包含所有预期状态 | `tests/unit/test_state_machine.py` |
| SM-002 | 合法状态流转 - 待提交→待审批 | 状态机返回成功 | `tests/unit/test_workorder_state_machine.py` |
| SM-003 | 合法状态流转 - 审批中→已通过 | 审批通过后状态变更为 APPROVED | `tests/unit/test_workorder_state_machine.py` |
| SM-004 | 合法状态流转 - 审批中→已驳回 | 驳回操作成功，状态变更 REJECTED | `tests/unit/test_workorder_state_machine.py` |
| SM-005 | 非法状态流转 - 已归档→审批中 | 状态机拒绝非法流转，抛出 `StateTransitionException` | `tests/unit/test_workorder_state_machine.py` |
| SM-006 | 状态转换异常类型 | 异常包含错误码与消息 | `tests/backend/test_state_machine.py` |

---

### ATB-2: 后端服务层测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| SVC-001 | 创建工单 API | POST 返回 201，body 包含工单 ID | `tests/api/test_workorder_api.py` |
| SVC-002 | 查询工单列表 | GET 返回分页数据，默认 20 条/页 | `tests/api/test_workorder_api.py` |
| SVC-003 | 查询工单详情 | GET 返回完整工单信息与审批历史 | `tests/api/test_workorder_api.py` |
| SVC-004 | 提交审批 | POST 触发状态流转 | `tests/api/test_work_order_submit.py` |
| SVC-005 | 执行审批通过 | POST 返回 200，工单状态更新 | `tests/api/test_work_order_approve.py` |
| SVC-006 | 执行审批驳回 | POST 返回 200，驳回原因已持久化 | `tests/api/test_work_order_reject.py` |
| SVC-007 | 幂等性校验 | 重复提交返回 409 或 idempotent 响应 | `tests/api/test_work_order_idempotent.py` |
| SVC-008 | 审批权限校验 | 无权限用户调用审批接口返回 403 | `tests/backend/test_approval_service.py` |

---

### ATB-3: 前端 UI 测试 (Playwright)

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| UI-001 | 工单列表页加载 | 页面加载完成，列表正确渲染 | `frontend/tests/e2e/approval.spec.ts` |
| UI-002 | 工单列表筛选 | 筛选条件变更后，列表数据正确过滤 | `frontend/tests/e2e/approval.spec.ts` |
| UI-003 | 工单详情页跳转 | 点击工单行跳转至详情页，URL 包含工单 ID | `frontend/tests/e2e/approval.spec.ts` |
| UI-004 | 审批操作 - 批准 | 点击批准按钮，工单状态变更，页面提示成功 | `frontend/tests/e2e/approval.spec.ts` |
| UI-005 | 审批操作 - 驳回 | 点击驳回按钮，弹出原因输入框，填写后提交成功 | `frontend/tests/e2e/approval.spec.ts` |
| UI-006 | 审批历史时间线 | 详情页正确渲染审批历史，按时间倒序排列 | `frontend/tests/e2e/approval.spec.ts` |
| UI-007 | 无权限状态隐藏 | 无审批权限用户界面不显示审批操作按钮 | `frontend/tests/e2e/approval.spec.ts` |

---

### ATB-4: 前端单元测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| UT-001 | 审批链测试 | 审批步骤顺序验证 | `frontend/tests/unit/test_approval_chain.py` |
| UT-002 | 审批 Store 测试 | Zustand Store 状态管理逻辑正确 | `frontend/src/stores/approvalStore.test.ts` |
| UT-003 | 审批服务测试 | API 调用与响应处理正确 | `frontend/src/services/approvalService.test.ts` |

---

### ATB-5: 通知机制测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| NOTIFY-001 | 审批通过通知 | 状态变更为「已通过」后，触发通知事件 | `tests/backend/test_events.py` |
| NOTIFY-002 | 工单驳回通知 | 状态变更为「已驳回」后，触发通知事件 | `tests/backend/test_events.py` |
| NOTIFY-003 | 通知事件格式 | 事件 payload 包含工单 ID、变更前后状态、操作人、时间戳 | `tests/backend/test_events.py` |

---

### ATB-6: 集成测试

| 测试编号 | 测试项 | 物理测试期待 | 测试脚本 |
|----------|--------|--------------|----------|
| INT-001 | 完整审批流程 | 创建工单 → 提交审批 → 审批通过 → 归档 | `tests/e2e/test_workorder_workflow.spec.ts` |
| INT-002 | 完整驳回流程 | 创建工单 → 提交审批 → 驳回 → 修改重提 → 审批通过 | `tests/e2e/test_workorder_workflow.spec.ts` |
| INT-003 | 并发审批防护 | 两个并发审批请求仅一个成功，另一个返回 409 | `tests/concurrency/test_approve_race_condition.py` |

---

## 5. 开发切入层级序列

### 5.1 开发顺序规划

```
Phase 1: 状态机基础设施层
    │
    ├── Step 1.1: 工单状态枚举定义
    │       └── 输出: WorkOrderState.java
    │
    ├── Step 1.2: 状态转换异常定义
    │       └── 输出: StateTransitionException.java
    │
    └── Step 1.3: 状态机核心类实现
            └── 输出: WorkOrderStateMachine.java

Phase 2: 核心业务服务层
    │
    ├── Step 2.1: 工单实体与 Repository
    │       └── 依赖: Step 1.1
    │
    ├── Step 2.2: 审批服务实现
    │       └── 依赖: Step 1.3
    │
    └── Step 2.3: 审批记录持久化
            └── 依赖: Step 2.1, 2.2

Phase 3: 前端交互层
    │
    ├── Step 3.1: 审批 Store 开发
    │       └── 依赖: 后端 API (Step 2.2)
    │
    ├── Step 3.2: 工单详情组件开发
    │       └── 依赖: Step 3.1
    │
    └── Step 3.3: 审批操作 UI 开发
            └── 依赖: Step 3.1, 3.2

Phase 4: 通知机制层
    │
    ├── Step 4.1: 通知事件定义
    │       └── 依赖: Step 1.3
    │
    └── Step 4.2: 通知服务实现
            └── 依赖: Step 4.1

Phase 5: 测试与集成
    │
    ├── Step 5.1: 后端单元测试
    │       └── 依赖: Phase 1, 2
    │
    ├── Step 5.2: 前端 E2E 测试
    │       └── 依赖: Phase 3
    │
    └── Step 5.3: 全流程集成测试
            └── 依赖: Phase 4
```

### 5.2 关键技术决策点

| 决策点 | 方案选型 | 决策依据 |
|--------|----------|----------|
| 状态存储 | JPA + 数据库持久化 | 确保状态变更可追溯 |
| 状态变更事件 | Spring Event 机制 | 解耦通知逻辑，支持后续扩展消息队列 |
| 前端状态管理 | Zustand | 轻量级，支持 TypeScript，与 React 深度集成 |
| 权限校验层级 | 后端 Controller 注解 + 前端路由守卫 | 双重保障，防止越权操作 |
| 并发控制 | 乐观锁 (Version 字段) | 适合低并发场景，避免数据库锁竞争 |

---

## 附录 A: 工单状态定义

```java
// backend/src/main/java/com/ams/state/WorkOrderState.java
public enum WorkOrderState {
    DRAFT,           // 草稿/待提交
    PENDING,         // 待审批
    APPROVING,       // 审批中
    APPROVED,        // 已通过
    REJECTED,        // 已驳回
    ARCHIVED         // 已归档 (终态)
}
```

---

## 附录 B: 状态流转矩阵

| 当前状态 | 允许目标状态 | 触发操作 | 说明 |
|----------|--------------|----------|------|
| DRAFT | PENDING | submit | 提交审批 |
| PENDING | APPROVING | accept | 受理审批 |
| APPROVING | APPROVED | approve | 审批通过 |
| APPROVING | REJECTED | reject | 审批驳回 |
| APPROVING | PENDING | return | 退回修改 |
| REJECTED | DRAFT, PENDING | revise_and_resubmit | 修改重提 |
| APPROVED | ARCHIVED | archive | 归档 |

---

## 附录 C: 异常定义

| 异常类 | 错误码 | 触发场景 |
|--------|--------|----------|
| `StateTransitionException` | `INVALID_TRANSITION` | 状态机拒绝非法流转 |
| `ConcurrentModificationException` | `CONCURRENT_MODIFICATION` | 并发修改冲突 |
| `IdempotencyException` | `DUPLICATE_REQUEST` | 幂等性校验失败 |
| `BusinessException` | 业务自定义 | 业务规则校验失败 |

---

## 附录 D: 核心文件清单

### 后端核心文件

| 文件路径 | 职责 |
|----------|------|
| `backend/src/main/java/com/ams/state/WorkOrderState.java` | 工单状态枚举 |
| `backend/src/main/java/com/ams/state/WorkOrderStateMachine.java` | 工单状态机 |
| `backend/src/main/java/com/ams/state/StateTransitionException.java` | 状态转换异常 |
| `backend/src/main/java/com/ams/entity/WorkOrder.java` | 工单实体 |
| `backend/src/main/java/com/ams/entity/ApprovalRecord.java` | 审批记录实体 |
| `backend/src/main/java/com/ams/service/ApprovalService.java` | 审批服务 |
| `backend/src/main/java/com/ams/controller/WorkOrderController.java` | 工单控制器 |

### 前端核心文件

| 文件路径 | 职责 |
|---------|------|
| `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` | 工单详情卡片组件 |
| `frontend/src/stores/approvalStore.ts` | 审批状态管理 |
| `frontend/src/services/approvalService.ts` | 审批 API 服务 |
| `frontend/tests/unit/test_approval_chain.py` | 审批链单元测试 |
| `frontend/tests/e2e/approval.spec.ts` | 审批 E2E 测试 |

---

**文档版本**: v1.0  
**创建日期**: Iteration 1  
**状态**: Draft - 待评审