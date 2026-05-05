# SWARM-002 资产报废退役流程 - Iteration 8 规格指导文档

> **版本**: SWARM-002-Iteration-8  
> **状态**: 草稿  
> **创建日期**: 2024-XX-XX  
> **负责人**: SWARM Team

---

## 1. 需求与背景

### 1.1 业务需求

资产报废退役流程是企业资产管理生命周期中的关键末端环节。现有系统缺乏对资产状态流转的统一管控、报废申请的多级审批机制以及历史操作的可追溯性。本次迭代需构建完整的资产退役流程引擎，覆盖从申请发起到终态归档的全链路。

### 1.2 技术需求

| 维度 | 要求 |
|------|------|
| 状态引擎 | 支持有限状态机（FSM）建模资产全生命周期状态 |
| 审批链 | 支持多级会签/或签审批拓扑，可配置审批节点 |
| 持久化 | 所有状态变更必须落库，支持审计追溯 |
| 触发方式 | 支持手动发起 + 自动触发（如年限到期自动推送退役建议） |

### 1.3 核心数据模型

```python
# src/models/asset.py
class Asset:
    """资产实体模型"""
    id: UUID  # 主键
    asset_code: str  # 资产编码 (唯一)
    asset_name: str  # 资产名称
    category: AssetCategory  # 资产类别枚举
    purchase_date: date  # 购置日期
    original_value: Decimal  # 原值
    current_value: Decimal  # 当前净值
    status: AssetStatus  # 资产状态枚举
    created_at: datetime
    updated_at: datetime

# src/models/retirement.py
class RetirementApplication:
    """报废申请实体模型"""
    id: UUID  # 主键
    asset_id: UUID  # 关联资产ID
    applicant_id: UUID  # 申请人ID
    reason: str  # 报废原因
    disposal_method: DisposalMethod  # 处置方式枚举
    estimated_value: Decimal  # 残值评估
    status: ApplicationStatus  # 申请状态枚举
    created_at: datetime
    updated_at: datetime

# src/models/approval_chain.py
class ApprovalChain:
    """审批链路模型"""
    id: UUID  # 主键
    application_id: UUID  # 关联申请ID
    node_order: int  # 节点顺序
    approver_id: UUID  # 审批人ID
    decision: ApprovalDecision  # 决策枚举
    comment: str  # 审批意见
    decided_at: datetime  # 决策时间
    created_at: datetime

# src/models/status_history.py
class StateTransitionLog:
    """状态转换日志模型"""
    id: UUID  # 主键
    asset_id: UUID  # 关联资产ID
    from_status: str  # 原状态
    to_status: str  # 新状态
    trigger_type: TriggerType  # 触发类型
    operator_id: UUID  # 操作人ID
    metadata: dict  # 附加元数据 (JSON)
    created_at: datetime  # 转换时间
```

### 1.4 枚举定义

```python
# src/models/enums.py
from enum import Enum

class AssetStatus(str, Enum):
    """资产状态枚举"""
    IN_USE = "在用"
    IDLE = "闲置"
    MAINTENANCE = "维修中"
    PENDING_APPROVAL = "待审批"
    APPROVAL_IN_PROGRESS = "审批中"
    RETIRED = "已报废"
    RECYCLED = "已回收"

class ApplicationStatus(str, Enum):
    """报废申请状态枚举"""
    DRAFT = "草稿"
    PENDING = "待审批"
    APPROVAL_IN_PROGRESS = "审批中"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    WITHDRAWN = "已撤回"

class DisposalMethod(str, Enum):
    """处置方式枚举"""
    SCRAP = "报废销毁"
    TRANSFER = "转让"
    RECYCLE = "回收再利用"
    DONATE = "捐赠"

class ApprovalDecision(str, Enum):
    """审批决策枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"

class ApprovalMode(str, Enum):
    """审批模式枚举"""
    SERIAL = "serial"  # 串行审批
    COUNTER_SIGN = "counter_sign"  # 会签(全部通过)
    OR_SIGN = "or_sign"  # 或签(任一通过)

class TriggerType(str, Enum):
    """触发类型枚举"""
    MANUAL = "manual"
    AUTO = "auto"
    APPROVAL = "approval"
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解（参照 plan.md）

| Phase | 名称 | 范围 | 状态 | 负责人 |
|-------|------|------|------|--------|
| Phase 1 | 资产状态机引擎 | FSM建模、状态定义、转换规则引擎 | ✅ 已完成 | Backend Team |
| Phase 2 | 报废申请模块 | 申请表单、字段校验、持久化 | ✅ 已完成 | Backend Team |
| Phase 3 | 审批链路引擎 | 多级审批拓扑、会签/或签 | 🔄 **本次迭代** | Backend Team |
| Phase 4 | 历史记录持久化 | 状态变更日志、审计链 | 🔄 **本次迭代** | Backend Team |
| Phase 5 | 前端流程可视化 | 申请列表、审批面板、状态看板 | ⏳ 下阶段 | Frontend Team |

### 2.2 Iteration 8 实施目标

**本次迭代聚焦 Phase 3 + Phase 4，交付以下组件：**

#### 2.2.1 审批链路引擎（Phase 3）

- 实现可配置的多级审批拓扑（串行/并行节点）
- 支持会签（所有审批人通过）与或签（任一审批人通过）两种路由模式
- 审批节点动态增删（草稿阶段允许调整审批人）
- 审批超时自动提醒机制（待实现通知层，本期仅记录超时状态）

#### 2.2.2 历史记录持久化（Phase 4）

- 状态变更事件的全量落库
- 审批操作原子性记录
- 审计日志防篡改设计（哈希链或 Append-only 表）

#### 2.2.3 状态流转引擎增强（Phase 1 延续）

- 审批通过后触发状态自动流转：`审批中` → `已批准` → `已报废`
- 审批拒绝后触发状态回滚：`审批中` → `已拒绝`（可配置是否回退原状态）

### 2.3 迭代里程碑

```
Iteration 8 (Week 1-2)
├── Day 1-2: 审批链路引擎核心实现
│   ├── ApprovalChainEngine 类
│   ├── 路由策略接口定义
│   └── 决策处理器
├── Day 3-4: 历史记录持久化
│   ├── StateTransitionLog model
│   ├── 事件监听机制
│   └── 哈希链校验
├── Day 5-6: 服务层与业务规则
│   ├── RetirementApplicationService
│   ├── ApprovalService
│   └── 业务规则校验
├── Day 7-8: API 层与集成
│   ├── RESTful endpoints
│   ├── 参数校验
│   └── 端到端集成测试
└── Day 9-10: 测试与修复
    ├── 单元测试补全
    ├── ATB 验证
    └── 文档更新
```

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 具体限制 |
|----------|----------|
| 审批层级 | 单次申请最多 5 级审批节点 |
| 并发控制 | 同一资产同一时间仅允许 1 个活跃申请 |
| 状态锁定 | `审批中` 状态的资产禁止发起新申请 |
| 撤回窗口 | 仅申请人可在所有审批人未操作前撤回 |
| 草稿保留 | 草稿状态超过 30 天自动清理 |
| 审批超时 | 节点审批超时设定为 72 小时 |

### 3.2 非功能约束

| 维度 | 指标 |
|------|------|
| 响应时间 | 审批操作 API P99 ≤ 200ms |
| 数据一致性 | 状态变更与日志写入必须同事务 |
| 可用性 | 审批链路服务 99.9% 可用 |
| 兼容性 | RESTful API，JSON 响应，UTF-8 编码 |
| 审计保留 | 日志记录保留期限 ≥ 7 年 |

### 3.3 技术边界

```
技术栈约束：
├── 后端框架：FastAPI / Django（任选其一）
├── 数据库：PostgreSQL 12+
├── ORM：SQLAlchemy 2.0+ / Django ORM
├── 状态机库：python-statemachine / django-fsm（推荐）
├── 测试框架：pytest + pytest-asyncio
└── API 文档：OpenAPI 3.0 (auto-generated)

禁止事项：
├── ❌ 禁止在代码中硬编码审批节点
├── ❌ 禁止跳过日志层直接修改资产状态
└── ❌ 禁止审批状态通过前端单独控制
```

### 3.4 数据边界

```
敏感数据处理：
├── 审批意见中的敏感内容需脱敏存储
└── 操作人员信息需完整保留以供审计

