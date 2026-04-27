"""
资产报废退役流程 API Schemas 定义

该模块定义了资产退役申请、审批链路、状态变更日志等核心实体的 Pydantic Schema。
符合 SWARM-002 Iteration 8 规格要求。

主要功能：
- 报废申请 CRUD 操作的数据模型定义
- 审批链路引擎数据结构
- 状态变更日志记录模型
- 查询/筛选参数定义

Author: SWARM Team
Version: 1.0.0
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# 枚举定义
# ============================================================================


class AssetCategory(str, Enum):
    """资产类别枚举"""
    IT设备 = "IT设备"
    生产设备 = "生产设备"
    办公设备 = "办公设备"
    其他 = "其他"


class AssetStatus(str, Enum):
    """资产状态枚举"""
    在用 = "在用"
    闲置 = "闲置"
    维修中 = "维修中"
    待审批 = "待审批"
    审批中 = "审批中"
    已报废 = "已报废"
    已回收 = "已回收"


class RetirementStatus(str, Enum):
    """报废申请状态枚举"""
    草稿 = "草稿"
    待审批 = "待审批"
    审批中 = "审批中"
    已批准 = "已批准"
    已拒绝 = "已拒绝"
    已撤回 = "已撤回"


class DisposalMethod(str, Enum):
    """处置方式枚举"""
    报废销毁 = "报废销毁"
    转让 = "转让"
    回收再利用 = "回收再利用"
    捐赠 = "捐赠"


class ApprovalDecision(str, Enum):
    """审批决定枚举"""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    skipped = "skipped"


class TriggerType(str, Enum):
    """状态变更触发类型枚举"""
    manual = "manual"
    auto = "auto"
    approval = "approval"


class RouterStrategy(str, Enum):
    """审批路由策略枚举"""
    SERIAL = "serial"  # 串行路由
    COUNTER_SIGN = "counter_sign"  # 会签路由（全部通过）
    OR_SIGN = "or_sign"  # 或签路由（任一通过）


# ============================================================================
# 资产状态变更日志 Schema
# ============================================================================


class StateTransitionLogBase(BaseModel):
    """状态变更日志基础模型"""
    asset_id: UUID = Field(..., description="资产ID")
    from_status: str = Field(..., max_length=32, description="源状态")
    to_status: str = Field(..., max_length=32, description="目标状态")
    trigger_type: TriggerType = Field(..., description="触发类型")


class StateTransitionLogCreate(StateTransitionLogBase):
    """创建状态变更日志请求"""
    operator_id: Optional[UUID] = Field(None, description="操作人ID")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class StateTransitionLogResponse(StateTransitionLogBase):
    """状态变更日志响应模型"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="日志ID")
    operator_id: Optional[UUID] = Field(None, description="操作人ID")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")
    created_at: datetime = Field(..., description="创建时间")
    hash_chain: Optional[str] = Field(None, description="哈希链校验值")


# ============================================================================
# 审批链路节点 Schema
# ============================================================================


class ApprovalNodeBase(BaseModel):
    """审批节点基础模型"""
    approver_id: UUID = Field(..., description="审批人ID")
    decision: ApprovalDecision = Field(default=ApprovalDecision.pending, description="审批决定")
    comment: Optional[str] = Field(None, max_length=1000, description="审批意见")
    decided_at: Optional[datetime] = Field(None, description="决定时间")


class ApprovalNodeCreate(ApprovalNodeBase):
    """创建审批节点请求"""
    node_order: int = Field(..., ge=1, le=5, description="节点顺序（1-5）")


class ApprovalNodeResponse(ApprovalNodeBase):
    """审批节点响应模型"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="节点ID")
    application_id: Optional[UUID] = Field(None, description="申请ID")
    node_order: int = Field(..., description="节点顺序")
    created_at: datetime = Field(..., description="创建时间")


class ApprovalChainBase(BaseModel):
    """审批链路基础模型"""
    application_id: UUID = Field(..., description="申请ID")
    strategy: RouterStrategy = Field(default=RouterStrategy.SERIAL, description="路由策略")


class ApprovalChainCreate(ApprovalChainBase):
    """创建审批链路请求"""
    nodes: List[ApprovalNodeCreate] = Field(..., min_length=1, max_length=5, description="审批节点列表")
    
    @field_validator('nodes')
    @classmethod
    def validate_node_count(cls, v: List[ApprovalNodeCreate]) -> List[ApprovalNodeCreate]:
        """验证节点数量不超过5个"""
        if len(v) > 5:
            raise ValueError("审批层级最多支持5级节点")
        return v


class ApprovalChainResponse(ApprovalChainBase):
    """审批链路响应模型"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="链路ID")
    nodes: List[ApprovalNodeResponse] = Field(default_factory=list, description="审批节点列表")
    created_at: datetime = Field(..., description="创建时间")


# ============================================================================
# 报废申请 Schema
# ============================================================================


class RetirementApplicationBase(BaseModel):
    """报废申请基础模型"""
    reason: str = Field(..., min_length=1, max_length=2000, description="报废原因")
    disposal_method: DisposalMethod = Field(..., description="处置方式")
    estimated_value: Optional[Decimal] = Field(
        default=None, 
        ge=Decimal("0"), 
        le=Decimal("999999999999.99"),
        description="预估残值"
    )


