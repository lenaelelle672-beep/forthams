"""
工单审批事件与状态机定义模块。

本模块实现工单审批流程的完整状态机，包括：
- 工单状态枚举定义
- 审批事件枚举定义
- 状态转换规则
- 前置条件校验器

Specification: SWARM-2026-Q2-001 (Iteration 5)
"""

from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class TicketStatus(enum.Enum):
    """
    工单状态枚举。
    
    状态流转路径:
    - PENDING → APPROVED (通过审批)
    - PENDING → REJECTED (驳回审批)
    - PENDING → CANCELLED (取消申请)
    """
    DRAFT = "draft"                    # 草稿状态，未提交
    PENDING = "pending"                # 待审批
    IN_REVIEW = "in_review"            # 审批中
    APPROVED = "approved"              # 已通过
    REJECTED = "rejected"              # 已驳回
    CANCELLED = "cancelled"            # 已取消
    CLOSED = "closed"                  # 已关闭

    def can_transition_to(self, target: TicketStatus) -> bool:
        """检查是否可以从当前状态转换到目标状态。"""
        allowed_transitions = {
            TicketStatus.DRAFT: {TicketStatus.PENDING, TicketStatus.CANCELLED},
            TicketStatus.PENDING: {TicketStatus.IN_REVIEW, TicketStatus.CANCELLED},
            TicketStatus.IN_REVIEW: {TicketStatus.APPROVED, TicketStatus.REJECTED},
            TicketStatus.APPROVED: {TicketStatus.CLOSED},
            TicketStatus.REJECTED: set(),
            TicketStatus.CANCELLED: set(),
            TicketStatus.CLOSED: set(),
        }
        return target in allowed_transitions.get(self, set())


class TicketEvent(enum.Enum):
    """
    工单审批事件枚举。
    
    事件触发状态变更：
    - SUBMIT: DRAFT → PENDING
    - START_REVIEW: PENDING → IN_REVIEW
    - APPROVE: IN_REVIEW → APPROVED
    - REJECT: IN_REVIEW → REJECTED
    - CANCEL: PENDING → CANCELLED
    - CLOSE: APPROVED → CLOSED
    """
    SUBMIT = "submit"                  # 提交工单
    START_REVIEW = "start_review"     # 开始审批
    APPROVE = "approve"                # 通过审批
    REJECT = "reject"                  # 驳回审批
    CANCEL = "cancel"                  # 取消申请
    CLOSE = "close"                    # 关闭工单


class InvalidTransitionError(Exception):
    """无效的状态转换异常。"""
    
    def __init__(self, current_status: TicketStatus, event: TicketEvent):
        self.current_status = current_status
        self.event = event
        super().__init__(
            f"Invalid transition: cannot apply event '{event.value}' "
            f"when ticket status is '{current_status.value}'"
        )


class PreconditionNotMetError(Exception):
    """前置条件未满足异常。"""
    
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class DuplicateOperationError(Exception):
    """重复操作异常。"""
    
    def __init__(self, ticket_id: str, operation: str):
        self.ticket_id = ticket_id
        self.operation = operation
        super().__init__(
            f"Ticket '{ticket_id}' has already been {operation}"
        )


@dataclass
class StateTransitionResult:
    """状态转换结果。"""
    success: bool
    old_status: TicketStatus
    new_status: TicketStatus
    event: TicketEvent
    timestamp: datetime
    reason: Optional[str] = None
    error: Optional[str] = None


@dataclass
class TicketEventContext:
    """工单事件上下文。"""
    ticket_id: str
    operator_id: str
    reason: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


