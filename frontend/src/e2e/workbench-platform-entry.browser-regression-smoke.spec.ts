import { expect, test, type Page, type Route } from '@playwright/test';

type SmokeUser = {
  userId: number;
  username: string;
  realName: string;
  roles: string[];
  permissions: string[];
};

const adminUser: SmokeUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['SUPER_ADMIN', 'ADMIN'],
  permissions: [],
};

const operationsUser: SmokeUser = {
  userId: 2,
  username: 'operator',
  realName: '运营专员',
  roles: ['USER'],
  permissions: [
    'dashboard:query',
    'approval:process:query',
    'report:query',
    'asset:ledger:query',
    'asset:query',
    'workorder:order:query',
    'inspection:query',
    'inventory:sparepart:query',
    'notification:query',
    'risk:matrix:query',
    'system:config:query',
  ],
};

const workbenchOnlyUser: SmokeUser = {
  userId: 3,
  username: 'workbench-readonly',
  realName: '工作台只读',
  roles: ['USER'],
  permissions: ['dashboard:query'],
};

const reportOnlyUser: SmokeUser = {
  userId: 4,
  username: 'report-only',
  realName: '报表只读',
  roles: ['USER'],
  permissions: ['report:query'],
};

test.describe('Workbench 正式入口浏览器回归', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
  });

  test('旧版仪表板侧边栏提升资产运营中枢并能进入正式 Workbench', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const operationsHub = page.getByRole('link', { name: '资产运营中枢' });
    const legacyDashboard = page.getByRole('link', { name: '旧版仪表板' });
    await expect(operationsHub).toBeVisible({ timeout: 10_000 });
    await expect(legacyDashboard).toBeVisible();

    await operationsHub.click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=home$/);
    await expect(page.getByText('固定资产平台', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '运营首页', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '流程待办', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '基础维护', exact: true })).toBeVisible();

    for (const tab of ['智能制造总览', '数据监控中心', '资产运维中心', '安全态势工作台']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    for (const duplicateMenu of ['报表大屏', '平台配置', '维保计划']) {
      await expect(page.getByRole('button', { name: duplicateMenu, exact: true })).toHaveCount(0);
    }

    await page.getByRole('button', { name: '旧版仪表板' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('Workbench 关键动作展示真实目标、预填上下文并进入业务页', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench?menu=todo');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: '流程待办', exact: true })).toHaveClass(/is-active/);
    await page.getByRole('button', { name: '查看流程待办' }).click();
    const todoDialog = page.getByRole('dialog', { name: '查看流程待办' });
    await expect(todoDialog).toBeVisible();
    await expect(todoDialog.getByText('/approvals?source=workbench&status=PENDING').first()).toBeVisible();
    await expect(todoDialog.getByText('预填字段')).toBeVisible();
    const todoPrimaryButton = todoDialog.getByRole('button', { name: /进入业务页面|进入处理/ });
    await expect(todoPrimaryButton).toBeEnabled();
    await todoPrimaryButton.click();
    await expect(page).toHaveURL(/\/approvals\?source=workbench&status=PENDING$/);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('Workbench 左侧菜单关键动作均展示真实目标和预填上下文', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    const actionCases = [
      {
        route: '/fixed-assets/workbench/assets?menu=asset',
        action: '查看资产清单',
        targetIncludes: ['/assets?source=workbench&view=asset-overview'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=device',
        action: '查看设备状态',
        targetIncludes: ['/equipment?source=workbench'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=orders',
        action: '查看预测工单',
        targetIncludes: ['/workorders/new?', 'source=quick-action', 'riskScore=92', 'priority=HIGH'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=inspection',
        action: '查看巡检计划',
        targetIncludes: ['/inspections/new?', 'source=quick-inspection', 'assetId=201'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=spares',
        action: '查看备件库存',
        targetIncludes: ['/spare-parts/new?', 'source=spare-request', 'partNo=SP-TEMP-201'],
      },
      {
        route: '/fixed-assets/workbench/analytics?menu=energy',
        action: '查看数据链路',
        targetIncludes: ['/energy?source=workbench&scope=data-monitoring'],
      },
      {
        route: '/fixed-assets/workbench/analytics?menu=report',
        action: '生成经营报表',
        targetIncludes: ['/reports?source=workbench&view=operations'],
      },
      {
        route: '/fixed-assets/workbench/security?menu=alarm',
        action: '查看告警队列',
        targetIncludes: ['/notifications?', 'source=quick-alert', 'severity='],
      },
      {
        route: '/fixed-assets/workbench/security?menu=policy',
        action: '查看策略规则',
        targetIncludes: ['/risk-matrix?source=workbench&scope=policy'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=settings',
        action: '打开基础维护',
        targetIncludes: ['/settings/sysconfig?source=workbench'],
      },
    ];

    for (const actionCase of actionCases) {
      await page.goto(actionCase.route);
      await page.waitForLoadState('networkidle');

      await page.locator('.workspace-context-action').filter({ hasText: actionCase.action }).click();
      const dialog = page.getByRole('dialog', { name: actionCase.action });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('预填字段')).toBeVisible();

      const routeTarget = await dialog.locator('.workspace-action-route strong').innerText();
      for (const expectedFragment of actionCase.targetIncludes) {
        expect(routeTarget).toContain(expectedFragment);
      }

      await expect(dialog.getByRole('button', { name: /进入业务页面|进入处理/ })).toBeEnabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('Workbench 菜单级产品页呈现业务操作台、CRUD 矩阵和页面级跳转', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    const pageCases = [
      {
        route: '/fixed-assets/workbench?menu=todo',
        pageLabel: '流程待办',
        heading: '审批与运维待办队列',
        action: '处理审批队列',
        targetIncludes: ['/approvals?source=workbench&status=PENDING'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=device',
        pageLabel: '设备管理',
        heading: '机台在线与温度监控',
        action: '打开设备台账',
        targetIncludes: ['/equipment?source=workbench&status=ONLINE'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=orders',
        pageLabel: '工单管理',
        heading: '预测维保工单闭环',
        action: '创建预测工单',
        targetIncludes: ['/workorders/new?', 'source=quick-action', 'riskScore=92'],
      },
      {
        route: '/fixed-assets/workbench/analytics?menu=report',
        pageLabel: '报表分析',
        heading: '经营分析与审计报表',
        action: '打开经营报表',
        targetIncludes: ['/reports?source=workbench&view=operations'],
      },
      {
        route: '/fixed-assets/workbench/assets?menu=asset',
        pageLabel: '资产总览',
        heading: '资产健康与生命周期总览',
        action: '生成风险工单',
        targetIncludes: ['/workorders/new?', 'source=asset-risk', 'riskLevel='],
      },
    ];

    for (const pageCase of pageCases) {
      await page.goto(pageCase.route);
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: pageCase.heading })).toBeVisible();
      await expect(page.getByLabel(`${pageCase.pageLabel}业务操作台`)).toBeVisible();
      await expect(page.getByLabel(`${pageCase.pageLabel}筛选条件`)).toBeVisible();
      await expect(page.getByLabel(`${pageCase.pageLabel}可处理业务队列`)).toBeVisible();
      const crudMatrix = page.getByLabel(`${pageCase.pageLabel}CRUD操作矩阵`);
      await expect(crudMatrix.getByText('新建/发起')).toBeVisible();
      await expect(crudMatrix.getByText('查询/筛选')).toBeVisible();
      await expect(crudMatrix.getByText('打开详情')).toBeVisible();
      await expect(crudMatrix.getByText('编辑/维护')).toBeVisible();
      await expect(crudMatrix.locator('small').filter({ hasText: '危险操作' })).toBeVisible();
      await expect(crudMatrix.getByRole('button', { name: new RegExp(`${pageCase.pageLabel}停用|撤销|停用/撤销`) })).toBeDisabled();
      const stateMatrix = page.getByLabel(`${pageCase.pageLabel}页面状态矩阵`);
      await expect(stateMatrix.getByText('空态')).toBeVisible();
      await expect(stateMatrix.getByText('异常态')).toBeVisible();
      await expect(stateMatrix.getByText('无权限态')).toBeVisible();

      await page.getByLabel(`${pageCase.pageLabel}页面跳转`).getByRole('button', { name: new RegExp(pageCase.action) }).click();
      const dialog = page.getByRole('dialog', { name: pageCase.action });
      await expect(dialog).toBeVisible();
      const routeTarget = await dialog.locator('.workspace-action-route strong').innerText();
      for (const expectedFragment of pageCase.targetIncludes) {
        expect(routeTarget).toContain(expectedFragment);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('Workbench 抽屉对缺少业务权限的目标给出禁用反馈', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, workbenchOnlyUser);

    await page.goto('/fixed-assets/workbench/analytics?menu=report');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '生成经营报表' }).click();
    const reportDialog = page.getByRole('dialog', { name: '生成经营报表' });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.getByText('/reports?source=workbench&view=operations').first()).toBeVisible();
    await expect(reportDialog.getByRole('status')).toContainText('当前账号缺少访问该业务页面的权限');
    await expect(reportDialog.getByRole('button', { name: /暂无权限/ })).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('缺少 Workbench 权限时受保护正式入口不渲染平台壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, reportOnlyUser);

    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '无访问权限' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '运营首页' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

async function seedAuthenticatedSession(page: Page, user: SmokeUser) {
  await page.addInitScript(({ nextUser }) => {
    window.localStorage.setItem('auth_token', 'workbench-platform-entry-smoke-token');
    window.localStorage.setItem('user_info', JSON.stringify(nextUser));
    window.sessionStorage.setItem('auth_token', 'workbench-platform-entry-smoke-token');
    window.sessionStorage.setItem('user_info', JSON.stringify(nextUser));
  }, { nextUser: user });
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

  if (path === '/menus/current') {
    return fulfill(route, {
      menus: [],
      permissions: operationsUser.permissions,
      roles: operationsUser.roles,
    });
  }

  if (path === '/dashboard/stats') {
    return fulfill(route, {
      totalAssets: 6842,
      inUseAssets: 5102,
      idleAssets: 268,
      maintenanceAssets: 97,
      scrapAssets: 21,
      totalValue: 48600000,
      netValue: 38200000,
      categoryDistribution: { 生产设备: 43, IT设备: 27, 安防设备: 18, 办公设备: 12 },
      pendingApprovals: 9,
      overdueMaintenance: 4,
    });
  }

  if (path === '/dashboard/trends') {
    return fulfill(route, [
      { date: '2026-01', totalValue: 45000000, netValue: 37100000 },
      { date: '2026-02', totalValue: 45800000, netValue: 37400000 },
      { date: '2026-03', totalValue: 46600000, netValue: 37700000 },
      { date: '2026-04', totalValue: 47600000, netValue: 38100000 },
      { date: '2026-05', totalValue: 48600000, netValue: 38200000 },
    ]);
  }

  if (path === '/dashboard/dept-distribution') {
    return fulfill(route, [
      { deptId: 1, deptName: 'A 厂区', assetCount: 2840, totalValue: 21000000 },
      { deptId: 2, deptName: 'B 厂区', assetCount: 1935, totalValue: 14800000 },
      { deptId: 3, deptName: '研发中心', assetCount: 1120, totalValue: 9600000 },
    ]);
  }

  if (path === '/dashboard/maintenance-stats') {
    return fulfill(route, {
      totalMaintenanceCount: 36,
      upcomingCount: 12,
      overdueCount: 4,
      avgMaintenanceCost: 1280,
      monthlyMaintenanceCount: 8,
      alerts: [
        { id: 1, assetName: 'AOI 光学检测仪', level: 'warning', message: '维保即将到期' },
      ],
    });
  }

  if (path === '/dashboard/pending-approvals') {
    return fulfill(route, 9);
  }

  if (path.startsWith('/approvals')) {
    return fulfill(route, paged([
      { id: 1, processNo: 'APR-WB-001', processType: '工单审批', status: 'PENDING', applicantName: '运营专员' },
    ]));
  }

  if (path.startsWith('/workorders')) {
    return fulfill(route, paged([
      { id: 1, orderNo: 'WO-WB-001', title: '预测性保养工单', status: 'PENDING', priority: 'HIGH' },
    ]));
  }

  if (path.startsWith('/notifications')) {
    return fulfill(route, paged([]));
  }

  return fulfill(route, paged([]));
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
