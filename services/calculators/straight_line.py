"""Straight-line depreciation calculator for forthAMS asset management system."""

from services.calculators.base import DepreciationCalculator
class StraightLineDepreciation(DepreciationCalculator):
    """Straight-line depreciation calculator.

    Computes equal periodic depreciation expense over the asset's useful life.
    Formula: (cost - salvage) / useful_life
    """

    def calculate(self, cost: float, salvage: float, useful_life: int) -> float:
        """Calculate straight-line depreciation.

        Args:
            cost: Asset acquisition cost.
            salvage: Residual value at end of useful life.
            useful_life: Useful life in periods (years, months, etc.).

        Returns:
            Periodic depreciation expense.

        Raises:
            ValueError: If useful_life is zero or negative.
        """
        if useful_life <= 0:
            raise ValueError("useful_life must be a positive integer")
        return (cost - salvage) / useful_life