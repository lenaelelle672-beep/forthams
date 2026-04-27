"""
状态转换模块 - 管理资产状态流转引擎

本模块负责定义和执行资产状态机中的所有状态转换规则。
支持退役申请、审批通过、审批拒绝等转换类型。

用于 SWARM-002 资产报废退役流程中的状态流转控制。
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Callable, Dict, Any, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class TransitionType(Enum):
    """
    状态转换类型枚举
    
    定义资产生命周期中可能发生的各种状态转换事件。
    """
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    APPLY_RETIREMENT = "apply_retirement"
    APPROVE_RETIREMENT = "approve_retirement"
    REJECT_RETIREMENT = "reject_retirement"
    CANCEL = "cancel"


class AssetStatus(Enum):
    """
    资产状态枚举
    
    涵盖资产全生命周期的各种状态。
    """
    ACTIVE = "active"
    IDLE = "idle"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"
    SCRAPPED = "scrapped"


class RetirementStatus(Enum):
    """
    退役申请状态枚举
    
    跟踪退役申请的处理进度。
    """
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


@dataclass
class TransitionContext:
    """
    状态转换上下文
    
    携带状态转换所需的所有信息和数据。
    
    Attributes:
        asset_id: 资产唯一标识
        current_status: 当前资产状态
        target_status: 目标资产状态
        transition_type: 转换类型
        user_id: 操作用户ID
        timestamp: 操作时间戳
        reason: 转换原因/备注
        metadata: 附加元数据
    """
    asset_id: str
    current_status: AssetStatus
    target_status: AssetStatus
    transition_type: TransitionType
    user_id: str
    timestamp: datetime = field(default_factory=datetime.now)
    reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransitionResult:
    """
    状态转换结果
    
    封装转换执行后的返回信息。
    
    Attributes:
        success: 转换是否成功
        message: 结果消息
        new_status: 新的资产状态
        history_id: 历史记录ID (如果创建了历史记录)
    """
    success: bool
    message: str
    new_status: Optional[AssetStatus] = None
    history_id: Optional[str] = None


class TransitionGuard:
    """
    状态转换守卫基类
    
    守卫负责在转换执行前进行条件检查。
    所有自定义守卫应继承此类并实现 can_execute 方法。
    """
    
    def can_execute(self, context: TransitionContext) -> bool:
        """
        检查是否可以执行此转换
        
        Args:
            context: 转换上下文
            
        Returns:
            bool: 如果条件满足返回 True
        """
        raise NotImplementedError("Subclasses must implement can_execute")


class RetirementGuard(TransitionGuard):
    """
    退役申请守卫
    
    确保只有符合条件的资产才能发起退役申请。
    """
    
    def can_execute(self, context: TransitionContext) -> bool:
        """检查是否满足退役申请条件"""
        # 只允许闲置或使用中的资产申请退役
        if context.current_status not in [AssetStatus.IDLE, AssetStatus.IN_USE]:
            logger.warning(
                f"Retirement guard failed: asset {context.asset_id} "
                f"is in status {context.current_status}, expected IDLE or IN_USE"
            )
            return False
        
        # 必须提供退役原因
        if not context.reason or len(context.reason.strip()) == 0:
            logger.warning(
                f"Retirement guard failed: asset {context.asset_id} "
                f"missing retirement reason"
            )
            return False
        
        return True


class ApprovalGuard(TransitionGuard):
    """
    审批通过守卫
    
    确保审批操作符合业务规则。
    """
    
    def can_execute(self, context: TransitionContext) -> bool:
        """检查是否满足审批条件"""
        # 退役申请必须在待审批状态
        if context.transition_type not in [
            TransitionType.APPROVE_RETIREMENT,
            TransitionType.REJECT_RETIREMENT
        ]:
            return True  # 非审批类转换跳过此检查
        
        # 审批时必须指定用户
        if not context.user_id:
            logger.warning(
                f"Approval guard failed: missing user_id for approval action"
            )
            return False
        
        return True


class PermissionGuard(TransitionGuard):
    """
    权限守卫
    
    确保操作用户具有相应权限。
    """
    
    def __init__(self, required_roles: List[str] = None):
        """
        初始化权限守卫
        
        Args:
            required_roles: 所需角色列表
        """
        self.required_roles = required_roles or []
    
    def can_execute(self, context: TransitionContext) -> bool:
        """检查用户权限"""
        # 如果没有定义必需角色，则默认允许
        if not self.required_roles:
            return True
        
        # 从 metadata 中获取用户角色
        user_roles = context.metadata.get("user_roles", [])
        
        for role in self.required_roles:
            if role in user_roles:
                return True
        
        logger.warning(
            f"Permission guard failed: user {context.user_id} "
            f"lacks required roles {self.required_roles}"
        )
        return False


class Transition:
    """
    状态转换定义
    
    定义源状态、目标状态、转换类型以及执行条件守卫。
    """
    
    def __init__(
        self,
        source_status: AssetStatus,
        target_status: AssetStatus,
        transition_type: TransitionType,
        guards: List[TransitionGuard] = None,
        description: str = ""
    ):
        """
        初始化状态转换
        
        Args:
            source_status: 源状态
            target_status: 目标状态
            transition_type: 转换类型
            guards: 条件守卫列表
            description: 转换描述
        """
        self.source_status = source_status
        self.target_status = target_status
        self.transition_type = transition_type
        self.guards = guards or []
        self.description = description
    
    def can_execute(self, context: TransitionContext) -> bool:
        """
        验证是否可以执行此转换
        
        Args:
            context: 转换上下文
            
        Returns:
            bool: 如果所有守卫条件满足返回 True
        """
        # 验证当前状态匹配
        if context.current_status != self.source_status:
            return False
        
        # 验证转换类型匹配
        if context.transition_type != self.transition_type:
            return False
        
        # 执行所有守卫检查
        for guard in self.guards:
            if not guard.can_execute(context):
                return False
        
        return True
    
    def execute(self, context: TransitionContext) -> TransitionResult:
        """
        执行状态转换
        
        Args:
            context: 转换上下文
            
        Returns:
            TransitionResult: 转换结果
        """
        if not self.can_execute(context):
            return TransitionResult(
                success=False,
                message=f"Transition guard check failed for {self.transition_type.value}",
                new_status=context.current_status
            )
        
        # 更新目标状态
        context.target_status = self.target_status
        
        return TransitionResult(
            success=True,
            message=f"Successfully transitioned from {self.source_status.value} "
                    f"to {self.target_status.value}",
            new_status=self.target_status
        )


class StateTransitionEngine:
    """
    状态转换引擎
    
    管理和执行所有状态转换规则。
    支持动态注册转换规则和执行转换。
    """
    
    def __init__(self):
        """初始化状态转换引擎"""
        self._transitions: List[Transition] = []
        self._transition_index: Dict[Tuple, List[Transition]] = {}
    
    def register_transition(self, transition: Transition) -> None:
        """
        注册状态转换规则
        
        Args:
            transition: 状态转换定义
        """
        self._transitions.append(transition)
        
        # 更新索引以加快查询速度
        key = (transition.source_status, transition.transition_type)
        if key not in self._transition_index:
            self._transition_index[key] = []
        self._transition_index[key].append(transition)
        
        logger.info(
            f"Registered transition: {transition.source_status.value} "
            f"-> {transition.target_status.value} "
            f"({transition.transition_type.value})"
        )
    
    def get_available_transitions(
        self,
        current_status: AssetStatus
    ) -> List[Transition]:
        """
        获取当前状态可用的所有转换
        
        Args:
            current_status: 当前资产状态
            
        Returns:
            List[Transition]: 可用的转换列表
        """
        return [
            t for t in self._transitions
            if t.source_status == current_status
        ]
    
    def find_transition(
        self,
        current_status: AssetStatus,
        transition_type: TransitionType
    ) -> Optional[Transition]:
        """
        查找指定的状态转换
        
        Args:
            current_status: 当前状态
            transition_type: 转换类型
            
        Returns:
            Optional[Transition]: 找到的转换，未找到则返回 None
        """
        key = (current_status, transition_type)
        transitions = self._transition_index.get(key, [])
        
        if not transitions:
            return None
        
        # 如果有多个匹配的转换，返回第一个
        return transitions[0] if transitions else None
    
    def execute_transition(
        self,
        context: TransitionContext
    ) -> TransitionResult:
        """
        执行状态转换
        
        Args:
            context: 转换上下文
            
        Returns:
            TransitionResult: 转换结果
        """
        # 查找匹配的转换
        transition = self.find_transition(
            context.current_status,
            context.transition_type
        )
        
        if transition is None:
            logger.warning(
                f"No transition found: {context.current_status.value} "
                f"+ {context.transition_type.value}"
            )
            return TransitionResult(
                success=False,
                message=f"Invalid transition from {context.current_status.value} "
                        f"with type {context.transition_type.value}",
                new_status=context.current_status
            )
        
        # 执行转换
        result = transition.execute(context)
        
        if result.success:
            logger.info(
                f"Transition executed: asset {context.asset_id} "
                f"{context.current_status.value} -> {result.new_status.value}"
            )
        else:
            logger.warning(
                f"Transition failed: asset {context.asset_id} "
                f"reason: {result.message}"
            )
        
        return result


def create_retirement_transition() -> Transition:
    """
    创建退役申请转换
    
    Returns:
        Transition: 配置好的退役转换
    """
    return Transition(
        source_status=AssetStatus.IN_USE,
        target_status=AssetStatus.RETIRED,
        transition_type=TransitionType.APPLY_RETIREMENT,
        guards=[RetirementGuard()],
        description="资产申请退役，从使用中转为已退役"
    )


def create_approval_transition(
    approved: bool = True
) -> Transition:
    """
    创建审批转换
    
    Args:
        approved: 是否为审批通过，False 为审批拒绝
        
    Returns:
        Transition: 配置好的审批转换
    """
    if approved:
        return Transition(
            source_status=AssetStatus.RETIRED,
            target_status=AssetStatus.SCRAPPED,
            transition_type=TransitionType.APPROVE_RETIREMENT,
            guards=[ApprovalGuard()],
            description="退役申请审批通过，资产报废"
        )
    else:
        return Transition(
            source_status=AssetStatus.RETIRED,
            target_status=AssetStatus.ACTIVE,
            transition_type=TransitionType.REJECT_RETIREMENT,
            guards=[ApprovalGuard()],
            description="退役申请审批拒绝，资产恢复活跃"
        )


def create_default_engine() -> StateTransitionEngine:
    """
    创建默认配置的状态转换引擎
    
    Returns:
        StateTransitionEngine: 预配置的状态转换引擎
    """
    engine = StateTransitionEngine()
    
    # 注册默认转换规则
    engine.register_transition(create_retirement_transition())
    engine.register_transition(create_approval_transition(approved=True))
    engine.register_transition(create_approval_transition(approved=False))
    
    return engine