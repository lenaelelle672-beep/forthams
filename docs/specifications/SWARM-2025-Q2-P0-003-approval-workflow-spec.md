# SWARM-2025-Q2-P0-003 工单审批流程规格指导文档

> **版本**: v3.0  
> **迭代**: Iteration 3  
> **状态**: DRAFT for Review  
> **聚焦文件**: `tests/unit/test_approval_service.py`

---

## 1. 需求与背景

### 1.1 业务需求
实现工单审批流程的线上化，支持审批用户在 Web 前端完成一键审批/驳回操作，后端系统自动推进工单状态机生命周期并触发相应通知。

### 1.2 当前痛点
- 审批操作依赖线下或手工操作，效率低下
- 状态变更与通知发送存在时序不一致
- 审批历史记录不完整，难以追溯

### 1.3 预期收益
- 审批操作耗时从平均 5 分钟降至 30 秒内
- 状态变更与通知送达一致性达 99.5% 以上
- 完整审计日志支持

---

## 2. 当前 Phase 对应实施目标

### Phase 3: 前端审批界面 + 状态机联动 + 通知触发

| 目标项 | 描述 |
|--------|------|
| 前端审批页 | 审批人查看待办工单列表，支持批量/单条审批操作 |
| 后端状态机 | 接收审批指令，按定义规则推进工单状态 |
| 通知服务 | 状态变更后触发邮件/站内信通知 |
| 审计日志 | 记录审批人、时间、动作、结果 |

### 与前后 Phase 关系
```
Phase 2 (已交付)     Phase 3 (当前)       Phase 4 (后续)
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  工单数据模型 │ --> │ 审批流程实现 │ --> │ 权限细化/   │
│  基础 CRUD   │     │ 状态机联动   │     │ 审批链配置  │
│  基础 API    │     │ 通知触发     │     │ 加签/转签   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 具体约束 |
|----------|----------|
| 审批角色 | 仅拥有 `APPROVER` 角色的用户可执行审批操作 |
| 工单状态 | 仅 `PENDING_APPROVAL` 状态可接受审批指令 |
| 操作原子性 | 审批提交后，状态变更与通知触发必须原子完成 |
| 并发控制 | 同一工单同一时间仅允许一个审批操作，防止竞态 |
| 超时处理 | 审批操作超时阈值设定为 10 秒，超时返回 504 |
| 批量限制 | 单次批量审批上限 50 条，超出返回 400 |
| 通知重试 | 通知发送失败时最多重试 3 次，间隔 30s/60s/120s |

### 3.2 非功能约束

| 约束类型 | 具体约束 |
|----------|----------|
| 响应时间 | 审批接口 P99 ≤ 500ms |
| 可用性 | 审批服务 SLA ≥ 99.9% |
| 数据一致性 | 工单状态与审计日志强一致 |
| 日志留存 | 审批日志保留 730 天 |

---

## 4. 验收测试基准 (ATB)

> **聚焦文件**: `tests/unit/test_approval_service.py`

### ATB-1: 单条审批通过

| 测试编号 | ATB-1 |
|----------|-------|
| 场景 | 审批人提交单条工单"通过" |
| 前置条件 | 工单状态为 `PENDING_APPROVAL`，当前用户为审批人 |
| 测试步骤 | 1. 调用 `ApprovalService.approve(work_order_id, user_id, action, comment)`<br>2. action="approve", comment="同意" |
| 期待结果 | 工单状态变更为 `APPROVED`，审计日志写入成功 |

```python
def test_single_approve_success(approval_service, mock_repository, pending_work_order, approver_user):
    """
    ATB-1: 单条审批通过测试
    
    验证 ApprovalService.approve() 方法：
    1. 正确更新工单状态为 APPROVED
    2. 正确记录审计日志
    3. 返回预期的响应结构
    """
    # Given
    mock_repository.get_work_order.return_value = pending_work_order
    mock_repository.get_user_role.return_value = "APPROVER"
    
    # When
    result = approval_service.approve(
        work_order_id=pending_work_order.id,
        user_id=approver_user.id,
        action="approve",
        comment="同意"
    )
    
    # Then
    assert result.status == "APPROVED"
    assert result.approved_by == approver_user.id
    mock_repository.update_status.assert_called_once_with(
        pending_work_order.id, "APPROVED"
    )
    mock_repository.create_audit_log.assert_called_once()
