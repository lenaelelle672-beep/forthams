# SWARM-502 资产报废/退役流程 规格指导文档

> **版本**: v1.0  
> **创建日期**: 2024  
> **状态**: 草稿

---

## 1. 需求与背景

### 1.1 业务背景

资产管理系统需要覆盖资产全生命周期管理。当前系统缺少标准化的资产报废/退役流程，存在以下问题：

| 问题点 | 描述 | 影响 |
|--------|------|------|
| 状态不透明 | 资产报废缺乏统一状态管理 | 资产状态无法追踪 |
| 审批流程缺失 | 报废申请未经审批即可执行 | 管控风险高 |
| 历史记录不完整 | 无完整的操作审计追踪 | 合规审查困难 |

### 1.2 核心需求概述

```
┌─────────────────────────────────────────────────────────────────┐
│                        资产报废流程核心需求                         │
├─────────────────────────────────────────────────────────────────┤
│  1. 状态流转   │ 申请 → 审批中 → 已审批/已驳回 → 已退役            │
│  2. 审批链     │ 支持多级审批配置，按资产价值/类型路由                │
│  3. 历史记录   │ 完整记录状态变更、审批意见、操作人员、时间戳          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆分（参照 plan.md）

| Phase | 范围 | 实施状态 | 目标交付 |
|-------|------|----------|----------|
| **Phase 1** | 基础数据模型 + 状态机核心逻辑 | **本次实施** | 报废单 CRUD + 状态流转框架 |
| Phase 2 | 审批链引擎 + 通知机制 | 下期迭代 | 多级审批路由 + 消息推送 |
| Phase 3 | 历史记录查询 + 导出功能 | 下期迭代 | 审计日志 + 报表导出 |

### 2.2 Phase 1 实施范围（本次 Spec 聚焦）

#### 交付物清单

| # | 交付物 | 文件路径 | 优先级 |
|---|--------|----------|--------|
| 1 | 状态机核心逻辑 | `src/state_machine/retirement_state_machine.py` | P0 |
| 2 | 状态转换守卫 | `src/state_machine/guards.py` | P0 |
| 3 | 状态枚举定义 | `src/state_machine/states.py` | P0 |
| 4 | 报废申请数据模型 | `src/models/asset_retirement.py` | P0 |
| 5 | 报废单仓储层 | `src/repositories/retirement_repository.py` | P0 |
| 6 | 报废单服务层 | `src/services/retirement_service.py` | P0 |
| 7 | 状态机单元测试 | `tests/state_machine/test_retirement_sm.py` | P0 |

#### 非本次范围（Phase 2/3）

```
✗ 审批链配置管理
✗ 消息通知推送  
✗ 历史记录查询 UI
✗ 导出报表功能
✗ E2E 测试（tests/e2e/retirement_flow.spec.ts）
```

---

## 3. 边界约束

### 3.1 技术约束

| 约束项 | 规格说明 |
|--------|----------|
| **数据库** | PostgreSQL 12+ |
| **ORM** | SQLAlchemy 2.0+ |
| **API 风格** | RESTful，JSON 请求/响应 |
| **事务边界** | 单次状态变更必须在同一事务内完成 |
| **并发控制** | 乐观锁（version 字段）防止重复提交 |
| **Python 版本** | Python 3.10+ |

### 3.2 业务约束

| 约束项 | 规格说明 |
|--------|----------|
| **报废前置条件** | 仅 `在用(in_use)` 或 `闲置(idle)` 状态的资产可发起报废 |
| **不可逆性** | `已退役(retired)` 状态不可回退 |
| **操作权限** | 仅有 `ASSET_RETIRE_WRITE` 权限的用户可操作 |
| **状态锁定** | `pending_retirement` 状态的资产禁止其他状态变更 |

### 3.3 状态机约束

```
┌─────────────────────────────────────────────────────────────┐
│                    状态流转合法性约束                          │
├─────────────────────────────────────────────────────────────┤
│  ✓ pending        → under_review, rejected                  │
│  ✓ under_review    → approved, rejected                      │
│  ✓ approved        → completed                              │
│  ✗ rejected        → (终止状态，禁止任何转换)                  │
│  ✗ completed       → (终止状态，禁止任何转换)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 验收测试基准 (ATB)

