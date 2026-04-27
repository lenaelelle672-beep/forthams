"""
Asset schema definitions for the asset status lifecycle.

This module defines Pydantic models used to validate and serialize
asset data, supporting the state machine and retirement workflow.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from pydantic import Field, field_validator


@dataclass
class AssetStatusHistoryEntry:
    """A single immutable event in the asset lifecycle."""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    from_status: str
    to_status: str
    event_type: str
    actor_id: Optional[str] = None
    comment: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class Asset:
    """
    Core asset record compatible with existing asset directory data.

    Status values follow the canonical lifecycle:
    - active: in production use
    - under_review: retirement requested, awaiting approvals
    - retired: successfully retired
    - rejected: retirement vetoed / denied
    - decommissioned: physically removed from service
    """
    id: str
    name: str
    description: Optional[str] = None
    owner_id: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status_history: List[AssetStatusHistoryEntry] = field(default_factory=list)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"active", "under_review", "retired", "rejected", "decommissioned"}
        if v not in allowed:
            raise ValueError(f"Invalid status '{v}'. Must be one of {sorted(allowed)}")
        return v

    def add_status_event(
        self,
        from_status: str,
        to_status: str,
        event_type: str,
        actor_id: Optional[str] = None,
        comment: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        """
        Append an immutable status history entry and update current status.

        This method ensures history write and status change are performed
        together (atomic in application layer) to preserve consistency.
        """
        entry = AssetStatusHistoryEntry(
            from_status=from_status,
            to_status=to_status,
            event_type=event_type,
            actor_id=actor_id,
            comment=comment,
            metadata=metadata or {},
        )
        self.status_history.append(entry)
        self.status = to_status
        self.updated_at = datetime.utcnow()

    def can_transition_to(self, target_status: str) -> bool:
        """
        Deterministic transition guard based on current status and target.

        Rules:
        - active -> under_review
        - under_review -> retired | rejected
        - under_review -> active (rollback for rework)
        - retired -> decommissioned
        - rejected -> active (re-submit)
        - decommissioned is terminal
        """
        current = self.status
        allowed: dict[str, set[str]] = {
            "active": {"under_review"},
            "under_review": {"retired", "rejected", "active"},
            "retired": {"decommissioned"},
            "rejected": {"active"},
            "decommissioned": set(),
        }
        return target_status in allowed.get(current, set())

    def transition_to(self, target_status: str, actor_id: Optional[str] = None) -> None:
        """
        Attempt a deterministic state transition.

        Raises:
            StateTransitionError: if transition is invalid or not allowed.
        """
        if not self.can_transition_to(target_status):
            raise StateTransitionError(
                f"Invalid transition from '{self.status}' to '{target_status}' for asset {self.id}"
            )
        self.add_status_event(
            from_status=self.status,
            to_status=target_status,
            event_type="status_change",
            actor_id=actor_id,
        )


class StateTransitionError(Exception):
    """Raised when an invalid or unauthorized state transition is attempted."""
    pass