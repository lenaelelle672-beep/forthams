"""
Domain events package for state change notifications.
"""

from src.domain.events.state_changed import StateChangedEvent, state_changed_event
from src.domain.events.workorder_events import (
    WorkOrderCreatedEvent,
    WorkOrderApprovedEvent,
    WorkOrderRejectedEvent,
    WorkOrderSubmittedEvent,
)

__all__ = [
    "StateChangedEvent",
    "state_changed_event",
    "WorkOrderCreatedEvent",
    "WorkOrderApprovedEvent",
    "WorkOrderRejectedEvent",
    "WorkOrderSubmittedEvent",
]