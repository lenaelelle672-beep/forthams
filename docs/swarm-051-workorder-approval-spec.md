# 工单审批流程规格指导文档

**文档编号**: SWARM-051-Spec-v1.0  
**任务名称**: 工单审批流程  
**迭代周期**: Iteration 1  
**状态**: 草稿  
**创建日期**: 2024-01-15  
**负责人**: [待定]

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是企业资产管理系统中的核心业务流程，用于处理各类资产相关事务的审批需求。该流程覆盖从工单发起到审批完成的完整生命周期。

### 1.2 核心功能概述

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 工单发起 | 用户在前端填写工单信息并提交 | P0 |
| 审批链路 | 后端状态机驱动审批节点自动流转 | P0 |
| 通知触发 | 审批完成后向相关方发送通知 | P0 |

### 1.3 技术栈

- **前端框架**: React 18 + TypeScript
- **后端框架**: Python FastAPI
- **数据库**: PostgreSQL
- **状态机引擎**: Python `transitions` 库
- **实时通知**: WebSocket
- **测试框架**: Pytest + Playwright

---

## 2. 当前 Phase 对应实施目标

### Phase 1: 核心链路建设（本次迭代）

| 里程碑 | 目标 | 完成标准 |
|--------|------|----------|
| M1.1 | 完成工单数据模型与 CRUD 接口 | API 可调用，数据正确持久化 |
| M1.2 | 实现基础状态机流转逻辑 | 状态变更符合状态图定义 |
| M1.3 | 完成前端工单发起与审批界面 | UI 可交互，API 调用正常 |
| M1.4 | 实现通知触发机制 | WebSocket 推送成功送达 |

### Phase 2: 高级特性（后续迭代）

| 功能 | 描述 | 依赖 Phase |
|------|------|-----------|
| 审批流程可视化配置 | 支持拖拽配置审批节点 | Phase 1 |
| 审批意见与附件 | 支持上传附件、填写审批意见 | Phase 1 |
| 催办与加急机制 | 支持催办通知和加急审批 | Phase 1 |
| 并行审批节点 | 支持条件分支审批 | Phase 2 |

---

## 3. 边界约束

### 3.1 功能边界

```
✓ 允许: 单用户发起工单
✓ 允许: 单一审批链（线性审批）
✓ 允许: 审批通过/驳回两种结果
✓ 允许: 状态回退（驳回后可重新提交）
✗ 禁止: 并行审批节点
✗ 禁止: 条件分支审批
✗ 禁止: 第三方集成（如钉钉/企微）
✗ 禁止: 审批委托/转交
```

### 3.2 数据边界

| 约束项 | 限制值 | 备注 |
|--------|--------|------|
| 单工单最大附件数 | 3 | Phase 2 扩展 |
| 单附件大小上限 | 10MB | - |
| 审批意见最大长度 | 500 字符 | - |
| 工单标题最大长度 | 100 字符 | - |
| 工单描述最大长度 | 2000 字符 | - |
| 最大审批节点数 | 5 | - |

### 3.3 性能约束

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 状态变更响应时间 | < 500ms | API 响应时间 P99 |
| 工单列表查询响应时间 | < 1s | 列表页加载时间 |
| WebSocket 通知延迟 | < 2s | 消息发送至客户端接收 |
| 状态机流转成功率 | 99.9% | 错误重试机制保证 |

### 3.4 权限约束

| 角色 | 权限 |
|------|------|
| 普通用户 | 创建工单、查看自己的工单 |
| 审批人 | 审批分配给自己的工单 |
| 管理员 | 管理所有工单、配置审批流程 |

---

## 4. 工单状态机定义

### 4.1 状态定义

```
draft          → 草稿状态，工单已创建但未提交
pending_approval → 待审批状态，已提交等待审批
approved       → 已通过状态，审批流程完成且通过
rejected       → 已驳回状态，审批流程被驳回
cancelled      → 已取消状态，用户主动取消
```

