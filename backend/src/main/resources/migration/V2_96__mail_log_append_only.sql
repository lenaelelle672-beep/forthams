-- V2_96__mail_log_append_only
-- system-mail-logs：仅追加 mail_log 只读查询表与索引，不写 seed，不触碰 schema.sql 或历史迁移。

CREATE TABLE IF NOT EXISTS mail_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    template_code VARCHAR(96),
    mail_from VARCHAR(256),
    mail_to TEXT,
    mail_cc TEXT,
    mail_bcc TEXT,
    subject VARCHAR(512),
    content TEXT,
    send_status VARCHAR(32) NOT NULL,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retry INT NOT NULL DEFAULT 0,
    biz_type VARCHAR(64),
    biz_id BIGINT,
    provider VARCHAR(64),
    provider_message_id VARCHAR(128),
    request_id VARCHAR(128),
    headers TEXT,
    payload TEXT,
    send_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_mail_log_tenant_status_time ON mail_log (tenant_id, send_status, send_time, id);
CREATE INDEX IF NOT EXISTS idx_mail_log_tenant_template_time ON mail_log (tenant_id, template_code, send_time, id);
CREATE INDEX IF NOT EXISTS idx_mail_log_tenant_biz ON mail_log (tenant_id, biz_type, biz_id, send_time, id);
