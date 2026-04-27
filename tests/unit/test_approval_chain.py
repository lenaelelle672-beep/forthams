"""
Unit tests for the multi-level approval chain.

Covers the core approval flow as specified in Phase 1:
  - ATB-1: Forward state transitions  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  - ATB-2: Rejection flow with mandatory rejectionReason
  - ATB-3: Illegal state transition interception (no skip-level approval)
  - Optimistic-lock conflict detection
  - Role-based data isolation
  - Approval record persistence verification
  - CANCELLED state handling
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Domain helpers – lightweight stand-ins so tests run without the full app
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """Work order status enum matching the SPEC state machine."""
    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Actions that can be recorded in an approval record."""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class StateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""
    pass


class OptimisticLockError(Exception):
    """Raised when an optimistic-lock conflict is detected."""
    pass


class ValidationError(Exception):
    """Raised when request validation fails (e.g. missing rejectionReason)."""
    pass


# ---------------------------------------------------------------------------
# Approval record entity
# ---------------------------------------------------------------------------

class ApprovalRecord:
    """Represents a single approval / rejection record persisted for audit."""

    def __init__(
        self,
        order_id: str,
        operator_id: str,
        action: ApprovalAction,
        comment: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        self.id: str = str(uuid.uuid4())
        self.order_id = order_id
        self.operator_id = operator_id
        self.action = action
        self.comment = comment
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        """Serialize the record to a dictionary."""
        return {
            "id": self.id,
            "order_id": self.order_id,
            "operator_id": self.operator_id,
            "action": self.action.value,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Work order entity (simplified for unit tests)
# ---------------------------------------------------------------------------

class WorkOrder:
    """Minimal work order entity used in unit tests."""

    def __init__(
        self,
        order_id: Optional[str] = None,
        status: OrderStatus = OrderStatus.PENDING,
        version: int = 1,
        applicant_id: Optional[str] = None,
        title: str = "",
    ) -> None:
        self.id: str = order_id or str(uuid.uuid4())
        self.status = status
        self.version = version
        self.applicant_id = applicant_id or str(uuid.uuid4())
        self.title = title
        self.approval_records: list[ApprovalRecord] = []

    def to_dict(self) -> dict[str, Any]:
        """Serialize the work order to a dictionary."""
        return {
            "id": self.id,
            "status": self.status.value,
            "version": self.version,
            "applicant_id": self.applicant_id,
            "title": self.title,
            "approval_records": [r.to_dict() for r in self.approval_records],
        }


# ---------------------------------------------------------------------------
# State machine – encodes the SPEC transition rules
# ---------------------------------------------------------------------------

# Legal transitions: (current_status, event) → next_status
_LEGAL_TRANSITIONS: dict[tuple[OrderStatus, str], OrderStatus] = {
    (OrderStatus.PENDING, "APPROVE"): OrderStatus.APPROVING_LEVEL_1,
    (OrderStatus.APPROVING_LEVEL_1, "APPROVE"): OrderStatus.APPROVING_LEVEL_2,
    (OrderStatus.APPROVING_LEVEL_2, "APPROVE"): OrderStatus.APPROVED,
    (OrderStatus.APPROVING_LEVEL_1, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.APPROVING_LEVEL_2, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.PENDING, "CANCEL"): OrderStatus.CANCELLED,
    (OrderStatus.APPROVING_LEVEL_1, "CANCEL"): OrderStatus.CANCELLED,
}

# Terminal states – no outgoing transitions
_TERMINAL_STATES = {OrderStatus.APPROVED, OrderStatus.REJECTED, OrderStatus.CANCELLED}


class OrderStateMachine:
    """
    State machine that enforces the multi-level approval chain.

    Transition rules (from SPEC):
      PENDING ──APPROVE──▶ APPROVING_LEVEL_1
      APPROVING_LEVEL_1 ──APPROVE──▶ APPROVING_LEVEL_2
      APPROVING_LEVEL_2 ──APPROVE──▶ APPROVED
      APPROVING_LEVEL_1 ──REJECT──▶ REJECTED
      APPROVING_LEVEL_2 ──REJECT──▶ REJECTED
      PENDING ──CANCEL──▶ CANCELLED
      APPROVING_LEVEL_1 ──CANCEL──▶ CANCELLED

    Any other transition is illegal and raises StateTransitionError.
    """

    def __init__(self, order: WorkOrder) -> None:
        self._order = order

    @property
    def current_state(self) -> OrderStatus:
        """Return the current status of the bound work order."""
        return self._order.status

    def can_trigger(self, event: str) -> bool:
        """Check whether *event* is legal from the current state."""
        return (self._order.status, event) in _LEGAL_TRANSITIONS

    def trigger(self, event: str) -> OrderStatus:
        """
        Attempt to apply *event* and return the new status.

        Raises:
            StateTransitionError: if the transition is not legal.
        """
        key = (self._order.status, event)
        if key not in _LEGAL_TRANSITIONS:
            raise StateTransitionError(
                f"Invalid transition: {self._order.status.value} + {event}"
            )
        self._order.status = _LEGAL_TRANSITIONS[key]
        return self._order.status


# ---------------------------------------------------------------------------
# Approval service (simplified, unit-testable)
# ---------------------------------------------------------------------------

class ApprovalService:
    """
    Service that orchestrates approval / rejection operations.

    Responsibilities:
      - Validate the request (e.g. rejectionReason on REJECT).
      - Delegate to the state machine for transition validation.
      - Simulate optimistic-lock check via *expected_version*.
      - Persist an ApprovalRecord on success.
    """

    MAX_REJECTION_REASON_LENGTH = 500

    def __init__(self) -> None:
        # In-memory store keyed by order id – stands in for a real repository.
        self._orders: dict[str, WorkOrder] = {}
        self._records: list[ApprovalRecord] = []

    # -- repository helpers --------------------------------------------------

    def save_order(self, order: WorkOrder) -> None:
        """Persist (or update) a work order in the in-memory store."""
        self._orders[order.id] = order

    def get_order(self, order_id: str) -> Optional[WorkOrder]:
        """Retrieve a work order by id, or None."""
        return self._orders.get(order_id)

    def get_records_for_order(self, order_id: str) -> list[ApprovalRecord]:
        """Return all approval records for the given order."""
        return [r for r in self._records if r.order_id == order_id]

    # -- approval / rejection ------------------------------------------------

    def approve(
        self,
        order_id: str,
        operator_id: str,
        expected_version: int,
    ) -> WorkOrder:
        """
        Approve the work order at its current level.

        Args:
            order_id: The work order identifier.
            operator_id: The user performing the approval.
            expected_version: Optimistic-lock version expected by the caller.

        Returns:
            The updated WorkOrder.

        Raises:
            ValidationError: if the order does not exist.
            OptimisticLockError: if *expected_version* does not match.
            StateTransitionError: if the transition is illegal.
        """
        order = self._orders.get(order_id)
        if order is None:
            raise ValidationError(f"Order {order_id} not found")

        if order.version != expected_version:
            raise OptimisticLockError(
                f"Version conflict: expected {expected_version}, "
                f"actual {order.version}"
            )

        sm = OrderStateMachine(order)
        sm.trigger("APPROVE")

        # Bump version after successful transition
        order.version += 1

        # Persist approval record
        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
        )
        self._records.append(record)
        order.approval_records.append(record)

        return order

    def reject(
        self,
        order_id: str,
        operator_id: str,
        expected_version: int,
        rejection_reason: Optional[str] = None,
    ) -> WorkOrder:
        """
        Reject the work order at its current level.

        Args:
            order_id: The work order identifier.
            operator_id: The user performing the rejection.
            expected_version: Optimistic-lock version expected by the caller.
            rejection_reason: Mandatory non-empty string (max 500 chars).

        Returns:
            The updated WorkOrder.

        Raises:
            ValidationError: if rejectionReason is missing / empty / too long,
                            or if the order does not exist.
            OptimisticLockError: if *expected_version* does not match.
            StateTransitionError: if the transition is illegal.
        """
        # Validate rejection reason
        if rejection_reason is None or rejection_reason.strip() == "":
            raise ValidationError("rejectionReason is required and must not be empty")
        if len(rejection_reason) > self.MAX_REJECTION_REASON_LENGTH:
            raise ValidationError(
                f"rejectionReason must not exceed "
                f"{self.MAX_REJECTION_REASON_LENGTH} characters"
            )

        order = self._orders.get(order_id)
        if order is None:
            raise ValidationError(f"Order {order_id} not found")

        if order.version != expected_version:
            raise OptimisticLockError(
                f"Version conflict: expected {expected_version}, "
                f"actual {order.version}"
            )

        sm = OrderStateMachine(order)
        sm.trigger("REJECT")

        # Bump version after successful transition
        order.version += 1

        # Persist rejection record
        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            comment=rejection_reason,
        )
        self._records.append(record)
        order.approval_records.append(record)

        return order

    def cancel(
        self,
        order_id: str,
        operator_id: str,
        expected_version: int,
    ) -> WorkOrder:
        """
        Cancel the work order.

        Args:
            order_id: The work order identifier.
            operator_id: The user performing the cancellation.
            expected_version: Optimistic-lock version expected by the caller.

        Returns:
            The updated WorkOrder.

        Raises:
            ValidationError: if the order does not exist.
            OptimisticLockError: if *expected_version* does not match.
            StateTransitionError: if the transition is illegal.
        """
        order = self._orders.get(order_id)
        if order is None:
            raise ValidationError(f"Order {order_id} not found")

        if order.version != expected_version:
            raise OptimisticLockError(
                f"Version conflict: expected {expected_version}, "
                f"actual {order.version}"
            )

        sm = OrderStateMachine(order)
        sm.trigger("CANCEL")

        order.version += 1

        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.CANCEL,
        )
        self._records.append(record)
        order.approval_records.append(record)

        return order

    # -- role-based filtering ------------------------------------------------

    def list_by_role(self, role: str) -> list[WorkOrder]:
        """
        Return work orders visible to the given role.

        Per SPEC:
          - DEPARTMENT_MANAGER  → only APPROVING_LEVEL_1
          - ASSET_MANAGER       → only APPROVING_LEVEL_2
        """
        role_filter: dict[str, OrderStatus] = {
            "DEPARTMENT_MANAGER": OrderStatus.APPROVING_LEVEL_1,
            "ASSET_MANAGER": OrderStatus.APPROVING_LEVEL_2,
        }
        target_status = role_filter.get(role)
        if target_status is None:
            return []
        return [
            o for o in self._orders.values() if o.status == target_status
        ]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def service() -> ApprovalService:
    """Return a fresh ApprovalService instance."""
    return ApprovalService()


