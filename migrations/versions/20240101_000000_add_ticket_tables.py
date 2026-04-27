"""Add work_order and approval_record tables for multi-level approval workflow.

Revision ID: 20240101_000000
Revises: -
Create Date: 2024-01-01 00:00:00.000000

This migration creates the core database schema for the ticket/work-order
multi-level approval system:

- ``work_order``: Stores work orders with status and optimistic-lock version.
  Status values follow the state machine:
  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED,
  with REJECTED and CANCELLED as terminal/branch states.

- ``approval_record``: Immutable audit trail for every approval action
  performed on a work order, recording the operator, action type,
  optional comment, and mandatory rejection_reason when rejecting.
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers used by Alembic
revision = "20240101_000000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create work_order and approval_record tables."""
    # ------------------------------------------------------------------
    # 1. work_order table
    # ------------------------------------------------------------------
    op.create_table(
        "work_order",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key, auto-increment work order ID",
        ),
        sa.Column(
            "order_no",
            sa.String(64),
            nullable=False,
            unique=True,
            comment="Business-visible work order number (unique)",
        ),
        sa.Column(
            "title",
            sa.String(255),
            nullable=False,
            comment="Short title / summary of the work order",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Detailed description of the work order",
        ),
        sa.Column(
            "applicant_id",
            sa.BigInteger(),
            nullable=False,
            comment="FK to the user who submitted the work order",
        ),
        sa.Column(
            "department_id",
            sa.BigInteger(),
            nullable=True,
            comment="FK to the department of the applicant",
        ),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="PENDING",
            comment=(
                "Current state in the approval state machine: "
                "PENDING | APPROVING_LEVEL_1 | APPROVING_LEVEL_2 | "
                "APPROVED | REJECTED | CANCELLED"
            ),
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Optimistic-lock version counter; incremented on every update",
        ),
        sa.Column(
            "rejection_reason",
            sa.String(500),
            nullable=True,
            comment="Populated when the order is REJECTED; max 500 characters",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Timestamp when the work order was created (ISO 8601)",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
            comment="Timestamp of the last update (ISO 8601)",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_work_order"),
    )

    # Indexes for common query patterns
    op.create_index(
        "ix_work_order_status",
        "work_order",
        ["status"],
        comment="Filter work orders by approval status (role-based list queries)",
    )
    op.create_index(
        "ix_work_order_applicant_id",
        "work_order",
        ["applicant_id"],
        comment="Look up orders submitted by a specific user",
    )
    op.create_index(
        "ix_work_order_created_at",
        "work_order",
        ["created_at"],
        comment="Sort / filter orders by submission time",
    )

    # ------------------------------------------------------------------
    # 2. approval_record table
    # ------------------------------------------------------------------
    op.create_table(
        "approval_record",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key, auto-increment approval record ID",
        ),
        sa.Column(
            "order_id",
            sa.BigInteger(),
            nullable=False,
            comment="FK to work_order.id; the order this record belongs to",
        ),
        sa.Column(
            "operator_id",
            sa.BigInteger(),
            nullable=False,
            comment="FK to the user who performed the approval action",
        ),
        sa.Column(
            "action",
            sa.String(32),
            nullable=False,
            comment=(
                "Approval action taken: "
                "APPROVE_LEVEL_1 | APPROVE_LEVEL_2 | REJECT | CANCEL"
            ),
        ),
        sa.Column(
            "comment",
            sa.Text(),
            nullable=True,
            comment="Optional free-text comment left by the approver",
        ),
        sa.Column(
            "rejection_reason",
            sa.String(500),
            nullable=True,
            comment=(
                "Mandatory when action=REJECT; must be a non-empty string "
                "with a maximum of 500 characters"
            ),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Timestamp when the approval action was recorded (ISO 8601)",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_approval_record"),
        sa.ForeignKeyConstraint(
            ["order_id"],
            ["work_order.id"],
            name="fk_approval_record_order_id",
            ondelete="CASCADE",
        ),
    )

    # Indexes for approval record queries
    op.create_index(
        "ix_approval_record_order_id",
        "approval_record",
        ["order_id"],
        comment="Retrieve all approval records for a given work order",
    )
    op.create_index(
        "ix_approval_record_operator_id",
        "approval_record",
        ["operator_id"],
        comment="Look up approval actions performed by a specific user",
    )
    op.create_index(
        "ix_approval_record_created_at",
        "approval_record",
        ["created_at"],
        comment="Sort approval records chronologically",
    )


def downgrade() -> None:
    """Drop approval_record and work_order tables in reverse dependency order."""
    op.drop_index("ix_approval_record_created_at", table_name="approval_record")
    op.drop_index("ix_approval_record_operator_id", table_name="approval_record")
    op.drop_index("ix_approval_record_order_id", table_name="approval_record")
    op.drop_table("approval_record")

    op.drop_index("ix_work_order_created_at", table_name="work_order")
    op.drop_index("ix_work_order_applicant_id", table_name="work_order")
    op.drop_index("ix_work_order_status", table_name="work_order")
    op.drop_table("work_order")