"""
Depreciation Service Module

Provides business logic for asset depreciation calculations.
Supports multiple depreciation methods (straight-line, double-declining).
"""

from decimal import Decimal
from typing import Optional

from .calculators.base import DepreciationCalculator
from .calculators.straight_line import StraightLineCalculator
from .calculators.double_declining import DoubleDecliningCalculator
class DepreciationService:
    """Service responsible for calculating and tracking asset depreciation."""

    def __init__(self) -> None:
        self._calculators: dict[str, DepreciationCalculator] = {
            "straight_line": StraightLineCalculator(),
            "double_declining": DoubleDecliningCalculator(),
        }

    def calculate_depreciation(
        self,
        asset_cost: Decimal,
        salvage_value: Decimal,
        useful_life_years: int,
        method: str = "straight_line",
        period_months: Optional[int] = None,
    ) -> Decimal:
        """
        Calculate depreciation for a given period.

        Args:
            asset_cost: The initial cost of the asset.
            salvage_value: The expected residual value at end of life.
            useful_life_years: The useful life of the asset in years.
            method: Depreciation method identifier.
            period_months: Optional specific period in months; if omitted,
                          calculates full year depreciation.

        Returns:
            Decimal depreciation amount for the period.

        Raises:
            ValueError: If method is unsupported or inputs are invalid.
        """
        if method not in self._calculators:
            raise ValueError(f"Unsupported depreciation method: {method}")

        calculator = self._calculators[method]
        return calculator.calculate(
            asset_cost=asset_cost,
            salvage_value=salvage_value,
            useful_life_years=useful_life_years,
            period_months=period_months,
        )

    def get_supported_methods(self) -> list[str]:
        """Return a list of supported depreciation method identifiers."""
        return list(self._calculators.keys())