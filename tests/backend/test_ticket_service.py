"""
Backend Ticket Service Tests
Tests for ticket creation, approval/rejection workflow and audit logging.
"""
import pytest
from unittest.mock import MagicMock, patch
from backend.services.ticket_service import TicketService
from backend.models.workorder import WorkOrder
from backend.models.status_history import StatusHistory
from backend.models.approval_history import ApprovalHistory
from backend.state_machine.workorder_state_machine import WorkOrderStateMachine
@pytest.fixture
def mock_db_session():
    """Fixture providing a mock database session."""
    mock_session = MagicMock()
    return mock_session
@pytest.fixture
def ticket_service(mock_db_session):
    """Fixture providing a TicketService instance with mocked dependencies."""
    with patch('backend.services.ticket_service.db_session', mock_db_session):
        svc = TicketService()
        svc.state_machine = WorkOrderStateMachine()
        return svc
def test_create_ticket(ticket_service):
    """Test ticket creation records initial state and audit log."""
    ticket = ticket_service.create_ticket(
        title='Test Ticket',
        description='A test ticket',
        requester_id='user-123',
        category='general'
    )
    assert ticket.title == 'Test Ticket'
    assert ticket.status == 'draft'
    assert ticket.requester_id == 'user-123'
    assert ticket.category == 'general'
    # Ensure audit log entry created for creation
    assert ticket_service.db_session.add.called
def test_approve_ticket_transition(ticket_service):
    """Test state transition from draft -> pending -> approved."""
    ticket = ticket_service.create_ticket(
        title='Approval Ticket',
        description='For approval',
        requester_id='user-1',
        category='general'
    )
    # Move to pending then approve
    ticket_service.approve_ticket(ticket.id, approver_id='approver-1')
    assert ticket.status == 'approved'
    # Verify audit log recorded the approval
    audit_entries = ticket_service.db_session.query(ApprovalHistory).filter(
        ApprovalHistory.ticket_id == ticket.id
    ).all()
    assert len(audit_entries) > 0
    assert any(a.action == 'approve' for a in audit_entries)
def test_reject_ticket_transition(ticket_service):
    """Test state transition from draft -> pending -> rejected."""
    ticket = ticket_service.create_ticket(
        title='Rejection Ticket',
        description='For rejection',
        requester_id='user-2',
        category='general'
    )
    ticket_service.reject_ticket(ticket.id, reason='Not needed', rejector_id='approver-2')
    assert ticket.status == 'rejected'
    audit_entries = ticket_service.db_session.query(ApprovalHistory).filter(
        ApprovalHistory.ticket_id == ticket.id
    ).all()
    assert len(audit_entries) > 0
    assert any(a.action == 'reject' for a in audit_entries)
def test_concurrent_approval_scenario(ticket_service):
    """Test concurrent approval attempts are handled safely."""
    ticket = ticket_service.create_ticket(
        title='Concurrent Ticket',
        description='Concurrency test',
        requester_id='user-c',
        category='general'
    )
    # Simulate two parallel approval attempts via state machine guard
    sm = WorkOrderStateMachine(ticket.status)
    # Both calls should result in a single valid transition
    sm.approve()
    assert sm.current_state.name == 'approved'
    # Re-approving an already approved ticket should be a no-op or raise
    with pytest.raises(ValueError):
        sm.approve()
def test_audit_log_on_state_change(ticket_service):
    """Test that every state change produces an audit log entry."""
    ticket = ticket_service.create_ticket(
        title='Audit Ticket',
        description='Audit trail check',
        requester_id='user-audit',
        category='general'
    )
    initial_log_count = ticket_service.db_session.query(StatusHistory).filter(
        StatusHistory.ticket_id == ticket.id
    ).count()
    ticket_service.approve_ticket(ticket.id, approver_id='auditor-1')
    final_log_count = ticket_service.db_session.query(StatusHistory).filter(
        StatusHistory.ticket_id == ticket.id
    ).count()
    assert final_log_count > initial_log_count
    # Ensure approval history also recorded
    approval_logs = ticket_service.db_session.query(ApprovalHistory).filter(
        ApprovalHistory.ticket_id == ticket.id
    ).all()
    assert len(approval_logs) >= 1