package com.ams.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class TenantDataPermissionAuthorityMigrationTest {

    @Test
    void migrationRepairsCriticalCompositeUniqueConstraintsForPreexistingTables() throws IOException {
        ClassPathResource resource = new ClassPathResource("migration/V2_112__tenant_data_permission_authority.sql");
        String migration = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        assertThat(migration)
                .contains("@user_tenant_unique_exists")
                .contains("@user_tenant_duplicate_count")
                .contains("duplicate (user_id, tenant_id)")
                .contains("candidate.indexed_columns = 'user_id,tenant_id'")
                .contains("@drop_invalid_user_tenant_unique_sql")
                .contains("ADD UNIQUE KEY uk_sys_user_tenant_user_tenant (user_id, tenant_id)")
                .contains("@role_data_scope_unique_exists")
                .contains("@role_data_scope_duplicate_count")
                .contains("candidate.indexed_columns = 'tenant_id,role_id'")
                .contains("ADD UNIQUE KEY uk_sys_role_data_scope_tenant_role (tenant_id, role_id)")
                .contains("@role_dept_unique_exists")
                .contains("@role_dept_duplicate_count")
                .contains("candidate.indexed_columns = 'tenant_id,role_id,dept_id'")
                .contains("ADD UNIQUE KEY uk_sys_role_dept_tenant_role_dept (tenant_id, role_id, dept_id)")
                .contains("@role_tenant_role_code_named_index_exists")
                .contains("candidate.indexed_columns = 'tenant_id,role_code'")
                .contains("@drop_invalid_role_tenant_role_code_unique_sql")
                .contains("@dept_tenant_code_named_index_exists")
                .contains("candidate.indexed_columns = 'tenant_id,dept_code'")
                .contains("@drop_invalid_dept_tenant_code_unique_sql")
                .contains("并非 append-only")
                .contains("经验证备份恢复");
    }
}
