"""
资产报废服务模块 (Scrap Service Module)

实现资产从在用到报废的完整生命周期状态流转引擎，包括:
- 报废申请审批链管理
- 状态迁移引擎
- 历史记录持久化

Phase 3: 流程引擎与审批链实现
交付物: 状态流转核心逻辑、审批链配置与路由、持久化事件存储与查询接口
"""

import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from uuid import uuid4

logger = logging.getLogger(__name__)


class AssetStatus(str, Enum):
    """
    资产状态枚举
    
    状态流转路径:
    IN_USE -> IDLE -> RETIREMENT_PENDING -> APPROVED -> RETIRED
                                   |
                                   v
                               REJECTED
    """
    IN_USE = "IN_USE"                  # 在用
    IDLE = "IDLE"                     # 闲置
    RETIREMENT_PENDING = "RETIREMENT_PENDING"  # 退役待审批
    APPROVED = "APPROVED"             # 已批准
    REJECTED = "REJECTED"             # 已否决
    RETIRED = "RETIRED"               # 已退役


class ApprovalRole(str, Enum):
    """审批角色枚举"""
    APPLICANT = "APPLICANT"           # 申请人
    APPROVER = "APPROVER"             # 审批人
    FINAL_APPROVER = "FINAL_APPROVER" # 终审人


class ScrapError(Exception):
    """报废服务基础异常"""
    pass


class StateTransitionError(ScrapError):
    """状态迁移错误"""
    def __init__(self, message: str, current_state: AssetStatus, target_state: AssetStatus):
        self.current_state = current_state
        self.target_state = target_state
        super().__init__(message)


class ApprovalChainError(ScrapError):
    """审批链错误"""
    pass


class PermissionDeniedError(ScrapError):
    """权限拒绝错误"""
    pass


@dataclass
class ScrapEvent:
    """
    报废事件记录
    
    用于事件溯源，保证状态变更可追溯、不可篡改
    """
    event_id: str
    asset_id: str
    event_type: str
    from_state: Optional[str]
    to_state: Optional[str]
    actor: str
    role: str
    comment: Optional[str]
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "event_type": self.event_type,
            "from_state": self.from_state,
            "to_state": self.to_state,
            "actor": self.actor,
            "role": self.role,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class RetirementRequest:
    """
    退役申请实体
    
    代表一个完整的资产退役申请流程实例
    """
    request_id: str
    asset_id: str
    applicant: str
    current_state: AssetStatus
    current_approval_stage: int
    approval_chain: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    reason: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "request_id": self.request_id,
            "asset_id": self.asset_id,
            "applicant": self.applicant,
            "current_state": self.current_state.value if isinstance(self.current_state, AssetStatus) else self.current_state,
            "current_approval_stage": self.current_approval_stage,
            "approval_chain": self.approval_chain,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "reason": self.reason
        }


class StateTransitionValidator:
    """
    状态转换验证器
    
    确保状态迁移满足确定性（给定输入与上下文，输出状态唯一）
    """
    
    # 合法的状态迁移路径映射
    VALID_TRANSITIONS: Dict[AssetStatus, List[AssetStatus]] = {
        AssetStatus.IN_USE: [AssetStatus.IDLE],
        AssetStatus.IDLE: [AssetStatus.IN_USE, AssetStatus.RETIREMENT_PENDING],
        AssetStatus.RETIREMENT_PENDING: [AssetStatus.APPROVED, AssetStatus.REJECTED],
        AssetStatus.APPROVED: [AssetStatus.RETIRED],
        AssetStatus.REJECTED: [],  # 被拒绝的申请不可继续迁移
        AssetStatus.RETIRED: [],   # 已退役状态为终态
    }
    
    @classmethod
    def can_transition(cls, from_state: AssetStatus, to_state: AssetStatus) -> bool:
        """
        检查是否可以从 from_state 迁移到 to_state
        
        Args:
            from_state: 当前状态
            to_state: 目标状态
            
        Returns:
            是否允许迁移
        """
        valid_targets = cls.VALID_TRANSITIONS.get(from_state, [])
        return to_state in valid_targets
    
    @classmethod
    def validate_transition(cls, from_state: AssetStatus, to_state: AssetStatus) -> None:
        """
        验证状态迁移，不合法则抛出异常
        
        Args:
            from_state: 当前状态
            to_state: 目标状态
            
        Raises:
            StateTransitionError: 当迁移不合法时
        """
        if not cls.can_transition(from_state, to_state):
            raise StateTransitionError(
                f"Invalid state transition from {from_state.value} to {to_state.value}",
                current_state=from_state,
                target_state=to_state
            )


