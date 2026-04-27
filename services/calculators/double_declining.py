"""
Double Declining Balance Depreciation Calculator.

This module provides a concrete implementation of the double-declining balance
method for asset depreciation. It follows the formula:

    depreciation = (2 / useful_life) * book_value

where book_value is the current value of the asset (cost - accumulated depreciation).
"""

from services.calculators.base import DepreciationCalculator
class DoubleDecliningCalculator(DepreciationCalculator):
    """Double Declining Balance depreciation calculator."""

    def __init__(self, cost: float, useful_life: int, salvage_value: float = 0.0):
        """
        Initialize the double declining calculator.

        Args:
            cost: Initial cost of the asset.
            useful_life: Useful life of the asset in years.
            salvage_value: Expected salvage value at end of useful life (default 0.0).
        """
        super().__init__(cost, useful_life, salvage_value)
        self._rate = 2.0 / useful_life

    def calculate_year_depreciation(self, year: int, book_value: float) -> float:
        """
        Calculate depreciation for a specific year using double declining balance.

        Args:
            year: The year for which to calculate depreciation (1-indexed).
            book_value: The book value at the start of the year.

        Returns:
            Depreciation amount for the given year.
        """
        return self._rate * book_value