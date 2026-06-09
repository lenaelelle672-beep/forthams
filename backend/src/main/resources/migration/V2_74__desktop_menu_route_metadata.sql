-- V2_74__desktop_menu_route_metadata
-- Align existing sys_menu route metadata with the desktop React routes.
-- This prepares /menus/current for sidebar/search rendering without changing
-- role bindings or backend authorization.

UPDATE sys_menu
SET path = CASE id
    WHEN 2 THEN 'system/users'
    WHEN 7 THEN 'system/roles'
    WHEN 12 THEN 'system/depts'
    WHEN 17 THEN 'system/menus'
    WHEN 101 THEN 'assets'
    WHEN 106 THEN 'categories'
    WHEN 111 THEN 'maintenance'
    WHEN 116 THEN 'retirement'
    WHEN 125 THEN 'inventory'
    WHEN 130 THEN 'idle'
    WHEN 136 THEN 'compensation'
    WHEN 141 THEN 'depreciation'
    WHEN 144 THEN 'disposals'
    WHEN 151 THEN 'approvals'
    WHEN 161 THEN 'workorders'
    WHEN 171 THEN 'locations'
    WHEN 176 THEN 'vendors'
    WHEN 186 THEN 'dashboard'
    WHEN 188 THEN 'reports'
    WHEN 190 THEN 'analytics'
    WHEN 192 THEN 'bigscreen'
    WHEN 194 THEN 'audit'
    WHEN 201 THEN 'notifications'
    WHEN 206 THEN 'settings/sysconfig'
    WHEN 212 THEN 'maintenance/execution'
    WHEN 300 THEN 'inventory/abc-classification'
    ELSE path
END,
component = CASE id
    WHEN 2 THEN 'system/UserManagement'
    WHEN 7 THEN 'system/RoleManagement'
    WHEN 12 THEN 'system/DeptManagement'
    WHEN 17 THEN 'system/MenuManagement'
    WHEN 101 THEN 'asset/AssetListPage'
    WHEN 106 THEN 'category/CategoryManagerPage'
    WHEN 111 THEN 'maintenance/MaintenancePage'
    WHEN 116 THEN 'retirement/RetirementListPage'
    WHEN 125 THEN 'inventory/InventoryTasksPage'
    WHEN 130 THEN 'idle/IdleAssetsPage'
    WHEN 136 THEN 'disposal/AssetCompensationFormPage'
    WHEN 141 THEN 'depreciation/DepreciationListPage'
    WHEN 144 THEN 'disposal/DisposalListPage'
    WHEN 151 THEN 'approval/ApprovalListPage'
    WHEN 161 THEN 'workorder/WorkOrderFormPage'
    WHEN 171 THEN 'locations/LocationsPage'
    WHEN 176 THEN 'vendors/VendorsPage'
    WHEN 186 THEN 'dashboard/DashboardPage'
    WHEN 188 THEN 'reports/ReportsPage'
    WHEN 190 THEN 'analytics/AnalyticsPage'
    WHEN 192 THEN 'bigscreen/BigScreenPage'
    WHEN 194 THEN 'audit/AuditDashboardPage'
    WHEN 201 THEN 'notifications/NotificationsPage'
    WHEN 206 THEN 'settings/SettingsPage'
    WHEN 212 THEN 'maintenance/execution/MaintenanceExecutionPage'
    WHEN 300 THEN 'inventory/ABCClassificationPage'
    ELSE component
END
WHERE id IN (
    2, 7, 12, 17,
    101, 106, 111, 116, 125, 130, 136, 141, 144, 151, 161, 171, 176,
    186, 188, 190, 192, 194, 201, 206, 212, 300
);
