"""
API response schemas for the asset retirement management system.

This module defines Pydantic models used to structure HTTP responses,
including success envelopes, error payloads, and pagination metadata.
All schemas are designed to be compatible with the existing asset directory
data structures and to support the state‑flow, approval‑chain, and
history‑query APIs defined in the spec.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypeVar

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

T = TypeVar("T")
class SuccessResponse(BaseModel):
    """Standardised success envelope for API responses."""
    model_config = ConfigDict(title="SuccessResponse")

    status: str = Field(default="success", description="Operation status.")
    data: T
    message: Optional[str] = Field(default=None, description="Human‑readable message.")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of the response.",
    )
class ErrorResponse(BaseModel):
    """Standardised error envelope for API responses."""
    model_config = ConfigDict(title="ErrorResponse")

    status: str = Field(default="error", description="Operation status.")
    error: str
    message: Optional[str] = Field(default=None, description="Human‑readable error details.")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="UTC timestamp of the error.",
    )
class PaginatedResponse(BaseModel):
    """Paginated list response wrapper."""
    model_config = ConfigDict(title="PaginatedResponse")

    items: List[T]
    total: int
    page: int = Field(ge=1, description="Current page number (1‑based).")
    page_size: int = Field(ge=1, description="Number of items per page.")
class AssetStateHistoryItem(BaseModel):
    """A single entry in an asset's immutable event/history stream."""
    model_config = ConfigDict(title="AssetStateHistoryItem")

    event_id: str
    asset_id: str
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    event_type: str
    occurred_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)
class ApprovalChainResponse(BaseModel):
    """Response shape for approval‑chain related endpoints."""
    model_config = ConfigDict(title="ApprovalChainResponse")

    process_id: str
    current_step: str
    status: str
    approvers: List[str]
    history: List[ApprovalHistoryEntry] = Field(default_factory=list)
class ApprovalHistoryEntry(BaseModel):
    """A recorded approval action within a chain."""
    model_config = ConfigDict(title="ApprovalHistoryEntry")

    step: int
    role: str
    actor_id: str
    decision: str  # "approve" | "reject" | "return"
    commented_at: datetime
    comment: Optional[str] = None
def paginate(items: List[T], page: int, page_size: int) -> PaginatedResponse:
    """Utility to slice a list into a paginated response."""
    if page < 1:
        raise ValueError("page must be >= 1")
    if page_size < 1:
        raise ValueError("page_size must be >= 1")

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return PaginatedResponse(
        items=items[start:end],
        total=total,
        page=page,
        page_size=page_size,
    )
# Re‑exports for convenience
__all__ = [
    "SuccessResponse",
    "ErrorResponse",
    "PaginatedResponse",
    "AssetStateHistoryItem",
    "ApprovalChainResponse",
    "ApprovalHistoryEntry",
    "paginate",
]