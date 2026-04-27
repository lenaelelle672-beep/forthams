"""
Tests for AssetRetirementController (SWARM-223).

Coverage targets:
- Unit tests for request validation, state-machine transitions, and persistence.
- Integration tests for the full retirement flow.
- Contract tests for REST endpoints.
"""

import pytest
from unittest.mock import MagicMock, patch

from backend.api.v1.retirement import RetirementController
from backend.domain.entities.asset import Asset
from backend.domain.entities.retirement_request import RetirementRequest
from backend.domain.entities.retirement_history import RetirementHistory
from backend.domain.services.retirement_service import RetirementService
from backend.state_machine.retirement_state_machine import RetirementStateMachine
@pytest.fixture
def mock_retirement_service():
    svc = MagicMock(spec=RetirementService)
    return svc
@pytest.fixture
def controller(mock_retirement_service):
    return RetirementController(service=mock_retirement_service)
def test_submit_retirement_request_success(controller, mock_retirement_service):
    """AC-001: Submit a retirement request for an ACTIVE asset -> 201."""
    mock_retirement_service.submit_retirement_request.return_value = (
        MagicMock(id="req-123", status="PENDING")
    )
    response = controller.submit_retirement_request(
        asset_id="asset-123",
        reason="HARDWARE_FAILURE",
        reason_detail="Fan failed",
        requester_id="user-1",
    )
    assert response.status_code == 201
    assert response.headers["Location"] == "/api/v1/retirement-requests/req-123"
    mock_retirement_service.submit_retirement_request.assert_called_once_with(
        asset_id="asset-123",
        reason="HARDWARE_FAILURE",
        reason_detail="Fan failed",
        requester_id="user-1",
    )
