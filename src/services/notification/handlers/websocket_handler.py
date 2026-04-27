# -*- coding: utf-8 -*-
"""
WebSocket Handler for Real-time Notification Delivery

This module implements the WebSocket notification handler for the work order
approval workflow (SWARM-2025-Q2-P0-003, Iteration 9).

Architecture:
- WebSocket connections are managed per user session
- Notification events are published to connected clients in real-time
- Fallback to polling for clients with unstable connections

Version: 1.0
Author: Spec Engineering
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Set
from enum import Enum

logger = logging.getLogger(__name__)


class NotificationEventType(Enum):
    """Supported notification event types for work order approval."""
    WORK_ORDER_PENDING = "work_order_pending"
    WORK_ORDER_APPROVED = "work_order_approved"
    WORK_ORDER_REJECTED = "work_order_rejected"
    WORK_ORDER_CLOSED = "work_order_closed"
    APPROVAL_ASSIGNED = "approval_assigned"
    APPROVAL_TIMEOUT_WARNING = "approval_timeout_warning"


class WebSocketConnection:
    """
    Represents a single WebSocket client connection.
    
    Attributes:
        client_id: Unique identifier for the client connection
        user_id: Associated user ID
        connected_at: Timestamp when connection was established
        subscribed_channels: Set of notification channels subscribed by client
    """
    
    def __init__(
        self,
        client_id: str,
        user_id: str,
        subscribed_channels: Optional[Set[str]] = None
    ) -> None:
        self.client_id = client_id
        self.user_id = user_id
        self.connected_at = datetime.utcnow()
        self.subscribed_channels = subscribed_channels or set()
        self._alive = True
    
    @property
    def is_alive(self) -> bool:
        """Check if the connection is still alive."""
        return self._alive
    
    def subscribe(self, channel: str) -> None:
        """Subscribe to a notification channel."""
        self.subscribed_channels.add(channel)
        logger.info(
            f"Client {self.client_id} subscribed to channel: {channel}"
        )
    
    def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from a notification channel."""
        self.subscribed_channels.discard(channel)
        logger.info(
            f"Client {self.client_id} unsubscribed from channel: {channel}"
        )
    
    def mark_disconnected(self) -> None:
        """Mark the connection as disconnected."""
        self._alive = False
        logger.info(f"Client {self.client_id} marked as disconnected")


class NotificationMessage:
    """
    Structured notification message for WebSocket delivery.
    
    Attributes:
        event_type: Type of the notification event
        payload: Event-specific data payload
        timestamp: When the event occurred
        priority: Message priority (high/normal/low)
        work_order_id: Associated work order ID (if applicable)
    """
    
    def __init__(
        self,
        event_type: NotificationEventType,
        payload: Dict,
        work_order_id: Optional[str] = None,
        priority: str = "normal"
    ) -> None:
        self.event_type = event_type
        self.payload = payload
        self.work_order_id = work_order_id
        self.priority = priority
        self.timestamp = datetime.utcnow()
        self.message_id = self._generate_message_id()
    
    def _generate_message_id(self) -> str:
        """Generate unique message identifier."""
        return (
            f"{self.event_type.value}_"
            f"{self.work_order_id or 'general'}_"
            f"{int(self.timestamp.timestamp() * 1000)}"
        )
    
    def to_json(self) -> str:
        """Serialize message to JSON format."""
        return json.dumps({
            "message_id": self.message_id,
            "event_type": self.event_type.value,
            "work_order_id": self.work_order_id,
            "priority": self.priority,
            "timestamp": self.timestamp.isoformat(),
            "payload": self.payload
        }, ensure_ascii=False)
    
    @classmethod
    def from_json(cls, json_str: str) -> "NotificationMessage":
        """Deserialize message from JSON format."""
        data = json.loads(json_str)
        return cls(
            event_type=NotificationEventType(data["event_type"]),
            payload=data["payload"],
            work_order_id=data.get("work_order_id"),
            priority=data.get("priority", "normal")
        )


