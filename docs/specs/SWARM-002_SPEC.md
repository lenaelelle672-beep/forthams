# SWARM-002 资产报废退役流程规格指导文档

## 1. 需求与背景

### 1.1 业务场景

资产报废退役流程是企业资产管理系统的核心生命周期节点，涵盖以下关键业务操作：

1. **资产状态流转**：资产从"在用"状态转移至"待报废"、"审批中"、"已报废"、"已退役"等状态
2. **报废申请审批链**：支持多级审批流程（申请人→部门主管→财务审核→资产管理员→完成）
3. **历史记录持久化**：所有状态变更、审批动作、附件上传等操作需完整记录并可追溯

### 1.2 核心痛点

- 缺乏统一的资产状态流转引擎，导致状态不一致
- 审批流程依赖线下传递，效率低下且不可追溯
- 历史记录分散或缺失，影响审计合规

### 1.3 迭代目标（Iteration 9）

本次迭代聚焦于**流程引擎核心构建 + 基础审批链实现 + 持久化层设计**，为后续迭代的审批链路完善和前端交互奠定基础。

---

## 2. 当前 Phase 对应实施目标

> **注**：以下 Phase 拆解基于 plan.md 的标准生命周期模型，若与实际 plan.md 有冲突，以实际 plan.md 为准。

### Phase 1: 状态流转引擎核心（本次迭代重点）

| 子任务 | 描述 | 交付物 |
|--------|------|--------|
| P1.1 | 定义资产状态枚举与合法状态机 | `src/domain/state_machine/states.py` |
| P1.2 | 实现状态流转校验器 | `src/domain/state_machine/guards.py` |
| P1.3 | 状态变更事件发布机制 | `src/domain/events/state_changed.py` |

### Phase 2: 报废申请领域模型（本次迭代重点）

| 子任务 | 描述 | 交付物 |
|--------|------|--------|
| P2.1 | 报废申请实体与聚合根 | `src/domain/entities/retirement_app.py` |
| P2.2 | 审批链数据结构定义 | `src/models/approval_chain.py` |
| P2.3 | 申请人提交接口 | `src/domain/use_cases/retirement_usecase.py` |

### Phase 3: 历史记录持久化（本次迭代重点）

| 子任务 | 描述 | 交付物 |
|--------|------|--------|
| P3.1 | 状态变更审计日志表设计 | `migrations/versions/xxx_add_retirement_and_approval_tables.py` |
| P3.2 | 审计日志写入 Repository | `src/repositories/history_repository.py` |
| P3.3 | 历史记录查询接口 | `src/services/status_history_service.py` |

### Phase 4: 基础 API 层（本次迭代涉及）

| 子任务 | 描述 | 交付物 |
|--------|------|--------|
| P4.1 | 报废申请 REST API 端点 | `src/api/v1/retirement.py` |
| P4.2 | 状态查询 API | `src/api/schemas/request.py` |
| P4.3 | 审批链 API | `src/api/v1/approval.py` |

### Phase 5~N: 前端交互与高级审批链（后续迭代）

- 审批工作流可视化
- 多级会签/或签逻辑
- 通知推送集成
- 报表导出功能

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 具体限制 |
|--------|----------|
| 支持资产类型 | 固定资产（含电子设备、家具、车辆等） |
| 审批链层级 | 最多支持 5 级审批 |
| 单次申请资产数量 | 单次申请最多 50 件同类型资产 |
| 历史记录保留 | 永久保留，不可物理删除 |
| 并发控制 | 同一资产同一时间仅允许一个流程实例 |

### 3.2 技术边界

| 约束项 | 具体限制 |
|--------|----------|
| 后端框架 | FastAPI 0.100+ |
| ORM | SQLAlchemy 2.0+ |
| Python 版本 | 3.11+ |
| 数据库 | PostgreSQL 14+ |
| 缓存 | Redis 7.0+（用于分布式锁） |
| 前端框架 | React 18+ with TypeScript |

### 3.3 业务规则边界

