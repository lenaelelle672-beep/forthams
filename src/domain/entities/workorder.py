"""Work Order domain entity with multi-level approval state machine.

Implements the two-level approval workflow mandated by the business spec:

    Forward flow:
        DRAFT → PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

    Reject flow (any approval level):
        APPROVING_LEVEL_1 → REJECTED
        APPROVING_LEVEL_2 → REJECTED

    Cancel flow:
        PENDING → CANCELLED

    Close flow (terminal):
        APPROVED  → CLOSED
        REJECTED  → CLOSED

State transitions are strictly validated by the state machine; illegal
transitions raise ``StateTransitionError`` (aliased as
``StateTransitionException`` for backward compatibility).
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted.

    Attributes:
        from_state: The state before the attempted transition.
        to_state:   The target state that was rejected.
        event:      The event that triggered the error.
    """

    def __init__(
        self,
        message: str,
        from_state: str,
        to_state: str,
        event: str,
    ) -> None:
        self.from_state = from_state
        self.to_state = to_state
        self.event = event
        super().__init__(message)


# Backward-compatible alias used by existing test suites.
StateTransitionException = StateTransitionError


# ---------------------------------------------------------------------------
# WorkOrderState Enum
# ---------------------------------------------------------------------------

class WorkOrderState(enum.Enum):
    """All possible states in the work-order approval lifecycle.

    Forward path:
        DRAFT → PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

    Reverse / terminal paths:
        APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED
        PENDING → CANCELLED
        APPROVED / REJECTED → CLOSED
    """

    DRAFT = "draft"
    PENDING = "pending"
    APPROVING_LEVEL_1 = "approving_level_1"
    APPROVING_LEVEL_2 = "approving_level_2"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    CLOSED = "closed"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @classmethod
    def from_value(cls, value: str) -> "WorkOrderState":
        """Resolve a string value to the corresponding enum member.

        Args:
            value: Case-insensitive string representation of the state.

        Returns:
            The matching ``WorkOrderState`` member.

        Raises:
            ValueError: If *value* does not match any known state.
        """
        normalised = value.strip().lower()
        for member in cls:
            if member.value == normalised:
                return member
        raise ValueError(
            f"Unknown work order state: '{value}'. "
            f"Valid values: {[m.value for m in cls]}"
        )

    @property
    def is_terminal(self) -> bool:
        """Return ``True`` if no further transitions are allowed."""
        return self in (
            WorkOrderState.APPROVED,
            WorkOrderState.REJECTED,
            WorkOrderState.CANCELLED,
            WorkOrderState.CLOSED,
        )

    @property
    def is_approval_stage(self) -> bool:
        """Return ``True`` if the state represents an active approval level."""
        return self in (
            WorkOrderState.APPROVING_LEVEL_1,
            WorkOrderState.APPROVING_LEVEL_2,
        )


# ---------------------------------------------------------------------------
# Transition Table  (event → {source: target})
# ---------------------------------------------------------------------------

_TRANSITION_TABLE: Dict[str, Dict[WorkOrderState, WorkOrderState]] = {
    # Draft → submitted
    "SUBMIT": {
        WorkOrderState.DRAFT: WorkOrderState.PENDING,
    },
    # Two-level approval forward chain
    "APPROVE": {
        WorkOrderState.PENDING: WorkOrderState.APPROVING_LEVEL_1,
        WorkOrderState.APPROVING_LEVEL_1: WorkOrderState.APPROVING_LEVEL_2,
        WorkOrderState.APPROVING_LEVEL_2: WorkOrderState.APPROVED,
    },
    # Reject at either approval level
    "REJECT": {
        WorkOrderState.APPROVING_LEVEL_1: WorkOrderState.REJECTED,
        WorkOrderState.APPROVING_LEVEL_2: WorkOrderState.REJECTED,
    },
    # Cancel before any approval completes
    "CANCEL": {
        WorkOrderState.PENDING: WorkOrderState.CANCELLED,
    },
    # Close after final decision
    "CLOSE": {
        WorkOrderState.APPROVED: WorkOrderState.CLOSED,
        WorkOrderState.REJECTED: WorkOrderState.CLOSED,
    },
}


# ---------------------------------------------------------------------------
# WorkOrderStateMachine
# ---------------------------------------------------------------------------

class WorkOrderStateMachine:
    """Deterministic state machine for work-order approval transitions.

    The machine enforces the transition rules defined in ``_TRANSITION_TABLE``
    and raises ``StateTransitionError`` for every illegal move, preventing
    cross-level approval and other invalid flows.

    Args:
        initial_state: Starting state. Defaults to ``WorkOrderState.DRAFT``.

    Example::

        sm = WorkOrderStateMachine()
        sm.trigger("SUBMIT")   # DRAFT → PENDING
        sm.trigger("APPROVE")  # PENDING → APPROVING_LEVEL_1
        sm.trigger("APPROVE")  # APPROVING_LEVEL_1 → APPROVING_LEVEL_2
        sm.trigger("APPROVE")  # APPROVING_LEVEL_2 → APPROVED
    """

    def __init__(
        self,
        initial_state: WorkOrderState = WorkOrderState.DRAFT,
    ) -> None:
        """Initialise the machine with the given state.

        Args:
            initial_state: The state the machine starts in.
        """
        self._current_state = initial_state

    # -- Query ---------------------------------------------------------------

    def get_current_state(self) -> WorkOrderState:
        """Return the current state without side effects.

        Returns:
            The ``WorkOrderState`` the machine is currently in.
        """
        return self._current_state

    def can_trigger(self, event: str) -> bool:
        """Check whether *event* is valid in the current state.

        Args:
            event: Event name (e.g. ``"APPROVE"``, ``"REJECT"``).

        Returns:
            ``True`` if the transition would succeed.
        """
        return self._current_state in _TRANSITION_TABLE.get(event, {})

    def get_target_state(self, event: str) -> Optional[WorkOrderState]:
        """Peek at the target state for *event* without mutating state.

        Args:
            event: Event name.

        Returns:
            The ``WorkOrderState`` that would result, or ``None`` if the
            event is not valid in the current state.
        """
        return _TRANSITION_TABLE.get(event, {}).get(self._current_state)

    def get_valid_events(self) -> List[str]:
        """List all events that are legal in the current state.

        Returns:
            A list of event names (e.g. ``["APPROVE", "CANCEL"]``).
        """
        return [
            event
            for event, transitions in _TRANSITION_TABLE.items()
            if self._current_state in transitions
        ]

    # -- Mutation ------------------------------------------------------------

    def trigger(self, event: str) -> bool:
        """Execute a state transition for *event*.

        Args:
            event: Event name (``SUBMIT``, ``APPROVE``, ``REJECT``,
                ``CANCEL``, or ``CLOSE``).

        Returns:
            ``True`` when the transition succeeds.

        Raises:
            StateTransitionError: If the event is not valid in the current
                state.
        """
        transitions = _TRANSITION_TABLE.get(event, {})
        if self._current_state not in transitions:
            raise StateTransitionError(
                message=(
                    f"Cannot trigger '{event}' in state "
                    f"'{self._current_state.value}'. "
                    f"Valid events: {self.get_valid_events()}"
                ),
                from_state=self._current_state.value,
                to_state="N/A",
                event=event,
            )
        self._current_state = transitions[self._current_state]
        return True

    def reset(self, state: WorkOrderState = WorkOrderState.DRAFT) -> None:
        """Force-reset the machine to an arbitrary state.

        This is primarily useful in tests.

        Args:
            state: The state to reset to.
        """
        self._current_state = state


# ---------------------------------------------------------------------------
# WorkOrder Entity
# ---------------------------------------------------------------------------

