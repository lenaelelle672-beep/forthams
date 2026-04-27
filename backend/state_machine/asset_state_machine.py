"""
资产状态机模块 - 资产报废退役流程核心引擎

本模块实现了资产状态的流转引擎，支持以下功能：
- 资产状态转换（含守卫逻辑）
- 报废申请审批链
- 历史记录持久化

状态流转图：
    IN_USE -> PENDING_RETIREMENT -> RETIRED
                    ↓
              REJECTED (拒绝后回归 IN_USE)

支持的状态：
    IN_USE: 使用中
    PENDING_RETIREMENT: 待退役审批
    RETIRED: 已退役
    REJECTED: 申请被拒绝
"""

from enum import Enum
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
from dataclasses import dataclass, field


class AssetStatus(Enum):
    """
    资产状态枚举
    
    定义资产的全生命周期状态：
    - IN_USE: 资产正在正常使用
    - PENDING_RETIREMENT: 资产发起退役申请，等待审批
    - RETIRED: 资产已完成退役流程
    - REJECTED: 退役申请被拒绝，资产回归使用状态
    """
    IN_USE = "IN_USE"
    PENDING_RETIREMENT = "PENDING_RETIREMENT"
    RETIRED = "RETIRED"
    REJECTED = "REJECTED"


class TransitionNotAllowedError(Exception):
    """
    状态转换异常 - 当不允许的状态转换被尝试时抛出
    
    Attributes:
        current_status: 当前状态
        target_status: 目标状态
        message: 错误消息
    """
    def __init__(self, current_status: AssetStatus, target_status: AssetStatus, message: str = ""):
        self.current_status = current_status
        self.target_status = target_status
        self.message = message or f"不允许的状态转换: {current_status.value} -> {target_status.value}"
        super().__init__(self.message)


@dataclass
class StateTransition:
    """
    状态转换记录数据类
    
    用于记录每次状态转换的详细信息，便于审计和追溯。
    
    Attributes:
        asset_id: 资产唯一标识
        from_status: 转换前状态
        to_status: 转换后状态
        triggered_by: 触发者（用户ID或系统）
        timestamp: 转换时间戳
        reason: 转换原因/备注
        metadata: 附加元数据
    """
    asset_id: str
    from_status: AssetStatus
    to_status: AssetStatus
    triggered_by: str
    timestamp: datetime = field(default_factory=datetime.now)
    reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetirementRequest:
    """
    退役申请数据类
    
    封装资产退役申请的完整信息，包括申请人、申请理由和审批状态。
    
    Attributes:
        request_id: 申请唯一标识
        asset_id: 资产ID
        applicant: 申请人用户ID
        reason: 退役原因
        status: 当前审批状态
        created_at: 申请创建时间
        approved_by: 审批人（可为空）
        approved_at: 审批时间（可为空）
        remarks: 审批备注
    """
    request_id: str
    asset_id: str
    applicant: str
    reason: str
    status: str = "PENDING"
    created_at: datetime = field(default_factory=datetime.now)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    remarks: str = ""


# 状态转换守卫函数类型
TransitionGuard = Callable[['AssetStateMachine', AssetStatus, AssetStatus], bool]


