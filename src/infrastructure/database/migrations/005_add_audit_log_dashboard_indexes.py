"""
Migration 005: Add audit_log dashboard aggregation indexes.

Phase 4 — Audit Dashboard backend support.

This migration adds database indexes to the ``audit_log`` table that are
required by the AuditDashboardController aggregation queries (time trend,
operation-type distribution, and operator-activity ranking).

Index strategy
-------------
1. **Composite index** ``ix_audit_log_dashboard`` on
   ``(created_at, operation_type, operator_id)`` — the leading column
   ``created_at`` satisfies the mandatory time-range filter present in
   every dashboard query.  The trailing columns allow the database to
   perform index-only scans for ``GROUP BY operation_type`` and
   ``GROUP BY operator_id`` without touching the heap.

2. **Single-column index** ``ix_audit_log_created_at`` on ``created_at``
   alone — guarantees optimal performance for pure time-range scans
   (e.g. the trend endpoint when no secondary grouping is needed) and
   serves as a fallback when the query planner chooses a different plan.

Both indexes are created with ``IF NOT EXISTS`` guards so the migration
is idempotent and safe to re-run.

Downgrade
---------
All added indexes are dropped in the downgrade path.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create indexes required by the audit dashboard aggregation APIs.

    Indexes created:
    - ``ix_audit_log_dashboard``: composite (created_at, operation_type, operator_id)
    - ``ix_audit_log_created_at``: single-column on created_at
    """
    # Composite index — covers all three dashboard query patterns:
    #   trend (GROUP BY time bucket), type distribution (GROUP BY operation_type),
    #   operator ranking (GROUP BY operator_id).
    op.create_index(
        "ix_audit_log_dashboard",
        "audit_log",
        ["created_at", "operation_type", "operator_id"],
        unique=False,
        if_not_exists=True,
    )

    # Standalone created_at index — benefits pure time-range scans and
    # acts as a safety net for the query planner.
    op.create_index(
        "ix_audit_log_created_at",
        "audit_log",
        ["created_at"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    """Remove the dashboard-specific indexes from audit_log."""
    op.drop_index("ix_audit_log_created_at", table_name="audit_log")
    op.drop_index("ix_audit_log_dashboard", table_name="audit_log")