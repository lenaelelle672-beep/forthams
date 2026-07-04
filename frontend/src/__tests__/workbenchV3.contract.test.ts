import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const workbenchV3Page = readText('../pages/workbench-v3/WorkbenchV3Page.tsx');
const registrySource = readText('../pages/workspace-preview/system-hub/systemRealPageRegistry.ts');
const moduleSource = readText('../pages/workspace-preview/system-hub/systemModuleRegistry.ts');

describe('Workbench V3 三项菜单合同', () => {
  it('三项菜单全部处于已接入真组件状态', () => {
    for (const menuId of ['system-interfaces', 'system-field-mapping', 'system-sync-rules']) {
      expect(workbenchV3Page).toContain(`id: '${menuId}'`);
    }
    expect(workbenchV3Page.match(/\{ id: 'system-[^']+'.+status: '已接入真组件' \}/g)).toHaveLength(3);
  });

  it('三项菜单经 registry 渲染专属 V3 页面', () => {
    expect(registrySource).toContain("'system-interfaces': lazy(() => import('../../system/SystemInterfacesWorkbenchPage'))");
    expect(registrySource).toContain("'system-field-mapping': lazy(() => import('../../system/SystemFieldMappingsWorkbenchPage'))");
    expect(registrySource).toContain("'system-sync-rules': lazy(() => import('../../system/SystemSyncRulesWorkbenchPage'))");
  });

  it('三项菜单具备 module metadata 与权限元数据', () => {
    for (const moduleExport of ['SYSTEM_INTERFACES_MODULE', 'SYSTEM_FIELD_MAPPING_MODULE', 'SYSTEM_SYNC_RULES_MODULE']) {
      expect(moduleSource).toContain(`export const ${moduleExport} =`);
      expect(moduleSource).toMatch(new RegExp(`\\b${moduleExport},`));
    }
    expect(moduleSource).toContain("viewPermissions: ['system:integration:query']");
  });
});
