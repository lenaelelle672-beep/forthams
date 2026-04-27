"""
Approval Router — Multi-level work-order approval endpoints.

Provides RESTful endpoints for the two-level approval workflow:
  - Department Manager (Level 1)  →  Asset Manager (Level 2)  →  Approved

State machine enforced transitions:
  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  Any approval node ──reject──→ REJECTED
  PENDING / any approval node ──cancel──→ CANCELLED

All endpoints require authentication; data isolation is enforced by role.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["approvals"])


# ---------------------------------------------------------------------------
# Enums & Constants
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """Work-order lifecycle statuses enforced by the backend state machine."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Actions that can be recorded in the approval history."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class UserRole(str, Enum):
    """Roles relevant to the approval workflow."""

    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
    ASSET_MANAGER = "ASSET_MANAGER"
    ADMIN = "ADMIN"


# Valid forward transitions (state machine rules)
_VALID_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.PENDING: [OrderStatus.APPROVING_LEVEL_1],
    OrderStatus.APPROVING_LEVEL_1: [OrderStatus.APPROVING_LEVEL_2],
    OrderStatus.APPROVING_LEVEL_2: [OrderStatus.APPROVED],
}

# States from which a reject is allowed
_REJECTABLE_STATES: set[OrderStatus] = {
    OrderStatus.APPROVING_LEVEL_1,
    OrderStatus.APPROVING_LEVEL_2,
}

# States from which a cancel is allowed
_CANCELLABLE_STATES: set[OrderStatus] = {
    OrderStatus.PENDING,
    OrderStatus.APPROVING_LEVEL_1,
    OrderStatus.APPROVING_LEVEL_2,
}

# Mapping: which role is allowed to approve at which status
_ROLE_APPROVAL_MAP: dict[OrderStatus, set[UserRole]] = {
    OrderStatus.PENDING: {UserRole.DEPARTMENT_MANAGER, UserRole.ADMIN},
    OrderStatus.APPROVING_LEVEL_1: {UserRole.ASSET_MANAGER, UserRole.ADMIN},
    OrderStatus.APPROVING_LEVEL_2: {UserRole.ADMIN},
}

# Mapping: which statuses are visible to which role in the pending-approval list
_ROLE_VISIBLE_STATUSES: dict[UserRole, list[OrderStatus]] = {
    UserRole.DEPARTMENT_MANAGER: [OrderStatus.APPROVING_LEVEL_1],
    UserRole.ASSET_MANAGER: [OrderStatus.APPROVING_LEVEL_2],
    UserRole.ADMIN: [
        OrderStatus.APPROVING_LEVEL_1,
        OrderStatus.APPROVING_LEVEL_2,
    ],
}


# ---------------------------------------------------------------------------
# Pydantic Schemas (Request / Response)
# ---------------------------------------------------------------------------

class RejectRequest(BaseModel):
    """Body for the reject endpoint.  ``rejectionReason`` is mandatory."""

    rejectionReason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Mandatory reason for rejecting the work order (1-500 chars).",
    )

    @field_validator("rejectionReason")
    @classmethod
    def rejection_reason_must_be_non_blank(cls, v: str) -> str:
        """Ensure the rejection reason is not just whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejectionReason must not be blank")
        return stripped


class ApproveRequest(BaseModel):
    """Body for the approve endpoint (currently empty but extensible)."""

    pass


class CancelRequest(BaseModel):
    """Body for the cancel endpoint (currently empty but extensible)."""

    pass


class ApprovalRecordResponse(BaseModel):
    """A single approval-history record returned by the API."""

    id: int
    orderId: int
    operatorId: int
    operatorName: str
    action: ApprovalAction
    comment: Optional[str] = None
    createdAt: str  # ISO 8601


class WorkOrderApprovalResponse(BaseModel):
    """Work-order data returned in approval list / detail responses."""

    id: int
    orderNo: str
    applicantId: int
    applicantName: str
    status: OrderStatus
    submittedAt: str  # ISO 8601
    version: int
    approvalRecords: list[ApprovalRecordResponse] = Field(default_factory=list)


class ApprovalListResponse(BaseModel):
    """Paginated list of work orders awaiting the current user's approval."""

    items: list[WorkOrderApprovalResponse]
    total: int
    page: int
    pageSize: int


class ApprovalActionResponse(BaseModel):
    """Response returned after a successful approve / reject / cancel action."""

    orderId: int
    previousStatus: OrderStatus
    currentStatus: OrderStatus
    action: ApprovalAction
    operatorId: int
    operatedAt: str  # ISO 8601
    approvalRecordId: int


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    errorCode: str
    message: str
    details: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Helper / Dependency Functions
