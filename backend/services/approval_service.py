"""
Approval Service Module
=======================

Provides the core approval workflow engine for work orders, implementing a
two-level approval chain:

    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
                  ↓                      ↓
              REJECTED                REJECTED

Terminal states: APPROVED, REJECTED, CANCELLED.

Key responsibilities:
- Enforce strict state-machine transitions (no cross-level skips).
- Validate rejection reasons (mandatory, >= 10 characters).
- Persist immutable approval records.
- Publish asynchronous ``ApprovalNotificationEvent`` for in-app notifications.
- Enforce role-based access: L1 → department manager, L2 → asset manager.
"""

from __future__ import annotations

import enum
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)


class ApprovalError(Exception):
    """Base exception for approval-service errors."""

    pass


class InvalidStateTransitionError(ApprovalError):
    """Raised when a state transition violates the state-machine rules."""

    def __init__(self, current: str, target: str, message: str = "") -> None:
        self.current = current
        self.target = target
        super().__init__(
            message
            or f"Invalid state transition from '{current}' to '{target}'."
        )


class RejectionReasonValidationError(ApprovalError):
    """Raised when the rejection reason fails validation."""

    def __init__(self, reason: str = "") -> None:
        super().__init__(
            reason or "Rejection reason is required and must be at least 10 characters."
        )


class PermissionDeniedError(ApprovalError):
    """Raised when the caller lacks the required role for an approval action."""

    def __init__(self, action: str, required_role: str) -> None:
        self.action = action
        self.required_role = required_role
        super().__init__(
            f"Permission denied: '{action}' requires role '{required_role}'."
        )


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ApprovalStatus(str, enum.Enum):
    """All possible states of a work order in the approval lifecycle."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, enum.Enum):
    """Actions that can be performed on a work order."""

    SUBMIT = "SUBMIT"
    APPROVE_LEVEL_1 = "APPROVE_LEVEL_1"
    APPROVE_LEVEL_2 = "APPROVE_LEVEL_2"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class ApprovalLevel(str, enum.Enum):
    """Approval level identifiers."""

    LEVEL_1 = "LEVEL_1"
    LEVEL_2 = "LEVEL_2"


# ---------------------------------------------------------------------------
# Role constants
# ---------------------------------------------------------------------------

ROLE_DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
ROLE_ASSET_MANAGER = "ASSET_MANAGER"

# Map each approval level to the role that is allowed to operate it.
LEVEL_ROLE_MAP: Dict[ApprovalLevel, str] = {
    ApprovalLevel.LEVEL_1: ROLE_DEPARTMENT_MANAGER,
    ApprovalLevel.LEVEL_2: ROLE_ASSET_MANAGER,
}

# ---------------------------------------------------------------------------
# State-machine transition table
# ---------------------------------------------------------------------------
# Each key is the *current* status. The value is a dict mapping the *action*
# to the *target* status.  Any (current, action) pair not present here is
# illegal and will raise ``InvalidStateTransitionError``.

_TRANSITIONS: Dict[ApprovalStatus, Dict[ApprovalAction, ApprovalStatus]] = {
    ApprovalStatus.PENDING: {
        ApprovalAction.SUBMIT: ApprovalStatus.APPROVING_LEVEL_1,
        ApprovalAction.CANCEL: ApprovalStatus.CANCELLED,
    },
    ApprovalStatus.APPROVING_LEVEL_1: {
        ApprovalAction.APPROVE_LEVEL_1: ApprovalStatus.APPROVING_LEVEL_2,
        ApprovalAction.REJECT: ApprovalStatus.REJECTED,
    },
    ApprovalStatus.APPROVING_LEVEL_2: {
        ApprovalAction.APPROVE_LEVEL_2: ApprovalStatus.APPROVED,
        ApprovalAction.REJECT: ApprovalStatus.REJECTED,
    },
}

# Terminal states – no further transitions are allowed.
_TERMINAL_STATES: frozenset[ApprovalStatus] = frozenset(
    {
        ApprovalStatus.APPROVED,
        ApprovalStatus.REJECTED,
        ApprovalStatus.CANCELLED,
    }
)


# ---------------------------------------------------------------------------
# Approval Record (immutable data class)
# ---------------------------------------------------------------------------


class ApprovalRecord:
    """A single, immutable approval-record entry.

    Attributes:
        id: Unique record identifier.
        order_id: The work order this record belongs to.
        approver_id: ID of the user who performed the action.
        action: The action taken (e.g. APPROVE_LEVEL_1, REJECT).
        approval_level: Which approval level this action belongs to.
        rejection_reason: Mandatory when *action* is REJECT; ``None`` otherwise.
        comment: Optional free-text comment from the approver.
        created_at: UTC timestamp of when the record was created.
    """

    __slots__ = (
        "id",
        "order_id",
        "approver_id",
        "action",
        "approval_level",
        "rejection_reason",
        "comment",
        "created_at",
    )

    def __init__(
        self,
        *,
        order_id: str,
        approver_id: str,
        action: ApprovalAction,
        approval_level: Optional[ApprovalLevel] = None,
        rejection_reason: Optional[str] = None,
        comment: Optional[str] = None,
        created_at: Optional[datetime] = None,
        record_id: Optional[str] = None,
    ) -> None:
        self.id: str = record_id or str(uuid.uuid4())
        self.order_id: str = order_id
        self.approver_id: str = approver_id
        self.action: ApprovalAction = action
        self.approval_level: Optional[ApprovalLevel] = approval_level
        self.rejection_reason: Optional[str] = rejection_reason
        self.comment: Optional[str] = comment
        self.created_at: datetime = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Return a plain-dict representation suitable for JSON serialization."""
        return {
            "id": self.id,
            "order_id": self.order_id,
            "approver_id": self.approver_id,
            "action": self.action.value,
            "approval_level": (
                self.approval_level.value if self.approval_level else None
            ),
            "rejection_reason": self.rejection_reason,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Notification Event
# ---------------------------------------------------------------------------


class ApprovalNotificationEvent:
    """Application event published after every approval action.

    This event is consumed asynchronously by ``ApprovalNotificationListener``
    to create in-app notification records.
    """

    __slots__ = ("event_id", "order_id", "action", "actor_id", "timestamp", "payload")

    def __init__(
        self,
        *,
        order_id: str,
        action: ApprovalAction,
        actor_id: str,
        new_status: ApprovalStatus,
        rejection_reason: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        self.event_id: str = str(uuid.uuid4())
        self.order_id: str = order_id
        self.action: ApprovalAction = action
        self.actor_id: str = actor_id
        self.timestamp: datetime = timestamp or datetime.now(timezone.utc)
        self.payload: Dict[str, Any] = {
            "order_id": order_id,
            "action": action.value,
            "actor_id": actor_id,
            "new_status": new_status.value,
            "rejection_reason": rejection_reason,
            "timestamp": self.timestamp.isoformat(),
        }


# ---------------------------------------------------------------------------
# Event bus (simple in-process pub/sub)
# ---------------------------------------------------------------------------


class ApprovalEventBus:
    """Lightweight, synchronous event bus for approval events.

    Listeners are callables that accept a single ``ApprovalNotificationEvent``.
    In production the listener should dispatch to an async task queue, but
    the bus itself does not block.
    """

    def __init__(self) -> None:
        self._listeners: List = []

    def subscribe(self, listener: Any) -> None:
        """Register a listener callable."""
        self._listeners.append(listener)

    def unsubscribe(self, listener: Any) -> None:
        """Remove a previously registered listener."""
        if listener in self._listeners:
            self._listeners.remove(listener)

    def publish(self, event: ApprovalNotificationEvent) -> None:
        """Publish an event to all registered listeners."""
        for listener in self._listeners:
            try:
                listener(event)
            except Exception:
                logger.exception(
                    "ApprovalEventBus: listener %s raised an exception",
                    getattr(listener, "__name__", repr(listener)),
                )


# Module-level default event bus instance.
_default_event_bus = ApprovalEventBus()


# ---------------------------------------------------------------------------
# Repository interface (to be implemented by the persistence layer)
# ---------------------------------------------------------------------------


class ApprovalRecordRepository:
    """Abstract repository for persisting and querying approval records.

    Concrete implementations (SQLAlchemy, Django ORM, etc.) must subclass
    this and implement all methods.
    """

    def save(self, record: ApprovalRecord) -> ApprovalRecord:
        """Persist a new approval record. Returns the saved record."""
        raise NotImplementedError

    def find_by_order_id(self, order_id: str) -> List[ApprovalRecord]:
        """Return all approval records for the given work order, ordered by
        ``created_at`` ascending."""
        raise NotImplementedError

    def count_by_order_id(self, order_id: str) -> int:
        """Return the total number of approval records for the work order."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Work Order query interface
# ---------------------------------------------------------------------------


class WorkOrderQuery:
    """Abstract interface for reading / updating work order state.

    Concrete implementations connect to the actual data store.
    """

    def get_status(self, order_id: str) -> ApprovalStatus:
        """Return the current status of the work order."""
        raise NotImplementedError

    def set_status(self, order_id: str, status: ApprovalStatus) -> None:
        """Update the work order status in the data store."""
        raise NotImplementedError

    def get_version(self, order_id: str) -> int:
        """Return the optimistic-lock version of the work order."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Approval Service
# ---------------------------------------------------------------------------


class ApprovalService:
    """Core service that orchestrates the two-level approval workflow.

    Usage::

        service = ApprovalService(
            order_query=my_order_query,
            record_repo=my_record_repo,
            event_bus=my_event_bus,
        )
        service.submit_for_approval("WO-001", applicant_id="user-001")
        service.approve("WO-001", approver_id="mgr-001", level=ApprovalLevel.LEVEL_1)
        service.approve("WO-001", approver_id="asset-001", level=ApprovalLevel.LEVEL_2)
    """

    # Minimum length for a rejection reason.
    REJECTION_REASON_MIN_LENGTH: int = 10

    def __init__(
        self,
        order_query: WorkOrderQuery,
        record_repo: ApprovalRecordRepository,
        event_bus: Optional[ApprovalEventBus] = None,
    ) -> None:
        self._order_query = order_query
        self._record_repo = record_repo
        self._event_bus = event_bus or _default_event_bus

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def submit_for_approval(
        self,
        order_id: str,
        applicant_id: str,
    ) -> ApprovalRecord:
        """Submit a work order for approval.

        Transitions the order from ``PENDING`` to ``APPROVING_LEVEL_1``.

        Args:
            order_id: The work order identifier.
            applicant_id: The user who is submitting the order.

        Returns:
            The persisted ``ApprovalRecord``.

        Raises:
            InvalidStateTransitionError: If the order is not in ``PENDING``.
        """
        current = self._order_query.get_status(order_id)
        target = self._resolve_target(current, ApprovalAction.SUBMIT)

        self._order_query.set_status(order_id, target)
        record = self._persist_record(
            order_id=order_id,
            actor_id=applicant_id,
            action=ApprovalAction.SUBMIT,
            comment="Work order submitted for approval.",
        )
        self._publish_event(
            order_id=order_id,
            action=ApprovalAction.SUBMIT,
            actor_id=applicant_id,
            new_status=target,
        )
        logger.info(
            "Order %s submitted for approval by %s → %s",
            order_id,
            applicant_id,
            target.value,
        )
        return record

    def approve(
        self,
        order_id: str,
        approver_id: str,
        level: ApprovalLevel,
        user_roles: Optional[List[str]] = None,
        comment: Optional[str] = None,
    ) -> ApprovalRecord:
        """Approve a work order at the given level.

        - ``LEVEL_1`` transitions ``APPROVING_LEVEL_1`` → ``APPROVING_LEVEL_2``.
        - ``LEVEL_2`` transitions ``APPROVING_LEVEL_2`` → ``APPROVED``.

        Args:
            order_id: The work order identifier.
            approver_id: The user performing the approval.
            level: Which approval level (LEVEL_1 or LEVEL_2).
            user_roles: List of roles held by *approver_id*.  Used for
                permission enforcement.  If ``None``, permission checks are
                skipped (useful for internal / system calls).
            comment: Optional approval comment.

        Returns:
            The persisted ``ApprovalRecord``.

        Raises:
            InvalidStateTransitionError: If the current status does not match
                the expected status for the given *level*.
            PermissionDeniedError: If *user_roles* does not contain the
                required role for *level*.
        """
        # Map level → action
        action = self._level_to_action(level)

        # Permission check
        if user_roles is not None:
            required_role = LEVEL_ROLE_MAP[level]
            if required_role not in user_roles:
                raise PermissionDeniedError(
                    action=action.value, required_role=required_role
                )

        current = self._order_query.get_status(order_id)
        target = self._resolve_target(current, action)

        self._order_query.set_status(order_id, target)
        record = self._persist_record(
            order_id=order_id,
            actor_id=approver_id,
            action=action,
            approval_level=level,
            comment=comment,
        )
        self._publish_event(
            order_id=order_id,
            action=action,
            actor_id=approver_id,
            new_status=target,
        )
        logger.info(
            "Order %s approved at %s by %s → %s",
            order_id,
            level.value,
            approver_id,
            target.value,
        )
        return record

    def reject(
        self,
        order_id: str,
        approver_id: str,
        rejection_reason: str,
        user_roles: Optional[List[str]] = None,
    ) -> ApprovalRecord:
        """Reject a work order.

        The order must be in ``APPROVING_LEVEL_1`` or ``APPROVING_LEVEL_2``.
        After rejection the order moves to ``REJECTED`` (terminal state).

        Args:
            order_id: The work order identifier.
            approver_id: The user performing the rejection.
            rejection_reason: Mandatory reason string (>= 10 characters).
            user_roles: Optional list of roles for permission enforcement.

        Returns:
            The persisted ``ApprovalRecord``.

        Raises:
            InvalidStateTransitionError: If the order is not in an approvable
                state.
            RejectionReasonValidationError: If *rejection_reason* is empty
                or shorter than ``REJECTION_REASON_MIN_LENGTH``.
        """
        self._validate_rejection_reason(rejection_reason)

        current = self._order_query.get_status(order_id)
        target = self._resolve_target(current, ApprovalAction.REJECT)

        # Determine which level the rejection happened at for the record.
        approval_level: Optional[ApprovalLevel] = None
        if current == ApprovalStatus.APPROVING_LEVEL_1:
            approval_level = ApprovalLevel.LEVEL_1
        elif current == ApprovalStatus.APPROVING_LEVEL_2:
            approval_level = ApprovalLevel.LEVEL_2

        # Permission check
        if user_roles is not None and approval_level is not None:
            required_role = LEVEL_ROLE_MAP[approval_level]
            if required_role not in user_roles:
                raise PermissionDeniedError(
                    action="REJECT", required_role=required_role
                )

        self._order_query.set_status(order_id, target)
        record = self._persist_record(
            order_id=order_id,
            actor_id=approver_id,
            action=ApprovalAction.REJECT,
            approval_level=approval_level,
            rejection_reason=rejection_reason,
        )
        self._publish_event(
            order_id=order_id,
            action=ApprovalAction.REJECT,
            actor_id=approver_id,
            new_status=target,
            rejection_reason=rejection_reason,
        )
        logger.info(
            "Order %s rejected at %s by %s. Reason: %s",
            order_id,
            approval_level.value if approval_level else "N/A",
            approver_id,
            rejection_reason,
        )
        return record

    def cancel(
        self,
        order_id: str,
        user_id: str,
    ) -> ApprovalRecord:
        """Cancel a work order that is still in ``PENDING`` status.

        Args:
            order_id: The work order identifier.
            user_id: The user requesting cancellation.

        Returns:
            The persisted ``ApprovalRecord``.

        Raises:
            InvalidStateTransitionError: If the order is not ``PENDING``.
        """
        current = self._order_query.get_status(order_id)
        target = self._resolve_target(current, ApprovalAction.CANCEL)

        self._order_query.set_status(order_id, target)
        record = self._persist_record(
            order_id=order_id,
            actor_id=user_id,
            action=ApprovalAction.CANCEL,
            comment="Work order cancelled by applicant.",
        )
        self._publish_event(
            order_id=order_id,
            action=ApprovalAction.CANCEL,
            actor_id=user_id,
            new_status=target,
        )
        logger.info("Order %s cancelled by %s", order_id, user_id)
        return record

    def get_approval_history(self, order_id: str) -> List[ApprovalRecord]:
        """Return the full approval history for a work order.

        Args:
            order_id: The work order identifier.

        Returns:
            A list of ``ApprovalRecord`` instances ordered chronologically.
        """
        return self._record_repo.find_by_order_id(order_id)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _level_to_action(level: ApprovalLevel) -> ApprovalAction:
        """Map an ``ApprovalLevel`` to the corresponding ``ApprovalAction``."""
        mapping = {
            ApprovalLevel.LEVEL_1: ApprovalAction.APPROVE_LEVEL_1,
            ApprovalLevel.LEVEL_2: ApprovalAction.APPROVE_LEVEL_2,
        }
        action = mapping.get(level)
        if action is None:
            raise ApprovalError(f"Unknown approval level: {level}")
        return action

    @staticmethod
    def _resolve_target(
        current: ApprovalStatus,
        action: ApprovalAction,
    ) -> ApprovalStatus:
        """Determine the target status for a (current, action) pair.

        Raises:
            InvalidStateTransitionError: If the transition is not allowed.
        """
        if current in _TERMINAL_STATES:
            raise InvalidStateTransitionError(
                current=current.value,
                target="N/A",
                message=f"Order is in terminal state '{current.value}'; no further transitions allowed.",
            )

        allowed = _TRANSITIONS.get(current)
        if allowed is None:
            raise InvalidStateTransitionError(
                current=current.value,
                target="N/A",
                message=f"No transitions defined from state '{current.value}'.",
            )

        target = allowed.get(action)
        if target is None:
            raise InvalidStateTransitionError(
                current=current.value,
                target="N/A",
                message=f"Action '{action.value}' is not allowed from state '{current.value}'.",
            )
        return target

    def _validate_rejection_reason(self, reason: str) -> None:
        """Validate that the rejection reason meets business constraints.

        Args:
            reason: The rejection reason string.

        Raises:
            RejectionReasonValidationError: If validation fails.
        """
        if not reason or not isinstance(reason, str):
            raise RejectionReasonValidationError(
                "Rejection reason is required and must be a non-empty string."
            )
        stripped = reason.strip()
        if len(stripped) < self.REJECTION_REASON_MIN_LENGTH:
            raise RejectionReasonValidationError(
                f"Rejection reason must be at least {self.REJECTION_REASON_MIN_LENGTH} "
                f"characters long (got {len(stripped)})."
            )

    def _persist_record(
        self,
        *,
        order_id: str,
        actor_id: str,
        action: ApprovalAction,
        approval_level: Optional[ApprovalLevel] = None,
        rejection_reason: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> ApprovalRecord:
        """Create and persist an immutable approval record.

        Returns:
            The saved ``ApprovalRecord``.
        """
        record = ApprovalRecord(
            order_id=order_id,
            approver_id=actor_id,
            action=action,
            approval_level=approval_level,
            rejection_reason=rejection_reason,
            comment=comment,
        )
        return self._record_repo.save(record)

    def _publish_event(
        self,
        *,
        order_id: str,
        action: ApprovalAction,
        actor_id: str,
        new_status: ApprovalStatus,
        rejection_reason: Optional[str] = None,
    ) -> None:
        """Publish an ``ApprovalNotificationEvent`` to the event bus.

        The event bus dispatches to listeners without blocking the caller.
        """
        event = ApprovalNotificationEvent(
            order_id=order_id,
            action=action,
            actor_id=actor_id,
            new_status=new_status,
            rejection_reason=rejection_reason,
        )
        self._event_bus.publish(event)
        logger.debug(
            "Published ApprovalNotificationEvent %s for order %s",
            event.event_id,
            order_id,
        )


# ---------------------------------------------------------------------------
# Convenience: get the module-level default event bus
# ---------------------------------------------------------------------------


def get_default_event_bus() -> ApprovalEventBus:
    """Return the module-level default ``ApprovalEventBus`` instance.

    This is useful for registering global listeners (e.g. the
    ``ApprovalNotificationListener``) at application startup.
    """
    return _default_event_bus