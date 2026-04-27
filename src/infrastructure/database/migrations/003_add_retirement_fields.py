"""
Migration 003: Add Retirement Fields and Approval Chain Tables

This migration adds the core data models for the asset retirement/decommissioning workflow:
- Asset status and retirement tracking fields
- RetirementApplication table
- ApprovalChain table for multi-level approval workflows
- StateTransitionLog for audit trail

Revision ID: 003_add_retirement_fields
Revises: 002_add_approval_fields
Create Date: 2024-XX-XX XX:XX:XX

Related Spec: SWARM-002 Iteration 8
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


# Define ENUM types for asset status
asset_status_enum = postgresql.ENUM(
    '在用', '闲置', '维修中', '待审批', '审批中', '已报废', '已回收',
    name='asset_status',
    create_type=True
)

# Define ENUM types for retirement application status
retirement_status_enum = postgresql.ENUM(
    '草稿', '待审批', '审批中', '已批准', '已拒绝', '已撤回',
    name='retirement_application_status',
    create_type=True
)

# Define ENUM types for disposal methods
disposal_method_enum = postgresql.ENUM(
    '报废销毁', '转让', '回收再利用', '捐赠',
    name='disposal_method',
    create_type=True
)

# Define ENUM types for approval decision
approval_decision_enum = postgresql.ENUM(
    'pending', 'approved', 'rejected', 'skipped',
    name='approval_decision',
    create_type=True
)

# Define ENUM types for transition trigger type
trigger_type_enum = postgresql.ENUM(
    'manual', 'auto', 'approval',
    name='transition_trigger_type',
    create_type=True
)

# Define ENUM types for approval chain mode
approval_mode_enum = postgresql.ENUM(
    'serial', 'counter_sign', 'or_sign',
    name='approval_chain_mode',
    create_type=True
)


def upgrade():
    """
    Add retirement workflow fields and tables.
    
    Tables created:
    1. retirement_applications - stores retirement application requests
    2. approval_chains - stores approval chain configurations
    3. approval_nodes - stores individual approval nodes in chains
    4. state_transition_logs - stores state change audit logs
    
    Fields added to existing tables:
    - assets: status, retirement related fields
    """
    
    # Create ENUM types
    asset_status_enum.create(op.get_bind(), checkfirst=True)
    retirement_status_enum.create(op.get_bind(), checkfirst=True)
    disposal_method_enum.create(op.get_bind(), checkfirst=True)
    approval_decision_enum.create(op.get_bind(), checkfirst=True)
    trigger_type_enum.create(op.get_bind(), checkfirst=True)
    approval_mode_enum.create(op.get_bind(), checkfirst=True)
    
    # Add retirement fields to assets table
    op.add_column(
        'assets',
        sa.Column('status', asset_status_enum, nullable=True, default='在用')
    )
    
    op.add_column(
        'assets',
        sa.Column('original_value', sa.Numeric(15, 2), nullable=True)
    )
    
    op.add_column(
        'assets',
        sa.Column('current_value', sa.Numeric(15, 2), nullable=True)
    )
    
    op.add_column(
        'assets',
        sa.Column('retirement_date', sa.Date(), nullable=True)
    )
    
    op.add_column(
        'assets',
        sa.Column('disposal_method', disposal_method_enum, nullable=True)
    )
    
    op.add_column(
        'assets',
        sa.Column('active_application_id', sa.UUID(), nullable=True)
    )
    
    # Create retirement_applications table
    op.create_table(
        'retirement_applications',
        sa.Column('id', sa.UUID(), primary_key=True, default=uuid.uuid4),
        sa.Column('asset_id', sa.UUID(), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('applicant_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('disposal_method', disposal_method_enum, nullable=False),
        sa.Column('estimated_value', sa.Numeric(15, 2), nullable=True),
        sa.Column('status', retirement_status_enum, nullable=False, default='草稿'),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.current_timestamp()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=sa.func.current_timestamp(), onupdate=sa.func.current_timestamp()),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )
    
    op.create_index(
        'ix_retirement_applications_asset_id',
        'retirement_applications',
        ['asset_id']
    )
    
    op.create_index(
        'ix_retirement_applications_applicant_id',
        'retirement_applications',
        ['applicant_id']
    )
    
    op.create_index(
        'ix_retirement_applications_status',
        'retirement_applications',
        ['status']
    )
    
    # Add foreign key for active_application_id in assets
    op.create_foreign_key(
        'fk_assets_active_application',
        'assets',
        'retirement_applications',
        ['active_application_id'],
        ['id']
    )
    
    # Create approval_chains table
    op.create_table(
        'approval_chains',
        sa.Column('id', sa.UUID(), primary_key=True, default=uuid.uuid4),
        sa.Column('application_id', sa.UUID(), sa.ForeignKey('retirement_applications.id'), nullable=False),
        sa.Column('chain_name', sa.String(256), nullable=True),
        sa.Column('mode', approval_mode_enum, nullable=False, default='serial'),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.current_timestamp()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=sa.func.current_timestamp(), onupdate=sa.func.current_timestamp()),
    )
    
    op.create_index(
        'ix_approval_chains_application_id',
        'approval_chains',
        ['application_id']
    )
    
    # Create approval_nodes table
    op.create_table(
        'approval_nodes',
        sa.Column('id', sa.UUID(), primary_key=True, default=uuid.uuid4),
        sa.Column('chain_id', sa.UUID(), sa.ForeignKey('approval_chains.id'), nullable=False),
        sa.Column('node_order', sa.Integer(), nullable=False),
        sa.Column('approver_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('decision', approval_decision_enum, nullable=False, default='pending'),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('decided_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.current_timestamp()),
        sa.Column('timeout_at', sa.DateTime(), nullable=True),
        sa.Column('timeout_flag', sa.Boolean(), nullable=False, default=False),
    )
    
    op.create_index(
        'ix_approval_nodes_chain_id',
        'approval_nodes',
        ['chain_id']
    )
    
    op.create_index(
        'ix_approval_nodes_approver_id',
        'approval_nodes',
        ['approver_id']
    )
    
    op.create_index(
        'ix_approval_nodes_decision',
        'approval_nodes',
        ['decision']
    )
    
    # Create state_transition_logs table
    op.create_table(
        'state_transition_logs',
        sa.Column('id', sa.UUID(), primary_key=True, default=uuid.uuid4),
        sa.Column('asset_id', sa.UUID(), sa.ForeignKey('assets.id'), nullable=False),
        sa.Column('from_status', sa.String(32), nullable=True),
        sa.Column('to_status', sa.String(32), nullable=False),
        sa.Column('trigger_type', trigger_type_enum, nullable=False),
        sa.Column('operator_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('metadata', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=sa.func.current_timestamp()),
        sa.Column('prev_hash', sa.String(64), nullable=True),
        sa.Column('hash', sa.String(64), nullable=False),
    )
    
    op.create_index(
        'ix_state_transition_logs_asset_id',
        'state_transition_logs',
        ['asset_id']
    )
    
    op.create_index(
        'ix_state_transition_logs_created_at',
        'state_transition_logs',
        ['created_at']
    )
    
    op.create_index(
        'ix_state_transition_logs_operator_id',
        'state_transition_logs',
        ['operator_id']
    )
    
    # Create compound index for asset history queries
    op.create_index(
        'ix_state_transition_logs_asset_created',
        'state_transition_logs',
        ['asset_id', 'created_at']
    )


def downgrade():
    """
    Remove retirement workflow fields and tables.
    
    This rollback removes:
    - All new tables (retirement_applications, approval_chains, approval_nodes, state_transition_logs)
    - All new columns added to assets table
    - All ENUM types created for the retirement workflow
    """
    
    # Drop indexes and foreign keys
    op.drop_index('ix_state_transition_logs_asset_created', 'state_transition_logs')
    op.drop_index('ix_state_transition_logs_operator_id', 'state_transition_logs')
    op.drop_index('ix_state_transition_logs_created_at', 'state_transition_logs')
    op.drop_index('ix_state_transition_logs_asset_id', 'state_transition_logs')
    
    op.drop_index('ix_approval_nodes_decision', 'approval_nodes')
    op.drop_index('ix_approval_nodes_approver_id', 'approval_nodes')
    op.drop_index('ix_approval_nodes_chain_id', 'approval_nodes')
    
    op.drop_index('ix_approval_chains_application_id', 'approval_chains')
    
    op.drop_index('ix_retirement_applications_status', 'retirement_applications')
    op.drop_index('ix_retirement_applications_applicant_id', 'retirement_applications')
    op.drop_index('ix_retirement_applications_asset_id', 'retirement_applications')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_assets_active_application', 'assets', type_='foreignkey')
    
    # Drop tables
    op.drop_table('state_transition_logs')
    op.drop_table('approval_nodes')
    op.drop_table('approval_chains')
    op.drop_table('retirement_applications')
    
    # Remove columns from assets table
    op.drop_column('assets', 'active_application_id')
    op.drop_column('assets', 'disposal_method')
    op.drop_column('assets', 'retirement_date')
    op.drop_column('assets', 'current_value')
    op.drop_column('assets', 'original_value')
    op.drop_column('assets', 'status')
    
    # Drop ENUM types
    trigger_type_enum.drop(op.get_bind(), checkfirst=True)
    approval_decision_enum.drop(op.get_bind(), checkfirst=True)
    disposal_method_enum.drop(op.get_bind(), checkfirst=True)
    retirement_status_enum.drop(op.get_bind(), checkfirst=True)
    asset_status_enum.drop(op.get_bind(), checkfirst=True)
    approval_mode_enum.drop(op.get_bind(), checkfirst=True)