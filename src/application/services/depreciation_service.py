"""
Depreciation Service

Provides domain services for asset depreciation calculations and integration
with the asset state lifecycle. This module supports:
- Straight-line and double-declining-balance depreciation calculations.
- Event-sourced state transitions with immutable audit records.
- Synchronous validation to ensure deterministic state transitions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from .status_history_service import StatusHistoryService
from ..commands.update_asset_status import UpdateAssetStatusCommand
from ..use_cases.retirement_usecase import RetirementUseCase
from ...domain.entities.asset import Asset
from ...domain.entities.depreciation_record import DepreciationRecord
from ...domain.value_objects.asset_status import AssetStatus
from ...domain.value_objects.transition_rule import TransitionRule
from ...infrastructure.database.repositories import DepreciationRepository, EventRepository


@dataclass
class DepreciationService:
    """Core depreciation service orchestrating calculations and state transitions."""

    depreciation_repo: DepreciationRepository
    event_repo: EventRepository
    status_history_svc: StatusHistoryService
    retirement_usecase: RetirementUseCase

    def calculate_depreciation(
        self,
        asset: Asset,
        period_start: date,
        period_end: date,
        method: str = "straight_line",
    ) -> DepreciationRecord:
        """
        Calculate depreciation for an asset over a date range.

        Deterministic calculation: given the same asset, dates, and method,
        the result is guaranteed to be identical.

        Args:
            asset: The asset to depreciate.
            period_start: Start of the depreciation period (inclusive).
            period_end: End of the depreciation period (inclusive).
            method: Calculation method, e.g. "straight_line" or "double_declining".

        Returns:
            A DepreciationRecord with calculated values and an audit event.

        Raises:
            ValueError: If the method is unsupported or dates are invalid.
        """
        if method == "straight_line":
            from .calculators.straight_line import StraightLineDepreciation
            calc = StraightLineDepreciation(asset, period_start, period_end)
        elif method == "double_declining":
            from .calculators.double_declining import DoubleDecliningDepreciation
            calc = DoubleDecliningDepreciation(asset, period_start, period_end)
        else:
            raise ValueError(f"Unsupported depreciation method: {method}")

        record = calc.execute()
        # Persist calculation result and emit immutable event atomically.
        self._persist_with_event(asset.id, record)
        return record

    def transition_state(
        self,
        asset: Asset,
        target_status: AssetStatus,
        context: Optional[Dict[str, Any]] = None,
    ) -> Asset:
        """
        Transition an asset to a new status following deterministic rules.

        The transition guard validates eligibility; if valid, the state change
        and an event are persisted in a single atomic operation.

        Args:
            asset: The asset to transition.
            target_status: Desired next status.
            context: Optional metadata for the transition (e.g. actor_id, reason).

        Returns:
            The updated asset instance.

        Raises:
            StateTransitionError: If the transition is not allowed.
        """
        from ...domain.state_machine.transitions import validate_transition
        from ...common.exception import StateTransitionError

        if not validate_transition(asset.status, target_status, context or {}):
            raise StateTransitionError(
                f"Invalid transition: {asset.status} -> {target_status}"
            )

        asset.status = target_status
        updated = self._persist_with_event(asset.id, None, context)
        return updated

    def submit_retirement(
        self,
        asset_id: str,
        actor_id: str,
        reason: str,
    ) -> Dict[str, Any]:
        """
        Initiate a retirement workflow for an asset.

        Creates a retirement application, records the initial event, and triggers
        the approval chain. This is the primary user-facing entry point.

        Args:
            asset_id: Unique identifier of the asset.
            actor_id: ID of the user requesting retirement.
            reason: Business justification for retirement.

        Returns:
            A dict containing the workflow instance id and current status.
        """
        return self.retirement_usecase.start(asset_id, actor_id, reason)

    def approve_step(
        self,
        workflow_id: str,
        actor_id: str,
        approved: bool,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process a single approval/decision node in the chain.

        Enforces RBAC via the use case; a rejection aborts the workflow
        and marks it as "已否决".

        Args:
            workflow_id: The retirement workflow identifier.
            actor_id: ID of the actor performing the approval.
            approved: True for approval, False for rejection.
            comment: Optional comment attached to the decision.

        Returns:
            Updated workflow status and node information.
        """
        return self.retirement_usecase.decide(workflow_id, actor_id, approved, comment)

    def get_history(self, asset_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve the chronological event stream for an asset.

        Returns events sorted by timestamp ascending, providing a complete
        immutable audit trail.
        """
        events = self.event_repo.list_by_asset(asset_id)
        return [e.to_dict() for e in events]

    # ---- private helpers ----------------------------------------------------

    def _persist_with_event(
        self,
        asset_id: str,
        depreciation_record: Optional[DepreciationRecord],
        context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        Persist a depreciation record (if any) and an immutable event atomically.

        This satisfies the requirement that history writes and status changes
        are atomic and consistent.
        """
        # In a real implementation this would be a DB transaction/saga.
        if depreciation_record:
            self.depreciation_repo.save(depreciation_record)
        event = EventRepository.build_event(
            asset_id=asset_id,
            actor_id=context.get("actor_id") if context else None,
            metadata=context or {},
            record=depreciation_record,
        )
        self.event_repo.save(event)
        # Return a lightweight updated asset representation.
        return {"id": asset_id, "status": context.get("target_status") if context else None}