"""
E2E tests for work order multi-level approval workflow.

Covers ATB-1 through ATB-3 (backend state machine) and provides
API-level integration coverage for the approval chain:

  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
  Any approval node → REJECTED  (requires rejectionReason)
  Any node → CANCELLED

Boundary constraints enforced:
  - No skip-level transitions (e.g. PENDING → APPROVING_LEVEL_2)
  - rejectionReason mandatory on reject, max 500 chars
  - Optimistic locking via version field
  - Role-based data isolation on approval list endpoint
"""

from __future__ import annotations

import pytest
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "http://localhost:8080/api"
DEPT_MANAGER_TOKEN = "dept_manager_token_placeholder"
ASSET_ADMIN_TOKEN = "asset_admin_token_placeholder"
APPLICANT_TOKEN = "applicant_token_placeholder"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _headers(token: str) -> dict[str, str]:
    """Return common request headers with the given bearer token."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _create_work_order(token: str = APPLICANT_TOKEN) -> dict:
    """Create a minimal work order in PENDING state and return the API response."""
    payload = {
        "title": "E2E-测试工单",
        "description": "由 e2e 测试自动创建",
        "applicantId": "user-001",
    }
    resp = requests.post(f"{BASE_URL}/orders", json=payload, headers=_headers(token))
    assert resp.status_code == 201, f"Failed to create work order: {resp.text}"
    return resp.json()


def _get_work_order(order_id: str, token: str = APPLICANT_TOKEN) -> dict:
    """Retrieve a work order by id."""
    resp = requests.get(f"{BASE_URL}/orders/{order_id}", headers=_headers(token))
    assert resp.status_code == 200, f"Failed to get work order: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# ATB-1: Backend state machine forward flow
# ---------------------------------------------------------------------------


class TestForwardApprovalFlow:
    """ATB-1: Verify PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED."""

    def test_full_forward_flow(self) -> None:
        """Submit → Level-1 approve → Level-2 approve → APPROVED.

        Each step must return HTTP 200 and the status must advance
        sequentially.  An approval_record must be created for each step.
        """
        order = _create_work_order()
        order_id = order["id"]
        version = order["version"]

        # --- Level-1 approval (department manager) ---
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Level-1 approve failed: {resp.status_code} {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "APPROVING_LEVEL_1"
        assert body["version"] == version + 1

        # Verify approval record persisted
        records = _fetch_approval_records(order_id)
        level1_records = [r for r in records if r["action"] == "APPROVE" and r["level"] == 1]
        assert len(level1_records) >= 1, "Expected at least one Level-1 approval record"

        # --- Level-2 approval (asset administrator) ---
        version = body["version"]
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Level-2 approve failed: {resp.status_code} {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "APPROVING_LEVEL_2"
        assert body["version"] == version + 1

        # Verify approval record persisted
        records = _fetch_approval_records(order_id)
        level2_records = [r for r in records if r["action"] == "APPROVE" and r["level"] == 2]
        assert len(level2_records) >= 1, "Expected at least one Level-2 approval record"

        # --- Final approval (asset administrator confirms) ---
        version = body["version"]
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Final approve failed: {resp.status_code} {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "APPROVED"

    def test_approval_records_contain_operator_and_timestamp(self) -> None:
        """Each approval_record must include operatorId, action, and timestamp."""
        order = _create_work_order()
        order_id = order["id"]

        # Level-1 approve
        requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )

        records = _fetch_approval_records(order_id)
        assert len(records) >= 1
        rec = records[0]
        assert "operatorId" in rec, "approval_record missing operatorId"
        assert "action" in rec, "approval_record missing action"
        assert "timestamp" in rec, "approval_record missing timestamp"
        # Timestamp should be ISO 8601
        assert "T" in rec["timestamp"], "timestamp not in ISO 8601 format"


# ---------------------------------------------------------------------------
# ATB-2: Backend state machine rejection flow
# ---------------------------------------------------------------------------


class TestRejectionFlow:
    """ATB-2: Verify rejection at any approval node with mandatory reason."""

    def test_reject_at_level1_with_reason(self) -> None:
        """Reject at APPROVING_LEVEL_1 with a valid reason → REJECTED, HTTP 200."""
        order = _create_work_order()
        order_id = order["id"]

        # First, approve to move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        version = resp.json()["version"]

        # Reject at Level-1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version, "rejectionReason": "不合规"},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Reject at Level-1 failed: {resp.status_code} {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "REJECTED"

        # Verify rejection record persisted
        records = _fetch_approval_records(order_id)
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) >= 1, "Expected at least one REJECT approval record"
        assert reject_records[0].get("comment") == "不合规"

    def test_reject_at_level2_with_reason(self) -> None:
        """Reject at APPROVING_LEVEL_2 with a valid reason → REJECTED, HTTP 200."""
        order = _create_work_order()
        order_id = order["id"]

        # Level-1 approve
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        version = resp.json()["version"]

        # Level-2 approve (move to APPROVING_LEVEL_2)
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 200
        version = resp.json()["version"]

        # Reject at Level-2
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version, "rejectionReason": "资产信息不完整"},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Reject at Level-2 failed: {resp.status_code} {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "REJECTED"

    def test_reject_without_reason_returns_400(self) -> None:
        """Reject without rejectionReason → HTTP 400 Bad Request."""
        order = _create_work_order()
        order_id = order["id"]

        # Move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        version = resp.json()["version"]

        # Reject without reason
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 400, (
            f"Expected 400 for missing rejectionReason, got {resp.status_code}"
        )

    def test_reject_with_empty_reason_returns_400(self) -> None:
        """Reject with empty string rejectionReason → HTTP 400 Bad Request."""
        order = _create_work_order()
        order_id = order["id"]

        # Move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        version = resp.json()["version"]

        # Reject with empty reason
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version, "rejectionReason": ""},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 400, (
            f"Expected 400 for empty rejectionReason, got {resp.status_code}"
        )

    def test_reject_with_oversized_reason_returns_400(self) -> None:
        """Reject with rejectionReason exceeding 500 chars → HTTP 400."""
        order = _create_work_order()
        order_id = order["id"]

        # Move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        version = resp.json()["version"]

        # Reject with reason > 500 chars
        long_reason = "x" * 501
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version, "rejectionReason": long_reason},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 400, (
            f"Expected 400 for oversized rejectionReason, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# ATB-3: Backend illegal state transition interception
# ---------------------------------------------------------------------------


class TestIllegalStateTransition:
    """ATB-3: Verify that illegal state transitions return HTTP 409 Conflict."""

    def test_skip_level_transition_returns_409(self) -> None:
        """PENDING → APPROVING_LEVEL_2 (skip level) → HTTP 409, INVALID_STATE_TRANSITION."""
        order = _create_work_order()
        order_id = order["id"]

        # Attempt Level-2 approve directly from PENDING (as asset admin)
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"], "targetLevel": 2},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for skip-level transition, got {resp.status_code}"
        )
        body = resp.json()
        assert body.get("errorCode") == "INVALID_STATE_TRANSITION", (
            f"Expected errorCode INVALID_STATE_TRANSITION, got {body.get('errorCode')}"
        )

        # Verify status unchanged
        current = _get_work_order(order_id)
        assert current["status"] == "PENDING", "Status should remain PENDING after illegal transition"

    def test_approve_already_approved_returns_409(self) -> None:
        """Approving an already APPROVED order → HTTP 409."""
        order = _create_work_order()
        order_id = order["id"]

        # Complete the full approval chain
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        version = resp.json()["version"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.json()["status"] == "APPROVED"
        version = resp.json()["version"]

        # Try to approve again
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for approving APPROVED order, got {resp.status_code}"
        )

    def test_approve_rejected_order_returns_409(self) -> None:
        """Approving a REJECTED order → HTTP 409."""
        order = _create_work_order()
        order_id = order["id"]

        # Move to APPROVING_LEVEL_1 then reject
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version, "rejectionReason": "驳回测试"},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.json()["status"] == "REJECTED"
        version = resp.json()["version"]

        # Try to approve the rejected order
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for approving REJECTED order, got {resp.status_code}"
        )

    def test_reject_pending_order_returns_409(self) -> None:
        """Rejecting a PENDING order (not yet in approval) → HTTP 409."""
        order = _create_work_order()
        order_id = order["id"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": order["version"], "rejectionReason": "非法操作"},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for rejecting PENDING order, got {resp.status_code}"
        )
        body = resp.json()
        assert body.get("errorCode") == "INVALID_STATE_TRANSITION"


# ---------------------------------------------------------------------------
# Optimistic locking / concurrency
# ---------------------------------------------------------------------------


class TestOptimisticLocking:
    """Verify that concurrent approval attempts are caught by optimistic locking."""

    def test_stale_version_returns_409(self) -> None:
        """Using an outdated version on approve → HTTP 409 Conflict."""
        order = _create_work_order()
        order_id = order["id"]
        original_version = order["version"]

        # First approval succeeds, increments version
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": original_version},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200

        # Second approval with the same (stale) version → 409
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": original_version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for stale version, got {resp.status_code}"
        )

    def test_stale_version_on_reject_returns_409(self) -> None:
        """Using an outdated version on reject → HTTP 409 Conflict."""
        order = _create_work_order()
        order_id = order["id"]
        original_version = order["version"]

        # Approve to move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": original_version},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        new_version = resp.json()["version"]

        # Simulate a concurrent modification: approve again (would fail at state level,
        # but let's use a different approach — reject with stale version)
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": original_version, "rejectionReason": "旧版本驳回"},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for stale version on reject, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# Role-based data isolation
# ---------------------------------------------------------------------------


class TestRoleBasedDataIsolation:
    """Verify that the approval list endpoint enforces role-based filtering."""

    def test_dept_manager_sees_only_level1_orders(self) -> None:
        """Department manager can only see APPROVING_LEVEL_1 orders."""
        # Create a work order and advance it
        order = _create_work_order()
        order_id = order["id"]

        # Before any approval, dept manager should not see it in pending approvals
        resp = requests.get(
            f"{BASE_URL}/approvals/pending",
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        pending_orders = resp.json()
        # The newly created PENDING order should NOT appear for dept manager
        matching = [o for o in pending_orders if o["id"] == order_id]
        assert len(matching) == 0, "PENDING order should not appear in dept manager's list"

        # Approve to move to APPROVING_LEVEL_1
        requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )

        # Now dept manager should see it
        resp = requests.get(
            f"{BASE_URL}/approvals/pending",
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        assert resp.status_code == 200
        pending_orders = resp.json()
        matching = [o for o in pending_orders if o["id"] == order_id]
        assert len(matching) == 1, "APPROVING_LEVEL_1 order should appear for dept manager"
        assert matching[0]["status"] == "APPROVING_LEVEL_1"

    def test_asset_admin_sees_only_level2_orders(self) -> None:
        """Asset administrator can only see APPROVING_LEVEL_2 orders."""
        order = _create_work_order()
        order_id = order["id"]

        # Advance to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        # Asset admin should NOT see APPROVING_LEVEL_1 orders
        resp = requests.get(
            f"{BASE_URL}/approvals/pending",
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 200
        pending_orders = resp.json()
        matching = [o for o in pending_orders if o["id"] == order_id]
        assert len(matching) == 0, "APPROVING_LEVEL_1 order should not appear for asset admin"

        # Advance to APPROVING_LEVEL_2
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )

        # Now asset admin should see it
        resp = requests.get(
            f"{BASE_URL}/approvals/pending",
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        assert resp.status_code == 200
        pending_orders = resp.json()
        matching = [o for o in pending_orders if o["id"] == order_id]
        assert len(matching) == 1, "APPROVING_LEVEL_2 order should appear for asset admin"
        assert matching[0]["status"] == "APPROVING_LEVEL_2"


# ---------------------------------------------------------------------------
# CANCELLED state
# ---------------------------------------------------------------------------


class TestCancelledState:
    """Verify CANCELLED state transitions."""

    def test_cancel_pending_order(self) -> None:
        """Cancel a PENDING order → status becomes CANCELLED."""
        order = _create_work_order()
        order_id = order["id"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/cancel",
            json={"version": order["version"]},
            headers=_headers(APPLICANT_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Cancel failed: {resp.status_code} {resp.text}"
        )
        body = resp.json()
        assert body["status"] == "CANCELLED"

    def test_cancel_approving_level1_order(self) -> None:
        """Cancel an APPROVING_LEVEL_1 order → status becomes CANCELLED."""
        order = _create_work_order()
        order_id = order["id"]

        # Move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/cancel",
            json={"version": version},
            headers=_headers(APPLICANT_TOKEN),
        )
        assert resp.status_code == 200, (
            f"Cancel at Level-1 failed: {resp.status_code} {resp.text}"
        )
        assert resp.json()["status"] == "CANCELLED"

    def test_cancel_approved_order_returns_409(self) -> None:
        """Cancelling an already APPROVED order → HTTP 409."""
        order = _create_work_order()
        order_id = order["id"]

        # Complete full approval chain
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        version = resp.json()["version"]

        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        version = resp.json()["version"]
        assert resp.json()["status"] == "APPROVED"

        # Try to cancel
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/cancel",
            json={"version": version},
            headers=_headers(APPLICANT_TOKEN),
        )
        assert resp.status_code == 409, (
            f"Expected 409 for cancelling APPROVED order, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# Approval record persistence verification
# ---------------------------------------------------------------------------


class TestApprovalRecordPersistence:
    """Verify that approval records are correctly persisted with all required fields."""

    def test_approve_creates_record_with_all_fields(self) -> None:
        """An approval action must create a record with operatorId, action, timestamp, level."""
        order = _create_work_order()
        order_id = order["id"]

        # Level-1 approve
        requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )

        records = _fetch_approval_records(order_id)
        assert len(records) >= 1
        rec = records[0]
        assert rec["action"] == "APPROVE"
        assert rec["level"] == 1
        assert rec["operatorId"] is not None
        assert rec["timestamp"] is not None

    def test_reject_creates_record_with_comment(self) -> None:
        """A rejection action must create a record with the rejection reason as comment."""
        order = _create_work_order()
        order_id = order["id"]

        # Move to APPROVING_LEVEL_1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        # Reject
        reason = "材料不齐全，请补充后重新提交"
        requests.post(
            f"{BASE_URL}/orders/{order_id}/reject",
            json={"version": version, "rejectionReason": reason},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )

        records = _fetch_approval_records(order_id)
        reject_records = [r for r in records if r["action"] == "REJECT"]
        assert len(reject_records) >= 1
        assert reject_records[0]["comment"] == reason

    def test_full_flow_creates_three_approval_records(self) -> None:
        """A complete PENDING → APPROVED flow creates 3 approval records (one per level)."""
        order = _create_work_order()
        order_id = order["id"]

        # Level-1
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": order["version"]},
            headers=_headers(DEPT_MANAGER_TOKEN),
        )
        version = resp.json()["version"]

        # Level-2
        resp = requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )
        version = resp.json()["version"]

        # Final
        requests.post(
            f"{BASE_URL}/orders/{order_id}/approve",
            json={"version": version},
            headers=_headers(ASSET_ADMIN_TOKEN),
        )

        records = _fetch_approval_records(order_id)
        approve_records = [r for r in records if r["action"] == "APPROVE"]
        assert len(approve_records) == 3, (
            f"Expected 3 approval records, got {len(approve_records)}"
        )


# ---------------------------------------------------------------------------
# Utility: fetch approval records for a given order
# ---------------------------------------------------------------------------


def _fetch_approval_records(order_id: str) -> list[dict]:
    """Fetch approval records for the given order from the API."""
    resp = requests.get(
        f"{BASE_URL}/orders/{order_id}/approval-records",
        headers=_headers(APPLICANT_TOKEN),
    )
    assert resp.status_code == 200, f"Failed to fetch approval records: {resp.text}"
    return resp.json()