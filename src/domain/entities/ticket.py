"""
工单审批实体模块

本模块定义工单审批流程的核心实体，包括：
- 工单状态枚举
- 状态流转规则
- 审批操作记录
- 通知事件

Author: SWARM-2025-Q2-P0-003
Iteration: 3
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid


class TicketStatus(str, Enum):
    """
    工单状态枚举
    
    状态流转规则：
    - 待审批 → 处理中（批准）
    - 待审批 → 已拒绝（拒绝）
    - 待审批 → 待修改（驳回）
    - 处理中 → 已完成（完成）
    - 处理中 → 待审批（驳回）
    """
    PENDING_APPROVAL = "待审批"      # 工单提交，等待审批
    IN_PROGRESS = "处理中"           # 审批通过，处理中
    APPROVED = "已批准"              # 批准（中间状态）
    REJECTED = "已拒绝"              # 拒绝
    RETURNED = "待修改"              # 驳回，需修改后重新提交
    COMPLETED = "已完成"             # 工单完成
    CANCELLED = "已取消"             # 取消


class ApprovalAction(str, Enum):
    """审批操作类型"""
    APPROVE = "approve"             # 批准
    REJECT = "reject"               # 拒绝
    RETURN = "return"               # 驳回（要求修改）
    COMPLETE = "complete"           # 完成


class NotificationChannel(str, Enum):
    """通知渠道枚举"""
    EMAIL = "email"
    IN_APP = "in_app"
    SMS = "sms"
    WECHAT = "wechat"


@dataclass
class StateTransition:
    """
    状态流转记录
    
    记录工单状态变更的完整轨迹，用于审计和回溯。
    
    Attributes:
        id: 流转记录唯一标识
        ticket_id: 工单ID
        from_status: 变更前状态
        to_status: 变更后状态
        action: 触发的操作
        operator_id: 操作人ID
        comment: 操作备注
        created_at: 流转时间
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str = ""
    from_status: TicketStatus = TicketStatus.PENDING_APPROVAL
    to_status: TicketStatus = TicketStatus.PENDING_APPROVAL
    action: ApprovalAction = ApprovalAction.APPROVE
    operator_id: str = ""
    comment: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "from_status": self.from_status.value,
            "to_status": self.to_status.value,
            "action": self.action.value,
            "operator_id": self.operator_id,
            "comment": self.comment,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class ApprovalRecord:
    """
    审批记录实体
    
    存储工单审批操作的详细信息，包括审批意见和附件。
    
    Attributes:
        id: 审批记录唯一标识
        ticket_id: 工单ID
        approver_id: 审批人ID
        action: 审批动作
        reason: 审批理由/意见
        attachments: 附件URL列表
        version: 乐观锁版本号
        created_at: 审批时间
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str = ""
    approver_id: str = ""
    action: ApprovalAction = ApprovalAction.APPROVE
    reason: Optional[str] = None
    attachments: list[str] = field(default_factory=list)
    version: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "approver_id": self.approver_id,
            "action": self.action.value,
            "reason": self.reason,
            "attachments": self.attachments,
            "version": self.version,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class NotificationRecord:
    """
    通知记录实体
    
    记录状态变更后发送的通知，用于追踪和重试。
    
    Attributes:
        id: 通知记录唯一标识
        ticket_id: 工单ID
        recipient_id: 接收人ID
        recipient_email: 接收人邮箱
        channel: 通知渠道
        event: 事件类型
        title: 通知标题
        content: 通知内容
        status: 发送状态（pending/sent/failed）
        retry_count: 重试次数
        error_message: 错误信息
        sent_at: 发送时间
        created_at: 创建时间
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str = ""
    recipient_id: str = ""
    recipient_email: Optional[str] = None
    channel: NotificationChannel = NotificationChannel.EMAIL
    event: str = ""
    title: str = ""
    content: str = ""
    status: str = "pending"
    retry_count: int = 0
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "recipient_id": self.recipient_id,
            "recipient_email": self.recipient_email,
            "channel": self.channel.value,
            "event": self.event,
            "title": self.title,
            "content": self.content,
            "status": self.status,
            "retry_count": self.retry_count,
            "error_message": self.error_message,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "created_at": self.created_at.isoformat()
        }


