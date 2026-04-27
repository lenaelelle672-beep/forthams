"""
Approval Chain Module

Implements the work order approval chain with state machine logic,
version control for optimistic locking, and domain event publishing.

Version: Iteration 8
Specification: SWARM-2025-Q2-P0-003
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
import uuid


class StateEnum(str, Enum):
    """
    Work order states as per SPEC.
    
    Allowed transitions:
        PENDING -> IN_PROGRESS
        IN_PROGRESS -> APPROVED, REJECTED
        APPROVED -> CLOSED
        REJECTED -> PENDING (can be resubmitted)
    """
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class OperationType(str, Enum):
    """Operation types for approval history."""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    SUBMIT = "SUBMIT"
    CLOSE = "CLOSE"


# State transition rules as per SPEC
STATE_TRANSITIONS: Dict[str, List[str]] = {
    StateEnum.PENDING.value: [StateEnum.IN_PROGRESS.value],
    StateEnum.IN_PROGRESS.value: [StateEnum.APPROVED.value, StateEnum.REJECTED.value],
    StateEnum.APPROVED.value: [StateEnum.CLOSED.value],
    StateEnum.REJECTED.value: [StateEnum.PENDING.value],  # Resubmission allowed
    StateEnum.CLOSED.value: [],  # Terminal state
}


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    
    def __init__(self, current_state: str, target_state: str):
        self.current_state = current_state
        self.target_state = target_state
        super().__init__(
            f"Invalid state transition from '{current_state}' to '{target_state}'"
        )


class OptimisticLockError(Exception):
    """Raised when version conflict is detected."""
    
    def __init__(self, expected_version: int, actual_version: int):
        self.expected_version = expected_version
        self.actual_version = actual_version
        super().__init__(
            f"Version conflict: expected {expected_version}, got {actual_version}"
        )


@dataclass
class ApprovalHistory:
    """
    Approval history record as per SPEC.
    
    Attributes:
        id: Unique identifier (UUID)
        work_order_id: Reference to the work order
        operator_id: User who performed the action
        operation: Type of operation (APPROVE/REJECT)
        reason: Approval/rejection reason (optional, max 500 chars)
        created_at: Timestamp of the operation
        is_deleted: Logical delete flag (never physically deleted)
    """
    id: str
    work_order_id: str
    operator_id: str
    operation: OperationType
    reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_deleted: bool = False
    
    def __post_init__(self):
        if self.reason and len(self.reason) > 500:
            raise ValueError("Reason must not exceed 500 characters")
    
    def soft_delete(self) -> None:
        """Mark record as deleted without physical removal per SPEC."""
        self.is_deleted = True


@dataclass
class WorkOrderApprovedEvent:
    """
    Domain event published when a work order is approved.
    Published after successful approval for notification module subscription.
    """
    work_order_id: str
    version: int
    operator_id: str
    reason: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": "WorkOrderApproved",
            "work_order_id": self.work_order_id,
            "version": self.version,
            "operator_id": self.operator_id,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class WorkOrderRejectedEvent:
    """
    Domain event published when a work order is rejected.
    Published after successful rejection for notification module subscription.
    """
    work_order_id: str
    version: int
    operator_id: str
    reason: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": "WorkOrderRejected",
            "work_order_id": self.work_order_id,
            "version": self.version,
            "operator_id": self.operator_id,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
        }


class EventBus:
    """
    Simple event bus for publishing domain events.
    To be integrated with RabbitMQ/Kafka for async notification delivery.
    """
    
    _instance: Optional["EventBus"] = None
    _subscribers: Dict[str, List[callable]] = field(default_factory=dict)
    
    @classmethod
    def get_instance(cls) -> "EventBus":
        """Singleton pattern for event bus."""
        if cls._instance is None:
            cls._instance = EventBus()
        return cls._instance
    
    def subscribe(self, event_type: str, handler: callable) -> None:
        """Subscribe a handler to an event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
    
    def publish(self, event: Any) -> None:
        """Publish an event to all subscribers."""
        event_type = type(event).__name__
        handlers = self._subscribers.get(event_type, [])
        for handler in handlers:
            handler(event)


class ApprovalChainStateMachine:
    """
    State machine engine for work order approval chain.
    
    Implements:
        - State transition validation
        - Version-based optimistic locking
        - Domain event publishing
    
    Per SPEC:
        - Only forward state transitions allowed (PENDING -> IN_PROGRESS -> COMPLETED)
        - Rejection can return to submit state
        - Version number increments on each state change
    """
    
    def __init__(self):
        self._event_bus = EventBus.get_instance()
    
    def can_transition(self, current_state: str, target_state: str) -> bool:
        """
        Check if a state transition is valid.
        
        Args:
            current_state: Current work order state
            target_state: Target state to transition to
            
        Returns:
            True if transition is allowed, False otherwise
        """
        allowed_transitions = STATE_TRANSITIONS.get(current_state, [])
        return target_state in allowed_transitions
    
    def validate_transition(self, current_state: str, target_state: str) -> None:
        """
        Validate a state transition, raising StateTransitionError if invalid.
        
        Args:
            current_state: Current work order state
            target_state: Target state to transition to
            
        Raises:
            StateTransitionError: If transition is not allowed
        """
        if not self.can_transition(current_state, target_state):
            raise StateTransitionError(current_state, target_state)
    
    def transition(
        self,
        current_state: str,
        target_state: str,
        version: int
    ) -> Dict[str, Any]:
        """
        Execute a state transition with validation.
        
        Args:
            current_state: Current work order state
            target_state: Target state to transition to
            version: Current version for optimistic locking
            
        Returns:
            Dictionary with new_state and new_version
            
        Raises:
            StateTransitionError: If transition is not allowed
            OptimisticLockError: If version mismatch (handled at service layer)
        """
        self.validate_transition(current_state, target_state)
        return {
            "new_state": target_state,
            "new_version": version + 1
        }
    
    def publish_approved_event(
        self,
        work_order_id: str,
        version: int,
        operator_id: str,
        reason: Optional[str] = None
    ) -> WorkOrderApprovedEvent:
        """
        Publish WorkOrderApproved event.
        
        Args:
            work_order_id: ID of the approved work order
            version: New version after approval
            operator_id: User who approved
            reason: Optional approval reason
            
        Returns:
            WorkOrderApprovedEvent instance
        """
        event = WorkOrderApprovedEvent(
            work_order_id=work_order_id,
            version=version,
            operator_id=operator_id,
            reason=reason
        )
        self._event_bus.publish(event)
        return event
    
    def publish_rejected_event(
        self,
        work_order_id: str,
        version: int,
        operator_id: str,
        reason: Optional[str] = None
    ) -> WorkOrderRejectedEvent:
        """
        Publish WorkOrderRejected event.
        
        Args:
            work_order_id: ID of the rejected work order
            version: New version after rejection
            operator_id: User who rejected
            reason: Rejection reason
            
        Returns:
            WorkOrderRejectedEvent instance
        """
        event = WorkOrderRejectedEvent(
            work_order_id=work_order_id,
            version=version,
            operator_id=operator_id,
            reason=reason
        )
        self._event_bus.publish(event)
        return event


