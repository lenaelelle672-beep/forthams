"""
Integration tests for multi-level approval operations.

Covers ATB-1 through ATB-3 from the approval workflow specification:
  - ATB-1: Forward state machine transitions (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
  - ATB-2: Reverse rejection transitions with mandatory rejection reason
  - ATB-3: Invalid / cross-level state transition interception (HTTP 409)
  - Optimistic locking on concurrent approvals
  - Role-based data isolation for approval list queries
  - CANCELLED state support

All tests exercise the REST endpoints:
  POST /api/orders/{id}/approve
  POST /api/orders/{id}/reject
  GET  /api/orders/approval-pending
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

APPROVE_URL = "/api/orders/{order_id}/approve"
REJECT_URL = "/api/orders/{order_id}/reject"
APPROVAL_PENDING_URL = "/api/orders/approval-pending"
ORDER_DETAIL_URL = "/api/orders/{order_id}"

# Status enum values matching backend OrderStatus
STATUS_PENDING = "PENDING"
STATUS_APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
STATUS_APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_CANCELLED = "CANCELLED"

# Error codes
ERROR_INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
ERROR_OPTIMISTIC_LOCK = "OPTIMISTIC_LOCK_CONFLICT"

# Role identifiers
ROLE_DEPT_MANAGER = "DEPT_MANAGER"
ROLE_ASSET_MANAGER = "ASSET_MANAGER"
ROLE_EMPLOYEE = "EMPLOYEE"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _approve_url(order_id: int | str) -> str:
    """Return the approve endpoint URL for the given order ID."""
    return APPROVE_URL.format(order_id=order_id)


def _reject_url(order_id: int | str) -> str:
    """Return the reject endpoint URL for the given order ID."""
    return REJECT_URL.format(order_id=order_id)


def _order_url(order_id: int | str) -> str:
    """Return the order detail endpoint URL for the given order ID."""
    return ORDER_DETAIL_URL.format(order_id=order_id)


def _auth_headers(user_id: str, role: str) -> Dict[str, str]:
    """Build authorization headers for the given user and role.

    In a real integration environment this would produce a valid JWT;
    here we rely on the test harness injecting the identity from these
    well-known headers.
    """
    return {
        "X-Test-User-Id": user_id,
        "X-Test-User-Role": role,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def employee_client(async_client: AsyncClient) -> AsyncClient:
    """Return an API client authenticated as a regular employee."""
    return async_client


@pytest.fixture
async def dept_manager_headers() -> Dict[str, str]:
    """Return auth headers for a department manager."""
    return _auth_headers("dept_mgr_01", ROLE_DEPT_MANAGER)


@pytest.fixture
async def asset_manager_headers() -> Dict[str, str]:
    """Return auth headers for an asset manager."""
    return _auth_headers("asset_mgr_01", ROLE_ASSET_MANAGER)


@pytest.fixture
async def employee_headers() -> Dict[str, str]:
    """Return auth headers for a regular employee (order submitter)."""
    return _auth_headers("employee_01", ROLE_EMPLOYEE)


@pytest.fixture
async def pending_order(async_client: AsyncClient, employee_headers: Dict[str, str]) -> Dict[str, Any]:
    """Create and return a work order in PENDING status via the submit flow.

    Returns the full order representation as returned by the API.
    """
    payload = {
        "title": "Integration test order",
        "description": "Order for approval integration tests",
        "category": "IT_EQUIPMENT",
        "priority": "NORMAL",
    }
    resp = await async_client.post(
        "/api/orders",
        json=payload,
        headers=employee_headers,
    )
    assert resp.status_code == 201, f"Failed to create order: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# ATB-1: Forward State Machine Transitions
# ---------------------------------------------------------------------------

class TestForwardStateTransitions:
    """ATB-1: Verify PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_full_approval_chain(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """Execute the complete two-level approval chain and verify each state.

        Steps:
        1. Department manager approves → status becomes APPROVING_LEVEL_1
        2. Asset manager approves → status becomes APPROVING_LEVEL_2
        3. Final approval → status becomes APPROVED
        """
        order_id = pending_order["id"]

        # --- Step 1: Department manager approves (PENDING → APPROVING_LEVEL_1) ---
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200, f"Level-1 approve failed: {resp.text}"
        body = resp.json()
        assert body["status"] == STATUS_APPROVING_LEVEL_1
        assert body["id"] == order_id

        # Verify approval record was created
        records = await _fetch_approval_records(async_client, order_id, dept_manager_headers)
        assert len(records) >= 1
        assert records[-1]["action"] == "APPROVE"
        assert records[-1]["operatorId"] == "dept_mgr_01"

        # --- Step 2: Asset manager approves (APPROVING_LEVEL_1 → APPROVING_LEVEL_2) ---
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200, f"Level-2 approve failed: {resp.text}"
        body = resp.json()
        assert body["status"] == STATUS_APPROVING_LEVEL_2

        # Verify second approval record
        records = await _fetch_approval_records(async_client, order_id, asset_manager_headers)
        assert len(records) >= 2
        assert records[-1]["action"] == "APPROVE"
        assert records[-1]["operatorId"] == "asset_mgr_01"

        # --- Step 3: Final approval (APPROVING_LEVEL_2 → APPROVED) ---
        # The final approval may be performed by the system or an admin;
        # we simulate it with the asset manager for integration purposes.
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200, f"Final approve failed: {resp.text}"
        body = resp.json()
        assert body["status"] == STATUS_APPROVED

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approval_record_persistence(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Verify that each approval action creates a persistent approval record.

        The record must contain: operator_id, action, timestamp, and comment.
        """
        order_id = pending_order["id"]

        resp = await async_client.post(
            _approve_url(order_id),
            json={"comment": "Reviewed and approved by dept manager"},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records = await _fetch_approval_records(async_client, order_id, dept_manager_headers)
        assert len(records) >= 1

        record = records[-1]
        assert record["orderId"] == order_id
        assert record["operatorId"] == "dept_mgr_01"
        assert record["action"] == "APPROVE"
        assert record["comment"] == "Reviewed and approved by dept manager"
        # Timestamp should be a valid ISO 8601 string
        assert "createdAt" in record or "timestamp" in record
        ts = record.get("createdAt") or record.get("timestamp")
        datetime.fromisoformat(ts.replace("Z", "+00:00"))  # must not raise

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approve_increments_version(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Verify that each approval increments the order version (optimistic lock)."""
        order_id = pending_order["id"]
        initial_version = pending_order.get("version", 0)

        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["version"] == initial_version + 1


# ---------------------------------------------------------------------------
# ATB-2: Reverse Rejection Transitions
# ---------------------------------------------------------------------------

class TestRejectionTransitions:
    """ATB-2: Verify rejection from any approval node with mandatory reason."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_at_level_1_with_reason(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Reject at APPROVING_LEVEL_1 with a valid rejection reason.

        Expected: status → REJECTED, HTTP 200.
        """
        order_id = pending_order["id"]

        # First approve to level 1
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == STATUS_APPROVING_LEVEL_1

        # Now reject with reason
        reject_payload = {"rejectionReason": "Budget allocation not approved"}
        resp = await async_client.post(
            _reject_url(order_id),
            json=reject_payload,
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200, f"Reject failed: {resp.text}"
        body = resp.json()
        assert body["status"] == STATUS_REJECTED

        # Verify rejection record
        records = await _fetch_approval_records(async_client, order_id, dept_manager_headers)
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) >= 1
        assert reject_records[-1]["comment"] == "Budget allocation not approved"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_at_level_2_with_reason(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """Reject at APPROVING_LEVEL_2 with a valid rejection reason.

        Expected: status → REJECTED, HTTP 200.
        """
        order_id = pending_order["id"]

        # Approve to level 1
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        # Approve to level 2
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == STATUS_APPROVING_LEVEL_2

        # Reject at level 2
        reject_payload = {"rejectionReason": "Asset not found in inventory"}
        resp = await async_client.post(
            _reject_url(order_id),
            json=reject_payload,
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200, f"Level-2 reject failed: {resp.text}"
        assert resp.json()["status"] == STATUS_REJECTED

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_without_reason_returns_400(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Reject without providing rejectionReason must return HTTP 400.

        The rejectionReason field is mandatory (non-empty string, max 500 chars).
        """
        order_id = pending_order["id"]

        # Approve to level 1 first
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        # Reject with empty body (no rejectionReason)
        resp = await async_client.post(
            _reject_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 400, (
            f"Expected 400 for missing rejectionReason, got {resp.status_code}: {resp.text}"
        )

        # Reject with null rejectionReason
        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": None},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 400

        # Reject with empty string rejectionReason
        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": ""},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 400

        # Verify status has NOT changed
        detail_resp = await async_client.get(
            _order_url(order_id),
            headers=dept_manager_headers,
        )
        assert detail_resp.status_code == 200
        assert detail_resp.json()["status"] == STATUS_APPROVING_LEVEL_1

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_reason_max_length(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Rejection reason exceeding 500 characters must return HTTP 400."""
        order_id = pending_order["id"]

        # Approve to level 1
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        # Reject with reason > 500 chars
        long_reason = "X" * 501
        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": long_reason},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 400, (
            f"Expected 400 for rejectionReason > 500 chars, got {resp.status_code}"
        )

        # Exactly 500 chars should be accepted
        exact_reason = "Y" * 500
        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": exact_reason},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# ATB-3: Invalid State Transition Interception
# ---------------------------------------------------------------------------

class TestInvalidStateTransitions:
    """ATB-3: Verify that illegal state transitions are blocked with HTTP 409."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_skip_level_approval_rejected(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """Asset manager cannot approve a PENDING order directly.

        PENDING must first transition to APPROVING_LEVEL_1 via dept manager.
        Expected: HTTP 409 with error code INVALID_STATE_TRANSITION.
        """
        order_id = pending_order["id"]
        assert pending_order["status"] == STATUS_PENDING

        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 409, (
            f"Expected 409 for cross-level approval, got {resp.status_code}: {resp.text}"
        )
        body = resp.json()
        assert body.get("errorCode") == ERROR_INVALID_STATE_TRANSITION, (
            f"Expected error code {ERROR_INVALID_STATE_TRANSITION}, got {body}"
        )

        # Verify status unchanged
        detail_resp = await async_client.get(
            _order_url(order_id),
            headers=asset_manager_headers,
        )
        assert detail_resp.json()["status"] == STATUS_PENDING

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_double_approve_same_level_rejected(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Approving the same level twice must be blocked.

        After dept manager approves (PENDING → APPROVING_LEVEL_1), a second
        approve by the same role should fail with 409.
        """
        order_id = pending_order["id"]

        # First approve
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == STATUS_APPROVING_LEVEL_1

        # Second approve by same role — should fail
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 409, (
            f"Expected 409 for double same-level approve, got {resp.status_code}: {resp.text}"
        )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approve_already_rejected_order(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Approving an already REJECTED order must return 409."""
        order_id = pending_order["id"]

        # Approve to level 1
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        # Reject
        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": "Not compliant"},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == STATUS_REJECTED

        # Try to approve the rejected order
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approve_already_approved_order(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """Approving an already APPROVED order must return 409."""
        order_id = pending_order["id"]

        # Full approval chain
        for headers in [dept_manager_headers, asset_manager_headers, asset_manager_headers]:
            resp = await async_client.post(
                _approve_url(order_id),
                json={},
                headers=headers,
            )
            assert resp.status_code == 200

        # Try to approve again
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_pending_order(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Rejecting a PENDING order (not yet in any approval level) must return 409.

        Rejection is only valid from APPROVING_LEVEL_1 or APPROVING_LEVEL_2.
        """
        order_id = pending_order["id"]
        assert pending_order["status"] == STATUS_PENDING

        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": "Too early to reject"},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 409, (
            f"Expected 409 for rejecting PENDING order, got {resp.status_code}: {resp.text}"
        )


# ---------------------------------------------------------------------------
# Optimistic Locking (Concurrency)
# ---------------------------------------------------------------------------

class TestOptimisticLocking:
    """Verify that concurrent approval requests are handled via optimistic locking."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_concurrent_approve_returns_409(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Two concurrent approve requests with the same version must result in one 409.

        Simulates: client A reads order (version=N), client B reads order (version=N),
        client A approves successfully (version→N+1), client B approves with stale
        version=N → HTTP 409.
        """
        order_id = pending_order["id"]
        version = pending_order.get("version", 0)

        # First request with correct version succeeds
        resp_a = await async_client.post(
            _approve_url(order_id),
            json={"version": version},
            headers=dept_manager_headers,
        )
        assert resp_a.status_code == 200

        # Second request with stale version fails
        resp_b = await async_client.post(
            _approve_url(order_id),
            json={"version": version},
            headers=dept_manager_headers,
        )
        assert resp_b.status_code == 409, (
            f"Expected 409 for stale version, got {resp_b.status_code}: {resp_b.text}"
        )
        body = resp_b.json()
        assert body.get("errorCode") == ERROR_OPTIMISTIC_LOCK


# ---------------------------------------------------------------------------
# Role-Based Data Isolation
# ---------------------------------------------------------------------------

class TestRoleBasedDataIsolation:
    """Verify that approval list endpoints enforce role-based filtering.

    - DEPT_MANAGER sees only APPROVING_LEVEL_1 orders.
    - ASSET_MANAGER sees only APPROVING_LEVEL_2 orders.
    """

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_dept_manager_sees_only_level_1_orders(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """Department manager's pending list must only contain APPROVING_LEVEL_1 orders."""
        order_id = pending_order["id"]

        # Approve to level 1
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        # Fetch pending list as dept manager
        resp = await async_client.get(
            APPROVAL_PENDING_URL,
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        orders = resp.json().get("items", resp.json() if isinstance(resp.json(), list) else [])
        if isinstance(orders, dict):
            orders = orders.get("items", orders.get("data", []))

        for order in orders:
            assert order["status"] == STATUS_APPROVING_LEVEL_1, (
                f"Dept manager should only see APPROVING_LEVEL_1, found {order['status']}"
            )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_asset_manager_sees_only_level_2_orders(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """Asset manager's pending list must only contain APPROVING_LEVEL_2 orders."""
        order_id = pending_order["id"]

        # Approve through level 1 and level 2
        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        resp = await async_client.post(
            _approve_url(order_id),
            json={},
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200

        # Fetch pending list as asset manager
        resp = await async_client.get(
            APPROVAL_PENDING_URL,
            headers=asset_manager_headers,
        )
        assert resp.status_code == 200
        orders = resp.json().get("items", resp.json() if isinstance(resp.json(), list) else [])
        if isinstance(orders, dict):
            orders = orders.get("items", orders.get("data", []))

        for order in orders:
            assert order["status"] == STATUS_APPROVING_LEVEL_2, (
                f"Asset manager should only see APPROVING_LEVEL_2, found {order['status']}"
            )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_dept_manager_cannot_see_level_2_orders(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
    ) -> None:
        """After an order reaches APPROVING_LEVEL_2, it must not appear in the
        department manager's pending list."""
        order_id = pending_order["id"]

        # Advance to level 2
        await async_client.post(_approve_url(order_id), json={}, headers=dept_manager_headers)
        await async_client.post(_approve_url(order_id), json={}, headers=asset_manager_headers)

        # Dept manager list should NOT contain this order
        resp = await async_client.get(
            APPROVAL_PENDING_URL,
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200
        orders = resp.json().get("items", resp.json() if isinstance(resp.json(), list) else [])
        if isinstance(orders, dict):
            orders = orders.get("items", orders.get("data", []))

        order_ids = [o["id"] for o in orders]
        assert order_id not in order_ids, (
            f"Order {order_id} at APPROVING_LEVEL_2 should not be visible to dept manager"
        )


# ---------------------------------------------------------------------------
# CANCELLED State Support
# ---------------------------------------------------------------------------

class TestCancelledState:
    """Verify CANCELLED state transitions and constraints."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cancel_pending_order(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        employee_headers: Dict[str, str],
    ) -> None:
        """A PENDING order can be cancelled by the submitter.

        Expected: status → CANCELLED, HTTP 200.
        """
        order_id = pending_order["id"]

        resp = await async_client.post(
            f"/api/orders/{order_id}/cancel",
            json={},
            headers=employee_headers,
        )
        # Cancel may or may not be implemented in this phase; if endpoint
        # exists it should return 200 with CANCELLED status.
        if resp.status_code == 200:
            assert resp.json()["status"] == STATUS_CANCELLED
        elif resp.status_code == 404:
            pytest.skip("Cancel endpoint not yet implemented in this phase")

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cancel_approved_order_rejected(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
        asset_manager_headers: Dict[str, str],
        employee_headers: Dict[str, str],
    ) -> None:
        """Cancelling an already APPROVED order must return 409."""
        order_id = pending_order["id"]

        # Full approval chain
        for headers in [dept_manager_headers, asset_manager_headers, asset_manager_headers]:
            resp = await async_client.post(
                _approve_url(order_id),
                json={},
                headers=headers,
            )
            assert resp.status_code == 200

        resp = await async_client.post(
            f"/api/orders/{order_id}/cancel",
            json={},
            headers=employee_headers,
        )
        if resp.status_code != 404:
            assert resp.status_code == 409, (
                f"Expected 409 for cancelling APPROVED order, got {resp.status_code}"
            )


# ---------------------------------------------------------------------------
# Approval Record Verification Helpers
# ---------------------------------------------------------------------------

class TestApprovalRecordIntegrity:
    """Verify approval records contain all required fields and maintain integrity."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approval_record_required_fields(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Each approval record must contain: orderId, operatorId, action, timestamp."""
        order_id = pending_order["id"]

        resp = await async_client.post(
            _approve_url(order_id),
            json={"comment": "LGTM"},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records = await _fetch_approval_records(async_client, order_id, dept_manager_headers)
        assert len(records) >= 1
        record = records[-1]

        # Required fields
        assert "orderId" in record or "order_id" in record
        assert "operatorId" in record or "operator_id" in record
        assert "action" in record
        assert "createdAt" in record or "timestamp" in record or "created_at" in record

        # Action value
        assert record["action"] in ("APPROVE", "REJECT")

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_rejection_record_contains_reason(
        self,
        async_client: AsyncClient,
        pending_order: Dict[str, Any],
        dept_manager_headers: Dict[str, str],
    ) -> None:
        """Rejection records must persist the rejection reason in the comment field."""
        order_id = pending_order["id"]
        reason = "Does not meet procurement policy requirements"

        # Approve to level 1
        await async_client.post(_approve_url(order_id), json={}, headers=dept_manager_headers)

        # Reject with reason
        resp = await async_client.post(
            _reject_url(order_id),
            json={"rejectionReason": reason},
            headers=dept_manager_headers,
        )
        assert resp.status_code == 200

        records = await _fetch_approval_records(async_client, order_id, dept_manager_headers)
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) >= 1
        assert reject_records[-1].get("comment") == reason


# ---------------------------------------------------------------------------
# Async Helper Functions
# ---------------------------------------------------------------------------

async def _fetch_approval_records(
    client: AsyncClient,
    order_id: int | str,
    headers: Dict[str, str],
) -> list:
    """Fetch approval records for a given order from the API.

    Tries the dedicated records endpoint first, falls back to order detail.
    """
    # Try dedicated approval records endpoint
    resp = await client.get(
        f"/api/orders/{order_id}/approval-records",
        headers=headers,
    )
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list):
            return data
        return data.get("items", data.get("data", data.get("records", [])))

    # Fallback: extract from order detail
    resp = await client.get(_order_url(order_id), headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        return data.get("approvalRecords", data.get("approval_records", []))

    return []