@dataclass
class Ticket:
    """
    工单实体
    
    核心业务实体，代表一个工单及其完整生命周期。
    
    Attributes:
        id: 工单唯一标识
        title: 工单标题
        description: 工单描述
        creator_id: 创建人ID
        current_status: 当前状态
        version: 乐观锁版本号（防止并发更新）
        approver_ids: 审批人ID列表
        created_at: 创建时间
        updated_at: 更新时间
        transitions: 状态流转历史
        approvals: 审批记录列表
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    description: str = ""
    creator_id: str = ""
    current_status: TicketStatus = TicketStatus.PENDING_APPROVAL
    version: int = 1
    approver_ids: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    transitions: list[StateTransition] = field(default_factory=list)
    approvals: list[ApprovalRecord] = field(default_factory=list)
    
    def get_state_machine(self) -> "TicketStateMachine":
        """
        获取工单状态机实例
        
        Returns:
            TicketStateMachine: 状态机实例
        """
        return TicketStateMachine(self)
    
    def can_transition_to(self, target_status: TicketStatus) -> bool:
        """
        检查是否可以转换到目标状态
        
        Args:
            target_status: 目标状态
            
        Returns:
            bool: 是否可以转换
        """
        return self.get_state_machine().can_transition(target_status)
    
    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "creator_id": self.creator_id,
            "current_status": self.current_status.value,
            "version": self.version,
            "approver_ids": self.approver_ids,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "transition_count": len(self.transitions),
            "approval_count": len(self.approvals)
        }


class TicketStateMachine:
    """
    工单状态机
    
    封装工单状态流转的完整逻辑，包括：
    - 合法状态转换矩阵
    - 转换前置条件校验
    - 转换触发和记录
    
    状态流转矩阵：
    ┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
    │ 当前状态        │ 批准     │ 拒绝     │ 驳回     │ 完成     │
    ├─────────────────┼──────────┼──────────┼──────────┼──────────┤
    │ 待审批          │ 处理中   │ 已拒绝   │ -        │ -        │
    │ 处理中          │ -        │ -        │ 待审批   │ 已完成   │
    │ 已拒绝          │ -        │ -        │ -        │ -        │
    │ 已完成          │ -        │ -        │ -        │ -        │
    └─────────────────┴──────────┴──────────┴──────────┴──────────┘
    
    注意：
    - "-" 表示该操作在当前状态下不允许
    - 状态转换必须通过状态机，不允许直接修改状态
    """
    
    # 状态转换矩阵：{当前状态: {操作: 目标状态}}
    TRANSITION_MATRIX: dict[TicketStatus, dict[ApprovalAction, TicketStatus]] = {
        TicketStatus.PENDING_APPROVAL: {
            ApprovalAction.APPROVE: TicketStatus.IN_PROGRESS,
            ApprovalAction.REJECT: TicketStatus.REJECTED,
        },
        TicketStatus.IN_PROGRESS: {
            ApprovalAction.RETURN: TicketStatus.PENDING_APPROVAL,
            ApprovalAction.COMPLETE: TicketStatus.COMPLETED,
        },
    }
    
    def __init__(self, ticket: Ticket):
        """
        初始化状态机
        
        Args:
            ticket: 工单实体
        """
        self.ticket = ticket
        self._current_status = ticket.current_status
    
    @property
    def current_status(self) -> TicketStatus:
        """获取当前状态"""
        return self._current_status
    
    def can_transition(self, target_status: TicketStatus) -> bool:
        """
        检查是否可以转换到目标状态
        
        Args:
            target_status: 目标状态
            
        Returns:
            bool: 是否可以转换
        """
        # 如果当前状态不在矩阵中，不允许转换
        if self._current_status not in self.TRANSITION_MATRIX:
            return False
        
        # 遍历所有操作，检查是否有操作可以到达目标状态
        for action, status in self.TRANSITION_MATRIX[self._current_status].items():
            if status == target_status:
                return True
        return False
    
    def get_available_actions(self) -> list[ApprovalAction]:
        """
        获取当前状态下可用的操作列表
        
        Returns:
            list[ApprovalAction]: 可用操作列表
        """
        if self._current_status not in self.TRANSITION_MATRIX:
            return []
        return list(self.TRANSITION_MATRIX[self._current_status].keys())
    
    def get_next_status(self, action: ApprovalAction) -> Optional[TicketStatus]:
        """
        获取指定操作后的目标状态
        
        Args:
            action: 审批操作
            
        Returns:
            Optional[TicketStatus]: 目标状态，如果操作不可用返回None
        """
        if self._current_status not in self.TRANSITION_MATRIX:
            return None
        return self.TRANSITION_MATRIX[self._current_status].get(action)
    
    def transition(self, action: ApprovalAction, operator_id: str, comment: Optional[str] = None) -> StateTransition:
        """
        执行状态转换
        
        Args:
            action: 审批操作
            operator_id: 操作人ID
            comment: 操作备注
            
        Returns:
            StateTransition: 状态流转记录
            
        Raises:
            ValueError: 如果操作不允许或状态不允许转换
        """
        target_status = self.get_next_status(action)
        if target_status is None:
            raise ValueError(
                f"操作 '{action.value}' 在当前状态 '{self._current_status.value}' 下不允许"
            )
        
        # 创建状态流转记录
        transition = StateTransition(
            ticket_id=self.ticket.id,
            from_status=self._current_status,
            to_status=target_status,
            action=action,
            operator_id=operator_id,
            comment=comment
        )
        
        # 更新工单状态
        self.ticket.current_status = target_status
        self.ticket.updated_at = datetime.now()
        self.ticket.version += 1
        self._current_status = target_status
        
        # 添加流转记录
        self.ticket.transitions.append(transition)
        
        return transition
    
    def validate_action(self, action: ApprovalAction) -> tuple[bool, Optional[str]]:
        """
        验证操作是否合法
        
        Args:
            action: 审批操作
            
        Returns:
            tuple[bool, Optional[str]]: (是否合法, 错误信息)
        """
        if self._current_status not in self.TRANSITION_MATRIX:
            return False, f"当前状态 '{self._current_status.value}' 不允许任何操作"
        
        if action not in self.TRANSITION_MATRIX[self._current_status]:
            available = [a.value for a in self.get_available_actions()]
            return False, f"操作 '{action.value}' 不可用，可用操作: {available}"
        
        return True, None


@dataclass
class TicketApprovalContext:
    """
    审批上下文
    
    封装审批操作所需的完整上下文信息。
    
    Attributes:
        ticket: 工单实体
        state_machine: 状态机实例
        current_approver_id: 当前审批人ID
        action: 审批动作
        reason: 审批理由
        attachments: 附件列表
        idempotency_key: 幂等键
    """
    ticket: Ticket
    state_machine: TicketStateMachine
    current_approver_id: str
    action: ApprovalAction = ApprovalAction.APPROVE
    reason: Optional[str] = None
    attachments: list[str] = field(default_factory=list)
    idempotency_key: Optional[str] = None
    
    def validate(self) -> tuple[bool, list[str]]:
        """
        验证审批上下文的合法性
        
        Returns:
            tuple[bool, list[str]]: (是否合法, 错误列表)
        """
        errors = []
        
        # 验证审批人权限
        if self.current_approver_id not in self.ticket.approver_ids:
            errors.append(f"用户 '{self.current_approver_id}' 没有审批权限")
        
        # 验证状态机操作
        is_valid, error_msg = self.state_machine.validate_action(self.action)
        if not is_valid:
            errors.append(error_msg or "状态机验证失败")
        
        # 验证幂等性（需要外部系统配合）
        # 此处仅做基本检查
        
        return len(errors) == 0, errors


# 导出模块公开接口
__all__ = [
    "TicketStatus",
    "ApprovalAction", 
    "NotificationChannel",
    "StateTransition",
    "ApprovalRecord",
    "NotificationRecord",
    "Ticket",
    "TicketStateMachine",
    "TicketApprovalContext",
]