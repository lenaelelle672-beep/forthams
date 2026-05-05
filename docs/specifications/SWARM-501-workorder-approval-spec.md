# SWARM-501 工单审批流程 - Specifications

## 需求与背景

### 业务目标

实现工单审批流程的前端交互与后端状态机联动，用户可在工单详情页提交审批意见并触发工单状态流转。

### 现状描述

- 工单系统基础结构已存在（工单 CRUD、工单详情页）
- 后端状态机框架已搭建（基于 `TicketStateMachine`）
- 审批节点定义已配置（审批人角色、审批条件）
- 已实现核心服务：`ApprovalService`、`ApprovalChainService`、`RetirementService`

### 目标描述

- 工单详情页增加审批意见提交区域
- 审批提交后触发后端状态机状态流转
- 状态流转结果同步回显至前端页面
- 完整的审批链路日志记录
- 审批完成事件触发通知服务

---

## 当前 Phase 对应实施目标

参照 `plan.md` Phase 拆解，本次对应 **Phase 1: 核心审批流程实现**。

| Phase | 范围 | 状态 |
|-------|------|------|
| Phase 1 | 核心审批流程实现（前端页面 + 后端 API + 状态机联动） | 🔵 本次实施 |
| Phase 2 | 审批节点配置化增强 | 待实施 |
| Phase 3 | 审批通知与催办机制 | 待实施 |

### Phase 1 交付物

1. ✅ 工单详情页审批意见提交组件（前端）
2. ✅ 审批提交 API（`POST /api/work-orders/{id}/approve`）
3. ✅ 状态机流转逻辑（待审批 → 审批中 → 审批通过/拒绝 → 下一状态）
4. ✅ 审批历史记录查询 API
5. ✅ 前端状态同步与刷新机制
6. ✅ 审批完成事件触发通知服务

### 涉及文件

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `src/application/commands/create_work_order.py` | 修改 | 工单创建命令，集成审批服务 |
| `src/application/services/notification_service.py` | 修改 | 审批通知服务 |
| `src/main.py` | 修改 | 应用入口，注册审批相关组件 |
| `frontend/tests/unit/auditLog.test.ts` | 修改 | 审计日志单元测试 |
| `frontend/tests/e2e/approval.spec.ts` | 修改 | 审批流程端到端测试 |

---

## 边界约束

### 功能边界

| 约束项 | 说明 |
|--------|------|
| 审批角色 | 仅限拥有审批权限的角色可见审批入口 |
| 审批状态 | 仅 `PENDING_APPROVAL` 状态的工单可提交审批 |
| 意见必填 | 审批意见字段为必填，最小 5 字符，最大 500 字符 |
| 审批类型 | 支持 `APPROVE`、`REJECT`、`RETURN` 三种操作 |
| 幂等性 | 同一工单重复提交审批需防重处理（基于 version 乐观锁） |
| 权限校验 | 审批人必须为当前审批节点的指定审批人 |

### 技术边界

| 约束项 | 说明 |
|--------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 后端框架 | Python FastAPI / Spring Boot（双框架支持） |
| 状态机 | 内部状态机框架（`TicketStateMachine`） |
| API 风格 | RESTful + JSON |
| 并发控制 | 乐观锁（version 字段） |
| 消息队列 | Redis Publisher/Consumer |

### 非功能边界

| 约束项 | 说明 |
|--------|------|
| 响应时限 | 审批提交 API P99 ≤ 500ms |
| 错误恢复 | 状态机流转失败需事务回滚，前端提示重试 |
| 日志审计 | 所有审批操作写入 `audit_log` 表 |
| 通知延迟 | 审批完成通知投递延迟 ≤ 2s |

---

## 验收测试基准 (ATB)

