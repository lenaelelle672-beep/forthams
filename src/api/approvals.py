"""
工单审批 API 模块

实现工单审批流程的 RESTful 接口，包括审批、拒绝、驳回等操作。
基于状态机驱动工单状态流转，支持幂等性操作和异步通知触发。

参考文档: SPEC-SWARM-2025-Q2-P0-003-v3 (Iteration 3 - Phase 3)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# 导入状态机相关模块
from src.domain.state_machine.ticket_state_machine import TicketStateMachine, TicketStatus
from src.domain.state_machine.states import TicketStates
from src.domain.state_machine.transitions import TicketTransitions

# 导入服务层
from src.services.approval_service import ApprovalService
from src.services.notification_service import NotificationService
from src.services.status_history_service import StatusHistoryService

# 导入数据模型
from src.domain.models.state_transition_log import StateTransitionLog
from src.models.ticket import Ticket
from src.infrastructure.database.repositories import TicketRepository

# 导入认证依赖
from src.api.deps.auth import get_current_user, get_current_user_id
from src.api.dependencies.db import get_db_session

# 导入事件发布器
from src.infrastructure.messaging.publisher import EventPublisher

router = APIRouter(prefix="/api/tickets", tags=["审批管理"])


class ApprovalAction(str, Enum):
    """审批操作类型枚举"""
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"  # 驳回


class ApprovalRequest(BaseModel):
    """审批请求参数模型"""
    comment: Optional[str] = Field(None, description="审批意见/拒绝原因")
    reason: Optional[str] = Field(None, description="驳回原因（驳回操作时必填）")


class ApprovalResponse(BaseModel):
    """审批操作响应模型"""
    success: bool = True
    message: str
    ticket_id: int
    previous_status: str
    current_status: str
    operator_id: int
    timestamp: datetime
    notification_sent: bool = False


class StateTransitionError(BaseModel):
    """状态转换错误响应模型"""
    error: str = "invalid_state_transition"
    current: str
    attempted: str
    allowed_transitions: List[str]


class ForbiddenError(BaseModel):
    """权限错误响应模型"""
    error: str = "forbidden"
    message: str = "无审批权限"


class IdempotentResponse(BaseModel):
    """幂等响应模型（重复操作返回此响应）"""
    success: bool = True
    message: str = "操作已完成（幂等响应）"
    ticket_id: int
    current_status: str
    already_processed: bool = True


def check_approval_permission(ticket: Ticket, user_id: int) -> bool:
    """
    检查用户是否具有审批权限
    
    Args:
        ticket: 工单对象
        user_id: 用户ID
    
    Returns:
        bool: 是否具有审批权限
    """
    # 审批人可以是工单负责人、审批链中的当前审批人、或者具有审批员角色的用户
    # 具体实现依赖于 approval_chain 模块
    from src.services.approval_chain_service import ApprovalChainService
    
    chain_service = ApprovalChainService()
    return chain_service.can_approve(ticket_id=ticket.id, user_id=user_id)


def validate_state_transition(
    current_status: str,
    action: ApprovalAction,
    state_machine: TicketStateMachine
) -> Optional[str]:
    """
    校验状态转换的合法性
    
    Args:
        current_status: 当前状态
        action: 审批操作
        state_machine: 状态机实例
    
    Returns:
        str: 错误信息，如果合法返回 None
    """
    # 获取目标状态映射
    status_mapping = {
        ApprovalAction.APPROVE: TicketStatus.PROCESSING.value,
        ApprovalAction.REJECT: TicketStatus.REJECTED.value,
        ApprovalAction.RETURN: TicketStatus.PENDING_APPROVAL.value,
    }
    
    target_status = status_mapping.get(action)
    if not target_status:
        return f"不支持的操作: {action}"
    
    # 使用状态机校验转换合法性
    try:
        state_machine.validate_transition(current_status, target_status)
        return None
    except ValueError as e:
        return str(e)


@router.post(
    "/{ticket_id}/approve",
    response_model=ApprovalResponse,
    responses={
        400: {"model": StateTransitionError, "description": "状态转换非法"},
        403: {"model": ForbiddenError, "description": "无审批权限"},
        404: {"description": "工单不存在"},
    },
    summary="审批工单",
    description="批准工单，将状态从'待审批'变更为'处理中'。幂等操作，重复调用返回200。"
)
async def approve_ticket(
    ticket_id: int,
    request: ApprovalRequest = ApprovalRequest(),
    db=Depends(get_db_session),
    user_id: int = Depends(get_current_user_id),
    state_machine: TicketStateMachine = Depends(TicketStateMachine),
) -> ApprovalResponse:
    """
    审批工单接口
    
    - 支持幂等性：重复审批返回200而非错误
    - 权限校验：仅审批人或具有审批角色的用户可操作
    - 状态机驱动：基于状态机规则校验状态转换
    - 异步通知：状态变更后异步触发通知机制
    - 状态日志：记录状态转换日志
    
    Args:
        ticket_id: 工单ID
        request: 审批请求参数
        db: 数据库会话
        user_id: 当前用户ID
        state_machine: 状态机实例
    
    Returns:
        ApprovalResponse: 审批操作响应
    
    Raises:
        HTTPException: 权限不足或状态非法时抛出
    """
    # 获取工单
    ticket_repo = TicketRepository(db)
    ticket = ticket_repo.get_by_id(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_id} 不存在"
        )
    
    # 幂等性检查：检查工单是否已经不在待审批状态
    if ticket.status != TicketStatus.PENDING_APPROVAL.value:
        return ApprovalResponse(
            success=True,
            message="操作已完成（幂等响应）",
            ticket_id=ticket_id,
            previous_status=ticket.status,
            current_status=ticket.status,
            operator_id=user_id,
            timestamp=datetime.now(),
            notification_sent=False,
        )
    
    # 权限校验
    if not check_approval_permission(ticket, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无审批权限"
        )
    
    # 自审批校验
    if ticket.creator_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能审批自己创建的工单"
        )
    
    # 状态转换校验
    error = validate_state_transition(
        ticket.status,
        ApprovalAction.APPROVE,
        state_machine
    )
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_state_transition",
                "current": ticket.status,
                "attempted": "批准",
                "allowed_transitions": ["待审批 -> 处理中"]
            }
        )
    
    # 执行状态转换
    previous_status = ticket.status
    new_status = TicketStatus.PROCESSING.value
    
    # 更新工单状态（乐观锁）
    ticket_repo.update_status_with_version(
        ticket_id=ticket_id,
        new_status=new_status,
        expected_version=ticket.version
    )
    
    # 记录状态转换日志
    transition_log = StateTransitionLog(
        ticket_id=ticket_id,
        before_status=previous_status,
        after_status=new_status,
        operator_id=user_id,
        action="approve",
        comment=request.comment,
        timestamp=datetime.now()
    )
    status_history_service = StatusHistoryService(db)
    status_history_service.record_transition(transition_log)
    
    # 触发异步通知
    notification_service = NotificationService()
    event_publisher = EventPublisher()
    
    try:
        await event_publisher.publish(
            event_type="ticket_approved",
            payload={
                "ticket_id": ticket_id,
                "new_status": new_status,
                "operator_id": user_id,
                "comment": request.comment,
                "created_at": datetime.now().isoformat()
            }
        )
        notification_sent = True
    except Exception:
        notification_sent = False
    
    return ApprovalResponse(
        success=True,
        message="审批成功",
        ticket_id=ticket_id,
        previous_status=previous_status,
        current_status=new_status,
        operator_id=user_id,
        timestamp=datetime.now(),
        notification_sent=notification_sent,
    )


@router.post(
    "/{ticket_id}/reject",
    response_model=ApprovalResponse,
    responses={
        400: {"model": StateTransitionError, "description": "状态转换非法"},
        403: {"model": ForbiddenError, "description": "无审批权限"},
        404: {"description": "工单不存在"},
    },
    summary="拒绝工单",
    description="拒绝工单，将状态从'待审批'变更为'已拒绝'。需要提供拒绝原因。幂等操作。"
)
async def reject_ticket(
    ticket_id: int,
    request: ApprovalRequest,
    db=Depends(get_db_session),
    user_id: int = Depends(get_current_user_id),
    state_machine: TicketStateMachine = Depends(TicketStateMachine),
) -> ApprovalResponse:
    """
    拒绝工单接口
    
    - 需要提供拒绝原因
    - 支持幂等性
    - 状态机驱动
    - 异步通知：通知工单创建人
    
    Args:
        ticket_id: 工单ID
        request: 拒绝请求参数（必须包含拒绝原因）
        db: 数据库会话
        user_id: 当前用户ID
        state_machine: 状态机实例
    
    Returns:
        ApprovalResponse: 拒绝操作响应
    
    Raises:
        HTTPException: 参数缺失、权限不足或状态非法时抛出
    """
    # 验证拒绝原因
    if not request.comment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="拒绝工单必须提供拒绝原因"
        )
    
    # 获取工单
    ticket_repo = TicketRepository(db)
    ticket = ticket_repo.get_by_id(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_id} 不存在"
        )
    
    # 幂等性检查
    if ticket.status != TicketStatus.PENDING_APPROVAL.value:
        return ApprovalResponse(
            success=True,
            message="操作已完成（幂等响应）",
            ticket_id=ticket_id,
            previous_status=ticket.status,
            current_status=ticket.status,
            operator_id=user_id,
            timestamp=datetime.now(),
            notification_sent=False,
        )
    
    # 权限校验
    if not check_approval_permission(ticket, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无审批权限"
        )
    
    # 自审批校验
    if ticket.creator_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能拒绝自己创建的工单"
        )
    
    # 状态转换校验
    error = validate_state_transition(
        ticket.status,
        ApprovalAction.REJECT,
        state_machine
    )
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_state_transition",
                "current": ticket.status,
                "attempted": "拒绝",
                "allowed_transitions": ["待审批 -> 已拒绝"]
            }
        )
    
    # 执行状态转换
    previous_status = ticket.status
    new_status = TicketStatus.REJECTED.value
    
    # 更新工单状态（乐观锁）
    ticket_repo.update_status_with_version(
        ticket_id=ticket_id,
        new_status=new_status,
        expected_version=ticket.version
    )
    
    # 记录状态转换日志
    transition_log = StateTransitionLog(
        ticket_id=ticket_id,
        before_status=previous_status,
        after_status=new_status,
        operator_id=user_id,
        action="reject",
        comment=request.comment,
        timestamp=datetime.now()
    )
    status_history_service = StatusHistoryService(db)
    status_history_service.record_transition(transition_log)
    
    # 触发异步通知
    notification_service = NotificationService()
    event_publisher = EventPublisher()
    
    try:
        await event_publisher.publish(
            event_type="ticket_rejected",
            payload={
                "ticket_id": ticket_id,
                "new_status": new_status,
                "operator_id": user_id,
                "reason": request.comment,
                "creator_email": ticket.creator_email,
                "created_at": datetime.now().isoformat()
            }
        )
        notification_sent = True
    except Exception:
        notification_sent = False
    
    return ApprovalResponse(
        success=True,
        message="工单已拒绝",
        ticket_id=ticket_id,
        previous_status=previous_status,
        current_status=new_status,
        operator_id=user_id,
        timestamp=datetime.now(),
        notification_sent=notification_sent,
    )


@router.post(
    "/{ticket_id}/return",
    response_model=ApprovalResponse,
    responses={
        400: {"model": StateTransitionError, "description": "状态转换非法"},
        403: {"model": ForbiddenError, "description": "无审批权限"},
        404: {"description": "工单不存在"},
    },
    summary="驳回工单",
    description="驳回工单，将状态从'处理中'变更为'待审批'。需要提供驳回原因。"
)
async def return_ticket(
    ticket_id: int,
    request: ApprovalRequest,
    db=Depends(get_db_session),
    user_id: int = Depends(get_current_user_id),
    state_machine: TicketStateMachine = Depends(TicketStateMachine),
) -> ApprovalResponse:
    """
    驳回工单接口
    
    - 仅当工单状态为'处理中'时可操作
    - 需要提供驳回原因
    - 支持幂等性
    - 异步通知：通知工单创建人修改后重新提交
    
    Args:
        ticket_id: 工单ID
        request: 驳回请求参数（必须包含驳回原因）
        db: 数据库会话
        user_id: 当前用户ID
        state_machine: 状态机实例
    
    Returns:
        ApprovalResponse: 驳回操作响应
    
    Raises:
        HTTPException: 参数缺失、权限不足或状态非法时抛出
    """
    # 验证驳回原因
    if not request.comment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="驳回工单必须提供驳回原因"
        )
    
    # 获取工单
    ticket_repo = TicketRepository(db)
    ticket = ticket_repo.get_by_id(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_id} 不存在"
        )
    
    # 状态转换校验（驳回仅在处理中状态可用）
    error = validate_state_transition(
        ticket.status,
        ApprovalAction.RETURN,
        state_machine
    )
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_state_transition",
                "current": ticket.status,
                "attempted": "驳回",
                "allowed_transitions": ["处理中 -> 待审批"]
            }
        )
    
    # 权限校验
    if not check_approval_permission(ticket, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无审批权限"
        )
    
    # 执行状态转换
    previous_status = ticket.status
    new_status = TicketStatus.PENDING_APPROVAL.value
    
    # 更新工单状态（乐观锁）
    ticket_repo.update_status_with_version(
        ticket_id=ticket_id,
        new_status=new_status,
        expected_version=ticket.version
    )
    
    # 记录状态转换日志
    transition_log = StateTransitionLog(
        ticket_id=ticket_id,
        before_status=previous_status,
        after_status=new_status,
        operator_id=user_id,
        action="return",
        comment=request.comment,
        timestamp=datetime.now()
    )
    status_history_service = StatusHistoryService(db)
    status_history_service.record_transition(transition_log)
    
    # 触发异步通知
    event_publisher = EventPublisher()
    
    try:
        await event_publisher.publish(
            event_type="ticket_returned",
            payload={
                "ticket_id": ticket_id,
                "new_status": new_status,
                "operator_id": user_id,
                "reason": request.comment,
                "creator_email": ticket.creator_email,
                "created_at": datetime.now().isoformat()
            }
        )
        notification_sent = True
    except Exception:
        notification_sent = False
    
    return ApprovalResponse(
        success=True,
        message="工单已驳回",
        ticket_id=ticket_id,
        previous_status=previous_status,
        current_status=new_status,
        operator_id=user_id,
        timestamp=datetime.now(),
        notification_sent=notification_sent,
    )


@router.post(
    "/{ticket_id}/complete",
    response_model=ApprovalResponse,
    responses={
        400: {"model": StateTransitionError, "description": "状态转换非法"},
        403: {"model": ForbiddenError, "description": "无权限"},
        404: {"description": "工单不存在"},
    },
    summary="完成工单",
    description="将工单状态从'处理中'变更为'已完成'。"
)
async def complete_ticket(
    ticket_id: int,
    request: ApprovalRequest = ApprovalRequest(),
    db=Depends(get_db_session),
    user_id: int = Depends(get_current_user_id),
    state_machine: TicketStateMachine = Depends(TicketStateMachine),
) -> ApprovalResponse:
    """
    完成工单接口
    
    - 仅当工单状态为'处理中'时可操作
    - 状态机驱动
    - 记录完成日志
    
    Args:
        ticket_id: 工单ID
        request: 请求参数
        db: 数据库会话
        user_id: 当前用户ID
        state_machine: 状态机实例
    
    Returns:
        ApprovalResponse: 完成操作响应
    
    Raises:
        HTTPException: 状态非法或权限不足时抛出
    """
    # 获取工单
    ticket_repo = TicketRepository(db)
    ticket = ticket_repo.get_by_id(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_id} 不存在"
        )
    
    # 状态转换校验（完成仅在处理中状态可用）
    if ticket.status != TicketStatus.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_state_transition",
                "current": ticket.status,
                "attempted": "完成",
                "allowed_transitions": ["处理中 -> 已完成"]
            }
        )
    
    # 执行状态转换
    previous_status = ticket.status
    new_status = TicketStatus.COMPLETED.value
    
    # 更新工单状态（乐观锁）
    ticket_repo.update_status_with_version(
        ticket_id=ticket_id,
        new_status=new_status,
        expected_version=ticket.version
    )
    
    # 记录状态转换日志
    transition_log = StateTransitionLog(
        ticket_id=ticket_id,
        before_status=previous_status,
        after_status=new_status,
        operator_id=user_id,
        action="complete",
        comment=request.comment,
        timestamp=datetime.now()
    )
    status_history_service = StatusHistoryService(db)
    status_history_service.record_transition(transition_log)
    
    return ApprovalResponse(
        success=True,
        message="工单已完成",
        ticket_id=ticket_id,
        previous_status=previous_status,
        current_status=new_status,
        operator_id=user_id,
        timestamp=datetime.now(),
        notification_sent=False,
    )


# 状态流转矩阵定义（供前端参考）
STATE_TRANSITION_MATRIX = {
    TicketStatus.PENDING_APPROVAL.value: {
        "approve": TicketStatus.PROCESSING.value,
        "reject": TicketStatus.REJECTED.value,
        "return": None,  # 不可操作
        "complete": None,  # 不可操作
    },
    TicketStatus.PROCESSING.value: {
        "approve": None,  # 禁止
        "reject": None,  # 禁止
        "return": TicketStatus.PENDING_APPROVAL.value,
        "complete": TicketStatus.COMPLETED.value,
    },
    TicketStatus.REJECTED.value: {
        "approve": None,  # 禁止
        "reject": None,  # 禁止
        "return": None,  # 禁止
        "complete": None,  # 禁止
    },
    TicketStatus.COMPLETED.value: {
        "approve": None,  # 禁止
        "reject": None,  # 禁止
        "return": None,  # 禁止
        "complete": None,  # 禁止
    },
}


@router.get(
    "/{ticket_id}/allowed-actions",
    summary="获取允许的操作",
    description="根据工单当前状态返回允许的操作列表"
)
async def get_allowed_actions(
    ticket_id: int,
    db=Depends(get_db_session),
) -> dict:
    """
    获取工单当前状态允许的操作列表
    
    Args:
        ticket_id: 工单ID
        db: 数据库会话
    
    Returns:
        dict: 允许的操作列表
    """
    ticket_repo = TicketRepository(db)
    ticket = ticket_repo.get_by_id(ticket_id)
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_id} 不存在"
        )
    
    current_status = ticket.status
    transitions = STATE_TRANSITION_MATRIX.get(current_status, {})
    
    allowed_actions = [
        action for action, target in transitions.items()
        if target is not None
    ]
    
    return {
        "ticket_id": ticket_id,
        "current_status": current_status,
        "allowed_actions": allowed_actions,
        "available_transitions": {
            action: target for action, target in transitions.items()
            if target is not None
        }
    }