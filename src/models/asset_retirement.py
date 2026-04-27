"""
Asset Retirement State Machine and Approval Chain Engine.

This module implements the core logic for asset retirement lifecycle management,
including state transitions, multi‑role approval routing, event persistence,
and RBAC‑protected operations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Set

from pydantic import BaseModel, Field, validator

# ─── Domain Enums ──────────────────────────────────────────────────────────────
class AssetStatus(str, Enum):
    """Possible statuses of an asset."""
    ACTIVE = "active"
    RETIREMENT_REQUESTED = "retirement_requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETIRED = "retired"
    CANCELLED = "cancelled"

class ApprovalRole(str, Enum):
    """Roles that can participate in the retirement approval chain."""
    APPLICANT = "applicant"
    APPROVER = "approver"
    FINAL_APPROVER = "final_approver"

class EventType(str, Enum):
    """Types of immutable events stored for auditability."""
    STATE_TRANSITION = "state_transition"
    APPROVAL = "approval"
    REJECTION = "rejection"
    RETIREMENT_SUBMITTED = "retirement_submitted"

# ─── Data Models ───────────────────────────────────────────────────────────────
class Event(BaseModel):
    """Immutable event record for event sourcing."""
    event_id: str = Field(..., description="UUID4 generated at write time")
    asset_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    event_type: EventType
    data: Dict[str, object]
    metadata: Dict[str, object] = field(default_factory=dict)

    class Config:
        frozen = True  # enforce immutability

class TransitionRule(BaseModel):
    """Defines a valid state transition and required approvals."""
    from_status: AssetStatus
    to_status: AssetStatus
    required_approvals: Set[ApprovalRole] = field(default_factory=set)

class ApprovalNode(BaseModel):
    """Single node in the approval chain."""
    role: ApprovalRole
    user_id: str  # reference to the approver
    approved: Optional[bool] = None  # None = pending
    commented_at: Optional[datetime] = None

    @validator("approved")
    def validate_approval(cls, v, values):
        # If approval is set, ensure required fields exist
        if v is not None and "role" in values:
            return v
        return v

class AssetRetirement(BaseModel):
    """Runtime state of a retirement workflow instance."""
    asset_id: str
    workflow_id: str
    current_status: AssetStatus = AssetStatus.ACTIVE
    approval_chain: List[ApprovalNode] = field(default_factory=list)
    completed_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True

# ─── Core Engine ───────────────────────────────────────────────────────────────
class AssetStateMachineEngine:
    """
    Deterministic state machine engine for asset retirement.

    Rules:
      - Transitions are explicit and validated against TransitionRule table.
      - Any rejection in the approval chain terminates the workflow with
        status REJECTED and records the reason.
      - Final status RETIRED is only reached after all required approvals.
    """

    # Static transition table – can be loaded from DB or config in production
    TRANSITIONS: Dict[AssetStatus, List[TransitionRule]] = {
        AssetStatus.ACTIVE: [
            TransitionRule(
                from_status=AssetStatus.ACTIVE,
                to_status=AssetStatus.RETIREMENT_REQUESTED,
                required_approvals={ApprovalRole.APPLICANT},
            )
        ],
        AssetStatus.RETIREMENT_REQUESTED: [
            TransitionRule(
                from_status=AssetStatus.RETIREMENT_REQUESTED,
                to_status=AssetStatus.APPROVED,
                required_approvals={ApprovalRole.APPROVER},
            ),
            TransitionRule(
                from_status=AssetStatus.RETIREMENT_REQUESTED,
                to_status=AssetStatus.REJECTED,
                required_approvals=set(),
            ),
        ],
        AssetStatus.APPROVED: [
            TransitionRule(
                from_status=AssetStatus.APPROVED,
                to_status=AssetStatus.RETIRED,
                required_approvals={ApprovalRole.FINAL_APPROVER},
            ),
            TransitionRule(
                from_status=AssetStatus.APPROVED,
                to_status=AssetStatus.REJECTED,
                required_approvals=set(),
            ),
        ],
        AssetStatus.REJECTED: [],
        AssetStatus.RETIRED: [],
        AssetStatus.CANCELLED: [],
    }

    @classmethod
    def get_valid_transitions(cls, status: AssetStatus) -> List[TransitionRule]:
        return cls.TRANSITIONS.get(status, [])

    @staticmethod
    def _validate_approval_chain(
        chain: List[ApprovalNode], current_status: AssetStatus
    ) -> bool:
        """
        Ensure the chain contains approvals for all required roles for the
        next transition.  Simplified: each transition lists required roles;
        we verify that for every required role there exists an approved node.
        """
        required: Set[ApprovalRole] = set()
        for rule in AssetStateMachineEngine.get_valid_transitions(current_status):
            required.update(rule.required_approvals)
        approved_roles = {node.role for node in chain if node.approved is True}
        return required.issubset(approved_roles)

    @classmethod
    def transition(
        cls,
        engine: "AssetRetirement",
        event_type: EventType,
        event_data: Dict[str, object],
        events: List[Event],
        rbac_user_id: str,
        rbac_roles: Set[str],
    ) -> List[Event]:
        """
        Execute a deterministic transition. Returns a list of new immutable events
        (the caller is responsible for persisting them atomically with status).
        """
        # RBAC guard – at minimum the user must be allowed to act for the workflow
        if rbac_user_id not in engine.approval_chain and rbac_user_id != engine.asset_id:
            raise PermissionError("RBAC: user not authorized for this workflow")

        # Determine target status based on event type and current status
        target_status: Optional[AssetStatus] = None
        if event_type == EventType.STATE_TRANSITION:
            candidate = event_data.get("to_status")
            if isinstance(candidate, AssetStatus):
                target_status = candidate
        elif event_type == EventType.APPROVAL:
            # Find the transition that matches the approval role
            for rule in cls.get_valid_transitions(engine.current_status):
                if rule.required_approvals and ApprovalRole.APPROVER in rule.required_approvals:
                    target_status = rule.to_status
                    break
        elif event_type == EventType.REJECTION:
            target_status = AssetStatus.REJECTED
        elif event_type == EventType.RETIREMENT_SUBMITTED:
            target_status = AssetStatus.RETIREMENT_REQUESTED

        if target_status is None:
            raise ValueError("Invalid transition request")

        rules = cls.get_valid_transitions(engine.current_status)
        applicable = [r for r in rules if r.to_status == target_status]
        if not applicable:
            raise ValueError(f"Illegal transition from {engine.current_status} to {target_status}")

        # For approval/rejection we still need to record the node
        if event_type in (EventType.APPROVAL, EventType.REJECTION):
            if not engine.approval_chain:
                raise ValueError("Approval chain not initialized")
            # Find the pending node for the current approver role
            pending = next(
                (n for n in engine.approval_chain if n.approved is None), None
            )
            if pending is None:
                raise ValueError("No pending approval node for this user")
            pending.approved = event_type == EventType.APPROVAL
            if pending.approved is False:
                engine.current_status = AssetStatus.REJECTED
                engine.rejected_reason = f"Rejected by {pending.role}"
                engine.completed_at = datetime.now(timezone.utc)
            else:
                # Check if we can now move to the next status
                if cls._validate_approval_chain(engine.approval_chain, engine.current_status):
                    engine.current_status = target_status
                    if engine.current_status == AssetStatus.RETIRED:
                        engine.completed_at = datetime.now(timezone.utc)

        # Standard state transition path
        else:
            engine.current_status = target_status
            if target_status in (AssetStatus.REJECTED, AssetStatus.RETIRED):
                engine.completed_at = datetime.now(timezone.utc)

        # Build immutable event
        event = Event(
            event_id=str(uuid4()),
            asset_id=engine.asset_id,
            event_type=event_type,
            data={**event_data, "to_status": target_status.value},
            metadata={"user_id": rbac_user_id, "roles": list(rbac_roles)},
        )
        return [event]

# ─── Repository / Persistence Interface ───────────────────────────────────────
class EventRepository:
    """
    Abstract interface for persisting and querying immutable events.
    Concrete implementations should guarantee atomic write of event + status.
    """

    async def append(self, asset_id: str, events: List[Event]) -> None:
        raise NotImplementedError

    async def list_by_asset(self, asset_id: str) -> List[Event]:
        raise NotImplementedError

# ─── Public API DTOs ──────────────────────────────────────────────────────────
class RetirementRequestDTO(BaseModel):
    asset_id: str
    applicant_user_id: str

class ApprovalRequestDTO(BaseModel):
    workflow_id: str
    approver_user_id: str
    approved: bool
    comment: Optional[str] = None

class HistoryEntry(BaseModel):
    event_id: str
    timestamp: datetime
    event_type: str
    data: Dict[str, object]

# ─── Service Facade ───────────────────────────────────────────────────────────
class AssetRetirementService:
    """
    High-level facade used by API/controllers.  All public methods are
    expected to perform RBAC checks before calling engine methods.
    """

    def __init__(self, event_repo: EventRepository):
        self.repo = event_repo

    async def submit_retirement(self, dto: RetirementRequestDTO, user_id: str) -> AssetRetirement:
        """Initiate a retirement workflow for an asset."""
        engine = AssetRetirement(asset_id=dto.asset_id, workflow_id=f"wf-{dto.asset_id}-{datetime.now().isoformat()}")
        events = AssetStateMachineEngine.transition(
            engine=engine,
            event_type=EventType.RETIREMENT_SUBMITTED,
            event_data={"applicant": dto.applicant_user_id},
            events=[],
            rbac_user_id=user_id,
            rbac_roles={ApprovalRole.APPLICANT.value},
        )
        await self.repo.append(engine.asset_id, events)
        return engine

    async def approve_step(self, workflow_id: str, dto: ApprovalRequestDTO, user_id: str, user_roles: Set[str]) -> AssetRetirement:
        """Record an approval/rejection and progress the workflow if possible."""
        # In a real system we would load engine from DB; here we simulate
        engine = AssetRetirement(asset_id=workflow_id, workflow_id=workflow_id, current_status=AssetStatus.RETIREMENT_REQUESTED)
        # Build a minimal approval chain for demo
        engine.approval_chain = [
            ApprovalNode(role=ApprovalRole.APPROVER, user_id=dto.approver_user_id, approved=None),
            ApprovalNode(role=ApprovalRole.FINAL_APPROVER, user_id="final-1", approved=None),
        ]
        events = AssetStateMachineEngine.transition(
            engine=engine,
            event_type=EventType.APPROVAL if dto.approved else EventType.REJECTION,
            event_data={"approver": dto.approver_user_id},
            events=[],
            rbac_user_id=user_id,
            rbac_roles=user_roles,
        )
        await self.repo.append(engine.asset_id, events)
        return engine

    async def get_history(self, asset_id: str) -> List[HistoryEntry]:
        events = await self.repo.list_by_asset(asset_id)
        return [
            HistoryEntry(
                event_id=e.event_id,
                timestamp=e.timestamp,
                event_type=e.event_type.value,
                data=e.data,
            )
            for e in events
        ]