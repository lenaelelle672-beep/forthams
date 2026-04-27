"""
Approval Service — 多级审批核心业务逻辑.

实现工单两级审批流程（部门主管 → 资产管理员），包含：
- 状态机驱动的正向/逆向状态流转
- 乐观锁并发控制
- 审批记录持久化留痕
- 角色级数据隔离

状态流转图:
    PENDING ──► APPROVING_LEVEL_1 ──► APPROVING_LEVEL_2 ──► APPROVED
                  │                       │
                  └──► REJECTED ◄─────────┘

    任意非终态 ──► CANCELLED
"""

from __future__ import annotations

import enum
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from src.core.exceptions import (
    BusinessError,
    ConflictError,
    InvalidStateTransitionError,
    RejectionReasonRequiredError,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OrderStatus(enum.Enum):
    """工单审批状态枚举."""

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


class ApprovalLevel(enum.Enum):
    """审批层级枚举."""

    LEVEL_1 = "LEVEL_1"  # 部门主管
    LEVEL_2 = "LEVEL_2"  # 资产管理员


# ---------------------------------------------------------------------------
# State Machine — 合法流转定义
# ---------------------------------------------------------------------------

# 正向流转映射: (当前状态, 动作) → 目标状态
_FORWARD_TRANSITIONS: dict[tuple[OrderStatus, ApprovalAction], OrderStatus] = {
    (OrderStatus.PENDING, ApprovalAction.APPROVE): OrderStatus.APPROVING_LEVEL_1,
    (OrderStatus.APPROVING_LEVEL_1, ApprovalAction.APPROVE): OrderStatus.APPROVING_LEVEL_2,
    (OrderStatus.APPROVING_LEVEL_2, ApprovalAction.APPROVE): OrderStatus.APPROVED,
}

# 逆向驳回映射: 任意审批节点 → REJECTED
_REJECT_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.PENDING: OrderStatus.REJECTED,
    OrderStatus.APPROVING_LEVEL_1: OrderStatus.REJECTED,
    OrderStatus.APPROVING_LEVEL_2: OrderStatus.REJECTED,
}

# 取消映射: 非终态 → CANCELLED
_CANCEL_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.PENDING: OrderStatus.CANCELLED,
    OrderStatus.APPROVING_LEVEL_1: OrderStatus.CANCELLED,
    OrderStatus.APPROVING_LEVEL_2: OrderStatus.CANCELLED,
}

# 终态集合 — 终态不可再流转
_TERMINAL_STATES: set[OrderStatus] = {
    OrderStatus.APPROVED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
}

# 状态 → 所需审批层级映射
_STATUS_TO_APPROVAL_LEVEL: dict[OrderStatus, Optional[ApprovalLevel]] = {
    OrderStatus.PENDING: None,
    OrderStatus.APPROVING_LEVEL_1: ApprovalLevel.LEVEL_1,
    OrderStatus.APPROVING_LEVEL_2: ApprovalLevel.LEVEL_2,
    OrderStatus.APPROVED: None,
    OrderStatus.REJECTED: None,
    OrderStatus.CANCELLED: None,
}

# 角色 → 可审批状态映射（数据隔离）
_ROLE_VISIBLE_STATUSES: dict[str, set[OrderStatus]] = {
    "DEPARTMENT_MANAGER": {OrderStatus.APPROVING_LEVEL_1},
    "ASSET_MANAGER": {OrderStatus.APPROVING_LEVEL_2},
}


# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------

