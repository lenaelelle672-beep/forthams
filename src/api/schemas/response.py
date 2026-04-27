"""
API response schemas for asset lifecycle management.

This module defines Pydantic models used to structure API responses,
including status transitions, approval workflows, and historical events.
"""

from __future__ import annotations

from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
class BaseResponse(BaseModel):
    """Base response model with standard fields."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    code: int = Field(..., description="Response code")
    message: str = Field(..., description="Response message")
    success: bool = Field(True, description="Whether the request succeeded")
class AssetResponse(BaseResponse):
    """Response model for asset-related operations."""
    data: Optional[dict] = Field(None, description="Asset payload")
class StatusTransitionResponse(BaseResponse):
    """Response model for state transition operations."""
    data: Optional[dict] = Field(None, description="Transition result")
class ApprovalStepResponse(BaseResponse):
    """Response model for approval step operations."""
    data: Optional[dict] = Field(None, description="Approval result")
class EventResponse(BaseResponse):
    """Response model for event/history entries."""
    timestamp: datetime = Field(..., description="Event timestamp")
    event_type: str = Field(..., description="Type of event")
    details: Optional[dict] = Field(None, description="Event details")
    actor: Optional[str] = Field(None, description="Actor who triggered the event")
class HistoryResponse(BaseResponse):
    """Response model for history query."""
    data: List[EventResponse] = Field(default_factory=list, description="Chronological event list")
class RetirementProcessResponse(BaseResponse):
    """Response model for retirement process operations."""
    data: Optional[dict] = Field(None, description="Process instance details")
class AssetStatusResponse(BaseResponse):
    """Response model for asset status queries."""
    data: Optional[dict] = Field(None, description="Current status information")