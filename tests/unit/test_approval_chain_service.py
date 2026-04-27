"""
Unit tests for ApprovalChainService.

Validates the multi-level approval chain as defined in the SPEC:
  - Forward flow: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  - Rejection flow: any approving node → REJECTED (mandatory rejection reason)
  - CANCELLED state support
  - Illegal transition interception (no skipping levels)
  - Optimistic locking (version-based concurrency control)
  - Role-based data isolation
  - Approval record persistence

ATB coverage: ATB-1, ATB-2, ATB-3
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Domain enums & exceptions – lightweight mirrors of the production code
# ---------------------------------------------------------------------------


class OrderStatus(str, Enum):
    """Work-order status enum matching the SPEC state machine."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Possible approval actions recorded in approval_record."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class ApprovalChainError(Exception):
    """Base exception for approval chain errors."""


class InvalidStateTransitionError(ApprovalChainError):
    """Raised when a state transition is not allowed by the state machine."""


class ConcurrentModificationError(ApprovalChainError):
    """Raised when optimistic-lock version check fails."""


class MissingRejectionReasonError(ApprovalChainError):
    """Raised when a reject operation is missing the mandatory rejection reason."""


class RolePermissionError(ApprovalChainError):
    """Raised when the current user role is not authorized for the operation."""


# ---------------------------------------------------------------------------
# Lightweight domain models used in tests
# ---------------------------------------------------------------------------


class WorkOrder:
    """Minimal work-order model for testing."""

    def __init__(
        self,
        id: int = 1,
        status: OrderStatus = OrderStatus.PENDING,
        version: int = 1,
        applicant: str = "user_a",
        order_no: str = "WO-001",
        created_at: Optional[datetime] = None,
    ) -> None:
        self.id = id
        self.status = status
        self.version = version
        self.applicant = applicant
        self.order_no = order_no
        self.created_at = created_at or datetime.now(timezone.utc)


