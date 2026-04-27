# 资产报废/退役流程规格指导文档

> **版本**: v1.0  
> **创建日期**: 2024  
> **状态**: 已审核 ✅

---

## 1. 业务场景与核心诉求

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

- **状态机引擎**: `RetirementStateMachine`（位于 `src/state_machine/retirement_state_machine.py`）
- **审批链模型**: `ApprovalChain`（位于 `src/models/approval_chain.py`）
- **历史记录模型**: `RetirementHistory`（位于 `src/models/retirement_history.py`）

---

## 2. 实体关系图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          资产报废/退役流程 ER 图                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │  AssetRetirement │────────▶│  RetirementStatus │◀── 枚举          │
│  │    (报废请求)     │         │   (报废状态)       │                    │
│  └────────┬─────────┘         └──────────────────┘                     │
│           │                                                          │
│           │ owns                                                    │
│           ▼                                                          │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │ ApprovalChain    │────────▶│ ApprovalChainConfig│                  │
│  │   (审批链)        │         │   (审批链配置)    │                    │
│  └────────┬─────────┘         └──────────────────┘                     │
│           │                                                          │
│           │ records                                                  │
│           ▼                                                          │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │ RetirementHistory│         │    UserRole      │◀── 枚举           │
│  │   (历史记录)      │         │   (用户角色)      │                    │
│  └──────────────────┘         └──────────────────┘                     │
│                                                                         │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │   AssetStatus    │◀────────│  RetirementStateMachine│                │
│  │   (资产状态)      │         │   (状态机引擎)    │                    │
│  └──────────────────┘         └──────────────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 枚举定义

### 3.1 RetirementStatus（报废状态枚举）

| 枚举值 | 说明 | 可流转至 |
|-------|------|---------|
| `SUBMITTED` | 已提交，等待初审 | `PENDING_L1` |
| `PENDING_L1` | 待一级审批 | `PENDING_APPROVAL`, `REJECTED`, `CANCELLED` |
| `PENDING_APPROVAL` | 待多级审批 | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | 已审批通过 | `DISPOSED` |
| `REJECTED` | 已拒绝（终态） | - |
| `CANCELLED` | 已取消（终态） | - |
| `DISPOSED` | 已处置（终态） | - |

### 3.2 AssetStatus（资产状态枚举）

| 枚举值 | 说明 |
|-------|------|
| `ACTIVE` | 使用中 |
| `MAINTENANCE` | 维护中 |
| `RETIRED` | 已退役 - 不可逆向操作 |

### 3.3 UserRole（用户角色枚举）

| 枚举值 | 说明 | 权限说明 |
|-------|------|---------|
| `ADMIN` | 系统管理员 | 可执行各级审批 |
| `ASSET_MANAGER` | 资产管理员 | 可执行各级审批 |
| `REQUESTER` | 普通请求者 | 可发起报废请求 |

### 3.4 ApprovalLevel（审批层级枚举）

| 枚举值 | 说明 | 审批人 |
|-------|------|-------|
| `L1` | 一级审批 | 资产经理 |
| `L2` | 二级审批 | 部门主管 |
| `L3` | 三级审批 | 管理员最终审批 |

---

## 4. 状态机流转图

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

### 4.1 禁止的状态跳跃规则

| 源状态 | 禁止目标 | 原因 |
|-------|---------|------|
| `SUBMITTED` | `APPROVED` | 禁止跳过审批 |
| `SUBMITTED` | `DISPOSED` | 禁止跳过审批 |
| `CANCELLED` | `DISPOSED` | 已取消资产不可处置 |
| `DISPOSED` | 任意状态 | 终态不可回退 |
| `REJECTED` | 任意状态 | 终态不可回退 |

---

## 5. 审批链配置

### 5.1 ApprovalChainConfig（审批链配置模型）

```python
class ApprovalChainConfig(BaseModel):
    levels: List[str]                    # 审批层级列表，如 ["L1", "L2", "L3"]
    mode: str                             # 审批模式: "all" (会签) / "any" (或签)
    timeout_hours: int = 72              # 审批超时时间（小时）
```

### 5.2 审批模式说明

| 模式 | 枚举值 | 说明 | 何时通过 |
|-----|-------|------|---------|
| 会签 | `all` | 全部审批人通过方可通过 | 所有层级审批均通过 |
| 或签 | `any` | 任一审批人通过即可 | 任意层级审批通过即可 |

---

## 6. 核心接口规格

### 6.1 RetirementStateMachine（状态机引擎）

