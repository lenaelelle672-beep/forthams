# 资产报废/退役流程规格指导文档

## 1. 概述

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
- 状态机引擎：`RetirementStateMachine`（位于 `src/state_machine/retirement_state_machine.py`）
- 审批链模型：`ApprovalChain`（位于 `src/models/approval_chain.py`）
- 历史记录模型：`RetirementHistory`（位于 `src/models/retirement_history.py`）

---

## 2. 核心实体

### 2.1 枚举定义

#### RetirementStatus（报废状态）
```python
class RetirementStatus(str, Enum):
    """资产报废状态枚举"""
    SUBMITTED = "SUBMITTED"                    # 已提交，待 L1 审批
    PENDING_L1 = "PENDING_L1"                  # 待一级审批
    PENDING_APPROVAL_L1 = "PENDING_APPROVAL_L1"
    PENDING_APPROVAL_L2 = "PENDING_APPROVAL_L2"
    PENDING_APPROVAL_L3 = "PENDING_APPROVAL_L3"
    APPROVED = "APPROVED"                      # 已批准，待处置
    REJECTED = "REJECTED"                      # 已拒绝
    CANCELLED = "CANCELLED"                    # 已取消
    DISPOSED = "DISPOSED"                      # 已处置（终态）
```

#### AssetStatus（资产状态）
```python
class AssetStatus(str, Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"                          # 使用中
    MAINTENANCE = "MAINTENANCE"                # 维护中
    RETIRED = "RETIRED"                        # 已退役
```

#### ApprovalLevel（审批层级）
```python
class ApprovalLevel(str, Enum):
    """审批层级枚举"""
    L1 = "L1"                                  # 一级审批 - 资产经理
    L2 = "L2"                                  # 二级审批 - 部门主管
    L3 = "L3"                                  # 三级审批 - 管理员最终审批
```

#### UserRole（用户角色）
```python
class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "ADMIN"                            # 管理员
    ASSET_MANAGER = "ASSET_MANAGER"            # 资产管理员
    REQUESTER = "REQUESTER"                    # 普通请求者
```

---

## 3. 状态流转规范

### 3.1 状态机状态图

```
┌──────────────┐     submit()     ┌─────────────────────┐
│   SUBMITTED  │ ──────────────→ │      PENDING_L1      │
└──────────────┘                  └─────────┬───────────┘
                                           │ approve(L1)
┌──────────────┐     approve()   ┌─────────▼───────────┐
│  REJECTED    │ ←───────────────│ PENDING_APPROVAL_L1 │
└──────────────┘                 └─────────┬───────────┘
      ↑                                   │ approve(L2)
      │ cancel()                          ↓
┌─────┴──────┐                 ┌─────────────────────┐
│  CANCELLED │                 │ PENDING_APPROVAL_L2 │
└────────────┘                 └─────────┬───────────┘
                                           │ approve(L3)
                                           ↓
                                    ┌──────────────┐
                                    │   APPROVED   │
                                    └──────┬───────┘
                                           │ dispose()
                                           ↓
                                    ┌──────────────┐
                                    │   DISPOSED   │
                                    └──────────────┘
```

### 3.2 禁止的状态跳跃规则

| 源状态 | 目标状态 | 禁止原因 |
|-------|---------|---------|
| SUBMITTED | APPROVED | 禁止跳过审批 |
| CANCELLED | DISPOSED | 已取消资产不可处置 |
| DISPOSED | 任意状态 | 终态不可回退 |
| REJECTED | APPROVED | 拒绝后不可直接批准 |

### 3.3 可逆状态规则

| 状态 | 可转换操作 |
|-----|-----------|
| SUBMITTED | submit(), cancel() |
| PENDING_L1 | approve(), reject(), cancel() |
| PENDING_APPROVAL_* | approve(), reject(), cancel() |
| APPROVED | dispose() |
| REJECTED | 可重新提交新申请 |
| CANCELLED | 可重新提交新申请 |

---

## 4. 审批链规范

### 4.1 ApprovalChain 核心接口

