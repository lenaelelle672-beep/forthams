-- =============================================================================
-- V3_27_1: 入库验收模块 — sys_menu 权限种子数据
-- 功能：在 sys_menu 表注册 asset:intake:* 权限节点，使 Controller
--       @PreAuthorize("@ss.hasPermi('asset:intake:xxx')") 正常工作
-- 幂等：使用 INSERT ... ON DUPLICATE KEY UPDATE，可重复执行
-- 参考：V3_15__sys_permission_to_menu.sql、schema.sql AC-5 模式
-- =============================================================================

-- 父菜单「入库验收」(menu_type='C')，挂载到「资产管理」(parent_id=100) 下
INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (212, '入库验收', 100, 10, 'C', 'asset:intake:query', 'package-plus', 1, 1),
    (213, '验收查询', 212, 1, 'F', 'asset:intake:query', NULL, 1, 1),
    (214, '验收创建', 212, 2, 'F', 'asset:intake:create', NULL, 1, 1),
    (215, '验收编辑', 212, 3, 'F', 'asset:intake:edit', NULL, 1, 1),
    (216, '验收删除', 212, 4, 'F', 'asset:intake:delete', NULL, 1, 1)
ON DUPLICATE KEY UPDATE
    menu_name = VALUES(menu_name),
    perms     = VALUES(perms),
    sort_order = VALUES(sort_order);

-- SUPER_ADMIN 角色绑定 (role_id=1)
INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 212), (1, 213), (1, 214), (1, 215), (1, 216)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
