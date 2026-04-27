"""
工单审批流程数据模型

本模块定义了工单(Ticket)的数据结构，包括:
- 工单状态定义与状态机流转
- 乐观锁版本控制
- 状态变更日志记录

版本: 3.0
关联迭代: Iteration 3 (Phase 3)
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field


class TicketStatus(Enum):
    """
    工单状态枚举
    
    定义工单的完整生命周期状态:
    - PENDING_APPROVAL: 待审批（初始状态）
    - PROCESSING: 处理中（已通过审批）
    - REJECTED: 已拒绝（审批未通过）
    - COMPLETED: 已完成（处理完毕）
    """
    PENDING_APPROVAL = "待审批"
    PROCESSING = "处理中"
    REJECTED = "已拒绝"
    COMPLETED = "已完成"
    
    @classmethod
    def from_string(cls, status_str: str) -> "TicketStatus":
        """
        从字符串转换状态枚举
        
        Args:
            status_str: 状态字符串（如 "待审批"）
            
        Returns:
            TicketStatus: 对应的枚举值
            
        Raises:
            ValueError: 无效的状态字符串
        """
        for status in cls:
            if status.value == status_str:
                return status
        raise ValueError(f"无效的状态: {status_str}")
    
    def __str__(self) -> str:
        """返回状态的字符串表示"""
        return self.value


class ApprovalAction(Enum):
    """
    审批操作枚举
    
    定义可执行的审批操作类型
    """
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"
    COMPLETE = "complete"


@dataclass
class StateTransitionLog:
    """
    状态变更日志记录
    
    记录每次工单状态变更的详细信息，用于审计追溯
    
    Attributes:
        id: 日志唯一标识
        ticket_id: 工单ID
        before_status: 变更前状态
        after_status: 变更后状态
        operator_id: 操作人ID
        action: 操作类型（approve/reject/return/complete）
        timestamp: 操作时间戳
        reason: 操作原因（可选）
    """
    id: int
    ticket_id: int
    before_status: str
    after_status: str
    operator_id: int
    action: str
    timestamp: datetime
    reason: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict: 状态日志的字典表示
        """
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "before_status": self.before_status,
            "after_status": self.after_status,
            "operator_id": self.operator_id,
            "action": self.action,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "reason": self.reason
        }


