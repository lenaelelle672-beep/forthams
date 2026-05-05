import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
};

const coreRoutes = [
  { path: '/', heading: '仪表板', landmark: '资产总数' },
  { path: '/assets', heading: '资产台账管理', landmark: '笔记本电脑' },
  { path: '/equipment', heading: '重要设备管理', landmark: '智能提醒' },
  { path: '/inventory', heading: 'RFID资产盘点', landmark: '盘点任务' },
  { path: '/idle', heading: '闲置资产管理', landmark: '投影仪' },
  { path: '/disposals', heading: '资产处置管理', landmark: '资产转移' },
  { path: '/approval', heading: '审批流程管理', landmark: 'APR-001' },
  { path: '/workflows', heading: '业务流程列表', landmark: '资产转移流程' },
  { path: '/analytics', heading: '数据统计分析', landmark: '资产价值趋势' },
  { path: '/settings', heading: '系统设置', landmark: '基础设置' },
];

test.describe('核心受保护路由 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedAuthenticatedSession(page);
  });

  for (const route of coreRoutes) {
    test(`${route.path} 可认证访问并渲染核心内容`, async ({ page }) => {
      const errors = collectBrowserErrors(page);

      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(route.landmark).first()).toBeVisible({ timeout: 10_000 });
      expect(errors).toEqual([]);
    });
  }
});

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('ams_auth_token', 'core-routes-smoke-token');
    window.localStorage.setItem('ams_auth_user', JSON.stringify(user));
  }, { user: authUser });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

async function mockApi(route: Route) {
  const url = new URL(route.request().url());
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/dashboard/stats') {
    return fulfill(route, {
      totalAssets: 128,
      inUseAssets: 96,
      idleAssets: 18,
      maintenanceAssets: 9,
      scrapAssets: 5,
      totalValue: 860000,
      netValue: 620000,
      categoryDistribution: { 电子设备: 60, 办公设备: 38, 生产设备: 30 },
      pendingApprovals: 3,
    });
  }

  if (path === '/dashboard/trends') {
    return fulfill(route, [
      { date: '2026-04-01', totalValue: 800000, netValue: 610000 },
      { date: '2026-04-30', totalValue: 860000, netValue: 620000 },
    ]);
  }

  if (path === '/dashboard/dept-distribution') {
    return fulfill(route, [
      { deptId: 1, deptName: '研发部', assetCount: 42 },
      { deptId: 2, deptName: '行政部', assetCount: 31 },
    ]);
  }

  if (path === '/dashboard/maintenance-stats' || path === '/dashboard/pending-approvals') {
    return fulfill(route, path.endsWith('pending-approvals') ? 3 : {
      totalMaintenanceCount: 12,
      avgMaintenanceCost: 460,
      monthlyMaintenanceCount: 4,
    });
  }

  if (path.startsWith('/assets')) {
    return fulfill(route, paged([
      { id: 1, assetNo: 'AST-001', assetName: '笔记本电脑', categoryId: 1, status: 'IN_USE', deptId: 1, location: 'A座' },
    ]));
  }

  if (path === '/maintenance/upcoming') {
    return fulfill(route, [
      { id: 2, assetId: 1, assetName: '数控机床', level: 'warning', message: '保养计划提醒', nextMaintenance: '2026-05-05' },
    ]);
  }

  if (path.startsWith('/maintenance')) {
    return fulfill(route, paged([
      { id: 1, assetId: 1, assetName: '数控机床', maintenanceType: '保养', maintenanceDate: '2026-04-20', nextMaintenance: '2026-05-20', cost: 300 },
    ]));
  }

  if (path.includes('/inventory/tasks/') && path.endsWith('/details')) {
    return fulfill(route, {
      discrepancies: [{ id: 1, assetName: '标签异常资产', status: 'MISMATCH' }],
      recentScans: [{ id: 1, rfidTag: 'RFID-001', status: 'MATCH', scanner: 'RFID-01' }],
    });
  }

  if (path.startsWith('/inventory/tasks')) {
    return fulfill(route, paged([
      { id: 1, taskNo: 'INV-001', taskName: '办公室盘点', name: '办公室盘点', status: 'IN_PROGRESS', totalCount: 10, scannedCount: 6 },
    ]));
  }

  if (path.startsWith('/idle-assets')) {
    return fulfill(route, paged([
      { id: 1, assetId: 1, assetName: '投影仪', idleDays: 45, status: '已发布', reason: '会议室改造' },
    ]));
  }

  if (path.startsWith('/disposals')) {
    return fulfill(route, [
      { id: 1, assetId: 1, assetName: '办公电脑', changeType: '资产转移', reason: '部门调拨', createTime: '2026-04-30T10:00:00' },
    ]);
  }

  if (path.startsWith('/approvals')) {
    return fulfill(route, [
      { id: 1, processNo: 'APR-001', processType: '资产转移', status: 'PENDING', applicantId: 1 },
    ]);
  }

  if (path.startsWith('/workflows')) {
    return fulfill(route, [
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', description: '资产转移审批', definition: {}, status: 'DRAFT', version: 0 },
      { businessType: 'ASSET_CLEARANCE', name: '资产清退流程', description: '资产清退审批', definition: {}, status: 'DRAFT', version: 0 },
      { businessType: 'ASSET_SCRAP', name: '资产报废转让流程', description: '资产报废审批', definition: {}, status: 'DRAFT', version: 0 },
      { businessType: 'ASSET_COMPENSATION', name: '资产赔偿流程', description: '资产赔偿审批', definition: {}, status: 'DRAFT', version: 0 },
    ]);
  }

  if (path.startsWith('/users')) {
    return fulfill(route, [{ id: 1, username: 'admin', realName: '系统管理员', status: 1, deptId: 1 }]);
  }

  if (path.startsWith('/roles')) {
    return fulfill(route, [{ id: 1, roleName: '超级管理员', roleCode: 'SUPER_ADMIN' }]);
  }

  if (path.startsWith('/depts')) {
    return fulfill(route, [{ id: 1, name: '研发部', deptName: '研发部', parentId: 0 }]);
  }

  return fulfill(route, {});
}

function paged<T>(records: T[]) {
  return {
    records,
    total: records.length,
    size: 10,
    current: 1,
    pages: 1,
  };
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, message: 'OK', data }),
  });
}
