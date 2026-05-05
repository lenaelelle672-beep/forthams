import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
};

const protectedPages = [
  { path: '/', heading: '仪表板' },
  { path: '/assets', heading: '资产台账管理' },
  { path: '/equipment', heading: '重要设备管理' },
  { path: '/inventory', heading: 'RFID资产盘点' },
  { path: '/idle', heading: '闲置资产管理' },
  { path: '/disposals', heading: '资产处置管理' },
  { path: '/approval', heading: '审批流程管理' },
  { path: '/workflows', heading: '业务流程列表' },
  { path: '/analytics', heading: '数据统计分析' },
  { path: '/settings', heading: '系统设置' },
  { path: '/workflow-designer', heading: '审批流程可视化设计器' },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', mockApi);
});

test('登录页可见，并能通过登录接口进入仪表板', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible();

  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('123456');
  await page.getByRole('button', { name: /登录并进入仪表板/ }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '仪表板' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('未登录访问受保护页面会跳转登录页', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await page.goto('/assets');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('退出登录会清理会话并回到登录页', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await seedAuthenticatedSession(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '仪表板' })).toBeVisible();

  await page.getByRole('button', { name: /退出/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: '欢迎登录' })).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem('ams_auth_token'))).resolves.toBeNull();
  expect(errors).toEqual([]);
});

test('受保护核心页面均可渲染且无浏览器运行时错误', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await seedAuthenticatedSession(page);

  for (const item of protectedPages) {
    await page.goto(item.path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: item.heading }).first()).toBeVisible({ timeout: 10_000 });
  }

  expect(errors).toEqual([]);
});

test('核心按钮、搜索框和表单提交路径可交互', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await seedAuthenticatedSession(page);

  await page.goto('/assets');
  await expect(page.getByText('资产台账管理')).toBeVisible();

  const search = page.getByPlaceholder(/搜索|请输入/).first();
  await search.fill('笔记本');
  await expect(search).toHaveValue('笔记本');

  const addButton = page.getByRole('button', { name: /新增|添加/ }).first();
  await addButton.click();
  await expect(page.getByText(/新增资产|添加资产|资产信息/).first()).toBeVisible();

  await page.goto('/inventory');
  await page.getByRole('button', { name: /创建盘点任务/ }).click();
  await expect(page.getByText(/创建盘点任务|任务名称/).first()).toBeVisible();

  await page.goto('/workflow-designer');
  await expect(page.getByText('审批流程可视化设计器')).toBeVisible();
  await expect(page.getByText(/审批节点|开始节点|条件节点/).first()).toBeVisible();

  await page.goto('/workflows');
  await expect(page.getByRole('heading', { name: '业务流程列表' })).toBeVisible();
  await page.getByRole('button', { name: /打开设计器/ }).first().click();
  await expect(page).toHaveURL(/\/workflow-designer\?businessType=ASSET_TRANSFER$/);
  await expect(page.getByText('资产转移流程').first()).toBeVisible();

  expect(errors).toEqual([]);
});

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('ams_auth_token', 'browser-smoke-token');
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
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/auth/login') {
    return fulfill(route, {
      token: 'browser-smoke-token',
      ...authUser,
    });
  }

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
      { id: 2, assetId: 1, maintenanceType: '巡检', maintenanceDate: '2026-04-28', nextMaintenanceDate: '2026-05-05', cost: 120 },
    ]);
  }

  if (path.startsWith('/maintenance')) {
    return fulfill(route, paged([
      { id: 1, assetId: 1, maintenanceType: '保养', maintenanceDate: '2026-04-20', nextMaintenanceDate: '2026-05-20', cost: 300 },
    ]));
  }

  if (path === '/inventory/tasks') {
    return fulfill(route, paged([
      { id: 1, taskNo: 'INV-001', taskName: '办公室盘点', status: 'IN_PROGRESS', totalCount: 10, scannedCount: 6 },
    ]));
  }

  if (path.includes('/inventory/tasks/') && path.endsWith('/details')) {
    return fulfill(route, [
      { id: 1, taskId: 1, rfidTag: 'RFID-001', status: 'MATCH', actualLocation: 'A座', scanTime: '2026-04-30T10:00:00' },
    ]);
  }

  if (path.startsWith('/inventory/tasks')) {
    return fulfill(route, { id: 1, taskName: '办公室盘点', status: 'IN_PROGRESS' });
  }

  if (path.startsWith('/idle-assets')) {
    return fulfill(route, paged([
      { id: 1, assetId: 1, assetName: '投影仪', idleDays: 45, status: 'PUBLISHED', reason: '会议室改造' },
    ]));
  }

  if (path.startsWith('/compensations')) {
    return fulfill(route, paged([
      { id: 1, compensationNo: 'CMP-001', assetId: 1, compensationType: '损坏', compensationAmount: 500, status: 'PENDING' },
    ]));
  }

  if (path.startsWith('/approvals')) {
    return fulfill(route, paged([
      { id: 1, processNo: 'APR-001', processType: '资产转移', status: 'PENDING', applicantId: 1 },
    ]));
  }

  if (path.startsWith('/disposals')) {
    return fulfill(route, paged([
      { id: 1, assetId: 1, changeType: 'TRANSFER', reason: '部门调拨', createTime: '2026-04-30T10:00:00' },
    ]));
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
    return fulfill(route, paged([{ id: 1, username: 'admin', realName: '系统管理员', status: 1, deptId: 1 }]));
  }

  if (path.startsWith('/roles')) {
    return fulfill(route, paged([{ id: 1, roleName: '超级管理员', roleCode: 'SUPER_ADMIN' }]));
  }

  if (path.startsWith('/depts')) {
    return fulfill(route, [{ id: 1, name: '研发部', parentId: 0 }]);
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