class WorkOrder:
    """
    Work Order entity with approval chain support.
    
    Per SPEC:
        - States: PENDING, IN_PROGRESS, APPROVED, REJECTED, CLOSED
        - Version field for optimistic locking
        - Relationship to approval history
    
    Attributes:
        id: Work order unique identifier
        title: Work order title
        content: Work order content/details
        state: Current state (StateEnum)
        version: Version number for optimistic locking
        created_by: Creator user ID
        department_id: Department for permission checking
        created_at: Creation timestamp
        updated_at: Last update timestamp
        approval_history: List of approval history records
    """
    
    def __init__(
        self,
        id: str,
        title: str,
        content: str,
        state: StateEnum = StateEnum.PENDING,
        version: int = 1,
        created_by: Optional[str] = None,
        department_id: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        approval_history: Optional[List[ApprovalHistory]] = None
    ):
        self.id = id or str(uuid.uuid4())
        self.title = title
        self.content = content
        self.state = state
        self.version = version
        self.created_by = created_by
        self.department_id = department_id
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
        self.approval_history = approval_history or []
    
    def approve(self, operator_id: str, reason: Optional[str] = None) -> ApprovalHistory:
        """
        Approve this work order.
        
        Args:
            operator_id: User performing the approval
            reason: Optional approval reason
            
        Returns:
            ApprovalHistory record
            
        Raises:
            StateTransitionError: If work order cannot be approved in current state
        """
        state_machine = ApprovalChainStateMachine()
        current_state = self.state.value if isinstance(self.state, StateEnum) else self.state
        target_state = StateEnum.APPROVED.value
        
        state_machine.validate_transition(current_state, target_state)
        
        # Update state and version
        self.state = StateEnum.APPROVED
        self.version += 1
        self.updated_at = datetime.utcnow()
        
        # Create history record
        history = ApprovalHistory(
            id=str(uuid.uuid4()),
            work_order_id=self.id,
            operator_id=operator_id,
            operation=OperationType.APPROVE,
            reason=reason
        )
        self.approval_history.append(history)
        
        # Publish event for notification
        state_machine.publish_approved_event(
            work_order_id=self.id,
            version=self.version,
            operator_id=operator_id,
            reason=reason
        )
        
        return history
    
    def reject(self, operator_id: str, reason: Optional[str] = None) -> ApprovalHistory:
        """
        Reject this work order.
        
        Args:
            operator_id: User performing the rejection
            reason: Rejection reason
            
        Returns:
            ApprovalHistory record
            
        Raises:
            StateTransitionError: If work order cannot be rejected in current state
        """
        state_machine = ApprovalChainStateMachine()
        current_state = self.state.value if isinstance(self.state, StateEnum) else self.state
        target_state = StateEnum.REJECTED.value
        
        state_machine.validate_transition(current_state, target_state)
        
        # Update state and version
        self.state = StateEnum.REJECTED
        self.version += 1
        self.updated_at = datetime.utcnow()
        
        # Create history record
        history = ApprovalHistory(
            id=str(uuid.uuid4()),
            work_order_id=self.id,
            operator_id=operator_id,
            operation=OperationType.REJECT,
            reason=reason
        )
        self.approval_history.append(history)
        
        # Publish event for notification
        state_machine.publish_rejected_event(
            work_order_id=self.id,
            version=self.version,
            operator_id=operator_id,
            reason=reason
        )
        
        return history
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "state": self.state.value if isinstance(self.state, StateEnum) else self.state,
            "version": self.version,
            "created_by": self.created_by,
            "department_id": self.department_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "history": [
                {
                    "id": h.id,
                    "operator_id": h.operator_id,
                    "operation": h.operation.value,
                    "reason": h.reason,
                    "created_at": h.created_at.isoformat()
                }
                for h in self.approval_history if not h.is_deleted
            ]
        }


# Export for use in other modules
__all__ = [
    "StateEnum",
    "OperationType",
    "StateTransitionError",
    "OptimisticLockError",
    "ApprovalHistory",
    "WorkOrderApprovedEvent",
    "WorkOrderRejectedEvent",
    "EventBus",
    "ApprovalChainStateMachine",
    "WorkOrder",
]