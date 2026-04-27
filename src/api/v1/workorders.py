"""
Work Order API v1 — Multi-level Approval Endpoints.

Provides RESTful endpoints for work order lifecycle management including
two-level approval flow (department manager → asset manager), rejection
with mandatory reason, and role-based approval list filtering.

State transitions are strictly enforced by the backend state machine:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Any approval node → REJECTED
    PENDING → CANCELLED

All date fields follow ISO 8601 format.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["work-orders"])


# ---------------------------------------------------------------------------
# Enums & Constants
# ---------------------------------------------------------------------------

class WorkOrderStatus(str, Enum):
    """All possible states for a work order."""
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    CLOSED = "CLOSED"


class ApprovalAction(str, Enum):
    """Actions that can be performed on a work order."""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class UserRole(str, Enum):
    """User roles relevant to the approval workflow."""
    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
    ASSET_MANAGER = "ASSET_MANAGER"
    STAFF = "STAFF"
    ADMIN = "ADMIN"


# ---------------------------------------------------------------------------
# State Machine — Valid Transitions
# ---------------------------------------------------------------------------

# Maps (current_status, event) → next_status
VALID_TRANSITIONS: dict[tuple[WorkOrderStatus, ApprovalAction], WorkOrderStatus] = {
    # Forward flow
    (WorkOrderStatus.PENDING, ApprovalAction.APPROVE): WorkOrderStatus.APPROVING_LEVEL_1,
    (WorkOrderStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE): WorkOrderStatus.APPROVING_LEVEL_2,
    (WorkOrderStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE): WorkOrderStatus.APPROVED,
    # Rejection from any approval node
    (WorkOrderStatus.APPROVING_LEVEL_1, ApprovalAction.REJECT): WorkOrderStatus.REJECTED,
    (WorkOrderStatus.APPROVING_LEVEL_2, ApprovalAction.REJECT): WorkOrderStatus.REJECTED,
    # Cancellation
    (WorkOrderStatus.PENDING, ApprovalAction.CANCEL): WorkOrderStatus.CANCELLED,
}


def validate_transition(
    current_status: WorkOrderStatus,
    action: ApprovalAction,
) -> WorkOrderStatus:
    """Validate and return the target status for a state transition.

    Args:
        current_status: The current status of the work order.
        action: The action being attempted.

    Returns:
        The target status after a valid transition.

    Raises:
        HTTPException: 409 Conflict with error code INVALID_STATE_TRANSITION
            when the transition is not allowed.
    """
    key = (current_status, action)
    if key not in VALID_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "INVALID_STATE_TRANSITION",
                "message": (
                    f"Cannot perform '{action.value}' on work order "
                    f"in status '{current_status.value}'. "
                    f"Current status remains unchanged."
                ),
                "current_status": current_status.value,
                "requested_action": action.value,
            },
        )
    return VALID_TRANSITIONS[key]


# ---------------------------------------------------------------------------
# Pydantic Schemas — Request / Response
# ---------------------------------------------------------------------------

class ApproveRequest(BaseModel):
    """Request body for approving a work order.

    Attributes:
        version: Optimistic lock version; must match the current record.
        operator_id: ID of the user performing the approval.
        comment: Optional comment from the approver.
    """

    version: int = Field(
        ...,
        ge=0,
        description="Optimistic lock version of the work order.",
    )
    operator_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="ID of the user performing the approval.",
    )
    comment: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional approval comment.",
    )


class RejectRequest(BaseModel):
    """Request body for rejecting a work order.

    Attributes:
        version: Optimistic lock version; must match the current record.
        operator_id: ID of the user performing the rejection.
        rejection_reason: Mandatory reason for rejection (1-500 chars).
    """

    version: int = Field(
        ...,
        ge=0,
        description="Optimistic lock version of the work order.",
    )
    operator_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="ID of the user performing the rejection.",
    )
    rejection_reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Mandatory reason for rejecting the work order.",
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_be_non_empty(cls, v: str) -> str:
        """Ensure rejection_reason is a non-whitespace string.

        Args:
            v: The rejection reason value.

        Returns:
            The stripped rejection reason.

        Raises:
            ValueError: If the rejection reason is empty or whitespace-only.
        """
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must be a non-empty string.")
        return stripped


class CancelRequest(BaseModel):
    """Request body for cancelling a pending work order.

    Attributes:
        version: Optimistic lock version; must match the current record.
        operator_id: ID of the user cancelling the work order.
        reason: Optional reason for cancellation.
    """

    version: int = Field(
        ...,
        ge=0,
        description="Optimistic lock version of the work order.",
    )
    operator_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="ID of the user cancelling the work order.",
    )
    reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional reason for cancellation.",
    )


class ApprovalRecordResponse(BaseModel):
    """Response schema for a single approval record.

    Attributes:
        id: Unique identifier of the approval record.
        order_id: Associated work order ID.
        operator_id: ID of the user who performed the action.
        action: The action performed (APPROVE / REJECT / CANCEL).
        comment: Optional comment or rejection reason.
        created_at: ISO 8601 timestamp of when the action was performed.
    """

    id: str
    order_id: str
    operator_id: str
    action: str
    comment: Optional[str] = None
    created_at: str


class WorkOrderResponse(BaseModel):
    """Response schema for a work order.

    Attributes:
        id: Unique identifier of the work order.
        title: Work order title.
        description: Work order description.
        status: Current status in the approval workflow.
        applicant_id: ID of the user who created the work order.
        version: Current optimistic lock version.
        created_at: ISO 8601 creation timestamp.
        updated_at: ISO 8601 last update timestamp.
        rejection_reason: Reason if the order was rejected.
        approval_records: List of approval actions taken on this order.
    """

    id: str
    title: str
    description: Optional[str] = None
    status: str
    applicant_id: str
    version: int
    created_at: str
    updated_at: str
    rejection_reason: Optional[str] = None
    approval_records: list[ApprovalRecordResponse] = Field(default_factory=list)


class WorkOrderListResponse(BaseModel):
    """Paginated list response for work orders.

    Attributes:
        items: List of work orders matching the query.
        total: Total number of matching work orders.
        page: Current page number (1-based).
        page_size: Number of items per page.
    """

    items: list[WorkOrderResponse]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    """Standard error response body.

    Attributes:
        error_code: Machine-readable error code.
        message: Human-readable error description.
        details: Optional additional error details.
    """

    error_code: str
    message: str
    details: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# In-Memory Store (Stub — Replace with real DB/ORM in production)
# ---------------------------------------------------------------------------

# NOTE: These are in-memory stubs for Phase 1 demonstration.
# In production, replace with proper database repositories via dependency injection.

_work_orders: dict[str, dict[str, Any]] = {}
_approval_records: dict[str, list[dict[str, Any]]] = {}
_order_id_counter = 0


def _next_order_id() -> str:
    """Generate the next work order ID.

    Returns:
        A string work order ID in the format 'WO-<number>'.
    """
    global _order_id_counter
    _order_id_counter += 1
    return f"WO-{_order_id_counter:06d}"


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string.

    Returns:
        ISO 8601 formatted UTC timestamp.
    """
    return datetime.now(timezone.utc).isoformat()


