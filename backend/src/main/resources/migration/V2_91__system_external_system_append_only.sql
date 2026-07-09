-- V2_91__system_external_system_append_only
-- system-external-systems：新增外部系统目录、掩码认证摘要、config-only 校验状态与幂等菜单权限种子。
-- Append-only：只新增表、索引和 system-external-systems 相关权限/菜单/角色绑定；回退时停用入口并保留审计数据。

CREATE TABLE IF NOT EXISTS system_external_system (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    system_code VARCHAR(64) NOT NULL,
    system_name VARCHAR(128) NOT NULL,
    system_type VARCHAR(32) NOT NULL,
    base_url_masked VARCHAR(512) NOT NULL,
    auth_type VARCHAR(32) NOT NULL DEFAULT 'NONE',
    auth_config_summary VARCHAR(512),
    auth_configured TINYINT(1) NOT NULL DEFAULT 0,
    config_masked TINYINT(1) NOT NULL DEFAULT 0,
    masked_secret_summary VARCHAR(512),
    secret_fingerprint VARCHAR(64),
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'DISABLED',
    health_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    last_validation_status VARCHAR(32),
    last_validation_message VARCHAR(512),
    last_validation_at DATETIME,
    last_operator_id BIGINT,
    last_operation VARCHAR(32),
    last_operation_reason VARCHAR(512),
    audit_evidence_summary VARCHAR(512),
    removed TINYINT NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_system_external_system_tenant_code (tenant_id, system_code),
    INDEX idx_system_external_system_status (tenant_id, status),
    INDEX idx_system_external_system_type (tenant_id, system_type),
    INDEX idx_system_external_system_updated (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('系统集成查看', 'system:integration:query', '系统集成配置目录、外部系统和接口查看权限', 1),
    ('系统集成编辑', 'system:integration:edit', '系统集成配置创建、更新、启用和停用权限', 1),
    ('系统集成校验', 'system:integration:test', '系统集成配置 config-only 校验权限', 1)
;

INSERT IGNORE INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (418, '外部系统', 310, 90, 'fixed-assets/workbenchv3', 'menu=system-external-systems', 'workbench-v3/WorkbenchV3Page', 'C', 'system:integration:query', 'database', 1, 1),
    (419, '外部系统查看', 418, 1, NULL, NULL, NULL, 'F', 'system:integration:query', NULL, 1, 1),
    (420, '外部系统编辑', 418, 2, NULL, NULL, NULL, 'F', 'system:integration:edit', NULL, 1, 1),
    (421, '外部系统校验', 418, 3, NULL, NULL, NULL, 'F', 'system:integration:test', NULL, 1, 1)
;

INSERT IGNORE INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'system:integration:query',
    'system:integration:edit',
    'system:integration:test'
)
WHERE r.role_code = 'SUPER_ADMIN';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (418, 419, 420, 421)
WHERE r.role_code = 'SUPER_ADMIN';
