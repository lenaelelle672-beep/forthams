-- V3_40__tco.sql
-- Phase 4: T4.1 TCO 全生命周期成本视图 — TCO记录表 + 权限种子
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- IDs 235-237 未被占用

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. tco_record — TCO 记录表（预计算结果）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tco_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
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
    current_value DECIMAL(12,2) DEFAULT 0.00 COMMENT '当前净值(残值)',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tco_tenant (tenant_id),
    INDEX idx_tco_asset (asset_id),
    INDEX idx_tco_date (calculation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='TCO记录表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sys_menu 权限种子数据
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (235, 'TCO分析', 0, 21, 'M', 'tco:query', 'bar-chart-2', 1, 1),
    (236, '资产TCO查询', 235, 1, 'F', 'tco:query', NULL, 1, 1),
    (237, 'TCO趋势查看', 235, 2, 'F', 'tco:trend', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 235), (1, 236), (1, 237)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
