# SWARM-001 工单审批流程 - 规格指导文档

## 1. 需求与背景

### 业务场景概述

工单审批是企业级资产管理系统中的核心业务流程。本迭代实现以下能力：

| 能力维度 | 描述 | 优先级 |
|---------|------|--------|
| 工单提交 | 用户通过前端界面填写工单信息并发起审批申请 | P0 |
| 状态机流转 | 后端实现有限状态机（FSM）控制工单生命周期状态转换 | P0 |
| 审批处理 | 审批人对工单执行通过/拒绝/委托等操作 | P0 |
| 通知机制 | 状态变更时主动通知相关审批人 | P1 |

### 技术目标

- 构建可扩展的工单状态机框架，支持多级审批链
- 实现前后端职责分离，通过 API 驱动状态流转
- 确保状态转换的事务一致性和幂等性
- 支持实时通知推送

### 相关模块依赖

```
backend/
├── state_machine/
│   └── workorder_state.py        # 工单状态机定义
├── services/
│   ├── workorder_service.py      # 工单业务服务
│   └── approval_service.py       # 审批服务
├── api/v1/
│   ├── workorders.py              # 工单 API 路由
│   └── approval.py                # 审批 API 路由
└── models/
    └── workorder.py               # 工单数据模型

frontend/
├── src/types/
│   └── workorder.types.ts        # 前端类型定义
├── router/
│   └── approval.ts               # 审批路由配置
└── tests/unit/
    └── test_approval_chain.py    # 审批链单元测试
```

---

## 2. 当前 Phase 对应实施目标

### Phase 1：数据模型与状态机核心

**目标**：建立工单审批的基础数据结构和状态机引擎

| 实施项 | 规格要求 | 对应文件 |
|-------|---------|----------|
| 工单数据模型 | `work_orders` 表含 `id`, `title`, `description`, `status`, `creator_id`, `created_at`, `updated_at` | `backend/models/workorder.py` |
| 审批阶段模型 | `approval_stages` 表记录审批链节点 | `backend/models/approval_stage.py` |
| 审批记录模型 | `approval_records` 表记录每次审批操作 | `backend/models/approval_history.py` |
| 状态定义 | `DRAFT` → `PENDING` → `APPROVING` → `APPROVED` / `REJECTED` / `CANCELLED` | `backend/state_machine/workorder_state.py` |
| 状态机引擎 | 封装状态转换校验逻辑 | `WorkOrderStateMachine` 类 |

**验收标准**：
- 状态机支持所有合法状态转换路径
- 非法状态转换被正确拒绝并抛出 `StateTransitionException`

### Phase 2：审批流程与 API 接口

**目标**：实现工单和审批的 RESTful API

| 实施项 | 规格要求 | 对应文件 |
|-------|---------|----------|
| 创建工单 API | `POST /api/v1/work-orders` 返回 201 | `backend/api/v1/workorders.py` |
| 查询工单 API | `GET /api/v1/work-orders/{id}` 返回详情及审批历史 | `backend/api/v1/workorders.py` |
| 列表查询 API | `GET /api/v1/work-orders?status=&page=` 分页筛选 | `backend/api/v1/workorders.py` |
| 审批操作 API | `POST /api/v1/work-orders/{id}/approve` | `backend/api/v1/approval.py` |
| 拒绝操作 API | `POST /api/v1/work-orders/{id}/reject` | `backend/api/v1/approval.py` |
| 委托操作 API | `POST /api/v1/work-orders/{id}/delegate` | `backend/api/v1/approval.py` |

**API 响应格式**：

```json
// 成功响应
{
  "code": 200,
  "data": {
    "id": "wo_001",
    "title": "设备采购申请",
    "status": "APPROVING",
    "creator_id": "user_123",
    "current_stage": 1,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "success"
}

// 错误响应
{
  "code": 409,
  "data": null,
  "message": "状态转换冲突：当前状态不允许此操作"
}
```

### Phase 3：前端交互

**目标**：实现用户可感知的工单提交流程和审批界面

| 实施项 | 规格要求 | 对应文件 |
|-------|---------|----------|
| 工单类型定义 | TypeScript 接口 `WorkOrder`, `ApprovalStage`, `WorkOrderStatus` | `frontend/src/types/workorder.types.ts` |
| 审批路由 | `/work-orders/new`, `/work-orders/:id`, `/approval/pending` | `frontend/router/approval.ts` |
| 工单表单组件 | 必填字段校验、提交成功反馈 | 组件实现 |
| 审批操作界面 | 审批意见输入、通过/拒绝/委托按钮 | 组件实现 |
| 审批链测试 | 覆盖多级审批链的单元测试 | `frontend/tests/unit/test_approval_chain.py` |

---

## 3. 边界约束

### 3.1 强制约束

