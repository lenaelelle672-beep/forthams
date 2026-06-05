-- V3_37__insurance.sql
-- Phase 4: T4.3 保险管理 — 保险表 + 理赔表 + 权限种子
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- IDs 218-223 未被占用

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. insurance — 保险表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_no VARCHAR(128) NOT NULL COMMENT '保单号',
    insurance_name VARCHAR(256) NOT NULL COMMENT '保险名称',
    insurance_type VARCHAR(32) NOT NULL COMMENT 'PROPERTY/LIABILITY/VEHICLE',
    asset_ids JSON COMMENT '关联资产ID数组',
    insurer VARCHAR(256) COMMENT '保险公司',
    premium DECIMAL(12,2) DEFAULT 0.00 COMMENT '保费',
    coverage DECIMAL(12,2) DEFAULT 0.00 COMMENT '保额',
    deductible DECIMAL(12,2) DEFAULT 0.00 COMMENT '免赔额',
    start_date DATE NOT NULL COMMENT '生效日',
    end_date DATE NOT NULL COMMENT '到期日',
    status VARCHAR(32) DEFAULT 'ACTIVE' COMMENT 'ACTIVE/EXPIRED/CANCELLED',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_ins_tenant (tenant_id, deleted),
    INDEX idx_ins_policy (policy_no),
    INDEX idx_ins_dates (start_date, end_date),
    INDEX idx_ins_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保险表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. insurance_claim — 理赔记录表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_claim (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    insurance_id BIGINT NOT NULL COMMENT '关联保险ID',
    claim_no VARCHAR(128) COMMENT '理赔编号',
    claim_date DATE NOT NULL COMMENT '理赔日期',
    claim_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '理赔金额',
    description VARCHAR(1000) COMMENT '理赔描述',
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT 'PENDING/SETTLED/REJECTED',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_claim_insurance (insurance_id),
    INDEX idx_claim_tenant (tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保险理赔记录表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. sys_menu 权限种子数据（父菜单=无，新建一级菜单）
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (218, '保险管理', 0, 18, 'M', 'insurance:query', 'shield', 1, 1),
    (219, '保险查询', 218, 1, 'F', 'insurance:query', NULL, 1, 1),
    (220, '保险新增', 218, 2, 'F', 'insurance:create', NULL, 1, 1),
    (221, '保险编辑', 218, 3, 'F', 'insurance:edit', NULL, 1, 1),
    (222, '保险删除', 218, 4, 'F', 'insurance:delete', NULL, 1, 1),
    (223, '理赔管理', 218, 5, 'F', 'insurance:claim', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- SUPER_ADMIN 角色绑定新菜单
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 218), (1, 219), (1, 220), (1, 221), (1, 222), (1, 223)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