```

### ATB-2: 单条审批驳回

| 测试编号 | ATB-2 |
|----------|-------|
| 场景 | 审批人提交单条工单"驳回" |
| 前置条件 | 工单状态为 `PENDING_APPROVAL` |
| 测试步骤 | 调用 `ApprovalService.approve(action="reject", comment="材料不全")` |
| 期待结果 | 工单状态变更为 `REJECTED` |

```python
def test_single_reject_success(approval_service, mock_repository, pending_work_order, approver_user):
    """
    ATB-2: 单条审批驳回测试
    
    验证：
    1. 驳回操作正确更新状态为 REJECTED
    2. 驳回理由被正确记录
    """
    # Given
    mock_repository.get_work_order.return_value = pending_work_order
    
    # When
    result = approval_service.approve(
        work_order_id=pending_work_order.id,
        user_id=approver_user.id,
        action="reject",
        comment="材料不全"
    )
    
    # Then
    assert result.status == "REJECTED"
    assert result.comment == "材料不全"
```

### ATB-3: 批量审批通过

| 测试编号 | ATB-3 |
|----------|-------|
| 场景 | 审批人批量审批 10 条工单 |
| 前置条件 | 存在 10 条 `PENDING_APPROVAL` 状态工单 |
| 测试步骤 | 调用 `ApprovalService.batch_approve(work_order_ids, action)` |
| 期待结果 | 10 条工单全部成功，失败计数为 0 |

```python
def test_batch_approve_success(approval_service, mock_repository, pending_work_orders, approver_user):
    """
    ATB-3: 批量审批通过测试
    
    验证：
    1. 批量审批处理多条工单
    2. 返回成功/失败计数
    3. 所有工单状态正确更新
    """
    # Given
    work_order_ids = [wo.id for wo in pending_work_orders[:10]]
    mock_repository.get_work_orders.return_value = pending_work_orders[:10]
    
    # When
    result = approval_service.batch_approve(
        work_order_ids=work_order_ids,
        user_id=approver_user.id,
        action="approve"
    )
    
    # Then
    assert result.success_count == 10
    assert result.failure_count == 0
    assert mock_repository.update_status.call_count == 10
```

### ATB-4: 非法状态变更拒绝

| 测试编号 | ATB-4 |
|----------|-------|
| 场景 | 对已审批工单再次审批 |
| 前置条件 | 工单状态为 `APPROVED` |
| 测试步骤 | 调用审批接口对已审批工单执行审批 |
| 期待结果 | 返回 `InvalidStateTransitionError` 或 409 Conflict |

```python
def test_approve_invalid_state_raises_error(approval_service, mock_repository, approved_work_order, approver_user):
    """
    ATB-4: 非法状态变更拒绝测试
    
    验证：
    1. 状态机正确拒绝非法状态转换
    2. 返回明确的错误类型和消息
    """
    # Given
    mock_repository.get_work_order.return_value = approved_work_order  # 已是 APPROVED 状态
    
    # When/Then
    with pytest.raises(InvalidStateTransitionError) as exc_info:
        approval_service.approve(
            work_order_id=approved_work_order.id,
            user_id=approver_user.id,
            action="approve"
        )
    
    assert "INVALID_STATE_TRANSITION" in str(exc_info.value.code)
```

### ATB-5: 状态机规则验证

| 测试编号 | ATB-5 |
|----------|-------|
| 场景 | 验证状态机定义的状态流转 |
| 前置条件 | 状态机配置已加载 |
| 测试步骤 | 测试所有合法和非法状态转换路径 |
| 期待结果 | 合法路径通过，非法路径拒绝 |

```python
# 状态机正向路径定义
VALID_TRANSITIONS = {
    "PENDING_APPROVAL": ["APPROVED", "REJECTED"],
    "APPROVED": ["IN_PROGRESS", "CLOSED"],
    "REJECTED": ["PENDING_APPROVAL"],  # 可重新提交
}

@pytest.mark.parametrize("from_state,to_state,expected", [
    ("PENDING_APPROVAL", "APPROVED", True),
    ("PENDING_APPROVAL", "REJECTED", True),
    ("PENDING_APPROVAL", "CLOSED", False),   # 非法路径
    ("APPROVED", "PENDING_APPROVAL", False), # 非法路径
])
def test_state_machine_transition_validation(approval_service, from_state, to_state, expected):
    """
    ATB-5: 状态机规则验证测试
    
    验证状态机配置与实际转换行为一致
    """
    if expected:
        assert to_state in VALID_TRANSITIONS[from_state]
    else:
        assert to_state not in VALID_TRANSITIONS.get(from_state, [])
