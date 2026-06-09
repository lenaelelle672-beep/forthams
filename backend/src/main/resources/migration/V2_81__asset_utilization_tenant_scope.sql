-- Scope asset usage logs and utilization snapshots by tenant.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_usage_log ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_usage_log' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_utilization_snapshot ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_utilization_snapshot' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE asset_usage_log l
JOIN asset a ON a.id = l.asset_id
SET l.tenant_id = a.tenant_id
WHERE l.tenant_id IN ('', '0', '1', 'default', 'T001')
   OR l.tenant_id IS NULL;

UPDATE asset_utilization_snapshot s
JOIN asset a ON a.id = s.asset_id
SET s.tenant_id = a.tenant_id
WHERE s.tenant_id IN ('', '0', '1', 'default', 'T001')
   OR s.tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) > 0,
    'ALTER TABLE asset_utilization_snapshot DROP INDEX uk_aus_asset_period',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_utilization_snapshot' AND index_name = 'uk_aus_asset_period');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_usage_log ADD INDEX idx_aul_tenant_asset_date (tenant_id, asset_id, usage_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_usage_log' AND index_name = 'idx_aul_tenant_asset_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_usage_log ADD INDEX idx_aul_tenant_user_date (tenant_id, user_id, usage_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_usage_log' AND index_name = 'idx_aul_tenant_user_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_utilization_snapshot ADD UNIQUE KEY uk_aus_tenant_asset_period (tenant_id, asset_id, period_type, period_start)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_utilization_snapshot' AND index_name = 'uk_aus_tenant_asset_period');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_utilization_snapshot ADD INDEX idx_aus_tenant_period (tenant_id, period_type, period_start)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_utilization_snapshot' AND index_name = 'idx_aus_tenant_period');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
