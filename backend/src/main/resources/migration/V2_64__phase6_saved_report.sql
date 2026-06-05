-- V3_45__phase6_saved_report.sql
-- Phase 6: T6.6 自定义报表构建器 — saved_report 表 + 权限种子
-- 幂等设计（IF NOT EXISTS / ON DUPLICATE KEY UPDATE），可重复执行
-- Menu IDs: 257-261

CREATE TABLE IF NOT EXISTS saved_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_name VARCHAR(256) NOT NULL COMMENT '报表名称',
    report_type VARCHAR(32) NOT NULL COMMENT 'ASSET/MAINTENANCE/FINANCIAL/INVENTORY',
    config_json TEXT NOT NULL COMMENT '配置JSON(字段选择/分组/排序/过滤/图表类型)',
    is_public TINYINT DEFAULT 0 COMMENT '是否公开',
    created_by BIGINT COMMENT '创建人',
    tenant_id VARCHAR(64) NOT NULL,
    deleted TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sr_tenant (tenant_id, deleted),
    INDEX idx_sr_type (report_type),
    INDEX idx_sr_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='已保存报表配置表';

-- 权限种子
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (257, '自定义报表', 0, 29, 'M', 'saved-report:query', 'file-bar-chart', 1, 1),
    (258, '报表查询', 257, 1, 'F', 'saved-report:query', NULL, 1, 1),
    (259, '报表新增', 257, 2, 'F', 'saved-report:create', NULL, 1, 1),
    (260, '报表编辑', 257, 3, 'F', 'saved-report:edit', NULL, 1, 1),
    (261, '报表删除', 257, 4, 'F', 'saved-report:remove', NULL, 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 257), (1, 258), (1, 259), (1, 260), (1, 261)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
