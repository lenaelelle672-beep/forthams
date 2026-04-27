"""
资产退役申请 API 路由模块

提供资产退役申请的全生命周期 REST API 端点，包括：
- 申请创建/编辑/提交
- 多级审批（通过/驳回）
- 退役执行与归档
- 申请状态查询与审计日志追溯

遵循 SWARM-002 规格，状态机驱动 + 审批链引擎 + 全量审计持久化

版本: v1.0.0
更新: Iteration 10
"""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session

from src.api.dependencies.db import get_db
from src.api.schemas.request import (
    RetirementApplicationCreate,
    RetirementApplicationUpdate,
    RetirementApproveRequest,
    RetirementRejectRequest,
)
from src.api.schemas.response import StandardResponse
from src.domain.state_machine.retirement_state_machine import (
    AssetRetirementStateMachine,
    RetirementState,
    RetirementEvent,
    RetirementStateTransitionError,
)
from src.domain.state_machine.states import StateTransitionValidator
from src.models.retirement import RetirementApplication
from src.models.asset import Asset
from src.repositories.history_repository import RetirementAuditLogRepository
from src.services.retirement.approval_service import (
    RetirementApprovalChain,
    ApprovalChainExceededError,
    InvalidApproverError,
)
from src.services.retirement.application_service import RetirementApplicationService

# 路由配置
router = APIRouter(prefix="/api/v1/retirement", tags=["retirement"])

# 常量定义
MAX_APPROVAL_LEVELS = 5

# 错误码定义
class ErrorCodes:
    """业务错误码定义"""
    STATE_TRANSITION_ERROR = 42201
    APPROVAL_CHAIN_EXCEEDED = 40001
    INVALID_APPROVER = 40002
    APPLICATION_NOT_FOUND = 40401
    ALREADY_SUBMITTED = 40901
    ASSET_NOT_FOUND = 40003
    CONCURRENT_MODIFICATION = 40902


def get_request_id(x_request_id: Optional[str] = Header(None)) -> str:
    """
    获取请求追踪 ID
    
    从 X-Request-ID header 提取请求追踪标识，
    若未提供则自动生成 UUID
    
    Args:
        x_request_id: 请求头中的追踪 ID
        
    Returns:
        str: 请求追踪 ID
    """
    return x_request_id or str(uuid4())


def get_idempotency_key(x_idempotency_key: Optional[str] = Header(None)) -> Optional[str]:
    """
    获取幂等性 Key
    
    Args:
        x_idempotency_key: 请求头中的幂等性 Key
        
    Returns:
        Optional[str]: 幂等性 Key
    """
    return x_idempotency_key


def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> int:
    """
    获取当前用户 ID
    
    Args:
        x_user_id: 请求头中的用户 ID
        
    Returns:
        int: 用户 ID
    """
    return int(x_user_id) if x_user_id else 0


def get_current_user_name(x_user_name: Optional[str] = Header(None)) -> str:
    """
    获取当前用户名称
    
    Args:
        x_user_name: 请求头中的用户名称
        
    Returns:
        str: 用户名称
    """
    return x_user_name or "Unknown"


def _build_success_response(data: dict, message: str = "Success") -> dict:
    """
    构建成功响应
    
    Args:
        data: 响应数据
        message: 响应消息
        
    Returns:
        dict: 标准响应格式
    """
    return {
        "code": 0,
        "data": data,
        "message": message
    }


def _build_error_response(code: int, message: str, data: Optional[dict] = None) -> dict:
    """
    构建错误响应
    
    Args:
        code: 错误码
        message: 错误消息
        data: 附加数据
        
    Returns:
        dict: 标准错误响应格式
    """
    return {
        "code": code,
        "data": data or {},
        "message": message
    }