```python
class ApprovalChain:
    """审批链模型"""
    
    def get_pending_steps(self) -> List[str]:
        """获取待审批层级列表"""
        
    def get_current_pending_step(self) -> Optional[str]:
        """获取当前待审批的层级"""
        
    def get_completed_steps(self) -> List[str]:
        """获取已完成层级列表"""
        
    def is_all_approved(self) -> bool:
        """判断是否所有层级均已审批通过"""
        
    def is_rejected(self) -> bool:
        """判断是否被拒绝"""
        
    def get_progress_info(self) -> Dict[str, Any]:
        """获取审批进度详情"""
        
    def validate_version(self, asset_version: str) -> bool:
        """验证资产版本一致性"""
```

### 4.2 审批层级定义

| 层级 | 审批人角色 | 审批模式 | 触发条件 |
|-----|-----------|---------|---------|
| L1 | ASSET_MANAGER, ADMIN | 会签 | submit() 后 |
| L2 | ASSET_MANAGER, ADMIN | 会签 | L1 通过后 |
| L3 | ADMIN | 会签 | L2 通过后 |

### 4.3 版本校验规则

- 审批链执行前需调用 `validate_version()` 校验资产版本一致性
- 版本匹配：允许继续审批
- 版本冲突：抛出 `VersionConflictError`

---

## 5. 历史记录规范

### 5.1 RetirementHistory 模型

```python
class RetirementHistory:
    """报废流程历史记录模型"""
    
    retirement_id: str                        # 报废请求ID
    action: str                               # 操作类型: SUBMIT/APPROVE/REJECT/CANCEL/DISPOSE
    operator: str                             # 操作人
    timestamp: datetime                       # 操作时间
    from_status: str                          # 源状态
    to_status: str                            # 目标状态
    comment: Optional[str]                   # 审批意见
    metadata: Optional[Dict]                  # 附加元数据
```

### 5.2 记录触发规则

- 每一次 `transition()` 必须触发 `_record_action()` 记录历史
- 历史记录不可删除，只可追加
- 支持 `to_dict()` 序列化为可存储格式

---

## 6. 核心接口规范

### 6.1 RetirementStateMachine 核心接口

```python
class RetirementStateMachine:
    """资产报废状态机"""
    
    status_: RetirementStatus                 # 当前状态
    
    # 核心操作
    def submit(self) -> RetirementStateMachine:
        """提交报废申请，状态: SUBMITTED → PENDING_L1"""
        
    def approve(self, level: str, approver_id: str = None) -> RetirementStateMachine:
        """执行指定层级审批"""
        
    def reject(self, level: str, reason: str) -> RetirementStateMachine:
        """拒绝报废申请"""
        
    def cancel(self) -> RetirementStateMachine:
        """取消报废申请"""
        
    def dispose(self) -> RetirementStateMachine:
        """执行资产处置"""
        
    def transition(self, target_status: RetirementStatus) -> RetirementStateMachine:
        """状态转换（内部方法）"""
        
    # 查询接口
    def get_progress(self) -> float:
        """获取完成进度百分比 (0-100)"""
        
    def get_progress_info(self) -> Dict[str, Any]:
        """获取进度详情"""
        
    def get_pending_steps(self) -> List[str]:
        """获取待审批层级"""
        
    def get_completed_steps(self) -> List[str]:
        """获取已完成层级"""
        
    def get_history(self) -> List[RetirementHistory]:
        """获取完整操作历史"""
        
    def is_all_approved(self) -> bool:
        """判断是否全部审批通过"""
        
    def is_rejected(self) -> bool:
        """判断是否被拒绝"""
```

### 6.2 工厂函数

```python
def create_retirement_state_machine(
    request_id: str,
    config: ApprovalChainConfig
) -> RetirementStateMachine:
    """
    创建资产报废状态机实例
    
    Args:
        request_id: 报废请求ID
        config: 审批链配置
        
    Returns:
        RetirementStateMachine 实例
    """
```

---

## 7. 验收测试基准 (ATB)

### 7.1 ATB-002: 状态流转测试集

#### ATB-002-01: SUBMITTED → PENDING_L1 提交触发

```python
def test_atb_002_01_submitted_to_pending_l1(self):
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

#### ATB-002-02: PENDING_L1 → PENDING_APPROVAL 流转

```python
def test_atb_002_02_submitted_to_pending_l1(self):
    """
    物理期待:
    1. L1 审批通过后，状态流转至 PENDING_APPROVAL_L1
    2. ApprovalChain.is_all_approved() 返回 False（还有 L2/L3）
    3. get_pending_steps() 返回剩余审批层级
    """
    sm = create_retirement_state_machine(request_id="REQ-001", config=multi_level_config)
    sm.submit()
    sm.approve(level="L1")
    
    assert sm.status_ == RetirementStatus.PENDING_APPROVAL_L1
    assert sm.get_pending_steps() == ["L2", "L3"]
```

#### ATB-002-03: 完整审批链通过 → APPROVED

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

#### ATB-002-04: 审批拒绝 → REJECTED

```python
def test_rejection_flow():
    """
    物理期待:
    1. 任意层级审批人调用 reject()
    2. 状态立即变为 REJECTED
    3. 后续审批节点全部作废
    4. get_history() 包含 REJECTED 记录
    """
    sm = create_retirement_state_machine(request_id="REQ-003", config=default_config)
    sm.submit()
    sm.reject(level="L1", reason="不符合报废条件")
    
    assert sm.status_ == RetirementStatus.REJECTED
    assert sm.is_rejected() == True
    assert "REJECTED" in sm.get_history()
```

#### ATB-002-05: 取消 → CANCELLED

```python
def test_cancellation():
    """
    物理期待:
    1. SUBMITTED 或 PENDING_L1 状态下可取消
    2. cancel() 后状态变为 CANCELLED
    3. cancel() 后不可调用 approve/reject
    """
    sm = create_retirement_state_machine(request_id="REQ-004", config=default_config)
    sm.submit()
    sm.cancel()
    
    assert sm.status_ == RetirementStatus.CANCELLED
    with pytest.raises(InvalidStateTransitionError):
        sm.approve(level="L1")
```

#### ATB-002-06: 处置 → DISPOSED

```python
def test_disposal_flow():
    """
    物理期待:
    1. APPROVED 状态下调用 dispose()
    2. 状态变为 DISPOSED
    3. AssetStatus 同步更新为 DISPOSED
    4. dispose() 后不可逆
    """
    sm = create_retirement_state_machine(request_id="REQ-005", config=default_config)
    sm.submit()
    sm.approve(level="L1")
    sm.dispose()
    
    assert sm.status_ == RetirementStatus.DISPOSED
    assert sm.get_progress() == 100.0
```

### 7.2 ATB-003: 进度与历史查询

```python
def test_progress_calculation():
    """
    物理期待:
    1. get_progress() 返回 0-100 浮点数
    2. SUBMITTED: 0%
    3. PENDING_L1: 25%
    4. PENDING_APPROVAL (中间): 50-75%
    5. APPROVED: 90%
    6. DISPOSED: 100%
    """
    sm = create_retirement_state_machine(request_id="REQ-006", config=quad_level_config)
    assert sm.get_progress() == 0.0
    
    sm.submit()
    assert sm.get_progress() == 25.0
    
    sm.approve(level="L1")
    assert sm.get_progress() == 50.0
```

```python
def test_history_recording():
    """
    物理期待:
    1. get_history() 返回 List[RetirementHistory]
    2. 每条记录包含: timestamp, operator, action, from_status, to_status
    3. to_dict() 序列化为可存储格式
    """
    sm = create_retirement_state_machine(request_id="REQ-007", config=default_config)
    sm.submit()
    sm.approve(level="L1")
    
    history = sm.get_history()
    assert len(history) == 2
    assert history[0].to_dict()["action"] == "SUBMIT"
    assert history[1].to_dict()["action"] == "APPROVE"
```

### 7.3 ATB-004: 边界保护

```python
def test_version_validation():
    """
    物理期待:
    1. 审批链执行前调用 validate_version(asset_version)
    2. 版本匹配: 通过
    3. 版本不匹配: 抛出 VersionConflictError
    """
    approval_chain = ApprovalChain(request_id="REQ-008")
    assert approval_chain.validate_version("v1.0") == True
    
    with pytest.raises(VersionConflictError):
        approval_chain.validate_version("v0.9")
```

---

## 8. 验收标准 (AC) 映射

| AC ID | 描述 | 验证方法 | 状态 |
|-------|------|---------|------|
| AC-001 | 资产报废状态机核心功能 | integration | pending |
| AC-002 | NODE 资产报废状态机（高级封装） | unit_test | pending |
| AC-003 | reject() | unit_test | pending |
| AC-004 | NODE create_retirement_state_machine() | unit_test | pending |
| AC-005 | is_rejected() | unit_test | pending |
| AC-006 | NODE ATB-002-02: SUBMITTED → PENDING_L1 流转 | integration | pending |
| AC-007 | NODE ATB-002-02: SUBMITTED → PENDING_L1 流转验证 | unit_test | pending |
| AC-008 | EDGE 工厂函数：创建资产报废状态机实例 | integration | pending |

---

## 9. 开发切入层级序列

### 层级 1: 枚举与模型定义

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 定义 `RetirementStatus` 枚举 | `src/models/enums.py` |
| P1 | 定义 `AssetStatus` 枚举 | `src/models/enums.py` |
| P1 | 定义 `UserRole` 枚举 | `src/models/enums.py` |
| P1 | 实现 `ApprovalChain` 模型（核心数据结构） | `src/models/approval_chain.py` |
| P1 | 实现 `RetirementHistory` 模型 | `src/models/retirement_history.py` |

### 层级 2: 审批链核心逻辑

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `get_pending_steps()` | `approval_chain.py` |
| P1 | 实现 `get_current_pending_step()` | `approval_chain.py` |
| P1 | 实现 `get_completed_steps()` | `approval_chain.py` |
| P1 | 实现 `is_all_approved()` | `approval_chain.py` |
| P1 | 实现 `is_rejected()` | `approval_chain.py` |
| P1 | 实现 `get_progress_info()` | `approval_chain.py` |
| P1 | 实现 `validate_version()` | `approval_chain.py` |
| P2 | 实现 `_level_order()` 层级排序 | `approval_chain.py` |

### 层级 3: 状态机引擎

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `RetirementStateMachine.__init__()` | `retirement_state_machine.py` |
| P1 | 实现 `submit()` 提交入口 | `retirement_state_machine.py` |
| P1 | 实现 `approve()` 审批执行 | `retirement_state_machine.py` |
| P1 | 实现 `reject()` 拒绝执行 | `retirement_state_machine.py` |
| P1 | 实现 `cancel()` 取消执行 | `retirement_state_machine.py` |
| P1 | 实现 `dispose()` 处置执行 | `retirement_state_machine.py` |
| P1 | 实现 `transition()` 核心状态跳转 | `state_machine.py` |
| P1 | 实现 `_record_action()` 历史记录 | `retirement_state_machine.py` |
| P2 | 实现 `get_progress()` 进度计算 | `retirement_state_machine.py` |
| P2 | 实现 `_get_pending_approvers()` 待审批人查询 | `retirement_state_machine.py` |
| P2 | 实现 `get_history()` 历史查询 | `retirement_state_machine.py` |
| P3 | 实现 `get_progress_info()` 对外交互 | `state_machine.py` |
| P1 | 实现工厂函数 `create_retirement_state_machine()` | `retirement_state_machine.py` |

### 层级 4: 集成与边界测试

| 优先级 | 任务 | 测试文件 |
|-------|------|---------|
| P1 | ATB-002 状态流转集成测试 | `tests/state_machine/test_retirement_sm.py` |
| P1 | ATB-003 审批链执行测试 | `tests/services/test_retirement_service.py` |
| P1 | API 层 ATB 测试 | `tests/api/test_retirement_api.py` |
| P2 | 并发审批冲突测试 | 自定义 |
| P2 | 版本冲突保护测试 | 自定义 |
| P2 | 异常状态恢复测试 | 自定义 |

---

## 10. 文件清单

### 核心源码文件

| 文件路径 | 描述 |
|---------|------|
| `src/state_machine/retirement_state_machine.py` | 资产报废状态机实现 |
| `src/models/approval_chain.py` | 审批链模型 |
| `src/models/retirement_history.py` | 历史记录模型 |
| `src/models/asset_retirement.py` | 资产报废模型 |
| `src/models/enums.py` | 枚举定义 |
| `src/services/approval_chain_service.py` | 审批链服务 |
| `src/services/retirement_service.py` | 报废服务 |
| `src/api/routers/retirement_router.py` | 报废 API 路由 |

### 测试文件

| 文件路径 | 描述 |
|---------|------|
| `tests/state_machine/test_retirement_sm.py` | 状态机单元测试 |
| `tests/services/test_retirement_service.py` | 报废服务集成测试 |
| `tests/api/test_retirement_api.py` | API 层测试 |

---

## 11. 版本历史

| 版本 | 日期 | 描述 |
|-----|------|------|
| 1.0 | 2024-XX-XX | 初始版本 |