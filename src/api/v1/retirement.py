"""
资产报废退役流程 API 路由模块

提供报废/退役申请的提交、审批、查询及生命周期追溯接口。
支持多级审批链配置，与资产状态机联动。

主要功能:
- 报废申请提交 (POST /api/v1/retirement/apply)
- 申请查询与详情 (GET /api/v1/retirement/applications)
- 申请撤销 (POST /api/v1/retirement/applications/{id}/cancel)
- 生命周期查询 (GET /api/v1/retirement/applications/{id}/lifecycle)

典型审批流程:
    CREATED -> PENDING_APPROVAL -> APPROVED -> COMPLETED
                    |
                    v
               REJECTED

@see ATB-001 报废申请发起
@see ATB-002 重复申请拦截
@see ATB-005 生命周期完整性
"""

from datetime import datetime
from typing import Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ConfigDict

from src.domain.services.retirement_service import RetirementService
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.entities.retirement_app import RetirementApplication, ApplicationStatus
from src.domain.entities.approval_stage import ApprovalStage
from src.domain.entities.asset_lifecycle_event import AssetLifecycleEvent, LifecycleEventType
from src.domain.value_objects.asset_status import AssetStatus


router = APIRouter(prefix="/api/v1/retirement", tags=["retirement"])


# ============================================================
# Request/Response Schemas
# ============================================================

class ApplicationType(str, Enum):
    """申请类型枚举"""
    SCRAP = "scrap"           # 报废
    RETIREMENT = "retirement" # 退役


class RetirementApplicationRequest(BaseModel):
    """报废申请请求"""
    asset_id: str = Field(..., description="资产ID")
    application_type: ApplicationType = Field(..., description="申请类型")
    reason: str = Field(..., min_length=10, max_length=500, description="申请原因")
    attachments: list[str] = Field(default_factory=list, max_length=5, description="附件ID列表")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "asset_id": "AST-2024-001",
                "application_type": "scrap",
                "reason": "设备老旧无法修复，建议报废处理",
                "attachments": ["att-001", "att-002"]
            }
        }
    )


class ApprovalTaskResponse(BaseModel):
    """审批任务响应"""
    task_id: str
    approver_id: str
    approver_name: str
    status: str
    comment: Optional[str] = None
    decided_at: Optional[datetime] = None


class RetirementApplicationResponse(BaseModel):
    """报废申请响应"""
    id: str
    asset_id: str
    application_type: ApplicationType
    status: ApplicationStatus
    reason: str
    applicant_id: str
    applicant_name: str
    current_task: Optional[ApprovalTaskResponse] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class LifecycleEventResponse(BaseModel):
    """生命周期事件响应"""
    event_id: str
    event_type: LifecycleEventType
    asset_id: str
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    description: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    """错误响应"""
    code: str
    message: str
    details: Optional[dict] = None


# ============================================================
# Error Definitions
# ============================================================

class RetirementErrorCode:
    """错误码定义"""
    ASSET_NOT_FOUND = ("RET_001", "资产不存在")
    DUPLICATE_APPLICATION = ("RET_002", "该资产存在待处理的申请")
    ASSET_LOCKED = ("RET_003", "资产已被锁定，禁止操作")
    APPLICATION_NOT_FOUND = ("RET_004", "申请记录不存在")
    INVALID_STATUS_TRANSITION = ("RET_005", "无效的状态转换")
    UNAUTHORIZED = ("RET_006", "无权限执行此操作")
    INVALID_REASON = ("RET_007", "申请理由格式错误")


# ============================================================
# API Endpoints
# ============================================================

