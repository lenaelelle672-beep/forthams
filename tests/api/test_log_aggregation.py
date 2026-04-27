"""
tests/api/test_log_aggregation.py

Audit Dashboard Log Aggregation API — Acceptance Test Suite
===========================================================

Covers ATB-1 through ATB-5 from the Phase-1 spec:

  ATB-1  Time-trend aggregation endpoint
  ATB-2  Operation-type distribution endpoint
  ATB-3  Operator-ranking (Top-N) endpoint
  ATB-4  Permission interception (ROLE_ADMIN guard)
  ATB-5  Time-span boundary validation (max 90 days)

All timestamps are UTC / ISO-8601 (yyyy-MM-dd'T'HH:mm:ss'Z').
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

UTC = timezone.utc
ISO_FMT = "%Y-%m-%dT%H:%M:%SZ"


def utc_iso(dt: datetime) -> str:
    """Return an ISO-8601 UTC string for *dt*."""
    return dt.astimezone(UTC).strftime(ISO_FMT)


def _build_headers(token: str | None = None) -> Dict[str, str]:
    """Return common request headers with optional Authorization bearer."""
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_token() -> str:
    """Return a pre-configured admin JWT token for testing.

    In a real integration environment this fixture would call the auth
    endpoint and extract the token.  For unit / contract-level tests we
    return a deterministic value that the test double recognises.
    """
    return "test-admin-token"


@pytest.fixture
def user_token() -> str:
    """Return a token for a regular (non-admin) user."""
    return "test-user-token"


@pytest.fixture
def base_time() -> datetime:
    """A stable reference point in UTC for all test data."""
    return datetime(2025, 1, 1, 0, 0, 0, tzinfo=UTC)


@pytest.fixture
def seed_logs(base_time: datetime) -> List[Dict[str, Any]]:
    """Generate a deterministic set of audit log entries for testing.

    Returns a list of dicts suitable for bulk-insertion into the audit_log
    table / collection.  The data is designed so that:

    * 15 distinct operator_ids exist (for Top-N truncation tests).
    * Three operation types are represented: LOGIN, CREATE, DELETE.
    * Counts decrease monotonically per operator (op-001 has the most).
    * Logs span a configurable time window around *base_time*.
    """
    logs: List[Dict[str, Any]] = []
    op_types = ["LOGIN", "CREATE", "DELETE"]
    # operator_id -> number of log entries (monotonically decreasing)
    operator_counts = {f"op-{i:03d}": 20 - i for i in range(1, 16)}
    # op-001: 19, op-002: 18, … op-015: 5

    cursor = base_time
    for op_id, count in operator_counts.items():
        for j in range(count):
            logs.append(
                {
                    "operator_id": op_id,
                    "operation_type": op_types[j % len(op_types)],
                    "timestamp": utc_iso(cursor),
                    "resource_type": "asset",
                    "resource_id": f"asset-{len(logs)}",
                    "detail": json.dumps({"action": "test"}),
                }
            )
            cursor += timedelta(minutes=10)

    return logs


# ---------------------------------------------------------------------------
# ATB-1: Time-trend aggregation
# ---------------------------------------------------------------------------


class TestTimeTrendAggregation:
    """ATB-1 — GET /api/v1/audit/dashboard/trend"""

    ENDPOINT = "/api/v1/audit/dashboard/trend"

    @pytest.mark.asyncio
    async def test_trend_day_granularity_success(
        self,
        client: AsyncClient,
        admin_token: str,
        seed_logs: List[Dict[str, Any]],
        base_time: datetime,
    ) -> None:
        """Day-granularity trend returns one bucket per calendar day.

        Steps:
        1. Seed audit logs spanning a known time range.
        2. GET /trend with start_time, end_time, granularity=day.
        3. Assert 200; array length == span in days; sum(counts) == total seeded.
        """
        start = base_time
        end = base_time + timedelta(days=7)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "day",
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()

        # Response must be a list of trend buckets
        assert isinstance(body, list), f"Expected list, got {type(body).__name__}"

        expected_days = (end - start).days
        assert len(body) == expected_days, (
            f"Expected {expected_days} day buckets, got {len(body)}"
        )

        # Every bucket must have 'time_bucket' and 'count'
        for bucket in body:
            assert "time_bucket" in bucket, "Missing 'time_bucket' key"
            assert "count" in bucket, "Missing 'count' key"
            assert isinstance(bucket["count"], int), "count must be int"

        # Sum of all counts must equal total seeded log entries
        total_count = sum(b["count"] for b in body)
        assert total_count == len(seed_logs), (
            f"Sum of counts ({total_count}) != seeded logs ({len(seed_logs)})"
        )

    @pytest.mark.asyncio
    async def test_trend_hour_granularity_within_3_days(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Hour-granularity is accepted when span <= 3 days."""
        start = base_time
        end = base_time + timedelta(days=2)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "hour",
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()
        assert isinstance(body, list)

        expected_hours = int((end - start).total_seconds() // 3600)
        assert len(body) == expected_hours, (
            f"Expected {expected_hours} hour buckets, got {len(body)}"
        )

    @pytest.mark.asyncio
    async def test_trend_hour_granularity_rejected_over_3_days(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Hour-granularity must be rejected when span > 3 days (400)."""
        start = base_time
        end = base_time + timedelta(days=3, hours=1)  # 73 hours > 3 days
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "hour",
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 400, (
            f"Expected 400 for hour granularity > 3 days, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_trend_default_granularity_is_day(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """When granularity is omitted, the API defaults to 'day'."""
        start = base_time
        end = base_time + timedelta(days=5)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            # granularity intentionally omitted
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        expected_days = (end - start).days
        assert len(body) == expected_days

    @pytest.mark.asyncio
    async def test_trend_filter_by_operation_type(
        self,
        client: AsyncClient,
        admin_token: str,
        seed_logs: List[Dict[str, Any]],
        base_time: datetime,
    ) -> None:
        """Trend can be filtered by a specific operation_type."""
        start = base_time
        end = base_time + timedelta(days=7)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "day",
            "operation_type": "LOGIN",
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)

        login_count = sum(b["count"] for b in body)
        expected_login = sum(1 for lg in seed_logs if lg["operation_type"] == "LOGIN")
        assert login_count == expected_login, (
            f"Filtered LOGIN count ({login_count}) != expected ({expected_login})"
        )


# ---------------------------------------------------------------------------
# ATB-2: Operation-type distribution
# ---------------------------------------------------------------------------


class TestTypeDistribution:
    """ATB-2 — GET /api/v1/audit/dashboard/type-distribution"""

    ENDPOINT = "/api/v1/audit/dashboard/type-distribution"

    @pytest.mark.asyncio
    async def test_distribution_returns_all_types(
        self,
        client: AsyncClient,
        admin_token: str,
        seed_logs: List[Dict[str, Any]],
        base_time: datetime,
    ) -> None:
        """Distribution returns accurate counts per operation_type."""
        start = base_time
        end = base_time + timedelta(days=30)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()

        assert isinstance(body, list), f"Expected list, got {type(body).__name__}"

        # Build expected counts from seed data
        expected: Dict[str, int] = {}
        for lg in seed_logs:
            expected[lg["operation_type"]] = expected.get(lg["operation_type"], 0) + 1

        # Map response into a dict for easy comparison
        actual: Dict[str, int] = {}
        for item in body:
            assert "operation_type" in item, "Missing 'operation_type' key"
            assert "count" in item, "Missing 'count' key"
            actual[item["operation_type"]] = item["count"]

        # Every seeded type must appear; no extra types
        assert set(actual.keys()) == set(expected.keys()), (
            f"Type mismatch: response has {set(actual.keys())}, expected {set(expected.keys())}"
        )
        for op_type, cnt in expected.items():
            assert actual[op_type] == cnt, (
                f"Type {op_type}: expected {cnt}, got {actual[op_type]}"
            )

    @pytest.mark.asyncio
    async def test_distribution_no_data_leakage_outside_range(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Only logs within the requested time range are counted."""
        # Request a very narrow window where no logs exist
        start = base_time - timedelta(days=365)
        end = base_time - timedelta(days=360)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()
        # Either empty list or list with zero counts
        if isinstance(body, list) and body:
            for item in body:
                assert item["count"] == 0, (
                    f"Expected 0 count outside data range, got {item['count']}"
                )


# ---------------------------------------------------------------------------
# ATB-3: Operator ranking (Top-N)
# ---------------------------------------------------------------------------


class TestOperatorRanking:
    """ATB-3 — GET /api/v1/audit/dashboard/operator-ranking"""

    ENDPOINT = "/api/v1/audit/dashboard/operator-ranking"

    @pytest.mark.asyncio
    async def test_ranking_returns_top_10(
        self,
        client: AsyncClient,
        admin_token: str,
        seed_logs: List[Dict[str, Any]],
        base_time: datetime,
    ) -> None:
        """With 15 operators seeded, only top 10 are returned."""
        start = base_time
        end = base_time + timedelta(days=30)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        body = resp.json()

        assert isinstance(body, list), f"Expected list, got {type(body).__name__}"
        assert len(body) == 10, (
            f"Expected exactly 10 operators (Top-N truncation), got {len(body)}"
        )

        # Verify structure
        for item in body:
            assert "operator_id" in item, "Missing 'operator_id' key"
            assert "count" in item, "Missing 'count' key"

    @pytest.mark.asyncio
    async def test_ranking_first_is_most_active(
        self,
        client: AsyncClient,
        admin_token: str,
        seed_logs: List[Dict[str, Any]],
        base_time: datetime,
    ) -> None:
        """The first element must be the operator with the highest count."""
        start = base_time
        end = base_time + timedelta(days=30)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()

        # Compute expected top operator from seed data
        operator_counts: Dict[str, int] = {}
        for lg in seed_logs:
            operator_counts[lg["operator_id"]] = (
                operator_counts.get(lg["operator_id"], 0) + 1
            )
        expected_top = max(operator_counts, key=operator_counts.get)  # type: ignore[arg-type]

        assert body[0]["operator_id"] == expected_top, (
            f"Top operator should be '{expected_top}', got '{body[0]['operator_id']}'"
        )

    @pytest.mark.asyncio
    async def test_ranking_counts_are_descending(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Results must be ordered by count descending."""
        start = base_time
        end = base_time + timedelta(days=30)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()

        counts = [item["count"] for item in body]
        for i in range(len(counts) - 1):
            assert counts[i] >= counts[i + 1], (
                f"Ranking not descending at index {i}: {counts[i]} < {counts[i + 1]}"
            )

    @pytest.mark.asyncio
    async def test_ranking_top_n_param_respected(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Explicit top_n=5 returns exactly 5 results."""
        start = base_time
        end = base_time + timedelta(days=30)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "top_n": 5,
        }

        resp = await client.get(
            self.ENDPOINT,
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 5, f"Expected 5 results for top_n=5, got {len(body)}"


# ---------------------------------------------------------------------------
# ATB-4: Permission interception
# ---------------------------------------------------------------------------


class TestPermissionGuard:
    """ATB-4 — All dashboard endpoints require ROLE_ADMIN.

    Requests with a regular-user token must receive 403 Forbidden.
    """

    ENDPOINTS = [
        "/api/v1/audit/dashboard/trend",
        "/api/v1/audit/dashboard/type-distribution",
        "/api/v1/audit/dashboard/operator-ranking",
    ]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    async def test_non_admin_gets_403(
        self,
        client: AsyncClient,
        user_token: str,
        base_time: datetime,
        endpoint: str,
    ) -> None:
        """A user without ROLE_ADMIN must receive 403 on every dashboard endpoint."""
        start = base_time
        end = base_time + timedelta(days=7)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            endpoint,
            params=params,
            headers=_build_headers(user_token),
        )

        assert resp.status_code == 403, (
            f"Expected 403 Forbidden for {endpoint} with non-admin token, "
            f"got {resp.status_code}"
        )

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    async def test_missing_token_gets_401_or_403(
        self,
        client: AsyncClient,
        base_time: datetime,
        endpoint: str,
    ) -> None:
        """A request with no Authorization header must be rejected."""
        start = base_time
        end = base_time + timedelta(days=7)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            endpoint,
            params=params,
            headers=_build_headers(token=None),
        )

        assert resp.status_code in (401, 403), (
            f"Expected 401/403 for {endpoint} with no token, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# ATB-5: Time-span boundary validation
# ---------------------------------------------------------------------------


class TestTimeSpanBoundary:
    """ATB-5 — Max allowed time span is 90 days.

    Requests exceeding 90 days must receive 400 Bad Request with a
    descriptive error message.
    """

    @pytest.mark.asyncio
    async def test_91_day_span_rejected_on_trend(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """91-day span on /trend returns 400."""
        start = base_time
        end = base_time + timedelta(days=91)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "day",
        }

        resp = await client.get(
            "/api/v1/audit/dashboard/trend",
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 400, (
            f"Expected 400 for 91-day span on /trend, got {resp.status_code}"
        )
        body = resp.json()
        error_msg = json.dumps(body).lower()
        assert "时间" in error_msg or "span" in error_msg or "range" in error_msg or "超过" in error_msg or "exceed" in error_msg, (
            f"Error message should mention time span limit, got: {body}"
        )

    @pytest.mark.asyncio
    async def test_91_day_span_rejected_on_distribution(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """91-day span on /type-distribution returns 400."""
        start = base_time
        end = base_time + timedelta(days=91)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            "/api/v1/audit/dashboard/type-distribution",
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 400, (
            f"Expected 400 for 91-day span on /type-distribution, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_91_day_span_rejected_on_ranking(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """91-day span on /operator-ranking returns 400."""
        start = base_time
        end = base_time + timedelta(days=91)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
        }

        resp = await client.get(
            "/api/v1/audit/dashboard/operator-ranking",
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 400, (
            f"Expected 400 for 91-day span on /operator-ranking, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_exactly_90_days_accepted(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Exactly 90-day span must be accepted (boundary value)."""
        start = base_time
        end = base_time + timedelta(days=90)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "day",
        }

        resp = await client.get(
            "/api/v1/audit/dashboard/trend",
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200, (
            f"Expected 200 for exactly 90-day span, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_end_before_start_rejected(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """start_time > end_time must be rejected with 400."""
        start = base_time + timedelta(days=5)
        end = base_time
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "day",
        }

        resp = await client.get(
            "/api/v1/audit/dashboard/trend",
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 400, (
            f"Expected 400 when start > end, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_missing_time_params_rejected(
        self,
        client: AsyncClient,
        admin_token: str,
    ) -> None:
        """Requests without start_time or end_time must be rejected (422/400)."""
        resp = await client.get(
            "/api/v1/audit/dashboard/trend",
            params={"granularity": "day"},
            headers=_build_headers(admin_token),
        )

        assert resp.status_code in (400, 422), (
            f"Expected 400/422 for missing time params, got {resp.status_code}"
        )


# ---------------------------------------------------------------------------
# ATB-5 supplement: ISO-8601 / UTC timezone enforcement
# ---------------------------------------------------------------------------


class TestTimezoneAndFormat:
    """Verify that all response timestamps conform to UTC ISO-8601."""

    @pytest.mark.asyncio
    async def test_trend_buckets_use_utc_iso_format(
        self,
        client: AsyncClient,
        admin_token: str,
        base_time: datetime,
    ) -> None:
        """Each trend bucket's time_bucket must end with 'Z' (UTC marker)."""
        start = base_time
        end = base_time + timedelta(days=3)
        params = {
            "start_time": utc_iso(start),
            "end_time": utc_iso(end),
            "granularity": "day",
        }

        resp = await client.get(
            "/api/v1/audit/dashboard/trend",
            params=params,
            headers=_build_headers(admin_token),
        )

        assert resp.status_code == 200
        body = resp.json()
        for bucket in body:
            tb = bucket["time_bucket"]
            assert isinstance(tb, str), f"time_bucket must be str, got {type(tb)}"
            assert tb.endswith("Z"), (
                f"time_bucket '{tb}' must end with 'Z' (UTC ISO-8601)"
            )
            # Verify it can be parsed
            datetime.strptime(tb, ISO_FMT)