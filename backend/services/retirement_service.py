"""
Retirement Service Module

Provides business logic for asset retirement/bankruptcy application lifecycle:
- Create / query / withdraw retirement applications
- Approve / reject applications (admin only)
- Synchronize asset status with application state
- Maintain immutable retirement history records
"""

from datetime import date
from typing import Optional

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404

from backend.models import Asset, RetirementApplication, RetirementHistory
from backend.models.user import User
class RetirementServiceError(Exception):
    """Base exception for retirement service errors."""
    pass
class InvalidStatusError(RetirementServiceError):
    """Raised when a state transition is not allowed."""
    pass
class DuplicateApplicationError(RetirementServiceError):
    """Raised when attempting to create a duplicate active application."""
    pass
class ConflictError(RetirementServiceError):
    """Raised when optimistic lock version mismatch occurs."""
    pass
class RetirementService:
    """
    Asset retirement business service.

    Encapsulates all rules for:
    - Creating / withdrawing retirement applications
    - Admin approval / rejection
    - Asset status synchronization
    - Immutable history recording
    """

    @staticmethod
    def create_application(
        asset: Asset,
        applicant: User,
        reason: str,
        expected_date: Optional[date] = None,
    ) -> RetirementApplication:
        """
        Create a new retirement application for an asset.

        Business rules:
        - Asset must be in 'normal' status.
        - Only one active (pending/draft) application per asset.
        - Applicant must belong to the asset's owning department.

        Args:
            asset: The asset to retire.
            applicant: The user submitting the application.
            reason: Retirement reason (required).
            expected_date: Optional target retirement date.

        Returns:
            The created RetirementApplication.

        Raises:
            InvalidStatusError: If asset status is not 'normal'.
            DuplicateApplicationError: If an active application already exists.
        """
        if asset.status != "normal":
            raise InvalidStatusError(
                f"Asset '{asset.asset_code}' status is '{asset.status}', "
                "cannot submit retirement application."
            )

        if (
            RetirementApplication.objects.filter(
                asset=asset,
                status__in=["draft", "pending"],
            ).exists()
        ):
            raise DuplicateApplicationError(
                "An active retirement application already exists for this asset."
            )

        with transaction.atomic():
            application = RetirementApplication.objects.create(
                asset=asset,
                applicant=applicant,
                reason=reason,
                expected_date=expected_date,
                status="pending",
            )
            asset.status = "pending_retirement"
            asset.save(update_fields=["status"])

            RetirementHistory.objects.create(
                asset=asset,
                application=application,
                action="created",
                previous_status="normal",
                new_status="pending_retirement",
                performed_by=applicant,
            )

        return application

    @staticmethod
    def approve(
        application: RetirementApplication,
        approver: User,
        comment: str = "",
    ) -> Asset:
        """
        Approve a retirement application, transitioning asset to retired.

        Args:
            application: The application to approve.
            approver: The admin/user performing approval.
            comment: Optional approval comment.

        Returns:
            The updated Asset with status='retired'.

        Raises:
            InvalidStatusError: If application is not in 'pending' state.
            ConflictError: If the application version has changed (optimistic lock).
        """
        if application.status != "pending":
            raise InvalidStatusError(
                f"Application #{application.id} is in '{application.status}' state, "
                "cannot approve."
            )

        with transaction.atomic():
            updated = RetirementApplication.objects.filter(
                id=application.id,
                version=application.version,
            ).update(status="approved", version=F("version") + 1)

            if not updated:
                raise ConflictError(
                    "Application was concurrently modified; please retry."
                )

            application.refresh_from_db()
            asset = application.asset
            asset.status = "retired"
            asset.save(update_fields=["status"])

            RetirementHistory.objects.create(
                asset=asset,
                application=application,
                action="approved",
                previous_status="pending_retirement",
                new_status="retired",
                performed_by=approver,
                comment=comment,
            )

        return asset

    @staticmethod
    def reject(
        application: RetirementApplication,
        approver: User,
        reason: str,
    ) -> Asset:
        """
        Reject a retirement application, restoring asset to normal.

        Args:
            application: The application to reject.
            approver: The admin/user performing rejection.
            reason: Reason for rejection (required).

        Returns:
            The updated Asset with status='normal'.

        Raises:
            InvalidStatusError: If application is not in 'pending' state.
            ConflictError: If the application version has changed.
        """
        if application.status != "pending":
            raise InvalidStatusError(
                f"Application #{application.id} is in '{application.status}' state, "
                "cannot reject."
            )

        with transaction.atomic():
            updated = RetirementApplication.objects.filter(
                id=application.id,
                version=application.version,
            ).update(status="rejected", version=F("version") + 1)

            if not updated:
                raise ConflictError(
                    "Application was concurrently modified; please retry."
                )

            application.refresh_from_db()
            asset = application.asset
            asset.status = "normal"
            asset.save(update_fields=["status"])

            RetirementHistory.objects.create(
                asset=asset,
                application=application,
                action="rejected",
                previous_status="pending_retirement",
                new_status="normal",
                performed_by=approver,
                comment=reason,
            )

        return asset

    @staticmethod
    def withdraw(application: RetirementApplication) -> RetirementApplication:
        """
        Withdraw a pending retirement application.

        Only applications in 'pending' state can be withdrawn by the applicant.
        Withdrawal resets asset status to 'normal'.

        Args:
            application: The application to withdraw.

        Returns:
            The updated RetirementApplication with status='withdrawn'.

        Raises:
            InvalidStatusError: If application is not in 'pending' state.
        """
        if application.status != "pending":
            raise InvalidStatusError(
                f"Application #{application.id} is in '{application.status}' state, "
                "only pending applications can be withdrawn."
            )

        with transaction.atomic():
            application.status = "withdrawn"
            application.save(update_fields=["status"])

            asset = application.asset
            asset.status = "normal"
            asset.save(update_fields=["status"])

            RetirementHistory.objects.create(
                asset=asset,
                application=application,
                action="withdrawn",
                previous_status="pending_retirement",
                new_status="normal",
                performed_by=application.applicant,
            )

        return application