```

### ATB-6: 通知触发验证

| 测试编号 | ATB-6 |
|----------|-------|
| 场景 | 审批通过后触发通知 |
| 前置条件 | 审批人通过审批，系统有可用的通知服务 |
| 测试步骤 | 执行审批操作，验证通知服务被调用 |
| 期待结果 | `NotificationService.send_notification()` 被调用一次 |

```python
def test_notification_triggered_on_approve(
    approval_service, 
    mock_repository, 
    mock_notification_service,
    pending_work_order, 
    approver_user
):
    """
    ATB-6: 通知触发验证测试
    
    验证：
    1. 审批成功后触发通知
    2. 通知内容包含工单 ID 和新状态
    """
    # Given
    mock_repository.get_work_order.return_value = pending_work_order
    
    # When
    approval_service.approve(
        work_order_id=pending_work_order.id,
        user_id=approver_user.id,
        action="approve"
    )
    
    # Then
    mock_notification_service.send_notification.assert_called_once()
    call_kwargs = mock_notification_service.send_notification.call_args.kwargs
    assert "work_order_id" in call_kwargs
    assert call_kwargs["status"] == "APPROVED"
```

### ATB-7: 并发审批冲突检测

| 测试编号 | ATB-7 |
|----------|-------|
| 场景 | 两用户同时对同一工单提交审批 |
| 前置条件 | 工单状态为 `PENDING_APPROVAL` |
| 测试步骤 | 并发发送两个审批请求 |
| 期待结果 | 一个成功，一个返回 409 Conflict |

```python
def test_concurrent_approval_conflict(
    approval_service, 
    mock_repository, 
    pending_work_order,
    approver_user_1,
    approver_user_2
):
    """
    ATB-7: 并发审批冲突检测测试
    
    验证：
    1. 并发场景下只有一个请求成功
    2. 失败的请求返回明确的错误信息
    """
    # Given
    mock_repository.get_work_order.return_value = pending_work_order
    # 模拟第一次更新成功后加锁
    mock_repository.try_lock.return_value = True  # 第一次获取锁成功
    
    # When - 模拟并发
    with concurrent.ExecutionContext() as executor:
        future1 = executor.submit(
            approval_service.approve,
            pending_work_order.id,
            approver_user_1.id,
            "approve"
        )
        future2 = executor.submit(
            approval_service.approve,
            pending_work_order.id,
            approver_user_2.id,
            "approve"
        )
    
    # Then - 只有一个成功
    results = [f.result() for f in [future1, future2]]
    statuses = [r.status for r in results]
    
    assert statuses.count("APPROVED") == 1
    assert statuses.count("CONFLICT") == 1
```

### ATB-8: 无权限用户拒绝

| 测试编号 | ATB-8 |
|----------|-------|
| 场景 | 非审批人角色用户尝试审批 |
| 前置条件 | 当前用户角色为 `REQUESTER` |
| 测试步骤 | 调用审批接口 |
| 期待结果 | 返回 `PermissionDeniedError` 或 403 Forbidden |

```python
def test_unauthorized_approval_rejected(approval_service, mock_repository, pending_work_order, regular_user):
    """
    ATB-8: 无权限用户拒绝测试
    
    验证：
    1. 非 APPROVER 角色用户被拒绝
    2. 返回明确的权限错误
    """
    # Given
    mock_repository.get_work_order.return_value = pending_work_order
    mock_repository.get_user_role.return_value = "REQUESTER"
    
    # When/Then
    with pytest.raises(PermissionDeniedError) as exc_info:
        approval_service.approve(
            work_order_id=pending_work_order.id,
            user_id=regular_user.id,
            action="approve"
        )
    
    assert exc_info.value.code == "INSUFFICIENT_PERMISSION"
```

### ATB-9: 批量超限拒绝

| 测试编号 | ATB-9 |
|----------|-------|
| 场景 | 批量审批请求超出 50 条限制 |
| 前置条件 | 传入 51 个工单 ID |
| 测试步骤 | 调用 `batch_approve()` 传入超量 ID |
| 期待结果 | 返回 `ValidationError` 或 400 Bad Request |

```python
def test_batch_approve_exceeds_limit(approval_service, mock_repository, pending_work_orders, approver_user):
    """
    ATB-9: 批量超限拒绝测试
    
    验证：
    1. 批量数量超过 50 条时被拒绝
    2. 返回明确的验证错误
    """
    # Given
    work_order_ids = [wo.id for wo in pending_work_orders[:51]]  # 51 > 50
    
    # When/Then
    with pytest.raises(ValidationError) as exc_info:
        approval_service.batch_approve(
            work_order_ids=work_order_ids,
            user_id=approver_user.id,
            action="approve"
        )
    
    assert "exceeds limit" in str(exc_info.value.message).lower()
