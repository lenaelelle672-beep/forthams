# 资产报废/退役流程规格指导文档

## 1. 需求与背景

### 1.1 业务场景

资产报废/退役流程是企业资产管理系统的核心业务流程，涵盖从报废申请提交、审批链流转、多级审批决策、状态机驱动到历史记录归档的完整生命周期管理。

### 1.2 核心诉求

| 诉求维度 | 描述 |
|---------|------|
| **状态流转管控** | 规范资产从提交到完结的全链路状态变迁，防止非法状态跳跃 |
| **审批链执行** | 支持多级审批（L1/L2/L3）、会签/或签模式、动态审批人路由 |
| **历史追溯** | 完整记录每一步操作的执行者、时间戳、状态快照 |
| **版本一致性** | 审批过程中防止资产信息被并发修改导致审批失效 |

### 1.3 技术约束

| 组件 | 技术栈 |
|-----|-------|
| 状态机引擎 | `RetirementStateMachine` (`src/state_machine/retirement_state_machine.py`) |
| 审批链模型 | `ApprovalChain` (`src/models/approval_chain.py`) |
| 历史记录模型 | `RetirementHistory` (`src/models/retirement_history.py`) |
| 枚举定义 | `RetirementStatus`, `AssetStatus`, `UserRole`, `ApprovalLevel` (`src/models/enums.py`, `src/api/deps/auth.py`) |
| API 路由 | `retirement_router.py` (`src/api/routers/retirement_router.py`) |

---

## 2. 核心实体定义

### 2.1 枚举类型

#### RetirementStatus (报废状态)

```python
# src/models/enums.py L16 / src/api/deps/auth.py L53
class RetirementStatus(str, Enum):
    """
    资产报废状态枚举
    定义报废请求在生命周期中的状态
    """
    SUBMITTED = "SUBMITTED"                      # 已提交 - 初始状态
    PENDING_L1 = "PENDING_L1"                    # 待一级审批
    PENDING_APPROVAL_L2 = "PENDING_APPROVAL_L2"  # 待二级审批
    PENDING_APPROVAL_L3 = "PENDING_APPROVAL_L3"  # 待三级审批
    APPROVED = "APPROVED"                        # 已批准 - 可执行处置
    REJECTED = "REJECTED"                        # 已拒绝
    CANCELLED = "CANCELLED"                      # 已取消
    DISPOSED = "DISPOSED"                        # 已处置 - 终态
```

#### AssetStatus (资产状态)

```python
# src/models/enums.py L57 / src/api/deps/auth.py L33
class AssetStatus(str, Enum):
    """
    资产状态枚举
    定义资产在生命周期中的状态
    """
    ACTIVE = "ACTIVE"           # 使用中
    MAINTENANCE = "MAINTENANCE" # 维护中
    RETIRED = "RETIRED"         # 已退役 - 终态
```

#### UserRole (用户角色)

```python
# src/models/enums.py L46 / src/api/deps/auth.py L26
class UserRole(str, Enum):
    """
    用户角色枚举
    定义系统中的用户角色及权限
    """
    ADMIN = "ADMIN"                             # 系统管理员 - 最高权限
    ASSET_MANAGER = "ASSET_MANAGER"             # 资产管理员 - 可执行各级审批
    REQUESTER = "REQUESTER"                     # 普通请求者 - 可发起报废请求
```

#### ApprovalLevel (审批层级)

```python
# src/api/deps/auth.py L43
class ApprovalLevel(str, Enum):
    """
    审批层级枚举
    定义三级审批链路
    """
    L1 = "L1"   # 一级审批 - 资产经理
    L2 = "L2"   # 二级审批 - 部门主管
    L3 = "L3"   # 三级审批 - 管理员最终审批
```

### 2.2 数据模型

#### ApprovalChain (审批链)

```python
# src/models/approval_chain.py
class ApprovalChain:
    """
    审批链模型
    负责管理报废请求的审批链路和层级状态
    """
    request_id: str                              # 报废请求ID
    config: ApprovalChainConfig                  # 审批链配置
    status: ApprovalStatus                       # 当前审批状态
    completed_levels: List[str]                  # 已完成审批的层级
    pending_levels: List[str]                   # 待审批的层级
    
    def get_pending_steps(self) -> List[str]: ...
    def get_current_pending_step(self) -> Optional[str]: ...
    def get_completed_steps(self) -> List[str]: ...
    def is_all_approved(self) -> bool: ...
    def is_rejected(self) -> bool: ...
    def get_progress_info(self) -> ProgressInfo: ...
    def validate_version(self, asset_version: str) -> bool: ...
    def _level_order(self) -> List[str]: ...
```

