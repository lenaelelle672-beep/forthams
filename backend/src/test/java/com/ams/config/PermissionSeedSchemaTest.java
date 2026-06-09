package com.ams.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PermissionSeedSchemaTest {

    @Test
    void shouldSeedAbcPermissionsInSchemaSnapshot() throws Exception {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));

        assertTrue(schema.contains("'abc:query'"), "schema.sql should seed abc:query");
        assertTrue(schema.contains("'abc:reclassify'"), "schema.sql should seed abc:reclassify");
        assertTrue(schema.contains("(1, 300)"), "SUPER_ADMIN should be bound to ABC parent menu");
        assertTrue(schema.contains("(1, 301)"), "SUPER_ADMIN should be bound to abc:query menu");
        assertTrue(schema.contains("(1, 302)"), "SUPER_ADMIN should be bound to abc:reclassify menu");
    }

    @Test
    void shouldAlignWorkflowMenuSeedWithDesktopRoutesAndPermissions() throws Exception {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));

        assertTrue(schema.contains("'workflows', 'workflow/WorkflowCenterPage', 'C', 'workflow:definition:query'"),
                "workflow menu should point to the desktop /workflows route and query permission");
        assertTrue(schema.contains("'workflow:definition:edit'"),
                "workflow edit permission should be seeded for write endpoints");
        assertTrue(schema.contains("path = VALUES(path)"),
                "workflow menu upsert should repair old path values");
        assertTrue(schema.contains("perms = VALUES(perms)"),
                "workflow menu upsert should repair old permission values");
    }

    @Test
    void auditSchemaInitializerShouldNotOverwriteWorkflowMenuWithLegacySeed() throws Exception {
        String initializer = Files.readString(Path.of("src/main/java/com/ams/config/AuditSchemaInitializer.java"));

        assertTrue(initializer.contains("'workflows', 'workflow/WorkflowCenterPage', 'C', 'workflow:definition:query'"),
                "runtime initializer should preserve the desktop /workflows route and controller query permission");
        assertFalse(initializer.contains("'workflow-definition', 'system/workflow/index', 'C', 'workflow:definition:list'"),
                "runtime initializer must not overwrite fixed workflow menu metadata with the legacy seed");
    }

    @Test
    void shouldProvideWorkflowMenuAlignmentMigrationForExistingDatabases() throws Exception {
        String migration = Files.readString(Path.of("src/main/resources/migration/V2_73__workflow_menu_alignment.sql"));

        assertTrue(migration.contains("path = 'workflows'"),
                "migration should repair workflow menu path for existing databases");
        assertTrue(migration.contains("component = 'workflow/WorkflowCenterPage'"),
                "migration should repair workflow menu component for existing databases");
        assertTrue(migration.contains("perms = 'workflow:definition:query'"),
                "migration should align workflow parent permission with controller query permission");
        assertTrue(migration.contains("'workflow:definition:edit'"),
                "migration should ensure workflow edit permission exists");
    }

    @Test
    void shouldProvideDesktopMenuRouteMetadataForDynamicMenus() throws Exception {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));
        String migration = Files.readString(Path.of("src/main/resources/migration/V2_74__desktop_menu_route_metadata.sql"));

        assertTrue(schema.contains("WHEN 2 THEN 'system/users'"),
                "schema should align system user menu path with desktop route");
        assertTrue(schema.contains("WHEN 101 THEN 'assets'"),
                "schema should align asset ledger menu path with desktop route");
        assertTrue(schema.contains("WHEN 144 THEN 'disposals'"),
                "schema should align disposal menu path with desktop route");
        assertTrue(schema.contains("WHEN 300 THEN 'inventory/abc-classification'"),
                "schema should align ABC menu path with desktop route");
        assertTrue(migration.contains("V2_74__desktop_menu_route_metadata"),
                "migration should document the desktop menu metadata repair");
        assertTrue(migration.contains("WHEN 2 THEN 'system/users'"),
                "migration should repair existing system menu paths");
        assertTrue(migration.contains("WHEN 101 THEN 'assets'"),
                "migration should repair existing asset menu paths");
        assertTrue(migration.contains("WHEN 144 THEN 'disposals'"),
                "migration should repair existing disposal menu paths");
        assertTrue(migration.contains("WHEN 300 THEN 'inventory/abc-classification'"),
                "migration should repair existing ABC menu paths");
    }

    @Test
    void shouldKeepHistoricalFlywayMigrationsStableAndPatchForward() throws Exception {
        String v236 = Files.readString(Path.of("src/main/resources/migration/V2_36__asset_parent_child.sql"));
        String v258 = Files.readString(Path.of("src/main/resources/migration/V2_58__inspection_template_and_record.sql"));
        String v269 = Files.readString(Path.of("src/main/resources/migration/V2_69__asset_detail_support_tables.sql"));

        assertTrue(v236.contains("tenant_id BIGINT NOT NULL"),
                "already released V2_36 should stay checksum-compatible");
        assertTrue(v236.contains("sort_order INT DEFAULT 0"),
                "asset parent/child shape changes should be patched forward, not edited into V2_36");
        assertTrue(v236.contains("deleted_at TIMESTAMP NULL DEFAULT NULL"),
                "already released V2_36 should keep its historical soft-delete column");
        assertTrue(v258.contains("tenant_id BIGINT NOT NULL"),
                "already released V2_58 should stay checksum-compatible");

        assertTrue(v269.contains("ALTER TABLE asset_parent_child ADD COLUMN quantity"),
                "V2_69 should patch existing old asset_parent_child tables with entity fields");
        assertTrue(v269.contains("ALTER TABLE asset_parent_child ADD COLUMN create_time"),
                "V2_69 should add the entity create_time field for existing tables");
        assertTrue(v269.contains("ALTER TABLE asset_parent_child ADD COLUMN deleted"),
                "V2_69 should add the entity deleted field for existing tables");
        assertTrue(v269.contains("ALTER TABLE asset_parent_child MODIFY COLUMN tenant_id VARCHAR(64)"),
                "V2_69 should migrate old BIGINT tenant ids to the canonical string tenant id shape");
        assertTrue(v269.contains("ALTER TABLE asset_parent_child DROP INDEX uk_relation"),
                "V2_69 should replace the old uniqueness index when it lacks tenant_id");
        assertTrue(v269.contains("ADD UNIQUE KEY uk_relation (tenant_id, parent_asset_id, child_asset_id, deleted)"),
                "V2_69 should recreate the tenant-aware active relation uniqueness rule");
    }

    @Test
    void schemaSnapshotShouldContainVendorPortalColumns() throws Exception {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));

        assertTrue(schema.contains("bank_account VARCHAR(50)"),
                "schema.sql should include vendor portal bank account column for fresh installs");
        assertTrue(schema.contains("tax_id VARCHAR(50)"),
                "schema.sql should include vendor portal tax id column for fresh installs");
        assertTrue(schema.contains("password VARCHAR(200)"),
                "schema.sql should include vendor portal password column for fresh installs");
        assertTrue(schema.contains("portal_enabled TINYINT DEFAULT 0"),
                "schema.sql should include vendor portal enable flag for fresh installs");
    }

    @Test
    void currentMenusQueryShouldNotReturnHiddenMenuEntries() throws Exception {
        String mapper = Files.readString(Path.of("src/main/java/com/ams/mapper/SysMenuMapper.java"));

        assertTrue(mapper.contains("AND m.visible = 1"),
                "/menus/current should filter hidden menu entries before frontend dynamic rendering");
    }

    @Test
    void shouldProvideAbcPermissionMigrationForExistingDatabases() throws Exception {
        Path migrationPath;
        try (var files = Files.list(Path.of("src/main/resources/migration"))) {
            migrationPath = files
                    .filter(path -> path.getFileName().toString().matches("V\\d+_\\d+__abc_permissions\\.sql"))
                    .max(Comparator.comparing(path -> path.getFileName().toString()))
                    .orElseThrow(() -> new AssertionError("ABC permission migration should exist"));
        }
        String migration = Files.readString(migrationPath);

        assertTrue(migration.contains("'abc:query'"), "migration should seed abc:query");
        assertTrue(migration.contains("'abc:reclassify'"), "migration should seed abc:reclassify");
        assertTrue(migration.contains("(1, 300)"), "migration should bind SUPER_ADMIN to ABC parent menu");
        assertTrue(migration.contains("(1, 301)"), "migration should bind SUPER_ADMIN to abc:query menu");
        assertTrue(migration.contains("(1, 302)"), "migration should bind SUPER_ADMIN to abc:reclassify menu");
    }
}
