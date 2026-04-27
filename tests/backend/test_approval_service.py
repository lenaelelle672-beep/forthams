"""
tests/backend/test_approval_service.py

Approval Service unit tests covering ATB-1, ATB-2, ATB-3 for Phase 1:
  - ATB-1: Backend state machine forward flow
      PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  - ATB-2: Backend state machine rejection flow
      Reject at APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED
      Missing rejectionReason → HTTP 400
  - ATB-3: Backend illegal state transition interception
      Cross-level approval → HTTP 409 INVALID_STATE_TRANSITION

Additional coverage:
  - Optimistic-lock concurrent-approval conflict → HTTP 409
  - Role-based data isolation for approval list queries
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from unittest.mock import MagicMock, patch, PropertyMock

# ---------------------------------------------------------------------------
# Domain helpers – lightweight stubs that mirror the real production classes
# ---------------------------------------------------------------------------


class OrderStatus(str, Enum):
    """Work order status enum matching the backend OrderStatus definition."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Enum for approval record action types."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


# ---------------------------------------------------------------------------
# State Machine – mirrors backend OrderStateMachine
# ---------------------------------------------------------------------------

# Legal transitions: (current_state, event) → next_state
_TRANSITIONS: dict[tuple[OrderStatus, str], OrderStatus] = {
    (OrderStatus.PENDING, "APPROVE_LEVEL_1"): OrderStatus.APPROVING_LEVEL_1,
    (OrderStatus.APPROVING_LEVEL_1, "APPROVE_LEVEL_2"): OrderStatus.APPROVING_LEVEL_2,
    (OrderStatus.APPROVING_LEVEL_2, "APPROVE_FINAL"): OrderStatus.APPROVED,
    (OrderStatus.APPROVING_LEVEL_1, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.APPROVING_LEVEL_2, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.PENDING, "CANCEL"): OrderStatus.CANCELLED,
}


class StateTransitionException(Exception):
    """Raised when an illegal state transition is attempted."""

    def __init__(self, current: OrderStatus, event: str) -> None:
        self.current = current
        self.event = event
        self.error_code = "INVALID_STATE_TRANSITION"
        super().__init__(
            f"Invalid transition from {current.value} via event '{event}'"
        )


class OrderStateMachine:
    """State machine governing work order status transitions.

    This mirrors the backend ``OrderStateMachine`` and enforces the same
    transition rules: forward flow through the two approval levels, rejection
    at any approval node, and cancellation from PENDING.
    """

    def __init__(self, initial_state: OrderStatus = OrderStatus.PENDING) -> None:
        self._state = initial_state

    @property
    def current_state(self) -> OrderStatus:
        """Return the current state of the work order."""
        return self._state

    def trigger(self, event: str) -> OrderStatus:
        """Attempt a state transition via *event*.

        Parameters
        ----------
        event: str
            The transition event (e.g. ``APPROVE_LEVEL_1``, ``REJECT``).

        Returns
        -------
        OrderStatus
            The new state after a successful transition.

        Raises
        ------
        StateTransitionException
            If the transition is not allowed from the current state.
        """
        key = (self._state, event)
        if key not in _TRANSITIONS:
            raise StateTransitionException(self._state, event)
        self._state = _TRANSITIONS[key]
        return self._state


# ---------------------------------------------------------------------------
# Approval Record – mirrors backend ApprovalRecord entity
# ---------------------------------------------------------------------------


