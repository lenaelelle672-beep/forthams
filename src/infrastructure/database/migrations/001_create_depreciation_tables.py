"""
Migration: 001_create_depreciation_tables
Creates depreciation-related database tables for asset depreciation management.

Revision ID: 001_create_depreciation_tables
Revises: 
Create Date: 2026-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_create_depreciation_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create depreciation-related tables.
    
    Creates:
        - depreciation_methods: Stores depreciation calculation method configurations
        - depreciation_schedules: Asset depreciation schedules
        - depreciation_records: Monthly depreciation calculation records
    """
    # Create depreciation_methods table
    op.create_table(
        'depreciation_methods',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False, comment='Method name'),
        sa.Column('type', sa.String(50), nullable=False, comment='Method type: straight_line, double_declining'),
        sa.Column('rate', sa.Numeric(5, 4), nullable=True, comment='Depreciation rate'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create depreciation_schedules table
    op.create_table(
        'depreciation_schedules',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('asset_id', sa.Integer(), nullable=False, index=True),
        sa.Column('method_id', sa.Integer(), sa.ForeignKey('depreciation_methods.id'), nullable=False),
        sa.Column('purchase_date', sa.Date(), nullable=False),
        sa.Column('useful_life_months', sa.Integer(), nullable=False),
        sa.Column('salvage_value', sa.Numeric(15, 2), nullable=False, default=0),
        sa.Column('purchase_value', sa.Numeric(15, 2), nullable=False),
        sa.Column('current_value', sa.Numeric(15, 2), nullable=False),
        sa.Column('depreciation_start_date', sa.Date(), nullable=False),
        sa.Column('depreciation_end_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), default='active'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create depreciation_records table
    op.create_table(
        'depreciation_records',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('schedule_id', sa.Integer(), sa.ForeignKey('depreciation_schedules.id'), nullable=False, index=True),
        sa.Column('asset_id', sa.Integer(), nullable=False, index=True),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('beginning_value', sa.Numeric(15, 2), nullable=False),
        sa.Column('depreciation_amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('accumulated_depreciation', sa.Numeric(15, 2), nullable=False),
        sa.Column('ending_value', sa.Numeric(15, 2), nullable=False),
        sa.Column('calculated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('schedule_id', 'period_year', 'period_month', name='uq_depreciation_period'),
    )
    
    # Create indexes for performance
    op.create_index('ix_depreciation_schedules_asset_id', 'depreciation_schedules', ['asset_id'])
    op.create_index('ix_depreciation_schedules_status', 'depreciation_schedules', ['status'])
    op.create_index('ix_depreciation_records_asset_period', 'depreciation_records', ['asset_id', 'period_year', 'period_month'])


def downgrade() -> None:
    """
    Drop depreciation-related tables.
    """
    op.drop_index('ix_depreciation_records_asset_period')
    op.drop_index('ix_depreciation_schedules_status')
    op.drop_index('ix_depreciation_schedules_asset_id')
    op.drop_table('depreciation_records')
    op.drop_table('depreciation_schedules')
    op.drop_table('depreciation_methods')