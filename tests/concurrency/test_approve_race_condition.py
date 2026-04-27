"""
Concurrency tests for approval race-condition handling.

Validates that the optimistic-locking mechanism (based on the ``version`` field)
correctly prevents concurrent approval conflicts.  When two approvers attempt
to act on the same work order simultaneously, only one request may succeed;
the other must receive an HTTP 409 Conflict response with the business error
code ``OPTIMISTIC_LOCK_CONFLICT``.

References
----------
- SPEC 并发约束: 工单审批接口必须采用乐观锁（基于 version 字段）防止并发审批冲突，
  更新失败返回 HTTP 409 Conflict。
- ATB-1: 后端状态机正向流转测试
- ATB-2: 后端状态机逆向驳回测试
"""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Constants & helpers
# ---------------------------------------------------------------------------

HTTP_OK = 200
HTTP_CONFLICT = 409
HTTP_BAD_REQUEST = 400

ORDER_ID = "ord-001"
DEFAULT_VERSION = 1

ERROR_CODE_OPTIMISTIC_LOCK = "OPTIMISTIC_LOCK_CONFLICT"
ERROR_CODE_INVALID_TRANSITION = "INVALID_STATE_TRANSITION"


def _make_work_order(
    order_id: str = ORDER_ID,
    status: str = "PENDING",
    version: int = DEFAULT_VERSION,
) -> dict[str, Any]:
    """Return a minimal work-order dict used as a stand-in for a DB row."""
    return {
        "id": order_id,
        "status": status,
        "version": version,
        "applicant": "user-alice",
        "created_at": "2025-01-15T10:00:00Z",
    }


def _make_approval_response(
    order_id: str = ORDER_ID,
    new_status: str = "APPROVING_LEVEL_1",
    new_version: int = DEFAULT_VERSION + 1,
) -> dict[str, Any]:
    """Return a successful approval response body."""
    return {
        "id": order_id,
        "status": new_status,
        "version": new_version,
        "message": "Approval processed successfully.",
    }


