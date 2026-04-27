"""
工单审批状态转换模块

本模块定义了工单审批流程中的状态转换规则和转换执行器。
支持审批通过、驳回两种操作，并处理并发冲突和权限校验。

状态转换规则:
    PENDING_REVIEW → APPROVED (审批通过)
    PENDING_REVIEW → REJECTED (驳回)

Authors:
    SWARM-2025-Q2-P0-003 Team

Version:
    1.0.0
"""

from enum import Enum
from typing import Optional, Set, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import threading


class WorkOrderStatus(str, Enum):
    """
    工单状态枚举
    
    Attributes:
        DRAFT: 草稿状态
        PENDING_REVIEW: 待审批状态
        APPROVED: 已审批通过
        REJECTED: 已驳回
    """
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ApprovalAction(str, Enum):
    """
    审批操作枚举
    
    Attributes:
        APPROVE: 审批通过
        REJECT: 驳回
    """
    APPROVE = "APPROVE"
    REJECT = "REJECT"


# 定义合法的状态转换映射
VALID_TRANSITIONS: Dict[WorkOrderStatus, Dict[ApprovalAction, WorkOrderStatus]] = {
    WorkOrderStatus.PENDING_REVIEW: {
        ApprovalAction.APPROVE: WorkOrderStatus.APPROVED,
        ApprovalAction.REJECT: WorkOrderStatus.REJECTED,
    }
}


@dataclass
class TransitionContext:
    """
    状态转换上下文
    
    包含进行状态转换所需的所有信息，用于传递参数和存储转换结果。
    
    Attributes:
        workorder_id: 工单ID
        current_status: 当前状态
        action: 执行的操作
        operator_id: 操作人ID
        reject_reason: 驳回原因（仅驳回操作需要）
        timestamp: 转换时间戳
        version: 乐观锁版本号
    """
    workorder_id: str
    current_status: WorkOrderStatus
    action: ApprovalAction
    operator_id: str
    reject_reason: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    version: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        """
        将上下文转换为字典格式
        
        Returns:
            Dict[str, Any]: 包含转换上下文信息的字典
        """
        return {
            "workorder_id": self.workorder_id,
            "current_status": self.current_status.value,
            "action": self.action.value,
            "operator_id": self.operator_id,
            "reject_reason": self.reject_reason,
            "timestamp": self.timestamp.isoformat(),
            "version": self.version,
        }


