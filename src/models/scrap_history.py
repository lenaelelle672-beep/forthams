"""
ScrapHistory model and related domain logic for asset retirement lifecycle tracking.

This module provides the data model and persistence primitives for recording
state transitions and approval events in the asset retirement workflow.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.exception import BusinessException
from src.common.utils import generate_id

# -----------------------------------------------------------------------------
# Domain exceptions
# -----------------------------------------------------------------------------
class ScrapHistoryError(BusinessException):
    """Base exception for scrap history related errors."""
    category = "scrap_history"

class InvalidTransitionError(ScrapHistoryError):
    """Raised when a state transition is not allowed."""
    code = "invalid_transition"

class ApprovalError(ScrapHistoryError):
    """Raised when an approval operation fails validation."""
    code = "approval_error"

# -----------------------------------------------------------------------------
# Enumerations
# -----------------------------------------------------------------------------
class AssetStatus(str, Literal["active", "retirement_requested", "approved", "rejected", "retired"]):
    """Possible statuses of an asset in the retirement lifecycle."""
    pass

class ApprovalRole(str, Literal["applicant", "approver", "final_approver"]):
    """Roles that can participate in the approval chain."""
    pass

class EventType(str, Literal["status_change", "approval"]):
    """Types of events recorded in the history."""
    pass

# -----------------------------------------------------------------------------
# Data models
# -----------------------------------------------------------------------------
class ApprovalEvent(BaseModel):
    """Represents a single approval action within the retirement workflow."""
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(default_factory=lambda: generate_id())
    role: ApprovalRole
    actor_id: str  # user identifier
    decision: Literal["approve", "reject"]
    comment: Optional[str] = None
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("actor_id")
    @classmethod
    def validate_actor_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("actor_id must not be empty")
        return v.strip()

class ScrapHistoryEntry(BaseModel):
    """A single immutable event in the asset's lifecycle history."""
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(default_factory=lambda: generate_id())
    asset_id: str = Field(..., description="Asset this event belongs to")
    event_type: EventType
    status: Optional[AssetStatus] = None  # present for status_change events
    previous_status: Optional[AssetStatus] = None
    approval: Optional[ApprovalEvent] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("asset_id")
    @classmethod
    def validate_asset_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("asset_id must not be empty")
        return v.strip()

