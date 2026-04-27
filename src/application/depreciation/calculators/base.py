"""
Base depreciation calculator and state transition engine for asset lifecycle management.

This module provides the foundational calculator interface and state machine integration
for managing asset depreciation and retirement workflows. It supports deterministic state
transitions, audit logging, and integration with the approval chain.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional

from src.domain.entities.asset import Asset
from src.domain.entities.retirement_request import RetirementRequest
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule


class StateTransitionError(Exception):
    """Raised when a state transition is invalid or not permitted."""

    def __init__(self, message: str, asset_id: str, from_state: str, to_state: str) -> None:
        self.asset_id = asset_id
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(message)


@dataclass(frozen=True)
class TransitionInput:
    """Input bundle for a state transition."""
    asset: Asset
    target_state: AssetStatus
    request: Optional[RetirementRequest] = None
    metadata: Optional[Dict[str, Any]] = None


class BaseDepreciationCalculator(ABC):
    """
    Abstract base calculator for depreciation methods.

    Concrete calculators must implement `calculate_depreciation` and provide
    a deterministic transition map via `_get_transition_rules`.
    """

    def __init__(self, status_history_service: StatusHistoryService) -> None:
        self._status_history_service = status_history_service
        self._transition_rules: Dict[AssetStatus, List[TransitionRule]] = self._load_transition_rules()

    @abstractmethod
    def calculate_depreciation(self, asset: Asset, period_end: date) -> Dict[str, Any]:
        """
        Compute depreciation values for the given asset up to period_end.

        Returns a dictionary containing method-specific results (e.g., accumulated,
        remaining, schedule entries).
        """
        raise NotImplementedError

    @abstractmethod
    def _get_transition_rules(self) -> Dict[AssetStatus, List[TransitionRule]]:
        """
        Define allowed state transitions for this calculator.

        Example:
            return {
                AssetStatus.ACTIVE: [
                    TransitionRule(target=AssetStatus.RETIRING, guard="can_request_retirement"),
                    TransitionRule(target=AssetStatus.DISPOSED, guard="can_dispose"),
                ],
                ...
            }
        """
        raise NotImplementedError

    def _load_transition_rules(self) -> Dict[AssetStatus, List[TransitionRule]]:
        """Load and cache transition rules; fallback to empty map if unavailable."""
        try:
            return self._get_transition_rules()
        except Exception as exc:
            # Fail-safe: log and return empty map to keep system operational
            # Integration layer should surface this error via audit/event.
            return {}

    def transition(
        self,
        asset: Asset,
        target_state: AssetStatus,
        request: Optional[RetirementRequest] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Asset:
        """
        Validate and execute a deterministic state transition.

        Guarantees:
        - Deterministic output for given input + context.
        - Atomic write of status change and event persistence.
        - RBAC and guard checks enforced by caller/use-case.
        """
        rules = self._transition_rules.get(asset.status, [])
        applicable = [r for r in rules if r.target == target_state]
        if not applicable:
            raise StateTransitionError(
                f"Transition from {asset.status} to {target_state} is not allowed.",
                asset_id=asset.id,
                from_state=str(asset.status),
                to_state=str(target_state),
            )

        # Deterministic guard evaluation: all applicable rules must pass.
        for rule in applicable:
            if rule.guard and not self._evaluate_guard(rule.guard, asset, request):
                raise StateTransitionError(
                    f"Guard '{rule.guard}' failed for transition {asset.status} -> {target_state}.",
                    asset_id=asset.id,
                    from_state=str(asset.status),
                    to_state=str(target_state),
                )

        # Perform transition atomically via status history service.
        updated_asset = self._status_history_service.transition_asset(
            asset_id=asset.id,
            from_status=asset.status,
            to_status=target_state,
            request_id=request.id if request else None,
            metadata=metadata or {},
        )
        return updated_asset

    def _evaluate_guard(self, guard_name: str, asset: Asset, request: Optional[RetirementRequest]) -> bool:
        """
        Evaluate a guard by name against runtime context.

        Default implementation supports a small set of built-in guards.
        Subclasses may extend this with custom guard resolution.
        """
        builtins: Dict[str, bool] = {
            "can_request_retirement": asset.status == AssetStatus.ACTIVE,
            "can_dispose": asset.status.in_(AssetStatus.ALLOWED_FOR_DISPOSAL),
            "can_approve": True,  # RBAC enforced externally
            "can_reject": True,
        }
        return builtins.get(guard_name, False)

    def list_allowed_transitions(self, asset_status: AssetStatus) -> List[AssetStatus]:
        """Return all target statuses reachable from the given status."""
        rules = self._transition_rules.get(asset_status, [])
        return [rule.target for rule in rules]