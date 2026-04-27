"""
工单审批状态机引擎

本模块实现工单审批流程的状态机逻辑，包括状态转换验证、执行和权限校验。
对应 SPEC: SWARM-2025-Q2-P0-003-Spec-v1.0 Phase 1: 状态机基础设施

核心功能:
1. 状态转换规则定义与校验
2. 执行状态变更（含乐观锁支持）
3. 获取允许的操作列表
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict

from src.domain.enums.workorder_status import WorkOrderStatus


class ApprovalAction(str, Enum):
    """
    审批操作枚举
    
    定义工单审批流程中允许的操作类型。
    """
    APPROVE = "approve"  # 审批通过
    REJECT = "reject"    # 审批驳回


@dataclass
class StateTransitionResult:
    """
    状态转换结果
    
    封装状态转换操作的执行结果。
    """
    success: bool
    previous_status: WorkOrderStatus
    new_status: Optional[WorkOrderStatus] = None
    transition_time: Optional[datetime] = None
    error_message: Optional[str] = None


class InvalidStateTransitionError(Exception):
    """
    状态转换非法异常
    
    当尝试执行非法的状态转换时抛出。
    包含当前状态、尝试的操作和允许的操作列表。
    """
    def __init__(
        self,
        current_status: WorkOrderStatus,
        attempted_action: str,
        allowed_actions: List[str]
    ):
        self.current_status = current_status
        self.attempted_action = attempted_action
        self.allowed_actions = allowed_actions
        message = (
            f"INVALID_STATE_TRANSITION: Cannot perform action '{attempted_action}' "
            f"from status '{current_status.value}'. "
            f"Allowed actions: {allowed_actions if allowed_actions else 'none'}"
        )
        super().__init__(message)


class ConcurrentModificationError(Exception):
    """
    并发修改冲突异常
    
    当多个操作同时修改同一工单时，乐观锁检测到冲突后抛出。
    """
    def __init__(self, workorder_id: str, message: str = "Work order is being processed by another operation"):
        self.workorder_id = workorder_id
        self.message = message
        super().__init__(f"CONCURRENT_MODIFICATION: {message}")


class StateTransitionRule:
    """
    状态转换规则定义
    
    定义工单状态机的合法转换规则:
    - PENDING_REVIEW -> APPROVE -> APPROVED
    - PENDING_REVIEW -> REJECT -> REJECTED
    - APPROVED/REJECTED 为终态，无后续转换
    """
    
    TRANSITIONS: Dict[WorkOrderStatus, Dict[ApprovalAction, WorkOrderStatus]] = {
        WorkOrderStatus.PENDING_REVIEW: {
            ApprovalAction.APPROVE: WorkOrderStatus.APPROVED,
            ApprovalAction.REJECT: WorkOrderStatus.REJECTED,
        },
        WorkOrderStatus.APPROVED: {},  # 终态，无后续转换
        WorkOrderStatus.REJECTED: {},   # 需重新提交，不在本迭代
    }


class StateMachineEngine:
    """
    状态机引擎
    
    提供工单审批流程的状态转换核心逻辑。
    支持:
    - 状态转换合法性校验
    - 执行状态变更（含乐观锁）
    - 获取允许的操作列表
    
    使用方式:
        engine = StateMachineEngine(repository=workorder_repository)
        engine.validate_transition(WorkOrderStatus.PENDING_REVIEW, ApprovalAction.APPROVE)
        result = engine.execute_transition(workorder_id, current_status, action, version)
    """
    
    def __init__(self, repository=None):
        """
        初始化状态机引擎
        
        Args:
            repository: 工单仓储对象（用于乐观锁更新），可选
        """
        self._repository = repository
    
    def validate_transition(
        self,
        current_status: WorkOrderStatus,
        action: ApprovalAction
    ) -> bool:
        """
        校验状态转换是否合法
        
        根据状态转换规则表，验证给定的状态和操作是否构成合法转换。
        
        Args:
            current_status: 当前状态
            action: 审批动作
        
        Returns:
            bool: 校验通过返回 True
        
        Raises:
            InvalidStateTransitionError: 当状态转换非法时
                - 状态不在转换表中
                - 操作不在允许列表中
        """
        if current_status not in StateTransitionRule.TRANSITIONS:
            raise InvalidStateTransitionError(
                current_status=current_status,
                attempted_action=action.value,
                allowed_actions=[]
            )
        
        allowed = StateTransitionRule.TRANSITIONS[current_status]
        if action not in allowed:
            raise InvalidStateTransitionError(
                current_status=current_status,
                attempted_action=action.value,
                allowed_actions=[a.value for a in allowed.keys()]
            )
        
        return True
    
    def get_allowed_actions(self, status: WorkOrderStatus) -> List[ApprovalAction]:
        """
        获取当前状态允许的操作列表
        
        根据工单当前状态，返回所有合法的审批操作。
        
        Args:
            status: 工单状态
        
        Returns:
            List[ApprovalAction]: 允许的操作列表，如果无操作返回空列表
        """
        return list(StateTransitionRule.TRANSITIONS.get(status, {}).keys())
    
    def execute_transition(
        self,
        workorder_id: str,
        current_status: WorkOrderStatus,
        action: ApprovalAction,
        expected_version: int,
        reject_reason: Optional[str] = None
    ) -> StateTransitionResult:
        """
        执行状态转换
        
        执行工单状态的转换操作，支持乐观锁并发控制。
        
        Args:
            workorder_id: 工单ID
            current_status: 当前状态
            action: 审批动作 (APPROVE/REJECT)
            expected_version: 期望的版本号（用于乐观锁）
            reject_reason: 驳回理由（仅 REJECT 操作需要）
        
        Returns:
            StateTransitionResult: 转换结果对象
        
        Raises:
            InvalidStateTransitionError: 状态转换非法
            ConcurrentModificationError: 并发冲突（乐观锁版本不匹配）
        
        Note:
            - REJECT 操作需要提供 reject_reason
            - 驳回理由长度限制为 200 字符（由调用层验证）
        """
        # Step 1: 校验转换合法性
        self.validate_transition(current_status, action)
        
        # Step 2: 获取目标状态
        target_status = StateTransitionRule.TRANSITIONS[current_status][action]
        
        # Step 3: 执行乐观锁更新（如果有仓储）
        if self._repository:
            updated_workorder = self._repository.update_with_optimistic_lock(
                workorder_id=workorder_id,
                new_status=target_status,
                expected_version=expected_version
            )
            
            if updated_workorder is None:
                raise ConcurrentModificationError(
                    workorder_id=workorder_id,
                    message="Work order is being processed by another operation"
                )
        
        # Step 4: 构建并返回结果
        return StateTransitionResult(
            success=True,
            previous_status=current_status,
            new_status=target_status,
            transition_time=datetime.utcnow(),
            error_message=None
        )


# 导出异常类供外部使用
__all__ = [
    'StateMachineEngine',
    'StateTransitionRule',
    'StateTransitionResult',
    'InvalidStateTransitionError',
    'ConcurrentModificationError',
    'ApprovalAction',
]