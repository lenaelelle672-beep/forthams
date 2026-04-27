"""
Ticket Schema Definitions for Work Order Approval Workflow

This module defines Pydantic schemas for ticket (work order) management
in the enterprise asset management system, supporting the approval workflow:
- PENDING → IN_REVIEW → APPROVED/REJECTED

SWARM-001: Work Order Approval Flow - Backend State Machine & Approval API
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class TicketStatus(str, Enum):
    """
    Ticket status enumeration for approval workflow state machine.
    
    State Transition Matrix:
    ┌───────────┬────────────────┐
    │ Current   │ Next State     │
    ├───────────┼────────────────┤
    │ PENDING   │ IN_REVIEW      │
    │ IN_REVIEW │ APPROVED       │
    │ IN_REVIEW │ REJECTED       │
    │ APPROVED  │ (terminal)     │
    │ REJECTED  │ (terminal)     │
    └───────────┴────────────────┘
    """
    PENDING = "PENDING"       # Waiting for submission to approval
    IN_REVIEW = "IN_REVIEW"   # Under approval review
    APPROVED = "APPROVED"     # Terminal state - approved
    REJECTED = "REJECTED"     # Terminal state - rejected


class TicketPriority(str, Enum):
    """Ticket priority levels for workflow routing."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class ApprovalAction(str, Enum):
    """Available approval actions in the workflow."""
    SUBMIT = "SUBMIT"         # Submit for approval (PENDING → IN_REVIEW)
    APPROVE = "APPROVE"      # Approve (IN_REVIEW → APPROVED)
    REJECT = "REJECT"        # Reject (IN_REVIEW → REJECTED)
    CANCEL = "CANCEL"        # Cancel submission


class TicketBase(BaseModel):
    """
    Base schema for ticket data with common fields.
    
    Attributes:
        title: Ticket title (required, max 200 chars)
        content: Ticket description/details
        priority: Priority level for routing
    """
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Ticket title"
    )
    content: Optional[str] = Field(
        None,
        max_length=5000,
        description="Detailed description of the ticket"
    )
    priority: TicketPriority = Field(
        default=TicketPriority.MEDIUM,
        description="Priority level for workflow routing"
    )

    model_config = {
        "use_enum_values": True,
        "json_schema_extra": {
            "example": {
                "title": "Asset Maintenance Request #2024-001",
                "content": "Request maintenance for server room AC unit",
                "priority": "HIGH"
            }
        }
    }


class TicketCreate(TicketBase):
    """
    Schema for creating a new ticket/work order.
    
    All fields inherited from TicketBase.
    New tickets are created with PENDING status by default.
    """
    pass


class TicketUpdate(BaseModel):
    """
    Schema for updating existing ticket fields.
    
    All fields are optional to support partial updates.
    Status transitions are handled separately via approval actions.
    """
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200
    )
    content: Optional[str] = Field(
        None,
        max_length=5000
    )
    priority: Optional[TicketPriority] = None
    approver_id: Optional[int] = Field(
        None,
        description="Assigned approver user ID"
    )

    model_config = {"use_enum_values": True}


class ApprovalActionRequest(BaseModel):
    """
    Schema for approval action requests (approve/reject).
    
    Validates action-specific requirements:
    - APPROVE: Optional comment
    - REJECT: Mandatory reason (10-500 chars)
    
    Attributes:
        action: The approval action to perform
        comment: Optional comment for any action
        reason: Mandatory rejection reason (REJECT action only)
    """
    action: ApprovalAction
    comment: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional comment for the approval action"
    )
    reason: Optional[str] = Field(
        None,
        min_length=10,
        max_length=500,
        description="Rejection reason (required for REJECT action)"
    )

    @field_validator('reason')
    @classmethod
    def validate_reject_reason(cls, v: Optional[str], info) -> Optional[str]:
        """Validate rejection reason meets minimum requirements."""
        # Note: reason validation is handled at service layer
        # where action context is available
        return v

    model_config = {
        "use_enum_values": True,
        "json_schema_extra": {
            "example": {
                "action": "APPROVE",
                "comment": "Approved after verification"
            }
        }
    }


