"""
Approval Service Module

Provides work order approval and rejection functionality with state machine
integration and notification triggering.

Task: SWARM-2025-Q2-P0-003
Iteration: 2
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.models.workorder import WorkOrder, WorkOrderStatus
from src.models.approval_record import ApprovalRecord
from src.domain.exceptions.workorder_exceptions import (
    InvalidStateTransitionError,
    UnauthorizedApprovalError,
    WorkOrderNotFoundError,
)
from src.domain.services.state_machine_engine import StateMachineEngine
from src.domain.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class ApprovalService:
    """
    Service for handling work order approval and rejection operations.
    
    This service manages the approval workflow including:
    - Approve/reject operations with state machine validation
    - Optimistic locking for concurrent access control
    - Notification triggering on approval actions
    - Audit logging for all approval actions
    """
    
    def __init__(self, db: Session):
        """
        Initialize the ApprovalService.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.state_machine = StateMachineEngine()
        self.notification_service = NotificationService()
    
    def approve_work_order(
        self,
        work_order_id: int,
        approver_id: str,
        version: int,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Approve a work order and advance its state.
        
        Args:
            work_order_id: ID of the work order to approve
            approver_id: ID of the user performing the approval
            version: Version for optimistic locking
            comment: Optional approval comment
            
        Returns:
            Dict containing the updated work order data
            
        Raises:
            WorkOrderNotFoundError: If work order does not exist
            InvalidStateTransitionError: If work order is not in approvable state
            UnauthorizedApprovalError: If user lacks approval permission
        """
        work_order = self._get_work_order(work_order_id)
        
        # Validate state transition
        if not work_order.can_be_approved():
            raise InvalidStateTransitionError(
                f"Work order {work_order_id} cannot be approved from state {work_order.status}"
            )
        
        # Validate approver permissions
        self._validate_approver_permission(work_order, approver_id)
        
        # Check optimistic lock version
        if work_order.version != version:
            raise InvalidStateTransitionError(
                f"Version conflict: expected {version}, got {work_order.version}"
            )
        
        try:
            # Update work order state
            work_order.status = WorkOrderStatus.APPROVED
            work_order.approved_by = approver_id
            work_order.approved_at = datetime.utcnow()
            work_order.version += 1
            
            # Create approval record for audit
            approval_record = ApprovalRecord(
                work_order_id=work_order_id,
                action="APPROVE",
                performed_by=approver_id,
                comment=comment,
                previous_status=WorkOrderStatus.PENDING_APPROVAL,
                new_status=WorkOrderStatus.APPROVED,
                created_at=datetime.utcnow()
            )
            self.db.add(approval_record)
            
            self.db.commit()
            self.db.refresh(work_order)
            
            # Trigger notification
            self.notification_service.send_approval_result(
                work_order_id=work_order_id,
                result="approved",
                recipient_id=work_order.created_by
            )
            
            logger.info(
                f"Work order {work_order_id} approved by {approver_id}"
            )
            
            return self._serialize_work_order(work_order)
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error during approval: {e}")
            raise
    
    def reject_work_order(
        self,
        work_order_id: int,
        approver_id: str,
        version: int,
        reason: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reject a work order with a mandatory reason.
        
        Args:
            work_order_id: ID of the work order to reject
            approver_id: ID of the user performing the rejection
            version: Version for optimistic locking
            reason: Mandatory rejection reason (min 10 characters)
            comment: Optional additional comment
            
        Returns:
            Dict containing the updated work order data
            
        Raises:
            WorkOrderNotFoundError: If work order does not exist
            InvalidStateTransitionError: If work order is not in rejectable state
            UnauthorizedApprovalError: If user lacks approval permission
            ValueError: If reason is too short
        """
        # Validate reason length
        if len(reason) < 10:
            raise ValueError("Rejection reason must be at least 10 characters")
        
        work_order = self._get_work_order(work_order_id)
        
        # Validate state transition
        if not work_order.can_be_rejected():
            raise InvalidStateTransitionError(
                f"Work order {work_order_id} cannot be rejected from state {work_order.status}"
            )
        
        # Validate approver permissions
        self._validate_approver_permission(work_order, approver_id)
        
        # Check optimistic lock version
        if work_order.version != version:
            raise InvalidStateTransitionError(
                f"Version conflict: expected {version}, got {work_order.version}"
            )
        
        try:
            # Update work order state
            work_order.status = WorkOrderStatus.REJECTED
            work_order.rejected_by = approver_id
            work_order.rejected_at = datetime.utcnow()
            work_order.reject_reason = reason
            work_order.version += 1
            
            # Create approval record for audit
            approval_record = ApprovalRecord(
                work_order_id=work_order_id,
                action="REJECT",
                performed_by=approver_id,
                comment=comment,
                reason=reason,
                previous_status=WorkOrderStatus.PENDING_APPROVAL,
                new_status=WorkOrderStatus.REJECTED,
                created_at=datetime.utcnow()
            )
            self.db.add(approval_record)
            
            self.db.commit()
            self.db.refresh(work_order)
            
            # Trigger notification
            self.notification_service.send_approval_result(
                work_order_id=work_order_id,
                result="rejected",
                recipient_id=work_order.created_by,
                reason=reason
            )
            
            logger.info(
                f"Work order {work_order_id} rejected by {approver_id}: {reason}"
            )
            
            return self._serialize_work_order(work_order)
            
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error during rejection: {e}")
            raise
    
    def _get_work_order(self, work_order_id: int) -> WorkOrder:
        """
        Retrieve a work order by ID.
        
        Args:
            work_order_id: ID of the work order
            
        Returns:
            WorkOrder instance
            
        Raises:
            WorkOrderNotFoundError: If work order does not exist
        """
        work_order = self.db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id
        ).first()
        
        if not work_order:
            raise WorkOrderNotFoundError(
                f"Work order {work_order_id} not found"
            )
        
        return work_order
    
    def _validate_approver_permission(
        self,
        work_order: WorkOrder,
        approver_id: str
    ) -> None:
        """
        Validate that the approver has permission to approve/reject.
        
        Args:
            work_order: WorkOrder instance
            approver_id: ID of the approver
            
        Raises:
            UnauthorizedApprovalError: If approver lacks permission
        """
        # Approver cannot approve their own work order
        if work_order.created_by == approver_id:
            raise UnauthorizedApprovalError(
                "Work order creator cannot approve their own work order"
            )
        
        # Approver must be the current approver
        if work_order.current_approver_id != approver_id:
            raise UnauthorizedApprovalError(
                f"User {approver_id} is not the designated approver"
            )
    
    def _serialize_work_order(self, work_order: WorkOrder) -> Dict[str, Any]:
        """
        Serialize a work order to a dictionary.
        
        Args:
            work_order: WorkOrder instance
            
        Returns:
            Dictionary representation of the work order
        """
        return {
            "id": work_order.id,
            "title": work_order.title,
            "status": work_order.status.value,
            "version": work_order.version,
            "created_by": work_order.created_by,
            "current_approver_id": work_order.current_approver_id,
            "approved_by": work_order.approved_by,
            "approved_at": work_order.approved_at.isoformat() if work_order.approved_at else None,
            "rejected_by": work_order.rejected_by,
            "rejected_at": work_order.rejected_at.isoformat() if work_order.rejected_at else None,
            "reject_reason": work_order.reject_reason,
            "created_at": work_order.created_at.isoformat() if work_order.created_at else None,
            "updated_at": work_order.updated_at.isoformat() if work_order.updated_at else None,
        }


def is_within_idempotency_window(last_timestamp: int, window_ms: int = 5000) -> bool:
    """
    Check if a timestamp is within the idempotency window.
    
    This function helps prevent duplicate approval operations by checking
    if the last operation was performed within the specified time window.
    
    Args:
        last_timestamp: Timestamp of the last operation (milliseconds)
        window_ms: Window duration in milliseconds (default: 5000)
        
    Returns:
        True if within the idempotency window, False otherwise
    """
    if not last_timestamp:
        return False
    return datetime.now().timestamp() * 1000 - last_timestamp < window_ms


def can_user_approve(work_order: Optional[WorkOrder], user_id: str) -> bool:
    """
    Check if a user can approve a work order.
    
    Args:
        work_order: WorkOrder instance or None
        user_id: ID of the user
        
    Returns:
        True if the user can approve, False otherwise
    """
    if not work_order:
        return False
    # Approver must be the current approver and not the creator
    return work_order.current_approver_id == user_id and work_order.created_by != user_id