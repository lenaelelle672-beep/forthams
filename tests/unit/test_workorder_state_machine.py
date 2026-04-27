"""
Unit tests for WorkOrderStateMachine — multi-level approval state machine.

Covers the state flow required by SPEC Phase 1:
  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  Any approval node → REJECTED (with mandatory rejectionReason)
  PENDING → CANCELLED

Validates:
  - ATB-1: Forward (positive) state transitions
  - ATB-2: Rejection (negative) transitions with rejection reason enforcement
  - ATB-3: Illegal / skip-level transition interception
  - CANCELLED state handling
  - Terminal state immutability
  - Rejection reason length constraint (max 500 chars)
"""

import pytest

from backend.state_machine.workorder_state_machine import (
    WorkOrderStateMachine,
    WorkOrderState,
    StateTransitionException,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def pending_sm():
    """Return a WorkOrderStateMachine in PENDING state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)


@pytest.fixture
def approving_l1_sm():
    """Return a WorkOrderStateMachine in APPROVING_LEVEL_1 state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVING_LEVEL_1)


@pytest.fixture
def approving_l2_sm():
    """Return a WorkOrderStateMachine in APPROVING_LEVEL_2 state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVING_LEVEL_2)


@pytest.fixture
def approved_sm():
    """Return a WorkOrderStateMachine in APPROVED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVED)


@pytest.fixture
def rejected_sm():
    """Return a WorkOrderStateMachine in REJECTED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.REJECTED)


@pytest.fixture
def cancelled_sm():
    """Return a WorkOrderStateMachine in CANCELLED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.CANCELLED)


# ---------------------------------------------------------------------------
# ATB-1: Forward (positive) state transitions
# ---------------------------------------------------------------------------

class TestForwardTransitions:
    """ATB-1: Verify the happy-path forward flow PENDING → APPROVED."""

    def test_pending_to_approving_level_1(self, pending_sm):
        """APPROVE event: PENDING → APPROVING_LEVEL_1."""
        result = pending_sm.trigger("APPROVE")
        assert pending_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1
        assert result is True

    def test_approving_level_1_to_approving_level_2(self, approving_l1_sm):
        """APPROVE event: APPROVING_LEVEL_1 → APPROVING_LEVEL_2."""
        result = approving_l1_sm.trigger("APPROVE")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2
        assert result is True

    def test_approving_level_2_to_approved(self, approving_l2_sm):
        """APPROVE event: APPROVING_LEVEL_2 → APPROVED."""
        result = approving_l2_sm.trigger("APPROVE")
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVED
        assert result is True

    def test_full_forward_flow(self):
        """End-to-end: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        sm = WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)
        sm.trigger("APPROVE")
        assert sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1
        sm.trigger("APPROVE")
        assert sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2
        sm.trigger("APPROVE")
        assert sm.get_current_state() == WorkOrderState.APPROVED


# ---------------------------------------------------------------------------
# ATB-2: Rejection (negative) transitions with rejection reason
# ---------------------------------------------------------------------------

class TestRejectionTransitions:
    """ATB-2: Verify rejection from any approval node with mandatory reason."""

    def test_reject_from_approving_level_1_with_reason(self, approving_l1_sm):
        """REJECT from APPROVING_LEVEL_1 with valid reason → REJECTED."""
        result = approving_l1_sm.trigger("REJECT", rejection_reason="不合规")
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED
        assert result is True

    def test_reject_from_approving_level_2_with_reason(self, approving_l2_sm):
        """REJECT from APPROVING_LEVEL_2 with valid reason → REJECTED."""
        result = approving_l2_sm.trigger("REJECT", rejection_reason="资产信息有误")
        assert approving_l2_sm.get_current_state() == WorkOrderState.REJECTED
        assert result is True

    def test_reject_without_reason_raises_error(self, approving_l1_sm):
        """REJECT without rejectionReason must raise ValueError (maps to HTTP 400)."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT")
        # State must remain unchanged
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_empty_reason_raises_error(self, approving_l1_sm):
        """REJECT with empty rejectionReason must raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason="")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_whitespace_only_reason_raises_error(self, approving_l1_sm):
        """REJECT with whitespace-only rejectionReason must raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason="   ")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_reason_exceeding_500_chars_raises_error(self, approving_l1_sm):
        """REJECT with rejectionReason > 500 chars must raise ValueError."""
        long_reason = "x" * 501
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason=long_reason)
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_reason_at_500_char_limit_succeeds(self, approving_l1_sm):
        """REJECT with rejectionReason exactly 500 chars must succeed."""
        reason = "x" * 500
        result = approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED
        assert result is True

    def test_reject_from_pending_not_allowed(self, pending_sm):
        """REJECT from PENDING state is not a valid transition."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("REJECT", rejection_reason="不允许")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING


# ---------------------------------------------------------------------------
# ATB-3: Illegal / skip-level transition interception
# ---------------------------------------------------------------------------

class TestInvalidTransitions:
    """ATB-3: Verify that illegal transitions raise StateTransitionException."""

    def test_skip_level_pending_to_approving_level_2(self, pending_sm):
        """PENDING → APPROVING_LEVEL_2 is illegal (skip level 1)."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE_LEVEL_2")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_skip_level_pending_to_approved(self, pending_sm):
        """PENDING → APPROVED is illegal (skip all levels)."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE_FINAL")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_skip_level_approving_level_1_to_approved(self, approving_l1_sm):
        """APPROVING_LEVEL_1 → APPROVED is illegal (skip level 2)."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("APPROVE_FINAL")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_invalid_event_on_pending(self, pending_sm):
        """Triggering an unrecognized event on PENDING raises StateTransitionException."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("UNKNOWN_EVENT")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_invalid_event_on_approving_level_1(self, approving_l1_sm):
        """Triggering an unrecognized event on APPROVING_LEVEL_1 raises StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("UNKNOWN_EVENT")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1


