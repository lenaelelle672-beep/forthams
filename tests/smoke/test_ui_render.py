"""
SWARM-P3-009 Smoke Test – Frontend UI Rendering Verification (ATB-06).

Ensures the built frontend serves correctly, renders DOM content (no white
screen), and produces no fatal JavaScript console errors on initial page load.
"""

import re
from typing import List, Tuple

import pytest
from playwright.sync_api import ConsoleMessage, Page, sync_playwright

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FRONTEND_URL: str = "http://localhost:3000"
PAGE_LOAD_TIMEOUT: int = 30_000  # milliseconds

# Fatal console-error patterns per ATB-06 specification.
FATAL_ERROR_PATTERNS: List[str] = [
    r"Uncaught SyntaxError",
    r"Uncaught TypeError",
    r"Cannot read propert(?:y|ies) of (?:null|undefined)",
    r"(?:React|Vue).*?(?:render|hydrate)",
    r"hydration mismatch",
]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def browser():
    """Launch a headless Chromium browser scoped to the test module.

    Yields:
        A Playwright Browser instance that is automatically closed after all
        tests in this module finish execution.
    """
    with sync_playwright() as pw:
        launched = pw.chromium.launch(headless=True)
        yield launched
        launched.close()


@pytest.fixture(scope="module")
def context(browser):
    """Create a fresh BrowserContext with a standard desktop viewport.

    Args:
        browser: Module-scoped headless Chromium browser.

    Yields:
        A Playwright BrowserContext closed automatically after all module
        tests complete.
    """
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    yield ctx
    ctx.close()


@pytest.fixture
def page(context) -> Tuple[Page, List[ConsoleMessage]]:
    """Provide a new Page for each test case and collect console messages.

    The page is automatically closed after each test regardless of outcome.
    Error-level console messages are accumulated in the returned list so that
    tests can assert the absence of fatal JS errors.

    Args:
        context: Module-scoped BrowserContext.

    Yields:
        A tuple ``(page, console_errors)`` where *console_errors* is a list
        that accumulates error-level ``ConsoleMessage`` objects emitted by the
        browser during the test.
    """
    pg = context.new_page()
    console_errors: List[ConsoleMessage] = []
    pg.on(
        "console",
        lambda msg: console_errors.append(msg) if msg.type == "error" else None,
    )
    yield pg, console_errors
    pg.close()


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------
def _collect_fatal_errors(errors: List[ConsoleMessage]) -> List[str]:
    """Return texts of console errors that match any fatal pattern.

    Args:
        errors: Collected error-level console messages from the browser.

    Returns:
        A list of error-text strings that matched at least one of the
        ``FATAL_ERROR_PATTERNS``.
    """
    fatal: List[str] = []
    for err in errors:
        text = err.text
        if any(re.search(pat, text, re.IGNORECASE) for pat in FATAL_ERROR_PATTERNS):
            fatal.append(text)
    return fatal


def _navigate_to_frontend(pg: Page) -> None:
    """Navigate the page to the frontend URL and wait for network idle.

    Args:
        pg: Playwright Page instance to navigate.

    Raises:
        AssertionError: If the server is unreachable or returns a non-200
            HTTP status code.
    """
    response = pg.goto(FRONTEND_URL, wait_until="networkidle",
                       timeout=PAGE_LOAD_TIMEOUT)
    assert response is not None, (
        f"No HTTP response received from {FRONTEND_URL} – "
        "frontend server may not be running"
    )
    assert response.status == 200, (
        f"Expected HTTP 200 from {FRONTEND_URL}, got {response.status}"
    )


# ---------------------------------------------------------------------------
# Test Cases – ATB-06: Frontend Page White-Screen Check
# ---------------------------------------------------------------------------
class TestUIRender:
    """ATB-06 – Verify the frontend page renders DOM content without white
    screen and is free of fatal JavaScript console errors."""

    def test_page_loads_with_http_200(self, page):
        """Navigate to the frontend and assert an HTTP 200 response.

        This implicitly verifies that the frontend dev server (or static
        server) is running and reachable on localhost:3000.
        """
        pg, _console_errors = page
        _navigate_to_frontend(pg)

    def test_body_contains_dom_children(self, page):
        """Assert ``<body>`` has at least one non-trivial DOM child node.

        Per ATB-06, the SPA root container (e.g. ``<div id="root">``) must
        have child elements, proving that the JavaScript bundle executed and
        the framework hydrated correctly – ruling out a white screen.
        """
        pg, _console_errors = page
        _navigate_to_frontend(pg)

        # Step 1 – <body> innerHTML must not be empty.
        body_html = pg.locator("body").inner_html().strip()
        assert len(body_html) > 0, (
            "White screen detected: <body> innerHTML is empty"
        )

        # Step 2 – SPA root mount node (#root or #app) must have children.
        root_mounted = False
        for selector in ("#root", "#app"):
            root = pg.locator(selector)
            if root.count() > 0:
                inner = root.inner_html().strip()
                if len(inner) > 0:
                    root_mounted = True
                    break

        assert root_mounted, (
            "White screen detected: SPA root container (#root / #app) "
            "exists but has no child elements – JS bundle may have failed to "
            "execute or hydrate"
        )

    def test_no_fatal_console_errors(self, page):
        """Assert the browser console is free of fatal errors on page load.

        Checks for ``Uncaught SyntaxError``, fatal ``TypeError`` patterns,
        and React/Vue rendering / hydration errors as specified in ATB-06.
        """
        pg, console_errors = page
        _navigate_to_frontend(pg)

        fatal = _collect_fatal_errors(console_errors)
        assert len(fatal) == 0, (
            f"Fatal console errors detected during page load: {fatal}"
        )


# ---------------------------------------------------------------------------
# Standalone runner
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    pytest.main([__file__, "-v"])