"""
Double Declining Balance Depreciation Calculator.

This module provides a calculator for computing asset depreciation
using the double declining balance method. It is designed to integrate
with the asset state‑flow engine and support the phased implementation
outlined in plan.md (Phase 3).

The calculator is deterministic, pure, and returns a non‑negative
depreciation amount for a given period.
"""

from __future__ import annotations

from typing import Final

from src.application.depreciation.calculators.base import DepreciationCalculator
class DoubleDecliningCalculator(DepreciationCalculator):
    """Double declining balance depreciation calculator.

    This class implements the double declining balance method:
        depreciation = (2 / useful_life) * book_value
    where book_value is the asset value at the start of the period.
    The calculation is performed using integer arithmetic (cents) to
    avoid floating‑point drift.

    Attributes:
        useful_life_years: Remaining useful life of the asset in years.
        acquisition_cost_cents: Original acquisition cost in cents.
        accumulated_depreciation_cents: Depreciation accumulated so far in cents.
    """

    def __init__(
        self,
        useful_life_years: int,
        acquisition_cost_cents: int,
        accumulated_depreciation_cents: int = 0,
    ) -> None:
        """Initialize the double declining balance calculator.

        Args:
            useful_life_years: Remaining useful life of the asset (years).
            acquisition_cost_cents: Original acquisition cost in cents.
            accumulated_depreciation_cents: Depreciation already recorded
                (default 0).
        """
        if useful_life_years <= 0:
            raise ValueError("useful_life_years must be a positive integer")
        if acquisition_cost_cents < 0:
            raise ValueError("acquisition_cost_cents must be non‑negative")
        if accumulated_depreciation_cents < 0:
            raise ValueError("accumulated_depreciation_cents must be non‑negative")
        if accumulated_depreciation_cents > acquisition_cost_cents:
            raise ValueError(
                "accumulated_depreciation_cents cannot exceed acquisition_cost_cents"
            )

        self.useful_life_years: Final[int] = useful_life_years
        self.acquisition_cost_cents: Final[int] = acquisition_cost_cents
        self.accumulated_depreciation_cents: int = accumulated_depreciation_cents

    def depreciation_for_period(self, book_value_cents: int) -> int:
        """Compute depreciation for a single period using double declining balance.

        Args:
            book_value_cents: Asset book value at the start of the period (cents).

        Returns:
            Depreciation amount for the period in cents (non‑negative).
        """
        if book_value_cents < 0:
            raise ValueError("book_value_cents must be non‑negative")

        # Double declining rate = 2 / useful_life_years
        rate_numerator = 2
        depreciation_cents = (rate_numerator * book_value_cents) // self.useful_life_years
        return depreciation_cents

    def apply_period(self, book_value_cents: int) -> tuple[int, int]:
        """Apply one depreciation period and return updated values.

        Args:
            book_value_cents: Asset book value at the start of the period.

        Returns:
            A tuple (depreciation_cents, new_book_value_cents).
        """
        dep = self.depreciation_for_period(book_value_cents)
        new_book_value = book_value_cents - dep
        self.accumulated_depreciation_cents += dep
        return dep, new_book_value

    def remaining_book_value(self) -> int:
        """Return the current remaining book value in cents."""
        return self.acquisition_cost_cents - self.accumulated_depreciation_cents

    def is_depreciated(self) -> bool:
        """Return True if the asset has been fully depreciated."""
        return self.remaining_book_value() <= 0

    def to_dict(self) -> dict[str, int]:
        """Serialize the calculator state to a plain dictionary."""
        return {
            "useful_life_years": self.useful_life_years,
            "acquisition_cost_cents": self.acquisition_cost_cents,
            "accumulated_depreciation_cents": self.accumulated_depreciation_cents,
        }

    @classmethod
    def from_dict(cls, data: dict[str, int]) -> "DoubleDecliningCalculator":
        """Reconstruct a calculator from a dictionary produced by to_dict."""
        return cls(
            useful_life_years=data["useful_life_years"],
            acquisition_cost_cents=data["acquisition_cost_cents"],
            accumulated_depreciation_cents=data.get(
                "accumulated_depreciation_cents", 0
            ),
        )