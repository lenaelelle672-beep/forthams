# SWARM-001 工单审批流程 规格指导文档

---

## 1. 需求与背景

### 1.1 业务场景

企业级应用中，工单审批是核心流程之一。用户通过前端界面提交工单审批申请，后端根据预设的审批规则进行状态机流转，并通过通知机制实时告知相关审批人处理。

| 能力维度 | 描述 |
|---------|------|
| 工单提交 | 用户填写工单信息并发起审批申请 |
| 状态流转 | 后端实现有限状态机（FSM）控制工单生命周期 |
| 审批通知 | 审批状态变更时主动通知审批人 |
| 审批处理 | 审批人对工单执行通过/拒绝/退回等操作 |

### 1.2 技术目标

- 构建可扩展的工单状态机框架，支持多级审批链
- 实现前端与后端的职责分离，API 驱动
- 确保状态流转的事务一致性和幂等性

---

## 2. 当前 Phase 对应实施目标

> **Phase 拆解说明**：基于典型工单审批系统架构，本迭代定义 4 个实施阶段。

### Phase 1：数据模型与状态机核心

| 实施项 | 规格要求 |
|-------|---------|
| 工单数据表 | `work_orders` 表，含 `id`, `title`, `description`, `status`, `creator_id`, `created_at`, `updated_at` |
| 审批记录表 | `approval_records` 表，记录每一步审批操作及审批意见 |
| 状态定义 | `PENDING` → `APPROVING` → `APPROVED` / `REJECTED` / `CANCELLED` |
| 状态机引擎 | 封装状态转换校验与持久化逻辑 |

### Phase 2：审批流程与 API 接口

| 实施项 | 规格要求 |
|-------|---------|
| 提交工单 API | `POST /api/work-orders` 创建工单并触发初始流转 |
| 查询工单 API | `GET /api/work-orders/{id}` 获取工单详情及审批历史 |
| 审批操作 API | `POST /api/work-orders/{id}/approve` 或 `/reject` |
| 列表查询 API | `GET /api/work-orders?status={}&page={}` 分页查询 |

### Phase 3：前端交互与通知触发

| 实施项 | 规格要求 |
|-------|---------|
| 工单提交表单 | 必填字段校验、提交成功反馈 |
| 工单列表页 | 按状态筛选、分页展示 |
| 审批操作页 | 审批意见输入、通过/拒绝按钮 |
| 通知推送 | 状态变更时触发通知事件写入消息队列 |

### Phase 4：通知机制实现

| 实施项 | 规格要求 |
|-------|---------|
| 通知模型 | `notifications` 表存储通知记录 |
| 通知渠道 | 支持邮件/WebSocket 推送双通道 |
| 未读统计 | 审批人未处理工单数量 Badge 展示 |

---

## 3. 边界约束

### 3.1 强制约束

| 约束类型 | 具体规则 |
|---------|---------|
| 状态转换约束 | 仅允许 `PENDING → APPROVING`、`APPROVING → APPROVED/REJECTED` 转换，拒绝非法状态跃迁 |
| 幂等性约束 | 重复提交同一工单须返回已有工单 ID，不创建重复记录 |
| 事务约束 | 状态变更与审批记录写入必须在同一事务内完成 |
| 权限约束 | 仅审批链中的审批人可执行审批操作 |
| 并发约束 | 同一工单不允许同时被两个审批人处理，需加行级锁 |

### 3.2 限制性约束

| 约束类型 | 具体规则 |
|---------|---------|
| 工单内容限制 | `title` 最大 200 字符，`description` 最大 5000 字符 |
| 审批意见限制 | 审批意见最大 1000 字符 |
| 列表分页限制 | 每页最大 50 条记录 |
| 通知延迟容忍 | 通知投递延迟不超过 5 秒 |

### 3.3 异常处理约束

| 场景 | 处理策略 |
|-----|---------|
| 审批人不存在 | 返回 404，状态保持不变 |
| 状态已转换 | 返回 409 Conflict，拒绝操作 |
| 数据库连接失败 | 事务回滚，返回 503 Service Unavailable |
| 通知服务不可用 | 降级写入本地通知表，重试机制补偿 |

---

## 4. 验收测试基准 (ATB)

### ATB-1：工单创建

