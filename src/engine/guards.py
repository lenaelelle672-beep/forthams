"""
Guards for asset state transition engine.

Provides validation rules, permission checks and transition guards
used by the finite state machine to enforce deterministic, secure
and auditable asset lifecycle flows.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from src.domain.entities.asset import Asset
from src.domain.entities.retirement_request import RetirementRequest
from src.domain.entities.approval_stage import ApprovalStage
from src.domain.value_objects.asset_status import AssetStatus
from src.domain.value_objects.transition_rule import TransitionRule
from src.common.exception import BusinessException, StateTransitionException

# Permission constants (RBAC aligned)
PERM_ASSET_RETIRE_REQUEST = "asset:retire:request"
PERM_ASSET_RETIRE_APPROVE = "asset:retire:approve"
PERM_ASSET_RETIRE_FINAL_APPROVE = "asset:retire:final_approve"


class GuardError(BusinessException):
    """Raised when a guard validation fails."""
    pass


class TransitionGuard:
    """Base guard for transition validation."""

    def can_transition(
        self,
        asset: Asset,
        from_status: AssetStatus,
        to_status: AssetStatus,
        context: Dict[str, Any],
    ) -> bool:
        """Return True if transition is allowed given current asset and context."""
        raise NotImplementedError


class RetirementStateGuard(TransitionGuard):
    """Guards specific to retirement state transitions."""

    ALLOWED_TRANSITIONS = {
        AssetStatus.ACTIVE: {AssetStatus.RETIRE_REQUESTED},
        AssetStatus.RETIRE_REQUESTED: {
            AssetStatus.RETIRE_PENDING_APPROVAL,
            AssetStatus.ACTIVE,  # self-transition for corrections
        },
        AssetStatus.RETIRE_PENDING_APPROVAL: {
            AssetStatus.RETIRED,
            AssetStatus.RETIRE_REJECTED,
            AssetStatus.RETIRE_REQUESTED,  # revision before final approval
        },
        AssetStatus.RETIRE_REJECTED: {AssetStatus.RETIRE_REQUESTED},
        AssetStatus.RETIRED: set(),  # terminal
    }

    def can_transition(
        self,
        asset: Asset,
        from_status: AssetStatus,
        to_status: AssetStatus,
        context: Dict[str, Any],
    ) -> bool:
        allowed = self.ALLOWED_TRANSITIONS.get(from_status, set())
        if to_status not in allowed:
            raise GuardError(
                code="INVALID_TRANSITION",
                message=(
                    f"Transition {from_status.value} -> {to_status.value} "
                    f"is not allowed for retirement flow."
                ),
            )
        return True


class ApprovalChainGuard(TransitionGuard):
    """Enforces approval chain rules: no bypass, reject terminates, RBAC checks."""

    def can_transition(
        self,
        asset: Asset,
        from_status: AssetStatus,
        to_status: AssetStatus,
        context: Dict[str, Any],
    ) -> bool:
        # context must contain step, actor and permission service
        step: Optional[str] = context.get("step")
        actor_id: Optional[str] = context.get("actor_id")
        permission_service = context.get("permission_service")

        if step is None or actor_id is None or permission_service is None:
            raise GuardError(
                code="MISSING_CONTEXT",
                message="Approval guard requires step, actor_id and permission_service.",
            )

        # Reject terminates the flow immediately
        if to_status == AssetStatus.RETIRE_REJECTED:
            return True

        # Determine required permission based on step
        required_perm = self._perm_for_step(step)
        if not permission_service.has_permission(actor_id, required_perm):
            raise GuardError(
                code="PERMISSION_DENIED",
                message=f"Actor {actor_id} lacks permission '{required_perm}' for step '{step}'.",
            )

        # Ensure sequential progression when advancing toward retired
        if from_status == AssetStatus.RETIRE_PENDING_APPROVAL and to_status == AssetStatus.RETIRED:
            # Must pass through RETIRE_PENDING_APPROVAL -> RETIRED with final approval
            if step != "final_approve":
                raise GuardError(
                    code="INVALID_SEQUENCE",
                    message="Cannot skip to retired without final approval step.",
                )

        return True

    @staticmethod
    def _perm_for_step(step: str) -> str:
        mapping = {
            "submit": PERM_ASSET_RETIRE_REQUEST,
            "approve": PERM_ASSET_RETIRE_APPROVE,
            "final_approve": PERM_ASSET_RETIRE_FINAL_APPROVE,
        }
        if step not in mapping:
            raise GuardError(
                code="UNKNOWN_STEP",
                message=f"Unknown approval step '{step}'.",
            )
        return mapping[step]


class DuplicateEventGuard(TransitionGuard):
    """Prevents duplicate state-change events within the same timestamp window."""

    def __init__(self, seen_hashes) -> None:
        self.seen_hashes = seen_hashes

    def can_transition(
        self,
        asset: Asset,
        from_status: AssetStatus,
        to_status: AssetStatus,
        context: Dict[str, Any],
    ) -> bool:
        event_hash = self._hash_event(asset.id, from_status, to_status, context)
        if event_hash in self.seen_hashes:
            raise GuardError(
                code="DUPLICATE_EVENT",
                message="Duplicate state-change event detected; transition rejected.",
            )
        self.seen_hashes.add(event_hash)
        return True

    @staticmethod
    def _hash_event(asset_id: str, from_status: AssetStatus, to_status: AssetStatus, context: Dict[str, Any]) -> str:
        import hashlib
        payload = f"{asset_id}|{from_status.value}|{to_status.value}|{context.get('actor_id')}|{context.get('step')}|{context.get('timestamp', datetime.utcnow().isoformat())}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class Guards:
    """Registry and orchestration for transition guards."""

    def __init__(self) -> None:
        self._guards: Dict[str, TransitionGuard] = {
            "retirement": RetirementStateGuard(),
            "approval_chain": ApprovalChainGuard(),
            "duplicate_event": DuplicateEventGuard(set()),
        }

    def validate(
        self,
        guard_names: list[str],
        asset: Asset,
        from_status: AssetStatus,
        to_status: AssetStatus,
        context: Dict[str, Any],
    ) -> bool:
        """Run selected guards; returns True if all pass."""
        for name in guard_names:
            guard = self._guards.get(name)
            if guard is None:
                raise GuardError(
                    code="UNKNOWN_GUARD",
                    message=f"Guard '{name}' is not registered.",
                )
            guard.can_transition(asset, from_status, to_status, context)
        return True

    @property
    def retirement(self) -> RetirementStateGuard:
        return self._guards["retirement"]

    @property
    def approval_chain(self) -> ApprovalChainGuard:
        return self._guards["approval_chain"]

    @property
    def duplicate_event(self) -> DuplicateEventGuard:
        return self._guards["duplicate_event"]