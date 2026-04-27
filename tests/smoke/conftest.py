"""
Smoke test fixtures for SWARM-P3-009 release-readiness verification.

This module provides pytest fixtures that manage:
- Backend (Spring Boot) build, startup, health-probe and teardown (ATB-01 / ATB-03).
- Frontend (Node/NPM) build, startup, accessibility check and teardown (ATB-02 / ATB-04).
- A shared ``api_client`` session for CRUD tests (ATB-05).
- Mock-data factories with guaranteed DELETE cleanup (ATB-05).
- A front-end white-screen guard (ATB-06).
- A session-level report writer that produces ``smoke-test-report.md`` (ATB-07).

Environment variables (all optional):
    BACKEND_DIR   – path to the Maven project root (default ``backend``).
    FRONTEND_DIR  – path to the NPM project root (default ``frontend``).
    PROJECT_ROOT  – root of the repository (default ``os.getcwd()``).
"""

import glob
import os
import signal
import subprocess
import time
from typing import Any, Dict, Generator, List

import pytest
import requests

# ─── Configuration constants ────────────────────────────────────────

BACKEND_PORT: int = 8080
FRONTEND_PORT: int = 3000
BACKEND_HOST: str = "localhost"
FRONTEND_HOST: str = "localhost"

API_BASE_URL: str = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
FRONTEND_URL: str = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}"
HEALTH_CHECK_URL: str = f"{API_BASE_URL}/actuator/health"

# Polling defaults (seconds)
HEALTH_CHECK_TIMEOUT: int = 60
HEALTH_CHECK_INTERVAL: float = 2.0
FRONTEND_READY_TIMEOUT: int = 60
FRONTEND_READY_INTERVAL: float = 3.0


# ─── Helpers ─────────────────────────────────────────────────────────

