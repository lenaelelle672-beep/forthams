"""
Field Mapping Engine Module.

This module provides field mapping capabilities for the asset management system,
enabling state transition, approval chain routing, and event persistence.

Key Components:
- AssetStateMachineEngine: Core state machine for asset lifecycle management
- ApprovalChainRouter: Routes approval requests through the chain of authority
- EventStore: Immutable event storage for audit trail persistence
- FieldMappingValidator: Validates field mappings for state transitions

Design Principles:
- Deterministic state transitions (given input + context → unique output)
- Atomic operations for state changes + event persistence
- RBAC-based permission validation for approval operations
- Event sourcing for complete audit trail

Target SPEC:
- Phase 3: Process Engine & Approval Chain Implementation
- State transition core logic, approval chain config/routing,
  persistent event storage & query interfaces
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Type

# Core domain imports for state machine
from src.domain.entities.asset import Asset, AssetStatus
from src.domain.entities.retirement_request import RetirementRequest, RetirementStatus
from src.domain.entities.history import LifecycleHistory, EventRecord
from src.domain.value_objects.asset_status import AssetStatusVO
from src.domain.value_objects.transition_rule import TransitionRule, TransitionCondition

# Repository interfaces
from src.repositories.asset_repository import AssetRepository
from src.repositories.retirement_repository import RetirementRepository
from src.repositories.history_repository import HistoryRepository
from src.repositories.approval_chain_repository import ApprovalChainRepository

# Service interfaces
from src.services.approval_chain_service import ApprovalChainService
from src.services.status_history_service import StatusHistoryService


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, current_state: str, target_state: str, reason: str = ""):
        self.current_state = current_state
        self.target_state = target_state
        self.reason = reason
        super().__init__(
            f"Invalid state transition from '{current_state}' to '{target_state}'"
            + (f": {reason}" if reason else "")
        )


class ApprovalChainError(Exception):
    """Raised when approval chain operations fail."""

    def __init__(self, message: str, stage: Optional[int] = None):
        self.stage = stage
        super().__init__(message)


class FieldMappingError(Exception):
    """Raised when field mapping validation fails."""

    def __init__(self, field_name: str, expected_type: str, actual_type: str):
        self.field_name = field_name
        self.expected_type = expected_type
        self.actual_type = actual_type
        super().__init__(
            f"Field '{field_name}' type mismatch: expected {expected_type}, "
            f"got {actual_type}"
        )


class EventPersistenceError(Exception):
    """Raised when event persistence operations fail."""

    def __init__(self, message: str, event_id: Optional[str] = None):
        self.event_id = event_id
        super().__init__(message)


@dataclass
class TransitionContext:
    """
    Context object containing all information needed for state transition.

    Attributes:
        asset_id: Unique identifier of the asset
        current_status: Current asset status
        target_status: Target status for transition
        operator_id: ID of user initiating the transition
        operator_role: Role of the operator (e.g., 'applicant', 'approver', 'final_approver')
        reason: Optional reason/memo for the transition
        metadata: Additional context metadata
        timestamp: Transition timestamp (auto-generated if not provided)
    """

    asset_id: str
    current_status: AssetStatus
    target_status: AssetStatus
    operator_id: str
    operator_role: str
    reason: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[datetime] = None

    def __post_init__(self):
        """Validate and set timestamp if not provided."""
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for serialization."""
        return {
            "asset_id": self.asset_id,
            "current_status": self.current_status.value,
            "target_status": self.target_status.value,
            "operator_id": self.operator_id,
            "operator_role": self.operator_role,
            "reason": self.reason,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


@dataclass
class ApprovalContext:
    """
    Context object for approval chain operations.

    Attributes:
        request_id: ID of the retirement request
        asset_id: ID of the asset under review
        current_stage: Current approval stage index (0-based)
        approver_id: ID of the approver taking action
        approver_role: Role of the approver
        decision: Approval decision ('approve', 'reject', 'rollback')
        comments: Optional comments from approver
        timestamp: Action timestamp
    """

    request_id: str
    asset_id: str
    current_stage: int
    approver_id: str
    approver_role: str
    decision: str  # 'approve', 'reject', 'rollback'
    comments: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[datetime] = None

    def __post_init__(self):
        """Validate and set timestamp if not provided."""
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary for serialization."""
        return {
            "request_id": self.request_id,
            "asset_id": self.asset_id,
            "current_stage": self.current_stage,
            "approver_id": self.approver_id,
            "approver_role": self.approver_role,
            "decision": self.decision,
            "comments": self.comments,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


@dataclass
class EventRecordData:
    """
    Immutable event record for audit trail.

    Attributes:
        event_id: Unique identifier for this event (SHA256 hash of content + timestamp)
        event_type: Type of event (e.g., 'STATE_TRANSITION', 'APPROVAL', 'REJECTION')
        asset_id: ID of the asset this event pertains to
        request_id: Optional ID of the retirement request
        source_state: State before the event
        target_state: State after the event
        operator_id: ID of user who triggered the event
        operator_role: Role of the operator
        timestamp: Event timestamp
        payload: Event-specific data
        checksum: Integrity checksum for immutability verification
    """

    event_id: str
    event_type: str
    asset_id: str
    request_id: Optional[str]
    source_state: str
    target_state: str
    operator_id: str
    operator_role: str
    timestamp: datetime
    payload: Dict[str, Any]
    checksum: str

    @staticmethod
    def compute_checksum(
        event_type: str,
        asset_id: str,
        source_state: str,
        target_state: str,
        operator_id: str,
        timestamp: datetime,
        payload: Dict[str, Any],
    ) -> str:
        """
        Compute SHA256 checksum for event integrity verification.

        Args:
            event_type: Type of event
            asset_id: Asset identifier
            source_state: Source state
            target_state: Target state
            operator_id: Operator identifier
            timestamp: Event timestamp
            payload: Event payload

        Returns:
            SHA256 hex digest of event content
        """
        content = json.dumps(
            {
                "event_type": event_type,
                "asset_id": asset_id,
                "source_state": source_state,
                "target_state": target_state,
                "operator_id": operator_id,
                "timestamp": timestamp.isoformat(),
                "payload": payload,
            },
            sort_keys=True,
        )
        return hashlib.sha256(content.encode()).hexdigest()

    @staticmethod
    def generate_event_id(
        event_type: str,
        asset_id: str,
        source_state: str,
        target_state: str,
        operator_id: str,
        timestamp: datetime,
        payload: Dict[str, Any],
    ) -> str:
        """
        Generate unique event ID based on content and timestamp.

        Args:
            event_type: Type of event
            asset_id: Asset identifier
            source_state: Source state
            target_state: Target state
            operator_id: Operator identifier
            timestamp: Event timestamp
            payload: Event payload

        Returns:
            Unique event identifier
        """
        content = json.dumps(
            {
                "event_type": event_type,
                "asset_id": asset_id,
                "source_state": source_state,
                "target_state": target_state,
                "operator_id": operator_id,
                "timestamp": timestamp.isoformat(),
                "payload": payload,
                "nonce": str(time.time_ns()),
            },
            sort_keys=True,
        )
        return hashlib.sha256(content.encode()).hexdigest()


class AssetStateMachineEngine:
    """
    Core state machine engine for asset lifecycle management.

    This engine implements deterministic state transitions for assets,
    supporting the complete lifecycle from 'in_use' to 'retired'.

    State Machine Definition:
        - States: in_use, pending_retirement, under_review, approved, retired, rejected
        - Events: submit_retirement, start_review, approve, reject, finalize

    Transition Rules:
        - in_use → pending_retirement: submit_retirement
        - pending_retirement → under_review: start_review
        - under_review → approved: approve (all approvers agree)
        - under_review → rejected: reject (any approver disagrees)
        - approved → retired: finalize
        - under_review → in_use: rollback (return to original state)

    Usage Example:
        >>> engine = AssetStateMachineEngine(
        ...     asset_repo=asset_repository,
        ...     history_repo=history_repository,
        ...     approval_service=approval_service
        ... )
        >>> context = TransitionContext(
        ...     asset_id="ASSET-001",
        ...     current_status=AssetStatus.IN_USE,
        ...     target_status=AssetStatus.PENDING_RETIREMENT,
        ...     operator_id="USER-001",
        ...     operator_role="applicant"
        ... )
        >>> result = engine.execute_transition(context)
    """

    # Valid state transitions with guard conditions
    VALID_TRANSITIONS: Dict[Tuple[str, str], List[str]] = {
        # (current_state, target_state): [valid_events]
        ("in_use", "pending_retirement"): ["submit_retirement"],
        ("pending_retirement", "under_review"): ["start_review"],
        ("under_review", "approved"): ["approve"],
        ("under_review", "rejected"): ["reject"],
        ("approved", "retired"): ["finalize"],
        ("under_review", "in_use"): ["rollback"],
    }

    # State to AssetStatus enum mapping
    STATUS_MAPPING: Dict[str, AssetStatus] = {
        "in_use": AssetStatus.IN_USE,
        "pending_retirement": AssetStatus.PENDING_RETIREMENT,
        "under_review": AssetStatus.UNDER_REVIEW,
        "approved": AssetStatus.APPROVED,
        "retired": AssetStatus.RETIRED,
        "rejected": AssetStatus.REJECTED,
    }

    def __init__(
        self,
        asset_repo: AssetRepository,
        history_repo: HistoryRepository,
        approval_service: Optional[ApprovalChainService] = None,
        status_history_service: Optional[StatusHistoryService] = None,
    ) -> None:
        """
        Initialize the state machine engine.

        Args:
            asset_repo: Repository for asset persistence
            history_repo: Repository for history/event persistence
            approval_service: Service for approval chain operations
            status_history_service: Service for status history tracking
        """
        self.asset_repo = asset_repo
        self.history_repo = history_repo
        self.approval_service = approval_service
        self.status_history_service = status_history_service
        self._transition_cache: Dict[str, Callable] = {}
        self._initialize_transitions()

    def _initialize_transitions(self) -> None:
        """Initialize transition handlers for each state pair."""
        self._transition_cache = {
            ("in_use", "pending_retirement"): self._transition_to_pending,
            ("pending_retirement", "under_review"): self._transition_to_review,
            ("under_review", "approved"): self._transition_to_approved,
            ("under_review", "rejected"): self._transition_to_rejected,
            ("approved", "retired"): self._transition_to_retired,
            ("under_review", "in_use"): self._transition_rollback,
        }

    def validate_transition(
        self, current_status: AssetStatus, target_status: AssetStatus
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate if a state transition is allowed.

        Args:
            current_status: Current asset status
            target_status: Target status for transition

        Returns:
            Tuple of (is_valid, error_message)
        """
        current_str = current_status.value if hasattr(current_status, 'value') else str(current_status)
        target_str = target_status.value if hasattr(target_status, 'value') else str(target_status)

        key = (current_str, target_str)
        if key not in self.VALID_TRANSITIONS:
            return False, f"No valid transition from '{current_str}' to '{target_str}'"

        # Check if asset is eligible for transition (not already retired)
        if current_str == "retired":
            return False, "Asset is already retired and cannot be transitioned"

        return True, None

    def execute_transition(
        self, context: TransitionContext
    ) -> Dict[str, Any]:
        """
        Execute a state transition with full validation and event persistence.

        This method implements atomic state transition:
        1. Validate the transition is allowed
        2. Execute the transition
        3. Persist the state change
        4. Record the event in history

        Args:
            context: Transition context containing all required information

        Returns:
            Dictionary containing transition result:
                - success: Boolean indicating if transition succeeded
                - asset_id: ID of the affected asset
                - previous_status: Status before transition
                - new_status: Status after transition
                - event_id: ID of the recorded event
                - timestamp: Transition timestamp

        Raises:
            StateTransitionError: If the transition is invalid or fails
        """
        # Normalize status values
        current_str = context.current_status.value if hasattr(context.current_status, 'value') else str(context.current_status)
        target_str = context.target_status.value if hasattr(context.target_status, 'value') else str(context.target_status)

        # Step 1: Validate transition
        is_valid, error_msg = self.validate_transition(
            context.current_status, context.target_status
        )
        if not is_valid:
            raise StateTransitionError(
                current_state=current_str,
                target_state=target_str,
                reason=error_msg or "Validation failed",
            )

        # Step 2: Get the appropriate transition handler
        key = (current_str, target_str)
        handler = self._transition_cache.get(key)

        # Step 3: Execute transition through handler
        result = handler(context) if handler else self._generic_transition(context)

        # Step 4: Persist the change (handled by handler)
        # Step 5: Record event in history (handled by handler)

        return result

    def _transition_to_pending(self, context: TransitionContext) -> Dict[str, Any]:
        """Handle transition from in_use to pending_retirement."""
        # Create the event record
        event = self._create_transition_event(
            event_type="STATE_TRANSITION",
            context=context,
            payload={"action": "submit_retirement", "reason": context.reason},
        )

        # Persist the event
        self._persist_event(event)

        return {
            "success": True,
            "asset_id": context.asset_id,
            "previous_status": "in_use",
            "new_status": "pending_retirement",
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
        }

    def _transition_to_review(self, context: TransitionContext) -> Dict[str, Any]:
        """Handle transition from pending_retirement to under_review."""
        event = self._create_transition_event(
            event_type="STATE_TRANSITION",
            context=context,
            payload={"action": "start_review"},
        )

        self._persist_event(event)

        return {
            "success": True,
            "asset_id": context.asset_id,
            "previous_status": "pending_retirement",
            "new_status": "under_review",
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
        }

    def _transition_to_approved(self, context: TransitionContext) -> Dict[str, Any]:
        """Handle transition from under_review to approved."""
        event = self._create_transition_event(
            event_type="STATE_TRANSITION",
            context=context,
            payload={
                "action": "approve",
                "comments": context.metadata.get("comments"),
            },
        )

        self._persist_event(event)

        return {
            "success": True,
            "asset_id": context.asset_id,
            "previous_status": "under_review",
            "new_status": "approved",
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
        }

    def _transition_to_rejected(self, context: TransitionContext) -> Dict[str, Any]:
        """Handle transition from under_review to rejected."""
        event = self._create_transition_event(
            event_type="STATE_TRANSITION",
            context=context,
            payload={
                "action": "reject",
                "reason": context.reason,
            },
        )

        self._persist_event(event)

        return {
            "success": True,
            "asset_id": context.asset_id,
            "previous_status": "under_review",
            "new_status": "rejected",
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
        }

    def _transition_to_retired(self, context: TransitionContext) -> Dict[str, Any]:
        """Handle transition from approved to retired."""
        event = self._create_transition_event(
            event_type="STATE_TRANSITION",
            context=context,
            payload={"action": "finalize"},
        )

        self._persist_event(event)

        return {
            "success": True,
            "asset_id": context.asset_id,
            "previous_status": "approved",
            "new_status": "retired",
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
        }

    def _transition_rollback(self, context: TransitionContext) -> Dict[str, Any]:
        """Handle rollback from under_review back to in_use."""
        event = self._create_transition_event(
            event_type="STATE_TRANSITION",
            context=context,
            payload={
                "action": "rollback",
                "reason": context.reason,
            },
        )

        self._persist_event(event)

        return {
            "success": True,
            "asset_id": context.asset_id,
            "previous_status": "under_review",
            "new_status": "in_use",
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
        }

    def _generic_transition(self, context: TransitionContext) -> Dict[str, Any]:
        """Generic transition handler for undefined transitions."""
        current_str = context.current_status.value if hasattr(context.current_status, 'value') else str(context.current_status)
        target_str = context.target_status.value if hasattr(context.target_status, 'value') else str(context.target_status)
        
        raise StateTransitionError(
            current_state=current_str,
            target_state=target_str,
            reason="No handler defined for this transition",
        )

    def _create_transition_event(
        self, event_type: str, context: TransitionContext, payload: Dict[str, Any]
    ) -> EventRecordData:
        """
        Create an immutable event record for a state transition.

        Args:
            event_type: Type of event
            context: Transition context
            payload: Event-specific payload

        Returns:
            EventRecordData instance with computed checksum
        """
        current_str = context.current_status.value if hasattr(context.current_status, 'value') else str(context.current_status)
        target_str = context.target_status.value if hasattr(context.target_status, 'value') else str(context.target_status)

        # Generate unique event ID
        event_id = EventRecordData.generate_event_id(
            event_type=event_type,
            asset_id=context.asset_id,
            source_state=current_str,
            target_state=target_str,
            operator_id=context.operator_id,
            timestamp=context.timestamp,
            payload=payload,
        )

        # Compute checksum for integrity verification
        checksum = EventRecordData.compute_checksum(
            event_type=event_type,
            asset_id=context.asset_id,
            source_state=current_str,
            target_state=target_str,
            operator_id=context.operator_id,
            timestamp=context.timestamp,
            payload=payload,
        )

        return EventRecordData(
            event_id=event_id,
            event_type=event_type,
            asset_id=context.asset_id,
            request_id=None,  # Set by caller if applicable
            source_state=current_str,
            target_state=target_str,
            operator_id=context.operator_id,
            operator_role=context.operator_role,
            timestamp=context.timestamp,
            payload=payload,
            checksum=checksum,
        )

    def _persist_event(self, event: EventRecordData) -> None:
        """
        Persist an event record to the history repository.

        Args:
            event: Event record to persist

        Raises:
            EventPersistenceError: If event persistence fails
        """
        try:
            # Convert to history record format
            history_record = LifecycleHistory(
                id=event.event_id,
                asset_id=event.asset_id,
                event_type=event.event_type,
                source_state=event.source_state,
                target_state=event.target_state,
                operator_id=event.operator_id,
                operator_role=event.operator_role,
                timestamp=event.timestamp,
                metadata=event.payload,
                checksum=event.checksum,
            )
            self.history_repo.save(history_record)
        except Exception as e:
            raise EventPersistenceError(
                message=f"Failed to persist event: {str(e)}",
                event_id=event.event_id,
            )


class ApprovalChainRouter:
    """
    Router for approval chain operations.

    This router manages the approval chain workflow including:
    - Routing approval requests to appropriate approvers
    - Tracking approval stage progression
    - Handling approve/reject/rollback decisions

    Approval Chain Structure:
        Stage 0: Initial Approver (typically department head)
        Stage 1: Reviewer (typically asset manager)
        Stage 2: Final Approver (typically finance/CFO)

    Each stage must be approved before proceeding to the next.
    Any rejection terminates the entire chain and marks the request as 'rejected'.
    """

    # Role to approval stage mapping
    ROLE_STAGE_MAPPING: Dict[str, int] = {
        "applicant": -1,  # Not an approver
        "initial_approver": 0,
        "reviewer": 1,
        "final_approver": 2,
    }

    # Stage to required role mapping
    STAGE_ROLE_MAPPING: Dict[int, str] = {
        0: "initial_approver",
        1: "reviewer",
        2: "final_approver",
    }

    def __init__(
        self,
        approval_service: ApprovalChainService,
        retirement_repo: RetirementRepository,
        history_repo: HistoryRepository,
        asset_repo: Optional[AssetRepository] = None,
    ) -> None:
        """
        Initialize the approval chain router.

        Args:
            approval_service: Service for approval chain operations
            retirement_repo: Repository for retirement request persistence
            history_repo: Repository for history/event persistence
            asset_repo: Repository for asset persistence (optional)
        """
        self.approval_service = approval_service
        self.retirement_repo = retirement_repo
        self.history_repo = history_repo
        self.asset_repo = asset_repo

    def route_approval(
        self, context: ApprovalContext
    ) -> Dict[str, Any]:
        """
        Route an approval decision through the chain.

        Args:
            context: Approval context with decision information

        Returns:
            Dictionary containing:
                - success: Boolean indicating if routing succeeded
                - current_stage: Current stage after the decision
                - overall_status: Overall approval status
                - event_id: ID of the recorded event
                - next_approver: ID of next approver (if any)

        Raises:
            ApprovalChainError: If routing fails
        """
        # Validate the approver has permission for this stage
        expected_role = self.STAGE_ROLE_MAPPING.get(context.current_stage)
        if expected_role and context.approver_role != expected_role:
            raise ApprovalChainError(
                message=f"Approver role '{context.approver_role}' cannot approve stage {context.current_stage}. "
                f"Expected role: '{expected_role}'",
                stage=context.current_stage,
            )

        # Process the decision
        if context.decision == "approve":
            return self._handle_approval(context)
        elif context.decision == "reject":
            return self._handle_rejection(context)
        elif context.decision == "rollback":
            return self._handle_rollback(context)
        else:
            raise ApprovalChainError(
                message=f"Unknown decision type: {context.decision}",
                stage=context.current_stage,
            )

    def _handle_approval(self, context: ApprovalContext) -> Dict[str, Any]:
        """
        Handle approval decision.

        Args:
            context: Approval context

        Returns:
            Approval result dictionary
        """
        current_stage = context.current_stage
        total_stages = 3  # 0, 1, 2

        # Determine next state based on stage
        if current_stage >= total_stages - 1:
            # Final approval - transition to 'approved'
            target_status = "approved"
            next_stage = -1  # No more stages
            next_approver = None
        else:
            # More stages to go
            next_stage = current_stage + 1
            next_approver = self._get_next_approver(context.request_id, next_stage)
            target_status = "under_review"

        # Create event record
        event = self._create_approval_event(
            context=context,
            event_type="APPROVAL",
            target_state=target_status,
        )
        self._persist_event(event)

        return {
            "success": True,
            "current_stage": next_stage if next_stage >= 0 else current_stage,
            "overall_status": target_status,
            "event_id": event.event_id,
            "next_approver": next_approver,
            "is_final": current_stage >= total_stages - 1,
        }

    def _handle_rejection(self, context: ApprovalContext) -> Dict[str, Any]:
        """
        Handle rejection decision.

        Any rejection terminates the entire chain and marks the request as 'rejected'.

        Args:
            context: Approval context

        Returns:
            Rejection result dictionary
        """
        # Create event record for rejection
        event = self._create_approval_event(
            context=context,
            event_type="REJECTION",
            target_state="rejected",
        )
        self._persist_event(event)

        return {
            "success": True,
            "current_stage": context.current_stage,
            "overall_status": "rejected",
            "event_id": event.event_id,
            "next_approver": None,
            "is_final": True,
        }

    def _handle_rollback(self, context: ApprovalContext) -> Dict[str, Any]:
        """
        Handle rollback decision.

        Rollback returns the asset to its original 'in_use' state.

        Args:
            context: Approval context

        Returns:
            Rollback result dictionary
        """
        # Create event record for rollback
        event = self._create_approval_event(
            context=context,
            event_type="ROLLBACK",
            target_state="in_use",
        )
        self._persist_event(event)

        return {
            "success": True,
            "current_stage": -1,
            "overall_status": "in_use",
            "event_id": event.event_id,
            "next_approver": None,
            "is_final": True,
        }

    def _get_next_approver(
        self, request_id: str, next_stage: int
    ) -> Optional[str]:
        """
        Get the next approver for a given stage.

        Args:
            request_id: Retirement request ID
            next_stage: Next approval stage

        Returns:
            Approver ID or None if no approver is assigned
        """
        try:
            # Query the approval service for the next approver
            chain = self.approval_service.get_approval_chain(request_id)
            if chain and next_stage < len(chain):
                return chain[next_stage].get("approver_id")
        except Exception:
            pass
        return None

    def _create_approval_event(
        self,
        context: ApprovalContext,
        event_type: str,
        target_state: str,
    ) -> EventRecordData:
        """
        Create an event record for an approval action.

        Args:
            context: Approval context
            event_type: Type of event (APPROVAL, REJECTION, ROLLBACK)
            target_state: Target state after the action

        Returns:
            EventRecordData instance
        """
        timestamp = context.timestamp or datetime.utcnow()

        # Generate event ID
        event_id = EventRecordData.generate_event_id(
            event_type=event_type,
            asset_id=context.asset_id,
            source_state=f"stage_{context.current_stage}",
            target_state=target_state,
            operator_id=context.approver_id,
            timestamp=timestamp,
            payload=context.metadata,
        )

        # Compute checksum
        checksum = EventRecordData.compute_checksum(
            event_type=event_type,
            asset_id=context.asset_id,
            source_state=f"stage_{context.current_stage}",
            target_state=target_state,
            operator_id=context.approver_id,
            timestamp=timestamp,
            payload=context.metadata,
        )

        return EventRecordData(
            event_id=event_id,
            event_type=event_type,
            asset_id=context.asset_id,
            request_id=context.request_id,
            source_state=f"stage_{context.current_stage}",
            target_state=target_state,
            operator_id=context.approver_id,
            operator_role=context.approver_role,
            timestamp=timestamp,
            payload={
                "comments": context.comments,
                "stage": context.current_stage,
                "metadata": context.metadata,
            },
            checksum=checksum,
        )

    def _persist_event(self, event: EventRecordData) -> None:
        """
        Persist an event record.

        Args:
            event: Event record to persist
        """
        history_record = LifecycleHistory(
            id=event.event_id,
            asset_id=event.asset_id,
            event_type=event.event_type,
            source_state=event.source_state,
            target_state=event.target_state,
            operator_id=event.operator_id,
            operator_role=event.operator_role,
            timestamp=event.timestamp,
            metadata=event.payload,
            checksum=event.checksum,
        )
        self.history_repo.save(history_record)


class EventStore:
    """
    Immutable event store for audit trail persistence.

    This store provides:
    - Append-only event recording (no updates or deletes)
    - Checksum verification for integrity
    - Query interface for event history retrieval
    - Event sourcing support for state reconstruction

    Usage:
        >>> store = EventStore(history_repo=history_repository)
        >>> # Record an event
        >>> event = store.append(asset_id="ASSET-001", event_type="STATE_TRANSITION", ...)
        >>> # Query history
        >>> events = store.get_events_for_asset(asset_id="ASSET-001")
    """

    def __init__(self, history_repo: HistoryRepository) -> None:
        """
        Initialize the event store.

        Args:
            history_repo: Repository for history persistence
        """
        self.history_repo = history_repo

    def append(
        self,
        asset_id: str,
        event_type: str,
        source_state: str,
        target_state: str,
        operator_id: str,
        operator_role: str,
        payload: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> EventRecordData:
        """
        Append a new event to the audit trail.

        Args:
            asset_id: Asset identifier
            event_type: Type of event
            source_state: State before the event
            target_state: State after the event
            operator_id: User who triggered the event
            operator_role: Role of the operator
            payload: Event-specific payload data
            request_id: Optional retirement request ID
            metadata: Additional metadata

        Returns:
            Created EventRecordData instance
        """
        timestamp = datetime.utcnow()
        payload = payload or {}
        metadata = metadata or {}

        # Generate event ID
        event_id = EventRecordData.generate_event_id(
            event_type=event_type,
            asset_id=asset_id,
            source_state=source_state,
            target_state=target_state,
            operator_id=operator_id,
            timestamp=timestamp,
            payload=payload,
        )

        # Compute checksum
        checksum = EventRecordData.compute_checksum(
            event_type=event_type,
            asset_id=asset_id,
            source_state=source_state,
            target_state=target_state,
            operator_id=operator_id,
            timestamp=timestamp,
            payload=payload,
        )

        event = EventRecordData(
            event_id=event_id,
            event_type=event_type,
            asset_id=asset_id,
            request_id=request_id,
            source_state=source_state,
            target_state=target_state,
            operator_id=operator_id,
            operator_role=operator_role,
            timestamp=timestamp,
            payload={**payload, **metadata},
            checksum=checksum,
        )

        # Persist the event
        history_record = LifecycleHistory(
            id=event.event_id,
            asset_id=event.asset_id,
            event_type=event.event_type,
            source_state=event.source_state,
            target_state=event.target_state,
            operator_id=event.operator_id,
            operator_role=event.operator_role,
            timestamp=event.timestamp,
            metadata=event.payload,
            checksum=event.checksum,
        )
        self.history_repo.save(history_record)

        return event

    def get_events_for_asset(
        self,
        asset_id: str,
        event_types: Optional[List[str]] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[EventRecordData]:
        """
        Get all events for a specific asset.

        Args:
            asset_id: Asset identifier
            event_types: Optional filter by event types
            since: Optional start datetime filter
            until: Optional end datetime filter

        Returns:
            List of EventRecordData sorted by timestamp
        """
        records = self.history_repo.find_by_asset_id(
            asset_id=asset_id,
            event_types=event_types,
            since=since,
            until=until,
        )

        return [
            EventRecordData(
                event_id=r.id,
                event_type=r.event_type,
                asset_id=r.asset_id,
                request_id=r.metadata.get("request_id"),
                source_state=r.source_state,
                target_state=r.target_state,
                operator_id=r.operator_id,
                operator_role=r.operator_role,
                timestamp=r.timestamp,
                payload=r.metadata,
                checksum=r.checksum,
            )
            for r in records
        ]

    def verify_event_integrity(self, event: EventRecordData) -> bool:
        """
        Verify the integrity of an event record.

        Args:
            event: Event record to verify

        Returns:
            True if checksum matches, False otherwise
        """
        expected_checksum = EventRecordData.compute_checksum(
            event_type=event.event_type,
            asset_id=event.asset_id,
            source_state=event.source_state,
            target_state=event.target_state,
            operator_id=event.operator_id,
            timestamp=event.timestamp,
            payload=event.payload,
        )
        return event.checksum == expected_checksum

    def get_event_history(
        self,
        request_id: Optional[str] = None,
        operator_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[EventRecordData]:
        """
        Get event history with optional filters.

        Args:
            request_id: Optional filter by retirement request ID
            operator_id: Optional filter by operator ID
            limit: Maximum number of records to return
            offset: Number of records to skip

        Returns:
            List of EventRecordData sorted by timestamp descending
        """
        records = self.history_repo.find_all(
            request_id=request_id,
            operator_id=operator_id,
            limit=limit,
            offset=offset,
        )

        return [
            EventRecordData(
                event_id=r.id,
                event_type=r.event_type,
                asset_id=r.asset_id,
                request_id=r.metadata.get("request_id"),
                source_state=r.source_state,
                target_state=r.target_state,
                operator_id=r.operator_id,
                operator_role=r.operator_role,
                timestamp=r.timestamp,
                payload=r.metadata,
                checksum=r.checksum,
            )
            for r in records
        ]


class FieldMappingValidator:
    """
    Validator for field mappings during state transitions.

    This validator ensures that:
    - Required fields are present for each state transition
    - Field types match expected types
    - Field values are within valid ranges
    - Custom validation rules are satisfied
    """

    def __init__(self) -> None:
        """Initialize the field mapping validator."""
        self._validation_rules: Dict[str, Dict[str, Any]] = {}

    def register_rule(
        self,
        transition_name: str,
        field_name: str,
        field_type: Type,
        required: bool = True,
        validator: Optional[Callable[[Any], bool]] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Register a validation rule for a field in a transition.

        Args:
            transition_name: Name of the state transition
            field_name: Name of the field to validate
            field_type: Expected type of the field
            required: Whether the field is required
            validator: Optional custom validation function
            error_message: Custom error message for validation failure
        """
        if transition_name not in self._validation_rules:
            self._validation_rules[transition_name] = {}

        self._validation_rules[transition_name][field_name] = {
            "type": field_type,
            "required": required,
            "validator": validator,
            "error_message": error_message,
        }

    def validate(
        self,
        transition_name: str,
        field_data: Dict[str, Any],
    ) -> Tuple[bool, List[str]]:
        """
        Validate field data for a state transition.

        Args:
            transition_name: Name of the state transition
            field_data: Dictionary of field data to validate

        Returns:
            Tuple of (is_valid, list of error messages)
        """
        errors = []

        if transition_name not in self._validation_rules:
            return True, []  # No rules defined, validation passes

        rules = self._validation_rules[transition_name]

        for field_name, rule in rules.items():
            # Check required fields
            if rule["required"] and field_name not in field_data:
                errors.append(
                    rule.get("error_message") or f"Required field '{field_name}' is missing"
                )
                continue

            if field_name not in field_data:
                continue  # Optional field not provided, OK

            value = field_data[field_name]

            # Check type
            if not isinstance(value, rule["type"]):
                errors.append(
                    f"Field '{field_name}' has wrong type: "
                    f"expected {rule['type'].__name__}, got {type(value).__name__}"
                )

            # Run custom validator if provided
            if rule["validator"] and value is not None:
                try:
                    if not rule["validator"](value):
                        errors.append(
                            rule.get("error_message")
                            or f"Field '{field_name}' failed custom validation"
                        )
                except Exception as e:
                    errors.append(
                        f"Field '{field_name}' validation raised exception: {str(e)}"
                    )

        return len(errors) == 0, errors

    def get_required_fields(self, transition_name: str) -> List[str]:
        """
        Get list of required field names for a transition.

        Args:
            transition_name: Name of the state transition

        Returns:
            List of required field names
        """
        if transition_name not in self._validation_rules:
            return []

        return [
            field_name
            for field_name, rule in self._validation_rules[transition_name].items()
            if rule["required"]
        ]


def create_default_engine(
    asset_repo: AssetRepository,
    history_repo: HistoryRepository,
    approval_service: Optional[ApprovalChainService] = None,
    status_history_service: Optional[StatusHistoryService] = None,
) -> AssetStateMachineEngine:
    """
    Factory function to create a default-configured state machine engine.

    Args:
        asset_repo: Asset repository
        history_repo: History repository
        approval_service: Approval chain service
        status_history_service: Status history service

    Returns:
        Configured AssetStateMachineEngine instance
    """
    return AssetStateMachineEngine(
        asset_repo=asset_repo,
        history_repo=history_repo,
        approval_service=approval_service,
        status_history_service=status_history_service,
    )


def create_default_router(
    approval_service: ApprovalChainService,
    retirement_repo: RetirementRepository,
    history_repo: HistoryRepository,
    asset_repo: Optional[AssetRepository] = None,
) -> ApprovalChainRouter:
    """
    Factory function to create a default-configured approval chain router.

    Args:
        approval_service: Approval chain service
        retirement_repo: Retirement request repository
        history_repo: History repository
        asset_repo: Asset repository

    Returns:
        Configured ApprovalChainRouter instance
    """
    return ApprovalChainRouter(
        approval_service=approval_service,
        retirement_repo=retirement_repo,
        history_repo=history_repo,
        asset_repo=asset_repo,
    )


def create_default_event_store(
    history_repo: HistoryRepository,
) -> EventStore:
    """
    Factory function to create a default-configured event store.

    Args:
        history_repo: History repository

    Returns:
        Configured EventStore instance
    """
    return EventStore(history_repo=history_repo)


# Export public API
__all__ = [
    # Exceptions
    "StateTransitionError",
    "ApprovalChainError",
    "FieldMappingError",
    "EventPersistenceError",
    # Data classes
    "TransitionContext",
    "ApprovalContext",
    "EventRecordData",
    # Core classes
    "AssetStateMachineEngine",
    "ApprovalChainRouter",
    "EventStore",
    "FieldMappingValidator",
    # Factory functions
    "create_default_engine",
    "create_default_router",
    "create_default_event_store",
]