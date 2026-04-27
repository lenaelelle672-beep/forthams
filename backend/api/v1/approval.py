"""
Approval API v1 — 工单多级审批 RESTful 接口.

提供工单审批流的 HTTP 端点，包括审批通过、驳回、审批记录查询及待审批列表。
状态流转严格遵循: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED / REJECTED / CANCELLED。
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from backend.services.approval_service import ApprovalService
from backend.services.notification_service import NotificationService
from backend.state_machine.workorder_state_machine import (
    ApprovalStatus,
    InvalidStateTransitionError,
    WorkOrderStateMachine,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/approval", tags=["approval"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class ApproveRequest(BaseModel):
    """审批通过请求体。

    Attributes:
        order_id: 工单唯一标识。
        approver_id: 审批人用户 ID。
        comment: 审批意见（可选）。
    """

    order_id: str = Field(..., min_length=1, description="工单 ID")
    approver_id: str = Field(..., min_length=1, description="审批人用户 ID")
    comment: Optional[str] = Field(default=None, max_length=500, description="审批意见")


class RejectRequest(BaseModel):
    """审批驳回请求体。

    Attributes:
        order_id: 工单唯一标识。
        approver_id: 审批人用户 ID。
        rejection_reason: 驳回原因，必填且长度 >= 10 字符。
    """

    order_id: str = Field(..., min_length=1, description="工单 ID")
    approver_id: str = Field(..., min_length=1, description="审批人用户 ID")
    rejection_reason: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="驳回原因（必填，至少 10 个字符）",
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_be_meaningful(cls, v: str) -> str:
        """校验驳回原因不能仅包含空白字符。"""
        stripped = v.strip()
        if len(stripped) < 10:
            raise ValueError("驳回原因不能仅包含空白字符，且有效内容长度不得少于 10 个字符")
        return v


class ApprovalRecordResponse(BaseModel):
    """审批记录响应体。

    Attributes:
        id: 记录 ID。
        order_id: 关联工单 ID。
        approver_id: 审批人 ID。
        action: 审批动作（APPROVE / REJECT）。
        approval_level: 审批层级（LEVEL_1 / LEVEL_2）。
        comment: 审批意见。
        rejection_reason: 驳回原因（仅驳回时有值）。
        created_at: 记录创建时间。
    """

    id: str
    order_id: str
    approver_id: str
    action: str
    approval_level: str
    comment: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime


class ApprovalListResponse(BaseModel):
    """待审批列表响应体。

    Attributes:
        items: 待审批工单列表。
        total: 总数。
    """

    items: list[dict[str, Any]]
    total: int


class ApiResponse(BaseModel):
    """统一 API 响应包装。

    Attributes:
        code: 业务状态码。
        message: 提示信息。
        data: 响应数据。
    """

    code: int = 0
    message: str = "success"
    data: Optional[Any] = None


# ---------------------------------------------------------------------------
# Dependency helpers
# ---------------------------------------------------------------------------

def _get_approval_service(request: Request) -> ApprovalService:
    """从应用状态中获取 ApprovalService 实例。

    Args:
        request: FastAPI 请求对象。

    Returns:
        ApprovalService 实例。
    """
    return request.app.state.approval_service  # type: ignore[return-value]


def _get_notification_service(request: Request) -> NotificationService:
    """从应用状态中获取 NotificationService 实例。

    Args:
        request: FastAPI 请求对象。

    Returns:
        NotificationService 实例。
    """
    return request.app.state.notification_service  # type: ignore[return-value]


def _get_current_user_role(request: Request) -> str:
    """从请求上下文中提取当前用户角色。

    Args:
        request: FastAPI 请求对象。

    Returns:
        当前用户角色标识字符串。

    Raises:
        HTTPException: 当无法识别用户角色时返回 401。
    """
    role = getattr(request.state, "user_role", None)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法识别当前用户角色，请重新登录",
        )
    return role


def _get_current_user_id(request: Request) -> str:
    """从请求上下文中提取当前用户 ID。

    Args:
        request: FastAPI 请求对象。

    Returns:
        当前用户 ID 字符串。

    Raises:
        HTTPException: 当无法识别用户时返回 401。
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法识别当前用户，请重新登录",
        )
    return user_id


# ---------------------------------------------------------------------------
# Role constants
# ---------------------------------------------------------------------------

ROLE_DEPARTMENT_SUPERVISOR = "department_supervisor"
ROLE_ASSET_MANAGER = "asset_manager"

