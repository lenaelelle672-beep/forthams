"""
Retirement Request Schema

This module defines the data contracts for the asset retirement workflow.
It provides request/response models for initiating and tracking retirement
applications, aligned with the asset state machine and approval chain.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from pydantic import Field, field_validator

from src.domain.entities.retirement_request import RetirementRequest
from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule
@dataclass(frozen=True)
class RetirementRequestIn:
    """Input model for initiating a retirement request.

    Attributes:
        asset_id: Unique identifier of the asset to retire.
        requester_id: Identifier of the user requesting retirement.
        reason: Business justification for retirement.
        scheduled_date: Optional planned retirement date.
    """
    asset_id: str = Field(..., description="Unique identifier of the asset to retire")
    requester_id: str = Field(..., description="Identifier of the user requesting retirement")
    reason: str = Field(..., description="Business justification for retirement")
    scheduled_date: Optional[datetime] = Field(
        default=None, description="Optional planned retirement date"
    )

    @field_validator("asset_id", "requester_id", "reason")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()
@dataclass(frozen=True)
class RetirementRequestOut:
    """Output model representing a retirement request.

    Attributes:
        request_id: Unique identifier for the retirement request.
        asset_id: Asset being retired.
        requester_id: User who initiated the request.
        status: Current lifecycle status.
        approval_chain: Ordered approval nodes and decisions.
        history: Immutable event log for auditability.
        created_at: Request creation timestamp.
        updated_at: Last status change timestamp.
    """
    request_id: str = Field(..., description="Unique identifier for the retirement request")
    asset_id: str = Field(..., description="Asset being retired")
    requester_id: str = Field(..., description="User who initiated the request")
    status: AssetStatus = Field(..., description="Current lifecycle status")
    approval_chain: List[dict] = Field(default_factory=list, description="Ordered approval nodes and decisions")
    history: List[dict] = Field(default_factory=list, description="Immutable event log for auditability")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Request creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last status change timestamp")

    @classmethod
    def from_domain(cls, entity: RetirementRequest) -> "RetirementRequestOut":
        """Construct an output model from a domain entity.

        Ensures compatibility with existing asset directory structures
        while exposing workflow metadata.
        """
        return cls(
            request_id=entity.request_id,
            asset_id=entity.asset_id,
            requester_id=entity.requester_id,
            status=entity.status,
            approval_chain=entity.approval_chain,
            history=entity.history,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )
@dataclass(frozen=True)
class RetirementRequestTransition:
    """Describes a valid state transition for retirement requests.

    Encodes deterministic migration rules and guards required by the
    state machine. All transitions are explicit; no implicit side-effects.
    """
    from_status: AssetStatus
    to_status: AssetStatus
    trigger: str
    guard: Optional[TransitionRule] = None

    def validate(self, context: dict) -> bool:
        """Evaluate guard conditions for the transition.

        Returns True when the guard is absent or evaluates successfully.
        """
        if self.guard is not None:
            return self.guard.evaluate(context)
        return True
TRANSITION_MAP: List[RetirementRequestTransition] = [
    RetirementRequestTransition(
        from_status=AssetStatus.DRAFT,
        to_status=AssetStatus.SUBMITTED,
        trigger="submit",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.SUBMITTED,
        to_status=AssetStatus.APPROVING,
        trigger="approve",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.APPROVING,
        to_status=AssetStatus.ADMIN_REVIEW,
        trigger="approve",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.ADMIN_REVIEW,
        to_status=AssetStatus.REJECTED,
        trigger="reject",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.ADMIN_REVIEW,
        to_status=AssetStatus.RETIRED,
        trigger="approve",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.REJECTED,
        to_status=AssetStatus.REJECTED,
        trigger="any",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.ADMIN_REVIEW,
        to_status=AssetStatus.REVERT_TO_APPLICANT,
        trigger="request_changes",
        guard=None,
    ),
    RetirementRequestTransition(
        from_status=AssetStatus.REVERT_TO_APPLICANT,
        to_status=AssetStatus.SUBMITTED,
        trigger="resubmit",
        guard=None,
    ),
]
def validate_transition(
    current_status: AssetStatus,
    trigger: str,
    context: Optional[dict] = None,
) -> AssetStatus:
    """Deterministically resolve the next status given current status and trigger.

    Raises:
        ValueError: When no valid transition exists for the (status, trigger) pair.
    """
    context = context or {}
    for t in TRANSITION_MAP:
        if t.from_status == current_status and (t.trigger == trigger or t.trigger == "any"):
            if t.validate(context):
                return t.to_status
            raise ValueError(
                f"Guard validation failed for transition {t.from_status} -> {t.to_status}"
            )
    raise ValueError(
        f"Invalid transition: status={current_status}, trigger={trigger}"
    )
def to_domain(request_id: str, raw: dict) -> RetirementRequest:
    """Convert a raw dictionary (e.g., from API payload) into a domain entity.

    Ensures backward compatibility with existing asset directory data
    by applying sensible defaults and normalization.
    """
    return RetirementRequest(
        request_id=request_id,
        asset_id=raw["asset_id"],
        requester_id=raw["requester_id"],
        reason=raw.get("reason", ""),
        status=AssetStatus(raw.get("status", AssetStatus.DRAFT.value)),
        approval_chain=raw.get("approval_chain", []),
        history=raw.get("history", []),
        created_at=raw.get("created_at", datetime.utcnow()),
        updated_at=raw.get("updated_at", datetime.utcnow()),
    )