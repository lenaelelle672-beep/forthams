import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
  permissions: [],
};

const submitted = {
  id: 91,
  assetId: 1,
  assetNo: 'AST-RT-001',
  assetName: 'E2E退役笔记本',
  applicantId: 1,
  applicantName: '系统管理员',
  reason: '设备老化无法继续服役测试',
  status: 'PENDING' as const,
  createdAt: '2026-08-20T02:00:00',
  updatedAt: '2026-08-20T02:00:00',
};

test('提交退役申请后列表出现待审批记录', async ({ page }) => {
  let created = false;
  await page.route('**/api/**', (route) => mockRetirementApi(route, () => created, () => { created = true; }));
  await seedAuthenticatedSession(page);

  await page.goto('/retirement/new');
  await expect(page.getByText('资产退役申请').first()).toBeVisible({ timeout: 10_000 });

  await page.getByLabel('资产 ID *').fill('1');
  await page.getByPlaceholder(/请输入退役原因/).fill('设备老化无法继续服役测试');
  await page.getByRole('button', { name: '提交退役申请' }).click();

  await expect(page).toHaveURL(/\/retirement$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: '资产退役管理' })).toBeVisible();
  await expect(page.getByText('E2E退役笔记本').first()).toBeVisible();
  await expect(page.locator('span', { hasText: '待审批' }).first()).toBeVisible();
});

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('auth_token', 'retirement-ui-loop-token');
    window.localStorage.setItem('user_info', JSON.stringify(user));
    window.sessionStorage.setItem('auth_token', 'retirement-ui-loop-token');
    window.sessionStorage.setItem('user_info', JSON.stringify(user));
  }, { user: authUser });
}

async function mockRetirementApi(route: Route, isCreated: () => boolean, markCreated: () => void) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');
  const method = route.request().method();

  if (path === '/auth/login' || path === '/user-management/current' || path === '/users/current') {
    return fulfill(route, { token: 'retirement-ui-loop-token', ...authUser });
  }

  if (path === '/retirement/apply' && method === 'POST') {
    markCreated();
    return fulfill(route, submitted);
  }

  if (path === '/retirement/list' && method === 'GET') {
    const records = isCreated() ? [submitted] : [];
    return fulfill(route, { records, total: records.length, current: 1, size: 20, pages: 1 });
  }

  if (path.startsWith('/depts') || path.startsWith('/departments')) {
    return fulfill(route, []);
  }

  return fulfill(route, {});
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, message: 'OK', data }),
  });
}
