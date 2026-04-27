"""
退役历史记录模型 (Retirement History Model)

本模块定义了资产报废退役流程的历史记录持久化模型，用于追踪资产退役申请的完整生命周期。

功能特性:
- 记录退役申请的状态转换历史
- 支持审批链的完整追踪
- 提供时间线回溯能力
- 与资产状态机无缝集成

典型使用场景:
1. 用户发起退役申请 -> 创建初始历史记录
2. 审批人逐级审批 -> 追加审批记录
3. 最终状态变更 -> 更新终态记录

关联模块:
- src.state_machine.retirement_state_machine: 状态机定义
- src.models.approval_chain: 审批链配置
- src.services.approval_service: 审批服务
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
import json


class RetirementStatus(str, Enum):
    """
    退役申请状态枚举
    
    状态流转路径:
    PENDING -> APPROVING -> APPROVED -> PROCESSING -> COMPLETED
                  ↓
              REJECTED
    """
    PENDING = "pending"           # 待审批
    APPROVING = "approving"       # 审批中
    APPROVED = "approved"         # 已批准
    REJECTED = "rejected"         # 已拒绝
    PROCESSING = "processing"     # 处理中
    COMPLETED = "completed"       # 已完成
    CANCELLED = "cancelled"      # 已取消


class ApprovalAction(str, Enum):
    """审批动作枚举"""
    SUBMIT = "submit"             # 提交申请
    APPROVE = "approve"           # 批准
    REJECT = "reject"             # 拒绝
    DELEGATE = "delegate"         # 转交
    COMMENT = "comment"           # 评论


@dataclass
class ApprovalStage:
    """
    审批阶段数据类
    
    Attributes:
        stage_id: 审批阶段ID
        approver_id: 审批人ID
        approver_name: 审批人名称
        action: 审批动作
        comment: 审批意见
        timestamp: 审批时间
    """
    stage_id: str
    approver_id: str
    approver_name: str
    action: ApprovalAction
    comment: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "stage_id": self.stage_id,
            "approver_id": self.approver_id,
            "approver_name": self.approver_name,
            "action": self.action.value,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class RetirementHistory:
    """
    退役历史记录模型
    
    本模型用于持久化资产退役申请的全生命周期记录，支持状态追踪和审批链回溯。
    
    Attributes:
        id: 记录唯一标识符 (UUID格式)
        asset_id: 资产ID，关联资产主数据
        application_id: 退役申请单号
        current_status: 当前退役状态
        previous_status: 上一个状态 (用于状态回滚)
        initiator_id: 申请人ID
        initiator_name: 申请人名称
        approval_chain: 审批链阶段列表
        created_at: 记录创建时间
        updated_at: 记录更新时间
        completed_at: 完成时间 (可选)
        metadata: 附加元数据 (JSON格式)
        
    Example:
        >>> history = RetirementHistory(
        ...     id="uuid-here",
        ...     asset_id="ASSET-001",
        ...     application_id="RET-2024-001",
        ...     current_status=RetirementStatus.PENDING,
        ...     initiator_id="USER-001"
        ... )
        >>> history.add_approval_stage(stage)
    """
    
    # 核心标识字段
    id: str
    asset_id: str
    application_id: str
    
    # 状态字段
    current_status: RetirementStatus
    previous_status: Optional[RetirementStatus] = None
    
    # 申请人信息
    initiator_id: str
    initiator_name: str
    
    # 审批链
    approval_chain: List[ApprovalStage] = field(default_factory=list)
    
    # 时间戳
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # 附加数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """数据类初始化后的校验逻辑"""
        if not self.id:
            raise ValueError("id字段不能为空")
        if not self.asset_id:
            raise ValueError("asset_id字段不能为空")
        if not self.application_id:
            raise ValueError("application_id字段不能为空")
    
    def add_approval_stage(self, stage: ApprovalStage) -> None:
        """
        添加审批阶段记录
        
        Args:
            stage: ApprovalStage实例，包含审批人、动作、时间等信息
            
        Note:
            添加后自动更新updated_at时间戳
        """
        self.approval_chain.append(stage)
        self.updated_at = datetime.now()
    
    def transition_to(self, new_status: RetirementStatus, actor_id: str, comment: Optional[str] = None) -> None:
        """
        执行状态转换
        
        Args:
            new_status: 目标状态
            actor_id: 执行操作的actor ID
            comment: 状态转换备注
            
        Raises:
            ValueError: 如果状态转换不合法
            
        Note:
            自动记录状态转换历史到approval_chain
        """
        if not self._is_valid_transition(self.current_status, new_status):
            raise ValueError(
                f"非法的状态转换: {self.current_status.value} -> {new_status.value}"
            )
        
        self.previous_status = self.current_status
        self.current_status = new_status
        self.updated_at = datetime.now()
        
        # 记录状态转换
        stage = ApprovalStage(
            stage_id=f"STAGE-{len(self.approval_chain) + 1}",
            approver_id=actor_id,
            approver_name=self._get_actor_name(actor_id),
            action=ApprovalAction.APPROVE if new_status != RetirementStatus.REJECTED else ApprovalAction.REJECT,
            comment=comment
        )
        self.add_approval_stage(stage)
        
        # 如果到达终态，记录完成时间
        if new_status in [RetirementStatus.COMPLETED, RetirementStatus.REJECTED, RetirementStatus.CANCELLED]:
            self.completed_at = datetime.now()
    
    def _is_valid_transition(self, from_status: RetirementStatus, to_status: RetirementStatus) -> bool:
        """
        检查状态转换是否合法
        
        Args:
            from_status: 起始状态
            to_status: 目标状态
            
        Returns:
            bool: 是否允许此转换
        """
        valid_transitions = {
            RetirementStatus.PENDING: [RetirementStatus.APPROVING, RetirementStatus.CANCELLED],
            RetirementStatus.APPROVING: [RetirementStatus.APPROVED, RetirementStatus.REJECTED],
            RetirementStatus.APPROVED: [RetirementStatus.PROCESSING],
            RetirementStatus.PROCESSING: [RetirementStatus.COMPLETED],
            RetirementStatus.REJECTED: [],
            RetirementStatus.COMPLETED: [],
            RetirementStatus.CANCELLED: []
        }
        return to_status in valid_transitions.get(from_status, [])
    
    def _get_actor_name(self, actor_id: str) -> str:
        """
        获取actor名称 (实际应用中应从用户服务获取)
        
        Args:
            actor_id: actor ID
            
        Returns:
            str: actor名称
        """
        return f"User-{actor_id}"
    
    def get_timeline(self) -> List[Dict[str, Any]]:
        """
        获取退役申请的时间线 (按时间降序)
        
        Returns:
            List[Dict[str, Any]]: 审批阶段列表
        """
        return [stage.to_dict() for stage in reversed(self.approval_chain)]
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict[str, Any]: 包含所有字段的字典
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "application_id": self.application_id,
            "current_status": self.current_status.value,
            "previous_status": self.previous_status.value if self.previous_status else None,
            "initiator_id": self.initiator_id,
            "initiator_name": self.initiator_name,
            "approval_chain": [stage.to_dict() for stage in self.approval_chain],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RetirementHistory":
        """
        从字典创建实例
        
        Args:
            data: 字典数据
            
        Returns:
            RetirementHistory: 新实例
        """
        # 解析approval_chain
        approval_chain = []
        if "approval_chain" in data:
            for stage_data in data["approval_chain"]:
                stage = ApprovalStage(
                    stage_id=stage_data["stage_id"],
                    approver_id=stage_data["approver_id"],
                    approver_name=stage_data["approver_name"],
                    action=ApprovalAction(stage_data["action"]),
                    comment=stage_data.get("comment"),
                    timestamp=datetime.fromisoformat(stage_data["timestamp"]) if "timestamp" in stage_data else datetime.now()
                )
                approval_chain.append(stage)
        
        return cls(
            id=data["id"],
            asset_id=data["asset_id"],
            application_id=data["application_id"],
            current_status=RetirementStatus(data["current_status"]),
            previous_status=RetirementStatus(data["previous_status"]) if data.get("previous_status") else None,
            initiator_id=data["initiator_id"],
            initiator_name=data["initiator_name"],
            approval_chain=approval_chain,
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if "updated_at" in data else datetime.now(),
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
            metadata=data.get("metadata", {})
        )
    
    def __repr__(self) -> str:
        """友好字符串表示"""
        return (
            f"RetirementHistory(id={self.id}, "
            f"asset_id={self.asset_id}, "
            f"status={self.current_status.value})"
        )