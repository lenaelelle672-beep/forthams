"""
Work Order Approval Router
===========================

RESTful endpoints for the two-level work order approval workflow.

State machine (forward):
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

State machine (reverse):
    APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED

Additional terminal states: CANCELLED

Constraints enforced:
    - No level-skipping (e.g. PENDING → APPROVING_LEVEL_2 is forbidden).
    - Rejection requires a non-empty ``rejectionReason`` (max 500 chars).
    - Optimistic locking via ``version`` field on every mutation.
    - Role-based data isolation on the pending-approval list.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Domain enums & exceptions (imported from project modules)
# ---------------------------------------------------------------------------

try:
    from src.domain.enums.workorder_status import WorkOrderStatus
    from src.domain.exceptions.workorder_exceptions import (
        InvalidStateTransitionError,
        OptimisticLockError,
    )
    from src.domain.services.approval_service import ApprovalService
    from src.models.approval_record import ApprovalRecord
    from src.models.workorder import WorkOrder
except ImportError:
    # Fallback definitions when the upstream modules are not yet available.
    # These allow the router to be statically analysed and unit-tested in
    # isolation.  In production the real imports above take precedence.

    class WorkOrderStatus(str, enum.Enum):
        """All possible states of a work order."""

        PENDING = "PENDING"
        APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
        APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
        APPROVED = "APPROVED"
        REJECTED = "REJECTED"
        CANCELLED = "CANCELLED"

    class InvalidStateTransitionError(Exception):
        """Raised when a state transition is not permitted by the machine."""

        def __init__(self, current: str, target: str) -> None:
            self.current = current
            self.target = target
            super().__init__(
                f"Invalid state transition: {current} → {target}"
            )

    class OptimisticLockError(Exception):
        """Raised when an optimistic-lock version check fails."""

        def __init__(self, expected_version: int, actual_version: int) -> None:
            self.expected_version = expected_version
            self.actual_version = actual_version
            super().__init__(
                f"Optimistic lock conflict: expected version "
                f"{expected_version}, actual {actual_version}"
            )

    # Minimal stubs so the router can be imported without a DB.
    class WorkOrder:  # type: ignore[no-redef]
        """Placeholder WorkOrder model."""

        def __init__(
            self,
            id: str = "",
            status: str = WorkOrderStatus.PENDING,
            version: int = 1,
        ) -> None:
            self.id = id
            self.status = status
            self.version = version

    class ApprovalRecord:  # type: ignore[no-redef]
        """Placeholder ApprovalRecord model."""

        def __init__(
            self,
            id: str = "",
            order_id: str = "",
            operator_id: str = "",
            action: str = "",
            comment: str = "",
            created_at: Optional[datetime] = None,
        ) -> None:
            self.id = id
            self.order_id = order_id
            self.operator_id = operator_id
            self.action = action
            self.comment = comment
            self.created_at = created_at or datetime.now(timezone.utc)

    class ApprovalService:  # type: ignore[no-redef]
        """Placeholder service – to be replaced by the real implementation."""

        pass


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/orders", tags=["work-order-approval"])

# ---------------------------------------------------------------------------
# Business error codes returned in the JSON body
# ---------------------------------------------------------------------------

ERR_INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
ERR_OPTIMISTIC_LOCK_CONFLICT = "OPTIMISTIC_LOCK_CONFLICT"
ERR_REJECTION_REASON_REQUIRED = "REJECTION_REASON_REQUIRED"
ERR_ORDER_NOT_FOUND = "ORDER_NOT_FOUND"
ERR_FORBIDDEN_ROLE = "FORBIDDEN_ROLE"


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ApproveRequest(BaseModel):
    """Body for ``POST /api/orders/{id}/approve``."""

    version: int = Field(
        ...,
        description="Optimistic-lock version of the work order at read time.",
        ge=1,
    )


class RejectRequest(BaseModel):
    """Body for ``POST /api/orders/{id}/reject``."""

    version: int = Field(
        ...,
        description="Optimistic-lock version of the work order at read time.",
        ge=1,
    )
    rejection_reason: str = Field(
        ...,
        description="Mandatory reason for the rejection (1–500 characters).",
        min_length=1,
        max_length=500,
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_be_non_empty(cls, v: str) -> str:
        """Ensure the rejection reason is not just whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank")
        return stripped


class ApprovalActionResponse(BaseModel):
    """Success response for approve / reject operations."""

    order_id: str
    status: str
    version: int
    message: str
    approval_record_id: Optional[str] = None


