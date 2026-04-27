"""
Work Order Entity Module

This module defines the WorkOrder domain entity with state machine support
for the approval workflow. It implements transition rules and validation
for the work order lifecycle (DRAFT → PENDING → APPROVED/REJECTED/RETURNED).

Iteration: 7
Feature: 工单审批流程
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class WorkOrderStatus(str, Enum):
    """
    Work order status enumeration representing all valid states.

    States:
        DRAFT: Initial state, only applicant can edit
        PENDING: Awaiting approval
        APPROVED: Final state - approved
        REJECTED: Final state - rejected
        RETURNED: Intermediate state - returned to applicant
        CANCELLED: Final state - cancelled by applicant
    """
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"

    @classmethod
    def terminal_states(cls) -> Set[WorkOrderStatus]:
        """Return states that cannot transition to any other state."""
        return {cls.APPROVED, cls.REJECTED, cls.CANCELLED}

    @classmethod
    def notifiable_states(cls) -> Set[WorkOrderStatus]:
        """Return states that trigger notification."""
        return {cls.APPROVED, cls.REJECTED, cls.RETURNED}


class OperationType(str, Enum):
    """
    Work order operation types for state transitions.

    Operations:
        submit: DRAFT → PENDING (applicant)
        approve: PENDING → APPROVED (approver)
        reject: PENDING → REJECTED (approver)
        return: PENDING → RETURNED (approver)
        resubmit: RETURNED → PENDING (applicant)
        cancel: PENDING → CANCELLED (applicant)
    """
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"
    RESUBMIT = "resubmit"
    CANCEL = "cancel"


@dataclass
class TransitionRule:
    """
    Defines a valid state transition rule.

    Attributes:
        from_status: Source state
        operation: Operation that triggers transition
        to_status: Target state
        allowed_roles: Set of roles that can perform this operation
        requires_approval_permission: Whether approver must have approval rights
    """
    from_status: WorkOrderStatus
    operation: OperationType
    to_status: WorkOrderStatus
    allowed_roles: Set[str] = field(default_factory=set)
    requires_approval_permission: bool = False


class TransitionValidator:
    """
    Validates state transitions according to defined rules.

    This class enforces the transition rule matrix and prevents invalid
    state changes such as transitions from terminal states.
    """

    # Default transition rules matrix
    DEFAULT_RULES: List[TransitionRule] = [
        TransitionRule(
            from_status=WorkOrderStatus.DRAFT,
            operation=OperationType.SUBMIT,
            to_status=WorkOrderStatus.PENDING,
            allowed_roles={"applicant"},
        ),
        TransitionRule(
            from_status=WorkOrderStatus.PENDING,
            operation=OperationType.APPROVE,
            to_status=WorkOrderStatus.APPROVED,
            allowed_roles={"approver"},
            requires_approval_permission=True,
        ),
        TransitionRule(
            from_status=WorkOrderStatus.PENDING,
            operation=OperationType.REJECT,
            to_status=WorkOrderStatus.REJECTED,
            allowed_roles={"approver"},
            requires_approval_permission=True,
        ),
        TransitionRule(
            from_status=WorkOrderStatus.PENDING,
            operation=OperationType.RETURN,
            to_status=WorkOrderStatus.RETURNED,
            allowed_roles={"approver"},
            requires_approval_permission=True,
        ),
        TransitionRule(
            from_status=WorkOrderStatus.RETURNED,
            operation=OperationType.RESUBMIT,
            to_status=WorkOrderStatus.PENDING,
            allowed_roles={"applicant"},
        ),
        TransitionRule(
            from_status=WorkOrderStatus.PENDING,
            operation=OperationType.CANCEL,
            to_status=WorkOrderStatus.CANCELLED,
            allowed_roles={"applicant"},
        ),
    ]

    def __init__(self, rules: Optional[List[TransitionRule]] = None) -> None:
        """
        Initialize validator with transition rules.

        Args:
            rules: Custom transition rules. Uses DEFAULT_RULES if None.
        """
        self._rules = rules if rules is not None else self.DEFAULT_RULES

    def validate(
        self,
        current_status: WorkOrderStatus,
        operation: OperationType,
        operator_id: str,
        applicant_id: str,
        operator_roles: Set[str],
        has_approval_permission: bool = False,
    ) -> WorkOrderStatus:
        """
        Validate and return target state for a transition.

        Args:
            current_status: Current work order status
            operation: Operation to perform
            operator_id: ID of the operator
            applicant_id: ID of the work order applicant
            operator_roles: Roles of the operator
            has_approval_permission: Whether operator has approval rights

        Returns:
            Target WorkOrderStatus if valid

        Raises:
            InvalidTransitionError: If transition is not allowed
            SelfApprovalForbiddenError: If approver is also the applicant
            PermissionDeniedError: If operator lacks required roles
        """
        # Check terminal state
        if current_status in WorkOrderStatus.terminal_states():
            raise InvalidTransitionError(
                f"Cannot perform any operation on terminal state: {current_status.value}"
            )

        # Find matching rule
        rule = self._find_rule(current_status, operation)
        if rule is None:
            raise InvalidTransitionError(
                f"No transition defined for {current_status.value} + {operation.value}"
            )

        # Check self-approval prohibition for approvers
        if rule.requires_approval_permission and operator_id == applicant_id:
            raise SelfApprovalForbiddenError(
                "Self-approval is not allowed. Applicant cannot approve their own work order."
            )

        # Check role permissions
        if not operator_roles.intersection(rule.allowed_roles):
            raise PermissionDeniedError(
                f"Operator does not have required roles: {rule.allowed_roles}"
            )

        # Check approval permission if required
        if rule.requires_approval_permission and not has_approval_permission:
            raise PermissionDeniedError(
                "Operator does not have approval permission"
            )

        return rule.to_status

    def _find_rule(
        self,
        from_status: WorkOrderStatus,
        operation: OperationType,
    ) -> Optional[TransitionRule]:
        """Find transition rule matching from_status and operation."""
        for rule in self._rules:
            if rule.from_status == from_status and rule.operation == operation:
                return rule
        return None

    def get_allowed_operations(
        self,
        current_status: WorkOrderStatus,
        operator_roles: Set[str],
    ) -> List[OperationType]:
        """
        Get list of operations allowed from current status.

        Args:
            current_status: Current work order status
            operator_roles: Roles of the operator

        Returns:
            List of allowed operation types
        """
        allowed = []
        for rule in self._rules:
            if rule.from_status == current_status:
                if operator_roles.intersection(rule.allowed_roles):
                    allowed.append(rule.operation)
        return allowed


class IdempotencyService:
    """
    Provides idempotency checking for work order operations.

    Prevents duplicate operations within a 5-minute window using
    a hash-based idempotency key.
    """

    DEFAULT_TTL_SECONDS = 300

    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        """
        Initialize idempotency service.

        Args:
            ttl_seconds: Time-to-live for idempotency records in seconds.
        """
        self._ttl = ttl_seconds
        self._records: Dict[str, tuple[Any, int]] = {}

    def generate_key(
        self,
        work_order_id: str,
        operator_id: str,
        operation: OperationType,
    ) -> str:
        """
        Generate idempotency key for an operation.

        Args:
            work_order_id: Work order identifier
            operator_id: Operator identifier
            operation: Operation type

        Returns:
            SHA256 hash string as idempotency key
        """
        time_bucket = int(time.time()) // self._ttl
        data = f"{work_order_id}:{operator_id}:{operation.value}:{time_bucket}"
        return hashlib.sha256(data.encode()).hexdigest()

    def check_and_record(
        self,
        key: str,
        result: Any,
    ) -> tuple[bool, Optional[Any]]:
        """
        Check if key exists and record result if new.

        Args:
            key: Idempotency key
            result: Result to record

        Returns:
            Tuple of (is_duplicate, cached_result)
        """
        current_time = int(time.time())
        if key in self._records:
            cached_result, expiry = self._records[key]
            if current_time < expiry:
                return True, cached_result
            else:
                del self._records[key]

        expiry = current_time + self._ttl
        self._records[key] = (result, expiry)
        return False, None

    def clear_expired(self) -> None:
        """Remove expired records from cache."""
        current_time = int(time.time())
        self._records = {
            k: v for k, v in self._records.items()
            if current_time < v[1]
        }


@dataclass
class NotificationEvent:
    """
    Notification event for work order state changes.

    Attributes:
        work_order_id: Work order identifier
        work_order_title: Work order title
        operation_type: The operation that triggered the event
        operator_id: ID of the operator who performed the action
        operator_name: Name of the operator
        new_status: The new status after transition
        timestamp: When the event occurred
        recipients: List of recipient user IDs
    """
    work_order_id: str
    work_order_title: str
    operation_type: OperationType
    operator_id: str
    operator_name: str
    new_status: WorkOrderStatus
    timestamp: datetime = field(default_factory=datetime.now)
    recipients: List[str] = field(default_factory=list)


class NotificationObserver:
    """
    Observer interface for notification events.

    Implementations should handle sending notifications via
    email, SMS, or other channels.
    """

    def on_notification(self, event: NotificationEvent) -> None:
        """
        Handle notification event.

        Args:
            event: Notification event to process
        """
        raise NotImplementedError


class NotificationTrigger:
    """
    Manages notification observers and triggers events.

    Part of the observer pattern for state change notifications.
    """

    def __init__(self) -> None:
        """Initialize notification trigger with empty observer list."""
        self._observers: List[NotificationObserver] = []

    def register_observer(self, observer: NotificationObserver) -> None:
        """
        Register an observer for notification events.

        Args:
            observer: NotificationObserver implementation
        """
        self._observers.append(observer)

    def notify(self, event: NotificationEvent) -> None:
        """
        Notify all registered observers of an event.

        Args:
            event: Notification event to broadcast
        """
        for observer in self._observers:
            observer.on_notification(event)

    def create_event(
        self,
        work_order_id: str,
        work_order_title: str,
        operation: OperationType,
        operator_id: str,
        operator_name: str,
        new_status: WorkOrderStatus,
        recipients: Optional[List[str]] = None,
    ) -> NotificationEvent:
        """
        Create and trigger a notification event.

        Args:
            work_order_id: Work order identifier
            work_order_title: Work order title
            operation: Operation that triggered the event
            operator_id: ID of the operator
            operator_name: Name of the operator
            new_status: New status after transition
            recipients: List of recipient user IDs

        Returns:
            Created NotificationEvent
        """
        event = NotificationEvent(
            work_order_id=work_order_id,
            work_order_title=work_order_title,
            operation_type=operation,
            operator_id=operator_id,
            operator_name=operator_name,
            new_status=new_status,
            recipients=recipients or [],
        )
        self.notify(event)
        return event


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class SelfApprovalForbiddenError(Exception):
    """Raised when a user attempts to approve their own work order."""
    pass


class PermissionDeniedError(Exception):
    """Raised when a user lacks permission for an operation."""
    pass


class WorkOrder:
    """
    Work Order domain entity with state machine support.

    This class represents a work order in the approval workflow system.
    It manages state transitions, validates operations, and coordinates
    with notification services.

    Attributes:
        id: Unique identifier
        title: Work order title
        description: Work order description
        status: Current status
        applicant_id: ID of the applicant
        applicant_name: Name of the applicant
        approver_id: ID of the assigned approver
        approver_name: Name of the assigned approver
        created_at: Creation timestamp
        updated_at: Last update timestamp
        comment: Optional approval comment
    """

    def __init__(
        self,
        id: str,
        title: str,
        description: str = "",
        applicant_id: Optional[str] = None,
        applicant_name: Optional[str] = None,
        approver_id: Optional[str] = None,
        approver_name: Optional[str] = None,
        status: WorkOrderStatus = WorkOrderStatus.DRAFT,
        comment: Optional[str] = None,
    ) -> None:
        """
        Initialize a new WorkOrder.

        Args:
            id: Unique identifier
            title: Work order title
            description: Work order description
            applicant_id: ID of the applicant
            applicant_name: Name of the applicant
            approver_id: ID of the assigned approver
            approver_name: Name of the assigned approver
            status: Initial status (defaults to DRAFT)
            comment: Optional approval comment
        """
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.applicant_id = applicant_id
        self.applicant_name = applicant_name
        self.approver_id = approver_id
        self.approver_name = approver_name
        self.comment = comment
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def execute_operation(
        self,
        operation: OperationType,
        operator_id: str,
        operator_name: str,
        operator_roles: Set[str],
        has_approval_permission: bool = False,
        validator: Optional[TransitionValidator] = None,
        notification_trigger: Optional[NotificationTrigger] = None,
        idempotency_service: Optional[IdempotencyService] = None,
    ) -> WorkOrder:
        """
        Execute a state transition operation.

        This method validates the transition, updates the state,
        and triggers notifications if appropriate.

        Args:
            operation: Operation to perform
            operator_id: ID of the operator
            operator_name: Name of the operator
            operator_roles: Roles of the operator
            has_approval_permission: Whether operator has approval rights
            validator: Transition validator (creates default if None)
            notification_trigger: Notification trigger for events
            idempotency_service: Idempotency service for duplicate prevention

        Returns:
            Updated WorkOrder instance

        Raises:
            InvalidTransitionError: If transition is not allowed
            SelfApprovalForbiddenError: If approver is also the applicant
            PermissionDeniedError: If operator lacks required roles

        Example:
            >>> wo = WorkOrder(id="WO-001", title="Test", applicant_id="user1")
            >>> validator = TransitionValidator()
            >>> wo.execute_operation(
            ...     OperationType.SUBMIT,
            ...     operator_id="user1",
            ...     operator_name="Test User",
            ...     operator_roles={"applicant"},
            ...     validator=validator,
            ... )
        """
        # Use default validator if none provided
        if validator is None:
            validator = TransitionValidator()

        # Check idempotency if service is provided
        if idempotency_service is not None:
            key = idempotency_service.generate_key(
                self.id, operator_id, operation
            )
            is_duplicate, cached_result = idempotency_service.check_and_record(
                {"status": self.status.value, "comment": self.comment}
            )
            if is_duplicate and cached_result is not None:
                self.status = WorkOrderStatus(cached_result["status"])
                self.comment = cached_result.get("comment")
                return self

        # Validate and get target state
        target_status = validator.validate(
            current_status=self.status,
            operation=operation,
            operator_id=operator_id,
            applicant_id=self.applicant_id or "",
            operator_roles=operator_roles,
            has_approval_permission=has_approval_permission,
        )

        # Store old status for notification
        old_status = self.status

        # Update state
        self.status = target_status
        self.updated_at = datetime.now()

        # Trigger notification if in notifiable states
        if (
            notification_trigger is not None
            and target_status in WorkOrderStatus.notifiable_states()
        ):
            notification_trigger.create_event(
                work_order_id=self.id,
                work_order_title=self.title,
                operation=operation,
                operator_id=operator_id,
                operator_name=operator_name,
                new_status=target_status,
                recipients=[self.applicant_id] if self.applicant_id else [],
            )

        # Record for idempotency if service provided
        if idempotency_service is not None:
            key = idempotency_service.generate_key(
                self.id, operator_id, operation
            )
            idempotency_service.check_and_record(
                key,
                {"status": target_status.value, "comment": self.comment},
            )

        return self

    def can_approve(self, operator_id: str, operator_roles: Set[str]) -> bool:
        """
        Check if operator can approve this work order.

        Args:
            operator_id: ID of the operator
            operator_roles: Roles of the operator

        Returns:
            True if operator can approve, False otherwise
        """
        if self.status != WorkOrderStatus.PENDING:
            return False
        if operator_id == self.applicant_id:
            return False
        if "approver" not in operator_roles:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert work order to dictionary representation.

        Returns:
            Dictionary with all work order fields
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "applicant_id": self.applicant_id,
            "applicant_name": self.applicant_name,
            "approver_id": self.approver_id,
            "approver_name": self.approver_name,
            "comment": self.comment,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        """Return string representation of the work order."""
        return (
            f"WorkOrder(id={self.id!r}, title={self.title!r}, "
            f"status={self.status.value})"
        )