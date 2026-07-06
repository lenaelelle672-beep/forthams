import { describe, expect, it } from 'vitest';
import {
  SYSTEM_ASSET_CATEGORY_MENU_ID,
  SYSTEM_ASSET_CATEGORY_MODULE,
  SYSTEM_CACHE_MANAGEMENT_MENU_ID,
  SYSTEM_CACHE_MANAGEMENT_MODULE,
  SYSTEM_DEPT_ORG_MENU_ID,
  SYSTEM_DEPT_ORG_MODULE,
  SYSTEM_FILE_STORAGE_MENU_ID,
  SYSTEM_FILE_STORAGE_MODULE,
  SYSTEM_FLOW_DEFINITION_MENU_ID,
  SYSTEM_FLOW_DEFINITION_MODULE,
  SYSTEM_LOCATION_MANAGEMENT_MENU_ID,
  SYSTEM_LOCATION_MANAGEMENT_MODULE,
  SYSTEM_RUNTIME_MONITOR_MENU_ID,
  SYSTEM_RUNTIME_MONITOR_MODULE,
  SYSTEM_ROLE_PERMISSIONS_MENU_ID,
  SYSTEM_ROLE_PERMISSIONS_MODULE,
  SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID,
  SYSTEM_SETTINGS_COMMAND_CENTER_MODULE,
  SYSTEM_USER_MANAGEMENT_MENU_ID,
  SYSTEM_USER_MANAGEMENT_MODULE,
  SYSTEM_VENDOR_MANAGEMENT_MENU_ID,
  SYSTEM_VENDOR_MANAGEMENT_MODULE,
  SYSTEM_WEBHOOK_CONFIG_MENU_ID,
  SYSTEM_WEBHOOK_CONFIG_MODULE,
  getSystemModuleActionPermissions,
  getSystemModuleByMenuId,
  systemModuleRegistry,
} from '../pages/workspace-preview/system-hub/systemModuleRegistry';

