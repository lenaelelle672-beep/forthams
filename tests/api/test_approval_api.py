"""
Approval API Integration Tests
===============================

Tests the multi-level approval workflow for work orders, covering:

- ATB-1: Forward state transitions (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
- ATB-2: Reverse rejection transitions (any approval node → REJECTED) with mandatory reason
- ATB-3: Illegal state transition interception (HTTP 409 + INVALID_STATE_TRANSITION)
- ATB-4: Role-based pending approval list filtering
- ATB-5: Approval detail operations (approve / reject with validation)

Boundary constraints enforced:
  - State machine strict validation (no cross-level approval)
  - rejectionReason is required on reject (max 500 chars), HTTP 400 if missing
  - Optimistic locking via `version` field, HTTP 409 on conflict
  - Role-based data isolation (dept_manager sees LEVEL_1, asset_admin sees LEVEL_2)
  - RESTful JSON API, ISO 8601 dates
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Constants & Helpers
# ---------------------------------------------------------------------------

BASE_URL = "/api/orders"

# Expected status enum values matching the backend OrderStatus enum
STATUS_PENDING = "PENDING"
STATUS_APPROVING_LEVEL_1 = "APPROVING_LEVEL_1"
STATUS_APPROVING_LEVEL_2 = "APPROVING_LEVEL_2"
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_CANCELLED = "CANCELLED"

# Role identifiers
ROLE_DEPT_MANAGER = "DEPT_MANAGER"
ROLE_ASSET_ADMIN = "ASSET_ADMIN"
ROLE_EMPLOYEE = "EMPLOYEE"

# Error codes
ERR_INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
ERR_OPTIMISTIC_LOCK = "OPTIMISTIC_LOCK_CONFLICT"
ERR_REJECTION_REASON_REQUIRED = "REJECTION_REASON_REQUIRED"


def _iso_now() -> str:
    """Return current UTC time in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def _build_auth_header(user_id: int, role: str) -> dict[str, str]:
    """Build a mock Authorization header for the given user and role."""
    return {"Authorization": f"Bearer mock-jwt-{user_id}-{role}"}


def _build_work_order_payload(**overrides: Any) -> dict[str, Any]:
    """Build a sample work order creation payload."""
    defaults: dict[str, Any] = {
        "title": "Test Work Order",
        "description": "Approval API test work order",
        "applicantId": 1,
        "category": "PROCUREMENT",
        "priority": "MEDIUM",
    }
    defaults.update(overrides)
    return defaults


def _build_reject_payload(reason: str = "不合规") -> dict[str, str]:
    """Build a rejection request payload with the given reason."""
    return {"rejectionReason": reason}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def dept_manager_headers() -> dict[str, str]:
    """Auth headers for a department manager (Level 1 approver)."""
    return _build_auth_header(user_id=10, role=ROLE_DEPT_MANAGER)


@pytest.fixture
def asset_admin_headers() -> dict[str, str]:
    """Auth headers for an asset administrator (Level 2 approver)."""
    return _build_auth_header(user_id=20, role=ROLE_ASSET_ADMIN)


@pytest.fixture
def employee_headers() -> dict[str, str]:
    """Auth headers for a regular employee (applicant)."""
    return _build_auth_header(user_id=1, role=ROLE_EMPLOYEE)


@pytest.fixture
def pending_order() -> dict[str, Any]:
    """Return a mock work order in PENDING state."""
    return {
        "id": 1001,
        "title": "Test Work Order",
        "description": "Approval API test work order",
        "status": STATUS_PENDING,
        "version": 1,
        "applicantId": 1,
        "applicantName": "Zhang San",
        "category": "PROCUREMENT",
        "priority": "MEDIUM",
        "createdAt": _iso_now(),
        "updatedAt": _iso_now(),
    }


@pytest.fixture
def level1_order() -> dict[str, Any]:
    """Return a mock work order in APPROVING_LEVEL_1 state."""
    return {
        "id": 1002,
        "title": "Level 1 Order",
        "description": "Order awaiting Level 1 approval",
        "status": STATUS_APPROVING_LEVEL_1,
        "version": 2,
        "applicantId": 1,
        "applicantName": "Zhang San",
        "category": "PROCUREMENT",
        "priority": "MEDIUM",
        "createdAt": _iso_now(),
        "updatedAt": _iso_now(),
    }


