"""
工单状态变更事件模块

本模块实现工单审批流程的状态机引擎与状态变更通知机制。

状态集合: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | TRANSFERRED | CLOSED

状态转换矩阵:
    DRAFT              -> PENDING_APPROVAL
    PENDING_APPROVAL   -> APPROVED, REJECTED, TRANSFERRED
    APPROVED           -> CLOSED
    REJECTED           -> (终态)
    TRANSFERRED         -> PENDING_APPROVAL
    CLOSED             -> (终态)

通知触发时机: 仅在 APPROVED, REJECTED, TRANSFERRED 时触发，不含 CLOSED

相关文档: SWARM-2025-Q2-P0-003 Iteration 10
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import uuid4


class WorkOrderState(str, Enum):
    """工单状态枚举"""
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    TRANSFERRED = "TRANSFERRED"
    CLOSED = "CLOSED"


# 状态转换矩阵：key 为源状态，value 为允许的目标状态列表
STATE_TRANSITIONS: Dict[WorkOrderState, List[WorkOrderState]] = {
    WorkOrderState.DRAFT: [WorkOrderState.PENDING_APPROVAL],
    WorkOrderState.PENDING_APPROVAL: [
        WorkOrderState.APPROVED,
        WorkOrderState.REJECTED,
        WorkOrderState.TRANSFERRED
    ],
    WorkOrderState.APPROVED: [WorkOrderState.CLOSED],
    WorkOrderState.REJECTED: [],  # 终态
    WorkOrderState.TRANSFERRED: [WorkOrderState.PENDING_APPROVAL],
    WorkOrderState.CLOSED: [],  # 终态
}

# 需要触发通知的目标状态
NOTIFICATION_TRIGGER_STATES = {
    WorkOrderState.APPROVED,
    WorkOrderState.REJECTED,
    WorkOrderState.TRANSFERRED
}


class StateTransitionException(Exception):
    """状态转换异常"""
    
    def __init__(self, from_state: WorkOrderState, to_state: WorkOrderState, reason: str = ""):
        self.from_state = from_state
        self.to_state = to_state
        self.reason = reason
        message = f"Invalid state transition from {from_state.value} to {to_state.value}"
        if reason:
            message += f": {reason}"
        super().__init__(message)


class PermissionDeniedException(Exception):
    """权限不足异常"""
    
    def __init__(self, user_id: str, action: str):
        self.user_id = user_id
        self.action = action
        super().__init__(f"User {user_id} does not have permission to {action}")


@dataclass
class StateChangedEvent:
    """工单状态变更事件"""
    event_id: str
    work_order_id: str
    from_state: WorkOrderState
    to_state: WorkOrderState
    actor: str
    target_user_id: Optional[str] = None
    comment: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """将事件转换为字典格式"""
        return {
            "event_id": self.event_id,
            "work_order_id": self.work_order_id,
            "from_state": self.from_state.value,
            "to_state": self.to_state.value,
            "actor": self.actor,
            "target_user_id": self.target_user_id,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }
    
    def should_notify(self) -> bool:
        """判断是否需要触发通知"""
        return self.to_state in NOTIFICATION_TRIGGER_STATES


@dataclass
class TransitionResult:
    """状态转换结果"""
    success: bool
    work_order_id: str
    from_state: WorkOrderState
    to_state: WorkOrderState
    event: Optional[StateChangedEvent] = None
    error: Optional[str] = None


class WorkOrderStateMachine:
    """
    工单状态机引擎
    
    负责校验状态转换合法性、执行转换、发布事件、记录审批历史。
    """
    
    def __init__(
        self,
        work_order_repo: Optional[Any] = None,
        approval_record_repo: Optional[Any] = None,
        event_publisher: Optional[Any] = None
    ):
        """
        初始化状态机
        
        Args:
            work_order_repo: 工单仓储（用于查询和更新工单状态）
            approval_record_repo: 审批记录仓储（用于持久化审批记录）
            event_publisher: 事件发布器（用于发布状态变更事件）
        """
        self.work_order_repo = work_order_repo
        self.approval_record_repo = approval_record_repo
        self.event_publisher = event_publisher
        self._idempotency_keys: Dict[str, datetime] = {}  # 幂等键缓存
    
    def can_transition(self, from_state: WorkOrderState, to_state: WorkOrderState) -> bool:
        """
        检查状态转换是否合法
        
        Args:
            from_state: 当前状态
            to_state: 目标状态
            
        Returns:
            bool: 是否允许转换
        """
        if from_state not in STATE_TRANSITIONS:
            return False
        return to_state in STATE_TRANSITIONS[from_state]
    
    def transition(
        self,
        work_order_id: str,
        target_state: WorkOrderState,
        actor: str,
        current_state: Optional[WorkOrderState] = None,
        target_user_id: Optional[str] = None,
        comment: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        **kwargs
    ) -> TransitionResult:
        """
        执行状态转换
        
        Args:
            work_order_id: 工单ID
            target_state: 目标状态
            actor: 操作人ID
            current_state: 当前状态（如果未提供，从仓储获取）
            target_user_id: 转签目标用户ID
            comment: 审批意见
            idempotency_key: 幂等键
            **kwargs: 额外参数
            
        Returns:
            TransitionResult: 转换结果
            
        Raises:
            StateTransitionException: 非法状态转换
        """
        # 幂等性校验
        if idempotency_key:
            if self._check_idempotency(idempotency_key):
                return TransitionResult(
                    success=False,
                    work_order_id=work_order_id,
                    from_state=current_state or WorkOrderState.PENDING_APPROVAL,
                    to_state=target_state,
                    error="Duplicate request within 5 seconds (409 Conflict)"
                )
            self._set_idempotency(idempotency_key)
        
        # 获取当前状态
        if current_state is None:
            current_state = self._get_current_state(work_order_id)
        
        # 权限校验
        if not self._check_approval_permission(work_order_id, actor):
            raise PermissionDeniedException(actor, f"approve to {target_state.value}")
        
        # 合法性校验
        if not self.can_transition(current_state, target_state):
            raise StateTransitionException(
                current_state,
                target_state,
                f"Transition from {current_state.value} to {target_state.value} is not allowed"
            )
        
        # 执行转换
        event = self._create_event(
            work_order_id=work_order_id,
            from_state=current_state,
            to_state=target_state,
            actor=actor,
            target_user_id=target_user_id,
            comment=comment,
            **kwargs
        )
        
        # 更新工单状态
        self._update_work_order_state(
            work_order_id=work_order_id,
            new_state=target_state,
            target_user_id=target_user_id
        )
        
        # 记录审批历史
        self._create_approval_record(event)
        
        # 发布事件
        if event.should_notify():
            self._publish_event(event)
        
        return TransitionResult(
            success=True,
            work_order_id=work_order_id,
            from_state=current_state,
            to_state=target_state,
            event=event
        )
    
    def _check_idempotency(self, idempotency_key: str) -> bool:
        """检查幂等键是否在有效期内（5秒窗口）"""
        if idempotency_key in self._idempotency_keys:
            timestamp = self._idempotency_keys[idempotency_key]
            elapsed = (datetime.now(timezone.utc) - timestamp).total_seconds()
            if elapsed < 5:
                return True
            del self._idempotency_keys[idempotency_key]
        return False
    
    def _set_idempotency(self, idempotency_key: str) -> None:
        """设置幂等键"""
        self._idempotency_keys[idempotency_key] = datetime.now(timezone.utc)
    
    def _get_current_state(self, work_order_id: str) -> WorkOrderState:
        """获取工单当前状态"""
        if self.work_order_repo:
            work_order = self.work_order_repo.get(work_order_id)
            if work_order:
                return WorkOrderState(work_order.get("state", WorkOrderState.DRAFT.value))
        return WorkOrderState.DRAFT
    
    def _check_approval_permission(
        self,
        work_order_id: str,
        actor: str
    ) -> bool:
        """
        检查用户是否有审批权限
        
        规则：
        1. 角色必须为 APPROVER
        2. 必须是当前审批人（current_approver_id）
        3. 不能是工单创建者
        """
        if self.work_order_repo:
            work_order = self.work_order_repo.get(work_order_id)
            if work_order:
                # 不能是创建者
                if work_order.get("created_by") == actor:
                    return False
                # 必须是当前审批人（转签后审批人已变更）
                current_approver = work_order.get("current_approver_id")
                if current_approver and current_approver != actor:
                    return False
        return True
    
    def _create_event(
        self,
        work_order_id: str,
        from_state: WorkOrderState,
        to_state: WorkOrderState,
        actor: str,
        target_user_id: Optional[str] = None,
        comment: Optional[str] = None,
        **kwargs
    ) -> StateChangedEvent:
        """创建状态变更事件"""
        return StateChangedEvent(
            event_id=str(uuid4()),
            work_order_id=work_order_id,
            from_state=from_state,
            to_state=to_state,
            actor=actor,
            target_user_id=target_user_id,
            comment=comment,
            metadata=kwargs
        )
    
    def _update_work_order_state(
        self,
        work_order_id: str,
        new_state: WorkOrderState,
        target_user_id: Optional[str] = None
    ) -> None:
        """更新工单状态"""
        if self.work_order_repo:
            update_data = {
                "state": new_state.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            # 转签时更新审批人
            if target_user_id:
                update_data["current_approver_id"] = target_user_id
            self.work_order_repo.update(work_order_id, update_data)
    
    def _create_approval_record(self, event: StateChangedEvent) -> None:
        """创建审批记录"""
        if self.approval_record_repo:
            record_data = {
                "id": str(uuid4()),
                "work_order_id": event.work_order_id,
                "actor": event.actor,
                "action": event.to_state.value,
                "from_state": event.from_state.value,
                "to_state": event.to_state.value,
                "comment": event.comment,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "deleted_at": None
            }
            self.approval_record_repo.create(record_data)
    
    def _publish_event(self, event: StateChangedEvent) -> None:
        """发布状态变更事件"""
        if self.event_publisher:
            self.event_publisher.publish(
                topic="work_order_state_changed",
                payload=event.to_dict()
            )
    
    def get_allowed_transitions(self, from_state: WorkOrderState) -> List[WorkOrderState]:
        """获取从指定状态可以转换的所有目标状态"""
        return STATE_TRANSITIONS.get(from_state, [])
    
    def is_terminal_state(self, state: WorkOrderState) -> bool:
        """判断是否为终态"""
        return len(STATE_TRANSITIONS.get(state, [])) == 0


# 导出公共接口
__all__ = [
    "WorkOrderState",
    "WorkOrderStateMachine",
    "StateChangedEvent",
    "StateTransitionException",
    "PermissionDeniedException",
    "TransitionResult",
    "STATE_TRANSITIONS",
    "NOTIFICATION_TRIGGER_STATES",
]