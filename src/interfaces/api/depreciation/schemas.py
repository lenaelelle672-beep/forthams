"""
Depreciation API Schemas Module.

This module defines Pydantic schemas for the depreciation API endpoints.
It provides request/response models for depreciation calculations, 
reporting, and configuration.

Architecture:
    - Request schemas: Input validation for API endpoints
    - Response schemas: Output serialization for API responses
    - Internal schemas: Domain model representations

Used by:
    - Depreciation endpoints (endpoints.py)
    - Retirement flow integration
    - Depreciation calculation service

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict


class DepreciationMethod(str, Enum):
    """
    Supported depreciation calculation methods.
    
    Attributes:
        STRAIGHT_LINE: Linear depreciation over useful life
        DOUBLE_DECLINING: Accelerated depreciation using double-declining balance
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"


class DepreciationStatus(str, Enum):
    """
    Asset depreciation lifecycle states.
    
    States:
        ACTIVE: Asset is in service and depreciating
        FULLY_DEPRECIATED: Depreciation schedule completed
        DISPOSED: Asset has been retired/disposed
        SUSPENDED: Depreciation temporarily paused
    """
    ACTIVE = "active"
    FULLY_DEPRECIATED = "fully_depreciated"
    DISPOSED = "disposed"
    SUSPENDED = "suspended"


# =============================================================================
# Request Schemas
# =============================================================================

class DepreciationCalculateRequest(BaseModel):
    """
    Request schema for calculating depreciation for an asset.
    
    Attributes:
        asset_id: Unique identifier of the asset
        method: Depreciation calculation method
        useful_life_years: Expected useful life in years
        salvage_value: Residual value at end of useful life
        purchase_date: Date when asset was acquired
        original_cost: Initial cost of the asset
        start_date: Date to begin calculation from
    """
    asset_id: str = Field(..., description="Unique identifier of the asset")
    method: DepreciationMethod = Field(
        default=DepreciationMethod.STRAIGHT_LINE,
        description="Depreciation calculation method"
    )
    useful_life_years: int = Field(
        ...,
        gt=0,
        le=100,
        description="Expected useful life in years (1-100)"
    )
    salvage_value: float = Field(
        ...,
        ge=0,
        description="Residual value at end of useful life"
    )
    purchase_date: datetime = Field(..., description="Date when asset was acquired")
    original_cost: float = Field(..., gt=0, description="Initial cost of the asset")
    start_date: Optional[datetime] = Field(
        default=None,
        description="Date to begin calculation from"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "asset_id": "AST-2024-001",
                "method": "straight_line",
                "useful_life_years": 5,
                "salvage_value": 1000.0,
                "purchase_date": "2024-01-01T00:00:00Z",
                "original_cost": 50000.0
            }
        }
    )


class DepreciationReportRequest(BaseModel):
    """
    Request schema for generating depreciation reports.
    
    Attributes:
        start_date: Beginning of reporting period
        end_date: End of reporting period
        asset_ids: Optional filter for specific assets
        category_id: Optional filter by asset category
        department_id: Optional filter by department
        method: Optional filter by depreciation method
    """
    start_date: datetime = Field(..., description="Beginning of reporting period")
    end_date: datetime = Field(..., description="End of reporting period")
    asset_ids: Optional[List[str]] = Field(
        default=None,
        description="Filter for specific assets"
    )
    category_id: Optional[str] = Field(
        default=None,
        description="Filter by asset category"
    )
    department_id: Optional[str] = Field(
        default=None,
        description="Filter by department"
    )
    method: Optional[DepreciationMethod] = Field(
        default=None,
        description="Filter by depreciation method"
    )


class DepreciationConfigUpdateRequest(BaseModel):
    """
    Request schema for updating depreciation configuration.
    
    Attributes:
        default_useful_life: Default useful life for new assets
        default_method: Default depreciation method
        max_useful_life: Maximum allowed useful life
        allow_method_override: Whether users can override default method
    """
    default_useful_life: Optional[int] = Field(
        default=None,
        gt=0,
        le=100,
        description="Default useful life for new assets"
    )
    default_method: Optional[DepreciationMethod] = Field(
        default=None,
        description="Default depreciation method"
    )
    max_useful_life: Optional[int] = Field(
        default=None,
        gt=0,
        le=100,
        description="Maximum allowed useful life"
    )
    allow_method_override: Optional[bool] = Field(
        default=None,
        description="Whether users can override default method"
    )


# =============================================================================
# Response Schemas
# =============================================================================

class DepreciationRecordResponse(BaseModel):
    """
    Response schema for a single depreciation record.
    
    Attributes:
        id: Unique record identifier
        asset_id: Associated asset identifier
        period_start: Start of depreciation period
        period_end: End of depreciation period
        depreciation_amount: Amount depreciated in this period
        accumulated_depreciation: Total depreciation to date
        book_value: Current book value of asset
        method: Depreciation method used
        created_at: Timestamp of record creation
    """
    id: str = Field(..., description="Unique record identifier")
    asset_id: str = Field(..., description="Associated asset identifier")
    period_start: datetime = Field(..., description="Start of depreciation period")
    period_end: datetime = Field(..., description="End of depreciation period")
    depreciation_amount: float = Field(..., description="Amount depreciated in this period")
    accumulated_depreciation: float = Field(
        ...,
        description="Total depreciation to date"
    )
    book_value: float = Field(..., description="Current book value of asset")
    method: DepreciationMethod = Field(..., description="Depreciation method used")
    created_at: datetime = Field(..., description="Timestamp of record creation")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "DEP-001",
                "asset_id": "AST-2024-001",
                "period_start": "2024-01-01T00:00:00Z",
                "period_end": "2024-01-31T23:59:59Z",
                "depreciation_amount": 816.67,
                "accumulated_depreciation": 9799.97,
                "book_value": 40200.03,
                "method": "straight_line",
                "created_at": "2024-01-31T23:59:59Z"
            }
        }
    )