def _get_order_or_404(order_id: str) -> dict[str, Any]:
    """Retrieve a work order by ID or raise 404.

    Args:
        order_id: The unique identifier of the work order.

    Returns:
        The work order dictionary.

    Raises:
        HTTPException: 404 Not Found if the order does not exist.
    """
    if order_id not in _work_orders:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "WORK_ORDER_NOT_FOUND",
                "message": f"Work order '{order_id}' does not exist.",
            },
        )
    return _work_orders[order_id]


def _check_optimistic_lock(order: dict[str, Any], request_version: int) -> None:
    """Verify optimistic lock version matches.

    Args:
        order: The current work order dictionary.
        request_version: The version provided in the request.

    Raises:
        HTTPException: 409 Conflict if versions do not match.
    """
    if order["version"] != request_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "OPTIMISTIC_LOCK_CONFLICT",
                "message": (
                    f"Work order has been modified by another transaction. "
                    f"Expected version {order['version']}, got {request_version}."
                ),
                "current_version": order["version"],
                "requested_version": request_version,
            },
        )


def _persist_approval_record(
    order_id: str,
    operator_id: str,
    action: str,
    comment: Optional[str],
) -> dict[str, Any]:
    """Create and persist an approval record.

    Args:
        order_id: The associated work order ID.
        operator_id: ID of the user performing the action.
        action: The action performed.
        comment: Optional comment or rejection reason.

    Returns:
        The newly created approval record dictionary.
    """
    record = {
        "id": f"AR-{len(_approval_records.get(order_id, [])) + 1:06d}",
        "order_id": order_id,
        "operator_id": operator_id,
        "action": action,
        "comment": comment,
        "created_at": _now_iso(),
    }
    if order_id not in _approval_records:
        _approval_records[order_id] = []
    _approval_records[order_id].append(record)
    return record


