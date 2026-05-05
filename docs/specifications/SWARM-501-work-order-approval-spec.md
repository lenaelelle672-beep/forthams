# SWARM-501 工单审批流程 Specifications

## 1. 需求与背景

### 1.1 业务目标

实现工单审批流程的前端交互与后端状态机联动，用户可在工单详情页提交审批意见并触发工单状态流转。

### 1.2 现状描述

从 AST REPOSITORY MAP 分析，当前系统已具备以下基础设施：

| 层级 | 组件 | 说明 |
|------|------|------|
| 状态机层 | `TicketStateMachine` | 状态流转控制核心 |
| 服务层 | `ApprovalService` | 审批业务逻辑 |
| 服务层 | `ApprovalChainService` | 审批链管理 |
| 领域层 | `WorkOrder` | 工单领域实体 |
| 基础设施层 | `RedisPublisher` | 消息发布基础设施 |
| 事件层 | `EventDispatcher` → `NotificationHandler` | 事件处理链路 |

### 1.3 目标描述

- 工单详情页增加审批意见提交区域
- 审批提交后触发后端状态机状态流转
- 状态流转结果同步回显至前端页面
- 完整的审批链路日志记录

---

## 2. 当前 Phase 对应实施目标

参照 `plan.md` Phase 拆解，本次对应 **Phase 1: 核心审批流程实现**。

### 2.1 Phase 分解

| Phase | 范围 | 状态 |
|-------|------|------|
| Phase 1 | 核心审批流程实现（前端页面 + 后端 API + 状态机联动） | 🔵 本次实施 |
| Phase 2 | 审批节点配置化增强 | 待实施 |
| Phase 3 | 审批通知与催办机制 | 待实施 |

### 2.2 Phase 1 交付物

| 序号 | 交付物 | 文件路径 |
|------|--------|----------|
| 1 | 工单详情页审批意见提交组件 | `frontend/src/components/approval/ApprovalPanel.tsx` |
| 2 | 审批提交 API | `POST /api/work-orders/{id}/approve` |
| 3 | 审批历史记录查询 API | `GET /api/work-orders/{id}/approval-history` |
| 4 | 状态机流转逻辑 | `src/state_machine/TicketStateMachine` |
| 5 | 审批日志表结构 | `alembic/versions/002_create_work_order_approval_log_table.py` |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 说明 |
|--------|------|
| 审批角色 | 仅限拥有审批权限的角色可见审批入口 |
| 审批状态 | 仅 `PENDING_APPROVAL` 状态的工单可提交审批 |
| 意见必填 | 审批意见字段为必填，最小 5 字符 |
| 审批类型 | 支持 `APPROVE`、`REJECT`、`RETURN_FOR_REVISION` 三种操作 |
| 幂等性 | 同一工单重复提交审批需防重处理（基于 `version` 字段乐观锁） |

### 3.2 技术边界

| 约束项 | 说明 |
|--------|------|
| 前端框架 | React 18 + TypeScript |
| 后端框架 | FastAPI / Spring Boot |
| 状态机 | 内部状态机框架（基于 `TicketStateMachine`） |
| API 风格 | RESTful + JSON |
| 并发控制 | 乐观锁（`version` 字段） |
| 消息队列 | Redis Publisher（已存在） |

### 3.3 非功能边界

