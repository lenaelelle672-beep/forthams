# SWARM-2025-Q2-P0-003 工单审批流程规格指导文档

## 需求与背景

### 业务需求
实现工单审批流程的线上化，支持审批用户在 Web 前端完成一键审批/驳回操作，后端系统自动推进工单状态机生命周期并触发相应通知。

### 当前痛点
- 审批操作依赖线下或手工操作，效率低下
- 状态变更与通知发送存在时序不一致
- 审批历史记录不完整，难以追溯

### 预期收益
- 审批操作耗时从平均 5 分钟降至 30 秒内
- 状态变更与通知送达一致性达 99.5% 以上
- 完整审计日志支持

---

## 当前 Phase 对应实施目标

### Phase 3: 前端审批界面 + 状态机联动 + 通知触发

本迭代对齐 **Phase 3**，具体目标：

| 目标项 | 描述 |
|--------|------|
| 前端审批页 | 审批人查看待办工单列表，支持批量/单条审批操作 |
| 后端状态机 | 接收审批指令，按定义规则推进工单状态 |
| 通知服务 | 状态变更后触发邮件/站内信通知 |
| 审计日志 | 记录审批人、时间、动作、结果 |

### 与前后 Phase 关系
```
Phase 2 (已交付)     Phase 3 (当前)       Phase 4 (后续)
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  工单数据模型 │ --> │ 审批流程实现 │ --> │ 权限细化/   │
│  基础 CRUD   │     │ 状态机联动   │     │ 审批链配置  │
│  基础 API    │     │ 通知触发     │     │ 加签/转签   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 边界约束

### 功能边界

| 约束类型 | 具体约束 |
|----------|----------|
| 审批角色 | 仅拥有 `APPROVER` 角色的用户可执行审批操作 |
| 工单状态 | 仅 `PENDING_APPROVAL` 状态可接受审批指令 |
| 操作原子性 | 审批提交后，状态变更与通知触发必须原子完成 |
| 并发控制 | 同一工单同一时间仅允许一个审批操作，防止竞态 |
| 超时处理 | 审批操作超时阈值设定为 10 秒，超时返回 504 |
| 批量限制 | 单次批量审批上限 50 条，超出返回 400 |
| 通知重试 | 通知发送失败时最多重试 3 次，间隔 30s/60s/120s |

### 非功能约束

| 约束类型 | 具体约束 |
|----------|----------|
| 响应时间 | 审批接口 P99 ≤ 500ms |
| 可用性 | 审批服务 SLA ≥ 99.9% |
| 数据一致性 | 工单状态与审计日志强一致 |
| 日志留存 | 审批日志保留 730 天 |

### 技术边界

- 前端：React 18 + TypeScript + Ant Design 5
- 后端：Python FastAPI / Django
- 状态机：Python `transitions` 库或自实现状态机
- 通知队列：Redis Stream / RabbitMQ
- 数据库：PostgreSQL 15

---

## 验收测试基准 (ATB)

### ATB-1: 单条审批通过

| 测试编号 | ATB-1 |
|----------|-------|
| 场景 | 审批人提交单条工单"通过" |
| 前置条件 | 工单状态为 `PENDING_APPROVAL`，当前用户为审批人 |
| 测试步骤 | 1. 调用 `POST /api/v1/work-orders/{id}/approve`<br>2. 请求体: `{"action": "approve", "comment": "同意"}` |
| 物理测试期待 | **pytest**: `test_single_approve_success`<br>**Playwright**: 页面显示审批成功 toast，工单状态变更为 `APPROVED` |

### ATB-2: 单条审批驳回

| 测试编号 | ATB-2 |
|----------|-------|
| 场景 | 审批人提交单条工单"驳回" |
| 前置条件 | 工单状态为 `PENDING_APPROVAL` |
| 测试步骤 | 1. 调用 `POST /api/v1/work-orders/{id}/approve`<br>2. 请求体: `{"action": "reject", "comment": "材料不全"}` |
| 物理测试期待 | **pytest**: `test_single_reject_success`<br>**Playwright**: 页面显示驳回成功，工单状态变更为 `REJECTED` |

### ATB-3: 批量审批通过

| 测试编号 | ATB-3 |
|----------|-------|
| 场景 | 审批人批量审批 10 条工单 |
| 前置条件 | 存在 10 条 `PENDING_APPROVAL` 状态工单 |
| 测试步骤 | 1. 调用 `POST /api/v1/work-orders/batch-approve`<br>2. 请求体: `{"ids": [1,2,...10], "action": "approve"}` |
| 物理测试期待 | **pytest**: `test_batch_approve_success`<br>**Playwright**: 批量成功后页面刷新，列表中 10 条工单状态均变更为 `APPROVED` |

### ATB-4: 非法状态变更拒绝

| 测试编号 | ATB-4 |
|----------|-------|
| 场景 | 对已审批工单再次审批 |
| 前置条件 | 工单状态为 `APPROVED` |
| 测试步骤 | 调用 `POST /api/v1/work-orders/{id}/approve` |
| 物理测试期待 | **pytest**: `test_approve_invalid_state`<br>**HTTP**: 返回 409 Conflict，错误码 `INVALID_STATE_TRANSITION` |

### ATB-5: 状态机规则验证

| 测试编号 | ATB-5 |
|----------|-------|
| 场景 | 验证状态机定义的状态流转 |
| 前置条件 | 状态机配置已加载 |
| 测试步骤 | 对所有定义的状态流转路径执行正向测试，对非法路径执行负向测试 |
| 物理测试期待 | **pytest**: `test_state_machine_transitions` |

### ATB-6: 通知触发验证

| 测试编号 | ATB-6 |
|----------|-------|
| 场景 | 审批通过后触发通知 |
| 前置条件 | 审批人通过审批，系统有可用的通知服务 |
| 测试步骤 | 执行审批操作，查询通知记录 |
| 物理测试期待 | **pytest**: `test_notification_triggered_on_approve`<br>**Mock**: 验证通知服务 `send_notification` 被调用一次 |

### ATB-7: 并发审批冲突检测

| 测试编号 | ATB-7 |
|----------|-------|
| 场景 | 两用户同时对同一工单提交审批 |
| 前置条件 | 工单状态为 `PENDING_APPROVAL` |
| 测试步骤 | 并发发送两个审批请求 |
| 物理测试期待 | **pytest**: `test_concurrent_approval_conflict`<br>**结果**: 一个成功(200)，一个失败(409 Conflict) |

### ATB-8: 无权限用户拒绝

| 测试编号 | ATB-8 |
|----------|-------|
| 场景 | 非审批人角色用户尝试审批 |
| 前置条件 | 当前用户角色为 `REQUESTER` |
| 测试步骤 | 调用审批接口 |
| 物理测试期待 | **pytest**: `test_unauthorized_approval_rejected`<br>**HTTP**: 返回 403 Forbidden |

### ATB-9: 批量超限拒绝

| 测试编号 | ATB-9 |
|----------|-------|
| 场景 | 批量审批请求超出 50 条限制 |
| 前置条件 | 存在 51 条待审批工单 |
| 测试步骤 | 调用批量审批接口，传入 51 个 ID |
| 物理测试期待 | **pytest**: `test_batch_approve_exceeds_limit`<br>**HTTP**: 返回 400 Bad Request |

### ATB-10: 前端页面交互验收

| 测试编号 | ATB-10 |
|----------|-------|
| 场景 | 前端审批页面完整交互流程 |
| 测试步骤 | 1. 登录审批人账号<br>2. 进入"待审批工单"列表页<br>3. 点击单条工单操作按钮，选择审批/驳回<br>4. 填写备注并提交<br>5. 观察页面状态更新 |
| 物理测试期待 | **Playwright**: `test_approval_page_workflow`<br>`page.goto("/work-orders/pending")`<br>`page.click('[data-testid="approve-btn"]')`<br>`expect(page.locator('.ant-message')).toContainText('审批成功')` |

---

## 开发切入层级序列

### L1: 数据层（Day 1-2）

```
src/
├── models/
│   ├── work_order.py          # 工单模型
│   ├── audit_log.py           # 审计日志模型
│   └── notification.py       # 通知记录模型
└── migrations/
    └── add_approval_fields.sql
```

**交付物**：
- 工单表新增字段：`status`, `approved_by`, `approved_at`, `approval_comment`
- 审计日志表设计
- 通知记录表设计

### L2: 状态机层（Day 2-3）

```
src/
├── state_machine/
│   ├── machine.py             # 状态机定义
│   ├── transitions.py         # 状态流转规则
│   └── handlers.py            # 状态变更钩子
```

**交付物**：
- 状态机类，暴露 `can_transition()`, `transition()`, `get_available_actions()`
- 状态流转配置 (JSON/YAML)
- 状态变更前置/后置处理器

### L3: 服务层（Day 3-4）

```
src/
├── services/
│   ├── approval_service.py    # 审批业务逻辑
│   └── notification_service.py # 通知发送服务
├── schemas/
│   └── approval.py            # Pydantic 请求/响应模型
```

**交付物**：
- `ApprovalService.approve(work_order_id, user_id, action, comment)`
- `ApprovalService.batch_approve(work_order_ids, user_id, action)`
- 并发控制实现（乐观锁/悲观锁）
- 通知消息构造

### L4: API 层（Day 4-5）

```
src/
├── api/
│   ├── v1/
│   │   └── work_orders/
│   │       ├── router.py
│   │       └── endpoints.py
```

**交付物**：
| 接口 | 方法 | 路径 |
|------|------|------|
| 审批工单 | POST | `/api/v1/work-orders/{id}/approve` |
| 批量审批 | POST | `/api/v1/work-orders/batch-approve` |
| 获取待审批列表 | GET | `/api/v1/work-orders/pending` |
| 获取审批历史 | GET | `/api/v1/work-orders/{id}/audit-logs` |

### L5: 前端层（Day 5-7）

```
src/
├── pages/
│   └── work-order/
│       ├── PendingList.tsx
│       └── ApprovalModal.tsx
├── components/
│   └── ApprovalButton.tsx
└── hooks/
    └── useApproval.ts