def _poll_url(url: str, timeout: int, interval: float,
              expected_status: int = 200) -> bool:
    """Poll *url* until it returns *expected_status* or *timeout* elapses.

    Args:
        url: Target HTTP endpoint.
        timeout: Maximum wall-clock seconds to wait.
        interval: Seconds between successive attempts.
        expected_status: HTTP status code that indicates readiness.

    Returns:
        ``True`` if the endpoint became ready within the deadline.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = requests.get(url, timeout=2)
            if resp.status_code == expected_status:
                return True
        except requests.ConnectionError:
            pass
        time.sleep(interval)
    return False


def _terminate_process(proc: subprocess.Popen) -> None:
    """Gracefully terminate a subprocess and its process group (POSIX).

    Falls back to ``taskkill`` on Windows.  Sends SIGKILL if the process
    does not exit within 10 seconds of SIGTERM.

    Args:
        proc: The subprocess handle to terminate.
    """
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
        )
    else:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


# ─── Backend lifecycle (ATB-01 + ATB-03) ─────────────────────────────

@pytest.fixture(scope="session")
def backend_service() -> Generator[Dict[str, Any], None, None]:
    """Build the Spring Boot JAR, start it and wait for the health endpoint.

    Performs ``mvn clean package -DskipTests`` (ATB-01), launches the
    resulting JAR, then polls ``/actuator/health`` until a 200 response
    is received (ATB-03).

    Yields:
        A dict with ``process`` (subprocess.Popen) and ``url`` (base URL).
    """
    backend_dir = os.environ.get("BACKEND_DIR", "backend")

    # ATB-01 – backend build verification
    build = subprocess.run(
        ["mvn", "clean", "package", "-DskipTests"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
    )
    assert build.returncode == 0, (
        f"Backend build failed (exit {build.returncode}):\n{build.stderr}"
    )

    # Discover the packaged JAR (exclude -sources / -javadoc classifiers)
    jar_candidates = [
        j for j in glob.glob(os.path.join(backend_dir, "target", "*.jar"))
        if "-sources" not in j and "-javadoc" not in j
    ]
    assert jar_candidates, "No .jar found in backend/target/ after build"
    jar_path = jar_candidates[0]

    # Start backend process
    proc = subprocess.Popen(
        ["java", "-jar", jar_path],
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        preexec_fn=os.setsid if os.name != "nt" else None,
    )

    # ATB-03 – health probe
    healthy = _poll_url(
        HEALTH_CHECK_URL, HEALTH_CHECK_TIMEOUT, HEALTH_CHECK_INTERVAL
    )
    if not healthy:
        proc.terminate()
        pytest.fail(
            f"Backend did not become healthy at {HEALTH_CHECK_URL} "
            f"within {HEALTH_CHECK_TIMEOUT}s"
        )

    yield {"process": proc, "url": API_BASE_URL}

    # Teardown
    _terminate_process(proc)


# ─── Frontend lifecycle (ATB-02 + ATB-04) ────────────────────────────

@pytest.fixture(scope="session")
def frontend_service() -> Generator[Dict[str, Any], None, None]:
    """Build the frontend, start a dev server and verify accessibility.

    Runs ``npm install`` followed by ``npm run build`` (ATB-02), then
    launches ``npm run start`` and polls ``http://localhost:3000`` until
    an HTTP response is received (ATB-04).

    Yields:
        A dict with ``process`` and ``url``.
    """
    frontend_dir = os.environ.get("FRONTEND_DIR", "frontend")

    # ATB-02 – frontend build verification
    install = subprocess.run(
        ["npm", "install"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
    )
    assert install.returncode == 0, (
        f"npm install failed:\n{install.stderr}"
    )

    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
    )
    assert build.returncode == 0, (
        f"npm run build failed:\n{build.stderr}"
    )

    # Verify dist/ or build/ was produced
    static_dir_exists = os.path.isdir(
        os.path.join(frontend_dir, "dist")
    ) or os.path.isdir(os.path.join(frontend_dir, "build"))
    assert static_dir_exists, (
        "Neither dist/ nor build/ found after npm run build"
    )

    # Start frontend dev / static server
    proc = subprocess.Popen(
        ["npm", "run", "start"],
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        preexec_fn=os.setsid if os.name != "nt" else None,
    )

    # ATB-04 – frontend accessibility (accept any non-5xx response)
    deadline = time.time() + FRONTEND_READY_TIMEOUT
    ready = False
    while time.time() < deadline:
        try:
            resp = requests.get(FRONTEND_URL, timeout=2)
            if resp.status_code < 500:
                ready = True
                break
        except requests.ConnectionError:
            pass
        time.sleep(FRONTEND_READY_INTERVAL)

    if not ready:
        proc.terminate()
        pytest.fail(
            f"Frontend not accessible at {FRONTEND_URL} "
            f"within {FRONTEND_READY_TIMEOUT}s"
        )

    yield {"process": proc, "url": FRONTEND_URL}

    # Teardown
    _terminate_process(proc)


# ─── API client (ATB-05) ─────────────────────────────────────────────

@pytest.fixture
def api_client() -> requests.Session:
    """Provide a pre-configured HTTP session targeting the backend API.

    The session sets ``Content-Type: application/json`` by default.

    Returns:
        A ``requests.Session`` ready for JSON API calls.
    """
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ─── CRUD mock data with guaranteed cleanup (ATB-05) ─────────────────

@pytest.fixture
def created_item(
    api_client: requests.Session,
) -> Generator[Dict[str, Any], None, None]:
    """Create a test item via POST /api/items and guarantee DELETE on teardown.

    Implements the **Create** step of ATB-05 and ensures the record is
    deleted regardless of test outcome (pass / fail / error).

    Yields:
        A dict with the created item ``id`` and the original ``payload``.
    """
    payload: Dict[str, Any] = {
        "name": f"smoke-test-item-{int(time.time())}",
        "description": "Created by release smoke test – will be deleted",
    }
    resp = api_client.post(f"{API_BASE_URL}/api/items", json=payload)
    assert resp.status_code == 201, (
        f"POST /api/items returned {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    item_id = body.get("id")
    assert item_id is not None, f"Response missing 'id': {body}"

    yield {"id": item_id, "payload": payload}

    # Teardown – always attempt DELETE (zero-pollution guarantee)
    try:
        api_client.delete(f"{API_BASE_URL}/api/items/{item_id}")
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] Cleanup DELETE for item {item_id} failed: {exc}")


# ─── Front-end white-screen guard (ATB-06) ───────────────────────────

@pytest.fixture
def frontend_page_loaded() -> bool:
    """Verify the frontend HTML contains a mounted app root element.

    Issues a GET to ``FRONTEND_URL`` and asserts that the response body
    includes ``<div id="root">`` (React) or ``<div id="app">`` (Vue),
    serving as a basic white-screen detector.

    Returns:
        ``True`` if a mount-point element was found.

    Raises:
        AssertionError: If the page is unreachable or no mount point exists.
    """
    resp = requests.get(FRONTEND_URL, timeout=5)
    assert resp.status_code == 200, (
        f"Frontend GET returned {resp.status_code}"
    )
    html = resp.text
    has_mount = '<div id="root"' in html or '<div id="app"' in html
    assert has_mount, (
        "Frontend HTML lacks #root or #app mount point – possible white screen"
    )
    return True


# ─── Report collection & generation (ATB-07) ─────────────────────────

_smoke_results: List[Dict[str, Any]] = []


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Collect per-test results for the smoke-test report (ATB-07).

    Stores the outcome, duration and failure reason of every test whose
    file path contains ``smoke`` into the module-level ``_smoke_results``
    list for later consumption by ``pytest_sessionfinish``.
    """
    outcome = yield
    report = outcome.get_result()

    if "smoke" in str(item.fspath):
        _smoke_results.append(
            {
                "nodeid": item.nodeid,
                "outcome": report.outcome,
                "duration": getattr(report, "duration", 0.0),
                "longrepr": str(report.longrepr) if report.longrepr else None,
            }
        )


def pytest_sessionfinish(session, exitstatus):  # noqa: ARG001
    """Write ``smoke-test-report.md`` at the end of the pytest session.

    Implements ATB-07 – the report includes test name, result, duration and
    failure reason in a Markdown table.
    """
    if not _smoke_results:
        return

    report_path = os.path.join(
        os.environ.get("PROJECT_ROOT", os.getcwd()),
        "smoke-test-report.md",
    )

    lines: List[str] = [
        "# Smoke Test Report",
        "",
        "| # | Test | Result | Duration (s) | Failure Reason |",
        "| - | ---- | ------ | ------------ | -------------- |",
    ]

    for idx, entry in enumerate(_smoke_results, 1):
        reason = entry["longrepr"] or ""
        if len(reason) > 200:
            reason = reason[:200] + "…"
        lines.append(
            f"| {idx} | {entry['nodeid']} | {entry['outcome']} | "
            f"{entry['duration']:.3f} | {reason} |"
        )

    lines.append("")
    with open(report_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print(f"\n[Smoke Test Report] written to {report_path}")