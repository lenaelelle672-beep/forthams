-- V2_95__mail_template_append_only
-- system-mail-templates：仅追加 mail_template catalog 表与查询索引。

CREATE TABLE IF NOT EXISTS mail_template (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    template_code VARCHAR(96) NOT NULL,
    template_name VARCHAR(128) NOT NULL,
    category VARCHAR(64),
    subject_template VARCHAR(512) NOT NULL,
    content_template TEXT NOT NULL,
    content_type VARCHAR(32) NOT NULL DEFAULT 'HTML',
    variables TEXT,
    is_builtin TINYINT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    create_by VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by VARCHAR(64),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_mail_template_tenant_code ON mail_template (tenant_id, template_code);
CREATE INDEX IF NOT EXISTS idx_mail_template_tenant_category ON mail_template (tenant_id, category, status, update_time);
CREATE INDEX IF NOT EXISTS idx_mail_template_tenant_content_type ON mail_template (tenant_id, content_type, status, update_time);
