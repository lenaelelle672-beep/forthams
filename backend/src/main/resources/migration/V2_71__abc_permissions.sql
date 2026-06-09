-- ABC 分类权限种子数据
-- 与 ABCClassificationController 的 @ss.hasPermi('abc:*') 保持一致。

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, menu_type, perms, icon, visible, status) VALUES
    (300, 'ABC分类', 100, 3, 'C', 'abc:query', 'layers', 1, 1),
    (301, 'ABC查询', 300, 1, 'F', 'abc:query', NULL, 1, 1),
    (302, 'ABC重分类', 300, 2, 'F', 'abc:reclassify', NULL, 1, 1)
ON DUPLICATE KEY UPDATE
    menu_name = VALUES(menu_name),
    parent_id = VALUES(parent_id),
    sort_order = VALUES(sort_order),
    menu_type = VALUES(menu_type),
    perms = VALUES(perms),
    icon = VALUES(icon),
    visible = VALUES(visible),
    status = VALUES(status);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
    (1, 300),
    (1, 301),
    (1, 302)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
