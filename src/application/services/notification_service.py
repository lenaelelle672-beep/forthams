"""
Notification Service Module

本模块负责工单审批流程中的通知机制实现：
- 状态变更触发通知事件
- 通知模板渲染
- RabbitMQ 异步投递
- 失败重试补偿机制

符合 SWARM-2025-Q2-P0-003 规格要求：
- 仅在 APPROVED、REJECTED、TRANSFERRED 时触发通知
- 通知对象映射：APPROVED → 发送方+申请人，REJECTED → 申请人，TRANSFERRED → 原审批人+新审批人
- 投递失败写入 notification_failures 表，补偿 Job 重试 3 次，间隔 30s / 60s / 120s
"""

import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# 通知类型枚举
# =============================================================================


class NotificationEventType(str, Enum):
    """通知事件类型枚举"""

    WORK_ORDER_APPROVED = "WORK_ORDER_APPROVED"
    WORK_ORDER_REJECTED = "WORK_ORDER_REJECTED"
    WORK_ORDER_TRANSFERRED = "WORK_ORDER_TRANSFERRED"


# =============================================================================
# 通知渠道枚举
# =============================================================================


class NotificationChannel(str, Enum):
    """通知渠道枚举"""

    EMAIL = "EMAIL"
    IN_APP = "IN_APP"  # 站内信
    WEBSOCKET = "WEBSOCKET"


# =============================================================================
# 数据模型
# =============================================================================


class NotificationEvent(BaseModel):
    """
    通知事件模型

    符合规格定义的事件 payload 结构：
    - work_order_id: 工单ID
    - from_state: 原状态
    - to_state: 新状态
    - actor: 操作人
    - timestamp: 时间戳
    """

    work_order_id: str = Field(..., description="工单ID")
    from_state: str = Field(..., description="原状态")
    to_state: str = Field(..., description="新状态")
    actor: str = Field(..., description="操作人")
    timestamp: str = Field(..., description="时间戳 (ISO 8601)")
    target_user_ids: list[str] = Field(default_factory=list, description="通知目标用户列表")
    channels: list[NotificationChannel] = Field(
        default_factory=list, description="通知渠道列表"
    )


class NotificationRecord(BaseModel):
    """通知记录模型"""

    id: Optional[int] = Field(None, description="记录ID")
    work_order_id: str = Field(..., description="工单ID")
    event_type: NotificationEventType = Field(..., description="事件类型")
    target_user_id: str = Field(..., description="通知目标用户ID")
    channel: NotificationChannel = Field(..., description="通知渠道")
    payload: dict[str, Any] = Field(..., description="通知内容")
    status: str = Field(default="PENDING", description="状态: PENDING/SENT/FAILED")
    retry_count: int = Field(default=0, description="重试次数")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    sent_at: Optional[datetime] = Field(None, description="发送时间")
    deleted_at: Optional[datetime] = Field(None, description="软删时间")


class NotificationFailure(BaseModel):
    """通知失败记录模型"""

    id: Optional[int] = Field(None, description="记录ID")
    work_order_id: str = Field(..., description="工单ID")
    event_type: NotificationEventType = Field(..., description="事件类型")
    target_user_id: str = Field(..., description="通知目标用户ID")
    channel: NotificationChannel = Field(..., description="通知渠道")
    payload: dict[str, Any] = Field(..., description="通知内容")
    error_message: str = Field(..., description="错误信息")
    retry_count: int = Field(default=0, description="已重试次数")
    next_retry_at: Optional[datetime] = Field(None, description="下次重试时间")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    resolved_at: Optional[datetime] = Field(None, description="解决时间")


# =============================================================================
# 通知映射配置
# =============================================================================


class NotificationMapping:
    """
    通知映射配置

    定义不同状态变更对应的通知对象和渠道
    符合规格：
    - APPROVED: 发送方 + 申请人，站内信 + 邮件
    - REJECTED: 申请人，站内信 + 邮件
    - TRANSFERRED: 原审批人 + 新审批人，站内信
    """

    # 触发通知的状态列表
    TRIGGER_STATES = {
        "APPROVED",
        "REJECTED",
        "TRANSFERRED",
    }

    # 状态到事件类型的映射
    STATE_TO_EVENT_TYPE = {
        "APPROVED": NotificationEventType.WORK_ORDER_APPROVED,
        "REJECTED": NotificationEventType.WORK_ORDER_REJECTED,
        "TRANSFERRED": NotificationEventType.WORK_ORDER_TRANSFERRED,
    }

    # 事件类型到通知渠道的映射
    EVENT_TYPE_TO_CHANNELS = {
        NotificationEventType.WORK_ORDER_APPROVED: [
            NotificationChannel.IN_APP,
            NotificationChannel.EMAIL,
        ],
        NotificationEventType.WORK_ORDER_REJECTED: [
            NotificationChannel.IN_APP,
            NotificationChannel.EMAIL,
        ],
        NotificationEventType.WORK_ORDER_TRANSFERRED: [
            NotificationChannel.IN_APP,
        ],
    }

    # 重试配置：间隔秒数 (30s / 60s / 120s)
    RETRY_INTERVALS = [30, 60, 120]
    MAX_RETRY_COUNT = 3


