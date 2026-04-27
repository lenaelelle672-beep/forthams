"""
Unit tests for ApprovalService — multi-level approval workflow.

Covers ATB-1 through ATB-3 from the approval-flow SPEC:
  - ATB-1: Forward state transitions  (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
  - ATB-2: Reverse reject transitions  (any approval level → REJECTED) with rejection reason validation
  - ATB-3: Invalid / cross-level state transition interception (HTTP 409)
  - Optimistic-locking conflict detection (version mismatch → HTTP 409)
  - Role-based data isolation (department manager vs. asset manager)
  - CANCELLED state support
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Inline domain enums & models (mirrors production code for isolated testing)
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """Work-order lifecycle states enforced by the backend state machine."""
    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Actions recorded in the approval_records table."""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


# ---------------------------------------------------------------------------
# Custom exceptions used by the service layer
# ---------------------------------------------------------------------------

class StateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""
    def __init__(self, message: str = "INVALID_STATE_TRANSITION") -> None:
        self.message = message
        super().__init__(self.message)


class OptimisticLockError(Exception):
    """Raised when a concurrent update conflict is detected (version mismatch)."""
    def __init__(self, message: str = "CONCURRENT_UPDATE_CONFLICT") -> None:
        self.message = message
        super().__init__(self.message)


class RejectionReasonRequiredError(Exception):
    """Raised when a reject action is submitted without a rejection reason."""
    def __init__(self, message: str = "REJECTION_REASON_REQUIRED") -> None:
        self.message = message
        super().__init__(self.message)


class RejectionReasonTooLongError(Exception):
    """Raised when the rejection reason exceeds 500 characters."""
    def __init__(self, message: str = "REJECTION_REASON_TOO_LONG") -> None:
        self.message = message
        super().__init__(self.message)


class RolePermissionError(Exception):
    """Raised when the current user's role does not match the approval level."""
    def __init__(self, message: str = "ROLE_PERMISSION_DENIED") -> None:
        self.message = message
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Minimal stubs for persistence layer
# ---------------------------------------------------------------------------

class WorkOrder:
    """Lightweight work-order entity used in tests."""

    def __init__(
        self,
        order_id: str | None = None,
        status: OrderStatus = OrderStatus.PENDING,
        version: int = 1,
        applicant_id: str = "user-001",
    ) -> None:
        self.id: str = order_id or str(uuid.uuid4())
        self.status: OrderStatus = status
        self.version: int = version
        self.applicant_id: str = applicant_id


class ApprovalRecord:
    """Lightweight approval-record entity used in tests."""

    def __init__(
        self,
        order_id: str,
        operator_id: str,
        action: ApprovalAction,
        comment: str | None = None,
    ) -> None:
        self.id: str = str(uuid.uuid4())
        self.order_id: str = order_id
        self.operator_id: str = operator_id
        self.action: ApprovalAction = action
        self.comment: str | None = comment
        self.created_at: datetime = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# State-machine transition map (mirrors production OrderStateMachine)
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: dict[OrderStatus, dict[str, OrderStatus]] = {
    OrderStatus.PENDING: {
        "approve": OrderStatus.APPROVING_LEVEL_1,
        "cancel": OrderStatus.CANCELLED,
    },
    OrderStatus.APPROVING_LEVEL_1: {
        "approve": OrderStatus.APPROVING_LEVEL_2,
        "reject": OrderStatus.REJECTED,
    },
    OrderStatus.APPROVING_LEVEL_2: {
        "approve": OrderStatus.APPROVED,
        "reject": OrderStatus.REJECTED,
    },
    # Terminal / semi-terminal states — no outgoing transitions
    OrderStatus.APPROVED: {},
    OrderStatus.REJECTED: {},
    OrderStatus.CANCELLED: {},
}

# Role → expected approval-level mapping
ROLE_LEVEL_MAP: dict[str, OrderStatus] = {
    "DEPARTMENT_MANAGER": OrderStatus.APPROVING_LEVEL_1,
    "ASSET_MANAGER": OrderStatus.APPROVING_LEVEL_2,
}


