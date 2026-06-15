import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const workspacePage = readText('../pages/workspace-preview/WorkspacePreviewPage.tsx');
const workspacePageStyles = readText('../pages/workspace-preview/WorkspacePreviewPage.css');
const appLayout = readText('../layouts/AppLayout.tsx');
const router = readText('../router/index.tsx');
const routePermissions = readText('../utils/routePermissions.ts');
const schema = readText('../../../backend/src/main/resources/schema.sql');
const migration = readText('../../../backend/src/main/resources/migration/V2_84__workbench_platform_menu_entry.sql');
const matrix = readText('../../../docs/workbench-platform-entry-matrix.md');
const menuItemsBlock = workspacePage.slice(
  workspacePage.indexOf('const menuItems'),
  workspacePage.indexOf('const getWorkbenchPageFromSection'),
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

describe('Workbench platform entry contract', () => {
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
