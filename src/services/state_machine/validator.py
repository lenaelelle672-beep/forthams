"""
状态机验证器模块

提供工单审批流程的状态转换验证、权限校验和参数校验功能。
遵循 SWARM-2025-Q2-P0-003 规格文档要求。
"""

from dataclasses import dataclass
from typing import Optional
from enum import Enum


class WorkOrderStatus(str, Enum):
    """工单状态枚举"""
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class ValidationError(Exception):
    """参数校验失败异常"""
    pass


class ForbiddenError(Exception):
    """权限不足异常"""
    pass


class ConflictError(Exception):
    """冲突异常（如重复操作）"""
    pass


class NotFoundError(Exception):
    """资源未找到异常"""
    pass


@dataclass
class WorkOrder:
    """工单数据模型"""
    id: int
    status: str
    version: int
    current_approver_id: Optional[int] = None
    created_by: Optional[int] = None
    approver_id: Optional[int] = None


@dataclass
class User:
    """用户数据模型"""
    user_id: int
    role: str


class StateTransitionValidator:
    """
    状态转换验证器

    负责验证工单状态转换的合法性，包括：
    - 状态约束：仅 PENDING_APPROVAL 状态的工单允许审批操作
    - 权限约束：当前用户必须为工单指定审批人
    - 幂等约束：已处理工单重复提交返回 409 Conflict
    - 参数约束：驳回操作必须提供 reject_reason
    """

    # 允许的状态转换规则表
    # 格式: (当前状态, 动作) -> 目标状态
    TRANSITION_TABLE = {
        (WorkOrderStatus.PENDING_APPROVAL, "APPROVE"): WorkOrderStatus.APPROVED,
        (WorkOrderStatus.PENDING_APPROVAL, "REJECT"): WorkOrderStatus.REJECTED,
    }

    @classmethod
    def validate_transition(
        cls,
        work_order: WorkOrder,
        action: str,
        user_id: int,
        reject_reason: Optional[str] = None,
    ) -> tuple[bool, str]:
        """
        验证状态转换是否合法

        Args:
            work_order: 工单对象
            action: 动作，APPROVE 或 REJECT
            user_id: 当前用户ID
            reject_reason: 驳回原因（仅 REJECT 动作需要）

        Returns:
            tuple: (是否通过验证, 错误信息)

        Raises:
            ValidationError: 参数校验失败
            ForbiddenError: 权限不足
            ConflictError: 状态冲突
            NotFoundError: 工单不存在
        """
        # 检查工单是否存在
        if not work_order:
            raise NotFoundError("Work order not found")

        # 权限校验
        if not cls._check_permission(work_order, user_id):
            raise ForbiddenError(
                f"User {user_id} is not authorized to approve/reject work order {work_order.id}"
            )

        # 状态约束校验
        if not cls._check_status_constraint(work_order, action):
            raise ConflictError(
                f"Work order {work_order.id} with status {work_order.status} cannot perform action {action}"
            )

        # 参数约束校验
        if action == "REJECT":
            cls._validate_reject_reason(reject_reason)

        # 幂等性校验
        if not cls._check_idempotency(work_order, action):
            raise ConflictError(
                f"Work order {work_order.id} has already been processed (status: {work_order.status})"
            )

        return True, ""

    @classmethod
    def _check_permission(cls, work_order: WorkOrder, user_id: int) -> bool:
        """
        检查用户是否有权限操作该工单

        规则：
        1. 用户必须是工单的指定审批人（current_approver_id）
        2. 工单创建者不能审批自己的工单

        Args:
            work_order: 工单对象
            user_id: 当前用户ID

        Returns:
            bool: 是否有权限
        """
        if not work_order:
            return False

        # 审批人必须是当前审批人
        if work_order.current_approver_id != user_id:
            return False

        # 工单创建者不能审批自己的工单
        if work_order.created_by == user_id:
            return False

        return True

    @classmethod
    def _check_status_constraint(cls, work_order: WorkOrder, action: str) -> bool:
        """
        检查状态约束

        仅 PENDING_APPROVAL 状态的工单允许审批操作

        Args:
            work_order: 工单对象
            action: 动作

        Returns:
            bool: 是否满足状态约束
        """
        if not work_order:
            return False

        # 仅 PENDING_APPROVAL 状态的工单允许审批操作
        if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
            return False

        return True

    @classmethod
    def _check_idempotency(cls, work_order: WorkOrder, action: str) -> bool:
        """
        检查幂等性

        已处理工单（APPROVED/REJECTED）重复提交返回 False

        Args:
            work_order: 工单对象
            action: 动作

        Returns:
            bool: 是否允许操作（True 表示允许，False 表示已处理过）
        """
        if not work_order:
            return False

        # 已批准的工单不能重复审批
        if work_order.status == WorkOrderStatus.APPROVED:
            return False

        # 已驳回的工单不能重复驳回
        if work_order.status == WorkOrderStatus.REJECTED:
            return False

        return True

    @classmethod
    def _validate_reject_reason(cls, reject_reason: Optional[str]) -> None:
        """
        验证驳回原因

        驳回操作必须提供 reject_reason（非空字符串，最大 500 字符）

        Args:
            reject_reason: 驳回原因

        Raises:
            ValidationError: 驳回原因校验失败
        """
        if not reject_reason:
            raise ValidationError("reject_reason is required")

        if not isinstance(reject_reason, str):
            raise ValidationError("reject_reason must be a string")

        if len(reject_reason.strip()) == 0:
            raise ValidationError("reject_reason cannot be empty")

        if len(reject_reason) > 500:
            raise ValidationError("reject_reason cannot exceed 500 characters")

    @classmethod
    def get_next_status(cls, work_order: WorkOrder, action: str) -> str:
        """
        获取目标状态

        Args:
            work_order: 工单对象
            action: 动作

        Returns:
            str: 目标状态

        Raises:
            ConflictError: 不允许的状态转换
        """
        key = (work_order.status, action)
        if key not in cls.TRANSITION_TABLE:
            raise ConflictError(
                f"Invalid transition from {work_order.status} with action {action}"
            )
        return cls.TRANSITION_TABLE[key]

    @classmethod
    def is_valid_transition(cls, current_status: str, action: str) -> bool:
        """
        检查状态转换是否有效

        Args:
            current_status: 当前状态
            action: 动作

        Returns:
            bool: 是否有效
        """
        return (current_status, action) in cls.TRANSITION_TABLE

    @classmethod
    def get_allowed_actions(cls, work_order: WorkOrder) -> list[str]:
        """
        获取工单允许的操作列表

        Args:
            work_order: 工单对象

        Returns:
            list[str]: 允许的操作列表
        """
        allowed = []
        for (status, action) in cls.TRANSITION_TABLE.keys():
            if work_order.status == status:
                allowed.append(action)
        return allowed


# 便捷函数
def can_user_approve(work_order: WorkOrder, user: User) -> bool:
    """
    检查用户是否有权限审批工单

    Args:
        work_order: 工单对象
        user: 用户对象

    Returns:
        bool: 是否有权限
    """
    if not work_order:
        return False

    # 用户必须具有 APPROVER 角色
    if user.role != "APPROVER":
        return False

    # 工单状态必须为 PendingApproval
    if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
        return False

    # 审批人必须是当前审批人
    if work_order.current_approver_id != user.user_id:
        return False

    # 工单创建者不能审批自己的工单
    if work_order.created_by == user.user_id:
        return False

    return True


def can_user_reject(work_order: WorkOrder, user: User) -> bool:
    """
    检查用户是否有权限驳回工单

    Args:
        work_order: 工单对象
        user: 用户对象

    Returns:
        bool: 是否有权限
    """
    # 驳回权限与审批权限相同
    return can_user_approve(work_order, user)