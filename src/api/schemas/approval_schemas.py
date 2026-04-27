"""
Approval Schemas — Pydantic models for the multi-level work-order approval workflow.

Defines request / response schemas consumed by the approval endpoints:
  - POST /api/orders/{id}/approve
  - POST /api/orders/{id}/reject
  - GET  /api/orders/{id}/approval-records
  - GET  /api/approvals/pending

State machine flow (enforced server-side):
  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  Any approval node ──reject──→ REJECTED
  PENDING / APPROVING_LEVEL_1 ──cancel──→ CANCELLED
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ApprovalAction(str, enum.Enum):
    """Enumeration of actions an approver can perform on a work order."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


class OrderStatus(str, enum.Enum):
    """Work-order lifecycle states managed by the backend state machine.

    Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Reverse flow:  Any approval node → REJECTED
    Cancel flow:   PENDING / APPROVING_LEVEL_1 → CANCELLED
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalLevel(str, enum.Enum):
    """Approval level identifiers used for role-based data isolation."""

    LEVEL_1_DEPT_MANAGER = "LEVEL_1_DEPT_MANAGER"
    LEVEL_2_ASSET_MANAGER = "LEVEL_2_ASSET_MANAGER"


class ApprovalErrorCode(str, enum.Enum):
    """Business-level error codes returned in approval-related error responses."""

    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    OPTIMISTIC_LOCK_CONFLICT = "OPTIMISTIC_LOCK_CONFLICT"
    MISSING_REJECTION_REASON = "MISSING_REJECTION_REASON"
    REJECTION_REASON_TOO_LONG = "REJECTION_REASON_TOO_LONG"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    ORDER_NOT_FOUND = "ORDER_NOT_FOUND"
    APPROVAL_RECORD_NOT_FOUND = "APPROVAL_RECORD_NOT_FOUND"


# ---------------------------------------------------------------------------
# Shared / embedded models
# ---------------------------------------------------------------------------

class OperatorInfo(BaseModel):
    """Minimal representation of the user who performed an approval action."""

    user_id: int = Field(..., description="Unique identifier of the operator.")
    username: str = Field(..., description="Display name of the operator.")
    role: str = Field(..., description="Role of the operator at the time of action (e.g. DEPT_MANAGER).")


class ApprovalRecordSummary(BaseModel):
    """A single approval-record entry returned in list / detail responses."""

    id: int = Field(..., description="Primary key of the approval record.")
    order_id: int = Field(..., description="Associated work-order ID.")
    action: ApprovalAction = Field(..., description="Action performed (APPROVE or REJECT).")
    approval_level: ApprovalLevel = Field(..., description="Which approval level this record belongs to.")
    operator: OperatorInfo = Field(..., description="Who performed the action.")
    comment: Optional[str] = Field(None, description="Optional comment / rejection reason.")
    rejection_reason: Optional[str] = Field(None, max_length=500, description="Mandatory when action is REJECT.")
    created_at: datetime = Field(..., description="ISO 8601 timestamp of when the action was recorded.")

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ApprovalActionRequest(BaseModel):
    """Base fields shared by approve and reject request bodies."""

    version: int = Field(
        ...,
        ge=0,
        description="Optimistic-lock version of the work order at the time of request.",
    )
    comment: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional free-text comment attached to the action.",
    )


class ApproveOrderRequest(ApprovalActionRequest):
    """Request body for POST /api/orders/{id}/approve.

    The backend will validate that the caller's role matches the expected
    approval level for the current order status.
    """

    pass


class RejectOrderRequest(ApprovalActionRequest):
    """Request body for POST /api/orders/{id}/reject.

    Constraint: ``rejection_reason`` is **required** and must be a non-empty
    string of at most 500 characters.  Omitting it or providing an empty
    string results in HTTP 400 with error code ``MISSING_REJECTION_REASON``.
    """

    rejection_reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Mandatory reason for rejecting the work order (1–500 characters).",
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_not_be_blank(cls, v: str) -> str:
        """Ensure the rejection reason is not whitespace-only."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank or whitespace-only")
        return stripped


# ---------------------------------------------------------------------------
# Response schemas — single resources
# ---------------------------------------------------------------------------

