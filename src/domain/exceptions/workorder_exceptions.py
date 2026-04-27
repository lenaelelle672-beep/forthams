"""Work order domain exceptions.

Provides a hierarchy of domain-level exceptions for the work order approval
workflow, including state-machine violations, rejection validation errors,
optimistic-lock conflicts, and role-based access control failures.

Each exception carries a structured ``error_code`` and ``http_status`` so that
the API layer can translate them into the correct HTTP response automatically.

Reference: SPEC Phase 1 — Core Approval Flow & Basic Workbench
"""

from __future__ import annotations

from typing import Any, Optional


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class WorkOrderError(Exception):
    """Base exception for all work-order domain errors.

    Attributes:
        message: Human-readable description of the error.
        error_code: Machine-readable error code used in API responses.
        http_status: Suggested HTTP status code for the API response.
        details: Optional dict with extra context (e.g. current state, target state).
    """

    def __init__(
        self,
        message: str,
        error_code: str = "WORK_ORDER_ERROR",
        http_status: int = 500,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.message = message
        self.error_code = error_code
        self.http_status = http_status
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Return a serialisable representation for API error payloads."""
        payload: dict[str, Any] = {
            "error_code": self.error_code,
            "message": self.message,
        }
        if self.details:
            payload["details"] = self.details
        return payload


# ---------------------------------------------------------------------------
# State Machine Violations  (HTTP 409)
# ---------------------------------------------------------------------------

class InvalidStateTransitionError(WorkOrderError):
    """Raised when a state-machine transition is not permitted.

    Maps to **HTTP 409 Conflict** with error code ``INVALID_STATE_TRANSITION``.

    Example:
        Attempting to approve a ``PENDING`` work order as an asset manager
        (which requires ``APPROVING_LEVEL_2``) triggers this exception.
    """

    def __init__(
        self,
        current_state: str,
        target_state: str,
        action: str,
        work_order_id: Optional[int] = None,
    ) -> None:
        details: dict[str, Any] = {
            "current_state": current_state,
            "target_state": target_state,
            "action": action,
        }
        if work_order_id is not None:
            details["work_order_id"] = work_order_id

        message = (
            f"Cannot transition work order from '{current_state}' to "
            f"'{target_state}' via action '{action}'."
        )
        super().__init__(
            message=message,
            error_code="INVALID_STATE_TRANSITION",
            http_status=409,
            details=details,
        )


class WorkOrderAlreadyClosedError(WorkOrderError):
    """Raised when an operation is attempted on a terminal-state work order.

    Maps to **HTTP 409 Conflict** with error code ``WORK_ORDER_ALREADY_CLOSED``.
    """

    def __init__(
        self,
        work_order_id: Optional[int] = None,
        current_state: str = "CLOSED",
    ) -> None:
        details: dict[str, Any] = {"current_state": current_state}
        if work_order_id is not None:
            details["work_order_id"] = work_order_id

        super().__init__(
            message=f"Work order is already in terminal state '{current_state}' and cannot be modified.",
            error_code="WORK_ORDER_ALREADY_CLOSED",
            http_status=409,
            details=details,
        )


# ---------------------------------------------------------------------------
# Rejection Validation  (HTTP 400)
# ---------------------------------------------------------------------------

class RejectionReasonRequiredError(WorkOrderError):
    """Raised when a reject action is submitted without a rejection reason.

    Per SPEC: ``rejectionReason`` is a **required, non-empty** string
    (max 500 characters).  Missing or blank values must return
    **HTTP 400 Bad Request** with error code ``REJECTION_REASON_REQUIRED``.
    """

    def __init__(
        self,
        work_order_id: Optional[int] = None,
    ) -> None:
        details: dict[str, Any] = {
            "field": "rejectionReason",
            "constraint": "non-empty string, max 500 characters",
        }
        if work_order_id is not None:
            details["work_order_id"] = work_order_id

        super().__init__(
            message="Rejection reason is required and must be a non-empty string (max 500 characters).",
            error_code="REJECTION_REASON_REQUIRED",
            http_status=400,
            details=details,
        )


class RejectionReasonTooLongError(WorkOrderError):
    """Raised when the rejection reason exceeds the maximum allowed length.

    Maps to **HTTP 400 Bad Request** with error code ``REJECTION_REASON_TOO_LONG``.
    """

    def __init__(
        self,
        actual_length: int,
        max_length: int = 500,
        work_order_id: Optional[int] = None,
    ) -> None:
        details: dict[str, Any] = {
            "field": "rejectionReason",
            "actual_length": actual_length,
            "max_length": max_length,
        }
        if work_order_id is not None:
            details["work_order_id"] = work_order_id

        super().__init__(
            message=(
                f"Rejection reason length ({actual_length}) exceeds "
                f"maximum allowed length ({max_length} characters)."
            ),
            error_code="REJECTION_REASON_TOO_LONG",
            http_status=400,
            details=details,
        )


# ---------------------------------------------------------------------------
# Optimistic Lock / Concurrency  (HTTP 409)
# ---------------------------------------------------------------------------

class ConcurrentApprovalConflictError(WorkOrderError):
    """Raised when an optimistic-lock version mismatch is detected.

    This occurs when two users attempt to approve/reject the same work order
    concurrently.  The ``version`` field on the work order is used as the
    optimistic-lock token.

    Maps to **HTTP 409 Conflict** with error code ``CONCURRENT_APPROVAL_CONFLICT``.
    """

    def __init__(
        self,
        work_order_id: Optional[int] = None,
        expected_version: Optional[int] = None,
        actual_version: Optional[int] = None,
    ) -> None:
        details: dict[str, Any] = {}
        if work_order_id is not None:
            details["work_order_id"] = work_order_id
        if expected_version is not None:
            details["expected_version"] = expected_version
        if actual_version is not None:
            details["actual_version"] = actual_version

        super().__init__(
            message="Concurrent modification detected. The work order has been modified by another user.",
            error_code="CONCURRENT_APPROVAL_CONFLICT",
            http_status=409,
            details=details,
        )


# ---------------------------------------------------------------------------
# Role / Permission  (HTTP 403)
# ---------------------------------------------------------------------------

class ApprovalPermissionDeniedError(WorkOrderError):
    """Raised when the current user lacks the required role for an approval action.

    Per SPEC data-isolation rules:
    - Department managers may only see/approve ``APPROVING_LEVEL_1`` work orders.
    - Asset managers may only see/approve ``APPROVING_LEVEL_2`` work orders.

    Maps to **HTTP 403 Forbidden** with error code ``APPROVAL_PERMISSION_DENIED``.
    """

    def __init__(
        self,
        user_role: str,
        required_role: str,
        work_order_id: Optional[int] = None,
        work_order_status: Optional[str] = None,
    ) -> None:
        details: dict[str, Any] = {
            "user_role": user_role,
            "required_role": required_role,
        }
        if work_order_id is not None:
            details["work_order_id"] = work_order_id
        if work_order_status is not None:
            details["work_order_status"] = work_order_status

        super().__init__(
            message=(
                f"User with role '{user_role}' is not authorised to perform "
                f"this approval action. Required role: '{required_role}'."
            ),
            error_code="APPROVAL_PERMISSION_DENIED",
            http_status=403,
            details=details,
        )


# ---------------------------------------------------------------------------
# Not Found  (HTTP 404)
# ---------------------------------------------------------------------------

class WorkOrderNotFoundError(WorkOrderError):
    """Raised when a referenced work order does not exist.

    Maps to **HTTP 404 Not Found** with error code ``WORK_ORDER_NOT_FOUND``.
    """

    def __init__(self, work_order_id: int) -> None:
        super().__init__(
            message=f"Work order with id '{work_order_id}' not found.",
            error_code="WORK_ORDER_NOT_FOUND",
            http_status=404,
            details={"work_order_id": work_order_id},
        )


class ApprovalRecordNotFoundError(WorkOrderError):
    """Raised when a referenced approval record does not exist.

    Maps to **HTTP 404 Not Found** with error code ``APPROVAL_RECORD_NOT_FOUND``.
    """

    def __init__(self, record_id: int) -> None:
        super().__init__(
            message=f"Approval record with id '{record_id}' not found.",
            error_code="APPROVAL_RECORD_NOT_FOUND",
            http_status=404,
            details={"record_id": record_id},
        )


# ---------------------------------------------------------------------------
# Cancellation  (HTTP 409)
# ---------------------------------------------------------------------------

class WorkOrderCancellationError(WorkOrderError):
    """Raised when a work order cannot be cancelled in its current state.

    Only work orders in ``PENDING``, ``APPROVING_LEVEL_1``, or
    ``APPROVING_LEVEL_2`` states may be cancelled.

    Maps to **HTTP 409 Conflict** with error code ``WORK_ORDER_CANNOT_CANCEL``.
    """

    def __init__(
        self,
        current_state: str,
        work_order_id: Optional[int] = None,
    ) -> None:
        details: dict[str, Any] = {
            "current_state": current_state,
            "allowed_states_for_cancel": [
                "PENDING",
                "APPROVING_LEVEL_1",
                "APPROVING_LEVEL_2",
            ],
        }
        if work_order_id is not None:
            details["work_order_id"] = work_order_id

        super().__init__(
            message=(
                f"Cannot cancel work order in state '{current_state}'. "
                f"Only PENDING, APPROVING_LEVEL_1, and APPROVING_LEVEL_2 "
                f"work orders may be cancelled."
            ),
            error_code="WORK_ORDER_CANNOT_CANCEL",
            http_status=409,
            details=details,
        )


# ---------------------------------------------------------------------------
# Duplicate Action  (HTTP 409)
# ---------------------------------------------------------------------------

class DuplicateApprovalActionError(WorkOrderError):
    """Raised when the same approval action is submitted more than once.

    Maps to **HTTP 409 Conflict** with error code ``DUPLICATE_APPROVAL_ACTION``.
    """

    def __init__(
        self,
        action: str,
        work_order_id: Optional[int] = None,
    ) -> None:
        details: dict[str, Any] = {"action": action}
        if work_order_id is not None:
            details["work_order_id"] = work_order_id

        super().__init__(
            message=f"Approval action '{action}' has already been applied to this work order.",
            error_code="DUPLICATE_APPROVAL_ACTION",
            http_status=409,
            details=details,
        )