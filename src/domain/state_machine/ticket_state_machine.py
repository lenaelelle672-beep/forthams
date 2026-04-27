"""
Ticket State Machine Module

This module implements the state machine for ticket approval workflow
based on SPEC-SWARM-2025-Q2-P0-003-v3.

State Transition Matrix:
    状态        → 批准      → 拒绝      → 驳回      → 完成
    ---------------------------------------------------------
    待审批       → 处理中    → 已拒绝    → [不可操作] → [不可操作]
    处理中       → [禁止]   → [禁止]    → 待审批     → 已完成
    已拒绝       → [禁止]   → [禁止]    → [禁止]    → [禁止]
    已完成       → [禁止]   → [禁止]    → [禁止]    → [禁止]

Usage:
    from src.domain.state_machine.ticket_state_machine import TicketStateMachine, TicketState, TicketEvent

    sm = TicketStateMachine(initial_state=TicketState.PENDING_APPROVAL)
    sm.trigger(TicketEvent.APPROVE)
    print(sm.current_state)  # TicketState.PROCESSING
"""

from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import threading


class TicketState(Enum):
    """
    Ticket status enumeration.

    States:
        - PENDING_APPROVAL: 待审批
        - PROCESSING: 处理中
        - REJECTED: 已拒绝
        - COMPLETED: 已完成
    """
    PENDING_APPROVAL = "待审批"
    PROCESSING = "处理中"
    REJECTED = "已拒绝"
    COMPLETED = "已完成"

    @classmethod
    def from_string(cls, value: str) -> "TicketState":
        """Convert string to TicketState enum value."""
        state_map = {
            "待审批": cls.PENDING_APPROVAL,
            "处理中": cls.PROCESSING,
            "已拒绝": cls.REJECTED,
            "已完成": cls.COMPLETED,
        }
        return state_map.get(value, cls.PENDING_APPROVAL)


class TicketEvent(Enum):
    """
    Ticket state transition events.

    Events:
        - APPROVE: 批准操作
        - REJECT: 拒绝操作
        - RETURN: 驳回操作
        - COMPLETE: 完成操作
    """
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"
    COMPLETE = "complete"


@dataclass
class StateTransitionLog:
    """
    State transition log entry for audit trail.

    Attributes:
        before_status: Previous state before transition
        after_status: New state after transition
        operator_id: ID of the operator who triggered the transition
        timestamp: Time when the transition occurred
        event: The event that triggered the transition
        metadata: Additional metadata for the transition
    """
    before_status: TicketState
    after_status: TicketState
    operator_id: str
    timestamp: datetime = field(default_factory=datetime.now)
    event: TicketEvent = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert log entry to dictionary format."""
        return {
            "before_status": self.before_status.value,
            "after_status": self.after_status.value,
            "operator_id": self.operator_id,
            "timestamp": self.timestamp.isoformat(),
            "event": self.event.value if self.event else None,
            "metadata": self.metadata,
        }


@dataclass
class StateTransitionError(Exception):
    """
    Exception raised when an invalid state transition is attempted.

    Attributes:
        current_state: Current state of the ticket
        attempted_event: The event that was attempted
        message: Error message
    """
    current_state: TicketState
    attempted_event: TicketEvent
    message: str

    def __str__(self) -> str:
        return f"Invalid transition: cannot trigger '{self.attempted_event.value}' " \
               f"from state '{self.current_state.value}'"


class TicketStateMachine:
    """
    State machine for ticket approval workflow.

    This class implements the state machine pattern for managing ticket
    lifecycle transitions based on SPEC-SWARM-2025-Q2-P0-003-v3.

    State Transition Matrix:
        状态        → 批准      → 拒绝      → 驳回      → 完成
        ---------------------------------------------------------
        待审批       → 处理中    → 已拒绝    → [不可操作] → [不可操作]
        处理中       → [禁止]   → [禁止]    → 待审批     → 已完成
        已拒绝       → [禁止]   → [禁止]    → [禁止]    → [禁止]
        已完成       → [禁止]   → [禁止]    → [禁止]    → [禁止]

    Example:
        >>> sm = TicketStateMachine(initial_state=TicketState.PENDING_APPROVAL)
        >>> sm.trigger(TicketEvent.APPROVE, operator_id="user123")
        >>> print(sm.current_state)  # TicketState.PROCESSING
    """

    # State transition matrix defining valid transitions
    TRANSITIONS: Dict[TicketState, Dict[TicketEvent, TicketState]] = {
        TicketState.PENDING_APPROVAL: {
            TicketEvent.APPROVE: TicketState.PROCESSING,
            TicketEvent.REJECT: TicketState.REJECTED,
        },
        TicketState.PROCESSING: {
            TicketEvent.RETURN: TicketState.PENDING_APPROVAL,
            TicketEvent.COMPLETE: TicketState.COMPLETED,
        },
        TicketState.REJECTED: {},  # No transitions allowed
        TicketState.COMPLETED: {},  # No transitions allowed
    }

    def __init__(
        self,
        initial_state: TicketState = TicketState.PENDING_APPROVAL,
        ticket_id: Optional[str] = None,
    ) -> None:
        """
        Initialize the ticket state machine.

        Args:
            initial_state: Initial state for the state machine
            ticket_id: Optional ticket identifier
        """
        self._current_state = initial_state
        self._ticket_id = ticket_id
        self._transition_logs: List[StateTransitionLog] = []
        self._version: int = 0  # Optimistic lock version
        self._lock = threading.RLock()
        self._transition_callbacks: List[Callable[[TicketState, TicketEvent, TicketState], None]] = []

    @property
    def current_state(self) -> TicketState:
        """Get current state of the state machine."""
        return self._current_state

    @property
    def ticket_id(self) -> Optional[str]:
        """Get ticket identifier."""
        return self._ticket_id

    @property
    def version(self) -> int:
        """Get current version for optimistic locking."""
        return self._version

    @property
    def transition_logs(self) -> List[StateTransitionLog]:
        """Get all transition logs."""
        return self._transition_logs.copy()

    def can_transition(self, event: TicketEvent) -> bool:
        """
        Check if a transition is valid from current state.

        Args:
            event: The event to check

        Returns:
            True if the transition is valid, False otherwise
        """
        with self._lock:
            return event in self.TRANSITIONS.get(self._current_state, {})

    def get_allowed_events(self) -> List[TicketEvent]:
        """
        Get list of allowed events from current state.

        Returns:
            List of events that can be triggered from current state
        """
        with self._lock:
            return list(self.TRANSITIONS.get(self._current_state, {}).keys())

    def trigger(
        self,
        event: TicketEvent,
        operator_id: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TicketState:
        """
        Trigger a state transition.

        Args:
            event: The event to trigger
            operator_id: ID of the operator triggering the event
            metadata: Optional metadata for the transition

        Returns:
            The new state after transition

        Raises:
            StateTransitionError: If the transition is not allowed
        """
        with self._lock:
            if not self.can_transition(event):
                raise StateTransitionError(
                    current_state=self._current_state,
                    attempted_event=event,
                    message=f"Cannot transition from '{self._current_state.value}' "
                            f"via event '{event.value}'",
                )

            old_state = self._current_state
            new_state = self.TRANSITIONS[self._current_state][event]

            # Create transition log
            log_entry = StateTransitionLog(
                before_status=old_state,
                after_status=new_state,
                operator_id=operator_id,
                event=event,
                metadata=metadata or {},
            )
            self._transition_logs.append(log_entry)

            # Update state and version
            self._current_state = new_state
            self._version += 1

            # Notify callbacks
            self._notify_transition(old_state, event, new_state)

            return new_state

    def approve(self, operator_id: str = "system", metadata: Optional[Dict[str, Any]] = None) -> TicketState:
        """
        Approve the ticket (transition to PROCESSING state).

        Args:
            operator_id: ID of the approver
            metadata: Optional metadata for the transition

        Returns:
            The new state after approval

        Raises:
            StateTransitionError: If approval is not allowed from current state
        """
        return self.trigger(TicketEvent.APPROVE, operator_id, metadata)

    def reject(self, operator_id: str = "system", metadata: Optional[Dict[str, Any]] = None) -> TicketState:
        """
        Reject the ticket (transition to REJECTED state).

        Args:
            operator_id: ID of the rejector
            metadata: Optional metadata containing rejection reason

        Returns:
            The new state after rejection

        Raises:
            StateTransitionError: If rejection is not allowed from current state
        """
        rejection_metadata = metadata or {}
        rejection_metadata["action"] = "reject"
        return self.trigger(TicketEvent.REJECT, operator_id, rejection_metadata)

    def return_for_revision(self, operator_id: str = "system", metadata: Optional[Dict[str, Any]] = None) -> TicketState:
        """
        Return the ticket for revision (transition back to PENDING_APPROVAL).

        Args:
            operator_id: ID of the operator returning the ticket
            metadata: Optional metadata for the transition

        Returns:
            The new state after returning

        Raises:
            StateTransitionError: If return is not allowed from current state
        """
        return_metadata = metadata or {}
        return_metadata["action"] = "return"
        return self.trigger(TicketEvent.RETURN, operator_id, return_metadata)

    def complete(self, operator_id: str = "system", metadata: Optional[Dict[str, Any]] = None) -> TicketState:
        """
        Complete the ticket (transition to COMPLETED state).

        Args:
            operator_id: ID of the operator completing the ticket
            metadata: Optional metadata for the transition

        Returns:
            The new state after completion

        Raises:
            StateTransitionError: If completion is not allowed from current state
        """
        return self.trigger(TicketEvent.COMPLETE, operator_id, metadata)

    def register_callback(
        self,
        callback: Callable[[TicketState, TicketEvent, TicketState], None]
    ) -> None:
        """
        Register a callback to be notified on state transitions.

        Args:
            callback: Function to call on transition
        """
        self._transition_callbacks.append(callback)

    def _notify_transition(
        self,
        old_state: TicketState,
        event: TicketEvent,
        new_state: TicketState
    ) -> None:
        """Notify all registered callbacks of a state transition."""
        for callback in self._transition_callbacks:
            try:
                callback(old_state, event, new_state)
            except Exception:
                pass  # Don't let callback errors break state machine

    def reset(self, state: TicketState = TicketState.PENDING_APPROVAL) -> None:
        """
        Reset the state machine to a given state.

        Args:
            state: State to reset to (default: PENDING_APPROVAL)
        """
        with self._lock:
            self._current_state = state
            self._transition_logs.clear()
            self._version = 0

    def get_transition_history(self) -> List[Dict[str, Any]]:
        """
        Get complete transition history.

        Returns:
            List of transition log entries as dictionaries
        """
        return [log.to_dict() for log in self._transition_logs]

    def __repr__(self) -> str:
        return f"TicketStateMachine(ticket_id={self._ticket_id}, state={self._current_state.value})"