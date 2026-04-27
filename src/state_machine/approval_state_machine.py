"""
Approval State Machine Module
==============================

Implements the multi-level approval state machine for work orders.

State Flow
----------
Forward (approval):
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

Reverse (rejection):
    APPROVING_LEVEL_1 → REJECTED
    APPROVING_LEVEL_2 → REJECTED

Cancellation:
    PENDING → CANCELLED

Terminal states: APPROVED, REJECTED, CANCELLED (no further transitions allowed).

Constraints
-----------
- Cross-level approval is strictly forbidden (e.g. PENDING → APPROVING_LEVEL_2).
- Rejection requires a non-empty reason (validated at the service layer, not here).
- All invalid transitions raise :class:`StateTransitionException`.
"""

from __future__ import annotations

import enum
from typing import Dict, FrozenSet, Optional, Tuple


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class StateTransitionException(Exception):
    """Raised when an illegal state transition is attempted.

    Attributes:
        from_state: The source state of the attempted transition.
        event: The event that triggered the illegal transition.
        message: Human-readable description of the error.
    """

    def __init__(
        self,
        from_state: "ApprovalState",
        event: str,
        message: str = "",
    ) -> None:
        self.from_state = from_state
        self.event = event
        self.message = message or (
            f"Invalid transition: cannot fire event '{event}' "
            f"from state '{from_state.name}'"
        )
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Approval State Enum
# ---------------------------------------------------------------------------