class TicketStateMachine:
    """
    工单状态机。
    
    实现基于事件驱动的状态转换逻辑，包括：
    - 状态转换规则验证
    - 前置条件校验
    - 副作用处理
    
    Example:
        >>> sm = TicketStateMachine()
        >>> result = sm.transition(TicketStatus.PENDING, TicketEvent.APPROVE)
        >>> assert result.success
        >>> assert result.new_status == TicketStatus.APPROVED
    """
    
    # 状态转换映射表
    TRANSITION_MAP: dict[tuple[TicketStatus, TicketEvent], TicketStatus] = {
        # 提交流程
        (TicketStatus.DRAFT, TicketEvent.SUBMIT): TicketStatus.PENDING,
        
        # 审批流程
        (TicketStatus.PENDING, TicketEvent.START_REVIEW): TicketStatus.IN_REVIEW,
        (TicketStatus.IN_REVIEW, TicketEvent.APPROVE): TicketStatus.APPROVED,
        (TicketStatus.IN_REVIEW, TicketEvent.REJECT): TicketStatus.REJECTED,
        
        # 取消流程
        (TicketStatus.PENDING, TicketEvent.CANCEL): TicketStatus.CANCELLED,
        
        # 关闭流程
        (TicketStatus.APPROVED, TicketEvent.CLOSE): TicketStatus.CLOSED,
    }
    
    # 需要额外校验的操作
    REQUIRES_REASON_EVENTS: set[TicketEvent] = {
        TicketEvent.REJECT,
        TicketEvent.CANCEL,
    }
    
    @classmethod
    def can_transition(
        cls,
        current_status: TicketStatus,
        event: TicketEvent
    ) -> bool:
        """检查是否允许执行状态转换。"""
        return (current_status, event) in cls.TRANSITION_MAP
    
    @classmethod
    def get_next_status(
        cls,
        current_status: TicketStatus,
        event: TicketEvent
    ) -> Optional[TicketStatus]:
        """获取转换后的目标状态。"""
        return cls.TRANSITION_MAP.get((current_status, event))
    
    @classmethod
    def validate_preconditions(
        cls,
        current_status: TicketStatus,
        event: TicketEvent,
        context: Optional[TicketEventContext] = None
    ) -> list[str]:
        """
        校验前置条件。
        
        Returns:
            校验失败的原因列表，空列表表示全部通过
        """
        violations = []
        
        # 检查转换规则
        if not cls.can_transition(current_status, event):
            violations.append(
                f"Event '{event.value}' is not allowed in status '{current_status.value}'"
            )
            return violations
        
        # 检查需要理由的操作
        if event in cls.REQUIRES_REASON_EVENTS:
            if context is None or not context.reason:
                violations.append(f"Event '{event.value}' requires a reason")
        
        return violations
    
    @classmethod
    def transition(
        cls,
        current_status: TicketStatus,
        event: TicketEvent,
        context: Optional[TicketEventContext] = None
    ) -> StateTransitionResult:
        """
        执行状态转换。
        
        Args:
            current_status: 当前状态
            event: 触发事件
            context: 事件上下文（可选）
            
        Returns:
            StateTransitionResult: 转换结果
            
        Raises:
            InvalidTransitionError: 无效的状态转换
            PreconditionNotMetError: 前置条件未满足
        """
        timestamp = datetime.now()
        
        # 前置条件校验
        violations = cls.validate_preconditions(current_status, event, context)
        if violations:
            raise PreconditionNotMetError("; ".join(violations))
        
        # 获取目标状态
        new_status = cls.get_next_status(current_status, event)
        if new_status is None:
            raise InvalidTransitionError(current_status, event)
        
        return StateTransitionResult(
            success=True,
            old_status=current_status,
            new_status=new_status,
            event=event,
            timestamp=timestamp,
            reason=context.reason if context else None
        )


