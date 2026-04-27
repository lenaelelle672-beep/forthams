"""
Retirement Service Module

This module provides business logic for processing employee retirements,
including eligibility validation, state transitions, and integration with
depreciation and approval workflows.
"""

from datetime import date
from typing import Optional, Dict, Any

from src.domain.exceptions import RetirementStateTransitionException
from src.domain.state_machine.retirement_state_machine import RetirementStateMachine
from src.domain.services.notification_service import NotificationService
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.services.status_history_service import StatusHistoryService
class RetirementService:
    """
    Core retirement service handling the full lifecycle of a retirement event.
    """

    def __init__(
        self,
        state_machine: Optional[RetirementStateMachine] = None,
        notification_service: Optional[NotificationService] = None,
        approval_chain_service: Optional[ApprovalChainService] = None,
        status_history_service: Optional[StatusHistoryService] = None,
    ) -> None:
        self.state_machine = state_machine or RetirementStateMachine()
        self.notification_service = notification_service or NotificationService()
        self.approval_chain_service = (
            approval_chain_service or ApprovalChainService()
        )
        self.status_history_service = (
            status_history_service or StatusHistoryService()
        )

    def submit_retirement_application(
        self, employee_id: str, retirement_date: date, reason: str
    ) -> Dict[str, Any]:
        """
        Submit a new retirement application for an employee.

        Validates eligibility, initializes state machine, and creates
        an initial approval chain entry.
        """
        # Eligibility / validation is handled by domain entities / validators
        application = self.state_machine.create_application(
            employee_id=employee_id,
            retirement_date=retirement_date,
            reason=reason,
        )

        self.status_history_service.record(
            entity_id=application.id,
            entity_type="retirement_application",
            from_status=None,
            to_status=application.current_state,
            metadata={"retirement_date": retirement_date.isoformat()},
        )

        self.notification_service.notify_submitted(application)

        return {
            "application_id": application.id,
            "employee_id": employee_id,
            "current_state": application.current_state,
            "submitted_at": application.created_at.isoformat(),
        }

    def advance_state(
        self, application_id: str, event: str, metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Advance a retirement application through its state machine by triggering
        a domain event (e.g., "approve", "reject", "request_more_info").
        """
        application = self.state_machine.get_application(application_id)
        if application is None:
            raise ValueError(f"Application {application_id} not found")

        try:
            self.state_machine.transition(application, event, metadata or {})
        except RetirementStateTransitionException as exc:
            # Ensure failed transitions are still observable
            self.status_history_service.record(
                entity_id=application_id,
                entity_type="retirement_application",
                from_status=application.previous_state,
                to_status=application.current_state,
                metadata={"error": str(exc)},
            )
            raise

        self.status_history_service.record(
            entity_id=application_id,
            entity_type="retirement_application",
            from_status=application.previous_state,
            to_status=application.current_state,
            metadata=metadata or {},
        )

        self.notification_service.notify_state_changed(application)

        return {
            "application_id": application_id,
            "from": application.previous_state,
            "to": application.current_state,
            "event": event,
        }

    def get_application_status(self, application_id: str) -> Dict[str, Any]:
        """Retrieve current status and history for an application."""
        app = self.state_machine.get_application(application_id)
        if app is None:
            raise ValueError(f"Application {application_id} not found")

        history = self.status_history_service.list_for_entity(application_id)
        return {
            "application_id": app.id,
            "employee_id": app.employee_id,
            "current_state": app.current_state,
            "created_at": app.created_at.isoformat(),
            "history": [h.dict() for h in history],
        }

    def process_retirement_request(
        self,
        employee_id: str,
        retirement_date: date,
        estimated_value: float,
        has_beneficiary: bool = True,
    ) -> Dict[str, Any]:
        """
        High-level orchestration: submit application, run depreciation impact
        estimation (if applicable), and initiate approval workflow.
        """
        app = self.submit_retirement_application(
            employee_id=employee_id,
            retirement_date=retirement_date,
            reason="Employee-initiated retirement",
        )

        # Placeholder for domain-specific business rules / integrations
        # e.g., depreciation service estimation, beneficiary notifications
        if estimated_value is not None:
            self.notification_service.notify_estimated_value(
                application_id=app["application_id"],
                estimated_value=estimated_value,
            )

        self.approval_chain_service.initiate_for_application(
            application_id=app["application_id"],
            approvers=self.approval_chain_service.default_approvers_for(
                employee_id, has_beneficiary
            ),
        )

        return app