# Mapping: approval level → allowed role
_LEVEL_ROLE_MAP: dict[str, str] = {
    ApprovalStatus.APPROVING_LEVEL_1.value: ROLE_DEPARTMENT_SUPERVISOR,
    ApprovalStatus.APPROVING_LEVEL_2.value: ROLE_ASSET_MANAGER,
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/orders/{order_id}/approve",
    response_model=ApiResponse,
    summary="审批通过",
    description="对指定工单执行审批通过操作。系统根据工单当前状态自动判定审批层级，"
    "并校验当前用户是否具备对应层级审批权限。",
    responses={
        200: {"description": "审批通过成功"},
        403: {"description": "权限不足或状态不允许此操作"},
        404: {"description": "工单不存在"},
        409: {"description": "状态冲突（非法状态跳跃）"},
    },
)
async def approve_order(
    order_id: str,
    body: ApproveRequest,
    request: Request,
    approval_service: ApprovalService = Depends(_get_approval_service),
    notification_service: NotificationService = Depends(_get_notification_service),
    current_role: str = Depends(_get_current_user_role),
    current_user_id: str = Depends(_get_current_user_id),
) -> ApiResponse:
    """审批通过接口。

    根据工单当前状态判断审批层级（L1/L2），校验操作人角色权限，
    调用状态机执行状态流转，持久化审批记录，并异步发送审批通知。

    Args:
        order_id: 工单 ID（路径参数）。
        body: 审批通过请求体。
        request: FastAPI 请求对象。
        approval_service: 审批服务（依赖注入）。
        notification_service: 通知服务（依赖注入）。
        current_role: 当前用户角色（依赖注入）。
        current_user_id: 当前用户 ID（依赖注入）。

    Returns:
        ApiResponse 包含更新后的工单状态。

    Raises:
        HTTPException 404: 工单不存在。
        HTTPException 403: 权限不足。
        HTTPException 409: 非法状态流转。
    """
    logger.info("审批通过请求: order_id=%s, approver=%s", order_id, body.approver_id)

    # 1. 获取工单当前状态
    order = await approval_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {order_id} 不存在",
        )

    current_status = order.get("status", "")
    approval_level = _LEVEL_ROLE_MAP.get(current_status)

    # 2. 校验当前状态是否为可审批状态
    if not approval_level:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"工单当前状态为 {current_status}，不允许执行审批通过操作",
        )

    # 3. 校验角色权限
    if current_role != approval_level:
        expected_role_name = (
            "部门主管" if approval_level == ROLE_DEPARTMENT_SUPERVISOR else "资产管理员"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"权限不足：当前审批节点需要 {expected_role_name} 角色，"
            f"您的角色为 {current_role}",
        )

    # 4. 执行状态机流转
    try:
        new_status = await approval_service.approve(
            order_id=order_id,
            approver_id=body.approver_id,
            comment=body.comment,
        )
    except InvalidStateTransitionError as exc:
        logger.warning("状态流转失败: order_id=%s, error=%s", order_id, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"非法状态流转: {exc}",
        ) from exc

    # 5. 异步发送审批通知（不阻塞主事务）
    try:
        await notification_service.publish_approval_event(
            order_id=order_id,
            action="APPROVE",
            approver_id=body.approver_id,
            new_status=new_status,
            approval_level=approval_level,
        )
    except Exception as exc:
        logger.error("审批通知发送失败（不影响审批结果）: %s", exc)

    logger.info("审批通过成功: order_id=%s, new_status=%s", order_id, new_status)
    return ApiResponse(
        code=0,
        message="审批通过成功",
        data={"order_id": order_id, "status": new_status},
    )