@router.post(
    "/applications",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建资产退役申请",
    description="发起新的资产退役申请，初始状态为 DRAFT"
)
async def create_retirement_application(
    application_data: RetirementApplicationCreate,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    idempotency_key: Optional[str] = Depends(get_idempotency_key),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    创建新的资产退役申请
    
    验证资产存在性，检查重复提交（幂等性），初始化审计日志
    
    Args:
        application_data: 申请数据
        db: 数据库会话
        request_id: 请求追踪 ID
        idempotency_key: 幂等性 Key
        user_id: 申请人 ID
        user_name: 申请人名称
        
    Returns:
        StandardResponse: 创建的申请信息
        
    Raises:
        HTTPException: 资产不存在时返回 400
    """
    # 检查幂等性 - 如果存在相同 idempotency_key 的申请，直接返回
    if idempotency_key:
        existing = db.query(RetirementApplication).filter(
            RetirementApplication.idempotency_key == idempotency_key
        ).first()
        if existing:
            return StandardResponse(
                code=0,
                data=_serialize_application(existing),
                message="Duplicate request, returning existing application"
            )
    
    # 验证资产存在
    asset = db.query(Asset).filter(Asset.id == application_data.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCodes.ASSET_NOT_FOUND,
                "message": f"Asset with ID {application_data.asset_id} not found",
                "data": {}
            }
        )
    
    # 创建申请
    application = RetirementApplication(
        asset_id=application_data.asset_id,
        applicant_id=user_id,
        applicant_name=user_name,
        reason=application_data.reason,
        expected_decommission_date=application_data.expected_decommission_date,
        estimated_value=application_data.estimated_value,
        state=RetirementState.DRAFT.value,
        current_approval_level=0,
        total_approval_levels=0,
        idempotency_key=idempotency_key,
        request_id=request_id,
        version=1
    )
    
    db.add(application)
    db.commit()
    db.refresh(application)
    
    # 创建初始审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_repo.create_audit_log(
        application_id=application.id,
        event_type="APPLICATION_CREATED",
        from_state=None,
        to_state=RetirementState.DRAFT.value,
        operator_id=user_id,
        operator_name=user_name,
        request_id=request_id,
        details={"reason": application_data.reason}
    )
    db.commit()
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Retirement application created successfully"
    )


@router.get(
    "/applications/{application_id}",
    response_model=StandardResponse,
    summary="获取退役申请详情",
    description="获取指定申请的全部信息，包括状态、审批层级、审计日志"
)
async def get_retirement_application(
    application_id: int,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
):
    """
    获取退役申请详情
    
    返回完整的申请信息，包含状态、审批链、审计日志
    
    Args:
        application_id: 申请 ID
        db: 数据库会话
        request_id: 请求追踪 ID
        
    Returns:
        StandardResponse: 申请详情
        
    Raises:
        HTTPException: 申请不存在时返回 404
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    # 获取审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_logs = audit_repo.find_by_application(application_id)
    
    data = _serialize_application(application)
    data["audit_logs"] = [
        _serialize_audit_log(log) for log in audit_logs
    ]
    
    return StandardResponse(
        code=0,
        data=data,
        message="Application retrieved successfully"
    )


@router.patch(
    "/applications/{application_id}",
    response_model=StandardResponse,
    summary="更新退役申请",
    description="更新草稿或被驳回状态的申请信息"
)
async def update_retirement_application(
    application_id: int,
    update_data: RetirementApplicationUpdate,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    更新退役申请
    
    仅允许在 DRAFT 或 REJECTED 状态下更新申请信息
    
    Args:
        application_id: 申请 ID
        update_data: 更新数据
        db: 数据库会话
        request_id: 请求追踪 ID
        user_id: 当前用户 ID
        user_name: 当前用户名称
        
    Returns:
        StandardResponse: 更新后的申请信息
        
    Raises:
        HTTPException: 申请不存在或状态不允许更新时返回错误
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    current_state = RetirementState(application.state)
    if current_state not in [RetirementState.DRAFT, RetirementState.REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": ErrorCodes.STATE_TRANSITION_ERROR,
                "message": f"Cannot update application in {current_state.value} state",
                "data": {}
            }
        )
    
    # 更新字段
    if update_data.reason is not None:
        application.reason = update_data.reason
    if update_data.expected_decommission_date is not None:
        application.expected_decommission_date = update_data.expected_decommission_date
    if update_data.estimated_value is not None:
        application.estimated_value = update_data.estimated_value
    
    application.version += 1
    db.commit()
    db.refresh(application)
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Application updated successfully"
    )


