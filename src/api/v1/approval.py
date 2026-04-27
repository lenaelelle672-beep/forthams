"""
Approval API v1 — Multi-level work order approval endpoints.

Implements the two-level approval workflow:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
with reject (→ REJECTED) and cancel (→ CANCELLED) transitions.

All state transitions are validated server-side by the work-order state
machine.  Invalid transitions return HTTP 409 Conflict with a structured
error payload.  Reject requests missing ``rejectionReason`` return HTTP 400.

Role-based data isolation is enforced:
    - DEPARTMENT_MANAGER  → sees APPROVING_LEVEL_1 orders
    - ASSET_MANAGER       → sees APPROVING_LEVEL_2 orders
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Schemas (request / response DTOs)
# ---------------------------------------------------------------------------


class ApprovalAction(str, enum.Enum):
    """Enumeration of valid approval actions."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


class OrderStatus(str, enum.Enum):
    """Work-order lifecycle statuses enforced by the state machine."""

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class UserRole(str, enum.Enum):
    """User roles relevant to the approval workflow."""

    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"
    ASSET_MANAGER = "ASSET_MANAGER"
    ADMIN = "ADMIN"


class ApproveRequest(BaseModel):
    """Payload for approving a work order.

    ``version`` is required for optimistic locking — the server will
    reject the request (HTTP 409) if the stored version differs.
    """

    version: int = Field(
        ...,
        description="Current version of the work order (optimistic lock).",
        gt=0,
    )
    comment: Optional[str] = Field(
        default=None,
        description="Optional approval comment.",
        max_length=500,
    )


