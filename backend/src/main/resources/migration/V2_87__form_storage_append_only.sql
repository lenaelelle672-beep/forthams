-- V2_87__form_storage_append_only
-- Day4 system-form-storage 最小闭环：新增表单实例、字段值、附件引用表、索引与幂等权限/菜单种子。
-- Append-only 说明：只 CREATE 新表、新索引并 INSERT 新权限/菜单/角色绑定，不移除历史对象或破坏既有结构。
-- 回滚风险说明：如需回滚本能力，应停用 /form-storage 接口和菜单权限；实例、字段值与附件引用留痕需保留供审计追溯，不建议物理移除。

CREATE TABLE IF NOT EXISTS form_instance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    form_key VARCHAR(64) NOT NULL,
    definition_version INT NOT NULL,
    business_key VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    field_summary VARCHAR(512),
    attachment_summary VARCHAR(512),
    audit_summary VARCHAR(512),
    created_by BIGINT NOT NULL,
    updated_by BIGINT,
    archived_by BIGINT,
    archived_at DATETIME,
    archive_reason VARCHAR(512),
    deleted_by BIGINT,
    deleted_at DATETIME,
    delete_reason VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_form_instance_tenant_form (tenant_id, form_key, definition_version),
    INDEX idx_form_instance_tenant_status (tenant_id, status, update_time),
    INDEX idx_form_instance_business (tenant_id, business_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_field_value (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    instance_id BIGINT NOT NULL,
    form_key VARCHAR(64) NOT NULL,
    field_key VARCHAR(64) NOT NULL,
    field_label VARCHAR(128) NOT NULL,
    value_type VARCHAR(32) NOT NULL,
    value_text TEXT,
    value_json LONGTEXT,
    sensitive TINYINT DEFAULT 0,
    masked_value VARCHAR(256) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_form_field_value_instance_key (tenant_id, instance_id, field_key),
    INDEX idx_form_field_value_tenant_form (tenant_id, form_key),
    INDEX idx_form_field_value_instance (instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_attachment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    instance_id BIGINT NOT NULL,
    form_key VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(128),
    file_size BIGINT DEFAULT 0,
    reference_key VARCHAR(64) NOT NULL,
    storage_ref_hash VARCHAR(128) NOT NULL,
    masked_storage_key VARCHAR(128) NOT NULL,
    masked_url VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    audit_summary VARCHAR(512),
    created_by BIGINT NOT NULL,
    deleted_by BIGINT,
    deleted_at DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_form_attachment_tenant_instance (tenant_id, instance_id, status),
    INDEX idx_form_attachment_tenant_form (tenant_id, form_key),
    INDEX idx_form_attachment_hash (storage_ref_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('表单存储查看', 'workflow:form-storage:view', '流程平台表单实例列表、详情和附件引用查看权限', 1),
    ('表单存储创建', 'workflow:form-storage:create', '流程平台表单实例创建权限', 1),
    ('表单存储更新', 'workflow:form-storage:update', '流程平台表单实例字段值更新与附件引用登记权限', 1),
    ('表单存储归档', 'workflow:form-storage:archive', '流程平台表单实例归档高危权限', 1),
    ('表单存储删除留痕', 'workflow:form-storage:delete', '流程平台表单实例和附件引用删除留痕高危权限', 1),
    ('表单存储脱敏导出', 'workflow:form-storage:export', '流程平台表单实例脱敏导出权限', 1)
ON DUPLICATE KEY UPDATE
    permission_name = VALUES(permission_name),
    description = VALUES(description),
    status = VALUES(status);

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (393, '表单存储', 310, 50, 'fixed-assets/workbenchv3', 'menu=system-form-storage', 'workbench-v3/WorkbenchV3Page', 'C', 'workflow:form-storage:view', 'database', 1, 1),
    (394, '表单存储查看', 393, 1, NULL, NULL, NULL, 'F', 'workflow:form-storage:view', NULL, 1, 1),
    (395, '表单存储创建', 393, 2, NULL, NULL, NULL, 'F', 'workflow:form-storage:create', NULL, 1, 1),
    (396, '表单存储更新', 393, 3, NULL, NULL, NULL, 'F', 'workflow:form-storage:update', NULL, 1, 1),
    (397, '表单存储归档', 393, 4, NULL, NULL, NULL, 'F', 'workflow:form-storage:archive', NULL, 1, 1),
    (398, '表单存储删除留痕', 393, 5, NULL, NULL, NULL, 'F', 'workflow:form-storage:delete', NULL, 1, 1),
    (399, '表单存储脱敏导出', 393, 6, NULL, NULL, NULL, 'F', 'workflow:form-storage:export', NULL, 1, 1)
ON DUPLICATE KEY UPDATE
    menu_name = VALUES(menu_name),
    parent_id = VALUES(parent_id),
    sort_order = VALUES(sort_order),
    path = VALUES(path),
    query_param = VALUES(query_param),
    component = VALUES(component),
    menu_type = VALUES(menu_type),
    perms = VALUES(perms),
    icon = VALUES(icon),
    visible = VALUES(visible),
    status = VALUES(status);

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'workflow:form-storage:view',
    'workflow:form-storage:create',
    'workflow:form-storage:update',
    'workflow:form-storage:archive',
    'workflow:form-storage:delete',
    'workflow:form-storage:export'
)
WHERE r.role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (393, 394, 395, 396, 397, 398, 399)
WHERE r.role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
