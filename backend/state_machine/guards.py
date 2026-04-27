"""
状态机守卫条件模块

本模块实现了工单审批流程的状态转换守卫条件，用于校验：
- 状态转换的有效性
- 用户权限的合法性
- 防止自审等业务规则

Version: v2.0
Last Updated: 2025-01-26
"""

from typing import Optional, Set
from enum import Enum


class WorkOrderStatus(Enum):
    """工单状态枚举"""
    CREATED = "created"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class ApprovalAction(Enum):
    """审批操作枚举"""
    APPROVE = "approve"
    REJECT = "reject"
    SUBMIT = "submit"
    CLOSE = "close"


# 允许的状态转换映射
ALLOWED_TRANSITIONS: dict[WorkOrderStatus, dict[ApprovalAction, WorkOrderStatus]] = {
    WorkOrderStatus.CREATED: {
        ApprovalAction.SUBMIT: WorkOrderStatus.PENDING_APPROVAL,
    },
    WorkOrderStatus.PENDING_APPROVAL: {
        ApprovalAction.APPROVE: WorkOrderStatus.APPROVED,
        ApprovalAction.REJECT: WorkOrderStatus.REJECTED,
    },
    WorkOrderStatus.APPROVED: {
        ApprovalAction.CLOSE: WorkOrderStatus.CLOSED,
    },
}

# 终态集合 - 不可再进行转换
TERMINAL_STATES: Set[WorkOrderStatus] = {
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.CLOSED,
}


class GuardError(Exception):
    """守卫条件异常基类"""
    pass


class InvalidStateTransitionError(GuardError):
    """无效状态转换异常"""
    pass


class PermissionDeniedError(GuardError):
    """权限不足异常"""
    pass


class OptimisticLockError(GuardError):
    """乐观锁冲突异常"""
    pass


class ValidationError(GuardError):
    """校验失败异常"""
    pass


def can_transition(
    current_status: str,
    action: str,
) -> bool:
    """
    检查是否允许从当前状态执行指定操作

    Args:
        current_status: 当前状态（字符串形式）
        action: 操作类型

    Returns:
        bool: 是否允许转换

    Example:
        >>> can_transition("pending_approval", "approve")
        True
        >>> can_transition("approved", "reject")
        False
    """
    try:
        status = WorkOrderStatus(current_status)
        act = ApprovalAction(action)
    except ValueError:
        return False

    if status in TERMINAL_STATES:
        return False

    allowed_actions = ALLOWED_TRANSITIONS.get(status, {})
    return act in allowed_actions


def get_next_state(
    current_status: str,
    action: str,
) -> Optional[str]:
    """
    获取指定操作后的目标状态

    Args:
        current_status: 当前状态
        action: 操作类型

    Returns:
        Optional[str]: 目标状态，如不可转换则返回None

    Example:
        >>> get_next_state("pending_approval", "approve")
        'approved'
        >>> get_next_state("closed", "approve") is None
        True
    """
    try:
        status = WorkOrderStatus(current_status)
        act = ApprovalAction(action)
    except ValueError:
        return None

    allowed_actions = ALLOWED_TRANSITIONS.get(status, {})
    next_status = allowed_actions.get(act)
    
    if next_status:
        return next_status.value
    return None


def validate_permission(
    user_id: int,
    user_role: str,
    work_order_creator_id: int,
    action: str,
) -> None:
    """
    校验用户审批权限

    Args:
        user_id: 用户ID
        user_role: 用户角色
        work_order_creator_id: 工单创建者ID
        action: 操作类型

    Raises:
        PermissionDeniedError: 权限不足时抛出

    Business Rules:
        1. APPROVE/REJECT 操作需要 APPROVER 角色
        2. 工单创建者不能审批自己的工单
    """
    if action in (ApprovalAction.APPROVE.value, ApprovalAction.REJECT.value):
        # 角色权限检查
        if user_role != "APPROVER":
            raise PermissionDeniedError(
                f"User role '{user_role}' cannot perform '{action}' action. "
                "Only APPROVER role is allowed."
            )
        
        # 自审检查
        if user_id == work_order_creator_id:
            raise PermissionDeniedError(
                "Work order creator cannot approve/reject their own work order"
            )


def validate_reject_reason(reason: Optional[str]) -> None:
    """
    校验驳回理由

    Args:
        reason: 驳回理由

    Raises:
        ValidationError: 校验失败时抛出

    Rules:
        - 驳回操作必须提供理由
        - 理由最少10个字符
    """
    if reason is None or reason.strip() == "":
        raise ValidationError("Reject reason is required")
    
    if len(reason.strip()) < 10:
        raise ValidationError(
            f"Reject reason must be at least 10 characters, "
            f"got {len(reason.strip())}"
        )


def check_optimistic_lock(
    current_version: int,
    expected_version: int,
) -> None:
    """
    检查乐观锁版本是否匹配

    Args:
        current_version: 数据库中的当前版本
        expected_version: 请求中期望的版本

    Raises:
        OptimisticLockError: 版本冲突时抛出
    """
    if current_version != expected_version:
        raise OptimisticLockError(
            f"Version conflict: expected {expected_version}, "
            f"but current version is {current_version}"
        )


def validate_state_for_action(
    current_status: str,
    action: str,
) -> None:
    """
    校验当前状态是否可以执行指定操作

    Args:
        current_status: 当前状态
        action: 操作类型

    Raises:
        InvalidStateTransitionError: 无效状态转换时抛出
    """
    if not can_transition(current_status, action):
        raise InvalidStateTransitionError(
            f"Cannot perform '{action}' on work order in status '{current_status}'"
        )


class WorkOrderGuard:
    """
    工单状态守卫类

    封装所有工单审批相关的守卫条件检查逻辑

    Usage:
        guard = WorkOrderGuard()
        guard.check_approval_permission(user_id, user_role, work_order)
        guard.check_state_transition(work_order, "approve")
    """

    def __init__(self):
        """初始化守卫实例"""
        self._validation_errors: list[str] = []

    @property
    def errors(self) -> list[str]:
        """获取验证错误列表"""
        return self._validation_errors.copy()

    def clear_errors(self) -> None:
        """清空错误列表"""
        self._validation_errors = []

    def check_approval_permission(
        self,
        user_id: int,
        user_role: str,
        work_order_creator_id: int,
    ) -> bool:
        """
        检查审批权限

        Args:
            user_id: 用户ID
            user_role: 用户角色
            work_order_creator_id: 工单创建者ID

        Returns:
            bool: 是否有权限

        Example:
            >>> guard = WorkOrderGuard()
            >>> guard.check_approval_permission(1, "APPROVER", 2)
            True
            >>> guard.check_approval_permission(1, "USER", 1)
            False
        """
        self.clear_errors()
        try:
            validate_permission(user_id, user_role, work_order_creator_id, "approve")
            return True
        except PermissionDeniedError as e:
            self._validation_errors.append(str(e))
            return False

    def check_state_transition(
        self,
        current_status: str,
        action: str,
    ) -> bool:
        """
        检查状态转换是否有效

        Args:
            current_status: 当前状态
            action: 操作类型

        Returns:
            bool: 是否可以转换

        Example:
            >>> guard = WorkOrderGuard()
            >>> guard.check_state_transition("pending_approval", "approve")
            True
        """
        self.clear_errors()
        if not can_transition(current_status, action):
            self._validation_errors.append(
                f"Invalid state transition: {current_status} -> {action}"
            )
            return False
        return True

    def validate_reject_request(
        self,
        reason: Optional[str],
    ) -> bool:
        """
        校验驳回请求

        Args:
            reason: 驳回理由

        Returns:
            bool: 校验是否通过
        """
        self.clear_errors()
        try:
            validate_reject_reason(reason)
            return True
        except ValidationError as e:
            self._validation_errors.append(str(e))
            return False

    def is_terminal_state(self, status: str) -> bool:
        """
        检查是否为终态

        Args:
            status: 状态值

        Returns:
            bool: 是否为终态
        """
        try:
            return WorkOrderStatus(status) in TERMINAL_STATES
        except ValueError:
            return False

    def get_allowed_actions(self, current_status: str) -> list[str]:
        """
        获取当前状态下允许的操作列表

        Args:
            current_status: 当前状态

        Returns:
            list[str]: 允许的操作列表

        Example:
            >>> guard = WorkOrderGuard()
            >>> actions = guard.get_allowed_actions("pending_approval")
            >>> "approve" in actions and "reject" in actions
            True
        """
        try:
            status = WorkOrderStatus(current_status)
        except ValueError:
            return []

        if status in TERMINAL_STATES:
            return []

        actions = ALLOWED_TRANSITIONS.get(status, {})
        return [action.value for action in actions.keys()]