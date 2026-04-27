"""
Approval Schemas — Pydantic models for the multi-level work-order approval flow.

Defines request / response / enumeration types consumed by the approval
REST API endpoints (approve, reject, list, detail) and the underlying
service layer.

State machine flow (Phase 1):
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Any approval node ──reject──→ REJECTED
    PENDING ──cancel──→ CANCELLED
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ApprovalAction(str, Enum):
    """Enumeration of actions an approver can perform on a work order."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


class ApprovalLevel(str, Enum):
    """The two approval levels required before a work order is fully approved."""

    LEVEL_1_DEPT_MANAGER = "LEVEL_1_DEPT_MANAGER"
    LEVEL_2_ASSET_MANAGER = "LEVEL_2_ASSET_MANAGER"


class OrderStatus(str, Enum):
    """
    Work-order lifecycle states enforced by the backend state machine.

    Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Reverse flow:  Any approval node → REJECTED
    Cancellation:  PENDING → CANCELLED
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ApprovalActionRequest(BaseModel):
    """
    Base request body for an approval action (approve or reject).

    Shared fields common to both approve and reject operations.
    """

    operator_id: int = Field(
        ...,
        description="ID of the user performing the approval action.",
        examples=[42],
    )
    comment: Optional[str] = Field(
        default=None,
        description="Optional free-text comment from the approver.",
        max_length=500,
    )


class ApproveRequest(ApprovalActionRequest):
    """
    Request body for approving a work order at the current approval level.

    The backend will validate that the operator holds the correct role for
    the current approval level and that the state machine permits the
    transition.
    """

    action: ApprovalAction = Field(
        default=ApprovalAction.APPROVE,
        description="Must be APPROVE for this endpoint.",
    )


class RejectRequest(ApprovalActionRequest):
    """
    Request body for rejecting a work order.

    **Constraint**: ``rejection_reason`` is **required** and must be a
    non-empty string of at most 500 characters.  A missing or blank reason
    will result in HTTP 400 Bad Request.
    """

    action: ApprovalAction = Field(
        default=ApprovalAction.REJECT,
        description="Must be REJECT for this endpoint.",
    )
    rejection_reason: str = Field(
        ...,
        description="Mandatory reason for the rejection (1–500 characters).",
        min_length=1,
        max_length=500,
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_not_be_blank(cls, v: str) -> str:
        """Ensure the rejection reason is not whitespace-only."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank or whitespace-only")
        return stripped


class CancelRequest(BaseModel):
    """
    Request body for cancelling a work order that is still in PENDING status.

    Only the original applicant or an admin may cancel.
    """

    operator_id: int = Field(
        ...,
        description="ID of the user requesting cancellation.",
        examples=[7],
    )
    reason: Optional[str] = Field(
        default=None,
        description="Optional reason for cancellation.",
        max_length=500,
    )


# ---------------------------------------------------------------------------
# Approval record (persisted audit trail)
# ---------------------------------------------------------------------------

class ApprovalRecordOut(BaseModel):
    """
    A single approval record returned by the API.

    Each record represents one approval action (approve / reject) performed
    on a work order and is persisted in the ``approval_records`` table.
    """

    id: int = Field(..., description="Primary key of the approval record.")
    order_id: int = Field(..., description="ID of the associated work order.")
    operator_id: int = Field(..., description="ID of the user who performed the action.")
    operator_name: Optional[str] = Field(
        default=None,
        description="Display name of the operator.",
    )
    action: ApprovalAction = Field(
        ...,
        description="The action taken (APPROVE or REJECT).",
    )
    approval_level: Optional[ApprovalLevel] = Field(
        default=None,
        description="The approval level at which this action was taken.",
    )
    comment: Optional[str] = Field(
        default=None,
        description="Optional comment provided by the approver.",
    )
    rejection_reason: Optional[str] = Field(
        default=None,
        description="Reason provided when the action is REJECT.",
    )
    created_at: datetime = Field(
        ...,
        description="ISO 8601 timestamp of when the action was performed.",
    )

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Work-order summary (used in approval list views)
# ---------------------------------------------------------------------------

