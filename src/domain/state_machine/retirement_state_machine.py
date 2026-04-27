"""
Retirement State Machine Module.

This module implements the state machine for handling asset retirement workflow
as part of SWARM-2025-Q2-P0-001 (Iteration 2).

State Transitions:
    DRAFT -> PENDING_APPROVAL -> APPROVED/REJECTED

@iteration: 2
@acceptance_criteria: AC-001, AC-002, AC-005
"""

from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import uuid


class RetirementState(Enum):
    """Enum values for retirement state machine states."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

    def __str__(self) -> str:
        return self.value


class RetirementEvent(Enum):
    """Enum values for retirement state machine events/triggers."""
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    CANCEL = "cancel"
    RESUBMIT = "resubmit"

    def __str__(self) -> str:
        return self.value


@dataclass
class StateTransition:
    """Represents a state transition with metadata."""
    from_state: RetirementState
    to_state: RetirementState
    event: RetirementEvent
    timestamp: datetime = field(default_factory=datetime.utcnow)
    actor_id: Optional[str] = None
    comment: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert transition to dictionary representation."""
        return {
            "from_state": self.from_state.value,
            "to_state": self.to_state.value,
            "event": self.event.value,
            "timestamp": self.timestamp.isoformat(),
            "actor_id": self.actor_id,
            "comment": self.comment
        }


@dataclass
class RetirementContext:
    """
    Context object holding retirement request data and state machine state.
    
    Attributes:
        request_id: Unique identifier for the retirement request
        asset_id: Reference to the asset being retired
        applicant_id: User who initiated the retirement request
        approver_id: User who will approve/reject the request
        current_state: Current state in the state machine
        state_history: List of all state transitions
    """
    request_id: str
    asset_id: str
    applicant_id: str
    approver_id: str
    current_state: RetirementState = RetirementState.DRAFT
    state_history: List[StateTransition] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_transition(self, transition: StateTransition) -> None:
        """Add a state transition to history."""
        self.state_history.append(transition)
        self.current_state = transition.to_state

    def can_transition(self, event: RetirementEvent) -> bool:
        """Check if a given event can trigger a valid transition."""
        return event in self._get_available_events()

    def _get_available_events(self) -> List[RetirementEvent]:
        """Get list of events available from current state."""
        return TRANSITION_MAP.get(self.current_state, [])


# State transition rules: current_state -> [allowed_events]
TRANSITION_MAP: Dict[RetirementState, List[RetirementEvent]] = {
    RetirementState.DRAFT: [RetirementEvent.SUBMIT],
    RetirementState.PENDING_APPROVAL: [RetirementEvent.APPROVE, RetirementEvent.REJECT, RetirementEvent.CANCEL],
    RetirementState.APPROVED: [],
    RetirementState.REJECTED: [RetirementEvent.RESUBMIT, RetirementEvent.CANCEL],
    RetirementState.CANCELLED: []
}


# Guard conditions for state transitions
class TransitionGuard:
    """Guard conditions for state transitions."""
    
    @staticmethod
    def can_submit(context: RetirementContext) -> bool:
        """
        Validate that retirement request can be submitted.
        
        Args:
            context: Retirement context object
            
        Returns:
            True if submission is allowed
        """
        return (
            context.current_state == RetirementState.DRAFT
            and context.asset_id is not None
            and context.applicant_id is not None
            and context.approver_id is not None
        )

    @staticmethod
    def can_approve(context: RetirementContext, actor_id: str) -> bool:
        """
        Validate that approval is allowed.
        
        Args:
            context: Retirement context object
            actor_id: ID of the user attempting to approve
            
        Returns:
            True if approval is allowed
        """
        return (
            context.current_state == RetirementState.PENDING_APPROVAL
            and actor_id == context.approver_id
        )

    @staticmethod
    def can_reject(context: RetirementContext, actor_id: str) -> bool:
        """
        Validate that rejection is allowed.
        
        Args:
            context: Retirement context object
            actor_id: ID of the user attempting to reject
            
        Returns:
            True if rejection is allowed
        """
        return (
            context.current_state == RetirementState.PENDING_APPROVAL
            and actor_id == context.approver_id
        )

    @staticmethod
    def can_resubmit(context: RetirementContext, actor_id: str) -> bool:
        """
        Validate that resubmission is allowed after rejection.
        
        Args:
            context: Retirement context object
            actor_id: ID of the user attempting to resubmit
            
        Returns:
            True if resubmission is allowed
        """
        return (
            context.current_state == RetirementState.REJECTED
            and actor_id == context.applicant_id
        )


class StateTransitionError(Exception):
    """Exception raised when an invalid state transition is attempted."""
    
    def __init__(self, current_state: RetirementState, event: RetirementEvent, message: str = ""):
        self.current_state = current_state
        self.event = event
        self.message = message or f"Cannot transition from {current_state.value} via {event.value}"
        super().__init__(self.message)


