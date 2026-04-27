"""
Approval History Model
=====================

Immutable, append-only record of every approval action performed on a work order.

Each record captures:
- Which work order was acted upon (``work_order_id``)
- Who performed the action (``approver_id`` / ``approver_name``)
- What action was taken (``action``: APPROVE or REJECT)
- At which approval level the action occurred (``approval_level``: 1 or 2)
- Optional reason / comment (mandatory when action is REJECT, must be >= 10 chars)
- When the action was performed (``created_at``)

Design invariants enforced at the model level:
1. **Immutability**: Once persisted, no field may be altered.  The ``_mutable``
   sentinel is flipped to ``False`` immediately after ``__init__``, and any
   subsequent attribute assignment raises ``ApprovalRecordImmutableError``.
2. **Rejection reason validation**: When ``action`` is ``ApprovalAction.REJECT``,
   ``reason`` must be a non-empty string of at least 10 characters; otherwise
   ``InvalidRejectionReasonError`` is raised during construction.
3. **Approval level constraint**: ``approval_level`` must be 1 or 2, matching
   the two-tier approval chain (Department Manager → Asset Manager).

This model is consumed by ``ApprovalService`` to persist audit-quality records
after every state-machine transition, and by the notification layer to
determine which events to publish.
"""

from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ApprovalRecordImmutableError(RuntimeError):
    """Raised when an attempt is made to modify an already-persisted approval record."""

    def __init__(self, record_id: str, field: str) -> None:
        self.record_id = record_id
        self.field = field
        super().__init__(
            f"Approval record '{record_id}' is immutable; field '{field}' cannot be modified."
        )


class InvalidRejectionReasonError(ValueError):
    """Raised when a rejection reason fails validation (empty or < 10 characters)."""

    def __init__(self, reason: Optional[str]) -> None:
        display = repr(reason) if reason is not None else "None"
        super().__init__(
            f"Rejection reason is required and must be at least 10 characters long, got {display}."
        )


class InvalidApprovalLevelError(ValueError):
    """Raised when the approval level is not 1 or 2."""

    def __init__(self, level: int) -> None:
        super().__init__(
            f"Invalid approval level '{level}'. Must be 1 (Department Manager) or 2 (Asset Manager)."
        )


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ApprovalAction(str, Enum):
    """Enumeration of possible approval actions."""

    APPROVE = "APPROVE"
    REJECT = "REJECT"

    def __str__(self) -> str:
        return self.value


class ApprovalLevel(int, Enum):
    """Enumeration of approval chain levels.

    Level 1 corresponds to Department Manager review.
    Level 2 corresponds to Asset Manager review.
    """

    LEVEL_1 = 1
    LEVEL_2 = 2

    def __str__(self) -> str:
        return str(self.value)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REJECTION_REASON_MIN_LENGTH: int = 10


# ---------------------------------------------------------------------------
# Approval History Record
# ---------------------------------------------------------------------------

