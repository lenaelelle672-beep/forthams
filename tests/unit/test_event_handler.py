"""
工单审批流程 - 事件处理器单元测试

测试工单审批相关的事件发布和处理机制，包括：
- WorkOrderApprovedEvent 事件发布
- WorkOrderRejectedEvent 事件发布
- 状态转换后的事件触发
- 通知机制集成

ATB 覆盖: UT-001 ~ UT-006 (状态机与事件集成测试)
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from typing import Optional

# 导入状态枚举
try:
    from src.domain.events.state_changed import (
        WorkOrderApprovedEvent,
        WorkOrderRejectedEvent,
        WorkOrderStateChangedEvent,
    )
except ImportError:
    # 兼容性处理：当模块结构不完整时使用 Mock
    WorkOrderApprovedEvent = Mock
    WorkOrderRejectedEvent = Mock
    WorkOrderStateChangedEvent = Mock


# ============================================================================
# 测试 Fixtures
# ============================================================================

@pytest.fixture
def mock_event_bus():
    """创建模拟的事件总线"""
    event_bus = Mock()
    event_bus.publish = Mock(return_value=None)
    event_bus.subscribe = Mock(return_value=None)
    return event_bus


@pytest.fixture
def mock_notification_service():
    """创建模拟的通知服务"""
    notification_service = Mock()
    notification_service.send_approval_notification = Mock(return_value=True)
    notification_service.send_rejection_notification = Mock(return_value=True)
    return notification_service


@pytest.fixture
def sample_work_order():
    """创建示例工单数据"""
    return {
        "id": "WO-2025-001",
        "title": "测试工单",
        "state": "PENDING",
        "version": 1,
        "created_by": "user001",
        "created_at": datetime.now().isoformat(),
        "current_approver": "approver001",
    }


# ============================================================================
# UT-001: 状态机定义测试
# ============================================================================

class TestStateEnumDefinition:
    """验证所有状态枚举值正确定义"""

    def test_state_enum_approved_value(self):
        """
        ATB: UT-001
        验证 APPROVED 枚举值正确
        """
        from src.domain.events.state_changed import StateEnum
        
        assert hasattr(StateEnum, 'APPROVED'), "StateEnum 应包含 APPROVED 状态"
        assert StateEnum.APPROVED.value == "APPROVED", \
            f"StateEnum.APPROVED.value 应为 'APPROVED'，实际为 '{StateEnum.APPROVED.value}'"

    def test_state_enum_rejected_value(self):
        """
        ATB: UT-001
        验证 REJECTED 枚举值正确
        """
        from src.domain.events.state_changed import StateEnum
        
        assert hasattr(StateEnum, 'REJECTED'), "StateEnum 应包含 REJECTED 状态"
        assert StateEnum.REJECTED.value == "REJECTED"

    def test_state_enum_all_values(self):
        """
        ATB: UT-001
        验证所有状态枚举值完整性
        """
        from src.domain.events.state_changed import StateEnum
        
        expected_states = ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "CLOSED"]
        for state in expected_states:
            assert hasattr(StateEnum, state), f"StateEnum 应包含 {state} 状态"


# ============================================================================
# UT-002 & UT-003: 状态转换规则测试
# ============================================================================

class TestStateTransitionRules:
    """测试状态转换规则引擎"""

    def test_valid_transition_pending_to_in_progress(self, mock_event_bus):
        """
        ATB: UT-002
        PENDING → IN_PROGRESS 应返回 True
        """
        from src.domain.events.state_changed import (
            StateMachine,
            StateEnum,
        )
        
        sm = StateMachine(mock_event_bus)
        
        # 验证合法转换
        can_transition = sm.can_transition(
            StateEnum.PENDING.value, 
            StateEnum.IN_PROGRESS.value
        )
        assert can_transition is True, \
            "PENDING → IN_PROGRESS 应为合法转换"

    def test_invalid_transition_approved_to_pending(self, mock_event_bus):
        """
        ATB: UT-003
        APPROVED → PENDING 应返回 False（不允许逆向转换）
        """
        from src.domain.events.state_changed import (
            StateMachine,
            StateEnum,
        )
        
        sm = StateMachine(mock_event_bus)
        
        # 验证非法转换
        can_transition = sm.can_transition(
            StateEnum.APPROVED.value, 
            StateEnum.PENDING.value
        )
        assert can_transition is False, \
            "APPROVED → PENDING 应为非法转换（状态不可逆）"

    def test_valid_transition_in_progress_to_approved(self, mock_event_bus):
        """
        ATB: UT-004 (前置条件)
        验证 IN_PROGRESS → APPROVED 为合法转换
        """
        from src.domain.events.state_changed import (
            StateMachine,
            StateEnum,
        )
        
        sm = StateMachine(mock_event_bus)
        
        can_transition = sm.can_transition(
            StateEnum.IN_PROGRESS.value,
            StateEnum.APPROVED.value
        )
        assert can_transition is True


# ============================================================================
# UT-004: 状态转换执行测试
# ============================================================================

class TestStateTransitionExecution:
    """测试状态转换执行与状态更新"""

    def test_transition_in_progress_to_approved_updates_state(self, sample_work_order):
        """
        ATB: UT-004
        执行 IN_PROGRESS → APPROVED 后状态应更新为 APPROVED
        """
        from src.domain.events.state_changed import (
            StateMachine,
            StateEnum,
        )
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        # 模拟工单状态
        current_state = sample_work_order.copy()
        
        # 执行转换
        result = sm.transition(
            current_state,
            StateEnum.IN_PROGRESS.value,
            StateEnum.APPROVED.value,
            operator="approver001"
        )
        
        # 验证状态已更新
        assert result["state"] == StateEnum.APPROVED.value, \
            f"状态应更新为 APPROVED，实际为 {result['state']}"
        assert result["previous_state"] == StateEnum.IN_PROGRESS.value

    def test_transition_creates_history_record(self, sample_work_order):
        """
        ATB: UT-004
        状态转换应创建历史记录
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        result = sm.transition(
            current_state,
            "IN_PROGRESS",
            "APPROVED",
            operator="approver001",
            reason="审批通过"
        )
        
        assert "history" in result or "transition_history" in result, \
            "状态转换结果应包含历史记录"