| 约束项 | 说明 |
|--------|------|
| 响应时限 | 审批提交 API P99 ≤ 500ms |
| 错误恢复 | 状态机流转失败需事务回滚，前端提示重试 |
| 日志审计 | 所有审批操作写入 `work_order_approval_log` 表 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端单元测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-BE-001` | 审批通过场景 - 状态机正确流转至 `APPROVED` 状态 | `pytest` 断言 `new_status == "APPROVED"` |
| `ATB-BE-002` | 审批拒绝场景 - 状态机流转至 `REJECTED` 状态 | `pytest` 断言 `new_status == "REJECTED"` |
| `ATB-BE-003` | 退回修改场景 - 状态机流转至 `RETURNED_FOR_REVISION` 状态 | `pytest` 断言 `new_status == "RETURNED_FOR_REVISION"` |
| `ATB-BE-004` | 非审批状态工单提交 - 返回 400 错误 | `pytest` 断言 `status_code == 400` |
| `ATB-BE-005` | 无权限用户提交审批 - 返回 403 错误 | `pytest` 断言 `status_code == 403` |
| `ATB-BE-006` | 审批意见为空 - 返回 422 验证错误 | `pytest` 断言 `validation_error` |
| `ATB-BE-007` | 并发审批提交 - 仅一次成功 | `pytest` 断言 `only_one_success` |
| `ATB-BE-008` | 审批历史记录查询 - 返回按时间倒序 | `pytest` 断言 `sorted_by_desc(created_at)` |

### 4.2 前端组件测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-FE-001` | 审批入口 - 仅审批角色可见 | `playwright` 断言审批按钮 `visible` |
| `ATB-FE-002` | 审批入口 - 非审批角色不可见 | `playwright` 断言审批按钮 `hidden` |
| `ATB-FE-003` | 审批意见必填校验 - 空提交禁用按钮 | `playwright` 断言按钮 `disabled` |
| `ATB-FE-004` | 审批意见字数校验 - < 5 字符禁用提交 | `playwright` 断言按钮 `disabled` |
| `ATB-FE-005` | 审批提交成功 - Toast 提示 + 状态刷新 | `playwright` 断言 `toast.visible` + `status.textContent` |
| `ATB-FE-006` | 审批提交失败 - Error Toast 显示 | `playwright` 断言 `error_toast.visible` |
| `ATB-FE-007` | 审批历史列表 - 正确渲染审批记录 | `playwright` 断言 `history_items.count >= 1` |

### 4.3 端到端测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-E2E-001` | 完整审批流程 - 提交审批 → 状态变更 → 页面刷新 | `playwright` 完整链路断言 |
| `ATB-E2E-002` | 审批拒绝流程 - 提交拒绝 → 状态变更 → 发起人可见 | `playwright` 断言状态 + 通知 |

---

## 5. 开发切入层级序列

### 5.1 Phase 1 实施顺序

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: 数据库层                                                  │
│   ├── 新增 `work_order_approval_log` 表结构                       │
│   └── 字段: id, work_order_id, approver_id, action, comment, ...  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: 状态机层                                                  │
│   ├── 定义审批状态节点 (PENDING_APPROVAL, APPROVED, REJECTED)     │
│   ├── 定义状态流转规则 (APPROVE, REJECT, RETURN)                  │
│   └── 编写状态机单元测试                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: 后端 API 层                                               │
│   ├── POST /api/work-orders/{id}/approve (审批提交)               │
│   ├── GET  /api/work-orders/{id}/approval-history (审批历史)      │
│   └── 权限校验 + 参数校验 + 事务处理                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: 前端 API 层                                               │
│   ├── `approveWorkOrder(id, payload)` API 调用封装                 │
│   └── `fetchApprovalHistory(id)` API 调用封装                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: 前端组件层                                                │
│   ├── `<ApprovalPanel />` 审批意见提交组件                        │
│   ├── `<ApprovalHistory />` 审批历史记录组件                      │
│   └── `<ApprovalStatus />` 审批状态展示组件                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: 集成联调                                                  │
│   ├── 前端页面嵌入审批组件                                        │
│   ├── 审批提交 → 状态刷新 → UI 更新                               │
│   └── 异常流程处理（网络错误、服务端错误）                         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键依赖关系

| 层级 | 前置依赖 | 后置依赖 |
|------|----------|----------|
| 数据库层 | 无 | 状态机层、后端 API 层 |
| 状态机层 | 数据库层 | 后端 API 层 |
| 后端 API 层 | 状态机层 | 前端 API 层 |
| 前端 API 层 | 后端 API 层 | 前端组件层 |
| 前端组件层 | 前端 API 层 | 集成联调 |

### 5.3 注意事项

1. **禁止跨层开发**：必须严格遵循层级序列，禁止在前端组件开发时直接调用数据库
2. **测试先行**：每个层级开发前需先编写测试用例
3. **向后兼容**：数据库字段变更需保持向后兼容（新增字段 nullable）

---

## 6. API 规范

### 6.1 审批提交 API

```
POST /api/work-orders/{id}/approve
```

**Request Body:**
```json
{
  "action": "APPROVE | REJECT | RETURN_FOR_REVISION",
  "comment": "审批意见（最少5字符）",
  "version": 1
}
```

**Response (200 OK):**
```json
{
  "code": 200,
  "message": "审批提交成功",
  "data": {
    "work_order_id": "WO-20240101-001",
    "new_status": "APPROVED",
    "approval_log_id": "log-uuid-xxx",
    "updated_at": "2024-01-01T10:00:00Z"
  }
}
```

