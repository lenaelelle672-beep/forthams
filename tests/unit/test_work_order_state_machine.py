"""
Unit tests for WorkOrderStateMachine — multi-level approval flow.

Phase 1 coverage (ATB-1 / ATB-2 / ATB-3):
  - Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  - Rejection:     APPROVING_LEVEL_1 → REJECTED, APPROVING_LEVEL_2 → REJECTED
                   (rejectionReason mandatory, non-blank, ≤ 500 chars)
  - Cancellation:  PENDING / APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → CANCELLED
  - Cross-level / illegal transition prevention
  - Terminal-state immutability
"""

import pytest

from backend.state_machine.workorder_state import WorkOrderState
from backend.state_machine.workorder_state_machine import (
    StateTransitionException,
    WorkOrderStateMachine,
)


# ---------------------------------------------------------------------------
# Fixtures — one per relevant state
# ---------------------------------------------------------------------------

@pytest.fixture
def pending_sm():
    """Return a WorkOrderStateMachine initialised in PENDING state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)


@pytest.fixture
def approving_l1_sm():
    """Return a WorkOrderStateMachine initialised in APPROVING_LEVEL_1 state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVING_LEVEL_1)


@pytest.fixture
def approving_l2_sm():
    """Return a WorkOrderStateMachine initialised in APPROVING_LEVEL_2 state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVING_LEVEL_2)


@pytest.fixture
def approved_sm():
    """Return a WorkOrderStateMachine initialised in APPROVED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVED)


@pytest.fixture
def rejected_sm():
    """Return a WorkOrderStateMachine initialised in REJECTED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.REJECTED)


@pytest.fixture
def cancelled_sm():
    """Return a WorkOrderStateMachine initialised in CANCELLED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.CANCELLED)


# ===================================================================
# ATB-1: Forward (positive) state transitions
# PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
# ===================================================================

