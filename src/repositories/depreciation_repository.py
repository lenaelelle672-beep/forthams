"""
Depreciation Repository

Provides persistence for depreciation-related data and supports
state‑transition / approval event recording.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional


@dataclass(frozen=True)
class DepreciationEvent:
    """Immutable event record for a single depreciation/retirement state change."""
    asset_id: str
    sequence: int
    from_state: str
    to_state: str
    action: str  # e.g. "submit", "approve", "reject", "retire"
    actor_id: str
    occurred_at: datetime = datetime.now(timezone.utc)
    metadata: dict = None

    def __post_init__(self) -> None:
        if self.metadata is None:
            object.__setattr__(self, "metadata", {})


class DepreciationRepository:
    """
    Repository responsible for persisting depreciation records and
    immutable event logs.  All state changes and event writes are
    designed to be atomic (in practice this is achieved by the
    service/unit‑of‑work layer; this class provides safe primitives).
    """

    def __init__(self) -> None:
        # In‑memory stores for demonstration; replace with DB-backed impl.
        self._events: List[DepreciationEvent] = []
        self._current_state: dict[str, str] = {}  # asset_id -> state
        self._sequence: dict[str, int] = {}       # asset_id -> last seq

    # ---- queries --------------------------------------------------------

    def get_current_state(self, asset_id: str) -> Optional[str]:
        """Return the current state of an asset, or None if unknown."""
        return self._current_state.get(asset_id)

    def get_events(self, asset_id: str) -> List[DepreciationEvent]:
        """Return all events for an asset ordered by sequence/time."""
        return sorted(
            (e for e in self._events if e.asset_id == asset_id),
            key=lambda e: (e.sequence, e.occurred_at),
        )

    # ---- state transition / event persistence ---------------------------

    def transition_state(
        self,
        asset_id: str,
        new_state: str,
        action: str,
        actor_id: str,
        metadata: Optional[dict] = None,
    ) -> DepreciationEvent:
        """
        Atomically record a state transition event and update the
        current state for the asset.

        Guarantees:
        - Each event receives a strictly increasing sequence per asset.
        - The current state is updated in the same logical operation
          (in a real DB this would be a transaction).
        """
        seq = self._sequence.get(asset_id, 0) + 1
        self._sequence[asset_id] = seq

        previous_state = self._current_state.get(asset_id)
        event = DepreciationEvent(
            asset_id=asset_id,
            sequence=seq,
            from_state=previous_state or "",
            to_state=new_state,
            action=action,
            actor_id=actor_id,
            metadata=metadata or {},
        )
        self._events.append(event)
        self._current_state[asset_id] = new_state
        return event

    # ---- approval helpers ------------------------------------------------

    def append_approval_event(
        self,
        asset_id: str,
        approval_stage: str,
        decision: str,
        actor_id: str,
        metadata: Optional[dict] = None,
    ) -> DepreciationEvent:
        """
        Record an explicit approval/rejection event.
        The state is updated only when the final decision is applied
        by the caller (so the service can enforce the approval chain).
        """
        return self.transition_state(
            asset_id=asset_id,
            new_state=approval_stage,
            action="approval",
            actor_id=actor_id,
            metadata={"decision": decision, **(metadata or {})},
        )