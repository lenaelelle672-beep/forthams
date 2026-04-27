"""
工单审批状态迁移规则模块

本模块定义了工单审批流程的有限状态机(FSM)状态迁移规则，
包括状态枚举、操作类型和状态转换矩阵。

Version: 1.0
Created: 2025-01-20
"""

from enum import Enum
from typing import Optional, Dict, Any
from dataclasses import dataclass


class WorkOrderStatus(str, Enum):
    """
    工单状态枚举
    
    状态说明：
    - DRAFT: 待提交（起草态，仅申请人可编辑）
    - PENDING: 待审批（已进入审批队列）
    - APPROVED: 已通过（终态，不可逆）
    - REJECTED: 已驳回（终态，不可逆，可重新提交）
    - RETURNED: 已退回（中间态，申请人可修改后重新提交）
    - CANCELLED: 已撤回（终态，申请人主动撤销）
    """
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"
    
    def is_terminal(self) -> bool:
        """
        判断当前状态是否为终态（不可再做状态迁移）
        
        Returns:
            bool: 如果是终态返回True
        """
        return self in (WorkOrderStatus.APPROVED, 
                       WorkOrderStatus.REJECTED, 
                       WorkOrderStatus.CANCELLED)
    
    def can_be_modified(self) -> bool:
        """
        判断当前状态是否允许申请人编辑
        
        Returns:
            bool: 如果可编辑返回True
        """
        return self in (WorkOrderStatus.DRAFT, WorkOrderStatus.RETURNED)


class OperationType(str, Enum):
    """
    工单操作类型枚举
    
    操作说明：
    - submit: 提交工单（DRAFT -> PENDING）
    - approve: 审批通过（PENDING -> APPROVED）
    - reject: 审批驳回（PENDING -> REJECTED）
    - return: 审批退回（PENDING -> RETURNED）
    - resubmit: 重新提交（RETURNED -> PENDING）
    - cancel: 撤回工单（PENDING -> CANCELLED）
    """
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"
    RESUBMIT = "resubmit"
    CANCEL = "cancel"


class TransitionError(Exception):
    """状态迁移异常基类"""
    
    def __init__(self, message: str, current_status: WorkOrderStatus, 
                 operation: OperationType, error_code: str = "TRANSITION_ERROR"):
        self.message = message
        self.current_status = current_status
        self.operation = operation
        self.error_code = error_code
        super().__init__(self.message)


class InvalidTransitionError(TransitionError):
    """
    无效状态转换异常
    
    当执行的状态转换不在允许的规则矩阵内时抛出
    """
    
    def __init__(self, current_status: WorkOrderStatus, operation: OperationType):
        error_code = "INVALID_TRANSITION"
        message = f"无效的状态转换: 状态 {current_status.value} 不允许执行操作 {operation.value}"
        super().__init__(message, current_status, operation, error_code)


class PermissionDeniedError(TransitionError):
    """
    权限不足异常
    
    当操作者不具备执行当前操作的权限时抛出
    """
    
    def __init__(self, current_status: WorkOrderStatus, operation: OperationType,
                 reason: str = "权限不足"):
        error_code = "PERMISSION_DENIED"
        message = f"权限不足: {reason}"
        super().__init__(message, current_status, operation, error_code)


class SelfApprovalForbiddenError(PermissionDeniedError):
    """
    自审禁止异常
    
    当审批人试图审批自己提交的工单时抛出
    """
    
    def __init__(self, current_status: WorkOrderStatus, operation: OperationType):
        reason = "审批人不能审批自己提交的工单（自审禁止）"
        super().__init__(current_status, operation, reason)
        self.error_code = "SELF_APPROVAL_FORBIDDEN"


@dataclass
class TransitionRule:
    """
    状态迁移规则定义
    
    Attributes:
        current_status: 当前状态
        operation: 操作类型
        target_status: 目标状态
        allowed_roles: 允许执行此操作的角色列表
        requires_self_check: 是否需要自审检查
    """
    current_status: WorkOrderStatus
    operation: OperationType
    target_status: WorkOrderStatus
    allowed_roles: list[str]
    requires_self_check: bool = False
    
    def matches(self, status: WorkOrderStatus, op: OperationType) -> bool:
        """
        判断给定的状态和操作是否匹配此规则
        
        Args:
            status: 当前状态
            op: 操作类型
            
        Returns:
            bool: 如果匹配返回True
        """
        return (self.current_status == status and self.operation == op)