### 4.2 状态转换图

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
┌─────────┐    ┌───────────────────┐    ┌─────────┐    ┌───────────┐
│  draft  │───▶│ pending_approval │───▶│ approved│     │ cancelled │
└─────────┘    └───────────────────┘    └─────────┘    └───────────┘
     │                  │
     │                  │
     │                  ▼
     │            ┌───────────┐
     └───────────▶│ rejected  │
                  └───────────┘
                       │
                       │ (重新提交)
                       ▼
                  ┌───────────────────┐
                  │ pending_approval   │
                  └───────────────────┘
```

### 4.3 状态转换规则

| 当前状态 | 触发事件 | 目标状态 | 条件 |
|----------|----------|----------|------|
| draft | submit | pending_approval | 工单信息完整 |
| pending_approval | approve | approved | 当前审批人为最后节点 |
| pending_approval | reject | rejected | - |
| pending_approval | cancel | cancelled | 仅创建者可取消 |
| rejected | resubmit | pending_approval | 修改后重新提交 |

---

## 5. 验收测试基准 (ATB)

### 5.1 工单发起测试矩阵

| 测试ID | 功能描述 | 测试方法 | 输入 | 期待结果 |
|--------|----------|----------|------|----------|
| `ATB-1-01` | 创建工单-成功 | `POST /api/workorders` | 完整工单数据 | 返回 201，携带工单ID |
| `ATB-1-02` | 工单数据持久化 | pytest: 查询数据库 | 工单ID | 工单状态为 `draft` |
| `ATB-1-03` | 字段校验-标题为空 | `POST /api/workorders` | title=null | 返回 422 校验错误 |
| `ATB-1-04` | 字段校验-标题超长 | `POST /api/workorders` | title=101字符 | 返回 422 校验错误 |
| `ATB-1-05` | 前端表单提交 | Playwright | 填写表单并提交 | 页面跳转至工单详情 |
| `ATB-1-06` | 工单列表查询 | `GET /api/workorders` | 分页参数 | 返回分页数据 |
| `ATB-1-07` | 工单详情查询 | `GET /api/workorders/{id}` | 工单ID | 返回完整工单数据 |

**Pytest 片段 - 工单创建**:
```python
def test_create_workorder_returns_201():
    """测试创建工单返回 201 状态码"""
    response = client.post("/api/workorders", json={
        "title": "设备采购申请",
        "description": "需采购显示器3台",
        "priority": "normal",
        "category": "procurement"
    })
    assert response.status_code == 201
    assert "workorder_id" in response.json()
    assert response.json()["status"] == "draft"

def test_workorder_title_required():
    """测试工单标题为必填字段"""
    response = client.post("/api/workorders", json={
        "description": "测试描述"
    })
    assert response.status_code == 422
    assert "title" in response.json()["detail"].lower()
```

### 5.2 状态机流转测试矩阵

| 测试ID | 功能描述 | 测试方法 | 输入 | 期待结果 |
|--------|----------|----------|------|----------|
| `ATB-2-01` | 提交审批触发流转 | `POST /api/workorders/{id}/submit` | draft 状态工单 | 状态 → `pending_approval` |
| `ATB-2-02` | 审批通过状态变更 | `POST /api/workorders/{id}/approve` | pending_approval 工单 | 状态 → `approved` |
| `ATB-2-03` | 审批驳回状态变更 | `POST /api/workorders/{id}/reject` | pending_approval 工单 | 状态 → `rejected` |
| `ATB-2-04` | 非法状态转换拦截 | `approve` draft 状态工单 | draft 状态工单 | 返回 400 状态机异常 |
| `ATB-2-05` | 状态流转历史记录 | pytest: 查询数据库 | 状态变更后 | `state_transitions` 记录 +1 |
| `ATB-2-06` | 重复提交拦截 | 连续两次 submit | pending_approval 工单 | 返回 400 错误 |
| `ATB-2-07` | 重新提交恢复流程 | `POST /api/workorders/{id}/resubmit` | rejected 状态工单 | 状态 → `pending_approval` |

**Pytest 片段 - 状态机**:
```python
def test_submit_triggers_state_transition_to_pending():
    """测试提交触发状态转换到 pending_approval"""
    workorder = create_test_workorder()
    response = client.post(f"/api/workorders/{workorder.id}/submit")
    assert response.status_code == 200
    assert response.json()["status"] == "pending_approval"

