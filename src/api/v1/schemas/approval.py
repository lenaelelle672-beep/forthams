"""
Approval Chain Schemas Module

This module defines Pydantic schemas for the approval chain engine API.
It supports Phase 3 (Approval Chain Engine) and Phase 4 (History Record Persistence)
of the SWARM-002 Asset Retirement Flow specification.

Core Features:
- Multi-level approval topology (serial/parallel)
- Routing strategies (CounterSign/OrSign)
- Decision processing (approve/reject/withdraw)
- State transition logging with hash chain integrity
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class ApprovalDecisionEnum(str, Enum):
    """
    Enum representing possible approval decisions.
    
    Attributes:
        PENDING: Awaiting decision
        APPROVED: Node approved
        REJECTED: Node rejected
        SKIPPED: Node skipped (withdrawal scenario)
    """
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class RoutingStrategyEnum(str, Enum):
    """
    Enum representing approval routing strategies.
    
    Attributes:
        SERIAL: Sequential approval (one at a time)
        COUNTER_SIGN: All must approve (AND logic)
        OR_SIGN: Any can approve (OR logic)
    """
    SERIAL = "serial"
    COUNTER_SIGN = "counter_sign"
    OR_SIGN = "or_sign"


class ApprovalNodeBase(BaseModel):
    """
    Base schema for approval node data.
    
    Attributes:
        approver_id: UUID of the approver user
        node_order: Order of the node in the chain
    """
    approver_id: UUID = Field(..., description="UUID of the approver user")
    node_order: int = Field(..., ge=1, le=5, description="Node order (1-5, max 5 levels)")


class ApprovalNodeCreate(ApprovalNodeBase):
    """
    Schema for creating a new approval node.
    """
    pass


class ApprovalNodeResponse(ApprovalNodeBase):
    """
    Schema for approval node response.
    
    Attributes:
        id: Node UUID
        application_id: Associated retirement application UUID
        decision: Current decision status
        comment: Approver's comment
        decided_at: Timestamp of decision (null if pending)
        created_at: Node creation timestamp
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Approval node UUID")
    application_id: UUID = Field(..., description="Associated retirement application UUID")
    decision: ApprovalDecisionEnum = Field(default=ApprovalDecisionEnum.PENDING, description="Current decision")
    comment: Optional[str] = Field(None, description="Approver's comment")
    decided_at: Optional[datetime] = Field(None, description="Decision timestamp")
    created_at: datetime = Field(..., description="Node creation timestamp")


class ApprovalChainCreate(BaseModel):
    """
    Schema for creating an approval chain.
    
    Attributes:
        application_id: UUID of the retirement application
        nodes: List of approval nodes
        routing_strategy: Routing strategy (serial/counter_sign/or_sign)
    """
    application_id: UUID = Field(..., description="Retirement application UUID")
    nodes: list[ApprovalNodeCreate] = Field(..., min_length=1, max_length=5, description="Approval nodes (max 5)")
    routing_strategy: RoutingStrategyEnum = Field(
        default=RoutingStrategyEnum.SERIAL,
        description="Routing strategy for approval flow"
    )


