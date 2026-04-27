"""
Asset Retirement State Machine Module.

This module implements the retirement state machine for asset lifecycle management.
It handles retirement requests, approval workflow transitions, and history tracking.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class RetirementState(str, Enum):
    """
    Enumeration of possible retirement states for an asset.
    
    Attributes:
        DRAFT: Initial state when retirement request is created.
        PENDING_APPROVAL: Waiting for first level approval.
        APPROVED: Retirement request approved.
        REJECTED: Retirement request rejected.
        CANCELLED: Retirement request cancelled by requester.
        COMPLETED: Retirement process completed, asset disposed.
        ARCHIVED: Retired asset archived after completion.
    """
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class RetirementEvent(str, Enum):
    """
    Enumeration of events that trigger retirement state transitions.
    
    Attributes:
        SUBMIT: Submit retirement request for approval.
        APPROVE: Approve the retirement request.
        REJECT: Reject the retirement request.
        CANCEL: Cancel the retirement request.
        COMPLETE: Mark retirement as complete.
        ARCHIVE: Archive the completed retirement.
        REVISE: Revise and return to draft.
    """
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    CANCEL = "cancel"
    COMPLETE = "complete"
    ARCHIVE = "archive"
    REVISE = "revise"


class TransitionRule:
    """
    Defines a transition rule between retirement states.
    
    Attributes:
        from_state: The source state.
        to_state: The target state.
        event: The trigger event.
        condition: Optional condition function for guard checks.
    """
    
    def __init__(
        self,
        from_state: RetirementState,
        to_state: RetirementState,
        event: RetirementEvent,
        condition: Optional[Callable[[Dict], bool]] = None
    ):
        self.from_state = from_state
        self.to_state = to_state
        self.event = event
        self.condition = condition

    def can_transition(self, context: Dict) -> bool:
        """
        Check if the transition can be executed given the context.
        
        Args:
            context: Dictionary containing transition context data.
            
        Returns:
            True if transition is allowed, False otherwise.
        """
        if self.condition is None:
            return True
        return self.condition(context)


class RetirementStateMachine:
    """
    State machine for managing asset retirement lifecycle.
    
    This class handles state transitions for retirement requests, enforces
    business rules through guards, and tracks history of all transitions.
    
    Attributes:
        current_state: The current retirement state.
        request_id: The identifier of the retirement request.
        history: List of transition records.
    """
    
    # Define valid state transitions
    TRANSITIONS: Dict[RetirementEvent, Dict[RetirementState, RetirementState]] = {
        RetirementEvent.SUBMIT: {
            RetirementState.DRAFT: RetirementState.PENDING_APPROVAL,
        },
        RetirementEvent.APPROVE: {
            RetirementState.PENDING_APPROVAL: RetirementState.APPROVED,
        },
        RetirementEvent.REJECT: {
            RetirementState.PENDING_APPROVAL: RetirementState.REJECTED,
        },
        RetirementEvent.CANCEL: {
            RetirementState.DRAFT: RetirementState.CANCELLED,
            RetirementState.PENDING_APPROVAL: RetirementState.CANCELLED,
        },
        RetirementEvent.COMPLETE: {
            RetirementState.APPROVED: RetirementState.COMPLETED,
        },
        RetirementEvent.ARCHIVE: {
            RetirementState.COMPLETED: RetirementState.ARCHIVED,
        },
        RetirementEvent.REVISE: {
            RetirementState.REJECTED: RetirementState.DRAFT,
        },
    }
    
    # Guard conditions for each transition
    GUARDS: Dict[tuple, Callable[[Dict], bool]] = {}
    
    def __init__(self, request_id: str, initial_state: RetirementState = RetirementState.DRAFT):
        """
        Initialize the retirement state machine.
        
        Args:
            request_id: Unique identifier for the retirement request.
            initial_state: Starting state, defaults to DRAFT.
        """
        self.request_id = request_id
        self.current_state = initial_state
        self.history: List[Dict[str, Any]] = []
        self._record_transition(
            from_state=None,
            to_state=initial_state,
            event=None,
            metadata={"action": "init", "timestamp": datetime.utcnow().isoformat()}
        )
        logger.info(f"RetirementStateMachine initialized for request {request_id} in state {initial_state.value}")

    def _record_transition(
        self,
        from_state: Optional[RetirementState],
        to_state: RetirementState,
        event: Optional[RetirementEvent],
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Record a state transition in the history.
        
        Args:
            from_state: Previous state before transition.
            to_state: New state after transition.
            event: Event that triggered the transition.
            metadata: Additional data about the transition.
        """
        record = {
            "from_state": from_state.value if from_state else None,
            "to_state": to_state.value,
            "event": event.value if event else None,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        self.history.append(record)
        logger.debug(f"Transition recorded: {record}")

    def can_transition(self, event: RetirementEvent) -> bool:
        """
        Check if a transition is valid from the current state.
        
        Args:
            event: The event to check.
            
        Returns:
            True if the transition is valid, False otherwise.
        """
        valid_from_states = self.TRANSITIONS.get(event, {})
        return self.current_state in valid_from_states

    def transition(self, event: RetirementEvent, context: Optional[Dict[str, Any]] = None) -> bool:
        """
        Execute a state transition.
        
        Args:
            event: The event triggering the transition.
            context: Additional context for guard evaluation.
            
        Returns:
            True if transition succeeded, False otherwise.
            
        Raises:
            ValueError: If the transition is invalid from current state.
        """
        context = context or {}
        
        if not self.can_transition(event):
            logger.warning(
                f"Invalid transition: event={event.value} from state={self.current_state.value}"
            )
            return False
        
        # Build guard key
        guard_key = (self.current_state, event)
        
        # Check guard condition if exists
        guard = self.GUARDS.get(guard_key)
        if guard and not guard(context):
            logger.warning(f"Guard condition failed for transition: {guard_key}")
            return False
        
        from_state = self.current_state
        to_state = self.TRANSITIONS[event][from_state]
        
        self.current_state = to_state
        self._record_transition(
            from_state=from_state,
            to_state=to_state,
            event=event,
            metadata=context
        )
        
        logger.info(
            f"State transition successful: request={self.request_id}, "
            f"from={from_state.value}, to={to_state.value}, event={event.value}"
        )
        return True

    def get_state(self) -> RetirementState:
        """
        Get the current retirement state.
        
        Returns:
            The current RetirementState.
        """
        return self.current_state

    def get_history(self) -> List[Dict[str, Any]]:
        """
        Get the complete transition history.
        
        Returns:
            List of transition records, ordered from earliest to latest.
        """
        return self.history.copy()

    def get_timeline(self) -> List[Dict[str, Any]]:
        """
        Get history formatted as timeline.
        
        Returns:
            List of timeline entries with required fields for display.
        """
        return [
            {
                "state": record["to_state"],
                "timestamp": record["timestamp"],
                "event": record["event"],
                "from_state": record["from_state"]
            }
            for record in self.history
        ]

    def validate_transition(self, event: RetirementEvent, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a transition without executing it.
        
        Args:
            event: The event to validate.
            context: Context for validation.
            
        Returns:
            Dictionary with 'valid' boolean and optional 'reason' string.
        """
        if not self.can_transition(event):
            return {
                "valid": False,
                "reason": f"Cannot transition from {self.current_state.value} with event {event.value}"
            }
        
        guard_key = (self.current_state, event)
        guard = self.GUARDS.get(guard_key)
        if guard and not guard(context):
            return {
                "valid": False,
                "reason": "Guard condition not satisfied"
            }
        
        return {"valid": True}

    def reset(self, new_state: RetirementState = RetirementState.DRAFT) -> None:
        """
        Reset the state machine to a new state.
        
        Args:
            new_state: The state to reset to, defaults to DRAFT.
        """
        old_state = self.current_state
        self.current_state = new_state
        self._record_transition(
            from_state=old_state,
            to_state=new_state,
            event=None,
            metadata={"action": "reset", "timestamp": datetime.utcnow().isoformat()}
        )
        logger.info(f"State machine reset from {old_state.value} to {new_state.value}")


class RetirementStateMachineBuilder:
    """
    Builder for constructing retirement state machines with custom rules.
    
    This class provides a fluent interface for configuring state machine
    behavior including custom guards, transition rules, and initial states.
    """
    
    def __init__(self, request_id: str):
        """
        Initialize the builder with a request ID.
        
        Args:
            request_id: Unique identifier for the retirement request.
        """
        self.request_id = request_id
        self.initial_state = RetirementState.DRAFT
        self.custom_guards: Dict[tuple, Callable[[Dict], bool]] = {}
        self.custom_transitions: Dict[RetirementEvent, Dict[RetirementState, RetirementState]] = {}
        self.initial_context: Dict[str, Any] = {}
    
    def with_initial_state(self, state: RetirementState) -> "RetirementStateMachineBuilder":
        """
        Set the initial state for the state machine.
        
        Args:
            state: The initial state to use.
            
        Returns:
            Self for method chaining.
        """
        self.initial_state = state
        return self
    
    def with_guard(
        self,
        from_state: RetirementState,
        event: RetirementEvent,
        guard: Callable[[Dict], bool]
    ) -> "RetirementStateMachineBuilder":
        """
        Add a guard condition for a specific transition.
        
        Args:
            from_state: The source state for the transition.
            event: The event triggering the transition.
            guard: Function that returns True if transition is allowed.
            
        Returns:
            Self for method chaining.
        """
        self.custom_guards[(from_state, event)] = guard
        return self
    
    def with_custom_transition(
        self,
        event: RetirementEvent,
        from_state: RetirementState,
        to_state: RetirementState
    ) -> "RetirementStateMachineBuilder":
        """
        Add a custom transition rule.
        
        Args:
            event: The event for the transition.
            from_state: The source state.
            to_state: The target state.
            
        Returns:
            Self for method chaining.
        """
        if event not in self.custom_transitions:
            self.custom_transitions[event] = {}
        self.custom_transitions[event][from_state] = to_state
        return self
    
    def with_context(self, context: Dict[str, Any]) -> "RetirementStateMachineBuilder":
        """
        Set initial context data for the state machine.
        
        Args:
            context: Dictionary of context data.
            
        Returns:
            Self for method chaining.
        """
        self.initial_context = context
        return self
    
    def build(self) -> RetirementStateMachine:
        """
        Build and return the configured state machine.
        
        Returns:
            Configured RetirementStateMachine instance.
        """
        sm = RetirementStateMachine(self.request_id, self.initial_state)
        
        # Apply custom guards
        for (from_state, event), guard in self.custom_guards.items():
            RetirementStateMachine.GUARDS[(from_state, event)] = guard
        
        # Apply custom transitions
        for event, transitions in self.custom_transitions.items():
            if event not in RetirementStateMachine.TRANSITIONS:
                RetirementStateMachine.TRANSITIONS[event] = {}
            RetirementStateMachine.TRANSITIONS[event].update(transitions)
        
        # Restore custom guards for future machines
        for (from_state, event), guard in self.custom_guards.items():
            RetirementStateMachine.GUARDS[(from_state, event)] = guard
        
        return sm


def create_retirement_state_machine(
    request_id: str,
    initial_state: RetirementState = RetirementState.DRAFT
) -> RetirementStateMachine:
    """
    Factory function to create a retirement state machine.
    
    Args:
        request_id: Unique identifier for the retirement request.
        initial_state: Starting state, defaults to DRAFT.
        
    Returns:
        New RetirementStateMachine instance.
    """
    return RetirementStateMachine(request_id, initial_state)