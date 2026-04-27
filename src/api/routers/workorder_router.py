"""
工单审批流程 API 路由模块

实现工单审批全链路数字化闭环的后端 API 端点。
采用状态机模式管理工单状态流转，并触发对应的通知机制。

版本：Iteration 8
对应规格：SWARM-2025-Q2-P0-003

功能范围：
- POST /api/v1/work-orders/{id}/approve - 审批通过
- POST /api/v1/work-orders/{id}/reject - 审批拒绝
- GET /api/v1/work-orders/pending - 待审批列表
- GET /api/v1/work-orders/{id} - 工单详情

约束条件：
- 状态约束：PENDING → IN_PROGRESS → APPROVED（正向流程），拒绝可退回
- 并发约束：乐观锁版本号控制，同一工单同时仅允许一个审批操作
- 响应时间：不超过 2 秒
- 通知异步：通知失败不阻塞审批主流程

状态枚举：
- PENDING: 待审批
- IN_PROGRESS: 审批中
- APPROVED: 已通过
- REJECTED: 已拒绝
- CLOSED: 已关闭

API 规范版本：v1
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

# ============================================================================
# 枚举定义
# ============================================================================

class WorkOrderState(str, Enum):
    """工单状态枚举
    
    定义工单全生命周期状态流转
    
    状态转换规则：
    - PENDING → IN_PROGRESS: 开始审批
    - IN_PROGRESS → APPROVED: 审批通过
    - IN_PROGRESS → REJECTED: 审批拒绝
    - APPROVED/REJECTED → CLOSED: 工单关闭
    """
    PENDING = "PENDING"           # 待审批
    IN_PROGRESS = "IN_PROGRESS"   # 审批中
    APPROVED = "APPROVED"         # 已通过
    REJECTED = "REJECTED"         # 已拒绝
    CLOSED = "CLOSED"             # 已关闭


class OperationType(str, Enum):
    """操作类型枚举"""
    APPROVE = "APPROVE"   # 通过
    REJECT = "REJECT"     # 拒绝


# ============================================================================
# Pydantic Schema 定义
# ============================================================================

class WorkOrderBase(BaseModel):
    """工单基础 schema"""
    title: str = Field(..., description="工单标题", min_length=1, max_length=200)
    content: str = Field(..., description="工单内容", min_length=1, max_length=5000)
    creator: str = Field(..., description="创建人")


class ApproveRequest(BaseModel):
    """审批通过请求 Schema
    
    Attributes:
        reason: 审批意见（非必填，最大 500 字符）
        version: 版本号（乐观锁冲突检测）
    """
    reason: Optional[str] = Field(
        None, 
        description="审批意见",
        max_length=500
    )
    version: int = Field(
        ..., 
        description="当前版本号，用于乐观锁冲突检测",
        gt=0
    )
    
    @field_validator('reason')
    @classmethod
    def validate_reason(cls, v: Optional[str]) -> Optional[str]:
        """验证审批意见长度"""
        if v is not None and len(v.strip()) > 500:
            raise ValueError('审批意见最大长度为 500 字符')
        return v.strip() if v else None


class RejectRequest(BaseModel):
    """审批拒绝请求 Schema
    
    Attributes:
        reason: 拒绝原因（必填，最大 500 字符）
        version: 版本号（乐观锁冲突检测）
    """
    reason: str = Field(
        ..., 
        description="拒绝原因",
        min_length=1,
        max_length=500
    )
    version: int = Field(
        ..., 
        description="当前版本号，用于乐观锁冲突检测",
        gt=0
    )


class WorkOrderListItem(BaseModel):
    """工单列表项 Schema
    
    用于 GET /api/v1/work-orders/pending 接口返回
    """
    id: str = Field(..., description="工单 ID")
    title: str = Field(..., description="工单标题")
    creator: str = Field(..., description="创建人")
    created_at: datetime = Field(..., description="创建时间")
    state: WorkOrderState = Field(..., description="当前状态")


class WorkOrderDetail(BaseModel):
    """工单详情 Schema
    
    用于 GET /api/v1/work-orders/{id} 接口返回
    """
    id: str = Field(..., description="工单 ID")
    title: str = Field(..., description="工单标题")
    content: str = Field(..., description="工单内容")
    creator: str = Field(..., description="创建人")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    state: WorkOrderState = Field(..., description="当前状态")
    version: int = Field(..., description="版本号")
    history: List["ApprovalHistoryItem"] = Field(default_factory=list, description="审批历史")


class ApprovalHistoryItem(BaseModel):
    """审批历史项 Schema"""
    id: int = Field(..., description="历史记录 ID")
    operator: str = Field(..., description="操作人")
    action: OperationType = Field(..., description="操作类型")
    reason: Optional[str] = Field(None, description="审批意见")
    created_at: datetime = Field(..., description="操作时间")


class ApproveResponse(BaseModel):
    """审批通过响应 Schema"""
    id: str = Field(..., description="工单 ID")
    state: WorkOrderState = Field(..., description="更新后的状态")
    version: int = Field(..., description="新版本号")
    updated_at: datetime = Field(..., description="更新时间")


class RejectResponse(BaseModel):
    """审批拒绝响应 Schema"""
    id: str = Field(..., description="工单 ID")
    state: WorkOrderState = Field(..., description="更新后的状态")
    version: int = Field(..., description="新版本号")
    updated_at: datetime = Field(..., description="更新时间")


class WorkOrderListResponse(BaseModel):
    """工单列表响应 Schema"""
    items: List[WorkOrderListItem] = Field(default_factory=list, description="工单列表")
    total: int = Field(..., description="总数")
    page: int = Field(..., description="当前页")
    page_size: int = Field(..., description="每页数量")


class ErrorResponse(BaseModel):
    """错误响应 Schema"""
    detail: str = Field(..., description="错误详情")
    code: Optional[str] = Field(None, description="错误代码")


# 解决前向引用
WorkOrderDetail.model_rebuild()


# ============================================================================
# 状态机引擎
# ============================================================================

class WorkOrderStateMachine:
    """工单状态机引擎
    
    管理工单状态流转逻辑，支持状态转换校验和执行。
    
    状态转换规则：
    - PENDING → IN_PROGRESS: 审批开始
    - IN_PROGRESS → APPROVED: 审批通过
    - IN_PROGRESS → REJECTED: 审批拒绝
    - APPROVED/REJECTED → CLOSED: 工单关闭
    
    使用示例：
        sm = WorkOrderStateMachine()
        if sm.can_transition(current_state, target_state):
            sm.transition(work_order, target_state)
    """
    
    # 允许的状态转换映射
    TRANSITIONS = {
        WorkOrderState.PENDING: [WorkOrderState.IN_PROGRESS],
        WorkOrderState.IN_PROGRESS: [WorkOrderState.APPROVED, WorkOrderState.REJECTED],
        WorkOrderState.APPROVED: [WorkOrderState.CLOSED],
        WorkOrderState.REJECTED: [WorkOrderState.CLOSED],
        WorkOrderState.CLOSED: [],  # 终态，不可转换
    }
    
    def can_transition(self, from_state: WorkOrderState, to_state: WorkOrderState) -> bool:
        """检查是否允许状态转换
        
        Args:
            from_state: 当前状态
            to_state: 目标状态
            
        Returns:
            bool: 是否允许转换
            
        示例：
            >>> sm.can_transition(WorkOrderState.PENDING, WorkOrderState.IN_PROGRESS)
            True
            >>> sm.can_transition(WorkOrderState.APPROVED, WorkOrderState.PENDING)
            False
        """
        if from_state not in self.TRANSITIONS:
            return False
        return to_state in self.TRANSITIONS[from_state]
    
    def transition(self, work_order: "WorkOrder", to_state: WorkOrderState) -> None:
        """执行状态转换
        
        Args:
            work_order: 工单实体（需要 id, state, version 属性）
            to_state: 目标状态
            
        Raises:
            ValueError: 不允许的状态转换
            HTTPException: 409 - 乐观锁冲突
        """
        from_state = work_order.state
        
        if not self.can_transition(from_state, to_state):
            raise ValueError(
                f"不允许的状态转换: {from_state.value} → {to_state.value}"
            )
        
        # 更新状态
        work_order.state = to_state
        work_order.version += 1
        work_order.updated_at = datetime.utcnow()
    
    def get_allowed_transitions(self, from_state: WorkOrderState) -> List[WorkOrderState]:
        """获取指定状态允许的转换目标
        
        Args:
            from_state: 当前状态
            
        Returns:
            List[WorkOrderState]: 允许的目标状态列表
        """
        return self.TRANSITIONS.get(from_state, [])


# ============================================================================
# 事件发布
# ============================================================================

class WorkOrderEventPublisher:
    """工单事件发布器
    
    负责发布工单领域事件，供通知模块订阅。
    
    事件类型：
    - WorkOrderApprovedEvent: 审批通过事件
    - WorkOrderRejectedEvent: 审批拒绝事件
    
    注意：通知投递为异步操作，失败不影响审批主流程。
    """
    
    def __init__(self):
        self._subscribers = []
    
    def subscribe(self, handler):
        """订阅事件
        
        Args:
            handler: 事件处理函数，接受 event 参数
        """
        self._subscribers.append(handler)
    
    def publish_approved(self, work_order_id: str, operator: str, reason: Optional[str] = None) -> None:
        """发布审批通过事件
        
        Args:
            work_order_id: 工单 ID
            operator: 操作人
            reason: 审批意见
        """
        event = {
            "type": "WorkOrderApproved",
            "work_order_id": work_order_id,
            "operator": operator,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._notify(event)
    
    def publish_rejected(self, work_order_id: str, operator: str, reason: str) -> None:
        """发布审批拒绝事件
        
        Args:
            work_order_id: 工单 ID
            operator: 操作人
            reason: 拒绝原因
        """
        event = {
            "type": "WorkOrderRejected",
            "work_order_id": work_order_id,
            "operator": operator,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._notify(event)
    
    def _notify(self, event: dict) -> None:
        """通知所有订阅者
        
        Args:
            event: 事件数据
            
        Note:
            通知失败不抛出异常，保证审批主流程不受影响
        """
        for subscriber in self._subscribers:
            try:
                subscriber(event)
            except Exception:
                # 静默处理通知失败，不阻塞主流程
                pass


# ============================================================================
# 领域服务
# ============================================================================

class ApprovalService:
    """工单审批服务
    
    封装工单审批业务逻辑，包括状态变更、版本校验、事件发布。
    
    使用示例：
        service = ApprovalService(db_session, event_publisher)
        result = service.approve(work_order_id, operator, request)
    """
    
    def __init__(self, db_session: Session, event_publisher: WorkOrderEventPublisher):
        self._db = db_session
        self._event_publisher = event_publisher
        self._state_machine = WorkOrderStateMachine()
    
    def approve(self, work_order_id: str, operator: str, request: ApproveRequest) -> ApproveResponse:
        """审批通过
        
        Args:
            work_order_id: 工单 ID
            operator: 操作人
            request: 审批请求
            
        Returns:
            ApproveResponse: 审批结果
            
        Raises:
            HTTPException: 
                - 404: 工单不存在
                - 409: 乐观锁冲突
                - 422: 状态不允许操作
        """
        # 查询工单
        work_order = self._get_work_order(work_order_id)
        
        # 版本校验（乐观锁）
        if work_order.version != request.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"版本冲突，当前版本: {work_order.version}，请求版本: {request.version}"
            )
        
        # 状态转换：PENDING → IN_PROGRESS → APPROVED
        try:
            # 先转换到审批中
            if work_order.state == WorkOrderState.PENDING:
                self._state_machine.transition(work_order, WorkOrderState.IN_PROGRESS)
            # 再转换到已通过
            self._state_machine.transition(work_order, WorkOrderState.APPROVED)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
        
        # 记录审批历史
        self._record_history(
            work_order_id=work_order_id,
            operator=operator,
            action=OperationType.APPROVE,
            reason=request.reason
        )
        
        # 提交事务
        self._db.commit()
        
        # 发布事件（异步通知）
        self._event_publisher.publish_approved(work_order_id, operator, request.reason)
        
        return ApproveResponse(
            id=work_order_id,
            state=work_order.state,
            version=work_order.version,
            updated_at=work_order.updated_at
        )
    
    def reject(self, work_order_id: str, operator: str, request: RejectRequest) -> RejectResponse:
        """审批拒绝
        
        Args:
            work_order_id: 工单 ID
            operator: 操作人
            request: 拒绝请求
            
        Returns:
            RejectResponse: 拒绝结果
            
        Raises:
            HTTPException:
                - 404: 工单不存在
                - 409: 乐观锁冲突
                - 422: 状态不允许操作
        """
        # 查询工单
        work_order = self._get_work_order(work_order_id)
        
        # 版本校验（乐观锁）
        if work_order.version != request.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"版本冲突，当前版本: {work_order.version}，请求版本: {request.version}"
            )
        
        # 状态转换：PENDING → IN_PROGRESS → REJECTED
        try:
            if work_order.state == WorkOrderState.PENDING:
                self._state_machine.transition(work_order, WorkOrderState.IN_PROGRESS)
            self._state_machine.transition(work_order, WorkOrderState.REJECTED)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
        
        # 记录审批历史
        self._record_history(
            work_order_id=work_order_id,
            operator=operator,
            action=OperationType.REJECT,
            reason=request.reason
        )
        
        # 提交事务
        self._db.commit()
        
        # 发布事件（异步通知）
        self._event_publisher.publish_rejected(work_order_id, operator, request.reason)
        
        return RejectResponse(
            id=work_order_id,
            state=work_order.state,
            version=work_order.version,
            updated_at=work_order.updated_at
        )
    
    def _get_work_order(self, work_order_id: str) -> "WorkOrder":
        """获取工单
        
        Args:
            work_order_id: 工单 ID
            
        Returns:
            WorkOrder: 工单实体
            
        Raises:
            HTTPException: 404 - 工单不存在
        """
        # 模拟从数据库获取工单
        # 实际实现应查询数据库
        class MockWorkOrder:
            def __init__(self):
                self.id = work_order_id
                self.title = f"工单-{work_order_id}"
                self.content = "工单内容"
                self.creator = "user001"
                self.state = WorkOrderState.PENDING
                self.version = 1
                self.created_at = datetime.utcnow()
                self.updated_at = datetime.utcnow()
        
        return MockWorkOrder()
    
    def _record_history(
        self,
        work_order_id: str,
        operator: str,
        action: OperationType,
        reason: Optional[str] = None
    ) -> None:
        """记录审批历史
        
        Args:
            work_order_id: 工单 ID
            operator: 操作人
            action: 操作类型
            reason: 审批意见
        """
        # 模拟记录审批历史
        # 实际实现应写入 approval_history 表
        pass


# ============================================================================
# 依赖注入
# ============================================================================

# 模拟数据库会话获取函数
def get_db_session() -> Session:
    """获取数据库会话
    
    Returns:
        Session: 数据库会话
        
    Note:
        实际实现应使用 FastAPI 的 Depends 注入
    """
    pass


# 模拟当前用户获取函数
def get_current_user() -> dict:
    """获取当前用户
    
    Returns:
        dict: 当前用户信息，包含 id, roles 等
        
    Note:
        实际实现应从认证上下文获取
    """
    return {"id": "user001", "roles": ["approval_role"]}


# 模拟事件发布器单例
_event_publisher = WorkOrderEventPublisher()


# ============================================================================
# API 路由定义
# ============================================================================

router = APIRouter(
    prefix="/api/v1/work-orders",
    tags=["work-orders"],
    responses={
        404: {"model": ErrorResponse, "description": "工单不存在"},
        409: {"model": ErrorResponse, "description": "版本冲突"},
        422: {"model": ErrorResponse, "description": "状态不允许操作"},
        403: {"model": ErrorResponse, "description": "无权限"},
    }
)


@router.post(
    "/{work_order_id}/approve",
    response_model=ApproveResponse,
    summary="审批通过",
    description="对指定工单执行审批通过操作",
    responses={
        200: {"description": "审批成功"},
        403: {"description": "无审批权限"},
        404: {"description": "工单不存在"},
        409: {"description": "乐观锁冲突"},
        422: {"description": "状态不允许操作"},
    }
)
async def approve_work_order(
    work_order_id: str,
    request: ApproveRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db_session)
) -> ApproveResponse:
    """审批通过 API
    
    将工单从待审批/审批中状态转换为已通过状态。
    需要工单归属部门的审批角色权限。
    
    请求体：
        - reason: 审批意见（非必填，最大 500 字符）
        - version: 当前版本号（乐观锁冲突检测）
    
    响应：
        - id: 工单 ID
        - state: APPROVED
        - version: 新版本号
        - updated_at: 更新时间
    
    示例请求：
        POST /api/v1/work-orders/WO-001/approve
        {
            "reason": "同意申请",
            "version": 1
        }
    
    示例响应：
        {
            "id": "WO-001",
            "state": "APPROVED",
            "version": 2,
            "updated_at": "2025-01-15T10:30:00Z"
        }
    """
    # 权限校验
    if "approval_role" not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无审批权限"
        )
    
    # 调用审批服务
    service = ApprovalService(db, _event_publisher)
    return service.approve(work_order_id, current_user["id"], request)


@router.post(
    "/{work_order_id}/reject",
    response_model=RejectResponse,
    summary="审批拒绝",
    description="对指定工单执行审批拒绝操作",
    responses={
        200: {"description": "拒绝成功"},
        403: {"description": "无审批权限"},
        404: {"description": "工单不存在"},
        409: {"description": "乐观锁冲突"},
        422: {"description": "状态不允许操作"},
    }
)
async def reject_work_order(
    work_order_id: str,
    request: RejectRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db_session)
) -> RejectResponse:
    """审批拒绝 API
    
    将工单从待审批/审批中状态转换为已拒绝状态。
    需要工单归属部门的审批角色权限。
    
    请求体：
        - reason: 拒绝原因（必填，最大 500 字符）
        - version: 当前版本号（乐观锁冲突检测）
    
    响应：
        - id: 工单 ID
        - state: REJECTED
        - version: 新版本号
        - updated_at: 更新时间
    
    示例请求：
        POST /api/v1/work-orders/WO-001/reject
        {
            "reason": "材料不完整",
            "version": 1
        }
    
    示例响应：
        {
            "id": "WO-001",
            "state": "REJECTED",
            "version": 2,
            "updated_at": "2025-01-15T10:30:00Z"
        }
    """
    # 权限校验
    if "approval_role" not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无审批权限"
        )
    
    # 调用审批服务
    service = ApprovalService(db, _event_publisher)
    return service.reject(work_order_id, current_user["id"], request)


@router.get(
    "/pending",
    response_model=WorkOrderListResponse,
    summary="待审批列表",
    description="获取当前用户待审批的工单列表",
    responses={
        200: {"description": "获取成功"},
    }
)
async def list_pending_work_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db_session)
) -> WorkOrderListResponse:
    """待审批工单列表 API
    
    获取当前用户需要审批的工单列表，支持分页。
    返回的工单状态为 PENDING 或 IN_PROGRESS。
    
    查询参数：
        - page: 页码（默认 1）
        - page_size: 每页数量（默认 20，最大 100）
    
    响应：
        - items: 工单列表
        - total: 总数
        - page: 当前页
        - page_size: 每页数量
    
    示例响应：
        {
            "items": [
                {
                    "id": "WO-001",
                    "title": "采购申请",
                    "creator": "user001",
                    "created_at": "2025-01-10T08:00:00Z",
                    "state": "PENDING"
                }
            ],
            "total": 1,
            "page": 1,
            "page_size": 20
        }
    """
    # 模拟返回待审批工单列表
    # 实际实现应查询数据库
    mock_items = [
        WorkOrderListItem(
            id=f"WO-{str(i).zfill(3)}",
            title=f"工单-{i}",
            creator="user001",
            created_at=datetime.utcnow(),
            state=WorkOrderState.PENDING
        )
        for i in range(1, min(page_size + 1, 5))
    ]
    
    return WorkOrderListResponse(
        items=mock_items,
        total=len(mock_items),
        page=page,
        page_size=page_size
    )


@router.get(
    "/{work_order_id}",
    response_model=WorkOrderDetail,
    summary="工单详情",
    description="获取指定工单的完整信息",
    responses={
        200: {"description": "获取成功"},
        404: {"description": "工单不存在"},
    }
)
async def get_work_order_detail(
    work_order_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db_session)
) -> WorkOrderDetail:
    """工单详情 API
    
    获取指定工单的完整信息，包括：
    - 基本信息（标题、内容、创建人等）
    - 当前状态和版本号
    - 审批历史记录
    
    路径参数：
        - work_order_id: 工单 ID
    
    响应：
        - id: 工单 ID
        - title: 工单标题
        - content: 工单内容
        - creator: 创建人
        - created_at: 创建时间
        - updated_at: 更新时间
        - state: 当前状态
        - version: 版本号
        - history: 审批历史列表
    
    示例响应：
        {
            "id": "WO-001",
            "title": "采购申请",
            "content": "需要采购办公设备...",
            "creator": "user001",
            "created_at": "2025-01-10T08:00:00Z",
            "updated_at": "2025-01-15T10:30:00Z",
            "state": "APPROVED",
            "version": 2,
            "history": [
                {
                    "id": 1,
                    "operator": "user002",
                    "action": "APPROVE",
                    "reason": "同意",
                    "created_at": "2025-01-15T10:30:00Z"
                }
            ]
        }
    """
    # 模拟返回工单详情
    # 实际实现应查询数据库
    mock_history = [
        ApprovalHistoryItem(
            id=1,
            operator="user002",
            action=OperationType.APPROVE,
            reason="同意申请",
            created_at=datetime.utcnow()
        )
    ]
    
    return WorkOrderDetail(
        id=work_order_id,
        title=f"工单-{work_order_id}",
        content="工单详细内容...",
        creator="user001",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        state=WorkOrderState.PENDING,
        version=1,
        history=mock_history
    )


# ============================================================================
# 辅助函数
# ============================================================================

def validate_approval_permission(user: dict, work_order: dict) -> bool:
    """校验审批权限
    
    Args:
        user: 当前用户信息
        work_order: 工单信息
    
    Returns:
        bool: 是否有权限
    
    Note:
        仅工单归属部门的审批角色可执行审批操作
    """
    if "approval_role" not in user.get("roles", []):
        return False
    
    # 实际实现应检查用户部门与工单归属部门是否匹配
    return True


def get_allowed_states(current_state: WorkOrderState) -> List[WorkOrderState]:
    """获取指定状态允许的转换目标
    
    Args:
        current_state: 当前状态
    
    Returns:
        List[WorkOrderState]: 允许的目标状态列表
    """
    sm = WorkOrderStateMachine()
    return sm.get_allowed_transitions(current_state)


# ============================================================================
# 导出
# ============================================================================

__all__ = [
    "router",
    "WorkOrderState",
    "OperationType",
    "WorkOrderStateMachine",
    "WorkOrderEventPublisher",
    "ApprovalService",
    "ApproveRequest",
    "RejectRequest",
    "WorkOrderListItem",
    "WorkOrderDetail",
    "ApproveResponse",
    "RejectResponse",
    "WorkOrderListResponse",
    "ErrorResponse",
    "ApprovalHistoryItem",
]