# 资产报废/退役流程规格指导文档

## 1. 概述与背景

### 1.1 业务场景
资产报废/退役流程是企业资产管理系统的核心业务流程，涵盖从报废申请提交、审批链流转、多级审批决策、状态机驱动到历史记录归档的完整生命周期管理。

### 1.2 核心诉求
| 诉求维度 | 描述 |
|---------|------|
| **状态流转管控** | 规范资产从提交到完结的全链路状态变迁，防止非法状态跳跃 |
| **审批链执行** | 支持多级审批（L1/L2/L3）、会签/或签模式、动态审批人路由 |
| **历史追溯** | 完整记录每一步操作的执行者、时间戳、状态快照 |
| **版本一致性** | 审批过程中防止资产信息被并发修改导致审批失效 |
| **审计日志** | 记录所有 API 调用、操作轨迹至 `audit_logs` 表 |

### 1.3 技术约束
- 状态机引擎：`RetirementStateMachine`（位于 `src/state_machine/retirement_state_machine.py`）
- 审批链模型：`ApprovalChain`（位于 `src/models/approval_chain.py`）
- 历史记录模型：`RetirementHistory`（位于 `src/models/retirement_history.py`）
- 审计日志中间件：`AuditLogger`（位于 `src/api/middleware/audit_logger.py`）

---

## 2. 数据模型

### 2.1 枚举定义 (`src/models/enums.py`)

```python
class RetirementStatus(str, Enum):
    """报废申请状态"""
    SUBMITTED = "SUBMITTED"                      # 已提交，待 L1 审批
    PENDING_L1 = "PENDING_L1"                    # 一级审批中
    PENDING_APPROVAL = "PENDING_APPROVAL"        # 多级审批中（通用）
    PENDING_APPROVAL_L1 = "PENDING_APPROVAL_L1"  # L1 审批中
    PENDING_APPROVAL_L2 = "PENDING_APPROVAL_L2"  # L2 审批中
    PENDING_APPROVAL_L3 = "PENDING_APPROVAL_L3"  # L3 审批中
    APPROVED = "APPROVED"                        # 已批准，待处置
    REJECTED = "REJECTED"                        # 已拒绝
    CANCELLED = "CANCELLED"                      # 已取消
    DISPOSED = "DISPOSED"                        # 已处置（终态）

class AssetStatus(str, Enum):
    """资产状态"""
    ACTIVE = "ACTIVE"                            # 使用中
    MAINTENANCE = "MAINTENANCE"                  # 维护中
    PENDING_RETIREMENT = "PENDING_RETIREMENT"    # 待报废
    RETIRED = "RETIRED"                          # 已退役（终态）

class UserRole(str, Enum):
    """用户角色"""
    ADMIN = "ADMIN"                              # 管理员
    ASSET_MANAGER = "ASSET_MANAGER"              # 资产管理员
    REQUESTER = "REQUESTER"                      # 普通请求者

class ApprovalLevel(str, Enum):
    """审批层级"""
    L1 = "L1"                                    # 一级审批
    L2 = "L2"                                    # 二级审批
    L3 = "L3"                                    # 三级审批
```

### 2.2 审批链模型 (`src/models/approval_chain.py`)

```python
class ApprovalChain(BaseModel):
    """审批链"""
    request_id: str
    config: ApprovalChainConfig
    current_level: Optional[ApprovalLevel] = None
    completed_levels: List[ApprovalLevel] = []
    pending_levels: List[ApprovalLevel] = []
    status: ApprovalChainStatus = ApprovalChainStatus.PENDING
    created_at: datetime
    updated_at: datetime

    def get_pending_steps(self) -> List[str]:
        """获取待审批层级列表"""

    def get_current_pending_step(self) -> Optional[str]:
        """获取当前待审批层级"""

    def get_completed_steps(self) -> List[str]:
        """获取已完成层级列表"""

    def is_all_approved(self) -> bool:
        """判断是否全部审批通过"""

    def is_rejected(self) -> bool:
        """判断是否已拒绝"""

    def get_progress_info(self) -> ProgressInfo:
        """获取进度详情"""

    def validate_version(self, asset_version: str) -> bool:
        """校验资产版本一致性"""
```

