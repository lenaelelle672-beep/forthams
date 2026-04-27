"""
Asset Status History Model and Event Persistence.

This module defines the data model for recording every state transition
and operation within the asset lifecycle, ensuring immutable, auditable
trail for compliance and traceability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import Field, BaseModel, ConfigDict
class AssetStatus(str, Enum):
    """Valid asset statuses across the lifecycle."""
    ACTIVE = "active"
    RETIREMENT_REQUESTED = "retirement_requested"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETIRED = "retired"
    CANCELLED = "cancelled"
class EventType(str, Enum):
    """Types of events that mutate or observe asset state."""
    STATE_TRANSITION = "state_transition"
    RETIREMENT_SUBMITTED = "retirement_submitted"
    RETIREMENT_APPROVED = "retirement_approved"
    RETIREMENT_REJECTED = "retirement_rejected"
    RETIREMENT_CANCELLED = "retirement_cancelled"
    PERMISSION_DENIED = "permission_denied"
    COMMENT_ADDED = "comment_added"
@dataclass(frozen=True)
class StatusHistoryEntry:
    """
    Immutable record of a single status/event occurrence.

    Attributes:
        event_id: Unique identifier for the event.
        asset_id: Asset this event belongs to.
        event_type: Kind of event.
        from_status: Previous status (None if initial).
        to_status: New status after event (None if not a status change).
        actor_id: User/role that triggered the event.
        timestamp: UTC timestamp with microsecond precision.
        metadata: Additional context (e.g., approval_reason, comment).
    """
    event_id: str
    asset_id: str
    event_type: EventType
    from_status: Optional[AssetStatus]
    to_status: Optional[AssetStatus]
    actor_id: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize entry to plain dict for storage/transport."""
        return {
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "event_type": self.event_type.value,
            "from_status": self.from_status.value if self.from_status else None,
            "to_status": self.to_status.value if self.to_status else None,
            "actor_id": self.actor_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StatusHistoryEntry":
        """Deserialize dict to entry (ensures UTC datetime)."""
        ts = data["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
        return cls(
            event_id=data["event_id"],
            asset_id=data["asset_id"],
            event_type=EventType(data["event_type"]),
            from_status=AssetStatus(data["from_status"]) if data["from_status"] else None,
            to_status=AssetStatus(data["to_status"]) if data["to_status"] else None,
            actor_id=data["actor_id"],
            timestamp=ts,
            metadata=data.get("metadata", {}),
        )
class StatusHistoryQuery(BaseModel):
    """Query parameters for history retrieval."""
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    event_type: Optional[EventType] = None
    from_timestamp: Optional[datetime] = None
    to_timestamp: Optional[datetime] = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
class StatusHistoryStore:
    """
    In-memory store for status history (replace with DB-backed impl in production).

    Guarantees:
      - Events are appended-only.
      - Query results are sorted by timestamp ascending.
    """

    def __init__(self) -> None:
        self._entries: List[StatusHistoryEntry] = []

    def append(self, entry: StatusHistoryEntry) -> None:
        """Append a new event (atomic in single-process)."""
        self._entries.append(entry)

    def append_batch(self, entries: List[StatusHistoryEntry]) -> None:
        """Append multiple events atomically."""
        self._entries.extend(entries)

    def query(self, criteria: StatusHistoryQuery) -> List[StatusHistoryEntry]:
        """Return events matching criteria, sorted by timestamp ascending."""
        results = self._entries
        if criteria.asset_id:
            results = [e for e in results if e.asset_id == criteria.asset_id]
        if criteria.event_type:
            results = [e for e in results if e.event_type == criteria.event_type]
        if criteria.from_timestamp:
            results = [e for e in results if e.timestamp >= criteria.from_timestamp]
        if criteria.to_timestamp:
            results = [e for e in results if e.timestamp <= criteria.to_timestamp]

        # Pagination
        start = criteria.offset
        end = start + criteria.limit
        results = results[start:end]
        return sorted(results, key=lambda e: e.timestamp)

    def for_asset(self, asset_id: str) -> List[StatusHistoryEntry]:
        """Convenience: all events for an asset, sorted."""
        return self.query(
            StatusHistoryQuery(asset_id=asset_id, limit=1000)
        )

    def clear(self) -> None:
        """Remove all entries (useful in tests)."""
        self._entries.clear()
# Module-level default store (can be swapped for a DB-backed service).
_default_store = StatusHistoryStore()
def get_default_store() -> StatusHistoryStore:
    """Expose the default store for dependency injection in tests/app layer."""
    return _default_store
def record_event(
    asset_id: str,
    event_type: EventType,
    actor_id: str,
    from_status: Optional[AssetStatus] = None,
    to_status: Optional[AssetStatus] = None,
    metadata: Optional[Dict[str, Any]] = None,
    event_id: Optional[str] = None,
) -> StatusHistoryEntry:
    """
    High-level helper to create and persist a status/event record.

    Ensures:
      - UTC timestamps.
      - Deterministic event_id when not provided (timestamp-based).
    """
    import uuid
    from src.domain.services.status_history_service import StatusHistoryService

    entry = StatusHistoryEntry(
        event_id=event_id or str(uuid.uuid4()),
        asset_id=asset_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_id=actor_id,
        metadata=metadata or {},
    )
    store = get_default_store()
    store.append(entry)
    return entry