@router.post(
    "/orders/{order_id}/reject",
    response_model=ApiResponse,
    summary="审批驳回",
    description="对指定工单执行审批驳回操作。驳回原因为必填项，"
    "长度不得少于 10 个字符。驳回后工单进入 REJECTED 终态。",
    responses={
        200: {"description": "驳回成功"},
        400: {"description": "驳回原因校验失败"},
        403: {"description": "权限不足或状态不允许此操作"},
        404: {"description": "工单不存在"},
        409: {"description": "状态冲突（非法状态跳跃）"},
    },
)
async def reject_order(
    order_id: str,
    body: RejectRequest,
    request: Request,
    approval_service: ApprovalService = Depends(_get_approval_service),
    notification_service: NotificationService = Depends(_get_notification_service),
    current_role: str = Depends(_get_current_user_role),
    current_user_id: str = Depends(_get_current_user_id),
) -> ApiResponse:
    """审批驳回接口。

    根据工单当前状态判断审批层级（L1/L2），校验操作人角色权限与驳回原因，
    调用状态机执行状态流转至 REJECTED（终态），持久化审批记录，并异步发送审批通知。

    Args:
        order_id: 工单 ID（路径参数）。
        body: 审批驳回请求体（含必填 rejection_reason）。
        request: FastAPI 请求对象。
        approval_service: 审批服务（依赖注入）。
        notification_service: 通知服务（依赖注入）。
        current_role: 当前用户角色（依赖注入）。
        current_user_id: 当前用户 ID（依赖注入）。

    Returns:
        ApiResponse 包含更新后的工单状态及驳回原因。

    Raises:
        HTTPException 400: 驳回原因校验失败。
        HTTPException 404: 工单不存在。
        HTTPException 403: 权限不足。
        HTTPException 409: 非法状态流转。
    """
    logger.info("审批驳回请求: order_id=%s, approver=%s", order_id, body.approver_id)

    # 1. 获取工单当前状态
    order = await approval_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {order_id} 不存在",
        )

    current_status = order.get("status", "")
    approval_level = _LEVEL_ROLE_MAP.get(current_status)

    # 2. 校验当前状态是否为可审批状态
    if not approval_level:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"工单当前状态为 {current_status}，不允许执行审批驳回操作",
        )

    # 3. 校验角色权限
    if current_role != approval_level:
        expected_role_name = (
            "部门主管" if approval_level == ROLE_DEPARTMENT_SUPERVISOR else "资产管理员"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"权限不足：当前审批节点需要 {expected_role_name} 角色，"
            f"您的角色为 {current_role}",
        )

    # 4. 执行状态机流转（驳回 → REJECTED 终态）
    try:
        new_status = await approval_service.reject(
            order_id=order_id,
            approver_id=body.approver_id,
            rejection_reason=body.rejection_reason,
        )
    except InvalidStateTransitionError as exc:
        logger.warning("状态流转失败: order_id=%s, error=%s", order_id, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"非法状态流转: {exc}",
        ) from exc
    except ValueError as exc:
        logger.warning("驳回校验失败: order_id=%s, error=%s", order_id, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # 5. 异步发送审批通知（不阻塞主事务）
    try:
        await notification_service.publish_approval_event(
            order_id=order_id,
            action="REJECT",
            approver_id=body.approver_id,
            new_status=new_status,
            approval_level=approval_level,
            rejection_reason=body.rejection_reason,
        )
    except Exception as exc:
        logger.error("审批通知发送失败（不影响审批结果）: %s", exc)

    logger.info("审批驳回成功: order_id=%s, new_status=%s", order_id, new_status)
    return ApiResponse(
        code=0,
        message="审批驳回成功",
        data={
            "order_id": order_id,
            "status": new_status,
            "rejection_reason": body.rejection_reason,
        },
    )


@router.get(
    "/orders/{order_id}/records",
    response_model=ApiResponse,
    summary="查询审批记录",
    description="查询指定工单的全部审批记录，按时间倒序排列。"
    "审批记录一经生成仅可追加，不可修改或删除。",
    responses={
        200: {"description": "查询成功"},
        404: {"description": "工单不存在"},
    },
)
async def get_approval_records(
    order_id: str,
    request: Request,
    approval_service: ApprovalService = Depends(_get_approval_service),
) -> ApiResponse:
    """查询工单审批记录接口。

    返回指定工单的所有审批记录，按创建时间倒序排列。
    审批记录为不可篡改的追加型数据。

    Args:
        order_id: 工单 ID（路径参数）。
        request: FastAPI 请求对象。
        approval_service: 审批服务（依赖注入）。

    Returns:
        ApiResponse 包含审批记录列表。

    Raises:
        HTTPException 404: 工单不存在。
    """
    logger.info("查询审批记录: order_id=%s", order_id)

    # 校验工单存在性
    order = await approval_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {order_id} 不存在",
        )

    records = await approval_service.get_approval_records(order_id)
    return ApiResponse(
        code=0,
        message="查询成功",
        data={
            "order_id": order_id,
            "records": records,
            "total": len(records),
        },
    )


