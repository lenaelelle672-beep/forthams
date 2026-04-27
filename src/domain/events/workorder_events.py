"""Domain events for work order lifecycle and multi-level approval flow.

This module defines all domain events emitted during work order state
transitions, including the two-level approval chain (department manager
→ asset administrator), rejection, and cancellation.

Event flow:
    PENDING ──► APPROVING_LEVEL_1 ──► APPROVING_LEVEL_2 ──► APPROVED
                  │                       │
                  └──► REJECTED ◄─────────┘
    Any non-terminal state ──► CANCELLED

All events are immutable dataclasses carrying the minimal context
required for audit trail persistence and downstream notification.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class WorkOrderEventType(str, Enum):
    """Enumeration of all work-order domain event types.

    Each value corresponds to a specific state transition or lifecycle
    action within the work-order approval flow.
    """

    # Lifecycle creation
    CREATED = "WORK_ORDER_CREATED"

    # Submission
    SUBMITTED = "WORK_ORDER_SUBMITTED"

    # Approval chain (forward)
    LEVEL1_APPROVED = "WORK_ORDER_LEVEL1_APPROVED"
    LEVEL2_APPROVED = "WORK_ORDER_LEVEL2_APPROVED"
    FULLY_APPROVED = "WORK_ORDER_FULLY_APPROVED"

    # Rejection (reverse)
    REJECTED = "WORK_ORDER_REJECTED"

    # Cancellation
    CANCELLED = "WORK_ORDER_CANCELLED"

    # Reopened (future extensibility)
    REOPENED = "WORK_ORDER_REOPENED"


class ApprovalLevel(str, Enum):
    """The two approval levels in the work-order approval chain."""

    LEVEL_1_DEPT_MANAGER = "LEVEL_1_DEPT_MANAGER"
    LEVEL_2_ASSET_ADMIN = "LEVEL_2_ASSET_ADMIN"


# ---------------------------------------------------------------------------
# Base Event
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkOrderEvent:
    """Abstract base domain event for work-order state changes.

    Attributes:
        event_id: Unique identifier for this event instance (UUID4).
        event_type: The specific type of event from ``WorkOrderEventType``.
        work_order_id: The ID of the work order this event relates to.
        operator_id: ID of the user who triggered the event.
        operator_name: Display name of the operator (for audit readability).
        occurred_at: ISO-8601 timestamp when the event was created.
        correlation_id: Optional correlation ID for tracing across services.
        metadata: Arbitrary key-value pairs for extensibility.
    """

    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    event_type: WorkOrderEventType = WorkOrderEventType.CREATED
    work_order_id: str = ""
    operator_id: str = ""
    operator_name: str = ""
    occurred_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    correlation_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Concrete Events — Lifecycle
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkOrderCreatedEvent(WorkOrderEvent):
    """Emitted when a new work order is first created (DRAFT state).

    Attributes:
        title: Short title of the work order.
        description: Detailed description of the work order request.
        applicant_id: ID of the user who created (owns) the work order.
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.CREATED, init=False
    )
    title: str = ""
    description: str = ""
    applicant_id: str = ""


@dataclass(frozen=True)
class WorkOrderSubmittedEvent(WorkOrderEvent):
    """Emitted when a work order is submitted for approval (DRAFT → PENDING).

    The work order enters the ``PENDING`` state and becomes visible to
    the first-level approver (department manager).
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.SUBMITTED, init=False
    )


# ---------------------------------------------------------------------------
# Concrete Events — Approval (Forward Flow)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkOrderApprovedEvent(WorkOrderEvent):
    """Emitted when a work order passes an approval level.

    Attributes:
        approval_level: Which approval level was just completed.
        previous_status: The status before this approval action.
        new_status: The status after this approval action.
        comment: Optional comment from the approver.
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.LEVEL1_APPROVED, init=False
    )
    approval_level: ApprovalLevel = ApprovalLevel.LEVEL_1_DEPT_MANAGER
    previous_status: str = ""
    new_status: str = ""
    comment: str = ""

    def __post_init__(self) -> None:
        """Derive the concrete event_type from the approval level."""
        type_map = {
            ApprovalLevel.LEVEL_1_DEPT_MANAGER: WorkOrderEventType.LEVEL1_APPROVED,
            ApprovalLevel.LEVEL_2_ASSET_ADMIN: WorkOrderEventType.LEVEL2_APPROVED,
        }
        # frozen=True requires object.__setattr__
        object.__setattr__(
            self, "event_type", type_map.get(self.approval_level, self.event_type)
        )


