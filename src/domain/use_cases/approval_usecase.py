"""
Approval Use Case — Multi-level approval workflow for work orders.

Implements the core approval business logic for the two-level approval chain:
    Department Manager (Level 1) → Asset Manager (Level 2)

Responsibilities:
    - State machine-driven status transitions (PENDING → APPROVING_LEVEL_1
      → APPROVING_LEVEL_2 → APPROVED).
    - Reverse flow to REJECTED from any approval node.
    - CANCELLED status support for PENDING work orders.
    - Approval record persistence with full audit trail (operator, action,
      timestamp, rejection reason).
    - Optimistic locking (version field) to prevent concurrent approval
      conflicts.
    - Role-based data isolation for pending approval queries.

State Machine Summary:
    Forward : PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Reject  : APPROVING_LEVEL_1 | APPROVING_LEVEL_2 → REJECTED
    Cancel  : PENDING → CANCELLED
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Sequence, runtime_checkable


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------

class ApprovalUseCaseError(Exception):
    """Base exception for all approval use case errors."""

    def __init__(self, message: str, code: str = "APPROVAL_ERROR") -> None:
        self.code = code
        super().__init__(message)


class WorkOrderNotFoundError(ApprovalUseCaseError):
    """Raised when the target work order does not exist."""

    def __init__(self, order_id: int) -> None:
        super().__init__(
            message=f"Work order with id={order_id} not found.",
            code="WORK_ORDER_NOT_FOUND",
        )


class InvalidStateTransitionError(ApprovalUseCaseError):
    """Raised when a state transition violates the state machine rules."""

    def __init__(
        self,
        order_id: int,
        current_status: str,
        target_status: str,
    ) -> None:
        super().__init__(
            message=(
                f"Invalid state transition for order id={order_id}: "
                f"'{current_status}' → '{target_status}'."
            ),
            code="INVALID_STATE_TRANSITION",
        )


class ConcurrentApprovalConflictError(ApprovalUseCaseError):
    """Raised when optimistic lock version mismatch is detected."""

    def __init__(
        self,
        order_id: int,
        expected_version: int,
        actual_version: int,
    ) -> None:
        super().__init__(
            message=(
                f"Concurrent modification detected for order id={order_id}. "
                f"Expected version {expected_version}, actual version "
                f"{actual_version}."
            ),
            code="CONCURRENT_CONFLICT",
        )


class RejectionReasonRequiredError(ApprovalUseCaseError):
    """Raised when a rejection reason is missing or invalid."""

    def __init__(self, detail: str) -> None:
        super().__init__(
            message=detail,
            code="REJECTION_REASON_REQUIRED",
        )


class RolePermissionDeniedError(ApprovalUseCaseError):
    """Raised when the operator's role is not authorized for the action."""

    def __init__(self, role: str, detail: str) -> None:
        super().__init__(
            message=f"Role '{role}' is not authorized: {detail}",
            code="ROLE_PERMISSION_DENIED",
        )


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ApprovalAction(str, Enum):
    """Enumeration of possible approval actions recorded in history."""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class ApprovalLevel(str, Enum):
    """Approval level identifiers mapped to organisational roles."""
    LEVEL_1_DEPT_MANAGER = "LEVEL_1_DEPT_MANAGER"
    LEVEL_2_ASSET_MANAGER = "LEVEL_2_ASSET_MANAGER"


# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ApprovalRecordDTO:
    """Immutable data transfer object for a single approval record.

    Attributes:
        order_id:           The work order this record belongs to.
        operator_id:        ID of the user who performed the action.
        action:             One of ``APPROVE``, ``REJECT``, ``CANCEL``.
        comment:            Optional free-text comment / rejection reason.
        approval_level:     Which approval level this action was taken at.
        created_at:         ISO-8601 timestamp of when the action occurred.
    """
    order_id: int
    operator_id: int
    action: str
    comment: Optional[str] = None
    approval_level: Optional[str] = None
    created_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )


@dataclass
class ApprovalResult:
    """Result of an approval / rejection / cancellation operation.

    Attributes:
        success:            Whether the operation succeeded.
        order_id:           The work order that was acted upon.
        new_status:         The status after the transition.
        message:            Human-readable summary.
        approval_record:    The persisted approval record (if any).
        version:            The new version number after the update.
    """
    success: bool
    order_id: int
    new_status: str
    message: str
    approval_record: Optional[ApprovalRecordDTO] = None
    version: Optional[int] = None


@dataclass
class PaginatedApprovalList:
    """Paginated list of work orders awaiting approval.

    Attributes:
        items:      Work order entities matching the query.
        total:      Total count of matching records.
        page:       Current page number (1-indexed).
        page_size:  Number of items per page.
    """
    items: Sequence[Any]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Protocols (lightweight interfaces for repository / engine dependencies)
# ---------------------------------------------------------------------------

@runtime_checkable
class WorkOrderRepository(Protocol):
    """Protocol for work order persistence operations."""

    def get_by_id(self, order_id: int) -> Optional[Any]:
        """Retrieve a work order by its primary key."""
        ...

    def update(self, work_order: Any) -> Any:
        """Persist an updated work order entity."""
        ...

    def list_by_status(
        self,
        status: Any,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Any]:
        """List work orders filtered by status with pagination."""
        ...

    def count_by_status(self, status: Any) -> int:
        """Count work orders matching a given status."""
        ...


@runtime_checkable
class ApprovalRecordRepository(Protocol):
    """Protocol for approval record persistence operations."""

    def create(self, record: ApprovalRecordDTO) -> Any:
        """Persist a new approval record."""
        ...

    def list_by_order_id(self, order_id: int) -> Sequence[Any]:
        """Retrieve all approval records for a work order, oldest first."""
        ...


@runtime_checkable
class StateMachineEngine(Protocol):
    """Protocol for state machine transition validation and execution."""

    def can_transition(
        self,
        current_status: Any,
        target_status: Any,
    ) -> bool:
        """Check whether a transition is valid without side effects."""
        ...

    def transition(
        self,
        current_status: Any,
        target_status: Any,
        order_id: int,
    ) -> None:
        """Execute a validated state transition.

        Raises:
            InvalidStateTransitionError: If the transition is illegal.
        """
        ...


# ---------------------------------------------------------------------------
# Core Use Case
# ---------------------------------------------------------------------------

class ApprovalUseCase:
    """Core use case for multi-level work order approval.

    Orchestrates state machine transitions, approval record persistence,
    role-based access control, and optimistic locking.

    Usage::

        use_case = ApprovalUseCase(
            state_machine=sm_engine,
            work_order_repo=wo_repo,
            approval_record_repo=ar_repo,
        )
        result = use_case.approve(
            order_id=42,
            operator_id=7,
            operator_role="DEPT_MANAGER",
            expected_version=3,
        )
    """

    # Mapping: approval level → the work-order status that level handles
    _LEVEL_STATUS_MAP: Dict[ApprovalLevel, Any] = {}  # populated in __init__

    # Mapping: operator role string → approval level
    _ROLE_LEVEL_MAP: Dict[str, ApprovalLevel] = {
        "DEPT_MANAGER": ApprovalLevel.LEVEL_1_DEPT_MANAGER,
        "ASSET_MANAGER": ApprovalLevel.LEVEL_2_ASSET_MANAGER,
    }

    # Maximum allowed length for a rejection reason
    MAX_REJECTION_REASON_LENGTH: int = 500

    # Forward approval transitions: current status → next status
    _FORWARD_TRANSITIONS: Dict[Any, Any] = {}  # populated in __init__

    def __init__(
        self,
        state_machine: StateMachineEngine,
        work_order_repo: WorkOrderRepository,
        approval_record_repo: ApprovalRecordRepository,
        status_enum: Any = None,
    ) -> None:
        """Initialise the ApprovalUseCase.

        Args:
            state_machine:           Engine for validating/executing transitions.
            work_order_repo:         Repository for work order CRUD.
            approval_record_repo:    Repository for approval record persistence.
            status_enum:             The ``WorkOrderStatus`` enum class used to
                                     resolve status values.  When *None*, the
                                     module attempts a lazy import from
                                     ``src.domain.enums.workorder_status``.
        """
        self._state_machine = state_machine
        self._work_order_repo = work_order_repo
        self._approval_record_repo = approval_record_repo

        # Resolve the WorkOrderStatus enum
        if status_enum is not None:
            self._status = status_enum
        else:
            try:
                from src.domain.enums.workorder_status import WorkOrderStatus
                self._status = WorkOrderStatus
            except ImportError:
                # Fallback: create a lightweight enum so the class is still
                # importable for structural / static-analysis purposes.
                self._status = self._make_fallback_status_enum()

        # Build level ↔ status mapping
        self._LEVEL_STATUS_MAP = {
            ApprovalLevel.LEVEL_1_DEPT_MANAGER: self._status.APPROVING_LEVEL_1,
            ApprovalLevel.LEVEL_2_ASSET_MANAGER: self._status.APPROVING_LEVEL_2,
        }

        # Build forward transition map
        self._FORWARD_TRANSITIONS = {
            self._status.APPROVING_LEVEL_1: self._status.APPROVING_LEVEL_2,
            self._status.APPROVING_LEVEL_2: self._status.APPROVED,
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def approve(
        self,
        order_id: int,
        operator_id: int,
        operator_role: str,
        expected_version: int,
    ) -> ApprovalResult:
        """Approve a work order at the current approval level.

        The operator's role must match the approval level implied by the
        work order's current status.  Upon success the work order advances
        to the next status and an approval record is persisted.

        Args:
            order_id:          ID of the work order.
            operator_id:       ID of the approving user.
            operator_role:     Role string (``DEPT_MANAGER`` or
                               ``ASSET_MANAGER``).
            expected_version:  Version for optimistic locking.

        Returns:
            ``ApprovalResult`` describing the outcome.

        Raises:
            WorkOrderNotFoundError:         Order does not exist.
            ConcurrentApprovalConflictError: Version mismatch.
            RolePermissionDeniedError:       Role ≠ current approval level.
            InvalidStateTransitionError:     Transition rejected by state
                                             machine.
        """
        work_order = self._get_and_lock(order_id, expected_version)

        approval_level = self._resolve_approval_level(operator_role)
        self._validate_role_matches_status(work_order, approval_level)

        target_status = self._next_status(work_order.status)
        self._execute_transition(order_id, work_order.status, target_status)

        new_version = self._persist_status_update(
            work_order, target_status,
        )

        record = self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
            approval_level=approval_level,
        )

        return ApprovalResult(
            success=True,
            order_id=order_id,
            new_status=self._status_value(target_status),
            message=(
                f"Work order {order_id} approved at "
                f"{approval_level.value}."
            ),
            approval_record=record,
            version=new_version,
        )

    def reject(
        self,
        order_id: int,
        operator_id: int,
        operator_role: str,
        rejection_reason: str,
        expected_version: int,
    ) -> ApprovalResult:
        """Reject a work order at the current approval level.

        A non-empty rejection reason (max 500 characters) is mandatory.
        The work order transitions to ``REJECTED`` regardless of which
        approval level it currently sits at.

        Args:
            order_id:          ID of the work order.
            operator_id:       ID of the rejecting user.
            operator_role:     Role string.
            rejection_reason:  Mandatory reason (1–500 chars).
            expected_version:  Version for optimistic locking.

        Returns:
            ``ApprovalResult`` describing the outcome.

        Raises:
            WorkOrderNotFoundError:          Order does not exist.
            ConcurrentApprovalConflictError: Version mismatch.
            RejectionReasonRequiredError:    Reason empty or too long.
            RolePermissionDeniedError:       Role ≠ current approval level.
            InvalidStateTransitionError:     Transition rejected by state
                                             machine.
        """
        self._validate_rejection_reason(rejection_reason)

        work_order = self._get_and_lock(order_id, expected_version)

        approval_level = self._resolve_approval_level(operator_role)
        self._validate_role_matches_status(work_order, approval_level)

        target_status = self._status.REJECTED
        self._execute_transition(order_id, work_order.status, target_status)

        new_version = self._persist_status_update(
            work_order, target_status,
        )

        record = self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            approval_level=approval_level,
            comment=rejection_reason,
        )

        return ApprovalResult(
            success=True,
            order_id=order_id,
            new_status=self._status_value(target_status),
            message=(
                f"Work order {order_id} rejected at "
                f"{approval_level.value}."
            ),
            approval_record=record,
            version=new_version,
        )

    def cancel(
        self,
        order_id: int,
        operator_id: int,
        expected_version: int,
    ) -> ApprovalResult:
        """Cancel a work order that is still in ``PENDING`` status.

        Args:
            order_id:          ID of the work order.
            operator_id:       ID of the cancelling user.
            expected_version:  Version for optimistic locking.

        Returns:
            ``ApprovalResult`` describing the outcome.

        Raises:
            WorkOrderNotFoundError:          Order does not exist.
            ConcurrentApprovalConflictError: Version mismatch.
            InvalidStateTransitionError:     Order not in PENDING.
        """
        work_order = self._get_and_lock(order_id, expected_version)

        target_status = self._status.CANCELLED
        self._execute_transition(order_id, work_order.status, target_status)

        new_version = self._persist_status_update(
            work_order, target_status,
        )

        record = self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.CANCEL,
        )

        return ApprovalResult(
            success=True,
            order_id=order_id,
            new_status=self._status_value(target_status),
            message=f"Work order {order_id} has been cancelled.",
            approval_record=record,
            version=new_version,
        )

    def get_pending_approvals(
        self,
        operator_role: str,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedApprovalList:
        """Retrieve pending work orders scoped to the operator's role.

        Enforces data isolation:
        - ``DEPT_MANAGER``  → only ``APPROVING_LEVEL_1`` orders.
        - ``ASSET_MANAGER`` → only ``APPROVING_LEVEL_2`` orders.

        Args:
            operator_role:  Role of the authenticated user.
            page:           1-indexed page number.
            page_size:      Items per page.

        Returns:
            ``PaginatedApprovalList`` with matching work orders.

        Raises:
            RolePermissionDeniedError: Role has no approval permissions.
        """
        approval_level = self._resolve_approval_level(operator_role)
        target_status = self._LEVEL_STATUS_MAP[approval_level]

        offset = (page - 1) * page_size
        items = self._work_order_repo.list_by_status(
            status=target_status,
            offset=offset,
            limit=page_size,
        )
        total = self._work_order_repo.count_by_status(target_status)

        return PaginatedApprovalList(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    def get_approval_history(self, order_id: int) -> List[Any]:
        """Retrieve the full approval history for a work order.

        Args:
            order_id:  ID of the work order.

        Returns:
            List of approval records ordered by creation time (ascending).
        """
        return list(self._approval_record_repo.list_by_order_id(order_id))

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_and_lock(self, order_id: int, expected_version: int) -> Any:
        """Fetch a work order and verify optimistic lock version.

        Args:
            order_id:          Work order primary key.
            expected_version:  Version the caller expects.

        Returns:
            The work order entity.

        Raises:
            WorkOrderNotFoundError:          If not found.
            ConcurrentApprovalConflictError: If version mismatch.
        """
        work_order = self._work_order_repo.get_by_id(order_id)
        if work_order is None:
            raise WorkOrderNotFoundError(order_id)

        actual_version = getattr(work_order, "version", None)
        if actual_version is not None and actual_version != expected_version:
            raise ConcurrentApprovalConflictError(
                order_id, expected_version, actual_version,
            )

        return work_order

    def _resolve_approval_level(self, operator_role: str) -> ApprovalLevel:
        """Map an operator role to its corresponding ``ApprovalLevel``.

        Args:
            operator_role:  Role identifier string.

        Returns:
            Matching ``ApprovalLevel``.

        Raises:
            RolePermissionDeniedError: If the role has no mapping.
        """
        level = self._ROLE_LEVEL_MAP.get(operator_role)
        if level is None:
            raise RolePermissionDeniedError(
                role=operator_role,
                detail=(
                    "This role does not have approval permissions. "
                    f"Valid roles: {list(self._ROLE_LEVEL_MAP.keys())}."
                ),
            )
        return level

    def _validate_role_matches_status(
        self,
        work_order: Any,
        approval_level: ApprovalLevel,
    ) -> None:
        """Ensure the operator's level matches the order's current status.

        Args:
            work_order:      The work order entity (must have ``status``).
            approval_level:  The operator's approval level.

        Raises:
            RolePermissionDeniedError: On mismatch.
        """
        current_status = getattr(work_order, "status", None)
        expected_status = self._LEVEL_STATUS_MAP[approval_level]

        if current_status != expected_status:
            raise RolePermissionDeniedError(
                role=approval_level.value,
                detail=(
                    f"Work order is in status "
                    f"'{self._status_value(current_status)}' but this "
                    f"approval level handles "
                    f"'{self._status_value(expected_status)}'."
                ),
            )

    def _validate_rejection_reason(self, reason: str) -> None:
        """Validate that the rejection reason is non-empty and within limits.

        Args:
            reason:  The rejection reason string.

        Raises:
            RejectionReasonRequiredError: If invalid.
        """
        if not reason or not reason.strip():
            raise RejectionReasonRequiredError(
                "Rejection reason is required and cannot be empty.",
            )
        if len(reason) > self.MAX_REJECTION_REASON_LENGTH:
            raise RejectionReasonRequiredError(
                f"Rejection reason must not exceed "
                f"{self.MAX_REJECTION_REASON_LENGTH} characters "
                f"(got {len(reason)})."
            )

    def _next_status(self, current_status: Any) -> Any:
        """Determine the next status after an approval action.

        Args:
            current_status:  The work order's current status.

        Returns:
            The next ``WorkOrderStatus`` value.

        Raises:
            InvalidStateTransitionError: If not in an approval-pending status.
        """
        next_status = self._FORWARD_TRANSITIONS.get(current_status)
        if next_status is None:
            valid = [
                self._status_value(s) for s in self._FORWARD_TRANSITIONS
            ]
            raise InvalidStateTransitionError(
                order_id=0,
                current_status=self._status_value(current_status),
                target_status="(next approval level)",
            )
        return next_status

    def _execute_transition(
        self,
        order_id: int,
        current_status: Any,
        target_status: Any,
    ) -> None:
        """Delegate transition validation and execution to the state machine.

        Args:
            order_id:        Work order ID (for error reporting).
            current_status:  Current status value.
            target_status:   Desired target status value.

        Raises:
            InvalidStateTransitionError: If the state machine rejects the
                                         transition.
        """
        if not self._state_machine.can_transition(current_status, target_status):
            raise InvalidStateTransitionError(
                order_id=order_id,
                current_status=self._status_value(current_status),
                target_status=self._status_value(target_status),
            )
        self._state_machine.transition(
            current_status=current_status,
            target_status=target_status,
            order_id=order_id,
        )

    def _persist_status_update(
        self,
        work_order: Any,
        new_status: Any,
    ) -> int:
        """Update the work order status and increment the version.

        Args:
            work_order:   The work order entity.
            new_status:   The new status to set.

        Returns:
            The new version number after the update.
        """
        work_order.status = new_status
        current_version = getattr(work_order, "version", 0) or 0
        work_order.version = current_version + 1
        self._work_order_repo.update(work_order)
        return work_order.version

    def _persist_record(
        self,
        order_id: int,
        operator_id: int,
        action: ApprovalAction,
        approval_level: Optional[ApprovalLevel] = None,
        comment: Optional[str] = None,
    ) -> ApprovalRecordDTO:
        """Create and persist an approval record.

        Args:
            order_id:        Work order ID.
            operator_id:     Operator user ID.
            action:          The action taken.
            approval_level:  Approval level (if applicable).
            comment:         Optional comment / rejection reason.

        Returns:
            The created ``ApprovalRecordDTO``.
        """
        record = ApprovalRecordDTO(
            order_id=order_id,
            operator_id=operator_id,
            action=action.value,
            comment=comment,
            approval_level=(
                approval_level.value if approval_level else None
            ),
            created_at=datetime.datetime.now(datetime.timezone.utc),
        )
        self._approval_record_repo.create(record)
        return record

    def _status_value(self, status: Any) -> str:
        """Safely convert a status to its string value.

        Handles both enum members and plain strings.

        Args:
            status:  A status enum member or string.

        Returns:
            String representation of the status.
        """
        if status is None:
            return "None"
        if isinstance(status, str):
            return status
        return getattr(status, "value", str(status))

    # ------------------------------------------------------------------
    # Fallback enum factory (for environments without the real enum)
    # ------------------------------------------------------------------

    @staticmethod
    def _make_fallback_status_enum():
        """Create a minimal ``WorkOrderStatus`` enum for import safety.

        This fallback is only used when the real enum module is not
        available (e.g., in isolated unit tests or static analysis).

        Returns:
            A dynamically-created enum class with the required members.
        """
        from enum import Enum as _Enum

        class _FallbackStatus(_Enum):
            PENDING = "PENDING"
            APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
            APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
            APPROVED = "APPROVED"
            REJECTED = "REJECTED"
            CANCELLED = "CANCELLED"

        _FallbackStatus.__name__ = "WorkOrderStatus"
        _FallbackStatus.__qualname__ = "WorkOrderStatus"
        return _FallbackStatus