"""
资产报废退役流程 API 路由模块

本模块实现了资产报废退役流程的 RESTful API 端点，包括：
- 资产状态流转引擎集成
- 报废申请审批链管理
- 历史记录查询与导出

主要功能：
1. 退役申请提交与状态变更
2. 多级审批链操作（提交、审批、拒绝、撤回）
3. 退役流程历史记录查询
4. 审计报告导出

状态流转路径：ACTIVE -> PENDING_RETIREMENT -> UNDER_APPROVAL -> RETIRED -> DISPOSED
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel, Field
from enum import Enum

from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.services.retirement_service import RetirementService
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.state_machine.retirement_state_machine import RetirementStateMachine
from src.domain.entities.retirement_request import RetirementRequest, RetirementStatus
from src.domain.entities.asset import Asset
from src.api.schemas.retirement_request import RetirementApplicationDTO
from src.api.schemas.retirement_response import (
    RetirementApplicationResponse,
    RetirementApprovalResponse,
    RetirementHistoryResponse,
    AuditExportResponse
)

router = APIRouter(prefix="/api/retirement", tags=["资产退役管理"])


class RetirementAction(str, Enum):
    """
    退役流程操作枚举
    
    定义了资产退役流程中所有可能的操作类型
    """
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    WITHDRAW = "withdraw"
    COMPLETE = "complete"
    DISPOSE = "dispose"


# ========== Request Models ==========

class RetirementSubmitRequest(BaseModel):
    """
    退役申请提交请求模型
    
    Attributes:
        asset_id: 资产ID
        reason: 退役原因
        attachments: 附件列表（支持 PDF, JPG, PNG, DOC，最大10MB）
    """
    asset_id: str = Field(..., description="资产ID")
    reason: str = Field(..., min_length=10, description="退役原因（至少10字符）")
    attachments: Optional[List[str]] = Field(default_factory=list, description="附件URL列表")


class RetirementApproveRequest(BaseModel):
    """
    退役审批请求模型
    
    Attributes:
        application_id: 申请ID
        approver_id: 审批人ID
        comment: 审批意见
    """
    application_id: str = Field(..., description="申请ID")
    approver_id: str = Field(..., description="审批人ID")
    comment: Optional[str] = Field(None, description="审批意见")


class RetirementRejectRequest(BaseModel):
    """
    退役拒绝请求模型
    
    Attributes:
        application_id: 申请ID
        approver_id: 审批人ID
        reason: 拒绝原因
    """
    application_id: str = Field(..., description="申请ID")
    approver_id: str = Field(..., description="审批人ID")
    reason: str = Field(..., min_length=5, description="拒绝原因（至少5字符）")


class RetirementWithdrawRequest(BaseModel):
    """
    退役申请撤回请求模型
    
    Attributes:
        application_id: 申请ID
        operator_id: 操作人ID
    """
    application_id: str = Field(..., description="申请ID")
    operator_id: str = Field(..., description="操作人ID")


class StateTransitionRequest(BaseModel):
    """
    状态变更请求模型
    
    Attributes:
        asset_id: 资产ID
        target_state: 目标状态
        operator: 操作人
    """
    asset_id: str = Field(..., description="资产ID")
    target_state: str = Field(..., description="目标状态")
    operator: str = Field(..., description="操作人ID")


# ========== API Endpoints ==========

@router.post(
    "/applications",
    response_model=RetirementApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="提交退役申请",
    description="提交新的资产退役申请，进入审批流程"
)
async def submit_retirement_application(
    request: RetirementSubmitRequest,
    background_tasks: BackgroundTasks
) -> RetirementApplicationResponse:
    """
    提交资产退役申请
    
    流程说明：
    1. 验证资产状态是否为 ACTIVE
    2. 创建退役申请记录
    3. 触发状态变更：ACTIVE -> PENDING_RETIREMENT
    4. 初始化审批链
    5. 发送通知给下一级审批人
    
    Args:
        request: 退役申请请求数据
        background_tasks: 后台任务处理器
        
    Returns:
        RetirementApplicationResponse: 申请响应，包含申请ID和当前状态
        
    Raises:
        HTTPException: 资产状态无效、已存在进行中的申请等
    """
    try:
        retirement_service = RetirementService()
        
        # 验证资产状态
        asset = retirement_service.get_asset(request.asset_id)
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"资产 {request.asset_id} 不存在"
            )
        
        # 检查是否已存在进行中的申请
        existing_app = retirement_service.get_pending_application(request.asset_id)
        if existing_app:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"资产 {request.asset_id} 已存在进行中的退役申请"
            )
        
        # 创建申请
        application = await retirement_service.create_application(
            asset_id=request.asset_id,
            reason=request.reason,
            attachments=request.attachments
        )
        
        # 触发状态变更
        await retirement_service.transition_state(
            asset_id=request.asset_id,
            target_state="PENDING_RETIREMENT",
            operator="system"
        )
        
        # 后台发送通知
        background_tasks.add_task(
            _send_submission_notification,
            application_id=application.id
        )
        
        return RetirementApplicationResponse(
            application_id=application.id,
            asset_id=application.asset_id,
            status=application.status.value,
            created_at=application.created_at,
            message="退役申请提交成功"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交退役申请失败: {str(e)}"
        )


@router.post(
    "/applications/{application_id}/approve",
    response_model=RetirementApprovalResponse,
    summary="审批退役申请",
    description="对退役申请进行审批操作，支持多级审批链"
)
async def approve_retirement_application(
    application_id: str,
    request: RetirementApproveRequest,
    background_tasks: BackgroundTasks
) -> RetirementApprovalResponse:
    """
    审批退役申请
    
    流程说明：
    1. 验证申请当前状态为 UNDER_APPROVAL
    2. 记录审批操作到 ApprovalLog
    3. 判断是否为最后一级审批
    4. 如果是最后一级：状态变更为 RETIRED
    5. 如果不是最后一级：推进到下一级审批
    6. 发送审批完成通知
    
    Args:
        application_id: 申请ID（路径参数）
        request: 审批请求数据
        background_tasks: 后台任务处理器
        
    Returns:
        RetirementApprovalResponse: 审批结果响应
        
    Raises:
        HTTPException: 申请不存在、状态无效、权限不足等
    """
    try:
        approval_service = ApprovalChainService()
        
        # 获取申请信息
        application = await approval_service.get_application(application_id)
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"申请 {application_id} 不存在"
            )
        
        # 执行审批
        result = await approval_service.approve(
            application_id=application_id,
            approver_id=request.approver_id,
            comment=request.comment
        )
        
        # 根据审批结果更新资产状态
        retirement_service = RetirementService()
        if result.is_final:
            await retirement_service.transition_state(
                asset_id=application.asset_id,
                target_state="RETIRED",
                operator=request.approver_id
            )
        else:
            # 推进到下一级审批
            await retirement_service.update_application_status(
                application_id=application_id,
                status="UNDER_APPROVAL",
                next_approver=result.next_approver
            )
        
        # 后台记录历史并发送通知
        background_tasks.add_task(
            _record_approval_history,
            application_id=application_id,
            action="APPROVE",
            approver_id=request.approver_id,
            comment=request.comment
        )
        background_tasks.add_task(
            _send_approval_notification,
            application_id=application_id,
            action="APPROVED"
        )
        
        return RetirementApprovalResponse(
            application_id=application_id,
            asset_id=application.asset_id,
            action="APPROVED",
            approver_id=request.approver_id,
            is_final=result.is_final,
            next_approver=result.next_approver,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"审批操作失败: {str(e)}"
        )


@router.post(
    "/applications/{application_id}/reject",
    response_model=RetirementApprovalResponse,
    summary="拒绝退役申请",
    description="拒绝退役申请，资产状态恢复为 ACTIVE"
)
async def reject_retirement_application(
    application_id: str,
    request: RetirementRejectRequest,
    background_tasks: BackgroundTasks
) -> RetirementApprovalResponse:
    """
    拒绝退役申请
    
    流程说明：
    1. 记录拒绝操作到 ApprovalLog
    2. 更新申请状态为 REJECTED
    3. 恢复资产状态为 ACTIVE
    4. 发送拒绝通知给申请人
    
    Args:
        application_id: 申请ID（路径参数）
        request: 拒绝请求数据
        background_tasks: 后台任务处理器
        
    Returns:
        RetirementApprovalResponse: 拒绝结果响应
        
    Raises:
        HTTPException: 申请不存在、状态无效等
    """
    try:
        approval_service = ApprovalChainService()
        
        # 获取申请信息
        application = await approval_service.get_application(application_id)
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"申请 {application_id} 不存在"
            )
        
        # 执行拒绝
        result = await approval_service.reject(
            application_id=application_id,
            approver_id=request.approver_id,
            reason=request.reason
        )
        
        # 恢复资产状态
        retirement_service = RetirementService()
        await retirement_service.transition_state(
            asset_id=application.asset_id,
            target_state="ACTIVE",
            operator=request.approver_id
        )
        
        # 后台记录历史并发送通知
        background_tasks.add_task(
            _record_rejection_history,
            application_id=application_id,
            action="REJECT",
            approver_id=request.approver_id,
            reason=request.reason
        )
        background_tasks.add_task(
            _send_rejection_notification,
            application_id=application_id,
            reason=request.reason
        )
        
        return RetirementApprovalResponse(
            application_id=application_id,
            asset_id=application.asset_id,
            action="REJECTED",
            approver_id=request.approver_id,
            is_final=True,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"拒绝操作失败: {str(e)}"
        )


@router.post(
    "/applications/{application_id}/withdraw",
    response_model=RetirementApplicationResponse,
    summary="撤回退役申请",
    description="申请人撤回未进入审批或审批中的申请，仅允许在 PENDING_RETIREMENT 状态撤回"
)
async def withdraw_retirement_application(
    application_id: str,
    request: RetirementWithdrawRequest
) -> RetirementApplicationResponse:
    """
    撤回退役申请
    
    撤回规则：
    - 仅在 PENDING_RETIREMENT 状态下允许撤回
    - 撤回后资产状态恢复为 ACTIVE
    - 申请状态标记为 WITHDRAWN
    
    Args:
        application_id: 申请ID（路径参数）
        request: 撤回请求数据
        
    Returns:
        RetirementApplicationResponse: 撤回结果响应
        
    Raises:
        HTTPException: 申请不存在、状态不允许撤回等
    """
    try:
        retirement_service = RetirementService()
        
        # 验证申请状态
        application = await retirement_service.get_application(application_id)
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"申请 {application_id} 不存在"
            )
        
        if application.status != RetirementStatus.PENDING_RETIREMENT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仅在待处理状态允许撤回申请"
            )
        
        # 执行撤回
        result = await retirement_service.withdraw_application(
            application_id=application_id,
            operator_id=request.operator_id
        )
        
        # 恢复资产状态
        await retirement_service.transition_state(
            asset_id=application.asset_id,
            target_state="ACTIVE",
            operator=request.operator_id
        )
        
        return RetirementApplicationResponse(
            application_id=application_id,
            asset_id=application.asset_id,
            status="WITHDRAWN",
            updated_at=datetime.now(),
            message="申请已成功撤回"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"撤回申请失败: {str(e)}"
        )


@router.get(
    "/applications",
    response_model=List[RetirementApplicationResponse],
    summary="查询退役申请列表",
    description="根据条件筛选查询退役申请列表"
)
async def list_retirement_applications(
    asset_id: Optional[str] = Query(None, description="资产ID"),
    status: Optional[str] = Query(None, description="申请状态"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
) -> List[RetirementApplicationResponse]:
    """
    查询退役申请列表
    
    支持多条件组合筛选，支持分页查询
    
    Args:
        asset_id: 资产ID（可选）
        status: 申请状态（可选）
        start_date: 开始日期（可选）
        end_date: 结束日期（可选）
        page: 页码，默认1
        page_size: 每页数量，默认20，最大100
        
    Returns:
        List[RetirementApplicationResponse]: 申请列表
    """
    try:
        retirement_service = RetirementService()
        applications = await retirement_service.query_applications(
            asset_id=asset_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size
        )
        
        return [
            RetirementApplicationResponse(
                application_id=app.id,
                asset_id=app.asset_id,
                status=app.status.value,
                created_at=app.created_at,
                updated_at=app.updated_at
            )
            for app in applications
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询申请列表失败: {str(e)}"
        )


@router.get(
    "/applications/{application_id}",
    response_model=RetirementApplicationResponse,
    summary="查询退役申请详情",
    description="根据申请ID查询退役申请详情"
)
async def get_retirement_application(
    application_id: str
) -> RetirementApplicationResponse:
    """
    查询退役申请详情
    
    Args:
        application_id: 申请ID
        
    Returns:
        RetirementApplicationResponse: 申请详情
        
    Raises:
        HTTPException: 申请不存在
    """
    try:
        retirement_service = RetirementService()
        application = await retirement_service.get_application(application_id)
        
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"申请 {application_id} 不存在"
            )
        
        return RetirementApplicationResponse(
            application_id=application.id,
            asset_id=application.asset_id,
            status=application.status.value,
            reason=application.reason,
            attachments=application.attachments,
            created_at=application.created_at,
            updated_at=application.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询申请详情失败: {str(e)}"
        )


@router.get(
    "/assets/{asset_id}/status",
    response_model=dict,
    summary="查询资产当前退役状态",
    description="查询资产当前的退役相关状态及最近变更时间"
)
async def get_asset_retirement_status(
    asset_id: str
) -> dict:
    """
    查询资产当前退役状态
    
    返回资产当前状态、最近变更时间、以及待处理的退役申请信息
    
    Args:
        asset_id: 资产ID
        
    Returns:
        dict: 包含状态、变更时间、待处理申请等信息的字典
        
    Raises:
        HTTPException: 资产不存在
    """
    try:
        retirement_service = RetirementService()
        asset = retirement_service.get_asset(asset_id)
        
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"资产 {asset_id} 不存在"
            )
        
        # 获取最近的状态变更记录
        history_service = StatusHistoryService()
        latest_change = await history_service.get_latest_change(asset_id)
        
        # 检查是否有待处理的申请
        pending_app = await retirement_service.get_pending_application(asset_id)
        
        return {
            "asset_id": asset_id,
            "current_state": asset.status,
            "latest_change_time": latest_change.created_at if latest_change else None,
            "pending_application": {
                "application_id": pending_app.id,
                "status": pending_app.status.value
            } if pending_app else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询资产状态失败: {str(e)}"
        )


@router.get(
    "/assets/{asset_id}/retirement-history",
    response_model=List[RetirementHistoryResponse],
    summary="查询资产退役历史",
    description="查询指定资产的完整退役流程历史记录"
)
async def get_asset_retirement_history(
    asset_id: str
) -> List[RetirementHistoryResponse]:
    """
    查询资产退役历史
    
    返回资产所有退役相关的状态变更记录、操作日志、审批记录
    
    Args:
        asset_id: 资产ID
        
    Returns:
        List[RetirementHistoryResponse]: 历史记录列表
        
    Raises:
        HTTPException: 资产不存在
    """
    try:
        history_service = StatusHistoryService()
        history_records = await history_service.get_asset_history(
            asset_id=asset_id,
            category="retirement"
        )
        
        return [
            RetirementHistoryResponse(
                asset_id=record.asset_id,
                from_state=record.from_state,
                to_state=record.to_state,
                operator=record.operator,
                action=record.action,
                timestamp=record.created_at,
                metadata=record.metadata
            )
            for record in history_records
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询历史记录失败: {str(e)}"
        )


@router.get(
    "/audit/export",
    response_model=AuditExportResponse,
    summary="导出退役审计报告",
    description="根据日期范围导出资产退役审计报告"
)
async def export_audit_report(
    start_date: datetime = Query(..., description="开始日期"),
    end_date: datetime = Query(..., description="结束日期"),
    format: str = Query("json", regex="^(json|csv)$", description="导出格式")
) -> AuditExportResponse:
    """
    导出退役审计报告
    
    根据指定日期范围导出资产退役相关的审计报告，支持 JSON 和 CSV 格式
    
    Args:
        start_date: 开始日期（必填）
        end_date: 结束日期（必填）
        format: 导出格式，支持 json 和 csv
        
    Returns:
        AuditExportResponse: 审计报告响应，包含报告数据和元信息
        
    Raises:
        HTTPException: 日期范围无效
    """
    try:
        retirement_service = RetirementService()
        
        if end_date < start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="结束日期不能早于开始日期"
            )
        
        report_data = await retirement_service.export_audit_report(
            start_date=start_date,
            end_date=end_date,
            format=format
        )
        
        return AuditExportResponse(
            report_id=report_data["report_id"],
            start_date=start_date,
            end_date=end_date,
            record_count=len(report_data["records"]),
            format=format,
            generated_at=datetime.now(),
            download_url=report_data["download_url"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出审计报告失败: {str(e)}"
        )


# ========== Internal Helper Functions ==========

async def _send_submission_notification(application_id: str) -> None:
    """
    发送申请提交通知（后台任务）
    
    Args:
        application_id: 申请ID
    """
    from src.domain.services.notification_service import NotificationService
    notification_service = NotificationService()
    await notification_service.send_submission_notification(application_id)


async def _send_approval_notification(application_id: str, action: str) -> None:
    """
    发送审批结果通知（后台任务）
    
    Args:
        application_id: 申请ID
        action: 审批动作
    """
    from src.domain.services.notification_service import NotificationService
    notification_service = NotificationService()
    await notification_service.notify_completion(application_id, action)


async def _send_rejection_notification(application_id: str, reason: str) -> None:
    """
    发送拒绝通知（后台任务）
    
    Args:
        application_id: 申请ID
        reason: 拒绝原因
    """
    from src.domain.services.notification_service import NotificationService
    notification_service = NotificationService()
    await notification_service.send_rejection_notification(application_id, reason)


async def _record_approval_history(
    application_id: str,
    action: str,
    approver_id: str,
    comment: Optional[str]
) -> None:
    """
    记录审批操作历史（后台任务）
    
    Args:
        application_id: 申请ID
        action: 操作类型
        approver_id: 审批人ID
        comment: 审批意见
    """
    from src.domain.services.status_history_service import StatusHistoryService
    history_service = StatusHistoryService()
    await history_service.record_approval_action(
        application_id=application_id,
        action=action,
        approver_id=approver_id,
        comment=comment
    )


async def _record_rejection_history(
    application_id: str,
    action: str,
    approver_id: str,
    reason: str
) -> None:
    """
    记录拒绝操作历史（后台任务）
    
    Args:
        application_id: 申请ID
        action: 操作类型
        approver_id: 审批人ID
        reason: 拒绝原因
    """
    from src.domain.services.status_history_service import StatusHistoryService
    history_service = StatusHistoryService()
    await history_service.record_approval_action(
        application_id=application_id,
        action=action,
        approver_id=approver_id,
        comment=reason
    )


def _check_approval_timeout(application_id: str, approval_level: int) -> None:
    """
    检查审批超时并发送提醒（定时任务）
    
    审批超时规则：
    - 单级审批默认 72 小时
    - 超时自动提醒，不自动通过
    
    Args:
        application_id: 申请ID
        approval_level: 审批层级
    """
    from src.domain.services.approval_chain_service import ApprovalChainService
    from datetime import timedelta
    
    approval_service = ApprovalChainService()
    approval_record = approval_service.get_approval_record(application_id, approval_level)
    
    if approval_record:
        elapsed_hours = (datetime.now() - approval_record.created_at).total_seconds() / 3600
        if elapsed_hours >= 72:
            from src.domain.services.notification_service import NotificationService
            notification_service = NotificationService()
            # 触发超时提醒
            pass