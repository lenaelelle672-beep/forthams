-- V2_108__workflow_mail_append_only
-- system-workflow-mail：流程节点邮件配置只读 catalog 表，不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission 或任何权限/菜单数据。
-- 本轮只读 catalog，不实现真实邮件发送（P2 专项）。

CREATE TABLE IF NOT EXISTS workflow_mail_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    business_type VARCHAR(64) NOT NULL COMMENT '流程业务类型',
    node_key VARCHAR(64) NOT NULL COMMENT '流程节点标识',
    node_name VARCHAR(128) COMMENT '节点名称',
    trigger_event VARCHAR(32) NOT NULL DEFAULT 'ON_APPROVAL' COMMENT '触发事件 ON_APPROVAL/ON_COMPLETE/ON_REJECT/ON_TIMEOUT',
    template_code VARCHAR(64) COMMENT '邮件模板编码',
    enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
    recipient_scope VARCHAR(32) NOT NULL DEFAULT 'APPLICANT' COMMENT '收件人范围 APPLICANT/APPROVER/CC_ROLE',
    risk_note VARCHAR(512) COMMENT '风险提示（零业务调用风险/发送未接入）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_workflow_mail_tenant_node (tenant_id, business_type, node_key, trigger_event),
    INDEX idx_workflow_mail_tenant_enabled (tenant_id, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4;
