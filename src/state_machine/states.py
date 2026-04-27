"""
Work Order State Machine States

Defines the states for work order lifecycle management in the asset management system.
Supports the approval workflow: Created -> Pending Approval -> Approved/Rejected -> Closed

@module states
@category state_machine
"""

from enum import Enum
from typing import Set


class WorkOrderState(str, Enum):
    """
    Enumeration of possible work order states.
    
    States:
        CREATED: Initial state when work order is created
        PENDING_APPROVAL: Awaiting approver decision
        APPROVED: Work order has been approved
        REJECTED: Work order has been rejected
        CLOSED: Work order is closed (final state)
    """
    
    CREATED = "created"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"
    
    def __str__(self) -> str:
        return self.value


class WorkOrderEvent(str, Enum):
    """
    Enumeration of events that trigger state transitions.
    
    Events:
        SUBMIT: Submit work order for approval
        APPROVE: Approve the work order
        REJECT: Reject the work order
        CLOSE: Close the work order
    """
    
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    CLOSE = "close"


# Terminal states that cannot transition further
TERMINAL_STATES: Set[WorkOrderState] = {
    WorkOrderState.CLOSED,
}

# States that allow approval/rejection actions
ACTIONABLE_STATES: Set[WorkOrderState] = {
    WorkOrderState.PENDING_APPROVAL,
}


def is_terminal_state(state: WorkOrderState) -> bool:
    """
    Check if the given state is a terminal state.
    
    Args:
        state: The work order state to check
        
    Returns:
        True if the state is terminal, False otherwise
    """
    return state in TERMINAL_STATES


def is_actionable_state(state: WorkOrderState) -> bool:
    """
    Check if the given state allows approval/rejection actions.
    
    Args:
        state: The work order state to check
        
    Returns:
        True if the state allows actions, False otherwise
    """
    return state in ACTIONABLE_STATES


def can_approve(state: WorkOrderState) -> bool:
    """
    Check if the work order in the given state can be approved.
    
    Args:
        state: Current work order state
        
    Returns:
        True if approval action is allowed
    """
    return state == WorkOrderState.PENDING_APPROVAL


def can_reject(state: WorkOrderState) -> bool:
    """
    Check if the work order in the given state can be rejected.
    
    Args:
        state: Current work order state
        
    Returns:
        True if rejection action is allowed
    """
    return state == WorkOrderState.PENDING_APPROVAL


def get_valid_transitions(state: WorkOrderState) -> Set[WorkOrderEvent]:
    """
    Get valid events that can be triggered from the given state.
    
    Args:
        state: Current work order state
        
    Returns:
        Set of valid events for the current state
    """
    transitions = {
        WorkOrderState.CREATED: {WorkOrderEvent.SUBMIT},
        WorkOrderState.PENDING_APPROVAL: {WorkOrderEvent.APPROVE, WorkOrderEvent.REJECT},
        WorkOrderState.APPROVED: {WorkOrderEvent.CLOSE},
        WorkOrderState.REJECTED: {WorkOrderEvent.CLOSE},
        WorkOrderState.CLOSED: set(),
    }
    return transitions.get(state, set())


def get_next_state(current_state: WorkOrderState, event: WorkOrderEvent) -> WorkOrderState | None:
    """
    Determine the next state based on current state and event.
    
    Args:
        current_state: Current work order state
        event: Triggering event
        
    Returns:
        Next state if transition is valid, None otherwise
    """
    transition_map = {
        (WorkOrderState.CREATED, WorkOrderEvent.SUBMIT): WorkOrderState.PENDING_APPROVAL,
        (WorkOrderState.PENDING_APPROVAL, WorkOrderEvent.APPROVE): WorkOrderState.APPROVED,
        (WorkOrderState.PENDING_APPROVAL, WorkOrderEvent.REJECT): WorkOrderState.REJECTED,
        (WorkOrderState.APPROVED, WorkOrderEvent.CLOSE): WorkOrderState.CLOSED,
        (WorkOrderState.REJECTED, WorkOrderEvent.CLOSE): WorkOrderState.CLOSED,
    }
    return transition_map.get((current_state, event))