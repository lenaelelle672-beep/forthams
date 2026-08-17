package com.ams.migration;

import com.ams.service.TenantAdminPermissionPackage;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class TenantAdminPermissionPackageMigrationTest {

    @Test
    void migrationsRegisterEveryControlledTenantAdminPermissionWithoutRoleBinding() throws IOException {
        String businessPermissionMigration = readMigration("V2_113__tenant_admin_business_permission_package.sql");
        String passwordResetPermissionMigration = readMigration("V2_114__security_workflow_concurrency.sql");
        String permissionInventoryMigrations = businessPermissionMigration + passwordResetPermissionMigration;

        for (String permissionCode : TenantAdminPermissionPackage.permissionCodes()) {
            assertThat(permissionInventoryMigrations).contains("'" + permissionCode + "'");
        }
        assertThat(businessPermissionMigration)
                .contains("INSERT IGNORE INTO sys_permission")
                .doesNotContain("sys_role_permission")
                .doesNotContain("'system:flow:query'", "'workflow:designer:edit'",
                        "'workflow:designer:publish'", "'workflow:designer:rollback'");
        assertThat(passwordResetPermissionMigration)
                .contains("'user:reset-password'")
                .doesNotContain("sys_role_permission");
        assertThat(TenantAdminPermissionPackage.permissionCodes())
                .doesNotContain("system:flow:query")
                .noneMatch(permission -> permission.startsWith("workflow:designer:"));
    }

    private String readMigration(String filename) throws IOException {
        ClassPathResource resource = new ClassPathResource("migration/" + filename);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
