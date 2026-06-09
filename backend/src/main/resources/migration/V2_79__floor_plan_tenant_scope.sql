-- Scope floor plans and asset placements by tenant.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE floor_plan ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'floor_plan' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE floor_plan_asset ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'floor_plan_asset' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE floor_plan
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

UPDATE floor_plan_asset
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE floor_plan ADD INDEX idx_fp_tenant_deleted (tenant_id, deleted)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'floor_plan' AND index_name = 'idx_fp_tenant_deleted');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE floor_plan_asset ADD INDEX idx_fpa_tenant_plan (tenant_id, plan_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'floor_plan_asset' AND index_name = 'idx_fpa_tenant_plan');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
