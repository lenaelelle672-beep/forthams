"""
Work Order Domain Models
========================

Defines the core domain models for the work order approval flow,
including the approval status enum, approval action enum, the WorkOrder
entity, and related exception classes.

Approval Chain:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Any approval node → REJECTED (terminal)
    PENDING → CANCELLED (terminal)
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ApprovalStatus(enum.Enum):
    """All possible statuses in the work order approval lifecycle.

    The state machine enforces strict forward-only transitions along the
    approval chain.  REJECTED and CANCELLED are terminal states.
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

    # -- helpers ----------------------------------------------------------

    @property
    def is_terminal(self) -> bool:
        """Return True if this status is a terminal (final) state."""
        return self in (ApprovalStatus.APPROVED, ApprovalStatus.REJECTED,
                        ApprovalStatus.CANCELLED)

    @property
    def is_approval_node(self) -> bool:
        """Return True if this status represents an active approval node."""
        return self in (ApprovalStatus.APPROVING_LEVEL_1,
                        ApprovalStatus.APPROVING_LEVEL_2)


class ApprovalAction(enum.Enum):
    """Actions that can be performed on a work order."""

    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidStateTransitionError(Exception):
    """Raised when a state transition is not allowed by the state machine.

    Attributes:
        current_status: The current status of the work order.
        action: The action that was attempted.
        message: Human-readable description of the error.
    """

    def __init__(
        self,
        current_status: ApprovalStatus,
        action: ApprovalAction,
        message: str = "",
    ) -> None:
        self.current_status = current_status
        self.action = action
        default_msg = (
            f"Cannot perform '{action.value}' from status "
            f"'{current_status.value}'."
        )
        super().__init__(message or default_msg)


class RejectionReasonRequiredError(ValueError):
    """Raised when a rejection is attempted without a valid reason.

    The rejection reason must be non-empty and at least 10 characters long.
    """

    def __init__(
        self,
        message: str = "Rejection reason is required and must be at least 10 characters.",
    ) -> None:
        super().__init__(message)


# ---------------------------------------------------------------------------
# Transition Map (canonical source of truth)
# ---------------------------------------------------------------------------

# Maps (current_status, action) → next_status.
# Any combination not present in this map is an illegal transition.
_TRANSITION_MAP: dict[tuple[ApprovalStatus, ApprovalAction], ApprovalStatus] = {
    # Submit: PENDING → APPROVING_LEVEL_1
    (ApprovalStatus.PENDING, ApprovalAction.SUBMIT): ApprovalStatus.APPROVING_LEVEL_1,
    # L1 Approve: APPROVING_LEVEL_1 → APPROVING_LEVEL_2
    (ApprovalStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE): ApprovalStatus.APPROVING_LEVEL_2,
    # L2 Approve: APPROVING_LEVEL_2 → APPROVED
    (ApprovalStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE): ApprovalStatus.APPROVED,
    # Reject from any approval node → REJECTED
    (ApprovalStatus.APPROVING_LEVEL_1, ApprovalAction.REJECT): ApprovalStatus.REJECTED,
    (ApprovalStatus.APPROVING_LEVEL_2, ApprovalAction.REJECT): ApprovalStatus.REJECTED,
    # Cancel from PENDING → CANCELLED
    (ApprovalStatus.PENDING, ApprovalAction.CANCEL): ApprovalStatus.CANCELLED,
}


def get_next_status(
    current: ApprovalStatus,
    action: ApprovalAction,
) -> ApprovalStatus:
    """Return the target status for a given (current, action) pair.

    Args:
        current: The current approval status.
        action: The action being performed.

    Returns:
        The resulting ApprovalStatus after the transition.

    Raises:
        InvalidStateTransitionError: If the transition is not allowed.
    """
    key = (current, action)
    if key not in _TRANSITION_MAP:
        raise InvalidStateTransitionError(current, action)
    return _TRANSITION_MAP[key]


