"""
资产报废退役流程领域实体模块

本模块实现资产报废申请的核心领域逻辑，对应 Phase 3.3 审批记录存储。

状态机转换规则:
    [在用] --提交报废申请--> [待审批] --审批通过--> [已报废]
                                ↑
                           审批驳回
                                ↓
                           [在用] (状态不变)

约束规则:
    - 已报废状态资产不可再次提交报废申请
    - 同一资产同一时间只允许一条待审批记录
    - 审批驳回后申请记录状态更新为"已驳回"，不触发资产状态变更

典型使用场景:
    1. 用户提交资产报废申请
    2. 管理员审批通过/驳回
    3. 查询资产退役历史记录

相关模块:
    - src.domain.services.retirement_service: 业务服务层
    - src.repositories.retirement_repository: 数据持久化层
    - src.api.v1.retirement: API 路由层

Version: 1.0.0
Last Updated: 2024-01-15
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum
from dataclasses import dataclass, field
from dataclasses import dataclass, field


class RetirementStatus(str, Enum):
    """
    报废申请状态枚举
    
    属性:
        PENDING: 待审批状态
        APPROVED: 审批通过状态
        REJECTED: 审批驳回状态
    """
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AssetRetirementStatus(str, Enum):
    """
    资产报废状态枚举
    
    属性:
        IN_USE: 在用状态
        PENDING_RETIREMENT: 待审批报废状态
        RETIRED: 已报废状态
    """
    IN_USE = "in_use"
    PENDING_RETIREMENT = "pending_retirement"
    RETIRED = "retired"


@dataclass
class RetirementRecord:
    """
    资产退役历史记录
    
    用于记录每次报废操作的关键信息，包含时间戳、操作人、操作结果等。
    该记录作为审计日志永久保存，不可修改。
    
    属性:
        application_id: 关联的报废申请 ID
        retired_at: 退役时间戳
        approved_by: 审批人 ID
        approver_name: 审批人姓名
        result: 审批结果 (approved/rejected)
        comment: 审批意见
        asset_id: 资产 ID
        estimated_residual_value: 预估残值
    
    示例:
        >>> record = RetirementRecord(
        ...     application_id="RA-2024-001",
        ...     asset_id="AST-2024-001",
        ...     result="approved",
        ...     approved_by="ADMIN-001"
        ... )
    """
    application_id: str
    asset_id: str
    result: str
    approved_by: str
    retired_at: datetime = field(default_factory=datetime.now)
    approver_name: Optional[str] = None
    comment: Optional[str] = None
    estimated_residual_value: Optional[float] = None

    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        返回:
            dict: 包含所有字段的字典
        
        示例:
            >>> record.to_dict()
            {'application_id': 'RA-2024-001', ...}
        """
        return {
            "application_id": self.application_id,
            "asset_id": self.asset_id,
            "result": self.result,
            "approved_by": self.approved_by,
            "retired_at": self.retired_at.isoformat() if self.retired_at else None,
            "approver_name": self.approver_name,
            "comment": self.comment,
            "estimated_residual_value": self.estimated_residual_value,
        }


@dataclass
class RetirementApplication:
    """
    资产报废申请实体
    
    核心领域实体，表示用户提交的资产报废申请。包含申请信息、
    关联资产、审批状态及历史记录。
    
    属性:
        id: 申请唯一标识，格式: RA-{YYYY}-{序号}
        asset_id: 关联资产 ID，格式: AST-{YYYY}-{序号}
        reason: 报废原因，必填，最大 500 字符
        estimated_residual_value: 预估残值，允许 0
        applicant_id: 申请人 ID
        applicant_name: 申请人姓名
        status: 当前申请状态
        created_at: 申请创建时间
        updated_at: 最后更新时间
        history: 关联的退役历史记录列表
    
    状态转换规则:
        - 初始化时 status=PENDING
        - 审批通过后 status=APPROVED
        - 审批驳回后 status=REJECTED
    
    示例:
        >>> app = RetirementApplication(
        ...     asset_id="AST-2024-001",
        ...     reason="设备老化无法修复",
        ...     estimated_residual_value=500.00,
        ...     applicant_id="USER-001",
        ...     applicant_name="张三"
        ... )
    """
    asset_id: str
    reason: str
    applicant_id: str
    applicant_name: str
    estimated_residual_value: float = 0.0
    id: Optional[str] = None
    status: RetirementStatus = RetirementStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    history: List[RetirementRecord] = field(default_factory=list)

    def __post_init__(self):
        """
        初始化后置处理
        
        自动生成申请 ID，设置初始状态和时间戳。
        """
        if self.id is None:
            self.id = f"RA-{datetime.now().year}-{len(self.history) + 1:04d}"
        if self.status is None:
            self.status = RetirementStatus.PENDING

    def validate(self) -> None:
        """
        验证申请数据有效性
        
        检查必填字段和数值范围。报废原因最大 500 字符，
        预估残值最小为 0。
        
        异常:
            ValueError: 当必填字段为空或数值超范围时抛出
        """
        if not self.reason or len(self.reason.strip()) == 0:
            raise ValueError("报废原因不能为空")
        if len(self.reason) > 500:
            raise ValueError("报废原因最大 500 字符")
        if self.estimated_residual_value < 0:
            raise ValueError("预估残值不能为负数")
        if not self.asset_id:
            raise ValueError("资产 ID 不能为空")
        if not self.applicant_id:
            raise ValueError("申请人 ID 不能为空")

    def approve(self, approver_id: str, approver_name: str, comment: Optional[str] = None) -> None:
        """
        审批通过操作
        
        将申请状态变更为 APPROVED，并创建退役历史记录。
        调用此方法前应验证当前状态为 PENDING。
        
        参数:
            approver_id: 审批人 ID
            approver_name: 审批人姓名
            comment: 审批意见，可选
        
        异常:
            ValueError: 当状态不是 PENDING 时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(f"当前状态不允许审批操作，当前状态: {self.status.value}")
        
        self.status = RetirementStatus.APPROVED
        self.updated_at = datetime.now()
        
        record = RetirementRecord(
            application_id=self.id,
            asset_id=self.asset_id,
            result="approved",
            approved_by=approver_id,
            approver_name=approver_name,
            comment=comment,
            retired_at=datetime.now(),
            estimated_residual_value=self.estimated_residual_value,
        )
        self.history.append(record)

    def reject(self, approver_id: str, approver_name: str, comment: str) -> None:
        """
        审批驳回操作
        
        将申请状态变更为 REJECTED，并创建驳回记录。
        驳回后资产状态保持不变，不触发退役流程。
        
        参数:
            approver_id: 审批人 ID
            approver_name: 审批人姓名
            comment: 驳回原因，必填
        
        异常:
            ValueError: 当状态不是 PENDING 或驳回原因为空时抛出
        """
        if self.status != RetirementStatus.PENDING:
            raise ValueError(f"当前状态不允许审批操作，当前状态: {self.status.value}")
        if not comment or len(comment.strip()) == 0:
            raise ValueError("驳回原因不能为空")
        
        self.status = RetirementStatus.REJECTED
        self.updated_at = datetime.now()
        
        record = RetirementRecord(
            application_id=self.id,
            asset_id=self.asset_id,
            result="rejected",
            approved_by=approver_id,
            approver_name=approver_name,
            comment=comment,
            retired_at=datetime.now(),
            estimated_residual_value=self.estimated_residual_value,
        )
        self.history.append(record)

    def is_approved(self) -> bool:
        """
        判断申请是否已通过审批
        
        返回:
            bool: True 表示已通过审批
        """
        return self.status == RetirementStatus.APPROVED

    def is_rejected(self) -> bool:
        """
        判断申请是否已被驳回
        
        返回:
            bool: True 表示已被驳回
        """
        return self.status == RetirementStatus.REJECTED

    def is_pending(self) -> bool:
        """
        判断申请是否处于待审批状态
        
        返回:
            bool: True 表示待审批状态
        """
        return self.status == RetirementStatus.PENDING

    def to_dict(self) -> dict:
        """
        转换为字典格式
        
        包含申请的所有字段信息，history 字段包含完整的退役记录列表。
        
        返回:
            dict: 申请信息字典
        
        示例:
            >>> app.to_dict()
            {'id': 'RA-2024-0001', 'asset_id': 'AST-2024-001', ...}
        """
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "reason": self.reason,
            "estimated_residual_value": self.estimated_residual_value,
            "applicant_id": self.applicant_id,
            "applicant_name": self.applicant_name,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "history": [record.to_dict() for record in self.history],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RetirementApplication":
        """
        从字典创建申请实体
        
        参数:
            data: 包含申请信息的字典
        
        返回:
            RetirementApplication: 新创建的申请实体实例
        """
        status = RetirementStatus(data.get("status", "pending"))
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        elif created_at is None:
            created_at = datetime.now()
        
        updated_at = data.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        elif updated_at is None:
            updated_at = datetime.now()
        
        return cls(
            id=data.get("id"),
            asset_id=data["asset_id"],
            reason=data["reason"],
            estimated_residual_value=data.get("estimated_residual_value", 0.0),
            applicant_id=data["applicant_id"],
            applicant_name=data.get("applicant_name", ""),
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )


def check_asset_eligibility(asset_status: AssetRetirementStatus) -> bool:
    """
    检查资产是否符合报废申请条件
    
    只有状态为 IN_USE 的资产才能提交报废申请。
    已报废或待审批状态的资产不允许再次申请。
    
    参数:
        asset_status: 资产当前状态
    
    返回:
        bool: True 表示可以提交报废申请
    
    示例:
        >>> check_asset_eligibility(AssetRetirementStatus.IN_USE)
        True
        >>> check_asset_eligibility(AssetRetirementStatus.RETIRED)
        False
    """
    return asset_status == AssetRetirementStatus.IN_USE


def get_retirement_state_target(approval_result: RetirementStatus) -> AssetRetirementStatus:
    """
    根据审批结果获取目标资产状态
    
    审批通过后资产状态变为 RETIRED，
    审批驳回后资产保持 IN_USE 状态。
    
    参数:
        approval_result: 审批结果
    
    返回:
        AssetRetirementStatus: 目标资产状态
    
    示例:
        >>> get_retirement_state_target(RetirementStatus.APPROVED)
        <AssetRetirementStatus.RETIRED: 'retired'>
    """
    if approval_result == RetirementStatus.APPROVED:
        return AssetRetirementStatus.RETIRED
    return AssetRetirementStatus.IN_USE