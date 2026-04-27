"""
Work Order State Machine Module.

Implements the complete work order approval state machine with dual-level
approval chain: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED.

Supports rejection (with mandatory reason validation) and cancellation at
non-terminal states. Terminal states (APPROVED, REJECTED, CANCELLED) are
immutable — no further transitions are permitted.

State transitions are strictly enforced; cross-level jumps are prohibited.
"""

from __future__ import annotations

import enum
from typing import Dict, FrozenSet, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidStateTransitionError(Exception):
    """Raised when a state transition is not permitted by the state machine.

    This covers illegal source/destination pairs, cross-level jumps,
    and any action attempted from a terminal state.
    """

    def __init__(
        self,
        message: str,
        current_status: "WorkOrderStatus",
        action: "WorkOrderAction",
    ) -> None:
        self.current_status = current_status
        self.action = action
        super().__init__(message)


class RejectionReasonValidationError(Exception):
    """Raised when a rejection reason fails validation.

    A valid rejection reason must be a non-empty string with at least
    10 characters.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WorkOrderStatus(enum.Enum):
    """Enumeration of all possible work order statuses.

    Lifecycle:
        PENDING
          → APPROVING_LEVEL_1  (on submit)
          → CANCELLED           (on cancel)

        APPROVING_LEVEL_1
          → APPROVING_LEVEL_2   (on L1 approve)
          → REJECTED             (on L1 reject)
          → CANCELLED            (on cancel)

        APPROVING_LEVEL_2
          → APPROVED             (on L2 approve)
          → REJECTED             (on L2 reject)
          → CANCELLED            (on cancel)

    Terminal states: APPROVED, REJECTED, CANCELLED
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class WorkOrderAction(enum.Enum):
    """Enumeration of actions that can trigger state transitions.

    SUBMIT   – Applicant submits the work order for approval.
    APPROVE  – Approver approves at the current level.
    REJECT   – Approver rejects (requires rejection_reason).
    CANCEL   – Applicant or system cancels the work order.
    """

    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Minimum length for a rejection reason.
REJECTION_REASON_MIN_LENGTH: int = 10

#: States from which no further transitions are allowed.
TERMINAL_STATUSES: FrozenSet[WorkOrderStatus] = frozenset({
    WorkOrderStatus.APPROVED,
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.CANCELLED,
})

#: The canonical state transition table.
#: Maps (source_status, action) → destination_status.
_TRANSITION_TABLE: Dict[Tuple[WorkOrderStatus, WorkOrderAction], WorkOrderStatus] = {
    # PENDING → APPROVING_LEVEL_1 (submit)
    (WorkOrderStatus.PENDING, WorkOrderAction.SUBMIT): WorkOrderStatus.APPROVING_LEVEL_1,
    # PENDING → CANCELLED (cancel before submission)
    (WorkOrderStatus.PENDING, WorkOrderAction.CANCEL): WorkOrderStatus.CANCELLED,

    # APPROVING_LEVEL_1 → APPROVING_LEVEL_2 (L1 approve)
    (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderAction.APPROVE): WorkOrderStatus.APPROVING_LEVEL_2,
    # APPROVING_LEVEL_1 → REJECTED (L1 reject)
    (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderAction.REJECT): WorkOrderStatus.REJECTED,
    # APPROVING_LEVEL_1 → CANCELLED
    (WorkOrderStatus.APPROVING_LEVEL_1, WorkOrderAction.CANCEL): WorkOrderStatus.CANCELLED,

    # APPROVING_LEVEL_2 → APPROVED (L2 approve)
    (WorkOrderStatus.APPROVING_LEVEL_2, WorkOrderAction.APPROVE): WorkOrderStatus.APPROVED,
    # APPROVING_LEVEL_2 → REJECTED (L2 reject)
    (WorkOrderStatus.APPROVING_LEVEL_2, WorkOrderAction.REJECT): WorkOrderStatus.REJECTED,
    # APPROVING_LEVEL_2 → CANCELLED
    (WorkOrderStatus.APPROVING_LEVEL_2, WorkOrderAction.CANCEL): WorkOrderStatus.CANCELLED,
}

#: Set of actions that require a valid rejection reason.
_ACTIONS_REQUIRING_REJECTION_REASON: Set[WorkOrderAction] = {
    WorkOrderAction.REJECT,
}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_rejection_reason(reason: Optional[str]) -> str:
    """Validate that the rejection reason meets business constraints.

    Args:
        reason: The rejection reason provided by the approver.

    Returns:
        The validated (stripped) rejection reason string.

    Raises:
        RejectionReasonValidationError: If the reason is None, empty,
            whitespace-only, or shorter than
            ``REJECTION_REASON_MIN_LENGTH`` characters.
    """
    if reason is None:
        raise RejectionReasonValidationError(
            "Rejection reason is required and cannot be empty."
        )
    stripped = reason.strip()
    if not stripped:
        raise RejectionReasonValidationError(
            "Rejection reason is required and cannot be empty."
        )
    if len(stripped) < REJECTION_REASON_MIN_LENGTH:
        raise RejectionReasonValidationError(
            f"Rejection reason must be at least {REJECTION_REASON_MIN_LENGTH} "
            f"characters long (got {len(stripped)})."
        )
    return stripped


def is_terminal(status: WorkOrderStatus) -> bool:
    """Check whether the given status is a terminal (final) state.

    Args:
        status: The work order status to check.

    Returns:
        ``True`` if the status is terminal, ``False`` otherwise.
    """
    return status in TERMINAL_STATUSES


