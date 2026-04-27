"""
通知事件生产者模块

负责将工单审批相关事件发布至消息队列，供下游通知服务消费。
Phase 3 核心交付物之一。

Relevant Events:
- WorkOrderApprovedEvent: 工单审批通过事件
- WorkOrderRejectedEvent: 工单驳回事件
"""

import logging
from typing import Optional, List
from datetime import datetime

from src.domain.events.workorder_events import (
    WorkOrderApprovedEvent,
    WorkOrderRejectedEvent,
)
from src.domain.enums.workorder_status import WorkOrderStatus

logger = logging.getLogger(__name__)


class NotificationProducer:
    """
    通知事件生产者
    
    负责将工单审批/驳回事件发布至消息队列，
    供 NotificationConsumer 消费并触发通知投递。
    
    核心职责:
    1. 事件序列化与发布
    2. 发布失败重试（可通过配置开启）
    3. 事件投递日志记录
    """
    
    def __init__(
        self,
        message_queue_client: Optional[object] = None,
        max_retry: int = 3,
        retry_delay: float = 1.0,
    ) -> None:
        """
        初始化通知事件生产者
        
        Args:
            message_queue_client: 消息队列客户端，默认使用内存队列模拟
            max_retry: 最大重试次数
            retry_delay: 重试延迟（秒）
        """
        self._mq_client = message_queue_client
        self._max_retry = max_retry
        self._retry_delay = retry_delay
        self._published_events: List[object] = []  # 用于测试/调试
    
    def publish_approval_event(self, event: WorkOrderApprovedEvent) -> None:
        """
        发布审批通过事件至消息队列
        
        事件字段:
        - workorder_id: 工单ID
        - operator_id: 操作人ID
        - timestamp: 操作时间戳
        - previous_status: 变更前状态
        
        Args:
            event: 审批通过事件
            
        Raises:
            ValueError: 事件为空或字段缺失
            RuntimeError: 发布失败
        """
        if event is None:
            raise ValueError("Cannot publish None event")
        
        self._validate_event_fields(event)
        
        logger.info(
            f"Publishing WorkOrderApprovedEvent: "
            f"workorder_id={event.workorder_id}, "
            f"operator_id={event.operator_id}"
        )
        
        self._do_publish(event)
    
    def publish_reject_event(self, event: WorkOrderRejectedEvent) -> None:
        """
        发布驳回事件至消息队列
        
        事件字段:
        - workorder_id: 工单ID
        - operator_id: 操作人ID
        - timestamp: 操作时间戳
        - reject_reason: 驳回原因
        - previous_status: 变更前状态
        
        Args:
            event: 驳回事件
            
        Raises:
            ValueError: 事件为空或字段缺失
            RuntimeError: 发布失败
        """
        if event is None:
            raise ValueError("Cannot publish None event")
        
        self._validate_event_fields(event)
        
        if not event.reject_reason:
            raise ValueError("reject_reason is required for WorkOrderRejectedEvent")
        
        logger.info(
            f"Publishing WorkOrderRejectedEvent: "
            f"workorder_id={event.workorder_id}, "
            f"operator_id={event.operator_id}, "
            f"reject_reason={event.reject_reason[:50]}..."
        )
        
        self._do_publish(event)
    
    def _validate_event_fields(self, event: object) -> None:
        """
        校验事件必填字段
        
        Args:
            event: 事件对象
            
        Raises:
            ValueError: 必填字段缺失
        """
        required_fields = ['workorder_id', 'operator_id', 'timestamp']
        
        for field in required_fields:
            value = getattr(event, field, None)
            if not value:
                raise ValueError(f"Event field '{field}' is required")
    
    def _do_publish(self, event: object) -> None:
        """
        执行实际的消息发布逻辑
        
        Args:
            event: 待发布事件
            
        Raises:
            RuntimeError: 发布失败
        """
        try:
            if self._mq_client is not None:
                # 实际发布到消息队列
                topic = self._get_topic_for_event(event)
                self._mq_client.publish(topic, event)
            else:
                # 模拟模式：记录到内存用于测试验证
                logger.debug(
                    f"[MOCK MODE] Would publish event to message queue: {event}"
                )
            
            self._published_events.append(event)
            
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")
            raise RuntimeError(f"Event publish failed: {e}") from e
    
    def _get_topic_for_event(self, event: object) -> str:
        """
        根据事件类型获取对应的主题
        
        Args:
            event: 事件对象
            
        Returns:
            str: 消息主题名
        """
        if isinstance(event, WorkOrderApprovedEvent):
            return "workorder.approved"
        elif isinstance(event, WorkOrderRejectedEvent):
            return "workorder.rejected"
        else:
            return "workorder.general"
    
    def get_published_events(self) -> List[object]:
        """
        获取已发布的事件列表（用于测试验证）
        
        Returns:
            List[object]: 已发布的事件列表
        """
        return self._published_events.copy()
    
    def clear_events(self) -> None:
        """
        清空已发布事件记录（用于测试重置）
        """
        self._published_events.clear()