### 2.3 历史记录模型 (`src/models/retirement_history.py`)

```python
class RetirementHistory(BaseModel):
    """报废历史记录"""
    id: int
    retirement_id: str
    action: RetirementAction
    from_status: Optional[RetirementStatus]
    to_status: RetirementStatus
    operator_id: str
    operator_name: str
    comment: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """序列化为可存储格式"""
```

---

## 3. 状态机规格

### 3.1 状态流转图

```
┌──────────────┐     submit()     ┌─────────────────────┐
│   SUBMITTED  │ ──────────────→ │   PENDING_L1        │
└──────────────┘                  └─────────┬───────────┘
                                           │ approve(L1)
┌──────────────┐     approve()   ┌─────────▼───────────┐
│  REJECTED    │ ←───────────────│   PENDING_APPROVAL  │
└──────────────┘                 └─────────┬───────────┘
      ↑                                   │ approve(all)
      │ cancel()                          ↓
┌─────┴──────┐                   ┌─────────────────┐
│  CANCELLED │                   │    APPROVED     │
└────────────┘                   └────────┬────────┘
                                           │ dispose()
                                           ↓
                                    ┌──────────────┐
                                    │   DISPOSED   │
                                    └──────────────┘
```

### 3.2 状态定义

| 状态 | 说明 | 可执行操作 |
|------|------|-----------|
| SUBMITTED | 已提交 | cancel(), approve(L1) |
| PENDING_L1 | L1 审批中 | cancel(), approve(L1) |
| PENDING_APPROVAL | 多级审批中 | cancel(), approve() |
| APPROVED | 已批准 | dispose() |
| REJECTED | 已拒绝 | （终态） |
| CANCELLED | 已取消 | （终态） |
| DISPOSED | 已处置 | （终态） |

### 3.3 禁止规则

1. **SUBMITTED → APPROVED**：禁止跳过审批
2. **CANCELLED → DISPOSED**：已取消资产不可处置
3. **DISPOSED → 任意状态**：终态不可回退
4. **REJECTED → 任意状态**：终态不可回退

### 3.4 核心接口

```python
class RetirementStateMachine:
    """资产报废状态机"""
    status_: RetirementStatus

    def submit(self) -> "RetirementStateMachine":
        """提交报废申请，触发 L1 审批"""

    def approve(self, level: str, approver_id: str = None) -> "RetirementStateMachine":
        """执行指定层级审批"""

    def reject(self, level: str, reason: str) -> "RetirementStateMachine":
        """拒绝报废申请"""

    def cancel(self) -> "RetirementStateMachine":
        """取消报废申请"""

    def dispose(self) -> "RetirementStateMachine":
        """执行资产处置"""

    def transition(self, target_status: RetirementStatus) -> "RetirementStateMachine":
        """核心状态跳转，内部调用"""

    def get_progress(self) -> float:
        """获取完成进度百分比 (0-100)"""

    def get_history(self) -> List[RetirementHistory]:
        """获取完整操作历史"""

    def get_pending_steps(self) -> List[str]:
        """获取待审批层级列表"""

    def get_completed_steps(self) -> List[str]:
        """获取已完成层级列表"""


def create_retirement_state_machine(
    request_id: str,
    config: ApprovalChainConfig
) -> RetirementStateMachine:
    """工厂函数：创建资产报废状态机实例"""
```

---

## 4. 审批链规格

### 4.1 审批层级

| 层级 | 角色要求 | 说明 |
|------|---------|------|
| L1 | ASSET_MANAGER, ADMIN | 一级审批（资产经理） |
| L2 | ASSET_MANAGER, ADMIN | 二级审批（部门主管） |
| L3 | ADMIN | 三级审批（管理员最终审批） |

### 4.2 审批模式

| 模式 | 说明 | 实现 |
|------|------|------|
| 会签 | 全部审批人通过方可通过 | 累计审批 |
| 或签 | 任一审批人通过即可 | 首次通过即流转 |

### 4.3 版本校验