class ApprovalRecordDTO:
    """审批记录数据传输对象.

    Attributes:
        order_id: 关联工单 ID.
        operator_id: 操作人 ID.
        operator_name: 操作人姓名.
        action: 审批动作 (APPROVE / REJECT / CANCEL).
        comment: 审批意见 / 驳回原因.
        approval_level: 审批层级.
        created_at: 操作时间 (ISO 8601).
    """

    def __init__(
        self,
        order_id: str,
        operator_id: str,
        operator_name: str,
        action: ApprovalAction,
        comment: Optional[str] = None,
        approval_level: Optional[ApprovalLevel] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        """初始化审批记录 DTO.

        Args:
            order_id: 关联工单 ID.
            operator_id: 操作人 ID.
            operator_name: 操作人姓名.
            action: 审批动作.
            comment: 审批意见或驳回原因.
            approval_level: 审批层级.
            created_at: 操作时间，默认为当前 UTC 时间.
        """
        self.order_id = order_id
        self.operator_id = operator_id
        self.operator_name = operator_name
        self.action = action
        self.comment = comment
        self.approval_level = approval_level
        self.created_at = created_at or datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式.

        Returns:
            包含审批记录所有字段的字典.
        """
        return {
            "order_id": self.order_id,
            "operator_id": self.operator_id,
            "operator_name": self.operator_name,
            "action": self.action.value,
            "comment": self.comment,
            "approval_level": self.approval_level.value if self.approval_level else None,
            "created_at": self.created_at.isoformat(),
        }


class ApprovalResult:
    """审批操作结果.

    Attributes:
        order_id: 工单 ID.
        previous_status: 操作前状态.
        current_status: 操作后状态.
        action: 执行的审批动作.
        approval_record: 生成的审批记录.
    """

    def __init__(
        self,
        order_id: str,
        previous_status: OrderStatus,
        current_status: OrderStatus,
        action: ApprovalAction,
        approval_record: ApprovalRecordDTO,
    ) -> None:
        """初始化审批结果.

        Args:
            order_id: 工单 ID.
            previous_status: 操作前状态.
            current_status: 操作后状态.
            action: 执行的审批动作.
            approval_record: 生成的审批记录.
        """
        self.order_id = order_id
        self.previous_status = previous_status
        self.current_status = current_status
        self.action = action
        self.approval_record = approval_record

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式.

        Returns:
            包含审批结果所有字段的字典.
        """
        return {
            "order_id": self.order_id,
            "previous_status": self.previous_status.value,
            "current_status": self.current_status.value,
            "action": self.action.value,
            "approval_record": self.approval_record.to_dict(),
        }


# ---------------------------------------------------------------------------
# Repository Interfaces (依赖注入端口)
# ---------------------------------------------------------------------------

class WorkOrderRepository:
    """工单仓储接口.

    定义工单数据访问的抽象方法，具体实现由基础设施层提供.
    """

    def get_by_id(self, order_id: str) -> Optional[dict[str, Any]]:
        """根据 ID 获取工单.

        Args:
            order_id: 工单 ID.

        Returns:
            工单字典，包含 id, status, version 等字段；不存在时返回 None.
        """
        raise NotImplementedError

    def update_status(
        self,
        order_id: str,
        new_status: OrderStatus,
        expected_version: int,
    ) -> dict[str, Any]:
        """乐观锁更新工单状态.

        Args:
            order_id: 工单 ID.
            new_status: 目标状态.
            expected_version: 期望的当前版本号（乐观锁）.

        Returns:
            更新后的工单字典.

        Raises:
            ConflictError: 版本不匹配时抛出，表示并发冲突.
        """
        raise NotImplementedError


class ApprovalRecordRepository:
    """审批记录仓储接口.

    定义审批记录数据访问的抽象方法.
    """

    def save(self, record: ApprovalRecordDTO) -> dict[str, Any]:
        """持久化审批记录.

        Args:
            record: 审批记录 DTO.

        Returns:
            持久化后的审批记录字典.
        """
        raise NotImplementedError

    def list_by_order_id(self, order_id: str) -> list[dict[str, Any]]:
        """查询工单的全部审批记录.

        Args:
            order_id: 工单 ID.

        Returns:
            审批记录字典列表，按创建时间升序排列.
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Approval Service
# ---------------------------------------------------------------------------

class ApprovalService:
    """审批服务 — 核心业务编排.

    职责:
    1. 校验状态机合法性，拒绝非法流转.
    2. 校验操作人角色与当前审批层级的匹配.
    3. 校验驳回原因的必填约束.
    4. 通过乐观锁更新工单状态.
    5. 持久化审批记录.
    6. 返回结构化审批结果.

    Args:
        work_order_repo: 工单仓储实例.
        approval_record_repo: 审批记录仓储实例.
    """

    def __init__(
        self,
        work_order_repo: WorkOrderRepository,
        approval_record_repo: ApprovalRecordRepository,
    ) -> None:
        """初始化审批服务.

        Args:
            work_order_repo: 工单仓储实例.
            approval_record_repo: 审批记录仓储实例.
        """
        self._work_order_repo = work_order_repo
        self._approval_record_repo = approval_record_repo

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def approve(
        self,
        order_id: str,
        operator_id: str,
        operator_name: str,
        operator_role: str,
        comment: Optional[str] = None,
    ) -> ApprovalResult:
        """执行审批通过操作.

        将工单从当前审批层级推进至下一层级或最终通过。
        状态机严格校验流转合法性，禁止跨级审批。

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID.
            operator_name: 操作人姓名.
            operator_role: 操作人角色 (DEPARTMENT_MANAGER / ASSET_MANAGER).
            comment: 审批意见（可选）.

        Returns:
            ApprovalResult 审批结果对象.

        Raises:
            BusinessError: 工单不存在.
            InvalidStateTransitionError: 非法状态流转 (HTTP 409).
            ConflictError: 乐观锁版本冲突 (HTTP 409).
        """
        logger.info(
            "Approve request: order_id=%s, operator=%s (%s)",
            order_id,
            operator_name,
            operator_role,
        )

        order = self._get_order_or_raise(order_id)
        current_status = OrderStatus(order["status"])

        # 校验角色与审批层级匹配
        self._validate_role_access(current_status, operator_role)

        # 状态机校验
        target_status = self._resolve_forward_transition(
            current_status, ApprovalAction.APPROVE
        )

        # 乐观锁更新
        updated_order = self._work_order_repo.update_status(
            order_id=order_id,
            new_status=target_status,
            expected_version=order["version"],
        )

        # 持久化审批记录
        approval_level = _STATUS_TO_APPROVAL_LEVEL.get(current_status)
        record = ApprovalRecordDTO(
            order_id=order_id,
            operator_id=operator_id,
            operator_name=operator_name,
            action=ApprovalAction.APPROVE,
            comment=comment,
            approval_level=approval_level,
        )
        self._approval_record_repo.save(record)

        logger.info(
            "Order %s approved: %s -> %s by %s",
            order_id,
            current_status.value,
            target_status.value,
            operator_name,
        )

        return ApprovalResult(
            order_id=order_id,
            previous_status=current_status,
            current_status=target_status,
            action=ApprovalAction.APPROVE,
            approval_record=record,
        )

    def reject(
        self,
        order_id: str,
        operator_id: str,
        operator_name: str,
        operator_role: str,
        rejection_reason: str,
    ) -> ApprovalResult:
        """执行审批驳回操作.

        将工单从当前审批层级回退至 REJECTED 状态。
        驳回原因为必填字段，缺失时抛出 RejectionReasonRequiredError。

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID.
            operator_name: 操作人姓名.
            operator_role: 操作人角色.
            rejection_reason: 驳回原因（非空，最大 500 字符）.

        Returns:
            ApprovalResult 审批结果对象.

        Raises:
            RejectionReasonRequiredError: 驳回原因为空或超长 (HTTP 400).
            BusinessError: 工单不存在.
            InvalidStateTransitionError: 非法状态流转 (HTTP 409).
            ConflictError: 乐观锁版本冲突 (HTTP 409).
        """
        logger.info(
            "Reject request: order_id=%s, operator=%s (%s)",
            order_id,
            operator_name,
            operator_role,
        )

        # 校验驳回原因
        self._validate_rejection_reason(rejection_reason)

        order = self._get_order_or_raise(order_id)
        current_status = OrderStatus(order["status"])

        # 校验角色与审批层级匹配
        self._validate_role_access(current_status, operator_role)

        # 状态机校验
        target_status = self._resolve_reject_transition(current_status)

        # 乐观锁更新
        updated_order = self._work_order_repo.update_status(
            order_id=order_id,
            new_status=target_status,
            expected_version=order["version"],
        )

        # 持久化审批记录
        approval_level = _STATUS_TO_APPROVAL_LEVEL.get(current_status)
        record = ApprovalRecordDTO(
            order_id=order_id,
            operator_id=operator_id,
            operator_name=operator_name,
            action=ApprovalAction.REJECT,
            comment=rejection_reason,
            approval_level=approval_level,
        )
        self._approval_record_repo.save(record)

        logger.info(
            "Order %s rejected: %s -> %s by %s, reason=%s",
            order_id,
            current_status.value,
            target_status.value,
            operator_name,
            rejection_reason,
        )

        return ApprovalResult(
            order_id=order_id,
            previous_status=current_status,
            current_status=target_status,
            action=ApprovalAction.REJECT,
            approval_record=record,
        )

    def cancel(
        self,
        order_id: str,
        operator_id: str,
        operator_name: str,
        reason: Optional[str] = None,
    ) -> ApprovalResult:
        """执行工单取消操作.

        将工单从当前非终态流转至 CANCELLED 状态。

        Args:
            order_id: 工单 ID.
            operator_id: 操作人 ID.
            operator_name: 操作人姓名.
            reason: 取消原因（可选）.

        Returns:
            ApprovalResult 审批结果对象.

        Raises:
            BusinessError: 工单不存在.
            InvalidStateTransitionError: 工单已处于终态 (HTTP 409).
            ConflictError: 乐观锁版本冲突 (HTTP 409).
        """
        logger.info(
            "Cancel request: order_id=%s, operator=%s",
            order_id,
            operator_name,
        )

        order = self._get_order_or_raise(order_id)
        current_status = OrderStatus(order["status"])

        # 状态机校验
        target_status = self._resolve_cancel_transition(current_status)

        # 乐观锁更新
        self._work_order_repo.update_status(
            order_id=order_id,
            new_status=target_status,
            expected_version=order["version"],
        )

        # 持久化审批记录
        record = ApprovalRecordDTO(
            order_id=order_id,
            operator_id=operator_id,
            operator_name=operator_name,
            action=ApprovalAction.CANCEL,
            comment=reason,
            approval_level=None,
        )
        self._approval_record_repo.save(record)

        logger.info(
            "Order %s cancelled: %s -> %s by %s",
            order_id,
            current_status.value,
            target_status.value,
            operator_name,
        )

        return ApprovalResult(
            order_id=order_id,
            previous_status=current_status,
            current_status=target_status,
            action=ApprovalAction.CANCEL,
            approval_record=record,
        )

    def get_pending_orders(
        self,
        operator_role: str,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """获取当前角色待审批工单列表.

        根据操作人角色过滤可见工单:
        - DEPARTMENT_MANAGER: 仅可见 APPROVING_LEVEL_1 工单
        - ASSET_MANAGER: 仅可见 APPROVING_LEVEL_2 工单

        Args:
            operator_role: 操作人角色.
            page: 页码（从 1 开始）.
            page_size: 每页数量.

        Returns:
            包含 items, total, page, page_size 的分页结果字典.

        Raises:
            BusinessError: 角色无对应审批权限.
        """
        visible_statuses = _ROLE_VISIBLE_STATUSES.get(operator_role)
        if visible_statuses is None:
            raise BusinessError(
                f"角色 '{operator_role}' 无审批权限，无法查看待审批工单列表"
            )

        status_values = [s.value for s in visible_statuses]
        logger.info(
            "Query pending orders: role=%s, statuses=%s, page=%d, size=%d",
            operator_role,
            status_values,
            page,
            page_size,
        )

        # 实际查询由仓储层实现，此处返回结构化结果
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "filter_statuses": status_values,
        }

    def get_approval_history(self, order_id: str) -> list[dict[str, Any]]:
        """获取工单的完整审批记录.

        Args:
            order_id: 工单 ID.

        Returns:
            审批记录字典列表，按时间升序排列.
        """
        logger.info("Query approval history: order_id=%s", order_id)
        return self._approval_record_repo.list_by_order_id(order_id)

    # ------------------------------------------------------------------
    # Internal: State Machine Resolution
    # ------------------------------------------------------------------

    def _resolve_forward_transition(
        self,
        current_status: OrderStatus,
        action: ApprovalAction,
    ) -> OrderStatus:
        """解析正向审批流转目标状态.

        Args:
            current_status: 当前状态.
            action: 审批动作.

        Returns:
            目标状态.

        Raises:
            InvalidStateTransitionError: 非法流转时抛出.
        """
        key = (current_status, action)
        target = _FORWARD_TRANSITIONS.get(key)
        if target is None:
            raise InvalidStateTransitionError(
                current_status=current_status.value,
                target_status=None,
                action=action.value,
                message=(
                    f"非法状态流转: 从 '{current_status.value}' "
                    f"执行 '{action.value}' 操作不被允许。"
                    f"错误码: INVALID_STATE_TRANSITION"
                ),
            )
        return target

    def _resolve_reject_transition(
        self,
        current_status: OrderStatus,
    ) -> OrderStatus:
        """解析驳回流转目标状态.

        Args:
            current_status: 当前状态.

        Returns:
            REJECTED 状态.

        Raises:
            InvalidStateTransitionError: 当前状态不可驳回时抛出.
        """
        target = _REJECT_TRANSITIONS.get(current_status)
        if target is None:
            raise InvalidStateTransitionError(
                current_status=current_status.value,
                target_status=OrderStatus.REJECTED.value,
                action=ApprovalAction.REJECT.value,
                message=(
                    f"非法状态流转: 从 '{current_status.value}' "
                    f"执行驳回操作不被允许。"
                    f"错误码: INVALID_STATE_TRANSITION"
                ),
            )
        return target

    def _resolve_cancel_transition(
        self,
        current_status: OrderStatus,
    ) -> OrderStatus:
        """解析取消流转目标状态.

        Args:
            current_status: 当前状态.

        Returns:
            CANCELLED 状态.

        Raises:
            InvalidStateTransitionError: 当前状态不可取消时抛出.
        """
        target = _CANCEL_TRANSITIONS.get(current_status)
        if target is None:
            raise InvalidStateTransitionError(
                current_status=current_status.value,
                target_status=OrderStatus.CANCELLED.value,
                action=ApprovalAction.CANCEL.value,
                message=(
                    f"非法状态流转: 工单当前处于 '{current_status.value}' 状态，"
                    f"无法取消。终态工单不可变更。"
                    f"错误码: INVALID_STATE_TRANSITION"
                ),
            )
        return target

    # ------------------------------------------------------------------
    # Internal: Validation Helpers
    # ------------------------------------------------------------------

    def _validate_rejection_reason(self, reason: Optional[str]) -> None:
        """校验驳回原因的必填与长度约束.

        Args:
            reason: 驳回原因字符串.

        Raises:
            RejectionReasonRequiredError: 原因为空或超长时抛出 (HTTP 400).
        """
        if not reason or not reason.strip():
            raise RejectionReasonRequiredError(
                "驳回原因为必填字段，请提供不超过 500 字符的驳回原因。"
            )
        if len(reason.strip()) > 500:
            raise RejectionReasonRequiredError(
                f"驳回原因长度超限: 当前 {len(reason.strip())} 字符，最大允许 500 字符。"
            )

    def _validate_role_access(
        self,
        current_status: OrderStatus,
        operator_role: str,
    ) -> None:
        """校验操作人角色是否匹配当前审批层级.

        数据隔离规则:
        - DEPARTMENT_MANAGER 仅可操作 APPROVING_LEVEL_1 状态的工单
        - ASSET_MANAGER 仅可操作 APPROVING_LEVEL_2 状态的工单

        Args:
            current_status: 工单当前状态.
            operator_role: 操作人角色.

        Raises:
            InvalidStateTransitionError: 角色不匹配时抛出.
        """
        visible_statuses = _ROLE_VISIBLE_STATUSES.get(operator_role)
        if visible_statuses is None:
            raise InvalidStateTransitionError(
                current_status=current_status.value,
                target_status=None,
                action="APPROVE/REJECT",
                message=(
                    f"角色 '{operator_role}' 无审批权限。"
                    f"错误码: INVALID_STATE_TRANSITION"
                ),
            )
        if current_status not in visible_statuses:
            raise InvalidStateTransitionError(
                current_status=current_status.value,
                target_status=None,
                action="APPROVE/REJECT",
                message=(
                    f"角色 '{operator_role}' 无权操作状态为 "
                    f"'{current_status.value}' 的工单。"
                    f"错误码: INVALID_STATE_TRANSITION"
                ),
            )

    def _get_order_or_raise(self, order_id: str) -> dict[str, Any]:
        """获取工单，不存在时抛出 BusinessError.

        Args:
            order_id: 工单 ID.

        Returns:
            工单字典.

        Raises:
            BusinessError: 工单不存在时抛出.
        """
        order = self._work_order_repo.get_by_id(order_id)
        if order is None:
            raise BusinessError(f"工单不存在: order_id={order_id}")
        return order