#### RetirementHistory (历史记录)

```python
# src/models/retirement_history.py L68
class RetirementHistory:
    """
    报废历史记录模型
    记录所有报废操作的历史轨迹
    """
    id: str                                      # 记录ID
    retirement_id: str                           # 报废请求ID
    action: str                                  # 操作类型: SUBMIT/APPROVE/REJECT/CANCEL/DISPOSE
    operator: str                                # 操作人
    timestamp: datetime                          # 操作时间
    from_status: str                             # 源状态
    to_status: str                               # 目标状态
    comment: Optional[str]                       # 审批意见/拒绝原因
    metadata: Optional[Dict]                     # 额外元数据
    
    def to_dict(self) -> Dict: ...               # 序列化为可存储格式
```

#### AssetRetirement (资产报废请求)

```python
# src/models/asset_retirement.py
class AssetRetirement:
    """
    资产报废请求模型
    聚合审批链和状态机的核心业务实体
    """
    id: str                                      # 报废请求ID
    asset_id: str                                # 资产ID
    requester_id: str                            # 请求人ID
    status: RetirementStatus                      # 当前状态
    approval_chain: ApprovalChain                 # 审批链
    version: str                                 # 版本号(用于乐观锁)
    created_at: datetime                         # 创建时间
    updated_at: datetime                         # 更新时间
```

---

## 3. 状态流转规范

### 3.1 完整状态机

```
                                    ┌─────────────────┐
                                    │    CANCELLED    │
                                    │ (可从SUBMITTED/ │
                                    │  PENDING_L1取消)│
                                    └────────┬────────┘
                                             │ cancel()
┌──────────────┐     submit()      ┌────────▼────────┐
│   SUBMITTED  │ ────────────────→ │   PENDING_L1   │
└──────────────┘                   └────────┬────────┘
                                           │ approve(L1)
┌──────────────┐                          │
│  REJECTED    │ ←─────────────────────────┼──────────────────┐
└──────────────┘                          │ reject()          │
      ↑                                   │                   │
      │ cancel()                          ▼                   │
┌─────┴──────┐                  ┌─────────────────────┐       │
│  CANCELLED │                  │ PENDING_APPROVAL_*  │       │
└────────────┘                  │ (L2/L3 多级审批)    │       │
                                └─────────┬───────────┘       │
                                          │ approve(all)      │
                                          ▼                   │
                                 ┌─────────────────┐           │
                                 │    APPROVED     │           │
                                 └────────┬────────┘           │
                                          │ dispose()          │
                                          ▼                    │
                                 ┌─────────────────┐           │
                                 │    DISPOSED     │───────────┘
                                 │     (终态)      │  reject()
                                 └─────────────────┘
```

### 3.2 状态转换规则表

| 源状态 | 目标状态 | 触发方法 | 前置条件 | 后置动作 |
|-------|---------|---------|---------|---------|
| - | SUBMITTED | `submit()` | 用户发起报废申请 | 初始化审批链 |
| SUBMITTED | PENDING_L1 | `submit()` | 申请已提交 | 创建L1审批节点 |
| PENDING_L1 | PENDING_APPROVAL_* | `approve(L1)` | L1审批通过 | 激活L2/L3审批 |
| PENDING_APPROVAL_* | APPROVED | `approve(L*)` | 全部审批通过 | 允许执行处置 |
| PENDING_* | REJECTED | `reject()` | 任意层级拒绝 | 流程终止 |
| SUBMITTED/PENDING_L1 | CANCELLED | `cancel()` | 用户主动取消 | 流程终止 |
| APPROVED | DISPOSED | `dispose()` | 已批准处置 | 资产状态更新 |

### 3.3 禁止的状态跳跃

| 禁止场景 | 说明 |
|---------|------|
| SUBMITTED → APPROVED | 禁止跳过所有审批层级 |
| SUBMITTED → DISPOSED | 禁止跳过审批和处置前检查 |
| CANCELLED → 任意状态 | 已取消的请求不可恢复 |
| DISPOSED → 任意状态 | 终态不可回退 |
| REJECTED → 任意状态 | 被拒绝的请求需重新发起 |

