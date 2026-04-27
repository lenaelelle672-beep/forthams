"""
Depreciation Service

Provides domain services for asset depreciation calculations and integration
with the asset lifecycle/retirement workflow. This module is part of the
Phase 3 "流程引擎与审批链实现" deliverable and is designed to be compatible
with existing asset directory data structures.
"""

from typing import Optional, Dict, Any
import time

from src.domain.entities.asset import Asset
from src.domain.entities.depreciation_record import DepreciationRecord
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.services.retirement_service import RetirementService
from src.domain.use_cases.retirement_usecase import RetirementUseCase
from src.domain.use_cases.approval_usecase import ApprovalUseCase
from src.domain.entities.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule


class DepreciationService:
    """
    High-level service orchestrating depreciation calculations, state transitions,
    and retirement workflow interactions while ensuring atomicity and auditability.
    """

    def __init__(
        self,
        retirement_usecase: RetirementUseCase,
        approval_usecase: ApprovalUseCase,
        status_history_service: StatusHistoryService,
        retirement_service: RetirementService,
    ) -> None:
        """
        Initialize DepreciationService with required use cases and services.

        Args:
            retirement_usecase: Use case for managing retirement lifecycle.
            approval_usecase: Use case for managing approval chains.
            status_history_service: Service for persisting immutable event records.
            retirement_service: Service for retirement-specific operations.
        """
        self._retirement_usecase = retirement_usecase
        self._approval_usecase = approval_usecase
        self._status_history_service = status_history_service
        self._retirement_service = retirement_service

    def calculate_depreciation(self, asset: Asset, method: str = "straight_line") -> Dict[str, Any]:
        """
        Calculate depreciation for the given asset using the specified method.

        This function is kept lightweight and delegates domain rules to
        dedicated calculators; it records a depreciation record event when
        calculation succeeds.

        Args:
            asset: The asset to calculate depreciation for.
            method: Calculation method, e.g. "straight_line" or "double_declining".

        Returns:
            A dictionary containing depreciation details (period, amount, book_value).

        Raises:
            ValueError: If the calculation method is unsupported.
        """
        if method == "straight_line":
            from src.application.depreciation.calculators.straight_line import StraightLineDepreciation
            calculator = StraightLineDepreciation()
        elif method == "double_declining":
            from src.application.depreciation.calculators.double_declining import DoubleDecliningDepreciation
            calculator = DoubleDecliningDepreciation()
        else:
            raise ValueError(f"Unsupported depreciation method: {method}")

        result: DepreciationRecord = calculator.calculate(asset=asset)
        # Persist immutable event for auditability (atomic persistence expectation
        # is enforced by the caller/unit-of-work; this call is non-blocking here).
        self._status_history_service.record_depreciation_event(asset=asset, record=result)
        return {
            "asset_id": asset.id,
            "method": method,
            "period": result.period,
            "amount": result.amount,
            "book_value": result.book_value,
            "recorded_at": result.recorded_at,
        }

    def initiate_retirement(self, asset_id: str, requester_id: str) -> Dict[str, Any]:
        """
        Initiate a retirement workflow for an asset.

        This creates a retirement application and starts the approval chain.
        The operation is expected to be executed within an atomic unit (e.g.
        transaction) by the caller to guarantee consistency between state change
        and event persistence.

        Args:
            asset_id: Unique identifier of the asset to retire.
            requester_id: ID of the user requesting retirement.

        Returns:
            A dictionary describing the created retirement application and current state.
        """
        return self._retirement_usecase.create_application(asset_id=asset_id, requester_id=requester_id)

    def approve_retirement_step(self, asset_id: str, actor_id: str, decision: str, comment: Optional[str] = None) -> Dict[str, Any]:
        """
        Process an approval/decision step in the retirement approval chain.

        Approval chain must not be bypassed; a reject decision terminates the
        flow and marks it as "Rejected". On approval, the workflow advances
        according to configured routing rules.

        Args:
            asset_id: Asset tied to the retirement flow.
            actor_id: ID of the actor performing the approval.
            decision: "approve" or "reject".
            comment: Optional comment attached to the approval event.

        Returns:
            Updated retirement application state and transition details.
        """
        return self._approval_usecase.process_decision(
            asset_id=asset_id,
            actor_id=actor_id,
            decision=decision,
            comment=comment or "",
        )

    def get_retirement_status(self, asset_id: str) -> Dict[str, Any]:
        """
        Retrieve current retirement and depreciation status for an asset.

        Args:
            asset_id: Asset identifier.

        Returns:
            Dictionary with status, history summary, and pending actions.
        """
        app = self._retirement_usecase.get_application(asset_id=asset_id)
        return {
            "asset_id": asset_id,
            "retirement_status": app.get("status"),
            "current_step": app.get("current_step"),
            "history": app.get("history", []),
        }

    def get_depreciation_schedule(self, asset_id: str) -> Dict[str, Any]:
        """
        Retrieve computed depreciation schedule for an asset.

        Args:
            asset_id: Asset identifier.

        Returns:
            Dictionary containing schedule entries and totals.
        """
        return self._retirement_service.get_depreciation_schedule(asset_id=asset_id)