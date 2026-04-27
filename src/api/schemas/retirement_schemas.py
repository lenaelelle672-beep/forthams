"""
Retirement API schemas.

Provides Pydantic models for retirement request submission, approval workflow,
and history queries. All schemas are designed to be compatible with existing
asset directory data structures and support validation of state transitions.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from src.domain.entities.retirement_request import RetirementRequest
from src.domain.entities.retirement_history import RetirementHistory
from src.domain.entities.asset import Asset
from src.domain.value_objects.retirement_status import RetirementStatus
class RetirementRequestCreate(BaseModel):
    """Schema for creating a new retirement request."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    asset_id: str = Field(..., description="Unique identifier of the asset to retire.")
    reason: str = Field(..., description="Business justification for retirement.")
    estimated_value: Optional[float] = Field(
        default=None,
        description="Estimated scrap or disposal value, if applicable.",
    )
    requested_by: str = Field(..., description="User ID of the applicant.")

    def to_domain(self, asset: Asset) -> RetirementRequest:
        """Convert schema to domain entity, preserving compatibility with existing data."""
        return RetirementRequest(
            asset_id=self.asset_id,
            asset=asset,
            reason=self.reason,
            estimated_value=self.estimated_value,
            requested_by=self.requested_by,
            status=RetirementStatus.DRAFT,
            created_at=datetime.utcnow(),
        )
class RetirementRequestResponse(BaseModel):
    """Schema for retirement request responses."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    request_id: str = Field(..., description="Unique identifier of the retirement request.")
    asset_id: str = Field(..., description="Asset identifier.")
    status: RetirementStatus = Field(..., description="Current lifecycle status.")
    reason: str = Field(..., description="Business justification for retirement.")
    estimated_value: Optional[float] = Field(
        default=None, description="Estimated disposal value."
    )
    requested_by: str = Field(..., description="User ID of the applicant.")
    current_approver: Optional[str] = Field(
        default=None, description="User ID of the current approval node, if any."
    )
    created_at: datetime = Field(..., description="Request creation timestamp.")
    updated_at: Optional[datetime] = Field(
        default=None, description="Last update timestamp."
    )

    @classmethod
    def from_domain(cls, domain: RetirementRequest) -> "RetirementRequestResponse":
        """Create response from domain entity."""
        return cls(
            request_id=domain.id,
            asset_id=domain.asset_id,
            status=domain.status,
            reason=domain.reason,
            estimated_value=domain.estimated_value,
            requested_by=domain.requested_by,
            current_approver=domain.current_approver,
            created_at=domain.created_at,
            updated_at=domain.updated_at,
        )
class RetirementHistoryList(BaseModel):
    """Schema for paginated history query responses."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    events: List[RetirementHistory] = Field(..., description="Chronological event records.")
    total: int = Field(..., description="Total number of events for this asset.")

    @classmethod
    def from_domain_list(
        cls, events: List[RetirementHistory], total: int
    ) -> "RetirementHistoryList":
        """Create history list from domain entities."""
        return cls(events=events, total=total)
class ApprovalChainUpdate(BaseModel):
    """Schema for advancing or rolling back the approval chain."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    request_id: str = Field(..., description="Retirement request identifier.")
    action: str = Field(..., description="'approve' or 'reject' or 'return'.")
    approver_id: Optional[str] = Field(
        default=None, description="User ID performing the action."
    )
    comment: Optional[str] = Field(
        default=None, description="Optional comment for audit trail."
    )

    def to_domain(self) -> dict:
        """Convert to domain command representation."""
        return {
            "request_id": self.request_id,
            "action": self.action,
            "approver_id": self.approver_id,
            "comment": self.comment,
        }
class RetirementStateTransition(BaseModel):
    """Schema describing a valid state transition for audit and validation."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    from_state: RetirementStatus = Field(..., description="Previous status.")
    to_state: RetirementStatus = Field(..., description="Next status.")
    trigger: str = Field(..., description="Event or action that caused the transition.")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When transition occurred.")