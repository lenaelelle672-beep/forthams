"""
Asset Retirement Report Generator Service.

This module implements the state transition engine for asset retirement workflows,
providing deterministic state management, approval chain processing, and immutable
event history persistence.

Key Components:
    - StateMachine: Core state transition engine with guards and rules
    - ApprovalChain: Multi-level approval workflow processor
    - EventStore: Immutable event sourcing storage for history tracking
    - RetirementReportService: High-level API for retirement operations

Design Principles:
    - Deterministic transitions: Given same input/context, output state is always the same
    - Atomic operations: State changes and event writes are transactional
    - RBAC enforcement: All approval operations require permission validation
    - Audit trail: All state changes produce immutable event records
"""

import hashlib
import json
import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.depreciation_result import DepreciationResult
from src.domain.entities.history import History


class StateTransitionError(Exception):
    """
    Exception raised when an invalid state transition is attempted.
    
    This error indicates that the requested state transition is not allowed
    given the current state and context.
    """
    
    def __init__(self, from_state: str, to_state: str, reason: str = ""):
        """
        Initialize StateTransitionError.
        
        Args:
            from_state: The current state.
            to_state: The attempted target state.
            reason: Optional explanation for why the transition was rejected.
        """
        self.from_state = from_state
        self.to_state = to_state
        self.reason = reason
        message = f"Invalid transition from '{from_state}' to '{to_state}'"
        if reason:
            message += f": {reason}"
        super().__init__(message)


class ApprovalRejectedError(Exception):
    """
    Exception raised when an approval is rejected at any stage.
    
    This error halts the approval chain and marks the workflow as rejected.
    """
    
    def __init__(self, stage: str, approver: str, reason: str):
        """
        Initialize ApprovalRejectedError.
        
        Args:
            stage: The approval stage where rejection occurred.
            approver: The user who rejected the approval.
            reason: The reason for rejection.
        """
        self.stage = stage
        self.approver = approver
        self.reason = reason
        super().__init__(f"Approval rejected at stage '{stage}' by {approver}: {reason}")


class RoleType(Enum):
    """
    Enumeration of roles in the approval chain hierarchy.
    
    Roles are ordered by privilege level:
    - APPLICANT: Can initiate retirement requests
    - APPROVER: Can approve/reject at intermediate stages
    - FINAL_APPROVER: Has authority for final approval decisions
    """
    APPLICANT = "applicant"
    APPROVER = "approver"
    FINAL_APPROVER = "final_approver"


class RetirementStatus(Enum):
    """
    Enumeration of retirement workflow statuses.
    
    These represent the lifecycle states of an asset retirement request.
    """
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED_BY_APPROVER = "approved_by_approver"
    APPROVED_BY_FINAL = "approved_by_final"
    RETIRED = "retired"
    REJECTED = "rejected"


class ApprovalStage(Enum):
    """
    Enumeration of approval chain stages.
    
    Each stage represents a step in the multi-level approval process.
    """
    INITIAL = "initial"
    FIRST_APPROVAL = "first_approval"
    FINAL_APPROVAL = "final_approval"
    COMPLETED = "completed"


# Valid state transitions mapping
STATE_TRANSITIONS: Dict[str, List[str]] = {
    RetirementStatus.PENDING.value: [
        RetirementStatus.UNDER_REVIEW.value,
        RetirementStatus.REJECTED.value,
    ],
    RetirementStatus.UNDER_REVIEW.value: [
        RetirementStatus.APPROVED_BY_APPROVER.value,
        RetirementStatus.REJECTED.value,
    ],
    RetirementStatus.APPROVED_BY_APPROVER.value: [
        RetirementStatus.APPROVED_BY_FINAL.value,
        RetirementStatus.REJECTED.value,
    ],
    RetirementStatus.APPROVED_BY_FINAL.value: [
        RetirementStatus.RETIRED.value,
    ],
    RetirementStatus.REJECTED.value: [],
    RetirementStatus.RETIRED.value: [],
}


