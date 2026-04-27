"""
Straight-line depreciation engine for asset value calculation.

This engine provides a deterministic, single-pass computation of straight-line
depreciation per accounting period. It is designed to be integrated into the
asset state‑flow and approval pipelines.
"""

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class DepreciationInput:
    """Input bundle for a single depreciation computation."""
    initial_value: float
    salvage_value: float
    useful_life_years: float
    elapsed_years: float = 0.0
    period_start: Optional[str] = None
    period_end: Optional[str] = None


@dataclass
class DepreciationResult:
    """Result bundle returned by the engine."""
    annual_depreciation: float
    current_book_value: float
    remaining_life_years: float
    elapsed_years: float
    is_complete: bool


class StraightLineEngine:
    """
    Straight-line depreciation engine.

    Formula:
        annual_depreciation = (initial_value - salvage_value) / useful_life_years
        current_book_value = initial_value - (annual_depreciation * elapsed_years)
        remaining_life = useful_life_years - elapsed_years

    Guarantees:
        - Deterministic output for identical inputs.
        - Graceful handling of edge cases (zero/negative life, fully depreciated assets).
    """

    def __init__(self) -> None:
        self._cache: Dict[str, DepreciationResult] = field(default_factory=dict)

    def compute(self, inp: DepreciationInput) -> DepreciationResult:
        """
        Compute straight-line depreciation for the given input.

        Args:
            inp: DepreciationInput containing asset financials and timing.

        Returns:
            DepreciationResult with per‑period figures and completion flag.

        Raises:
            ValueError: If useful_life_years is not positive.
        """
        if inp.useful_life_years <= 0:
            raise ValueError("useful_life_years must be positive")

        # Annual depreciation is constant under straight‑line.
        annual = (inp.initial_value - inp.salvage_value) / inp.useful_life_years
        # Clamp to zero for non‑positive deltas (asset fully depreciated or over‑valued).
        annual = max(0.0, annual)

        current = max(0.0, inp.initial_value - annual * inp.elapsed_years)
        remaining = max(0.0, inp.useful_life_years - inp.elapsed_years)
        complete = inp.elapsed_years >= inp.useful_life_years

        result = DepreciationResult(
            annual_depreciation=annual,
            current_book_value=current,
            remaining_life_years=remaining,
            elapsed_years=inp.elapsed_years,
            is_complete=complete,
        )
        # Deterministic cache key ensures idempotence for same input.
        key = self._key(inp)
        self._cache[key] = result
        return result

    def batch_compute(self, inputs: list[DepreciationInput]) -> list[DepreciationResult]:
        """Compute depreciation for multiple inputs, preserving order."""
        return [self.compute(inp) for inp in inputs]

    @staticmethod
    def _key(inp: DepreciationInput) -> str:
        return (
            f"{inp.initial_value}:{inp.salvage_value}:"
            f"{inp.useful_life_years}:{inp.elapsed_years}"
        )

    def clear_cache(self) -> None:
        """Clear the internal result cache."""
        self._cache.clear()


if __name__ == "__main__":
    # Minimal demo
    engine = StraightLineEngine()
    demo = DepreciationInput(
        initial_value=10000.0,
        salvage_value=1000.0,
        useful_life_years=5.0,
        elapsed_years=1.0,
    )
    print(engine.compute(demo))