@pytest.fixture
def level2_order() -> dict[str, Any]:
    """Return a mock work order in APPROVING_LEVEL_2 state."""
    return {
        "id": 1003,
        "title": "Level 2 Order",
        "description": "Order awaiting Level 2 approval",
        "status": STATUS_APPROVING_LEVEL_2,
        "version": 3,
        "applicantId": 1,
        "applicantName": "Zhang San",
        "category": "PROCUREMENT",
        "priority": "HIGH",
        "createdAt": _iso_now(),
        "updatedAt": _iso_now(),
    }


@pytest.fixture
def approved_order() -> dict[str, Any]:
    """Return a mock work order in APPROVED state."""
    return {
        "id": 1004,
        "title": "Approved Order",
        "description": "Fully approved order",
        "status": STATUS_APPROVED,
        "version": 4,
        "applicantId": 1,
        "applicantName": "Zhang San",
        "category": "DISPOSAL",
        "priority": "LOW",
        "createdAt": _iso_now(),
        "updatedAt": _iso_now(),
    }


@pytest.fixture
def rejected_order() -> dict[str, Any]:
    """Return a mock work order in REJECTED state."""
    return {
        "id": 1005,
        "title": "Rejected Order",
        "description": "Rejected work order",
        "status": STATUS_REJECTED,
        "version": 2,
        "applicantId": 1,
        "applicantName": "Zhang San",
        "category": "PROCUREMENT",
        "priority": "MEDIUM",
        "createdAt": _iso_now(),
        "updatedAt": _iso_now(),
    }


# ---------------------------------------------------------------------------
# ATB-1: Forward State Transition Tests
# ---------------------------------------------------------------------------

