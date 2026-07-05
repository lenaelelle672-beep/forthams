import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const registrySource = readText('../pages/workspace-preview/system-hub/systemRealPageRegistry.ts');
const moduleSource = readText('../pages/workspace-preview/system-hub/systemModuleRegistry.ts');
const interfacesApi = readText('../api/systemInterfaces.ts');
const fieldMappingsApi = readText('../api/systemFieldMappings.ts');
const syncRulesApi = readText('../api/systemSyncRules.ts');
const webhookConfigsApi = readText('../api/systemWebhookConfigs.ts');
const interfacesPage = readText('../pages/system/SystemInterfacesWorkbenchPage.tsx');
const fieldMappingsPage = readText('../pages/system/SystemFieldMappingsWorkbenchPage.tsx');
const syncRulesPage = readText('../pages/system/SystemSyncRulesWorkbenchPage.tsx');
const webhookConfigPage = readText('../pages/system/SystemWebhookConfigWorkbenchPage.tsx');

describe('四项 V3 registry 与 API 边界', () => {
  it('registry 只登记四项专属 V3 页面', () => {
    expect(registrySource).toMatch(/^\s*'system-interfaces'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-field-mapping'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-sync-rules'\s*:/m);
    expect(registrySource).toMatch(/^\s*'system-webhook-config'\s*:/m);
    expect(registrySource).toContain("'system-webhook-config': lazy(() => import('../../system/SystemWebhookConfigWorkbenchPage'))");
    expect(registrySource).not.toContain('IntegrationConfigWorkbenchPage');
  });

  it('module registry 四项均指向 workbenchv3', () => {
    for (const menuId of ['system-interfaces', 'system-field-mapping', 'system-sync-rules', 'system-webhook-config']) {
      expect(moduleSource).toContain(`workbenchPath: '/fixed-assets/workbenchv3?menu=${menuId}'`);
      expect(moduleSource).toContain(`legacyRoute: '/fixed-assets/workbenchv3?menu=${menuId}'`);
    }
  });

  it('四个 wrapper 只包含各自后端契约', () => {
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
  });
});
