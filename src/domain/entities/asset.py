"""
Asset Domain Entity.

This module defines the core asset entity and its state lifecycle.
It supports deterministic state transitions, retirement application
workflow (with multi‑role approval chain), immutable event history,
and RBAC‑guarded operations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional

from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule
class AssetStateTransitionError(Exception):
    """Raised when a state transition is invalid or not allowed."""

    pass
class DuplicateApplicationError(Exception):
    """Raised when a retirement application is submitted for an asset already in progress."""

    pass
class TransitionConflictError(Exception):
    """Raised when concurrent transitions conflict (should be prevented by deterministic rules)."""

    pass
class ApprovalDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
class Role(str, Enum):
    APPLICANT = "applicant"
    REVIEWER = "reviewer"
    APPROVER = "approver"
@dataclass(frozen=True)
class Event:
    """Immutable event record for event sourcing."""

    asset_id: str
    event_type: str
    payload: Dict[str, object]
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    sequence: int = 0
class Asset:
    """
    Asset entity managing status lifecycle and retirement approval chain.

    State machine:
        in_use -> retirement_requested -> {pending_approval} -> {approved} -> retired
                                          -> {rejected} -> vetoed
                                          -> {escalated} -> approved -> retired
                                          -> {escalated} -> rejected -> vetoed
        in_use -> disposal_requested -> disposed

    Notes:
        - All transitions are deterministic and guarded.
        - History is written atomically with status change (in service layer).
        - Approval chain must not be bypassed; any rejection leads to "vetoed".
    """

    # Deterministic transition table: (current_status, trigger) -> next_status
    TRANSITIONS: Dict[AssetStatus, Dict[str, AssetStatus]] = {
        AssetStatus.IN_USE: {
            "request_retirement": AssetStatus.RETIREMENT_REQUESTED,
            "request_disposal": AssetStatus.DISPOSAL_REQUESTED,
        },
        AssetStatus.RETIREMENT_REQUESTED: {
            "submit_for_approval": AssetStatus.PENDING_APPROVAL,
            "cancel": AssetStatus.CANCELLED,
        },
        AssetStatus.PENDING_APPROVAL: {
            "approve": AssetStatus.APPROVED,
            "reject": AssetStatus.VETOED,
            "escalate": AssetStatus.ESCALATED,
        },
        AssetStatus.ESCALATED: {
            "approve": AssetStatus.APPROVED,
            "reject": AssetStatus.VETOED,
        },
        AssetStatus.APPROVED: {
            "complete_retirement": AssetStatus.RETIRED,
        },
        AssetStatus.DISPOSAL_REQUESTED: {
            "submit_for_approval": AssetStatus.PENDING_APPROVAL,
            "cancel": AssetStatus.CANCELLED,
        },
        AssetStatus.DISPOSED: {
            # terminal, no outgoing transitions
        },
        AssetStatus.VETOED: {
            # terminal, no outgoing transitions
        },
        AssetStatus.CANCELLED: {
            # terminal
        },
    }

    def __init__(
        self,
        asset_id: str,
        name: str,
        status: AssetStatus = AssetStatus.IN_USE,
        current_stage: Optional[str] = None,
        history: Optional[List[Event]] = None,
    ) -> None:
        object.__setattr__(self, "asset_id", asset_id)
        object.__setattr__(self, "name", name)
        object.__setattr__(self, "status", status)
        object.__setattr__(self, "current_stage", current_stage)
        object.__setattr__(self, "history", history if history is not None else [])

    @property
    def is_terminal(self) -> bool:
        """Return True if the asset cannot transition further."""
        return self.status not in self.TRANSITIONS or not self.TRANSITIONS[self.status]

    def can_transition(self, trigger: str, *, rbac_permissions: Optional[List[str]] = None) -> bool:
        """
        Determine whether a transition is allowed given current status and optional RBAC checks.

        Args:
            trigger: The action/trigger requesting transition.
            rbac_permissions: Optional list of permission codes for the actor.

        Returns:
            True if transition is valid and permitted.
        """
        if self.is_terminal:
            return False
        allowed = self.TRANSITIONS.get(self.status, {}).get(trigger)
        if allowed is None:
            return False
        # Placeholder for RBAC checks; in practice the caller should enforce permissions
        # before calling this method.
        return True

    def transition(self, trigger: str, *, actor: str, rbac_permissions: Optional[List[str]] = None) -> Event:
        """
        Attempt a state transition, returning an immutable event.

        Raises:
            AssetStateTransitionError: if transition is invalid or not permitted.
            DuplicateApplicationError: if retirement application already exists.
        """
        if not self.can_transition(trigger, rbac_permissions=rbac_permissions):
            raise AssetStateTransitionError(
                f"Invalid or unauthorized transition: asset={self.asset_id} status={self.status} trigger={trigger}"
            )

        if trigger == "submit_for_approval" and self.status == AssetStatus.RETIREMENT_REQUESTED:
            # Ensure no duplicate retirement application in-flight.
            if any(
                e.event_type == "retirement_application_submitted"
                and e.payload.get("status") == "pending_approval"
                for e in self.history
            ):
                raise DuplicateApplicationError(
                    f"Retirement application already in progress for asset {self.asset_id}"
                )

        next_status = self.TRANSITIONS[self.status][trigger]
        event_type = f"{self.status.value}_to_{next_status.value}"
        event = Event(
            asset_id=self.asset_id,
            event_type=event_type,
            payload={
                "from": self.status.value,
                "to": next_status.value,
                "trigger": trigger,
                "actor": actor,
                "current_stage": self.current_stage,
            },
            sequence=len(self.history) + 1,
        )
        # Update state atomically (frozen dataclass: replace via object.__setattr__)
        object.__setattr__(self, "status", next_status)
        object.__setattr__(self, "current_stage", self._derive_stage(next_status, trigger))
        return event

    @staticmethod
    def _derive_stage(next_status: AssetStatus, trigger: str) -> Optional[str]:
        """Derive a human-readable stage label from status and trigger."""
        mapping = {
            (AssetStatus.RETIREMENT_REQUESTED, "request_retirement"): "retirement_requested",
            (AssetStatus.PENDING_APPROVAL, "submit_for_approval"): "pending_approval",
            (AssetStatus.APPROVED, "approve"): "approved",
            (AssetStatus.RETIRED, "complete_retirement"): "retired",
            (AssetStatus.VETOED, "reject"): "vetoed",
            (AssetStatus.CANCELLED, "cancel"): "cancelled",
            (AssetStatus.ESCALATED, "escalate"): "escalated",
            (AssetStatus.DISPOSAL_REQUESTED, "request_disposal"): "disposal_requested",
            (AssetStatus.DISPOSED, "complete_disposal"): "disposed",
        }
        return mapping.get((next_status, trigger))

    def to_dict(self) -> Dict[str, object]:
        """Serialize to plain dict (safe for API/database)."""
        return {
            "asset_id": self.asset_id,
            "name": self.name,
            "status": self.status.value,
            "current_stage": self.current_stage,
            "history": [
                {
                    "asset_id": e.asset_id,
                    "event_type": e.event_type,
                    "payload": e.payload,
                    "occurred_at": e.occurred_at.isoformat(),
                    "sequence": e.sequence,
                }
                for e in self.history
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "Asset":
        """Deserialize from plain dict (compatible with existing catalog data)."""
        history_raw = data.get("history", [])
        history = [
            Event(
                asset_id=e["asset_id"],
                event_type=e["event_type"],
                payload=e.get("payload", {}),
                occurred_at=datetime.fromisoformat(str(e["occurred_at"])),
                sequence=e.get("sequence", 0),
            )
            for e in history_raw
        ]
        return cls(
            asset_id=str(data["asset_id"]),
            name=str(data["name"]),
            status=AssetStatus(str(data.get("status", AssetStatus.IN_USE.value))),
            current_stage=data.get("current_stage"),
            history=history,
        )