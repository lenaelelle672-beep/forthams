"""
Approval Service — 多级审批核心业务逻辑.

实现工单从发起到完成的两级审批机制（部门主管 → 资产管理员），
包含状态机校验、乐观锁并发控制、审批记录持久化及角色数据隔离。

状态流转:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    任意审批节点 → REJECTED
    PENDING / APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → CANCELLED
"""

from __future__ import annotations

import enum
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------

class ApprovalError(Exception):
    """审批服务基础异常."""

    def __init__(self, message: str, code: str = "APPROVAL_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(self.message)


class InvalidStateTransitionError(ApprovalError):
    """非法状态流转异常 — 对应 HTTP 409 Conflict."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="INVALID_STATE_TRANSITION")


class RejectionReasonRequiredError(ApprovalError):
    """驳回原因缺失异常 — 对应 HTTP 400 Bad Request."""

    def __init__(self, message: str = "驳回时必须提供 rejectionReason（非空，最大 500 字符）") -> None:
        super().__init__(message, code="REJECTION_REASON_REQUIRED")


class OptimisticLockError(ApprovalError):
    """乐观锁冲突异常 — 对应 HTTP 409 Conflict."""

    def __init__(self, message: str = "工单已被其他操作修改，请刷新后重试") -> None:
        super().__init__(message, code="OPTIMISTIC_LOCK_CONFLICT")


class RolePermissionError(ApprovalError):
    """角色权限不足异常 — 对应 HTTP 403 Forbidden."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="ROLE_PERMISSION_DENIED")


class OrderNotFoundError(ApprovalError):
    """工单不存在异常 — 对应 HTTP 404 Not Found."""

    def __init__(self, order_id: Any) -> None:
        super().__init__(f"工单不存在: {order_id}", code="ORDER_NOT_FOUND")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OrderStatus(enum.Enum):
    """工单审批状态枚举.

    状态机合法流转:
        正向: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
        驳回: APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → REJECTED
        取消: PENDING / APPROVING_LEVEL_1 / APPROVING_LEVEL_2 → CANCELLED
    """

    PENDING = "PENDING"
    APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
    APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class ApprovalAction(enum.Enum):
    """审批动作枚举."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CANCEL = "CANCEL"


class OperatorRole(enum.Enum):
    """操作人角色枚举."""

    DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER"  # 部门主管 — 审批 Level 1
    ASSET_MANAGER = "ASSET_MANAGER"            # 资产管理员 — 审批 Level 2
    APPLICANT = "APPLICANT"                    # 申请人 — 发起/取消


# ---------------------------------------------------------------------------
# State Machine — 合法流转定义
# ---------------------------------------------------------------------------

# key: (current_status, event)  →  value: next_status
_VALID_TRANSITIONS: dict[tuple[OrderStatus, ApprovalAction], OrderStatus] = {
    # 正向审批流
    (OrderStatus.PENDING, ApprovalAction.APPROVE): OrderStatus.APPROVING_LEVEL_1,
    (OrderStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE): OrderStatus.APPROVING_LEVEL_2,
    (OrderStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE): OrderStatus.APPROVED,
    # 驳回流
    (OrderStatus.APPROVING_LEVEL_1, ApprovalAction.REJECT): OrderStatus.REJECTED,
    (OrderStatus.APPROVING_LEVEL_2, ApprovalAction.REJECT): OrderStatus.REJECTED,
    # 取消流
    (OrderStatus.PENDING, ApprovalAction.CANCEL): OrderStatus.CANCELLED,
    (OrderStatus.APPROVING_LEVEL_1, ApprovalAction.CANCEL): OrderStatus.CANCELLED,
    (OrderStatus.APPROVING_LEVEL_2, ApprovalAction.CANCEL): OrderStatus.CANCELLED,
}

# 终态集合 — 终态不可再流转
_TERMINAL_STATES: set[OrderStatus] = {
    OrderStatus.APPROVED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
}

# 角色 → 可审批的状态映射（数据隔离）
_ROLE_APPROVAL_STATUS_MAP: dict[OperatorRole, set[OrderStatus]] = {
    OperatorRole.DEPARTMENT_MANAGER: {OrderStatus.APPROVING_LEVEL_1},
    OperatorRole.ASSET_MANAGER: {OrderStatus.APPROVING_LEVEL_2},
}


# ---------------------------------------------------------------------------
# Approval Record (领域值对象)
# ---------------------------------------------------------------------------

class ApprovalRecord:
    """审批记录值对象 — 记录每次审批操作的完整信息.

    Attributes:
        order_id: 关联工单 ID.
        operator_id: 操作人 ID.
        operator_role: 操作人角色.
        action: 审批动作（APPROVE / REJECT / CANCEL）.
        comment: 审批备注（驳回时为驳回原因）.
        created_at: 操作时间（ISO 8601 UTC）.
    """

    def __init__(
        self,
        order_id: Any,
        operator_id: Any,
        operator_role: OperatorRole,
        action: ApprovalAction,
        comment: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        """初始化审批记录.

        Args:
            order_id: 关联工单 ID.
            operator_id: 操作人 ID.
            operator_role: 操作人角色.
            action: 审批动作.
            comment: 审批备注或驳回原因.
            created_at: 操作时间，默认为当前 UTC 时间.
        """
        self.order_id = order_id
        self.operator_id = operator_id
        self.operator_role = operator_role
        self.action = action
        self.comment = comment
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        """将审批记录序列化为字典.

        Returns:
            包含审批记录所有字段的字典，日期格式为 ISO 8601.
        """
        return {
            "order_id": self.order_id,
            "operator_id": self.operator_id,
            "operator_role": self.operator_role.value,
            "action": self.action.value,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Work Order (领域实体 — 轻量级，用于服务层操作)
# ---------------------------------------------------------------------------

class WorkOrder:
    """工单领域实体（服务层视图）.

    Attributes:
        id: 工单唯一标识.
        status: 当前审批状态.
        version: 乐观锁版本号，每次更新自增.
        applicant_id: 申请人 ID.
        created_at: 创建时间.
        updated_at: 最后更新时间.
    """

    def __init__(
        self,
        id: Any,
        status: OrderStatus,
        version: int = 1,
        applicant_id: Optional[Any] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        """初始化工单实体.

        Args:
            id: 工单唯一标识.
            status: 当前审批状态.
            version: 乐观锁版本号.
            applicant_id: 申请人 ID.
            created_at: 创建时间.
            updated_at: 最后更新时间.
        """
        self.id = id
        self.status = status
        self.version = version
        self.applicant_id = applicant_id
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        """将工单序列化为字典.

        Returns:
            包含工单所有字段的字典，日期格式为 ISO 8601.
        """
        return {
            "id": self.id,
            "status": self.status.value,
            "version": self.version,
            "applicant_id": self.applicant_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Repository Interfaces (抽象端口)
# ---------------------------------------------------------------------------

class WorkOrderRepository:
    """工单持久化仓储抽象接口.

    具体实现需由基础设施层提供（如 SQLAlchemy / MyBatis）。
    """

    def get_by_id(self, order_id: Any) -> Optional[WorkOrder]:
        """根据 ID 获取工单.

        Args:
            order_id: 工单 ID.

        Returns:
            工单实体，不存在时返回 None.
        """
        raise NotImplementedError

    def update_status(
        self,
        order_id: Any,
        new_status: OrderStatus,
        expected_version: int,
    ) -> WorkOrder:
        """乐观锁更新工单状态.

        Args:
            order_id: 工单 ID.
            new_status: 目标状态.
            expected_version: 期望的当前版本号（乐观锁）.

        Returns:
            更新后的工单实体.

        Raises:
            OptimisticLockError: 版本号不匹配时抛出.
            OrderNotFoundError: 工单不存在时抛出.
        """
        raise NotImplementedError

    def list_by_status(
        self,
        statuses: list[OrderStatus],
        page: int = 1,
        page_size: int = 20,
    ) -> list[WorkOrder]:
        """按状态列表查询工单（分页）.

        Args:
            statuses: 要查询的状态列表.
            page: 页码（从 1 开始）.
            page_size: 每页数量.

        Returns:
            符合条件的工单列表.
        """
        raise NotImplementedError


class ApprovalRecordRepository:
    """审批记录持久化仓储抽象接口.

    具体实现需由基础设施层提供。
    """

    def save(self, record: ApprovalRecord) -> ApprovalRecord:
        """持久化审批记录.

        Args:
            record: 审批记录实体.

        Returns:
            持久化后的审批记录（含数据库生成 ID）.
        """
        raise NotImplementedError

    def list_by_order_id(self, order_id: Any) -> list[ApprovalRecord]:
        """查询工单的全部审批记录.

        Args:
            order_id: 工单 ID.

        Returns:
            按时间正序排列的审批记录列表.
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Approval Service — 核心服务
# ---------------------------------------------------------------------------

class ApprovalService:
    """多级审批核心服务.

    职责:
        1. 状态机校验 — 确保审批流转合法，禁止跨级审批.
        2. 乐观锁控制 — 基于 version 字段防止并发审批冲突.
        3. 审批记录留痕 — 每次操作持久化 ApprovalRecord.
        4. 角色数据隔离 — 部门主管仅见 Level 1，资产管理员仅见 Level 2.
        5. 驳回校验 — rejectionReason 非空且不超过 500 字符.

    Usage::

        service = ApprovalService(order_repo, record_repo)
        service.approve(order_id=1, operator_id=10, operator_role=OperatorRole.DEPARTMENT_MANAGER)
        service.reject(order_id=2, operator_id=20, operator_role=OperatorRole.ASSET_MANAGER, rejection_reason="不合规")
    """

    def __init__(
        self,
        order_repository: WorkOrderRepository,
        record_repository: ApprovalRecordRepository,
    ) -> None:
        """初始化审批服务.

        Args:
            order_repository: 工单仓储实例.
            record_repository: 审批记录仓储实例.
        """
        self._order_repo = order_repository
        self._record_repo = record_repository

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def approve(
        self,
        order_id: Any,
        operator_id: Any,
        operator_role: OperatorRole,
        comment: Optional[str] = None,
    ) -> WorkOrder:
        """审批通过工单.

        根据当前工单状态和操作人角色，执行一级或二级审批通过操作。
        状态机校验通过后，以乐观锁方式更新工单状态并持久化审批记录。

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID.
            operator_role: 操作人角色（DEPARTMENT_MANAGER 或 ASSET_MANAGER）.
            comment: 审批备注（可选）.

        Returns:
            更新后的工单实体.

        Raises:
            OrderNotFoundError: 工单不存在.
            InvalidStateTransitionError: 当前状态不允许审批通过.
            RolePermissionError: 操作人角色与当前审批级别不匹配.
            OptimisticLockError: 并发冲突.
        """
        order = self._get_order_or_raise(order_id)
        self._validate_role_for_status(order.status, operator_role)
        new_status = self._transition(order.status, ApprovalAction.APPROVE)

        updated_order = self._order_repo.update_status(order_id, new_status, order.version)
        self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            operator_role=operator_role,
            action=ApprovalAction.APPROVE,
            comment=comment,
        )
        logger.info(
            "工单审批通过: order_id=%s, operator=%s, role=%s, new_status=%s",
            order_id, operator_id, operator_role.value, new_status.value,
        )
        return updated_order

    def reject(
        self,
        order_id: Any,
        operator_id: Any,
        operator_role: OperatorRole,
        rejection_reason: str,
    ) -> WorkOrder:
        """驳回工单.

        在任意审批节点执行驳回操作，工单状态流转至 REJECTED。
        必须提供非空的驳回原因（最大 500 字符）。

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID.
            operator_role: 操作人角色.
            rejection_reason: 驳回原因（非空，最大 500 字符）.

        Returns:
            更新后的工单实体.

        Raises:
            OrderNotFoundError: 工单不存在.
            RejectionReasonRequiredError: 驳回原因为空或超过 500 字符.
            InvalidStateTransitionError: 当前状态不允许驳回.
            RolePermissionError: 操作人角色与当前审批级别不匹配.
            OptimisticLockError: 并发冲突.
        """
        self._validate_rejection_reason(rejection_reason)

        order = self._get_order_or_raise(order_id)
        self._validate_role_for_status(order.status, operator_role)
        new_status = self._transition(order.status, ApprovalAction.REJECT)

        updated_order = self._order_repo.update_status(order_id, new_status, order.version)
        self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            operator_role=operator_role,
            action=ApprovalAction.REJECT,
            comment=rejection_reason,
        )
        logger.info(
            "工单驳回: order_id=%s, operator=%s, role=%s, reason=%s",
            order_id, operator_id, operator_role.value, rejection_reason,
        )
        return updated_order

    def cancel(
        self,
        order_id: Any,
        operator_id: Any,
        reason: Optional[str] = None,
    ) -> WorkOrder:
        """取消工单.

        申请人可取消处于 PENDING、APPROVING_LEVEL_1 或 APPROVING_LEVEL_2 状态的工单。

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID（通常为申请人本人）.
            reason: 取消原因（可选）.

        Returns:
            更新后的工单实体.

        Raises:
            OrderNotFoundError: 工单不存在.
            InvalidStateTransitionError: 当前状态不允许取消.
            OptimisticLockError: 并发冲突.
        """
        order = self._get_order_or_raise(order_id)
        new_status = self._transition(order.status, ApprovalAction.CANCEL)

        updated_order = self._order_repo.update_status(order_id, new_status, order.version)
        self._persist_record(
            order_id=order_id,
            operator_id=operator_id,
            operator_role=OperatorRole.APPLICANT,
            action=ApprovalAction.CANCEL,
            comment=reason,
        )
        logger.info(
            "工单取消: order_id=%s, operator=%s, reason=%s",
            order_id, operator_id, reason,
        )
        return updated_order

    def get_pending_orders(
        self,
        operator_role: OperatorRole,
        page: int = 1,
        page_size: int = 20,
    ) -> list[WorkOrder]:
        """获取当前角色待审批的工单列表（数据隔离）.

        部门主管仅可见 APPROVING_LEVEL_1 工单，
        资产管理员仅可见 APPROVING_LEVEL_2 工单。

        Args:
            operator_role: 操作人角色.
            page: 页码（从 1 开始）.
            page_size: 每页数量.

        Returns:
            符合角色权限的待审批工单列表.

        Raises:
            RolePermissionError: 角色无审批权限.
        """
        allowed_statuses = _ROLE_APPROVAL_STATUS_MAP.get(operator_role)
        if allowed_statuses is None:
            raise RolePermissionError(
                f"角色 '{operator_role.value}' 没有待审批工单查看权限"
            )

        orders = self._order_repo.list_by_status(
            statuses=list(allowed_statuses),
            page=page,
            page_size=page_size,
        )
        logger.info(
            "查询待审批工单: role=%s, count=%d",
            operator_role.value, len(orders),
        )
        return orders

    def get_approval_history(self, order_id: Any) -> list[ApprovalRecord]:
        """获取工单的完整审批记录.

        Args:
            order_id: 工单 ID.

        Returns:
            按时间正序排列的审批记录列表.

        Raises:
            OrderNotFoundError: 工单不存在.
        """
        self._get_order_or_raise(order_id)
        return self._record_repo.list_by_order_id(order_id)

    # ------------------------------------------------------------------
    # State Machine
    # ------------------------------------------------------------------

    @staticmethod
    def validate_transition(
        current_status: OrderStatus,
        action: ApprovalAction,
    ) -> OrderStatus:
        """校验状态流转是否合法并返回目标状态（纯函数，无副作用）.

        可供外部（如 Controller 层）做前置校验。

        Args:
            current_status: 当前状态.
            action: 待执行动作.

        Returns:
            目标状态.

        Raises:
            InvalidStateTransitionError: 流转不合法.
        """
        return ApprovalService._transition(current_status, action)

    # ------------------------------------------------------------------
    # Private Helpers
    # ------------------------------------------------------------------

    def _get_order_or_raise(self, order_id: Any) -> WorkOrder:
        """获取工单，不存在时抛出 OrderNotFoundError.

        Args:
            order_id: 工单 ID.

        Returns:
            工单实体.

        Raises:
            OrderNotFoundError: 工单不存在.
        """
        order = self._order_repo.get_by_id(order_id)
        if order is None:
            raise OrderNotFoundError(order_id)
        return order

    @staticmethod
    def _transition(
        current_status: OrderStatus,
        action: ApprovalAction,
    ) -> OrderStatus:
        """执行状态机流转校验，返回目标状态.

        Args:
            current_status: 当前状态.
            action: 待执行动作.

        Returns:
            目标状态.

        Raises:
            InvalidStateTransitionError: 流转不合法（终态或未定义的流转）.
        """
        if current_status in _TERMINAL_STATES:
            raise InvalidStateTransitionError(
                f"工单已处于终态 '{current_status.value}'，不允许任何操作"
            )

        key = (current_status, action)
        new_status = _VALID_TRANSITIONS.get(key)
        if new_status is None:
            raise InvalidStateTransitionError(
                f"非法状态流转: '{current_status.value}' + '{action.value}' 不被允许"
            )
        return new_status

    @staticmethod
    def _validate_role_for_status(
        current_status: OrderStatus,
        operator_role: OperatorRole,
    ) -> None:
        """校验操作人角色是否有权操作当前状态的工单.

        规则:
            - DEPARTMENT_MANAGER 仅可操作 APPROVING_LEVEL_1 状态.
            - ASSET_MANAGER 仅可操作 APPROVING_LEVEL_2 状态.

        Args:
            current_status: 当前工单状态.
            operator_role: 操作人角色.

        Raises:
            RolePermissionError: 角色与状态不匹配.
        """
        expected_role_map: dict[OrderStatus, OperatorRole] = {
            OrderStatus.APPROVING_LEVEL_1: OperatorRole.DEPARTMENT_MANAGER,
            OrderStatus.APPROVING_LEVEL_2: OperatorRole.ASSET_MANAGER,
        }
        expected_role = expected_role_map.get(current_status)
        if expected_role is not None and operator_role != expected_role:
            raise RolePermissionError(
                f"角色 '{operator_role.value}' 无权操作状态为 "
                f"'{current_status.value}' 的工单，"
                f"需要 '{expected_role.value}' 角色"
            )

    @staticmethod
    def _validate_rejection_reason(reason: str) -> None:
        """校验驳回原因是否合法.

        规则: 非空字符串，最大 500 字符。

        Args:
            reason: 驳回原因.

        Raises:
            RejectionReasonRequiredError: 原因为空或超过 500 字符.
        """
        if not reason or not reason.strip():
            raise RejectionReasonRequiredError()
        if len(reason) > 500:
            raise RejectionReasonRequiredError(
                f"驳回原因不能超过 500 字符，当前 {len(reason)} 字符"
            )

    def _persist_record(
        self,
        order_id: Any,
        operator_id: Any,
        operator_role: OperatorRole,
        action: ApprovalAction,
        comment: Optional[str] = None,
    ) -> ApprovalRecord:
        """持久化审批记录.

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID.
            operator_role: 操作人角色.
            action: 审批动作.
            comment: 审批备注.

        Returns:
            持久化后的审批记录.
        """
        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            operator_role=operator_role,
            action=action,
            comment=comment,
        )
        return self._record_repo.save(record)