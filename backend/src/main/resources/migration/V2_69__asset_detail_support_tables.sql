-- 补齐真实后端资产详情页依赖的子资源表/租户列。
-- 这些 DDL 保持幂等，用于修复已有若依整合库中迁移未完全落地的问题。

CREATE TABLE IF NOT EXISTS asset_parent_child (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键ID',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户ID',
    parent_asset_id BIGINT NOT NULL COMMENT '父资产ID',
    child_asset_id BIGINT NOT NULL COMMENT '子资产ID',
    relation_type VARCHAR(50) NOT NULL COMMENT '关系类型',
    quantity INT DEFAULT 1 COMMENT '数量',
    remark VARCHAR(500) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    UNIQUE KEY uk_relation (tenant_id, parent_asset_id, child_asset_id, deleted),
    KEY idx_parent_tenant (parent_asset_id, tenant_id),
    KEY idx_child_tenant (child_asset_id, tenant_id),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产父子关系表';

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_parent_child ADD COLUMN quantity INT DEFAULT 1 COMMENT ''数量'' AFTER relation_type',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND column_name = 'quantity');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_parent_child ADD COLUMN remark VARCHAR(500) COMMENT ''备注'' AFTER quantity',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND column_name = 'remark');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_parent_child ADD COLUMN create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间'' AFTER remark',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND column_name = 'create_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_parent_child ADD COLUMN deleted TINYINT DEFAULT 0 COMMENT ''逻辑删除'' AFTER create_time',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND column_name = 'deleted');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) > 0,
    'UPDATE asset_parent_child SET create_time = created_at WHERE create_time IS NULL',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND column_name = 'created_at');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE asset_parent_child MODIFY COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户ID';
UPDATE asset_parent_child SET tenant_id = 'dept:1' WHERE tenant_id IN ('0', '1', 'default', 'T001');

