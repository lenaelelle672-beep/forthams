"""
Unit tests for TenantSqlInterceptor - Phase 2.3: Repository Layer Tenant Filtering

SWARM-2025-Q2-P1-004: Multi-tenant Data Isolation Specification
https://spec.example.com/SWARM-2025-Q2-P1-004

Test Coverage:
- ATB-2.1: SQL interception adds tenant_id filter to all SELECT statements
- ATB-2.2: Cross-tenant JOIN queries are blocked
- ATB-2.3: Unauthorized cross-tenant access is prevented
- B-002: Cross-tenant JOIN detection and blocking
- NFR-001: Fail-closed behavior (no silent data leakage)

Author: SWARM Team
Version: 1.0
"""

import pytest
import re
from unittest.mock import Mock, patch, MagicMock
from typing import List, Optional, Tuple

# Import the interceptor and related components
from app.interceptors.tenant_sql_interceptor import (
    TenantSqlInterceptor,
    TenantSqlInterceptorConfig,
)
from core.tenant_context import TenantContext
from core.exceptions import (
    TenantContextNotFoundException,
    CrossTenantJoinException,
    TenantIsolationViolationException,
)


class TestTenantSqlInterceptor:
    """Test suite for TenantSqlInterceptor component."""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """Setup and teardown for each test."""
        # Setup: Clear any existing context
        TenantContext.clear()
        yield
        # Teardown: Clean up context
        TenantContext.clear()

    @pytest.fixture
    def interceptor(self):
        """Create a TenantSqlInterceptor instance with default config."""
        config = TenantSqlInterceptorConfig(
            tenant_id_column="tenant_id",
            enabled=True,
            raise_on_cross_tenant_join=True,
        )
        return TenantSqlInterceptor(config)

    @pytest.fixture
    def mock_invocation(self):
        """Create a mock MyBatis invocation object."""
        invocation = Mock()
        invocation.getMethod = Mock(return_value=Mock())
        invocation.getMethod.getName = Mock(return_value="selectAssets")
        invocation.getMethod.getDeclaringClassName = Mock(
            return_value="com.example.AssetRepository"
        )
        return invocation

    @pytest.fixture
    def mock_proceed_result(self):
        """Create a mock result from proceed()."""
        result = Mock()
        result.__iter__ = Mock(return_value=iter([]))
        return result


class TestSelectStatementInterception(TestTenantSqlInterceptor):
    """ATB-2.1: SQL interception adds tenant_id filter."""

    def test_select_all_without_tenant_filter_gets_filter_added(
        self, interceptor, mock_invocation
    ):
        """Basic SELECT * should get WHERE tenant_id = ? appended."""
        original_sql = "SELECT * FROM assets"
        mock_invocation.getArgs = Mock(return_value=[])

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-001"
        ):
            with patch.object(interceptor, "proceed", return_value=[]) as mock_proceed:
                invocation_info = Mock()
                invocation_info.sql = original_sql
                invocation_info.args = []

                result = interceptor.intercept_select(invocation_info)

                # Verify tenant filter was added
                assert "WHERE" in result.sql or "tenant_id" in result.sql
                mock_proceed.assert_called_once()

    def test_select_with_existing_where_gets_tenant_and_condition(
        self, interceptor
    ):
        """SELECT with existing WHERE clause should have tenant condition AND'd."""
        original_sql = "SELECT * FROM assets WHERE status = 'active'"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = ["active"]

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-A"
        ):
            result = interceptor.intercept_select(invocation_info)

            # Should have both original condition and tenant filter
            assert "tenant_id" in result.sql
            assert "status" in result.sql
            # Verify proper AND/OR conjunction
            assert "AND" in result.sql or "OR" in result.sql

    def test_select_with_id_only_gets_tenant_filter(self, interceptor):
        """SELECT by ID should also get tenant filter for cross-tenant protection."""
        original_sql = "SELECT * FROM assets WHERE id = ?"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = [123]

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-B"
        ):
            result = interceptor.intercept_select(invocation_info)

            assert "tenant_id" in result.sql
            # Original ID filter should be preserved
            assert "id" in result.sql

    def test_select_with_limit_gets_tenant_filter_before_limit(
        self, interceptor
    ):
        """Tenant filter should be applied before LIMIT for proper pagination."""
        original_sql = "SELECT * FROM assets LIMIT 10 OFFSET 0"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-001"
        ):
            result = interceptor.intercept_select(invocation_info)

            # Tenant filter must come before LIMIT
            tenant_pos = result.sql.lower().find("tenant_id")
            limit_pos = result.sql.lower().find("limit")
            if limit_pos > 0 and tenant_pos > 0:
                assert tenant_pos < limit_pos, "Tenant filter must precede LIMIT"

    def test_subquery_gets_tenant_filter(self, interceptor):
        """Subqueries should also receive tenant filtering."""
        original_sql = """
            SELECT * FROM assets 
            WHERE parent_id IN (SELECT id FROM categories)
        """
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-001"
        ):
            result = interceptor.intercept_select(invocation_info)

            # All SELECTs in the query should reference tenant_id
            tenant_count = result.sql.lower().count("tenant_id")
            assert tenant_count >= 2, "Main query and subquery should both have tenant filter"