```python
def validate_version(self, asset_version: str) -> bool:
    """
    审批执行前校验资产版本一致性
    - 版本匹配：通过
    - 版本不匹配：抛出 VersionConflictError
    """
```

### 4.4 进度计算

```python
def get_progress(self) -> float:
    """进度百分比"""
    progress_map = {
        RetirementStatus.SUBMITTED: 0.0,
        RetirementStatus.PENDING_L1: 25.0,
        RetirementStatus.PENDING_APPROVAL: 50.0,
        RetirementStatus.APPROVED: 90.0,
        RetirementStatus.DISPOSED: 100.0,
    }
    return progress_map.get(self.status_, 0.0)
```

---

## 5. 审计日志规格

### 5.1 审计中间件 (`src/api/middleware/audit_logger.py`)

```python
class AuditLogger:
    """审计日志中间件"""

    async def log_retirement_submit(
        self,
        request_id: str,
        asset_id: str,
        user_id: str,
        metadata: Dict[str, Any]
    ):
        """记录报废申请提交"""

    async def log_retirement_approve(
        self,
        request_id: str,
        level: str,
        approver_id: str,
        comment: str = None
    ):
        """记录报废审批"""

    async def log_retirement_reject(
        self,
        request_id: str,
        level: str,
        rejector_id: str,
        reason: str
    ):
        """记录报废拒绝"""

    async def log_retirement_cancel(
        self,
        request_id: str,
        user_id: str,
        reason: str = None
    ):
        """记录报废取消"""

    async def log_retirement_dispose(
        self,
        request_id: str,
        asset_id: str,
        operator_id: str,
        disposal_method: str
    ):
        """记录资产处置"""
```

### 5.2 审计字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| action | str | 操作类型 |
| resource_type | str | 资源类型（如：RETIREMENT_REQUEST） |
| resource_id | str | 资源ID |
| user_id | str | 操作人 |
| user_name | str | 操作人姓名 |
| ip_address | str | IP 地址 |
| user_agent | str | User-Agent |
| request_body | JSON | 请求体 |
| response_status | int | 响应状态码 |
| duration_ms | int | 耗时（毫秒） |
| created_at | datetime | 创建时间 |

---

## 6. 验收测试基准 (ATB)

### 6.1 ATB-002: 状态流转测试

#### ATB-002-01: 提交触发审批链

```python
def test_atb_002_01_submit_triggers_approval_chain():
    """
    物理期待:
    1. 调用 state_machine.submit()
    2. RetirementStatus 变更为 PENDING_L1
    3. 触发 ApprovalChain 初始化，创建第一层审批节点
    4. get_current_pending_step() 返回非空
    """
    sm = create_retirement_state_machine(request_id="REQ-001", config=default_config)
    result = sm.submit()

    assert result.status_ == RetirementStatus.PENDING_L1
    assert sm.get_current_pending_step() is not None
    assert sm.get_pending_steps() == ["L1"]
```

#### ATB-002-02: SUBMITTED → PENDING_L1 流转

```python
def test_atb_002_02_submitted_to_pending_l1():
    """
    物理期待:
    1. L1 审批通过后，状态流转至 PENDING_APPROVAL
    2. ApprovalChain.is_all_approved() 返回 False（还有 L2/L3）
    3. get_pending_steps() 返回剩余审批层级
    """
    sm = create_retirement_state_machine(request_id="REQ-001", config=multi_level_config)
    sm.submit()
    sm.approve(level="L1")

    assert sm.status_ == RetirementStatus.PENDING_APPROVAL
    assert sm.get_pending_steps() == ["L2", "L3"]
```

### 6.2 ATB-003: 审批链执行测试

```python
def test_atb_003_approval_chain_execution():
    """
    物理期待:
    1. 按序执行 L1 → L2 → L3 审批
    2. 每级审批后调用 is_all_approved() 验证
    3. L3 审批完成后状态变为 APPROVED
    4. get_completed_steps() 长度 = 3
    """
    sm = create_retirement_state_machine(request_id="REQ-002", config=triple_level_config)
    sm.submit()

    sm.approve(level="L1"); assert sm.is_all_approved() == False
    sm.approve(level="L2"); assert sm.is_all_approved() == False
    sm.approve(level="L3")

    assert sm.is_all_approved() == True
    assert sm.status_ == RetirementStatus.APPROVED
    assert len(sm.get_completed_steps()) == 3
```

