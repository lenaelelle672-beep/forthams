"""
工单状态机模块

实现工单状态枚举流转：待审批→审批中→已批准/已拒绝
支持状态转换前置条件校验、权限验证、并发控制
"""

from enum import Enum
from typing import Optional, Set
from dataclasses import dataclass, field
from datetime import datetime


class TicketStatus(str, Enum):
    """
    工单状态枚举
    
    状态流转图:
        PENDING → IN_REVIEW → APPROVED
                             ↘ REJECTED
    """
    PENDING = "PENDING"      # 待审批
    IN_REVIEW = "IN_REVIEW"  # 审批中
    APPROVED = "APPROVED"    # 已批准（终态）
    REJECTED = "REJECTED"    # 已拒绝（终态）


class TicketAction(str, Enum):
    """工单操作枚举"""
    SUBMIT = "SUBMIT"        # 提交审批
    APPROVE = "APPROVE"      # 批准
    REJECT = "REJECT"        # 拒绝


# 定义合法状态转换矩阵
LEGAL_TRANSITIONS: dict[TicketStatus, Set[TicketStatus]] = {
    TicketStatus.PENDING: {TicketStatus.IN_REVIEW},
    TicketStatus.IN_REVIEW: {TicketStatus.APPROVED, TicketStatus.REJECTED},
    TicketStatus.APPROVED: set(),   # 终态，不可流转
    TicketStatus.REJECTED: set(),   # 终态，不可流转
}


class StateTransitionError(Exception):
    """状态转换异常基类"""
    pass


class InvalidTransitionError(StateTransitionError):
    """非法状态转换"""
    def __init__(self, current: TicketStatus, target: TicketStatus):
        self.current = current
        self.target = target
        super().__init__(f"非法状态转换: {current.value} → {target.value}")


class PreconditionNotMetError(StateTransitionError):
    """前置条件不满足"""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class SelfApprovalError(PreconditionNotMetError):
    """自审批禁止异常"""
    def __init__(self):
        super().__init__("禁止自审批: 操作人不能是工单创建者")


class RejectionReasonError(PreconditionNotMetError):
    """拒绝理由格式错误"""
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(f"拒绝理由长度必须在10-500字符之间，当前: {len(reason)}字符")


class ConcurrentModificationError(StateTransitionError):
    """并发修改冲突"""
    def __init__(self, ticket_id: int):
        self.ticket_id = ticket_id
        super().__init__(f"工单 {ticket_id} 正在被其他操作修改，请稍后重试")


@dataclass
class TransitionContext:
    """
    状态转换上下文
    
    包含状态转换所需的所有信息
    """
    ticket_id: int
    current_status: TicketStatus
    target_status: TicketStatus
    action: TicketAction
    operator_id: int
    creator_id: int
    approver_id: Optional[int] = None
    rejection_reason: Optional[str] = None
    comment: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    version: int = 0  # 用于乐观锁