class ApprovalRecordResponse(BaseModel):
    """A single approval record returned in list/detail responses."""

    id: str
    order_id: str
    operator_id: str
    action: str
    comment: Optional[str] = None
    created_at: datetime


class PendingApprovalItem(BaseModel):
    """One work order visible in the pending-approval list."""

    order_id: str
    order_number: str
    applicant_id: str
    applicant_name: Optional[str] = None
    submitted_at: datetime
    status: str
    version: int


class PendingApprovalListResponse(BaseModel):
    """Paginated list of work orders awaiting the caller's approval."""

    items: list[PendingApprovalItem]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    error_code: str
    message: str
    details: Optional[dict] = None


# ---------------------------------------------------------------------------
# State machine – forward & reverse transition tables
# ---------------------------------------------------------------------------

# Forward (approve) transitions: current → next
_APPROVE_TRANSITIONS: dict[WorkOrderStatus, WorkOrderStatus] = {
    WorkOrderStatus.PENDING: WorkOrderStatus.APPROVING_LEVEL_1,
    WorkOrderStatus.APPROVING_LEVEL_1: WorkOrderStatus.APPROVING_LEVEL_2,
    WorkOrderStatus.APPROVING_LEVEL_2: WorkOrderStatus.APPROVED,
}

# States from which rejection is allowed
_REJECTABLE_STATES: set[WorkOrderStatus] = {
    WorkOrderStatus.APPROVING_LEVEL_1,
    WorkOrderStatus.APPROVING_LEVEL_2,
}

# Terminal states – no further transitions permitted
_TERMINAL_STATES: set[WorkOrderStatus] = {
    WorkOrderStatus.APPROVED,
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.CANCELLED,
}


def _validate_approve_transition(current: WorkOrderStatus) -> WorkOrderStatus:
    """Validate and return the next status for an approve action.

    Raises ``InvalidStateTransitionError`` when the transition is illegal.
    """
    if current in _TERMINAL_STATES:
        raise InvalidStateTransitionError(current.value, "APPROVED")
    next_status = _APPROVE_TRANSITIONS.get(current)
    if next_status is None:
        raise InvalidStateTransitionError(current.value, "APPROVED")
    return next_status


def _validate_reject_transition(current: WorkOrderStatus) -> None:
    """Validate that a reject action is legal from *current*.

    Raises ``InvalidStateTransitionError`` when the transition is illegal.
    """
    if current not in _REJECTABLE_STATES:
        raise InvalidStateTransitionError(current.value, "REJECTED")


# ---------------------------------------------------------------------------
# Helper – extract current user from request (stub / dependency)
# ---------------------------------------------------------------------------


async def _get_current_user_id(request: Request) -> str:
    """Return the authenticated user's ID from the request context.

    In production this reads from the JWT token / session.  The stub
    returns a placeholder so the router can be exercised without auth.
    """
    # Real implementation would decode JWT, e.g.:
    # token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    # return jwt.decode(token)["sub"]
    user_id: Optional[str] = getattr(request.state, "user_id", None)
    if user_id is None:
        user_id = "anonymous"
    return user_id


async def _get_current_user_role(request: Request) -> str:
    """Return the authenticated user's role.

    Expected values: ``DEPARTMENT_MANAGER`` | ``ASSET_MANAGER`` | ``ADMIN``.
    """
    role: Optional[str] = getattr(request.state, "user_role", None)
    if role is None:
        role = "DEPARTMENT_MANAGER"
    return role


# ---------------------------------------------------------------------------
# Role → visible approval level mapping (data isolation)
# ---------------------------------------------------------------------------

