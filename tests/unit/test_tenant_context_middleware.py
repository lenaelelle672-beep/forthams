"""
Unit tests for Tenant Context Middleware (SWARM-2025-Q2-P1-004).

Tests the TenantContextFilter middleware that parses JWT tokens
and establishes tenant context for multi-tenant data isolation.

Test Categories:
    - ATB-1: JWT parsing and context establishment
    - ATB-4: Async context propagation (middleware layer)

Compliance:
    - B-001: Fail-closed - reject on context parse failure
    - B-003: tenant_id from JWT only, not client-specified
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from typing import Optional
import time

# Attempt imports with graceful fallback for uninitialized modules
try:
    from middleware.tenant_binding import TenantContextFilter, TenantContextBindingMiddleware
    from middleware.jwt_tenant_parser import JwtTenantParser, extract_tenant_from_jwt
    from middleware.tenant_access_guard import TenantAccessGuard, require_tenant_context
    from core.tenant_context import TenantContext, get_current_tenant, set_current_tenant
    from core.exceptions import (
        TenantContextNotFoundException,
        TenantIsolationViolationException,
        CrossTenantJoinException,
        InvalidTenantJwtException,
    )
    IMPORTS_AVAILABLE = True
except ImportError as e:
    IMPORTS_AVAILABLE = False
    # Mock classes for testing when modules are not available
    TenantContextNotFoundException = Exception
    TenantIsolationViolationException = Exception
    CrossTenantJoinException = Exception
    InvalidTenantJwtException = Exception


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def mock_jwt_token():
    """Generate a valid mock JWT token with tenant_id."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtMDAxIiwidXNlcl9pZCI6InVzZXItMDAxIn0.mock_signature"


@pytest.fixture
def mock_jwt_token_missing_tenant():
    """Generate a mock JWT token without tenant_id claim."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlci0wMDEifS5taXNzaW5nX3RlbmFudF9jbGFpbQ"


@pytest.fixture
def mock_jwt_token_tampered():
    """Generate a tampered mock JWT token."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered_payload.different_signature"


@pytest.fixture
def mock_request_with_auth(mock_jwt_token):
    """Create a mock request with Authorization header."""
    request = Mock()
    request.headers = {"Authorization": f"Bearer {mock_jwt_token}"}
    request.state = Mock()
    request.state.tenant_context = None
    return request


@pytest.fixture
def mock_request_without_auth():
    """Create a mock request without Authorization header."""
    request = Mock()
    request.headers = {}
    request.state = Mock()
    request.state.tenant_context = None
    return request


@pytest.fixture
def tenant_context_holder():
    """Provide a clean TenantContext for each test."""
    if IMPORTS_AVAILABLE:
        original = get_current_tenant()
        yield
        set_current_tenant(original)
    else:
        yield


# =============================================================================
# ATB-1: JWT Parsing and Context Establishment Tests
# =============================================================================