class TransitionRuleEngine:
    """
    状态迁移规则引擎
    
    负责管理和执行状态迁移规则校验
    """
    
    # 状态迁移规则矩阵
    _RULES: list[TransitionRule] = [
        # DRAFT -> PENDING (提交)
        TransitionRule(
            current_status=WorkOrderStatus.DRAFT,
            operation=OperationType.SUBMIT,
            target_status=WorkOrderStatus.PENDING,
            allowed_roles=["applicant"],
            requires_self_check=False
        ),
        # PENDING -> APPROVED (审批通过)
        TransitionRule(
            current_status=WorkOrderStatus.PENDING,
            operation=OperationType.APPROVE,
            target_status=WorkOrderStatus.APPROVED,
            allowed_roles=["approver"],
            requires_self_check=True
        ),
        # PENDING -> REJECTED (审批驳回)
        TransitionRule(
            current_status=WorkOrderStatus.PENDING,
            operation=OperationType.REJECT,
            target_status=WorkOrderStatus.REJECTED,
            allowed_roles=["approver"],
            requires_self_check=True
        ),
        # PENDING -> RETURNED (审批退回)
        TransitionRule(
            current_status=WorkOrderStatus.PENDING,
            operation=OperationType.RETURN,
            target_status=WorkOrderStatus.RETURNED,
            allowed_roles=["approver"],
            requires_self_check=True
        ),
        # PENDING -> CANCELLED (撤回)
        TransitionRule(
            current_status=WorkOrderStatus.PENDING,
            operation=OperationType.CANCEL,
            target_status=WorkOrderStatus.CANCELLED,
            allowed_roles=["applicant"],
            requires_self_check=False
        ),
        # RETURNED -> PENDING (重新提交)
        TransitionRule(
            current_status=WorkOrderStatus.RETURNED,
            operation=OperationType.RESUBMIT,
            target_status=WorkOrderStatus.PENDING,
            allowed_roles=["applicant"],
            requires_self_check=False
        ),
    ]
    
    @classmethod
    def get_rule(cls, current_status: WorkOrderStatus, 
                 operation: OperationType) -> Optional[TransitionRule]:
        """
        根据当前状态和操作获取对应的迁移规则
        
        Args:
            current_status: 当前状态
            operation: 操作类型
            
        Returns:
            TransitionRule: 如果找到匹配的规则返回规则对象，否则返回None
        """
        for rule in cls._RULES:
            if rule.matches(current_status, operation):
                return rule
        return None
    
    @classmethod
    def get_target_status(cls, current_status: WorkOrderStatus,
                          operation: OperationType) -> Optional[WorkOrderStatus]:
        """
        获取给定状态和操作的目标状态
        
        Args:
            current_status: 当前状态
            operation: 操作类型
            
        Returns:
            WorkOrderStatus: 如果转换合法返回目标状态，否则返回None
        """
        rule = cls.get_rule(current_status, operation)
        return rule.target_status if rule else None
    
    @classmethod
    def is_valid_transition(cls, current_status: WorkOrderStatus,
                            operation: OperationType) -> bool:
        """
        判断状态转换是否合法
        
        Args:
            current_status: 当前状态
            operation: 操作类型
            
        Returns:
            bool: 如果转换合法返回True
        """
        # 终态不可再做状态迁移
        if current_status.is_terminal():
            return False
        return cls.get_rule(current_status, operation) is not None
    
    @classmethod
    def validate_transition(cls, current_status: WorkOrderStatus,
                            operation: OperationType,
                            operator_id: str,
                            creator_id: str,
                            operator_role: str) -> WorkOrderStatus:
        """
        校验并执行状态转换
        
        校验内容包括：
        1. 转换是否在规则矩阵内
        2. 操作者角色是否匹配
        3. 自审检查（审批人不能审批自己创建的工单）
        
        Args:
            current_status: 当前状态
            operation: 操作类型
            operator_id: 操作者ID
            creator_id: 工单创建者ID
            operator_role: 操作者角色
            
        Returns:
            WorkOrderStatus: 目标状态
            
        Raises:
            InvalidTransitionError: 状态转换不在规则矩阵内
            PermissionDeniedError: 权限不足
            SelfApprovalForbiddenError: 自审禁止
        """
        # 检查终态
        if current_status.is_terminal():
            raise InvalidTransitionError(current_status, operation)
        
        # 获取规则
        rule = cls.get_rule(current_status, operation)
        if rule is None:
            raise InvalidTransitionError(current_status, operation)
        
        # 检查角色权限
        if operator_role not in rule.allowed_roles:
            raise PermissionDeniedError(
                current_status, operation,
                f"角色 {operator_role} 不具备执行操作 {operation.value} 的权限"
            )
        
        # 自审检查
        if rule.requires_self_check and operator_id == creator_id:
            raise SelfApprovalForbiddenError(current_status, operation)
        
        return rule.target_status
    
    @classmethod
    def get_available_operations(cls, current_status: WorkOrderStatus) -> list[OperationType]:
        """
        获取当前状态下可执行的所有操作
        
        Args:
            current_status: 当前状态
            
        Returns:
            list[OperationType]: 可执行操作列表
        """
        operations = []
        for rule in cls._RULES:
            if rule.current_status == current_status:
                operations.append(rule.operation)
        return operations


