-- V2_92__system_config_append_only
-- system-base-params：新增 SYSTEM 基础参数表、索引和 Workbench V3 基础参数菜单权限种子。
-- Append-only：只新增 system_config、索引和 system-base-params 相关权限/菜单/角色绑定。

CREATE TABLE IF NOT EXISTS system_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    config_group VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
    config_key VARCHAR(128) NOT NULL,
    config_value VARCHAR(1024),
    config_name VARCHAR(128) NOT NULL,
    config_type VARCHAR(32) NOT NULL DEFAULT 'STRING',
    status TINYINT NOT NULL DEFAULT 0,
    remark VARCHAR(512),
    sensitive_masked TINYINT(1) NOT NULL DEFAULT 0,
    last_operator_id BIGINT,
    last_operation VARCHAR(32),
    last_operation_reason VARCHAR(512),
    audit_evidence_summary VARCHAR(512),
    removed TINYINT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_system_config_tenant_group_key (tenant_id, config_group, config_key),
    INDEX idx_system_config_group_status (tenant_id, config_group, status),
    INDEX idx_system_config_updated (tenant_id, config_group, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('系统基础参数查看', 'system:config:query', 'SYSTEM 基础参数目录与详情查看权限', 1),
    ('系统基础参数编辑', 'system:config:edit', 'SYSTEM 基础参数创建与更新权限', 1),
    ('系统基础参数移除', 'system:config:delete', 'SYSTEM 基础参数逻辑移除权限', 1),
    ('系统基础参数预演', 'system:config:preview', 'SYSTEM 基础参数影响预演权限', 1),
    ('系统基础参数缓存刷新', 'system:config:refresh', 'SYSTEM 基础参数缓存刷新权限', 1)
;

INSERT IGNORE INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (422, '基础参数', 310, 10, 'fixed-assets/workbenchv3', 'menu=system-base-params', 'workbench-v3/WorkbenchV3Page', 'C', 'system:config:query', 'setting', 1, 1),
    (423, '基础参数查看', 422, 1, NULL, NULL, NULL, 'F', 'system:config:query', NULL, 1, 1),
    (424, '基础参数编辑', 422, 2, NULL, NULL, NULL, 'F', 'system:config:edit', NULL, 1, 1),
    (425, '基础参数移除', 422, 3, NULL, NULL, NULL, 'F', 'system:config:delete', NULL, 1, 1),
    (426, '基础参数预演', 422, 4, NULL, NULL, NULL, 'F', 'system:config:preview', NULL, 1, 1),
    (427, '基础参数缓存刷新', 422, 5, NULL, NULL, NULL, 'F', 'system:config:refresh', NULL, 1, 1)
;

INSERT IGNORE INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'system:config:query',
    'system:config:edit',
    'system:config:delete',
    'system:config:preview',
    'system:config:refresh'
)
WHERE r.role_code = 'SUPER_ADMIN';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (422, 423, 424, 425, 426, 427)
WHERE r.role_code = 'SUPER_ADMIN';
