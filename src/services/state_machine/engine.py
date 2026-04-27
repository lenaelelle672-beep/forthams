"""
资产状态流转引擎模块

本模块实现了资产从在用到报废的完整生命周期状态迁移引擎，包括：
- 状态迁移核心逻辑（确定性、守卫条件）
- 审批链引擎（多角色层级顺序审批）
- 事件溯源存储层（历史记录持久化与查询）
- 原子化事务处理

架构遵循领域驱动设计(DDD)，与现有资产目录数据结构兼容。
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

# 类型别名定义
EventHandler = Callable[[StateTransitionEvent], None]


class AssetStatus(str, Enum):
    """
    资产状态枚举
    
    生命周期：IN_USE -> IDLE -> RETIRED -> SCRAPPED
    """
    IN_USE = "in_use"
    IDLE = "idle"
    PENDING_RETIREMENT = "pending_retirement"
    RETIRED = "retired"
    SCRAPPED = "scrapped"


class RetirementEventType(str, Enum):
    """退役申请事件类型枚举"""
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    FINAL_APPROVED = "final_approved"


class ApprovalLevel(str, Enum):
    """审批层级枚举"""
    APPLICANT = "applicant"      # 申请人发起
    APPROVER = "approver"        # 审批人
    FINAL_APPROVER = "final_approver"  # 终审人


@dataclass
class StateTransitionEvent:
    """
    状态变更事件
    
    用于事件溯源，每个状态变更都会生成一个不可变事件记录。
    
    Attributes:
        event_id: 事件唯一标识 (UUID)
        asset_id: 资产ID
        from_state: 原状态
        to_state: 目标状态
        event_type: 事件类型
        actor_id: 操作人ID
        actor_role: 操作人角色
        approval_level: 审批层级
        metadata: 附加元数据
        timestamp: 事件时间戳
    """
    asset_id: str
    from_state: AssetStatus
    to_state: AssetStatus
    event_type: RetirementEventType
    actor_id: str
    actor_role: str
    approval_level: ApprovalLevel
    metadata: dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        """
        将事件转换为字典格式
        
        Returns:
            包含事件所有字段的字典
        """
        return {
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "from_state": self.from_state.value if isinstance(self.from_state, AssetStatus) else self.from_state,
            "to_state": self.to_state.value if isinstance(self.to_state, AssetStatus) else self.to_state,
            "event_type": self.event_type.value if isinstance(self.event_type, RetirementEventType) else self.event_type,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role,
            "approval_level": self.approval_level.value if isinstance(self.approval_level, ApprovalLevel) else self.approval_level,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
        }


@dataclass
class RetirementWorkflowInstance:
    """
    退役申请工作流实例
    
    代表一次完整的退役申请流程，支持多级审批。
    
    Attributes:
        instance_id: 流程实例ID
        asset_id: 资产ID
        applicant_id: 申请人ID
        current_state: 当前状态
        current_approval_level: 当前审批层级
        is_rejected: 是否已拒绝
        events: 事件历史列表
        created_at: 创建时间
        updated_at: 更新时间
    """
    asset_id: str
    applicant_id: str
    current_state: AssetStatus
    current_approval_level: ApprovalLevel = ApprovalLevel.APPLICANT
    is_rejected: bool = False
    events: list[StateTransitionEvent] = field(default_factory=list)
    instance_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def add_event(self, event: StateTransitionEvent) -> None:
        """
        添加状态变更事件
        
        Args:
            event: 状态变更事件
        """
        self.events.append(event)
        self.updated_at = datetime.utcnow()

    def get_event_history(self) -> list[StateTransitionEvent]:
        """
        获取事件历史（按时间排序）
        
        Returns:
            按时间升序排列的事件列表
        """
        return sorted(self.events, key=lambda e: e.timestamp)


@dataclass
class TransitionGuard:
    """
    状态迁移守卫条件
    
    用于控制状态迁移的合法性，满足守卫条件才允许迁移。
    
    Attributes:
        name: 守卫名称
        check_func: 检查函数，返回True表示允许迁移
        error_message: 不满足条件时的错误消息
    """
    name: str
    check_func: Callable[[dict[str, Any]], bool]
    error_message: str


class StateTransitionError(Exception):
    """
    状态迁移异常
    
    当状态迁移不合法或违反业务规则时抛出。
    """
    def __init__(self, message: str, code: str = "STATE_TRANSITION_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class InvalidTransitionError(StateTransitionError):
    """无效的状态迁移异常"""
    def __init__(self, message: str):
        super().__init__(message, "INVALID_TRANSITION")


class GuardConditionNotMetError(StateTransitionError):
    """守卫条件不满足异常"""
    def __init__(self, message: str):
        super().__init__(message, "GUARD_NOT_MET")


class ApprovalChainViolationError(StateTransitionError):
    """审批链违规异常"""
    def __init__(self, message: str):
        super().__init__(message, "APPROVAL_CHAIN_VIOLATION")


class EventStore:
    """
    事件存储层
    
    实现事件溯源模式的持久化存储，确保历史记录不可篡改。
    
    采用内存存储（生产环境应替换为数据库）。
    """
    
    def __init__(self) -> None:
        """初始化事件存储"""
        self._events: list[StateTransitionEvent] = []
        self._lock = False  # 简化：实际应使用数据库事务锁

    def append(self, event: StateTransitionEvent) -> None:
        """
        追加事件（原子化操作）
        
        Args:
            event: 待追加的状态变更事件
            
        Raises:
            RuntimeError: 当存储被锁定时抛出
        """
        if self._lock:
            raise RuntimeError("Event store is locked during transaction")
        self._events.append(event)

    def get_by_asset_id(self, asset_id: str) -> list[StateTransitionEvent]:
        """
        根据资产ID查询事件历史
        
        Args:
            asset_id: 资产ID
            
        Returns:
            按时间升序排列的事件列表
        """
        events = [e for e in self._events if e.asset_id == asset_id]
        return sorted(events, key=lambda e: e.timestamp)

    def get_by_instance_id(
        self, 
        instance_id: str, 
        asset_id: str
    ) -> list[StateTransitionEvent]:
        """
        根据流程实例ID和资产ID查询事件
        
        Args:
            instance_id: 流程实例ID
            asset_id: 资产ID
            
        Returns:
            对应流程实例的事件列表
        """
        return [
            e for e in self._events 
            if e.asset_id == asset_id and e.metadata.get("instance_id") == instance_id
        ]

    def begin_transaction(self) -> None:
        """开始事务"""
        self._lock = True

    def commit_transaction(self) -> None:
        """提交事务"""
        self._lock = False

    def rollback_transaction(self) -> None:
        """回滚事务"""
        self._lock = False


class RetirementWorkflowEngine:
    """
    退役申请工作流引擎
    
    核心引擎，负责管理资产退役申请的状态流转与审批链执行。
    
    Features:
        - 确定性状态迁移
        - 多角色层级审批
        - 原子化事件持久化
        - 历史记录追溯
    """
    
    # 合法的状态迁移映射表
    VALID_TRANSITIONS: dict[AssetStatus, list[AssetStatus]] = {
        AssetStatus.IN_USE: [AssetStatus.IDLE, AssetStatus.PENDING_RETIREMENT],
        AssetStatus.IDLE: [AssetStatus.IN_USE, AssetStatus.PENDING_RETIREMENT],
        AssetStatus.PENDING_RETIREMENT: [AssetStatus.RETIRED, AssetStatus.IDLE],
        AssetStatus.RETIRED: [AssetStatus.SCRAPPED],
        AssetStatus.SCRAPPED: [],
    }

    # 审批层级顺序
    APPROVAL_LEVEL_ORDER = [
        ApprovalLevel.APPLICANT,
        ApprovalLevel.APPROVER,
        ApprovalLevel.FINAL_APPROVER,
    ]

    def __init__(self, event_store: Optional[EventStore] = None) -> None:
        """
        初始化退役工作流引擎
        
        Args:
            event_store: 事件存储实例，默认创建新实例
        """
        self._event_store = event_store or EventStore()
        self._workflow_instances: dict[str, RetirementWorkflowInstance] = {}
        self._guard_conditions: list[TransitionGuard] = []

    @property
    def event_store(self) -> EventStore:
        """获取事件存储"""
        return self._event_store

    def register_guard(self, guard: TransitionGuard) -> None:
        """
        注册状态迁移守卫条件
        
        Args:
            guard: 守卫条件实例
        """
        self._guard_conditions.append(guard)

    def _check_guards(
        self, 
        from_state: AssetStatus, 
        to_state: AssetStatus, 
        context: dict[str, Any]
    ) -> None:
        """
        检查所有守卫条件
        
        Args:
            from_state: 原状态
            to_state: 目标状态
            context: 上下文数据
            
        Raises:
            GuardConditionNotMetError: 当任一守卫条件不满足时抛出
        """
        for guard in self._guard_conditions:
            if not guard.check_func(context):
                raise GuardConditionNotMetError(guard.error_message)

    def _validate_transition(
        self, 
        from_state: AssetStatus, 
        to_state: AssetStatus
    ) -> None:
        """
        验证状态迁移的合法性
        
        Args:
            from_state: 原状态
            to_state: 目标状态
            
        Raises:
            InvalidTransitionError: 当迁移路径不合法时抛出
        """
        valid_targets = self.VALID_TRANSITIONS.get(from_state, [])
        if to_state not in valid_targets:
            raise InvalidTransitionError(
                f"Invalid transition from {from_state.value} to {to_state.value}"
            )

    def _get_next_approval_level(
        self, 
        current_level: ApprovalLevel
    ) -> Optional[ApprovalLevel]:
        """
        获取下一个审批层级
        
        Args:
            current_level: 当前审批层级
            
        Returns:
            下一个审批层级，若无则返回None
        """
        try:
            current_index = self.APPROVAL_LEVEL_ORDER.index(current_level)
            if current_index < len(self.APPROVAL_LEVEL_ORDER) - 1:
                return self.APPROVAL_LEVEL_ORDER[current_index + 1]
            return None
        except ValueError:
            return None

    def _create_and_persist_event(
        self,
        asset_id: str,
        from_state: AssetStatus,
        to_state: AssetStatus,
        event_type: RetirementEventType,
        actor_id: str,
        actor_role: str,
        approval_level: ApprovalLevel,
        instance_id: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> StateTransitionEvent:
        """
        创建并持久化状态变更事件（原子化）
        
        Args:
            asset_id: 资产ID
            from_state: 原状态
            to_state: 目标状态
            event_type: 事件类型
            actor_id: 操作人ID
            actor_role: 操作人角色
            approval_level: 审批层级
            instance_id: 流程实例ID
            metadata: 附加元数据
            
        Returns:
            创建的事件实例
        """
        meta = metadata or {}
        meta["instance_id"] = instance_id
        
        event = StateTransitionEvent(
            asset_id=asset_id,
            from_state=from_state,
            to_state=to_state,
            event_type=event_type,
            actor_id=actor_id,
            actor_role=actor_role,
            approval_level=approval_level,
            metadata=meta,
        )
        
        self._event_store.append(event)
        return event

    def submit_retirement(
        self,
        asset_id: str,
        applicant_id: str,
        current_asset_status: AssetStatus,
        metadata: Optional[dict[str, Any]] = None,
    ) -> RetirementWorkflowInstance:
        """
        提交退役申请
        
        创建新的退役申请工作流实例，资产状态变更为PENDING_RETIREMENT。
        
        Args:
            asset_id: 资产ID
            applicant_id: 申请人ID
            current_asset_status: 资产当前状态
            metadata: 附加元数据
            
        Returns:
            创建的工作流实例
            
        Raises:
            InvalidTransitionError: 当资产状态不允许提交退役申请时抛出
        """
        # 验证当前状态可以提交退役申请
        if current_asset_status not in [
            AssetStatus.IN_USE, 
            AssetStatus.IDLE
        ]:
            raise InvalidTransitionError(
                f"Cannot submit retirement for asset in {current_asset_status.value} state"
            )

        # 检查守卫条件
        context = {
            "asset_id": asset_id,
            "applicant_id": applicant_id,
            "current_status": current_asset_status,
            **(metadata or {}),
        }
        self._check_guards(current_asset_status, AssetStatus.PENDING_RETIREMENT, context)

        # 创建工作流实例
        instance = RetirementWorkflowInstance(
            asset_id=asset_id,
            applicant_id=applicant_id,
            current_state=AssetStatus.PENDING_RETIREMENT,
            current_approval_level=ApprovalLevel.APPLICANT,
        )

        # 原子化：创建事件并持久化
        self._event_store.begin_transaction()
        try:
            self._create_and_persist_event(
                asset_id=asset_id,
                from_state=current_asset_status,
                to_state=AssetStatus.PENDING_RETIREMENT,
                event_type=RetirementEventType.SUBMITTED,
                actor_id=applicant_id,
                actor_role=ApprovalLevel.APPLICANT.value,
                approval_level=ApprovalLevel.APPLICANT,
                instance_id=instance.instance_id,
                metadata=metadata,
            )
            instance.add_event(
                StateTransitionEvent(
                    asset_id=asset_id,
                    from_state=current_asset_status,
                    to_state=AssetStatus.PENDING_RETIREMENT,
                    event_type=RetirementEventType.SUBMITTED,
                    actor_id=applicant_id,
                    actor_role=ApprovalLevel.APPLICANT.value,
                    approval_level=ApprovalLevel.APPLICANT,
                    metadata={"instance_id": instance.instance_id},
                )
            )
            self._event_store.commit_transaction()
        except Exception as e:
            self._event_store.rollback_transaction()
            raise StateTransitionError(f"Failed to submit retirement: {str(e)}")

        self._workflow_instances[instance.instance_id] = instance
        return instance

    def approve_step(
        self,
        instance_id: str,
        asset_id: str,
        approver_id: str,
        approver_role: str,
        comment: Optional[str] = None,
    ) -> RetirementWorkflowInstance:
        """
        审批通过当前步骤
        
        根据当前审批层级推进流程：
        - APPROVER -> FINAL_APPROVER
        - FINAL_APPROVER -> 状态变更为RETIRED
        
        Args:
            instance_id: 工作流实例ID
            asset_id: 资产ID
            approver_id: 审批人ID
            approver_role: 审批人角色
            comment: 审批意见
            
        Returns:
            更新后的工作流实例
            
        Raises:
            StateTransitionError: 当审批链不可绕过或权限不足时抛出
        """
        instance = self._workflow_instances.get(instance_id)
        if not instance:
            raise StateTransitionError(f"Workflow instance {instance_id} not found")
        
        if instance.asset_id != asset_id:
            raise StateTransitionError(f"Asset ID mismatch for instance {instance_id}")
        
        if instance.is_rejected:
            raise ApprovalChainViolationError(
                "Cannot approve a rejected workflow instance"
            )

        # RBAC权限校验（简化版：实际应调用权限服务）
        if not self._check_approval_permission(approver_role, instance.current_approval_level):
            raise ApprovalChainViolationError(
                f"Role {approver_role} cannot approve at level {instance.current_approval_level.value}"
            )

        current_level = instance.current_approval_level
        next_level = self._get_next_approval_level(current_level)

        metadata = {"comment": comment} if comment else {}
        
        self._event_store.begin_transaction()
        try:
            if next_level is None:
                # 终审完成，状态变更为RETIRED
                new_state = AssetStatus.RETIRED
                event_type = RetirementEventType.FINAL_APPROVED
                
                self._create_and_persist_event(
                    asset_id=asset_id,
                    from_state=instance.current_state,
                    to_state=new_state,
                    event_type=event_type,
                    actor_id=approver_id,
                    actor_role=approver_role,
                    approval_level=current_level,
                    instance_id=instance_id,
                    metadata=metadata,
                )
                
                instance.current_state = new_state
                instance.add_event(
                    StateTransitionEvent(
                        asset_id=asset_id,
                        from_state=instance.current_state,
                        to_state=new_state,
                        event_type=event_type,
                        actor_id=approver_id,
                        actor_role=approver_role,
                        approval_level=current_level,
                        metadata={"instance_id": instance_id, **metadata},
                    )
                )
            else:
                # 推进到下一审批层级
                self._create_and_persist_event(
                    asset_id=asset_id,
                    from_state=instance.current_state,
                    to_state=instance.current_state,
                    event_type=RetirementEventType.APPROVED,
                    actor_id=approver_id,
                    actor_role=approver_role,
                    approval_level=current_level,
                    instance_id=instance_id,
                    metadata=metadata,
                )
                
                instance.current_approval_level = next_level
                instance.add_event(
                    StateTransitionEvent(
                        asset_id=asset_id,
                        from_state=instance.current_state,
                        to_state=instance.current_state,
                        event_type=RetirementEventType.APPROVED,
                        actor_id=approver_id,
                        actor_role=approver_role,
                        approval_level=current_level,
                        metadata={"instance_id": instance_id, "next_level": next_level.value, **metadata},
                    )
                )
            
            self._event_store.commit_transaction()
        except Exception as e:
            self._event_store.rollback_transaction()
            raise StateTransitionError(f"Failed to approve step: {str(e)}")

        return instance

    def reject(
        self,
        instance_id: str,
        asset_id: str,
        rejector_id: str,
        rejector_role: str,
        reason: str,
    ) -> RetirementWorkflowInstance:
        """
        拒绝退役申请
        
        任一审批节点拒绝，流程终止并标记为"已否决"，资产状态回退。
        
        Args:
            instance_id: 工作流实例ID
            asset_id: 资产ID
            rejector_id: 拒绝人ID
            rejector_role: 拒绝人角色
            reason: 拒绝原因
            
        Returns:
            更新后的工作流实例
            
        Raises:
            StateTransitionError: 当流程已拒绝或状态不一致时抛出
        """
        instance = self._workflow_instances.get(instance_id)
        if not instance:
            raise StateTransitionError(f"Workflow instance {instance_id} not found")
        
        if instance.asset_id != asset_id:
            raise StateTransitionError(f"Asset ID mismatch for instance {instance_id}")
        
        if instance.is_rejected:
            raise ApprovalChainViolationError("Workflow instance already rejected")

        # RBAC权限校验
        if not self._check_approval_permission(rejector_role, instance.current_approval_level):
            raise ApprovalChainViolationError(
                f"Role {rejector_role} cannot reject at level {instance.current_approval_level.value}"
            )

        previous_state = instance.current_state
        
        metadata = {"reason": reason}
        
        self._event_store.begin_transaction()
        try:
            # 回退到IDLE状态
            self._create_and_persist_event(
                asset_id=asset_id,
                from_state=instance.current_state,
                to_state=AssetStatus.IDLE,
                event_type=RetirementEventType.REJECTED,
                actor_id=rejector_id,
                actor_role=rejector_role,
                approval_level=instance.current_approval_level,
                instance_id=instance_id,
                metadata=metadata,
            )
            
            instance.current_state = AssetStatus.IDLE
            instance.is_rejected = True
            instance.add_event(
                StateTransitionEvent(
                    asset_id=asset_id,
                    from_state=previous_state,
                    to_state=AssetStatus.IDLE,
                    event_type=RetirementEventType.REJECTED,
                    actor_id=rejector_id,
                    actor_role=rejector_role,
                    approval_level=instance.current_approval_level,
                    metadata={"instance_id": instance_id, **metadata},
                )
            )
            
            self._event_store.commit_transaction()
        except Exception as e:
            self._event_store.rollback_transaction()
            raise StateTransitionError(f"Failed to reject: {str(e)}")

        return instance

    def _check_approval_permission(
        self, 
        role: str, 
        approval_level: ApprovalLevel
    ) -> bool:
        """
        检查审批权限
        
        基于RBAC的权限校验，最小权限原则。
        
        Args:
            role: 角色标识
            approval_level: 目标审批层级
            
        Returns:
            是否有权限执行审批
        """
        # 简化实现：实际应从权限服务获取
        role_to_level = {
            "approver": ApprovalLevel.APPROVER,
            "final_approver": ApprovalLevel.FINAL_APPROVER,
            "admin": ApprovalLevel.FINAL_APPROVER,
        }
        required_level = role_to_level.get(role)
        if required_level is None:
            return False
        
        # 检查角色是否满足当前审批层级要求
        role_index = self.APPROVAL_LEVEL_ORDER.index(required_level)
        current_index = self.APPROVAL_LEVEL_ORDER.index(approval_level)
        
        return role_index >= current_index

    def get_workflow_instance(
        self, 
        instance_id: str
    ) -> Optional[RetirementWorkflowInstance]:
        """
        获取工作流实例
        
        Args:
            instance_id: 工作流实例ID
            
        Returns:
            工作流实例，若不存在则返回None
        """
        return self._workflow_instances.get(instance_id)

    def get_event_history(
        self, 
        asset_id: str
    ) -> list[StateTransitionEvent]:
        """
        获取资产的事件历史
        
        按时间升序返回所有状态变更事件。
        
        Args:
            asset_id: 资产ID
            
        Returns:
            按时间排序的事件列表
        """
        return self._event_store.get_by_asset_id(asset_id)

    def can_transition(
        self,
        from_state: AssetStatus,
        to_state: AssetStatus,
        context: Optional[dict[str, Any]] = None,
    ) -> bool:
        """
        检查状态迁移是否可行
        
        用于API预览迁移结果，实现确定性验证。
        
        Args:
            from_state: 原状态
            to_state: 目标状态
            context: 上下文数据
            
        Returns:
            是否可以执行迁移
        """
        try:
            self._validate_transition(from_state, to_state)
            self._check_guards(from_state, to_state, context or {})
            return True
        except StateTransitionError:
            return False


# 导出公共接口
__all__ = [
    "AssetStatus",
    "RetirementEventType",
    "ApprovalLevel",
    "StateTransitionEvent",
    "RetirementWorkflowInstance",
    "TransitionGuard",
    "StateTransitionError",
    "InvalidTransitionError",
    "GuardConditionNotMetError",
    "ApprovalChainViolationError",
    "EventStore",
    "RetirementWorkflowEngine",
]