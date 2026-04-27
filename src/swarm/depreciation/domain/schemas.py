"""Depreciation domain schemas module.

This module defines Pydantic schemas for the depreciation domain,
including request/response models for depreciation calculations.
"""
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field


class DepreciationRecordSchema(BaseModel):
    """Schema for depreciation record."""
    id: int
    asset_id: int
    depreciation_date: datetime
    depreciation_amount: Decimal
    accumulated_amount: Decimal
    net_value: Decimal
    method: str
    
    class Config:
        from_attributes = True


class DepreciationRequestSchema(BaseModel):
    """Request schema for depreciation calculation."""
    asset_id: int
    purchase_date: datetime
    original_value: Decimal
    useful_life_months: int
    salvage_value: Optional[Decimal] = Field(default=Decimal("0"))
    method: str = Field(default="straight_line")
    start_date: Optional[datetime] = None


class DepreciationResponseSchema(BaseModel):
    """Response schema for depreciation calculation."""
    asset_id: int
    current_net_value: Decimal
    accumulated_depreciation: Decimal
    monthly_depreciation: Decimal
    remaining_months: int
    records: List[DepreciationRecordSchema]


class AssetDepreciationSummarySchema(BaseModel):
    """Summary schema for asset depreciation overview."""
    asset_id: int
    asset_name: str
    original_value: Decimal
    current_net_value: Decimal
    accumulated_depreciation: Decimal
    depreciation_rate: Decimal
    last_depreciation_date: Optional[datetime] = None
    status: str