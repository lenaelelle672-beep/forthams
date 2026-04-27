"""
SWARM-003 折旧计算领域层模块

提供折旧计算所需的领域模型、数据模式定义。

Iteration 2 交付物:
    - DepreciationInput: 折旧计算输入数据模型
    - DepreciationResult: 折旧计算结果数据模型
    - DepreciationRecord: 折旧记录实体

使用示例:
    >>> from src.swarm_003.depreciation.domain import DepreciationInput, DepreciationResult
    >>> input_data = DepreciationInput(
    ...     acquisition_cost=Decimal("100000"),
    ...     salvage_value=Decimal("5000"),
    ...     useful_life_months=60
    ... )
"""

from decimal import Decimal
from typing import Optional

# Re-export schemas for public API
try:
    from .schemas import DepreciationInput, DepreciationResult, DepreciationValidationError
except ImportError:
    # Fallback if schemas module not available
    DepreciationInput = None
    DepreciationResult = None
    DepreciationValidationError = None

# Re-export entities for public API
try:
    from .entities import DepreciationRecord
except ImportError:
    DepreciationRecord = None

__all__ = [
    "DepreciationInput",
    "DepreciationResult",
    "DepreciationRecord",
    "DepreciationValidationError",
]