"""
Legacy type stubs for backward compatibility.
This module provides type hints for legacy code paths.
"""
from typing import TypeAlias, Literal
from enum import Enum

# Re-export State enum for legacy imports
State: TypeAlias = Literal["pending", "approved", "rejected", "cancelled"]


class WorkOrderState(Enum):
    """Legacy work order state enum."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class RetirementState(Enum):
    """Legacy retirement state enum."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


# Backward compatibility alias
derState = State  # noqa: N816