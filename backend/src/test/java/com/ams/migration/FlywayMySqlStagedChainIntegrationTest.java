package com.ams.migration;

import com.ams.service.TenantAdminPermissionPackage;
import com.ams.service.TenantAdminPermissionPackageService;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 仅由显式 isolated-only 开关在一次性本地 MySQL 中运行。
 * staged baseline 与增量迁移使用 MySQL information_schema/PREPARE，H2 无法等价执行该链。
 * 常规单元测试不得连接数据库，也不得以此测试指向已部署环境。
 */
@EnabledIfSystemProperty(named = "flyway.mysql.it", matches = "isolated-only")
class FlywayMySqlStagedChainIntegrationTest {

    private static final Set<String> INVENTORY_AND_GLOBAL_MASTER_DATA_PERMISSION_CODES = Set.of(
            "inventory:query",
            "inventory:create",
            "inventory:update",
            "inventory:scan",
            "asset:category:query",
            "vendor:vendor:query",
            "location:query");

    @Test
    void stagedChainKeepsFreshBaselineCompleteAndAddsRevisionAfterV2116() throws Exception {
        Path stagedDir = Path.of(requiredProperty("flyway.mysql.stagedDir"));
        assertThat(Files.isRegularFile(stagedDir.resolve("MANIFEST.tsv"))).isTrue();
        assertThat(Files.isRegularFile(stagedDir.resolve("V0_1__menu_prerequisite_schema.sql"))).isTrue();
        assertThat(Files.isRegularFile(stagedDir.resolve("V1_0__baseline_schema.sql"))).isTrue();

        String username = requiredProperty("flyway.mysql.username");
        String password = System.getProperty("flyway.mysql.password", "");
        String freshUrl = requireIsolatedUrl(requiredProperty("flyway.mysql.freshUrl"));
        String upgradeUrl = requireIsolatedUrl(requiredProperty("flyway.mysql.upgradeUrl"));
        String location = "filesystem:" + stagedDir.toAbsolutePath();

        // schema.sql 是经受控 staged chain 作为 V1_0 执行的 MySQL baseline。先停在该点，
        // 才能验证库存没有借助后续 V2 migration 补齐。
        Flyway freshBaseline = configured(freshUrl, username, password, location, "1.0");
        assertThat(freshBaseline.migrate().migrationsExecuted).isGreaterThan(0);
        assertFreshBaseline(freshUrl, username, password);

        Flyway fresh = configured(freshUrl, username, password, location, null);
        assertThat(fresh.migrate().migrationsExecuted).isGreaterThan(0);
        assertThat(fresh.validateWithResult().validationSuccessful).isTrue();
        assertRequiredVersionsAndObjects(freshUrl, username, password);

        assertRevisionMigrationFromV2116(upgradeUrl, username, password);
    }