class ApprovalChainManager:
    """
    审批链管理器
    
    支持多角色（申请人、审批人、终审人）按层级顺序审批与回退
    """
    
    # 审批阶段定义
    STAGES = [
        {"stage": 1, "role": ApprovalRole.APPROVER, "name": "部门审批"},
        {"stage": 2, "role": ApprovalRole.FINAL_APPROVER, "name": "财务终审"},
    ]
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        初始化审批链管理器
        
        Args:
            config: 可选的审批链配置
        """
        self.config = config or {}
        self.stages = self.config.get("stages", self.STAGES)
    
    def get_approval_chain(self, asset_id: str, applicant: str) -> List[Dict[str, Any]]:
        """
        获取指定资产的审批链配置
        
        Args:
            asset_id: 资产ID
            applicant: 申请人
            
        Returns:
            审批链节点列表
        """
        chain = []
        for stage_config in self.stages:
            chain.append({
                "stage": stage_config["stage"],
                "role": stage_config["role"].value,
                "name": stage_config["name"],
                "status": "PENDING",
                "approver": None,
                "approved_at": None,
                "comment": None
            })
        return chain
    
    def can_approve(self, request: RetirementRequest, user: str, user_role: str) -> bool:
        """
        检查用户是否有权审批当前阶段
        
        Args:
            request: 退役申请
            user: 用户ID
            user_role: 用户角色
            
        Returns:
            是否有权审批
        """
        if request.current_state != AssetStatus.RETIREMENT_PENDING:
            return False
        
        current_stage = request.current_approval_stage
        expected_role = self.stages[current_stage - 1]["role"] if current_stage <= len(self.stages) else None
        
        if expected_role and user_role == expected_role.value:
            return True
        return False
    
    def next_stage(self, request: RetirementRequest) -> Optional[int]:
        """
        获取下一个审批阶段
        
        Args:
            request: 退役申请
            
        Returns:
            下一阶段编号，如果已到最后阶段则返回None
        """
        next_stage_num = request.current_approval_stage + 1
        if next_stage_num > len(self.stages):
            return None
        return next_stage_num


class EventStore:
    """
    事件存储
    
    实现历史记录持久化，确保所有状态变更与操作轨迹可追溯、不可篡改
    """
    
    def __init__(self):
        """初始化事件存储（内存实现，生产环境应使用数据库）"""
        self._events: List[ScrapEvent] = []
    
    def append(self, event: ScrapEvent) -> None:
        """
        追加事件记录
        
        Args:
            event: 事件记录
        """
        self._events.append(event)
        logger.info(f"Event appended: {event.event_type} for asset {event.asset_id}")
    
    def get_events_by_asset(self, asset_id: str) -> List[ScrapEvent]:
        """
        获取指定资产的所有事件记录
        
        Args:
            asset_id: 资产ID
            
        Returns:
            按时间排序的事件列表
        """
        events = [e for e in self._events if e.asset_id == asset_id]
        return sorted(events, key=lambda x: x.timestamp)
    
    def get_event_by_request(self, request_id: str) -> List[ScrapEvent]:
        """
        获取指定申请的所有事件记录
        
        Args:
            request_id: 申请ID
            
        Returns:
            按时间排序的事件列表
        """
        events = [e for e in self._events if e.metadata.get("request_id") == request_id]
        return sorted(events, key=lambda x: x.timestamp)
    
    def clear(self) -> None:
        """清空所有事件（仅用于测试）"""
        self._events.clear()


class ScrapService:
    """
    资产报废服务
    
    提供用户接口以发起、查看、跟踪退役申请流程
    """
    
    def __init__(self, event_store: Optional[EventStore] = None):
        """
        初始化报废服务
        
        Args:
            event_store: 可选的事件存储实现
        """
        self.event_store = event_store or EventStore()
        self.approval_chain_manager = ApprovalChainManager()
        self._requests: Dict[str, RetirementRequest] = {}
    
    def create_retirement_request(
        self,
        asset_id: str,
        applicant: str,
        reason: str,
        asset_current_state: AssetStatus = AssetStatus.IDLE
    ) -> RetirementRequest:
        """
        创建退役申请
        
        Args:
            asset_id: 资产ID
            applicant: 申请人
            reason: 退役原因
            asset_current_state: 资产当前状态
            
        Returns:
            退役申请实例
            
        Raises:
            StateTransitionError: 当资产状态不允许发起退役申请时
        """
        # 验证资产状态是否可以发起退役申请
        if asset_current_state != AssetStatus.IDLE:
            raise StateTransitionError(
                f"Cannot create retirement request from state {asset_current_state.value}",
                current_state=asset_current_state,
                target_state=AssetStatus.RETIREMENT_PENDING
            )
        
        request_id = str(uuid4())
        now = datetime.utcnow()
        
        # 构建审批链
        approval_chain = self.approval_chain_manager.get_approval_chain(asset_id, applicant)
        
        request = RetirementRequest(
            request_id=request_id,
            asset_id=asset_id,
            applicant=applicant,
            current_state=AssetStatus.RETIREMENT_PENDING,
            current_approval_stage=1,
            approval_chain=approval_chain,
            created_at=now,
            updated_at=now,
            reason=reason
        )
        
        self._requests[request_id] = request
        
        # 记录事件
        event = ScrapEvent(
            event_id=str(uuid4()),
            asset_id=asset_id,
            event_type="RETIREMENT_REQUEST_CREATED",
            from_state=asset_current_state.value,
            to_state=AssetStatus.RETIREMENT_PENDING.value,
            actor=applicant,
            role=ApprovalRole.APPLICANT.value,
            comment=reason,
            timestamp=now,
            metadata={"request_id": request_id}
        )
        self.event_store.append(event)
        
        logger.info(f"Retirement request created: {request_id} for asset {asset_id}")
        return request
    
    def approve_step(
        self,
        request_id: str,
        approver: str,
        approver_role: str,
        comment: Optional[str] = None
    ) -> RetirementRequest:
        """
        审批流程下一步
        
        Args:
            request_id: 申请ID
            approver: 审批人
            approver_role: 审批人角色
            comment: 审批意见
            
        Returns:
            更新后的申请实例
            
        Raises:
            ApprovalChainError: 当审批操作不合法时
            PermissionDeniedError: 当审批人无权限时
        """
        request = self._requests.get(request_id)
        if not request:
            raise ApprovalChainError(f"Request not found: {request_id}")
        
        # 权限校验
        if not self.approval_chain_manager.can_approve(request, approver, approver_role):
            raise PermissionDeniedError(
                f"User {approver} with role {approver_role} cannot approve at stage {request.current_approval_stage}"
            )
        
        now = datetime.utcnow()
        
        # 更新审批链
        request.approval_chain[request.current_approval_stage - 1].update({
            "status": "APPROVED",
            "approver": approver,
            "approved_at": now.isoformat(),
            "comment": comment
        })
        
        # 检查是否还有下一阶段
        next_stage = self.approval_chain_manager.next_stage(request)
        
        if next_stage is None:
            # 审批完成，状态转为已批准
            old_state = request.current_state
            request.current_state = AssetStatus.APPROVED
            request.completed_at = now
            
            event_type = "RETIREMENT_APPROVED"
        else:
            # 进入下一审批阶段
            request.current_approval_stage = next_stage
            event_type = "APPROVAL_STAGE_ADVANCED"
        
        request.updated_at = now
        
        # 记录事件
        event = ScrapEvent(
            event_id=str(uuid4()),
            asset_id=request.asset_id,
            event_type=event_type,
            from_state=None,
            to_state=request.current_state.value,
            actor=approver,
            role=approver_role,
            comment=comment,
            timestamp=now,
            metadata={"request_id": request_id, "stage": request.current_approval_stage}
        )
        self.event_store.append(event)
        
        logger.info(f"Approval step processed: {event_type} for request {request_id}")
        return request
    
    def reject_request(
        self,
        request_id: str,
        rejector: str,
        rejector_role: str,
        reason: str
    ) -> RetirementRequest:
        """
        拒绝申请
        
        任一审批拒绝即终止流程并标记为"已否决"
        
        Args:
            request_id: 申请ID
            rejector: 拒绝人
            rejector_role: 拒绝人角色
            reason: 拒绝原因
            
        Returns:
            更新后的申请实例
            
        Raises:
            ApprovalChainError: 当操作不合法时
            PermissionDeniedError: 当拒绝人无权限时
        """
        request = self._requests.get(request_id)
        if not request:
            raise ApprovalChainError(f"Request not found: {request_id}")
        
        # 权限校验
        if not self.approval_chain_manager.can_approve(request, rejector, rejector_role):
            raise PermissionDeniedError(
                f"User {rejector} with role {rejector_role} cannot reject at stage {request.current_approval_stage}"
            )
        
        now = datetime.utcnow()
        
        # 更新审批链
        request.approval_chain[request.current_approval_stage - 1].update({
            "status": "REJECTED",
            "approver": rejector,
            "approved_at": now.isoformat(),
            "comment": reason
        })
        
        # 状态转为已否决
        request.current_state = AssetStatus.REJECTED
        request.completed_at = now
        request.updated_at = now
        
        # 记录事件
        event = ScrapEvent(
            event_id=str(uuid4()),
            asset_id=request.asset_id,
            event_type="RETIREMENT_REJECTED",
            from_state=AssetStatus.RETIREMENT_PENDING.value,
            to_state=AssetStatus.REJECTED.value,
            actor=rejector,
            role=rejector_role,
            comment=reason,
            timestamp=now,
            metadata={"request_id": request_id, "stage": request.current_approval_stage}
        )
        self.event_store.append(event)
        
        logger.info(f"Request rejected: {request_id}")
        return request
    
    def complete_retirement(
        self,
        request_id: str,
        operator: str
    ) -> RetirementRequest:
        """
        完成退役流程
        
        Args:
            request_id: 申请ID
            operator: 操作人
            
        Returns:
            更新后的申请实例
            
        Raises:
            StateTransitionError: 当状态不允许完成退役时
        """
        request = self._requests.get(request_id)
        if not request:
            raise StateTransitionError(
                f"Request not found: {request_id}",
                current_state=AssetStatus.IN_USE,  # dummy
                target_state=AssetStatus.RETIRED
            )
        
        # 验证状态
        StateTransitionValidator.validate_transition(request.current_state, AssetStatus.RETIRED)
        
        now = datetime.utcnow()
        old_state = request.current_state
        request.current_state = AssetStatus.RETIRED
        request.completed_at = now
        request.updated_at = now
        
        # 记录事件
        event = ScrapEvent(
            event_id=str(uuid4()),
            asset_id=request.asset_id,
            event_type="RETIREMENT_COMPLETED",
            from_state=old_state.value,
            to_state=AssetStatus.RETIRED.value,
            actor=operator,
            role="SYSTEM",
            comment="Asset retirement completed",
            timestamp=now,
            metadata={"request_id": request_id}
        )
        self.event_store.append(event)
        
        logger.info(f"Retirement completed: {request_id}")
        return request
    
    def get_request(self, request_id: str) -> Optional[RetirementRequest]:
        """
        获取申请详情
        
        Args:
            request_id: 申请ID
            
        Returns:
            申请实例，不存在则返回None
        """
        return self._requests.get(request_id)
    
    def get_request_by_asset(self, asset_id: str) -> Optional[RetirementRequest]:
        """
        获取资产对应的申请
        
        Args:
            asset_id: 资产ID
            
        Returns:
            申请实例
        """
        for request in self._requests.values():
            if request.asset_id == asset_id and request.current_state == AssetStatus.RETIREMENT_PENDING:
                return request
        return None
    
    def get_history(self, asset_id: str) -> List[Dict[str, Any]]:
        """
        获取资产的历史记录
        
        Args:
            asset_id: 资产ID
            
        Returns:
            按时间排序的事件列表
        """
        events = self.event_store.get_events_by_asset(asset_id)
        return [event.to_dict() for event in events]
    
    def get_request_history(self, request_id: str) -> List[Dict[str, Any]]:
        """
        获取申请的历史记录
        
        Args:
            request_id: 申请ID
            
        Returns:
            按时间排序的事件列表
        """
        events = self.event_store.get_event_by_request(request_id)
        return [event.to_dict() for event in events]
    
    def validate_approval_permission(
        self,
        user_role: str,
        required_role: str
    ) -> bool:
        """
        验证审批权限
        
        基于RBAC校验权限，最小权限原则
        
        Args:
            user_role: 用户角色
            required_role: 所需角色
            
        Returns:
            是否有权限
        """
        role_hierarchy = {
            ApprovalRole.FINAL_APPROVER.value: [ApprovalRole.APPROVER.value, ApprovalRole.APPLICANT.value],
            ApprovalRole.APPROVER.value: [ApprovalRole.APPLICANT.value],
            ApprovalRole.APPLICANT.value: []
        }
        
        # 直接匹配
        if user_role == required_role:
            return True
        
        # 检查继承关系
        accessible_roles = role_hierarchy.get(user_role, [])
        return required_role in accessible_roles