### 4.1 测试文件

**主测试文件**: `tests/state_machine/test_retirement_sm.py`

### 4.2 ATB 测试用例

#### ATB-001: 状态机初始化

**描述**: 验证状态机可正确初始化，初始状态为 `pending`

```python
# tests/state_machine/test_retirement_sm.py

def test_sm_initial_state():
    """
    ATB-001: 状态机初始化
    验收标准:
    - 状态机实例化成功
    - 初始状态为 RetirementStatus.PENDING
    - 当前状态可正确获取
    """
    sm = RetirementStateMachine()
    assert sm.current_state == RetirementStatus.PENDING
```

#### ATB-002: 合法状态转换 - 提交审批

**描述**: `pending` → `under_review` 转换应成功

```python
def test_valid_transition_pending_to_under_review():
    """
    ATB-002: 合法状态转换 - 提交审批
    验收标准:
    - [ ] 转换返回 True
    - [ ] 当前状态更新为 UNDER_REVIEW
    - [ ] 转换事件已记录
    """
    sm = RetirementStateMachine()
    result = sm.submit_for_review(user_id="user_001")
    assert result is True
    assert sm.current_state == RetirementStatus.UNDER_REVIEW
```

#### ATB-003: 合法状态转换 - 审批通过

**描述**: `under_review` → `approved` 转换应成功

```python
def test_valid_transition_under_review_to_approved():
    """
    ATB-003: 合法状态转换 - 审批通过
    验收标准:
    - [ ] 转换返回 True
    - [ ] 当前状态更新为 APPROVED
    - [ ] 审批意见已记录
    """
    sm = RetirementStateMachine()
    sm.submit_for_review()
    result = sm.approve(approver_id="approver_001", comment="同意报废")
    assert result is True
    assert sm.current_state == RetirementStatus.APPROVED
```

#### ATB-004: 合法状态转换 - 审批驳回

**描述**: `under_review` → `rejected` 转换应成功

```python
def test_valid_transition_under_review_to_rejected():
    """
    ATB-004: 合法状态转换 - 审批驳回
    验收标准:
    - [ ] 转换返回 True
    - [ ] 当前状态更新为 REJECTED
    - [ ] 驳回原因已记录
    """
    sm = RetirementStateMachine()
    sm.submit_for_review()
    result = sm.reject(approver_id="approver_001", reason="资产仍在使用")
    assert result is True
    assert sm.current_state == RetirementStatus.REJECTED
```

#### ATB-005: 合法状态转换 - 完成退役

**描述**: `approved` → `completed` 转换应成功，资产状态变更为 `retired`

```python
def test_valid_transition_approved_to_completed():
    """
    ATB-005: 合法状态转换 - 完成退役
    验收标准:
    - [ ] 转换返回 True
    - [ ] 当前状态更新为 COMPLETED
    - [ ] 关联资产状态变更为 RETIRED
    """
    sm = RetirementStateMachine()
    sm.submit_for_review()
    sm.approve()
    result = sm.complete(asset_id="asset_001")
    assert result is True
    assert sm.current_state == RetirementStatus.COMPLETED
```

#### ATB-006: 非法状态转换 - 从终止状态转换

**描述**: 从 `rejected` 状态不允许任何转换

```python
def test_invalid_transition_from_rejected():
    """
    ATB-006: 非法状态转换 - 从终止状态转换
    验收标准:
    - [ ] 抛出 StateTransitionException
    - [ ] 当前状态保持 REJECTED
    - [ ] 错误码为 INVALID_TRANSITION
    """
    sm = RetirementStateMachine()
    sm.submit_for_review()
    sm.reject()
    
    with pytest.raises(StateTransitionException) as exc_info:
        sm.approve()
    
    assert exc_info.value.code == "INVALID_TRANSITION"
    assert sm.current_state == RetirementStatus.REJECTED
```

#### ATB-007: 非法状态转换 - 跳过审批

**描述**: 不允许从 `pending` 直接跳转到 `approved`