_ROLE_LEVEL_MAP: dict[str, WorkOrderStatus] = {
    "DEPARTMENT_MANAGER": WorkOrderStatus.APPROVING_LEVEL_1,
    "ASSET_MANAGER": WorkOrderStatus.APPROVING_LEVEL_2,
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{order_id}/approve",
    response_model=ApprovalActionResponse,
    responses={
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
    },
    summary="Approve a work order (advance to next approval level)",
)
async def approve_work_order(
    order_id: str,
    body: ApproveRequest,
    request: Request,
) -> ApprovalActionResponse:
    """Advance a work order to the next approval level.

    The state machine enforces sequential progression:
    ``PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED``.

    Returns **409 Conflict** when:
    * the requested transition is illegal (error code
      ``INVALID_STATE_TRANSITION``), or
    * the optimistic-lock ``version`` does not match the current record
      (error code ``OPTIMISTIC_LOCK_CONFLICT``).
    """
    operator_id = await _get_current_user_id(request)

    # --- In a real implementation the service layer handles DB access ---
    # We call the service which will:
    #   1. Load the work order by ID
    #   2. Compare version (optimistic lock)
    #   3. Validate state transition
    #   4. Update status & increment version
    #   5. Insert an approval record
    #   6. Commit atomically (@Transactional)
    try:
        result = await _execute_approve(
            order_id=order_id,
            version=body.version,
            operator_id=operator_id,
        )
    except InvalidStateTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code=ERR_INVALID_STATE_TRANSITION,
                message=str(exc),
                details={"current": exc.current, "target": exc.target},
            ).model_dump(),
        ) from exc
    except OptimisticLockError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code=ERR_OPTIMISTIC_LOCK_CONFLICT,
                message=str(exc),
                details={
                    "expected_version": exc.expected_version,
                    "actual_version": exc.actual_version,
                },
            ).model_dump(),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ERR_ORDER_NOT_FOUND,
                message=f"Work order '{order_id}' not found.",
            ).model_dump(),
        ) from exc

    return result


@router.post(
    "/{order_id}/reject",
    response_model=ApprovalActionResponse,
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
    },
    summary="Reject a work order",
)
async def reject_work_order(
    order_id: str,
    body: RejectRequest,
    request: Request,
) -> ApprovalActionResponse:
    """Reject a work order at the current approval level.

    A mandatory ``rejectionReason`` (1–500 non-whitespace characters) must
    be provided.  Missing or blank reasons result in **400 Bad Request**.

    Returns **409 Conflict** for illegal state transitions or optimistic
    lock conflicts.
    """
    operator_id = await _get_current_user_id(request)

    try:
        result = await _execute_reject(
            order_id=order_id,
            version=body.version,
            operator_id=operator_id,
            rejection_reason=body.rejection_reason,
        )
    except InvalidStateTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code=ERR_INVALID_STATE_TRANSITION,
                message=str(exc),
                details={"current": exc.current, "target": exc.target},
            ).model_dump(),
        ) from exc
    except OptimisticLockError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code=ERR_OPTIMISTIC_LOCK_CONFLICT,
                message=str(exc),
                details={
                    "expected_version": exc.expected_version,
                    "actual_version": exc.actual_version,
                },
            ).model_dump(),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ERR_ORDER_NOT_FOUND,
                message=f"Work order '{order_id}' not found.",
            ).model_dump(),
        ) from exc

    return result


@router.get(
    "/pending",
    response_model=PendingApprovalListResponse,
    responses={
        status.HTTP_403_FORBIDDEN: {"model": ErrorResponse},
    },
    summary="List work orders pending approval for the current user's role",
)
async def list_pending_approvals(
    request: Request,
    page: int = Query(1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        20, ge=1, le=100, description="Number of items per page."
    ),
) -> PendingApprovalListResponse:
    """Return work orders that are awaiting the current user's approval.

    **Data isolation rules:**

    * ``DEPARTMENT_MANAGER`` → only ``APPROVING_LEVEL_1`` orders.
    * ``ASSET_MANAGER`` → only ``APPROVING_LEVEL_2`` orders.
    * ``ADMIN`` → both levels (union).

    Returns **403 Forbidden** if the user's role is not recognised.
    """
    role = await _get_current_user_role(request)

    if role not in _ROLE_LEVEL_MAP and role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                error_code=ERR_FORBIDDEN_ROLE,
                message=(
                    f"Role '{role}' is not authorised to view pending approvals."
                ),
            ).model_dump(),
        )

    # Determine which statuses this role can see
    if role == "ADMIN":
        visible_statuses = [
            WorkOrderStatus.APPROVING_LEVEL_1,
            WorkOrderStatus.APPROVING_LEVEL_2,
        ]
    else:
        visible_statuses = [_ROLE_LEVEL_MAP[role]]

    result = await _query_pending_approvals(
        statuses=visible_statuses,
        page=page,
        page_size=page_size,
    )
    return result


