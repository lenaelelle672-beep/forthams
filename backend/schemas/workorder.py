"""
Work Order Schemas — Pydantic request/response models for the work order
approval workflow (Phase 1: Core Approval Flow & Basic Workbench).

This module defines all JSON-serialisable schemas consumed and produced by
the work order REST API, including:
  * Work order CRUD payloads
  * Multi-level approval action payloads (approve / reject)
  * Approval record representation
  * Role-based approval list query parameters

State machine constraints (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2
→ APPROVED, with REJECTED / CANCELLED branches) are enforced server-side;
the schemas here only validate the *shape* of incoming requests.
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WorkOrderStatus(str, Enum):
    """All possible states of a work order in the approval state machine.

    Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Reverse flow:  Any approval level → REJECTED
    Cancellation:  PENDING → CANCELLED
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(str, Enum):
    """Actions that can be recorded in an approval record."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class ApprovalLevel(str, Enum):
    """The approval level associated with an approval record."""

    LEVEL_1_DEPT_MANAGER = "LEVEL_1_DEPT_MANAGER"
    LEVEL_2_ASSET_MANAGER = "LEVEL_2_ASSET_MANAGER"


# ---------------------------------------------------------------------------
# Work Order — Create / Update / Response
# ---------------------------------------------------------------------------

class WorkOrderCreate(BaseModel):
    """Payload for creating a new work order.

    A newly created work order starts in ``PENDING`` status.
    """

    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Brief title of the work order.",
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Detailed description of the work order request.",
    )
    applicant_id: int = Field(
        ...,
        description="ID of the user who submits the work order.",
    )
    priority: Optional[str] = Field(
        default="NORMAL",
        description="Priority level (e.g. LOW, NORMAL, HIGH, URGENT).",
    )
    metadata_: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="metadata",
        description="Arbitrary key-value metadata attached to the order.",
    )

    @field_validator("priority")
    @classmethod
    def _validate_priority(cls, v: Optional[str]) -> Optional[str]:
        """Ensure priority, if provided, is one of the allowed values."""
        if v is not None:
            allowed = {"LOW", "NORMAL", "HIGH", "URGENT"}
            upper = v.upper()
            if upper not in allowed:
                raise ValueError(
                    f"Invalid priority '{v}'. Must be one of {sorted(allowed)}."
                )
            return upper
        return v


class WorkOrderUpdate(BaseModel):
    """Payload for updating an existing work order.

    Only fields explicitly provided will be patched.  ``status`` and
    ``version`` are managed by the state machine / optimistic-lock layer
    and must **not** be set through this schema.
    """

    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
    )
    description: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=2000,
    )
    priority: Optional[str] = Field(
        default=None,
    )

    @field_validator("priority")
    @classmethod
    def _validate_priority(cls, v: Optional[str]) -> Optional[str]:
        """Ensure priority, if provided, is one of the allowed values."""
        if v is not None:
            allowed = {"LOW", "NORMAL", "HIGH", "URGENT"}
            upper = v.upper()
            if upper not in allowed:
                raise ValueError(
                    f"Invalid priority '{v}'. Must be one of {sorted(allowed)}."
                )
            return upper
        return v


class WorkOrderResponse(BaseModel):
    """Serialised work order returned by the API.

    Includes the current ``status`` and ``version`` (for optimistic locking).
    All datetime fields follow ISO 8601.
    """

    id: int
    title: str
    description: str
    applicant_id: int
    status: WorkOrderStatus
    priority: str = "NORMAL"
    version: int = Field(
        description="Optimistic-lock version; must be echoed back on approve/reject.",
    )
    rejection_reason: Optional[str] = Field(
        default=None,
        description="Reason provided when the order was rejected.",
    )
    created_at: datetime
    updated_at: datetime
    metadata_: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="metadata",
    )

    model_config = {"from_attributes": True}


class WorkOrderListResponse(BaseModel):
    """Paginated list of work orders."""

    items: List[WorkOrderResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Approval — Request / Response
# ---------------------------------------------------------------------------

class WorkOrderApproveRequest(BaseModel):
    """Payload for approving a work order at the current approval level.

    The ``version`` field is **required** for optimistic locking.  If the
    server-side version has changed since the client last read the order,
    the API returns HTTP 409 Conflict.
    """

    version: int = Field(
        ...,
        description="Current version of the work order (optimistic lock).",
        ge=0,
    )
    comment: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional approval comment recorded in the approval history.",
    )


class WorkOrderRejectRequest(BaseModel):
    """Payload for rejecting a work order at the current approval level.

    Constraints enforced by this schema:
      * ``rejection_reason`` is **required** and must be a non-empty string
        with a maximum length of 500 characters (SPEC: rejection constraint).
      * ``version`` is required for optimistic locking.

    If ``rejection_reason`` is missing or blank, Pydantic validation will
    fail with a 422 error; the controller layer maps this to HTTP 400.
    """

    version: int = Field(
        ...,
        description="Current version of the work order (optimistic lock).",
        ge=0,
    )
    rejection_reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Mandatory reason for rejection (1–500 characters).",
    )

    @field_validator("rejection_reason")
    @classmethod
    def _reject_reason_not_blank(cls, v: str) -> str:
        """Ensure the rejection reason is not whitespace-only."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank.")
        return stripped


