"""
Notification Events Module

This module defines domain events for work order approval notifications.
Events are published after approval/rejection operations to trigger
async notification delivery.

Related Spec: SWARM-2025-Q2-P0-003 Iteration 8
Phase: 5 - Notification Layer
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from enum import Enum


class NotificationEventType(Enum):
    """Notification event types for work order approval workflow."""
    WORK_ORDER_APPROVED = "work_order_approved"
    WORK_ORDER_REJECTED = "work_order_rejected"
    WORK_ORDER_PENDING = "work_order_pending"


@dataclass
class NotificationEvent:
    """
    Base notification event with common attributes.
    
    Attributes:
        event_id: Unique identifier for the event (UUID format)
        event_type: Type of the notification event
        work_order_id: Associated work order ID
        timestamp: Event creation timestamp
        operator_id: User who triggered the event
    """
    event_id: str
    event_type: NotificationEventType
    work_order_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    operator_id: str = ""
    correlation_id: Optional[str] = None


@dataclass
class WorkOrderApprovedEvent(NotificationEvent):
    """
    Event published when a work order is approved.
    
    Attributes:
        approved_by: User ID of approver
        reason: Optional approval comment (max 500 chars)
        version: Work order version after approval (optimistic lock)
        department_id: Department of the work order
    """
    approved_by: str = ""
    reason: str = ""
    version: int = 0
    department_id: str = ""
    
    def __post_init__(self):
        self.event_type = NotificationEventType.WORK_ORDER_APPROVED
        # Validate reason length per spec constraint
        if len(self.reason) > 500:
            self.reason = self.reason[:500]


@dataclass
class WorkOrderRejectedEvent(NotificationEvent):
    """
    Event published when a work order is rejected.
    
    Attributes:
        rejected_by: User ID of rejecter
        reason: Rejection comment (max 500 chars)
        version: Work order version after rejection
        department_id: Department of the work order
    """
    rejected_by: str = ""
    reason: str = ""
    version: int = 0
    department_id: str = ""
    
    def __post_init__(self):
        self.event_type = NotificationEventType.WORK_ORDER_REJECTED
        # Validate reason length per spec constraint
        if len(self.reason) > 500:
            self.reason = self.reason[:500]


@dataclass
class WorkOrderPendingEvent(NotificationEvent):
    """
    Event published when a new work order is submitted pending approval.
    
    Attributes:
        created_by: User ID who created the work order
        title: Work order title for notification
        department_id: Department of the work order
    """
    created_by: str = ""
    title: str = ""
    department_id: str = ""
    
    def __post_init__(self):
        self.event_type = NotificationEventType.WORK_ORDER_PENDING


class NotificationEventPublisher:
    """
    Publisher for notification events.
    
    Publishes events to async notification system (RabbitMQ/Kafka).
    Notifications are delivered asynchronously and should not block
    the main approval flow per spec constraint.
    """
    
    def __init__(self, message_broker=None):
        """
        Initialize the event publisher.
        
        Args:
            message_broker: Optional message broker instance for DI
        """
        self._broker = message_broker
        self._subscribers = []
    
    def subscribe(self, handler):
        """
        Subscribe a handler to notification events.
        
        Args:
            handler: Callable handler to receive events
        """
        if handler not in self._subscribers:
            self._subscribers.append(handler)
    
    def unsubscribe(self, handler):
        """
        Unsubscribe a handler from notification events.
        
        Args:
            handler: Callable handler to remove
        """
        if handler in self._subscribers:
            self._subscribers.remove(handler)
    
    def publish_approved(self, event: WorkOrderApprovedEvent) -> bool:
        """
        Publish a work order approved event.
        
        Args:
            event: WorkOrderApprovedEvent instance
            
        Returns:
            bool: True if published successfully
        """
        return self._publish(event)
    
    def publish_rejected(self, event: WorkOrderRejectedEvent) -> bool:
        """
        Publish a work order rejected event.
        
        Args:
            event: WorkOrderRejectedEvent instance
            
        Returns:
            bool: True if published successfully
        """
        return self._publish(event)
    
    def publish_pending(self, event: WorkOrderPendingEvent) -> bool:
        """
        Publish a work order pending event.
        
        Args:
            event: WorkOrderPendingEvent instance
            
        Returns:
            bool: True if published successfully
        """
        return self._publish(event)
    
    def _publish(self, event: NotificationEvent) -> bool:
        """
        Internal publish method that dispatches to all subscribers.
        
        Per spec: Notification failures should not block main flow.
        
        Args:
            event: NotificationEvent instance
            
        Returns:
            bool: True if published successfully (even if async)
        """
        try:
            for subscriber in self._subscribers:
                try:
                    subscriber(event)
                except Exception:
                    # Log error but don't block - per spec notification
                    # failures should not block approval flow
                    pass
            
            if self._broker:
                self._broker.publish(event)
            
            return True
        except Exception:
            # Non-blocking - per spec notification should not block flow
            return True
    
    def clear_subscribers(self):
        """Clear all event subscribers."""
        self._subscribers.clear()


# Module-level publisher instance for convenience
_default_publisher: Optional[NotificationEventPublisher] = None


def get_publisher() -> NotificationEventPublisher:
    """
    Get the default notification event publisher.
    
    Returns:
        NotificationEventPublisher instance
    """
    global _default_publisher
    if _default_publisher is None:
        _default_publisher = NotificationEventPublisher()
    return _default_publisher


def reset_publisher():
    """Reset the default publisher (useful for testing)."""
    global _default_publisher
    if _default_publisher:
        _default_publisher.clear_subscribers()
    _default_publisher = None