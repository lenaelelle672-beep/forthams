"""
Depreciation Calculator Engine

Provides core depreciation calculation logic for assets.
Supports configurable methods (straight-line, double-declining) and
ensures deterministic, auditable computations.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Optional


class DepreciationMethodError(ValueError):
    """Raised when an unsupported depreciation method is requested."""
    pass


class DepreciationCalculator:
    """
    Engine for computing asset depreciation.

    Deterministic and side-effect free: given the same inputs,
    the calculator always returns identical outputs.
    """

    SUPPORTED_METHODS = {"straight_line", "double_declining"}

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize the depreciation calculator.

        Args:
            config: Optional configuration dict with keys:
                - method: str, one of SUPPORTED_METHODS (default: "straight_line")
                - precision: int, number of decimal places for rounding (default: 2)
        """
        cfg = config or {}
        self.method: str = cfg.get("method", "straight_line")
        self.precision: int = int(cfg.get("precision", 2))
        if self.method not in self.SUPPORTED_METHODS:
            raise DepreciationMethodError(
                f"Unsupported depreciation method: {self.method}. "
                f"Supported methods: {self.SUPPORTED_METHODS}"
            )

    def calculate(
        self,
        acquisition_cost: float,
        salvage_value: float,
        useful_life_years: float,
        current_year: int = 0,
        accumulated_depreciation: float = 0.0,
    ) -> Dict[str, float]:
        """
        Compute depreciation for a given year.

        Args:
            acquisition_cost: Original asset cost.
            salvage_value: Expected residual value at end of life.
            useful_life_years: Total useful life in years.
            current_year: Zero-based year index for which to compute depreciation.
            accumulated_depreciation: Depreciation booked in prior years (for DDB).

        Returns:
            Dict with keys:
                - depreciation: depreciation amount for the year
                - book_value: book value after applying this year's depreciation
                - year: the year index
        """
        if useful_life_years <= 0:
            raise ValueError("useful_life_years must be greater than zero")
        if acquisition_cost < 0 or salvage_value < 0:
            raise ValueError("costs and salvage value must be non-negative")
        if current_year < 0:
            raise ValueError("current_year must be non-negative")

        if self.method == "straight_line":
            depreciation = self._straight_line(
                acquisition_cost, salvage_value, useful_life_years
            )
        else:  # double_declining
            depreciation = self._double_declining(
                acquisition_cost,
                salvage_value,
                useful_life_years,
                accumulated_depreciation,
            )

        book_value = acquisition_cost - (accumulated_depreciation + depreciation)
        return {
            "depreciation": round(depreciation, self.precision),
            "book_value": round(book_value, self.precision),
            "year": current_year,
        }

    def _straight_line(
        self, acquisition_cost: float, salvage_value: float, useful_life_years: float
    ) -> float:
        """Straight-line depreciation per year."""
        return (acquisition_cost - salvage_value) / useful_life_years

    def _double_declining(
        self,
        acquisition_cost: float,
        salvage_value: float,
        useful_life_years: float,
        accumulated_depreciation: float,
    ) -> float:
        """
        Double-declining balance depreciation for the current year.

        Ensures book value does not fall below salvage value.
        """
        rate = 2.0 / useful_life_years
        book_value_start = acquisition_cost - accumulated_depreciation
        depreciation = rate * book_value_start
        # Prevent depreciating below salvage value
        book_value_end = book_value_start - depreciation
        if book_value_end < salvage_value:
            depreciation = max(0.0, book_value_start - salvage_value)
        return depreciation