-- =============================================================================
-- AC-2: sys_permission → sys_menu 数据迁移脚本
-- 功能：将旧版 sys_permission 表中的权限记录迁移到新 sys_menu 表
-- 策略：双轨运行——sys_permission 表保留不删，所有新权限编码在 sys_menu.perms 中定义
-- 幂等：使用 INSERT ... ON DUPLICATE KEY UPDATE，可重复执行
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: 创建父菜单「旧权限系统」（menu_type='M'）
-- 使用固定 ID=1000 避免与现有菜单 ID(1-24) 冲突
-- 只有不存在时才插入，保证幂等
-- ---------------------------------------------------------------------------
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, icon, visible, status)
VALUES (1000, '旧权限系统', 0, 99, 'M', 'history', 1, 1)
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- ---------------------------------------------------------------------------
-- Step 2: 从 sys_permission 迁移至 sys_menu（menu_type='F' 按钮节点）
-- 映射规则：
--   sys_permission.permission_code → sys_menu.perms
--   sys_permission.permission_name → sys_menu.menu_name（加 "[旧]" 前缀标识）
--   sys_permission.status          → sys_menu.status
--   sys_permission.create_time     → sys_menu.create_time
--   sys_permission.update_time     → sys_menu.update_time
--   sys_permission.deleted         → sys_menu.deleted
--   所有记录挂载到父菜单「旧权限系统」(id=1000) 下
-- 幂等：ON DUPLICATE KEY UPDATE 保证 perms（UNIQUE KEY）冲突时更新 menu_name
-- ---------------------------------------------------------------------------
INSERT INTO sys_menu (
    menu_name,
    parent_id,
    sort_order,
    menu_type,
    perms,
    visible,
    status,
    icon,
    is_frame,
    is_cache,
    create_time,
    update_time,
    deleted
)
SELECT
    CONCAT('[旧] ', sp.permission_name) AS menu_name,
    1000                                 AS parent_id,
    0                                    AS sort_order,
    'F'                                  AS menu_type,
    sp.permission_code                   AS perms,
    1                                    AS visible,
    COALESCE(sp.status, 1)               AS status,
    NULL                                 AS icon,
    1                                    AS is_frame,
    1                                    AS is_cache,
    sp.create_time                       AS create_time,
    sp.update_time                       AS update_time,
    COALESCE(sp.deleted, 0)              AS deleted
FROM sys_permission sp
-- 避免插入空 permission_code（虽然 NOT NULL 约束理应保证非空，但防御式过滤）
WHERE sp.permission_code IS NOT NULL
  AND sp.permission_code != ''
ON DUPLICATE KEY UPDATE
    menu_name   = VALUES(menu_name),
    status      = VALUES(status),
    visible     = VALUES(visible),
    update_time = VALUES(update_time);

-- ---------------------------------------------------------------------------
-- Step 3: 验证 — 输出迁移前后统计对比
--   source_count : sys_permission 表的有效记录数
--   menu_count   : sys_menu 中已迁移至「旧权限系统」下的记录数
--   match        : 两者是否一致（YES=完全迁移 / NO=部分迁移，需人工检查）
-- ---------------------------------------------------------------------------
SELECT
    'AC-2 migration verification' AS step,
    (SELECT COUNT(*) FROM sys_permission sp WHERE sp.permission_code IS NOT NULL AND sp.permission_code != '') AS source_count,
    (SELECT COUNT(*) FROM sys_menu WHERE parent_id = 1000 AND menu_type = 'F') AS menu_count,
    CASE
        WHEN (SELECT COUNT(*) FROM sys_permission sp WHERE sp.permission_code IS NOT NULL AND sp.permission_code != '')
             = (SELECT COUNT(*) FROM sys_menu WHERE parent_id = 1000 AND menu_type = 'F')
        THEN 'YES'
        ELSE 'NO'
    END AS `match`;
