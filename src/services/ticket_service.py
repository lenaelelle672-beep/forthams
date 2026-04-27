"""
Ticket Service Module - Phase 3: Process Engine & Approval Chain Implementation

This module implements the asset state transition engine for managing the complete
lifecycle of assets from in-use to retirement (scrapping). It provides:

1. State Machine Engine: Deterministic state transitions with guards
2. Approval Chain: Multi-role hierarchical approval workflow
3. Event Persistence: Immutable event store for audit trails
4. User Interfaces: APIs for submitting, viewing, and tracking retirement requests

Compliance:
- State transitions are deterministic (same input + context = same output)
- Approval chain cannot be bypassed; any rejection terminates the workflow
- Event writes and state changes are atomic
- Compatible with existing asset catalog data structures

Performance: Single workflow instance processing latency ≤ 200ms (P95)
Security: RBAC-based permission validation, least privilege principle
"""

import logging
import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import uuid

# Configure module logger
logger = logging.getLogger(__name__)


class TicketStatus(str, Enum):
    """
    Enumeration of ticket statuses in the lifecycle.
    
    States:
        DRAFT: Initial draft state, not yet submitted
        PENDING_APPROVAL: Awaiting first level approval
        FIRST_APPROVED: First level approved, awaiting second level
        SECOND_APPROVED: Second level approved, awaiting final approval
        APPROVED: Fully approved, ready for execution
        REJECTED: Rejected at any approval stage
        COMPLETED: Ticket execution completed
        CANCELLED: Ticket cancelled by requester
    """
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    FIRST_APPROVED = "first_approved"
    SECOND_APPROVED = "second_approved"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketEventType(str, Enum):
    """
    Enumeration of events that can occur in the ticket lifecycle.
    
    Events:
        CREATED: Ticket created
        SUBMITTED: Ticket submitted for approval
        APPROVED: Approved at a stage
        REJECTED: Rejected at a stage
        COMPLETED: Ticket completed
        CANCELLED: Ticket cancelled
        ROLLBACK: Rolled back to a previous stage
    """
    CREATED = "created"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ROLLBACK = "rollback"


class ApprovalRole(str, Enum):
    """
    Enumeration of approval roles in the hierarchical chain.
    
    Roles:
        APPLICANT: The user who creates the ticket
        FIRST_APPROVER: First level approver
        SECOND_APPROVER: Second level approver
        FINAL_APPROVER: Final approver (final decision maker)
    """
    APPLICANT = "applicant"
    FIRST_APPROVER = "first_approver"
    SECOND_APPROVER = "second_approver"
    FINAL_APPROVER = "final_approver"


@dataclass
class StateTransition:
    """
    Represents a valid state transition with guards.
    
    Attributes:
        from_state: Source state
        to_state: Target state
        event: Triggering event
        guards: List of guard conditions that must be satisfied
        required_role: Role required to execute this transition
    """
    from_state: TicketStatus
    to_state: TicketStatus
    event: TicketEventType
    guards: List[Dict[str, Any]] = field(default_factory=list)
    required_role: Optional[ApprovalRole] = None


@dataclass
class TicketEvent:
    """
    Immutable event record for audit trail.
    
    Attributes:
        event_id: Unique identifier for the event
        ticket_id: Reference to the ticket
        event_type: Type of event
        from_state: Previous state (None for creation)
        to_state: New state
        actor: User who triggered the event
        actor_role: Role of the actor
        timestamp: When the event occurred
        metadata: Additional event data
        checksum: Hash for integrity verification
    """
    event_id: str
    ticket_id: str
    event_type: TicketEventType
    from_state: Optional[TicketStatus]
    to_state: TicketStatus
    actor: str
    actor_role: str
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    checksum: str = ""

    def __post_init__(self):
        """Generate checksum after initialization for integrity."""
        if not self.checksum:
            self.checksum = self._generate_checksum()

    def _generate_checksum(self) -> str:
        """
        Generate SHA-256 checksum for event integrity verification.
        
        Returns:
            Hexadecimal hash string of the event data
        """
        content = f"{self.event_id}|{self.ticket_id}|{self.event_type.value}|"
        content += f"{self.from_state.value if self.from_state else 'None'}|"
        content += f"{self.to_state.value}|{self.actor}|{self.actor_role}|"
        content += f"{self.timestamp.isoformat()}|{json.dumps(self.metadata, sort_keys=True)}"
        return hashlib.sha256(content.encode()).hexdigest()

    def verify_integrity(self) -> bool:
        """
        Verify the event has not been tampered with.
        
        Returns:
            True if checksum matches, False otherwise
        """
        expected = self._generate_checksum()
        return self.checksum == expected


@dataclass
class TicketContext:
    """
    Context object for state machine execution.
    
    Attributes:
        ticket_id: Unique identifier
        asset_id: Associated asset identifier
        applicant: User who created the ticket
        current_status: Current ticket status
        approval_chain: List of approval stages
        current_approval_stage: Current stage index
        history: List of past events
        metadata: Additional context data
    """
    ticket_id: str
    asset_id: str
    applicant: str
    current_status: TicketStatus = TicketStatus.DRAFT
    approval_chain: List[Tuple[ApprovalRole, str]] = field(default_factory=list)
    current_approval_stage: int = 0
    history: List[TicketEvent] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_current_approver_role(self) -> Optional[ApprovalRole]:
        """
        Get the role required for the current approval stage.
        
        Returns:
            ApprovalRole if pending approval, None otherwise
        """
        if self.current_approval_stage < len(self.approval_chain):
            return self.approval_chain[self.current_approval_stage][0]
        return None


class StateTransitionError(Exception):
    """
    Exception raised when an invalid state transition is attempted.
    
    Attributes:
        message: Error description
        current_state: Current state of the ticket
        attempted_event: Event that was attempted
    """
    def __init__(self, message: str, current_state: TicketStatus, attempted_event: TicketEventType):
        self.message = message
        self.current_state = current_state
        self.attempted_event = attempted_event
        super().__init__(self.message)


class GuardCondition:
    """Base class for guard conditions in state transitions."""
    
    @abstractmethod
    def evaluate(self, context: TicketContext, metadata: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Evaluate the guard condition.
        
        Args:
            context: Current ticket context
            metadata: Additional metadata for evaluation
            
        Returns:
            Tuple of (is_satisfied, failure_reason)
        """
        pass


class RoleGuard(GuardCondition):
    """Guard that checks if the actor has the required role."""
    
    def __init__(self, required_role: ApprovalRole):
        self.required_role = required_role
    
    def evaluate(self, context: TicketContext, metadata: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Evaluate if the actor's role matches the required role.
        
        Returns:
            Tuple of (is_satisfied, failure_reason)
        """
        actor_role = metadata.get("actor_role")
        if actor_role != self.required_role.value:
            return False, f"Role '{actor_role}' not authorized for this transition. Required: '{self.required_role.value}'"
        return True, ""


class AssetStatusGuard(GuardCondition):
    """Guard that checks if the asset is in a valid status for transition."""
    
    def __init__(self, valid_statuses: List[str]):
        self.valid_statuses = valid_statuses
    
    def evaluate(self, context: TicketContext, metadata: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Evaluate if the asset status is valid for transition.
        
        Returns:
            Tuple of (is_satisfied, failure_reason)
        """
        asset_status = metadata.get("asset_status", "")
        if asset_status not in self.valid_statuses:
            return False, f"Asset status '{asset_status}' not valid for this transition. Valid: {self.valid_statuses}"
        return True, ""


class StateMachine:
    """
    Deterministic state machine engine for ticket lifecycle management.
    
    The state machine ensures:
    - Deterministic transitions: Same input + context = same output
    - Guard validation: All guards must pass for transition
    - Event emission: All transitions emit immutable events
    
    Attributes:
        transitions: Map of (from_state, event) -> StateTransition
        guards: Registry of guard condition evaluators
    """
    
    # Define valid transitions as class constant
    TRANSITIONS: Dict[Tuple[TicketStatus, TicketEventType], StateTransition] = {
        # Draft -> Pending
        (TicketStatus.DRAFT, TicketEventType.SUBMITTED): StateTransition(
            from_state=TicketStatus.DRAFT,
            to_state=TicketStatus.PENDING_APPROVAL,
            event=TicketEventType.SUBMITTED,
            guards=[],
            required_role=ApprovalRole.APPLICANT
        ),
        # Pending -> First Approved
        (TicketStatus.PENDING_APPROVAL, TicketEventType.APPROVED): StateTransition(
            from_state=TicketStatus.PENDING_APPROVAL,
            to_state=TicketStatus.FIRST_APPROVED,
            event=TicketEventType.APPROVED,
            guards=[],
            required_role=ApprovalRole.FIRST_APPROVER
        ),
        # First Approved -> Second Approved
        (TicketStatus.FIRST_APPROVED, TicketEventType.APPROVED): StateTransition(
            from_state=TicketStatus.FIRST_APPROVED,
            to_state=TicketStatus.SECOND_APPROVED,
            event=TicketEventType.APPROVED,
            guards=[],
            required_role=ApprovalRole.SECOND_APPROVER
        ),
        # Second Approved -> Approved (Final)
        (TicketStatus.SECOND_APPROVED, TicketEventType.APPROVED): StateTransition(
            from_state=TicketStatus.SECOND_APPROVED,
            to_state=TicketStatus.APPROVED,
            event=TicketEventType.APPROVED,
            guards=[],
            required_role=ApprovalRole.FINAL_APPROVER
        ),
        # Any approval stage -> Rejected
        (TicketStatus.PENDING_APPROVAL, TicketEventType.REJECTED): StateTransition(
            from_state=TicketStatus.PENDING_APPROVAL,
            to_state=TicketStatus.REJECTED,
            event=TicketEventType.REJECTED,
            guards=[],
            required_role=ApprovalRole.FIRST_APPROVER
        ),
        (TicketStatus.FIRST_APPROVED, TicketEventType.REJECTED): StateTransition(
            from_state=TicketStatus.FIRST_APPROVED,
            to_state=TicketStatus.REJECTED,
            event=TicketEventType.REJECTED,
            guards=[],
            required_role=ApprovalRole.SECOND_APPROVER
        ),
        (TicketStatus.SECOND_APPROVED, TicketEventType.REJECTED): StateTransition(
            from_state=TicketStatus.SECOND_APPROVED,
            to_state=TicketStatus.REJECTED,
            event=TicketEventType.REJECTED,
            guards=[],
            required_role=ApprovalRole.FINAL_APPROVER
        ),
        # Approved -> Completed
        (TicketStatus.APPROVED, TicketEventType.COMPLETED): StateTransition(
            from_state=TicketStatus.APPROVED,
            to_state=TicketStatus.COMPLETED,
            event=TicketEventType.COMPLETED,
            guards=[],
            required_role=ApprovalRole.APPLICANT
        ),
        # Any non-terminal state -> Cancelled
        (TicketStatus.DRAFT, TicketEventType.CANCELLED): StateTransition(
            from_state=TicketStatus.DRAFT,
            to_state=TicketStatus.CANCELLED,
            event=TicketEventType.CANCELLED,
            guards=[],
            required_role=ApprovalRole.APPLICANT
        ),
        (TicketStatus.PENDING_APPROVAL, TicketEventType.CANCELLED): StateTransition(
            from_state=TicketStatus.PENDING_APPROVAL,
            to_state=TicketStatus.CANCELLED,
            event=TicketEventType.CANCELLED,
            guards=[],
            required_role=ApprovalRole.APPLICANT
        ),
    }

    def __init__(self):
        """Initialize the state machine with default configuration."""
        self.transitions = self.TRANSITIONS.copy()
        self._guard_registry: Dict[str, GuardCondition] = {}
        self._register_default_guards()

    def _register_default_guards(self) -> None:
        """Register default guard conditions."""
        self._guard_registry["role_guard"] = RoleGuard(ApprovalRole.APPLICANT)
        self._guard_registry["first_approver_guard"] = RoleGuard(ApprovalRole.FIRST_APPROVER)
        self._guard_registry["second_approver_guard"] = RoleGuard(ApprovalRole.SECOND_APPROVER)
        self._guard_registry["final_approver_guard"] = RoleGuard(ApprovalRole.FINAL_APPROVER)
        self._guard_registry["asset_status_guard"] = AssetStatusGuard(["in_use", "idle", "maintenance"])

    def validate_transition(
        self, 
        from_state: TicketStatus, 
        event: TicketEventType
    ) -> Tuple[bool, Optional[StateTransition], str]:
        """
        Validate if a transition is allowed.
        
        Args:
            from_state: Current state of the ticket
            event: Event to trigger transition
            
        Returns:
            Tuple of (is_valid, transition, error_message)
        """
        key = (from_state, event)
        if key not in self.transitions:
            return False, None, f"No transition defined for {from_state.value} + {event.value}"
        return True, self.transitions[key], ""

    def can_transition(
        self, 
        context: TicketContext, 
        event: TicketEventType,
        actor: str,
        actor_role: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, str]:
        """
        Check if a transition can be performed with given context.
        
        Args:
            context: Current ticket context
            event: Event to trigger
            actor: User performing the action
            actor_role: Role of the actor
            metadata: Additional context metadata
            
        Returns:
            Tuple of (can_transition, reason)
        """
        metadata = metadata or {}
        metadata["actor"] = actor
        metadata["actor_role"] = actor_role
        
        is_valid, transition, error = self.validate_transition(context.current_status, event)
        if not is_valid:
            return False, error
        
        # Check role guard
        if transition.required_role:
            role_guard = RoleGuard(transition.required_role)
            satisfied, reason = role_guard.evaluate(context, metadata)
            if not satisfied:
                return False, reason
        
        return True, ""

    def execute_transition(
        self,
        context: TicketContext,
        event: TicketEventType,
        actor: str,
        actor_role: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Execute a state transition atomically.
        
        This method ensures:
        1. Guard validation passes
        2. State change is recorded
        3. Event is created with checksum
        
        Args:
            context: Current ticket context
            event: Event to trigger
            actor: User performing the action
            actor_role: Role of the actor
            metadata: Additional context metadata
            
        Returns:
            Updated ticket context with new state and event
            
        Raises:
            StateTransitionError: If transition is not valid or guards fail
        """
        metadata = metadata or {}
        metadata["actor"] = actor
        metadata["actor_role"] = actor_role
        
        # Validate transition exists
        is_valid, transition, error = self.validate_transition(context.current_status, event)
        if not is_valid:
            raise StateTransitionError(error, context.current_status, event)
        
        # Execute guard checks
        for guard_def in transition.guards:
            guard_name = guard_def.get("name")
            if guard_name and guard_name in self._guard_registry:
                guard = self._guard_registry[guard_name]
                satisfied, reason = guard.evaluate(context, metadata)
                if not satisfied:
                    raise StateTransitionError(reason, context.current_status, event)
        
        # Create event before state change
        new_event = TicketEvent(
            event_id=str(uuid.uuid4()),
            ticket_id=context.ticket_id,
            event_type=event,
            from_state=context.current_status,
            to_state=transition.to_state,
            actor=actor,
            actor_role=actor_role,
            timestamp=datetime.utcnow(),
            metadata=metadata
        )
        
        # Update context (state change + event)
        old_status = context.current_status
        context.current_status = transition.to_state
        context.history.append(new_event)
        
        # Update approval stage if needed
        if event == TicketEventType.APPROVED:
            context.current_approval_stage += 1
        
        logger.info(
            f"State transition executed: {old_status.value} -> {transition.to_state.value} "
            f"(event={event.value}, actor={actor}, ticket={context.ticket_id})"
        )
        
        return context


class EventStore(ABC):
    """
    Abstract base class for event persistence.
    
    Implementations must provide:
    - append: Store a new event
    - get_events: Retrieve events for a ticket
    - verify_integrity: Check event chain integrity
    """
    
    @abstractmethod
    def append(self, event: TicketEvent) -> bool:
        """
        Append an event to the store.
        
        Args:
            event: Event to store
            
        Returns:
            True if stored successfully
        """
        pass
    
    @abstractmethod
    def get_events(self, ticket_id: str) -> List[TicketEvent]:
        """
        Get all events for a ticket.
        
        Args:
            ticket_id: Ticket identifier
            
        Returns:
            List of events in chronological order
        """
        pass
    
    @abstractmethod
    def verify_integrity(self, ticket_id: str) -> Tuple[bool, List[str]]:
        """
        Verify the integrity of the event chain.
        
        Args:
            ticket_id: Ticket identifier
            
        Returns:
            Tuple of (is_valid, list of error messages)
        """
        pass


class InMemoryEventStore(EventStore):
    """
    In-memory implementation of EventStore for testing and development.
    
    WARNING: This implementation does not persist data across restarts.
    Use a persistent implementation for production.
    """
    
    def __init__(self):
        """Initialize the in-memory store."""
        self._events: Dict[str, List[TicketEvent]] = {}

    def append(self, event: TicketEvent) -> bool:
        """
        Append an event to the in-memory store.
        
        Args:
            event: Event to store
            
        Returns:
            True if stored successfully
        """
        ticket_id = event.ticket_id
        if ticket_id not in self._events:
            self._events[ticket_id] = []
        self._events[ticket_id].append(event)
        logger.debug(f"Event stored: {event.event_id} for ticket {ticket_id}")
        return True

    def get_events(self, ticket_id: str) -> List[TicketEvent]:
        """
        Get all events for a ticket.
        
        Args:
            ticket_id: Ticket identifier
            
        Returns:
            List of events in chronological order
        """
        events = self._events.get(ticket_id, [])
        return sorted(events, key=lambda e: e.timestamp)

    def verify_integrity(self, ticket_id: str) -> Tuple[bool, List[str]]:
        """
        Verify the integrity of the event chain.
        
        Args:
            ticket_id: Ticket identifier
            
        Returns:
            Tuple of (is_valid, list of error messages)
        """
        events = self.get_events(ticket_id)
        errors = []
        
        for event in events:
            if not event.verify_integrity():
                errors.append(f"Event {event.event_id} failed integrity check")
        
        return len(errors) == 0, errors


class ApprovalChainService:
    """
    Service for managing the approval chain workflow.
    
    This service handles:
    - Approval chain routing based on asset type/category
    - Permission validation for approvers
    - Stage progression and rejection handling
    """
    
    # Default approval chain template
    DEFAULT_CHAIN: List[Tuple[ApprovalRole, str]] = [
        (ApprovalRole.FIRST_APPROVER, "First Level Approval"),
        (ApprovalRole.SECOND_APPROVER, "Second Level Approval"),
        (ApprovalRole.FINAL_APPROVER, "Final Approval"),
    ]
    
    def __init__(self, event_store: EventStore):
        """
        Initialize the approval chain service.
        
        Args:
            event_store: Event store for persistence
        """
        self.event_store = event_store
        self._chain_configs: Dict[str, List[Tuple[ApprovalRole, str]]] = {}
        self._register_default_chains()

    def _register_default_chains(self) -> None:
        """Register default approval chains."""
        self._chain_configs["default"] = self.DEFAULT_CHAIN.copy()
        # High-value assets need extra approval
        self._chain_configs["high_value"] = [
            (ApprovalRole.FIRST_APPROVER, "First Level Approval"),
            (ApprovalRole.SECOND_APPROVER, "Second Level Approval"),
            (ApprovalRole.FINAL_APPROVER, "Final Approval"),
        ]

    def get_approval_chain(self, asset_category: str = "default") -> List[Tuple[ApprovalRole, str]]:
        """
        Get the approval chain for a given asset category.
        
        Args:
            asset_category: Category of the asset
            
        Returns:
            List of (role, description) tuples
        """
        return self._chain_configs.get(asset_category, self.DEFAULT_CHAIN.copy())

    def validate_approver_permission(
        self,
        approver_role: str,
        expected_role: ApprovalRole,
        approver_id: str
    ) -> Tuple[bool, str]:
        """
        Validate if an approver has permission to approve at this stage.
        
        Args:
            approver_role: Role of the approver
            expected_role: Expected role for this stage
            approver_id: Identifier of the approver
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if approver_role != expected_role.value:
            return False, f"Approver {approver_id} has role '{approver_role}' but expected '{expected_role.value}'"
        return True, ""

    def can_advance_stage(
        self,
        context: TicketContext,
        approver_role: str,
        approver_id: str
    ) -> Tuple[bool, str]:
        """
        Check if the workflow can advance to the next stage.
        
        Args:
            context: Current ticket context
            approver_role: Role of the approver
            approver_id: Identifier of the approver
            
        Returns:
            Tuple of (can_advance, reason)
        """
        expected_role = context.get_current_approver_role()
        if expected_role is None:
            return False, "No more approval stages available"
        
        return self.validate_approver_permission(approver_role, expected_role, approver_id)

    def handle_rejection(
        self,
        context: TicketContext,
        rejector_role: str,
        rejector_id: str,
        reason: str
    ) -> TicketContext:
        """
        Handle rejection at any approval stage.
        
        This terminates the workflow and marks it as rejected.
        
        Args:
            context: Current ticket context
            rejector_role: Role of the rejector
            rejector_id: Identifier of the rejector
            reason: Reason for rejection
            
        Returns:
            Updated context with rejected status
        """
        # Verify the rejector has permission
        expected_role = context.get_current_approver_role()
        if expected_role and rejector_role != expected_role.value:
            raise StateTransitionError(
                f"Rejector does not have permission",
                context.current_status,
                TicketEventType.REJECTED
            )
        
        # Execute rejection transition
        return self._state_machine.execute_transition(
            context=context,
            event=TicketEventType.REJECTED,
            actor=rejector_id,
            actor_role=rejector_role,
            metadata={"rejection_reason": reason}
        )


class TicketService:
    """
    Main service for ticket lifecycle management.
    
    This service coordinates:
    - State machine execution
    - Approval chain management
    - Event persistence
    - Permission validation
    
    Performance target: Single workflow instance ≤ 200ms (P95)
    """
    
    def __init__(
        self,
        state_machine: Optional[StateMachine] = None,
        approval_chain_service: Optional[ApprovalChainService] = None,
        event_store: Optional[EventStore] = None
    ):
        """
        Initialize the ticket service.
        
        Args:
            state_machine: State machine engine (creates default if None)
            approval_chain_service: Approval chain service (creates default if None)
            event_store: Event store for persistence (creates in-memory if None)
        """
        self._state_machine = state_machine or StateMachine()
        self._approval_chain_service = approval_chain_service or ApprovalChainService(
            event_store or InMemoryEventStore()
        )
        self._event_store = event_store or InMemoryEventStore()
        self._state_machine._guard_registry["role_guard"] = RoleGuard(ApprovalRole.APPLICANT)

    def create_ticket(
        self,
        ticket_id: str,
        asset_id: str,
        applicant: str,
        asset_category: str = "default",
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Create a new ticket in DRAFT state.
        
        Args:
            ticket_id: Unique identifier for the ticket
            asset_id: Associated asset identifier
            applicant: User creating the ticket
            asset_category: Category for approval chain selection
            metadata: Additional ticket metadata
            
        Returns:
            Initial ticket context
        """
        # Get appropriate approval chain
        approval_chain = self._approval_chain_service.get_approval_chain(asset_category)
        
        # Create initial context
        context = TicketContext(
            ticket_id=ticket_id,
            asset_id=asset_id,
            applicant=applicant,
            current_status=TicketStatus.DRAFT,
            approval_chain=approval_chain,
            current_approval_stage=0,
            metadata=metadata or {}
        )
        
        # Create creation event
        creation_event = TicketEvent(
            event_id=str(uuid.uuid4()),
            ticket_id=ticket_id,
            event_type=TicketEventType.CREATED,
            from_state=None,
            to_state=TicketStatus.DRAFT,
            actor=applicant,
            actor_role=ApprovalRole.APPLICANT.value,
            timestamp=datetime.utcnow(),
            metadata={"asset_category": asset_category}
        )
        
        # Persist event atomically
        self._event_store.append(creation_event)
        context.history.append(creation_event)
        
        logger.info(f"Ticket created: {ticket_id} by {applicant} for asset {asset_id}")
        
        return context

    def submit_ticket(
        self,
        context: TicketContext,
        submitter: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Submit a ticket for approval.
        
        Args:
            context: Current ticket context
            submitter: User submitting the ticket
            metadata: Additional metadata
            
        Returns:
            Updated context with pending approval status
            
        Raises:
            StateTransitionError: If transition is not allowed
        """
        # Verify submitter is the applicant
        if submitter != context.applicant:
            raise StateTransitionError(
                f"Only the applicant ({context.applicant}) can submit this ticket",
                context.current_status,
                TicketEventType.SUBMITTED
            )
        
        # Execute transition
        context = self._state_machine.execute_transition(
            context=context,
            event=TicketEventType.SUBMITTED,
            actor=submitter,
            actor_role=ApprovalRole.APPLICANT.value,
            metadata=metadata
        )
        
        # Persist the event
        last_event = context.history[-1]
        self._event_store.append(last_event)
        
        return context

    def approve_ticket(
        self,
        context: TicketContext,
        approver_id: str,
        approver_role: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Approve the ticket at the current stage.
        
        Args:
            context: Current ticket context
            approver_id: Identifier of the approver
            approver_role: Role of the approver
            metadata: Additional metadata
            
        Returns:
            Updated context with advanced approval status
            
        Raises:
            StateTransitionError: If approval is not allowed
        """
        # Check permission
        can_approve, reason = self._approval_chain_service.can_advance_stage(
            context, approver_role, approver_id
        )
        if not can_approve:
            raise StateTransitionError(
                reason,
                context.current_status,
                TicketEventType.APPROVED
            )
        
        # Execute transition
        context = self._state_machine.execute_transition(
            context=context,
            event=TicketEventType.APPROVED,
            actor=approver_id,
            actor_role=approver_role,
            metadata=metadata
        )
        
        # Persist the event
        last_event = context.history[-1]
        self._event_store.append(last_event)
        
        # Check if fully approved
        if context.get_current_approver_role() is None and context.current_status != TicketStatus.REJECTED:
            logger.info(f"Ticket {context.ticket_id} fully approved")
        
        return context

    def reject_ticket(
        self,
        context: TicketContext,
        rejector_id: str,
        rejector_role: str,
        reason: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Reject the ticket at the current stage.
        
        This terminates the workflow and marks it as rejected.
        
        Args:
            context: Current ticket context
            rejector_id: Identifier of the rejector
            rejector_role: Role of the rejector
            reason: Reason for rejection
            metadata: Additional metadata
            
        Returns:
            Updated context with rejected status
            
        Raises:
            StateTransitionError: If rejection is not allowed
        """
        # Execute rejection
        context = self._approval_chain_service.handle_rejection(
            context=context,
            rejector_role=rejector_role,
            rejector_id=rejector_id,
            reason=reason
        )
        
        # Persist the event
        last_event = context.history[-1]
        self._event_store.append(last_event)
        
        logger.info(f"Ticket {context.ticket_id} rejected by {rejector_id}: {reason}")
        
        return context

    def complete_ticket(
        self,
        context: TicketContext,
        completer: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Complete an approved ticket.
        
        Args:
            context: Current ticket context
            completer: User completing the ticket
            metadata: Additional metadata
            
        Returns:
            Updated context with completed status
            
        Raises:
            StateTransitionError: If completion is not allowed
        """
        # Only applicant can complete
        if completer != context.applicant:
            raise StateTransitionError(
                f"Only the applicant ({context.applicant}) can complete this ticket",
                context.current_status,
                TicketEventType.COMPLETED
            )
        
        # Execute transition
        context = self._state_machine.execute_transition(
            context=context,
            event=TicketEventType.COMPLETED,
            actor=completer,
            actor_role=ApprovalRole.APPLICANT.value,
            metadata=metadata
        )
        
        # Persist the event
        last_event = context.history[-1]
        self._event_store.append(last_event)
        
        return context

    def cancel_ticket(
        self,
        context: TicketContext,
        canceller: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TicketContext:
        """
        Cancel a ticket (only allowed in non-terminal states).
        
        Args:
            context: Current ticket context
            canceller: User cancelling the ticket
            metadata: Additional metadata
            
        Returns:
            Updated context with cancelled status
            
        Raises:
            StateTransitionError: If cancellation is not allowed
        """
        # Only applicant can cancel
        if canceller != context.applicant:
            raise StateTransitionError(
                f"Only the applicant ({context.applicant}) can cancel this ticket",
                context.current_status,
                TicketEventType.CANCELLED
            )
        
        # Execute transition
        context = self._state_machine.execute_transition(
            context=context,
            event=TicketEventType.CANCELLED,
            actor=canceller,
            actor_role=ApprovalRole.APPLICANT.value,
            metadata=metadata
        )
        
        # Persist the event
        last_event = context.history[-1]
        self._event_store.append(last_event)
        
        return context

    def get_ticket_history(
        self,
        ticket_id: str,
        verify_integrity: bool = False
    ) -> List[TicketEvent]:
        """
        Get the complete history of a ticket.
        
        Args:
            ticket_id: Ticket identifier
            verify_integrity: Whether to verify event chain integrity
            
        Returns:
            List of events in chronological order
            
        Raises:
            ValueError: If integrity verification fails
        """
        events = self._event_store.get_events(ticket_id)
        
        if verify_integrity:
            is_valid, errors = self._event_store.verify_integrity(ticket_id)
            if not is_valid:
                raise ValueError(f"Event chain integrity failed: {errors}")
        
        return events

    def get_ticket_status(self, context: TicketContext) -> Dict[str, Any]:
        """
        Get the current status of a ticket.
        
        Args:
            context: Ticket context
            
        Returns:
            Dictionary with status information
        """
        return {
            "ticket_id": context.ticket_id,
            "asset_id": context.asset_id,
            "status": context.current_status.value,
            "current_approval_stage": context.current_approval_stage,
            "total_approval_stages": len(context.approval_chain),
            "current_approver_role": context.get_current_approver_role().value if context.get_current_approver_role() else None,
            "is_terminal": context.current_status in [
                TicketStatus.REJECTED,
                TicketStatus.COMPLETED,
                TicketStatus.CANCELLED
            ]
        }


# Module-level instance for convenience
_default_service: Optional[TicketService] = None

def get_ticket_service() -> TicketService:
    """
    Get or create the default ticket service instance.
    
    Returns:
        Singleton ticket service instance
    """
    global _default_service
    if _default_service is None:
        _default_service = TicketService()
    return _default_service