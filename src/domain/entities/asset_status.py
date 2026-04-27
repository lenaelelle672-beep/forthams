from enum import Enum, auto
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Set
import uuid

# --- Enums & Constants ---

class AssetStatus(Enum):
    """Represents the lifecycle states of an asset."""
    IN_USE = "in_use"                   # Active in service
    AVAILABLE = "available"             # Ready for assignment
    MAINTENANCE = "maintenance"         # Under repair/inspection
    RETIREMENT_PENDING = "retirement_pending"  # Retirement application submitted
    RETIRED = "retired"                 # Successfully retired
    DISPOSED = "disposed"               # Physically disposed of
    LOST = "lost"                       # Lost or stolen
    DAMAGED = "damaged"                 # Damaged beyond repair
    REJECTED_RETIRMENT = "retirement_rejected" # Retirement application rejected

class ApprovalStepStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"  # Rolled back to previous step

class ApprovalRole(Enum):
    APPLICANT = auto()
    APPROVER_LEVEL_1 = auto()   # e.g., Department Manager
    APPROVER_LEVEL_2 = auto()   # e.g., IT Director
    FINAL_APPROVER = auto()     # e.g., CFO/Asset Committee

class ApprovalAction(Enum):
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    ROLLBACK = "rollback"  # Return to previous approver or applicant

# --- Domain Events (Immutable) ---

@dataclass(frozen=True)
class AssetStatusEvent:
    """Base class for all asset status change events."""
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    asset_id: str = ""
    actor_id: str = ""  # Who performed the action

@dataclass(frozen=True)
class StatusTransitionEvent(AssetStatusEvent):
    """Records a successful state transition."""
    from_status: AssetStatus = None
    to_status: AssetStatus = None
    reason: Optional[str] = None

@dataclass(frozen=True)
class ApprovalActionEvent(AssetStatusEvent):
    """Records an approval action (approve/reject/rollback)."""
    step_index: int = 0
    action: ApprovalAction = None
    comment: Optional[str] = None
    next_status: Optional[AssetStatus] = None

# --- Domain Entities ---

@dataclass(frozen=True)
class AssetHistoryRecord:
    """A single entry in the asset's audit trail."""
    event: AssetStatusEvent
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ApprovalChainStep:
    """Defines a step in the retirement approval process."""
    step_order: int
    required_role: ApprovalRole
    approvers: List[str]  # User IDs authorized for this role/step
    status: ApprovalStepStatus = ApprovalStepStatus.PENDING

@dataclass
class RetirementWorkflowInstance:
    """Represents an active retirement application process."""
    workflow_id: str = field(default_factory=lambda: f"wf-{uuid.uuid4().hex[:8]}")
    asset_id: str = ""
    applicant_id: str = ""
    current_step_index: int = 0  # 0-based index into the approval chain
    steps: List[ApprovalChainStep] = field(default_factory=list)
    status: ApprovalStepStatus = ApprovalStepStatus.PENDING
    history: List[AssetHistoryRecord] = field(default_factory=list)

class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    def __init__(self, from_state: AssetStatus, to_state: AssetStatus, reason: str):
        super().__init__(f"Invalid transition from {from_state.name} to {to_state.name}: {reason}")

# --- Core Engine Logic ---

