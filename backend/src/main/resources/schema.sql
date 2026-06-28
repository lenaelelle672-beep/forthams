CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ams_db;

CREATE TABLE IF NOT EXISTS sys_tenant (
    id VARCHAR(64) PRIMARY KEY COMMENT '租户ID',
    name VARCHAR(100) NOT NULL COMMENT '租户名称',
    domain VARCHAR(200) COMMENT '绑定域名',
    plan VARCHAR(20) DEFAULT 'FREE' COMMENT '套餐',
    max_users INT DEFAULT 100,
    max_assets INT DEFAULT 1000,
    status VARCHAR(10) DEFAULT 'ACTIVE',
    contact_name VARCHAR(50),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    expire_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户管理';

INSERT INTO sys_tenant (id, name, plan, status, max_users, max_assets)
VALUES ('dept:1', '默认租户', 'ENTERPRISE', 'ACTIVE', 9999, 999999)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    plan = VALUES(plan),
    status = VALUES(status),
    max_users = VALUES(max_users),
    max_assets = VALUES(max_assets);

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

CREATE TABLE IF NOT EXISTS sys_todo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    user_id BIGINT NOT NULL COMMENT '用户 ID',
    title VARCHAR(255) NOT NULL COMMENT '标题',
    content TEXT NULL COMMENT '内容',
    ref_type VARCHAR(64) NULL COMMENT '引用类型',
    ref_id VARCHAR(64) NULL COMMENT '引用 ID',
    priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM' COMMENT '优先级: LOW/MEDIUM/HIGH',
    due_at DATETIME NULL COMMENT '截止时间',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/READ/COMPLETED',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    read_at DATETIME NULL COMMENT '读取时间',
    completed_at DATETIME NULL COMMENT '完成时间',
    INDEX idx_todo_user_status (tenant_id, user_id, status),
    INDEX idx_todo_ref (tenant_id, ref_type, ref_id),
    INDEX idx_todo_due_at (tenant_id, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统待办表';

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
    leader_id BIGINT COMMENT '部门领导用户ID',
    secretary_id BIGINT COMMENT '秘书用户ID',
    dept_type VARCHAR(32) DEFAULT '' COMMENT '部门类型',
    description VARCHAR(512) COMMENT '部门描述/备注',
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
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    asset_id BIGINT NOT NULL,
    change_type VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason VARCHAR(512),
    operator_id BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_change_asset (asset_id),
    INDEX idx_change_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_parent_child (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    parent_asset_id BIGINT NOT NULL,
    child_asset_id BIGINT NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 1,
    remark VARCHAR(500),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_relation (tenant_id, parent_asset_id, child_asset_id, deleted),
    INDEX idx_apc_parent_tenant (parent_asset_id, tenant_id),
    INDEX idx_apc_child_tenant (child_asset_id, tenant_id),
    INDEX idx_apc_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tco_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    asset_id BIGINT NOT NULL,
    calculation_date DATE NOT NULL,
    period_year INT,
    period_month INT,
    total_cost DECIMAL(14,2) DEFAULT 0.00,
    purchase_cost DECIMAL(12,2) DEFAULT 0.00,
    maintenance_cost DECIMAL(12,2) DEFAULT 0.00,
    work_order_cost DECIMAL(12,2) DEFAULT 0.00,
    energy_cost DECIMAL(12,2) DEFAULT 0.00,
    insurance_cost DECIMAL(12,2) DEFAULT 0.00,
    current_value DECIMAL(12,2) DEFAULT 0.00,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tco_tenant (tenant_id),
    INDEX idx_tco_asset (asset_id),
    INDEX idx_tco_date (calculation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS energy_consumption (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    asset_id BIGINT NOT NULL,
    meter_type VARCHAR(20) NOT NULL,
    period_type VARCHAR(10) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    consumption DECIMAL(12,2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'kWh',
    cost DECIMAL(12,2),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_energy_period (tenant_id, asset_id, meter_type, period_type, period_start),
    INDEX idx_ec_asset (asset_id),
    INDEX idx_ec_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS insurance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_no VARCHAR(128) NOT NULL,
    insurance_name VARCHAR(256) NOT NULL,
    insurance_type VARCHAR(32) NOT NULL,
    asset_ids JSON,
    insurer VARCHAR(256),
    premium DECIMAL(12,2) DEFAULT 0.00,
    coverage DECIMAL(12,2) DEFAULT 0.00,
    deductible DECIMAL(12,2) DEFAULT 0.00,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    remark VARCHAR(500),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_ins_tenant (tenant_id, deleted),
    INDEX idx_ins_policy (policy_no),
    INDEX idx_ins_dates (start_date, end_date),
    INDEX idx_ins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_assignment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL,
    applicant_id BIGINT,
    applicant_dept_id BIGINT,
    assigned_to_user_id BIGINT,
    assigned_to_dept_id BIGINT,
    expected_return_date DATE,
    actual_return_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    assignment_date DATE,
    return_condition VARCHAR(500),
    allocation_type VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT',
    approver_id BIGINT,
    approval_time DATETIME,
    approval_remark VARCHAR(500),
    remark VARCHAR(500),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    create_by BIGINT,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_assignment_asset (asset_id),
    INDEX idx_assignment_status (status),
    INDEX idx_assignment_tenant (tenant_id),
    INDEX idx_assignment_type (allocation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_borrow (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT NOT NULL,
    borrower_id BIGINT,
    borrower_dept_id BIGINT,
    borrow_date DATE NOT NULL,
    expected_return_date DATE NOT NULL,
    actual_return_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    purpose VARCHAR(500),
    remark VARCHAR(500),
    notified TINYINT NOT NULL DEFAULT 0,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    create_by BIGINT,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_borrow_asset (asset_id),
    INDEX idx_borrow_status (status),
    INDEX idx_borrow_due_date (expected_return_date),
    INDEX idx_borrow_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inspection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(128) NOT NULL,
    asset_id BIGINT NOT NULL,
    inspection_type VARCHAR(32) NOT NULL,
    inspection_date DATE NOT NULL,
    next_inspection_date DATE,
    inspection_agency VARCHAR(256),
    inspector_name VARCHAR(128),
    result VARCHAR(32) NOT NULL,
    certificate_no VARCHAR(128),
    certificate_expiry DATE,
    report_attachment VARCHAR(512),
    cost DECIMAL(12,2) DEFAULT 0.00,
    template_id BIGINT,
    photos TEXT,
    findings TEXT,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_insp_tenant (tenant_id, deleted),
    INDEX idx_insp_asset (asset_id),
    INDEX idx_insp_next_date (next_inspection_date),
    INDEX idx_insp_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS intake_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL,
    vendor_id BIGINT,
    order_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    total_amount DECIMAL(12,2),
    remark VARCHAR(500),
    reject_reason VARCHAR(500),
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    create_by BIGINT,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_intake_tenant_status (tenant_id, status),
    INDEX idx_intake_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS general_audit_entry (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    trace_id VARCHAR(64),
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(512),
    before_record LONGTEXT,
    after_record LONGTEXT,
    operation_type VARCHAR(64),
    operator_id VARCHAR(64),
    operator_name VARCHAR(128),
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    detail TEXT,
    ip_address VARCHAR(64),
    INDEX idx_general_audit_timestamp (timestamp),
    INDEX idx_general_audit_operation_type (operation_type),
    INDEX idx_general_audit_operator (operator_id),
    INDEX idx_general_audit_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_operate_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    module VARCHAR(128),
    operation VARCHAR(128),
    business_type VARCHAR(64),
    method VARCHAR(256),
    request_method VARCHAR(16),
    request_uri VARCHAR(512),
    operator_id BIGINT,
    operator_name VARCHAR(128),
    operator_ip VARCHAR(64),
    request_params LONGTEXT,
    response_data LONGTEXT,
    status TINYINT DEFAULT 0,
    error_message TEXT,
    cost_time BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operate_log_time (create_time),
    INDEX idx_operate_log_operator (operator_id),
    INDEX idx_operate_log_business (business_type),
    INDEX idx_operate_log_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    post_code VARCHAR(64) NOT NULL COMMENT '岗位编码',
    post_name VARCHAR(128) NOT NULL COMMENT '岗位名称',
    sort_order INT DEFAULT 0 COMMENT '排序号',
    status TINYINT DEFAULT 1 COMMENT '状态 0=停用 1=正常',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_post_code (post_code),
    INDEX idx_status_deleted (status, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='岗位表';

CREATE TABLE IF NOT EXISTS sys_user_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    post_id BIGINT NOT NULL COMMENT '岗位ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_post (user_id, post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户岗位关联表';

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
    attachments TEXT COMMENT '附件 URL 列表（JSON 数组）',
    fault_code_id BIGINT NULL COMMENT '关联故障代码ID',
    sla_deadline DATETIME NULL COMMENT 'SLA 截止时间',
    sla_status VARCHAR(32) NULL DEFAULT 'NORMAL' COMMENT 'SLA 状态: NORMAL/WARNING/BREACHED',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_work_order_tenant_no (tenant_id, work_order_no),
    INDEX idx_work_order_tenant (tenant_id),
    INDEX idx_work_order_status (status),
    INDEX idx_work_order_tenant_status (tenant_id, status),
    INDEX idx_work_order_tenant_time (tenant_id, create_time),
    INDEX idx_work_order_sla (tenant_id, sla_status, sla_deadline),
    INDEX idx_fault_code (fault_code_id)
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
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN collaborators JSON AFTER completion_note', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'collaborators');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN attachments TEXT COMMENT ''附件 URL 列表（JSON 数组）'' AFTER completion_note', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'attachments');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN fault_code_id BIGINT NULL COMMENT ''关联故障代码ID'' AFTER attachments', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'fault_code_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN sla_deadline DATETIME NULL COMMENT ''SLA 截止时间'' AFTER fault_code_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'sla_deadline');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD COLUMN sla_status VARCHAR(32) NULL DEFAULT ''NORMAL'' COMMENT ''SLA 状态: NORMAL/WARNING/BREACHED'' AFTER sla_deadline', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order' AND column_name = 'sla_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_tenant (tenant_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_tenant');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_status (status)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD UNIQUE KEY uk_work_order_tenant_no (tenant_id, work_order_no)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'uk_work_order_tenant_no');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_tenant_status (tenant_id, status)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_tenant_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_tenant_time (tenant_id, create_time)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_tenant_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_work_order_sla (tenant_id, sla_status, sla_deadline)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_work_order_sla');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE work_order ADD INDEX idx_fault_code (fault_code_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order' AND index_name = 'idx_fault_code');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sla_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户 ID',
    priority VARCHAR(32) NOT NULL COMMENT '工单优先级: LOW/MEDIUM/HIGH/CRITICAL',
    response_hours INT NOT NULL DEFAULT 48 COMMENT '响应时限（小时）',
    resolve_hours INT NOT NULL DEFAULT 168 COMMENT '解决时限（小时）',
    warning_ratio DECIMAL(3,2) NOT NULL DEFAULT 0.80 COMMENT '预警阈值比例',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1=启用 0=禁用',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_priority (tenant_id, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SLA 配置表';

INSERT IGNORE INTO sla_config (tenant_id, priority, response_hours, resolve_hours, warning_ratio) VALUES
('0', 'LOW',      72, 336, 0.80),
('0', 'MEDIUM',   48, 168, 0.80),
('0', 'HIGH',     24,  72, 0.80),
('0', 'CRITICAL',  8,  24, 0.80);

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
    work_order_id BIGINT DEFAULT NULL COMMENT '关联工单ID',
    maintenance_type VARCHAR(32) NOT NULL,
    source_type VARCHAR(16) DEFAULT 'MANUAL' COMMENT '来源: MANUAL/PLAN',
    source_type VARCHAR(16) DEFAULT 'MANUAL' COMMENT '来源: MANUAL/PLAN',
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
    INDEX idx_maintenance_asset (asset_id),
    INDEX idx_maintenance_work_order (work_order_id),
    INDEX idx_record_work_order (work_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- maintenance_execution — 维保执行主记录（T3.1 维修执行跟踪）
-- =============================================================================
CREATE TABLE IF NOT EXISTS maintenance_execution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    maintenance_record_id BIGINT COMMENT '关联维保记录ID',
    work_order_id BIGINT COMMENT '关联工单ID（冗余，便于直接查询）',
    assignee_id BIGINT COMMENT '执行人ID',
    assignee_name VARCHAR(128) COMMENT '执行人姓名',
    status VARCHAR(32) NOT NULL DEFAULT 'IDLE' COMMENT '状态: IDLE/RUNNING/PAUSED/COMPLETED',
    total_labor_hours DECIMAL(10,2) DEFAULT 0.00 COMMENT '总人工工时',
    total_material_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '物料总费用',
    start_time DATETIME COMMENT '施工开始时间',
    pause_time DATETIME COMMENT '最近暂停时间',
    resume_time DATETIME COMMENT '最近恢复时间',
    end_time DATETIME COMMENT '施工完成时间',
    remark VARCHAR(500) COMMENT '备注',
    create_by BIGINT COMMENT '创建人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    INDEX idx_exec_tenant (tenant_id, deleted),
    INDEX idx_exec_mt_record (maintenance_record_id),
    INDEX idx_exec_work_order (work_order_id),
    INDEX idx_exec_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维保执行主记录';

-- =============================================================================
-- maintenance_execution_step — 施工步骤记录（T3.1）
-- =============================================================================
CREATE TABLE IF NOT EXISTS maintenance_execution_step (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    execution_id BIGINT NOT NULL COMMENT '关联执行ID',
    step_name VARCHAR(256) NOT NULL COMMENT '步骤名称',
    step_order INT DEFAULT 0 COMMENT '排序号',
    description TEXT COMMENT '步骤描述',
    operator_id BIGINT COMMENT '操作人ID',
    operator_name VARCHAR(128) COMMENT '操作人姓名',
    labor_hours DECIMAL(8,2) DEFAULT 0.00 COMMENT '人工工时',
    start_time DATETIME COMMENT '开始时间',
    end_time DATETIME COMMENT '完成时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    INDEX idx_step_execution (execution_id),
    INDEX idx_step_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='施工步骤记录';

-- =============================================================================
-- maintenance_execution_material — 物料/备件使用记录（T3.1）
-- =============================================================================
CREATE TABLE IF NOT EXISTS maintenance_execution_material (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    execution_id BIGINT NOT NULL COMMENT '关联执行ID',
    material_name VARCHAR(256) NOT NULL COMMENT '物料名称',
    specification VARCHAR(256) COMMENT '规格型号',
    quantity DECIMAL(12,2) NOT NULL COMMENT '数量',
    unit_price DECIMAL(12,2) DEFAULT 0.00 COMMENT '单价',
    total_price DECIMAL(12,2) DEFAULT 0.00 COMMENT '合计金额',
    source_warehouse VARCHAR(128) COMMENT '来源仓库',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标志',
    INDEX idx_mat_execution (execution_id),
    INDEX idx_mat_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料/备件使用记录';

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
    surplus_count INT DEFAULT 0,
    deficit_count INT DEFAULT 0,
    damage_count INT DEFAULT 0,
    approved_by BIGINT,
    approved_at DATETIME,
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

SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE inventory_task ADD COLUMN surplus_count INT DEFAULT 0 AFTER loss_count', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'surplus_count');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE inventory_task ADD COLUMN deficit_count INT DEFAULT 0 AFTER surplus_count', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'deficit_count');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE inventory_task ADD COLUMN damage_count INT DEFAULT 0 AFTER deficit_count', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'damage_count');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE inventory_task ADD COLUMN approved_by BIGINT AFTER damage_count', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'approved_by');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE inventory_task ADD COLUMN approved_at DATETIME AFTER approved_by', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'inventory_task' AND column_name = 'approved_at');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS inventory_adjustment_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL COMMENT '盘点任务 ID',
    detail_id BIGINT COMMENT '盘点明细 ID',
    asset_id BIGINT COMMENT '资产 ID',
    asset_no VARCHAR(128) COMMENT '资产编号',
    asset_name VARCHAR(256) COMMENT '资产名称',
    adjustment_type VARCHAR(32) NOT NULL COMMENT '调账类型: SURPLUS/DEFICIT/DAMAGE',
    status_before VARCHAR(32) COMMENT '变更前状态',
    status_after VARCHAR(32) COMMENT '变更后状态',
    remark VARCHAR(500) COMMENT '备注',
    created_by BIGINT COMMENT '操作人',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task (task_id),
    INDEX idx_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点调账日志表';

CREATE TABLE IF NOT EXISTS idle_asset_notice (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    asset_id BIGINT NOT NULL,
    idle_days INT DEFAULT 0,
    title VARCHAR(256),
    reason VARCHAR(1024),
    notice_date DATE,
    claim_deadline DATE,
    status VARCHAR(32) DEFAULT 'PUBLISHED',
    claimant_id BIGINT,
    claim_date DATE,
    claim_status VARCHAR(32),
    claim_approved_by BIGINT,
    claim_approved_time DATETIME,
    approval_opinion VARCHAR(1024),
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_idle_asset_tenant (tenant_id),
    INDEX idx_idle_asset_id (asset_id),
    INDEX idx_idle_asset_status (status, claim_status)
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
    INDEX idx_approval_process_tenant (tenant_id),
    INDEX idx_approval_process_tenant_type_status (tenant_id, process_type, status),
    UNIQUE KEY uk_ap_tenant_process (tenant_id, process_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing development databases may have been created before tenant isolation
-- columns were added. Keep startup/schema replays additive and tenant-safe.
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' AFTER business_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD COLUMN process_type VARCHAR(64) NOT NULL DEFAULT ''UNKNOWN'' AFTER process_no', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'process_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE approval_process SET process_type = business_type WHERE process_type = 'UNKNOWN' AND business_type IS NOT NULL;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD COLUMN business_data TEXT AFTER business_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'business_data');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD COLUMN apply_time DATETIME DEFAULT CURRENT_TIMESTAMP AFTER applicant_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'apply_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD COLUMN version INT DEFAULT 0 AFTER deleted', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'version');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD INDEX idx_approval_process_tenant (tenant_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND index_name = 'idx_approval_process_tenant');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD INDEX idx_approval_process_tenant_type_status (tenant_id, process_type, status)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND index_name = 'idx_approval_process_tenant_type_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_process ADD UNIQUE KEY uk_ap_tenant_process (tenant_id, process_no)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND index_name = 'uk_ap_tenant_process');
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
    INDEX idx_approval_record_tenant (tenant_id),
    INDEX idx_approval_record_process_approver (process_id, approver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_record ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' AFTER process_id', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'approval_record' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_record ADD INDEX idx_approval_record_tenant (tenant_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_record' AND index_name = 'idx_approval_record_tenant');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE approval_record ADD INDEX idx_approval_record_process_approver (process_id, approver_id)', 'SELECT 1') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'approval_record' AND index_name = 'idx_approval_record_process_approver');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workflow_definition_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    definition_id BIGINT NOT NULL,
    business_type VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    action_type VARCHAR(32) NOT NULL DEFAULT 'PUBLISH',
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    definition_json LONGTEXT NOT NULL,
    publish_note VARCHAR(512),
    impact_scope VARCHAR(512),
    rollback_plan VARCHAR(512),
    rollback_source_version BIGINT,
    operator_id BIGINT,
    published_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_workflow_version_tenant_business_version (tenant_id, business_type, version),
    INDEX idx_workflow_version_definition (definition_id),
    INDEX idx_workflow_version_tenant_business_time (tenant_id, business_type, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_attachment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    business_type VARCHAR(64) NOT NULL,
    business_id BIGINT NOT NULL,
    file_name VARCHAR(256) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(64),
    upload_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_attachment_business (business_type, business_id),
    INDEX idx_attachment_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendor (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(256) NOT NULL,
    vendor_code VARCHAR(64) UNIQUE,
    contact_person VARCHAR(128),
    contact_phone VARCHAR(32),
    contact_email VARCHAR(128),
    address VARCHAR(512),
    bank_account VARCHAR(50),
    tax_id VARCHAR(50),
    password VARCHAR(200),
    portal_enabled TINYINT DEFAULT 0,
    status INT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    INDEX idx_vendor_code (vendor_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS location (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(256) NOT NULL,
    location_code VARCHAR(64) UNIQUE,
    parent_id BIGINT DEFAULT NULL,
    sort_order INT DEFAULT 0,
    description VARCHAR(512),
    status INT DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    INDEX idx_location_code (location_code),
    INDEX idx_location_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(255),
    content TEXT,
    type VARCHAR(50),
    category VARCHAR(50),
    is_read TINYINT DEFAULT 0,
    ref_id BIGINT,
    ref_type VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    INDEX idx_notification_user_id (user_id),
    INDEX idx_notification_user_read (user_id, is_read)
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

-- =============================================================================
-- sys_config — 系统配置 KV 表（SYSTEM/SECURITY 配置分组）
-- 采用单表 KV + config_group 分区模式，支持未来 tenant_id 隔离
-- 参考 debate.json 议题4 方案 A
-- =============================================================================
CREATE TABLE IF NOT EXISTS sys_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'GLOBAL',
    config_group VARCHAR(32) NOT NULL COMMENT '配置分组：SYSTEM / SECURITY',
    config_key VARCHAR(128) NOT NULL COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_config_tenant_group_key (tenant_id, config_group, config_key),
    INDEX idx_config_tenant_group (tenant_id, config_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- RuoYi RBAC Phase 1: sys_menu / sys_role_menu / sys_role_dept
-- =============================================================================

-- A1: sys_menu — 菜单权限表
CREATE TABLE IF NOT EXISTS sys_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    menu_name VARCHAR(128) NOT NULL COMMENT '菜单名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父菜单ID',
    sort_order INT DEFAULT 0 COMMENT '排序号',
    path VARCHAR(256) COMMENT '路由地址',
    component VARCHAR(256) COMMENT '组件路径',
    query_param VARCHAR(256) COMMENT '路由参数',
    route_name VARCHAR(128) COMMENT '路由名称',
    menu_type CHAR(1) NOT NULL DEFAULT 'M' COMMENT 'M=目录 C=菜单 F=按钮',
    visible TINYINT DEFAULT 1 COMMENT '显示状态 0=隐藏 1=显示',
    status TINYINT DEFAULT 1 COMMENT '菜单状态 0=停用 1=正常',
    perms VARCHAR(128) COMMENT '权限标识',
    icon VARCHAR(128) COMMENT '菜单图标',
    is_frame TINYINT DEFAULT 1 COMMENT '是否外链 1=是 0=否',
    is_cache TINYINT DEFAULT 1 COMMENT '是否缓存 1=是 0=否',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_menu_perms (perms),
    INDEX idx_parent_sort (parent_id, sort_order),
    INDEX idx_menu_type (menu_type),
    INDEX idx_status_deleted (status, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

-- A2: sys_role_menu — 角色菜单关联表
CREATE TABLE IF NOT EXISTS sys_role_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL COMMENT '角色ID',
    menu_id BIGINT NOT NULL COMMENT '菜单ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_menu (role_id, menu_id),
    INDEX idx_role_id (role_id),
    INDEX idx_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

-- A3: sys_role_dept — 角色部门关联表（数据权限）
CREATE TABLE IF NOT EXISTS sys_role_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL COMMENT '角色ID',
    dept_id BIGINT NOT NULL COMMENT '部门ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_dept (role_id, dept_id),
    INDEX idx_role_id (role_id),
    INDEX idx_dept_id (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色部门关联表';

-- A4: ALTER sys_role — 补 data_scope / menu_check_strictly / dept_check_strictly
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_role ADD COLUMN data_scope TINYINT DEFAULT 1 COMMENT ''数据权限范围''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'data_scope');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_role ADD COLUMN menu_check_strictly TINYINT DEFAULT 1 COMMENT ''菜单选择是否严格''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'menu_check_strictly');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_role ADD COLUMN dept_check_strictly TINYINT DEFAULT 1 COMMENT ''部门选择是否严格''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'dept_check_strictly');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A5: ALTER sys_dept — 补 ancestors / email
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN ancestors VARCHAR(512) DEFAULT '''' COMMENT ''祖先节点ID链''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'ancestors');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN email VARCHAR(128) COMMENT ''部门邮箱''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'email');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A6: Seed 数据 — 系统管理目录 + 菜单管理页面 + 按钮权限
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, component, menu_type, perms, icon, visible, status) VALUES
    (1, '系统管理', 0, 1, 'system', NULL, 'M', NULL, 'settings', 1, 1),
    (2, '用户管理', 1, 1, 'user', 'system/user/index', 'C', 'system:user:list', 'user', 1, 1),
    (3, '用户查询', 2, 1, NULL, NULL, 'F', 'system:user:query', NULL, 1, 1),
    (4, '用户新增', 2, 2, NULL, NULL, 'F', 'system:user:add', NULL, 1, 1),
    (5, '用户编辑', 2, 3, NULL, NULL, 'F', 'system:user:edit', NULL, 1, 1),
    (6, '用户删除', 2, 4, NULL, NULL, 'F', 'system:user:delete', NULL, 1, 1),
    (7, '角色管理', 1, 2, 'role', 'system/role/index', 'C', 'system:role:list', 'shield', 1, 1),
    (8, '角色查询', 7, 1, NULL, NULL, 'F', 'system:role:query', NULL, 1, 1),
    (9, '角色新增', 7, 2, NULL, NULL, 'F', 'system:role:add', NULL, 1, 1),
    (10, '角色编辑', 7, 3, NULL, NULL, 'F', 'system:role:edit', NULL, 1, 1),
    (11, '角色删除', 7, 4, NULL, NULL, 'F', 'system:role:delete', NULL, 1, 1),
    (12, '部门管理', 1, 3, 'dept', 'system/dept/index', 'C', 'system:dept:list', 'building', 1, 1),
    (13, '部门查询', 12, 1, NULL, NULL, 'F', 'system:dept:query', NULL, 1, 1),
    (14, '部门新增', 12, 2, NULL, NULL, 'F', 'system:dept:add', NULL, 1, 1),
    (15, '部门编辑', 12, 3, NULL, NULL, 'F', 'system:dept:edit', NULL, 1, 1),
    (16, '部门删除', 12, 4, NULL, NULL, 'F', 'system:dept:delete', NULL, 1, 1),
    (17, '菜单管理', 1, 4, 'menu', 'system/menu/index', 'C', 'system:menu:list', 'menu', 1, 1),
    (18, '菜单查询', 17, 1, NULL, NULL, 'F', 'system:menu:query', NULL, 1, 1),
    (19, '菜单新增', 17, 2, NULL, NULL, 'F', 'system:menu:add', NULL, 1, 1),
    (20, '菜单编辑', 17, 3, NULL, NULL, 'F', 'system:menu:edit', NULL, 1, 1),
    (21, '菜单删除', 17, 4, NULL, NULL, 'F', 'system:menu:delete', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- A7: SUPER_ADMIN 角色菜单授权（role_id=1 绑定所有菜单节点）
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
    (1, 7), (1, 8), (1, 9), (1, 10), (1, 11),
    (1, 12), (1, 13), (1, 14), (1, 15), (1, 16),
    (1, 17), (1, 18), (1, 19), (1, 20), (1, 21)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);

-- A7: ancestors 初始化（已有数据的 dept 补上默认祖先链）
UPDATE sys_dept SET ancestors = '0' WHERE id = 1 AND (ancestors IS NULL OR ancestors = '');

-- A7b: ALTER sys_dept — 补 leader_id / secretary_id / dept_type / description
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN leader_id BIGINT COMMENT ''部门领导用户ID''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'leader_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN secretary_id BIGINT COMMENT ''秘书用户ID''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'secretary_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN dept_type VARCHAR(32) DEFAULT '''' COMMENT ''部门类型''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'dept_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN description VARCHAR(512) COMMENT ''部门描述/备注''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'description');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A8: ALTER sys_user — 补登录追踪和备注字段
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_user ADD COLUMN login_ip VARCHAR(128) COMMENT ''最后登录IP''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'login_ip');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_user ADD COLUMN login_date DATETIME COMMENT ''最后登录时间''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'login_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_user ADD COLUMN remark VARCHAR(512) COMMENT ''备注''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'remark');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- A9: Seed 数据 — 工作流定义管理权限
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, component, menu_type, perms, icon, visible, status) VALUES
    (22, '工作流定义', 1, 5, 'workflows', 'workflow/WorkflowCenterPage', 'C', 'workflow:definition:query', 'workflow', 1, 1),
    (23, '工作流查询', 22, 1, NULL, NULL, 'F', 'workflow:definition:query', NULL, 1, 1),
    (24, '工作流编辑', 22, 2, NULL, NULL, 'F', 'workflow:definition:edit', NULL, 1, 1)
ON DUPLICATE KEY UPDATE
    menu_name = VALUES(menu_name),
    parent_id = VALUES(parent_id),
    sort_order = VALUES(sort_order),
    path = VALUES(path),
    component = VALUES(component),
    menu_type = VALUES(menu_type),
    perms = VALUES(perms),
    icon = VALUES(icon),
    visible = VALUES(visible),
    status = VALUES(status);

-- A10: SUPER_ADMIN 角色绑定 workflow 菜单节点
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 22), (1, 23), (1, 24)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);


-- =============================================================================
-- AC-2: sys_permission 废弃说明
-- =============================================================================
-- sys_permission 表已废弃，不再作为权限来源使用。
-- 所有新权限编码必须在 sys_menu.perms 字段中定义。
-- 现有 sys_permission 中的数据可通
-- 过迁移脚本迁移至 sys_menu：
--   migration/migrate_sys_permission_to_menu.sql
--
-- 权限加载链路（UserDetailsServiceImpl）已改为从 sys_menu.perms 读取：
--   sys_menu → sys_role_menu → sys_user_role → sys_user
-- =============================================================================

-- =============================================================================
-- AC-5: 业务模块权限种子数据（sys_menu 权限节点 + SUPER_ADMIN 绑定）
-- ID 范围: 100-211，避开已有 1-24 和迁移脚本 1000+
-- 权限编码格式: module:submodule:action（与 Controller @PreAuthorize 保持一致）
-- =============================================================================

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (100, '资产管理', 0, 2, 'M', NULL, 'package', 1, 1),
    (101, '资产台账', 100, 1, 'C', 'asset:ledger:query', 'list', 1, 1),
    (102, '资产查询', 101, 1, 'F', 'asset:ledger:query', NULL, 1, 1),
    (103, '资产创建', 101, 2, 'F', 'asset:ledger:create', NULL, 1, 1),
    (104, '资产编辑', 101, 3, 'F', 'asset:ledger:edit', NULL, 1, 1),
    (105, '资产删除', 101, 4, 'F', 'asset:ledger:delete', NULL, 1, 1),
    (106, '资产分类', 100, 2, 'C', 'asset:category:query', 'grid', 1, 1),
    (107, '分类查询', 106, 1, 'F', 'asset:category:query', NULL, 1, 1),
    (108, '分类创建', 106, 2, 'F', 'asset:category:create', NULL, 1, 1),
    (109, '分类编辑', 106, 3, 'F', 'asset:category:edit', NULL, 1, 1),
    (110, '分类删除', 106, 4, 'F', 'asset:category:delete', NULL, 1, 1),
    (300, 'ABC分类', 100, 3, 'C', 'abc:query', 'layers', 1, 1),
    (301, 'ABC查询', 300, 1, 'F', 'abc:query', NULL, 1, 1),
    (302, 'ABC重分类', 300, 2, 'F', 'abc:reclassify', NULL, 1, 1),
    (111, '维修管理', 100, 3, 'C', 'asset:maintenance:query', 'tool', 1, 1),
    (112, '维修查询', 111, 1, 'F', 'asset:maintenance:query', NULL, 1, 1),
    (113, '维修创建', 111, 2, 'F', 'asset:maintenance:create', NULL, 1, 1),
    (114, '维修编辑', 111, 3, 'F', 'asset:maintenance:edit', NULL, 1, 1),
    (115, '维修删除', 111, 4, 'F', 'asset:maintenance:delete', NULL, 1, 1),
    (116, '退役管理', 100, 4, 'C', 'asset:retirement:query', 'archive', 1, 1),
    (117, '退役查询', 116, 1, 'F', 'asset:retirement:query', NULL, 1, 1),
    (118, '退役申请', 116, 2, 'F', 'asset:retirement:create', NULL, 1, 1),
    (119, '退役提交', 116, 3, 'F', 'asset:retirement:submit', NULL, 1, 1),
    (120, '退役审批', 116, 4, 'F', 'asset:retirement:approve', NULL, 1, 1),
    (121, '退役驳回', 116, 5, 'F', 'asset:retirement:reject', NULL, 1, 1),
    (122, '退役完成', 116, 6, 'F', 'asset:retirement:complete', NULL, 1, 1),
    (123, '退役取消', 116, 7, 'F', 'asset:retirement:cancel', NULL, 1, 1),
    (124, '退役删除', 116, 8, 'F', 'asset:retirement:delete', NULL, 1, 1),
    (210, '退役编辑', 116, 9, 'F', 'asset:retirement:edit', NULL, 1, 1),
    (125, '盘点管理', 100, 5, 'C', 'inventory:query', 'scan', 1, 1),
    (126, '盘点查询', 125, 1, 'F', 'inventory:query', NULL, 1, 1),
    (127, '盘点创建', 125, 2, 'F', 'inventory:create', NULL, 1, 1),
    (128, '盘点扫描', 125, 3, 'F', 'inventory:scan', NULL, 1, 1),
    (129, '盘点提交', 125, 4, 'F', 'inventory:submit', NULL, 1, 1),
    (130, '闲置资产', 100, 6, 'C', 'idle:query', 'share', 1, 1),
    (131, '闲置查询', 130, 1, 'F', 'idle:query', NULL, 1, 1),
    (132, '闲置发布', 130, 2, 'F', 'idle:create', NULL, 1, 1),
    (133, '闲置认领', 130, 3, 'F', 'idle:claim', NULL, 1, 1),
    (211, '认领审批', 130, 4, 'F', 'idle:approve', NULL, 1, 1),
    (134, '闲置取消', 130, 5, 'F', 'idle:cancel', NULL, 1, 1),
    (135, '闲置删除', 130, 6, 'F', 'idle:delete', NULL, 1, 1),
    (136, '资产赔偿', 100, 7, 'C', 'compensation:query', 'dollar-sign', 1, 1),
    (137, '赔偿查询', 136, 1, 'F', 'compensation:query', NULL, 1, 1),
    (138, '赔偿创建', 136, 2, 'F', 'compensation:create', NULL, 1, 1),
    (139, '赔偿编辑', 136, 3, 'F', 'compensation:edit', NULL, 1, 1),
    (140, '赔偿删除', 136, 4, 'F', 'compensation:delete', NULL, 1, 1),
    (141, '折旧管理', 100, 8, 'C', 'depreciation:query', 'trending-down', 1, 1),
    (142, '折旧查询', 141, 1, 'F', 'depreciation:query', NULL, 1, 1),
    (143, '折旧计算', 141, 2, 'F', 'depreciation:calculate', NULL, 1, 1),
    (144, '资产处置', 100, 9, 'C', 'disposal:query', 'trash', 1, 1),
    (145, '处置查询', 144, 1, 'F', 'disposal:query', NULL, 1, 1),
    (146, '资产转移', 144, 2, 'F', 'disposal:transfer', NULL, 1, 1),
    (147, '资产清退', 144, 3, 'F', 'disposal:clearance', NULL, 1, 1),
    (148, '资产报废', 144, 4, 'F', 'disposal:scrap', NULL, 1, 1),
    (150, '审批管理', 0, 3, 'M', NULL, 'check-circle', 1, 1),
    (151, '审批流程', 150, 1, 'C', 'approval:process:query', 'file-text', 1, 1),
    (152, '审批查询', 151, 1, 'F', 'approval:process:query', NULL, 1, 1),
    (153, '审批发起', 151, 2, 'F', 'approval:process:create', NULL, 1, 1),
    (154, '审批通过', 151, 3, 'F', 'approval:process:approve', NULL, 1, 1),
    (155, '审批驳回', 151, 4, 'F', 'approval:process:reject', NULL, 1, 1),
    (156, '审批取消', 151, 5, 'F', 'approval:process:cancel', NULL, 1, 1),
    (160, '工单管理', 0, 4, 'M', NULL, 'clipboard', 1, 1),
    (161, '工单列表', 160, 1, 'C', 'workorder:order:query', 'list-checks', 1, 1),
    (162, '工单查询', 161, 1, 'F', 'workorder:order:query', NULL, 1, 1),
    (163, '工单创建', 161, 2, 'F', 'workorder:order:create', NULL, 1, 1),
    (164, '工单编辑', 161, 3, 'F', 'workorder:order:edit', NULL, 1, 1),
    (165, '工单删除', 161, 4, 'F', 'workorder:order:delete', NULL, 1, 1),
    (166, '工单提交', 161, 5, 'F', 'workorder:order:submit', NULL, 1, 1),
    (167, '工单审批', 161, 6, 'F', 'workorder:order:approve', NULL, 1, 1),
    (168, '工单驳回', 161, 7, 'F', 'workorder:order:reject', NULL, 1, 1),
    (170, '基础数据', 0, 5, 'M', NULL, 'database', 1, 1),
    (171, '位置管理', 170, 1, 'C', 'location:query', 'map-pin', 1, 1),
    (172, '位置查询', 171, 1, 'F', 'location:query', NULL, 1, 1),
    (173, '位置创建', 171, 2, 'F', 'location:create', NULL, 1, 1),
    (174, '位置编辑', 171, 3, 'F', 'location:edit', NULL, 1, 1),
    (175, '位置删除', 171, 4, 'F', 'location:delete', NULL, 1, 1),
    (176, '供应商管理', 170, 2, 'C', 'vendor:vendor:query', 'truck', 1, 1),
    (177, '供应商查询', 176, 1, 'F', 'vendor:vendor:query', NULL, 1, 1),
    (178, '供应商新增', 176, 2, 'F', 'vendor:vendor:add', NULL, 1, 1),
    (179, '供应商编辑', 176, 3, 'F', 'vendor:vendor:edit', NULL, 1, 1),
    (180, '供应商删除', 176, 4, 'F', 'vendor:vendor:delete', NULL, 1, 1),
    (185, '报表统计', 0, 6, 'M', NULL, 'bar-chart', 1, 1),
    (310, '资产运营中枢', 185, 1, 'C', 'dashboard:query', 'shield-check', 1, 1),
    (311, '资产运营中枢查询', 310, 1, 'F', 'dashboard:query', NULL, 1, 1),
    (186, '旧版仪表板', 185, 2, 'C', 'dashboard:query', 'layout-dashboard', 1, 1),
    (187, '旧版仪表板查询', 186, 1, 'F', 'dashboard:query', NULL, 1, 1),
    (188, '报表中心', 185, 3, 'C', 'report:query', 'file-bar-chart', 1, 1),
    (189, '报表查询', 188, 1, 'F', 'report:query', NULL, 1, 1),
    (190, '统计概览', 185, 4, 'C', 'stats:query', 'pie-chart', 1, 1),
    (191, '统计查询', 190, 1, 'F', 'stats:query', NULL, 1, 1),
    (192, '大屏展示', 185, 5, 'C', 'bigscreen:query', 'monitor', 1, 1),
    (193, '大屏查询', 192, 1, 'F', 'bigscreen:query', NULL, 1, 1),
    (194, '审计日志', 185, 6, 'C', 'audit:query', 'search-code', 1, 1),
    (195, '审计查询', 194, 1, 'F', 'audit:query', NULL, 1, 1),
    (200, '其他功能', 0, 7, 'M', NULL, 'more-horizontal', 1, 1),
    (201, '通知管理', 200, 1, 'C', NULL, 'bell', 1, 1),
    (209, '通知查询', 201, 0, 'F', 'notification:query', NULL, 1, 1),
    (202, '通知已读', 201, 1, 'F', 'notification:read', NULL, 1, 1),
    (203, '通知删除', 201, 2, 'F', 'notification:delete', NULL, 1, 1),
    (204, '全局搜索', 200, 2, 'C', 'search:query', 'search', 1, 1),
    (205, '搜索查询', 204, 1, 'F', 'search:query', NULL, 1, 1),
    (206, '系统配置', 200, 3, 'C', 'system:config:query', 'settings', 1, 1),
    (207, '配置查询', 206, 1, 'F', 'system:config:query', NULL, 1, 1),
    (208, '配置编辑', 206, 2, 'F', 'system:config:edit', NULL, 1, 1),
    (212, '施工执行', 111, 5, 'C', 'asset:maintenance:execution:query', 'play-circle', 1, 1),
    (213, '开始施工', 212, 1, 'F', 'asset:maintenance:execution:start', NULL, 1, 1),
    (214, '暂停施工', 212, 2, 'F', 'asset:maintenance:execution:pause', NULL, 1, 1),
    (215, '恢复施工', 212, 3, 'F', 'asset:maintenance:execution:resume', NULL, 1, 1),
    (216, '完成施工', 212, 4, 'F', 'asset:maintenance:execution:complete', NULL, 1, 1),
    (217, '物料管理', 212, 5, 'F', 'asset:maintenance:execution:material', NULL, 1, 1)

ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- Desktop route metadata used by /menus/current consumers.
-- Keep this aligned with the React Router paths before switching the sidebar
-- from static NAV_GROUPS to backend-driven menus.
UPDATE sys_menu
SET path = CASE id
    WHEN 2 THEN 'system/users'
    WHEN 7 THEN 'system/roles'
    WHEN 12 THEN 'system/depts'
    WHEN 17 THEN 'system/menus'
    WHEN 101 THEN 'assets'
    WHEN 106 THEN 'categories'
    WHEN 111 THEN 'maintenance'
    WHEN 116 THEN 'retirement'
    WHEN 125 THEN 'inventory'
    WHEN 130 THEN 'idle'
    WHEN 136 THEN 'compensation'
    WHEN 141 THEN 'depreciation'
    WHEN 144 THEN 'disposals'
    WHEN 151 THEN 'approvals'
    WHEN 161 THEN 'workorders'
    WHEN 171 THEN 'locations'
    WHEN 176 THEN 'vendors'
    WHEN 186 THEN 'dashboard'
    WHEN 310 THEN 'fixed-assets/workbench'
    WHEN 188 THEN 'reports'
    WHEN 190 THEN 'analytics'
    WHEN 192 THEN 'bigscreen'
    WHEN 194 THEN 'audit'
    WHEN 201 THEN 'notifications'
    WHEN 206 THEN 'settings/sysconfig'
    WHEN 212 THEN 'maintenance/execution'
    WHEN 300 THEN 'inventory/abc-classification'
    ELSE path
END,
component = CASE id
    WHEN 2 THEN 'system/UserManagement'
    WHEN 7 THEN 'system/RoleManagement'
    WHEN 12 THEN 'system/DeptManagement'
    WHEN 17 THEN 'system/MenuManagement'
    WHEN 101 THEN 'asset/AssetListPage'
    WHEN 106 THEN 'category/CategoryManagerPage'
    WHEN 111 THEN 'maintenance/MaintenancePage'
    WHEN 116 THEN 'retirement/RetirementListPage'
    WHEN 125 THEN 'inventory/InventoryTasksPage'
    WHEN 130 THEN 'idle/IdleAssetsPage'
    WHEN 136 THEN 'disposal/AssetCompensationFormPage'
    WHEN 141 THEN 'depreciation/DepreciationListPage'
    WHEN 144 THEN 'disposal/DisposalListPage'
    WHEN 151 THEN 'approval/ApprovalListPage'
    WHEN 161 THEN 'workorder/WorkOrderFormPage'
    WHEN 171 THEN 'locations/LocationsPage'
    WHEN 176 THEN 'vendors/VendorsPage'
    WHEN 186 THEN 'dashboard/DashboardPage'
    WHEN 310 THEN 'workspace-preview/WorkspacePreviewPage'
    WHEN 188 THEN 'reports/ReportsPage'
    WHEN 190 THEN 'analytics/AnalyticsPage'
    WHEN 192 THEN 'bigscreen/BigScreenPage'
    WHEN 194 THEN 'audit/AuditDashboardPage'
    WHEN 201 THEN 'notifications/NotificationsPage'
    WHEN 206 THEN 'settings/SettingsPage'
    WHEN 212 THEN 'maintenance/execution/MaintenanceExecutionPage'
    WHEN 300 THEN 'inventory/ABCClassificationPage'
    ELSE component
END,
query_param = CASE id
    WHEN 310 THEN 'menu=home'
    ELSE query_param
END
WHERE id IN (
    2, 7, 12, 17,
    101, 106, 111, 116, 125, 130, 136, 141, 144, 151, 161, 171, 176,
    186, 188, 190, 192, 194, 201, 206, 212, 300, 310
);

-- SUPER_ADMIN 角色绑定所有业务菜单节点 (role_id=1)
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 100),
    (1, 101),
    (1, 102),
    (1, 103),
    (1, 104),
    (1, 105),
    (1, 106),
    (1, 107),
    (1, 108),
    (1, 109),
    (1, 110),
    (1, 300),
    (1, 301),
    (1, 302),
    (1, 111),
    (1, 112),
    (1, 113),
    (1, 114),
    (1, 115),
    (1, 116),
    (1, 117),
    (1, 118),
    (1, 119),
    (1, 120),
    (1, 121),
    (1, 122),
    (1, 123),
    (1, 124),
    (1, 210),
    (1, 125),
    (1, 126),
    (1, 127),
    (1, 128),
    (1, 129),
    (1, 130),
    (1, 131),
    (1, 132),
    (1, 133),
    (1, 211),
    (1, 134),
    (1, 135),
    (1, 136),
    (1, 137),
    (1, 138),
    (1, 139),
    (1, 140),
    (1, 141),
    (1, 142),
    (1, 143),
    (1, 144),
    (1, 145),
    (1, 146),
    (1, 147),
    (1, 148),
    (1, 150),
    (1, 151),
    (1, 152),
    (1, 153),
    (1, 154),
    (1, 155),
    (1, 156),
    (1, 160),
    (1, 161),
    (1, 162),
    (1, 163),
    (1, 164),
    (1, 165),
    (1, 166),
    (1, 167),
    (1, 168),
    (1, 170),
    (1, 171),
    (1, 172),
    (1, 173),
    (1, 174),
    (1, 175),
    (1, 176),
    (1, 177),
    (1, 178),
    (1, 179),
    (1, 180),
    (1, 185),
    (1, 310),
    (1, 311),
    (1, 186),
    (1, 187),
    (1, 188),
    (1, 189),
    (1, 190),
    (1, 191),
    (1, 192),
    (1, 193),
    (1, 194),
    (1, 195),
    (1, 200),
    (1, 201),
    (1, 202),
    (1, 203),
    (1, 209),
    (1, 204),
    (1, 205),
    (1, 206),
    (1, 207),
    (1, 208),
    (1, 212),
    (1, 213),
    (1, 214),
    (1, 215),
    (1, 216),
    (1, 217)

ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);

-- A11: Seed 数据 — 岗位管理权限
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, component, menu_type, perms, icon, visible, status) VALUES
    (30, '岗位管理', 1, 5, 'post', 'system/post/index', 'C', 'system:post:list', 'briefcase', 1, 1),
    (31, '岗位查询', 30, 1, NULL, NULL, 'F', 'system:post:query', NULL, 1, 1),
    (32, '岗位新增', 30, 2, NULL, NULL, 'F', 'system:post:add', NULL, 1, 1),
    (33, '岗位编辑', 30, 3, NULL, NULL, 'F', 'system:post:edit', NULL, 1, 1),
    (34, '岗位删除', 30, 4, NULL, NULL, 'F', 'system:post:delete', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 30), (1, 31), (1, 32), (1, 33), (1, 34)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);

-- A12: 循环盘点 ABC 分类规则表（真实 E2E / schema.sql 初始化需要）
CREATE TABLE IF NOT EXISTS cycle_count_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    classification VARCHAR(8) NOT NULL COMMENT 'A/B/C/CATEGORY',
    frequency VARCHAR(16) NOT NULL COMMENT 'MONTHLY/QUARTERLY/YEARLY',
    category_ids TEXT COMMENT '适用分类ID(JSON数组)',
    min_value DECIMAL(14,2) COMMENT '最小价值',
    max_value DECIMAL(14,2) COMMENT '最大价值',
    tenant_id VARCHAR(64) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_ccr_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='循环盘点ABC分类规则表';