SET @sql = (SELECT IF(COUNT(*) > 0 AND COALESCE(SUM(CASE WHEN column_name = 'tenant_id' THEN 1 ELSE 0 END), 0) = 0,
    'ALTER TABLE asset_parent_child DROP INDEX uk_relation',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND index_name = 'uk_relation');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_parent_child ADD UNIQUE KEY uk_relation (tenant_id, parent_asset_id, child_asset_id, deleted)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND index_name = 'uk_relation');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_parent_child ADD INDEX idx_apc_deleted (deleted)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'asset_parent_child' AND index_name = 'idx_apc_deleted');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS tco_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    calculation_date DATE NOT NULL COMMENT '计算日期',
    period_year INT COMMENT '年度',
    period_month INT COMMENT '月份',
    total_cost DECIMAL(14,2) DEFAULT 0.00 COMMENT 'TCO总成本',
    purchase_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '采购成本',
    maintenance_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '维保成本',
    work_order_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '工单成本',
    energy_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '能耗成本',
    insurance_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '保险成本',
    current_value DECIMAL(12,2) DEFAULT 0.00 COMMENT '当前净值',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tco_tenant (tenant_id),
    KEY idx_tco_asset (asset_id),
    KEY idx_tco_date (calculation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='TCO记录表';

CREATE TABLE IF NOT EXISTS energy_consumption (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户ID',
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    meter_type VARCHAR(20) NOT NULL COMMENT '表类型',
    period_type VARCHAR(10) NOT NULL COMMENT '汇总周期',
    period_start DATE NOT NULL COMMENT '周期开始',
    period_end DATE NOT NULL COMMENT '周期结束',
    consumption DECIMAL(12,2) NOT NULL COMMENT '消耗量',
    unit VARCHAR(20) DEFAULT 'kWh',
    cost DECIMAL(12,2) COMMENT '费用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_energy_period (tenant_id, asset_id, meter_type, period_type, period_start),
    KEY idx_ec_asset (asset_id),
    KEY idx_ec_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='能耗汇总';

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE energy_consumption ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'energy_consumption' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE sys_attachment ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'sys_attachment' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_change_log ADD COLUMN tenant_id VARCHAR(64) NOT NULL DEFAULT ''dept:1'' COMMENT ''租户ID'' AFTER id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_change_log' AND column_name = 'tenant_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS insurance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_no VARCHAR(128) NOT NULL COMMENT '保单号',
    insurance_name VARCHAR(256) NOT NULL COMMENT '保险名称',
    insurance_type VARCHAR(32) NOT NULL COMMENT '保险类型',
    asset_ids JSON COMMENT '关联资产ID数组',
    insurer VARCHAR(256) COMMENT '保险公司',
    premium DECIMAL(12,2) DEFAULT 0.00 COMMENT '保费',
    coverage DECIMAL(12,2) DEFAULT 0.00 COMMENT '保额',
    deductible DECIMAL(12,2) DEFAULT 0.00 COMMENT '免赔额',
    start_date DATE NOT NULL COMMENT '生效日',
    end_date DATE NOT NULL COMMENT '到期日',
    status VARCHAR(32) DEFAULT 'ACTIVE' COMMENT '状态',
    remark VARCHAR(500) COMMENT '备注',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户ID',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    KEY idx_ins_tenant (tenant_id, deleted),
    KEY idx_ins_policy (policy_no),
    KEY idx_ins_dates (start_date, end_date),
    KEY idx_ins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保险表';

CREATE TABLE IF NOT EXISTS asset_assignment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    asset_id BIGINT NOT NULL COMMENT '资产 ID',
    applicant_id BIGINT NULL COMMENT '申请人 ID',
    applicant_dept_id BIGINT NULL COMMENT '申请部门 ID',
    assigned_to_user_id BIGINT NULL COMMENT '签收人 ID',
    assigned_to_dept_id BIGINT NULL COMMENT '签收部门 ID',
    expected_return_date DATE NULL COMMENT '预计归还日期',
    actual_return_date DATE NULL COMMENT '实际归还日期',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
    assignment_date DATE NULL COMMENT '签收日期',
    return_condition VARCHAR(500) NULL COMMENT '归还时状况说明',
    allocation_type VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT' COMMENT '领用类型',
    approver_id BIGINT NULL COMMENT '审批人 ID',
    approval_time DATETIME NULL COMMENT '审批时间',
    approval_remark VARCHAR(500) NULL COMMENT '审批备注',
    remark VARCHAR(500) NULL COMMENT '备注',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户 ID',
    create_by BIGINT NULL COMMENT '创建人',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    KEY idx_assignment_asset (asset_id),
    KEY idx_assignment_status (status),
    KEY idx_assignment_tenant (tenant_id),
    KEY idx_assignment_type (allocation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产领用归还表';

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_assignment ADD COLUMN allocation_type VARCHAR(20) NOT NULL DEFAULT ''ASSIGNMENT'' COMMENT ''领用类型'' AFTER return_condition',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_assignment' AND column_name = 'allocation_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_assignment ADD COLUMN approver_id BIGINT NULL COMMENT ''审批人 ID'' AFTER allocation_type',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_assignment' AND column_name = 'approver_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_assignment ADD COLUMN approval_time DATETIME NULL COMMENT ''审批时间'' AFTER approver_id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_assignment' AND column_name = 'approval_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE asset_assignment ADD COLUMN approval_remark VARCHAR(500) NULL COMMENT ''审批备注'' AFTER approval_time',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'asset_assignment' AND column_name = 'approval_remark');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS asset_borrow (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    asset_id BIGINT NOT NULL COMMENT '资产 ID',
    borrower_id BIGINT NULL COMMENT '借用人 ID',
    borrower_dept_id BIGINT NULL COMMENT '借用部门 ID',
    borrow_date DATE NOT NULL COMMENT '借用日期',
    expected_return_date DATE NOT NULL COMMENT '预计归还日期',
    actual_return_date DATE NULL COMMENT '实际归还日期',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
    purpose VARCHAR(500) NULL COMMENT '借用用途',
    remark VARCHAR(500) NULL COMMENT '备注',
    notified TINYINT NOT NULL DEFAULT 0 COMMENT '到期已通知标记',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户 ID',
    create_by BIGINT NULL COMMENT '创建人',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    KEY idx_borrow_asset (asset_id),
    KEY idx_borrow_status (status),
    KEY idx_borrow_due_date (expected_return_date),
    KEY idx_borrow_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产借用表';

CREATE TABLE IF NOT EXISTS inspection (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inspection_no VARCHAR(128) NOT NULL COMMENT '检验编号',
    asset_id BIGINT NOT NULL COMMENT '关联资产ID',
    inspection_type VARCHAR(32) NOT NULL COMMENT '检验类型',
    inspection_date DATE NOT NULL COMMENT '检验日期',
    next_inspection_date DATE COMMENT '下次检验日期',
    inspection_agency VARCHAR(256) COMMENT '检验机构',
    inspector_name VARCHAR(128) COMMENT '检验人',
    result VARCHAR(32) NOT NULL COMMENT '结果',
    certificate_no VARCHAR(128) COMMENT '证书编号',
    certificate_expiry DATE COMMENT '证书到期日',
    report_attachment VARCHAR(512) COMMENT '报告附件路径',
    cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '检验费用',
    template_id BIGINT COMMENT '检验模板ID',
    photos TEXT COMMENT '检验照片(JSON数组)',
    findings TEXT COMMENT '检查发现',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1',
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    KEY idx_insp_tenant (tenant_id, deleted),
    KEY idx_insp_asset (asset_id),
    KEY idx_insp_next_date (next_inspection_date),
    KEY idx_insp_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验/年检记录表';

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE inspection ADD COLUMN template_id BIGINT COMMENT ''检验模板ID'' AFTER cost',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inspection' AND column_name = 'template_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE inspection ADD COLUMN photos TEXT COMMENT ''检验照片(JSON数组)'' AFTER template_id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inspection' AND column_name = 'photos');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE inspection ADD COLUMN findings TEXT COMMENT ''检查发现'' AFTER photos',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'inspection' AND column_name = 'findings');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS intake_order (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键 ID',
    order_no VARCHAR(64) NOT NULL COMMENT '验收单号',
    vendor_id BIGINT NULL COMMENT '供应商 ID',
    order_date DATE NULL COMMENT '验收日期',
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
    total_amount DECIMAL(12,2) NULL COMMENT '总金额',
    remark VARCHAR(500) NULL COMMENT '备注',
    reject_reason VARCHAR(500) NULL COMMENT '驳回原因',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'dept:1' COMMENT '租户 ID',
    create_by BIGINT NULL COMMENT '创建人 ID',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    KEY idx_intake_tenant_status (tenant_id, status),
    KEY idx_intake_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库验收主单';

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE approval_process ADD COLUMN process_type VARCHAR(64) NOT NULL DEFAULT ''UNKNOWN'' COMMENT ''流程类型'' AFTER process_no',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'process_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE approval_process
SET process_type = business_type
WHERE process_type = 'UNKNOWN' AND business_type IS NOT NULL;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE approval_process ADD COLUMN business_data TEXT COMMENT ''业务数据快照'' AFTER business_id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'business_data');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE approval_process ADD COLUMN apply_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT ''申请时间'' AFTER applicant_id',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'apply_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE approval_process ADD COLUMN version INT DEFAULT 0 COMMENT ''乐观锁版本'' AFTER deleted',
    'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND column_name = 'version');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
    'ALTER TABLE approval_process ADD INDEX idx_approval_process_tenant_type_status (tenant_id, process_type, status)',
    'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'approval_process' AND index_name = 'idx_approval_process_tenant_type_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
