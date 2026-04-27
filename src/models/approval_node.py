"""
Approval Node model for work order approval workflow.

Defines the state machine for approval processes with states and transitions.
"""
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class ApprovalStatus(str, Enum):
    """Status values for approval nodes."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class ApprovalAction(str, Enum):
    """Action types for approval workflow."""
    APPROVE = "approve"
    REJECT = "reject"
    DELEGATE = "delegate"
    RETURN = "return"


@dataclass
class ApprovalNode:
    """
    Represents a single approval node in the workflow.
    
    Each node contains information about who can approve, the current state,
    and any conditions that must be met before approval is granted.
    """
    id: str
    name: str
    approver_role: str
    approver_id: Optional[str] = None
    status: ApprovalStatus = ApprovalStatus.PENDING
    comment: Optional[str] = None
    action_time: Optional[datetime] = None
    delegation_target: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def can_transition_to(self, new_status: ApprovalStatus) -> bool:
        """
        Check if the node can transition to the new status.
        
        Args:
            new_status: The target status to transition to.
            
        Returns:
            True if the transition is valid, False otherwise.
        """
        valid_transitions = {
            ApprovalStatus.PENDING: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.SKIPPED],
            ApprovalStatus.APPROVED: [],
            ApprovalStatus.REJECTED: [],
            ApprovalStatus.SKIPPED: [],
        }
        return new_status in valid_transitions.get(self.status, [])
    
    def approve(self, approver_id: str, comment: Optional[str] = None) -> bool:
        """
        Approve this node.
        
        Args:
            approver_id: ID of the approver.
            comment: Optional approval comment.
            
        Returns:
            True if approval was successful, False otherwise.
        """
        if not self.can_transition_to(ApprovalStatus.APPROVED):
            return False
        
        self.status = ApprovalStatus.APPROVED
        self.approver_id = approver_id
        self.comment = comment
        self.action_time = datetime.now()
        self.updated_at = datetime.now()
        return True
    
    def reject(self, approver_id: str, comment: str) -> bool:
        """
        Reject this node.
        
        Args:
            approver_id: ID of the approver.
            comment: Rejection reason (required).
            
        Returns:
            True if rejection was successful, False otherwise.
        """
        if not comment:
            return False
        
        if not self.can_transition_to(ApprovalStatus.REJECTED):
            return False
        
        self.status = ApprovalStatus.REJECTED
        self.approver_id = approver_id
        self.comment = comment
        self.action_time = datetime.now()
        self.updated_at = datetime.now()
        return True
    
    def delegate(self, target_approver_id: str) -> bool:
        """
        Delegate approval to another user.
        
        Args:
            target_approver_id: ID of the user to delegate to.
            
        Returns:
            True if delegation was successful, False otherwise.
        """
        if self.status != ApprovalStatus.PENDING:
            return False
        
        self.delegation_target = target_approver_id
        self.updated_at = datetime.now()
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert node to dictionary representation.
        
        Returns:
            Dictionary containing node data.
        """
        return {
            "id": self.id,
            "name": self.name,
            "approver_role": self.approver_role,
            "approver_id": self.approver_id,
            "status": self.status.value if isinstance(self.status, ApprovalStatus) else self.status,
            "comment": self.comment,
            "action_time": self.action_time.isoformat() if self.action_time else None,
            "delegation_target": self.delegation_target,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ApprovalChain:
    """
    Represents a chain of approval nodes forming a complete workflow.
    
    The chain defines the sequence of approvals required for a work order
    to be fully approved or rejected.
    """
    id: str
    work_order_id: str
    nodes: List[ApprovalNode] = field(default_factory=list)
    current_node_index: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    @property
    def current_node(self) -> Optional[ApprovalNode]:
        """
        Get the current approval node.
        
        Returns:
            The current node or None if all nodes are processed.
        """
        if 0 <= self.current_node_index < len(self.nodes):
            return self.nodes[self.current_node_index]
        return None
    
    @property
    def is_complete(self) -> bool:
        """
        Check if the approval chain is complete.
        
        Returns:
            True if all nodes are processed, False otherwise.
        """
        return self.current_node_index >= len(self.nodes)
    
    @property
    def is_approved(self) -> bool:
        """
        Check if the chain is fully approved.
        
        Returns:
            True if all nodes are approved, False otherwise.
        """
        return all(node.status == ApprovalStatus.APPROVED for node in self.nodes)
    
    @property
    def is_rejected(self) -> bool:
        """
        Check if any node in the chain rejected.
        
        Returns:
            True if any node rejected, False otherwise.
        """
        return any(node.status == ApprovalStatus.REJECTED for node in self.nodes)
    
    def get_pending_approvers(self) -> List[str]:
        """
        Get list of approvers who still need to act.
        
        Returns:
            List of approver IDs or roles.
        """
        pending = []
        for node in self.nodes:
            if node.status == ApprovalStatus.PENDING:
                approver = node.delegation_target or node.approver_id
                if approver:
                    pending.append(approver)
                else:
                    pending.append(node.approver_role)
        return pending
    
    def advance_to_next_node(self) -> bool:
        """
        Move to the next approval node in the chain.
        
        Returns:
            True if advanced successfully, False if already at end.
        """
        if self.is_complete:
            return False
        
        self.current_node_index += 1
        self.updated_at = datetime.now()
        return True
    
    def process_action(self, action: ApprovalAction, approver_id: str, 
                      comment: Optional[str] = None) -> bool:
        """
        Process an action on the current node.
        
        Args:
            action: The action to take.
            approver_id: ID of the user taking the action.
            comment: Optional comment for the action.
            
        Returns:
            True if action was processed successfully, False otherwise.
        """
        current = self.current_node
        if not current:
            return False
        
        success = False
        if action == ApprovalAction.APPROVE:
            success = current.approve(approver_id, comment)
        elif action == ApprovalAction.REJECT:
            success = current.reject(approver_id, comment or "")
        elif action == ApprovalAction.DELEGATE and comment:
            success = current.delegate(comment)
        
        if success:
            self.updated_at = datetime.now()
            if current.status != ApprovalStatus.PENDING:
                self.advance_to_next_node()
        
        return success
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert chain to dictionary representation.
        
        Returns:
            Dictionary containing chain data.
        """
        return {
            "id": self.id,
            "work_order_id": self.work_order_id,
            "nodes": [node.to_dict() for node in self.nodes],
            "current_node_index": self.current_node_index,
            "is_complete": self.is_complete,
            "is_approved": self.is_approved,
            "is_rejected": self.is_rejected,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }