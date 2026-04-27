"""
Work Order domain model with multi-level approval state machine.

This module defines the WorkOrder ORM model and WorkOrderStatus enum
supporting the approval workflow:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

With reverse transitions to REJECTED from any approval node,
and support for CANCELLED state.

Optimistic locking is enforced via the ``version`` field to prevent
concurrent approval conflicts.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base


# ---------------------------------------------------------------------------
# Enum: WorkOrderStatus
# ---------------------------------------------------------------------------

class WorkOrderStatus(str, enum.Enum):
    """Enumeration of valid work order statuses for the approval state machine.

    Forward flow:
        PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

    Reverse flow (from any approval node):
        APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED

    Terminal / special:
        CANCELLED — the applicant cancels the order before completion.
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# ---------------------------------------------------------------------------
# Enum: ApprovalAction
# ---------------------------------------------------------------------------

class ApprovalAction(str, enum.Enum):
    """Enumeration of actions that can be recorded in an approval record."""

    SUBMIT = "SUBMIT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


# ---------------------------------------------------------------------------
# State transition map (authoritative source of truth)
# ---------------------------------------------------------------------------

# Maps (current_status, action) → next_status.
# Any transition not present here is considered illegal and must be rejected
# by the backend state machine with HTTP 409 / INVALID_STATE_TRANSITION.
VALID_TRANSITIONS: dict[tuple[WorkOrderStatus, ApprovalAction], WorkOrderStatus] = {
    # Forward approval flow
    (WorkOrderStatus.PENDING, ApprovalAction.SUBMIT): WorkOrderStatus.APPROVING_LEVEL_1,
    (WorkOrderStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE): WorkOrderStatus.APPROVING_LEVEL_2,
    (WorkOrderStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE): WorkOrderStatus.APPROVED,
    # Reverse / rejection flow
    (WorkOrderStatus.APPROVING_LEVEL_1, ApprovalAction.REJECT): WorkOrderStatus.REJECTED,
    (WorkOrderStatus.APPROVING_LEVEL_2, ApprovalAction.REJECT): WorkOrderStatus.REJECTED,
    # Cancellation (applicant-initiated)
    (WorkOrderStatus.PENDING, ApprovalAction.CANCEL): WorkOrderStatus.CANCELLED,
    (WorkOrderStatus.APPROVING_LEVEL_1, ApprovalAction.CANCEL): WorkOrderStatus.CANCELLED,
    (WorkOrderStatus.APPROVING_LEVEL_2, ApprovalAction.CANCEL): WorkOrderStatus.CANCELLED,
}


def is_valid_transition(
    current_status: WorkOrderStatus,
    action: ApprovalAction,
) -> bool:
    """Check whether a state transition is legal.

    Args:
        current_status: The current status of the work order.
        action: The action being attempted.

    Returns:
        True if the transition is defined in ``VALID_TRANSITIONS``, False otherwise.
    """
    return (current_status, action) in VALID_TRANSITIONS


def get_next_status(
    current_status: WorkOrderStatus,
    action: ApprovalAction,
) -> Optional[WorkOrderStatus]:
    """Return the target status for a given transition, or None if illegal.

    Args:
        current_status: The current status of the work order.
        action: The action being attempted.

    Returns:
        The next ``WorkOrderStatus`` if the transition is valid, else ``None``.
    """
    return VALID_TRANSITIONS.get((current_status, action))


# ---------------------------------------------------------------------------
# ORM Model: WorkOrder
# ---------------------------------------------------------------------------

