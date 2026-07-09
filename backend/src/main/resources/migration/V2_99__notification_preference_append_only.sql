-- V2_99__notification_preference_append_only
-- system-notification-preferences：仅追加 notification_preference 只读 catalog 表与查询索引。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission、sys_role_permission 或任何权限/菜单数据。
-- 本批不创建通知渠道、流程通知开关、消息中心、邮件网关、队列、webhook、websocket、push 或 retry 表。

CREATE TABLE IF NOT EXISTS notification_preference (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL,
    in_app TINYINT NOT NULL DEFAULT 1,
    email TINYINT NOT NULL DEFAULT 0,
    quiet_start VARCHAR(16),
    quiet_end VARCHAR(16),
    status TINYINT NOT NULL DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_notification_preference_tenant_category (tenant_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_notification_preference_tenant_category ON notification_preference (tenant_id, category, status);
CREATE INDEX IF NOT EXISTS idx_notification_preference_tenant_status ON notification_preference (tenant_id, status, update_time);