@pytest.fixture
def pending_order() -> WorkOrder:
    """Return a work order in PENDING state."""
    return WorkOrder(status=OrderStatus.PENDING, title="Test pending order")


@pytest.fixture
def level1_order() -> WorkOrder:
    """Return a work order in APPROVING_LEVEL_1 state."""
    return WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, title="Test L1 order")


@pytest.fixture
def level2_order() -> WorkOrder:
    """Return a work order in APPROVING_LEVEL_2 state."""
    return WorkOrder(status=OrderStatus.APPROVING_LEVEL_2, title="Test L2 order")


@pytest.fixture
def approved_order() -> WorkOrder:
    """Return a work order in APPROVED (terminal) state."""
    return WorkOrder(status=OrderStatus.APPROVED, title="Test approved order")


@pytest.fixture
def rejected_order() -> WorkOrder:
    """Return a work order in REJECTED (terminal) state."""
    return WorkOrder(status=OrderStatus.REJECTED, title="Test rejected order")


@pytest.fixture
def cancelled_order() -> WorkOrder:
    """Return a work order in CANCELLED (terminal) state."""
    return WorkOrder(status=OrderStatus.CANCELLED, title="Test cancelled order")


OPERATOR_DEPT_MGR = "user-dept-mgr-001"
OPERATOR_ASSET_MGR = "user-asset-mgr-001"