数据保留策略：
├── StateTransitionLog：永久保留
├── RetirementApplication（已归档）：保留 7 年
└── 草稿数据：30 天后自动清理
```

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1：状态机引擎测试

| 测试编号 | 测试场景 | 物理测试方法 | 期待结果 |
|----------|----------|--------------|----------|
| ATB-1.1 | 合法状态转换 | `pytest tests/state_machine/test_valid_transitions.py::test_asset_idle_to_pending` | 状态从 `闲置` → `待审批`，转换记录已写入 `StateTransitionLog` |
| ATB-1.2 | 非法状态转换 | `pytest tests/state_machine/test_invalid_transitions.py::test_inuse_cannot_direct_to_retired` | 抛出 `InvalidStateTransitionError`，无数据库写入 |
| ATB-1.3 | 并发状态变更 | `pytest tests/state_machine/test_concurrency.py::test_concurrent_status_change` | 仅一事务成功，另一事务返回 `OptimisticLockError` |
| ATB-1.4 | 审批通过触发流转 | `pytest tests/state_machine/test_approval_flow.py::test_approval_complete_triggers_retirement` | 审批节点全部通过后，资产状态自动变更为 `已报废` |

### 4.2 ATB-2：报废申请模块测试

| 测试编号 | 测试场景 | 物理测试方法 | 期待结果 |
|----------|----------|--------------|----------|
| ATB-2.1 | 创建报废申请 | `pytest tests/application/test_create.py::test_create_retirement_application` | 返回 201，Application 记录已创建，状态为 `草稿` |
| ATB-2.2 | 字段校验-必填项缺失 | `pytest tests/application/test_validation.py::test_missing_required_fields` | 返回 422，错误信息包含缺失字段列表 |
| ATB-2.3 | 残值评估格式校验 | `pytest tests/application/test_validation.py::test_invalid_estimated_value` | 拒绝负数/非数字输入，返回 422 |
| ATB-2.4 | 草稿提交 | `pytest tests/application/test_lifecycle.py::test_submit_draft_application` | 状态从 `草稿` → `待审批`，触发审批链初始化 |
| ATB-2.5 | 重复申请拦截 | `pytest tests/application/test_business_rules.py::test_duplicate_application_blocked` | 对已有活跃申请的资产再次申请，返回 409 Conflict |

### 4.3 ATB-3：审批链路引擎测试

| 测试编号 | 测试场景 | 物理测试方法 | 期待结果 |
|----------|----------|--------------|----------|
| ATB-3.1 | 串行审批-逐级通过 | `pytest tests/approval/test_serial_chain.py::test_serial_approval_progression` | 按节点顺序审批，节点2仅在节点1通过后开放 |
| ATB-3.2 | 会签模式-全部通过 | `pytest tests/approval/test_counter_sign.py::test_counter_sign_all_approved` | 3个并行节点全部 approved 后进入下一节点 |
| ATB-3.3 | 会签模式-任一拒绝 | `pytest tests/approval/test_counter_sign.py::test_counter_sign_one_rejected` | 并行节点中任一 rejected，流程终止 |
| ATB-3.4 | 或签模式-任一通过 | `pytest tests/approval/test_or_sign.py::test_or_sign_one_approved` | 并行节点中任一 approved，流程进入下一节点 |
| ATB-3.5 | 审批意见记录 | `pytest tests/approval/test_decision.py::test_approval_comment_recorded` | decision='approved' 时 comment 已持久化 |
| ATB-3.6 | 审批超时标记 | `pytest tests/approval/test_timeout.py::test_approval_timeout_flag` | 超过72小时未操作的节点 `timeout_flag=True` |
| ATB-3.7 | 申请人撤回 | `pytest tests/approval/test_withdrawal.py::test_applicant_withdraw_pending` | 状态回滚为 `已撤回`，审批链记录 `skipped` |

### 4.4 ATB-4：历史记录持久化测试

| 测试编号 | 测试场景 | 物理测试方法 | 期待结果 |
|----------|----------|--------------|----------|
| ATB-4.1 | 状态变更日志完整性 | `pytest tests/history/test_state_logs.py::test_all_transitions_logged` | 每次状态变更产生1条 `StateTransitionLog` 记录 |
| ATB-4.2 | 审批操作原子性 | `pytest tests/history/test_transaction.py::test_approval_log_atomic` | 审批通过与日志写入在同一事务中 |
| ATB-4.3 | 审计链时间戳顺序 | `pytest tests/history/test_audit_chain.py::test_log_timestamp_order` | 日志 `created_at` 严格递增 |
| ATB-4.4 | 哈希链防篡改 | `pytest tests/history/test_integrity.py::test_hash_chain_integrity` | 修改任一记录后哈希校验失败 |
| ATB-4.5 | 历史查询-按资产 | `pytest tests/history/test_queries.py::test_query_history_by_asset` | 返回该资产完整状态变更链 |
| ATB-4.6 | 历史查询-按时间范围 | `pytest tests/history/test_queries.py::test_query_history_by_date_range` | 返回指定时间段内的所有变更记录 |

### 4.5 ATB-5：API 端点测试

| 端点 | 测试方法 | 期待状态码 |
|------|----------|------------|
| `POST /api/v1/retirement/applications` | 创建申请 | 201 |
| `GET /api/v1/retirement/applications/{id}` | 获取申请详情 | 200 |
| `PATCH /api/v1/retirement/applications/{id}` | 更新草稿 | 200 |
| `POST /api/v1/retirement/applications/{id}/submit` | 提交申请 | 200 |
| `POST /api/v1/retirement/applications/{id}/approve/{node}` | 审批通过 | 200 |
| `POST /api/v1/retirement/applications/{id}/reject/{node}` | 审批拒绝 | 200 |
| `POST /api/v1/retirement/applications/{id}/withdraw` | 撤回申请 | 200 |
| `GET /api/v1/assets/{id}/state-history` | 获取状态历史 | 200 |
| `GET /api/v1/retirement/applications` | 列表查询（分页） | 200 |

### 4.6 ATB-6：集成测试

| 测试编号 | 测试场景 | 执行方式 | 期待结果 |
|----------|----------|----------|----------|
| ATB-6.1 | 完整审批流程 | `pytest tests/integration/test_full_workflow.py` | 申请 → 审批通过 → 资产状态变更 → 日志完整 |
| ATB-6.2 | 审批拒绝流程 | `pytest tests/integration/test_rejection_flow.py` | 拒绝 → 状态回滚 → 拒绝原因记录 |
| ATB-6.3 | 草稿生命周期 | `pytest tests/integration/test_draft_lifecycle.py` | 创建 → 编辑 → 提交 → 撤回 → 再提交 |

---

## 5. 开发切入层级序列

### 5.1 Phase 3 审批链路引擎开发顺序

```
Step 1: 数据层基础
├── 1.1 扩展 RetirementApplication model（增加 status 枚举）
├── 1.2 创建 ApprovalChain model
├── 1.3 编写数据库迁移脚本
└── 1.4 基础 CRUD Repository 层

