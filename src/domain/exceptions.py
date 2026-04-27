"""
Domain layer exceptions for work order approval workflow.

This module defines business exceptions that may be raised during
work order lifecycle operations including state transitions,
approval actions, and notification handling.

Version: v1.0
Project: SWARM-2025-Q2-P0-001
"""

from typing import Optional


class DomainException(Exception):
    """Base exception for all domain-level business exceptions."""
    
    def __init__(self, message: str, code: Optional[str] = None) -> None:
        """
        Initialize domain exception.
        
        Args:
            message: Human-readable error description.
            code: Optional error code for programmatic handling.
        """
        super().__init__(message)
        self.message = message
        self.code = code or "DOMAIN_ERROR"


class InvalidTransitionError(DomainException):
    """
    Exception raised when attempting an invalid state transition.
    
    This exception is thrown when a work order receives an action
    that is not permitted in its current state according to the
    state machine rules.
    
    Example:
        A work order in DRAFT status cannot be approved directly;
        it must first be submitted to transition to PENDING_APPROVAL.
    """
    
    def __init__(
        self,
        message: str,
        current_state: str,
        attempted_action: str,
        allowed_actions: Optional[list[str]] = None
    ) -> None:
        """
        Initialize invalid transition error.
        
        Args:
            message: Error description.
            current_state: Current state of the work order.
            attempted_action: The action that was attempted.
            allowed_actions: List of actions allowed from current state.
        """
        super().__init__(
            message=message,
            code="INVALID_TRANSITION"
        )
        self.current_state = current_state
        self.attempted_action = attempted_action
        self.allowed_actions = allowed_actions or []


class WorkOrderNotFoundError(DomainException):
    """
    Exception raised when a work order cannot be found.
    
    This is thrown when attempting to perform operations on
    a work order that does not exist in the system.
    """
    
    def __init__(self, work_order_id: str) -> None:
        """
        Initialize work order not found error.
        
        Args:
            work_order_id: ID of the work order that was not found.
        """
        super().__init__(
            message=f"Work order with ID '{work_order_id}' not found",
            code="WORK_ORDER_NOT_FOUND"
        )
        self.work_order_id = work_order_id


class ApprovalError(DomainException):
    """
    Exception raised when an approval operation fails.
    
    This includes scenarios such as:
    - User is not authorized to approve
    - Work order is not in a state that allows approval
    - Approval has already been processed
    """
    
    def __init__(self, message: str, work_order_id: Optional[str] = None) -> None:
        """
        Initialize approval error.
        
        Args:
            message: Error description.
            work_order_id: Optional ID of the related work order.
        """
        super().__init__(
            message=message,
            code="APPROVAL_ERROR"
        )
        self.work_order_id = work_order_id


class UnauthorizedApprovalError(ApprovalError):
    """
    Exception raised when a user attempts to approve a work order
    they are not authorized to approve.
    """
    
    def __init__(
        self,
        user_id: str,
        work_order_id: str,
        reason: Optional[str] = None
    ) -> None:
        """
        Initialize unauthorized approval error.
        
        Args:
            user_id: ID of the user attempting the approval.
            work_order_id: ID of the work order.
            reason: Optional reason for the authorization failure.
        """
        message = f"User '{user_id}' is not authorized to approve work order '{work_order_id}'"
        if reason:
            message += f": {reason}"
        
        super().__init__(
            message=message,
            work_order_id=work_order_id
        )
        self.code = "UNAUTHORIZED_APPROVAL"
        self.user_id = user_id


class NotificationError(DomainException):
    """
    Exception raised when notification delivery fails.
    
    This is thrown when the system fails to send notifications
    to relevant parties about work order state changes.
    """
    
    def __init__(
        self,
        message: str,
        work_order_id: Optional[str] = None,
        recipient_id: Optional[str] = None
    ) -> None:
        """
        Initialize notification error.
        
        Args:
            message: Error description.
            work_order_id: Optional ID of the related work order.
            recipient_id: Optional ID of the notification recipient.
        """
        super().__init__(
            message=message,
            code="NOTIFICATION_ERROR"
        )
        self.work_order_id = work_order_id
        self.recipient_id = recipient_id


class ConcurrencyError(DomainException):
    """
    Exception raised when concurrent modification is detected.
    
    This is used for optimistic locking scenarios where
    version conflicts occur during work order updates.
    """
    
    def __init__(self, work_order_id: str, expected_version: int, actual_version: int) -> None:
        """
        Initialize concurrency error.
        
        Args:
            work_order_id: ID of the work order with version conflict.
            expected_version: Version the operation expected to find.
            actual_version: Version that was actually found.
        """
        super().__init__(
            message=(
                f"Concurrency conflict for work order '{work_order_id}': "
                f"expected version {expected_version}, found {actual_version}"
            ),
            code="CONCURRENCY_ERROR"
        )
        self.work_order_id = work_order_id
        self.expected_version = expected_version
        self.actual_version = actual_version


class ValidationError(DomainException):
    """
    Exception raised when work order data validation fails.
    
    This includes validation of input fields such as:
    - Title length (1-200 characters)
    - Description length (0-5000 characters)
    - Comment length (0-1000 characters)
    """
    
    def __init__(self, message: str, field: Optional[str] = None) -> None:
        """
        Initialize validation error.
        
        Args:
            message: Error description.
            field: Optional name of the field that failed validation.
        """
        super().__init__(
            message=message,
            code="VALIDATION_ERROR"
        )
        self.field = field