def test_approve_from_invalid_state_raises_400():
    """测试非法状态转换返回 400"""
    workorder = create_test_workorder()  # status = draft
    response = client.post(f"/api/workorders/{workorder.id}/approve")
    assert response.status_code == 400
    assert "invalid state transition" in response.json()["detail"].lower()

def test_state_transition_history_recorded():
    """测试状态转换被记录到历史表"""
    workorder = create_test_workorder()
    initial_count = db.query("SELECT COUNT(*) FROM state_transitions WHERE workorder_id=?", 
                              [workorder.id])[0]
    client.post(f"/api/workorders/{workorder.id}/submit")
    new_count = db.query("SELECT COUNT(*) FROM state_transitions WHERE workorder_id=?", 
                          [workorder.id])[0]
    assert new_count == initial_count + 1
```

### 5.3 审批链路测试矩阵

| 测试ID | 功能描述 | 测试方法 | 输入 | 期待结果 |
|--------|----------|----------|------|----------|
| `ATB-3-01` | 审批人列表获取 | `GET /api/workorders/{id}/approvers` | 工单ID | 返回审批人数组 |
| `ATB-3-02` | 当前审批节点识别 | pytest: 检查工单详情 | 工单ID | `current_approver_index` 正确 |
| `ATB-3-03` | 连续审批流转 | submit → approve | 多级审批链 | 审批人索引递增 |
| `ATB-3-04` | 审批意见记录 | `POST /api/workorders/{id}/approve` | 含意见数据 | 审批记录含意见 |
| `ATB-3-05` | 非审批人拒绝操作 | 其他用户 approve | 非审批人 | 返回 403 权限错误 |

### 5.4 通知触发测试矩阵

| 测试ID | 功能描述 | 测试方法 | 输入 | 期待结果 |
|--------|----------|----------|------|----------|
| `ATB-4-01` | 审批完成 WebSocket 推送 | Playwright + WebSocket | 审批操作完成 | 收到 JSON 消息 |
| `ATB-4-02` | 消息内容完整性 | pytest: Mock WebSocket | 审批完成 | 包含 `workorder_id`, `result`, `timestamp` |
| `ATB-4-03` | 通知记录持久化 | pytest: 查询数据库 | 审批完成 | `notifications` 记录存在 |
| `ATB-4-04` | 驳回通知推送 | WebSocket 监听 | 工单被驳回 | 收到驳回通知 |
| `ATB-4-05` | 通知消息格式 | 检查消息 JSON | 通知触发 | 符合 `NotificationPayload` Schema |

**Playwright 片段**:
```typescript
test('websocket notification on approval completion', async ({ page }) => {
  const wsMessages: NotificationPayload[] = [];
  
  // 监听 WebSocket 消息
  page.on('websocket', ws => {
    ws.on('frames', frame => {
      wsMessages.push(JSON.parse(frame));
    });
  });
  
  // 触发审批
  await page.goto(`/workorder/${workorderId}`);
  await page.click('[data-testid="approve-btn"]');
  await page.waitForTimeout(2000);
  
  // 验证收到通知
  const approvalNotification = wsMessages.find(
    msg => msg.event_type === 'approval_completed'
  );
  expect(approvalNotification).toBeDefined();
  expect(approvalNotification.workorder_id).toBe(workorderId);
});
```

### 5.5 前端 E2E 测试矩阵

| 测试ID | 功能描述 | 测试场景 |
|--------|----------|----------|
| `ATB-5-01` | 工单创建页面加载 | 访问创建页面，验证表单元素存在 |
| `ATB-5-02` | 工单列表页筛选 | 使用状态筛选，验证结果正确 |
| `ATB-5-03` | 审批操作界面 | 进入详情页，验证审批按钮可见 |
| `ATB-5-04` | 状态变更 UI 更新 | 执行审批操作，验证页面状态更新 |

---

## 6. 开发切入层级序列

### 6.1 L1: 数据层（Day 1-2）

**目标**: 完成数据库 Schema 设计与 ORM 模型

```
backend/
├── alembic/versions/
│   └── 001_create_workorder_tables.py    # 工单表迁移脚本
├── src/models/
│   ├── workorder.py                       # 工单 ORM 模型
│   ├── approval_chain.py                  # 审批链模型
│   └── enums.py                           # 状态枚举定义
└── src/repositories/
    └── workorder_repository.py             # 工单数据访问层