class RetirementApplicationCreate(RetirementApplicationBase):
    """创建报废申请请求"""
    asset_id: UUID = Field(..., description="资产ID")


class RetirementApplicationUpdate(BaseModel):
    """更新报废申请请求（仅草稿状态可更新）"""
    reason: Optional[str] = Field(None, min_length=1, max_length=2000, description="报废原因")
    disposal_method: Optional[DisposalMethod] = Field(None, description="处置方式")
    estimated_value: Optional[Decimal] = Field(
        default=None, 
        ge=Decimal("0"), 
        le=Decimal("999999999999.99"),
        description="预估残值"
    )


class RetirementApplicationSubmitRequest(BaseModel):
    """提交报废申请请求（从草稿转为待审批）"""
    pass


class RetirementApplicationResponse(RetirementApplicationBase):
    """报废申请响应模型"""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="申请ID")
    asset_id: UUID = Field(..., description="资产ID")
    applicant_id: UUID = Field(..., description="申请人ID")
    status: RetirementStatus = Field(..., description="申请状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class RetirementApplicationDetailResponse(RetirementApplicationResponse):
    """报废申请详情响应模型（含审批链和状态变更历史）"""
    approval_chain: Optional[ApprovalChainResponse] = Field(None, description="审批链路")
    state_logs: List[StateTransitionLogResponse] = Field(default_factory=list, description="状态变更日志")


class RetirementApplicationListResponse(BaseModel):
    """报废申请列表响应模型"""
    items: List[RetirementApplicationResponse] = Field(default_factory=list, description="申请列表")
    total: int = Field(..., ge=0, description="总数")
    page: int = Field(default=1, ge=1, description="当前页")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")


# ============================================================================
# 审批操作 Schema
# ============================================================================


class ApprovalDecisionRequest(BaseModel):
    """审批决定请求"""
    decision: ApprovalDecision = Field(..., description="审批决定（approved/rejected）")
    comment: Optional[str] = Field(None, max_length=1000, description="审批意见")


class ApprovalDecisionResponse(BaseModel):
    """审批决定响应"""
    node_id: UUID = Field(..., description="节点ID")
    decision: ApprovalDecision = Field(..., description="审批决定")
    approved_at: datetime = Field(..., description="决定时间")
    comment: Optional[str] = Field(None, description="审批意见")
    next_node_id: Optional[UUID] = Field(None, description="下一节点ID（如有）")


class WithdrawalRequest(BaseModel):
    """撤回申请请求"""
    reason: Optional[str] = Field(None, max_length=500, description="撤回原因")


class WithdrawalResponse(BaseModel):
    """撤回申请响应"""
    application_id: UUID = Field(..., description="申请ID")
    status: RetirementStatus = Field(..., description="更新后的状态")
    withdrawn_at: datetime = Field(..., description="撤回时间")


# ============================================================================
# 查询参数 Schema
# ============================================================================


class RetirementApplicationQuery(BaseModel):
    """报废申请查询参数"""
    asset_id: Optional[UUID] = Field(None, description="资产ID")
    applicant_id: Optional[UUID] = Field(None, description="申请人ID")
    status: Optional[RetirementStatus] = Field(None, description="申请状态")
    disposal_method: Optional[DisposalMethod] = Field(None, description="处置方式")
    created_after: Optional[datetime] = Field(None, description="创建时间（开始）")
    created_before: Optional[datetime] = Field(None, description="创建时间（结束）")
    page: int = Field(default=1, ge=1, description="当前页")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")


class StateTransitionLogQuery(BaseModel):
    """状态变更日志查询参数"""
    asset_id: Optional[UUID] = Field(None, description="资产ID")
    from_status: Optional[str] = Field(None, description="源状态")
    to_status: Optional[str] = Field(None, description="目标状态")
    trigger_type: Optional[TriggerType] = Field(None, description="触发类型")
    operator_id: Optional[UUID] = Field(None, description="操作人ID")
    created_after: Optional[datetime] = Field(None, description="创建时间（开始）")
    created_before: Optional[datetime] = Field(None, description="创建时间（结束）")
    page: int = Field(default=1, ge=1, description="当前页")
    page_size: int = Field(default=50, ge=1, le=200, description="每页数量")


# ============================================================================
# 审批状态查询 Schema
# ============================================================================


class ApprovalStatusResponse(BaseModel):
    """审批状态响应"""
    application_id: UUID = Field(..., description="申请ID")
    current_nodes: List[ApprovalNodeResponse] = Field(default_factory=list, description="当前待审批节点")
    completed_nodes: List[ApprovalNodeResponse] = Field(default_factory=list, description="已完成的节点")
    is_all_approved: bool = Field(..., description="是否全部通过")
    is_rejected: bool = Field(..., description="是否有拒绝")
    strategy: RouterStrategy = Field(..., description="路由策略")


class PendingApprovalsResponse(BaseModel):
    """待审批列表响应"""
    items: List[ApprovalNodeResponse] = Field(default_factory=list, description="待审批节点列表")
    total: int = Field(..., ge=0, description="总数")
    overdue_count: int = Field(default=0, ge=0, description="超时节点数（72小时未处理）")