---

## 4. 审批链执行规范

### 4.1 审批层级定义

```python
# src/api/deps/auth.py L94-107
class ApprovalContext(BaseModel):
    """
    审批上下文模型
    用于审批操作时的权限验证
    """
    retirement_id: str
    current_user: CurrentUser
    required_level: ApprovalLevel
    requester_id: str

    def validate_approval_permission(self) -> bool:
        """
        验证当前用户是否有权限执行该层级的审批

        验证规则:
            - L1 审批: ASSET_MANAGER 或 ADMIN
            - L2 审批: ASSET_MANAGER 或 ADMIN
            - L3 审批: ADMIN
        """
        pass
```

### 4.2 审批权限矩阵

| 审批层级 | ASSET_MANAGER | ADMIN | REQUESTER |
|---------|---------------|-------|-----------|
| L1 | ✅ | ✅ | ❌ |
| L2 | ✅ | ✅ | ❌ |
| L3 | ❌ | ✅ | ❌ |

### 4.3 版本校验机制

```python
# src/models/approval_chain.py L281
def validate_version(self, asset_version: str) -> bool:
    """
    验证资产版本一致性
    
    防止审批过程中资产信息被并发修改
    导致审批失效或数据不一致
    
    Args:
        asset_version: 当前资产版本号
    
    Returns:
        bool: 版本匹配返回True，否则抛出VersionConflictError
    """
    if asset_version != self.version:
        raise VersionConflictError(
            f"Asset version conflict: expected {self.version}, got {asset_version}"
        )
    return True
```

---

## 5. 接口规范

### 5.1 状态机核心接口

```python
# src/state_machine/retirement_state_machine.py

class RetirementStateMachine:
    """
    资产报废状态机
    核心状态流转引擎
    """
    status_: RetirementStatus
    
    def submit(self) -> RetirementStateMachine:
        """
        提交报废申请
        
        物理期待:
            1. status 变更为 SUBMITTED
            2. 初始化审批链
            3. 自动触发第一次状态转换到 PENDING_L1
        """
        
    def approve(self, level: str, approver_id: str = None) -> RetirementStateMachine:
        """
        执行指定层级审批
        
        Args:
            level: 审批层级 (L1/L2/L3)
            approver_id: 审批人ID
        
        物理期待:
            1. 验证审批权限
            2. 校验版本一致性
            3. 更新审批链状态
            4. 执行状态转换
            5. 记录历史
        """
        
    def reject(self, level: str, reason: str) -> RetirementStateMachine:
        """
        拒绝报废申请
        
        Args:
            level: 审批层级
            reason: 拒绝原因
        
        物理期待:
            1. 状态变为 REJECTED
            2. 记录拒绝历史
            3. 发送通知
        """
        
    def cancel(self) -> RetirementStateMachine:
        """
        取消报废申请
        
        物理期待:
            1. SUBMITTED/PENDING_L1 可取消
            2. 状态变为 CANCELLED
            3. 释放资源
        """
        
    def dispose(self) -> RetirementStateMachine:
        """
        执行资产处置
        
        物理期待:
            1. 仅 APPROVED 状态可执行
            2. 状态变为 DISPOSED
            3. 同步更新 AssetStatus
        """
        
    def get_progress(self) -> float:
        """
        获取完成进度
        
        Returns:
            float: 0-100 的进度百分比
        
        进度映射:
            - SUBMITTED: 0%
            - PENDING_L1: 25%
            - PENDING_APPROVAL_*: 25-75%
            - APPROVED: 90%
            - DISPOSED: 100%
        """
        
    def get_history(self) -> List[RetirementHistory]:
        """
        获取操作历史
        
        Returns:
            List[RetirementHistory]: 按时间倒序的历史记录
        """
        
    def get_pending_steps(self) -> List[str]:
        """
        获取待审批层级
        
        Returns:
            List[str]: 待处理的审批层级列表
        """
        
    def get_completed_steps(self) -> List[str]:
        """
        获取已完成层级
        
        Returns:
            List[str]: 已完成的审批层级列表
        """
```

### 5.2 工厂函数