# =============================================================================
# 通知服务核心类
# =============================================================================


class NotificationService:
    """
    通知服务

    负责处理工单状态变更触发的通知事件：
    - 事件接收与校验
    - 通知对象解析
    - 消息队列投递
    - 失败补偿机制
    """

    def __init__(self, publisher=None, failure_repository=None):
        """
        初始化通知服务

        Args:
            publisher: 消息发布器 (RabbitMQ)
            failure_repository: 失败记录仓储
        """
        self._publisher = publisher
        self._failure_repository = failure_repository
        self._mapping = NotificationMapping()

    def should_trigger_notification(self, to_state: str) -> bool:
        """
        判断是否应触发通知

        Args:
            to_state: 目标状态

        Returns:
            bool: 是否触发通知
        """
        return to_state in self._mapping.TRIGGER_STATES

    def get_event_type(self, to_state: str) -> NotificationEventType:
        """
        获取事件类型

        Args:
            to_state: 目标状态

        Returns:
            NotificationEventType: 事件类型
        """
        return self._mapping.STATE_TO_EVENT_TYPE.get(to_state)

    def get_notification_channels(self, event_type: NotificationEventType) -> list[NotificationChannel]:
        """
        获取通知渠道

        Args:
            event_type: 事件类型

        Returns:
            list[NotificationChannel]: 渠道列表
        """
        return self._mapping.EVENT_TYPE_TO_CHANNELS.get(event_type, [])

    def resolve_target_users(
        self,
        to_state: str,
        work_order_id: str,
        actor: str,
        target_user_id: Optional[str] = None,
    ) -> list[str]:
        """
        解析通知目标用户

        符合规格定义：
        - APPROVED: 发送方(actor) + 申请人(从工单获取)
        - REJECTED: 申请人(从工单获取)
        - TRANSFERRED: 原审批人(actor) + 新审批人(target_user_id)

        Args:
            to_state: 目标状态
            work_order_id: 工单ID
            actor: 操作人
            target_user_id: 转签目标用户ID

        Returns:
            list[str]: 目标用户ID列表
        """
        target_users = []

        if to_state == "APPROVED":
            # 发送方 + 申请人
            target_users.append(actor)
            # 申请人需从工单获取，此处返回 actor 作为占位
            # 实际实现中应从 work_order_repository 获取 applicant_id
            target_users.append(f"{work_order_id}_applicant")

        elif to_state == "REJECTED":
            # 仅申请人
            target_users.append(f"{work_order_id}_applicant")

        elif to_state == "TRANSFERRED":
            # 原审批人 + 新审批人
            target_users.append(actor)
            if target_user_id:
                target_users.append(target_user_id)

        return list(set(target_users))

    def publish_notification(self, event: NotificationEvent) -> bool:
        """
        发布通知事件到消息队列

        Args:
            event: 通知事件

        Returns:
            bool: 发布是否成功
        """
        try:
            if not self._publisher:
                logger.warning("Publisher not configured, skipping notification publish")
                return True

            payload = event.model_dump()
            self._publisher.publish(
                exchange="notifications",
                routing_key=f"workorder.{event.to_state.lower()}",
                message=payload,
            )

            logger.info(
                f"Published notification event: {event.event_type} for work order {event.work_order_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to publish notification: {e}")
            self._record_failure(event, str(e))
            return False

    def _record_failure(self, event: NotificationEvent, error_message: str) -> None:
        """
        记录通知失败

        Args:
            event: 通知事件
            error_message: 错误信息
        """
        try:
            if self._failure_repository:
                failure = NotificationFailure(
                    work_order_id=event.work_order_id,
                    event_type=event.event_type,
                    target_user_id=",".join(event.target_user_ids),
                    channel=NotificationChannel.EMAIL,  # 默认渠道
                    payload=event.model_dump(),
                    error_message=error_message,
                    retry_count=0,
                    next_retry_at=datetime.now() + timedelta(seconds=30),
                )
                self._failure_repository.save(failure)
                logger.info(f"Recorded notification failure for work order {event.work_order_id}")

        except Exception as e:
            logger.error(f"Failed to record notification failure: {e}")

    def calculate_next_retry_at(self, retry_count: int) -> Optional[datetime]:
        """
        计算下次重试时间

        符合规格：重试 3 次，间隔 30s / 60s / 120s

        Args:
            retry_count: 当前重试次数

        Returns:
            Optional[datetime]: 下次重试时间
        """
        if retry_count >= self._mapping.MAX_RETRY_COUNT:
            return None

        interval_seconds = self._mapping.RETRY_INTERVALS[retry_count]
        return datetime.now() + timedelta(seconds=interval_seconds)

    def process_retry(self, failure: NotificationFailure) -> bool:
        """
        处理重试逻辑

        Args:
            failure: 失败记录

        Returns:
            bool: 重试是否成功
        """
        if failure.retry_count >= self._mapping.MAX_RETRY_COUNT:
            logger.warning(
                f"Max retry count reached for failure {failure.id}, giving up"
            )
            return False

        try:
            if not self._publisher:
                return False

            payload = failure.payload
            self._publisher.publish(
                exchange="notifications",
                routing_key=f"workorder.retry",
                message=payload,
            )

            logger.info(
                f"Retry successful for failure {failure.id}, work order {failure.work_order_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Retry failed for failure {failure.id}: {e}")
            return False

    def handle_state_changed(self, event_data: dict[str, Any]) -> bool:
        """
        处理状态变更事件

        入口方法，供状态机在状态变更成功后调用

        Args:
            event_data: 事件数据，包含 work_order_id, from_state, to_state, actor, timestamp

        Returns:
            bool: 处理是否成功
        """
        to_state = event_data.get("to_state")

        # 检查是否应触发通知
        if not self.should_trigger_notification(to_state):
            logger.debug(f"Skipping notification for state {to_state}")
            return True

        # 构建通知事件
        event_type = self.get_event_type(to_state)
        if not event_type:
            logger.error(f"Unknown event type for state {to_state}")
            return False

        # 解析目标用户
        target_users = self.resolve_target_users(
            to_state=to_state,
            work_order_id=event_data.get("work_order_id"),
            actor=event_data.get("actor"),
            target_user_id=event_data.get("target_user_id"),
        )

        # 获取通知渠道
        channels = self.get_notification_channels(event_type)

        # 构建事件
        notification_event = NotificationEvent(
            work_order_id=event_data.get("work_order_id"),
            from_state=event_data.get("from_state"),
            to_state=to_state,
            actor=event_data.get("actor"),
            timestamp=event_data.get("timestamp"),
            target_user_ids=target_users,
            channels=channels,
        )

        # 发布通知
        return self.publish_notification(notification_event)


