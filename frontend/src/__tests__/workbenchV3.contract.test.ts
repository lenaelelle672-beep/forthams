import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const workbenchV3Page = readText('../pages/workbench-v3/WorkbenchV3Page.tsx');
const registrySource = readText('../pages/workspace-preview/system-hub/systemRealPageRegistry.ts');
const moduleSource = readText('../pages/workspace-preview/system-hub/systemModuleRegistry.ts');
const appRoutesSource = readText('../app/routes.ts');

describe('Workbench V3 流程控制台只读聚合批次合同', () => {
  it('十五项菜单全部处于已接入真组件状态，且仍非 44 项全量', () => {
    for (const menuId of ['system-interfaces', 'system-field-mapping', 'system-sync-rules', 'system-webhook-config', 'system-cache-management', 'system-file-storage', 'system-asset-category', 'system-vendor-management', 'system-location-management', 'system-user-management', 'system-dept-org', 'system-role-permissions', 'system-flow-definition', 'system-runtime-monitor', 'system-settings-command-center']) {
      expect(workbenchV3Page).toContain(`id: '${menuId}'`);
    }
    expect(workbenchV3Page.match(/\{ id: 'system-[^']+'.+status: '已接入真组件' \}/g)).toHaveLength(15);
    expect(workbenchV3Page).toContain('十五项菜单');
    expect(workbenchV3Page).toContain('仍非 44 项全量覆盖');
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

  it('未接入 V3 的深链接仍保留宿主壳层并指向 V2 工作台入口', () => {
    expect(workbenchV3Page).toContain("'system-mail-gateway': '邮件网关配置'");
    expect(workbenchV3Page).toContain('该菜单尚未接入 Workbench V3 真组件');
    expect(workbenchV3Page).toContain('/fixed-assets/workbench?menu=');
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

  it('command-center 菜单经 registry 渲染专属 V3 页面', () => {
    expect(registrySource).toContain("'system-interfaces': lazy(() => import('../../system/SystemInterfacesWorkbenchPage'))");
    expect(registrySource).toContain("'system-field-mapping': lazy(() => import('../../system/SystemFieldMappingsWorkbenchPage'))");
    expect(registrySource).toContain("'system-sync-rules': lazy(() => import('../../system/SystemSyncRulesWorkbenchPage'))");
    expect(registrySource).toContain("'system-webhook-config': lazy(() => import('../../system/SystemWebhookConfigWorkbenchPage'))");
    expect(registrySource).toContain("'system-cache-management': lazy(() => import('../../system/SystemCacheManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-file-storage': lazy(() => import('../../system/SystemFileStorageWorkbenchPage'))");
    expect(registrySource).toContain("'system-asset-category': lazy(() => import('../../system/SystemAssetCategoryWorkbenchPage'))");
    expect(registrySource).toContain("'system-vendor-management': lazy(() => import('../../system/SystemVendorManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-location-management': lazy(() => import('../../system/SystemLocationManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-user-management': lazy(() => import('../../system/SystemUserManagementWorkbenchPage'))");
    expect(registrySource).toContain("'system-dept-org': lazy(() => import('../../system/SystemDeptOrgWorkbenchPage'))");
    expect(registrySource).toContain("'system-role-permissions': lazy(() => import('../../system/SystemRolePermissionsWorkbenchPage'))");
    expect(registrySource).toContain("'system-flow-definition': lazy(() => import('../../system/SystemFlowDefinitionWorkbenchPage'))");
    expect(registrySource).toContain("'system-runtime-monitor': lazy(() => import('../../system/SystemRuntimeMonitorWorkbenchPage'))");
    expect(registrySource).toContain("'system-settings-command-center': lazy(() => import('../../system/SystemSettingsCommandCenterWorkbenchPage'))");
  });

  it('流程控制台新增模块具备只读 module metadata 与权限元数据', () => {
    for (const moduleExport of ['SYSTEM_INTERFACES_MODULE', 'SYSTEM_FIELD_MAPPING_MODULE', 'SYSTEM_SYNC_RULES_MODULE', 'SYSTEM_WEBHOOK_CONFIG_MODULE', 'SYSTEM_CACHE_MANAGEMENT_MODULE', 'SYSTEM_FILE_STORAGE_MODULE', 'SYSTEM_ASSET_CATEGORY_MODULE', 'SYSTEM_VENDOR_MANAGEMENT_MODULE', 'SYSTEM_LOCATION_MANAGEMENT_MODULE', 'SYSTEM_USER_MANAGEMENT_MODULE', 'SYSTEM_DEPT_ORG_MODULE', 'SYSTEM_ROLE_PERMISSIONS_MODULE', 'SYSTEM_FLOW_DEFINITION_MODULE', 'SYSTEM_RUNTIME_MONITOR_MODULE', 'SYSTEM_SETTINGS_COMMAND_CENTER_MODULE']) {
      expect(moduleSource).toContain(`export const ${moduleExport} =`);
      expect(moduleSource).toMatch(new RegExp(`\\b${moduleExport},`));
    }
    expect(moduleSource).toContain("viewPermissions: ['system:integration:query']");
    expect(moduleSource).toContain("test: ['system:integration:test']");
    expect(moduleSource).toContain("viewPermissions: ['system:cache:query']");
    expect(moduleSource).toContain("refresh: ['system:cache:refresh']");
    expect(moduleSource).toContain("viewPermissions: ['system:file-storage:query']");
    expect(moduleSource).toContain("viewPermissions: ['asset:category:query']");
    expect(moduleSource).toContain("viewPermissions: ['vendor:vendor:query']");
    expect(moduleSource).toContain("viewPermissions: ['location:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:user:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:dept:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:role-permission:query']");
    expect(moduleSource).toContain("viewPermissions: ['system:flow:query']");
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
