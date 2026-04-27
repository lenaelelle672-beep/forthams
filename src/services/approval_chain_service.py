"""
审批链服务模块 (approval_chain_service.py)

本模块实现资产报废退役流程的审批链引擎，包括：
- 状态流转核心逻辑
- 审批链配置与路由
- 持久化事件存储与查询接口

边界约束：
- 状态迁移必须满足确定性（给定输入与上下文，输出状态唯一）
- 审批链不可绕过；任一审批拒绝即终止流程并标记为"已否决"
- 历史记录写入与状态变更需原子化，确保一致性
- 所有接口需兼容现有资产目录数据结构
- 性能：单流程实例处理延迟 ≤ 200ms（P95）
- 安全：审批操作需基于 RBAC 校验权限
"""

from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid
import threading
from collections import defaultdict


class ApprovalStatus(str, Enum):
    """
    审批流程状态枚举
    
    定义审批链中可能出现的所有状态
    """
    PENDING = "待审批"          # 等待审批
    APPROVED = "已批准"        # 审批通过
    REJECTED = "已否决"        # 审批拒绝
    RETIRED = "已退役"          # 资产已退役
    WITHDRAWN = "已撤回"        # 申请人撤回


class ApprovalRole(str, Enum):
    """
    审批角色枚举
    
    定义审批链中的角色层级
    """
    APPLICANT = "申请人"       # 发起申请的用户
    REVIEWER = "审批人"        # 初级审批人
    APPROVER = "终审人"        # 终审决策者
    ADMIN = "管理员"           # 系统管理员


class RetirementStatus(str, Enum):
    """
    资产退役状态枚举
    
    定义资产从在用到报废的完整生命周期状态
    """
    IN_USE = "在用"            # 正常使用状态
    PENDING_RETIREMENT = "待退役"  # 申请退役中
    APPROVAL_IN_PROGRESS = "审批中"  # 审批流程进行中
    APPROVED_PENDING_DISPOSAL = "待处置"  # 审批通过，等待处置
    RETIRED = "已退役"         # 退役完成
    SCRAPPED = "已报废"        # 已完成报废处理


@dataclass
class ApprovalNode:
    """
    审批节点数据模型
    
    表示审批链中的一个节点，包含节点ID、审批角色、审批人等信息
    """
    node_id: str
    role: ApprovalRole
    approver_id: Optional[str] = None
    status: ApprovalStatus = ApprovalStatus.PENDING
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ApprovalEvent:
    """
    审批事件数据模型（事件溯源）
    
    不可变的事件记录，用于追踪所有状态变更
    """
    event_id: str
    asset_id: str
    process_id: str
    event_type: str
    from_status: Optional[str]
    to_status: str
    actor_id: str
    actor_role: ApprovalRole
    comment: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        将事件转换为字典格式
        
        Returns:
            Dict[str, Any]: 事件数据字典
        """
        return {
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "process_id": self.process_id,
            "event_type": self.event_type,
            "from_status": self.from_status,
            "to_status": self.to_status,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role.value if isinstance(self.actor_role, ApprovalRole) else self.actor_role,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class RetirementProcess:
    """
    退役申请流程实例
    
    管理单个资产退役申请的完整生命周期
    """
    process_id: str
    asset_id: str
    applicant_id: str
    current_status: RetirementStatus
    approval_chain: List[ApprovalNode]
    current_node_index: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    events: List[ApprovalEvent] = field(default_factory=list)
    
    def get_current_approver(self) -> Optional[ApprovalNode]:
        """
        获取当前待处理的审批节点
        
        Returns:
            Optional[ApprovalNode]: 当前审批节点，若流程已结束则返回None
        """
        if self.current_node_index < len(self.approval_chain):
            return self.approval_chain[self.current_node_index]
        return None
    
    def is_completed(self) -> bool:
        """
        检查流程是否已完成
        
        Returns:
            bool: 若流程已结束则返回True
        """
        return self.current_status in [
            RetirementStatus.RETIRED,
            RetirementStatus.SCRAPPED
        ]


class StateTransitionError(Exception):
    """
    状态转换异常
    
    当发生非法状态迁移时抛出
    """
    def __init__(self, message: str, from_status: str, to_status: str):
        super().__init__(message)
        self.from_status = from_status
        self.to_status = to_status


class ApprovalChainError(Exception):
    """
    审批链异常
    
    当审批流程发生错误时抛出
    """
    pass


class PermissionDeniedError(ApprovalChainError):
    """
    权限不足异常
    
    当用户权限不足时抛出
    """
    pass


@dataclass
class TransitionRule:
    """
    状态迁移规则
    
    定义合法状态迁移的条件和约束
    """
    from_status: RetirementStatus
    to_status: RetirementStatus
    guard: Optional[Callable[['RetirementProcess', Dict[str, Any]], bool]] = None
    required_role: Optional[ApprovalRole] = None


class RetirementStateMachine:
    """
    退役状态机
    
    管理资产退役流程的状态迁移逻辑
    """
    
    # 定义所有合法的状态迁移规则
    VALID_TRANSITIONS: Dict[RetirementStatus, List[RetirementStatus]] = {
        RetirementStatus.IN_USE: [RetirementStatus.PENDING_RETIREMENT],
        RetirementStatus.PENDING_RETIREMENT: [
            RetirementStatus.APPROVAL_IN_PROGRESS,
            RetirementStatus.IN_USE  # 撤回
        ],
        RetirementStatus.APPROVAL_IN_PROGRESS: [
            RetirementStatus.APPROVED_PENDING_DISPOSAL,
            RetirementStatus.REJECTED
        ],
        RetirementStatus.APPROVED_PENDING_DISPOSAL: [
            RetirementStatus.RETIRED,
            RetirementStatus.SCRAPPED
        ],
        RetirementStatus.REJECTED: [RetirementStatus.IN_USE],  # 可重新申请
        RetirementStatus.RETIRED: [],  # 终态
        RetirementStatus.SCRAPPED: [],  # 终态
    }
    
    def __init__(self):
        """
        初始化状态机
        """
        self._rules: List[TransitionRule] = []
        self._initialize_default_rules()
    
    def _initialize_default_rules(self) -> None:
        """
        初始化默认迁移规则
        
        设置标准退役流程的默认规则
        """
        # 发起退役申请
        self._rules.append(TransitionRule(
            from_status=RetirementStatus.IN_USE,
            to_status=RetirementStatus.PENDING_RETIREMENT,
            required_role=ApprovalRole.APPLICANT
        ))
        
        # 进入审批流程
        self._rules.append(TransitionRule(
            from_status=RetirementStatus.PENDING_RETIREMENT,
            to_status=RetirementStatus.APPROVAL_IN_PROGRESS,
            required_role=ApprovalRole.APPLICANT
        ))
        
        # 审批通过
        self._rules.append(TransitionRule(
            from_status=RetirementStatus.APPROVAL_IN_PROGRESS,
            to_status=RetirementStatus.APPROVED_PENDING_DISPOSAL,
            required_role=ApprovalRole.APPROVER
        ))
        
        # 审批拒绝
        self._rules.append(TransitionRule(
            from_status=RetirementStatus.APPROVAL_IN_PROGRESS,
            to_status=RetirementStatus.REJECTED,
            required_role=ApprovalRole.REVIEWER
        ))
        
        # 完成退役
        self._rules.append(TransitionRule(
            from_status=RetirementStatus.APPROVED_PENDING_DISPOSAL,
            to_status=RetirementStatus.RETIRED,
            required_role=ApprovalRole.APPROVER
        ))
    
    def validate_transition(
        self,
        process: RetirementProcess,
        to_status: RetirementStatus,
        context: Dict[str, Any]
    ) -> bool:
        """
        验证状态迁移是否合法
        
        Args:
            process: 退役流程实例
            to_status: 目标状态
            context: 迁移上下文
            
        Returns:
            bool: 如果迁移合法返回True
            
        Raises:
            StateTransitionError: 如果迁移不合法
        """
        from_status = process.current_status
        
        # 检查是否在有效转换列表中
        valid_targets = self.VALID_TRANSITIONS.get(from_status, [])
        if to_status not in valid_targets:
            raise StateTransitionError(
                f"非法状态迁移: {from_status.value} -> {to_status.value}",
                from_status.value,
                to_status.value
            )
        
        # 检查是否有自定义守卫规则
        for rule in self._rules:
            if rule.from_status == from_status and rule.to_status == to_status:
                if rule.guard and not rule.guard(process, context):
                    raise StateTransitionError(
                        f"状态迁移守卫检查失败: {from_status.value} -> {to_status.value}",
                        from_status.value,
                        to_status.value
                    )
        
        return True
    
    def get_valid_next_states(self, current_status: RetirementStatus) -> List[RetirementStatus]:
        """
        获取当前状态的合法下一状态
        
        Args:
            current_status: 当前状态
            
        Returns:
            List[RetirementStatus]: 合法目标状态列表
        """
        return self.VALID_TRANSITIONS.get(current_status, [])


class EventStore:
    """
    事件存储层（事件溯源）
    
    负责持久化所有审批事件，确保不可篡改
    """
    
    def __init__(self):
        """
        初始化事件存储
        """
        self._events: List[ApprovalEvent] = []
        self._lock = threading.RLock()
        self._index_by_asset: Dict[str, List[str]] = defaultdict(list)
        self._index_by_process: Dict[str, List[str]] = defaultdict(list)
    
    def append(self, event: ApprovalEvent) -> None:
        """
        追加新事件（原子化操作）
        
        Args:
            event: 待追加的事件
        """
        with self._lock:
            self._events.append(event)
            self._index_by_asset[event.asset_id].append(event.event_id)
            self._index_by_process[event.process_id].append(event.event_id)
    
    def get_events_by_asset(
        self,
        asset_id: str,
        limit: Optional[int] = None
    ) -> List[ApprovalEvent]:
        """
        获取指定资产的所有事件
        
        Args:
            asset_id: 资产ID
            limit: 返回数量限制
            
        Returns:
            List[ApprovalEvent]: 按时间排序的事件列表
        """
        with self._lock:
            event_ids = self._index_by_asset.get(asset_id, [])
            events = [self._find_event(eid) for eid in event_ids]
            events = [e for e in events if e is not None]
            events.sort(key=lambda x: x.timestamp)
            if limit:
                events = events[-limit:]
            return events
    
    def get_events_by_process(self, process_id: str) -> List[ApprovalEvent]:
        """
        获取指定流程的所有事件
        
        Args:
            process_id: 流程ID
            
        Returns:
            List[ApprovalEvent]: 按时间排序的事件列表
        """
        with self._lock:
            event_ids = self._index_by_process.get(process_id, [])
            events = [self._find_event(eid) for eid in event_ids]
            events = [e for e in events if e is not None]
            events.sort(key=lambda x: x.timestamp)
            return events
    
    def _find_event(self, event_id: str) -> Optional[ApprovalEvent]:
        """
        根据ID查找事件
        
        Args:
            event_id: 事件ID
            
        Returns:
            Optional[ApprovalEvent]: 找到的事件或None
        """
        for event in self._events:
            if event.event_id == event_id:
                return event
        return None
    
    def get_event_history(
        self,
        asset_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[ApprovalEvent]:
        """
        获取资产事件历史（带时间范围过滤）
        
        Args:
            asset_id: 资产ID
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            List[ApprovalEvent]: 过滤后的事件列表
        """
        events = self.get_events_by_asset(asset_id)
        if start_time:
            events = [e for e in events if e.timestamp >= start_time]
        if end_time:
            events = [e for e in events if e.timestamp <= end_time]
        return events


class RBACValidator:
    """
    RBAC权限校验器
    
    基于角色的访问控制，确保最小权限原则
    """
    
    def __init__(self):
        """
        初始化权限校验器
        """
        self._role_permissions: Dict[ApprovalRole, set] = {
            ApprovalRole.APPLICANT: {"create_retirement", "withdraw_retirement", "view_history"},
            ApprovalRole.REVIEWER: {"approve_step", "reject_step", "view_history", "view_pending"},
            ApprovalRole.APPROVER: {"approve_step", "reject_step", "approve_final", "view_history", "view_pending"},
            ApprovalRole.ADMIN: {"*"},  # 管理员拥有所有权限
        }
    
    def check_permission(
        self,
        role: ApprovalRole,
        permission: str
    ) -> bool:
        """
        检查角色是否具有指定权限
        
        Args:
            role: 审批角色
            permission: 权限标识
            
        Returns:
            bool: 是否具有权限
        """
        role_perms = self._role_permissions.get(role, set())
        return "*" in role_perms or permission in role_perms
    
    def validate_approval_permission(
        self,
        role: ApprovalRole,
        node: ApprovalNode,
        actor_id: str
    ) -> bool:
        """
        验证审批操作权限
        
        Args:
            role: 操作者角色
            node: 目标审批节点
            actor_id: 操作者ID
            
        Returns:
            bool: 是否有权操作
            
        Raises:
            PermissionDeniedError: 权限不足时抛出
        """
        # 检查是否为当前节点的处理人
        if node.approver_id and node.approver_id != actor_id:
            # 如果不是指定审批人，检查角色权限
            if not self.check_permission(role, "view_pending"):
                raise PermissionDeniedError(
                    f"用户 {actor_id} 无权处理此审批节点"
                )
        
        # 检查角色是否有审批权限
        if not self.check_permission(role, "approve_step"):
            raise PermissionDeniedError(
                f"角色 {role.value} 缺少审批权限"
            )
        
        return True


class ApprovalChainService:
    """
    审批链服务主类
    
    实现报废申请审批链的核心逻辑，支持多角色按层级顺序审批与回退
    """
    
    def __init__(self):
        """
        初始化审批链服务
        """
        self.state_machine = RetirementStateMachine()
        self.event_store = EventStore()
        self.rbac_validator = RBACValidator()
        self._processes: Dict[str, RetirementProcess] = {}
        self._lock = threading.RLock()
        self._default_chain_config: List[Dict[str, Any]] = [
            {"role": ApprovalRole.REVIEWER, "level": 1},
            {"role": ApprovalRole.APPROVER, "level": 2},
        ]
    
    def create_retirement_application(
        self,
        asset_id: str,
        applicant_id: str,
        reason: str,
        chain_config: Optional[List[Dict[str, Any]]] = None
    ) -> RetirementProcess:
        """
        创建退役申请
        
        Args:
            asset_id: 资产ID
            applicant_id: 申请人ID
            reason: 申请原因
            chain_config: 自定义审批链配置
            
        Returns:
            RetirementProcess: 创建的流程实例
            
        Raises:
            ApprovalChainError: 创建失败时抛出
        """
        process_id = str(uuid.uuid4())
        
        # 构建审批链
        config = chain_config or self._default_chain_config
        approval_chain = []
        for i, node_config in enumerate(config):
            node = ApprovalNode(
                node_id=f"{process_id}_node_{i}",
                role=ApprovalRole(node_config["role"]) if isinstance(node_config["role"], str) else node_config["role"],
                approver_id=node_config.get("approver_id")
            )
            approval_chain.append(node)
        
        # 创建流程实例
        process = RetirementProcess(
            process_id=process_id,
            asset_id=asset_id,
            applicant_id=applicant_id,
            current_status=RetirementStatus.IN_USE,
            approval_chain=approval_chain
        )
        
        with self._lock:
            self._processes[process_id] = process
        
        # 记录创建事件
        self._record_event(
            process=process,
            event_type="APPLICATION_CREATED",
            from_status=None,
            to_status=RetirementStatus.PENDING_RETIREMENT.value,
            actor_id=applicant_id,
            actor_role=ApprovalRole.APPLICANT,
            comment=reason,
            metadata={"reason": reason}
        )
        
        return process
    
    def submit_for_approval(
        self,
        process_id: str,
        actor_id: str,
        actor_role: ApprovalRole = ApprovalRole.APPLICANT
    ) -> RetirementProcess:
        """
        提交申请进入审批流程
        
        Args:
            process_id: 流程ID
            actor_id: 操作者ID
            actor_role: 操作者角色
            
        Returns:
            RetirementProcess: 更新后的流程实例
        """
        with self._lock:
            process = self._processes.get(process_id)
            if not process:
                raise ApprovalChainError(f"流程不存在: {process_id}")
            
            # 验证权限
            self.rbac_validator.check_permission(actor_role, "create_retirement")
            
            # 状态转换
            self.state_machine.validate_transition(
                process,
                RetirementStatus.PENDING_RETIREMENT,
                {"actor_id": actor_id}
            )
            
            old_status = process.current_status
            process.current_status = RetirementStatus.PENDING_RETIREMENT
            process.updated_at = datetime.now()
            
            # 记录事件
            self._record_event(
                process=process,
                event_type="SUBMITTED_FOR_APPROVAL",
                from_status=old_status.value,
                to_status=RetirementStatus.PENDING_RETIREMENT.value,
                actor_id=actor_id,
                actor_role=actor_role
            )
            
            return process
    
    def approve_step(
        self,
        process_id: str,
        actor_id: str,
        actor_role: ApprovalRole,
        comment: Optional[str] = None
    ) -> RetirementProcess:
        """
        审批通过当前节点
        
        Args:
            process_id: 流程ID
            actor_id: 审批人ID
            actor_role: 审批人角色
            comment: 审批意见
            
        Returns:
            RetirementProcess: 更新后的流程实例
            
        Raises:
            PermissionDeniedError: 权限不足
            ApprovalChainError: 审批失败
        """
        with self._lock:
            process = self._processes.get(process_id)
            if not process:
                raise ApprovalChainError(f"流程不存在: {process_id}")
            
            current_node = process.get_current_approver()
            if not current_node:
                raise ApprovalChainError("当前没有待审批的节点")
            
            # 权限校验
            self.rbac_validator.validate_approval_permission(
                actor_role,
                current_node,
                actor_id
            )
            
            # 更新节点状态
            current_node.status = ApprovalStatus.APPROVED
            current_node.decided_at = datetime.now()
            current_node.comment = comment
            
            # 推进到下一个节点
            process.current_node_index += 1
            
            old_status = process.current_status
            
            # 判断是否所有审批节点都已通过
            if process.current_node_index >= len(process.approval_chain):
                # 全部审批通过，进入待处置状态
                process.current_status = RetirementStatus.APPROVED_PENDING_DISPOSAL
                event_type = "FINAL_APPROVAL_COMPLETED"
            else:
                # 进入下一级审批
                process.current_status = RetirementStatus.APPROVAL_IN_PROGRESS
                event_type = "STEP_APPROVED"
            
            process.updated_at = datetime.now()
            
            # 记录事件
            self._record_event(
                process=process,
                event_type=event_type,
                from_status=old_status.value,
                to_status=process.current_status.value,
                actor_id=actor_id,
                actor_role=actor_role,
                comment=comment,
                metadata={
                    "node_id": current_node.node_id,
                    "next_node_index": process.current_node_index
                }
            )
            
            return process
    
    def reject_step(
        self,
        process_id: str,
        actor_id: str,
        actor_role: ApprovalRole,
        comment: Optional[str] = None
    ) -> RetirementProcess:
        """
        拒绝当前审批节点（终止流程）
        
        Args:
            process_id: 流程ID
            actor_id: 审批人ID
            actor_role: 审批人角色
            comment: 拒绝原因
            
        Returns:
            RetirementProcess: 更新后的流程实例
            
        Raises:
            PermissionDeniedError: 权限不足
            ApprovalChainError: 拒绝失败
        """
        with self._lock:
            process = self._processes.get(process_id)
            if not process:
                raise ApprovalChainError(f"流程不存在: {process_id}")
            
            current_node = process.get_current_approver()
            if not current_node:
                raise ApprovalChainError("当前没有待审批的节点")
            
            # 权限校验
            self.rbac_validator.validate_approval_permission(
                actor_role,
                current_node,
                actor_id
            )
            
            # 更新节点状态
            current_node.status = ApprovalStatus.REJECTED
            current_node.decided_at = datetime.now()
            current_node.comment = comment
            
            old_status = process.current_status
            
            # 拒绝即终止流程，标记为已否决
            process.current_status = RetirementStatus.REJECTED
            process.updated_at = datetime.now()
            
            # 记录事件
            self._record_event(
                process=process,
                event_type="PROCESS_REJECTED",
                from_status=old_status.value,
                to_status=RetirementStatus.REJECTED.value,
                actor_id=actor_id,
                actor_role=actor_role,
                comment=comment,
                metadata={"rejected_node_id": current_node.node_id}
            )
            
            return process
    
    def complete_retirement(
        self,
        process_id: str,
        actor_id: str,
        actor_role: ApprovalRole,
        disposal_type: str = "RETIRED"
    ) -> RetirementProcess:
        """
        完成退役处置
        
        Args:
            process_id: 流程ID
            actor_id: 操作者ID
            actor_role: 操作者角色
            disposal_type: 处置类型（RETIRED/SCRAPPED）
            
        Returns:
            RetirementProcess: 更新后的流程实例
        """
        with self._lock:
            process = self._processes.get(process_id)
            if not process:
                raise ApprovalChainError(f"流程不存在: {process_id}")
            
            # 验证当前状态
            if process.current_status != RetirementStatus.APPROVED_PENDING_DISPOSAL:
                raise ApprovalChainError(
                    f"当前状态不可执行退役: {process.current_status.value}"
                )
            
            # 权限校验
            self.rbac_validator.check_permission(actor_role, "approve_final")
            
            old_status = process.current_status
            
            # 根据处置类型设置最终状态
            if disposal_type == "SCRAPPED":
                process.current_status = RetirementStatus.SCRAPPED
            else:
                process.current_status = RetirementStatus.RETIRED
            
            process.updated_at = datetime.now()
            
            # 记录事件
            self._record_event(
                process=process,
                event_type="RETIREMENT_COMPLETED",
                from_status=old_status.value,
                to_status=process.current_status.value,
                actor_id=actor_id,
                actor_role=actor_role,
                metadata={"disposal_type": disposal_type}
            )
            
            return process
    
    def withdraw_application(
        self,
        process_id: str,
        actor_id: str
    ) -> RetirementProcess:
        """
        申请人撤回申请
        
        Args:
            process_id: 流程ID
            actor_id: 申请人ID
            
        Returns:
            RetirementProcess: 更新后的流程实例
        """
        with self._lock:
            process = self._processes.get(process_id)
            if not process:
                raise ApprovalChainError(f"流程不存在: {process_id}")
            
            # 只能申请人撤回
            if process.applicant_id != actor_id:
                raise PermissionDeniedError("只有申请人可以撤回申请")
            
            # 只有在待审批状态下才能撤回
            if process.current_status not in [
                RetirementStatus.PENDING_RETIREMENT,
                RetirementStatus.APPROVAL_IN_PROGRESS
            ]:
                raise ApprovalChainError("当前状态不允许撤回")
            
            old_status = process.current_status
            
            # 返回在用状态
            process.current_status = RetirementStatus.IN_USE
            process.updated_at = datetime.now()
            
            # 记录事件
            self._record_event(
                process=process,
                event_type="APPLICATION_WITHDRAWN",
                from_status=old_status.value,
                to_status=RetirementStatus.IN_USE.value,
                actor_id=actor_id,
                actor_role=ApprovalRole.APPLICANT
            )
            
            return process
    
    def get_process(self, process_id: str) -> Optional[RetirementProcess]:
        """
        获取流程实例
        
        Args:
            process_id: 流程ID
            
        Returns:
            Optional[RetirementProcess]: 流程实例
        """
        with self._lock:
            return self._processes.get(process_id)
    
    def get_process_by_asset(self, asset_id: str) -> Optional[RetirementProcess]:
        """
        根据资产ID获取流程实例
        
        Args:
            asset_id: 资产ID
            
        Returns:
            Optional[RetirementProcess]: 流程实例
        """
        with self._lock:
            for process in self._processes.values():
                if process.asset_id == asset_id and not process.is_completed():
                    return process
            return None
    
    def get_history(
        self,
        asset_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        获取资产历史记录
        
        Args:
            asset_id: 资产ID
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            List[Dict[str, Any]]: 按时间排序的事件列表
        """
        events = self.event_store.get_event_history(
            asset_id,
            start_time,
            end_time
        )
        return [event.to_dict() for event in events]
    
    def _record_event(
        self,
        process: RetirementProcess,
        event_type: str,
        from_status: Optional[str],
        to_status: str,
        actor_id: str,
        actor_role: ApprovalRole,
        comment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ApprovalEvent:
        """
        记录事件（原子化操作）
        
        Args:
            process: 流程实例
            event_type: 事件类型
            from_status: 原状态
            to_status: 目标状态
            actor_id: 操作者ID
            actor_role: 操作者角色
            comment: 备注
            metadata: 额外数据
            
        Returns:
            ApprovalEvent: 创建的事件
        """
        event = ApprovalEvent(
            event_id=str(uuid.uuid4()),
            asset_id=process.asset_id,
            process_id=process.process_id,
            event_type=event_type,
            from_status=from_status,
            to_status=to_status,
            actor_id=actor_id,
            actor_role=actor_role,
            comment=comment,
            metadata=metadata or {}
        )
        
        # 事件写入与状态变更原子化
        self.event_store.append(event)
        process.events.append(event)
        
        return event
    
    def validate_state_transition(
        self,
        from_status: RetirementStatus,
        to_status: RetirementStatus
    ) -> bool:
        """
        验证状态迁移是否合法（公共接口，供单元测试使用）
        
        Args:
            from_status: 原状态
            to_status: 目标状态
            
        Returns:
            bool: 是否合法
            
        Raises:
            StateTransitionError: 非法迁移
        """
        valid_targets = self.state_machine.VALID_TRANSITIONS.get(from_status, [])
        if to_status not in valid_targets:
            raise StateTransitionError(
                f"非法状态迁移: {from_status.value} -> {to_status.value}",
                from_status.value,
                to_status.value
            )
        return True


# 单例模式，全局共享服务实例
_service_instance: Optional[ApprovalChainService] = None
_instance_lock = threading.Lock()


def get_approval_chain_service() -> ApprovalChainService:
    """
    获取审批链服务单例实例
    
    Returns:
        ApprovalChainService: 服务实例
    """
    global _service_instance
    if _service_instance is None:
        with _instance_lock:
            if _service_instance is None:
                _service_instance = ApprovalChainService()
    return _service_instance


def reset_service() -> None:
    """
    重置服务实例（用于测试）
    """
    global _service_instance
    with _instance_lock:
        _service_instance = None