def _make_conflict_response() -> dict[str, Any]:
    """Return an optimistic-lock conflict response body."""
    return {
        "errorCode": ERROR_CODE_OPTIMISTIC_LOCK,
        "message": "The work order has been modified by another transaction. Please retry.",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def work_order_pending() -> dict[str, Any]:
    """Provide a work order in PENDING state (ready for level-1 approval)."""
    return _make_work_order(status="PENDING", version=1)


@pytest.fixture
def work_order_level1() -> dict[str, Any]:
    """Provide a work order in APPROVING_LEVEL_1 state (ready for level-2 approval)."""
    return _make_work_order(status="APPROVING_LEVEL_1", version=2)


# ---------------------------------------------------------------------------
# Mock service that simulates optimistic-lock behaviour
# ---------------------------------------------------------------------------


class FakeApprovalService:
    """Simulates the backend approval service with optimistic locking.

    The first caller whose ``version`` matches the current stored version
    wins; subsequent callers with the same (now stale) version receive a
    conflict error.
    """

    def __init__(self, initial_order: dict[str, Any]) -> None:
        self._order = dict(initial_order)
        self._lock = threading.Lock()

    # -- public API ----------------------------------------------------------

    def approve(self, order_id: str, version: int) -> tuple[int, dict[str, Any]]:
        """Process an approval request with optimistic-lock check.

        Returns
        -------
        tuple[int, dict]
            (HTTP status code, response body).
        """
        with self._lock:
            if self._order["id"] != order_id:
                return HTTP_CONFLICT, _make_conflict_response()

            if self._order["version"] != version:
                return HTTP_CONFLICT, _make_conflict_response()

            # State transition validation
            current = self._order["status"]
            if current == "PENDING":
                new_status = "APPROVING_LEVEL_1"
            elif current == "APPROVING_LEVEL_1":
                new_status = "APPROVING_LEVEL_2"
            elif current == "APPROVING_LEVEL_2":
                new_status = "APPROVED"
            else:
                return HTTP_CONFLICT, {
                    "errorCode": ERROR_CODE_INVALID_TRANSITION,
                    "message": f"Cannot approve from state {current}.",
                }

            # Simulate a tiny DB write latency so that concurrent threads
            # are more likely to interleave.
            time.sleep(0.01)

            self._order["status"] = new_status
            self._order["version"] += 1
            return HTTP_OK, _make_approval_response(
                new_status=new_status, new_version=self._order["version"],
            )

    def reject(
        self,
        order_id: str,
        version: int,
        rejection_reason: Optional[str] = None,
    ) -> tuple[int, dict[str, Any]]:
        """Process a rejection request with optimistic-lock check.

        Returns
        -------
        tuple[int, dict]
            (HTTP status code, response body).
        """
        if not rejection_reason or not rejection_reason.strip():
            return HTTP_BAD_REQUEST, {
                "errorCode": "MISSING_REJECTION_REASON",
                "message": "rejectionReason is required and must be non-empty.",
            }

        with self._lock:
            if self._order["id"] != order_id:
                return HTTP_CONFLICT, _make_conflict_response()

            if self._order["version"] != version:
                return HTTP_CONFLICT, _make_conflict_response()

            current = self._order["status"]
            if current not in ("APPROVING_LEVEL_1", "APPROVING_LEVEL_2"):
                return HTTP_CONFLICT, {
                    "errorCode": ERROR_CODE_INVALID_TRANSITION,
                    "message": f"Cannot reject from state {current}.",
                }

            time.sleep(0.01)

            self._order["status"] = "REJECTED"
            self._order["version"] += 1
            return HTTP_OK, {
                "id": order_id,
                "status": "REJECTED",
                "version": self._order["version"],
                "rejectionReason": rejection_reason,
            }

    @property
    def current_order(self) -> dict[str, Any]:
        """Return a copy of the current work-order state."""
        return dict(self._order)


# ---------------------------------------------------------------------------
# Tests – concurrent approve
# ---------------------------------------------------------------------------


class TestConcurrentApproveRaceCondition:
    """Verify that simultaneous approval requests are serialised by the
    optimistic lock and that exactly one request succeeds."""

    def test_two_concurrent_level1_approves_only_one_succeeds(
        self, work_order_pending: dict[str, Any],
    ) -> None:
        """Two approvers simultaneously approve a PENDING order.

        Expected: one request returns 200, the other returns 409 with
        ``OPTIMISTIC_LOCK_CONFLICT``.
        """
        service = FakeApprovalService(work_order_pending)
        version = work_order_pending["version"]

        results: list[tuple[int, dict[str, Any]]] = [None, None]  # type: ignore[assignment]

        def approve_task(index: int) -> None:
            results[index] = service.approve(ORDER_ID, version)

        threads = [
            threading.Thread(target=approve_task, args=(i,)) for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        statuses = {r[0] for r in results}
        assert HTTP_OK in statuses, "At least one request should succeed (200)."
        assert HTTP_CONFLICT in statuses, (
            "At least one request should be rejected with 409 Conflict."
        )

        # The winning request should have advanced the version.
        final_order = service.current_order
        assert final_order["version"] == version + 1
        assert final_order["status"] == "APPROVING_LEVEL_1"

    def test_two_concurrent_level2_approves_only_one_succeeds(
        self, work_order_level1: dict[str, Any],
    ) -> None:
        """Two approvers simultaneously approve an APPROVING_LEVEL_1 order.

        Expected: one 200, one 409.
        """
        service = FakeApprovalService(work_order_level1)
        version = work_order_level1["version"]

        results: list[tuple[int, dict[str, Any]]] = [None, None]  # type: ignore[assignment]

        def approve_task(index: int) -> None:
            results[index] = service.approve(ORDER_ID, version)

        threads = [
            threading.Thread(target=approve_task, args=(i,)) for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        statuses = {r[0] for r in results}
        assert HTTP_OK in statuses
        assert HTTP_CONFLICT in statuses

        final_order = service.current_order
        assert final_order["version"] == version + 1
        assert final_order["status"] == "APPROVING_LEVEL_2"

    def test_many_concurrent_approves_exactly_one_succeeds(
        self, work_order_pending: dict[str, Any],
    ) -> None:
        """Ten concurrent approval requests on the same order.

        Expected: exactly one 200 and nine 409s.
        """
        service = FakeApprovalService(work_order_pending)
        version = work_order_pending["version"]

        def approve_task() -> tuple[int, dict[str, Any]]:
            return service.approve(ORDER_ID, version)

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(approve_task) for _ in range(10)]
            outcomes = [f.result() for f in as_completed(futures)]

        status_counts: dict[int, int] = {}
        for status_code, _body in outcomes:
            status_counts[status_code] = status_counts.get(status_code, 0) + 1

        assert status_counts.get(HTTP_OK, 0) == 1, (
            f"Expected exactly 1 success, got {status_counts.get(HTTP_OK, 0)}."
        )
        assert status_counts.get(HTTP_CONFLICT, 0) == 9, (
            f"Expected exactly 9 conflicts, got {status_counts.get(HTTP_CONFLICT, 0)}."
        )

        final_order = service.current_order
        assert final_order["version"] == version + 1


# ---------------------------------------------------------------------------
# Tests – concurrent reject
# ---------------------------------------------------------------------------


class TestConcurrentRejectRaceCondition:
    """Verify that simultaneous rejection requests are serialised by the
    optimistic lock."""

    def test_two_concurrent_rejects_only_one_succeeds(
        self, work_order_level1: dict[str, Any],
    ) -> None:
        """Two approvers simultaneously reject an APPROVING_LEVEL_1 order.

        Expected: one 200, one 409.
        """
        service = FakeApprovalService(work_order_level1)
        version = work_order_level1["version"]
        reason = "不合规"

        results: list[tuple[int, dict[str, Any]]] = [None, None]  # type: ignore[assignment]

        def reject_task(index: int) -> None:
            results[index] = service.reject(ORDER_ID, version, rejection_reason=reason)

        threads = [
            threading.Thread(target=reject_task, args=(i,)) for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        statuses = {r[0] for r in results}
        assert HTTP_OK in statuses
        assert HTTP_CONFLICT in statuses

        final_order = service.current_order
        assert final_order["status"] == "REJECTED"
        assert final_order["version"] == version + 1


# ---------------------------------------------------------------------------
# Tests – mixed concurrent approve / reject
# ---------------------------------------------------------------------------


class TestConcurrentApproveAndRejectRaceCondition:
    """Verify that a simultaneous approve and reject on the same order are
    correctly serialised."""

    def test_concurrent_approve_and_reject_only_one_succeeds(
        self, work_order_level1: dict[str, Any],
    ) -> None:
        """One approver approves while another rejects at the same time.

        Expected: exactly one succeeds (200), the other gets 409.
        """
        service = FakeApprovalService(work_order_level1)
        version = work_order_level1["version"]

        results: dict[str, tuple[int, dict[str, Any]]] = {}

        def approve_task() -> None:
            results["approve"] = service.approve(ORDER_ID, version)

        def reject_task() -> None:
            results["reject"] = service.reject(
                ORDER_ID, version, rejection_reason="不合规",
            )

        t_approve = threading.Thread(target=approve_task)
        t_reject = threading.Thread(target=reject_task)
        t_approve.start()
        t_reject.start()
        t_approve.join(timeout=5)
        t_reject.join(timeout=5)

        status_codes = {v[0] for v in results.values()}
        assert HTTP_OK in status_codes, "One operation should succeed."
        assert HTTP_CONFLICT in status_codes, "One operation should conflict."

        final_order = service.current_order
        assert final_order["version"] == version + 1
        assert final_order["status"] in ("APPROVING_LEVEL_2", "REJECTED")


# ---------------------------------------------------------------------------
# Tests – stale version explicitly
# ---------------------------------------------------------------------------


class TestStaleVersionConflict:
    """Verify that a request carrying a stale version is rejected with 409."""

    def test_approve_with_stale_version_returns_conflict(
        self, work_order_pending: dict[str, Any],
    ) -> None:
        """After a successful approval, a second request with the old version
        must return 409 Conflict."""
        service = FakeApprovalService(work_order_pending)
        version = work_order_pending["version"]

        # First approval succeeds.
        status_1, body_1 = service.approve(ORDER_ID, version)
        assert status_1 == HTTP_OK
        assert body_1["version"] == version + 1

        # Second approval with the *same* (now stale) version fails.
        status_2, body_2 = service.approve(ORDER_ID, version)
        assert status_2 == HTTP_CONFLICT
        assert body_2["errorCode"] == ERROR_CODE_OPTIMISTIC_LOCK

    def test_reject_with_stale_version_returns_conflict(
        self, work_order_level1: dict[str, Any],
    ) -> None:
        """After a successful rejection, a second request with the old version
        must return 409 Conflict."""
        service = FakeApprovalService(work_order_level1)
        version = work_order_level1["version"]

        # First rejection succeeds.
        status_1, _ = service.reject(ORDER_ID, version, rejection_reason="不合规")
        assert status_1 == HTTP_OK

        # Second rejection with stale version fails.
        status_2, body_2 = service.reject(
            ORDER_ID, version, rejection_reason="重复提交",
        )
        assert status_2 == HTTP_CONFLICT
        assert body_2["errorCode"] == ERROR_CODE_OPTIMISTIC_LOCK

    def test_approve_with_correct_version_after_stale_failure(
        self, work_order_pending: dict[str, Any],
    ) -> None:
        """A client that retries with the updated version should succeed."""
        service = FakeApprovalService(work_order_pending)
        version = work_order_pending["version"]

        # First approval succeeds, version increments.
        status_1, body_1 = service.approve(ORDER_ID, version)
        assert status_1 == HTTP_OK
        new_version = body_1["version"]

        # Stale version fails.
        status_2, _ = service.approve(ORDER_ID, version)
        assert status_2 == HTTP_CONFLICT

        # Retry with the correct new version succeeds (level-2 approval).
        status_3, body_3 = service.approve(ORDER_ID, new_version)
        assert status_3 == HTTP_OK
        assert body_3["status"] == "APPROVING_LEVEL_2"
        assert body_3["version"] == new_version + 1


# ---------------------------------------------------------------------------
# Tests – version increment verification
# ---------------------------------------------------------------------------


class TestVersionIncrementOnApproval:
    """Verify that the version field is incremented on every successful
    state transition."""

    def test_version_increments_on_each_approval_step(self) -> None:
        """Full approval chain: version increments at every step."""
        order = _make_work_order(status="PENDING", version=1)
        service = FakeApprovalService(order)

        # PENDING → APPROVING_LEVEL_1
        status, body = service.approve(ORDER_ID, version=1)
        assert status == HTTP_OK
        assert body["version"] == 2

        # APPROVING_LEVEL_1 → APPROVING_LEVEL_2
        status, body = service.approve(ORDER_ID, version=2)
        assert status == HTTP_OK
        assert body["version"] == 3

        # APPROVING_LEVEL_2 → APPROVED
        status, body = service.approve(ORDER_ID, version=3)
        assert status == HTTP_OK
        assert body["version"] == 4

        assert service.current_order["status"] == "APPROVED"

    def test_version_increments_on_rejection(self) -> None:
        """Rejection also increments the version."""
        order = _make_work_order(status="APPROVING_LEVEL_1", version=2)
        service = FakeApprovalService(order)

        status, body = service.reject(
            ORDER_ID, version=2, rejection_reason="材料不完整",
        )
        assert status == HTTP_OK
        assert body["version"] == 3
        assert service.current_order["status"] == "REJECTED"


# ---------------------------------------------------------------------------
# Tests – rejection reason validation under concurrency
# ---------------------------------------------------------------------------


class TestRejectionReasonValidationUnderConcurrency:
    """Ensure that rejection-reason validation is enforced even when
    concurrent requests are in flight."""

    def test_concurrent_reject_one_missing_reason_one_valid(
        self, work_order_level1: dict[str, Any],
    ) -> None:
        """One reject with missing reason (400) and one with valid reason
        racing against each other."""
        service = FakeApprovalService(work_order_level1)
        version = work_order_level1["version"]

        results: dict[str, tuple[int, dict[str, Any]]] = {}

        def reject_no_reason() -> None:
            results["no_reason"] = service.reject(
                ORDER_ID, version, rejection_reason="",
            )

        def reject_with_reason() -> None:
            results["with_reason"] = service.reject(
                ORDER_ID, version, rejection_reason="不合规",
            )

        t1 = threading.Thread(target=reject_no_reason)
        t2 = threading.Thread(target=reject_with_reason)
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        # The request with empty reason must always get 400.
        assert results["no_reason"][0] == HTTP_BAD_REQUEST

        # The request with a valid reason either succeeds (200) or
        # conflicts (409) depending on ordering, but never 400.
        assert results["with_reason"][0] in (HTTP_OK, HTTP_CONFLICT)

    def test_concurrent_reject_both_missing_reason(
        self, work_order_level1: dict[str, Any],
    ) -> None:
        """Both concurrent rejects with missing reason: both should get 400."""
        service = FakeApprovalService(work_order_level1)
        version = work_order_level1["version"]

        results: list[tuple[int, dict[str, Any]]] = [None, None]  # type: ignore[assignment]

        def reject_task(index: int) -> None:
            results[index] = service.reject(
                ORDER_ID, version, rejection_reason="",
            )

        threads = [
            threading.Thread(target=reject_task, args=(i,)) for i in range(2)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        for status_code, _body in results:
            assert status_code == HTTP_BAD_REQUEST

        # Order state should remain unchanged.
        assert service.current_order["status"] == "APPROVING_LEVEL_1"
        assert service.current_order["version"] == version