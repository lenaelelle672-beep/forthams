"""Add approval tables for multi-level approval workflow.

This migration creates the approval_record table and updates the work_order
table status enum to support the two-level approval chain:
PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
with REJECTED and CANCELLED as terminal states.

Revision ID: xxx_add_approval_tables
Revises: 20240101_000000_add_ticket_tables
Create Date: 2025-01-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "xxx_add_approval_tables"
down_revision = "20240101_000000_add_ticket_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create approval_record table and update work_order status enum.

    The approval_record table stores immutable audit trails for each approval
    action performed on a work order. Records are append-only; no UPDATE or
    DELETE operations should be permitted at the application layer.

    The work_order status column is altered to use an expanded ENUM that
    includes the multi-level approval states:
      PENDING, APPROVING_LEVEL_1, APPROVING_LEVEL_2, APPROVED, REJECTED, CANCELLED
    """
    # ------------------------------------------------------------------
    # 1. Create the new approval status ENUM type (PostgreSQL)
    # ------------------------------------------------------------------
    approval_status_enum = postgresql.ENUM(
        "PENDING",
        "APPROVING_LEVEL_1",
        "APPROVING_LEVEL_2",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        name="approvalstatus",
        create_type=True,
    )
    approval_status_enum.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # 2. Create approval_action ENUM type for the action column
    # ------------------------------------------------------------------
    approval_action_enum = postgresql.ENUM(
        "SUBMIT",
        "APPROVE_LEVEL_1",
        "APPROVE_LEVEL_2",
        "REJECT",
        "CANCEL",
        name="approvalaction",
        create_type=True,
    )
    approval_action_enum.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # 3. Create approval_record table
    # ------------------------------------------------------------------
    op.create_table(
        "approval_record",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key, auto-incremented approval record ID",
        ),
        sa.Column(
            "work_order_id",
            sa.String(length=64),
            nullable=False,
            comment="Foreign key referencing the work order being approved",
        ),
        sa.Column(
            "approval_level",
            sa.SmallInteger(),
            nullable=False,
            comment="Approval level: 1 = department supervisor, 2 = asset manager",
        ),
        sa.Column(
            "action",
            approval_action_enum,
            nullable=False,
            comment="Approval action taken: SUBMIT, APPROVE_LEVEL_1, APPROVE_LEVEL_2, REJECT, CANCEL",
        ),
        sa.Column(
            "approver_id",
            sa.String(length=64),
            nullable=False,
            comment="ID of the user who performed the approval action",
        ),
        sa.Column(
            "approver_name",
            sa.String(length=128),
            nullable=True,
            comment="Display name of the approver (denormalized for audit readability)",
        ),
        sa.Column(
            "approver_role",
            sa.String(length=64),
            nullable=False,
            comment="Role of the approver at the time of action, e.g. DEPT_SUPERVISOR, ASSET_ADMIN",
        ),
        sa.Column(
            "comment",
            sa.Text(),
            nullable=True,
            comment="Optional comment or opinion provided by the approver",
        ),
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment="Mandatory when action is REJECT; must be >= 10 characters per business rule",
        ),
        sa.Column(
            "previous_status",
            approval_status_enum,
            nullable=False,
            comment="Work order status before this approval action",
        ),
        sa.Column(
            "new_status",
            approval_status_enum,
            nullable=False,
            comment="Work order status after this approval action",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Timestamp when the approval record was created (immutable)",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_approval_record"),
    )

    # ------------------------------------------------------------------
    # 4. Indexes for approval_record
    # ------------------------------------------------------------------
    op.create_index(
        "ix_approval_record_work_order_id",
        "approval_record",
        ["work_order_id"],
        unique=False,
    )
    op.create_index(
        "ix_approval_record_approver_id",
        "approval_record",
        ["approver_id"],
        unique=False,
    )
    op.create_index(
        "ix_approval_record_action",
        "approval_record",
        ["action"],
        unique=False,
    )
    op.create_index(
        "ix_approval_record_created_at",
        "approval_record",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_approval_record_work_order_created",
        "approval_record",
        ["work_order_id", "created_at"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 5. Add foreign key from approval_record to work_order
    # ------------------------------------------------------------------
    op.create_foreign_key(
        "fk_approval_record_work_order_id",
        "approval_record",
        "work_order",
        ["work_order_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ------------------------------------------------------------------
    # 6. Update work_order table: alter status column to use new ENUM
    # ------------------------------------------------------------------
    # For PostgreSQL: alter the existing status column type to the expanded
    # approvalstatus ENUM that includes APPROVING_LEVEL_1 and APPROVING_LEVEL_2.
    # Using ALTER TYPE ... ADD VALUE for safe in-place migration.
    op.execute(
        "ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'APPROVING_LEVEL_1'"
    )
    op.execute(
        "ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'APPROVING_LEVEL_2'"
    )
    op.execute(
        "ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'APPROVED'"
    )
    op.execute(
        "ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'REJECTED'"
    )
    op.execute(
        "ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'CANCELLED'"
    )
    op.execute(
        "ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'PENDING'"
    )

    # ------------------------------------------------------------------
    # 7. Add rejection_reason column to work_order table
    # ------------------------------------------------------------------
    op.add_column(
        "work_order",
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment="Rejection reason when work order is rejected; required if status is REJECTED",
        ),
    )

    # ------------------------------------------------------------------
    # 8. Add current_approval_level column to work_order table
    # ------------------------------------------------------------------
    op.add_column(
        "work_order",
        sa.Column(
            "current_approval_level",
            sa.SmallInteger(),
            nullable=True,
            server_default=sa.text("0"),
            comment="Current approval level: 0=pending, 1=level-1 review, 2=level-2 review",
        ),
    )


def downgrade() -> None:
    """Revert approval schema changes.

    Drops the approval_record table, removes added columns from work_order,
    and reverts the ENUM type changes.

    WARNING: This downgrade will permanently delete all approval records.
    Approval records are designed to be immutable audit trails; use with
    extreme caution in production environments.
    """
    # ------------------------------------------------------------------
    # 1. Remove added columns from work_order
    # ------------------------------------------------------------------
    op.drop_column("work_order", "current_approval_level")
    op.drop_column("work_order", "rejection_reason")

    # ------------------------------------------------------------------
    # 2. Drop approval_record table and its indexes
    # ------------------------------------------------------------------
    op.drop_constraint(
        "fk_approval_record_work_order_id",
        "approval_record",
        type_="foreignkey",
    )
    op.drop_index("ix_approval_record_work_order_created", table_name="approval_record")
    op.drop_index("ix_approval_record_created_at", table_name="approval_record")
    op.drop_index("ix_approval_record_action", table_name="approval_record")
    op.drop_index("ix_approval_record_approver_id", table_name="approval_record")
    op.drop_index("ix_approval_record_work_order_id", table_name="approval_record")
    op.drop_table("approval_record")

    # ------------------------------------------------------------------
    # 3. Drop ENUM types
    # ------------------------------------------------------------------
    approval_action_enum = postgresql.ENUM(name="approvalaction", create_type=False)
    approval_action_enum.drop(op.get_bind(), checkfirst=True)

    # Note: We do NOT drop the approvalstatus ENUM in downgrade because
    # PostgreSQL does not support removing individual ENUM values, and
    # the ENUM may still be referenced by the work_order.status column.
    # A full downgrade would require recreating the ENUM without the
    # added values, which is a destructive operation requiring table locks.