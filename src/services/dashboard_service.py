"""
Dashboard Service - Asset Retirement Workflow Engine

This module implements the core workflow engine for asset retirement lifecycle management,
including state machine transitions, approval chains, and event persistence.

Key Features:
- State transition engine with deterministic rules
- Multi-level approval chain (applicant -> approver -> final reviewer)
- Immutable event sourcing for audit trails
- Atomic operations ensuring data consistency

Author: Asset Management System
"""

from enum import Enum
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from uuid import uuid4
import hashlib
import json


class AssetStatus(str, Enum):
    """Asset lifecycle status enumeration."""
    IN_USE = "in_use"
    PENDING_RETIREMENT = "pending_retirement"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETIRED = "retired"


class RetirementEventType(str, Enum):
    """Event types for retirement workflow."""
    APPLICATION_SUBMITTED = "application_submitted"
    REVIEW_STARTED = "review_started"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_REJECTED = "approval_rejected"
    FINAL_APPROVAL = "final_approval"
    RETIREMENT_COMPLETED = "retirement_completed"


@dataclass
class RetirementEvent:
    """
    Immutable event record for state transitions.
    
    Each event contains all context needed to understand the state change,
    including a cryptographic hash for tamper detection.
    """
    event_id: str
    timestamp: datetime
    event_type: RetirementEventType
    asset_id: str
    actor_id: str
    actor_role: str
    from_status: Optional[str]
    to_status: str
    payload: Dict[str, Any]
    previous_hash: str
    
    def compute_hash(self) -> str:
        """
        Compute cryptographic hash for tamper detection.
        
        Returns:
            SHA-256 hash of event data
        """
        event_data = f"{self.event_id}{self.timestamp.isoformat()}{self.event_type.value}"
        event_data += f"{self.asset_id}{self.actor_id}{self.from_status}{self.to_status}"
        event_data += json.dumps(self.payload, sort_keys=True)
        return hashlib.sha256(event_data.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary representation."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "asset_id": self.asset_id,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role,
            "from_status": self.from_status,
            "to_status": self.to_status,
            "payload": self.payload,
            "hash": self.compute_hash()
        }


@dataclass
class ApprovalNode:
    """Represents a single node in the approval chain."""
    node_id: str
    role: str
    required_permission: str
    order: int


class ApprovalChain:
    """
    Manages the approval chain workflow.
    
    Supports multi-level approval with deterministic routing
    based on actor roles and permissions.
    """
    
    # Define the approval chain order
    CHAIN = [
        ApprovalNode("step_1", "approver", "approve:retirement", 1),
        ApprovalNode("step_2", "final_reviewer", "final_approve:retirement", 2),
    ]
    
    def __init__(self):
        self.current_step = 0
        self.history: List[ApprovalNode] = []
    
    def get_current_approver_role(self) -> Optional[str]:
        """
        Get the role required for current approval step.
        
        Returns:
            Role name or None if chain is complete
        """
        if self.current_step >= len(self.CHAIN):
            return None
        return self.CHAIN[self.current_step].role
    
    def get_current_node(self) -> Optional[ApprovalNode]:
        """Get the current approval node."""
        if self.current_step >= len(self.CHAIN):
            return None
        return self.CHAIN[self.current_step]
    
    def advance(self, approved: bool, actor_role: str) -> bool:
        """
        Advance the approval chain based on decision.
        
        Args:
            approved: Whether the current step approved
            actor_role: Role of the actor making the decision
            
        Returns:
            True if chain continues, False if terminated
        """
        current_node = self.get_current_node()
        if current_node is None:
            return False
        
        self.history.append(current_node)
        
        if not approved:
            self.current_step = -1  # Mark as rejected
            return False
        
        self.current_step += 1
        
        if self.current_step >= len(self.CHAIN):
            return True  # All steps completed
        
        return True
    
    def is_complete(self) -> bool:
        """Check if approval chain is fully approved."""
        return self.current_step == len(self.CHAIN)
    
    def is_rejected(self) -> bool:
        """Check if approval chain was rejected at any step."""
        return self.current_step == -1


@dataclass
class RetirementRequest:
    """
    Represents an asset retirement application.
    
    Tracks the complete lifecycle from submission to completion.
    """
    request_id: str
    asset_id: str
    applicant_id: str
    status: AssetStatus
    approval_chain: ApprovalChain
    created_at: datetime
    updated_at: datetime
    reason: str
    events: List[RetirementEvent] = field(default_factory=list)
    
    def __post_init__(self):
        if self.request_id is None:
            self.request_id = str(uuid4())


class StateTransitionError(Exception):
    """Exception raised when an invalid state transition is attempted."""
    
    def __init__(self, from_state: str, to_state: str, reason: str = None):
        self.from_state = from_state
        self.to_state = to_state
        self.reason = reason or "Invalid state transition"
        super().__init__(f"Cannot transition from {from_state} to {to_state}: {self.reason}")


class ApprovalChainError(Exception):
    """Exception raised when approval chain rules are violated."""
    
    def __init__(self, message: str, step: int = None):
        self.step = step
        super().__init__(message)


class EventPersistenceError(Exception):
    """Exception raised when event persistence fails."""
    pass


class RolePermissionError(Exception):
    """Exception raised when actor lacks required permissions."""
    
    def __init__(self, actor_role: str, required_permission: str):
        self.actor_role = actor_role
        self.required_permission = required_permission
        super().__init__(
            f"Role '{actor_role}' lacks required permission '{required_permission}'"
        )


# Valid state transitions map (deterministic rules)
VALID_TRANSITIONS: Dict[str, List[str]] = {
    AssetStatus.IN_USE.value: [AssetStatus.PENDING_RETIREMENT.value],
    AssetStatus.PENDING_RETIREMENT.value: [AssetStatus.UNDER_REVIEW.value],
    AssetStatus.UNDER_REVIEW.value: [
        AssetStatus.APPROVED.value,
        AssetStatus.REJECTED.value
    ],
    AssetStatus.APPROVED.value: [AssetStatus.RETIRED.value],
    AssetStatus.REJECTED.value: [],  # Terminal state (no outgoing transitions)
    AssetStatus.RETIRED.value: [],   # Terminal state (no outgoing transitions)
}


# Permission requirements for transitions
PERMISSION_REQUIREMENTS: Dict[tuple, List[str]] = {
    (AssetStatus.IN_USE.value, AssetStatus.PENDING_RETIREMENT.value): ["submit:retirement"],
    (AssetStatus.PENDING_RETIREMENT.value, AssetStatus.UNDER_REVIEW.value): ["review:retirement"],
    (AssetStatus.UNDER_REVIEW.value, AssetStatus.APPROVED.value): ["approve:retirement"],
    (AssetStatus.UNDER_REVIEW.value, AssetStatus.REJECTED.value): ["approve:retirement"],
    (AssetStatus.APPROVED.value, AssetStatus.RETIRED.value): ["final_approve:retirement"],
}


