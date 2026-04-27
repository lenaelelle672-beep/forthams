"""Work order status enum with state machine transition rules.

Defines the complete lifecycle states for a work order, including the
two-level approval flow (department manager → asset manager) and
provides strict transition validation to prevent illegal state changes.

State Flow (forward):
    DRAFT → PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED → CLOSED

State Flow (rejection):
    APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED → CLOSED

State Flow (cancellation):
    DRAFT / PENDING / APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → CANCELLED
"""

from __future__ import annotations

import enum
from typing import Dict, FrozenSet, Optional


class WorkOrderStatus(str, enum.Enum):
    """Enumeration of all possible work order statuses.

    Each member is a string-valued enum so it serialises cleanly to JSON
    and matches database stored values without extra conversion.

    Attributes:
        DRAFT: Work order is being prepared and has not been submitted yet.
        PENDING: Work order has been submitted and is awaiting first-level approval.
        APPROVING_LEVEL_1: Work order is under review by the department manager.
        APPROVING_LEVEL_2: Work order is under review by the asset manager.
        APPROVED: Work order has passed all approval levels.
        REJECTED: Work order has been rejected at an approval level.
        CANCELLED: Work order has been cancelled by the applicant.
        CLOSED: Work order is in a terminal / archived state.
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
    # Classification helpers
    # ------------------------------------------------------------------

    @property
    def is_terminal(self) -> bool:
        """Return True if this status is a terminal (final) state.

        Terminal states are ``APPROVED``, ``REJECTED``, ``CANCELLED``, and
        ``CLOSED``.  No further transitions are allowed from these states.

        Returns:
            bool: Whether the status is terminal.
        """
        return self in _TERMINAL_STATES

    @property
    def is_approval_stage(self) -> bool:
        """Return True if this status represents an active approval stage.

        Returns:
            bool: Whether the status is an in-progress approval level.
        """
        return self in (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderStatus.APPROVING_LEVEL_2)

    @property
    def approval_level(self) -> Optional[int]:
        """Return the 1-based approval level number, or None if not applicable.

        Returns:
            Optional[int]: 1 for ``APPROVING_LEVEL_1``, 2 for ``APPROVING_LEVEL_2``,
            otherwise ``None``.
        """
        _level_map = {
            WorkOrderStatus.APPROVING_LEVEL_1: 1,
            WorkOrderStatus.APPROVING_LEVEL_2: 2,
        }
        return _level_map.get(self)

    # ------------------------------------------------------------------
    # Transition validation
    # ------------------------------------------------------------------

    def can_transition_to(self, target: "WorkOrderStatus") -> bool:
        """Check whether a transition from *self* to *target* is valid.

        The transition rules are defined in :data:`_TRANSITIONS`.  Any
        transition not explicitly listed is considered illegal.

        Args:
            target: The desired next status.

        Returns:
            bool: ``True`` if the transition is allowed, ``False`` otherwise.
        """
        allowed: FrozenSet[WorkOrderStatus] = _TRANSITIONS.get(self, frozenset())
        return target in allowed

    def validate_transition(self, target: "WorkOrderStatus") -> None:
        """Validate a transition, raising an exception if it is illegal.

        Args:
            target: The desired next status.

        Raises:
            InvalidStateTransitionError: If the transition is not permitted.
        """
        if not self.can_transition_to(target):
            raise InvalidStateTransitionError(
                current=self,
                target=target,
                reason=(
                    f"Transition from '{self.value}' to '{target.value}' "
                    f"is not allowed."
                ),
            )

    # ------------------------------------------------------------------
    # Convenience class-level helpers
    # ------------------------------------------------------------------

    @classmethod
    def from_value(cls, value: str) -> "WorkOrderStatus":
        """Construct a ``WorkOrderStatus`` from a raw string value.

        This is useful when deserialising from JSON or database rows.

        Args:
            value: Case-insensitive string representation of the status.

        Returns:
            WorkOrderStatus: The corresponding enum member.

        Raises:
            ValueError: If *value* does not match any known status.
        """
        try:
            return cls(value.lower())
        except ValueError:
            valid = ", ".join(s.value for s in cls)
            raise ValueError(
                f"Invalid work order status '{value}'. "
                f"Valid values are: {valid}"
            ) from None

    @classmethod
    def terminal_states(cls) -> FrozenSet["WorkOrderStatus"]:
        """Return the set of all terminal statuses.

        Returns:
            FrozenSet[WorkOrderStatus]: Terminal status members.
        """
        return _TERMINAL_STATES

    @classmethod
    def approval_states(cls) -> FrozenSet["WorkOrderStatus"]:
        """Return the set of all approval-stage statuses.

        Returns:
            FrozenSet[WorkOrderStatus]: Approval-stage status members.
        """
        return frozenset(
            {cls.APPROVING_LEVEL_1, cls.APPROVING_LEVEL_2}
        )


# ======================================================================
# Transition map — defines the complete directed graph of legal moves.
# ======================================================================

_TRANSITIONS: Dict[WorkOrderStatus, FrozenSet[WorkOrderStatus]] = {
    # DRAFT can only be submitted (→ PENDING) or cancelled.
    WorkOrderStatus.DRAFT: frozenset({
        WorkOrderStatus.PENDING,
        WorkOrderStatus.CANCELLED,
    }),
    # PENDING enters the first approval level or can be cancelled.
    WorkOrderStatus.PENDING: frozenset({
        WorkOrderStatus.APPROVING_LEVEL_1,
        WorkOrderStatus.CANCELLED,
    }),
    # Level-1 approval: pass → level-2, reject → REJECTED, or cancel.
    WorkOrderStatus.APPROVING_LEVEL_1: frozenset({
        WorkOrderStatus.APPROVING_LEVEL_2,
        WorkOrderStatus.REJECTED,
        WorkOrderStatus.CANCELLED,
    }),
    # Level-2 approval: pass → APPROVED, reject → REJECTED, or cancel.
    WorkOrderStatus.APPROVING_LEVEL_2: frozenset({
        WorkOrderStatus.APPROVED,
        WorkOrderStatus.REJECTED,
        WorkOrderStatus.CANCELLED,
    }),
    # Terminal states — no outgoing transitions.
    WorkOrderStatus.APPROVED: frozenset(),
    WorkOrderStatus.REJECTED: frozenset(),
    WorkOrderStatus.CANCELLED: frozenset(),
    # CLOSED is also terminal.
    WorkOrderStatus.CLOSED: frozenset(),
}

_TERMINAL_STATES: FrozenSet[WorkOrderStatus] = frozenset({
    WorkOrderStatus.APPROVED,
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.CANCELLED,
    WorkOrderStatus.CLOSED,
})


# ======================================================================
# Custom exception
# ======================================================================

class InvalidStateTransitionError(Exception):
    """Raised when an illegal work order state transition is attempted.

    Attributes:
        current: The status from which the transition was attempted.
        target: The status that was requested.
        reason: Human-readable explanation of why the transition is illegal.
    """

    def __init__(
        self,
        current: WorkOrderStatus,
        target: WorkOrderStatus,
        reason: str,
    ) -> None:
        """Initialise the exception with context about the failed transition.

        Args:
            current: The current (source) work order status.
            target: The desired (destination) work order status.
            reason: Description of why the transition is invalid.
        """
        self.current = current
        self.target = target
        self.reason = reason
        super().__init__(reason)