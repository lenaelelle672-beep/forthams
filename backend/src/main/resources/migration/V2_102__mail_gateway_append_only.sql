-- V2_102__mail_gateway_append_only
-- system-mail-gateway：仅追加 metadata-only mail_gateway 表与索引，不写 seed，不触碰基线脚本或历史迁移。

CREATE TABLE IF NOT EXISTS mail_gateway (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    gateway_code VARCHAR(96) NOT NULL,
    gateway_name VARCHAR(128) NOT NULL,
    host_masked VARCHAR(256) NOT NULL,
    port INT NOT NULL,
    tls_mode VARCHAR(24) NOT NULL,
    auth_configured TINYINT(1) NOT NULL DEFAULT 0,
    sender_masked VARCHAR(256),
    priority INT NOT NULL DEFAULT 100,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    last_test_status VARCHAR(32),
    last_test_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_mail_gateway_tenant_code (tenant_id, gateway_code),
    KEY idx_mail_gateway_tenant_enabled_priority (tenant_id, enabled, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