| 规则编号 | 规则描述 |
|----------|----------|
| BR-001 | 资产状态为"已报废"或"已退役"时，禁止再次发起报废申请 |
| BR-002 | 审批链中任意节点拒绝，则流程终止，资产状态回退至"在用" |
| BR-003 | 申请人可在审批完成前主动撤回申请 |
| BR-004 | 资产管理员拥有最终处置权限（报废/降级使用/捐赠等） |

### 3.4 明确排除范围

- 财务折旧计算模块（由 SWARM-003 独立处理）
- 资产采购入库流程
- 维修保养工单流程
- 移动端原生应用
- 与 ERP 系统实时同步

---

## 4. 验收测试基准 (ATB)

### 4.1 验收标准总览

| 测试层级 | 测试类型 | 覆盖率目标 | 执行频率 |
|----------|----------|------------|----------|
| 单元测试 | pytest | 核心业务逻辑 ≥ 90% | 每次 PR |
| 集成测试 | pytest + testcontainers | API 端点 ≥ 85% | 每次合并至 main |
| E2E 测试 | Playwright | 核心流程 100% | 每周回归 |

---

### 4.2 ATB-1: 状态流转引擎

| 序号 | 测试用例 | 测试输入 | 物理测试期待 | 测试工具 |
|------|----------|----------|--------------|----------|
| ATB-1.1 | 合法状态流转验证 | `{"from_state": "in_use", "to_state": "pending_retirement"}` | 返回 `True`，无异常抛出 | `pytest tests/unit/test_state_machine.py::test_valid_transition` |
| ATB-1.2 | 非法状态流转拒绝 | `{"from_state": "retired", "to_state": "pending_retirement"}` | 抛出 `StateTransitionException` | `pytest tests/unit/test_state_machine.py::test_invalid_transition` |
| ATB-1.3 | 状态机边界条件 | `{"from_state": "pending_approval", "to_state": "scrapped"}` | 抛出 `StateTransitionException`（需经审批） | `pytest tests/unit/test_state_machine.py::test_transition_requires_approval` |
| ATB-1.4 | 状态变更事件发布 | 调用 `transition_to()` | `StateChangedEvent` 被发布至 Event Bus | `pytest tests/unit/test_state_machine.py::test_event_published` |
| ATB-1.5 | 状态枚举完整性 | 所有 `AssetStatus` 枚举值参与状态机定义 | 无孤立状态，所有状态有入口/出口定义 | `pytest tests/unit/test_state_machine.py::test_state_completeness` |

---

### 4.3 ATB-2: 报废申请审批链

| 序号 | 测试用例 | 测试输入 | 物理测试期待 | 测试工具 |
|------|----------|----------|--------------|----------|
| ATB-2.1 | 申请创建成功 | `POST /api/v1/retirement` with valid payload | 返回 201，状态为 `pending_approval` | `pytest tests/api/test_retirement_api.py::test_create_retirement_request` |
| ATB-2.2 | 申请创建字段校验 | 缺少必填字段 `asset_ids` | 返回 422，错误信息包含字段名 | `pytest tests/api/test_retirement_api.py::test_create_validation_error` |
| ATB-2.3 | 审批链生成 | 提交申请后 | 自动生成 3 级审批链（申请人→部门→资产管理员） | `pytest tests/integration/test_approval_chain.py::test_approval_chain_generation` |
| ATB-2.4 | 单节点审批通过 | `PATCH /api/v1/approval/{id}/approve` | 审批节点状态更新，下一节点激活 | `pytest tests/api/test_approval_api.py::test_single_approval_advance` |
| ATB-2.5 | 审批拒绝终止流程 | `PATCH /api/v1/approval/{id}/reject` | 流程状态为 `rejected`，资产状态回退 | `pytest tests/api/test_approval_api.py::test_rejection_terminates_process` |
| ATB-2.6 | 申请人撤回申请 | `DELETE /api/v1/retirement/{id}` | 返回 200，状态为 `withdrawn` | `pytest tests/api/test_retirement_api.py::test_withdraw_request` |
| ATB-2.7 | 并发申请防护 | 两进程同时对同一资产发起申请 | 只有一个成功，另一个返回 409 Conflict | `pytest tests/concurrency/test_approve_race_condition.py::test_concurrent_request_conflict` |

