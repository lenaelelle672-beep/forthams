import { describe, expect, it } from 'vitest';
import {
  SYSTEM_WEBHOOK_CONFIG_MENU_ID,
  SYSTEM_WEBHOOK_CONFIG_MODULE,
  getSystemModuleActionPermissions,
  getSystemModuleByMenuId,
  systemModuleRegistry,
} from '../pages/workspace-preview/system-hub/systemModuleRegistry';

describe('systemModuleRegistry Webhook 配置合同', () => {
  it('把 system-webhook-config 登记为第四个真实 V3 模块', () => {
    expect(systemModuleRegistry.map((module) => module.menuId)).toEqual([
      'system-interfaces',
      'system-field-mapping',
      'system-sync-rules',
      'system-webhook-config',
    ]);
    expect(SYSTEM_WEBHOOK_CONFIG_MENU_ID).toBe('system-webhook-config');
    expect(getSystemModuleByMenuId('system-webhook-config')).toBe(SYSTEM_WEBHOOK_CONFIG_MODULE);
  });

  it('Webhook 配置权限 metadata 对齐 query/edit/delete/test', () => {
    expect(SYSTEM_WEBHOOK_CONFIG_MODULE.permissionMeta.viewPermissions).toEqual(['system:integration:query']);
    expect(SYSTEM_WEBHOOK_CONFIG_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    });
    expect(getSystemModuleActionPermissions('system-webhook-config', 'test')).toEqual(['system:integration:test']);
  });
});