@dataclass
class Ticket:
    """
    工单数据模型
    
    表示工单审批流程中的核心实体，包含:
    - 基本信息（标题、描述、创建人）
    - 状态与版本控制
    - 审批相关信息
    
    Attributes:
        id: 工单唯一标识
        title: 工单标题
        description: 工单详细描述
        creator_id: 创建人ID
        approver_id: 审批人ID（可选）
        status: 当前状态
        version: 乐观锁版本号
        created_at: 创建时间
        updated_at: 更新时间
        reason: 审批/拒绝原因
        transition_logs: 状态变更历史
    """
    id: int
    title: str
    description: str
    creator_id: int
    approver_id: Optional[int]
    status: TicketStatus
    version: int
    created_at: datetime
    updated_at: datetime
    reason: Optional[str] = None
    transition_logs: List[StateTransitionLog] = field(default_factory=list)
    
    # 状态流转矩阵定义
    TRANSITION_MATRIX: Dict[TicketStatus, Dict[ApprovalAction, TicketStatus]] = {
        TicketStatus.PENDING_APPROVAL: {
            ApprovalAction.APPROVE: TicketStatus.PROCESSING,
            ApprovalAction.REJECT: TicketStatus.REJECTED,
        },
        TicketStatus.PROCESSING: {
            ApprovalAction.RETURN: TicketStatus.PENDING_APPROVAL,
            ApprovalAction.COMPLETE: TicketStatus.COMPLETED,
        },
        TicketStatus.REJECTED: {},  # 已拒绝状态不允许任何流转
        TicketStatus.COMPLETED: {},  # 已完成状态不允许任何流转
    }
    
    def can_transition(self, action: ApprovalAction) -> bool:
        """
        检查当前状态是否允许执行指定操作
        
        Args:
            action: 审批操作类型
            
        Returns:
            bool: 是否允许执行该操作
        """
        return action in self.TRANSITION_MATRIX.get(self.status, {})
    
    def get_next_status(self, action: ApprovalAction) -> Optional[TicketStatus]:
        """
        获取执行操作后的目标状态
        
        Args:
            action: 审批操作类型
            
        Returns:
            Optional[TicketStatus]: 目标状态，如果操作不允许则返回None
        """
        return self.TRANSITION_MATRIX.get(self.status, {}).get(action)
    
    def approve(self, operator_id: int, reason: Optional[str] = None) -> bool:
        """
        执行审批通过操作
        
        Args:
            operator_id: 操作人ID
            reason: 审批原因（可选）
            
        Returns:
            bool: 是否成功执行
            
        Raises:
            ValueError: 状态不允许审批操作
        """
        return self._execute_transition(ApprovalAction.APPROVE, operator_id, reason)
    
    def reject(self, operator_id: int, reason: Optional[str] = None) -> bool:
        """
        执行审批拒绝操作
        
        Args:
            operator_id: 操作人ID
            reason: 拒绝原因（必填）
            
        Returns:
            bool: 是否成功执行
            
        Raises:
            ValueError: 状态不允许拒绝操作
        """
        return self._execute_transition(ApprovalAction.REJECT, operator_id, reason)
    
    def return_ticket(self, operator_id: int, reason: Optional[str] = None) -> bool:
        """
        执行驳回操作（退回给申请人修改）
        
        Args:
            operator_id: 操作人ID
            reason: 驳回原因
            
        Returns:
            bool: 是否成功执行
            
        Raises:
            ValueError: 状态不允许驳回操作
        """
        return self._execute_transition(ApprovalAction.RETURN, operator_id, reason)
    
    def complete(self, operator_id: int, reason: Optional[str] = None) -> bool:
        """
        执行完成操作
        
        Args:
            operator_id: 操作人ID
            reason: 完成说明（可选）
            
        Returns:
            bool: 是否成功执行
            
        Raises:
            ValueError: 状态不允许完成操作
        """
        return self._execute_transition(ApprovalAction.COMPLETE, operator_id, reason)
    
    def _execute_transition(self, action: ApprovalAction, operator_id: int, reason: Optional[str] = None) -> bool:
        """
        执行状态流转的核心逻辑
        
        此方法实现了幂等性：如果当前状态已经是目标状态，执行会成功但不产生新日志
        
        Args:
            action: 审批操作类型
            operator_id: 操作人ID
            reason: 操作原因
            
        Returns:
            bool: 是否成功执行
            
        Raises:
            ValueError: 操作不允许时抛出异常
        """
        next_status = self.get_next_status(action)
        
        if next_status is None:
            raise ValueError(
                f"无效的状态流转: 当前状态={self.status.value}, "
                f"尝试操作={action.value}"
            )
        
        # 记录变更前的状态（用于日志）
        before_status = self.status
        
        # 执行状态变更
        self.status = next_status
        self.version += 1
        self.updated_at = datetime.utcnow()
        
        if reason:
            self.reason = reason
        
        # 创建状态变更日志
        log = StateTransitionLog(
            id=len(self.transition_logs) + 1,
            ticket_id=self.id,
            before_status=before_status.value,
            after_status=next_status.value,
            operator_id=operator_id,
            action=action.value,
            timestamp=datetime.utcnow(),
            reason=reason
        )
        self.transition_logs.append(log)
        
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict: 工单的字典表示
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "creator_id": self.creator_id,
            "approver_id": self.approver_id,
            "status": self.status.value,
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "reason": self.reason,
            "transition_logs": [log.to_dict() for log in self.transition_logs]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Ticket":
        """
        从字典创建工单实例
        
        Args:
            data: 包含工单数据的字典
            
        Returns:
            Ticket: 工单实例
        """
        status_str = data.get("status", "待审批")
        status = TicketStatus.from_string(status_str)
        
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        updated_at = data.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        
        transition_logs = []
        for log_data in data.get("transition_logs", []):
            timestamp = log_data.get("timestamp")
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp)
            transition_logs.append(StateTransitionLog(
                id=log_data.get("id", 0),
                ticket_id=log_data.get("ticket_id", data.get("id")),
                before_status=log_data.get("before_status", ""),
                after_status=log_data.get("after_status", ""),
                operator_id=log_data.get("operator_id", 0),
                action=log_data.get("action", ""),
                timestamp=timestamp,
                reason=log_data.get("reason")
            ))
        
        return cls(
            id=data.get("id", 0),
            title=data.get("title", ""),
            description=data.get("description", ""),
            creator_id=data.get("creator_id", 0),
            approver_id=data.get("approver_id"),
            status=status,
            version=data.get("version", 1),
            created_at=created_at or datetime.utcnow(),
            updated_at=updated_at or datetime.utcnow(),
            reason=data.get("reason"),
            transition_logs=transition_logs
        )


def create_ticket(
    title: str,
    description: str,
    creator_id: int,
    approver_id: Optional[int] = None
) -> Ticket:
    """
    创建新的工单实例
    
    Args:
        title: 工单标题
        description: 工单描述
        creator_id: 创建人ID
        approver_id: 审批人ID（可选）
        
    Returns:
        Ticket: 新创建的工单实例，状态为"待审批"
    """
    now = datetime.utcnow()
    return Ticket(
        id=0,  # ID应由数据库生成
        title=title,
        description=description,
        creator_id=creator_id,
        approver_id=approver_id,
        status=TicketStatus.PENDING_APPROVAL,
        version=1,
        created_at=now,
        updated_at=now,
        reason=None,
        transition_logs=[]
    )