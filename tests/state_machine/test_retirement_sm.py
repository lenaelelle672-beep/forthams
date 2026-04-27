"""
Tests for the retirement state machine (SWARM-002).

Validates:
- Asset status change on retirement request creation
- Approval chain transitions (pending -> approved/rejected)
- Final retired status and history recording
"""
import pytest
from django.core.exceptions import ValidationError

from src.domain.entities.asset import Asset
from src.domain.entities.retirement_application import RetirementApplication
from src.domain.entities.retirement_history import RetirementHistory
from src.domain.services.retirement_service import RetirementService
from src.domain.services.approval_chain_service import ApprovalChainService
@pytest.fixture
def sample_asset():
    return Asset(
        asset_id="ASSET-001",
        name="Test Server",
        status="active",
        owning_department="IT",
        current_location="DC-A"
    )
@pytest.fixture
def sample_user(uid="user-001", role="operator"):
    from src.domain.entities.user import User
    return User(uid=uid, role=role)
def test_create_retirement_application_updates_asset_status(sample_asset, sample_user):
    """Creating a retirement application should transition asset -> pending_retirement."""
    app = RetirementService.create_retirement_application(
        asset=sample_asset,
        applicant=sample_user,
        reason="End of life",
        expected_date="2026-01-01"
    )
    assert app.status == "pending"
    assert sample_asset.status == "pending_retirement"
def test_approval_chain_approve_transitions_to_retired(sample_asset, sample_user):
    """ApprovalService.approve should move asset to retired and record history."""
    app = RetirementService.create_retirement_application(
        asset=sample_asset,
        applicant=sample_user,
        reason="Decommission",
        expected_date="2026-02-01"
    )
    actor = sample_user  # admin-like user
    result = ApprovalChainService.approve(app, actor, comment="Looks good")
    assert result.status == "approved"
    assert sample_asset.status == "retired"
    history = sample_asset.retirement_history
    assert history is not None
    assert history.action == "approved"
def test_approval_chain_reject_restores_normal(sample_asset, sample_user):
    """Rejection should restore asset status to active and record history."""
    app = RetirementService.create_retirement_application(
        asset=sample_asset,
        applicant=sample_user,
        reason="Duplicate purchase",
        expected_date="2026-03-01"
    )
    actor = sample_user
    result = ApprovalChainService.reject(app, actor, reason="Not needed")
    assert result.status == "rejected"
    assert sample_asset.status == "active"
    history = sample_asset.retirement_history
    assert history is not None
    assert history.action == "rejected"
def test_retirement_history_records_creation_and_actions(sample_asset, sample_user):
    """Every state transition must append a RetirementHistory entry."""
    # creation
    app = RetirementService.create_retirement_application(
        asset=sample_asset,
        applicant=sample_user,
        reason="Test",
        expected_date="2026-04-01"
    )
    assert len(sample_asset.retirement_history) == 1
    assert sample_asset.retirement_history[0].action == "created"
    # approval
    actor = sample_user
    ApprovalChainService.approve(app, actor)
    assert len(sample_asset.retirement_history) == 2
    assert sample_asset.retirement_history[1].action == "approved"
    # ensure chronological ordering
    timestamps = [h.created_at for h in sample_asset.retirement_history]
    assert timestamps == sorted(timestamps)
def test_duplicate_retirement_application_raises(sample_asset, sample_user):
    """Only one pending retirement application per asset is allowed."""
    RetirementService.create_retirement_application(
        asset=sample_asset,
        applicant=sample_user,
        reason="First",
        expected_date="2026-05-01"
    )
    with pytest.raises(ValidationError, match="already has a pending retirement"):
        RetirementService.create_retirement_application(
            asset=sample_asset,
            applicant=sample_user,
            reason="Second",
            expected_date="2026-06-01"
        )
def test_non_owner_cannot_create_application(sample_asset, sample_user):
    """Only the owning department/authorized user may submit."""
    outsider = sample_user  # role does not match owning_department in this simple model
    # In a richer model this would check permissions; here we enforce via rule.
    with pytest.raises(PermissionError):
        RetirementService.create_retirement_application(
            asset=sample_asset,
            applicant=outsider,
            reason="Unauthorized",
            expected_date="2026-07-01"
        )
def test_approval_transition_versioning_prevents_race(sample_asset, sample_user):
    """Optimistic locking via version should block concurrent approvals."""
    app = RetirementService.create_retirement_application(
        asset=sample_asset,
        applicant=sample_user,
        reason="Race test",
        expected_date="2026-08-01"
    )
    actor = sample_user
    # first approval succeeds
    ApprovalChainService.approve(app, actor)
    assert sample_asset.status == "retired"
    # second approval on same instance should raise due to version mismatch
    with pytest.raises(ValidationError, match="version"):
        ApprovalChainService.approve(app, actor)
if __name__ == "__main__":
    pytest.main([__file__, "-v"])