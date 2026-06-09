-- Scope purchase orders and purchase order items by tenant.

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE purchase_order ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE purchase_order_item ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order_item' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE purchase_order
SET tenant_id = 'dept:1'
WHERE tenant_id IN ('', '0', '1', 'default', 'T001')
   OR tenant_id IS NULL;

UPDATE purchase_order_item poi
JOIN purchase_order po ON po.id = poi.order_id
SET poi.tenant_id = po.tenant_id
WHERE poi.tenant_id IN ('', '0', '1', 'default', 'T001')
   OR poi.tenant_id IS NULL;

SET @sql = (SELECT IF(COUNT(*) > 0,
    'ALTER TABLE purchase_order DROP INDEX order_no',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order' AND index_name = 'order_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE purchase_order ADD UNIQUE KEY uk_po_tenant_order_no (tenant_id, order_no)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order' AND index_name = 'uk_po_tenant_order_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE purchase_order ADD INDEX idx_po_tenant_status (tenant_id, status)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order' AND index_name = 'idx_po_tenant_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE purchase_order ADD INDEX idx_po_tenant_vendor (tenant_id, vendor_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order' AND index_name = 'idx_po_tenant_vendor');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE purchase_order_item ADD INDEX idx_poi_tenant_order (tenant_id, order_id)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'purchase_order_item' AND index_name = 'idx_poi_tenant_order');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
