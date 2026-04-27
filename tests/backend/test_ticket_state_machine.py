"""
Tests for the Ticket State Machine — Multi-Level Approval Flow.

Validates the multi-level approval state machine as per SPEC Phase 1:
  - ATB-1: Forward transitions  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  - ATB-2: Rejection transitions with mandatory rejectionReason (max 500 chars)
  - ATB-3: Illegal state transition interception (no skipping levels, error code INVALID_STATE_TRANSITION)

Additional coverage:
  - CANCELLED state transitions from valid intermediate states
  - Terminal-state immutability (APPROVED / REJECTED / CANCELLED)
  - Optimistic locking via version field
  - Approval record generation (operator, action, timestamp, rejection reason)
"""

import pytest
from datetime import datetime

from backend.state_machine.ticket_state_machine import (
    TicketState,
    TicketStateMachine,
    StateTransitionException,
    RejectionReasonRequiredError,
    RejectionReasonTooLongError,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def pending_sm():
    """Return a TicketStateMachine initialised in PENDING state (version=0)."""
    return TicketStateMachine(initial_state=TicketState.PENDING, version=0)


@pytest.fixture
def approving_l1_sm():
    """Return a TicketStateMachine initialised in APPROVING_LEVEL_1 state."""
    return TicketStateMachine(initial_state=TicketState.APPROVING_LEVEL_1, version=1)


@pytest.fixture
def approving_l2_sm():
    """Return a TicketStateMachine initialised in APPROVING_LEVEL_2 state."""
    return TicketStateMachine(initial_state=TicketState.APPROVING_LEVEL_2, version=2)


@pytest.fixture
def approved_sm():
    """Return a TicketStateMachine in APPROVED (terminal) state."""
    return TicketStateMachine(initial_state=TicketState.APPROVED, version=3)


@pytest.fixture
def rejected_sm():
    """Return a TicketStateMachine in REJECTED (terminal) state."""
    return TicketStateMachine(initial_state=TicketState.REJECTED, version=1)


@pytest.fixture
def cancelled_sm():
    """Return a TicketStateMachine in CANCELLED (terminal) state."""
    return TicketStateMachine(initial_state=TicketState.CANCELLED, version=1)


# ===========================================================================
# ATB-1: Forward State Transition Tests
# ===========================================================================

class TestForwardTransitions:
    """ATB-1: Verify the happy-path forward flow PENDING → APPROVED."""

    def test_submit_from_pending(self, pending_sm):
        """SUBMIT event transitions PENDING → APPROVING_LEVEL_1."""
        result = pending_sm.trigger("SUBMIT")
        assert pending_sm.current_state == TicketState.APPROVING_LEVEL_1
        assert result is True
        assert pending_sm.version == 1

    def test_approve_from_level_1(self, approving_l1_sm):
        """APPROVE event transitions APPROVING_LEVEL_1 → APPROVING_LEVEL_2."""
        result = approving_l1_sm.trigger("APPROVE")
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_2
        assert result is True
        assert approving_l1_sm.version == 2

    def test_approve_from_level_2(self, approving_l2_sm):
        """APPROVE event transitions APPROVING_LEVEL_2 → APPROVED."""
        result = approving_l2_sm.trigger("APPROVE")
        assert approving_l2_sm.current_state == TicketState.APPROVED
        assert result is True
        assert approving_l2_sm.version == 3

    def test_full_forward_flow(self):
        """Complete forward flow: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        sm = TicketStateMachine(initial_state=TicketState.PENDING, version=0)

        sm.trigger("SUBMIT")
        assert sm.current_state == TicketState.APPROVING_LEVEL_1

        sm.trigger("APPROVE")
        assert sm.current_state == TicketState.APPROVING_LEVEL_2

        sm.trigger("APPROVE")
        assert sm.current_state == TicketState.APPROVED

        assert sm.version == 3

    def test_version_increments_on_each_successful_transition(self):
        """Version must increment by 1 on each successful state transition."""
        sm = TicketStateMachine(initial_state=TicketState.PENDING, version=0)
        assert sm.version == 0

        sm.trigger("SUBMIT")
        assert sm.version == 1

        sm.trigger("APPROVE")
        assert sm.version == 2

        sm.trigger("APPROVE")
        assert sm.version == 3


# ===========================================================================
# ATB-2: Rejection (Reverse) State Transition Tests
# ===========================================================================

class TestRejectionTransitions:
    """ATB-2: Verify rejection flow and rejectionReason validation."""

    def test_reject_from_approving_level_1_with_reason(self, approving_l1_sm):
        """REJECT from APPROVING_LEVEL_1 with valid reason → REJECTED."""
        result = approving_l1_sm.trigger(
            "REJECT", operator_id="mgr_001", rejection_reason="不合规"
        )
        assert approving_l1_sm.current_state == TicketState.REJECTED
        assert result is True

    def test_reject_from_approving_level_2_with_reason(self, approving_l2_sm):
        """REJECT from APPROVING_LEVEL_2 with valid reason → REJECTED."""
        result = approving_l2_sm.trigger(
            "REJECT", operator_id="admin_001", rejection_reason="资产信息不符"
        )
        assert approving_l2_sm.current_state == TicketState.REJECTED
        assert result is True

    def test_reject_without_reason_raises_error(self, approving_l1_sm):
        """REJECT without rejectionReason must raise RejectionReasonRequiredError (→ HTTP 400)."""
        with pytest.raises(RejectionReasonRequiredError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001")
        # State must remain unchanged
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_reject_with_empty_reason_raises_error(self, approving_l1_sm):
        """REJECT with empty-string rejectionReason must raise RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason="")
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_reject_with_whitespace_only_reason_raises_error(self, approving_l1_sm):
        """REJECT with whitespace-only rejectionReason must raise RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason="   ")
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_reject_with_reason_exceeding_500_chars_raises_error(self, approving_l1_sm):
        """REJECT with rejectionReason > 500 chars must raise RejectionReasonTooLongError."""
        long_reason = "x" * 501
        with pytest.raises(RejectionReasonTooLongError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason=long_reason)
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_reject_with_exactly_500_char_reason_succeeds(self, approving_l1_sm):
        """REJECT with rejectionReason exactly 500 chars should succeed."""
        reason = "x" * 500
        result = approving_l1_sm.trigger(
            "REJECT", operator_id="mgr_001", rejection_reason=reason
        )
        assert approving_l1_sm.current_state == TicketState.REJECTED
        assert result is True

    def test_reject_preserves_rejection_reason(self, approving_l1_sm):
        """After rejection, the rejection reason must be retrievable from the state machine."""
        approving_l1_sm.trigger(
            "REJECT", operator_id="mgr_001", rejection_reason="不合规"
        )
        assert approving_l1_sm.rejection_reason == "不合规"

    def test_reject_from_level_2_preserves_reason(self, approving_l2_sm):
        """Rejection reason is preserved when rejecting from APPROVING_LEVEL_2."""
        approving_l2_sm.trigger(
            "REJECT", operator_id="admin_001", rejection_reason="资产信息不符"
        )
        assert approving_l2_sm.rejection_reason == "资产信息不符"


# ===========================================================================
# ATB-3: Illegal State Transition Interception Tests
# ===========================================================================

class TestIllegalTransitions:
    """ATB-3: Verify that illegal state transitions are blocked with INVALID_STATE_TRANSITION."""

    def test_approve_from_pending_is_illegal(self, pending_sm):
        """APPROVE from PENDING must raise StateTransitionException — cannot skip SUBMIT."""
        with pytest.raises(StateTransitionException) as exc_info:
            pending_sm.trigger("APPROVE")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert pending_sm.current_state == TicketState.PENDING

    def test_reject_from_pending_is_illegal(self, pending_sm):
        """REJECT from PENDING must raise StateTransitionException — no approval node active."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("REJECT", rejection_reason="some reason")
        assert pending_sm.current_state == TicketState.PENDING

    def test_submit_from_approving_level_1_is_illegal(self, approving_l1_sm):
        """SUBMIT from APPROVING_LEVEL_1 must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approving_l1_sm.trigger("SUBMIT")
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_submit_from_approving_level_2_is_illegal(self, approving_l2_sm):
        """SUBMIT from APPROVING_LEVEL_2 must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approving_l2_sm.trigger("SUBMIT")
        assert approving_l2_sm.current_state == TicketState.APPROVING_LEVEL_2

    def test_approve_from_approved_is_illegal(self, approved_sm):
        """APPROVE from APPROVED (terminal) must raise StateTransitionException."""
        with pytest.raises(StateTransitionException) as exc_info:
            approved_sm.trigger("APPROVE")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert approved_sm.current_state == TicketState.APPROVED

    def test_reject_from_approved_is_illegal(self, approved_sm):
        """REJECT from APPROVED (terminal) must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("REJECT", rejection_reason="too late")
        assert approved_sm.current_state == TicketState.APPROVED

    def test_any_event_from_rejected_is_illegal(self, rejected_sm):
        """REJECTED is terminal; any event must raise StateTransitionException."""
        for event in ["SUBMIT", "APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                if event == "REJECT":
                    rejected_sm.trigger(event, rejection_reason="reason")
                else:
                    rejected_sm.trigger(event)
        assert rejected_sm.current_state == TicketState.REJECTED

    def test_any_event_from_cancelled_is_illegal(self, cancelled_sm):
        """CANCELLED is terminal; any event must raise StateTransitionException."""
        for event in ["SUBMIT", "APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                if event == "REJECT":
                    cancelled_sm.trigger(event, rejection_reason="reason")
                else:
                    cancelled_sm.trigger(event)
        assert cancelled_sm.current_state == TicketState.CANCELLED

    def test_no_skip_from_pending_to_approving_level_2(self, pending_sm):
        """Cannot skip APPROVING_LEVEL_1; PENDING → APPROVING_LEVEL_2 is illegal."""
        with pytest.raises(StateTransitionException) as exc_info:
            pending_sm.trigger("APPROVE")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert pending_sm.current_state == TicketState.PENDING

    def test_illegal_transition_does_not_change_version(self, pending_sm):
        """Failed transition must not increment the version."""
        initial_version = pending_sm.version
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE")
        assert pending_sm.version == initial_version

    def test_illegal_reject_does_not_change_version(self, pending_sm):
        """Failed REJECT from PENDING must not increment the version."""
        initial_version = pending_sm.version
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("REJECT", rejection_reason="reason")
        assert pending_sm.version == initial_version


# ===========================================================================
# CANCEL Transitions
# ===========================================================================

class TestCancelTransitions:
    """Verify CANCEL transitions from valid intermediate states."""

    def test_cancel_from_pending(self, pending_sm):
        """CANCEL from PENDING → CANCELLED."""
        result = pending_sm.trigger("CANCEL")
        assert pending_sm.current_state == TicketState.CANCELLED
        assert result is True

    def test_cancel_from_approving_level_1(self, approving_l1_sm):
        """CANCEL from APPROVING_LEVEL_1 → CANCELLED."""
        result = approving_l1_sm.trigger("CANCEL")
        assert approving_l1_sm.current_state == TicketState.CANCELLED
        assert result is True

    def test_cancel_from_approving_level_2(self, approving_l2_sm):
        """CANCEL from APPROVING_LEVEL_2 → CANCELLED."""
        result = approving_l2_sm.trigger("CANCEL")
        assert approving_l2_sm.current_state == TicketState.CANCELLED
        assert result is True

    def test_cancel_from_approved_is_illegal(self, approved_sm):
        """CANCEL from APPROVED (terminal) must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approved_sm.trigger("CANCEL")
        assert approved_sm.current_state == TicketState.APPROVED

    def test_cancel_from_rejected_is_illegal(self, rejected_sm):
        """CANCEL from REJECTED (terminal) must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            rejected_sm.trigger("CANCEL")
        assert rejected_sm.current_state == TicketState.REJECTED

    def test_cancel_increments_version(self, pending_sm):
        """CANCEL transition must increment the version."""
        v_before = pending_sm.version
        pending_sm.trigger("CANCEL")
        assert pending_sm.version == v_before + 1


# ===========================================================================
# Optimistic Locking Tests
# ===========================================================================

class TestOptimisticLocking:
    """Verify version-based optimistic locking behaviour (SPEC concurrency constraint)."""

    def test_version_increments_on_successful_transition(self, pending_sm):
        """Version increments by 1 on each successful transition."""
        v0 = pending_sm.version
        pending_sm.trigger("SUBMIT")
        assert pending_sm.version == v0 + 1

    def test_version_unchanged_on_failed_transition(self, approving_l1_sm):
        """Version stays the same when a transition fails."""
        v_before = approving_l1_sm.version
        with pytest.raises(RejectionReasonRequiredError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001")
        assert approving_l1_sm.version == v_before

    def test_expected_version_mismatch_raises_error(self):
        """Triggering with a stale expected_version must raise StateTransitionException (→ HTTP 409)."""
        sm = TicketStateMachine(initial_state=TicketState.PENDING, version=0)
        sm.trigger("SUBMIT")  # version becomes 1

        # Attempt to approve with stale expected_version=0
        with pytest.raises(StateTransitionException) as exc_info:
            sm.trigger("APPROVE", expected_version=0)
        assert exc_info.value.error_code == "VERSION_CONFLICT"

    def test_expected_version_match_succeeds(self):
        """Triggering with the correct expected_version must succeed."""
        sm = TicketStateMachine(initial_state=TicketState.PENDING, version=0)
        sm.trigger("SUBMIT")  # version becomes 1

        # Approve with correct expected_version=1
        result = sm.trigger("APPROVE", expected_version=1)
        assert result is True
        assert sm.current_state == TicketState.APPROVING_LEVEL_2


# ===========================================================================
# Approval Record Generation Tests
# ===========================================================================

class TestApprovalRecords:
    """Verify that state transitions generate proper approval records for audit trail."""

    def test_submit_generates_record(self, pending_sm):
        """SUBMIT transition should generate an approval record."""
        pending_sm.trigger("SUBMIT", operator_id="user_001")
        records = pending_sm.get_approval_records()
        assert len(records) == 1
        assert records[0]["action"] == "SUBMIT"
        assert records[0]["operator_id"] == "user_001"
        assert records[0]["from_state"] == TicketState.PENDING
        assert records[0]["to_state"] == TicketState.APPROVING_LEVEL_1

    def test_approve_generates_record(self, approving_l1_sm):
        """APPROVE transition should generate an approval record."""
        approving_l1_sm.trigger("APPROVE", operator_id="manager_001")
        records = approving_l1_sm.get_approval_records()
        assert len(records) == 1
        assert records[0]["action"] == "APPROVE"
        assert records[0]["operator_id"] == "manager_001"
        assert records[0]["from_state"] == TicketState.APPROVING_LEVEL_1
        assert records[0]["to_state"] == TicketState.APPROVING_LEVEL_2

    def test_reject_generates_record_with_reason(self, approving_l1_sm):
        """REJECT transition should generate a record including the rejection reason."""
        approving_l1_sm.trigger(
            "REJECT", operator_id="manager_001", rejection_reason="不合规"
        )
        records = approving_l1_sm.get_approval_records()
        assert len(records) == 1
        assert records[0]["action"] == "REJECT"
        assert records[0]["operator_id"] == "manager_001"
        assert records[0]["rejection_reason"] == "不合规"
        assert records[0]["from_state"] == TicketState.APPROVING_LEVEL_1
        assert records[0]["to_state"] == TicketState.REJECTED

    def test_full_forward_flow_generates_three_records(self):
        """Complete forward flow should accumulate 3 approval records."""
        sm = TicketStateMachine(initial_state=TicketState.PENDING, version=0)
        sm.trigger("SUBMIT", operator_id="user_001")
        sm.trigger("APPROVE", operator_id="manager_001")
        sm.trigger("APPROVE", operator_id="admin_001")
        records = sm.get_approval_records()
        assert len(records) == 3
        assert records[0]["action"] == "SUBMIT"
        assert records[1]["action"] == "APPROVE"
        assert records[2]["action"] == "APPROVE"

    def test_record_contains_iso8601_timestamp(self, pending_sm):
        """Each approval record must contain a timestamp in ISO 8601 format."""
        pending_sm.trigger("SUBMIT", operator_id="user_001")
        records = pending_sm.get_approval_records()
        assert len(records) == 1
        ts = records[0]["timestamp"]
        assert ts is not None
        # Verify ISO 8601 format by parsing
        datetime.fromisoformat(ts)

    def test_cancel_generates_record(self, pending_sm):
        """CANCEL transition should generate an approval record."""
        pending_sm.trigger("CANCEL", operator_id="user_001")
        records = pending_sm.get_approval_records()
        assert len(records) == 1
        assert records[0]["action"] == "CANCEL"
        assert records[0]["from_state"] == TicketState.PENDING
        assert records[0]["to_state"] == TicketState.CANCELLED

    def test_failed_transition_generates_no_record(self, pending_sm):
        """A failed transition must not produce an approval record."""
        initial_count = len(pending_sm.get_approval_records())
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("APPROVE")
        assert len(pending_sm.get_approval_records()) == initial_count


# ===========================================================================
# TicketState Enum Tests
# ===========================================================================

class TestTicketStateEnum:
    """Verify TicketState enum values match SPEC requirements."""

    def test_all_required_states_defined(self):
        """All six required states must be present in the enum."""
        required_states = [
            "PENDING",
            "APPROVING_LEVEL_1",
            "APPROVING_LEVEL_2",
            "APPROVED",
            "REJECTED",
            "CANCELLED",
        ]
        for state_name in required_states:
            assert hasattr(TicketState, state_name), f"Missing state: {state_name}"

    def test_state_values_are_uppercase_strings(self):
        """State enum values should be uppercase string representations."""
        assert TicketState.PENDING.value == "PENDING"
        assert TicketState.APPROVING_LEVEL_1.value == "APPROVING_LEVEL_1"
        assert TicketState.APPROVING_LEVEL_2.value == "APPROVING_LEVEL_2"
        assert TicketState.APPROVED.value == "APPROVED"
        assert TicketState.REJECTED.value == "REJECTED"
        assert TicketState.CANCELLED.value == "CANCELLED"

    def test_exactly_six_states(self):
        """The enum must define exactly the six states required by the SPEC."""
        assert len(TicketState) == 6


# ===========================================================================
# Edge Cases & Robustness
# ===========================================================================

class TestEdgeCases:
    """Edge-case and robustness tests for the ticket state machine."""

    def test_reject_with_none_reason_raises_error(self, approving_l1_sm):
        """REJECT with rejection_reason=None must raise RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason=None)
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_reject_with_non_string_reason_raises_error(self, approving_l1_sm):
        """REJECT with a non-string rejection_reason must raise RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason=12345)
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1

    def test_unknown_event_raises_error(self, pending_sm):
        """Triggering an unrecognised event must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            pending_sm.trigger("UNKNOWN_EVENT")
        assert pending_sm.current_state == TicketState.PENDING

    def test_state_machine_initial_state_default(self):
        """Default initial state should be PENDING with version 0."""
        sm = TicketStateMachine()
        assert sm.current_state == TicketState.PENDING
        assert sm.version == 0

    def test_state_machine_custom_initial_state(self):
        """State machine can be initialised with a custom state and version."""
        sm = TicketStateMachine(initial_state=TicketState.APPROVING_LEVEL_2, version=5)
        assert sm.current_state == TicketState.APPROVING_LEVEL_2
        assert sm.version == 5

    def test_submit_from_approving_level_2_is_illegal(self, approving_l2_sm):
        """SUBMIT from APPROVING_LEVEL_2 must raise StateTransitionException."""
        with pytest.raises(StateTransitionException):
            approving_l2_sm.trigger("SUBMIT")
        assert approving_l2_sm.current_state == TicketState.APPROVING_LEVEL_2

    def test_rejection_reason_with_unicode_succeeds(self, approving_l1_sm):
        """REJECT with Unicode characters in rejection_reason should succeed."""
        reason = "驳回原因：资产编号#A-001与系统记录不符，请核实后重新提交。"
        result = approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason=reason)
        assert approving_l1_sm.current_state == TicketState.REJECTED
        assert result is True
        assert approving_l1_sm.rejection_reason == reason

    def test_rejection_reason_at_boundary_500_with_multibyte(self, approving_l1_sm):
        """REJECT reason length limit is 500 characters (not bytes); multibyte chars count as 1 each."""
        # 500 CJK characters — each is 1 character but 3 bytes in UTF-8
        reason = "中" * 500
        result = approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason=reason)
        assert approving_l1_sm.current_state == TicketState.REJECTED
        assert result is True

    def test_rejection_reason_over_500_with_multibyte_raises_error(self, approving_l1_sm):
        """REJECT reason exceeding 500 characters with multibyte chars must raise error."""
        reason = "中" * 501
        with pytest.raises(RejectionReasonTooLongError):
            approving_l1_sm.trigger("REJECT", operator_id="mgr_001", rejection_reason=reason)
        assert approving_l1_sm.current_state == TicketState.APPROVING_LEVEL_1