@router.post(
    "/applications/{application_id}/submit",
    response_model=StandardResponse,
    summary="提交退役申请",
    description="将申请从 DRAFT 状态提交进入审批流程"
)
async def submit_retirement_application(
    application_id: int,
    approver_ids: list[int],
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    提交退役申请进入审批流
    
    执行 DRAFT -> PENDING_APPROVAL 状态转换，
    初始化审批链并分配审批人
    
    Args:
        application_id: 申请 ID
        approver_ids: 审批人 ID 列表（按审批顺序）
        db: 数据库会话
        request_id: 请求追踪 ID
        user_id: 申请人 ID
        user_name: 申请人名称
        
    Returns:
        StandardResponse: 提交后的申请状态
        
    Raises:
        HTTPException: 状态不允许提交或审批链超限时返回错误
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).with_for_update().first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    current_state = RetirementState(application.state)
    
    # 检查是否已提交
    if current_state != RetirementState.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCodes.ALREADY_SUBMITTED,
                "message": f"Application has already been submitted (current state: {current_state.value})",
                "data": {}
            }
        )
    
    # 验证审批链不超过最大层级
    if len(approver_ids) > MAX_APPROVAL_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCodes.APPROVAL_CHAIN_EXCEEDED,
                "message": f"Approval chain exceeds maximum levels ({MAX_APPROVAL_LEVELS})",
                "data": {"max_levels": MAX_APPROVAL_LEVELS, "provided": len(approver_ids)}
            }
        )
    
    # 检查审批人不能是申请人
    if user_id in approver_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCodes.INVALID_APPROVER,
                "message": "Approver cannot be the applicant",
                "data": {}
            }
        )
    
    # 执行状态转换
    sm = AssetRetirementStateMachine(state=current_state)
    new_state = sm.transition(RetirementEvent.SUBMIT)
    
    # 更新申请状态
    application.state = new_state.value
    application.approval_levels = approver_ids
    application.total_approval_levels = len(approver_ids)
    application.current_approval_level = 1
    application.current_approver_id = approver_ids[0]
    application.version += 1
    
    # 创建审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_repo.create_audit_log(
        application_id=application.id,
        event_type="STATE_TRANSITION",
        from_state=current_state.value,
        to_state=new_state.value,
        operator_id=user_id,
        operator_name=user_name,
        request_id=request_id,
        details={
            "event": RetirementEvent.SUBMIT.value,
            "approval_chain": approver_ids
        }
    )
    
    db.commit()
    db.refresh(application)
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Application submitted for approval"
    )


