-- V2_101__notification_switch_append_only
-- system-workflow-notification-switch：仅追加 notification_switch 只读目录表与查询索引。
-- 本批不写入任何权限、角色或菜单数据。
-- 本批不创建流程/BPM/process runtime、消息中心、发送队列、websocket、webhook、push、retry 或邮件网关表。

CREATE TABLE IF NOT EXISTS notification_switch (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    event VARCHAR(64) NOT NULL,
    channel_type VARCHAR(64) NOT NULL DEFAULT 'ALL',
    enabled TINYINT NOT NULL DEFAULT 1,
    template_code VARCHAR(96),
    description VARCHAR(255),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_notification_switch_tenant_biz_event_channel (tenant_id, biz_type, event, channel_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_notification_switch_tenant_biz_event ON notification_switch (tenant_id, biz_type, event, channel_type, enabled);
CREATE INDEX IF NOT EXISTS idx_notification_switch_tenant_updated ON notification_switch (tenant_id, update_time);
