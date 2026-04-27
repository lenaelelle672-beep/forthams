"""
Base calculator for asset depreciation calculations.
Provides a common interface and shared utilities for all depreciation methods.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
class BaseDepreciationCalculator(ABC):
    """
    Abstract base class for depreciation calculators.

    All concrete depreciation calculators (StraightLine, DoubleDecliningBalance, etc.)
    should inherit from this class and implement the `calculate_depreciation` method.
    """

    def __init__(self, initial_value: float, useful_life: int, **kwargs):
        """
        Initialize the base calculator with common depreciation parameters.

        Args:
            initial_value: The initial book value of the asset.
            useful_life: The useful life of the asset in years.
            **kwargs: Additional optional parameters for specific calculators.
        """
        self.initial_value = initial_value
        self.useful_life = useful_life
        self._validate_inputs()

    def _validate_inputs(self) -> None:
        """Validate common inputs for depreciation calculations."""
        if self.initial_value < 0:
            raise ValueError("initial_value must be non-negative.")
        if self.useful_life <= 0:
            raise ValueError("useful_life must be a positive integer.")

    @abstractmethod
    def calculate_depreciation(self, period: int) -> float:
        """
        Calculate the depreciation amount for a specific period.

        Args:
            period: The period (e.g., year or month) for which to calculate depreciation.

        Returns:
            The depreciation amount for the given period.
        """
        pass

    def calculate_total_depreciation(self, periods: int) -> float:
        """
        Calculate the total depreciation over a number of periods.

        Args:
            periods: The number of periods to accumulate depreciation over.

        Returns:
            The total accumulated depreciation.
        """
        if periods <= 0:
            return 0.0
        return sum(self.calculate_depreciation(p) for p in range(1, periods + 1))

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the calculator configuration to a dictionary."""
        return {
            "initial_value": self.initial_value,
            "useful_life": self.useful_life,
            "calculator_type": self.__class__.__name__,
        }