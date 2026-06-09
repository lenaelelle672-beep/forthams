-- Align workflow menu seeds with the desktop route and controller permissions.
-- Existing databases may still carry the legacy Ruoyi-style path/component
-- and workflow:definition:list permission from the initial schema snapshot.

UPDATE sys_menu
SET menu_name = '工作流定义',
    parent_id = 1,
    sort_order = 5,
    path = 'workflows',
    component = 'workflow/WorkflowCenterPage',
    menu_type = 'C',
    perms = 'workflow:definition:query',
    icon = 'workflow',
    visible = 1,
    status = 1
WHERE id = 22;

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, component, menu_type, perms, icon, visible, status)
VALUES
    (23, '工作流查询', 22, 1, NULL, NULL, 'F', 'workflow:definition:query', NULL, 1, 1),
    (24, '工作流编辑', 22, 2, NULL, NULL, 'F', 'workflow:definition:edit', NULL, 1, 1)
ON DUPLICATE KEY UPDATE
    menu_name = VALUES(menu_name),
    parent_id = VALUES(parent_id),
    sort_order = VALUES(sort_order),
    path = VALUES(path),
    component = VALUES(component),
    menu_type = VALUES(menu_type),
    perms = VALUES(perms),
    icon = VALUES(icon),
    visible = VALUES(visible),
    status = VALUES(status);

INSERT INTO sys_role_menu (role_id, menu_id)
VALUES (1, 22), (1, 23), (1, 24)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
