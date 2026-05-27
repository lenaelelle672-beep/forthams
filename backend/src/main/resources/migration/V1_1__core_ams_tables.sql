-- =============================================================================
-- Migration V1.1: Core AMS Tables
-- 幂等脚本：所有 CREATE 均使用 IF NOT EXISTS，可重复执行
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_no VARCHAR(128) NOT NULL,
    name VARCHAR(256),
    category_id BIGINT,
    model VARCHAR(128),
    serial_number VARCHAR(128),
    tenant_id VARCHAR(64) NOT NULL,
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

CREATE TABLE IF NOT EXISTS approval_process (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    process_no VARCHAR(128) NOT NULL,
    title VARCHAR(256),
    business_type VARCHAR(64),
    business_id BIGINT,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    applicant_id BIGINT,
    applicant_name VARCHAR(128),
    current_step INT DEFAULT 0,
    total_steps INT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_approval_tenant (tenant_id),
    INDEX idx_approval_business (business_type, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