Step 2: 核心引擎
├── 2.1 实现 ApprovalChainEngine 类
│   ├── init_chain(application_id) -> 初始化审批节点
│   ├── get_current_node() -> 获取当前待审批节点
│   ├── get_pending_nodes() -> 获取所有待审批节点（并行）
│   └── is_all_approved() -> 判断是否全部通过
├── 2.2 实现路由策略
│   ├── SerialRouter（串行路由）
│   ├── CounterSignRouter（会签路由）
│   └── OrSignRouter（或签路由）
└── 2.3 实现决策处理器
    ├── process_approval(node_id, approver_id, comment)
    ├── process_rejection(node_id, approver_id, reason)
    └── process_withdrawal(application_id)

Step 3: 业务规则层
├── 3.1 审批节点配置校验（避免循环依赖）
├── 3.2 并发控制（乐观锁/悲观锁选择）
├── 3.3 撤回权限校验
└── 3.4 超时检测逻辑

Step 4: 服务层
├── 4.1 RetirementApplicationService
│   ├── create_application(asset_id, data) -> 创建草稿
│   ├── submit_application(application_id) -> 提交申请
│   ├── withdraw_application(application_id) -> 撤回申请
│   └── get_application_detail(application_id) -> 详情查询
└── 4.2 ApprovalService
    ├── process_decision(application_id, node_order, decision, comment)
    └── get_approval_status(application_id)

Step 5: API 层
├── 5.1 定义 Pydantic schemas
├── 5.2 路由注册
├── 5.3 权限控制（审批人身份校验）
└── 5.4 OpenAPI 文档更新
```

### 5.2 Phase 4 历史记录持久化开发顺序

```
Step 1: 日志基础设施
├── 1.1 StateTransitionLog model 定义
├── 1.2 AuditHashChain 工具类实现
└── 1.3 数据库索引设计（asset_id, created_at 联合索引）

