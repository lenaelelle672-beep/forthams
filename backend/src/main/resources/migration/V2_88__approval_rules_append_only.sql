-- V2_88__approval_rules_append_only
-- Day5 system-approval-rules：新增审批规则与版本快照表、索引与幂等权限/菜单种子。
-- Append-only 说明：只 CREATE 新表/索引并 INSERT 新权限、菜单、角色绑定；回滚以停用接口和隐藏菜单为主，保留快照供审计追溯。

CREATE TABLE IF NOT EXISTS approval_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    process_key VARCHAR(64) NOT NULL,
    business_type VARCHAR(64),
    node_key VARCHAR(64) NOT NULL,
    rule_name VARCHAR(128) NOT NULL,
    priority INT NOT NULL,
    condition_expression VARCHAR(512) NOT NULL,
    condition_summary VARCHAR(512) NOT NULL,
    approver_strategy VARCHAR(512) NOT NULL,
    approver_summary VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'DISABLED',
    audit_summary VARCHAR(512),
    created_by BIGINT NOT NULL,
    updated_by BIGINT,
    enabled_by BIGINT,
    enabled_at DATETIME,
    disabled_by BIGINT,
    disabled_at DATETIME,
    disabled_reason VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_approval_rule_tenant_process (tenant_id, process_key, node_key, status),
    INDEX idx_approval_rule_priority (tenant_id, process_key, node_key, priority),
    INDEX idx_approval_rule_update_time (tenant_id, update_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_rule_version (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    rule_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    before_snapshot LONGTEXT,
    after_snapshot LONGTEXT NOT NULL,
    audit_summary VARCHAR(512),
    operator_id BIGINT NOT NULL,
    reason VARCHAR(512),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_approval_rule_version_no (tenant_id, rule_id, version_no),
    INDEX idx_approval_rule_version_rule (tenant_id, rule_id, create_time),
    INDEX idx_approval_rule_version_action (tenant_id, action_type, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('审批规则查看', 'workflow:approval-rule:list', '流程平台审批规则列表和详情查看权限', 1),
    ('审批规则创建', 'workflow:approval-rule:create', '流程平台审批规则创建权限', 1),
    ('审批规则更新', 'workflow:approval-rule:update', '流程平台审批规则更新权限', 1),
    ('审批规则启用', 'workflow:approval-rule:enable', '流程平台审批规则启用高危权限', 1),
    ('审批规则停用', 'workflow:approval-rule:disable', '流程平台审批规则停用高危权限', 1),
    ('审批规则测试', 'workflow:approval-rule:test', '流程平台审批规则模拟和冲突检测权限', 1)
;

INSERT IGNORE INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (400, '审批规则', 310, 60, 'fixed-assets/workbenchv3', 'menu=system-approval-rules', 'workbench-v3/WorkbenchV3Page', 'C', 'workflow:approval-rule:list', 'shield-check', 1, 1),
    (401, '审批规则查看', 400, 1, NULL, NULL, NULL, 'F', 'workflow:approval-rule:list', NULL, 1, 1),
    (402, '审批规则创建', 400, 2, NULL, NULL, NULL, 'F', 'workflow:approval-rule:create', NULL, 1, 1),
    (403, '审批规则更新', 400, 3, NULL, NULL, NULL, 'F', 'workflow:approval-rule:update', NULL, 1, 1),
    (404, '审批规则启用', 400, 4, NULL, NULL, NULL, 'F', 'workflow:approval-rule:enable', NULL, 1, 1),
    (405, '审批规则停用', 400, 5, NULL, NULL, NULL, 'F', 'workflow:approval-rule:disable', NULL, 1, 1),
    (406, '审批规则测试', 400, 6, NULL, NULL, NULL, 'F', 'workflow:approval-rule:test', NULL, 1, 1)
;

INSERT IGNORE INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r
INNER JOIN sys_permission p ON p.permission_code IN (
    'workflow:approval-rule:list',
    'workflow:approval-rule:create',
    'workflow:approval-rule:update',
    'workflow:approval-rule:enable',
    'workflow:approval-rule:disable',
    'workflow:approval-rule:test'
)
WHERE r.role_code = 'SUPER_ADMIN';

INSERT IGNORE INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
INNER JOIN sys_menu m ON m.id IN (400, 401, 402, 403, 404, 405, 406)
WHERE r.role_code = 'SUPER_ADMIN';
