"""
Command: RejectRetirement

Use case: An administrator or authorized role rejects a submitted asset retirement
application. This command validates permissions, ensures the application is still
in a mutable state (pending), records the rejection, reverts the asset status,
and appends an entry to the retirement history log.

Dependencies:
- Domain entities: RetirementApplication, Asset, RetirementHistory, HistoryAction
- Domain services: ApprovalChainService, RetirementService
- Infrastructure: UnitOfWork, EventPublisher
"""

from typing import Any

from src.domain.entities.retirement_application import RetirementApplication
from src.domain.entities.retirement_history import RetirementHistory, HistoryAction
from src.domain.exceptions import (
    BusinessException,
    PermissionDeniedError,
    InvalidStatusError,
)
from src.domain.services.retirement_service import RetirementService
from src.domain.services.approval_chain_service import ApprovalChainService
from src.infrastructure.unit_of_work import UnitOfWork
class RejectRetirement:
    """
    RejectRetirement command handler.

    Responsibilities:
    1) Verify caller has authority to reject the application (admin or delegated role).
    2) Ensure the application is in a modifiable state (pending).
    3) Record a rejection history entry.
    4) Revert asset status to normal.
    5) Update application status to rejected.
    """

    def __init__(
        self,
        approval_chain_service: ApprovalChainService,
        retirement_service: RetirementService,
        uow: UnitOfWork,
    ) -> None:
        self._approval_chain_service = approval_chain_service
        self._retirement_service = retirement_service
        self._uow = uow

    def execute(self, application_id: int, performed_by_id: int, comment: str = "") -> RetirementApplication:
        """
        Reject a retirement application.

        Args:
            application_id: Unique identifier of the retirement application.
            performed_by_id: User ID of the administrator performing the rejection.
            comment: Optional explanation for the rejection.

        Returns:
            The updated RetirementApplication entity.

        Raises:
            PermissionDeniedError: If the user is not authorized to reject.
            InvalidStatusError: If the application is not in a pending state.
            BusinessException: If the operation cannot be completed.
        """
        with self._uow:
            application: RetirementApplication = self._uow.retirement_application_repository.get_by_id(application_id)
            if application is None:
                raise BusinessException("Retirement application not found.")

            # Authorization: only designated approvers can reject
            if not self._approval_chain_service.can_reject(application, performed_by_id):
                raise PermissionDeniedError("You do not have permission to reject this application.")

            if application.status != "pending":
                raise InvalidStatusError(
                    f"Application status is '{application.status}', expected 'pending'."
                )

            # Record rejection history
            history = RetirementHistory(
                asset=application.asset,
                application=application,
                action=HistoryAction.rejected,
                previous_status=application.status,
                new_status="rejected",
                performed_by_id=performed_by_id,
                comment=comment,
            )
            self._uow.retirement_history_repository.add(history)

            # Revert asset status and update application
            application.status = "rejected"
            application.comment = comment
            self._retirement_service._revert_asset_status(application.asset)

            self._uow.commit()
            return application