-- V2_85__flow_designer_append_only
-- Day2 system-flow-designer 最小闭环：新增不可变版本/回滚审计表与流程设计器权限种子。
-- Append-only 说明：只 CREATE 新表、新索引并 INSERT 新权限/角色绑定，不 drop、rename、truncate 或重建既有表。
-- 回滚风险说明：如需回滚本能力，应停用新接口和权限；workflow_definition_version 中的发布/回滚审计证据需保留供追溯，不建议物理删除。

CREATE TABLE IF NOT EXISTS workflow_definition_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    definition_id BIGINT NOT NULL,
    business_type VARCHAR(64) NOT NULL,
    version INT NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    definition_json LONGTEXT NOT NULL,
    publish_note VARCHAR(512),
    impact_scope VARCHAR(512),
    rollback_plan VARCHAR(512),
    rollback_source_version INT,
    operator_id BIGINT NOT NULL,
    published_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_workflow_definition_version_tenant_business (tenant_id, business_type, version),
    INDEX idx_workflow_definition_version_definition (definition_id, version),
    INDEX idx_workflow_definition_version_action (tenant_id, action_type, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('流程设计器查询', 'system:flow:query', '流程平台流程设计器查询权限', 1),
    ('流程设计器编辑', 'workflow:designer:edit', '流程设计器草稿保存与图结构校验权限', 1),
    ('流程设计器发布', 'workflow:designer:publish', '流程设计器发布权限', 1),
    ('流程设计器回滚', 'workflow:designer:rollback', '流程设计器版本恢复权限', 1)
ON DUPLICATE KEY UPDATE
    permission_name = VALUES(permission_name),
    description = VALUES(description),
    status = VALUES(status);

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'system:flow:query',
    'workflow:designer:edit',
    'workflow:designer:publish',
    'workflow:designer:rollback'
)
WHERE r.role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
