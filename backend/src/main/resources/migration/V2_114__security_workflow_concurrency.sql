-- V2_114__security_workflow_concurrency
-- 为令牌撤销、受控处置申请和授权范围内的乐观并发条件补齐列与索引。
-- 本迁移仅增量添加缺失对象；已有库的 Flyway history/checksum 必须先经过 DBA 人工 gate。

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_user')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'token_version'),
    'ALTER TABLE sys_user ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER dept_id', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_user')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'version'),
    'ALTER TABLE sys_user ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER token_version', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sys_dept')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'version'),
    'ALTER TABLE sys_dept ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER status', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'asset')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'asset' AND column_name = 'version'),
    'ALTER TABLE asset ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER create_by', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'work_order')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'version'),
    'ALTER TABLE work_order ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER completion_note', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'retirement_application')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'retirement_application' AND column_name = 'version'),
    'ALTER TABLE retirement_application ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER total_approval_steps', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'maintenance_record')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'maintenance_record' AND column_name = 'version'),
    'ALTER TABLE maintenance_record ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER create_by', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'idle_asset_notice')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'idle_asset_notice' AND column_name = 'version'),
    'ALTER TABLE idle_asset_notice ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER create_by', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'asset_compensation')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'asset_compensation' AND column_name = 'version'),
    'ALTER TABLE asset_compensation ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER create_by', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'approval_process')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'version'),
    'ALTER TABLE approval_process ADD COLUMN version INT NOT NULL DEFAULT 0 AFTER applicant_id', 'SELECT 1'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS disposal_application (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    application_no VARCHAR(128) NOT NULL,
    asset_id BIGINT NOT NULL,
    disposal_type VARCHAR(32) NOT NULL,
    target_dept_id BIGINT NULL,
    target_user_id BIGINT NULL,
    target_location VARCHAR(256) NULL,
    reason VARCHAR(512) NOT NULL,
    applicant_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    version INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_disposal_tenant_no (tenant_id, application_no),
    KEY idx_disposal_tenant_status (tenant_id, status, id),
    KEY idx_disposal_tenant_asset (tenant_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES ('用户重置密码', 'user:reset-password', '用户重置密码动作权限', 1);
