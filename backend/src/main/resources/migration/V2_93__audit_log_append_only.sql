-- V2_93__audit_log_append_only
-- system-audit-log：仅追加 general_audit_entry 只读查询表与索引。
-- 禁止在本批次 seed sys_menu、sys_role_menu、sys_permission、sys_role_permission 或任何 RBAC/menu 表。

CREATE TABLE IF NOT EXISTS general_audit_entry (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    trace_id VARCHAR(96),
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(64),
    operation_type VARCHAR(64),
    operator_id BIGINT,
    operator_name VARCHAR(128),
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    description VARCHAR(512),
    http_method VARCHAR(16),
    request_uri VARCHAR(512),
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    before_record TEXT,
    after_record TEXT,
    raw_payload TEXT,
    error_message VARCHAR(1024),
    error_stack TEXT,
    status VARCHAR(32),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_general_audit_entry_tenant_time (tenant_id, timestamp),
    INDEX idx_general_audit_entry_tenant_type (tenant_id, operation_type, timestamp),
    INDEX idx_general_audit_entry_tenant_operator (tenant_id, operator_id, timestamp),
    INDEX idx_general_audit_entry_tenant_resource (tenant_id, resource_type, resource_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
