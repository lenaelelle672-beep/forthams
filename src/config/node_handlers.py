"""
Node Handlers for Asset State Transition Engine.

This module provides handlers that manage asset status transitions and
approval chain routing in a deterministic, auditable manner.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import json
import hashlib


class AssetStatus(str, Enum):
    """Valid asset lifecycle statuses."""
    ACTIVE = "active"
    RETIREMENT_REQUESTED = "retirement_requested"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETIRED = "retired"
    VOIDED = "voided"


class ApprovalRole(str, Enum):
    """Roles in the approval chain."""
    APPLICANT = "applicant"
    APPROVER = "approver"
    FINAL_APPROVER = "final_approver"


@dataclass(frozen=True)
class TransitionRule:
    """Deterministic rule for state transitions."""
    from_status: AssetStatus
    to_status: AssetStatus
    allowed_roles: List[ApprovalRole]
    required_signatures: int = 1

    def can_transition(self, current: AssetStatus, role: ApprovalRole) -> bool:
        """Check if a role is allowed to trigger this transition."""
        return current == self.from_status and role in self.allowed_roles


@dataclass
class Event:
    """Immutable event record for audit and replay."""
    event_id: str
    asset_id: str
    timestamp: str
    event_type: str
    payload: Dict[str, Any]
    previous_status: Optional[str]
    new_status: Optional[str]
    role: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def sign(self, secret: str) -> str:
        """Create a tamper-evident signature for the event."""
        payload = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(f"{payload}{secret}".encode()).hexdigest()


class NodeHandler:
    """Base handler for processing node actions in the workflow."""

    def __init__(self, rules: List[TransitionRule], secret: str = "default") -> None:
        self.rules = { (r.from_status, r.to_status): r for r in rules }
        self.secret = secret
        self._events: List[Event] = []

    def get_events(self) -> List[Event]:
        """Return immutable event log."""
        return list(self._events)

    def _emit(self, event_type: str, asset_id: str, role: str,
              previous_status: Optional[AssetStatus],
              new_status: Optional[AssetStatus],
              payload: Optional[Dict[str, Any]] = None,
              metadata: Optional[Dict[str, Any]] = None) -> Event:
        """Create and store an immutable event (atomic step)."""
        timestamp = datetime.now(timezone.utc).isoformat()
        event_id = hashlib.sha256(f"{asset_id}{timestamp}{event_type}".encode()).hexdigest()
        event = Event(
            event_id=event_id,
            asset_id=asset_id,
            timestamp=timestamp,
            event_type=event_type,
            payload=payload or {},
            previous_status=str(previous_status) if previous_status else None,
            new_status=str(new_status) if new_status else None,
            role=role,
            metadata=metadata or {},
        )
        signed = event.sign(self.secret)
        # In a real implementation, signature would be stored alongside the event.
        self._events.append(event)
        return event

    def transition(self, asset_id: str, current_status: AssetStatus,
                  requested_status: AssetStatus, role: ApprovalRole,
                  context: Optional[Dict[str, Any]] = None) -> AssetStatus:
        """
        Deterministically transition status if a valid rule exists and role is allowed.
        Raises ValueError if transition is not permitted.
        """
        rule_key = (current_status, requested_status)
        if rule_key not in self.rules:
            raise ValueError(
                f"Invalid transition: {current_status} -> {requested_status}"
            )
        rule = self.rules[rule_key]
        if not rule.can_transition(current_status, role):
            raise PermissionError(
                f"Role {role} cannot transition {current_status} -> {requested_status}"
            )
        # Atomic state change + event persistence
        self._emit(
            event_type="state_transition",
            asset_id=asset_id,
            role=role.value,
            previous_status=current_status,
            new_status=requested_status,
            payload={"context": context or {}},
            metadata={"rule_id": rule_key[1].value},
        )
        return requested_status


class RetirementHandler(NodeHandler):
    """Handler specifically for asset retirement approval chains."""

    def __init__(self) -> None:
        rules = [
            TransitionRule(
                from_status=AssetStatus.ACTIVE,
                to_status=AssetStatus.RETIREMENT_REQUESTED,
                allowed_roles=[ApprovalRole.APPLICANT],
            ),
            TransitionRule(
                from_status=AssetStatus.RETIREMENT_REQUESTED,
                to_status=AssetStatus.PENDING_APPROVAL,
                allowed_roles=[ApprovalRole.APPROVER],
            ),
            TransitionRule(
                from_status=AssetStatus.PENDING_APPROVAL,
                to_status=AssetStatus.APPROVED,
                allowed_roles=[ApprovalRole.FINAL_APPROVER],
            ),
            TransitionRule(
                from_status=AssetStatus.PENDING_APPROVAL,
                to_status=AssetStatus.REJECTED,
                allowed_roles=[ApprovalRole.APPROVER, ApprovalRole.FINAL_APPROVER],
            ),
            TransitionRule(
                from_status=AssetStatus.APPROVED,
                to_status=AssetStatus.RETIRED,
                allowed_roles=[ApprovalRole.APPLICANT],
            ),
        ]
        super().__init__(rules, secret="retirement_v1")

    def submit_retirement(self, asset_id: str, applicant: str) -> Dict[str, Any]:
        """Initiate retirement: ACTIVE -> RETIREMENT_REQUESTED."""
        self.transition(asset_id, AssetStatus.ACTIVE,
                        AssetStatus.RETIREMENT_REQUESTED, ApprovalRole.APPLICANT)
        return {"asset_id": asset_id, "status": str(AssetStatus.RETIREMENT_REQUESTED)}

    def approve_step(self, asset_id: str, role: ApprovalRole,
                     context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Progress the retirement through the approval chain."""
        current = self._current_status(asset_id)
        # Determine target status based on role and current state
        if role == ApprovalRole.APPROVER and current == AssetStatus.RETIREMENT_REQUESTED:
            new_status = AssetStatus.PENDING_APPROVAL
        elif role == ApprovalRole.FINAL_APPROVER and current == AssetStatus.PENDING_APPROVAL:
            new_status = AssetStatus.APPROVED
        elif role == ApprovalRole.APPLICANT and current == AssetStatus.APPROVED:
            new_status = AssetStatus.RETIRED
        else:
            raise ValueError(f"Role {role} cannot act in status {current}")
        self.transition(asset_id, current, new_status, role, context)
        return {"asset_id": asset_id, "status": str(new_status)}

    def reject_step(self, asset_id: str, role: ApprovalRole,
                    reason: Optional[str] = None) -> Dict[str, Any]:
        """Reject at any approvable step -> REJECTED."""
        current = self._current_status(asset_id)
        if role in (ApprovalRole.APPROVER, ApprovalRole.FINAL_APPROVER):
            self.transition(asset_id, current, AssetStatus.REJECTED, role,
                            metadata={"reason": reason or "rejected"})
            return {"asset_id": asset_id, "status": "rejected"}
        raise PermissionError(f"Role {role} cannot reject")

    def _current_status(self, asset_id: str) -> AssetStatus:
        """Infer current status from the latest event for the asset."""
        events = self.get_events()
        asset_events = [e for e in events if e.asset_id == asset_id]
        if not asset_events:
            return AssetStatus.ACTIVE
        latest = sorted(asset_events, key=lambda e: e.timestamp)[-1]
        try:
            return AssetStatus(latest.new_status)  # type: ignore[arg-type]
        except ValueError:
            return AssetStatus.ACTIVE