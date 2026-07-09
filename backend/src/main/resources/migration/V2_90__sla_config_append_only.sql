-- V2_90__sla_config_append_only
-- Day6 system-sla-config：新增 SLA 策略、超时记录、索引与幂等权限/菜单种子。
-- Append-only 说明：只创建新表和索引并写入新权限、菜单、角色绑定；回退以停用接口和隐藏菜单为主，保留记录供审计追溯。

CREATE TABLE IF NOT EXISTS sla_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    process_key VARCHAR(64) NOT NULL,
    business_type VARCHAR(64),
    node_key VARCHAR(64) NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    response_hours INT NOT NULL,
    resolve_hours INT NOT NULL,
    warning_ratio DECIMAL(6,4) NOT NULL DEFAULT 0.7500,
    escalation_ratio DECIMAL(6,4) NOT NULL DEFAULT 0.9000,
    notification_targets LONGTEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'DISABLED',
    audit_summary VARCHAR(512),
    updated_by BIGINT,
    enabled_by BIGINT,
    enabled_at DATETIME,
    disabled_by BIGINT,
    disabled_at DATETIME,
    disabled_reason VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sla_config_scope (tenant_id, process_key, business_type, node_key, priority),
    INDEX idx_sla_config_status (tenant_id, status, process_key),
    INDEX idx_sla_config_update_time (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sla_timeout_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    config_id BIGINT,
    process_instance_id VARCHAR(96) NOT NULL,
    process_key VARCHAR(64) NOT NULL,
    business_type VARCHAR(64),
    node_key VARCHAR(64) NOT NULL,
    node_name VARCHAR(128),
    priority VARCHAR(32),
    response_due_at DATETIME,
    resolve_due_at DATETIME NOT NULL,
    timeout_at DATETIME NOT NULL,
    timeout_minutes BIGINT NOT NULL DEFAULT 0,
    risk_level VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    masked_business_summary VARCHAR(512),
    applicant_masked VARCHAR(128),
    assignee_masked VARCHAR(128),
    audit_summary VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sla_timeout_scope (tenant_id, process_instance_id, node_key, config_id, timeout_at),
    INDEX idx_sla_timeout_filter (tenant_id, process_key, node_key, status, risk_level),
    INDEX idx_sla_timeout_time (tenant_id, timeout_at),
    INDEX idx_sla_timeout_config (tenant_id, config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('SLA策略查看', 'workflow:sla:list', '流程平台SLA策略列表、详情、运行摘要和超时记录查看权限', 1),
    ('SLA策略更新', 'workflow:sla:update', '流程平台SLA策略更新权限', 1),
    ('SLA策略启用', 'workflow:sla:enable', '流程平台SLA策略启用高危权限', 1),
    ('SLA策略停用', 'workflow:sla:disable', '流程平台SLA策略停用高危权限', 1),
    ('SLA策略测试', 'workflow:sla:test', '流程平台SLA策略模拟权限', 1),
    ('SLA脱敏导出', 'workflow:sla:export', '流程平台SLA超时记录脱敏导出权限', 1)
;

INSERT IGNORE INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (411, 'SLA 配置', 310, 80, 'fixed-assets/workbenchv3', 'menu=system-sla-config', 'workbench-v3/WorkbenchV3Page', 'C', 'workflow:sla:list', 'timer', 1, 1),
    (412, 'SLA策略查看', 411, 1, NULL, NULL, NULL, 'F', 'workflow:sla:list', NULL, 1, 1),
    (413, 'SLA策略更新', 411, 2, NULL, NULL, NULL, 'F', 'workflow:sla:update', NULL, 1, 1),
    (414, 'SLA策略启用', 411, 3, NULL, NULL, NULL, 'F', 'workflow:sla:enable', NULL, 1, 1),
    (415, 'SLA策略停用', 411, 4, NULL, NULL, NULL, 'F', 'workflow:sla:disable', NULL, 1, 1),
    (416, 'SLA策略测试', 411, 5, NULL, NULL, NULL, 'F', 'workflow:sla:test', NULL, 1, 1),
    (417, 'SLA脱敏导出', 411, 6, NULL, NULL, NULL, 'F', 'workflow:sla:export', NULL, 1, 1)
;

INSERT IGNORE INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'workflow:sla:list',
    'workflow:sla:update',
    'workflow:sla:enable',
    'workflow:sla:disable',
    'workflow:sla:test',
    'workflow:sla:export'
)
WHERE r.role_code = 'SUPER_ADMIN';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (411, 412, 413, 414, 415, 416, 417)
WHERE r.role_code = 'SUPER_ADMIN';