class ApprovalState(enum.Enum):
    """Enumeration of all possible states in the approval lifecycle.

    States
    ------
    PENDING : Initial state after a work order is submitted.
    APPROVING_LEVEL_1 : Awaiting department-manager approval.
    APPROVING_LEVEL_2 : Awaiting asset-administrator approval.
    APPROVED : All approval levels passed (terminal).
    REJECTED : Rejected at some approval level (terminal).
    CANCELLED : Cancelled by the applicant (terminal).
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# ---------------------------------------------------------------------------
# Approval Event Enum
# ---------------------------------------------------------------------------

class ApprovalEvent(enum.Enum):
    """Enumeration of events that can trigger state transitions.

    Events
    ------
    SUBMIT : Applicant submits the work order for approval.
    APPROVE : An approver approves the work order at the current level.
    REJECT : An approver rejects the work order at the current level.
    CANCEL : Applicant cancels the work order.
    """

    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


# ---------------------------------------------------------------------------
# Transition Table (authoritative source of truth)
# ---------------------------------------------------------------------------

# Maps (source_state, event) → target_state.
# Only explicitly listed transitions are legal.
_TRANSITION_TABLE: Dict[Tuple[ApprovalState, ApprovalEvent], ApprovalState] = {
    # Forward approval flow
    (ApprovalState.PENDING, ApprovalEvent.SUBMIT): ApprovalState.APPROVING_LEVEL_1,
    (ApprovalState.APPROVING_LEVEL_1, ApprovalEvent.APPROVE): ApprovalState.APPROVING_LEVEL_2,
    (ApprovalState.APPROVING_LEVEL_2, ApprovalEvent.APPROVE): ApprovalState.APPROVED,
    # Rejection flow (from any approval level)
    (ApprovalState.APPROVING_LEVEL_1, ApprovalEvent.REJECT): ApprovalState.REJECTED,
    (ApprovalState.APPROVING_LEVEL_2, ApprovalEvent.REJECT): ApprovalState.REJECTED,
    # Cancellation flow
    (ApprovalState.PENDING, ApprovalEvent.CANCEL): ApprovalState.CANCELLED,
}

# Terminal states — once reached, no further transitions are permitted.
_TERMINAL_STATES: FrozenSet[ApprovalState] = frozenset({
    ApprovalState.APPROVED,
    ApprovalState.REJECTED,
    ApprovalState.CANCELLED,
})


# ---------------------------------------------------------------------------
# Approval State Machine
# ---------------------------------------------------------------------------

class ApprovalStateMachine:
    """Deterministic finite-state machine governing the approval workflow.

    The machine enforces the following rules:

    1. **Sequential approval**: Work orders must pass through
       ``APPROVING_LEVEL_1`` before reaching ``APPROVING_LEVEL_2``.
       Cross-level jumps are rejected with :class:`StateTransitionException`.
    2. **Rejection from any approval level**: Both ``APPROVING_LEVEL_1`` and
       ``APPROVING_LEVEL_2`` can transition to ``REJECTED`` via the
       ``REJECT`` event.
    3. **Terminal state immutability**: ``APPROVED``, ``REJECTED``, and
       ``CANCELLED`` are terminal — any event on these states raises
       :class:`StateTransitionException`.
    4. **Cancellation only from PENDING**: Only a ``PENDING`` work order
       can be cancelled.

    Parameters
    ----------
    initial_state : ApprovalState, optional
        The starting state of the machine.  Defaults to ``PENDING``.

    Examples
    --------
    >>> sm = ApprovalStateMachine()
    >>> sm.get_current_state()
    <ApprovalState.PENDING: 'PENDING'>
    >>> sm.trigger("SUBMIT")
    True
    >>> sm.get_current_state()
    <ApprovalState.APPROVING_LEVEL_1: 'APPROVING_LEVEL_1'>
    """

    def __init__(
        self,
        initial_state: ApprovalState = ApprovalState.PENDING,
    ) -> None:
        """Initialize the state machine with the given starting state.

        Args:
            initial_state: The state to start in. Defaults to PENDING.
        """
        self._current_state: ApprovalState = initial_state

    # -- Public interface ---------------------------------------------------

    def get_current_state(self) -> ApprovalState:
        """Return the current state of the machine.

        Returns:
            The current :class:`ApprovalState`.
        """
        return self._current_state

    def trigger(self, event: str) -> bool:
        """Attempt to fire an event and transition to the next state.

        Args:
            event: The event name as a string (e.g. ``"SUBMIT"``,
                ``"APPROVE"``, ``"REJECT"``, ``"CANCEL"``).  Case-insensitive.

        Returns:
            ``True`` if the transition succeeded.

        Raises:
            StateTransitionException: If the transition is not allowed.
            ValueError: If *event* is not a recognised event name.
        """
        # Resolve the event string to an ApprovalEvent enum member.
        try:
            approval_event = ApprovalEvent[event.upper()]
        except KeyError as exc:
            raise ValueError(
                f"Unknown event '{event}'. "
                f"Valid events: {[e.name for e in ApprovalEvent]}"
            ) from exc

        return self._fire(approval_event)

    def can_trigger(self, event: str) -> bool:
        """Check whether a given event can be fired in the current state.

        This method does **not** mutate the machine state.

        Args:
            event: The event name as a string.  Case-insensitive.

        Returns:
            ``True`` if the event is legal in the current state.
        """
        try:
            approval_event = ApprovalEvent[event.upper()]
        except KeyError:
            return False

        return (self._current_state, approval_event) in _TRANSITION_TABLE

    def get_allowed_events(self) -> list[str]:
        """Return a list of event names that are legal in the current state.

        Returns:
            A list of uppercase event-name strings (may be empty for
            terminal states).
        """
        return [
            event.name
            for (state, event) in _TRANSITION_TABLE
            if state == self._current_state
        ]

    def is_terminal(self) -> bool:
        """Check whether the machine is in a terminal state.

        Returns:
            ``True`` if the current state is terminal (APPROVED, REJECTED,
            or CANCELLED).
        """
        return self._current_state in _TERMINAL_STATES

    def reset(self, state: ApprovalState = ApprovalState.PENDING) -> None:
        """Reset the machine to the given state.

        This is primarily useful for testing or re-initialisation scenarios.

        Args:
            state: The state to reset to. Defaults to PENDING.
        """
        self._current_state = state

    # -- Equality / representation -------------------------------------------

    def __eq__(self, other: object) -> bool:
        """Compare two machines by their current state.

        Args:
            other: The object to compare against.

        Returns:
            ``True`` if *other* is an :class:`ApprovalStateMachine` with the
            same current state.
        """
        if not isinstance(other, ApprovalStateMachine):
            return NotImplemented
        return self._current_state == other._current_state

    def __repr__(self) -> str:
        """Return a developer-friendly string representation.

        Returns:
            A string like ``ApprovalStateMachine(state=PENDING)``.
        """
        return f"ApprovalStateMachine(state={self._current_state.name})"

    def __str__(self) -> str:
        """Return a human-readable string representation.

        Returns:
            A string like ``ApprovalStateMachine [PENDING]``.
        """
        return f"ApprovalStateMachine [{self._current_state.value}]"

    # -- Internal helpers ---------------------------------------------------

    def _fire(self, event: ApprovalEvent) -> bool:
        """Execute a state transition for the given event.

        Args:
            event: A validated :class:`ApprovalEvent` member.

        Returns:
            ``True`` when the transition succeeds.

        Raises:
            StateTransitionException: If the transition is not permitted.
        """
        key = (self._current_state, event)

        if key not in _TRANSITION_TABLE:
            raise StateTransitionException(
                from_state=self._current_state,
                event=event.name,
            )

        self._current_state = _TRANSITION_TABLE[key]
        return True


# ---------------------------------------------------------------------------
# Convenience: class-level transition table accessor (for service-layer use)
# ---------------------------------------------------------------------------

def get_transition_table() -> Dict[Tuple[ApprovalState, ApprovalEvent], ApprovalState]:
    """Return a shallow copy of the internal transition table.

    This is useful for service-layer code that needs to introspect valid
    transitions without importing private module variables.

    Returns:
        A dict mapping ``(ApprovalState, ApprovalEvent)`` → ``ApprovalState``.
    """
    return dict(_TRANSITION_TABLE)


def get_terminal_states() -> FrozenSet[ApprovalState]:
    """Return the set of terminal (final) states.

    Returns:
        A frozenset of :class:`ApprovalState` members that are terminal.
    """
    return _TERMINAL_STATES