### 后端单元测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-BE-001` | 审批通过场景 - 状态机正确流转至下一状态 | pytest 断言 `new_status == "APPROVED"` |
| `ATB-BE-002` | 审批拒绝场景 - 状态机流转至 `REJECTED` 状态 | pytest 断言 `new_status == "REJECTED"` |
| `ATB-BE-003` | 退回修改场景 - 状态机流转至 `RETURNED` 状态 | pytest 断言 `new_status == "RETURNED"` |
| `ATB-BE-004` | 非审批状态工单提交 - 返回 400 错误 | pytest 断言 `status_code == 400` |
| `ATB-BE-005` | 无权限用户提交审批 - 返回 403 错误 | pytest 断言 `status_code == 403` |
| `ATB-BE-006` | 审批意见为空 - 返回 422 验证错误 | pytest 断言 `validation_error` |
| `ATB-BE-007` | 审批意见过短（< 5 字符）- 返回 422 验证错误 | pytest 断言 `validation_error` |
| `ATB-BE-008` | 并发审批提交 - 仅一次成功 | pytest 断言 `only_one_success` |
| `ATB-BE-009` | 审批历史记录查询 - 返回按时间倒序 | pytest 断言 `sorted_by_desc(created_at)` |
| `ATB-BE-010` | 审批完成事件发布 - NotificationService 接收事件 | pytest 断言 `event_published` |

### 前端组件测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-FE-001` | 审批入口 - 仅审批角色可见 | playwright 断言审批按钮 `visible` |
| `ATB-FE-002` | 审批入口 - 非审批角色不可见 | playwright 断言审批按钮 `hidden` |
| `ATB-FE-003` | 审批意见必填校验 - 空提交禁用按钮 | playwright 断言按钮 `disabled` |
| `ATB-FE-004` | 审批意见字数校验 - < 5 字符禁用提交 | playwright 断言按钮 `disabled` |
| `ATB-FE-005` | 审批提交成功 - Toast 提示 + 状态刷新 | playwright 断言 `toast.visible` + `status.textContent` |
| `ATB-FE-006` | 审批提交失败 - Error Toast 显示 | playwright 断言 `error_toast.visible` |
| `ATB-FE-007` | 审批历史列表 - 正确渲染审批记录 | playwright 断言 `history_items.count >= 1` |
| `ATB-FE-008` | 审批流程状态展示 - 正确显示当前审批节点 | playwright 断言 `current_node.visible` |

### 端到端测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-E2E-001` | 完整审批通过流程 - 提交审批 → 状态变更 → 页面刷新 | playwright 完整链路断言 |
| `ATB-E2E-002` | 审批拒绝流程 - 提交拒绝 → 状态变更 → 发起人可见拒绝原因 | playwright 断言状态 + 通知 |
| `ATB-E2E-003` | 退回修改流程 - 退回 → 发起人修改 → 重新提交 | playwright 完整链路断言 |

---

## 开发切入层级序列

### Phase 1 实施顺序

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: 数据库层                                                  │
│   ├── 确认 `work_order_approval_log` 表结构                       │
│   ├── 字段: id, work_order_id, approver_id, action, comment      │
│   └── 字段: created_at, version                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: 状态机层                                                  │
│   ├── 确认审批状态节点定义 (PENDING_APPROVAL, APPROVED, REJECTED) │
│   ├── 确认状态流转规则 (APPROVE, REJECT, RETURN)                   │
│   └── 状态机单元测试验证                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: 后端服务层                                                │
│   ├── ApprovalService 审批核心服务                                │
│   ├── ApprovalChainService 审批链服务                            │
│   ├── 审批提交命令 (approve_work_order.py)                        │
│   └── 通知服务集成 (NotificationService)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: 后端 API 层                                               │
│   ├── POST /api/work-orders/{id}/approve (审批提交)               │
│   ├── GET  /api/work-orders/{id}/approval-history (审批历史)      │
│   ├── 权限校验 + 参数校验 + 事务处理                               │
│   └── 事件发布 (EventPublisher)                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: 前端 API 层                                               │
│   ├── `approveWorkOrder(id, payload)` API 调用封装                │
│   ├── `fetchApprovalHistory(id)` API 调用封装                     │
│   └── TypeScript 类型定义                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: 前端组件层                                                │
│   ├── <ApprovalPanel /> 审批意见提交组件                          │
│   ├── <ApprovalHistory /> 审批历史记录组件                        │
│   ├── <ApprovalStatus /> 审批状态展示组件                         │
│   └── 权限控制组件集成 (useApprovalPermission)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 7: 集成联调                                                  │
│   ├── 前端页面嵌入审批组件                                        │
│   ├── 审批提交 → 状态刷新 → UI 更新                               │
│   ├── 异常流程处理（网络错误、服务端错误）                         │
│   └── 通知消息消费验证 (NotificationConsumer)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 关键依赖关系