def _build_order_response(order: dict[str, Any]) -> WorkOrderResponse:
    """Build a WorkOrderResponse from an internal order dictionary.

    Args:
        order: The internal work order dictionary.

    Returns:
        A fully populated WorkOrderResponse.
    """
    records = _approval_records.get(order["id"], [])
    return WorkOrderResponse(
        id=order["id"],
        title=order["title"],
        description=order.get("description"),
        status=order["status"],
        applicant_id=order["applicant_id"],
        version=order["version"],
        created_at=order["created_at"],
        updated_at=order["updated_at"],
        rejection_reason=order.get("rejection_reason"),
        approval_records=[
            ApprovalRecordResponse(
                id=r["id"],
                order_id=r["order_id"],
                operator_id=r["operator_id"],
                action=r["action"],
                comment=r.get("comment"),
                created_at=r["created_at"],
            )
            for r in records
        ],
    )


# ---------------------------------------------------------------------------
# Role Resolution Helper
# ---------------------------------------------------------------------------

def _resolve_user_role(request: Request) -> UserRole:
    """Resolve the current user's role from request headers.

    In production, this would extract the role from a JWT token or session.
    For Phase 1, we read from the 'X-User-Role' header.

    Args:
        request: The incoming HTTP request.

    Returns:
        The resolved UserRole enum value.

    Raises:
        HTTPException: 401 Unauthorized if the role header is missing.
    """
    role_header = request.headers.get("X-User-Role", "")
    try:
        return UserRole(role_header.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "INVALID_ROLE",
                "message": (
                    f"Unrecognized or missing user role: '{role_header}'. "
                    f"Valid roles: {[r.value for r in UserRole]}."
                ),
            },
        )


def _resolve_operator_id(request: Request) -> str:
    """Resolve the current operator's ID from request headers.

    In production, this would extract from a JWT token.
    For Phase 1, we read from the 'X-User-Id' header.

    Args:
        request: The incoming HTTP request.

    Returns:
        The operator ID string.

    Raises:
        HTTPException: 401 Unauthorized if the header is missing.
    """
    operator_id = request.headers.get("X-User-Id", "")
    if not operator_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "MISSING_OPERATOR_ID",
                "message": "X-User-Id header is required.",
            },
        )
    return operator_id


# ---------------------------------------------------------------------------
# Role → Visible Approval Status Mapping
# ---------------------------------------------------------------------------

_ROLE_VISIBLE_STATUSES: dict[UserRole, list[WorkOrderStatus]] = {
    UserRole.DEPARTMENT_MANAGER: [WorkOrderStatus.APPROVING_LEVEL_1],
    UserRole.ASSET_MANAGER: [WorkOrderStatus.APPROVING_LEVEL_2],
    UserRole.ADMIN: [
        WorkOrderStatus.PENDING,
        WorkOrderStatus.APPROVING_LEVEL_1,
        WorkOrderStatus.APPROVING_LEVEL_2,
        WorkOrderStatus.APPROVED,
        WorkOrderStatus.REJECTED,
        WorkOrderStatus.CANCELLED,
    ],
    UserRole.STAFF: [
        WorkOrderStatus.PENDING,
        WorkOrderStatus.APPROVED,
        WorkOrderStatus.REJECTED,
        WorkOrderStatus.CANCELLED,
    ],
}


# ---------------------------------------------------------------------------
# Endpoints — CRUD
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=WorkOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new work order",
    responses={
        201: {"description": "Work order created successfully."},
    },
)
def create_work_order(
    request: Request,
    title: str = Query(..., min_length=1, max_length=200),
    description: Optional[str] = Query(default=None, max_length=2000),
    applicant_id: Optional[str] = Query(default=None, max_length=64),
) -> WorkOrderResponse:
    """Create a new work order in DRAFT status.

    The work order is created with status DRAFT and can be submitted
    to enter the approval workflow.

    Args:
        request: The incoming HTTP request (used for operator resolution).
        title: The title of the work order.
        description: Optional detailed description.
        applicant_id: Optional applicant ID; defaults to current user.

    Returns:
        The newly created work order.
    """
    operator = applicant_id or _resolve_operator_id(request)
    now = _now_iso()
    order_id = _next_order_id()

    order: dict[str, Any] = {
        "id": order_id,
        "title": title,
        "description": description,
        "status": WorkOrderStatus.DRAFT.value,
        "applicant_id": operator,
        "version": 0,
        "created_at": now,
        "updated_at": now,
        "rejection_reason": None,
    }
    _work_orders[order_id] = order

    logger.info("Created work order %s by operator %s", order_id, operator)
    return _build_order_response(order)


