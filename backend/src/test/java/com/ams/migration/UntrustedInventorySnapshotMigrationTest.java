package com.ams.migration;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.assertThat;

class UntrustedInventorySnapshotMigrationTest {

    @Test
    void cancelsUntrustedTasksArchivesOriginalDetailsAndLeavesUniqueNonNullSnapshots() throws Exception {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:untrusted_inventory_mig;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
        dataSource.setUsername("sa");
        dataSource.setPassword("");
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);

        jdbc.execute("""
                CREATE TABLE asset (
                    id BIGINT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL
                )
                """);
        jdbc.execute("""
                CREATE TABLE inventory_task (
                    id BIGINT PRIMARY KEY,
                    tenant_id VARCHAR(64) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    cancellation_reason VARCHAR(128),
                    cancelled_at TIMESTAMP
                )
                """);
        jdbc.execute("""
                CREATE TABLE inventory_detail (
                    id BIGINT PRIMARY KEY,
                    task_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT NULL,
                    rfid_tag VARCHAR(128),
                    status VARCHAR(32),
                    expected_location VARCHAR(256),
                    actual_location VARCHAR(256),
                    scan_time TIMESTAMP,
                    remark VARCHAR(512),
                    create_time TIMESTAMP
                )
                """);
        jdbc.update("INSERT INTO asset(id, tenant_id) VALUES (1, 'T001'), (2, 'T001')");
        jdbc.update("INSERT INTO inventory_task(id, tenant_id, status) VALUES (10, 'T001', 'IN_PROGRESS')");
        jdbc.update("INSERT INTO inventory_task(id, tenant_id, status) VALUES (11, 'T001', 'DRAFT')");
        jdbc.update("INSERT INTO inventory_task(id, tenant_id, status) VALUES (12, 'T001', 'COMPLETED')");
        jdbc.update("INSERT INTO inventory_detail(id, task_id, tenant_id, asset_id) VALUES (100, 10, 'T001', NULL)");
        jdbc.update("INSERT INTO inventory_detail(id, task_id, tenant_id, asset_id) VALUES (101, 11, 'T001', 1)");
        jdbc.update("INSERT INTO inventory_detail(id, task_id, tenant_id, asset_id) VALUES (102, 11, 'T001', 1)");
        jdbc.update("INSERT INTO inventory_detail(id, task_id, tenant_id, asset_id) VALUES (103, 12, 'T001', 2)");

