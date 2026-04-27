"""Create work_order and approval_record tables.

Revision ID: 001
Revises: -
Create Date: 2025-01-01 00:00:00.000000

This migration creates the core tables for the multi-level approval workflow:

- ``work_order``: Stores work orders with status and version fields.
  The ``status`` column uses an ENUM that encodes the full state-machine:
  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED,
  with REJECTED and CANCELLED as terminal / side states.
  The ``version`` column enables optimistic locking to prevent concurrent
  approval conflicts (HTTP 409 on stale updates).

- ``approval_record``: Persists every approval action (approve / reject)
  for audit traceability.  Each row records the operator, the action taken,
  an optional comment, and — for rejections — the mandatory
  ``rejection_reason`` (max 500 chars, enforced at the DB level as a
  CHECK constraint when action = 'REJECT').
"""

from alembic import op
import sqlalchemy as sa


# Revision identifiers used by Alembic
revision = "001"
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
            "asset_id",
            sa.BigInteger(),
            nullable=True,
            comment="FK to the associated asset (if any)",
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "APPROVING_LEVEL_1",
                "APPROVING_LEVEL_2",
                "APPROVED",
                "REJECTED",
                "CANCELLED",
                name="orderstatus",
            ),
            nullable=False,
            server_default="PENDING",
            comment=(
                "Current state in the approval state machine. "
                "Valid transitions are enforced by the backend "
                "OrderStateMachine."
            ),
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment=(
                "Optimistic-lock version counter.  Incremented on every "
                "update; stale updates are rejected (HTTP 409)."
            ),
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
        comment="Filter work orders by approval status",
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
        comment="Sort / filter orders by creation time",
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
            comment="FK to work_order.id — the order being acted upon",
        ),
        sa.Column(
            "operator_id",
            sa.BigInteger(),
            nullable=False,
            comment="FK to the user who performed the approval action",
        ),
        sa.Column(
            "action",
            sa.Enum(
                "APPROVE",
                "REJECT",
                name="approvalaction",
            ),
            nullable=False,
            comment="The approval action taken (APPROVE or REJECT)",
        ),
        sa.Column(
            "comment",
            sa.String(500),
            nullable=True,
            comment="Optional comment for approve actions",
        ),
        sa.Column(
            "rejection_reason",
            sa.String(500),
            nullable=True,
            comment=(
                "Mandatory reason when action = REJECT.  Enforced by "
                "backend validation (HTTP 400 if missing) and a DB-level "
                "CHECK constraint."
            ),
        ),
        sa.Column(
            "approval_level",
            sa.SmallInteger(),
            nullable=False,
            comment=(
                "Which approval level this record corresponds to: "
                "1 = department supervisor, 2 = asset manager."
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
        # CHECK constraint: if action is REJECT, rejection_reason must be
        # non-empty.  This is a defence-in-depth measure — the backend
        # also validates before reaching the DB.
        sa.CheckConstraint(
            "action != 'REJECT' OR rejection_reason IS NOT NULL",
            name="ck_approval_record_reject_requires_reason",
        ),
        sa.CheckConstraint(
            "action != 'REJECT' OR length(trim(rejection_reason)) > 0",
            name="ck_approval_record_reject_reason_nonempty",
        ),
    )

    # Indexes for approval_record
    op.create_index(
        "ix_approval_record_order_id",
        "approval_record",
        ["order_id"],
        comment="Look up all approval records for a given work order",
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
    """Drop approval_record and work_order tables."""
    op.drop_index("ix_approval_record_created_at", table_name="approval_record")
    op.drop_index("ix_approval_record_operator_id", table_name="approval_record")
    op.drop_index("ix_approval_record_order_id", table_name="approval_record")
    op.drop_table("approval_record")

    op.drop_index("ix_work_order_created_at", table_name="work_order")
    op.drop_index("ix_work_order_applicant_id", table_name="work_order")
    op.drop_index("ix_work_order_status", table_name="work_order")
    op.drop_table("work_order")

    # Drop the ENUM types (PostgreSQL-specific; no-op on SQLite / MySQL)
    op.execute("DROP TYPE IF EXISTS approvalaction")
    op.execute("DROP TYPE IF EXISTS orderstatus")