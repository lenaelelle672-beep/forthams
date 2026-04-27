"""
Depreciation Engine Factory Module

This module provides a factory function to instantiate the appropriate
depreciation calculator implementation based on configuration.
"""

from typing import Any, Dict

from .base import DepreciationCalculator
from .double_declining import DoubleDecliningCalculator
from .straight_line import StraightLineCalculator
def get_calculator(config: Dict[str, Any]) -> DepreciationCalculator:
    """
    Return a DepreciationCalculator instance based on the provided configuration.

    Supported calculator types:
      - "straight_line": StraightLineCalculator
      - "double_declining": DoubleDecliningCalculator

    Args:
        config: A dictionary containing at least the key "method" that specifies
                the depreciation calculation method.

    Returns:
        An instance of a DepreciationCalculator subclass.

    Raises:
        ValueError: If the specified depreciation method is not supported.
    """
    method = config.get("method", "straight_line")
    if method == "straight_line":
        return StraightLineCalculator(**config.get("params", {}))
    if method == "double_declining":
        return DoubleDecliningCalculator(**config.get("params", {}))
    raise ValueError(f"Unsupported depreciation method: {method}")