# ---------------------------------------------------------------------------
# Terminal state immutability
# ---------------------------------------------------------------------------

class TestTerminalStates:
    """Verify that terminal states reject all transition attempts."""

    @pytest.mark.parametrize(
        "event",
        ["APPROVE", "REJECT", "CANCEL", "APPROVE_LEVEL_2", "APPROVE_FINAL"],
    )
    def test_approved_is_terminal(self, approved_sm, event):
        """APPROVED is terminal; any event raises StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger(event)
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    @pytest.mark.parametrize(
        "event",
        ["APPROVE", "REJECT", "CANCEL", "APPROVE_LEVEL_2", "APPROVE_FINAL"],
    )
    def test_rejected_is_terminal(self, rejected_sm, event):
        """REJECTED is terminal; any event raises StateTransitionException."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger(event, rejection_reason="test")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED

    @pytest.mark.parametrize(
        "event",
        ["APPROVE", "REJECT", "CANCEL", "APPROVE_LEVEL_2", "APPROVE_FINAL"],
    )
    def test_cancelled_is_terminal(self, cancelled_sm, event):
        """CANCELLED is terminal; any event raises StateTransitionException."""
        with pytest.raises(StateTransitionException):
            cancelled_sm.trigger(event)
        assert cancelled_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_rejected_cannot_transition_to_pending(self, rejected_sm):
        """REJECTED → PENDING is illegal (no re-submission from rejected)."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("SUBMIT")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED

    def test_rejected_cannot_transition_to_approving_level_1(self, rejected_sm):
        """REJECTED → APPROVING_LEVEL_1 is illegal."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("APPROVE")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED


# ---------------------------------------------------------------------------
# CANCELLED state transitions
# ---------------------------------------------------------------------------

