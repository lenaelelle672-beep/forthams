import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
};

test.describe('浏览器回归 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedAuthenticatedSession(page);
  });

  test('/compensation 赔偿入口可访问且无运行时错误', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto('/compensation');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('资产赔偿申请').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('/bigscreen-3d 无 WebGL 时展示安全降级且不加载 3D chunk', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await disableWebGL(page);

    await page.goto('/bigscreen-3d');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('3D 地图已切换为安全降级模式').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors.filter((error) => !/WebGL|webgl|Canvas|React will try to recreate/.test(error))).toEqual([]);
  });

  test('/inventory 智能报告入口在无任务时保持禁用态', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const reportButton = page.getByRole('button', { name: '查看智能报告' });
    await expect(page.getByRole('heading', { name: '盘点任务列表', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('暂无盘点任务，点击「新建盘点」开始')).toBeVisible();
    await expect(reportButton).toBeDisabled();
    await expect(reportButton).toHaveAttribute('title', '暂无可查看的盘点任务，请先创建或选择任务');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('/idle 闲置资产管理页面可访问且无运行时错误', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto('/idle');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('闲置资产管理').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });
});

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('ams_auth_token', 'browser-regression-smoke-token');
    window.localStorage.setItem('ams_auth_user', JSON.stringify(user));
    window.localStorage.setItem('auth_token', 'browser-regression-smoke-token');
    window.localStorage.setItem('user_info', JSON.stringify(user));
  }, { user: authUser });
}

async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return null;
      }
      return originalGetContext.call(this, type, ...args as []);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!text.includes('Failed to load resource') && !text.startsWith('Warning:')) {
        errors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

async function mockApi(route: Route) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) {
    return route.continue();
  }

  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/dashboard/stats') {
    return fulfill(route, {
      totalAssets: 128,
      inUseAssets: 96,
      idleAssets: 18,
      scrapAssets: 5,
      totalValue: 860000,
      netValue: 620000,
      pendingApprovals: 3,
      pendingWorkOrders: 2,
      inventoryProgress: 0,
      criticalAlerts: 1,
    });
  }

  if (path.startsWith('/assets')) {
    return fulfill(route, paged([
      { id: 1, assetNo: 'AST-001', assetName: '笔记本电脑', categoryName: '电子设备', location: 'A座', deptId: 1, status: 'IN_USE' },
    ]));
  }

  if (path.startsWith('/depts')) {
    return fulfill(route, [{ id: 1, name: '研发部', deptName: '研发部', parentId: 0 }]);
  }

  if (path === '/inventory/tasks') {
    return fulfill(route, paged([]));
  }

  if (path.includes('/inventory/tasks/') && path.endsWith('/details')) {
    return fulfill(route, []);
  }

  if (path.startsWith('/inventory/tasks')) {
    return fulfill(route, {});
  }

  if (path.startsWith('/idle-assets')) {
    return fulfill(route, [
      { id: 1, assetId: 'AST-101', assetName: '闲置办公桌', status: 'PENDING', idleDays: 45, originalDept: '研发部', category: '家具' },
      { id: 2, assetId: 'AST-102', assetName: '旧显示器', status: 'PUBLISHED', idleDays: 60, originalDept: '行政部', category: '电子设备' },
    ]);
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