@router.get(
    "/pending",
    response_model=ApiResponse,
    summary="查询待审批工单列表",
    description="根据当前用户角色返回对应的待审批工单列表。"
    "部门主管仅可见 APPROVING_LEVEL_1 状态工单，资产管理员仅可见 APPROVING_LEVEL_2 状态工单。",
    responses={
        200: {"description": "查询成功"},
    },
)
async def get_pending_approvals(
    request: Request,
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    approval_service: ApprovalService = Depends(_get_approval_service),
    current_role: str = Depends(_get_current_user_role),
    current_user_id: str = Depends(_get_current_user_id),
) -> ApiResponse:
    """查询待审批工单列表接口。

    根据当前用户角色过滤待审批工单：
    - 部门主管（department_supervisor）：仅返回 APPROVING_LEVEL_1 状态工单。
    - 资产管理员（asset_manager）：仅返回 APPROVING_LEVEL_2 状态工单。

    Args:
        request: FastAPI 请求对象。
        page: 页码（从 1 开始）。
        page_size: 每页数量（1-100）。
        approval_service: 审批服务（依赖注入）。
        current_role: 当前用户角色（依赖注入）。
        current_user_id: 当前用户 ID（依赖注入）。

    Returns:
        ApiResponse 包含分页后的待审批工单列表。
    """
    logger.info("查询待审批列表: role=%s, user=%s, page=%d", current_role, current_user_id, page)

    # 根据角色确定查询的审批状态
    target_status: Optional[str] = None
    if current_role == ROLE_DEPARTMENT_SUPERVISOR:
        target_status = ApprovalStatus.APPROVING_LEVEL_1.value
    elif current_role == ROLE_ASSET_MANAGER:
        target_status = ApprovalStatus.APPROVING_LEVEL_2.value
    else:
        # 非审批角色返回空列表
        return ApiResponse(
            code=0,
            message="当前角色无待审批工单",
            data={"items": [], "total": 0, "page": page, "page_size": page_size},
        )

    result = await approval_service.get_pending_orders(
        status=target_status,
        page=page,
        page_size=page_size,
    )

    return ApiResponse(
        code=0,
        message="查询成功",
        data={
            "items": result.get("items", []),
            "total": result.get("total", 0),
            "page": page,
            "page_size": page_size,
            "approval_level": target_status,
        },
    )


@router.get(
    "/orders/{order_id}/status",
    response_model=ApiResponse,
    summary="查询工单审批状态",
    description="查询指定工单的当前审批状态及可执行操作。",
    responses={
        200: {"description": "查询成功"},
        404: {"description": "工单不存在"},
    },
)
async def get_order_approval_status(
    order_id: str,
    request: Request,
    approval_service: ApprovalService = Depends(_get_approval_service),
    current_role: str = Depends(_get_current_user_role),
) -> ApiResponse:
    """查询工单审批状态接口。

    返回工单当前状态、当前审批层级、当前用户可执行的操作等信息。

    Args:
        order_id: 工单 ID（路径参数）。
        request: FastAPI 请求对象。
        approval_service: 审批服务（依赖注入）。
        current_role: 当前用户角色（依赖注入）。

    Returns:
        ApiResponse 包含工单审批状态详情。

    Raises:
        HTTPException 404: 工单不存在。
    """
    logger.info("查询工单审批状态: order_id=%s", order_id)

    order = await approval_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {order_id} 不存在",
        )

    current_status = order.get("status", "")

    # 判断当前用户可执行的操作
    allowed_actions: list[str] = []
    required_role: Optional[str] = None

    if current_status == ApprovalStatus.APPROVING_LEVEL_1.value:
        required_role = ROLE_DEPARTMENT_SUPERVISOR
        if current_role == required_role:
            allowed_actions = ["APPROVE", "REJECT"]
    elif current_status == ApprovalStatus.APPROVING_LEVEL_2.value:
        required_role = ROLE_ASSET_MANAGER
        if current_role == required_role:
            allowed_actions = ["APPROVE", "REJECT"]

    # 判断是否为终态
    terminal_states = {
        ApprovalStatus.APPROVED.value,
        ApprovalStatus.REJECTED.value,
        ApprovalStatus.CANCELLED.value,
    }
    is_terminal = current_status in terminal_states

    return ApiResponse(
        code=0,
        message="查询成功",
        data={
            "order_id": order_id,
            "status": current_status,
            "is_terminal": is_terminal,
            "required_role": required_role,
            "allowed_actions": allowed_actions,
            "current_user_role": current_role,
        },
    )