```

**交付物**：
- 待审批工单列表页（含分页、筛选）
- 审批/驳回弹窗（含备注输入）
- 批量选择与操作
- 操作结果反馈 (Toast)

### L6: 通知集成层（Day 6-7）

```
src/
├── notifications/
│   ├── providers/
│   │   ├── email_provider.py
│   │   └── inapp_provider.py
│   └── tasks/
│       └── send_notification.py
```

**交付物**：
- 邮件通知发送
- 站内信通知写入
- 消息队列生产者配置
- 失败重试机制

### L7: 测试与集成（Day 7-8）

```
tests/
├── unit/
│   ├── test_state_machine.py
│   ├── test_approval_service.py
│   └── test_api_endpoints.py
├── integration/
│   └── test_approval_flow.py
└── e2e/
    └── test_approval_page.spec.ts
```

**交付物**：
- 单元测试覆盖所有 ATB 场景
- API 集成测试
- E2E 自动化测试

### L8: 部署与监控（Day 8）

```
ops/
├── helm/
│   └── work-order-approval/
└── monitoring/
    ├── dashboards/
    └── alerts/
```

**交付物**：
- Helm Chart 部署配置
- 审批延迟监控看板
- 审批失败告警规则

---

## 附录：状态机流转图

```
                              ┌─────────────┐
                              │    DRAFT    │
                              └──────┬──────┘
                                     │ submit
                                     ▼
                        ┌────────────────────────┐
                        │  PENDING_APPROVAL      │
                        └───────────┬────────────┘
                         ▲          │
                  reject │          │ approve
                         │          │
              ┌──────────┴───┐      │
              │   REJECTED   │      ▼
              └──────────────┘ ┌─────────────┐
                               │  APPROVED  │
                               └──────┬──────┘
                                      │ start
                                      ▼
                              ┌─────────────┐
                              │ IN_PROGRESS │
                              └──────┬──────┘
                                     │ complete
                                     ▼
                              ┌─────────────┐
                              │   CLOSED    │
                              └─────────────┘
```

---

## 修改文件清单

| 序号 | 文件路径 | 变更类型 |
|------|----------|----------|
| 1 | `frontend/tests/e2e/approval.spec.ts` | 修改 |
| 2 | `frontend/src/types/approval.ts` | 修改 |
| 3 | `backend/api/v1/schemas/reject_request.py` | 修改 |
| 4 | `src/api/v1/approval.py` | 修改 |
| 5 | `src/api/v1/workorders.py` | 修改 |
| 6 | `frontend/src/hooks/useApproval.ts` | 新增 |

---

**文档版本**: v3.0  
**迭代**: SWARM-2025-Q2-P0-003 Iteration 3  
**状态**: DRAFT for Review