@router.post(
    "/applications/{application_id}/approve",
    response_model=StandardResponse,
    summary="审批通过",
    description="审批人通过申请，推进审批链或最终批准"
)
async def approve_retirement_application(
    application_id: int,
    approve_data: RetirementApproveRequest,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    审批通过
    
    验证当前审批人身份，执行 APPROVE 事件：
    - 非最后一级：推进到下一审批层级
    - 最后一级：状态变为 APPROVED
    
    Args:
        application_id: 申请 ID
        approve_data: 审批数据（审批人ID、批注）
        db: 数据库会话
        request_id: 请求追踪 ID
        user_id: 当前用户 ID
        user_name: 当前用户名称
        
    Returns:
        StandardResponse: 审批后的申请状态
        
    Raises:
        HTTPException: 非当前审批人、状态不允许审批时返回错误
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).with_for_update().first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    current_state = RetirementState(application.state)
    
    # 验证当前审批人
    if application.current_approver_id != approve_data.approver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": 40301,
                "message": "Only current approver can approve this application",
                "data": {
                    "current_approver_id": application.current_approver_id,
                    "provided_approver_id": approve_data.approver_id
                }
            }
        )
    
    # 验证状态
    if current_state != RetirementState.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": ErrorCodes.STATE_TRANSITION_ERROR,
                "message": f"Cannot approve application in {current_state.value} state",
                "data": {}
            }
        )
    
    # 获取审批链
    approval_chain = RetirementApprovalChain(
        application_id=application.id,
        approvers=application.approval_levels,
        session=db
    )
    
    # 执行审批
    is_final = approval_chain.is_final_level()
    if is_final:
        # 最后一级审批通过
        sm = AssetRetirementStateMachine(state=current_state)
        new_state = sm.transition(RetirementEvent.APPROVE)
        application.state = new_state.value
        application.current_approval_level = 0
        application.current_approver_id = None
    else:
        # 推进到下一级
        approval_chain.approve(
            approver_id=approve_data.approver_id,
            comment=approve_data.comment
        )
        application.current_approval_level += 1
        application.current_approver_id = application.approval_levels[application.current_approval_level - 1]
    
    application.version += 1
    
    # 创建审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_repo.create_audit_log(
        application_id=application.id,
        event_type="APPROVAL",
        from_state=current_state.value,
        to_state=application.state.value if is_final else current_state.value,
        operator_id=approve_data.approver_id,
        operator_name=approve_data.approver_name or user_name,
        request_id=request_id,
        details={
            "level": application.current_approval_level - 1 if not is_final else application.total_approval_levels,
            "comment": approve_data.comment,
            "is_final": is_final
        }
    )
    
    db.commit()
    db.refresh(application)
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Application approved" if is_final else "Application approved, forwarded to next level"
    )


@router.post(
    "/applications/{application_id}/reject",
    response_model=StandardResponse,
    summary="审批驳回",
    description="审批人驳回申请，申请人可重新编辑提交"
)
async def reject_retirement_application(
    application_id: int,
    reject_data: RetirementRejectRequest,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    审批驳回
    
    执行 REJECT 事件，状态变为 REJECTED，
    记录驳回原因供申请人参考
    
    Args:
        application_id: 申请 ID
        reject_data: 驳回数据（审批人ID、驳回原因）
        db: 数据库会话
        request_id: 请求追踪 ID
        user_id: 当前用户 ID
        user_name: 当前用户名称
        
    Returns:
        StandardResponse: 驳回后的申请状态
        
    Raises:
        HTTPException: 非当前审批人或状态不允许驳回时返回错误
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).with_for_update().first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    current_state = RetirementState(application.state)
    
    # 验证当前审批人
    if application.current_approver_id != reject_data.approver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": 40301,
                "message": "Only current approver can reject this application",
                "data": {}
            }
        )
    
    # 验证状态
    if current_state != RetirementState.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": ErrorCodes.STATE_TRANSITION_ERROR,
                "message": f"Cannot reject application in {current_state.value} state",
                "data": {}
            }
        )
    
    # 执行状态转换
    sm = AssetRetirementStateMachine(state=current_state)
    new_state = sm.transition(RetirementEvent.REJECT)
    
    application.state = new_state.value
    application.rejection_reason = reject_data.reason
    application.rejection_approver_id = reject_data.approver_id
    application.current_approval_level = 0
    application.current_approver_id = None
    application.version += 1
    
    # 创建审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_repo.create_audit_log(
        application_id=application.id,
        event_type="REJECTION",
        from_state=current_state.value,
        to_state=new_state.value,
        operator_id=reject_data.approver_id,
        operator_name=reject_data.approver_name or user_name,
        request_id=request_id,
        details={"reason": reject_data.reason}
    )
    
    db.commit()
    db.refresh(application)
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Application rejected"
    )


