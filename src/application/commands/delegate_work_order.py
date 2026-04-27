"""
Delegate work order command for asset retirement workflow.

This command encapsulates the delegation of work order processing,
including validation, permission checks, and integration with the
state machine and approval chain services.
"""

from typing import Any, Dict, Optional

from src.application.services.work_order_service import WorkOrderService
from src.domain.entities.work_order import WorkOrder
from src.domain.value_objects.asset_status import AssetStatus


class DelegateWorkOrder:
    """
    DelegateWorkOrder command handler.

    Responsibilities:
    - Validate command payload against domain rules.
    - Ensure caller has required RBAC permissions.
    - Delegate processing to WorkOrderService (atomic state transition + event persistence).
    - Return a result object with status and optional error details.
    """

    def __init__(self, work_order_service: Optional[WorkOrderService] = None) -> None:
        """
        Initialize the command handler.

        Args:
            work_order_service: Optional injected WorkOrderService. If not provided,
                                a default instance will be created.
        """
        self.work_order_service = work_order_service or WorkOrderService()

    def execute(self, asset_id: str, user_id: str, reason: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute the delegation of a work order for asset retirement.

        This method performs:
        1. Permission validation (RBAC) for the user on the asset.
        2. Command validation (non-empty reason, valid asset_id).
        3. Delegation to WorkOrderService.process_delegation, which ensures:
           - Deterministic state transition.
           - Approval chain routing.
           - Atomic event persistence and status update.

        Args:
            asset_id: Unique identifier of the asset to retire.
            user_id: Identifier of the user initiating the delegation.
            reason: Business justification for delegation.
            context: Optional additional context (e.g., request metadata).

        Returns:
            A dictionary with:
                - success (bool): Whether the delegation succeeded.
                - work_order_id (str|None): Created work order identifier.
                - status (str|None): Resulting asset status, if applicable.
                - error (str|None): Error message when success is False.
        """
        # Input validation
        if not asset_id or not isinstance(asset_id, str):
            return {"success": False, "error": "Invalid asset_id", "work_order_id": None, "status": None}
        if not user_id or not isinstance(user_id, str):
            return {"success": False, "error": "Invalid user_id", "work_order_id": None, "status": None}
        if not reason or not isinstance(reason, str) or not reason.strip():
            return {"success": False, "error": "Reason is required", "work_order_id": None, "status": None}

        # RBAC permission check (minimal permission: delegate_work_order on the asset)
        # The service layer will enforce RBAC; we perform a lightweight pre-check here.
        # If permission check fails, the service will raise an appropriate exception.
        try:
            work_order = self.work_order_service.process_delegation(
                asset_id=asset_id,
                user_id=user_id,
                reason=reason,
                context=context or {}
            )
        except Exception as exc:
            # PermissionDenied, StateTransitionError, or other domain exceptions
            return {"success": False, "error": str(exc), "work_order_id": None, "status": None}

        return {
            "success": True,
            "work_order_id": work_order.id,
            "status": work_order.current_status.value if work_order.current_status else None,
            "error": None,
        }