-- Scope energy raw readings by tenant and align energy summaries with explicit tenant columns.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE energy_meter ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'energy_meter' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE energy_consumption ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'energy_consumption' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE energy_meter
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

UPDATE energy_consumption
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE energy_meter ADD INDEX idx_em_tenant_asset_date (tenant_id, asset_id, reading_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'energy_meter' AND index_name = 'idx_em_tenant_asset_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE energy_meter ADD INDEX idx_em_tenant_type_date (tenant_id, meter_type, reading_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'energy_meter' AND index_name = 'idx_em_tenant_type_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE energy_consumption ADD INDEX idx_ec_tenant_asset_period (tenant_id, asset_id, period_type, period_start)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'energy_consumption' AND index_name = 'idx_ec_tenant_asset_period');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
