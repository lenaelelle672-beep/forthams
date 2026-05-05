CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ams_db;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(128) NOT NULL,
    real_name VARCHAR(64) NOT NULL,
    email VARCHAR(128),
    phone VARCHAR(32),
    avatar VARCHAR(512),
    status TINYINT DEFAULT 1,
    dept_id BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_username (username),
    INDEX idx_dept_id (dept_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(64) NOT NULL,
    role_code VARCHAR(64) NOT NULL UNIQUE,
    description VARCHAR(512),
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_user_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dept_name VARCHAR(128) NOT NULL,
    dept_code VARCHAR(64) UNIQUE,
    parent_id BIGINT DEFAULT 0,
    sort_order INT DEFAULT 0,
    leader VARCHAR(64),
    phone VARCHAR(32),
    status TINYINT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(128) NOT NULL,
    permission_code VARCHAR(128) NOT NULL UNIQUE,
    description VARCHAR(512),
    status TINYINT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(128) NOT NULL,
    category_code VARCHAR(64) UNIQUE,
    parent_id BIGINT DEFAULT 0,
    sort_order INT DEFAULT 0,
    description VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_category_code (category_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    asset_no VARCHAR(128) NOT NULL,
    asset_name VARCHAR(256) NOT NULL,
    category_id BIGINT NOT NULL,
    model VARCHAR(128),
    brand VARCHAR(128),
    supplier VARCHAR(256),
    serial_no VARCHAR(128),
    original_value DECIMAL(15,2) DEFAULT 0.00,
    current_value DECIMAL(15,2) DEFAULT 0.00,
    purchase_date DATE,
    warranty_period INT,
    depreciation_rate DECIMAL(5,2),
    status VARCHAR(32) DEFAULT 'IDLE',
    dept_id BIGINT,
    user_id BIGINT,
    location VARCHAR(256),
    rfid_tag VARCHAR(128) UNIQUE,
    is_important TINYINT DEFAULT 0,
    description TEXT,
    remark TEXT,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_asset_tenant_asset_no (tenant_id, asset_no),
    INDEX idx_asset_no (asset_no),
    INDEX idx_asset_tenant (tenant_id),
    INDEX idx_asset_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_change_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id BIGINT NOT NULL,
    change_type VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason VARCHAR(512),
    operator_id BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_change_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_order (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    work_order_no VARCHAR(128) NOT NULL,
    title VARCHAR(256),
    description TEXT,
    status VARCHAR(32) DEFAULT 'DRAFT',
    priority VARCHAR(32),
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT,
    asset_name VARCHAR(256),
    asset_code VARCHAR(128),
    reporter_id BIGINT,
    reporter_name VARCHAR(128),
    assignee_id BIGINT,
    assignee_name VARCHAR(128),
    dept_id BIGINT,
    dept_name VARCHAR(128),
    planned_start_date DATETIME,
    planned_end_date DATETIME,
    actual_start_date DATETIME,
    actual_end_date DATETIME,
    estimated_cost DECIMAL(15,2),
    actual_cost DECIMAL(15,2),
    completion_note TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_work_order_tenant_no (tenant_id, work_order_no),
    INDEX idx_work_order_tenant (tenant_id),
    INDEX idx_work_order_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing development databases may have an older work_order table. Replay
-- missing columns additively so release smoke can run against upgraded data.
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN work_order_no VARCHAR(128) NULL AFTER id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'work_order_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE work_order SET work_order_no = CONCAT('WO-LEGACY-', id) WHERE work_order_no IS NULL OR work_order_no = '';
ALTER TABLE work_order MODIFY work_order_no VARCHAR(128) NOT NULL;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' AFTER priority', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN asset_name VARCHAR(256) AFTER asset_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'asset_name');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN asset_code VARCHAR(128) AFTER asset_name', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'asset_code');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN reporter_id BIGINT AFTER asset_code', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'reporter_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN reporter_name VARCHAR(128) AFTER reporter_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'reporter_name');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN assignee_name VARCHAR(128) AFTER assignee_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'assignee_name');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN dept_id BIGINT AFTER assignee_name', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'dept_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN dept_name VARCHAR(128) AFTER dept_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'dept_name');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN planned_start_date DATETIME AFTER dept_name', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'planned_start_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN planned_end_date DATETIME AFTER planned_start_date', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'planned_end_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN actual_start_date DATETIME AFTER planned_end_date', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'actual_start_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN actual_end_date DATETIME AFTER actual_start_date', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'actual_end_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN estimated_cost DECIMAL(15,2) AFTER actual_end_date', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'estimated_cost');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN actual_cost DECIMAL(15,2) AFTER estimated_cost', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'actual_cost');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN completion_note TEXT AFTER actual_cost', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'completion_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_tenant (tenant_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_tenant');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_status (status)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD UNIQUE KEY uk_work_order_tenant_no (tenant_id, work_order_no)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'uk_work_order_tenant_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS retirement_application (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    application_no VARCHAR(128) NOT NULL,
    asset_id BIGINT NOT NULL,
    asset_name VARCHAR(256),
    asset_code VARCHAR(128),
    applicant_id BIGINT,
    applicant_name VARCHAR(128),
    dept_id BIGINT,
    dept_name VARCHAR(128),
    retirement_type VARCHAR(32),
    reason VARCHAR(512) NOT NULL,
    estimated_residual_value DECIMAL(15,2),
    status VARCHAR(32) DEFAULT 'DRAFT',
    current_approval_step INT DEFAULT 0,
    total_approval_steps INT DEFAULT 1,
    attachments TEXT,
    remark TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_retirement_tenant_no (tenant_id, application_no),
    INDEX idx_retirement_tenant_status (tenant_id, status),
    INDEX idx_retirement_asset (tenant_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS maintenance_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT NOT NULL,
    maintenance_type VARCHAR(32) NOT NULL,
    maintenance_date DATE NOT NULL,
    next_maintenance_date DATE,
    cost DECIMAL(10,2) DEFAULT 0.00,
    executor VARCHAR(128),
    content TEXT,
    result VARCHAR(32),
    remark TEXT,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_maintenance_tenant (tenant_id),
    INDEX idx_maintenance_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    task_no VARCHAR(128) NOT NULL UNIQUE,
    task_name VARCHAR(256) NOT NULL,
    inventory_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    dept_ids TEXT,
    start_date DATE,
    end_date DATE,
    total_count INT DEFAULT 0,
    scanned_count INT DEFAULT 0,
    match_count INT DEFAULT 0,
    loss_count INT DEFAULT 0,
    executor_id BIGINT,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_inventory_task_tenant (tenant_id),
    INDEX idx_inventory_task_no (task_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_detail (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT,
    rfid_tag VARCHAR(128),
    status VARCHAR(32),
    expected_location VARCHAR(256),
    actual_location VARCHAR(256),
    scan_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory_detail_tenant (tenant_id),
    INDEX idx_inventory_detail_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS idle_asset_notice (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT NOT NULL,
    idle_days INT DEFAULT 0,
    notice_date DATE,
    status VARCHAR(32) DEFAULT 'PUBLISHED',
    claimant_id BIGINT,
    claim_date DATE,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_idle_asset_tenant (tenant_id),
    INDEX idx_idle_asset_id (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_compensation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    compensation_no VARCHAR(128) NOT NULL UNIQUE,
    asset_id BIGINT NOT NULL,
    compensation_type VARCHAR(32) NOT NULL,
    compensation_amount DECIMAL(10,2) NOT NULL,
    responsible_user_id BIGINT NOT NULL,
    responsible_dept_id BIGINT,
    incident_date DATE,
    description TEXT,
    status VARCHAR(32) DEFAULT 'PENDING',
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_compensation_tenant (tenant_id),
    INDEX idx_compensation_no (compensation_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_process (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    process_no VARCHAR(128) NOT NULL UNIQUE,
    process_type VARCHAR(64) NOT NULL,
    business_id BIGINT NOT NULL,
    business_data TEXT,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    current_step INT DEFAULT 1,
    applicant_id BIGINT NOT NULL,
    apply_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_process_no (process_no),
    INDEX idx_approval_process_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing development databases may have been created before tenant isolation
-- columns were added. Keep startup/schema replays additive and tenant-safe.
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''T001'' AFTER business_data', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD INDEX idx_approval_process_tenant (tenant_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND index_name = 'idx_approval_process_tenant');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS approval_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    process_id BIGINT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    step_no INT NOT NULL,
    approver_id BIGINT NOT NULL,
    approve_result VARCHAR(32),
    approve_opinion TEXT,
    approve_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_approval_record_process (process_id),
    INDEX idx_approval_record_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_record ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''T001'' AFTER process_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_record' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_record ADD INDEX idx_approval_record_tenant (tenant_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_record' AND index_name = 'idx_approval_record_tenant');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS workflow_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_attachment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    business_type VARCHAR(64) NOT NULL,
    business_id BIGINT NOT NULL,
    file_name VARCHAR(256) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(64),
    upload_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_attachment_business (business_type, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_dept (id, dept_name, dept_code, parent_id, sort_order, leader, status)
VALUES
    (1, '总公司', 'HQ', 0, 1, '系统管理员', 1)
ON DUPLICATE KEY UPDATE dept_name = VALUES(dept_name);

INSERT INTO sys_role (id, role_name, role_code, description, sort_order, status)
VALUES
    (1, '超级管理员', 'SUPER_ADMIN', '系统超级管理员', 1, 1),
    (2, '普通用户', 'USER', '普通业务用户', 2, 1)
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

INSERT INTO sys_user (id, username, password, real_name, email, phone, status, dept_id)
VALUES
    (1, 'admin', '$2y$10$9omJ8OjfUif9yjfAI6/opOGJ66YaoaKQjDcDGtP5jv13v5I7FG1Zi', '系统管理员', 'admin@ams.com', '13800138000', 1, 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);

INSERT INTO sys_user_role (id, user_id, role_id)
VALUES
    (1, 1, 1)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