# ---------------------------------------------------------------------------

def _current_user_id(request: Request) -> int:
    """Extract the authenticated user ID from the request context.

    In production this reads from the JWT token injected by auth middleware.
    For now it falls back to a header or query param for testability.
    """
    user_id = getattr(request.state, "user_id", None)
    if user_id is None:
        # Fallback: read from X-User-Id header (useful in integration tests)
        header_id = request.headers.get("X-User-Id")
        if header_id is not None:
            try:
                user_id = int(header_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid X-User-Id header",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
    return user_id


def _current_user_role(request: Request) -> UserRole:
    """Extract the authenticated user's role from the request context.

    Falls back to X-User-Role header for testability.
    """
    role = getattr(request.state, "user_role", None)
    if role is None:
        header_role = request.headers.get("X-User-Role")
        if header_role is not None:
            try:
                role = UserRole(header_role.upper())
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid role: {header_role}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User role not found",
            )
    return role


def _current_user_name(request: Request) -> str:
    """Extract the authenticated user's display name from the request context."""
    name = getattr(request.state, "user_name", None)
    if name is None:
        name = request.headers.get("X-User-Name", "Unknown")
    return name


# ---------------------------------------------------------------------------
# In-process stub repositories
# ---------------------------------------------------------------------------
# These stubs simulate database access.  In a real deployment they are
# replaced by SQLAlchemy / repository-injected dependencies.

# Simulated work-order store:  {order_id: {…}}
_work_orders: dict[int, dict[str, Any]] = {}

# Simulated approval-record store:  {record_id: {…}}
_approval_records: dict[int, dict[str, Any]] = {}

# Auto-increment counters
_next_order_id: int = 1
_next_record_id: int = 1


def _get_work_order(order_id: int) -> dict[str, Any]:
    """Retrieve a work order by ID or raise 404."""
    order = _work_orders.get(order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order {order_id} not found",
        )
    return order


def _save_approval_record(
    order_id: int,
    operator_id: int,
    operator_name: str,
    action: ApprovalAction,
    comment: Optional[str],
) -> int:
    """Persist an approval record and return its ID."""
    global _next_record_id
    record_id = _next_record_id
    _next_record_id += 1
    now = datetime.now(timezone.utc).isoformat()
    _approval_records[record_id] = {
        "id": record_id,
        "orderId": order_id,
        "operatorId": operator_id,
        "operatorName": operator_name,
        "action": action.value,
        "comment": comment,
        "createdAt": now,
    }
    return record_id


def _get_approval_records_for_order(order_id: int) -> list[dict[str, Any]]:
    """Return all approval records for a given work order, newest first."""
    return sorted(
        [r for r in _approval_records.values() if r["orderId"] == order_id],
        key=lambda r: r["id"],
        reverse=True,
    )


def _update_work_order_status(
    order: dict[str, Any],
    new_status: OrderStatus,
    expected_version: int,
) -> dict[str, Any]:
    """Update work-order status with optimistic locking.

    Returns the updated order dict.  Raises HTTP 409 if version mismatch.
    """
    if order["version"] != expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                errorCode="OPTIMISTIC_LOCK_CONFLICT",
                message=(
                    f"Work order was modified by another user. "
                    f"Expected version {expected_version}, actual {order['version']}."
                ),
            ).model_dump(),
        )
    order["status"] = new_status.value
    order["version"] += 1
    order["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return order


# ---------------------------------------------------------------------------
# State Machine Validation
# ---------------------------------------------------------------------------

def _validate_approve_transition(
    current_status: OrderStatus,
    user_role: UserRole,
) -> OrderStatus:
    """Validate and compute the target status for an approve action.

    Raises HTTP 409 if the transition is illegal or the user lacks permission.
    """
    # Check role permission
    allowed_roles = _ROLE_APPROVAL_MAP.get(current_status, set())
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                errorCode="ROLE_NOT_ALLOWED",
                message=(
                    f"Role '{user_role.value}' is not allowed to approve "
                    f"orders in status '{current_status.value}'."
                ),
            ).model_dump(),
        )

    # Check valid transition
    valid_targets = _VALID_TRANSITIONS.get(current_status)
    if valid_targets is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                errorCode="INVALID_STATE_TRANSITION",
                message=(
                    f"Cannot approve work order in status '{current_status.value}'. "
                    f"No valid forward transition defined."
                ),
            ).model_dump(),
        )

    # For PENDING → APPROVING_LEVEL_1, the target is APPROVING_LEVEL_1
    # For APPROVING_LEVEL_1 → APPROVING_LEVEL_2, the target is APPROVING_LEVEL_2
    # For APPROVING_LEVEL_2 → APPROVED, the target is APPROVED
    target = valid_targets[0]
    return target


