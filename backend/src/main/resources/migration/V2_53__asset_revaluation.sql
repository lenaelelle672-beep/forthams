-- V3_39__asset_revaluation.sql
-- Phase 4: T4.5 资产减值/重估 — 减值重估表 + 权限种子
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- IDs 229-234 未被占用

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. asset_revaluation — 资产减值/重估表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_revaluation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL COMMENT '租户ID',
    asset_id BIGINT NOT NULL COMMENT '资产ID',
    revaluation_type VARCHAR(32) NOT NULL COMMENT '类型: IMPAIRMENT/REVALUATION',
    previous_value DECIMAL(12,2) NOT NULL COMMENT '原值',
    new_value DECIMAL(12,2) NOT NULL COMMENT '新值',
    reason VARCHAR(1000) COMMENT '原因说明',
    evidence VARCHAR(500) COMMENT '附件URL',
    status VARCHAR(32) DEFAULT 'PENDING' COMMENT '状态: PENDING/APPROVED/REJECTED',
    approved_by BIGINT COMMENT '审批人ID',
    approved_at DATETIME COMMENT '审批时间',
    create_by BIGINT COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_reval_tenant (tenant_id, deleted),
    INDEX idx_reval_asset (asset_id),
    INDEX idx_reval_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产减值重估表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sys_menu 权限种子数据
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (229, '减值重估', 0, 20, 'M', 'revaluation:query', 'trending-up', 1, 1),
    (230, '减值查询', 229, 1, 'F', 'revaluation:query', NULL, 1, 1),
    (231, '减值新增', 229, 2, 'F', 'revaluation:create', NULL, 1, 1),
    (232, '减值编辑', 229, 3, 'F', 'revaluation:edit', NULL, 1, 1),
    (233, '减值删除', 229, 4, 'F', 'revaluation:delete', NULL, 1, 1),
    (234, '减值审批', 229, 5, 'F', 'revaluation:approve', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 229), (1, 230), (1, 231), (1, 232), (1, 233), (1, 234)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