---

### 4.4 ATB-3: 历史记录持久化

| 序号 | 测试用例 | 测试输入 | 物理测试期待 | 测试工具 |
|------|----------|----------|--------------|----------|
| ATB-3.1 | 状态变更日志写入 | 触发状态流转 | 数据库 `status_history` 表新增记录 | `pytest tests/unit/test_asset_state_engine.py::test_state_change_logged` |
| ATB-3.2 | 审批操作日志写入 | 审批节点通过/拒绝 | 数据库 `approval_history` 表新增记录 | `pytest tests/unit/test_asset_state_engine.py::test_approval_action_logged` |
| ATB-3.3 | 历史记录查询-按资产 | `GET /api/v1/assets/{id}/history` | 返回完整状态变更时间线 | `pytest tests/integration/test_asset_history.py::test_get_asset_history` |
| ATB-3.4 | 历史记录查询-按申请 | `GET /api/v1/retirement/{id}/audit` | 返回该申请全生命周期记录 | `pytest tests/integration/test_retirement_flow.py::test_get_request_audit` |
| ATB-3.5 | 不可删除验证 | `DELETE /api/v1/audit-logs/{id}` | 返回 405 Method Not Allowed | `pytest tests/integration/test_asset_history.py::test_audit_log_immutable` |
| ATB-3.6 | 日志完整性校验 | 任意状态流转后 | `prev_state`、`new_state`、`actor`、`timestamp` 均非空 | `pytest tests/unit/test_asset_state_engine.py::test_log_completeness` |

---

### 4.5 ATB-4: 集成验收（E2E）

| 序号 | 测试用例 | 场景描述 | 物理测试期待 | 测试工具 |
|------|----------|----------|--------------|----------|
| ATB-4.1 | 完整报废流程 E2E | 资产A: 在用→待报废→审批中→已报废→已退役 | 每个状态节点均可查询，状态链完整 | `playwright tests/e2e/retirement_flow.spec.ts` |
| ATB-4.2 | 多级审批通过 E2E | 5 级审批链全部 approve | 流程状态演进至 `completed` | `playwright tests/e2e/retirement_flow.spec.ts::test_multi_approval` |
| ATB-4.3 | 拒绝后回退 E2E | 第2级审批拒绝 | 资产状态回退至"在用"，拒绝记录可查 | `playwright tests/e2e/retirement_flow.spec.ts::test_rejection_flow` |

---

## 5. 开发切入层级序列

### 5.1 层级一：数据模型层（先行）

```
src/
├── models/
│   ├── __init__.py
│   ├── retirement.py              # 报废申请模型
│   ├── approval_chain.py          # 审批链模型
│   ├── approval_node.py           # 审批节点模型
│   └── status_history.py          # 状态历史模型
├── domain/
│   ├── entities/
│   │   ├── retirement_app.py      # 申请聚合根
│   │   └── approval_stage.py      # 审批阶段实体
│   └── state_machine/
│       ├── states.py              # 状态枚举
│       ├── retirement_state_machine.py  # 退役状态机
│       └── guards.py              # 流转守卫
└── migrations/
    └── versions/
        └── xxx_add_retirement_and_approval_tables.py
```

**交付标准**：数据模型可独立通过 SQLAlchemy 单元测试

---

### 5.2 层级二：领域逻辑层

```
src/
├── domain/
│   ├── use_cases/
│   │   ├── retirement_usecase.py  # 退役申请用例
│   │   └── approval_usecase.py    # 审批用例
│   ├── services/
│   │   ├── retirement_service.py  # 退役服务
│   │   ├── approval_chain_service.py  # 审批链服务
│   │   └── status_history_service.py  # 状态历史服务
│   ├── events/
│   │   ├── state_changed.py      # 状态变更事件
│   │   └── listeners/
│   │       └── state_log_listener.py  # 状态日志监听器
│   └── value_objects/
│       └── transition_rule.py    # 流转规则值对象
```