class WorkOrderCancelRequest(BaseModel):
    """Payload for cancelling a work order (only from PENDING status)."""

    version: int = Field(
        ...,
        description="Current version of the work order (optimistic lock).",
        ge=0,
    )
    reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional cancellation reason.",
    )


# ---------------------------------------------------------------------------
# Approval Record — Response
# ---------------------------------------------------------------------------

class ApprovalRecordResponse(BaseModel):
    """A single approval record persisted in the ``approval_records`` table.

    Captures who performed what action, when, and any associated comment
    (e.g. rejection reason).
    """

    id: int
    order_id: int = Field(
        description="The work order this record belongs to.",
    )
    operator_id: int = Field(
        description="ID of the user who performed the action.",
    )
    action: ApprovalAction
    approval_level: Optional[ApprovalLevel] = Field(
        default=None,
        description="The approval level at which this action was taken.",
    )
    comment: Optional[str] = Field(
        default=None,
        description="Comment or rejection reason provided by the operator.",
    )
    created_at: datetime

    model_config = {"from_attributes": True}


class ApprovalRecordListResponse(BaseModel):
    """List of approval records for a single work order."""

    items: List[ApprovalRecordResponse]


# ---------------------------------------------------------------------------
# Approval List — Query Parameters
# ---------------------------------------------------------------------------

class ApprovalListQuery(BaseModel):
    """Query parameters for the role-filtered approval list endpoint.

    Role-based data isolation (SPEC constraint):
      * Department managers (DEPT_MANAGER) see only ``APPROVING_LEVEL_1`` orders.
      * Asset managers (ASSET_MANAGER) see only ``APPROVING_LEVEL_2`` orders.
    """

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    status: Optional[WorkOrderStatus] = Field(
        default=None,
        description="Filter by status. If omitted, the API infers the "
                    "appropriate status from the caller's role.",
    )
    keyword: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Search keyword matched against order title or description.",
    )
    sort_by: str = Field(
        default="created_at",
        description="Field to sort results by.",
    )
    sort_order: str = Field(
        default="desc",
        description="Sort direction: 'asc' or 'desc'.",
    )

    @field_validator("sort_order")
    @classmethod
    def _validate_sort_order(cls, v: str) -> str:
        """Ensure sort_order is either 'asc' or 'desc'."""
        if v.lower() not in {"asc", "desc"}:
            raise ValueError("sort_order must be 'asc' or 'desc'.")
        return v.lower()

    @field_validator("sort_by")
    @classmethod
    def _validate_sort_by(cls, v: str) -> str:
        """Ensure sort_by references a valid, non-sensitive field."""
        allowed = {"created_at", "updated_at", "title", "priority", "status"}
        if v not in allowed:
            raise ValueError(
                f"sort_by must be one of {sorted(allowed)}. Got '{v}'."
            )
        return v


# ---------------------------------------------------------------------------
# Error Response
# ---------------------------------------------------------------------------

class WorkOrderErrorResponse(BaseModel):
    """Standard error envelope returned on approval-related failures."""

    error_code: str = Field(
        description="Machine-readable business error code, e.g. "
                    "'INVALID_STATE_TRANSITION', 'OPTIMISTIC_LOCK_CONFLICT'.",
    )
    message: str = Field(
        description="Human-readable error description.",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional context (e.g. current status, expected transitions).",
    )