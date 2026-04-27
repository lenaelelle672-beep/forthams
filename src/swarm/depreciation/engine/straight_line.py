"""Straight-line depreciation calculator for the forthAMS asset management system."""

from dataclasses import dataclass
from typing import Optional

from src.swarm.depreciation.engine.base import DepreciationEngine, DepreciationResult
@dataclass
class StraightLineConfig:
    """Configuration for straight-line depreciation."""
    asset_cost: float
    salvage_value: float
    useful_life_years: float
class StraightLineEngine(DepreciationEngine):
    """Straight-line depreciation engine."""

    def __init__(self, config: StraightLineConfig) -> None:
        self.config = config

    def calculate(self, period: Optional[int] = None) -> DepreciationResult:
        """Calculate straight-line depreciation.

        Args:
            period: Optional period in years. If None, calculates total depreciation.

        Returns:
            DepreciationResult with depreciation amount and remaining book value.
        """
        annual_depreciation = (self.config.asset_cost - self.config.salvage_value) / self.config.useful_life_years
        if period is None:
            total_depreciation = annual_depreciation * self.config.useful_life_years
            remaining_value = self.config.salvage_value
            return DepreciationResult(
                depreciation_amount=total_depreciation,
                remaining_book_value=remaining_value,
                period=self.config.useful_life_years,
                annual_depreciation=annual_depreciation,
            )
        else:
            dep_for_period = annual_depreciation * period
            remaining_value = self.config.asset_cost - dep_for_period
            return DepreciationResult(
                depreciation_amount=dep_for_period,
                remaining_book_value=remaining_value,
                period=period,
                annual_depreciation=annual_depreciation,
            )