### 6.3 ATB-004: 拒绝/取消/处置测试

```python
def test_rejection_flow():
    """拒绝流程"""
    sm = create_retirement_state_machine(request_id="REQ-003", config=default_config)
    sm.submit()
    sm.reject(level="L1", reason="不符合报废条件")

    assert sm.status_ == RetirementStatus.REJECTED
    assert sm.is_rejected() == True


def test_cancellation():
    """取消流程"""
    sm = create_retirement_state_machine(request_id="REQ-004", config=default_config)
    sm.submit()
    sm.cancel()

    assert sm.status_ == RetirementStatus.CANCELLED
    with pytest.raises(InvalidStateTransitionError):
        sm.approve(level="L1")


def test_disposal_flow():
    """处置流程"""
    sm = create_retirement_state_machine(request_id="REQ-005", config=default_config)
    sm.submit()
    sm.approve(level="L1")
    sm.dispose()

    assert sm.status_ == RetirementStatus.DISPOSED
    assert sm.get_progress() == 100.0
```

### 6.4 ATB-005: 边界保护测试

```python
def test_version_validation():
    """版本校验"""
    approval_chain = ApprovalChain(request_id="REQ-008")
    assert approval_chain.validate_version("v1.0") == True

    with pytest.raises(VersionConflictError):
        approval_chain.validate_version("v0.9")
```

---

## 7. 开发实施计划

### Phase 1: 核心状态机
| 任务 | 源码位置 | 优先级 |
|------|---------|--------|
| 定义枚举 | `src/models/enums.py` | P1 |
| 实现 ApprovalChain 模型 | `src/models/approval_chain.py` | P1 |
| 实现 RetirementHistory 模型 | `src/models/retirement_history.py` | P1 |
| 实现 RetirementStateMachine | `src/state_machine/retirement_state_machine.py` | P1 |
| 实现工厂函数 | `src/state_machine/retirement_state_machine.py` L546 | P1 |

### Phase 2: 审批链集成
| 任务 | 源码位置 | 优先级 |
|------|---------|--------|
| 实现 ApprovalChainService | `src/services/approval_chain_service.py` | P1 |
| 整合状态机与审批链 | `src/services/retirement_service.py` | P1 |

### Phase 3: API 层
| 任务 | 源码位置 | 优先级 |
|------|---------|--------|
| 实现 RetirementRouter | `src/api/routers/retirement_router.py` | P1 |
| 实现 AuditLogger 中间件 | `src/api/middleware/audit_logger.py` | P1 |

### Phase 4: 测试覆盖
| 任务 | 源码位置 | 优先级 |
|------|---------|--------|
| 状态机单元测试 | `tests/state_machine/test_retirement_sm.py` | P1 |
| API 集成测试 | `tests/api/test_retirement_api.py` | P1 |
| 审批链服务测试 | `tests/services/test_retirement_service.py` | P1 |

---

## 8. 文件清单

| 文件路径 | 说明 |
|---------|------|
| `src/models/enums.py` | 枚举定义（RetirementStatus, AssetStatus, UserRole） |
| `src/models/approval_chain.py` | 审批链模型 |
| `src/models/retirement_history.py` | 历史记录模型 |
| `src/models/asset_retirement.py` | 资产报废模型 |
| `src/state_machine/retirement_state_machine.py` | 状态机引擎 |
| `src/services/approval_chain_service.py` | 审批链服务 |
| `src/services/retirement_service.py` | 报废服务 |
| `src/services/notification_service.py` | 通知服务 |
| `src/api/routers/retirement_router.py` | 报废 API 路由 |
| `src/api/middleware/audit_logger.py` | 审计日志中间件 |
| `src/api/deps/auth.py` | 认证依赖 |
| `src/schemas/retirement_request.py` | 报废请求 Schema |
| `src/schemas/approval.py` | 审批 Schema |

---

**文档版本**: 1.0  
**创建日期**: 2024  
**审核状态**: 已批准