class RejectRequest(BaseModel):
    """Payload for rejecting a work order.

    ``rejectionReason`` is **mandatory** — the server returns HTTP 400
    if it is missing or blank.
    """

    version: int = Field(
        ...,
        description="Current version of the work order (optimistic lock).",
        gt=0,
    )
    rejection_reason: str = Field(
        ...,
        description="Reason for rejection (required, max 500 chars).",
        min_length=1,
        max_length=500,
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_be_non_blank(cls, v: str) -> str:
        """Ensure the rejection reason is not whitespace-only."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank")
        return stripped


class CancelRequest(BaseModel):
    """Payload for cancelling a work order."""

    version: int = Field(
        ...,
        description="Current version of the work order (optimistic lock).",
        gt=0,
    )
    reason: Optional[str] = Field(
        default=None,
        description="Optional cancellation reason.",
        max_length=500,
    )


class ApprovalRecordResponse(BaseModel):
    """A single approval history record."""

    id: uuid.UUID
    order_id: uuid.UUID
    operator_id: uuid.UUID
    operator_name: str
    action: str
    comment: Optional[str]
    rejection_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkOrderApprovalResponse(BaseModel):
    """Detailed work-order response returned by approval endpoints."""

    id: uuid.UUID
    order_no: str
    status: OrderStatus
    version: int
    applicant_id: uuid.UUID
    applicant_name: str
    submitted_at: datetime
    current_approver_role: Optional[str] = None
    approval_records: List[ApprovalRecordResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PendingApprovalListItem(BaseModel):
    """Compact representation used in the pending-approvals list."""

    id: uuid.UUID
    order_no: str
    status: OrderStatus
    applicant_name: str
    submitted_at: datetime
    version: int

    model_config = {"from_attributes": True}


class PaginatedPendingList(BaseModel):
    """Paginated list of pending approvals."""

    items: List[PendingApprovalListItem]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    """Standard error envelope returned on 4xx / 5xx responses."""

    error_code: str
    message: str
    details: Optional[dict] = None


# ---------------------------------------------------------------------------
# State machine (inline lightweight implementation)
# ---------------------------------------------------------------------------

# Maps (current_status, event) → next_status.
# Any transition not present here is considered invalid.
_VALID_TRANSITIONS: dict[tuple[OrderStatus, str], OrderStatus] = {
    # Forward flow
    (OrderStatus.PENDING, "SUBMIT"): OrderStatus.APPROVING_LEVEL_1,
    (OrderStatus.APPROVING_LEVEL_1, "APPROVE"): OrderStatus.APPROVING_LEVEL_2,
    (OrderStatus.APPROVING_LEVEL_2, "APPROVE"): OrderStatus.APPROVED,
    # Reject from any approval node
    (OrderStatus.APPROVING_LEVEL_1, "REJECT"): OrderStatus.REJECTED,
    (OrderStatus.APPROVING_LEVEL_2, "REJECT"): OrderStatus.REJECTED,
    # Cancel from PENDING or any approval node
    (OrderStatus.PENDING, "CANCEL"): OrderStatus.CANCELLED,
    (OrderStatus.APPROVING_LEVEL_1, "CANCEL"): OrderStatus.CANCELLED,
    (OrderStatus.APPROVING_LEVEL_2, "CANCEL"): OrderStatus.CANCELLED,
}

# Statuses that are considered terminal (no further transitions allowed).
_TERMINAL_STATUSES: set[OrderStatus] = {
    OrderStatus.APPROVED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
}


def validate_transition(current: OrderStatus, event: str) -> OrderStatus:
    """Validate and return the next status for a state transition.

    Args:
        current: The current status of the work order.
        event: The event triggering the transition (e.g. ``"APPROVE"``).

    Returns:
        The target status after the transition.

    Raises:
        ValueError: If the transition is not allowed.
    """
    if current in _TERMINAL_STATUSES:
        raise ValueError(
            f"Cannot perform '{event}' on terminal status '{current.value}'."
        )
    key = (current, event)
    if key not in _VALID_TRANSITIONS:
        raise ValueError(
            f"Invalid state transition: {current.value} + {event} "
            f"is not allowed. Error code: INVALID_STATE_TRANSITION"
        )
    return _VALID_TRANSITIONS[key]


# ---------------------------------------------------------------------------
# Role → visible approval statuses mapping
# ---------------------------------------------------------------------------

_ROLE_VISIBLE_STATUSES: dict[UserRole, list[OrderStatus]] = {
    UserRole.DEPARTMENT_MANAGER: [OrderStatus.APPROVING_LEVEL_1],
    UserRole.ASSET_MANAGER: [OrderStatus.APPROVING_LEVEL_2],
    UserRole.ADMIN: [
        OrderStatus.APPROVING_LEVEL_1,
        OrderStatus.APPROVING_LEVEL_2,
    ],
}

# Role → the event they are allowed to execute.
_ROLE_APPROVAL_EVENT: dict[UserRole, str] = {
    UserRole.DEPARTMENT_MANAGER: "APPROVE",  # level-1 approver
    UserRole.ASSET_MANAGER: "APPROVE",  # level-2 approver
    UserRole.ADMIN: "APPROVE",
}


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/orders", tags=["approvals"])


# ---------------------------------------------------------------------------
# Helpers / lightweight service stubs
# ---------------------------------------------------------------------------
# In a real deployment these would delegate to ``ApprovalService`` and
# repository classes.  Here we provide functional stubs that satisfy the
# ATB contract so the API layer is fully exercisable.


def _get_current_user_role(request: Request) -> UserRole:
    """Extract the current user's role from the request context.

    In production this reads from the JWT token / session.  For now we
    accept an ``X-User-Role`` header (dev convenience).
    """
    role_header = request.headers.get("X-User-Role", "")
    try:
        return UserRole(role_header.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                error_code="FORBIDDEN",
                message=f"Unrecognised or missing role: '{role_header}'.",
            ).model_dump(),
        )


def _get_current_user_id(request: Request) -> uuid.UUID:
    """Extract the current user's ID from the request context."""
    user_id_header = request.headers.get("X-User-Id", "")
    if not user_id_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorResponse(
                error_code="UNAUTHENTICATED",
                message="Missing X-User-Id header.",
            ).model_dump(),
        )
    try:
        return uuid.UUID(user_id_header)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code="INVALID_USER_ID",
                message="X-User-Id must be a valid UUID.",
            ).model_dump(),
        )


# ---------------------------------------------------------------------------
# In-memory stub store (replaced by DB in production)
# ---------------------------------------------------------------------------

# Simple in-memory store keyed by order_id.  Each entry is a dict
# representing the work order row.  This is **only** for API-layer
# demonstration; the real implementation uses SQLAlchemy / MyBatis.

_orders_store: dict[uuid.UUID, dict] = {}
_approval_records_store: list[dict] = []


def _find_order(order_id: uuid.UUID) -> dict:
    """Look up a work order by ID; raise 404 if not found."""
    order = _orders_store.get(order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code="ORDER_NOT_FOUND",
                message=f"Work order '{order_id}' does not exist.",
            ).model_dump(),
        )
    return order


def _check_optimistic_lock(order: dict, requested_version: int) -> None:
    """Compare versions; raise 409 on mismatch (concurrent modification)."""
    if order["version"] != requested_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code="OPTIMISTIC_LOCK_CONFLICT",
                message=(
                    f"Version mismatch: expected {order['version']}, "
                    f"got {requested_version}. The order may have been "
                    f"modified by another user."
                ),
            ).model_dump(),
        )


def _persist_approval_record(
    order_id: uuid.UUID,
    operator_id: uuid.UUID,
    operator_name: str,
    action: str,
    comment: Optional[str],
    rejection_reason: Optional[str],
) -> dict:
    """Create and persist an approval record entry."""
    record = {
        "id": uuid.uuid4(),
        "order_id": order_id,
        "operator_id": operator_id,
        "operator_name": operator_name,
        "action": action,
        "comment": comment,
        "rejection_reason": rejection_reason,
        "created_at": datetime.now(timezone.utc),
    }
    _approval_records_store.append(record)
    return record


def _get_order_approval_records(order_id: uuid.UUID) -> list[dict]:
    """Return all approval records for a given order, newest first."""
    return sorted(
        [r for r in _approval_records_store if r["order_id"] == order_id],
        key=lambda r: r["created_at"],
        reverse=True,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{order_id}/approve",
    response_model=WorkOrderApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a work order",
    description=(
        "Advance the work order to the next approval level. "
        "The caller's role determines which level they can approve: "
        "DEPARTMENT_MANAGER → level-1, ASSET_MANAGER → level-2."
    ),
    responses={
        409: {
            "description": (
                "Invalid state transition or optimistic lock conflict."
            ),
            "model": ErrorResponse,
        },
        404: {"description": "Order not found.", "model": ErrorResponse},
        403: {"description": "Insufficient role.", "model": ErrorResponse},
    },
)
async def approve_order(
    order_id: uuid.UUID,
    body: ApproveRequest,
    request: Request,
) -> WorkOrderApprovalResponse:
    """Approve a work order at the current approval level.

    The endpoint validates:
    1. The order exists.
    2. The caller's role matches the current approval level.
    3. The state machine permits the transition.
    4. The optimistic-lock version matches.

    On success the order status advances and an approval record is created.
    """
    role = _get_current_user_role(request)
    operator_id = _get_current_user_id(request)
    operator_name = request.headers.get("X-User-Name", "Unknown")

    # 1. Fetch order
    order = _find_order(order_id)
    current_status = OrderStatus(order["status"])

    # 2. Role-based access: ensure the caller is the correct approver for
    #    the current level.
    if role == UserRole.DEPARTMENT_MANAGER:
        if current_status != OrderStatus.APPROVING_LEVEL_1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ErrorResponse(
                    error_code="INVALID_STATE_TRANSITION",
                    message=(
                        f"DEPARTMENT_MANAGER can only approve orders in "
                        f"APPROVING_LEVEL_1 status. Current status: "
                        f"{current_status.value}."
                    ),
                ).model_dump(),
            )
    elif role == UserRole.ASSET_MANAGER:
        if current_status != OrderStatus.APPROVING_LEVEL_2:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ErrorResponse(
                    error_code="INVALID_STATE_TRANSITION",
                    message=(
                        f"ASSET_MANAGER can only approve orders in "
                        f"APPROVING_LEVEL_2 status. Current status: "
                        f"{current_status.value}."
                    ),
                ).model_dump(),
            )

    # 3. Optimistic lock check
    _check_optimistic_lock(order, body.version)

    # 4. State machine validation
    try:
        next_status = validate_transition(current_status, "APPROVE")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code="INVALID_STATE_TRANSITION",
                message=str(exc),
            ).model_dump(),
        ) from exc

    # 5. Persist state change
    order["status"] = next_status.value
    order["version"] += 1

    # 6. Persist approval record
    _persist_approval_record(
        order_id=order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        action="APPROVE",
        comment=body.comment,
        rejection_reason=None,
    )

    # 7. Build response
    records = _get_order_approval_records(order_id)
    return WorkOrderApprovalResponse(
        id=order["id"],
        order_no=order["order_no"],
        status=next_status,
        version=order["version"],
        applicant_id=order["applicant_id"],
        applicant_name=order["applicant_name"],
        submitted_at=order["submitted_at"],
        current_approver_role=_infer_next_approver_role(next_status),
        approval_records=[
            ApprovalRecordResponse(**r) for r in records
        ],
    )


