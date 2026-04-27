"""
DepreciationPeriod value object.

Represents a period over which an asset depreciates. Supports validation and
immutable operations for use in asset depreciation calculations.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Final


@dataclass(frozen=True)
class DepreciationPeriod:
    """Value object for a depreciation period.

    Attributes:
        years: Number of years in the period (must be positive).
        months: Number of months in the period (0..11).
    """

    years: int
    months: int = 0

    def __post_init__(self) -> None:
        """Validate fields and normalize representation."""
        object.__setattr__(self, "years", self._normalize_years_months(self.years, self.months)[0])
        object.__setattr__(self, "months", self._normalize_years_months(self.years, self.months)[1])
        self._validate()

    @staticmethod
    def _normalize_years_months(years: int, months: int) -> tuple[int, int]:
        """Normalize years/months so that 0 <= months < 12."""
        if months < 0:
            years -= (-months) // 12 + 1
            months += (((-months) // 12) + 1) * 12
        extra_years = months // 12
        months = months % 12
        years += extra_years
        return years, months

    def _validate(self) -> None:
        """Enforce domain rules; raise ValueError on invalid data."""
        if not isinstance(self.years, int):
            raise TypeError(f"years must be int, got {type(self.years).__name__}")
        if not isinstance(self.months, int):
            raise TypeError(f"months must be int, got {type(self.months).__name__}")
        if self.years <= 0:
            raise ValueError(f"years must be positive, got {self.years}")
        if not (0 <= self.months < 12):
            raise ValueError(f"months must be in [0, 11], got {self.months}")

    @property
    def total_months(self) -> int:
        """Return the period expressed as total months (positive integer)."""
        return self.years * 12 + self.months

    @property
    def as_timedelta(self) -> timedelta:
        """Convert to timedelta using an average month length of 30 days."""
        return timedelta(days=self.total_months * 30)

    def __add__(self, other: int) -> DepreciationPeriod:
        """Add an integer number of months and return a new normalized period."""
        if not isinstance(other, int):
            return NotImplemented
        return DepreciationPeriod(*self._normalize_years_months(self.years, self.months + other))

    def __radd__(self, other: int) -> DepreciationPeriod:
        """Support sum([...], start) where start is a DepreciationPeriod."""
        if other == 0:
            return self
        return self.__add__(other)

    def __str__(self) -> str:
        return f"{self.years}y{self.months}m"

    def __repr__(self) -> str:
        return f"DepreciationPeriod(years={self.years}, months={self.months})"