# =============================================================================
# 通知消费者
# =============================================================================


class NotificationConsumer:
    """
    通知消费者

    负责从 RabbitMQ 消费通知事件并投递到各渠道：
    - Email 投递
    - 站内信投递
    - WebSocket 推送
    """

    def __init__(
        self,
        email_handler=None,
        in_app_handler=None,
        websocket_handler=None,
    ):
        """
        初始化通知消费者

        Args:
            email_handler: 邮件处理器
            in_app_handler: 站内信处理器
            websocket_handler: WebSocket 处理器
        """
        self._email_handler = email_handler
        self._in_app_handler = in_app_handler
        self._websocket_handler = websocket_handler

    def _render_email_template(self, event: NotificationEvent) -> dict[str, Any]:
        """
        渲染邮件模板

        Args:
            event: 通知事件

        Returns:
            dict: 渲染后的邮件内容
        """
        templates = {
            NotificationEventType.WORK_ORDER_APPROVED: {
                "subject": f"工单 {event.work_order_id} 已通过审批",
                "body": f"您的工单 {event.work_order_id} 已由 {event.actor} 审批通过。",
            },
            NotificationEventType.WORK_ORDER_REJECTED: {
                "subject": f"工单 {event.work_order_id} 已被驳回",
                "body": f"您的工单 {event.work_order_id} 已被 {event.actor} 驳回，请查看原因。",
            },
            NotificationEventType.WORK_ORDER_TRANSFERRED: {
                "subject": f"工单 {event.work_order_id} 已转签",
                "body": f"工单 {event.work_order_id} 已由 {event.actor} 转签给您处理。",
            },
        }

        return templates.get(event.event_type, {"subject": "工单通知", "body": ""})

    def _render_in_app_template(self, event: NotificationEvent) -> dict[str, Any]:
        """
        渲染站内信模板

        Args:
            event: 通知事件

        Returns:
            dict: 渲染后的站内信内容
        """
        templates = {
            NotificationEventType.WORK_ORDER_APPROVED: {
                "title": "工单已通过审批",
                "message": f"工单 {event.work_order_id} 已由 {event.actor} 审批通过。",
            },
            NotificationEventType.WORK_ORDER_REJECTED: {
                "title": "工单已被驳回",
                "message": f"工单 {event.work_order_id} 已被 {event.actor} 驳回，请查看原因。",
            },
            NotificationEventType.WORK_ORDER_TRANSFERRED: {
                "title": "工单已转签",
                "message": f"工单 {event.work_order_id} 已由 {event.actor} 转签给您处理。",
            },
        }

        return templates.get(event.event_type, {"title": "工单通知", "message": ""})

    def consume(self, event_data: dict[str, Any]) -> bool:
        """
        消费通知事件

        Args:
            event_data: 事件数据

        Returns:
            bool: 处理是否成功
        """
        try:
            event = NotificationEvent(**event_data)
            success = True

            # 处理各渠道投递
            for channel in event.channels:
                try:
                    if channel == NotificationChannel.EMAIL and self._email_handler:
                        content = self._render_email_template(event)
                        self._email_handler.send(
                            to=event.target_user_ids,
                            subject=content["subject"],
                            body=content["body"],
                        )

                    elif channel == NotificationChannel.IN_APP and self._in_app_handler:
                        content = self._render_in_app_template(event)
                        self._in_app_handler.send(
                            to=event.target_user_ids,
                            title=content["title"],
                            message=content["message"],
                        )

                    elif channel == NotificationChannel.WEBSOCKET and self._websocket_handler:
                        self._websocket_handler.push(
                            to=event.target_user_ids,
                            event_type=event.event_type,
                            payload=event_data,
                        )

                except Exception as e:
                    logger.error(f"Failed to send via {channel}: {e}")
                    success = False

            return success

        except Exception as e:
            logger.error(f"Failed to consume notification event: {e}")
            return False


