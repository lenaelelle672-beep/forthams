-- Patch-forward workflow definition root table for existing databases.
-- V2_23 created workflow_node/workflow_edge, while the runtime service persists
-- drafts and published definitions in workflow_definition.

CREATE TABLE IF NOT EXISTS workflow_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    business_type VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    definition_json LONGTEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'DRAFT',
    version INT DEFAULT 0,
    updated_by BIGINT,
    published_by BIGINT,
    published_at DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_workflow_tenant_business (tenant_id, business_type),
    INDEX idx_workflow_tenant_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流定义';

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN business_type VARCHAR(64) NULL AFTER tenant_id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'business_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN name VARCHAR(128) NULL AFTER business_type',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'name');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN description TEXT AFTER name',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'description');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN definition_json LONGTEXT NULL AFTER description',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'definition_json');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN status VARCHAR(32) DEFAULT ''DRAFT'' AFTER definition_json',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN version INT DEFAULT 0 AFTER status',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'version');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN updated_by BIGINT AFTER version',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'updated_by');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN published_by BIGINT AFTER updated_by',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'published_by');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN published_at DATETIME AFTER published_by',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'published_at');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN create_time DATETIME DEFAULT CURRENT_TIMESTAMP AFTER published_at',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'create_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER create_time',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'update_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD COLUMN deleted TINYINT DEFAULT 0 AFTER update_time',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND column_name = 'deleted');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE workflow_definition MODIFY COLUMN tenant_id VARCHAR(64) NULL DEFAULT 'dept:1';

UPDATE workflow_definition
SET tenant_id = 'dept:1'
WHERE tenant_id IS NULL OR tenant_id = '';

UPDATE workflow_definition
SET business_type = CONCAT('CUSTOM_MIGRATED_', id)
WHERE business_type IS NULL OR business_type = '';

UPDATE workflow_definition
SET name = business_type
WHERE name IS NULL OR name = '';

UPDATE workflow_definition
SET definition_json = JSON_OBJECT(
    'id', CONCAT('WF-', business_type),
    'name', name,
    'description', COALESCE(description, ''),
    'businessType', business_type,
    'nodes', JSON_ARRAY(),
    'edges', JSON_ARRAY()
)
WHERE definition_json IS NULL OR definition_json = '';

ALTER TABLE workflow_definition MODIFY COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1';
ALTER TABLE workflow_definition MODIFY COLUMN business_type VARCHAR(64) NOT NULL;
ALTER TABLE workflow_definition MODIFY COLUMN name VARCHAR(128) NOT NULL;
ALTER TABLE workflow_definition MODIFY COLUMN definition_json LONGTEXT NOT NULL;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD UNIQUE KEY uk_workflow_tenant_business (tenant_id, business_type)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND index_name = 'uk_workflow_tenant_business');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE workflow_definition ADD INDEX idx_workflow_tenant_status (tenant_id, status)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'workflow_definition' AND index_name = 'idx_workflow_tenant_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
