"""
Retirement Application Service

This module provides application-level operations for retirement workflows,
including creating applications, approving/rejecting requests, and coordinating
with domain services.
"""

from typing import Optional

from src.domain.entities.retirement_application import RetirementApplication
from src.domain.services.retirement_service import RetirementService
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.exceptions import BusinessException


class RetirementApplicationService:
    """
    Application service for retirement workflows.

    Responsibilities:
    - Orchestrate use‑case execution (create/approve/reject retirement requests)
    - Translate external DTOs to domain entities and vice‑versa
    - Apply cross‑cutting concerns (validation, logging) before delegating
    """

    def __init__(
        self,
        retirement_service: RetirementService,
        approval_chain_service: ApprovalChainService,
    ) -> None:
        self._retirement_service = retirement_service
        self._approval_chain_service = approval_chain_service

    def create_application(self, request) -> RetirementApplication:
        """
        Create a new retirement application.

        Validates payload, ensures business invariants, and persists the
        application via the domain service.
        """
        # TODO: add DTO validation / mapping as needed
        return self._retirement_service.create_application(request)

    def approve_application(self, application_id: str, actor_id: str) -> RetirementApplication:
        """
        Approve a retirement application.

        Coordinates with the approval chain service to verify permissions
        and then delegates to the domain service for state transition.
        """
        return self._approval_chain_service.approve(application_id, actor_id)

    def reject_application(self, application_id: str, actor_id: str, reason: Optional[str] = None) -> RetirementApplication:
        """
        Reject a retirement application.
        """
        return self._approval_chain_service.reject(application_id, actor_id, reason)

    def get_application(self, application_id: str) -> Optional[RetirementApplication]:
        """
        Retrieve an application by ID.
        """
        return self._retirement_service.get_application(application_id)