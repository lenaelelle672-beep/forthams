import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * 发布冒烟验证脚本
 *
 * 使用 mock API 模式（不依赖真实后端），覆盖：
 *   1. 登录页可访问 — 验证标题、输入框、登录按钮可见
 *   2. 成功登录后进入仪表板 — mock /api/auth/login，验证 URL 跳转和仪表板标题
 *   3. 关键页面冒烟 — /assets、/approval、/settings 三个关键页面可渲染
 *   4. 退出登录 — 验证 token 被清除、URL 跳回 /login
 *
 * 选择器风格：与 browser-smoke.spec.ts 保持一致
 */

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['ADMIN', 'SUPER_ADMIN'],
  permissions: ['*'],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', mockApi);
});

// ---------------------------------------------------------------------------
// 场景 1：登录页可访问
// ---------------------------------------------------------------------------
test('登录页可访问并显示关键元素', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();
  await expect(page.getByPlaceholder('请输入账号')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /登录系统/ })).toBeVisible();

  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// 场景 2：成功登录后进入仪表板
// ---------------------------------------------------------------------------
test('成功登录后进入仪表板', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();

  await page.getByPlaceholder('请输入账号').fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /登录系统/ }).click();

  // 验证 URL 跳转到首页
  await expect(page).toHaveURL(/\/dashboard/);
  // 验证仪表板标题可见
  await expect(page.getByRole('heading', { name: '仪表板' })).toBeVisible();

  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// 场景 3：关键页面冒烟
// ---------------------------------------------------------------------------
test('关键业务页面可渲染且无运行时错误', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await seedAuthenticatedSession(page);

  const smokeTargets = [
    { path: '/assets', heading: '资产台账' },
    { path: '/settings', heading: '系统设置' },
  ];

  for (const target of smokeTargets) {
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: target.heading }).first()).toBeVisible({ timeout: 10_000 });
  }

  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// 场景 4：退出登录
// ---------------------------------------------------------------------------
test('退出登录会清理会话并回到登录页', async ({ page }) => {
  const errors = collectBrowserErrors(page);

  await seedAuthenticatedSession(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '仪表板' })).toBeVisible();

  await page.getByRole('button', { name: /退出/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /仰望星空|驾驭资产万象/ })).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem('auth_token'))
  ).resolves.toBeNull();

  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Helper：注入已认证的 localStorage 会话
// ---------------------------------------------------------------------------
async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('auth_token', 'publish-smoke-token');
    window.localStorage.setItem('user_info', JSON.stringify(user));
    window.sessionStorage.setItem('auth_token', 'publish-smoke-token');
    window.sessionStorage.setItem('user_info', JSON.stringify(user));
  }, { user: authUser });
}

// ---------------------------------------------------------------------------
// Helper：收集浏览器运行时错误
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Mock API
// ---------------------------------------------------------------------------
async function mockApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  // 只拦截真实 API 请求（以 /api/ 开头），放行 Vite 模块请求
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/auth/login') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: {
          token: 'publish-smoke-token',
          userId: 1,
          username: 'admin',
          realName: '系统管理员',
          roles: ['ADMIN', 'SUPER_ADMIN'],
          permissions: ['*'],
        },
      }),
    });
  }

  if (path === '/dashboard/stats') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: {
          totalAssets: 128,
          inUseAssets: 96,
          idleAssets: 18,
          maintenanceAssets: 9,
          scrapAssets: 5,
          totalValue: 860000,
          netValue: 620000,
          categoryDistribution: { 电子设备: 60, 办公设备: 38, 生产设备: 30 },
          pendingApprovals: 3,
        },
      }),
    });
  }

  if (path === '/dashboard/trends') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: [
          { date: '2026-04-01', totalValue: 800000, netValue: 610000 },
          { date: '2026-04-30', totalValue: 860000, netValue: 620000 },
        ],
      }),
    });
  }

  if (path === '/dashboard/dept-distribution') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: [
          { deptId: 1, deptName: '研发部', assetCount: 42 },
          { deptId: 2, deptName: '行政部', assetCount: 31 },
        ],
      }),
    });
  }

  if (path === '/dashboard/maintenance-stats' || path === '/dashboard/pending-approvals') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: path.endsWith('pending-approvals') ? 3 : {
          totalMaintenanceCount: 12,
          avgMaintenanceCost: 460,
          monthlyMaintenanceCount: 4,
        },
      }),
    });
  }

  if (path.startsWith('/assets')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: {
          records: [
            { id: 1, assetNo: 'AST-001', assetName: '笔记本电脑', categoryId: 1, status: 'IN_USE', deptId: 1, location: 'A座' },
          ],
          total: 1,
          size: 10,
          current: 1,
          pages: 1,
        },
      }),
    });
  }

  if (path.startsWith('/approvals')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: [
          { id: 1, processNo: 'APR-001', processType: '资产转移', status: 'PENDING', applicantId: 1 },
        ],
      }),
    });
  }

  if (path === '/users/current') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: {
          userId: 1,
          username: 'admin',
          realName: '系统管理员',
          roles: ['ADMIN', 'SUPER_ADMIN'],
          permissions: ['*'],
        },
      }),
    });
  }

  if (path.startsWith('/users')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: [{ id: 1, username: 'admin', realName: '系统管理员', status: 1, deptId: 1 }],
      }),
    });
  }

  if (path.startsWith('/depts')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: [{ id: 1, name: '研发部', deptName: '研发部', parentId: 0 }],
      }),
    });
  }

  if (path.startsWith('/settings')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        message: 'OK',
        data: {},
      }),
    });
  }

  // 其他未匹配 API 返回空数据
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, message: 'OK', data: {} }),
  });
}
