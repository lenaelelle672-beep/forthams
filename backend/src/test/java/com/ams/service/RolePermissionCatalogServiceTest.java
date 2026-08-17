package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.RolePermissionCatalogDTO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RolePermissionCatalogServiceTest {

    private JdbcTemplate jdbcTemplate;
    private RolePermissionCatalogService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:role_perm_" + UUID.randomUUID().toString().replace("-", "") + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        dataSource.setUsername("sa");
        dataSource.setPassword("");
        jdbcTemplate = new JdbcTemplate(dataSource);
        createSchema();
        service = new RolePermissionCatalogService(jdbcTemplate);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getCatalogShouldAggregateRolesPermissionsAndValidBindings() {
        jdbcTemplate.update("INSERT INTO sys_role(id, tenant_id, role_name, role_code, description, status, deleted) VALUES (1, 'T001', '超级管理员', 'SUPER_ADMIN', '全部权限', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_role(id, tenant_id, role_name, role_code, description, status, deleted) VALUES (2, 'T001', '审计角色', 'AUDITOR', '只读审计', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_role(id, tenant_id, role_name, role_code, description, status, deleted) VALUES (3, 'T001', '历史角色', 'LEGACY', '已删除', 0, 1)");
        jdbcTemplate.update("INSERT INTO sys_role(id, tenant_id, role_name, role_code, description, status, deleted) VALUES (4, 'T002', '外部租户角色', 'OTHER_TENANT', '隔离', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_permission(id, permission_name, permission_code, description, status, deleted) VALUES (10, '接口查询', 'system:integration:query', '接口目录', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_permission(id, permission_name, permission_code, description, status, deleted) VALUES (11, '角色权限查询', 'system:role-permission:query', '角色权限目录', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_permission(id, permission_name, permission_code, description, status, deleted) VALUES (12, '历史权限', 'legacy:deleted', '已删除', 0, 1)");
        jdbcTemplate.update("INSERT INTO sys_role_permission(role_id, permission_id) VALUES (1, 10), (1, 11), (2, 11), (2, 12), (4, 10), (99, 11)");

        RolePermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(2, catalog.getRoles().size());
        assertEquals(2, catalog.getPermissions().size());
        assertEquals(2, catalog.getSummary().getRoleCount());
        assertEquals(2, catalog.getSummary().getPermissionInventoryCount());
        assertEquals(3, catalog.getSummary().getRolePermissionBindingCount());
        assertEquals(2, catalog.getSummary().getBoundPermissionCount());
        assertEquals(0, catalog.getSummary().getUnboundPermissionCount());
        assertEquals(2, catalog.getRoles().get(0).getPermissionCount());
        assertEquals(1, catalog.getRoles().get(1).getPermissionCount());
        assertEquals("system:role-permission:query", catalog.getRoles().get(1).getPermissions().get(0).getPermissionCode());
        assertTrue(catalog.getReadonlyNotice().contains("不支持分配/编辑/删除"));
    }

    @Test
    void getCatalogShouldExposeEmptyStateAndRisksWithoutSeedWrites() {
        RolePermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(0, catalog.getRoles().size());
        assertEquals(0, catalog.getPermissions().size());
        assertEquals(0, catalog.getSummary().getRolePermissionBindingCount());
        assertEquals(0, catalog.getSummary().getRolesWithoutPermissionsCount());
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("不会自动补齐")));
    }

    @Test
    void getCatalogShouldCountUnboundInventoryAndRolesWithoutPermissions() {
        jdbcTemplate.update("INSERT INTO sys_role(id, tenant_id, role_name, role_code, description, status, deleted) VALUES (1, 'T001', '普通用户', 'USER', '默认角色', 1, 0)");
        jdbcTemplate.update("INSERT INTO sys_permission(id, permission_name, permission_code, description, status, deleted) VALUES (10, '用户查询', 'system:user:query', '用户目录', 1, 0)");

        RolePermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(1, catalog.getSummary().getRolesWithoutPermissionsCount());
        assertEquals(1, catalog.getSummary().getUnboundPermissionCount());
        assertEquals(0, catalog.getRoles().get(0).getPermissionCount());
    }

    private void createSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE sys_role(
                    id BIGINT PRIMARY KEY,
                    tenant_id VARCHAR(64),
                    role_name VARCHAR(64),
                    role_code VARCHAR(64),
                    description VARCHAR(512),
                    status TINYINT,
                    deleted TINYINT
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_permission(
                    id BIGINT PRIMARY KEY,
                    permission_name VARCHAR(128),
                    permission_code VARCHAR(128),
                    description VARCHAR(512),
                    status TINYINT,
                    deleted TINYINT
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE sys_role_permission(
                    role_id BIGINT,
                    permission_id BIGINT
                )
                """);
    }
}
