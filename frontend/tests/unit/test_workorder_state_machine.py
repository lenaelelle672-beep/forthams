"""
Unit tests for the Work Order State Machine (multi-level approval flow).

Validates the state transition rules for the two-level approval workflow:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

With rejection paths:
    APPROVING_LEVEL_1 → REJECTED
    APPROVING_LEVEL_2 → REJECTED

And cancellation:
    PENDING → CANCELLED

Covers:
    - ATB-1: Forward (positive) state transitions
    - ATB-2: Rejection (negative) transitions with mandatory rejectionReason
    - ATB-3: Illegal / level-skipping transition interception
    - Rejection reason validation (non-empty, max 500 chars)
    - Terminal state immutability (APPROVED, REJECTED, CANCELLED)
"""

from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# Domain imports – the classes under test
# ---------------------------------------------------------------------------
from backend.state_machine.workorder_state_machine import (
    WorkOrderStateMachine,
)
from backend.state_machine.workorder_state import WorkOrderState
from backend.state_machine.machine import StateTransitionException


# ===========================================================================
# Fixtures
# ===========================================================================


@pytest.fixture
def pending_sm() -> WorkOrderStateMachine:
    """Return a WorkOrderStateMachine in PENDING state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)


@pytest.fixture
def approving_l1_sm() -> WorkOrderStateMachine:
    """Return a WorkOrderStateMachine in APPROVING_LEVEL_1 state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVING_LEVEL_1)


@pytest.fixture
def approving_l2_sm() -> WorkOrderStateMachine:
    """Return a WorkOrderStateMachine in APPROVING_LEVEL_2 state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVING_LEVEL_2)


@pytest.fixture
def approved_sm() -> WorkOrderStateMachine:
    """Return a WorkOrderStateMachine in APPROVED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.APPROVED)


@pytest.fixture
def rejected_sm() -> WorkOrderStateMachine:
    """Return a WorkOrderStateMachine in REJECTED state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.REJECTED)


@pytest.fixture
def cancelled_sm() -> WorkOrderStateMachine:
    """Return a WorkOrderStateMachine in CANCELLED (terminal) state."""
    return WorkOrderStateMachine(initial_state=WorkOrderState.CANCELLED)


# ===========================================================================
# ATB-1: Forward (positive) state transitions
# PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
# ===========================================================================


class TestForwardTransitions:
    """ATB-1: Validate the happy-path forward state transitions."""

    def test_approve_level_1_from_pending(self, pending_sm: WorkOrderStateMachine) -> None:
        """APPROVE event: PENDING → APPROVING_LEVEL_1."""
        result = pending_sm.trigger("APPROVE_LEVEL_1")
        assert result is True
        assert pending_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_approve_level_2_from_approving_l1(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """APPROVE event: APPROVING_LEVEL_1 → APPROVING_LEVEL_2."""
        result = approving_l1_sm.trigger("APPROVE_LEVEL_2")
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

    def test_final_approve_from_approving_l2(self, approving_l2_sm: WorkOrderStateMachine) -> None:
        """APPROVE event: APPROVING_LEVEL_2 → APPROVED."""
        result = approving_l2_sm.trigger("FINAL_APPROVE")
        assert result is True
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVED

    def test_full_forward_flow(self) -> None:
        """End-to-end: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        sm = WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)

        sm.trigger("APPROVE_LEVEL_1")
        assert sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

        sm.trigger("APPROVE_LEVEL_2")
        assert sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

        sm.trigger("FINAL_APPROVE")
        assert sm.get_current_state() == WorkOrderState.APPROVED


# ===========================================================================
# ATB-2: Rejection (negative) transitions with mandatory rejectionReason
# ===========================================================================


