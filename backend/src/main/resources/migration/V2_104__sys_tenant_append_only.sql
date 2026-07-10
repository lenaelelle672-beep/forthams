-- V2_104__sys_tenant_append_only
-- system-tenant-management：仅追加 metadata-only sys_tenant 表与索引，不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission、sys_role_permission 或任何权限/菜单数据。
-- 租户标识此前已作为 tenant_id 字段存在于各业务表，本表提供租户主数据只读 catalog。

CREATE TABLE IF NOT EXISTS sys_tenant (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    plan VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    max_users INT NOT NULL DEFAULT 100,
    max_assets INT NOT NULL DEFAULT 10000,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    contact_name VARCHAR(64),
    contact_phone VARCHAR(64),
    contact_email VARCHAR(128),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sys_tenant_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf4mb4;

-- 插入默认租户（与 schema.sql 种子用户 T001 对齐），幂等
INSERT IGNORE INTO sys_tenant (id, name, plan, max_users, max_assets, status)
VALUES ('T001', '默认租户', 'STANDARD', 100, 10000, 'ACTIVE');