```python
# src/state_machine/retirement_state_machine.py L546

def create_retirement_state_machine(
    request_id: str,
    config: ApprovalChainConfig
) -> RetirementStateMachine:
    """
    工厂函数：创建资产报废状态机实例
    
    Args:
        request_id: 报废请求ID
        config: 审批链配置
    
    Returns:
        RetirementStateMachine: 状态机实例
    
    使用示例:
        sm = create_retirement_state_machine(
            request_id="RET-2024-001",
            config=ApprovalChainConfig(levels=["L1", "L2", "L3"])
        )
    """
```

### 5.3 进度信息接口

```python
# src/api/deps/auth.py L150-156

class ProgressInfo(BaseModel):
    """
    进度信息模型
    """
    current_step: str                            # 当前步骤
    total_steps: int                             # 总步骤数
    pending_approvers: List[str]                 # 待审批人列表
    progress_status: str                          # 进度状态

    class Config:
        use_enum_values = True
```

---

## 6. 验收测试基准 (ATB)

### 6.1 状态流转测试 (ATB-002)

#### ATB-002-01: SUBMITTED → PENDING_L1 提交触发

```python
# tests/state_machine/test_retirement_sm.py L254
# tests/api/test_retirement_api.py L185

def test_atb_002_01_submitted_to_pending_l1(self):
    """
    物理期待:
    1. 调用 state_machine.submit()
    2. RetirementStatus 变更为 PENDING_L1
    3. 触发 ApprovalChain 初始化，创建第一层审批节点
    4. get_current_pending_step() 返回非空
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-001", 
        config=default_config
    )
    
    # When
    result = sm.submit()
    
    # Then
    assert result.status_ == RetirementStatus.PENDING_L1
    assert sm.get_current_pending_step() is not None
    assert "L1" in sm.get_pending_steps()
    assert sm.get_progress() == 25.0
```

#### ATB-002-02: PENDING_L1 → PENDING_APPROVAL 流转

```python
# tests/state_machine/test_retirement_sm.py L254
# tests/api/test_retirement_api.py L185

def test_atb_002_02_pending_l1_to_pending_approval(self):
    """
    物理期待:
    1. L1 审批通过后，状态流转至 PENDING_APPROVAL_L2
    2. ApprovalChain.is_all_approved() 返回 False（还有 L2/L3）
    3. get_pending_steps() 返回剩余审批层级 ["L2", "L3"]
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-002", 
        config=multi_level_config
    )
    sm.submit()
    
    # When
    sm.approve(level="L1", approver_id="manager-001")
    
    # Then
    assert sm.status_ == RetirementStatus.PENDING_APPROVAL_L2
    assert sm.is_all_approved() == False
    assert sm.get_pending_steps() == ["L2", "L3"]
    assert sm.get_completed_steps() == ["L1"]
```

#### ATB-002-03: 完整审批链通过 → APPROVED

```python
# tests/services/test_retirement_service.py L563

def test_atb_002_03_full_approval_chain_to_approved(self):
    """
    物理期待:
    1. 按序执行 L1 → L2 → L3 审批
    2. 每级审批后调用 is_all_approved() 验证
    3. L3 审批完成后状态变为 APPROVED
    4. get_completed_steps() 长度 = 3
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-003", 
        config=triple_level_config
    )
    sm.submit()
    
    # When
    sm.approve(level="L1")
    assert sm.is_all_approved() == False
    
    sm.approve(level="L2")
    assert sm.is_all_approved() == False
    
    sm.approve(level="L3")
    
    # Then
    assert sm.is_all_approved() == True
    assert sm.status_ == RetirementStatus.APPROVED
    assert len(sm.get_completed_steps()) == 3
    assert sm.get_progress() == 90.0
```

#### ATB-002-04: 审批拒绝 → REJECTED

```python
# tests/state_machine/test_retirement_sm.py

def test_atb_002_04_rejection_flow(self):
    """
    物理期待:
    1. 任意层级审批人调用 reject()
    2. 状态立即变为 REJECTED
    3. 后续审批节点全部作废
    4. get_history() 包含 REJECTED 记录
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-004", 
        config=default_config
    )
    sm.submit()
    
    # When
    sm.reject(level="L1", reason="不符合报废条件")
    
    # Then
    assert sm.status_ == RetirementStatus.REJECTED
    assert sm.is_rejected() == True
    
    history = sm.get_history()
    assert any(h.action == "REJECT" for h in history)
```

#### ATB-002-05: 取消 → CANCELLED

