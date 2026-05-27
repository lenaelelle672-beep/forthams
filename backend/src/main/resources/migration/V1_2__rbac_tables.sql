-- =============================================================================
-- Migration V1.2: RBAC Tables (Menus, Roles, Departments)
-- 幂等脚本：所有 CREATE/ALTER 均使用 information_schema 保护
-- =============================================================================

-- sys_menu — 菜单权限表
CREATE TABLE IF NOT EXISTS sys_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    menu_name VARCHAR(128) NOT NULL COMMENT '菜单名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父菜单ID',
    sort_order INT DEFAULT 0 COMMENT '排序号',
    path VARCHAR(256) COMMENT '路由地址',
    component VARCHAR(256) COMMENT '组件路径',
    query_param VARCHAR(256) COMMENT '路由参数',
    route_name VARCHAR(128) COMMENT '路由名称',
    menu_type CHAR(1) NOT NULL DEFAULT 'M' COMMENT 'M=目录 C=菜单 F=按钮',
    visible TINYINT DEFAULT 1 COMMENT '显示状态',
    status TINYINT DEFAULT 1 COMMENT '菜单状态',
    perms VARCHAR(128) COMMENT '权限标识',
    icon VARCHAR(128) COMMENT '菜单图标',
    is_frame TINYINT DEFAULT 1 COMMENT '是否外链',
    is_cache TINYINT DEFAULT 1 COMMENT '是否缓存',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0,
    INDEX idx_menu_perms (perms),
    INDEX idx_parent_sort (parent_id, sort_order),
    INDEX idx_menu_type (menu_type),
    INDEX idx_status_deleted (status, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单权限表';

-- sys_role_menu — 角色菜单关联
CREATE TABLE IF NOT EXISTS sys_role_menu (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_menu (role_id, menu_id),
    INDEX idx_role_id (role_id),
    INDEX idx_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

-- sys_role_dept — 角色部门关联（数据权限）
CREATE TABLE IF NOT EXISTS sys_role_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_dept (role_id, dept_id),
    INDEX idx_role_id (role_id),
    INDEX idx_dept_id (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色部门关联表';

-- ALTER sys_role: 补 data_scope / menu_check_strictly / dept_check_strictly
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_role ADD COLUMN data_scope TINYINT DEFAULT 1', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'data_scope');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_role ADD COLUMN menu_check_strictly TINYINT DEFAULT 1', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'menu_check_strictly');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_role ADD COLUMN dept_check_strictly TINYINT DEFAULT 1', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'dept_check_strictly');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ALTER sys_dept: 补 ancestors / email
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN ancestors VARCHAR(512) DEFAULT ''''', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'ancestors');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_dept ADD COLUMN email VARCHAR(128)', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_dept' AND column_name = 'email');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ALTER sys_user: 补 login_ip / login_date / remark
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_user ADD COLUMN login_ip VARCHAR(128)', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'login_ip');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_user ADD COLUMN login_date DATETIME', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'login_date');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE sys_user ADD COLUMN remark VARCHAR(512)', 'SELECT 1') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sys_user' AND column_name = 'remark');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