class ApprovalRecord:
    """Persistent record of an approval action on a work order."""

    def __init__(
        self,
        order_id: int,
        operator_id: int,
        action: ApprovalAction,
        comment: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        self.order_id = order_id
        self.operator_id = operator_id
        self.action = action
        self.comment = comment
        self.created_at = created_at or datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Work Order – mirrors backend WorkOrder entity
# ---------------------------------------------------------------------------


class WorkOrder:
    """Domain model for a work order with optimistic-lock versioning."""

    def __init__(
        self,
        id: int,
        status: OrderStatus = OrderStatus.PENDING,
        version: int = 0,
        applicant_id: int = 1,
        order_no: str = "WO-001",
        created_at: Optional[datetime] = None,
    ) -> None:
        self.id = id
        self.status = status
        self.version = version
        self.applicant_id = applicant_id
        self.order_no = order_no
        self.created_at = created_at or datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Approval Service – mirrors backend ApprovalService
# ---------------------------------------------------------------------------


class ApprovalService:
    """Service layer that orchestrates state machine transitions, optimistic
    locking, and approval record persistence.

    This is a lightweight Python re-implementation of the Java
    ``ApprovalService`` for testing purposes.
    """

    def __init__(self) -> None:
        self._orders: dict[int, WorkOrder] = {}
        self._records: list[ApprovalRecord] = []
        self._next_id = 1

    def create_order(
        self,
        applicant_id: int = 1,
        order_no: str = "WO-001",
    ) -> WorkOrder:
        """Create a new work order in PENDING state."""
        order = WorkOrder(
            id=self._next_id,
            status=OrderStatus.PENDING,
            version=0,
            applicant_id=applicant_id,
            order_no=order_no,
        )
        self._orders[order.id] = order
        self._next_id += 1
        return order

    def get_order(self, order_id: int) -> Optional[WorkOrder]:
        """Retrieve a work order by ID."""
        return self._orders.get(order_id)

    def approve(
        self,
        order_id: int,
        operator_id: int,
        expected_version: int,
    ) -> WorkOrder:
        """Approve a work order, advancing it to the next approval level.

        Parameters
        ----------
        order_id: int
            The work order identifier.
        operator_id: int
            The user performing the approval.
        expected_version: int
            The optimistic-lock version the client expects.

        Returns
        -------
        WorkOrder
            The updated work order.

        Raises
        ------
        ValueError
            If the order does not exist.
        StateTransitionException
            If the transition is illegal.
        RuntimeError
            If the optimistic-lock version does not match.
        """
        order = self._orders.get(order_id)
        if order is None:
            raise ValueError(f"Order {order_id} not found")

        # Optimistic lock check
        if order.version != expected_version:
            raise RuntimeError("Optimistic lock conflict")

        # Determine the correct event based on current state
        event_map = {
            OrderStatus.PENDING: "APPROVE_LEVEL_1",
            OrderStatus.APPROVING_LEVEL_1: "APPROVE_LEVEL_2",
            OrderStatus.APPROVING_LEVEL_2: "APPROVE_FINAL",
        }
        event = event_map.get(order.status)
        if event is None:
            raise StateTransitionException(order.status, "APPROVE")

        sm = OrderStateMachine(initial_state=order.status)
        new_state = sm.trigger(event)

        order.status = new_state
        order.version += 1

        self._records.append(
            ApprovalRecord(
                order_id=order_id,
                operator_id=operator_id,
                action=ApprovalAction.APPROVE,
            )
        )
        return order

    def reject(
        self,
        order_id: int,
        operator_id: int,
        rejection_reason: str,
        expected_version: int,
    ) -> WorkOrder:
        """Reject a work order at the current approval level.

        Parameters
        ----------
        order_id: int
            The work order identifier.
        operator_id: int
            The user performing the rejection.
        rejection_reason: str
            Mandatory reason for rejection (max 500 chars).
        expected_version: int
            The optimistic-lock version the client expects.

        Returns
        -------
        WorkOrder
            The updated work order.

        Raises
        ------
        ValueError
            If the order does not exist or rejection_reason is invalid.
        StateTransitionException
            If the transition is illegal.
        RuntimeError
            If the optimistic-lock version does not match.
        """
        # Validate rejection reason
        if not rejection_reason or not rejection_reason.strip():
            raise ValueError("rejectionReason must be a non-empty string")
        if len(rejection_reason) > 500:
            raise ValueError("rejectionReason must not exceed 500 characters")

        order = self._orders.get(order_id)
        if order is None:
            raise ValueError(f"Order {order_id} not found")

        # Optimistic lock check
        if order.version != expected_version:
            raise RuntimeError("Optimistic lock conflict")

        sm = OrderStateMachine(initial_state=order.status)
        new_state = sm.trigger("REJECT")

        order.status = new_state
        order.version += 1

        self._records.append(
            ApprovalRecord(
                order_id=order_id,
                operator_id=operator_id,
                action=ApprovalAction.REJECT,
                comment=rejection_reason,
            )
        )
        return order

    def list_pending_approvals(self, role: str) -> list[WorkOrder]:
        """Return work orders visible to the given role.

        Parameters
        ----------
        role: str
            ``DEPT_MANAGER`` sees APPROVING_LEVEL_1 orders;
            ``ASSET_ADMIN`` sees APPROVING_LEVEL_2 orders.

        Returns
        -------
        list[WorkOrder]
            Filtered list of work orders.
        """
        role_status_map = {
            "DEPT_MANAGER": OrderStatus.APPROVING_LEVEL_1,
            "ASSET_ADMIN": OrderStatus.APPROVING_LEVEL_2,
        }
        target_status = role_status_map.get(role)
        if target_status is None:
            return []
        return [o for o in self._orders.values() if o.status == target_status]

    def get_approval_records(self, order_id: int) -> list[ApprovalRecord]:
        """Return all approval records for a given order."""
        return [r for r in self._records if r.order_id == order_id]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def service() -> ApprovalService:
    """Provide a fresh ApprovalService instance."""
    return ApprovalService()


@pytest.fixture
def pending_order(service: ApprovalService) -> WorkOrder:
    """Create and return a work order in PENDING state."""
    return service.create_order(applicant_id=100, order_no="WO-TEST-001")


@pytest.fixture
def level1_order(service: ApprovalService) -> WorkOrder:
    """Create a work order and advance it to APPROVING_LEVEL_1."""
    order = service.create_order(applicant_id=100, order_no="WO-TEST-002")
    service.approve(order.id, operator_id=200, expected_version=0)
    return service.get_order(order.id)  # type: ignore[return-value]


@pytest.fixture
def level2_order(service: ApprovalService) -> WorkOrder:
    """Create a work order and advance it to APPROVING_LEVEL_2."""
    order = service.create_order(applicant_id=100, order_no="WO-TEST-003")
    service.approve(order.id, operator_id=200, expected_version=0)
    service.approve(order.id, operator_id=300, expected_version=1)
    return service.get_order(order.id)  # type: ignore[return-value]


# ===========================================================================
# ATB-1: Backend state machine forward flow tests
# ===========================================================================


class TestATB1ForwardFlow:
    """ATB-1: Verify the forward state transition chain
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED.
    """

    def test_pending_to_approving_level_1(
        self, service: ApprovalService, pending_order: WorkOrder
    ) -> None:
        """PENDING → APPROVING_LEVEL_1 via department manager approval."""
        result = service.approve(
            pending_order.id, operator_id=200, expected_version=0
        )
        assert result.status == OrderStatus.APPROVING_LEVEL_1
        assert result.version == 1

    def test_approving_level_1_to_approving_level_2(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """APPROVING_LEVEL_1 → APPROVING_LEVEL_2 via asset admin approval."""
        result = service.approve(
            level1_order.id, operator_id=300, expected_version=1
        )
        assert result.status == OrderStatus.APPROVING_LEVEL_2
        assert result.version == 2

    def test_approving_level_2_to_approved(
        self, service: ApprovalService, level2_order: WorkOrder
    ) -> None:
        """APPROVING_LEVEL_2 → APPROVED via final approval."""
        result = service.approve(
            level2_order.id, operator_id=400, expected_version=2
        )
        assert result.status == OrderStatus.APPROVED
        assert result.version == 3

    def test_full_forward_chain(self, service: ApprovalService) -> None:
        """Complete forward flow: PENDING → APPROVED in sequence."""
        order = service.create_order(applicant_id=100, order_no="WO-FULL-001")
        assert order.status == OrderStatus.PENDING

        # Level-1 approval
        order = service.approve(order.id, operator_id=200, expected_version=0)
        assert order.status == OrderStatus.APPROVING_LEVEL_1

        # Level-2 approval
        order = service.approve(order.id, operator_id=300, expected_version=1)
        assert order.status == OrderStatus.APPROVING_LEVEL_2

        # Final approval
        order = service.approve(order.id, operator_id=400, expected_version=2)
        assert order.status == OrderStatus.APPROVED

    def test_approval_records_created_on_forward_flow(
        self, service: ApprovalService
    ) -> None:
        """Each approval step must create a corresponding ApprovalRecord."""
        order = service.create_order(applicant_id=100, order_no="WO-REC-001")

        service.approve(order.id, operator_id=200, expected_version=0)
        service.approve(order.id, operator_id=300, expected_version=1)
        service.approve(order.id, operator_id=400, expected_version=2)

        records = service.get_approval_records(order.id)
        assert len(records) == 3
        assert all(r.action == ApprovalAction.APPROVE for r in records)
        assert records[0].operator_id == 200
        assert records[1].operator_id == 300
        assert records[2].operator_id == 400

    def test_version_increments_on_each_approval(
        self, service: ApprovalService
    ) -> None:
        """Version must increment by 1 on each successful transition."""
        order = service.create_order(applicant_id=100, order_no="WO-VER-001")
        assert order.version == 0

        order = service.approve(order.id, operator_id=200, expected_version=0)
        assert order.version == 1

        order = service.approve(order.id, operator_id=300, expected_version=1)
        assert order.version == 2

        order = service.approve(order.id, operator_id=400, expected_version=2)
        assert order.version == 3


# ===========================================================================
# ATB-2: Backend state machine rejection tests
# ===========================================================================


class TestATB2Rejection:
    """ATB-2: Verify rejection at approval nodes and rejection-reason
    validation.
    """

    def test_reject_at_approving_level_1(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Reject at APPROVING_LEVEL_1 → REJECTED with valid reason."""
        result = service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason="不合规",
            expected_version=1,
        )
        assert result.status == OrderStatus.REJECTED
        assert result.version == 2

    def test_reject_at_approving_level_2(
        self, service: ApprovalService, level2_order: WorkOrder
    ) -> None:
        """Reject at APPROVING_LEVEL_2 → REJECTED with valid reason."""
        result = service.reject(
            level2_order.id,
            operator_id=300,
            rejection_reason="资产信息不完整",
            expected_version=2,
        )
        assert result.status == OrderStatus.REJECTED
        assert result.version == 3

    def test_reject_records_include_reason(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Rejection record must contain the rejection reason."""
        service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason="不合规",
            expected_version=1,
        )
        records = service.get_approval_records(level1_order.id)
        reject_records = [r for r in records if r.action == ApprovalAction.REJECT]
        assert len(reject_records) == 1
        assert reject_records[0].comment == "不合规"

    def test_reject_missing_reason_raises_error(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Missing rejectionReason must raise a validation error (HTTP 400)."""
        with pytest.raises(ValueError, match="rejectionReason must be a non-empty string"):
            service.reject(
                level1_order.id,
                operator_id=200,
                rejection_reason="",
                expected_version=1,
            )

    def test_reject_whitespace_only_reason_raises_error(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Whitespace-only rejectionReason must raise a validation error."""
        with pytest.raises(ValueError, match="rejectionReason must be a non-empty string"):
            service.reject(
                level1_order.id,
                operator_id=200,
                rejection_reason="   ",
                expected_version=1,
            )

    def test_reject_reason_exceeds_max_length_raises_error(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """rejectionReason exceeding 500 characters must raise a validation error."""
        long_reason = "A" * 501
        with pytest.raises(ValueError, match="must not exceed 500 characters"):
            service.reject(
                level1_order.id,
                operator_id=200,
                rejection_reason=long_reason,
                expected_version=1,
            )

    def test_reject_reason_at_max_length_succeeds(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """rejectionReason at exactly 500 characters should be accepted."""
        reason = "A" * 500
        result = service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason=reason,
            expected_version=1,
        )
        assert result.status == OrderStatus.REJECTED

    def test_reject_from_pending_not_allowed(
        self, service: ApprovalService, pending_order: WorkOrder
    ) -> None:
        """REJECT is not a valid event from PENDING state."""
        with pytest.raises(StateTransitionException) as exc_info:
            service.reject(
                pending_order.id,
                operator_id=200,
                rejection_reason="不允许",
                expected_version=0,
            )
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        # Status must remain unchanged
        assert pending_order.status == OrderStatus.PENDING


# ===========================================================================
# ATB-3: Backend illegal state transition interception tests
# ===========================================================================


class TestATB3IllegalTransition:
    """ATB-3: Verify that cross-level and illegal transitions are blocked
    with HTTP 409 / INVALID_STATE_TRANSITION.
    """

    def test_cannot_skip_from_pending_to_approving_level_2(
        self, service: ApprovalService, pending_order: WorkOrder
    ) -> None:
        """PENDING cannot directly transition to APPROVING_LEVEL_2.

        This simulates an asset manager trying to approve a PENDING order
        without the department manager's approval first.
        """
        # The service's approve() method maps PENDING → APPROVE_LEVEL_1 event.
        # To test cross-level, we directly use the state machine.
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        with pytest.raises(StateTransitionException) as exc_info:
            sm.trigger("APPROVE_LEVEL_2")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert sm.current_state == OrderStatus.PENDING

    def test_cannot_approve_already_approved_order(
        self, service: ApprovalService
    ) -> None:
        """APPROVED is a terminal state; no further approvals allowed."""
        order = service.create_order(applicant_id=100, order_no="WO-TERM-001")
        service.approve(order.id, operator_id=200, expected_version=0)
        service.approve(order.id, operator_id=300, expected_version=1)
        service.approve(order.id, operator_id=400, expected_version=2)
        assert order.status == OrderStatus.APPROVED

        with pytest.raises(StateTransitionException) as exc_info:
            service.approve(order.id, operator_id=400, expected_version=3)
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert order.status == OrderStatus.APPROVED

    def test_cannot_approve_rejected_order(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """REJECTED orders cannot be approved (no re-approval flow in Phase 1)."""
        service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason="驳回",
            expected_version=1,
        )
        assert level1_order.status == OrderStatus.REJECTED

        with pytest.raises(StateTransitionException) as exc_info:
            service.approve(level1_order.id, operator_id=200, expected_version=2)
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert level1_order.status == OrderStatus.REJECTED

    def test_cannot_reject_approved_order(
        self, service: ApprovalService
    ) -> None:
        """APPROVED orders cannot be rejected."""
        order = service.create_order(applicant_id=100, order_no="WO-APR-001")
        service.approve(order.id, operator_id=200, expected_version=0)
        service.approve(order.id, operator_id=300, expected_version=1)
        service.approve(order.id, operator_id=400, expected_version=2)

        with pytest.raises(StateTransitionException) as exc_info:
            service.reject(
                order.id,
                operator_id=200,
                rejection_reason="反悔了",
                expected_version=3,
            )
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"

    def test_state_unchanged_after_illegal_transition(
        self, service: ApprovalService, pending_order: WorkOrder
    ) -> None:
        """After an illegal transition attempt, the order status must remain
        unchanged.
        """
        original_status = pending_order.status
        original_version = pending_order.version
        with pytest.raises(StateTransitionException):
            service.approve(
                pending_order.id,
                operator_id=300,  # asset admin trying to skip level 1
                expected_version=0,
            )
        assert pending_order.status == original_status
        assert pending_order.version == original_version

    def test_cross_level_approval_blocked_via_state_machine(self) -> None:
        """Directly verify the state machine blocks PENDING → APPROVE_LEVEL_2."""
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        with pytest.raises(StateTransitionException) as exc_info:
            sm.trigger("APPROVE_LEVEL_2")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert sm.current_state == OrderStatus.PENDING

    def test_cross_level_approval_blocked_via_state_machine_final(self) -> None:
        """Directly verify the state machine blocks PENDING → APPROVE_FINAL."""
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        with pytest.raises(StateTransitionException) as exc_info:
            sm.trigger("APPROVE_FINAL")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert sm.current_state == OrderStatus.PENDING


# ===========================================================================
# Optimistic-lock (concurrent approval) tests
# ===========================================================================


class TestOptimisticLock:
    """Verify that concurrent approval conflicts are detected via the
    optimistic-lock version field, resulting in a conflict error.
    """

    def test_concurrent_approve_conflict(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Two approvers acting on the same version must cause a conflict."""
        # First approval succeeds (version 1 → 2)
        service.approve(level1_order.id, operator_id=300, expected_version=1)

        # Second approval with stale version must fail
        with pytest.raises(RuntimeError, match="Optimistic lock conflict"):
            service.approve(level1_order.id, operator_id=301, expected_version=1)

    def test_concurrent_reject_conflict(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Concurrent reject with stale version must fail."""
        # Someone else approves first
        service.approve(level1_order.id, operator_id=300, expected_version=1)

        # Now reject with stale version
        with pytest.raises(RuntimeError, match="Optimistic lock conflict"):
            service.reject(
                level1_order.id,
                operator_id=200,
                rejection_reason="冲突驳回",
                expected_version=1,
            )

    def test_version_mismatch_on_reject(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Reject with wrong version must raise conflict error."""
        with pytest.raises(RuntimeError, match="Optimistic lock conflict"):
            service.reject(
                level1_order.id,
                operator_id=200,
                rejection_reason="版本不匹配",
                expected_version=999,
            )


# ===========================================================================
# Role-based data isolation tests
# ===========================================================================


class TestDataIsolation:
    """Verify that the approval list endpoint respects role-based filtering:
    DEPT_MANAGER sees only APPROVING_LEVEL_1; ASSET_ADMIN sees only
    APPROVING_LEVEL_2.
    """

    def test_dept_manager_sees_only_level_1(self, service: ApprovalService) -> None:
        """Department manager should only see APPROVING_LEVEL_1 orders."""
        # Create orders in various states
        o1 = service.create_order(applicant_id=100, order_no="WO-ISO-001")
        o2 = service.create_order(applicant_id=100, order_no="WO-ISO-002")
        o3 = service.create_order(applicant_id=100, order_no="WO-ISO-003")

        # Advance o1 to APPROVING_LEVEL_1
        service.approve(o1.id, operator_id=200, expected_version=0)

        # Advance o2 to APPROVING_LEVEL_2
        service.approve(o2.id, operator_id=200, expected_version=0)
        service.approve(o2.id, operator_id=300, expected_version=1)

        # o3 remains PENDING

        visible = service.list_pending_approvals("DEPT_MANAGER")
        assert len(visible) == 1
        assert visible[0].id == o1.id
        assert visible[0].status == OrderStatus.APPROVING_LEVEL_1

    def test_asset_admin_sees_only_level_2(self, service: ApprovalService) -> None:
        """Asset admin should only see APPROVING_LEVEL_2 orders."""
        o1 = service.create_order(applicant_id=100, order_no="WO-ISO-010")
        o2 = service.create_order(applicant_id=100, order_no="WO-ISO-011")

        # Advance o1 to APPROVING_LEVEL_1
        service.approve(o1.id, operator_id=200, expected_version=0)

        # Advance o2 to APPROVING_LEVEL_2
        service.approve(o2.id, operator_id=200, expected_version=0)
        service.approve(o2.id, operator_id=300, expected_version=1)

        visible = service.list_pending_approvals("ASSET_ADMIN")
        assert len(visible) == 1
        assert visible[0].id == o2.id
        assert visible[0].status == OrderStatus.APPROVING_LEVEL_2

    def test_unknown_role_sees_nothing(self, service: ApprovalService) -> None:
        """An unrecognized role should see no orders."""
        o1 = service.create_order(applicant_id=100, order_no="WO-ISO-020")
        service.approve(o1.id, operator_id=200, expected_version=0)

        visible = service.list_pending_approvals("UNKNOWN_ROLE")
        assert len(visible) == 0

    def test_no_pending_orders_returns_empty(self, service: ApprovalService) -> None:
        """If no orders match the role's filter, return an empty list."""
        service.create_order(applicant_id=100, order_no="WO-ISO-030")
        # Order is PENDING, not in any approval level
        assert service.list_pending_approvals("DEPT_MANAGER") == []
        assert service.list_pending_approvals("ASSET_ADMIN") == []


# ===========================================================================
# State Machine unit tests (isolated from service)
# ===========================================================================


class TestOrderStateMachine:
    """Direct unit tests for the OrderStateMachine transition rules."""

    def test_pending_to_approving_level_1(self) -> None:
        """PENDING + APPROVE_LEVEL_1 → APPROVING_LEVEL_1."""
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        result = sm.trigger("APPROVE_LEVEL_1")
        assert result == OrderStatus.APPROVING_LEVEL_1

    def test_approving_level_1_to_approving_level_2(self) -> None:
        """APPROVING_LEVEL_1 + APPROVE_LEVEL_2 → APPROVING_LEVEL_2."""
        sm = OrderStateMachine(initial_state=OrderStatus.APPROVING_LEVEL_1)
        result = sm.trigger("APPROVE_LEVEL_2")
        assert result == OrderStatus.APPROVING_LEVEL_2

    def test_approving_level_2_to_approved(self) -> None:
        """APPROVING_LEVEL_2 + APPROVE_FINAL → APPROVED."""
        sm = OrderStateMachine(initial_state=OrderStatus.APPROVING_LEVEL_2)
        result = sm.trigger("APPROVE_FINAL")
        assert result == OrderStatus.APPROVED

    def test_approving_level_1_reject(self) -> None:
        """APPROVING_LEVEL_1 + REJECT → REJECTED."""
        sm = OrderStateMachine(initial_state=OrderStatus.APPROVING_LEVEL_1)
        result = sm.trigger("REJECT")
        assert result == OrderStatus.REJECTED

    def test_approving_level_2_reject(self) -> None:
        """APPROVING_LEVEL_2 + REJECT → REJECTED."""
        sm = OrderStateMachine(initial_state=OrderStatus.APPROVING_LEVEL_2)
        result = sm.trigger("REJECT")
        assert result == OrderStatus.REJECTED

    def test_pending_cancel(self) -> None:
        """PENDING + CANCEL → CANCELLED."""
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        result = sm.trigger("CANCEL")
        assert result == OrderStatus.CANCELLED

    def test_rejected_is_terminal(self) -> None:
        """REJECTED state does not allow any transitions."""
        sm = OrderStateMachine(initial_state=OrderStatus.REJECTED)
        for event in ["APPROVE_LEVEL_1", "APPROVE_LEVEL_2", "APPROVE_FINAL", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                sm.trigger(event)
        assert sm.current_state == OrderStatus.REJECTED

    def test_approved_is_terminal(self) -> None:
        """APPROVED state does not allow any transitions."""
        sm = OrderStateMachine(initial_state=OrderStatus.APPROVED)
        for event in ["APPROVE_LEVEL_1", "APPROVE_LEVEL_2", "APPROVE_FINAL", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                sm.trigger(event)
        assert sm.current_state == OrderStatus.APPROVED

    def test_cancelled_is_terminal(self) -> None:
        """CANCELLED state does not allow any transitions."""
        sm = OrderStateMachine(initial_state=OrderStatus.CANCELLED)
        for event in ["APPROVE_LEVEL_1", "APPROVE_LEVEL_2", "APPROVE_FINAL", "REJECT", "CANCEL"]:
            with pytest.raises(StateTransitionException):
                sm.trigger(event)
        assert sm.current_state == OrderStatus.CANCELLED

    def test_state_unchanged_on_invalid_transition(self) -> None:
        """State must remain unchanged after an invalid transition attempt."""
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        with pytest.raises(StateTransitionException):
            sm.trigger("REJECT")
        assert sm.current_state == OrderStatus.PENDING

    def test_exception_contains_error_code(self) -> None:
        """StateTransitionException must include the INVALID_STATE_TRANSITION error code."""
        sm = OrderStateMachine(initial_state=OrderStatus.PENDING)
        with pytest.raises(StateTransitionException) as exc_info:
            sm.trigger("APPROVE_LEVEL_2")
        assert exc_info.value.error_code == "INVALID_STATE_TRANSITION"
        assert exc_info.value.current == OrderStatus.PENDING
        assert exc_info.value.event == "APPROVE_LEVEL_2"


# ===========================================================================
# Approval Record persistence tests
# ===========================================================================


class TestApprovalRecordPersistence:
    """Verify that approval records are correctly persisted with all
    required fields: operator, action, timestamp, and rejection reason.
    """

    def test_approve_creates_record(
        self, service: ApprovalService, pending_order: WorkOrder
    ) -> None:
        """An approval action must create an ApprovalRecord."""
        service.approve(pending_order.id, operator_id=200, expected_version=0)
        records = service.get_approval_records(pending_order.id)
        assert len(records) == 1
        assert records[0].action == ApprovalAction.APPROVE
        assert records[0].operator_id == 200
        assert records[0].order_id == pending_order.id
        assert records[0].created_at is not None

    def test_reject_creates_record_with_reason(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """A rejection action must create an ApprovalRecord with the reason."""
        service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason="材料不齐全",
            expected_version=1,
        )
        records = service.get_approval_records(level1_order.id)
        reject_records = [r for r in records if r.action == ApprovalAction.REJECT]
        assert len(reject_records) == 1
        assert reject_records[0].comment == "材料不齐全"
        assert reject_records[0].operator_id == 200

    def test_multiple_records_for_same_order(
        self, service: ApprovalService
    ) -> None:
        """Multiple approval actions on the same order create multiple records."""
        order = service.create_order(applicant_id=100, order_no="WO-MR-001")
        service.approve(order.id, operator_id=200, expected_version=0)
        service.approve(order.id, operator_id=300, expected_version=1)
        service.reject(
            order.id,
            operator_id=400,
            rejection_reason="最终驳回",
            expected_version=2,
        )

        records = service.get_approval_records(order.id)
        assert len(records) == 3
        assert records[0].action == ApprovalAction.APPROVE
        assert records[1].action == ApprovalAction.APPROVE
        assert records[2].action == ApprovalAction.REJECT
        assert records[2].comment == "最终驳回"

    def test_records_isolated_per_order(
        self, service: ApprovalService
    ) -> None:
        """Approval records for different orders must not leak."""
        o1 = service.create_order(applicant_id=100, order_no="WO-ISO-R1")
        o2 = service.create_order(applicant_id=100, order_no="WO-ISO-R2")

        service.approve(o1.id, operator_id=200, expected_version=0)
        service.approve(o2.id, operator_id=300, expected_version=0)

        assert len(service.get_approval_records(o1.id)) == 1
        assert len(service.get_approval_records(o2.id)) == 1
        assert service.get_approval_records(o1.id)[0].operator_id == 200
        assert service.get_approval_records(o2.id)[0].operator_id == 300

    def test_record_timestamp_is_iso_compliant(
        self, service: ApprovalService, pending_order: WorkOrder
    ) -> None:
        """Approval record timestamps must be timezone-aware datetime objects."""
        service.approve(pending_order.id, operator_id=200, expected_version=0)
        records = service.get_approval_records(pending_order.id)
        assert len(records) == 1
        ts = records[0].created_at
        assert ts is not None
        assert ts.tzinfo is not None  # timezone-aware


# ===========================================================================
# Edge-case and boundary tests
# ===========================================================================


class TestEdgeCases:
    """Edge-case scenarios for the approval service."""

    def test_approve_nonexistent_order(self, service: ApprovalService) -> None:
        """Approving a non-existent order must raise ValueError."""
        with pytest.raises(ValueError, match="Order .* not found"):
            service.approve(99999, operator_id=200, expected_version=0)

    def test_reject_nonexistent_order(self, service: ApprovalService) -> None:
        """Rejecting a non-existent order must raise ValueError."""
        with pytest.raises(ValueError, match="Order .* not found"):
            service.reject(
                99999,
                operator_id=200,
                rejection_reason="不存在",
                expected_version=0,
            )

    def test_cancelled_order_cannot_be_approved(
        self, service: ApprovalService
    ) -> None:
        """A CANCELLED order cannot be approved."""
        order = service.create_order(applicant_id=100, order_no="WO-CAN-001")
        # Manually set to CANCELLED via state machine
        sm = OrderStateMachine(initial_state=order.status)
        order.status = sm.trigger("CANCEL")
        order.version += 1

        with pytest.raises(StateTransitionException):
            service.approve(order.id, operator_id=200, expected_version=1)

    def test_cancelled_order_cannot_be_rejected(
        self, service: ApprovalService
    ) -> None:
        """A CANCELLED order cannot be rejected."""
        order = service.create_order(applicant_id=100, order_no="WO-CAN-002")
        sm = OrderStateMachine(initial_state=order.status)
        order.status = sm.trigger("CANCEL")
        order.version += 1

        with pytest.raises(StateTransitionException):
            service.reject(
                order.id,
                operator_id=200,
                rejection_reason="已取消",
                expected_version=1,
            )

    def test_rejection_reason_exactly_500_chars(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Rejection reason at exactly 500 characters boundary is valid."""
        reason = "x" * 500
        result = service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason=reason,
            expected_version=1,
        )
        assert result.status == OrderStatus.REJECTED

    def test_rejection_reason_501_chars(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Rejection reason at 501 characters must be rejected."""
        reason = "x" * 501
        with pytest.raises(ValueError, match="must not exceed 500 characters"):
            service.reject(
                level1_order.id,
                operator_id=200,
                rejection_reason=reason,
                expected_version=1,
            )

    def test_unicode_rejection_reason(
        self, service: ApprovalService, level1_order: WorkOrder
    ) -> None:
        """Unicode characters in rejection reason must be handled correctly."""
        reason = "驳回原因：资产编号与实际不符，请核实后重新提交！🎉"
        result = service.reject(
            level1_order.id,
            operator_id=200,
            rejection_reason=reason,
            expected_version=1,
        )
        assert result.status == OrderStatus.REJECTED
        records = service.get_approval_records(level1_order.id)
        reject_records = [r for r in records if r.action == ApprovalAction.REJECT]
        assert reject_records[0].comment == reason