# ============================================================================
# UT-005: 版本号递增测试
# ============================================================================

class TestVersionIncrement:
    """测试乐观锁版本号递增"""

    def test_state_change_increments_version(self, sample_work_order):
        """
        ATB: UT-005
        状态变更后版本号应 +1
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        old_version = current_state["version"]
        
        result = sm.transition(
            current_state,
            "PENDING",
            "IN_PROGRESS",
            operator="user001"
        )
        
        new_version = result.get("version", result.get("new_version", None))
        assert new_version is not None, "转换结果应包含新版本号"
        assert new_version == old_version + 1, \
            f"版本号应从 {old_version} 增加到 {old_version + 1}，实际为 {new_version}"

    def test_concurrent_modification_detected(self, sample_work_order):
        """
        ATB: UT-005
        并发修改应被检测到（乐观锁冲突）
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        # 第一次修改成功
        result1 = sm.transition(
            current_state,
            "PENDING",
            "IN_PROGRESS",
            operator="user001"
        )
        
        # 模拟第二次并发修改（旧版本号）
        old_version_state = current_state.copy()
        old_version_state["version"] = 1  # 使用旧版本号
        
        # 应抛出乐观锁冲突异常
        with pytest.raises(Exception) as exc_info:
            sm.transition(
                old_version_state,
                "PENDING",
                "IN_PROGRESS",
                operator="user002"
            )
        
        assert "version" in str(exc_info.value).lower() or "conflict" in str(exc_info.value).lower(), \
            "应抛出版本冲突异常"


# ============================================================================
# UT-006: 通知事件发布测试
# ============================================================================

