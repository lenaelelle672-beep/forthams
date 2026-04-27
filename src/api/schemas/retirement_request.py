"""
Retirement Request Schemas

This module defines Pydantic models for validating and serializing
retirement request payloads used by the asset retirement API.
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
    """Input schema for initiating a retirement request."""

    asset_id: str = Field(..., description="Unique identifier of the asset to retire.")
    requester_id: str = Field(..., description="User ID of the retirement requester.")
    reason: str = Field(..., description="Business justification for retirement.")
    estimated_value: Optional[float] = Field(
        default=None,
        description="Estimated financial value of the asset at retirement.",
    )
    metadata: dict = Field(default_factory=dict, description="Additional context.")

    @field_validator("asset_id", "requester_id", "reason")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()

    def to_domain(self) -> RetirementRequest:
        """Convert DTO to domain entity."""
        return RetirementRequest(
            asset_id=self.asset_id,
            requester_id=self.requester_id,
            reason=self.reason,
            estimated_value=self.estimated_value,
            metadata=self.metadata,
        )
@dataclass(frozen=True)
class RetirementRequestOut:
    """Output schema for a retirement request."""

    request_id: str = Field(..., description="Unique identifier of the request.")
    asset_id: str = Field(..., description="Asset identifier.")
    requester_id: str = Field(..., description="User ID of the requester.")
    status: AssetStatus = Field(..., description="Current lifecycle status.")
    reason: str = Field(..., description="Retirement reason.")
    estimated_value: Optional[float] = Field(
        default=None, description="Estimated financial value."
    )
    approval_chain: List[str] = Field(default_factory=list, description="Ordered approver IDs.")
    current_approver: Optional[str] = Field(
        default=None, description="User ID of the next required approver."
    )
    created_at: datetime = Field(..., description="Request creation timestamp.")
    updated_at: datetime = Field(..., description="Last update timestamp.")
    metadata: dict = Field(default_factory=dict, description="Additional context.")

    @classmethod
    def from_domain(cls, entity: RetirementRequest) -> RetirementRequestOut:
        """Convert domain entity to DTO."""
        return cls(
            request_id=entity.request_id,
            asset_id=entity.asset_id,
            requester_id=entity.requester_id,
            status=entity.status,
            reason=entity.reason,
            estimated_value=entity.estimated_value,
            approval_chain=list(entity.approval_chain),
            current_approver=entity.current_approver,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
            metadata=dict(entity.metadata),
        )
@dataclass(frozen=True)
class RetirementRequestTransitionIn:
    """Input schema for transitioning a retirement request (approve/reject)."""

    request_id: str = Field(..., description="Unique identifier of the request.")
    actor_id: str = Field(..., description="User ID performing the transition.")
    action: TransitionRule = Field(..., description="Transition action (approve/reject).")
    comment: Optional[str] = Field(default=None, description="Optional comment.")

    @field_validator("request_id", "actor_id", "action")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be empty")
        return v.strip()
@dataclass(frozen=True)
class RetirementRequestHistoryOut:
    """Output schema for historical events of a retirement request."""

    event_id: str = Field(..., description="Unique event identifier.")
    request_id: str = Field(..., description="Request identifier.")
    timestamp: datetime = Field(..., description="Event timestamp.")
    event_type: str = Field(..., description="Type of event (e.g., CREATED, APPROVED, REJECTED).""")
    actor_id: Optional[str] = Field(default=None, description="User who caused the event.")
    details: dict = Field(default_factory=dict, description="Event payload.")