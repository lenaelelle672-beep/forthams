import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const workspacePage = readText('../pages/workspace-preview/WorkspacePreviewPage.tsx');
const workspacePageStyles = readText('../pages/workspace-preview/WorkspacePreviewPage.css');
const systemHubSubpageManifest = JSON.parse(readText('../../public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-hub-usability-subpages-manifest.json')) as {
  coverageNote: string;
  subpages: Array<{
    id: string;
    menuId: string;
    label: string;
    businessObject?: string;
    image2: { path: string; status: string };
    stitch: { path: string; status: string };
    interaction?: string[];
    acceptance?: string[];
    promptFile: string;
  }>;
};
const appLayout = readText('../layouts/AppLayout.tsx');
const workbenchSmoke = readText('../e2e/workbench-platform-entry.browser-regression-smoke.spec.ts');
const frontendPackageJson = JSON.parse(readText('../../package.json')) as {
  scripts?: Record<string, string>;
};
const router = readText('../router/index.tsx');
const routePermissions = readText('../utils/routePermissions.ts');
const workbenchV3Page = readText('../pages/workbench-v3/WorkbenchV3Page.tsx');
const systemPageHost = readText('../pages/workbench-v3/SystemPageHost.tsx');
const systemInspectorSlotProvider = readText('../pages/workbench-v3/SystemInspectorSlotProvider.tsx');
const schema = readText('../../../backend/src/main/resources/schema.sql');
const migration = readText('../../../backend/src/main/resources/migration/V2_84__workbench_platform_menu_entry.sql');
const matrix = readText('../../../docs/workbench-platform-entry-matrix.md');
const menuItemsBlock = workspacePage.slice(
  workspacePage.indexOf('const menuItems'),
  workspacePage.indexOf('const getWorkbenchPageFromSection'),
);
const systemMenuItemsBlock = workspacePage.slice(
  workspacePage.indexOf('const systemMenuItems'),
  workspacePage.indexOf('const systemMenuGroups'),
);
const systemSubpageAssetsBlock = workspacePage.slice(
  workspacePage.indexOf('const systemSubpageDesignAssetsByGroup'),
  workspacePage.indexOf('const securityPostureThumb'),
);
const systemPageRoutingBlock = workspacePage.slice(
  workspacePage.indexOf('function WorkbenchSystemPage'),
  workspacePage.indexOf('const workbenchOrderSummaryCards'),
);

const requiredWorkbenchMenus = [
  '运营首页',
  '流程待办',
  '资产总览',
  '设备管理',
  '工单管理',
  '备件管理',
  '数据监控',
  '报表分析',
  '告警中心',
  '组织策略',
  '基础维护',
];

const hiddenFormalWorkbenchMenus = ['design', 'inspection'];
const duplicateMenus = ['报表大屏', '平台配置', '维保计划'];
const expectedSystemGroupCounts = {
  流程平台: 9,
  组织权限: 8,
  基础资料: 6,
  集成配置: 5,
  消息与通知: 8,
  系统参数: 8,
};
const expectedSystemDraftSmokeMenuIds = [
  'system-flow-definition',
  'system-settings-command-center',
  'system-runtime-monitor',
  'system-flow-designer',
  'system-form-config',
  'system-form-storage',
  'system-approval-rules',
  'system-todo-fields',
  'system-sla-config',
  'system-user-management',
  'system-role-permissions',
  'system-menu-permissions',
  'system-dept-org',
  'system-post-management',
  'system-data-permissions',
  'system-handover',
  'system-tenant-management',
  'system-asset-category',
  'system-numbering-rules',
  'system-location-management',
  'system-vendor-management',
  'system-custom-fields',
  'system-custom-field-sets',
  'system-external-systems',
  'system-interfaces',
  'system-field-mapping',
  'system-sync-rules',
  'system-webhook-config',
  'system-mail-gateway',
  'system-workflow-mail',
  'system-mail-templates',
  'system-mail-logs',
  'system-notification-templates',
  'system-notification-channels',
  'system-notification-preferences',
  'system-workflow-notification-switch',
  'system-base-params',
  'system-security-policy',
  'system-file-storage',
  'system-import-export',
  'system-cache-management',
  'system-audit-log',
  'system-doc-center',
  'system-tech-support',
];