| 约束类型 | 具体规则 | 违反处理 |
|---------|---------|---------|
| 状态转换约束 | 仅允许预定义的状态转换路径 | 抛出 `StateTransitionException`，返回 409 |
| 幂等性约束 | 重复提交同一工单返回已有工单 ID | 响应 200，返回原始工单 ID |
| 事务约束 | 状态变更与审批记录必须在同一事务内完成 | 事务回滚，返回 500 |
| 权限约束 | 仅审批链中的当前审批人可执行审批操作 | 返回 403 Forbidden |
| 并发约束 | 同一工单不允许并发审批操作 | 行级锁，竞态请求返回 409 |

### 3.2 状态机转换规则

```
合法转换路径：

DRAFT ──提交──▶ PENDING ──自动触发──▶ APPROVING
                                           │
                    ┌──────────┬───────────┴───────────┬──────────┐
                    ▼          ▼                       ▼          ▼
              APPROVED    REJECTED              CANCELLED    (超时退回)
```

| 当前状态 | 允许的下一状态 |
|---------|--------------|
| DRAFT | PENDING |
| PENDING | APPROVING |
| APPROVING | APPROVED, REJECTED, CANCELLED |
| APPROVED | (终态) |
| REJECTED | (终态) |
| CANCELLED | (终态) |

### 3.3 数据校验约束

| 字段 | 类型约束 | 长度约束 | 默认值 |
|-----|---------|---------|-------|
| title | string | 1-200 字符 | - |
| description | string | 0-5000 字符 | "" |
| comment | string | 0-1000 字符 | null |
| status | enum | 预定义枚举值 | DRAFT |

### 3.4 异常处理约束

| 场景 | HTTP 状态码 | 错误消息 Key |
|-----|------------|-------------|
| 审批人不存在 | 404 | `approver.not_found` |
| 状态已转换 | 409 | `state.transition_conflict` |
| 无审批权限 | 403 | `approval.permission_denied` |
| 工单不存在 | 404 | `workorder.not_found` |
| 数据库连接失败 | 503 | `service.unavailable` |
| 参数校验失败 | 422 | `validation.error` |

---

## 4. 验收测试基准 (ATB)

### ATB-1：工单创建与提交

```
Test ID      : ATB-1.1
测试描述     : 有效用户提交工单后返回 201 且状态为 PENDING
前置条件     : 用户已登录，审批链已配置
测试步骤     :
  1. POST /api/v1/work-orders 提交工单
  2. 检查响应状态码
  3. 查询数据库验证状态
物理测试期待 :
  - pytest: response.status_code == 201
  - pytest: work_orders.status == 'PENDING'
  - pytest: approval_stages 表生成对应记录

Test ID      : ATB-1.2
测试描述     : 缺失必填字段工单被拒绝
测试步骤     :
  1. POST /api/v1/work-orders payload 缺 title
  2. 检查响应状态码
物理测试期待 :
  - pytest: response.status_code == 422
  - pytest: response.json()['message'] 包含校验错误信息

Test ID      : ATB-1.3
测试描述     : 重复提交返回幂等结果
前置条件     : 已存在 idempotency_key 为 "idem_001" 的工单
测试步骤     :
  1. POST /api/v1/work-orders 携带相同 idempotency_key
  2. 检查响应
物理测试期待 :
  - pytest: response.status_code == 200
  - pytest: 返回相同工单 ID
  - pytest: 数据库无新记录创建
```

### ATB-2：状态机流转

```
Test ID      : ATB-2.1
测试描述     : 工单自动从 PENDING 流转到 APPROVING
前置条件     : 工单状态为 PENDING
测试步骤     :
  1. 触发状态检查任务
  2. 查询工单状态
物理测试期待 :
  - pytest: work_orders.status == 'APPROVING'
  - pytest: approval_stages[0].status == 'ACTIVE'

Test ID      : ATB-2.2
测试描述     : 非法状态转换被拒绝
前置条件     : 工单状态为 APPROVED（终态）
测试步骤     :
  1. POST /api/v1/work-orders/{id}/approve
  2. 检查响应
物理测试期待 :
  - pytest: response.status_code == 409
  - pytest: 状态保持 APPROVED 不变

Test ID      : ATB-2.3
测试描述     : 审批操作生成审批记录
前置条件     : 工单状态为 APPROVING
测试步骤     :
  1. POST /api/v1/work-orders/{id}/approve
  2. 查询 approval_records 表
物理测试期待 :
  - pytest: approval_records 有新记录
  - pytest: record.action == 'APPROVE'
  - pytest: record.approver_id 正确

Test ID      : ATB-2.4
测试描述     : 并发审批仅一个成功
前置条件     : 工单状态为 APPROVING
测试步骤     :
  1. 并发发送两个 approve 请求
  2. 检查结果
物理测试期待 :
  - pytest: 一个请求返回 200
  - pytest: 另一请求返回 409 或超时
  - pytest: 数据库仅一条审批记录
```

### ATB-3：API 查询

