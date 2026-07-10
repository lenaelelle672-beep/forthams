import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const workbenchV3Page = readText('../pages/workbench-v3/WorkbenchV3Page.tsx');
const systemPageHost = readText('../pages/workbench-v3/SystemPageHost.tsx');
const systemInspectorSlotProvider = readText('../pages/workbench-v3/SystemInspectorSlotProvider.tsx');
const registrySource = readText('../pages/workspace-preview/system-hub/systemRealPageRegistry.ts');
const moduleSource = readText('../pages/workspace-preview/system-hub/systemModuleRegistry.ts');
const appRoutesSource = readText('../app/routes.ts');

describe('Workbench V3 菜单权限批次合同', () => {
  it('四十项菜单全部处于已接入真组件状态，且仍非 44 项全量完成', () => {
    for (const menuId of ['system-interfaces', 'system-field-mapping', 'system-sync-rules', 'system-webhook-config', 'system-external-systems', 'system-base-params', 'system-security-policy', 'system-audit-log', 'system-mail-gateway', 'system-mail-templates', 'system-mail-logs', 'system-notification-templates', 'system-notification-channels', 'system-notification-preferences', 'system-workflow-notification-switch', 'system-cache-management', 'system-file-storage', 'system-asset-category', 'system-numbering-rules', 'system-custom-fields', 'system-custom-field-sets', 'system-vendor-management', 'system-location-management', 'system-user-management', 'system-dept-org', 'system-role-permissions', 'system-menu-permissions', 'system-post-management', 'system-tenant-management', 'system-data-permissions', 'system-import-export', 'system-flow-definition', 'system-flow-designer', 'system-form-config', 'system-form-storage', 'system-approval-rules', 'system-todo-fields', 'system-sla-config', 'system-runtime-monitor', 'system-settings-command-center']) {
      expect(workbenchV3Page).toContain(`id: '${menuId}'`);
    }
    expect(workbenchV3Page.match(/\{ id: 'system-[^']+'.+status: '已接入真组件' \}/g)).toHaveLength(40);
    expect(workbenchV3Page).toContain('四十项菜单');
    expect(workbenchV3Page).toContain('system-import-export 已接入导入导出任务历史只读 catalog');
    expect(workbenchV3Page).toContain('仍非 44 项全量覆盖');
    expect(workbenchV3Page).toContain('仍不是 Workbench V3 全量完成');
    expect(workbenchV3Page).toContain('基础资料组未全组完成');
    expect(workbenchV3Page).toContain('消息与通知组未全组完成');
    expect(workbenchV3Page).toContain('邮件子系统未全组完成');
    expect(workbenchV3Page).not.toContain('system-menu-permissions 仍保持 blocked');
    expect(workbenchV3Page).not.toContain('Day6 pending reviewer gate');
    expect(workbenchV3Page).not.toContain('accepted coverage 仍为 8/9');
    expect(workbenchV3Page).not.toContain('PASS 后最多 9/9');
    expect(workbenchV3Page).not.toContain('44/44');
  });

  it('宿主页直接以系统管理 V3 工作台作为顶部标题，不渲染应用级顶栏', () => {
    expect(workbenchV3Page).toContain('系统管理 V3 工作台');
    expect(workbenchV3Page).not.toContain('aria-label="Workbench V3 顶部导航"');
    expect(workbenchV3Page).not.toContain('企业资产管理系统');
    expect(workbenchV3Page).not.toContain('搜索资产...');
    expect(workbenchV3Page).not.toContain('useAuth');
  });

  it('六域作为顶部一级导航，当前分组子项放在左侧导航', () => {
    expect(workbenchV3Page).toContain('aria-label="Workbench V3 六域顶部导航"');
    expect(workbenchV3Page).toContain('aria-label="Workbench V3 子项导航"');
    expect(workbenchV3Page).toContain('当前分组');
    expect(workbenchV3Page).not.toContain('已接入菜单');
    expect(workbenchV3Page).not.toContain('aria-label="Workbench V3 系统菜单"');
  });

  it('默认菜单与宿主底座使用 Workbench V3 本地承载，不把 V2 入口作为完成证据', () => {
    expect(workbenchV3Page).toContain("const defaultWorkbenchV3MenuId = 'system-user-management'");
    expect(workbenchV3Page).toContain("import SystemPageHost from './SystemPageHost'");
    expect(workbenchV3Page).toContain("import { SystemInspectorSlotProvider } from './SystemInspectorSlotProvider'");
    expect(workbenchV3Page).toContain('<SystemInspectorSlotProvider activeMenu={activeMenu} activeMenuLabel={activeMenuLabel}>');
    expect(workbenchV3Page).toContain('<SystemPageHost activeMenu={activeMenu} activeMenuLabel={activeMenuLabel} RealPage={RealPage} />');
    expect(workbenchV3Page).not.toContain("'system-mail-gateway': '邮件网关配置'");
    expect(systemPageHost).toContain('data-system-page-host="workbench-v3"');
    expect(systemPageHost).toContain('该菜单尚未接入 Workbench V3 真组件');
    expect(systemPageHost).toContain('V3 本地建设中占位');
    expect(systemPageHost).toContain('不会把旧 V2 工作台入口作为默认路径或完成证据');
    expect(systemInspectorSlotProvider).toContain('createContext<SystemInspectorSlotState | null>');
    expect(workbenchV3Page).not.toContain('/fixed-assets/workbench?menu=');
    expect(workbenchV3Page).not.toContain('打开 V2 工作台入口');
    expect(workbenchV3Page).toContain('待接入 V3');
  });

  it('宿主页渲染 V3 六域顶部导航并覆盖消息与通知深链接', () => {
    expect(workbenchV3Page).toContain('aria-label="Workbench V3 六域顶部导航"');
    for (const groupLabel of ['流程平台', '组织权限', '基础资料', '集成配置', '消息与通知', '系统参数']) {
      expect(workbenchV3Page).toContain(`label: '${groupLabel}'`);
    }
    expect(workbenchV3Page).toContain("id: 'system-mail-gateway', label: '邮件网关配置'");
    expect(workbenchV3Page).toContain("id: 'system-workflow-notification-switch', label: '流程通知开关'");
    expect(workbenchV3Page).toContain('已接入');
  });

  it('流程平台新增菜单经 registry 渲染专属 V3 页面', () => {
    expect(registrySource).toContain("'system-interfaces': lazy(() => import('../../system/SystemInterfacesWorkbenchPage'))");
    expect(registrySource).toContain("'system-field-mapping': lazy(() => import('../../system/SystemFieldMappingsWorkbenchPage'))");
    expect(registrySource).toContain("'system-sync-rules': lazy(() => import('../../system/SystemSyncRulesWorkbenchPage'))");
    expect(registrySource).toContain("'system-webhook-config': lazy(() => import('../../system/SystemWebhookConfigWorkbenchPage'))");
    expect(registrySource).toContain("'system-external-systems': lazy(() => import('../../system/SystemExternalSystemsWorkbenchPage'))");
    expect(registrySource).toContain("'system-base-params': lazy(() => import('../../system/SystemBaseParamsWorkbenchPage'))");
    expect(registrySource).toContain("'system-security-policy': lazy(() => import('../../system/SystemSecurityPolicyWorkbenchPage'))");
    expect(registrySource).toContain("'system-audit-log': lazy(() => import('../../system/SystemAuditLogWorkbenchPage'))");
    expect(registrySource).toContain("'system-mail-gateway': lazy(() => import('../../system/SystemMailGatewayWorkbenchPage'))");
    expect(registrySource).toContain("'system-mail-templates': lazy(() => import('../../system/SystemMailTemplatesWorkbenchPage'))");
    expect(registrySource).toContain("'system-mail-logs': lazy(() => import('../../system/SystemMailLogsWorkbenchPage'))");
    expect(registrySource).toContain("'system-notification-templates': lazy(() => import('../../system/SystemNotificationTemplatesWorkbenchPage'))");
    expect(registrySource).toContain("'system-notification-channels': lazy(() => import('../../system/SystemNotificationChannelsWorkbenchPage'))");
    expect(registrySource).toContain("'system-notification-preferences': lazy(() => import('../../system/SystemNotificationPreferencesWorkbenchPage'))");
    expect(registrySource).toContain("'system-workflow-notification-switch': lazy(() => import('../../system/SystemWorkflowNotificationSwitchWorkbenchPage'))");
    expect(registrySource).toContain("'system-cache-management': lazy(() => import('../../system/SystemCacheManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-file-storage': lazy(() => import('../../system/SystemFileStorageWorkbenchPage'))");
    expect(registrySource).toContain("'system-asset-category': lazy(() => import('../../system/SystemAssetCategoryWorkbenchPage'))");
    expect(registrySource).toContain("'system-numbering-rules': lazy(() => import('../../system/SystemNumberingRulesWorkbenchPage'))");
    expect(registrySource).toContain("'system-custom-fields': lazy(() => import('../../system/SystemCustomFieldsWorkbenchPage'))");
    expect(registrySource).toContain("'system-custom-field-sets': lazy(() => import('../../system/SystemCustomFieldSetsWorkbenchPage'))");
    expect(registrySource).toContain("'system-vendor-management': lazy(() => import('../../system/SystemVendorManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-location-management': lazy(() => import('../../system/SystemLocationManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-user-management': lazy(() => import('../../system/SystemUserManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-dept-org': lazy(() => import('../../system/SystemDeptOrgWorkbenchPage'))");
    expect(registrySource).toContain("'system-role-permissions': lazy(() => import('../../system/SystemRolePermissionsWorkbenchPage'))");
    expect(registrySource).toContain("'system-menu-permissions': lazy(() => import('../../system/SystemMenuPermissionsWorkbenchPage'))");
    expect(registrySource).toContain("'system-post-management': lazy(() => import('../../system/SystemPostManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-tenant-management': lazy(() => import('../../system/SystemTenantManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-data-permissions': lazy(() => import('../../system/SystemDataPermissionsWorkbenchPage'))");
    expect(registrySource).toContain("'system-import-export': lazy(() => import('../../system/SystemImportExportWorkbenchPage'))");
    expect(registrySource).toContain("'system-flow-definition': lazy(() => import('../../system/SystemFlowDefinitionWorkbenchPage'))");
    expect(registrySource).toContain("'system-flow-designer': lazy(() => import('../../system/SystemFlowDesignerWorkbenchPage'))");
    expect(registrySource).toContain("'system-form-config': lazy(() => import('../../system/SystemFormConfigWorkbenchPage'))");
    expect(registrySource).toContain("'system-form-storage': lazy(() => import('../../system/SystemFormStorageWorkbenchPage'))");
    expect(registrySource).toContain("'system-approval-rules': lazy(() => import('../../system/SystemApprovalRulesWorkbenchPage'))");
    expect(registrySource).toContain("'system-todo-fields': lazy(() => import('../../system/SystemTodoFieldsWorkbenchPage'))");
    expect(registrySource).toContain("'system-sla-config': lazy(() => import('../../system/SystemSlaConfigWorkbenchPage'))");
    expect(registrySource).toContain("'system-runtime-monitor': lazy(() => import('../../system/SystemRuntimeMonitorWorkbenchPage'))");
    expect(registrySource).toContain("'system-settings-command-center': lazy(() => import('../../system/SystemSettingsCommandCenterWorkbenchPage'))");
  });

  it('菜单权限新增模块具备 module metadata 与只读权限元数据', () => {
    for (const moduleExport of ['SYSTEM_INTERFACES_MODULE', 'SYSTEM_FIELD_MAPPING_MODULE', 'SYSTEM_SYNC_RULES_MODULE', 'SYSTEM_WEBHOOK_CONFIG_MODULE', 'SYSTEM_EXTERNAL_SYSTEMS_MODULE', 'SYSTEM_BASE_PARAMS_MODULE', 'SYSTEM_SECURITY_POLICY_MODULE', 'SYSTEM_AUDIT_LOG_MODULE', 'SYSTEM_MAIL_GATEWAY_MODULE', 'SYSTEM_MAIL_TEMPLATES_MODULE', 'SYSTEM_MAIL_LOGS_MODULE', 'SYSTEM_NOTIFICATION_TEMPLATES_MODULE', 'SYSTEM_NOTIFICATION_CHANNELS_MODULE', 'SYSTEM_NOTIFICATION_PREFERENCES_MODULE', 'SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE', 'SYSTEM_CACHE_MANAGEMENT_MODULE', 'SYSTEM_FILE_STORAGE_MODULE', 'SYSTEM_ASSET_CATEGORY_MODULE', 'SYSTEM_NUMBERING_RULES_MODULE', 'SYSTEM_CUSTOM_FIELDS_MODULE', 'SYSTEM_CUSTOM_FIELD_SETS_MODULE', 'SYSTEM_VENDOR_MANAGEMENT_MODULE', 'SYSTEM_LOCATION_MANAGEMENT_MODULE', 'SYSTEM_USER_MANAGEMENT_MODULE', 'SYSTEM_DEPT_ORG_MODULE', 'SYSTEM_ROLE_PERMISSIONS_MODULE', 'SYSTEM_MENU_PERMISSIONS_MODULE', 'SYSTEM_POST_MANAGEMENT_MODULE', 'SYSTEM_TENANT_MANAGEMENT_MODULE', 'SYSTEM_DATA_PERMISSIONS_MODULE', 'SYSTEM_IMPORT_EXPORT_MODULE', 'SYSTEM_FLOW_DEFINITION_MODULE', 'SYSTEM_FLOW_DESIGNER_MODULE', 'SYSTEM_FORM_CONFIG_MODULE', 'SYSTEM_FORM_STORAGE_MODULE', 'SYSTEM_APPROVAL_RULES_MODULE', 'SYSTEM_TODO_FIELDS_MODULE', 'SYSTEM_SLA_CONFIG_MODULE', 'SYSTEM_RUNTIME_MONITOR_MODULE', 'SYSTEM_SETTINGS_COMMAND_CENTER_MODULE']) {
      expect(moduleSource).toContain(`export const ${moduleExport} =`);
      expect(moduleSource).toMatch(new RegExp(`\\b${moduleExport},`));
    }
    expect(moduleSource).toContain("viewPermissions: ['system:integration:query']");
    expect(moduleSource).toContain("test: ['system:integration:test']");
    expect(moduleSource).toContain("menuId: SYSTEM_EXTERNAL_SYSTEMS_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_BASE_PARAMS_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_SECURITY_POLICY_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_AUDIT_LOG_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_MAIL_GATEWAY_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_MAIL_TEMPLATES_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_MAIL_LOGS_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_NOTIFICATION_TEMPLATES_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_NOTIFICATION_CHANNELS_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_NOTIFICATION_PREFERENCES_MENU_ID");
    expect(moduleSource).toContain("menuId: SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MENU_ID");
    expect(moduleSource).toContain("viewPermissions: ['system:config:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:audit-log:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:mail-gateway:query', 'system:mail-gateway:read', 'system:mail-gateway:meta']");
    expect(moduleSource).toContain("preview: ['system:mail-gateway:preview']");
    expect(moduleSource).toContain("viewPermissions: ['system:mail-template:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:mail-log:query', 'system:mail-log:read', 'system:mail-log:meta']");
    expect(moduleSource).toContain("viewPermissions: ['system:notification-template:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:notification-channel:query', 'system:notification-channel:read']");
    expect(moduleSource).toContain("preview: ['system:notification-channel:preview']");
    expect(moduleSource).toContain("viewPermissions: ['system:notification-preference:query', 'system:notification-preference:read']");
    expect(moduleSource).toContain("preview: ['system:notification-preference:preview']");
    expect(moduleSource).toContain("viewPermissions: ['system:notification-switch:query', 'system:notification-switch:read']");
    expect(moduleSource).toContain("preview: ['system:notification-switch:preview']");
    expect(moduleSource).toContain("preview: ['system:config:preview']");
    expect(moduleSource).toContain("refresh: ['system:config:refresh']");
    expect(moduleSource).toContain("viewPermissions: ['system:cache:query']");
    expect(moduleSource).toContain("refresh: ['system:cache:refresh']");
    expect(moduleSource).toContain("viewPermissions: ['system:file-storage:query']");
    expect(moduleSource).toContain("viewPermissions: ['asset:category:query']");
    expect(moduleSource).toContain("menuId: SYSTEM_NUMBERING_RULES_MENU_ID");
    expect(moduleSource).toContain("viewPermissions: ['system:numbering-rule:query', 'system:numbering-rule:read']");
    expect(moduleSource).toContain("preview: ['system:numbering-rule:preview']");
    expect(moduleSource).toContain("viewPermissions: ['system:custom-field:query']");
    expect(moduleSource).toContain("preview: ['system:custom-field:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:custom-fieldset:query', 'system:custom-fieldset:read']");
    expect(moduleSource).toContain("preview: ['system:custom-fieldset:preview']");
    expect(moduleSource).toContain("viewPermissions: ['vendor:vendor:query']");
    expect(moduleSource).toContain("viewPermissions: ['location:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:user:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:dept:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:role-permission:query']");
    expect(moduleSource).toContain('menuId: SYSTEM_MENU_PERMISSIONS_MENU_ID');
    expect(moduleSource).toContain('menuId: SYSTEM_POST_MANAGEMENT_MENU_ID');
    expect(moduleSource).toContain("viewPermissions: ['system:post:query', 'system:post:read', 'system:post:meta']");
    expect(moduleSource).toContain("preview: ['system:post:preview']");
    expect(moduleSource).toContain('menuId: SYSTEM_TENANT_MANAGEMENT_MENU_ID');
    expect(moduleSource).toContain("viewPermissions: ['system:tenant:query', 'system:tenant:read', 'system:tenant:meta']");
    expect(moduleSource).toContain('menuId: SYSTEM_DATA_PERMISSIONS_MENU_ID');
    expect(moduleSource).toContain("viewPermissions: ['system:flow:query']");
    expect(moduleSource).toContain("edit: ['workflow:designer:edit']");
    expect(moduleSource).toContain("publish: ['workflow:designer:publish']");
    expect(moduleSource).toContain("rollback: ['workflow:designer:rollback']");
    expect(moduleSource).toContain("viewPermissions: ['workflow:form:list', 'workflow:form:view']");
    expect(moduleSource).toContain("edit: ['workflow:form:update']");
    expect(moduleSource).toContain("publish: ['workflow:form:publish']");
    expect(moduleSource).toContain("disable: ['workflow:form:disable']");
    expect(moduleSource).toContain("rollback: ['workflow:form:rollback']");
    expect(moduleSource).toContain("viewPermissions: ['workflow:form-storage:view']");
    expect(moduleSource).toContain("create: ['workflow:form-storage:create']");
    expect(moduleSource).toContain("edit: ['workflow:form-storage:update']");
    expect(moduleSource).toContain("archive: ['workflow:form-storage:archive']");
    expect(moduleSource).toContain("delete: ['workflow:form-storage:delete']");
    expect(moduleSource).toContain("export: ['workflow:form-storage:export']");
    expect(moduleSource).toContain("viewPermissions: ['workflow:approval-rule:list']");
    expect(moduleSource).toContain("create: ['workflow:approval-rule:create']");
    expect(moduleSource).toContain("edit: ['workflow:approval-rule:update']");
    expect(moduleSource).toContain("enable: ['workflow:approval-rule:enable']");
    expect(moduleSource).toContain("disable: ['workflow:approval-rule:disable']");
    expect(moduleSource).toContain("test: ['workflow:approval-rule:test']");
    expect(moduleSource).toContain("viewPermissions: ['workflow:todo-field:list']");
    expect(moduleSource).toContain("edit: ['workflow:todo-field:update']");
    expect(moduleSource).toContain("sort: ['workflow:todo-field:update']");
    expect(moduleSource).toContain("reset: ['workflow:todo-field:reset']");
    expect(moduleSource).toContain("viewPermissions: ['workflow:sla:list']");
    expect(moduleSource).toContain("edit: ['workflow:sla:update']");
    expect(moduleSource).toContain("enable: ['workflow:sla:enable']");
    expect(moduleSource).toContain("disable: ['workflow:sla:disable']");
    expect(moduleSource).toContain("test: ['workflow:sla:test']");
    expect(moduleSource).toContain("export: ['workflow:sla:export']");
    expect(moduleSource).toContain("viewPermissions: ['system:runtime:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:flow:query', 'system:runtime:query']");
    expect(moduleSource).toContain('actionPermissions: {}');
  });

  it('实际应用路由挂载 Workbench V3 宿主页面', () => {
    expect(appRoutesSource).toContain('import("../pages/workbench-v3/WorkbenchV3Page")');
    expect(appRoutesSource).toContain('path: "fixed-assets/workbenchv3"');
    expect(appRoutesSource).not.toContain('/fixed-assets/workbenchv3", permission');
  });
});
