-- V2_100__channel_config_append_only
-- system-notification-channels：仅追加 channel_config 只读目录表与查询索引。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission、sys_role_permission 或任何权限/菜单数据。
-- 本批不创建消息中心、发送队列、webhook/push/retry、邮件网关、SMTP 或流程通知开关表。

CREATE TABLE IF NOT EXISTS channel_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    channel_type VARCHAR(64) NOT NULL,
    config_name VARCHAR(128) NOT NULL,
    webhook_url_masked VARCHAR(255),
    webhook_url_configured TINYINT NOT NULL DEFAULT 0,
    signature_configured TINYINT NOT NULL DEFAULT 0,
    enabled TINYINT NOT NULL DEFAULT 1,
    description VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_channel_config_tenant_type_name (tenant_id, channel_type, config_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_channel_config_tenant_type ON channel_config (tenant_id, channel_type, enabled);
CREATE INDEX IF NOT EXISTS idx_channel_config_tenant_updated ON channel_config (tenant_id, updated_at);
