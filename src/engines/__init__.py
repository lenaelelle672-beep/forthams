"""
Asset State Transition Engine Package

This package provides the core engines for managing asset lifecycle state transitions,
including retirement state machine, depreciation calculations, and event persistence.
"""

from .state_machine import AssetStateMachine, AssetStatus, AssetStatusTransition
from .retirement_state_machine import RetirementStateMachine, RetirementState, RetirementEvent
from .depreciation_calculator import DepreciationCalculator
from .straight_line_engine import StraightLineEngine
from .double_declining_engine import DoubleDecliningEngine

__all__ = [
    "AssetStateMachine",
    "AssetStatus",
    "AssetStatusTransition",
    "RetirementStateMachine",
    "RetirementState",
    "RetirementEvent",
    "DepreciationCalculator",
    "StraightLineEngine",
    "DoubleDecliningEngine",
]