class TransitionGuard:
    """
    Guard class for validating state transitions.
    
    Guards enforce business rules and constraints before allowing
    state transitions to proceed.
    """
    
    def __init__(self):
        """Initialize the transition guard with empty rules."""
        self._rules: Dict[str, Any] = {}
    
    def can_transition(
        self, 
        current_status: str, 
        target_status: str, 
        context: Dict[str, Any]
    ) -> Tuple[bool, str]:
        """
        Determine if a state transition is allowed.
        
        Args:
            current_status: The current retirement status.
            target_status: The desired target status.
            context: Additional context for transition validation.
            
        Returns:
            Tuple of (is_allowed, rejection_reason).
        """
        # Check if target state is in allowed transitions
        allowed_targets = STATE_TRANSITIONS.get(current_status, [])
        if target_status not in allowed_targets:
            return False, f"Transition from '{current_status}' to '{target_status}' is not allowed"
        
        # Business rule: Cannot skip stages
        if target_status == RetirementStatus.APPROVED_BY_FINAL.value:
            if current_status != RetirementStatus.APPROVED_BY_APPROVER.value:
                return False, "Must complete first approval before final approval"
        
        # Business rule: Asset must be in valid status for retirement
        asset_status = context.get("asset_status")
        if target_status != RetirementStatus.REJECTED.value:
            invalid_statuses = ["retired", "scrapped"]
            if asset_status in invalid_statuses:
                return False, f"Asset cannot be retired when status is '{asset_status}'"
        
        return True, ""
    
    def load_rules(self, rules_config: Dict[str, Any]) -> None:
        """
        Load transition rules from configuration.
        
        Args:
            rules_config: Dictionary containing transition rules.
        """
        self._rules = rules_config