```python
def test_invalid_transition_skip_approval():
    """
    ATB-007: 非法状态转换 - 跳过审批
    验收标准:
    - [ ] 抛出 StateTransitionException
    - [ ] 当前状态保持 PENDING
    """
    sm = RetirementStateMachine()
    
    with pytest.raises(StateTransitionException):
        sm.approve()  # 跳过 submit_for_review
    
    assert sm.current_state == RetirementStatus.PENDING
```

#### ATB-008: 守卫条件 - 资产状态校验

**描述**: 仅有 `in_use` 或 `idle` 状态的资产可发起报废

```python
def test_guard_asset_status_check():
    """
    ATB-008: 守卫条件 - 资产状态校验
    验收标准:
    - [ ] 状态为 in_use 的资产允许发起
    - [ ] 状态为 idle 的资产允许发起
    - [ ] 状态为 retired 的资产拒绝发起
    """
    # in_use - 应允许
    assert check_asset_status_guard("in_use") is True
    
    # idle - 应允许
    assert check_asset_status_guard("idle") is True
    
    # retired - 应拒绝
    assert check_asset_status_guard("retired") is False
```

#### ATB-009: 并发控制 - 乐观锁

**描述**: 同一报废单被并发修改时，第二个请求应失败

```python
def test_optimistic_locking():
    """
    ATB-009: 并发控制 - 乐观锁
    验收标准:
    - [ ] 第一个请求成功
    - [ ] 第二个请求返回 409 Conflict
    - [ ] version 字段正确递增
    """
    sm = RetirementStateMachine()
    sm.submit_for_review()
    
    # 模拟两个并发审批请求
    result1 = sm.approve(approver_id="user_001", version=1)
    result2 = sm.approve(approver_id="user_002", version=1)
    
    assert result1 is True
    assert result2 is False  # 版本冲突
```

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────┐
│                    API Layer (L4)                    │
│              src/api/routers/retirement_router.py    │
├─────────────────────────────────────────────────────┤
│                   Service Layer (L3)                 │
│                src/services/retirement_service.py   │
├─────────────────────────────────────────────────────┤
│                 Repository Layer (L2)                │
│           src/repositories/retirement_repository.py  │
├─────────────────────────────────────────────────────┤
│                   Model Layer (L1)                   │
│              src/models/asset_retirement.py          │
│             src/state_machine/states.py              │
├─────────────────────────────────────────────────────┤
│               State Machine Layer (L0)               │
│      src/state_machine/retirement_state_machine.py   │
│              src/state_machine/guards.py             │
└─────────────────────────────────────────────────────┘
```

### 5.2 层级详细定义

#### L0: 状态机核心层

**文件**: `src/state_machine/retirement_state_machine.py`

| 类/函数 | 职责 | 公共 API |
|---------|------|----------|
| `RetirementStateMachine` | 状态机主类 | `submit_for_review()`, `approve()`, `reject()`, `complete()` |
| `StateTransitionException` | 状态转换异常 | 携带错误码与消息 |

**文件**: `src/state_machine/states.py`

| 枚举 | 值 |
|------|-----|
| `RetirementStatus` | `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `COMPLETED` |

**文件**: `src/state_machine/guards.py`

| 函数 | 职责 |
|------|------|
| `check_asset_status_guard(asset_status)` | 校验资产状态是否允许发起报废 |
| `check_permission_guard(user, action)` | 校验用户权限 |

**依赖**: 无

---

#### L1: 数据模型层

**文件**: `src/models/asset_retirement.py`

| 类 | 职责 | 字段 |
|----|------|------|
| `AssetRetirement` | 报废申请 ORM 模型 | `id`, `asset_id`, `status`, `reason`, `expected_date`, `version`, `created_by`, `created_at`, `updated_at` |
| `RetirementHistory` | 状态变更历史 | `id`, `retirement_id`, `from_status`, `to_status`, `operator_id`, `comment`, `created_at` |

**依赖**: L0

---

#### L2: 仓储层

**文件**: `src/repositories/retirement_repository.py`

| 方法 | 职责 | 原子性 |
|------|------|--------|
| `create(data)` | 创建报废申请 | 单事务 |
| `get_by_id(id)` | 按 ID 查询 | 只读 |
| `update_status(id, new_status, version)` | 更新状态（乐观锁） | 单事务 |
| `list_by_asset_id(asset_id)` | 查询资产报废历史 | 只读 |
| `add_history_record(retirement_id, history_data)` | 添加状态变更记录 | 单事务 |