@router.post(
    "/apply",
    response_model=RetirementApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "申请提交成功"},
        409: {"model": ErrorResponse, "description": "重复申请"},
        423: {"model": ErrorResponse, "description": "资产被锁定"},
        404: {"model": ErrorResponse, "description": "资产不存在"},
    },
    summary="提交报废/退役申请",
    description="""
    用户发起资产报废或退役申请。
    
    业务规则:
    - 同一资产同一时间仅允许存在1条有效申请
    - 申请提交后资产状态自动锁定 (under_retirement)
    - 自动创建首级审批任务
    
    **审批链触发**: 根据资产类型和归属部门查询对应的审批链配置，
    自动生成多级审批任务。
    
    @see ATB-001 报废申请发起
    """
)
async def submit_retirement_application(
    request: RetirementApplicationRequest,
    current_user_id: str = Query(..., description="当前用户ID"),
    retirement_service: RetirementService = Depends(),
    approval_chain_service: ApprovalChainService = Depends(),
) -> RetirementApplicationResponse:
    """
    提交报废/退役申请
    
    Args:
        request: 申请请求包含资产ID、申请类型、原因
        current_user_id: 当前操作用户ID
        retirement_service: 报废服务依赖注入
        approval_chain_service: 审批链服务依赖注入
    
    Returns:
        RetirementApplicationResponse: 创建的申请记录
    
    Raises:
        HTTPException 404: 资产不存在
        HTTPException 409: 存在重复申请
        HTTPException 423: 资产被锁定
    """
    # 1. 检查资产是否存在且可用
    asset = await retirement_service.get_asset(request.asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": RetirementErrorCode.ASSET_NOT_FOUND[0],
                "message": RetirementErrorCode.ASSET_NOT_FOUND[1],
            }
        )
    
    # 2. 检查是否存在待处理的申请
    existing_app = await retirement_service.get_pending_application(request.asset_id)
    if existing_app:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": RetirementErrorCode.DUPLICATE_APPLICATION[0],
                "message": RetirementErrorCode.DUPLICATE_APPLICATION[1],
            }
        )
    
    # 3. 检查资产是否被锁定
    if asset.status == AssetStatus.UNDER_RETIREMENT:
        raise HTTPException(
            status_code=423,  # Locked
            detail={
                "code": RetirementErrorCode.ASSET_LOCKED[0],
                "message": RetirementErrorCode.ASSET_LOCKED[1],
            }
        )
    
    # 4. 创建申请记录
    application = await retirement_service.create_application(
        asset_id=request.asset_id,
        application_type=request.application_type.value,
        reason=request.reason,
        applicant_id=current_user_id,
        attachments=request.attachments,
    )
    
    # 5. 锁定资产状态
    await retirement_service.lock_asset_for_retirement(request.asset_id)
    
    # 6. 写入生命周期事件
    await retirement_service.record_lifecycle_event(
        asset_id=request.asset_id,
        event_type=LifecycleEventType.RETIREMENT_CREATED,
        operator_id=current_user_id,
        description=f"提交{request.application_type.value}申请: {request.reason[:50]}...",
        metadata={
            "application_id": application.id,
            "application_type": request.application_type.value,
        }
    )
    
    # 7. 激活审批链
    approval_chain = await approval_chain_service.activate_chain(
        application_id=application.id,
        asset_id=request.asset_id,
        application_type=request.application_type.value,
        applicant_id=current_user_id,
    )
    
    # 8. 获取首级审批任务
    current_task = await approval_chain_service.get_current_task(application.id)
    
    return RetirementApplicationResponse(
        id=application.id,
        asset_id=application.asset_id,
        application_type=ApplicationType(application.application_type),
        status=application.status,
        reason=application.reason,
        applicant_id=application.applicant_id,
        applicant_name=application.applicant_name,
        current_task=ApprovalTaskResponse(
            task_id=current_task.id,
            approver_id=current_task.approver_id,
            approver_name=current_task.approver_name,
            status=current_task.status,
        ) if current_task else None,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.get(
    "/applications",
    response_model=list[RetirementApplicationResponse],
    summary="查询报废申请列表",
    description="查询当前用户可见的报废申请列表，支持状态和类型过滤"
)
async def list_retirement_applications(
    status_filter: Optional[ApplicationStatus] = Query(None, description="状态过滤"),
    application_type: Optional[ApplicationType] = Query(None, description="类型过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user_id: str = Query(..., description="当前用户ID"),
    retirement_service: RetirementService = Depends(),
) -> list[RetirementApplicationResponse]:
    """
    查询报废申请列表
    
    Args:
        status_filter: 状态过滤条件
        application_type: 类型过滤条件
        page: 页码
        page_size: 每页数量
        current_user_id: 当前用户ID
    
    Returns:
        申请记录列表
    """
    applications = await retirement_service.list_applications(
        status=status_filter,
        application_type=application_type.value if application_type else None,
        page=page,
        page_size=page_size,
        user_id=current_user_id,
    )
    
    return [
        RetirementApplicationResponse(
            id=app.id,
            asset_id=app.asset_id,
            application_type=ApplicationType(app.application_type),
            status=app.status,
            reason=app.reason,
            applicant_id=app.applicant_id,
            applicant_name=app.applicant_name,
            created_at=app.created_at,
            updated_at=app.updated_at,
        )
        for app in applications
    ]


@router.get(
    "/applications/{application_id}",
    response_model=RetirementApplicationResponse,
    responses={
        200: {"description": "申请详情"},
        404: {"model": ErrorResponse, "description": "申请不存在"},
    },
    summary="获取申请详情",
    description="根据申请ID获取完整的申请详情，包含当前审批任务信息"
)
async def get_retirement_application(
    application_id: str,
    current_user_id: str = Query(..., description="当前用户ID"),
    retirement_service: RetirementService = Depends(),
    approval_chain_service: ApprovalChainService = Depends(),
) -> RetirementApplicationResponse:
    """
    获取报废申请详情
    
    Args:
        application_id: 申请ID
        current_user_id: 当前用户ID
    
    Returns:
        申请详情
    
    Raises:
        HTTPException 404: 申请不存在
    """
    application = await retirement_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": RetirementErrorCode.APPLICATION_NOT_FOUND[0],
                "message": RetirementErrorCode.APPLICATION_NOT_FOUND[1],
            }
        )
    
    # 获取当前审批任务
    current_task = await approval_chain_service.get_current_task(application_id)
    
    return RetirementApplicationResponse(
        id=application.id,
        asset_id=application.asset_id,
        application_type=ApplicationType(application.application_type),
        status=application.status,
        reason=application.reason,
        applicant_id=application.applicant_id,
        applicant_name=application.applicant_name,
        current_task=ApprovalTaskResponse(
            task_id=current_task.id,
            approver_id=current_task.approver_id,
            approver_name=current_task.approver_name,
            status=current_task.status,
            comment=current_task.comment,
            decided_at=current_task.decided_at,
        ) if current_task else None,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.post(
    "/applications/{application_id}/cancel",
    response_model=RetirementApplicationResponse,
    responses={
        200: {"description": "撤销成功"},
        400: {"model": ErrorResponse, "description": "无法撤销"},
        403: {"model": ErrorResponse, "description": "无权限"},
        404: {"model": ErrorResponse, "description": "申请不存在"},
    },
    summary="撤销申请",
    description="""
    撤销报废申请，仅申请人可在审批完成前撤销。
    
    业务规则:
    - 仅申请人可撤销
    - 仅在首级审批完成前可撤销
    - 撤销后资产状态恢复可用
    - 写入生命周期撤销事件
    """
)
async def cancel_retirement_application(
    application_id: str,
    current_user_id: str = Query(..., description="当前用户ID"),
    retirement_service: RetirementService = Depends(),
    approval_chain_service: ApprovalChainService = Depends(),
) -> RetirementApplicationResponse:
    """
    撤销报废申请
    
    Args:
        application_id: 申请ID
        current_user_id: 当前用户ID
    
    Returns:
        更新后的申请记录
    
    Raises:
        HTTPException 400: 无法撤销（已审批）
        HTTPException 403: 无权限
        HTTPException 404: 申请不存在
    """
    application = await retirement_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": RetirementErrorCode.APPLICATION_NOT_FOUND[0],
                "message": RetirementErrorCode.APPLICATION_NOT_FOUND[1],
            }
        )
    
    # 权限检查：仅申请人可撤销
    if application.applicant_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": RetirementErrorCode.UNAUTHORIZED[0],
                "message": "仅申请人可撤销申请",
            }
        )
    
    # 检查是否可以撤销
    can_cancel = await retirement_service.can_cancel_application(application_id)
    if not can_cancel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": RetirementErrorCode.INVALID_STATUS_TRANSITION[0],
                "message": "当前状态不允许撤销",
            }
        )
    
    # 执行撤销
    cancelled_app = await retirement_service.cancel_application(
        application_id=application_id,
        operator_id=current_user_id,
    )
    
    # 恢复资产状态
    await retirement_service.unlock_asset(application.asset_id)
    
    # 写入生命周期事件
    await retirement_service.record_lifecycle_event(
        asset_id=application.asset_id,
        event_type=LifecycleEventType.APPLICATION_CANCELLED,
        operator_id=current_user_id,
        description=f"撤销报废申请: {application.reason[:50]}...",
        metadata={"application_id": application_id}
    )
    
    return RetirementApplicationResponse(
        id=cancelled_app.id,
        asset_id=cancelled_app.asset_id,
        application_type=ApplicationType(cancelled_app.application_type),
        status=cancelled_app.status,
        reason=cancelled_app.reason,
        applicant_id=cancelled_app.applicant_id,
        applicant_name=cancelled_app.applicant_name,
        created_at=cancelled_app.created_at,
        updated_at=cancelled_app.updated_at,
    )