```python
# src/state_machine/retirement_state_machine.py L446

def test_atb_002_05_cancellation(self):
    """
    物理期待:
    1. SUBMITTED 或 PENDING_L1 状态下可取消
    2. cancel() 后状态变为 CANCELLED
    3. cancel() 后不可调用 approve/reject
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-005", 
        config=default_config
    )
    sm.submit()
    
    # When
    sm.cancel()
    
    # Then
    assert sm.status_ == RetirementStatus.CANCELLED
    
    with pytest.raises(InvalidStateTransitionError):
        sm.approve(level="L1")
```

#### ATB-002-06: 处置 → DISPOSED

```python
# tests/services/test_retirement_service.py L416

def test_atb_002_06_disposal_flow(self):
    """
    物理期待:
    1. APPROVED 状态下调用 dispose()
    2. 状态变为 DISPOSED
    3. AssetStatus 同步更新为 DISPOSED
    4. dispose() 后不可逆
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-006", 
        config=default_config
    )
    sm.submit()
    sm.approve(level="L1")
    
    # When
    sm.dispose()
    
    # Then
    assert sm.status_ == RetirementStatus.DISPOSED
    assert sm.get_progress() == 100.0
    
    # 不可逆验证
    with pytest.raises(InvalidStateTransitionError):
        sm.cancel()
```

### 6.2 进度与历史查询测试 (ATB-003)

#### ATB-003-01: 进度计算

```python
# src/state_machine/retirement_state_machine.py L470

def test_atb_003_01_progress_calculation(self):
    """
    物理期待:
    1. get_progress() 返回 0-100 浮点数
    2. SUBMITTED: 0%
    3. PENDING_L1: 25%
    4. PENDING_APPROVAL (中间): 50-75%
    5. APPROVED: 90%
    6. DISPOSED: 100%
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-007", 
        config=quad_level_config
    )
    
    # Then - initial
    assert sm.get_progress() == 0.0
    
    # When - submit
    sm.submit()
    assert sm.get_progress() == 25.0
    
    # When - L1 approved
    sm.approve(level="L1")
    assert sm.get_progress() == 50.0
    
    # When - L2 approved
    sm.approve(level="L2")
    assert sm.get_progress() == 75.0
```

#### ATB-003-02: 历史记录

```python
# src/state_machine/retirement_state_machine.py L532

def test_atb_003_02_history_recording(self):
    """
    物理期待:
    1. get_history() 返回 List[RetirementHistory]
    2. 每条记录包含: timestamp, operator, action, from_status, to_status
    3. to_dict() 序列化为可存储格式
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-008", 
        config=default_config
    )
    sm.submit()
    sm.approve(level="L1")
    
    # When
    history = sm.get_history()
    
    # Then
    assert len(history) == 2
    assert history[0].action == "SUBMIT"
    assert history[0].from_status is None
    assert history[0].to_status == RetirementStatus.SUBMITTED
    
    assert history[1].action == "APPROVE"
    assert history[1].to_dict()["action"] == "APPROVE"
    assert "timestamp" in history[1].to_dict()
```

### 6.3 边界保护测试 (ATB-004)

#### ATB-004-01: 版本校验

```python
# src/models/approval_chain.py L281

def test_atb_004_01_version_validation(self):
    """
    物理期待:
    1. 审批链执行前调用 validate_version(asset_version)
    2. 版本匹配: 通过
    3. 版本不匹配: 抛出 VersionConflictError
    """
    # Given
    approval_chain = ApprovalChain(
        request_id="REQ-009",
        version="v1.0"
    )
    
    # Then - version match
    assert approval_chain.validate_version("v1.0") == True
    
    # Then - version conflict
    with pytest.raises(VersionConflictError):
        approval_chain.validate_version("v0.9")
```

#### ATB-004-02: 并发审批保护

```python
def test_atb_004_02_concurrent_approval_protection(self):
    """
    物理期待:
    1. 同一审批节点不能被重复审批
    2. 并发调用只有一个成功
    """
    # Given
    sm = create_retirement_state_machine(
        request_id="REQ-010", 
        config=default_config
    )
    sm.submit()
    
    # When - concurrent approval
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(sm.approve, level="L1", approver_id="manager-001"),
            executor.submit(sm.approve, level="L1", approver_id="manager-002")
        ]
        results = [f.result() for f in futures]
    
    # Then - only one succeeds
    approvals = [r for r in results if r.status_ != RetirementStatus.REJECTED]
    assert len(approvals) == 1
```

