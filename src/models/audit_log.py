"""
Audit Log Model

Defines the SQLAlchemy ORM model for the ``audit_log`` table, which records
all system operations for security auditing, compliance, and dashboard
visualization purposes.

This model is the foundation for the Audit Dashboard aggregation APIs,
providing database-level indexes on ``(created_at, operation_type,
operator_id)`` to ensure performant GROUP BY / DATE_TRUNC queries at
million-row scale.

Index Strategy
-------------
- Individual indexes on ``created_at``, ``operation_type``, ``operator_id``,
  and ``tenant_id`` for single-column predicate push-down.
- Composite index ``ix_audit_log_dashboard_agg`` on
  ``(created_at, operation_type, operator_id)`` to cover the three core
  dashboard aggregation queries (time trend, type distribution, operator
  activity) without extra lookups.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class AuditLog(Base):
    """SQLAlchemy ORM model representing a single audit log entry.

    Each row is an **immutable** record of an auditable operation performed
    within the system.  The table is append-only; no updates or deletes
    should be issued against it in normal operation.

    The model supports three dashboard aggregation dimensions:

    1. **Time trend** – grouped by ``created_at`` (hour / day / month).
    2. **Operation type distribution** – grouped by ``operation_type``.
    3. **Operator activity** – grouped by ``operator_id``.

    Attributes:
        id: Auto-incrementing primary key.
        operation_type: Machine-readable operation category
            (e.g. ``"CREATE"``, ``"UPDATE"``, ``"DELETE"``, ``"LOGIN"``).
        operator_id: Foreign-key reference to the user who performed the
            operation.
        operator_name: Human-readable display name of the operator
            (denormalised for query convenience).
        resource_type: Logical type of the affected resource
            (e.g. ``"asset"``, ``"workorder"``, ``"retirement"``).
        resource_id: Identifier of the affected resource instance.
        action: Free-text summary of the specific action taken.
        details: Structured payload (JSON) carrying before/after snapshots,
            changed fields, or other contextual metadata.
        ip_address: Client IP address at the time of the operation.
        user_agent: Client User-Agent header (truncated).
        tenant_id: Multi-tenancy isolation key; ``NULL`` for system-level
            operations.
        status: Result of the operation (``"success"`` / ``"failure"``).
        error_message: Error description when *status* is ``"failure"``.
        created_at: UTC timestamp when the entry was created; defaults to
            ``now()`` at insert time.
    """

    __tablename__ = "audit_log"

    # ── Primary Key ────────────────────────────────────────────────────
    id: int = Column(BigInteger, primary_key=True, autoincrement=True)

    # ── Core audit fields ──────────────────────────────────────────────
    operation_type: str = Column(
        String(64), nullable=False, index=True,
        comment="Operation category (CREATE, UPDATE, DELETE, LOGIN, …)",
    )
    operator_id: int = Column(
        BigInteger, nullable=False, index=True,
        comment="ID of the user who performed the operation",
    )
    operator_name: Optional[str] = Column(
        String(128), nullable=True,
        comment="Display name of the operator (denormalised)",
    )

    # ── Resource context ───────────────────────────────────────────────
    resource_type: Optional[str] = Column(
        String(64), nullable=True,
        comment="Logical type of the affected resource",
    )
    resource_id: Optional[str] = Column(
        String(128), nullable=True,
        comment="Identifier of the affected resource instance",
    )
    action: Optional[str] = Column(
        String(256), nullable=True,
        comment="Free-text summary of the action taken",
    )

    # ── Payload & metadata ─────────────────────────────────────────────
    details: Optional[Dict[str, Any]] = Column(
        JSONB, nullable=True,
        comment="Structured payload (before/after snapshots, changed fields)",
    )
    ip_address: Optional[str] = Column(
        String(45), nullable=True,
        comment="Client IP address (supports IPv6)",
    )
    user_agent: Optional[str] = Column(
        String(512), nullable=True,
        comment="Client User-Agent header",
    )
    tenant_id: Optional[str] = Column(
        String(64), nullable=True, index=True,
        comment="Multi-tenancy isolation key",
    )

    # ── Result tracking ────────────────────────────────────────────────
    status: Optional[str] = Column(
        String(16), nullable=True,
        comment="Operation result: success / failure",
    )
    error_message: Optional[str] = Column(
        Text, nullable=True,
        comment="Error description when status is failure",
    )

    # ── Timestamp ──────────────────────────────────────────────────────
    created_at: datetime = Column(
        DateTime, nullable=False, default=datetime.utcnow, index=True,
        comment="UTC timestamp of when the entry was created",
    )

    # ── Table-level constraints & indexes ──────────────────────────────
    __table_args__ = (
        Index(
            "ix_audit_log_dashboard_agg",
            "created_at",
            "operation_type",
            "operator_id",
        ),
        {
            "comment": (
                "Append-only audit trail recording all auditable system "
                "operations.  Supports dashboard aggregation via composite "
                "index on (created_at, operation_type, operator_id)."
            ),
        },
    )

    # ── Serialization helpers ──────────────────────────────────────────

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the audit log entry to a plain dictionary.

        Returns:
            A dictionary containing all model fields with ``created_at``
            converted to an ISO-8601 string.
        """
        return {
            "id": self.id,
            "operation_type": self.operation_type,
            "operator_id": self.operator_id,
            "operator_name": self.operator_name,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "action": self.action,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "tenant_id": self.tenant_id,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        """Return a concise, unambiguous string representation.

        Returns:
            A string in the form
            ``<AuditLog id=42 operation_type=CREATE operator_id=1>``.
        """
        return (
            f"<AuditLog id={self.id} "
            f"operation_type={self.operation_type!r} "
            f"operator_id={self.operator_id}>"
        )