@dataclass
class TransitionResult:
    """
    状态转换结果
    
    记录状态转换执行后的结果信息。
    
    Attributes:
        success: 是否成功
        previous_status: 转换前状态
        new_status: 转换后状态
        error_code: 错误码（如果失败）
        error_message: 错误消息（如果失败）
        transitioned_at: 转换完成时间
    """
    success: bool
    previous_status: WorkOrderStatus
    new_status: Optional[WorkOrderStatus] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    transitioned_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        将结果转换为字典格式
        
        Returns:
            Dict[str, Any]: 包含转换结果的字典
        """
        result = {
            "success": self.success,
            "previous_status": self.previous_status.value,
            "transitioned_at": self.transitioned_at.isoformat(),
        }
        if self.new_status:
            result["status"] = self.new_status.value
        if self.error_code:
            result["error"] = self.error_code
        if self.error_message:
            result["message"] = self.error_message
        return result


class TransitionError(Exception):
    """
    状态转换基础异常
    
    所有状态转换相关异常的基类。
    """
    def __init__(self, error_code: str, message: str):
        self.error_code = error_code
        self.message = message
        super().__init__(message)


class InvalidStateTransitionError(TransitionError):
    """
    非法状态转换异常
    
    当尝试执行不合法的状态转换时抛出。
    """
    def __init__(self, current_status: WorkOrderStatus, action: ApprovalAction):
        self.current_status = current_status
        self.action = action
        super().__init__(
            "INVALID_STATE_TRANSITION",
            f"Cannot perform {action.value} on workorder in {current_status.value} status"
        )


class ConcurrentModificationError(TransitionError):
    """
    并发修改异常
    
    当检测到并发修改冲突时抛出。
    """
    def __init__(self, workorder_id: str, expected_version: int, actual_version: int):
        self.workorder_id = workorder_id
        self.expected_version = expected_version
        self.actual_version = actual_version
        super().__init__(
            "CONCURRENT_MODIFICATION",
            f"Workorder {workorder_id} was modified by another process. Expected version: {expected_version}, actual: {actual_version}"
        )


class InsufficientPermissionError(TransitionError):
    """
    权限不足异常
    
    当用户没有执行操作的权限时抛出。
    """
    def __init__(self, operator_id: str, action: ApprovalAction):
        self.operator_id = operator_id
        self.action = action
        super().__init__(
            "INSUFFICIENT_PERMISSION",
            f"User {operator_id} does not have permission to perform {action.value}"
        )


class ValidationError(TransitionError):
    """
    校验异常
    
    当输入参数校验失败时抛出。
    """
    def __init__(self, field: str, message: str):
        self.field = field
        super().__init__("VALIDATION_ERROR", message)


def validate_reject_reason(reason: Optional[str], max_length: int = 200) -> Tuple[bool, Optional[str]]:
    """
    校验驳回原因
    
    Args:
        reason: 驳回原因
        max_length: 最大长度限制
        
    Returns:
        Tuple[bool, Optional[str]]: (是否通过校验, 错误消息)
    """
    if reason is None or reason.strip() == "":
        return False, "reject_reason is required for rejection"
    if len(reason) > max_length:
        return False, f"reject_reason exceeds maximum length of {max_length} characters"
    return True, None


def validate_permission(
    operator_id: str, 
    created_by: str, 
    current_approver_id: str,
    action: ApprovalAction
) -> bool:
    """
    校验操作权限
    
    审批权限规则:
        1. 审批人必须是 current_approver_id
        2. 创建人不能审批自己的工单
    
    Args:
        operator_id: 操作人ID
        created_by: 工单创建人ID
        current_approver_id: 当前审批人ID
        action: 操作类型
        
    Returns:
        bool: 是否有权限
    """
    # 创建人不能审批自己的工单
    if operator_id == created_by:
        return False
    # 审批人必须是当前审批人
    if current_approver_id != operator_id:
        return False
    return True


def validate_state_transition(current_status: WorkOrderStatus, action: ApprovalAction) -> bool:
    """
    校验状态转换是否合法
    
    Args:
        current_status: 当前状态
        action: 要执行的操作
        
    Returns:
        bool: 是否允许该转换
    """
    if current_status not in VALID_TRANSITIONS:
        return False
    return action in VALID_TRANSITIONS[current_status]


def get_target_status(current_status: WorkOrderStatus, action: ApprovalAction) -> Optional[WorkOrderStatus]:
    """
    获取目标状态
    
    Args:
        current_status: 当前状态
        action: 操作类型
        
    Returns:
        Optional[WorkOrderStatus]: 目标状态，如果转换不合法则返回 None
    """
    if current_status not in VALID_TRANSITIONS:
        return None
    transitions = VALID_TRANSITIONS[current_status]
    return transitions.get(action)


class TransitionRegistry:
    """
    转换注册表
    
    用于管理状态转换规则和执行转换逻辑的注册中心。
    采用单例模式确保全局唯一实例。
    """
    
    _instance: Optional['TransitionRegistry'] = None
    _lock = threading.Lock()
    
    def __new__(cls) -> 'TransitionRegistry':
        """单例模式实现"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """初始化注册表"""
        if self._initialized:
            return
        self._transitions: Dict[Tuple[WorkOrderStatus, ApprovalAction], WorkOrderStatus] = {}
        self._initialized = True
        self._register_default_transitions()
    
    def _register_default_transitions(self) -> None:
        """注册默认的转换规则"""
        self.register(WorkOrderStatus.PENDING_REVIEW, ApprovalAction.APPROVE, WorkOrderStatus.APPROVED)
        self.register(WorkOrderStatus.PENDING_REVIEW, ApprovalAction.REJECT, WorkOrderStatus.REJECTED)
    
    def register(
        self, 
        from_status: WorkOrderStatus, 
        action: ApprovalAction, 
        to_status: WorkOrderStatus
    ) -> None:
        """
        注册状态转换规则
        
        Args:
            from_status: 源状态
            action: 操作
            to_status: 目标状态
        """
        key = (from_status, action)
        self._transitions[key] = to_status
    
    def get_target(self, from_status: WorkOrderStatus, action: ApprovalAction) -> Optional[WorkOrderStatus]:
        """
        获取转换目标状态
        
        Args:
            from_status: 源状态
            action: 操作
            
        Returns:
            Optional[WorkOrderStatus]: 目标状态
        """
        key = (from_status, action)
        return self._transitions.get(key)
    
    def execute(
        self,
        context: TransitionContext,
        created_by: str,
        current_approver_id: str,
        current_version: int
    ) -> TransitionResult:
        """
        执行状态转换
        
        综合校验权限、状态和参数后执行转换。
        
        Args:
            context: 转换上下文
            created_by: 工单创建人ID
            current_approver_id: 当前审批人ID
            current_version: 当前版本号（乐观锁）
            
        Returns:
            TransitionResult: 转换结果
        """
        # 1. 校验版本号（乐观锁）
        if context.version != current_version:
            return TransitionResult(
                success=False,
                previous_status=context.current_status,
                error_code="CONCURRENT_MODIFICATION",
                error_message=f"Version mismatch: expected {context.version}, actual {current_version}"
            )
        
        # 2. 校验权限
        if not validate_permission(
            context.operator_id,
            created_by,
            current_approver_id,
            context.action
        ):
            return TransitionResult(
                success=False,
                previous_status=context.current_status,
                error_code="INSUFFICIENT_PERMISSION",
                error_message=f"User {context.operator_id} does not have permission to perform {context.action.value}"
            )
        
        # 3. 校验状态转换
        if not validate_state_transition(context.current_status, context.action):
            return TransitionResult(
                success=False,
                previous_status=context.current_status,
                error_code="INVALID_STATE_TRANSITION",
                error_message=f"Cannot perform {context.action.value} on workorder in {context.current_status.value} status"
            )
        
        # 4. 校验驳回原因
        if context.action == ApprovalAction.REJECT:
            is_valid, error_msg = validate_reject_reason(context.reject_reason)
            if not is_valid:
                return TransitionResult(
                    success=False,
                    previous_status=context.current_status,
                    error_code="VALIDATION_ERROR",
                    error_message=error_msg
                )
        
        # 5. 执行转换
        target_status = get_target_status(context.current_status, context.action)
        
        return TransitionResult(
            success=True,
            previous_status=context.current_status,
            new_status=target_status,
            transitioned_at=datetime.utcnow()
        )


# 全局转换注册表实例
transition_registry = TransitionRegistry()


def execute_approval_transition(
    workorder_id: str,
    current_status: WorkOrderStatus,
    action: ApprovalAction,
    operator_id: str,
    created_by: str,
    current_approver_id: str,
    current_version: int,
    reject_reason: Optional[str] = None
) -> TransitionResult:
    """
    执行审批状态转换的便捷函数
    
    这是外部调用的主要入口点，封装了完整的转换流程。
    
    Args:
        workorder_id: 工单ID
        current_status: 当前状态
        action: 操作类型
        operator_id: 操作人ID
        created_by: 工单创建人ID
        current_approver_id: 当前审批人ID
        current_version: 当前版本号
        reject_reason: 驳回原因
        
    Returns:
        TransitionResult: 转换结果
    """
    context = TransitionContext(
        workorder_id=workorder_id,
        current_status=current_status,
        action=action,
        operator_id=operator_id,
        reject_reason=reject_reason,
        version=current_version
    )
    
    return transition_registry.execute(
        context=context,
        created_by=created_by,
        current_approver_id=current_approver_id,
        current_version=current_version
    )