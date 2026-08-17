CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ams_db;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64),
    platform_admin TINYINT NOT NULL DEFAULT 0,
    username VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(128) NOT NULL,
    real_name VARCHAR(64) NOT NULL,
    email VARCHAR(128),
    phone VARCHAR(32),
    avatar VARCHAR(512),
    status TINYINT DEFAULT 1,
    dept_id BIGINT,
    token_version INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_username (username),
    INDEX idx_sys_user_tenant_status (tenant_id, status, id),
    INDEX idx_dept_id (dept_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_user_tenant (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_user_tenant_user_tenant (user_id, tenant_id),
    INDEX idx_sys_user_tenant_tenant_status_user (tenant_id, status, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64),
    role_name VARCHAR(64) NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    description VARCHAR(512),
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_sys_role_tenant_role_code (tenant_id, role_code),
    INDEX idx_role_code (role_code),
    INDEX idx_sys_role_tenant_status (tenant_id, status, deleted, id)
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

CREATE TABLE IF NOT EXISTS sys_role_data_scope (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    role_id BIGINT NOT NULL,
    data_scope VARCHAR(32) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_role_data_scope_tenant_role (tenant_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_role_dept_tenant_role_dept (tenant_id, role_id, dept_id),
    INDEX idx_sys_role_dept_tenant_dept (tenant_id, dept_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64),
    dept_name VARCHAR(128) NOT NULL,
    dept_code VARCHAR(64),
    parent_id BIGINT DEFAULT 0,
    sort_order INT DEFAULT 0,
    leader VARCHAR(64),
    phone VARCHAR(32),
    status TINYINT DEFAULT 1,
    version INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_sys_dept_tenant_dept_code (tenant_id, dept_code),
    INDEX idx_parent_id (parent_id),
    INDEX idx_sys_dept_tenant_parent (tenant_id, parent_id, status, id)
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

CREATE TABLE IF NOT EXISTS sys_role_permission (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_permission (role_id, permission_id),
    INDEX idx_role_permission_role (role_id),
    INDEX idx_role_permission_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_alert (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    alert_type VARCHAR(64),
    alert_level VARCHAR(32),
    title VARCHAR(256),
    content TEXT,
    status VARCHAR(32) DEFAULT 'OPEN',
    `read` TINYINT DEFAULT 0,
    read_at DATETIME,
    read_by BIGINT,
    closed_at DATETIME,
    closed_by BIGINT,
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_system_alert_tenant_status (tenant_id, status),
    INDEX idx_system_alert_tenant_read (tenant_id, `read`),
    INDEX idx_system_alert_level (tenant_id, alert_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_webhook_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    config_name VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    target_url VARCHAR(1024) NOT NULL,
    enabled TINYINT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'ENABLED',
    signing_strategy VARCHAR(32) DEFAULT 'NONE',
    secret_configured TINYINT DEFAULT 0,
    signature_configured TINYINT DEFAULT 0,
    masked_header_names TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_system_webhook_config_tenant_status (tenant_id, status),
    INDEX idx_system_webhook_config_tenant_event (tenant_id, event_type)
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
    location_id BIGINT,
    location_lat DECIMAL(10,7),
    location_lng DECIMAL(10,7),
    rfid_tag VARCHAR(128) UNIQUE,
    is_important TINYINT DEFAULT 0,
    description TEXT,
    remark TEXT,
    create_by BIGINT,
    version INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_asset_tenant_asset_no (tenant_id, asset_no),
    INDEX idx_asset_no (asset_no),
    INDEX idx_asset_tenant (tenant_id),
    INDEX idx_asset_tenant_dept (tenant_id, dept_id),
    INDEX idx_asset_tenant_user (tenant_id, user_id),
    INDEX idx_asset_category (category_id),
    INDEX idx_asset_location_coordinates (location_lat, location_lng)
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
    version INT NOT NULL DEFAULT 0,
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
    version INT NOT NULL DEFAULT 0,
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
    version INT NOT NULL DEFAULT 0,
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
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    cancellation_reason VARCHAR(128),
    cancelled_at DATETIME,
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
    INDEX idx_inventory_task_tenant_created (tenant_id, create_time, id),
    INDEX idx_inventory_task_tenant_status_created (tenant_id, status, create_time, id),
    INDEX idx_inventory_task_no (task_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_detail (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT NOT NULL,
    rfid_tag VARCHAR(128),
    status VARCHAR(32),
    expected_location VARCHAR(256),
    actual_location VARCHAR(256),
    scan_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory_detail_tenant (tenant_id),
    INDEX idx_inventory_detail_task (task_id),
    UNIQUE KEY uk_inventory_detail_tenant_task_asset (tenant_id, task_id, asset_id),
    INDEX idx_inventory_detail_task_tenant_asset (task_id, tenant_id, asset_id),
    INDEX idx_inventory_detail_tenant_task_scan (tenant_id, task_id, scan_time),
    INDEX idx_inventory_detail_tenant_task_status_scan (tenant_id, task_id, status, scan_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_detail_archive (
    archive_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT NULL,
    rfid_tag VARCHAR(128),
    status VARCHAR(32),
    expected_location VARCHAR(256),
    actual_location VARCHAR(256),
    scan_time DATETIME,
    remark VARCHAR(512),
    create_time DATETIME,
    archive_reason VARCHAR(128) NOT NULL,
    archived_at DATETIME NOT NULL,
    UNIQUE KEY uk_inventory_detail_archive_origin (tenant_id, task_id, id),
    INDEX idx_inventory_detail_archive_task (tenant_id, task_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS login_attempt_bucket (
    bucket_type VARCHAR(16) NOT NULL,
    bucket_hash CHAR(64) NOT NULL,
    failure_count INT NOT NULL DEFAULT 0,
    reserved_count INT NOT NULL DEFAULT 0,
    next_allowed_at DATETIME NOT NULL,
    last_failure_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bucket_type, bucket_hash),
    INDEX idx_login_attempt_bucket_expires (expires_at),
    INDEX idx_login_attempt_bucket_next_allowed (next_allowed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempt_reservation (
    reservation_id CHAR(36) NOT NULL,
    account_hash CHAR(64) NOT NULL,
    client_ip_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reservation_id),
    INDEX idx_login_attempt_reservation_expires (expires_at),
    INDEX idx_login_attempt_reservation_account_ip (account_hash, client_ip_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempt_bucket_guard (
    id TINYINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO login_attempt_bucket_guard (id) VALUES (1);

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
    version INT NOT NULL DEFAULT 0,
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
    version INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_compensation_tenant (tenant_id),
    INDEX idx_compensation_no (compensation_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS disposal_application (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    application_no VARCHAR(128) NOT NULL,
    asset_id BIGINT NOT NULL,
    disposal_type VARCHAR(32) NOT NULL,
    target_dept_id BIGINT,
    target_user_id BIGINT,
    target_location VARCHAR(256),
    reason VARCHAR(512) NOT NULL,
    applicant_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    version INT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_disposal_tenant_no (tenant_id, application_no),
    INDEX idx_disposal_tenant_status (tenant_id, status, id),
    INDEX idx_disposal_tenant_asset (tenant_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_process (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    process_no VARCHAR(128) NOT NULL UNIQUE,
    process_type VARCHAR(64) NOT NULL,
    business_id BIGINT NOT NULL,
    business_data TEXT,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    cancellation_reason VARCHAR(128),
    cancelled_at DATETIME,
    current_step INT DEFAULT 1,
    applicant_id BIGINT NOT NULL,
    version INT NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS approval_node_assignment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    process_id BIGINT NOT NULL,
    step_no INT NOT NULL,
    assignee_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    workflow_definition_id BIGINT NOT NULL,
    workflow_version INT NOT NULL,
    decided_at DATETIME NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_approval_assignment_tenant_process_step_assignee (tenant_id, process_id, step_no, assignee_id),
    INDEX idx_approval_assignment_tenant_assignee_status (tenant_id, assignee_id, status, process_id, step_no),
    INDEX idx_approval_assignment_tenant_process_step (tenant_id, process_id, step_no, status)
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

-- 设计器草稿与已发布 workflow_definition projection 分离；新库 baseline 已含该表，
-- staged V2_116 使用 IF NOT EXISTS 保持新库链不会重复建表。
CREATE TABLE IF NOT EXISTS workflow_definition_draft (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    business_type VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    definition_json LONGTEXT NOT NULL,
    revision INT NOT NULL DEFAULT 0,
    updated_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_workflow_draft_tenant_business (tenant_id, business_type),
    INDEX idx_workflow_draft_tenant_updated (tenant_id, update_time)
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

-- 不创建默认部门、用户或角色。租户、成员关系和初始 tenant-admin 必须经受控 bootstrap 或平台管理员开通。

INSERT INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('系统集成查询', 'system:integration:query', '系统集成配置查询权限', 1),
    ('系统集成编辑', 'system:integration:edit', '系统集成配置编辑权限', 1),
    ('系统集成删除', 'system:integration:delete', '系统集成配置删除权限', 1),
    ('系统集成校验', 'system:integration:test', '系统集成配置校验权限', 1)
ON DUPLICATE KEY UPDATE
    permission_name = VALUES(permission_name),
    description = VALUES(description),
    status = VALUES(status);

-- 动作权限仅登记到权限库存；不为任何角色自动创建绑定。
INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('资产查询', 'asset:query', '资产查询动作权限', 1),
    ('资产新建', 'asset:create', '资产新建动作权限', 1),
    ('资产更新', 'asset:update', '资产更新动作权限', 1),
    ('资产审批', 'asset:approve', '资产审批动作权限', 1),
    ('资产删除', 'asset:delete', '资产删除动作权限', 1),
    ('资产分类查询', 'asset:category:query', '平台全局资产分类查询动作权限', 1),
    ('退役查询', 'retirement:query', '退役查询动作权限', 1),
    ('退役新建', 'retirement:create', '退役新建动作权限', 1),
    ('退役更新', 'retirement:update', '退役更新动作权限', 1),
    ('退役审批', 'retirement:approve', '退役审批动作权限', 1),
    ('退役删除', 'retirement:delete', '退役删除动作权限', 1),
    ('赔偿查询', 'compensation:query', '赔偿查询动作权限', 1),
    ('赔偿新建', 'compensation:create', '赔偿新建动作权限', 1),
    ('赔偿更新', 'compensation:update', '赔偿更新动作权限', 1),
    ('赔偿审批', 'compensation:approve', '赔偿审批动作权限', 1),
    ('赔偿删除', 'compensation:delete', '赔偿删除动作权限', 1),
    ('处置查询', 'disposal:query', '处置查询动作权限', 1),
    ('处置新建', 'disposal:create', '处置新建动作权限', 1),
    ('处置更新', 'disposal:update', '处置更新动作权限', 1),
    ('处置审批', 'disposal:approve', '处置审批动作权限', 1),
    ('处置删除', 'disposal:delete', '处置删除动作权限', 1),
    ('工单查询', 'workorder:query', '工单查询动作权限', 1),
    ('工单新建', 'workorder:create', '工单新建动作权限', 1),
    ('工单更新', 'workorder:update', '工单更新动作权限', 1),
    ('工单删除', 'workorder:delete', '工单删除动作权限', 1),
    ('工单提交', 'workorder:submit', '工单提交动作权限', 1),
    ('工单审批', 'workorder:approve', '工单审批动作权限', 1),
    ('工单执行', 'workorder:execute', '工单执行动作权限', 1),
    ('工单取消', 'workorder:cancel', '工单取消动作权限', 1),
    ('审批查询', 'approval:query', '审批查询动作权限', 1),
    ('审批创建', 'approval:create', '审批创建动作权限', 1),
    ('审批处理', 'approval:approve', '审批处理动作权限', 1),
    ('维护查询', 'maintenance:query', '维护查询动作权限', 1),
    ('维护新建', 'maintenance:create', '维护新建动作权限', 1),
    ('维护更新', 'maintenance:update', '维护更新动作权限', 1),
    ('维护删除', 'maintenance:delete', '维护删除动作权限', 1),
    ('闲置资产查询', 'idleasset:query', '闲置资产查询动作权限', 1),
    ('闲置资产发布', 'idleasset:create', '闲置资产发布动作权限', 1),
    ('闲置资产更新', 'idleasset:update', '闲置资产更新动作权限', 1),
    ('闲置资产删除', 'idleasset:delete', '闲置资产删除动作权限', 1),
    ('闲置资产认领', 'idleasset:claim', '闲置资产认领动作权限', 1),
    ('盘点查询', 'inventory:query', '盘点任务及明细查询动作权限', 1),
    ('盘点新建', 'inventory:create', '盘点任务新建动作权限', 1),
    ('盘点状态更新', 'inventory:update', '盘点任务状态更新动作权限', 1),
    ('盘点扫描', 'inventory:scan', '盘点扫描录入动作权限', 1),
    ('用户查询', 'user:query', '用户查询动作权限', 1),
    ('用户新建', 'user:create', '用户新建动作权限', 1),
    ('用户更新', 'user:update', '用户更新动作权限', 1),
    ('用户重置密码', 'user:reset-password', '用户重置密码动作权限', 1),
    ('用户删除', 'user:delete', '用户删除动作权限', 1),
    ('角色查询', 'role:query', '角色查询动作权限', 1),
    ('角色新建', 'role:create', '角色新建动作权限', 1),
    ('角色更新', 'role:update', '角色更新动作权限', 1),
    ('角色删除', 'role:delete', '角色删除动作权限', 1),
    ('部门查询', 'dept:query', '部门查询动作权限', 1),
    ('部门新建', 'dept:create', '部门新建动作权限', 1),
    ('部门更新', 'dept:update', '部门更新动作权限', 1),
    ('部门删除', 'dept:delete', '部门删除动作权限', 1),
    ('供应商查询', 'vendor:vendor:query', '平台全局供应商查询动作权限', 1),
    ('位置查询', 'location:query', '平台全局位置查询动作权限', 1);

-- Workbench platform menu entry
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status)
VALUES
    (310, '资产运营中枢', 185, 1, 'C', 'dashboard:query', 'shield-check', 1, 1),
    (311, '资产运营中枢查询', 310, 1, 'F', 'dashboard:query', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

UPDATE sys_menu
SET path = CASE id
    WHEN 310 THEN 'fixed-assets/workbench'
    ELSE path
END,
query_param = CASE id
    WHEN 310 THEN 'menu=home'
    ELSE query_param
END,
component = CASE id
    WHEN 310 THEN 'workspace-preview/WorkspacePreviewPage'
    ELSE component
END
WHERE id = 310;
