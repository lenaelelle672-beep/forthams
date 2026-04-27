"""
SWARM-P3-009: Release Mechanism Smoke Test — CRUD API Verification.

This module implements ATB-05 from the smoke test specification, providing
end-to-end CRUD lifecycle verification against the backend API.  It ensures
that the deployed backend service can handle Create, Read, Update, and Delete
operations correctly, with guaranteed teardown to maintain a zero-pollution
test environment.

Usage::

    pytest tests/smoke/test_api_crud.py -v

Environment variables (all optional):
    SMOKE_BACKEND_URL   — Base URL of the backend (default: http://localhost:8080)
    SMOKE_FRONTEND_URL  — Base URL of the frontend (default: http://localhost:3000)
    SMOKE_HEALTH_PATH   — Health-check path (default: /actuator/health)
    SMOKE_API_PREFIX    — CRUD API root (default: /api/items)
    SMOKE_TIMEOUT       — Per-request timeout in seconds (default: 5)
    SMOKE_HEALTH_RETRIES — Max polling attempts for readiness (default: 30)
    SMOKE_RETRY_INTERVAL — Seconds between polling attempts (default: 2)
"""

import os
import time

import pytest
import requests


# ---------------------------------------------------------------------------
# Configuration (overridable via environment variables)
# ---------------------------------------------------------------------------
BACKEND_BASE_URL = os.getenv("SMOKE_BACKEND_URL", "http://localhost:8080")
FRONTEND_BASE_URL = os.getenv("SMOKE_FRONTEND_URL", "http://localhost:3000")
HEALTH_ENDPOINT = os.getenv("SMOKE_HEALTH_PATH", "/actuator/health")
API_PREFIX = os.getenv("SMOKE_API_PREFIX", "/api/items")
REQUEST_TIMEOUT = int(os.getenv("SMOKE_TIMEOUT", "5"))
MAX_HEALTH_RETRIES = int(os.getenv("SMOKE_HEALTH_RETRIES", "30"))
RETRY_INTERVAL = int(os.getenv("SMOKE_RETRY_INTERVAL", "2"))

# Pre-defined mock test data — the only data used in CRUD smoke tests.
MOCK_ITEM_PAYLOAD = {
    "name": "smoke-test-item",
    "description": "Created by SWARM-P3-009 smoke test",
    "category": "test",
    "status": "active",
}

MOCK_UPDATE_PAYLOAD = {
    "name": "smoke-test-item-updated",
    "description": "Updated by SWARM-P3-009 smoke test",
    "category": "test",
    "status": "inactive",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _poll_until_reachable(
    url: str,
    retries: int = MAX_HEALTH_RETRIES,
    interval: float = RETRY_INTERVAL,
) -> bool:
    """Poll *url* until it responds with HTTP 200 or *retries* are exhausted.

    This replaces naive ``time.sleep`` calls with an active readiness probe,
    ensuring tests only start after the service is truly available.

    Args:
        url: The full URL to poll (e.g. ``http://localhost:8080/actuator/health``).
        retries: Maximum number of retry attempts.
        interval: Seconds to wait between consecutive attempts.

    Returns:
        ``True`` if the URL responded with status 200 within the budget,
        ``False`` otherwise.
    """
    for _ in range(retries):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                return True
        except requests.ConnectionError:
            pass
        time.sleep(interval)
    return False


# ---------------------------------------------------------------------------
# Session-scoped readiness fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def ensure_backend_ready():
    """ATB-03: Wait for the backend to become healthy before any test runs.

    Polls the Spring Boot Actuator health endpoint until a 200 response is
    received, or aborts the session after ``MAX_HEALTH_RETRIES`` attempts.
    This guarantees that all subsequent tests operate against a running
    backend instance.
    """
    health_url = f"{BACKEND_BASE_URL}{HEALTH_ENDPOINT}"
    reachable = _poll_until_reachable(health_url)
    assert reachable, (
        f"Backend health check failed: {health_url} did not return HTTP 200 "
        f"within {MAX_HEALTH_RETRIES * RETRY_INTERVAL}s"
    )


# ---------------------------------------------------------------------------
# Per-test fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def api_session():
    """Provide a reusable ``requests.Session`` for API interaction.

    The session shares TCP connections and default headers across requests
    within a single test, improving performance and ensuring consistent
    ``Content-Type`` propagation.

    Yields:
        A ``requests.Session`` with ``Content-Type: application/json`` set.
    """
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    yield session
    session.close()


@pytest.fixture()
def created_item_id(api_session):
    """Create a test item, yield its ID, and guarantee DELETE on teardown.

    Implements the ATB-05 **Create** step and the mandatory **Cleanup** step.
    The created item is automatically deleted after the consuming test
    finishes — regardless of whether it succeeded or failed — keeping the
    test environment data-pollution-free.

    Args:
        api_session: The per-test ``requests.Session`` fixture.

    Yields:
        The ``id`` of the newly created item, or ``None`` if the POST itself
        fails (allowing downstream tests to emit a clear skip message).
    """
    url = f"{BACKEND_BASE_URL}{API_PREFIX}"
    resp = api_session.post(url, json=MOCK_ITEM_PAYLOAD)
    item_id = None

    if resp.status_code in (200, 201):
        body = resp.json()
        item_id = body.get("id")

    yield item_id

    # --- Teardown: best-effort DELETE to ensure zero-pollution ---
    if item_id is not None:
        delete_url = f"{BACKEND_BASE_URL}{API_PREFIX}/{item_id}"
        try:
            api_session.delete(delete_url, timeout=REQUEST_TIMEOUT)
        except requests.RequestException:
            pass  # Best-effort; must not mask the original test result


# ---------------------------------------------------------------------------
# Test Cases — Backend Health
# ---------------------------------------------------------------------------

class TestBackendHealth:
    """ATB-03: Backend local-deployment health verification.

    Confirms that the Spring Boot application started successfully and
    reports a healthy status through its Actuator endpoint.
    """

    def test_actuator_health_returns_200(self):
        """Verify the Actuator health endpoint returns HTTP 200 with status UP."""
        url = f"{BACKEND_BASE_URL}{HEALTH_ENDPOINT}"
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        assert resp.status_code == 200, (
            f"Health endpoint returned {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        status = data.get("status", "").upper()
        assert status in ("UP", "HEALTHY", "OK"), (
            f"Unexpected health status: {data.get('status')}"
        )


# ---------------------------------------------------------------------------
# Test Cases — CRUD Lifecycle (ATB-05)
# ---------------------------------------------------------------------------

class TestCRUDLifecycle:
    """ATB-05: Full CRUD API lifecycle verification.

    Each test is **independent**: it obtains its own item via the
    ``created_item_id`` fixture, which also handles teardown.  Tests may
    run in any order without side-effects.
    """

    # -- Create ---------------------------------------------------------------

    def test_create_item(self, api_session):
        """ATB-05 Create: POST /api/items returns 201 Created with an ``id``.

        After asserting creation, the item is immediately deleted so that
        no orphan data remains.
        """
        url = f"{BACKEND_BASE_URL}{API_PREFIX}"
        resp = api_session.post(url, json=MOCK_ITEM_PAYLOAD)
        assert resp.status_code == 201, (
            f"Create failed: expected 201, got {resp.status_code} — {resp.text}"
        )
        body = resp.json()
        assert "id" in body, f"Response body missing 'id' field: {body}"

        # Immediate cleanup
        api_session.delete(f"{url}/{body['id']}", timeout=REQUEST_TIMEOUT)

    # -- Read -----------------------------------------------------------------

    def test_read_item(self, api_session, created_item_id):
        """ATB-05 Read: GET /api/items/{id} returns 200 with matching data.

        Pre-conditions:
            * ``created_item_id`` fixture has successfully POSTed an item.
        """
        assert created_item_id is not None, "Pre-condition failed: item was not created"
        url = f"{BACKEND_BASE_URL}{API_PREFIX}/{created_item_id}"
        resp = api_session.get(url, timeout=REQUEST_TIMEOUT)
        assert resp.status_code == 200, (
            f"Read failed: expected 200, got {resp.status_code} — {resp.text}"
        )
        body = resp.json()
        assert body.get("id") == created_item_id, (
            f"ID mismatch: expected {created_item_id}, got {body.get('id')}"
        )

    # -- Update ---------------------------------------------------------------

    def test_update_item(self, api_session, created_item_id):
        """ATB-05 Update: PUT /api/items/{id} returns 200 with updated fields.

        The test verifies that the ``name`` field is persisted after the
        PUT request.  Teardown is handled by the ``created_item_id`` fixture.

        Pre-conditions:
            * ``created_item_id`` fixture has successfully POSTed an item.
        """
        assert created_item_id is not None, "Pre-condition failed: item was not created"
        url = f"{BACKEND_BASE_URL}{API_PREFIX}/{created_item_id}"
        resp = api_session.put(url, json=MOCK_UPDATE_PAYLOAD, timeout=REQUEST_TIMEOUT)
        assert resp.status_code == 200, (
            f"Update failed: expected 200, got {resp.status_code} — {resp.text}"
        )
        body = resp.json()
        assert body.get("name") == MOCK_UPDATE_PAYLOAD["name"], (
            f"Update did not persist: expected name={MOCK_UPDATE_PAYLOAD['name']!r}, "
            f"got {body.get('name')!r}"
        )

    # -- Delete ---------------------------------------------------------------

    def test_delete_item(self, api_session, created_item_id):
        """ATB-05 Delete: DELETE /api/items/{id} returns 204 No Content.

        After a successful delete, a subsequent GET must return 404,
        confirming the resource was truly removed.

        Pre-conditions:
            * ``created_item_id`` fixture has successfully POSTed an item.
        """
        assert created_item_id is not None, "Pre-condition failed: item was not created"
        url = f"{BACKEND_BASE_URL}{API_PREFIX}/{created_item_id}"
        resp = api_session.delete(url, timeout=REQUEST_TIMEOUT)
        assert resp.status_code == 204, (
            f"Delete failed: expected 204, got {resp.status_code} — {resp.text}"
        )

        # Confirm item no longer exists
        get_resp = api_session.get(url, timeout=REQUEST_TIMEOUT)
        assert get_resp.status_code == 404, (
            f"Item still retrievable after DELETE: GET returned {get_resp.status_code}"
        )