class AssetStateMachine:
    """
    资产状态机 - 核心状态流转引擎
    
    实现资产状态的有限状态自动机，支持：
    - 预定义状态转换规则
    - 自定义守卫逻辑（Guard Functions）
    - 状态转换历史记录
    - 事件监听器
    
    使用示例:
        >>> machine = AssetStateMachine()
        >>> machine.transition("ASSET-001", AssetStatus.PENDING_RETIREMENT, "admin")
        >>> machine.get_status("ASSET-001")
        <AssetStatus.PENDING_RETIREMENT>
    
    Attributes:
        _states: 资产状态映射表 {asset_id: current_status}
        _history: 状态转换历史记录列表
        _guards: 守卫函数列表
        _listeners: 事件监听器列表
    """
    
    # 预定义的状态转换规则
    ALLOWED_TRANSITIONS: Dict[AssetStatus, List[AssetStatus]] = {
        AssetStatus.IN_USE: [AssetStatus.PENDING_RETIREMENT],
        AssetStatus.PENDING_RETIREMENT: [AssetStatus.RETIRED, AssetStatus.REJECTED],
        AssetStatus.REJECTED: [AssetStatus.IN_USE],
        AssetStatus.RETIRED: [],  # 已退役状态为终态，不可转换
    }

    def __init__(self):
        """
        初始化资产状态机
        
        创建状态机实例，初始化内部状态存储和事件系统。
        """
        self._states: Dict[str, AssetStatus] = {}
        self._history: List[StateTransition] = []
        self._guards: List[TransitionGuard] = []
        self._listeners: List[Callable[[StateTransition], None]] = []

    def register_guard(self, guard: TransitionGuard) -> None:
        """
        注册状态转换守卫函数
        
        守卫函数会在状态转换前被调用，用于自定义业务规则校验。
        所有守卫函数必须返回 True 才能允许转换。
        
        Args:
            guard: 守卫函数，签名为 (machine, from_status, to_status) -> bool
        
        Example:
            >>> def check_asset_value(machine, from_s, to_s):
            ...     return True  # 自定义逻辑
            >>> machine.register_guard(check_asset_value)
        """
        self._guards.append(guard)

    def register_listener(self, listener: Callable[[StateTransition], None]) -> None:
        """
        注册状态转换事件监听器
        
        监听器会在每次状态转换后被调用，常用于日志记录、通知发送等。
        
        Args:
            listener: 监听器函数，签名为 (transition) -> None
        
        Example:
            >>> def on_transition(transition):
            ...     print(f"Asset {transition.asset_id} transitioned")
            >>> machine.register_listener(on_transition)
        """
        self._listeners.append(listener)

    def _check_transition_allowed(
        self, 
        asset_id: str, 
        from_status: AssetStatus, 
        to_status: AssetStatus
    ) -> bool:
        """
        检查状态转换是否被允许
        
        内部方法，验证状态转换是否符合预定义规则且通过所有守卫函数。
        
        Args:
            asset_id: 资产ID
            from_status: 当前状态
            to_status: 目标状态
        
        Returns:
            bool: 如果允许转换返回 True，否则返回 False
        """
        # 检查预定义规则
        if to_status not in self.ALLOWED_TRANSITIONS.get(from_status, []):
            return False
        
        # 执行守卫函数
        for guard in self._guards:
            if not guard(self, from_status, to_status):
                return False
        
        return True

    def initialize_asset(self, asset_id: str, initial_status: AssetStatus = AssetStatus.IN_USE) -> None:
        """
        初始化资产状态
        
        为新资产设置初始状态。如果资产已存在，则覆盖其状态。
        
        Args:
            asset_id: 资产唯一标识
            initial_status: 初始状态，默认为 IN_USE
        
        Raises:
            ValueError: 当 asset_id 为空或 status 为终态时抛出
        """
        if not asset_id:
            raise ValueError("asset_id 不能为空")
        if initial_status == AssetStatus.RETIRED:
            raise ValueError("不能直接初始化为终态 RETIRED")
        
        self._states[asset_id] = initial_status

    def transition(
        self,
        asset_id: str,
        target_status: AssetStatus,
        triggered_by: str,
        reason: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> StateTransition:
        """
        执行资产状态转换
        
        将指定资产的状态转换到目标状态，同时记录转换历史并触发事件。
        
        Args:
            asset_id: 资产唯一标识
            target_status: 目标状态
            triggered_by: 触发者标识（用户ID或系统）
            reason: 转换原因/备注
            metadata: 附加元数据字典
        
        Returns:
            StateTransition: 状态转换记录对象
        
        Raises:
            ValueError: 当 asset_id 为空时抛出
            TransitionNotAllowedError: 当转换不被允许时抛出
            KeyError: 当资产未初始化时抛出
        """
        if not asset_id:
            raise ValueError("asset_id 不能为空")
        
        # 获取当前状态
        if asset_id not in self._states:
            raise KeyError(f"资产 {asset_id} 未初始化，请先调用 initialize_asset")
        
        current_status = self._states[asset_id]
        
        # 检查转换是否允许
        if not self._check_transition_allowed(asset_id, current_status, target_status):
            raise TransitionNotAllowedError(
                current_status,
                target_status,
                f"资产 {asset_id} 不允许从 {current_status.value} 转换到 {target_status.value}"
            )
        
        # 执行状态转换
        transition = StateTransition(
            asset_id=asset_id,
            from_status=current_status,
            to_status=target_status,
            triggered_by=triggered_by,
            reason=reason,
            metadata=metadata or {}
        )
        
        self._states[asset_id] = target_status
        self._history.append(transition)
        
        # 触发事件监听器
        for listener in self._listeners:
            try:
                listener(transition)
            except Exception as e:
                # 监听器异常不应阻止状态转换
                print(f"警告: 监听器执行失败: {e}")
        
        return transition

    def get_status(self, asset_id: str) -> AssetStatus:
        """
        获取资产的当前状态
        
        Args:
            asset_id: 资产唯一标识
        
        Returns:
            AssetStatus: 当前状态
        
        Raises:
            KeyError: 当资产未初始化时抛出
        """
        if asset_id not in self._states:
            raise KeyError(f"资产 {asset_id} 未初始化")
        return self._states[asset_id]

    def get_history(self, asset_id: Optional[str] = None) -> List[StateTransition]:
        """
        获取状态转换历史
        
        Args:
            asset_id: 可选，资产ID。如果提供则只返回该资产的记录，
                     否则返回所有资产的历史记录。
        
        Returns:
            List[StateTransition]: 状态转换记录列表，按时间顺序排列
        """
        if asset_id:
            return [t for t in self._history if t.asset_id == asset_id]
        return self._history.copy()

    def get_allowed_transitions(self, asset_id: str) -> List[AssetStatus]:
        """
        获取资产可用的目标状态列表
        
        Args:
            asset_id: 资产唯一标识
        
        Returns:
            List[AssetStatus]: 可转换到的状态列表
        
        Raises:
            KeyError: 当资产未初始化时抛出
        """
        if asset_id not in self._states:
            raise KeyError(f"资产 {asset_id} 未初始化")
        
        current = self._states[asset_id]
        return self.ALLOWED_TRANSITIONS.get(current, [])

    def is_retired(self, asset_id: str) -> bool:
        """
        检查资产是否已退役
        
        Args:
            asset_id: 资产唯一标识
        
        Returns:
            bool: 如果资产处于 RETIRED 状态返回 True
        """
        return self.get_status(asset_id) == AssetStatus.RETIRED

    def can_retire(self, asset_id: str) -> bool:
        """
        检查资产是否可以发起退役申请
        
        Args:
            asset_id: 资产唯一标识
        
        Returns:
            bool: 如果资产可以转换到 PENDING_RETIREMENT 状态返回 True
        """
        try:
            current = self.get_status(asset_id)
            return AssetStatus.PENDING_RETIREMENT in self.ALLOWED_TRANSITIONS.get(current, [])
        except KeyError:
            return False


class RetirementWorkflow:
    """
    退役审批工作流 - 封装完整的报废申请审批链
    
    负责管理资产退役申请的生命周期，包括：
    - 创建退役申请
    - 审批通过/拒绝
    - 历史记录持久化
    
    Attributes:
        state_machine: 底层状态机实例
        _requests: 退役申请映射表
    """
    
    def __init__(self, state_machine: Optional[AssetStateMachine] = None):
        """
        初始化退役工作流
        
        Args:
            state_machine: 可选，指定的资产状态机。如果为 None，则创建新实例。
        """
        self.state_machine = state_machine or AssetStateMachine()
        self._requests: Dict[str, RetirementRequest] = {}

    def submit_retirement_application(
        self,
        asset_id: str,
        applicant: str,
        reason: str
    ) -> RetirementRequest:
        """
        提交资产退役申请
        
        创建新的退役申请并触发状态转换。
        
        Args:
            asset_id: 资产ID
            applicant: 申请人用户ID
            reason: 退役原因
        
        Returns:
            RetirementRequest: 创建的退役申请对象
        
        Raises:
            TransitionNotAllowedError: 当资产不允许退役时抛出
        """
        # 初始化资产（如未初始化）
        if asset_id not in self.state_machine._states:
            self.state_machine.initialize_asset(asset_id)
        
        # 执行状态转换
        self.state_machine.transition(
            asset_id=asset_id,
            target_status=AssetStatus.PENDING_RETIREMENT,
            triggered_by=applicant,
            reason=f"退役申请: {reason}"
        )
        
        # 创建申请记录
        request = RetirementRequest(
            request_id=f"REQ-{len(self._requests) + 1}",
            asset_id=asset_id,
            applicant=applicant,
            reason=reason
        )
        self._requests[request.request_id] = request
        return request

    def approve_retirement(
        self,
        request_id: str,
        approver: str,
        remarks: str = ""
    ) -> RetirementRequest:
        """
        审批通过退役申请
        
        Args:
            request_id: 申请ID
            approver: 审批人用户ID
            remarks: 审批备注
        
        Returns:
            RetirementRequest: 更新后的申请对象
        
        Raises:
            KeyError: 当申请不存在时抛出
            TransitionNotAllowedError: 当状态不允许转换时抛出
        """
        if request_id not in self._requests:
            raise KeyError(f"申请 {request_id} 不存在")
        
        request = self._requests[request_id]
        
        # 执行状态转换到 RETIRED
        self.state_machine.transition(
            asset_id=request.asset_id,
            target_status=AssetStatus.RETIRED,
            triggered_by=approver,
            reason=f"退役审批通过: {remarks}"
        )
        
        # 更新申请记录
        request.status = "APPROVED"
        request.approved_by = approver
        request.approved_at = datetime.now()
        request.remarks = remarks
        
        return request

    def reject_retirement(
        self,
        request_id: str,
        rejector: str,
        remarks: str = ""
    ) -> RetirementRequest:
        """
        拒绝退役申请
        
        Args:
            request_id: 申请ID
            rejector: 拒绝操作人用户ID
            remarks: 拒绝原因
        
        Returns:
            RetirementRequest: 更新后的申请对象
        
        Raises:
            KeyError: 当申请不存在时抛出
            TransitionNotAllowedError: 当状态不允许转换时抛出
        """
        if request_id not in self._requests:
            raise KeyError(f"申请 {request_id} 不存在")
        
        request = self._requests[request_id]
        
        # 执行状态转换到 REJECTED，然后回归 IN_USE
        self.state_machine.transition(
            asset_id=request.asset_id,
            target_status=AssetStatus.REJECTED,
            triggered_by=rejector,
            reason=f"退役申请被拒绝: {remarks}"
        )
        
        # 资产回归使用状态
        self.state_machine.transition(
            asset_id=request.asset_id,
            target_status=AssetStatus.IN_USE,
            triggered_by=rejector,
            reason="拒绝后资产回归使用状态"
        )
        
        # 更新申请记录
        request.status = "REJECTED"
        request.approved_by = rejector
        request.approved_at = datetime.now()
        request.remarks = remarks
        
        return request

    def get_request(self, request_id: str) -> Optional[RetirementRequest]:
        """
        获取退役申请详情
        
        Args:
            request_id: 申请ID
        
        Returns:
            RetirementRequest: 申请对象，如果不存在返回 None
        """
        return self._requests.get(request_id)

    def get_requests_by_asset(self, asset_id: str) -> List[RetirementRequest]:
        """
        获取资产的所有退役申请
        
        Args:
            asset_id: 资产ID
        
        Returns:
            List[RetirementRequest]: 申请列表
        """
        return [r for r in self._requests.values() if r.asset_id == asset_id]