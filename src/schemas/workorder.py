"""
Work order schemas for the multi-level approval workflow.

Defines Pydantic models for request/response validation of work order
and approval-related API endpoints.  Covers:

- Work order status enum aligned with the backend state machine
- Request bodies for create, update, approve, reject, and cancel
- Response bodies for work orders, approval records, and error payloads
- Validation rules (e.g. mandatory rejection reason, optimistic-lock version)
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WorkOrderStatus(str, Enum):
    """All possible states in the work order lifecycle state machine.

    Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Reverse flow:  Any approval level → REJECTED
    Terminal:      CANCELLED, CLOSED
    """

    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    CLOSED = "CLOSED"


class ApprovalAction(str, Enum):
    """Actions that can be performed on a work order during approval."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class WorkOrderCreateRequest(BaseModel):
    """Schema for creating a new work order.

    Attributes:
        title: Brief summary of the work order (1-200 chars).
        description: Detailed description (1-2000 chars).
        priority: Priority level, defaults to ``"NORMAL"``.
        category: Optional free-form category tag.
        applicant_id: Optional explicit applicant user ID.
    """

    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Work order title",
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Work order description",
    )
    priority: str = Field(default="NORMAL", description="Priority level")
    category: Optional[str] = Field(
        default=None, max_length=100, description="Work order category"
    )
    applicant_id: Optional[int] = Field(
        default=None, description="ID of the applicant"
    )


class WorkOrderUpdateRequest(BaseModel):
    """Schema for updating an existing work order.

    All fields are optional; only supplied fields will be patched.
    """

    title: Optional[str] = Field(
        default=None, min_length=1, max_length=200
    )
    description: Optional[str] = Field(
        default=None, min_length=1, max_length=2000
    )
    priority: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None, max_length=100)


class ApprovalRequest(BaseModel):
    """Schema for approving a work order at the current approval level.

    Attributes:
        operator_id: ID of the user performing the approval.
        comment: Optional free-text comment attached to the approval.
        version: Current optimistic-lock version of the work order.
    """

    operator_id: int = Field(
        ..., description="ID of the approving user"
    )
    comment: Optional[str] = Field(
        default=None, max_length=500, description="Optional approval comment"
    )
    version: int = Field(
        ..., gt=0, description="Optimistic lock version of the work order"
    )