```

**验收标准**:
- [ ] 数据库迁移脚本可执行
- [ ] ORM 模型字段映射正确
- [ ] 基础 CRUD 操作可用

### 6.2 L2: 业务逻辑层（Day 3-5）

**目标**: 实现状态机与工单服务

```
backend/src/
├── state_machine/
│   ├── states.py                          # 状态定义
│   ├── transitions.py                      # 转换规则
│   ├── guards.py                           # 守卫条件
│   └── approval_state_machine.py           # 审批状态机
├── services/
│   ├── workorder_service.py                # 工单业务服务
│   ├── approval_chain_service.py           # 审批链服务
│   └── notification_service.py              # 通知服务
└── schemas/
    ├── workorder.py                        # 工单 Schema
    └── approval.py                         # 审批 Schema
```

**验收标准**:
- [ ] 状态机状态转换符合定义
- [ ] 非法转换被正确拦截
- [ ] 状态历史记录完整

### 6.3 L3: 接口层（Day 5-7）

**目标**: 完成 API 路由与请求处理

```
backend/src/api/
├── routers/
│   ├── workorder_router.py                 # 工单路由
│   └── approval_router.py                   # 审批路由
├── deps/
│   └── auth.py                             # 认证依赖
└── middleware/
    └── audit_logger.py                     # 审计日志中间件
```

**验收标准**:
- [ ] API 响应符合 OpenAPI 规范
- [ ] 请求校验正确执行
- [ ] 错误响应格式统一

### 6.4 L4: 通知层（Day 7-8）

**目标**: 实现 WebSocket 实时通知

```
backend/src/
├── websocket/
│   └── manager.py                          # WebSocket 连接管理
└── services/notification/
    ├── producer.py                         # 消息生产者
    └── formatters.py                       # 消息格式化
```

**验收标准**:
- [ ] WebSocket 连接管理正常
- [ ] 消息推送延迟 < 2s
- [ ] 连接断开自动重连

### 6.5 L5: 前端层（Day 8-12）

**目标**: 完成前端工单与审批界面

```
frontend/src/
├── pages/
│   ├── WorkOrder/
│   │   ├── Create.tsx                      # 工单创建页
│   │   ├── List.tsx                        # 工单列表页
│   │   └── Detail.tsx                      # 工单详情与审批
│   └── AssetDetailPage/
│       └── components/
│           └── AuditLogPanel/
│               └── AuditLogEntry.tsx       # 审计日志条目
├── hooks/
│   └── useAssetById.ts                     # 资产查询 Hook
├── services/
│   └── workorderService.ts                 # 工单 API 服务
└── stores/
    └── approvalStore.ts                    # 审批状态管理
```

**验收标准**:
- [ ] 工单创建表单可用
- [ ] 审批操作界面交互正常
- [ ] WebSocket 通知实时显示

### 6.6 L6: 集成测试（Day 13-14）

**目标**: 端到端流程验证

```
frontend/tests/e2e/
└── approval.spec.ts                        # 审批流程 E2E 测试

backend/tests/
├── test_workorder_service.py               # 服务层测试
├── test_state_machine.py                    # 状态机测试
└── test_approval_api.py                     # API 测试
```

**验收标准**:
- [ ] E2E 测试全部通过
- [ ] 状态机边界条件覆盖
- [ ] API 集成测试覆盖

---

## 7. 依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                         开发顺序依赖                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [L1 数据层] ──────────────────────────────────────────────────  │
│       │                                                        │
│       ▼                                                        │
│  [L2 业务逻辑层] ──依赖──▶ [L1 数据层]                           │
│       │                                                        │
│       ▼                                                        │
│  [L3 接口层] ──依赖──▶ [L2 业务逻辑层]                           │
│       │                                                        │
│       ▼                                                        │
│  [L4 通知层] ──依赖──▶ [L3 接口层 触发]                          │
│       │                                                        │
│       ▼                                                        │
│  [L5 前端层] ──依赖──▶ [L3 接口层 API]                           │
│       │                                                        │
│       ▼                                                        │
│  [L6 集成测试] ──验证──▶ [L1~L5 全部]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 关键决策记录

| 决策ID | 决策内容 | 理由 | 日期 |
|--------|----------|------|------|
| DEC-001 | 状态机使用 `transitions` 库 | 社区成熟，降低维护成本 | 2024-01-15 |
| DEC-002 | WebSocket 替代轮询 | 满足实时性要求，减少服务端负载 | 2024-01-15 |
| DEC-003 | 审批链存储于独立表 | 支持审批链路灵活配置与历史追溯 | 2024-01-15 |
| DEC-004 | 状态历史持久化 | 支持审计追溯和问题排查 | 2024-01-15 |
| DEC-005 | 单一审批链限制 | Phase 1 聚焦核心流程，降低复杂度 | 2024-01-15 |

---

## 9. API 规格摘要

### 9.1 工单接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/workorders` | 创建工单 |
| GET | `/api/workorders` | 查询工单列表 |
| GET | `/api/workorders/{id}` | 获取工单详情 |
| PUT | `/api/workorders/{id}` | 更新工单 |
| DELETE | `/api/workorders/{id}` | 删除工单 |
| POST | `/api/workorders/{id}/submit` | 提交审批 |

### 9.2 审批接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/workorders/{id}/approve` | 审批通过 |
| POST | `/api/workorders/{id}/reject` | 审批驳回 |
| POST | `/api/workorders/{id}/resubmit` | 重新提交 |
| POST | `/api/workorders/{id}/cancel` | 取消工单 |
| GET | `/api/workorders/{id}/approvers` | 获取审批链 |
| GET | `/api/workorders/{id}/history` | 获取审批历史 |

---

## 10. 数据模型

### 10.1 WorkOrder 表

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | UUID | PK | 工单唯一标识 |
| title | VARCHAR(100) | NOT NULL | 工单标题 |
| description | TEXT | - | 工单描述 |
| status | ENUM | NOT NULL | 当前状态 |
| priority | ENUM | NOT NULL | 优先级 |
| category | VARCHAR(50) | NOT NULL | 工单类别 |
| creator_id | UUID | FK | 创建人 |
| current_approver_index | INT | DEFAULT 0 | 当前审批节点索引 |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

### 10.2 StateTransition 表

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | UUID | PK | 记录唯一标识 |
| workorder_id | UUID | FK | 工单ID |
| from_state | ENUM | NOT NULL | 原状态 |
| to_state | ENUM | NOT NULL | 目标状态 |
| trigger_event | VARCHAR(50) | NOT NULL | 触发事件 |
| actor_id | UUID | - | 执行人 |
| comment | TEXT | - | 操作备注 |
| created_at | TIMESTAMP | NOT NULL | 执行时间 |

### 10.3 ApprovalChain 表

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | UUID | PK | 记录唯一标识 |
| workorder_id | UUID | FK | 工单ID |
| approver_id | UUID | FK | 审批人ID |
| node_index | INT | NOT NULL | 节点顺序 |
| status | ENUM | NOT NULL | 节点状态 |
| comment | TEXT | - | 审批意见 |
| approved_at | TIMESTAMP | - | 审批时间 |

---

## 11. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 状态机并发问题 | 高 | 中 | 使用数据库事务锁 |
| WebSocket 连接不稳定 | 中 | 中 | 实现断线重连机制 |
| 审批链配置复杂 | 中 | 低 | Phase 2 简化配置 |
| 通知丢失 | 低 | 低 | 消息队列持久化 |

---

## 12. 附录

### 12.1 术语表

| 术语 | 定义 |
|------|------|
| WorkOrder | 工单，系统中的业务处理单元 |
| State Machine | 状态机，定义状态转换逻辑 |
| Approval Chain | 审批链，多级审批人组成的链路 |
| WebSocket | 双向通信协议，用于实时通知 |

### 12.2 参考文档

- [状态机设计模式](https://github.com/pytransitions/transitions)
- [FastAPI WebSocket 文档](https://fastapi.tiangolo.com/advanced/websockets/)
- [Playwright 测试指南](https://playwright.dev/docs/intro)

---

**文档结束**

**版本历史**:
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2024-01-15 | - | 初始版本 |