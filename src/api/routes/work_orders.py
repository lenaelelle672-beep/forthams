"""
Work Order API Routes

This module provides REST API endpoints for work order management,
including submission, approval, rejection, and transfer operations.

Endpoints:
- GET /api/v1/workorders - List work orders
- POST /api/v1/workorders - Create work order
- GET /api/v1/workorders/{id} - Get work order details
- POST /api/v1/workorders/{id}/approve - Approve work order
- POST /api/v1/workorders/{id}/reject - Reject work order
- POST /api/v1/workorders/{id}/transfer - Transfer work order
- GET /api/v1/workorders/{id}/history - Get approval history

State Machine:
    States: [PENDING, APPROVED, REJECTED, TRANSFERRED, CLOSED]
    Transitions:
    - PENDING → APPROVED (approve)
    - PENDING → REJECTED (reject)
    - PENDING → TRANSFERRED (transfer)
    - TRANSFERRED → APPROVED (approve)
    - TRANSFERRED → REJECTED (reject)
    - APPROVED → CLOSED (close)
    - REJECTED → CLOSED (close)
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field, field_validator

from src.models.workorder import WorkOrder, WorkOrderStatus
from src.models.ticket_event import TicketEvent, TicketEventType
from src.services.notification_service import NotificationService
from src.state_machine.states import WorkOrderState
from src.state_machine.transitions import TransitionError

router = APIRouter(prefix="/api/v1/workorders", tags=["workorders"])

# =============================================================================
# Pydantic Schemas
# =============================================================================

class WorkOrderResponse(BaseModel):
    """Response schema for work order operations."""
    workorder_id: str
    status: str
    updated_at: datetime
    operator: Optional[str] = None


class ApproveRequest(BaseModel):
    """Request schema for work order approval."""
    comment: Optional[str] = Field(None, max_length=500)


class RejectRequest(BaseModel):
    """Request schema for work order rejection."""
    comment: str = Field(..., min_length=10, max_length=500)

    @field_validator('comment')
    @classmethod
    def validate_comment(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('审批意见不能为空')
        if len(v.strip()) < 10:
            raise ValueError('审批意见至少需要10个字')
        return v


class TransferRequest(BaseModel):
    """Request schema for work order transfer."""
    target_user_id: str = Field(..., description="目标审批人用户ID")
    comment: str = Field(..., min_length=10, max_length=500)

    @field_validator('comment')
    @classmethod
    def validate_comment(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('转交意见不能为空')
        if len(v.strip()) < 10:
            raise ValueError('转交意见至少需要10个字')
        return v


class ApprovalHistoryResponse(BaseModel):
    """Response schema for approval history."""
    workorder_id: str
    history: List[dict]


class SuccessResponse(BaseModel):
    """Standard success response schema."""
    code: int = 0
    message: str = "success"
    data: Optional[dict] = None


# =============================================================================
# Error Codes
# =============================================================================

class ErrorCodes:
    """Error codes for work order operations."""
    INVALID_TRANSITION = "INVALID_TRANSITION"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    VALIDATION_ERROR = "VALIDATION_ERROR"


# =============================================================================
# Service Dependencies
# =============================================================================

def get_notification_service() -> NotificationService:
    """
    Get notification service instance.
    
    Returns:
        NotificationService: The notification service singleton.
    """
    return NotificationService.get_instance()


# =============================================================================
# Helper Functions
# =============================================================================

def _check_transfer_limit(work_order: WorkOrder) -> None:
    """
    Check if transfer limit has been reached.
    
    Args:
        work_order: The work order to check.
        
    Raises:
        HTTPException: If transfer limit exceeded.
    """
    max_transfers = 3
    transfer_count = getattr(work_order, 'transfer_count', 0)
    if transfer_count >= max_transfers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCodes.VALIDATION_ERROR,
                "message": f"工单转交次数已达上限({max_transfers}次)"
            }
        )


def _validate_state_transition(work_order: WorkOrder, action: str) -> None:
    """
    Validate if state transition is allowed.
    
    Args:
        work_order: The work order to validate.
        action: The action to perform.
        
    Raises:
        HTTPException: If transition is not allowed.
    """
    valid_actions = {
        WorkOrderStatus.PENDING: ['approve', 'reject', 'transfer'],
        WorkOrderStatus.TRANSFERRED: ['approve', 'reject'],
        WorkOrderStatus.APPROVED: ['close'],
        WorkOrderStatus.REJECTED: ['close'],
    }
    
    current_status = work_order.status.value if hasattr(work_order.status, 'value') else str(work_order.status)
    allowed_actions = valid_actions.get(WorkOrderStatus(current_status), [])
    
    if action not in allowed_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCodes.INVALID_TRANSITION,
                "message": f"当前状态({current_status})不允许执行{action}操作"
            }
        )


def _send_notification_async(notification_service: NotificationService, event_type: str, data: dict) -> None:
    """
    Send notification asynchronously.
    
    Args:
        notification_service: The notification service instance.
        event_type: Type of notification event.
        data: Notification data payload.
    """
    try:
        notification_service.send_async(event_type, data)
    except Exception:
        # Notification failures should not block main flow
        pass


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/{workorder_id}/approve", response_model=SuccessResponse)
async def approve_work_order(
    workorder_id: str,
    request: ApproveRequest,
    notification_service: NotificationService = Depends(get_notification_service)
) -> SuccessResponse:
    """
    Approve a work order.
    
    Transitions work order from PENDING or TRANSFERRED to APPROVED.
    
    Args:
        workorder_id: The ID of the work order to approve.
        request: The approval request containing optional comment.
        notification_service: Injected notification service.
        
    Returns:
        SuccessResponse with updated work order status.
        
    Raises:
        HTTPException: If work order not found, not in approvable state,
                      or concurrent modification detected.
    """
    # Fetch work order
    work_order = _get_work_order_or_404(workorder_id)
    
    # Validate state transition
    _validate_state_transition(work_order, 'approve')
    
    # Check version for optimistic locking
    expected_version = work_order.version if hasattr(work_order, 'version') else None
    
    try:
        # Update work order status
        work_order.status = WorkOrderStatus.APPROVED
        work_order.approved_at = datetime.utcnow()
        work_order.approved_by = _get_current_user_id()
        
        if hasattr(work_order, 'version') and expected_version is not None:
            work_order.version = expected_version + 1
            
        work_order.save()
        
        # Record approval history
        _record_approval_history(workorder_id, 'approve', request.comment)
        
        # Send async notification
        _send_notification_async(
            notification_service,
            "work_order_approved",
            {
                "workorder_id": workorder_id,
                "applicant": work_order.applicant_id,
                "approved_by": _get_current_user_id()
            }
        )
        
    except Exception as e:
        if "version" in str(e).lower() or "conflict" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": ErrorCodes.CONFLICT,
                    "message": "并发冲突，请重试"
                }
            )
        raise
    
    return SuccessResponse(
        data={
            "workorder_id": workorder_id,
            "status": "APPROVED",
            "updated_at": work_order.updated_at.isoformat() if hasattr(work_order, 'updated_at') else datetime.utcnow().isoformat(),
            "operator": _get_current_user_id()
        }
    )


@router.post("/{workorder_id}/reject", response_model=SuccessResponse)
async def reject_work_order(
    workorder_id: str,
    request: RejectRequest,
    notification_service: NotificationService = Depends(get_notification_service)
) -> SuccessResponse:
    """
    Reject a work order.
    
    Transitions work order from PENDING or TRANSFERRED to REJECTED.
    Requires comment with minimum 10 characters.
    
    Args:
        workorder_id: The ID of the work order to reject.
        request: The rejection request containing required comment.
        notification_service: Injected notification service.
        
    Returns:
        SuccessResponse with updated work order status.
        
    Raises:
        HTTPException: If work order not found, not in rejectable state,
                      comment validation fails, or concurrent modification detected.
    """
    # Fetch work order
    work_order = _get_work_order_or_404(workorder_id)
    
    # Validate state transition
    _validate_state_transition(work_order, 'reject')
    
    # Check version for optimistic locking
    expected_version = work_order.version if hasattr(work_order, 'version') else None
    
    try:
        # Update work order status
        work_order.status = WorkOrderStatus.REJECTED
        work_order.rejected_at = datetime.utcnow()
        work_order.rejected_by = _get_current_user_id()
        work_order.rejection_reason = request.comment
        
        if hasattr(work_order, 'version') and expected_version is not None:
            work_order.version = expected_version + 1
            
        work_order.save()
        
        # Record rejection history
        _record_approval_history(workorder_id, 'reject', request.comment)
        
        # Send async notification with email
        _send_notification_async(
            notification_service,
            "work_order_rejected",
            {
                "workorder_id": workorder_id,
                "applicant": work_order.applicant_id,
                "rejected_by": _get_current_user_id(),
                "reason": request.comment,
                "channels": ["inbox", "email"]
            }
        )
        
    except Exception as e:
        if "version" in str(e).lower() or "conflict" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": ErrorCodes.CONFLICT,
                    "message": "并发冲突，请重试"
                }
            )
        raise
    
    return SuccessResponse(
        data={
            "workorder_id": workorder_id,
            "status": "REJECTED",
            "updated_at": work_order.updated_at.isoformat() if hasattr(work_order, 'updated_at') else datetime.utcnow().isoformat(),
            "operator": _get_current_user_id()
        }
    )


@router.post("/{workorder_id}/transfer", response_model=SuccessResponse)
async def transfer_work_order(
    workorder_id: str,
    request: TransferRequest,
    notification_service: NotificationService = Depends(get_notification_service)
) -> SuccessResponse:
    """
    Transfer a work order to another approver.
    
    Transitions work order from PENDING to TRANSFERRED.
    Requires comment with minimum 10 characters.
    Transfer limit: maximum 3 times per work order.
    
    Args:
        workorder_id: The ID of the work order to transfer.
        request: The transfer request containing target user and comment.
        notification_service: Injected notification service.
        
    Returns:
        SuccessResponse with updated work order status.
        
    Raises:
        HTTPException: If work order not found, not in transferable state,
                      transfer limit exceeded, comment validation fails,
                      or concurrent modification detected.
    """
    # Fetch work order
    work_order = _get_work_order_or_404(workorder_id)
    
    # Validate state transition
    _validate_state_transition(work_order, 'transfer')
    
    # Check transfer limit
    _check_transfer_limit(work_order)
    
    # Check version for optimistic locking
    expected_version = work_order.version if hasattr(work_order, 'version') else None
    
    try:
        # Update work order status
        work_order.status = WorkOrderStatus.TRANSFERRED
        work_order.current_approver_id = request.target_user_id
        work_order.transfer_reason = request.comment
        work_order.transfer_count = getattr(work_order, 'transfer_count', 0) + 1
        
        if hasattr(work_order, 'version') and expected_version is not None:
            work_order.version = expected_version + 1
            
        work_order.save()
        
        # Record transfer history
        _record_approval_history(workorder_id, 'transfer', request.comment, request.target_user_id)
        
        # Send async notification to new approver
        _send_notification_async(
            notification_service,
            "work_order_transferred",
            {
                "workorder_id": workorder_id,
                "new_approver": request.target_user_id,
                "previous_approver": _get_current_user_id(),
                "comment": request.comment
            }
        )
        
    except Exception as e:
        if "version" in str(e).lower() or "conflict" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": ErrorCodes.CONFLICT,
                    "message": "并发冲突，请重试"
                }
            )
        raise
    
    return SuccessResponse(
        data={
            "workorder_id": workorder_id,
            "status": "TRANSFERRED",
            "new_approver": request.target_user_id,
            "updated_at": work_order.updated_at.isoformat() if hasattr(work_order, 'updated_at') else datetime.utcnow().isoformat()
        }
    )


@router.get("/{workorder_id}/history", response_model=ApprovalHistoryResponse)
async def get_approval_history(workorder_id: str) -> ApprovalHistoryResponse:
    """
    Get approval history for a work order.
    
    Returns complete history of all approval operations.
    
    Args:
        workorder_id: The ID of the work order.
        
    Returns:
        ApprovalHistoryResponse containing work order ID and history list.
        
    Raises:
        HTTPException: If work order not found.
    """
    # Verify work order exists
    _get_work_order_or_404(workorder_id)
    
    # Fetch approval history
    history = _fetch_approval_history(workorder_id)
    
    return ApprovalHistoryResponse(
        workorder_id=workorder_id,
        history=history
    )


# =============================================================================
# Helper Functions for Database Operations
# =============================================================================

def _get_work_order_or_404(workorder_id: str) -> WorkOrder:
    """
    Fetch work order by ID or raise 404.
    
    Args:
        workorder_id: The ID of the work order.
        
    Returns:
        WorkOrder: The found work order.
        
    Raises:
        HTTPException: If work order not found.
    """
    work_order = WorkOrder.get_by_id(workorder_id)
    if not work_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ErrorCodes.NOT_FOUND,
                "message": f"工单{workorder_id}不存在"
            }
        )
    return work_order


def _record_approval_history(
    workorder_id: str,
    action: str,
    comment: Optional[str] = None,
    target_user_id: Optional[str] = None
) -> None:
    """
    Record approval action in history.
    
    Args:
        workorder_id: The ID of the work order.
        action: The approval action performed.
        comment: Optional comment for the action.
        target_user_id: Optional target user for transfer action.
    """
    event_type_map = {
        'approve': TicketEventType.APPROVE,
        'reject': TicketEventType.REJECT,
        'transfer': TicketEventType.TRANSFER,
    }
    
    event = TicketEvent(
        workorder_id=workorder_id,
        event_type=event_type_map.get(action, TicketEventType.APPROVE),
        operator=_get_current_user_id(),
        comment=comment,
        target_user_id=target_user_id,
        created_at=datetime.utcnow()
    )
    
    try:
        event.save()
    except Exception:
        # History recording failures should not block main flow
        pass


def _fetch_approval_history(workorder_id: str) -> List[dict]:
    """
    Fetch approval history from database.
    
    Args:
        workorder_id: The ID of the work order.
        
    Returns:
        List of approval history records as dictionaries.
    """
    events = TicketEvent.get_by_workorder_id(workorder_id)
    return [
        {
            "event_type": e.event_type.value if hasattr(e.event_type, 'value') else str(e.event_type),
            "operator": e.operator,
            "comment": e.comment,
            "target_user_id": e.target_user_id,
            "created_at": e.created_at.isoformat() if hasattr(e, 'created_at') else None
        }
        for e in events
    ]


def _get_current_user_id() -> str:
    """
    Get current authenticated user ID.
    
    Returns:
        str: The current user ID, or 'system' if not authenticated.
    """
    # This would typically come from authentication context
    # For now, return a placeholder that would be replaced by actual auth
    try:
        from src.api.deps.auth import get_current_user
        user = get_current_user()
        return user.get('user_id', 'system') if isinstance(user, dict) else str(user)
    except Exception:
        return 'system'


# =============================================================================
# Export router for application
# =============================================================================

__all__ = ["router", "WorkOrderResponse", "ApproveRequest", "RejectRequest", "TransferRequest"]