    private Flyway configured(String url, String username, String password, String location, String target) {
        FluentConfiguration configuration = Flyway.configure()
                .dataSource(url, username, password)
                .locations(location)
                .baselineOnMigrate(false);
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private void assertRequiredVersionsAndObjects(String url, String username, String password) throws SQLException {
        assertThat(successCount(url, username, password, "2.112")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.113")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.114")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.115")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.116")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.117")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.118")).isEqualTo(1);
        assertThat(successCount(url, username, password, "2.119")).isEqualTo(1);
        try (Connection connection = DriverManager.getConnection(url, username, password);
             ResultSet resultSet = connection.createStatement().executeQuery("""
                     SELECT COUNT(*)
                     FROM information_schema.tables
                     WHERE table_schema = DATABASE()
                        AND table_name IN ('sys_user_tenant', 'sys_role_data_scope', 'sys_role_dept', 'approval_node_assignment')
                      """)) {
            resultSet.next();
            assertThat(resultSet.getInt(1)).isEqualTo(4);
        }
        assertInformationSchemaCount(url, username, password, """
                SELECT COUNT(DISTINCT index_name)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = 'asset'
                  AND index_name IN ('idx_asset_tenant_dept', 'idx_asset_tenant_user')
                """, 2);
        assertInformationSchemaCount(url, username, password, """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND (table_name, column_name) IN (
                      ('sys_user', 'tenant_id'),
                      ('sys_user', 'platform_admin'),
                      ('sys_dept', 'tenant_id'),
                      ('sys_role', 'tenant_id')
                  )
                """, 4);
        assertInformationSchemaCount(url, username, password, """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND (table_name, column_name) IN (
                      ('sys_user', 'token_version'),
                      ('asset', 'version'),
                      ('approval_process', 'version'),
                      ('disposal_application', 'version'))
                """, 4);
        assertPermissionInventory(url, username, password, requiredFreshPermissionCodes());
    }

    private void assertFreshBaseline(String url, String username, String password) throws SQLException {
        assertPermissionInventory(url, username, password, requiredFreshPermissionCodes());
        assertRevisionColumn(url, username, password);
        insertDraft(url, username, password, "T_BASELINE", "ASSET_TRANSFER", "baseline draft");
        assertThat(readDraftRevision(url, username, password, "T_BASELINE", "ASSET_TRANSFER")).isZero();
        assertThat(updateDraftRevision(url, username, password, "T_BASELINE", "ASSET_TRANSFER", 1)).isEqualTo(1);
        assertThat(readDraftRevision(url, username, password, "T_BASELINE", "ASSET_TRANSFER")).isEqualTo(1);
        assertTenantAdminPackageBindsExplicitly(url, username, password);
    }

    private void assertRevisionMigrationFromV2116(String url, String username, String password) throws Exception {
        Path incrementalDir = Files.createTempDirectory("forthams-v2116-draft-revision-");
        try {
            copyMigration(incrementalDir, "V2_116__workflow_definition_draft.sql");
            String location = "filesystem:" + incrementalDir.toAbsolutePath();
            Flyway v2116 = configured(url, username, password, location, null);
            assertThat(v2116.migrate().migrationsExecuted).isEqualTo(1);
            assertThat(successCount(url, username, password, "2.116")).isEqualTo(1);
            assertInformationSchemaCount(url, username, password, """
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = 'workflow_definition_draft'
                      AND column_name = 'revision'
                    """, 0);

            insertDraft(url, username, password, "T_UPGRADE", "ASSET_TRANSFER", "pre-revision draft");
            copyMigration(incrementalDir, "V2_119__workflow_definition_draft_revision.sql");
            Flyway v2119 = configured(url, username, password, location, null);
            assertThat(v2119.migrate().migrationsExecuted).isEqualTo(1);
            assertThat(successCount(url, username, password, "2.119")).isEqualTo(1);

            assertRevisionColumn(url, username, password);
            assertThat(readDraftRevision(url, username, password, "T_UPGRADE", "ASSET_TRANSFER")).isZero();
            assertThat(updateDraftRevision(url, username, password, "T_UPGRADE", "ASSET_TRANSFER", 2)).isEqualTo(1);
            assertThat(readDraftRevision(url, username, password, "T_UPGRADE", "ASSET_TRANSFER")).isEqualTo(2);
            insertDraft(url, username, password, "T_UPGRADE", "WORK_ORDER", "post-revision draft");
            assertThat(readDraftRevision(url, username, password, "T_UPGRADE", "WORK_ORDER")).isZero();
        } finally {
            Files.deleteIfExists(incrementalDir.resolve("V2_119__workflow_definition_draft_revision.sql"));
            Files.deleteIfExists(incrementalDir.resolve("V2_116__workflow_definition_draft.sql"));
            Files.deleteIfExists(incrementalDir);
        }
    }

    private void assertTenantAdminPackageBindsExplicitly(String url, String username, String password) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(url, username, password);
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        String tenantId = "T_BASELINE";
        jdbcTemplate.update("""
                INSERT INTO sys_role (tenant_id, role_name, role_code, status)
                VALUES (?, ?, ?, ?)
                """, tenantId, "Baseline Tenant Admin", "TENANT_ADMIN", 1);
        Long roleId = jdbcTemplate.queryForObject("""
                SELECT id FROM sys_role WHERE tenant_id = ? AND role_code = ?
                """, Long.class, tenantId, "TENANT_ADMIN");
        assertThat(roleId).isNotNull();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_role_permission WHERE role_id = ?",
                Integer.class, roleId)).isZero();

        TenantAdminPermissionPackageService permissionPackageService =
                new TenantAdminPermissionPackageService(jdbcTemplate);
        new TransactionTemplate(new DataSourceTransactionManager(dataSource)).executeWithoutResult(
                status -> permissionPackageService.bindToRole(tenantId, roleId));

        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sys_role_permission WHERE role_id = ?",
                Integer.class, roleId)).isEqualTo(TenantAdminPermissionPackage.permissionCodes().size());
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM sys_role_permission rp
                INNER JOIN sys_permission p ON p.id = rp.permission_id
                WHERE rp.role_id = ?
                  AND p.permission_code IN (
                      'inventory:query', 'inventory:create', 'inventory:update', 'inventory:scan',
                      'asset:category:query', 'vendor:vendor:query', 'location:query')
                """, Integer.class, roleId)).isZero();
    }

    private Set<String> requiredFreshPermissionCodes() {
        Set<String> permissionCodes = new LinkedHashSet<>(TenantAdminPermissionPackage.permissionCodes());
        permissionCodes.addAll(INVENTORY_AND_GLOBAL_MASTER_DATA_PERMISSION_CODES);
        return permissionCodes;
    }

    private void copyMigration(Path targetDirectory, String migrationName) throws IOException {
        try (var input = new ClassPathResource("migration/" + migrationName).getInputStream()) {
            Files.copy(input, targetDirectory.resolve(migrationName));
        }
    }

    private void assertRevisionColumn(String url, String username, String password) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             ResultSet resultSet = connection.createStatement().executeQuery("""
                     SELECT is_nullable, column_default
                     FROM information_schema.columns
                     WHERE table_schema = DATABASE()
                       AND table_name = 'workflow_definition_draft'
                       AND column_name = 'revision'
                     """)) {
            assertThat(resultSet.next()).isTrue();
            assertThat(resultSet.getString("is_nullable")).isEqualTo("NO");
            assertThat(resultSet.getString("column_default")).isEqualTo("0");
        }
    }

    private void insertDraft(String url, String username, String password, String tenantId,
                             String businessType, String name) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             var statement = connection.prepareStatement("""
                     INSERT INTO workflow_definition_draft (tenant_id, business_type, name, definition_json)
                     VALUES (?, ?, ?, ?)
                     """)) {
            statement.setString(1, tenantId);
            statement.setString(2, businessType);
            statement.setString(3, name);
            statement.setString(4, "{}");
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
    }

    private int readDraftRevision(String url, String username, String password, String tenantId,
                                  String businessType) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             var statement = connection.prepareStatement("""
                     SELECT revision
                     FROM workflow_definition_draft
                     WHERE tenant_id = ? AND business_type = ?
                     """)) {
            statement.setString(1, tenantId);
            statement.setString(2, businessType);
            try (ResultSet resultSet = statement.executeQuery()) {
                assertThat(resultSet.next()).isTrue();
                return resultSet.getInt(1);
            }
        }
    }

    private int updateDraftRevision(String url, String username, String password, String tenantId,
                                    String businessType, int revision) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             var statement = connection.prepareStatement("""
                     UPDATE workflow_definition_draft
                     SET revision = ?
                     WHERE tenant_id = ? AND business_type = ?
                     """)) {
            statement.setInt(1, revision);
            statement.setString(2, tenantId);
            statement.setString(3, businessType);
            return statement.executeUpdate();
        }
    }

    private void assertInformationSchemaCount(String url, String username, String password, String sql, int expected)
            throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             ResultSet resultSet = connection.createStatement().executeQuery(sql)) {
            resultSet.next();
            assertThat(resultSet.getInt(1)).isEqualTo(expected);
        }
    }

    private void assertPermissionInventory(String url, String username, String password, Set<String> permissionCodes)
            throws SQLException {
        String placeholders = String.join(", ", permissionCodes.stream().map(code -> "?").toList());
        try (Connection connection = DriverManager.getConnection(url, username, password);
             var statement = connection.prepareStatement("""
                     SELECT COUNT(DISTINCT permission_code)
                     FROM sys_permission
                     WHERE permission_code IN (%s)
                     """.formatted(placeholders))) {
            int parameterIndex = 1;
            for (String permissionCode : permissionCodes) {
                statement.setString(parameterIndex++, permissionCode);
            }
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                assertThat(resultSet.getInt(1)).isEqualTo(permissionCodes.size());
            }
        }
    }

    private int successCount(String url, String username, String password, String version) throws SQLException {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             var statement = connection.prepareStatement("""
                     SELECT COUNT(*)
                     FROM flyway_schema_history
                     WHERE version = ?
                       AND success = TRUE
                     """)) {
            statement.setString(1, version);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getInt(1);
            }
        }
    }

    private String requiredProperty(String name) {
        String value = System.getProperty(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("缺少隔离 MySQL 验证参数: " + name);
        }
        return value;
    }

    private String requireIsolatedUrl(String url) {
        if (!url.startsWith("jdbc:mysql://127.0.0.1:") || !url.contains("/forthams_it_")) {
            throw new IllegalStateException("Flyway MySQL 验证仅允许一次性 loopback 隔离 schema");
        }
        return url;
    }
}
