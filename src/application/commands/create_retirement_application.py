"""
Create Retirement Application Use Case

This module implements the command to submit an asset retirement application.
It orchestrates validation, state transition, and audit logging for the
asset报废退役流程 (asset retirement process).
"""

from typing import Any
from datetime import date

from src.domain.entities.retirement_application import RetirementApplication
from src.domain.entities.asset import Asset
from src.domain.entities.user import User
from src.domain.services.retirement_service import RetirementService
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.exceptions.duplicate_request_exception import DuplicateRequestException
from src.domain.exceptions.invalid_status_error import InvalidStatusError
from src.domain.exceptions.permission_denied_error import PermissionDeniedError


class CreateRetirementApplication:
    """
    Command handler for submitting a new asset retirement application.

    Responsibilities:
    - Validate preconditions (asset status, permissions, uniqueness)
    - Persist the RetirementApplication record
    - Update Asset status to 'pending_retirement'
    - Record an audit history entry
    """

    def __init__(self, retirement_service: RetirementService) -> None:
        self.retirement_service = retirement_service

    def execute(
        self,
        asset_id: int,
        applicant: User,
        reason: str,
        expected_date: date | None = None,
        comment: str | None = None,
    ) -> RetirementApplication:
        """
        Submit a retirement application for the given asset.

        Args:
            asset_id: The unique identifier of the asset to retire.
            applicant: The user requesting retirement.
            reason: Business justification for retirement.
            expected_date: Optional target retirement date.
            comment: Optional free-text comment.

        Returns:
            The created RetirementApplication entity.

        Raises:
            InvalidStatusError: If the asset is not in a normal state.
            PermissionDeniedError: If the applicant does not own the asset's department.
            DuplicateRequestException: If an active application already exists for the asset.
        """
        # --- validation (business rules) ---
        # The domain service enforces invariants; this handler passes intent.
        application = self.retirement_service.create_application(
            asset_id=asset_id,
            applicant=applicant,
            reason=reason,
            expected_date=expected_date,
            comment=comment or "",
        )

        # --- persistence & side-effects ---
        # RetirementService handles transaction, status update, and history recording.
        return application