@router.post(
    "/{order_id}/reject",
    response_model=WorkOrderApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a work order",
    description=(
        "Reject a work order at the current approval level. "
        "A non-blank ``rejectionReason`` (max 500 chars) is required."
    ),
    responses={
        400: {
            "description": "Missing or invalid rejection reason.",
            "model": ErrorResponse,
        },
        409: {
            "description": (
                "Invalid state transition or optimistic lock conflict."
            ),
            "model": ErrorResponse,
        },
        404: {"description": "Order not found.", "model": ErrorResponse},
    },
)
async def reject_order(
    order_id: uuid.UUID,
    body: RejectRequest,
    request: Request,
) -> WorkOrderApprovalResponse:
    """Reject a work order at the current approval level.

    The ``rejectionReason`` field is mandatory.  If missing or blank the
    server returns HTTP 400 Bad Request.
    """
    role = _get_current_user_role(request)
    operator_id = _get_current_user_id(request)
    operator_name = request.headers.get("X-User-Name", "Unknown")

    # 1. Fetch order
    order = _find_order(order_id)
    current_status = OrderStatus(order["status"])

    # 2. Role-based access check (same logic as approve)
    if role == UserRole.DEPARTMENT_MANAGER:
        if current_status != OrderStatus.APPROVING_LEVEL_1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ErrorResponse(
                    error_code="INVALID_STATE_TRANSITION",
                    message=(
                        f"DEPARTMENT_MANAGER can only reject orders in "
                        f"APPROVING_LEVEL_1 status. Current status: "
                        f"{current_status.value}."
                    ),
                ).model_dump(),
            )
    elif role == UserRole.ASSET_MANAGER:
        if current_status != OrderStatus.APPROVING_LEVEL_2:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ErrorResponse(
                    error_code="INVALID_STATE_TRANSITION",
                    message=(
                        f"ASSET_MANAGER can only reject orders in "
                        f"APPROVING_LEVEL_2 status. Current status: "
                        f"{current_status.value}."
                    ),
                ).model_dump(),
            )

    # 3. Optimistic lock check
    _check_optimistic_lock(order, body.version)

    # 4. State machine validation
    try:
        next_status = validate_transition(current_status, "REJECT")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code="INVALID_STATE_TRANSITION",
                message=str(exc),
            ).model_dump(),
        ) from exc

    # 5. Persist state change
    order["status"] = next_status.value
    order["version"] += 1

    # 6. Persist approval record with rejection reason
    _persist_approval_record(
        order_id=order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        action="REJECT",
        comment=None,
        rejection_reason=body.rejection_reason,
    )

    # 7. Build response
    records = _get_order_approval_records(order_id)
    return WorkOrderApprovalResponse(
        id=order["id"],
        order_no=order["order_no"],
        status=next_status,
        version=order["version"],
        applicant_id=order["applicant_id"],
        applicant_name=order["applicant_name"],
        submitted_at=order["submitted_at"],
        current_approver_role=None,
        approval_records=[
            ApprovalRecordResponse(**r) for r in records
        ],
    )


@router.post(
    "/{order_id}/cancel",
    response_model=WorkOrderApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a work order",
    description="Cancel a work order that is in PENDING or an approval stage.",
    responses={
        409: {
            "description": "Invalid state transition or optimistic lock conflict.",
            "model": ErrorResponse,
        },
        404: {"description": "Order not found.", "model": ErrorResponse},
    },
)
async def cancel_order(
    order_id: uuid.UUID,
    body: CancelRequest,
    request: Request,
) -> WorkOrderApprovalResponse:
    """Cancel a work order.

    Only orders in PENDING, APPROVING_LEVEL_1, or APPROVING_LEVEL_2
    status may be cancelled.
    """
    operator_id = _get_current_user_id(request)
    operator_name = request.headers.get("X-User-Name", "Unknown")

    order = _find_order(order_id)
    current_status = OrderStatus(order["status"])

    _check_optimistic_lock(order, body.version)

    try:
        next_status = validate_transition(current_status, "CANCEL")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorResponse(
                error_code="INVALID_STATE_TRANSITION",
                message=str(exc),
            ).model_dump(),
        ) from exc

    order["status"] = next_status.value
    order["version"] += 1

    _persist_approval_record(
        order_id=order_id,
        operator_id=operator_id,
        operator_name=operator_name,
        action="CANCEL",
        comment=body.reason,
        rejection_reason=None,
    )

    records = _get_order_approval_records(order_id)
    return WorkOrderApprovalResponse(
        id=order["id"],
        order_no=order["order_no"],
        status=next_status,
        version=order["version"],
        applicant_id=order["applicant_id"],
        applicant_name=order["applicant_name"],
        submitted_at=order["submitted_at"],
        current_approver_role=None,
        approval_records=[
            ApprovalRecordResponse(**r) for r in records
        ],
    )


