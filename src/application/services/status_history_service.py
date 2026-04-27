"""
Status History Service

Provides persistence for asset status change events and approval workflow events.
Ensures atomic writes of state transitions together with event records (event sourcing).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import threading
import json
import hashlib

from src.domain.entities.status_history import StatusHistoryEntry
from src.domain.entities.asset_status import AssetStatus
from src.domain.entities.transition_rule import TransitionRule
from src.domain.value_objects.asset_status import AssetStatus as StatusVO


class StatusHistoryServiceError(Exception):
    """Base exception for status history service errors."""


class DuplicateEventError(StatusHistoryServiceError):
    """Raised when an event ID collision is detected (should be extremely rare)."""


class InvalidTransitionError(StatusHistoryServiceError):
    """Raised when a state transition violates defined rules."""


@dataclass(frozen=True)
class EventRecord:
    """
    Immutable event record for event sourcing.
    """
    event_id: str
    asset_id: str
    event_type: str  # e.g., "state_transition", "approval_step"
    status: Optional[str]
    metadata: Dict[str, Any]
    created_at: str  # ISO8601 UTC
    previous_status: Optional[str]
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True)

    def signature(self) -> str:
        """Cryptographic signature material for integrity verification."""
        payload = self.to_json()
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class StatusHistoryService:
    """
    Thread-safe service for persisting and querying status/event history.

    Responsibilities:
    - Validate state transitions against configured rules.
    - Atomically persist state changes together with an immutable event record.
    - Provide chronological query interface for audit trails.
    """

    def __init__(self, rules_loader, storage) -> None:
        """
        Args:
            rules_loader: Provides TransitionRule objects for the current asset.
            storage: Object implementing `save_event(event)` and `query_events(...)`.
        """
        self._rules_loader = rules_loader
        self._storage = storage
        self._lock = threading.RLock()

    def transition_state(
        self,
        asset_id: str,
        new_status: str,
        actor_id: Optional[str] = None,
        actor_role: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> StatusHistoryEntry:
        """
        Validate and execute a state transition, persisting an immutable event.

        This method is atomic: either both the transition validation passes and the
        event is stored, or no change is made.

        Args:
            asset_id: Unique asset identifier.
            new_status: Target status name (must be a valid Status enum/string).
            actor_id: User/actor performing the transition.
            actor_role: Role of the actor (e.g., "applicant", "approver", "admin").
            metadata: Optional additional context for the event.

        Returns:
            StatusHistoryEntry representing the persisted transition.

        Raises:
            InvalidTransitionError: If the transition is not allowed.
            DuplicateEventError: If event ID collision occurs (extremely rare).
            StatusHistoryServiceError: For storage or unexpected errors.
        """
        with self._lock:
            previous_status = self._current_status(asset_id)
            rules = self._rules_loader(asset_id)

            if not self._is_allowed(previous_status, new_status, rules):
                raise InvalidTransitionError(
                    f"Transition not allowed: '{previous_status}' -> '{new_status}'"
                )

            event = self._build_event(
                asset_id=asset_id,
                previous_status=previous_status,
                new_status=new_status,
                actor_id=actor_id,
                actor_role=actor_role,
                metadata=metadata or {},
            )

            try:
                self._storage.save_event(event)
            except DuplicateEventError:
                # Re-raise as-is; caller may decide retry strategy.
                raise
            except Exception as exc:
                raise StatusHistoryServiceError(
                    f"Failed to persist event for asset {asset_id}: {exc}"
                ) from exc

            return StatusHistoryEntry(
                asset_id=asset_id,
                status=new_status,
                previous_status=previous_status,
                event_id=event.event_id,
                created_at=event.created_at,
                actor_id=actor_id,
                actor_role=actor_role,
                metadata=metadata or {},
            )

    def append_approval_step(
        self,
        asset_id: str,
        step: str,
        decision: str,
        approver_id: str,
        approver_role: str,
        comment: Optional[str] = None,
    ) -> StatusHistoryEntry:
        """
        Record an approval/decision step in the workflow chain.

        Decision values are expected to be among: "approve", "reject", "return", "revoke".
        A "reject" decision should be treated as terminal (workflow ends with "rejected").

        Args:
            asset_id: Asset being approved.
            step: Human-readable step label, e.g., "申请人审批", "终审".
            decision: One of "approve", "reject", "return", "revoke".
            approver_id: Actor performing the decision.
            approver_role: Role of the approver.
            comment: Optional free-text comment.

        Returns:
            StatusHistoryEntry for the approval event.

        Raises:
            InvalidTransitionError: If the decision sequence is invalid.
        """
        allowed_decisions = {"approve", "reject", "return", "revoke"}
        if decision not in allowed_decisions:
            raise InvalidTransitionError(
                f"Invalid decision '{decision}'. Must be one of {sorted(allowed_decisions)}"
            )

        metadata = {"step": step, "decision": decision}
        if comment is not None:
            metadata["comment"] = comment

        # Map decision to a canonical status for history consistency.
        status_map = {
            "approve": AssetStatus.WAITING_NEXT,
            "reject": AssetStatus.REJECTED,
            "return": AssetStatus.WAITING_APPLICANT,
            "revoke": AssetStatus.REVOKED,
        }
        new_status = status_map[decision]

        return self.transition_state(
            asset_id=asset_id,
            new_status=new_status,
            actor_id=approver_id,
            actor_role=approver_role,
            metadata=metadata,
        )

    def query_events(
        self,
        asset_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        start_at: Optional[str] = None,
        end_at: Optional[str] = None,
    ) -> List[EventRecord]:
        """
        Query immutable event records.

        Args follow a flexible filter pattern; storage implementation is responsible
        for efficient indexing and sorting by `created_at` ascending.
        """
        return self._storage.query_events(
            asset_id=asset_id,
            event_type=event_type,
            limit=limit,
            offset=offset,
            start_at=start_at,
            end_at=end_at,
        )

    def _current_status(self, asset_id: str) -> Optional[str]:
        """Derive current status from the latest event, or None if no events exist."""
        events = self._storage.query_events(asset_id=asset_id, limit=1, offset=0)
        if not events:
            return None
        return events[-1].status

    def _is_allowed(self, from_status: Optional[str], to_status: str, rules) -> bool:
        """Check transition against ordered rule set; deterministic and explicit."""
        if from_status is None:
            # Allow any initial status defined as entry points in rules.
            return any(r.from_status is None for r in rules)
        for rule in rules:
            if rule.from_status == from_status and rule.to_status == to_status:
                return True
        return False

    def _build_event(
        self,
        asset_id: str,
        previous_status: Optional[str],
        new_status: str,
        actor_id: Optional[str],
        actor_role: Optional[str],
        metadata: Dict[str, Any],
    ) -> EventRecord:
        """Construct an immutable event record with UTC timestamp."""
        event_id = self._make_event_id(asset_id, previous_status, new_status, time.time())
        return EventRecord(
            event_id=event_id,
            asset_id=asset_id,
            event_type="state_transition",
            status=new_status,
            metadata=metadata,
            created_at=datetime.now(timezone.utc).isoformat(),
            previous_status=previous_status,
            actor_id=actor_id,
            actor_role=actor_role,
        )

    @staticmethod
    def _make_event_id(asset_id: str, from_s: Optional[str], to_s: str, ts: float) -> str:
        """
        Deterministic event ID derived from content + monotonic component.
        Collision resistance is enforced by storage layer on write.
        """
        payload = f"{asset_id}:{from_s or ''}:{to_s}:{ts}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()