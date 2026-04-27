"""
tests/api/test_work_order_approve.py

API-level tests for the work-order multi-level approval flow.

Covers ATB-1 (forward state-machine transitions via approve),
ATB-2 (reject with / without reason), and ATB-3 (illegal state
transitions returning 409 Conflict).

All tests use pytest + a lightweight Flask / FastAPI test-client
pattern so they can run without a full Spring Boot stack.  The
application fixture is expected to provide a ``client`` that talks
to the real route handlers backed by an in-memory database.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Helpers / constants
# ---------------------------------------------------------------------------

APPROVE_URL = "/api/orders/{order_id}/approve"
REJECT_URL = "/api/orders/{order_id}/reject"
ORDER_DETAIL_URL = "/api/orders/{order_id}"

# Expected status values (must match the Java enum OrderStatus)
STATUS_PENDING = "PENDING"
STATUS_APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
STATUS_APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_CANCELLED = "CANCELLED"

# Role identifiers used in auth headers
ROLE_DEPT_MANAGER = "DEPT_MANAGER"
ROLE_ASSET_MANAGER = "ASSET_MANAGER"


def _approve_url(order_id: int | str) -> str:
    """Return the approve endpoint URL for *order_id*."""
    return APPROVE_URL.format(order_id=order_id)


def _reject_url(order_id: int | str) -> str:
    """Return the reject endpoint URL for *order_id*."""
    return REJECT_URL.format(order_id=order_id)


def _auth_headers(role: str, user_id: int = 1) -> dict[str, str]:
    """Build a minimal Authorization header dict for *role*."""
    return {
        "X-User-Id": str(user_id),
        "X-User-Role": role,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def dept_manager_headers() -> dict[str, str]:
    """Auth headers for a department-manager user."""
    return _auth_headers(ROLE_DEPT_MANAGER, user_id=10)


@pytest.fixture()
def asset_manager_headers() -> dict[str, str]:
    """Auth headers for an asset-manager user."""
    return _auth_headers(ROLE_ASSET_MANAGER, user_id=20)


@pytest.fixture()
def pending_order(client: Any) -> dict[str, Any]:
    """Create and return a work order in PENDING status."""
    payload = {
        "title": "Test Work Order",
        "description": "Approval flow test",
        "applicantId": 1,
    }
    resp = client.post("/api/orders", json=payload, headers=_auth_headers("EMPLOYEE", user_id=1))
    assert resp.status_code == 201, f"Failed to create order: {resp.data}"
    return resp.get_json()


@pytest.fixture()
def level1_order(client: Any, pending_order: dict[str, Any], dept_manager_headers: dict[str, str]) -> dict[str, Any]:
    """Create a work order and advance it to APPROVING_LEVEL_1."""
    order_id = pending_order["id"]
    resp = client.post(
        _approve_url(order_id),
        json={"version": pending_order["version"]},
        headers=dept_manager_headers,
    )
    assert resp.status_code == 200, f"Failed to approve to L1: {resp.data}"
    return resp.get_json()


@pytest.fixture()
def level2_order(client: Any, level1_order: dict[str, Any], asset_manager_headers: dict[str, str]) -> dict[str, Any]:
    """Create a work order and advance it to APPROVING_LEVEL_2."""
    order_id = level1_order["id"]
    resp = client.post(
        _approve_url(order_id),
        json={"version": level1_order["version"]},
        headers=asset_manager_headers,
    )
    assert resp.status_code == 200, f"Failed to approve to L2: {resp.data}"
    return resp.get_json()


# ---------------------------------------------------------------------------
# ATB-1: Forward state-machine transitions (approve)
# ---------------------------------------------------------------------------

class TestApproveForwardTransition:
    """Verify the happy-path approval chain: PENDING → L1 → L2 → APPROVED."""

    def test_atb1_pending_to_level1(
        self,
        client: Any,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """POST /approve on a PENDING order should transition to APPROVING_LEVEL_1."""
        order_id = pending_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": pending_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert body["status"] == STATUS_APPROVING_LEVEL_1

    def test_atb1_level1_to_level2(
        self,
        client: Any,
        level1_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """POST /approve on an APPROVING_LEVEL_1 order should transition to APPROVING_LEVEL_2."""
        order_id = level1_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level1_order["version"]},
            headers=asset_manager_headers,
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert body["status"] == STATUS_APPROVING_LEVEL_2

    def test_atb1_level2_to_approved(
        self,
        client: Any,
        level2_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """POST /approve on an APPROVING_LEVEL_2 order should transition to APPROVED."""
        order_id = level2_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level2_order["version"]},
            headers=asset_manager_headers,
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert body["status"] == STATUS_APPROVED

    def test_atb1_full_chain_creates_approval_records(
        self,
        client: Any,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """After the full approve chain, two approval records should exist."""
        order_id = pending_order["id"]

        # Level-1 approval
        resp1 = client.post(
            _approve_url(order_id),
            json={"version": pending_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp1.status_code == 200
        version_after_l1 = resp1.get_json()["version"]

        # Level-2 approval
        resp2 = client.post(
            _approve_url(order_id),
            json={"version": version_after_l1},
            headers=asset_manager_headers,
        )
        assert resp2.status_code == 200

        # Fetch approval records
        records_resp = client.get(f"/api/orders/{order_id}/approval-records")
        assert records_resp.status_code == 200
        records = records_resp.get_json()
        assert len(records) == 2

        actions = {r["action"] for r in records}
        assert actions == {"APPROVE"}

        # Verify operator IDs are recorded
        operator_ids = {r["operatorId"] for r in records}
        assert operator_ids == {10, 20}

    def test_atb1_approved_order_is_terminal(
        self,
        client: Any,
        level2_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """An APPROVED order should reject further approve/reject attempts (409)."""
        order_id = level2_order["id"]
        # Approve to final state
        resp = client.post(
            _approve_url(order_id),
            json={"version": level2_order["version"]},
            headers=asset_manager_headers(),
        )
        assert resp.status_code == 200

        # Attempt another approve
        final_version = resp.get_json()["version"]
        resp2 = client.post(
            _approve_url(order_id),
            json={"version": final_version},
            headers=dept_manager_headers,
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# ATB-2: Reject (reverse transition)
# ---------------------------------------------------------------------------

class TestRejectTransition:
    """Verify reject behaviour: with reason → 200, without reason → 400."""

    def test_atb2_reject_at_level1_with_reason(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Reject at APPROVING_LEVEL_1 with a valid reason should succeed (200)."""
        order_id = level1_order["id"]
        reason = "不合规"
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason, "version": level1_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert body["status"] == STATUS_REJECTED

    def test_atb2_reject_at_level2_with_reason(
        self,
        client: Any,
        level2_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """Reject at APPROVING_LEVEL_2 with a valid reason should succeed (200)."""
        order_id = level2_order["id"]
        reason = "资产信息不完整"
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason, "version": level2_order["version"]},
            headers=asset_manager_headers,
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert body["status"] == STATUS_REJECTED

    def test_atb2_reject_without_reason_returns_400(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Reject without rejectionReason should return HTTP 400 Bad Request."""
        order_id = level1_order["id"]
        resp = client.post(
            _reject_url(order_id),
            json={"version": level1_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert "rejectionReason" in str(body).lower() or "reason" in str(body).lower()

    def test_atb2_reject_with_empty_reason_returns_400(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Reject with an empty-string rejectionReason should return HTTP 400."""
        order_id = level1_order["id"]
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": "", "version": level1_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.data}"

    def test_atb2_reject_reason_max_500_chars(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """A rejection reason of exactly 500 characters should be accepted (200)."""
        order_id = level1_order["id"]
        reason_500 = "A" * 500
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason_500, "version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

    def test_atb2_reject_reason_exceeds_500_returns_400(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """A rejection reason exceeding 500 characters should return HTTP 400."""
        order_id = level1_order["id"]
        reason_501 = "A" * 501
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason_501, "version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 400

    def test_atb2_reject_creates_approval_record(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """After rejection, an approval record with action=REJECT should be persisted."""
        order_id = level1_order["id"]
        reason = "预算不足"
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason, "version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records_resp = client.get(f"/api/orders/{order_id}/approval-records")
        assert records_resp.status_code == 200
        records = records_resp.get_json()
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) == 1
        assert reject_records[0]["comment"] == reason
        assert reject_records[0]["operatorId"] == 10

    def test_atb2_rejected_order_is_terminal(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """A REJECTED order should reject further approve attempts (409)."""
        order_id = level1_order["id"]
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": "test", "version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        # Attempt to approve a rejected order
        rejected_version = resp.get_json()["version"]
        resp2 = client.post(
            _approve_url(order_id),
            json={"version": rejected_version},
            headers=dept_manager_headers,
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# ATB-3: Illegal state transitions → 409 Conflict
# ---------------------------------------------------------------------------

class TestIllegalStateTransition:
    """Verify that invalid state transitions are blocked with HTTP 409."""

    def test_atb3_pending_cannot_be_approved_by_asset_manager(
        self,
        client: Any,
        pending_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """A PENDING order cannot be directly approved by the asset manager (skip level)."""
        order_id = pending_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": pending_order["version"]},
            headers=asset_manager_headers,
        )

        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.data}"
        body = resp.get_json()
        assert "INVALID_STATE_TRANSITION" in body.get("errorCode", ""), (
            f"Expected INVALID_STATE_TRANSITION, got: {body}"
        )

        # Verify the order status has NOT changed
        detail_resp = client.get(ORDER_DETAIL_URL.format(order_id=order_id))
        assert detail_resp.get_json()["status"] == STATUS_PENDING

    def test_atb3_pending_cannot_be_rejected(
        self,
        client: Any,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """A PENDING order cannot be rejected (no approval level reached yet)."""
        order_id = pending_order["id"]
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": "test", "version": pending_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 409

    def test_atb3_level1_cannot_be_approved_twice(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """An APPROVING_LEVEL_1 order cannot be approved again by the same role."""
        order_id = level1_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level1_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 409
        body = resp.get_json()
        assert "INVALID_STATE_TRANSITION" in body.get("errorCode", "")

    def test_atb3_level2_cannot_be_approved_by_dept_manager(
        self,
        client: Any,
        level2_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """An APPROVING_LEVEL_2 order should only be approved by the asset manager."""
        order_id = level2_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level2_order["version"]},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 409

    def test_atb3_approved_order_cannot_be_rejected(
        self,
        client: Any,
        level2_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """An APPROVED order cannot be rejected."""
        order_id = level2_order["id"]
        # First approve to final
        resp = client.post(
            _approve_url(order_id),
            json={"version": level2_order["version"]},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200

        # Then attempt reject
        final_version = resp.get_json()["version"]
        resp2 = client.post(
            _reject_url(order_id),
            json={"rejectionReason": "too late", "version": final_version},
            headers=asset_manager_headers,
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Optimistic locking (version-based concurrency control)
# ---------------------------------------------------------------------------

class TestOptimisticLocking:
    """Verify that stale version values cause 409 Conflict."""

    def test_stale_version_on_approve_returns_409(
        self,
        client: Any,
        level1_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """Sending an outdated version should fail with HTTP 409."""
        order_id = level1_order["id"]
        stale_version = level1_order["version"] - 1  # intentionally stale

        resp = client.post(
            _approve_url(order_id),
            json={"version": stale_version},
            headers=asset_manager_headers,
        )

        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.data}"

    def test_stale_version_on_reject_returns_409(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Sending an outdated version on reject should fail with HTTP 409."""
        order_id = level1_order["id"]
        stale_version = level1_order["version"] - 1

        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": "test", "version": stale_version},
            headers=dept_manager_headers,
        )

        assert resp.status_code == 409

    def test_concurrent_approve_second_call_returns_409(
        self,
        client: Any,
        level1_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """Two concurrent approve calls with the same version; the second must fail."""
        order_id = level1_order["id"]
        version = level1_order["version"]

        resp1 = client.post(
            _approve_url(order_id),
            json={"version": version},
            headers=asset_manager_headers,
        )
        assert resp1.status_code == 200

        # Second call with the same (now stale) version
        resp2 = client.post(
            _approve_url(order_id),
            json={"version": version},
            headers=asset_manager_headers,
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Data isolation (role-based visibility)
# ---------------------------------------------------------------------------

class TestDataIsolation:
    """Verify that approval list endpoints enforce role-based filtering."""

    def test_dept_manager_sees_only_level1_orders(
        self,
        client: Any,
        pending_order: dict[str, Any],
        level2_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Department manager should only see APPROVING_LEVEL_1 orders."""
        resp = client.get("/api/approvals/pending", headers=dept_manager_headers)
        assert resp.status_code == 200
        orders = resp.get_json()
        for order in orders:
            assert order["status"] == STATUS_APPROVING_LEVEL_1, (
                f"Dept manager saw order {order['id']} with status {order['status']}"
            )

    def test_asset_manager_sees_only_level2_orders(
        self,
        client: Any,
        pending_order: dict[str, Any],
        level2_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """Asset manager should only see APPROVING_LEVEL_2 orders."""
        resp = client.get("/api/approvals/pending", headers=asset_manager_headers)
        assert resp.status_code == 200
        orders = resp.get_json()
        for order in orders:
            assert order["status"] == STATUS_APPROVING_LEVEL_2, (
                f"Asset manager saw order {order['id']} with status {order['status']}"
            )

    def test_unauthenticated_request_returns_401(
        self,
        client: Any,
    ) -> None:
        """Requests without auth headers should return HTTP 401."""
        resp = client.get("/api/approvals/pending")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Approval record persistence & traceability
# ---------------------------------------------------------------------------

class TestApprovalRecordPersistence:
    """Verify that approval records capture operator, action, timestamp, and reason."""

    def test_record_contains_operator_and_action(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Approval record must include operatorId, action, and createdAt."""
        order_id = level1_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records_resp = client.get(f"/api/orders/{order_id}/approval-records")
        records = records_resp.get_json()
        assert len(records) >= 1

        record = records[-1]
        assert "operatorId" in record
        assert "action" in record
        assert "createdAt" in record
        assert record["action"] == "APPROVE"
        assert record["operatorId"] == 10

    def test_reject_record_contains_reason(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Reject approval record must persist the rejectionReason as comment."""
        order_id = level1_order["id"]
        reason = "材料不符合标准"
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason, "version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records_resp = client.get(f"/api/orders/{order_id}/approval-records")
        records = records_resp.get_json()
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) == 1
        assert reject_records[0]["comment"] == reason

    def test_record_timestamp_iso8601(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Approval record timestamps must follow ISO 8601 format."""
        order_id = level1_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records_resp = client.get(f"/api/orders/{order_id}/approval-records")
        records = records_resp.get_json()
        timestamp = records[-1]["createdAt"]
        # ISO 8601 must be parseable; 'T' separator is the key indicator
        assert "T" in timestamp, f"Timestamp {timestamp!r} does not look like ISO 8601"


# ---------------------------------------------------------------------------
# Cancel flow
# ---------------------------------------------------------------------------

class TestCancelTransition:
    """Verify CANCELLED state transitions."""

    def test_cancel_pending_order(
        self,
        client: Any,
        pending_order: dict[str, Any],
    ) -> None:
        """A PENDING order can be cancelled by its applicant."""
        order_id = pending_order["id"]
        resp = client.post(
            f"/api/orders/{order_id}/cancel",
            json={"version": pending_order["version"]},
            headers=_auth_headers("EMPLOYEE", user_id=1),
        )
        assert resp.status_code == 200
        assert resp.get_json()["status"] == STATUS_CANCELLED

    def test_cancel_level1_order(
        self,
        client: Any,
        level1_order: dict[str, Any],
    ) -> None:
        """An APPROVING_LEVEL_1 order can be cancelled by its applicant."""
        order_id = level1_order["id"]
        resp = client.post(
            f"/api/orders/{order_id}/cancel",
            json={"version": level1_order["version"]},
            headers=_auth_headers("EMPLOYEE", user_id=1),
        )
        assert resp.status_code == 200
        assert resp.get_json()["status"] == STATUS_CANCELLED

    def test_cancelled_order_rejects_approve(
        self,
        client: Any,
        pending_order: dict[str, Any],
    ) -> None:
        """A CANCELLED order should reject approve attempts with 409."""
        order_id = pending_order["id"]
        # Cancel first
        resp = client.post(
            f"/api/orders/{order_id}/cancel",
            json={"version": pending_order["version"]},
            headers=_auth_headers("EMPLOYEE", user_id=1),
        )
        assert resp.status_code == 200

        # Then try to approve
        cancelled_version = resp.get_json()["version"]
        resp2 = client.post(
            _approve_url(order_id),
            json={"version": cancelled_version},
            headers=_auth_headers(ROLE_DEPT_MANAGER, user_id=10),
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Response schema validation
# ---------------------------------------------------------------------------

class TestResponseSchema:
    """Verify that API responses conform to the expected JSON schema."""

    def test_approve_response_contains_required_fields(
        self,
        client: Any,
        level1_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """Approve response must include id, status, and version."""
        order_id = level1_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": level1_order["version"]},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        for field in ("id", "status", "version"):
            assert field in body, f"Missing field '{field}' in approve response: {body}"

    def test_reject_response_contains_required_fields(
        self,
        client: Any,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Reject response must include id, status, and version."""
        order_id = level1_order["id"]
        resp = client.post(
            _reject_url(order_id),
            json={"rejectionReason": "test", "version": level1_order["version"]},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        for field in ("id", "status", "version"):
            assert field in body, f"Missing field '{field}' in reject response: {body}"

    def test_error_response_contains_error_code(
        self,
        client: Any,
        pending_order: dict[str, Any],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """409 error responses must include an errorCode field."""
        order_id = pending_order["id"]
        resp = client.post(
            _approve_url(order_id),
            json={"version": pending_order["version"]},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 409
        body = resp.get_json()
        assert "errorCode" in body, f"Missing errorCode in error response: {body}"

    def test_version_increments_on_each_transition(
        self,
        client: Any,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
        asset_manager_headers: dict[str, str],
    ) -> None:
        """The version field must increment after each state transition."""
        order_id = pending_order["id"]
        v0 = pending_order["version"]

        resp1 = client.post(
            _approve_url(order_id),
            json={"version": v0},
            headers=dept_manager_headers,
        )
        v1 = resp1.get_json()["version"]
        assert v1 > v0

        resp2 = client.post(
            _approve_url(order_id),
            json={"version": v1},
            headers=asset_manager_headers,
        )
        v2 = resp2.get_json()["version"]
        assert v2 > v1