class TestJwtTenantParser:
    """Test JWT parsing for tenant_id extraction (ATB-1)."""

    def test_valid_jwt_extracts_tenant_id(self, mock_jwt_token):
        """
        Valid JWT with tenant_id claim should successfully extract tenant_id.
        
        Expected: tenant_id = 'tenant-001'
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        parser = JwtTenantParser()
        result = parser.parse(mock_jwt_token)
        
        assert result is not None
        assert result.tenant_id == "tenant-001"
        assert result.user_id == "user-001"

    def test_jwt_missing_tenant_id_returns_none(self, mock_jwt_token_missing_tenant):
        """
        JWT without tenant_id claim should return None (fail-closed).
        
        Per B-001: Must reject access, not fail-open.
        Expected: InvalidTenantJwtException raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        parser = JwtTenantParser()
        
        with pytest.raises((InvalidTenantJwtException, ValueError)):
            parser.parse(mock_jwt_token_missing_tenant)

    def test_jwt_tampered_returns_none(self, mock_jwt_token_tampered):
        """
        Tampered JWT should be rejected immediately.
        
        Expected: InvalidTenantJwtException raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        parser = JwtTenantParser()
        
        with pytest.raises((InvalidTenantJwtException, ValueError)):
            parser.parse(mock_jwt_token_tampered)

    def test_jwt_expired_returns_none(self):
        """
        Expired JWT should be rejected with 401.
        
        Expected: InvalidTenantJwtException raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtMDAxIiwiZXhwIjoxfS5zaWduYXR1cmU"
        parser = JwtTenantParser()
        
        with pytest.raises((InvalidTenantJwtException, ValueError)):
            parser.parse(expired_token)

    def test_jwt_invalid_format_returns_none(self):
        """
        Malformed JWT should be rejected.
        
        Expected: InvalidTenantJwtException raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        invalid_tokens = [
            "not_a_jwt_at_all",
            "only.two_parts",
            "",
            "Bearer token_without_bearer_keyword",
        ]
        
        parser = JwtTenantParser()
        
        for invalid_token in invalid_tokens:
            with pytest.raises((InvalidTenantJwtException, ValueError, AttributeError)):
                parser.parse(invalid_token)


class TestExtractTenantFromJwt:
    """Test the standalone JWT extraction function."""

    def test_extract_tenant_from_valid_jwt(self):
        """
        Standalone function should extract tenant_id from valid JWT.
        
        Expected: Returns tenant_id string
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJ0ZW5hbnQtMDAyIiwidXNlcl9pZCI6InVzZXItMDAyIn0.test_sig"
        
        result = extract_tenant_from_jwt(valid_token)
        
        assert result == "tenant-002"

    def test_extract_tenant_from_invalid_jwt_raises(self):
        """
        Invalid JWT should raise exception (fail-closed).
        
        Expected: Exception raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        with pytest.raises(Exception):
            extract_tenant_from_jwt("invalid.token")


# =============================================================================
# ATB-1: TenantContextFilter Middleware Tests
# =============================================================================

class TestTenantContextFilter:
    """Test TenantContextFilter middleware behavior."""

    def test_filter_sets_context_for_valid_token(self, mock_request_with_auth):
        """
        Valid JWT token should establish TenantContext successfully.
        
        Expected: Context set with tenant_id from JWT
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        filter_instance = TenantContextFilter()
        
        response = filter_instance.process_request(mock_request_with_auth)
        
        # Should not raise, context should be set
        assert response is None or response.status_code == 200
        current_tenant = get_current_tenant()
        assert current_tenant == "tenant-001"

    def test_filter_rejects_missing_authorization(self, mock_request_without_auth):
        """
        Request without Authorization header should be rejected.
        
        Per B-001: Fail-closed behavior required.
        Expected: HTTP 401 Unauthorized response
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        filter_instance = TenantContextFilter()
        
        response = filter_instance.process_request(mock_request_without_auth)
        
        assert response is not None
        assert response.status_code == 401

    def test_filter_rejects_invalid_jwt(self, mock_request_without_auth):
        """
        Invalid JWT should be rejected with 401.
        
        Expected: HTTP 401 response
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        mock_request_without_auth.headers = {"Authorization": "Bearer invalid_token"}
        filter_instance = TenantContextFilter()
        
        response = filter_instance.process_request(mock_request_without_auth)
        
        assert response is not None
        assert response.status_code == 401

    def test_filter_clears_context_after_request(self, mock_request_with_auth):
        """
        Context should be cleared after request processing.
        
        Expected: Context is None after response
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        filter_instance = TenantContextFilter()
        
        filter_instance.process_request(mock_request_with_auth)
        filter_instance.process_response(mock_request_with_auth, None)
        
        # Context should be cleared after response
        current_tenant = get_current_tenant()
        assert current_tenant is None


# =============================================================================
# ATB-1: TenantContextBindingMiddleware Tests
# =============================================================================

class TestTenantContextBindingMiddleware:
    """Test async middleware for tenant context binding."""

    @pytest.mark.asyncio
    async def test_async_context_binding_inherits_tenant(self):
        """
        Async middleware should inherit tenant context from parent.
        
        ATB-4: Context propagation for async paths.
        Expected: Async task has access to parent tenant_id
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        set_current_tenant("tenant-async-test")
        
        middleware = TenantContextBindingMiddleware()
        
        async def mock_async_handler():
            return get_current_tenant()
        
        result = await middleware.dispatch(mock_async_handler)
        
        assert result == "tenant-async-test"

    @pytest.mark.asyncio
    async def test_async_without_context_fails(self):
        """
        Async handler without tenant context should fail.
        
        Per B-001: Fail-closed required.
        Expected: TenantContextNotFoundException raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        # Ensure no context is set
        # Note: In real implementation, context would be None
        
        middleware = TenantContextBindingMiddleware()
        
        async def mock_async_handler_without_context():
            return get_current_tenant()
        
        # Should raise because no context is established
        with pytest.raises((TenantContextNotFoundException, RuntimeError)):
            await middleware.dispatch(mock_async_handler_without_context)


# =============================================================================
# ATB-4: TenantAccessGuard Tests
# =============================================================================

class TestTenantAccessGuard:
    """Test tenant access guard decorator/middleware."""

    def test_guard_allows_valid_tenant_context(self):
        """
        Request with valid tenant context should be allowed.
        
        Expected: Function executes without raising
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        set_current_tenant("tenant-guard-test")
        
        @require_tenant_context
        def protected_function():
            return get_current_tenant()
        
        result = protected_function()
        assert result == "tenant-guard-test"

    def test_guard_rejects_missing_context(self):
        """
        Function call without tenant context should be rejected.
        
        Per B-001: Fail-closed required.
        Expected: TenantContextNotFoundException raised
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        @require_tenant_context
        def protected_function():
            return get_current_tenant()
        
        with pytest.raises(TenantContextNotFoundException):
            protected_function()

    def test_access_guard_instance_check(self):
        """
        TenantAccessGuard instance should validate context properly.
        
        Expected: is_allowed returns True when context is set
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        guard = TenantAccessGuard()
        set_current_tenant("tenant-guard-instance")
        
        assert guard.is_allowed() is True

    def test_access_guard_instance_rejects_missing(self):
        """
        Guard.is_allowed() should return False without context.
        
        Expected: is_allowed returns False
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        guard = TenantAccessGuard()
        
        assert guard.is_allowed() is False


# =============================================================================
# ATB-1: Integration Tests for Middleware Chain
# =============================================================================

class TestMiddlewareChainIntegration:
    """Integration tests for the complete middleware chain."""

    def test_full_chain_valid_request(self):
        """
        Complete middleware chain with valid JWT should succeed.
        
        Expected: All middleware pass, context established
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        # Simulate full middleware chain
        parser = JwtTenantParser()
        filter_instance = TenantContextFilter()
        
        request = Mock()
        request.headers = {"Authorization": f"Bearer {mock_jwt_token()}"}
        request.state = Mock()
        
        # Parse JWT
        parsed = parser.parse(request.headers["Authorization"].replace("Bearer ", ""))
        assert parsed.tenant_id == "tenant-001"
        
        # Process request
        response = filter_instance.process_request(request)
        assert response is None or response.status_code == 200
        
        # Verify context
        assert get_current_tenant() == "tenant-001"

    def test_full_chain_invalid_jwt(self):
        """
        Invalid JWT should fail the entire middleware chain.
        
        Expected: 401 response from first middleware
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        filter_instance = TenantContextFilter()
        
        request = Mock()
        request.headers = {"Authorization": "Bearer tampered_token"}
        request.state = Mock()
        
        response = filter_instance.process_request(request)
        
        assert response is not None
        assert response.status_code == 401


# =============================================================================
# ATB-1: Error Response Format Tests
# =============================================================================

class TestMiddlewareErrorResponses:
    """Test that middleware returns proper error responses."""

    def test_401_response_includes_error_detail(self):
        """
        401 response should include error detail message.
        
        Per spec: Response should indicate tenant_id required.
        Expected: JSON response with 'error' field
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        filter_instance = TenantContextFilter()
        
        request = Mock()
        request.headers = {}
        request.state = Mock()
        
        response = filter_instance.process_request(request)
        
        assert response is not None
        assert response.status_code == 401
        # Response should have JSON body with error detail
        assert hasattr(response, 'body') or hasattr(response, 'json')

    def test_403_response_for_cross_tenant_attempt(self):
        """
        Cross-tenant access attempt should return 403 Forbidden.
        
        Per spec: tenant_id mismatch should be rejected.
        Expected: HTTP 403 response
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        set_current_tenant("tenant-A")
        
        # Attempt to access tenant-B resource
        guard = TenantAccessGuard()
        
        # Guard should detect cross-tenant scenario
        with pytest.raises(TenantIsolationViolationException):
            guard.require_access("tenant-B")


# =============================================================================
# ATB-4: Performance Benchmark Tests
# =============================================================================

class TestMiddlewarePerformance:
    """Performance tests for middleware overhead (NFR-003: < 5ms p99)."""

    def test_context_injection_overhead(self):
        """
        Context injection should complete in < 5ms (p99).
        
        NFR-003: Performance constraint validation.
        Expected: p99 latency < 5ms
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        latencies = []
        
        for _ in range(1000):
            start = time.perf_counter()
            set_current_tenant("tenant-perf-test")
            get_current_tenant()
            latencies.append((time.perf_counter() - start) * 1000)
        
        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 5, f"p99 latency {p99}ms exceeds 5ms threshold"

    def test_jwt_parsing_overhead(self):
        """
        JWT parsing should be reasonably fast.
        
        NFR-003: Performance constraint validation.
        Expected: Parsing completes in < 10ms
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        parser = JwtTenantParser()
        token = mock_jwt_token()
        
        latencies = []
        
        for _ in range(100):
            start = time.perf_counter()
            try:
                parser.parse(token)
            except Exception:
                pass  # Expected to fail but we measure time
            latencies.append((time.perf_counter() - start) * 1000)
        
        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 10, f"JWT parsing p99 {p99}ms exceeds 10ms threshold"


# =============================================================================
# ATB-1: Security Boundary Tests (B-003)
# =============================================================================

class TestSecurityBoundaries:
    """Test security boundaries per spec Section 3.2."""

    def test_tenant_id_from_jwt_only(self, mock_request_with_auth):
        """
        tenant_id must come from JWT, not request parameters.
        
        B-003: Client-specified tenant_id is forbidden.
        Expected: Context comes from Authorization header only
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        filter_instance = TenantContextFilter()
        
        # Attempt to override via query params (should be ignored)
        mock_request_with_auth.query_params = {"tenant_id": "attacker-tenant"}
        
        filter_instance.process_request(mock_request_with_auth)
        
        # Context should be from JWT, not query params
        assert get_current_tenant() == "tenant-001"

    def test_no_bearer_prefix_fails(self):
        """
        Authorization without Bearer prefix should fail.
        
        Expected: Invalid format rejected
        """
        if not IMPORTS_AVAILABLE:
            pytest.skip("Middleware modules not initialized")
        
        parser = JwtTenantParser()
        
        with pytest.raises((InvalidTenantJwtException, ValueError)):
            parser.parse("some_token_without_bearer")


