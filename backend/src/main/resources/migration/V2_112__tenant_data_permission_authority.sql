-- V2_112__tenant_data_permission_authority
-- 数据权限执行边界：用户成员关系、角色、规则、角色-部门关联和部门均以 tenant_id 为边界。
-- 既有用户、角色和部门不能被安全地自动归属到某个租户，因此 tenant_id 保持 NULL；应用层对
-- NULL 一律拒绝，不做默认租户、默认 ALL 或任何 seed/backfill。
-- 注意：本迁移会重建若干唯一索引，并非 append-only；ALTER TABLE 在 MySQL 中可能隐式提交。
-- 每次重建前先按目标唯一键列顺序预检重复值；预检失败时在任何 DROP INDEX 前 abort。
-- 若任一 DDL 已执行后失败，停止发布并保留 history/错误证据，由 DBA 按经验证备份恢复，或在
-- 新变更单中制定前向修复；不得 repair checksum、手改 history 或把 staged 文件用于既有 history。

SET @user_tenant_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_user'
      AND COLUMN_NAME = 'tenant_id'
);
SET @user_tenant_column_sql = IF(
    @user_tenant_column_exists = 0,
    'ALTER TABLE sys_user ADD COLUMN tenant_id VARCHAR(64) NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @user_tenant_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 平台管理员是服务端核验的显式标记，而非 NULL/global ROLE_SUPER_ADMIN。
-- 本迁移绝不设置该标记，也不创建任何用户、成员关系或默认角色。
SET @user_platform_admin_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_user'
      AND COLUMN_NAME = 'platform_admin'
);
SET @user_platform_admin_column_sql = IF(
    @user_platform_admin_column_exists = 0,
    'ALTER TABLE sys_user ADD COLUMN platform_admin TINYINT NOT NULL DEFAULT 0 AFTER tenant_id',
    'SELECT 1'
);
PREPARE stmt FROM @user_platform_admin_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @dept_tenant_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_dept'
      AND COLUMN_NAME = 'tenant_id'
);
SET @dept_tenant_column_sql = IF(
    @dept_tenant_column_exists = 0,
    'ALTER TABLE sys_dept ADD COLUMN tenant_id VARCHAR(64) NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @dept_tenant_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @role_tenant_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role'
      AND COLUMN_NAME = 'tenant_id'
);
SET @role_tenant_column_sql = IF(
    @role_tenant_column_exists = 0,
    'ALTER TABLE sys_role ADD COLUMN tenant_id VARCHAR(64) NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @role_tenant_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @role_tenant_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role'
      AND INDEX_NAME = 'idx_sys_role_tenant'
);
SET @role_tenant_index_sql = IF(
    @role_tenant_index_exists = 0,
    'CREATE INDEX idx_sys_role_tenant ON sys_role (tenant_id, id)',
    'SELECT 1'
);
PREPARE stmt FROM @role_tenant_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 基线 schema.sql 的 role_code 是全局唯一。移除该单列唯一约束，改为 tenant 内唯一；
-- 已有 NULL tenant 的历史角色不会被回填，也不会与新租户角色混淆。
SET @role_tenant_role_code_duplicate_count = (
    SELECT COUNT(*)
    FROM (
        SELECT tenant_id, role_code
        FROM sys_role
        WHERE tenant_id IS NOT NULL AND role_code IS NOT NULL
        GROUP BY tenant_id, role_code
        HAVING COUNT(*) > 1
    ) duplicate_rows
);
SET @role_tenant_role_code_precheck_sql = IF(
    @role_tenant_role_code_duplicate_count = 0,
    'SELECT 1',
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''V2_112 abort: duplicate (tenant_id, role_code) in sys_role'''
);
PREPARE stmt FROM @role_tenant_role_code_precheck_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @legacy_role_code_unique_index = (
    SELECT candidate.index_name
    FROM (
        SELECT INDEX_NAME AS index_name, COUNT(*) AS column_count, MAX(COLUMN_NAME) AS only_column
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_role'
          AND NON_UNIQUE = 0
          AND INDEX_NAME <> 'PRIMARY'
        GROUP BY INDEX_NAME
    ) candidate
    WHERE candidate.column_count = 1
      AND candidate.only_column = 'role_code'
    LIMIT 1
);
SET @drop_legacy_role_code_unique_sql = IF(
    @legacy_role_code_unique_index IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE sys_role DROP INDEX `', REPLACE(@legacy_role_code_unique_index, '`', '``'), '`')
);
PREPARE stmt FROM @drop_legacy_role_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @role_tenant_role_code_unique_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT INDEX_NAME, NON_UNIQUE,
               GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_role'
        GROUP BY INDEX_NAME, NON_UNIQUE
    ) candidate
    WHERE candidate.INDEX_NAME = 'uk_sys_role_tenant_role_code'
      AND candidate.NON_UNIQUE = 0
      AND candidate.indexed_columns = 'tenant_id,role_code'
);
SET @role_tenant_role_code_named_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role'
      AND INDEX_NAME = 'uk_sys_role_tenant_role_code'
);
SET @drop_invalid_role_tenant_role_code_unique_sql = IF(
    @role_tenant_role_code_unique_exists = 0 AND @role_tenant_role_code_named_index_exists > 0,
    'ALTER TABLE sys_role DROP INDEX uk_sys_role_tenant_role_code',
    'SELECT 1'
);
PREPARE stmt FROM @drop_invalid_role_tenant_role_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @role_tenant_role_code_unique_sql = IF(
    @role_tenant_role_code_unique_exists = 0,
    'ALTER TABLE sys_role ADD UNIQUE KEY uk_sys_role_tenant_role_code (tenant_id, role_code)',
    'SELECT 1'
);
PREPARE stmt FROM @role_tenant_role_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @role_tenant_status_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role'
      AND INDEX_NAME = 'idx_sys_role_tenant_status'
);
SET @role_tenant_status_index_sql = IF(
    @role_tenant_status_index_exists = 0,
    'CREATE INDEX idx_sys_role_tenant_status ON sys_role (tenant_id, status, deleted, id)',
    'SELECT 1'
);
PREPARE stmt FROM @role_tenant_status_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 仅登记动作权限库存，不为任何历史或新角色自动授予权限。缺失 role-permission 绑定保持拒绝。
INSERT IGNORE INTO sys_permission (permission_name, permission_code, description, status)
VALUES
    ('资产查询', 'asset:query', '资产查询动作权限', 1),
    ('资产新建', 'asset:create', '资产新建动作权限', 1),
    ('资产更新', 'asset:update', '资产更新动作权限', 1),
    ('资产审批', 'asset:approve', '资产审批动作权限', 1),
    ('资产删除', 'asset:delete', '资产删除动作权限', 1),
    ('退役查询', 'retirement:query', '退役查询动作权限', 1),
    ('退役新建', 'retirement:create', '退役新建动作权限', 1),
    ('退役更新', 'retirement:update', '退役更新动作权限', 1),
    ('退役审批', 'retirement:approve', '退役审批动作权限', 1),
    ('退役删除', 'retirement:delete', '退役删除动作权限', 1),
    ('赔偿查询', 'compensation:query', '赔偿查询动作权限', 1),
    ('赔偿新建', 'compensation:create', '赔偿新建动作权限', 1),
    ('赔偿更新', 'compensation:update', '赔偿更新动作权限', 1),
    ('赔偿审批', 'compensation:approve', '赔偿审批动作权限', 1),
    ('赔偿删除', 'compensation:delete', '赔偿删除动作权限', 1),
    ('处置查询', 'disposal:query', '处置查询动作权限', 1),
    ('处置新建', 'disposal:create', '处置新建动作权限', 1),
    ('处置更新', 'disposal:update', '处置更新动作权限', 1),
    ('处置审批', 'disposal:approve', '处置审批动作权限', 1),
    ('处置删除', 'disposal:delete', '处置删除动作权限', 1);

-- 部门编码与层级均限定在 tenant 内；不对历史全局部门作任何推断或回填。
SET @dept_tenant_dept_code_duplicate_count = (
    SELECT COUNT(*)
    FROM (
        SELECT tenant_id, dept_code
        FROM sys_dept
        WHERE tenant_id IS NOT NULL AND dept_code IS NOT NULL
        GROUP BY tenant_id, dept_code
        HAVING COUNT(*) > 1
    ) duplicate_rows
);
SET @dept_tenant_dept_code_precheck_sql = IF(
    @dept_tenant_dept_code_duplicate_count = 0,
    'SELECT 1',
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''V2_112 abort: duplicate (tenant_id, dept_code) in sys_dept'''
);
PREPARE stmt FROM @dept_tenant_dept_code_precheck_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @legacy_dept_code_unique_index = (
    SELECT candidate.index_name
    FROM (
        SELECT INDEX_NAME AS index_name, COUNT(*) AS column_count, MAX(COLUMN_NAME) AS only_column
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_dept'
          AND NON_UNIQUE = 0
          AND INDEX_NAME <> 'PRIMARY'
        GROUP BY INDEX_NAME
    ) candidate
    WHERE candidate.column_count = 1
      AND candidate.only_column = 'dept_code'
    LIMIT 1
);
SET @drop_legacy_dept_code_unique_sql = IF(
    @legacy_dept_code_unique_index IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE sys_dept DROP INDEX `', REPLACE(@legacy_dept_code_unique_index, '`', '``'), '`')
);
PREPARE stmt FROM @drop_legacy_dept_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @dept_tenant_code_unique_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT INDEX_NAME, NON_UNIQUE,
               GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_dept'
        GROUP BY INDEX_NAME, NON_UNIQUE
    ) candidate
    WHERE candidate.INDEX_NAME = 'uk_sys_dept_tenant_dept_code'
      AND candidate.NON_UNIQUE = 0
      AND candidate.indexed_columns = 'tenant_id,dept_code'
);
SET @dept_tenant_code_named_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_dept'
      AND INDEX_NAME = 'uk_sys_dept_tenant_dept_code'
);
SET @drop_invalid_dept_tenant_code_unique_sql = IF(
    @dept_tenant_code_unique_exists = 0 AND @dept_tenant_code_named_index_exists > 0,
    'ALTER TABLE sys_dept DROP INDEX uk_sys_dept_tenant_dept_code',
    'SELECT 1'
);
PREPARE stmt FROM @drop_invalid_dept_tenant_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @dept_tenant_code_unique_sql = IF(
    @dept_tenant_code_unique_exists = 0,
    'ALTER TABLE sys_dept ADD UNIQUE KEY uk_sys_dept_tenant_dept_code (tenant_id, dept_code)',
    'SELECT 1'
);
PREPARE stmt FROM @dept_tenant_code_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @user_tenant_status_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_user'
      AND INDEX_NAME = 'idx_sys_user_tenant_status'
);
SET @user_tenant_status_index_sql = IF(
    @user_tenant_status_index_exists = 0,
    'CREATE INDEX idx_sys_user_tenant_status ON sys_user (tenant_id, status, id)',
    'SELECT 1'
);
PREPARE stmt FROM @user_tenant_status_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 用户 tenant_id 只是受控默认租户选择；实际 JWT 签发必须同时存在此表中的有效成员关系。
-- 历史用户不回填，缺少成员关系时应用层拒绝登录和权限加载。
CREATE TABLE IF NOT EXISTS sys_user_tenant (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_by BIGINT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_user_tenant_user_tenant (user_id, tenant_id),
    KEY idx_sys_user_tenant_tenant_status_user (tenant_id, status, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CREATE TABLE IF NOT EXISTS 不会为中断过的旧表补齐约束。以下检查按列顺序验证复合唯一键；
-- 只有本迁移保留名称的错误索引会被替换，已有等价唯一键不会重复创建。
SET @user_tenant_duplicate_count = (
    SELECT COUNT(*)
    FROM (
        SELECT user_id, tenant_id
        FROM sys_user_tenant
        GROUP BY user_id, tenant_id
        HAVING COUNT(*) > 1
    ) duplicate_rows
);
SET @user_tenant_precheck_sql = IF(
    @user_tenant_duplicate_count = 0,
    'SELECT 1',
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''V2_112 abort: duplicate (user_id, tenant_id) in sys_user_tenant'''
);
PREPARE stmt FROM @user_tenant_precheck_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @user_tenant_unique_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT INDEX_NAME, NON_UNIQUE,
               GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_user_tenant'
        GROUP BY INDEX_NAME, NON_UNIQUE
    ) candidate
    WHERE candidate.NON_UNIQUE = 0
      AND candidate.indexed_columns = 'user_id,tenant_id'
);
SET @user_tenant_named_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_user_tenant'
      AND INDEX_NAME = 'uk_sys_user_tenant_user_tenant'
);
SET @drop_invalid_user_tenant_unique_sql = IF(
    @user_tenant_unique_exists = 0 AND @user_tenant_named_index_exists > 0,
    'ALTER TABLE sys_user_tenant DROP INDEX uk_sys_user_tenant_user_tenant',
    'SELECT 1'
);
PREPARE stmt FROM @drop_invalid_user_tenant_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @add_user_tenant_unique_sql = IF(
    @user_tenant_unique_exists = 0,
    'ALTER TABLE sys_user_tenant ADD UNIQUE KEY uk_sys_user_tenant_user_tenant (user_id, tenant_id)',
    'SELECT 1'
);
PREPARE stmt FROM @add_user_tenant_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @user_tenant_lookup_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_user_tenant'
      AND INDEX_NAME = 'idx_sys_user_tenant_tenant_status_user'
);
SET @add_user_tenant_lookup_index_sql = IF(
    @user_tenant_lookup_index_exists = 0,
    'CREATE INDEX idx_sys_user_tenant_tenant_status_user ON sys_user_tenant (tenant_id, status, user_id)',
    'SELECT 1'
);
PREPARE stmt FROM @add_user_tenant_lookup_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @dept_tenant_parent_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_dept'
      AND INDEX_NAME = 'idx_sys_dept_tenant_parent'
);
SET @dept_tenant_parent_index_sql = IF(
    @dept_tenant_parent_index_exists = 0,
    'CREATE INDEX idx_sys_dept_tenant_parent ON sys_dept (tenant_id, parent_id, status, id)',
    'SELECT 1'
);
PREPARE stmt FROM @dept_tenant_parent_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sys_role_data_scope (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    role_id BIGINT NOT NULL,
    data_scope VARCHAR(32) NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_role_data_scope_tenant_role (tenant_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @role_data_scope_duplicate_count = (
    SELECT COUNT(*)
    FROM (
        SELECT tenant_id, role_id
        FROM sys_role_data_scope
        GROUP BY tenant_id, role_id
        HAVING COUNT(*) > 1
    ) duplicate_rows
);
SET @role_data_scope_precheck_sql = IF(
    @role_data_scope_duplicate_count = 0,
    'SELECT 1',
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''V2_112 abort: duplicate (tenant_id, role_id) in sys_role_data_scope'''
);
PREPARE stmt FROM @role_data_scope_precheck_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @role_data_scope_unique_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT INDEX_NAME, NON_UNIQUE,
               GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_role_data_scope'
        GROUP BY INDEX_NAME, NON_UNIQUE
    ) candidate
    WHERE candidate.NON_UNIQUE = 0
      AND candidate.indexed_columns = 'tenant_id,role_id'
);
SET @role_data_scope_named_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role_data_scope'
      AND INDEX_NAME = 'uk_sys_role_data_scope_tenant_role'
);
SET @drop_invalid_role_data_scope_unique_sql = IF(
    @role_data_scope_unique_exists = 0 AND @role_data_scope_named_index_exists > 0,
    'ALTER TABLE sys_role_data_scope DROP INDEX uk_sys_role_data_scope_tenant_role',
    'SELECT 1'
);
PREPARE stmt FROM @drop_invalid_role_data_scope_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @add_role_data_scope_unique_sql = IF(
    @role_data_scope_unique_exists = 0,
    'ALTER TABLE sys_role_data_scope ADD UNIQUE KEY uk_sys_role_data_scope_tenant_role (tenant_id, role_id)',
    'SELECT 1'
);
PREPARE stmt FROM @add_role_data_scope_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sys_role_dept (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_role_dept_tenant_role_dept (tenant_id, role_id, dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @role_dept_duplicate_count = (
    SELECT COUNT(*)
    FROM (
        SELECT tenant_id, role_id, dept_id
        FROM sys_role_dept
        GROUP BY tenant_id, role_id, dept_id
        HAVING COUNT(*) > 1
    ) duplicate_rows
);
SET @role_dept_precheck_sql = IF(
    @role_dept_duplicate_count = 0,
    'SELECT 1',
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''V2_112 abort: duplicate (tenant_id, role_id, dept_id) in sys_role_dept'''
);
PREPARE stmt FROM @role_dept_precheck_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @role_dept_unique_exists = (
    SELECT COUNT(*)
    FROM (
        SELECT INDEX_NAME, NON_UNIQUE,
               GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sys_role_dept'
        GROUP BY INDEX_NAME, NON_UNIQUE
    ) candidate
    WHERE candidate.NON_UNIQUE = 0
      AND candidate.indexed_columns = 'tenant_id,role_id,dept_id'
);
SET @role_dept_named_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role_dept'
      AND INDEX_NAME = 'uk_sys_role_dept_tenant_role_dept'
);
SET @drop_invalid_role_dept_unique_sql = IF(
    @role_dept_unique_exists = 0 AND @role_dept_named_index_exists > 0,
    'ALTER TABLE sys_role_dept DROP INDEX uk_sys_role_dept_tenant_role_dept',
    'SELECT 1'
);
PREPARE stmt FROM @drop_invalid_role_dept_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @add_role_dept_unique_sql = IF(
    @role_dept_unique_exists = 0,
    'ALTER TABLE sys_role_dept ADD UNIQUE KEY uk_sys_role_dept_tenant_role_dept (tenant_id, role_id, dept_id)',
    'SELECT 1'
);
PREPARE stmt FROM @add_role_dept_unique_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @role_dept_tenant_dept_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sys_role_dept'
      AND INDEX_NAME = 'idx_sys_role_dept_tenant_dept'
);
SET @role_dept_tenant_dept_index_sql = IF(
    @role_dept_tenant_dept_index_exists = 0,
    'CREATE INDEX idx_sys_role_dept_tenant_dept ON sys_role_dept (tenant_id, dept_id, role_id)',
    'SELECT 1'
);
PREPARE stmt FROM @role_dept_tenant_dept_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 资产范围判定的 tenant + 部门/用户谓词必须有复合索引，避免范围收紧后退化为全表扫描。
SET @asset_tenant_dept_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'asset'
      AND INDEX_NAME = 'idx_asset_tenant_dept'
);
SET @asset_tenant_dept_index_sql = IF(
    @asset_tenant_dept_index_exists = 0,
    'CREATE INDEX idx_asset_tenant_dept ON asset (tenant_id, dept_id)',
    'SELECT 1'
);
PREPARE stmt FROM @asset_tenant_dept_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @asset_tenant_user_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'asset'
      AND INDEX_NAME = 'idx_asset_tenant_user'
);
SET @asset_tenant_user_index_sql = IF(
    @asset_tenant_user_index_exists = 0,
    'CREATE INDEX idx_asset_tenant_user ON asset (tenant_id, user_id)',
    'SELECT 1'
);
PREPARE stmt FROM @asset_tenant_user_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
