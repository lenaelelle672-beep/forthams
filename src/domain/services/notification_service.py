"""
Notification Service Module

提供工单审批流程中的通知服务，支持多种通知渠道（Email、WebSocket）。

@module notification_service
@date 2025-01-01
"""
from enum import Enum
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    """
    通知渠道枚举
    """
    EMAIL = "email"
    WEBSOCKET = "websocket"


class NotificationEvent(str, Enum):
    """
    通知事件类型枚举
    """
    WORK_ORDER_APPROVED = "work_order_approved"
    WORK_ORDER_REJECTED = "work_order_rejected"


class NotificationService:
    """
    通知服务类
    
    负责发送工单审批结果通知，支持多种通知渠道。
    
    @responsibilities
        - 发送审批通过通知
        - 发送审批驳回通知
        - 管理通知渠道（Email、WebSocket）
    """

    def __init__(self, email_handler=None, websocket_handler=None):
        """
        初始化通知服务
        
        @param email_handler 邮件处理器（可选）
        @param websocket_handler WebSocket处理器（可选）
        """
        self._email_handler = email_handler
        self._websocket_handler = websocket_handler

    def send_approval_result(
        self,
        work_order_id: str,
        work_order_title: str,
        recipient_id: str,
        recipient_email: str,
        action: NotificationEvent,
        approver_name: str,
        reject_reason: Optional[str] = None
    ) -> bool:
        """
        发送审批结果通知
        
        当工单被审批通过或驳回时，向工单创建者发送通知。
        
        @param work_order_id 工单ID
        @param work_order_title 工单标题
        @param recipient_id 接收人用户ID
        @param recipient_email 接收人邮箱
        @param action 审批动作（APPROVED/REJECTED）
        @param approver_name 审批人名称
        @param reject_reason 驳回理由（仅驳回时需要）
        @returns 通知是否发送成功
        
        @throws ValueError 当 action 不合法或缺少驳回理由时
        """
        if action not in [NotificationEvent.WORK_ORDER_APPROVED, NotificationEvent.WORK_ORDER_REJECTED]:
            raise ValueError(f"Invalid notification action: {action}")
        
        if action == NotificationEvent.WORK_ORDER_REJECTED and not reject_reason:
            raise ValueError("Reject reason is required when rejecting a work order")
        
        result = True
        
        # 发送邮件通知
        if self._email_handler:
            email_result = self._send_email_notification(
                work_order_id=work_order_id,
                work_order_title=work_order_title,
                recipient_email=recipient_email,
                action=action,
                approver_name=approver_name,
                reject_reason=reject_reason
            )
            result = result and email_result
        
        # 发送 WebSocket 通知
        if self._websocket_handler:
            ws_result = self._send_websocket_notification(
                work_order_id=work_order_id,
                recipient_id=recipient_id,
                action=action,
                approver_name=approver_name,
                reject_reason=reject_reason
            )
            result = result and ws_result
        
        logger.info(
            f"Notification sent for work order {work_order_id}: "
            f"action={action.value}, recipient={recipient_id}"
        )
        
        return result

    def _send_email_notification(
        self,
        work_order_id: str,
        work_order_title: str,
        recipient_email: str,
        action: NotificationEvent,
        approver_name: str,
        reject_reason: Optional[str] = None
    ) -> bool:
        """
        发送邮件通知
        
        @param work_order_id 工单ID
        @param work_order_title 工单标题
        @param recipient_email 接收人邮箱
        @param action 审批动作
        @param approver_name 审批人名称
        @param reject_reason 驳回理由
        @returns 是否发送成功
        """
        try:
            if action == NotificationEvent.WORK_ORDER_APPROVED:
                subject = f"【审批通过】工单 {work_order_title} 已通过审批"
                body = self._build_approval_email_body(work_order_id, work_order_title, approver_name)
            else:
                subject = f"【审批驳回】工单 {work_order_title} 未通过审批"
                body = self._build_rejection_email_body(
                    work_order_id, work_order_title, approver_name, reject_reason
                )
            
            self._email_handler.send(
                to=recipient_email,
                subject=subject,
                body=body
            )
            
            logger.debug(f"Email notification sent to {recipient_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
            return False

    def _send_websocket_notification(
        self,
        work_order_id: str,
        recipient_id: str,
        action: NotificationEvent,
        approver_name: str,
        reject_reason: Optional[str] = None
    ) -> bool:
        """
        发送 WebSocket 实时通知
        
        @param work_order_id 工单ID
        @param recipient_id 接收人用户ID
        @param action 审批动作
        @param approver_name 审批人名称
        @param reject_reason 驳回理由
        @returns 是否发送成功
        """
        try:
            payload = {
                "event": action.value,
                "work_order_id": work_order_id,
                "approver_name": approver_name,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if action == NotificationEvent.WORK_ORDER_REJECTED:
                payload["reject_reason"] = reject_reason
            
            self._websocket_handler.push(
                user_id=recipient_id,
                event=action.value,
                data=payload
            )
            
            logger.debug(f"WebSocket notification pushed to user {recipient_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send WebSocket notification: {e}")
            return False

    def _build_approval_email_body(
        self,
        work_order_id: str,
        work_order_title: str,
        approver_name: str
    ) -> str:
        """
        构建审批通过邮件正文
        
        @param work_order_id 工单ID
        @param work_order_title 工单标题
        @param approver_name 审批人名称
        @returns 邮件正文
        """
        return f"""
您好，

您的工单「{work_order_title}」（编号：{work_order_id}）已通过审批。

审批人：{approver_name}
审批时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

请登录系统查看详情。

此致
资产管理团队
""".strip()

    def _build_rejection_email_body(
        self,
        work_order_id: str,
        work_order_title: str,
        approver_name: str,
        reject_reason: str
    ) -> str:
        """
        构建审批驳回邮件正文
        
        @param work_order_id 工单ID
        @param work_order_title 工单标题
        @param approver_name 审批人名称
        @param reject_reason 驳回理由
        @returns 邮件正文
        """
        return f"""
您好，

您的工单「{work_order_title}」（编号：{work_order_id}）未通过审批。

审批人：{approver_name}
审批时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

驳回原因：
{reject_reason}

请根据驳回原因修改工单后重新提交。

此致
资产管理团队
""".strip()