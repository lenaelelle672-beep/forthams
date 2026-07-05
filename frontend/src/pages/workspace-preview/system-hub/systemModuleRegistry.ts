export type SystemModuleActionKey = 'create' | 'edit' | 'delete' | 'test' | 'preview' | 'dryRun' | 'retryLog';

export type SystemModulePermissionMeta = {
  viewPermissions: readonly string[];
  actionPermissions: Partial<Record<SystemModuleActionKey, readonly string[]>>;
};

export type SystemModuleRegistryItem = {
  menuId: string;
  label: string;
  navGroup: string;
  workbenchPath: string;
  legacyRoute: string;
  permissionMeta: SystemModulePermissionMeta;
};

export const SYSTEM_INTERFACES_MENU_ID = 'system-interfaces';
export const SYSTEM_FIELD_MAPPING_MENU_ID = 'system-field-mapping';
export const SYSTEM_SYNC_RULES_MENU_ID = 'system-sync-rules';
export const SYSTEM_WEBHOOK_CONFIG_MENU_ID = 'system-webhook-config';

export const SYSTEM_INTERFACES_MODULE = {
  menuId: SYSTEM_INTERFACES_MENU_ID,
  label: '接口管理',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-interfaces',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-interfaces',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FIELD_MAPPING_MODULE = {
  menuId: SYSTEM_FIELD_MAPPING_MENU_ID,
  label: '字段映射',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-field-mapping',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-field-mapping',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      preview: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_SYNC_RULES_MODULE = {
  menuId: SYSTEM_SYNC_RULES_MENU_ID,
  label: '同步规则',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-sync-rules',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-sync-rules',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      dryRun: ['system:integration:test'],
      retryLog: ['system:integration:edit'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_WEBHOOK_CONFIG_MODULE = {
  menuId: SYSTEM_WEBHOOK_CONFIG_MENU_ID,
  label: 'Webhook 配置',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-webhook-config',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-webhook-config',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const systemModuleRegistry = [
  SYSTEM_INTERFACES_MODULE,
  SYSTEM_FIELD_MAPPING_MODULE,
  SYSTEM_SYNC_RULES_MODULE,
  SYSTEM_WEBHOOK_CONFIG_MODULE,
] as const satisfies readonly SystemModuleRegistryItem[];

const systemModuleByMenuId = new Map<string, SystemModuleRegistryItem>(
  systemModuleRegistry.map((module) => [module.menuId, module]),
);

export function getSystemModuleByMenuId(menuId: string | null | undefined): SystemModuleRegistryItem | undefined {
  return menuId ? systemModuleByMenuId.get(menuId) : undefined;
}

export function getSystemModuleActionPermissions(
  menuId: string | null | undefined,
  action: SystemModuleActionKey,
): readonly string[] {
  return getSystemModuleByMenuId(menuId)?.permissionMeta.actionPermissions[action] ?? [];
}