| 方法 | 入参 | 返回值 | 说明 |
|-----|------|-------|------|
| `submit()` | - | `RetirementStateMachine` | 提交报废申请 |
| `approve()` | `level: str`, `approver_id: str = None` | `RetirementStateMachine` | 执行指定层级审批 |
| `reject()` | `level: str`, `reason: str` | `RetirementStateMachine` | 拒绝报废申请 |
| `cancel()` | - | `RetirementStateMachine` | 取消报废申请 |
| `dispose()` | - | `RetirementStateMachine` | 执行资产处置 |
| `transition()` | `from_status: str`, `to_status: str` | `RetirementStateMachine` | 执行状态跳转 |
| `get_progress()` | - | `float` | 获取完成进度百分比 (0-100) |
| `get_progress_info()` | - | `ProgressInfo` | 获取进度详情 |
| `get_pending_steps()` | - | `List[str]` | 获取待审批层级列表 |
| `get_current_pending_step()` | - | `Optional[str]` | 获取当前待审批层级 |
| `get_completed_steps()` | - | `List[str]` | 获取已完成层级列表 |
| `get_history()` | - | `List[RetirementHistory]` | 获取完整操作历史 |
| `is_all_approved()` | - | `bool` | 是否全部审批通过 |
| `is_rejected()` | - | `bool` | 是否被拒绝 |
| `validate_version()` | `version: str` | `bool` | 验证资产版本一致性 |

### 6.2 ApprovalChain（审批链模型）

| 方法 | 入参 | 返回值 | 说明 |
|-----|------|-------|------|
| `get_pending_steps()` | - | `List[str]` | 获取待审批层级 |
| `get_current_pending_step()` | - | `Optional[str]` | 获取当前待审批层级 |
| `get_completed_steps()` | - | `List[str]` | 获取已完成层级 |
| `is_all_approved()` | - | `bool` | 是否全部审批通过 |
| `is_rejected()` | - | `bool` | 是否被拒绝 |
| `get_progress_info()` | - | `ProgressInfo` | 获取进度详情 |
| `validate_version()` | `version: str` | `bool` | 验证版本一致性 |

### 6.3 RetirementHistory（历史记录模型）

| 字段 | 类型 | 说明 |
|-----|------|------|
| `id` | `str` | 历史记录ID |
| `retirement_id` | `str` | 报废请求ID |
| `action` | `str` | 操作类型: SUBMIT, APPROVE, REJECT, CANCEL, DISPOSE |
| `operator_id` | `str` | 操作人ID |
| `operator_name` | `str` | 操作人姓名 |
| `from_status` | `Optional[str]` | 源状态 |
| `to_status` | `str` | 目标状态 |
| `comment` | `Optional[str]` | 审批意见/原因 |
| `timestamp` | `datetime` | 操作时间 |

---

## 7. 工厂函数

### 7.1 create_retirement_state_machine()

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
        
    Raises:
        ValueError: 当 request_id 为空或 config 无效时抛出
    """
    pass
```

---

## 8. 验收测试基准 (ATB)

### 8.1 ATB-002: 状态流转测试集

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
    # 实现...
```

#### ATB-002-02: PENDING_L1 → PENDING_APPROVAL 流转

```python
def test_atb_002_02_submitted_to_pending_l1(self):
    """
    物理期待:
    1. L1 审批通过后，状态流转至 PENDING_APPROVAL
    2. ApprovalChain.is_all_approved() 返回 False（还有 L2/L3）
    3. get_pending_steps() 返回剩余审批层级
    """
    # 实现...
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
    # 实现...
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
    # 实现...
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
    # 实现...
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
    # 实现...
```

### 8.2 ATB-003: 审批链执行测试

```python
def test_atb_003_approval_chain_execution():
    """
    物理期待:
    1. 按序执行 L1 → L2 → L3 审批
    2. 每级审批后调用 is_all_approved() 验证
    3. L3 审批完成后状态变为 APPROVED
    4. get_completed_steps() 长度 = 3
    """
    # 实现...
```

### 8.3 ATB-004: 进度与历史查询

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
    # 实现...

def test_history_recording():
    """
    物理期待:
    1. get_history() 返回 List[RetirementHistory]
    2. 每条记录包含: timestamp, operator, action, from_status, to_status
    3. to_dict() 序列化为可存储格式
    """
    # 实现...
```

### 8.4 ATB-005: 边界保护

```python
def test_version_validation():
    """
    物理期待:
    1. 审批链执行前调用 validate_version(asset_version)
    2. 版本匹配: 通过
    3. 版本不匹配: 抛出 VersionConflictError
    """
    # 实现...
```

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

## 10. 错误处理

### 10.1 自定义异常

| 异常类 | 说明 | 触发场景 |
|-------|------|---------|
| `InvalidStateTransitionError` | 非法状态转换 | 尝试执行禁止的状态跳转 |
| `VersionConflictError` | 版本冲突 | 审批时资产版本已变更 |
| `UnauthorizedApprovalError` | 未授权审批 | 用户无权执行该层级审批 |
| `ApprovalTimeoutError` | 审批超时 | 审批超过设定时间未完成 |

### 10.2 错误响应格式

```json
{
    "code": "RETIREMENT_001",
    "message": "非法状态转换: 当前状态 SUBMITTED 不能直接转为 DISPOSED",
    "data": null
}
```

---

## 11. 附录：关键接口签名

### 11.1 工厂函数

```python
def create_retirement_state_machine(
    request_id: str,
    config: ApprovalChainConfig
) -> RetirementStateMachine:
    """创建资产报废状态机实例"""
    pass
```

### 11.2 RetirementStateMachine 核心接口

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

---

**文档结束**