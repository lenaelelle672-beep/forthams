"""
资产报废退役流程 - 响应模式定义

本模块定义资产报废退役流程相关的 API 响应模式（Pydantic Schema），
覆盖 RetirementApplication、ApprovalChain、StateTransitionLog 等核心实体。

变更记录:
   - Iteration-8: 初始实现，支撑审批链路引擎与历史记录持久化功能

相关模块:
   - src.api.schemas.retirement_request: 申请请求模式
   - src.api.schemas.approval_schemas: 审批相关模式
   - src.domain.services.retirement_service: 退役服务层
   - src.domain.services.approval_chain_service: 审批链服务层
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# 枚举定义
# =============================================================================

class AssetStatus(str, Enum):
    """资产状态枚举"""
    IN_USE = "在用"
    IDLE = "闲置"
    UNDER_REPAIR = "维修中"
    PENDING_APPROVAL = "待审批"
    APPROVAL_IN_PROGRESS = "审批中"
    RETIRED = "已报废"
    RECYCLED = "已回收"


class ApplicationStatus(str, Enum):
    """报废申请状态枚举"""
    DRAFT = "草稿"
    PENDING = "待审批"
    IN_APPROVAL = "审批中"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    WITHDRAWN = "已撤回"


class DisposalMethod(str, Enum):
    """处置方式枚举"""
    SCRAP_DESTROY = "报废销毁"
    TRANSFER = "转让"
    RECYCLE_REUSE = "回收再利用"
    DONATION = "捐赠"


class ApprovalDecision(str, Enum):
    """审批决策枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class TriggerType(str, Enum):
    """状态变更触发类型枚举"""
    MANUAL = "manual"
    AUTO = "auto"
    APPROVAL = "approval"


class RouterType(str, Enum):
    """审批路由类型枚举"""
    SERIAL = "serial"  # 串行审批
    COUNTER_SIGN = "counter_sign"  # 会签（全部通过）
    OR_SIGN = "or_sign"  # 或签（任一通过）


# =============================================================================
# 通用响应包装器
# =============================================================================

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一 API 响应包装器
    
    属性:
        code: 业务状态码（0=成功，非0=失败）
        message: 响应消息
        data: 响应数据（泛型）
        timestamp: 响应时间戳
    """
    model_config = ConfigDict(from_attributes=True)
    
    code: int = Field(default=0, description="业务状态码")
    message: str = Field(default="success", description="响应消息")
    data: Optional[T] = Field(default=None, description="响应数据")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="响应时间戳")


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应包装器
    
    属性:
        items: 当前页数据列表
        total: 总记录数
        page: 当前页码（从1开始）
        page_size: 每页记录数
        total_pages: 总页数
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: List[T] = Field(default_factory=list, description="当前页数据")
    total: int = Field(default=0, description="总记录数")
    page: int = Field(default=1, ge=1, description="当前页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页记录数")
    total_pages: int = Field(default=0, description="总页数")


# =============================================================================
# 资产相关响应模式
# =============================================================================

class AssetSummaryResponse(BaseModel):
    """资产摘要响应（用于列表展示）
    
    属性:
        id: 资产唯一标识符
        asset_code: 资产编号
        asset_name: 资产名称
        category: 资产类别
        status: 当前状态
        original_value: 原值
        current_value: 当前值
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(description="资产唯一标识符")
    asset_code: str = Field(max_length=64, description="资产编号")
    asset_name: str = Field(max_length=256, description="资产名称")
    category: str = Field(description="资产类别")
    status: AssetStatus = Field(description="当前状态")
    original_value: Decimal = Field(max_digits=15, decimal_places=2, description="原值")
    current_value: Decimal = Field(max_digits=15, decimal_places=2, description="当前值")


class AssetDetailResponse(AssetSummaryResponse):
    """资产详情响应
    
    继承 AssetSummaryResponse，额外包含采购日期、折旧状态等详细信息。
    """
    model_config = ConfigDict(from_attributes=True)
    
    purchase_date: Optional[datetime] = Field(default=None, description="采购日期")
    depreciation_status: Optional[str] = Field(default=None, description="折旧状态")
    location: Optional[str] = Field(default=None, description="存放位置")
    department: Optional[str] = Field(default=None, description="所属部门")


