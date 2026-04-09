-- ==========================================
-- 企业资产管理系统数据库设计
-- Database: ams_db
-- Author: AMS Team
-- Date: 2024-03-28
-- ==========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ams_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ams_db;

-- ==========================================
-- 1. 用户权限模块
-- ==========================================

-- 用户表
CREATE TABLE sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username VARCHAR(64) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(128) NOT NULL COMMENT '密码(加密)',
    real_name VARCHAR(64) NOT NULL COMMENT '真实姓名',
    email VARCHAR(128) COMMENT '邮箱',
    phone VARCHAR(32) COMMENT '手机号',
    avatar VARCHAR(512) COMMENT '头像URL',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用 0-禁用',
    dept_id BIGINT COMMENT '所属部门ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0-未删除 1-已删除',
    INDEX idx_username (username),
    INDEX idx_dept_id (dept_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 角色表
CREATE TABLE sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '角色ID',
    role_name VARCHAR(64) NOT NULL COMMENT '角色名称',
    role_code VARCHAR(64) NOT NULL UNIQUE COMMENT '角色编码',
    description VARCHAR(512) COMMENT '角色描述',
    sort_order INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用 0-禁用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_role_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 用户角色关联表
CREATE TABLE sys_user_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

-- 部门表
CREATE TABLE sys_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '部门ID',
    dept_name VARCHAR(128) NOT NULL COMMENT '部门名称',
    dept_code VARCHAR(64) UNIQUE COMMENT '部门编码',
    parent_id BIGINT DEFAULT 0 COMMENT '父部门ID(0为根部门)',
    sort_order INT DEFAULT 0 COMMENT '排序',
    leader VARCHAR(64) COMMENT '负责人',
    phone VARCHAR(32) COMMENT '联系电话',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用 0-禁用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_parent_id (parent_id),
    INDEX idx_dept_code (dept_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

-- ==========================================
-- 2. 资产管理核心模块
-- ==========================================

-- 资产分类表
CREATE TABLE asset_category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '分类ID',
    category_name VARCHAR(128) NOT NULL COMMENT '分类名称',
    category_code VARCHAR(64) UNIQUE COMMENT '分类编码',
    parent_id BIGINT DEFAULT 0 COMMENT '父分类ID',
    sort_order INT DEFAULT 0 COMMENT '排序',
    description VARCHAR(512) COMMENT '分类描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    INDEX idx_parent_id (parent_id),
    INDEX idx_category_code (category_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产分类表';

-- 资产台账表(核心)
CREATE TABLE asset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '资产ID',
    asset_no VARCHAR(128) NOT NULL UNIQUE COMMENT '资产编号',
    asset_name VARCHAR(256) NOT NULL COMMENT '资产名称',
    category_id BIGINT NOT NULL COMMENT '资产分类ID',
    
    -- 基本信息
    model VARCHAR(128) COMMENT '型号规格',
    brand VARCHAR(128) COMMENT '品牌',
    supplier VARCHAR(256) COMMENT '供应商',
    serial_no VARCHAR(128) COMMENT '序列号',
    
    -- 财务信息
    original_value DECIMAL(15,2) DEFAULT 0.00 COMMENT '原值',
    current_value DECIMAL(15,2) DEFAULT 0.00 COMMENT '净值',
    purchase_date DATE COMMENT '购置日期',
    warranty_period INT COMMENT '保修期(月)',
    depreciation_rate DECIMAL(5,2) COMMENT '折旧率(%)',
    
    -- 使用信息
    status VARCHAR(32) DEFAULT 'IDLE' COMMENT '状态: IDLE-闲置 IN_USE-使用中 MAINTENANCE-维修中 SCRAPPED-已报废',
    dept_id BIGINT COMMENT '使用部门ID',
    user_id BIGINT COMMENT '使用人ID',
    location VARCHAR(256) COMMENT '存放位置',
    
    -- RFID信息
    rfid_tag VARCHAR(128) UNIQUE COMMENT 'RFID标签号',
    is_important TINYINT DEFAULT 0 COMMENT '是否重要设备: 0-否 1-是',
    
    -- 备注
    description TEXT COMMENT '资产描述',
    remark TEXT COMMENT '备注',
    
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_asset_no (asset_no),
    INDEX idx_category_id (category_id),
    INDEX idx_status (status),
    INDEX idx_dept_id (dept_id),
    INDEX idx_user_id (user_id),
    INDEX idx_rfid_tag (rfid_tag),
    INDEX idx_is_important (is_important)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产台账表';

-- 资产变更历史表
CREATE TABLE asset_change_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    change_type VARCHAR(64) NOT NULL COMMENT '变更类型: TRANSFER-调拨 ALLOCATION-分配 RETURN-归还 MAINTENANCE-维修 SCRAP-报废',
    old_value TEXT COMMENT '变更前值(JSON)',
    new_value TEXT COMMENT '变更后值(JSON)',
    reason VARCHAR(512) COMMENT '变更原因',
    operator_id BIGINT COMMENT '操作人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_asset_id (asset_id),
    INDEX idx_change_type (change_type),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产变更历史表';

-- ==========================================
-- 3. 重要设备管理模块
-- ==========================================

-- 设备维护保养记录表
CREATE TABLE maintenance_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    maintenance_type VARCHAR(32) NOT NULL COMMENT '类型: ROUTINE-例行保养 REPAIR-维修 INSPECTION-检查',
    maintenance_date DATE NOT NULL COMMENT '保养日期',
    next_maintenance_date DATE COMMENT '下次保养日期',
    
    cost DECIMAL(10,2) DEFAULT 0.00 COMMENT '费用',
    executor VARCHAR(128) COMMENT '执行人',
    content TEXT COMMENT '保养内容',
    result VARCHAR(32) COMMENT '结果: NORMAL-正常 ABNORMAL-异常',
    remark TEXT COMMENT '备注',
    
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_asset_id (asset_id),
    INDEX idx_maintenance_date (maintenance_date),
    INDEX idx_maintenance_type (maintenance_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护保养记录表';

-- ==========================================
-- 4. RFID盘点模块
-- ==========================================

-- 盘点任务表
CREATE TABLE inventory_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '任务ID',
    task_no VARCHAR(128) NOT NULL UNIQUE COMMENT '任务编号',
    task_name VARCHAR(256) NOT NULL COMMENT '任务名称',
    inventory_type VARCHAR(32) NOT NULL COMMENT '盘点类型: FULL-全盘 PARTIAL-抽盘 DEPT-部门盘点',
    
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT '状态: PENDING-待开始 IN_PROGRESS-进行中 COMPLETED-已完成 CANCELLED-已取消',
    
    dept_ids TEXT COMMENT '盘点部门ID列表(JSON)',
    start_date DATE COMMENT '开始日期',
    end_date DATE COMMENT '结束日期',
    
    total_count INT DEFAULT 0 COMMENT '应盘总数',
    scanned_count INT DEFAULT 0 COMMENT '已盘数量',
    match_count INT DEFAULT 0 COMMENT '盘盈数量',
    loss_count INT DEFAULT 0 COMMENT '盘亏数量',
    
    executor_id BIGINT COMMENT '执行人ID',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_task_no (task_no),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点任务表';

-- 盘点明细表
CREATE TABLE inventory_detail (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '明细ID',
    task_id BIGINT NOT NULL COMMENT '任务ID',
    asset_id BIGINT COMMENT '资产ID',
    rfid_tag VARCHAR(128) COMMENT 'RFID标签',
    
    status VARCHAR(32) COMMENT '状态: MATCH-账实相符 SURPLUS-盘盈 LOSS-盘亏 LOCATION_DIFF-位置不符',
    expected_location VARCHAR(256) COMMENT '账面位置',
    actual_location VARCHAR(256) COMMENT '实际位置',
    
    scan_time DATETIME COMMENT '扫描时间',
    remark VARCHAR(512) COMMENT '备注',
    
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_task_id (task_id),
    INDEX idx_asset_id (asset_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点明细表';

-- ==========================================
-- 5. 闲置资产与赔偿模块
-- ==========================================

-- 闲置资产公告表
CREATE TABLE idle_asset_notice (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '公告ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    idle_days INT DEFAULT 0 COMMENT '闲置天数',
    notice_date DATE COMMENT '公告日期',
    status VARCHAR(32) DEFAULT 'PUBLISHED' COMMENT '状态: PUBLISHED-已发布 CLAIMED-已认领 DISPOSED-已处置',
    
    claimant_id BIGINT COMMENT '认领人ID',
    claim_date DATE COMMENT '认领日期',
    
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_asset_id (asset_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='闲置资产公告表';

-- 资产赔偿表
CREATE TABLE asset_compensation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '赔偿ID',
    compensation_no VARCHAR(128) NOT NULL UNIQUE COMMENT '赔偿单号',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    
    compensation_type VARCHAR(32) NOT NULL COMMENT '赔偿类型: DAMAGE-损坏 LOSS-丢失 MALFUNCTION-人为故障',
    compensation_amount DECIMAL(10,2) NOT NULL COMMENT '赔偿金额',
    
    responsible_user_id BIGINT NOT NULL COMMENT '责任人ID',
    responsible_dept_id BIGINT COMMENT '责任部门ID',
    
    incident_date DATE COMMENT '事故日期',
    description TEXT COMMENT '事故描述',
    
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT '状态: PENDING-待审批 APPROVED-已批准 REJECTED-已驳回 PAID-已支付',
    
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_compensation_no (compensation_no),
    INDEX idx_asset_id (asset_id),
    INDEX idx_responsible_user_id (responsible_user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产赔偿表';

-- ==========================================
-- 6. 审批流程模块
-- ==========================================

-- 审批流程表
CREATE TABLE approval_process (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '流程ID',
    process_no VARCHAR(128) NOT NULL UNIQUE COMMENT '流程编号',
    process_type VARCHAR(64) NOT NULL COMMENT '流程类型: ASSET_APPLY-资产申请 TRANSFER-调拨 SCRAP-报废 COMPENSATION-赔偿',
    
    business_id BIGINT NOT NULL COMMENT '业务单据ID',
    business_data TEXT COMMENT '业务数据(JSON)',
    
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT '状态: PENDING-待审批 APPROVED-已通过 REJECTED-已驳回 CANCELLED-已取消',
    current_step INT DEFAULT 1 COMMENT '当前步骤',
    
    applicant_id BIGINT NOT NULL COMMENT '申请人ID',
    apply_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
    
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_process_no (process_no),
    INDEX idx_process_type (process_type),
    INDEX idx_status (status),
    INDEX idx_applicant_id (applicant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批流程表';

-- 审批记录表
CREATE TABLE approval_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
    process_id BIGINT NOT NULL COMMENT '流程ID',
    step_no INT NOT NULL COMMENT '步骤序号',
    
    approver_id BIGINT NOT NULL COMMENT '审批人ID',
    approve_result VARCHAR(32) COMMENT '审批结果: APPROVED-通过 REJECTED-驳回',
    approve_opinion TEXT COMMENT '审批意见',
    approve_time DATETIME COMMENT '审批时间',
    
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_process_id (process_id),
    INDEX idx_approver_id (approver_id),
    INDEX idx_approve_time (approve_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批记录表';

-- ==========================================
-- 7. 附件管理
-- ==========================================

-- 附件表
CREATE TABLE sys_attachment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '附件ID',
    business_type VARCHAR(64) NOT NULL COMMENT '业务类型: ASSET-资产 MAINTENANCE-维护 COMPENSATION-赔偿',
    business_id BIGINT NOT NULL COMMENT '业务ID',
    
    file_name VARCHAR(256) NOT NULL COMMENT '文件名',
    file_path VARCHAR(512) NOT NULL COMMENT '文件路径',
    file_size BIGINT COMMENT '文件大小(字节)',
    file_type VARCHAR(64) COMMENT '文件类型',
    
    upload_by BIGINT COMMENT '上传人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除',
    
    INDEX idx_business (business_type, business_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='附件表';

-- ==========================================
-- 初始化数据
-- ==========================================

-- 插入默认部门
INSERT INTO sys_dept (dept_name, dept_code, parent_id, sort_order, leader, status) VALUES
('总公司', 'HQ', 0, 1, '系统管理员', 1),
('行政部', 'ADMIN', 1, 2, '张三', 1),
('IT部', 'IT', 1, 3, '李四', 1),
('财务部', 'FINANCE', 1, 4, '王五', 1),
('人力资源部', 'HR', 1, 5, '赵六', 1);

-- 插入默认角色
INSERT INTO sys_role (role_name, role_code, description, sort_order, status) VALUES
('超级管理员', 'SUPER_ADMIN', '系统超级管理员,拥有所有权限', 1, 1),
('资产管理员', 'ASSET_ADMIN', '资产管理员,负责资产管理', 2, 1),
('部门主管', 'DEPT_MANAGER', '部门主管,管理本部门资产', 3, 1),
('普通用户', 'USER', '普通用户,可查看和使用资产', 4, 1);

-- 插入默认用户 (密码为: admin123, 需要在应用层加密)
INSERT INTO sys_user (username, password, real_name, email, phone, status, dept_id) VALUES
('admin', '$2a$10$XYZ...', '系统管理员', 'admin@ams.com', '13800138000', 1, 1);

-- 插入用户角色关联
INSERT INTO sys_user_role (user_id, role_id) VALUES (1, 1);

-- 插入默认资产分类
INSERT INTO asset_category (category_name, category_code, parent_id, sort_order, description) VALUES
('电子设备', 'ELECTRONIC', 0, 1, '电子类设备'),
('办公设备', 'OFFICE', 0, 2, '办公类设备'),
('家具类', 'FURNITURE', 0, 3, '家具类资产'),
('计算机', 'COMPUTER', 1, 4, '计算机及配件'),
('网络设备', 'NETWORK', 1, 5, '网络设备'),
('打印机', 'PRINTER', 2, 6, '打印机扫描仪等'),
('办公桌椅', 'DESK_CHAIR', 3, 7, '办公桌椅');

-- ==========================================
-- 说明
-- ==========================================
-- 1. 所有表均使用逻辑删除,便于数据恢复和审计
-- 2. 时间字段统一使用DATETIME类型,时区为Asia/Shanghai
-- 3. 金额字段使用DECIMAL(15,2),避免精度丢失
-- 4. 所有外键关系通过应用层维护,提高性能
-- 5. 核心查询字段均建立索引
