"""
Straight-Line Depreciation Calculator.

This module implements the straight-line depreciation calculation method
for the asset management system.

Formula: monthly_depreciation = (acquisition_cost - salvage_value) / useful_life_months

Reference: SWARM-2026-Q2-003 Iteration 2
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class StraightLineParams(BaseModel):
    """
    Input parameters for straight-line depreciation calculation.
    
    Attributes:
        asset_id: Asset unique identifier (UUID v4)
        acquisition_cost: Original acquisition cost (precision: 2 decimal places)
        useful_life_months: Expected useful life in months (minimum: 1)
        salvage_value: Estimated residual value at end of useful life
    """
    asset_id: UUID = Field(..., description="Asset unique identifier")
    acquisition_cost: Decimal = Field(
        ..., 
        ge=Decimal("0"), 
        description="Original acquisition cost"
    )
    useful_life_months: int = Field(
        ..., 
        ge=1, 
        description="Expected useful life in months (minimum: 1)"
    )
    salvage_value: Decimal = Field(
        ..., 
        ge=Decimal("0"), 
        description="Estimated residual value at end of useful life"
    )
    
    @field_validator("acquisition_cost", "salvage_value", mode="before")
    @classmethod
    def round_to_two_decimals(cls, v):
        """Round decimal values to 2 decimal places."""
        if isinstance(v, (int, float, str)):
            return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return v
    
    @model_validator(mode="after")
    def validate_salvage_not_exceed_cost(self):
        """Validate that salvage value does not exceed acquisition cost."""
        if self.salvage_value > self.acquisition_cost:
            raise ValueError(
                f"Salvage value ({self.salvage_value}) cannot exceed "
                f"acquisition cost ({self.acquisition_cost})"
            )
        return self


class StraightLineResult(BaseModel):
    """
    Result of straight-line depreciation calculation.
    
    Attributes:
        asset_id: Asset unique identifier
        depreciable_amount: Total amount to depreciate (acquisition_cost - salvage_value)
        monthly_depreciation: Monthly depreciation amount (precision: 4 decimal places)
        total_depreciation: Total depreciation over useful life
        useful_life_months: Expected useful life in months
        book_value: Current book value of the asset
        accumulated_depreciation: Accumulated depreciation amount
    """
    asset_id: UUID = Field(..., description="Asset unique identifier")
    depreciable_amount: Decimal = Field(
        ..., 
        description="Total amount to depreciate"
    )
    monthly_depreciation: Decimal = Field(
        ..., 
        description="Monthly depreciation amount (precision: 4 decimal places)"
    )
    total_depreciation: Decimal = Field(
        ..., 
        description="Total depreciation over useful life"
    )
    useful_life_months: int = Field(
        ..., 
        description="Expected useful life in months"
    )
    book_value: Decimal = Field(
        ..., 
        description="Current book value of the asset"
    )
    accumulated_depreciation: Decimal = Field(
        default=Decimal("0"), 
        description="Accumulated depreciation amount"
    )
    
    model_config = {"arbitrary_types_allowed": True}


class StraightLineCalculator:
    """
    Straight-line depreciation calculator.
    
    Calculates depreciation using the straight-line method where the asset
    cost is spread evenly over its useful life.
    
    Formula: monthly_depreciation = (acquisition_cost - salvage_value) / useful_life_months
    
    Example:
        >>> params = StraightLineParams(
        ...     asset_id=uuid4(),
        ...     acquisition_cost=Decimal("100000"),
        ...     useful_life_months=60,
        ...     salvage_value=Decimal("5000")
        ... )
        >>> calculator = StraightLineCalculator()
        >>> result = calculator.calculate(params)
        >>> result.monthly_depreciation
        Decimal('1583.3333')
    """
    
    def calculate(self, params: StraightLineParams) -> StraightLineResult:
        """
        Calculate straight-line depreciation for an asset.
        
        Args:
            params: Validated straight-line depreciation parameters
            
        Returns:
            StraightLineResult containing depreciation calculation details
            
        Raises:
            ValueError: If calculation would result in depreciation below salvage value
        """
        depreciable_amount = params.acquisition_cost - params.salvage_value
        
        monthly_depreciation = depreciable_amount / Decimal(params.useful_life_months)
        monthly_depreciation = monthly_depreciation.quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        total_depreciation = monthly_depreciation * Decimal(params.useful_life_months)
        total_depreciation = total_depreciation.quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        if total_depreciation > depreciable_amount:
            total_depreciation = depreciable_amount
        
        book_value = params.acquisition_cost - total_depreciation
        
        return StraightLineResult(
            asset_id=params.asset_id,
            depreciable_amount=depreciable_amount,
            monthly_depreciation=monthly_depreciation,
            total_depreciation=total_depreciation,
            useful_life_months=params.useful_life_months,
            book_value=book_value,
            accumulated_depreciation=Decimal("0")
        )
    
    def calculate_for_period(
        self, 
        params: StraightLineParams, 
        months_elapsed: int,
        existing_accumulated: Optional[Decimal] = None
    ) -> StraightLineResult:
        """
        Calculate straight-line depreciation for a specific period.
        
        Args:
            params: Validated straight-line depreciation parameters
            months_elapsed: Number of months already elapsed since acquisition
            existing_accumulated: Existing accumulated depreciation from prior periods
            
        Returns:
            StraightLineResult with updated accumulated depreciation and book value
        """
        result = self.calculate(params)
        
        if existing_accumulated is None:
            existing_accumulated = Decimal("0")
        
        accumulated_depreciation = result.monthly_depreciation * Decimal(months_elapsed)
        accumulated_depreciation = accumulated_depreciation.quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        
        max_accumulated = params.acquisition_cost - params.salvage_value
        if accumulated_depreciation > max_accumulated:
            accumulated_depreciation = max_accumulated
        
        book_value = params.acquisition_cost - accumulated_depreciation
        
        return StraightLineResult(
            asset_id=params.asset_id,
            depreciable_amount=result.depreciable_amount,
            monthly_depreciation=result.monthly_depreciation,
            total_depreciation=result.total_depreciation,
            useful_life_months=params.useful_life_months,
            book_value=book_value,
            accumulated_depreciation=accumulated_depreciation
        )


def calculate_straight_line_depreciation(
    asset_id: UUID,
    acquisition_cost: Decimal,
    useful_life_months: int,
    salvage_value: Decimal
) -> StraightLineResult:
    """
    Convenience function to calculate straight-line depreciation.
    
    Args:
        asset_id: Asset unique identifier
        acquisition_cost: Original acquisition cost
        useful_life_months: Expected useful life in months
        salvage_value: Estimated residual value
        
    Returns:
        StraightLineResult with calculation details
    """
    params = StraightLineParams(
        asset_id=asset_id,
        acquisition_cost=acquisition_cost,
        useful_life_months=useful_life_months,
        salvage_value=salvage_value
    )
    calculator = StraightLineCalculator()
    return calculator.calculate(params)