class RejectActionRequest(ApprovalActionRequest):
    """
    Schema specifically for rejection action with mandatory reason.
    
    Inherits from ApprovalActionRequest but enforces reason field.
    """
    action: ApprovalAction = ApprovalAction.REJECT
    reason: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Rejection reason (10-500 characters required)"
    )

    @field_validator('reason')
    @classmethod
    def validate_reason_length(cls, v: str) -> str:
        """Ensure rejection reason meets character requirements."""
        if len(v) < 10:
            raise ValueError("Rejection reason must be at least 10 characters")
        if len(v) > 500:
            raise ValueError("Rejection reason cannot exceed 500 characters")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "reason": "Insufficient documentation provided for approval"
            }
        }
    }


class SubmitForApprovalRequest(BaseModel):
    """
    Schema for submitting a ticket for approval.
    
    Attributes:
        approver_id: ID of the user assigned as approver (required)
        notes: Optional notes for the approval request
    """
    approver_id: int = Field(
        ...,
        gt=0,
        description="ID of the user assigned as approver"
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional notes for the approval request"
    )


class TicketResponse(TicketBase):
    """
    Complete ticket response schema with all fields.
    
    Includes:
    - Core ticket data
    - Current status and timestamps
    - Approval-related fields (approver, submitted_at, etc.)
    """
    id: int = Field(..., description="Unique ticket identifier")
    status: TicketStatus
    created_by: int = Field(..., description="User ID of ticket creator")
    created_at: datetime
    updated_at: datetime
    
    # Approval-related fields
    approver_id: Optional[int] = Field(
        None,
        description="Assigned approver user ID"
    )
    submitted_at: Optional[datetime] = Field(
        None,
        description="Timestamp when submitted for approval"
    )
    approved_at: Optional[datetime] = Field(
        None,
        description="Timestamp when ticket was approved/rejected"
    )
    approved_by: Optional[int] = Field(
        None,
        description="User ID of approver who processed the ticket"
    )

    model_config = {
        "from_attributes": True,
        "use_enum_values": True
    }


class TicketStatusResponse(BaseModel):
    """
    Simplified schema for ticket status queries.
    
    Attributes:
        id: Ticket ID
        status: Current status
        updated_at: Last status change timestamp
    """
    id: int
    status: TicketStatus
    updated_at: datetime

    model_config = {
        "use_enum_values": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "status": "IN_REVIEW",
                "updated_at": "2024-01-15T10:30:00Z"
            }
        }
    }


class ApprovalHistoryRecord(BaseModel):
    """
    Single approval history record.
    
    Attributes:
        id: History record ID
        action: Action performed (SUBMIT/APPROVE/REJECT)
        operator_id: User who performed the action
        operator_name: Display name of operator
        comment: Action comment/reason
        timestamp: When the action occurred
    """
    id: int
    action: ApprovalAction
    operator_id: int
    operator_name: Optional[str] = None
    comment: Optional[str] = None
    reason: Optional[str] = None
    timestamp: datetime

    model_config = {
        "from_attributes": True,
        "use_enum_values": True
    }


class ApprovalHistoryResponse(BaseModel):
    """
    Complete approval history for a ticket.
    
    Attributes:
        ticket_id: Associated ticket ID
        current_status: Current ticket status
        history: List of all approval actions in chronological order
    """
    ticket_id: int
    current_status: TicketStatus
    history: List[ApprovalHistoryRecord] = Field(
        default_factory=list,
        description="Chronological list of approval actions"
    )

    model_config = {
        "use_enum_values": True,
        "json_schema_extra": {
            "example": {
                "ticket_id": 1,
                "current_status": "IN_REVIEW",
                "history": [
                    {
                        "id": 1,
                        "action": "SUBMIT",
                        "operator_id": 10,
                        "operator_name": "John Doe",
                        "timestamp": "2024-01-15T09:00:00Z"
                    },
                    {
                        "id": 2,
                        "action": "APPROVE",
                        "operator_id": 5,
                        "operator_name": "Jane Smith",
                        "comment": "Verified and approved",
                        "timestamp": "2024-01-15T10:30:00Z"
                    }
                ]
            }
        }
    }