---

## 7. 开发切入层级序列

### 7.1 层级 1: 枚举与模型定义

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 定义 `RetirementStatus` 枚举 | `src/models/enums.py` L16, `src/api/deps/auth.py` L53 |
| P1 | 定义 `AssetStatus` 枚举 | `src/models/enums.py` L57, `src/api/deps/auth.py` L33 |
| P1 | 定义 `UserRole` 枚举 | `src/models/enums.py` L46, `src/api/deps/auth.py` L26 |
| P1 | 定义 `ApprovalLevel` 枚举 | `src/api/deps/auth.py` L43 |
| P1 | 实现 `ApprovalChain` 模型 | `src/models/approval_chain.py` |
| P1 | 实现 `ApprovalContext` 审批上下文 | `src/api/deps/auth.py` L84 |
| P1 | 实现 `ProgressInfo` 进度信息模型 | `src/api/deps/auth.py` L150 |
| P1 | 实现 `RetirementHistory` 模型 | `src/models/retirement_history.py` L68 |

### 7.2 层级 2: 审批链核心逻辑

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `get_pending_steps()` | `src/models/approval_chain.py` L176 |
| P1 | 实现 `get_current_pending_step()` | `src/models/approval_chain.py` L200 |
| P1 | 实现 `get_completed_steps()` | `src/models/approval_chain.py` L188 |
| P1 | 实现 `is_all_approved()` | `src/models/approval_chain.py` L230 |
| P1 | 实现 `is_rejected()` | `src/models/approval_chain.py` L242 |
| P1 | 实现 `get_progress_info()` | `src/models/approval_chain.py` L254 |
| P1 | 实现 `validate_version()` | `src/models/approval_chain.py` L281 |
| P2 | 实现 `_level_order()` 层级排序 | `src/models/approval_chain.py` L213 |
| P2 | 实现 `validate_approval_permission()` | `src/api/deps/auth.py` L94 |

### 7.3 层级 3: 状态机引擎

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `RetirementStateMachine.__init__()` | `src/state_machine/retirement_state_machine.py` L262 |
| P1 | 实现 `submit()` 提交入口 | `src/state_machine/retirement_state_machine.py` L322 |
| P1 | 实现 `approve()` 审批执行 | `src/state_machine/retirement_state_machine.py` L336 |
| P1 | 实现 `reject()` 拒绝执行 | `src/state_machine/retirement_state_machine.py` L381 |
| P1 | 实现 `cancel()` 取消执行 | `src/state_machine/retirement_state_machine.py` L446 |
| P1 | 实现 `dispose()` 处置执行 | `src/state_machine/retirement_state_machine.py` L415 |
| P1 | 实现 `transition()` 核心状态跳转 | `src/state_machine/transitions.py` L416 |
| P1 | 实现 `_record_action()` 历史记录 | `src/state_machine/retirement_state_machine.py` L505 |
| P2 | 实现 `get_progress()` 进度计算 | `src/state_machine/retirement_state_machine.py` L470 |
| P2 | 实现 `_get_pending_approvers()` 待审批人查询 | `src/state_machine/retirement_state_machine.py` L492 |
| P2 | 实现 `get_history()` 历史查询 | `src/state_machine/retirement_state_machine.py` L532 |
| P3 | 实现 `get_progress_info()` 对外交互 | `src/state_machine/retirement_state_machine.py` L470 |
| P1 | 实现工厂函数 `create_retirement_state_machine()` | `src/state_machine/retirement_state_machine.py` L546 |

### 7.4 层级 4: 服务层集成

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `ApprovalChainService` | `src/services/approval_chain_service.py` |
| P1 | 实现 `RetirementService` | `src/services/retirement_service.py` |
| P2 | 实现 `NotificationService` 通知发送 | `src/services/notification_service.py` |
| P2 | 实现 `AuditLogger` 审计日志 | `src/api/middleware/audit_logger.py` |

### 7.5 层级 5: API 路由

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `retirement_router.py` | `src/api/routers/retirement_router.py` |
| P1 | 实现 `approval.py` 审批 Schema | `src/schemas/approval.py` |
| P1 | 实现 `retirement_request.py` 请求 Schema | `src/schemas/retirement_request.py` |
| P2 | 实现 `CurrentUser` 认证依赖 | `src/api/deps/auth.py` |

### 7.6 层级 6: 集成与边界测试

| 优先级 | 任务 | 测试文件 |
|-------|------|---------|
| P1 | ATB-002 状态流转集成测试 | `tests/state_machine/test_retirement_sm.py` |
| P1 | ATB-003 审批链执行测试 | `tests/services/test_retirement_service.py` |
| P1 | API 层 ATB 测试 | `tests/api/test_retirement_api.py` |
| P2 | 并发审批冲突测试 | `tests/services/test_retirement_service.py` |
| P2 | 版本冲突保护测试 | `tests/state_machine/test_retirement_sm.py` |
| P2 | 异常状态恢复测试 | `tests/state_machine/test_retirement_sm.py` |
| P2 | E2E 用户旅程测试 | `tests/e2e/retirement_flow.spec.ts` |

---

## 8. 当前 Phase 对应实施目标

| Phase | 实施目标 | 对应源码模块 | 关键交付物 |
|-------|---------|-------------|-----------|
| **Phase 1: 核心状态机** | 实现状态流转引擎，支持 SUBMITTED → PENDING_L1 → PENDING_APPROVAL_* → APPROVED/REJECTED → DISPOSED | `retirement_state_machine.py` L249-L541 | `RetirementStateMachine` 类 |
| **Phase 2: 审批链集成** | 整合审批链，执行多级审批验证，推进待审批节点 | `approval_chain.py` + `state_machine.py` | `ApprovalChain` 集成 |
| **Phase 3: 历史记录** | 记录状态变更、操作人、审批意见至 `retirement_history` 表 | `retirement_state_machine.py` L505 `_record_action()` | `RetirementHistory` 持久化 |
| **Phase 4: 边界保护** | 版本校验、并发控制、异常状态恢复 | `approval_chain.py` L281 `validate_version()` | 异常处理机制 |

---

## 9. 附录

### 9.1 关键文件索引

| 文件 | 用途 | 关键行号 |
|-----|------|---------|
| `src/models/enums.py` | 枚举定义 | L16, L46, L57 |
| `src/api/deps/auth.py` | 认证与枚举 | L26, L33, L43, L53, L80, L84, L94, L150 |
| `src/models/approval_chain.py` | 审批链模型 | L176, L188, L200, L213, L230, L242, L254, L281 |
| `src/models/retirement_history.py` | 历史记录 | L68 |
| `src/state_machine/retirement_state_machine.py` | 状态机引擎 | L249-L541, L262, L322, L336, L381, L415, L446, L470, L492, L505, L532, L546 |
| `src/state_machine/transitions.py` | 状态转换 | L416 |
| `src/state_machine/guards.py` | 守卫条件 | - |
| `src/services/approval_chain_service.py` | 审批链服务 | - |
| `src/services/retirement_service.py` | 报废服务 | - |
| `src/services/notification_service.py` | 通知服务 | - |
| `src/api/routers/retirement_router.py` | API路由 | - |
| `src/schemas/approval.py` | 审批Schema | - |
| `src/schemas/retirement_request.py` | 请求Schema | - |
| `src/api/middleware/audit_logger.py` | 审计日志 | - |
| `src/repositories/retirement_repository.py` | 数据仓储 | - |

### 9.2 异常类型定义

```python
class InvalidStateTransitionError(Exception):
    """非法状态转换异常"""
    pass

class VersionConflictError(Exception):
    """版本冲突异常"""
    pass

class ApprovalPermissionDeniedError(Exception):
    """审批权限不足异常"""
    pass

class RetirementRequestNotFoundError(Exception):
    """报废请求不存在异常"""
    pass
```

### 9.3 配置示例

```python
# 审批链配置示例
from dataclasses import dataclass

@dataclass
class ApprovalChainConfig:
    """审批链配置"""
    levels: List[str] = field(default_factory=lambda: ["L1"])
    approval_mode: str = "all"  # "all" 会签 / "any" 或签
    auto_forward: bool = True
    
# 使用示例
default_config = ApprovalChainConfig(levels=["L1"])
multi_level_config = ApprovalChainConfig(levels=["L1", "L2", "L3"])
```

---

## 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|-----|------|------|---------|
| 1.0 | 2024 | - | 初始版本 |