```

### ATB-10: 工单创建者不能审批自己的工单

| 测试编号 | ATB-10 |
|----------|--------|
| 场景 | 工单创建者尝试审批自己创建的工单 |
| 前置条件 | 当前用户既是创建者也是审批人 |
| 测试步骤 | 调用审批接口 |
| 期待结果 | 返回 `SelfApprovalError` 或拒绝 |

```python
def test_self_approval_rejected(approval_service, mock_repository, pending_work_order, creator_user):
    """
    ATB-10: 自审批拒绝测试
    
    验证：
    1. 工单创建者不能审批自己的工单
    2. 返回明确的业务规则错误
    """
    # Given
    mock_repository.get_work_order.return_value = pending_work_order
    pending_work_order.created_by = creator_user.id
    mock_repository.get_user_role.return_value = "APPROVER"
    
    # When/Then
    with pytest.raises(SelfApprovalError):
        approval_service.approve(
            work_order_id=pending_work_order.id,
            user_id=creator_user.id,
            action="approve"
        )
```

---

## 5. 开发切入层级序列

### L1: 数据层

```python
# tests/unit/test_approval_service.py - 辅助 Fixture
@pytest.fixture
def mock_repository():
    """模拟仓储层"""
    from unittest.mock import MagicMock
    repo = MagicMock()
    repo.get_work_order = MagicMock()
    repo.update_status = MagicMock()
    repo.create_audit_log = MagicMock()
    repo.get_user_role = MagicMock()
    return repo
```

### L2: 状态机层

```python
# tests/unit/test_approval_service.py - 状态转换验证
def test_state_machine_can_transition(approval_service, pending_work_order):
    """验证 can_transition 方法"""
    assert approval_service.can_transition(
        pending_work_order.id, "APPROVED"
    ) is True
    assert approval_service.can_transition(
        pending_work_order.id, "CLOSED"
    ) is False
```

### L3: 服务层

```python
# tests/unit/test_approval_service.py - 核心测试类
class TestApprovalService:
    """ApprovalService 单元测试"""
    
    def test_approve_updates_work_order_status(self, ...):
        """审批后工单状态更新"""
        pass
    
    def test_approve_creates_audit_log(self, ...):
        """审批后创建审计日志"""
        pass
    
    def test_approve_triggers_notification(self, ...):
        """审批后触发通知"""
        pass
    
    def test_approve_validates_user_permission(self, ...):
        """审批前验证用户权限"""
        pass
    
    def test_reject_with_reason(self, ...):
        """驳回时记录驳回原因"""
        pass
    
    def test_batch_approve_processes_all_items(self, ...):
        """批量审批处理所有项"""
        pass
```

### L4: 错误处理

```python
# tests/unit/test_approval_service.py - 错误场景
class TestApprovalServiceErrors:
    """ApprovalService 错误处理测试"""
    
    def test_work_order_not_found(self, ...):
        """工单不存在"""
        pass
    
    def test_invalid_state_transition(self, ...):
        """非法状态转换"""
        pass
    
    def test_permission_denied(self, ...):
        """权限不足"""
        pass
    
    def test_concurrent_modification(self, ...):
        """并发修改冲突"""
        pass
    
    def test_validation_error(self, ...):
        """参数验证错误"""
        pass
```

---

## 6. 附录：状态机流转图

```
                              ┌─────────────┐
                              │    DRAFT    │
                              └──────┬──────┘
                                     │ submit
                                     ▼
                        ┌────────────────────────┐
                        │  PENDING_APPROVAL      │
                        └───────────┬────────────┘
                         ▲          │
                  reject │          │ approve
                         │          │
              ┌──────────┴───┐      │
              │   REJECTED   │      ▼
              └──────────────┘ ┌─────────────┐
                               │  APPROVED  │
                               └──────┬──────┘
                                      │ start
                                      ▼
                              ┌─────────────┐
                              │ IN_PROGRESS │
                              └──────┬──────┘
                                     │ complete
                                     ▼
                              ┌─────────────┐
                              │   CLOSED    │
                              └─────────────┘
```

---

## 7. 测试覆盖目标

| 测试类别 | 覆盖率目标 | 关键指标 |
|----------|-----------|----------|
| 核心方法 | 100% | `approve()`, `reject()`, `batch_approve()` |
| 状态机 | 100% | 所有合法/非法转换 |
| 错误处理 | 100% | 所有异常路径 |
| 边界条件 | 100% | 批量上限、并发、空值 |

---

**文档版本**: v3.0  
**迭代**: SWARM-2025-Q2-P0-003 Iteration 3  
**状态**: DRAFT for Review