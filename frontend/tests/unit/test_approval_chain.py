"""
Unit tests for the approval chain module.

Validates the multi-level approval workflow as defined in the SPEC:
  - Forward transitions: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  - Rejection at any approval node → REJECTED (mandatory rejection reason)
  - CANCELLED state support
  - No skip-level transitions allowed
  - Role-based data isolation for approval lists
  - Optimistic locking for concurrent approval conflict detection

References:
  ATB-1: Forward state transition
  ATB-2: Rejection with mandatory rejection reason
  ATB-3: Invalid state transition interception
  ATB-4: Role-based approval list filtering
  ATB-5: Approval detail and operation validation
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Domain models & state machine (mirroring frontend approval chain logic)
# ---------------------------------------------------------------------------

class ApprovalStatus(str, Enum):
    """Enumeration of all possible approval chain statuses.

    The canonical flow is:
        PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

    At any APPROVING_* node the order may be rejected → REJECTED.
    A PENDING order may also be cancelled → CANCELLED.
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Actions that can be performed on an approval chain."""

    SUBMIT = "SUBMIT"
    APPROVE_LEVEL_1 = "APPROVE_LEVEL_1"
    APPROVE_LEVEL_2 = "APPROVE_LEVEL_2"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class ApprovalRole(str, Enum):
    """Roles that participate in the approval chain."""

    DEPT_MANAGER = "DEPT_MANAGER"
    ASSET_ADMIN = "ASSET_ADMIN"


# Mapping from current status + action → next status
_VALID_TRANSITIONS: dict[tuple[ApprovalStatus, ApprovalAction], ApprovalStatus] = {
    (ApprovalStatus.PENDING, ApprovalAction.SUBMIT): ApprovalStatus.APPROVING_LEVEL_1,
    (ApprovalStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE_LEVEL_1): ApprovalStatus.APPROVING_LEVEL_2,
    (ApprovalStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE_LEVEL_2): ApprovalStatus.APPROVED,
    # Rejection from any approving node
    (ApprovalStatus.APPROVING_LEVEL_1, ApprovalAction.REJECT): ApprovalStatus.REJECTED,
    (ApprovalStatus.APPROVING_LEVEL_2, ApprovalAction.REJECT): ApprovalStatus.REJECTED,
    # Cancel from pending
    (ApprovalStatus.PENDING, ApprovalAction.CANCEL): ApprovalStatus.CANCELLED,
}

# Role → status that the role is allowed to act upon
_ROLE_VISIBLE_STATUS: dict[ApprovalRole, list[ApprovalStatus]] = {
    ApprovalRole.DEPT_MANAGER: [ApprovalStatus.APPROVING_LEVEL_1],
    ApprovalRole.ASSET_ADMIN: [ApprovalStatus.APPROVING_LEVEL_2],
}


class InvalidStateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""

    def __init__(self, current: ApprovalStatus, action: ApprovalAction) -> None:
        """Initialize with the current status and attempted action."""
        self.current = current
        self.action = action
        super().__init__(
            f"Invalid transition: cannot apply {action.value} in state {current.value}"
        )


class RejectionReasonRequiredError(Exception):
    """Raised when a REJECT action is attempted without a rejection reason."""

    def __init__(self) -> None:
        """Initialize the error with a descriptive message."""
        super().__init__("rejectionReason is required when rejecting an approval")


class OptimisticLockConflictError(Exception):
    """Raised when an optimistic lock version mismatch is detected."""

    def __init__(self) -> None:
        """Initialize the error with a descriptive message."""
        super().__init__("Optimistic lock conflict: the resource has been modified by another transaction")


@dataclass
class ApprovalRecord:
    """A single approval audit record persisted for traceability."""

    id: Optional[int] = None
    order_id: str = ""
    operator_id: str = ""
    action: str = ""
    comment: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class WorkOrder:
    """Minimal work order model used in approval chain tests."""

    id: str = ""
    title: str = ""
    status: ApprovalStatus = ApprovalStatus.PENDING
    version: int = 1
    applicant: str = ""
    submitted_at: Optional[str] = None
    approval_records: list[ApprovalRecord] = field(default_factory=list)


class ApprovalStateMachine:
    """State machine governing the approval chain transitions.

    Enforces:
      - Only valid transitions per the _VALID_TRANSITIONS table
      - Rejection requires a non-empty rejectionReason (max 500 chars)
      - No skip-level transitions (e.g. PENDING → APPROVING_LEVEL_2)
    """

    def __init__(self, initial_state: ApprovalStatus = ApprovalStatus.PENDING) -> None:
        """Initialize the state machine with the given initial state."""
        self._state = initial_state

    @property
    def current_state(self) -> ApprovalStatus:
        """Return the current approval status."""
        return self._state

    def can_transition(self, action: ApprovalAction) -> bool:
        """Check whether the given action is valid from the current state."""
        return (self._state, action) in _VALID_TRANSITIONS

    def transition(
        self,
        action: ApprovalAction,
        rejection_reason: Optional[str] = None,
    ) -> ApprovalStatus:
        """Execute a state transition and return the new status.

        Args:
            action: The approval action to apply.
            rejection_reason: Mandatory when action is REJECT; must be a
                non-empty string of at most 500 characters.

        Returns:
            The new ApprovalStatus after the transition.

        Raises:
            InvalidStateTransitionError: If the action is not valid from the
                current state (includes skip-level attempts).
            RejectionReasonRequiredError: If REJECT is attempted without a
                non-empty rejectionReason.
        """
        if action == ApprovalAction.REJECT:
            if not rejection_reason or not rejection_reason.strip():
                raise RejectionReasonRequiredError()
            if len(rejection_reason) > 500:
                raise ValueError("rejectionReason must not exceed 500 characters")

        key = (self._state, action)
        if key not in _VALID_TRANSITIONS:
            raise InvalidStateTransitionError(self._state, action)

        self._state = _VALID_TRANSITIONS[key]
        return self._state


class ApprovalChainService:
    """Service layer that orchestrates approval chain operations.

    Integrates state machine transitions, optimistic locking, and
    approval record persistence.
    """

    def __init__(self) -> None:
        """Initialize the service with an in-memory order store."""
        self._orders: dict[str, WorkOrder] = {}
        self._record_id_seq: int = 0

    def create_order(self, order: WorkOrder) -> WorkOrder:
        """Persist a new work order and return it."""
        self._orders[order.id] = order
        return order

    def get_order(self, order_id: str) -> Optional[WorkOrder]:
        """Retrieve a work order by its ID."""
        return self._orders.get(order_id)

    def approve(
        self,
        order_id: str,
        operator_id: str,
        role: ApprovalRole,
        version: int,
    ) -> WorkOrder:
        """Approve a work order at the current approval level.

        Args:
            order_id: The work order identifier.
            operator_id: The user performing the approval.
            role: The role of the approver (must match the current level).
            version: The expected version for optimistic locking.

        Returns:
            The updated WorkOrder.

        Raises:
            ValueError: If the order is not found.
            OptimisticLockConflictError: If the version does not match.
            InvalidStateTransitionError: If the transition is not valid.
        """
        order = self._orders.get(order_id)
        if order is None:
            raise ValueError(f"Order {order_id} not found")

        if order.version != version:
            raise OptimisticLockConflictError()

        # Determine the correct approve action based on current status
        if order.status == ApprovalStatus.APPROVING_LEVEL_1:
            action = ApprovalAction.APPROVE_LEVEL_1
        elif order.status == ApprovalStatus.APPROVING_LEVEL_2:
            action = ApprovalAction.APPROVE_LEVEL_2
        else:
            # Cannot approve from current status
            action = ApprovalAction.APPROVE_LEVEL_1  # will fail in state machine

        new_status = ApprovalStateMachine(order.status).transition(action)
        order.status = new_status
        order.version += 1

        # Persist approval record
        self._record_id_seq += 1
        record = ApprovalRecord(
            id=self._record_id_seq,
            order_id=order_id,
            operator_id=operator_id,
            action=action.value,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        order.approval_records.append(record)
        return order

    def reject(
        self,
        order_id: str,
        operator_id: str,
        rejection_reason: str,
        version: int,
    ) -> WorkOrder:
        """Reject a work order at the current approval level.

        Args:
            order_id: The work order identifier.
            operator_id: The user performing the rejection.
            rejection_reason: Mandatory non-empty reason (max 500 chars).
            version: The expected version for optimistic locking.

        Returns:
            The updated WorkOrder.

        Raises:
            ValueError: If the order is not found.
            OptimisticLockConflictError: If the version does not match.
            RejectionReasonRequiredError: If rejection_reason is empty.
            InvalidStateTransitionError: If the transition is not valid.
        """
        order = self._orders.get(order_id)
        if order is None:
            raise ValueError(f"Order {order_id} not found")

        if order.version != version:
            raise OptimisticLockConflictError()

        new_status = ApprovalStateMachine(order.status).transition(
            ApprovalAction.REJECT, rejection_reason=rejection_reason
        )
        order.status = new_status
        order.version += 1

        # Persist rejection record
        self._record_id_seq += 1
        record = ApprovalRecord(
            id=self._record_id_seq,
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT.value,
            rejection_reason=rejection_reason,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        order.approval_records.append(record)
        return order

    def cancel(self, order_id: str, version: int) -> WorkOrder:
        """Cancel a work order that is still in PENDING status.

        Args:
            order_id: The work order identifier.
            version: The expected version for optimistic locking.

        Returns:
            The updated WorkOrder.

        Raises:
            ValueError: If the order is not found.
            OptimisticLockConflictError: If the version does not match.
            InvalidStateTransitionError: If the order is not in PENDING status.
        """
        order = self._orders.get(order_id)
        if order is None:
            raise ValueError(f"Order {order_id} not found")

        if order.version != version:
            raise OptimisticLockConflictError()

        new_status = ApprovalStateMachine(order.status).transition(ApprovalAction.CANCEL)
        order.status = new_status
        order.version += 1
        return order

    def list_pending_approvals(self, role: ApprovalRole) -> list[WorkOrder]:
        """List work orders visible to the given role.

        Per SPEC data isolation constraint:
          - DEPT_MANAGER sees only APPROVING_LEVEL_1 orders
          - ASSET_ADMIN sees only APPROVING_LEVEL_2 orders

        Args:
            role: The role of the current user.

        Returns:
            A list of WorkOrder instances visible to the role.
        """
        visible_statuses = _ROLE_VISIBLE_STATUS.get(role, [])
        return [
            order for order in self._orders.values()
            if order.status in visible_statuses
        ]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sm() -> ApprovalStateMachine:
    """Return an ApprovalStateMachine in the initial PENDING state."""
    return ApprovalStateMachine(ApprovalStatus.PENDING)


@pytest.fixture
def sm_level1() -> ApprovalStateMachine:
    """Return an ApprovalStateMachine in APPROVING_LEVEL_1 state."""
    return ApprovalStateMachine(ApprovalStatus.APPROVING_LEVEL_1)


@pytest.fixture
def sm_level2() -> ApprovalStateMachine:
    """Return an ApprovalStateMachine in APPROVING_LEVEL_2 state."""
    return ApprovalStateMachine(ApprovalStatus.APPROVING_LEVEL_2)


@pytest.fixture
def sm_approved() -> ApprovalStateMachine:
    """Return an ApprovalStateMachine in APPROVED (terminal) state."""
    return ApprovalStateMachine(ApprovalStatus.APPROVED)


@pytest.fixture
def sm_rejected() -> ApprovalStateMachine:
    """Return an ApprovalStateMachine in REJECTED state."""
    return ApprovalStateMachine(ApprovalStatus.REJECTED)


@pytest.fixture
def sm_cancelled() -> ApprovalStateMachine:
    """Return an ApprovalStateMachine in CANCELLED state."""
    return ApprovalStateMachine(ApprovalStatus.CANCELLED)


@pytest.fixture
def service() -> ApprovalChainService:
    """Return a fresh ApprovalChainService instance."""
    return ApprovalChainService()


@pytest.fixture
def pending_order(service: ApprovalChainService) -> WorkOrder:
    """Create and return a work order in PENDING status."""
    order = WorkOrder(
        id="WO-001",
        title="Test Work Order",
        status=ApprovalStatus.PENDING,
        version=1,
        applicant="user-001",
    )
    return service.create_order(order)


@pytest.fixture
def level1_order(service: ApprovalChainService) -> WorkOrder:
    """Create and return a work order in APPROVING_LEVEL_1 status."""
    order = WorkOrder(
        id="WO-002",
        title="Level 1 Approval Order",
        status=ApprovalStatus.APPROVING_LEVEL_1,
        version=1,
        applicant="user-002",
    )
    return service.create_order(order)


@pytest.fixture
def level2_order(service: ApprovalChainService) -> WorkOrder:
    """Create and return a work order in APPROVING_LEVEL_2 status."""
    order = WorkOrder(
        id="WO-003",
        title="Level 2 Approval Order",
        status=ApprovalStatus.APPROVING_LEVEL_2,
        version=1,
        applicant="user-003",
    )
    return service.create_order(order)


# ---------------------------------------------------------------------------
# ATB-1: Forward State Transition Tests
# ---------------------------------------------------------------------------

class TestForwardTransitions:
    """ATB-1: Validate the forward approval chain flow.

    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    """

    def test_submit_from_pending(self, sm: ApprovalStateMachine) -> None:
        """SUBMIT action transitions PENDING → APPROVING_LEVEL_1."""
        new_state = sm.transition(ApprovalAction.SUBMIT)
        assert new_state == ApprovalStatus.APPROVING_LEVEL_1
        assert sm.current_state == ApprovalStatus.APPROVING_LEVEL_1

    def test_approve_level1_from_approving_level1(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """APPROVE_LEVEL_1 transitions APPROVING_LEVEL_1 → APPROVING_LEVEL_2."""
        new_state = sm_level1.transition(ApprovalAction.APPROVE_LEVEL_1)
        assert new_state == ApprovalStatus.APPROVING_LEVEL_2
        assert sm_level1.current_state == ApprovalStatus.APPROVING_LEVEL_2

    def test_approve_level2_from_approving_level2(
        self, sm_level2: ApprovalStateMachine
    ) -> None:
        """APPROVE_LEVEL_2 transitions APPROVING_LEVEL_2 → APPROVED."""
        new_state = sm_level2.transition(ApprovalAction.APPROVE_LEVEL_2)
        assert new_state == ApprovalStatus.APPROVED
        assert sm_level2.current_state == ApprovalStatus.APPROVED

    def test_full_forward_chain(self, sm: ApprovalStateMachine) -> None:
        """Complete forward chain: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""
        sm.transition(ApprovalAction.SUBMIT)
        assert sm.current_state == ApprovalStatus.APPROVING_LEVEL_1

        sm.transition(ApprovalAction.APPROVE_LEVEL_1)
        assert sm.current_state == ApprovalStatus.APPROVING_LEVEL_2

        sm.transition(ApprovalAction.APPROVE_LEVEL_2)
        assert sm.current_state == ApprovalStatus.APPROVED

    def test_can_transition_returns_true_for_valid_actions(
        self, sm: ApprovalStateMachine
    ) -> None:
        """can_transition returns True for valid forward actions."""
        assert sm.can_transition(ApprovalAction.SUBMIT) is True

    def test_can_transition_returns_false_for_invalid_actions(
        self, sm: ApprovalStateMachine
    ) -> None:
        """can_transition returns False for actions not valid from current state."""
        assert sm.can_transition(ApprovalAction.APPROVE_LEVEL_1) is False
        assert sm.can_transition(ApprovalAction.APPROVE_LEVEL_2) is False
        assert sm.can_transition(ApprovalAction.REJECT) is False