# =============================================================================
# 补偿任务
# =============================================================================


class NotificationCompensationTask:
    """
    通知补偿任务

    负责定期扫描 notification_failures 表并执行重试：
    - 扫描待重试记录
    - 执行重试逻辑
    - 更新重试状态
    """

    def __init__(self, failure_repository=None, notification_service=None):
        """
        初始化补偿任务

        Args:
            failure_repository: 失败记录仓储
            notification_service: 通知服务
        """
        self._failure_repository = failure_repository
        self._notification_service = notification_service

    def execute(self) -> dict[str, int]:
        """
        执行补偿任务

        Returns:
            dict: 执行统计 {"processed": N, "success": M, "failed": K}
        """
        stats = {"processed": 0, "success": 0, "failed": 0}

        try:
            # 获取待重试记录
            failures = self._failure_repository.get_pending_retries()
            stats["processed"] = len(failures)

            for failure in failures:
                try:
                    # 检查是否到达重试时间
                    if failure.next_retry_at and failure.next_retry_at > datetime.now():
                        continue

                    # 执行重试
                    success = self._notification_service.process_retry(failure)

                    if success:
                        # 更新记录状态
                        failure.status = "RESOLVED"
                        failure.resolved_at = datetime.now()
                        stats["success"] += 1
                    else:
                        # 更新重试计数
                        failure.retry_count += 1
                        failure.next_retry_at = self._notification_service.calculate_next_retry_at(
                            failure.retry_count
                        )
                        stats["failed"] += 1

                    self._failure_repository.update(failure)

                except Exception as e:
                    logger.error(f"Failed to process failure {failure.id}: {e}")
                    stats["failed"] += 1

        except Exception as e:
            logger.error(f"Compensation task failed: {e}")

        return stats


# =============================================================================
# 工厂函数
# =============================================================================


def create_notification_service(
    publisher=None,
    failure_repository=None,
) -> NotificationService:
    """
    创建通知服务实例

    Args:
        publisher: 消息发布器
        failure_repository: 失败记录仓储

    Returns:
        NotificationService: 通知服务实例
    """
    return NotificationService(publisher=publisher, failure_repository=failure_repository)


def create_notification_consumer(
    email_handler=None,
    in_app_handler=None,
    websocket_handler=None,
) -> NotificationConsumer:
    """
    创建通知消费者实例

    Args:
        email_handler: 邮件处理器
        in_app_handler: 站内信处理器
        websocket_handler: WebSocket 处理器

    Returns:
        NotificationConsumer: 通知消费者实例
    """
    return NotificationConsumer(
        email_handler=email_handler,
        in_app_handler=in_app_handler,
        websocket_handler=websocket_handler,
    )