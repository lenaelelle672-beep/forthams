"""
backend/state_machine/machine.py

WorkOrder 审批流程状态机执行器 (SWARM-501)。

状态定义
--------
DRAFT    → 工单初始草稿态（创建后默认状态）
PENDING  → 已提交审批、等待审批人处理
APPROVED → 审批通过（终态）
REJECTED → 审批驳回（终态）

合法状态转换
-----------
DRAFT    --[submit]-->  PENDING
PENDING  --[approve]--> APPROVED
PENDING  --[reject]-->  REJECTED

任何不在上述映射内的转换均被视为非法，抛出 InvalidStateTransitionError。
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, FrozenSet, Tuple


# ---------------------------------------------------------------------------
# 状态枚举
# ---------------------------------------------------------------------------

class WorkOrderStatus(str, Enum):
    """工单生命周期状态枚举。

    继承 str 使枚举值可直接与字符串比较/序列化，方便 ORM 及 JSON 互转。
    """

    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ---------------------------------------------------------------------------
# 异常
# ---------------------------------------------------------------------------

class InvalidStateTransitionError(Exception):
    """尝试执行非法状态转换时抛出。

    Attributes:
        current: 发起转换时工单的当前状态。
        action:  被拒绝的操作名称。
    """

    def __init__(self, current: WorkOrderStatus, action: str) -> None:
        self.current = current
        self.action = action
        super().__init__(
            f"invalid transition: cannot perform '{action}' "
            f"on workorder in state '{current.value}'"
        )


# ---------------------------------------------------------------------------
# 转换规则表
# ---------------------------------------------------------------------------

# 格式: action -> (合法来源状态集合, 目标状态)
_TransitionRule = Tuple[FrozenSet[WorkOrderStatus], WorkOrderStatus]

TRANSITIONS: Dict[str, _TransitionRule] = {
    "submit": (
        frozenset({WorkOrderStatus.DRAFT}),
        WorkOrderStatus.PENDING,
    ),
    "approve": (
        frozenset({WorkOrderStatus.PENDING}),
        WorkOrderStatus.APPROVED,
    ),
    "reject": (
        frozenset({WorkOrderStatus.PENDING}),
        WorkOrderStatus.REJECTED,
    ),
}


# ---------------------------------------------------------------------------
# 状态机执行器
# ---------------------------------------------------------------------------

class WorkOrderStateMachine:
    """无状态的工单状态机执行器。

    本类本身不持有任何工单状态；调用方负责传入 *当前状态* 并保存
    返回的 *新状态*。这种设计便于单元测试，也避免了并发副作用。

    典型用法::

        machine = WorkOrderStateMachine()

        # 提交审批
        new_status = machine.transition(WorkOrderStatus.DRAFT, "submit")
        # => WorkOrderStatus.PENDING

        # 审批通过
        new_status = machine.transition(WorkOrderStatus.PENDING, "approve")
        # => WorkOrderStatus.APPROVED

        # 尝试对已驳回工单再次审批 → 抛出 InvalidStateTransitionError
        machine.transition(WorkOrderStatus.REJECTED, "approve")
    """

    def transition(
        self,
        current: WorkOrderStatus,
        action: str,
    ) -> WorkOrderStatus:
        """执行状态转换，返回转换后的新状态。

        Args:
            current: 工单当前状态。
            action:  操作名称，取值范围：``"submit"``、``"approve"``、``"reject"``。

        Returns:
            转换成功后的 :class:`WorkOrderStatus`。

        Raises:
            ValueError: ``action`` 不在已知操作列表中。
            InvalidStateTransitionError: 当前状态不允许执行该操作。
        """
        if action not in TRANSITIONS:
            raise ValueError(
                f"Unknown action '{action}'. "
                f"Valid actions: {sorted(TRANSITIONS.keys())}"
            )

        valid_from, target = TRANSITIONS[action]
        if current not in valid_from:
            raise InvalidStateTransitionError(current, action)

        return target

    def can_transition(self, current: WorkOrderStatus, action: str) -> bool:
        """非抛出式检查：判断指定操作在当前状态下是否合法。

        Args:
            current: 工单当前状态。
            action:  待检查的操作名称。

        Returns:
            合法返回 ``True``，否则返回 ``False``。
        """
        if action not in TRANSITIONS:
            return False
        valid_from, _ = TRANSITIONS[action]
        return current in valid_from

    def available_actions(self, current: WorkOrderStatus) -> FrozenSet[str]:
        """返回当前状态下所有合法操作的集合。

        Args:
            current: 工单当前状态。

        Returns:
            合法操作名称的不可变集合；若处于终态则返回空集合。
        """
        return frozenset(
            action
            for action, (valid_from, _) in TRANSITIONS.items()
            if current in valid_from
        )