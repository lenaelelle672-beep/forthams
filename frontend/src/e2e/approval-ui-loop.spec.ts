import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
  permissions: [],
};

const pendingItem = {
  id: 'wo-e2e-1',
  processNo: 'WO-E2E-001',
  title: 'E2E维修工单',
  processType: 'WORK_ORDER',
  status: 'PENDING',
  applicantName: '系统管理员',
  createTime: '2026-08-20 01:00:00',
};

test('审批列表进入详情通过后该单从列表消失', async ({ page }) => {
  let approved = false;
  await page.route('**/api/**', (route) => mockApprovalApi(route, () => approved, () => { approved = true; }));
  await seedAuthenticatedSession(page);

  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: '审批中心' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'WO-E2E-001' })).toBeVisible();

  await page.getByRole('button', { name: '查看' }).click();
  await expect(page).toHaveURL(/\/approvals\/wo-e2e-1/);
  await expect(page.getByRole('heading', { name: '工单审批详情' })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: '通过' }).click();
  await page.getByRole('button', { name: '确认通过' }).click();

  await expect(page).toHaveURL(/\/approvals$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: '审批中心' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'WO-E2E-001' })).toHaveCount(0, { timeout: 10_000 });
});

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('auth_token', 'approval-ui-loop-token');
    window.localStorage.setItem('user_info', JSON.stringify(user));
    window.sessionStorage.setItem('auth_token', 'approval-ui-loop-token');
    window.sessionStorage.setItem('user_info', JSON.stringify(user));
  }, { user: authUser });
}

async function mockApprovalApi(route: Route, isApproved: () => boolean, markApproved: () => void) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');
  const method = route.request().method();

  if (path === '/auth/login' || path === '/user-management/current' || path === '/users/current') {
    return fulfill(route, { token: 'approval-ui-loop-token', ...authUser });
  }

  if (path === '/approvals/pending/count') {
    return fulfill(route, isApproved() ? 0 : 1);
  }

  if (path === '/approvals/list' && method === 'GET') {
    const records = isApproved() ? [] : [pendingItem];
    return fulfill(route, { records, total: records.length, page: 1, pageSize: 10 });
  }

  if (path === '/approvals/wo-e2e-1' && method === 'GET') {
    return fulfill(route, pendingItem);
  }

  if (path === '/approvals/wo-e2e-1/approve' && method === 'POST') {
    markApproved();
    return fulfill(route, { id: pendingItem.id, status: 'APPROVED' });
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
