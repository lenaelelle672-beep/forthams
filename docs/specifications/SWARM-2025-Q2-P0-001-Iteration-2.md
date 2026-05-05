# 工单审批流程引擎规格指导文档
# SWARM-2025-Q2-P0-001 - Iteration 2

---

## 需求与背景

### 业务背景

当前系统缺少统一的工单审批流程机制，用户通过前端发起的审批请求缺乏自动化流转能力，审批人无法获得实时通知，导致审批效率低下、状态追踪困难。

### 核心需求

1. **工单发起**：用户在前端完成工单创建并提交审批申请
2. **状态机驱动**：系统基于预定义规则自动推进工单状态流转
3. **实时通知**：审批人通过 WebSocket/Push 获得工单到达的即时通知
4. **状态追溯**：完整记录工单生命周期各节点操作日志

### 业务价值

- 减少人工催批操作，提升审批效率
- 流程可视化，增强状态透明度
- 通知即时触达，降低响应延迟

---

## 当前 Phase 对应实施目标

### Phase 拆解对齐

| Phase | 周期 | 目标 | Iteration |
|-------|------|------|-----------|
| Phase 1 | Q2 W1-W2 | 核心状态机与数据模型建立 | Iteration 1 |
| **Phase 2** | **Q2 W3-W4** | **前端工单发起 + 实时通知集成** | **Iteration 2** |
| Phase 3 | Q2 W5-W6 | 高级审批规则与审计日志 | Iteration 3 |

### Iteration 2 实施范围

本次 Iteration 聚焦以下交付物：

1. **前端工单发起界面**
   - 工单表单组件（含字段验证）
   - 提交后即时状态反馈

2. **后端工单创建 API**
   - POST `/api/v1/work-orders`
   - 工单数据持久化

3. **状态机核心驱动**
   - 状态定义：`DRAFT` → `PENDING_APPROVAL` → `APPROVED`/`REJECTED`
   - 触发器绑定与状态转移逻辑

4. **实时通知服务**
   - WebSocket 连接管理
   - 审批人消息推送

---

## 边界约束

### 技术约束

| 约束项 | 规格 |
|--------|------|
| 状态机引擎 | 必须基于 XState 5.x 或等效有限状态机实现 |
| 实时通信 | WebSocket 协议，支持断线重连 |
| 数据库 | PostgreSQL 13+，事务支持 |
| API 风格 | RESTful，JSON 请求/响应 |

### 性能约束

- 状态转移响应时间 ≤ 200ms（P99）
- WebSocket 消息推送延迟 ≤ 500ms（P99）
- 并发工单处理能力 ≥ 100 TPS

### 业务约束

- 工单一旦进入 `PENDING_APPROVAL` 状态，发起人不得直接修改内容
- 审批人必须与工单发起人不同（防篡改）
- 每个状态转移必须记录操作人和时间戳

### 安全约束

- API 认证：JWT Bearer Token
- 权限控制：发起人仅可查看/撤回自己的工单；审批人仅可审批分配给自己的工单
- 通知权限：仅向当前审批人推送，不得暴露其他工单信息

---

## 验收测试基准 (ATB)

### 测试层级矩阵

#### L1 - 单元测试（pytest）

| 测试ID | 功能点 | 测试输入 | 期待结果 |
|--------|--------|----------|----------|
| `UT-201` | 工单创建 API | `{"title": "采购申请", "content": "...", "applicant_id": "user_001", "approver_id": "user_002"}` | 返回 201，生成带 UUID 的工单记录 |
| `UT-202` | 状态机初始化 | 新建工单 | 初始状态为 `DRAFT` |
| `UT-203` | 状态转移验证 | 从 `DRAFT` 触发 `SUBMIT` 事件 | 状态转为 `PENDING_APPROVAL` |
| `UT-204` | 非法状态转移 | 从 `PENDING_APPROVAL` 触发 `SUBMIT` 事件 | 抛出 `InvalidTransitionError` |
| `UT-205` | 审批人通知触发 | 状态转为 `PENDING_APPROVAL` | 调用通知服务一次 |
| `UT-206` | 工单查询过滤 | 查询参数 `?applicant_id=user_001` | 仅返回该用户的工单 |

```python
# pytest 用例示例（UT-201）
def test_work_order_creation_api(client, db_session):
    payload = {
        "title": "采购申请",
        "content": "购买服务器 3 台",
        "applicant_id": "user_001",
        "approver_id": "user_002"
    }
    response = client.post("/api/v1/work-orders", json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data["id"] is not None
    assert data["status"] == "DRAFT"
```

#### L2 - 集成测试（pytest + testcontainers）

| 测试ID | 功能点 | 测试场景 | 期待结果 |
|--------|--------|----------|----------|
| `IT-201` | 完整审批流程 | 发起→提交→审批通过 | 工单状态最终为 `APPROVED`，操作日志完整 |
| `IT-202` | 拒绝后重新提交 | 发起→提交→拒绝→修改→重新提交 | 状态恢复 `PENDING_APPROVAL` |
| `IT-203` | 并发状态转移 | 同一工单并发 `SUBMIT` 事件 | 仅一次成功，其余返回 409 Conflict |
| `IT-204` | WebSocket 连接保活 | 发送 ping，60s 无消息 | 连接保持，断开则重连 |