@router.get(
    "/pending",
    response_model=PaginatedPendingList,
    summary="List pending approvals for the current user",
    description=(
        "Return a paginated list of work orders awaiting the caller's "
        "approval.  DEPARTMENT_MANAGER sees APPROVING_LEVEL_1 orders; "
        "ASSET_MANAGER sees APPROVING_LEVEL_2 orders."
    ),
    responses={
        403: {"description": "Insufficient role.", "model": ErrorResponse},
    },
)
async def list_pending_approvals(
    request: Request,
    page: int = Query(1, ge=1, description="Page number (1-indexed)."),
    page_size: int = Query(
        20, ge=1, le=100, description="Items per page."
    ),
) -> PaginatedPendingList:
    """List work orders pending approval for the current user's role.

    Data isolation is enforced: only orders whose status matches the
    caller's approval level are returned.
    """
    role = _get_current_user_role(request)

    visible_statuses = _ROLE_VISIBLE_STATUSES.get(role)
    if visible_statuses is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                error_code="FORBIDDEN",
                message=f"Role '{role.value}' has no approval permissions.",
            ).model_dump(),
        )

    visible_status_values = {s.value for s in visible_statuses}

    # Filter orders by visible statuses
    matching_orders = [
        o for o in _orders_store.values()
        if o["status"] in visible_status_values
    ]

    # Sort by submitted_at descending (newest first)
    matching_orders.sort(key=lambda o: o["submitted_at"], reverse=True)

    total = len(matching_orders)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = matching_orders[start:end]

    return PaginatedPendingList(
        items=[
            PendingApprovalListItem(
                id=o["id"],
                order_no=o["order_no"],
                status=OrderStatus(o["status"]),
                applicant_name=o["applicant_name"],
                submitted_at=o["submitted_at"],
                version=o["version"],
            )
            for o in page_items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{order_id}",
    response_model=WorkOrderApprovalResponse,
    summary="Get work order approval detail",
    description=(
        "Return the full approval detail for a work order, including "
        "all historical approval records."
    ),
    responses={
        404: {"description": "Order not found.", "model": ErrorResponse},
    },
)
async def get_order_approval_detail(
    order_id: uuid.UUID,
    request: Request,
) -> WorkOrderApprovalResponse:
    """Retrieve the approval detail for a specific work order.

    Returns the current status, version, and the full approval history.
    """
    order = _find_order(order_id)
    current_status = OrderStatus(order["status"])
    records = _get_order_approval_records(order_id)

    return WorkOrderApprovalResponse(
        id=order["id"],
        order_no=order["order_no"],
        status=current_status,
        version=order["version"],
        applicant_id=order["applicant_id"],
        applicant_name=order["applicant_name"],
        submitted_at=order["submitted_at"],
        current_approver_role=_infer_next_approver_role(current_status),
        approval_records=[
            ApprovalRecordResponse(**r) for r in records
        ],
    )


@router.get(
    "/{order_id}/records",
    response_model=List[ApprovalRecordResponse],
    summary="Get approval records for a work order",
    description="Return all approval records (history) for a specific work order.",
    responses={
        404: {"description": "Order not found.", "model": ErrorResponse},
    },
)
async def get_approval_records(
    order_id: uuid.UUID,
) -> List[ApprovalRecordResponse]:
    """Return the complete approval history for a work order.

    Records are ordered newest-first.
    """
    # Verify the order exists
    _find_order(order_id)

    records = _get_order_approval_records(order_id)
    return [ApprovalRecordResponse(**r) for r in records]


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _infer_next_approver_role(
    status: OrderStatus,
) -> Optional[str]:
    """Return the role expected to act next, or ``None`` if terminal."""
    mapping = {
        OrderStatus.PENDING: "DEPARTMENT_MANAGER",
        OrderStatus.APPROVING_LEVEL_1: "DEPARTMENT_MANAGER",
        OrderStatus.APPROVING_LEVEL_2: "ASSET_MANAGER",
    }
    return mapping.get(status)