class AssetStateMachineEngine:
    """
    Core engine managing asset lifecycle transitions and retirement workflows.
    Implements deterministic state machine, approval chain routing, 
    and immutable event logging.
    """

    # Valid state transition map (from -> to)
    VALID_TRANSITIONS = {
        AssetStatus.IN_USE: {
            AssetStatus.UNDER_REPAIR,
            AssetStatus.DECOMMISSIONING_REQUESTED,  # Initiates retirement workflow
            AssetStatus.OUT_OF_SERVICE,
            AssetStatus.DISPOSED,
        },
        AssetStatus.UNDER_REPAIR: {
            AssetStatus.IN_USE,
            AssetStatus.OUT_OF_SERVICE,
            AssetStatus.DECOMMISSIONING_REQUESTED,
        },
        AssetStatus.OUT_OF_SERVICE: {
            AssetStatus.IN_USE,
            AssetStatus.UNDER_REPAIR,
            AssetStatus.DECOMMISSIONING_REQUESTED,
            AssetStatus.DISPOSED,
        },
        # Retirement workflow states are managed via the WorkflowInstance
        AssetStatus.DECOMMISSIONING_REQUESTED: {
            AssetStatus.IN_USE,             # If rejected or rolled back
            AssetStatus.REJECTED_RETIRMENT, # Final rejection
            AssetStatus.DISPOSED,           # Approved and completed
        },
        AssetStatus.REJECTED_RETIRMENT: {
            AssetStatus.IN_USE,             # Re-submit after correction
        },
        AssetStatus.DISPOSED: set(),         # Terminal state
    }

    def __init__(self):
        """Initializes the engine with default configuration."""
        pass

    def validate_transition(self, current: AssetStatus, target: AssetStatus) -> bool:
        """Checks if a transition is legally defined in the state machine."""
        return target in self.VALID_TRANSITIONS.get(current, set())

    def create_retirement_workflow(
        self, 
        asset_id: str, 
        applicant_id: str, 
        approval_chain: List[str]  # List of role/user IDs for approval steps
    ) -> RetirementWorkflowResult:
        """
        Initiates a retirement request workflow.
        Creates the initial state transition and initializes the approval chain.
        """
        # In real implementation, this would interact with repositories to persist
        return RetirementWorkflowResult(asset_id=asset_id, applicant_id=applicant_id)

    def process_approval(
        self, 
        workflow: RetirementWorkflow, 
        approver_id: str, 
        action: str  # 'APPROVE' | 'REJECT' | 'ROLLBACK'
    ) -> ApprovalResult:
        """
        Processes an approval action on a retirement workflow.
        Handles routing to next step, finalization, or rejection/rollback.
        """
        if not workflow or workflow.status != ApprovalStatus.PENDING:
            return ApprovalResult(success=False, error="Workflow is not in pending state")

        current_step = workflow.steps[workflow.current_step_index]
        
        # RBAC check (simplified for domain model)
        if approver_id != current_step.approver_role:
            return ApprovalResult(success=False, error="Unauthorized approver")

        if action == "APPROVE":
            return self._handle_approve(workflow)
        elif action == "REJECT":
            return self._handle_reject(workflow)
        elif action == "ROLLBACK":
            return self._handle_rollback(workflow)
        else:
            return ApprovalResult(success=False, error="Invalid action")

    def _handle_approve(self, workflow: RetirementWorkflow) -> ApprovalResult:
        """Moves approval to next step or completes the process."""
        if workflow.current_step_index + 1 < len(workflow.steps):
            # Move to next approver in chain
            workflow.current_step_index += 1
            return ApprovalResult(success=True, status="PENDING", message="Advanced to next step")
        else:
            # Final approval reached - complete retirement
            workflow.status = ApprovalStatus.COMPLETED
            return ApprovalResult(success=True, status="COMPLETED", message="Retirement approved and completed")

    def _handle_reject(self, workflow: RetirementWorkflow) -> ApprovalResult:
        """Terminates the process immediately on rejection."""
        workflow.status = ApprovalStatus.REJECTED
        return ApprovalResult(success=True, status="REJECTED", message="Retirement rejected")

    def _handle_rollback(self, workflow: RetirementWorkflow) -> ApprovalResult:
        """Rolls back to previous approver if possible."""
        if workflow.current_step_index > 0:
            workflow.current_step_index -= 1
            return ApprovalResult(success=True, status="PENDING", message="Rolled back to previous step")
        else:
            return ApprovalResult(success=False, error="Cannot rollback from first step")

    def get_history(self, asset_id: str) -> List[AssetHistoryEvent]:
        """Retrieves immutable history of all state transitions and approval actions."""
        # In real implementation, this would query an event store repository
        return []


class AssetStatus(Enum):
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"
    DISPOSED = "disposed"
    LOST = "lost"
    DAMAGED = "damaged"
    PENDING_RETIREMENT = "pending_retirement"  # New state for retirement process


class AssetHistoryEvent(dataclass):
    event_id: str
    asset_id: str
    previous_state: Optional[AssetStatus]
    new_state: AssetStatus
    actor_id: str
    timestamp: datetime
    action: str  # e.g., "RETIREMENT_REQUESTED", "APPROVAL_GRANTED", "STATE_TRANSITION"
    metadata: Dict[str, Any] = field(default_factory=dict)