@dataclass
class Ticket:
    """
    工单实体。
    
    包含完整的状态机和审批逻辑。
    """
    id: str
    title: str
    description: str
    applicant_id: str
    status: TicketStatus = TicketStatus.DRAFT
    approver_id: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    
    def __post_init__(self):
        """初始化后校验。"""
        if not self.id:
            self.id = str(uuid.uuid4())
    
    def submit(self, applicant_id: str) -> StateTransitionResult:
        """
        提交工单。
        
        Args:
            applicant_id: 申请人ID
            
        Returns:
            状态转换结果
            
        Raises:
            InvalidTransitionError: 当前状态不允许提交
            PreconditionNotMetError: 前置条件未满足
        """
        if self.applicant_id != applicant_id:
            raise PreconditionNotMetError("Only the applicant can submit the ticket")
        
        result = TicketStateMachine.transition(
            self.status,
            TicketEvent.SUBMIT
        )
        self._apply_result(result)
        return result
    
    def start_review(self, approver_id: str) -> StateTransitionResult:
        """
        开始审批流程。
        
        Args:
            approver_id: 审批人ID
            
        Returns:
            状态转换结果
            
        Raises:
            InvalidTransitionError: 当前状态不允许开始审批
        """
        context = TicketEventContext(
            ticket_id=self.id,
            operator_id=approver_id
        )
        result = TicketStateMachine.transition(
            self.status,
            TicketEvent.START_REVIEW,
            context
        )
        self.approver_id = approver_id
        self._apply_result(result)
        return result
    
    def approve(self, approver_id: str, reason: Optional[str] = None) -> StateTransitionResult:
        """
        审批通过。
        
        Args:
            approver_id: 审批人ID
            reason: 审批意见（可选）
            
        Returns:
            状态转换结果
            
        Raises:
            InvalidTransitionError: 当前状态不允许审批
            DuplicateOperationError: 工单已被审批
        """
        if self.status == TicketStatus.APPROVED:
            raise DuplicateOperationError(self.id, "approved")
        
        if self.status == TicketStatus.REJECTED:
            raise DuplicateOperationError(self.id, "rejected")
        
        context = TicketEventContext(
            ticket_id=self.id,
            operator_id=approver_id,
            reason=reason
        )
        result = TicketStateMachine.transition(
            self.status,
            TicketEvent.APPROVE,
            context
        )
        self.approver_id = approver_id
        self.approved_by = approver_id
        self.approved_at = datetime.now()
        self._apply_result(result, reason)
        return result
    
    def reject(self, approver_id: str, reason: str) -> StateTransitionResult:
        """
        审批驳回。
        
        Args:
            approver_id: 审批人ID
            reason: 驳回原因（必填）
            
        Returns:
            状态转换结果
            
        Raises:
            InvalidTransitionError: 当前状态不允许驳回
            PreconditionNotMetError: 驳回原因未提供
            DuplicateOperationError: 工单已被审批
        """
        if not reason:
            raise PreconditionNotMetError("Reject reason is required")
        
        if self.status in {TicketStatus.APPROVED, TicketStatus.REJECTED}:
            raise DuplicateOperationError(self.id, "processed")
        
        context = TicketEventContext(
            ticket_id=self.id,
            operator_id=approver_id,
            reason=reason
        )
        result = TicketStateMachine.transition(
            self.status,
            TicketEvent.REJECT,
            context
        )
        self.approver_id = approver_id
        self._apply_result(result, reason)
        return result
    
    def cancel(self, operator_id: str, reason: str) -> StateTransitionResult:
        """
        取消工单。
        
        Args:
            operator_id: 操作人ID
            reason: 取消原因（必填）
            
        Returns:
            状态转换结果
            
        Raises:
            InvalidTransitionError: 当前状态不允许取消
            PreconditionNotMetError: 取消原因未提供
        """
        if not reason:
            raise PreconditionNotMetError("Cancel reason is required")
        
        if self.status not in {TicketStatus.DRAFT, TicketStatus.PENDING}:
            raise InvalidTransitionError(
                self.status,
                TicketEvent.CANCEL
            )
        
        context = TicketEventContext(
            ticket_id=self.id,
            operator_id=operator_id,
            reason=reason
        )
        result = TicketStateMachine.transition(
            self.status,
            TicketEvent.CANCEL,
            context
        )
        self._apply_result(result, reason)
        return result
    
    def close(self, operator_id: str) -> StateTransitionResult:
        """
        关闭工单。
        
        Args:
            operator_id: 操作人ID
            
        Returns:
            状态转换结果
            
        Raises:
            InvalidTransitionError: 当前状态不允许关闭
        """
        context = TicketEventContext(
            ticket_id=self.id,
            operator_id=operator_id
        )
        result = TicketStateMachine.transition(
            self.status,
            TicketEvent.CLOSE,
            context
        )
        self._apply_result(result)
        return result
    
    def _apply_result(
        self,
        result: StateTransitionResult,
        reason: Optional[str] = None
    ) -> None:
        """应用状态转换结果。"""
        self.status = result.new_status
        self.updated_at = result.timestamp
        if reason:
            self.reason = reason
    
    def can_approve(self) -> bool:
        """检查当前状态是否允许审批操作。"""
        return TicketStateMachine.can_transition(
            self.status,
            TicketEvent.APPROVE
        )
    
    def can_reject(self) -> bool:
        """检查当前状态是否允许驳回操作。"""
        return TicketStateMachine.can_transition(
            self.status,
            TicketEvent.REJECT
        )
    
    def is_pending(self) -> bool:
        """检查工单是否处于待审批状态。"""
        return self.status == TicketStatus.PENDING
    
    def is_approved(self) -> bool:
        """检查工单是否已通过。"""
        return self.status == TicketStatus.APPROVED
    
    def is_rejected(self) -> bool:
        """检查工单是否已驳回。"""
        return self.status == TicketStatus.REJECTED
    
    def is_closed(self) -> bool:
        """检查工单是否已关闭。"""
        return self.status == TicketStatus.CLOSED
    
    def __repr__(self) -> str:
        return (
            f"Ticket(id={self.id}, title={self.title}, "
            f"status={self.status.value}, applicant={self.applicant_id})"
        )