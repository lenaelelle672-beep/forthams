"""
Double Declining Balance Depreciation Engine.

This engine calculates depreciation using the double declining balance method,
which applies a fixed rate (2 / useful_life) to the asset's current book value,
accelerating depreciation in the early years of the asset's life.
"""

from typing import Dict, Any, Optional
from src.domain.entities.asset import Asset
from src.domain.value_objects.depreciation_period import DepreciationPeriod
from src.domain.value_objects.depreciation_result import DepreciationResult
from src.domain.exceptions import DepreciationError
class DoubleDecliningEngine:
    """
    Engine for computing double declining balance depreciation.

    The depreciation rate is computed as (2 / useful_life). Each period's
    depreciation is applied to the asset's book value at the start of the period,
    ensuring the book value never falls below the salvage value.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize the double declining balance engine.

        Args:
            config: Optional configuration dictionary. Supported keys:
                - "precision" (int): Number of decimal places for monetary values.
                  Defaults to 2.
        """
        self.config = config or {}
        self.precision: int = self.config.get("precision", 2)

    def calculate_depreciation(
        self,
        asset: Asset,
        period: DepreciationPeriod,
    ) -> DepreciationResult:
        """
        Calculate depreciation for a single period using double declining balance.

        The depreciation amount is computed as:
            depreciation = rate * book_value_at_period_start
        where rate = 2 / useful_life.

        The book value is constrained to remain at or above the salvage value.
        If a full period depreciation would reduce book value below salvage,
        depreciation is limited to the difference between book value and salvage.

        Args:
            asset: The asset being depreciated.
            period: The depreciation period containing start/end dates and
                    the book value at the period start.

        Returns:
            DepreciationResult containing the depreciation amount, updated book
            value, and any flags indicating salvage value reached.

        Raises:
            DepreciationError: If asset useful_life is zero or negative.
        """
        if asset.useful_life <= 0:
            raise DepreciationError(
                f"Asset {asset.id} has invalid useful_life: {asset.useful_life}."
            )

        rate = 2.0 / asset.useful_life
        book_start = period.book_value_start
        salvage = asset.salvage_value

        depreciation = rate * book_start
        book_end = book_start - depreciation

        # Ensure book value does not fall below salvage value.
        if book_end < salvage:
            depreciation = book_start - salvage
            book_end = salvage
            reached_salvage = True
        else:
            reached_salvage = False

        # Apply configured precision rounding.
        depreciation = round(depreciation, self.precision)
        book_end = round(book_end, self.precision)

        return DepreciationResult(
            depreciation_amount=depreciation,
            book_value_end=book_end,
            period_start=period.start_date,
            period_end=period.end_date,
            reached_salvage=reached_salvage,
        )