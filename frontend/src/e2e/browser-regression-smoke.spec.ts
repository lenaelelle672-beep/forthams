import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
};


let submitCount = 0;
type ApprovalScenario = 'default' | 'empty' | 'forbidden';
type ReportsScenario = 'default' | 'empty' | 'forbidden';
let approvalScenario: ApprovalScenario = 'default';
let reportsScenario: ReportsScenario = 'default';

const inventoryTask = {
  id: 1,
  taskId: 'INV-001',
  taskNo: 'INV-001',
  taskName: '2026年5月RFID盘点',
  inventoryType: 'RFID',
  status: 'IN_PROGRESS',
  deptIds: null,
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  location: '总部库位',
  scope: '全部资产',
  totalCount: 2,
  matchedCount: 0,
  lossCount: 0,
  executorId: 1,
  createBy: 1,
  createTime: '2026-05-01T00:00:00',
  updateTime: '2026-05-30T00:00:00',
};

let inventoryAssets = [
  { assetId: 'AST-RFID-001', assetCode: 'RFID-001', assetName: 'RFID手持终端', confirmed: false, actualStatus: 'normal' },
  { assetId: 'AST-RFID-002', assetCode: 'RFID-002', assetName: '电子标签打印机', confirmed: false, actualStatus: 'normal' },
];