@router.post(
    "/applications/{application_id}/decommission",
    response_model=StandardResponse,
    summary="执行退役",
    description="将已批准的申请执行退役操作"
)
async def decommission_retirement_application(
    application_id: int,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    执行退役
    
    将 APPROVED 状态的申请执行退役，
    状态变为 DECOMMISSIONED，
    关联资产 lifecycle_status 更新为 RETIRED
    
    Args:
        application_id: 申请 ID
        db: 数据库会话
        request_id: 请求追踪 ID
        user_id: 当前用户 ID
        user_name: 当前用户名称
        
    Returns:
        StandardResponse: 退役后的申请状态
        
    Raises:
        HTTPException: 状态不允许退役时返回 422
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).with_for_update().first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    current_state = RetirementState(application.state)
    
    # 验证状态
    if current_state != RetirementState.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": ErrorCodes.STATE_TRANSITION_ERROR,
                "message": f"Cannot decommission application in {current_state.value} state",
                "data": {}
            }
        )
    
    # 执行状态转换
    sm = AssetRetirementStateMachine(state=current_state)
    new_state = sm.transition(RetirementEvent.DECOMMISSION)
    
    application.state = new_state.value
    application.decommissioned_at = datetime.utcnow()
    application.version += 1
    
    # 更新关联资产状态
    asset = db.query(Asset).filter(Asset.id == application.asset_id).first()
    if asset:
        asset.lifecycle_status = "RETIRED"
        asset.version += 1
    
    # 创建审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_repo.create_audit_log(
        application_id=application.id,
        event_type="DECOMMISSION",
        from_state=current_state.value,
        to_state=new_state.value,
        operator_id=user_id,
        operator_name=user_name,
        request_id=request_id,
        details={
            "asset_id": application.asset_id,
            "decommissioned_at": application.decommissioned_at.isoformat() if application.decommissioned_at else None
        }
    )
    
    db.commit()
    db.refresh(application)
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Application decommissioned successfully"
    )


@router.post(
    "/applications/{application_id}/archive",
    response_model=StandardResponse,
    summary="归档退役申请",
    description="将 DRAFT 或 DECOMMISSIONED 状态的申请归档"
)
async def archive_retirement_application(
    application_id: int,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    user_id: int = Depends(get_current_user_id),
    user_name: str = Depends(get_current_user_name),
):
    """
    归档退役申请
    
    将 DRAFT、REJECTED 或 DECOMMISSIONED 状态的申请归档，
    归档后状态变为 ARCHIVED，流程终结
    
    Args:
        application_id: 申请 ID
        db: 数据库会话
        request_id: 请求追踪 ID
        user_id: 当前用户 ID
        user_name: 当前用户名称
        
    Returns:
        StandardResponse: 归档后的申请状态
        
    Raises:
        HTTPException: 状态不允许归档时返回 422
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).with_for_update().first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    current_state = RetirementState(application.state)
    
    # 验证可归档状态
    archivable_states = [
        RetirementState.DRAFT,
        RetirementState.REJECTED,
        RetirementState.DECOMMISSIONED
    ]
    
    if current_state not in archivable_states:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": ErrorCodes.STATE_TRANSITION_ERROR,
                "message": f"Cannot archive application in {current_state.value} state",
                "data": {}
            }
        )
    
    # 执行状态转换
    sm = AssetRetirementStateMachine(state=current_state)
    new_state = sm.transition(RetirementEvent.ARCHIVE)
    
    application.state = new_state.value
    application.archived_at = datetime.utcnow()
    application.version += 1
    
    # 创建审计日志
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_repo.create_audit_log(
        application_id=application.id,
        event_type="ARCHIVE",
        from_state=current_state.value,
        to_state=new_state.value,
        operator_id=user_id,
        operator_name=user_name,
        request_id=request_id,
        details={"archived_at": application.archived_at.isoformat() if application.archived_at else None}
    )
    
    db.commit()
    db.refresh(application)
    
    return StandardResponse(
        code=0,
        data=_serialize_application(application),
        message="Application archived successfully"
    )


@router.get(
    "/applications/{application_id}/audit-logs",
    response_model=StandardResponse,
    summary="获取审计日志",
    description="获取申请的全部审计日志，按时间升序排列"
)
async def get_audit_logs(
    application_id: int,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=100, description="每页数量"),
):
    """
    获取审计日志
    
    返回申请的全部审计记录，按创建时间升序排列
    
    Args:
        application_id: 申请 ID
        db: 数据库会话
        request_id: 请求追踪 ID
        page: 页码
        page_size: 每页记录数
        
    Returns:
        StandardResponse: 分页后的审计日志列表
        
    Raises:
        HTTPException: 申请不存在时返回 404
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.APPLICATION_NOT_FOUND,
                "message": f"Retirement application {application_id} not found",
                "data": {}
            }
        )
    
    audit_repo = RetirementAuditLogRepository(session=db)
    audit_logs = audit_repo.find_by_application(
        application_id=application_id,
        order_by="created_at",
        skip=(page - 1) * page_size,
        limit=page_size
    )
    
    total = audit_repo.count_by_application(application_id)
    
    return StandardResponse(
        code=0,
        data={
            "items": [_serialize_audit_log(log) for log in audit_logs],
            "total": total,
            "page": page,
            "page_size": page_size
        },
        message="Audit logs retrieved successfully"
    )


