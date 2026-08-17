package com.ams.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class InventoryScopeSecurityMigrationTest {

    @Test
    void appendOnlyMigrationMovesLegacyPendingTasksAndAddsSnapshotIntegrityIndexes() throws IOException {
        String migration = read("migration/V2_121__inventory_scope_and_shared_login_rate_limit.sql");

        assertThat(migration)
                .contains("UPDATE inventory_task")
                .contains("UPPER(TRIM(status)) = 'PENDING'")
                .contains("DEFAULT ''DRAFT''")
                .contains("uk_inventory_detail_tenant_task_asset")
                .contains("idx_inventory_detail_tenant_task_scan")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_tracker")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_tracker_guard")
                .doesNotContain("DROP TABLE");
    }

    @Test
    void freshSchemaUsesDraftAndUniqueRealAssetSnapshots() throws IOException {
        String schema = read("schema.sql");

        assertThat(schema)
                .contains("status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'")
                .contains("asset_id BIGINT NOT NULL")
                .contains("UNIQUE KEY uk_inventory_detail_tenant_task_asset (tenant_id, task_id, asset_id)")
                .contains("INDEX idx_inventory_detail_tenant_task_status_scan")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_tracker")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_tracker_guard")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_bucket")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_reservation")
                .contains("PRIMARY KEY (bucket_type, bucket_hash)");
    }

    @Test
    void appendOnlyMigrationAddsIndependentAtomicLoginBucketsWithoutChangingV2121() throws IOException {
        String migration = read("migration/V2_122__atomic_login_rate_limit_buckets.sql");
        String priorMigration = read("migration/V2_121__inventory_scope_and_shared_login_rate_limit.sql");

        assertThat(migration)
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_bucket")
                .contains("CREATE TABLE IF NOT EXISTS login_attempt_reservation")
                .contains("PRIMARY KEY (bucket_type, bucket_hash)")
                .contains("idx_login_attempt_bucket_expires")
                .contains("idx_login_attempt_reservation_expires")
                .contains("INSERT IGNORE INTO login_attempt_bucket_guard")
                .doesNotContain("DROP TABLE");
        assertThat(priorMigration).doesNotContain("login_attempt_bucket");
    }

    @Test
    void appendOnlyMigrationCancelsUntrustedInventorySnapshotsBeforeTighteningConstraints() throws IOException {
        String migration = read("migration/V2_123__cancel_untrusted_inventory_snapshots.sql");
        String prior121 = read("migration/V2_121__inventory_scope_and_shared_login_rate_limit.sql");

        assertThat(migration)
                .contains("cancellation_reason VARCHAR(128)")
                .contains("cancelled_at DATETIME")
                .contains("MISSING_TRUSTED_ASSET_SNAPSHOT")
                .contains("DUPLICATE_ASSET_SNAPSHOT")
                .contains("CREATE TABLE IF NOT EXISTS inventory_detail_archive")
                .contains("INSERT INTO inventory_detail_archive")
                .contains("DELETE FROM inventory_detail")
                .contains("asset_id IS NULL")
                .contains("MODIFY COLUMN asset_id BIGINT NOT NULL")
                .contains("uk_inventory_detail_tenant_task_asset")
                .doesNotContain("DROP TABLE")
                .doesNotContain("UPDATE asset");
        assertThat(prior121).doesNotContain("inventory_detail_archive");
        assertThat(prior121).doesNotContain("MISSING_TRUSTED_ASSET_SNAPSHOT");
    }

    @Test
    void freshSchemaKeepsCancellationColumnsAndArchiveForUntrustedSnapshots() throws IOException {
        String schema = read("schema.sql");

        assertThat(schema)
                .contains("cancellation_reason VARCHAR(128)")
                .contains("cancelled_at DATETIME")
                .contains("CREATE TABLE IF NOT EXISTS inventory_detail_archive")
                .contains("uk_inventory_detail_archive_origin");
    }

    private String read(String path) throws IOException {
        ClassPathResource resource = new ClassPathResource(path);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
