"""add inventory tables

Revision ID: xxx_add_inventory_tables
Revises:
Create Date: 2024-01-01 00:00:00.000000

Asset Inventory Management (SWARM-P3-010-BE):
- asset_inventory_task:  盘点任务主表，管理盘点生命周期状态流转
- asset_inventory_detail: 盘点明细表，记录每项资产的账面预期与实盘数据
- asset_inventory_discrepancy: 盘盈盘亏差异记录表，存储比对计算结果

State machine (strict forward-only):
    DRAFT -> IN_PROGRESS -> COMPLETED -> APPROVED

Performance boundary: single task capped at 10,000 detail rows.
Concurrency: optimistic locking via version column on detail rows.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'xxx_add_inventory_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create inventory management tables and supporting indexes.

    Builds three tables:
        1. asset_inventory_task   – lifecycle header (DRAFT → APPROVED).
        2. asset_inventory_detail – per-asset snapshot + actual count data.
        3. asset_inventory_discrepancy – surplus / deficit / inconsistent records
           produced by the comparison engine.

    PostgreSQL-native ENUMs are used for status and type columns to enforce
    valid values at the database level.
    """
    # ── PostgreSQL ENUM types ──────────────────────────────────────────────
    inventory_task_status = postgresql.ENUM(
        'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED',
        name='inventory_task_status',
        create_type=True,
    )
    inventory_scope_type = postgresql.ENUM(
        'BY_LOCATION', 'BY_CATEGORY', 'ALL',
        name='inventory_scope_type',
        create_type=True,
    )
    discrepancy_type = postgresql.ENUM(
        'SURPLUS', 'DEFICIT', 'INCONSISTENT',
        name='discrepancy_type',
        create_type=True,
    )

    # ── 1. asset_inventory_task (盘点任务主表) ─────────────────────────────
    op.create_table(
        'asset_inventory_task',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'task_number', sa.String(50),
            nullable=False, unique=True,
            comment='盘点单号 (如 INV-20240101-001)',
        ),
        sa.Column(
            'name', sa.String(255),
            nullable=False,
            comment='盘点任务名称',
        ),
        sa.Column(
            'status', inventory_task_status,
            server_default='DRAFT', nullable=False,
            comment='任务状态: DRAFT / IN_PROGRESS / COMPLETED / APPROVED',
        ),
        sa.Column(
            'inventory_type', inventory_scope_type,
            nullable=False,
            comment='盘点范围类型: BY_LOCATION / BY_CATEGORY / ALL',
        ),
        sa.Column(
            'scope_params', postgresql.JSONB,
            nullable=True,
            comment='范围参数 JSON (location_ids / category_ids)',
        ),
        sa.Column(
            'start_date', sa.DateTime(timezone=True),
            nullable=True,
            comment='计划/实际开始时间',
        ),
        sa.Column(
            'end_date', sa.DateTime(timezone=True),
            nullable=True,
            comment='计划/实际结束时间',
        ),
        sa.Column(
            'description', sa.Text,
            nullable=True,
            comment='任务描述',
        ),
        sa.Column(
            'created_by', postgresql.UUID(as_uuid=True),
            nullable=False,
            comment='创建人用户 ID',
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )

    op.create_index(
        'idx_inventory_task_status',
        'asset_inventory_task', ['status'],
    )
    op.create_index(
        'idx_inventory_task_created_by',
        'asset_inventory_task', ['created_by'],
    )

    # ── 2. asset_inventory_detail (盘点明细表) ─────────────────────────────
    # Each row is a snapshot of one asset at task-creation time, later updated
    # with actual count data.  The ATB requires:
    #   - expected_quantity / expected_status : book snapshot
    #   - actual_quantity   / actual_status   : physical count
    #   - is_counted        : flag set upon record entry
    op.create_table(
        'asset_inventory_detail',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'task_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('asset_inventory_task.id', ondelete='CASCADE'),
            nullable=False,
            comment='关联盘点任务 ID',
        ),
        sa.Column(
            'asset_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('assets.id', ondelete='RESTRICT'),
            nullable=True,
            comment='关联资产 ID (盘盈项可为空)',
        ),
        # ── 账面预期 (book snapshot, set at task generation time) ──────
        sa.Column(
            'expected_quantity', sa.Integer,
            server_default='1', nullable=False,
            comment='账面预期数量',
        ),
        sa.Column(
            'expected_status', sa.String(50),
            nullable=False,
            comment='账面预期状态 (IN_USE / IDLE / RETIRED 等)',
        ),
        # ── 实盘数据 (filled by PUT …/record endpoint) ────────────────
        sa.Column(
            'actual_quantity', sa.Integer,
            nullable=True,
            comment='实盘数量 (录入后更新)',
        ),
        sa.Column(
            'actual_status', sa.String(50),
            nullable=True,
            comment='实盘状态 (录入后更新)',
        ),
        sa.Column(
            'is_counted', sa.Boolean,
            server_default='false', nullable=False,
            comment='是否已完成盘点录入',
        ),
        # ── 元数据 ─────────────────────────────────────────────────────
        sa.Column(
            'remark', sa.Text,
            nullable=True,
            comment='盘点备注',
        ),
        sa.Column(
            'counted_by', postgresql.UUID(as_uuid=True),
            nullable=True,
            comment='盘点人用户 ID',
        ),
        sa.Column(
            'counted_at', sa.DateTime(timezone=True),
            nullable=True,
            comment='盘点录入时间',
        ),
        sa.Column(
            'version', sa.Integer,
            server_default='1', nullable=False,
            comment='乐观锁版本号 (防止并发修改冲突)',
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )

    op.create_index(
        'idx_inventory_detail_task_id',
        'asset_inventory_detail', ['task_id'],
    )
    op.create_index(
        'idx_inventory_detail_asset_id',
        'asset_inventory_detail', ['asset_id'],
    )
    # Composite index: find uncounted items for a given task (COMPLETED guard)
    op.create_index(
        'idx_inventory_detail_task_counted',
        'asset_inventory_detail', ['task_id', 'is_counted'],
    )

    # ── 3. asset_inventory_discrepancy (盘盈盘亏差异记录表) ────────────────
    # Populated by the POST …/compare endpoint.
    # Three discrepancy categories per SPEC:
    #   SURPLUS      – 实盘有但账面无 (盘盈)
    #   DEFICIT       – 账面有但实盘无/缺失 (盘亏)
    #   INCONSISTENT  – 账实状态不符 (异动)
    op.create_table(
        'asset_inventory_discrepancy',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text('gen_random_uuid()'),
        ),
        sa.Column(
            'task_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('asset_inventory_task.id', ondelete='CASCADE'),
            nullable=False,
            comment='关联盘点任务 ID',
        ),
        sa.Column(
            'asset_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('assets.id', ondelete='RESTRICT'),
            nullable=True,
            comment='关联资产 ID (盘盈项可为空)',
        ),
        sa.Column(
            'discrepancy_type', discrepancy_type,
            nullable=False,
            comment='差异类型: SURPLUS / DEFICIT / INCONSISTENT',
        ),
        sa.Column(
            'expected_quantity', sa.Integer,
            nullable=True,
            comment='账面数量',
        ),
        sa.Column(
            'actual_quantity', sa.Integer,
            nullable=True,
            comment='实盘数量',
        ),
        sa.Column(
            'expected_status', sa.String(50),
            nullable=True,
            comment='账面状态',
        ),
        sa.Column(
            'actual_status', sa.String(50),
            nullable=True,
            comment='实盘状态',
        ),
        sa.Column(
            'quantity_difference', sa.Integer,
            nullable=True,
            comment='数量差异 (actual - expected)',
        ),
        sa.Column(
            'calculated_at', sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
            comment='比对计算时间',
        ),
        sa.Column(
            'resolved', sa.Boolean,
            server_default='false', nullable=False,
            comment='差异是否已处理 (APPROVED 后资产主数据已修正则标记为 true)',
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )

    op.create_index(
        'idx_discrepancy_task_type',
        'asset_inventory_discrepancy', ['task_id', 'discrepancy_type'],
    )
    op.create_index(
        'idx_discrepancy_asset_id',
        'asset_inventory_discrepancy', ['asset_id'],
    )


def downgrade():
    """Drop inventory tables and ENUM types in reverse dependency order."""
    # Drop discrepancy table + indexes
    op.drop_index('idx_discrepancy_asset_id', table_name='asset_inventory_discrepancy')
    op.drop_index('idx_discrepancy_task_type', table_name='asset_inventory_discrepancy')
    op.drop_table('asset_inventory_discrepancy')

    # Drop detail table + indexes
    op.drop_index('idx_inventory_detail_task_counted', table_name='asset_inventory_detail')
    op.drop_index('idx_inventory_detail_asset_id', table_name='asset_inventory_detail')
    op.drop_index('idx_inventory_detail_task_id', table_name='asset_inventory_detail')
    op.drop_table('asset_inventory_detail')

    # Drop task table + indexes
    op.drop_index('idx_inventory_task_created_by', table_name='asset_inventory_task')
    op.drop_index('idx_inventory_task_status', table_name='asset_inventory_task')
    op.drop_table('asset_inventory_task')

    # Drop ENUM types (reverse creation order)
    op.execute('DROP TYPE IF EXISTS discrepancy_type')
    op.execute('DROP TYPE IF EXISTS inventory_scope_type')
    op.execute('DROP TYPE IF EXISTS inventory_task_status')