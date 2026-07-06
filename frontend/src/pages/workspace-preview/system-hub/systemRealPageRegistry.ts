import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type EmbeddedWorkbenchProps = { embeddedInWorkbench?: boolean };
export type SystemRealPageComponent = ComponentType<EmbeddedWorkbenchProps>;
export type SystemRealPageEntry = LazyExoticComponent<SystemRealPageComponent>;

export const systemRealPageRegistry: Record<string, SystemRealPageEntry> = {
  'system-interfaces': lazy(() => import('../../system/SystemInterfacesWorkbenchPage')),
  'system-field-mapping': lazy(() => import('../../system/SystemFieldMappingsWorkbenchPage')),
  'system-sync-rules': lazy(() => import('../../system/SystemSyncRulesWorkbenchPage')),
  'system-webhook-config': lazy(() => import('../../system/SystemWebhookConfigWorkbenchPage')),
  'system-cache-management': lazy(() => import('../../system/SystemCacheManagementWorkbenchPage')),
  'system-file-storage': lazy(() => import('../../system/SystemFileStorageWorkbenchPage')),
  'system-asset-category': lazy(() => import('../../system/SystemAssetCategoryWorkbenchPage')),
  'system-vendor-management': lazy(() => import('../../system/SystemVendorManagementWorkbenchPage')),
  'system-location-management': lazy(() => import('../../system/SystemLocationManagementWorkbenchPage')),
  'system-user-management': lazy(() => import('../../system/SystemUserManagementWorkbenchPage')),
  'system-dept-org': lazy(() => import('../../system/SystemDeptOrgWorkbenchPage')),
  'system-role-permissions': lazy(() => import('../../system/SystemRolePermissionsWorkbenchPage')),
  'system-flow-definition': lazy(() => import('../../system/SystemFlowDefinitionWorkbenchPage')),
  'system-runtime-monitor': lazy(() => import('../../system/SystemRuntimeMonitorWorkbenchPage')),
  'system-settings-command-center': lazy(() => import('../../system/SystemSettingsCommandCenterWorkbenchPage')),
};

export function isSystemRealPageMenuId(menuId: string | undefined): boolean {
  return Boolean(menuId && Object.prototype.hasOwnProperty.call(systemRealPageRegistry, menuId));
}

export function getSystemRealPage(menuId: string | undefined): SystemRealPageEntry | undefined {
  return menuId ? systemRealPageRegistry[menuId] : undefined;
}