@router.post(
    "/{order_id}/submit",
    response_model=WorkOrderResponse,
    summary="Submit a draft work order for approval",
    responses={
        200: {"description": "Work order submitted successfully."},
        404: {"model": ErrorResponse, "description": "Work order not found."},
        409: {"model": ErrorResponse, "description": "Invalid state transition or version conflict."},
    },
)
def submit_work_order(
    order_id: str,
    request: Request,
    body: ApproveRequest,
) -> WorkOrderResponse:
    """Submit a DRAFT work order to enter the approval pipeline.

    Transitions the work order from DRAFT → PENDING.

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request.
        body: Request body containing version and operator info.

    Returns:
        The updated work order.

    Raises:
        HTTPException: 404 if order not found, 409 for invalid transition or version conflict.
    """
    order = _get_order_or_404(order_id)
    _check_optimistic_lock(order, body.version)

    current_status = WorkOrderStatus(order["status"])
    if current_status != WorkOrderStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "INVALID_STATE_TRANSITION",
                "message": (
                    f"Cannot submit work order in status '{current_status.value}'. "
                    f"Only DRAFT orders can be submitted."
                ),
                "current_status": current_status.value,
            },
        )

    order["status"] = WorkOrderStatus.PENDING.value
    order["version"] += 1
    order["updated_at"] = _now_iso()

    _persist_approval_record(
        order_id=order_id,
        operator_id=body.operator_id,
        action="SUBMIT",
        comment=body.comment,
    )

    logger.info(
        "Work order %s submitted by %s, now PENDING",
        order_id,
        body.operator_id,
    )
    return _build_order_response(order)


@router.get(
    "",
    response_model=WorkOrderListResponse,
    summary="List work orders with role-based filtering",
    responses={
        200: {"description": "Paginated list of work orders."},
    },
)
def list_work_orders(
    request: Request,
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page."),
    status_filter: Optional[str] = Query(default=None, description="Filter by status."),
) -> WorkOrderListResponse:
    """List work orders visible to the current user based on their role.

    Role-based visibility rules:
        - DEPARTMENT_MANAGER: sees APPROVING_LEVEL_1 orders.
        - ASSET_MANAGER: sees APPROVING_LEVEL_2 orders.
        - ADMIN: sees all orders.
        - STAFF: sees PENDING, APPROVED, REJECTED, CANCELLED orders.

    Args:
        request: The incoming HTTP request (used for role resolution).
        page: The page number to retrieve.
        page_size: Number of items per page.
        status_filter: Optional explicit status filter.

    Returns:
        A paginated list of work orders matching the criteria.
    """
    user_role = _resolve_user_role(request)
    visible_statuses = _ROLE_VISIBLE_STATUSES.get(user_role, [])

    # If an explicit status filter is provided, intersect with visible statuses
    if status_filter:
        try:
            filter_status = WorkOrderStatus(status_filter.upper())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "INVALID_STATUS_FILTER",
                    "message": f"Invalid status filter: '{status_filter}'.",
                    "valid_statuses": [s.value for s in WorkOrderStatus],
                },
            )
        if filter_status not in visible_statuses:
            # User is not authorized to view this status
            return WorkOrderListResponse(items=[], total=0, page=page, page_size=page_size)
        visible_statuses = [filter_status]

    visible_status_values = {s.value for s in visible_statuses}

    # Filter orders
    filtered = [
        _build_order_response(o)
        for o in _work_orders.values()
        if o["status"] in visible_status_values
    ]

    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = filtered[start:end]

    return WorkOrderListResponse(
        items=paginated,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{order_id}",
    response_model=WorkOrderResponse,
    summary="Get work order details",
    responses={
        200: {"description": "Work order details."},
        404: {"model": ErrorResponse, "description": "Work order not found."},
    },
)
def get_work_order(order_id: str) -> WorkOrderResponse:
    """Retrieve the full details of a work order including approval history.

    Args:
        order_id: The unique identifier of the work order.

    Returns:
        The complete work order with all approval records.

    Raises:
        HTTPException: 404 if the order does not exist.
    """
    order = _get_order_or_404(order_id)
    return _build_order_response(order)


