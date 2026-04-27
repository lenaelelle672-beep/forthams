"""
Work Order State Machine Module

Implements the multi-level approval state machine for work orders with strict
state transition enforcement, rejection reason validation, and immutable
transition history.

Supported state flow:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED  (requires reason ≥ 10 chars)
    PENDING / APPROVING_LEVEL_1 → CANCELLED

Terminal states: APPROVED, REJECTED, CANCELLED
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, FrozenSet, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class WorkOrderStatus(enum.Enum):
    """Enumeration of all possible work order statuses in the approval lifecycle.

    States:
        PENDING: Initial state after work order creation.
        APPROVING_LEVEL_1: Awaiting department manager approval.
        APPROVING_LEVEL_2: Awaiting asset administrator approval.
        APPROVED: Work order fully approved (terminal).
        REJECTED: Work order has been rejected (terminal).
        CANCELLED: Work order has been cancelled (terminal).
    """
    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class WorkOrderEvent(enum.Enum):
    """Enumeration of events that can trigger work order state transitions.

    Events:
        SUBMIT: Submit work order for Level-1 approval.
        APPROVE_LEVEL_1: Department manager approves → moves to Level-2.
        APPROVE_LEVEL_2: Asset administrator approves → work order completed.
        REJECT: Reject the work order (requires rejection_reason).
        CANCEL: Cancel the work order.
    """
    SUBMIT = "SUBMIT"
    APPROVE_LEVEL_1 = "APPROVE_LEVEL_1"
    APPROVE_LEVEL_2 = "APPROVE_LEVEL_2"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


# Backward-compatible aliases used by existing test suites
ApprovalStatus = WorkOrderStatus
ApprovalAction = WorkOrderEvent


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidStateTransitionError(Exception):
    """Raised when a disallowed state transition is attempted.

    This covers:
    - Transitions from terminal states (APPROVED, REJECTED, CANCELLED).
    - Transitions that skip approval levels (e.g. PENDING → APPROVING_LEVEL_2).
    - Any (status, event) pair not explicitly defined in the transition table.
    """
    pass


class RejectionReasonRequiredError(ValueError):
    """Raised when a REJECT event is fired without a valid rejection reason.

    A valid rejection reason must be:
    - Non-empty (after stripping whitespace).
    - At least 10 characters long.
    """
    pass


# ---------------------------------------------------------------------------
# Transition Record (immutable, append-only per spec constraint #4)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TransitionRecord:
    """Immutable record of a single state transition.

    Once created, a TransitionRecord cannot be modified, ensuring audit
    trail integrity. Records are appended to the state machine history
    and never removed or altered.

    Attributes:
        from_status: The status before the transition.
        to_status: The status after the transition.
        event: The event that triggered the transition.
        operator: Identifier of the user who performed the action.
        rejection_reason: Optional reason provided when rejecting.
        timestamp: UTC timestamp of when the transition occurred.
    """
    from_status: WorkOrderStatus
    to_status: WorkOrderStatus
    event: WorkOrderEvent
    operator: str
    rejection_reason: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Transition Table & Constraints
# ---------------------------------------------------------------------------

# Minimum length for rejection reason (spec constraint #3)
_MIN_REJECTION_REASON_LENGTH: int = 10

# Strict transition table: (current_status, event) → new_status
# Any pair not listed here is an illegal transition.
_VALID_TRANSITIONS: Dict[Tuple[WorkOrderStatus, WorkOrderEvent], WorkOrderStatus] = {
    # Normal approval flow
    (WorkOrderStatus.PENDING, WorkOrderEvent.SUBMIT): WorkOrderStatus.APPROVING_LEVEL_1,
    (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderEvent.APPROVE_LEVEL_1): WorkOrderStatus.APPROVING_LEVEL_2,
    (WorkOrderStatus.APPROVING_LEVEL_2, WorkOrderEvent.APPROVE_LEVEL_2): WorkOrderStatus.APPROVED,
    # Rejection paths (from either approval level)
    (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderEvent.REJECT): WorkOrderStatus.REJECTED,
    (WorkOrderStatus.APPROVING_LEVEL_2, WorkOrderEvent.REJECT): WorkOrderStatus.REJECTED,
    # Cancellation paths
    (WorkOrderStatus.PENDING, WorkOrderEvent.CANCEL): WorkOrderStatus.CANCELLED,
    (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderEvent.CANCEL): WorkOrderStatus.CANCELLED,
}

# Terminal states — no further transitions permitted
_TERMINAL_STATES: FrozenSet[WorkOrderStatus] = frozenset({
    WorkOrderStatus.APPROVED,
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.CANCELLED,
})


# ---------------------------------------------------------------------------
# State Machine Implementation
# ---------------------------------------------------------------------------

class WorkOrderStateMachine:
    """State machine governing the work order lifecycle with multi-level approval.

    Enforces strict state transitions per the defined approval chain:
        PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
        APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED  (requires reason)
        PENDING / APPROVING_LEVEL_1 → CANCELLED

    Key behaviours:
    - **No skipping levels**: PENDING cannot jump to APPROVING_LEVEL_2, etc.
    - **Terminal state lock**: APPROVED, REJECTED, CANCELLED block all events.
    - **Rejection reason enforcement**: REJECT events require a non-empty
      reason of at least 10 characters.
    - **Immutable history**: Every transition is recorded as a frozen
      TransitionRecord; history is append-only.

    Args:
        initial_status: The starting status of the work order.
            Defaults to WorkOrderStatus.PENDING.

    Example::

        >>> sm = WorkOrderStateMachine()
        >>> sm.status
        <WorkOrderStatus.PENDING: 'PENDING'>
        >>> sm.transition(WorkOrderEvent.SUBMIT, operator="user-001")
        TransitionRecord(from_status=<WorkOrderStatus.PENDING: 'PENDING'>, ...)
        >>> sm.status
        <WorkOrderStatus.APPROVING_LEVEL_1: 'APPROVING_LEVEL_1'>
    """

    def __init__(
        self,
        initial_status: WorkOrderStatus = WorkOrderStatus.PENDING,
    ) -> None:
        """Initialize the state machine with the given status.

        Args:
            initial_status: The starting status for the work order.
                Defaults to WorkOrderStatus.PENDING.
        """
        self._status: WorkOrderStatus = initial_status
        self._history: List[TransitionRecord] = []

    # -- Properties ----------------------------------------------------------

    @property
    def status(self) -> WorkOrderStatus:
        """Return the current status of the work order.

        Returns:
            The current WorkOrderStatus value.
        """
        return self._status

    @property
    def history(self) -> Tuple[TransitionRecord, ...]:
        """Return an immutable tuple of all transition records.

        Returns:
            A tuple of TransitionRecord instances in chronological order.
        """
        return tuple(self._history)

    @property
    def is_terminal(self) -> bool:
        """Return True if the current status is a terminal state.

        Terminal states (APPROVED, REJECTED, CANCELLED) do not allow
        any further transitions.

        Returns:
            True if no further transitions are possible.
        """
        return self._status in _TERMINAL_STATES

    # -- Public API ----------------------------------------------------------

    def can_transition(self, event: WorkOrderEvent) -> bool:
        """Check whether the given event is valid from the current status.

        This method performs a dry-run check without modifying state.
        It does NOT validate rejection reasons — use ``transition()`` for
        full validation.

        Args:
            event: The event to check.

        Returns:
            True if the transition is allowed, False otherwise.
        """
        if self.is_terminal:
            return False
        return (self._status, event) in _VALID_TRANSITIONS

    def transition(
        self,
        event: WorkOrderEvent,
        operator: str = "system",
        rejection_reason: Optional[str] = None,
    ) -> TransitionRecord:
        """Execute a state transition with full validation.

        Validates that:
        1. The current state is not terminal.
        2. The (status, event) pair is defined in the transition table.
        3. If the event is REJECT, a valid rejection_reason is provided.

        Args:
            event: The event triggering the transition.
            operator: Identifier of the user performing the action.
                Defaults to "system".
            rejection_reason: Mandatory when event is REJECT.
                Must be non-empty and at least 10 characters long.

        Returns:
            A frozen TransitionRecord documenting the transition.

        Raises:
            InvalidStateTransitionError: If the transition is not allowed
                (terminal state, undefined pair, or level skip).
            RejectionReasonRequiredError: If rejecting without a valid reason.
        """
        # Guard 1: terminal state — no transitions allowed
        if self.is_terminal:
            raise InvalidStateTransitionError(
                f"Cannot transition from terminal state "
                f"'{self._status.value}'."
            )

        # Guard 2: valid transition pair
        key = (self._status, event)
        if key not in _VALID_TRANSITIONS:
            raise InvalidStateTransitionError(
                f"Invalid transition: event '{event.value}' is not allowed "
                f"from status '{self._status.value}'."
            )

        # Guard 3: rejection reason validation (spec constraint #3)
        if event == WorkOrderEvent.REJECT:
            self._validate_rejection_reason(rejection_reason)

        # Execute the state change
        previous_status = self._status
        new_status = _VALID_TRANSITIONS[key]
        self._status = new_status

        # Append immutable record (spec constraint #4: append-only)
        record = TransitionRecord(
            from_status=previous_status,
            to_status=new_status,
            event=event,
            operator=operator,
            rejection_reason=rejection_reason,
        )
        self._history.append(record)

        return record

    def get_allowed_events(self) -> List[WorkOrderEvent]:
        """Return a list of events that are valid from the current status.

        Returns:
            A list of WorkOrderEvent values that can be triggered
            from the current status. Empty for terminal states.
        """
        if self.is_terminal:
            return []
        return [
            event
            for (status, event) in _VALID_TRANSITIONS
            if status == self._status
        ]

    def reset(self, status: WorkOrderStatus = WorkOrderStatus.PENDING) -> None:
        """Reset the state machine to a given status, clearing all history.

        This is primarily intended for testing scenarios where a fresh
        state machine instance is needed.

        Args:
            status: The status to reset to. Defaults to PENDING.
        """
        self._status = status
        self._history.clear()

    # -- Private helpers -----------------------------------------------------

    @staticmethod
    def _validate_rejection_reason(reason: Optional[str]) -> None:
        """Validate that the rejection reason meets business requirements.

        Per spec constraint #3, the rejection reason must be:
        - Non-null and non-empty (after stripping whitespace).
        - At least 10 characters long.

        Args:
            reason: The rejection reason to validate.

        Raises:
            RejectionReasonRequiredError: If the reason is missing, empty,
                or shorter than the minimum required length.
        """
        if not reason or not reason.strip():
            raise RejectionReasonRequiredError(
                "Rejection reason is required and cannot be empty."
            )
        stripped_length = len(reason.strip())
        if stripped_length < _MIN_REJECTION_REASON_LENGTH:
            raise RejectionReasonRequiredError(
                f"Rejection reason must be at least "
                f"{_MIN_REJECTION_REASON_LENGTH} characters long, "
                f"got {stripped_length}."
            )

    # -- Dunder methods ------------------------------------------------------

    def __repr__(self) -> str:
        """Return a developer-friendly string representation.

        Returns:
            A string showing the current status and number of transitions.
        """
        return (
            f"WorkOrderStateMachine("
            f"status={self._status.value!r}, "
            f"transitions={len(self._history)})"
        )

    def __eq__(self, other: object) -> bool:
        """Check equality based on current status and transition history.

        Args:
            other: The object to compare against.

        Returns:
            True if both status and history match, False otherwise.
        """
        if not isinstance(other, WorkOrderStateMachine):
            return NotImplemented
        return (
            self._status == other._status
            and self._history == other._history
        )

    def __hash__(self) -> int:
        """Return a hash based on current status and history length.

        Returns:
            An integer hash value.
        """
        return hash((self._status, len(self._history)))


# Backward-compatible alias used by existing test suites
ApprovalStateMachine = WorkOrderStateMachine


__all__ = [
    "WorkOrderStatus",
    "WorkOrderEvent",
    "ApprovalStatus",
    "ApprovalAction",
    "InvalidStateTransitionError",
    "RejectionReasonRequiredError",
    "TransitionRecord",
    "WorkOrderStateMachine",
    "ApprovalStateMachine",
]