class RejectRequest(BaseModel):
    """Schema for rejecting a work order.

    The ``rejection_reason`` field is **mandatory** and must be a non-empty
    string of at most 500 characters.  Omitting it or providing a
    whitespace-only string will cause a validation error (HTTP 400).

    Attributes:
        operator_id: ID of the user performing the rejection.
        rejection_reason: Mandatory reason explaining why the order is
            rejected (1-500 non-whitespace characters).
        version: Current optimistic-lock version of the work order.
    """

    operator_id: int = Field(
        ..., description="ID of the rejecting user"
    )
    rejection_reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Mandatory reason for rejection (1-500 characters)",
    )
    version: int = Field(
        ..., gt=0, description="Optimistic lock version of the work order"
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_not_be_blank(cls, v: str) -> str:
        """Ensure the rejection reason is not whitespace-only.

        Args:
            v: Raw rejection reason string from the request body.

        Returns:
            The stripped rejection reason.

        Raises:
            ValueError: If the stripped value is empty.
        """
        stripped = v.strip()
        if not stripped:
            raise ValueError("rejection_reason must not be blank")
        return stripped


class CancelRequest(BaseModel):
    """Schema for cancelling a work order.

    Attributes:
        operator_id: ID of the user cancelling the work order.
        reason: Optional free-text reason for cancellation.
        version: Current optimistic-lock version of the work order.
    """

    operator_id: int = Field(
        ..., description="ID of the user cancelling the work order"
    )
    reason: Optional[str] = Field(
        default=None, max_length=500, description="Optional cancellation reason"
    )
    version: int = Field(
        ..., gt=0, description="Optimistic lock version of the work order"
    )


# ---------------------------------------------------------------------------
# Response Schemas — Approval Record
# ---------------------------------------------------------------------------

class ApprovalRecordResponse(BaseModel):
    """Schema for a single approval record returned in API responses.

    Attributes:
        id: Unique record identifier.
        order_id: Associated work order ID.
        operator_id: ID of the user who performed the action.
        operator_name: Display name of the operator (may be ``None``).
        action: The action performed (APPROVE or REJECT).
        comment: Optional comment left by the operator.
        rejection_reason: Populated only when *action* is REJECT.
        approval_level: The approval level at which this action occurred
            (1 for department manager, 2 for asset administrator).
        created_at: ISO 8601 timestamp of when the action was recorded.
    """

    id: int = Field(..., description="Unique record identifier")
    order_id: int = Field(..., description="Associated work order ID")
    operator_id: int = Field(..., description="ID of the user who performed the action")
    operator_name: Optional[str] = Field(
        default=None, description="Display name of the operator"
    )
    action: ApprovalAction = Field(
        ..., description="Action performed (APPROVE or REJECT)"
    )
    comment: Optional[str] = Field(
        default=None, description="Optional comment"
    )
    rejection_reason: Optional[str] = Field(
        default=None, description="Reason if action was REJECT"
    )
    approval_level: Optional[int] = Field(
        default=None, description="Approval level (1 or 2)"
    )
    created_at: datetime = Field(
        ..., description="ISO 8601 timestamp of the action"
    )

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Response Schemas — Work Order
# ---------------------------------------------------------------------------

class WorkOrderResponse(BaseModel):
    """Schema for a single work order in API responses.

    Attributes:
        id: Unique work order identifier.
        order_no: Human-readable order number (e.g. ``WO-20250101-0001``).
        title: Work order title.
        description: Work order description.
        status: Current status in the state machine.
        priority: Priority level.
        category: Optional category tag.
        applicant_id: ID of the applicant.
        applicant_name: Display name of the applicant.
        rejection_reason: Populated only when *status* is REJECTED.
        version: Optimistic-lock version (must be sent back on mutations).
        approval_records: Chronological list of approval actions.
        created_at: ISO 8601 creation timestamp.
        updated_at: ISO 8601 last-update timestamp.
    """

    id: int = Field(..., description="Unique work order identifier")
    order_no: str = Field(..., description="Human-readable order number")
    title: str = Field(..., description="Work order title")
    description: str = Field(..., description="Work order description")
    status: WorkOrderStatus = Field(
        ..., description="Current status in the state machine"
    )
    priority: str = Field(default="NORMAL", description="Priority level")
    category: Optional[str] = Field(
        default=None, description="Work order category"
    )
    applicant_id: Optional[int] = Field(
        default=None, description="ID of the applicant"
    )
    applicant_name: Optional[str] = Field(
        default=None, description="Display name of the applicant"
    )
    rejection_reason: Optional[str] = Field(
        default=None, description="Reason if the order was rejected"
    )
    version: int = Field(
        ..., description="Optimistic lock version"
    )
    approval_records: list[ApprovalRecordResponse] = Field(
        default_factory=list,
        description="Chronological list of approval actions performed on this order",
    )
    created_at: datetime = Field(
        ..., description="ISO 8601 creation timestamp"
    )
    updated_at: datetime = Field(
        ..., description="ISO 8601 last update timestamp"
    )

    model_config = {"from_attributes": True}


class WorkOrderListResponse(BaseModel):
    """Paginated list of work orders.

    Attributes:
        items: The slice of work orders for the current page.
        total: Total number of work orders matching the query.
        page: Current page number (1-based).
        page_size: Number of items per page.
    """

    items: list[WorkOrderResponse] = Field(
        ..., description="List of work orders"
    )
    total: int = Field(
        ..., description="Total number of matching work orders"
    )
    page: int = Field(..., description="Current page number (1-based)")
    page_size: int = Field(..., description="Number of items per page")


class ApprovalActionResponse(BaseModel):
    """Schema returned after an approve / reject / cancel action.

    Attributes:
        order_id: Work order ID.
        order_no: Human-readable order number.
        previous_status: Status before the action.
        current_status: Status after the action.
        action: The action that was performed.
        approval_record: The approval record that was persisted.
        version: New optimistic-lock version of the work order.
    """

    order_id: int = Field(..., description="Work order ID")
    order_no: str = Field(..., description="Human-readable order number")
    previous_status: WorkOrderStatus = Field(
        ..., description="Status before the action"
    )
    current_status: WorkOrderStatus = Field(
        ..., description="Status after the action"
    )
    action: ApprovalAction = Field(
        ..., description="Action that was performed"
    )
    approval_record: ApprovalRecordResponse = Field(
        ..., description="The approval record created"
    )
    version: int = Field(
        ..., description="New optimistic lock version"
    )

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Error Schemas
# ---------------------------------------------------------------------------

class StateTransitionErrorResponse(BaseModel):
    """Error response for invalid state transitions (HTTP 409 Conflict).

    Returned when the backend state machine rejects a transition, e.g.
    attempting to approve a ``PENDING`` order as a level-2 approver.

    Attributes:
        error_code: Always ``"INVALID_STATE_TRANSITION"``.
        message: Human-readable description of the error.
        current_status: The actual status of the work order.
        requested_action: The action that was attempted.
    """

    error_code: str = Field(
        default="INVALID_STATE_TRANSITION",
        description="Machine-readable error code",
    )
    message: str = Field(
        ..., description="Human-readable error description"
    )
    current_status: WorkOrderStatus = Field(
        ..., description="Current status of the work order"
    )
    requested_action: str = Field(
        ..., description="The action that was attempted"
    )


class ConflictErrorResponse(BaseModel):
    """Error response for optimistic-lock conflicts (HTTP 409 Conflict).

    Returned when the ``version`` supplied by the client does not match
    the current version in the database, indicating a concurrent modification.

    Attributes:
        error_code: Always ``"OPTIMISTIC_LOCK_CONFLICT"``.
        message: Human-readable description of the error.
        current_version: The version currently stored in the database.
        provided_version: The version that was sent in the request.
    """

    error_code: str = Field(
        default="OPTIMISTIC_LOCK_CONFLICT",
        description="Machine-readable error code",
    )
    message: str = Field(
        ..., description="Human-readable error description"
    )
    current_version: int = Field(
        ..., description="Current version in the database"
    )
    provided_version: int = Field(
        ..., description="Version that was sent in the request"
    )