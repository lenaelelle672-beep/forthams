"""
Retirement Approval Service

This module provides business logic for processing retirement approval workflows.
It coordinates state transitions, validation, and integration with downstream systems.
"""

from typing import Optional, Dict, Any
from datetime import datetime

from .domain.exceptions import RetirementStateTransitionError
from .domain.services.retirement_service import RetirementService
from .domain.services.approval_chain_service import ApprovalChainService
from .domain.models.retirement_application import RetirementApplication
from .domain.models.approval_stage import ApprovalStage
from .domain.value_objects.transition_rule import TransitionRule


class ApprovalService:
    """
    Core approval service for retirement workflows.

    Responsibilities:
    - Validate eligibility for retirement
    - Drive approval state transitions
    - Orchestrate cross-service interactions (asset, notification, etc.)
    """

    def __init__(
        self,
        retirement_service: RetirementService,
        approval_chain_service: ApprovalChainService,
    ) -> None:
        self._retirement_service = retirement_service
        self._approval_chain_service = approval_chain_service

    def submit_application(self, applicant_id: str, asset_id: str) -> RetirementApplication:
        """
        Submit a new retirement application after validating prerequisites.

        Args:
            applicant_id: Unique identifier for the applicant.
            asset_id: Unique identifier for the asset being retired.

        Returns:
            The created RetirementApplication instance.

        Raises:
            ValueError: If input identifiers are invalid.
            RetirementStateTransitionError: If prerequisites are not met.
        """
        if not applicant_id or not asset_id:
            raise ValueError("applicant_id and asset_id must be non-empty")

        # Validate asset eligibility via domain service
        eligibility = self._retirement_service.validate_eligibility(asset_id)
        if not eligibility.is_eligible:
            raise RetirementStateTransitionError(
                f"Asset {asset_id} is not eligible: {eligibility.reason}"
            )

        application = RetirementApplication.create(
            applicant_id=applicant_id,
            asset_id=asset_id,
            submitted_at=datetime.utcnow(),
        )
        self._retirement_service.persist_application(application)
        return application

    def request_approval(
        self,
        application_id: str,
        approver_ids: Optional[list[str]] = None,
    ) -> ApprovalStage:
        """
        Initiate the approval chain for a submitted application.

        Args:
            application_id: The ID of the application to approve.
            approver_ids: Optional explicit list of approvers; if omitted,
                the chain resolver determines approvers automatically.

        Returns:
            The initial ApprovalStage representing the first step in the workflow.
        """
        if not application_id:
            raise ValueError("application_id must be non-empty")

        stage = self._approval_chain_service.resolve_and_create_stage(
            application_id=application_id,
            approver_ids=approver_ids,
        )
        return stage

    def approve(
        self,
        application_id: str,
        approver_id: str,
        decision: str,
        comment: Optional[str] = None,
    ) -> ApprovalStage:
        """
        Record an approval decision and advance the workflow.

        Args:
            application_id: The application being acted upon.
            approver_id: The ID of the approver recording the decision.
            decision: Approval decision (e.g., "APPROVED", "REJECTED").
            comment: Optional contextual comment.

        Returns:
            The updated ApprovalStage.

        Raises:
            RetirementStateTransitionError: If the transition is invalid.
        """
        if not application_id or not approver_id or not decision:
            raise ValueError("application_id, approver_id, and decision are required")

        return self._approval_chain_service.process_decision(
            application_id=application_id,
            approver_id=approver_id,
            decision=decision,
            comment=comment,
        )

    def get_status(self, application_id: str) -> Dict[str, Any]:
        """
        Retrieve the current status and audit trail for an application.

        Args:
            application_id: The application to query.

        Returns:
            A dictionary containing status, stage, approvers, and history.
        """
        if not application_id:
            raise ValueError("application_id must be non-empty")

        app = self._retirement_service.get_application(application_id)
        if app is None:
            raise ValueError(f"Application {application_id} not found")

        current_stage = self._approval_chain_service.get_current_stage(application_id)
        return {
            "application_id": app.id,
            "asset_id": app.asset_id,
            "applicant_id": app.applicant_id,
            "status": app.status.value,
            "current_stage": current_stage.name if current_stage else None,
            "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
            "updated_at": datetime.utcnow().isoformat(),
        }