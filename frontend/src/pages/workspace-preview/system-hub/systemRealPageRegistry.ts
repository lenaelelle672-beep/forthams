import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type EmbeddedWorkbenchProps = { embeddedInWorkbench?: boolean };
export type SystemRealPageComponent = ComponentType<EmbeddedWorkbenchProps>;
export type SystemRealPageEntry = LazyExoticComponent<SystemRealPageComponent>;

export const systemRealPageRegistry: Record<string, SystemRealPageEntry> = {
  'system-interfaces': lazy(() => import('../../system/SystemInterfacesWorkbenchPage')),
  'system-field-mapping': lazy(() => import('../../system/SystemFieldMappingsWorkbenchPage')),
  'system-sync-rules': lazy(() => import('../../system/SystemSyncRulesWorkbenchPage')),
  'system-webhook-config': lazy(() => import('../../system/SystemWebhookConfigWorkbenchPage')),
  'system-external-systems': lazy(() => import('../../system/SystemExternalSystemsWorkbenchPage')),
  'system-base-params': lazy(() => import('../../system/SystemBaseParamsWorkbenchPage')),
  'system-security-policy': lazy(() => import('../../system/SystemSecurityPolicyWorkbenchPage')),
  'system-audit-log': lazy(() => import('../../system/SystemAuditLogWorkbenchPage')),
  'system-mail-gateway': lazy(() => import('../../system/SystemMailGatewayWorkbenchPage')),
  'system-mail-templates': lazy(() => import('../../system/SystemMailTemplatesWorkbenchPage')),
  'system-mail-logs': lazy(() => import('../../system/SystemMailLogsWorkbenchPage')),
  'system-notification-templates': lazy(() => import('../../system/SystemNotificationTemplatesWorkbenchPage')),
  'system-notification-channels': lazy(() => import('../../system/SystemNotificationChannelsWorkbenchPage')),
  'system-notification-preferences': lazy(() => import('../../system/SystemNotificationPreferencesWorkbenchPage')),
  'system-workflow-notification-switch': lazy(() => import('../../system/SystemWorkflowNotificationSwitchWorkbenchPage')),
  'system-cache-management': lazy(() => import('../../system/SystemCacheManagementWorkbenchPage')),
  'system-file-storage': lazy(() => import('../../system/SystemFileStorageWorkbenchPage')),
  'system-asset-category': lazy(() => import('../../system/SystemAssetCategoryWorkbenchPage')),
  'system-numbering-rules': lazy(() => import('../../system/SystemNumberingRulesWorkbenchPage')),
  'system-custom-fields': lazy(() => import('../../system/SystemCustomFieldsWorkbenchPage')),
  'system-custom-field-sets': lazy(() => import('../../system/SystemCustomFieldSetsWorkbenchPage')),
  'system-vendor-management': lazy(() => import('../../system/SystemVendorManagementWorkbenchPage')),
  'system-location-management': lazy(() => import('../../system/SystemLocationManagementWorkbenchPage')),
  'system-user-management': lazy(() => import('../../system/SystemUserManagementWorkbenchPage')),
  'system-dept-org': lazy(() => import('../../system/SystemDeptOrgWorkbenchPage')),
  'system-role-permissions': lazy(() => import('../../system/SystemRolePermissionsWorkbenchPage')),
  'system-menu-permissions': lazy(() => import('../../system/SystemMenuPermissionsWorkbenchPage')),
  'system-post-management': lazy(() => import('../../system/SystemPostManagementWorkbenchPage')),
  'system-flow-definition': lazy(() => import('../../system/SystemFlowDefinitionWorkbenchPage')),
  'system-flow-designer': lazy(() => import('../../system/SystemFlowDesignerWorkbenchPage')),
  'system-form-config': lazy(() => import('../../system/SystemFormConfigWorkbenchPage')),
  'system-form-storage': lazy(() => import('../../system/SystemFormStorageWorkbenchPage')),
  'system-approval-rules': lazy(() => import('../../system/SystemApprovalRulesWorkbenchPage')),
  'system-todo-fields': lazy(() => import('../../system/SystemTodoFieldsWorkbenchPage')),
  'system-sla-config': lazy(() => import('../../system/SystemSlaConfigWorkbenchPage')),
  'system-runtime-monitor': lazy(() => import('../../system/SystemRuntimeMonitorWorkbenchPage')),
  'system-settings-command-center': lazy(() => import('../../system/SystemSettingsCommandCenterWorkbenchPage')),
  'system-tenant-management': lazy(() => import('../../system/SystemTenantManagementWorkbenchPage')),
  'system-data-permissions': lazy(() => import('../../system/SystemDataPermissionsWorkbenchPage')),
  'system-import-export': lazy(() => import('../../system/SystemImportExportWorkbenchPage')),
};

export function isSystemRealPageMenuId(menuId: string | undefined): boolean {
  return Boolean(menuId && Object.prototype.hasOwnProperty.call(systemRealPageRegistry, menuId));
}

export function getSystemRealPage(menuId: string | undefined): SystemRealPageEntry | undefined {
  return menuId ? systemRealPageRegistry[menuId] : undefined;
}