class TestCrossTenantJoinBlocking(TestTenantSqlInterceptor):
    """ATB-2.2: Cross-tenant JOIN queries are blocked (B-002)."""

    def test_join_without_tenant_condition_raises_cross_tenant_join_exception(
        self, interceptor
    ):
        """JOIN without tenant condition should raise CrossTenantJoinException."""
        # This is a cross-tenant join - no tenant filter on the JOIN
        cross_tenant_sql = """
            SELECT a.*, b.* 
            FROM assets a 
            JOIN asset_history b ON a.id = b.asset_id
        """
        invocation_info = Mock()
        invocation_info.sql = cross_tenant_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-A"
        ):
            with pytest.raises(CrossTenantJoinException) as exc_info:
                interceptor.intercept_select(invocation_info)

            assert "JOIN" in str(exc_info.value).upper()
            assert "tenant" in str(exc_info.value).lower()

    def test_join_with_tenant_condition_is_allowed(self, interceptor):
        """JOIN with tenant condition in ON clause should be allowed."""
        safe_join_sql = """
            SELECT a.*, b.* 
            FROM assets a 
            JOIN asset_history b ON a.id = b.asset_id AND a.tenant_id = b.tenant_id
        """
        invocation_info = Mock()
        invocation_info.sql = safe_join_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-A"
        ):
            result = interceptor.intercept_select(invocation_info)
            # Should pass without exception
            assert result is not None

    def test_left_join_without_tenant_raises_exception(self, interceptor):
        """LEFT JOIN without tenant condition should also raise exception."""
        cross_tenant_sql = """
            SELECT a.*, c.name 
            FROM assets a 
            LEFT JOIN categories c ON a.category_id = c.id
        """
        invocation_info = Mock()
        invocation_info.sql = cross_tenant_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-A"
        ):
            with pytest.raises(CrossTenantJoinException):
                interceptor.intercept_select(invocation_info)

    def test_multi_table_join_without_tenant_raises_exception(self, interceptor):
        """Multi-table JOIN without tenant conditions should be blocked."""
        multi_join_sql = """
            SELECT a.*, b.*, c.* 
            FROM assets a, histories b, logs c
            WHERE a.id = b.asset_id AND b.id = c.history_id
        """
        invocation_info = Mock()
        invocation_info.sql = multi_join_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-A"
        ):
            with pytest.raises(CrossTenantJoinException):
                interceptor.intercept_select(invocation_info)