def _validate_reject_transition(
    current_status: OrderStatus,
    user_role: UserRole,
) -> None:
    """Validate that a reject action is legal for the current state and role.

    Raises HTTP 409 for invalid state, HTTP 403 for insufficient role.
    """
    if current_status not in _REJECTABLE_STATES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                errorCode="INVALID_STATE_TRANSITION",
                message=(
                    f"Cannot reject work order in status '{current_status.value}'. "
                    f"Reject is only allowed from: "
                    f"{', '.join(s.value for s in _REJECTABLE_STATES)}."
                ),
            ).model_dump(),
        )

    # Any role that can approve at this level can also reject
    allowed_roles = _ROLE_APPROVAL_MAP.get(current_status, set())
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                errorCode="ROLE_NOT_ALLOWED",
                message=(
                    f"Role '{user_role.value}' is not allowed to reject "
                    f"orders in status '{current_status.value}'."
                ),
            ).model_dump(),
        )


def _validate_cancel_transition(
    current_status: OrderStatus,
    user_role: UserRole,
    operator_id: int,
    order: dict[str, Any],
) -> None:
    """Validate that a cancel action is legal.

    Only the original applicant or an admin may cancel, and only from
    cancellable states.
    """
    if current_status not in _CANCELLABLE_STATES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                errorCode="INVALID_STATE_TRANSITION",
                message=(
                    f"Cannot cancel work order in status '{current_status.value}'. "
                    f"Cancel is only allowed from: "
                    f"{', '.join(s.value for s in _CANCELLABLE_STATES)}."
                ),
            ).model_dump(),
        )

    is_applicant = operator_id == order.get("applicantId")
    is_admin = user_role == UserRole.ADMIN
    if not is_applicant and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                errorCode="ROLE_NOT_ALLOWED",
                message="Only the applicant or an admin can cancel a work order.",
            ).model_dump(),
        )


# ---------------------------------------------------------------------------
# Response Builders
# ---------------------------------------------------------------------------

def _build_order_response(order: dict[str, Any]) -> WorkOrderApprovalResponse:
    """Convert an internal work-order dict to the API response model."""
    records = _get_approval_records_for_order(order["id"])
    return WorkOrderApprovalResponse(
        id=order["id"],
        orderNo=order["orderNo"],
        applicantId=order["applicantId"],
        applicantName=order["applicantName"],
        status=OrderStatus(order["status"]),
        submittedAt=order["submittedAt"],
        version=order["version"],
        approvalRecords=[
            ApprovalRecordResponse(
                id=r["id"],
                orderId=r["orderId"],
                operatorId=r["operatorId"],
                operatorName=r["operatorName"],
                action=ApprovalAction(r["action"]),
                comment=r.get("comment"),
                createdAt=r["createdAt"],
            )
            for r in records
        ],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{order_id}/approve",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a work order",
    description=(
        "Advance the work order to the next approval level. "
        "The backend state machine validates the transition; "
        "illegal transitions return HTTP 409."
    ),
    responses={
        409: {"model": ErrorResponse, "description": "Invalid state transition or optimistic lock conflict"},
        403: {"model": ErrorResponse, "description": "Role not allowed"},
        404: {"model": ErrorResponse, "description": "Work order not found"},
    },
)
async def approve_work_order(
    order_id: int,
    request: Request,
    body: ApproveRequest = ApproveRequest(),
) -> ApprovalActionResponse:
    """Approve a work order and advance it through the approval chain.

    The state machine enforces the following forward transitions:
      PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED

    Optimistic locking via the ``version`` field prevents concurrent approval
    conflicts (HTTP 409 on mismatch).

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used to extract auth context).
        body: The approve request body (currently empty, extensible).

    Returns:
        ApprovalActionResponse with the new status and approval record ID.

    Raises:
        HTTPException 404: Work order not found.
        HTTPException 403: Current user's role is not allowed.
        HTTPException 409: Invalid state transition or version conflict.
    """
    user_id = _current_user_id(request)
    user_role = _current_user_role(request)
    user_name = _current_user_name(request)

    order = _get_work_order(order_id)
    current_status = OrderStatus(order["status"])

    # State machine validation
    target_status = _validate_approve_transition(current_status, user_role)

    # Optimistic lock update
    _update_work_order_status(order, target_status, order["version"])

    # Persist approval record
    record_id = _save_approval_record(
        order_id=order_id,
        operator_id=user_id,
        operator_name=user_name,
        action=ApprovalAction.APPROVE,
        comment=None,
    )

    logger.info(
        "Work order %d approved by user %d (%s): %s → %s",
        order_id,
        user_id,
        user_role.value,
        current_status.value,
        target_status.value,
    )

    return ApprovalActionResponse(
        orderId=order_id,
        previousStatus=current_status,
        currentStatus=target_status,
        action=ApprovalAction.APPROVE,
        operatorId=user_id,
        operatedAt=datetime.now(timezone.utc).isoformat(),
        approvalRecordId=record_id,
    )


