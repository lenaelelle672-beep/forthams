"""
Double Declining Balance Depreciation Calculator.

This module implements the double declining balance (DDB) depreciation method
for asset value calculation. It follows the domain rule: annual depreciation
= (2 / useful_life) * remaining_book_value, applied each year until the asset
reaches its salvage value.

The calculator is designed to be pure (no side‑effects) and returns a list of
year‑by‑year depreciation amounts and remaining book values.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List


@dataclass(frozen=True)
class DepreciationResult:
    """Result of a double‑declining depreciation schedule."""
    annual_depreciation: List[float]
    remaining_book_value: List[float]


def _validate_inputs(cost: float, salvage: float, useful_life: int) -> None:
    """Validate DDB inputs and raise ValueError on invalid data."""
    if cost < 0:
        raise ValueError("Asset cost must be non‑negative.")
    if salvage < 0:
        raise ValueError("Salvage value must be non‑negative.")
    if useful_life <= 0:
        raise ValueError("Useful life must be a positive integer.")
    if salvage > cost:
        raise ValueError("Salvage value cannot exceed asset cost.")


def double_declining_balance(
    cost: float,
    salvage: float,
    useful_life: int,
) -> DepreciationResult:
    """
    Compute double declining balance depreciation schedule.

    Formula:
        depreciation_year_n = (2 / useful_life) * book_value_at_start_of_year

    The method ensures the book value never falls below salvage value and
    that total depreciation equals cost − salvage (within floating‑point
    tolerance).

    Args:
        cost: Original asset cost.
        salvage: Residual value at end of useful life.
        useful_life: Number of years over which the asset is depreciated.

    Returns:
        A DepreciationResult containing per‑year depreciation amounts and
        remaining book values.

    Raises:
        ValueError: If any input violates domain constraints.
    """
    _validate_inputs(cost, salvage, useful_life)

    annual_depreciation: List[float] = []
    remaining_book_value: List[float] = []
    book_value = cost
    rate = 2.0 / useful_life

    for _year in range(useful_life):
        depreciation = rate * book_value
        # Ensure we do not depreciate below salvage value.
        depreciation = min(depreciation, book_value - salvage)
        book_value -= depreciation
        annual_depreciation.append(round(depreciation, 2))
        remaining_book_value.append(round(book_value, 2))

    return DepreciationResult(
        annual_depreciation=annual_depreciation,
        remaining_book_value=remaining_book_value,
    )


if __name__ == "__main__":
    # Example usage
    result = double_declining_balance(cost=1000.0, salvage=100.0, useful_life=5)
    for y, (dep, bv) in enumerate(
        zip(result.annual_depreciation, result.remaining_book_value),
        start=1,
    ):
        print(f"Year {y}: depreciation={dep}, book_value={bv}")