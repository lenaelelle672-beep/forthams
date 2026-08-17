-- V2_121__inventory_scope_and_shared_login_rate_limit
-- 盘点任务改为以真实 inventory_detail 资产快照授权；迁移只追加约束/索引并将无法进入状态机的
-- 历史 PENDING 安全归并为 DRAFT。登录失败状态仅存不可逆 HMAC 指纹，供多实例原子共享。

UPDATE inventory_task
SET status = 'DRAFT'
WHERE status IS NULL OR UPPER(TRIM(status)) = 'PENDING';

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task'),
    'ALTER TABLE inventory_task MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT ''DRAFT''', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND index_name = 'idx_inventory_task_tenant_created'),
    'ALTER TABLE inventory_task ADD INDEX idx_inventory_task_tenant_created (tenant_id, create_time, id)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_task')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND index_name = 'idx_inventory_task_tenant_status_created'),
    'ALTER TABLE inventory_task ADD INDEX idx_inventory_task_tenant_status_created (tenant_id, status, create_time, id)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_detail' AND index_name = 'uk_inventory_detail_tenant_task_asset'),
    'ALTER TABLE inventory_detail ADD UNIQUE KEY uk_inventory_detail_tenant_task_asset (tenant_id, task_id, asset_id)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_detail' AND index_name = 'idx_inventory_detail_task_tenant_asset'),
    'ALTER TABLE inventory_detail ADD INDEX idx_inventory_detail_task_tenant_asset (task_id, tenant_id, asset_id)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_detail' AND index_name = 'idx_inventory_detail_tenant_task_scan'),
    'ALTER TABLE inventory_detail ADD INDEX idx_inventory_detail_tenant_task_scan (tenant_id, task_id, scan_time)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'inventory_detail')
    AND NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'inventory_detail' AND index_name = 'idx_inventory_detail_tenant_task_status_scan'),
    'ALTER TABLE inventory_detail ADD INDEX idx_inventory_detail_tenant_task_status_scan (tenant_id, task_id, status, scan_time)', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS login_attempt_tracker (
    account_hash CHAR(64) NOT NULL,
    client_ip_hash CHAR(64) NOT NULL,
    failure_count INT NOT NULL,
    next_allowed_at DATETIME NOT NULL,
    last_failure_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (account_hash, client_ip_hash),
    INDEX idx_login_attempt_tracker_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempt_tracker_guard (
    id TINYINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO login_attempt_tracker_guard (id) VALUES (1);