class WebSocketNotificationHandler:
    """
    Central handler for WebSocket-based real-time notifications.
    
    Manages client connections, channel subscriptions, and message routing
    for the work order approval notification system.
    
    Thread Safety:
        This class is NOT thread-safe. External synchronization required
        for concurrent access from multiple coroutines.
    
    Usage:
        handler = WebSocketNotificationHandler()
        await handler.connect(client_id, user_id)
        await handler.send_notification(NotificationMessage(...))
        await handler.disconnect(client_id)
    """
    
    def __init__(self) -> None:
        """Initialize the WebSocket notification handler."""
        # Mapping from client_id to WebSocketConnection
        self._connections: Dict[str, WebSocketConnection] = {}
        # Mapping from user_id to set of client_ids
        self._user_connections: Dict[str, Set[str]] = {}
        # Mapping from channel to set of client_ids
        self._channel_subscribers: Dict[str, Set[str]] = {}
        # Message queue for async delivery (not implemented in this iteration)
        self._message_queue: asyncio.Queue = asyncio.Queue(maxsize=10000)
        # Rate limiting: client_id -> (count, window_start)
        self._rate_limit: Dict[str, tuple] = {}
        # Max messages per window
        self._rate_limit_max = 100
        self._rate_limit_window = 60  # seconds
    
    async def connect(
        self,
        client_id: str,
        user_id: str,
        initial_channels: Optional[List[str]] = None
    ) -> WebSocketConnection:
        """
        Register a new WebSocket client connection.
        
        Args:
            client_id: Unique client identifier
            user_id: Associated user ID
            initial_channels: Channels to subscribe upon connection
        
        Returns:
            WebSocketConnection: The established connection object
        
        Raises:
            ValueError: If client_id already exists
        """
        if client_id in self._connections:
            logger.warning(f"Client {client_id} already connected, replacing")
            await self.disconnect(client_id)
        
        connection = WebSocketConnection(
            client_id=client_id,
            user_id=user_id,
            subscribed_channels=set(initial_channels or [])
        )
        
        self._connections[client_id] = connection
        
        # Track user -> client mapping
        if user_id not in self._user_connections:
            self._user_connections[user_id] = set()
        self._user_connections[user_id].add(client_id)
        
        # Register channel subscriptions
        for channel in connection.subscribed_channels:
            if channel not in self._channel_subscribers:
                self._channel_subscribers[channel] = set()
            self._channel_subscribers[channel].add(client_id)
        
        logger.info(f"Client {client_id} connected for user {user_id}")
        return connection
    
    async def disconnect(self, client_id: str) -> None:
        """
        Unregister a WebSocket client connection.
        
        Args:
            client_id: The client ID to disconnect
        """
        if client_id not in self._connections:
            logger.debug(f"Client {client_id} not found, nothing to disconnect")
            return
        
        connection = self._connections[client_id]
        connection.mark_disconnected()
        
        # Remove from user mapping
        user_id = connection.user_id
        if user_id in self._user_connections:
            self._user_connections[user_id].discard(client_id)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        
        # Remove from channel subscriptions
        for channel in connection.subscribed_channels:
            if channel in self._channel_subscribers:
                self._channel_subscribers[channel].discard(client_id)
                if not self._channel_subscribers[channel]:
                    del self._channel_subscribers[channel]
        
        del self._connections[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    async def subscribe(
        self,
        client_id: str,
        channel: str
    ) -> bool:
        """
        Subscribe a client to a notification channel.
        
        Args:
            client_id: The client ID
            channel: Channel name to subscribe to
        
        Returns:
            bool: True if subscription succeeded, False otherwise
        """
        if client_id not in self._connections:
            logger.warning(f"Client {client_id} not connected")
            return False
        
        connection = self._connections[client_id]
        connection.subscribe(channel)
        
        if channel not in self._channel_subscribers:
            self._channel_subscribers[channel] = set()
        self._channel_subscribers[channel].add(client_id)
        
        return True
    
    async def unsubscribe(
        self,
        client_id: str,
        channel: str
    ) -> bool:
        """
        Unsubscribe a client from a notification channel.
        
        Args:
            client_id: The client ID
            channel: Channel name to unsubscribe from
        
        Returns:
            bool: True if unsubscription succeeded, False otherwise
        """
        if client_id not in self._connections:
            logger.warning(f"Client {client_id} not connected")
            return False
        
        connection = self._connections[client_id]
        connection.unsubscribe(channel)
        
        if channel in self._channel_subscribers:
            self._channel_subscribers[channel].discard(client_id)
        
        return True
    
    def _check_rate_limit(self, client_id: str) -> bool:
        """
        Check if client has exceeded rate limit.
        
        Args:
            client_id: The client ID to check
        
        Returns:
            bool: True if within limit, False if exceeded
        """
        now = datetime.utcnow().timestamp()
        
        if client_id in self._rate_limit:
            count, window_start = self._rate_limit[client_id]
            
            if now - window_start > self._rate_limit_window:
                # Reset window
                self._rate_limit[client_id] = (1, now)
                return True
            else:
                if count >= self._rate_limit_max:
                    return False
                self._rate_limit[client_id] = (count + 1, window_start)
                return True
        else:
            self._rate_limit[client_id] = (1, now)
            return True
    
    async def send_notification(
        self,
        message: NotificationMessage,
        target_client_ids: Optional[List[str]] = None,
        target_channel: Optional[str] = None,
        target_user_id: Optional[str] = None
    ) -> Dict[str, bool]:
        """
        Send a notification message to specified recipients.
        
        Args:
            message: The notification message to send
            target_client_ids: Specific client IDs to send to (optional)
            target_channel: Send to all clients subscribed to this channel (optional)
            target_user_id: Send to all clients belonging to this user (optional)
        
        Returns:
            Dict[str, bool]: Mapping of client_id to delivery success status
        
        Note:
            At least one of target_client_ids, target_channel, or target_user_id
            must be specified.
        """
        if not any([target_client_ids, target_channel, target_user_id]):
            raise ValueError(
                "At least one target must be specified: "
                "target_client_ids, target_channel, or target_user_id"
            )
        
        delivery_status: Dict[str, bool] = {}
        target_set: Set[str] = set()
        
        # Collect target client IDs
        if target_client_ids:
            target_set.update(target_client_ids)
        
        if target_channel:
            if target_channel in self._channel_subscribers:
                target_set.update(self._channel_subscribers[target_channel])
        
        if target_user_id:
            if target_user_id in self._user_connections:
                target_set.update(self._user_connections[target_user_id])
        
        # Send to each target client
        for client_id in target_set:
            if client_id not in self._connections:
                delivery_status[client_id] = False
                continue
            
            if not self._check_rate_limit(client_id):
                logger.warning(f"Rate limit exceeded for client {client_id}")
                delivery_status[client_id] = False
                continue
            
            try:
                # In production, this would use actual WebSocket send
                # For now, we simulate successful delivery
                await self._deliver_message(client_id, message)
                delivery_status[client_id] = True
            except Exception as e:
                logger.error(f"Failed to deliver to {client_id}: {e}")
                delivery_status[client_id] = False
        
        success_count = sum(1 for v in delivery_status.values() if v)
        logger.info(
            f"Notification {message.message_id} delivered to "
            f"{success_count}/{len(delivery_status)} clients"
        )
        
        return delivery_status
    
    async def _deliver_message(
        self,
        client_id: str,
        message: NotificationMessage
    ) -> None:
        """
        Internal method to deliver message to a specific client.
        
        In production, this would interface with the actual WebSocket
        connection manager (e.g., FastAPI WebSocket, Socket.IO).
        
        Args:
            client_id: Target client ID
            message: Message to deliver
        """
        # Simulated delivery - in production, call actual WS send
        # await self.ws_manager.send(client_id, message.to_json())
        logger.debug(f"Delivering message {message.message_id} to {client_id}")
        await asyncio.sleep(0)  # Yield control to event loop
    
    async def broadcast_approval_update(
        self,
        work_order_id: str,
        new_status: str,
        approver_user_id: str
    ) -> Dict[str, bool]:
        """
        Broadcast work order approval status change to all relevant parties.
        
        Args:
            work_order_id: The work order ID that was updated
            new_status: The new status (APPROVED/REJECTED/CLOSED)
            approver_user_id: User ID of the approver
        
        Returns:
            Dict[str, bool]: Delivery status per client
        """
        event_type_map = {
            "APPROVED": NotificationEventType.WORK_ORDER_APPROVED,
            "REJECTED": NotificationEventType.WORK_ORDER_REJECTED,
            "CLOSED": NotificationEventType.WORK_ORDER_CLOSED,
        }
        
        event_type = event_type_map.get(new_status)
        if not event_type:
            logger.warning(f"Unknown status transition: {new_status}")
            return {}
        
        message = NotificationMessage(
            event_type=event_type,
            payload={
                "work_order_id": work_order_id,
                "new_status": new_status,
                "approver_user_id": approver_user_id,
                "message": f"工单 {work_order_id} 已更新状态为 {new_status}"
            },
            work_order_id=work_order_id,
            priority="high"
        )
        
        # Broadcast to the work order's notification channel
        channel = f"work_order:{work_order_id}"
        return await self.send_notification(message, target_channel=channel)
    
    def get_connection_stats(self) -> Dict:
        """
        Get current connection statistics.
        
        Returns:
            Dict containing connection stats
        """
        return {
            "total_connections": len(self._connections),
            "total_users": len(self._user_connections),
            "total_channels": len(self._channel_subscribers),
            "active_connections": sum(
                1 for c in self._connections.values() if c.is_alive
            )
        }
    
    async def cleanup_stale_connections(self) -> int:
        """
        Remove connections that have been marked as disconnected.
        
        Returns:
            int: Number of connections cleaned up
        """
        stale_clients = [
            client_id
            for client_id, conn in self._connections.items()
            if not conn.is_alive
        ]
        
        for client_id in stale_clients:
            await self.disconnect(client_id)
        
        if stale_clients:
            logger.info(f"Cleaned up {len(stale_clients)} stale connections")
        
        return len(stale_clients)


# Singleton instance for application-wide use
_notification_handler: Optional[WebSocketNotificationHandler] = None


def get_notification_handler() -> WebSocketNotificationHandler:
    """
    Get the singleton WebSocket notification handler instance.
    
    Returns:
        WebSocketNotificationHandler: The handler instance
    """
    global _notification_handler
    if _notification_handler is None:
        _notification_handler = WebSocketNotificationHandler()
    return _notification_handler