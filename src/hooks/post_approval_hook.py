"""
Post-Approval Hook Module

This module implements the post-approval hook for the work order approval workflow.
It is responsible for triggering notification events after approval state changes.

Version: Iteration 6 (SWARM-2025-Q2-P0-003)
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any

from src.infrastructure.messaging.publisher import NotificationPublisher
from src.domain.entities.work_order import WorkOrder

logger = logging.getLogger(__name__)


class PostApprovalHook:
    """
    Post-approval hook handler that triggers notifications after work order approval actions.
    
    This hook monitors approval state changes and publishes notification events to
    the RabbitMQ message queue for downstream notification consumers.
    
    Supported actions:
        - APPROVED: Notify the applicant that the work order was approved
        - REJECTED: Notify the applicant with rejection reason
        - TRANSFERRED: Notify the new approver about the transferred work order
    """

    def __init__(self, publisher: Optional[NotificationPublisher] = None) -> None:
        """
        Initialize the post-approval hook with an optional notification publisher.
        
        Args:
            publisher: Optional NotificationPublisher instance. If not provided,
                      a new instance will be created.
        """
        self._publisher = publisher or NotificationPublisher()

    def execute(
        self,
        work_order: WorkOrder,
        action: str,
        approver_id: int,
        approver_name: str,
        comment: Optional[str] = None,
        reason: Optional[str] = None,
        transfer_to: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Execute the post-approval hook to trigger notifications.
        
        Args:
            work_order: The work order entity being acted upon
            action: The approval action (APPROVED, REJECTED, TRANSFERRED)
            approver_id: The ID of the user performing the approval
            approver_name: The name of the approver
            comment: Optional comment for the approval action
            reason: Required for REJECTED action
            transfer_to: Required for TRANSFERRED action (new approver's user ID)
            
        Returns:
            Dict containing the result of the hook execution with keys:
                - success: bool indicating if notification was queued
                - event_id: Optional message ID if successful
                - error: Optional error message if failed
                
        Raises:
            ValueError: If required parameters are missing for the action type
        """
        logger.info(
            f"Executing post-approval hook for work order {work_order.id}, "
            f"action={action}, approver_id={approver_id}"
        )
        
        self._validate_action_params(action, reason, transfer_to)
        
        notification_payload = self._build_notification_payload(
            work_order=work_order,
            action=action,
            approver_id=approver_id,
            approver_name=approver_name,
            comment=comment,
            reason=reason,
            transfer_to=transfer_to
        )
        
        try:
            event_id = self._publisher.publish_notification(notification_payload)
            logger.info(f"Notification queued successfully with event_id={event_id}")
            
            return {
                "success": True,
                "event_id": event_id,
                "error": None
            }
        except Exception as e:
            logger.error(f"Failed to publish notification: {e}")
            return {
                "success": False,
                "event_id": None,
                "error": str(e)
            }

    def _validate_action_params(
        self,
        action: str,
        reason: Optional[str],
        transfer_to: Optional[int]
    ) -> None:
        """
        Validate that required parameters are provided for the given action type.
        
        Args:
            action: The approval action being performed
            reason: The rejection reason (required for REJECTED)
            transfer_to: The target user ID (required for TRANSFERRED)
            
        Raises:
            ValueError: If required parameters are missing
        """
        if action == "REJECTED" and not reason:
            raise ValueError("驳回必须填写原因")
        
        if action == "TRANSFERRED" and not transfer_to:
            raise ValueError("转交必须指定接收人")

    def _build_notification_payload(
        self,
        work_order: WorkOrder,
        action: str,
        approver_id: int,
        approver_name: str,
        comment: Optional[str],
        reason: Optional[str],
        transfer_to: Optional[int]
    ) -> Dict[str, Any]:
        """
        Build the notification message payload for RabbitMQ.
        
        Args:
            work_order: The work order entity
            action: The approval action
            approver_id: The approver's user ID
            approver_name: The approver's name
            comment: Optional comment
            reason: Optional rejection reason
            transfer_to: Optional transfer target user ID
            
        Returns:
            Dict containing the notification message in the specified format
        """
        payload = {
            "event_type": "WORKORDER_APPROVAL",
            "workorder_id": work_order.id,
            "action": action,
            "approver_id": approver_id,
            "approver_name": approver_name,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        if reason:
            payload["reason"] = reason
        
        if comment:
            payload["comment"] = comment
        
        if transfer_to:
            payload["transfer_to"] = transfer_to
        
        if hasattr(work_order, 'applicant_id'):
            payload["applicant_id"] = work_order.applicant_id
        
        return payload


def trigger_approval_notification(
    work_order: WorkOrder,
    action: str,
    approver_id: int,
    approver_name: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience function to trigger approval notification.
    
    This is the main entry point for the post-approval hook that can be called
    from the approval API endpoints after successful state transitions.
    
    Args:
        work_order: The work order entity
        action: The approval action (APPROVED, REJECTED, TRANSFERRED)
        approver_id: The approver's user ID
        approver_name: The approver's name
        **kwargs: Additional optional parameters (comment, reason, transfer_to)
        
    Returns:
        Dict with execution result (success, event_id, error)
    """
    hook = PostApprovalHook()
    return hook.execute(
        work_order=work_order,
        action=action,
        approver_id=approver_id,
        approver_name=approver_name,
        comment=kwargs.get("comment"),
        reason=kwargs.get("reason"),
        transfer_to=kwargs.get("transfer_to")
    )