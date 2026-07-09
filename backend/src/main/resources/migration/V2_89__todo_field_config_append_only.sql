-- V2_89__todo_field_config_append_only
-- Day5 system-todo-fields：新增待办字段配置与角色覆盖表、索引与幂等权限/菜单种子。
-- Append-only 说明：只 CREATE 新表/索引并 INSERT 新权限、菜单、角色绑定；默认恢复通过前向更新配置完成，保留审计摘要。

CREATE TABLE IF NOT EXISTS todo_field_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    field_key VARCHAR(96) NOT NULL,
    field_label VARCHAR(128) NOT NULL,
    visible TINYINT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL,
    sensitive TINYINT DEFAULT 0,
    default_field TINYINT DEFAULT 0,
    audit_summary VARCHAR(512),
    updated_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_todo_field_config_key (tenant_id, field_key),
    INDEX idx_todo_field_config_order (tenant_id, visible, sort_order),
    INDEX idx_todo_field_config_update_time (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS todo_field_role_override (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    field_key VARCHAR(96) NOT NULL,
    override_visible TINYINT,
    override_sort_order INT,
    explanation VARCHAR(512),
    audit_summary VARCHAR(512),
    updated_by BIGINT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_todo_field_role_override (tenant_id, role_code, field_key),
    INDEX idx_todo_field_role_order (tenant_id, role_code, override_sort_order),
    INDEX idx_todo_field_role_update_time (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('待办字段查看', 'workflow:todo-field:list', '流程平台待办字段配置查看和预览权限', 1),
    ('待办字段更新', 'workflow:todo-field:update', '流程平台待办字段保存、排序和角色覆盖权限', 1),
    ('待办字段默认恢复', 'workflow:todo-field:reset', '流程平台待办字段默认恢复高危权限', 1)
;

INSERT IGNORE INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (407, '待办字段配置', 310, 70, 'fixed-assets/workbenchv3', 'menu=system-todo-fields', 'workbench-v3/WorkbenchV3Page', 'C', 'workflow:todo-field:list', 'list-checks', 1, 1),
    (408, '待办字段查看', 407, 1, NULL, NULL, NULL, 'F', 'workflow:todo-field:list', NULL, 1, 1),
    (409, '待办字段更新', 407, 2, NULL, NULL, NULL, 'F', 'workflow:todo-field:update', NULL, 1, 1),
    (410, '待办字段默认恢复', 407, 3, NULL, NULL, NULL, 'F', 'workflow:todo-field:reset', NULL, 1, 1)
;

INSERT IGNORE INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'workflow:todo-field:list',
    'workflow:todo-field:update',
    'workflow:todo-field:reset'
)
WHERE r.role_code = 'SUPER_ADMIN';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (407, 408, 409, 410)
WHERE r.role_code = 'SUPER_ADMIN';
