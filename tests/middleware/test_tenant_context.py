"""
Tenant Context Middleware Tests

Tests for JWT tenant_id parsing and TenantContext binding.
AC-001, AC-002, AC-005 verification.

Example:
    pytest tests/middleware/test_tenant_context.py -v
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fasty import FastY


class TestTenantContextMiddleware:
    """Test suite for tenant context middleware."""

    @pytest.fixture
    def mock_tenant_context(self):
        """Create a mock TenantContext for testing."""
        with patch("middleware.jwt_tenant_parser.TenantContext") as mock:
            mock.get.return_value = None
            mock.set = MagicMock()
            mock.clear = MagicMock()
            yield mock

    @pytest.fixture
    def mock_jwt_decode(self):
        """Create a mock jwt.decode function."""
        with patch("middleware.jwt_tenant_parser.jwt.decode") as mock:
            yield mock

    @pytest.fixture
    def app(self):
        """Create a FastY app instance for testing."""
        app = FastY(title="Test App", version="1.0.0")
        
        @app.get("/test")
        async def test_endpoint():
            return {"status": "ok"}
        
        return app

    def test_valid_jwt_injects_tenant(self, mock_tenant_context, mock_jwt_decode):
        """
        AC-005: Test that valid JWT with tenant_id claim injects tenant context.
        
        Verifies:
        - JWT token with tenant_id is successfully decoded
        - TenantContext.set() is called with correct tenant_id
        """
        from middleware.jwt_tenant_parser import TenantContextMiddleware
        
        # Arrange
        mock_jwt_decode.return_value = {"tenant_id": "tenant_123", "user_id": 1}
        middleware = TenantContextMiddleware()
        request = Mock()
        request.headers = {"Authorization": "Bearer valid_token"}
        
        # Act
        middleware.process_request(request)
        
        # Assert
        mock_tenant_context.set.assert_called_once_with("tenant_123")
        mock_jwt_decode.assert_called_once()

    def test_jwt_missing_tenant_id(self, mock_tenant_context, mock_jwt_decode):
        """
        AC-005: Test that JWT without tenant_id claim raises TenantContextRequired.
        
        Verifies:
        - JWT without tenant_id raises TenantContextRequired exception
        - TenantContext.set() is NOT called
        """
        from middleware.jwt_tenant_parser import TenantContextMiddleware, TenantContextRequired
        
        # Arrange
        mock_jwt_decode.return_value = {"user_id": 1}  # No tenant_id
        middleware = TenantContextMiddleware()
        request = Mock()
        request.headers = {"Authorization": "Bearer token_without_tenant"}
        
        # Act & Assert
        with pytest.raises(TenantContextRequired):
            middleware.process_request(request)
        
        mock_tenant_context.set.assert_not_called()

    def test_forged_tenant_id_rejected(self, mock_tenant_context, mock_jwt_decode):
        """
        AC-005: Test that forged tenant_id in JWT is rejected.
        
        Verifies:
        - Invalid/expired JWT raises authentication error
        - Request is rejected before tenant context is set
        """
        from middleware.jwt_tenant_parser import TenantContextMiddleware
        
        # Arrange
        mock_jwt_decode.side_effect = Exception("Invalid signature")
        middleware = TenantContextMiddleware()
        request = Mock()
        request.headers = {"Authorization": "Bearer forged_token"}
        
        # Act & Assert
        with pytest.raises(Exception):
            middleware.process_request(request)
        
        mock_tenant_context.set.assert_not_called()

    def test_no_auth_header_returns_401(self):
        """
        AC-001: Test that request without auth header returns 401.
        
        Verifies:
        - Request without Authorization header is rejected
        - Proper error response is returned
        """
        from middleware.jwt_tenant_parser import TenantContextMiddleware, TenantContextRequired
        
        middleware = TenantContextMiddleware()
        request = Mock()
        request.headers = {}
        
        with pytest.raises(TenantContextRequired):
            middleware.process_request(request)

    def test_tenant_context_cleared_on_response(self, mock_tenant_context):
        """
        AC-001: Test that TenantContext is cleared after request completes.
        
        Verifies:
        - TenantContext.clear() is called in process_response
        """
        from middleware.jwt_tenant_parser import TenantContextMiddleware
        
        middleware = TenantContextMiddleware()
        response = Mock()
        
        middleware.process_response(response)
        
        mock_tenant_context.clear.assert_called_once()


class TestTenantAccessGuard:
    """Test suite for tenant access guard."""

    def test_tenant_a_only_sees_own_data(self):
        """
        AC-001: Test that Tenant-A user only sees their own data.
        
        Verifies:
        - Query results are filtered by current tenant_id
        - No cross-tenant data leakage occurs
        """
        from middleware.tenant_access_guard import TenantAccessGuard
        from unittest.mock import patch
        
        with patch("middleware.tenant_access_guard.TenantContext") as mock_ctx:
            mock_ctx.get.return_value = "tenant_a"
            
            guard = TenantAccessGuard()
            
            # Simulate data access
            data = [{"id": 1, "tenant_id": "tenant_a"}, {"id": 2, "tenant_id": "tenant_b"}]
            filtered = guard.filter_by_tenant(data)
            
            # Assert only tenant_a data is returned
            assert all(item["tenant_id"] == "tenant_a" for item in filtered)
            assert len(filtered) == 1

    def test_query_without_tenant_context_rejected(self):
        """
        AC-002: Test that query without tenant context is rejected.
        
        Verifies:
        - TenantContextRequired exception is raised when context is not set
        """
        from middleware.tenant_access_guard import TenantAccessGuard, TenantContextRequired
        from unittest.mock import patch
        
        with patch("middleware.tenant_access_guard.TenantContext") as mock_ctx:
            mock_ctx.get.return_value = None
            
            guard = TenantAccessGuard()
            
            with pytest.raises(TenantContextRequired):
                guard.get_current_tenant()

    def test_cross_tenant_update_blocked(self):
        """
        AC-002: Test that cross-tenant updates are blocked.
        
        Verifies:
        - Attempting to update record belonging to different tenant raises error
        """
        from middleware.tenant_access_guard import TenantAccessGuard, TenantAccessDenied
        from unittest.mock import patch
        
        with patch("middleware.tenant_access_guard.TenantContext") as mock_ctx:
            mock_ctx.get.return_value = "tenant_a"
            
            guard = TenantAccessGuard()
            
            record = {"id": 1, "tenant_id": "tenant_b"}
            
            with pytest.raises(TenantAccessDenied):
                guard.verify_tenant_access(record)

    def test_same_tenant_update_allowed(self):
        """
        AC-001: Test that updating same-tenant record is allowed.
        
        Verifies:
        - Record with matching tenant_id can be updated
        """
        from middleware.tenant_access_guard import TenantAccessGuard
        from unittest.mock import patch
        
        with patch("middleware.tenant_access_guard.TenantContext") as mock_ctx:
            mock_ctx.get.return_value = "tenant_a"
            
            guard = TenantAccessGuard()
            
            record = {"id": 1, "tenant_id": "tenant_a"}
            
            # Should not raise any exception
            guard.verify_tenant_access(record)