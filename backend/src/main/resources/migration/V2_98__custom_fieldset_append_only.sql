-- V2_98__custom_fieldset_append_only
-- system-custom-field-sets：仅追加字段集只读 catalog 与字段集-字段查询表，不写 seed，不触碰 schema.sql 或历史迁移。

CREATE TABLE IF NOT EXISTS custom_fieldset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(512),
    category_id BIGINT,
    sort_order INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    create_by VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by VARCHAR(64),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS custom_fieldset_field (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    fieldset_id BIGINT NOT NULL,
    field_id BIGINT NOT NULL,
    field_order INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_custom_fieldset_tenant_name ON custom_fieldset (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_custom_fieldset_tenant_category ON custom_fieldset (tenant_id, category_id, status);
CREATE INDEX IF NOT EXISTS idx_custom_fieldset_tenant_status_order ON custom_fieldset (tenant_id, status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_custom_fieldset_field_tenant_fieldset ON custom_fieldset_field (tenant_id, fieldset_id, status, field_order);
CREATE INDEX IF NOT EXISTS idx_custom_fieldset_field_tenant_field ON custom_fieldset_field (tenant_id, field_id, status);
