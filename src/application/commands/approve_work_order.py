"""Approve Work Order Command.

Implements the multi-level approval command for work orders, enforcing:
- State machine validation (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
- Role-based access control (department manager for level 1, asset manager for level 2)
- Optimistic locking via ``version`` field to prevent concurrent approval conflicts
- Approval record persistence for audit trail

Phase 1 — Core approval flow & basic workbench.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from src.core.exceptions import (
    ConflictError,
    InvalidStateTransitionError,
    PermissionDeniedError,
    WorkOrderNotFoundError,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WorkOrderStatus(str, Enum):
    """All possible states for a work order."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Actions recorded in the approval history."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


class UserRole(str, Enum):
    """Roles relevant to the approval workflow."""

    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
    ASSET_MANAGER = "ASSET_MANAGER"


# ---------------------------------------------------------------------------
# State Machine — valid transitions
# ---------------------------------------------------------------------------

# Mapping: (current_status, event) → next_status
_VALID_TRANSITIONS: dict[tuple[WorkOrderStatus, str], WorkOrderStatus] = {
    (WorkOrderStatus.PENDING, "SUBMIT"): WorkOrderStatus.APPROVING_LEVEL_1,
    (WorkOrderStatus.APPROVING_LEVEL_1, "APPROVE"): WorkOrderStatus.APPROVING_LEVEL_2,
    (WorkOrderStatus.APPROVING_LEVEL_2, "APPROVE"): WorkOrderStatus.APPROVED,
    (WorkOrderStatus.APPROVING_LEVEL_1, "REJECT"): WorkOrderStatus.REJECTED,
    (WorkOrderStatus.APPROVING_LEVEL_2, "REJECT"): WorkOrderStatus.REJECTED,
    (WorkOrderStatus.PENDING, "CANCEL"): WorkOrderStatus.CANCELLED,
    (WorkOrderStatus.APPROVING_LEVEL_1, "CANCEL"): WorkOrderStatus.CANCELLED,
}

# Mapping: approval level → required role
_LEVEL_ROLE_MAP: dict[WorkOrderStatus, UserRole] = {
    WorkOrderStatus.APPROVING_LEVEL_1: UserRole.DEPARTMENT_MANAGER,
    WorkOrderStatus.APPROVING_LEVEL_2: UserRole.ASSET_MANAGER,
}


# ---------------------------------------------------------------------------
# Command DTO
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ApproveWorkOrderCommand:
    """Immutable command payload for approving a work order.

    Attributes:
        order_id: Unique identifier of the work order to approve.
        operator_id: ID of the user performing the approval action.
        operator_role: Role of the operator (must match the expected level).
        version: Expected current version of the work order (optimistic lock).
    """

    order_id: str
    operator_id: str
    operator_role: str
    version: int


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

@dataclass
class ApproveWorkOrderResult:
    """Result returned after a successful approval.

    Attributes:
        order_id: The work order identifier.
        new_status: The status after the transition.
        new_version: Incremented version number.
        approved_at: ISO-8601 timestamp of the approval.
        approval_level: Which approval level was just completed (1 or 2).
    """

    order_id: str
    new_status: str
    new_version: int
    approved_at: str
    approval_level: int


# ---------------------------------------------------------------------------
# Approval Record (persistence model)
# ---------------------------------------------------------------------------

@dataclass
class ApprovalRecord:
    """A single approval / rejection record persisted to ``approval_records``.

    Attributes:
        id: Auto-generated record identifier.
        order_id: FK to the work order.
        operator_id: Who performed the action.
        action: ``APPROVE`` or ``REJECT``.
        comment: Optional comment / rejection reason.
        created_at: ISO-8601 timestamp.
    """

    order_id: str
    operator_id: str
    action: str
    comment: Optional[str] = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
    )
    id: Optional[int] = None


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

class ApproveWorkOrderHandler:
    """Application-layer command handler for work order approval.

    Coordinates state machine validation, role checks, optimistic locking,
    and approval record persistence within a single transactional boundary.

    Dependencies are injected via constructor to facilitate testing.
    """

    def __init__(
        self,
        work_order_repository: "WorkOrderRepository",  # type: ignore[name-defined]
        approval_record_repository: "ApprovalRecordRepository",  # type: ignore[name-defined]
    ) -> None:
        """Initialise the handler with required repository abstractions.

        Args:
            work_order_repository: Repository for reading/writing work orders.
            approval_record_repository: Repository for persisting approval records.
        """
        self._work_order_repo = work_order_repository
        self._approval_record_repo = approval_record_repository

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def handle(self, command: ApproveWorkOrderCommand) -> ApproveWorkOrderResult:
        """Execute the approval command.

        Steps:
            1. Load the work order (or raise ``WorkOrderNotFoundError``).
            2. Verify optimistic lock (``version`` match).
            3. Validate operator role against the current approval level.
            4. Execute state machine transition (or raise
               ``InvalidStateTransitionError``).
            5. Persist the updated work order with incremented version.
            6. Insert an ``ApprovalRecord`` for audit trail.
            7. Return the ``ApproveWorkOrderResult``.

        Args:
            command: The approval command payload.

        Returns:
            An ``ApproveWorkOrderResult`` describing the outcome.

        Raises:
            WorkOrderNotFoundError: If the work order does not exist.
            ConflictError: On version mismatch (concurrent modification).
            PermissionDeniedError: If the operator's role does not match
                the expected approval level.
            InvalidStateTransitionError: If the state machine rejects the
                transition.
        """
        # 1. Load work order
        work_order = self._work_order_repo.get_by_id(command.order_id)
        if work_order is None:
            logger.warning(
                "ApproveWorkOrder: work order %s not found", command.order_id,
            )
            raise WorkOrderNotFoundError(
                f"Work order with id '{command.order_id}' not found.",
            )

        current_status = WorkOrderStatus(work_order["status"])

        # 2. Optimistic lock check
        if work_order["version"] != command.version:
            logger.warning(
                "ApproveWorkOrder: version conflict for order %s "
                "(expected=%d, actual=%d)",
                command.order_id,
                command.version,
                work_order["version"],
            )
            raise ConflictError(
                f"Version conflict: expected {command.version}, "
                f"but current version is {work_order['version']}.",
                error_code="OPTIMISTIC_LOCK_CONFLICT",
            )

        # 3. Role validation — ensure the operator is authorised for this level
        self._validate_operator_role(current_status, command.operator_role)

        # 4. State machine transition
        new_status = self._execute_transition(current_status, "APPROVE")

        # 5. Determine approval level for the record
        approval_level = self._resolve_approval_level(current_status)

        # 6. Persist updated work order (version incremented)
        new_version = command.version + 1
        self._work_order_repo.update_status(
            order_id=command.order_id,
            new_status=new_status.value,
            new_version=new_version,
        )

        # 7. Persist approval record
        record = ApprovalRecord(
            order_id=command.order_id,
            operator_id=command.operator_id,
            action=ApprovalAction.APPROVE.value,
            comment=None,
        )
        self._approval_record_repo.insert(record)

        approved_at = datetime.now(timezone.utc).isoformat()

        logger.info(
            "ApproveWorkOrder: order %s transitioned %s → %s by operator %s "
            "(level %d, version %d)",
            command.order_id,
            current_status.value,
            new_status.value,
            command.operator_id,
            approval_level,
            new_version,
        )

        return ApproveWorkOrderResult(
            order_id=command.order_id,
            new_status=new_status.value,
            new_version=new_version,
            approved_at=approved_at,
            approval_level=approval_level,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_operator_role(
        current_status: WorkOrderStatus,
        operator_role: str,
    ) -> None:
        """Ensure the operator's role matches the expected approval level.

        Args:
            current_status: The work order's current status.
            operator_role: The role string of the operator.

        Raises:
            PermissionDeniedError: If the role does not match.
        """
        required_role = _LEVEL_ROLE_MAP.get(current_status)
        if required_role is None:
            raise InvalidStateTransitionError(
                f"Work order in status '{current_status.value}' is not "
                f"awaiting approval.",
                error_code="INVALID_STATE_TRANSITION",
            )

        try:
            operator_enum = UserRole(operator_role)
        except ValueError:
            raise PermissionDeniedError(
                f"Unknown operator role '{operator_role}'.",
                error_code="INVALID_ROLE",
            )

        if operator_enum != required_role:
            logger.warning(
                "ApproveWorkOrder: role mismatch — operator has '%s' "
                "but '%s' is required for status '%s'.",
                operator_role,
                required_role.value,
                current_status.value,
            )
            raise PermissionDeniedError(
                f"Operator with role '{operator_role}' is not authorised to "
                f"approve work orders in status '{current_status.value}'. "
                f"Required role: '{required_role.value}'.",
                error_code="ROLE_MISMATCH",
            )

    @staticmethod
    def _execute_transition(
        current_status: WorkOrderStatus,
        event: str,
    ) -> WorkOrderStatus:
        """Execute a state machine transition.

        Args:
            current_status: The current state of the work order.
            event: The event to trigger (e.g. ``"APPROVE"``).

        Returns:
            The new status after the transition.

        Raises:
            InvalidStateTransitionError: If the transition is not allowed.
        """
        key = (current_status, event)
        new_status = _VALID_TRANSITIONS.get(key)
        if new_status is None:
            raise InvalidStateTransitionError(
                f"Transition from '{current_status.value}' via event "
                f"'{event}' is not allowed.",
                error_code="INVALID_STATE_TRANSITION",
            )
        return new_status

    @staticmethod
    def _resolve_approval_level(current_status: WorkOrderStatus) -> int:
        """Map the current approval status to a human-readable level number.

        Args:
            current_status: The status being approved from.

        Returns:
            1 for ``APPROVING_LEVEL_1``, 2 for ``APPROVING_LEVEL_2``.
        """
        level_map = {
            WorkOrderStatus.APPROVING_LEVEL_1: 1,
            WorkOrderStatus.APPROVING_LEVEL_2: 2,
        }
        return level_map[current_status]