```
Test ID      : ATB-1.1
测试描述     : 有效用户提交工单后返回 201 且工单状态为 PENDING
物理测试期待 : 
  - pytest: POST /api/work-orders 返回 201
  - pytest: 验证数据库 work_orders.status == 'PENDING'
  - pytest: 验证 creator_id 正确关联

Test ID      : ATB-1.2
测试描述     : 提交缺失必填字段工单返回 400
物理测试期待 :
  - playwright: 表单提交空 title 触发客户端校验提示
  - pytest: POST /api/work-orders payload 缺 title 返回 422

Test ID      : ATB-1.3
测试描述     : 重复提交同一工单返回幂等结果
物理测试期待 :
  - pytest: 携带相同 idempotency_key 重复 POST 返回相同工单 ID
```

### ATB-2：状态机流转

```
Test ID      : ATB-2.1
测试描述     : 合法状态转换 PENDING → APPROVING 成功
物理测试期待 :
  - pytest: 工单创建后自动触发状态流转，status 变为 APPROVING
  - pytest: 审批记录表生成对应 entry

Test ID      : ATB-2.2
测试描述     : 非法状态转换被拒绝并返回 409
物理测试期待 :
  - pytest: 已 APPROVED 工单再次执行 approve 返回 409
  - pytest: 状态保持 APPROVED 不变

Test ID      : ATB-2.3
测试描述     : 审批操作生成正确审批记录
物理测试期待 :
  - pytest: approve/reject 操作后 approval_records 表有对应记录
  - pytest: 记录包含 approver_id、action、comment、timestamp

Test ID      : ATB-2.4
测试描述     : 并发审批请求仅有一个成功
物理测试期待 :
  - pytest: 使用数据库行锁，模拟并发 approve 仅一请求返回 200
  - pytest: 另一请求返回 409 或超时
```

### ATB-3：API 查询

```
Test ID      : ATB-3.1
测试描述     : 单条工单查询返回完整信息及审批历史
物理测试期待 :
  - pytest: GET /api/work-orders/{id} 返回工单详情
  - pytest: 响应中嵌套 approval_history 数组

Test ID      : ATB-3.2
测试描述     : 分页列表查询返回正确分页元数据
物理测试期待 :
  - playwright: 列表页显示分页信息（总页数、当前页）
  - pytest: GET /api/work-orders?page=1&size=10 返回 10 条记录
  - pytest: 响应包含 pagination meta (total, page, size)
```

### ATB-4：通知机制

```
Test ID      : ATB-4.1
测试描述     : 工单状态变更时通知消息被写入消息表
物理测试期待 :
  - pytest: 状态流转后 notifications 表有新增记录
  - pytest: 通知对象为当前审批人

Test ID      : ATB-4.2
测试描述     : WebSocket 连接审批人收到实时推送
物理测试期待 :
  - playwright: 审批人 WebSocket 客户端在审批触发后 5s 内收到消息
  - playwright: 消息 payload 包含工单 ID 和新状态

Test ID      : ATB-4.3
测试描述     : 通知服务不可用时降级存储
物理测试期待 :
  - pytest: mock 通知服务故障，工单状态仍成功流转
  - pytest: notifications 表标记为 failed，pending_retry=true
```

### ATB-5：前端交互

```
Test ID      : ATB-5.1
测试描述     : 用户成功提交工单后获得成功提示
物理测试期待 :
  - playwright: 填写表单后点击提交，显示 success toast
  - playwright: 页面跳转至工单详情页

Test ID      : ATB-5.2
测试描述     : 审批人执行拒绝操作后工单状态更新
物理测试期待 :
  - playwright: 审批详情页填写意见后点击拒绝
  - playwright: 工单状态立即更新为 REJECTED，页面反馈变化
```

---

## 5. 开发切入层级序列

