"""Add audit_logs table for operation audit trail.

Revision ID: a3f8b2c1d4e5
Revises: 001_create_workorder_tables
Create Date: 2025-01-15 10:00:00.000000

This migration creates the `audit_logs` table which stores operation
audit records for the audit log dashboard. The table supports:
- Multi-dimensional filtering (time range, action_type, operator_id)
- Paginated queries with deep-pagination safeguards
- Trend aggregation by adaptive time granularity

Key design decisions:
- All timestamps are stored in UTC (ISO 8601) per SPEC constraint
- Composite index (action_type, operator_id, created_at) optimizes
  the most common filtered time-range query pattern
- action_type uses VARCHAR(64) rather than ENUM to allow dynamic
  extension via /api/v1/audit-log/meta endpoint without schema migration
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a3f8b2c1d4e5"
down_revision = "001_create_workorder_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create audit_logs table with composite index for dashboard queries.

    The audit_logs table captures every auditable operation in the system.
    Columns are designed to support the audit dashboard's filtering
    (by action_type, operator_id, time range) and trend aggregation
    (by created_at with adaptive granularity) requirements.
    """
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key, auto-incremented audit log entry ID",
        ),
        sa.Column(
            "action_type",
            sa.String(length=64),
            nullable=False,
            comment="Operation type enum value (e.g. LOGIN, CREATE, UPDATE, DELETE), "
                    "dynamically extensible via /api/v1/audit-log/meta",
        ),
        sa.Column(
            "operator_id",
            sa.String(length=64),
            nullable=False,
            comment="ID of the user who performed the operation",
        ),
        sa.Column(
            "operator_name",
            sa.String(length=128),
            nullable=True,
            comment="Display name of the operator at the time of action",
        ),
        sa.Column(
            "resource_type",
            sa.String(length=64),
            nullable=True,
            comment="Type of the affected resource (e.g. asset, workorder, retirement)",
        ),
        sa.Column(
            "resource_id",
            sa.String(length=64),
            nullable=True,
            comment="ID of the affected resource",
        ),
        sa.Column(
            "detail",
            sa.Text(),
            nullable=True,
            comment="JSON-serializable detail of the operation, "
                    "including before/after field values",
        ),
        sa.Column(
            "ip_address",
            sa.String(length=45),
            nullable=True,
            comment="Client IP address (supports both IPv4 and IPv6)",
        ),
        sa.Column(
            "user_agent",
            sa.String(length=512),
            nullable=True,
            comment="Client User-Agent header for device identification",
        ),
        sa.Column(
            "request_id",
            sa.String(length=64),
            nullable=True,
            comment="Unique request correlation ID for distributed tracing",
        ),
        sa.Column(
            "tenant_id",
            sa.String(length=64),
            nullable=True,
            comment="Tenant ID for multi-tenant data isolation",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            comment="UTC timestamp when the audit event was recorded (ISO 8601)",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
    )

    # Composite index optimizes the primary dashboard query pattern:
    #   WHERE action_type = ? AND operator_id = ? AND created_at BETWEEN ? AND ?
    # This aligns with SPEC requirement for multi-dimensional filtering
    # and ensures time-range queries perform efficiently.
    op.create_index(
        "ix_audit_logs_action_operator_created",
        "audit_logs",
        ["action_type", "operator_id", "created_at"],
        unique=False,
    )

    # Additional index for operator-only filtered queries (e.g. "all actions by user X")
    op.create_index(
        "ix_audit_logs_operator_id",
        "audit_logs",
        ["operator_id"],
        unique=False,
    )

    # Additional index for time-range-only queries (e.g. trend aggregation)
    op.create_index(
        "ix_audit_logs_created_at",
        "audit_logs",
        ["created_at"],
        unique=False,
    )

    # Index for resource-level audit trail queries
    op.create_index(
        "ix_audit_logs_resource",
        "audit_logs",
        ["resource_type", "resource_id"],
        unique=False,
    )

    # Index for tenant isolation queries
    op.create_index(
        "ix_audit_logs_tenant_id",
        "audit_logs",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop audit_logs table and all associated indexes.

    Removes the audit_logs table and its indexes in reverse order
    of creation to ensure clean rollback.
    """
    op.drop_index("ix_audit_logs_tenant_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_operator_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action_operator_created", table_name="audit_logs")
    op.drop_table("audit_logs")