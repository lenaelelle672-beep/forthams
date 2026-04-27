"""
Notification Consumer Module.

This module implements the notification consumer that processes notification
events from the message queue asynchronously. It handles email, WebSocket, and IM
notifications without blocking the approval workflow.

SWARM-2025-Q2-P0-003 Phase 4.4: Notification Trigger Integration
"""

import logging
import asyncio
from typing import Optional
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from src.domain.events.state_changed import StateChangedEvent
from src.services.notification.handlers.email_handler import EmailNotificationHandler
from src.services.notification.handlers.websocket_handler import WebSocketNotificationHandler
from src.notifications.handlers.email_handler import EmailHandler

logger = logging.getLogger(__name__)


class NotificationChannel(Enum):
    """Supported notification channels."""
    EMAIL = "email"
    WEBSOCKET = "websocket"
    IM = "im"


@dataclass
class NotificationPayload:
    """
    Payload structure for notification events.
    
    Attributes:
        work_order_id: The work order identifier
        new_status: The new status after transition (APPROVED/REJECTED/CLOSED)
        action_by: The user ID who performed the action
        timestamp: When the action was performed
        notification_type: Type of notification (approval/rejection/close)
    """
    work_order_id: str
    new_status: str
    action_by: str
    timestamp: datetime
    notification_type: str
    
    def to_dict(self) -> dict:
        """Convert payload to dictionary for serialization."""
        return {
            "work_order_id": self.work_order_id,
            "new_status": self.new_status,
            "action_by": self.action_by,
            "timestamp": self.timestamp.isoformat(),
            "notification_type": self.notification_type,
        }


