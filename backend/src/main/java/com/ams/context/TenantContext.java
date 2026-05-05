package com.ams.context;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;

/**
 * TenantContext provides thread-local storage for the current tenant's identifier.
 *
 * <p>This context is populated by security filters during request processing (e.g.,
 * {@code TenantFilter}) and <b>must</b> be cleared at the end of each request to prevent
 * memory leaks and cross-tenant data leakage in thread-pool environments.</p>
 *
 * <h3>Design Note</h3>
 * <p>We use standard {@link ThreadLocal} instead of {@link InheritableThreadLocal} because
 * in modern Spring Boot applications, requests are typically handled within a single thread
 * per request (Servlet model). Async processing is explicitly managed via
 * {@code TaskExecutor} decorators where context propagation must be intentionally configured
 * rather than implicitly inherited, avoiding accidental context leakage to child threads.</p>
 *
 * <h3>Usage Pattern (inside a Servlet Filter)</h3>
 * <pre>{@code
 * try {
 *     TenantContext.setTenantId(tenantIdFromJwt);
 *     chain.doFilter(request, response);
 * } finally {
 *     TenantContext.remove();   // absolute cleanup
 * }
 * }</pre>
 *
 * @see ThreadLocal
 */
public final class TenantContext {

    private static final Logger log = LoggerFactory.getLogger(TenantContext.class);

    /**
     * Thread-local holder for the current tenant identifier.
     * Stored as {@code String} to accommodate both VARCHAR and stringified BIGINT identifiers.
     */
    private static final ThreadLocal<String> TENANT_ID_HOLDER = new ThreadLocal<>();

    /**
     * Private constructor — utility class must not be instantiated.
     */
    private TenantContext() {
        throw new UnsupportedOperationException("TenantContext is a utility class and cannot be instantiated");
    }

    /**
     * Sets the tenant ID for the current request thread.
     *
     * <p>If the provided value is {@code null} or blank, the call is silently ignored
     * and a warning is logged. This defensive behaviour prevents accidental context
     * corruption from malformed tokens.</p>
     *
     * @param tenantId the unique identifier of the tenant (e.g. "T001"); must not be null or blank
     */
    public static void setTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("Attempted to set a null or blank tenant ID — ignoring");
            return;
        }
        TENANT_ID_HOLDER.set(tenantId.trim());
    }

    /**
     * Retrieves the tenant ID associated with the current thread.
     *
     * @return the tenant ID, or {@code null} if no tenant context has been set for this thread
     */
    public static String getTenantId() {
        return TENANT_ID_HOLDER.get();
    }

    /**
     * Retrieves the current tenant ID and rejects execution if tenant context is missing.
     *
     * @return the non-blank tenant ID bound to this thread
     * @throws AccessDeniedException when no tenant context is present
     */
    public static String requireTenantId() {
        String tenantId = TENANT_ID_HOLDER.get();
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("tenant_context_missing action=requireTenantId");
            throw new AccessDeniedException("Missing tenant identifier");
        }
        return tenantId;
    }

    /**
     * Checks whether a non-null tenant ID is currently bound to this thread.
     *
     * @return {@code true} if a tenant context is present, {@code false} otherwise
     */
    public static boolean hasTenantId() {
        return TENANT_ID_HOLDER.get() != null;
    }

    /**
     * Removes (clears) the tenant ID from the current thread's thread-local storage.
     *
     * <p><b>Must</b> be called in a {@code finally} block after every request to prevent
     * memory leaks and context cross-contamination when application-server threads are
     * reused. This is verified by ATB-TC-05.</p>
     */
    public static void remove() {
        TENANT_ID_HOLDER.remove();
    }

    /**
     * Alias for {@link #remove()} — provided for semantic clarity in filter code
     * that prefers the "clear context" naming convention.
     *
     * <p>Both {@code clear()} and {@code remove()} are functionally identical and
     * guarantee complete removal of the thread-local value.</p>
     */
    public static void clear() {
        remove();
    }
}
