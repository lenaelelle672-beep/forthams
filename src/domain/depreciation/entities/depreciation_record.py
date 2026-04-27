"""
Asset Depreciation Record Entity Module

This module defines the core domain entities for depreciation calculation and tracking.
Supports straight-line and double-declining balance depreciation methods.

Iteration 2: Core depreciation engine and report functionality
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Optional, List
from uuid import UUID, uuid4


class DepreciationMethod(str, Enum):
    """
    Supported depreciation calculation methods.
    
    Attributes:
        STRAIGHT_LINE: Linear depreciation evenly distributed over useful life
        DOUBLE_DECLINING: Accelerated depreciation with higher early-period deductions
    """
    STRAIGHT_LINE = "straight_line"
    DOUBLE_DECLINING = "double_declining"


class RecordStatus(str, Enum):
    """Status of a depreciation record."""
    PENDING = "pending"
    POSTED = "posted"
    REVERSED = "reversed"


@dataclass
class DepreciationRecord:
    """
    Represents a single depreciation calculation record for an asset.
    
    Attributes:
        id: Unique identifier for the depreciation record
        asset_id: Reference to the parent asset
        period: The accounting period (month) this depreciation applies to
        method: Depreciation method used for calculation
        monthly_depreciation: Amount of depreciation for this period
        accumulated_depreciation: Total depreciation to date
        book_value: Remaining book value after this period's depreciation
        status: Current status of the record
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last modified
    """
    asset_id: UUID
    period: date
    method: DepreciationMethod
    monthly_depreciation: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    status: RecordStatus = RecordStatus.PENDING
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        """Validate depreciation values after initialization."""
        if self.monthly_depreciation < Decimal("0"):
            raise ValueError("Monthly depreciation cannot be negative")
        if self.accumulated_depreciation < Decimal("0"):
            raise ValueError("Accumulated depreciation cannot be negative")
        if self.book_value < Decimal("0"):
            raise ValueError("Book value cannot be negative")
    
    def post(self) -> None:
        """
        Mark this depreciation record as posted.
        
        Raises:
            ValueError: If record is already reversed
        """
        if self.status == RecordStatus.REVERSED:
            raise ValueError("Cannot post a reversed record")
        self.status = RecordStatus.POSTED
        self.updated_at = datetime.utcnow()
    
    def reverse(self) -> None:
        """
        Reverse this depreciation record.
        
        This creates a compensating entry to undo the depreciation.
        """
        self.status = RecordStatus.REVERSED
        self.updated_at = datetime.utcnow()


@dataclass
class AssetDepreciationProfile:
    """
    Asset depreciation profile containing all metadata needed for calculation.
    
    This is an immutable value object that captures the depreciation configuration
    for an asset at the time of acquisition.
    
    Attributes:
        asset_id: Unique identifier for the asset
        acquisition_date: Date when asset was acquired
        acquisition_cost: Original cost of the asset
        useful_life_months: Expected useful life in months
        salvage_value: Expected residual value at end of useful life
        method: Depreciation method to apply
        depreciation_rate: Annual depreciation rate (for double-declining)
    """
    asset_id: UUID
    acquisition_date: date
    acquisition_cost: Decimal
    useful_life_months: int
    salvage_value: Decimal
    method: DepreciationMethod
    depreciation_rate: Optional[Decimal] = None
    
    def __post_init__(self):
        """Validate the depreciation profile."""
        if self.acquisition_cost <= Decimal("0"):
            raise ValueError("Acquisition cost must be positive")
        if self.useful_life_months < 1:
            raise ValueError("Useful life must be at least 1 month")
        if self.salvage_value < Decimal("0"):
            raise ValueError("Salvage value cannot be negative")
        if self.salvage_value >= self.acquisition_cost:
            raise ValueError("Salvage value must be less than acquisition cost")
        
        # Validate depreciation rate for double-declining method
        if self.method == DepreciationMethod.DOUBLE_DECLINING:
            if self.depreciation_rate is None:
                # Default to double-declining rate (2 / useful_life_years)
                useful_life_years = Decimal(str(self.useful_life_months / 12))
                self.depreciation_rate = (Decimal("2") / useful_life_years).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
    
    @property
    def depreciable_amount(self) -> Decimal:
        """Calculate the total depreciable amount."""
        return self.acquisition_cost - self.salvage_value
    
    @property
    def annual_straight_line_rate(self) -> Decimal:
        """Calculate the annual straight-line depreciation rate."""
        useful_life_years = Decimal(str(self.useful_life_months / 12))
        return (Decimal("1") / useful_life_years).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    
    @property
    def monthly_straight_line_amount(self) -> Decimal:
        """Calculate the monthly straight-line depreciation amount."""
        return (self.depreciable_amount / Decimal(str(self.useful_life_months))).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )


@dataclass
class DepreciationSchedule:
    """
    A collection of depreciation records forming a complete schedule.
    
    Attributes:
        profile: The asset depreciation profile
        records: List of depreciation records
        generated_at: Timestamp when schedule was generated
    """
    profile: AssetDepreciationProfile
    records: List[DepreciationRecord] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.utcnow)
    
    def total_depreciation(self) -> Decimal:
        """Calculate total accumulated depreciation from all records."""
        return sum((r.accumulated_depreciation for r in self.records), Decimal("0"))
    
    def remaining_book_value(self) -> Decimal:
        """Calculate current book value from the last record or initial cost."""
        if not self.records:
            return self.profile.acquisition_cost
        return self.records[-1].book_value
    
    def get_record_for_period(self, period: date) -> Optional[DepreciationRecord]:
        """Retrieve depreciation record for a specific period."""
        for record in self.records:
            if record.period == period:
                return record
        return None


@dataclass
class DepreciationCalculationResult:
    """
    Result of a depreciation calculation operation.
    
    Attributes:
        success: Whether the calculation was successful
        record: The depreciation record if successful
        error_message: Error description if failed
        calculation_details: Additional details about the calculation
    """
    success: bool
    record: Optional[DepreciationRecord] = None
    error_message: Optional[str] = None
    calculation_details: dict = field(default_factory=dict)
    
    @classmethod
    def success_result(cls, record: DepreciationRecord, **details) -> "DepreciationCalculationResult":
        """Create a successful calculation result."""
        return cls(success=True, record=record, calculation_details=details)
    
    @classmethod
    def error_result(cls, message: str) -> "DepreciationCalculationResult":
        """Create an error result."""
        return cls(success=False, error_message=message)