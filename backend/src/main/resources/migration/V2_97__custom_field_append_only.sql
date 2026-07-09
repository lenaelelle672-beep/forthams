-- V2_97__custom_field_append_only
-- system-custom-fields：仅追加 custom_field 定义 catalog 表与查询索引，不写 seed，不触碰 schema.sql 或历史迁移。

CREATE TABLE IF NOT EXISTS custom_field (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    field_name VARCHAR(96) NOT NULL,
    field_label VARCHAR(128) NOT NULL,
    field_type VARCHAR(32) NOT NULL,
    field_options TEXT,
    validation_pattern VARCHAR(256),
    field_order INT NOT NULL DEFAULT 0,
    required TINYINT NOT NULL DEFAULT 0,
    encrypted TINYINT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    create_by VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by VARCHAR(64),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_custom_field_tenant_name ON custom_field (tenant_id, field_name);
CREATE INDEX IF NOT EXISTS idx_custom_field_tenant_type_status ON custom_field (tenant_id, field_type, status, field_order);
CREATE INDEX IF NOT EXISTS idx_custom_field_tenant_status_order ON custom_field (tenant_id, status, field_order, id);
