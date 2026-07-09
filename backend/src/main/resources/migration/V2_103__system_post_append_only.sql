-- V2_103__system_post_append_only
-- system-post-management：仅追加 metadata-only sys_post 表与索引，不写 seed，不触碰基线脚本或历史迁移，不含 user-post mapping。

CREATE TABLE IF NOT EXISTS sys_post (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    post_code VARCHAR(64) NOT NULL,
    post_name VARCHAR(128) NOT NULL,
    sort_order INT NOT NULL DEFAULT 100,
    status VARCHAR(32) NOT NULL DEFAULT 'ENABLED',
    remark VARCHAR(255),
    removed TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_post_tenant_code (tenant_id, post_code),
    KEY idx_sys_post_tenant_status (tenant_id, status, removed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