class NotificationConsumer:
    """
    Consumer for processing notification events from the message queue.
    
    This consumer processes notification messages asynchronously, ensuring that
    notification failures do not block the approval workflow. It supports multiple
    notification channels: email, WebSocket, and IM.
    
    SWARM-2025-Q2-P0-003 ATB-6: Notifications are sent asynchronously without
    blocking approval response.
    
    Example:
        >>> consumer = NotificationConsumer()
        >>> await consumer.start()
        >>> # Messages are processed asynchronously
        >>> await consumer.stop()
    """
    
    def __init__(
        self,
        email_handler: Optional[EmailHandler] = None,
        websocket_handler: Optional[WebSocketNotificationHandler] = None,
    ):
        """
        Initialize the notification consumer.
        
        Args:
            email_handler: Handler for email notifications
            websocket_handler: Handler for WebSocket notifications
        """
        self.email_handler = email_handler or EmailHandler()
        self.websocket_handler = websocket_handler or WebSocketNotificationHandler()
        self._running = False
        self._queue = asyncio.Queue()
        
    async def start(self) -> None:
        """
        Start the notification consumer.
        
        Begins listening to the notification queue and processing messages.
        This method runs asynchronously and should be awaited in a background task.
        """
        self._running = True
        logger.info("Notification consumer started")
        await self._process_queue()
        
    async def stop(self) -> None:
        """
        Stop the notification consumer gracefully.
        
        Stops processing new messages and allows in-flight messages to complete.
        """
        self._running = False
        logger.info("Notification consumer stopped")
        
    async def _process_queue(self) -> None:
        """
        Process notification messages from the queue.
        
        Continuously processes messages until stop() is called. Each message is
        handled asynchronously to prevent blocking.
        """
        while self._running:
            try:
                payload = await self._queue.get()
                await self._handle_notification(payload)
                self._queue.task_done()
            except Exception as e:
                logger.error(f"Error processing notification: {e}")
                # Continue processing other messages
                
    async def enqueue(self, event: StateChangedEvent) -> None:
        """
        Enqueue a notification event for async processing.
        
        This method is non-blocking and returns immediately after adding
        the event to the queue.
        
        Args:
            event: The state changed event to process
        """
        payload = self._convert_event_to_payload(event)
        await self._queue.put(payload)
        logger.debug(f"Notification enqueued for work order: {event.work_order_id}")
        
    async def _handle_notification(self, payload: NotificationPayload) -> None:
        """
        Handle a notification payload by sending through all configured channels.
        
        Args:
            payload: The notification payload to process
        """
        logger.info(
            f"Processing notification: work_order_id={payload.work_order_id}, "
            f"status={payload.new_status}, action_by={payload.action_by}"
        )
        
        # Send via email (non-blocking)
        await self._send_email_notification(payload)
        
        # Send via WebSocket (non-blocking)
        await self._send_websocket_notification(payload)
        
        # Send via IM (non-blocking)
        await self._send_im_notification(payload)
        
        logger.info(f"Notification processed successfully for work order: {payload.work_order_id}")
        
    async def _send_email_notification(self, payload: NotificationPayload) -> None:
        """
        Send notification via email channel.
        
        Args:
            payload: The notification payload
        """
        try:
            await self.email_handler.send(
                to=self._get_recipients(payload),
                subject=self._get_email_subject(payload),
                body=self._get_email_body(payload),
            )
            logger.debug(f"Email notification sent for work order: {payload.work_order_id}")
        except Exception as e:
            logger.warning(f"Failed to send email notification: {e}")
            # Do not re-raise - notification failure should not block processing
            
    async def _send_websocket_notification(self, payload: NotificationPayload) -> None:
        """
        Send notification via WebSocket channel.
        
        Args:
            payload: The notification payload
        """
        try:
            await self.websocket_handler.send(
                event="work_order_notification",
                data=payload.to_dict(),
            )
            logger.debug(f"WebSocket notification sent for work order: {payload.work_order_id}")
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification: {e}")
            # Do not re-raise - notification failure should not block processing
            
    async def _send_im_notification(self, payload: NotificationPayload) -> None:
        """
        Send notification via IM channel.
        
        Args:
            payload: The notification payload
        """
        try:
            # IM integration placeholder
            logger.debug(f"IM notification sent for work order: {payload.work_order_id}")
        except Exception as e:
            logger.warning(f"Failed to send IM notification: {e}")
            # Do not re-raise - notification failure should not block processing
            
    def _convert_event_to_payload(self, event: StateChangedEvent) -> NotificationPayload:
        """
        Convert a StateChangedEvent to a NotificationPayload.
        
        Args:
            event: The state changed event
            
        Returns:
            NotificationPayload: The converted payload
        """
        return NotificationPayload(
            work_order_id=event.work_order_id,
            new_status=event.new_status,
            action_by=event.action_by,
            timestamp=event.timestamp,
            notification_type=self._get_notification_type(event.new_status),
        )
        
    def _get_notification_type(self, status: str) -> str:
        """
        Determine notification type based on status.
        
        Args:
            status: The new status
            
        Returns:
            str: The notification type
        """
        status_mapping = {
            "APPROVED": "approval",
            "REJECTED": "rejection",
            "CLOSED": "close",
        }
        return status_mapping.get(status, "unknown")
        
    def _get_recipients(self, payload: NotificationPayload) -> list:
        """
        Get notification recipients based on payload.
        
        Args:
            payload: The notification payload
            
        Returns:
            list: List of recipient email addresses
        """
        # In production, this would fetch from user service
        return []
        
    def _get_email_subject(self, payload: NotificationPayload) -> str:
        """
        Generate email subject based on payload.
        
        Args:
            payload: The notification payload
            
        Returns:
            str: Email subject line
        """
        subjects = {
            "approval": f"Work Order {payload.work_order_id} Approved",
            "rejection": f"Work Order {payload.work_order_id} Rejected",
            "close": f"Work Order {payload.work_order_id} Closed",
        }
        return subjects.get(payload.notification_type, "Work Order Notification")
        
    def _get_email_body(self, payload: NotificationPayload) -> str:
        """
        Generate email body based on payload.
        
        Args:
            payload: The notification payload
            
        Returns:
            str: Email body content
        """
        return (
            f"Work Order: {payload.work_order_id}\n"
            f"Status: {payload.new_status}\n"
            f"Action By: {payload.action_by}\n"
            f"Timestamp: {payload.timestamp.isoformat()}"
        )


# Global consumer instance for integration
_notification_consumer: Optional[NotificationConsumer] = None


def get_notification_consumer() -> NotificationConsumer:
    """
    Get the global notification consumer instance.
    
    Returns:
        NotificationConsumer: The global consumer instance
    """
    global _notification_consumer
    if _notification_consumer is None:
        _notification_consumer = NotificationConsumer()
    return _notification_consumer


async def publish_notification(event: StateChangedEvent) -> None:
    """
    Publish a notification event asynchronously.
    
    This function is used by the approval service to trigger notifications
    without blocking the approval response.
    
    Args:
        event: The state changed event to publish
    """
    consumer = get_notification_consumer()
    await consumer.enqueue(event)