-- V3_41__budget.sql
-- Phase 4: T4.2 资产预算管理 — 预算表 + 权限种子
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- IDs 238-243 未被占用

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. budget — 资产预算表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    budget_year INT NOT NULL COMMENT '预算年度',
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    dept_id BIGINT COMMENT '部门ID',
    category_id BIGINT COMMENT '资产分类ID',
    budget_type VARCHAR(32) NOT NULL COMMENT '预算类型: PURCHASE/MAINTENANCE/OPERATION',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '预算总额',
    used_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '已使用金额',
    committed_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '已承诺金额',
    status VARCHAR(32) DEFAULT 'DRAFT' COMMENT '状态: DRAFT/APPROVED/CLOSED',
    approved_by BIGINT COMMENT '审批人ID',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_budget_tenant (tenant_id, deleted),
    INDEX idx_budget_year (budget_year),
    INDEX idx_budget_dept (dept_id),
    INDEX idx_budget_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产预算表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sys_menu 权限种子数据
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (238, '预算管理', 0, 22, 'M', 'budget:query', 'wallet', 1, 1),
    (239, '预算查询', 238, 1, 'F', 'budget:query', NULL, 1, 1),
    (240, '预算新增', 238, 2, 'F', 'budget:create', NULL, 1, 1),
    (241, '预算编辑', 238, 3, 'F', 'budget:edit', NULL, 1, 1),
    (242, '预算删除', 238, 4, 'F', 'budget:delete', NULL, 1, 1),
    (243, '预算审批', 238, 5, 'F', 'budget:approve', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 238), (1, 239), (1, 240), (1, 241), (1, 242), (1, 243)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
