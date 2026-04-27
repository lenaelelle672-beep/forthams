"""
Asset Status Value Object and Transition Rules.

This module defines the core asset status value object and the deterministic
transition rules that govern the full lifecycle from in-use to scrapped/retired.
It supports the three-role approval chain (applicant, approver, finalizer)
and ensures any rejection results in a "rejected" terminal state.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional


class AssetStatus(str, Enum):
    """Possible states of an asset across its lifecycle."""
    ACTIVE = "active"
    RETIREMENT_REQUESTED = "retirement_requested"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETIRED = "retired"
    SCRAPPED = "scrapped"


@dataclass(frozen=True)
class TransitionRule:
    """A deterministic rule that validates a status transition.

    Attributes:
        from_status: Source status (or None for any source).
        to_status: Target status.
        allowed_roles: Roles allowed to trigger this transition.
        guard: Optional callable(state, context) -> bool.
    """
    from_status: Optional[AssetStatus]
    to_status: AssetStatus
    allowed_roles: List[str]
    guard: Optional[callable] = None  # noqa: A002


class AssetStatusValueObject:
    """Value object representing an asset's current status and lifecycle metadata."""

    def __init__(
        self,
        asset_id: str,
        status: AssetStatus = AssetStatus.ACTIVE,
        current_approver_index: int = 0,
        approvers: Optional[List[str]] = None,
    ) -> None:
        """Initialize the asset status value object.

        Args:
            asset_id: Unique identifier for the asset.
            status: Initial status (defaults to ACTIVE).
            current_approver_index: Index within the approval chain for pending approvals.
            approvers: Ordered list of approver role/user IDs for the retirement chain.
        """
        self.asset_id = asset_id
        self._status = status
        self._current_approver_index = current_approver_index
        self._approvers = approvers or []
        self._history: List[Dict[str, object]] = []

    @property
    def status(self) -> AssetStatus:
        """Return the current status."""
        return self._status

    @property
    def is_terminal(self) -> bool:
        """Return True if the status is a terminal state."""
        return self._status in {
            AssetStatus.REJECTED,
            AssetStatus.RETIRED,
            AssetStatus.SCRAPPED,
        }

    @property
    def is_pending_approval(self) -> bool:
        """Return True if the status indicates a pending approval."""
        return self._status == AssetStatus.PENDING_APPROVAL

    @property
    def current_approver(self) -> Optional[str]:
        """Return the current approver in the chain, if any."""
        if not self._approvers:
            return None
        return self._approvers[self._current_approver_index]

    def to_dict(self) -> Dict[str, object]:
        """Serialize the value object to a dictionary."""
        return {
            "asset_id": self.asset_id,
            "status": self._status.value,
            "current_approver_index": self._current_approver_index,
            "approvers": self._approvers,
            "history": self._history,
        }

    def transition(
        self,
        target_status: AssetStatus,
        role: str,
        context: Optional[Dict[str, object]] = None,
        rules: Optional[List[TransitionRule]] = None,
    ) -> None:
        """Attempt a deterministic transition to target_status.

        The transition is validated against the provided rules (or the default
        lifecycle rules). If validation fails, the status remains unchanged and
        a rejection event is recorded. On success the status is updated and
        an immutable event is appended to history.

        Args:
            target_status: Desired next status.
            role: Role initiating the transition (e.g., 'applicant', 'approver',
                  'finalizer').
            context: Optional runtime context for guards.
            rules: Optional list of TransitionRule; falls back to built-in rules.

        Raises:
            ValueError: If the transition is not allowed by the rules.
        """
        context = context or {}
        transition_rules = rules or self._default_rules()

        # Find matching, authoritative rule
        matching: List[TransitionRule] = [
            r for r in transition_rules
            if (r.from_status is None or r.from_status == self._status)
            and r.to_status == target_status
        ]
        if not matching:
            raise ValueError(
                f"No rule allows transition from {self._status} to {target_status}."
            )

        # Choose the most specific matching rule (first match is deterministic)
        rule = matching[0]

        # Role check
        if role not in rule.allowed_roles:
            raise PermissionError(
                f"Role '{role}' is not authorized for transition to {target_status}."
            )

        # Guard check
        if rule.guard is not None and not rule.guard(self, context):
            raise PermissionError(
                f"Guard condition failed for transition to {target_status}."
            )

        # Record immutable event before state change (atomic intent)
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "asset_id": self.asset_id,
            "from_status": self._status.value,
            "to_status": target_status.value,
            "role": role,
            "context": context or {},
        }
        self._history.append(event)

        # Commit state change
        self._status = target_status
        if target_status == AssetStatus.PENDING_APPROVAL and self._approvers:
            self._current_approver_index = 0

    def approve(self, role: str, context: Optional[Dict[str, object]] = None) -> None:
        """Approve the current pending request, advancing the approval chain."""
        context = context or {}
        if self._status != AssetStatus.PENDING_APPROVAL:
            raise ValueError(
                f"Cannot approve: current status is {self._status}, expected PENDING_APPROVAL."
            )
        if not self._approvers:
            raise ValueError("No approvers configured for this asset.")

        # If this is the final approver, move to approved
        if role == self._approvers[-1]:
            self.transition(AssetStatus.APPROVED, role, context)
        else:
            # Move to next approver in chain
            self._current_approver_index += 1
            self.transition(AssetStatus.PENDING_APPROVAL, role, context)

    def reject(self, role: str, reason: Optional[str] = None, context: Optional[Dict[str, object]] = None) -> None:
        """Reject the request, moving to terminal REJECTED state."""
        ctx = context or {}
        if reason:
            ctx["reason"] = reason
        self.transition(AssetStatus.REJECTED, role, ctx)

    def request_retirement(self, role: str, context: Optional[Dict[str, object]] = None) -> None:
        """Initiate retirement by the asset owner/applicant."""
        self.transition(AssetStatus.RETIREMENT_REQUESTED, role, context)

    def retire(self, role: str, context: Optional[Dict[str, object]] = None) -> None:
        """Mark the asset as retired (requires approved state)."""
        self.transition(AssetStatus.RETIRED, role, context)

    def scrap(self, role: str, context: Optional[Dict[str, object]] = None) -> None:
        """Physically scrap the asset (terminal)."""
        self.transition(AssetStatus.SCRAPPED, role, context)

    def _default_rules(self) -> List[TransitionRule]:
        """Return the canonical lifecycle transition rules.

        The rules encode the deterministic policy:
        - applicant can request retirement
        - pending approval can be approved/rejected by any configured approver
        - approved can be retired by the final approver
        - retired can be scrapped by a finalizer
        - any role can reject, moving to REJECTED terminal state
        """
        return [
            # Applicant initiates retirement
            TransitionRule(
                from_status=AssetStatus.ACTIVE,
                to_status=AssetStatus.RETIREMENT_REQUESTED,
                allowed_roles=["applicant"],
            ),
            # Pending approval transitions (deterministic chain via index)
            TransitionRule(
                from_status=AssetStatus.PENDING_APPROVAL,
                to_status=AssetStatus.PENDING_APPROVAL,
                allowed_roles=["approver", "finalizer"],
            ),
            # Approve -> Approved (final approver)
            TransitionRule(
                from_status=AssetStatus.PENDING_APPROVAL,
                to_status=AssetStatus.APPROVED,
                allowed_roles=["finalizer"],
            ),
            # Approved -> Retired
            TransitionRule(
                from_status=AssetStatus.APPROVED,
                to_status=AssetStatus.RETIRED,
                allowed_roles=["finalizer"],
            ),
            # Retired -> Scraped
            TransitionRule(
                from_status=AssetStatus.RETIRED,
                to_status=AssetStatus.SCRAPPED,
                allowed_roles=["finalizer"],
            ),
            # Universal reject from any non-terminal state
            TransitionRule(
                from_status=None,
                to_status=AssetStatus.REJECTED,
                allowed_roles=["applicant", "approver", "finalizer"],
            ),
        ]