# =============================================================================
# 报废申请相关响应模式
# =============================================================================

class RetirementApplicationResponse(BaseModel):
    """报废申请响应模式
    
    属性:
        id: 申请唯一标识符
        asset_id: 关联资产ID
        asset_summary: 资产摘要信息
        applicant_id: 申请人ID
        applicant_name: 申请人姓名
        reason: 报废原因
        disposal_method: 处置方式
        estimated_value: 残值评估
        status: 申请状态
        created_at: 创建时间
        updated_at: 更新时间
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(description="申请唯一标识符")
    asset_id: UUID = Field(description="关联资产ID")
    asset_summary: Optional[AssetSummaryResponse] = Field(default=None, description="资产摘要信息")
    applicant_id: UUID = Field(description="申请人ID")
    applicant_name: Optional[str] = Field(default=None, description="申请人姓名")
    reason: str = Field(description="报废原因")
    disposal_method: DisposalMethod = Field(description="处置方式")
    estimated_value: Decimal = Field(max_digits=15, decimal_places=2, description="残值评估")
    status: ApplicationStatus = Field(description="申请状态")
    current_node_order: Optional[int] = Field(default=None, description="当前审批节点序号")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")


class RetirementApplicationDetailResponse(RetirementApplicationResponse):
    """报废申请详情响应
    
    继承 RetirementApplicationResponse，额外包含审批链路和历史记录。
    """
    model_config = ConfigDict(from_attributes=True)
    
    approval_chain: Optional[List["ApprovalNodeResponse"]] = Field(
        default=None, description="审批链路节点列表"
    )
    state_history: Optional[List["StateTransitionLogResponse"]] = Field(
        default=None, description="状态变更历史"
    )
    can_withdraw: bool = Field(default=False, description="是否可撤回")
    can_edit: bool = Field(default=False, description="是否可编辑")


class RetirementApplicationListResponse(PaginatedResponse[RetirementApplicationResponse]):
    """报废申请分页列表响应"""
    pass


# =============================================================================
# 审批链路相关响应模式
# =============================================================================

class ApprovalNodeResponse(BaseModel):
    """审批节点响应模式
    
    属性:
        id: 节点唯一标识符
        application_id: 关联申请ID
        node_order: 节点顺序
        approver_id: 审批人ID
        approver_name: 审批人姓名
        router_type: 路由类型
        decision: 审批决策
        comment: 审批意见
        decided_at: 决策时间
        created_at: 创建时间
        is_timeout: 是否已超时
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(description="节点唯一标识符")
    application_id: UUID = Field(description="关联申请ID")
    node_order: int = Field(ge=1, description="节点顺序")
    approver_id: UUID = Field(description="审批人ID")
    approver_name: Optional[str] = Field(default=None, description="审批人姓名")
    router_type: RouterType = Field(description="路由类型")
    decision: ApprovalDecision = Field(default=ApprovalDecision.PENDING, description="审批决策")
    comment: Optional[str] = Field(default=None, description="审批意见")
    decided_at: Optional[datetime] = Field(default=None, description="决策时间")
    decided_by: Optional[UUID] = Field(default=None, description="决策人ID")
    created_at: datetime = Field(description="创建时间")
    is_timeout: bool = Field(default=False, description="是否已超时")
    timeout_threshold_hours: int = Field(default=72, description="超时阈值（小时）")