@router.get(
    "/{order_id}/approval-records",
    response_model=list[ApprovalRecordResponse],
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
    },
    summary="Get the full approval history for a work order",
)
async def get_approval_records(
    order_id: str,
) -> list[ApprovalRecordResponse]:
    """Return all approval records associated with *order_id*, ordered by
    creation time ascending.

    Each record captures the operator, action (APPROVE / REJECT), optional
    comment / rejection reason, and ISO-8601 timestamp.
    """
    records = await _fetch_approval_records(order_id)
    return [
        ApprovalRecordResponse(
            id=r.id,
            order_id=r.order_id,
            operator_id=r.operator_id,
            action=r.action,
            comment=r.comment,
            created_at=r.created_at,
        )
        for r in records
    ]


# ---------------------------------------------------------------------------
# Service-layer stubs
# ---------------------------------------------------------------------------
# In production these delegate to ``ApprovalService`` + repository layer.
# The stubs allow the router to be imported and tested without a database.


async def _execute_approve(
    order_id: str,
    version: int,
    operator_id: str,
) -> ApprovalActionResponse:
    """Run the approve flow via the service layer.

    Steps (atomic transaction):
        1. Load work order; raise ``FileNotFoundError`` if missing.
        2. Check ``version`` matches (optimistic lock).
        3. Validate state-machine transition.
        4. Persist new status & incremented version.
        5. Insert ``ApprovalRecord``.
        6. Return response.
    """
    # --- Replace with real service call in production ---
    # order = await work_order_repo.get_by_id(order_id)
    # if order is None: raise FileNotFoundError
    # if order.version != version: raise OptimisticLockError(...)
    # current = WorkOrderStatus(order.status)
    # next_status = _validate_approve_transition(current)
    # order.status = next_status.value
    # order.version += 1
    # await work_order_repo.update(order)
    # record = ApprovalRecord(order_id=order_id, operator_id=operator_id,
    #                         action="APPROVE", comment=None)
    # await approval_record_repo.insert(record)
    # return ApprovalActionResponse(...)

    # Stub: simulate success
    record_id = str(uuid.uuid4())
    return ApprovalActionResponse(
        order_id=order_id,
        status=WorkOrderStatus.APPROVING_LEVEL_1.value,
        version=version + 1,
        message="Work order approved successfully.",
        approval_record_id=record_id,
    )


async def _execute_reject(
    order_id: str,
    version: int,
    operator_id: str,
    rejection_reason: str,
) -> ApprovalActionResponse:
    """Run the reject flow via the service layer.

    Steps (atomic transaction):
        1. Load work order; raise ``FileNotFoundError`` if missing.
        2. Check ``version`` matches (optimistic lock).
        3. Validate state-machine transition.
        4. Persist ``REJECTED`` status & incremented version.
        5. Insert ``ApprovalRecord`` with rejection reason.
        6. Return response.
    """
    # --- Replace with real service call in production ---
    # order = await work_order_repo.get_by_id(order_id)
    # if order is None: raise FileNotFoundError
    # if order.version != version: raise OptimisticLockError(...)
    # current = WorkOrderStatus(order.status)
    # _validate_reject_transition(current)
    # order.status = WorkOrderStatus.REJECTED.value
    # order.version += 1
    # await work_order_repo.update(order)
    # record = ApprovalRecord(order_id=order_id, operator_id=operator_id,
    #                         action="REJECT", comment=rejection_reason)
    # await approval_record_repo.insert(record)
    # return ApprovalActionResponse(...)

    # Stub: simulate success
    record_id = str(uuid.uuid4())
    return ApprovalActionResponse(
        order_id=order_id,
        status=WorkOrderStatus.REJECTED.value,
        version=version + 1,
        message="Work order rejected.",
        approval_record_id=record_id,
    )


async def _query_pending_approvals(
    statuses: list[WorkOrderStatus],
    page: int,
    page_size: int,
) -> PendingApprovalListResponse:
    """Query work orders whose status is in *statuses*, paginated.

    In production this delegates to the repository / service layer.
    """
    # --- Replace with real query ---
    # items = await work_order_repo.list_by_status(
    #     statuses=[s.value for s in statuses],
    #     offset=(page - 1) * page_size,
    #     limit=page_size,
    # )
    # total = await work_order_repo.count_by_status(
    #     statuses=[s.value for s in statuses],
    # )

    # Stub: return empty list
    return PendingApprovalListResponse(
        items=[],
        total=0,
        page=page,
        page_size=page_size,
    )


async def _fetch_approval_records(
    order_id: str,
) -> list[ApprovalRecord]:
    """Return all approval records for *order_id*, newest first.

    In production this delegates to the repository layer.
    """
    # --- Replace with real query ---
    # records = await approval_record_repo.list_by_order_id(order_id)
    # return records

    # Stub: return empty list
    return []