"""
Work Order Service Module

Provides business logic for work order approval/rejection workflows.
Handles state machine transitions and notification triggers for SWARM-2025-Q2-P0-003.

Iteration: 2
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from src.domain.exceptions.workorder_exceptions import (
    InvalidStateTransitionError,
    PermissionDeniedError,
    ConcurrencyConflictError,
    ValidationError,
)
from src.domain.services.notification_service import NotificationService


class WorkOrderStatus(Enum):
    """Work order status enumeration matching backend state machine."""
    CREATED = "created"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CLOSED = "closed"


class ApprovalAction(Enum):
    """Approval action types."""
    APPROVE = "approve"
    REJECT = "reject"


@dataclass
class ApprovalContext:
    """Context object for approval operations."""
    work_order_id: str
    user_id: str
    action: ApprovalAction
    reason: Optional[str] = None
    timestamp: Optional[datetime] = None


@dataclass
class ApprovalResult:
    """Result of approval operation."""
    success: bool
    work_order_id: str
    new_status: WorkOrderStatus
    approved_by: Optional[str] = None
    reject_reason: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class WorkOrderService:
    """
    Service for managing work order approval workflows.
    
    Handles one-click approval/rejection from frontend, state machine
    transitions, and notification triggers.
    
    Attributes:
        notification_service: Service for sending notifications
        _state_machine: Internal state machine reference
    """
    
    # Minimum length for rejection reason
    REJECT_REASON_MIN_LENGTH = 10
    
    # Idempotency window in milliseconds
    IDEMPOTENCY_WINDOW_MS = 5000
    
    # Valid transitions map
    VALID_TRANSITIONS = {
        WorkOrderStatus.PENDING_APPROVAL: {
            ApprovalAction.APPROVE: WorkOrderStatus.APPROVED,
            ApprovalAction.REJECT: WorkOrderStatus.REJECTED,
        }
    }
    
    def __init__(self, notification_service: Optional[NotificationService] = None):
        """
        Initialize WorkOrderService.
        
        Args:
            notification_service: Optional notification service for sending alerts.
                                 If not provided, notifications will be skipped.
        """
        self._notification_service = notification_service
        self._last_operation_timestamps: dict[str, datetime] = {}
    
    def approve_work_order(
        self,
        work_order_id: str,
        user_id: str,
        version: int,
        user_role: str = "APPROVER"
    ) -> ApprovalResult:
        """
        Approve a work order by ID.
        
        Validates state transition, permission, and version (optimistic locking).
        Triggers notification upon successful approval.
        
        Args:
            work_order_id: Unique identifier of work order
            user_id: ID of user performing approval
            version: Expected version for optimistic locking
            user_role: Role of user (must be APPROVER to approve)
            
        Returns:
            ApprovalResult with operation outcome
            
        Raises:
            PermissionDeniedError: If user lacks APPROVER role
            InvalidStateTransitionError: If work order not in PENDING_APPROVAL
            ConcurrencyConflictError: If version mismatch (HTTP 409)
        """
        context = ApprovalContext(
            work_order_id=work_order_id,
            user_id=user_id,
            action=ApprovalAction.APPROVE,
            timestamp=datetime.utcnow()
        )
        
        # Permission check
        if not self._check_approval_permission(user_role):
            raise PermissionDeniedError(
                f"User {user_id} lacks APPROVER role to perform this action"
            )
        
        # Check idempotency
        if self._is_duplicate_operation(work_order_id, context.timestamp):
            return ApprovalResult(
                success=True,
                work_order_id=work_order_id,
                new_status=WorkOrderStatus.APPROVED,
                approved_by=user_id
            )
        
        # Get work order (mock fetching - replace with actual repository call)
        work_order = self._get_work_order(work_order_id)
        
        # State validation
        if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
            raise InvalidStateTransitionError(
                f"Cannot approve work order in status {work_order.status.value}. "
                f"Expected {WorkOrderStatus.PENDING_APPROVAL.value}"
            )
        
        # Version check (optimistic locking)
        if work_order.version != version:
            raise ConcurrencyConflictError(
                f"Version conflict: expected {version}, got {work_order.version}"
            )
        
        # Self-approval check
        if work_order.created_by == user_id:
            raise PermissionDeniedError(
                "Work order creator cannot approve their own work order"
            )
        
        # Execute state transition
        new_status = self._execute_transition(work_order, context)
        
        # Update last operation timestamp
        self._last_operation_timestamps[work_order_id] = context.timestamp
        
        # Trigger notification
        self._send_approval_notification(work_order, user_id, success=True)
        
        return ApprovalResult(
            success=True,
            work_order_id=work_order_id,
            new_status=new_status,
            approved_by=user_id
        )
    
    def reject_work_order(
        self,
        work_order_id: str,
        user_id: str,
        reason: str,
        version: int,
        user_role: str = "APPROVER"
    ) -> ApprovalResult:
        """
        Reject a work order by ID with mandatory reason.
        
        Args:
            work_order_id: Unique identifier of work order
            user_id: ID of user performing rejection
            reason: Mandatory rejection reason (min 10 characters)
            version: Expected version for optimistic locking
            user_role: Role of user (must be APPROVER)
            
        Returns:
            ApprovalResult with operation outcome
            
        Raises:
            ValidationError: If rejection reason is too short
            PermissionDeniedError: If user lacks APPROVER role
            InvalidStateTransitionError: If work order not in PENDING_APPROVAL
            ConcurrencyConflictError: If version mismatch
        """
        # Validate reason length
        if not reason or len(reason.strip()) < self.REJECT_REASON_MIN_LENGTH:
            raise ValidationError(
                f"Rejection reason must be at least {self.REJECT_REASON_MIN_LENGTH} characters"
            )
        
        context = ApprovalContext(
            work_order_id=work_order_id,
            user_id=user_id,
            action=ApprovalAction.REJECT,
            reason=reason.strip(),
            timestamp=datetime.utcnow()
        )
        
        # Permission check
        if not self._check_approval_permission(user_role):
            raise PermissionDeniedError(
                f"User {user_id} lacks APPROVER role to perform this action"
            )
        
        # Check idempotency
        if self._is_duplicate_operation(work_order_id, context.timestamp):
            return ApprovalResult(
                success=True,
                work_order_id=work_order_id,
                new_status=WorkOrderStatus.REJECTED,
                reject_reason=reason
            )
        
        # Get work order
        work_order = self._get_work_order(work_order_id)
        
        # State validation
        if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
            raise InvalidStateTransitionError(
                f"Cannot reject work order in status {work_order.status.value}. "
                f"Expected {WorkOrderStatus.PENDING_APPROVAL.value}"
            )
        
        # Version check
        if work_order.version != version:
            raise ConcurrencyConflictError(
                f"Version conflict: expected {version}, got {work_order.version}"
            )
        
        # Self-rejection check
        if work_order.created_by == user_id:
            raise PermissionDeniedError(
                "Work order creator cannot reject their own work order"
            )
        
        # Execute state transition
        new_status = self._execute_transition(work_order, context)
        
        # Update timestamp
        self._last_operation_timestamps[work_order_id] = context.timestamp
        
        # Trigger notification
        self._send_approval_notification(work_order, user_id, success=False, reason=reason)
        
        return ApprovalResult(
            success=True,
            work_order_id=work_order_id,
            new_status=new_status,
            reject_reason=reason
        )
    
    def _check_approval_permission(self, user_role: str) -> bool:
        """
        Check if user has APPROVER role.
        
        Args:
            user_role: Role string to check
            
        Returns:
            True if user has APPROVER role, False otherwise
        """
        return user_role == "APPROVER"
    
    def _is_duplicate_operation(
        self,
        work_order_id: str,
        current_timestamp: datetime
    ) -> bool:
        """
        Check if operation is within idempotency window.
        
        Args:
            work_order_id: Work order identifier
            current_timestamp: Current operation timestamp
            
        Returns:
            True if duplicate, False otherwise
        """
        if work_order_id not in self._last_operation_timestamps:
            return False
        
        last_ts = self._last_operation_timestamps[work_order_id]
        delta_ms = (current_timestamp - last_ts).total_seconds() * 1000
        
        return delta_ms < self.IDEMPOTENCY_WINDOW_MS
    
    def _get_work_order(self, work_order_id: str):
        """
        Fetch work order by ID.
        
        Note: This is a placeholder. Replace with actual repository call.
        
        Args:
            work_order_id: Work order identifier
            
        Returns:
            WorkOrder entity with status, version, created_by fields
        """
        # TODO: Replace with actual repository call
        # from src.repositories.work_order_repository import WorkOrderRepository
        # return self._repository.find_by_id(work_order_id)
        raise NotImplementedError("Must inject work order repository")
    
    def _execute_transition(self, work_order, context: ApprovalContext) -> WorkOrderStatus:
        """
        Execute state machine transition.
        
        Args:
            work_order: WorkOrder entity
            context: Approval context
            
        Returns:
            New status after transition
        """
        current_status = work_order.status
        
        # Validate transition is allowed
        if current_status not in self.VALID_TRANSITIONS:
            raise InvalidStateTransitionError(
                f"No valid transitions from status {current_status.value}"
            )
        
        transitions = self.VALID_TRANSITIONS[current_status]
        
        if context.action not in transitions:
            raise InvalidStateTransitionError(
                f"Action {context.action.value} not allowed from {current_status.value}"
            )
        
        new_status = transitions[context.action]
        
        # Update work order (mock)
        work_order.status = new_status
        work_order.version += 1
        
        # Record approval action
        self._record_approval_action(work_order, context, new_status)
        
        return new_status
    
    def _record_approval_action(
        self,
        work_order,
        context: ApprovalContext,
        new_status: WorkOrderStatus
    ) -> None:
        """
        Record approval action for audit trail.
        
        Args:
            work_order: WorkOrder entity
            context: Approval context
            new_status: New status after transition
        """
        # TODO: Replace with actual audit log persistence
        # from src.models.approval_history import ApprovalHistory
        # approval_record = ApprovalHistory(
        #     work_order_id=context.work_order_id,
        #     action=context.action.value,
        #     performed_by=context.user_id,
        #     reason=context.reason,
        #     timestamp=context.timestamp,
        #     new_status=new_status.value
        # )
        # self._approval_history_repo.save(approval_record)
        pass
    
    def _send_approval_notification(
        self,
        work_order,
        approver_id: str,
        success: bool,
        reason: Optional[str] = None
    ) -> None:
        """
        Send notification to work order creator.
        
        Args:
            work_order: WorkOrder entity
            approver_id: ID of approver/rejector
            success: True for approval, False for rejection
            reason: Rejection reason (if rejected)
        """
        if self._notification_service is None:
            return
        
        notification_type = "approved" if success else "rejected"
        
        self._notification_service.send_approval_result(
            recipient_id=work_order.created_by,
            work_order_id=work_order.id,
            notification_type=notification_type,
            approver_id=approver_id,
            reject_reason=reason
        )


class WorkOrder:
    """
    Work order entity (placeholder for actual domain entity).
    
    In production, this would be imported from domain entities module.
    """
    
    def __init__(
        self,
        id: str,
        status: WorkOrderStatus,
        version: int,
        created_by: str
    ):
        self.id = id
        self.status = status
        self.version = version
        self.created_by = created_by