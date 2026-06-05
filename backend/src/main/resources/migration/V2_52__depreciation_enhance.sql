-- V3_38__depreciation_enhance.sql
-- Phase 4: T4.4 折旧方法扩展 — 折旧明细记录表 + Asset 表扩展 + 权限种子
-- 幂等设计（IF NOT EXISTS / IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- IDs 224-228 未被占用

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. depreciation_record — 折旧明细记录表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS depreciation_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    method VARCHAR(32) NOT NULL COMMENT '折旧方法: STRAIGHT_LINE/DOUBLE_DECLINING/SYD/UOP',
    period_start DATE NOT NULL COMMENT '期间开始',
    period_end DATE NOT NULL COMMENT '期间结束',
    depreciation_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '折旧金额',
    book_value_before DECIMAL(12,2) DEFAULT NULL COMMENT '折旧前账面价值',
    book_value_after DECIMAL(12,2) DEFAULT NULL COMMENT '折旧后账面价值',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_depr_tenant (tenant_id, deleted),
    INDEX idx_depr_asset (asset_id),
    INDEX idx_depr_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='折旧明细记录表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Asset 表扩展列（折旧方法、工作量法字段）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE asset
    ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(12,2) DEFAULT 0.00 COMMENT '采购成本(原值)';

ALTER TABLE asset
    ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(32) DEFAULT 'STRAIGHT_LINE' COMMENT '折旧方法';

ALTER TABLE asset
    ADD COLUMN IF NOT EXISTS total_expected_units DECIMAL(12,2) DEFAULT NULL COMMENT '总预期工作量(UOP)';

ALTER TABLE asset
    ADD COLUMN IF NOT EXISTS actual_units DECIMAL(12,2) DEFAULT NULL COMMENT '实际已工作量(UOP)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. sys_menu 权限种子数据
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (224, '折旧明细', 0, 19, 'M', 'depreciation:query', 'trending-down', 1, 1),
    (225, '折旧查询', 224, 1, 'F', 'depreciation:query', NULL, 1, 1),
    (226, '折旧计算', 224, 2, 'F', 'depreciation:calculate', NULL, 1, 1),
    (227, '折旧记录', 224, 3, 'F', 'depreciation:records', NULL, 1, 1),
    (228, '折旧方法查看', 224, 4, 'F', 'depreciation:methods', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 224), (1, 225), (1, 226), (1, 227), (1, 228)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