class TestForwardTransitions:
    """ATB-1: Sequential approval advances the work order through all levels."""

    def test_pending_to_approving_level_1(self, pending_sm):
        """APPROVE event: PENDING → APPROVING_LEVEL_1."""
        result = pending_sm.trigger("APPROVE")
        assert result is True
        assert pending_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_approving_level_1_to_approving_level_2(self, approving_l1_sm):
        """APPROVE event: APPROVING_LEVEL_1 → APPROVING_LEVEL_2."""
        result = approving_l1_sm.trigger("APPROVE")
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

    def test_approving_level_2_to_approved(self, approving_l2_sm):
        """APPROVE event: APPROVING_LEVEL_2 → APPROVED."""
        result = approving_l2_sm.trigger("APPROVE")
        assert result is True
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVED

    def test_full_forward_flow_sequential(self, pending_sm):
        """Complete forward chain: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        pending_sm.trigger("APPROVE")
        assert pending_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

        pending_sm.trigger("APPROVE")
        assert pending_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

        pending_sm.trigger("APPROVE")
        assert pending_sm.get_current_state() == WorkOrderState.APPROVED


# ===================================================================
# ATB-2: Rejection (reverse) transitions
# Any approval node → REJECTED, with mandatory rejectionReason
# ===================================================================

class TestRejectionTransitions:
    """ATB-2: Rejection from approval nodes with reason validation."""

    # -- Successful rejections -------------------------------------------------

    def test_reject_from_approving_level_1(self, approving_l1_sm):
        """REJECT from APPROVING_LEVEL_1 with valid reason → REJECTED."""
        result = approving_l1_sm.trigger("REJECT", rejection_reason="不合规")
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_from_approving_level_2(self, approving_l2_sm):
        """REJECT from APPROVING_LEVEL_2 with valid reason → REJECTED."""
        result = approving_l2_sm.trigger("REJECT", rejection_reason="资产信息有误")
        assert result is True
        assert approving_l2_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_reason_stored(self, approving_l1_sm):
        """The rejection reason is persisted on the state machine after rejection."""
        reason = "申请材料不完整，请补充后重新提交"
        approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l1_sm.get_rejection_reason() == reason

    def test_reject_with_reason_at_max_length(self, approving_l1_sm):
        """rejectionReason at exactly 500 characters is accepted."""
        max_reason = "x" * 500
        result = approving_l1_sm.trigger("REJECT", rejection_reason=max_reason)
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED

    # -- Missing / invalid rejection reason ------------------------------------

    def test_reject_without_reason_raises_error(self, approving_l1_sm):
        """REJECT without rejectionReason must raise ValueError (→ HTTP 400)."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_empty_reason_raises_error(self, approving_l1_sm):
        """REJECT with empty-string rejectionReason must raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason="")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_whitespace_only_reason_raises_error(self, approving_l1_sm):
        """REJECT with whitespace-only rejectionReason must raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason="   ")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_reason_exceeding_max_length_raises_error(self, approving_l1_sm):
        """REJECT with rejectionReason > 500 characters must raise ValueError."""
        long_reason = "x" * 501
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason=long_reason)
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_without_reason_from_level_2_raises_error(self, approving_l2_sm):
        """REJECT from APPROVING_LEVEL_2 without reason must also raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l2_sm.trigger("REJECT")
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2


# ===================================================================
# ATB-3: Invalid / cross-level state transitions
# Must raise StateTransitionException (→ HTTP 409 INVALID_STATE_TRANSITION)
# ===================================================================

class TestInvalidTransitions:
    """ATB-3: Cross-level approval and illegal transitions are blocked."""

    def test_pending_cannot_skip_to_approving_level_2(self, pending_sm):
        """Cross-level prevention: PENDING cannot directly reach APPROVING_LEVEL_2."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE_LEVEL_2")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_pending_cannot_skip_to_approved(self, pending_sm):
        """Cross-level prevention: PENDING cannot directly reach APPROVED."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("FINAL_APPROVE")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_approving_level_1_cannot_skip_to_approved(self, approving_l1_sm):
        """Cross-level prevention: APPROVING_LEVEL_1 cannot directly reach APPROVED."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("FINAL_APPROVE")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_pending_cannot_be_rejected(self, pending_sm):
        """REJECT from PENDING is illegal — no approval node has started yet."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("REJECT", rejection_reason="不应在待审前驳回")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_approved_cannot_approve_again(self, approved_sm):
        """APPROVE from APPROVED is illegal — already in terminal positive state."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("APPROVE")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_approved_cannot_be_rejected(self, approved_sm):
        """REJECT from APPROVED is illegal — already approved."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("REJECT", rejection_reason="已通过不可驳回")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_rejected_cannot_approve(self, rejected_sm):
        """APPROVE from REJECTED is illegal — must re-submit instead."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("APPROVE")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED

    def test_rejected_cannot_be_rejected_again(self, rejected_sm):
        """REJECT from REJECTED is illegal — already rejected."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("REJECT", rejection_reason="重复驳回")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED

    def test_cancelled_is_terminal_for_approve(self, cancelled_sm):
        """APPROVE from CANCELLED is illegal — terminal state."""
        with pytest.raises(StateTransitionException):
            cancelled_sm.trigger("APPROVE")
        assert cancelled_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_cancelled_is_terminal_for_reject(self, cancelled_sm):
        """REJECT from CANCELLED is illegal — terminal state."""
        with pytest.raises(StateTransitionException):
            cancelled_sm.trigger("REJECT", rejection_reason="已取消")
        assert cancelled_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_cancelled_is_terminal_for_cancel(self, cancelled_sm):
        """CANCEL from CANCELLED is illegal — already cancelled."""
        with pytest.raises(StateTransitionException):
            cancelled_sm.trigger("CANCEL")
        assert cancelled_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_unknown_event_raises_exception(self, pending_sm):
        """Triggering an unrecognised event must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("UNKNOWN_EVENT")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING


# ===================================================================
# CANCELLED transitions
# ===================================================================

