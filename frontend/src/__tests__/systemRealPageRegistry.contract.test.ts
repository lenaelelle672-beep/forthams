import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const registrySource = readText('../pages/workspace-preview/system-hub/systemRealPageRegistry.ts');
const moduleSource = readText('../pages/workspace-preview/system-hub/systemModuleRegistry.ts');
const interfacesApi = readText('../api/systemInterfaces.ts');
const fieldMappingsApi = readText('../api/systemFieldMappings.ts');
const syncRulesApi = readText('../api/systemSyncRules.ts');
const webhookConfigsApi = readText('../api/systemWebhookConfigs.ts');
const cacheManagementApi = readText('../api/cacheManagement.ts');
const fileStorageApi = readText('../api/fileStorage.ts');
const assetCategoriesApi = readText('../api/assetCategories.ts');
const vendorsApi = readText('../api/vendors.ts');
const locationsApi = readText('../api/locations.ts');
const userManagementApi = readText('../api/userManagement.ts');
const deptsApi = readText('../api/depts.ts');
const rolePermissionsApi = readText('../api/rolePermissions.ts');
const workflowDefinitionsApi = readText('../api/workflowDefinitions.ts');
const workflowRuntimeApi = readText('../api/workflowRuntime.ts');
const interfacesPage = readText('../pages/system/SystemInterfacesWorkbenchPage.tsx');
const fieldMappingsPage = readText('../pages/system/SystemFieldMappingsWorkbenchPage.tsx');
const syncRulesPage = readText('../pages/system/SystemSyncRulesWorkbenchPage.tsx');
const webhookConfigPage = readText('../pages/system/SystemWebhookConfigWorkbenchPage.tsx');
const cacheManagementPage = readText('../pages/system/SystemCacheManagementWorkbenchPage.tsx');
const fileStoragePage = readText('../pages/system/SystemFileStorageWorkbenchPage.tsx');
const assetCategoryPage = readText('../pages/system/SystemAssetCategoryWorkbenchPage.tsx');
const vendorPage = readText('../pages/system/SystemVendorManagementWorkbenchPage.tsx');
const locationPage = readText('../pages/system/SystemLocationManagementWorkbenchPage.tsx');
const userPage = readText('../pages/system/SystemUserManagementWorkbenchPage.tsx');
const deptPage = readText('../pages/system/SystemDeptOrgWorkbenchPage.tsx');
const rolePermissionsPage = readText('../pages/system/SystemRolePermissionsWorkbenchPage.tsx');
const flowDefinitionPage = readText('../pages/system/SystemFlowDefinitionWorkbenchPage.tsx');
const runtimeMonitorPage = readText('../pages/system/SystemRuntimeMonitorWorkbenchPage.tsx');
const commandCenterPage = readText('../pages/system/SystemSettingsCommandCenterWorkbenchPage.tsx');

