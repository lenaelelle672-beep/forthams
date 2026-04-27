"""
工单审批流程通知模块 (Iteration 10)

定义工单状态变更触发的通知模型、事件类型、渠道及投递策略。
配合状态机引擎，在 APPROVED / REJECTED / TRANSFERRED 状态变更时触发对应通知。

触发时机约束（对应 SPEC 边界约束第 5 条）:
    - APPROVED   → 发送方 + 申请人（站内信 + 邮件）
    - REJECTED   → 申请人
    - TRANSFERRED → 原审批人 + 新审批人
    - CLOSED     → 不触发通知（本 V1 排除）

作者: SWARM-2025-Q2-P0-003 Team
版本: 10.0.0
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class NotificationEventType(str, Enum):
    """
    通知事件类型枚举。

    仅包含本次 Iteration 涉及的三种触发状态。
    CLOSED 自动关单不触发通知（见 SPEC 排除范围）。
    """

    WORK_ORDER_APPROVED = "WORK_ORDER_APPROVED"
    WORK_ORDER_REJECTED = "WORK_ORDER_REJECTED"
    WORK_ORDER_TRANSFERRED = "WORK_ORDER_TRANSFERRED"


class NotificationChannel(str, Enum):
    """
    通知渠道枚举。

    本 V1 固定为邮件 + 站内信两种渠道，
    后续迭代可扩展至 SMS / Webhook 等。
    """

    EMAIL = "EMAIL"
    SYSTEM = "SYSTEM"


class NotificationStatus(str, Enum):
    """
    通知投递状态枚举。
    """

    PENDING = "PENDING"       # 待投递
    SENT = "SENT"             # 投递成功
    FAILED = "FAILED"         # 投递失败（等待重试）
    RETRY_EXHAUSTED = "RETRY_EXHAUSTED"  # 重试耗尽，落库待补偿


class NotificationPayload(BaseModel):
    """
    通知事件 Payload 结构。

    Attributes:
        work_order_id: 工单 ID
        from_state: 变更前状态
        to_state: 变更后状态（对应 NotificationEventType）
        actor: 执行本次操作的用户 ID
        target_user_ids: 待通知用户 ID 列表（由事件类型决定）
        timestamp: 事件触发时间
        comment: 审批意见（可选）
        target_approver_id: 转签目标审批人 ID（仅 TRANSFERRED 时填写）
    """

    work_order_id: str = Field(..., description="工单 ID")
    from_state: str = Field(..., description="变更前状态")
    to_state: str = Field(..., description="变更后状态")
    actor: str = Field(..., description="执行操作的用户 ID")
    target_user_ids: list[str] = Field(default_factory=list, description="待通知用户 ID 列表")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="事件触发时间")
    comment: Optional[str] = Field(None, description="审批意见（可选）")
    target_approver_id: Optional[str] = Field(
        None,
        description="转签目标审批人 ID（仅 TRANSFERRED 事件时填写）"
    )

    def get_event_type(self) -> NotificationEventType:
        """
        根据 to_state 推断对应的事件类型。

        Returns:
            NotificationEventType: 对应的事件类型枚举值

        Raises:
            ValueError: to_state 不属于本次 Iteration 支持的触发状态时抛出
        """
        mapping = {
            "APPROVED": NotificationEventType.WORK_ORDER_APPROVED,
            "REJECTED": NotificationEventType.WORK_ORDER_REJECTED,
            "TRANSFERRED": NotificationEventType.WORK_ORDER_TRANSFERRED,
        }
        if self.to_state not in mapping:
            raise ValueError(
                f"to_state '{self.to_state}' 不触发通知事件，"
                f"仅支持 APPROVED / REJECTED / TRANSFERRED"
            )
        return mapping[self.to_state]

    def resolve_target_users(self) -> list[str]:
        """
        根据事件类型解析待通知用户列表。

        路由规则（对应 SPEC 边界约束触发时机）:
            - APPROVED   → 发送方(actor) + 申请人(applicant)
            - REJECTED   → 申请人(applicant)
            - TRANSFERRED → 原审批人(prev_approver) + 新审批人(target_approver)

        Note:
            本方法仅返回用户 ID 列表，实际通知投递由 NotificationService 处理。
            调用方需确保 applicant / prev_approver 在调用前已注入 target_user_ids。

        Returns:
            list[str]: 去重后的待通知用户 ID 列表
        """
        resolved = list(self.target_user_ids)  # 复制避免污染原列表

        if self.to_state == "APPROVED":
            # actor（审批人）已在 target_user_ids，申请人需由调用方注入
            pass

        elif self.to_state == "REJECTED":
            # 仅通知申请人，actor 不在通知范围内
            pass

        elif self.to_state == "TRANSFERRED":
            # 原审批人 + 新审批人均已通过 target_user_ids 注入
            pass

        # 去重
        return list(dict.fromkeys(resolved))


class NotificationRecord(BaseModel):
    """
    通知投递记录模型。

    用于持久化每次通知投递的状态，便于补偿 Job 查询和重试。

    Attributes:
        id: 记录唯一 ID（UUID）
        work_order_id: 关联工单 ID
        event_type: 事件类型
        channel: 通知渠道（EMAIL / SYSTEM）
        recipient_user_id: 接收人用户 ID
        payload: 通知内容 Payload（JSON 序列化存储）
        status: 当前投递状态
        retry_count: 已重试次数
        max_retries: 最大重试次数（固定 3 次，对应 SPEC 边界约束第 2 条）
        created_at: 记录创建时间
        updated_at: 状态更新时间
        error_message: 最近一次错误信息（FAILED 时记录）
    """

    id: str = Field(..., description="记录唯一 ID（UUID）")
    work_order_id: str = Field(..., description="关联工单 ID")
    event_type: NotificationEventType = Field(..., description="事件类型")
    channel: NotificationChannel = Field(..., description="通知渠道")
    recipient_user_id: str = Field(..., description="接收人用户 ID")
    payload: str = Field(..., description="通知内容 Payload（JSON 字符串）")
    status: NotificationStatus = Field(
        default=NotificationStatus.PENDING,
        description="当前投递状态"
    )
    retry_count: int = Field(default=0, description="已重试次数")
    max_retries: int = Field(default=3, description="最大重试次数")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="记录创建时间")
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="状态更新时间"
    )
    error_message: Optional[str] = Field(None, description="最近一次错误信息")

    def can_retry(self) -> bool:
        """
        判断当前记录是否允许重试。

        Returns:
            bool: 重试次数未达上限且状态为 FAILED 时返回 True
        """
        return (
            self.status == NotificationStatus.FAILED
            and self.retry_count < self.max_retries
        )

    def mark_sent(self) -> None:
        """
        标记为投递成功。

        原子更新 status 为 SENT 并刷新 updated_at。
        """
        self.status = NotificationStatus.SENT
        self.updated_at = datetime.utcnow()
        self.error_message = None

    def mark_failed(self, error: str) -> None:
        """
        标记为投递失败，并记录错误信息。

        Args:
            error: 错误信息描述
        """
        self.status = NotificationStatus.FAILED
        self.error_message = error
        self.retry_count += 1
        self.updated_at = datetime.utcnow()

        if self.retry_count >= self.max_retries:
            self.status = NotificationStatus.RETRY_EXHAUSTED


class NotificationEventFactory:
    """
    通知事件工厂。

    提供工厂方法，根据工单状态变更上下文构造 NotificationPayload。
    统一入口，便于状态机调用方传入标准化的变更上下文。
    """

    @staticmethod
    def create_from_state_change(
        work_order_id: str,
        from_state: str,
        to_state: str,
        actor: str,
        applicant: str,
        comment: Optional[str] = None,
        prev_approver: Optional[str] = None,
        target_approver: Optional[str] = None,
    ) -> NotificationPayload:
        """
        根据状态变更上下文构造通知 Payload。

        Args:
            work_order_id: 工单 ID
            from_state: 变更前状态
            to_state: 变更后状态（APPROVED / REJECTED / TRANSFERRED）
            actor: 执行本次操作的用户 ID
            applicant: 工单申请人 ID
            comment: 审批意见（可选）
            prev_approver: 原审批人 ID（仅转签时填写）
            target_approver: 转签目标审批人 ID（仅转签时填写）

        Returns:
            NotificationPayload: 构造好的通知 Payload

        Raises:
            ValueError: to_state 不属于本次 Iteration 支持的触发状态时抛出
        """
        target_user_ids: list[str] = []

        if to_state == "APPROVED":
            target_user_ids = [applicant]
            if actor != applicant:
                target_user_ids.append(actor)

        elif to_state == "REJECTED":
            target_user_ids = [applicant]

        elif to_state == "TRANSFERRED":
            if prev_approver:
                target_user_ids.append(prev_approver)
            if target_approver:
                target_user_ids.append(target_approver)

        else:
            # 非通知触发状态，工厂方法直接抛出，不静默忽略
            raise ValueError(
                f"状态 '{to_state}' 不触发通知事件，"
                f"仅支持 APPROVED / REJECTED / TRANSFERRED"
            )

        return NotificationPayload(
            work_order_id=work_order_id,
            from_state=from_state,
            to_state=to_state,
            actor=actor,
            target_user_ids=target_user_ids,
            comment=comment,
            target_approver_id=target_approver,
        )