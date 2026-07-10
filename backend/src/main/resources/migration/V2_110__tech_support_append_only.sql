-- V2_110__tech_support_append_only
-- system-tech-support：技术支持工单只读 catalog 表，不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission 或任何权限/菜单数据。
-- 诊断包强制脱敏，禁止导出敏感配置原值。本轮只读 catalog。

CREATE TABLE IF NOT EXISTS support_ticket (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL COMMENT '工单标题',
    category VARCHAR(64) NOT NULL DEFAULT 'GENERAL' COMMENT '问题分类',
    priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT 'LOW/NORMAL/HIGH/URGENT',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN/IN_PROGRESS/RESOLVED/CLOSED',
    requester_name VARCHAR(64) COMMENT '提单人姓名（脱敏）',
    assignee_name VARCHAR(64) COMMENT '处理人姓名（脱敏）',
    diagnostic_package_attached TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否附带诊断包',
    diagnostic_package_masked TINYINT(1) NOT NULL DEFAULT 1 COMMENT '诊断包是否已脱敏',
    summary VARCHAR(512) COMMENT '工单摘要（脱敏）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_support_ticket_tenant_status (tenant_id, status),
    INDEX idx_support_ticket_tenant_priority (tenant_id, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4;