# ---------------------------------------------------------------------------
# Endpoints — Approval Actions
# ---------------------------------------------------------------------------

@router.post(
    "/{order_id}/approve",
    response_model=WorkOrderResponse,
    summary="Approve a work order (advance to next approval level)",
    responses={
        200: {"description": "Work order approved and advanced."},
        404: {"model": ErrorResponse, "description": "Work order not found."},
        409: {"model": ErrorResponse, "description": "Invalid state transition or version conflict."},
    },
)
def approve_work_order(
    order_id: str,
    request: Request,
    body: ApproveRequest,
) -> WorkOrderResponse:
    """Approve a work order, advancing it to the next approval level.

    This endpoint enforces the state machine transitions:
        - PENDING → APPROVING_LEVEL_1 (department manager approval)
        - APPROVING_LEVEL_1 → APPROVING_LEVEL_2 (asset manager approval)
        - APPROVING_LEVEL_2 → APPROVED (final approval)

    Role validation ensures only the correct role can approve at each level:
        - DEPARTMENT_MANAGER can approve PENDING → APPROVING_LEVEL_1
        - ASSET_MANAGER can approve APPROVING_LEVEL_1 → APPROVING_LEVEL_2
        - ASSET_MANAGER can approve APPROVING_LEVEL_2 → APPROVED

    Uses optimistic locking (version field) to prevent concurrent approval conflicts.

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used for role resolution).
        body: Request body with version, operator_id, and optional comment.

    Returns:
        The updated work order with new status and approval record.

    Raises:
        HTTPException: 404 if order not found, 409 for invalid transition or version conflict.
    """
    order = _get_order_or_404(order_id)
    _check_optimistic_lock(order, body.version)

    current_status = WorkOrderStatus(order["status"])
    user_role = _resolve_user_role(request)

    # Role-based approval authorization
    _validate_approval_role(current_status, user_role)

    # State machine validation
    target_status = validate_transition(current_status, ApprovalAction.APPROVE)

    # Apply transition
    order["status"] = target_status.value
    order["version"] += 1
    order["updated_at"] = _now_iso()

    # Persist approval record
    _persist_approval_record(
        order_id=order_id,
        operator_id=body.operator_id,
        action="APPROVE",
        comment=body.comment,
    )

    logger.info(
        "Work order %s approved by %s: %s → %s",
        order_id,
        body.operator_id,
        current_status.value,
        target_status.value,
    )
    return _build_order_response(order)


@router.post(
    "/{order_id}/reject",
    response_model=WorkOrderResponse,
    summary="Reject a work order",
    responses={
        200: {"description": "Work order rejected."},
        400: {"model": ErrorResponse, "description": "Missing or invalid rejection reason."},
        404: {"model": ErrorResponse, "description": "Work order not found."},
        409: {"model": ErrorResponse, "description": "Invalid state transition or version conflict."},
    },
)
def reject_work_order(
    order_id: str,
    request: Request,
    body: RejectRequest,
) -> WorkOrderResponse:
    """Reject a work order with a mandatory rejection reason.

    Rejection is allowed from APPROVING_LEVEL_1 or APPROVING_LEVEL_2 states.
    The rejection_reason field is required (1-500 characters, non-empty).

    Uses optimistic locking (version field) to prevent concurrent conflicts.

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request (used for role resolution).
        body: Request body with version, operator_id, and mandatory rejection_reason.

    Returns:
        The updated work order with REJECTED status.

    Raises:
        HTTPException: 400 if rejection_reason is missing/empty, 404 if order not found,
            409 for invalid transition or version conflict.
    """
    order = _get_order_or_404(order_id)
    _check_optimistic_lock(order, body.version)

    current_status = WorkOrderStatus(order["status"])
    user_role = _resolve_user_role(request)

    # Role-based rejection authorization
    _validate_approval_role(current_status, user_role)

    # State machine validation
    target_status = validate_transition(current_status, ApprovalAction.REJECT)

    # Apply transition
    order["status"] = target_status.value
    order["version"] += 1
    order["updated_at"] = _now_iso()
    order["rejection_reason"] = body.rejection_reason

    # Persist rejection record
    _persist_approval_record(
        order_id=order_id,
        operator_id=body.operator_id,
        action="REJECT",
        comment=body.rejection_reason,
    )

    logger.info(
        "Work order %s rejected by %s from status %s. Reason: %s",
        order_id,
        body.operator_id,
        current_status.value,
        body.rejection_reason,
    )
    return _build_order_response(order)