class TestRejectionTransitions:
    """ATB-2: Validate rejection transitions and rejectionReason enforcement."""

    def test_reject_from_approving_level_1(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT event: APPROVING_LEVEL_1 → REJECTED (with reason)."""
        result = approving_l1_sm.trigger("REJECT", rejection_reason="不合规")
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_from_approving_level_2(self, approving_l2_sm: WorkOrderStateMachine) -> None:
        """REJECT event: APPROVING_LEVEL_2 → REJECTED (with reason)."""
        result = approving_l2_sm.trigger("REJECT", rejection_reason="资产信息有误")
        assert result is True
        assert approving_l2_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_without_reason_raises_error(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT without rejectionReason must raise ValueError (HTTP 400 analogue)."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT")
        # State must remain unchanged
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_empty_reason_raises_error(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT with empty-string rejectionReason must raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason="")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_whitespace_only_reason_raises_error(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT with whitespace-only rejectionReason must raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason="   ")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_reason_exceeding_500_chars_raises_error(
        self, approving_l1_sm: WorkOrderStateMachine
    ) -> None:
        """REJECT with rejectionReason > 500 characters must raise ValueError."""
        long_reason = "A" * 501
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason=long_reason)
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_reject_with_exactly_500_char_reason_succeeds(
        self, approving_l1_sm: WorkOrderStateMachine
    ) -> None:
        """REJECT with rejectionReason exactly 500 characters must succeed."""
        reason = "B" * 500
        result = approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_from_approving_l2_without_reason_raises_error(
        self, approving_l2_sm: WorkOrderStateMachine
    ) -> None:
        """REJECT from APPROVING_LEVEL_2 without reason must also raise ValueError."""
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l2_sm.trigger("REJECT")
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2


# ===========================================================================
# ATB-3: Illegal / level-skipping transition interception
# ===========================================================================


class TestIllegalTransitions:
    """ATB-3: Validate that illegal state transitions are blocked.

    The state machine must prevent:
      - Level-skipping (e.g., PENDING → APPROVING_LEVEL_2)
      - Transitions from terminal states
      - Rejection from non-approval states
      - Any undefined transition
    """

    # -- Level-skipping prevention ------------------------------------------

    def test_skip_from_pending_to_approving_level_2(self, pending_sm: WorkOrderStateMachine) -> None:
        """PENDING → APPROVING_LEVEL_2 is illegal (skips level 1)."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE_LEVEL_2")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_skip_from_pending_to_approved(self, pending_sm: WorkOrderStateMachine) -> None:
        """PENDING → APPROVED is illegal (skips both levels)."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("FINAL_APPROVE")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_skip_from_approving_l1_to_approved(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """APPROVING_LEVEL_1 → APPROVED is illegal (skips level 2)."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("FINAL_APPROVE")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    # -- Rejection from non-approval states ---------------------------------

    def test_reject_from_pending_is_illegal(self, pending_sm: WorkOrderStateMachine) -> None:
        """REJECT from PENDING is illegal – only approval nodes can reject."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("REJECT", rejection_reason="不允许")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    # -- Terminal state immutability ----------------------------------------

    def test_approved_is_terminal(self, approved_sm: WorkOrderStateMachine) -> None:
        """APPROVED is a terminal state; any event raises StateTransitionException."""
        for event in ["APPROVE_LEVEL_1", "APPROVE_LEVEL_2", "FINAL_APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                approved_sm.trigger(event, rejection_reason="理由" if event == "REJECT" else None)
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_rejected_is_terminal(self, rejected_sm: WorkOrderStateMachine) -> None:
        """REJECTED is a terminal state; any event raises StateTransitionException."""
        for event in ["APPROVE_LEVEL_1", "APPROVE_LEVEL_2", "FINAL_APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                rejected_sm.trigger(event, rejection_reason="理由" if event == "REJECT" else None)
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED

    def test_cancelled_is_terminal(self, cancelled_sm: WorkOrderStateMachine) -> None:
        """CANCELLED is a terminal state; any event raises StateTransitionException."""
        for event in ["APPROVE_LEVEL_1", "APPROVE_LEVEL_2", "FINAL_APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                cancelled_sm.trigger(event, rejection_reason="理由" if event == "REJECT" else None)
        assert cancelled_sm.get_current_state() == WorkOrderState.CANCELLED

    # -- Reverse / nonsensical transitions ----------------------------------

    def test_approve_level_1_from_approving_l2(self, approving_l2_sm: WorkOrderStateMachine) -> None:
        """APPROVE_LEVEL_1 from APPROVING_LEVEL_2 is illegal (reverse flow)."""
        with pytest.raises(StateTransitionException):
            approving_l2_sm.trigger("APPROVE_LEVEL_1")
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

    def test_approve_level_1_from_approved(self, approved_sm: WorkOrderStateMachine) -> None:
        """APPROVE_LEVEL_1 from APPROVED is illegal."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("APPROVE_LEVEL_1")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_approve_level_2_from_pending(self, pending_sm: WorkOrderStateMachine) -> None:
        """APPROVE_LEVEL_2 from PENDING is illegal (must go through level 1 first)."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE_LEVEL_2")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_approve_level_2_from_approved(self, approved_sm: WorkOrderStateMachine) -> None:
        """APPROVE_LEVEL_2 from APPROVED is illegal."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("APPROVE_LEVEL_2")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED


# ===========================================================================
# Cancellation transitions
# ===========================================================================


class TestCancellationTransitions:
    """Validate CANCEL transitions: only PENDING → CANCELLED is legal."""

    def test_cancel_from_pending(self, pending_sm: WorkOrderStateMachine) -> None:
        """CANCEL event: PENDING → CANCELLED."""
        result = pending_sm.trigger("CANCEL")
        assert result is True
        assert pending_sm.get_current_state() == WorkOrderState.CANCELLED

    def test_cancel_from_approving_l1_is_illegal(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """CANCEL from APPROVING_LEVEL_1 is illegal (already in approval flow)."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("CANCEL")
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_cancel_from_approving_l2_is_illegal(self, approving_l2_sm: WorkOrderStateMachine) -> None:
        """CANCEL from APPROVING_LEVEL_2 is illegal (already in approval flow)."""
        with pytest.raises(StateTransitionException):
            approving_l2_sm.trigger("CANCEL")
        assert approving_l2_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_2

    def test_cancel_from_approved_is_illegal(self, approved_sm: WorkOrderStateMachine) -> None:
        """CANCEL from APPROVED is illegal (terminal state)."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("CANCEL")
        assert approved_sm.get_current_state() == WorkOrderState.APPROVED

    def test_cancel_from_rejected_is_illegal(self, rejected_sm: WorkOrderStateMachine) -> None:
        """CANCEL from REJECTED is illegal (terminal state)."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("CANCEL")
        assert rejected_sm.get_current_state() == WorkOrderState.REJECTED

    def test_cancel_from_cancelled_is_illegal(self, cancelled_sm: WorkOrderStateMachine) -> None:
        """CANCEL from CANCELLED is illegal (already terminal)."""
        with pytest.raises(StateTransitionException):
            cancelled_sm.trigger("CANCEL")
        assert cancelled_sm.get_current_state() == WorkOrderState.CANCELLED


# ===========================================================================
# State machine idempotency / state preservation on failure
# ===========================================================================


class TestStatePreservationOnFailure:
    """Ensure that a failed transition does not mutate the current state."""

    def test_state_unchanged_after_illegal_transition(self, pending_sm: WorkOrderStateMachine) -> None:
        """After an illegal transition attempt, the state must remain PENDING."""
        original_state = pending_sm.get_current_state()
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("FINAL_APPROVE")
        assert pending_sm.get_current_state() == original_state

    def test_state_unchanged_after_reject_without_reason(
        self, approving_l2_sm: WorkOrderStateMachine
    ) -> None:
        """After a failed REJECT (no reason), state must remain APPROVING_LEVEL_2."""
        original_state = approving_l2_sm.get_current_state()
        with pytest.raises(ValueError):
            approving_l2_sm.trigger("REJECT")
        assert approving_l2_sm.get_current_state() == original_state

    def test_state_unchanged_after_reject_oversized_reason(
        self, approving_l1_sm: WorkOrderStateMachine
    ) -> None:
        """After a failed REJECT (reason too long), state must remain APPROVING_LEVEL_1."""
        original_state = approving_l1_sm.get_current_state()
        with pytest.raises(ValueError):
            approving_l1_sm.trigger("REJECT", rejection_reason="X" * 501)
        assert approving_l1_sm.get_current_state() == original_state


# ===========================================================================
# Optimistic locking (version) support
# ===========================================================================


class TestOptimisticLocking:
    """Validate that the state machine tracks a version field for optimistic locking."""

    def test_initial_version_is_zero(self) -> None:
        """A new state machine should start at version 0."""
        sm = WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)
        assert sm.get_version() == 0

    def test_version_increments_on_successful_transition(self) -> None:
        """Each successful transition must increment the version by 1."""
        sm = WorkOrderStateMachine(initial_state=WorkOrderState.PENDING)
        assert sm.get_version() == 0

        sm.trigger("APPROVE_LEVEL_1")
        assert sm.get_version() == 1

        sm.trigger("APPROVE_LEVEL_2")
        assert sm.get_version() == 2

        sm.trigger("FINAL_APPROVE")
        assert sm.get_version() == 3

    def test_version_unchanged_on_failed_transition(self, pending_sm: WorkOrderStateMachine) -> None:
        """A failed transition must not increment the version."""
        original_version = pending_sm.get_version()
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("FINAL_APPROVE")
        assert pending_sm.get_version() == original_version

    def test_version_increments_on_rejection(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """A successful rejection must also increment the version."""
        original_version = approving_l1_sm.get_version()
        approving_l1_sm.trigger("REJECT", rejection_reason="不合规")
        assert approving_l1_sm.get_version() == original_version + 1

    def test_version_increments_on_cancellation(self, pending_sm: WorkOrderStateMachine) -> None:
        """A successful cancellation must also increment the version."""
        original_version = pending_sm.get_version()
        pending_sm.trigger("CANCEL")
        assert pending_sm.get_version() == original_version + 1


# ===========================================================================
# Edge cases
# ===========================================================================


class TestEdgeCases:
    """Miscellaneous edge-case coverage."""

    def test_reject_with_unicode_reason(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT with CJK / Unicode rejectionReason must succeed."""
        result = approving_l1_sm.trigger("REJECT", rejection_reason="审批不通过：资产编号与系统记录不一致")
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_with_exactly_500_unicode_chars(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT with exactly 500 Unicode characters must succeed."""
        reason = "审" * 500
        result = approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert result is True
        assert approving_l1_sm.get_current_state() == WorkOrderState.REJECTED

    def test_reject_with_501_unicode_chars_exceeds_limit(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """REJECT with 501 Unicode characters must fail validation."""
        reason = "审" * 501
        with pytest.raises(ValueError, match="rejectionReason"):
            approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l1_sm.get_current_state() == WorkOrderState.APPROVING_LEVEL_1

    def test_get_current_state_returns_enum(self, pending_sm: WorkOrderStateMachine) -> None:
        """get_current_state must return a WorkOrderState enum member."""
        state = pending_sm.get_current_state()
        assert isinstance(state, WorkOrderState)
        assert state == WorkOrderState.PENDING

    def test_trigger_returns_true_on_success(self, pending_sm: WorkOrderStateMachine) -> None:
        """trigger() must return True on a successful transition."""
        result = pending_sm.trigger("APPROVE_LEVEL_1")
        assert result is True

    def test_unknown_event_raises_exception(self, pending_sm: WorkOrderStateMachine) -> None:
        """An unrecognized event string must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("NONEXISTENT_EVENT")
        assert pending_sm.get_current_state() == WorkOrderState.PENDING

    def test_rejection_reason_stored_on_state_machine(self, approving_l1_sm: WorkOrderStateMachine) -> None:
        """After a successful rejection, the rejection reason should be retrievable."""
        reason = "资产信息不完整"
        approving_l1_sm.trigger("REJECT", rejection_reason=reason)
        assert approving_l1_sm.get_rejection_reason() == reason

    def test_rejection_reason_none_before_rejection(self, pending_sm: WorkOrderStateMachine) -> None:
        """Before any rejection, get_rejection_reason must return None."""
        assert pending_sm.get_rejection_reason() is None