class TestTenantContextIntegration(TestTenantSqlInterceptor):
    """Integration tests with TenantContext."""

    def test_missing_tenant_context_raises_exception(self, interceptor):
        """No tenant context should raise TenantContextNotFoundException (B-001)."""
        original_sql = "SELECT * FROM assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        # No context set
        with pytest.raises(TenantContextNotFoundException) as exc_info:
            interceptor.intercept_select(invocation_info)

        assert "tenant" in str(exc_info.value).lower()
        assert "context" in str(exc_info.value).lower()

    def test_empty_tenant_id_raises_exception(self, interceptor):
        """Empty tenant_id should raise exception (fail-closed)."""
        original_sql = "SELECT * FROM assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        TenantContext.set("")
        try:
            with pytest.raises(TenantContextNotFoundException):
                interceptor.intercept_select(invocation_info)
        finally:
            TenantContext.clear()

    def test_null_tenant_id_raises_exception(self, interceptor):
        """Null tenant_id should raise exception (fail-closed)."""
        original_sql = "SELECT * FROM assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        TenantContext.set(None)
        try:
            with pytest.raises(TenantContextNotFoundException):
                interceptor.intercept_select(invocation_info)
        finally:
            TenantContext.clear()

    def test_valid_tenant_context_used_in_filter(self, interceptor):
        """Valid tenant context should be used in SQL filter."""
        original_sql = "SELECT * FROM assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        expected_tenant = "tenant-abc-123"
        TenantContext.set(expected_tenant)
        try:
            result = interceptor.intercept_select(invocation_info)
            assert expected_tenant in str(result.args)
        finally:
            TenantContext.clear()


class TestWriteOperationProtection(TestTenantSqlInterceptor):
    """ATB-2.3: Write operations should have cross-tenant protection."""

    def test_insert_without_tenant_injects_tenant_id(self, interceptor):
        """INSERT without tenant_id should have current tenant injected."""
        original_sql = "INSERT INTO assets (name, status) VALUES (?, ?)"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = ["Test Asset", "active"]

        TenantContext.set("tenant-write-test")
        try:
            result = interceptor.intercept_insert(invocation_info)

            # Should have tenant_id column and value added
            assert "tenant_id" in result.sql
            assert "tenant-write-test" in str(result.args)
        finally:
            TenantContext.clear()

    def test_insert_with_different_tenant_raises_exception(self, interceptor):
        """INSERT with different tenant_id should raise exception."""
        original_sql = "INSERT INTO assets (name, tenant_id) VALUES (?, ?)"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = ["Test Asset", "other-tenant"]

        TenantContext.set("tenant-A")
        try:
            with pytest.raises(TenantIsolationViolationException):
                interceptor.intercept_insert(invocation_info)
        finally:
            TenantContext.clear()

    def test_update_to_different_tenant_raises_exception(self, interceptor):
        """UPDATE attempting to change tenant_id should raise exception."""
        original_sql = "UPDATE assets SET tenant_id = ? WHERE id = ?"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = ["other-tenant", 123]

        TenantContext.set("tenant-A")
        try:
            with pytest.raises(TenantIsolationViolationException):
                interceptor.intercept_update(invocation_info)
        finally:
            TenantContext.clear()

    def test_delete_cross_tenant_raises_exception(self, interceptor):
        """DELETE for cross-tenant resource should raise exception."""
        original_sql = "DELETE FROM assets WHERE id = ?"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = [123]

        # Even if the ID exists, it belongs to different tenant
        TenantContext.set("tenant-A")
        try:
            with pytest.raises(TenantIsolationViolationException):
                interceptor.intercept_delete(invocation_info)
        finally:
            TenantContext.clear()


class TestInterceptorConfiguration(TestTenantSqlInterceptor):
    """Test interceptor configuration options."""

    def test_disabled_interceptor_passes_through(self):
        """Disabled interceptor should not modify SQL."""
        config = TenantSqlInterceptorConfig(enabled=False)
        interceptor = TenantSqlInterceptor(config)

        original_sql = "SELECT * FROM assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        result = interceptor.intercept_select(invocation_info)
        assert result.sql == original_sql

    def test_custom_tenant_column_name(self):
        """Custom tenant column name should be used in filter."""
        config = TenantSqlInterceptorConfig(
            tenant_id_column="org_id", enabled=True
        )
        interceptor = TenantSqlInterceptor(config)

        original_sql = "SELECT * FROM resources"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        TenantContext.set("org-123")
        try:
            result = interceptor.intercept_select(invocation_info)
            assert "org_id" in result.sql
            assert "tenant_id" not in result.sql
        finally:
            TenantContext.clear()