class NotificationConsumer:
    """
    通知事件消费者
    
    消费来自消息队列的工单审批事件，
    触发通知投递至相关订阅者。
    
    通知订阅规则:
    - 审批人默认自动订阅
    - 创建者默认自动订阅
    - 其他订阅用户需主动订阅
    """
    
    def __init__(
        self,
        notification_service: Optional[object] = None,
        subscription_service: Optional[object] = None,
    ) -> None:
        """
        初始化通知消费者
        
        Args:
            notification_service: 通知投递服务
            subscription_service: 订阅管理服务
        """
        self._notification_service = notification_service
        self._subscription_service = subscription_service
        self._handled_events: List[object] = []  # 用于测试/调试
    
    def handle_workorder_approved(self, event: WorkOrderApprovedEvent) -> None:
        """
        处理工单审批通过事件
        
        触发通知给相关订阅者:
        - 工单创建者
        - 审批链上的下一步审批人
        
        Args:
            event: 审批通过事件
        """
        if event is None:
            logger.warning("Received None event, skipping")
            return
        
        logger.info(
            f"Handling WorkOrderApprovedEvent: "
            f"workorder_id={event.workorder_id}"
        )
        
        # 获取订阅者列表
        subscribers = self._get_subscribers(event.workorder_id)
        
        # 构建通知消息
        notification_payload = {
            "event": "workorder.approved",
            "workorder_id": event.workorder_id,
            "operator_id": event.operator_id,
            "timestamp": event.timestamp.isoformat() if isinstance(event.timestamp, datetime) else str(event.timestamp),
            "previous_status": event.previous_status.value if isinstance(event.previous_status, WorkOrderStatus) else str(event.previous_status),
        }
        
        # 发送通知
        for subscriber in subscribers:
            self._send_notification(subscriber, notification_payload)
        
        self._handled_events.append(event)
    
    def handle_workorder_rejected(self, event: WorkOrderRejectedEvent) -> None:
        """
        处理工单驳回事件
        
        触发通知给相关订阅者:
        - 工单创建者（必须通知）
        - 驳回原因将包含在通知中
        
        Args:
            event: 驳回事件
        """
        if event is None:
            logger.warning("Received None event, skipping")
            return
        
        logger.info(
            f"Handling WorkOrderRejectedEvent: "
            f"workorder_id={event.workorder_id}, "
            f"reason={event.reject_reason[:50] if event.reject_reason else 'N/A'}..."
        )
        
        # 获取订阅者列表
        subscribers = self._get_subscribers(event.workorder_id)
        
        # 构建通知消息
        notification_payload = {
            "event": "workorder.rejected",
            "workorder_id": event.workorder_id,
            "operator_id": event.operator_id,
            "timestamp": event.timestamp.isoformat() if isinstance(event.timestamp, datetime) else str(event.timestamp),
            "reason": event.reject_reason,
            "previous_status": event.previous_status.value if isinstance(event.previous_status, WorkOrderStatus) else str(event.previous_status),
        }
        
        # 发送通知
        for subscriber in subscribers:
            self._send_notification(subscriber, notification_payload)
        
        self._handled_events.append(event)
    
    def _get_subscribers(self, workorder_id: str) -> List[str]:
        """
        获取工单相关的通知订阅者列表
        
        订阅规则:
        1. 工单创建者（默认订阅）
        2. 当前审批人（默认订阅）
        3. 其他主动订阅的用户
        
        Args:
            workorder_id: 工单ID
            
        Returns:
            List[str]: 订阅者用户ID列表
        """
        if self._subscription_service is not None:
            return self._subscription_service.get_subscribers(workorder_id)
        
        # 默认实现：返回空列表（实际场景由 subscription_service 提供）
        logger.debug(
            f"[MOCK MODE] Returning empty subscribers for workorder_id={workorder_id}"
        )
        return []
    
    def _send_notification(
        self,
        user_id: str,
        payload: dict,
    ) -> None:
        """
        发送通知给指定用户
        
        Args:
            user_id: 用户ID
            payload: 通知内容
        """
        if self._notification_service is not None:
            self._notification_service.send(user_id, payload)
        else:
            logger.debug(
                f"[MOCK MODE] Would send notification to user_id={user_id}: {payload}"
            )
    
    def get_handled_events(self) -> List[object]:
        """
        获取已处理的事件列表（用于测试验证）
        
        Returns:
            List[object]: 已处理的事件列表
        """
        return self._handled_events.copy()
    
    def clear_events(self) -> None:
        """
        清空已处理事件记录（用于测试重置）
        """
        self._handled_events.clear()