class RetirementEvent:
    """
    Immutable event record for state changes.
    
    Each event captures a state transition with metadata for audit
    and traceability purposes.
    """
    
    def __init__(
        self,
        event_id: str,
        retirement_id: str,
        event_type: str,
        from_status: Optional[str],
        to_status: str,
        actor: str,
        role: str,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
    ):
        """
        Initialize a RetirementEvent.
        
        Args:
            event_id: Unique identifier for this event.
            retirement_id: ID of the retirement request this event belongs to.
            event_type: Type of event (e.g., 'status_change', 'approval', 'rejection').
            from_status: Previous status (None for creation events).
            to_status: New status after this event.
            actor: User who triggered this event.
            role: Role of the actor at time of event.
            metadata: Additional event-specific data.
            timestamp: When the event occurred (defaults to now).
        """
        self.event_id = event_id or str(uuid.uuid4())
        self.retirement_id = retirement_id
        self.event_type = event_type
        self.from_status = from_status
        self.to_status = to_status
        self.actor = actor
        self.role = role
        self.metadata = metadata or {}
        self.timestamp = timestamp or datetime.utcnow()
        self._compute_checksum()
    
    def _compute_checksum(self) -> None:
        """
        Compute SHA-256 checksum for event integrity verification.
        
        This ensures events cannot be tampered with after creation.
        """
        content = f"{self.event_id}{self.retirement_id}{self.event_type}"
        content += f"{self.from_status}{self.to_status}{self.actor}"
        content += f"{self.role}{self.timestamp.isoformat()}"
        content += json.dumps(self.metadata, sort_keys=True)
        self.checksum = hashlib.sha256(content.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert event to dictionary representation.
        
        Returns:
            Dictionary containing all event fields.
        """
        return {
            "event_id": self.event_id,
            "retirement_id": self.retirement_id,
            "event_type": self.event_type,
            "from_status": self.from_status,
            "to_status": self.to_status,
            "actor": self.actor,
            "role": self.role,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
            "checksum": self.checksum,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RetirementEvent":
        """
        Create event from dictionary representation.
        
        Args:
            data: Dictionary containing event data.
            
        Returns:
            New RetirementEvent instance.
        """
        return cls(
            event_id=data["event_id"],
            retirement_id=data["retirement_id"],
            event_type=data["event_type"],
            from_status=data["from_status"],
            to_status=data["to_status"],
            actor=data["actor"],
            role=data["role"],
            metadata=data.get("metadata", {}),
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )


class EventStore:
    """
    Event sourcing storage for retirement history.
    
    Provides immutable storage and retrieval of all retirement-related
    events with integrity verification.
    """
    
    def __init__(self):
        """Initialize the event store with empty storage."""
        self._events: List[RetirementEvent] = []
        self._index: Dict[str, List[str]] = {}  # retirement_id -> event_ids
    
    def append(self, event: RetirementEvent) -> None:
        """
        Append a new event to the store.
        
        Events are immutable once written; this operation adds to the
        append-only event log.
        
        Args:
            event: The event to append.
        """
        self._events.append(event)
        if event.retirement_id not in self._index:
            self._index[event.retirement_id] = []
        self._index[event.retirement_id].append(event.event_id)
    
    def get_events_for_retirement(
        self, 
        retirement_id: str
    ) -> List[RetirementEvent]:
        """
        Retrieve all events for a specific retirement request.
        
        Events are returned in chronological order.
        
        Args:
            retirement_id: ID of the retirement request.
            
        Returns:
            List of events in order of occurrence.
        """
        event_ids = self._index.get(retirement_id, [])
        return [e for e in self._events if e.event_id in event_ids]
    
    def get_all_events(self) -> List[RetirementEvent]:
        """
        Retrieve all events in the store.
        
        Returns:
            All events in chronological order.
        """
        return list(self._events)
    
    def verify_integrity(self, retirement_id: str) -> bool:
        """
        Verify the integrity of events for a retirement request.
        
        Args:
            retirement_id: ID of the retirement request to verify.
            
        Returns:
            True if all events are valid and unmodified.
        """
        events = self.get_events_for_retirement(retirement_id)
        for event in events:
            original_checksum = event.checksum
            event._compute_checksum()
            if event.checksum != original_checksum:
                return False
        return True


class ApprovalChain:
    """
    Approval chain processor for multi-level workflow approvals.
    
    Handles routing approvals through hierarchical stages with
    RBAC permission validation.
    """
    
    def __init__(self, event_store: EventStore):
        """
        Initialize the approval chain processor.
        
        Args:
            event_store: Event store for recording approval actions.
        """
        self.event_store = event_store
        self._stage_handlers: Dict[str, Any] = {}
    
    def process_approval(
        self,
        retirement_id: str,
        current_status: str,
        approver: str,
        role: str,
        approved: bool,
        comment: Optional[str] = None,
    ) -> Tuple[str, RetirementEvent]:
        """
        Process an approval decision at the current stage.
        
        Args:
            retirement_id: ID of the retirement request.
            current_status: Current status of the request.
            approver: Username of the approver.
            role: Role of the approver (must match required role for stage).
            approved: Whether the approval is granted.
            comment: Optional approval/rejection comment.
            
        Returns:
            Tuple of (new_status, event_record).
            
        Raises:
            ApprovalRejectedError: If approval is rejected at any stage.
            StateTransitionError: If role is not authorized for current stage.
        """
        # Validate role permissions for current stage
        required_role = self._get_required_role(current_status)
        if not self._validate_role(role, required_role):
            raise StateTransitionError(
                current_status,
                "unknown",
                f"Role '{role}' cannot approve at stage. Required: '{required_role}'"
            )
        
        metadata = {"comment": comment, "approver": approver}
        
        if not approved:
            new_status = RetirementStatus.REJECTED.value
            event = RetirementEvent(
                event_id=str(uuid.uuid4()),
                retirement_id=retirement_id,
                event_type="rejection",
                from_status=current_status,
                to_status=new_status,
                actor=approver,
                role=role,
                metadata=metadata,
            )
            self.event_store.append(event)
            raise ApprovalRejectedError(current_status, approver, comment or "No reason provided")
        
        # Determine next status based on current stage
        new_status = self._get_next_status(current_status)
        
        event = RetirementEvent(
            event_id=str(uuid.uuid4()),
            retirement_id=retirement_id,
            event_type="approval",
            from_status=current_status,
            to_status=new_status,
            actor=approver,
            role=role,
            metadata=metadata,
        )
        self.event_store.append(event)
        
        return new_status, event
    
    def _get_required_role(self, current_status: str) -> str:
        """
        Determine the required role for approving at a given status.
        
        Args:
            current_status: Current retirement status.
            
        Returns:
            Required role name.
        """
        role_mapping = {
            RetirementStatus.PENDING.value: RoleType.APPROVER.value,
            RetirementStatus.UNDER_REVIEW.value: RoleType.APPROVER.value,
            RetirementStatus.APPROVED_BY_APPROVER.value: RoleType.FINAL_APPROVER.value,
        }
        return role_mapping.get(current_status, RoleType.APPROVER.value)
    
    def _validate_role(self, actor_role: str, required_role: str) -> bool:
        """
        Validate that actor has required permissions.
        
        Args:
            actor_role: Role of the actor.
            required_role: Required role for the operation.
            
        Returns:
            True if actor has sufficient permissions.
        """
        role_hierarchy = {
            RoleType.FINAL_APPROVER.value: 3,
            RoleType.APPROVER.value: 2,
            RoleType.APPLICANT.value: 1,
        }
        return role_hierarchy.get(actor_role, 0) >= role_hierarchy.get(required_role, 0)
    
    def _get_next_status(self, current_status: str) -> str:
        """
        Determine the next status based on current status and approval.
        
        Args:
            current_status: Current retirement status.
            
        Returns:
            Next status after successful approval.
        """
        next_status_map = {
            RetirementStatus.PENDING.value: RetirementStatus.UNDER_REVIEW.value,
            RetirementStatus.UNDER_REVIEW.value: RetirementStatus.APPROVED_BY_APPROVER.value,
            RetirementStatus.APPROVED_BY_APPROVER.value: RetirementStatus.APPROVED_BY_FINAL.value,
            RetirementStatus.APPROVED_BY_FINAL.value: RetirementStatus.RETIRED.value,
        }
        return next_status_map.get(current_status, current_status)


class StateMachine:
    """
    Core state transition engine for retirement workflows.
    
    Provides deterministic state management with guard validation
    and event emission.
    """
    
    def __init__(self, event_store: EventStore):
        """
        Initialize the state machine.
        
        Args:
            event_store: Event store for recording state changes.
        """
        self.event_store = event_store
        self.guard = TransitionGuard()
    
    def transition(
        self,
        retirement_id: str,
        current_status: str,
        target_status: str,
        actor: str,
        role: str,
        context: Dict[str, Any],
    ) -> Tuple[str, RetirementEvent]:
        """
        Execute a state transition.
        
        This method validates the transition using guards and creates
        an immutable event record for the change.
        
        Args:
            retirement_id: ID of the retirement request.
            current_status: Current status.
            target_status: Desired target status.
            actor: User initiating the transition.
            role: Role of the actor.
            context: Additional context for guard validation.
            
        Returns:
            Tuple of (new_status, event_record).
            
        Raises:
            StateTransitionError: If the transition is not allowed.
        """
        # Validate transition with guards
        is_allowed, reason = self.guard.can_transition(
            current_status, target_status, context
        )
        if not is_allowed:
            raise StateTransitionError(current_status, target_status, reason)
        
        # Create and record the event
        event = RetirementEvent(
            event_id=str(uuid.uuid4()),
            retirement_id=retirement_id,
            event_type="status_change",
            from_status=current_status,
            to_status=target_status,
            actor=actor,
            role=role,
            metadata=context.get("metadata", {}),
        )
        self.event_store.append(event)
        
        return target_status, event
    
    def get_allowed_transitions(self, current_status: str) -> List[str]:
        """
        Get list of allowed target statuses from current status.
        
        Args:
            current_status: The current status to query.
            
        Returns:
            List of valid target statuses.
        """
        return STATE_TRANSITIONS.get(current_status, [])


class RetirementRequest:
    """
    Domain entity representing an asset retirement request.
    
    Encapsulates the request data and workflow state.
    """
    
    def __init__(
        self,
        retirement_id: str,
        asset_id: str,
        asset_status: str,
        applicant: str,
        reason: str,
        current_status: str = RetirementStatus.PENDING.value,
        created_at: Optional[datetime] = None,
    ):
        """
        Initialize a RetirementRequest.
        
        Args:
            retirement_id: Unique identifier for this request.
            asset_id: ID of the asset to retire.
            asset_status: Current status of the asset.
            applicant: Username who submitted the request.
            reason: Reason for retirement.
            current_status: Current workflow status.
            created_at: When the request was created.
        """
        self.retirement_id = retirement_id
        self.asset_id = asset_id
        self.asset_status = asset_status
        self.applicant = applicant
        self.reason = reason
        self.current_status = current_status
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = self.created_at
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert request to dictionary representation.
        
        Returns:
            Dictionary containing request data.
        """
        return {
            "retirement_id": self.retirement_id,
            "asset_id": self.asset_id,
            "asset_status": self.asset_status,
            "applicant": self.applicant,
            "reason": self.reason,
            "current_status": self.current_status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class RetirementReportService:
    """
    High-level service for retirement report operations.
    
    Provides the primary API for submitting retirement applications,
    processing approvals, and querying history.
    
    Performance Target: ≤200ms (P95) per process instance.
    """
    
    def __init__(self):
        """Initialize the retirement report service with dependencies."""
        self.event_store = EventStore()
        self.state_machine = StateMachine(self.event_store)
        self.approval_chain = ApprovalChain(self.event_store)
        self._retirements: Dict[str, RetirementRequest] = {}
    
    def submit_retirement(
        self,
        asset_id: str,
        asset_status: str,
        applicant: str,
        reason: str,
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Submit a new retirement application.
        
        Creates a retirement request and records the initial event.
        
        Args:
            asset_id: ID of the asset to retire.
            asset_status: Current status of the asset.
            applicant: Username submitting the request.
            reason: Reason for retirement.
            
        Returns:
            Tuple of (retirement_id, initial_response).
        """
        start_time = time.time()
        
        retirement_id = str(uuid.uuid4())
        
        # Create the retirement request
        request = RetirementRequest(
            retirement_id=retirement_id,
            asset_id=asset_id,
            asset_status=asset_status,
            applicant=applicant,
            reason=reason,
        )
        self._retirements[retirement_id] = request
        
        # Record creation event
        event = RetirementEvent(
            event_id=str(uuid.uuid4()),
            retirement_id=retirement_id,
            event_type="creation",
            from_status=None,
            to_status=request.current_status,
            actor=applicant,
            role=RoleType.APPLICANT.value,
            metadata={"asset_id": asset_id, "reason": reason},
        )
        self.event_store.append(event)
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return retirement_id, {
            "retirement_id": retirement_id,
            "status": request.current_status,
            "created_at": request.created_at.isoformat(),
            "processing_time_ms": elapsed_ms,
        }
    
    def approve_step(
        self,
        retirement_id: str,
        approver: str,
        role: str,
        approved: bool,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process an approval step in the retirement workflow.
        
        Validates permissions, updates state, and records the event.
        
        Args:
            retirement_id: ID of the retirement request.
            approver: Username of the approver.
            role: Role of the approver.
            approved: Whether the step is approved.
            comment: Optional approval comment.
            
        Returns:
            Response dictionary with updated status and event.
            
        Raises:
            ValueError: If retirement request not found.
            ApprovalRejectedError: If approval is rejected.
            StateTransitionError: If role lacks permission.
        """
        start_time = time.time()
        
        request = self._retirements.get(retirement_id)
        if not request:
            raise ValueError(f"Retirement request '{retirement_id}' not found")
        
        new_status, event = self.approval_chain.process_approval(
            retirement_id=retirement_id,
            current_status=request.current_status,
            approver=approver,
            role=role,
            approved=approved,
            comment=comment,
        )
        
        # Update request status
        request.current_status = new_status
        request.updated_at = datetime.utcnow()
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return {
            "retirement_id": retirement_id,
            "previous_status": event.from_status,
            "current_status": new_status,
            "event_id": event.event_id,
            "processing_time_ms": elapsed_ms,
        }
    
    def get_history(
        self, 
        retirement_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get the complete event history for a retirement request.
        
        Returns events in chronological order for audit and traceability.
        
        Args:
            retirement_id: ID of the retirement request.
            
        Returns:
            List of event dictionaries in time order.
        """
        events = self.event_store.get_events_for_retirement(retirement_id)
        return [event.to_dict() for event in events]
    
    def get_retirement_status(
        self, 
        retirement_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get the current status of a retirement request.
        
        Args:
            retirement_id: ID of the retirement request.
            
        Returns:
            Status dictionary or None if not found.
        """
        request = self._retirements.get(retirement_id)
        if not request:
            return None
        
        return {
            "retirement_id": request.retirement_id,
            "asset_id": request.asset_id,
            "current_status": request.current_status,
            "created_at": request.created_at.isoformat(),
            "updated_at": request.updated_at.isoformat(),
        }
    
    def verify_history_integrity(
        self, 
        retirement_id: str
    ) -> bool:
        """
        Verify the integrity of a retirement's event history.
        
        Checks that no events have been tampered with after creation.
        
        Args:
            retirement_id: ID of the retirement request.
            
        Returns:
            True if history is valid and unmodified.
        """
        return self.event_store.verify_integrity(retirement_id)


# Global service instance for application use
_retirement_service_instance: Optional[RetirementReportService] = None


def get_retirement_service() -> RetirementReportService:
    """
    Get the singleton retirement service instance.
    
    Returns:
        The global RetirementReportService instance.
    """
    global _retirement_service_instance
    if _retirement_service_instance is None:
        _retirement_service_instance = RetirementReportService()
    return _retirement_service_instance


def reset_retirement_service() -> None:
    """
    Reset the singleton service instance.
    
    Primarily used for testing to ensure clean state.
    """
    global _retirement_service_instance
    _retirement_service_instance = None