### 5.1 层级依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│                     L5 前端展示层                        │
│  (Vue/React 组件、页面路由、用户交互)                     │
├─────────────────────────────────────────────────────────┤
│                     L4 API 网关层                        │
│  (REST Controller、请求校验、路由分发)                    │
├─────────────────────────────────────────────────────────┤
│                     L3 业务服务层                        │
│  (WorkOrderService、ApprovalService、NotificationService)│
├─────────────────────────────────────────────────────────┤
│                     L2 状态机引擎层                      │
│  (StateMachine、TransitionRule、TransitionValidator)     │
├─────────────────────────────────────────────────────────┤
│                     L1 数据持久层                        │
│  (SQLAlchemy Models、Repository、Migrations)             │
└─────────────────────────────────────────────────────────┘
```

### 5.2 开发实施顺序

| 阶段 | 切入层级 | 交付物 | 依赖关系 |
|------|---------|--------|---------|
| **Phase 1.1** | L1 数据持久层 | 数据库 Model、Migration 文件 | 无 |
| **Phase 1.2** | L2 状态机引擎层 | StateMachine 类、状态转换规则 | L1 |
| **Phase 2.1** | L3 业务服务层 | WorkOrderService、ApprovalService | L2 |
| **Phase 2.2** | L4 API 网关层 | REST API Controller | L3 |
| **Phase 3.1** | L4 API 测试 | pytest API 测试用例 | L4 |
| **Phase 3.2** | L5 前端展示层 | 工单表单、列表页、审批页 | L4 API |
| **Phase 3.3** | L5 前端测试 | playwright E2E 测试 | L5 组件 |
| **Phase 4.1** | L3 通知服务层 | NotificationService | L2, L1 |
| **Phase 4.2** | L4 集成通知 | WebSocket Handler | L3 通知服务 |

### 5.3 关键切点说明

| 切点 | 验收标准 |
|------|---------|
| **L1 完成后** | 数据库迁移脚本可执行，表结构符合规格 |
| **L2 完成后** | 状态机单元测试覆盖所有合法/非法转换路径 |
| **L3 完成后** | Service 层业务逻辑测试覆盖率 ≥ 80% |
| **L4 API 完成后** | 所有 REST API 通过 pytest 契约测试 |
| **L5 前端完成后** | Playwright E2E 覆盖核心用户路径 (提交→审批→通知) |

---

## 6. 状态机状态图

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │ (自动触发)
                           ▼
                    ┌─────────────┐
          ┌────────▶│  APPROVING  │◀────────┐
          │         └──────┬──────┘         │
          │                │               │
          │         ┌──────┴──────┐        │
          │         ▼             ▼        │
   ┌─────────────┐      ┌─────────────┐    │
   │  REJECTED   │      │  APPROVED   │    │
   └─────────────┘      └─────────────┘    │
                                      │
                           ┌───────────┴───────────┐
                           ▼                       ▼
                    ┌─────────────┐          ┌─────────────┐
                    │ CANCELLED   │          │ (归档/已完成)│
                    └─────────────┘          └─────────────┘
```

---

## 7. API 接口规格

### 7.1 工单创建

```
POST /api/work-orders
Content-Type: application/json

Request Body:
{
  "title": "string (必填, 最大200字符)",
  "description": "string (最大5000字符)",
  "priority": "LOW | MEDIUM | HIGH | URGENT",
  "category": "string",
  "idempotency_key": "string (可选, 用于幂等控制)"
}

Response 201:
{
  "code": 201,
  "message": "工单创建成功",
  "data": {
    "id": "string",
    "title": "string",
    "description": "string",
    "status": "PENDING",
    "priority": "string",
    "category": "string",
    "creator_id": "string",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 7.2 工单查询

```
GET /api/work-orders/{id}

Response 200:
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "string",
    "title": "string",
    "description": "string",
    "status": "APPROVING",
    "priority": "string",
    "category": "string",
    "creator_id": "string",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "approval_history": [
      {
        "id": "string",
        "action": "APPROVE | REJECT | SUBMIT",
        "approver_id": "string",
        "comment": "string",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

### 7.3 工单审批

```
POST /api/work-orders/{id}/approve
Content-Type: application/json

Request Body:
{
  "comment": "string (可选, 最大1000字符)"
}

Response 200:
{
  "code": 200,
  "message": "审批通过",
  "data": {
    "id": "string",
    "status": "APPROVED",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}

POST /api/work-orders/{id}/reject
Content-Type: application/json

Request Body:
{
  "comment": "string (拒绝原因, 最大1000字符)"
}

Response 200:
{
  "code": 200,
  "message": "工单已拒绝",
  "data": {
    "id": "string",
    "status": "REJECTED",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## 8. 错误码定义

| HTTP Status | 错误码 | 说明 |
|-------------|--------|------|
| 400 | `INVALID_REQUEST` | 请求参数校验失败 |
| 401 | `UNAUTHORIZED` | 用户未认证 |
| 403 | `FORBIDDEN` | 无权限执行该操作 |
| 404 | `NOT_FOUND` | 工单或审批人不存在 |
| 409 | `STATE_CONFLICT` | 状态转换冲突（如已审批工单重复审批） |
| 422 | `UNPROCESSABLE_ENTITY` | 业务规则校验失败 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
| 503 | `SERVICE_UNAVAILABLE` | 数据库或依赖服务不可用 |

---

**文档版本**: SWARM-001-Iteration-1  
**编制日期**: 2024-XX-XX  
**状态**: 草稿待评审