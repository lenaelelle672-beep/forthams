"""
历史记录查询路由模块。

提供资产状态变更历史、审批流程历史的查询接口。
支持按资产ID、时间范围、操作类型等条件筛选。
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.domain.entities.history import HistoryRecord
from src.domain.services.retirement_service import RetirementService
from src.domain.services.status_history_service import StatusHistoryService
from src.application.services.notification_service import NotificationService
from src.interfaces.api.dependencies.db import get_db_session
from src.interfaces.api.schemas.history_query import HistoryQuerySchema

router = APIRouter(prefix="/history", tags=["历史记录"])


class OperationType(str, Enum):
    """操作类型枚举。"""
    STATE_CHANGE = "state_change"
    APPROVAL_SUBMIT = "approval_submit"
    APPROVAL_APPROVE = "approval_approve"
    APPROVAL_REJECT = "approval_reject"
    APPROVAL_ROLLBACK = "approval_rollback"
    RETIREMENT_APPLY = "retirement_apply"
    RETIREMENT_COMPLETE = "retirement_complete"


class HistoryResponse(BaseModel):
    """历史记录响应模型。"""
    id: str = Field(..., description="记录唯一标识")
    asset_id: str = Field(..., description="资产ID")
    operation_type: OperationType = Field(..., description="操作类型")
    from_status: Optional[str] = Field(None, description="变更前状态")
    to_status: Optional[str] = Field(None, description="变更后状态")
    operator_id: str = Field(..., description="操作人ID")
    operator_name: str = Field(..., description="操作人姓名")
    operator_role: str = Field(..., description="操作人角色")
    remarks: Optional[str] = Field(None, description="备注说明")
    created_at: datetime = Field(..., description="操作时间")
    metadata: Optional[dict] = Field(default_factory=dict, description="附加元数据")

    class Config:
        use_enum_values = True


class HistoryListResponse(BaseModel):
    """历史记录列表响应。"""
    total: int = Field(..., description="记录总数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页记录数")
    items: List[HistoryResponse] = Field(..., description="历史记录列表")


class AssetHistorySummary(BaseModel):
    """资产历史摘要。"""
    asset_id: str = Field(..., description="资产ID")
    total_operations: int = Field(..., description="总操作次数")
    current_status: str = Field(..., description="当前状态")
    last_operation_time: Optional[datetime] = Field(None, description="最近操作时间")
    pending_approvals: int = Field(default=0, description="待审批数量")


@router.get(
    "/assets/{asset_id}",
    response_model=HistoryListResponse,
    summary="查询资产历史记录",
    description="根据资产ID查询其状态变更和操作历史记录，支持分页和筛选。"
)
async def get_asset_history(
    asset_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页记录数"),
    operation_type: Optional[OperationType] = Query(None, description="操作类型筛选"),
    start_date: Optional[datetime] = Query(None, description="开始时间"),
    end_date: Optional[datetime] = Query(None, description="结束时间"),
    db_session=Depends(get_db_session)
) -> HistoryListResponse:
    """
    查询指定资产的历史记录。
    
    Args:
        asset_id: 资产唯一标识
        page: 页码，从1开始
        page_size: 每页记录数，默认20
        operation_type: 操作类型筛选
        start_date: 开始时间筛选
        end_date: 结束时间筛选
        db_session: 数据库会话依赖
    
    Returns:
        HistoryListResponse: 包含分页的历史记录列表
    
    Raises:
        HTTPException: 查询失败时抛出400错误
    """
    try:
        status_history_service = StatusHistoryService(db_session)
        
        query_filter = HistoryQuerySchema(
            asset_id=asset_id,
            operation_type=operation_type.value if operation_type else None,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size
        )
        
        result = await status_history_service.query_history(query_filter)
        
        return HistoryListResponse(
            total=result.get("total", 0),
            page=page,
            page_size=page_size,
            items=[
                HistoryResponse(
                    id=record.id,
                    asset_id=record.asset_id,
                    operation_type=record.operation_type,
                    from_status=record.from_status,
                    to_status=record.to_status,
                    operator_id=record.operator_id,
                    operator_name=record.operator_name,
                    operator_role=record.operator_role,
                    remarks=record.remarks,
                    created_at=record.created_at,
                    metadata=record.metadata or {}
                )
                for record in result.get("items", [])
            ]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"查询资产历史记录失败: {str(e)}"
        )


@router.get(
    "/assets/{asset_id}/summary",
    response_model=AssetHistorySummary,
    summary="查询资产历史摘要",
    description="获取资产的操作统计摘要信息。"
)
async def get_asset_history_summary(
    asset_id: str,
    db_session=Depends(get_db_session)
) -> AssetHistorySummary:
    """
    获取资产历史摘要统计。
    
    Args:
        asset_id: 资产唯一标识
        db_session: 数据库会话依赖
    
    Returns:
        AssetHistorySummary: 资产历史摘要
    
    Raises:
        HTTPException: 查询失败时抛出400错误
    """
    try:
        status_history_service = StatusHistoryService(db_session)
        summary = await status_history_service.get_asset_summary(asset_id)
        
        return AssetHistorySummary(
            asset_id=asset_id,
            total_operations=summary.get("total_operations", 0),
            current_status=summary.get("current_status", "unknown"),
            last_operation_time=summary.get("last_operation_time"),
            pending_approvals=summary.get("pending_approvals", 0)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"查询资产历史摘要失败: {str(e)}"
        )


@router.get(
    "/workflow/{workflow_id}",
    response_model=HistoryListResponse,
    summary="查询工作流历史",
    description="查询特定工作流（审批流程）的历史记录。"
)
async def get_workflow_history(
    workflow_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页记录数"),
    db_session=Depends(get_db_session)
) -> HistoryListResponse:
    """
    查询指定工作流的审批历史记录。
    
    Args:
        workflow_id: 工作流唯一标识
        page: 页码，从1开始
        page_size: 每页记录数，默认20
        db_session: 数据库会话依赖
    
    Returns:
        HistoryListResponse: 包含分页的历史记录列表
    
    Raises:
        HTTPException: 查询失败时抛出400错误
    """
    try:
        retirement_service = RetirementService(db_session)
        
        result = await retirement_service.get_workflow_history(
            workflow_id=workflow_id,
            page=page,
            page_size=page_size
        )
        
        return HistoryListResponse(
            total=result.get("total", 0),
            page=page,
            page_size=page_size,
            items=[
                HistoryResponse(
                    id=record.id,
                    asset_id=record.asset_id,
                    operation_type=record.operation_type,
                    from_status=record.from_status,
                    to_status=record.to_status,
                    operator_id=record.operator_id,
                    operator_name=record.operator_name,
                    operator_role=record.operator_role,
                    remarks=record.remarks,
                    created_at=record.created_at,
                    metadata=record.metadata or {}
                )
                for record in result.get("items", [])
            ]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"查询工作流历史失败: {str(e)}"
        )


@router.get(
    "/approval/{approval_id}/timeline",
    response_model=List[HistoryResponse],
    summary="查询审批时间线",
    description="获取审批流程的完整时间线视图。"
)
async def get_approval_timeline(
    approval_id: str,
    db_session=Depends(get_db_session)
) -> List[HistoryResponse]:
    """
    获取审批流程的完整时间线记录。
    
    Args:
        approval_id: 审批记录唯一标识
        db_session: 数据库会话依赖
    
    Returns:
        List[HistoryResponse]: 按时间排序的审批历史列表
    
    Raises:
        HTTPException: 查询失败时抛出400错误
    """
    try:
        retirement_service = RetirementService(db_session)
        
        records = await retirement_service.get_approval_timeline(approval_id)
        
        return [
            HistoryResponse(
                id=record.id,
                asset_id=record.asset_id,
                operation_type=record.operation_type,
                from_status=record.from_status,
                to_status=record.to_status,
                operator_id=record.operator_id,
                operator_name=record.operator_name,
                operator_role=record.operator_role,
                remarks=record.remarks,
                created_at=record.created_at,
                metadata=record.metadata or {}
            )
            for record in records
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"查询审批时间线失败: {str(e)}"
        )


@router.get(
    "/operators/{operator_id}/actions",
    response_model=HistoryListResponse,
    summary="查询操作人操作记录",
    description="查询指定操作人的所有操作历史记录。"
)
async def get_operator_history(
    operator_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页记录数"),
    start_date: Optional[datetime] = Query(None, description="开始时间"),
    end_date: Optional[datetime] = Query(None, description="结束时间"),
    db_session=Depends(get_db_session)
) -> HistoryListResponse:
    """
    查询指定操作人的操作历史。
    
    Args:
        operator_id: 操作人ID
        page: 页码，从1开始
        page_size: 每页记录数，默认20
        start_date: 开始时间筛选
        end_date: 结束时间筛选
        db_session: 数据库会话依赖
    
    Returns:
        HistoryListResponse: 包含分页的历史记录列表
    
    Raises:
        HTTPException: 查询失败时抛出400错误
    """
    try:
        status_history_service = StatusHistoryService(db_session)
        
        result = await status_history_service.get_operator_history(
            operator_id=operator_id,
            page=page,
            page_size=page_size,
            start_date=start_date,
            end_date=end_date
        )
        
        return HistoryListResponse(
            total=result.get("total", 0),
            page=page,
            page_size=page_size,
            items=[
                HistoryResponse(
                    id=record.id,
                    asset_id=record.asset_id,
                    operation_type=record.operation_type,
                    from_status=record.from_status,
                    to_status=record.to_status,
                    operator_id=record.operator_id,
                    operator_name=record.operator_name,
                    operator_role=record.operator_role,
                    remarks=record.remarks,
                    created_at=record.created_at,
                    metadata=record.metadata or {}
                )
                for record in result.get("items", [])
            ]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"查询操作人历史失败: {str(e)}"
        )


@router.get(
    "/retirement/{retirement_id}",
    response_model=List[HistoryResponse],
    summary="查询退役申请历史",
    description="获取特定退役申请的完整审批历史。"
)
async def get_retirement_history(
    retirement_id: str,
    db_session=Depends(get_db_session)
) -> List[HistoryResponse]:
    """
    查询退役申请的完整审批历史。
    
    Args:
        retirement_id: 退役申请ID
        db_session: 数据库会话依赖
    
    Returns:
        List[HistoryResponse]: 按时间排序的历史记录列表
    
    Raises:
        HTTPException: 查询失败时抛出400错误
    """
    try:
        retirement_service = RetirementService(db_session)
        
        records = await retirement_service.get_retirement_history(retirement_id)
        
        return [
            HistoryResponse(
                id=record.id,
                asset_id=record.asset_id,
                operation_type=record.operation_type,
                from_status=record.from_status,
                to_status=record.to_status,
                operator_id=record.operator_id,
                operator_name=record.operator_name,
                operator_role=record.operator_role,
                remarks=record.remarks,
                created_at=record.created_at,
                metadata=record.metadata or {}
            )
            for record in records
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"查询退役申请历史失败: {str(e)}"
        )