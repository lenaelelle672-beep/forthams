-- Scope asset custom field values by tenant.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sys_custom_field_value ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sys_custom_field_value' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE sys_custom_field_value v
JOIN asset a ON a.id = v.asset_id
SET v.tenant_id = a.tenant_id
WHERE v.tenant_id IN ('', '0', '1', 'default', 'T001')
   OR v.tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) > 0,
    'ALTER TABLE sys_custom_field_value DROP INDEX uk_asset_field',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sys_custom_field_value' AND index_name = 'uk_asset_field');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sys_custom_field_value ADD UNIQUE KEY uk_cfv_tenant_asset_field (tenant_id, asset_id, field_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sys_custom_field_value' AND index_name = 'uk_cfv_tenant_asset_field');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sys_custom_field_value ADD INDEX idx_cfv_tenant_asset (tenant_id, asset_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sys_custom_field_value' AND index_name = 'idx_cfv_tenant_asset');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sys_custom_field_value ADD INDEX idx_cfv_tenant_field (tenant_id, field_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sys_custom_field_value' AND index_name = 'idx_cfv_tenant_field');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
