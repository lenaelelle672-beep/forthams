import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AC-005: Verify that modified modules can be imported without throwing errors.
 *
 * These tests ensure that after refactoring or relocation, all expected public
 * classes and interfaces remain reachable on the classpath. They act as a
 * structural smoke-test — failing immediately when a class is missing or
 * relocated without updating downstream references.
 *
 * TDD: These tests will FAIL until the implementation classes are present
 * on the classpath.
 */
class ModuleImportSmokeTest {

    // -----------------------------------------------------------------
    // Tenant binding module — middleware.tenant_binding
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: TenantBindingMiddleware class can be loaded without error")
    void tenantBindingMiddleware_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("middleware.TenantBindingMiddleware"),
            "TenantBindingMiddleware should be importable from the middleware package"
        );
    }

    @Test
    @DisplayName("AC-005: require_tenant_context utility class can be loaded without error")
    void requireTenantContext_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("middleware.RequireTenantContext"),
            "RequireTenantContext utility should be importable from the middleware package"
        );
    }

    @Test
    @DisplayName("AC-005: require_tenant_context_async utility class can be loaded without error")
    void requireTenantContextAsync_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("middleware.RequireTenantContextAsync"),
            "RequireTenantContextAsync utility should be importable from the middleware package"
        );
    }

    // -----------------------------------------------------------------
    // Core domain module — core.tenant_context
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: TenantContext class can be loaded without error")
    void tenantContext_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("core.TenantContext"),
            "TenantContext should be importable from the core package"
        );
    }

    // -----------------------------------------------------------------
    // Core exceptions module — core.exceptions
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: TenantContextNotFoundException can be loaded without error")
    void tenantContextNotFoundException_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("core.exceptions.TenantContextNotFoundException"),
            "TenantContextNotFoundException should be importable from core.exceptions"
        );
    }

    @Test
    @DisplayName("AC-005: TenantIsolationViolationException can be loaded without error")
    void tenantIsolationViolationException_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("core.exceptions.TenantIsolationViolationException"),
            "TenantIsolationViolationException should be importable from core.exceptions"
        );
    }

    @Test
    @DisplayName("AC-005: CrossTenantJoinException can be loaded without error")
    void crossTenantJoinException_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("core.exceptions.CrossTenantJoinException"),
            "CrossTenantJoinException should be importable from core.exceptions"
        );
    }

    // -----------------------------------------------------------------
    // Permission hooks module — frontend hooks equivalent
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: PermissionHooks utility class can be loaded without error")
    void permissionHooks_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("frontend.permission.PermissionHooks"),
            "PermissionHooks should be importable from the frontend.permission package"
        );
    }

    // -----------------------------------------------------------------
    // Log dashboard module — frontend log dashboard equivalent
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: LogDashboard service class can be loaded without error")
    void logDashboardService_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("frontend.logDashboard.LogDashboardService"),
            "LogDashboardService should be importable from the frontend.logDashboard package"
        );
    }

    @Test
    @DisplayName("AC-005: AuditLogItem type can be loaded without error")
    void auditLogItem_canBeImported() {
        assertDoesNotThrow(
            () -> Class.forName("frontend.logDashboard.AuditLogItem"),
            "AuditLogItem should be importable from the frontend.logDashboard package"
        );
    }

    // -----------------------------------------------------------------
    // Cross-module dependency integrity check
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: All critical module classes load simultaneously without conflict")
    void allModules_loadWithoutConflict() {
        assertDoesNotThrow(() -> {
            Class<?>[] classes = new Class<?>[] {
                Class.forName("middleware.TenantBindingMiddleware"),
                Class.forName("middleware.RequireTenantContext"),
                Class.forName("middleware.RequireTenantContextAsync"),
                Class.forName("core.TenantContext"),
                Class.forName("core.exceptions.TenantContextNotFoundException"),
                Class.forName("core.exceptions.TenantIsolationViolationException"),
                Class.forName("core.exceptions.CrossTenantJoinException"),
                Class.forName("frontend.permission.PermissionHooks"),
                Class.forName("frontend.logDashboard.LogDashboardService"),
                Class.forName("frontend.logDashboard.AuditLogItem"),
            };
            assertEquals(10, classes.length, "All 10 module classes should have been loaded");
            for (Class<?> clazz : classes) {
                assertNotNull(clazz, "Loaded class must not be null");
            }
        });
    }

    // -----------------------------------------------------------------
    // Instance creation sanity (beyond mere class-loading)
    // -----------------------------------------------------------------

    @Test
    @DisplayName("AC-005: TenantBindingMiddleware can be instantiated without error")
    void tenantBindingMiddleware_canBeInstantiated() throws Exception {
        Class<?> clazz = Class.forName("middleware.TenantBindingMiddleware");
        Object instance = clazz.getDeclaredConstructor().newInstance();
        assertNotNull(instance, "TenantBindingMiddleware instance should not be null");
    }
}