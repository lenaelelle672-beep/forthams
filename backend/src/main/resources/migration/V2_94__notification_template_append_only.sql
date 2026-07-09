-- V2_94__notification_template_append_only
-- system-notification-templates：仅追加 notification_template catalog 表与查询索引。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission、sys_role_permission 或任何权限/菜单数据。

CREATE TABLE IF NOT EXISTS notification_template (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    template_code VARCHAR(96) NOT NULL,
    template_name VARCHAR(128) NOT NULL,
    category VARCHAR(64),
    channel_type VARCHAR(32) NOT NULL DEFAULT 'IN_APP',
    title_template VARCHAR(512) NOT NULL,
    content_template TEXT NOT NULL,
    variables TEXT,
    is_builtin TINYINT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    create_by VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by VARCHAR(64),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_notification_template_tenant_code (tenant_id, template_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_notification_template_tenant_category ON notification_template (tenant_id, category, status, update_time);
CREATE INDEX IF NOT EXISTS idx_notification_template_tenant_channel ON notification_template (tenant_id, channel_type, status, update_time);
