-- V2_123__cancel_untrusted_inventory_snapshots
-- 旧盘点若没有真实非空资产快照、asset_id 为 NULL、或同一任务重复关联同一资产，
-- 不得按当前资产伪造历史。先安全取消并归档原始明细，再补 NOT NULL 与唯一约束。
-- 不修改 V2_104–V2_122；本脚本对已存在的取消列/归档表/约束保持幂等。

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'cancellation_reason'),
    'ALTER TABLE inventory_task ADD COLUMN cancellation_reason VARCHAR(128) NULL AFTER status', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'cancelled_at'),
    'ALTER TABLE inventory_task ADD COLUMN cancelled_at DATETIME NULL AFTER cancellation_reason', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
    scan_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME,
    archive_reason VARCHAR(128) NOT NULL,
    archived_at DATETIME NOT NULL,
    UNIQUE KEY uk_inventory_detail_archive_origin (tenant_id, task_id, id),
    INDEX idx_inventory_detail_archive_task (tenant_id, task_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE inventory_task task
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(NULLIF(TRIM(task.cancellation_reason), ''), 'MISSING_TRUSTED_ASSET_SNAPSHOT'),
    cancelled_at = COALESCE(task.cancelled_at, CURRENT_TIMESTAMP)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
  AND (
      NOT EXISTS (
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
  );

UPDATE inventory_task task
SET status = 'CANCELLED',
    cancellation_reason = COALESCE(NULLIF(TRIM(task.cancellation_reason), ''), 'DUPLICATE_ASSET_SNAPSHOT'),
    cancelled_at = COALESCE(task.cancelled_at, CURRENT_TIMESTAMP)
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
  AND EXISTS (
      SELECT 1
      FROM inventory_detail duplicate_snapshot
      WHERE duplicate_snapshot.task_id = task.id
        AND duplicate_snapshot.tenant_id = task.tenant_id
        AND duplicate_snapshot.asset_id IS NOT NULL
      GROUP BY duplicate_snapshot.tenant_id, duplicate_snapshot.task_id, duplicate_snapshot.asset_id
      HAVING COUNT(*) > 1
  );

INSERT INTO inventory_detail_archive (
    id, task_id, tenant_id, asset_id, rfid_tag, status, expected_location, actual_location,
    scan_time, remark, create_time, archive_reason, archived_at
)
SELECT detail.id,
       detail.task_id,
       detail.tenant_id,
       detail.asset_id,
       detail.rfid_tag,
       detail.status,
       detail.expected_location,
       detail.actual_location,
       detail.scan_time,
       detail.remark,
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
      SELECT 1
      FROM inventory_detail_archive archived
      WHERE archived.tenant_id = detail.tenant_id
        AND archived.task_id = detail.task_id
        AND archived.id = detail.id
  );

DELETE FROM inventory_detail
WHERE asset_id IS NULL;

DELETE duplicate_row
FROM inventory_detail duplicate_row
INNER JOIN inventory_detail keeper
    ON keeper.tenant_id = duplicate_row.tenant_id
   AND keeper.task_id = duplicate_row.task_id
   AND keeper.asset_id = duplicate_row.asset_id
   AND keeper.id < duplicate_row.id
WHERE duplicate_row.asset_id IS NOT NULL;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_detail' AND column_name = 'asset_id' AND is_nullable = 'YES'),
    'ALTER TABLE inventory_detail MODIFY COLUMN asset_id BIGINT NOT NULL', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_detail' AND index_name = 'uk_inventory_detail_tenant_task_asset'),
    'ALTER TABLE inventory_detail ADD UNIQUE KEY uk_inventory_detail_tenant_task_asset (tenant_id, task_id, asset_id)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
