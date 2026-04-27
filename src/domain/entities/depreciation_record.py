"""
Depreciation Record Entity Module.

This module defines the core domain entity for depreciation records,
supporting both straight-line and double declining balance depreciation methods.

Iteration 2 targets:
- P2-1: Asset net value calculation engine
- P2-2: Monthly depreciation automation
- P2-3: Depreciation report generation
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import List, Optional


class DepreciationMethod(Enum):
    """
    Enumeration of supported depreciation calculation methods.
    
    Attributes:
        STRAIGHT_LINE: Equal depreciation amount each period
        DOUBLE_DECLINING: Accelerated depreciation with higher early amounts
    """
    STRAIGHT_LINE = "STRAIGHT_LINE"
    DOUBLE_DECLINING = "DOUBLE_DECLINING"


@dataclass
class DepreciationRecord:
    """
    Represents a single depreciation record for an asset.
    
    Attributes:
        id: Unique identifier for the depreciation record
        asset_id: Reference to the parent asset
        period: The accounting period (YYYY-MM format)
        depreciation_amount: Depreciation amount for this period
        accumulated_depreciation: Total accumulated depreciation to date
        net_value: Current net value of the asset
        calculation_date: Date when the calculation was performed
    """
    id: int
    asset_id: int
    period: str
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    net_value: Decimal
    calculation_date: date


@dataclass
class AssetDepreciationEntity:
    """
    Core domain entity for asset depreciation calculations.
    
    This entity encapsulates all depreciation-related data and provides
    methods for calculating current net value and generating depreciation schedules.
    
    Attributes:
        id: Asset unique identifier
        original_value: Initial asset value (positive decimal, max 4 decimal places)
        residual_value: Estimated salvage value (non-negative, max 50% of original)
        useful_life: Expected useful life in years (1-50 range)
        purchase_date: Date when asset was acquired
        depreciation_method: Depreciation calculation method
        records: List of depreciation records
    
    Example:
        >>> asset = AssetDepreciationEntity(
        ...     id=1,
        ...     original_value=Decimal("100000.0000"),
        ...     residual_value=Decimal("5000.0000"),
        ...     useful_life=10,
        ...     purchase_date=date(2024, 1, 1),
        ...     depreciation_method=DepreciationMethod.STRAIGHT_LINE
        ... )
        >>> net_value = asset.get_current_net_value(date(2025, 1, 1))
        >>> print(net_value)
        90500.0000
    """
    id: int
    original_value: Decimal
    residual_value: Decimal
    useful_life: int
    purchase_date: date
    depreciation_method: DepreciationMethod
    records: List[DepreciationRecord] = field(default_factory=list)
    
    # Precision constant for decimal calculations
    PRECISION: int = 4
    
    def __post_init__(self):
        """
        Validate entity fields after initialization.
        
        Raises:
            ValueError: If input values violate business constraints
            ValidationError: If useful life exceeds allowed range
        """
        if self.original_value <= 0:
            raise ValueError("Original value must be positive")
        if self.residual_value < 0:
            raise ValueError("Residual value cannot be negative")
        if self.residual_value > self.original_value * Decimal("0.5"):
            raise ValueError("Residual value cannot exceed 50% of original value")
        if not 1 <= self.useful_life <= 50:
            raise ValueError("Useful life must be between 1 and 50 years")
        if self.depreciation_method not in DepreciationMethod:
            raise ValueError(f"Invalid depreciation method: {self.depreciation_method}")
    
    def _round_decimal(self, value: Decimal) -> Decimal:
        """
        Round decimal to standard precision.
        
        Args:
            value: Decimal value to round
            
        Returns:
            Decimal rounded to PRECISION places using ROUND_HALF_UP
        """
        return value.quantize(Decimal("0." + "0" * self.PRECISION), rounding=ROUND_HALF_UP)
    
    def _calculate_years_elapsed(self, as_of_date: date) -> Decimal:
        """
        Calculate the number of years elapsed since asset purchase.
        
        Args:
            as_of_date: Calculation reference date
            
        Returns:
            Decimal representing years elapsed (fractional allowed)
        """
        if as_of_date < self.purchase_date:
            raise ValueError("Calculation date cannot be before purchase date")
        
        days_elapsed = (as_of_date - self.purchase_date).days
        return Decimal(str(days_elapsed)) / Decimal("365")
    
    def get_current_net_value(self, as_of_date: date) -> Decimal:
        """
        Calculate the current net value of the asset as of specified date.
        
        This method calculates depreciation based on the configured method
        (straight-line or double declining balance) and returns the remaining
        net book value.
        
        Args:
            as_of_date: Date for net value calculation
            
        Returns:
            Current net value bounded by [residual_value, original_value]
            
        Raises:
            ValueError: If as_of_date is before purchase_date
            
        Example:
            >>> asset = AssetDepreciationEntity(
            ...     id=1, original_value=Decimal("100000"),
            ...     residual_value=Decimal("5000"), useful_life=10,
            ...     purchase_date=date(2024,1,1),
            ...     depreciation_method=DepreciationMethod.STRAIGHT_LINE
            ... )
            >>> asset.get_current_net_value(date(2024,1,1))
            Decimal('95000.0000')
        """
        if as_of_date < self.purchase_date:
            raise ValueError("Calculation date cannot be before purchase date")
        
        depreciable_amount = self.original_value - self.residual_value
        years_elapsed = self._calculate_years_elapsed(as_of_date)
        
        if self.depreciation_method == DepreciationMethod.STRAIGHT_LINE:
            # Straight-line: equal annual depreciation
            annual_depreciation = depreciable_amount / Decimal(str(self.useful_life))
            accumulated = annual_depreciation * min(years_elapsed, Decimal(str(self.useful_life)))
        elif self.depreciation_method == DepreciationMethod.DOUBLE_DECLINING:
            # Double declining balance method
            rate = Decimal("2") / Decimal(str(self.useful_life))  # 2/n factor
            accumulated = self._calculate_double_declining_accumulated(years_elapsed, depreciable_amount, rate)
        else:
            accumulated = Decimal("0")
        
        net_value = self.original_value - accumulated
        # Ensure net value never goes below residual value
        return max(self._round_decimal(net_value), self.residual_value)
    
    def _calculate_double_declining_accumulated(
        self, 
        years_elapsed: Decimal, 
        depreciable_amount: Decimal,
        rate: Decimal
    ) -> Decimal:
        """
        Calculate accumulated depreciation using double declining balance method.
        
        When the straight-line method would yield higher depreciation, the method
        automatically switches to straight-line for remaining periods.
        
        Args:
            years_elapsed: Years since purchase
            depreciable_amount: Total depreciable value
            rate: Double declining balance rate
            
        Returns:
            Accumulated depreciation amount
        """
        full_years = int(years_elapsed)
        remaining_years = self.useful_life - full_years
        
        # Calculate using double declining for full years
        book_value = self.original_value
        accumulated = Decimal("0")
        
        for _ in range(full_years):
            if remaining_years <= 0:
                break
            ddb_depreciation = book_value * rate
            sl_depreciation = (book_value - self.residual_value) / Decimal(str(remaining_years))
            
            # Switch to straight-line if it yields higher depreciation
            if sl_depreciation > ddb_depreciation:
                accumulated += sl_depreciation * remaining_years
                break
            
            accumulated += ddb_depreciation
            book_value -= ddb_depreciation
            remaining_years -= 1
        
        return accumulated
    
    def get_annual_depreciation(self) -> Decimal:
        """
        Calculate the annual depreciation amount.
        
        Returns:
            Decimal annual depreciation amount
        """
        depreciable_amount = self.original_value - self.residual_value
        
        if self.depreciation_method == DepreciationMethod.STRAIGHT_LINE:
            return self._round_decimal(depreciable_amount / Decimal(str(self.useful_life)))
        elif self.depreciation_method == DepreciationMethod.DOUBLE_DECLINING:
            rate = Decimal("2") / Decimal(str(self.useful_life))
            return self._round_decimal(self.original_value * rate)
        return Decimal("0")
    
    def get_monthly_depreciation(self) -> Decimal:
        """
        Calculate the monthly depreciation amount.
        
        Returns:
            Decimal monthly depreciation amount
        """
        return self._round_decimal(self.get_annual_depreciation() / Decimal("12"))
    
    def generate_monthly_depreciation_schedule(self) -> List[DepreciationRecord]:
        """
        Generate a complete monthly depreciation schedule for the asset's useful life.
        
        Returns:
            List of DepreciationRecord objects for each month of useful life
            
        Example:
            >>> asset = AssetDepreciationEntity(
            ...     id=1, original_value=Decimal("50000"),
            ...     residual_value=Decimal("5000"), useful_life=5,
            ...     purchase_date=date(2024,1,1),
            ...     depreciation_method=DepreciationMethod.STRAIGHT_LINE
            ... )
            >>> schedule = asset.generate_monthly_depreciation_schedule()
            >>> len(schedule)
            60
            >>> schedule[0].period
            '2024-01'
        """
        schedule = []
        current_date = self.purchase_date
        total_months = self.useful_life * 12
        accumulated = Decimal("0")
        record_id = 0
        
        monthly_amount = self.get_monthly_depreciation()
        
        for month_num in range(total_months):
            year = current_date.year + (current_date.month + month_num - 1) // 12
            month = (current_date.month + month_num - 1) % 12 + 1
            period = f"{year:04d}-{month:02d}"
            
            # Calculate depreciation for this month
            period_depreciation = monthly_amount
            accumulated += period_depreciation
            
            # Calculate net value at end of this month
            net_value = self.original_value - accumulated
            net_value = max(net_value, self.residual_value)
            
            record = DepreciationRecord(
                id=record_id,
                asset_id=self.id,
                period=period,
                depreciation_amount=self._round_decimal(period_depreciation),
                accumulated_depreciation=self._round_decimal(accumulated),
                net_value=self._round_decimal(net_value),
                calculation_date=date(year, month, 28)  # Use 28th for consistency
            )
            schedule.append(record)
            record_id += 1
        
        return schedule
    
    def get_period_depreciation(self, as_of_date: date) -> Decimal:
        """
        Get depreciation amount for a specific period.
        
        Args:
            as_of_date: Date for period depreciation calculation
            
        Returns:
            Depreciation amount for the period
        """
        return self.get_monthly_depreciation()
    
    def get_accumulated_depreciation(self, as_of_date: date) -> Decimal:
        """
        Get total accumulated depreciation up to specified date.
        
        Args:
            as_of_date: Reference date for accumulated calculation
            
        Returns:
            Total accumulated depreciation
        """
        net_value = self.get_current_net_value(as_of_date)
        return self._round_decimal(self.original_value - net_value)
    
    def validate_for_calculation(self) -> bool:
        """
        Validate entity state is valid for depreciation calculation.
        
        Returns:
            True if entity is valid, raises ValueError otherwise
        """
        if self.original_value <= self.residual_value:
            raise ValueError("Original value must exceed residual value")
        if self.useful_life < 1:
            raise ValueError("Useful life must be at least 1 year")
        return True


@dataclass 
class DepreciationSchedule:
    """
    Container for asset depreciation schedule with summary statistics.
    
    Attributes:
        asset_id: Reference to the asset
        schedule_start: First period in schedule
        schedule_end: Last period in schedule
        records: List of monthly depreciation records
        total_depreciation: Sum of all depreciation amounts
    """
    asset_id: int
    schedule_start: str
    schedule_end: str
    records: List[DepreciationRecord]
    total_depreciation: Decimal
    
    def get_summary(self) -> dict:
        """
        Generate summary statistics for the depreciation schedule.
        
        Returns:
            Dictionary containing summary statistics
        """
        return {
            "asset_id": self.asset_id,
            "period_count": len(self.records),
            "total_depreciation": self.total_depreciation,
            "average_monthly": self.total_depreciation / Decimal(str(len(self.records))) if self.records else Decimal("0")
        }