"""
Application command: approve_retirement

Handles the business logic for approving an asset retirement application.
This command is part of the SWARM-002 asset报废退役流程 (asset retirement workflow).
"""

from typing import Optional

from src.domain.entities.retirement_application import RetirementApplication
from src.domain.entities.retirement_history import RetirementHistory, ActionType
from src.domain.services.retirement_service import RetirementService
from src.domain.value_objects.asset_status import AssetStatus


class ApproveRetirementRequest:
    """DTO for approving a retirement application."""

    def __init__(
        self,
        *, 
        application_id: str,
        performed_by_id: str,
        comment: Optional[str] = None,
    ) -> None:
        self.application_id = application_id
        self.performed_by_id = performed_by_id
        self.comment = comment


class ApproveRetirementResponse:
    """Response returned after a successful approval."""

    def __init__(self, *, asset_id: str, asset_status: AssetStatus) -> None:
        self.asset_id = asset_id
        self.asset_status = asset_status


class ApproveRetirement:
    """
    Use case / command handler:
    - Validates preconditions for approval
    - Persists approval outcome
    - Emits domain events (via service)
    - Updates asset status to retired
    """

    def __init__(self, retirement_service: RetirementService) -> None:
        self.retirement_service = retirement_service

    def execute(self, request: ApproveRetirementRequest) -> ApproveRetirementResponse:
        """
        Approve a retirement application.

        Raises:
            ValueError: if the application is not in a pending state.
            RuntimeError: if the asset cannot be updated (concurrency / integrity issue).
        """
        application = self.retirement_service.get_application(request.application_id)

        if application.status != "pending":
            raise ValueError(
                f"Application {request.application_id} is in status '{application.status}' "
                "and cannot be approved."
            )

        result = self.retirement_service.approve_application(
            application=application,
            performed_by_id=request.performed_by_id,
            comment=request.comment or "",
        )

        return ApproveRetirementResponse(
            asset_id=result.asset_id,
            asset_status=result.status,
        )