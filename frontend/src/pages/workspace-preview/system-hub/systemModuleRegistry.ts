export type SystemModuleActionKey = 'create' | 'edit' | 'delete' | 'test' | 'preview' | 'dryRun' | 'retryLog' | 'refresh';

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
export const SYSTEM_CACHE_MANAGEMENT_MENU_ID = 'system-cache-management';
export const SYSTEM_FILE_STORAGE_MENU_ID = 'system-file-storage';
export const SYSTEM_ASSET_CATEGORY_MENU_ID = 'system-asset-category';
export const SYSTEM_VENDOR_MANAGEMENT_MENU_ID = 'system-vendor-management';
export const SYSTEM_LOCATION_MANAGEMENT_MENU_ID = 'system-location-management';
export const SYSTEM_USER_MANAGEMENT_MENU_ID = 'system-user-management';
export const SYSTEM_DEPT_ORG_MENU_ID = 'system-dept-org';
export const SYSTEM_ROLE_PERMISSIONS_MENU_ID = 'system-role-permissions';
export const SYSTEM_FLOW_DEFINITION_MENU_ID = 'system-flow-definition';
export const SYSTEM_RUNTIME_MONITOR_MENU_ID = 'system-runtime-monitor';
export const SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID = 'system-settings-command-center';

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

export const SYSTEM_CACHE_MANAGEMENT_MODULE = {
  menuId: SYSTEM_CACHE_MANAGEMENT_MENU_ID,
  label: '缓存管理',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-cache-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-cache-management',
  permissionMeta: {
    viewPermissions: ['system:cache:query'],
    actionPermissions: {
      refresh: ['system:cache:refresh'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FILE_STORAGE_MODULE = {
  menuId: SYSTEM_FILE_STORAGE_MENU_ID,
  label: '文件存储',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-file-storage',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-file-storage',
  permissionMeta: {
    viewPermissions: ['system:file-storage:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_ASSET_CATEGORY_MODULE = {
  menuId: SYSTEM_ASSET_CATEGORY_MENU_ID,
  label: '资产分类',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-asset-category',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-asset-category',
  permissionMeta: {
    viewPermissions: ['asset:category:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_VENDOR_MANAGEMENT_MODULE = {
  menuId: SYSTEM_VENDOR_MANAGEMENT_MENU_ID,
  label: '供应商管理',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-vendor-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-vendor-management',
  permissionMeta: {
    viewPermissions: ['vendor:vendor:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_LOCATION_MANAGEMENT_MODULE = {
  menuId: SYSTEM_LOCATION_MANAGEMENT_MENU_ID,
  label: '位置管理',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-location-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-location-management',
  permissionMeta: {
    viewPermissions: ['location:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_USER_MANAGEMENT_MODULE = {
  menuId: SYSTEM_USER_MANAGEMENT_MENU_ID,
  label: '用户管理',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-user-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-user-management',
  permissionMeta: {
    viewPermissions: ['system:user:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_DEPT_ORG_MODULE = {
  menuId: SYSTEM_DEPT_ORG_MENU_ID,
  label: '部门组织',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-dept-org',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-dept-org',
  permissionMeta: {
    viewPermissions: ['system:dept:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_ROLE_PERMISSIONS_MODULE = {
  menuId: SYSTEM_ROLE_PERMISSIONS_MENU_ID,
  label: '角色权限',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-role-permissions',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-role-permissions',
  permissionMeta: {
    viewPermissions: ['system:role-permission:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FLOW_DEFINITION_MODULE = {
  menuId: SYSTEM_FLOW_DEFINITION_MENU_ID,
  label: '流程定义',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-flow-definition',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-flow-definition',
  permissionMeta: {
    viewPermissions: ['system:flow:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_RUNTIME_MONITOR_MODULE = {
  menuId: SYSTEM_RUNTIME_MONITOR_MENU_ID,
  label: '运行监控',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-runtime-monitor',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-runtime-monitor',
  permissionMeta: {
    viewPermissions: ['system:runtime:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_SETTINGS_COMMAND_CENTER_MODULE = {
  menuId: SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID,
  label: '流程控制台',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-settings-command-center',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-settings-command-center',
  permissionMeta: {
    viewPermissions: ['system:flow:query', 'system:runtime:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const systemModuleRegistry = [
  SYSTEM_INTERFACES_MODULE,
  SYSTEM_FIELD_MAPPING_MODULE,
  SYSTEM_SYNC_RULES_MODULE,
  SYSTEM_WEBHOOK_CONFIG_MODULE,
  SYSTEM_CACHE_MANAGEMENT_MODULE,
  SYSTEM_FILE_STORAGE_MODULE,
  SYSTEM_ASSET_CATEGORY_MODULE,
  SYSTEM_VENDOR_MANAGEMENT_MODULE,
  SYSTEM_LOCATION_MANAGEMENT_MODULE,
  SYSTEM_USER_MANAGEMENT_MODULE,
  SYSTEM_DEPT_ORG_MODULE,
  SYSTEM_ROLE_PERMISSIONS_MODULE,
  SYSTEM_FLOW_DEFINITION_MODULE,
  SYSTEM_RUNTIME_MONITOR_MODULE,
  SYSTEM_SETTINGS_COMMAND_CENTER_MODULE,
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
