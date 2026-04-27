"""
Approval Engine — Multi-level approval workflow for work orders.

Implements a two-level approval state machine with strict transition rules:

    Forward flow:
        PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

    Reverse flow (from any approval node):
        APPROVING_LEVEL_1 → REJECTED
        APPROVING_LEVEL_2 → REJECTED

    Cancellation flow:
        PENDING → CANCELLED
        APPROVING_LEVEL_1 → CANCELLED
        APPROVING_LEVEL_2 → CANCELLED

Key features:
    - Strict state transition validation (no cross-level approval)
    - Optimistic locking via ``version`` field to prevent concurrent conflicts
    - Mandatory rejection reason (non-empty string, max 500 characters)
    - Approval record creation with full audit trail
    - Role-based data isolation for approval lists
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------


class ApprovalEngineError(Exception):
    """Base exception for all approval engine errors."""

    def __init__(self, message: str, code: str = "APPROVAL_ENGINE_ERROR") -> None:
        """Initialize the base approval engine error.

        Args:
            message: Human-readable error description.
            code: Machine-readable error code for API responses.
        """
        self.message = message
        self.code = code
        super().__init__(self.message)


class InvalidStateTransitionError(ApprovalEngineError):
    """Raised when a state transition is not permitted by the state machine.

    Maps to HTTP 409 Conflict with error code ``INVALID_STATE_TRANSITION``.
    """

    def __init__(
        self,
        order_id: str,
        current_state: str,
        target_state: str,
        reason: str = "",
    ) -> None:
        """Initialize the invalid state transition error.

        Args:
            order_id: The work order identifier.
            current_state: The current status value.
            target_state: The attempted target status value.
            reason: Detailed explanation of why the transition is invalid.
        """
        self.order_id = order_id
        self.current_state = current_state
        self.target_state = target_state
        self.reason = reason
        super().__init__(
            message=(
                f"Invalid state transition for order '{order_id}': "
                f"'{current_state}' → '{target_state}'. {reason}"
            ),
            code="INVALID_STATE_TRANSITION",
        )


class RejectionReasonRequiredError(ApprovalEngineError):
    """Raised when a rejection action is attempted without a valid reason.

    Maps to HTTP 400 Bad Request with error code ``REJECTION_REASON_REQUIRED``.
    """

    def __init__(self, order_id: str, reason: str = "") -> None:
        """Initialize the rejection reason required error.

        Args:
            order_id: The work order identifier.
            reason: Detailed explanation of the validation failure.
        """
        self.order_id = order_id
        super().__init__(
            message=(
                f"Rejection reason is required for order '{order_id}'. "
                f"{reason}"
            ),
            code="REJECTION_REASON_REQUIRED",
        )


class ConcurrentApprovalConflictError(ApprovalEngineError):
    """Raised when optimistic lock version mismatch is detected.

    Maps to HTTP 409 Conflict with error code ``CONCURRENT_APPROVAL_CONFLICT``.
    """

    def __init__(
        self,
        order_id: str,
        current_version: int,
        expected_version: int,
        reason: str = "",
    ) -> None:
        """Initialize the concurrent approval conflict error.

        Args:
            order_id: The work order identifier.
            current_version: The version currently stored in the database.
            expected_version: The version the client expected.
            reason: Additional context about the conflict.
        """
        self.order_id = order_id
        self.current_version = current_version
        self.expected_version = expected_version
        super().__init__(
            message=(
                f"Concurrent modification detected for order '{order_id}'. "
                f"Expected version {expected_version}, found {current_version}. "
                f"{reason}"
            ),
            code="CONCURRENT_APPROVAL_CONFLICT",
        )


class ApprovalPermissionDeniedError(ApprovalEngineError):
    """Raised when an operator's role is not authorized for the current state.

    Maps to HTTP 403 Forbidden with error code ``APPROVAL_PERMISSION_DENIED``.
    """

    def __init__(
        self,
        order_id: str,
        operator_role: str,
        required_role: str,
        reason: str = "",
    ) -> None:
        """Initialize the approval permission denied error.

        Args:
            order_id: The work order identifier.
            operator_role: The role of the operator attempting the action.
            required_role: The role required to perform the action.
            reason: Additional context about the permission failure.
        """
        self.order_id = order_id
        self.operator_role = operator_role
        self.required_role = required_role
        super().__init__(
            message=(
                f"Permission denied for order '{order_id}': "
                f"role '{operator_role}' cannot act; requires '{required_role}'. "
                f"{reason}"
            ),
            code="APPROVAL_PERMISSION_DENIED",
        )


# ---------------------------------------------------------------------------
# Domain Enumerations
# ---------------------------------------------------------------------------


class ApprovalAction(enum.Enum):
    """Enumeration of possible approval actions.

    Attributes:
        APPROVE: The operator approves the work order at the current level.
        REJECT: The operator rejects the work order (requires reason).
        CANCEL: The work order is cancelled by the initiator or system.
    """

    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class ApprovalLevel(enum.Enum):
    """Enumeration of approval authority levels.

    Attributes:
        LEVEL_1_DEPT_MANAGER: First-level approval by department manager.
        LEVEL_2_ASSET_MANAGER: Second-level approval by asset manager.
    """

    LEVEL_1_DEPT_MANAGER = "LEVEL_1_DEPT_MANAGER"
    LEVEL_2_ASSET_MANAGER = "LEVEL_2_ASSET_MANAGER"


class WorkOrderApprovalStatus(enum.Enum):
    """Enumeration of work order statuses in the approval lifecycle.

    Defines the complete state machine for multi-level approval:

    - **Forward flow**: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    - **Reverse flow**: Any approval node → REJECTED
    - **Cancellation**: PENDING or any approval node → CANCELLED

    Attributes:
        PENDING: Initial state after work order creation/submission.
        APPROVING_LEVEL_1: Awaiting department manager approval.
        APPROVING_LEVEL_2: Awaiting asset manager approval.
        APPROVED: Work order has passed all approval levels.
        REJECTED: Work order was rejected at some approval level.
        CANCELLED: Work order was cancelled by the initiator.
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# ---------------------------------------------------------------------------
# State Machine Configuration
# ---------------------------------------------------------------------------

