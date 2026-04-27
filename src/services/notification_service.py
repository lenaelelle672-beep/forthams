"""
工单审批通知服务模块

本模块实现工单审批流程中的通知功能，包括：
- 审批通过/驳回后的邮件通知
- 站内信通知
- 通知失败重试机制

版本: v3.0
迭代: SWARM-2025-Q2-P0-003 Iteration 3
"""

import logging
from datetime import datetime
from enum import Enum
from typing import Any, Optional

# 通知重试配置常量
MAX_RETRY_ATTEMPTS = 3
RETRY_INTERVALS = [30, 60, 120]  # 秒
RETRY_TIMEOUT_SECONDS = 10

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """通知类型枚举"""
    EMAIL = "email"
    IN_APP = "in_app"
    SMS = "sms"
    WECHAT = "wechat"


class NotificationStatus(str, Enum):
    """通知状态枚举"""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"


class NotificationPriority(str, Enum):
    """通知优先级枚举"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class WorkOrderNotificationService:
    """
    工单审批通知服务
    
    负责在工单审批状态变更后发送通知，支持多种通知渠道。
    具备重试机制以确保通知可靠性。
    
    Attributes:
        _notification_producer: 通知消息生产者
        _email_handler: 邮件通知处理器
        _in_app_handler: 站内信处理器
    """
    
    def __init__(
        self,
        notification_producer: Optional[Any] = None,
        email_handler: Optional[Any] = None,
        in_app_handler: Optional[Any] = None
    ):
        """
        初始化通知服务
        
        Args:
            notification_producer: 通知消息队列生产者，用于异步发送通知
            email_handler: 邮件处理器
            in_app_handler: 站内信处理器
        """
        self._notification_producer = notification_producer
        self._email_handler = email_handler
        self._in_app_handler = in_app_handler
        self._retry_count = {}
        
    def send_approval_notification(
        self,
        work_order_id: str,
        work_order_title: str,
        action: str,
        approver_name: str,
        recipient_email: str,
        recipient_user_id: str,
        comment: Optional[str] = None
    ) -> dict:
        """
        发送审批结果通知
        
        在工单审批完成后调用，通知相关人员审批结果。
        
        Args:
            work_order_id: 工单ID
            work_order_title: 工单标题
            action: 审批动作 ('approve' 或 'reject')
            approver_name: 审批人姓名
            recipient_email: 接收人邮箱
            recipient_user_id: 接收人用户ID
            comment: 审批备注
            
        Returns:
            dict: 包含发送状态的字典，格式:
                {
                    "success": bool,
                    "notification_id": str,
                    "channels": {
                        "email": {"status": str, "message_id": str},
                        "in_app": {"status": str, "notification_id": str}
                    },
                    "errors": [str]  # 如果有部分失败
                }
                
        Raises:
            NotificationException: 通知发送失败且重试耗尽时抛出
        """
        logger.info(
            f"Sending approval notification for work order {work_order_id}, "
            f"action={action}, recipient={recipient_email}"
        )
        
        action_text = "通过" if action == "approve" else "驳回"
        notification_data = {
            "work_order_id": work_order_id,
            "work_order_title": work_order_title,
            "action": action,
            "action_text": action_text,
            "approver_name": approver_name,
            "approver_id": recipient_user_id,
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat(),
            "priority": NotificationPriority.HIGH if action == "reject" else NotificationPriority.NORMAL
        }
        
        result = {
            "success": True,
            "notification_id": f"notif_{work_order_id}_{int(datetime.utcnow().timestamp())}",
            "channels": {},
            "errors": []
        }
        
        # 发送邮件通知
        email_result = self._send_email_notification(
            recipient_email=recipient_email,
            subject=f"工单审批结果通知：{work_order_title}",
            notification_data=notification_data
        )
        result["channels"]["email"] = email_result
        
        # 发送站内信通知
        in_app_result = self._send_in_app_notification(
            user_id=recipient_user_id,
            title=f"工单审批{action_text}",
            content=self._build_in_app_content(notification_data),
            notification_data=notification_data
        )
        result["channels"]["in_app"] = in_app_result
        
        # 检查是否有失败
        if not email_result.get("success") and not in_app_result.get("success"):
            result["success"] = False
            result["errors"].append("All notification channels failed")
            
        logger.info(
            f"Approval notification sent for work order {work_order_id}: "
            f"success={result['success']}"
        )
        
        return result
    
    def _send_email_notification(
        self,
        recipient_email: str,
        subject: str,
        notification_data: dict
    ) -> dict:
        """
        发送邮件通知（带重试机制）
        
        Args:
            recipient_email: 接收人邮箱
            subject: 邮件主题
            notification_data: 通知数据
            
        Returns:
            dict: 包含发送结果的字典
        """
        notification_key = f"email_{recipient_email}_{notification_data['work_order_id']}"
        
        for attempt in range(MAX_RETRY_ATTEMPTS):
            try:
                if self._notification_producer:
                    # 使用消息队列异步发送
                    message = {
                        "type": NotificationType.EMAIL.value,
                        "recipient": recipient_email,
                        "subject": subject,
                        "body": self._build_email_body(notification_data),
                        "metadata": notification_data,
                        "retry_count": attempt
                    }
                    self._notification_producer.publish(message)
                    return {"success": True, "status": "queued", "message_id": message.get("id")}
                
                elif self._email_handler:
                    # 直接发送
                    self._email_handler.send(
                        to=recipient_email,
                        subject=subject,
                        body=self._build_email_body(notification_data)
                    )
                    return {"success": True, "status": "sent"}
                    
            except Exception as e:
                logger.warning(
                    f"Email notification failed (attempt {attempt + 1}/{MAX_RETRY_ATTEMPTS}): "
                    f"{str(e)}"
                )
                
                if attempt < MAX_RETRY_ATTEMPTS - 1:
                    import time
                    retry_delay = RETRY_INTERVALS[attempt] if attempt < len(RETRY_INTERVALS) else RETRY_INTERVALS[-1]
                    logger.info(f"Retrying email notification in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    
        return {
            "success": False,
            "status": NotificationStatus.FAILED.value,
            "error": f"Failed after {MAX_RETRY_ATTEMPTS} attempts"
        }
    
    def _send_in_app_notification(
        self,
        user_id: str,
        title: str,
        content: str,
        notification_data: dict
    ) -> dict:
        """
        发送站内信通知（带重试机制）
        
        Args:
            user_id: 接收用户ID
            title: 通知标题
            content: 通知内容
            notification_data: 通知数据
            
        Returns:
            dict: 包含发送结果的字典
        """
        notification_key = f"in_app_{user_id}_{notification_data['work_order_id']}"
        
        for attempt in range(MAX_RETRY_ATTEMPTS):
            try:
                if self._in_app_handler:
                    notification_id = self._in_app_handler.send(
                        user_id=user_id,
                        title=title,
                        content=content,
                        category="work_order_approval",
                        metadata=notification_data
                    )
                    return {
                        "success": True,
                        "status": NotificationStatus.SENT.value,
                        "notification_id": notification_id
                    }
                    
                elif self._notification_producer:
                    message = {
                        "type": NotificationType.IN_APP.value,
                        "user_id": user_id,
                        "title": title,
                        "content": content,
                        "category": "work_order_approval",
                        "metadata": notification_data,
                        "retry_count": attempt
                    }
                    self._notification_producer.publish(message)
                    return {
                        "success": True,
                        "status": "queued",
                        "message_id": message.get("id")
                    }
                    
            except Exception as e:
                logger.warning(
                    f"In-app notification failed (attempt {attempt + 1}/{MAX_RETRY_ATTEMPTS}): "
                    f"{str(e)}"
                )
                
                if attempt < MAX_RETRY_ATTEMPTS - 1:
                    import time
                    retry_delay = RETRY_INTERVALS[attempt] if attempt < len(RETRY_INTERVALS) else RETRY_INTERVALS[-1]
                    logger.info(f"Retrying in-app notification in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    
        return {
            "success": False,
            "status": NotificationStatus.FAILED.value,
            "error": f"Failed after {MAX_RETRY_ATTEMPTS} attempts"
        }
    
    def _build_email_body(self, notification_data: dict) -> str:
        """
        构建邮件正文内容
        
        Args:
            notification_data: 通知数据字典
            
        Returns:
            str: HTML 格式的邮件正文
        """
        action = notification_data.get("action_text", "未知操作")
        comment = notification_data.get("comment", "")
        
        return f"""
        <html>
        <body>
            <h2>工单审批结果通知</h2>
            <p>您好，</p>
            <p>您提交的工单 <strong>"{notification_data['work_order_title']}"</strong> 已完成审批。</p>
            <table style="border-collapse: collapse; width: 100%;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>工单编号</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{notification_data['work_order_id']}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>审批结果</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: {'green' if action == '通过' else 'red'};">
                        {action}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>审批人</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{notification_data['approver_name']}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>审批时间</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{notification_data['timestamp']}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>审批意见</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{comment or '无'}</td>
                </tr>
            </table>
            <p style="margin-top: 20px;">
                请登录系统查看详情。
            </p>
        </body>
        </html>
        """
    
    def _build_in_app_content(self, notification_data: dict) -> str:
        """
        构建站内信内容
        
        Args:
            notification_data: 通知数据字典
            
        Returns:
            str: 站内信内容文本
        """
        action = notification_data.get("action_text", "未知操作")
        comment = notification_data.get("comment", "")
        
        content = f"您提交的工单「{notification_data['work_order_title']}」已被{action}"
        
        if comment:
            content += f"，审批意见：{comment}"
            
        content += f"。审批人：{notification_data['approver_name']}"
        
        return content
    
    def send_batch_notification(
        self,
        notifications: list[dict]
    ) -> dict:
        """
        批量发送通知
        
        用于批量审批后批量发送通知。
        
        Args:
            notifications: 通知列表，每项包含:
                - work_order_id: 工单ID
                - work_order_title: 工单标题
                - action: 审批动作
                - recipient_email: 接收人邮箱
                - recipient_user_id: 接收人用户ID
                - comment: 审批备注（可选）
                
        Returns:
            dict: 批量发送结果统计
        """
        logger.info(f"Sending batch notifications for {len(notifications)} work orders")
        
        results = {
            "total": len(notifications),
            "success": 0,
            "failed": 0,
            "details": []
        }
        
        for notif in notifications:
            try:
                result = self.send_approval_notification(
                    work_order_id=notif["work_order_id"],
                    work_order_title=notif["work_order_title"],
                    action=notif["action"],
                    approver_name=notif.get("approver_name", "系统"),
                    recipient_email=notif["recipient_email"],
                    recipient_user_id=notif["recipient_user_id"],
                    comment=notif.get("comment")
                )
                
                if result["success"]:
                    results["success"] += 1
                else:
                    results["failed"] += 1
                    
                results["details"].append({
                    "work_order_id": notif["work_order_id"],
                    "success": result["success"]
                })
                
            except Exception as e:
                logger.error(
                    f"Failed to send batch notification for work order "
                    f"{notif.get('work_order_id')}: {str(e)}"
                )
                results["failed"] += 1
                results["details"].append({
                    "work_order_id": notif.get("work_order_id"),
                    "success": False,
                    "error": str(e)
                })
                
        logger.info(
            f"Batch notifications completed: {results['success']} success, "
            f"{results['failed']} failed"
        )
        
        return results
    
    def get_notification_status(self, notification_id: str) -> dict:
        """
        查询通知发送状态
        
        Args:
            notification_id: 通知ID
            
        Returns:
            dict: 通知状态信息
        """
        logger.debug(f"Querying notification status for {notification_id}")
        
        # 实际实现应从数据库或消息队列查询状态
        # 此处为占位实现
        return {
            "notification_id": notification_id,
            "status": NotificationStatus.SENT.value,
            "updated_at": datetime.utcnow().isoformat()
        }


class NotificationException(Exception):
    """
    通知服务异常
    
    当通知发送失败且重试耗尽时抛出此异常。
    """
    
    def __init__(self, message: str, notification_id: str = None, original_error: Exception = None):
        """
        初始化通知异常
        
        Args:
            message: 异常消息
            notification_id: 关联的通知ID
            original_error: 原始异常
        """
        super().__init__(message)
        self.notification_id = notification_id
        self.original_error = original_error


# 全局通知服务实例
_notification_service: Optional[WorkOrderNotificationService] = None


def get_notification_service() -> WorkOrderNotificationService:
    """
    获取全局通知服务实例（单例模式）
    
    Returns:
        WorkOrderNotificationService: 通知服务实例
    """
    global _notification_service
    
    if _notification_service is None:
        _notification_service = WorkOrderNotificationService()
        
    return _notification_service


def init_notification_service(
    notification_producer: Any = None,
    email_handler: Any = None,
    in_app_handler: Any = None
) -> WorkOrderNotificationService:
    """
    初始化并配置全局通知服务
    
    Args:
        notification_producer: 通知消息队列生产者
        email_handler: 邮件处理器
        in_app_handler: 站内信处理器
        
    Returns:
        WorkOrderNotificationService: 配置后的通知服务实例
    """
    global _notification_service
    
    _notification_service = WorkOrderNotificationService(
        notification_producer=notification_producer,
        email_handler=email_handler,
        in_app_handler=in_app_handler
    )
    
    logger.info("Notification service initialized successfully")
    
    return _notification_service