"""Retirement use case implementation for forthAMS."""

from typing import Optional

from src.domain.entities.retirement_request import RetirementRequest
from src.domain.services.retirement_service import RetirementService
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.exceptions import RetirementStateTransitionException
class RetirementUsecase:
    """Use case for processing retirement requests."""

    def __init__(
        self,
        retirement_service: RetirementService,
        approval_chain_service: ApprovalChainService,
    ) -> None:
        self._retirement_service = retirement_service
        self._approval_chain_service = approval_chain_service

    def submit_retirement_request(
        self,
        employee_id: str,
        asset_ids: list[str],
        reason: str,
        retirement_date: str,
    ) -> RetirementRequest:
        """Submit a new retirement request and start approval workflow.

        Args:
            employee_id: ID of the employee initiating retirement.
            asset_ids: List of asset IDs to be retired.
            reason: Business justification for retirement.
            retirement_date: Planned retirement date (ISO format).

        Returns:
            The created retirement request entity.
        """
        request = self._retirement_service.create_retirement_request(
            employee_id=employee_id,
            asset_ids=asset_ids,
            reason=reason,
            retirement_date=retirement_date,
        )
        self._approval_chain_service.start_approval(request.id)
        return request

    def approve_retirement(
        self,
        request_id: str,
        approver_id: str,
        decision: str,
        comment: Optional[str] = None,
    ) -> None:
        """Approve or reject a retirement request.

        Args:
            request_id: The retirement request identifier.
            approver_id: ID of the approver.
            decision: Approval decision (e.g., "approved", "rejected").
            comment: Optional comment for the decision.

        Raises:
            RetirementStateTransitionException: If the transition is invalid.
        """
        self._approval_chain_service.process_decision(
            request_id=request_id,
            approver_id=approver_id,
            decision=decision,
            comment=comment,
        )

    def get_retirement_request(self, request_id: str) -> Optional[RetirementRequest]:
        """Retrieve a retirement request by ID.

        Args:
            request_id: The retirement request identifier.

        Returns:
            The retirement request entity, or None if not found.
        """
        return self._retirement_service.get_retirement_request(request_id)