test.describe('浏览器回归 smoke', () => {
  test.beforeEach(async ({ page }) => {
    approvalScenario = 'default';
    reportsScenario = 'default';
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
    await expect(page.getByRole('heading', { name: '资产盘点管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: '盘点任务队列' })).toBeVisible();
    await expect(reportButton).toBeDisabled();
    await expect(reportButton).toHaveAttribute('title', '暂无可查看的任务');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });


  test('/inventory/scan RFID 扫码、批量确认和防重复提交路径可运行', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto('/inventory/scan/INV-001');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '2026年5月RFID盘点' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '开始扫描' }).click();
    await expect(page.getByText('● 当前扫描中...')).toBeVisible();
    await expect(page.getByText(/RFID 扫描器 RFID-01 已连接/)).toBeVisible();

    await page.getByRole('button', { name: /批量确认 \(2\)/ }).click();
    await expect(page.getByText(/批量确认 2 条资产/)).toBeVisible();
    await expect(page.getByRole('button', { name: /批量确认 \(0\)/ })).toBeDisabled({ timeout: 10_000 });

    const submitButton = page.getByRole('button', { name: '提交盘点' });
    await expect(submitButton).toBeEnabled();
    await submitButton.dblclick();
    await expect(page.getByText(/提交盘点任务，等待核准/)).toBeVisible();
    expect(await page.locator('text=提交盘点任务，等待核准').count()).toBe(1);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('/locations 在移动视口可作为 GIS/位置基础路径访问', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/locations');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /位置|库位/ }).first()).toBeVisible({ timeout: 10_000 });
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

  test('模块验收 smoke：资产、处置、报表和工单详情路径可交互', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto('/assets');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '资产台账' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('模块验收笔记本')).toBeVisible();
    await page.getByPlaceholder('搜索编号、名称...').fill('模块验收');
    await expect(page.getByText(/已启用 1 项筛选|匹配 1 条/)).toBeVisible({ timeout: 10_000 });

    await page.goto('/disposals');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '资产处置管理' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('暂无资产清退记录')).toBeVisible();
    await page.getByRole('button', { name: /工单管理/ }).click();
    await expect(page.getByText('模块验收维修工单').first()).toBeVisible({ timeout: 10_000 });

    await page.goto('/workorders/1');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '模块验收维修工单' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('当前审批节点进行中')).toBeVisible();
    await expect(page.getByRole('button', { name: '审批通过' })).toBeVisible();

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('资产汇总表')).toBeVisible();
    await page.getByRole('tab', { name: /财务报表/ }).click();
    await expect(page.getByText('资产价值趋势')).toBeVisible();

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('/approvals 空态与权限拒绝态可解释且不崩溃', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    approvalScenario = 'empty';
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '审批中心' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('暂无审批数据，试试调整搜索、状态或日期筛选')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');

    approvalScenario = 'forbidden';
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('加载审批数据失败，请重试')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('/reports 空态与权限拒绝态可解释且不崩溃', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    reportsScenario = 'empty';
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '报表中心' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /资产分类统计/ }).click();
    await expect(page.getByText('暂无图表数据')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');

    reportsScenario = 'forbidden';
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('数据加载失败').first()).toBeVisible({ timeout: 10_000 });
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

  if (path === '/approvals/pending/count') {
    return fulfill(route, 0);
  }

  if (path === '/approvals/stats') {
    return fulfill(route, []);
  }

  if (path.startsWith('/approvals')) {
    if (approvalScenario === 'forbidden') {
      return fulfillError(route, 403, '权限不足，无法访问审批数据');
    }

    if (approvalScenario === 'empty') {
      return fulfill(route, paged([]));
    }

    return fulfill(route, paged([
      {
        id: 1,
        processNo: 'APP-MODULE-001',
        processType: 'WORK_ORDER',
        title: '模块验收审批单',
        applicantName: '系统管理员',
        status: 'PENDING',
        createTime: '2026-05-31T09:00:00',
        version: 1,
      },
    ]));
  }

  if (path === '/bigscreen/stats') {
    return fulfill(route, {
      totalAssets: 128,
      inUseAssets: 96,
      idleAssets: 18,
      scrapAssets: 5,
      totalValue: 860000,
      netValue: 620000,
      pendingApprovals: 3,
      pendingWorkOrders: 2,
      inventoryProgress: 70,
      criticalAlerts: 1,
    });
  }

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

  if (path === '/categories/tree') {
    return fulfill(route, [
      { id: 1, categoryName: '电子设备', children: [] },
    ]);
  }

  if (path === '/retirement/statistics') {
    return fulfill(route, {
      thisMonthCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      completedCount: 0,
    });
  }

  if (path === '/retirement/list') {
    return fulfill(route, paged([]));
  }

  if (path === '/compensation') {
    return fulfill(route, paged([]));
  }

  if (path === '/workorders/1') {
    return fulfill(route, {
      workOrder: {
        id: 1,
        orderNo: 'WO-MODULE-001',
        title: '模块验收维修工单',
        description: '模块验收 smoke 使用的工单详情数据',
        status: 'APPROVING_LEVEL_1',
        priority: 'NORMAL',
        applicantName: '系统管理员',
        departmentName: '研发部',
        createdAt: '2026-05-31T09:00:00',
        version: 1,
      },
      approvalRecords: [
        {
          id: 1,
          approvalLevel: 'LEVEL_1',
          operatorName: '一级审批人',
          action: 'PENDING',
          comment: '等待审批',
          operatedAt: '2026-05-31T09:05:00',
        },
      ],
    });
  }

  if (path === '/workorders') {
    return fulfill(route, paged([
      {
        id: 1,
        orderNo: 'WO-MODULE-001',
        title: '模块验收维修工单',
        assetName: '模块验收笔记本',
        assetNo: 'AST-MODULE-001',
        applicantName: '系统管理员',
        createdAt: '2026-05-31T09:00:00',
        status: 'APPROVING_LEVEL_1',
        priority: 'NORMAL',
      },
    ]));
  }

  if (path.startsWith('/reports')) {
    if (reportsScenario === 'forbidden') {
      return fulfillError(route, 403, '权限不足，无法访问报表数据');
    }

    if (path === '/reports/summary') {
      return fulfill(route, reportsScenario === 'empty'
        ? { totalAssets: 0, activeAssets: 0, pendingApproval: 0, recentlyRetired: 0 }
        : { totalAssets: 128, activeAssets: 96, pendingApproval: 3, recentlyRetired: 4 });
    }

    if (path === '/reports/by-category') {
      return fulfill(route, reportsScenario === 'empty' ? [] : [
        { categoryName: '电子设备', assetCount: 64, totalValue: 420000 },
        { categoryName: '办公家具', assetCount: 24, totalValue: 90000 },
      ]);
    }

    if (path === '/reports/trend') {
      return fulfill(route, reportsScenario === 'empty' ? [] : [
        { month: '2026-04', assetCount: 120, totalValue: 780000 },
        { month: '2026-05', assetCount: 128, totalValue: 860000 },
      ]);
    }

    if (path === '/reports/depreciation-stats' || path === '/reports/maintenance-stats' || path === '/reports/retirement-stats') {
      return fulfill(route, reportsScenario === 'empty' ? [] : [
        { month: '4月', value: 12 },
        { month: '5月', value: 18 },
      ]);
    }
  }

  if (path === '/workorders/status-distribution' || path === '/workorders/dept-pending') {
    return fulfill(route, [
      { name: '待审批', value: 2 },
      { name: '已完成', value: 5 },
    ]);
  }

  if (path.startsWith('/assets')) {
    return fulfill(route, paged([
      {
        id: 1,
        assetNo: 'AST-MODULE-001',
        assetName: '模块验收笔记本',
        categoryName: '电子设备',
        brand: 'ThinkPad X1',
        deptId: 1,
        deptName: '研发部',
        userName: '系统管理员',
        location: 'A座',
        originalValue: 12000,
        currentValue: 8600,
        status: 'IN_USE',
      },
    ]));
  }

  if (path.startsWith('/depts')) {
    return fulfill(route, [{ id: 1, name: '研发部', deptName: '研发部', parentId: 0 }]);
  }

  if (path === '/inventory/tasks') {
    return fulfill(route, paged([]));
  }

  if (path === '/inventory/tasks/INV-001') {
    return fulfill(route, {
      task: inventoryTask,
      details: [],
    });
  }

  if (path === '/inventory/tasks/INV-001/assets') {
    return fulfill(route, paged(inventoryAssets));
  }

  if (path === '/inventory/tasks/INV-001/summary') {
    return fulfill(route, {
      surplusCount: 0,
      deficitCount: 0,
      surplusItems: [],
      deficitItems: [],
    });
  }

  if (path === '/inventory/tasks/INV-001/details') {
    return fulfill(route, []);
  }

  if (path === '/inventory/tasks/INV-001/assets/batch-confirm' && route.request().method() === 'POST') {
    inventoryAssets = inventoryAssets.map((asset) => ({ ...asset, confirmed: true, confirmedAt: '2026-05-30T10:00:00' }));
    return fulfill(route, null);
  }

  if (path === '/inventory/tasks/INV-001/submit' && route.request().method() === 'POST') {
    submitCount += 1;
    return fulfill(route, { submitCount });
  }

  if (path.includes('/inventory/tasks/') && path.endsWith('/details')) {
    return fulfill(route, []);
  }

  if (path.startsWith('/inventory/tasks')) {
    return fulfill(route, {});
  }

  if (path.startsWith('/locations')) {
    return fulfill(route, paged([{ id: 1, name: '总部库位', locationName: '总部库位', address: '研发中心 3F' }]));
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

async function fulfillError(route: Route, status: number, message: string) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ code: status, message, data: null }),
  });
}
