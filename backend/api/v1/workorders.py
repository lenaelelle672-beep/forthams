"""
Work Order API v1 — Approval Workflow Endpoints.

Provides RESTful endpoints for the multi-level work order approval chain:
  - ``POST /api/orders/{id}/approve``  — advance to next approval level
  - ``POST /api/orders/{id}/reject``   — reject with mandatory reason
  - ``POST /api/orders/{id}/cancel``   — cancel a pending order
  - ``GET  /api/orders/approval/pending`` — role-filtered pending list

State Machine Flow (enforced server-side):
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Any approval node → REJECTED  (requires rejection_reason)
    PENDING → CANCELLED

Boundary constraints enforced:
  - Illegal state transitions → HTTP 409 + INVALID_STATE_TRANSITION
  - Missing rejection_reason  → HTTP 400
  - Optimistic lock mismatch  → HTTP 409 + OPTIMISTIC_LOCK_CONFLICT
  - Role-based data isolation on pending-approval list
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from backend.state_machine.workorder_state import WorkOrderState
from backend.state_machine.workorder_state_machine import (
    StateTransitionException,
    WorkOrderStateMachine,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["workorders"])


# ---------------------------------------------------------------------------
# Business Error Codes
# ---------------------------------------------------------------------------

class ErrorCode:
    """Centralised business error codes for approval endpoints."""

    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    OPTIMISTIC_LOCK_CONFLICT = "OPTIMISTIC_LOCK_CONFLICT"
    WORK_ORDER_NOT_FOUND = "WORK_ORDER_NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    MISSING_REJECTION_REASON = "MISSING_REJECTION_REASON"


def _error_body(code: str, detail: str) -> Dict[str, str]:
    """Build a structured JSON error response body."""
    return {"error_code": code, "detail": detail}


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class ApproveRequest(BaseModel):
    """Request body for approving a work order.

    ``version`` is the optimistic-lock token read when the order was fetched.
    """

    version: int = Field(
        ...,
        description="Optimistic-lock version of the work order at read time.",
        gt=0,
    )
    comment: Optional[str] = Field(
        default=None,
        description="Optional approval comment (max 500 chars).",
        max_length=500,
    )


class RejectRequest(BaseModel):
    """Request body for rejecting a work order.

    ``rejection_reason`` is **mandatory** — the API returns HTTP 400 when
    absent, blank, or whitespace-only.
    """

    version: int = Field(
        ...,
        description="Optimistic-lock version of the work order at read time.",
        gt=0,
    )
    rejection_reason: str = Field(
        ...,
        description="Mandatory reason for rejection (1–500 chars).",
        min_length=1,
        max_length=500,
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_be_non_blank(cls, v: str) -> str:
        """Reject whitespace-only reasons."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank")
        return stripped


class CancelRequest(BaseModel):
    """Request body for cancelling a work order."""

    version: int = Field(
        ...,
        description="Optimistic-lock version of the work order at read time.",
        gt=0,
    )
    comment: Optional[str] = Field(
        default=None,
        description="Optional cancellation comment.",
        max_length=500,
    )


class WorkOrderActionResponse(BaseModel):
    """Response returned after a successful approve / reject / cancel."""

    order_id: int
    status: str
    version: int
    approval_record_id: Optional[int] = None
    message: str


class PendingApprovalItem(BaseModel):
    """Single item in the pending-approval list."""

    order_id: int
    order_no: str
    applicant: str
    submitted_at: str  # ISO 8601
    status: str
    title: Optional[str] = None


class PendingApprovalListResponse(BaseModel):
    """Paginated response for the pending-approval list endpoint."""

    items: List[PendingApprovalItem]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Auth / Role Dependencies
# ---------------------------------------------------------------------------

def _get_current_user_role(request: Request) -> str:
    """Extract the authenticated user's role from the request.

    In production this reads the JWT / session.  For development the role
    may be supplied via the ``X-User-Role`` header.

    Accepted roles: ``DEPARTMENT_MANAGER``, ``ASSET_MANAGER``, ``ADMIN``.
    """
    role = request.headers.get("X-User-Role", "")
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return role.upper()


def _get_current_user_id(request: Request) -> int:
    """Extract the authenticated user's numeric ID from the request."""
    raw = request.headers.get("X-User-Id")
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    try:
        return int(raw)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        )


# ---------------------------------------------------------------------------
# Internal: role → expected approval state mapping
# ---------------------------------------------------------------------------