| 层级 | 前置依赖 | 后置依赖 |
|------|----------|----------|
| 数据库层 | 无 | 状态机层、后端 API 层 |
| 状态机层 | 数据库层 | 后端服务层 |
| 后端服务层 | 状态机层 | 后端 API 层 |
| 后端 API 层 | 后端服务层 | 前端 API 层 |
| 前端 API 层 | 后端 API 层 | 前端组件层 |
| 前端组件层 | 前端 API 层 | 集成联调 |

### 代码修改要点

#### 1. `src/application/commands/create_work_order.py`

```python
# 修改要点：
# - 工单创建时自动初始化审批流程
# - 调用 ApprovalChainService 创建审批链
# - 发布 WorkOrderCreatedEvent 事件
```

#### 2. `src/application/services/notification_service.py`

```python
# 修改要点：
# - 添加审批完成通知处理方法
# - 订阅 ApprovalCompletedEvent 事件
# - 实现通知消息构建与投递
```

#### 3. `src/main.py`

```python
# 修改要点：
# - 注册 ApprovalService 到依赖注入容器
# - 注册 NotificationConsumer 到事件总线
# - 配置审批相关中间件
```

#### 4. `frontend/tests/unit/auditLog.test.ts`

```typescript
// 修改要点：
// - 添加审批日志记录测试用例
// - 验证审批操作审计追踪
```

#### 5. `frontend/tests/e2e/approval.spec.ts`

```typescript
// 修改要点：
// - 完整审批流程端到端测试
// - 审批通过/拒绝/退回场景验证
// - 状态同步与页面刷新验证
```

---

## 验收标准 (AC) 对齐

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|----------|------|
| AC-001 | 工单审批流程前后端联动实现 | integration | pending |
| AC-002 | 状态机状态流转正确 | integration | pending |
| AC-003 | AST 静态检查通过（无语法错误） | static_analysis | pending |
| AC-004 | 所有修改函数包含 docstring | static_analysis | pending |
| AC-005 | 模块 import 无异常 | unit_test | pending |

### AC-003 验证命令

```bash
# Python AST 静态检查
python -m py_compile src/application/commands/create_work_order.py
python -m py_compile src/application/services/notification_service.py
python -m py_compile src/main.py

# TypeScript 类型检查
cd frontend && npx tsc --noEmit
```

### AC-004 验证命令

```bash
# Docstring 覆盖率检查
python tests/test_docstring_coverage.py --files \
  src/application/commands/create_work_order.py \
  src/application/services/notification_service.py
```

### AC-005 验证命令

```bash
# Import 验证
python -c "from src.application.commands.create_work_order import *"
python -c "from src.application.services.notification_service import *"
python -c "import src.main"
```

---

## 注意事项

1. **禁止跨层开发**：必须严格遵循层级序列，禁止在前端组件开发时直接调用数据库
2. **测试先行**：每个层级开发前需先编写测试用例
3. **向后兼容**：数据库字段变更需保持向后兼容（新增字段 nullable）
4. **事务一致性**：审批状态机流转必须在同一事务内完成
5. **幂等性保障**：重复提交需返回已处理结果，而非报错

---

## 附录：状态机流转图

```
                    ┌─────────────────┐
                    │ PENDING_APPROVAL │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ APPROVED │   │ REJECTED │   │ RETURNED │
       └──────────┘   └──────────┘   └──────────┘
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │下一审批节点│   │ 结束流程 │   │ 修改后重提交│
       └──────────┘   └──────────┘   └──────────┘
```

---

*文档版本：v1.0*
*创建日期：2024-01-15*
*负责人：SWARM-501 Team*