class ApprovalChainResponse(BaseModel):
    """
    Schema for approval chain response.
    
    Attributes:
        id: Chain UUID
        application_id: Associated retirement application UUID
        nodes: List of approval nodes
        routing_strategy: Applied routing strategy
        current_node_index: Index of current pending node
        is_complete: Whether all nodes are decided
        created_at: Chain creation timestamp
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Approval chain UUID")
    application_id: UUID = Field(..., description="Retirement application UUID")
    nodes: list[ApprovalNodeResponse] = Field(..., description="Approval nodes")
    routing_strategy: RoutingStrategyEnum = Field(..., description="Applied routing strategy")
    current_node_index: int = Field(..., description="Current pending node index")
    is_complete: bool = Field(..., description="Whether chain is complete")
    created_at: datetime = Field(..., description="Chain creation timestamp")


class ApprovalDecisionRequest(BaseModel):
    """
    Schema for approval decision request.
    
    Attributes:
        node_id: UUID of the approval node
        decision: Decision (approved/rejected)
        comment: Optional comment
    """
    node_id: UUID = Field(..., description="UUID of the approval node")
    decision: ApprovalDecisionEnum = Field(
        ...,
        description="Decision: approved or rejected"
    )
    comment: Optional[str] = Field(None, max_length=500, description="Optional comment (max 500 chars)")


class ApprovalDecisionResponse(BaseModel):
    """
    Schema for approval decision response.
    
    Attributes:
        node_id: UUID of the processed node
        decision: Final decision
        application_status: New status of the retirement application
        message: Human-readable result message
        decided_at: Decision timestamp
    """
    node_id: UUID = Field(..., description="Processed node UUID")
    decision: ApprovalDecisionEnum = Field(..., description="Final decision")
    application_status: str = Field(..., description="New application status")
    message: str = Field(..., description="Result message")
    decided_at: datetime = Field(..., description="Decision timestamp")


class WithdrawalRequest(BaseModel):
    """
    Schema for application withdrawal request.
    
    Attributes:
        reason: Optional reason for withdrawal
    """
    reason: Optional[str] = Field(None, max_length=500, description="Withdrawal reason")


class WithdrawalResponse(BaseModel):
    """
    Schema for withdrawal response.
    
    Attributes:
        application_id: UUID of withdrawn application
        status: New status (已撤回)
        message: Result message
        withdrawn_at: Withdrawal timestamp
    """
    application_id: UUID = Field(..., description="Withdrawn application UUID")
    status: str = Field(default="已撤回", description="New status")
    message: str = Field(..., description="Result message")
    withdrawn_at: datetime = Field(..., description="Withdrawal timestamp")


class StateTransitionLogBase(BaseModel):
    """
    Base schema for state transition log.
    
    Attributes:
        asset_id: UUID of the asset
        from_status: Previous status
        to_status: New status
        trigger_type: What triggered the transition
    """
    asset_id: UUID = Field(..., description="Asset UUID")
    from_status: str = Field(..., max_length=32, description="Previous status")
    to_status: str = Field(..., max_length=32, description="New status")
    trigger_type: str = Field(..., description="Trigger type: manual/auto/approval")


class StateTransitionLogCreate(StateTransitionLogBase):
    """
    Schema for creating a state transition log entry.
    
    Additional attributes:
        operator_id: UUID of the operator (null for auto)
        metadata: Additional context data
    """
    operator_id: Optional[UUID] = Field(None, description="Operator UUID (null for auto)")
    metadata: Optional[dict] = Field(None, description="Additional context as JSON")


class StateTransitionLogResponse(StateTransitionLogBase):
    """
    Schema for state transition log response.
    
    Attributes:
        id: Log entry UUID
        operator_id: Operator UUID
        metadata: Context data
        hash_chain: Hash for integrity verification
        previous_hash: Hash of previous entry (for chain integrity)
        created_at: Log creation timestamp
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Log entry UUID")
    operator_id: Optional[UUID] = Field(None, description="Operator UUID")
    metadata: Optional[dict] = Field(None, description="Context data")
    hash_chain: str = Field(..., description="Hash for integrity verification")
    previous_hash: Optional[str] = Field(None, description="Hash of previous entry")
    created_at: datetime = Field(..., description="Log creation timestamp")


class ApprovalStatusResponse(BaseModel):
    """
    Schema for approval status overview.
    
    Attributes:
        application_id: Retirement application UUID
        current_status: Current application status
        chain_id: Approval chain UUID
        current_node: Current pending node info
        pending_nodes: List of pending node infos
        completed_nodes: Number of completed nodes
        total_nodes: Total number of nodes
        is_timeout: Whether current node has timed out (72h)
        updated_at: Last update timestamp
    """
    application_id: UUID = Field(..., description="Retirement application UUID")
    current_status: str = Field(..., description="Current application status")
    chain_id: Optional[UUID] = Field(None, description="Approval chain UUID")
    current_node: Optional[ApprovalNodeResponse] = Field(None, description="Current pending node")
    pending_nodes: list[ApprovalNodeResponse] = Field(default_factory=list, description="All pending nodes")
    completed_nodes: int = Field(..., description="Number of completed nodes")
    total_nodes: int = Field(..., description="Total number of nodes")
    is_timeout: bool = Field(default=False, description="Current node timeout flag (72h)")
    updated_at: datetime = Field(..., description="Last update timestamp")


class ApprovalHistoryResponse(BaseModel):
    """
    Schema for approval history record.
    
    Attributes:
        id: History record UUID
        application_id: Associated retirement application UUID
        node_order: Node order in chain
        approver_id: Approver UUID
        approver_name: Approver display name
        decision: Decision made
        comment: Approver's comment
        decided_at: Decision timestamp
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="History record UUID")
    application_id: UUID = Field(..., description="Retirement application UUID")
    node_order: int = Field(..., description="Node order")
    approver_id: UUID = Field(..., description="Approver UUID")
    approver_name: Optional[str] = Field(None, description="Approver display name")
    decision: ApprovalDecisionEnum = Field(..., description="Decision made")
    comment: Optional[str] = Field(None, description="Comment")
    decided_at: datetime = Field(..., description="Decision timestamp")


class HashChainIntegrityResponse(BaseModel):
    """
    Schema for hash chain integrity check response.
    
    Attributes:
        is_valid: Whether the hash chain is intact
        broken_at: UUID of the broken record (if any)
        verified_count: Number of records verified
        checked_at: Check timestamp
    """
    is_valid: bool = Field(..., description="Hash chain integrity status")
    broken_at: Optional[UUID] = Field(None, description="UUID of broken record if any")
    verified_count: int = Field(..., description="Number of records verified")
    checked_at: datetime = Field(..., description="Check timestamp")