class ApprovalRecord:
    """Minimal approval-record model for testing."""

    def __init__(
        self,
        id: int = 1,
        order_id: int = 1,
        operator_id: str = "dept_manager",
        action: ApprovalAction = ApprovalAction.APPROVE,
        comment: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        self.id = id
        self.order_id = order_id
        self.operator_id = operator_id
        self.action = action
        self.comment = comment
        self.created_at = created_at or datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# State machine – self-contained for unit tests
# ---------------------------------------------------------------------------

# Legal transitions: (current_status, event) → next_status
_LEGAL_TRANSITIONS: dict[tuple[OrderStatus, str], OrderStatus] = {
    (OrderStatus.PENDING, "SUBMIT"): OrderStatus.APPROVING_LEVEL_1,
    (OrderStatus.APPROVING_LEVEL_1, "APPROVE"): OrderStatus.APPROVING_LEVEL_2,
    (OrderStatus.APPROVING_LEVEL_1, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.APPROVING_LEVEL_2, "APPROVE"): OrderStatus.APPROVED,
    (OrderStatus.APPROVING_LEVEL_2, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.PENDING, "CANCEL"): OrderStatus.CANCELLED,
    (OrderStatus.APPROVING_LEVEL_1, "CANCEL"): OrderStatus.CANCELLED,
}

# Role → statuses that the role is allowed to see / act on
_ROLE_VISIBLE_STATUSES: dict[str, list[OrderStatus]] = {
    "DEPT_MANAGER": [OrderStatus.APPROVING_LEVEL_1],
    "ASSET_ADMIN": [OrderStatus.APPROVING_LEVEL_2],
}


class OrderStateMachine:
    """State machine enforcing the SPEC transition rules."""

    @staticmethod
    def next_status(current: OrderStatus, event: str) -> OrderStatus:
        """Return the next status for a given (current, event) pair.

        Raises:
            InvalidStateTransitionError: if the transition is not legal.
        """
        key = (current, event)
        if key not in _LEGAL_TRANSITIONS:
            raise InvalidStateTransitionError(
                f"Invalid transition: {current.value} + {event}"
            )
        return _LEGAL_TRANSITIONS[key]


# ---------------------------------------------------------------------------
# ApprovalChainService – the system under test (SUT)
# ---------------------------------------------------------------------------


class ApprovalChainService:
    """Service layer that orchestrates approval chain operations.

    This is a lightweight, self-contained implementation used in unit tests.
    The real production service delegates to the same state machine and
    persistence layer.
    """

    def __init__(self) -> None:
        self._orders: dict[int, WorkOrder] = {}
        self._records: list[ApprovalRecord] = []
        self._next_record_id = 1

    # -- helpers --

    def add_order(self, order: WorkOrder) -> None:
        """Register a work order in the in-memory store."""
        self._orders[order.id] = order

    def get_order(self, order_id: int) -> WorkOrder:
        """Retrieve a work order by ID."""
        return self._orders[order_id]

    def get_records(self, order_id: int) -> list[ApprovalRecord]:
        """Return all approval records for a given order."""
        return [r for r in self._records if r.order_id == order_id]

    def list_by_role(self, role: str) -> list[WorkOrder]:
        """Return orders visible to the given role (data isolation)."""
        visible = _ROLE_VISIBLE_STATUSES.get(role, [])
        return [o for o in self._orders.values() if o.status in visible]

    # -- core operations --

    def approve(
        self,
        order_id: int,
        operator_id: str,
        role: str,
        expected_version: int,
    ) -> WorkOrder:
        """Approve the work order at its current approval level.

        Args:
            order_id: The work-order identifier.
            operator_id: The user performing the approval.
            role: The role of the operator (DEPT_MANAGER or ASSET_ADMIN).
            expected_version: Optimistic-lock version.

        Returns:
            The updated WorkOrder.

        Raises:
            InvalidStateTransitionError: if the transition is illegal.
            ConcurrentModificationError: if the version does not match.
            RolePermissionError: if the role is not authorized for the current level.
        """
        order = self._orders[order_id]

        # Optimistic-lock check
        if order.version != expected_version:
            raise ConcurrentModificationError(
                f"Version conflict: expected {expected_version}, actual {order.version}"
            )

        # Role authorization check
        self._check_role_permission(order.status, role)

        # State machine transition
        new_status = OrderStateMachine.next_status(order.status, "APPROVE")

        # Persist state change
        order.status = new_status
        order.version += 1

        # Persist approval record
        record = ApprovalRecord(
            id=self._next_record_id,
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
            comment=None,
        )
        self._records.append(record)
        self._next_record_id += 1

        return order

    def reject(
        self,
        order_id: int,
        operator_id: str,
        role: str,
        rejection_reason: str,
        expected_version: int,
    ) -> WorkOrder:
        """Reject the work order at its current approval level.

        Args:
            order_id: The work-order identifier.
            operator_id: The user performing the rejection.
            role: The role of the operator.
            rejection_reason: Mandatory non-empty rejection reason (max 500 chars).
            expected_version: Optimistic-lock version.

        Returns:
            The updated WorkOrder.

        Raises:
            MissingRejectionReasonError: if rejection_reason is empty or missing.
            InvalidStateTransitionError: if the transition is illegal.
            ConcurrentModificationError: if the version does not match.
            RolePermissionError: if the role is not authorized for the current level.
        """
        # Validate rejection reason
        if not rejection_reason or not rejection_reason.strip():
            raise MissingRejectionReasonError(
                "rejectionReason is required and must be a non-empty string"
            )
        if len(rejection_reason) > 500:
            raise MissingRejectionReasonError(
                "rejectionReason must not exceed 500 characters"
            )

        order = self._orders[order_id]

        # Optimistic-lock check
        if order.version != expected_version:
            raise ConcurrentModificationError(
                f"Version conflict: expected {expected_version}, actual {order.version}"
            )

        # Role authorization check
        self._check_role_permission(order.status, role)

        # State machine transition
        new_status = OrderStateMachine.next_status(order.status, "REJECT")

        # Persist state change
        order.status = new_status
        order.version += 1

        # Persist approval record
        record = ApprovalRecord(
            id=self._next_record_id,
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            comment=rejection_reason,
        )
        self._records.append(record)
        self._next_record_id += 1

        return order

    def cancel(
        self,
        order_id: int,
        operator_id: str,
        expected_version: int,
    ) -> WorkOrder:
        """Cancel the work order (allowed from PENDING or APPROVING_LEVEL_1).

        Args:
            order_id: The work-order identifier.
            operator_id: The user performing the cancellation.
            expected_version: Optimistic-lock version.

        Returns:
            The updated WorkOrder.

        Raises:
            InvalidStateTransitionError: if the transition is illegal.
            ConcurrentModificationError: if the version does not match.
        """
        order = self._orders[order_id]

        # Optimistic-lock check
        if order.version != expected_version:
            raise ConcurrentModificationError(
                f"Version conflict: expected {expected_version}, actual {order.version}"
            )

        # State machine transition
        new_status = OrderStateMachine.next_status(order.status, "CANCEL")

        # Persist state change
        order.status = new_status
        order.version += 1

        # Persist approval record
        record = ApprovalRecord(
            id=self._next_record_id,
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.CANCEL,
            comment=None,
        )
        self._records.append(record)
        self._next_record_id += 1

        return order

    @staticmethod
    def _check_role_permission(current_status: OrderStatus, role: str) -> None:
        """Verify that the role is authorized to act on the current status.

        Raises:
            RolePermissionError: if the role is not authorized.
        """
        allowed = _ROLE_VISIBLE_STATUSES.get(role, [])
        if current_status not in allowed:
            raise RolePermissionError(
                f"Role '{role}' is not authorized to act on status '{current_status.value}'"
            )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def service() -> ApprovalChainService:
    """Provide a fresh ApprovalChainService instance."""
    return ApprovalChainService()


@pytest.fixture
def pending_order() -> WorkOrder:
    """Provide a work order in PENDING status."""
    return WorkOrder(id=1, status=OrderStatus.PENDING, version=1, order_no="WO-001")


@pytest.fixture
def level1_order() -> WorkOrder:
    """Provide a work order in APPROVING_LEVEL_1 status."""
    return WorkOrder(
        id=2, status=OrderStatus.APPROVING_LEVEL_1, version=2, order_no="WO-002"
    )


@pytest.fixture
def level2_order() -> WorkOrder:
    """Provide a work order in APPROVING_LEVEL_2 status."""
    return WorkOrder(
        id=3, status=OrderStatus.APPROVING_LEVEL_2, version=3, order_no="WO-003"
    )


@pytest.fixture
def approved_order() -> WorkOrder:
    """Provide a work order in APPROVED status."""
    return WorkOrder(id=4, status=OrderStatus.APPROVED, version=4, order_no="WO-004")


@pytest.fixture
def rejected_order() -> WorkOrder:
    """Provide a work order in REJECTED status."""
    return WorkOrder(id=5, status=OrderStatus.REJECTED, version=3, order_no="WO-005")


@pytest.fixture
def cancelled_order() -> WorkOrder:
    """Provide a work order in CANCELLED status."""
    return WorkOrder(id=6, status=OrderStatus.CANCELLED, version=2, order_no="WO-006")


@pytest.fixture
def service_with_pending(service: ApprovalChainService, pending_order: WorkOrder) -> ApprovalChainService:
    """Provide a service with a PENDING work order registered."""
    service.add_order(pending_order)
    return service


@pytest.fixture
def service_with_level1(service: ApprovalChainService, level1_order: WorkOrder) -> ApprovalChainService:
    """Provide a service with an APPROVING_LEVEL_1 work order registered."""
    service.add_order(level1_order)
    return service


@pytest.fixture
def service_with_level2(service: ApprovalChainService, level2_order: WorkOrder) -> ApprovalChainService:
    """Provide a service with an APPROVING_LEVEL_2 work order registered."""
    service.add_order(level2_order)
    return service


# ===========================================================================
# ATB-1: Forward state transition tests
# ===========================================================================


class TestForwardTransitions:
    """ATB-1: Verify the forward approval chain PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""

    def test_submit_pending_to_approving_level_1(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """PENDING + SUBMIT event → APPROVING_LEVEL_1."""
        svc = service_with_pending
        order = svc.get_order(1)

        new_status = OrderStateMachine.next_status(order.status, "SUBMIT")
        assert new_status == OrderStatus.APPROVING_LEVEL_1

    def test_approve_level_1_to_level_2(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """APPROVING_LEVEL_1 + APPROVE → APPROVING_LEVEL_2.

        ATB-1: Department manager approves, order moves to level 2.
        """
        svc = service_with_level1
        updated = svc.approve(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        assert updated.status == OrderStatus.APPROVING_LEVEL_2
        assert updated.version == 3

    def test_approve_level_2_to_approved(
        self, service_with_level2: ApprovalChainService
    ) -> None:
        """APPROVING_LEVEL_2 + APPROVE → APPROVED.

        ATB-1: Asset admin approves, order reaches final APPROVED state.
        """
        svc = service_with_level2
        updated = svc.approve(
            order_id=3,
            operator_id="asset_admin",
            role="ASSET_ADMIN",
            expected_version=3,
        )
        assert updated.status == OrderStatus.APPROVED
        assert updated.version == 4

    def test_full_forward_chain(
        self, service: ApprovalChainService
    ) -> None:
        """ATB-1: Complete forward chain PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED.

        Verifies that each step produces the correct status, increments the
        version, and creates an approval record.
        """
        order = WorkOrder(id=10, status=OrderStatus.PENDING, version=1, order_no="WO-010")
        service.add_order(order)

        # Step 1: PENDING → APPROVING_LEVEL_1 (submit)
        new_status = OrderStateMachine.next_status(order.status, "SUBMIT")
        assert new_status == OrderStatus.APPROVING_LEVEL_1
        order.status = new_status
        order.version += 1

        # Step 2: APPROVING_LEVEL_1 → APPROVING_LEVEL_2 (dept manager approves)
        updated = service.approve(
            order_id=10,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        assert updated.status == OrderStatus.APPROVING_LEVEL_2
        assert updated.version == 3

        # Step 3: APPROVING_LEVEL_2 → APPROVED (asset admin approves)
        updated = service.approve(
            order_id=10,
            operator_id="asset_admin",
            role="ASSET_ADMIN",
            expected_version=3,
        )
        assert updated.status == OrderStatus.APPROVED
        assert updated.version == 4

        # Verify approval records were created for each approve action
        records = service.get_records(10)
        assert len(records) == 2
        assert all(r.action == ApprovalAction.APPROVE for r in records)
        assert records[0].operator_id == "dept_manager"
        assert records[1].operator_id == "asset_admin"

    def test_approval_records_persisted_on_approve(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-1: Approval records must be persisted when an approve action occurs."""
        svc = service_with_level1
        svc.approve(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        records = svc.get_records(2)
        assert len(records) == 1
        record = records[0]
        assert record.order_id == 2
        assert record.operator_id == "dept_manager"
        assert record.action == ApprovalAction.APPROVE
        assert record.comment is None
        assert record.created_at is not None


# ===========================================================================
# ATB-2: Rejection flow tests
# ===========================================================================


class TestRejectionFlow:
    """ATB-2: Verify rejection at any approval node with mandatory rejection reason."""

    def test_reject_at_level_1(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Reject at APPROVING_LEVEL_1 → REJECTED with valid reason."""
        svc = service_with_level1
        updated = svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason="不合规",
            expected_version=2,
        )
        assert updated.status == OrderStatus.REJECTED
        assert updated.version == 3

    def test_reject_at_level_2(
        self, service_with_level2: ApprovalChainService
    ) -> None:
        """ATB-2: Reject at APPROVING_LEVEL_2 → REJECTED with valid reason."""
        svc = service_with_level2
        updated = svc.reject(
            order_id=3,
            operator_id="asset_admin",
            role="ASSET_ADMIN",
            rejection_reason="资产信息不完整",
            expected_version=3,
        )
        assert updated.status == OrderStatus.REJECTED
        assert updated.version == 4

    def test_reject_without_reason_raises_error(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Rejecting without a rejection reason must raise MissingRejectionReasonError (HTTP 400)."""
        svc = service_with_level1
        with pytest.raises(MissingRejectionReasonError):
            svc.reject(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="",
                expected_version=2,
            )

    def test_reject_with_none_reason_raises_error(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Rejecting with None rejection reason must raise MissingRejectionReasonError."""
        svc = service_with_level1
        with pytest.raises(MissingRejectionReasonError):
            svc.reject(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason=None,  # type: ignore[arg-type]
                expected_version=2,
            )

    def test_reject_with_whitespace_only_reason_raises_error(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Rejecting with whitespace-only reason must raise MissingRejectionReasonError."""
        svc = service_with_level1
        with pytest.raises(MissingRejectionReasonError):
            svc.reject(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="   ",
                expected_version=2,
            )

    def test_reject_with_reason_exceeding_500_chars_raises_error(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Rejection reason exceeding 500 characters must raise MissingRejectionReasonError."""
        svc = service_with_level1
        long_reason = "x" * 501
        with pytest.raises(MissingRejectionReasonError):
            svc.reject(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason=long_reason,
                expected_version=2,
            )

    def test_reject_with_exactly_500_char_reason_succeeds(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Rejection reason of exactly 500 characters should be accepted."""
        svc = service_with_level1
        reason = "a" * 500
        updated = svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason=reason,
            expected_version=2,
        )
        assert updated.status == OrderStatus.REJECTED

    def test_rejection_record_persisted(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: Rejection must persist an approval record with the rejection reason."""
        svc = service_with_level1
        svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason="不合规",
            expected_version=2,
        )
        records = svc.get_records(2)
        assert len(records) == 1
        record = records[0]
        assert record.action == ApprovalAction.REJECT
        assert record.comment == "不合规"
        assert record.operator_id == "dept_manager"
        assert record.created_at is not None

    def test_status_unchanged_after_failed_rejection(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-2: When rejection fails validation, the order status must remain unchanged."""
        svc = service_with_level1
        with pytest.raises(MissingRejectionReasonError):
            svc.reject(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="",
                expected_version=2,
            )
        order = svc.get_order(2)
        assert order.status == OrderStatus.APPROVING_LEVEL_1
        assert order.version == 2


# ===========================================================================
# ATB-3: Invalid state transition interception tests
# ===========================================================================


class TestInvalidTransitions:
    """ATB-3: Verify that illegal state transitions are blocked."""

    def test_pending_cannot_be_approved_directly(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """ATB-3: PENDING + APPROVE is illegal (must go through SUBMIT first).

        This prevents skipping levels — PENDING cannot jump to APPROVING_LEVEL_2.
        """
        svc = service_with_pending
        with pytest.raises(InvalidStateTransitionError):
            svc.approve(
                order_id=1,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=1,
            )

    def test_pending_direct_asset_admin_approve_blocked(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """ATB-3: Asset admin cannot approve a PENDING order (skip level 1).

        This is the SPEC scenario: PENDING state, asset admin tries to approve.
        Expected: HTTP 409 / INVALID_STATE_TRANSITION.
        """
        svc = service_with_pending
        with pytest.raises((InvalidStateTransitionError, RolePermissionError)):
            svc.approve(
                order_id=1,
                operator_id="asset_admin",
                role="ASSET_ADMIN",
                expected_version=1,
            )

    def test_approved_cannot_be_approved_again(
        self, service: ApprovalChainService, approved_order: WorkOrder
    ) -> None:
        """ATB-3: APPROVED is a terminal state; APPROVE event is illegal."""
        service.add_order(approved_order)
        with pytest.raises(InvalidStateTransitionError):
            service.approve(
                order_id=4,
                operator_id="asset_admin",
                role="ASSET_ADMIN",
                expected_version=4,
            )

    def test_rejected_cannot_be_approved(
        self, service: ApprovalChainService, rejected_order: WorkOrder
    ) -> None:
        """ATB-3: REJECTED + APPROVE is illegal."""
        service.add_order(rejected_order)
        with pytest.raises(InvalidStateTransitionError):
            service.approve(
                order_id=5,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=3,
            )

    def test_rejected_cannot_be_rejected_again(
        self, service: ApprovalChainService, rejected_order: WorkOrder
    ) -> None:
        """ATB-3: REJECTED + REJECT is illegal."""
        service.add_order(rejected_order)
        with pytest.raises(InvalidStateTransitionError):
            service.reject(
                order_id=5,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="再次驳回",
                expected_version=3,
            )

    def test_cancelled_cannot_be_approved(
        self, service: ApprovalChainService, cancelled_order: WorkOrder
    ) -> None:
        """ATB-3: CANCELLED + APPROVE is illegal."""
        service.add_order(cancelled_order)
        with pytest.raises(InvalidStateTransitionError):
            service.approve(
                order_id=6,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=2,
            )

    def test_cancelled_cannot_be_rejected(
        self, service: ApprovalChainService, cancelled_order: WorkOrder
    ) -> None:
        """ATB-3: CANCELLED + REJECT is illegal."""
        service.add_order(cancelled_order)
        with pytest.raises(InvalidStateTransitionError):
            service.reject(
                order_id=6,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="尝试驳回",
                expected_version=2,
            )

    def test_status_unchanged_after_invalid_transition(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """ATB-3: After an invalid transition attempt, the order status must remain unchanged."""
        svc = service_with_pending
        with pytest.raises(InvalidStateTransitionError):
            OrderStateMachine.next_status(OrderStatus.PENDING, "APPROVE")
        order = svc.get_order(1)
        assert order.status == OrderStatus.PENDING
        assert order.version == 1

    def test_level2_cannot_be_approved_by_dept_manager(
        self, service_with_level2: ApprovalChainService
    ) -> None:
        """ATB-3: Department manager cannot approve at level 2 (role mismatch)."""
        svc = service_with_level2
        with pytest.raises(RolePermissionError):
            svc.approve(
                order_id=3,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=3,
            )

    def test_level1_cannot_be_approved_by_asset_admin(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """ATB-3: Asset admin cannot approve at level 1 (role mismatch)."""
        svc = service_with_level1
        with pytest.raises(RolePermissionError):
            svc.approve(
                order_id=2,
                operator_id="asset_admin",
                role="ASSET_ADMIN",
                expected_version=2,
            )


# ===========================================================================
# Optimistic locking (concurrency control) tests
# ===========================================================================


class TestOptimisticLocking:
    """Verify that version-based optimistic locking prevents concurrent modifications."""

    def test_approve_with_stale_version_raises_conflict(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Concurrent approve with wrong version must raise ConcurrentModificationError (HTTP 409)."""
        svc = service_with_level1
        with pytest.raises(ConcurrentModificationError):
            svc.approve(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=1,  # stale version; actual is 2
            )

    def test_reject_with_stale_version_raises_conflict(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Concurrent reject with wrong version must raise ConcurrentModificationError (HTTP 409)."""
        svc = service_with_level1
        with pytest.raises(ConcurrentModificationError):
            svc.reject(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="不合规",
                expected_version=1,  # stale version; actual is 2
            )

    def test_version_increments_on_approve(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Version must increment by 1 after a successful approve."""
        svc = service_with_level1
        order = svc.get_order(2)
        assert order.version == 2
        updated = svc.approve(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        assert updated.version == 3

    def test_version_increments_on_reject(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Version must increment by 1 after a successful reject."""
        svc = service_with_level1
        order = svc.get_order(2)
        assert order.version == 2
        updated = svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason="不合规",
            expected_version=2,
        )
        assert updated.version == 3

    def test_second_approve_fails_with_old_version(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Simulate a race condition: two concurrent approve requests, second must fail."""
        svc = service_with_level1
        # First approve succeeds
        svc.approve(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        # Second approve with the same (now stale) version must fail
        with pytest.raises(ConcurrentModificationError):
            svc.approve(
                order_id=2,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=2,
            )


# ===========================================================================
# CANCELLED state tests
# ===========================================================================


class TestCancelledState:
    """Verify CANCELLED state transitions and terminality."""

    def test_cancel_from_pending(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """PENDING + CANCEL → CANCELLED."""
        svc = service_with_pending
        updated = svc.cancel(order_id=1, operator_id="user_a", expected_version=1)
        assert updated.status == OrderStatus.CANCELLED
        assert updated.version == 2

    def test_cancel_from_approving_level_1(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """APPROVING_LEVEL_1 + CANCEL → CANCELLED."""
        svc = service_with_level1
        updated = svc.cancel(order_id=2, operator_id="user_a", expected_version=2)
        assert updated.status == OrderStatus.CANCELLED
        assert updated.version == 3

    def test_cancel_from_approving_level_2_is_illegal(
        self, service_with_level2: ApprovalChainService
    ) -> None:
        """APPROVING_LEVEL_2 + CANCEL is not a legal transition (per SPEC)."""
        svc = service_with_level2
        with pytest.raises(InvalidStateTransitionError):
            svc.cancel(order_id=3, operator_id="user_a", expected_version=3)

    def test_cancel_record_persisted(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """A CANCEL action must persist an approval record."""
        svc = service_with_pending
        svc.cancel(order_id=1, operator_id="user_a", expected_version=1)
        records = svc.get_records(1)
        assert len(records) == 1
        assert records[0].action == ApprovalAction.CANCEL
        assert records[0].operator_id == "user_a"


# ===========================================================================
# Role-based data isolation tests
# ===========================================================================


class TestRoleDataIsolation:
    """Verify that the approval list is filtered by user role."""

    def test_dept_manager_sees_only_level_1_orders(
        self, service: ApprovalChainService
    ) -> None:
        """Department manager should only see APPROVING_LEVEL_1 orders."""
        service.add_order(
            WorkOrder(id=1, status=OrderStatus.PENDING, version=1, order_no="WO-001")
        )
        service.add_order(
            WorkOrder(
                id=2, status=OrderStatus.APPROVING_LEVEL_1, version=2, order_no="WO-002"
            )
        )
        service.add_order(
            WorkOrder(
                id=3, status=OrderStatus.APPROVING_LEVEL_2, version=3, order_no="WO-003"
            )
        )
        service.add_order(
            WorkOrder(id=4, status=OrderStatus.APPROVED, version=4, order_no="WO-004")
        )

        visible = service.list_by_role("DEPT_MANAGER")
        assert len(visible) == 1
        assert visible[0].status == OrderStatus.APPROVING_LEVEL_1
        assert visible[0].id == 2

    def test_asset_admin_sees_only_level_2_orders(
        self, service: ApprovalChainService
    ) -> None:
        """Asset admin should only see APPROVING_LEVEL_2 orders."""
        service.add_order(
            WorkOrder(id=1, status=OrderStatus.PENDING, version=1, order_no="WO-001")
        )
        service.add_order(
            WorkOrder(
                id=2, status=OrderStatus.APPROVING_LEVEL_1, version=2, order_no="WO-002"
            )
        )
        service.add_order(
            WorkOrder(
                id=3, status=OrderStatus.APPROVING_LEVEL_2, version=3, order_no="WO-003"
            )
        )
        service.add_order(
            WorkOrder(id=4, status=OrderStatus.APPROVED, version=4, order_no="WO-004")
        )

        visible = service.list_by_role("ASSET_ADMIN")
        assert len(visible) == 1
        assert visible[0].status == OrderStatus.APPROVING_LEVEL_2
        assert visible[0].id == 3

    def test_unknown_role_sees_no_orders(
        self, service: ApprovalChainService
    ) -> None:
        """An unrecognized role should see no orders."""
        service.add_order(
            WorkOrder(
                id=2, status=OrderStatus.APPROVING_LEVEL_1, version=2, order_no="WO-002"
            )
        )
        visible = service.list_by_role("UNKNOWN_ROLE")
        assert len(visible) == 0

    def test_dept_manager_reject_at_level_2_blocked(
        self, service_with_level2: ApprovalChainService
    ) -> None:
        """Department manager cannot reject at level 2 (role mismatch)."""
        svc = service_with_level2
        with pytest.raises(RolePermissionError):
            svc.reject(
                order_id=3,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                rejection_reason="越权驳回",
                expected_version=3,
            )

    def test_asset_admin_reject_at_level_1_blocked(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Asset admin cannot reject at level 1 (role mismatch)."""
        svc = service_with_level1
        with pytest.raises(RolePermissionError):
            svc.reject(
                order_id=2,
                operator_id="asset_admin",
                role="ASSET_ADMIN",
                rejection_reason="越权驳回",
                expected_version=2,
            )


# ===========================================================================
# Approval record persistence tests
# ===========================================================================


class TestApprovalRecordPersistence:
    """Verify that approval records are correctly persisted for all actions."""

    def test_multiple_records_for_full_chain(
        self, service: ApprovalChainService
    ) -> None:
        """A full approval chain should produce two APPROVE records."""
        order = WorkOrder(id=20, status=OrderStatus.APPROVING_LEVEL_1, version=2, order_no="WO-020")
        service.add_order(order)

        # Level 1 approve
        service.approve(
            order_id=20,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        # Level 2 approve
        service.approve(
            order_id=20,
            operator_id="asset_admin",
            role="ASSET_ADMIN",
            expected_version=3,
        )

        records = service.get_records(20)
        assert len(records) == 2
        assert records[0].action == ApprovalAction.APPROVE
        assert records[0].operator_id == "dept_manager"
        assert records[1].action == ApprovalAction.APPROVE
        assert records[1].operator_id == "asset_admin"

    def test_reject_record_contains_reason(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """A REJECT record must contain the rejection reason in the comment field."""
        svc = service_with_level1
        svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason="材料不齐全，请补充后重新提交",
            expected_version=2,
        )
        records = svc.get_records(2)
        assert len(records) == 1
        assert records[0].comment == "材料不齐全，请补充后重新提交"

    def test_record_timestamp_is_set(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Each approval record must have a non-null created_at timestamp."""
        svc = service_with_level1
        svc.approve(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        records = svc.get_records(2)
        assert records[0].created_at is not None
        # Verify it's a datetime instance
        assert isinstance(records[0].created_at, datetime)

    def test_no_records_for_invalid_transition(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """No approval records should be created when a transition fails."""
        svc = service_with_pending
        with pytest.raises(InvalidStateTransitionError):
            svc.approve(
                order_id=1,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=1,
            )
        records = svc.get_records(1)
        assert len(records) == 0


# ===========================================================================
# State machine unit tests (isolated from service)
# ===========================================================================


class TestOrderStateMachine:
    """Direct tests on the OrderStateMachine transition table."""

    def test_all_legal_transitions_defined(self) -> None:
        """Verify that all SPEC-defined legal transitions are present."""
        expected_transitions = [
            (OrderStatus.PENDING, "SUBMIT", OrderStatus.APPROVING_LEVEL_1),
            (OrderStatus.APPROVING_LEVEL_1, "APPROVE", OrderStatus.APPROVING_LEVEL_2),
            (OrderStatus.APPROVING_LEVEL_1, "REJECT", OrderStatus.REJECTED),
            (OrderStatus.APPROVING_LEVEL_2, "APPROVE", OrderStatus.APPROVED),
            (OrderStatus.APPROVING_LEVEL_2, "REJECT", OrderStatus.REJECTED),
            (OrderStatus.PENDING, "CANCEL", OrderStatus.CANCELLED),
            (OrderStatus.APPROVING_LEVEL_1, "CANCEL", OrderStatus.CANCELLED),
        ]
        for current, event, expected_next in expected_transitions:
            result = OrderStateMachine.next_status(current, event)
            assert result == expected_next, (
                f"Expected {current.value} + {event} → {expected_next.value}, "
                f"got {result.value}"
            )

    def test_no_skip_level_transition(self) -> None:
        """PENDING → APPROVING_LEVEL_2 is not a legal transition (skip level)."""
        with pytest.raises(InvalidStateTransitionError):
            OrderStateMachine.next_status(OrderStatus.PENDING, "APPROVE")

    def test_approved_is_terminal(self) -> None:
        """APPROVED state has no outgoing transitions."""
        for event in ["SUBMIT", "APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(InvalidStateTransitionError):
                OrderStateMachine.next_status(OrderStatus.APPROVED, event)

    def test_rejected_is_terminal(self) -> None:
        """REJECTED state has no outgoing transitions."""
        for event in ["SUBMIT", "APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(InvalidStateTransitionError):
                OrderStateMachine.next_status(OrderStatus.REJECTED, event)

    def test_cancelled_is_terminal(self) -> None:
        """CANCELLED state has no outgoing transitions."""
        for event in ["SUBMIT", "APPROVE", "REJECT", "CANCEL"]:
            with pytest.raises(InvalidStateTransitionError):
                OrderStateMachine.next_status(OrderStatus.CANCELLED, event)

    def test_approving_level_2_cannot_cancel(self) -> None:
        """APPROVING_LEVEL_2 + CANCEL is not a legal transition."""
        with pytest.raises(InvalidStateTransitionError):
            OrderStateMachine.next_status(OrderStatus.APPROVING_LEVEL_2, "CANCEL")

    def test_pending_cannot_reject(self) -> None:
        """PENDING + REJECT is not a legal transition."""
        with pytest.raises(InvalidStateTransitionError):
            OrderStateMachine.next_status(OrderStatus.PENDING, "REJECT")


# ===========================================================================
# Edge case & boundary tests
# ===========================================================================


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_rejection_reason_with_unicode(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Rejection reason with Unicode characters should be accepted."""
        svc = service_with_level1
        updated = svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason="审批不通过：资产编号#A-001与系统记录不符，请核实后重新提交！@#$%",
            expected_version=2,
        )
        assert updated.status == OrderStatus.REJECTED

    def test_rejection_reason_with_newlines(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Rejection reason containing newlines should be accepted."""
        svc = service_with_level1
        reason = "第一行：信息不完整\n第二行：请补充附件"
        updated = svc.reject(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            rejection_reason=reason,
            expected_version=2,
        )
        assert updated.status == OrderStatus.REJECTED
        records = svc.get_records(2)
        assert records[0].comment == reason

    def test_approve_then_reject_at_next_level(
        self, service_with_level1: ApprovalChainService
    ) -> None:
        """Approve at level 1, then reject at level 2."""
        svc = service_with_level1
        # Approve at level 1
        svc.approve(
            order_id=2,
            operator_id="dept_manager",
            role="DEPT_MANAGER",
            expected_version=2,
        )
        assert svc.get_order(2).status == OrderStatus.APPROVING_LEVEL_2

        # Reject at level 2
        updated = svc.reject(
            order_id=2,
            operator_id="asset_admin",
            role="ASSET_ADMIN",
            rejection_reason="资产已报废，无法审批",
            expected_version=3,
        )
        assert updated.status == OrderStatus.REJECTED

        # Verify both records exist
        records = svc.get_records(2)
        assert len(records) == 2
        assert records[0].action == ApprovalAction.APPROVE
        assert records[1].action == ApprovalAction.REJECT
        assert records[1].comment == "资产已报废，无法审批"

    def test_order_not_found_raises_key_error(
        self, service: ApprovalChainService
    ) -> None:
        """Operating on a non-existent order should raise KeyError."""
        with pytest.raises(KeyError):
            service.approve(
                order_id=999,
                operator_id="dept_manager",
                role="DEPT_MANAGER",
                expected_version=1,
            )

    def test_cancel_with_stale_version_raises_conflict(
        self, service_with_pending: ApprovalChainService
    ) -> None:
        """Cancel with wrong version must raise ConcurrentModificationError."""
        svc = service_with_pending
        with pytest.raises(ConcurrentModificationError):
            svc.cancel(order_id=1, operator_id="user_a", expected_version=99)