# ---------------------------------------------------------------------------
# ApprovalService (the system under test)
# ---------------------------------------------------------------------------

class ApprovalService:
    """Core approval service integrating state-machine, optimistic lock, and persistence.

    This is a *test-double* that mirrors the production ``ApprovalService`` contract
    so that unit tests remain self-contained without importing the full backend.
    """

    def __init__(self, order_repo: Any, record_repo: Any) -> None:
        """Initialise the service with repository stubs.

        Args:
            order_repo: Repository for work-order CRUD (must support ``get`` / ``update``).
            record_repo: Repository for approval-record inserts.
        """
        self._order_repo = order_repo
        self._record_repo = record_repo

    # -- public API ----------------------------------------------------------

    def approve(self, order_id: str, operator_id: str, operator_role: str, expected_version: int) -> WorkOrder:
        """Execute an approval action on the given work order.

        Args:
            order_id: Unique identifier of the work order.
            operator_id: ID of the user performing the approval.
            operator_role: Role of the operator (DEPARTMENT_MANAGER or ASSET_MANAGER).
            expected_version: Expected ``version`` value for optimistic locking.

        Returns:
            The updated ``WorkOrder`` instance.

        Raises:
            StateTransitionError: If the transition is not allowed by the state machine.
            OptimisticLockError: If the ``expected_version`` does not match the current version.
            RolePermissionError: If the operator's role does not match the current approval level.
        """
        order = self._order_repo.get(order_id)
        if order is None:
            raise ValueError(f"Work order {order_id} not found")

        # Optimistic-lock check
        if order.version != expected_version:
            raise OptimisticLockError()

        # Role-level permission check
        self._check_role_permission(order.status, operator_role)

        # State-machine transition
        new_status = self._transition(order.status, "approve")
        order.status = new_status
        order.version += 1
        self._order_repo.update(order)

        # Persist approval record
        record = ApprovalRecord(
            order_id=order.id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
        )
        self._record_repo.insert(record)

        return order

    def reject(
        self,
        order_id: str,
        operator_id: str,
        operator_role: str,
        expected_version: int,
        rejection_reason: str | None = None,
    ) -> WorkOrder:
        """Execute a rejection action on the given work order.

        Args:
            order_id: Unique identifier of the work order.
            operator_id: ID of the user performing the rejection.
            operator_role: Role of the operator.
            expected_version: Expected ``version`` value for optimistic locking.
            rejection_reason: Mandatory reason for the rejection (max 500 chars).

        Returns:
            The updated ``WorkOrder`` instance.

        Raises:
            RejectionReasonRequiredError: If ``rejection_reason`` is empty or ``None``.
            RejectionReasonTooLongError: If ``rejection_reason`` exceeds 500 characters.
            StateTransitionError: If the transition is not allowed.
            OptimisticLockError: On version mismatch.
            RolePermissionError: On role mismatch.
        """
        # Validate rejection reason
        if not rejection_reason or not rejection_reason.strip():
            raise RejectionReasonRequiredError()
        if len(rejection_reason) > 500:
            raise RejectionReasonTooLongError()

        order = self._order_repo.get(order_id)
        if order is None:
            raise ValueError(f"Work order {order_id} not found")

        # Optimistic-lock check
        if order.version != expected_version:
            raise OptimisticLockError()

        # Role-level permission check
        self._check_role_permission(order.status, operator_role)

        # State-machine transition
        new_status = self._transition(order.status, "reject")
        order.status = new_status
        order.version += 1
        self._order_repo.update(order)

        # Persist approval record with rejection reason
        record = ApprovalRecord(
            order_id=order.id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            comment=rejection_reason,
        )
        self._record_repo.insert(record)

        return order

    def cancel(self, order_id: str, operator_id: str, expected_version: int) -> WorkOrder:
        """Cancel a work order (only from PENDING state).

        Args:
            order_id: Unique identifier of the work order.
            operator_id: ID of the user performing the cancellation.
            expected_version: Expected ``version`` value for optimistic locking.

        Returns:
            The updated ``WorkOrder`` instance.

        Raises:
            StateTransitionError: If the order is not in PENDING state.
            OptimisticLockError: On version mismatch.
        """
        order = self._order_repo.get(order_id)
        if order is None:
            raise ValueError(f"Work order {order_id} not found")

        if order.version != expected_version:
            raise OptimisticLockError()

        new_status = self._transition(order.status, "cancel")
        order.status = new_status
        order.version += 1
        self._order_repo.update(order)

        record = ApprovalRecord(
            order_id=order.id,
            operator_id=operator_id,
            action=ApprovalAction.CANCEL,
        )
        self._record_repo.insert(record)

        return order

    def get_pending_orders(self, operator_role: str) -> list[WorkOrder]:
        """Return work orders visible to the given role.

        - DEPARTMENT_MANAGER → orders in APPROVING_LEVEL_1
        - ASSET_MANAGER → orders in APPROVING_LEVEL_2

        Args:
            operator_role: The role of the current user.

        Returns:
            A list of ``WorkOrder`` instances matching the role's visibility scope.
        """
        target_status = ROLE_LEVEL_MAP.get(operator_role)
        if target_status is None:
            raise RolePermissionError()
        return self._order_repo.list_by_status(target_status)

    # -- internal helpers ----------------------------------------------------

    @staticmethod
    def _transition(current: OrderStatus, event: str) -> OrderStatus:
        """Execute a single state-machine transition.

        Args:
            current: The current state of the work order.
            event: The event to trigger (``approve``, ``reject``, or ``cancel``).

        Returns:
            The new state after the transition.

        Raises:
            StateTransitionError: If the transition is not defined in the transition map.
        """
        allowed = VALID_TRANSITIONS.get(current, {})
        if event not in allowed:
            raise StateTransitionError()
        return allowed[event]

    @staticmethod
    def _check_role_permission(current_status: OrderStatus, operator_role: str) -> None:
        """Verify that the operator's role matches the current approval level.

        Args:
            current_status: The current status of the work order.
            operator_role: The role of the operator.

        Raises:
            RolePermissionError: If the role does not match the required level.
        """
        required_status = ROLE_LEVEL_MAP.get(operator_role)
        if required_status is None or current_status != required_status:
            raise RolePermissionError()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def order_repo() -> MagicMock:
    """Create a mock work-order repository."""
    return MagicMock()


@pytest.fixture
def record_repo() -> MagicMock:
    """Create a mock approval-record repository."""
    return MagicMock()


@pytest.fixture
def service(order_repo: MagicMock, record_repo: MagicMock) -> ApprovalService:
    """Create an ApprovalService with mocked repositories."""
    return ApprovalService(order_repo, record_repo)


@pytest.fixture
def pending_order() -> WorkOrder:
    """Return a work order in PENDING state."""
    return WorkOrder(status=OrderStatus.PENDING, version=1)


@pytest.fixture
def level1_order() -> WorkOrder:
    """Return a work order in APPROVING_LEVEL_1 state."""
    return WorkOrder(status=OrderStatus.APPROVING_LEVEL_1, version=2)


@pytest.fixture
def level2_order() -> WorkOrder:
    """Return a work order in APPROVING_LEVEL_2 state."""
    return WorkOrder(status=OrderStatus.APPROVING_LEVEL_2, version=3)


@pytest.fixture
def approved_order() -> WorkOrder:
    """Return a work order in APPROVED (terminal) state."""
    return WorkOrder(status=OrderStatus.APPROVED, version=4)


@pytest.fixture
def rejected_order() -> WorkOrder:
    """Return a work order in REJECTED (terminal) state."""
    return WorkOrder(status=OrderStatus.REJECTED, version=3)


# ===========================================================================
# ATB-1: Forward state-transition tests
# ===========================================================================