def _expected_source_state_for_role(
    role: str,
) -> Optional[WorkOrderState]:
    """Return the source state that *role* is authorised to approve from.

    - ``DEPARTMENT_MANAGER`` → ``APPROVING_LEVEL_1``
    - ``ASSET_MANAGER``      → ``APPROVING_LEVEL_2``
    - ``ADMIN``              → ``None`` (may approve at any level)

    Raises HTTP 403 if the role has no approval authority.
    """
    mapping = {
        "DEPARTMENT_MANAGER": WorkOrderState.APPROVING_LEVEL_1,
        "ASSET_MANAGER": WorkOrderState.APPROVING_LEVEL_2,
    }
    if role == "ADMIN":
        return None
    if role in mapping:
        return mapping[role]
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_error_body(
            ErrorCode.PERMISSION_DENIED,
            f"Role '{role}' is not authorised to approve work orders.",
        ),
    )


def _visible_statuses_for_role(role: str) -> List[WorkOrderState]:
    """Return the list of order statuses visible to *role* in the pending list.

    Enforces data isolation:
    - ``DEPARTMENT_MANAGER`` → only ``APPROVING_LEVEL_1``
    - ``ASSET_MANAGER``      → only ``APPROVING_LEVEL_2``
    - ``ADMIN``              → both levels
    """
    if role == "DEPARTMENT_MANAGER":
        return [WorkOrderState.APPROVING_LEVEL_1]
    if role == "ASSET_MANAGER":
        return [WorkOrderState.APPROVING_LEVEL_2]
    if role == "ADMIN":
        return [
            WorkOrderState.APPROVING_LEVEL_1,
            WorkOrderState.APPROVING_LEVEL_2,
        ]
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_error_body(
            ErrorCode.PERMISSION_DENIED,
            f"Role '{role}' has no approval permissions.",
        ),
    )


# ---------------------------------------------------------------------------
# Internal: state machine transition helper
# ---------------------------------------------------------------------------

def _execute_transition(
    current_status: str,
    event: str,
    role: str,
) -> WorkOrderState:
    """Validate and execute a state-machine transition.

    Returns the new state on success.

    Raises:
        HTTPException 409: if the transition is illegal.
    """
    try:
        sm = WorkOrderStateMachine(initial_state=WorkOrderState(current_status))
        ok = sm.trigger(event)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_error_body(
                    ErrorCode.INVALID_STATE_TRANSITION,
                    (
                        f"Cannot '{event}' work order in state "
                        f"'{current_status}'. Role={role}."
                    ),
                ),
            )
        return sm.get_current_state()
    except StateTransitionException as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_error_body(
                ErrorCode.INVALID_STATE_TRANSITION,
                str(exc),
            ),
        ) from exc


# ---------------------------------------------------------------------------
# Internal: optimistic-lock guard
# ---------------------------------------------------------------------------

def _check_version(order: Dict[str, Any], request_version: int) -> None:
    """Raise HTTP 409 if the request version does not match the stored version."""
    if order["version"] != request_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_error_body(
                ErrorCode.OPTIMISTIC_LOCK_CONFLICT,
                (
                    f"Version mismatch: expected {order['version']}, "
                    f"got {request_version}. The work order may have been "
                    f"modified by another user."
                ),
            ),
        )


# ---------------------------------------------------------------------------
# Stub data store (replace with real repository in production)
# ---------------------------------------------------------------------------

_stub_orders: Dict[int, Dict[str, Any]] = {}
_stub_approval_records: List[Dict[str, Any]] = []
_stub_next_record_id: int = 1