@dataclass(frozen=True)
class WorkOrderFullyApprovedEvent(WorkOrderEvent):
    """Emitted when a work order completes all approval levels (APPROVED).

    This is the terminal success event. The work order transitions from
    ``APPROVING_LEVEL_2`` to ``APPROVED``.
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.FULLY_APPROVED, init=False
    )
    comment: str = ""


# ---------------------------------------------------------------------------
# Concrete Events — Rejection (Reverse Flow)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkOrderRejectedEvent(WorkOrderEvent):
    """Emitted when a work order is rejected at any approval level.

    The work order transitions to ``REJECTED`` regardless of which
    approval level it was at.

    Attributes:
        rejection_reason: Mandatory reason for the rejection (max 500 chars).
        approval_level: The approval level at which rejection occurred.
        previous_status: The status before rejection.
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.REJECTED, init=False
    )
    rejection_reason: str = ""
    approval_level: ApprovalLevel = ApprovalLevel.LEVEL_1_DEPT_MANAGER
    previous_status: str = ""

    def __post_init__(self) -> None:
        """Validate that rejection_reason is non-empty and within length limit."""
        if not self.rejection_reason or not self.rejection_reason.strip():
            raise ValueError(
                "rejection_reason must be a non-empty string "
                "(max 500 characters) for WorkOrderRejectedEvent"
            )
        if len(self.rejection_reason) > 500:
            raise ValueError(
                f"rejection_reason exceeds maximum length of 500 characters "
                f"(got {len(self.rejection_reason)})"
            )