function collectSystemMenus() {
  return [...systemMenuItemsBlock.matchAll(/createSystemMenuItem\('([^']+)', '([^']+)', '([^']+)'/g)]
    .map((match) => ({ id: match[1], group: match[2], label: match[3] }));
}

function collectSystemSubpageAssets() {
  return [...systemSubpageAssetsBlock.matchAll(/\{ label: '([^']+)', menuId: '([^']+)', image2: '([^']+)', stitch: '([^']+)' \}/g)]
    .map((match) => ({ label: match[1], menuId: match[2], image2: match[3], stitch: match[4] }));
}

function systemHubSubpageFile(assetName: string) {
  return resolve(process.cwd(), `public/mock/workspace-preview/asset-kit-v8/system-hub/subpages/${assetName}.png`);
}

function systemHubPublicAssetFile(publicPath: string) {
  return resolve(process.cwd(), `public${publicPath}`);
}

function repositoryFile(relativePath: string) {
  return resolve(process.cwd(), '..', relativePath);
}

describe('Workbench platform entry contract', () => {
  it('keeps Workbench V3 runtime isolated from the legacy workbench default path', () => {
    expect(workbenchV3Page).toContain("const defaultWorkbenchV3MenuId = 'system-user-management'");
    expect(workbenchV3Page).toContain("import SystemPageHost from './SystemPageHost'");
    expect(workbenchV3Page).toContain("import { SystemInspectorSlotProvider } from './SystemInspectorSlotProvider'");
    expect(systemPageHost).toContain('data-system-page-host="workbench-v3"');
    expect(systemPageHost).toContain('V3 本地建设中占位');
    expect(systemInspectorSlotProvider).toContain("runtime: 'workbench-v3'");
    expect(workbenchV3Page).toContain("id: 'system-form-config'");
    expect(workbenchV3Page).toContain("id: 'system-form-storage'");
    expect(workbenchV3Page).toContain("id: 'system-approval-rules'");
    expect(workbenchV3Page).toContain("id: 'system-todo-fields'");
    expect(workbenchV3Page).toContain("id: 'system-sla-config'");
    expect(workbenchV3Page).toContain("id: 'system-external-systems'");
    expect(workbenchV3Page).toContain("id: 'system-base-params'");
    expect(workbenchV3Page).toContain("id: 'system-security-policy'");
    expect(workbenchV3Page).toContain("id: 'system-audit-log'");
    expect(workbenchV3Page).toContain("id: 'system-mail-gateway'");
    expect(workbenchV3Page).toContain("id: 'system-mail-templates'");
    expect(workbenchV3Page).toContain("id: 'system-mail-logs'");
    expect(workbenchV3Page).toContain("id: 'system-notification-templates'");
    expect(workbenchV3Page).toContain("id: 'system-notification-channels'");
    expect(workbenchV3Page).toContain("id: 'system-notification-preferences'");
    expect(workbenchV3Page).toContain("id: 'system-workflow-notification-switch'");
    expect(workbenchV3Page).toContain("id: 'system-numbering-rules'");
    expect(workbenchV3Page).toContain("id: 'system-custom-fields'");
    expect(workbenchV3Page).toContain("id: 'system-custom-field-sets'");
    expect(workbenchV3Page).toContain('三十七项菜单');
    expect(workbenchV3Page).toContain('system-post-management 已接入岗位 metadata-only 只读目录与 dry-run preview');
    expect(workbenchV3Page).toContain('仍不是 Workbench V3 全量完成');
    expect(workbenchV3Page).toContain('组织权限组未全组完成');
    expect(workbenchV3Page).toContain('基础资料组未全组完成');
    expect(workbenchV3Page).toContain('消息与通知组未全组完成');
    expect(workbenchV3Page).toContain('邮件子系统未全组完成');
    expect(workbenchV3Page).not.toContain('system-menu-permissions 仍保持 blocked');
    expect(workbenchV3Page).not.toContain('Day6 pending reviewer gate');
    expect(workbenchV3Page).not.toContain('accepted coverage 仍为 8/9');
    expect(workbenchV3Page).not.toContain('PASS 后最多 9/9');
    expect(workbenchV3Page).not.toContain('44/44');
    expect(workbenchV3Page).not.toContain('/fixed-assets/workbench?menu=');
    expect(routePermissions).toContain("{ prefix: '/fixed-assets/workbench', any: ['dashboard:query', 'asset:ledger:query'] }");
    expect(routePermissions).not.toContain('/fixed-assets/workbenchv3');
  });

  it('keeps Workbench ahead of the legacy dashboard in the desktop shell', () => {
    expect(appLayout).toContain("path: '/fixed-assets/workbench?menu=home'");
    expect(appLayout).toContain("label: '资产运营中枢'");
    expect(appLayout).toContain("path: '/dashboard'");
    expect(appLayout).toContain("label: '旧版仪表板'");
    expect(appLayout.indexOf("label: '资产运营中枢'")).toBeLessThan(
      appLayout.indexOf("label: '旧版仪表板'"),
    );
  });

  it('keeps the formal Workbench routes protected and separates the public preview route', () => {
    expect(router).toContain("path: '/workspace-preview'");
    expect(router).toContain("path: 'fixed-assets/workbench'");
    expect(router).toContain("path: 'fixed-assets/workbench/:section'");
    expect(router).toContain('<Navigate to="/fixed-assets/workbench?menu=home" replace />');
    expect(router).toContain("path: 'dashboard'");
    expect(router.indexOf("path: 'fixed-assets/workbench'")).toBeLessThan(
      router.indexOf("element: S(AppLayout)"),
    );
  });

  it('preserves the approved Workbench side navigation and filters preview-only or unbuilt modules from formal routes', () => {
    for (const label of requiredWorkbenchMenus) {
      expect(menuItemsBlock).toContain(`label: '${label}'`);
      expect(matrix).toContain(`| ${label} |`);
    }

    expect(menuItemsBlock).toContain("label: '巡检管理'");

    for (const label of duplicateMenus) {
      expect(menuItemsBlock).not.toContain(`label: '${label}'`);
    }

    for (const menuId of hiddenFormalWorkbenchMenus) {
      expect(workspacePage).toContain(`'${menuId}'`);
    }

    expect(workspacePage).toContain('workbenchRouteHiddenMenuIds');
    expect(workspacePage).toContain('menuItems.filter(isVisibleWorkbenchRouteMenuItem)');
    expect(workspacePage).toContain("pageTabs.filter((tab) => tab.id !== 'stitch')");
  });

  it('keeps the approved Workbench shell untouched while page content evolves', () => {
    expect(workspacePage).not.toContain('workspace-menu-badge');
    expect(workspacePage).not.toContain('workspace-side-footer');
    expect(workspacePage).not.toContain('版本 v2.8.0');
    expect(workspacePage).not.toContain('版权 © 2026 UNIVIEW 固定资产平台');

    expect(workspacePageStyles).toContain('grid-template-columns: 166px minmax(0, 1fr)');
    expect(workspacePageStyles).not.toContain('.workspace-menu-badge');
    expect(workspacePageStyles).not.toContain('.workspace-side-footer');
  });

  it('keeps navigation shell search-free and pushes search into page-level filters', () => {
    expect(appLayout).not.toContain("import GlobalSearch from '@/components/GlobalSearch'");
    expect(appLayout).not.toContain('<GlobalSearch');
    expect(appLayout).toContain('items-center justify-end');
    expect(workspacePage).not.toContain('aria-label="系统运营中枢导航定位"');
    expect(workspacePage).not.toContain('aria-label="系统常用配置入口"');
    expect(workspacePage).toContain("const systemHubOverviewVisual = systemHubV8Asset('system-hub-overview-v3')");
    const navigationConsoleEntry = systemHubSubpageManifest.subpages.find((entry) => entry.label === '系统运营中枢导航控制台');
    expect(navigationConsoleEntry?.id).toBe('system-hub-subpage-00-navigation-console-v2');
    expect(navigationConsoleEntry?.menuId).toBe('system-hub-navigation-console');
    expect(navigationConsoleEntry?.image2.path).toBe('/mock/workspace-preview/asset-kit-v8/system-hub/subpages/system-hub-subpage-00-navigation-console-v2.png');
    expect(existsSync(systemHubPublicAssetFile(navigationConsoleEntry?.image2.path ?? ''))).toBe(true);
    expect(workspacePage).not.toContain('aria-label="搜索系统配置菜单"');
    expect(workspacePage).not.toContain('aria-label="搜索节点模板"');
    expect(workspacePage).not.toContain('workspace-system-nav-search');
    expect(workspacePage).not.toContain('workspace-side-search');
    expect(workspacePage).not.toContain('workspace-system-nav-console');
    expect(workspacePage).not.toContain('workspace-system-nav-quick');
    expect(workspacePage).not.toContain('workspace-flow-node-palette-search');
    expect(workspacePage).not.toContain('handleWorkbenchSearch');
    expect(workspacePage).not.toContain('title="资产运营搜索"');
    expect(workspacePage).not.toContain('aria-label="运营首页搜索"');
    expect(workspacePageStyles).not.toContain('.workspace-flow-node-palette-search');
    expect(workspacePageStyles).not.toContain('.workspace-flow-node-palette-empty');
    expect(workspacePage).toContain('aria-label={`${item.label}筛选栏`}');
    expect(workbenchSmoke).toContain("page.locator('header').filter({ hasText: '搜索...' })).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('header [aria-label=\"搜索\"]')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-topbar').getByRole('textbox')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-topbar').getByRole('searchbox')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-actions').getByRole('button', { name: /搜索/ })).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-side input')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-side [aria-label*=\"搜索\"]')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-side [placeholder*=\"搜索\"]')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-side').getByRole('button', { name: /搜索/ })).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.locator('.workspace-side').getByRole('searchbox')).toHaveCount(0)");
    expect(workbenchSmoke).toContain("page.getByLabel('运营首页搜索')).toHaveCount(0)");
  });

  it('requires every System Hub menu to have matching IMAGE2 and Stitch subpage assets', () => {
    const systemMenus = collectSystemMenus();
    const subpageAssets = collectSystemSubpageAssets();

    expect(systemMenus).toHaveLength(44);
    expect(subpageAssets).toHaveLength(systemMenus.length);

    for (const [group, expectedCount] of Object.entries(expectedSystemGroupCounts)) {
      expect(systemMenus.filter((menu) => menu.group === group)).toHaveLength(expectedCount);
      expect(subpageAssets.filter((asset) => systemMenus.find((menu) => menu.id === asset.menuId)?.group === group)).toHaveLength(expectedCount);
    }

    for (const menu of systemMenus) {
      const asset = subpageAssets.find((candidate) => candidate.menuId === menu.id);
      expect(asset, `${menu.label} should have IMAGE2/Stitch mapping`).toBeTruthy();
      expect(asset?.label).toBe(menu.label);
      expect(existsSync(systemHubSubpageFile(asset!.image2)), `${asset!.image2}.png should exist`).toBe(true);
      expect(existsSync(systemHubSubpageFile(asset!.stitch)), `${asset!.stitch}.png should exist`).toBe(true);
    }
  });

  it('keeps delivery manifest aligned with the System Hub IMAGE2 assets declared in the page', () => {
    const systemMenus = collectSystemMenus();
    const subpageAssets = collectSystemSubpageAssets();
    const navigationConsoleEntry = systemHubSubpageManifest.subpages.find((entry) => entry.id === 'system-hub-subpage-00-navigation-console-v2');
    const formalManifestEntries = systemHubSubpageManifest.subpages.filter((entry) => entry.id !== 'system-hub-subpage-00-navigation-console-v2');

    expect(systemHubSubpageManifest.coverageNote).toContain('1 个导航控制台 + 44 个系统配置菜单');
    expect(systemHubSubpageManifest.coverageNote).toContain('流程平台 9 项');
    expect(systemHubSubpageManifest.coverageNote).toContain('组织权限 8 项');
    expect(systemHubSubpageManifest.coverageNote).toContain('基础资料 6 项');
    expect(systemHubSubpageManifest.coverageNote).toContain('集成配置 5 项');
    expect(systemHubSubpageManifest.coverageNote).toContain('消息与通知 8 项');
    expect(systemHubSubpageManifest.coverageNote).toContain('系统参数 8 项');
    expect(systemHubSubpageManifest.coverageNote).toContain('页内搜索/筛选');
    expect(systemHubSubpageManifest.coverageNote).toContain('顶部业务视角和左侧导航不放搜索');
    expect(systemHubSubpageManifest.coverageNote).toContain('Stitch 复刻稿已接入页面矩阵');
    expect(systemHubSubpageManifest.coverageNote).toContain('真人模拟结果继续逐页精修');
    expect(systemHubSubpageManifest.subpages).toHaveLength(45);
    expect(navigationConsoleEntry?.menuId).toBe('system-hub-navigation-console');
    expect(systemMenus.some((menu) => menu.id === navigationConsoleEntry?.menuId)).toBe(false);
    expect(formalManifestEntries).toHaveLength(systemMenus.length);
    expect(new Set(formalManifestEntries.map((entry) => entry.menuId)).size).toBe(systemMenus.length);

    for (const manifestItem of systemHubSubpageManifest.subpages) {
      const stitch = manifestItem.stitch as typeof manifestItem.stitch & { note?: string };

      expect(manifestItem.image2.status, `${manifestItem.label} IMAGE2 should be complete`).toBe('complete');
      expect(manifestItem.stitch.status, `${manifestItem.label} Stitch should be connected to the Workbench matrix`).toBe('ready');
      expect(stitch.note ?? '', `${manifestItem.label} Stitch note should use the ready delivery wording`).toContain('Stitch 复刻稿已接入当前可交互 Workbench');
      expect(stitch.note ?? '', `${manifestItem.label} Stitch note should keep IMAGE2 as the fidelity source`).toContain('以 IMAGE2 v2 和本地真人模拟为验收基准');
      expect(stitch.note ?? '', `${manifestItem.label} Stitch note should not keep blocked-auth wording`).not.toMatch(/待认证|旧稿候选|等待认证|鉴权恢复|下一轮/);
      expect(manifestItem.image2.path, `${manifestItem.label} IMAGE2 should live in public mock assets`).toMatch(
        /^\/mock\/workspace-preview\/asset-kit-v8\/system-hub\/subpages\/.+\.png$/,
      );
      expect(manifestItem.stitch.path, `${manifestItem.label} Stitch should live in public mock assets`).toMatch(
        /^\/mock\/workspace-preview\/asset-kit-v8\/system-hub\/subpages\/stitch-.+\.png$/,
      );
      expect(existsSync(systemHubPublicAssetFile(manifestItem.image2.path)), `${manifestItem.label} IMAGE2 asset should exist`).toBe(true);
      expect(existsSync(systemHubPublicAssetFile(manifestItem.stitch.path)), `${manifestItem.label} Stitch asset should exist`).toBe(true);
      expect(existsSync(repositoryFile(manifestItem.promptFile)), `${manifestItem.label} Stitch prompt should exist`).toBe(true);
    }

    for (const asset of subpageAssets) {
      const manifestItem = systemHubSubpageManifest.subpages.find((subpage) => subpage.id === asset.image2);
      expect(manifestItem, `${asset.label} ${asset.image2} should exist in delivery manifest`).toBeTruthy();
      expect(manifestItem?.menuId).toBe(asset.menuId);
      expect(manifestItem?.label).toBe(asset.label);
      expect(manifestItem?.image2.path).toBe(`/mock/workspace-preview/asset-kit-v8/system-hub/subpages/${asset.image2}.png`);
      expect(existsSync(systemHubPublicAssetFile(manifestItem?.image2.path ?? ''))).toBe(true);
    }

    const flowDesignerManifest = systemHubSubpageManifest.subpages.find(
      (subpage) => subpage.menuId === 'system-flow-designer',
    );
    expect(flowDesignerManifest?.businessObject).toContain('发布流程');
    expect(flowDesignerManifest?.interaction).toContain('发布流程');
    expect(workspacePage).toContain('const publishDesignerFlow = () =>');
    expect(workspacePage).toContain('hasSubmittedDesignerValidation');
    expect(workspacePage).toContain('还没有完成本次提交校验');
    expect(workspacePage).toContain("title: '流程已发布'");
    expect(workbenchSmoke).toContain("page.goto('/fixed-assets/workbench?menu=system-flow-designer')");
    expect(workbenchSmoke).toContain('expectFutureSystemFrameContract(page, [');
    expect(workbenchSmoke).toContain('system-flow-designer');
    expect(workbenchSmoke).toContain("'流程设计器'");
    expect(workbenchSmoke).toContain("'采购审批流程_V2.1'");
    expect(workbenchSmoke).toContain("'保存草稿'");
  });

  it('keeps formal System Hub subpage interaction specs explicit about save and submit actions', () => {
    const systemMenuIds = new Set(collectSystemMenus().map((menu) => menu.id));
    const formalManifestEntries = systemHubSubpageManifest.subpages.filter((entry) => systemMenuIds.has(entry.menuId));

    expect(formalManifestEntries).toHaveLength(systemMenuIds.size);

    for (const entry of formalManifestEntries) {
      const interactionText = entry.interaction?.join(' / ') ?? '';
      const acceptanceText = entry.acceptance?.join(' / ') ?? '';
      expect(interactionText, `${entry.label} should define a page-level save action`).toMatch(/保存/);
      expect(interactionText, `${entry.label} should define a page-level submit or review action`).toMatch(/提交|复核|校验|发布/);
      expect(acceptanceText, `${entry.label} should require real user simulation in the formal manifest`).toMatch(/真人模拟/);
      expect(acceptanceText, `${entry.label} should keep operation evidence in the current page`).toMatch(/当前页|同屏|页面内容区/);
      expect(acceptanceText, `${entry.label} should prevent generic placeholder fallback`).toMatch(/不得|不能复用|不打开通用|不复用通用|通用占位/);
    }
  });

  it('keeps every formal System Hub Stitch prompt aligned to page-level search and save-submit simulation', () => {
    const systemMenuIds = new Set(collectSystemMenus().map((menu) => menu.id));
    const formalManifestEntries = systemHubSubpageManifest.subpages.filter((entry) => systemMenuIds.has(entry.menuId));

    expect(formalManifestEntries).toHaveLength(systemMenuIds.size);

    for (const entry of formalManifestEntries) {
      const prompt = readFileSync(repositoryFile(entry.promptFile), 'utf8');
      expect(prompt, `${entry.label} prompt should ban navigation shell search`).toContain('顶部业务视角和左侧导航不得放搜索框');
      expect(prompt, `${entry.label} prompt should require page-level search`).toContain('搜索/筛选只能出现在当前专属页面内容区');
      expect(prompt, `${entry.label} prompt should require save simulation`).toContain('可真人模拟的保存草稿动作');
      expect(prompt, `${entry.label} prompt should require submit/review simulation`).toContain('可真人模拟的提交校验/发布复核动作');
      expect(prompt, `${entry.label} prompt should reject generic placeholders`).toContain('不得复用通用占位模板');
    }
  });

  it('exposes a repeatable System Hub usability verifier for delivery drift checks', () => {
    expect(frontendPackageJson.scripts?.['verify:system-hub']).toBe('node scripts/verify-system-hub-usability.mjs');
    expect(existsSync(resolve(__dirname, '../../scripts/verify-system-hub-usability.mjs'))).toBe(true);
  });

  it('keeps external system Future OS iframe contract page-local and auditable', () => {
    expect(workbenchSmoke).toContain("page.goto('/fixed-assets/workbench?menu=system-external-systems')");
    expect(workbenchSmoke).toContain('expectFutureSystemFrameContract(page, [');
    expect(workbenchSmoke).toContain('system-external-systems');
    expect(workbenchSmoke).toContain("'外部系统配置'");
    expect(workbenchSmoke).toContain("'集成拓扑与接口映射'");
    expect(workbenchSmoke).toContain("'Systems Active'");
    expect(workbenchSmoke).toContain("'ERP Core'");
    expect(workbenchSmoke).toContain("'Field Mapping Matrix'");
    expect(workbenchSmoke).toContain("'返回业务工作台'");
  });

  it('keeps organization permission delivery manifest aligned to dedicated v2 IMAGE2 pages', () => {
    const expectedOrgPermissionImage2ByMenuId = new Map([
      ['system-user-management', 'org-permission-subpage-01-user-management-v2'],
      ['system-role-permissions', 'org-permission-subpage-02-role-permissions-v2'],
      ['system-menu-permissions', 'org-permission-subpage-03-menu-permissions-v2'],
      ['system-data-permissions', 'org-permission-subpage-04-data-permissions-v2'],
      ['system-handover', 'org-permission-subpage-05-handover-v2'],
      ['system-dept-org', 'org-permission-subpage-06-dept-org-v2'],
      ['system-post-management', 'org-permission-subpage-07-post-management-v2'],
      ['system-tenant-management', 'org-permission-subpage-08-tenant-management-v1'],
    ]);

    for (const [menuId, image2Id] of expectedOrgPermissionImage2ByMenuId) {
      const manifestItem = systemHubSubpageManifest.subpages.find((subpage) => subpage.id === image2Id);
      expect(manifestItem, `${menuId} should exist in delivery manifest`).toBeTruthy();
      expect(manifestItem?.menuId).toBe(menuId);
      expect(manifestItem?.id).toBe(image2Id);
      expect(manifestItem?.image2.path).toBe(`/mock/workspace-preview/asset-kit-v8/system-hub/subpages/${image2Id}.png`);
      expect(manifestItem?.image2.status).toBe('complete');
      expect(existsSync(systemHubPublicAssetFile(manifestItem?.image2.path ?? ''))).toBe(true);
    }
  });

  it('keeps System Hub pages on dedicated configurator branches instead of generic-only shells', () => {
    for (const branch of [
      'WorkbenchFlowPlatformProductPage',
      'WorkbenchOrganizationPermissionConfigurator',
      'WorkbenchHandoverConfigurator',
      'WorkbenchMasterDataConfigurator',
      'WorkbenchNumberingRuleConfigurator',
      'WorkbenchCustomFieldConfigurator',
      'WorkbenchExternalSystemConfigurator',
      'WorkbenchIntegrationWorkspaceConfigurator',
      'WorkbenchMailGatewayConfigurator',
      'WorkbenchNotificationConfigurator',
      'WorkbenchMailLogConfigurator',
      'WorkbenchWorkflowNotificationSwitchConfigurator',
      'WorkbenchSystemParameterConfigurator',
      'WorkbenchAuditLogConfigurator',
    ]) {
      expect(systemPageRoutingBlock).toContain(branch);
    }

    expect(systemPageRoutingBlock).toContain("groupName === '流程平台'");
    expect(systemPageRoutingBlock).toContain("groupName === '组织权限'");
    expect(systemPageRoutingBlock).toContain("groupName === '基础资料'");
    expect(systemPageRoutingBlock).toContain("groupName === '消息与通知'");
    expect(systemPageRoutingBlock).toContain("groupName === '系统参数'");
    expect(systemPageRoutingBlock).toContain("['system-interfaces', 'system-field-mapping', 'system-sync-rules', 'system-webhook-config']");
    expect(systemPageRoutingBlock).toContain('!hasDedicatedSystemConfigurator ? (');
    expect(systemPageRoutingBlock).toContain("hasDedicatedSystemConfigurator ? '设计与审计' : '配置详情'");
    expect(systemPageRoutingBlock).toContain('aria-label={`${item.label}系统配置操作`}');
    expect(systemPageRoutingBlock).toContain('aria-label={`${item.label}关键指标`}');
    expect(systemPageRoutingBlock).toContain('aria-label={`${item.label}通用详情操作`}');
    expect(workbenchSmoke).toContain('expectFutureSettingsNavigationCenter');
    expect(workbenchSmoke).toContain('expectFutureSystemFrameContract');
    expect(workbenchSmoke).toContain('const futureMenuContracts');
    expect(workbenchSmoke).toContain('const futureSearchContracts');
    expect(workbenchSmoke).toContain('const masterDataContracts');
    expect(workbenchSmoke).toContain('const notificationContracts');
    expect(workbenchSmoke).toContain('system-base-params');
    expect(workbenchSmoke).toContain('system-external-systems');
    expect(workbenchSmoke).toContain('基础资料主数据页均可新建保存提交');
    expect(workbenchSmoke).toContain('消息通知配置页均可新建保存提交');
    expect(workbenchSmoke).toContain("'返回业务工作台'");
    expect(workbenchSmoke).toContain("'保存草稿'");
    expect(workbenchSmoke).toContain("'提交校验'");
    expect(workspacePage).toContain("image2: 'org-permission-subpage-01-user-management-v2'");
    expect(workspacePage).toContain("image2: 'org-permission-subpage-02-role-permissions-v2'");
    expect(workspacePage).toContain("image2: 'org-permission-subpage-03-menu-permissions-v2'");
    expect(workspacePage).toContain("image2: 'org-permission-subpage-08-tenant-management-v1'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-06-audit-log-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-07-doc-center-v1'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-08-tech-support-v1'");
    const auditLogManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-audit-log');
    expect(auditLogManifest?.interaction).toEqual(expect.arrayContaining([
      '新建审计策略',
      '配置审计策略',
      '保存草稿',
      '提交校验',
      '审计事件查询',
      '导出取证',
      '下载取证包',
      '追溯详情',
    ]));
    expect(auditLogManifest?.acceptance).toEqual(expect.arrayContaining([
      '新建审计策略、保存草稿、提交校验必须围绕审计策略对象在当前页完成',
      '审计事件查询必须按操作人、对象范围、风险等级和时间范围筛选事件表，并显示命中数量',
      '导出取证、下载取证包、追溯详情必须可真人模拟并更新当前页操作反馈，不得打开通用占位模板',
    ]));
    expect(workspacePage).toContain('function WorkbenchAuditLogConfigurator');
    expect(workspacePage).toContain('审计查询已生成');
    expect(workspacePage).toContain('导出取证包已生成');
    expect(workspacePage).toContain('取证包已下载');
    expect(workspacePage).toContain('审计链路已追溯');
    expect(workspacePage).toContain("流程平台: { src: systemHubV8Asset('flow-platform-v2'), file: 'flow-platform-v2.png' }");
    expect(workspacePage).toContain("组织权限: { src: systemHubV8Asset('org-permission-v2'), file: 'org-permission-v2.png' }");
    expect(workspacePage).toContain("基础资料: { src: systemHubV8Asset('master-data-v2'), file: 'master-data-v2.png' }");
    expect(workspacePage).toContain("集成配置: { src: systemHubV8Asset('integration-config-v2'), file: 'integration-config-v2.png' }");
    expect(workspacePage).toContain("消息与通知: { src: systemHubV8Asset('notification-config-v2'), file: 'notification-config-v2.png' }");
    expect(workspacePage).toContain("系统参数: { src: systemHubV8Asset('system-params-v2'), file: 'system-params-v2.png' }");
    expect(workspacePage).toContain("statusLabel: '复刻已接入'");
    expect(workspacePage).toContain("statusNote: '按 IMAGE2 对照验收'");
    expect(workspacePage).not.toContain("statusLabel: '待认证复刻'");
    expect(workspacePage).not.toContain("旧稿候选 · 等待 Stitch Auth");
    expect(workspacePage).toContain('workspace-system-parameter-local-search');
    expect(workspacePage).toContain('workspace-system-parameter-search-empty');
    expect(workspacePage).toContain('workspace-base-parameter-runbook');
    expect(workspacePage).toContain('const previewBaseParameterImpact = () =>');
    expect(workspacePage).toContain('const openBaseParameterRollbackPlan = () =>');
    expect(workspacePage).toContain('const runBaseParameterPublishGate = () =>');
    expect(workspacePageStyles).toContain('.workspace-base-parameter-runbook');
    const baseParameterManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-base-params');
    expect(baseParameterManifest?.interaction).toEqual(expect.arrayContaining([
      '影响预演',
      '回滚预案',
      '门禁预检',
      '提交校验',
    ]));
    expect(baseParameterManifest?.acceptance).toContain('影响预演、回滚预案和门禁预检必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-security-policy-runbook');
    expect(workspacePage).toContain('const previewSecuritySensitiveMask = () =>');
    expect(workspacePage).toContain('const runSecurityH5IdentityCheck = () =>');
    expect(workspacePage).toContain('const openSecurityRiskConfirmationDrill = () =>');
    expect(workspacePageStyles).toContain('.workspace-security-policy-runbook');
    const securityPolicyManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-security-policy');
    expect(securityPolicyManifest?.interaction).toEqual(expect.arrayContaining([
      '脱敏预览',
      'H5 身份校验',
      '高危确认演练',
      '提交校验',
    ]));
    expect(securityPolicyManifest?.acceptance).toContain('脱敏预览、H5 身份校验和高危确认演练必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-file-storage-runbook');
    expect(workspacePage).toContain('const runFileStorageThumbnailPreview = () =>');
    expect(workspacePage).toContain('const runFileStorageAccessPrecheck = () =>');
    expect(workspacePage).toContain('const openFileStorageArchiveDrill = () =>');
    expect(workspacePageStyles).toContain('.workspace-file-storage-runbook');
    const fileStorageManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-file-storage');
    expect(fileStorageManifest?.interaction).toEqual(expect.arrayContaining([
      '缩略图预览',
      '权限预检',
      '归档演练',
      '提交校验',
    ]));
    expect(fileStorageManifest?.acceptance).toContain('缩略图预览、权限预检和归档演练必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-import-export-runbook');
    expect(workspacePage).toContain('const runImportExportDryRun = () =>');
    expect(workspacePage).toContain('const openImportExportErrorReport = () =>');
    expect(workspacePage).toContain('const previewImportExportExportControl = () =>');
    expect(workspacePageStyles).toContain('.workspace-import-export-runbook');
    const importExportManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-import-export');
    expect(importExportManifest?.interaction).toEqual(expect.arrayContaining([
      '导入试跑',
      '错误报告预览',
      '导出控制预演',
      '提交校验',
    ]));
    expect(importExportManifest?.acceptance).toContain('导入试跑、错误报告和导出控制预演必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-cache-management-runbook');
    expect(workspacePage).toContain('const runCacheManagementRefreshNow = () =>');
    expect(workspacePage).toContain('const runCacheManagementWarmupDrill = () =>');
    expect(workspacePage).toContain('const runCacheManagementConsistencyCheck = () =>');
    expect(workspacePage).toContain('const openCacheManagementRollbackPlan = () =>');
    expect(workspacePageStyles).toContain('.workspace-cache-management-runbook');
    const cacheManagementManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-cache-management');
    expect(cacheManagementManifest?.interaction).toEqual(expect.arrayContaining([
      '预热演练',
      '一致性校验',
      '立即刷新',
      '异常恢复',
      '任务队列查看',
      '影响回滚预演',
      '恢复预案展开',
      '提交校验',
    ]));
    expect(cacheManagementManifest?.acceptance).toContain('预热演练、一致性校验、立即刷新和恢复预案必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-interface-runbook');
    expect(workspacePage).toContain('const runInterfaceHealthCheck = () =>');
    expect(workspacePage).toContain('const openInterfaceInvocationLogs = () =>');
    expect(workspacePage).toContain('const runIntegrationSampleDryRun = () =>');
    expect(workspacePage).toContain('const openIntegrationExceptionQueue = () =>');
    expect(workspacePage).toContain('workspace-integration-operation-ledger');
    expect(workspacePageStyles).toContain('.workspace-interface-runbook');
    expect(workspacePageStyles).toContain('.workspace-integration-operation-ledger');
    const interfaceManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-interfaces');
    expect(interfaceManifest?.interaction).toEqual(expect.arrayContaining([
      '健康检查',
      '认证引用',
      '端点健康检查',
      '调用日志追踪',
      '异常队列追踪',
      '页内试跑留痕',
    ]));
    expect(interfaceManifest?.acceptance).toContain('健康检查和调用日志必须可真人模拟并写入操作反馈');
    expect(interfaceManifest?.acceptance).toContain('试跑配置和异常队列必须在当前页写入操作留痕，不得打开通用占位模板');
    expect(workspacePage).toContain('workspace-field-mapping-runbook');
    expect(workspacePage).toContain('const runFieldMappingSampleCheck = () =>');
    expect(workspacePage).toContain('const openFieldMappingConflictReview = () =>');
    expect(workspacePageStyles).toContain('.workspace-field-mapping-runbook');
    const fieldMappingManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-field-mapping');
    expect(fieldMappingManifest?.interaction).toEqual(expect.arrayContaining([
      '样例校验结果',
      '冲突检测面板',
      '发布门禁',
      '异常字段入队',
    ]));
    expect(fieldMappingManifest?.acceptance).toContain('样例校验和冲突检测必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-sync-rule-runbook');
    expect(workspacePage).toContain('const runSyncRuleDryRun = () =>');
    expect(workspacePage).toContain('const openSyncRuleReplay = () =>');
    expect(workspacePageStyles).toContain('.workspace-sync-rule-runbook');
    const syncRulesManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-sync-rules');
    expect(syncRulesManifest?.interaction).toEqual(expect.arrayContaining([
      '试跑规则',
      '门禁矩阵',
      '差异预览',
      '异常重放',
    ]));
    expect(syncRulesManifest?.acceptance).toContain('试跑规则和异常重放必须可真人模拟并写入操作反馈');
    expect(workspacePage).toContain('workspace-webhook-runbook');
    expect(workspacePage).toContain('const runWebhookSignatureTest = () =>');
    expect(workspacePage).toContain('const openWebhookReplayQueue = () =>');
    expect(workspacePageStyles).toContain('.workspace-webhook-runbook');
    const webhookManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-webhook-config');
    expect(webhookManifest?.interaction).toEqual(expect.arrayContaining([
      '签名门禁',
      '幂等键校验',
      '回调日志追踪',
      '异常重放队列',
    ]));
    expect(webhookManifest?.acceptance).toContain('发送测试和失败重放必须可真人模拟并写入操作反馈');
    expect(workspacePageStyles).toContain('.workspace-audit-log-configurator');
    expect(workspacePage).toContain('const downloadEvidencePackage = () =>');
    expect(workspacePage).toContain('const traceAuditEvidence = () =>');
    expect(workspacePage).toContain('workspace-role-permission-matrix-table');
    expect(workspacePageStyles).toContain('.workspace-role-permission-matrix-table');
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-01-flow-definition-v2'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-02-settings-command-center-v1'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-03-runtime-monitor-v1'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-03-form-config-v2'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-04-form-storage-v2'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-05-approval-rules-v2'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-06-todo-fields-v2'");
    expect(workspacePage).toContain("image2: 'flow-platform-subpage-07-sla-config-v2'");
    expect(workspacePage).toContain("image2: 'integration-subpage-01-external-systems-v2'");
    expect(workspacePage).toContain("image2: 'integration-subpage-02-interfaces-v2'");
    expect(workspacePage).toContain("image2: 'integration-subpage-03-field-mapping-v2'");
    expect(workspacePage).toContain("image2: 'integration-subpage-04-sync-rules-v2'");
    expect(workspacePage).toContain("image2: 'integration-subpage-05-webhook-config-v2'");
    expect(workspacePage).toContain("image2: 'master-data-subpage-01-asset-category-v2'");
    expect(workspacePage).toContain("image2: 'master-data-subpage-02-numbering-rules-v2'");
    expect(workspacePage).toContain("image2: 'master-data-subpage-03-location-management-v2'");
    expect(workspacePage).toContain("image2: 'master-data-subpage-04-vendor-management-v2'");
    expect(workspacePage).toContain("image2: 'master-data-subpage-05-custom-fields-v2'");
    expect(workspacePage).toContain("image2: 'master-data-subpage-06-custom-field-sets-v2'");
    expect(workspacePage).toContain('workspace-custom-field-local-search');
    expect(workspacePage).toContain('aria-label={`${item.label}页内搜索`}');
    expect(workspacePage).toContain('aria-label={`${item.label}搜索`}');
    expect(workspacePage).toContain('aria-label={`${item.label}筛选结果`}');
    expect(workspacePage).toContain('const openCustomFieldAuditTrail = () =>');
    expect(workspacePage).toContain('workspace-custom-field-audit-ledger');
    expect(workspacePage).toContain('字段引用审计已展开');
    expect(workspacePage).toContain('aria-label={`${selectedEntry.name}字段引用审计记录`}');
    expect(workspacePageStyles).toContain('.workspace-custom-field-local-search');
    expect(workspacePageStyles).toContain('.workspace-custom-field-audit-ledger');
    expect(workspacePage).toContain("image2: 'org-permission-subpage-04-data-permissions-v2'");
    expect(workspacePage).toContain('workspace-data-scope-filters');
    expect(workspacePage).toContain('aria-label="数据权限模拟条件"');
    expect(workspacePage).toContain('aria-label="数据权限数据脱敏"');
    expect(workspacePage).toContain('aria-label="数据权限详情操作"');
    expect(workspacePageStyles).toContain('.workspace-data-scope-chip');
    expect(workspacePage).toContain("image2: 'org-permission-subpage-05-handover-v2'");
    expect(workspacePage).toContain("image2: 'org-permission-subpage-06-dept-org-v2'");
    expect(workspacePage).toContain("image2: 'org-permission-subpage-07-post-management-v2'");
    expect(workspacePage).toContain('const runPostImpactPreview = () =>');
    expect(workspacePage).toContain('const openPostAuditTrail = () =>');
    expect(workspacePage).toContain('workspace-post-operation-ledger');
    expect(workspacePage).toContain('aria-label="岗位管理影响与审计记录"');
    expect(workspacePage).toContain('aria-label="岗位管理详情操作"');
    expect(workspacePageStyles).toContain('.workspace-post-operation-ledger');
    expect(workspacePageStyles).toContain('.workspace-post-inspector-actions');
    expect(workspacePage).toContain('scanHandoverImpacts');
    expect(workspacePage).toContain('workspace-handover-impact-summary');
    expect(workspacePage).toContain('aria-label="工作交接范围操作"');
    expect(workspacePage).toContain('type HandoverAuditRow = {');
    expect(workspacePage).toContain('openHandoverScopeAuditTrail');
    expect(workspacePage).toContain('openHandoverBatchAuditTrail');
    expect(workspacePage).toContain('workspace-handover-audit-ledger');
    expect(workspacePage).toContain('aria-label="工作交接审计记录"');
    expect(workspacePage).toContain('扫描条件、接收确认、跳过原因和审计冻结证据');
    expect(workspacePageStyles).toContain('.workspace-handover-impact-summary');
    expect(workspacePageStyles).toContain('.workspace-handover-audit-ledger');
    expect(workspacePage).toContain('workspace-identity-batch-preview');
    expect(workspacePage).toContain('用户批量操作预览');
    expect(workspacePage).toContain('当前筛选无命中，批量操作已禁用。');
    expect(workspacePage).toContain('const runUserDifferenceBatch = () =>');
    expect(workspacePage).toContain('const startUserHandoverBatch = () =>');
    expect(workspacePage).toContain('用户差异处理批次已生成');
    expect(workspacePage).toContain('用户工作交接批次已生成');
    expect(workspacePage).toContain('const previewRolePermissionImpact = () =>');
    expect(workspacePage).toContain('const openRoleAuditTrail = () =>');
    expect(workspacePage).toContain('角色权限影响预演已生成');
    expect(workspacePage).toContain('角色权限审计轨迹已展开');
    expect(workspacePage).toContain('aria-label="角色权限审计记录"');
    expect(workspacePage).toContain('const runMenuRoleVisibilityPreview = () =>');
    expect(workspacePage).toContain('const openMenuPermissionAuditTrail = () =>');
    expect(workspacePage).toContain('角色菜单预览已生成');
    expect(workspacePage).toContain('菜单权限审计轨迹已展开');
    expect(workspacePage).toContain('aria-label="菜单权限详情操作"');
    expect(workspacePage).toContain('const runDepartmentTableAction = (action: string) =>');
    expect(workspacePage).toContain('部门组织负责人变更已生成');
    expect(workspacePage).toContain('aria-label="部门组织变更记录"');
    expect(workspacePage).toContain('const runDataAccessSimulation = () =>');
    expect(workspacePage).toContain('const openDataAuditTrail = () =>');
    expect(workspacePage).toContain('数据权限访问模拟已生成');
    expect(workspacePage).toContain('数据权限审计轨迹已展开');
    expect(workspacePageStyles).toContain('.workspace-identity-batch-preview');
    expect(workspacePageStyles).toContain('.workspace-role-audit-ledger');
    expect(workspacePageStyles).toContain('.workspace-menu-inspector-actions');
    expect(workspacePageStyles).toContain('.workspace-dept-operation-ledger');
    expect(workspacePage).toContain('workspace-notification-generic-configurator');
    expect(workspacePage).toContain('workspace-notification-local-search');
    expect(workspacePage).toContain('workspace-notification-search-empty');
    expect(workspacePage).toContain('const openNotificationAuditTrail = () =>');
    expect(workspacePage).toContain('workspace-notification-audit-ledger');
    expect(workspacePage).toContain('触达审计已展开');
    expect(workspacePage).toContain('aria-label={`${selectedEntry.name}触达审计记录`}');
    expect(workspacePage).toContain('workspace-workflow-switch-local-search');
    expect(workspacePage).toContain('aria-label={`${item.label}搜索`}');
    expect(workspacePage).toContain('aria-label={`${item.label}搜索空结果`}');
    expect(workspacePage).toContain('const openWorkflowSwitchAuditTrail = () =>');
    expect(workspacePage).toContain('流程通知开关审计轨迹已展开');
    expect(workspacePage).toContain('aria-label={`${selectedEntry.name}通知试算记录`}');
    expect(workspacePage).toContain('aria-label="流程通知开关审计记录"');
    expect(workspacePageStyles).toContain('.workspace-workflow-switch-local-search');
    expect(workspacePageStyles).toContain('.workspace-workflow-switch-empty');
    expect(workspacePageStyles).toContain('.workspace-workflow-switch-simulation-ledger');
    expect(workspacePageStyles).toContain('.workspace-workflow-switch-audit-ledger');
    expect(workspacePage).toContain('workspace-notification-channel-console');
    expect(workspacePage).toContain('const runChannelSendTest = () =>');
    expect(workspacePage).toContain('const openChannelFallbackRoute = () =>');
    expect(workspacePageStyles).toContain('.workspace-notification-channel-console');
    expect(workspacePage).toContain("image2: 'notification-subpage-01-mail-gateway-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-02-workflow-mail-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-03-mail-templates-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-04-mail-logs-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-05-notification-templates-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-06-notification-channels-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-07-notification-preferences-v2'");
    expect(workspacePage).toContain("image2: 'notification-subpage-08-workflow-notification-switch-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-01-base-params-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-02-security-policy-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-03-file-storage-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-04-import-export-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-05-cache-management-v2'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-07-doc-center-v1'");
    expect(workspacePage).toContain("image2: 'system-params-subpage-08-tech-support-v1'");
    expect(workspacePage).toContain('const openParameterPublishAuditTrail = () =>');
    expect(workspacePage).toContain('workspace-system-parameter-audit-ledger');
    expect(workspacePage).toContain('发布审计已展开');
    expect(workspacePage).toContain('aria-label={`${selectedEntry.name}发布审计记录`}');
    expect(workspacePageStyles).toContain('.workspace-system-parameter-audit-ledger');
    expect(workspacePage).toContain('workspace-mail-local-search');
    expect(workspacePage).toContain('aria-label="邮件网关搜索"');
    expect(workspacePage).toContain('aria-label="邮件网关搜索空结果"');
    expect(workspacePage).toContain('runMailGatewaySecurityReview');
    expect(workspacePage).toContain('openMailGatewayLogTrail');
    expect(workspacePage).toContain('handleMailGatewayLogRetry');
    expect(workspacePage).toContain('邮件网关安全策略检查已展开');
    expect(workspacePage).toContain('邮件网关发送日志已展开');
    expect(workspacePage).toContain('邮件日志重试已入队');
    expect(workspacePage).toContain('aria-label="邮件网关安全检查记录"');
    expect(workspacePage).toContain('aria-label="邮件网关日志处理记录"');
    expect(workspacePageStyles).toContain('.workspace-mail-local-search');
    expect(workspacePageStyles).toContain('.workspace-mail-security-review');
    expect(workspacePageStyles).toContain('.workspace-mail-log-actions');
    expect(workspacePage).toContain('aria-label="邮件日志页内搜索"');
    expect(workspacePage).toContain('aria-label="邮件日志搜索"');
    expect(workspacePage).toContain('aria-label="邮件日志搜索空结果"');
    expect(workspacePage).toContain('type MailLogRawEventRow = {');
    expect(workspacePage).toContain('const openMailRawLogTrail = () =>');
    expect(workspacePage).toContain('workspace-mail-log-raw-ledger');
    expect(workspacePage).toContain('原始日志已展开');
    expect(workspacePage).toContain('aria-label={`${selectedEntry.name}原始日志记录`}');
    expect(workspacePageStyles).toContain('.workspace-mail-log-raw-ledger');
    const notificationChannelManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-notification-channels');
    expect(notificationChannelManifest?.interaction).toEqual(expect.arrayContaining([
      '发送测试',
      '查看降级路由',
      '保存草稿',
      '提交校验',
    ]));
    expect(notificationChannelManifest?.acceptance).toContain('发送测试和查看降级路由必须可真人模拟');
    expect(workspacePage).toContain('workspace-notification-preference-console');
    expect(workspacePage).toContain('const runPreferenceInheritancePreview = () =>');
    expect(workspacePage).toContain('const runPreferenceConflictCheck = () =>');
    expect(workspacePageStyles).toContain('.workspace-notification-preference-console');
    const notificationPreferenceManifest = systemHubSubpageManifest.subpages.find((entry) => entry.menuId === 'system-notification-preferences');
    expect(notificationPreferenceManifest?.interaction).toEqual(expect.arrayContaining([
      '继承矩阵',
      '强制通知边界',
      '摘要静默预览',
      '静默冲突检查',
    ]));
    expect(notificationPreferenceManifest?.acceptance).toContain('偏好预览和静默冲突检查必须可真人模拟并写入操作反馈');
  });

  it('scopes System Hub visual repairs away from external Workbench pages', () => {
    const systemMenus = collectSystemMenus();

    expect(systemMenus).toHaveLength(44);
    for (const [group, expectedCount] of Object.entries(expectedSystemGroupCounts)) {
      expect(systemMenus.filter((menu) => menu.group === group)).toHaveLength(expectedCount);
    }

    expect(workspacePage).toContain("isSystemMode ? 'is-system-mode' : ''");
    expect(workspacePage).toContain('data-active-menu={activeMenu}');
    expect(workspacePage).toContain('aria-label="待办字段发布校验"');
    expect(workspacePage).toContain('workspace-todo-publish-checklist');
    expect(workspacePageStyles).toContain('.workspace-window.workspace-window-overview.is-system-mode[data-active-menu="system-todo-fields"] .workspace-flow-product-page.workspace-todo-field-page');
    expect(workspacePageStyles).toContain('.workspace-window.workspace-window-overview.is-system-mode[data-active-menu="system-todo-fields"] .workspace-system-page.is-flow-platform-product .workspace-flow-product-page.workspace-todo-field-page > .workspace-flow-product-head');
    expect(workspacePageStyles).toContain('.workspace-window.workspace-window-overview.is-system-mode[data-active-menu="system-todo-fields"] .workspace-todo-field-page .workspace-todo-publish-checklist');
    expect(workspacePageStyles).toContain('.workspace-preview-page.is-workbench-route .workspace-window:not(.is-system-mode) .workspace-side');
    expect(workspacePageStyles).toContain('.workspace-preview-page.is-workbench-route .workspace-window:not(.is-system-mode) .workspace-menu button.is-active');
    expect(workspacePageStyles).toContain('.workspace-window.workspace-window-overview.is-system-mode :where(');

    expect(workspacePageStyles).not.toContain('.workspace-system-page.is-flow-platform-product:not(#gai2-todo-fields-product-light)');
    expect(workspacePageStyles).not.toContain('.workspace-window.is-system-mode');
    expect(workspacePageStyles).not.toMatch(/^\[data-active-menu="system-/m);
    expect(workspacePageStyles).not.toMatch(/^\.workspace-system-page/m);
    expect(workspacePageStyles).not.toMatch(/^body \.workspace-preview-page\.is-workbench-route:has\(/m);
    expect(workspacePageStyles).not.toMatch(/^body:not\(#gai2[^)]*\):has\(/m);
  });

  it('keeps every System Hub menu represented in browser smoke for create-save-submit operation', () => {
    const systemMenuIds = collectSystemMenus().map((menu) => menu.id);

    expect(expectedSystemDraftSmokeMenuIds).toEqual(systemMenuIds);

    for (const helperOrScenario of [
      '系统运营中枢切换为系统配置左侧导航并可回到业务视角',
      '导航控制台页支持当前页新建保存提交',
      '系统运营中枢全量配置页均落到 Future OS iframe 页面',
      'expectFutureSettingsNavigationCenter',
      'expectFutureSystemFrameContract',
      'const systemHtmlPageContracts',
      'const futureMenuContracts',
      'const futureSearchContracts',
      'const masterDataContracts',
      'const notificationContracts',
      '基础资料主数据页均可新建保存提交',
      '消息通知配置页均可新建保存提交',
      'system-flow-designer',
      'system-user-management',
      'system-asset-category',
      'system-external-systems',
      'system-notification-channels',
      'system-base-params',
      '流程设计器',
      '用户管理',
      '资产分类',
      '外部系统配置',
      '通知渠道',
      '基础参数',
      '保存草稿',
      '提交校验',
    ]) {
      expect(workbenchSmoke).toContain(helperOrScenario);
    }
  });

  it('maps Dashboard capabilities to real Workbench business targets', () => {
    expect(workspacePage).toContain("routeTarget: '/approvals?source=workbench&status=PENDING'");
    expect(workspacePage).toContain("buildQueryPath('/workorders/new'");
    expect(workspacePage).toContain("buildQueryPath('/inspections/new'");
    expect(workspacePage).toContain("buildQueryPath('/spare-parts/new'");
    expect(workspacePage).toContain("routeTarget: '/reports?source=workbench&view=operations'");
    expect(workspacePage).toContain("routeTarget: '/settings/sysconfig?source=workbench'");
    expect(workspacePage).toContain("routeTarget: '/risk-matrix?source=workbench&scope=policy'");
  });

  it('protects Workbench through route permissions and menu metadata', () => {
    expect(routePermissions).toContain("{ prefix: '/fixed-assets/workbench', any: ['dashboard:query', 'asset:ledger:query'] }");

    expect(schema).toContain("(310, '资产运营中枢', 185, 1, 'C', 'dashboard:query', 'shield-check', 1, 1)");
    expect(schema).toContain("WHEN 310 THEN 'fixed-assets/workbench'");
    expect(schema).toContain("WHEN 310 THEN 'workspace-preview/WorkspacePreviewPage'");
    expect(schema).toContain("WHEN 310 THEN 'menu=home'");
    expect(schema).toContain('(1, 310)');
    expect(schema).toContain('(1, 311)');

    expect(migration).toContain("(310, '资产运营中枢', 185, 1, 'fixed-assets/workbench', 'menu=home'");
    expect(migration).toContain("WHEN 186 THEN '旧版仪表板'");
    expect(migration).toContain("WHEN 186 THEN 'dashboard'");
  });

  it('keeps documentation evidence for migration, click matrix, visual assets and browser verification', () => {
    expect(matrix).toContain('## Left Navigation Conclusions');
    expect(matrix).toContain('## Dashboard Capability Migration');
    expect(matrix).toContain('## Click Matrix');
    expect(matrix).toContain('## Browser Verification Record');
    expect(matrix).toContain('## IMAGE2 / Stitch Asset Governance');
    expect(matrix).toContain('Desktop global sidebar');
    expect(matrix).toContain('No relevant console/page errors');
  });
});
