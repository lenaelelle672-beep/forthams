CREATE TABLE IF NOT EXISTS sys_tenant (
    id VARCHAR(20) PRIMARY KEY COMMENT '租户ID',
    name VARCHAR(100) NOT NULL COMMENT '租户名称',
    domain VARCHAR(200) COMMENT '绑定域名',
    plan VARCHAR(20) DEFAULT 'FREE' COMMENT '套餐',
    max_users INT DEFAULT 100,
    max_assets INT DEFAULT 1000,
    status VARCHAR(10) DEFAULT 'ACTIVE',
    contact_name VARCHAR(50),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    expire_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户管理';

INSERT INTO sys_tenant (id, name, plan, status, max_users, max_assets) VALUES
('default', '默认租户', 'ENTERPRISE', 'ACTIVE', 9999, 999999);