@router.get(
    "/applications",
    response_model=StandardResponse,
    summary="查询退役申请列表",
    description="分页查询退役申请列表，支持状态过滤"
)
async def list_retirement_applications(
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
    state: Optional[str] = Query(None, description="状态过滤"),
    asset_id: Optional[int] = Query(None, description="资产ID过滤"),
    applicant_id: Optional[int] = Query(None, description="申请人ID过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
):
    """
    查询退役申请列表
    
    支持状态、资产ID、申请人ID 等多维度过滤，
    返回分页后的申请列表
    
    Args:
        db: 数据库会话
        request_id: 请求追踪 ID
        state: 状态过滤
        asset_id: 资产 ID 过滤
        applicant_id: 申请人 ID 过滤
        page: 页码
        page_size: 每页记录数
        
    Returns:
        StandardResponse: 分页后的申请列表
    """
    query = db.query(RetirementApplication)
    
    if state:
        query = query.filter(RetirementApplication.state == state)
    if asset_id:
        query = query.filter(RetirementApplication.asset_id == asset_id)
    if applicant_id:
        query = query.filter(RetirementApplication.applicant_id == applicant_id)
    
    total = query.count()
    applications = query.order_by(
        RetirementApplication.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    return StandardResponse(
        code=0,
        data={
            "items": [_serialize_application(app) for app in applications],
            "total": total,
            "page": page,
            "page_size": page_size
        },
        message="Applications list retrieved successfully"
    )


def _serialize_application(application: RetirementApplication) -> dict:
    """
    序列化申请对象为响应格式
    
    Args:
        application: 申请对象
        
    Returns:
        dict: 序列化的申请数据
    """
    return {
        "id": application.id,
        "asset_id": application.asset_id,
        "applicant_id": application.applicant_id,
        "applicant_name": application.applicant_name,
        "reason": application.reason,
        "expected_decommission_date": application.expected_decommission_date.isoformat() if application.expected_decommission_date else None,
        "estimated_value": float(application.estimated_value) if application.estimated_value else None,
        "state": application.state,
        "current_approval_level": application.current_approval_level,
        "total_approval_levels": application.total_approval_levels,
        "current_approver_id": application.current_approver_id,
        "approval_levels": application.approval_levels or [],
        "rejection_reason": application.rejection_reason,
        "rejection_approver_id": application.rejection_approver_id,
        "decommissioned_at": application.decommissioned_at.isoformat() if application.decommissioned_at else None,
        "archived_at": application.archived_at.isoformat() if application.archived_at else None,
        "version": application.version,
        "created_at": application.created_at.isoformat() if application.created_at else None,
        "updated_at": application.updated_at.isoformat() if application.updated_at else None,
    }


def _serialize_audit_log(log) -> dict:
    """
    序列化审计日志对象为响应格式
    
    Args:
        log: 审计日志对象
        
    Returns:
        dict: 序列化的审计日志数据
    """
    return {
        "id": log.id,
        "application_id": log.application_id,
        "event_type": log.event_type,
        "from_state": log.from_state,
        "to_state": log.to_state,
        "operator_id": log.operator_id,
        "operator_name": log.operator_name,
        "request_id": log.request_id,
        "details": log.details or {},
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }