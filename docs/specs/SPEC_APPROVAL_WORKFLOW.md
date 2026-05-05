# 工单审批流程规格指导文档

## 需求与背景

### 业务场景

工单审批是企业运维/客服系统的核心链路。当用户提交工单后，需经过运维/客服/管理员等多角色依次审批才能流转至终态。当前系统缺失审批闭环能力，导致：

- 审批节点分散于线下沟通
- 状态变更缺乏即时通知
- 审批动作无法追溯审计

### 用户价值

| 角色 | 收益 |
|------|------|
| 申请人 | 实时知晓工单处理进度 |
| 审批人 | 在统一界面完成审批操作 |
| 管理员 | 全链路审计追溯 |

---

## 当前 Phase 对应实施目标

**参照 Plan.md Phase 拆解：Phase 2 - 审批流程核心实现**

| 目标层级 | 具体交付物 |
|----------|------------|
| P2.1 前端审批UI | 审批/驳回/转交三按钮 + 审批历史时间轴 |
| P2.2 后端状态机 | 7状态流转引擎 + 状态变更持久化 |
| P2.3 实时通知 | WebSocket 推送 + Email 异步发送 |

---

## 边界约束

### 明确范围

```
✓ 支持的审批动作: APPROVE / REJECT / TRANSFER
✓ 状态机状态: PENDING → APPROVED | REJECTED | TRANSFERRED → CLOSED
✓ 通知渠道: WebSocket (实时) + Email (异步)
✓ 转交目标: 仅支持系统内用户选择
✓ 审批历史: 完整持久化，支持查询
```

### 明确排除

```
✗ 不会实现: 多级会签审批
✗ 不会实现: 审批时限与自动驳回
✗ 不会实现: 移动端原生通知集成
✗ 不会实现: 审批委托/代理机制
```

---

## 验收测试基准 (ATB)

### ATB-1: 审批操作功能测试

| 测试用例 | 前置条件 | 操作步骤 | 物理期待 |
|----------|----------|----------|----------|
| TC-001 | 存在 PENDING 状态工单 | 点击「审批通过」按钮 | 工单状态变更为 APPROVED，页面刷新展示新状态 |
| TC-002 | 存在 PENDING 状态工单 | 点击「驳回」按钮，输入理由 | 工单状态变更为 REJECTED，驳回理由入库 |
| TC-003 | 存在 PENDING 状态工单 | 点击「转交」→ 选择目标用户 | 工单转移至目标用户，原审批人收到通知 |

### ATB-2: 状态机一致性测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-010 | APPROVED 工单再次调用 approve 返回 409 Conflict |
| TC-011 | REJECTED 工单调用 transfer 返回 422 Unprocessable Entity |
| TC-012 | 非审批人调用审批返回 403 Forbidden |
| TC-013 | 状态变更后 created_at 不变，updated_at 更新 |

### ATB-3: WebSocket 实时通知测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-020 | 审批通过后，目标连接 2s 内收到 status_update 事件 |
| TC-021 | 转交操作后，原审批人连接收到 transfer_notice 事件 |

### ATB-4: Email 异步通知测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-030 | 审批完成后，邮件队列产生一条记录 |
| TC-031 | 转交邮件包含原审批人、操作时间、转交原因 |

### ATB-5: 审批历史查询测试

| 测试用例 | 验证点 |
|----------|--------|
| TC-040 | GET /workorders/{id}/history 返回完整审批链 |
| TC-041 | 历史记录包含操作人、时间戳、动作类型、备注 |

---

## 开发切入层级序列

### Layer 1: 数据模型层 (Day 1)

```
src/models/
├── work_order.py          # 工单表 + status 字段
├── approval_history.py    # 审批历史表
└── user.py                # 用户表 (已有，扩展通知偏好)
```

**依赖关系**: 无前置依赖，优先完成

### Layer 2: 状态机引擎 (Day 1-2)

```
src/services/state_machine.py   # 状态流转规则引擎
src/schemas/approval.py         # Pydantic 请求/响应模型
```

**依赖关系**: 依赖 Layer 1 数据模型

### Layer 3: API 路由层 (Day 2-3)

```
src/api/v1/endpoints/approval.py  # POST approve/reject/transfer
src/api/v1/endpoints/history.py   # GET history
```

**依赖关系**: 依赖 Layer 2 状态机 + Layer 1 模型

### Layer 4: 前端审批UI (Day 3-4)

```
src/frontend/components/
├── ApprovalActions.vue          # 审批/驳回/转交按钮组
├── ApprovalHistory.vue          # 审批时间轴
└── TransferModal.vue            # 转交用户选择弹窗
```

**依赖关系**: 依赖 Layer 3 API 完成接口对接

### Layer 5: 通知服务 (Day 4-5)

```
src/services/
├── websocket_manager.py     # WebSocket 连接管理
├── notification_service.py  # 通知编排层
└── tasks/
    └── email_notification.py # Celery Email 异步任务
```

**依赖关系**: 依赖 Layer 3 API 触发通知

### Layer 6: 集成测试 (Day 5-6)

```
tests/
├── test_state_machine.py
├── test_approval_api.py
├── test_websocket_e2e.py
└── test_email_task.py
```

**依赖关系**: 依赖全部 Layer 交付物

---

## 附录: API 接口契约

| 方法 | 路径 | 请求体 | 响应状态 |
|------|------|--------|----------|
| POST | `/api/v1/workorders/{id}/approve` | `{operator_id}` | 200 / 409 / 403 |
| POST | `/api/v1/workorders/{id}/reject` | `{operator_id, reason}` | 200 / 422 |
| POST | `/api/v1/workorders/{id}/transfer` | `{operator_id, target_user_id, reason}` | 200 / 422 |
| GET | `/api/v1/workorders/{id}/history` | - | 200 |

---

## 待修改文件清单

根据 AC 验收标准，以下 5 个文件需进行规范修正：

1. `frontend/tests/e2e/approval_history.spec.ts` - 审批历史 E2E 测试
2. `frontend/tests/e2e/approval.spec.ts` - 审批流程 E2E 测试
3. `frontend/src/mocks/workOrderHandlers.ts` - 工单 Mock 处理器
4. `frontend/tests/unit/retirementService.test.ts` - 退休服务单元测试
5. `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` - 趋势图表组件

### 修正要求

| AC 标准 | 描述 | 关键验证点 |
|---------|------|------------|
| AC-001 | User Task: [SWARM-001] 工单审批流程实现 | 前端审批页面 + 后端状态机 + 通知机制 |
| AC-002 | 代码变更不引入新的语法错误（AST 静态检查通过） | 所有修改文件通过语法检查 |
| AC-003 | 所有修改的函数包含 docstring 文档注释 | 每个函数必须有 docstring |
| AC-004 | 变更后的模块可被正常 import 不抛出 ImportError | import 语句正确无误 |