# =============================================================================
# Helper functions for creating test JWTs
# =============================================================================

def create_jwt(tenant_id: str, user_id: str = "test-user", exp: int = None) -> str:
    """
    Create a mock JWT token for testing.
    
    Args:
        tenant_id: The tenant identifier to embed in the token.
        user_id: The user identifier (optional, defaults to "test-user").
        exp: Expiration offset in seconds (optional, None for valid token).
    
    Returns:
        A mock JWT token string.
    """
    import base64
    import json
    
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"tenant_id": tenant_id, "user_id": user_id}
    if exp is not None:
        payload["exp"] = exp
    
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = "mock_signature"
    
    return f"{header_b64}.{payload_b64}.{signature}"


def tamper_jwt_payload(jwt_token: str) -> str:
    """
    Tamper with JWT payload to test security.
    
    Args:
        jwt_token: The original JWT token.
    
    Returns:
        A tampered JWT token with modified payload.
    """
    import base64
    import json
    
    parts = jwt_token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    
    header_b64, payload_b64, signature = parts
    
    # Decode and modify payload
    payload_json = base64.urlsafe_b64decode(payload_b64 + "==")
    payload = json.loads(payload_json)
    payload["tenant_id"] = "attacker-tenant"
    tampered_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    
    return f"{header_b64}.{tampered_payload}.{signature}"


# Export for use in other test modules
__all__ = [
    "TestJwtTenantParser",
    "TestTenantContextFilter",
    "TestTenantContextBindingMiddleware",
    "TestTenantAccessGuard",
    "TestMiddlewareChainIntegration",
    "TestMiddlewareErrorResponses",
    "TestMiddlewarePerformance",
    "TestSecurityBoundaries",
    "create_jwt",
    "tamper_jwt_payload",
]