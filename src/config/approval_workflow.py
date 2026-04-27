"""
Approval Workflow Configuration and Engine for Asset Retirement Lifecycle.

This module defines the state machine, approval chain routing, and event
persistence hooks that drive the deterministic transition of assets through
operational states to "Retired" or "Rejected".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
import logging

from src.domain.entities.asset import Asset
from src.domain.entities.retirement_request import RetirementRequest
from src.domain.entities.approval_node import ApprovalNode, ApprovalRole
from src.domain.entities.approval_stage import ApprovalStage
from src.domain.services.approval_chain_service import ApprovalChainService
from src.domain.services.status_history_service import StatusHistoryService
from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule

logger = logging.getLogger(__name__)
class WorkflowTransitionError(Exception):
    """Raised when a state transition or approval action is invalid."""

    def __init__(self, message: str, asset_id: Optional[str] = None) -> None:
        self.asset_id = asset_id
        super().__init__(message)
class TransitionGuard:
    """Guards enforce preconditions for a transition."""

    @staticmethod
    def require_requester_can_initiate(asset: Asset) -> bool:
        return asset.status == AssetStatus.ACTIVE

    @staticmethod
    def require_approver_can_act(node: ApprovalNode, role: ApprovalRole) -> bool:
        # RBAC check is delegated to the authorization layer; here we ensure
        # the node expects this role and the workflow is still actionable.
        return node.role == role and node.status.value in ("pending", "active")

    @staticmethod
    def require_not_finalized(request: RetirementRequest) -> bool:
        return request.status.value not in ("retired", "rejected")
class ApprovalWorkflowEngine:
    """
    Core workflow engine implementing deterministic state transitions and
    approval-chain routing with event persistence.
    """

    def __init__(self, chain_service: ApprovalChainService,
                 history_service: StatusHistoryService) -> None:
        self.chain_service = chain_service
        self.history_service = history_service

    def initiate_retirement(self, asset: Asset,
                            requester_id: str) -> RetirementRequest:
        """
        Create a retirement request and persist the INITIATED event atomically.
        """
        if not TransitionGuard.require_requester_can_initiate(asset):
            raise WorkflowTransitionError(
                f"Asset {asset.id} cannot be retired from state {asset.status}",
                asset_id=asset.id)

        request = RetirementRequest(
            asset_id=asset.id,
            requester_id=requester_id,
            status=ApprovalRequestStatus.INITIATED,
            created_at=datetime.now(timezone.utc)
        )
        # Build the approval chain once per asset type / org policy.
        request.chain = self.chain_service.build_chain(asset)
        # Emit event; history_service guarantees append-only, immutable storage.
        self.history_service.append(
            asset_id=asset.id,
            event_type="retirement_initiated",
            payload={"requester_id": requester_id},
            status=request.status
        )
        return request

    def advance_to_next_approver(self, request: RetirementRequest,
                                 approver_id: str, role: ApprovalRole) -> ApprovalStage:
        """
        Move the request through the next pending approval node.
        Raises WorkflowTransitionError if the transition is invalid.
        """
        if not TransitionGuard.require_not_finalized(request):
            raise WorkflowTransitionError(
                f"Request {request.id} is already finalized",
                asset_id=request.asset_id)

        current = request.chain.current_node()
        if not TransitionGuard.require_approver_can_act(current, role):
            raise WorkflowTransitionError(
                f"Role {role} cannot act on node {current.node_id}",
                asset_id=request.asset_id)

        # Enforce sequential routing; bypassing is not allowed.
        if not request.chain.is_next(role):
            raise WorkflowTransitionError(
                f"Approval out of sequence for role {role}",
                asset_id=request.asset_id)

        # Record the approval decision atomically with state change.
        approved = self._evaluate_decision(request, approver_id)
        node = request.chain.advance(approved, approver_id)

        event_type = "approval_approved" if approved else "approval_rejected"
        self.history_service.append(
            asset_id=request.asset_id,
            event_type=event_type,
            payload={"approver_id": approver_id, "node_id": node.node_id},
            status=request.status
        )

        # If rejected at any node, mark as REJECTED and stop the chain.
        if not approved:
            request.status = ApprovalRequestStatus.REJECTED
            self.history_service.append(
                asset_id=request.asset_id,
                event_type="retirement_rejected",
                payload={"reason": "rejected_at_node", "node_id": node.node_id},
                status=request.status
            )
            return node

        # If chain fully approved, finalize to RETIRED.
        if request.chain.is_complete():
            request.status = ApprovalRequestStatus.RETIRED
            self.history_service.append(
                asset_id=request.asset_id,
                event_type="retirement_completed",
                payload={"completed_at": datetime.now(timezone.utc).isoformat()},
                status=request.status
            )
        return node

    def _evaluate_decision(self, request: RetirementRequest,
                           approver_id: str) -> bool:
        """
        Placeholder for actual decision logic (e.g., call to approval API).
        Deterministic: given request and approver, returns a boolean.
        """
        # In production this consults an approval store or external service.
        # For the engine contract we assume the caller provides a valid decision.
        return True
@dataclass(frozen=True)
class ApprovalChainConfig:
    """Immutable configuration for a single retirement approval chain."""
    levels: List[ApprovalRole]
    required_signatures: int = 1
    allow_backtrack: bool = False

    def validate(self) -> None:
        if not self.levels:
            raise ValueError("Approval chain must contain at least one role")
        if self.required_signatures < 1:
            raise ValueError("At least one approval is required")
@dataclass
class WorkflowSnapshot:
    """Point-in-time snapshot for audit and query."""
    asset_id: str
    status: AssetStatus
    request_status: ApprovalRequestStatus
    chain_position: int
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
class ApprovalRequestStatus(str, Enum):
    INITIATED = "initiated"
    PENDING = "pending"
    APPROVED = "approved"
    RETIRED = "retired"
    REJECTED = "rejected"
    NOOP = "noop"