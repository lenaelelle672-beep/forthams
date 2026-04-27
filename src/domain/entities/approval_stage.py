"""
Approval Stage Domain Entity.

Represents a single approval node within the multi-level approval chain
for a work order.  Each work order progresses through exactly two stages:

  * **Level 1** – Department Manager (部门主管)
  * **Level 2** – Asset Manager (资产管理员)

The entity captures the operator identity, action taken, timestamp, and
an optional rejection reason.  It is designed to be persisted alongside
the work order as an immutable audit record once the stage is completed.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ApprovalStageLevel(int, Enum):
    """Ordinal level of an approval stage in the chain."""

    LEVEL_1 = 1  # Department Manager (部门主管)
    LEVEL_2 = 2  # Asset Manager (资产管理员)


class ApprovalStageStatus(str, Enum):
    """Current status of a single approval stage."""

    PENDING = "PENDING"          # Awaiting action
    APPROVED = "APPROVED"        # Approved by the responsible approver
    REJECTED = "REJECTED"        # Rejected (rejection_reason must be set)
    SKIPPED = "SKIPPED"          # Bypassed (e.g. auto-approval edge-case)


class ApprovalAction(str, Enum):
    """Action performed by the approver at this stage."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Human-readable labels for each stage level (zh-CN).
STAGE_LABELS: dict[ApprovalStageLevel, str] = {
    ApprovalStageLevel.LEVEL_1: "部门主管审批",
    ApprovalStageLevel.LEVEL_2: "资产管理员审批",
}

#: Maximum allowed length for the rejection reason.
REJECTION_REASON_MAX_LENGTH = 500


# ---------------------------------------------------------------------------
# Entity
# ---------------------------------------------------------------------------