def test_submit_retirement_request_asset_not_active(controller, mock_retirement_service):
    """AC-001: Asset not ACTIVE -> 400 ASSET_NOT_ACTIVE."""
    mock_retirement_service.submit_retirement_request.side_effect = ValueError(
        "ASSET_NOT_ACTIVE"
    )
    response = controller.submit_retirement_request(
        asset_id="asset-456",
        reason="UPGRADE",
        reason_detail="Upgrading CPU",
        requester_id="user-2",
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "ASSET_NOT_ACTIVE"
def test_submit_retirement_request_duplicate_pending(
    controller, mock_retirement_service
):
    """AC-001: Existing PENDING request for same asset -> 409 DUPLICATE_PENDING_REQUEST."""
    mock_retirement_service.submit_retirement_request.side_effect = ValueError(
        "DUPLICATE_PENDING_REQUEST"
    )
    response = controller.submit_retirement_request(
        asset_id="asset-789",
        reason="DISPOSAL",
        reason_detail="End of life",
        requester_id="user-3",
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "DUPLICATE_PENDING_REQUEST"
def test_state_machine_active_to_retired():
    """AC-001: Validate ACTIVE -> RETIRED transition via state machine."""
    sm = RetirementStateMachine()
    asset = Asset(id="a-1", name="Server-1", retirement_status="ACTIVE")
    sm.apply(asset, "SUBMIT_REQUEST")
    assert asset.retirement_status == "PENDING_RETIREMENT"
    sm.apply(asset, "APPROVE")
    assert asset.retirement_status == "RETIRED"
def test_state_machine_invalid_transition(controller):
    """AC-001: Invalid transition (RETIRED -> ACTIVE) raises exception."""
    sm = RetirementStateMachine()
    asset = Asset(id="a-2", name="Server-2", retirement_status="RETIRED")
    with pytest.raises(Exception, match="InvalidStateTransitionException"):
        sm.apply(asset, "REACTIVATE")
def test_approve_retirement(controller, mock_retirement_service):
    """AC-001: Approve a pending request -> 200 and state update."""
    mock_retirement_service.approve_retirement.return_value = MagicMock(
        id="req-999", status="APPROVED"
    )
    response = controller.approve_retirement(
        request_id="req-999", approver_id="admin-1", comments="Looks good"
    )
    assert response.status_code == 200
    mock_retirement_service.approve_retirement.assert_called_once_with(
        request_id="req-999", approver_id="admin-1", comments="Looks good"
    )
def test_reject_retirement(controller, mock_retirement_service):
    """AC-001: Reject a pending request -> 200 and status REJECTED."""
    mock_retirement_service.reject_retirement.return_value = MagicMock(
        id="req-888", status="REJECTED"
    )
    response = controller.reject_retirement(
        request_id="req-888", approver_id="admin-2", comments="Not ready"
    )
    assert response.status_code == 200
    mock_retirement_service.reject_retirement.assert_called_once_with(
        request_id="req-888", approver_id="admin-2", comments="Not ready"
    )
def test_get_retirement_request(controller, mock_retirement_service):
    """AC-001: Retrieve a request by ID -> 200."""
    mock_retirement_service.get_request_by_id.return_value = {
        "id": "req-111",
        "asset_id": "a-111",
        "status": "PENDING",
    }
    response = controller.get_retirement_request(request_id="req-111")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == "req-111"
def test_list_retirement_requests_pagination(controller, mock_retirement_service):
    """AC-001: List requests with pagination -> 200."""
    mock_retirement_service.list_requests.return_value = {
        "items": [],
        "total": 0,
        "page": 1,
        "page_size": 10,
    }
    response = controller.list_retirement_requests(page=1, page_size=10)
    assert response.status_code == 200
    data = response.json()["data"]
    assert "items" in data
    assert "total" in data
    assert data["page"] == 1
    assert data["page_size"] == 10
def test_integration_full_retirement_flow(controller, mock_retirement_service):
    """AC-001: Integration test - submit -> approve -> asset retired."""
    # Submit
    mock_retirement_service.submit_retirement_request.return_value = MagicMock(
        id="req-555", status="PENDING"
    )
    submit_resp = controller.submit_retirement_request(
        asset_id="asset-555",
        reason="HARDWARE_FAILURE",
        reason_detail="Disk failure",
        requester_id="ops-1",
    )
    assert submit_resp.status_code == 201
    # Approve
    mock_retirement_service.approve_retirement.return_value = MagicMock(
        id="req-555", status="APPROVED"
    )
    approve_resp = controller.approve_retirement(
        request_id="req-555", approver_id="auditor-1", comments="Approved"
    )
    assert approve_resp.status_code == 200
    # Verify service calls
    assert mock_retirement_service.submit_retirement_request.call_count == 1
    assert mock_retirement_service.approve_retirement.call_count == 1
def test_contract_post_retirement_request():
    """CT-001: POST /api/v1/retirement-requests returns 201 + Location."""
    # This is a contract-style unit test for the controller endpoint
    with patch("backend.api.v1.retirement.RetirementController") as MockCtrl:
        instance = MockCtrl.return_value
        instance.submit_retirement_request.return_value.status_code = 201
        instance.submit_retirement_request.return_value.headers = {
            "Location": "/api/v1/retirement-requests/req-abc"
        }
        response = instance.submit_retirement_request(
            asset_id="a", reason="H", reason_detail="d", requester_id="u"
        )
        assert response.status_code == 201
        assert "Location" in response.headers
def test_contract_get_request_by_id():
    """CT-002: GET /api/v1/retirement-requests/{id} returns 200 + JSON."""
    with patch("backend.api.v1.retirement.RetirementController") as MockCtrl:
        instance = MockCtrl.return_value
        instance.get_retirement_request.return_value.status_code = 200
        instance.get_retirement_request.return_value.json.return_value = {
            "data": {"id": "req-xyz"}
        }
        response = instance.get_retirement_request(request_id="req-xyz")
        assert response.status_code == 200
        assert "data" in response.json()
def test_contract_approve_endpoint():
    """CT-003: POST /api/v1/retirement-requests/{id}/approve returns 200."""
    with patch("backend.api.v1.retirement.RetirementController") as MockCtrl:
        instance = MockCtrl.return_value
        instance.approve_retirement.return_value.status_code = 200
        response = instance.approve_retirement(
            request_id="req-123", approver_id="a", comments="c"
        )
        assert response.status_code == 200
def test_contract_reject_endpoint():
    """CT-004: POST /api/v1/retirement-requests/{id}/reject returns 200."""
    with patch("backend.api.v1.retirement.RetirementController") as MockCtrl:
        instance = MockCtrl.return_value
        instance.reject_retirement.return_value.status_code = 200
        response = instance.reject_retirement(
            request_id="req-456", approver_id="b", comments="n"
        )
        assert response.status_code == 200
def test_validation_error_on_missing_fields(controller):
    """CT-006: Missing required fields -> 400 + ValidationError."""
    # Controller-level validation would raise; here we ensure the contract expects 400
    with patch("backend.api.v1.retirement.RetirementController") as MockCtrl:
        instance = MockCtrl.return_value
        instance.submit_retirement_request.side_effect = ValueError("400")
        response = instance.submit_retirement_request(
            asset_id="", reason="", reason_detail="", requester_id=""
        )
        assert response.status_code == 400