@router.post(
    "/{order_id}/reject",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a work order",
    description=(
        "Reject a work order at the current approval level. "
        "A non-blank rejectionReason (1-500 chars) is mandatory; "
        "missing or blank reason returns HTTP 400."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Missing or invalid rejectionReason"},
        409: {"model": ErrorResponse, "description": "Invalid state transition or optimistic lock conflict"},
        403: {"model": ErrorResponse, "description": "Role not allowed"},
        404: {"model": ErrorResponse, "description": "Work order not found"},
    },
)
async def reject_work_order(
    order_id: int,
    request: Request,
    body: RejectRequest,
) -> ApprovalActionResponse:
    """Reject a work order with a mandatory reason.

    The ``rejectionReason`` field must be a non-blank string of 1-500 characters.
    If missing or blank, the endpoint returns HTTP 400 Bad Request.

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used to extract auth context).
        body: The reject request body containing the mandatory rejectionReason.

    Returns:
        ApprovalActionResponse with status REJECTED and the approval record ID.

    Raises:
        HTTPException 400: rejectionReason is missing, blank, or exceeds 500 chars.
        HTTPException 404: Work order not found.
        HTTPException 403: Current user's role is not allowed.
        HTTPException 409: Invalid state transition or version conflict.
    """
    user_id = _current_user_id(request)
    user_role = _current_user_role(request)
    user_name = _current_user_name(request)

    order = _get_work_order(order_id)
    current_status = OrderStatus(order["status"])

    # State machine validation
    _validate_reject_transition(current_status, user_role)

    # Optimistic lock update
    _update_work_order_status(order, OrderStatus.REJECTED, order["version"])

    # Persist approval record with rejection reason
    record_id = _save_approval_record(
        order_id=order_id,
        operator_id=user_id,
        operator_name=user_name,
        action=ApprovalAction.REJECT,
        comment=body.rejectionReason,
    )

    logger.info(
        "Work order %d rejected by user %d (%s): %s → REJECTED, reason: %s",
        order_id,
        user_id,
        user_role.value,
        current_status.value,
        body.rejectionReason,
    )

    return ApprovalActionResponse(
        orderId=order_id,
        previousStatus=current_status,
        currentStatus=OrderStatus.REJECTED,
        action=ApprovalAction.REJECT,
        operatorId=user_id,
        operatedAt=datetime.now(timezone.utc).isoformat(),
        approvalRecordId=record_id,
    )


@router.post(
    "/{order_id}/cancel",
    response_model=ApprovalActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a work order",
    description=(
        "Cancel a work order. Only the original applicant or an admin "
        "may cancel, and only from PENDING / APPROVING_LEVEL_1 / APPROVING_LEVEL_2."
    ),
    responses={
        409: {"model": ErrorResponse, "description": "Invalid state transition or optimistic lock conflict"},
        403: {"model": ErrorResponse, "description": "Only applicant or admin can cancel"},
        404: {"model": ErrorResponse, "description": "Work order not found"},
    },
)
async def cancel_work_order(
    order_id: int,
    request: Request,
    body: CancelRequest = CancelRequest(),
) -> ApprovalActionResponse:
    """Cancel a work order.

    Only the original applicant or an admin may cancel.  The work order must
    be in a cancellable state (PENDING, APPROVING_LEVEL_1, APPROVING_LEVEL_2).

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used to extract auth context).
        body: The cancel request body (currently empty, extensible).

    Returns:
        ApprovalActionResponse with status CANCELLED.

    Raises:
        HTTPException 404: Work order not found.
        HTTPException 403: User is not the applicant or admin.
        HTTPException 409: Invalid state transition or version conflict.
    """
    user_id = _current_user_id(request)
    user_role = _current_user_role(request)
    user_name = _current_user_name(request)

    order = _get_work_order(order_id)
    current_status = OrderStatus(order["status"])

    # State machine validation
    _validate_cancel_transition(current_status, user_role, user_id, order)

    # Optimistic lock update
    _update_work_order_status(order, OrderStatus.CANCELLED, order["version"])

    # Persist approval record
    record_id = _save_approval_record(
        order_id=order_id,
        operator_id=user_id,
        operator_name=user_name,
        action=ApprovalAction.CANCEL,
        comment=None,
    )

    logger.info(
        "Work order %d cancelled by user %d (%s): %s → CANCELLED",
        order_id,
        user_id,
        user_role.value,
        current_status.value,
    )

    return ApprovalActionResponse(
        orderId=order_id,
        previousStatus=current_status,
        currentStatus=OrderStatus.CANCELLED,
        action=ApprovalAction.CANCEL,
        operatorId=user_id,
        operatedAt=datetime.now(timezone.utc).isoformat(),
        approvalRecordId=record_id,
    )