# Mapping: {current_status: {event: next_status}}
# Only explicitly allowed transitions are listed; anything else is forbidden.
_VALID_TRANSITIONS: Dict[WorkOrderApprovalStatus, Dict[str, WorkOrderApprovalStatus]] = {
    WorkOrderApprovalStatus.PENDING: {
        "APPROVE": WorkOrderApprovalStatus.APPROVING_LEVEL_1,
        "CANCEL": WorkOrderApprovalStatus.CANCELLED,
    },
    WorkOrderApprovalStatus.APPROVING_LEVEL_1: {
        "APPROVE": WorkOrderApprovalStatus.APPROVING_LEVEL_2,
        "REJECT": WorkOrderApprovalStatus.REJECTED,
        "CANCEL": WorkOrderApprovalStatus.CANCELLED,
    },
    WorkOrderApprovalStatus.APPROVING_LEVEL_2: {
        "APPROVE": WorkOrderApprovalStatus.APPROVED,
        "REJECT": WorkOrderApprovalStatus.REJECTED,
        "CANCEL": WorkOrderApprovalStatus.CANCELLED,
    },
}

# Terminal states — no further transitions are permitted from these states.
_TERMINAL_STATES: set = {
    WorkOrderApprovalStatus.APPROVED,
    WorkOrderApprovalStatus.REJECTED,
    WorkOrderApprovalStatus.CANCELLED,
}

# Mapping: operator role → approval level the role is authorized for.
_ROLE_APPROVAL_LEVEL_MAP: Dict[str, ApprovalLevel] = {
    "DEPT_MANAGER": ApprovalLevel.LEVEL_1_DEPT_MANAGER,
    "ASSET_MANAGER": ApprovalLevel.LEVEL_2_ASSET_MANAGER,
}

