-- V3_46__inspection_template.sql
-- Phase 5: 盘点深化+合规管理 — T5.2 检验/年检管理增强
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行

-- ─────────────────────────────────────────────────────────────────────────────
-- T5.2: 检验模板表
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_template (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(256) NOT NULL COMMENT '模板名称',
    type VARCHAR(32) NOT NULL COMMENT 'ANNUAL/PERIODIC/SPECIAL',
    frequency INT DEFAULT 12 COMMENT '检验周期（月数）',
    category_ids TEXT COMMENT '适用的资产类别ID列表(JSON数组)',
    check_items TEXT COMMENT '检查项(JSON数组)',
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) DEFAULT 'ACTIVE' COMMENT 'ACTIVE/DISABLED',
    create_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_temp_tenant (tenant_id, deleted),
    INDEX idx_temp_type_tenant (type, tenant_id, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检验模板表';

-- ─────────────────────────────────────────────────────────────────────────────
-- 补充 inspection 表字段
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE inspection
ADD COLUMN IF NOT EXISTS template_id BIGINT COMMENT '检验模板ID',
ADD COLUMN IF NOT EXISTS photos TEXT COMMENT '检验照片(JSON数组)',
ADD COLUMN IF NOT EXISTS findings TEXT COMMENT '检查发现';

-- 添加模板关联索引
ALTER TABLE inspection
ADD INDEX IF NOT EXISTS idx_insp_template (template_id);

-- 添加复合索引以提升历史查询性能
ALTER TABLE inspection
ADD INDEX IF NOT EXISTS idx_insp_asset_tenant (asset_id, tenant_id, deleted);

-- ─────────────────────────────────────────────────────────────────────────────
-- sys_menu 权限种子数据
-- ─────────────────────────────────────────────────────────────────────────────
-- 检验模板管理权限
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (248, '检验模板管理', 224, 6, 'C', 'inspection:template:list', '#', 0, 0),
    (249, '检验模板查询', 248, 1, 'F', 'inspection:template:query', '#', 1, 0),
    (250, '检验模板新增', 248, 2, 'F', 'inspection:template:create', '#', 1, 0),
    (251, '检验模板修改', 248, 3, 'F', 'inspection:template:edit', '#', 1, 0),
    (252, '检验模板删除', 248, 4, 'F', 'inspection:template:remove', '#', 1, 0),
    -- 检验记录管理权限
    (253, '检验自动生成', 224, 7, 'F', 'inspection:auto-generate', '#', 1, 0),
    (254, '检验历史', 224, 8, 'F', 'inspection:history', '#', 1, 0)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 给管理员角色分配新权限
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 248), (1, 249), (1, 250), (1, 251), (1, 252), (1, 253), (1, 254)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);