class ApprovalActionResponse(BaseModel):
    """Response returned after a successful approve or reject operation."""

    order_id: int = Field(..., description="ID of the work order that was acted upon.")
    previous_status: OrderStatus = Field(..., description="Status before the action was applied.")
    current_status: OrderStatus = Field(..., description="Status after the action was applied.")
    approval_record: ApprovalRecordSummary = Field(
        ..., description="The approval record that was persisted for this action."
    )
    next_approval_level: Optional[ApprovalLevel] = Field(
        None,
        description="The next approval level expected, or null if the order is in a terminal state.",
    )


class WorkOrderApprovalStatus(BaseModel):
    """Approval-related status information embedded in a work-order detail response."""

    order_id: int = Field(..., description="Work-order ID.")
    status: OrderStatus = Field(..., description="Current lifecycle status of the order.")
    version: int = Field(..., description="Current optimistic-lock version.")
    current_approval_level: Optional[ApprovalLevel] = Field(
        None, description="The approval level currently awaiting action, if any."
    )
    approval_records: List[ApprovalRecordSummary] = Field(
        default_factory=list, description="Chronological list of all approval records for this order."
    )


# ---------------------------------------------------------------------------
# Response schemas — lists / pagination
# ---------------------------------------------------------------------------

class PendingApprovalItem(BaseModel):
    """A single item in the pending-approval list response."""

    order_id: int = Field(..., description="Work-order ID.")
    order_no: str = Field(..., description="Human-readable work-order number.")
    applicant_name: str = Field(..., description="Name of the user who submitted the order.")
    submitted_at: datetime = Field(..., description="ISO 8601 timestamp when the order was submitted.")
    status: OrderStatus = Field(..., description="Current status of the order.")
    approval_level: ApprovalLevel = Field(..., description="The approval level this item belongs to.")
    version: int = Field(..., description="Current optimistic-lock version for concurrency control.")

    model_config = {"from_attributes": True}


class PendingApprovalListResponse(BaseModel):
    """Paginated response for GET /api/approvals/pending."""

    items: List[PendingApprovalItem] = Field(
        default_factory=list, description="List of pending approval items for the current user's role."
    )
    total: int = Field(..., description="Total number of matching records across all pages.")
    page: int = Field(..., ge=1, description="Current page number (1-based).")
    page_size: int = Field(..., ge=1, le=100, description="Number of items per page.")
    has_next: bool = Field(..., description="Whether a next page exists.")


class ApprovalRecordListResponse(BaseModel):
    """Paginated response for GET /api/orders/{id}/approval-records."""

    items: List[ApprovalRecordSummary] = Field(
        default_factory=list, description="Approval records for the specified work order."
    )
    total: int = Field(..., description="Total number of records for this order.")
    order_id: int = Field(..., description="The work-order ID these records belong to.")


# ---------------------------------------------------------------------------
# Error response schemas
# ---------------------------------------------------------------------------

class ApprovalErrorResponse(BaseModel):
    """Standard error envelope returned when an approval operation fails.

    The ``code`` field maps to :class:`ApprovalErrorCode` values so the
    frontend can programmatically handle different failure scenarios.
    """

    error_code: ApprovalErrorCode = Field(
        ..., description="Machine-readable business error code."
    )
    message: str = Field(..., description="Human-readable error description.")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Additional structured details (e.g. expected vs. actual status)."
    )


class StateTransitionErrorResponse(ApprovalErrorResponse):
    """Specialised error for invalid state transitions (HTTP 409)."""

    error_code: Literal[ApprovalErrorCode.INVALID_STATE_TRANSITION] = (
        ApprovalErrorCode.INVALID_STATE_TRANSITION
    )
    current_status: OrderStatus = Field(
        ..., description="The actual status of the work order at the time of the request."
    )
    requested_action: str = Field(
        ..., description="The action that was attempted (e.g. APPROVE, REJECT)."
    )


class OptimisticLockErrorResponse(ApprovalErrorResponse):
    """Specialised error for optimistic-lock conflicts (HTTP 409)."""

    error_code: Literal[ApprovalErrorCode.OPTIMISTIC_LOCK_CONFLICT] = (
        ApprovalErrorCode.OPTIMISTIC_LOCK_CONFLICT
    )
    expected_version: int = Field(
        ..., description="The version that was expected based on the request."
    )
    actual_version: int = Field(
        ..., description="The current version in the database."
    )