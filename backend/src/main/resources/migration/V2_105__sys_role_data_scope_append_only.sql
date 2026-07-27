-- V2_105__sys_role_data_scope_append_only
-- system-data-permissions：为 sys_role 追加 data_scope 列（只读 catalog 支撑），不触碰基线脚本或历史迁移。
-- 本批不写入 sys_menu、sys_role_menu、sys_permission、sys_role_permission 或任何权限/菜单数据。
-- data_scope 取值：ALL（全部）/ DEPT（本部门）/ DEPT_AND_SUB（本部门及下属）/ SELF（仅本人）/ CUSTOM（自定义，需配合规则）。
-- 默认 ALL，与历史无 data_scope 行为等价（不收紧）。
-- 幂等：用 information_schema 守卫，flyway repair / 重放时若列已存在则跳过 ALTER，避免报错。

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_role' AND COLUMN_NAME = 'data_scope');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE sys_role ADD COLUMN data_scope VARCHAR(32) NOT NULL DEFAULT ''ALL'' AFTER description', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
