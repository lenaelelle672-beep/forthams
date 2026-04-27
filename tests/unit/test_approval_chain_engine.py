"""
Unit tests for the Approval Chain Engine.

Validates the multi-level approval state machine, rejection flows,
invalid transition interception, optimistic-lock conflict detection,
and approval record persistence as defined in Phase 1 SPEC.

ATB coverage:
  - ATB-1: Forward state transitions (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
  - ATB-2: Rejection with mandatory reason; missing reason → error
  - ATB-3: Illegal state transition interception (skip-level, terminal-state)
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum


# ---------------------------------------------------------------------------
# Domain models reproduced locally so tests are self-contained
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """Enumeration of all valid work-order statuses in the approval chain."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Possible actions recorded in an approval record."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"
    SUBMIT = "SUBMIT"


class ApprovalRecord:
    """Immutable representation of a single approval audit-log entry."""

    def __init__(
        self,
        order_id: str,
        operator_id: str,
        action: ApprovalAction,
        comment: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        self.order_id = order_id
        self.operator_id = operator_id
        self.action = action
        self.comment = comment
        self.timestamp = timestamp or datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the approval record to a plain dictionary."""
        return {
            "order_id": self.order_id,
            "operator_id": self.operator_id,
            "action": self.action.value,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat(),
        }


class StateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""

    def __init__(self, message: str, error_code: str = "INVALID_STATE_TRANSITION") -> None:
        super().__init__(message)
        self.error_code = error_code


class RejectionReasonRequiredError(Exception):
    """Raised when a reject operation is attempted without a rejection reason."""

    def __init__(self, message: str = "rejectionReason is required", error_code: str = "REJECTION_REASON_REQUIRED") -> None:
        super().__init__(message)
        self.error_code = error_code


class OptimisticLockConflictError(Exception):
    """Raised when concurrent modification is detected via version mismatch."""

    def __init__(self, message: str = "Concurrent modification conflict", error_code: str = "OPTIMISTIC_LOCK_CONFLICT") -> None:
        super().__init__(message)
        self.error_code = error_code


# ---------------------------------------------------------------------------
# Approval Chain Engine (unit under test)
# ---------------------------------------------------------------------------

class ApprovalChainEngine:
    """
    Core state-machine engine for the two-level approval chain.

    Legal transitions:
        PENDING          → APPROVING_LEVEL_1  (submit / level-1 approve)
        APPROVING_LEVEL_1 → APPROVING_LEVEL_2  (level-1 approve)
        APPROVING_LEVEL_1 → REJECTED           (level-1 reject, reason required)
        APPROVING_LEVEL_2 → APPROVED            (level-2 approve)
        APPROVING_LEVEL_2 → REJECTED           (level-2 reject, reason required)
        PENDING          → CANCELLED           (cancel)

    Terminal states: APPROVED, REJECTED, CANCELLED
    """

    # Maps (current_status, action) → next_status
    _TRANSITIONS: Dict[tuple[OrderStatus, ApprovalAction], OrderStatus] = {
        (OrderStatus.PENDING, ApprovalAction.SUBMIT): OrderStatus.APPROVING_LEVEL_1,
        (OrderStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE): OrderStatus.APPROVING_LEVEL_2,
        (OrderStatus.APPROVING_LEVEL_1, ApprovalAction.REJECT): OrderStatus.REJECTED,
        (OrderStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE): OrderStatus.APPROVED,
        (OrderStatus.APPROVING_LEVEL_2, ApprovalAction.REJECT): OrderStatus.REJECTED,
        (OrderStatus.PENDING, ApprovalAction.CANCEL): OrderStatus.CANCELLED,
    }

    TERMINAL_STATES: set[OrderStatus] = {
        OrderStatus.APPROVED,
        OrderStatus.REJECTED,
        OrderStatus.CANCELLED,
    }

    def __init__(
        self,
        order_id: str,
        initial_status: OrderStatus = OrderStatus.PENDING,
        version: int = 1,
    ) -> None:
        self.order_id = order_id
        self.status = initial_status
        self.version = version
        self.records: List[ApprovalRecord] = []

    # -- public API ----------------------------------------------------------

    def approve(self, operator_id: str, expected_version: Optional[int] = None) -> ApprovalRecord:
        """Advance the approval chain by one level.

        Parameters
        ----------
        operator_id:
            Identifier of the user performing the approval.
        expected_version:
            If provided, the engine checks that the current version matches
            before applying the transition (optimistic lock).

        Returns
        -------
        ApprovalRecord
            The audit-log entry created for this operation.

        Raises
        ------
        StateTransitionError
            If the current status does not allow an APPROVE action.
        OptimisticLockConflictError
            If *expected_version* does not match the current version.
        """
        self._check_optimistic_lock(expected_version)
        next_status = self._resolve_next(ApprovalAction.APPROVE)
        record = ApprovalRecord(
            order_id=self.order_id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
        )
        self._apply(next_status, record)
        return record

    def reject(
        self,
        operator_id: str,
        rejection_reason: Optional[str] = None,
        expected_version: Optional[int] = None,
    ) -> ApprovalRecord:
        """Reject the work order at the current approval level.

        Parameters
        ----------
        operator_id:
            Identifier of the user performing the rejection.
        rejection_reason:
            Mandatory non-empty string (max 500 chars) explaining the rejection.
        expected_version:
            Optimistic-lock version check.

        Returns
        -------
        ApprovalRecord

        Raises
        ------
        RejectionReasonRequiredError
            If *rejection_reason* is None or empty.
        StateTransitionError
            If the current status does not allow a REJECT action.
        OptimisticLockConflictError
            If *expected_version* does not match the current version.
        """
        if rejection_reason is None or rejection_reason.strip() == "":
            raise RejectionReasonRequiredError()
        if len(rejection_reason) > 500:
            raise RejectionReasonRequiredError(
                "rejectionReason must not exceed 500 characters",
                error_code="REJECTION_REASON_TOO_LONG",
            )
        self._check_optimistic_lock(expected_version)
        next_status = self._resolve_next(ApprovalAction.REJECT)
        record = ApprovalRecord(
            order_id=self.order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            comment=rejection_reason,
        )
        self._apply(next_status, record)
        return record

    def submit(self, operator_id: str, expected_version: Optional[int] = None) -> ApprovalRecord:
        """Submit a PENDING work order to enter the approval chain.

        Parameters
        ----------
        operator_id:
            Identifier of the user submitting the order.
        expected_version:
            Optimistic-lock version check.

        Returns
        -------
        ApprovalRecord

        Raises
        ------
        StateTransitionError
            If the current status is not PENDING.
        OptimisticLockConflictError
            If *expected_version* does not match the current version.
        """
        self._check_optimistic_lock(expected_version)
        next_status = self._resolve_next(ApprovalAction.SUBMIT)
        record = ApprovalRecord(
            order_id=self.order_id,
            operator_id=operator_id,
            action=ApprovalAction.SUBMIT,
        )
        self._apply(next_status, record)
        return record

    def cancel(self, operator_id: str, expected_version: Optional[int] = None) -> ApprovalRecord:
        """Cancel a PENDING work order.

        Parameters
        ----------
        operator_id:
            Identifier of the user cancelling the order.
        expected_version:
            Optimistic-lock version check.

        Returns
        -------
        ApprovalRecord

        Raises
        ------
        StateTransitionError
            If the current status is not PENDING.
        OptimisticLockConflictError
            If *expected_version* does not match the current version.
        """
        self._check_optimistic_lock(expected_version)
        next_status = self._resolve_next(ApprovalAction.CANCEL)
        record = ApprovalRecord(
            order_id=self.order_id,
            operator_id=operator_id,
            action=ApprovalAction.CANCEL,
        )
        self._apply(next_status, record)
        return record

    # -- internals -----------------------------------------------------------

    def _resolve_next(self, action: ApprovalAction) -> OrderStatus:
        """Look up the next status for *action* from the transition table."""
        key = (self.status, action)
        if key not in self._TRANSITIONS:
            raise StateTransitionError(
                f"Cannot {action.value} from status {self.status.value}",
                error_code="INVALID_STATE_TRANSITION",
            )
        return self._TRANSITIONS[key]

    def _check_optimistic_lock(self, expected_version: Optional[int]) -> None:
        """Validate the optimistic-lock version if provided."""
        if expected_version is not None and expected_version != self.version:
            raise OptimisticLockConflictError(
                f"Expected version {expected_version}, but current version is {self.version}",
            )

    def _apply(self, new_status: OrderStatus, record: ApprovalRecord) -> None:
        """Commit a transition: update status, bump version, persist record."""
        self.status = new_status
        self.version += 1
        self.records.append(record)


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture
def engine() -> ApprovalChainEngine:
    """Return a fresh ApprovalChainEngine in PENDING state."""
    return ApprovalChainEngine(order_id="ORD-001")


@pytest.fixture
def engine_at_level1() -> ApprovalChainEngine:
    """Return an engine already in APPROVING_LEVEL_1 state."""
    eng = ApprovalChainEngine(order_id="ORD-002")
    eng.submit(operator_id="user-init")
    return eng


@pytest.fixture
def engine_at_level2() -> ApprovalChainEngine:
    """Return an engine already in APPROVING_LEVEL_2 state."""
    eng = ApprovalChainEngine(order_id="ORD-003")
    eng.submit(operator_id="user-init")
    eng.approve(operator_id="dept-manager-01")
    return eng


@pytest.fixture
def engine_approved() -> ApprovalChainEngine:
    """Return an engine in terminal APPROVED state."""
    eng = ApprovalChainEngine(order_id="ORD-004")
    eng.submit(operator_id="user-init")
    eng.approve(operator_id="dept-manager-01")
    eng.approve(operator_id="asset-admin-01")
    return eng


@pytest.fixture
def engine_rejected() -> ApprovalChainEngine:
    """Return an engine in terminal REJECTED state."""
    eng = ApprovalChainEngine(order_id="ORD-005")
    eng.submit(operator_id="user-init")
    eng.reject(operator_id="dept-manager-01", rejection_reason="不合规")
    return eng


@pytest.fixture
def engine_cancelled() -> ApprovalChainEngine:
    """Return an engine in terminal CANCELLED state."""
    eng = ApprovalChainEngine(order_id="ORD-006")
    eng.cancel(operator_id="user-init")
    return eng


# ===========================================================================
# ATB-1: Forward state transitions
# ===========================================================================

class TestForwardTransitions:
    """ATB-1: Verify the happy-path forward flow through the approval chain."""

    def test_submit_moves_pending_to_approving_level_1(self, engine: ApprovalChainEngine) -> None:
        """PENDING → APPROVING_LEVEL_1 via submit."""
        assert engine.status == OrderStatus.PENDING
        record = engine.submit(operator_id="user-init")
        assert engine.status == OrderStatus.APPROVING_LEVEL_1
        assert record.action == ApprovalAction.SUBMIT
        assert record.order_id == "ORD-001"

    def test_approve_level1_moves_to_approving_level_2(self, engine_at_level1: ApprovalChainEngine) -> None:
        """APPROVING_LEVEL_1 → APPROVING_LEVEL_2 via level-1 approve."""
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_1
        record = engine_at_level1.approve(operator_id="dept-manager-01")
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_2
        assert record.action == ApprovalAction.APPROVE
        assert record.operator_id == "dept-manager-01"

    def test_approve_level2_moves_to_approved(self, engine_at_level2: ApprovalChainEngine) -> None:
        """APPROVING_LEVEL_2 → APPROVED via level-2 approve."""
        assert engine_at_level2.status == OrderStatus.APPROVING_LEVEL_2
        record = engine_at_level2.approve(operator_id="asset-admin-01")
        assert engine_at_level2.status == OrderStatus.APPROVED
        assert record.action == ApprovalAction.APPROVE
        assert record.operator_id == "asset-admin-01"

    def test_full_forward_chain(self, engine: ApprovalChainEngine) -> None:
        """Complete forward flow: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        engine.submit(operator_id="user-init")
        assert engine.status == OrderStatus.APPROVING_LEVEL_1

        engine.approve(operator_id="dept-manager-01")
        assert engine.status == OrderStatus.APPROVING_LEVEL_2

        engine.approve(operator_id="asset-admin-01")
        assert engine.status == OrderStatus.APPROVED

        # Three approval records should have been created
        assert len(engine.records) == 3
        actions = [r.action for r in engine.records]
        assert actions == [
            ApprovalAction.SUBMIT,
            ApprovalAction.APPROVE,
            ApprovalAction.APPROVE,
        ]

    def test_version_increments_on_each_transition(self, engine: ApprovalChainEngine) -> None:
        """Version must increment by 1 for every state transition."""
        assert engine.version == 1
        engine.submit(operator_id="user-init")
        assert engine.version == 2
        engine.approve(operator_id="dept-manager-01")
        assert engine.version == 3
        engine.approve(operator_id="asset-admin-01")
        assert engine.version == 4


# ===========================================================================
# ATB-2: Rejection flows
# ===========================================================================

class TestRejectionFlows:
    """ATB-2: Verify rejection at each approval level with mandatory reason."""

    def test_reject_at_level1_moves_to_rejected(self, engine_at_level1: ApprovalChainEngine) -> None:
        """APPROVING_LEVEL_1 → REJECTED with a valid reason."""
        record = engine_at_level1.reject(
            operator_id="dept-manager-01",
            rejection_reason="不合规",
        )
        assert engine_at_level1.status == OrderStatus.REJECTED
        assert record.action == ApprovalAction.REJECT
        assert record.comment == "不合规"

    def test_reject_at_level2_moves_to_rejected(self, engine_at_level2: ApprovalChainEngine) -> None:
        """APPROVING_LEVEL_2 → REJECTED with a valid reason."""
        record = engine_at_level2.reject(
            operator_id="asset-admin-01",
            rejection_reason="资产信息不完整",
        )
        assert engine_at_level2.status == OrderStatus.REJECTED
        assert record.action == ApprovalAction.REJECT
        assert record.comment == "资产信息不完整"

    def test_reject_without_reason_raises_error(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Rejecting without a reason must raise RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError) as exc_info:
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason=None)
        assert exc_info.value.error_code == "REJECTION_REASON_REQUIRED"
        # Status must remain unchanged
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_1

    def test_reject_with_empty_reason_raises_error(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Rejecting with an empty/whitespace-only reason must raise RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason="")
        with pytest.raises(RejectionReasonRequiredError):
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason="   ")

    def test_reject_with_reason_exceeding_500_chars_raises_error(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Rejection reason longer than 500 characters must be rejected."""
        long_reason = "x" * 501
        with pytest.raises(RejectionReasonRequiredError) as exc_info:
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason=long_reason)
        assert exc_info.value.error_code == "REJECTION_REASON_TOO_LONG"

    def test_reject_records_comment_in_approval_record(self, engine_at_level1: ApprovalChainEngine) -> None:
        """The rejection reason must be persisted in the approval record's comment field."""
        engine_at_level1.reject(
            operator_id="dept-manager-01",
            rejection_reason="缺少必要附件",
        )
        assert len(engine_at_level1.records) == 2  # submit + reject
        reject_record = engine_at_level1.records[-1]
        assert reject_record.comment == "缺少必要附件"
        assert reject_record.action == ApprovalAction.REJECT

    def test_reject_does_not_change_version_on_validation_failure(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Version must stay the same when rejection validation fails."""
        original_version = engine_at_level1.version
        with pytest.raises(RejectionReasonRequiredError):
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason=None)
        assert engine_at_level1.version == original_version


# ===========================================================================
# ATB-3: Invalid state transition interception
# ===========================================================================

class TestInvalidTransitions:
    """ATB-3: Verify that illegal transitions are blocked with proper errors."""

    def test_approve_from_pending_is_invalid(self, engine: ApprovalChainEngine) -> None:
        """PENDING → APPROVE is illegal (must submit first)."""
        with pytest.raises(StateTransitionError) as exc_info:
            engine.approve(operator_id="dept-manager-01")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert engine.status == OrderStatus.PENDING

    def test_skip_level1_direct_to_level2_is_invalid(self, engine: ApprovalChainEngine) -> None:
        """Attempting to approve directly from PENDING to APPROVING_LEVEL_2 is illegal.

        This simulates the scenario where an asset-admin tries to approve a
        PENDING order without the dept-manager having approved first.
        """
        with pytest.raises(StateTransitionError) as exc_info:
            engine.approve(operator_id="asset-admin-01")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert engine.status == OrderStatus.PENDING

    def test_reject_from_pending_is_invalid(self, engine: ApprovalChainEngine) -> None:
        """PENDING → REJECT is illegal (rejection only at approval levels)."""
        with pytest.raises(StateTransitionError):
            engine.reject(operator_id="dept-manager-01", rejection_reason="理由")
        assert engine.status == OrderStatus.PENDING

    def test_approve_from_approved_is_invalid(self, engine_approved: ApprovalChainEngine) -> None:
        """APPROVED is terminal; no further approve allowed."""
        with pytest.raises(StateTransitionError) as exc_info:
            engine_approved.approve(operator_id="someone")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert engine_approved.status == OrderStatus.APPROVED

    def test_reject_from_approved_is_invalid(self, engine_approved: ApprovalChainEngine) -> None:
        """APPROVED is terminal; no reject allowed."""
        with pytest.raises(StateTransitionError):
            engine_approved.reject(operator_id="someone", rejection_reason="理由")
        assert engine_approved.status == OrderStatus.APPROVED

    def test_approve_from_rejected_is_invalid(self, engine_rejected: ApprovalChainEngine) -> None:
        """REJECTED is terminal; no approve allowed."""
        with pytest.raises(StateTransitionError) as exc_info:
            engine_rejected.approve(operator_id="someone")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert engine_rejected.status == OrderStatus.REJECTED

    def test_reject_from_rejected_is_invalid(self, engine_rejected: ApprovalChainEngine) -> None:
        """REJECTED is terminal; no reject allowed."""
        with pytest.raises(StateTransitionError):
            engine_rejected.reject(operator_id="someone", rejection_reason="再次驳回")
        assert engine_rejected.status == OrderStatus.REJECTED

    def test_approve_from_cancelled_is_invalid(self, engine_cancelled: ApprovalChainEngine) -> None:
        """CANCELLED is terminal; no approve allowed."""
        with pytest.raises(StateTransitionError):
            engine_cancelled.approve(operator_id="someone")
        assert engine_cancelled.status == OrderStatus.CANCELLED

    def test_submit_from_approving_level_1_is_invalid(self, engine_at_level1: ApprovalChainEngine) -> None:
        """SUBMIT is only valid from PENDING; not from APPROVING_LEVEL_1."""
        with pytest.raises(StateTransitionError):
            engine_at_level1.submit(operator_id="user-init")
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_1

    def test_cancel_from_approving_level_1_is_invalid(self, engine_at_level1: ApprovalChainEngine) -> None:
        """CANCEL is only valid from PENDING; not from APPROVING_LEVEL_1."""
        with pytest.raises(StateTransitionError):
            engine_at_level1.cancel(operator_id="user-init")
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_1

    def test_invalid_transition_does_not_create_record(self, engine: ApprovalChainEngine) -> None:
        """No approval record should be created for a failed transition."""
        initial_record_count = len(engine.records)
        with pytest.raises(StateTransitionError):
            engine.approve(operator_id="dept-manager-01")
        assert len(engine.records) == initial_record_count

    def test_invalid_transition_does_not_bump_version(self, engine: ApprovalChainEngine) -> None:
        """Version must not change on a failed transition."""
        initial_version = engine.version
        with pytest.raises(StateTransitionError):
            engine.approve(operator_id="dept-manager-01")
        assert engine.version == initial_version


# ===========================================================================
# Cancellation flow
# ===========================================================================

class TestCancellation:
    """Verify PENDING → CANCELLED transition and terminality of CANCELLED."""

    def test_cancel_from_pending(self, engine: ApprovalChainEngine) -> None:
        """PENDING → CANCELLED is a valid transition."""
        record = engine.cancel(operator_id="user-init")
        assert engine.status == OrderStatus.CANCELLED
        assert record.action == ApprovalAction.CANCEL

    def test_cancelled_is_terminal(self, engine_cancelled: ApprovalChainEngine) -> None:
        """No action is valid from CANCELLED state."""
        for action_fn, kwargs in [
            (engine_cancelled.approve, {}),
            (engine_cancelled.reject, {"rejection_reason": "理由"}),
            (engine_cancelled.submit, {}),
            (engine_cancelled.cancel, {}),
        ]:
            with pytest.raises(StateTransitionError):
                action_fn(operator_id="someone", **kwargs)
        assert engine_cancelled.status == OrderStatus.CANCELLED


# ===========================================================================
# Optimistic locking (concurrency control)
# ===========================================================================

class TestOptimisticLocking:
    """Verify that version-based optimistic locking prevents concurrent conflicts."""

    def test_approve_with_correct_version_succeeds(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Approval with the matching expected_version should succeed."""
        current_version = engine_at_level1.version
        engine_at_level1.approve(
            operator_id="dept-manager-01",
            expected_version=current_version,
        )
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_2

    def test_approve_with_stale_version_raises_conflict(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Approval with an outdated expected_version must raise OptimisticLockConflictError."""
        stale_version = engine_at_level1.version - 1
        with pytest.raises(OptimisticLockConflictError) as exc_info:
            engine_at_level1.approve(
                operator_id="dept-manager-01",
                expected_version=stale_version,
            )
        assert exc_info.value.error_code == "OPTIMISTIC_LOCK_CONFLICT"
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_1

    def test_reject_with_stale_version_raises_conflict(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Rejection with an outdated expected_version must raise OptimisticLockConflictError."""
        stale_version = engine_at_level1.version - 99
        with pytest.raises(OptimisticLockConflictError):
            engine_at_level1.reject(
                operator_id="dept-manager-01",
                rejection_reason="理由",
                expected_version=stale_version,
            )
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_1

    def test_no_version_check_when_expected_version_is_none(self, engine_at_level1: ApprovalChainEngine) -> None:
        """When expected_version is None, the lock check is skipped."""
        # Should succeed regardless of version
        engine_at_level1.approve(operator_id="dept-manager-01", expected_version=None)
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_2

    def test_concurrent_approval_race_condition(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Simulate two concurrent approvers: the second one must fail."""
        # First approver reads version
        v1 = engine_at_level1.version
        # Second approver also reads same version
        v2 = engine_at_level1.version

        # First approver succeeds
        engine_at_level1.approve(operator_id="dept-manager-01", expected_version=v1)
        assert engine_at_level1.status == OrderStatus.APPROVING_LEVEL_2

        # Second approver fails because version has been bumped
        with pytest.raises(OptimisticLockConflictError):
            engine_at_level1.approve(operator_id="dept-manager-02", expected_version=v2)

    def test_version_does_not_change_on_lock_conflict(self, engine_at_level1: ApprovalChainEngine) -> None:
        """Version must remain unchanged after an optimistic-lock failure."""
        original_version = engine_at_level1.version
        with pytest.raises(OptimisticLockConflictError):
            engine_at_level1.approve(
                operator_id="dept-manager-01",
                expected_version=original_version + 999,
            )
        assert engine_at_level1.version == original_version


# ===========================================================================
# Approval record persistence
# ===========================================================================

class TestApprovalRecordPersistence:
    """Verify that approval records are correctly created and stored."""

    def test_submit_creates_record(self, engine: ApprovalChainEngine) -> None:
        """A SUBMIT action must create an approval record."""
        engine.submit(operator_id="user-init")
        assert len(engine.records) == 1
        assert engine.records[0].action == ApprovalAction.SUBMIT
        assert engine.records[0].operator_id == "user-init"

    def test_approve_creates_record(self, engine_at_level1: ApprovalChainEngine) -> None:
        """An APPROVE action must create an approval record."""
        engine_at_level1.approve(operator_id="dept-manager-01")
        # records: [submit, approve]
        assert len(engine_at_level1.records) == 2
        assert engine_at_level1.records[-1].action == ApprovalAction.APPROVE
        assert engine_at_level1.records[-1].operator_id == "dept-manager-01"

    def test_reject_creates_record_with_comment(self, engine_at_level1: ApprovalChainEngine) -> None:
        """A REJECT action must create a record with the rejection reason as comment."""
        engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason="不合规")
        assert len(engine_at_level1.records) == 2
        reject_record = engine_at_level1.records[-1]
        assert reject_record.action == ApprovalAction.REJECT
        assert reject_record.comment == "不合规"

    def test_full_chain_creates_three_records(self, engine: ApprovalChainEngine) -> None:
        """Complete forward chain creates exactly 3 records (submit + 2 approves)."""
        engine.submit(operator_id="user-init")
        engine.approve(operator_id="dept-manager-01")
        engine.approve(operator_id="asset-admin-01")
        assert len(engine.records) == 3
        assert [r.action for r in engine.records] == [
            ApprovalAction.SUBMIT,
            ApprovalAction.APPROVE,
            ApprovalAction.APPROVE,
        ]

    def test_record_timestamps_are_set(self, engine: ApprovalChainEngine) -> None:
        """Each approval record must have a non-None timestamp."""
        engine.submit(operator_id="user-init")
        for record in engine.records:
            assert record.timestamp is not None
            assert isinstance(record.timestamp, datetime)

    def test_record_order_id_matches_engine(self, engine: ApprovalChainEngine) -> None:
        """All records must reference the correct order_id."""
        engine.submit(operator_id="user-init")
        for record in engine.records:
            assert record.order_id == engine.order_id

    def test_record_to_dict_serialization(self, engine_at_level1: ApprovalChainEngine) -> None:
        """ApprovalRecord.to_dict() must produce a serializable dictionary."""
        engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason="不合规")
        reject_record = engine_at_level1.records[-1]
        d = reject_record.to_dict()
        assert d["action"] == "REJECT"
        assert d["comment"] == "不合规"
        assert d["order_id"] == "ORD-002"
        assert d["operator_id"] == "dept-manager-01"
        assert "timestamp" in d


# ===========================================================================
# Terminal state invariants
# ===========================================================================

class TestTerminalStateInvariants:
    """Verify that terminal states reject all transitions."""

    @pytest.mark.parametrize("status_fixture", ["engine_approved", "engine_rejected", "engine_cancelled"])
    def test_no_action_valid_from_terminal_state(self, status_fixture: str, request: pytest.FixtureRequest) -> None:
        """No transition is valid from any terminal state."""
        eng: ApprovalChainEngine = request.getfixturevalue(status_fixture)
        original_status = eng.status

        with pytest.raises(StateTransitionError):
            eng.approve(operator_id="someone")
        with pytest.raises(StateTransitionError):
            eng.submit(operator_id="someone")
        with pytest.raises(StateTransitionError):
            eng.cancel(operator_id="someone")
        # reject also checks reason first, but even with valid reason it should fail
        with pytest.raises((StateTransitionError, RejectionReasonRequiredError)):
            eng.reject(operator_id="someone", rejection_reason="理由")

        assert eng.status == original_status

    def test_terminal_states_are_identified(self) -> None:
        """The engine must correctly identify all terminal states."""
        assert ApprovalChainEngine.TERMINAL_STATES == {
            OrderStatus.APPROVED,
            OrderStatus.REJECTED,
            OrderStatus.CANCELLED,
        }


# ===========================================================================
# Edge cases
# ===========================================================================

class TestEdgeCases:
    """Additional edge-case coverage for robustness."""

    def test_engine_initial_state_is_pending(self) -> None:
        """A newly created engine must start in PENDING state with version 1."""
        eng = ApprovalChainEngine(order_id="ORD-NEW")
        assert eng.status == OrderStatus.PENDING
        assert eng.version == 1
        assert len(eng.records) == 0

    def test_engine_can_be_initialized_at_any_status(self) -> None:
        """Engine can be constructed with a custom initial status for testing."""
        eng = ApprovalChainEngine(order_id="ORD-CUSTOM", initial_status=OrderStatus.APPROVING_LEVEL_2)
        assert eng.status == OrderStatus.APPROVING_LEVEL_2

    def test_rejection_reason_exactly_500_chars_is_accepted(self, engine_at_level1: ApprovalChainEngine) -> None:
        """A rejection reason of exactly 500 characters should be accepted."""
        reason = "a" * 500
        engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason=reason)
        assert engine_at_level1.status == OrderStatus.REJECTED

    def test_rejection_reason_501_chars_is_rejected(self, engine_at_level1: ApprovalChainEngine) -> None:
        """A rejection reason of 501 characters should be rejected."""
        reason = "a" * 501
        with pytest.raises(RejectionReasonRequiredError):
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason=reason)

    def test_multiple_reject_attempts_after_first_failure(self, engine_at_level1: ApprovalChainEngine) -> None:
        """After a failed reject (no reason), a valid reject should still work."""
        with pytest.raises(RejectionReasonRequiredError):
            engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason=None)
        # Now retry with a valid reason
        engine_at_level1.reject(operator_id="dept-manager-01", rejection_reason="合规驳回")
        assert engine_at_level1.status == OrderStatus.REJECTED

    def test_approve_after_failed_approve_does_not_corrupt_state(self, engine: ApprovalChainEngine) -> None:
        """A failed approve from PENDING should not prevent a subsequent submit+approve."""
        with pytest.raises(StateTransitionError):
            engine.approve(operator_id="dept-manager-01")
        assert engine.status == OrderStatus.PENDING

        engine.submit(operator_id="user-init")
        assert engine.status == OrderStatus.APPROVING_LEVEL_1

        engine.approve(operator_id="dept-manager-01")
        assert engine.status == OrderStatus.APPROVING_LEVEL_2