def _stub_get_order(order_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a work order from the in-memory stub store."""
    return _stub_orders.get(order_id)


def _stub_update_order(order_id: int, **updates: Any) -> None:
    """Update fields on a stub work order."""
    if order_id in _stub_orders:
        _stub_orders[order_id].update(updates)


def _stub_create_approval_record(
    order_id: int,
    operator_id: int,
    action: str,
    comment: Optional[str],
) -> int:
    """Persist an approval record and return its auto-incremented ID."""
    global _stub_next_record_id
    record_id = _stub_next_record_id
    _stub_next_record_id += 1
    _stub_approval_records.append(
        {
            "id": record_id,
            "order_id": order_id,
            "operator_id": operator_id,
            "action": action,
            "comment": comment,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return record_id


def _stub_list_pending(
    statuses: List[str],
    page: int,
    page_size: int,
) -> Tuple[List[PendingApprovalItem], int]:
    """Return a paginated list of orders matching *statuses*."""
    matching = [
        o for o in _stub_orders.values() if o["status"] in statuses
    ]
    total = len(matching)
    start = (page - 1) * page_size
    page_slice = matching[start : start + page_size]
    items = [
        PendingApprovalItem(
            order_id=o["id"],
            order_no=o.get("order_no", f"WO-{o['id']:06d}"),
            applicant=o.get("applicant", "unknown"),
            submitted_at=o.get(
                "submitted_at",
                datetime.now(timezone.utc).isoformat(),
            ),
            status=o["status"],
            title=o.get("title"),
        )
        for o in page_slice
    ]
    return items, total


# ---------------------------------------------------------------------------
# POST /api/orders/{order_id}/approve
# ---------------------------------------------------------------------------

@router.post(
    "/{order_id}/approve",
    response_model=WorkOrderActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a work order (advance to next approval level).",
    responses={
        409: {
            "description": "Invalid state transition or optimistic-lock conflict.",
        },
    },
)
async def approve_work_order(
    order_id: int,
    body: ApproveRequest,
    request: Request,
    role: str = Depends(_get_current_user_role),
    user_id: int = Depends(_get_current_user_id),
) -> WorkOrderActionResponse:
    """Advance a work order through the multi-level approval chain.

    Validation sequence:
    1. Work order exists (404 if not).
    2. Optimistic-lock version matches (409 if stale).
    3. Caller's role matches the expected approval level (409 if mismatch).
    4. State machine permits ``APPROVE`` from the current state (409 if not).
    5. Persist new status + approval record (atomic).
    """
    logger.info(
        "Approve request: order_id=%s, role=%s, user_id=%s, version=%s",
        order_id,
        role,
        user_id,
        body.version,
    )

    # 1. Fetch order
    order = _stub_get_order(order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_error_body(
                ErrorCode.WORK_ORDER_NOT_FOUND,
                f"Work order {order_id} not found.",
            ),
        )

    # 2. Optimistic lock
    _check_version(order, body.version)

    # 3. Role-based cross-level guard
    expected = _expected_source_state_for_role(role)
    current_status: str = order["status"]
    if expected is not None and current_status != expected.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_error_body(
                ErrorCode.INVALID_STATE_TRANSITION,
                (
                    f"Role '{role}' can only approve orders in state "
                    f"'{expected.value}', but order is in '{current_status}'."
                ),
            ),
        )

    # 4. State machine transition
    new_state = _execute_transition(current_status, "APPROVE", role)

    # 5. Persist
    new_version = order["version"] + 1
    _stub_update_order(order_id, status=new_state.value, version=new_version)
    record_id = _stub_create_approval_record(
        order_id=order_id,
        operator_id=user_id,
        action="APPROVE",
        comment=body.comment,
    )

    logger.info(
        "Order %s approved: %s → %s by user %s (record %s)",
        order_id,
        current_status,
        new_state.value,
        user_id,
        record_id,
    )

    return WorkOrderActionResponse(
        order_id=order_id,
        status=new_state.value,
        version=new_version,
        approval_record_id=record_id,
        message="Work order approved successfully.",
    )


# ---------------------------------------------------------------------------
# POST /api/orders/{order_id}/reject
# ---------------------------------------------------------------------------

@router.post(
    "/{order_id}/reject",
    response_model=WorkOrderActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a work order (mandatory rejection reason).",
    responses={
        400: {"description": "Missing or blank rejection_reason."},
        409: {
            "description": "Invalid state transition or optimistic-lock conflict.",
        },
    },
)
async def reject_work_order(
    order_id: int,
    body: RejectRequest,
    request: Request,
    role: str = Depends(_get_current_user_role),
    user_id: int = Depends(_get_current_user_id),
) -> WorkOrderActionResponse:
    """Reject a work order at the current approval level.

    ``rejection_reason`` is mandatory (1–500 non-blank characters).
    Pydantic validation returns HTTP 422 for schema violations; this
    endpoint additionally guarantees HTTP 400 with ``MISSING_REJECTION_REASON``
    if the reason is somehow absent after validation.
    """
    logger.info(
        "Reject request: order_id=%s, role=%s, user_id=%s, version=%s",
        order_id,
        role,
        user_id,
        body.version,
    )

    # Defensive: ensure rejection_reason survived validation
    if not body.rejection_reason or not body.rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_error_body(
                ErrorCode.MISSING_REJECTION_REASON,
                "rejection_reason is required and must not be blank.",
            ),
        )

    # 1. Fetch order
    order = _stub_get_order(order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_error_body(
                ErrorCode.WORK_ORDER_NOT_FOUND,
                f"Work order {order_id} not found.",
            ),
        )

    # 2. Optimistic lock
    _check_version(order, body.version)

    # 3. State machine transition
    current_status = order["status"]
    new_state = _execute_transition(current_status, "REJECT", role)

    # 4. Persist
    new_version = order["version"] + 1
    _stub_update_order(order_id, status=new_state.value, version=new_version)
    record_id = _stub_create_approval_record(
        order_id=order_id,
        operator_id=user_id,
        action="REJECT",
        comment=body.rejection_reason,
    )

    logger.info(
        "Order %s rejected: %s → %s by user %s, reason=%s (record %s)",
        order_id,
        current_status,
        new_state.value,
        user_id,
        body.rejection_reason,
        record_id,
    )

    return WorkOrderActionResponse(
        order_id=order_id,
        status=new_state.value,
        version=new_version,
        approval_record_id=record_id,
        message="Work order rejected.",
    )


# ---------------------------------------------------------------------------
# POST /api/orders/{order_id}/cancel
# ---------------------------------------------------------------------------

@router.post(
    "/{order_id}/cancel",
    response_model=WorkOrderActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a work order (only from PENDING state).",
    responses={
        409: {"description": "Invalid state transition or version conflict."},
    },
)
async def cancel_work_order(
    order_id: int,
    body: CancelRequest,
    request: Request,
    role: str = Depends(_get_current_user_role),
    user_id: int = Depends(_get_current_user_id),
) -> WorkOrderActionResponse:
    """Cancel a work order that is still in ``PENDING`` state.

    The state machine will reject the transition with HTTP 409 if the
    order has already entered the approval chain.
    """
    logger.info(
        "Cancel request: order_id=%s, role=%s, user_id=%s, version=%s",
        order_id,
        role,
        user_id,
        body.version,
    )

    order = _stub_get_order(order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_error_body(
                ErrorCode.WORK_ORDER_NOT_FOUND,
                f"Work order {order_id} not found.",
            ),
        )

    _check_version(order, body.version)

    current_status = order["status"]
    new_state = _execute_transition(current_status, "CANCEL", role)

    new_version = order["version"] + 1
    _stub_update_order(order_id, status=new_state.value, version=new_version)
    record_id = _stub_create_approval_record(
        order_id=order_id,
        operator_id=user_id,
        action="CANCEL",
        comment=body.comment,
    )

    logger.info(
        "Order %s cancelled: %s → %s by user %s (record %s)",
        order_id,
        current_status,
        new_state.value,
        user_id,
        record_id,
    )

    return WorkOrderActionResponse(
        order_id=order_id,
        status=new_state.value,
        version=new_version,
        approval_record_id=record_id,
        message="Work order cancelled.",
    )


# ---------------------------------------------------------------------------
# GET /api/orders/approval/pending
# ---------------------------------------------------------------------------

@router.get(
    "/approval/pending",
    response_model=PendingApprovalListResponse,
    summary="List pending approvals filtered by the caller's role.",
    description=(
        "Department managers see only APPROVING_LEVEL_1 orders; "
        "asset managers see only APPROVING_LEVEL_2 orders; "
        "admins see both."
    ),
)
async def list_pending_approvals(
    request: Request,
    page: int = Query(default=1, ge=1, description="1-based page number."),
    page_size: int = Query(
        default=20, ge=1, le=100, description="Items per page."
    ),
    role: str = Depends(_get_current_user_role),
) -> PendingApprovalListResponse:
    """Return a paginated list of work orders awaiting the caller's approval.

    **Data isolation** is enforced: each role only sees orders at the
    approval level they are responsible for.
    """
    logger.info(
        "List pending approvals: role=%s, page=%s, page_size=%s",
        role,
        page,
        page_size,
    )

    visible = _visible_statuses_for_role(role)
    status_values = [s.value for s in visible]

    items, total = _stub_list_pending(status_values, page, page_size)

    return PendingApprovalListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )