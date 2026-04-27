"""
Asset lifecycle state machine enumerations.

This module defines the core enums used across the asset state流转 engine,
including asset statuses, retirement request statuses, workflow states,
event types, and role identifiers. All enums are designed to support
deterministic transitions, RBAC-backed approval chains, and immutable
event persistence.
"""

from enum import Enum, auto
from typing import List, Optional
from dataclasses import dataclass
class AssetStatus(str, Enum):
    """Possible statuses of an asset across its lifecycle."""
    ACTIVE = "active"
    IN_REVIEW = "in_review"
    RETIRED = "retired"
    VETOED = "vetoed"
    PENDING_RETIREMENT = "pending_retirement"
    SCHEDULED_RETIREMENT = "scheduled_retirement"
    DISPOSED = "disposed"
class RetirementRequestStatus(str, Enum):
    """Status of a retirement request (approval chain)."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    VETOED = "vetoed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
class WorkflowState(str, Enum):
    """Internal workflow engine states."""
    INITIALIZED = "initialized"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
class EventType(str, Enum):
    """Types of immutable events recorded in the event store."""
    ASSET_STATUS_CHANGED = "asset_status_changed"
    RETIREMENT_REQUEST_SUBMITTED = "retirement_request_submitted"
    RETIREMENT_REQUEST_APPROVED = "retirement_request_approved"
    RETIREMENT_REQUEST_REJECTED = "retirement_request_rejected"
    RETIREMENT_REQUEST_VETOED = "retirement_request_vetoed"
    RETIREMENT_REQUEST_COMPLETED = "retirement_request_completed"
    RETIREMENT_REQUEST_CANCELLED = "retirement_request_cancelled"
    TRANSITION_EXECUTED = "transition_executed"
    RULE_VIOLATION = "rule_violation"
@dataclass(frozen=True)
class TransitionRule:
    """A deterministic transition rule: from_status + trigger -> to_status."""
    from_status: AssetStatus
    trigger: str
    to_status: AssetStatus
    required_role: Optional[str] = None
class RBACRole(str, Enum):
    """Minimal RBAC roles for approval-chain enforcement."""
    APPLICANT = "applicant"
    APPROVER = "approver"
    FINAL_APPROVER = "final_approver"
    SYSTEM = "system"
@dataclass(frozen=True)
class ApprovalNode:
    """Configuration for a single node in the approval chain."""
    role: RBACRole
    order: int
    allow_review: bool = True
    allow_reject: bool = True
    allow_revoke: bool = False
class AuditLevel(str, Enum):
    """Audit granularity levels for logging."""
    NONE = "none"
    BASIC = "basic"
    FULL = "full"
class PersistenceMode(str, Enum):
    """Event store persistence modes."""
    ATOMIC = "atomic"
    BATCHED = "batched"
    SYNC = "sync"
# -----------------------------
# Derived helpers (read-only)
# -----------------------------
def retirement_status_to_asset_status(status: RetirementRequestStatus) -> Optional[AssetStatus]:
    """Map retirement request lifecycle to asset status (deterministic)."""
    mapping = {
        RetirementRequestStatus.DRAFT: AssetStatus.ACTIVE,
        RetirementRequestStatus.SUBMITTED: AssetStatus.PENDING_RETIREMENT,
        RetirementRequestStatus.APPROVED: AssetStatus.IN_REVIEW,
        RetirementRequestStatus.VETOED: AssetStatus.VETOED,
        RetirementRequestStatus.COMPLETED: AssetStatus.RETIRED,
        RetirementRequestStatus.CANCELLED: AssetStatus.ACTIVE,
    }
    return mapping.get(status)
def is_approval_transition_allowed(
    current_status: RetirementRequestStatus,
    action: str,
    role: RBACRole,
) -> bool:
    """Deterministic guard for approval-chain transitions.

    Rules:
      - Only SUBMITTED can be APPROVED or REJECTED or VETOED.
      - APPROVED can be REJECTED (back to SUBMITTED) or VETOED.
      - VETOED can only be REJECTED (back to SUBMITTED) — cannot re-approve directly.
      - REJECTED can be SUBMITTED again.
      - COMPLETED and CANCELLED are terminal.
    """
    allowed: dict[RetirementRequestStatus, dict[str, set[RBACRole]]] = {
        RetirementRequestStatus.SUBMITTED: {
            "approve": {RBACRole.APPROVER, RBACRole.FINAL_APPROVER},
            "reject": {RBACRole.APPROVER, RBACRole.FINAL_APPROVER},
            "veto": {RBACRole.FINAL_APPROVER},
        },
        RetirementRequestStatus.APPROVED: {
            "reject": {RBACRole.FINAL_APPROVER},
            "veto": {RBACRole.FINAL_APPROVER},
        },
        RetirementRequestStatus.VETOED: {
            "reject": {RBACRole.FINAL_APPROVER},
        },
        RetirementRequestStatus.REJECTED: {
            "submit": {RBACRole.APPLICANT},
        },
    }
    return role in allowed.get(current_status, {}).get(action, set())
def default_approval_chain() -> List[ApprovalNode]:
    """Default hierarchical approval chain: applicant -> approver -> final approver."""
    return [
        ApprovalNode(role=RBACRole.APPLICANT, order=1, allow_review=False, allow_reject=False, allow_revoke=False),
        ApprovalNode(role=RBACRole.APPROVER, order=2, allow_review=True, allow_reject=True, allow_revoke=False),
        ApprovalNode(role=RBACRole.FINAL_APPROVER, order=3, allow_review=True, allow_reject=True, allow_revoke=False),
    ]
def is_terminal_retirement_status(status: RetirementRequestStatus) -> bool:
    """True if the request reached a terminal state."""
    return status in {RetirementRequestStatus.COMPLETED, RetirementRequestStatus.CANCELLED, RetirementRequestStatus.VETOED}