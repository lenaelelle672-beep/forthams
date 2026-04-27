"""
Migration: Create Depreciation Tables
SWARM-2026-Q2-003: 资产折旧计算核心模块

Revision ID: 001_create_depreciation_tables
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '001_create_depreciation_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create depreciation-related tables:
    - depreciation_records: Stores individual depreciation entries
    - depreciation_config: Stores depreciation method configurations
    - depreciation_job_log: Stores scheduled job execution logs
    """
    # Create depreciation_records table
    op.create_table(
        'depreciation_records',
        sa.Column('id', sa.BigInteger(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('asset_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('opening_value', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('depreciation_amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('accumulated_depreciation', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('closing_value', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('depreciation_method', sa.String(50), nullable=False),
        sa.Column('useful_life_months', sa.Integer(), nullable=False),
        sa.Column('salvage_value', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('asset_id', 'period_year', 'period_month', name='uq_asset_period'),
    )
    
    # Create depreciation_config table
    op.create_table(
        'depreciation_config',
        sa.Column('id', sa.BigInteger(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('asset_category', sa.String(100), nullable=True, index=True),
        sa.Column('depreciation_method', sa.String(50), nullable=False, default='straight_line'),
        sa.Column('default_useful_life_years', sa.Integer(), nullable=False, default=5),
        sa.Column('default_salvage_rate', sa.Numeric(precision=5, scale=4), nullable=False, default=0.05),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create depreciation_job_log table
    op.create_table(
        'depreciation_job_log',
        sa.Column('id', sa.BigInteger(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('job_type', sa.String(50), nullable=False, index=True),
        sa.Column('execution_time', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('status', sa.String(20), nullable=False, index=True),
        sa.Column('assets_processed', sa.Integer(), nullable=False, default=0),
        sa.Column('total_depreciation_amount', sa.Numeric(precision=18, scale=2), nullable=False, default=0),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    
    # Create indexes for performance optimization
    op.create_index('ix_depreciation_records_asset_period', 'depreciation_records', ['asset_id', 'period_year', 'period_month'])
    op.create_index('ix_depreciation_records_created', 'depreciation_records', ['created_at'])


def downgrade() -> None:
    """Drop all depreciation-related tables."""
    op.drop_index('ix_depreciation_records_created', table_name='depreciation_records')
    op.drop_index('ix_depreciation_records_asset_period', table_name='depreciation_records')
    op.drop_table('depreciation_job_log')
    op.drop_table('depreciation_config')
    op.drop_table('depreciation_records')