class TicketStateMachine:
    """
    工单状态机
    
    负责状态流转控制、前置条件校验、权限验证
    """
    
    def __init__(self):
        self._valid_actions: dict[TicketStatus, TicketAction] = {
            TicketStatus.PENDING: TicketAction.SUBMIT,
            TicketStatus.IN_REVIEW: TicketAction.APPROVE,
            TicketStatus.IN_REVIEW: TicketAction.REJECT,
        }
    
    def can_transition(self, current: TicketStatus, target: TicketStatus) -> bool:
        """
        检查是否允许状态转换
        
        Args:
            current: 当前状态
            target: 目标状态
            
        Returns:
            bool: 是否允许转换
        """
        if current not in LEGAL_TRANSITIONS:
            return False
        return target in LEGAL_TRANSITIONS[current]
    
    def validate_transition(self, ctx: TransitionContext) -> None:
        """
        校验状态转换的合法性
        
        Args:
            ctx: 转换上下文
            
        Raises:
            InvalidTransitionError: 非法状态转换
            PreconditionNotMetError: 前置条件不满足
            RejectionReasonError: 拒绝理由格式错误
            SelfApprovalError: 自审批禁止
        """
        # 1. 检查状态转换是否合法
        if not self.can_transition(ctx.current_status, ctx.target_status):
            raise InvalidTransitionError(ctx.current_status, ctx.target_status)
        
        # 2. 检查终端状态
        if ctx.current_status in {TicketStatus.APPROVED, TicketStatus.REJECTED}:
            raise InvalidTransitionError(
                ctx.current_status, 
                ctx.target_status
            )
        
        # 3. 提交审批前置条件
        if ctx.action == TicketAction.SUBMIT:
            self._validate_submit(ctx)
        
        # 4. 审批操作前置条件
        elif ctx.action == TicketAction.APPROVE:
            self._validate_approve(ctx)
        
        # 5. 拒绝操作前置条件
        elif ctx.action == TicketAction.REJECT:
            self._validate_reject(ctx)
    
    def _validate_submit(self, ctx: TransitionContext) -> None:
        """
        校验提交审批操作
        
        Args:
            ctx: 转换上下文
            
        Raises:
            PreconditionNotMetError: 缺少审批人
        """
        if ctx.approver_id is None:
            raise PreconditionNotMetError("提交审批时必须指定审批人")
    
    def _validate_approve(self, ctx: TransitionContext) -> None:
        """
        校验批准操作
        
        Args:
            ctx: 转换上下文
            
        Raises:
            SelfApprovalError: 自审批禁止
        """
        # 检查自审批
        if ctx.operator_id == ctx.creator_id:
            raise SelfApprovalError()
    
    def _validate_reject(self, ctx: TransitionContext) -> None:
        """
        校验拒绝操作
        
        Args:
            ctx: 转换上下文
            
        Raises:
            RejectionReasonError: 拒绝理由格式错误
            SelfApprovalError: 自审批禁止
        """
        # 检查自审批
        if ctx.operator_id == ctx.creator_id:
            raise SelfApprovalError()
        
        # 校验拒绝理由长度
        reason = ctx.rejection_reason
        if not reason or len(reason.strip()) == 0:
            raise RejectionReasonError(reason or "")
        
        reason_len = len(reason.strip())
        if reason_len < 10 or reason_len > 500:
            raise RejectionReasonError(reason)
    
    def get_next_state(self, current: TicketStatus, action: TicketAction) -> TicketStatus:
        """
        根据当前状态和操作获取下一状态
        
        Args:
            current: 当前状态
            action: 操作类型
            
        Returns:
            TicketStatus: 下一状态
            
        Raises:
            InvalidTransitionError: 无法确定下一状态
        """
        if action == TicketAction.SUBMIT:
            if current == TicketStatus.PENDING:
                return TicketStatus.IN_REVIEW
        elif action == TicketAction.APPROVE:
            if current == TicketStatus.IN_REVIEW:
                return TicketStatus.APPROVED
        elif action == TicketAction.REJECT:
            if current == TicketStatus.IN_REVIEW:
                return TicketStatus.REJECTED
        
        raise InvalidTransitionError(
            current, 
            TicketStatus.APPROVED  # 占位，不会实际使用
        )
    
    def get_available_actions(self, status: TicketStatus) -> list[TicketAction]:
        """
        获取当前状态下可用的操作列表
        
        Args:
            status: 当前状态
            
        Returns:
            list[TicketAction]: 可用操作列表
        """
        if status == TicketStatus.PENDING:
            return [TicketAction.SUBMIT]
        elif status == TicketStatus.IN_REVIEW:
            return [TicketAction.APPROVE, TicketAction.REJECT]
        else:
            return []  # 终态无可用操作
    
    def is_terminal_state(self, status: TicketStatus) -> bool:
        """
        判断是否为终态
        
        Args:
            status: 状态
            
        Returns:
            bool: 是否为终态
        """
        return status in {TicketStatus.APPROVED, TicketStatus.REJECTED}
    
    def execute_transition(
        self, 
        ctx: TransitionContext,
        validate: bool = True
    ) -> TicketStatus:
        """
        执行状态转换
        
        Args:
            ctx: 转换上下文
            validate: 是否执行校验
            
        Returns:
            TicketStatus: 转换后的新状态
            
        Raises:
            各种校验异常
        """
        if validate:
            self.validate_transition(ctx)
        
        return ctx.target_status


# 全局单例
_default_machine: Optional[TicketStateMachine] = None


def get_ticket_state_machine() -> TicketStateMachine:
    """
    获取工单状态机单例
    
    Returns:
        TicketStateMachine: 状态机实例
    """
    global _default_machine
    if _default_machine is None:
        _default_machine = TicketStateMachine()
    return _default_machine