class RetirementStateMachine:
    """
    State machine for handling asset retirement workflow.
    
    This class manages state transitions for retirement requests and ensures
    that all transitions follow the defined business rules.
    
    Example:
        >>> machine = RetirementStateMachine()
        >>> context = machine.create_context("req-001", "asset-123", "user-1", "user-2")
        >>> machine.trigger(context, RetirementEvent.SUBMIT, "user-1")
        >>> print(context.current_state)  # RetirementState.PENDING_APPROVAL
    """
    
    def __init__(
        self,
        notification_handler: Optional[Callable[[RetirementContext, RetirementState], None]] = None
    ):
        """
        Initialize the retirement state machine.
        
        Args:
            notification_handler: Optional callback for state change notifications
        """
        self._notification_handler = notification_handler

    def create_context(
        self,
        request_id: str,
        asset_id: str,
        applicant_id: str,
        approver_id: str,
        initial_state: RetirementState = RetirementState.DRAFT
    ) -> RetirementContext:
        """
        Create a new retirement context with initial state.
        
        Args:
            request_id: Unique identifier for the request
            asset_id: ID of the asset to retire
            applicant_id: ID of the user creating the request
            approver_id: ID of the designated approver
            initial_state: Starting state (default: DRAFT)
            
        Returns:
            New RetirementContext instance
        """
        return RetirementContext(
            request_id=request_id,
            asset_id=asset_id,
            applicant_id=applicant_id,
            approver_id=approver_id,
            current_state=initial_state
        )

    def trigger(
        self,
        context: RetirementContext,
        event: RetirementEvent,
        actor_id: Optional[str] = None,
        comment: Optional[str] = None
    ) -> RetirementContext:
        """
        Trigger a state transition based on the given event.
        
        Args:
            context: Current retirement context
            event: Event triggering the transition
            actor_id: ID of user triggering the event
            comment: Optional comment for the transition
            
        Returns:
            Updated context with new state
            
        Raises:
            StateTransitionError: If transition is not allowed
        """
        # Validate transition is allowed
        if not self._validate_transition(context, event, actor_id):
            raise StateTransitionError(context.current_state, event)
        
        # Compute next state
        next_state = self._compute_next_state(context.current_state, event)
        
        # Create transition record
        transition = StateTransition(
            from_state=context.current_state,
            to_state=next_state,
            event=event,
            actor_id=actor_id,
            comment=comment,
            timestamp=datetime.utcnow()
        )
        
        # Update context
        context.add_transition(transition)
        
        # Trigger notification if handler configured
        if self._notification_handler:
            self._notification_handler(context, next_state)
        
        return context

    def _validate_transition(
        self,
        context: RetirementContext,
        event: RetirementEvent,
        actor_id: Optional[str]
    ) -> bool:
        """Validate if a transition is allowed based on guards."""
        state = context.current_state
        
        # Check if event is allowed from current state
        if event not in TRANSITION_MAP.get(state, []):
            return False
        
        # Apply guard conditions
        if event == RetirementEvent.SUBMIT:
            return TransitionGuard.can_submit(context)
        elif event == RetirementEvent.APPROVE and actor_id:
            return TransitionGuard.can_approve(context, actor_id)
        elif event == RetirementEvent.REJECT and actor_id:
            return TransitionGuard.can_reject(context, actor_id)
        elif event == RetirementEvent.RESUBMIT and actor_id:
            return TransitionGuard.can_resubmit(context, actor_id)
        
        return True

    def _compute_next_state(
        self,
        current: RetirementState,
        event: RetirementEvent
    ) -> RetirementState:
        """Compute the next state based on current state and event."""
        transition_rules: Dict[tuple, RetirementState] = {
            (RetirementState.DRAFT, RetirementEvent.SUBMIT): RetirementState.PENDING_APPROVAL,
            (RetirementState.PENDING_APPROVAL, RetirementEvent.APPROVE): RetirementState.APPROVED,
            (RetirementState.PENDING_APPROVAL, RetirementEvent.REJECT): RetirementState.REJECTED,
            (RetirementState.PENDING_APPROVAL, RetirementEvent.CANCEL): RetirementState.CANCELLED,
            (RetirementState.REJECTED, RetirementEvent.RESUBMIT): RetirementState.PENDING_APPROVAL,
            (RetirementState.REJECTED, RetirementEvent.CANCEL): RetirementState.CANCELLED,
        }
        
        return transition_rules.get((current, event), current)

    def get_available_events(self, context: RetirementContext) -> List[RetirementEvent]:
        """
        Get list of events that can be triggered from current state.
        
        Args:
            context: Current retirement context
            
        Returns:
            List of available events
        """
        return TRANSITION_MAP.get(context.current_state, [])

    def get_state_history(
        self,
        context: RetirementContext
    ) -> List[Dict[str, Any]]:
        """
        Get formatted state transition history.
        
        Args:
            context: Retirement context
            
        Returns:
            List of transition dictionaries
        """
        return [t.to_dict() for t in context.state_history]