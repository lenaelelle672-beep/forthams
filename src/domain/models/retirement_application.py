"""
资产报废退役申请模型

定义了资产报废退役流程中的核心实体：
- RetirementApplication: 报废申请
- ApprovalChain: 审批链路节点
- StateTransitionLog: 状态变更日志
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from dataclasses import dataclass, field


class RetirementStatus(str, Enum):
    """报废申请状态枚举"""
    DRAFT = "草稿"
    PENDING = "待审批"
    APPROVAL_IN_PROGRESS = "审批中"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    WITHDRAWN = "已撤回"


class DisposalMethod(str, Enum):
    """资产处置方式枚举"""
    DESTROY = "报废销毁"
    TRANSFER = "转让"
    RECYCLE = "回收再利用"
    DONATE = "捐赠"


class TriggerType(str, Enum):
    """状态变更触发类型枚举"""
    MANUAL = "manual"
    AUTO = "auto"
    APPROVAL = "approval"


class ApprovalDecision(str, Enum):
    """审批决策枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class RoutingStrategy(str, Enum):
    """审批路由策略枚举"""
    SERIAL = "serial"  # 串行审批
    COUNTER_SIGN = "counter_sign"  # 会签（全部通过）
    OR_SIGN = "or_sign"  # 或签（任一通过）


