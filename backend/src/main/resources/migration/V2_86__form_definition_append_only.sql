-- V2_86__form_definition_append_only
-- Day3 system-form-config 最小闭环：新增表单定义、不可变版本快照表、索引与幂等权限/菜单种子。
-- Append-only 说明：只 CREATE 新表、新索引并 INSERT 新权限/菜单/角色绑定，不移除历史对象或破坏既有结构。
-- 回滚风险说明：如需回滚本能力，应停用 /form-definitions 接口和菜单权限；form_definition_version 审计快照需保留供追溯，不建议物理删除。

CREATE TABLE IF NOT EXISTS form_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    form_key VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    schema_json LONGTEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'DRAFT',
    version INT DEFAULT 0,
    updated_by BIGINT,
    published_by BIGINT,
    published_at DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    UNIQUE KEY uk_form_definition_tenant_key (tenant_id, form_key),
    INDEX idx_form_definition_tenant_status (tenant_id, status),
    INDEX idx_form_definition_tenant_updated (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_definition_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    definition_id BIGINT NOT NULL,
    form_key VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    schema_json LONGTEXT NOT NULL,
    audit_reason VARCHAR(512) NOT NULL,
    impact_scope VARCHAR(512) NOT NULL,
    rollback_plan VARCHAR(512) NOT NULL,
    rollback_source_version INT,
    operator_id BIGINT NOT NULL,
    published_at DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_form_definition_version_tenant_key (tenant_id, form_key, version),
    INDEX idx_form_definition_version_definition (definition_id, version),
    INDEX idx_form_definition_version_action (tenant_id, action_type, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('表单定义列表', 'workflow:form:list', '流程平台表单定义列表权限', 1),
    ('表单定义查看', 'workflow:form:view', '流程平台表单定义详情、版本、预览和引用分析权限', 1),
    ('表单定义更新', 'workflow:form:update', '流程平台表单定义草稿保存与 schema 校验权限', 1),
    ('表单定义发布', 'workflow:form:publish', '流程平台表单定义发布权限', 1),
    ('表单定义停用', 'workflow:form:disable', '流程平台表单定义停用权限', 1),
    ('表单定义回滚', 'workflow:form:rollback', '流程平台表单定义版本回滚权限', 1)
ON DUPLICATE KEY UPDATE
    permission_name = VALUES(permission_name),
    description = VALUES(description),
    status = VALUES(status);

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (386, '表单配置', 310, 40, 'fixed-assets/workbenchv3', 'menu=system-form-config', 'workbench-v3/WorkbenchV3Page', 'C', 'workflow:form:view', 'form-input', 1, 1),
    (387, '表单配置列表', 386, 1, NULL, NULL, NULL, 'F', 'workflow:form:list', NULL, 1, 1),
    (388, '表单配置查看', 386, 2, NULL, NULL, NULL, 'F', 'workflow:form:view', NULL, 1, 1),
    (389, '表单配置更新', 386, 3, NULL, NULL, NULL, 'F', 'workflow:form:update', NULL, 1, 1),
    (390, '表单配置发布', 386, 4, NULL, NULL, NULL, 'F', 'workflow:form:publish', NULL, 1, 1),
    (391, '表单配置停用', 386, 5, NULL, NULL, NULL, 'F', 'workflow:form:disable', NULL, 1, 1),
    (392, '表单配置回滚', 386, 6, NULL, NULL, NULL, 'F', 'workflow:form:rollback', NULL, 1, 1)
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
    'workflow:form:list',
    'workflow:form:view',
    'workflow:form:update',
    'workflow:form:publish',
    'workflow:form:disable',
    'workflow:form:rollback'
)
WHERE r.role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (386, 387, 388, 389, 390, 391, 392)
WHERE r.role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
