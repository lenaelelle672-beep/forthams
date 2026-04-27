"""
工单审批状态机模块

实现 SWARM-2025-Q2-P0-003 工单审批流程规格指导中的状态流转逻辑。

状态流转规则:
    PENDING → APPROVED/REJECTED → CLOSED

特性:
    - 审批状态机建模
    - 基于乐观锁的并发控制
    - 事务回滚保障
    - 完整的审计日志
"""

from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass, field
from functools import wraps
import threading

logger = logging.getLogger(__name__)


class WorkOrderStatus(str, Enum):
    """
    工单状态枚举
    
    定义工单的完整生命周期状态。
    """
    PENDING = "PENDING"           # 待审批
    APPROVED = "APPROVED"         # 已批准
    REJECTED = "REJECTED"         # 已拒绝
    CLOSED = "CLOSED"             # 已关闭


class WorkOrderEvent(str, Enum):
    """
    工单事件枚举
    
    定义状态机支持的所有事件/操作。
    """
    SUBMIT = "SUBMIT"             # 提交工单
    APPROVE = "APPROVE"           # 批准
    REJECT = "REJECT"             # 拒绝
    CLOSE = "CLOSE"               # 关闭
    REVERT = "REVERT"             # 回退（不允许）


class StateTransitionError(Exception):
    """状态转换异常"""
    pass


class InvalidTransitionError(StateTransitionError):
    """无效的状态转换"""
    pass


class ConcurrencyConflictError(StateTransitionError):
    """并发冲突异常（乐观锁冲突）"""
    pass


class PermissionDeniedError(StateTransitionError):
    """权限不足异常"""
    pass


# 状态转换规则定义
# 定义了从每个状态可以接受的事件及其目标状态
TRANSITIONS: Dict[WorkOrderStatus, Dict[WorkOrderEvent, WorkOrderStatus]] = {
    WorkOrderStatus.PENDING: {
        WorkOrderEvent.APPROVE: WorkOrderStatus.APPROVED,
        WorkOrderEvent.REJECT: WorkOrderStatus.REJECTED,
    },
    WorkOrderStatus.APPROVED: {
        WorkOrderEvent.CLOSE: WorkOrderStatus.CLOSED,
    },
    WorkOrderStatus.REJECTED: {
        # REJECTED 状态不可回退，不可转换到其他状态
    },
    WorkOrderStatus.CLOSED: {
        # CLOSED 状态不可回退，不可转换到其他状态
    },
}


