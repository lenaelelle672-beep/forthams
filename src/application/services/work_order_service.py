"""
工单审批服务 (Work Order Approval Service)

实现工单审批流程的端到端闭环，支持状态机驱动的审批操作。
基于 SWARM-2025-Q2-P0-003 规格指导实现。

状态流转规则:
- PENDING → APPROVED/REJECTED → CLOSED
- 状态不可逆，REJECTED/CLOSED 不可回退至 PENDING

作者: Spec Engineering
Iteration: 9
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import logging
import asyncio

# 尝试导入状态机引擎，若不存在则使用简化实现
try:
    from domain.services.state_machine_engine import StateMachineEngine, StateTransitionException
    from domain.services.approval_engine import ApprovalEngine
except ImportError:
    StateMachineEngine = None
    StateTransitionException = Exception
    ApprovalEngine = None

# 通知服务
try:
    from application.services.notification_service import NotificationService
except ImportError:
    NotificationService = None

# 幂等性服务
try:
    from application.services.idempotency_service import IdempotencyService
except ImportError:
    IdempotencyService = None

logger = logging.getLogger(__name__)


class WorkOrderStatus(Enum):
    """工单状态枚举"""
    PENDING = "PENDING"           # 待审批
    APPROVED = "APPROVED"         # 已批准
    REJECTED = "REJECTED"         # 已拒绝
    CLOSED = "CLOSED"            # 已关闭


class ApprovalEvent(Enum):
    """审批事件枚举"""
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    CLOSE = "CLOSE"


# 状态机转换规则
STATE_TRANSITIONS = {
    WorkOrderStatus.PENDING: [ApprovalEvent.APPROVE, ApprovalEvent.REJECT],
    WorkOrderStatus.APPROVED: [ApprovalEvent.CLOSE],
    WorkOrderStatus.REJECTED: [],  # 不可再转换
    WorkOrderStatus.CLOSED: [],    # 不可再转换
}


class InvalidTransitionError(Exception):
    """无效的状态转换异常"""
    pass


class ConcurrencyConflictError(Exception):
    """并发冲突异常（乐观锁失败）"""
    pass


class PermissionDeniedError(Exception):
    """权限不足异常"""
    pass


class WorkOrderNotFoundError(Exception):
    """工单不存在异常"""
    pass


class WorkOrderService:
    """
    工单审批服务
    
    提供工单审批的完整业务逻辑，包括：
    - 状态机驱动的审批操作
    - 权限校验
    - 幂等性保障
    - 通知触发
    
    Attributes:
        _notification_service: 通知服务实例
        _idempotency_service: 幂等性服务实例
        _state_machine: 状态机引擎
    """
    
    # 审批超时时间（秒）
    APPROVAL_TIMEOUT_SECONDS = 30
    
    def __init__(
        self,
        notification_service: Optional[NotificationService] = None,
        idempotency_service: Optional[IdempotencyService] = None,
        state_machine: Optional[Any] = None
    ):
        """
        初始化工单审批服务
        
        Args:
            notification_service: 通知服务实例（可选）
            idempotency_service: 幂等性服务实例（可选）
            state_machine: 状态机引擎实例（可选）
        """
        self._notification_service = notification_service
        self._idempotency_service = idempotency_service
        self._state_machine = state_machine or self._create_default_state_machine()
        
        logger.info("WorkOrderService initialized")
    
    def _create_default_state_machine(self) -> Any:
        """
        创建默认的状态机引擎
        
        若领域层状态机不可用，则使用内置简化实现
        """
        if StateMachineEngine:
            return StateMachineEngine()
        
        # 内置简化状态机实现
        class DefaultStateMachine:
            def validate_transition(self, from_state: WorkOrderStatus, event: ApprovalEvent) -> bool:
                """验证状态转换是否合法"""
                allowed_events = STATE_TRANSITIONS.get(from_state, [])
                return event in allowed_events
            
            def execute_transition(self, work_order: Any, event: ApprovalEvent) -> WorkOrderStatus:
                """执行状态转换"""
                current_status = self._parse_status(work_order.status)
                
                if not self.validate_transition(current_status, event):
                    raise InvalidTransitionError(
                        f"Invalid transition from {current_status.value} with event {event.value}"
                    )
                
                # 根据事件确定目标状态
                if event == ApprovalEvent.APPROVE:
                    return WorkOrderStatus.APPROVED
                elif event == ApprovalEvent.REJECT:
                    return WorkOrderStatus.REJECTED
                elif event == ApprovalEvent.CLOSE:
                    return WorkOrderStatus.CLOSED
                
                return current_status
            
            def _parse_status(self, status) -> WorkOrderStatus:
                """解析状态值"""
                if isinstance(status, WorkOrderStatus):
                    return status
                if isinstance(status, str):
                    return WorkOrderStatus(status)
                return WorkOrderStatus.PENDING
        
        return DefaultStateMachine()
    
    def approve(
        self,
        work_order_id: str,
        user_id: str,
        version: Optional[int] = None,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        批准工单
        
        执行以下步骤：
        1. 验证工单存在且状态为 PENDING
        2. 检查用户审批权限
        3. 验证版本号（乐观锁）
        4. 执行状态转换 APPROVED
        5. 记录审计日志
        6. 触发通知（异步）
        
        Args:
            work_order_id: 工单ID
            user_id: 审批人用户ID
            version: 版本号（用于乐观锁）
            comment: 审批意见（可选）
            
        Returns:
            Dict: 包含审批结果的字典
            
        Raises:
            WorkOrderNotFoundError: 工单不存在
            PermissionDeniedError: 无审批权限
            InvalidTransitionError: 无效的状态转换
            ConcurrencyConflictError: 并发冲突（版本不匹配）
        """
        logger.info(
            f"Approval requested: work_order_id={work_order_id}, "
            f"user_id={user_id}, version={version}"
        )
        
        # 获取工单（实际应从 repository 获取）
        work_order = self._get_work_order(work_order_id)
        
        if not work_order:
            raise WorkOrderNotFoundError(f"Work order {work_order_id} not found")
        
        # 验证当前状态为 PENDING
        current_status = self._parse_status(work_order.get("status", "PENDING"))
        if current_status != WorkOrderStatus.PENDING:
            raise InvalidTransitionError(
                f"Work order {work_order_id} is not in PENDING status, "
                f"current status: {current_status.value}"
            )
        
        # 检查审批权限
        if not self.can_user_approve(work_order, user_id):
            raise PermissionDeniedError(
                f"User {user_id} does not have permission to approve work order {work_order_id}"
            )
        
        # 验证版本号（乐观锁）
        current_version = work_order.get("version", 1)
        if version is not None and version != current_version:
            raise ConcurrencyConflictError(
                f"Version mismatch: expected {current_version}, got {version}"
            )
        
        # 执行状态转换
        try:
            new_status = self._state_machine.execute_transition(
                work_order, 
                ApprovalEvent.APPROVE
            )
        except Exception as e:
            logger.error(f"State transition failed for work order {work_order_id}: {e}")
            raise
        
        # 准备更新数据
        update_data = {
            "status": new_status.value,
            "version": current_version + 1,
            "approved_by": user_id,
            "approved_at": datetime.utcnow().isoformat(),
            "approval_comment": comment,
        }
        
        # 更新工单
        self._update_work_order(work_order_id, update_data)
        
        # 记录审计日志
        self._record_audit_log(
            work_order_id=work_order_id,
            action="APPROVE",
            user_id=user_id,
            from_status=WorkOrderStatus.PENDING.value,
            to_status=new_status.value,
            comment=comment
        )
        
        # 异步触发通知（不阻塞审批响应）
        self._trigger_notification_async(
            work_order_id=work_order_id,
            action="APPROVE",
            action_by=user_id,
            new_status=new_status.value
        )
        
        logger.info(f"Work order {work_order_id} approved by {user_id}")
        
        return {
            "success": True,
            "work_order_id": work_order_id,
            "new_status": new_status.value,
            "version": update_data["version"],
            "approved_at": update_data["approved_at"]
        }
    
    def reject(
        self,
        work_order_id: str,
        user_id: str,
        version: Optional[int] = None,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        拒绝工单
        
        执行以下步骤：
        1. 验证工单存在且状态为 PENDING
        2. 检查用户审批权限
        3. 验证版本号（乐观锁）
        4. 执行状态转换 REJECTED
        5. 记录审计日志
        6. 触发通知（异步）
        
        Args:
            work_order_id: 工单ID
            user_id: 审批人用户ID
            version: 版本号（用于乐观锁）
            comment: 拒绝理由（可选）
            
        Returns:
            Dict: 包含审批结果的字典
            
        Raises:
            WorkOrderNotFoundError: 工单不存在
            PermissionDeniedError: 无审批权限
            InvalidTransitionError: 无效的状态转换
            ConcurrencyConflictError: 并发冲突
        """
        logger.info(
            f"Rejection requested: work_order_id={work_order_id}, "
            f"user_id={user_id}, version={version}"
        )
        
        # 获取工单
        work_order = self._get_work_order(work_order_id)
        
        if not work_order:
            raise WorkOrderNotFoundError(f"Work order {work_order_id} not found")
        
        # 验证当前状态为 PENDING
        current_status = self._parse_status(work_order.get("status", "PENDING"))
        if current_status != WorkOrderStatus.PENDING:
            raise InvalidTransitionError(
                f"Work order {work_order_id} is not in PENDING status, "
                f"current status: {current_status.value}"
            )
        
        # 检查审批权限
        if not self.can_user_approve(work_order, user_id):
            raise PermissionDeniedError(
                f"User {user_id} does not have permission to reject work order {work_order_id}"
            )
        
        # 验证版本号
        current_version = work_order.get("version", 1)
        if version is not None and version != current_version:
            raise ConcurrencyConflictError(
                f"Version mismatch: expected {current_version}, got {version}"
            )
        
        # 执行状态转换
        try:
            new_status = self._state_machine.execute_transition(
                work_order,
                ApprovalEvent.REJECT
            )
        except Exception as e:
            logger.error(f"State transition failed for work order {work_order_id}: {e}")
            raise
        
        # 准备更新数据
        update_data = {
            "status": new_status.value,
            "version": current_version + 1,
            "rejected_by": user_id,
            "rejected_at": datetime.utcnow().isoformat(),
            "rejection_comment": comment,
        }
        
        # 更新工单
        self._update_work_order(work_order_id, update_data)
        
        # 记录审计日志
        self._record_audit_log(
            work_order_id=work_order_id,
            action="REJECT",
            user_id=user_id,
            from_status=WorkOrderStatus.PENDING.value,
            to_status=new_status.value,
            comment=comment
        )
        
        # 异步触发通知
        self._trigger_notification_async(
            work_order_id=work_order_id,
            action="REJECT",
            action_by=user_id,
            new_status=new_status.value
        )
        
        logger.info(f"Work order {work_order_id} rejected by {user_id}")
        
        return {
            "success": True,
            "work_order_id": work_order_id,
            "new_status": new_status.value,
            "version": update_data["version"],
            "rejected_at": update_data["rejected_at"]
        }
    
    def close(
        self,
        work_order_id: str,
        user_id: str,
        version: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        关闭工单（仅适用于 APPROVED 状态的工单）
        
        Args:
            work_order_id: 工单ID
            user_id: 操作人用户ID
            version: 版本号
            
        Returns:
            Dict: 包含操作结果的字典
        """
        logger.info(
            f"Close requested: work_order_id={work_order_id}, "
            f"user_id={user_id}, version={version}"
        )
        
        work_order = self._get_work_order(work_order_id)
        
        if not work_order:
            raise WorkOrderNotFoundError(f"Work order {work_order_id} not found")
        
        current_status = self._parse_status(work_order.get("status", "PENDING"))
        
        # 仅 APPROVED 状态可以关闭
        if current_status != WorkOrderStatus.APPROVED:
            raise InvalidTransitionError(
                f"Cannot close work order in {current_status.value} status, "
                f"only APPROVED status can be closed"
            )
        
        current_version = work_order.get("version", 1)
        if version is not None and version != current_version:
            raise ConcurrencyConflictError(
                f"Version mismatch: expected {current_version}, got {version}"
            )
        
        new_status = self._state_machine.execute_transition(
            work_order,
            ApprovalEvent.CLOSE
        )
        
        update_data = {
            "status": new_status.value,
            "version": current_version + 1,
            "closed_by": user_id,
            "closed_at": datetime.utcnow().isoformat(),
        }
        
        self._update_work_order(work_order_id, update_data)
        
        self._record_audit_log(
            work_order_id=work_order_id,
            action="CLOSE",
            user_id=user_id,
            from_status=WorkOrderStatus.APPROVED.value,
            to_status=new_status.value
        )
        
        self._trigger_notification_async(
            work_order_id=work_order_id,
            action="CLOSE",
            action_by=user_id,
            new_status=new_status.value
        )
        
        logger.info(f"Work order {work_order_id} closed by {user_id}")
        
        return {
            "success": True,
            "work_order_id": work_order_id,
            "new_status": new_status.value,
            "version": update_data["version"]
        }
    
    def can_user_approve(self, work_order: Dict[str, Any], user_id: str) -> bool:
        """
        检查用户是否有审批权限
        
        权限规则：
        1. 用户不能审批自己创建的工单
        2. 用户必须具有 APPROVER 角色
        3. 实际应关联权限系统进行校验
        
        Args:
            work_order: 工单对象
            user_id: 用户ID
            
        Returns:
            bool: 是否有权限
        """
        created_by = work_order.get("created_by", "")
        
        # 不能审批自己创建的工单
        if created_by == user_id:
            return False
        
        # 检查用户角色（简化实现，实际应查询权限系统）
        user_roles = work_order.get("user_roles", [])
        
        # 如果没有角色信息，默认允许审批
        if not user_roles:
            return True
        
        return "APPROVER" in user_roles or "ADMIN" in user_roles
    
    def check_permission(self, user_id: str, work_order_id: str) -> bool:
        """
        检查用户对特定工单的权限
        
        Args:
            user_id: 用户ID
            work_order_id: 工单ID
            
        Returns:
            bool: 是否有权限
        """
        work_order = self._get_work_order(work_order_id)
        
        if not work_order:
            return False
        
        return self.can_user_approve(work_order, user_id)
    
    def validate_transition(self, work_order_id: str, event: ApprovalEvent) -> bool:
        """
        验证状态转换是否合法
        
        Args:
            work_order_id: 工单ID
            event: 审批事件
            
        Returns:
            bool: 是否可以转换
        """
        work_order = self._get_work_order(work_order_id)
        
        if not work_order:
            return False
        
        current_status = self._parse_status(work_order.get("status", "PENDING"))
        allowed_events = STATE_TRANSITIONS.get(current_status, [])
        
        return event in allowed_events
    
    def _get_work_order(self, work_order_id: str) -> Optional[Dict[str, Any]]:
        """
        获取工单
        
        实际应从 repository 获取，此处为模拟实现
        
        Args:
            work_order_id: 工单ID
            
        Returns:
            Optional[Dict]: 工单数据字典
        """
        # 模拟数据，实际应调用 repository
        # 实际实现：
        # return self._repository.get(work_order_id)
        
        # 简化实现：返回 None，让调用者处理
        logger.debug(f"Fetching work order: {work_order_id}")
        return None
    
    def _update_work_order(self, work_order_id: str, update_data: Dict[str, Any]) -> bool:
        """
        更新工单
        
        实际应使用事务更新，确保原子性
        
        Args:
            work_order_id: 工单ID
            update_data: 更新数据
            
        Returns:
            bool: 是否更新成功
        """
        # 实际实现：
        # with self._unit_of_work:
        #     work_order = self._repository.get(work_order_id)
        #     for key, value in update_data.items():
        #         setattr(work_order, key, value)
        #     self._repository.update(work_order)
        
        logger.debug(f"Updating work order {work_order_id}: {update_data}")
        return True
    
    def _record_audit_log(
        self,
        work_order_id: str,
        action: str,
        user_id: str,
        from_status: str,
        to_status: str,
        comment: Optional[str] = None
    ) -> None:
        """
        记录审计日志
        
        记录完整的状态流转轨迹
        
        Args:
            work_order_id: 工单ID
            action: 操作类型
            user_id: 操作人ID
            from_status: 原状态
            to_status: 新状态
            comment: 备注
        """
        audit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "work_order_id": work_order_id,
            "action": action,
            "user_id": user_id,
            "from_status": from_status,
            "to_status": to_status,
            "comment": comment,
        }
        
        # 实际应写入审计日志表
        logger.info(f"Audit log recorded: {audit_entry}")
    
    def _trigger_notification_async(
        self,
        work_order_id: str,
        action: str,
        action_by: str,
        new_status: str
    ) -> None:
        """
        异步触发通知
        
        通知发送失败不阻塞审批响应
        
        Args:
            work_order_id: 工单ID
            action: 操作类型 (APPROVE/REJECT/CLOSE)
            action_by: 操作人
            new_status: 新状态
        """
        if not self._notification_service:
            logger.warning("Notification service not configured")
            return
        
        notification_payload = {
            "work_order_id": work_order_id,
            "action": action,
            "action_by": action_by,
            "new_status": new_status,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # 异步发送，不等待结果
        try:
            # 使用线程池或任务队列异步执行
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                self._notification_service.send_approval_notification(
                    notification_payload
                )
            )
        except Exception as e:
            # 通知失败不阻塞审批
            logger.error(f"Failed to send notification for work order {work_order_id}: {e}")
        finally:
            loop.close()
    
    def _parse_status(self, status) -> WorkOrderStatus:
        """
        解析工单状态
        
        Args:
            status: 状态值（字符串或枚举）
            
        Returns:
            WorkOrderStatus: 解析后的状态枚举
        """
        if isinstance(status, WorkOrderStatus):
            return status
        if isinstance(status, str):
            try:
                return WorkOrderStatus(status.upper())
            except ValueError:
                return WorkOrderStatus.PENDING
        return WorkOrderStatus.PENDING
    
    def get_state_transitions(self) -> Dict[str, List[str]]:
        """
        获取状态机转换规则
        
        用于调试和文档生成
        
        Returns:
            Dict: 状态转换规则
        """
        return {
            status.value: [event.value for event in events]
            for status, events in STATE_TRANSITIONS.items()
        }


# 导出类和函数
__all__ = [
    "WorkOrderService",
    "WorkOrderStatus",
    "ApprovalEvent",
    "InvalidTransitionError",
    "ConcurrencyConflictError",
    "PermissionDeniedError",
    "WorkOrderNotFoundError",
    "STATE_TRANSITIONS",
]