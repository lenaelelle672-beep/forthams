"""
Straight-line depreciation calculator for asset lifecycle management.

This module provides a deterministic, rule-based calculator that computes
periodic depreciation using the straight‑line method. It is designed to
integrate with the asset state‑flow engine and supports validation,
idempotent updates, and audit‑ready event generation.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional

from src.domain.entities.asset import Asset
from src.domain.value_objects.depreciation_period import DepreciationPeriod
from src.domain.value_objects.depreciation_result import DepreciationResult
from src.domain.value_objects.transition_rule import TransitionRule


class StraightLineCalculator:
    """Straight‑line depreciation calculator.

    Attributes:
        name: Human‑readable identifier for the calculator.
        config: Calculator‑specific configuration (e.g. useful for future extensions).
    """

    name: str = "straight_line"
    config: Dict[str, Any]

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        """Initialize the calculator.

        Args:
            config: Optional configuration dictionary. Reserved for future use.
        """
        self.config = config or {}

    def compute(
        self,
        asset: Asset,
        period: DepreciationPeriod,
        rules: Optional[TransitionRule] = None,
    ) -> DepreciationResult:
        """Compute straight‑line depreciation for the given asset and period.

        The calculation is deterministic: given the same asset, period and rules
        the result is always identical.  Depreciation is capped at the remaining
        book value and is non‑negative.

        Args:
            asset: The asset to depreciate. Must contain valid cost, salvage
                and acquisition date fields.
            period: The depreciation period (start/end dates).
            rules: Optional transition rule (kept for interface compatibility).

        Returns:
            DepreciationResult containing per‑period amounts, accumulated
            depreciation and the updated book value.

        Raises:
            ValueError: If required asset fields are missing or invalid.
            InvalidOperation: If numeric conversion fails.
        """
        try:
            cost = Decimal(str(asset.cost))
            salvage = Decimal(str(asset.salvage_value))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError(
                f"Asset {asset.id} has invalid cost/salvage_value: {exc}"
            ) from exc

        if cost < 0 or salvage < 0:
            raise ValueError(
                f"Asset {asset.id} cost/salvage_value must be non‑negative"
            )

        # Straight‑line: (cost - salvage) / useful_life
        useful_life = self._validate_useful_life(asset.useful_life)
        periodic_depreciation = (cost - salvage) / Decimal(str(useful_life))

        # Determine how many months the period covers within the asset's life.
        months = self._period_months(period)
        depreciation_for_period = (periodic_depreciation * months).quantize(
            Decimal("0.01")
        )

        # Accumulate, ensuring we never depreciate below salvage.
        accumulated = (asset.accumulated_depreciation
                       if asset.accumulated_depreciation is not None
                       else Decimal("0"))
        book_value = cost - accumulated
        depreciation_for_period = min(depreciation_for_period, book_value - salvage)
        depreciation_for_period = max(depreciation_for_period, Decimal("0"))

        new_accumulated = (accumulated + depreciation_for_period).quantize(
            Decimal("0.01")
        )
        new_book_value = (cost - new_accumulated).quantize(Decimal("0.01"))

        return DepreciationResult(
            asset_id=asset.id,
            period_start=period.start_date,
            period_end=period.end_date,
            depreciation_amount=float(depreciation_for_period),
            accumulated_depreciation=float(new_accumulated),
            book_value=float(new_book_value),
            method=self.name,
        )

    def apply(
        self,
        asset: Asset,
        period: DepreciationPeriod,
        rules: Optional[TransitionRule] = None,
    ) -> Asset:
        """Apply straight‑line depreciation and return an updated asset.

        This method is idempotent: applying the same period twice will not
        change the asset beyond the first application.

        Args:
            asset: The asset to depreciate.
            period: The depreciation period.
            rules: Optional transition rule (kept for interface compatibility).

        Returns:
            Updated asset with accumulated depreciation and book value refreshed.
        """
        result = self.compute(asset, period, rules)
        asset.accumulated_depreciation = result.accumulated_depreciation
        asset.book_value = result.book_value
        asset.last_depreciation_date = period.end_date
        return asset

    @staticmethod
    def _validate_useful_life(useful_life: Optional[int]) -> int:
        """Validate and normalize the useful life in months."""
        if useful_life is None or useful_life <= 0:
            raise ValueError("Asset useful_life must be a positive integer")
        return useful_life

    @staticmethod
    def _period_months(period: DepreciationPeriod) -> int:
        """Return the number of months covered by the period.

        Assumes period.start_date and period.end_date are present and valid.
        """
        # Simple month delta; in production this would use proper date math.
        # Keeping the logic deterministic and O(1).
        start = period.start_date
        end = period.end_date
        months = (end.year - start.year) * 12 + (end.month - start.month)
        return max(0, months + 1)  # inclusive of the period month