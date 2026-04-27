"""
Migration: Add depreciation_task_log_table for multi-tenant data isolation tracking.

Revision ID: xxx_add_depreciation_task_log_table
Revises: 
Create Date: 2025-01-15 00:00:00.000000

This migration adds the depreciation_task_log_table to track depreciation
calculation tasks with multi-tenant isolation support.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'xxx_add_depreciation_task_log_table'
down_revision = None  # Adjust based on your migration chain
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create the depreciation_task_log_table with tenant isolation support.
    
    This table stores logs for depreciation calculation tasks, ensuring
    each tenant can only access their own task logs through tenant_id filtering.
    """
    op.create_table(
        'depreciation_task_log',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(64), nullable=False, index=True, comment='Tenant identifier for data isolation'),
        sa.Column('task_id', sa.String(128), nullable=False, index=True, comment='Unique task identifier'),
        sa.Column('task_type', sa.String(64), nullable=False, comment='Type of depreciation task (e.g., batch_calculate, sync)'),
        sa.Column('status', sa.String(32), nullable=False, comment='Task status: pending, running, completed, failed'),
        sa.Column('asset_ids', postgresql.ARRAY(sa.BigInteger()), nullable=True, comment='List of asset IDs processed'),
        sa.Column('total_assets', sa.Integer(), nullable=True, comment='Total number of assets in task'),
        sa.Column('processed_assets', sa.Integer(), nullable=True, comment='Number of assets processed'),
        sa.Column('failed_assets', sa.Integer(), nullable=True, comment='Number of assets that failed'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='Error message if task failed'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True, comment='Task start timestamp'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True, comment='Task completion timestamp'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create composite index for tenant-aware queries
    op.create_index(
        'ix_depreciation_task_log_tenant_task',
        'depreciation_task_log',
        ['tenant_id', 'task_id'],
        unique=False
    )
    
    # Create index for status filtering per tenant
    op.create_index(
        'ix_depreciation_task_log_tenant_status',
        'depreciation_task_log',
        ['tenant_id', 'status'],
        unique=False
    )


def downgrade() -> None:
    """
    Drop the depreciation_task_log_table.
    
    This removes all depreciation task log records and the table itself.
    """
    op.drop_index('ix_depreciation_task_log_tenant_status', table_name='depreciation_task_log')
    op.drop_index('ix_depreciation_task_log_tenant_task', table_name='depreciation_task_log')
    op.drop_table('depreciation_task_log')