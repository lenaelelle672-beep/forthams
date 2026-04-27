"""
Notification Publisher Module

实现工单审批流程的通知发布功能。
支持异步通知发送（Email/WebSocket/IM），确保通知失败不阻塞审批响应。

Author: Spec Engineering
Task: SWARM-2025-Q2-P0-003 (Iteration 9)
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum
import uuid
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class NotificationType(Enum):
    """通知类型枚举"""
    EMAIL = "email"
    WEBSOCKET = "websocket"
    IM = "im"  # Instant Messaging
    SMS = "sms"


class NotificationPriority(Enum):
    """通知优先级枚举"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class NotificationPayload:
    """通知载荷数据结构"""
    notification_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    work_order_id: str = ""
    recipient_id: str = ""
    notification_type: NotificationType = NotificationType.EMAIL
    priority: NotificationPriority = NotificationPriority.MEDIUM
    title: str = ""
    message: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: str = "pending"  # pending, sent, failed
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "notification_id": self.notification_id,
            "work_order_id": self.work_order_id,
            "recipient_id": self.recipient_id,
            "notification_type": self.notification_type.value,
            "priority": self.priority.value,
            "title": self.title,
            "message": self.message,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "status": self.status,
        }


class NotificationPublisher:
    """
    通知发布器
    
    负责将通知事件发布到消息队列，支持多种通知渠道。
    确保通知发送失败不阻塞主业务流程（异步处理）。
    
    Attributes:
        _queue: 消息队列实例（支持 Redis/RabbitMQ 等）
        _handlers: 各通知类型的处理器映射
    """
    
    def __init__(self, queue_backend: Optional[Any] = None):
        """
        初始化通知发布器
        
        Args:
            queue_backend: 消息队列后端，默认使用内存队列
        """
        self._queue = queue_backend or []
        self._handlers: Dict[NotificationType, callable] = {}
        self._idempotency_cache: Dict[str, bool] = {}
        self._setup_default_handlers()
        
    def _setup_default_handlers(self) -> None:
        """设置默认通知处理器"""
        self._handlers[NotificationType.EMAIL] = self._handle_email
        self._handlers[NotificationType.WEBSOCKET] = self._handle_websocket
        self._handlers[NotificationType.IM] = self._handle_im
        
    def _handle_email(self, payload: NotificationPayload) -> bool:
        """
        处理邮件通知
        
        Args:
            payload: 通知载荷
            
        Returns:
            bool: 发送是否成功
        """
        logger.info(
            f"[EMAIL] Sending notification {payload.notification_id} "
            f"to {payload.recipient_id}: {payload.title}"
        )
        # 实际实现应调用邮件服务 API
        return True
        
    def _handle_websocket(self, payload: NotificationPayload) -> bool:
        """
        处理 WebSocket 通知
        
        Args:
            payload: 通知载荷
            
        Returns:
            bool: 发送是否成功
        """
        logger.info(
            f"[WEBSOCKET] Sending notification {payload.notification_id} "
            f"to {payload.recipient_id}: {payload.title}"
        )
        # 实际实现应通过 WebSocket 推送
        return True
        
    def _handle_im(self, payload: NotificationPayload) -> bool:
        """
        处理即时通讯通知
        
        Args:
            payload: 通知载荷
            
        Returns:
            bool: 发送是否成功
        """
        logger.info(
            f"[IM] Sending notification {payload.notification_id} "
            f"to {payload.recipient_id}: {payload.title}"
        )
        # 实际实现应调用 IM 服务 API
        return True

    def publish_approval_notification(
        self,
        work_order_id: str,
        recipient_id: str,
        action: str,  # "approved" or "rejected"
        approver_name: str,
        comment: Optional[str] = None
    ) -> str:
        """
        发布审批结果通知
        
        当工单被审批通过或拒绝时，通知相关人员。
        
        Args:
            work_order_id: 工单ID
            recipient_id: 接收人ID
            action: 审批动作（approved/rejected）
            approver_name: 审批人姓名
            comment: 审批意见
            
        Returns:
            str: 通知ID
        """
        notification_type = NotificationType.WEBSOCKET
        priority = (
            NotificationPriority.HIGH if action == "rejected" 
            else NotificationPriority.MEDIUM
        )
        
        title = f"工单审批结果通知"
        message = (
            f"您好，您提交的工单（ID: {work_order_id}）已被"
            f"{approver_name}{'通过' if action == 'approved' else '拒绝'}。"
        )
        if comment:
            message += f"\n审批意见：{comment}"
            
        payload = NotificationPayload(
            work_order_id=work_order_id,
            recipient_id=recipient_id,
            notification_type=notification_type,
            priority=priority,
            title=title,
            message=message,
            metadata={
                "action": action,
                "approver_name": approver_name,
                "comment": comment,
            }
        )
        
        return self._publish_async(payload)
        
    def publish_status_change_notification(
        self,
        work_order_id: str,
        recipient_ids: List[str],
        old_status: str,
        new_status: str,
        operator_name: str
    ) -> List[str]:
        """
        发布状态变更通知
        
        当工单状态发生变更时，通知相关人员。
        
        Args:
            work_order_id: 工单ID
            recipient_ids: 接收人ID列表
            old_status: 旧状态
            new_status: 新状态
            operator_name: 操作人姓名
            
        Returns:
            List[str]: 通知ID列表
        """
        notification_ids = []
        
        title = f"工单状态变更通知"
        message = (
            f"工单（ID: {work_order_id}）状态已从 "
            f"{old_status} 变更为 {new_status}。"
            f"\n操作人：{operator_name}"
        )
        
        for recipient_id in recipient_ids:
            payload = NotificationPayload(
                work_order_id=work_order_id,
                recipient_id=recipient_id,
                notification_type=NotificationType.IM,
                priority=NotificationPriority.MEDIUM,
                title=title,
                message=message,
                metadata={
                    "old_status": old_status,
                    "new_status": new_status,
                    "operator_name": operator_name,
                }
            )
            notification_ids.append(self._publish_async(payload))
            
        return notification_ids
        
    def _publish_async(self, payload: NotificationPayload) -> str:
        """
        异步发布通知
        
        将通知放入消息队列，不阻塞主业务流程。
        支持幂等性检查，防止重复发送。
        
        Args:
            payload: 通知载荷
            
        Returns:
            str: 通知ID
        """
        # 幂等性检查
        idempotency_key = self._generate_idempotency_key(payload)
        if self._idempotency_cache.get(idempotency_key):
            logger.warning(
                f"Duplicate notification detected: {idempotency_key}"
            )
            return payload.notification_id
            
        # 放入队列
        self._queue.append(payload.to_dict())
        self._idempotency_cache[idempotency_key] = True
        
        logger.info(
            f"[ASYNC] Notification {payload.notification_id} "
            f"queued for {payload.recipient_id}"
        )
        
        return payload.notification_id
        
    def _generate_idempotency_key(self, payload: NotificationPayload) -> str:
        """
        生成幂等性键
        
        Args:
            payload: 通知载荷
            
        Returns:
            str: 幂等性键
        """
        return f"{payload.work_order_id}:{payload.notification_type.value}:{payload.created_at.isoformat()}"
        
    def process_queue(self) -> Dict[str, int]:
        """
        处理消息队列
        
        消费队列中的通知并发送。
        通常由后台任务调用。
        
        Returns:
            Dict[str, int]: 处理结果统计
        """
        results = {"success": 0, "failed": 0}
        processed = []
        
        for idx, item in enumerate(self._queue):
            try:
                handler = self._handlers.get(
                    NotificationType(item["notification_type"])
                )
                if handler:
                    payload = NotificationPayload(**{
                        k: v for k, v in item.items() 
                        if k != "created_at"
                    })
                    payload.created_at = datetime.fromisoformat(
                        item["created_at"]
                    )
                    
                    if handler(payload):
                        results["success"] += 1
                        processed.append(idx)
                    else:
                        results["failed"] += 1
                else:
                    results["failed"] += 1
            except Exception as e:
                logger.error(f"Failed to process notification: {e}")
                results["failed"] += 1
                
        # 清理已处理的项
        for idx in reversed(processed):
            self._queue.pop(idx)
            
        return results
        
    def get_queue_status(self) -> Dict[str, Any]:
        """
        获取队列状态
        
        Returns:
            Dict[str, Any]: 队列状态信息
        """
        return {
            "queue_length": len(self._queue),
            "idempotency_cache_size": len(self._idempotency_cache),
            "handlers_registered": list(self._handlers.keys()),
        }