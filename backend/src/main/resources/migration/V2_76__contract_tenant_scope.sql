-- Scope internal contract management by tenant while keeping vendor portal compatibility.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE contract ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contract' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE contract
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) > 0 AND COALESCE(SUM(CASE WHEN column_name = 'tenant_id' THEN 1 ELSE 0 END), 0) = 0,
    'ALTER TABLE contract DROP INDEX contract_no',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'contract' AND index_name = 'contract_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE contract ADD UNIQUE KEY uk_contract_tenant_no (tenant_id, contract_no)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'contract' AND index_name = 'uk_contract_tenant_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE contract ADD INDEX idx_contract_tenant_end_date (tenant_id, end_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'contract' AND index_name = 'idx_contract_tenant_end_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE contract ADD INDEX idx_contract_tenant_vendor (tenant_id, vendor_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'contract' AND index_name = 'idx_contract_tenant_vendor');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
