"""
Integration tests for the Approval API (Phase 1: Core Approval Flow & Basic Workbench).

Covers ATB-1 through ATB-5 acceptance test benchmarks:
  - ATB-1: Forward state-machine transitions (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
  - ATB-2: Reverse rejection transitions (any approval node → REJECTED) with mandatory rejection reason
  - ATB-3: Illegal state-transition interception (HTTP 409 + INVALID_STATE_TRANSITION)
  - ATB-4: Role-based pending-approval list filtering
  - ATB-5: Approval detail & operation workflow (approve / reject with validation)

All tests use pytest + httpx (AsyncClient) against the real application
lifecycle (or a sufficiently deep test-client fixture).

Constraints exercised:
  - State machine strict validation (no skip-level approvals)
  - rejectionReason: non-empty, max 500 chars → HTTP 400 when missing
  - Optimistic locking via `version` field → HTTP 409 on conflict
  - Role-based data isolation (dept_manager sees LEVEL_1, asset_admin sees LEVEL_2)
  - RESTful JSON payloads, ISO 8601 dates
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, Dict

import pytest
import httpx
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "http://testserver/api"
ORDERS_ENDPOINT = f"{BASE_URL}/orders"
APPROVAL_LIST_ENDPOINT = f"{BASE_URL}/approvals/pending"

# Expected status enum values (must match backend OrderStatus enum)
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
ERROR_INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
ERROR_OPTIMISTIC_LOCK = "OPTIMISTIC_LOCK_CONFLICT"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_auth_header(user_id: str, role: str) -> Dict[str, str]:
    """Build a minimal Authorization header for test authentication.

    In a real setup this would encode a JWT; for integration tests we rely
    on the test-server's dependency override to recognise the header value.
    """
    payload = json.dumps({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer test-{payload}"}


def _approve_url(order_id: int | str) -> str:
    """Return the approve endpoint URL for a given order."""
    return f"{ORDERS_ENDPOINT}/{order_id}/approve"


def _reject_url(order_id: int | str) -> str:
    """Return the reject endpoint URL for a given order."""
    return f"{ORDERS_ENDPOINT}/{order_id}/reject"


def _cancel_url(order_id: int | str) -> str:
    """Return the cancel endpoint URL for a given order."""
    return f"{ORDERS_ENDPOINT}/{order_id}/cancel"


def _order_detail_url(order_id: int | str) -> str:
    """Return the order detail endpoint URL."""
    return f"{ORDERS_ENDPOINT}/{order_id}"


def _iso_now() -> str:
    """Return current UTC time in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def employee_client(async_client: AsyncClient) -> AsyncClient:
    """Return an authenticated AsyncClient for an EMPLOYEE user."""
    async_client.headers.update(_build_auth_header("user-emp-01", ROLE_EMPLOYEE))
    return async_client


@pytest.fixture
async def dept_manager_client(async_client: AsyncClient) -> AsyncClient:
    """Return an authenticated AsyncClient for a DEPT_MANAGER user."""
    async_client.headers.update(
        _build_auth_header("user-mgr-01", ROLE_DEPT_MANAGER)
    )
    return async_client


@pytest.fixture
async def asset_admin_client(async_client: AsyncClient) -> AsyncClient:
    """Return an authenticated AsyncClient for an ASSET_ADMIN user."""
    async_client.headers.update(
        _build_auth_header("user-admin-01", ROLE_ASSET_ADMIN)
    )
    return async_client


@pytest.fixture
async def pending_order(employee_client: AsyncClient) -> Dict[str, Any]:
    """Create and return a work order in PENDING status."""
    payload = {
        "title": "Integration test order",
        "description": "Order for approval flow testing",
        "applicantId": "user-emp-01",
        "submittedAt": _iso_now(),
    }
    resp = await employee_client.post(ORDERS_ENDPOINT, json=payload)
    assert resp.status_code == 201, f"Failed to create order: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# ATB-1: Forward State-Machine Transitions
