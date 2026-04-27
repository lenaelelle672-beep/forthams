"""
Asset Scrap Request model and state machine integration.

This module defines the ScrapRequest domain model and its integration with
the retirement/asset state machine, supporting multi‑role approval chain
(申请人 -> 审批人 -> 终审人), deterministic transitions, event persistence,
and RBAC‑protected operations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import Field, field_validator

from src.common.annotation import Auditable
from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule
class TransitionOutcome(str, Enum):
    """Outcome of an approval action."""
    APPROVED = "approved"
    REJECTED = "rejected"
class ApprovalRole(str, Enum):
    """Roles participating in the scrap request approval chain."""
    APPLICANT = "applicant"
    REVIEWER = "reviewer"
    FINAL_REVIEWER = "final_reviewer"
@dataclass
class ApprovalNode:
    """A single node in the approval chain."""
    role: ApprovalRole
    user_id: str
    status: str = "pending"  # pending / approved / rejected
    decided_at: Optional[datetime] = None
    comment: Optional[str] = None
@dataclass
class Event(
    Auditable,  # provides id, created_at, metadata, audit fields
):
    """Immutable event record for audit and event sourcing."""
    aggregate_id: str
    event_type: str
    payload: dict
    version: int
class ScrapRequest(Auditable):
    """
    ScrapRequest aggregates the lifecycle of an asset retirement application.

    State machine:
      draft -> submitted -> under_review -> approved -> retired
                                   -> rejected -> cancelled

    All transitions are guarded and produce an immutable Event record.
    """

    # Public fields
    id: str = Field(..., description="Unique request identifier")
    asset_id: str = Field(..., description="Asset being retired")
    applicant_id: str = Field(..., description="Originator of request")
    description: Optional[str] = Field(None, description="Optional free‑text")

    # State
    status: AssetStatus = AssetStatus.DRAFT
    current_review_index: int = 0
    approval_chain: List[ApprovalNode] = field(default_factory=list)
    events: List[Event] = field(default_factory=list)
    retired_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    cancelled_by: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # --
    # Validation
    # --
    @field_validator("id", "asset_id", "applicant_id")
    @classmethod
    def require_non_empty(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()

    # --
    # Core lifecycle
    # --
    def submit(self, user_id: str) -> List[Event]:
        """Submit the request for review (requires DRAFT)."""
        self._ensure_transition(AssetStatus.DRAFT, AssetStatus.SUBMITTED, user_id)
        self._advance_review_index_if_needed()
        return self._emit(
            event_type="request_submitted",
            payload={"asset_id": self.asset_id, "submitted_by": user_id},
            user_id=user_id,
        )

    def approve(self, user_id: str, role: ApprovalRole, comment: Optional[str] = None) -> List[Event]:
        """Approve at the current review node (requires REVIEWER/FINAL_REVIEWER)."""
        self._ensure_can_interact(user_id, role)
        node = self._current_node()
        self._ensure_transition(
            from_status=self.status,
            to_status=AssetStatus.UNDER_REVIEW,
            user_id=user_id,
        )
        node.status = "approved"
        node.decided_at = datetime.now(timezone.utc)
        node.comment = comment

        if self._all_approved():
            self.status = AssetStatus.APPROVED
            self._advance_review_index_if_needed()
            return self._emit(
                event_type="approved",
                payload={"approved_by": user_id, "role": role.value},
                user_id=user_id,
            )
        # still waiting for remaining reviewers
        return self._emit(
            event_type="approval_step",
            payload={"approved_by": user_id, "role": role.value},
            user_id=user_id,
        )

    def reject(self, user_id: str, role: ApprovalRole, reason: Optional[str] = None) -> List[Event]:
        """Reject at any review node — terminates the chain with REJECTED."""
        self._ensure_can_interact(user_id, role)
        self._ensure_transition(
            from_status=self.status,
            to_status=AssetStatus.REJECTED,
            user_id=user_id,
        )
        node = self._current_node()
        node.status = "rejected"
        node.decided_at = datetime.now(timezone.utc)
        node.comment = reason
        self.status = AssetStatus.REJECTED
        self.rejected_reason = reason or "Rejected by reviewer"
        return self._emit(
            event_type="rejected",
            payload={"rejected_by": user_id, "role": role.value, "reason": self.rejected_reason},
            user_id=user_id,
        )

    def retire(self, user_id: str) -> List[Event]:
        """Mark the asset as retired (requires APPROVED)."""
        self._ensure_transition(AssetStatus.APPROVED, AssetStatus.RETIRED, user_id)
        self.status = AssetStatus.RETIRED
        self.retired_at = datetime.now(timezone.utc)
        return self._emit(
            event_type="retired",
            payload={"retired_by": user_id},
            user_id=user_id,
        )

    def cancel(self, user_id: str) -> List[Event]:
        """Cancel a draft or pending request."""
        allowed = {AssetStatus.DRAFT, AssetStatus.SUBMITTED, AssetStatus.UNDER_REVIEW}
        self._ensure_transition(self.status, AssetStatus.CANCELLED, user_id, allowed=allowed)
        self.status = AssetStatus.CANCELLED
        self.cancelled_by = user_id
        return self._emit(
            event_type="cancelled",
            payload={"cancelled_by": user_id},
            user_id=user_id,
        )

    # --
    # Helpers
    # --
    def _ensure_can_interact(self, user_id: str, role: ApprovalRole) -> None:
        """RBAC stub: in production this consults an auth service."""
        # Minimal RBAC: the caller must match the node’s role.
        node = self._current_node()
        if node.user_id != user_id:
            raise PermissionError(f"User {user_id} cannot act as {role.value}")

    def _ensure_transition(
        self,
        from_status: AssetStatus,
        to_status: AssetStatus,
        user_id: str,
        allowed: Optional[set[AssetStatus]] = None,
    ) -> None:
        """Deterministic guard for status transitions."""
        allowed_set = allowed or self._valid_transitions().get(from_status, set())
        if to_status not in allowed_set:
            raise TransitionRule.InvalidTransition(
                f"Invalid transition {from_status.value} -> {to_status.value} for user {user_id}"
            )
        # atomic-like: state is only changed after event emission in callers.

    def _valid_transitions(self) -> dict[AssetStatus, set[AssetStatus]]:
        """Deterministic, single-source mapping of allowed transitions."""
        return {
            AssetStatus.DRAFT: {AssetStatus.SUBMITTED, AssetStatus.CANCELLED},
            AssetStatus.SUBMITTED: {AssetStatus.UNDER_REVIEW, AssetStatus.CANCELLED},
            AssetStatus.UNDER_REVIEW: {AssetStatus.APPROVED, AssetStatus.REJECTED},
            AssetStatus.APPROVED: {AssetStatus.RETIRED},
            AssetStatus.REJECTED: set(),
            AssetStatus.RETIRED: set(),
            AssetStatus.CANCELLED: set(),
        }

    def _advance_review_index_if_needed(self) -> None:
        """Move the pointer to the next required reviewer."""
        roles = list(ApprovalRole)
        if self.current_review_index < len(roles):
            self.current_review_index += 1

    def _current_node(self) -> ApprovalNode:
        """Return the ApprovalNode for the current review step."""
        roles = list(ApprovalRole)
        idx = min(self.current_review_index, len(roles) - 1)
        return self.approval_chain[idx]

    def _all_approved(self) -> bool:
        """Check that all nodes up to current index are approved."""
        for node in self.approval_chain[: self.current_review_index + 1]:
            if node.status != "approved":
                return False
        return True

    def _emit(self, event_type: str, payload: dict, user_id: str) -> List[Event]:
        """
        Create an immutable Event and append to the in-memory buffer.
        In production the write is flushed atomically with state change.
        """
        evt = Event(
            id=str(uuid4()),
            aggregate_id=self.id,
            event_type=event_type,
            payload=payload,
            version=len(self.events) + 1,
            created_by=user_id,
            created_at=datetime.now(timezone.utc),
        )
        self.events.append(evt)
        self.updated_at = datetime.now(timezone.utc)
        return [evt]

    # --
    # Public query helpers
    # --
    def history(self) -> List[Event]:
        """Return all immutable events sorted by creation time."""
        return sorted(self.events, key=lambda e: e.created_at)

    def to_dict(self) -> dict:
        """Safe serialisation for API responses."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "applicant_id": self.applicant_id,
            "description": self.description,
            "status": self.status.value,
            "current_review_index": self.current_review_index,
            "approval_chain": [
                {
                    "role": node.role.value,
                    "user_id": node.user_id,
                    "status": node.status,
                    "decided_at": node.decided_at.isoformat() if node.decided_at else None,
                    "comment": node.comment,
                }
                for node in self.approval_chain
            ],
            "events": [e.payload for e in self.history()],
            "retired_at": self.retired_at.isoformat() if self.retired_at else None,
            "rejected_reason": self.rejected_reason,
            "cancelled_by": self.cancelled_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }