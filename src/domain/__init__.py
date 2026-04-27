"""
Domain layer initialization for asset lifecycle management.

This module serves as the public interface for domain entities, value objects,
state machines, use cases, services, and rules. It ensures a clean, bounded
context import surface while keeping the internal package structure opaque.
"""

from typing import Any

# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------
from .entities.asset import Asset
from .entities.asset_status import AssetStatus
from .entities.retirement_request import RetirementRequest
from .entities.retirement_app import RetirementApp
from .entities.retirement_history import RetirementHistory
from .entities.approval_stage import ApprovalStage
from .entities.history import History
from .entities.work_order import WorkOrder
from .entities.debit_note import DebitNote  # placeholder if needed

# ---------------------------------------------------------------------------
# Value Objects
# ---------------------------------------------------------------------------
from .value_objects.asset_status import AssetStatusVO
from .value_objects.transition_rule import TransitionRule
from .value_objects.depreciation_period import DepreciationPeriod
from .value_objects.debit_period import DebitPeriod  # placeholder if needed

# ---------------------------------------------------------------------------
# State Machines
# ---------------------------------------------------------------------------
from .state_machine.states import AssetLifecycleState
from .state_machine.transitions import AssetTransition
from .state_machine.retirement_state_machine import RetirementStateMachine
from .state_machine.guards import can_transition, validate_guard

# ---------------------------------------------------------------------------
# Use Cases / Application Services
# ---------------------------------------------------------------------------
from .use_cases.retirement_usecase import RetirementUseCase
from .use_cases.approval_usecase import ApprovalUseCase
from .use_cases.status_history_service import StatusHistoryService
from .use_cases.retirement_service import RetirementService
from .use_cases.approval_chain_service import ApprovalChainService

# ---------------------------------------------------------------------------
# Domain Services
# ---------------------------------------------------------------------------
from .services.status_history_service import DomainStatusHistoryService
from .services.retirement_service import DomainRetirementService
from .services.approval_chain_service import DomainApprovalChainService
from .services.approval_service import DomainApprovalService

# ---------------------------------------------------------------------------
# Rules / Validators
# ---------------------------------------------------------------------------
from .rules.transition_rules import load_transition_rules
from .rules.validation_rules import validate_status_change

# ---------------------------------------------------------------------------
# Public API surface
# ---------------------------------------------------------------------------
__all__ = [
    # Entities
    "Asset",
    "AssetStatus",
    "RetirementRequest",
    "RetirementApp",
    "RetirementHistory",
    "ApprovalStage",
    "History",
    "WorkOrder",
    # Value Objects
    "AssetStatusVO",
    "TransitionRule",
    "DepreciationPeriod",
    "DebitPeriod",
    # State Machines
    "AssetLifecycleState",
    "AssetTransition",
    "RetirementStateMachine",
    "can_transition",
    "validate_guard",
    # Use Cases
    "RetirementUseCase",
    "ApprovalUseCase",
    "StatusHistoryService",
    "RetirementService",
    "ApprovalChainService",
    # Domain Services
    "DomainStatusHistoryService",
    "DomainRetirementService",
    "DomainApprovalChainService",
    "DomainApprovalService",
    # Rules
    "load_transition_rules",
    "validate_status_change",
    # Type aliases / helpers
    "Any",
]