class TestCancellation:
    """Verify CANCELLED state handling."""

    def test_cancel_from_pending(self, pending_sm):
        """CANCEL event: PENDING → CANCELLED."""
        result = pending_sm.trigger("CANCEL")
        assert pending_sm.get_current_state() == WorkOrderState.CANCELLED
        assert result is True

    def test_cancel_from_approving_level_1(self, approving_l1_sm):
        """CANCEL event: APPROVING_LEVEL_1 → CANCELLED."""
        result = approving_l1_sm.trigger("CANCEL")
        assert approving_l1_sm.get_current_state() == WorkOrderState.CANCELLED
        assert result is True

    def test_cancel_from_approving_level_2(self, approving_l2_sm):
        """CANCEL event: APPROVING_LEVEL_2 → CANCELLED."""
        result = approving_l2_sm.trigger("CANCEL")
        assert approving_l2_sm.get_current_state() == WorkOrderState.CANCELLED
        assert result is True

    def test_cancel_from_approved_not_allowed(self, approved_sm):
        """CANCEL from APPROVED is not allowed (already finalized)."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("CANCEL")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_cancel_from_rejected_not_allowed(self, rejected_sm):
        """CANCEL from REJECTED is not allowed (already finalized)."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("CANCEL")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED


# ---------------------------------------------------------------------------
# State machine identity & query
# ---------------------------------------------------------------------------

class TestStateMachineQueries:
    """Verify state machine query helpers."""

    def test_get_current_state_returns_initial(self, pending_sm):
        """get_current_state returns the initial state."""
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_is_terminal_approved(self, approved_sm):
        """APPROVED is a terminal state."""
        assert approved_sm.is_terminal() is True

    def test_is_terminal_rejected(self, rejected_sm):
        """REJECTED is a terminal state."""
        assert rejected_sm.is_terminal() is True

    def test_is_terminal_cancelled(self, cancelled_sm):
        """CANCELLED is a terminal state."""
        assert cancelled_sm.is_terminal() is True

    def test_is_not_terminal_pending(self, pending_sm):
        """PENDING is not a terminal state."""
        assert pending_sm.is_terminal() is False

    def test_is_not_terminal_approving_level_1(self, approving_l1_sm):
        """APPROVING_LEVEL_1 is not a terminal state."""
        assert approving_l1_sm.is_terminal() is False

    def test_is_not_terminal_approving_level_2(self, approving_l2_sm):
        """APPROVING_LEVEL_2 is not a terminal state."""
        assert approving_l2_sm.is_terminal() is False


# ---------------------------------------------------------------------------
# Rejection reason storage
# ---------------------------------------------------------------------------

class TestRejectionReasonStorage:
    """Verify that the state machine stores the rejection reason on reject."""

    def test_rejection_reason_stored_on_reject(self, approving_l1_sm):
        """After rejection, get_rejection_reason returns the provided reason."""
        reason = "申请材料不完整，请补充后重新提交"
        approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l1_sm.get_rejection_reason() == reason

    def test_rejection_reason_none_when_not_rejected(self, pending_sm):
        """When not in REJECTED state, get_rejection_reason returns None."""
        assert pending_sm.get_rejection_reason() is None

    def test_rejection_reason_none_in_approved(self, approved_sm):
        """When in APPROVED state, get_rejection_reason returns None."""
        assert approved_sm.get_rejection_reason() is None


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Verify edge-case behaviors of the state machine."""

    def test_double_approve_from_approving_level_1(self, approving_l1_sm):
        """Two consecutive APPROVE events from APPROVING_LEVEL_1: first succeeds, second fails."""
        approving_l1_sm.trigger("APPROVE")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2
        # Second APPROVE from APPROVING_LEVEL_2 should succeed (→ APPROVED)
        approving_l1_sm.trigger("APPROVE")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVED

    def test_approve_from_approved_raises(self, approved_sm):
        """APPROVE from APPROVED raises StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("APPROVE")

    def test_reject_with_reason_from_approved_raises(self, approved_sm):
        """REJECT from APPROVED raises StateTransitionException even with reason."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("REJECT", rejection_reason="迟来的驳回")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_state_unchanged_after_invalid_transition(self, approving_l1_sm):
        """After an invalid transition attempt, state remains unchanged."""
        original_state = approving_l1_sm.get_current_state()
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("APPROVE_FINAL")
        assert approving_l1_sm.get_current_state() == original_state