@router.post(
    "/orders/{order_id}/submit",
    response_model=ApiResponse,
    summary="提交工单审批",
    description="将 PENDING 状态的工单提交至审批流程，状态变更为 APPROVING_LEVEL_1。",
    responses={
        200: {"description": "提交成功"},
        404: {"description": "工单不存在"},
        409: {"description": "工单当前状态不允许提交"},
    },
)
async def submit_order_for_approval(
    order_id: str,
    request: Request,
    approval_service: ApprovalService = Depends(_get_approval_service),
    notification_service: NotificationService = Depends(_get_notification_service),
    current_user_id: str = Depends(_get_current_user_id),
) -> ApiResponse:
    """提交工单审批接口。

    将 PENDING 状态的工单提交至审批流程，状态流转为 APPROVING_LEVEL_1。
    仅工单申请人或具有提交权限的用户可执行此操作。

    Args:
        order_id: 工单 ID（路径参数）。
        request: FastAPI 请求对象。
        approval_service: 审批服务（依赖注入）。
        notification_service: 通知服务（依赖注入）。
        current_user_id: 当前用户 ID（依赖注入）。

    Returns:
        ApiResponse 包含更新后的工单状态。

    Raises:
        HTTPException 404: 工单不存在。
        HTTPException 409: 工单状态不允许提交。
    """
    logger.info("提交工单审批: order_id=%s, user=%s", order_id, current_user_id)

    order = await approval_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {order_id} 不存在",
        )

    current_status = order.get("status", "")
    if current_status != ApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"工单当前状态为 {current_status}，仅 PENDING 状态可提交审批",
        )

    try:
        new_status = await approval_service.submit_for_approval(
            order_id=order_id,
            applicant_id=current_user_id,
        )
    except InvalidStateTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态流转失败: {exc}",
        ) from exc

    # 异步通知部门主管有新工单待审批
    try:
        await notification_service.publish_approval_event(
            order_id=order_id,
            action="SUBMIT",
            approver_id=current_user_id,
            new_status=new_status,
            approval_level=ApprovalStatus.APPROVING_LEVEL_1.value,
        )
    except Exception as exc:
        logger.error("提交审批通知发送失败（不影响提交结果）: %s", exc)

    logger.info("工单提交审批成功: order_id=%s, new_status=%s", order_id, new_status)
    return ApiResponse(
        code=0,
        message="工单已提交审批",
        data={"order_id": order_id, "status": new_status},
    )


@router.post(
    "/orders/{order_id}/cancel",
    response_model=ApiResponse,
    summary="取消工单",
    description="取消工单审批流程。仅 PENDING 或 APPROVING_LEVEL_1 状态下可取消。",
    responses={
        200: {"description": "取消成功"},
        404: {"description": "工单不存在"},
        409: {"description": "工单当前状态不允许取消"},
    },
)
async def cancel_order(
    order_id: str,
    request: Request,
    approval_service: ApprovalService = Depends(_get_approval_service),
    notification_service: NotificationService = Depends(_get_notification_service),
    current_user_id: str = Depends(_get_current_user_id),
) -> ApiResponse:
    """取消工单接口。

    在 PENDING 或 APPROVING_LEVEL_1 状态下可取消工单，状态流转为 CANCELLED（终态）。

    Args:
        order_id: 工单 ID（路径参数）。
        request: FastAPI 请求对象。
        approval_service: 审批服务（依赖注入）。
        notification_service: 通知服务（依赖注入）。
        current_user_id: 当前用户 ID（依赖注入）。

    Returns:
        ApiResponse 包含更新后的工单状态。

    Raises:
        HTTPException 404: 工单不存在。
        HTTPException 409: 工单状态不允许取消。
    """
    logger.info("取消工单: order_id=%s, user=%s", order_id, current_user_id)

    order = await approval_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {order_id} 不存在",
        )

    current_status = order.get("status", "")
    cancellable_states = {
        ApprovalStatus.PENDING.value,
        ApprovalStatus.APPROVING_LEVEL_1.value,
    }
    if current_status not in cancellable_states:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"工单当前状态为 {current_status}，仅 {cancellable_states} 状态可取消",
        )

    try:
        new_status = await approval_service.cancel_order(
            order_id=order_id,
            operator_id=current_user_id,
        )
    except InvalidStateTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态流转失败: {exc}",
        ) from exc

    # 异步通知相关人员工单已取消
    try:
        await notification_service.publish_approval_event(
            order_id=order_id,
            action="CANCEL",
            approver_id=current_user_id,
            new_status=new_status,
        )
    except Exception as exc:
        logger.error("取消通知发送失败（不影响取消结果）: %s", exc)

    logger.info("工单取消成功: order_id=%s, new_status=%s", order_id, new_status)
    return ApiResponse(
        code=0,
        message="工单已取消",
        data={"order_id": order_id, "status": new_status},
    )