class ApprovalChainResponse(BaseModel):
    """审批链路响应模式
    
    属性:
        id: 链路唯一标识符
        application_id: 关联申请ID
        nodes: 审批节点列表
        current_node_order: 当前节点序号
        is_complete: 是否已完成
        completed_at: 完成时间
        created_at: 创建时间
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(description="链路唯一标识符")
    application_id: UUID = Field(description="关联申请ID")
    nodes: List[ApprovalNodeResponse] = Field(default_factory=list, description="审批节点列表")
    current_node_order: Optional[int] = Field(default=None, description="当前节点序号")
    is_complete: bool = Field(default=False, description="是否已完成")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    created_at: datetime = Field(description="创建时间")


class ApprovalDecisionRequest(BaseModel):
    """审批决策请求模式（用于响应中引用）
    
    属性:
        decision: 决策结果
        comment: 审批意见
        node_order: 节点序号
    """
    model_config = ConfigDict(from_attributes=True)
    
    decision: ApprovalDecision = Field(description="决策结果")
    comment: Optional[str] = Field(default=None, max_length=1000, description="审批意见")
    node_order: int = Field(ge=1, description="节点序号")


class ApprovalResultResponse(BaseModel):
    """审批结果响应模式
    
    属性:
        success: 是否成功
        message: 结果消息
        next_node_order: 下一节点序号（若有）
        application_status: 申请最终状态
        asset_status: 资产最终状态（审批完成后）
    """
    model_config = ConfigDict(from_attributes=True)
    
    success: bool = Field(description="是否成功")
    message: str = Field(description="结果消息")
    next_node_order: Optional[int] = Field(default=None, description="下一节点序号")
    application_status: Optional[ApplicationStatus] = Field(default=None, description="申请状态")
    asset_status: Optional[AssetStatus] = Field(default=None, description="资产状态")


# =============================================================================
# 状态变更日志相关响应模式
# =============================================================================

class StateTransitionLogResponse(BaseModel):
    """状态变更日志响应模式
    
    属性:
        id: 日志唯一标识符
        asset_id: 资产ID
        from_status: 原状态
        to_status: 新状态
        trigger_type: 触发类型
        operator_id: 操作人员ID
        operator_name: 操作人员姓名
        metadata: 附加元数据
        created_at: 变更时间
        hash: 审计哈希值（用于防篡改）
        previous_hash: 前一条记录的哈希值
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(description="日志唯一标识符")
    asset_id: UUID = Field(description="资产ID")
    from_status: Optional[str] = Field(default=None, description="原状态")
    to_status: str = Field(description="新状态")
    trigger_type: TriggerType = Field(description="触发类型")
    operator_id: Optional[UUID] = Field(default=None, description="操作人员ID")
    operator_name: Optional[str] = Field(default=None, description="操作人员姓名")
    metadata: Optional[dict] = Field(default=None, description="附加元数据")
    created_at: datetime = Field(description="变更时间")
    hash: Optional[str] = Field(default=None, description="审计哈希值")
    previous_hash: Optional[str] = Field(default=None, description="前一条记录的哈希值")


class StateHistoryResponse(BaseModel):
    """资产状态历史响应模式
    
    属性:
        asset_id: 资产ID
        asset_code: 资产编号
        asset_name: 资产名称
        current_status: 当前状态
        transitions: 状态变更记录列表
        total_count: 记录总数
    """
    model_config = ConfigDict(from_attributes=True)
    
    asset_id: UUID = Field(description="资产ID")
    asset_code: str = Field(description="资产编号")
    asset_name: str = Field(description="资产名称")
    current_status: AssetStatus = Field(description="当前状态")
    transitions: List[StateTransitionLogResponse] = Field(
        default_factory=list, description="状态变更记录列表"
    )
    total_count: int = Field(default=0, description="记录总数")


class StateHistoryListResponse(PaginatedResponse[StateTransitionLogResponse]):
    """状态历史分页列表响应"""
    pass


class AuditChainIntegrityResponse(BaseModel):
    """审计链完整性验证响应
    
    属性:
        is_valid: 链是否完整未被篡改
        checked_at: 校验时间
        logs_checked: 校验的日志条数
        first_invalid_index: 首个无效记录索引（若有）
        error_message: 错误信息（若有）
    """
    model_config = ConfigDict(from_attributes=True)
    
    is_valid: bool = Field(description="链是否完整")
    checked_at: datetime = Field(default_factory=datetime.utcnow, description="校验时间")
    logs_checked: int = Field(default=0, description="校验的日志条数")
    first_invalid_index: Optional[int] = Field(default=None, description="首个无效记录索引")
    error_message: Optional[str] = Field(default=None, description="错误信息")