class TestForwardStateTransitions:
    """Verify the happy-path approval flow: PENDING → L1 → L2 → APPROVED."""

    def test_approve_pending_to_level1(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """PENDING + approve → APPROVING_LEVEL_1; version incremented; record inserted."""
        order_repo.get.return_value = pending_order

        result = service.approve(
            order_id=pending_order.id,
            operator_id="manager-001",
            operator_role="DEPARTMENT_MANAGER",
            expected_version=1,
        )

        assert result.status == OrderStatus.APPROVING_LEVEL_1
        assert result.version == 2
        order_repo.update.assert_called_once()
        record_repo.insert.assert_called_once()
        inserted_record = record_repo.insert.call_args[0][0]
        assert inserted_record.action == ApprovalAction.APPROVE
        assert inserted_record.operator_id == "manager-001"

    def test_approve_level1_to_level2(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """APPROVING_LEVEL_1 + approve → APPROVING_LEVEL_2."""
        order_repo.get.return_value = level1_order

        result = service.approve(
            order_id=level1_order.id,
            operator_id="manager-001",
            operator_role="DEPARTMENT_MANAGER",
            expected_version=2,
        )

        assert result.status == OrderStatus.APPROVING_LEVEL_2
        assert result.version == 3
        record_repo.insert.assert_called_once()

    def test_approve_level2_to_approved(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level2_order: WorkOrder,
    ) -> None:
        """APPROVING_LEVEL_2 + approve → APPROVED."""
        order_repo.get.return_value = level2_order

        result = service.approve(
            order_id=level2_order.id,
            operator_id="asset-mgr-001",
            operator_role="ASSET_MANAGER",
            expected_version=3,
        )

        assert result.status == OrderStatus.APPROVED
        assert result.version == 4
        record_repo.insert.assert_called_once()

    def test_full_approval_chain_creates_three_records(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """End-to-end: PENDING → L1 → L2 → APPROVED produces 3 approval records."""
        # Step 1: PENDING → L1
        order_repo.get.return_value = pending_order
        service.approve(pending_order.id, "dept-mgr", "DEPARTMENT_MANAGER", 1)

        # Step 2: L1 → L2 (update the mock to reflect new state)
        level1 = WorkOrder(order_id=pending_order.id, status=OrderStatus.APPROVING_LEVEL_1, version=2)
        order_repo.get.return_value = level1
        service.approve(pending_order.id, "dept-mgr", "DEPARTMENT_MANAGER", 2)

        # Step 3: L2 → APPROVED
        level2 = WorkOrder(order_id=pending_order.id, status=OrderStatus.APPROVING_LEVEL_2, version=3)
        order_repo.get.return_value = level2
        service.approve(pending_order.id, "asset-mgr", "ASSET_MANAGER", 3)

        assert record_repo.insert.call_count == 3


# ===========================================================================
# ATB-2: Reject (reverse) state-transition tests
# ===========================================================================

class TestRejectStateTransitions:
    """Verify rejection from any approval level and rejection-reason validation."""

    def test_reject_from_level1(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """APPROVING_LEVEL_1 + reject → REJECTED; record stores rejection reason."""
        order_repo.get.return_value = level1_order

        result = service.reject(
            order_id=level1_order.id,
            operator_id="manager-001",
            operator_role="DEPARTMENT_MANAGER",
            expected_version=2,
            rejection_reason="预算不合规，请重新提交",
        )

        assert result.status == OrderStatus.REJECTED
        assert result.version == 3
        record_repo.insert.assert_called_once()
        inserted_record = record_repo.insert.call_args[0][0]
        assert inserted_record.action == ApprovalAction.REJECT
        assert inserted_record.comment == "预算不合规，请重新提交"

    def test_reject_from_level2(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level2_order: WorkOrder,
    ) -> None:
        """APPROVING_LEVEL_2 + reject → REJECTED."""
        order_repo.get.return_value = level2_order

        result = service.reject(
            order_id=level2_order.id,
            operator_id="asset-mgr-001",
            operator_role="ASSET_MANAGER",
            expected_version=3,
            rejection_reason="资产信息不完整",
        )

        assert result.status == OrderStatus.REJECTED
        assert result.version == 4

    def test_reject_without_reason_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Rejecting without a reason must raise RejectionReasonRequiredError."""
        order_repo.get.return_value = level1_order

        with pytest.raises(RejectionReasonRequiredError):
            service.reject(
                order_id=level1_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=2,
                rejection_reason=None,
            )

    def test_reject_with_empty_reason_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Rejecting with an empty-string reason must raise RejectionReasonRequiredError."""
        order_repo.get.return_value = level1_order

        with pytest.raises(RejectionReasonRequiredError):
            service.reject(
                order_id=level1_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=2,
                rejection_reason="   ",
            )

    def test_reject_with_whitespace_only_reason_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Rejecting with whitespace-only reason must raise RejectionReasonRequiredError."""
        order_repo.get.return_value = level1_order

        with pytest.raises(RejectionReasonRequiredError):
            service.reject(
                order_id=level1_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=2,
                rejection_reason="\t\n",
            )

    def test_reject_with_reason_exceeding_500_chars_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Rejection reason longer than 500 characters must raise RejectionReasonTooLongError."""
        order_repo.get.return_value = level1_order
        long_reason = "A" * 501

        with pytest.raises(RejectionReasonTooLongError):
            service.reject(
                order_id=level1_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=2,
                rejection_reason=long_reason,
            )

    def test_reject_with_exactly_500_chars_succeeds(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Rejection reason of exactly 500 characters must be accepted."""
        order_repo.get.return_value = level1_order
        reason_500 = "B" * 500

        result = service.reject(
            order_id=level1_order.id,
            operator_id="manager-001",
            operator_role="DEPARTMENT_MANAGER",
            expected_version=2,
            rejection_reason=reason_500,
        )

        assert result.status == OrderStatus.REJECTED
        record_repo.insert.assert_called_once()

    def test_reject_does_not_persist_record_on_failure(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """When rejection fails (missing reason), no approval record should be persisted."""
        order_repo.get.return_value = level1_order

        with pytest.raises(RejectionReasonRequiredError):
            service.reject(
                order_id=level1_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=2,
                rejection_reason=None,
            )

        record_repo.insert.assert_not_called()


# ===========================================================================
# ATB-3: Invalid / cross-level state-transition tests
# ===========================================================================

class TestInvalidStateTransitions:
    """Verify that illegal transitions are rejected with StateTransitionError."""

    def test_cannot_approve_from_pending_as_asset_manager(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """ATB-3: Asset manager cannot approve a PENDING order directly (cross-level)."""
        order_repo.get.return_value = pending_order

        with pytest.raises(RolePermissionError):
            service.approve(
                order_id=pending_order.id,
                operator_id="asset-mgr-001",
                operator_role="ASSET_MANAGER",
                expected_version=1,
            )

    def test_cannot_approve_from_approved_state(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        approved_order: WorkOrder,
    ) -> None:
        """APPROVED is a terminal state; further approval must fail."""
        order_repo.get.return_value = approved_order

        with pytest.raises(StateTransitionError):
            service.approve(
                order_id=approved_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=4,
            )

    def test_cannot_reject_from_pending_state(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """PENDING state does not support reject; must raise StateTransitionError."""
        order_repo.get.return_value = pending_order

        with pytest.raises(StateTransitionError):
            service.reject(
                order_id=pending_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=1,
                rejection_reason="测试驳回",
            )

    def test_cannot_reject_from_approved_state(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        approved_order: WorkOrder,
    ) -> None:
        """APPROVED is terminal; reject must fail."""
        order_repo.get.return_value = approved_order

        with pytest.raises(StateTransitionError):
            service.reject(
                order_id=approved_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=4,
                rejection_reason="已批准不可驳回",
            )

    def test_cannot_reject_from_rejected_state(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        rejected_order: WorkOrder,
    ) -> None:
        """REJECTED is terminal; reject must fail."""
        order_repo.get.return_value = rejected_order

        with pytest.raises(StateTransitionError):
            service.reject(
                order_id=rejected_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=3,
                rejection_reason="重复驳回",
            )

    def test_cannot_approve_from_rejected_state(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        rejected_order: WorkOrder,
    ) -> None:
        """REJECTED is terminal; approve must fail."""
        order_repo.get.return_value = rejected_order

        with pytest.raises(StateTransitionError):
            service.approve(
                order_id=rejected_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=3,
            )

    def test_invalid_transition_preserves_current_state(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        approved_order: WorkOrder,
    ) -> None:
        """After a failed transition, the order status must remain unchanged."""
        order_repo.get.return_value = approved_order

        with pytest.raises(StateTransitionError):
            service.approve(
                order_id=approved_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=4,
            )

        # The mock was never asked to update
        order_repo.update.assert_not_called()
        assert approved_order.status == OrderStatus.APPROVED


# ===========================================================================
# CANCELLED state tests
# ===========================================================================

class TestCancelStateTransitions:
    """Verify cancellation from PENDING state."""

    def test_cancel_from_pending(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """PENDING + cancel → CANCELLED; record inserted with CANCEL action."""
        order_repo.get.return_value = pending_order

        result = service.cancel(
            order_id=pending_order.id,
            operator_id="user-001",
            expected_version=1,
        )

        assert result.status == OrderStatus.CANCELLED
        assert result.version == 2
        record_repo.insert.assert_called_once()
        inserted_record = record_repo.insert.call_args[0][0]
        assert inserted_record.action == ApprovalAction.CANCEL

    def test_cannot_cancel_from_level1(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Cancellation is only allowed from PENDING; L1 must fail."""
        order_repo.get.return_value = level1_order

        with pytest.raises(StateTransitionError):
            service.cancel(
                order_id=level1_order.id,
                operator_id="user-001",
                expected_version=2,
            )

    def test_cannot_cancel_from_approved(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        approved_order: WorkOrder,
    ) -> None:
        """Cannot cancel an already-approved order."""
        order_repo.get.return_value = approved_order

        with pytest.raises(StateTransitionError):
            service.cancel(
                order_id=approved_order.id,
                operator_id="user-001",
                expected_version=4,
            )


# ===========================================================================
# Optimistic-locking tests
# ===========================================================================

class TestOptimisticLocking:
    """Verify that concurrent update conflicts are detected via version check."""

    def test_approve_with_stale_version_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """Approve with expected_version=1 but actual version=2 must raise OptimisticLockError."""
        stale_order = WorkOrder(
            order_id=pending_order.id,
            status=OrderStatus.PENDING,
            version=2,  # version has been bumped by another request
        )
        order_repo.get.return_value = stale_order

        with pytest.raises(OptimisticLockError):
            service.approve(
                order_id=pending_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=1,  # stale
            )

    def test_reject_with_stale_version_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Reject with stale version must raise OptimisticLockError."""
        stale_order = WorkOrder(
            order_id=level1_order.id,
            status=OrderStatus.APPROVING_LEVEL_1,
            version=5,
        )
        order_repo.get.return_value = stale_order

        with pytest.raises(OptimisticLockError):
            service.reject(
                order_id=level1_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=2,
                rejection_reason="版本冲突测试",
            )

    def test_cancel_with_stale_version_raises_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """Cancel with stale version must raise OptimisticLockError."""
        stale_order = WorkOrder(
            order_id=pending_order.id,
            status=OrderStatus.PENDING,
            version=99,
        )
        order_repo.get.return_value = stale_order

        with pytest.raises(OptimisticLockError):
            service.cancel(
                order_id=pending_order.id,
                operator_id="user-001",
                expected_version=1,
            )

    def test_optimistic_lock_failure_does_not_persist_record(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """When optimistic lock fails, no approval record should be persisted."""
        stale_order = WorkOrder(
            order_id=pending_order.id,
            status=OrderStatus.PENDING,
            version=2,
        )
        order_repo.get.return_value = stale_order

        with pytest.raises(OptimisticLockError):
            service.approve(
                order_id=pending_order.id,
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=1,
            )

        record_repo.insert.assert_not_called()
        order_repo.update.assert_not_called()


# ===========================================================================
# Role-based data isolation tests
# ===========================================================================

class TestRoleBasedDataIsolation:
    """Verify that each role only sees orders at their approval level."""

    def test_department_manager_sees_only_level1_orders(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
    ) -> None:
        """DEPARTMENT_MANAGER must only receive APPROVING_LEVEL_1 orders."""
        level1_orders = [
            WorkOrder(status=OrderStatus.APPROVING_LEVEL_1),
            WorkOrder(status=OrderStatus.APPROVING_LEVEL_1),
        ]
        order_repo.list_by_status.return_value = level1_orders

        result = service.get_pending_orders("DEPARTMENT_MANAGER")

        order_repo.list_by_status.assert_called_once_with(OrderStatus.APPROVING_LEVEL_1)
        assert len(result) == 2
        assert all(o.status == OrderStatus.APPROVING_LEVEL_1 for o in result)

    def test_asset_manager_sees_only_level2_orders(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
    ) -> None:
        """ASSET_MANAGER must only receive APPROVING_LEVEL_2 orders."""
        level2_orders = [
            WorkOrder(status=OrderStatus.APPROVING_LEVEL_2),
        ]
        order_repo.list_by_status.return_value = level2_orders

        result = service.get_pending_orders("ASSET_MANAGER")

        order_repo.list_by_status.assert_called_once_with(OrderStatus.APPROVING_LEVEL_2)
        assert len(result) == 1
        assert result[0].status == OrderStatus.APPROVING_LEVEL_2

    def test_unknown_role_raises_permission_error(
        self,
        service: ApprovalService,
    ) -> None:
        """An unrecognised role must raise RolePermissionError."""
        with pytest.raises(RolePermissionError):
            service.get_pending_orders("UNKNOWN_ROLE")

    def test_department_manager_cannot_approve_level2_order(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level2_order: WorkOrder,
    ) -> None:
        """DEPARTMENT_MANAGER must not be allowed to approve a LEVEL_2 order."""
        order_repo.get.return_value = level2_order

        with pytest.raises(RolePermissionError):
            service.approve(
                order_id=level2_order.id,
                operator_id="dept-mgr-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=3,
            )

    def test_asset_manager_cannot_approve_level1_order(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """ASSET_MANAGER must not be allowed to approve a LEVEL_1 order."""
        order_repo.get.return_value = level1_order

        with pytest.raises(RolePermissionError):
            service.approve(
                order_id=level1_order.id,
                operator_id="asset-mgr-001",
                operator_role="ASSET_MANAGER",
                expected_version=2,
            )


# ===========================================================================
# Approval record persistence tests
# ===========================================================================

class TestApprovalRecordPersistence:
    """Verify that approval records capture all required fields."""

    def test_approve_record_contains_operator_and_timestamp(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """Approval record must store operator_id, action, and created_at timestamp."""
        order_repo.get.return_value = pending_order

        service.approve(
            order_id=pending_order.id,
            operator_id="manager-001",
            operator_role="DEPARTMENT_MANAGER",
            expected_version=1,
        )

        record = record_repo.insert.call_args[0][0]
        assert record.operator_id == "manager-001"
        assert record.action == ApprovalAction.APPROVE
        assert record.order_id == pending_order.id
        assert isinstance(record.created_at, datetime)

    def test_reject_record_stores_reason(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        level1_order: WorkOrder,
    ) -> None:
        """Rejection record must store the rejection reason in the comment field."""
        order_repo.get.return_value = level1_order

        service.reject(
            order_id=level1_order.id,
            operator_id="manager-001",
            operator_role="DEPARTMENT_MANAGER",
            expected_version=2,
            rejection_reason="不合规",
        )

        record = record_repo.insert.call_args[0][0]
        assert record.action == ApprovalAction.REJECT
        assert record.comment == "不合规"

    def test_cancel_record_has_no_comment(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """Cancellation record should have no comment (comment is None)."""
        order_repo.get.return_value = pending_order

        service.cancel(
            order_id=pending_order.id,
            operator_id="user-001",
            expected_version=1,
        )

        record = record_repo.insert.call_args[0][0]
        assert record.action == ApprovalAction.CANCEL
        assert record.comment is None


# ===========================================================================
# Edge-case / error-path tests
# ===========================================================================

class TestEdgeCases:
    """Miscellaneous edge cases and defensive checks."""

    def test_approve_nonexistent_order_raises_value_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
    ) -> None:
        """Approving a non-existent order must raise ValueError."""
        order_repo.get.return_value = None

        with pytest.raises(ValueError, match="not found"):
            service.approve(
                order_id="nonexistent-id",
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=1,
            )

    def test_reject_nonexistent_order_raises_value_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
    ) -> None:
        """Rejecting a non-existent order must raise ValueError."""
        order_repo.get.return_value = None

        with pytest.raises(ValueError, match="not found"):
            service.reject(
                order_id="nonexistent-id",
                operator_id="manager-001",
                operator_role="DEPARTMENT_MANAGER",
                expected_version=1,
                rejection_reason="测试",
            )

    def test_cancel_nonexistent_order_raises_value_error(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
    ) -> None:
        """Cancelling a non-existent order must raise ValueError."""
        order_repo.get.return_value = None

        with pytest.raises(ValueError, match="not found"):
            service.cancel(
                order_id="nonexistent-id",
                operator_id="user-001",
                expected_version=1,
            )

    def test_state_transition_error_has_correct_message(self) -> None:
        """StateTransitionError must carry the INVALID_STATE_TRANSITION message."""
        err = StateTransitionError()
        assert err.message == "INVALID_STATE_TRANSITION"

    def test_optimistic_lock_error_has_correct_message(self) -> None:
        """OptimisticLockError must carry the CONCURRENT_UPDATE_CONFLICT message."""
        err = OptimisticLockError()
        assert err.message == "CONCURRENT_UPDATE_CONFLICT"

    def test_rejection_reason_required_error_has_correct_message(self) -> None:
        """RejectionReasonRequiredError must carry the REJECTION_REASON_REQUIRED message."""
        err = RejectionReasonRequiredError()
        assert err.message == "REJECTION_REASON_REQUIRED"

    def test_version_increments_on_each_approval(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
        record_repo: MagicMock,
        pending_order: WorkOrder,
    ) -> None:
        """Version must monotonically increase with each successful approval."""
        # Step 1
        order_repo.get.return_value = pending_order
        result1 = service.approve(pending_order.id, "mgr", "DEPARTMENT_MANAGER", 1)
        assert result1.version == 2

        # Step 2
        level1 = WorkOrder(order_id=pending_order.id, status=OrderStatus.APPROVING_LEVEL_1, version=2)
        order_repo.get.return_value = level1
        result2 = service.approve(pending_order.id, "mgr", "DEPARTMENT_MANAGER", 2)
        assert result2.version == 3

        # Step 3
        level2 = WorkOrder(order_id=pending_order.id, status=OrderStatus.APPROVING_LEVEL_2, version=3)
        order_repo.get.return_value = level2
        result3 = service.approve(pending_order.id, "asset-mgr", "ASSET_MANAGER", 3)
        assert result3.version == 4

    def test_empty_pending_list_for_role(
        self,
        service: ApprovalService,
        order_repo: MagicMock,
    ) -> None:
        """get_pending_orders should return an empty list when no orders match."""
        order_repo.list_by_status.return_value = []

        result = service.get_pending_orders("DEPARTMENT_MANAGER")
        assert result == []