# backend/schemas/retirement_schema.py
"""
资产报废/退役流程 Schema 定义

SWARM-002 规格实现：
- 用户可以提交资产报废申请
- 系统自动触发审批链路
- 记录完整的资产退役历史记录

参考: plan.md Phase 1/2

Version: 1.0.0
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Any, Dict
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RetirementReason(str, Enum):
    """
    资产退役原因枚举

    - CONDEMNED: 报废/淘汰
    - DAMAGED: 损坏无法修复
    - UPGRADE: 升级替换
    - OTHER: 其他原因
    """
    CONDEMNED = "CONDEMNED"
    DAMAGED = "DAMAGED"
    UPGRADE = "UPGRADE"
    OTHER = "OTHER"


class DisposalMethod(str, Enum):
    """
    资产处置方式枚举

    - SCRAP: 报废/拆解
    - AUCTION: 拍卖
    - TRANSFER: 转让
    - DONATION: 捐赠
    """
    SCRAP = "SCRAP"
    AUCTION = "AUCTION"
    TRANSFER = "TRANSFER"
    DONATION = "DONATION"


class RetirementStatus(str, Enum):
    """
    报废申请状态枚举

    - DRAFT: 草稿状态（可编辑）
    - PENDING: 待审批
    - APPROVED: 审批通过
    - REJECTED: 审批驳回
    - COMPLETED: 已完成退役
    """
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"


class ApprovalDecision(str, Enum):
    """
    审批决策枚举

    - APPROVE: 审批通过
    - REJECT: 审批驳回
    """
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class RetirementEventType(str, Enum):
    """
    资产退役历史事件类型枚举

    - REQUEST_CREATED: 申请创建
    - APPROVAL_GRANTED: 审批通过
    - REJECTED: 审批驳回
    - COMPLETED: 退役完成
    """
    REQUEST_CREATED = "REQUEST_CREATED"
    APPROVAL_GRANTED = "APPROVAL_GRANTED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"


# ============================================================================
# Request Schemas
# ============================================================================

class RetirementRequestCreate(BaseModel):
    """
    创建资产报废申请的请求 Schema

    Attributes:
        asset_id: 资产ID（必填）
        retirement_reason: 退役原因（必填）
        estimated_residual_value: 预估残值（必填，非负）
        disposal_method: 处置方式（必填）
        notes: 补充说明（可选）
    """
    asset_id: UUID = Field(..., description="资产ID")
    retirement_reason: RetirementReason = Field(..., description="退役原因")
    estimated_residual_value: Decimal = Field(
        ...,
        ge=Decimal("0"),
        description="预估残值（元），必须非负"
    )
    disposal_method: DisposalMethod = Field(..., description="处置方式")
    notes: Optional[str] = Field(None, max_length=1000, description="补充说明")

    @field_validator("estimated_residual_value")
    @classmethod
    def validate_residual_value(cls, v: Decimal) -> Decimal:
        """验证残值非负且精度不超过2位小数"""
        if v < Decimal("0"):
            raise ValueError("预估残值不能为负数")
        return round(v, 2)


class RetirementRequestUpdate(BaseModel):
    """
    更新资产报废申请的请求 Schema（仅限草稿状态）

    Attributes:
        retirement_reason: 退役原因（可选）
        estimated_residual_value: 预估残值（可选）
        disposal_method: 处置方式（可选）
        notes: 补充说明（可选）
    """
    retirement_reason: Optional[RetirementReason] = Field(None, description="退役原因")
    estimated_residual_value: Optional[Decimal] = Field(
        None,
        ge=Decimal("0"),
        description="预估残值（元）"
    )
    disposal_method: Optional[DisposalMethod] = Field(None, description="处置方式")
    notes: Optional[str] = Field(None, max_length=1000, description="补充说明")

    @field_validator("estimated_residual_value")
    @classmethod
    def validate_residual_value(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """验证残值非负"""
        if v is not None and v < Decimal("0"):
            raise ValueError("预估残值不能为负数")
        return round(v, 2) if v is not None else v


class RetirementApproveRequest(BaseModel):
    """
    审批通过的请求 Schema

    Attributes:
        comments: 审批意见（可选）
    """
    comments: Optional[str] = Field(None, max_length=500, description="审批意见")


class RetirementRejectRequest(BaseModel):
    """
    审批驳回的请求 Schema

    Attributes:
        reason: 驳回原因（必填）
    """
    reason: str = Field(..., min_length=1, max_length=500, description="驳回原因")


# ============================================================================
# Response Schemas
# ============================================================================

class RetirementRequestResponse(BaseModel):
    """
    资产报废申请响应 Schema

    Attributes:
        id: 申请ID
        asset_id: 资产ID
        requester_id: 申请人ID
        retirement_reason: 退役原因
        estimated_residual_value: 预估残值
        disposal_method: 处置方式
        current_status: 当前状态
        notes: 补充说明
        created_at: 创建时间
        updated_at: 更新时间
    """
    id: UUID = Field(..., description="申请ID")
    asset_id: UUID = Field(..., description="资产ID")
    requester_id: UUID = Field(..., description="申请人ID")
    retirement_reason: RetirementReason = Field(..., description="退役原因")
    estimated_residual_value: Decimal = Field(..., description="预估残值")
    disposal_method: DisposalMethod = Field(..., description="处置方式")
    current_status: RetirementStatus = Field(..., description="当前状态")
    notes: Optional[str] = Field(None, description="补充说明")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = {"from_attributes": True}


class RetirementRequestListResponse(BaseModel):
    """
    资产报废申请列表响应 Schema（分页）

    Attributes:
        items: 申请列表
        total: 总数
        page: 当前页
        page_size: 每页大小
        total_pages: 总页数
    """
    items: List[RetirementRequestResponse] = Field(..., description="申请列表")
    total: int = Field(..., ge=0, description="总数")
    page: int = Field(..., ge=1, description="当前页")
    page_size: int = Field(..., ge=1, le=100, description="每页大小")
    total_pages: int = Field(..., ge=0, description="总页数")


class ApprovalRecordResponse(BaseModel):
    """
    审批记录响应 Schema

    Attributes:
        id: 审批记录ID
        request_id: 报废申请ID
        approver_id: 审批人ID
        approver_name: 审批人姓名
        approval_level: 审批层级
        decision: 决策结果
        comments: 审批意见
        created_at: 创建时间
        decided_at: 决策时间
    """
    id: UUID = Field(..., description="审批记录ID")
    request_id: UUID = Field(..., description="报废申请ID")
    approver_id: Optional[UUID] = Field(None, description="审批人ID")
    approver_name: Optional[str] = Field(None, description="审批人姓名")
    approval_level: int = Field(..., ge=1, description="审批层级")
    decision: Optional[ApprovalDecision] = Field(None, description="决策结果")
    comments: Optional[str] = Field(None, description="审批意见")
    created_at: datetime = Field(..., description="创建时间")
    decided_at: Optional[datetime] = Field(None, description="决策时间")

    model_config = {"from_attributes": True}


class RetirementHistoryEvent(BaseModel):
    """
    资产退役历史事件 Schema

    Attributes:
        id: 历史记录ID
        asset_id: 资产ID
        event_type: 事件类型
        event_data: 事件上下文数据（JSON）
        operator_id: 操作人ID
        operator_name: 操作人姓名
        event_timestamp: 事件时间戳
    """
    id: UUID = Field(..., description="历史记录ID")
    asset_id: UUID = Field(..., description="资产ID")
    event_type: RetirementEventType = Field(..., description="事件类型")
    event_data: Dict[str, Any] = Field(..., description="事件上下文数据")
    operator_id: Optional[UUID] = Field(None, description="操作人ID")
    operator_name: Optional[str] = Field(None, description="操作人姓名")
    event_timestamp: datetime = Field(..., description="事件时间戳")

    model_config = {"from_attributes": True}


class RetirementHistoryListResponse(BaseModel):
    """
    资产退役历史列表响应 Schema（分页）

    Attributes:
        items: 历史事件列表（按时间升序）
        total: 总数
    """
    items: List[RetirementHistoryEvent] = Field(..., description="历史事件列表")
    total: int = Field(..., ge=0, description="总数")


# ============================================================================
# Error Schemas
# ============================================================================

class RetirementErrorResponse(BaseModel):
    """
    资产报废流程错误响应 Schema

    Attributes:
        error_code: 错误码
        message: 错误信息
        details: 详细信息（可选）
    """
    error_code: str = Field(..., description="错误码")
    message: str = Field(..., description="错误信息")
    details: Optional[Dict[str, Any]] = Field(None, description="详细信息")


# 错误码常量定义
class RetirementErrorCode:
    """资产报废相关错误码定义"""
    ASSET_NOT_FOUND = "ASSET_NOT_FOUND"
    RETIREMENT_CONFLICT = "RETIREMENT_CONFLICT"
    APPROVAL_ALREADY_PROCESSED = "APPROVAL_ALREADY_PROCESSED"
    INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    RULE_ENGINE_ERROR = "RULE_ENGINE_ERROR"