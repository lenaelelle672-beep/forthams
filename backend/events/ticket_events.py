"""Ticket / Work-Order approval event definitions.

This module provides the event classes that power the event-driven approval
notification mechanism for the multi-level ticket approval workflow.

Supported state flow::

    PENDING
      → APPROVING_LEVEL_1  (submit)
        → APPROVING_LEVEL_2  (L1 approve)
          → APPROVED          (L2 approve)
        → REJECTED            (L1 reject)
      → CANCELLED             (applicant cancel)

All events are **immutable data-classes**.  Once created they must not be
mutated, ensuring audit-trail integrity.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class TicketStatus(str, enum.Enum):
    """All possible states of a ticket / work-order in the approval chain.

    The state machine enforces strict forward-only transitions (except for
    terminal states REJECTED and CANCELLED which have no outgoing edges).
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class TicketEventType(str, enum.Enum):
    """Domain event types emitted during ticket lifecycle transitions."""

    SUBMITTED = "SUBMITTED"
    """Ticket created and waiting for Level-1 (department manager) approval."""

    LEVEL1_APPROVED = "LEVEL1_APPROVED"
    """Department manager approved; ticket moves to Level-2."""

    LEVEL2_APPROVED = "LEVEL2_APPROVED"
    """Asset manager approved; ticket is fully approved."""

    REJECTED = "REJECTED"
    """An approver rejected the ticket (terminal state)."""

    CANCELLED = "CANCELLED"
    """Applicant cancelled the ticket (terminal state)."""


# ---------------------------------------------------------------------------
# Base event
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TicketEvent:
    """Immutable base class for all ticket-related domain events.

    Attributes:
        ticket_id: Unique identifier of the affected ticket / work-order.
        event_type: The specific type of lifecycle event.
        previous_status: Status before the transition.
        current_status: Status after the transition.
        operator_id: ID of the user who triggered the transition.
        operator_role: Role of the operator (e.g. ``DEPT_MANAGER``,
            ``ASSET_MANAGER``, ``APPLICANT``).
        timestamp: When the event occurred (UTC).
        payload: Optional extra metadata attached to the event.
    """

    ticket_id: str
    event_type: TicketEventType
    previous_status: TicketStatus
    current_status: TicketStatus
    operator_id: str
    operator_role: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    payload: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Concrete events
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TicketSubmittedEvent(TicketEvent):
    """Emitted when a ticket is first submitted for approval.

    The ticket transitions from *DRAFT* (or directly created) into
    ``PENDING`` status.
    """

    event_type: TicketEventType = field(
        default=TicketEventType.SUBMITTED, init=False,
    )


@dataclass(frozen=True)
class TicketLevel1ApprovedEvent(TicketEvent):
    """Emitted when the department manager (Level-1) approves a ticket.

    The ticket transitions from ``APPROVING_LEVEL_1`` to
    ``APPROVING_LEVEL_2``.
    """

    event_type: TicketEventType = field(
        default=TicketEventType.LEVEL1_APPROVED, init=False,
    )


@dataclass(frozen=True)
class TicketLevel2ApprovedEvent(TicketEvent):
    """Emitted when the asset manager (Level-2) approves a ticket.

    The ticket transitions from ``APPROVING_LEVEL_2`` to ``APPROVED``
    (terminal).
    """

    event_type: TicketEventType = field(
        default=TicketEventType.LEVEL2_APPROVED, init=False,
    )


@dataclass(frozen=True)
class TicketRejectedEvent(TicketEvent):
    """Emitted when an approver rejects a ticket.

    The ticket transitions into ``REJECTED`` (terminal state).

    Attributes:
        rejection_reason: Mandatory reason provided by the rejecting approver.
            Must be non-empty and at least 10 characters long.
        approval_level: Which approval level performed the rejection
            (``1`` or ``2``).
    """

    rejection_reason: str = ""
    approval_level: int = 1

    event_type: TicketEventType = field(
        default=TicketEventType.REJECTED, init=False,
    )

    def __post_init__(self) -> None:
        """Validate that the rejection reason meets business constraints.

        Raises:
            ValueError: If *rejection_reason* is empty or shorter than 10
                characters.
        """
        if not self.rejection_reason or len(self.rejection_reason.strip()) < 10:
            raise ValueError(
                "rejection_reason is required and must be at least "
                "10 characters long"
            )


@dataclass(frozen=True)
class TicketCancelledEvent(TicketEvent):
    """Emitted when the applicant cancels a pending ticket.

    The ticket transitions into ``CANCELLED`` (terminal state).
    """

    event_type: TicketEventType = field(
        default=TicketEventType.CANCELLED, init=False,
    )


# ---------------------------------------------------------------------------
# Notification event (consumed by async listeners)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ApprovalNotificationEvent:
    """Event dispatched to the async notification subsystem.

    This is **not** a domain lifecycle event but rather an integration event
    that carries the information needed to create an in-app notification for
    relevant users.

    Attributes:
        ticket_id: The ticket that triggered the notification.
        recipient_id: Target user who should receive the notification.
        notification_type: Category of notification (e.g. ``APPROVAL_REQUEST``,
            ``APPROVED``, ``REJECTED``).
        title: Short human-readable title.
        message: Detailed message body.
        related_event: The original :class:`TicketEvent` that caused this
            notification.
        created_at: Timestamp of notification creation.
    """

    ticket_id: str
    recipient_id: str
    notification_type: str
    title: str
    message: str
    related_event: TicketEvent
    created_at: datetime = field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Factory helpers
