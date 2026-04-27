"""
Performance tests for tenant context injection overhead.

This module validates that tenant context operations meet the NFR-003 requirement:
- Performance overhead: tenant context injection latency < 5ms (p99)

Reference: SWARM-2025-Q2-P1-004 SPEC Section 4.5 (ATB-5)
"""

import time
import pytest
from typing import List

from core.tenant_context import TenantContext


class TestTenantContextOverhead:
    """Performance benchmark tests for TenantContext operations."""

    def test_context_injection_overhead(self) -> None:
        """
        Context injection latency must be < 5ms (p99).

        This test measures the overhead of setting tenant context
        to ensure it meets NFR-003 performance requirements.
        """
        latencies: List[float] = []
        iterations: int = 1000

        for _ in range(iterations):
            start = time.perf_counter()
            TenantContext.set("tenant-001")
            latencies.append((time.perf_counter() - start) * 1000)

        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 5, f"p99 latency {p99:.3f}ms exceeds 5ms threshold"

    def test_context_clear_overhead(self) -> None:
        """
        Context clearing latency must be < 5ms (p99).

        Validates that clearing tenant context also meets
        performance requirements for request cleanup.
        """
        latencies: List[float] = []
        iterations: int = 1000

        for _ in range(iterations):
            TenantContext.set("tenant-001")
            start = time.perf_counter()
            TenantContext.clear()
            latencies.append((time.perf_counter() - start) * 1000)

        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 5, f"p99 latency {p99:.3f}ms exceeds 5ms threshold"

    def test_context_get_overhead(self) -> None:
        """
        Context retrieval latency must be < 5ms (p99).

        Validates that reading tenant context from ThreadLocal
        meets performance requirements for high-frequency access.
        """
        TenantContext.set("tenant-001")
        latencies: List[float] = []
        iterations: int = 1000

        for _ in range(iterations):
            start = time.perf_counter()
            _ = TenantContext.get()
            latencies.append((time.perf_counter() - start) * 1000)

        TenantContext.clear()

        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 5, f"p99 latency {p99:.3f}ms exceeds 5ms threshold"

    def test_context_set_get_cycle_overhead(self) -> None:
        """
        Complete set/get cycle latency must be < 5ms (p99).

        Validates the typical request lifecycle: set context,
        perform operations, get context - all operations combined.
        """
        latencies: List[float] = []
        iterations: int = 1000

        for _ in range(iterations):
            start = time.perf_counter()
            TenantContext.set("tenant-001")
            _ = TenantContext.get()
            TenantContext.clear()
            latencies.append((time.perf_counter() - start) * 1000)

        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 5, f"p99 latency {p99:.3f}ms exceeds 5ms threshold"

    def test_multiple_tenant_context_cycles(self) -> None:
        """
        Multiple tenant switching cycles must maintain < 5ms (p99).

        Tests performance under tenant switching scenarios
        common in multi-tenant batch processing.
        """
        tenants = ["tenant-001", "tenant-002", "tenant-003", "tenant-004"]
        latencies: List[float] = []
        iterations: int = 500

        for _ in range(iterations):
            start = time.perf_counter()
            for tenant_id in tenants:
                TenantContext.set(tenant_id)
                _ = TenantContext.get()
            TenantContext.clear()
            latencies.append((time.perf_counter() - start) * 1000)

        p99 = sorted(latencies)[int(len(latencies) * 0.99)]
        assert p99 < 5, f"p99 latency {p99:.3f}ms exceeds 5ms threshold"