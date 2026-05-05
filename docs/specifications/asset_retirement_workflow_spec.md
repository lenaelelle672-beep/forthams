# 资产报废/退役流程规格指导文档

## 需求与背景

### 业务场景

资产报废/退役流程是企业资产管理系统的核心业务流程，涵盖从报废申请提交、审批链流转、多级审批决策、状态机驱动到历史记录归档的完整生命周期管理。

### 核心诉求

| 诉求维度 | 描述 |
|---------|------|
| **状态流转管控** | 规范资产从提交到完结的全链路状态变迁，防止非法状态跳跃 |
| **审批链执行** | 支持多级审批（L1/L2/L3）、会签/或签模式、动态审批人路由 |
| **历史追溯** | 完整记录每一步操作的执行者、时间戳、状态快照 |
| **版本一致性** | 审批过程中防止资产信息被并发修改导致审批失效 |

### 技术约束

- 状态机引擎：`RetirementStateMachine`（位于 `src/state_machine/retirement_state_machine.py`）
- 审批链模型：`ApprovalChain`（位于 `src/models/approval_chain.py`）
- 历史记录模型：`RetirementHistory`（位于 `src/models/retirement_history.py`）

---

## 当前 Phase 对应实施目标

| Phase | 实施目标 | 对应源码模块 |
|-------|---------|-------------|
| **Phase 1: 核心状态机** | 实现状态流转引擎，支持 SUBMITTED → PENDING_L1 → APPROVED/REJECTED → DISPOSED | `retirement_state_machine.py` L249-L541 |
| **Phase 2: 审批链集成** | 整合审批链，执行多级审批验证，推进待审批节点 | `approval_chain.py` + `state_machine.py` |
| **Phase 3: 历史记录** | 记录状态变更、操作人、审批意见至 `retirement_history` 表 | `retirement_state_machine.py` L505 `_record_action()` |
| **Phase 4: 边界保护** | 版本校验、并发控制、异常状态恢复 | `approval_chain.py` L281 `validate_version()` |

---

## 边界约束

### 1. 状态枚举约束（RetirementStatus）

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

**禁止的状态跳跃规则：**

- SUBMITTED → APPROVED（禁止跳过审批）
- CANCELLED → DISPOSED（已取消资产不可处置）
- DISPOSED → 任意状态（终态不可回退）

### 2. 审批链约束（ApprovalChain）

| 约束项 | 规格 |
|-------|------|
| 审批层级 | 支持 L1/L2/L3 三级审批，层级由 `ApprovalChainConfig` 定义 |
| 审批模式 | 会签（全部通过方可通过）、或签（任一通过即可） |
| 版本锁定 | 审批执行前需调用 `validate_version()` 校验资产版本一致性 |
| 并发安全 | 使用乐观锁/悲观锁防止同一审批节点被重复审批 |

### 3. 历史记录约束（RetirementHistory）

| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | 主键，自动生成 |
| retirement_id | UUID | 关联报废请求ID，外键 |
| timestamp | datetime | 操作时间戳 |
| operator_id | UUID | 操作人ID |
| operator_name | str | 操作人姓名 |
| action | RetirementStatus | 操作类型 |
| from_status | RetirementStatus | 源状态 |
| to_status | RetirementStatus | 目标状态 |
| approval_level | Optional[str] | 审批层级（L1/L2/L3） |
| comment | Optional[str] | 审批意见/备注 |
| metadata | Optional[dict] | 扩展元数据（JSON） |

- 每一次 `transition()` 必须触发 `_record_action()` 记录历史
- 历史记录不可删除，只可追加
- 支持按 retirement_id 和 operator_id 多维度查询

### 4. 外部依赖约束

| 依赖项 | 约束说明 |
|-------|---------|
| `AssetStatus` | 资产状态枚举，与 RetirementStatus 联动 |
| `UserRole` | 审批人角色校验，只允许指定角色执行审批 |
| `Enum[str]` | 所有枚举值必须为 string 类型，存储于数据库 |

---

## 验收测试基准 (ATB)

### ATB-002: 状态流转测试集

#### ATB-002-01: SUBMITTED → PENDING_L1 提交触发

```python
# tests/state_machine/test_retirement_sm.py L254
# tests/api/test_retirement_api.py L185

def test_submitted_to_pending_l1_transition(self):
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
# tests/state_machine/test_retirement_sm.py L254
# tests/api/test_retirement_api.py L185

def test_atb_002_02_submitted_to_pending_l1(self):
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

### ATB-003: 审批链执行测试

```python
# tests/services/test_retirement_service.py L563

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

### ATB-002-04: 审批拒绝 → REJECTED

```python
# tests/state_machine/test_retirement_sm.py

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

### ATB-002-05: 取消 → CANCELLED

```python
# src/state_machine/retirement_state_machine.py L446

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

### ATB-002-06: 处置 → DISPOSED

```python
# tests/services/test_retirement_service.py L416

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

### ATB-003: 进度与历史查询

```python
# src/state_machine/retirement_state_machine.py L470

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
# src/state_machine/retirement_state_machine.py L532

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

### ATB-004: 边界保护

```python
# src/models/approval_chain.py L281

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

## 开发切入层级序列

### 层级 1: 枚举与模型定义

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 定义 `RetirementStatus` 枚举 | `src/models/enums.py` L16 |
| P1 | 定义 `AssetStatus` 枚举 | `src/models/enums.py` L57 |
| P1 | 定义 `UserRole` 枚举 | `src/models/enums.py` L46 |
| P1 | 实现 `ApprovalChain` 模型（核心数据结构） | `src/models/approval_chain.py` |
| P1 | 实现 `RetirementHistory` 模型 | `src/models/retirement_history.py` L68 |

### 层级 2: 审批链核心逻辑

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `get_pending_steps()` | `approval_chain.py` L176 |
| P1 | 实现 `get_current_pending_step()` | `approval_chain.py` L200 |
| P1 | 实现 `get_completed_steps()` | `approval_chain.py` L188 |
| P1 | 实现 `is_all_approved()` | `approval_chain.py` L230 |
| P1 | 实现 `is_rejected()` | `approval_chain.py` L242 |
| P1 | 实现 `get_progress_info()` | `approval_chain.py` L254 |
| P1 | 实现 `validate_version()` | `approval_chain.py` L281 |
| P2 | 实现 `_level_order()` 层级排序 | `approval_chain.py` L213 |

### 层级 3: 状态机引擎

| 优先级 | 任务 | 源码位置 |
|-------|------|---------|
| P1 | 实现 `RetirementStateMachine.__init__()` | `retirement_state_machine.py` L262 |
| P1 | 实现 `submit()` 提交入口 | `retirement_state_machine.py` L322 |
| P1 | 实现 `approve()` 审批执行 | `retirement_state_machine.py` L336 |
| P1 | 实现 `reject()` 拒绝执行 | `retirement_state_machine.py` L381 |
| P1 | 实现 `cancel()` 取消执行 | `retirement_state_machine.py` L446 |
| P1 | 实现 `dispose()` 处置执行 | `retirement_state_machine.py` L415 |
| P1 | 实现 `transition()` 核心状态跳转 | `state_machine.py` L416 |
| P1 | 实现 `_record_action()` 历史记录 | `retirement_state_machine.py` L505 |
| P2 | 实现 `get_progress()` 进度计算 | `retirement_state_machine.py` L470 |
| P2 | 实现 `_get_pending_approvers()` 待审批人查询 | `retirement_state_machine.py` L492 |
| P2 | 实现 `get_history()` 历史查询 | `retirement_state_machine.py` L532 |
| P3 | 实现 `get_progress_info()` 对外交互 | `state_machine.py` L470 |
| P1 | 实现工厂函数 `create_retirement_state_machine()` | `retirement_state_machine.py` L546 |

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

## 附录：关键接口签名

### 工厂函数

```python
def create_retirement_state_machine(
    request_id: str,
    config: ApprovalChainConfig
) -> RetirementStateMachine:
    """创建资产报废状态机实例"""
    pass
```

### RetirementStateMachine 核心接口

```python
class RetirementStateMachine:
    status_: RetirementStatus
    
    def submit(self) -> RetirementStateMachine:
        """提交报废申请"""
        
    def approve(self, level: str, approver_id: str = None) -> RetirementStateMachine:
        """执行指定层级审批"""
        
    def reject(self, level: str, reason: str) -> RetirementStateMachine:
        """拒绝报废申请"""
        
    def cancel(self) -> RetirementStateMachine:
        """取消报废申请"""
        
    def dispose(self) -> RetirementStateMachine:
        """执行资产处置"""
        
    def get_progress(self) -> float:
        """获取完成进度百分比 (0-100)"""
        
    def get_history(self) -> List[RetirementHistory]:
        """获取完整操作历史"""
        
    def get_pending_steps(self) -> List[str]:
        """获取待审批层级列表"""
        
    def get_completed_steps(self) -> List[str]:
        """获取已完成层级列表"""
```

### RetirementHistory 模型

```python
class RetirementHistory(BaseModel):
    """资产报废操作历史记录模型"""
    
    id: UUID                          # 主键
    retirement_id: UUID               # 报废请求ID
    timestamp: datetime               # 操作时间
    operator_id: UUID                 # 操作人ID
    operator_name: str                # 操作人姓名
    action: RetirementStatus         # 操作类型
    from_status: RetirementStatus     # 源状态
    to_status: RetirementStatus       # 目标状态
    approval_level: Optional[str]     # 审批层级
    comment: Optional[str]            # 审批意见
    metadata: Optional[dict]          # 扩展元数据
    
    def to_dict(self) -> dict:
        """序列化为可存储格式"""
        pass
```

---

## 参考文档

- 状态机源码：`src/state_machine/retirement_state_machine.py`
- 审批链模型：`src/models/approval_chain.py`
- 历史记录模型：`src/models/retirement_history.py`
- 枚举定义：`src/models/enums.py`
- 集成测试：`tests/state_machine/test_retirement_sm.py`
- API 测试：`tests/api/test_retirement_api.py`
- 服务测试：`tests/services/test_retirement_service.py`