```
Test ID      : ATB-3.1
测试描述     : 单条工单查询返回完整审批历史
测试步骤     :
  1. GET /api/v1/work-orders/{id}
  2. 检查响应结构
物理测试期待 :
  - pytest: response.json()['data'] 包含 approval_history 字段
  - pytest: approval_history 为数组且按时间排序

Test ID      : ATB-3.2
测试描述     : 分页列表查询返回正确元数据
测试步骤     :
  1. GET /api/v1/work-orders?page=1&size=10
  2. 检查分页信息
物理测试期待 :
  - pytest: response.json()['data'] 长度 <= 10
  - pytest: response.json()['pagination']['total'] 正确
  - pytest: response.json()['pagination']['page'] == 1
```

### ATB-4：前端类型与路由

```
Test ID      : ATB-4.1
测试描述     : TypeScript 类型定义完整
测试步骤     :
  1. 导入 workorder.types.ts 中的类型
  2. 验证类型结构
物理测试期待 :
  - playwright/TypeScript: WorkOrder 类型包含所有必需字段
  - playwright/TypeScript: WorkOrderStatus 枚举包含所有状态

Test ID      : ATB-4.2
测试描述     : 审批路由配置正确
测试步骤     :
  1. 检查 router/approval.ts 路由定义
  2. 访问各路由路径
物理测试期待 :
  - playwright: /work-orders/new 路由存在
  - playwright: /approval/pending 路由存在
```

---

## 5. 开发切入层级序列

### 层级依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                      L5 前端展示层                           │
│  Vue/React 组件、页面路由、用户交互、Playwright E2E 测试     │
├─────────────────────────────────────────────────────────────┤
│                      L4 API 网关层                          │
│  REST Controller、请求校验、参数解析、路由分发                │
├─────────────────────────────────────────────────────────────┤
│                      L3 业务服务层                          │
│  WorkOrderService、ApprovalService、NotificationService      │
├─────────────────────────────────────────────────────────────┤
│                      L2 状态机引擎层                         │
│  WorkOrderStateMachine、TransitionRule、TransitionValidator │
├─────────────────────────────────────────────────────────────┤
│                      L1 数据持久层                           │
│  SQLAlchemy Models、Repository、Migrations                  │
└─────────────────────────────────────────────────────────────┘
```

### 实施顺序

| 阶段 | 层级 | 交付物 | 依赖关系 |
|------|------|--------|---------|
| **Step 1.1** | L1 | `backend/models/workorder.py` 数据库模型 | 无 |
| **Step 1.2** | L1 | `backend/models/approval_history.py` 审批记录模型 | L1 模型 |
| **Step 2.1** | L2 | `backend/state_machine/workorder_state.py` 状态机 | L1 |
| **Step 3.1** | L3 | `backend/services/workorder_service.py` 工单服务 | L2 |
| **Step 3.2** | L3 | `backend/services/approval_service.py` 审批服务 | L2 |
| **Step 4.1** | L4 | `backend/api/v1/workorders.py` 工单 API | L3 |
| **Step 4.2** | L4 | `backend/api/v1/approval.py` 审批 API | L3 |
| **Step 5.1** | L5 | `frontend/src/types/workorder.types.ts` 前端类型 | L4 API 契约 |
| **Step 5.2** | L5 | `frontend/router/approval.ts` 路由配置 | L5 类型 |
| **Step 5.3** | L5 | `frontend/tests/unit/test_approval_chain.py` 单元测试 | L5 组件 |
| **Step 6.1** | 测试 | pytest API 集成测试 | L4 |
| **Step 6.2** | 测试 | Playwright E2E 测试 | L5 + L4 |

### 关键切点验收

| 切点 | 验收标准 | 测试覆盖 |
|------|---------|---------|
| **L1 完成** | 数据库迁移成功执行，表结构符合设计 | pytest: migration test |
| **L2 完成** | 状态机单元测试覆盖率 ≥ 90%，所有转换路径验证 | pytest: state_machine tests |
| **L3 完成** | Service 层测试覆盖率 ≥ 80% | pytest: service unit tests |
| **L4 完成** | 所有 REST API 通过契约测试 | pytest: API integration tests |
| **L5 完成** | 前端类型检查通过，路由正确 | TypeScript tsc, Playwright E2E |
| **全部完成** | 所有 ATB 测试通过 | pytest + playwright |

---

## 附录 A：状态机状态图

```
                    ┌─────────────┐
                    │    DRAFT    │
                    └──────┬──────┘
                           │ submit()
                           ▼
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │ start_approval()
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
                    │ CANCELLED   │          │ (归档完成)  │
                    └─────────────┘          └─────────────┘
```

## 附录 B：文件修改清单

| 文件路径 | 操作 | 修改说明 |
|---------|------|---------|
| `frontend/src/types/workorder.types.ts` | update | 补充 WorkOrderStatus 枚举及类型定义 |
| `frontend/router/approval.ts` | update | 添加工单审批相关路由 |
| `backend/state_machine/workorder_state.py` | update | 实现状态机核心逻辑 |
| `backend/services/workorder_service.py` | update | 工单创建、查询服务方法 |
| `frontend/tests/unit/test_approval_chain.py` | update | 补充审批链单元测试 |

---

**文档版本**: SWARM-001-Iteration-1  
**编制日期**: 2024-XX-XX  
**状态**: 草稿待评审  
**作者**: SWARM Team