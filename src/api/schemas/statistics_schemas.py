"""
Statistics API schemas.

Provides Pydantic models for asset statistics, retirement progress, and
approval-chain related request/response payloads. All schemas are designed
to be compatible with the existing asset directory data model and support
strict validation for state-machine-driven retirement workflows.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class AssetStateStats(BaseModel):
    """Aggregate statistics per asset state (counts and percentages)."""

    state: str = Field(..., description="Asset state label.")
    count: int = Field(0, description="Number of assets in this state.")
    percentage: float = Field(0.0, description="Percentage of total assets.")

    class Config:
        extra = "forbid"


class AssetRetirementProgress(BaseModel):
    """Current retirement progress for a single asset."""

    asset_id: str = Field(..., description="Unique asset identifier.")
    current_state: str = Field(..., description="Current state in the lifecycle.")
    target_state: str = Field(..., description="Requested target state.")
    approval_index: int = Field(0, description="Index of the next approval step.")
    approvals_completed: int = Field(0, description="Number of approvals obtained.")
    total_approvals_required: int = Field(0, description="Total approvals needed.")
    rejected: bool = Field(False, description="Whether the request has been rejected.")
    rejected_reason: Optional[str] = Field(None, description="Reason for rejection.")

    @field_validator("asset_id", "current_state", "target_state")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("field must not be empty")
        return v.strip()

    class Config:
        extra = "forbid"


class RetirementRequestIn(BaseModel):
    """Payload accepted when initiating a retirement request."""

    asset_id: str = Field(..., description="Asset to retire.")
    reason: Optional[str] = Field(None, description="Retirement justification.")
    immediate: bool = Field(False, description="Whether to process synchronously.")

    @field_validator("asset_id")
    @classmethod
    def asset_id_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("asset_id must not be empty")
        return v.strip()

    class Config:
        extra = "forbid"


class RetirementRequestOut(BaseModel):
    """Response after submitting a retirement request."""

    request_id: str = Field(..., description="Unique request identifier.")
    asset_id: str = Field(..., description="Asset identifier.")
    status: str = Field(..., description="Current lifecycle status.")
    workflow_instance_id: Optional[str] = Field(None, description="Orchestration instance id.")
    submitted_at: str = Field(..., description="ISO-8601 submission timestamp.")
    estimated_completion_ms: Optional[int] = Field(None, description="Estimated latency.")

    class Config:
        extra = "forbid"


class ApprovalStepIn(BaseModel):
    """Payload for advancing an approval step."""

    request_id: str = Field(..., description="Retirement request id.")
    actor_id: str = Field(..., description="User/role performing the action.")
    approve: bool = Field(..., description="True to approve, False to reject.")
    comment: Optional[str] = Field(None, description="Optional audit comment.")

    @field_validator("request_id", "actor_id")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("field must not be empty")
        return v.strip()

    class Config:
        extra = "forbid"


class ApprovalStepOut(BaseModel):
    """Result of an approval action."""

    request_id: str = Field(..., description="Request identifier.")
    step_index: int = Field(..., description="Approval step index.")
    actor_id: str = Field(..., description="Actor who performed the action.")
    approved: bool = Field(..., description="Whether this step approved.")
    status: str = Field(..., description="Resulting workflow status.")
    comment: Optional[str] = Field(None, description="Attached comment.")

    class Config:
        extra = "forbid"


class HistoryEvent(BaseModel):
    """An immutable event record for audit and replay."""

    event_id: str = Field(..., description="Unique event identifier.")
    occurred_at: str = Field(..., description="ISO-8601 timestamp.")
    entity_id: str = Field(..., description="Asset or request id.")
    entity_type: str = Field(..., description="Type of entity involved.")
    event_type: str = Field(..., description="Kind of event (state_change, approval, rejection, etc).")
    data: dict = Field(default_factory=dict, description="Structured event payload.")
    actor_id: Optional[str] = Field(None, description="User/role that triggered the event.")
    previous_state: Optional[str] = Field(None, description="Prior state, if applicable.")
    comment: Optional[str] = Field(None, description="Optional human-readable note.")

    class Config:
        extra = "forbid"


class HistoryResponse(BaseModel):
    """Paginated list of immutable events for an asset/request."""

    entity_id: str = Field(..., description="Queried entity identifier.")
    events: List[HistoryEvent] = Field(default_factory=list, description="Chronological events.")
    total: int = Field(..., description="Total number of events.")

    class Config:
        extra = "forbid"


class AssetStatisticsResponse(BaseModel):
    """Aggregated asset-state statistics."""

    total_assets: int = Field(..., description="Total assets considered.")
    states: List[AssetStateStats] = Field(default_factory=list, description="Per-state breakdown.")

    class Config:
        extra = "forbid"


__all__ = [
    "AssetStateStats",
    "AssetRetirementProgress",
    "RetirementRequestIn",
    "RetirementRequestOut",
    "ApprovalStepIn",
    "ApprovalStepOut",
    "HistoryEvent",
    "HistoryResponse",
    "AssetStatisticsResponse",
]