class TestCancelledTransitions:
    """CANCELLED state: reachable from non-terminal states before final approval."""

    def test_cancel_from_pending(self, pending_sm):
        """CANCEL event: PENDING → CANCELLED."""
        result = pending_sm.trigger("CANCEL")
        assert result is True
        assert pending_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_cancel_from_approving_level_1(self, approving_l1_sm):
        """CANCEL event: APPROVING_LEVEL_1 → CANCELLED."""
        result = approving_l1_sm.trigger("CANCEL")
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_cancel_from_approving_level_2(self, approving_l2_sm):
        """CANCEL event: APPROVING_LEVEL_2 → CANCELLED."""
        result = approving_l2_sm.trigger("CANCEL")
        assert result is True
        assert approving_l2_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_cancel_from_approved_not_allowed(self, approved_sm):
        """CANCEL from APPROVED is illegal — already finalised."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("CANCEL")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_cancel_from_rejected_not_allowed(self, rejected_sm):
        """CANCEL from REJECTED is illegal — already finalised."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("CANCEL")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED


# ===================================================================
# State immutability on failed transitions
# ===================================================================

class TestStateImmutabilityOnFailure:
    """When a transition fails the current state must remain unchanged."""

    def test_state_unchanged_on_invalid_approve(self, approved_sm):
        """APPROVED stays APPROVED after illegal APPROVE."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("APPROVE")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_state_unchanged_on_invalid_reject(self, pending_sm):
        """PENDING stays PENDING after illegal REJECT."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("REJECT", rejection_reason="invalid")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_state_unchanged_on_missing_rejection_reason(self, approving_l2_sm):
        """APPROVING_LEVEL_2 stays unchanged when REJECT lacks reason."""
        with pytest.raises(ValueError):
            approving_l2_sm.trigger("REJECT")
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

    def test_state_unchanged_on_cross_level_attempt(self, approving_l1_sm):
        """APPROVING_LEVEL_1 stays unchanged on cross-level skip attempt."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("FINAL_APPROVE")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1


# ===================================================================
# Enum & structural validation
# ===================================================================

class TestWorkOrderStateEnum:
    """Verify the WorkOrderState enum contains all required values."""

    def test_all_required_states_exist(self):
        """The enum must define all six states from the spec."""
        expected_names = {
            "PENDING",
            "APPROVING_LEVEL_1",
            "APPROVING_LEVEL_2",
            "APPROVED",
            "REJECTED",
            "CANCELLED",
        }
        actual_names = {state.name for state in WorkOrderState}
        assert actual_names == expected_names

    def test_no_extra_states(self):
        """The enum must not contain states outside the spec (e.g. DRAFT, CLOSED)."""
        disallowed = {"DRAFT", "CLOSED", "SUBMITTED"}
        actual_names = {state.name for state in WorkOrderState}
        for name in disallowed:
            assert name not in actual_names, f"Unexpected state {name} found in WorkOrderState"


# ===================================================================
# Rejection reason accessor
# ===================================================================

class TestRejectionReasonAccessor:
    """Verify rejection reason is accessible only in REJECTED state."""

    def test_no_rejection_reason_in_pending(self, pending_sm):
        """PENDING state has no rejection reason."""
        assert pending_sm.get_rejection_reason() is None

    def test_no_rejection_reason_in_approving_level_1(self, approving_l1_sm):
        """APPROVING_LEVEL_1 state has no rejection reason."""
        assert approving_l1_sm.get_rejection_reason() is None

    def test_no_rejection_reason_in_approving_level_2(self, approving_l2_sm):
        """APPROVING_LEVEL_2 state has no rejection reason."""
        assert approving_l2_sm.get_rejection_reason() is None

    def test_no_rejection_reason_in_approved(self, approved_sm):
        """APPROVED state has no rejection reason."""
        assert approved_sm.get_rejection_reason() is None

    def test_rejection_reason_available_after_reject(self, approving_l1_sm):
        """REJECTED state exposes the rejection reason that was provided."""
        reason = "材料不齐"
        approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l1_sm.get_rejection_reason() == reason

    def test_rejection_reason_preserves_unicode(self, approving_l2_sm):
        """Rejection reason with Unicode characters is preserved exactly."""
        reason = "资产编号「ABC-123」与系统记录不符，请核实后重新提交。"
        approving_l2_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l2_sm.get_rejection_reason() == reason

    def test_no_rejection_reason_in_cancelled(self, cancelled_sm):
        """CANCELLED state has no rejection reason."""
        assert cancelled_sm.get_rejection_reason() is None