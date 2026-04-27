"""
State Machine Guards Module

状态机守卫条件模块，负责定义工单审批流程中的各种守卫条件：
- 状态转换守卫
- 权限守卫
- 约束守卫

配合状态机实现工单生命周期管理，确保状态转换的合法性。

Author: SWARM-2025-Q2-P0-003 Team
Iteration: 2
"""

from typing import Optional, Callable
from enum import Enum


class WorkOrderStatus(str, Enum):
    """工单状态枚举"""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class ApprovalAction(str, Enum):
    """审批动作枚举"""
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    CLOSE = "close"


class GuardResult:
    """守卫执行结果"""
    
    def __init__(self, passed: bool, reason: Optional[str] = None):
        self.passed = passed
        self.reason = reason
    
    def __bool__(self) -> bool:
        return self.passed
    
    def __repr__(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        reason_str = f" - {self.reason}" if self.reason else ""
        return f"<GuardResult {status}{reason_str}>"


class StateTransitionGuard:
    """状态转换守卫"""
    
    # 允许的状态转换映射
    ALLOWED_TRANSITIONS: dict = {
        WorkOrderStatus.DRAFT: [WorkOrderStatus.PENDING_APPROVAL],
        WorkOrderStatus.PENDING_APPROVAL: [WorkOrderStatus.APPROVED, WorkOrderStatus.REJECTED, WorkOrderStatus.CLOSED],
        WorkOrderStatus.APPROVED: [WorkOrderStatus.CLOSED],
        WorkOrderStatus.REJECTED: [WorkOrderStatus.PENDING_APPROVAL],  # 允许重新提交
        WorkOrderStatus.CLOSED: [],  # 终态，不可转换
    }
    
    @classmethod
    def can_transition(
        cls,
        current_status: WorkOrderStatus,
        action: ApprovalAction
    ) -> GuardResult:
        """
        检查是否允许执行状态转换
        
        Args:
            current_status: 当前工单状态
            action: 审批动作
        
        Returns:
            GuardResult: 守卫执行结果
        
        ATB-3 覆盖: 无效状态转换检测
        """
        # 确定目标状态
        target_status_map = {
            ApprovalAction.SUBMIT: WorkOrderStatus.PENDING_APPROVAL,
            ApprovalAction.APPROVE: WorkOrderStatus.APPROVED,
            ApprovalAction.REJECT: WorkOrderStatus.REJECTED,
            ApprovalAction.CLOSE: WorkOrderStatus.CLOSED,
        }
        
        target_status = target_status_map.get(action)
        if target_status is None:
            return GuardResult(False, f"Unknown action: {action}")
        
        # 检查是否允许此转换
        allowed_targets = cls.ALLOWED_TRANSITIONS.get(current_status, [])
        
        if target_status not in allowed_targets:
            return GuardResult(
                False,
                f"Invalid state transition from '{current_status.value}' with action '{action.value}'"
            )
        
        return GuardResult(True)
    
    @classmethod
    def is_terminal_state(cls, status: WorkOrderStatus) -> bool:
        """检查是否为终态"""
        return status == WorkOrderStatus.CLOSED


class PermissionGuard:
    """权限守卫"""
    
    APPROVER_ROLE = "APPROVER"
    
    @classmethod
    def can_user_approve(
        cls,
        user_id: str,
        approver_id: Optional[str],
        created_by: str
    ) -> GuardResult:
        """
        检查用户是否有审批权限
        
        规则:
        1. 当前审批人必须是指定审批人
        2. 审批人不能是自己的工单创建者
        
        Args:
            user_id: 用户ID
            approver_id: 当前审批人ID
            created_by: 工单创建者ID
        
        Returns:
            GuardResult: 守卫执行结果
        
        ATB-4 覆盖: 权限校验
        """
        # 规则1: 审批人必须是当前审批人
        if approver_id is not None and user_id != approver_id:
            return GuardResult(False, f"User {user_id} is not the current approver")
        
        # 规则2: 审批人不能审批自己的工单
        if user_id == created_by:
            return GuardResult(False, "Approver cannot approve their own work order")
        
        return GuardResult(True)
    
    @classmethod
    def has_role(cls, user_roles: list[str], required_role: str) -> GuardResult:
        """
        检查用户是否具有指定角色
        
        Args:
            user_roles: 用户角色列表
            required_role: 所需角色
        
        Returns:
            GuardResult: 守卫执行结果
        """
        if required_role not in user_roles:
            return GuardResult(False, f"User does not have required role: {required_role}")
        
        return GuardResult(True)


class ConstraintGuard:
    """约束守卫"""
    
    REJECT_REASON_MIN_LENGTH = 10
    
    @classmethod
    def validate_reject_reason(cls, reason: Optional[str]) -> GuardResult:
        """
        校验驳回理由
        
        规则: 驳回理由最少需要10个字符
        
        Args:
            reason: 驳回理由
        
        Returns:
            GuardResult: 守卫执行结果
        
        ATB-5 覆盖: 驳回理由校验
        """
        if not reason:
            return GuardResult(False, "Reject reason is required")
        
        reason_length = len(reason.strip())
        
        if reason_length < cls.REJECT_REASON_MIN_LENGTH:
            return GuardResult(
                False,
                f"Reject reason must be at least {cls.REJECT_REASON_MIN_LENGTH} characters, got {reason_length}"
            )
        
        return GuardResult(True)
    
    @classmethod
    def validate_workorder_exists(cls, workorder: Optional[dict]) -> GuardResult:
        """
        校验工单是否存在
        
        Args:
            workorder: 工单对象
        
        Returns:
            GuardResult: 守卫执行结果
        """
        if workorder is None:
            return GuardResult(False, "Work order not found")
        
        return GuardResult(True)
    
    @classmethod
    def validate_version(
        cls,
        current_version: int,
        expected_version: int
    ) -> GuardResult:
        """
        校验乐观锁版本
        
        Args:
            current_version: 当前版本号
            expected_version: 期望版本号
        
        Returns:
            GuardResult: 守卫执行结果
        
        ATB-6 覆盖: 乐观锁检测
        """
        if current_version != expected_version:
            return GuardResult(
                False,
                f"Version conflict: expected {expected_version}, got {current_version}"
            )
        
        return GuardResult(True)


class IdempotencyGuard:
    """幂等性守卫"""
    
    IDEMPOTENCY_WINDOW_MS = 5000  # 5秒窗口
    
    @classmethod
    def is_within_idempotency_window(
        cls,
        last_timestamp: Optional[int],
        window_ms: int = IDEMPOTENCY_WINDOW_MS
    ) -> GuardResult:
        """
        检查是否在幂等窗口内
        
        Args:
            last_timestamp: 上次操作时间戳（毫秒）
            window_ms: 窗口时间（毫秒）
        
        Returns:
            GuardResult: 守卫执行结果
        """
        if last_timestamp is None:
            return GuardResult(True)  # 无历史记录，允许执行
        
        current_time = int(__import__("time").time() * 1000)
        elapsed = current_time - last_timestamp
        
        if elapsed < window_ms:
            return GuardResult(
                False,
                f"Request within idempotency window ({elapsed}ms < {window_ms}ms)"
            )
        
        return GuardResult(True)


class ConcurrencyGuard:
    """并发守卫"""
    
    @classmethod
    def check_optimistic_lock(
        cls,
        entity_version: int,
        request_version: int
    ) -> GuardResult:
        """
        乐观锁检查
        
        Args:
            entity_version: 实体当前版本
            request_version: 请求中的版本
        
        Returns:
            GuardResult: 守卫执行结果
        
        ATB-6 覆盖: 并发冲突检测
        """
        if entity_version != request_version:
            return GuardResult(
                False,
                f"Concurrent modification detected: entity version={entity_version}, request version={request_version}"
            )
        
        return GuardResult(True)


def create_guard_chain(*guards: Callable) -> Callable:
    """
    创建守卫链
    
    将多个守卫组合成一个链式调用，任一守卫失败则整体失败。
    
    Args:
        *guards: 守卫函数列表
    
    Returns:
        Callable: 组合后的守卫链
    """
    def guard_chain(*args, **kwargs) -> GuardResult:
        for guard in guards:
            result = guard(*args, **kwargs)
            if not result.passed:
                return result
        return GuardResult(True)
    
    return guard_chain


class ApprovalGuardChain:
    """审批操作守卫链"""
    
    @staticmethod
    def approve_guards(
        user_id: str,
        workorder: dict,
        user_roles: list[str]
    ) -> GuardResult:
        """
        审批通过守卫链
        
        组合多个守卫条件:
        1. 状态转换守卫 - 检查是否可以从 pending_approval 转换到 approved
        2. 权限守卫 - 检查用户是否有 APPROVER 角色
        3. 权限守卫 - 检查审批人是否为当前审批人且非创建者
        
        Args:
            user_id: 用户ID
            workorder: 工单对象
            user_roles: 用户角色列表
        
        Returns:
            GuardResult: 守卫执行结果
        """
        # 1. 状态转换检查
        current_status = WorkOrderStatus(workorder.get("status", "draft"))
        state_result = StateTransitionGuard.can_transition(
            current_status, 
            ApprovalAction.APPROVE
        )
        if not state_result:
            return state_result
        
        # 2. 角色权限检查
        role_result = PermissionGuard.has_role(user_roles, PermissionGuard.APPROVER_ROLE)
        if not role_result:
            return role_result
        
        # 3. 审批人权限检查
        permission_result = PermissionGuard.can_user_approve(
            user_id,
            workorder.get("current_approver_id"),
            workorder.get("created_by")
        )
        if not permission_result:
            return permission_result
        
        return GuardResult(True)
    
    @staticmethod
    def reject_guards(
        user_id: str,
        workorder: dict,
        reason: str,
        user_roles: list[str]
    ) -> GuardResult:
        """
        驳回守卫链
        
        组合多个守卫条件:
        1. 状态转换守卫 - 检查是否可以从 pending_approval 转换到 rejected
        2. 权限守卫 - 检查用户是否有 APPROVER 角色
        3. 权限守卫 - 检查审批人是否为当前审批人且非创建者
        4. 约束守卫 - 校验驳回理由长度
        
        Args:
            user_id: 用户ID
            workorder: 工单对象
            reason: 驳回理由
            user_roles: 用户角色列表
        
        Returns:
            GuardResult: 守卫执行结果
        """
        # 1. 状态转换检查
        current_status = WorkOrderStatus(workorder.get("status", "draft"))
        state_result = StateTransitionGuard.can_transition(
            current_status, 
            ApprovalAction.REJECT
        )
        if not state_result:
            return state_result
        
        # 2. 角色权限检查
        role_result = PermissionGuard.has_role(user_roles, PermissionGuard.APPROVER_ROLE)
        if not role_result:
            return role_result
        
        # 3. 审批人权限检查
        permission_result = PermissionGuard.can_user_approve(
            user_id,
            workorder.get("current_approver_id"),
            workorder.get("created_by")
        )
        if not permission_result:
            return permission_result
        
        # 4. 驳回理由校验
        reason_result = ConstraintGuard.validate_reject_reason(reason)
        if not reason_result:
            return reason_result
        
        return GuardResult(True)