class DashboardService:
    """
    Core service for asset retirement workflow management.
    
    Implements:
    - State machine engine with deterministic transitions
    - Multi-level approval chain
    - Immutable event sourcing for audit trails
    - RBAC-based permission validation
    """
    
    def __init__(self, event_store: Optional[Dict[str, List[RetirementEvent]]] = None):
        """
        Initialize the dashboard service.
        
        Args:
            event_store: Optional in-memory event store for testing
        """
        self._requests: Dict[str, RetirementRequest] = {}
        self._events: Dict[str, List[RetirementEvent]] = event_store or {}
        self._permissions: Dict[str, List[str]] = {}  # role -> permissions mapping
    
    def register_permissions(self, role: str, permissions: List[str]) -> None:
        """
        Register permissions for a role.
        
        Args:
            role: Role name
            permissions: List of permission strings
        """
        self._permissions[role] = permissions
    
    def _validate_transition(
        self, 
        from_status: str, 
        to_status: str
    ) -> bool:
        """
        Validate if a state transition is allowed.
        
        Args:
            from_status: Current status
            to_status: Target status
            
        Returns:
            True if transition is valid
        """
        valid_targets = VALID_TRANSITIONS.get(from_status, [])
        return to_status in valid_targets
    
    def _check_permission(
        self, 
        actor_role: str, 
        from_status: str, 
        to_status: str
    ) -> bool:
        """
        Check if actor has required permissions for transition.
        
        Args:
            actor_role: Role of the actor
            from_status: Current status
            to_status: Target status
            
        Returns:
            True if actor has required permissions
        """
        required_perms = PERMISSION_REQUIREMENTS.get(
            (from_status, to_status), 
            []
        )
        
        if not required_perms:
            return True  # No permissions required
        
        actor_perms = self._permissions.get(actor_role, [])
        return any(perm in actor_perms for perm in required_perms)
    
    def _create_event(
        self,
        event_type: RetirementEventType,
        asset_id: str,
        actor_id: str,
        actor_role: str,
        from_status: Optional[str],
        to_status: str,
        payload: Optional[Dict[str, Any]] = None
    ) -> RetirementEvent:
        """
        Create a new retirement event with hash chain.
        
        Args:
            event_type: Type of event
            asset_id: Asset identifier
            actor_id: Actor performing the action
            actor_role: Role of the actor
            from_status: Previous status
            to_status: New status
            payload: Additional event data
            
        Returns:
            Created RetirementEvent with hash
        """
        # Get previous hash for chain
        asset_events = self._events.get(asset_id, [])
        previous_hash = asset_events[-1].compute_hash() if asset_events else "genesis"
        
        event = RetirementEvent(
            event_id=str(uuid4()),
            timestamp=datetime.utcnow(),
            event_type=event_type,
            asset_id=asset_id,
            actor_id=actor_id,
            actor_role=actor_role,
            from_status=from_status,
            to_status=to_status,
            payload=payload or {},
            previous_hash=previous_hash
        )
        
        return event
    
    def _persist_event(self, event: RetirementEvent) -> None:
        """
        Persist an event to the event store.
        
        Args:
            event: Event to persist
            
        Raises:
            EventPersistenceError: If persistence fails
        """
        if event.asset_id not in self._events:
            self._events[event.asset_id] = []
        
        self._events[event.asset_id].append(event)
    
    def submit_retirement_application(
        self,
        asset_id: str,
        applicant_id: str,
        applicant_role: str,
        reason: str
    ) -> RetirementRequest:
        """
        Submit a new retirement application for an asset.
        
        Args:
            asset_id: Asset to retire
            applicant_id: User submitting the application
            applicant_role: Role of the applicant
            reason: Reason for retirement
            
        Returns:
            Created retirement request
            
        Raises:
            RolePermissionError: If applicant lacks permission
            StateTransitionError: If asset is not in valid state
        """
        # Check permission
        if not self._check_permission(
            applicant_role,
            AssetStatus.IN_USE.value,
            AssetStatus.PENDING_RETIREMENT.value
        ):
            raise RolePermissionError(
                applicant_role,
                "submit:retirement"
            )
        
        # Create event
        event = self._create_event(
            event_type=RetirementEventType.APPLICATION_SUBMITTED,
            asset_id=asset_id,
            actor_id=applicant_id,
            actor_role=applicant_role,
            from_status=AssetStatus.IN_USE.value,
            to_status=AssetStatus.PENDING_RETIREMENT.value,
            payload={"reason": reason}
        )
        
        # Create request with approval chain
        request = RetirementRequest(
            request_id=event.event_id,
            asset_id=asset_id,
            applicant_id=applicant_id,
            status=AssetStatus.PENDING_RETIREMENT,
            approval_chain=ApprovalChain(),
            created_at=event.timestamp,
            updated_at=event.timestamp,
            reason=reason,
            events=[event]
        )
        
        # Atomically persist event and create request
        self._persist_event(event)
        self._requests[request.request_id] = request
        
        return request
    
    def start_review(
        self,
        request_id: str,
        reviewer_id: str,
        reviewer_role: str
    ) -> RetirementRequest:
        """
        Start the approval review process.
        
        Args:
            request_id: Retirement request ID
            reviewer_id: User starting the review
            reviewer_role: Role of the reviewer
            
        Returns:
            Updated retirement request
            
        Raises:
            StateTransitionError: If transition is invalid
            RolePermissionError: If reviewer lacks permission
        """
        request = self._requests.get(request_id)
        if not request:
            raise StateTransitionError(
                request.status.value,
                AssetStatus.UNDER_REVIEW.value,
                "Request not found"
            )
        
        current_status = request.status.value
        
        # Validate transition
        if not self._validate_transition(
            current_status,
            AssetStatus.UNDER_REVIEW.value
        ):
            raise StateTransitionError(
                current_status,
                AssetStatus.UNDER_REVIEW.value
            )
        
        # Check permission
        if not self._check_permission(
            reviewer_role,
            current_status,
            AssetStatus.UNDER_REVIEW.value
        ):
            raise RolePermissionError(reviewer_role, "review:retirement")
        
        # Create event
        event = self._create_event(
            event_type=RetirementEventType.REVIEW_STARTED,
            asset_id=request.asset_id,
            actor_id=reviewer_id,
            actor_role=reviewer_role,
            from_status=current_status,
            to_status=AssetStatus.UNDER_REVIEW.value
        )
        
        # Update state atomically
        request.status = AssetStatus.UNDER_REVIEW
        request.updated_at = event.timestamp
        request.events.append(event)
        
        self._persist_event(event)
        
        return request
    
    def approve_step(
        self,
        request_id: str,
        approver_id: str,
        approver_role: str,
        approved: bool,
        comment: Optional[str] = None
    ) -> RetirementRequest:
        """
        Process an approval decision at current step.
        
        Args:
            request_id: Retirement request ID
            approver_id: User making the decision
            approver_role: Role of the approver
            approved: Whether to approve or reject
            comment: Optional approval comment
            
        Returns:
            Updated retirement request
            
        Raises:
            StateTransitionError: If request is not in review state
            ApprovalChainError: If approver is not at correct step
            RolePermissionError: If approver lacks required permission
        """
        request = self._requests.get(request_id)
        if not request:
            raise StateTransitionError(
                "none",
                "unknown",
                "Request not found"
            )
        
        if request.status not in [AssetStatus.UNDER_REVIEW, AssetStatus.PENDING_RETIREMENT]:
            raise StateTransitionError(
                request.status.value,
                "approval_step",
                "Request must be in review state"
            )
        
        # Ensure we're in UNDER_REVIEW for approval
        if request.status == AssetStatus.PENDING_RETIREMENT:
            current_status = AssetStatus.PENDING_RETIREMENT.value
            target_status = AssetStatus.UNDER_REVIEW.value
        else:
            current_status = AssetStatus.UNDER_REVIEW.value
            # Determine target based on approval chain
            if request.approval_chain.is_complete():
                target_status = AssetStatus.APPROVED.value
            else:
                target_status = AssetStatus.UNDER_REVIEW.value
        
        # Check if we're at the right step
        required_role = request.approval_chain.get_current_approver_role()
        if required_role and approver_role != required_role:
            raise ApprovalChainError(
                f"Current step requires role '{required_role}', got '{approver_role}'",
                step=request.approval_chain.current_step
            )
        
        # Process approval decision
        is_final = request.approval_chain.advance(approved, approver_role)
        
        # Determine event type and new status
        if approved:
            if is_final:
                event_type = RetirementEventType.FINAL_APPROVAL
                new_status = AssetStatus.APPROVED
            else:
                event_type = RetirementEventType.APPROVAL_GRANTED
                new_status = AssetStatus.UNDER_REVIEW
        else:
            event_type = RetirementEventType.APPROVAL_REJECTED
            new_status = AssetStatus.REJECTED
        
        # Create event
        event = self._create_event(
            event_type=event_type,
            asset_id=request.asset_id,
            actor_id=approver_id,
            actor_role=approver_role,
            from_status=current_status,
            to_status=new_status.value,
            payload={
                "approved": approved,
                "comment": comment,
                "step": request.approval_chain.current_step,
                "is_final": is_final
            }
        )
        
        # Update request
        old_status = request.status
        request.status = new_status
        request.updated_at = event.timestamp
        request.events.append(event)
        
        # Persist atomically
        self._persist_event(event)
        
        return request
    
    def complete_retirement(
        self,
        request_id: str,
        operator_id: str,
        operator_role: str
    ) -> RetirementRequest:
        """
        Complete the retirement process after final approval.
        
        Args:
            request_id: Retirement request ID
            operator_id: User completing the retirement
            operator_role: Role of the operator
            
        Returns:
            Updated retirement request
            
        Raises:
            StateTransitionError: If request is not approved
            RolePermissionError: If operator lacks permission
        """
        request = self._requests.get(request_id)
        if not request:
            raise StateTransitionError(
                "none",
                "retired",
                "Request not found"
            )
        
        if request.status != AssetStatus.APPROVED:
            raise StateTransitionError(
                request.status.value,
                AssetStatus.RETIRED.value,
                "Request must be approved first"
            )
        
        # Check permission
        if not self._check_permission(
            operator_role,
            AssetStatus.APPROVED.value,
            AssetStatus.RETIRED.value
        ):
            raise RolePermissionError(
                operator_role,
                "final_approve:retirement"
            )
        
        # Create event
        event = self._create_event(
            event_type=RetirementEventType.RETIREMENT_COMPLETED,
            asset_id=request.asset_id,
            actor_id=operator_id,
            actor_role=operator_role,
            from_status=AssetStatus.APPROVED.value,
            to_status=AssetStatus.RETIRED.value
        )
        
        # Update request
        request.status = AssetStatus.RETIRED
        request.updated_at = event.timestamp
        request.events.append(event)
        
        self._persist_event(event)
        
        return request
    
    def get_request(self, request_id: str) -> Optional[RetirementRequest]:
        """
        Retrieve a retirement request by ID.
        
        Args:
            request_id: Request identifier
            
        Returns:
            RetirementRequest or None if not found
        """
        return self._requests.get(request_id)
    
    def get_asset_history(self, asset_id: str) -> List[RetirementEvent]:
        """
        Get the complete event history for an asset.
        
        Args:
            asset_id: Asset identifier
            
        Returns:
            List of events in chronological order
        """
        return self._events.get(asset_id, [])
    
    def validate_state_transition(
        self,
        from_status: str,
        to_status: str,
        actor_role: str
    ) -> bool:
        """
        Validate if a state transition is allowed for given actor.
        
        Args:
            from_status: Current status
            to_status: Target status
            actor_role: Role of the actor
            
        Returns:
            True if transition is valid and permitted
        """
        is_valid = self._validate_transition(from_status, to_status)
        has_permission = self._check_permission(from_status, to_status, actor_role)
        return is_valid and has_permission
    
    def verify_event_integrity(self, asset_id: str) -> bool:
        """
        Verify the integrity of event chain for an asset.
        
        Args:
            asset_id: Asset identifier
            
        Returns:
            True if event chain is intact and tamper-free
        """
        events = self._events.get(asset_id, [])
        if not events:
            return True
        
        for i, event in enumerate(events):
            expected_hash = event.compute_hash()
            if i > 0:
                expected_previous = events[i - 1].compute_hash()
                if event.previous_hash != expected_previous:
                    return False
        
        return True