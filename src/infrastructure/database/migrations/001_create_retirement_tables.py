"""
Migration: 001_create_retirement_tables
Module: src/infrastructure/database/migrations/001_create_retirement_tables.py

Purpose:
    Creates the core database tables for the Asset Retirement/Decommission Flow (SWARM-002).
    This migration establishes the retirement application tracking system including:
    - Retirement applications with state machine support
    - Multi-level approval chain tracking
    - Audit log persistence (append-only policy)
    - Optimistic locking via version field

State Machine States:
    DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, DECOMMISSIONED, ARCHIVED

Approval Chain:
    Max 5 levels (MAX_APPROVAL_LEVELS = 5)

Legal Compliance:
    Audit logs retained for 7 years per data retention policy.

Created: Iteration 10, Phase 2 Implementation
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON
from datetime import datetime
import uuid

# Revision identifier
revision = '001_create_retirement_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Creates all retirement-related tables with proper constraints and indexes.
    
    Tables Created:
    1. retirement_applications - Main application entity with state machine
    2. retirement_audit_logs - Append-only audit trail
    3. retirement_approval_chain - Approval chain tracking
    """
    
    # =========================================================================
    # Table: retirement_applications
    # =========================================================================
    op.create_table(
        'retirement_applications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('asset_id', sa.BigInteger(), sa.ForeignKey('assets.id'), nullable=False, index=True),
        sa.Column('applicant_id', sa.BigInteger(), nullable=False, index=True),
        sa.Column('applicant_name', sa.String(255), nullable=True),
        
        # State Machine Fields
        sa.Column('state', sa.String(50), nullable=False, default='DRAFT'),
        sa.Column('version', sa.Integer(), nullable=False, default=1),  # Optimistic locking
        
        # Approval Chain Fields
        sa.Column('approval_levels', JSON, nullable=True),  # List of approver IDs [2, 3, 4, 5]
        sa.Column('total_approval_levels', sa.Integer(), nullable=True),
        sa.Column('current_approval_level', sa.Integer(), nullable=True, default=0),
        sa.Column('current_approver_id', sa.BigInteger(), nullable=True),
        
        # Rejection Tracking
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('rejection_approver_id', sa.BigInteger(), nullable=True),
        sa.Column('rejection_approver_name', sa.String(255), nullable=True),
        
        # Application Details
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('expected_decommission_date', sa.Date(), nullable=True),
        sa.Column('estimated_value', sa.Numeric(15, 2), nullable=True),
        sa.Column('actual_decommission_date', sa.Date(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('rejected_at', sa.DateTime(), nullable=True),
        sa.Column('decommissioned_at', sa.DateTime(), nullable=True),
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        
        # Metadata
        sa.Column('request_id', sa.String(100), nullable=True, index=True),  # X-Request-ID tracking
        sa.Column('idempotency_key', sa.String(100), nullable=True, index=True),
        sa.Column('archived', sa.Boolean(), nullable=False, default=False),
        
        # Constraints
        sa.CheckConstraint('version >= 1', name='retirement_version_positive'),
        sa.CheckConstraint(
            "state IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DECOMMISSIONED', 'ARCHIVED')",
            name='retirement_state_valid'
        ),
        sa.CheckConstraint('current_approval_level <= 5', name='retirement_max_approval_levels'),
    )
    
    # Indexes for retirement_applications
    op.create_index('idx_retirement_state', 'retirement_applications', ['state'])
    op.create_index('idx_retirement_asset_state', 'retirement_applications', ['asset_id', 'state'])
    op.create_index('idx_retirement_applicant_state', 'retirement_applications', ['applicant_id', 'state'])
    
    # =========================================================================
    # Table: retirement_audit_logs
    # =========================================================================
    # Append-only policy: NO UPDATE/DELETE operations allowed
    # Retention: 7 years (legal compliance)
    op.create_table(
        'retirement_audit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('retirement_applications.id'), nullable=False, index=True),
        
        # Event Tracking
        sa.Column('event_type', sa.String(50), nullable=False),  # STATE_TRANSITION, APPROVAL, REJECTION, etc.
        sa.Column('event_data', JSON, nullable=True),  # Additional event metadata
        
        # State Change Tracking
        sa.Column('from_state', sa.String(50), nullable=True),
        sa.Column('to_state', sa.String(50), nullable=True),
        
        # Approval Level Tracking
        sa.Column('approval_level', sa.Integer(), nullable=True),
        
        # Operator Information (REQUIRED - no nulls allowed)
        sa.Column('operator_id', sa.BigInteger(), nullable=False),
        sa.Column('operator_name', sa.String(255), nullable=False),
        
        # Comments and Reasons
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        
        # Timestamps (REQUIRED - no nulls allowed)
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        
        # Request Tracking
        sa.Column('request_id', sa.String(100), nullable=False),  # X-Request-ID for traceability
        
        # Constraints
        sa.CheckConstraint(
            "event_type IN ('CREATED', 'STATE_TRANSITION', 'SUBMIT', 'APPROVAL', 'REJECTION', 'DECOMMISSION', 'ARCHIVE', 'RESUBMIT', 'INIT')",
            name='retirement_audit_event_type_valid'
        ),
    )
    
    # Indexes for retirement_audit_logs
    op.create_index('idx_audit_application_created', 'retirement_audit_logs', ['application_id', 'created_at'])
    op.create_index('idx_audit_event_type', 'retirement_audit_logs', ['event_type'])
    op.create_index('idx_audit_operator', 'retirement_audit_logs', ['operator_id'])
    op.create_index('idx_audit_request_id', 'retirement_audit_logs', ['request_id'])
    
    # =========================================================================
    # Table: retirement_approval_chain
    # =========================================================================
    op.create_table(
        'retirement_approval_chain',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('retirement_applications.id'), nullable=False, index=True, unique=True),
        
        # Chain Configuration
        sa.Column('chain_config', JSON, nullable=False),  # Full approval chain definition
        
        # Approval Records
        sa.Column('approver_ids', JSON, nullable=False),  # Ordered list of approver IDs
        sa.Column('max_levels', sa.Integer(), nullable=False, default=5),
        sa.Column('current_level', sa.Integer(), nullable=False, default=0),
        
        # Timeout Configuration (default 72 hours)
        sa.Column('timeout_hours', sa.Integer(), nullable=False, default=72),
        
        # Status
        sa.Column('is_completed', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_rejected', sa.Boolean(), nullable=False, default=False),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        
        # Validation
        sa.CheckConstraint('max_levels <= 5', name='chain_max_levels_constraint'),
        sa.CheckConstraint('current_level >= 0', name='chain_current_level_positive'),
    )
    
    # =========================================================================
    # Table: retirement_approval_records
    # =========================================================================
    op.create_table(
        'retirement_approval_records',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('retirement_applications.id'), nullable=False, index=True),
        sa.Column('chain_id', UUID(as_uuid=True), sa.ForeignKey('retirement_approval_chain.id'), nullable=False, index=True),
        
        # Level Information
        sa.Column('level', sa.Integer(), nullable=False),
        
        # Approver Information
        sa.Column('approver_id', sa.BigInteger(), nullable=False),
        sa.Column('approver_name', sa.String(255), nullable=False),
        
        # Decision
        sa.Column('action', sa.String(20), nullable=False),  # APPROVE, REJECT
        sa.Column('comment', sa.Text(), nullable=True),
        
        # Timestamps
        sa.Column('decided_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        
        # Request Tracking
        sa.Column('request_id', sa.String(100), nullable=False),
        
        # Constraints
        sa.CheckConstraint("action IN ('APPROVE', 'REJECT')", name='approval_action_valid'),
    )
    
    # Indexes for retirement_approval_records
    op.create_index('idx_approval_records_application_level', 'retirement_approval_records', ['application_id', 'level'])
    op.create_index('idx_approval_records_approver', 'retirement_approval_records', ['approver_id'])
    
    # =========================================================================
    # Add Comments for Documentation
    # =========================================================================
    op.execute("COMMENT ON TABLE retirement_applications IS 'Asset retirement/decommission applications with state machine support'")
    op.execute("COMMENT ON TABLE retirement_audit_logs IS 'Append-only audit trail for retirement applications. 7-year retention policy.'")
    op.execute("COMMENT ON TABLE retirement_approval_chain IS 'Multi-level approval chain configuration for retirement applications'")
    op.execute("COMMENT ON TABLE retirement_approval_records IS 'Individual approval decisions within the approval chain'")
    
    # Column Comments
    op.execute("COMMENT ON COLUMN retirement_applications.version IS 'Optimistic locking version number for concurrent modification prevention'")
    op.execute("COMMENT ON COLUMN retirement_applications.state IS 'State machine state: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, DECOMMISSIONED, ARCHIVED'")
    op.execute("COMMENT ON COLUMN retirement_audit_logs.created_at IS 'Audit log creation timestamp - used for chronological ordering'")
    op.execute("COMMENT ON COLUMN retirement_approval_chain.max_levels IS 'Maximum approval levels allowed (configurable, default 5)'")


def downgrade() -> None:
    """
    Drops all retirement-related tables.
    WARNING: This operation destroys all retirement application data and audit logs.
    """
    op.drop_table('retirement_approval_records')
    op.drop_table('retirement_approval_chain')
    op.drop_table('retirement_audit_logs')
    op.drop_table('retirement_applications')