class DepreciationScheduleResponse(BaseModel):
    """
    Response schema for complete depreciation schedule.
    
    Attributes:
        asset_id: Asset identifier
        original_cost: Initial asset cost
        salvage_value: Residual value
        useful_life_years: Expected useful life
        method: Depreciation method
        total_depreciation: Sum of all depreciation
        schedule: List of period depreciation records
        completed: Whether schedule is fully depreciated
    """
    asset_id: str = Field(..., description="Asset identifier")
    original_cost: float = Field(..., description="Initial asset cost")
    salvage_value: float = Field(..., description="Residual value")
    useful_life_years: int = Field(..., description="Expected useful life")
    method: DepreciationMethod = Field(..., description="Depreciation method")
    total_depreciation: float = Field(
        ...,
        description="Sum of all depreciation"
    )
    schedule: List[DepreciationRecordResponse] = Field(
        ...,
        description="List of period depreciation records"
    )
    completed: bool = Field(..., description="Whether schedule is fully depreciated")


class DepreciationReportResponse(BaseModel):
    """
    Response schema for depreciation report.
    
    Attributes:
        report_id: Unique report identifier
        generated_at: Report generation timestamp
        period_start: Report period start
        period_end: Report period end
        total_assets: Number of assets in report
        total_original_cost: Sum of original costs
        total_depreciation: Sum of period depreciation
        total_accumulated: Sum of accumulated depreciation
        total_book_value: Sum of current book values
        records: Detailed depreciation records
    """
    report_id: str = Field(..., description="Unique report identifier")
    generated_at: datetime = Field(..., description="Report generation timestamp")
    period_start: datetime = Field(..., description="Report period start")
    period_end: datetime = Field(..., description="Report period end")
    total_assets: int = Field(..., description="Number of assets in report")
    total_original_cost: float = Field(
        ...,
        description="Sum of original costs"
    )
    total_depreciation: float = Field(
        ...,
        description="Sum of period depreciation"
    )
    total_accumulated: float = Field(
        ...,
        description="Sum of accumulated depreciation"
    )
    total_book_value: float = Field(
        ...,
        description="Sum of current book values"
    )
    records: List[DepreciationRecordResponse] = Field(
        ...,
        description="Detailed depreciation records"
    )


class DepreciationSummaryResponse(BaseModel):
    """
    Response schema for depreciation summary statistics.
    
    Attributes:
        period: Reporting period
        total_assets: Total number of depreciating assets
        total_original_cost: Total original cost
        total_accumulated: Total accumulated depreciation
        total_book_value: Total current book value
        period_depreciation: Total depreciation in this period
        fully_depreciated_count: Number of fully depreciated assets
    """
    period: str = Field(..., description="Reporting period")
    total_assets: int = Field(..., description="Total number of depreciating assets")
    total_original_cost: float = Field(
        ...,
        description="Total original cost"
    )
    total_accumulated: float = Field(
        ...,
        description="Total accumulated depreciation"
    )
    total_book_value: float = Field(
        ...,
        description="Total current book value"
    )
    period_depreciation: float = Field(
        ...,
        description="Total depreciation in this period"
    )
    fully_depreciated_count: int = Field(
        ...,
        description="Number of fully depreciated assets"
    )


class DepreciationConfigResponse(BaseModel):
    """
    Response schema for depreciation configuration.
    
    Attributes:
        id: Configuration identifier
        default_useful_life: Default useful life setting
        default_method: Default depreciation method
        max_useful_life: Maximum allowed useful life
        allow_method_override: Method override permission
        updated_at: Last configuration update
    """
    id: str = Field(..., description="Configuration identifier")
    default_useful_life: int = Field(..., description="Default useful life setting")
    default_method: DepreciationMethod = Field(
        ...,
        description="Default depreciation method"
    )
    max_useful_life: int = Field(..., description="Maximum allowed useful life")
    allow_method_override: bool = Field(
        ...,
        description="Method override permission"
    )
    updated_at: datetime = Field(..., description="Last configuration update")


class DepreciationBulkCalculateRequest(BaseModel):
    """
    Request schema for bulk depreciation calculation.
    
    Attributes:
        asset_ids: List of asset identifiers to calculate
        as_of_date: Date for calculation
        force_recalculate: Whether to recalculate already processed periods
    """
    asset_ids: List[str] = Field(
        ...,
        min_length=1,
        description="List of asset identifiers to calculate"
    )
    as_of_date: Optional[datetime] = Field(
        default=None,
        description="Date for calculation (defaults to today)"
    )
    force_recalculate: bool = Field(
        default=False,
        description="Whether to recalculate already processed periods"
    )


class DepreciationBulkCalculateResponse(BaseModel):
    """
    Response schema for bulk depreciation calculation.
    
    Attributes:
        total_requested: Number of assets requested
        successful: Number of successful calculations
        failed: Number of failed calculations
        errors: List of error messages for failed assets
        results: List of depreciation records for successful assets
    """
    total_requested: int = Field(
        ...,
        description="Number of assets requested"
    )
    successful: int = Field(..., description="Number of successful calculations")
    failed: int = Field(..., description="Number of failed calculations")
    errors: List[dict] = Field(
        default_factory=list,
        description="List of error messages for failed assets"
    )
    results: List[DepreciationRecordResponse] = Field(
        default_factory=list,
        description="List of depreciation records for successful assets"
    )