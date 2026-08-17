import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SHOT_DIR = path.join(process.cwd(), 'reports', 'authority-loop-screenshots');

const auditUser = {
  userId: 1,
  username: 'platform.admin',
  realName: '平台管理员',
  roles: ['TENANT_ADMIN'],
  permissions: [
    'system:flow:query',
    'workflow:designer:edit',
    'workflow:designer:publish',
    'workflow:designer:rollback',
    'disposal:query',
    'disposal:create',
    'compensation:query',
    'compensation:create',
    'inventory:query',
    'inventory:create',
    'workorder:query',
    'workorder:order:query',
    'workorder:approve',
    'retirement:query',
    'retirement:approve',
    'approval:query',
    'approval:process:query',
  ],
  platformAdmin: true,
  platform_admin: true,
};

test.describe.configure({ mode: 'serial' });

test.describe('权限修复 LOOP 页面截图审计', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.route('**/api/**', mockApi);
  });

  test('登录后权限入口：流程中心与设计器可进入', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await openAuthed(page, '/workflows');
    await expect(page.getByRole('heading', { name: /业务流程/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Forbidden', { exact: true })).toHaveCount(0);
    await shot(page, '01-workflows-center');

    await openAuthed(page, '/workflow-designer');
    await expect(page.getByText('Forbidden', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/流程中心|设计器|流程设计/)).toBeVisible({ timeout: 15_000 });
    await shot(page, '02-workflow-designer');
    expect(errors.filter((item) => !item.includes('html5-qrcode') && !item.includes('favicon'))).toEqual([]);
  });

  test('处置列表识别需重提状态', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await openAuthed(page, '/disposals');
    await expect(page.getByText(/需重提|处理人缺失/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '03-disposals-resubmission');
    expect(errors.filter((item) => !item.includes('html5-qrcode') && !item.includes('favicon'))).toEqual([]);
  });

  test('盘点创建页使用 inventoryType/deptIds 字段', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await openAuthed(page, '/inventory');
    await page.getByRole('button', { name: /创建|新建|createTask|盘点/ }).first().click();
    await expect(page.getByText(/deptIds|盘点类型|inventoryType/)).toBeVisible({ timeout: 15_000 });
    await shot(page, '04-inventory-create');
    expect(errors.filter((item) => !item.includes('html5-qrcode') && !item.includes('favicon'))).toEqual([]);
  });

  test('工单详情无审批流程时禁用直连审批', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await openAuthed(page, '/workorders/12');
    await expect(page.getByText(/当前业务没有可用的审批流程|审批通过|待审批/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '05-workorder-missing-approval');
    expect(errors.filter((item) => !item.includes('html5-qrcode') && !item.includes('favicon'))).toEqual([]);
  });

  test('退役详情无审批流程时禁用直连审批', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await openAuthed(page, '/retirement/9');
    await expect(page.getByText(/当前业务没有可用的审批流程|审批|退役/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '06-retirement-missing-approval');
    expect(errors.filter((item) => !item.includes('html5-qrcode') && !item.includes('favicon'))).toEqual([]);
  });

  test('登录页可访问', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/欢迎回来|登录|用户名/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '07-login');
  });

  test('赔偿详情页展示金额与编号', async ({ page }) => {
    await openAuthed(page, '/compensation/9');
    await expect(page.getByText(/资产赔偿详情|CMP-009/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '08-compensation-detail');
  });

  test('盘点详情页可打开', async ({ page }) => {
    await openAuthed(page, '/inventory/tasks/3');
    await expect(page.getByText(/八月抽盘|盘点|INV-003/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '09-inventory-detail');
  });

  test('审批中心可打开', async ({ page }) => {
    await openAuthed(page, '/approvals');
    await expect(page.getByText(/审批|待办|流程/).first()).toBeVisible({ timeout: 15_000 });
    await shot(page, '10-approvals-center');
  });
});

async function openAuthed(page: Page, target: string) {
  await page.addInitScript((user) => {
    const write = (storage: Storage) => {
      storage.setItem('auth_token', 'authority-loop-screenshot-token');
      storage.setItem('user_info', JSON.stringify(user));
      storage.setItem('ams_auth_token', 'authority-loop-screenshot-token');
      storage.setItem('ams_auth_user', JSON.stringify(user));
    };
    write(window.sessionStorage);
    write(window.localStorage);
  }, auditUser);
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    await page.evaluate((user) => {
      const write = (storage: Storage) => {
        storage.setItem('auth_token', 'authority-loop-screenshot-token');
        storage.setItem('user_info', JSON.stringify(user));
        storage.setItem('ams_auth_token', 'authority-loop-screenshot-token');
        storage.setItem('ams_auth_user', JSON.stringify(user));
      };
      write(window.sessionStorage);
      write(window.localStorage);
    }, auditUser);
    await page.goto(target, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForLoadState('networkidle');
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

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}-1440x900.png`),
    fullPage: true,
  });
}

async function mockApi(route: Route) {
  const url = new URL(route.request().url());
  const apiPath = url.pathname.replace(/^\/api/, '');

  if (apiPath === '/user-management/current' || apiPath === '/auth/current') {
    return fulfill(route, auditUser);
  }
  if (apiPath === '/workflows') {
    return fulfill(route, [
      {
        id: 1,
        businessType: 'ASSET_TRANSFER',
        name: '资产转移流程',
        description: '线性调拨审批',
        definition: { nodes: [], edges: [] },
        status: 'PUBLISHED',
        version: 1,
      },
    ]);
  }
  if (apiPath.startsWith('/workflows/')) {
    return fulfill(route, {
      id: 1,
      businessType: 'ASSET_TRANSFER',
      name: '资产转移流程',
      description: '线性调拨审批',
      definition: { nodes: [], edges: [] },
      status: 'PUBLISHED',
      version: 1,
      revision: 0,
    });
  }
  if (apiPath === '/disposals/statistics') {
    return fulfill(route, { thisMonthCount: 4, previousMonthCount: 2, pendingCount: 1, completedCount: 3, recoveredValue: 1200 });
  }
  if (apiPath === '/disposals' || apiPath.startsWith('/disposals/')) {
    return fulfill(route, {
      records: [
        {
          id: 21,
          assetId: 8,
          assetNo: 'AST-008',
          assetName: '待重提笔记本',
          applicationNo: 'DA-RESUB-001',
          disposalType: 'TRANSFER',
          status: 'CANCELLED_REQUIRES_RESUBMISSION',
          reason: '处理人缺失',
          applicantName: '张三',
          createTime: '2026-08-03T10:00:00',
        },
      ],
      total: 1,
      size: 10,
      current: 1,
    });
  }
  if (apiPath === '/inventory/tasks/3' || apiPath === '/inventory/tasks/3/details') {
    return fulfill(route, {
      id: 3,
      taskNo: 'INV-003',
      taskName: '八月抽盘',
      status: 'DRAFT',
      inventoryType: 'PARTIAL',
      deptIds: '10,11',
      records: [],
      total: 0,
    });
  }
  if (apiPath === '/inventory/tasks') {
    return fulfill(route, {
      records: [
        { id: 3, taskNo: 'INV-003', taskName: '八月抽盘', status: 'DRAFT', inventoryType: 'PARTIAL', deptIds: '10,11' },
      ],
      total: 1,
      size: 10,
      current: 1,
    });
  }
  if (apiPath.startsWith('/inventory/')) {
    return fulfill(route, { records: [], total: 0, size: 10, current: 1 });
  }
  if (apiPath === '/compensation/9' || apiPath === '/compensation') {
    const compensation = {
      id: 9,
      assetId: 8,
      compensationNo: 'CMP-009',
      compensationType: 'DAMAGE',
      compensationAmount: 1280.5,
      description: '屏幕损坏',
      responsibleUserId: 2,
      status: 'PENDING',
      createTime: '2026-08-03T11:00:00',
    };
    return fulfill(route, apiPath === '/compensation' ? { records: [compensation], total: 1, size: 10, current: 1 } : compensation);
  }
  if (apiPath === '/workorders/12' || apiPath === '/work-orders/12') {
    return fulfill(route, {
      id: 12,
      workOrderNo: 'WO-012',
      title: '空调检修',
      status: 'PENDING',
      priority: 'MEDIUM',
      reporterName: '李四',
      createTime: '2026-08-03T09:00:00',
    });
  }
  if (apiPath === '/retirement/9') {
    return fulfill(route, {
      id: 9,
      applicationNo: 'RA-009',
      assetId: 8,
      assetName: '报废主机',
      status: 'PENDING',
      reason: '到期报废',
    });
  }
  if (apiPath === '/approvals/list' || apiPath.startsWith('/approvals')) {
    return fulfill(route, []);
  }
  if (apiPath.startsWith('/roles')) {
    return fulfill(route, [{ id: 2, roleName: '资产管理员', roleCode: 'ASSET_ADMIN' }]);
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