class WorkOrder(Base):
    """SQLAlchemy ORM model for the ``work_order`` table.

    Attributes:
        id: Primary key (UUID v4).
        order_no: Human-readable order number (unique).
        title: Brief description of the work order.
        description: Detailed description / justification.
        applicant_id: FK to the user who created the order.
        status: Current status in the approval state machine.
        version: Optimistic-lock version counter; incremented on every update.
        rejection_reason: Reason provided when the order is rejected (max 500 chars).
        is_critical: Whether this order is flagged as high-priority.
        created_at: Timestamp when the order was created (ISO 8601).
        updated_at: Timestamp of the last update (ISO 8601).
        approval_records: One-to-many relationship to ``ApprovalRecord``.
    """

    __tablename__ = "work_order"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_no: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        comment="Human-readable order number, e.g. WO-20250101-0001",
    )
    title: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        comment="Brief title of the work order",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed description or justification",
    )
    applicant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="ID of the user who submitted the order",
    )
    status: Mapped[WorkOrderStatus] = mapped_column(
        Enum(WorkOrderStatus, name="work_order_status", native_enum=False),
        nullable=False,
        default=WorkOrderStatus.PENDING,
        comment="Current status in the approval state machine",
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Optimistic-lock version; incremented on every state change",
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Reason for rejection (required when status is REJECTED)",
    )
    is_critical: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether this work order is flagged as high-priority",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Order creation timestamp (ISO 8601)",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="Last update timestamp (ISO 8601)",
    )

    # -- Relationships -------------------------------------------------------
    approval_records: Mapped[list[ApprovalRecord]] = relationship(
        "ApprovalRecord",
        back_populates="work_order",
        lazy="select",
        order_by="ApprovalRecord.created_at",
    )

    # -- Helper methods ------------------------------------------------------

    def can_transition(self, action: ApprovalAction) -> bool:
        """Check whether the work order can accept the given action.

        Args:
            action: The approval action to validate.

        Returns:
            True if the transition is legal per ``VALID_TRANSITIONS``.
        """
        return is_valid_transition(self.status, action)

    def transition(self, action: ApprovalAction, rejection_reason: Optional[str] = None) -> WorkOrderStatus:
        """Attempt to advance the work order state machine.

        Args:
            action: The approval action to execute.
            rejection_reason: Required when *action* is ``REJECT``; must be a
                non-empty string with at most 500 characters.

        Returns:
            The new ``WorkOrderStatus`` after the transition.

        Raises:
            ValueError: If the transition is illegal or if ``rejection_reason``
                is missing/invalid for a reject action.
        """
        next_status = get_next_status(self.status, action)
        if next_status is None:
            raise ValueError(
                f"Invalid state transition: {self.status.value} + {action.value}"
            )

        # Enforce rejection reason constraint
        if action == ApprovalAction.REJECT:
            if not rejection_reason or not rejection_reason.strip():
                raise ValueError(
                    "rejection_reason is required and must be a non-empty string "
                    "when rejecting a work order"
                )
            if len(rejection_reason) > 500:
                raise ValueError(
                    "rejection_reason must not exceed 500 characters"
                )
            self.rejection_reason = rejection_reason.strip()

        self.status = next_status
        self.version += 1
        return self.status

    def to_dict(self) -> dict:
        """Serialize the work order to a plain dictionary for API responses.

        Returns:
            A dictionary representation with ISO 8601 date strings.
        """
        return {
            "id": str(self.id),
            "order_no": self.order_no,
            "title": self.title,
            "description": self.description,
            "applicant_id": str(self.applicant_id) if self.applicant_id else None,
            "status": self.status.value,
            "version": self.version,
            "rejection_reason": self.rejection_reason,
            "is_critical": self.is_critical,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<WorkOrder id={self.id!s} order_no={self.order_no!r} "
            f"status={self.status.value} version={self.version}>"
        )


# ---------------------------------------------------------------------------
# ORM Model: ApprovalRecord
# ---------------------------------------------------------------------------

class ApprovalRecord(Base):
    """SQLAlchemy ORM model for the ``approval_record`` table.

    Each row represents a single approval action taken on a work order,
    providing a full audit trail of who did what and when.

    Attributes:
        id: Primary key (UUID v4).
        order_id: FK to the ``work_order`` this record belongs to.
        operator_id: FK to the user who performed the action.
        action: The action taken (SUBMIT / APPROVE / REJECT / CANCEL).
        comment: Optional free-text comment (e.g. rejection reason).
        created_at: Timestamp when the action was performed (ISO 8601).
        work_order: Back-reference to the parent ``WorkOrder``.
    """

    __tablename__ = "approval_record"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_order.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK to the work order being acted upon",
    )
    operator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="ID of the user who performed this action",
    )
    action: Mapped[ApprovalAction] = mapped_column(
        Enum(ApprovalAction, name="approval_action", native_enum=False),
        nullable=False,
        comment="The action performed on the work order",
    )
    comment: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Optional comment, e.g. rejection reason",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Timestamp when this action was performed (ISO 8601)",
    )

    # -- Relationships -------------------------------------------------------
    work_order: Mapped[WorkOrder] = relationship(
        "WorkOrder",
        back_populates="approval_records",
    )

    def to_dict(self) -> dict:
        """Serialize the approval record to a plain dictionary.

        Returns:
            A dictionary representation with ISO 8601 date strings.
        """
        return {
            "id": str(self.id),
            "order_id": str(self.order_id),
            "operator_id": str(self.operator_id) if self.operator_id else None,
            "action": self.action.value,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<ApprovalRecord id={self.id!s} order_id={self.order_id!s} "
            f"action={self.action.value}>"
        )