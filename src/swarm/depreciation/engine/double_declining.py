"""
Double Declining Balance Depreciation Engine

This module provides the double declining balance depreciation calculation
for the forthAMS asset management system. It follows the standard double
declining balance method where depreciation is calculated at twice the
straight-line rate on the declining book value.
"""

from typing import Optional

from src.swarm.depreciation.engine.base import DepreciationEngine
from src.swarm.depreciation.domain.entities import Asset, DepreciationPeriod
from src.swarm.depreciation.domain.schemas import DepreciationResult


class DoubleDecliningEngine(DepreciationEngine):
    """Double Declining Balance Depreciation Engine.

    Calculates depreciation using the double declining balance method:
        Depreciation Expense = 2 * (Book Value at Beginning of Period / Useful Life)

    Attributes:
        asset: The asset being depreciated.
        salvage_value: The estimated salvage value at end of useful life.
        periods: Remaining useful life periods.
    """

    def __init__(
        self,
        asset: Asset,
        salvage_value: Optional[float] = None,
        periods: Optional[int] = None,
    ) -> None:
        """Initialize the double declining balance engine.

        Args:
            asset: The asset to calculate depreciation for.
            salvage_value: Optional salvage value. If not provided, defaults to 0.
            periods: Optional remaining useful life periods. If not provided,
                     defaults to the asset's total useful life.
        """
        super().__init__(asset, salvage_value, periods)
        self._rate = 2.0 / (self._periods or self._asset.useful_life or 1)

    def calculate_period(
        self,
        period: int = 1,
        book_value: Optional[float] = None,
    ) -> DepreciationResult:
        """Calculate depreciation for a single period using double declining balance.

        Args:
            period: The period number (1-indexed).
            book_value: Optional book value at start of period.
                       If not provided, uses the asset's acquisition cost.

        Returns:
            DepreciationResult containing depreciation amount and remaining book value.
        """
        if book_value is None:
            book_value = self._asset.acquisition_cost

        if period < 1:
            raise ValueError("Period must be a positive integer")

        # Calculate depreciation for this period
        depreciation = book_value * self._rate

        # Ensure we don't depreciate below salvage value
        remaining_value = book_value - depreciation
        if remaining_value < (self._salvage_value or 0):
            depreciation = book_value - (self._salvage_value or 0)
            remaining_value = self._salvage_value or 0

        return DepreciationResult(
            depreciation_amount=depreciation,
            remaining_book_value=remaining_value,
            period=period,
            method="double_declining_balance",
        )

    def calculate_full_schedule(
        self,
    ) -> list[DepreciationResult]:
        """Calculate full depreciation schedule over the asset's useful life.

        Returns:
            List of DepreciationResult for each period until book value
            reaches salvage value.
        """
        schedule = []
        book_value = self._asset.acquisition_cost
        period = 1

        while book_value > (self._salvage_value or 0):
            result = self.calculate_period(period, book_value)
            schedule.append(result)
            book_value = result.remaining_book_value
            period += 1

            # Safety guard against infinite loops
            if period > (self._periods or self._asset.useful_life or 100):
                break

        return schedule

    @property
    def rate(self) -> float:
        """Return the double declining rate for this asset."""
        return self._rate