# ---------------------------------------------------------------------------

def build_notification_for_submitter(
    event: TicketEvent,
    *,
    submitter_id: str,
) -> ApprovalNotificationEvent:
    """Create an in-app notification for the ticket submitter.

    Args:
        event: The ticket lifecycle event that occurred.
        submitter_id: User-ID of the person who originally submitted the
            ticket.

    Returns:
        A ready-to-dispatch :class:`ApprovalNotificationEvent`.
    """
    _TYPE_LABELS = {
        TicketEventType.SUBMITTED: "工单已提交",
        TicketEventType.LEVEL1_APPROVED: "一级审批通过",
        TicketEventType.LEVEL2_APPROVED: "工单已批准",
        TicketEventType.REJECTED: "工单被驳回",
        TicketEventType.CANCELLED: "工单已取消",
    }

    label = _TYPE_LABELS.get(event.event_type, "工单状态变更")
    message = (
        f"工单 {event.ticket_id} 状态已更新："
        f"{event.previous_status.value} → {event.current_status.value}"
    )

    if isinstance(event, TicketRejectedEvent):
        message += f"。驳回原因：{event.rejection_reason}"

    return ApprovalNotificationEvent(
        ticket_id=event.ticket_id,
        recipient_id=submitter_id,
        notification_type=event.event_type.value,
        title=label,
        message=message,
        related_event=event,
    )


def build_notification_for_next_approver(
    event: TicketEvent,
    *,
    next_approver_id: str,
) -> ApprovalNotificationEvent:
    """Create an in-app notification for the next approver in the chain.

    This is typically called after a Level-1 approval to notify the Level-2
    (asset manager) approver.

    Args:
        event: The ticket lifecycle event (expected to be
            :class:`TicketLevel1ApprovedEvent`).
        next_approver_id: User-ID of the next approver.

    Returns:
        A ready-to-dispatch :class:`ApprovalNotificationEvent`.
    """
    return ApprovalNotificationEvent(
        ticket_id=event.ticket_id,
        recipient_id=next_approver_id,
        notification_type="APPROVAL_REQUEST",
        title="待审批通知",
        message=(
            f"工单 {event.ticket_id} 已通过一级审批，"
            f"请进行二级（资产管理员）审批。"
        ),
        related_event=event,
    )


# ---------------------------------------------------------------------------
# Status transition validator
# ---------------------------------------------------------------------------

# Maps each event type to the (source, target) status pair it produces.
_EVENT_TRANSITIONS: dict[TicketEventType, tuple[TicketStatus, TicketStatus]] = {
    TicketEventType.SUBMITTED: (
        TicketStatus.PENDING,
        TicketStatus.APPROVING_LEVEL_1,
    ),
    TicketEventType.LEVEL1_APPROVED: (
        TicketStatus.APPROVING_LEVEL_1,
        TicketStatus.APPROVING_LEVEL_2,
    ),
    TicketEventType.LEVEL2_APPROVED: (
        TicketStatus.APPROVING_LEVEL_2,
        TicketStatus.APPROVED,
    ),
    TicketEventType.REJECTED: (
        TicketStatus.APPROVING_LEVEL_1,  # may also be LEVEL_2
        TicketStatus.REJECTED,
    ),
    TicketEventType.CANCELLED: (
        TicketStatus.PENDING,
        TicketStatus.CANCELLED,
    ),
}

# Terminal states – no outgoing transitions allowed.
_TERMINAL_STATUSES: frozenset[TicketStatus] = frozenset({
    TicketStatus.APPROVED,
    TicketStatus.REJECTED,
    TicketStatus.CANCELLED,
})


def validate_transition(
    event_type: TicketEventType,
    current_status: TicketStatus,
) -> tuple[TicketStatus, TicketStatus]:
    """Validate that a transition is legal and return the target status.

    Args:
        event_type: The event that would trigger the transition.
        current_status: The ticket's current status.

    Returns:
        A ``(source, target)`` tuple if the transition is valid.

    Raises:
        ValueError: If the transition is not allowed (e.g. cross-level
            approval, transition from a terminal state, or unknown event).
    """
    if current_status in _TERMINAL_STATUSES:
        raise ValueError(
            f"Cannot transition from terminal state '{current_status.value}'"
        )

    expected_source, target = _EVENT_TRANSITIONS.get(event_type, (None, None))

    if expected_source is None:
        raise ValueError(f"Unknown event type: {event_type}")

    # REJECTED can originate from either APPROVING_LEVEL_1 or APPROVING_LEVEL_2
    if event_type == TicketEventType.REJECTED:
        if current_status not in (
            TicketStatus.APPROVING_LEVEL_1,
            TicketStatus.APPROVING_LEVEL_2,
        ):
            raise ValueError(
                f"Reject is only allowed from APPROVING_LEVEL_1 or "
                f"APPROVING_LEVEL_2, got '{current_status.value}'"
            )
        return (current_status, TicketStatus.REJECTED)

    if current_status != expected_source:
        raise ValueError(
            f"Invalid transition: event '{event_type.value}' requires "
            f"source status '{expected_source.value}', but current status "
            f"is '{current_status.value}'"
        )

    return (expected_source, target)