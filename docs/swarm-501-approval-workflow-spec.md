# SWARM-501 工单审批流程 - Specifications

## 1. 需求与背景

### 1.1 业务目标

实现工单审批流程的前端交互与后端状态机联动，用户可在工单详情页提交审批意见并触发工单状态流转。

### 1.2 现状描述

- 工单系统基础结构已存在（工单 CRUD、工单详情页）
- 后端状态机框架已搭建（基于 XState 或自研状态机）
- 审批节点定义已配置（审批人角色、审批条件）

### 1.3 目标描述

- 工单详情页增加审批意见提交区域
- 审批提交后触发后端状态机状态流转
- 状态流转结果同步回显至前端页面
- 完整的审批链路日志记录

---

## 2. 当前 Phase 对应实施目标

参照 `plan.md` Phase 拆解，本次对应 **Phase 1: 核心审批流程实现**。

| Phase | 范围 | 状态 |
|-------|------|------|
| Phase 1 | 核心审批流程实现（前端页面 + 后端 API + 状态机联动） | 🔵 本次实施 |
| Phase 2 | 审批节点配置化增强 | 待实施 |
| Phase 3 | 审批通知与催办机制 | 待实施 |

### 2.1 Phase 1 交付物

| 交付物编号 | 交付物描述 | 对应文件 |
|------------|------------|----------|
| D-001 | 工单详情页审批意见提交组件 | `frontend/src/components/approval/` |
| D-002 | 审批提交 API | `POST /api/work-orders/{id}/approve` |
| D-003 | 状态机流转逻辑 | `src/state_machine/approval_state_machine.py` |
| D-004 | 审批历史记录查询 API | `GET /api/work-orders/{id}/approval-history` |
| D-005 | 前端状态同步与刷新机制 | `frontend/src/stores/approvalStore.ts` |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 说明 |
|--------|------|
| 审批角色 | 仅限拥有审批权限的角色可见审批入口 |
| 审批状态 | 仅 `待审批` 状态的工单可提交审批 |
| 意见必填 | 审批意见字段为必填，最小 5 字符 |
| 审批类型 | 支持 `通过`、`拒绝`、`退回修改` 三种操作 |
| 幂等性 | 同一工单重复提交审批需防重处理 |

### 3.2 技术边界

| 约束项 | 说明 |
|--------|------|
| 前端框架 | React 18 + TypeScript |
| 后端框架 | Spring Boot 3.x / FastAPI |
| 状态机 | 内部状态机框架（不透出 XState 细节） |
| API 风格 | RESTful + JSON |
| 并发控制 | 乐观锁（version 字段） |

### 3.3 非功能边界

| 约束项 | 说明 |
|--------|------|
| 响应时限 | 审批提交 API P99 ≤ 500ms |
| 错误恢复 | 状态机流转失败需事务回滚，前端提示重试 |
| 日志审计 | 所有审批操作写入 audit_log 表 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端单元测试

| 测试用例 ID | 测试描述 | 物理测试期待 |
|-------------|----------|--------------|
| `ATB-BE-001` | 审批通过场景 - 状态机正确流转至下一状态 | `pytest` 断言 `new_status == "approved"` |
| `ATB-BE-002` | 审批拒绝场景 - 状态机流转至 `rejected` 状态 | `pytest` 断言 `new_status == "rejected"` |
| `ATB-BE-003` | 退回修改场景 - 状态机流转至 `returned` 状态 | `pytest` 断言 `new_status == "returned"` |
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
│   ├── <ApprovalPanel /> 审批意见提交组件                          │
│   ├── <ApprovalHistory /> 审批历史记录组件                        │
│   └── <ApprovalStatus /> 审批状态展示组件                          │
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

## 6. 核心文件修改清单

| 文件路径 | 修改类型 | 关联交付物 |
|----------|----------|------------|
| `src/api/routes/work_orders.py` | 修改 | D-002, D-004 |
| `src/application/commands/create_work_order.py` | 修改 | D-003 |
| `src/application/services/notification_service.py` | 修改 | D-005 |
| `src/main.py` | 修改 | 路由注册 |
| `frontend/tests/unit/auditLog.test.ts` | 修改 | ATB-FE-007 |
| `frontend/tests/e2e/approval.spec.ts` | 修改 | ATB-E2E-001, ATB-E2E-002 |

---

## 7. API 规格

### 7.1 审批提交 API

```
POST /api/work-orders/{id}/approve
```

**Request Body:**
```json
{
  "action": "approve" | "reject" | "return",
  "comment": "string (min 5 characters)",
  "version": "integer (optimistic lock)"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "work_order_id": "string",
    "new_status": "approved" | "rejected" | "returned",
    "transitioned_at": "ISO8601 timestamp"
  }
}
```

**Error Responses:**
- `400 Bad Request`: 工单状态不允许审批
- `403 Forbidden`: 用户无审批权限
- `422 Unprocessable Entity`: 审批意见不合规
- `409 Conflict`: 版本冲突（乐观锁失败）

### 7.2 审批历史查询 API

```
GET /api/work-orders/{id}/approval-history
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "approver_id": "string",
        "approver_name": "string",
        "action": "approve" | "reject" | "return",
        "comment": "string",
        "created_at": "ISO8601 timestamp"
      }
    ],
    "total": "integer"
  }
}
```

---

## 8. 状态机流转规则

```
                    ┌─────────────────┐
                    │   PENDING       │
                    │   (待审批)       │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ↓                  ↓                  ↓
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   APPROVED   │   │   REJECTED   │   │   RETURNED   │
   │   (已通过)    │   │   (已拒绝)   │   │  (退回修改)  │
   └──────────────┘   └──────────────┘   └──────────────┘
          │                  │                  │
          ↓                  ↓                  ↓
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   CLOSED     │   │   ARCHIVED  │   │   PENDING    │
   │   (已关闭)   │   │   (已归档)  │   │   (重新提交) │
   └──────────────┘   └──────────────┘   └──────────────┘
```

### 8.1 流转条件

| 当前状态 | 触发事件 | 目标状态 | 条件 |
|----------|----------|----------|------|
| PENDING | APPROVE | APPROVED | 审批人具有权限 |
| PENDING | REJECT | REJECTED | 审批人具有权限 |
| PENDING | RETURN | RETURNED | 审批人具有权限 |
| RETURNED | RESUBMIT | PENDING | 发起人重新提交 |

---

## 9. 错误处理策略

| 错误类型 | 后端处理 | 前端处理 |
|----------|----------|----------|
| 网络超时 | 返回 504 Gateway Timeout | 显示重试按钮 |
| 状态机异常 | 事务回滚，返回 500 | Toast 提示联系管理员 |
| 权限不足 | 返回 403 | Toast 提示无权限 |
| 版本冲突 | 返回 409 | 提示数据已变更，刷新后重试 |
| 参数校验失败 | 返回 422 | 高亮错误字段 |

---

## 10. 安全考虑

1. **认证**：所有 API 需携带有效 JWT Token
2. **授权**：审批操作需验证用户角色为 `APPROVER` 或 `ADMIN`
3. **审计**：所有审批操作记录至 `audit_log` 表
4. **防重**：使用幂等键防止重复提交

---

*文档版本：1.0*  
*创建日期：2024*  
*状态：Active*