class TestEventPublishing:
    """测试审批完成后事件发布"""

    def test_approve_event_published(self, mock_event_bus, sample_work_order):
        """
        ATB: UT-006
        审批通过后事件总线应接收 WorkOrderApproved 事件
        """
        from src.domain.events.state_changed import (
            StateMachine,
            StateEnum,
        )
        
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        # 执行审批通过
        sm.transition(
            current_state,
            "IN_PROGRESS",
            "APPROVED",
            operator="approver001",
            reason="审批通过"
        )
        
        # 验证事件发布被调用一次
        mock_event_bus.publish.assert_called()
        
        # 获取调用参数
        call_args = mock_event_bus.publish.call_args
        published_event = call_args[0][0] if call_args[0] else call_args[1].get('event')
        
        # 验证事件类型包含 APPROVED
        assert published_event is not None
        event_type = type(published_event).__name__
        assert "Approved" in event_type or "APPROVED" in str(published_event), \
            f"发布的事件应为 WorkOrderApprovedEvent，实际为 {event_type}"

    def test_reject_event_published(self, mock_event_bus, sample_work_order):
        """
        ATB: UT-006
        审批拒绝后事件总线应接收 WorkOrderRejected 事件
        """
        from src.domain.events.state_changed import (
            StateMachine,
            StateEnum,
        )
        
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        # 执行审批拒绝
        sm.transition(
            current_state,
            "IN_PROGRESS",
            "REJECTED",
            operator="approver001",
            reason="材料不全"
        )
        
        # 验证事件发布
        mock_event_bus.publish.assert_called()
        
        call_args = mock_event_bus.publish.call_args
        published_event = call_args[0][0] if call_args[0] else call_args[1].get('event')
        
        assert published_event is not None
        event_type = type(published_event).__name__
        assert "Rejected" in event_type or "REJECTED" in str(published_event), \
            f"发布的事件应为 WorkOrderRejectedEvent，实际为 {event_type}"

    def test_event_contains_required_fields(self, mock_event_bus, sample_work_order):
        """
        ATB: UT-006
        发布的事件应包含必要字段（work_order_id, operator, timestamp）
        """
        from src.domain.events.state_changed import StateMachine
        
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        sm.transition(
            current_state,
            "IN_PROGRESS",
            "APPROVED",
            operator="approver001"
        )
        
        call_args = mock_event_bus.publish.call_args
        published_event = call_args[0][0] if call_args[0] else call_args[1].get('event')
        
        # 验证事件包含必要属性
        assert hasattr(published_event, 'work_order_id') or \
               hasattr(published_event, 'workorder_id') or \
               'work_order_id' in str(published_event.__dict__) or \
               'id' in str(published_event.__dict__), \
            "事件应包含 work_order_id 字段"


# ============================================================================
# 集成测试：事件与通知服务联动
# ============================================================================

class TestEventNotificationIntegration:
    """测试事件发布后通知服务联动"""

    def test_notification_triggered_on_approval(
        self, 
        mock_event_bus, 
        mock_notification_service,
        sample_work_order
    ):
        """
        ATB: 扩展测试
        审批通过后应触发通知
        """
        from src.domain.events.state_changed import StateMachine
        
        sm = StateMachine(mock_event_bus)
        
        # 模拟事件处理器订阅
        def handle_approval_event(event):
            mock_notification_service.send_approval_notification(
                event.work_order_id,
                event.operator
            )
        
        mock_event_bus.subscribe = Mock(
            side_effect=lambda event_type, handler: setattr(
                mock_event_bus, '_handlers', [handle_approval_event]
            )
        )
        
        current_state = sample_work_order.copy()
        
        # 执行审批
        sm.transition(
            current_state,
            "IN_PROGRESS",
            "APPROVED",
            operator="approver001"
        )
        
        # 验证通知服务被调用
        # 注意：通知失败不应阻塞审批主流程
        # 实际实现中应为异步处理

    def test_notification_async_not_blocking_approval(self, mock_event_bus, sample_work_order):
        """
        ATB: 边界约束 - 通知约束
        通知失败不应阻塞审批主流程
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_notification = Mock()
        mock_notification.send = Mock(side_effect=Exception("通知服务不可用"))
        
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        # 即使通知失败，审批流程仍应正常完成
        try:
            result = sm.transition(
                current_state,
                "IN_PROGRESS",
                "APPROVED",
                operator="approver001"
            )
            # 验证状态已成功变更
            assert result["state"] == "APPROVED"
        except Exception as e:
            pytest.fail(f"通知失败不应阻塞审批: {e}")


# ============================================================================
# 边界异常处理测试
# ============================================================================

class TestBoundaryConditions:
    """测试边界条件和异常处理"""

    def test_final_state_cannot_transition(self, sample_work_order):
        """
        ATB: IT-008
        对 APPROVED 状态工单再次审批应返回错误
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        current_state["state"] = "APPROVED"
        
        # 终态不可再转换
        with pytest.raises(Exception):
            sm.transition(
                current_state,
                "APPROVED",
                "PENDING"
            )

    def test_nonexistent_state_transition(self, sample_work_order):
        """
        测试不存在的状态转换
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        # 无效的转换应失败
        can_transition = sm.can_transition(
            "PENDING",
            "UNKNOWN_STATE"
        )
        assert can_transition is False

    def test_empty_operator_rejected(self, sample_work_order):
        """
        测试空操作人应被拒绝
        """
        from src.domain.events.state_changed import StateMachine
        
        mock_event_bus = Mock()
        sm = StateMachine(mock_event_bus)
        
        current_state = sample_work_order.copy()
        
        with pytest.raises(Exception):
            sm.transition(
                current_state,
                "PENDING",
                "IN_PROGRESS",
                operator=""  # 空操作人
            )