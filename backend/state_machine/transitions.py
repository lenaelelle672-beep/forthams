"""
Work Order State Transition Rules.

This module defines the state machine transitions for work order approval workflow.
Implements the core state transition logic for SWARM-501 work order approval flow.

State Lifecycle:
    DRAFT → PENDING_APPROVAL → APPROVING → APPROVED/REJECTED → ARCHIVED

Transitions:
    - submit: DRAFT → PENDING_APPROVAL
    - start_approval: PENDING_APPROVAL → APPROVING
    - approve: APPROVING → APPROVED
    - reject: APPROVING → REJECTED
    - archive: APPROVED → ARCHIVED
"""

from enum import Enum
from typing import Dict, List, Optional, Set

from src.domain.entities.work_order import WorkOrderStatus


class TransitionType(str, Enum):
    """Enumeration of valid state transition types."""
    SUBMIT = "submit"
    START_APPROVAL = "start_approval"
    APPROVE = "approve"
    REJECT = "reject"
    ARCHIVE = "archive"


# Define valid state transitions as a mapping from current status to allowed transitions
VALID_TRANSITIONS: Dict[WorkOrderStatus, Set[TransitionType]] = {
    WorkOrderStatus.DRAFT: {TransitionType.SUBMIT},
    WorkOrderStatus.PENDING_APPROVAL: {TransitionType.START_APPROVAL},
    WorkOrderStatus.APPROVING: {TransitionType.APPROVE, TransitionType.REJECT},
    WorkOrderStatus.APPROVED: {TransitionType.ARCHIVE},
    WorkOrderStatus.REJECTED: set(),  # Terminal state - no transitions allowed
    WorkOrderStatus.ARCHIVED: set(),  # Terminal state - no transitions allowed
}

# Define target status for each transition type
TRANSITION_TARGETS: Dict[TransitionType, WorkOrderStatus] = {
    TransitionType.SUBMIT: WorkOrderStatus.PENDING_APPROVAL,
    TransitionType.START_APPROVAL: WorkOrderStatus.APPROVING,
    TransitionType.APPROVE: WorkOrderStatus.APPROVED,
    TransitionType.REJECT: WorkOrderStatus.REJECTED,
    TransitionType.ARCHIVE: WorkOrderStatus.ARCHIVED,
}


class InvalidStateTransitionError(Exception):
    """
    Exception raised when an illegal state transition is attempted.
    
    Attributes:
        current_status: The current status of the work order.
        attempted_transition: The transition type that was attempted.
        allowed_transitions: Set of transitions that are valid from current status.
    """
    
    def __init__(
        self,
        current_status: WorkOrderStatus,
        attempted_transition: TransitionType,
        allowed_transitions: Optional[Set[TransitionType]] = None
    ):
        self.current_status = current_status
        self.attempted_transition = attempted_transition
        self.allowed_transitions = allowed_transitions or set()
        
        allowed_str = ", ".join(t.value for t in self.allowed_transitions) or "none"
        message = (
            f"Invalid state transition: cannot perform '{attempted_transition.value}' "
            f"from status '{current_status.value}'. "
            f"Allowed transitions: {allowed_str}"
        )
        super().__init__(message)


def get_allowed_transitions(current_status: WorkOrderStatus) -> Set[TransitionType]:
    """
    Get the set of allowed transition types for a given status.
    
    Args:
        current_status: The current status of the work order.
        
    Returns:
        Set of TransitionType values that are valid from the current status.
    """
    return VALID_TRANSITIONS.get(current_status, set()).copy()


def can_transition(current_status: WorkOrderStatus, transition: TransitionType) -> bool:
    """
    Check if a transition is valid from the current status.
    
    Args:
        current_status: The current status of the work order.
        transition: The transition type to check.
        
    Returns:
        True if the transition is valid, False otherwise.
    """
    allowed = VALID_TRANSITIONS.get(current_status, set())
    return transition in allowed


def get_next_status(
    current_status: WorkOrderStatus,
    transition: TransitionType
) -> WorkOrderStatus:
    """
    Get the next status after performing a transition.
    
    Args:
        current_status: The current status of the work order.
        transition: The transition type to perform.
        
    Returns:
        The resulting status after the transition.
        
    Raises:
        InvalidStateTransitionError: If the transition is not valid.
    """
    if not can_transition(current_status, transition):
        allowed = get_allowed_transitions(current_status)
        raise InvalidStateTransitionError(
            current_status=current_status,
            attempted_transition=transition,
            allowed_transitions=allowed
        )
    
    return TRANSITION_TARGETS[transition]


def validate_transition(
    current_status: WorkOrderStatus,
    transition: TransitionType
) -> None:
    """
    Validate a state transition, raising an exception if invalid.
    
    Args:
        current_status: The current status of the work order.
        transition: The transition type to validate.
        
    Raises:
        InvalidStateTransitionError: If the transition is not valid.
    """
    if not can_transition(current_status, transition):
        allowed = get_allowed_transitions(current_status)
        raise InvalidStateTransitionError(
            current_status=current_status,
            attempted_transition=transition,
            allowed_transitions=allowed
        )


def get_transition_chain(
    from_status: WorkOrderStatus,
    to_status: WorkOrderStatus
) -> List[TransitionType]:
    """
    Get the sequence of transitions needed to go from one status to another.
    
    Args:
        from_status: The starting status.
        to_status: The target status.
        
    Returns:
        List of TransitionType values that form a valid path.
        Returns empty list if no path exists or if from_status equals to_status.
    """
    if from_status == to_status:
        return []
    
    # Direct single-step transitions
    for transition, target in TRANSITION_TARGETS.items():
        if from_status == WorkOrderStatus.DRAFT and target == WorkOrderStatus.PENDING_APPROVAL:
            continue  # Skip to allow more specific handling
    
    # Build transition path using BFS-like approach
    path: List[TransitionType] = []
    current = from_status
    
    # Attempt direct path through valid transitions
    while current != to_status:
        found_next = False
        
        for transition, target in TRANSITION_TARGETS.items():
            if can_transition(current, transition) and target == to_status:
                path.append(transition)
                found_next = True
                break
        
        if not found_next:
            # Try to find any valid next step toward target
            if current == WorkOrderStatus.DRAFT and to_status == WorkOrderStatus.PENDING_APPROVAL:
                path.append(TransitionType.SUBMIT)
                break
            elif current == WorkOrderStatus.PENDING_APPROVAL and to_status == WorkOrderStatus.APPROVING:
                path.append(TransitionType.START_APPROVAL)
                break
            elif current == WorkOrderStatus.APPROVING and to_status in [WorkOrderStatus.APPROVED, WorkOrderStatus.REJECTED]:
                path.append(TransitionType.APPROVE if to_status == WorkOrderStatus.APPROVED else TransitionType.REJECT)
                break
            elif current == WorkOrderStatus.APPROVED and to_status == WorkOrderStatus.ARCHIVED:
                path.append(TransitionType.ARCHIVE)
                break
            else:
                # No valid path found
                break
            found_next = True
        
        if not found_next:
            break
    
    return path


def is_terminal_status(status: WorkOrderStatus) -> bool:
    """
    Check if a status is a terminal (final) state.
    
    Args:
        status: The status to check.
        
    Returns:
        True if the status is terminal, False otherwise.
    """
    return status in [WorkOrderStatus.REJECTED, WorkOrderStatus.ARCHIVED]


def is_approvable_status(status: WorkOrderStatus) -> bool:
    """
    Check if a work order in the given status can be approved or rejected.
    
    Args:
        status: The status to check.
        
    Returns:
        True if the status allows approval actions, False otherwise.
    """
    return status == WorkOrderStatus.APPROVING


def is_editable_status(status: WorkOrderStatus) -> bool:
    """
    Check if a work order in the given status can be edited.
    
    Args:
        status: The status to check.
        
    Returns:
        True if the work order is editable, False otherwise.
    """
    return status == WorkOrderStatus.DRAFT


def get_status_description(status: WorkOrderStatus) -> str:
    """
    Get a human-readable description of a status.
    
    Args:
        status: The status to describe.
        
    Returns:
        A string description of the status.
    """
    descriptions = {
        WorkOrderStatus.DRAFT: "Draft - Work order is being prepared",
        WorkOrderStatus.PENDING_APPROVAL: "Pending Approval - Waiting for approval to start",
        WorkOrderStatus.APPROVING: "Under Approval - Currently being reviewed by approver",
        WorkOrderStatus.APPROVED: "Approved - Work order has been approved",
        WorkOrderStatus.REJECTED: "Rejected - Work order has been rejected",
        WorkOrderStatus.ARCHIVED: "Archived - Work order is archived",
    }
    return descriptions.get(status, "Unknown status")


def get_transition_description(transition: TransitionType) -> str:
    """
    Get a human-readable description of a transition.
    
    Args:
        transition: The transition to describe.
        
    Returns:
        A string description of the transition.
    """
    descriptions = {
        TransitionType.SUBMIT: "Submit for approval",
        TransitionType.START_APPROVAL: "Start approval review",
        TransitionType.APPROVE: "Approve work order",
        TransitionType.REJECT: "Reject work order",
        TransitionType.ARCHIVE: "Archive work order",
    }
    return descriptions.get(transition, "Unknown transition")