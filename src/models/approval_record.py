"""Approval Record domain model.

Provides the persistent storage layer for multi-level approval audit trails.
Each record captures a single approval action (approve / reject) performed by
an operator on a work order at a specific approval level.

State-machine flow supported:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Any approval node → REJECTED
    Any non-terminal state → CANCELLED
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base

if TYPE_CHECKING:
    from src.models.workorder import WorkOrder


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ApprovalAction(str, enum.Enum):
    """Enumeration of valid approval actions.

    Attributes:
        APPROVE: The operator approved the work order at the current level.
        REJECT:  The operator rejected the work order (requires a rejection reason).
    """

    APPROVE = "APPROVE"
    REJECT = "REJECT"


class ApprovalLevel(str, enum.Enum):
    """Enumeration of approval levels in the two-level approval chain.

    Attributes:
        LEVEL_1: Department manager (部门主管) approval gate.
        LEVEL_2: Asset administrator (资产管理员) approval gate.
    """

    LEVEL_1 = "LEVEL_1"
    LEVEL_2 = "LEVEL_2"


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Maximum allowed length for the rejection reason field (matches the API
#: constraint of 500 characters).
REJECTION_REASON_MAX_LENGTH: int = 500


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

class ApprovalRecord(Base):
    """Persistent audit record for a single approval action on a work order.

    Every time an operator approves or rejects a work order, an instance of
    this model is created.  The record is immutable after creation — no
    updates or deletions are expected through normal business flows.

    Attributes:
        id:               Unique surrogate primary key.
        order_id:         Foreign key referencing the associated work order.
        operator_id:      ID of the user who performed the approval action.
        action:           The action taken (APPROVE or REJECT).
        approval_level:   Which approval level this action belongs to.
        comment:          Optional free-text comment from the operator.
        rejection_reason: Mandatory reason when *action* is REJECT; must be
                          a non-empty string of at most 500 characters.
        created_at:       ISO-8601 timestamp of when the record was created.
        work_order:       ORM relationship to the parent :class:`WorkOrder`.
    """

    __tablename__ = "approval_records"

    # -- Primary key --------------------------------------------------------
    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
        comment="Unique surrogate primary key",
    )

    # -- Foreign keys -------------------------------------------------------
    order_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to the associated work order",
    )

    operator_id: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
        comment="ID of the user who performed the approval action",
    )

    # -- Business fields ----------------------------------------------------
    action: Mapped[ApprovalAction] = mapped_column(
        SAEnum(ApprovalAction, name="approval_action_enum", length=16),
        nullable=False,
        comment="Action performed: APPROVE or REJECT",
    )

    approval_level: Mapped[ApprovalLevel] = mapped_column(
        SAEnum(ApprovalLevel, name="approval_level_enum", length=16),
        nullable=False,
        comment="Approval level: LEVEL_1 (department manager) or LEVEL_2 (asset admin)",
    )

    comment: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Optional free-text comment from the operator",
    )

    rejection_reason: Mapped[Optional[str]] = mapped_column(
        String(REJECTION_REASON_MAX_LENGTH),
        nullable=True,
        comment="Mandatory non-empty reason when action is REJECT (max 500 chars)",
    )

    # -- Timestamps ---------------------------------------------------------
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="ISO-8601 creation timestamp",
    )

    # -- Relationships ------------------------------------------------------
    work_order: Mapped["WorkOrder"] = relationship(
        "WorkOrder",
        back_populates="approval_records",
        lazy="selectin",
    )

    # -- Indexes ------------------------------------------------------------
    __table_args__ = (
        Index(
            "ix_approval_records_order_action",
            "order_id",
            "action",
        ),
        Index(
            "ix_approval_records_order_level",
            "order_id",
            "approval_level",
        ),
        Index(
            "ix_approval_records_operator_created",
            "operator_id",
            "created_at",
        ),
    )

    # -- Validation helpers -------------------------------------------------

    def validate_rejection_reason(self) -> None:
        """Validate that the rejection reason is present and within limits.

        This method should be called before persisting a record whose
        :pyattr:`action` is :pyattr:`ApprovalAction.REJECT`.

        Raises:
            ValueError: If the rejection reason is ``None``, empty, or exceeds
                        :pydata:`REJECTION_REASON_MAX_LENGTH` characters.
        """
        if self.action != ApprovalAction.REJECT:
            return

        if not self.rejection_reason or not self.rejection_reason.strip():
            raise ValueError(
                "rejection_reason is required when action is REJECT "
                "and must be a non-empty string"
            )

        if len(self.rejection_reason) > REJECTION_REASON_MAX_LENGTH:
            raise ValueError(
                f"rejection_reason must not exceed "
                f"{REJECTION_REASON_MAX_LENGTH} characters "
                f"(got {len(self.rejection_reason)})"
            )

    # -- Convenience factory ------------------------------------------------

    @classmethod
    def create_for_approve(
        cls,
        *,
        order_id: int,
        operator_id: int,
        approval_level: ApprovalLevel,
        comment: Optional[str] = None,
    ) -> "ApprovalRecord":
        """Factory: create an APPROVE record.

        Args:
            order_id:       ID of the work order being approved.
            operator_id:    ID of the approving user.
            approval_level: The approval level at which approval occurs.
            comment:        Optional comment from the approver.

        Returns:
            A new :class:`ApprovalRecord` instance with ``action=APPROVE``.
        """
        return cls(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.APPROVE,
            approval_level=approval_level,
            comment=comment,
            rejection_reason=None,
        )

    @classmethod
    def create_for_reject(
        cls,
        *,
        order_id: int,
        operator_id: int,
        approval_level: ApprovalLevel,
        rejection_reason: str,
        comment: Optional[str] = None,
    ) -> "ApprovalRecord":
        """Factory: create a REJECT record with mandatory reason.

        Args:
            order_id:         ID of the work order being rejected.
            operator_id:      ID of the rejecting user.
            approval_level:   The approval level at which rejection occurs.
            rejection_reason: Non-empty reason string (max 500 chars).
            comment:          Optional additional comment.

        Returns:
            A new :class:`ApprovalRecord` instance with ``action=REJECT``.

        Raises:
            ValueError: If *rejection_reason* is empty or too long.
        """
        record = cls(
            order_id=order_id,
            operator_id=operator_id,
            action=ApprovalAction.REJECT,
            approval_level=approval_level,
            rejection_reason=rejection_reason,
            comment=comment,
        )
        record.validate_rejection_reason()
        return record

    # -- Serialization helpers ----------------------------------------------

    def to_dict(self) -> dict:
        """Serialize the record to a plain dictionary.

        Returns:
            A dictionary suitable for JSON serialization, with all
            datetime values in ISO-8601 format.
        """
        return {
            "id": self.id,
            "order_id": self.order_id,
            "operator_id": self.operator_id,
            "action": self.action.value if self.action else None,
            "approval_level": self.approval_level.value if self.approval_level else None,
            "comment": self.comment,
            "rejection_reason": self.rejection_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"<ApprovalRecord id={self.id} "
            f"order_id={self.order_id} "
            f"operator_id={self.operator_id} "
            f"action={self.action.value if self.action else None} "
            f"level={self.approval_level.value if self.approval_level else None}>"
        )