class RetirementWorkflow:
    workflow_id: UUID
    asset_id: str
    applicant_id: str
    current_step_index: int = 0
    steps: List[ApprovalStep] = field(default_factory=list)
    status: ApprovalStatus = ApprovalStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ApprovalStep:
    approver_role: str  # Role required to approve this step
    step_order: int
    comment: Optional[str] = None
    decision: Optional[ApprovalDecision] = None
    actioned_at: Optional[datetime] = None


@dataclass
class ApprovalResult:
    success: bool
    status: str  # "PENDING", "COMPLETED", "REJECTED" or error message
    message: str = ""


@dataclass
class RetirementWorkflowResult:
    asset_id: str
    applicant_id: str
    workflow_id: Optional[UUID] = None


class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ApprovalDecision(Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_INFO = "request_info"
    ABSTAIN = "abstain"


# --- Implementation of State Machine Logic ---

class AssetStateMachine:
    """Manages asset state transitions with validation and guard conditions."""

    def __init__(self, current_state: AssetStatus):
        self.current_state = current_state

    @property
    def can_transition(self) -> bool:
        """Returns True if the current state allows any transition."""
        return self.current_state != AssetStatus.DISPOSED


    def validate_transition(self, target_state: AssetStatus, context: Dict[str, Any] = None) -> bool:
        """
        Validates whether a transition to target_state is permitted from current state.

        Args:
            target_state (AssetStatus): The desired new state
            context (Dict[str, Any]): Additional validation data (e.g., user roles, asset details)

        Returns:
            bool: True if valid, False otherwise
        """
        if not self.can_transition:
            return False

        # Define allowed transitions using a transition matrix
        allowed = {
            AssetStatus.IN_USE: [
                AssetStatus.MAINTENANCE, 
                AssetStatus.PENDING_RETIREMENT, 
                AssetStatus.LOST, 
                AssetStatus.DAMAGED
            ],
            AssetStatus.MAINTENANCE: [
                AssetStatus.IN_USE, 
                AssetStatus.PENDING_RETIREMENT, 
                AssetStatus.DISPOSED, 
                AssetStatus.LOST
            ],
            AssetStatus.PENDING_RETIREMENT: [
                AssetStatus.RETIRED, 
                AssetStatus.IN_USE,  # Revert if rejected or cancelled
                AssetStatus.DAMAGED
            ],
            AssetStatus.RETIRED: [
                AssetStatus.DISPOSED
            ],
            AssetStatus.LOST: [
                AssetStatus.DISPOSED
            ],
            AssetStatus.DAMAGED: [
                AssetStatus.IN_USE, 
                AssetStatus.PENDING_RETIREMENT, 
                AssetStatus.DISPOSED
            ],
            AssetStatus.DISPOSED: []  # Terminal state
        }

        target = target_state if target_state else AssetStatus.IN_USE
        if target not in allowed.get(self.current_state, []):
            return False

        # Guard conditions for specific transitions
        if context:
            if target == AssetStatus.PENDING_RETIREMENT and self.current_state != AssetStatus.IN_USE:
                # Only assets in use can be retired through the standard process
                return False
            
            if target == AssetStatus.DISPOSED and self.current_state not in [AssetStatus.LOST, AssetStatus.DAMAGED]:
                 # Direct disposal requires specific conditions (e.g., lost or damaged)
                 return False

        return True

    def transition(self, target_state: AssetStatus, context: Dict[str, Any] = None) -> 'AssetStateMachine':
        """
        Executes the state transition if valid.

        Args:
            target_state (AssetStatus): The desired new state
            context (Dict[str, Any]): Additional validation data

        Returns:
            'AssetStateMachine': A new instance with updated state

        Raises:
            StateTransitionError: If the transition is invalid
        """
        if not self.validate_transition(target_state, context):
            raise StateTransitionError(f"Invalid transition from {self.current_state} to {target_state}")

        # In a real implementation, this would trigger side effects like updating DB, 
        # emitting events, etc. Here we return the new state object.
        return AssetStateMachine(target_state)


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass