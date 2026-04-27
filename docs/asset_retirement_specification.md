# 资产报废/退役流程规格指导文档

## 1. 概述

### 1.1 业务场景

资产报废/退役流程是企业资产管理系统的核心业务流程，涵盖从报废申请提交、审批链流转、多级审批决策、状态机驱动到历史记录归档的完整生命周期管理。

### 1.2 核心实体

| 实体 | 位置 | 职责 |
|------|------|------|
| `RetirementStateMachine` | `src/state_machine/retirement_state_machine.py` | 状态流转引擎 |
| `ApprovalChain` | `src/models/approval_chain.py` | 审批链路管理 |
| `ApprovalChainConfig` | `src/models/approval_chain.py` | 审批链配置 |
| `RetirementHistory` | `src/models/retirement_history.py` | 操作历史记录 |
| `RetirementStatus` | `src/api/deps/auth.py` | 状态枚举 |
| `ApprovalLevel` | `src/api/deps/auth.py` | 审批层级枚举 |

---

## 2. 状态机定义

### 2.1 状态枚举 (RetirementStatus)

| 状态 | 值 | 说明 |
|------|------|------|
| `SUBMITTED` | "SUBMITTED" | 已提交，待 L1 审批 |
| `PENDING_L1` | "PENDING_L1" | 一级审批待处理 |
| `PENDING_APPROVAL_*` | "PENDING_APPROVAL_*" | 多级审批待处理（中间态） |
| `APPROVED` | "APPROVED" | 审批通过 |
| `REJECTED` | "REJECTED" | 审批拒绝 |
| `CANCELLED` | "CANCELLED" | 已取消 |
| `DISPOSED` | "DISPOSED" | 已处置（终态） |

### 2.2 状态流转图

```
┌──────────────┐     submit()     ┌─────────────────────┐
│   SUBMITTED  │ ──────────────→ │      PENDING_L1     │
└──────────────┘                  └─────────┬───────────┘
                                           │ approve(L1)
┌──────────────┐     approve()   ┌─────────▼───────────┐
│  REJECTED    │ ←───────────────│  PENDING_APPROVAL_* │
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

### 2.3 状态跳跃禁止规则

| 禁止场景 | 原因 |
|----------|------|
| SUBMITTED → APPROVED | 必须经过审批链 |
| CANCELLED → DISPOSED | 已取消资产不可处置 |
| DISPOSED → 任意状态 | 终态不可回退 |

---

## 3. 审批链定义

### 3.1 审批层级 (ApprovalLevel)

| 层级 | 值 | 角色 | 说明 |
|------|------|------|------|
| L1 | "L1" | ASSET_MANAGER / ADMIN | 一级审批 - 资产经理 |
| L2 | "L2" | ASSET_MANAGER / ADMIN | 二级审批 - 部门主管 |
| L3 | "L3" | ADMIN | 三级审批 - 管理员最终审批 |

### 3.2 审批模式

| 模式 | 说明 |
|------|------|
| 会签 | 全部审批人通过方可通过 |
| 或签 | 任一审批人通过即可 |

### 3.3 审批约束

| 约束项 | 规格 |
|--------|------|
| 版本校验 | 审批执行前需调用 `validate_version()` 校验资产版本一致性 |
| 并发安全 | 使用乐观锁/悲观锁防止同一审批节点被重复审批 |
| 权限验证 | 只允许指定角色执行审批 |

---

## 4. 核心接口

### 4.1 工厂函数

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
        RetirementStateMachine: 状态机实例
    """
    pass
```

### 4.2 RetirementStateMachine 接口

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `submit()` | - | `RetirementStateMachine` | 提交报废申请 |
| `approve()` | `level: str`, `approver_id: str = None` | `RetirementStateMachine` | 执行指定层级审批 |
| `reject()` | `level: str`, `reason: str` | `RetirementStateMachine` | 拒绝报废申请 |
| `cancel()` | - | `RetirementStateMachine` | 取消报废申请 |
| `dispose()` | - | `RetirementStateMachine` | 执行资产处置 |
| `get_progress()` | - | `float` | 获取完成进度 (0-100) |
| `get_history()` | - | `List[RetirementHistory]` | 获取完整操作历史 |
| `get_pending_steps()` | - | `List[str]` | 获取待审批层级列表 |
| `get_completed_steps()` | - | `List[str]` | 获取已完成层级列表 |
| `get_current_pending_step()` | - | `str` | 获取当前待审批层级 |

### 4.3 ApprovalChain 接口

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `is_all_approved()` | - | `bool` | 是否全部审批通过 |
| `is_rejected()` | - | `bool` | 是否被拒绝 |
| `get_progress_info()` | - | `dict` | 获取进度详情 |
| `validate_version()` | `version: str` | `bool` | 验证版本一致性 |

---

## 5. 历史记录

### 5.1 RetirementHistory 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `timestamp` | `datetime` | 操作时间 |
| `operator` | `str` | 操作人 |
| `action` | `str` | 操作类型 (SUBMIT/APPROVE/REJECT/CANCEL/DISPOSE) |
| `from_status` | `RetirementStatus` | 源状态 |
| `to_status` | `RetirementStatus` | 目标状态 |
| `reason` | `str` | 审批意见 |
| `metadata` | `dict` | 附加元数据 |

### 5.2 记录约束

- 每一次 `transition()` 必须触发 `_record_action()` 记录历史
- 历史记录不可删除，只可追加

---

## 6. 验收测试基准 (ATB)

### 6.1 ATB-002: 状态流转测试

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
def test_atb_002_02_pending_l1_to_pending_approval(self):
    """
    物理期待:
    1. L1 审批通过后，状态流转至 PENDING_APPROVAL_*
    2. ApprovalChain.is_all_approved() 返回 False（还有 L2/L3）
    3. get_pending_steps() 返回剩余审批层级
    """
    sm = create_retirement_state_machine(request_id="REQ-001", config=multi_level_config)
    sm.submit()
    sm.approve(level="L1")
    
    assert sm.status_ == RetirementStatus.PENDING_APPROVAL_
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

### 6.3 ATB-004: 边界保护测试

```python
def test_atb_004_rejection_flow():
    """
    物理期待:
    1. 任意层级审批人调用 reject()
    2. 状态立即变为 REJECTED
    3. 后续审批节点全部作废
    """
    sm = create_retirement_state_machine(request_id="REQ-003", config=default_config)
    sm.submit()
    sm.reject(level="L1", reason="不符合报废条件")
    
    assert sm.status_ == RetirementStatus.REJECTED
    assert sm.is_rejected() == True

def test_atb_004_cancellation():
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

def test_atb_004_disposal_flow():
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

### 6.4 ATB-005: 进度与历史查询

```python
def test_atb_005_progress_calculation():
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

def test_atb_005_history_recording():
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

### 6.5 ATB-006: 版本校验

```python
def test_atb_006_version_validation():
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

## 7. 开发切入层级

### 7.1 层级 1: 枚举与模型定义

| 优先级 | 任务 | 源码位置 |
|--------|------|----------|
| P1 | 定义 `RetirementStatus` 枚举 | `src/api/deps/auth.py` L53 |
| P1 | 定义 `ApprovalLevel` 枚举 | `src/api/deps/auth.py` L43 |
| P1 | 定义 `AssetStatus` 枚举 | `src/api/deps/auth.py` L33 |
| P1 | 定义 `UserRole` 枚举 | `src/api/deps/auth.py` L22 |
| P1 | 实现 `ApprovalChain` 模型 | `src/models/approval_chain.py` |
| P1 | 实现 `RetirementHistory` 模型 | `src/models/retirement_history.py` |

### 7.2 层级 2: 审批链核心逻辑

| 优先级 | 任务 | 源码位置 |
|--------|------|----------|
| P1 | 实现 `get_pending_steps()` | `approval_chain.py` L176 |
| P1 | 实现 `get_current_pending_step()` | `approval_chain.py` L200 |
| P1 | 实现 `get_completed_steps()` | `approval_chain.py` L188 |
| P1 | 实现 `is_all_approved()` | `approval_chain.py` L230 |
| P1 | 实现 `is_rejected()` | `approval_chain.py` L242 |
| P1 | 实现 `get_progress_info()` | `approval_chain.py` L254 |
| P1 | 实现 `validate_version()` | `approval_chain.py` L281 |
| P2 | 实现 `_level_order()` 层级排序 | `approval_chain.py` L213 |

### 7.3 层级 3: 状态机引擎

| 优先级 | 任务 | 源码位置 |
|--------|------|----------|
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

### 7.4 层级 4: 集成与边界测试

| 优先级 | 任务 | 测试文件 |
|--------|------|----------|
| P1 | ATB-002 状态流转集成测试 | `tests/state_machine/test_retirement_sm.py` |
| P1 | ATB-003 审批链执行测试 | `tests/services/test_retirement_service.py` |
| P1 | API 层 ATB 测试 | `tests/api/test_retirement_api.py` |
| P2 | 并发审批冲突测试 | 自定义 |
| P2 | 版本冲突保护测试 | 自定义 |
| P2 | 异常状态恢复测试 | 自定义 |

---

## 8. 进度计算规格

| 状态 | 进度值 | 计算方式 |
|------|--------|----------|
| SUBMITTED | 0% | 初始状态 |
| PENDING_L1 | 25% | 1/4 审批完成 |
| PENDING_APPROVAL (L2) | 50% | 2/4 审批完成 |
| PENDING_APPROVAL (L3) | 75% | 3/4 审批完成 |
| APPROVED | 90% | 审批完成，待处置 |
| DISPOSED | 100% | 完全结束 |

---

## 9. 异常处理

| 异常类型 | 说明 | 处理方式 |
|----------|------|----------|
| `InvalidStateTransitionError` | 非法状态跳跃 | 抛出异常，阻止操作 |
| `VersionConflictError` | 版本冲突 | 抛出异常，要求重试 |
| `UnauthorizedApprovalError` | 越权审批 | 抛出异常，记录审计日志 |
| `ApprovalChainIncompleteError` | 审批链不完整 | 抛出异常，阻止流程 |

---

## 10. 外部依赖

| 依赖项 | 约束说明 |
|--------|----------|
| `AssetStatus` | 资产状态枚举，与 RetirementStatus 联动 |
| `UserRole` | 审批人角色校验，只允许指定角色执行审批 |
| `Enum[str]` | 所有枚举值必须为 string 类型，存储于数据库 |

---

## 11. 审批权限验证规则

| 审批层级 | 允许角色 |
|----------|----------|
| L1 | ASSET_MANAGER, ADMIN |
| L2 | ASSET_MANAGER, ADMIN |
| L3 | ADMIN |

---

*文档版本: 1.0*
*最后更新: 2025-01*