# =============================================================================
# 业务错误响应模式
# =============================================================================

class RetirementErrorResponse(BaseModel):
    """资产退役业务错误响应
    
    属性:
        error_code: 错误码
        error_message: 错误消息
        details: 错误详情（可选）
        suggestion: 解决建议（可选）
    """
    model_config = ConfigDict(from_attributes=True)
    
    error_code: str = Field(description="错误码")
    error_message: str = Field(description="错误消息")
    details: Optional[dict] = Field(default=None, description="错误详情")
    suggestion: Optional[str] = Field(default=None, description="解决建议")


class ConcurrentApplicationErrorResponse(RetirementErrorResponse):
    """并发申请冲突错误响应
    
    继承 RetirementErrorResponse，额外包含冲突资产的申请信息。
    """
    model_config = ConfigDict(from_attributes=True)
    
    conflicting_application_id: Optional[UUID] = Field(
        default=None, description="冲突的申请ID"
    )
    conflicting_status: Optional[ApplicationStatus] = Field(
        default=None, description="冲突申请的状态"
    )


# =============================================================================
# 统计与仪表盘响应模式
# =============================================================================

class RetirementStatisticsResponse(BaseModel):
    """报废统计响应模式
    
    属性:
        total_applications: 总申请数
        pending_count: 待审批数
        in_approval_count: 审批中数
        approved_count: 已批准数
        rejected_count: 已拒绝数
        withdrawn_count: 已撤回数
        average_processing_days: 平均处理天数
    """
    model_config = ConfigDict(from_attributes=True)
    
    total_applications: int = Field(default=0, description="总申请数")
    pending_count: int = Field(default=0, description="待审批数")
    in_approval_count: int = Field(default=0, description="审批中数")
    approved_count: int = Field(default=0, description="已批准数")
    rejected_count: int = Field(default=0, description="已拒绝数")
    withdrawn_count: int = Field(default=0, description="已撤回数")
    average_processing_days: Optional[float] = Field(
        default=None, description="平均处理天数"
    )


class ApprovalWorkflowProgressResponse(BaseModel):
    """审批工作流进度响应
    
    属性:
        application_id: 申请ID
        total_nodes: 审批节点总数
        completed_nodes: 已完成节点数
        current_node: 当前节点信息
        progress_percentage: 完成百分比
        estimated_completion: 预计完成时间（若有）
    """
    model_config = ConfigDict(from_attributes=True)
    
    application_id: UUID = Field(description="申请ID")
    total_nodes: int = Field(default=0, description="审批节点总数")
    completed_nodes: int = Field(default=0, description="已完成节点数")
    current_node: Optional[ApprovalNodeResponse] = Field(
        default=None, description="当前节点信息"
    )
    progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0, description="完成百分比")
    estimated_completion: Optional[datetime] = Field(
        default=None, description="预计完成时间"
    )


# =============================================================================
# 回调与通知响应模式
# =============================================================================

class RetirementNotificationResponse(BaseModel):
    """退役流程通知响应
    
    属性:
        recipient_id: 接收人ID
        recipient_name: 接收人姓名
        notification_type: 通知类型
        title: 通知标题
        content: 通知内容
        application_id: 关联申请ID
        related_asset_code: 关联资产编号
        sent_at: 发送时间
        read: 是否已读
    """
    model_config = ConfigDict(from_attributes=True)
    
    recipient_id: UUID = Field(description="接收人ID")
    recipient_name: Optional[str] = Field(default=None, description="接收人姓名")
    notification_type: str = Field(description="通知类型")
    title: str = Field(description="通知标题")
    content: str = Field(description="通知内容")
    application_id: Optional[UUID] = Field(default=None, description="关联申请ID")
    related_asset_code: Optional[str] = Field(default=None, description="关联资产编号")
    sent_at: datetime = Field(description="发送时间")
    read: bool = Field(default=False, description="是否已读")