@router.get(
    "/applications/{application_id}/lifecycle",
    response_model=list[LifecycleEventResponse],
    responses={
        200: {"description": "生命周期事件列表"},
        404: {"model": ErrorResponse, "description": "申请不存在"},
    },
    summary="查询生命周期历史",
    description="""
    查询资产完整的生命周期事件记录。
    
    返回按时间顺序排列的所有状态变更和审批记录。
    
    @see ATB-005 生命周期完整性
    """
)
async def get_application_lifecycle(
    application_id: str,
    current_user_id: str = Query(..., description="当前用户ID"),
    retirement_service: RetirementService = Depends(),
) -> list[LifecycleEventResponse]:
    """
    查询生命周期事件
    
    Args:
        application_id: 申请ID
        current_user_id: 当前用户ID
    
    Returns:
        生命周期事件列表
    
    Raises:
        HTTPException 404: 申请不存在
    """
    application = await retirement_service.get_application(application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": RetirementErrorCode.APPLICATION_NOT_FOUND[0],
                "message": RetirementErrorCode.APPLICATION_NOT_FOUND[1],
            }
        )
    
    # 获取资产ID（可能从申请或直接参数获取）
    asset_id = application.asset_id
    
    # 查询生命周期事件
    events = await retirement_service.get_lifecycle_events(asset_id)
    
    return [
        LifecycleEventResponse(
            event_id=event.id,
            event_type=event.event_type,
            asset_id=event.asset_id,
            operator_id=event.operator_id,
            operator_name=event.operator_name,
            description=event.description,
            metadata=event.metadata or {},
            created_at=event.created_at,
        )
        for event in events
    ]


