"""
Work Order Service — multi-level approval workflow.

Implements the core approval chain for work orders:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

Supports rejection from any approval node to REJECTED, and CANCELLED state.
Uses optimistic locking (version field) to prevent concurrent approval conflicts.
Persists every approval action as an ApprovalRecord for audit trail.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from backend.models.workorder import WorkOrder
from backend.models.approval_history import ApprovalRecord
from backend.state_machine.workorder_state_machine import WorkOrderStateMachine
from backend.state_machine.workorder_state import WorkOrderState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Business error codes consumed by the API layer
# ---------------------------------------------------------------------------

class WorkOrderErrorCode(str, Enum):
    """Enumeration of business-level error codes for work-order operations."""

    ORDER_NOT_FOUND = "ORDER_NOT_FOUND"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    OPTIMISTIC_LOCK_CONFLICT = "OPTIMISTIC_LOCK_CONFLICT"
    REJECTION_REASON_REQUIRED = "REJECTION_REASON_REQUIRED"
    REJECTION_REASON_TOO_LONG = "REJECTION_REASON_TOO_LONG"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    MISSING_APPROVER_CREDENTIALS = "MISSING_APPROVER_CREDENTIALS"


class WorkOrderServiceError(Exception):
    """Raised when a work-order business rule is violated.

    Attributes:
        code: Machine-readable business error code (member of
              :class:`WorkOrderErrorCode`).
        status_code: Suggested HTTP status code for the API response.
        message: Human-readable description.
    """

    def __init__(
        self,
        code: WorkOrderErrorCode,
        status_code: int = 400,
        message: str = "",
    ) -> None:
        self.code = code
        self.status_code = status_code
        self.message = message or code.value
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Role constants (mirrors the authorisation layer)
# ---------------------------------------------------------------------------

class ApproverRole(str, Enum):
    """Roles that participate in the approval chain."""

    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
    ASSET_MANAGER = "ASSET_MANAGER"


# Mapping: approval level → role that is allowed to act
_LEVEL_ROLE_MAP: dict[WorkOrderState, ApproverRole] = {
    WorkOrderState.APPROVING_LEVEL_1: ApproverRole.DEPARTMENT_MANAGER,
    WorkOrderState.APPROVING_LEVEL_2: ApproverRole.ASSET_MANAGER,
}


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class WorkOrderService:
    """Application service that orchestrates work-order approval operations.

    Responsibilities:
    * Validate state-machine transitions (no skipping levels).
    * Enforce optimistic locking via the ``version`` column.
    * Persist :class:`ApprovalRecord` entries for every action.
    * Enforce role-based visibility / action authorisation.
    """

    # Maximum length for rejection reasons (matches DB column & spec)
    MAX_REJECTION_REASON_LENGTH = 500

    def __init__(
        self,
        session: Any = None,
        work_order_repository: Any = None,
        approval_record_repository: Any = None,
    ) -> None:
        """Initialise the service with data-access dependencies.

        Args:
            session: Database session / unit-of-work (used for transactional
                     commit when not managed externally).
            work_order_repository: Repository capable of CRUD on
                :class:`WorkOrder` entities.  Must expose ``get_by_id``,
                ``update`` methods.
            approval_record_repository: Repository capable of creating
                :class:`ApprovalRecord` entities.  Must expose ``create``.
        """
        self._session = session
        self._order_repo = work_order_repository
        self._record_repo = approval_record_repository

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def approve(
        self,
        order_id: Any,
        operator_id: Any,
        operator_role: str,
        current_version: int,
    ) -> WorkOrder:
        """Advance a work order to the next approval level.

        Args:
            order_id: Primary key of the target work order.
            operator_id: ID of the user performing the approval.
            operator_role: Role string of the operator (must match the
                expected role for the current approval level).
            current_version: Expected ``version`` value for optimistic locking.

        Returns:
            The updated :class:`WorkOrder` instance.

        Raises:
            WorkOrderServiceError: On any business-rule violation.
        """
        order = self._get_order_or_raise(order_id)

        # --- optimistic lock check ---
        self._check_version(order, current_version)

        # --- role authorisation ---
        self._check_role_authorised(order.status, operator_role)

        # --- state machine transition ---
        new_status = self._execute_transition(order, "APPROVE")

        # --- persist ---
        order.status = new_status
        order.version += 1
        self._order_repo.update(order)

        self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            action="APPROVE",
            comment=None,
        )

        logger.info(
            "Work order %s approved by operator %s, new status=%s",
            order_id,
            operator_id,
            new_status,
        )
        return order

    def reject(
        self,
        order_id: Any,
        operator_id: Any,
        operator_role: str,
        current_version: int,
        rejection_reason: Optional[str],
    ) -> WorkOrder:
        """Reject a work order at the current approval level.

        Args:
            order_id: Primary key of the target work order.
            operator_id: ID of the user performing the rejection.
            operator_role: Role string of the operator.
            current_version: Expected ``version`` value for optimistic locking.
            rejection_reason: Mandatory reason string (max 500 chars).

        Returns:
            The updated :class:`WorkOrder` instance.

        Raises:
            WorkOrderServiceError: If ``rejection_reason`` is missing / too
                long, or any other business-rule violation.
        """
        # --- validate rejection reason ---
        self._validate_rejection_reason(rejection_reason)

        order = self._get_order_or_raise(order_id)

        # --- optimistic lock check ---
        self._check_version(order, current_version)

        # --- role authorisation ---
        self._check_role_authorised(order.status, operator_role)

        # --- state machine transition ---
        new_status = self._execute_transition(order, "REJECT")

        # --- persist ---
        order.status = new_status
        order.version += 1
        order.rejection_reason = rejection_reason
        self._order_repo.update(order)

        self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            action="REJECT",
            comment=rejection_reason,
        )

        logger.info(
            "Work order %s rejected by operator %s, reason=%s",
            order_id,
            operator_id,
            rejection_reason,
        )
        return order

    def cancel(
        self,
        order_id: Any,
        operator_id: Any,
        current_version: int,
    ) -> WorkOrder:
        """Cancel a work order.

        Cancellation is allowed from PENDING, APPROVING_LEVEL_1, and
        APPROVING_LEVEL_2 states.

        Args:
            order_id: Primary key of the target work order.
            operator_id: ID of the user performing the cancellation.
            current_version: Expected ``version`` value for optimistic locking.

        Returns:
            The updated :class:`WorkOrder` instance.

        Raises:
            WorkOrderServiceError: On any business-rule violation.
        """
        order = self._get_order_or_raise(order_id)
        self._check_version(order, current_version)

        new_status = self._execute_transition(order, "CANCEL")

        order.status = new_status
        order.version += 1
        self._order_repo.update(order)

        self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            action="CANCEL",
            comment=None,
        )

        logger.info(
            "Work order %s cancelled by operator %s",
            order_id,
            operator_id,
        )
        return order

    def get_pending_orders_for_role(
        self,
        operator_role: str,
    ) -> list[WorkOrder]:
        """Return work orders that are awaiting action by the given role.

        Data isolation rules (per spec):
        * ``DEPARTMENT_MANAGER`` sees only ``APPROVING_LEVEL_1`` orders.
        * ``ASSET_MANAGER`` sees only ``APPROVING_LEVEL_2`` orders.

        Args:
            operator_role: The role of the caller.

        Returns:
            A list of :class:`WorkOrder` entities visible to the role.
        """
        target_status = self._role_to_pending_status(operator_role)
        if target_status is None:
            logger.warning(
                "Role %s has no pending approval queue; returning empty list.",
                operator_role,
            )
            return []
        return self._order_repo.list_by_status(target_status)

    def get_approval_history(self, order_id: Any) -> list[ApprovalRecord]:
        """Retrieve the full approval history for a work order.

        Args:
            order_id: Primary key of the work order.

        Returns:
            Chronologically ordered list of :class:`ApprovalRecord`.
        """
        self._get_order_or_raise(order_id)  # ensure existence
        return self._record_repo.list_by_order_id(order_id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_order_or_raise(self, order_id: Any) -> WorkOrder:
        """Fetch a work order by ID or raise a structured error.

        Args:
            order_id: Primary key of the work order.

        Returns:
            The :class:`WorkOrder` entity.

        Raises:
            WorkOrderServiceError: With code ``ORDER_NOT_FOUND`` (HTTP 404).
        """
        order = self._order_repo.get_by_id(order_id)
        if order is None:
            raise WorkOrderServiceError(
                code=WorkOrderErrorCode.ORDER_NOT_FOUND,
                status_code=404,
                message=f"Work order with id={order_id} not found.",
            )
        return order

    def _check_version(
        self,
        order: WorkOrder,
        expected_version: int,
    ) -> None:
        """Verify optimistic-lock version matches the current DB value.

        Args:
            order: The work order entity as read from the database.
            expected_version: The version supplied by the caller.

        Raises:
            WorkOrderServiceError: With code ``OPTIMISTIC_LOCK_CONFLICT``
                (HTTP 409) when versions differ.
        """
        if order.version != expected_version:
            raise WorkOrderServiceError(
                code=WorkOrderErrorCode.OPTIMISTIC_LOCK_CONFLICT,
                status_code=409,
                message=(
                    f"Optimistic lock conflict: expected version "
                    f"{expected_version}, actual {order.version}."
                ),
            )

    def _check_role_authorised(
        self,
        current_status: WorkOrderState,
        operator_role: str,
    ) -> None:
        """Ensure the operator's role matches the current approval level.

        Args:
            current_status: The work order's current state.
            operator_role: The role string of the acting user.

        Raises:
            WorkOrderServiceError: With code ``PERMISSION_DENIED`` (HTTP 403)
                when the role does not match the expected approver for the
                current level.
        """
        expected_role = _LEVEL_ROLE_MAP.get(current_status)
        if expected_role is None:
            # Not in an approval-pending state; let the state machine handle it.
            return
        if operator_role != expected_role.value:
            raise WorkOrderServiceError(
                code=WorkOrderErrorCode.PERMISSION_DENIED,
                status_code=403,
                message=(
                    f"Role '{operator_role}' is not authorised to act on "
                    f"orders in state '{current_status.value}'. "
                    f"Expected role: '{expected_role.value}'."
                ),
            )

    def _execute_transition(
        self,
        order: WorkOrder,
        event: str,
    ) -> WorkOrderState:
        """Run the state machine for the given event and return the new state.

        Args:
            order: The work order whose current state drives the machine.
            event: The event name (``"APPROVE"``, ``"REJECT"``, ``"CANCEL"``).

        Returns:
            The new :class:`WorkOrderState` after a successful transition.

        Raises:
            WorkOrderServiceError: With code ``INVALID_STATE_TRANSITION``
                (HTTP 409) when the transition is illegal.
        """
        sm = WorkOrderStateMachine(initial_state=order.status)
        try:
            sm.trigger(event)
        except Exception as exc:
            raise WorkOrderServiceError(
                code=WorkOrderErrorCode.INVALID_STATE_TRANSITION,
                status_code=409,
                message=(
                    f"Cannot {event} work order {order.id} in state "
                    f"'{order.status.value}': {exc}"
                ),
            ) from exc
        return sm.get_current_state()

    def _validate_rejection_reason(
        self,
        rejection_reason: Optional[str],
    ) -> None:
        """Validate that the rejection reason is present and within limits.

        Args:
            rejection_reason: The reason string provided by the caller.

        Raises:
            WorkOrderServiceError: With code ``REJECTION_REASON_REQUIRED``
                (HTTP 400) when the reason is missing/empty, or
                ``REJECTION_REASON_TOO_LONG`` (HTTP 400) when it exceeds the
                maximum allowed length.
        """
        if not rejection_reason or not rejection_reason.strip():
            raise WorkOrderServiceError(
                code=WorkOrderErrorCode.REJECTION_REASON_REQUIRED,
                status_code=400,
                message=(
                    "rejectionReason is required and must be a non-empty "
                    "string when rejecting a work order."
                ),
            )
        if len(rejection_reason) > self.MAX_REJECTION_REASON_LENGTH:
            raise WorkOrderServiceError(
                code=WorkOrderErrorCode.REJECTION_REASON_TOO_LONG,
                status_code=400,
                message=(
                    f"rejectionReason must not exceed "
                    f"{self.MAX_REJECTION_REASON_LENGTH} characters "
                    f"(got {len(rejection_reason)})."
                ),
            )

    def _persist_record(
        self,
        order_id: Any,
        operator_id: Any,
        action: str,
        comment: Optional[str],
    ) -> ApprovalRecord:
        """Create and persist an :class:`ApprovalRecord` entry.

        Args:
            order_id: FK to the work order.
            operator_id: FK to the user who performed the action.
            action: One of ``"APPROVE"``, ``"REJECT"``, ``"CANCEL"``.
            comment: Optional free-text (used for rejection reasons).

        Returns:
            The newly created :class:`ApprovalRecord`.
        """
        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=action,
            comment=comment,
            created_at=datetime.now(timezone.utc),
        )
        self._record_repo.create(record)
        return record

    @staticmethod
    def _role_to_pending_status(
        operator_role: str,
    ) -> Optional[WorkOrderState]:
        """Map an operator role to the work-order status they can approve.

        Args:
            operator_role: The role string.

        Returns:
            The corresponding :class:`WorkOrderState`, or ``None`` if the
            role has no approval queue.
        """
        reverse_map = {v.value: k for k, v in _LEVEL_ROLE_MAP.items()}
        return reverse_map.get(operator_role)