"""
资产报废/退役流程核心模型

定义资产退役申请的状态机、审批流程和数据结构。
支持状态流转: 正常(NORMAL) → 退役中(RETIRING) → 已报废(RETIRED)

Authors: SWARM-002 Team
Since: 2025-01-23
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from uuid import UUID, uuid4


class RetirementStatus(str, Enum):
    """
    资产退役申请状态枚举
    
    状态流转规则:
    - PENDING: 初始状态，申请已提交待审批
    - APPROVED: 审批通过，资产正式退役
    - REJECTED: 审批驳回
    - CANCELLED: 用户主动取消
    """
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class RetirementReason(str, Enum):
    """
    资产退役原因枚举
    
    包含常见的资产退役原因类型，用于分类统计和分析。
    """
    DAMAGE_LOSS = "DAMAGE_LOSS"  # 损坏丢失
    TECH_OBSOLESCENCE = "TECH_OBSOLESCENCE"  # 技术淘汰
    NORMAL_RETIREMENT = "NORMAL_RETIREMENT"  # 正常报废
    UPGRADE_REPLACEMENT = "UPGRADE_REPLACEMENT"  # 升级替换
    LEASE_EXPIRATION = "LEASE_EXPIRATION"  # 租赁到期
    OTHER = "OTHER"  # 其他原因


class AssetStatus(str, Enum):
    """
    资产状态枚举
    
    核心状态机定义，支持以下状态:
    - NORMAL: 正常使用中
    - RETIRING: 退役中（已发起报废流程，待审批）
    - RETIRED: 已报废（退役流程完成）
    
    状态流转规则: NORMAL → RETIRING → RETIRED
    禁止逆向或跳跃变更。
    """
    NORMAL = "NORMAL"  # 正常
    RETIRING = "RETIRING"  # 退役中
    RETIRED = "RETIRED"  # 已报废


class AssetRetirementRecordStatus(str, Enum):
    """
    资产退役记录状态枚举
    
    用于记录每次状态变更的详细历史。
    """
    INITIATED = "INITIATED"  # 已发起
    APPROVED = "APPROVED"  # 已审批通过
    REJECTED = "REJECTED"  # 已驳回
    CANCELLED = "CANCELLED"  # 已取消


class RetirementAction(str, Enum):
    """
    退役操作动作枚举
    
    记录用户执行的各类操作。
    """
    INITIATE = "INITIATE"  # 发起报废
    APPROVE = "APPROVE"  # 审批通过
    REJECT = "REJECT"  # 审批驳回
    CANCEL = "CANCEL"  # 取消申请


class BaseEntity:
    """
    基础实体类
    
    提供所有实体的通用字段，包括:
    - id: 主键UUID
    - created_at: 创建时间
    - updated_at: 更新时间
    """
    
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    def __init__(self):
        self.id = uuid4()
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()


class AssetRetirement(BaseEntity):
    """
    资产退役申请 ORM 模型
    
    存储资产退役申请的核心信息，包括:
    - 申请基本信息（编号、申请人、创建时间）
    - 资产关联信息
    - 退役原因和描述
    - 附件清单
    - 审批状态和历史
    
    Attributes:
        retirement_no: 退役申请单号，格式: RET-{YYYYMMDD}-{6位序号}
        asset_id: 关联资产ID，外键关联资产表
        reason: 退役原因，枚举类型
        description: 详细描述，用户填写的补充说明
        status: 当前审批状态
        attachment_urls: 附件URL列表，JSON格式存储
        applicant_id: 申请人ID
        approver_id: 审批人ID（审批通过后填充）
        initiated_at: 发起时间
        approved_at: 审批通过时间（可为NULL）
        rejected_at: 驳回时间（可为NULL）
        rejected_reason: 驳回原因
        audit_trail: 审计轨迹，记录所有状态变更
    """
    
    def __init__(
        self,
        asset_id: UUID,
        applicant_id: UUID,
        reason: RetirementReason,
        description: Optional[str] = None,
        attachment_urls: Optional[List[str]] = None
    ):
        """
        初始化资产退役申请
        
        Args:
            asset_id: 资产ID
            applicant_id: 申请人ID
            reason: 退役原因
            description: 详细描述（可选）
            attachment_urls: 附件URL列表（可选）
        """
        super().__init__()
        self.asset_id = asset_id
        self.applicant_id = applicant_id
        self.reason = reason
        self.description = description
        self.attachment_urls = attachment_urls or []
        self.status = RetirementStatus.PENDING
        self.approver_id: Optional[UUID] = None
        self.initiated_at = datetime.utcnow()
        self.approved_at: Optional[datetime] = None
        self.rejected_at: Optional[datetime] = None
        self.rejected_reason: Optional[str] = None
        self.audit_trail: List[dict] = []
    
    def approve(self, approver_id: UUID) -> None:
        """
        审批通过
        
        Args:
            approver_id: 审批人ID
            
        Raises:
            ValueError: 当前状态不允许审批通过时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(
                f"无法审批通过: 当前状态为 {self.status.value}，"
                f"仅 PENDING 状态可审批通过"
            )
        self.status = RetirementStatus.APPROVED
        self.approver_id = approver_id
        self.approved_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self._add_audit_entry(RetirementAction.APPROVE, approver_id)
    
    def reject(self, approver_id: UUID, reason: str) -> None:
        """
        审批驳回
        
        Args:
            approver_id: 审批人ID
            reason: 驳回原因
            
        Raises:
            ValueError: 当前状态不允许驳回时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(
                f"无法驳回: 当前状态为 {self.status.value}，"
                f"仅 PENDING 状态可驳回"
            )
        self.status = RetirementStatus.REJECTED
        self.approver_id = approver_id
        self.rejected_at = datetime.utcnow()
        self.rejected_reason = reason
        self.updated_at = datetime.utcnow()
        self._add_audit_entry(RetirementAction.REJECT, approver_id, reason)
    
    def cancel(self, operator_id: UUID) -> None:
        """
        取消申请
        
        Args:
            operator_id: 操作人ID
            
        Raises:
            ValueError: 当前状态不允许取消时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(
                f"无法取消: 当前状态为 {self.status.value}，"
                f"仅 PENDING 状态可取消"
            )
        self.status = RetirementStatus.CANCELLED
        self.updated_at = datetime.utcnow()
        self._add_audit_entry(RetirementAction.CANCEL, operator_id)
    
    def _add_audit_entry(
        self,
        action: RetirementAction,
        operator_id: UUID,
        detail: Optional[str] = None
    ) -> None:
        """
        添加审计轨迹记录
        
        Args:
            action: 操作动作
            operator_id: 操作人ID
            detail: 详情（可选）
        """
        entry = {
            "action": action.value,
            "operator_id": str(operator_id),
            "timestamp": datetime.utcnow().isoformat(),
            "from_status": self.status.value,
            "detail": detail
        }
        self.audit_trail.append(entry)
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            包含所有字段的字典
        """
        return {
            "id": str(self.id),
            "retirement_no": getattr(self, 'retirement_no', None),
            "asset_id": str(self.asset_id),
            "applicant_id": str(self.applicant_id),
            "reason": self.reason.value,
            "description": self.description,
            "status": self.status.value,
            "attachment_urls": self.attachment_urls,
            "approver_id": str(self.approver_id) if self.approver_id else None,
            "initiated_at": self.initiated_at.isoformat() if self.initiated_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "rejected_at": self.rejected_at.isoformat() if self.rejected_at else None,
            "rejected_reason": self.rejected_reason,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "audit_trail": self.audit_trail
        }


class RetirementWorkflow:
    """
    资产退役工作流引擎
    
    负责管理资产状态变更和触发相应事件。
    支持以下功能:
    - 状态变更校验
    - 状态流转执行
    - 工作流事件发布
    """
    
    # 合法的状态流转映射
    VALID_TRANSITIONS = {
        AssetStatus.NORMAL: [AssetStatus.RETIRING],
        AssetStatus.RETIRING: [AssetStatus.RETIRED],
        AssetStatus.RETIRED: []  # 已报废状态不允许继续流转
    }
    
    def __init__(self):
        """初始化工作流引擎"""
        self._event_handlers = []
    
    def register_event_handler(self, handler: callable) -> None:
        """
        注册事件处理器
        
        Args:
            handler: 事件处理函数
        """
        self._event_handlers.append(handler)
    
    def can_transition(self, from_status: AssetStatus, to_status: AssetStatus) -> bool:
        """
        检查状态流转是否合法
        
        Args:
            from_status: 源状态
            to_status: 目标状态
            
        Returns:
            是否允许此流转
        """
        allowed_targets = self.VALID_TRANSITIONS.get(from_status, [])
        return to_status in allowed_targets
    
    def execute_transition(
        self,
        asset_id: UUID,
        from_status: AssetStatus,
        to_status: AssetStatus,
        operator_id: UUID,
        reason: Optional[str] = None
    ) -> dict:
        """
        执行状态流转
        
        Args:
            asset_id: 资产ID
            from_status: 源状态
            to_status: 目标状态
            operator_id: 操作人ID
            reason: 变更原因
            
        Returns:
            流转结果字典
            
        Raises:
            ValueError: 流转不合法时抛出
        """
        if not self.can_transition(from_status, to_status):
            raise ValueError(
                f"非法状态流转: {from_status.value} → {to_status.value}，"
                f"允许的流转: {[s.value for s in self.VALID_TRANSITIONS.get(from_status, [])]}"
            )
        
        result = {
            "asset_id": str(asset_id),
            "from_status": from_status.value,
            "to_status": to_status.value,
            "operator_id": str(operator_id),
            "timestamp": datetime.utcnow().isoformat(),
            "reason": reason,
            "success": True
        }
        
        # 触发事件处理器
        for handler in self._event_handlers:
            try:
                handler(result)
            except Exception as e:
                # 事件处理失败不影响主流程
                result.setdefault("event_errors", []).append(str(e))
        
        return result
    
    @classmethod
    def get_valid_next_statuses(cls, current_status: AssetStatus) -> List[AssetStatus]:
        """
        获取当前状态允许的后续状态列表
        
        Args:
            current_status: 当前状态
            
        Returns:
            允许的后续状态列表
        """
        return cls.VALID_TRANSITIONS.get(current_status, [])


def is_idempotent_retirement(asset_id: UUID, existing_records: List[AssetRetirement]) -> bool:
    """
    检查是否存在进行中的退役申请（幂等性检查）
    
    Args:
        asset_id: 资产ID
        existing_records: 现有的退役申请记录列表
        
    Returns:
        是否存在进行中的申请
    """
    for record in existing_records:
        if record.asset_id == asset_id and record.status == RetirementStatus.PENDING:
            return True
    return False