describe('V3 registry 与流程控制台只读聚合边界', () => {
  it('registry 只在既有十四项基础上新增 command-center 专属 V3 页面', () => {
    const registeredPageCount = (registrySource.match(/lazy\(\(\) => import\('\.\.\/\.\.\/system\//g) ?? []).length;
    expect(registrySource).toMatch(/^\s*'system-interfaces'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-field-mapping'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-sync-rules'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-webhook-config'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-cache-management'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-file-storage'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-asset-category'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-vendor-management'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-location-management'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-user-management'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-dept-org'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-role-permissions'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-flow-definition'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-runtime-monitor'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-settings-command-center'\s*:/m);
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
    expect(registeredPageCount).toBe(15);
    expect(registeredPageCount).not.toBe(44);
    expect(registrySource).not.toContain('IntegrationConfigWorkbenchPage');
  });

  it('module registry 十五项均指向 workbenchv3 且仍非全量', () => {
    const registeredMenuCount = (moduleSource.match(/menuId: SYSTEM_/g) ?? []).length;
    for (const menuId of ['system-interfaces', 'system-field-mapping', 'system-sync-rules', 'system-webhook-config', 'system-cache-management', 'system-file-storage', 'system-asset-category', 'system-vendor-management', 'system-location-management', 'system-user-management', 'system-dept-org', 'system-role-permissions', 'system-flow-definition', 'system-runtime-monitor', 'system-settings-command-center']) {
      expect(moduleSource).toContain(`workbenchPath: '/fixed-assets/workbenchv3?menu=${menuId}'`);
      expect(moduleSource).toContain(`legacyRoute: '/fixed-assets/workbenchv3?menu=${menuId}'`);
    }
    expect(registeredMenuCount).toBe(15);
    expect(registeredMenuCount).not.toBe(44);
  });

  it('wrapper 只包含各自后端契约', () => {
    expect(interfacesApi).toContain("'/system/interfaces'");
    expect(interfacesApi).toContain('`${SYSTEM_INTERFACES_BASE}/${id}/test`');
    expect(interfacesApi).not.toContain("'/system/field-mappings'");
    expect(interfacesApi).not.toContain("'/system/sync-rules'");

    expect(fieldMappingsApi).toContain("'/system/field-mappings'");
    expect(fieldMappingsApi).toContain('`${SYSTEM_FIELD_MAPPINGS_BASE}/preview`');
    expect(fieldMappingsApi).not.toContain("'/system/sync-rules'");

    expect(syncRulesApi).toContain("'/system/sync-rules'");
    expect(syncRulesApi).toContain('`${SYSTEM_SYNC_RULES_BASE}/${id}/dry-run`');
    expect(syncRulesApi).toContain('`${SYSTEM_SYNC_RULES_BASE}/queue/summary`');
    expect(syncRulesApi).not.toMatch(/retry-due|scan-due|consume/);

    expect(webhookConfigsApi).toContain("'/system/webhook-configs'");
    expect(webhookConfigsApi).toContain('`${SYSTEM_WEBHOOK_CONFIGS_BASE}/${id}/test`');
    expect(webhookConfigsApi).not.toContain('/settings');
    expect(webhookConfigsApi).not.toMatch(/sendWebhook|dispatchWebhook|systemIntegration/);

    expect(cacheManagementApi).toContain("'/system/cache/namespaces'");
    expect(cacheManagementApi).toContain('`${SYSTEM_CACHE_NAMESPACES_BASE}/${encodeURIComponent(namespace)}/refresh`');
    expect(cacheManagementApi).toContain("'/system/cache/refresh'");
    expect(cacheManagementApi).not.toContain('/settings');
    expect(cacheManagementApi).not.toMatch(/mock|iframe/);

    expect(fileStorageApi).toContain("'/system/file-storage/attachments/catalog'");
    expect(fileStorageApi).not.toMatch(/api\.(post|put|delete|patch)/);
    expect(fileStorageApi).not.toMatch(/FormData|Blob|createObjectURL|downloadUrl|previewUrl|storagePath/);

    expect(assetCategoriesApi).toContain("'/categories/list'");
    expect(assetCategoriesApi).toContain("'/categories/tree'");
    expect(assetCategoriesApi).not.toContain('/api/v1/asset-categories');
    expect(assetCategoriesApi).not.toContain('../services/categoryService');

    expect(vendorsApi).toContain("'/vendors/list'");
    expect(vendorsApi).not.toMatch(/api\.post|api\.put|api\.delete/);
    expect(locationsApi).toContain("'/locations/list'");
    expect(locationsApi).toContain("'/locations/root'");
    expect(locationsApi).not.toMatch(/api\.post|api\.put|api\.delete/);

    expect(userManagementApi).toContain("'/user-management/list'");
    expect(userManagementApi).not.toMatch(/api\.post|api\.put|api\.delete/);
    expect(userManagementApi).not.toMatch(new RegExp('pass' + 'word', 'i'));
    expect(deptsApi).toContain("'/depts/list'");
    expect(deptsApi).toContain("'/depts/tree'");
    expect(deptsApi).not.toMatch(/api\.post|api\.put|api\.delete/);

    expect(rolePermissionsApi).toContain("'/system/role-permissions/catalog'");
    expect(rolePermissionsApi).not.toMatch(/api\.post|api\.put|api\.delete|api\.patch/);
    expect(rolePermissionsApi).not.toContain("'/roles/list'");

    expect(workflowDefinitionsApi).toContain("'/workflows'");
    expect(workflowDefinitionsApi).toContain('`${WORKFLOW_DEFINITIONS_BASE}/${encodeURIComponent(businessType)}`');
    expect(workflowDefinitionsApi).not.toMatch(/api\.post|api\.put|api\.delete/);
    expect(workflowDefinitionsApi).not.toMatch(/\/draft|\/publish|\/status/);

    expect(workflowRuntimeApi).toContain("'/approvals/list'");
    expect(workflowRuntimeApi).toContain("'/approvals/pending/count'");
    expect(workflowRuntimeApi).not.toMatch(/api\.post|api\.put|api\.delete/);
    expect(workflowRuntimeApi).not.toMatch(/\/approvals\/\$\{id\}/);
  });

  it('页面体现 V3 安全边界', () => {
    expect(interfacesPage).toContain('未触发真实外部调用');
    expect(fieldMappingsPage).toContain('trim(value)、upper(value)、lower(value)');
    expect(syncRulesPage).toContain('dryRun 默认 true');
    expect(syncRulesPage).toContain('单条日志重试');
    expect(syncRulesPage).toContain('只读队列摘要');
    expect(webhookConfigPage).toContain('config-only');
    expect(webhookConfigPage).toContain('未触发真实外部调用');
    expect(webhookConfigPage).not.toContain('/settings');
    expect(cacheManagementPage).toContain('空缓存');
    expect(cacheManagementPage).toContain('刷新全部白名单命名空间');
    expect(cacheManagementPage).not.toMatch(/iframe|public\/mock/);
    expect(fileStoragePage).toContain('只读展示 /system/file-storage/attachments/catalog');
    expect(fileStoragePage).toContain('附件元数据目录');
    expect(fileStoragePage).toContain('不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环');
    expect(fileStoragePage).toContain('敏感细节已脱敏');
    expect(fileStoragePage).not.toMatch(/iframe|public\/mock/);
    expect(assetCategoryPage).toContain('只读展示分类列表与分类树');
    expect(assetCategoryPage).toContain('重新加载');
    expect(assetCategoryPage).toContain('敏感细节已脱敏');
    expect(assetCategoryPage).not.toMatch(/iframe|public\/mock/);
    expect(vendorPage).toContain('只读展示 /vendors/list');
    expect(vendorPage).toContain('状态筛选');
    expect(vendorPage).toContain('敏感细节已脱敏');
    expect(vendorPage).not.toMatch(/iframe|public\/mock/);
    expect(locationPage).toContain('只读展示 /locations/list 与 /locations/root');
    expect(locationPage).toContain('根位置摘要');
    expect(locationPage).toContain('敏感细节已脱敏');
    expect(locationPage).not.toMatch(/iframe|public\/mock/);
    expect(userPage).toContain('只读展示 /user-management/list');
    expect(userPage).toContain('状态筛选');
    expect(userPage).toContain('敏感细节已脱敏');
    expect(userPage).not.toMatch(new RegExp('pass' + 'word', 'i'));
    expect(userPage).not.toMatch(/iframe|public\/mock/);
    expect(deptPage).toContain('只读展示 /depts/list 与 /depts/tree');
    expect(deptPage).toContain('根部门摘要');
    expect(deptPage).toContain('敏感细节已脱敏');
    expect(deptPage).not.toMatch(/iframe|public\/mock/);
    expect(rolePermissionsPage).toContain('只读展示 /system/role-permissions/catalog');
    expect(rolePermissionsPage).toContain('角色-权限绑定目录');
    expect(rolePermissionsPage).toContain('权限库存与绑定数量');
    expect(rolePermissionsPage).toContain('不支持分配/编辑/删除，不代表菜单权限或数据权限闭环');
    expect(rolePermissionsPage).toContain('敏感细节已脱敏');
    expect(rolePermissionsPage).not.toMatch(/iframe|public\/mock/);
    expect(flowDefinitionPage).toContain('只读展示 /workflows 与 /workflows/{businessType}');
    expect(flowDefinitionPage).toContain('流程模板列表');
    expect(flowDefinitionPage).toContain('敏感细节已脱敏');
    expect(flowDefinitionPage).not.toMatch(/iframe|public\/mock/);
    expect(runtimeMonitorPage).toContain('只读展示 /approvals/list 与 /approvals/pending/count');
    expect(runtimeMonitorPage).toContain('审批实例列表');
    expect(runtimeMonitorPage).toContain('敏感细节已脱敏');
    expect(runtimeMonitorPage).not.toMatch(/iframe|public\/mock/);
    expect(commandCenterPage).toContain('只读聚合 /workflows、/approvals/list、/approvals/pending/count');
    expect(commandCenterPage).toContain('流程模板、运行实例、待处理数量与运行健康摘要');
    expect(commandCenterPage).toContain('不支持发起/审批/重试/终止/发布/编辑，不代表流程控制闭环');
    expect(commandCenterPage).toContain('覆盖最多 15/44，仍非 44 项全量覆盖');
    expect(commandCenterPage).toContain('敏感细节已脱敏');
    expect(commandCenterPage).not.toMatch(/iframe|public\/mock/);
  });
});