# ===========================================================================
# ATB-1: Forward state transitions
# ===========================================================================

class TestForwardTransitions:
    """ATB-1: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""

    def test_pending_to_approving_level_1(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Approve from PENDING moves to APPROVING_LEVEL_1."""
        service.save_order(pending_order)
        result = service.approve(pending_order.id, OPERATOR_DEPT_MGR, expected_version=1)
        assert result.status == OrderStatus.APPROVING_LEVEL_1
        assert result.version == 2

    def test_approving_level_1_to_approving_level_2(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Approve from APPROVING_LEVEL_1 moves to APPROVING_LEVEL_2."""
        service.save_order(level1_order)
        result = service.approve(level1_order.id, OPERATOR_ASSET_MGR, expected_version=1)
        assert result.status == OrderStatus.APPROVING_LEVEL_2
        assert result.version == 2

    def test_approving_level_2_to_approved(self, service: ApprovalService, level2_order: WorkOrder) -> None:
        """Approve from APPROVING_LEVEL_2 moves to APPROVED."""
        service.save_order(level2_order)
        result = service.approve(level2_order.id, OPERATOR_ASSET_MGR, expected_version=1)
        assert result.status == OrderStatus.APPROVED
        assert result.version == 2

    def test_full_forward_chain(self, service: ApprovalService) -> None:
        """End-to-end: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        order = WorkOrder(status=OrderStatus.PENDING, title="Full chain order")
        service.save_order(order)

        # Step 1: PENDING → APPROVING_LEVEL_1
        order = service.approve(order.id, OPERATOR_DEPT_MGR, expected_version=1)
        assert order.status == OrderStatus.APPROVING_LEVEL_1
        assert order.version == 2

        # Step 2: APPROVING_LEVEL_1 → APPROVING_LEVEL_2
        order = service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=2)
        assert order.status == OrderStatus.APPROVING_LEVEL_2
        assert order.version == 3

        # Step 3: APPROVING_LEVEL_2 → APPROVED
        order = service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=3)
        assert order.status == OrderStatus.APPROVED
        assert order.version == 4

    def test_approval_records_created_on_forward_chain(self, service: ApprovalService) -> None:
        """Each approve step must create an ApprovalRecord."""
        order = WorkOrder(status=OrderStatus.PENDING, title="Record chain order")
        service.save_order(order)

        service.approve(order.id, OPERATOR_DEPT_MGR, expected_version=1)
        service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=2)
        service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=3)

        records = service.get_records_for_order(order.id)
        assert len(records) == 3
        assert all(r.action == ApprovalAction.APPROVE for r in records)
        assert records[0].operator_id == OPERATOR_DEPT_MGR
        assert records[1].operator_id == OPERATOR_ASSET_MGR
        assert records[2].operator_id == OPERATOR_ASSET_MGR

    def test_approval_records_have_timestamps(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Approval records must carry a non-null created_at timestamp."""
        service.save_order(pending_order)
        service.approve(pending_order.id, OPERATOR_DEPT_MGR, expected_version=1)
        records = service.get_records_for_order(pending_order.id)
        assert len(records) == 1
        assert records[0].created_at is not None


# ===========================================================================
# ATB-2: Rejection flow
# ===========================================================================

class TestRejectionFlow:
    """ATB-2: Rejection at any approval node transitions to REJECTED."""

    def test_reject_at_level_1(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject from APPROVING_LEVEL_1 transitions to REJECTED."""
        service.save_order(level1_order)
        result = service.reject(
            level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
            rejection_reason="不合规",
        )
        assert result.status == OrderStatus.REJECTED
        assert result.version == 2

    def test_reject_at_level_2(self, service: ApprovalService, level2_order: WorkOrder) -> None:
        """Reject from APPROVING_LEVEL_2 transitions to REJECTED."""
        service.save_order(level2_order)
        result = service.reject(
            level2_order.id, OPERATOR_ASSET_MGR, expected_version=1,
            rejection_reason="资产信息不符",
        )
        assert result.status == OrderStatus.REJECTED
        assert result.version == 2

    def test_reject_without_reason_raises_validation_error(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject without rejectionReason must raise ValidationError (maps to HTTP 400)."""
        service.save_order(level1_order)
        with pytest.raises(ValidationError, match="rejectionReason is required"):
            service.reject(
                level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason=None,
            )

    def test_reject_with_empty_reason_raises_validation_error(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject with empty-string rejectionReason must raise ValidationError."""
        service.save_order(level1_order)
        with pytest.raises(ValidationError, match="rejectionReason is required"):
            service.reject(
                level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="",
            )

    def test_reject_with_whitespace_only_reason_raises_validation_error(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject with whitespace-only rejectionReason must raise ValidationError."""
        service.save_order(level1_order)
        with pytest.raises(ValidationError, match="rejectionReason is required"):
            service.reject(
                level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="   ",
            )

    def test_reject_with_reason_exceeding_max_length_raises_validation_error(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject with rejectionReason > 500 chars must raise ValidationError."""
        service.save_order(level1_order)
        long_reason = "x" * 501
        with pytest.raises(ValidationError, match="must not exceed 500"):
            service.reject(
                level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason=long_reason,
            )

    def test_reject_with_reason_at_max_length_succeeds(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject with rejectionReason exactly 500 chars must succeed."""
        service.save_order(level1_order)
        reason = "x" * 500
        result = service.reject(
            level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
            rejection_reason=reason,
        )
        assert result.status == OrderStatus.REJECTED

    def test_rejection_record_contains_reason(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Rejection record must persist the rejectionReason in the comment field."""
        service.save_order(level1_order)
        service.reject(
            level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
            rejection_reason="不合规",
        )
        records = service.get_records_for_order(level1_order.id)
        assert len(records) == 1
        assert records[0].action == ApprovalAction.REJECT
        assert records[0].comment == "不合规"

    def test_rejection_record_has_operator(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Rejection record must persist the operator_id."""
        service.save_order(level1_order)
        service.reject(
            level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
            rejection_reason="不合规",
        )
        records = service.get_records_for_order(level1_order.id)
        assert records[0].operator_id == OPERATOR_DEPT_MGR

    def test_rejection_record_has_timestamp(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Rejection record must carry a non-null created_at timestamp."""
        service.save_order(level1_order)
        service.reject(
            level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
            rejection_reason="不合规",
        )
        records = service.get_records_for_order(level1_order.id)
        assert records[0].created_at is not None


# ===========================================================================
# ATB-3: Illegal state transition interception
# ===========================================================================

class TestIllegalTransitions:
    """ATB-3: Illegal transitions must raise StateTransitionError (maps to HTTP 409)."""

    def test_pending_cannot_skip_to_level_2(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """PENDING order cannot directly transition to APPROVING_LEVEL_2 (skip-level)."""
        service.save_order(pending_order)
        # The state machine only allows PENDING + APPROVE → APPROVING_LEVEL_1.
        # There is no event that takes PENDING → APPROVING_LEVEL_2 directly.
        sm = OrderStateMachine(pending_order)
        assert not sm.can_trigger("SKIP_TO_LEVEL_2")
        with pytest.raises(StateTransitionError):
            sm.trigger("SKIP_TO_LEVEL_2")
        # Status must remain unchanged
        assert pending_order.status == OrderStatus.PENDING

    def test_pending_cannot_be_rejected(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """PENDING order cannot be rejected (REJECT is only valid at approval nodes)."""
        service.save_order(pending_order)
        sm = OrderStateMachine(pending_order)
        assert not sm.can_trigger("REJECT")
        with pytest.raises(StateTransitionError):
            sm.trigger("REJECT")
        assert pending_order.status == OrderStatus.PENDING

    def test_approved_is_terminal(self, service: ApprovalService, approved_order: WorkOrder) -> None:
        """APPROVED is a terminal state; no further transitions allowed."""
        sm = OrderStateMachine(approved_order)
        for event in ("APPROVE", "REJECT", "CANCEL"):
            assert not sm.can_trigger(event)
            with pytest.raises(StateTransitionError):
                sm.trigger(event)
        assert approved_order.status == OrderStatus.APPROVED

    def test_rejected_is_terminal(self, service: ApprovalService, rejected_order: WorkOrder) -> None:
        """REJECTED is a terminal state; no further transitions allowed."""
        sm = OrderStateMachine(rejected_order)
        for event in ("APPROVE", "REJECT", "CANCEL"):
            assert not sm.can_trigger(event)
            with pytest.raises(StateTransitionError):
                sm.trigger(event)
        assert rejected_order.status == OrderStatus.REJECTED

    def test_cancelled_is_terminal(self, service: ApprovalService, cancelled_order: WorkOrder) -> None:
        """CANCELLED is a terminal state; no further transitions allowed."""
        sm = OrderStateMachine(cancelled_order)
        for event in ("APPROVE", "REJECT", "CANCEL"):
            assert not sm.can_trigger(event)
            with pytest.raises(StateTransitionError):
                sm.trigger(event)
        assert cancelled_order.status == OrderStatus.CANCELLED

    def test_level_2_cannot_be_cancelled(self, service: ApprovalService, level2_order: WorkOrder) -> None:
        """APPROVING_LEVEL_2 does not support CANCEL per the SPEC transition table."""
        sm = OrderStateMachine(level2_order)
        assert not sm.can_trigger("CANCEL")
        with pytest.raises(StateTransitionError):
            sm.trigger("CANCEL")
        assert level2_order.status == OrderStatus.APPROVING_LEVEL_2

    def test_service_reject_on_pending_raises(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Service-level reject on a PENDING order must raise StateTransitionError."""
        service.save_order(pending_order)
        with pytest.raises(StateTransitionError):
            service.reject(
                pending_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="should not work",
            )
        # Order status unchanged
        assert pending_order.status == OrderStatus.PENDING

    def test_service_approve_on_approved_raises(self, service: ApprovalService, approved_order: WorkOrder) -> None:
        """Service-level approve on an APPROVED order must raise StateTransitionError."""
        service.save_order(approved_order)
        with pytest.raises(StateTransitionError):
            service.approve(approved_order.id, OPERATOR_DEPT_MGR, expected_version=1)
        assert approved_order.status == OrderStatus.APPROVED


# ===========================================================================
# Optimistic-lock (version) conflict tests
# ===========================================================================

class TestOptimisticLock:
    """Concurrent approval must be prevented via optimistic locking."""

    def test_approve_with_stale_version_raises_lock_error(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Approve with an outdated version must raise OptimisticLockError (HTTP 409)."""
        service.save_order(pending_order)
        # First approval succeeds, bumps version to 2
        service.approve(pending_order.id, OPERATOR_DEPT_MGR, expected_version=1)
        # Second approval with stale version=1 must fail
        with pytest.raises(OptimisticLockError):
            service.approve(pending_order.id, OPERATOR_ASSET_MGR, expected_version=1)

    def test_reject_with_stale_version_raises_lock_error(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """Reject with an outdated version must raise OptimisticLockError."""
        service.save_order(level1_order)
        # Simulate a prior update that bumped the version
        level1_order.version = 3
        with pytest.raises(OptimisticLockError):
            service.reject(
                level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="stale",
            )

    def test_version_increments_on_each_successful_transition(self, service: ApprovalService) -> None:
        """Version must increment by 1 after each successful state change."""
        order = WorkOrder(status=OrderStatus.PENDING, title="Version test")
        service.save_order(order)
        assert order.version == 1

        order = service.approve(order.id, OPERATOR_DEPT_MGR, expected_version=1)
        assert order.version == 2

        order = service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=2)
        assert order.version == 3

        order = service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=3)
        assert order.version == 4


# ===========================================================================
# Role-based data isolation
# ===========================================================================

class TestRoleBasedIsolation:
    """Department managers see only APPROVING_LEVEL_1; asset managers see only APPROVING_LEVEL_2."""

    def test_department_manager_sees_only_level_1(self, service: ApprovalService) -> None:
        """DEPARTMENT_MANAGER role must only list APPROVING_LEVEL_1 orders."""
        o1 = WorkOrder(status=OrderStatus.PENDING, title="Pending")
        o2 = WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, title="L1")
        o3 = WorkOrder(status=OrderStatus.APPROVING_LEVEL_2, title="L2")
        o4 = WorkOrder(status=OrderStatus.APPROVED, title="Approved")
        for o in (o1, o2, o3, o4):
            service.save_order(o)

        visible = service.list_by_role("DEPARTMENT_MANAGER")
        assert len(visible) == 1
        assert visible[0].status == OrderStatus.APPROVING_LEVEL_1

    def test_asset_manager_sees_only_level_2(self, service: ApprovalService) -> None:
        """ASSET_MANAGER role must only list APPROVING_LEVEL_2 orders."""
        o1 = WorkOrder(status=OrderStatus.PENDING, title="Pending")
        o2 = WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, title="L1")
        o3 = WorkOrder(status=OrderStatus.APPROVING_LEVEL_2, title="L2")
        o4 = WorkOrder(status=OrderStatus.APPROVED, title="Approved")
        for o in (o1, o2, o3, o4):
            service.save_order(o)

        visible = service.list_by_role("ASSET_MANAGER")
        assert len(visible) == 1
        assert visible[0].status == OrderStatus.APPROVING_LEVEL_2

    def test_unknown_role_sees_nothing(self, service: ApprovalService) -> None:
        """An unrecognized role must see zero orders."""
        o1 = WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, title="L1")
        service.save_order(o1)
        visible = service.list_by_role("UNKNOWN_ROLE")
        assert len(visible) == 0

    def test_isolation_after_approval_moves_order_out_of_view(self, service: ApprovalService) -> None:
        """After L1 approval, the order disappears from DEPARTMENT_MANAGER's list."""
        order = WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, title="L1")
        service.save_order(order)

        # Before approval, dept manager sees it
        assert len(service.list_by_role("DEPARTMENT_MANAGER")) == 1

        # Approve → moves to APPROVING_LEVEL_2
        service.approve(order.id, OPERATOR_DEPT_MGR, expected_version=1)

        # After approval, dept manager no longer sees it
        assert len(service.list_by_role("DEPARTMENT_MANAGER")) == 0
        # Asset manager now sees it
        assert len(service.list_by_role("ASSET_MANAGER")) == 1

    def test_multiple_orders_filtering(self, service: ApprovalService) -> None:
        """Multiple orders at different levels are correctly filtered by role."""
        for i in range(3):
            service.save_order(WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, title=f"L1-{i}"))
        for i in range(2):
            service.save_order(WorkOrder(status=OrderStatus.APPROVING_LEVEL_2, title=f"L2-{i}"))

        dept_visible = service.list_by_role("DEPARTMENT_MANAGER")
        asset_visible = service.list_by_role("ASSET_MANAGER")
        assert len(dept_visible) == 3
        assert len(asset_visible) == 2


# ===========================================================================
# CANCELLED state tests
# ===========================================================================

class TestCancelledState:
    """CANCELLED state handling per the SPEC transition table."""

    def test_cancel_from_pending(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """PENDING order can be cancelled."""
        service.save_order(pending_order)
        result = service.cancel(pending_order.id, "user-001", expected_version=1)
        assert result.status == OrderStatus.CANCELLED
        assert result.version == 2

    def test_cancel_from_approving_level_1(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """APPROVING_LEVEL_1 order can be cancelled."""
        service.save_order(level1_order)
        result = service.cancel(level1_order.id, "user-001", expected_version=1)
        assert result.status == OrderStatus.CANCELLED

    def test_cancel_creates_record(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Cancellation must create an ApprovalRecord with action=CANCEL."""
        service.save_order(pending_order)
        service.cancel(pending_order.id, "user-001", expected_version=1)
        records = service.get_records_for_order(pending_order.id)
        assert len(records) == 1
        assert records[0].action == ApprovalAction.CANCEL

    def test_cancel_from_level_2_not_allowed(self, service: ApprovalService, level2_order: WorkOrder) -> None:
        """APPROVING_LEVEL_2 order cannot be cancelled per SPEC."""
        service.save_order(level2_order)
        with pytest.raises(StateTransitionError):
            service.cancel(level2_order.id, "user-001", expected_version=1)
        assert level2_order.status == OrderStatus.APPROVING_LEVEL_2


# ===========================================================================
# State machine unit tests (isolated from service)
# ===========================================================================

class TestStateMachineIsolated:
    """Direct state machine tests without the service layer."""

    def test_can_trigger_returns_true_for_legal(self) -> None:
        """can_trigger returns True for a legal transition."""
        order = WorkOrder(status=OrderStatus.PENDING)
        sm = OrderStateMachine(order)
        assert sm.can_trigger("APPROVE") is True

    def test_can_trigger_returns_false_for_illegal(self) -> None:
        """can_trigger returns False for an illegal transition."""
        order = WorkOrder(status=OrderStatus.PENDING)
        sm = OrderStateMachine(order)
        assert sm.can_trigger("REJECT") is False

    def test_trigger_returns_new_state(self) -> None:
        """trigger returns the new OrderStatus on success."""
        order = WorkOrder(status=OrderStatus.PENDING)
        sm = OrderStateMachine(order)
        new_state = sm.trigger("APPROVE")
        assert new_state == OrderStatus.APPROVING_LEVEL_1

    def test_trigger_mutates_order_status(self) -> None:
        """trigger mutates the bound WorkOrder's status."""
        order = WorkOrder(status=OrderStatus.PENDING)
        sm = OrderStateMachine(order)
        sm.trigger("APPROVE")
        assert order.status == OrderStatus.APPROVING_LEVEL_1

    def test_all_legal_transitions_are_defined(self) -> None:
        """Verify every entry in _LEGAL_TRANSITIONS is internally consistent."""
        for (status, event), next_status in _LEGAL_TRANSITIONS.items():
            order = WorkOrder(status=status)
            sm = OrderStateMachine(order)
            result = sm.trigger(event)
            assert result == next_status, (
                f"Transition ({status.value}, {event}) expected {next_status.value}, "
                f"got {result.value}"
            )

    def test_no_transition_from_terminal_states(self) -> None:
        """No event can be triggered from any terminal state."""
        for terminal in _TERMINAL_STATES:
            order = WorkOrder(status=terminal)
            sm = OrderStateMachine(order)
            for event in ("APPROVE", "REJECT", "CANCEL"):
                assert sm.can_trigger(event) is False, (
                    f"Terminal state {terminal.value} should not allow {event}"
                )


# ===========================================================================
# Approval record persistence tests
# ===========================================================================

class TestApprovalRecordPersistence:
    """Verify approval records are correctly persisted and retrievable."""

    def test_mixed_approve_and_reject_records(self, service: ApprovalService) -> None:
        """A chain of approve + reject must produce correct records."""
        order = WorkOrder(status=OrderStatus.PENDING, title="Mixed records")
        service.save_order(order)

        # PENDING → APPROVING_LEVEL_1
        service.approve(order.id, OPERATOR_DEPT_MGR, expected_version=1)
        # APPROVING_LEVEL_1 → REJECTED
        service.reject(
            order.id, OPERATOR_ASSET_MGR, expected_version=2,
            rejection_reason="不合规",
        )

        records = service.get_records_for_order(order.id)
        assert len(records) == 2
        assert records[0].action == ApprovalAction.APPROVE
        assert records[0].operator_id == OPERATOR_DEPT_MGR
        assert records[1].action == ApprovalAction.REJECT
        assert records[1].operator_id == OPERATOR_ASSET_MGR
        assert records[1].comment == "不合规"

    def test_records_are_order_specific(self, service: ApprovalService) -> None:
        """Records for one order must not leak into another order's records."""
        o1 = WorkOrder(status=OrderStatus.PENDING, title="Order 1")
        o2 = WorkOrder(status=OrderStatus.PENDING, title="Order 2")
        service.save_order(o1)
        service.save_order(o2)

        service.approve(o1.id, OPERATOR_DEPT_MGR, expected_version=1)
        service.approve(o2.id, OPERATOR_DEPT_MGR, expected_version=1)

        assert len(service.get_records_for_order(o1.id)) == 1
        assert len(service.get_records_for_order(o2.id)) == 1

    def test_record_to_dict_serialization(self) -> None:
        """ApprovalRecord.to_dict must include all required fields."""
        record = ApprovalRecord(
            order_id="order-123",
            operator_id="user-456",
            action=ApprovalAction.REJECT,
            comment="不合规",
        )
        d = record.to_dict()
        assert d["order_id"] == "order-123"
        assert d["operator_id"] == "user-456"
        assert d["action"] == "REJECT"
        assert d["comment"] == "不合规"
        assert "created_at" in d
        assert "id" in d

    def test_full_chain_creates_three_records(self, service: ApprovalService) -> None:
        """A complete PENDING→APPROVED chain creates exactly 3 approval records."""
        order = WorkOrder(status=OrderStatus.PENDING, title="Full chain records")
        service.save_order(order)

        service.approve(order.id, OPERATOR_DEPT_MGR, expected_version=1)
        service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=2)
        service.approve(order.id, OPERATOR_ASSET_MGR, expected_version=3)

        records = service.get_records_for_order(order.id)
        assert len(records) == 3
        # Verify the sequence of actions
        assert [r.action for r in records] == [
            ApprovalAction.APPROVE,
            ApprovalAction.APPROVE,
            ApprovalAction.APPROVE,
        ]


# ===========================================================================
# Edge-case & boundary tests
# ===========================================================================

class TestEdgeCases:
    """Boundary and edge-case scenarios."""

    def test_approve_nonexistent_order_raises(self, service: ApprovalService) -> None:
        """Approving a non-existent order must raise ValidationError."""
        with pytest.raises(ValidationError, match="not found"):
            service.approve("nonexistent-id", OPERATOR_DEPT_MGR, expected_version=1)

    def test_reject_nonexistent_order_raises(self, service: ApprovalService) -> None:
        """Rejecting a non-existent order must raise ValidationError."""
        with pytest.raises(ValidationError, match="not found"):
            service.reject(
                "nonexistent-id", OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="any",
            )

    def test_cancel_nonexistent_order_raises(self, service: ApprovalService) -> None:
        """Cancelling a non-existent order must raise ValidationError."""
        with pytest.raises(ValidationError, match="not found"):
            service.cancel("nonexistent-id", "user-001", expected_version=1)

    def test_rejection_reason_exactly_500_chars_accepted(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """rejectionReason of exactly 500 characters must be accepted."""
        service.save_order(level1_order)
        reason = "A" * 500
        result = service.reject(
            level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
            rejection_reason=reason,
        )
        assert result.status == OrderStatus.REJECTED

    def test_rejection_reason_501_chars_rejected(self, service: ApprovalService, level1_order: WorkOrder) -> None:
        """rejectionReason of 501 characters must be rejected."""
        service.save_order(level1_order)
        reason = "A" * 501
        with pytest.raises(ValidationError, match="must not exceed 500"):
            service.reject(
                level1_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason=reason,
            )

    def test_order_status_unchanged_after_failed_transition(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Failed transition must not alter the order's status or version."""
        service.save_order(pending_order)
        original_status = pending_order.status
        original_version = pending_order.version
        with pytest.raises(StateTransitionError):
            service.reject(
                pending_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="invalid",
            )
        assert pending_order.status == original_status
        assert pending_order.version == original_version

    def test_no_record_created_after_failed_transition(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """Failed transition must not create an approval record."""
        service.save_order(pending_order)
        with pytest.raises(StateTransitionError):
            service.reject(
                pending_order.id, OPERATOR_DEPT_MGR, expected_version=1,
                rejection_reason="invalid",
            )
        records = service.get_records_for_order(pending_order.id)
        assert len(records) == 0

    def test_work_order_to_dict_includes_approval_records(self, service: ApprovalService, pending_order: WorkOrder) -> None:
        """WorkOrder.to_dict must include serialized approval records."""
        service.save_order(pending_order)
        service.approve(pending_order.id, OPERATOR_DEPT_MGR, expected_version=1)
        d = pending_order.to_dict()
        assert "approval_records" in d
        assert len(d["approval_records"]) == 1
        assert d["approval_records"][0]["action"] == "APPROVE"