@router.post(
    "/{order_id}/cancel",
    response_model=WorkOrderResponse,
    summary="Cancel a pending work order",
    responses={
        200: {"description": "Work order cancelled."},
        404: {"model": ErrorResponse, "description": "Work order not found."},
        409: {"model": ErrorResponse, "description": "Invalid state transition or version conflict."},
    },
)
def cancel_work_order(
    order_id: str,
    request: Request,
    body: CancelRequest,
) -> WorkOrderResponse:
    """Cancel a work order that is in PENDING status.

    Only PENDING work orders can be cancelled. Once the approval
    process has started, cancellation is not allowed.

    Args:
        order_id: The unique identifier of the work order.
        request: The incoming HTTP request.
        body: Request body with version, operator_id, and optional reason.

    Returns:
        The updated work order with CANCELLED status.

    Raises:
        HTTPException: 404 if order not found, 409 for invalid transition or version conflict.
    """
    order = _get_order_or_404(order_id)
    _check_optimistic_lock(order, body.version)

    current_status = WorkOrderStatus(order["status"])

    # State machine validation
    target_status = validate_transition(current_status, ApprovalAction.CANCEL)

    # Apply transition
    order["status"] = target_status.value
    order["version"] += 1
    order["updated_at"] = _now_iso()

    # Persist cancellation record
    _persist_approval_record(
        order_id=order_id,
        operator_id=body.operator_id,
        action="CANCEL",
        comment=body.reason,
    )

    logger.info(
        "Work order %s cancelled by %s",
        order_id,
        body.operator_id,
    )
    return _build_order_response(order)


# ---------------------------------------------------------------------------
# Endpoints — Approval Records
# ---------------------------------------------------------------------------

@router.get(
    "/{order_id}/approvals",
    response_model=list[ApprovalRecordResponse],
    summary="Get approval history for a work order",
    responses={
        200: {"description": "List of approval records."},
        404: {"model": ErrorResponse, "description": "Work order not found."},
    },
)
def get_approval_history(order_id: str) -> list[ApprovalRecordResponse]:
    """Retrieve the complete approval history for a work order.

    Returns all approval records (approve, reject, cancel actions)
    associated with the specified work order, ordered chronologically.

    Args:
        order_id: The unique identifier of the work order.

    Returns:
        A chronological list of approval records.

    Raises:
        HTTPException: 404 if the work order does not exist.
    """
    _get_order_or_404(order_id)  # Ensure order exists

    records = _approval_records.get(order_id, [])
    return [
        ApprovalRecordResponse(
            id=r["id"],
            order_id=r["order_id"],
            operator_id=r["operator_id"],
            action=r["action"],
            comment=r.get("comment"),
            created_at=r["created_at"],
        )
        for r in records
    ]


# ---------------------------------------------------------------------------
# Internal Helpers — Role Validation
# ---------------------------------------------------------------------------

# Maps current approval status to the role authorized to act on it
_STATUS_REQUIRED_ROLE: dict[WorkOrderStatus, list[UserRole]] = {
    WorkOrderStatus.PENDING: [UserRole.DEPARTMENT_MANAGER, UserRole.ADMIN],
    WorkOrderStatus.APPROVING_LEVEL_1: [UserRole.DEPARTMENT_MANAGER, UserRole.ADMIN],
    WorkOrderStatus.APPROVING_LEVEL_2: [UserRole.ASSET_MANAGER, UserRole.ADMIN],
}


def _validate_approval_role(
    current_status: WorkOrderStatus,
    user_role: UserRole,
) -> None:
    """Validate that the current user's role is authorized for the approval action.

    Args:
        current_status: The current status of the work order.
        user_role: The role of the user attempting the action.

    Raises:
        HTTPException: 403 Forbidden if the user's role is not authorized.
    """
    allowed_roles = _STATUS_REQUIRED_ROLE.get(current_status, [])
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "ROLE_NOT_AUTHORIZED",
                "message": (
                    f"Role '{user_role.value}' is not authorized to perform "
                    f"approval actions on work orders in status "
                    f"'{current_status.value}'. Required roles: "
                    f"{[r.value for r in allowed_roles]}."
                ),
                "current_status": current_status.value,
                "user_role": user_role.value,
                "required_roles": [r.value for r in allowed_roles],
            },
        )