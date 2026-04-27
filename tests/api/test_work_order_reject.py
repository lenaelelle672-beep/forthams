"""
tests/api/test_work_order_reject.py
====================================
API-level tests for the work-order **reject** endpoint.

Covers ATB-2 (reverse state-machine rejection) and ATB-3 (illegal state
transitions) from the multi-level approval SPEC.

Key constraints exercised:
  • rejectionReason is mandatory (non-empty, ≤500 chars) → HTTP 400
  • Only APPROVING_LEVEL_1 / APPROVING_LEVEL_2 may transition to REJECTED
  • Optimistic-lock (version field) prevents concurrent conflicts → HTTP 409
  • Approval records are persisted on successful rejection
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers / shared constants
# ---------------------------------------------------------------------------

BASE_URL = "/api/orders"

# Minimal payload that satisfies the reject schema
VALID_REJECT_BODY: dict[str, str] = {"rejectionReason": "不合规"}


def _iso_now() -> str:
    """Return the current UTC time in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def _make_create_payload(**overrides: Any) -> dict[str, Any]:
    """Build a work-order creation payload with sensible defaults."""
    defaults: dict[str, Any] = {
        "title": "Test Work Order",
        "description": "Created by test harness",
        "applicantId": "user-001",
        "category": "MAINTENANCE",
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def pending_order(authenticated_client: AsyncClient) -> dict[str, Any]:
    """Create a work order and return it in PENDING state."""
    resp = await authenticated_client.post(
        f"{BASE_URL}",
        json=_make_create_payload(),
    )
    assert resp.status_code == 201, f"Failed to create order: {resp.text}"
    return resp.json()


@pytest.fixture
async def level1_order(
    authenticated_client: AsyncClient,
    pending_order: dict[str, Any],
) -> dict[str, Any]:
    """Advance a PENDING order to APPROVING_LEVEL_1 and return it."""
    order_id = pending_order["id"]
    resp = await authenticated_client.post(
        f"{BASE_URL}/{order_id}/approve",
        json={"approverId": "dept-manager-001"},
    )
    assert resp.status_code == 200, f"Failed to approve to L1: {resp.text}"
    return resp.json()


@pytest.fixture
async def level2_order(
    authenticated_client: AsyncClient,
    level1_order: dict[str, Any],
) -> dict[str, Any]:
    """Advance an APPROVING_LEVEL_1 order to APPROVING_LEVEL_2 and return it."""
    order_id = level1_order["id"]
    resp = await authenticated_client.post(
        f"{BASE_URL}/{order_id}/approve",
        json={"approverId": "asset-admin-001"},
    )
    assert resp.status_code == 200, f"Failed to approve to L2: {resp.text}"
    return resp.json()


@pytest.fixture
async def rejected_order(
    authenticated_client: AsyncClient,
    level1_order: dict[str, Any],
) -> dict[str, Any]:
    """Reject an APPROVING_LEVEL_1 order and return it in REJECTED state."""
    order_id = level1_order["id"]
    resp = await authenticated_client.post(
        f"{BASE_URL}/{order_id}/reject",
        json=VALID_REJECT_BODY,
    )
    assert resp.status_code == 200, f"Failed to reject order: {resp.text}"
    return resp.json()


@pytest.fixture
async def approved_order(
    authenticated_client: AsyncClient,
    level2_order: dict[str, Any],
) -> dict[str, Any]:
    """Advance an APPROVING_LEVEL_2 order to APPROVED and return it."""
    order_id = level2_order["id"]
    resp = await authenticated_client.post(
        f"{BASE_URL}/{order_id}/approve",
        json={"approverId": "asset-admin-001"},
    )
    assert resp.status_code == 200, f"Failed to approve to final: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# ATB-2: Successful rejection from valid approval states
# ---------------------------------------------------------------------------


class TestRejectSuccess:
    """Verify that rejection works from APPROVING_LEVEL_1 and APPROVING_LEVEL_2."""

    @pytest.mark.asyncio
    async def test_reject_from_level1_returns_200(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """Rejecting from APPROVING_LEVEL_1 should return HTTP 200."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json=VALID_REJECT_BODY,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_reject_from_level1_sets_status_rejected(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """After rejection the order status must be REJECTED."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json=VALID_REJECT_BODY,
        )
        body = resp.json()
        assert body["status"] == "REJECTED"

    @pytest.mark.asyncio
    async def test_reject_from_level2_returns_200(
        self,
        authenticated_client: AsyncClient,
        level2_order: dict[str, Any],
    ) -> None:
        """Rejecting from APPROVING_LEVEL_2 should return HTTP 200."""
        order_id = level2_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "预算不足，不予通过"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_reject_from_level2_sets_status_rejected(
        self,
        authenticated_client: AsyncClient,
        level2_order: dict[str, Any],
    ) -> None:
        """After rejection from L2 the order status must be REJECTED."""
        order_id = level2_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "预算不足，不予通过"},
        )
        body = resp.json()
        assert body["status"] == "REJECTED"

    @pytest.mark.asyncio
    async def test_reject_persists_approval_record(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """A rejection must create an approval_record with action=REJECT."""
        order_id = level1_order["id"]
        reason = "不合规"
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": reason},
        )
        assert resp.status_code == 200
        body = resp.json()
        # The response should include or reference the created approval record
        assert "approvalRecord" in body or "records" in body, (
            "Response must include approval record information"
        )
        records = body.get("approvalRecord") or body.get("records", [])
        record = records if isinstance(records, list) else [records]
        reject_records = [r for r in record if r.get("action") == "REJECT"]
        assert len(reject_records) >= 1, "At least one REJECT record must exist"
        assert reject_records[0].get("comment") == reason

    @pytest.mark.asyncio
    async def test_reject_increments_version(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """Successful rejection must increment the order version (optimistic lock)."""
        order_id = level1_order["id"]
        old_version = level1_order["version"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json=VALID_REJECT_BODY,
        )
        assert resp.status_code == 200
        new_version = resp.json()["version"]
        assert new_version == old_version + 1


# ---------------------------------------------------------------------------
# ATB-2: Rejection validation — rejectionReason is mandatory
# ---------------------------------------------------------------------------


class TestRejectValidation:
    """Verify that missing / invalid rejectionReason returns HTTP 400."""

    @pytest.mark.asyncio
    async def test_reject_without_body_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """Sending an empty body must result in HTTP 400 Bad Request."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_missing_rejection_reason_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """Body without 'rejectionReason' key must return HTTP 400."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"someOtherField": "value"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_empty_reason_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """An empty-string rejectionReason must be rejected with HTTP 400."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": ""},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_whitespace_only_reason_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """A whitespace-only rejectionReason must be rejected with HTTP 400."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "   \t\n"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_reason_exceeds_500_chars_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """rejectionReason longer than 500 characters must return HTTP 400."""
        order_id = level1_order["id"]
        long_reason = "A" * 501
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": long_reason},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_reason_at_500_chars_is_accepted(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """rejectionReason of exactly 500 characters must be accepted."""
        order_id = level1_order["id"]
        reason_500 = "B" * 500
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": reason_500},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_reject_validation_does_not_change_status(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """A 400 validation failure must leave the order status unchanged."""
        order_id = level1_order["id"]
        await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={},
        )
        # Fetch the order to verify status is still APPROVING_LEVEL_1
        get_resp = await authenticated_client.get(f"{BASE_URL}/{order_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "APPROVING_LEVEL_1"


# ---------------------------------------------------------------------------
# ATB-3: Illegal state transitions → HTTP 409 Conflict
# ---------------------------------------------------------------------------


class TestRejectIllegalTransitions:
    """Rejecting from states other than APPROVING_LEVEL_1/2 must fail."""

    @pytest.mark.asyncio
    async def test_reject_from_pending_returns_409(
        self,
        authenticated_client: AsyncClient,
        pending_order: dict[str, Any],
    ) -> None:
        """PENDING → REJECTED is not a valid transition; expect HTTP 409."""
        order_id = pending_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json=VALID_REJECT_BODY,
        )
        assert resp.status_code == 409
        body = resp.json()
        assert body.get("errorCode") == "INVALID_STATE_TRANSITION"

    @pytest.mark.asyncio
    async def test_reject_from_pending_status_unchanged(
        self,
        authenticated_client: AsyncClient,
        pending_order: dict[str, Any],
    ) -> None:
        """After a 409 rejection attempt, the order must remain PENDING."""
        order_id = pending_order["id"]
        await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json=VALID_REJECT_BODY,
        )
        get_resp = await authenticated_client.get(f"{BASE_URL}/{order_id}")
        assert get_resp.json()["status"] == "PENDING"

    @pytest.mark.asyncio
    async def test_reject_from_rejected_returns_409(
        self,
        authenticated_client: AsyncClient,
        rejected_order: dict[str, Any],
    ) -> None:
        """REJECTED is a terminal state; rejecting again must return HTTP 409."""
        order_id = rejected_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "再次驳回"},
        )
        assert resp.status_code == 409
        assert resp.json().get("errorCode") == "INVALID_STATE_TRANSITION"

    @pytest.mark.asyncio
    async def test_reject_from_approved_returns_409(
        self,
        authenticated_client: AsyncClient,
        approved_order: dict[str, Any],
    ) -> None:
        """APPROVED is a terminal state; rejecting must return HTTP 409."""
        order_id = approved_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "事后驳回"},
        )
        assert resp.status_code == 409
        assert resp.json().get("errorCode") == "INVALID_STATE_TRANSITION"

    @pytest.mark.asyncio
    async def test_reject_from_cancelled_returns_409(
        self,
        authenticated_client: AsyncClient,
        pending_order: dict[str, Any],
    ) -> None:
        """CANCELLED is a terminal state; rejecting must return HTTP 409."""
        order_id = pending_order["id"]
        # Cancel the order first
        cancel_resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/cancel",
        )
        assert cancel_resp.status_code == 200

        # Now attempt to reject
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json=VALID_REJECT_BODY,
        )
        assert resp.status_code == 409
        assert resp.json().get("errorCode") == "INVALID_STATE_TRANSITION"


# ---------------------------------------------------------------------------
# Optimistic-lock / concurrency tests
# ---------------------------------------------------------------------------


class TestRejectOptimisticLock:
    """Verify that stale version values cause HTTP 409 Conflict."""

    @pytest.mark.asyncio
    async def test_reject_with_stale_version_returns_409(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """Sending an outdated version must result in HTTP 409."""
        order_id = level1_order["id"]
        stale_version = level1_order["version"] - 1  # deliberately wrong
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={
                "rejectionReason": "版本过期测试",
                "version": stale_version,
            },
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_reject_with_stale_version_does_not_change_status(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """A failed optimistic-lock reject must not change the order status."""
        order_id = level1_order["id"]
        stale_version = level1_order["version"] - 1
        await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={
                "rejectionReason": "版本过期测试",
                "version": stale_version,
            },
        )
        get_resp = await authenticated_client.get(f"{BASE_URL}/{order_id}")
        assert get_resp.json()["status"] == "APPROVING_LEVEL_1"

    @pytest.mark.asyncio
    async def test_reject_with_correct_version_succeeds(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """Sending the current version must allow the rejection to proceed."""
        order_id = level1_order["id"]
        current_version = level1_order["version"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={
                "rejectionReason": "版本正确测试",
                "version": current_version,
            },
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Approval record persistence
# ---------------------------------------------------------------------------


class TestRejectApprovalRecord:
    """Verify that approval records are correctly persisted on rejection."""

    @pytest.mark.asyncio
    async def test_reject_record_contains_operator(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """The approval record must capture the operator who rejected."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "操作人记录测试"},
        )
        assert resp.status_code == 200
        body = resp.json()
        records = body.get("approvalRecord") or body.get("records", [])
        record = records if isinstance(records, list) else [records]
        reject_records = [r for r in record if r.get("action") == "REJECT"]
        assert len(reject_records) >= 1
        assert reject_records[0].get("operatorId") is not None

    @pytest.mark.asyncio
    async def test_reject_record_contains_timestamp(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """The approval record must contain a valid ISO-8601 timestamp."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": "时间戳记录测试"},
        )
        assert resp.status_code == 200
        body = resp.json()
        records = body.get("approvalRecord") or body.get("records", [])
        record = records if isinstance(records, list) else [records]
        reject_records = [r for r in record if r.get("action") == "REJECT"]
        assert len(reject_records) >= 1
        timestamp = reject_records[0].get("createdAt") or reject_records[0].get("timestamp")
        assert timestamp is not None
        # Verify it's a valid ISO-8601 string
        datetime.fromisoformat(timestamp)

    @pytest.mark.asyncio
    async def test_reject_record_comment_matches_reason(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """The approval record comment must exactly match the rejectionReason."""
        order_id = level1_order["id"]
        reason = "资产编号与申请不符，请核实后重新提交"
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": reason},
        )
        assert resp.status_code == 200
        body = resp.json()
        records = body.get("approvalRecord") or body.get("records", [])
        record = records if isinstance(records, list) else [records]
        reject_records = [r for r in record if r.get("action") == "REJECT"]
        assert len(reject_records) >= 1
        assert reject_records[0].get("comment") == reason


# ---------------------------------------------------------------------------
# Non-existent / malformed order ID
# ---------------------------------------------------------------------------


class TestRejectEdgeCases:
    """Edge-case scenarios for the reject endpoint."""

    @pytest.mark.asyncio
    async def test_reject_nonexistent_order_returns_404(
        self,
        authenticated_client: AsyncClient,
    ) -> None:
        """Rejecting a non-existent order must return HTTP 404."""
        fake_id = str(uuid.uuid4())
        resp = await authenticated_client.post(
            f"{BASE_URL}/{fake_id}/reject",
            json=VALID_REJECT_BODY,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_reject_with_invalid_order_id_format_returns_400(
        self,
        authenticated_client: AsyncClient,
    ) -> None:
        """A malformed order ID must return HTTP 400."""
        resp = await authenticated_client.post(
            f"{BASE_URL}/not-a-uuid/reject",
            json=VALID_REJECT_BODY,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_with_null_rejection_reason_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """A null rejectionReason must return HTTP 400."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": None},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_reject_with_non_string_rejection_reason_returns_400(
        self,
        authenticated_client: AsyncClient,
        level1_order: dict[str, Any],
    ) -> None:
        """A non-string rejectionReason (e.g. number) must return HTTP 400."""
        order_id = level1_order["id"]
        resp = await authenticated_client.post(
            f"{BASE_URL}/{order_id}/reject",
            json={"rejectionReason": 12345},
        )
        assert resp.status_code == 400