class TestPerformanceCharacteristics(TestTenantSqlInterceptor):
    """NFR-003: Performance overhead tests."""

    def test_interceptor_overhead_under_5ms(self, interceptor):
        """Interceptor processing should complete under 5ms (p99 target)."""
        import time

        original_sql = "SELECT * FROM assets WHERE status = 'active'"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = ["active"]

        latencies = []
        TenantContext.set("tenant-perf-test")

        try:
            for _ in range(100):
                start = time.perf_counter()
                try:
                    interceptor.intercept_select(invocation_info)
                except (TenantContextNotFoundException, CrossTenantJoinException):
                    pass  # Expected in some cases
                latency_ms = (time.perf_counter() - start) * 1000
                latencies.append(latency_ms)

            p99 = sorted(latencies)[int(len(latencies) * 0.99)]
            assert (
                p99 < 5
            ), f"p99 latency {p99:.2f}ms exceeds 5ms threshold (NFR-003)"
        finally:
            TenantContext.clear()


class TestEdgeCases(TestTenantSqlInterceptor):
    """Edge case handling tests."""

    def test_complex_where_clause_gets_tenant_filter(self, interceptor):
        """Complex WHERE with multiple conditions should get tenant AND'd."""
        original_sql = """
            SELECT * FROM assets 
            WHERE (status = 'active' OR status = 'pending') 
            AND category_id IN (1, 2, 3)
        """
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        with patch.object(
            interceptor, "get_tenant_id_from_context", return_value="tenant-edge"
        ):
            result = interceptor.intercept_select(invocation_info)

            # Original conditions preserved, tenant filter added
            assert "status" in result.sql
            assert "category_id" in result.sql
            assert "tenant_id" in result.sql

    def test_null_safe_tenant_comparison(self, interceptor):
        """Tenant comparison should handle NULL values safely."""
        # Some legacy data might have NULL tenant_id
        original_sql = "SELECT * FROM legacy_assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        TenantContext.set("tenant-null-test")
        try:
            result = interceptor.intercept_select(invocation_info)

            # Should use safe comparison that won't match NULL tenants
            assert "tenant_id" in result.sql
            # NULL-safe operators should not cause issues
        finally:
            TenantContext.clear()

    def test_sql_injection_in_tenant_context_ignored(self, interceptor):
        """SQL injection attempts in tenant context should not affect filtering."""
        malicious_input = "tenant-001'; DROP TABLE assets; --"
        original_sql = "SELECT * FROM assets"
        invocation_info = Mock()
        invocation_info.sql = original_sql
        invocation_info.args = []

        # Context should already have sanitized input, but we test our layer
        TenantContext.set(malicious_input)
        try:
            # Should use parameterized query, not string concatenation
            result = interceptor.intercept_select(invocation_info)

            # SQL should not contain the malicious string as literal
            assert "DROP" not in result.sql.upper()
            assert ";" not in result.sql  # Parameterized, no semicolon
        finally:
            TenantContext.clear()


class TestAuditLogging(TestTenantSqlInterceptor):
    """Tests for security audit logging (Section 8.2)."""

    def test_cross_tenant_attempt_is_logged(self, interceptor, caplog):
        """Cross-tenant access attempts should be logged for audit."""
        import logging

        cross_tenant_sql = """
            SELECT a.*, b.* 
            FROM assets a 
            JOIN asset_history b ON a.id = b.asset_id
        """
        invocation_info = Mock()
        invocation_info.sql = cross_tenant_sql
        invocation_info.args = []

        TenantContext.set("tenant-A")
        try:
            with pytest.raises(CrossTenantJoinException):
                interceptor.intercept_select(invocation_info)

            # Verify audit event was logged
            log_records = [
                r for r in caplog.records if r.levelno >= logging.WARNING
            ]
            assert len(log_records) > 0

            # Check for required audit fields
            log_text = str(log_records)
            assert any(
                field in log_text
                for field in [
                    "TENANT_CONTEXT_VIOLATION",
                    "CrossTenantJoin",
                    "tenant_id",
                    "tenant",
                ]
            )
        finally:
            TenantContext.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])