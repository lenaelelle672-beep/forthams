"""
SWARM-003 Depreciation Module

Asset depreciation calculation core module for SWARM-2026-Q2-003.
Provides depreciation calculation, scheduling, and reporting capabilities.
"""

from src.swarm_003.depreciation.domain.schemas import (
    DepreciationRecord,
    DepreciationRequest,
    DepreciationResponse,
    DepreciationMethod,
)
from src.swarm_003.depreciation.domain.entities import (
    DepreciationState,
    DepreciationPeriod,
)

__all__ = [
    "DepreciationRecord",
    "DepreciationRequest", 
    "DepreciationResponse",
    "DepreciationMethod",
    "DepreciationState",
    "DepreciationPeriod",
]