class TicketListItem(BaseModel):
    """
    Lightweight schema for ticket list displays.
    
    Contains essential fields for list rendering without
    full detail payload.
    """
    id: int
    title: str
    status: TicketStatus
    priority: TicketPriority
    created_at: datetime
    created_by: int
    approver_id: Optional[int] = None

    model_config = {
        "from_attributes": True,
        "use_enum_values": True
    }


class TicketWorkflowResponse(BaseModel):
    """
    Schema for workflow state machine queries.
    
    Provides current state and available transitions.
    
    Attributes:
        ticket_id: Associated ticket ID
        current_status: Current workflow state
        available_actions: List of actions available from current state
    """
    ticket_id: int
    current_status: TicketStatus
    available_actions: List[str] = Field(
        description="Actions available from current state per state machine"
    )
    approver_id: Optional[int] = None
    submitted_at: Optional[datetime] = None

    model_config = {
        "use_enum_values": True,
        "json_schema_extra": {
            "example": {
                "ticket_id": 1,
                "current_status": "IN_REVIEW",
                "available_actions": ["APPROVE", "REJECT"],
                "approver_id": 5
            }
        }
    }


class TicketStatistics(BaseModel):
    """
    Aggregate statistics for ticket workflow.
    
    Used by dashboard and reporting features.
    """
    total: int = Field(default=0, description="Total ticket count")
    pending: int = Field(default=0, description="Tickets in PENDING status")
    in_review: int = Field(default=0, description="Tickets in IN_REVIEW status")
    approved: int = Field(default=0, description="Approved tickets count")
    rejected: int = Field(default=0, description="Rejected tickets count")

    @classmethod
    def from_status_counts(cls, counts: dict) -> "TicketStatistics":
        """Factory method to create from status count dict."""
        return cls(
            total=sum(counts.values()),
            pending=counts.get(TicketStatus.PENDING.value, 0),
            in_review=counts.get(TicketStatus.IN_REVIEW.value, 0),
            approved=counts.get(TicketStatus.APPROVED.value, 0),
            rejected=counts.get(TicketStatus.REJECTED.value, 0)
        )


class TicketFilterParams(BaseModel):
    """
    Filter parameters for ticket listing queries.
    
    Supports common filtering use cases:
    - Status filtering
    - Date range filtering
    - Assignee filtering
    """
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    created_by: Optional[int] = None
    approver_id: Optional[int] = None
    date_from: Optional[datetime] = Field(
        None,
        description="Filter tickets created on or after this date"
    )
    date_to: Optional[datetime] = Field(
        None,
        description="Filter tickets created on or before this date"
    )
    search: Optional[str] = Field(
        None,
        max_length=100,
        description="Search in title and content"
    )

    model_config = {"use_enum_values": True}


class PaginatedTicketResponse(BaseModel):
    """
    Paginated response wrapper for ticket lists.
    
    Attributes:
        items: List of tickets for current page
        total: Total count matching filter criteria
        page: Current page number (1-based)
        page_size: Items per page
        pages: Total number of pages
    """
    items: List[TicketListItem]
    total: int
    page: int
    page_size: int
    pages: int

    model_config = {
        "json_schema_extra": {
            "example": {
                "items": [
                    {
                        "id": 1,
                        "title": "Maintenance Request",
                        "status": "PENDING",
                        "priority": "MEDIUM",
                        "created_at": "2024-01-15T09:00:00Z",
                        "created_by": 10
                    }
                ],
                "total": 50,
                "page": 1,
                "page_size": 20,
                "pages": 3
            }
        }
    }