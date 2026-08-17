-- 仅供受控空新库 staged chain 使用：历史 schema.sql 与 V2_84+ 迁移引用的菜单基础表。
-- 不放入默认 classpath:migration，绝不回写到已部署库的 Flyway history。
CREATE TABLE IF NOT EXISTS sys_menu (
    id BIGINT PRIMARY KEY,
    menu_name VARCHAR(128) NOT NULL,
    parent_id BIGINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    path VARCHAR(256),
    query_param VARCHAR(512),
    component VARCHAR(512),
    menu_type VARCHAR(8) NOT NULL DEFAULT 'M',
    perms VARCHAR(256),
    icon VARCHAR(128),
    visible TINYINT NOT NULL DEFAULT 1,
    status TINYINT NOT NULL DEFAULT 1,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_role_menu_role_menu (role_id, menu_id),
    INDEX idx_sys_role_menu_menu (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
