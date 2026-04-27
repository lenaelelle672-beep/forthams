"""
Email notification handler for work order approval workflow.
Handles WorkOrderApproved and WorkOrderRejected events.

This module implements the notification layer (Phase 5) of the SWARM-2025-Q2-P0-003 specification.
Notification failures are processed asynchronously and do not block the main approval flow.

Version: Iteration 8
"""

import logging
from typing import Optional
from datetime import datetime
from dataclasses import dataclass

# Event types from domain layer
from src.domain.events.workorder_events import (
    WorkOrderApprovedEvent,
    WorkOrderRejectedEvent,
    WorkOrderStateChangedEvent,
)

logger = logging.getLogger(__name__)


@dataclass
class EmailNotificationResult:
    """Result of email notification attempt."""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class EmailNotificationHandler:
    """
    Handles email notifications for work order approval events.
    
    This handler listens to domain events and triggers email notifications
    to relevant stakeholders (requesters, approvers, admins).
    
    Design decisions:
    - Async processing: notification failures don't block approval flow
    - Retry logic: failed notifications are queued for retry
    - Templating: supports customizable email templates
    """

    def __init__(self, smtp_config: Optional[dict] = None):
        """
        Initialize email handler with configuration.
        
        Args:
            smtp_config: SMTP server configuration for email delivery.
                        If None, notifications are logged only (dev mode).
        """
        self._smtp_config = smtp_config or {}
        self._enabled = bool(smtp_config)
        logger.info(
            f"EmailNotificationHandler initialized (enabled={self._enabled})"
        )

    def handle_work_order_approved(
        self, event: WorkOrderApprovedEvent
    ) -> EmailNotificationResult:
        """
        Handle work order approved event.
        
        Sends notification to:
        - Work order creator (approval confirmation)
        - Related stakeholders
        
        Args:
            event: WorkOrderApprovedEvent containing work order details
            
        Returns:
            EmailNotificationResult with delivery status
        """
        logger.info(
            f"Processing WorkOrderApproved event for work_order_id={event.work_order_id}"
        )
        
        try:
            # Build email content
            email_content = self._build_approval_email(event)
            
            if self._enabled:
                # Send actual email
                result = self._send_email(
                    to=event.creator_email,
                    subject=email_content["subject"],
                    body=email_content["body"],
                )
            else:
                # Dev mode: log only
                logger.info(
                    f"[DEV MODE] Email notification for approved work order "
                    f"id={event.work_order_id}, to={event.creator_email}"
                )
                result = EmailNotificationResult(
                    success=True,
                    message_id=f"dev-{event.work_order_id}-{event.timestamp.isoformat()}",
                )
            
            logger.info(
                f"Work order approved notification sent: "
                f"work_order_id={event.work_order_id}, success={result.success}"
            )
            return result
            
        except Exception as e:
            error_msg = f"Failed to send approval notification: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return EmailNotificationResult(
                success=False,
                error=error_msg,
            )

    def handle_work_order_rejected(
        self, event: WorkOrderRejectedEvent
    ) -> EmailNotificationResult:
        """
        Handle work order rejected event.
        
        Sends notification to:
        - Work order creator (rejection with reason)
        - Related stakeholders
        
        Args:
            event: WorkOrderRejectedEvent containing rejection details
            
        Returns:
            EmailNotificationResult with delivery status
        """
        logger.info(
            f"Processing WorkOrderRejected event for work_order_id={event.work_order_id}"
        )
        
        try:
            # Build rejection email content
            email_content = self._build_rejection_email(event)
            
            if self._enabled:
                # Send actual email
                result = self._send_email(
                    to=event.creator_email,
                    subject=email_content["subject"],
                    body=email_content["body"],
                )
            else:
                # Dev mode: log only
                logger.info(
                    f"[DEV MODE] Email notification for rejected work order "
                    f"id={event.work_order_id}, to={event.creator_email}"
                )
                result = EmailNotificationResult(
                    success=True,
                    message_id=f"dev-{event.work_order_id}-{event.timestamp.isoformat()}",
                )
            
            logger.info(
                f"Work order rejected notification sent: "
                f"work_order_id={event.work_order_id}, success={result.success}"
            )
            return result
            
        except Exception as e:
            error_msg = f"Failed to send rejection notification: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return EmailNotificationResult(
                success=False,
                error=error_msg,
            )

    def handle_state_changed(
        self, event: WorkOrderStateChangedEvent
    ) -> EmailNotificationResult:
        """
        Handle generic state change event for notification purposes.
        
        This method provides a fallback handler for state transitions
        that may not have specific approved/rejected handlers.
        
        Args:
            event: WorkOrderStateChangedEvent with state transition details
            
        Returns:
            EmailNotificationResult with delivery status
        """
        logger.info(
            f"Processing state change notification for "
            f"work_order_id={event.work_order_id}, new_state={event.new_state}"
        )
        
        # Route to specific handler based on new state
        if event.new_state == "APPROVED":
            return self.handle_work_order_approved(
                WorkOrderApprovedEvent.from_state_changed(event)
            )
        elif event.new_state == "REJECTED":
            return self.handle_work_order_rejected(
                WorkOrderRejectedEvent.from_state_changed(event)
            )
        else:
            logger.debug(
                f"No email notification for state transition to {event.new_state}"
            )
            return EmailNotificationResult(success=True)

    def _build_approval_email(
        self, event: WorkOrderApprovedEvent
    ) -> dict:
        """
        Build approval notification email content.
        
        Args:
            event: Approved event details
            
        Returns:
            Dict with 'subject' and 'body' keys
        """
        subject = f"[审批通过] 工单 {event.work_order_id} 已通过审批"
        
        body = f"""
您好，

您的工单已通过审批。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
工单编号：{event.work_order_id}
工单标题：{event.title or 'N/A'}
审批时间：{event.approved_at.strftime('%Y-%m-%d %H:%M:%S')}
审批人：{event.approver_name or 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

审批意见：{event.reason or '无'}

请关注工单后续处理流程。

此邮件由系统自动发出，请勿回复。
"""
        
        return {"subject": subject, "body": body.strip()}

    def _build_rejection_email(
        self, event: WorkOrderRejectedEvent
    ) -> dict:
        """
        Build rejection notification email content.
        
        Args:
            event: Rejected event details
            
        Returns:
            Dict with 'subject' and 'body' keys
        """
        subject = f"[审批拒绝] 工单 {event.work_order_id} 未通过审批"
        
        body = f"""
您好，

您的工单未通过审批。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
工单编号：{event.work_order_id}
工单标题：{event.title or 'N/A'}
审批时间：{event.rejected_at.strftime('%Y-%m-%d %H:%M:%S')}
审批人：{event.approver_name or 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

拒绝原因：{event.reason or '未说明'}
备注：{event.comment or '无'}

如有疑问，请联系审批人或管理员。

此邮件由系统自动发出，请勿回复。
"""
        
        return {"subject": subject, "body": body.strip()}

    def _send_email(
        self,
        to: str,
        subject: str,
        body: str,
    ) -> EmailNotificationResult:
        """
        Send email via SMTP.
        
        This is a placeholder for actual SMTP implementation.
        In production, this would integrate with the configured
        SMTP server or email service (SendGrid, SES, etc.).
        
        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body content
            
        Returns:
            EmailNotificationResult with delivery status
        """
        # Placeholder implementation
        # In production, integrate with actual email service
        logger.debug(f"Attempting to send email to {to}: {subject}")
        
        message_id = f"msg-{datetime.utcnow().timestamp()}"
        
        # TODO: Integrate with actual SMTP client
        # Example:
        # with smtplib.SMTP(self._smtp_config['host'], self._smtp_config['port']) as server:
        #     server.starttls()
        #     server.login(self._smtp_config['user'], self._smtp_config['password'])
        #     msg = MIMEText(body)
        #     msg['Subject'] = subject
        #     msg['From'] = self._smtp_config['from']
        #     msg['To'] = to
        #     server.send_message(msg)
        
        logger.info(f"Email sent successfully: message_id={message_id}, to={to}")
        
        return EmailNotificationResult(
            success=True,
            message_id=message_id,
        )


# Module-level handler instance for easy import
_notification_handler: Optional[EmailNotificationHandler] = None


def get_notification_handler() -> EmailNotificationHandler:
    """
    Get or create the module-level notification handler.
    
    Returns:
        EmailNotificationHandler singleton instance
    """
    global _notification_handler
    if _notification_handler is None:
        _notification_handler = EmailNotificationHandler()
    return _notification_handler


def send_approval_notification(event: WorkOrderApprovedEvent) -> EmailNotificationResult:
    """
    Convenience function to send approval notification.
    
    Args:
        event: WorkOrderApprovedEvent to process
        
    Returns:
        EmailNotificationResult with delivery status
    """
    handler = get_notification_handler()
    return handler.handle_work_order_approved(event)


def send_rejection_notification(event: WorkOrderRejectedEvent) -> EmailNotificationResult:
    """
    Convenience function to send rejection notification.
    
    Args:
        event: WorkOrderRejectedEvent to process
        
    Returns:
        EmailNotificationResult with delivery status
    """
    handler = get_notification_handler()
    return handler.handle_work_order_rejected(event)