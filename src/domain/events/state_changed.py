"""
State Changed Domain Event

This module defines the state_changed domain event for work order transitions.
It publishes events when work order state transitions occur.
"""

from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field

from src.domain.events.workorder_events import WorkOrderEvent


@dataclass
class StateChangedEvent(WorkOrderEvent):
    """
    Domain event fired when a work order state transition occurs.
    
    Attributes:
        work_order_id: Unique identifier of the work order
        previous_state: The state before transition
        new_state: The state after transition
        triggered_by: User ID or system identifier that triggered the change
        reason: Optional reason for the state change
        metadata: Additional context for the transition
    """
    work_order_id: str
    previous_state: str
    new_state: str
    triggered_by: str
    reason: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    event_type: str = "state_changed"
    
    def to_dict(self) -> dict:
        """Convert event to dictionary representation."""
        return {
            "event_type": self.event_type,
            "work_order_id": self.work_order_id,
            "previous_state": self.previous_state,
            "new_state": self.new_state,
            "triggered_by": self.triggered_by,
            "reason": self.reason,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


def create_state_changed_event(
    work_order_id: str,
    previous_state: str,
    new_state: str,
    triggered_by: str,
    reason: Optional[str] = None,
    metadata: Optional[dict] = None
) -> StateChangedEvent:
    """
    Factory function to create a StateChangedEvent.
    
    Args:
        work_order_id: Unique identifier of the work order
        previous_state: The state before transition
        new_state: The state after transition
        triggered_by: User ID or system identifier
        reason: Optional reason for the state change
        metadata: Optional additional context
        
    Returns:
        StateChangedEvent instance
    """
    return StateChangedEvent(
        work_order_id=work_order_id,
        previous_state=previous_state,
        new_state=new_state,
        triggered_by=triggered_by,
        reason=reason,
        metadata=metadata or {}
    )