@router.get(
    "/pending",
    response_model=ApprovalListResponse,
    status_code=status.HTTP_200_OK,
    summary="List pending approvals for the current user",
    description=(
        "Return a paginated list of work orders awaiting the current user's "
        "approval.  Department managers see APPROVING_LEVEL_1 orders; "
        "asset managers see APPROVING_LEVEL_2 orders; admins see both."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_pending_approvals(
    request: Request,
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        20, ge=1, le=100, alias="pageSize", description="Items per page"
    ),
) -> ApprovalListResponse:
    """List work orders pending approval for the authenticated user.

    Data isolation is enforced by role:
      - DEPARTMENT_MANAGER: only APPROVING_LEVEL_1 orders
      - ASSET_MANAGER: only APPROVING_LEVEL_2 orders
      - ADMIN: both APPROVING_LEVEL_1 and APPROVING_LEVEL_2 orders

    Args:
        request: The incoming HTTP request (used to extract auth context).
        page: 1-based page number.
        page_size: Number of items per page (1-100).

    Returns:
        ApprovalListResponse containing the filtered, paginated work orders.
    """
    user_role = _current_user_role(request)

    visible_statuses = _ROLE_VISIBLE_STATUSES.get(user_role, [])
    visible_status_values = {s.value for s in visible_statuses}

    # Filter work orders by visible statuses
    matching_orders = [
        o for o in _work_orders.values()
        if o["status"] in visible_status_values
    ]

    # Sort by submission time descending (newest first)
    matching_orders.sort(key=lambda o: o["submittedAt"], reverse=True)

    total = len(matching_orders)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = matching_orders[start:end]

    return ApprovalListResponse(
        items=[_build_order_response(o) for o in page_items],
        total=total,
        page=page,
        pageSize=page_size,
    )


@router.get(
    "/{order_id}",
    response_model=WorkOrderApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Get work order approval detail",
    description=(
        "Return the full detail of a work order including its approval "
        "history records."
    ),
    responses={
        404: {"model": ErrorResponse, "description": "Work order not found"},
    },
)
async def get_approval_detail(
    order_id: int,
    request: Request,
) -> WorkOrderApprovalResponse:
    """Retrieve the approval detail for a specific work order.

    Includes the work order's current status, version, and the full
    approval history (approve / reject / cancel records).

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used to extract auth context).

    Returns:
        WorkOrderApprovalResponse with full approval history.

    Raises:
        HTTPException 404: Work order not found.
    """
    # Auth check (ensure user is authenticated)
    _current_user_id(request)

    order = _get_work_order(order_id)
    return _build_order_response(order)


@router.get(
    "/{order_id}/records",
    response_model=list[ApprovalRecordResponse],
    status_code=status.HTTP_200_OK,
    summary="Get approval history for a work order",
    description="Return all approval records (approve, reject, cancel) for a work order.",
    responses={
        404: {"model": ErrorResponse, "description": "Work order not found"},
    },
)
async def get_approval_records(
    order_id: int,
    request: Request,
) -> list[ApprovalRecordResponse]:
    """Retrieve the approval history records for a specific work order.

    Records are returned in reverse chronological order (newest first).

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used to extract auth context).

    Returns:
        List of ApprovalRecordResponse objects.

    Raises:
        HTTPException 404: Work order not found.
    """
    # Auth check
    _current_user_id(request)

    # Verify work order exists
    _get_work_order(order_id)

    records = _get_approval_records_for_order(order_id)
    return [
        ApprovalRecordResponse(
            id=r["id"],
            orderId=r["orderId"],
            operatorId=r["operatorId"],
            operatorName=r["operatorName"],
            action=ApprovalAction(r["action"]),
            comment=r.get("comment"),
            createdAt=r["createdAt"],
        )
        for r in records
    ]