class IdempotencyKey:
    """
    幂等性key生成器
    
    幂等key = sha256(work_order_id + operator_id + operation_type + timestamp // 300s)
    5分钟窗口内的重复操作只执行一次
    """
    
    def __init__(self, work_order_id: str, operator_id: str,
                 operation_type: OperationType, timestamp: Optional[int] = None):
        self.work_order_id = work_order_id
        self.operator_id = operator_id
        self.operation_type = operation_type
        self._timestamp = timestamp
    
    @property
    def timestamp(self) -> int:
        """获取时间戳（秒级）"""
        if self._timestamp is None:
            from time import time
            self._timestamp = int(time())
        return self._timestamp
    
    @property
    def window(self) -> int:
        """获取5分钟时间窗口标识"""
        return self.timestamp // 300
    
    @property
    def key(self) -> str:
        """
        生成幂等性key
        
        Returns:
            str: SHA256哈希值
        """
        import hashlib
        
        data = (
            f"{self.work_order_id}"
            f"{self.operator_id}"
            f"{self.operation_type.value}"
            f"{self.window}"
        )
        return hashlib.sha256(data.encode()).hexdigest()


@dataclass
class TransitionResult:
    """
    状态迁移结果
    
    Attributes:
        success: 是否成功
        old_status: 原状态
        new_status: 新状态
        operation: 操作类型
        operator_id: 操作者ID
        timestamp: 操作时间
        notification_triggered: 是否触发了通知
        error: 错误信息（如果有）
    """
    success: bool
    old_status: WorkOrderStatus
    new_status: WorkOrderStatus
    operation: OperationType
    operator_id: str
    timestamp: Optional[int] = None
    notification_triggered: bool = False
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "success": self.success,
            "old_status": self.old_status.value,
            "new_status": self.new_status.value,
            "operation": self.operation.value,
            "operator_id": self.operator_id,
            "timestamp": self.timestamp,
            "notification_triggered": self.notification_triggered,
            "error": self.error
        }


class NotificationTriggerRule:
    """
    通知触发规则
    
    定义哪些状态变更需要触发通知
    """
    
    # 需要触发通知的目标状态
    TRIGGER_ON_STATES: list[WorkOrderStatus] = [
        WorkOrderStatus.APPROVED,
        WorkOrderStatus.REJECTED,
        WorkOrderStatus.RETURNED
    ]
    
    # 不触发通知的状态
    NO_TRIGGER_STATES: list[WorkOrderStatus] = [
        WorkOrderStatus.DRAFT,
        WorkOrderStatus.PENDING,
        WorkOrderStatus.CANCELLED
    ]
    
    @classmethod
    def should_trigger_notification(cls, target_status: WorkOrderStatus) -> bool:
        """
        判断目标状态是否需要触发通知
        
        Args:
            target_status: 目标状态
            
        Returns:
            bool: 如果需要触发返回True
        """
        return target_status in cls.TRIGGER_ON_STATES
    
    @classmethod
    def get_notification_content(cls, work_order_id: str, 
                                  work_order_title: str,
                                  operation: OperationType,
                                  operator_id: str,
                                  timestamp: int) -> Dict[str, Any]:
        """
        生成通知内容
        
        通知内容必须包含：工单ID、工单标题、操作类型、审批人、审批时间（精确到秒）
        
        Args:
            work_order_id: 工单ID
            work_order_title: 工单标题
            operation: 操作类型
            operator_id: 审批人ID
            timestamp: 审批时间戳
            
        Returns:
            Dict[str, Any]: 通知内容字典
        """
        from datetime import datetime
        
        return {
            "work_order_id": work_order_id,
            "work_order_title": work_order_title,
            "operation": operation.value,
            "operator_id": operator_id,
            "approval_time": datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S"),
            "approval_timestamp": timestamp
        }