@router.get(
    "/assets/{asset_id}/lifecycle",
    response_model=list[LifecycleEventResponse],
    summary="查询资产生命周期",
    description="查询指定资产的完整生命周期事件记录，包含从入库到报废的所有状态变更"
)
async def get_asset_lifecycle(
    asset_id: str,
    current_user_id: str = Query(..., description="当前用户ID"),
    retirement_service: RetirementService = Depends(),
) -> list[LifecycleEventResponse]:
    """
    查询资产完整生命周期
    
    Args:
        asset_id: 资产ID
        current_user_id: 当前用户ID
    
    Returns:
        生命周期事件列表
    """
    events = await retirement_service.get_lifecycle_events(asset_id)
    
    return [
        LifecycleEventResponse(
            event_id=event.id,
            event_type=event.event_type,
            asset_id=event.asset_id,
            operator_id=event.operator_id,
            operator_name=event.operator_name,
            description=event.description,
            metadata=event.metadata or {},
            created_at=event.created_at,
        )
        for event in events
    ]


# ============================================================
# Dependencies
# ============================================================

def get_retirement_service() -> RetirementService:
    """获取报废服务实例"""
    return RetirementService()


def get_approval_chain_service() -> ApprovalChainService:
    """获取审批链服务实例"""
    return ApprovalChainService()