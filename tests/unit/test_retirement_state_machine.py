"""
Unit tests for the retirement state machine.

This module validates the core state transitions and approval chain behavior
required by SWARM-002 (asset报废退役流程).
"""

import pytest
from django.core.exceptions import ValidationError

from src.domain.entities.asset import Asset
from src.domain.entities.retirement_application import RetirementApplication
from src.domain.entities.retirement_history import RetirementHistory
from src.domain.state_machine.retirement_state_machine import RetirementStateMachine
from src.domain.value_objects.asset_status import AssetStatus
@pytest.fixture
def asset():
    """Create a valid Asset entity in normal status."""
    return Asset(
        asset_id="1",
        asset_code="A10001",
        name="Test Server",
        status=AssetStatus.NORMAL,
        owning_department="IT部"
    )
@pytest.fixture
def retirement_app(asset):
    """Create a RetirementApplication linked to the fixture asset."""
    return RetirementApplication(
        asset=asset,
        applicant_id="user-1",
        reason="End of life",
        expected_date="2025-12-31"
    )
@pytest.fixture
def state_machine(retirement_app):
    """Create a state machine instance wired to the retirement application."""
    return RetirementStateMachine(retirement_app)
def test_state_machine_initial_state(retirement_app):
    """SMOKETEST: machine should initialize with the application's current state."""
    sm = RetirementStateMachine(retirement_app)
    assert sm.current_state == retirement_app.status
def test_state_transition_normal_to_pending(retirement_app):
    """Submitting an application should move asset to PENDING_RETIREMENT."""
    sm = RetirementStateMachine(retirement_app)
    sm.submit()
    assert retirement_app.status == "pending_retirement"
    assert len(retirement_app.history) == 1
    assert retirement_app.history[0].action == "created"
def test_state_transition_pending_to_approved(asset, retirement_app):
    """Approval should transition PENDING -> RETIRED."""
    retirement_app.status = "pending_retirement"
    sm = RetirementStateMachine(retirement_app)
    sm.approve()
    assert retirement_app.status == AssetStatus.RETIRED
    assert retirement_app.history[-1].action == "approved"
def test_state_transition_pending_to_rejected(asset, retirement_app):
    """Rejection should transition PENDING -> NORMAL."""
    retirement_app.status = "pending_retirement"
    sm = RetirementStateMachine(retirement_app)
    sm.reject()
    assert retirement_app.status == AssetStatus.NORMAL
    assert retirement_app.history[-1].action == "rejected"
def test_state_transition_invalid_from_retired(asset, retirement_app):
    """No further transitions should be allowed from RETIRED."""
    retirement_app.status = AssetStatus.RETIRED
    sm = RetirementStateMachine(retirement_app)
    with pytest.raises(ValueError, match="Invalid transition"):
        sm.approve()
def test_state_transition_invalid_from_draft(asset, retirement_app):
    """Transitions should be disallowed when status is still DRAFT."""
    retirement_app.status = "draft"
    sm = RetirementStateMachine(retirement_app)
    with pytest.raises(ValueError, match="Invalid transition"):
        sm.approve()
def test_history_recorded_on_submit(retirement_app):
    """Each action must append a RetirementHistory entry."""
    sm = RetirementStateMachine(retirement_app)
    sm.submit()
    assert len(retirement_app.history) == 1
    assert retirement_app.history[0].performed_by == retirement_app.applicant_id
def test_history_recorded_on_approval(asset, retirement_app):
    """Approval must record who performed it and when."""
    retirement_app.status = "pending_retirement"
    sm = RetirementStateMachine(retirement_app)
    sm.approve(performed_by="admin-1", comment="Looks good")
    last = retirement_app.history[-1]
    assert last.action == "approved"
    assert last.performed_by == "admin-1"
    assert last.comment == "Looks good"
def test_machine_valid_transitions_graph():
    """Verify the allowed state graph matches the specification."""
    sm = RetirementStateMachine(asset)
    # From NORMAL only submit is allowed
    assert sm.can_submit is True
    assert sm.can_approve is False
    assert sm.can_reject is False

    sm.submit()
    # From PENDING approve/reject are allowed
    assert sm.can_submit is False
    assert sm.can_approve is True
    assert sm.can_reject is True

    sm.approve()
    # From RETIRED no actions
    assert sm.can_submit is False
    assert sm.can_approve is False
    assert sm.can_reject is False