class WorkOrder:
    """Domain entity representing a work order with two-level approval.

    The entity owns a ``WorkOrderStateMachine`` instance that governs all
    status changes.  A ``version`` field supports optimistic locking for
    concurrent approval scenarios.

    Attributes:
        id:                Unique identifier (``None`` for new entities).
        title:             Brief title / summary.
        description:       Detailed description of the work to be done.
        applicant_id:      ID of the user who created the order.
        status:            Current ``WorkOrderState``.
        version:           Optimistic-lock counter (incremented on every
                           mutating operation).
        rejection_reason:  Mandatory reason when the order is rejected
                           (max 500 characters).
        created_at:        ISO-8601 creation timestamp.
        updated_at:        ISO-8601 last-modified timestamp.
    """

    MAX_REJECTION_REASON_LENGTH: int = 500

    def __init__(
        self,
        id: Optional[str] = None,
        title: str = "",
        description: str = "",
        applicant_id: Optional[str] = None,
        status: WorkOrderState = WorkOrderState.DRAFT,
        version: int = 0,
        rejection_reason: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        """Create a new ``WorkOrder`` entity.

        Args:
            id:                Unique identifier.
            title:             Brief title.
            description:       Detailed description.
            applicant_id:      Creating user's ID.
            status:            Initial status (default ``DRAFT``).
            version:           Optimistic-lock version (default ``0``).
            rejection_reason:  Reason for rejection, if any.
            created_at:        Creation timestamp.
            updated_at:        Last-update timestamp.
        """
        self.id = id
        self.title = title
        self.description = description
        self.applicant_id = applicant_id
        self.status = status
        self.version = version
        self.rejection_reason = rejection_reason
        self.created_at: datetime = created_at or datetime.now(timezone.utc)
        self.updated_at: datetime = updated_at or datetime.now(timezone.utc)
        self._state_machine = WorkOrderStateMachine(initial_state=status)

    # -- State-machine delegation -------------------------------------------

    def get_current_state(self) -> WorkOrderState:
        """Return the current approval state.

        Returns:
            The ``WorkOrderState`` the order is in.
        """
        return self._state_machine.get_current_state()

    def can_trigger(self, event: str) -> bool:
        """Check whether *event* is valid in the current state.

        Args:
            event: Event name.

        Returns:
            ``True`` if the transition would succeed.
        """
        return self._state_machine.can_trigger(event)

    def trigger(self, event: str) -> bool:
        """Execute a state transition and synchronise entity fields.

        After a successful transition the ``status`` and ``updated_at``
        attributes are updated automatically.

        Args:
            event: Event name.

        Returns:
            ``True`` on success.

        Raises:
            StateTransitionError: If the transition is illegal.
        """
        result = self._state_machine.trigger(event)
        self.status = self._state_machine.get_current_state()
        self.updated_at = datetime.now(timezone.utc)
        return result

    def get_target_state(self, event: str) -> Optional[WorkOrderState]:
        """Preview the target state for *event* without side effects.

        Args:
            event: Event name.

        Returns:
            Target ``WorkOrderState`` or ``None``.
        """
        return self._state_machine.get_target_state(event)

    def get_valid_events(self) -> List[str]:
        """List events legal in the current state.

        Returns:
            A list of event name strings.
        """
        return self._state_machine.get_valid_events()

    # -- High-level domain actions ------------------------------------------

    def submit(self) -> None:
        """Submit the draft work order for approval (DRAFT → PENDING).

        Raises:
            StateTransitionError: If the order is not in ``DRAFT`` state.
        """
        self.trigger("SUBMIT")

    def approve(self) -> None:
        """Advance the order through the approval chain.

        Valid transitions:
            PENDING            → APPROVING_LEVEL_1
            APPROVING_LEVEL_1  → APPROVING_LEVEL_2
            APPROVING_LEVEL_2  → APPROVED

        Raises:
            StateTransitionError: If approval is not valid in the current
                state (e.g. cross-level approval attempt).
        """
        self.trigger("APPROVE")

    def reject(self, reason: str) -> None:
        """Reject the order at the current approval level.

        Valid transitions:
            APPROVING_LEVEL_1 → REJECTED
            APPROVING_LEVEL_2 → REJECTED

        Args:
            reason: Mandatory rejection reason. Must be a non-empty string
                with at most ``MAX_REJECTION_REASON_LENGTH`` (500) characters.

        Raises:
            StateTransitionError: If rejection is not valid in the current
                state.
            ValueError: If *reason* is empty/blank or exceeds the maximum
                length.
        """
        if not reason or not reason.strip():
            raise ValueError(
                "Rejection reason is required and cannot be empty."
            )
        if len(reason) > self.MAX_REJECTION_REASON_LENGTH:
            raise ValueError(
                f"Rejection reason must not exceed "
                f"{self.MAX_REJECTION_REASON_LENGTH} characters "
                f"(got {len(reason)})."
            )
        self.trigger("REJECT")
        self.rejection_reason = reason.strip()

    def cancel(self) -> None:
        """Cancel the work order (PENDING → CANCELLED).

        Raises:
            StateTransitionError: If the order is not in ``PENDING`` state.
        """
        self.trigger("CANCEL")

    def close(self) -> None:
        """Close the work order after a final decision.

        Valid transitions:
            APPROVED → CLOSED
            REJECTED → CLOSED

        Raises:
            StateTransitionError: If the order is not in ``APPROVED`` or
                ``REJECTED`` state.
        """
        self.trigger("CLOSE")

    # -- Optimistic locking -------------------------------------------------

    def increment_version(self) -> int:
        """Bump the optimistic-lock version counter.

        Call this **before** persisting to detect concurrent modifications.

        Returns:
            The new version number.
        """
        self.version += 1
        return self.version

    # -- Serialisation ------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """Serialise the entity to a plain dictionary.

        Dates are emitted as ISO-8601 strings.

        Returns:
            A ``dict`` suitable for JSON encoding.
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "applicant_id": self.applicant_id,
            "status": self.status.value,
            "version": self.version,
            "rejection_reason": self.rejection_reason,
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "updated_at": (
                self.updated_at.isoformat() if self.updated_at else None
            ),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkOrder":
        """Deserialise a ``WorkOrder`` from a dictionary.

        Args:
            data: Dictionary with work-order fields. The ``status`` field
                may be a ``WorkOrderState`` enum, a string value, or absent
                (defaults to ``DRAFT``).  Date fields accept ISO-8601
                strings or ``datetime`` objects.

        Returns:
            A fully initialised ``WorkOrder`` instance.
        """
        # Resolve status
        raw_status = data.get("status", "draft")
        if isinstance(raw_status, WorkOrderState):
            status = raw_status
        elif isinstance(raw_status, str):
            status = WorkOrderState.from_value(raw_status)
        else:
            status = WorkOrderState.DRAFT

        # Resolve dates
        def _parse_dt(value: Any) -> Optional[datetime]:
            if value is None:
                return None
            if isinstance(value, datetime):
                return value
            if isinstance(value, str):
                return datetime.fromisoformat(value)
            return None

        return cls(
            id=data.get("id"),
            title=data.get("title", ""),
            description=data.get("description", ""),
            applicant_id=data.get("applicant_id"),
            status=status,
            version=data.get("version", 0),
            rejection_reason=data.get("rejection_reason"),
            created_at=_parse_dt(data.get("created_at")),
            updated_at=_parse_dt(data.get("updated_at")),
        )

    # -- Dunder helpers -----------------------------------------------------

    def __repr__(self) -> str:
        """Return a concise, unambiguous string representation.

        Returns:
            A string like
            ``WorkOrder(id='abc', status='pending', version=1)``.
        """
        return (
            f"WorkOrder(id={self.id!r}, status={self.status.value!r}, "
            f"version={self.version!r})"
        )

    def __eq__(self, other: object) -> bool:
        """Compare two ``WorkOrder`` instances by identity and version.

        Args:
            other: Object to compare against.

        Returns:
            ``True`` if *other* is a ``WorkOrder`` with the same ``id``
            and ``version``.
        """
        if not isinstance(other, WorkOrder):
            return NotImplemented
        return self.id == other.id and self.version == other.version

    def __hash__(self) -> int:
        """Hash based on ``id`` and ``version``.

        Returns:
            An integer hash value.
        """
        return hash((self.id, self.version))