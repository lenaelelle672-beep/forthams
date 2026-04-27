"""
Approval Use Cases Module

Provides business logic for work order approval/rejection workflows.
Implements state machine transitions and notification triggers.

Task: SWARM-2025-Q2-P0-003 - 工单审批流程 (Iteration 2)
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, Tuple
from uuid import UUID

from src.domain.entities.work_order import WorkOrder, WorkOrderStatus
from src.domain.exceptions import (
    InvalidStateTransitionError,
    PermissionDeniedError,
    OptimisticLockError,
    IdempotencyError,
)
from src.domain.services.notification_service import NotificationService
from src.domain.services.state_machine_engine import StateMachineEngine
from src.application.services.idempotency_service import IdempotencyService


class ApprovalAction(str, Enum):
    """Valid approval actions."""
    APPROVE = "approve"
    REJECT = "reject"


@dataclass
class ApprovalContext:
    """
    Context object for approval operations.
    
    Attributes:
        user_id: ID of the user performing the action
        reason: Optional reason for rejection
        idempotency_key: Key for idempotency check
        expected_version: Expected version for optimistic locking
    """
    user_id: str
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None
    expected_version: Optional[int] = None


@dataclass
class ApprovalResult:
    """
    Result of an approval operation.
    
    Attributes:
        success: Whether the operation succeeded
        work_order: The updated work order
        action: The action performed
        error_message: Error message if failed
    """
    success: bool
    work_order: Optional[WorkOrder] = None
    action: Optional[ApprovalAction] = None
    error_message: Optional[str] = None


class ApprovalUseCase:
    """
    Use case handler for work order approval/rejection operations.
    
    This class implements the approval workflow business logic including:
    - State machine transitions
    - Permission validation
    - Optimistic locking for concurrency control
    - Idempotency checks
    - Notification triggering
    
    Args:
        state_machine: State machine engine for transitions
        notification_service: Service for sending notifications
        idempotency_service: Service for idempotency checks
    """
    
    REJECT_REASON_MIN_LENGTH = 10
    IDEMPOTENCY_WINDOW_MS = 5000
    
    def __init__(
        self,
        state_machine: StateMachineEngine,
        notification_service: NotificationService,
        idempotency_service: IdempotencyService,
    ) -> None:
        """
        Initialize the approval use case.
        
        Args:
            state_machine: State machine engine instance
            notification_service: Notification service instance
            idempotency_service: Idempotency service instance
        """
        self._state_machine = state_machine
        self._notification_service = notification_service
        self._idempotency_service = idempotency_service
    
    def approve_work_order(
        self,
        work_order: WorkOrder,
        context: ApprovalContext,
    ) -> ApprovalResult:
        """
        Approve a work order.
        
        This method:
        1. Validates user permissions
        2. Checks state machine transition validity
        3. Performs optimistic locking
        4. Transitions work order to Approved state
        5. Triggers notification to requester
        
        Args:
            work_order: The work order to approve
            context: Approval context with user info and metadata
            
        Returns:
            ApprovalResult with success status and updated work order
            
        Raises:
            PermissionDeniedError: If user cannot approve
            InvalidStateTransitionError: If work order is not in pending state
            OptimisticLockError: If version mismatch (concurrent modification)
            IdempotencyError: If operation was already processed
        """
        # Validate permissions
        if not self._can_user_approve(work_order, context.user_id):
            raise PermissionDeniedError(
                f"User {context.user_id} does not have permission to approve "
                f"work order {work_order.id}"
            )
        
        # Check idempotency
        if context.idempotency_key:
            self._check_idempotency(context.idempotency_key)
        
        # Validate state transition
        if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
            raise InvalidStateTransitionError(
                f"Cannot approve work order in status {work_order.status}. "
                f"Expected: {WorkOrderStatus.PENDING_APPROVAL}"
            )
        
        # Perform optimistic locking check
        if context.expected_version is not None:
            if work_order.version != context.expected_version:
                raise OptimisticLockError(
                    f"Work order version mismatch. Expected: {context.expected_version}, "
                    f"Actual: {work_order.version}"
                )
        
        # Execute state transition
        updated_work_order = self._state_machine.transition(
            entity=work_order,
            event="approve",
            metadata={
                "approved_by": context.user_id,
                "approved_at": datetime.utcnow().isoformat(),
            }
        )
        
        # Record idempotency
        if context.idempotency_key:
            self._idempotency_service.record(
                key=context.idempotency_key,
                result={"status": updated_work_order.status.value}
            )
        
        # Trigger notification
        self._notification_service.send_approval_notification(
            work_order_id=work_order.id,
            requester_id=work_order.created_by,
            action=ApprovalAction.APPROVE.value,
            approver_id=context.user_id,
        )
        
        return ApprovalResult(
            success=True,
            work_order=updated_work_order,
            action=ApprovalAction.APPROVE,
        )
    
    def reject_work_order(
        self,
        work_order: WorkOrder,
        context: ApprovalContext,
    ) -> ApprovalResult:
        """
        Reject a work order with a reason.
        
        This method:
        1. Validates user permissions
        2. Validates rejection reason (min 10 chars)
        3. Checks state machine transition validity
        4. Performs optimistic locking
        5. Transitions work order to Rejected state
        6. Triggers notification to requester
        
        Args:
            work_order: The work order to reject
            context: Approval context with user info, reason, and metadata
            
        Returns:
            ApprovalResult with success status and updated work order
            
        Raises:
            PermissionDeniedError: If user cannot reject
            InvalidStateTransitionError: If work order is not in pending state
            ValueError: If rejection reason is too short
            OptimisticLockError: If version mismatch
            IdempotencyError: If operation was already processed
        """
        # Validate rejection reason
        if not context.reason or len(context.reason) < self.REJECT_REASON_MIN_LENGTH:
            raise ValueError(
                f"Rejection reason must be at least {self.REJECT_REASON_MIN_LENGTH} "
                f"characters. Got: {len(context.reason) if context.reason else 0}"
            )
        
        # Validate permissions
        if not self._can_user_approve(work_order, context.user_id):
            raise PermissionDeniedError(
                f"User {context.user_id} does not have permission to reject "
                f"work order {work_order.id}"
            )
        
        # Check idempotency
        if context.idempotency_key:
            self._check_idempotency(context.idempotency_key)
        
        # Validate state transition
        if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
            raise InvalidStateTransitionError(
                f"Cannot reject work order in status {work_order.status}. "
                f"Expected: {WorkOrderStatus.PENDING_APPROVAL}"
            )
        
        # Perform optimistic locking check
        if context.expected_version is not None:
            if work_order.version != context.expected_version:
                raise OptimisticLockError(
                    f"Work order version mismatch. Expected: {context.expected_version}, "
                    f"Actual: {work_order.version}"
                )
        
        # Execute state transition
        updated_work_order = self._state_machine.transition(
            entity=work_order,
            event="reject",
            metadata={
                "rejected_by": context.user_id,
                "rejected_at": datetime.utcnow().isoformat(),
                "reject_reason": context.reason,
            }
        )
        
        # Record idempotency
        if context.idempotency_key:
            self._idempotency_service.record(
                key=context.idempotency_key,
                result={
                    "status": updated_work_order.status.value,
                    "reason": context.reason,
                }
            )
        
        # Trigger notification
        self._notification_service.send_approval_notification(
            work_order_id=work_order.id,
            requester_id=work_order.created_by,
            action=ApprovalAction.REJECT.value,
            approver_id=context.user_id,
            reason=context.reason,
        )
        
        return ApprovalResult(
            success=True,
            work_order=updated_work_order,
            action=ApprovalAction.REJECT,
        )
    
    def _can_user_approve(
        self,
        work_order: WorkOrder,
        user_id: str,
    ) -> bool:
        """
        Check if a user has permission to approve a work order.
        
        A user can approve if:
        - They are the current approver assigned to the work order
        - They are not the creator of the work order (self-approval not allowed)
        
        Args:
            work_order: The work order to check
            user_id: The user ID to check
            
        Returns:
            True if user can approve, False otherwise
        """
        if work_order is None:
            return False
        
        # Approver must be the current approver and not the creator
        return (
            work_order.current_approver_id == user_id
            and work_order.created_by != user_id
        )
    
    def _check_idempotency(self, idempotency_key: str) -> None:
        """
        Check if an operation with this idempotency key was already processed.
        
        Args:
            idempotency_key: The idempotency key to check
            
        Raises:
            IdempotencyError: If operation was already processed
        """
        if self._idempotency_service.exists(idempotency_key):
            raise IdempotencyError(
                f"Operation with idempotency key '{idempotency_key}' "
                f"was already processed"
            )
    
    def can_transition_to(
        self,
        work_order: WorkOrder,
        action: ApprovalAction,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a work order can transition to the specified action.
        
        Args:
            work_order: The work order to check
            action: The desired approval action
            
        Returns:
            Tuple of (can_transition, error_message)
        """
        if work_order.status != WorkOrderStatus.PENDING_APPROVAL:
            return False, f"Work order is in {work_order.status.value} state, not pending approval"
        
        return True, None
    
    def is_within_idempotency_window(
        self,
        last_timestamp: Optional[int],
        window_ms: int = None,
    ) -> bool:
        """
        Check if the current time is within the idempotency window.
        
        Args:
            last_timestamp: The timestamp of the last operation
            window_ms: The window size in milliseconds
            
        Returns:
            True if within window, False otherwise
        """
        if window_ms is None:
            window_ms = self.IDEMPOTENCY_WINDOW_MS
        
        if not last_timestamp:
            return False
        
        return (datetime.utcnow().timestamp() * 1000) - last_timestamp < window_ms