# Mapping: approval state → the approval level required to act on that state.
_STATE_APPROVAL_LEVEL_MAP: Dict[WorkOrderApprovalStatus, ApprovalLevel] = {
    WorkOrderApprovalStatus.APPROVING_LEVEL_1: ApprovalLevel.LEVEL_1_DEPT_MANAGER,
    WorkOrderApprovalStatus.APPROVING_LEVEL_2: ApprovalLevel.LEVEL_2_ASSET_MANAGER,
}

# Maximum allowed length for rejection reasons.
_MAX_REJECTION_REASON_LENGTH = 500


# ---------------------------------------------------------------------------
# Approval Record (Value Object)
# ---------------------------------------------------------------------------


class ApprovalRecord:
    """Immutable value object representing a single approval action record.

    Captures the full audit trail for an approval action, including the
    operator identity, action type, timestamp, and optional comment
    (mandatory for rejections).

    Attributes:
        record_id: Unique identifier for this approval record.
        order_id: The work order this record belongs to.
        operator_id: The user who performed the action.
        action: The type of action (APPROVE, REJECT, CANCEL).
        comment: Optional comment; required when action is REJECT.
        created_at: ISO 8601 timestamp of when the action occurred.
    """

    def __init__(
        self,
        order_id: str,
        operator_id: str,
        action: ApprovalAction,
        comment: Optional[str] = None,
        record_id: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        """Initialize an ApprovalRecord.

        Args:
            order_id: The ID of the work order being acted upon.
            operator_id: The ID of the user performing the action.
            action: The approval action taken (APPROVE, REJECT, CANCEL).
            comment: Optional comment; required when action is REJECT.
            record_id: Unique record identifier; auto-generated if not provided.
            created_at: Timestamp of the action; defaults to UTC now.
        """
        self.record_id = record_id or str(uuid.uuid4())
        self.order_id = order_id
        self.operator_id = operator_id
        self.action = action
        self.comment = comment
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the approval record to a plain dictionary.

        Returns:
            A dictionary representation suitable for JSON serialization,
            with dates formatted as ISO 8601 strings.
        """
        return {
            "record_id": self.record_id,
            "order_id": self.order_id,
            "operator_id": self.operator_id,
            "action": self.action.value,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"ApprovalRecord(record_id={self.record_id!r}, "
            f"order_id={self.order_id!r}, operator_id={self.operator_id!r}, "
            f"action={self.action.value!r})"
        )


# ---------------------------------------------------------------------------
# Approval Engine (Core Service)
# ---------------------------------------------------------------------------


class ApprovalEngine:
    """Core approval engine implementing the multi-level approval state machine.

    This engine encapsulates all state transition logic for work order
    approvals, providing a single authoritative source for:

    - **State transition validation**: Ensures only legal transitions occur,
      preventing cross-level approval (e.g., PENDING → APPROVING_LEVEL_2).
    - **Role-based authorization**: Validates that the operator's role matches
      the approval level required for the current state.
    - **Rejection reason enforcement**: Requires a non-empty reason string
      (max 500 characters) for all rejection actions.
    - **Optimistic locking**: Detects concurrent modification conflicts via
      version field comparison.

    The engine is designed as a pure domain service with no external
    dependencies — it operates on value objects and returns result
    dictionaries. Persistence concerns are handled by the calling service layer.

    Usage example::

        engine = ApprovalEngine()

        # Approve a work order
        result = engine.approve(
            order_id="WO-2024-001",
            current_status=WorkOrderApprovalStatus.PENDING,
            operator_id="user-123",
            operator_role="DEPT_MANAGER",
            current_version=1,
            expected_version=1,
        )
        # result["new_status"] == WorkOrderApprovalStatus.APPROVING_LEVEL_1

        # Reject a work order
        result = engine.reject(
            order_id="WO-2024-001",
            current_status=WorkOrderApprovalStatus.APPROVING_LEVEL_1,
            operator_id="user-456",
            operator_role="DEPT_MANAGER",
            rejection_reason="Budget allocation not approved",
            current_version=2,
            expected_version=2,
        )
        # result["new_status"] == WorkOrderApprovalStatus.REJECTED
    """

    def __init__(self) -> None:
        """Initialize the ApprovalEngine with default transition rules."""
        self._transitions = _VALID_TRANSITIONS
        self._terminal_states = _TERMINAL_STATES

    # ------------------------------------------------------------------
    # State Transition Validation
    # ------------------------------------------------------------------

    def validate_transition(
        self,
        current_status: WorkOrderApprovalStatus,
        event: str,
    ) -> WorkOrderApprovalStatus:
        """Validate a state transition and return the target state.

        Checks whether the given event is permitted from the current state.
        Raises an exception if the transition is not allowed.

        Args:
            current_status: The current state of the work order.
            event: The event/action to trigger (``"APPROVE"``, ``"REJECT"``,
                or ``"CANCEL"``).

        Returns:
            The target ``WorkOrderApprovalStatus`` after the transition.

        Raises:
            InvalidStateTransitionError: If the current state is terminal,
                if no transitions are defined for the state, or if the
                specific event is not allowed from the current state.
        """
        if current_status in self._terminal_states:
            raise InvalidStateTransitionError(
                order_id="",
                current_state=current_status.value,
                target_state="",
                reason=(
                    f"Cannot perform '{event}' on terminal state "
                    f"'{current_status.value}'. Terminal states do not "
                    f"allow further transitions."
                ),
            )

        state_transitions = self._transitions.get(current_status)
        if state_transitions is None:
            raise InvalidStateTransitionError(
                order_id="",
                current_state=current_status.value,
                target_state="",
                reason=(
                    f"No transitions defined for state "
                    f"'{current_status.value}'."
                ),
            )

        target_state = state_transitions.get(event)
        if target_state is None:
            allowed = ", ".join(
                f"'{e}'" for e in sorted(state_transitions.keys())
            )
            raise InvalidStateTransitionError(
                order_id="",
                current_state=current_status.value,
                target_state="",
                reason=(
                    f"Transition '{event}' is not allowed from "
                    f"'{current_status.value}'. Allowed transitions: "
                    f"{allowed}."
                ),
            )

        return target_state

    # ------------------------------------------------------------------
    # Role Authorization
    # ------------------------------------------------------------------

    def validate_role_for_state(
        self,
        current_status: WorkOrderApprovalStatus,
        operator_role: str,
    ) -> None:
        """Validate that the operator's role is authorized for the current state.

        For ``PENDING`` state, no specific approval role is required (the
        system or initiator may trigger the initial transition). For
        ``APPROVING_LEVEL_1`` and ``APPROVING_LEVEL_2`` states, the operator
        must hold the corresponding role.

        Args:
            current_status: The current state of the work order.
            operator_role: The role of the operator attempting the action.

        Raises:
            ApprovalPermissionDeniedError: If the operator's role does not
                match the required approval level for the current state.
        """
        required_level = _STATE_APPROVAL_LEVEL_MAP.get(current_status)
        if required_level is None:
            # PENDING state doesn't require a specific approval role
            return

        operator_level = _ROLE_APPROVAL_LEVEL_MAP.get(operator_role)
        if operator_level is None or operator_level != required_level:
            raise ApprovalPermissionDeniedError(
                order_id="",
                operator_role=operator_role,
                required_role=required_level.value,
                reason=(
                    f"Role '{operator_role}' is not authorized to act on "
                    f"state '{current_status.value}'. Required role: "
                    f"'{required_level.value}'."
                ),
            )

    # ------------------------------------------------------------------
    # Rejection Reason Validation
    # ------------------------------------------------------------------

    def validate_rejection_reason(
        self,
        rejection_reason: Optional[str],
    ) -> None:
        """Validate that the rejection reason meets the business requirements.

        The rejection reason must be:
        - A non-empty string (after stripping whitespace)
        - At most 500 characters long

        Args:
            rejection_reason: The rejection reason to validate.

        Raises:
            RejectionReasonRequiredError: If the reason is ``None``, empty,
                whitespace-only, or exceeds the maximum length.
        """
        if rejection_reason is None or not rejection_reason.strip():
            raise RejectionReasonRequiredError(
                order_id="",
                reason=(
                    "Rejection reason is required and must be a non-empty "
                    "string."
                ),
            )

        if len(rejection_reason) > _MAX_REJECTION_REASON_LENGTH:
            raise RejectionReasonRequiredError(
                order_id="",
                reason=(
                    f"Rejection reason must not exceed "
                    f"{_MAX_REJECTION_REASON_LENGTH} characters "
                    f"(got {len(rejection_reason)})."
                ),
            )

    # ------------------------------------------------------------------
    # Optimistic Lock Validation
    # ------------------------------------------------------------------

    def validate_optimistic_lock(
        self,
        current_version: int,
        expected_version: int,
        order_id: str = "",
    ) -> None:
        """Validate optimistic lock to prevent concurrent approval conflicts.

        Compares the version currently stored in the database against the
        version the client expects. If they differ, it indicates that
        another transaction has modified the work order since the client
        last read it.

        Args:
            current_version: The version currently stored in the database.
            expected_version: The version the client expects (from the
                original read).
            order_id: The work order ID for error context.

        Raises:
            ConcurrentApprovalConflictError: If ``current_version`` does not
                match ``expected_version``.
        """
        if current_version != expected_version:
            raise ConcurrentApprovalConflictError(
                order_id=order_id,
                current_version=current_version,
                expected_version=expected_version,
                reason=(
                    f"Concurrent modification detected for order "
                    f"'{order_id}'. Expected version {expected_version}, "
                    f"but found {current_version}. Please refresh and retry."
                ),
            )

    # ------------------------------------------------------------------
    # Approval Actions
    # ------------------------------------------------------------------

    def approve(
        self,
        order_id: str,
        current_status: WorkOrderApprovalStatus,
        operator_id: str,
        operator_role: str,
        current_version: int,
        expected_version: int,
    ) -> Dict[str, Any]:
        """Process an approval action on a work order.

        Validates the optimistic lock, checks role authorization, and
        performs the state transition. Returns the new status, incremented
        version, and an approval record for persistence.

        Args:
            order_id: The ID of the work order.
            current_status: The current status of the work order.
            operator_id: The ID of the approving user.
            operator_role: The role of the approving user (e.g.,
                ``"DEPT_MANAGER"``, ``"ASSET_MANAGER"``).
            current_version: The current version in the database.
            expected_version: The version the client expects.

        Returns:
            A dictionary with the following keys:
            - ``new_status``: The ``WorkOrderApprovalStatus`` after approval.
            - ``new_version``: The incremented version number.
            - ``approval_record``: An ``ApprovalRecord`` for persistence.

        Raises:
            ConcurrentApprovalConflictError: On version mismatch.
            ApprovalPermissionDeniedError: If the role is not authorized.
            InvalidStateTransitionError: If the transition is not allowed.
        """
        self.validate_optimistic_lock(current_version, expected_version, order_id)
        self.validate_role_for_state(current_status, operator_role)
        new_status = self.validate_transition(current_status, "APPROVE")

        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
        )

        return {
            "new_status": new_status,
            "new_version": current_version + 1,
            "approval_record": record,
        }

    def reject(
        self,
        order_id: str,
        current_status: WorkOrderApprovalStatus,
        operator_id: str,
        operator_role: str,
        rejection_reason: str,
        current_version: int,
        expected_version: int,
    ) -> Dict[str, Any]:
        """Process a rejection action on a work order.

        Validates the optimistic lock, checks the rejection reason, verifies
        role authorization, and performs the state transition to ``REJECTED``.

        Args:
            order_id: The ID of the work order.
            current_status: The current status of the work order.
            operator_id: The ID of the rejecting user.
            operator_role: The role of the rejecting user.
            rejection_reason: The mandatory reason for rejection. Must be a
                non-empty string with a maximum of 500 characters.
            current_version: The current version in the database.
            expected_version: The version the client expects.

        Returns:
            A dictionary with the following keys:
            - ``new_status``: Always ``WorkOrderApprovalStatus.REJECTED``.
            - ``new_version``: The incremented version number.
            - ``approval_record``: An ``ApprovalRecord`` with the rejection
              reason stored in the ``comment`` field.

        Raises:
            ConcurrentApprovalConflictError: On version mismatch.
            RejectionReasonRequiredError: If the reason is missing or invalid.
            ApprovalPermissionDeniedError: If the role is not authorized.
            InvalidStateTransitionError: If the transition is not allowed.
        """
        self.validate_optimistic_lock(current_version, expected_version, order_id)
        self.validate_rejection_reason(rejection_reason)
        self.validate_role_for_state(current_status, operator_role)
        new_status = self.validate_transition(current_status, "REJECT")

        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            comment=rejection_reason.strip(),
        )

        return {
            "new_status": new_status,
            "new_version": current_version + 1,
            "approval_record": record,
        }

    def cancel(
        self,
        order_id: str,
        current_status: WorkOrderApprovalStatus,
        operator_id: str,
        current_version: int,
        expected_version: int,
    ) -> Dict[str, Any]:
        """Process a cancellation action on a work order.

        Validates the optimistic lock and performs the state transition to
        ``CANCELLED``. Cancellation does not require a specific approval
        role — it can be initiated by the work order creator or the system.

        Args:
            order_id: The ID of the work order.
            current_status: The current status of the work order.
            operator_id: The ID of the user cancelling the work order.
            current_version: The current version in the database.
            expected_version: The version the client expects.

        Returns:
            A dictionary with the following keys:
            - ``new_status``: Always ``WorkOrderApprovalStatus.CANCELLED``.
            - ``new_version``: The incremented version number.
            - ``approval_record``: An ``ApprovalRecord`` with action
              ``CANCEL``.

        Raises:
            ConcurrentApprovalConflictError: On version mismatch.
            InvalidStateTransitionError: If the current state does not
                support cancellation.
        """
        self.validate_optimistic_lock(current_version, expected_version, order_id)
        new_status = self.validate_transition(current_status, "CANCEL")

        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.CANCEL,
        )

        return {
            "new_status": new_status,
            "new_version": current_version + 1,
            "approval_record": record,
        }

    # ------------------------------------------------------------------
    # Query Helpers
    # ------------------------------------------------------------------

    def get_visible_statuses_for_role(
        self,
        operator_role: str,
    ) -> List[WorkOrderApprovalStatus]:
        """Return the list of work order statuses visible to a given role.

        Implements data isolation as required by the spec:
        - Department managers (``DEPT_MANAGER``) can only see orders in
          ``APPROVING_LEVEL_1`` state.
        - Asset managers (``ASSET_MANAGER``) can only see orders in
          ``APPROVING_LEVEL_2`` state.
        - Unknown roles see nothing.

        Args:
            operator_role: The role of the operator querying the list.

        Returns:
            A list of ``WorkOrderApprovalStatus`` values that the role is
            authorized to view. Empty list if the role has no approval
            visibility.
        """
        level = _ROLE_APPROVAL_LEVEL_MAP.get(operator_role)
        if level is None:
            return []

        visible_states = [
            status
            for status, lvl in _STATE_APPROVAL_LEVEL_MAP.items()
            if lvl == level
        ]
        return visible_states

    def get_available_transitions(
        self,
        current_status: WorkOrderApprovalStatus,
    ) -> Dict[str, str]:
        """Return all valid transitions from the current state.

        Useful for building dynamic UI action buttons — the frontend can
        query this to determine which actions (approve/reject/cancel) to
        display for a given work order.

        Args:
            current_status: The current state of the work order.

        Returns:
            A dictionary mapping event names (``"APPROVE"``, ``"REJECT"``,
            ``"CANCEL"``) to target state name strings. Empty dictionary
            if the state is terminal.
        """
        transitions = self._transitions.get(current_status, {})
        return {event: state.value for event, state in transitions.items()}

    def is_terminal_state(
        self,
        status: WorkOrderApprovalStatus,
    ) -> bool:
        """Check whether the given status is a terminal (final) state.

        Terminal states are ``APPROVED``, ``REJECTED``, and ``CANCELLED``.
        No further transitions are possible from terminal states.

        Args:
            status: The status to check.

        Returns:
            ``True`` if the status is terminal, ``False`` otherwise.
        """
        return status in self._terminal_states