def get_allowed_actions(status: WorkOrderStatus) -> Set[WorkOrderAction]:
    """Return the set of actions permitted from the given status.

    Args:
        status: The current work order status.

    Returns:
        A set of :class:`WorkOrderAction` values that are valid from
        *status*.  Returns an empty set for terminal states.
    """
    if is_terminal(status):
        return set()
    return {
        action
        for (src, action) in _TRANSITION_TABLE
        if src == status
    }


def get_target_status(
    current: WorkOrderStatus,
    action: WorkOrderAction,
) -> Optional[WorkOrderStatus]:
    """Look up the target status for a given (current, action) pair.

    Args:
        current: The current work order status.
        action: The action to attempt.

    Returns:
        The destination :class:`WorkOrderStatus`, or ``None`` if the
        transition is not defined.
    """
    return _TRANSITION_TABLE.get((current, action))


# ---------------------------------------------------------------------------
# State Machine
# ---------------------------------------------------------------------------

class WorkOrderStateMachine:
    """Deterministic state machine governing work order lifecycle.

    Encapsulates the current status and exposes a :meth:`transition` method
    that validates and executes state changes according to the rigid
    transition table.

    The machine is **not** thread-safe by design; callers are responsible
    for external synchronisation when concurrent access is required.

    Args:
        initial_status: The starting status of the work order.
            Typically :attr:`WorkOrderStatus.PENDING`.

    Example::

        sm = WorkOrderStateMachine(WorkOrderStatus.PENDING)
        sm.transition(WorkOrderAction.SUBMIT)
        assert sm.current_status == WorkOrderStatus.APPROVING_LEVEL_1

        sm.transition(
            WorkOrderAction.REJECT,
            rejection_reason="Does not meet budget criteria.",
        )
        assert sm.current_status == WorkOrderStatus.REJECTED
    """

    def __init__(self, initial_status: WorkOrderStatus) -> None:
        """Initialise the state machine with the given status.

        Args:
            initial_status: The starting status for the work order.
        """
        self._status: WorkOrderStatus = initial_status

    # -- Properties ----------------------------------------------------------

    @property
    def current_status(self) -> WorkOrderStatus:
        """Return the current status of the work order.

        Returns:
            The current :class:`WorkOrderStatus`.
        """
        return self._status

    @property
    def is_terminal(self) -> bool:
        """Check whether the machine is in a terminal state.

        Returns:
            ``True`` if no further transitions are possible.
        """
        return is_terminal(self._status)

    @property
    def allowed_actions(self) -> Set[WorkOrderAction]:
        """Return the set of actions currently permitted.

        Returns:
            A set of :class:`WorkOrderAction` values.
        """
        return get_allowed_actions(self._status)

    # -- Core transition logic -----------------------------------------------

    def transition(
        self,
        action: WorkOrderAction,
        rejection_reason: Optional[str] = None,
    ) -> WorkOrderStatus:
        """Attempt a state transition driven by *action*.

        Validates:
        1. The current status is not terminal.
        2. The (current_status, action) pair exists in the transition table.
        3. If *action* is ``REJECT``, the *rejection_reason* is valid.

        Args:
            action: The action triggering the transition.
            rejection_reason: Mandatory when *action* is ``REJECT``.
                Must be a non-empty string of at least
                ``REJECTION_REASON_MIN_LENGTH`` characters.

        Returns:
            The new :class:`WorkOrderStatus` after the transition.

        Raises:
            InvalidStateTransitionError: If the transition is not permitted.
            RejectionReasonValidationError: If the rejection reason is
                invalid when rejecting.
        """
        # 1. Terminal-state guard
        if self.is_terminal:
            raise InvalidStateTransitionError(
                f"Cannot perform '{action.value}' from terminal state "
                f"'{self._status.value}'. Terminal states do not allow "
                f"further transitions.",
                current_status=self._status,
                action=action,
            )

        # 2. Transition existence guard
        target = get_target_status(self._status, action)
        if target is None:
            raise InvalidStateTransitionError(
                f"Transition from '{self._status.value}' via action "
                f"'{action.value}' is not defined. Permitted actions from "
                f"'{self._status.value}': "
                f"{[a.value for a in self.allowed_actions]}.",
                current_status=self._status,
                action=action,
            )

        # 3. Rejection-reason validation guard
        if action in _ACTIONS_REQUIRING_REJECTION_REASON:
            validate_rejection_reason(rejection_reason)

        # Execute the transition
        self._status = target
        return self._status

    def can_transition(self, action: WorkOrderAction) -> bool:
        """Check whether a given action is currently permitted.

        This is a non-mutating predicate — it does **not** validate
        rejection reasons.

        Args:
            action: The action to check.

        Returns:
            ``True`` if the action would be accepted by :meth:`transition`
            (ignoring rejection-reason validation).
        """
        return action in self.allowed_actions

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"WorkOrderStateMachine(current_status={self._status.value!r})"
        )

    def __eq__(self, other: object) -> bool:
        """Equality based on current status."""
        if not isinstance(other, WorkOrderStateMachine):
            return NotImplemented
        return self._status == other._status

    def __hash__(self) -> int:
        """Hash based on current status."""
        return hash(self._status)


# ---------------------------------------------------------------------------
# Backward-compatible aliases
# ---------------------------------------------------------------------------
# The test suite references `ApprovalStatus`, `ApprovalAction`,
# `ApprovalStateMachine`, and `InvalidStateTransitionError`.  We provide
# aliases so that both naming conventions work.

#: Alias for :class:`WorkOrderStatus` — used by the approval-chain test suite.
ApprovalStatus = WorkOrderStatus

#: Alias for :class:`WorkOrderAction` — used by the approval-chain test suite.
ApprovalAction = WorkOrderAction

#: Alias for :class:`WorkOrderStateMachine` — used by the approval-chain test suite.
ApprovalStateMachine = WorkOrderStateMachine