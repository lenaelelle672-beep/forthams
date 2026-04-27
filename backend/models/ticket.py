"""
工单审批模型模块

定义工单状态枚举、状态转换规则、审批历史记录等核心实体。
支持标准的三级审批流转机制：待审批 → 审批中 → 已批准/已拒绝
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class TicketStatus(str, Enum):
    """
    工单状态枚举
    
    状态流转路径:
    PENDING → IN_REVIEW → APPROVED
                    ↘ REJECTED
    """
    PENDING = "PENDING"      # 待审批
    IN_REVIEW = "IN_REVIEW"  # 审批中
    APPROVED = "APPROVED"    # 已批准 (终态)
    REJECTED = "REJECTED"    # 已拒绝 (终态)


class ApprovalAction(str, Enum):
    """
    审批动作枚举
    """
    SUBMIT = "SUBMIT"    # 提交审批
    APPROVE = "APPROVE"  # 批准
    REJECT = "REJECT"    # 拒绝


# 状态转换矩阵: 当前状态 → 合法的下一状态
STATE_TRANSITIONS = {
    TicketStatus.PENDING: [TicketStatus.IN_REVIEW],
    TicketStatus.IN_REVIEW: [TicketStatus.APPROVED, TicketStatus.REJECTED],
    TicketStatus.APPROVED: [],      # 终态，不可流转
    TicketStatus.REJECTED: [],      # 终态，不可流转
}


class Ticket(Base):
    """
    工单模型
    
    核心属性:
    - id: 工单唯一标识
    - title: 工单标题
    - content: 工单内容
    - status: 当前状态
    - submitter_id: 提交人ID
    - approver_id: 审批人ID (仅在 IN_REVIEW 状态时有效)
    """
    __tablename__ = 'tickets'
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    status = Column(SQLEnum(TicketStatus), default=TicketStatus.PENDING, nullable=False)
    
    # 提交人
    submitter_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    submitter = relationship("User", foreign_keys=[submitter_id])
    
    # 审批人
    approver_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    approver = relationship("User", foreign_keys=[approver_id])
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime, nullable=True)  # 提交审批时间
    approved_at = Column(DateTime, nullable=True)  # 最终审批时间
    
    # 审批历史关联
    history = relationship("ApprovalHistory", back_populates="ticket", cascade="all, delete-orphan")
    
    def can_transition_to(self, new_status: TicketStatus) -> bool:
        """
        检查是否可以转换到指定状态
        
        Args:
            new_status: 目标状态
            
        Returns:
            bool: 是否可以转换
        """
        allowed = STATE_TRANSITIONS.get(self.status, [])
        return new_status in allowed
    
    def is_terminal_state(self) -> bool:
        """
        检查当前是否为终态
        
        Returns:
            bool: 是否为终态
        """
        return self.status in [TicketStatus.APPROVED, TicketStatus.REJECTED]
    
    def submit(self, approver_id: int) -> None:
        """
        提交工单进行审批
        
        Args:
            approver_id: 审批人ID
            
        Raises:
            ValueError: 自审批时抛出
            RuntimeError: 非 PENDING 状态时抛出
        """
        if self.submitter_id == approver_id:
            raise ValueError("不能审批自己提交的工单")
        
        if self.status != TicketStatus.PENDING:
            raise RuntimeError(f"当前状态 {self.status} 不能提交审批")
        
        self.status = TicketStatus.IN_REVIEW
        self.approver_id = approver_id
        self.submitted_at = datetime.utcnow()
    
    def approve(self, comment: Optional[str] = None) -> None:
        """
        批准工单
        
        Args:
            comment: 审批意见
            
        Raises:
            RuntimeError: 非 IN_REVIEW 状态时抛出
        """
        if self.status != TicketStatus.IN_REVIEW:
            raise RuntimeError(f"当前状态 {self.status} 不能批准")
        
        self.status = TicketStatus.APPROVED
        self.approved_at = datetime.utcnow()
    
    def reject(self, reason: str) -> None:
        """
        拒绝工单
        
        Args:
            reason: 拒绝理由
            
        Raises:
            ValueError: 理由为空或过短时抛出
            RuntimeError: 非 IN_REVIEW 状态时抛出
        """
        if not reason or len(reason.strip()) < 10:
            raise ValueError("拒绝理由不能少于 10 个字符")
        
        if len(reason) > 500:
            raise ValueError("拒绝理由不能超过 500 个字符")
        
        if self.status != TicketStatus.IN_REVIEW:
            raise RuntimeError(f"当前状态 {self.status} 不能拒绝")
        
        self.status = TicketStatus.REJECTED
        self.approved_at = datetime.utcnow()
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            dict: 工单信息字典
        """
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "status": self.status.value if isinstance(self.status, TicketStatus) else self.status,
            "submitter_id": self.submitter_id,
            "approver_id": self.approver_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
        }


class ApprovalHistory(Base):
    """
    审批历史记录模型
    
    记录工单的每次审批操作，用于审计追踪。
    """
    __tablename__ = 'approval_history'
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey('tickets.id'), nullable=False)
    ticket = relationship("Ticket", back_populates="history")
    
    action = Column(SQLEnum(ApprovalAction), nullable=False)
    operator_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    operator = relationship("User", foreign_keys=[operator_id])
    
    from_status = Column(SQLEnum(TicketStatus), nullable=True)
    to_status = Column(SQLEnum(TicketStatus), nullable=False)
    
    comment = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)  # 拒绝理由
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    operator_ip = Column(String(45), nullable=True)  # 支持 IPv6
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            dict: 审批历史信息字典
        """
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "action": self.action.value if isinstance(self.action, ApprovalAction) else self.action,
            "operator_id": self.operator_id,
            "from_status": self.from_status.value if self.from_status and isinstance(self.from_status, TicketStatus) else (self.from_status or None),
            "to_status": self.to_status.value if isinstance(self.to_status, TicketStatus) else self.to_status,
            "comment": self.comment,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "operator_ip": self.operator_ip,
        }


def validate_state_transition(current_status: TicketStatus, new_status: TicketStatus) -> bool:
    """
    验证状态转换的合法性
    
    Args:
        current_status: 当前状态
        new_status: 目标状态
        
    Returns:
        bool: 是否合法
        
    Raises:
        ValueError: 非法转换时抛出
    """
    allowed = STATE_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise ValueError(
            f"非法状态转换: {current_status.value} → {new_status.value}, "
            f"允许的目标状态: {[s.value for s in allowed]}"
        )
    return True


def validate_reject_reason(reason: str) -> str:
    """
    验证拒绝理由
    
    Args:
        reason: 拒绝理由
        
    Returns:
        str: 验证通过的理由
        
    Raises:
        ValueError: 验证失败时抛出
    """
    if not reason:
        raise ValueError("拒绝理由不能为空")
    
    reason = reason.strip()
    if len(reason) < 10:
        raise ValueError("拒绝理由不能少于 10 个字符")
    
    if len(reason) > 500:
        raise ValueError("拒绝理由不能超过 500 个字符")
    
    return reason