# ---------------------------------------------------------------------------
# Approval Record (immutable once created)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ApprovalRecord:
    """An immutable record of a single approval action.

    Once persisted, approval records must not be modified or deleted
    (append-only audit trail).

    Attributes:
        id: Unique identifier for this record.
        work_order_id: The work order this record belongs to.
        approver_id: ID of the user who performed the action.
        action: The action taken (APPROVE or REJECT).
        reason: Optional reason / comment (required for REJECT).
        approval_level: Which approval level this record corresponds to
            (1 for department manager, 2 for asset manager).
        created_at: Timestamp when the action was performed.
    """

    id: str
    work_order_id: str
    approver_id: str
    action: ApprovalAction
    reason: Optional[str] = None
    approval_level: int = 1
    created_at: datetime = field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Work Order Entity
# ---------------------------------------------------------------------------

@dataclass
class WorkOrder:
    """Core work order entity with approval lifecycle support.

    Attributes:
        id: Unique business identifier (e.g. "WO-001").
        title: Human-readable title of the work order.
        description: Detailed description of the work order request.
        status: Current approval status.
        version: Optimistic-locking version counter; incremented on
            every state transition.
        applicant: ID of the user who created / submitted the order.
        rejection_reason: Reason provided when the order is rejected.
            Must be non-empty and >= 10 characters when set.
        created_at: Timestamp of creation.
        updated_at: Timestamp of last update.
        approval_records: Append-only list of approval actions taken.
    """

    id: str
    title: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    version: int = 1
    applicant: str = ""
    description: str = ""
    rejection_reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    approval_records: list[ApprovalRecord] = field(default_factory=list)

    # -- validation helpers -----------------------------------------------

    def validate_rejection_reason(self, reason: Optional[str]) -> None:
        """Validate that a rejection reason meets business constraints.

        Args:
            reason: The rejection reason to validate.

        Raises:
            RejectionReasonRequiredError: If the reason is empty, None,
                or shorter than 10 characters.
        """
        if not reason or len(reason.strip()) < 10:
            raise RejectionReasonRequiredError()

    # -- state transition -------------------------------------------------

    def can_transition(self, action: ApprovalAction) -> bool:
        """Check whether the given action is valid from the current status.

        Args:
            action: The action to check.

        Returns:
            True if the transition is allowed, False otherwise.
        """
        try:
            get_next_status(self.status, action)
            return True
        except InvalidStateTransitionError:
            return False

    def transition(
        self,
        action: ApprovalAction,
        rejection_reason: Optional[str] = None,
        approver_id: Optional[str] = None,
    ) -> None:
        """Execute a state transition on this work order.

        Args:
            action: The action to perform.
            rejection_reason: Required when action is REJECT; must be
                non-empty and >= 10 characters.
            approver_id: ID of the user performing the action (used to
                create an ApprovalRecord).

        Raises:
            InvalidStateTransitionError: If the transition is not allowed.
            RejectionReasonRequiredError: If rejecting without a valid
                reason.
        """
        # Reject requires a valid reason
        if action == ApprovalAction.REJECT:
            self.validate_rejection_reason(rejection_reason)

        next_status = get_next_status(self.status, action)

        # Determine approval level for the record
        approval_level = 0
        if self.status == ApprovalStatus.APPROVING_LEVEL_1:
            approval_level = 1
        elif self.status == ApprovalStatus.APPROVING_LEVEL_2:
            approval_level = 2

        # Update state
        self.status = next_status
        self.version += 1
        self.updated_at = datetime.utcnow()

        # Persist rejection reason on the order itself
        if action == ApprovalAction.REJECT and rejection_reason:
            self.rejection_reason = rejection_reason

        # Append immutable approval record
        if action in (ApprovalAction.APPROVE, ApprovalAction.REJECT):
            record = ApprovalRecord(
                id=f"AR-{self.id}-{self.version}",
                work_order_id=self.id,
                approver_id=approver_id or "",
                action=action,
                reason=rejection_reason,
                approval_level=approval_level,
                created_at=self.updated_at,
            )
            self.approval_records.append(record)

    # -- convenience properties -------------------------------------------

    @property
    def is_terminal(self) -> bool:
        """Return True if the work order is in a terminal state."""
        return self.status.is_terminal

    @property
    def current_approval_level(self) -> Optional[int]:
        """Return the current approval level (1 or 2), or None."""
        if self.status == ApprovalStatus.APPROVING_LEVEL_1:
            return 1
        if self.status == ApprovalStatus.APPROVING_LEVEL_2:
            return 2
        return None