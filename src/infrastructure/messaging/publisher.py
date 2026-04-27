"""
工单审批流程 - 消息发布器模块

SWARM-2025-Q2-P0-003 Iteration 3

本模块负责在工单审批状态变更后，异步触发通知消息到消息队列。
遵循状态机状态变更与通知触发必须原子完成的约束。

状态流转参考:
    PENDING_APPROVAL -> APPROVED (审批通过)
    PENDING_APPROVAL -> REJECTED (审批驳回)

通知触发场景:
    - 审批通过后通知工单创建者
    - 审批驳回后通知工单创建者
    - 工单提交后通知当前审批人

Author: SWARM Team
Version: 3.0
"""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

# 日志配置
logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """
    通知类型枚举
    
    定义系统支持的通知类型，每种类型对应不同的消息模板和路由规则。
    """
    APPROVAL_COMPLETED = "approval_completed"       # 审批完成通知
    APPROVAL_REJECTED = "approval_rejected"         # 审批驳回通知
    WORK_ORDER_SUBMITTED = "work_order_submitted"   # 工单提交通知
    WORK_ORDER_APPROVED = "work_order_approved"      # 工单审批通过
    WORK_ORDER_REJECTED = "work_order_rejected"     # 工单审批驳回


class MessagePriority(str, Enum):
    """
    消息优先级枚举
    
    用于消息队列的优先级配置，高优先级消息会被优先处理。
    """
    HIGH = "high"       # 高优先级 - 立即处理
    NORMAL = "normal"   # 普通优先级 - 标准处理
    LOW = "low"         # 低优先级 - 可延迟处理


class ApprovalAction(str, Enum):
    """
    审批动作枚举
    
    定义工单审批系统支持的操作类型。
    """
    APPROVE = "approve"     # 审批通过
    REJECT = "reject"       # 审批驳回
    SUBMIT = "submit"       # 工单提交
    CANCEL = "cancel"       # 工单取消


class WorkOrderStatus(str, Enum):
    """
    工单状态枚举
    
    定义工单的完整生命周期状态。
    """
    DRAFT = "draft"                         # 草稿状态
    PENDING_APPROVAL = "pending_approval"   # 待审批
    APPROVED = "approved"                   # 已审批通过
    REJECTED = "rejected"                   # 已驳回
    IN_PROGRESS = "in_progress"             # 进行中
    CLOSED = "closed"                        # 已关闭


class NotificationMessage(BaseModel):
    """
    通知消息模型
    
    用于构造和序列化通知消息，确保消息格式的一致性。
    
    Attributes:
        message_id: 消息唯一标识符 (UUID)
        notification_type: 通知类型
        work_order_id: 工单ID
        work_order_title: 工单标题
        action: 审批动作
        from_status: 原始状态
        to_status: 目标状态
        actor_id: 操作人ID
        actor_name: 操作人姓名
        target_user_id: 目标用户ID (通知接收者)
        target_user_email: 目标用户邮箱
        comment: 审批备注
        priority: 消息优先级
        created_at: 消息创建时间
        metadata: 扩展元数据
    """
    message_id: str = Field(..., description="消息唯一标识符")
    notification_type: NotificationType = Field(..., description="通知类型")
    work_order_id: str = Field(..., description="工单ID")
    work_order_title: str = Field(..., description="工单标题")
    action: ApprovalAction = Field(..., description="审批动作")
    from_status: WorkOrderStatus = Field(..., description="原始状态")
    to_status: WorkOrderStatus = Field(..., description="目标状态")
    actor_id: str = Field(..., description="操作人ID")
    actor_name: str = Field(..., description="操作人姓名")
    target_user_id: str = Field(..., description="目标用户ID")
    target_user_email: Optional[str] = Field(None, description="目标用户邮箱")
    comment: Optional[str] = Field(None, description="审批备注")
    priority: MessagePriority = Field(default=MessagePriority.NORMAL, description="消息优先级")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="消息创建时间")
    metadata: dict[str, Any] = Field(default_factory=dict, description="扩展元数据")

    class Config:
        """
        Pydantic 模型配置
        """
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    def to_json(self) -> str:
        """
        将消息序列化为 JSON 字符串
        
        Returns:
            JSON 格式的字符串表示
        """
        return self.model_dump_json()

    def to_dict(self) -> dict[str, Any]:
        """
        将消息转换为字典格式
        
        Returns:
            字典格式的消息数据
        """
        return self.model_dump()


class NotificationPublisher:
    """
    通知消息发布器
    
    负责将审批状态变更事件发布到消息队列，触发异步通知处理。
    支持重试机制和消息追踪。
    
    约束:
        - 消息发送失败时最多重试 3 次，间隔 30s/60s/120s
        - 必须保证消息的可靠投递
        - 支持消息追踪和日志记录
    
    Example:
        >>> publisher = NotificationPublisher()
        >>> message = NotificationMessage(
        ...     message_id="uuid-123",
        ...     notification_type=NotificationType.WORK_ORDER_APPROVED,
        ...     work_order_id="WO-001",
        ...     work_order_title="采购办公设备",
        ...     action=ApprovalAction.APPROVE,
        ...     from_status=WorkOrderStatus.PENDING_APPROVAL,
        ...     to_status=WorkOrderStatus.APPROVED,
        ...     actor_id="user-001",
        ...     actor_name="张三",
        ...     target_user_id="user-002",
        ...     target_user_email="user002@example.com"
        ... )
        >>> publisher.publish(message)
    """

    # 重试配置常量
    MAX_RETRY_ATTEMPTS: int = 3
    RETRY_DELAYS: list[int] = [30, 60, 120]  # 秒

    def __init__(
        self,
        queue_name: str = "approval_notifications",
        enable_retry: bool = True
    ):
        """
        初始化通知发布器
        
        Args:
            queue_name: 消息队列名称，默认为 'approval_notifications'
            enable_retry: 是否启用重试机制，默认为 True
        """
        self.queue_name = queue_name
        self.enable_retry = enable_retry
        self._retry_count: dict[str, int] = {}  # 记录每条消息的重试次数
        logger.info(f"NotificationPublisher initialized with queue: {queue_name}")

    def publish(self, message: NotificationMessage) -> bool:
        """
        发布通知消息到消息队列
        
        将审批状态变更事件发布到消息队列，触发异步通知处理。
        支持重试机制，确保消息可靠投递。
        
        Args:
            message: 通知消息对象
            
        Returns:
            bool: 发送成功返回 True，失败返回 False
            
        Raises:
            Exception: 消息发送失败且重试次数耗尽时抛出异常
        """
        message_key = f"{message.work_order_id}:{message.message_id}"
        
        try:
            # 序列化消息
            message_data = message.to_dict()
            message_json = json.dumps(message_data, ensure_ascii=False)
            
            # 发布到消息队列
            self._send_to_queue(message_json)
            
            logger.info(
                f"Notification published successfully: "
                f"message_id={message.message_id}, "
                f"work_order_id={message.work_order_id}, "
                f"type={message.notification_type}"
            )
            
            # 清除重试计数
            self._retry_count.pop(message_key, None)
            return True
            
        except Exception as e:
            logger.error(
                f"Failed to publish notification: "
                f"message_id={message.message_id}, "
                f"error={str(e)}"
            )
            
            # 处理重试逻辑
            if self.enable_retry:
                return self._handle_retry(message)
            else:
                raise

    def _send_to_queue(self, message_json: str) -> None:
        """
        发送消息到消息队列
        
        内部方法，实际执行消息队列发送逻辑。
        此处为抽象实现，实际部署时需接入具体的消息队列服务
        (如 Redis Stream、RabbitMQ、Kafka 等)。
        
        Args:
            message_json: JSON 格式的消息字符串
            
        Raises:
            Exception: 消息发送失败
        """
        # TODO: 实现具体的消息队列发送逻辑
        # 当前为占位实现，实际部署时需替换为:
        # - Redis Stream: XADD, XREAD
        # - RabbitMQ: channel.basic_publish
        # - Kafka: producer.send
        
        logger.debug(f"Sending message to queue {self.queue_name}: {message_json[:100]}...")
        
        # 模拟消息发送
        # 实际实现应包含具体的消息队列连接和发送逻辑
        pass

    def _handle_retry(self, message: NotificationMessage) -> bool:
        """
        处理消息重试逻辑
        
        当消息发送失败时，根据重试配置进行重试。
        重试间隔按指数退避策略: 30s -> 60s -> 120s
        
        Args:
            message: 需要重试的消息
            
        Returns:
            bool: 重试成功返回 True，失败返回 False
        """
        message_key = f"{message.work_order_id}:{message.message_id}"
        current_retry = self._retry_count.get(message_key, 0)
        
        if current_retry >= self.MAX_RETRY_ATTEMPTS:
            logger.error(
                f"Max retry attempts reached for message: "
                f"message_id={message.message_id}"
            )
            self._retry_count.pop(message_key, None)
            return False
        
        # 计算下次重试延迟
        delay = self.RETRY_DELAYS[current_retry] if current_retry < len(self.RETRY_DELAYS) else self.RETRY_DELAYS[-1]
        
        self._retry_count[message_key] = current_retry + 1
        
        logger.warning(
            f"Scheduling retry {current_retry + 1}/{self.MAX_RETRY_ATTEMPTS} "
            f"for message_id={message.message_id} in {delay}s"
        )
        
        # 在实际实现中，这里应该使用定时任务或延迟队列
        # 当前为占位实现
        # self._schedule_retry(message, delay)
        
        return False

    def publish_approval_notification(
        self,
        work_order_id: str,
        work_order_title: str,
        action: ApprovalAction,
        actor_id: str,
        actor_name: str,
        target_user_id: str,
        target_user_email: Optional[str] = None,
        comment: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None
    ) -> bool:
        """
        发布审批通知的便捷方法
        
        根据审批动作自动选择正确的通知类型并发布消息。
        
        Args:
            work_order_id: 工单ID
            work_order_title: 工单标题
            action: 审批动作 (APPROVE/REJECT)
            actor_id: 审批人ID
            actor_name: 审批人姓名
            target_user_id: 通知接收者ID (工单创建者)
            target_user_email: 通知接收者邮箱
            comment: 审批备注
            metadata: 扩展元数据
            
        Returns:
            bool: 发送成功返回 True，失败返回 False
            
        Raises:
            ValueError: 无效的审批动作
        """
        import uuid
        
        # 根据动作确定状态和通知类型
        if action == ApprovalAction.APPROVE:
            notification_type = NotificationType.WORK_ORDER_APPROVED
            to_status = WorkOrderStatus.APPROVED
            from_status = WorkOrderStatus.PENDING_APPROVAL
        elif action == ApprovalAction.REJECT:
            notification_type = NotificationType.WORK_ORDER_REJECTED
            to_status = WorkOrderStatus.REJECTED
            from_status = WorkOrderStatus.PENDING_APPROVAL
        else:
            raise ValueError(f"Unsupported action for approval notification: {action}")
        
        # 确定消息优先级
        priority = MessagePriority.HIGH if action == ApprovalAction.REJECT else MessagePriority.NORMAL
        
        message = NotificationMessage(
            message_id=str(uuid.uuid4()),
            notification_type=notification_type,
            work_order_id=work_order_id,
            work_order_title=work_order_title,
            action=action,
            from_status=from_status,
            to_status=to_status,
            actor_id=actor_id,
            actor_name=actor_name,
            target_user_id=target_user_id,
            target_user_email=target_user_email,
            comment=comment,
            priority=priority,
            metadata=metadata or {}
        )
        
        return self.publish(message)

    def publish_submission_notification(
        self,
        work_order_id: str,
        work_order_title: str,
        submitter_id: str,
        submitter_name: str,
        approver_id: str,
        approver_email: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None
    ) -> bool:
        """
        发布工单提交通知的便捷方法
        
        当工单提交到审批流程时，通知当前审批人。
        
        Args:
            work_order_id: 工单ID
            work_order_title: 工单标题
            submitter_id: 提交人ID
            submitter_name: 提交人姓名
            approver_id: 审批人ID
            approver_email: 审批人邮箱
            metadata: 扩展元数据
            
        Returns:
            bool: 发送成功返回 True，失败返回 False
        """
        import uuid
        
        message = NotificationMessage(
            message_id=str(uuid.uuid4()),
            notification_type=NotificationType.WORK_ORDER_SUBMITTED,
            work_order_id=work_order_id,
            work_order_title=work_order_title,
            action=ApprovalAction.SUBMIT,
            from_status=WorkOrderStatus.DRAFT,
            to_status=WorkOrderStatus.PENDING_APPROVAL,
            actor_id=submitter_id,
            actor_name=submitter_name,
            target_user_id=approver_id,
            target_user_email=approver_email,
            priority=MessagePriority.HIGH,
            metadata=metadata or {}
        )
        
        return self.publish(message)

    def get_queue_status(self) -> dict[str, Any]:
        """
        获取消息队列状态信息
        
        Returns:
            dict: 包含队列状态信息的字典
        """
        return {
            "queue_name": self.queue_name,
            "retry_enabled": self.enable_retry,
            "pending_retries": len(self._retry_count),
            "max_retries": self.MAX_RETRY_ATTEMPTS
        }


# 模块级别的单例实例
_default_publisher: Optional[NotificationPublisher] = None


def get_notification_publisher() -> NotificationPublisher:
    """
    获取默认的通知发布器实例
    
    使用单例模式确保全局只有一个发布器实例。
    
    Returns:
        NotificationPublisher: 默认发布器实例
    """
    global _default_publisher
    if _default_publisher is None:
        _default_publisher = NotificationPublisher()
    return _default_publisher


def publish_approval_event(
    work_order_id: str,
    work_order_title: str,
    action: ApprovalAction,
    actor_id: str,
    actor_name: str,
    target_user_id: str,
    target_user_email: Optional[str] = None,
    comment: Optional[str] = None
) -> bool:
    """
    发布审批事件的快捷函数
    
    用于在状态机状态变更后快速触发通知。
    
    Args:
        work_order_id: 工单ID
        work_order_title: 工单标题
        action: 审批动作
        actor_id: 操作人ID
        actor_name: 操作人姓名
        target_user_id: 通知接收者ID
        target_user_email: 通知接收者邮箱
        comment: 审批备注
        
    Returns:
        bool: 发送成功返回 True，失败返回 False
    """
    publisher = get_notification_publisher()
    return publisher.publish_approval_notification(
        work_order_id=work_order_id,
        work_order_title=work_order_title,
        action=action,
        actor_id=actor_id,
        actor_name=actor_name,
        target_user_id=target_user_id,
        target_user_email=target_user_email,
        comment=comment
    )