describe('systemModuleRegistry 流程控制台只读聚合合同', () => {
  it('只在十四项基础上把 command-center 登记为第十五个真实 V3 模块', () => {
    expect(systemModuleRegistry.map((module) => module.menuId)).toEqual([
      'system-interfaces',
      'system-field-mapping',
      'system-sync-rules',
      'system-webhook-config',
      'system-cache-management',
      'system-file-storage',
      'system-asset-category',
      'system-vendor-management',
      'system-location-management',
      'system-user-management',
      'system-dept-org',
      'system-role-permissions',
      'system-flow-definition',
      'system-runtime-monitor',
      'system-settings-command-center',
    ]);
    expect(systemModuleRegistry).toHaveLength(15);
    expect(systemModuleRegistry).not.toHaveLength(44);
    expect(SYSTEM_WEBHOOK_CONFIG_MENU_ID).toBe('system-webhook-config');
    expect(getSystemModuleByMenuId('system-webhook-config')).toBe(SYSTEM_WEBHOOK_CONFIG_MODULE);
    expect(SYSTEM_CACHE_MANAGEMENT_MENU_ID).toBe('system-cache-management');
    expect(getSystemModuleByMenuId('system-cache-management')).toBe(SYSTEM_CACHE_MANAGEMENT_MODULE);
    expect(SYSTEM_FILE_STORAGE_MENU_ID).toBe('system-file-storage');
    expect(getSystemModuleByMenuId('system-file-storage')).toBe(SYSTEM_FILE_STORAGE_MODULE);
    expect(SYSTEM_ASSET_CATEGORY_MENU_ID).toBe('system-asset-category');
    expect(getSystemModuleByMenuId('system-asset-category')).toBe(SYSTEM_ASSET_CATEGORY_MODULE);
    expect(SYSTEM_VENDOR_MANAGEMENT_MENU_ID).toBe('system-vendor-management');
    expect(getSystemModuleByMenuId('system-vendor-management')).toBe(SYSTEM_VENDOR_MANAGEMENT_MODULE);
    expect(SYSTEM_LOCATION_MANAGEMENT_MENU_ID).toBe('system-location-management');
    expect(getSystemModuleByMenuId('system-location-management')).toBe(SYSTEM_LOCATION_MANAGEMENT_MODULE);
    expect(SYSTEM_USER_MANAGEMENT_MENU_ID).toBe('system-user-management');
    expect(getSystemModuleByMenuId('system-user-management')).toBe(SYSTEM_USER_MANAGEMENT_MODULE);
    expect(SYSTEM_DEPT_ORG_MENU_ID).toBe('system-dept-org');
    expect(getSystemModuleByMenuId('system-dept-org')).toBe(SYSTEM_DEPT_ORG_MODULE);
    expect(SYSTEM_ROLE_PERMISSIONS_MENU_ID).toBe('system-role-permissions');
    expect(getSystemModuleByMenuId('system-role-permissions')).toBe(SYSTEM_ROLE_PERMISSIONS_MODULE);
    expect(SYSTEM_FLOW_DEFINITION_MENU_ID).toBe('system-flow-definition');
    expect(getSystemModuleByMenuId('system-flow-definition')).toBe(SYSTEM_FLOW_DEFINITION_MODULE);
    expect(SYSTEM_RUNTIME_MONITOR_MENU_ID).toBe('system-runtime-monitor');
    expect(getSystemModuleByMenuId('system-runtime-monitor')).toBe(SYSTEM_RUNTIME_MONITOR_MODULE);
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID).toBe('system-settings-command-center');
    expect(getSystemModuleByMenuId('system-settings-command-center')).toBe(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE);
  });

  it('基础资料、组织权限、流程平台与流程控制台只读 metadata 只登记 query 且 actionPermissions 为空', () => {
    expect(SYSTEM_WEBHOOK_CONFIG_MODULE.permissionMeta.viewPermissions).toEqual(['system:integration:query']);
    expect(SYSTEM_WEBHOOK_CONFIG_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    });
    expect(getSystemModuleActionPermissions('system-webhook-config', 'test')).toEqual(['system:integration:test']);
    expect(SYSTEM_CACHE_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['system:cache:query']);
    expect(SYSTEM_CACHE_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({
      refresh: ['system:cache:refresh'],
    });
    expect(getSystemModuleActionPermissions('system-cache-management', 'refresh')).toEqual(['system:cache:refresh']);
    expect(SYSTEM_FILE_STORAGE_MODULE.navGroup).toBe('系统参数');
    expect(SYSTEM_FILE_STORAGE_MODULE.permissionMeta.viewPermissions).toEqual(['system:file-storage:query']);
    expect(SYSTEM_FILE_STORAGE_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-file-storage', 'refresh')).toEqual([]);
    expect(SYSTEM_ASSET_CATEGORY_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_ASSET_CATEGORY_MODULE.permissionMeta.viewPermissions).toEqual(['asset:category:query']);
    expect(SYSTEM_ASSET_CATEGORY_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-asset-category', 'refresh')).toEqual([]);
    expect(SYSTEM_VENDOR_MANAGEMENT_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_VENDOR_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['vendor:vendor:query']);
    expect(SYSTEM_VENDOR_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-vendor-management', 'refresh')).toEqual([]);
    expect(SYSTEM_LOCATION_MANAGEMENT_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_LOCATION_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['location:query']);
    expect(SYSTEM_LOCATION_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-location-management', 'refresh')).toEqual([]);
    expect(SYSTEM_USER_MANAGEMENT_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_USER_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['system:user:query']);
    expect(SYSTEM_USER_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-user-management', 'refresh')).toEqual([]);
    expect(SYSTEM_DEPT_ORG_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_DEPT_ORG_MODULE.permissionMeta.viewPermissions).toEqual(['system:dept:query']);
    expect(SYSTEM_DEPT_ORG_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-dept-org', 'refresh')).toEqual([]);
    expect(SYSTEM_ROLE_PERMISSIONS_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_ROLE_PERMISSIONS_MODULE.permissionMeta.viewPermissions).toEqual(['system:role-permission:query']);
    expect(SYSTEM_ROLE_PERMISSIONS_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-role-permissions', 'refresh')).toEqual([]);
    expect(SYSTEM_FLOW_DEFINITION_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_FLOW_DEFINITION_MODULE.permissionMeta.viewPermissions).toEqual(['system:flow:query']);
    expect(SYSTEM_FLOW_DEFINITION_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-flow-definition', 'refresh')).toEqual([]);
    expect(SYSTEM_RUNTIME_MONITOR_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_RUNTIME_MONITOR_MODULE.permissionMeta.viewPermissions).toEqual(['system:runtime:query']);
    expect(SYSTEM_RUNTIME_MONITOR_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-runtime-monitor', 'refresh')).toEqual([]);
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE.permissionMeta.viewPermissions).toEqual(['system:flow:query', 'system:runtime:query']);
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-settings-command-center', 'refresh')).toEqual([]);
  });
});
