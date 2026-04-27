"""
Update Asset Status Command

This module provides the command handler for updating asset status within the
asset state machine. It coordinates state transitions, enforces approval chain
rules, persists immutable events, and ensures atomicity of status changes and
event recording.
"""

from typing import Any, Dict, Optional
from datetime import datetime

from src.domain.entities.asset import Asset
from src.domain.entities.asset_status import AssetStatus
from src.domain.entities.asset_status_transition import AssetStatusTransition
from src.domain.entities.history import History
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.services.retirement_service import RetirementService
from src.domain.value_objects.transition_rule import TransitionRule


class UpdateAssetStatusCommand:
    """
    Command handler for updating asset status.

    Responsibilities:
    - Validate requested status transition against the state machine rules.
    - Execute the transition when valid.
    - Record an immutable history event for the transition.
    - Ensure atomicity of transition + event persistence.
    """

    def __init__(
        self,
        status_history_service: StatusHistoryService,
        retirement_service: RetirementService,
    ) -> None:
        self._status_history_service = status_history_service
        self._retirement_service = retirement_service

    def execute(
        self,
        asset_id: str,
        current_status: str,
        target_status: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute a status update for an asset.

        Args:
            asset_id: Unique identifier of the asset.
            current_status: The asset's current status as stored in the directory.
            target_status: The desired status to transition to.
            context: Optional contextual metadata (e.g., initiator_id, reason, RBAC claims).

        Returns:
            A dictionary containing:
                - success (bool): Whether the transition was applied.
                - asset (dict): Updated asset snapshot.
                - history (dict): Created history record.
                - message (str): Human-readable outcome.

        Raises:
            StateTransitionError: If the transition is invalid or not permitted.
            PermissionError: If the caller lacks required RBAC permissions.
            RuntimeError: If persistence fails (atomicity violation).
        """
        context = context or {}
        actor_id: str = context.get("actor_id", "system")
        reason: str = context.get("reason", "")

        # 1) Validate transition per the state machine rules.
        transition = AssetStatusTransition(
            asset_id=asset_id,
            from_status=current_status,
            to_status=target_status,
            actor_id=actor_id,
            reason=reason,
        )
        rules = self._load_transition_rules()
        if not self._is_transition_allowed(transition, rules):
            raise StateTransitionError(
                f"Invalid transition: {current_status} -> {target_status} "
                f"for asset {asset_id}."
            )

        # 2) RBAC permission check (minimal privilege: caller must be allowed to
        #    move the asset from current_status to target_status).
        self._check_rbac_permission(actor_id, transition)

        # 3) Execute domain-specific pre/post actions (e.g., retirement approval
        #    chain activation when entering/retiring status).
        if target_status == AssetStatus.RETIRED.value:
            self._retirement_service.initiate_retirement(asset_id, actor_id, reason)
        elif current_status == AssetStatus.RETIRED.value and target_status != AssetStatus.RETIRED.value:
            # Reversal or restoration should be blocked; deterministic denial.
            raise StateTransitionError(
                f"Asset {asset_id} is retired and cannot be reactivated."
            )

        # 4) Persist immutable history event atomically with status update.
        history_record = History(
            asset_id=asset_id,
            actor_id=actor_id,
            event_type="status_changed",
            payload={
                "from": current_status,
                "to": target_status,
                "reason": reason,
                "context": context,
            },
            occurred_at=datetime.utcnow(),
        )

        try:
            # The repository implementation must guarantee atomic write (e.g., DB
            # transaction) so that status update and event record are committed or
            # rolled back together.
            updated_asset = self._status_history_service.update_status_and_record(
                asset_id=asset_id,
                new_status=target_status,
                history_record=history_record,
            )
        except Exception as exc:
            raise RuntimeError(
                f"Failed to persist status change for asset {asset_id}: {exc}"
            ) from exc

        return {
            "success": True,
            "asset": updated_asset.to_dict(),
            "history": history_record.to_dict(),
            "message": f"Asset {asset_id} status updated to {target_status}.",
        }

    @staticmethod
    def _is_transition_allowed(
        transition: AssetStatusTransition, rules: Dict[str, Any]
    ) -> bool:
        """Determine whether a transition matches a valid rule."""
        key = f"{transition.from_status}->{transition.to_status}"
        return rules.get(key, {}).get("allowed", False)

    def _check_rbac_permission(
        self, actor_id: str, transition: AssetStatusTransition
    ) -> None:
        """
        Verify the actor is permitted to perform the transition.

        This is a placeholder for RBAC integration; in production it should
        consult the permissions service with least-privilege checks.
        """
        # TODO: integrate with RBAC provider.
        # Minimal implementation assumes system actor is authorized for demo.
        if actor_id == "system":
            return
        raise PermissionError(f"Actor {actor_id} lacks permission for transition.")

    @staticmethod
    def _load_transition_rules() -> Dict[str, Any]:
        """
        Load deterministic transition rules.

        Returns a map keyed by "from->to" with metadata including whether the
        transition is allowed. Rules must be aligned with the state machine
        definition to ensure determinism.
        """
        # In a real implementation these would be loaded from a rules file or
        # database. Here we provide a minimal deterministic set aligned with
        # the spec: in-use -> retiring, retiring -> retired, retired -> (none).
        return {
            "in_use->retiring": {"allowed": True},
            "retiring->retired": {"allowed": True},
            "in_use->archived": {"allowed": True},
            "archived->in_use": {"allowed": False},
            "retired->in_use": {"allowed": False},
        }


# -----------------------------------------------------------------------------
# Domain exceptions
# -----------------------------------------------------------------------------
class StateTransitionError(Exception):
    """Raised when an asset status transition violates rules or guards."""
    pass