Step 2: 事件监听层
├── 2.1 状态变更事件定义（StateChangeEvent）
├── 2.2 EventListener 抽象类
├── 2.3 StateLogListener 实现（监听状态变更写入日志）
└── 2.4 事件总线（EventBus）可选设计

Step 3: 事务一致性保障
├── 3.1 UnitOfWork 模式实现
├── 3.2 状态变更与日志写入原子性保证
└── 3.3 失败回滚补偿机制

Step 4: 查询接口
├── 4.1 StateHistoryRepository
│   ├── get_by_asset(asset_id) -> 完整历史链
│   ├── get_by_date_range(start, end) -> 时间范围查询
│   └── get_by_operator(operator_id) -> 操作人员查询
└── 4.2 导出功能（PDF/Excel）

Step 5: 完整性校验
├── 5.1 哈希链校验接口
├── 5.2 定期完整性巡检任务（可选）
└── 5.3 篡改告警机制
```

### 5.3 依赖关系图

```
[数据层基础] 
     ↓
[核心引擎 + 日志基础设施] (可并行开发)
     ↓
[业务规则层 + 事件监听层] (核心引擎完成后)
     ↓
[服务层 + 查询接口] (业务规则完成后)
     ↓
[API 层 + 完整性校验] (服务层完成后)
     ↓
[集成测试 + E2E 测试]
```

### 5.4 关键代码路径

| 组件 | 路径 |
|------|------|
| Domain Models | `src/domain/entities/` |
| Approval Engine | `src/domain/services/approval_chain_service.py` |
| State Machine | `src/domain/state_machine/retirement_state_machine.py` |
| Event Listeners | `src/domain/events/listeners/` |
| Repositories | `src/repositories/` |
| API Routes | `src/api/routes/` |
| Schemas | `src/schemas/` |
| Tests | `tests/` |

---

## 6. 异常定义

```python
# src/domain/exceptions.py
class AssetRetirementException(Exception):
    """资产退役业务异常基类"""
    pass

class InvalidStateTransitionError(AssetRetirementException):
    """非法状态转换异常"""
    def __init__(self, from_status: str, to_status: str):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(
            f"Invalid state transition from '{from_status}' to '{to_status}'"
        )

class ConcurrentApplicationError(AssetRetirementException):
    """并发申请冲突异常"""
    def __init__(self, asset_id: str):
        self.asset_id = asset_id
        super().__init__(
            f"Asset '{asset_id}' already has an active retirement application"
        )

class ApprovalChainBrokenError(AssetRetirementException):
    """审批链完整性异常"""
    pass

class AuditChainBrokenError(AssetRetirementException):
    """审计链篡改检测异常"""
    pass

class UnauthorizedApprovalError(AssetRetirementException):
    """越权审批异常"""
    pass

class ApplicationNotFoundError(AssetRetirementException):
    """申请不存在异常"""
    pass

class DraftExpiredError(AssetRetirementException):
    """草稿过期异常"""
    pass
```

---

## 7. 附录

### 7.1 状态转换矩阵

| 当前状态 | 允许转换目标 | 触发条件 |
|----------|-------------|----------|
| 在用 | 闲置, 维修中 | 手动调整 |
| 闲置 | 待审批, 在用 | 手动发起申请 / 重新启用 |
| 维修中 | 在用 | 维修完成 |
| 待审批 | 审批中, 已撤回 | 提交申请 / 申请人撤回 |
| 审批中 | 已批准, 已拒绝 | 审批完成 |
| 已批准 | 已报废 | 执行退役 |
| 已拒绝 | (终止状态) | - |
| 已报废 | (终止状态) | - |
| 已撤回 | 待审批 | 重新提交 |

### 7.2 审批路由决策表

| 审批模式 | 节点类型 | 决策规则 | 进入下一节点条件 |
|---------|---------|----------|-----------------|
| SERIAL | 串行 | 顺序审批 | 当前节点 approved |
| COUNTER_SIGN | 并行-会签 | 所有节点必须审批 | 所有节点 approved |
| OR_SIGN | 并行-或签 | 任一节点可审批 | 任一节点 approved |

---

**文档版本：** SWARM-002-Iteration-8  
**编制日期：** 2024-XX-XX  
**负责人：** SWARM Team  
**评审状态：** 待评审