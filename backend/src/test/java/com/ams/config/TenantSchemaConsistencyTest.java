package com.ams.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class TenantSchemaConsistencyTest {

    private static final Path MIGRATION_DIR = Path.of("src/main/resources/migration");
    private static final Pattern TENANT_COLUMN = Pattern.compile("^\\s*tenant_id\\s+([^,\\n]+)", Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);

    @Test
    void migrationsShouldUseStringTenantIds() throws IOException {
        try (var files = Files.list(MIGRATION_DIR)) {
            var violations = files
                    .filter(path -> path.getFileName().toString().endsWith(".sql"))
                    .filter(path -> !isLegacyTenantIdMigration(path))
                    .flatMap(path -> tenantColumnTypes(path).stream())
                    .filter(type -> !type.definition().toUpperCase().startsWith("VARCHAR(64)"))
                    .toList();

            assertThat(violations)
                    .as("tenant_id columns must accept string tenant identifiers such as dept:42")
                    .isEmpty();
        }
    }

    @Test
    void schemaShouldInitializeCanonicalDefaultTenant() throws IOException {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));

        assertThat(schema).contains("CREATE TABLE IF NOT EXISTS sys_tenant");
        assertThat(schema).contains("id VARCHAR(64) PRIMARY KEY");
        assertThat(schema).contains("VALUES ('dept:1', '默认租户', 'ENTERPRISE', 'ACTIVE', 9999, 999999)");
        assertThat(schema).contains("ON DUPLICATE KEY UPDATE");
    }

    @Test
    void canonicalTenantMigrationShouldNormalizeTenantScopedSeeds() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_70__canonical_default_tenant_id.sql"));

        assertThat(migration).contains("UPDATE sys_tenant");
        assertThat(migration).contains("UPDATE approval_record");
        assertThat(migration).contains("UPDATE notification_template");
        assertThat(migration).contains("WHERE tenant_id IN ('default', 'T001')");
    }

    @Test
    void assetParentChildMigrationShouldMatchCurrentEntityColumns() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_69__asset_detail_support_tables.sql"));

        assertThat(migration).contains("tenant_id VARCHAR(64) NOT NULL");
        assertThat(migration).contains("quantity INT DEFAULT 1");
        assertThat(migration).contains("remark VARCHAR(500)");
        assertThat(migration).contains("create_time DATETIME");
        assertThat(migration).contains("deleted TINYINT DEFAULT 0");
        assertThat(migration).contains("ALTER TABLE asset_parent_child MODIFY COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("ALTER TABLE asset_change_log ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("ALTER TABLE asset_parent_child ADD COLUMN quantity");
        assertThat(migration).contains("ALTER TABLE asset_parent_child ADD COLUMN create_time");
        assertThat(migration).contains("ALTER TABLE asset_parent_child ADD COLUMN deleted");
    }

    @Test
    void contractTenantMigrationShouldScopeInternalContractManagement() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_76__contract_tenant_scope.sql"));

        assertThat(migration).contains("ALTER TABLE contract ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("UPDATE contract");
        assertThat(migration).contains("ADD UNIQUE KEY uk_contract_tenant_no (tenant_id, contract_no)");
        assertThat(migration).contains("ADD INDEX idx_contract_tenant_end_date (tenant_id, end_date)");
        assertThat(migration).contains("ADD INDEX idx_contract_tenant_vendor (tenant_id, vendor_id)");
    }

    @Test
    void energyTenantMigrationShouldScopeRawReadingsAndSummaries() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_78__energy_meter_tenant_scope.sql"));

        assertThat(migration).contains("ALTER TABLE energy_meter ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("ALTER TABLE energy_consumption ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("UPDATE energy_meter");
        assertThat(migration).contains("UPDATE energy_consumption");
        assertThat(migration).contains("ADD INDEX idx_em_tenant_asset_date (tenant_id, asset_id, reading_date)");
        assertThat(migration).contains("ADD INDEX idx_ec_tenant_asset_period (tenant_id, asset_id, period_type, period_start)");
    }

    @Test
    void floorPlanTenantMigrationShouldScopePlansAndPlacements() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_79__floor_plan_tenant_scope.sql"));

        assertThat(migration).contains("ALTER TABLE floor_plan ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("ALTER TABLE floor_plan_asset ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("UPDATE floor_plan");
        assertThat(migration).contains("UPDATE floor_plan_asset");
        assertThat(migration).contains("ADD INDEX idx_fp_tenant_deleted (tenant_id, deleted)");
        assertThat(migration).contains("ADD INDEX idx_fpa_tenant_plan (tenant_id, plan_id)");
    }

    @Test
    void purchaseOrderTenantMigrationShouldScopeOrdersAndItems() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_80__purchase_order_tenant_scope.sql"));

        assertThat(migration).contains("ALTER TABLE purchase_order ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("ALTER TABLE purchase_order_item ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("UPDATE purchase_order");
        assertThat(migration).contains("UPDATE purchase_order_item poi");
        assertThat(migration).contains("ADD UNIQUE KEY uk_po_tenant_order_no (tenant_id, order_no)");
        assertThat(migration).contains("ADD INDEX idx_poi_tenant_order (tenant_id, order_id)");
    }

    @Test
    void utilizationTenantMigrationShouldScopeUsageLogsAndSnapshots() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_81__asset_utilization_tenant_scope.sql"));

        assertThat(migration).contains("ALTER TABLE asset_usage_log ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("ALTER TABLE asset_utilization_snapshot ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("UPDATE asset_usage_log l");
        assertThat(migration).contains("UPDATE asset_utilization_snapshot s");
        assertThat(migration).contains("ADD INDEX idx_aul_tenant_asset_date (tenant_id, asset_id, usage_date)");
        assertThat(migration).contains("ADD UNIQUE KEY uk_aus_tenant_asset_period (tenant_id, asset_id, period_type, period_start)");
    }

    @Test
    void customFieldValueTenantMigrationShouldScopeAssetValues() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_82__custom_field_value_tenant_scope.sql"));

        assertThat(migration).contains("ALTER TABLE sys_custom_field_value ADD COLUMN tenant_id VARCHAR(64)");
        assertThat(migration).contains("UPDATE sys_custom_field_value v");
        assertThat(migration).contains("DROP INDEX uk_asset_field");
        assertThat(migration).contains("ADD UNIQUE KEY uk_cfv_tenant_asset_field (tenant_id, asset_id, field_id)");
        assertThat(migration).contains("ADD INDEX idx_cfv_tenant_asset (tenant_id, asset_id)");
    }

    @Test
    void workflowDefinitionMigrationShouldCreateRuntimeDefinitionTable() throws IOException {
        String migration = Files.readString(MIGRATION_DIR.resolve("V2_83__workflow_definition_table.sql"));
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));
        String workflowDefinitionSchema = tableDefinition(schema, "workflow_definition");

        assertThat(migration).contains("CREATE TABLE IF NOT EXISTS workflow_definition");
        assertThat(migration).contains("tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1'");
        assertThat(migration).contains("business_type VARCHAR(64) NOT NULL");
        assertThat(migration).contains("definition_json LONGTEXT NOT NULL");
        assertThat(migration).contains("UNIQUE KEY uk_workflow_tenant_business (tenant_id, business_type)");
        assertThat(migration).contains("ADD INDEX idx_workflow_tenant_status (tenant_id, status)");
        assertThat(migration).contains("SET tenant_id = 'dept:1'");
        assertThat(migration).contains("ALTER TABLE workflow_definition MODIFY COLUMN definition_json LONGTEXT NOT NULL");

        assertThat(workflowDefinitionSchema).contains("CREATE TABLE IF NOT EXISTS workflow_definition");
        assertThat(workflowDefinitionSchema).contains("tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1'");
        assertThat(workflowDefinitionSchema).contains("UNIQUE KEY uk_workflow_tenant_business (tenant_id, business_type)");
        assertThat(workflowDefinitionSchema).contains("INDEX idx_workflow_tenant_status (tenant_id, status)");
    }

    @Test
    void legacyTenantIdMigrationsShouldBePatchedForwardWithoutChecksumChanges() throws IOException {
        String v236 = Files.readString(MIGRATION_DIR.resolve("V2_36__asset_parent_child.sql"));
        String v258 = Files.readString(MIGRATION_DIR.resolve("V2_58__inspection_template_and_record.sql"));
        String v269 = Files.readString(MIGRATION_DIR.resolve("V2_69__asset_detail_support_tables.sql"));

        assertThat(v236).contains("tenant_id BIGINT NOT NULL");
        assertThat(v258).contains("tenant_id BIGINT NOT NULL");
        assertThat(v269).contains("ALTER TABLE asset_parent_child MODIFY COLUMN tenant_id VARCHAR(64)");
    }

    private static java.util.List<TenantColumnType> tenantColumnTypes(Path path) {
        try {
            String content = Files.readString(path);
            Matcher matcher = TENANT_COLUMN.matcher(content);
            java.util.ArrayList<TenantColumnType> matches = new java.util.ArrayList<>();
            while (matcher.find()) {
                matches.add(new TenantColumnType(path.getFileName().toString(), matcher.group(1).trim()));
            }
            return matches;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read " + path, e);
        }
    }

    private static String tableDefinition(String schema, String tableName) {
        String marker = "CREATE TABLE IF NOT EXISTS " + tableName + " (";
        int start = schema.indexOf(marker);
        assertThat(start).as(tableName + " table should exist in schema.sql").isGreaterThanOrEqualTo(0);
        int end = schema.indexOf("\n) ENGINE=", start);
        assertThat(end).as(tableName + " table should include an ENGINE clause").isGreaterThan(start);
        return schema.substring(start, end);
    }

    private record TenantColumnType(String fileName, String definition) {
    }

    private static boolean isLegacyTenantIdMigration(Path path) {
        String fileName = path.getFileName().toString();
        return fileName.equals("V2_36__asset_parent_child.sql")
                || fileName.equals("V2_58__inspection_template_and_record.sql");
    }
}