# ---------------------------------------------------------------------------


class TestATB01ForwardTransitions:
    """Verify PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_full_approval_chain(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-1: Sequential approvals through both levels succeed.

        Steps:
          1. Dept manager approves → status becomes APPROVING_LEVEL_1
          2. Asset admin approves  → status becomes APPROVING_LEVEL_2
          3. Final approval        → status becomes APPROVED

        Each step returns HTTP 200 and creates an approval record.
        """
        order_id = pending_order["id"]
        initial_version = pending_order.get("version", 1)

        # --- Step 1: Dept manager approves (PENDING → APPROVING_LEVEL_1) ---
        resp1 = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": initial_version},
        )
        assert resp1.status_code == 200, (
            f"Level-1 approve failed: {resp1.text}"
        )
        body1 = resp1.json()
        assert body1["status"] == STATUS_APPROVING_LEVEL_1
        assert body1["version"] == initial_version + 1

        # Verify approval record was created
        records1 = body1.get("approvalRecords", [])
        assert len(records1) >= 1
        latest = records1[-1]
        assert latest["action"] == "APPROVE"
        assert latest["operatorId"] == "user-mgr-01"
        assert "operatedAt" in latest

        version_after_l1 = body1["version"]

        # --- Step 2: Asset admin approves (APPROVING_LEVEL_1 → APPROVING_LEVEL_2) ---
        resp2 = await asset_admin_client.post(
            _approve_url(order_id),
            json={"version": version_after_l1},
        )
        assert resp2.status_code == 200, (
            f"Level-2 approve failed: {resp2.text}"
        )
        body2 = resp2.json()
        assert body2["status"] == STATUS_APPROVING_LEVEL_2
        assert body2["version"] == version_after_l1 + 1

        version_after_l2 = body2["version"]

        # --- Step 3: Final approval (APPROVING_LEVEL_2 → APPROVED) ---
        resp3 = await asset_admin_client.post(
            _approve_url(order_id),
            json={"version": version_after_l2},
        )
        assert resp3.status_code == 200, (
            f"Final approve failed: {resp3.text}"
        )
        body3 = resp3.json()
        assert body3["status"] == STATUS_APPROVED

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approval_creates_persistent_record(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-1 (supplementary): Approval record is persisted and queryable."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert resp.status_code == 200

        # Fetch order detail to verify records
        detail_resp = await dept_manager_client.get(_order_detail_url(order_id))
        assert detail_resp.status_code == 200
        detail = detail_resp.json()

        records = detail.get("approvalRecords", [])
        assert any(
            r["operatorId"] == "user-mgr-01" and r["action"] == "APPROVE"
            for r in records
        ), "Approval record not found in order detail"


# ---------------------------------------------------------------------------
# ATB-2: Reverse Rejection Transitions
# ---------------------------------------------------------------------------


class TestATB02RejectionTransitions:
    """Verify rejection from any approval node with mandatory rejectionReason."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_at_level_1_with_reason(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-2: Reject at APPROVING_LEVEL_1 with valid reason → 200, status REJECTED."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # First, move to APPROVING_LEVEL_1
        approve_resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert approve_resp.status_code == 200
        new_version = approve_resp.json()["version"]

        # Reject with reason
        reject_payload = {
            "version": new_version,
            "rejectionReason": "Budget allocation not approved by finance department",
        }
        reject_resp = await dept_manager_client.post(
            _reject_url(order_id),
            json=reject_payload,
        )
        assert reject_resp.status_code == 200, (
            f"Reject failed: {reject_resp.text}"
        )
        body = reject_resp.json()
        assert body["status"] == STATUS_REJECTED

        # Verify rejection record
        records = body.get("approvalRecords", [])
        reject_records = [
            r for r in records if r["action"] == "REJECT"
        ]
        assert len(reject_records) >= 1
        assert reject_records[-1]["comment"] == reject_payload["rejectionReason"]

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_at_level_2_with_reason(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-2: Reject at APPROVING_LEVEL_2 with valid reason → 200, status REJECTED."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move through level 1
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200
        v2 = r1.json()["version"]

        # Move through level 2
        r2 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": v2}
        )
        assert r2.status_code == 200
        v3 = r2.json()["version"]

        # Reject at level 2
        reject_resp = await asset_admin_client.post(
            _reject_url(order_id),
            json={
                "version": v3,
                "rejectionReason": "Asset specification does not meet requirements",
            },
        )
        assert reject_resp.status_code == 200
        assert reject_resp.json()["status"] == STATUS_REJECTED

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_without_reason_returns_400(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-2: Reject without rejectionReason → HTTP 400 Bad Request."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move to APPROVING_LEVEL_1
        approve_resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert approve_resp.status_code == 200
        new_version = approve_resp.json()["version"]

        # Reject WITHOUT reason
        reject_resp = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": new_version},
        )
        assert reject_resp.status_code == 400, (
            f"Expected 400 for missing rejectionReason, got {reject_resp.status_code}: {reject_resp.text}"
        )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_with_empty_reason_returns_400(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-2: Reject with empty string rejectionReason → HTTP 400."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        approve_resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert approve_resp.status_code == 200
        new_version = approve_resp.json()["version"]

        reject_resp = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": new_version, "rejectionReason": ""},
        )
        assert reject_resp.status_code == 400

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_reason_max_500_chars(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-2: rejectionReason exceeding 500 characters → HTTP 400."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        approve_resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert approve_resp.status_code == 200
        new_version = approve_resp.json()["version"]

        long_reason = "A" * 501
        reject_resp = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": new_version, "rejectionReason": long_reason},
        )
        assert reject_resp.status_code == 400, (
            f"Expected 400 for rejectionReason > 500 chars, got {reject_resp.status_code}"
        )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_reason_exactly_500_chars_succeeds(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-2: rejectionReason of exactly 500 characters → HTTP 200."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        approve_resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert approve_resp.status_code == 200
        new_version = approve_resp.json()["version"]

        reason_500 = "B" * 500
        reject_resp = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": new_version, "rejectionReason": reason_500},
        )
        assert reject_resp.status_code == 200


# ---------------------------------------------------------------------------
# ATB-3: Illegal State-Transition Interception
# ---------------------------------------------------------------------------


class TestATB03IllegalTransitions:
    """Verify that illegal transitions return HTTP 409 + INVALID_STATE_TRANSITION."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_skip_level_approval_rejected(
        self,
        pending_order: Dict[str, Any],
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-3: Asset admin tries to approve a PENDING order directly → 409.

        PENDING must go through APPROVING_LEVEL_1 first; skipping to
        APPROVING_LEVEL_2 is forbidden.
        """
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        resp = await asset_admin_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert resp.status_code == 409, (
            f"Expected 409 for skip-level approval, got {resp.status_code}: {resp.text}"
        )
        body = resp.json()
        assert body.get("errorCode") == ERROR_INVALID_STATE_TRANSITION, (
            f"Expected error code {ERROR_INVALID_STATE_TRANSITION}, "
            f"got {body.get('errorCode')}"
        )

        # Verify order status unchanged
        detail_resp = await asset_admin_client.get(_order_detail_url(order_id))
        assert detail_resp.status_code == 200
        assert detail_resp.json()["status"] == STATUS_PENDING

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approve_already_rejected_order(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-3: Approving an already REJECTED order → 409."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move to level 1 then reject
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200
        v2 = r1.json()["version"]

        r2 = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": v2, "rejectionReason": "Not valid"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == STATUS_REJECTED

        # Try to approve the rejected order
        r3 = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": r2.json()["version"]},
        )
        assert r3.status_code == 409
        assert r3.json().get("errorCode") == ERROR_INVALID_STATE_TRANSITION

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approve_already_approved_order(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-3: Approving an already APPROVED order → 409."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Full approval chain
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200
        r2 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": r1.json()["version"]}
        )
        assert r2.status_code == 200
        r3 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": r2.json()["version"]}
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == STATUS_APPROVED

        # Try to approve again
        r4 = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": r3.json()["version"]},
        )
        assert r4.status_code == 409

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_pending_order_directly(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-3: Rejecting a PENDING order (before any approval) → 409.

        Rejection is only valid from APPROVING_LEVEL_1 or APPROVING_LEVEL_2.
        """
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        resp = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": version, "rejectionReason": "No budget"},
        )
        # PENDING → REJECTED is not a valid transition per the state machine
        assert resp.status_code == 409, (
            f"Expected 409 for rejecting PENDING order, got {resp.status_code}: {resp.text}"
        )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_employee_cannot_approve(
        self,
        pending_order: Dict[str, Any],
        employee_client: AsyncClient,
    ) -> None:
        """ATB-3: Regular employee attempts to approve → 403 or 409."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        resp = await employee_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert resp.status_code in (403, 409), (
            f"Expected 403/409 for unauthorized approval, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# ATB-4: Role-Based Pending Approval List Filtering
# ---------------------------------------------------------------------------


class TestATB04RoleBasedListFiltering:
    """Verify that the approval list endpoint filters by user role."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_dept_manager_sees_only_level_1_orders(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-4: Dept manager's pending list only contains APPROVING_LEVEL_1 orders."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move order to APPROVING_LEVEL_1
        resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert resp.status_code == 200

        # Fetch pending list as dept manager
        list_resp = await dept_manager_client.get(APPROVAL_LIST_ENDPOINT)
        assert list_resp.status_code == 200
        orders = list_resp.json().get("items", list_resp.json())

        # All returned orders should be in APPROVING_LEVEL_1
        for order in orders:
            assert order["status"] == STATUS_APPROVING_LEVEL_1, (
                f"Dept manager should only see LEVEL_1 orders, "
                f"found {order['status']} for order {order.get('id')}"
            )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_asset_admin_sees_only_level_2_orders(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-4: Asset admin's pending list only contains APPROVING_LEVEL_2 orders."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move through level 1
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200

        # Move through level 2
        r2 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": r1.json()["version"]}
        )
        assert r2.status_code == 200

        # Fetch pending list as asset admin
        list_resp = await asset_admin_client.get(APPROVAL_LIST_ENDPOINT)
        assert list_resp.status_code == 200
        orders = list_resp.json().get("items", list_resp.json())

        for order in orders:
            assert order["status"] == STATUS_APPROVING_LEVEL_2, (
                f"Asset admin should only see LEVEL_2 orders, "
                f"found {order['status']} for order {order.get('id')}"
            )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_pending_list_contains_required_columns(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-4: Pending list items include order number, applicant, and submit time."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move to level 1
        resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert resp.status_code == 200

        list_resp = await dept_manager_client.get(APPROVAL_LIST_ENDPOINT)
        assert list_resp.status_code == 200
        orders = list_resp.json().get("items", list_resp.json())
        assert len(orders) >= 1

        first_order = orders[0]
        # Verify required columns exist
        assert "id" in first_order or "orderNo" in first_order, (
            "Missing order number field"
        )
        assert "applicantId" in first_order or "applicantName" in first_order, (
            "Missing applicant field"
        )
        assert "submittedAt" in first_order or "createdAt" in first_order, (
            "Missing submit time field"
        )

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_employee_cannot_access_approval_list(
        self,
        employee_client: AsyncClient,
    ) -> None:
        """ATB-4: Regular employee gets 403 when accessing approval list."""
        resp = await employee_client.get(APPROVAL_LIST_ENDPOINT)
        assert resp.status_code == 403, (
            f"Expected 403 for employee accessing approval list, "
            f"got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# ATB-5: Approval Detail & Operation Workflow
# ---------------------------------------------------------------------------


class TestATB05ApprovalDetailAndOperations:
    """Verify approval detail page data and operation workflow."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approve_removes_order_from_pending_list(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-5: After dept manager approves, order disappears from LEVEL_1 list."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move to APPROVING_LEVEL_1
        approve_resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert approve_resp.status_code == 200

        # Verify order is in the list
        list_before = await dept_manager_client.get(APPROVAL_LIST_ENDPOINT)
        assert list_before.status_code == 200
        items_before = list_before.json().get("items", list_before.json())
        order_ids_before = {o["id"] for o in items_before}
        assert order_id in order_ids_before

        # Approve (LEVEL_1 → LEVEL_2)
        approve_resp2 = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": approve_resp.json()["version"]},
        )
        assert approve_resp2.status_code == 200

        # Verify order is no longer in LEVEL_1 list
        list_after = await dept_manager_client.get(APPROVAL_LIST_ENDPOINT)
        assert list_after.status_code == 200
        items_after = list_after.json().get("items", list_after.json())
        order_ids_after = {o["id"] for o in items_after}
        assert order_id not in order_ids_after

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_removes_order_from_pending_list(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-5: After rejection, order disappears from pending list."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move to APPROVING_LEVEL_1
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200

        # Reject
        r2 = await dept_manager_client.post(
            _reject_url(order_id),
            json={
                "version": r1.json()["version"],
                "rejectionReason": "Does not meet policy requirements",
            },
        )
        assert r2.status_code == 200

        # Verify order is no longer in the list
        list_resp = await dept_manager_client.get(APPROVAL_LIST_ENDPOINT)
        assert list_resp.status_code == 200
        items = list_resp.json().get("items", list_resp.json())
        order_ids = {o["id"] for o in items}
        assert order_id not in order_ids

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_order_detail_shows_approval_history(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
    ) -> None:
        """ATB-5: Order detail includes full approval history with timestamps."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Level 1 approve
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200

        # Level 2 approve
        r2 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": r1.json()["version"]}
        )
        assert r2.status_code == 200

        # Fetch detail
        detail_resp = await dept_manager_client.get(_order_detail_url(order_id))
        assert detail_resp.status_code == 200
        detail = detail_resp.json()

        records = detail.get("approvalRecords", [])
        assert len(records) >= 2

        # Verify chronological order and required fields
        for record in records:
            assert "operatorId" in record
            assert "action" in record
            assert "operatedAt" in record
            # Verify ISO 8601 date format
            datetime.fromisoformat(record["operatedAt"].replace("Z", "+00:00"))

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_rejection_reason_recorded_in_history(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """ATB-5: Rejection reason is persisted in the approval record."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)
        reason = "Asset valuation exceeds department budget limit for Q4 2024"

        # Move to level 1
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200

        # Reject with reason
        r2 = await dept_manager_client.post(
            _reject_url(order_id),
            json={"version": r1.json()["version"], "rejectionReason": reason},
        )
        assert r2.status_code == 200

        # Verify reason in detail
        detail_resp = await dept_manager_client.get(_order_detail_url(order_id))
        assert detail_resp.status_code == 200
        records = detail_resp.json().get("approvalRecords", [])
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) >= 1
        assert reject_records[-1]["comment"] == reason


# ---------------------------------------------------------------------------
# Optimistic Locking (Concurrency Constraint)
# ---------------------------------------------------------------------------


class TestOptimisticLocking:
    """Verify optimistic locking via version field prevents concurrent approval conflicts."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_stale_version_returns_409(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """Concurrent approval with stale version → HTTP 409."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # First approval succeeds
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200

        # Second approval with same (stale) version should fail
        r2 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r2.status_code == 409, (
            f"Expected 409 for stale version, got {r2.status_code}: {r2.text}"
        )
        body = r2.json()
        assert body.get("errorCode") == ERROR_OPTIMISTIC_LOCK

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_correct_version_succeeds_after_update(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """Using the latest version after a prior update succeeds."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200
        latest_version = r1.json()["version"]

        # Use the latest version for the next operation
        r2 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": latest_version}
        )
        assert r2.status_code == 200


# ---------------------------------------------------------------------------
# Cancel Flow
# ---------------------------------------------------------------------------


class TestCancelFlow:
    """Verify CANCELLED state transition support."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cancel_pending_order(
        self,
        pending_order: Dict[str, Any],
        employee_client: AsyncClient,
    ) -> None:
        """Cancelling a PENDING order → status CANCELLED."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        resp = await employee_client.post(
            _cancel_url(order_id),
            json={"version": version},
        )
        assert resp.status_code == 200, f"Cancel failed: {resp.text}"
        assert resp.json()["status"] == STATUS_CANCELLED

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_cancel_already_approved_order_fails(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
        asset_admin_client: AsyncClient,
        employee_client: AsyncClient,
    ) -> None:
        """Cancelling an APPROVED order → 409 (terminal state)."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Full approval chain
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        r2 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": r1.json()["version"]}
        )
        r3 = await asset_admin_client.post(
            _approve_url(order_id), json={"version": r2.json()["version"]}
        )
        assert r3.json()["status"] == STATUS_APPROVED

        # Try to cancel
        cancel_resp = await employee_client.post(
            _cancel_url(order_id),
            json={"version": r3.json()["version"]},
        )
        assert cancel_resp.status_code == 409


# ---------------------------------------------------------------------------
# Edge Cases & Boundary Conditions
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Additional edge-case tests for robustness."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_nonexistent_order_returns_404(
        self,
        dept_manager_client: AsyncClient,
    ) -> None:
        """Approving a non-existent order → 404."""
        resp = await dept_manager_client.post(
            _approve_url(999999),
            json={"version": 1},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_reject_nonexistent_order_returns_404(
        self,
        dept_manager_client: AsyncClient,
    ) -> None:
        """Rejecting a non-existent order → 404."""
        resp = await dept_manager_client.post(
            _reject_url(999999),
            json={"version": 1, "rejectionReason": "Test"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_approval_record_includes_iso8601_timestamp(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """Verify approval record timestamps follow ISO 8601 format."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={"version": version},
        )
        assert resp.status_code == 200

        detail_resp = await dept_manager_client.get(_order_detail_url(order_id))
        records = detail_resp.json().get("approvalRecords", [])
        assert len(records) >= 1

        timestamp_str = records[-1]["operatedAt"]
        # Should be parseable as ISO 8601
        parsed = datetime.fromisoformat(
            timestamp_str.replace("Z", "+00:00")
        )
        assert parsed.tzinfo is not None, "Timestamp should include timezone"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_missing_version_field_returns_400(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """Request without version field → HTTP 400 (optimistic lock required)."""
        order_id = pending_order["id"]

        resp = await dept_manager_client.post(
            _approve_url(order_id),
            json={},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_double_reject_returns_409(
        self,
        pending_order: Dict[str, Any],
        dept_manager_client: AsyncClient,
    ) -> None:
        """Rejecting an already REJECTED order → 409."""
        order_id = pending_order["id"]
        version = pending_order.get("version", 1)

        # Move to level 1
        r1 = await dept_manager_client.post(
            _approve_url(order_id), json={"version": version}
        )
        assert r1.status_code == 200

        # First reject
        r2 = await dept_manager_client.post(
            _reject_url(order_id),
            json={
                "version": r1.json()["version"],
                "rejectionReason": "First rejection",
            },
        )
        assert r2.status_code == 200

        # Second reject should fail
        r3 = await dept_manager_client.post(
            _reject_url(order_id),
            json={
                "version": r2.json()["version"],
                "rejectionReason": "Second rejection",
            },
        )
        assert r3.status_code == 409