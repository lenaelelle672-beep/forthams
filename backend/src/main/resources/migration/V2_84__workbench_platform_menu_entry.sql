-- V2_84__workbench_platform_menu_entry
-- Promote Workbench to the formal desktop entry while keeping Dashboard as
-- a transition-only legacy route. This only seeds route metadata and role
-- bindings; it does not create duplicate pages.

INSERT INTO sys_menu (id, menu_name, parent_id, sort_order, path, query_param, component, menu_type, perms, icon, visible, status)
VALUES
    (310, '资产运营中枢', 185, 1, 'fixed-assets/workbench', 'menu=home', 'workspace-preview/WorkspacePreviewPage', 'C', 'dashboard:query', 'shield-check', 1, 1),
    (311, '资产运营中枢查询', 310, 1, NULL, NULL, NULL, 'F', 'dashboard:query', NULL, 1, 1)
ON DUPLICATE KEY UPDATE
    menu_name = VALUES(menu_name),
    parent_id = VALUES(parent_id),
    sort_order = VALUES(sort_order),
    path = VALUES(path),
    query_param = VALUES(query_param),
    component = VALUES(component),
    menu_type = VALUES(menu_type),
    perms = VALUES(perms),
    icon = VALUES(icon),
    visible = VALUES(visible),
    status = VALUES(status);

UPDATE sys_menu
SET
    menu_name = CASE id
        WHEN 186 THEN '旧版仪表板'
        ELSE menu_name
    END,
    sort_order = CASE id
        WHEN 186 THEN 2
        WHEN 188 THEN 3
        WHEN 190 THEN 4
        WHEN 192 THEN 5
        WHEN 194 THEN 6
        ELSE sort_order
    END,
    path = CASE id
        WHEN 186 THEN 'dashboard'
        ELSE path
    END,
    component = CASE id
        WHEN 186 THEN 'dashboard/DashboardPage'
        ELSE component
    END,
    perms = CASE id
        WHEN 186 THEN 'dashboard:query'
        ELSE perms
    END,
    icon = CASE id
        WHEN 186 THEN 'layout-dashboard'
        ELSE icon
    END,
    visible = CASE id
        WHEN 186 THEN 1
        ELSE visible
    END,
    status = CASE id
        WHEN 186 THEN 1
        ELSE status
    END
WHERE id IN (186, 188, 190, 192, 194);

UPDATE sys_menu
SET menu_name = '旧版仪表板查询'
WHERE id = 187;

INSERT INTO sys_role_menu (role_id, menu_id)
VALUES
    (1, 310),
    (1, 311)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
