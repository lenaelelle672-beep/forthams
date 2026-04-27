"""Reject Work Order Command.

Implements the rejection workflow for work orders within the multi-level
approval system.  This command:

* Validates that ``rejection_reason`` is a non-empty string (max 500 chars).
* Delegates state-transition validation to the domain state machine.
* Applies optimistic locking via the ``version`` field to prevent
  concurrent approval conflicts.
* Persists an approval record capturing the operator, action, timestamp,
  and rejection reason.

Boundary constraints enforced:
- HTTP 400 when ``rejection_reason`` is missing or exceeds 500 characters.
- HTTP 409 when the state machine rejects the transition (e.g. trying to
  reject a work order already in ``REJECTED`` or ``APPROVED`` state).
- HTTP 409 when optimistic lock fails (version mismatch).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from src.core.exceptions import (
    ConflictError,
    InvalidStateTransitionError,
    ValidationError,
)
from src.domain.enums.workorder_status import WorkOrderStatus
from src.domain.exceptions.workorder_exceptions import (
    WorkOrderNotFoundError,
    WorkOrderStateTransitionError,
)
from src.models.approval_record import ApprovalRecord
from src.models.workorder import WorkOrder

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REJECTION_REASON_MAX_LENGTH: int = 500

# States from which a REJECT event is legally allowed.
_REJECTABLE_STATES: frozenset[WorkOrderStatus] = frozenset(
    {
        WorkOrderStatus.PENDING,
        WorkOrderStatus.APPROVING_LEVEL_1,
        WorkOrderStatus.APPROVING_LEVEL_2,
    }
)


# ---------------------------------------------------------------------------
# Command DTO
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RejectWorkOrderCommand:
    """Immutable value-object representing a reject-work-order request.

    Attributes:
        order_id: Primary key of the work order to reject.
        operator_id: ID of the user performing the rejection.
        rejection_reason: Mandatory human-readable reason (1–500 chars).
        expected_version: Optimistic-lock version the caller expects.
    """

    order_id: int
    operator_id: int
    rejection_reason: str
    expected_version: int


# ---------------------------------------------------------------------------
# Result DTO
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RejectWorkOrderResult:
    """Outcome of a successful rejection.

    Attributes:
        order_id: The rejected work order's ID.
        new_status: The status after rejection (always ``REJECTED``).
        current_version: The work order version after update.
        rejected_at: ISO-8601 timestamp of when the rejection occurred.
        approval_record_id: PK of the persisted approval record.
    """

    order_id: int
    new_status: WorkOrderStatus
    current_version: int
    rejected_at: str
    approval_record_id: int


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

class RejectWorkOrderHandler:
    """Application-layer command handler for rejecting a work order.

    Coordinates validation, state-machine transition, optimistic-lock
    enforcement, and approval-record persistence inside a single
    transactional boundary.

    Usage::

        handler = RejectWorkOrderHandler(uow=unit_of_work)
        result  = handler.handle(command)
    """

    def __init__(self, uow) -> None:
        """Initialise the handler with a Unit-of-Work abstraction.

        Args:
            uow: A unit-of-work object that provides access to
                 ``work_orders`` and ``approval_records`` repositories
                 and supports ``commit()`` / ``rollback()``.
        """
        self._uow = uow

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def handle(self, command: RejectWorkOrderCommand) -> RejectWorkOrderResult:
        """Execute the reject-work-order command.

        Args:
            command: The validated command DTO.

        Returns:
            A ``RejectWorkOrderResult`` describing the outcome.

        Raises:
            ValidationError: If ``rejection_reason`` is blank or too long.
            WorkOrderNotFoundError: If no work order exists for ``order_id``.
            ConflictError: On optimistic-lock version mismatch.
            InvalidStateTransitionError: If the current status does not
                permit rejection.
        """
        self._validate_rejection_reason(command.rejection_reason)

        with self._uow:
            work_order = self._load_work_order(command.order_id)
            self._check_optimistic_lock(work_order, command.expected_version)
            self._validate_transition(work_order.status)

            # Perform the state transition
            previous_status = work_order.status
            work_order.status = WorkOrderStatus.REJECTED
            work_order.rejection_reason = command.rejection_reason
            work_order.updated_at = datetime.now(timezone.utc)
            work_order.version += 1  # bump for optimistic lock

            # Persist approval record
            approval_record = self._create_approval_record(
                work_order=work_order,
                command=command,
                previous_status=previous_status,
            )

            self._uow.commit()

            logger.info(
                "Work order %d rejected by operator %d. "
                "Previous status: %s → REJECTED. Version: %d",
                command.order_id,
                command.operator_id,
                previous_status.value,
                work_order.version,
            )

            return RejectWorkOrderResult(
                order_id=work_order.id,
                new_status=work_order.status,
                current_version=work_order.version,
                rejected_at=approval_record.created_at.isoformat(),
                approval_record_id=approval_record.id,
            )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_rejection_reason(reason: str) -> None:
        """Ensure the rejection reason is non-empty and within length limits.

        Args:
            reason: The rejection reason string to validate.

        Raises:
            ValidationError: If the reason is empty/whitespace-only or
                exceeds ``REJECTION_REASON_MAX_LENGTH`` characters.
        """
        if not reason or not reason.strip():
            raise ValidationError(
                code="REJECTION_REASON_REQUIRED",
                message=(
                    "rejection_reason is required and must be a non-empty "
                    "string."
                ),
            )

        stripped = reason.strip()
        if len(stripped) > REJECTION_REASON_MAX_LENGTH:
            raise ValidationError(
                code="REJECTION_REASON_TOO_LONG",
                message=(
                    f"rejection_reason must not exceed "
                    f"{REJECTION_REASON_MAX_LENGTH} characters "
                    f"(got {len(stripped)})."
                ),
            )

    def _load_work_order(self, order_id: int) -> WorkOrder:
        """Fetch the work order by primary key.

        Args:
            order_id: The work order ID.

        Returns:
            The ``WorkOrder`` entity.

        Raises:
            WorkOrderNotFoundError: If no matching record is found.
        """
        work_order = self._uow.work_orders.get_by_id(order_id)
        if work_order is None:
            raise WorkOrderNotFoundError(
                order_id=order_id,
                message=f"Work order with id={order_id} not found.",
            )
        return work_order

    @staticmethod
    def _check_optimistic_lock(
        work_order: WorkOrder,
        expected_version: int,
    ) -> None:
        """Verify the caller's expected version matches the persisted version.

        Args:
            work_order: The current persisted work order entity.
            expected_version: The version the caller expects.

        Raises:
            ConflictError: If versions do not match, indicating a
                concurrent modification.
        """
        if work_order.version != expected_version:
            raise ConflictError(
                code="OPTIMISTIC_LOCK_CONFLICT",
                message=(
                    f"Work order version mismatch: expected "
                    f"{expected_version}, actual {work_order.version}. "
                    f"The work order may have been modified by another "
                    f"concurrent request."
                ),
            )

    @staticmethod
    def _validate_transition(current_status: WorkOrderStatus) -> None:
        """Check whether the work order's current status allows rejection.

        Args:
            current_status: The work order's present status.

        Raises:
            InvalidStateTransitionError: If the status is not in the set
                of rejectable states.
        """
        if current_status not in _REJECTABLE_STATES:
            raise InvalidStateTransitionError(
                code="INVALID_STATE_TRANSITION",
                message=(
                    f"Cannot reject work order in status "
                    f"'{current_status.value}'. Rejection is only allowed "
                    f"from: {', '.join(s.value for s in sorted(_REJECTABLE_STATES))}."
                ),
            )

    @staticmethod
    def _create_approval_record(
        work_order: WorkOrder,
        command: RejectWorkOrderCommand,
        previous_status: WorkOrderStatus,
    ) -> ApprovalRecord:
        """Build an ``ApprovalRecord`` entity for the rejection action.

        Args:
            work_order: The updated work order entity.
            command: The original command (provides operator & reason).
            previous_status: Status before the transition.

        Returns:
            A new ``ApprovalRecord`` ready for persistence.
        """
        now = datetime.now(timezone.utc)
        return ApprovalRecord(
            order_id=work_order.id,
            operator_id=command.operator_id,
            action="REJECT",
            previous_status=previous_status.value,
            new_status=WorkOrderStatus.REJECTED.value,
            comment=command.rejection_reason.strip(),
            created_at=now,
        )