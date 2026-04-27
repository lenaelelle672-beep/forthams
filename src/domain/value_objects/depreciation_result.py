"""
Value object representing the result of a depreciation calculation.

This module is part of the asset status lifecycle engine and supports
both straight-line and double-declining-balance depreciation methods.
The value object is immutable and validates inputs to ensure deterministic
state transitions.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class DepreciationResult:
    """Immutable value object for depreciation computation results.

    Attributes:
        asset_id: Unique identifier of the asset being depreciated.
        period_start: Start of the depreciation period (inclusive).
        period_end: End of the depreciation period (inclusive).
        method: Depreciation method used (e.g., "straight_line", "double_declining").
        start_value: Asset book value at the beginning of the period.
        accumulated_depreciation: Total depreciation recognized up to the end of the period.
        period_depreciation: Depreciation expense for this specific period.
        end_value: Asset book value after applying period depreciation.
        status: Human-readable status of the calculation (e.g., "success", "error").
        error_message: Optional error description when status is "error".
    """

    asset_id: str
    period_start: int
    period_end: int
    method: str
    start_value: Decimal
    accumulated_depreciation: Decimal
    period_depreciation: Decimal
    end_value: Decimal
    status: str = "success"
    error_message: Optional[str] = None

    def __post_init__(self) -> None:
        """Validate fields and ensure numeric invariants."""
        # Normalize string inputs to Decimal for deterministic arithmetic.
        self._normalize_decimal_fields()

        # Basic domain validations.
        if not self.asset_id or not isinstance(self.asset_id, str):
            raise ValueError("asset_id must be a non-empty string.")
        if self.period_start > self.period_end:
            raise ValueError("period_start must be <= period_end.")
        if self.start_value < 0:
            raise ValueError("start_value must be non-negative.")
        if self.accumulated_depreciation < 0:
            raise ValueError("accumulated_depreciation must be non-negative.")
        if self.period_depreciation < 0:
            raise ValueError("period_depreciation must be non-negative.")
        if self.end_value < 0:
            raise ValueError("end_value must be non-negative.")
        if self.method not in {"straight_line", "double_declining"}:
            raise ValueError(
                f"Unsupported depreciation method: {self.method}. "
                "Supported methods: 'straight_line', 'double_declining'."
            )

    def _normalize_decimal_fields(self) -> None:
        """Convert string or numeric inputs to Decimal for consistent arithmetic."""
        # Use object.__setattr__ because the dataclass is frozen.
        for field in ("start_value", "accumulated_depreciation",
                      "period_depreciation", "end_value"):
            value = getattr(self, field)
            if isinstance(value, str):
                try:
                    normalized = Decimal(value)
                except InvalidOperation as exc:
                    raise ValueError(
                        f"Invalid decimal string for '{field}': {value!r}"
                    ) from exc
                object.__setattr__(self, field, normalized)
            elif isinstance(value, (int, float)):
                object.__setattr__(self, field, Decimal(str(value)))
            elif not isinstance(value, Decimal):
                raise TypeError(
                    f"Field '{field}' must be str, int, float or Decimal, "
                    f"got {type(value).__name__}."
                )

    def to_dict(self) -> Dict[str, Any]:
        """Return a plain-dict representation for serialization."""
        return {
            "asset_id": self.asset_id,
            "period_start": self.period_start,
            "period_end": self.period_end,
            "method": self.method,
            "start_value": str(self.start_value),
            "accumulated_depreciation": str(self.accumulated_depreciation),
            "period_depreciation": str(self.period_depreciation),
            "end_value": str(self.end_value),
            "status": self.status,
            "error_message": self.error_message,
        }

    @classmethod
    def success(
        cls,
        asset_id: str,
        period_start: int,
        period_end: int,
        method: str,
        start_value: Decimal | str | int | float,
        accumulated_depreciation: Decimal | str | int | float,
        period_depreciation: Decimal | str | int | float,
        end_value: Decimal | str | int | float,
    ) -> "DepreciationResult":
        """Factory constructor for a successful depreciation result."""
        return cls(
            asset_id=asset_id,
            period_start=period_start,
            period_end=period_end,
            method=method,
            start_value=start_value,
            accumulated_depreciation=accumulated_depreciation,
            period_depreciation=period_depreciation,
            end_value=end_value,
            status="success",
            error_message=None,
        )

    @classmethod
    def error(
        cls,
        asset_id: str,
        period_start: int,
        period_end: int,
        method: str,
        error_message: str,
    ) -> "DepreciationResult":
        """Factory constructor for a failed depreciation result."""
        return cls(
            asset_id=asset_id,
            period_start=period_start,
            period_end=period_end,
            method=method,
            start_value=Decimal("0"),
            accumulated_depreciation=Decimal("0"),
            period_depreciation=Decimal("0"),
            end_value=Decimal("0"),
            status="error",
            error_message=error_message,
        )