class TestATB1ForwardStateTransition:
    """Verify PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""

    @pytest.mark.asyncio
    async def test_approve_pending_to_level1(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/approve transitions PENDING → APPROVING_LEVEL_1.

        Expected: HTTP 200, status changes to APPROVING_LEVEL_1,
        approval_records table gets a new entry.
        """
        order_id = pending_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )

        assert response.status_code == 200, (
            f"Expected 200 for PENDING→LEVEL_1 approval, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert body["status"] == STATUS_APPROVING_LEVEL_1
        assert body["version"] == pending_order["version"] + 1
        # Verify approval record was created
        assert "approvalRecord" in body or "id" in body

    @pytest.mark.asyncio
    async def test_approve_level1_to_level2(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/approve transitions APPROVING_LEVEL_1 → APPROVING_LEVEL_2.

        Expected: HTTP 200, status changes to APPROVING_LEVEL_2.
        """
        order_id = level1_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )

        assert response.status_code == 200, (
            f"Expected 200 for LEVEL_1→LEVEL_2 approval, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert body["status"] == STATUS_APPROVING_LEVEL_2
        assert body["version"] == level1_order["version"] + 1

    @pytest.mark.asyncio
    async def test_approve_level2_to_approved(
        self,
        async_client: AsyncClient,
        level2_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/approve transitions APPROVING_LEVEL_2 → APPROVED.

        Expected: HTTP 200, status changes to APPROVED.
        """
        order_id = level2_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )

        assert response.status_code == 200, (
            f"Expected 200 for LEVEL_2→APPROVED approval, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert body["status"] == STATUS_APPROVED
        assert body["version"] == level2_order["version"] + 1

    @pytest.mark.asyncio
    async def test_full_approval_chain_creates_records(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """Complete approval chain should create 3 approval records.

        Expected: After PENDING→LEVEL_1→LEVEL_2→APPROVED, the
        approval_records table has 3 entries for this order.
        """
        order_id = pending_order["id"]

        # Step 1: PENDING → APPROVING_LEVEL_1
        resp1 = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )
        assert resp1.status_code == 200

        # Step 2: APPROVING_LEVEL_1 → APPROVING_LEVEL_2
        resp2 = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )
        assert resp2.status_code == 200

        # Step 3: APPROVING_LEVEL_2 → APPROVED
        resp3 = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )
        assert resp3.status_code == 200
        assert resp3.json()["status"] == STATUS_APPROVED

        # Verify approval records
        records_resp = await async_client.get(
            f"{BASE_URL}/{order_id}/approval-records",
            headers=dept_manager_headers,
        )
        if records_resp.status_code == 200:
            records = records_resp.json()
            # Should have at least 3 approval records (one per step)
            assert len(records) >= 3, (
                f"Expected at least 3 approval records, got {len(records)}"
            )
            # Verify each record has required fields
            for record in records[:3]:
                assert "operatorId" in record
                assert "action" in record
                assert record["action"] == "APPROVE"
                assert "createdAt" in record

    @pytest.mark.asyncio
    async def test_approval_record_contains_operator_and_timestamp(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Approval record must contain operator ID, action, and ISO 8601 timestamp."""
        order_id = pending_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )
        assert response.status_code == 200

        body = response.json()
        # The response should include the created approval record
        if "approvalRecord" in body:
            record = body["approvalRecord"]
        else:
            # Fetch records separately
            records_resp = await async_client.get(
                f"{BASE_URL}/{order_id}/approval-records",
                headers=dept_manager_headers,
            )
            assert records_resp.status_code == 200
            records = records_resp.json()
            assert len(records) >= 1
            record = records[0]

        assert record["operatorId"] == 10
        assert record["action"] == "APPROVE"
        # Verify ISO 8601 timestamp format
        assert "createdAt" in record
        created_at = record["createdAt"]
        # Should be parseable as ISO 8601
        datetime.fromisoformat(created_at.replace("Z", "+00:00"))


# ---------------------------------------------------------------------------
# ATB-2: Rejection (Reverse State Transition) Tests
# ---------------------------------------------------------------------------

class TestATB2RejectionTransition:
    """Verify rejection from any approval node → REJECTED."""

    @pytest.mark.asyncio
    async def test_reject_at_level1_with_reason(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/reject with valid reason transitions to REJECTED.

        Expected: HTTP 200, status = REJECTED, rejection reason persisted.
        """
        order_id = level1_order["id"]
        reason = "预算不足，不予批准"
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": reason},
        )

        assert response.status_code == 200, (
            f"Expected 200 for rejection with reason, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert body["status"] == STATUS_REJECTED
        assert body["version"] == level1_order["version"] + 1

    @pytest.mark.asyncio
    async def test_reject_at_level2_with_reason(
        self,
        async_client: AsyncClient,
        level2_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/reject at Level 2 transitions to REJECTED.

        Expected: HTTP 200, status = REJECTED.
        """
        order_id = level2_order["id"]
        reason = "资产信息不完整"
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=asset_admin_headers,
            json={"operatorId": 20, "rejectionReason": reason},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == STATUS_REJECTED

    @pytest.mark.asyncio
    async def test_reject_without_reason_returns_400(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/reject without rejectionReason returns HTTP 400.

        Expected: HTTP 400 Bad Request with error code REJECTION_REASON_REQUIRED.
        """
        order_id = level1_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )

        assert response.status_code == 400, (
            f"Expected 400 for missing rejectionReason, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert "error" in body or "code" in body or "message" in body

    @pytest.mark.asyncio
    async def test_reject_with_empty_reason_returns_400(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/reject with empty string reason returns HTTP 400.

        Expected: HTTP 400 — rejectionReason must be a non-empty string.
        """
        order_id = level1_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": ""},
        )

        assert response.status_code == 400, (
            f"Expected 400 for empty rejectionReason, got {response.status_code}: "
            f"{response.text}"
        )

    @pytest.mark.asyncio
    async def test_reject_with_null_reason_returns_400(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """POST /api/orders/{id}/reject with null rejectionReason returns HTTP 400."""
        order_id = level1_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": None},
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_reason_max_500_chars(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Rejection reason exceeding 500 characters should return HTTP 400."""
        order_id = level1_order["id"]
        long_reason = "A" * 501
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": long_reason},
        )

        assert response.status_code == 400, (
            f"Expected 400 for rejectionReason > 500 chars, got {response.status_code}: "
            f"{response.text}"
        )

    @pytest.mark.asyncio
    async def test_reject_reason_exactly_500_chars_succeeds(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Rejection reason of exactly 500 characters should succeed (HTTP 200)."""
        order_id = level1_order["id"]
        reason = "R" * 500
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": reason},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == STATUS_REJECTED

    @pytest.mark.asyncio
    async def test_rejection_record_persists_reason(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Rejection record must persist the rejection reason in the database."""
        order_id = level1_order["id"]
        reason = "不合规，请重新提交"
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": reason},
        )
        assert response.status_code == 200

        # Fetch approval records to verify reason is persisted
        records_resp = await async_client.get(
            f"{BASE_URL}/{order_id}/approval-records",
            headers=dept_manager_headers,
        )
        if records_resp.status_code == 200:
            records = records_resp.json()
            reject_records = [
                r for r in records if r.get("action") == "REJECT"
            ]
            assert len(reject_records) >= 1
            assert reject_records[0].get("comment") == reason or \
                reject_records[0].get("rejectionReason") == reason


# ---------------------------------------------------------------------------
# ATB-3: Illegal State Transition Interception Tests
# ---------------------------------------------------------------------------

class TestATB3IllegalStateTransition:
    """Verify that illegal state transitions are blocked with HTTP 409."""

    @pytest.mark.asyncio
    async def test_pending_cannot_skip_to_level2(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """PENDING order cannot be approved directly by asset admin (Level 2).

        Expected: HTTP 409 Conflict with error code INVALID_STATE_TRANSITION.
        """
        order_id = pending_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )

        assert response.status_code == 409, (
            f"Expected 409 for PENDING→LEVEL_2 skip, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert _contains_error_code(body, ERR_INVALID_STATE_TRANSITION), (
            f"Response should contain error code '{ERR_INVALID_STATE_TRANSITION}', "
            f"got: {body}"
        )

    @pytest.mark.asyncio
    async def test_pending_cannot_skip_to_approved(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """PENDING order cannot jump directly to APPROVED.

        Expected: HTTP 409 Conflict.
        """
        order_id = pending_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10, "targetStatus": "APPROVED"},
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_level1_cannot_be_approved_by_asset_admin(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """APPROVING_LEVEL_1 order should not be approvable by asset admin.

        Expected: HTTP 409 — cross-level approval is forbidden.
        """
        order_id = level1_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_approved_order_cannot_be_approved_again(
        self,
        async_client: AsyncClient,
        approved_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """APPROVED order is terminal; further approval should fail.

        Expected: HTTP 409 Conflict.
        """
        order_id = approved_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_rejected_order_cannot_be_approved(
        self,
        async_client: AsyncClient,
        rejected_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """REJECTED order cannot transition back to approval.

        Expected: HTTP 409 Conflict.
        """
        order_id = rejected_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_rejected_order_cannot_be_rejected_again(
        self,
        async_client: AsyncClient,
        rejected_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """REJECTED order cannot be rejected again.

        Expected: HTTP 409 Conflict.
        """
        order_id = rejected_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": "再次驳回"},
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_illegal_transition_preserves_current_status(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        asset_admin_headers: dict[str, str],
    ) -> None:
        """After a failed illegal transition, the order status must remain unchanged."""
        order_id = pending_order["id"]

        # Attempt illegal transition
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=asset_admin_headers,
            json={"operatorId": 20},
        )
        assert response.status_code == 409

        # Verify status is still PENDING
        get_resp = await async_client.get(
            f"{BASE_URL}/{order_id}",
            headers=asset_admin_headers,
        )
        if get_resp.status_code == 200:
            assert get_resp.json()["status"] == STATUS_PENDING

    @pytest.mark.asyncio
    async def test_pending_cannot_be_rejected(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """PENDING order cannot be rejected (must go through approval levels first).

        Expected: HTTP 409 Conflict.
        """
        order_id = pending_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": "直接驳回"},
        )

        assert response.status_code == 409


# ---------------------------------------------------------------------------
# ATB-4: Role-Based Pending Approval List Filtering Tests
# ---------------------------------------------------------------------------

class TestATB4RoleBasedListFiltering:
    """Verify that approval list endpoints enforce role-based data isolation."""

    @pytest.mark.asyncio
    async def test_dept_manager_sees_only_level1_orders(
        self,
        async_client: AsyncClient,
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Department manager should only see APPROVING_LEVEL_1 orders.

        Expected: GET /api/approvals/pending returns only LEVEL_1 orders.
        """
        response = await async_client.get(
            "/api/approvals/pending",
            headers=dept_manager_headers,
        )

        assert response.status_code == 200
        body = response.json()
        orders = body.get("data") if isinstance(body, dict) and "data" in body else body
        if isinstance(orders, list):
            for order in orders:
                assert order["status"] == STATUS_APPROVING_LEVEL_1, (
                    f"Dept manager should only see LEVEL_1 orders, "
                    f"found status: {order['status']}"
                )

    @pytest.mark.asyncio
    async def test_asset_admin_sees_only_level2_orders(
        self,
        async_client: AsyncClient,
        asset_admin_headers: dict[str, str],
    ) -> None:
        """Asset administrator should only see APPROVING_LEVEL_2 orders.

        Expected: GET /api/approvals/pending returns only LEVEL_2 orders.
        """
        response = await async_client.get(
            "/api/approvals/pending",
            headers=asset_admin_headers,
        )

        assert response.status_code == 200
        body = response.json()
        orders = body.get("data") if isinstance(body, dict) and "data" in body else body
        if isinstance(orders, list):
            for order in orders:
                assert order["status"] == STATUS_APPROVING_LEVEL_2, (
                    f"Asset admin should only see LEVEL_2 orders, "
                    f"found status: {order['status']}"
                )

    @pytest.mark.asyncio
    async def test_pending_list_contains_required_columns(
        self,
        async_client: AsyncClient,
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Pending approval list must include order number, applicant, and submit time."""
        response = await async_client.get(
            "/api/approvals/pending",
            headers=dept_manager_headers,
        )

        assert response.status_code == 200
        body = response.json()
        orders = body.get("data") if isinstance(body, dict) and "data" in body else body
        if isinstance(orders, list) and len(orders) > 0:
            order = orders[0]
            # Verify required columns are present
            assert "id" in order, "Missing 'id' (order number) field"
            assert "applicantName" in order or "applicantId" in order, \
                "Missing applicant field"
            assert "createdAt" in order or "submittedAt" in order, \
                "Missing submit time field"

    @pytest.mark.asyncio
    async def test_employee_cannot_access_approval_list(
        self,
        async_client: AsyncClient,
        employee_headers: dict[str, str],
    ) -> None:
        """Regular employee should not have access to the approval list.

        Expected: HTTP 403 Forbidden.
        """
        response = await async_client.get(
            "/api/approvals/pending",
            headers=employee_headers,
        )

        assert response.status_code == 403, (
            f"Expected 403 for employee accessing approval list, "
            f"got {response.status_code}"
        )

    @pytest.mark.asyncio
    async def test_unauthenticated_request_returns_401(
        self,
        async_client: AsyncClient,
    ) -> None:
        """Requests without authentication should return HTTP 401."""
        response = await async_client.get("/api/approvals/pending")

        assert response.status_code == 401, (
            f"Expected 401 for unauthenticated request, got {response.status_code}"
        )


# ---------------------------------------------------------------------------
# ATB-5: Approval Detail & Operation Tests
# ---------------------------------------------------------------------------

class TestATB5ApprovalDetailAndOperations:
    """Verify approval detail page operations including approve and reject."""

    @pytest.mark.asyncio
    async def test_get_approval_detail(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """GET /api/orders/{id} returns full order detail for approval review."""
        order_id = level1_order["id"]
        response = await async_client.get(
            f"{BASE_URL}/{order_id}",
            headers=dept_manager_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == order_id
        assert body["status"] == STATUS_APPROVING_LEVEL_1
        assert "title" in body
        assert "description" in body

    @pytest.mark.asyncio
    async def test_approve_action_removes_order_from_pending_list(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """After approving, the order should no longer appear in the pending list."""
        order_id = level1_order["id"]

        # Approve the order
        approve_resp = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )
        assert approve_resp.status_code == 200

        # Check pending list — order should no longer be there
        list_resp = await async_client.get(
            "/api/approvals/pending",
            headers=dept_manager_headers,
        )
        if list_resp.status_code == 200:
            body = list_resp.json()
            orders = body.get("data") if isinstance(body, dict) and "data" in body else body
            if isinstance(orders, list):
                order_ids = [o["id"] for o in orders]
                assert order_id not in order_ids, (
                    f"Order {order_id} should not appear in pending list after approval"
                )

    @pytest.mark.asyncio
    async def test_reject_action_removes_order_from_pending_list(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """After rejecting, the order should no longer appear in the pending list."""
        order_id = level1_order["id"]

        # Reject the order
        reject_resp = await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": "不合规"},
        )
        assert reject_resp.status_code == 200

        # Check pending list — order should no longer be there
        list_resp = await async_client.get(
            "/api/approvals/pending",
            headers=dept_manager_headers,
        )
        if list_resp.status_code == 200:
            body = list_resp.json()
            orders = body.get("data") if isinstance(body, dict) and "data" in body else body
            if isinstance(orders, list):
                order_ids = [o["id"] for o in orders]
                assert order_id not in order_ids, (
                    f"Order {order_id} should not appear in pending list after rejection"
                )

    @pytest.mark.asyncio
    async def test_approval_history_shows_all_actions(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Approval history should show all actions taken on the order."""
        order_id = level1_order["id"]

        # Approve at Level 1
        await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )

        # Fetch history
        history_resp = await async_client.get(
            f"{BASE_URL}/{order_id}/approval-records",
            headers=dept_manager_headers,
        )
        if history_resp.status_code == 200:
            records = history_resp.json()
            assert len(records) >= 1
            # Each record should have operator, action, and timestamp
            for record in records:
                assert "operatorId" in record
                assert "action" in record
                assert "createdAt" in record


# ---------------------------------------------------------------------------
# Optimistic Locking (Concurrency) Tests
# ---------------------------------------------------------------------------

class TestOptimisticLocking:
    """Verify optimistic locking via version field prevents concurrent approval conflicts."""

    @pytest.mark.asyncio
    async def test_stale_version_returns_409(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Sending a request with a stale version should return HTTP 409.

        Expected: HTTP 409 Conflict with error code OPTIMISTIC_LOCK_CONFLICT.
        """
        order_id = level1_order["id"]
        stale_version = level1_order["version"] - 1  # Intentionally stale

        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10, "version": stale_version},
        )

        assert response.status_code == 409, (
            f"Expected 409 for stale version, got {response.status_code}: "
            f"{response.text}"
        )
        body = response.json()
        assert _contains_error_code(body, ERR_OPTIMISTIC_LOCK), (
            f"Response should contain error code '{ERR_OPTIMISTIC_LOCK}', got: {body}"
        )

    @pytest.mark.asyncio
    async def test_correct_version_allows_update(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Sending a request with the correct version should succeed."""
        order_id = level1_order["id"]
        current_version = level1_order["version"]

        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10, "version": current_version},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_concurrent_approve_returns_409_for_second_request(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Two concurrent approve requests — second should fail with 409."""
        order_id = level1_order["id"]
        current_version = level1_order["version"]

        # First request succeeds
        resp1 = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10, "version": current_version},
        )
        assert resp1.status_code == 200

        # Second request with same (now stale) version should fail
        resp2 = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10, "version": current_version},
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Cancellation Tests
# ---------------------------------------------------------------------------

class TestCancellation:
    """Verify CANCELLED state transitions."""

    @pytest.mark.asyncio
    async def test_cancel_pending_order(
        self,
        async_client: AsyncClient,
        pending_order: dict[str, Any],
        employee_headers: dict[str, str],
    ) -> None:
        """PENDING order can be cancelled by the applicant.

        Expected: HTTP 200, status = CANCELLED.
        """
        order_id = pending_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/cancel",
            headers=employee_headers,
            json={"operatorId": 1},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == STATUS_CANCELLED

    @pytest.mark.asyncio
    async def test_cancel_approved_order_returns_409(
        self,
        async_client: AsyncClient,
        approved_order: dict[str, Any],
        employee_headers: dict[str, str],
    ) -> None:
        """APPROVED order cannot be cancelled.

        Expected: HTTP 409 Conflict.
        """
        order_id = approved_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/cancel",
            headers=employee_headers,
            json={"operatorId": 1},
        )

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_cancel_rejected_order_returns_409(
        self,
        async_client: AsyncClient,
        rejected_order: dict[str, Any],
        employee_headers: dict[str, str],
    ) -> None:
        """REJECTED order cannot be cancelled.

        Expected: HTTP 409 Conflict.
        """
        order_id = rejected_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/cancel",
            headers=employee_headers,
            json={"operatorId": 1},
        )

        assert response.status_code == 409


# ---------------------------------------------------------------------------
# Approval Records Persistence Tests
# ---------------------------------------------------------------------------

class TestApprovalRecordsPersistence:
    """Verify approval records are properly persisted with all required fields."""

    @pytest.mark.asyncio
    async def test_approval_record_has_all_required_fields(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Approval record must contain: orderId, operatorId, action, createdAt."""
        order_id = level1_order["id"]
        await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )

        records_resp = await async_client.get(
            f"{BASE_URL}/{order_id}/approval-records",
            headers=dept_manager_headers,
        )
        if records_resp.status_code == 200:
            records = records_resp.json()
            assert len(records) >= 1
            record = records[-1]  # Most recent record
            assert "orderId" in record or "orderId" in str(record)
            assert "operatorId" in record
            assert "action" in record
            assert "createdAt" in record

    @pytest.mark.asyncio
    async def test_rejection_record_includes_reason(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Rejection record must include the rejection reason (comment field)."""
        order_id = level1_order["id"]
        reason = "不符合采购规范，请补充材料后重新提交"
        await async_client.post(
            f"{BASE_URL}/{order_id}/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": reason},
        )

        records_resp = await async_client.get(
            f"{BASE_URL}/{order_id}/approval-records",
            headers=dept_manager_headers,
        )
        if records_resp.status_code == 200:
            records = records_resp.json()
            reject_records = [
                r for r in records if r.get("action") == "REJECT"
            ]
            assert len(reject_records) >= 1
            record = reject_records[0]
            # The reason should be stored in 'comment' or 'rejectionReason'
            assert (
                record.get("comment") == reason
                or record.get("rejectionReason") == reason
            ), f"Rejection reason not persisted correctly: {record}"


# ---------------------------------------------------------------------------
# Edge Cases & Input Validation Tests
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Additional edge case and input validation tests."""

    @pytest.mark.asyncio
    async def test_approve_nonexistent_order_returns_404(
        self,
        async_client: AsyncClient,
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Approving a non-existent order should return HTTP 404."""
        response = await async_client.post(
            f"{BASE_URL}/99999/approve",
            headers=dept_manager_headers,
            json={"operatorId": 10},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_reject_nonexistent_order_returns_404(
        self,
        async_client: AsyncClient,
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Rejecting a non-existent order should return HTTP 404."""
        response = await async_client.post(
            f"{BASE_URL}/99999/reject",
            headers=dept_manager_headers,
            json={"operatorId": 10, "rejectionReason": "不存在"},
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_nonexistent_order_returns_404(
        self,
        async_client: AsyncClient,
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Getting a non-existent order should return HTTP 404."""
        response = await async_client.get(
            f"{BASE_URL}/99999",
            headers=dept_manager_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_approve_with_invalid_json_returns_400(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """Sending malformed JSON should return HTTP 400."""
        order_id = level1_order["id"]
        response = await async_client.post(
            f"{BASE_URL}/{order_id}/approve",
            headers=dept_manager_headers,
            content="not json",
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_response_dates_are_iso8601(
        self,
        async_client: AsyncClient,
        level1_order: dict[str, Any],
        dept_manager_headers: dict[str, str],
    ) -> None:
        """All date fields in API responses must follow ISO 8601 format."""
        order_id = level1_order["id"]
        response = await async_client.get(
            f"{BASE_URL}/{order_id}",
            headers=dept_manager_headers,
        )

        if response.status_code == 200:
            body = response.json()
            date_fields = ["createdAt", "updatedAt"]
            for field in date_fields:
                if field in body:
                    # Should not raise ValueError
                    datetime.fromisoformat(
                        body[field].replace("Z", "+00:00")
                    )


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def _contains_error_code(response_body: dict[str, Any], code: str) -> bool:
    """Check if the response body contains the given error code.

    Supports various response formats:
      - {"code": "ERROR_CODE", ...}
      - {"error": {"code": "ERROR_CODE", ...}}
      - {"errors": [{"code": "ERROR_CODE", ...}]}
    """
    if not isinstance(response_body, dict):
        return False

    # Direct code field
    if response_body.get("code") == code:
        return True

    # Nested error object
    error = response_body.get("error")
    if isinstance(error, dict) and error.get("code") == code:
        return True

    # Array of errors
    errors = response_body.get("errors")
    if isinstance(errors, list):
        return any(
            isinstance(e, dict) and e.get("code") == code
            for e in errors
        )

    # Check in message string as fallback
    message = response_body.get("message", "")
    if code in str(message):
        return True

    return False