        String migration = read("migration/V2_123__cancel_untrusted_inventory_snapshots.sql");
        assertThat(migration).contains("MISSING_TRUSTED_ASSET_SNAPSHOT", "DUPLICATE_ASSET_SNAPSHOT");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS inventory_detail_archive (
                    archive_id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    id BIGINT NOT NULL,
                    task_id BIGINT NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    asset_id BIGINT NULL,
                    rfid_tag VARCHAR(128),
                    status VARCHAR(32),
                    expected_location VARCHAR(256),
                    actual_location VARCHAR(256),
                    scan_time TIMESTAMP,
                    remark VARCHAR(512),
                    create_time TIMESTAMP,
                    archive_reason VARCHAR(128) NOT NULL,
                    archived_at TIMESTAMP NOT NULL,
                    UNIQUE KEY uk_inventory_detail_archive_origin (tenant_id, task_id, id)
                )
                """);
        jdbc.execute("""
                UPDATE inventory_task task
                SET status = 'CANCELLED',
                    cancellation_reason = COALESCE(NULLIF(TRIM(task.cancellation_reason), ''), 'MISSING_TRUSTED_ASSET_SNAPSHOT'),
                    cancelled_at = COALESCE(task.cancelled_at, CURRENT_TIMESTAMP)
                WHERE NOT EXISTS (
                          SELECT 1
                          FROM inventory_detail trusted
                          INNER JOIN asset trusted_asset
                              ON trusted_asset.id = trusted.asset_id
                             AND trusted_asset.tenant_id = trusted.tenant_id
                          WHERE trusted.task_id = task.id
                            AND trusted.tenant_id = task.tenant_id
                            AND trusted.asset_id IS NOT NULL
                      )
                   OR EXISTS (
                          SELECT 1
                          FROM inventory_detail null_snapshot
                          WHERE null_snapshot.task_id = task.id
                            AND null_snapshot.tenant_id = task.tenant_id
                            AND null_snapshot.asset_id IS NULL
                      )
                """);
        jdbc.execute("""
                UPDATE inventory_task task
                SET status = 'CANCELLED',
                    cancellation_reason = COALESCE(NULLIF(TRIM(task.cancellation_reason), ''), 'DUPLICATE_ASSET_SNAPSHOT'),
                    cancelled_at = COALESCE(task.cancelled_at, CURRENT_TIMESTAMP)
                WHERE EXISTS (
                    SELECT 1
                    FROM inventory_detail duplicate_snapshot
                    WHERE duplicate_snapshot.task_id = task.id
                      AND duplicate_snapshot.tenant_id = task.tenant_id
                      AND duplicate_snapshot.asset_id IS NOT NULL
                    GROUP BY duplicate_snapshot.tenant_id, duplicate_snapshot.task_id, duplicate_snapshot.asset_id
                    HAVING COUNT(*) > 1
                )
                """);
        jdbc.execute("""
                INSERT INTO inventory_detail_archive (
                    id, task_id, tenant_id, asset_id, rfid_tag, status, expected_location, actual_location,
                    scan_time, remark, create_time, archive_reason, archived_at
                )
                SELECT detail.id, detail.task_id, detail.tenant_id, detail.asset_id, detail.rfid_tag, detail.status,
                       detail.expected_location, detail.actual_location, detail.scan_time, detail.remark,
                       detail.create_time,
                       COALESCE(NULLIF(TRIM(task.cancellation_reason), ''), 'UNTRUSTED_INVENTORY_ASSET_SNAPSHOT'),
                       CURRENT_TIMESTAMP
                FROM inventory_detail detail
                INNER JOIN inventory_task task
                    ON task.id = detail.task_id
                   AND task.tenant_id = detail.tenant_id
                WHERE task.status = 'CANCELLED'
                  AND task.cancellation_reason IN ('MISSING_TRUSTED_ASSET_SNAPSHOT', 'DUPLICATE_ASSET_SNAPSHOT')
                  AND NOT EXISTS (
                      SELECT 1 FROM inventory_detail_archive archived
                      WHERE archived.tenant_id = detail.tenant_id
                        AND archived.task_id = detail.task_id
                        AND archived.id = detail.id
                  )
                """);
        jdbc.execute("DELETE FROM inventory_detail WHERE asset_id IS NULL");
        jdbc.execute("""
                DELETE FROM inventory_detail
                WHERE id IN (
                    SELECT id FROM (
                        SELECT duplicate_row.id
                        FROM inventory_detail duplicate_row
                        INNER JOIN inventory_detail keeper
                            ON keeper.tenant_id = duplicate_row.tenant_id
                           AND keeper.task_id = duplicate_row.task_id
                           AND keeper.asset_id = duplicate_row.asset_id
                           AND keeper.id < duplicate_row.id
                        WHERE duplicate_row.asset_id IS NOT NULL
                    ) doomed
                )
                """);

        assertThat(jdbc.queryForObject("SELECT status FROM inventory_task WHERE id = 10", String.class))
                .isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT cancellation_reason FROM inventory_task WHERE id = 10", String.class))
                .isEqualTo("MISSING_TRUSTED_ASSET_SNAPSHOT");
        assertThat(jdbc.queryForObject("SELECT status FROM inventory_task WHERE id = 11", String.class))
                .isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT cancellation_reason FROM inventory_task WHERE id = 11", String.class))
                .isEqualTo("DUPLICATE_ASSET_SNAPSHOT");
        assertThat(jdbc.queryForObject("SELECT status FROM inventory_task WHERE id = 12", String.class))
                .isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_detail_archive WHERE task_id = 10", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_detail_archive WHERE task_id = 11", Integer.class))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_detail WHERE asset_id IS NULL", Integer.class))
                .isEqualTo(0);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_detail WHERE task_id = 11", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_detail WHERE task_id = 12 AND asset_id = 2", Integer.class))
                .isEqualTo(1);
    }

    private String read(String path) throws IOException {
        ClassPathResource resource = new ClassPathResource(path);
        return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }
}