class ApprovalStage:
    """Domain entity representing one approval node in the approval chain.

    Attributes:
        id: Unique identifier for this approval stage record.
        order_id: Foreign key referencing the parent work order.
        stage_level: Which level in the approval chain (1 or 2).
        status: Current status of this stage.
        operator_id: ID of the user who acted on this stage (``None`` until acted).
        action: The action taken (``None`` until acted).
        rejection_reason: Mandatory non-empty string when *action* is REJECT.
        acted_at: ISO-8601 timestamp of when the action was performed.
        created_at: Timestamp when this stage record was created.
        updated_at: Timestamp of the last modification.
    """

    def __init__(
        self,
        order_id: str,
        stage_level: ApprovalStageLevel,
        stage_id: Optional[str] = None,
        status: ApprovalStageStatus = ApprovalStageStatus.PENDING,
        operator_id: Optional[str] = None,
        action: Optional[ApprovalAction] = None,
        rejection_reason: Optional[str] = None,
        acted_at: Optional[datetime] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        """Initialise a new :class:`ApprovalStage`.

        Args:
            order_id: Identifier of the parent work order.
            stage_level: The approval level (LEVEL_1 or LEVEL_2).
            stage_id: Optional pre-existing UUID.  A new one is generated when
                ``None``.
            status: Initial status (defaults to PENDING).
            operator_id: User who performed the approval/rejection.
            action: APPROVE or REJECT.
            rejection_reason: Required when *action* is REJECT; max 500 chars.
            acted_at: When the action was taken.
            created_at: Record creation timestamp.
            updated_at: Record last-update timestamp.
        """
        self.id: str = stage_id or str(uuid.uuid4())
        self.order_id: str = order_id
        self.stage_level: ApprovalStageLevel = stage_level
        self.status: ApprovalStageStatus = status
        self.operator_id: Optional[str] = operator_id
        self.action: Optional[ApprovalAction] = action
        self.rejection_reason: Optional[str] = rejection_reason
        self.acted_at: Optional[datetime] = acted_at
        self.created_at: datetime = created_at or datetime.utcnow()
        self.updated_at: datetime = updated_at or datetime.utcnow()

    # ------------------------------------------------------------------
    # Business behaviour
    # ------------------------------------------------------------------

    def approve(self, operator_id: str) -> None:
        """Mark this stage as approved by *operator_id*.

        Raises:
            ValueError: If the stage is not in PENDING status.
        """
        if self.status != ApprovalStageStatus.PENDING:
            raise ValueError(
                f"Cannot approve stage {self.stage_level.name} "
                f"with status '{self.status.value}'. "
                f"Only PENDING stages can be approved."
            )
        self.operator_id = operator_id
        self.action = ApprovalAction.APPROVE
        self.rejection_reason = None
        self.status = ApprovalStageStatus.APPROVED
        self.acted_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def reject(self, operator_id: str, rejection_reason: str) -> None:
        """Mark this stage as rejected by *operator_id*.

        Args:
            operator_id: The user performing the rejection.
            rejection_reason: Non-empty reason for the rejection (max 500 chars).

        Raises:
            ValueError: If the stage is not in PENDING, or if
                *rejection_reason* is empty / exceeds the max length.
        """
        if self.status != ApprovalStageStatus.PENDING:
            raise ValueError(
                f"Cannot reject stage {self.stage_level.name} "
                f"with status '{self.status.value}'. "
                f"Only PENDING stages can be rejected."
            )
        if not rejection_reason or not rejection_reason.strip():
            raise ValueError(
                "rejection_reason is required and must be a non-empty string."
            )
        if len(rejection_reason) > REJECTION_REASON_MAX_LENGTH:
            raise ValueError(
                f"rejection_reason must not exceed "
                f"{REJECTION_REASON_MAX_LENGTH} characters "
                f"(got {len(rejection_reason)})."
            )
        self.operator_id = operator_id
        self.action = ApprovalAction.REJECT
        self.rejection_reason = rejection_reason.strip()
        self.status = ApprovalStageStatus.REJECTED
        self.acted_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    @property
    def is_pending(self) -> bool:
        """Return ``True`` when this stage is awaiting action."""
        return self.status == ApprovalStageStatus.PENDING

    @property
    def is_approved(self) -> bool:
        """Return ``True`` when this stage has been approved."""
        return self.status == ApprovalStageStatus.APPROVED

    @property
    def is_rejected(self) -> bool:
        """Return ``True`` when this stage has been rejected."""
        return self.status == ApprovalStageStatus.REJECTED

    @property
    def label(self) -> str:
        """Human-readable label for this stage level (zh-CN)."""
        return STAGE_LABELS[self.stage_level]

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Serialize the entity to a plain dictionary.

        All datetime values are converted to ISO-8601 strings.
        """
        return {
            "id": self.id,
            "order_id": self.order_id,
            "stage_level": self.stage_level.value,
            "stage_label": self.label,
            "status": self.status.value,
            "operator_id": self.operator_id,
            "action": self.action.value if self.action else None,
            "rejection_reason": self.rejection_reason,
            "acted_at": self.acted_at.isoformat() if self.acted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> ApprovalStage:
        """Deserialize a dictionary into an :class:`ApprovalStage` instance.

        Args:
            data: Dictionary produced by :meth:`to_dict`.

        Returns:
            A fully hydrated :class:`ApprovalStage` entity.
        """
        stage_level = ApprovalStageLevel(data["stage_level"])
        status = ApprovalStageStatus(data["status"])
        action = ApprovalAction(data["action"]) if data.get("action") else None

        acted_at = (
            datetime.fromisoformat(data["acted_at"])
            if data.get("acted_at")
            else None
        )
        created_at = (
            datetime.fromisoformat(data["created_at"])
            if data.get("created_at")
            else None
        )
        updated_at = (
            datetime.fromisoformat(data["updated_at"])
            if data.get("updated_at")
            else None
        )

        return cls(
            stage_id=data.get("id"),
            order_id=data["order_id"],
            stage_level=stage_level,
            status=status,
            operator_id=data.get("operator_id"),
            action=action,
            rejection_reason=data.get("rejection_reason"),
            acted_at=acted_at,
            created_at=created_at,
            updated_at=updated_at,
        )

    # ------------------------------------------------------------------
    # Python dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"ApprovalStage(id={self.id!r}, order_id={self.order_id!r}, "
            f"stage_level={self.stage_level.name}, status={self.status.value})"
        )

    def __eq__(self, other: object) -> bool:
        """Two stages are equal when their *id* matches."""
        if not isinstance(other, ApprovalStage):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)