#### L3 - E2E 测试（Playwright）

| 测试ID | 功能点 | 操作步骤 | 期待结果 |
|--------|--------|----------|----------|
| `E2E-201` | 前端工单创建 | 登录 → 点击"新建工单" → 填写表单 → 提交 | 页面跳转至工单详情，显示 `DRAFT` 状态 |
| `E2E-202` | 实时通知 | 工单提交后审批人页面 | 右上角出现通知弹窗，显示工单标题 |
| `E2E-203` | 审批操作 | 审批人点击"通过"按钮 | 工单状态更新为 `APPROVED`，发起人收到通知 |

```typescript
// Playwright 用例示例（E2E-202）
test('审批人收到实时通知', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  const approver = await loginAs('approver_user');
  await approver.goto('/dashboard');
  
  const applicant = await loginAs('applicant_user');
  await applicant.fillWorkOrderForm({ title: '紧急采购' });
  await applicant.submitWorkOrder();
  
  await expect(approver.locator('.notification-toast')).toBeVisible({ timeout: 5000 });
  await expect(approver.locator('.notification-toast')).toContainText('紧急采购');
});
```

### 验收通过准则

- [ ] 所有 L1 测试通过率 100%
- [ ] 所有 L2 测试通过率 100%
- [ ] 所有 L3 E2E 测试通过率 100%
- [ ] 状态机状态转移覆盖率 ≥ 95%
- [ ] API 响应时间满足性能约束

---

## 开发切入层级序列

### 依赖关系图

```
┌─────────────────────────────────────────────────┐
│                  L4: 前端 UI 层                   │
│        (工单表单 / 状态展示 / 通知组件)            │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│               L3: API 网关层                      │
│        (JWT 验证 / 路由分发 / 限流)              │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│            L2: 业务逻辑层                         │
│   (工单服务 / 状态机驱动 / 权限校验)              │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│             L1: 数据持久层                        │
│    (工单模型 / 状态历史 / 用户关系映射)           │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│            L0: 基础设施层                         │
│   (数据库 / 消息队列 / WebSocket Server)          │
└─────────────────────────────────────────────────┘
```

### 开发时序计划

| 阶段 | 层级 | 任务项 | 交付物 |
|------|------|--------|--------|
| **Phase 2.1** | L0 → L1 | 数据库表设计、模型创建、迁移脚本 | `models/work_order.py`, `alembic/versions/` |
| **Phase 2.2** | L1 → L2 | 工单 CRUD API、状态机实现、通知触发器 | `services/work_order_service.py`, `state_machine/` |
| **Phase 2.3** | L2 → L3 | API 路由注册、权限中间件集成 | `routes/work_orders.py`, `middleware/auth.py` |
| **Phase 2.4** | L3 → L4 | 前端工单表单组件、状态展示、通知订阅 | `components/WorkOrderForm.vue`, `hooks/useNotification.ts` |
| **Phase 2.5** | 全栈 | E2E 测试编写、回归验证 | `tests/e2e/work_order.spec.ts` |

### 技术栈清单

| 层级 | 技术选型 |
|------|----------|
| 前端 | Vue 3 + TypeScript + Vite |
| 后端 | FastAPI + Pydantic + SQLAlchemy |
| 状态机 | XState 5.x (Python) 或自定义 FSM |
| WebSocket | Socket.IO 或 native WebSocket |
| 数据库 | PostgreSQL 13 + Alembic |
| 测试 | pytest + Playwright + testcontainers |
| 部署 | Docker Compose |

---

## 附录：状态机状态图（Iteration 2 范围）

```
           ┌──────────┐
           │  DRAFT   │
           └────┬─────┘
                │ SUBMIT
                ▼
    ┌───────────────────────┐
───►│   PENDING_APPROVAL    │◄─── RESUBMIT (from REJECTED)
    └───────┬───────────────┘
            │
      ┌─────┴─────┐
      │           │
  APPROVE     REJECT
      │           │
      ▼           ▼
  ┌────────┐  ┌──────────┐
  │APPROVED│  │ REJECTED │
  └────────┘  └──────────┘
```

**注意**：Iteration 2 仅实现 `DRAFT` → `PENDING_APPROVAL` 的自动流转，`APPROVED`/`REJECTED` 状态的审批人操作在 Iteration 3 中完成。

---

## 附录：关键文件路径参考

| 模块 | 文件路径 | 说明 |
|------|----------|------|
| 审批命令 | `src/application/commands/approve_work_order.py` | 工单审批核心命令实现 |
| 状态机 | `backend/state_machine/workorder_state_machine.py` | 工单状态流转定义 |
| 工单服务 | `src/domain/services/work_order_service.py` | 工单业务逻辑层 |
| 工单模型 | `frontend/src/pages/WorkOrder/types/workOrder.ts` | 前端工单类型定义 |
| 工单API | `frontend/src/api/workorder.ts` | 前端工单API调用 |

---

*文档版本：v2.0 | 关联 Iteration：Iteration 2 | 状态：REVIEW_PENDING*