# ---------------------------------------------------------------------------
# Concrete Events — Cancellation
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkOrderCancelledEvent(WorkOrderEvent):
    """Emitted when a work order is cancelled by the applicant or system.

    Cancellation is allowed from any non-terminal state (PENDING,
    APPROVING_LEVEL_1, APPROVING_LEVEL_2).

    Attributes:
        cancel_reason: Optional reason for cancellation.
        previous_status: The status before cancellation.
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.CANCELLED, init=False
    )
    cancel_reason: str = ""
    previous_status: str = ""


# ---------------------------------------------------------------------------
# Concrete Events — Reopened (Future Extensibility)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WorkOrderReopenedEvent(WorkOrderEvent):
    """Emitted when a rejected work order is reopened for resubmission.

    Reserved for future phases; not part of Phase 1 scope.
    """

    event_type: WorkOrderEventType = field(
        default=WorkOrderEventType.REOPENED, init=False
    )
    reopen_reason: str = ""


# ---------------------------------------------------------------------------
# Event Factory Helpers
# ---------------------------------------------------------------------------

def create_submit_event(
    work_order_id: str,
    operator_id: str,
    operator_name: str = "",
    correlation_id: Optional[str] = None,
) -> WorkOrderSubmittedEvent:
    """Factory: create a ``WorkOrderSubmittedEvent``.

    Args:
        work_order_id: The ID of the work order being submitted.
        operator_id: ID of the user submitting the work order.
        operator_name: Display name of the submitter.
        correlation_id: Optional tracing correlation ID.

    Returns:
        A new ``WorkOrderSubmittedEvent`` instance.
    """
    return WorkOrderSubmittedEvent(
        work_order_id=work_order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        correlation_id=correlation_id,
    )


def create_approval_event(
    work_order_id: str,
    operator_id: str,
    approval_level: ApprovalLevel,
    previous_status: str,
    new_status: str,
    operator_name: str = "",
    comment: str = "",
    correlation_id: Optional[str] = None,
) -> WorkOrderApprovedEvent:
    """Factory: create a ``WorkOrderApprovedEvent`` for a specific approval level.

    Args:
        work_order_id: The ID of the work order being approved.
        operator_id: ID of the approver.
        approval_level: Which approval level was completed.
        previous_status: Status before approval.
        new_status: Status after approval.
        operator_name: Display name of the approver.
        comment: Optional approval comment.
        correlation_id: Optional tracing correlation ID.

    Returns:
        A new ``WorkOrderApprovedEvent`` instance.
    """
    return WorkOrderApprovedEvent(
        work_order_id=work_order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        approval_level=approval_level,
        previous_status=previous_status,
        new_status=new_status,
        comment=comment,
        correlation_id=correlation_id,
    )


def create_fully_approved_event(
    work_order_id: str,
    operator_id: str,
    operator_name: str = "",
    comment: str = "",
    correlation_id: Optional[str] = None,
) -> WorkOrderFullyApprovedEvent:
    """Factory: create a ``WorkOrderFullyApprovedEvent``.

    Args:
        work_order_id: The ID of the fully approved work order.
        operator_id: ID of the final (level-2) approver.
        operator_name: Display name of the approver.
        comment: Optional approval comment.
        correlation_id: Optional tracing correlation ID.

    Returns:
        A new ``WorkOrderFullyApprovedEvent`` instance.
    """
    return WorkOrderFullyApprovedEvent(
        work_order_id=work_order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        comment=comment,
        correlation_id=correlation_id,
    )


def create_rejection_event(
    work_order_id: str,
    operator_id: str,
    rejection_reason: str,
    approval_level: ApprovalLevel,
    previous_status: str,
    operator_name: str = "",
    correlation_id: Optional[str] = None,
) -> WorkOrderRejectedEvent:
    """Factory: create a ``WorkOrderRejectedEvent`` with validation.

    Args:
        work_order_id: The ID of the rejected work order.
        operator_id: ID of the rejecting approver.
        rejection_reason: Mandatory non-empty reason (max 500 chars).
        approval_level: The approval level at which rejection occurred.
        previous_status: Status before rejection.
        operator_name: Display name of the rejector.
        correlation_id: Optional tracing correlation ID.

    Returns:
        A new ``WorkOrderRejectedEvent`` instance.

    Raises:
        ValueError: If ``rejection_reason`` is empty or exceeds 500 chars.
    """
    return WorkOrderRejectedEvent(
        work_order_id=work_order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        rejection_reason=rejection_reason,
        approval_level=approval_level,
        previous_status=previous_status,
        correlation_id=correlation_id,
    )


def create_cancellation_event(
    work_order_id: str,
    operator_id: str,
    previous_status: str,
    cancel_reason: str = "",
    operator_name: str = "",
    correlation_id: Optional[str] = None,
) -> WorkOrderCancelledEvent:
    """Factory: create a ``WorkOrderCancelledEvent``.

    Args:
        work_order_id: The ID of the cancelled work order.
        operator_id: ID of the user cancelling the work order.
        previous_status: Status before cancellation.
        cancel_reason: Optional reason for cancellation.
        operator_name: Display name of the cancelling user.
        correlation_id: Optional tracing correlation ID.

    Returns:
        A new ``WorkOrderCancelledEvent`` instance.
    """
    return WorkOrderCancelledEvent(
        work_order_id=work_order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        previous_status=previous_status,
        cancel_reason=cancel_reason,
        correlation_id=correlation_id,
    )


# ---------------------------------------------------------------------------
# Event-to-dict serialization helpers
# ---------------------------------------------------------------------------

def event_to_dict(event: WorkOrderEvent) -> dict:
    """Serialize a ``WorkOrderEvent`` to a plain dictionary.

    Useful for persistence (e.g., writing to ``approval_records`` table)
    or for publishing to message queues.

    Args:
        event: Any ``WorkOrderEvent`` (or subclass) instance.

    Returns:
        A dictionary representation with all fields, including the
        ``occurred_at`` timestamp as an ISO-8601 string.
    """
    data = {}
    for key, value in event.__dict__.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
        elif isinstance(value, Enum):
            data[key] = value.value
        else:
            data[key] = value
    return data