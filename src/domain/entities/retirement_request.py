"""
资产报废退役流程 - 报废申请实体模块

定义资产报废申请的核心领域实体，包含申请状态、审批流程、历史追踪。
实现状态机: 在用 -> 待审批 -> 已报废 (审批通过) 或 驳回 -> 在用

相关规范: SWARM-002 资产报废退役流程 - Phase 3.3 审批记录存储
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid


class RetirementStatus(Enum):
    """
    报废申请状态枚举
    
    状态流转:
        pending   - 待审批 (申请已提交，等待管理员审批)
        approved  - 已批准 (审批通过，资产状态变更为已报废)
        rejected  - 已驳回 (审批未通过，资产状态保持不变)
        cancelled - 已取消 (申请人主动撤销)
    """
    PENDING = "pending"           # 待审批
    APPROVED = "approved"         # 已批准
    REJECTED = "rejected"         # 已驳回
    CANCELLED = "cancelled"       # 已取消


class AssetRetirementEligibility(Enum):
    """
    资产报废资格状态枚举
    
    用于校验资产是否符合报废条件
    """
    ELIGIBLE = "eligible"                     # 可报废
    NOT_ELIGIBLE_ASSET_NOT_FOUND = "asset_not_found"           # 资产不存在
    NOT_ELIGIBLE_WRONG_STATUS = "wrong_status"                 # 资产状态不符合报废条件
    NOT_ELIGIBLE_PENDING_EXISTS = "pending_application_exists"  # 存在待审批的申请


@dataclass
class RetirementRequest:
    """
    资产报废申请实体
    
    承载报废申请的核心业务数据，包含申请人信息、资产信息、审批状态等。
    
    Attributes:
        id: 申请唯一标识 (UUID格式)
        asset_id: 关联资产ID
        reason: 报废原因 (必填，最大500字符)
        estimated_residual_value: 预估残值 (数值型，允许0)
        applicant_id: 申请人ID
        approver_id: 审批人ID (审批后填充)
        status: 当前申请状态
        created_at: 创建时间
        updated_at: 更新时间
        approved_at: 审批时间 (审批后填充)
        approval_comment: 审批意见 (审批后填充)
        application_no: 申请单号 (业务编号)
    """
    
    asset_id: str
    reason: str
    applicant_id: str
    estimated_residual_value: Decimal = field(default_factory=lambda: Decimal("0"))
    
    # 系统自动生成字段
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    application_no: str = ""
    status: RetirementStatus = RetirementStatus.PENDING
    
    # 审批相关字段
    approver_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_comment: Optional[str] = None
    
    # 时间戳
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """
        后置初始化处理
        
        验证必填字段、生成业务编号、自动设置更新时间
        """
        if not self.asset_id:
            raise ValueError("asset_id is required")
        if not self.reason:
            raise ValueError("reason is required")
        if len(self.reason) > 500:
            raise ValueError("reason must not exceed 500 characters")
        if self.estimated_residual_value < 0:
            raise ValueError("estimated_residual_value must be non-negative")
        if not self.application_no:
            self.application_no = self._generate_application_no()
        self.updated_at = datetime.now()
    
    def _generate_application_no(self) -> str:
        """
        生成业务申请单号
        
        Format: RET-{YYYYMMDD}-{6位随机数}
        
        Returns:
            格式化的申请单号
        """
        date_str = datetime.now().strftime("%Y%m%d")
        random_part = str(uuid.uuid4().int)[:6]
        return f"RET-{date_str}-{random_part}"
    
    def approve(self, approver_id: str, comment: Optional[str] = None) -> None:
        """
        审批通过操作
        
        将申请状态变更为已批准，记录审批人、审批时间和审批意见
        
        Args:
            approver_id: 审批人ID
            comment: 审批意见 (可选)
        
        Raises:
            ValueError: 当申请状态不是待审批时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(
                f"Cannot approve retirement request in status {self.status.value}, "
                f"expected {RetirementStatus.PENDING.value}"
            )
        
        self.status = RetirementStatus.APPROVED
        self.approver_id = approver_id
        self.approved_at = datetime.now()
        self.approval_comment = comment
        self.updated_at = datetime.now()
    
    def reject(self, approver_id: str, comment: Optional[str] = None) -> None:
        """
        审批驳回操作
        
        将申请状态变更为已驳回，记录审批人、审批时间和审批意见
        注意：驳回后资产状态保持不变
        
        Args:
            approver_id: 审批人ID
            comment: 驳回意见 (可选)
        
        Raises:
            ValueError: 当申请状态不是待审批时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(
                f"Cannot reject retirement request in status {self.status.value}, "
                f"expected {RetirementStatus.PENDING.value}"
            )
        
        self.status = RetirementStatus.REJECTED
        self.approver_id = approver_id
        self.approved_at = datetime.now()
        self.approval_comment = comment
        self.updated_at = datetime.now()
    
    def cancel(self) -> None:
        """
        申请人撤销申请操作
        
        将申请状态变更为已取消。仅申请人可撤销待审批状态的申请。
        
        Raises:
            ValueError: 当申请状态不是待审批时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(
                f"Cannot cancel retirement request in status {self.status.value}, "
                f"expected {RetirementStatus.PENDING.value}"
            )
        
        self.status = RetirementStatus.CANCELLED
        self.updated_at = datetime.now()
    
    def can_be_retired(self) -> bool:
        """
        判断资产是否可以进行报废
        
        报废条件:
        1. 申请状态为已批准
        
        Returns:
            True if asset can be retired, False otherwise
        """
        return self.status == RetirementStatus.APPROVED
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            包含所有字段的字典
        """
        return {
            "id": self.id,
            "application_no": self.application_no,
            "asset_id": self.asset_id,
            "reason": self.reason,
            "estimated_residual_value": float(self.estimated_residual_value),
            "applicant_id": self.applicant_id,
            "approver_id": self.approver_id,
            "status": self.status.value,
            "approval_comment": self.approval_comment,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
        }


@dataclass
class RetirementHistory:
    """
    资产退役历史记录实体
    
    记录每次报废操作的完整审计信息，用于历史追踪和合规审计。
    
    Attributes:
        id: 记录唯一标识
        retirement_request_id: 关联的报废申请ID
        asset_id: 资产ID
        action: 操作类型 (submitted/approved/rejected/cancelled)
        operator_id: 操作人ID
        operator_type: 操作人类型 (applicant/approver/system)
        operated_at: 操作时间
        previous_status: 操作前状态
        new_status: 操作后状态
        comment: 操作备注
        metadata: 扩展元数据 (JSON格式)
    """
    
    retirement_request_id: str
    asset_id: str
    action: str
    operator_id: str
    operator_type: str = "system"
    
    # 状态变更追踪
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    
    # 元数据
    comment: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    
    # 系统字段
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    operated_at: datetime = field(default_factory=datetime.now)
    
    @classmethod
    def create_from_request(
        cls,
        request: RetirementRequest,
        action: str,
        operator_id: str,
        operator_type: str = "system",
        comment: Optional[str] = None
    ) -> "RetirementHistory":
        """
        从报废申请创建历史记录
        
        Args:
            request: 报废申请实体
            action: 操作类型
            operator_id: 操作人ID
            operator_type: 操作人类型
            comment: 操作备注
        
        Returns:
            新建的历史记录实体
        """
        return cls(
            retirement_request_id=request.id,
            asset_id=request.asset_id,
            action=action,
            operator_id=operator_id,
            operator_type=operator_type,
            previous_status=RetirementStatus.PENDING.value,
            new_status=request.status.value,
            comment=comment,
        )
    
    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        Returns:
            包含所有字段的字典
        """
        return {
            "id": self.id,
            "retirement_request_id": self.retirement_request_id,
            "asset_id": self.asset_id,
            "action": self.action,
            "operator_id": self.operator_id,
            "operator_type": self.operator_type,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "comment": self.comment,
            "metadata": self.metadata,
            "operated_at": self.operated_at.isoformat(),
        }


@dataclass
class RetirementEligibilityCheck:
    """
    资产报废资格检查结果
    
    用于校验资产是否符合报废条件
    
    Attributes:
        is_eligible: 是否符合报废条件
        reason: 不符合的原因 (当 is_eligible=False 时填充)
        asset_current_status: 资产当前状态 (用于调试)
    """
    
    is_eligible: bool
    reason: Optional[str] = None
    asset_current_status: Optional[str] = None
    existing_application_id: Optional[str] = None
    
    @classmethod
    def eligible(cls) -> "RetirementEligibilityCheck":
        """
        创建符合条件的结果
        
        Returns:
            符合报废条件的结果
        """
        return cls(is_eligible=True)
    
    @classmethod
    def not_eligible(
        cls,
        reason: AssetRetirementEligibility,
        asset_current_status: Optional[str] = None,
        existing_application_id: Optional[str] = None
    ) -> "RetirementEligibilityCheck":
        """
        创建不符合条件的结果
        
        Args:
            reason: 不符合原因枚举
            asset_current_status: 资产当前状态
            existing_application_id: 已存在的申请ID
        
        Returns:
            不符合报废条件的结果
        """
        reason_messages = {
            AssetRetirementEligibility.NOT_ELIGIBLE_ASSET_NOT_FOUND: "资产不存在",
            AssetRetirementEligibility.NOT_ELIGIBLE_WRONG_STATUS: "资产状态不符合报废条件",
            AssetRetirementEligibility.NOT_ELIGIBLE_PENDING_EXISTS: "存在待审批的申请",
        }
        return cls(
            is_eligible=False,
            reason=reason_messages.get(reason, "未知原因"),
            asset_current_status=asset_current_status,
            existing_application_id=existing_application_id,
        )