"""
Straight-line depreciation calculator for asset depreciation.

This module provides a concrete implementation of the depreciation calculator
using the straight-line method, where the asset value is reduced evenly over
its useful life.
"""

from typing import Dict, Any

from src.application.depreciation.calculators.base import DepreciationCalculator
class StraightLineDepreciation(DepreciationCalculator):
    """Straight-line depreciation calculator.

    This calculator depreciates an asset evenly over its useful life.
    Annual depreciation = (Cost - SalvageValue) / UsefulLife
    """

    def calculate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate straight-line depreciation.

        Args:
            data: A dictionary containing:
                - cost: The initial cost of the asset (float).
                - salvage_value: The residual value at end of life (float).
                - useful_life: The useful life in years (int).
                - year: The current year for which to compute depreciation (int).

        Returns:
            A dictionary with:
                - annual_depreciation: The depreciation amount for the year (float).
                - accumulated_depreciation: Total depreciation up to the given year (float).
                - book_value: The remaining book value after depreciation (float).
        """
        cost = float(data.get("cost", 0.0))
        salvage_value = float(data.get("salvage_value", 0.0))
        useful_life = int(data.get("useful_life", 0))
        year = int(data.get("year", 0))

        if useful_life <= 0:
            raise ValueError("useful_life must be a positive integer.")
        if year < 0:
            raise ValueError("year must be non-negative.")
        if cost < salvage_value:
            raise ValueError("cost must be greater than or equal to salvage_value.")

        annual = (cost - salvage_value) / useful_life
        accumulated = annual * min(year, useful_life)
        book_value = cost - accumulated

        return {
            "annual_depreciation": annual,
            "accumulated_depreciation": accumulated,
            "book_value": book_value,
        }