**依赖**: L1

---

#### L3: 服务层

**文件**: `src/services/retirement_service.py`

| 方法 | 职责 | 业务规则 |
|------|------|----------|
| `create_retirement(asset_id, reason, user_id)` | 创建报废申请 | 校验资产状态、权限 |
| `submit_for_review(retirement_id, user_id)` | 提交审批 | 校验状态、触发事件 |
| `approve_retirement(retirement_id, approver_id, comment)` | 审批通过 | 校验审批权限、乐观锁 |
| `reject_retirement(retirement_id, approver_id, reason)` | 审批驳回 | 校验审批权限 |
| `complete_retirement(retirement_id)` | 完成退役 | 更新资产状态为 retired |

**依赖**: L2, L0

---

#### L4: API 层

**文件**: `src/api/routers/retirement_router.py`

| 端点 | 方法 | 描述 |
|------|------|------|
| `POST /api/v1/retirement` | 创建报废申请 | 调用 `create_retirement` |
| `GET /api/v1/retirement/{id}` | 查询报废单详情 | 调用 `get_by_id` |
| `PATCH /api/v1/retirement/{id}/submit` | 提交审批 | 调用 `submit_for_review` |
| `PATCH /api/v1/retirement/{id}/approve` | 审批通过 | 调用 `approve_retirement` |
| `PATCH /api/v1/retirement/{id}/reject` | 审批驳回 | 调用 `reject_retirement` |
| `GET /api/v1/assets/{asset_id}/retirement-history` | 资产报废历史 | 调用 `list_by_asset_id` |

**依赖**: L3

---

### 5.3 开发顺序与时间估算

| 顺序 | 层级 | 交付物 | 估算工时 |
|------|------|--------|----------|
| 1 | L0 | 状态机核心 + 守卫 | 0.5 天 |
| 2 | L1 | 数据模型 | 0.25 天 |
| 3 | L2 | 仓储层 | 0.5 天 |
| 4 | L3 | 服务层 | 0.75 天 |
| 5 | L4 | API 端点 | 0.5 天 |
| 6 | - | 单元测试 | 1 天 |

**总工期**: ~3.5 人/天

---

## 6. 附录

### 6.1 状态机状态图

```
                              ┌──────────────────┐
                              │                  │
                              │    (start)       │
                              │                  │
                              └────────┬─────────┘
                                       │ init
                                       ▼
                              ┌──────────────────┐
                    ┌────────▶│     PENDING      │◀────────┐
                    │         │  (申请中)        │         │
                    │         └────────┬─────────┘         │
                    │                  │ submit            │
                    │                  ▼                   │
                    │         ┌──────────────────┐         │
                    │         │   UNDER_REVIEW   │         │
                    │         │   (审批中)        │         │
                    │         └────────┬─────────┘         │
                    │                  │                   │
           reject   │         ┌───────┴───────┐            │ approve
                    │         ▼               ▼            │
                    │  ┌────────────┐  ┌────────────┐      │
                    │  │  REJECTED  │  │  APPROVED  │      │
                    │  │  (已驳回)   │  │  (已批准)   │      │
                    │  └────────────┘  └──────┬─────┘      │
                    │                         │ complete   │
                    │                         ▼            │
                    │                  ┌────────────┐       │
                    │                  │  COMPLETED │───────┘
                    │                  │  (已退役)  │   (不可逆)
                    └──────────────────└────────────┘
```

### 6.2 错误码定义

| 错误码 | 含义 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_ASSET_STATUS` | 资产状态不允许报废 | 422 |
| `INVALID_TRANSITION` | 状态转换非法 | 400 |
| `VERSION_CONFLICT` | 并发版本冲突 | 409 |
| `PERMISSION_DENIED` | 权限不足 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |

### 6.3 事件列表（Phase 2 扩展）

| 事件名 | 触发时机 | Phase |
|--------|----------|-------|
| `retirement.submitted` | 提交审批时 | 2 |
| `retirement.approved` | 审批通过时 | 2 |
| `retirement.rejected` | 审批驳回时 | 2 |
| `retirement.completed` | 退役完成时 | 2 |

---

## 7. 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2024 | - | 初始版本 |