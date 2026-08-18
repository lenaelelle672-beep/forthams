-- V2_112__sys_role_dept_append_only
-- system-data-permissions：CUSTOM 范围的角色-部门规则表。
-- 不写入 sys_menu / sys_permission / 不改历史迁移。

CREATE TABLE IF NOT EXISTS sys_role_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    UNIQUE KEY uk_sys_role_dept (role_id, dept_id),
    INDEX idx_sys_role_dept_role (role_id),
    INDEX idx_sys_role_dept_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
