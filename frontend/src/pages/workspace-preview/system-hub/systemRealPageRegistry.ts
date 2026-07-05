import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type EmbeddedWorkbenchProps = { embeddedInWorkbench?: boolean };
export type SystemRealPageComponent = ComponentType<EmbeddedWorkbenchProps>;
export type SystemRealPageEntry = LazyExoticComponent<SystemRealPageComponent>;

export const systemRealPageRegistry: Record<string, SystemRealPageEntry> = {
  'system-interfaces': lazy(() => import('../../system/SystemInterfacesWorkbenchPage')),
  'system-field-mapping': lazy(() => import('../../system/SystemFieldMappingsWorkbenchPage')),
  'system-sync-rules': lazy(() => import('../../system/SystemSyncRulesWorkbenchPage')),
  'system-webhook-config': lazy(() => import('../../system/SystemWebhookConfigWorkbenchPage')),
};

export function isSystemRealPageMenuId(menuId: string | undefined): boolean {
  return Boolean(menuId && Object.prototype.hasOwnProperty.call(systemRealPageRegistry, menuId));
}

export function getSystemRealPage(menuId: string | undefined): SystemRealPageEntry | undefined {
  return menuId ? systemRealPageRegistry[menuId] : undefined;
}
