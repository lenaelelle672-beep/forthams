"""
Depreciation Update Task

This task is responsible for updating asset depreciation records as part of
the asset lifecycle state machine. It runs on a schedule to ensure that
depreciation values are kept up-to-date and that any state transitions
related to asset value changes are recorded as immutable events.

The task integrates with:
- Asset state machine (deterministic transitions)
- Event persistence (audit trail)
- Depreciation calculation engines
- RBAC-aware execution (minimum permissions)
"""

import logging
from typing import Any, Dict, Optional

from src.domain.entities.asset import Asset
from src.domain.entities.depreciation_record import DepreciationRecord
from src.domain.services.depreciation_service import DepreciationService
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.value_objects.transition_rule import TransitionRule
from src.infrastructure.messaging.publisher import EventPublisher
from src.infrastructure.database.repositories import AssetRepository, DepreciationRecordRepository

logger = logging.getLogger(__name__)
class DepreciationUpdateTask:
    """
    Scheduled task that updates depreciation records and ensures
    state transitions are consistent with the asset lifecycle engine.
    """

    def __init__(
        self,
        asset_repo: AssetRepository,
        dep_repo: DepreciationRecordRepository,
        dep_service: DepreciationService,
        status_service: StatusHistoryService,
        publisher: EventPublisher,
    ) -> None:
        self.asset_repo = asset_repo
        self.dep_repo = dep_repo
        self.dep_service = dep_service
        self.status_service = status_service
        self.publisher = publisher

    def execute(self, asset_id: str, *, context: Optional[Dict[str, Any]] = None) -> bool:
        """
        Execute the depreciation update for a single asset.

        Deterministic behavior:
        - Loads current asset and its latest depreciation record.
        - Calculates next depreciation value using configured engine.
        - Persists new depreciation record atomically with state event.
        - Emits 'depreciation_updated' event for downstream consumers.

        Args:
            asset_id: Unique identifier of the asset to process.
            context: Optional runtime context (e.g., request_id, user_id).

        Returns:
            True if update was applied, False if no change needed.

        Raises:
            ValueError: If asset not found or invalid state.
            RuntimeError: If persistence fails.
        """
        if not asset_id:
            raise ValueError("asset_id must be provided")

        asset = self.asset_repo.find_by_id(asset_id)
        if asset is None:
            raise ValueError(f"Asset not found: {asset_id}")

        # Ensure asset is in a state where depreciation updates are allowed
        if not self._can_update_depreciation(asset):
            logger.info(
                "Skipping depreciation update for asset %s in state %s",
                asset_id,
                asset.status,
            )
            return False

        # Calculate next depreciation using domain engine (deterministic)
        new_record = self.dep_service.calculate_next(asset)

        # Persist atomically: record + state change event
        with self.asset_repo.unit_of_work() as uow:
            try:
                uow.depreciation_records.create(new_record)
                # Record state transition event for audit trail
                event = self._make_state_event(asset, new_record)
                uow.events.create(event.to_dict())
                uow.commit()
            except Exception as exc:
                uow.rollback()
                logger.error(
                    "Failed to persist depreciation update for asset %s: %s",
                    asset_id,
                    exc,
                    exc_info=True,
                )
                raise RuntimeError(f"Atomic persistence failed: {exc}") from exc

        # Emit immutable event for downstream pipelines
        self.publisher.publish("asset.depreciation.updated", {
            "asset_id": asset_id,
            "record_id": new_record.id,
            "value": new_record.value,
            "period": new_record.period,
        })

        logger.debug("Depreciation updated for asset %s -> %s", asset_id, new_record.value)
        return True

    def _can_update_depreciation(self, asset: Asset) -> bool:
        """
        Guard: only allow depreciation updates for active, non-retired assets.
        """
        active_states = {"active", "in_use", "under_maintenance"}
        return asset.status in active_states

    def _make_state_event(self, asset: Asset, record: DepreciationRecord) -> Any:
        """
        Build an immutable event representing the state transition.
        """
        from src.domain.entities import AssetStatusChangedEvent
        return AssetStatusChangedEvent(
            entity_id=asset.id,
            entity_type="asset",
            from_status=asset.status,
            to_status=asset.status,
            metadata={
                "depreciation_record_id": record.id,
                "depreciation_value": record.value,
                "depreciation_period": record.period,
                "triggered_by": "scheduled_task",
            },
        )