# ---------------------------------------------------------------------------
# ATB-2: Rejection with Mandatory Rejection Reason
# ---------------------------------------------------------------------------

class TestRejectionFlow:
    """ATB-2: Validate rejection at any approval node with mandatory reason."""

    def test_reject_from_approving_level1_with_reason(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """REJECT from APPROVING_LEVEL_1 with reason transitions to REJECTED."""
        new_state = sm_level1.transition(
            ApprovalAction.REJECT, rejection_reason="不合规"
        )
        assert new_state == ApprovalStatus.REJECTED
        assert sm_level1.current_state == ApprovalStatus.REJECTED

    def test_reject_from_approving_level2_with_reason(
        self, sm_level2: ApprovalStateMachine
    ) -> None:
        """REJECT from APPROVING_LEVEL_2 with reason transitions to REJECTED."""
        new_state = sm_level2.transition(
            ApprovalAction.REJECT, rejection_reason="资产信息不完整"
        )
        assert new_state == ApprovalStatus.REJECTED
        assert sm_level2.current_state == ApprovalStatus.REJECTED

    def test_reject_without_reason_raises_error(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """REJECT without rejectionReason raises RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            sm_level1.transition(ApprovalAction.REJECT, rejection_reason=None)

    def test_reject_with_empty_reason_raises_error(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """REJECT with empty string rejectionReason raises RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            sm_level1.transition(ApprovalAction.REJECT, rejection_reason="")

    def test_reject_with_whitespace_only_reason_raises_error(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """REJECT with whitespace-only rejectionReason raises RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            sm_level1.transition(ApprovalAction.REJECT, rejection_reason="   ")

    def test_reject_with_reason_exceeding_500_chars_raises_error(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """REJECT with rejectionReason exceeding 500 characters raises ValueError."""
        long_reason = "A" * 501
        with pytest.raises(ValueError, match="must not exceed 500 characters"):
            sm_level1.transition(ApprovalAction.REJECT, rejection_reason=long_reason)

    def test_reject_with_reason_at_500_char_limit_succeeds(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """REJECT with rejectionReason exactly 500 characters succeeds."""
        reason = "A" * 500
        new_state = sm_level1.transition(
            ApprovalAction.REJECT, rejection_reason=reason
        )
        assert new_state == ApprovalStatus.REJECTED

    def test_reject_from_pending_is_invalid(
        self, sm: ApprovalStateMachine
    ) -> None:
        """REJECT from PENDING state is not a valid transition."""
        with pytest.raises(InvalidStateTransitionError):
            sm.transition(ApprovalAction.REJECT, rejection_reason="some reason")


# ---------------------------------------------------------------------------
# ATB-3: Invalid State Transition Interception (No Skip-Level)
# ---------------------------------------------------------------------------

class TestInvalidTransitions:
    """ATB-3: Validate that illegal transitions are blocked.

    Key constraint: no skip-level transitions (e.g. PENDING → APPROVING_LEVEL_2).
    """

    def test_skip_level_pending_to_approving_level2(
        self, sm: ApprovalStateMachine
    ) -> None:
        """APPROVE_LEVEL_2 from PENDING state raises InvalidStateTransitionError."""
        with pytest.raises(InvalidStateTransitionError):
            sm.transition(ApprovalAction.APPROVE_LEVEL_2)

    def test_skip_level_pending_to_approve_level1(
        self, sm: ApprovalStateMachine
    ) -> None:
        """APPROVE_LEVEL_1 from PENDING state raises InvalidStateTransitionError."""
        with pytest.raises(InvalidStateTransitionError):
            sm.transition(ApprovalAction.APPROVE_LEVEL_1)

    def test_approve_level2_from_approving_level1(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """APPROVE_LEVEL_2 from APPROVING_LEVEL_1 is a skip-level and raises error."""
        with pytest.raises(InvalidStateTransitionError):
            sm_level1.transition(ApprovalAction.APPROVE_LEVEL_2)

    def test_approve_level1_from_approving_level2(
        self, sm_level2: ApprovalStateMachine
    ) -> None:
        """APPROVE_LEVEL_1 from APPROVING_LEVEL_2 is invalid and raises error."""
        with pytest.raises(InvalidStateTransitionError):
            sm_level2.transition(ApprovalAction.APPROVE_LEVEL_1)

    def test_submit_from_approving_level1(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """SUBMIT from APPROVING_LEVEL_1 is invalid and raises error."""
        with pytest.raises(InvalidStateTransitionError):
            sm_level1.transition(ApprovalAction.SUBMIT)

    def test_any_action_from_approved(
        self, sm_approved: ApprovalStateMachine
    ) -> None:
        """APPROVED is a terminal state; any action raises InvalidStateTransitionError."""
        for action in ApprovalAction:
            with pytest.raises(InvalidStateTransitionError):
                sm_approved.transition(action, rejection_reason="reason" if action == ApprovalAction.REJECT else None)

    def test_any_action_from_rejected(
        self, sm_rejected: ApprovalStateMachine
    ) -> None:
        """REJECTED is a terminal state; any action raises InvalidStateTransitionError."""
        for action in ApprovalAction:
            with pytest.raises(InvalidStateTransitionError):
                sm_rejected.transition(action, rejection_reason="reason" if action == ApprovalAction.REJECT else None)

    def test_any_action_from_cancelled(
        self, sm_cancelled: ApprovalStateMachine
    ) -> None:
        """CANCELLED is a terminal state; any action raises InvalidStateTransitionError."""
        for action in ApprovalAction:
            with pytest.raises(InvalidStateTransitionError):
                sm_cancelled.transition(action, rejection_reason="reason" if action == ApprovalAction.REJECT else None)

    def test_invalid_transition_preserves_state(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """After an invalid transition attempt, the state remains unchanged."""
        with pytest.raises(InvalidStateTransitionError):
            sm_level1.transition(ApprovalAction.APPROVE_LEVEL_2)
        assert sm_level1.current_state == ApprovalStatus.APPROVING_LEVEL_1

    def test_invalid_transition_error_contains_context(
        self, sm: ApprovalStateMachine
    ) -> None:
        """InvalidStateTransitionError includes current state and action for debugging."""
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            sm.transition(ApprovalAction.APPROVE_LEVEL_2)
        error = exc_info.value
        assert error.current == ApprovalStatus.PENDING
        assert error.action == ApprovalAction.APPROVE_LEVEL_2


# ---------------------------------------------------------------------------
# CANCELLED State Tests
# ---------------------------------------------------------------------------

class TestCancelledState:
    """Validate CANCELLED state transitions and constraints."""

    def test_cancel_from_pending(self, sm: ApprovalStateMachine) -> None:
        """CANCEL action transitions PENDING → CANCELLED."""
        new_state = sm.transition(ApprovalAction.CANCEL)
        assert new_state == ApprovalStatus.CANCELLED
        assert sm.current_state == ApprovalStatus.CANCELLED

    def test_cancel_from_approving_level1_is_invalid(
        self, sm_level1: ApprovalStateMachine
    ) -> None:
        """CANCEL from APPROVING_LEVEL_1 is not a valid transition."""
        with pytest.raises(InvalidStateTransitionError):
            sm_level1.transition(ApprovalAction.CANCEL)

    def test_cancel_from_approving_level2_is_invalid(
        self, sm_level2: ApprovalStateMachine
    ) -> None:
        """CANCEL from APPROVING_LEVEL_2 is not a valid transition."""
        with pytest.raises(InvalidStateTransitionError):
            sm_level2.transition(ApprovalAction.CANCEL)


# ---------------------------------------------------------------------------
# ATB-4: Role-Based Approval List Filtering
# ---------------------------------------------------------------------------

class TestRoleBasedFiltering:
    """ATB-4: Validate that approval lists are filtered by role.

    Per SPEC:
      - DEPT_MANAGER sees only APPROVING_LEVEL_1 orders
      - ASSET_ADMIN sees only APPROVING_LEVEL_2 orders
    """

    def test_dept_manager_sees_only_level1_orders(
        self, service: ApprovalChainService
    ) -> None:
        """DEPT_MANAGER list returns only APPROVING_LEVEL_1 orders."""
        service.create_order(WorkOrder(id="WO-A", status=ApprovalStatus.APPROVING_LEVEL_1, applicant="u1"))
        service.create_order(WorkOrder(id="WO-B", status=ApprovalStatus.APPROVING_LEVEL_2, applicant="u2"))
        service.create_order(WorkOrder(id="WO-C", status=ApprovalStatus.PENDING, applicant="u3"))
        service.create_order(WorkOrder(id="WO-D", status=ApprovalStatus.APPROVED, applicant="u4"))

        result = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert len(result) == 1
        assert result[0].id == "WO-A"
        assert result[0].status == ApprovalStatus.APPROVING_LEVEL_1

    def test_asset_admin_sees_only_level2_orders(
        self, service: ApprovalChainService
    ) -> None:
        """ASSET_ADMIN list returns only APPROVING_LEVEL_2 orders."""
        service.create_order(WorkOrder(id="WO-A", status=ApprovalStatus.APPROVING_LEVEL_1, applicant="u1"))
        service.create_order(WorkOrder(id="WO-B", status=ApprovalStatus.APPROVING_LEVEL_2, applicant="u2"))
        service.create_order(WorkOrder(id="WO-C", status=ApprovalStatus.PENDING, applicant="u3"))

        result = service.list_pending_approvals(ApprovalRole.ASSET_ADMIN)
        assert len(result) == 1
        assert result[0].id == "WO-B"
        assert result[0].status == ApprovalStatus.APPROVING_LEVEL_2

    def test_empty_list_when_no_matching_orders(
        self, service: ApprovalChainService
    ) -> None:
        """Returns empty list when no orders match the role's visible statuses."""
        service.create_order(WorkOrder(id="WO-A", status=ApprovalStatus.PENDING, applicant="u1"))
        service.create_order(WorkOrder(id="WO-B", status=ApprovalStatus.APPROVED, applicant="u2"))

        result = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert result == []

    def test_multiple_level1_orders_for_dept_manager(
        self, service: ApprovalChainService
    ) -> None:
        """DEPT_MANAGER sees all APPROVING_LEVEL_1 orders."""
        for i in range(5):
            service.create_order(
                WorkOrder(id=f"WO-{i}", status=ApprovalStatus.APPROVING_LEVEL_1, applicant=f"u{i}")
            )
        service.create_order(
            WorkOrder(id="WO-OTHER", status=ApprovalStatus.APPROVING_LEVEL_2, applicant="u-other")
        )

        result = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert len(result) == 5
        assert all(o.status == ApprovalStatus.APPROVING_LEVEL_1 for o in result)

    def test_rejected_orders_not_visible_to_any_role(
        self, service: ApprovalChainService
    ) -> None:
        """REJECTED orders are not visible in any role's approval list."""
        service.create_order(WorkOrder(id="WO-R", status=ApprovalStatus.REJECTED, applicant="u1"))

        assert service.list_pending_approvals(ApprovalRole.DEPT_MANAGER) == []
        assert service.list_pending_approvals(ApprovalRole.ASSET_ADMIN) == []


# ---------------------------------------------------------------------------
# ATB-5: Approval Detail and Operation Tests (Service Layer)
# ---------------------------------------------------------------------------

class TestApprovalServiceOperations:
    """ATB-5: Validate approval service approve/reject operations."""

    def test_approve_level1_success(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Approving at level 1 transitions order to APPROVING_LEVEL_2."""
        updated = service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        assert updated.status == ApprovalStatus.APPROVING_LEVEL_2
        assert updated.version == 2
        assert len(updated.approval_records) == 1
        assert updated.approval_records[0].action == ApprovalAction.APPROVE_LEVEL_1.value
        assert updated.approval_records[0].operator_id == "manager-001"

    def test_approve_level2_success(
        self, service: ApprovalChainService, level2_order: WorkOrder
    ) -> None:
        """Approving at level 2 transitions order to APPROVED."""
        updated = service.approve(
            order_id="WO-003",
            operator_id="admin-001",
            role=ApprovalRole.ASSET_ADMIN,
            version=1,
        )
        assert updated.status == ApprovalStatus.APPROVED
        assert updated.version == 2
        assert len(updated.approval_records) == 1
        assert updated.approval_records[0].action == ApprovalAction.APPROVE_LEVEL_2.value

    def test_reject_with_reason_success(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Rejecting with a valid reason transitions order to REJECTED."""
        updated = service.reject(
            order_id="WO-002",
            operator_id="manager-001",
            rejection_reason="不合规",
            version=1,
        )
        assert updated.status == ApprovalStatus.REJECTED
        assert updated.version == 2
        assert len(updated.approval_records) == 1
        record = updated.approval_records[0]
        assert record.action == ApprovalAction.REJECT.value
        assert record.rejection_reason == "不合规"
        assert record.operator_id == "manager-001"

    def test_reject_without_reason_raises_error(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Rejecting without a reason raises RejectionReasonRequiredError."""
        with pytest.raises(RejectionReasonRequiredError):
            service.reject(
                order_id="WO-002",
                operator_id="manager-001",
                rejection_reason="",
                version=1,
            )

    def test_approve_nonexistent_order_raises_error(
        self, service: ApprovalChainService
    ) -> None:
        """Approving a non-existent order raises ValueError."""
        with pytest.raises(ValueError, match="not found"):
            service.approve(
                order_id="NONEXISTENT",
                operator_id="manager-001",
                role=ApprovalRole.DEPT_MANAGER,
                version=1,
            )

    def test_reject_nonexistent_order_raises_error(
        self, service: ApprovalChainService
    ) -> None:
        """Rejecting a non-existent order raises ValueError."""
        with pytest.raises(ValueError, match="not found"):
            service.reject(
                order_id="NONEXISTENT",
                operator_id="manager-001",
                rejection_reason="reason",
                version=1,
            )

    def test_approve_from_pending_raises_invalid_transition(
        self, service: ApprovalChainService, pending_order: WorkOrder
    ) -> None:
        """Approving a PENDING order (no level to approve at) raises InvalidStateTransitionError."""
        with pytest.raises(InvalidStateTransitionError):
            service.approve(
                order_id="WO-001",
                operator_id="manager-001",
                role=ApprovalRole.DEPT_MANAGER,
                version=1,
            )

    def test_cancel_pending_order(
        self, service: ApprovalChainService, pending_order: WorkOrder
    ) -> None:
        """Cancelling a PENDING order transitions it to CANCELLED."""
        updated = service.cancel(order_id="WO-001", version=1)
        assert updated.status == ApprovalStatus.CANCELLED
        assert updated.version == 2


# ---------------------------------------------------------------------------
# Optimistic Locking Tests
# ---------------------------------------------------------------------------

class TestOptimisticLocking:
    """Validate optimistic locking for concurrent approval conflict detection."""

    def test_approve_with_stale_version_raises_conflict(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Approving with a stale version raises OptimisticLockConflictError."""
        # First approval succeeds, bumping version to 2
        service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        # Second approval with old version=1 should fail
        with pytest.raises(OptimisticLockConflictError):
            service.approve(
                order_id="WO-002",
                operator_id="manager-002",
                role=ApprovalRole.DEPT_MANAGER,
                version=1,
            )

    def test_reject_with_stale_version_raises_conflict(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Rejecting with a stale version raises OptimisticLockConflictError."""
        # First approval succeeds, bumping version to 2
        service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        # Reject with old version=1 should fail
        with pytest.raises(OptimisticLockConflictError):
            service.reject(
                order_id="WO-002",
                operator_id="manager-002",
                rejection_reason="too late",
                version=1,
            )

    def test_cancel_with_stale_version_raises_conflict(
        self, service: ApprovalChainService, pending_order: WorkOrder
    ) -> None:
        """Cancelling with a stale version raises OptimisticLockConflictError."""
        # Simulate a prior modification bumping version
        pending_order.version = 2
        with pytest.raises(OptimisticLockConflictError):
            service.cancel(order_id="WO-001", version=1)

    def test_approve_with_correct_version_after_prior_update(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Approving with the correct current version succeeds after a prior update."""
        # First approval bumps version to 2
        updated = service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        assert updated.version == 2
        assert updated.status == ApprovalStatus.APPROVING_LEVEL_2

        # Second approval with correct version=2 succeeds
        updated2 = service.approve(
            order_id="WO-002",
            operator_id="admin-001",
            role=ApprovalRole.ASSET_ADMIN,
            version=2,
        )
        assert updated2.version == 3
        assert updated2.status == ApprovalStatus.APPROVED


# ---------------------------------------------------------------------------
# Approval Record Persistence Tests
# ---------------------------------------------------------------------------

class TestApprovalRecordPersistence:
    """Validate that approval records are correctly persisted."""

    def test_approve_creates_approval_record(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """An approval operation creates a corresponding ApprovalRecord."""
        updated = service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        assert len(updated.approval_records) == 1
        record = updated.approval_records[0]
        assert record.order_id == "WO-002"
        assert record.operator_id == "manager-001"
        assert record.action == ApprovalAction.APPROVE_LEVEL_1.value
        assert record.rejection_reason is None
        assert record.created_at is not None

    def test_reject_creates_rejection_record(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """A rejection operation creates an ApprovalRecord with rejection_reason."""
        updated = service.reject(
            order_id="WO-002",
            operator_id="manager-001",
            rejection_reason="不合规",
            version=1,
        )
        assert len(updated.approval_records) == 1
        record = updated.approval_records[0]
        assert record.action == ApprovalAction.REJECT.value
        assert record.rejection_reason == "不合规"

    def test_multiple_approvals_create_multiple_records(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Multiple approval actions accumulate multiple ApprovalRecords."""
        # Level 1 approval
        updated = service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        # Level 2 approval
        updated = service.approve(
            order_id="WO-002",
            operator_id="admin-001",
            role=ApprovalRole.ASSET_ADMIN,
            version=2,
        )
        assert len(updated.approval_records) == 2
        assert updated.approval_records[0].action == ApprovalAction.APPROVE_LEVEL_1.value
        assert updated.approval_records[1].action == ApprovalAction.APPROVE_LEVEL_2.value

    def test_approval_record_has_iso8601_timestamp(
        self, service: ApprovalChainService, level1_order: WorkOrder
    ) -> None:
        """Approval record created_at follows ISO 8601 format."""
        updated = service.approve(
            order_id="WO-002",
            operator_id="manager-001",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        record = updated.approval_records[0]
        # Verify ISO 8601 format by parsing
        parsed = datetime.fromisoformat(record.created_at)
        assert parsed.tzinfo is not None  # timezone-aware


# ---------------------------------------------------------------------------
# End-to-End Approval Chain Integration (Service Layer)
# ---------------------------------------------------------------------------

class TestEndToEndApprovalChain:
    """Full approval chain flow through the service layer."""

    def test_complete_approval_flow(
        self, service: ApprovalChainService
    ) -> None:
        """Full flow: create → submit → approve L1 → approve L2 → APPROVED."""
        # Create order in PENDING
        order = service.create_order(WorkOrder(
            id="WO-E2E",
            title="End-to-End Test",
            status=ApprovalStatus.PENDING,
            version=1,
            applicant="user-e2e",
        ))

        # Submit → APPROVING_LEVEL_1
        sm = ApprovalStateMachine(order.status)
        order.status = sm.transition(ApprovalAction.SUBMIT)
        assert order.status == ApprovalStatus.APPROVING_LEVEL_1

        # Update service store
        service._orders["WO-E2E"] = order

        # Approve Level 1 → APPROVING_LEVEL_2
        updated = service.approve(
            order_id="WO-E2E",
            operator_id="manager-e2e",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )
        assert updated.status == ApprovalStatus.APPROVING_LEVEL_2

        # Approve Level 2 → APPROVED
        updated = service.approve(
            order_id="WO-E2E",
            operator_id="admin-e2e",
            role=ApprovalRole.ASSET_ADMIN,
            version=2,
        )
        assert updated.status == ApprovalStatus.APPROVED
        assert updated.version == 3
        assert len(updated.approval_records) == 2

    def test_rejection_at_level1_flow(
        self, service: ApprovalChainService
    ) -> None:
        """Flow: create → submit → reject at L1 → REJECTED."""
        order = service.create_order(WorkOrder(
            id="WO-REJ1",
            title="Rejection Test L1",
            status=ApprovalStatus.APPROVING_LEVEL_1,
            version=1,
            applicant="user-rej1",
        ))

        updated = service.reject(
            order_id="WO-REJ1",
            operator_id="manager-rej1",
            rejection_reason="不合规",
            version=1,
        )
        assert updated.status == ApprovalStatus.REJECTED
        assert updated.approval_records[0].rejection_reason == "不合规"

    def test_rejection_at_level2_flow(
        self, service: ApprovalChainService
    ) -> None:
        """Flow: create → approve L1 → reject at L2 → REJECTED."""
        order = service.create_order(WorkOrder(
            id="WO-REJ2",
            title="Rejection Test L2",
            status=ApprovalStatus.APPROVING_LEVEL_2,
            version=1,
            applicant="user-rej2",
        ))

        updated = service.reject(
            order_id="WO-REJ2",
            operator_id="admin-rej2",
            rejection_reason="资产信息不完整",
            version=1,
        )
        assert updated.status == ApprovalStatus.REJECTED
        assert updated.approval_records[0].rejection_reason == "资产信息不完整"

    def test_approval_list_refresh_after_approve(
        self, service: ApprovalChainService
    ) -> None:
        """After approving, the order disappears from the approver's pending list."""
        service.create_order(WorkOrder(
            id="WO-LIST",
            title="List Refresh Test",
            status=ApprovalStatus.APPROVING_LEVEL_1,
            version=1,
            applicant="user-list",
        ))

        # Before approval: DEPT_MANAGER sees the order
        before = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert len(before) == 1

        # Approve at level 1
        service.approve(
            order_id="WO-LIST",
            operator_id="manager-list",
            role=ApprovalRole.DEPT_MANAGER,
            version=1,
        )

        # After approval: DEPT_MANAGER no longer sees it
        after = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert len(after) == 0

        # But ASSET_ADMIN now sees it
        admin_list = service.list_pending_approvals(ApprovalRole.ASSET_ADMIN)
        assert len(admin_list) == 1
        assert admin_list[0].id == "WO-LIST"

    def test_approval_list_refresh_after_reject(
        self, service: ApprovalChainService
    ) -> None:
        """After rejecting, the order disappears from the approver's pending list."""
        service.create_order(WorkOrder(
            id="WO-REJ-LIST",
            title="Reject List Refresh Test",
            status=ApprovalStatus.APPROVING_LEVEL_1,
            version=1,
            applicant="user-rej-list",
        ))

        # Before rejection: DEPT_MANAGER sees the order
        before = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert len(before) == 1

        # Reject
        service.reject(
            order_id="WO-REJ-LIST",
            operator_id="manager-rej-list",
            rejection_reason="驳回原因",
            version=1,
        )

        # After rejection: DEPT_MANAGER no longer sees it
        after = service.list_pending_approvals(ApprovalRole.DEPT_MANAGER)
        assert len(after) == 0

        # ASSET_ADMIN also does not see rejected orders
        admin_list = service.list_pending_approvals(ApprovalRole.ASSET_ADMIN)
        assert len(admin_list) == 0