@dataclass
class RetirementApplication:
    """
    报废申请实体
    
    Attributes:
        id: 申请唯一标识
        asset_id: 关联资产ID
        applicant_id: 申请人ID
        reason: 报废原因
        disposal_method: 处置方式
        estimated_value: 预估残值
        status: 申请状态
        routing_strategy: 审批路由策略
        current_node_order: 当前审批节点序号
        created_at: 创建时间
        updated_at: 更新时间
    """
    asset_id: UUID
    applicant_id: UUID
    reason: str
    disposal_method: DisposalMethod
    estimated_value: Decimal
    id: UUID = field(default_factory=uuid4)
    status: RetirementStatus = RetirementStatus.DRAFT
    routing_strategy: RoutingStrategy = RoutingStrategy.SERIAL
    current_node_order: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        """验证字段约束"""
        if self.estimated_value < 0:
            raise ValueError("预估残值不能为负数")
        if not self.reason or len(self.reason.strip()) == 0:
            raise ValueError("报废原因不能为空")
    
    def can_submit(self) -> bool:
        """
        检查申请是否可以提交
        
        Returns:
            bool: 是否可以提交
        """
        return self.status == RetirementStatus.DRAFT
    
    def can_withdraw(self) -> bool:
        """
        检查申请是否可以撤回
        
        撤回条件：状态为待审批或审批中，且所有审批人尚未操作
        
        Returns:
            bool: 是否可以撤回
        """
        return self.status in [
            RetirementStatus.PENDING,
            RetirementStatus.APPROVAL_IN_PROGRESS
        ] and self.current_node_order == 0
    
    def submit(self) -> None:
        """
        提交申请
        
        将状态从草稿变更为待审批
        """
        if not self.can_submit():
            raise ValueError(f"当前状态 {self.status} 不允许提交申请")
        self.status = RetirementStatus.PENDING
        self.current_node_order = 1
        self.updated_at = datetime.utcnow()
    
    def withdraw(self) -> None:
        """
        撤回申请
        
        将状态变更为已撤回
        """
        if not self.can_withdraw():
            raise ValueError(f"当前状态 {self.status} 不允许撤回申请")
        self.status = RetirementStatus.WITHDRAWN
        self.updated_at = datetime.utcnow()
    
    def approve(self) -> None:
        """
        审批通过
        
        将状态变更为已批准
        """
        if self.status != RetirementStatus.APPROVAL_IN_PROGRESS:
            raise ValueError(f"当前状态 {self.status} 不允许审批通过")
        self.status = RetirementStatus.APPROVED
        self.updated_at = datetime.utcnow()
    
    def reject(self) -> None:
        """
        审批拒绝
        
        将状态变更为已拒绝
        """
        if self.status not in [
            RetirementStatus.PENDING,
            RetirementStatus.APPROVAL_IN_PROGRESS
        ]:
            raise ValueError(f"当前状态 {self.status} 不允许审批拒绝")
        self.status = RetirementStatus.REJECTED
        self.updated_at = datetime.utcnow()
    
    def advance_to_next_node(self) -> bool:
        """
        推进到下一个审批节点
        
        Returns:
            bool: 是否还有下一个节点
        """
        self.current_node_order += 1
        self.updated_at = datetime.utcnow()
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict[str, Any]: 字典表示
        """
        return {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "applicant_id": str(self.applicant_id),
            "reason": self.reason,
            "disposal_method": self.disposal_method.value,
            "estimated_value": float(self.estimated_value),
            "status": self.status.value,
            "routing_strategy": self.routing_strategy.value,
            "current_node_order": self.current_node_order,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ApprovalChain:
    """
    审批链路节点实体
    
    Attributes:
        id: 节点唯一标识
        application_id: 关联的报废申请ID
        node_order: 节点顺序号
        approver_id: 审批人ID
        decision: 审批决策
        comment: 审批意见
        decided_at: 决策时间
        created_at: 创建时间
    """
    application_id: UUID
    node_order: int
    approver_id: UUID
    id: UUID = field(default_factory=uuid4)
    decision: ApprovalDecision = ApprovalDecision.PENDING
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        """验证字段约束"""
        if self.node_order < 1:
            raise ValueError("节点序号必须大于0")
        if self.node_order > 5:
            raise ValueError("审批层级不能超过5级")
    
    def approve(self, comment: Optional[str] = None) -> None:
        """
        批准当前节点
        
        Args:
            comment: 审批意见
        """
        if self.decision != ApprovalDecision.PENDING:
            raise ValueError("当前节点已决策")
        self.decision = ApprovalDecision.APPROVED
        self.comment = comment
        self.decided_at = datetime.utcnow()
    
    def reject(self, comment: str) -> None:
        """
        拒绝当前节点
        
        Args:
            comment: 拒绝原因
        """
        if self.decision != ApprovalDecision.PENDING:
            raise ValueError("当前节点已决策")
        if not comment:
            raise ValueError("拒绝原因不能为空")
        self.decision = ApprovalDecision.REJECTED
        self.comment = comment
        self.decided_at = datetime.utcnow()
    
    def skip(self) -> None:
        """
        跳过当前节点
        
        通常用于申请人撤回申请时
        """
        if self.decision != ApprovalDecision.PENDING:
            raise ValueError("当前节点已决策")
        self.decision = ApprovalDecision.SKIPPED
        self.decided_at = datetime.utcnow()
    
    def is_pending(self) -> bool:
        """
        检查节点是否处于待审批状态
        
        Returns:
            bool: 是否待审批
        """
        return self.decision == ApprovalDecision.PENDING
    
    def is_decided(self) -> bool:
        """
        检查节点是否已决策
        
        Returns:
            bool: 是否已决策
        """
        return self.decision in [
            ApprovalDecision.APPROVED,
            ApprovalDecision.REJECTED,
            ApprovalDecision.SKIPPED
        ]
    
    def is_timeout(self, hours: int = 72) -> bool:
        """
        检查节点是否超时
        
        Args:
            hours: 超时阈值（小时），默认72小时
            
        Returns:
            bool: 是否超时
        """
        if self.decision != ApprovalDecision.PENDING:
            return False
        elapsed = datetime.utcnow() - self.created_at
        return elapsed.total_seconds() > hours * 3600
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict[str, Any]: 字典表示
        """
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "node_order": self.node_order,
            "approver_id": str(self.approver_id),
            "decision": self.decision.value,
            "comment": self.comment,
            "decided_at": self.decided_at.isoformat() if self.decided_at else None,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class StateTransitionLog:
    """
    状态变更日志实体
    
    记录资产的每一次状态变更，用于审计追踪和哈希链防篡改
    
    Attributes:
        id: 日志唯一标识
        asset_id: 资产ID
        from_status: 变更前状态
        to_status: 变更后状态
        trigger_type: 触发类型
        operator_id: 操作人ID（可为None表示系统自动）
        metadata: 附加元数据
        previous_hash: 前一条日志的哈希值
        hash: 当前日志的哈希值
        created_at: 创建时间
    """
    asset_id: UUID
    from_status: str
    to_status: str
    trigger_type: TriggerType
    id: UUID = field(default_factory=uuid4)
    operator_id: Optional[UUID] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    previous_hash: Optional[str] = None
    hash: str = field(default="")
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def calculate_hash(self) -> str:
        """
        计算当前日志的哈希值
        
        使用前一条日志的哈希值形成哈希链
        
        Returns:
            str: 哈希值
        """
        import hashlib
        content = (
            f"{self.id}"
            f"{self.asset_id}"
            f"{self.from_status}"
            f"{self.to_status}"
            f"{self.trigger_type.value}"
            f"{self.operator_id}"
            f"{self.metadata}"
            f"{self.created_at.isoformat()}"
            f"{self.previous_hash or ''}"
        )
        return hashlib.sha256(content.encode()).hexdigest()
    
    def seal(self) -> None:
        """
        密封日志，生成哈希值
        
        在日志创建完成后调用，生成不可篡改的哈希值
        """
        self.hash = self.calculate_hash()
    
    def verify_integrity(self) -> bool:
        """
        校验哈希链完整性
        
        重新计算哈希值并与存储的哈希值比对
        
        Returns:
            bool: 哈希是否完整
        """
        return self.hash == self.calculate_hash()
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict[str, Any]: 字典表示
        """
        return {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "trigger_type": self.trigger_type.value,
            "operator_id": str(self.operator_id) if self.operator_id else None,
            "metadata": self.metadata,
            "previous_hash": self.previous_hash,
            "hash": self.hash,
            "created_at": self.created_at.isoformat(),
        }


class ApprovalChainValidator:
    """
    审批链校验器
    
    提供审批链路的业务规则校验
    """
    
    MAX_APPROVAL_LEVELS = 5
    
    @classmethod
    def validate_chain(cls, nodes: List[ApprovalChain]) -> None:
        """
        校验审批链是否合法
        
        Args:
            nodes: 审批节点列表
            
        Raises:
            ValueError: 校验失败
        """
        if not nodes:
            raise ValueError("审批链不能为空")
        
        if len(nodes) > cls.MAX_APPROVAL_LEVELS:
            raise ValueError(f"审批层级不能超过{cls.MAX_APPROVAL_LEVELS}级")
        
        # 检查节点顺序是否连续
        orders = sorted([n.node_order for n in nodes])
        for i, order in enumerate(orders):
            if order != i + 1:
                raise ValueError("审批节点顺序不连续")
        
        # 检查同一节点序号没有重复
        if len(orders) != len(set(orders)):
            raise ValueError("审批节点序号存在重复")
    
    @classmethod
    def can_create_new_application(cls, existing_applications: List[RetirementApplication]) -> bool:
        """
        检查是否可以创建新申请
        
        规则：同一资产同一时间仅允许1个活跃申请
        
        Args:
            existing_applications: 该资产已有的申请列表
            
        Returns:
            bool: 是否可以创建新申请
        """
        for app in existing_applications:
            if app.status in [
                RetirementStatus.PENDING,
                RetirementStatus.APPROVAL_IN_PROGRESS
            ]:
                return False
        return True