class WorkOrderApprovalSummary(BaseModel):
    """
    Lightweight work-order representation used in the approval list pages.

    Frontend approval list (``/approvals/pending``) renders these objects
    as table rows showing order number, applicant, submission time, etc.
    """

    id: int = Field(..., description="Work order ID.")
    order_no: str = Field(
        ...,
        description="Human-readable order number.",
        examples=["WO-2025-00042"],
    )
    title: Optional[str] = Field(
        default=None,
        description="Short title of the work order.",
    )
    applicant_id: int = Field(..., description="ID of the user who submitted the order.")
    applicant_name: Optional[str] = Field(
        default=None,
        description="Display name of the applicant.",
    )
    status: OrderStatus = Field(
        ...,
        description="Current status of the work order.",
    )
    current_approval_level: Optional[ApprovalLevel] = Field(
        default=None,
        description="The approval level the order is currently waiting at.",
    )
    submitted_at: datetime = Field(
        ...,
        description="ISO 8601 timestamp when the order was submitted.",
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        description="ISO 8601 timestamp of the last status change.",
    )
    version: int = Field(
        ...,
        description="Optimistic-lock version of the work order.",
    )

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Approval detail (full work-order + approval history)
# ---------------------------------------------------------------------------

class ApprovalDetailResponse(BaseModel):
    """
    Detailed approval view returned by the approval detail endpoint.

    Contains the work-order summary together with the full approval history
    (chronological list of approval records).
    """

    order: WorkOrderApprovalSummary = Field(
        ...,
        description="The work order being approved.",
    )
    approval_history: list[ApprovalRecordOut] = Field(
        default_factory=list,
        description="Chronological list of approval actions taken on this order.",
    )
    next_approval_level: Optional[ApprovalLevel] = Field(
        default=None,
        description="The next approval level required, or None if fully approved/rejected.",
    )


# ---------------------------------------------------------------------------
# Approval list response (paginated)
# ---------------------------------------------------------------------------

class ApprovalListResponse(BaseModel):
    """
    Paginated response for the approval list endpoint.

    The list is filtered server-side based on the caller's role:
    - Department managers see only ``APPROVING_LEVEL_1`` orders.
    - Asset managers see only ``APPROVING_LEVEL_2`` orders.
    """

    items: list[WorkOrderApprovalSummary] = Field(
        default_factory=list,
        description="Page of work orders awaiting the caller's approval.",
    )
    total: int = Field(
        ...,
        description="Total number of matching work orders across all pages.",
        examples=[128],
    )
    page: int = Field(
        ...,
        description="Current page number (1-based).",
        ge=1,
    )
    page_size: int = Field(
        ...,
        description="Number of items per page.",
        ge=1,
        le=100,
    )


# ---------------------------------------------------------------------------
# Generic action response
# ---------------------------------------------------------------------------

class ApprovalActionResponse(BaseModel):
    """
    Response returned after a successful approve / reject / cancel action.

    Contains the updated work-order status and the newly created approval
    record (if applicable).
    """

    order_id: int = Field(..., description="ID of the affected work order.")
    status: OrderStatus = Field(
        ...,
        description="New status of the work order after the action.",
    )
    version: int = Field(
        ...,
        description="New optimistic-lock version of the work order.",
    )
    approval_record: Optional[ApprovalRecordOut] = Field(
        default=None,
        description="The approval record created by this action (None for cancel).",
    )


# ---------------------------------------------------------------------------
# Error response helpers
# ---------------------------------------------------------------------------

class ApprovalErrorResponse(BaseModel):
    """
    Standard error envelope returned when an approval action fails.

    Used for both validation errors (400) and state-transition conflicts (409).
    """

    error_code: str = Field(
        ...,
        description="Machine-readable error code.",
        examples=["INVALID_STATE_TRANSITION", "REJECTION_REASON_REQUIRED"],
    )
    message: str = Field(
        ...,
        description="Human-readable error description.",
        examples=["Cannot approve: order is in PENDING state, expected APPROVING_LEVEL_1."],
    )
    details: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional structured error details (e.g. field-level errors).",
    )