@dataclass
class StateTransitionLog:
    """
    状态转换日志
    
    用于记录完整的状态流转轨迹。
    """
    work_order_id: str
    from_state: WorkOrderStatus
    to_state: WorkOrderStatus
    event: WorkOrderEvent
    operator_id: str
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "work_order_id": self.work_order_id,
            "from_state": self.from_state.value,
            "to_state": self.to_state.value,
            "event": self.event.value,
            "operator_id": self.operator_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class WorkOrder:
    """
    工单数据模型
    
    包含状态机管理所需的所有字段。
    """
    id: str
    status: WorkOrderStatus
    version: int
    created_by: str
    title: str = ""
    description: str = ""
    audit_trail: List[Dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    approval_deadline: Optional[datetime] = None
    approver_id: Optional[str] = None
    
    def __post_init__(self):
        """类型规范化"""
        if isinstance(self.status, str):
            self.status = WorkOrderStatus(self.status)
        if isinstance(self.created_at, datetime) and self.created_at.tzinfo is not None:
            # 移除时区信息以保持一致性
            self.created_at = self.created_at.replace(tzinfo=None)
        if isinstance(self.updated_at, datetime) and self.updated_at.tzinfo is not None:
            self.updated_at = self.updated_at.replace(tzinfo=None)


class StateMachineValidator:
    """
    状态机验证器
    
    验证状态转换的有效性。
    """
    
    @staticmethod
    def can_transition(from_state: WorkOrderStatus, event: WorkOrderEvent) -> bool:
        """
        检查是否可以进行状态转换
        
        Args:
            from_state: 源状态
            event: 事件
            
        Returns:
            bool: 是否可以转换
        """
        if from_state not in TRANSITIONS:
            return False
        return event in TRANSITIONS[from_state]
    
    @staticmethod
    def get_next_state(from_state: WorkOrderStatus, event: WorkOrderEvent) -> Optional[WorkOrderStatus]:
        """
        获取目标状态
        
        Args:
            from_state: 源状态
            event: 事件
            
        Returns:
            Optional[WorkOrderStatus]: 目标状态，无效则返回 None
        """
        if from_state not in TRANSITIONS:
            return None
        transitions = TRANSITIONS[from_state]
        return transitions.get(event)
    
    @staticmethod
    def validate_transition(from_state: WorkOrderStatus, event: WorkOrderEvent) -> None:
        """
        验证状态转换，无效则抛出异常
        
        Args:
            from_state: 源状态
            event: 事件
            
        Raises:
            InvalidTransitionError: 状态转换无效
        """
        if not StateMachineValidator.can_transition(from_state, event):
            raise InvalidTransitionError(
                f"Invalid transition: {from_state.value} + {event.value}"
            )


class RetirementStateMachine:
    """
    工单审批状态机
    
    实现工单审批流程的状态流转逻辑，支持原子性事务保障。
    
    特性:
        - 状态不可逆性保障
        - 乐观锁并发控制
        - 事务回滚机制
        - 完整审计日志
    """
    
    def __init__(
        self,
        on_transition: Optional[Callable[[StateTransitionLog], None]] = None,
        on_notification: Optional[Callable[[Dict[str, Any]], None]] = None,
        timeout_seconds: float = 30.0
    ):
        """
        初始化状态机
        
        Args:
            on_transition: 状态转换回调函数
            on_notification: 通知触发回调函数
            timeout_seconds: 操作超时时间（秒）
        """
        self._on_transition = on_transition
        self._on_notification = on_notification
        self._timeout_seconds = timeout_seconds
        self._lock = threading.RLock()
        self._pending_transactions: Dict[str, WorkOrder] = {}
    
    def validate_transition(
        self,
        work_order: WorkOrder,
        event: WorkOrderEvent
    ) -> None:
        """
        验证工单是否可以执行指定事件
        
        Args:
            work_order: 工单对象
            event: 事件
            
        Raises:
            InvalidTransitionError: 状态转换无效
        """
        StateMachineValidator.validate_transition(work_order.status, event)
    
    def execute_transition(
        self,
        work_order: WorkOrder,
        event: WorkOrderEvent,
        operator_id: str,
        expected_version: Optional[int] = None,
        comment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> WorkOrder:
        """
        执行状态转换
        
        Args:
            work_order: 工单对象
            event: 事件
            operator_id: 操作人ID
            expected_version: 期望版本号（用于乐观锁检查）
            comment: 审批意见
            metadata: 额外元数据
            
        Returns:
            WorkOrder: 更新后的工单对象
            
        Raises:
            InvalidTransitionError: 状态转换无效
            ConcurrencyConflictError: 并发冲突
            TimeoutError: 操作超时
        """
        start_time = datetime.now()
        
        # 超时检查
        def check_timeout():
            elapsed = (datetime.now() - start_time).total_seconds()
            if elapsed > self._timeout_seconds:
                raise TimeoutError(f"Operation timeout after {elapsed:.2f}s")
        
        with self._lock:
            check_timeout()
            
            # 乐观锁版本检查
            if expected_version is not None and work_order.version != expected_version:
                raise ConcurrencyConflictError(
                    f"Version conflict: expected {expected_version}, got {work_order.version}"
                )
            
            # 验证转换
            self.validate_transition(work_order, event)
            
            check_timeout()
            
            # 保存当前状态用于回滚
            previous_state = work_order.status
            previous_version = work_order.version
            
            try:
                # 执行转换
                next_state = StateMachineValidator.get_next_state(
                    work_order.status, event
                )
                
                if next_state is None:
                    raise InvalidTransitionError(
                        f"Cannot transition from {work_order.status.value} via {event.value}"
                    )
                
                # 更新工单状态
                work_order.status = next_state
                work_order.version += 1
                work_order.updated_at = datetime.now()
                
                check_timeout()
                
                # 记录审计日志
                transition_log = StateTransitionLog(
                    work_order_id=work_order.id,
                    from_state=previous_state,
                    to_state=next_state,
                    event=event,
                    operator_id=operator_id,
                    timestamp=datetime.now(),
                    metadata=metadata or {}
                )
                
                if comment:
                    transition_log.metadata["comment"] = comment
                
                work_order.audit_trail.append(transition_log.to_dict())
                
                # 触发转换回调
                if self._on_transition:
                    self._on_transition(transition_log)
                
                check_timeout()
                
                # 触发通知（非阻塞）
                self._trigger_notification_async(work_order, event, operator_id)
                
                logger.info(
                    f"State transition: work_order={work_order.id}, "
                    f"{previous_state.value} → {next_state.value}, "
                    f"operator={operator_id}"
                )
                
                return work_order
                
            except Exception as e:
                # 回滚状态
                work_order.status = previous_state
                work_order.version = previous_version
                logger.error(
                    f"State transition failed and rolled back: "
                    f"work_order={work_order.id}, error={str(e)}"
                )
                raise
    
    def _trigger_notification_async(
        self,
        work_order: WorkOrder,
        event: WorkOrderEvent,
        operator_id: str
    ) -> None:
        """
        异步触发通知（不阻塞审批响应）
        
        Args:
            work_order: 工单对象
            event: 事件
            operator_id: 操作人ID
        """
        if self._on_notification:
            try:
                notification_payload = {
                    "work_order_id": work_order.id,
                    "work_order_title": work_order.title,
                    "new_status": work_order.status.value,
                    "action": event.value,
                    "action_by": operator_id,
                    "timestamp": datetime.now().isoformat(),
                }
                self._on_notification(notification_payload)
            except Exception as e:
                # 通知失败不阻塞主流程
                logger.warning(
                    f"Notification failed for work_order={work_order.id}: {str(e)}"
                )
    
    def approve(
        self,
        work_order: WorkOrder,
        operator_id: str,
        version: Optional[int] = None,
        comment: Optional[str] = None
    ) -> WorkOrder:
        """
        批准工单
        
        Args:
            work_order: 工单对象
            operator_id: 审批人ID
            version: 期望版本号（乐观锁）
            comment: 审批意见
            
        Returns:
            WorkOrder: 更新后的工单对象
        """
        return self.execute_transition(
            work_order=work_order,
            event=WorkOrderEvent.APPROVE,
            operator_id=operator_id,
            expected_version=version,
            comment=comment,
            metadata={"action_type": "approval"}
        )
    
    def reject(
        self,
        work_order: WorkOrder,
        operator_id: str,
        version: Optional[int] = None,
        comment: Optional[str] = None
    ) -> WorkOrder:
        """
        拒绝工单
        
        Args:
            work_order: 工单对象
            operator_id: 审批人ID
            version: 期望版本号（乐观锁）
            comment: 拒绝理由
            
        Returns:
            WorkOrder: 更新后的工单对象
        """
        return self.execute_transition(
            work_order=work_order,
            event=WorkOrderEvent.REJECT,
            operator_id=operator_id,
            expected_version=version,
            comment=comment,
            metadata={"action_type": "rejection"}
        )
    
    def close(
        self,
        work_order: WorkOrder,
        operator_id: str,
        version: Optional[int] = None
    ) -> WorkOrder:
        """
        关闭工单
        
        Args:
            work_order: 工单对象
            operator_id: 操作人ID
            version: 期望版本号（乐观锁）
            
        Returns:
            WorkOrder: 更新后的工单对象
        """
        return self.execute_transition(
            work_order=work_order,
            event=WorkOrderEvent.CLOSE,
            operator_id=operator_id,
            expected_version=version,
            metadata={"action_type": "close"}
        )
    
    def can_approve(self, work_order: WorkOrder, user_id: str) -> bool:
        """
        检查用户是否有审批权限
        
        Args:
            work_order: 工单对象
            user_id: 用户ID
            
        Returns:
            bool: 是否有权限
        """
        # 简化实现：检查用户是否与工单创建者不同
        # 实际应关联权限系统进行校验
        return work_order.created_by != user_id
    
    def get_available_transitions(self, status: WorkOrderStatus) -> List[WorkOrderEvent]:
        """
        获取指定状态可用的所有转换事件
        
        Args:
            status: 状态
            
        Returns:
            List[WorkOrderEvent]: 可用事件列表
        """
        if status not in TRANSITIONS:
            return []
        return list(TRANSITIONS[status].keys())


# 导出公共接口
__all__ = [
    "WorkOrderStatus",
    "WorkOrderEvent",
    "WorkOrder",
    "RetirementStateMachine",
    "StateTransitionLog",
    "StateTransitionError",
    "InvalidTransitionError",
    "ConcurrencyConflictError",
    "PermissionDeniedError",
    "StateMachineValidator",
]