### 6.2 审批历史查询 API

```
GET /api/work-orders/{id}/approval-history
```

**Response (200 OK):**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "log-uuid-xxx",
      "approver_id": "user-001",
      "approver_name": "张三",
      "action": "APPROVE",
      "comment": "同意该工单",
      "created_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

---

## 7. 数据模型

### 7.1 审批日志表 (work_order_approval_log)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 主键 | PK |
| work_order_id | VARCHAR(50) | 工单ID | FK, NOT NULL |
| approver_id | VARCHAR(50) | 审批人ID | NOT NULL |
| approver_name | VARCHAR(100) | 审批人姓名 | NOT NULL |
| action | ENUM | 审批动作 | APPROVE/REJECT/RETURN |
| comment | TEXT | 审批意见 | NOT NULL, MIN 5 |
| previous_status | VARCHAR(30) | 审批前状态 | NOT NULL |
| new_status | VARCHAR(30) | 审批后状态 | NOT NULL |
| created_at | TIMESTAMP | 创建时间 | NOT NULL |
| version | INT | 乐观锁版本号 | DEFAULT 1 |

### 7.2 状态机状态定义

| 状态 | 说明 |
|------|------|
| PENDING_APPROVAL | 待审批 |
| APPROVAL_IN_PROGRESS | 审批中 |
| APPROVED | 审批通过 |
| REJECTED | 审批拒绝 |
| RETURNED_FOR_REVISION | 退回修改 |

### 7.3 状态流转规则

| 当前状态 | 动作 | 目标状态 |
|----------|------|----------|
| PENDING_APPROVAL | SUBMIT | APPROVAL_IN_PROGRESS |
| APPROVAL_IN_PROGRESS | APPROVE | APPROVED |
| APPROVAL_IN_PROGRESS | REJECT | REJECTED |
| APPROVAL_IN_PROGRESS | RETURN | RETURNED_FOR_REVISION |
| RETURNED_FOR_REVISION | RESUBMIT | APPROVAL_IN_PROGRESS |

---

## 8. 事件流

### 8.1 审批提交事件链

```
┌─────────────────┐
│ User submits    │
│ approval form   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Frontend calls  │
│ POST /approve   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Backend validates│
│ + StateMachine  │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Save to DB +    │
│ Write audit log │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Publish event   │
│ via RedisPublisher│
└────────┬────────┘
         ↓
┌─────────────────┐
│ EventDispatcher │
│ routes event    │
└────────┬────────┘
         ↓
┌─────────────────┐
│ NotificationHandler│
│ sends alerts    │
└─────────────────┘
```

---

## 9. 错误处理

| 错误码 | 错误信息 | 处理策略 |
|--------|----------|----------|
| 400 | 工单状态不允许审批 | 提示用户当前状态 |
| 403 | 无审批权限 | 提示用户联系管理员 |
| 404 | 工单不存在 | 提示用户检查工单ID |
| 409 | 并发冲突（版本号不匹配） | 提示用户刷新后重试 |
| 422 | 审批意见格式错误 | 显示具体校验错误 |
| 500 | 服务器内部错误 | 提示用户稍后重试 |

---

## 10. 安全约束

1. **权限校验**：审批前需验证用户是否具有审批角色
2. **数据隔离**：用户只能查看有权限访问的工单审批记录
3. **操作审计**：所有审批操作需记录完整审计日志
4. **防重提交**：基于 `version` 字段实现幂等性控制

---

## 11. 性能要求

| 指标 | 要求 |
|------|------|
| API 响应时间 P99 | ≤ 500ms |
| 审批历史查询 P99 | ≤ 300ms |
| 状态机流转耗时 | ≤ 50ms |

---

## 12. 兼容性

1. **向后兼容**：新增字段需设置为 nullable
2. **API 兼容**：不修改现有 API 响应结构（新增字段除外）
3. **前端兼容**：新组件需支持 SSR/CSR 两种渲染模式

---

## 13. 测试覆盖率要求

| 模块 | 覆盖率要求 |
|------|-----------|
| 状态机层 | ≥ 90% |
| 后端 API 层 | ≥ 80% |
| 前端组件层 | ≥ 70% |

---

**文档版本**: 1.0  
**创建日期**: 2024-01-01  
**审核状态**: DRAFT  
**关联工单**: SWARM-501