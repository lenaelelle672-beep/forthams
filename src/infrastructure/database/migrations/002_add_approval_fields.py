"""Migration 002: Add approval fields and approval_record table.

This migration introduces the multi-level approval mechanism for work orders,
implementing the dual-level approval chain required by the approval workflow:

    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
                                                    → REJECTED (terminal)
                                  → REJECTED (terminal)
              → CANCELLED (terminal)

Key changes:
- Creates the ``approval_record`` table for immutable, append-only audit trail
  of all approval actions (approver, action, timestamp, reason).
- Adds approval tracking columns to the ``work_order`` table (current level,
  L1/L2 approver IDs and timestamps, rejection reason and metadata).
- Extends the ``work_order_status`` enum to include the new approval states:
  ``APPROVING_LEVEL_1``, ``APPROVING_LEVEL_2``, ``APPROVED``.

Business constraints enforced at the application layer (documented here for
reference):
- ``rejection_reason`` is mandatory (non-empty, >= 10 characters) when a
  rejection action is performed.
- ``APPROVING_LEVEL_1`` may only be acted upon by the department supervisor
  role; ``APPROVING_LEVEL_2`` may only be acted upon by the asset manager
  role.
- Approval records are append-only; no UPDATE or DELETE is permitted.

Revision: 002_add_approval_fields
Revises: 001_create_retirement_tables
"""

from alembic import op
import sqlalchemy as sa


# ── Alembic revision metadata ────────────────────────────────────────────────
revision = "002_add_approval_fields"
down_revision = "001_create_retirement_tables"
branch_labels = None
depends_on = None


# ── Upgrade ──────────────────────────────────────────────────────────────────

def upgrade() -> None:
    """Apply the migration.

    1. Create ``approval_record`` table with immutable audit columns.
    2. Add approval-tracking columns to ``work_order``.
    3. Extend ``work_order_status`` enum with approval states.
    4. Back-fill ``current_approval_level`` for existing rows.
    """

    # ── 1. Create approval_record table ──────────────────────────────────
    # This table stores an immutable, append-only log of every approval
    # action taken on a work order.  Rows must never be updated or deleted
    # (enforced at the application / ORM layer).
    op.create_table(
        "approval_record",
        sa.Column(
            "id",
            sa.String(36),
            primary_key=True,
            comment="Unique approval record identifier (UUID)",
        ),
        sa.Column(
            "work_order_id",
            sa.String(36),
            sa.ForeignKey("work_order.id", ondelete="CASCADE"),
            nullable=False,
            comment="Foreign key to the associated work order",
        ),
        sa.Column(
            "approver_id",
            sa.String(36),
            nullable=False,
            comment="User ID of the person performing the approval action",
        ),
        sa.Column(
            "approver_name",
            sa.String(128),
            nullable=False,
            comment="Display name of the approver (denormalised for audit readability)",
        ),
        sa.Column(
            "action",
            sa.String(32),
            nullable=False,
            comment=(
                "Approval action performed: APPROVE_L1, REJECT_L1, "
                "APPROVE_L2, REJECT_L2"
            ),
        ),
        sa.Column(
            "level",
            sa.Integer(),
            nullable=False,
            comment=(
                "Approval level at which the action was taken: "
                "1 = department supervisor, 2 = asset manager"
            ),
        ),
        sa.Column(
            "comment",
            sa.Text(),
            nullable=True,
            comment="Optional approval comment or opinion",
        ),
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment=(
                "Mandatory rejection reason when action is REJECT_L1 or "
                "REJECT_L2 (must be non-empty and >= 10 characters, "
                "enforced at the application layer)"
            ),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment="Timestamp when the approval action was recorded",
        ),
    )

    # Indexes for common query patterns
    op.create_index(
        "ix_approval_record_work_order_id",
        "approval_record",
        ["work_order_id"],
    )
    op.create_index(
        "ix_approval_record_approver_id",
        "approval_record",
        ["approver_id"],
    )
    op.create_index(
        "ix_approval_record_action",
        "approval_record",
        ["action"],
    )
    op.create_index(
        "ix_approval_record_work_order_level",
        "approval_record",
        ["work_order_id", "level"],
    )
    op.create_index(
        "ix_approval_record_created_at",
        "approval_record",
        ["created_at"],
    )

    # ── 2. Add approval-tracking columns to work_order ───────────────────

    # Current approval level: 0 = PENDING, 1 = L1 review, 2 = L2 review
    op.add_column(
        "work_order",
        sa.Column(
            "current_approval_level",
            sa.Integer(),
            nullable=True,
            comment=(
                "Current approval level: 0 = pending submission, "
                "1 = awaiting L1 (department supervisor) review, "
                "2 = awaiting L2 (asset manager) review"
            ),
        ),
    )

    # L1 (department supervisor) approval tracking
    op.add_column(
        "work_order",
        sa.Column(
            "approved_by_l1",
            sa.String(36),
            nullable=True,
            comment="User ID of the L1 approver (department supervisor role)",
        ),
    )
    op.add_column(
        "work_order",
        sa.Column(
            "approved_at_l1",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when L1 approval was granted",
        ),
    )

    # L2 (asset manager) approval tracking
    op.add_column(
        "work_order",
        sa.Column(
            "approved_by_l2",
            sa.String(36),
            nullable=True,
            comment="User ID of the L2 approver (asset manager role)",
        ),
    )
    op.add_column(
        "work_order",
        sa.Column(
            "approved_at_l2",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when L2 approval was granted",
        ),
    )

    # Rejection tracking (unified — rejection can occur at L1 or L2)
    op.add_column(
        "work_order",
        sa.Column(
            "rejection_reason",
            sa.Text(),
            nullable=True,
            comment=(
                "Rejection reason (mandatory when status is REJECTED; "
                "must be non-empty and >= 10 characters, enforced at "
                "the application layer)"
            ),
        ),
    )
    op.add_column(
        "work_order",
        sa.Column(
            "rejected_by",
            sa.String(36),
            nullable=True,
            comment="User ID of the person who rejected the work order",
        ),
    )
    op.add_column(
        "work_order",
        sa.Column(
            "rejected_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Timestamp when the work order was rejected",
        ),
    )

    # ── 3. Extend work_order_status enum with approval states ────────────
    # PostgreSQL allows adding enum values with ALTER TYPE … ADD VALUE.
    # The IF NOT EXISTS clause ensures idempotency.
    op.execute(
        "ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'APPROVING_LEVEL_1'"
    )
    op.execute(
        "ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'APPROVING_LEVEL_2'"
    )
    op.execute(
        "ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'APPROVED'"
    )

    # ── 4. Back-fill current_approval_level for existing rows ────────────
    # Existing work orders that have no approval level set default to 0
    # (PENDING / pre-approval).
    op.execute(
        "UPDATE work_order SET current_approval_level = 0 "
        "WHERE current_approval_level IS NULL"
    )


# ── Downgrade ────────────────────────────────────────────────────────────────

def downgrade() -> None:
    """Revert the migration.

    Removes approval columns from ``work_order``, drops the
    ``approval_record`` table, and (where possible) removes the added enum
    values.

    .. note::
        PostgreSQL does not support removing individual enum values.  The
        added values (``APPROVING_LEVEL_1``, ``APPROVING_LEVEL_2``,
        ``APPROVED``) will remain in the ``work_order_status`` type after
        downgrade.  A full enum rebuild would be required to remove them,
        which is intentionally omitted to avoid locking production tables.
    """

    # ── Remove columns from work_order (reverse order of addition) ───────
    op.drop_column("work_order", "rejected_at")
    op.drop_column("work_order", "rejected_by")
    op.drop_column("work_order", "rejection_reason")
    op.drop_column("work_order", "approved_at_l2")
    op.drop_column("work_order", "approved_by_l2")
    op.drop_column("work_order", "approved_at_l1")
    op.drop_column("work_order", "approved_by_l1")
    op.drop_column("work_order", "current_approval_level")

    # ── Drop indexes on approval_record ──────────────────────────────────
    op.drop_index("ix_approval_record_created_at", "approval_record")
    op.drop_index("ix_approval_record_work_order_level", "approval_record")
    op.drop_index("ix_approval_record_action", "approval_record")
    op.drop_index("ix_approval_record_approver_id", "approval_record")
    op.drop_index("ix_approval_record_work_order_id", "approval_record")

    # ── Drop approval_record table ───────────────────────────────────────
    op.drop_table("approval_record")

    # ── Enum values cannot be removed in PostgreSQL ──────────────────────
    # See note in docstring above.