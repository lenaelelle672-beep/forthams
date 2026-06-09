-- Scope SAM and software license tables by tenant.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE software_license ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'software_license' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE license_assignment ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'license_assignment' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sam_compliance_scan ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sam_compliance_scan' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sam_compliance_detail ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sam_compliance_detail' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE software_license
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

UPDATE license_assignment
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

UPDATE sam_compliance_scan
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

UPDATE sam_compliance_detail
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE software_license ADD INDEX idx_license_tenant_status (tenant_id, status)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'software_license' AND index_name = 'idx_license_tenant_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE software_license ADD INDEX idx_license_tenant_expiry (tenant_id, expiry_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'software_license' AND index_name = 'idx_license_tenant_expiry');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE license_assignment ADD INDEX idx_assignment_tenant_license (tenant_id, license_id, returned_date)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'license_assignment' AND index_name = 'idx_assignment_tenant_license');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sam_compliance_scan ADD INDEX idx_sam_scan_tenant_id (tenant_id, id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sam_compliance_scan' AND index_name = 'idx_sam_scan_tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sam_compliance_detail ADD INDEX idx_sam_detail_tenant_scan (tenant_id, scan_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'sam_compliance_detail' AND index_name = 'idx_sam_detail_tenant_scan');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
