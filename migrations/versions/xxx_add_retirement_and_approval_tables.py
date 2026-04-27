"""Add retirement and approval tables.

Revision ID: xxx_add_retirement_and_approval
Revises: 001_create_depreciation_tables
Create Date: 2025-01-15 00:00:00.000000

This migration introduces the database schema required for the multi-level
approval workflow and asset retirement process, including:

- ``approval_record``: Immutable audit trail for every approval / rejection
  action performed on a work order.  Records are append-only; no UPDATE or
  DELETE is permitted at the application level.
- ``notification_record``: In-app notification entries generated
  asynchronously after each approval event.
- ``retirement_request``: Asset retirement request header.
- ``retirement_approval_record``: Approval records specific to the retirement
  flow (mirrors ``approval_record`` structure for isolation).
- ``retirement_history``: Lifecycle history entries for retired assets.
- Alters ``work_order.status`` to the expanded enum that supports the
  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED / REJECTED /
  CANCELLED state machine.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ── Revision metadata ────────────────────────────────────────────────
revision = "xxx_add_retirement_and_approval"
down_revision = "001_create_depreciation_tables"
branch_labels = None
depends_on = None

# ── Enum definitions ─────────────────────────────────────────────────

# Work-order status – expanded to support the two-level approval chain.
work_order_status_enum = postgresql.ENUM(
    "PENDING",
    "APPROVING_LEVEL_1",
    "APPROVING_LEVEL_2",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    name="workorderstatus",
    create_type=False,
)

# Approval action taken by an approver.
approval_action_enum = postgresql.ENUM(
    "APPROVE",
    "REJECT",
    name="approvalaction",
    create_type=False,
)

# Approval level (1 = department supervisor, 2 = asset administrator).
approval_level_enum = postgresql.ENUM(
    "LEVEL_1",
    "LEVEL_2",
    name="approvallevel",
    create_type=False,
)

# Notification type for in-app notifications.
notification_type_enum = postgresql.ENUM(
    "APPROVAL_PASSED",
    "APPROVAL_REJECTED",
    "APPROVAL_PENDING",
    name="notificationtype",
    create_type=False,
)

# Retirement request status.
retirement_status_enum = postgresql.ENUM(
    "DRAFT",
    "SUBMITTED",
    "APPROVING_LEVEL_1",
    "APPROVING_LEVEL_2",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    name="retirementstatus",
    create_type=False,
)


def upgrade() -> None:
    """Apply schema changes for retirement and approval tables."""

    # ── 1. Create enum types ─────────────────────────────────────────
    work_order_status_enum.create(op.get_bind(), checkfirst=True)
    approval_action_enum.create(op.get_bind(), checkfirst=True)
    approval_level_enum.create(op.get_bind(), checkfirst=True)
    notification_type_enum.create(op.get_bind(), checkfirst=True)
    retirement_status_enum.create(op.get_bind(), checkfirst=True)

    # ── 2. approval_record table ─────────────────────────────────────
    # Immutable append-only table.  No UPDATE/DELETE should ever be issued
    # against this table at the application level (enforced via service
    # layer; DB-level triggers can be added later for defence-in-depth).
    op.create_table(
        "approval_record",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key – auto-incrementing big integer",
        ),
        sa.Column(
            "work_order_id",
            sa.BigInteger(),
            nullable=False,
            index=True,
            comment="Foreign key referencing the work order under review",
        ),
        sa.Column(
            "approver_id",
            sa.BigInteger(),
            nullable=False,
            comment="User ID of the person performing the approval action",
        ),
        sa.Column(
            "approval_level",
            approval_level_enum,
            nullable=False,
            comment="Approval level: LEVEL_1 (dept supervisor) or LEVEL_2 (asset admin)",
        ),
        sa.Column(
            "action",
            approval_action_enum,
            nullable=False,
            comment="Action taken: APPROVE or REJECT",
        ),
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment="Mandatory when action=REJECT; must be >= 10 characters",
        ),
        sa.Column(
            "comment",
            sa.Text(),
            nullable=True,
            comment="Optional free-text comment from the approver",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Immutable timestamp – set once on insert",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_order.id"],
            ondelete="CASCADE",
            name="fk_approval_record_work_order",
        ),
        sa.ForeignKeyConstraint(
            ["approver_id"],
            ["user.id"],
            ondelete="RESTRICT",
            name="fk_approval_record_approver",
        ),
        comment="Immutable approval audit trail – append only, no updates or deletes",
    )

    # Index for common query: fetch all records for a work order, ordered
    # chronologically.
    op.create_index(
        "ix_approval_record_work_order_created",
        "approval_record",
        ["work_order_id", "created_at"],
    )

    # ── 3. notification_record table ─────────────────────────────────
    # Stores in-app notifications only (no email / SMS).  Populated
    # asynchronously by the ApprovalNotificationListener.
    op.create_table(
        "notification_record",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key",
        ),
        sa.Column(
            "user_id",
            sa.BigInteger(),
            nullable=False,
            index=True,
            comment="Recipient user ID",
        ),
        sa.Column(
            "work_order_id",
            sa.BigInteger(),
            nullable=True,
            comment="Related work order ID (nullable for future notification types)",
        ),
        sa.Column(
            "notification_type",
            notification_type_enum,
            nullable=False,
            comment="Category of notification",
        ),
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
            comment="Notification body text",
        ),
        sa.Column(
            "is_read",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Whether the recipient has read the notification",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Timestamp when the notification was created",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            ondelete="CASCADE",
            name="fk_notification_record_user",
        ),
        sa.ForeignKeyConstraint(
            ["work_order_id"],
            ["work_order.id"],
            ondelete="SET NULL",
            name="fk_notification_record_work_order",
        ),
        comment="In-app notification records – async, non-blocking",
    )

    op.create_index(
        "ix_notification_record_user_unread",
        "notification_record",
        ["user_id", "is_read"],
    )

    # ── 4. retirement_request table ──────────────────────────────────
    op.create_table(
        "retirement_request",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key",
        ),
        sa.Column(
            "asset_id",
            sa.BigInteger(),
            nullable=False,
            comment="Foreign key to the asset being retired",
        ),
        sa.Column(
            "applicant_id",
            sa.BigInteger(),
            nullable=False,
            comment="User who submitted the retirement request",
        ),
        sa.Column(
            "status",
            retirement_status_enum,
            server_default="DRAFT",
            nullable=False,
            comment="Current status in the retirement approval workflow",
        ),
        sa.Column(
            "reason",
            sa.Text(),
            nullable=False,
            comment="Justification for asset retirement",
        ),
        sa.Column(
            "retirement_type",
            sa.String(50),
            nullable=True,
            comment="Type of retirement (e.g. scrap, donate, sell)",
        ),
        sa.Column(
            "estimated_value",
            sa.Numeric(precision=15, scale=2),
            nullable=True,
            comment="Estimated residual value at time of retirement request",
        ),
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when the retirement was fully approved",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Record creation timestamp",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
            comment="Record last-update timestamp",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["asset.id"],
            ondelete="RESTRICT",
            name="fk_retirement_request_asset",
        ),
        sa.ForeignKeyConstraint(
            ["applicant_id"],
            ["user.id"],
            ondelete="RESTRICT",
            name="fk_retirement_request_applicant",
        ),
        comment="Asset retirement requests with multi-level approval",
    )

    op.create_index(
        "ix_retirement_request_asset_status",
        "retirement_request",
        ["asset_id", "status"],
    )

    # ── 5. retirement_approval_record table ──────────────────────────
    # Separate from approval_record to isolate retirement-specific
    # approval audit trail while maintaining the same structure.
    op.create_table(
        "retirement_approval_record",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key",
        ),
        sa.Column(
            "retirement_request_id",
            sa.BigInteger(),
            nullable=False,
            index=True,
            comment="Foreign key to the retirement request",
        ),
        sa.Column(
            "approver_id",
            sa.BigInteger(),
            nullable=False,
            comment="User ID of the approver",
        ),
        sa.Column(
            "approval_level",
            approval_level_enum,
            nullable=False,
            comment="Approval level: LEVEL_1 or LEVEL_2",
        ),
        sa.Column(
            "action",
            approval_action_enum,
            nullable=False,
            comment="APPROVE or REJECT",
        ),
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment="Required when action=REJECT; minimum 10 characters",
        ),
        sa.Column(
            "comment",
            sa.Text(),
            nullable=True,
            comment="Optional approver comment",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Immutable timestamp",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["retirement_request_id"],
            ["retirement_request.id"],
            ondelete="CASCADE",
            name="fk_retirement_approval_record_request",
        ),
        sa.ForeignKeyConstraint(
            ["approver_id"],
            ["user.id"],
            ondelete="RESTRICT",
            name="fk_retirement_approval_record_approver",
        ),
        comment="Immutable retirement approval audit trail – append only",
    )

    op.create_index(
        "ix_retirement_approval_record_request_created",
        "retirement_approval_record",
        ["retirement_request_id", "created_at"],
    )

    # ── 6. retirement_history table ──────────────────────────────────
    op.create_table(
        "retirement_history",
        sa.Column(
            "id",
            sa.BigInteger(),
            autoincrement=True,
            nullable=False,
            comment="Primary key",
        ),
        sa.Column(
            "retirement_request_id",
            sa.BigInteger(),
            nullable=False,
            index=True,
            comment="Foreign key to the retirement request",
        ),
        sa.Column(
            "asset_id",
            sa.BigInteger(),
            nullable=False,
            comment="Foreign key to the retired asset",
        ),
        sa.Column(
            "previous_status",
            sa.String(50),
            nullable=True,
            comment="Asset status before retirement",
        ),
        sa.Column(
            "new_status",
            sa.String(50),
            nullable=False,
            comment="Asset status after retirement (e.g. RETIRED)",
        ),
        sa.Column(
            "changed_by",
            sa.BigInteger(),
            nullable=False,
            comment="User ID who triggered the status change",
        ),
        sa.Column(
            "change_reason",
            sa.Text(),
            nullable=True,
            comment="Reason for the status change",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Timestamp of the history entry",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["retirement_request_id"],
            ["retirement_request.id"],
            ondelete="CASCADE",
            name="fk_retirement_history_request",
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["asset.id"],
            ondelete="RESTRICT",
            name="fk_retirement_history_asset",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by"],
            ["user.id"],
            ondelete="RESTRICT",
            name="fk_retirement_history_changed_by",
        ),
        comment="Asset retirement lifecycle history log",
    )

    # ── 7. Alter work_order.status to expanded enum ──────────────────
    # The work_order table is expected to already exist (created by a
    # previous migration).  We alter the status column to use the new
    # expanded enum that supports the two-level approval chain.
    op.execute(
        """
        ALTER TABLE work_order
        ALTER COLUMN status TYPE workorderstatus
        USING status::text::workorderstatus
        """
    )

    # Set default for new rows to PENDING.
    op.execute(
        """
        ALTER TABLE work_order
        ALTER COLUMN status SET DEFAULT 'PENDING'
        """
    )


def downgrade() -> None:
    """Revert schema changes for retirement and approval tables."""

    # ── 7. Revert work_order.status ──────────────────────────────────
    op.execute(
        """
        ALTER TABLE work_order
        ALTER COLUMN status DROP DEFAULT
        """
    )

    # ── 6. Drop retirement_history ───────────────────────────────────
    op.drop_index("ix_retirement_approval_record_request_created")
    op.drop_table("retirement_history")

    # ── 5. Drop retirement_approval_record ───────────────────────────
    op.drop_table("retirement_approval_record")

    # ── 4. Drop retirement_request ───────────────────────────────────
    op.drop_index("ix_retirement_request_asset_status")
    op.drop_table("retirement_request")

    # ── 3. Drop notification_record ──────────────────────────────────
    op.drop_index("ix_notification_record_user_unread")
    op.drop_table("notification_record")

    # ── 2. Drop approval_record ──────────────────────────────────────
    op.drop_index("ix_approval_record_work_order_created")
    op.drop_table("approval_record")

    # ── 1. Drop enum types ───────────────────────────────────────────
    retirement_status_enum.drop(op.get_bind(), checkfirst=True)
    notification_type_enum.drop(op.get_bind(), checkfirst=True)
    approval_level_enum.drop(op.get_bind(), checkfirst=True)
    approval_action_enum.drop(op.get_bind(), checkfirst=True)
    work_order_status_enum.drop(op.get_bind(), checkfirst=True)