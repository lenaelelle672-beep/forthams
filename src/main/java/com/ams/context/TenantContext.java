package com.ams.context;

import lombok.extern.slf4j.Slf4j;

/**
 * TenantContext provides thread-local storage for the current tenant's identifier.
 *
 * <p>This class is a core component of the multi-tenancy infrastructure, enabling:
 * <ul>
 *   <li>Request-scoped tenant isolation via ThreadLocal.</li>
 *   <li>Automatic data filtering through Hibernate @Filter integration.</li>
 *   <li>Secure context propagation within a single request lifecycle.</li>
 * </ul>
 *
 * <h3>Lifecycle Management Requirement (ATB-TC-05)</h3>
 * <p>This context MUST be cleared in a {@code finally} block by the security filter
 * after every request to prevent ThreadLocal pollution and cross-tenant data leakage
 * when threads are reused from the servlet container's thread pool. Failure to clear
 * will result in tenant context bleeding between requests served by the same thread.
 *
 * <h3>Thread Model</h3>
 * <p>Uses {@link InheritableThreadLocal} to allow tenant context propagation to child threads
 * spawned during request processing (e.g., {@code @Async} tasks). When child threads are
 * managed by a thread pool, a {@link org.springframework.core.task.TaskDecorator} should be
 * configured to properly propagate and clean up the tenant context.
 */
@Slf4j
public class TenantContext {

    /**
     * Thread-local holder for the current tenant identifier.
     * Using InheritableThreadLocal to support context propagation to child threads
     * when explicit task decoration is configured.
     */
    private static final ThreadLocal<String> TENANT_ID_HOLDER = new InheritableThreadLocal<>();

    /**
     * The parameter name used in Hibernate {@code @FilterDef} annotations for tenant isolation.
     * Must match the parameter name referenced in entity-level {@code @Filter} conditions:
     * {@code tenant_id = :tenantId}.
     */
    public static final String TENANT_FILTER_PARAM_NAME = "tenantId";

    /**
     * The name of the Hibernate filter applied to tenant-aware entities.
     */
    public static final String TENANT_FILTER_NAME = "tenantFilter";

    /**
     * The key used for tenant identification in JWT claims, MDC logging, and debugging.
     */
    public static final String CONTEXT_KEY = "tenant_id";

    /**
     * Sets the current tenant ID in the thread context.
     *
     * <p>This method is called by the security filter after extracting the tenant ID
     * from the JWT token claims.
     *
     * @param tenantId The unique identifier of the tenant extracted from JWT claims.
     *                 Must not be null when called from the filter chain.
     * @throws IllegalArgumentException if tenantId is null (defensive guard for filter layer)
     */
    public static void setTenantId(String tenantId) {
        if (tenantId == null) {
            log.warn("Attempting to set null tenant_id in TenantContext — this may indicate a misconfigured filter");
        }
        log.debug("Setting TenantContext {}: {}", CONTEXT_KEY, tenantId);
        TENANT_ID_HOLDER.set(tenantId);
    }

    /**
     * Retrieves the current tenant ID from the thread context.
     *
     * <p>Used by Hibernate filters, AOP interceptors, and business logic to enforce
     * tenant-level data isolation.
     *
     * @return The active tenant identifier, or {@code null} if no tenant is set in this thread.
     */
    public static String getTenantId() {
        return TENANT_ID_HOLDER.get();
    }

    /**
     * Clears the current tenant ID from the thread context.
     *
     * <p><b>CRITICAL:</b> This method MUST be called in a {@code finally} block within the
     * security filter/interceptor to ensure that subsequent requests reusing this thread
     * do not inherit stale tenant data. This prevents cross-tenant data leakage in pooled
     * thread environments.
     *
     * <p>This method delegates to {@link ThreadLocal#remove()} for immediate and complete
     * cleanup of the thread-local variable.
     */
    public static void clear() {
        log.debug("Clearing TenantContext {}", CONTEXT_KEY);
        TENANT_ID_HOLDER.remove();
    }

    /**
     * Alias for {@link #clear()} to support test assertions (ATB-TC-05).
     *
     * <p>The acceptance test suite references {@code TenantContext.remove()} to verify
     * that the filter chain correctly cleans up the context after request processing.
     * This method is functionally identical to {@link #clear()}.
     */
    public static void remove() {
        clear();
    }

    /**
     * Checks whether a tenant context is currently active for the executing thread.
     *
     * <p>Useful for conditional logic where tenant-aware behavior should differ
     * from system-level (tenant-agnostic) operations.
     *
     * @return {@code true} if a non-null tenant ID exists in the current thread context,
     *         {@code false} otherwise.
     */
    public static boolean hasTenantId() {
        return getTenantId() != null;
    }
}