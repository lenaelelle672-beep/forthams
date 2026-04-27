"""
工单审批流程引擎 - 状态机状态定义

定义工单审批流程中的所有状态及其属性。
Iteration 2 对应 Phase 2 实施目标。

状态定义：
- DRAFT: 草稿状态，工单创建后的初始状态
- PENDING_APPROVAL: 待审批状态，已提交等待审批人处理
- APPROVED: 已审批通过状态
- REJECTED: 已拒绝状态
"""

from enum import Enum
from typing import List, Optional
from dataclasses import dataclass, field


class WorkOrderState(Enum):
    """
    工单审批流程状态枚举
    
    状态流转规则（Iteration 2 范围）：
        DRAFT -> PENDING_APPROVAL (SUBMIT 事件)
        PENDING_APPROVAL -> APPROVED (APPROVE 事件)
        PENDING_APPROVAL -> REJECTED (REJECT 事件)
        REJECTED -> PENDING_APPROVAL (RESUBMIT 事件)
    """
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    
    def __str__(self) -> str:
        return self.value
    
    def __repr__(self) -> str:
        return f"WorkOrderState.{self.name}"


class WorkOrderEvent(Enum):
    """
    工单审批流程事件枚举
    
    触发状态机状态转移的事件定义。
    """
    SUBMIT = "SUBMIT"      # 提交工单
    APPROVE = "APPROVE"    # 审批通过
    REJECT = "REJECT"      # 审批拒绝
    RESUBMIT = "RESUBMIT"  # 重新提交（从拒绝状态）
    WITHDRAW = "WITHDRAW"  # 撤回工单
    
    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class StateTransition:
    """
    状态转移定义
    
    Attributes:
        from_state: 源状态
        event: 触发事件
        to_state: 目标状态
        guard: 守卫条件（可选）
        description: 转移描述
    """
    from_state: WorkOrderState
    event: WorkOrderEvent
    to_state: WorkOrderState
    guard: Optional[str] = None
    description: str = ""


# 状态转移规则映射表
STATE_TRANSITIONS: List[StateTransition] = [
    StateTransition(
        from_state=WorkOrderState.DRAFT,
        event=WorkOrderEvent.SUBMIT,
        to_state=WorkOrderState.PENDING_APPROVAL,
        description="工单提交进入待审批状态"
    ),
    StateTransition(
        from_state=WorkOrderState.PENDING_APPROVAL,
        event=WorkOrderEvent.APPROVE,
        to_state=WorkOrderState.APPROVED,
        description="审批人通过工单"
    ),
    StateTransition(
        from_state=WorkOrderState.PENDING_APPROVAL,
        event=WorkOrderEvent.REJECT,
        to_state=WorkOrderState.REJECTED,
        description="审批人拒绝工单"
    ),
    StateTransition(
        from_state=WorkOrderState.REJECTED,
        event=WorkOrderEvent.RESUBMIT,
        to_state=WorkOrderState.PENDING_APPROVAL,
        description="申请人重新提交被拒绝的工单"
    ),
    StateTransition(
        from_state=WorkOrderState.PENDING_APPROVAL,
        event=WorkOrderEvent.WITHDRAW,
        to_state=WorkOrderState.DRAFT,
        description="申请人撤回工单"
    ),
]


@dataclass
class StateMetadata:
    """
    状态元数据
    
    存储每个状态的额外属性信息。
    
    Attributes:
        state: 状态枚举值
        display_name: 显示名称
        description: 状态描述
        is_terminal: 是否为终态
        allowed_events: 在该状态下允许的事件列表
    """
    state: WorkOrderState
    display_name: str
    description: str
    is_terminal: bool = False
    allowed_events: List[WorkOrderEvent] = field(default_factory=list)
    
    def can_handle_event(self, event: WorkOrderEvent) -> bool:
        """检查该状态是否可以处理指定事件"""
        return event in self.allowed_events


# 状态元数据映射
STATE_METADATA: dict[WorkOrderState, StateMetadata] = {
    WorkOrderState.DRAFT: StateMetadata(
        state=WorkOrderState.DRAFT,
        display_name="草稿",
        description="工单创建后的初始状态，申请人可编辑",
        is_terminal=False,
        allowed_events=[WorkOrderEvent.SUBMIT]
    ),
    WorkOrderState.PENDING_APPROVAL: StateMetadata(
        state=WorkOrderState.PENDING_APPROVAL,
        display_name="待审批",
        description="工单已提交，等待审批人处理",
        is_terminal=False,
        allowed_events=[WorkOrderEvent.APPROVE, WorkOrderEvent.REJECT, WorkOrderEvent.WITHDRAW]
    ),
    WorkOrderState.APPROVED: StateMetadata(
        state=WorkOrderState.APPROVED,
        display_name="已通过",
        description="工单已审批通过",
        is_terminal=True,
        allowed_events=[]
    ),
    WorkOrderState.REJECTED: StateMetadata(
        state=WorkOrderState.REJECTED,
        display_name="已拒绝",
        description="工单被审批人拒绝，申请人可修改后重新提交",
        is_terminal=False,
        allowed_events=[WorkOrderEvent.RESUBMIT]
    ),
}


def get_allowed_transitions(state: WorkOrderState) -> List[StateTransition]:
    """
    获取指定状态允许的所有转移
    
    Args:
        state: 当前状态
        
    Returns:
        允许的状态转移列表
    """
    return [
        t for t in STATE_TRANSITIONS 
        if t.from_state == state
    ]


def get_next_state(state: WorkOrderState, event: WorkOrderEvent) -> WorkOrderState:
    """
    根据当前状态和事件获取下一状态
    
    Args:
        state: 当前状态
        event: 触发事件
        
    Returns:
        下一状态
        
    Raises:
        ValueError: 如果转移不合法
    """
    for transition in STATE_TRANSITIONS:
        if transition.from_state == state and transition.event == event:
            return transition.to_state
    
    allowed = get_allowed_transitions(state)
    allowed_events = [t.event for t in allowed]
    raise ValueError(
        f"非法状态转移: 状态 {state.value} 无法处理事件 {event.value}. "
        f"允许的事件: {[e.value for e in allowed_events]}"
    )


def is_valid_transition(from_state: WorkOrderState, to_state: WorkOrderState) -> bool:
    """
    检查状态转移是否合法
    
    Args:
        from_state: 源状态
        to_state: 目标状态
        
    Returns:
        是否为合法的转移
    """
    for transition in STATE_TRANSITIONS:
        if transition.from_state == from_state and transition.to_state == to_state:
            return True
    return False


def get_state_metadata(state: WorkOrderState) -> StateMetadata:
    """
    获取状态的元数据
    
    Args:
        state: 状态枚举值
        
    Returns:
        状态元数据
        
    Raises:
        KeyError: 如果状态不存在
    """
    if state not in STATE_METADATA:
        raise KeyError(f"未知的状态: {state}")
    return STATE_METADATA[state]


__all__ = [
    "WorkOrderState",
    "WorkOrderEvent",
    "StateTransition",
    "StateMetadata",
    "STATE_TRANSITIONS",
    "STATE_METADATA",
    "get_allowed_transitions",
    "get_next_state",
    "is_valid_transition",
    "get_state_metadata",
]