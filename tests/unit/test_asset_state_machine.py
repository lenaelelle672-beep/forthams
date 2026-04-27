"""
资产状态机单元测试 (SWARM-002 Iteration 6)

验收标准：
- 状态转换 100% 覆盖所有合法路径
- 非法路径 100% 触发对应异常
- 版本号单调递增
"""

import pytest

from backend.src.main.java.com.ams.state import (
    AssetStatus,
    AssetStateMachine,
    AssetStateChangedEvent,
    RetirementEvent,
    StateTransitionException,
)
from backend.src.main.java.com.ams.entity import Asset


class OptimisticLockError(Exception):
    """并发修改冲突异常"""
    pass


class ForbiddenStateTransitionError(Exception):
    """禁止的状态转换异常"""
    pass


# ==================== 层级 1：状态机单元测试 ====================

def test_state_transition_pending_to_under_review():
    """
    申请提交后状态从PENDING流转到UNDER_REVIEW
    
    验证：
    - 新状态为 UNDER_REVIEW
    - 版本号递增
    - 事件记录正确
    """
    asset = Asset(id="A001", status=AssetStatus.ACTIVE, version=1)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_SUBMITTED",
        asset_id="A001",
        operator="user001",
    )
    
    new_asset, event_record = asset.apply(event)
    
    assert new_asset.status == AssetStatus.UNDER_REVIEW
    assert new_asset.version == 2
    assert event_record.event_type == "RETIRE_REQUEST_SUBMITTED"


def test_state_transition_rejected_returns_to_active():
    """
    审批驳回后资产状态回退ACTIVE，版本号递增
    
    验证：
    - 状态回退到 ACTIVE
    - 版本号正确递增
    """
    asset = Asset(id="A001", status=AssetStatus.UNDER_REVIEW, version=5)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_REJECTED",
        asset_id="A001",
        reject_reason="资料不全",
    )
    
    new_asset, event_record = asset.apply(event)
    
    assert new_asset.status == AssetStatus.ACTIVE
    assert new_asset.version == 6


def test_concurrent_modification_raises_optimistic_lock_error():
    """
    并发修改同一资产时抛出OptimisticLockError
    
    验证：
    - 先处理 stale event 成功
    - 处理 fresh event 时抛出 OptimisticLockError
    """
    asset = Asset(id="A001", status=AssetStatus.ACTIVE, version=1)
    stale_event = RetirementEvent(
        event_type="RETIRE_REQUEST_SUBMITTED",
        asset_id="A001",
        operator="user001",
        expected_version=1,
    )
    fresh_event = RetirementEvent(
        event_type="RETIRE_REQUEST_SUBMITTED",
        asset_id="A001",
        operator="user002",
        expected_version=2,
    )
    
    # 先处理 stale event
    asset.apply(stale_event)
    
    # 处理 fresh event 时应抛出 OptimisticLockError
    with pytest.raises(OptimisticLockError):
        asset.apply(fresh_event)


def test_state_machine_forbidden_transition():
    """
    从RETIRED直接流转到ACTIVE应被拒绝
    
    验证：
    - 禁止从 RETIRED 到 ACTIVE 的非法转换
    - 抛出 ForbiddenStateTransitionError
    """
    asset = Asset(id="A001", status=AssetStatus.RETIRED, version=10)
    illegal_event = RetirementEvent(
        event_type="ASSET_REACTIVATED",
        asset_id="A001",
        operator="admin001",
    )
    
    with pytest.raises(ForbiddenStateTransitionError):
        asset.apply(illegal_event)


# ==================== 扩展测试：覆盖更多合法路径 ====================

def test_state_transition_active_to_pending():
    """
    ACTIVE 状态发起报废申请流转到 PENDING
    """
    asset = Asset(id="A002", status=AssetStatus.ACTIVE, version=1)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_CREATED",
        asset_id="A002",
        operator="user001",
    )
    
    new_asset, _ = asset.apply(event)
    
    assert new_asset.status == AssetStatus.PENDING
    assert new_asset.version == 2


def test_state_transition_under_review_to_pending():
    """
    UNDER_REVIEW 状态撤回申请流转到 PENDING
    """
    asset = Asset(id="A003", status=AssetStatus.UNDER_REVIEW, version=3)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_WITHDRAWN",
        asset_id="A003",
        operator="user001",
    )
    
    new_asset, _ = asset.apply(event)
    
    assert new_asset.status == AssetStatus.PENDING
    assert new_asset.version == 4


def test_state_transition_pending_to_approved():
    """
    PENDING 状态审批通过流转到 APPROVED
    """
    asset = Asset(id="A004", status=AssetStatus.PENDING, version=2)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_APPROVED",
        asset_id="A004",
        approver="manager001",
    )
    
    new_asset, _ = asset.apply(event)
    
    assert new_asset.status == AssetStatus.APPROVED
    assert new_asset.version == 3


def test_state_transition_approved_to_retired():
    """
    APPROVED 状态执行退役流转到 RETIRED
    """
    asset = Asset(id="A005", status=AssetStatus.APPROVED, version=4)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_COMPLETED",
        asset_id="A005",
        operator="admin001",
    )
    
    new_asset, _ = asset.apply(event)
    
    assert new_asset.status == AssetStatus.RETIRED
    assert new_asset.version == 5


def test_version_number_monotonically_increases():
    """
    版本号单调递增验证
    """
    asset = Asset(id="A006", status=AssetStatus.ACTIVE, version=1)
    
    events = [
        RetirementEvent(event_type="RETIRE_REQUEST_CREATED", asset_id="A006"),
        RetirementEvent(event_type="RETIRE_REQUEST_SUBMITTED", asset_id="A006"),
        RetirementEvent(event_type="RETIRE_REQUEST_APPROVED", asset_id="A006"),
        RetirementEvent(event_type="RETIRE_REQUEST_COMPLETED", asset_id="A006"),
    ]
    
    versions = [asset.version]
    for event in events:
        asset, _ = asset.apply(event)
        versions.append(asset.version)
    
    # 验证版本号递增
    for i in range(1, len(versions)):
        assert versions[i] > versions[i - 1], f"版本号未单调递增: {versions}"


# ==================== 边界条件测试 ====================

def test_state_machine_empty_asset_id():
    """
    空资产ID应被拒绝
    """
    with pytest.raises(ValueError):
        Asset(id="", status=AssetStatus.ACTIVE, version=1)


def test_state_machine_invalid_version():
    """
    版本号为负数应被拒绝
    """
    with pytest.raises(ValueError):
        Asset(id="A007", status=AssetStatus.ACTIVE, version=-1)


def test_state_machine_null_status():
    """
    空状态应被拒绝
    """
    with pytest.raises(ValueError):
        Asset(id="A008", status=None, version=1)


# ==================== 事件记录验证 ====================

def test_event_record_contains_required_fields():
    """
    事件记录包含所有必需字段
    """
    asset = Asset(id="A009", status=AssetStatus.ACTIVE, version=1)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_SUBMITTED",
        asset_id="A009",
        operator="user001",
        reason="设备老化",
    )
    
    _, event_record = asset.apply(event)
    
    assert event_record.event_type == "RETIRE_REQUEST_SUBMITTED"
    assert event_record.asset_id == "A009"
    assert event_record.operator == "user001"
    assert event_record.timestamp is not None


def test_event_record_status_change_metadata():
    """
    事件记录包含状态变更元数据
    """
    asset = Asset(id="A010", status=AssetStatus.ACTIVE, version=1)
    event = RetirementEvent(
        event_type="RETIRE_REQUEST_SUBMITTED",
        asset_id="A010",
        operator="user001",
    )
    
    _, event_record = asset.apply(event)
    
    assert event_record.previous_status == AssetStatus.ACTIVE
    assert event_record.new_status == AssetStatus.UNDER_REVIEW
    assert event_record.previous_version == 1
    assert event_record.new_version == 2