**交付标准**：所有业务规则通过领域逻辑单元测试

---

### 5.3 层级三：持久化层

```
src/
├── repositories/
│   ├── __init__.py
│   ├── retirement_repository.py   # 报废申请仓库
│   ├── approval_chain_repository.py  # 审批链仓库
│   └── history_repository.py      # 历史记录仓库
└── infrastructure/
    └── database/
        ├── models.py             # 数据库模型
        └── migrations/
            └── 001_create_retirement_tables.py
```

**交付标准**：Repository 方法通过集成测试（testcontainers）

---

### 5.4 层级四：API 层

```
src/
├── api/
│   ├── v1/
│   │   ├── retirement.py         # 退役 API 端点
│   │   └── approval.py          # 审批 API 端点
│   └── schemas/
│       ├── request.py           # 请求模型
│       └── retirement_schemas.py  # 退役专用 schema
└── interfaces/
    └── api/
        ├── routers/
        │   └── retirement_router.py  # 退役路由
        └── schemas/
            └── retirement_request.py
```

**交付标准**：API 端点通过 FastAPI TestClient 测试

---

### 5.5 层级五：前端类型与组件层

```
frontend/src/
├── pages/
│   └── WorkOrder/
│       └── types/
│           └── workOrder.ts     # 工单类型定义
├── types/
│   ├── approval.ts              # 审批类型定义
│   └── retirement.types.ts     # 退役类型定义
├── services/
│   ├── retirementService.ts     # 退役服务
│   └── approvalService.ts       # 审批服务
└── tests/
    └── unit/
        ├── test_approval_chain.py  # 审批链测试
        └── retirementService.test.ts  # 退役服务测试
```

**交付标准**：前端类型通过 TypeScript 编译检查

---

## 6. 核心业务流入口

### 6.1 报废申请核心入口

**主入口文件**：`src/api/v1/retirement.py`

```python
# 核心入口点说明
POST   /api/v1/retirement          # 创建报废申请
GET    /api/v1/retirement/{id}     # 查询申请详情
GET    /api/v1/retirement          # 列表查询
DELETE /api/v1/retirement/{id}     # 撤回申请
```

### 6.2 审批链核心入口

**主入口文件**：`src/api/v1/approval.py`

```python
# 审批入口点说明
POST   /api/v1/approval/{id}/approve   # 审批通过
POST   /api/v1/approval/{id}/reject    # 审批拒绝
GET    /api/v1/approval/{id}           # 查询审批详情
```

### 6.3 状态查询入口

**主入口文件**：`src/api/schemas/request.py`

```python
# 状态查询入口点说明
GET    /api/v1/assets/{id}/state       # 查询资产当前状态
GET    /api/v1/assets/{id}/history     # 查询状态变更历史
```

---

## 7. 附录

### 7.1 关键依赖

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| fastapi | ≥0.100.0 | API 框架 |
| sqlalchemy | ≥2.0.0 | ORM |
| pydantic | ≥2.0.0 | 数据验证 |
| pytest | ≥7.4.0 | 单元测试 |
| pytest-asyncio | ≥0.21.0 | 异步测试 |
| testcontainers | ≥4.0.0 | 集成测试 |
| playwright | ≥1.40.0 | E2E 测试 |

### 7.2 相关文档

- 数据字典：见 `docs/data_dictionary.md`
- API 规范：见 `docs/openapi.yaml`
- 状态机图：见 `docs/state_machine_diagram.md`
- 审批流程图：见 `docs/approval_flow_diagram.md`

### 7.3 测试覆盖缺口（Iteration 9 待修复）

| 问题 ID | 描述 | 涉及文件 |
|---------|------|----------|
| DOC-001 | `frontend/tests/unit/test_approval_chain.py` 缺少 docstring | 17 个函数待补充 |
| TST-001 | AC-001 unit_test 报 Unknown Failure | 需排查测试执行环境 |
| TST-002 | AC-004 import 测试报 Unknown Failure | 需检查模块导入链路 |