# -----------------------------------------------------------------------------
# Domain entity
# -----------------------------------------------------------------------------
@dataclass(frozen=True)
class ScrapHistory:
    """
    Immutable snapshot of an asset's retirement lifecycle history.

    This entity is intentionally simple and serves as a data carrier.
    All mutations must go through the service layer to ensure atomicity
    and event sourcing guarantees.
    """
    asset_id: str
    current_status: AssetStatus = AssetStatus.active
    approval_chain: List[ApprovalRole] = field(default_factory=lambda: [
        ApprovalRole.applicant,
        ApprovalRole.approver,
        ApprovalRole.final_approver,
    ])
    entries: List[ScrapHistoryEntry] = field(default_factory=list)

    @property
    def is_retired(self) -> bool:
        return self.current_status == AssetStatus.retired

    @property
    def is_rejected(self) -> bool:
        return self.current_status == AssetStatus.rejected

    @property
    def pending_approval_role(self) -> Optional[ApprovalRole]:
        """
        Return the next role that must approve the retirement request,
        or None if no further approvals are required.
        """
        for role in self.approval_chain:
            # Check if this role has already approved
            already_approved = any(
                e.approval and e.approval.role == role and e.approval.decision == "approve"
                for e in self.entries
            )
            if not already_approved:
                return role
        return None

    def can_transition_to(self, target_status: AssetStatus) -> bool:
        """
        Deterministic guard: returns True iff the current status permits
        a transition to target_status given the recorded events.
        """
        # Valid lifecycle according to the spec:
        # active -> retirement_requested -> (approved -> retired) | (rejected)
        valid_transitions = {
            AssetStatus.active: {AssetStatus.retirement_requested},
            AssetStatus.retirement_requested: {AssetStatus.approved, AssetStatus.rejected},
            AssetStatus.approved: {AssetStatus.retired},
            AssetStatus.rejected: set(),
            AssetStatus.retired: set(),
        }
        return target_status in valid_transitions.get(self.current_status, set())

    def apply_status_change(
        self,
        target_status: AssetStatus,
        actor_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "ScrapHistory":
        """
        Produce a new ScrapHistory instance with the status transition applied.
        Raises InvalidTransitionError if the transition is not allowed.
        """
        if not self.can_transition_to(target_status):
            raise InvalidTransitionError(
                f"Invalid status transition from {self.current_status} to {target_status}"
            )
        entry = ScrapHistoryEntry(
            asset_id=self.asset_id,
            event_type=EventType.status_change,
            status=target_status,
            previous_status=self.current_status,
            metadata=metadata or {},
        )
        new_entries = list(self.entries) + [entry]
        return ScrapHistory(
            asset_id=self.asset_id,
            current_status=target_status,
            approval_chain=self.approval_chain,
            entries=new_entries,
        )

    def apply_approval(
        self,
        role: ApprovalRole,
        decision: Literal["approve", "reject"],
        actor_id: str,
        comment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "ScrapHistory":
        """
        Apply an approval event.

        Rules:
        - Approvals must follow the configured approval_chain order.
        - A single reject at any stage transitions the request to 'rejected'.
        - Approvals are idempotent for the same role (no duplicate entries).
        """
        if role not in self.approval_chain:
            raise ApprovalError(f"Role {role} is not part of the approval chain")

        # Prevent duplicate approvals for the same role
        for e in self.entries:
            if e.approval and e.approval.role == role:
                # Already processed; return self as a no-op
                return self

        approval_event = ApprovalEvent(
            role=role,
            actor_id=actor_id,
            decision=decision,
            comment=comment,
        )
        entry = ScrapHistoryEntry(
            asset_id=self.asset_id,
            event_type=EventType.approval,
            approval=approval_event,
            metadata=metadata or {},
        )
        new_entries = list(self.entries) + [entry]

        if decision == "reject":
            # Any rejection terminates the flow with status 'rejected'
            return ScrapHistory(
                asset_id=self.asset_id,
                current_status=AssetStatus.rejected,
                approval_chain=self.approval_chain,
                entries=new_entries,
            )

        # decision == "approve"
        # Determine next expected role in the chain
        remaining = self.approval_chain[self.approval_chain.index(role) + 1:]
        if not remaining:
            # All approvals granted -> retire
            return ScrapHistory(
                asset_id=self.asset_id,
                current_status=AssetStatus.retired,
                approval_chain=self.approval_chain,
                entries=new_entries,
            )
        # Move to next role in chain
        return ScrapHistory(
            asset_id=self.asset_id,
            current_status=self.current_status,
            approval_chain=self.approval_chain,
            entries=new_entries,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "current_status": self.current_status,
            "approval_chain": [r.value for r in self.approval_chain],
            "entries": [e.model_dump() for e in self.entries],
        }

    @classmethod
    def initial_for_asset(cls, asset_id: str) -> "ScrapHistory":
        """Create a fresh history for a new asset retirement request."""
        return cls(asset_id=asset_id)
# -----------------------------------------------------------------------------
# Simple repository interface (placeholder for persistence implementation)
# -----------------------------------------------------------------------------
class ScrapHistoryRepository:
    """
    Minimal repository contract for persisting and retrieving ScrapHistory.
    In production this would be backed by a durable store (e.g. PostgreSQL,
    event store) with atomic writes and immutable event records.
    """

    def __init__(self) -> None:
        self._store: Dict[str, ScrapHistory] = {}

    def save(self, history: ScrapHistory) -> None:
        """Atomically persist or update a history snapshot."""
        self._store[history.asset_id] = history

    def load(self, asset_id: str) -> ScrapHistory:
        """Load history for an asset; return initial state if absent."""
        if asset_id not in self._store:
            return ScrapHistory.initial_for_asset(asset_id)
        return self._store[asset_id]

    def load_all(self) -> List[ScrapHistory]:
        return list(self._store.values())