class ApprovalHistoryRecord:
    """Single, immutable record of an approval action on a work order.

    Parameters
    ----------
    work_order_id : str
        The unique identifier of the work order this record belongs to.
    approver_id : str
        The unique identifier of the user who performed the approval action.
    approver_name : str
        Human-readable name of the approver (for display / audit purposes).
    action : ApprovalAction
        The action taken — ``APPROVE`` or ``REJECT``.
    approval_level : ApprovalLevel
        The level in the approval chain at which this action was taken.
    reason : str | None
        Optional comment.  **Mandatory** when ``action`` is ``REJECT`` and
        must be at least ``REJECTION_REASON_MIN_LENGTH`` characters.
    record_id : str | None
        Optional pre-generated unique identifier.  If ``None``, a new UUID4
        is generated automatically.
    created_at : datetime.datetime | None
        Optional timestamp.  If ``None``, ``datetime.datetime.utcnow()`` is
        used.

    Raises
    ------
    InvalidRejectionReasonError
        If ``action`` is ``REJECT`` and ``reason`` is empty or shorter than
        ``REJECTION_REASON_MIN_LENGTH`` characters.
    InvalidApprovalLevelError
        If ``approval_level`` is not 1 or 2.
    """

    __slots__ = (
        "_record_id",
        "_work_order_id",
        "_approver_id",
        "_approver_name",
        "_action",
        "_approval_level",
        "_reason",
        "_created_at",
        "_mutable",
    )

    def __init__(
        self,
        work_order_id: str,
        approver_id: str,
        approver_name: str,
        action: ApprovalAction,
        approval_level: ApprovalLevel,
        reason: Optional[str] = None,
        record_id: Optional[str] = None,
        created_at: Optional[datetime.datetime] = None,
    ) -> None:
        # --- Validate rejection reason early --------------------------------
        if action == ApprovalAction.REJECT:
            if not reason or len(reason.strip()) < REJECTION_REASON_MIN_LENGTH:
                raise InvalidRejectionReasonError(reason)

        # --- Validate approval level ----------------------------------------
        if approval_level not in (ApprovalLevel.LEVEL_1, ApprovalLevel.LEVEL_2):
            raise InvalidApprovalLevelError(int(approval_level))

        # --- Assign fields --------------------------------------------------
        self._record_id: str = record_id or str(uuid.uuid4())
        self._work_order_id: str = work_order_id
        self._approver_id: str = approver_id
        self._approver_name: str = approver_name
        self._action: ApprovalAction = action
        self._approval_level: ApprovalLevel = approval_level
        self._reason: Optional[str] = reason
        self._created_at: datetime.datetime = (
            created_at if created_at is not None else datetime.datetime.utcnow()
        )

        # Lock the record immediately — append-only semantics
        self._mutable: bool = False

    # -- Immutability guard --------------------------------------------------

    def __setattr__(self, name: str, value: object) -> None:
        if name.startswith("_") and hasattr(self, "_mutable") and not self._mutable:
            raise ApprovalRecordImmutableError(self._record_id, name)
        super().__setattr__(name, value)

    def __delattr__(self, name: str) -> None:
        raise ApprovalRecordImmutableError(self._record_id, name)

    # -- Read-only properties ------------------------------------------------

    @property
    def record_id(self) -> str:
        """Unique identifier for this approval record."""
        return self._record_id

    @property
    def work_order_id(self) -> str:
        """The work order this record belongs to."""
        return self._work_order_id

    @property
    def approver_id(self) -> str:
        """Unique identifier of the approver."""
        return self._approver_id

    @property
    def approver_name(self) -> str:
        """Human-readable name of the approver."""
        return self._approver_name

    @property
    def action(self) -> ApprovalAction:
        """The action taken (APPROVE or REJECT)."""
        return self._action

    @property
    def approval_level(self) -> ApprovalLevel:
        """The approval chain level (1 = Dept Manager, 2 = Asset Manager)."""
        return self._approval_level

    @property
    def reason(self) -> Optional[str]:
        """Optional reason / comment (mandatory for REJECT actions)."""
        return self._reason

    @property
    def created_at(self) -> datetime.datetime:
        """Timestamp when this record was created."""
        return self._created_at

    # -- Serialization helpers -----------------------------------------------

    def to_dict(self) -> dict:
        """Serialize the record to a plain dictionary.

        Returns
        -------
        dict
            Dictionary representation suitable for JSON serialization or
            database persistence.
        """
        return {
            "record_id": self._record_id,
            "work_order_id": self._work_order_id,
            "approver_id": self._approver_id,
            "approver_name": self._approver_name,
            "action": self._action.value,
            "approval_level": int(self._approval_level),
            "reason": self._reason,
            "created_at": self._created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> ApprovalHistoryRecord:
        """Deserialize a dictionary back into an ``ApprovalHistoryRecord``.

        Parameters
        ----------
        data : dict
            Dictionary previously produced by :meth:`to_dict`.

        Returns
        -------
        ApprovalHistoryRecord
            Reconstructed immutable record.
        """
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.datetime.fromisoformat(created_at)

        return cls(
            work_order_id=data["work_order_id"],
            approver_id=data["approver_id"],
            approver_name=data["approver_name"],
            action=ApprovalAction(data["action"]),
            approval_level=ApprovalLevel(int(data["approval_level"])),
            reason=data.get("reason"),
            record_id=data.get("record_id"),
            created_at=created_at,
        )

    # -- String representations ----------------------------------------------

    def __repr__(self) -> str:
        return (
            f"ApprovalHistoryRecord("
            f"record_id={self._record_id!r}, "
            f"work_order_id={self._work_order_id!r}, "
            f"approver={self._approver_name!r}, "
            f"action={self._action.value!r}, "
            f"level={int(self._approval_level)}, "
            f"created_at={self._created_at.isoformat()!r}"
            f")"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ApprovalHistoryRecord):
            return NotImplemented
        return self._record_id == other._record_id

    def __hash__(self) -> int:
        return hash(self._record_id)


# ---------------------------------------------------------------------------
# Approval History (collection)
# ---------------------------------------------------------------------------

class ApprovalHistory:
    """Append-only collection of :class:`ApprovalHistoryRecord` instances.

    This container enforces the append-only invariant: records can be added
    but never removed or replaced.  It is the primary data structure passed
    between the approval service layer and persistence layer.

    Parameters
    ----------
    records : list[ApprovalHistoryRecord] | None
        Optional initial list of records.  Each record is validated for
        consistency (same ``work_order_id``) upon insertion.
    work_order_id : str | None
        If provided, all appended records must share this work order ID.
    """

    def __init__(
        self,
        records: Optional[list[ApprovalHistoryRecord]] = None,
        work_order_id: Optional[str] = None,
    ) -> None:
        self._work_order_id: Optional[str] = work_order_id
        self._records: list[ApprovalHistoryRecord] = []
        if records:
            for rec in records:
                self.append(rec)

    @property
    def work_order_id(self) -> Optional[str]:
        """The work order ID that all records in this history belong to."""
        return self._work_order_id

    @property
    def records(self) -> list[ApprovalHistoryRecord]:
        """Return a shallow copy of the internal record list."""
        return list(self._records)

    def append(self, record: ApprovalHistoryRecord) -> None:
        """Append a new record to the history.

        Parameters
        ----------
        record : ApprovalHistoryRecord
            The record to append.

        Raises
        ------
        ValueError
            If the record's ``work_order_id`` does not match the history's
            bound ``work_order_id`` (when set).
        """
        if self._work_order_id is not None and record.work_order_id != self._work_order_id:
            raise ValueError(
                f"Record work_order_id '{record.work_order_id}' does not match "
                f"history work_order_id '{self._work_order_id}'."
            )
        if self._work_order_id is None and self._records:
            # Auto-bind on first append
            self._work_order_id = record.work_order_id
        self._records.append(record)

    def __len__(self) -> int:
        return len(self._records)

    def __iter__(self):
        return iter(self._records)

    def __getitem__(self, index: int) -> ApprovalHistoryRecord:
        return self._records[index]

    def __repr__(self) -> str:
        return (
            f"ApprovalHistory(work_order_id={self._work_order_id!r}, "
            f"count={len(self._records)})"
        )