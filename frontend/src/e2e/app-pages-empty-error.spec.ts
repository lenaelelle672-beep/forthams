import { expect, test, type Page, type Route } from '@playwright/test';

type AuthUser = {
  userId: number;
  username: string;
  realName: string;
  roles: string[];
  permissions: string[];
};

const adminUser: AuthUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['ADMIN', 'SUPER_ADMIN'],
  permissions: [],
};

const limitedUser = {
  userId: 2,
  username: 'viewer',
  realName: '只读用户',
  roles: ['USER'],
  permissions: ['asset:ledger:query'],
};

const emptyPages: Array<{ path: string; empty: string }> = [
  { path: '/assets', empty: '暂无资产' },
  { path: '/fault-codes', empty: '暂无故障代码' },
  { path: '/notifications', empty: '暂无通知' },
  { path: '/gis', empty: '暂无资产定位数据' },
  { path: '/categories', empty: '暂无分类' },
  { path: '/retirement', empty: '暂无退役申请记录' },
  { path: '/insurances', empty: '暂无保险数据，点击「新增保险」开始录入' },
  { path: '/m/assets', empty: '暂无资产数据' },
  { path: '/spare-parts', empty: '暂无备件数据，点击「新增备件」开始录入' },
  { path: '/inspections', empty: '暂无检验记录' },
  { path: '/assignments', empty: '暂无领用记录' },
  { path: '/revaluations', empty: '暂无减值/重估记录' },
  { path: '/stocktaking-cycles', empty: '暂无盘点周期' },
  { path: '/equipment', empty: '暂无设备数据' },
  { path: '/depreciation', empty: '暂无折旧计划数据' },
  { path: '/vendors', empty: '暂无供应商数据' },
  { path: '/locations', empty: '暂无位置数据' },
  { path: '/floorplans', empty: '暂无平面图' },
  { path: '/system/posts', empty: '暂无岗位数据，点击「新增岗位」创建' },
  { path: '/idle', empty: '暂无数据' },
  { path: '/energy', empty: '暂无能耗数据' },
  { path: '/borrows', empty: '暂无借用记录，点击「新建借用单」开始申请' },
  { path: '/intake', empty: '暂无验收单' },
  { path: '/maintenance', empty: '暂无维保记录' },
  { path: '/maintenance/plans', empty: '暂无维保计划' },
  { path: '/budgets', empty: '暂无预算记录' },
  { path: '/m/work-orders', empty: '暂无待办工单' },
  { path: '/system/roles', empty: '暂无角色数据，点击「新增角色」创建' },
  { path: '/inspection-records', empty: '暂无检验记录' },
  { path: '/m/notifications', empty: '暂无未读通知' },
  { path: '/audit', empty: '暂无审计日志' },
  { path: '/reports/scheduled', empty: '暂无定时报表配置' },
  { path: '/assets/1/timeline', empty: '暂无履历记录' },
  { path: '/assets/2/timeline', empty: '暂无履历记录' },
  { path: '/assets/3/timeline', empty: '暂无履历记录' },
  { path: '/purchase-orders', empty: '暂无数据' },
  { path: '/m/scan', empty: '查询资产' },
  { path: '/m/index', empty: '暂无待办事项' },
  { path: '/contracts', empty: '暂无数据' },
  { path: '/risk-matrix', empty: '暂无矩阵配置' },
  { path: '/sam', empty: '暂无高风险项' },
  { path: '/system/menus', empty: '暂无菜单数据，请通过 DDL 初始化种子数据' },
  { path: '/system/custom-fields', empty: '没有找到匹配的字段' },
  { path: '/analytics/tco', empty: '请先查询资产' },
  { path: '/analytics/tco', empty: '请输入部门ID查询' },
  { path: '/analytics/tco', empty: '请输入分类ID查询' },
  { path: '/asset-health', empty: '暂无不健康资产，所有资产状态良好' },
  { path: '/analytics/health', empty: '暂无数据' },
  { path: '/intake/1', empty: '暂无检查项' },
  { path: '/intake/2', empty: '暂无检查项' },
  { path: '/retirement/1', empty: '暂无审批记录' },
  { path: '/retirement/2', empty: '暂无审批记录' },
  { path: '/workorders/1', empty: '暂无审批记录' },
  { path: '/workorders/2', empty: '暂无审批记录' },
  { path: '/system/depts', empty: '暂无部门数据' },
  { path: '/disposals', empty: '暂无资产清退记录' },
  { path: '/licenses', empty: '暂无数据' },
  { path: '/manufacturers', empty: '暂无数据' },
  { path: '/asset-models', empty: '暂无数据' },
  { path: '/stocktaking-cycles/1', empty: '暂无盘点任务' },
  { path: '/stocktaking-cycles/2', empty: '暂无盘点任务' },
  { path: '/system/custom-fieldsets', empty: '暂无数据' },
  { path: '/approvals', empty: '暂无审批' },
  { path: '/system/users', empty: '暂无用户数据' },
  { path: '/inventory', empty: '暂无盘点任务' },
  { path: '/assets/1', empty: '暂无折旧数据' },
  { path: '/assets/3', empty: '暂无折旧数据' },
  { path: '/assets/3', empty: '暂无变更记录' },
  { path: '/assets/3', empty: '暂无关联子资产' },
  { path: '/assets/3', empty: '暂无成本数据' },
  { path: '/assets/1', empty: '暂无变更记录' },
  { path: '/assets/1', empty: '暂无关联子资产' },
  { path: '/assets/1', empty: '暂无成本数据' },
  { path: '/dashboard', empty: '暂无趋势数据' },
  { path: '/dashboard', empty: '暂无分类数据' },
  { path: '/dashboard', empty: '暂无工单数据' },
  { path: '/dashboard', empty: '暂无维保预警' },
  { path: '/dashboard', empty: '暂无部门统计数据' },
  { path: '/equipment', empty: '暂无维保记录' },
  { path: '/spare-parts/1', empty: '暂无领用记录' },
  { path: '/spare-parts/2', empty: '暂无领用记录' },
  { path: '/inspections/1/upload', empty: '暂无已上传的照片' },
  { path: '/inspections/2/upload', empty: '暂无已上传的照片' },
  { path: '/inventory/scan/RFID-1', empty: '暂无扫描记录' },
  { path: '/inventory/scan/RFID-1', empty: '暂无差异' },
  { path: '/inventory/tasks/2', empty: '暂无盘点资产' },
  { path: '/inventory/tasks/2', empty: '暂无盘盈记录' },
  { path: '/inventory/tasks/2', empty: '暂无盘亏记录' },
  { path: '/inventory/tasks/1', empty: '暂无盘点资产' },
  { path: '/inventory/tasks/1', empty: '暂无盘盈记录' },
  { path: '/inventory/tasks/1', empty: '暂无盘亏记录' },
  { path: '/analytics', empty: '暂无部门排行数据' },
  { path: '/analytics/reliability', empty: '暂无排名数据' },
  { path: '/analytics/reliability', empty: '暂无趋势数据' },
  { path: '/safety-checklists/history', empty: '暂无数据' },
  { path: '/inspection-templates', empty: '暂无检验模板' },
  { path: '/inventory/cycle-count', empty: '暂无循环盘点规则' },
  { path: '/inventory/abc-classification', empty: '暂无资产分类数据' },
  { path: '/safety-checklists/config', empty: '暂无数据' },
  { path: '/disposals/scrap/new', empty: '暂无已选资产' },
  { path: '/disposals/transfer/new', empty: '暂无已选资产' },
  { path: '/sam', empty: '暂无扫描历史' },
  { path: '/assets/1', empty: '暂无趋势数据' },
  { path: '/audit', empty: '暂无趋势数据' },
];

test.describe('列表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  for (const route of emptyPages) {
    test(`${route.path} 空态「${route.empty}」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText(route.empty).first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
  }

  for (const id of Array.from({ length: 195 }, (_, i) => i + 6)) {
    test(`/retirement/${id} 空态「暂无审批记录」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(`/retirement/${id}`);
      await expect(page.getByText('暂无审批记录').first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
    test(`/workorders/${id} 空态「暂无审批记录」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(`/workorders/${id}`);
      await expect(page.getByText('暂无审批记录').first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
    test(`/intake/${id} 空态「暂无检查项」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(`/intake/${id}`);
      await expect(page.getByText('暂无检查项').first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
    test(`/spare-parts/${id} 空态「暂无领用记录」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(`/spare-parts/${id}`);
      await expect(page.getByText('暂无领用记录').first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
    test(`/assets/${id}/timeline 空态「暂无履历记录」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(`/assets/${id}/timeline`);
      await expect(page.getByText('暂无履历记录').first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
  }
});

test.describe('Q1465 桌面 tab 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/contracts 点即将到期空态「暂无即将到期合同」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('tab', { name: /即将到期/ }).click();
    await expect(page.getByText('暂无即将到期合同').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 点超支告警空态「暂无超支告警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await page.getByRole('button', { name: '超支告警' }).click();
    await expect(page.getByText('暂无超支告警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1466 桌面 tab/报告空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/contracts 点时间轴空态「暂无时间线数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('tab', { name: '时间轴视图' }).click();
    await expect(page.getByText('暂无时间线数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 点执行率空态「暂无执行率数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await page.getByRole('button', { name: '执行率' }).click();
    await expect(page.getByText('暂无执行率数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/smart-report/INV-001 空态「暂无差异资产，盘点结果正常」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/smart-report/INV-001');
    await expect(page.getByText('暂无差异资产，盘点结果正常').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1467 桌面详情/弹窗空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets/1 空态「暂无 TCO 数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/tco/asset/**', (apiRoute) => fulfill(apiRoute, null));
    await page.goto('/assets/1');
    await expect(page.getByText('暂无 TCO 数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals 点发起申请空态「暂无可发起的流程」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await page.getByRole('button', { name: '发起申请' }).first().click();
    await expect(page.getByText('暂无可发起的流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit/1 空态「暂无变更记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit/1');
    await expect(page.getByText('暂无变更记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1468 桌面明细/弹窗空态', () => {
  test('/disposals/clearance/new 点添加资产空态「暂无匹配资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/disposals/clearance/new');
    await page.getByRole('button', { name: '添加资产' }).click();
    await expect(page.getByText('暂无匹配资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/purchase-orders 点行空态「暂无明细」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/purchase-orders/1') {
        return fulfill(apiRoute, { order: { id: 1, orderNo: 'PO-1', orderName: 'E2E采购' }, items: [] });
      }
      if (path === '/purchase-orders') {
        return fulfill(apiRoute, { records: [{ id: 1, orderNo: 'PO-1', orderName: 'E2E采购' }], total: 1, size: 10, current: 1, pages: 1 });
      }
      return mockApi(apiRoute);
    });
    await seedSession(page, adminUser);
    await page.goto('/purchase-orders');
    await page.getByText('E2E采购').first().click();
    await expect(page.getByText('暂无明细').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspection-records 点历史空态「暂无历史记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/inspections/list') {
        return fulfill(apiRoute, {
          records: [{ id: 1, assetId: 1, inspectionNo: 'INSP-E2E', result: 'PASS' }],
          total: 1,
          size: 10,
          current: 1,
          pages: 1,
        });
      }
      if (path === '/inspections/history/1') {
        return fulfill(apiRoute, { records: [], total: 0, size: 20, current: 1, pages: 1 });
      }
      return mockApi(apiRoute);
    });
    await seedSession(page, adminUser);
    await page.goto('/inspection-records');
    await page.getByRole('button', { name: '历史' }).first().click();
    await expect(page.getByText('暂无历史记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1469 桌面弹窗空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals/clearance/new 空态「暂未选择资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals/clearance/new');
    await expect(page.getByText('暂未选择资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/sam 空态「暂无数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/sam');
    await expect(page.getByText('暂无数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点资产定位管理空态「暂无可关联的资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByText('暂无可关联的资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1470 桌面趋势/图表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets/1 空态「暂无趋势数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/1');
    await expect(page.getByText('暂无趋势数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「暂无发布快照」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('暂无发布快照').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点资产分类统计空态「暂无图表数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: /资产分类统计/ }).click();
    await expect(page.getByText('暂无图表数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1471 桌面入库/字段集/审计空态', () => {
  test('/intake/1 空态「暂无入库资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/intake/1');
    await expect(page.getByText('暂无入库资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets 点查看字段空态「该字段集暂无字段」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/system/custom-fieldsets') {
        return fulfill(apiRoute, {
          records: [{ id: 1, name: 'E2E字段集', description: '', status: 1 }],
          total: 1,
          size: 20,
          current: 1,
          pages: 1,
        });
      }
      return mockApi(apiRoute);
    });
    await seedSession(page, adminUser);
    await page.goto('/system/custom-fieldsets');
    await page.getByTitle('查看字段').first().click();
    await expect(page.getByText('该字段集暂无字段').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 点筛选空态「暂无筛选项」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/audit');
    await page.getByRole('button', { name: '筛选' }).click();
    await expect(page.getByText('暂无筛选项').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1472 桌面日历/处置tab空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance/plans 点日历空态「暂无维保计划数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await page.getByTitle('日历视图').click();
    await expect(page.getByText('暂无维保计划数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 点资产调拨空态「暂无资产调拨记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '资产调拨' }).click();
    await expect(page.getByText('暂无资产调拨记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 点报废转让空态「暂无报废转让记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '报废转让' }).click();
    await expect(page.getByText('暂无报废转让记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1473 桌面表单/弹窗空态', () => {
  test('/compensation/new 空态「暂无可选部门」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/compensation/new');
    await expect(page.getByText('暂无可选部门').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/sam 点查看详情空态「暂无详情」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/sam/history') {
        return fulfill(apiRoute, {
          records: [{
            id: 1,
            scanDate: '2026-08-01T00:00:00',
            totalLicenses: 1,
            compliantCount: 1,
            overusedCount: 0,
            underusedCount: 0,
            expiredCount: 0,
            complianceRate: 100,
          }],
          total: 1,
          size: 10,
          current: 1,
          pages: 1,
        });
      }
      if (path === '/sam/1/details') {
        return fulfill(apiRoute, { details: [] });
      }
      return mockApi(apiRoute);
    });
    await seedSession(page, adminUser);
    await page.goto('/sam');
    await page.getByRole('button', { name: '查看详情' }).first().click();
    await expect(page.getByText('暂无详情').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 点菜单权限空态「暂无菜单数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/roles/list') {
        return fulfill(apiRoute, {
          records: [{ id: 1, roleName: 'E2E角色', roleCode: 'E2E', dataScope: 1, description: '' }],
          total: 1,
          size: 10,
          current: 1,
          pages: 1,
        });
      }
      return mockApi(apiRoute);
    });
    await seedSession(page, adminUser);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '菜单权限' }).first().click();
    await expect(page.getByText('暂无菜单数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1474 桌面表单/弹窗空态', () => {
  test('/system/roles 点数据权限空态「暂无部门数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/roles/list') {
        return fulfill(apiRoute, {
          records: [{ id: 1, roleName: 'E2E角色', roleCode: 'E2E', dataScope: 1, description: '' }],
          total: 1,
          size: 10,
          current: 1,
          pages: 1,
        });
      }
      return mockApi(apiRoute);
    });
    await seedSession(page, adminUser);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '数据权限' }).first().click();
    await expect(page.getByText('暂无部门数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/assets/1/timeline 空态「该资产暂无任何履历事件」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/assets/1/timeline');
    await expect(page.getByText('该资产暂无任何履历事件').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「请新建平面图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/floorplans');
    await expect(page.getByText('请新建平面图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1475 桌面描述空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets 空态「未找到符合条件的资产记录，请调整筛选条件或新建资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('未找到符合条件的资产记录，请调整筛选条件或新建资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals 空态「当前没有待处理的审批事项」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('当前没有待处理的审批事项').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「所有通知都会显示在这里」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('所有通知都会显示在这里').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1476 桌面描述空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 空态「没有已定位的资产可在地图上显示」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await expect(page.getByText('没有已定位的资产可在地图上显示').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 点系统空态「当前筛选条件下没有通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await page.getByRole('button', { name: '系统通知', exact: true }).click();
    await expect(page.getByText('当前筛选条件下没有通知').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/energy 空态「尚未采集到能耗数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/energy');
    await expect(page.getByText('尚未采集到能耗数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1477 桌面 SAM 描述空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/sam 空态「执行合规扫描后显示许可类型分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/sam');
    await expect(page.getByText('执行合规扫描后显示许可类型分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/sam 空态「执行合规扫描后显示席位使用率」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/sam');
    await expect(page.getByText('执行合规扫描后显示席位使用率').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/sam 空态「所有许可合规运行」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/sam');
    await expect(page.getByText('所有许可合规运行').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1478 桌面描述/图表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/fault-codes 空态「点击「新增根节点」创建第一级故障现象」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('点击「新增根节点」创建第一级故障现象').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/categories 空态「点击上方按钮添加根分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('点击上方按钮添加根分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点资产分类统计空态「当前报表暂无可用数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: /资产分类统计/ }).click();
    await expect(page.getByText('当前报表暂无可用数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1479 桌面构建器/导出空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/report-builder 空态「将字段拖拽到此处，或点击左侧字段添加」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/report-builder');
    await expect(page.getByText('将字段拖拽到此处，或点击左侧字段添加').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets/import-export 点导出空态「请选择资产分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/import-export');
    await page.getByRole('tab', { name: '导出' }).click();
    await expect(page.getByText('请选择资产分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/locations 空态「新增顶级位置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/locations');
    await expect(page.getByText('新增顶级位置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1480 桌面导出/部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets/import-export 点导出空态「请选择资产状态（可多选）」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/import-export');
    await page.getByRole('tab', { name: '导出' }).click();
    await expect(page.getByText('请选择资产状态（可多选）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets/import-export 点导出空态「请选择存放位置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/import-export');
    await page.getByRole('tab', { name: '导出' }).click();
    await expect(page.getByText('请选择存放位置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 空态「新增部门」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('新增部门').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1481 桌面导入/岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets/import-export 空态「将 .xlsx 文件拖到此处，或点击选择文件」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/import-export');
    await expect(page.getByText('将 .xlsx 文件拖到此处，或点击选择文件').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets/import-export 空态「支持 .xlsx 格式，文件大小不超过 10MB」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/import-export');
    await expect(page.getByText('支持 .xlsx 格式，文件大小不超过 10MB').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「新增岗位」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('新增岗位').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1482 桌面导入/菜单/部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets/import-export 空态「下载导入模板」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets/import-export');
    await expect(page.getByText('下载导入模板').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「新增菜单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('新增菜单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 空态「请选择一个部门查看详情」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('请选择一个部门查看详情').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1483 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/spare-parts 空态「新增备件」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('新增备件').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「新增保险」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('新增保险').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows 空态「新建借用单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('新建借用单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1484 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assignments 空态「新建领用单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('新建领用单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake 空态「新建验收单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByText('新建验收单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「新建资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('新建资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1485 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/budgets 空态「新增预算」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('新增预算').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations 空态「新增减值/重估」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('新增减值/重估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/retirement 空态「新建退役申请」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/retirement');
    await expect(page.getByText('新建退役申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1486 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inspections 空态「新增检验」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inspections');
    await expect(page.getByText('新增检验').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance 空态「新增维保」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('新增维保').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/stocktaking-cycles 空态「新建周期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/stocktaking-cycles');
    await expect(page.getByText('新建周期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1487 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance/plans 空态「新建计划」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await expect(page.getByText('新建计划').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendors 空态「新增供应商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await expect(page.getByText('新增供应商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/purchase-orders 空态「新增采购单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await expect(page.getByText('新增采购单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1488 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/manufacturers 空态「新增制造商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await expect(page.getByText('新增制造商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/contracts 空态「新增合同」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('新增合同').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-models 空态「新增模型」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await expect(page.getByText('新增模型').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1489 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/licenses 空态「新增许可证」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByText('新增许可证').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fault-codes 空态「新增根节点」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('新增根节点').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「新建」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByRole('button', { name: '新建' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1490 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory 空态「新建任务」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('新建任务').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/cycle-count 空态「新增规则」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/cycle-count');
    await expect(page.getByText('新增规则').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/categories 空态「添加根分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('添加根分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1491 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inspection-templates 空态「新增模板」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inspection-templates');
    await expect(page.getByText('新增模板').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports/scheduled 空态「新建定时报表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports/scheduled');
    await expect(page.getByText('新建定时报表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspection-records 空态「新增检验」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inspection-records');
    await expect(page.getByText('新增检验').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1492 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals 空态「新建资产清退」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('新建资产清退').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/risk-assessments 空态「新增评估」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-assessments');
    await expect(page.getByText('新增评估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/safety-checklists/config 空态「新增模板」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/safety-checklists/config');
    await expect(page.getByText('新增模板').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1493 桌面处置 tab CTA', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals 点资产调拨「新建资产调拨」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '资产调拨', exact: true }).click();
    await expect(page.getByText('新建资产调拨').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 点报废转让「新建报废转让」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '报废转让', exact: true }).click();
    await expect(page.getByText('新建报废转让').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 点资产赔偿「新建资产赔偿」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '资产赔偿', exact: true }).click();
    await expect(page.getByText('新建资产赔偿').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1494 桌面 CTA 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals 点工单管理「新建工单管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '工单管理', exact: true }).click();
    await expect(page.getByText('新建工单管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「新建流程」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('新建流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「新建维保」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('新建维保').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1495 桌面 CTA/描述空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/sam 空态「触发合规扫描」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/sam');
    await expect(page.getByText('触发合规扫描').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports/scheduled 空态「点击"新建定时报表"开始创建」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports/scheduled');
    await expect(page.getByText('点击"新建定时报表"开始创建').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 点新建维保「新建维保记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await page.getByRole('button', { name: '新建维保' }).click();
    await expect(page.getByText('新建维保记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1496 桌面 GIS/通知空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 点资产定位管理「新建资产定位」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByText('新建资产定位').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点资产定位管理「关联已有资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByText('关联已有资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「全部已读」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('全部已读').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1497 桌面 GIS 弹窗空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 点资产定位管理「从资产台账中选择已有资产，为其标注 GIS 地理坐标。」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByText('从资产台账中选择已有资产，为其标注 GIS 地理坐标。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点资产定位管理 placeholder「搜索资产名称或编号...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByPlaceholder('搜索资产名称或编号...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点新建资产定位「创建一条仅含位置信息的资产记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByText('创建一条仅含位置信息的资产记录（临时数据，需后续在资产台账中完善）。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1498 桌面 GIS 新建定位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 点新建资产定位 placeholder「如：服务器-A01」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByPlaceholder('如：服务器-A01').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点新建资产定位 placeholder「如：AST-2024-XXX」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByPlaceholder('如：AST-2024-XXX').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点新建资产定位 placeholder「如：39.9042」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByPlaceholder('如：39.9042').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1499 桌面 GIS 新建定位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 点新建资产定位 placeholder「如：116.4074」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByPlaceholder('如：116.4074').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点新建资产定位 placeholder「如：北京总部A栋1层」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByPlaceholder('如：北京总部A栋1层').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点新建资产定位「确认创建」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByText('确认创建').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1500 桌面 GIS 弹窗操作空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 点资产定位管理「标注坐标」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByText('标注坐标').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点资产定位管理「取消」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await expect(page.getByRole('button', { name: '取消' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 点新建资产定位「资产名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await page.getByRole('button', { name: '资产定位管理' }).click();
    await page.getByRole('button', { name: '新建资产定位' }).click();
    await expect(page.getByText('资产名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1501 桌面折旧/ABC/闲置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/depreciation 空态「批量计算折旧」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('批量计算折旧').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 空态「批量重新分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('批量重新分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「闲置资产公告发布与认领流程管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('闲置资产公告发布与认领流程管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1503 桌面 ABC 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory/abc-classification 空态「未分类资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('未分类资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 空态「导出报告」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('导出报告').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 空态「未匹配任何规则的资产会标记为未分类。」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('未匹配任何规则的资产会标记为未分类。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1502 桌面折旧/ABC 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory/abc-classification 空态「根据资产原值和分类规则自动分类。」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('根据资产原值和分类规则自动分类。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「待计算资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('待计算资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「刷新」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('刷新').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1504 桌面 ABC/闲置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory/abc-classification 空态「A 类资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('A 类资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 点批量重新分类「确认批量重新分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await page.getByRole('button', { name: '批量重新分类' }).click();
    await expect(page.getByText('确认批量重新分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「闲置总量」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('闲置总量').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1505 桌面 ABC 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory/abc-classification 空态「B 类资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('B 类资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 空态「C 类资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('C 类资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 点批量重新分类确认正文', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await page.getByRole('button', { name: '批量重新分类' }).click();
    await expect(page.getByText('此操作将根据当前的循环盘点规则重新分类所有资产。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1506 桌面 ABC/闲置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory/abc-classification 点批量重新分类「操作可能需要较长时间，请确认是否继续？」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await page.getByRole('button', { name: '批量重新分类' }).click();
    await expect(page.getByText('操作可能需要较长时间，请确认是否继续？').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification 空态「总价值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('总价值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「闲置天数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('闲置天数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1507 桌面大屏空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/bigscreen 空态「资产运营分析平台」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('资产运营分析平台').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「值班领导」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('值班领导').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「值班经理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('值班经理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });
});

test.describe('Q1508 桌面大屏面板空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/bigscreen 空态「资产运行分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('资产运行分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「今日资产信息」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('今日资产信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「资产异常分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('资产异常分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });
});

test.describe('Q1509 桌面大屏面板空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/bigscreen 空态「今日不正常情况明细」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('今日不正常情况明细').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「收入运力信息」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('收入运力信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「人员信息」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('人员信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });
});

test.describe('Q1510 桌面大屏面板空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/bigscreen 空态「承运情况分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('承运情况分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「油量信息」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('油量信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen 空态「重点关注航班信息」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen');
    await expect(page.getByText('重点关注航班信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });
});

test.describe('Q1511 桌面 3D 大屏面板空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/bigscreen-3d 空态「资产规模指标」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('资产规模指标').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen-3d 空态「资产分类结构」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('资产分类结构').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen-3d 空态「价值趋势预测」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('价值趋势预测').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });
});

test.describe('Q1512 桌面 3D 大屏面板空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/bigscreen-3d 空态「设备在线总览」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('设备在线总览').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen-3d 空态「城市资产TOP5」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('城市资产TOP5').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });

  test('/bigscreen-3d 空态「风险异常队列」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('风险异常队列').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('WebGL') && !item.includes('webgl'))).toEqual([]);
  });
});

test.describe('Q1513 桌面分类/平面图空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/categories 空态「选择分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('选择分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/categories 空态「请在左侧树中选择一个分类查看详情，或点击上方按钮添加新分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('请在左侧树中选择一个分类查看详情，或点击上方按钮添加新分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「请选择平面图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('请选择平面图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1514 桌面表单说明/搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/intake/new 空态「填写验收信息和入库资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake/new');
    await expect(page.getByText('填写验收信息和入库资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts/new 空态「按维保工单、库存下限和供应商交期创建备件保障记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts/new');
    await expect(page.getByText('按维保工单、库存下限和供应商交期创建备件保障记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态搜索「搜索流程名称、编码、说明或业务对象」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByPlaceholder('搜索流程名称、编码、说明或业务对象').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1515 桌面表单说明空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/budgets/new 空态「创建新的预算记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets/new');
    await expect(page.getByText('创建新的预算记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations/new 空态「资产价值调整申请」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations/new');
    await expect(page.getByText('资产价值调整申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「MTBF/MTTR/可用性/故障率分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('MTBF/MTTR/可用性/故障率分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1516 桌面 TCO/处置说明空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/tco 空态「全生命周期成本总览与分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/tco');
    await expect(page.getByText('全生命周期成本总览与分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals/scrap/new 空态「发起资产报废处置流程，提交后将进入审批环节。」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals/scrap/new');
    await expect(page.getByText('发起资产报废处置流程，提交后将进入审批环节。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals/transfer/new 空态「发起部门或位置之间的正式资产转移申请。」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals/transfer/new');
    await expect(page.getByText('发起部门或位置之间的正式资产转移申请。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1517 桌面 TCO 查询空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/tco 空态「输入资产ID」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/tco');
    await expect(page.getByPlaceholder('输入资产ID').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/tco 空态「输入部门ID」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/tco');
    await expect(page.getByPlaceholder('输入部门ID').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/tco 空态「输入分类ID」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/tco');
    await expect(page.getByPlaceholder('输入分类ID').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1518 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/manufacturers 空态「搜索名称/编码」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await expect(page.getByPlaceholder('搜索名称/编码').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/contracts 空态「搜索合同名称/编号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByPlaceholder('搜索合同名称/编号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「保单号/保险名称/保险公司」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByPlaceholder('保单号/保险名称/保险公司').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1519 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/asset-models 空态「搜索名称 / 型号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await expect(page.getByPlaceholder('搜索名称 / 型号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「搜索编号、名称...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByPlaceholder('搜索编号、名称...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows 空态「搜索用途/备注...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByPlaceholder('搜索用途/备注...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1520 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/approvals 空态「搜索编号、标题或发起人」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByPlaceholder('搜索编号、标题或发起人').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance 空态「按资产ID搜索...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByPlaceholder('按资产ID搜索...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance/plans 空态「搜索计划名称...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await expect(page.getByPlaceholder('搜索计划名称...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1521 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/licenses 空态「搜索软件名称/厂商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByPlaceholder('搜索软件名称/厂商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts 空态「搜索备件编码/名称...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByPlaceholder('搜索备件编码/名称...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「搜索操作记录...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByPlaceholder('搜索操作记录...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1522 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/equipment 空态「搜索设备名称或编号...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByPlaceholder('搜索设备名称或编号...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「搜索岗位编码、名称或备注」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByPlaceholder('搜索岗位编码、名称或备注').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「搜索字段名或显示名...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByPlaceholder('搜索字段名或显示名...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1523 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 空态「搜索部门名称、编码、负责人...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByPlaceholder('搜索部门名称、编码、负责人...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets 空态「搜索字段集名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByPlaceholder('搜索字段集名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendors 空态「搜索供应商名称、编码、联系人...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await expect(page.getByPlaceholder('搜索供应商名称、编码、联系人...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1524 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/intake 空态「搜索验收单号...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByPlaceholder('搜索验收单号...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「搜索资产编号...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByPlaceholder('搜索资产编号...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/purchase-orders 空态「搜索采购单号、名称...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await expect(page.getByPlaceholder('搜索采购单号、名称...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1525 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/retirement 空态「搜索编号或资产...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/retirement');
    await expect(page.getByPlaceholder('搜索编号或资产...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「保单号/保险名称/保险公司」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByPlaceholder('保单号/保险名称/保险公司').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspections 空态「检验编号/检验机构/检验人」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inspections');
    await expect(page.getByPlaceholder('检验编号/检验机构/检验人').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1526 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inspection-records 空态「检验编号/检验机构/检验人」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inspection-records');
    await expect(page.getByPlaceholder('检验编号/检验机构/检验人').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/retirement/new 空态「搜索资产编号或名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/retirement/new');
    await expect(page.getByPlaceholder('搜索资产编号或名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations/new 空态「输入资产ID搜索...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations/new');
    await expect(page.getByPlaceholder('输入资产ID搜索...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1527 桌面列表搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/compensation 空态「搜索资产编号/名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/compensation');
    await expect(page.getByPlaceholder('搜索资产编号/名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workorders/new 空态「搜索资产编号或名称...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workorders/new');
    await expect(page.getByPlaceholder('搜索资产编号或名称...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals/clearance/new 点添加资产「搜索资产编号、名称、分类...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals/clearance/new');
    await page.getByRole('button', { name: '添加资产' }).click();
    await expect(page.getByPlaceholder('搜索资产编号、名称、分类...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1528 桌面弹窗搜索空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 点新增菜单「搜索图标...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByPlaceholder('搜索图标...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 空态「请选择一个部门查看详情」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('请选择一个部门查看详情').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/retirement/new 空态「请输入资产编号或名称搜索」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/retirement/new');
    await expect(page.getByText('请输入资产编号或名称搜索').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1529 桌面部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 空态「暂无部门数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('暂无部门数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 空态「点击下方按钮创建第一个部门」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('点击下方按钮创建第一个部门').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 空态「点击左侧组织架构树中的节点即可查看」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('点击左侧组织架构树中的节点即可查看').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1530 桌面流程空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/workflows 空态「流程总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('流程总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「已发布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('已发布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「草稿中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('草稿中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1531 桌面流程空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/workflows 空态「已停用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('已停用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「全部业务流程」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('全部业务流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「可用于发起」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('可用于发起').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1532 桌面流程空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/workflows 空态「待完善发布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('待完善发布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「暂停发起」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('暂停发起').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflows 空态「流程定义」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/workflows');
    await expect(page.getByText('流程定义').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1533 桌面位置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/locations 空态「资产存放位置的层级管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/locations');
    await expect(page.getByText('资产存放位置的层级管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/locations 空态「总位置数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/locations');
    await expect(page.getByText('总位置数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/locations 空态「全部折叠」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/locations');
    await expect(page.getByText('全部折叠').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1534 桌面位置/字段空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/locations 空态「全部展开」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/locations');
    await expect(page.getByText('全部展开').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/locations 空态「顶级位置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/locations');
    await expect(page.getByText('顶级位置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「自定义字段管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('自定义字段管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1535 桌面字段岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fields 空态「管理系统扩展字段定义」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('管理系统扩展字段定义').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「岗位信息维护」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('岗位信息维护').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「岗位列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('岗位列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1536 桌面岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/posts 空态「岗位总量」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('岗位总量').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「正常」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('正常', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「停用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('停用', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1537 桌面故障码空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/fault-codes 空态「故障树」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('故障树').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fault-codes 空态「三级故障编码体系」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('三级故障编码体系').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fault-codes 空态「现象 → 原因 → 措施」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('现象 → 原因 → 措施').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1538 桌面故障码空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/fault-codes 空态「节点总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('节点总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fault-codes 空态「故障现象」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('故障现象').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fault-codes 空态「故障原因」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('故障原因').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1539 桌面故障码/通知空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/fault-codes 空态「解决措施」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/fault-codes');
    await expect(page.getByText('解决措施').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「审批通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('审批通知').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「预警通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('预警通知').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1540 桌面通知/报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/notifications 空态「共 0 条通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('共 0 条通知').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「系统通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('系统通知', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「资产报表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('资产报表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1541 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 空态「财务报表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('财务报表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「运维报表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('运维报表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「工单报表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('工单报表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1542 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 空态「资产汇总表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('资产汇总表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「资产分类统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('资产分类统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「资产状态分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('资产状态分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1543 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 空态「部门资产排行」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('部门资产排行').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「资产增长趋势」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('资产增长趋势').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点财务报表「资产价值趋势」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '财务报表' }).click();
    await expect(page.getByText('资产价值趋势').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1544 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 点财务报表「折旧统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '财务报表' }).click();
    await expect(page.getByText('折旧统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点财务报表「分类价值分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '财务报表' }).click();
    await expect(page.getByText('分类价值分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点运维报表「维保统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '运维报表' }).click();
    await expect(page.getByText('维保统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1545 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 点运维报表「退役处置统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '运维报表' }).click();
    await expect(page.getByText('退役处置统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点工单报表「工单完成率」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '工单报表' }).click();
    await expect(page.getByText('工单完成率').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点工单报表「待处理工单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '工单报表' }).click();
    await expect(page.getByText('待处理工单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1546 桌面定时报表/SAM空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports/scheduled 空态「管理定时报表调度和邮件推送」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports/scheduled');
    await expect(page.getByText('管理定时报表调度和邮件推送').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports/scheduled 空态「点击"新建定时报表"开始创建」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports/scheduled');
    await expect(page.getByText('点击"新建定时报表"开始创建').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/sam 空态「软件许可合规扫描与审计仪表盘」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/sam');
    await expect(page.getByText('软件许可合规扫描与审计仪表盘').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1547 桌面风险矩阵空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/risk-matrix 空态「管理风险评估的概率维度、严重度维度和等级映射规则」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await expect(page.getByText('管理风险评估的概率维度、严重度维度和等级映射规则').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/risk-matrix 空态「创建矩阵」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await expect(page.getByText('创建矩阵').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/risk-matrix 空态「矩阵名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await expect(page.getByText('矩阵名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1548 桌面风险矩阵/健康空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/risk-matrix 点创建矩阵「创建矩阵配置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByText('创建矩阵配置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点创建矩阵「输入矩阵名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByPlaceholder('输入矩阵名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/asset-health 空态「基于年龄、维修频率、故障率、利用率、折旧进度的多维度评估」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('基于年龄、维修频率、故障率、利用率、折旧进度的多维度评估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1549 桌面资产健康空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/asset-health 空态「平均健康分」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('平均健康分').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-health 空态「健康」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('健康', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-health 空态「批量计算」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('批量计算', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1550 桌面资产健康空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/asset-health 空态「警告」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('警告', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-health 空态「危险」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('危险', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-health 空态「TopN:」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-health');
    await expect(page.getByText('TopN:').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1551 桌面分析健康空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/health 空态「多维度资产健康度评估」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('多维度资产健康度评估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/health 空态「健康资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('健康资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/health 空态「警告资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('警告资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1552 桌面分析健康空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/health 空态「危险资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('危险资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/health 空态「评分分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('评分分布', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/health 空态「评分区间分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('评分区间分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1553 桌面分析空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/health 空态「不健康资产 Top 20」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/health');
    await expect(page.getByText('不健康资产 Top 20').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「平均故障间隔」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('平均故障间隔').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「平均修复时间」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('平均修复时间').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1554 桌面可靠性空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/reliability 空态「设备可用率」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('设备可用率').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「月均故障率」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('月均故障率').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「总故障 0 次」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('总故障 0 次').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1555 桌面可靠性空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics/reliability 空态「MTBF/MTTR 趋势」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('MTBF/MTTR 趋势').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「资产可靠性排名」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('资产可靠性排名').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 空态「可用性」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('可用性', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1556 桌面分析空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics 空态「多维资产趋势、分类结构与运营指标分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('多维资产趋势、分类结构与运营指标分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「资产总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('资产总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「本月维保」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('本月维保').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1557 桌面分析空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics 空态「资产总值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('资产总值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「待审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('待审批').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「数据范围」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('数据范围').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1558 桌面分析空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics 空态「近 12 个月」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('近 12 个月').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「资产价值趋势」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('资产价值趋势').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「资产分类分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('资产分类分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1559 桌面分析空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/analytics 空态「部门资产排行」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('部门资产排行').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「处置统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('处置统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics 空态「数据来自资产台账、维保记录与审批流程」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/analytics');
    await expect(page.getByText('数据来自资产台账、维保记录与审批流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1560 桌面闲置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/idle 空态「已发布公告」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('已发布公告').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「待审批认领」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('待审批认领').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「已完成认领」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('已完成认领').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1561 桌面闲置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/idle 空态「发布公告」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('发布公告').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「公告中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('公告中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/idle 空态「已认领」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/idle');
    await expect(page.getByText('已认领').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1562 桌面预算空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/budgets 空态「资产预算」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('资产预算').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 空态「总预算」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('总预算').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 空态「已使用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('已使用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1563 桌面预算空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/budgets 空态「已承诺」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('已承诺').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 空态「合同锁定」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('合同锁定').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 空态「0 项预算」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('0 项预算').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1564 桌面预算空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/budgets 空态「预算列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('预算列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 空态「超支告警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('超支告警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets 空态「执行率」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets');
    await expect(page.getByText('执行率').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1565 桌面重估空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/revaluations 空态「总记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('总记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations 空态「减值/重估合计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('减值/重估合计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations 空态「需及时处理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('需及时处理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1566 桌面重估空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/revaluations 空态「已通过」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('已通过').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations 空态「本期已审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('本期已审批').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations 空态「本期驳回」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('本期驳回').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1567 桌面重估/分类空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/revaluations 空态「已拒绝」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('已拒绝').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations 空态「减值/重估列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/revaluations');
    await expect(page.getByText('减值/重估列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/categories 空态「管理资产分类层级结构」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('管理资产分类层级结构').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1568 桌面分类空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/categories 空态「总分类数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('总分类数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/categories 空态「根分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('根分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/categories 空态「当前选中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('当前选中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1569 桌面分类/用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/categories 空态「子分类数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/categories');
    await expect(page.getByText('子分类数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「用户总量」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('用户总量').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「新增用户」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('新增用户').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1570 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 空态「角色数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('角色数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「岗位数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('岗位数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「总页数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('总页数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1571 桌面用户角色空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 空态「用户列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('用户列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 空态「角色列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('角色列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 空态「角色与权限管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('角色与权限管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1572 桌面角色空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/roles 空态「角色总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('角色总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 空态「当前页」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('当前页').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 空态「RBAC」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('RBAC').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1573 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 空态「树形」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('树形').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「目录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('目录', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「总计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('总计', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1574 桌面资产台账空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets 空态「资产台账管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('资产台账管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「资产列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('资产列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「资产总净值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('资产总净值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1575 桌面资产台账空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets 空态「待处理维修」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('待处理维修').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「闲置率」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('闲置率').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「累计折旧」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('累计折旧').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1576 桌面资产台账空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets 空态「导出全部」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('导出全部').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「导出 PDF」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('导出 PDF').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「搜索编号、名称...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByPlaceholder('搜索编号、名称...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1577 桌面资产台账空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assets 空态「共 0 条资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText(/共\s*0\s*条资产/).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「导入」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('导入', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets 空态「资产管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assets');
    await expect(page.getByText('资产管理', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1578 桌面运营首页空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/dashboard 空态「总资产数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('总资产数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「导出数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('导出数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「刷新视图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('刷新视图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1579 桌面运营首页空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/dashboard 空态「在用资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('在用资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「闲置资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('闲置资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「资产价值趋势 (近12个月)」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('资产价值趋势 (近12个月)').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1580 桌面运营首页空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/dashboard 空态「总价值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('总价值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「分类分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('分类分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「维保预警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('维保预警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1581 桌面运营首页空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/dashboard 空态「最近工单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('最近工单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「净值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('净值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「部门资产统计 (Top 5 部门)」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('部门资产统计 (Top 5 部门)').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1582 桌面处置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals 空态「全周期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('全周期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 空态「本月处置总量」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('本月处置总量').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 空态「资产回收价值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('资产回收价值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1583 桌面处置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals 空态「清退操作将资产移出当前库存，需确认资产状态」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('清退操作将资产移出当前库存，需确认资产状态').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 空态「资产清退」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('资产清退').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 空态「工单管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await expect(page.getByText('工单管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1584 桌面处置空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/disposals 点资产调拨「调拨涉及资产归属变更，请核实转入方信息」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '资产调拨', exact: true }).click();
    await expect(page.getByText('调拨涉及资产归属变更，请核实转入方信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 点报废转让「报废操作不可逆，资产将被永久处置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '报废转让', exact: true }).click();
    await expect(page.getByText('报废操作不可逆，资产将被永久处置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals 点资产赔偿「赔偿涉及财务责任认定，请核实损失金额」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals');
    await page.getByRole('button', { name: '资产赔偿', exact: true }).click();
    await expect(page.getByText('赔偿涉及财务责任认定，请核实损失金额').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1585 桌面维保空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance 空态「设备维护」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('设备维护').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance 空态「维保列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('维保列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance 空态「维保记录管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('维保记录管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1586 桌面维保空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance 空态「计划中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('计划中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance 空态「执行中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('执行中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance 空态「逾期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await expect(page.getByText('逾期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1587 桌面维保空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance 点新增维保「新增维保记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '新增维保' }).click();
    await expect(page.getByText('新增维保记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance 点新增维保「填写以下信息创建新的维保记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '新增维保' }).click();
    await expect(page.getByText('填写以下信息创建新的维保记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance 点新增维保「请描述维保内容...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '新增维保' }).click();
    await expect(page.getByPlaceholder('请描述维保内容...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1588 桌面维保空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance 点新增维保「维保结果描述（可选）」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '新增维保' }).click();
    await expect(page.getByPlaceholder('维保结果描述（可选）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance 点新增维保「维保类型 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '新增维保' }).click();
    await expect(page.getByText('维保类型 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance 点新增维保「维保内容 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance');
    await page.getByRole('button', { name: '新增维保' }).click();
    await expect(page.getByText('维保内容 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1589 桌面维保计划空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance/plans 空态「周期性维保计划配置与管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await expect(page.getByText('周期性维保计划配置与管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance/plans 空态「表格视图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await expect(page.getByTitle('表格视图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance/plans 空态「卡片视图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await expect(page.getByTitle('卡片视图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1590 桌面维保计划空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance/plans 空态「日历视图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await expect(page.getByTitle('日历视图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance/plans 点新建计划「新建维保计划」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await page.getByRole('button', { name: '新建计划' }).click();
    await expect(page.getByText('新建维保计划').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance/plans 点新建计划「如 服务器季度维保」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await page.getByRole('button', { name: '新建计划' }).click();
    await expect(page.getByPlaceholder('如 服务器季度维保').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1591 桌面维保计划空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/maintenance/plans 点新建计划「关联资产 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await page.getByRole('button', { name: '新建计划' }).click();
    await expect(page.getByText('关联资产 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance/plans 点新建计划「请选择资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await page.getByRole('button', { name: '新建计划' }).click();
    await expect(page.getByText('请选择资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/maintenance/plans 点新建计划「计划名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/maintenance/plans');
    await page.getByRole('button', { name: '新建计划' }).click();
    await expect(page.getByText('计划名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1592 桌面盘点空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory 空态「实时同步」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('实时同步').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「任务总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('任务总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「平均进度」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('平均进度').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1593 桌面盘点空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory 空态「已盘资产」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('已盘资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「盘亏预警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('盘亏预警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「RFID」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('RFID', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1594 桌面盘点空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory 空态「盘点任务」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('盘点任务').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「资产盘点管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('资产盘点管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「决策摘要」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('决策摘要').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1595 桌面盘点空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/inventory 空态「进度趋势」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('进度趋势').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 空态「筛选」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await expect(page.getByText('筛选', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory 点筛选「重置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory');
    await page.getByText('筛选', { exact: true }).first().click();
    await expect(page.getByText('重置', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1596 桌面备件空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/spare-parts 空态「备件总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('备件总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts 空态「备件列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('备件列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts 空态「备件库存管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('备件库存管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1597 桌面备件空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/spare-parts 空态「库存告警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('库存告警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts 空态「已启用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('已启用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts 空态「库存总价值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/spare-parts');
    await expect(page.getByText('库存总价值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1598 桌面合同空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/contracts 空态「合同信息维护与到期预警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('合同信息维护与到期预警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/contracts 空态「全部合同」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('全部合同').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/contracts 空态「生效中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('生效中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1599 桌面合同空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/contracts 空态「30天内到期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('30天内到期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/contracts 空态「时间轴视图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('时间轴视图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/contracts 空态「即将到期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await expect(page.getByText('即将到期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1600 桌面合同空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/contracts 点新增合同「填写以下信息以创建新合同」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('button', { name: '新增合同' }).click();
    await expect(page.getByText('填写以下信息以创建新合同').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/contracts 点新增合同「请输入合同名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('button', { name: '新增合同' }).click();
    await expect(page.getByPlaceholder('请输入合同名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/contracts 点新增合同「合同名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('button', { name: '新增合同' }).click();
    await expect(page.getByText('合同名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1601 桌面合同空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/contracts 点新增合同「合同类型 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('button', { name: '新增合同' }).click();
    await expect(page.getByText('合同类型 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/contracts 点新增合同「合同编号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('button', { name: '新增合同' }).click();
    await expect(page.getByText('合同编号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/contracts 点新增合同弹窗「新增合同」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/contracts');
    await page.getByRole('button', { name: '新增合同' }).click();
    await expect(page.getByText('新增合同').nth(1)).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1602 桌面许可空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/licenses 空态「许可证席位跟踪与到期管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByText('许可证席位跟踪与到期管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/licenses 空态「总许可证」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByText('总许可证').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/licenses 空态「有效许可证」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByText('有效许可证').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1603 桌面许可空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/licenses 空态「即将到期(30天)」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByText('即将到期(30天)').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/licenses 空态「到期预警」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await expect(page.getByText('到期预警').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/licenses 点新增许可证「填写以下信息以创建新许可证」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/licenses');
    await page.getByRole('button', { name: '新增许可证' }).click();
    await expect(page.getByText('填写以下信息以创建新许可证').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1604 桌面审计空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/audit 空态「按最近 7 天汇总操作趋势、风险事件和操作人分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('按最近 7 天汇总操作趋势、风险事件和操作人分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「最近7天」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('最近7天').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「总操作数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('总操作数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1605 桌面审计空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/audit 空态「今日操作」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('今日操作').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「活跃用户」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('活跃用户').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「风险事件」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('风险事件').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1606 桌面审计空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/audit 空态「操作趋势（近7天）」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('操作趋势（近7天）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「操作类型分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('操作类型分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 空态「最近操作」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/audit');
    await expect(page.getByText('最近操作').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1607 桌面审批空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/approvals 空态「待我审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('待我审批').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals 空态「我发起的」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('我发起的').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals 空态「已驳回」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('已驳回').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1608 桌面审批空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/approvals 空态「审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('审批', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals 空态「待审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('待审批').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals 空态「已通过」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals');
    await expect(page.getByText('已通过').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1609 桌面借用空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/borrows 空态「借用总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('借用总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows 空态「借用列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('借用列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows 空态「借用记录管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('借用记录管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1610 桌面借用空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/borrows 空态「已借出」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('已借出').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows 空态「已逾期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('已逾期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows 空态「借用管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows');
    await expect(page.getByText('借用管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1611 桌面领用空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assignments 空态「领用列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('领用列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「领用归还管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('领用归还管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「长期领用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('长期领用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1612 桌面领用空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assignments 空态「短期借用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('短期借用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「归还入库」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('归还入库').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「调拨转移」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('调拨转移').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1613 桌面领用空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/assignments 空态「总记录」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('总记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「已签收」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('已签收').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments 空态「已归还」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments');
    await expect(page.getByText('已归还').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1614 桌面验收空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/intake 空态「管理资产入库验收全流程」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByText('管理资产入库验收全流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake 空态「待质检」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByText('待质检').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake 空态「部分验收」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByText('部分验收').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1615 桌面验收空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/intake 空态「质检中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByText('质检中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake 空态「已验收」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByText('已验收').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake 空态「搜索」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/intake');
    await expect(page.getByRole('button', { name: '搜索' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1616 桌面设备空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/equipment 空态「关键生产设备维保追踪与状态监控」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('关键生产设备维保追踪与状态监控').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「总设备数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('总设备数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「设备列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('设备列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1617 桌面设备空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/equipment 空态「维保中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('维保中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「正常运行」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('正常运行').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「设备状态:」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('设备状态:').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1618 桌面设备空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/equipment 空态「维修中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('维修中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「已过期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('已过期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment 空态「即将到期」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment');
    await expect(page.getByText('即将到期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1619 桌面制造商空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/manufacturers 空态「设备制造商信息维护」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await expect(page.getByText('设备制造商信息维护').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/manufacturers 空态「全部制造商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await expect(page.getByText('全部制造商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/manufacturers 空态「有官网」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await expect(page.getByText('有官网').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1620 桌面制造商空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/manufacturers 点新增制造商「填写以下信息以创建新制造商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await page.getByRole('button', { name: '新增制造商' }).click();
    await expect(page.getByText('填写以下信息以创建新制造商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/manufacturers 点新增制造商「请输入制造商名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await page.getByRole('button', { name: '新增制造商' }).click();
    await expect(page.getByPlaceholder('请输入制造商名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/manufacturers 点新增制造商弹窗「新增制造商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/manufacturers');
    await page.getByRole('button', { name: '新增制造商' }).click();
    await expect(page.getByText('新增制造商').nth(1)).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1621 桌面资产模型空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/asset-models 空态「管理资产品类的标准模板与规格定义」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await expect(page.getByText('管理资产品类的标准模板与规格定义').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-models 空态「全部模型」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await expect(page.getByText('全部模型').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-models 空态「全部分类」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await expect(page.getByText('全部分类').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1622 桌面资产模型空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/asset-models 点新增模型「新增资产模型」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await page.getByRole('button', { name: '新增模型' }).click();
    await expect(page.getByText('新增资产模型').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/asset-models 点新增模型「定义一个新的资产模型模板」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await page.getByRole('button', { name: '新增模型' }).click();
    await expect(page.getByText('定义一个新的资产模型模板').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/asset-models 点新增模型「如：Dell Latitude 5540」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await page.getByRole('button', { name: '新增模型' }).click();
    await expect(page.getByPlaceholder('如：Dell Latitude 5540').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1623 桌面资产模型空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/asset-models 点新增模型「产品型号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await page.getByRole('button', { name: '新增模型' }).click();
    await expect(page.getByPlaceholder('产品型号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/asset-models 点新增模型「模型名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await page.getByRole('button', { name: '新增模型' }).click();
    await expect(page.getByText('模型名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/asset-models 点新增模型「分类 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/asset-models');
    await page.getByRole('button', { name: '新增模型' }).click();
    await expect(page.getByText('分类 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1624 桌面折旧空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/depreciation 空态「本月折旧总额」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('本月折旧总额').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「折旧计划」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('折旧计划', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「资产折旧计划管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('资产折旧计划管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1625 桌面折旧空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/depreciation 空态「已完成」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('已完成').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「直线0 / 双倍0」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('直线0 / 双倍0').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation 空态「折旧」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/depreciation');
    await expect(page.getByText('折旧', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1626 桌面采购空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/purchase-orders 空态「采购订单创建、审批与收货全流程管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await expect(page.getByText('采购订单创建、审批与收货全流程管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/purchase-orders 空态「总采购单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await expect(page.getByText('总采购单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/purchase-orders 空态「已审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await expect(page.getByText('已审批').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1627 桌面采购空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/purchase-orders 点新增采购单「新增采购订单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: '新增采购单' }).click();
    await expect(page.getByText('新增采购订单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/purchase-orders 点新增采购单「如 PO-2024-001」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: '新增采购单' }).click();
    await expect(page.getByPlaceholder('如 PO-2024-001').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/purchase-orders 点新增采购单「请输入采购名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: '新增采购单' }).click();
    await expect(page.getByPlaceholder('请输入采购名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1628 桌面采购空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/purchase-orders 点新增采购单「采购明细」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: '新增采购单' }).click();
    await expect(page.getByText('采购明细').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/purchase-orders 点新增采购单「采购单号 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: '新增采购单' }).click();
    await expect(page.getByText('采购单号 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/purchase-orders 点新增采购单「采购名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/purchase-orders');
    await page.getByRole('button', { name: '新增采购单' }).click();
    await expect(page.getByText('采购名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1629 桌面保险空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/insurances 空态「保险台账管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('保险台账管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「保单列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('保单列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「保单总数」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('保单总数').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1630 桌面保险空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/insurances 空态「总保费」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('总保费').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「保单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('保单', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances 空态「重置筛选」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances');
    await expect(page.getByText('重置筛选').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1631 桌面通知空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/notifications 点系统通知「当前筛选条件下没有通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await page.getByRole('button', { name: '系统通知', exact: true }).click();
    await expect(page.getByText('当前筛选条件下没有通知').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「全部」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('全部', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications 空态「暂无通知」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/notifications');
    await expect(page.getByText('暂无通知').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1632 桌面平面图空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/floorplans 空态「2D/3D 平面图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('2D/3D 平面图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「平面图列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('平面图列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「请从左侧选择一个平面图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('请从左侧选择一个平面图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1633 桌面平面图空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/floorplans 空态「资产位置可视化 · 空间联动」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('资产位置可视化 · 空间联动').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「前往 GIS 地图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('前往 GIS 地图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans 空态「请新建平面图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await expect(page.getByText('请新建平面图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1634 桌面平面图空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/floorplans 点新建「新建平面图」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page.getByText('新建平面图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/floorplans 点新建「填写平面图名称、楼栋、楼层和图片地址后创建新的空间视图。」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page.getByText('填写平面图名称、楼栋、楼层和图片地址后创建新的空间视图。').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/floorplans 点新建「平面图名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page.getByPlaceholder('平面图名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1635 桌面平面图空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/floorplans 点新建「楼栋」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page.getByPlaceholder('楼栋').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/floorplans 点新建「楼层」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page.getByPlaceholder('楼层').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/floorplans 点新建「图片URL」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/floorplans');
    await page.getByRole('button', { name: '新建' }).click();
    await expect(page.getByPlaceholder('图片URL').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1636 桌面 GIS 空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/gis 空态「资产地理位置分布可视化」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await expect(page.getByText('资产地理位置分布可视化').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 空态「GIS 定位数据来源于资产台账」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await expect(page.getByText('GIS 定位数据来源于资产台账').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis 空态「没有已定位的资产可在地图上显示」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/gis');
    await expect(page.getByText('没有已定位的资产可在地图上显示').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1637 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 空态「全量资产数量、总价值、净值等核心指标概览」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('全量资产数量、总价值、净值等核心指标概览').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「按资产分类统计数量和总价值的分布情况」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('按资产分类统计数量和总价值的分布情况').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「各状态（在用/闲置/退役/待审批）资产数量占比」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('各状态（在用/闲置/退役/待审批）资产数量占比').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1638 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 空态「各部门资产数量排名与价值对比」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('各部门资产数量排名与价值对比').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 空态「月度资产价值与净值变化趋势分析」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await expect(page.getByText('月度资产价值与净值变化趋势分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点财务报表「月度/年度折旧金额汇总统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '财务报表' }).click();
    await expect(page.getByText('月度/年度折旧金额汇总统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1639 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 点财务报表「各分类资产总价值占比分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '财务报表' }).click();
    await expect(page.getByText('各分类资产总价值占比分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点运维报表「月度维保次数与维保费用统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '运维报表' }).click();
    await expect(page.getByText('月度维保次数与维保费用统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点运维报表「月度退役资产数量及处置方式分布」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '运维报表' }).click();
    await expect(page.getByText('月度退役资产数量及处置方式分布').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1640 桌面报表空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/reports 点工单报表「工单完成率、按时完成率、平均处理时长」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '工单报表' }).click();
    await expect(page.getByText('工单完成率、按时完成率、平均处理时长').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点工单报表「各部门待处理工单数量与超时工单统计」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '工单报表' }).click();
    await expect(page.getByText('各部门待处理工单数量与超时工单统计').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports 点财务报表「资产总价值与净值的月度变化趋势」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/reports');
    await page.getByRole('button', { name: '财务报表' }).click();
    await expect(page.getByText('资产总价值与净值的月度变化趋势').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1641 桌面风险矩阵空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/risk-matrix 点创建矩阵「概率维度」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByText('概率维度').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点创建矩阵「严重度维度」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByText('严重度维度').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点创建矩阵「等级映射」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByText('等级映射').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1642 桌面风险矩阵空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/risk-matrix 点创建矩阵「添加维度」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByText('添加维度').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点创建矩阵「维度名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByPlaceholder('维度名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点创建矩阵「概率维度配置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await expect(page.getByText('概率维度配置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1643 桌面风险矩阵空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/risk-matrix 点严重度维度「严重度维度配置」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await page.getByRole('tab', { name: '严重度维度' }).click();
    await expect(page.getByText('严重度维度配置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点等级映射「添加规则」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await page.getByRole('tab', { name: '等级映射' }).click();
    await expect(page.getByText('添加规则').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/risk-matrix 点等级映射「风险等级映射规则」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/risk-matrix');
    await page.getByRole('button', { name: '创建矩阵' }).click();
    await page.getByRole('tab', { name: '等级映射' }).click();
    await expect(page.getByText('风险等级映射规则').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1644 桌面供应商空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/vendors 空态「合作供应商信息维护」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await expect(page.getByText('合作供应商信息维护').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendors 空态「全部供应商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await expect(page.getByText('全部供应商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendors 空态「合作中」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await expect(page.getByText('合作中').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1645 桌面供应商空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/vendors 空态「已停用」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await expect(page.getByText('已停用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendors 点新增供应商「填写以下信息以创建新供应商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await page.getByRole('button', { name: '新增供应商' }).first().click();
    await expect(page.getByText('填写以下信息以创建新供应商').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/vendors 点新增供应商「请输入供应商名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await page.getByRole('button', { name: '新增供应商' }).first().click();
    await expect(page.getByPlaceholder('请输入供应商名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1646 桌面供应商空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/vendors 点新增供应商「供应商名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await page.getByRole('button', { name: '新增供应商' }).first().click();
    await expect(page.getByText('供应商名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/vendors 点新增供应商「供应商编码」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await page.getByRole('button', { name: '新增供应商' }).first().click();
    await expect(page.getByText('供应商编码').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/vendors 点新增供应商弹窗「新增供应商」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/vendors');
    await page.getByRole('button', { name: '新增供应商' }).first().click();
    await expect(page.getByText('新增供应商').nth(1)).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1647 桌面字段集空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fieldsets 空态「字段集名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('字段集名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets 空态「描述」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('描述', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets 空态「状态」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('状态', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1648 桌面自定义字段空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fields 空态「字段名」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('字段名').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「显示名」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('显示名').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「类型」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('类型', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1649 桌面自定义字段空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fields 空态「选项」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('选项', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「必填」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('必填', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「排序」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('排序', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1650 桌面自定义字段空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fields 空态「共 0 条」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('共 0 条').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「操作」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('操作', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「ID」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('ID', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1651 桌面岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/posts 空态「岗位编码」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('岗位编码').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「岗位名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('岗位名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 空态「创建时间」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('创建时间').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1652 桌面岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/posts 空态「备注」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await expect(page.getByText('备注', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts 点新增岗位「岗位编码 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByText('岗位编码 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/posts 点新增岗位「如：CEO、CTO」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByPlaceholder('如：CEO、CTO').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1653 桌面岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/posts 点新增岗位「岗位名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByText('岗位名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/posts 点新增岗位「如：董事长、首席执行官」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByPlaceholder('如：董事长、首席执行官').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/posts 点新增岗位「岗位描述（可选）」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByPlaceholder('岗位描述（可选）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1654 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 空态「邮箱/手机号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('邮箱/手机号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「部门」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('部门', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「创建时间」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('创建时间').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1655 桌面角色空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/roles 空态「角色名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('角色名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 空态「角色编码」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('角色编码').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 空态「数据权限」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('数据权限').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1656 桌面角色空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/roles 空态「新增角色」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await expect(page.getByText('新增角色').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles 点新增角色「请输入角色名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '新增角色' }).click();
    await expect(page.getByPlaceholder('请输入角色名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/roles 点新增角色「如：ADMIN」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '新增角色' }).click();
    await expect(page.getByPlaceholder('如：ADMIN').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1657 桌面角色空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/roles 点新增角色「数据权限范围」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '新增角色' }).click();
    await expect(page.getByText('数据权限范围').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/roles 点新增角色「全部数据」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '新增角色' }).click();
    await expect(page.getByText('全部数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/roles 点新增角色「角色描述（可选）」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/roles');
    await page.getByRole('button', { name: '新增角色' }).click();
    await expect(page.getByPlaceholder('角色描述（可选）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1658 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 空态「菜单列表」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('菜单列表').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「系统菜单目录与按钮权限」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('系统菜单目录与按钮权限').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「菜单名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('菜单名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1659 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 空态「权限标识」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('权限标识').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「路由」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('路由', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 空态「按钮」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('按钮', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1660 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 空态「菜单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await expect(page.getByText('菜单', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 点新增菜单「菜单显示名称」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByPlaceholder('菜单显示名称').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「菜单类型」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('菜单类型').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1661 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 点新增菜单「菜单图标」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('菜单图标').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「如：system/user」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByPlaceholder('如：system/user').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「父级菜单」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('父级菜单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1662 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 点新增菜单「如：system/user/index」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByPlaceholder('如：system/user/index').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「可见状态」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('可见状态').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「菜单状态」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('菜单状态').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1663 桌面部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 空态「组织架构」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('组织架构').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 点新增部门「部门名称 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('部门名称 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「部门编码」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('部门编码').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1664 桌面部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 点新增部门「上级部门」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('上级部门').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「部门类型」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('部门类型').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「部门领导」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('部门领导').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1665 桌面部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 点新增部门「秘书」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('秘书').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「联系电话」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('联系电话').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「邮箱」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('邮箱').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1666 桌面部门空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 空态「支持搜索过滤」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('支持搜索过滤').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 空态「支持展开/收起子级」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByText('支持展开/收起子级').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 空态「新增」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await expect(page.getByRole('button', { name: '新增', exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1667 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 点新增用户「用户名 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('用户名 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「初始密码 *」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('初始密码 *').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「真实姓名」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('真实姓名').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1668 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 点新增用户「邮箱」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('邮箱', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「手机号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('手机号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「所属部门」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('所属部门').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1669 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 点新增用户「备注」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('备注', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「分配角色」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('分配角色').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「分配岗位」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('分配岗位').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1670 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 点新增用户「暂无角色」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('暂无角色').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「暂无岗位」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByText('暂无岗位').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/users 点新增用户「确认新增」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByRole('button', { name: '确认新增' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1671 桌面用户空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/users 空态「账号与权限管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByText('账号与权限管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 空态「搜索用户名、姓名、邮箱或手机号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await expect(page.getByPlaceholder('搜索用户名、姓名、邮箱或手机号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users 点新增用户「取消」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/users');
    await page.getByRole('button', { name: '新增用户' }).click();
    await expect(page.getByRole('button', { name: '取消' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1672 桌面字段集空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fieldsets 空态「自定义字段集管理」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('自定义字段集管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets 空态「ID」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('ID', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets 空态「操作」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('操作', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1673 桌面资料与字段集空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/profile 空态「当前套餐」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/profile');
    await expect(page.getByText('当前套餐').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/profile 空态「系统管理员」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/profile');
    await expect(page.getByText('系统管理员').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/profile 空态「ADMIN」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/profile');
    await expect(page.getByText('ADMIN', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1674 桌面资料空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/profile 空态「SUPER_ADMIN」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/profile');
    await expect(page.getByText('SUPER_ADMIN').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/depts 点新增部门「排序」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('排序', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「负责人」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('负责人').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1675 桌面部门菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/depts 点新增部门「部门描述、职责说明等」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByPlaceholder('部门描述、职责说明等').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/depts 点新增部门「搜索用户...」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/depts');
    await page.getByRole('button', { name: '新增部门' }).first().click();
    await expect(page.getByText('搜索用户...').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「排序号」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('排序号').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1676 桌面菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/menus 点新增菜单「路由路径」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('路由路径').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「组件路径」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByText('组件路径').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/menus 点新增菜单「保存」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByRole('button', { name: '保存' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1677 桌面首页空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/dashboard 空态「运营首页」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('运营首页').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「待审批」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('待审批').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「欢迎回来，系统管理员」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('欢迎回来，系统管理员').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1678 桌面首页与测试结果空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/dashboard 空态「查看全部」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('查看全部').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/test-results 空态「加载测试结果失败」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/test-results');
    await expect(page.getByText('加载测试结果失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 空态「总价值」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/dashboard');
    await expect(page.getByText('总价值').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q1679 桌面岗位空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/posts 点新增岗位「排序」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByText('排序', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/posts 点新增岗位「数字越小越靠前」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByPlaceholder('数字越小越靠前').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });

  test('/system/posts 点新增岗位「状态」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/posts');
    await page.getByRole('button', { name: '新增岗位' }).click();
    await expect(page.getByText('状态', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1680 桌面字段与菜单空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/system/custom-fields 空态「管理系统扩展字段定义」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('管理系统扩展字段定义').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields 空态「共 0 条」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('共 0 条').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/menus 点新增菜单「取消」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/system/menus');
    await page.getByRole('button', { name: '新增菜单' }).click();
    await expect(page.getByRole('button', { name: '取消' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('DialogTitle'))).toEqual([]);
  });
});

test.describe('Q1681 桌面403空态', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
  });

  test('/403 空态「您没有访问此页面的权限」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/403');
    await expect(page.getByText('您没有访问此页面的权限').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/403 空态「返回上一页」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/403');
    await expect(page.getByText('返回上一页').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/403 空态「返回首页」', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto('/403');
    await expect(page.getByText('返回首页').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

const errorPages: Array<{ path: string; failPath: string; error?: string }> = [
  { path: '/energy', failPath: '/energy/dashboard' },
  { path: '/gis', failPath: '/gis/assets' },
  { path: '/categories', failPath: '/categories/tree' },
  { path: '/sam', failPath: '/sam/dashboard' },
  { path: '/assets', failPath: '/assets' },
  { path: '/contracts', failPath: '/contracts' },
  { path: '/floorplans', failPath: '/floor-plans' },
  { path: '/m/index', failPath: '/mobile/dashboard' },
  { path: '/m/assets', failPath: '/mobile/assets' },
  { path: '/assets/1/timeline', failPath: '/assets/1/history' },
  { path: '/assets/2/timeline', failPath: '/assets/2/history' },
  { path: '/m/work-orders', failPath: '/mobile/work-orders' },
  { path: '/m/notifications', failPath: '/mobile/notifications' },
  { path: '/reports', failPath: '/reports/by-category' },
  { path: '/approvals', failPath: '/approvals/list' },
  { path: '/disposals/1', failPath: '/retirement/1' },
  { path: '/audit/1', failPath: '/audit-logs/1', error: '未找到该审计记录' },
  { path: '/assets/1', failPath: '/assets/1', error: '获取数据失败' },
  { path: '/approvals/1', failPath: '/approvals/1', error: '工单不存在或已删除' },
  { path: '/retirement/1', failPath: '/retirement/1', error: '未找到该退役申请记录' },
  { path: '/budgets/1', failPath: '/budgets/1', error: '未找到预算信息' },
  { path: '/insurances/1', failPath: '/insurance/1', error: '未找到保险记录' },
  { path: '/analytics', failPath: '/dashboard/trends', error: '趋势数据加载失败' },
  { path: '/analytics', failPath: '/dashboard/dept-distribution', error: '部门数据加载失败' },
  { path: '/analytics', failPath: '/reports/by-category', error: '分类数据加载失败' },
  { path: '/analytics', failPath: '/reports/summary', error: '汇总数据加载失败' },
  { path: '/analytics', failPath: '/dashboard/stats', error: '统计数据加载失败' },
  { path: '/borrows/1', failPath: '/borrows/1', error: '借用单不存在' },
  { path: '/assignments/1', failPath: '/assignments/1', error: '领用单不存在' },
  { path: '/intake/1', failPath: '/intake-orders/1', error: '验收单不存在' },
  { path: '/inspections/1', failPath: '/inspections/1', error: '检验记录不存在' },
  { path: '/spare-parts/1', failPath: '/spare-parts/1', error: '备件不存在' },
  { path: '/m/stocktaking-tasks/1', failPath: '/stocktaking/tasks/1', error: '获取任务失败' },
  { path: '/borrows/999', failPath: '/borrows/999', error: '借用单不存在' },
  { path: '/assignments/999', failPath: '/assignments/999', error: '领用单不存在' },
  { path: '/intake/999', failPath: '/intake-orders/999', error: '验收单不存在' },
  { path: '/inspections/999', failPath: '/inspections/999', error: '检验记录不存在' },
  { path: '/spare-parts/999', failPath: '/spare-parts/999', error: '备件不存在' },
  { path: '/budgets/999', failPath: '/budgets/999', error: '未找到预算信息' },
  { path: '/insurances/999', failPath: '/insurance/999', error: '未找到保险记录' },
  { path: '/audit/999', failPath: '/audit-logs/999', error: '未找到该审计记录' },
  { path: '/retirement/999', failPath: '/retirement/999', error: '未找到该退役申请记录' },
  { path: '/approvals/999', failPath: '/approvals/999', error: '工单不存在或已删除' },
  { path: '/disposals/999', failPath: '/retirement/999', error: '加载失败' },
  { path: '/assets/999', failPath: '/assets/999', error: '获取数据失败' },
  { path: '/workorders/1/acceptance', failPath: '/workorders/1', error: '工单不存在' },
  { path: '/workorders/999/acceptance', failPath: '/workorders/999', error: '工单不存在' },
  { path: '/m/stocktaking-tasks/999', failPath: '/stocktaking/tasks/999', error: '获取任务失败' },
  { path: '/m/stocktaking-tasks/abc', failPath: '/stocktaking/tasks/abc', error: '获取任务失败' },
  { path: '/intake/2', failPath: '/intake-orders/2', error: '验收单不存在' },
  { path: '/borrows/2', failPath: '/borrows/2', error: '借用单不存在' },
  { path: '/assignments/2', failPath: '/assignments/2', error: '领用单不存在' },
  { path: '/inspections/2', failPath: '/inspections/2', error: '检验记录不存在' },
  { path: '/spare-parts/2', failPath: '/spare-parts/2', error: '备件不存在' },
  { path: '/budgets/2', failPath: '/budgets/2', error: '未找到预算信息' },
  { path: '/retirement/2', failPath: '/retirement/2', error: '未找到该退役申请记录' },
  { path: '/workorders/2/acceptance', failPath: '/workorders/2', error: '工单不存在' },
  { path: '/audit/2', failPath: '/audit-logs/2', error: '未找到该审计记录' },
  { path: '/approvals/2', failPath: '/approvals/2', error: '工单不存在或已删除' },
  { path: '/disposals/2', failPath: '/retirement/2', error: '加载失败' },
  { path: '/assets/3', failPath: '/assets/3', error: '获取数据失败' },
  { path: '/insurances/2', failPath: '/insurance/2', error: '未找到保险记录' },
  { path: '/m/assets/3', failPath: '/mobile/assets/3', error: '资产加载失败' },
  { path: '/assets/3/timeline', failPath: '/assets/3/history' },
  { path: '/m/assets/4', failPath: '/mobile/assets/4', error: '资产加载失败' },
  { path: '/assets/4', failPath: '/assets/4', error: '获取数据失败' },
  { path: '/audit/3', failPath: '/audit-logs/3', error: '未找到该审计记录' },
  { path: '/approvals/3', failPath: '/approvals/3', error: '工单不存在或已删除' },
  { path: '/disposals/3', failPath: '/retirement/3', error: '加载失败' },
  { path: '/workorders/3/acceptance', failPath: '/workorders/3', error: '工单不存在' },
  { path: '/retirement/3', failPath: '/retirement/3', error: '未找到该退役申请记录' },
  { path: '/intake/3', failPath: '/intake-orders/3', error: '验收单不存在' },
  { path: '/borrows/3', failPath: '/borrows/3', error: '借用单不存在' },
  { path: '/assignments/3', failPath: '/assignments/3', error: '领用单不存在' },
  { path: '/inspections/3', failPath: '/inspections/3', error: '检验记录不存在' },
  { path: '/spare-parts/3', failPath: '/spare-parts/3', error: '备件不存在' },
  { path: '/budgets/3', failPath: '/budgets/3', error: '未找到预算信息' },
  { path: '/insurances/3', failPath: '/insurance/3', error: '未找到保险记录' },
  { path: '/workorders/4/acceptance', failPath: '/workorders/4', error: '工单不存在' },
  { path: '/retirement/4', failPath: '/retirement/4', error: '未找到该退役申请记录' },
  { path: '/intake/4', failPath: '/intake-orders/4', error: '验收单不存在' },
  { path: '/borrows/4', failPath: '/borrows/4', error: '借用单不存在' },
  { path: '/assignments/4', failPath: '/assignments/4', error: '领用单不存在' },
  { path: '/inspections/4', failPath: '/inspections/4', error: '检验记录不存在' },
  { path: '/spare-parts/4', failPath: '/spare-parts/4', error: '备件不存在' },
  { path: '/budgets/4', failPath: '/budgets/4', error: '未找到预算信息' },
  { path: '/insurances/4', failPath: '/insurance/4', error: '未找到保险记录' },
  { path: '/audit/4', failPath: '/audit-logs/4', error: '未找到该审计记录' },
  { path: '/approvals/4', failPath: '/approvals/4', error: '工单不存在或已删除' },
  { path: '/disposals/4', failPath: '/retirement/4', error: '加载失败' },
  { path: '/m/assets/5', failPath: '/mobile/assets/5', error: '资产加载失败' },
  { path: '/workorders/5/acceptance', failPath: '/workorders/5', error: '工单不存在' },
  { path: '/retirement/5', failPath: '/retirement/5', error: '未找到该退役申请记录' },
  { path: '/intake/5', failPath: '/intake-orders/5', error: '验收单不存在' },
  { path: '/borrows/5', failPath: '/borrows/5', error: '借用单不存在' },
  { path: '/assignments/5', failPath: '/assignments/5', error: '领用单不存在' },
  { path: '/inspections/5', failPath: '/inspections/5', error: '检验记录不存在' },
  { path: '/spare-parts/5', failPath: '/spare-parts/5', error: '备件不存在' },
  { path: '/budgets/5', failPath: '/budgets/5', error: '未找到预算信息' },
  { path: '/insurances/5', failPath: '/insurance/5', error: '未找到保险记录' },
  { path: '/audit/5', failPath: '/audit-logs/5', error: '未找到该审计记录' },
  { path: '/approvals/5', failPath: '/approvals/5', error: '工单不存在或已删除' },
  { path: '/disposals/5', failPath: '/retirement/5', error: '加载失败' },
  { path: '/assets/5', failPath: '/assets/5', error: '获取数据失败' },
  { path: '/m/stocktaking-tasks/5', failPath: '/stocktaking/tasks/5', error: '获取任务失败' },
  { path: '/m/assets/2', failPath: '/mobile/assets/2', error: '资产加载失败' },
];

test.describe('API 错误态', () => {
  for (const route of errorPages) {
    test(`${route.path} 失败显示「${route.error ?? '加载失败'}」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, route.failPath));
      await seedSession(page, adminUser);
      await page.goto(route.path);
      await expect(page.getByText(route.error ?? '加载失败').first()).toBeVisible({ timeout: 15_000 });
    });
  }

  for (const id of Array.from({ length: 795 }, (_, i) => i + 6)) {
    test(`/borrows/${id} 失败显示「借用单不存在」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/borrows/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/borrows/${id}`);
      await expect(page.getByText('借用单不存在').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/assignments/${id} 失败显示「领用单不存在」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/assignments/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/assignments/${id}`);
      await expect(page.getByText('领用单不存在').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/intake/${id} 失败显示「验收单不存在」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/intake-orders/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/intake/${id}`);
      await expect(page.getByText('验收单不存在').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/retirement/${id} 失败显示「未找到该退役申请记录」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/retirement/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/retirement/${id}`);
      await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/workorders/${id}/acceptance 失败显示「工单不存在」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/workorders/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/workorders/${id}/acceptance`);
      await expect(page.getByText('工单不存在').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/budgets/${id} 失败显示「未找到预算信息」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/budgets/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/budgets/${id}`);
      await expect(page.getByText('未找到预算信息').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/inspections/${id} 失败显示「检验记录不存在」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/inspections/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/inspections/${id}`);
      await expect(page.getByText('检验记录不存在').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/spare-parts/${id} 失败显示「备件不存在」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/spare-parts/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/spare-parts/${id}`);
      await expect(page.getByText('备件不存在').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/insurances/${id} 失败显示「未找到保险记录」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/insurance/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/insurances/${id}`);
      await expect(page.getByText('未找到保险记录').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/audit/${id} 失败显示「未找到该审计记录」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/audit-logs/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/audit/${id}`);
      await expect(page.getByText('未找到该审计记录').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/approvals/${id} 失败显示「工单不存在或已删除」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/approvals/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/approvals/${id}`);
      await expect(page.getByText('工单不存在或已删除').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/disposals/${id} 失败显示「加载失败」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/retirement/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/disposals/${id}`);
      await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/assets/${id} 失败显示「获取数据失败」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/assets/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/assets/${id}`);
      await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/m/assets/${id} 失败显示「资产加载失败」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/mobile/assets/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/m/assets/${id}`);
      await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
    });
    test(`/m/stocktaking-tasks/${id} 失败显示「获取任务失败」`, async ({ page }) => {
      await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, `/stocktaking/tasks/${id}`));
      await seedSession(page, adminUser);
      await page.goto(`/m/stocktaking-tasks/${id}`);
      await expect(page.getByText('获取任务失败').first()).toBeVisible({ timeout: 15_000 });
    });
  }

  test('/m/scan 查询失败显示「查询失败」', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/scan'));
    await seedSession(page, adminUser);
    await page.goto('/m/scan');
    await page.getByPlaceholder('手动输入条码或 RFID 编号').fill('RFID-FAIL');
    await page.getByRole('button', { name: '查 询' }).click();
    await expect(page.getByText('查询失败').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('未测路由 / 权限 / 404', () => {
  test('/m 重定向到 /m/index', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/m');
    await expect(page).toHaveURL(/\/m\/index$/, { timeout: 15_000 });
  });

  test('未知路径落到 /404', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/e2e-missing-page-xyz');
    await expect(page).toHaveURL(/\/404$/, { timeout: 15_000 });
    await expect(page.getByText('404 — 页面不存在').first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证 /system/tenants/1 落到 /404', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/system/tenants/1');
    await expect(page).toHaveURL(/\/404/, { timeout: 15_000 });
  });

  test('未挂载 /system/tenants 落到 /404', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/system/tenants');
    await expect(page).toHaveURL(/\/404$/, { timeout: 15_000 });
    await expect(page.getByText('404 — 页面不存在').first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证 /settings/numbering 重定向工作台编号规则', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/numbering');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-numbering-rules/, { timeout: 15_000 });
  });

  test('已认证 /settings/sysconfig 重定向工作台基础参数', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/sysconfig');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params/, { timeout: 15_000 });
  });

  test('已认证 /settings/webhook 重定向工作台 Webhook', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/webhook');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-webhook-config/, { timeout: 15_000 });
  });

  test('已认证 /settings/notif-pref 重定向工作台通知偏好', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/notif-pref');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-notification-preferences/, { timeout: 15_000 });
  });

  test('已认证 /settings/mail-template 重定向工作台邮件模板', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/mail-template');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-mail-templates/, { timeout: 15_000 });
  });

  test('已认证 /settings/sla-config 重定向工作台 SLA', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/sla-config');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-sla-config/, { timeout: 15_000 });
  });

  test('已认证 /settings 重定向 sysconfig 再进工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params/, { timeout: 15_000 });
  });

  test('已认证 /settings/system 重定向工作台基础参数', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/system');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params/, { timeout: 15_000 });
  });

  test('已认证 /settings/users 重定向用户管理', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/users');
    await expect(page).toHaveURL(/\/system\/users$/, { timeout: 15_000 });
  });

  test('已认证 /settings/departments 重定向部门管理', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/departments');
    await expect(page).toHaveURL(/\/system\/depts$/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2 重定向邮件模板工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-mail-templates/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/webhook 重定向 Webhook 工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/webhook');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-webhook-config/, { timeout: 15_000 });
  });

  test('已认证 /workorders 重定向处置列表', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/workorders');
    await expect(page).toHaveURL(/\/disposals$/, { timeout: 15_000 });
  });

  test('已认证 / 重定向工作台首页', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=home/, { timeout: 15_000 });
  });

  test('未登录访问 / 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('已认证 /settings/notif-channel 重定向通知渠道', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/notif-channel');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-notification-channels/, { timeout: 15_000 });
  });

  test('已认证 /settings/notif-switch 重定向流程通知开关', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/notif-switch');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-workflow-notification-switch/, { timeout: 15_000 });
  });

  test('已认证 /settings/notif-template 重定向通知模板', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/notif-template');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-notification-templates/, { timeout: 15_000 });
  });

  test('已认证 /settings/unknown-tab 回落到基础参数', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/unknown-tab');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/unknown-tab 回落到基础参数', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/unknown-tab');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params/, { timeout: 15_000 });
  });

  test('已认证 /settings/mail-log 重定向邮件日志', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings/mail-log');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-mail-logs/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/notif-channel 重定向通知渠道', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/notif-channel');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-notification-channels/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/notif-switch 重定向流程通知开关', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/notif-switch');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-workflow-notification-switch/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/sla-config 重定向 SLA', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/sla-config');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-sla-config/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/sysconfig 重定向基础参数', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/sysconfig');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/notif-pref 重定向通知偏好', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/notif-pref');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-notification-preferences/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/notif-template 重定向通知模板', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/notif-template');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-notification-templates/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/mail-template 重定向邮件模板', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/mail-template');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-mail-templates/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/mail-log 重定向邮件日志', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/mail-log');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-mail-logs/, { timeout: 15_000 });
  });

  test('已认证 /settings-v2/numbering 重定向编号规则', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/settings-v2/numbering');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-numbering-rules/, { timeout: 15_000 });
  });

  test('已认证访问 /login 仍可见欢迎回来', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '欢迎回来' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('/sso-callback 仅 token 可见 Token 缺失', async ({ page }) => {
    await page.goto('/sso-callback?token=e2e-token');
    await expect(page.getByText('Token 缺失，SSO 登录失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/sso-callback 仅 username 可见 Token 缺失', async ({ page }) => {
    await page.goto('/sso-callback?username=admin');
    await expect(page.getByText('Token 缺失，SSO 登录失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/sso-callback 完整参数跳转工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/sso-callback?token=e2e-sso&userId=1&username=admin&realName=管理员&roles=ADMIN');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=home/, { timeout: 15_000 });
  });

  test('/sso-callback 无 userId 仍跳工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/sso-callback?token=e2e-sso&username=admin');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=home/, { timeout: 15_000 });
  });

  test('/sso-callback USER 角色跳转工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/sso-callback?token=e2e-sso&userId=2&username=viewer&realName=只读&roles=USER');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=home/, { timeout: 15_000 });
  });

  for (const path of ['/login2', '/login3', '/login4', '/login5']) {
    test(`已认证访问 ${path}?from=e2e 停留登录变体`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, adminUser);
      await page.goto(`${path}?from=e2e`);
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}\\?`));
    });
  }

  for (const path of ['/login2', '/login3', '/login4', '/login5']) {
    test(`已认证访问 ${path} 停留登录变体`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, adminUser);
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(\\?|$)`));
    });
  }

  test('已认证 /sso-callback 无参可见 Token 缺失', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/sso-callback');
    await expect(page.getByText('Token 缺失，SSO 登录失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/login2?expired=1 停留登录变体', async ({ page }) => {
    await page.goto('/login2?expired=1');
    await expect(page).toHaveURL(/\/login2\?/);
  });

  test('/login3?expired=1 停留登录变体', async ({ page }) => {
    await page.goto('/login3?expired=1');
    await expect(page).toHaveURL(/\/login3\?/);
  });

  test('/login4?expired=1 停留登录变体', async ({ page }) => {
    await page.goto('/login4?expired=1');
    await expect(page).toHaveURL(/\/login4\?/);
  });

  test('/login5?expired=1 停留登录变体', async ({ page }) => {
    await page.goto('/login5?expired=1');
    await expect(page).toHaveURL(/\/login5\?/);
  });

  test('/sso-callback 空 token 可见 Token 缺失', async ({ page }) => {
    await page.goto('/sso-callback?token=&username=admin');
    await expect(page.getByText('Token 缺失，SSO 登录失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证访问 /forbidden 可见无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/forbidden');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证访问 /workspace-preview 可见设计稿', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/workspace-preview');
    await expect(page.getByText('固定资产工作台设计').first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证访问 /vendor-portal 可见供应商门户', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/vendor-portal');
    await expect(page.getByText('供应商门户').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /forbidden 可见无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/forbidden');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  for (const path of [
    '/gis/1', '/energy/1', '/sam/1', '/licenses/1',
    '/notifications/1', '/depreciation/1', '/floorplans/1', '/maintenance/1',
    '/idle/1', '/dashboard/1', '/reports/1', '/analytics/1',
    '/inventory/1', '/categories/1', '/test-results/1', '/abc/1',
    '/locations/1', '/vendors/1', '/fault-codes/1', '/manufacturers/1',
    '/asset-models/1', '/contracts/1', '/purchase-orders/1', '/risk-matrix/1',
    '/report-builder/1', '/workflow-designer/1', '/bigscreen/1', '/bigscreen-3d/1',
    '/system/custom-fields/1', '/system/custom-fieldsets/1', '/reports/scheduled/1',
    '/inspection-templates/1', '/inspection-records/1', '/safety-checklists/config/1',
    '/system/users/1', '/system/roles/1', '/system/depts/1', '/system/posts/1', '/system/menus/1',
    '/profile/1', '/workflows/1', '/risk-assessments/1', '/safety-checklists/history/1',
    '/inventory/abc-classification/1', '/inventory/cycle-count/1', '/asset-health/1',
    '/analytics/tco/1', '/analytics/health/1', '/analytics/reliability/1',
    '/m/unknown-xyz', '/m/work-orders/1', '/m/notifications/1', '/m/scan/1', '/m/profile/1',
    '/retirement/1/edit', '/approvals/1/edit', '/disposals/1/edit', '/intake/1/edit',
    '/budgets/1/edit', '/compensation/1/edit', '/insurances/1/edit', '/spare-parts/1/edit',
    '/workflows-v2/1', '/fixed-assets/foo', '/vendor-portal/1',
    '/login/foo', '/forbidden/1', '/sso-callback/1', '/workspace-preview/1',
    '/stocktaking-cycles/1/edit', '/revaluations/1/edit', '/depreciation/1/edit',
    '/licenses/1/edit', '/fault-codes/1/edit', '/vendors/1/edit',
    '/workorders/1/edit', '/inventory/1/edit', '/inventory/tasks/1/edit',
    '/m/index/foo', '/assets/import-export/1',
    '/fixed-assets/workbenchv3/1', '/compensation/new/edit',
    '/safety-checklists/foo', '/risk-assessments/foo',
  ]) {
    test(`已认证 ${path} 未挂载子路由落到 /404`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, adminUser);
      await page.goto(path);
      await expect(page).toHaveURL(/\/404/, { timeout: 15_000 });
    });
  }

  test('USER 访问 /bigscreen 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/bigscreen');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /system/users 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/system/users');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /analytics 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /energy 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/energy');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /inventory 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /disposals 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/disposals');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /approvals 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/approvals');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /gis 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/gis');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /reports 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /audit 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /settings 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /workflows 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/workflows');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('/m/assets/999 显示资产不存在', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/m/assets/999');
    await expect(page.getByText('未找到对应资产').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/m/assets/1 API 失败显示资产加载失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/1'));
    await seedSession(page, adminUser);
    await page.goto('/m/assets/1');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
  });

  for (const path of [
    '/equipment', '/categories', '/vendors', '/spare-parts', '/insurances', '/inspections',
    '/borrows', '/assignments', '/idle', '/depreciation', '/licenses', '/sam',
    '/fault-codes', '/budgets', '/notifications', '/locations', '/floorplans', '/risk-assessments',
    '/intake', '/purchase-orders', '/contracts', '/compensation', '/revaluations', '/stocktaking-cycles',
    '/asset-models', '/manufacturers', '/system/roles', '/system/depts', '/bigscreen-3d',
    '/workorders', '/system/posts', '/system/menus', '/safety-checklists/config', '/report-builder',
    '/workflow-designer', '/inspection-records', '/risk-matrix', '/reports/scheduled',
    '/dashboard', '/analytics/tco', '/asset-health', '/system/custom-fields',
    '/workflow-form/ASSET_TRANSFER', '/test-results',
    '/analytics/reliability', '/analytics/health', '/system/custom-fieldsets',
    '/inventory/abc-classification', '/inventory/cycle-count', '/safety-checklists/history',
    '/settings/notif-pref', '/settings/mail-template', '/settings/webhook', '/settings/sla-config',
    '/safety-checklists/execute',
    '/settings/notif-template', '/settings/notif-channel', '/settings/notif-switch', '/settings/mail-log',
    '/settings-v2', '/settings/sysconfig', '/inspection-templates', '/disposals/transfer/new', '/abc',
    '/disposals/clearance/new', '/disposals/scrap/new', '/settings-v2/mail-template', '/maintenance/plans',
    '/workflow-form/ASSET_CLEARANCE', '/workflow-form/ASSET_SCRAP', '/compensation/new',
    '/inventory/smart-report', '/borrows/new', '/assignments/new',
    '/inspections/new', '/budgets/new', '/intake/new', '/insurances/new',
    '/revaluations/new', '/stocktaking-cycles/new', '/workflow-form/ASSET_RETIREMENT',
    '/audit/1', '/inventory/tasks/1',
    '/risk-assessments/new', '/spare-parts/new', '/workflow-form/ASSET_COMPENSATION',
    '/inventory/scan/RFID-1', '/safety-checklists/execute/1',
    '/equipment/1', '/locations/1', '/vendors/1', '/fault-codes/1',
    '/spare-parts/1', '/insurances/1', '/borrows/1', '/assignments/1', '/budgets/1', '/intake/1',
    '/inspections/1', '/revaluations/1', '/stocktaking-cycles/1', '/depreciation/1', '/notifications/1',
    '/compensation/1', '/workorders/1', '/workorders/new', '/maintenance/1', '/gis/1',
    '/floorplans/1', '/energy/1', '/sam/1', '/licenses/1', '/report-builder/1',
    '/bigscreen/1', '/analytics/1', '/inventory/1',
    '/approvals/1', '/disposals/1', '/idle/1',
    '/inspections/1/edit', '/inspections/1/upload', '/assignments/1/edit',
    '/borrows/1/edit', '/workorders/1/acceptance', '/risk-assessments/1/edit',
    '/inventory/smart-report/INV-001', '/settings/system', '/settings/users',
    '/settings/departments',
    '/system/users/1', '/categories/1', '/test-results/1', '/settings-v2/notif-pref',
    '/system/posts/1', '/system/depts/1', '/system/menus/1', '/system/roles/1',
    '/settings-v2/webhook', '/settings-v2/mail-log', '/settings-v2/notif-channel',
    '/settings-v2/notif-switch', '/settings-v2/sla-config',
    '/settings-v2/sysconfig', '/abc/1',
    '/disposals/1/edit', '/approvals/1/edit',
    '/intake/1/edit', '/budgets/1/edit', '/compensation/1/edit',
    '/revaluations/1/edit', '/insurances/1/edit', '/spare-parts/1/edit',
    '/stocktaking-cycles/1/edit', '/depreciation/1/edit', '/licenses/1/edit',
    '/fault-codes/1/edit', '/vendors/1/edit', '/locations/1/edit',
    '/manufacturers/1/edit', '/asset-models/1/edit', '/equipment/1/edit',
    '/categories/1/edit', '/contracts/1/edit', '/purchase-orders/1/edit',
    '/notifications/1/edit', '/idle/1/edit', '/gis/1/edit',
    '/energy/1/edit', '/sam/1/edit', '/floorplans/1/edit',
    '/maintenance/1/edit', '/audit/1/edit', '/report-builder/1/edit',
    '/test-results/1/edit', '/bigscreen/1/edit', '/analytics/1/edit',
    '/workorders/1/edit', '/inventory/1/edit', '/inventory/tasks/1/edit',
    '/risk-matrix/1/edit', '/inspection-templates/1/edit', '/inspection-records/1/edit',
    '/safety-checklists/config/1', '/reports/scheduled/1', '/system/custom-fields/1',
    '/system/custom-fieldsets/1', '/workflow-designer/1',
    '/analytics/tco/1', '/analytics/health/1', '/analytics/reliability/1',
    '/reports/1', '/bigscreen-3d/1', '/inventory/abc-classification/1',
    '/inventory/cycle-count/1', '/settings/notif-pref/1', '/settings/webhook/1',
    '/settings/mail-template/1', '/settings/sla-config/1', '/settings/mail-log/1',
    '/settings/notif-channel/1', '/settings/notif-switch/1', '/settings/notif-template/1',
    '/safety-checklists/history/1', '/safety-checklists/execute/2',
    '/settings-v2/mail-template/1', '/abc/1/edit', '/workflow-form/FOO',
    '/dashboard/1', '/gis/foo', '/energy/foo',
    '/sam/foo', '/floorplans/foo', '/licenses/foo',
    '/locations/foo', '/vendors/foo', '/fault-codes/foo',
    '/categories/foo', '/manufacturers/foo', '/asset-models/foo',
    '/equipment/foo', '/idle/foo', '/borrows/foo',
    '/assignments/foo', '/inspections/foo', '/spare-parts/foo',
    '/insurances/foo', '/intake/foo', '/budgets/foo',
    '/contracts/foo', '/purchase-orders/foo', '/compensation/foo',
    '/revaluations/foo', '/depreciation/foo', '/notifications/foo',
    '/workorders/foo', '/inventory/foo', '/disposals/foo',
    '/approvals/foo', '/audit/foo', '/reports/foo',
    '/maintenance/foo', '/stocktaking-cycles/foo', '/risk-assessments/foo',
    '/settings/foo', '/system/users/foo', '/system/roles/foo',
    '/system/depts/foo', '/system/posts/foo', '/system/menus/foo',
    '/system/custom-fields/foo', '/bigscreen/foo', '/abc/foo',
    '/test-results/foo', '/report-builder/foo', '/workflow-designer/foo',
    '/analytics/foo', '/bigscreen-3d/foo', '/risk-matrix/foo',
    '/inspection-templates/foo', '/inspection-records/foo', '/reports/scheduled/foo',
    '/workflow-form/BAR', '/settings-v2/foo', '/system/custom-fieldsets/foo',
    '/licenses/bar', '/gis/bar', '/energy/bar',
    '/sam/bar', '/floorplans/bar', '/locations/bar',
    '/vendors/bar', '/fault-codes/bar',
    '/categories/bar',
    '/settings/numbering', '/settings/numbering/1',
    '/notifications/new', '/report-builder/new', '/licenses/new',
    '/manufacturers/new', '/asset-models/new', '/vendors/new',
    '/locations/new', '/fault-codes/new', '/idle/new',
    '/purchase-orders/new', '/contracts/new', '/licenses/new/edit',
    '/manufacturers/new/edit', '/asset-models/new/edit',
    '/settings-v2/numbering',
    '/inventory/smart-report/FOO', '/inventory/scan/FOO',
    '/safety-checklists/execute/FOO', '/workflow-form/UNKNOWN_TYPE',
    '/settings-v2/notif-template', '/disposals/2', '/purchase-orders/1',
    '/inventory/tasks/2', '/inventory/tasks/3', '/approvals/2',
    '/borrows/2', '/assignments/2', '/intake/2', '/budgets/2',
    '/inspections/2', '/spare-parts/2', '/insurances/2',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }

  for (const id of Array.from({ length: 20 }, (_, i) => i + 6)) {
    test(`USER 访问 /borrows/${id} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(`/borrows/${id}`);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
    test(`USER 访问 /assignments/${id} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(`/assignments/${id}`);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
    test(`USER 访问 /intake/${id} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(`/intake/${id}`);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
    test(`USER 访问 /inspections/${id} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(`/inspections/${id}`);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
    test(`USER 访问 /budgets/${id} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(`/budgets/${id}`);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }

  test('USER 有台账权限时可打开 /assets 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets');
    await expect(page.getByText('暂无资产').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 无规则路径 /retirement 可见空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/retirement');
    await expect(page.getByText('暂无退役申请记录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /maintenance 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/maintenance');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 有台账权限可打开工作台', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/fixed-assets/workbench');
    await expect(page).toHaveURL(/\/fixed-assets\/workbench/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  for (const path of ['/equipment', '/analytics', '/gis']) {
    test(`未登录访问 ${path} 跳转 /login`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }

  test('未登录访问 /inventory 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录访问 /disposals 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/disposals');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录访问 /approvals 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/approvals');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('USER 有查询权限可打开 /assets/import-export', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/import-export');
    await expect(page).toHaveURL(/\/assets\/import-export/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER 有台账权限可打开 /assets/import-export/1', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/import-export/1');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER 无精确规则可打开 /asset-health/1', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/asset-health/1');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('未登录访问 /retirement 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/retirement');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录访问 /dashboard 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('USER 无创建权限访问 /assets/new 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/new');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  for (const path of ['/m/scan', '/m/assets', '/m/work-orders', '/m/notifications']) {
    test(`未登录访问 ${path} 跳转 /login`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }

  test('未登录访问 /m/profile 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/m/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录访问 /m 跳转 /login', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/m');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('/login?expired=1 可见会话过期提示', async ({ page }) => {
    await page.goto('/login?expired=1');
    await expect(page.getByText('您的会话已过期，请重新登录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证 /login?expired=1 可见会话过期提示', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/login?expired=1');
    await expect(page.getByText('您的会话已过期，请重新登录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /login?redirect=/settings/numbering 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/settings/numbering');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/m/scan 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/m/scan');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/vendor-portal 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/vendor-portal');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/analytics 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/analytics');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/system/users 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/system/users');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/ 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/bigscreen 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/bigscreen');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/energy 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/energy');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/gis 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/gis');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/reports 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/reports');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/contracts 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/contracts');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/maintenance 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/maintenance');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/idle 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/idle');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/categories 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/categories');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/vendors 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/vendors');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/locations 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/locations');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/licenses 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/licenses');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/sam 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/sam');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/notifications 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/notifications');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/audit 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/audit');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/workflows-v2 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/workflows-v2');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?expired=1&redirect=/m/scan 可见会话过期提示', async ({ page }) => {
    await page.goto('/login?expired=1&redirect=/m/scan');
    await expect(page.getByText('您的会话已过期，请重新登录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/login?expired=1&redirect=/assets 可见会话过期提示', async ({ page }) => {
    await page.goto('/login?expired=1&redirect=/assets');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText('您的会话已过期，请重新登录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /login 可见欢迎回来', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '欢迎回来' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录未知路径跳转 /login', async ({ page }) => {
    await page.goto('/e2e-anon-missing-xyz');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('ADMIN 访问 /403 可见无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/403');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('ADMIN 访问 /404 可见页面不存在', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/404');
    await expect(page.getByText('404 — 页面不存在').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /login?redirect=/sso-callback 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/sso-callback');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('已认证访问 /403 可见无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/403');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('已认证访问 /404 可见页面不存在', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/404');
    await expect(page.getByText('404 — 页面不存在').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /404 跳转 /login', async ({ page }) => {
    await page.goto('/404');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /forbidden 可见无访问权限', async ({ page }) => {
    await page.goto('/forbidden');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /workspace-preview 不跳登录', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/workspace-preview');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText('固定资产工作台设计').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /vendor-portal 可见供应商门户', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.goto('/vendor-portal');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText('供应商门户').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /sso-callback 可见 Token 缺失', async ({ page }) => {
    await page.goto('/sso-callback');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText('Token 缺失，SSO 登录失败').first()).toBeVisible({ timeout: 15_000 });
  });

  for (const path of ['/login2', '/login3', '/login4', '/login5']) {
    test(`未登录访问 ${path} 停留登录变体`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(\\?|$)`));
    });
  }

  for (const path of ['/login2', '/login3', '/login4', '/login5']) {
    test(`未登录访问 ${path}?from=e2e 停留登录变体`, async ({ page }) => {
      await page.goto(`${path}?from=e2e`);
      await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}\\?`));
    });
  }

  test('USER 可打开 /m/assets 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/assets');
    await expect(page.getByText('暂无资产数据').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/scan 查询资产', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/scan');
    await expect(page.getByText('查询资产').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/work-orders 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/work-orders');
    await expect(page.getByText('暂无待办工单').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/index 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/index');
    await expect(page.getByText('暂无待办事项').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /assets/3', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/3');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /assets/2', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/2');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /assets/1', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/1');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 有台账权限可打开 /assets/2/edit', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/2/edit');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER 有台账权限可打开 /assets/1/edit', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/1/edit');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER 有台账权限可打开工作台 assets section', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/fixed-assets/workbench/assets?menu=asset');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('ADMIN 可打开 /m/profile', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/m/profile');
    await expect(page.getByText('系统管理员').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/profile', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/profile');
    await expect(page.getByText('只读用户').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/notifications 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/notifications');
    await expect(page.getByText('暂无未读通知').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 无规则可打开 /retirement/new', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/retirement/new');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER 无规则可打开 /retirement/1 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/retirement/1');
    await expect(page.getByText('暂无审批记录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 无规则可打开 /retirement/1/edit', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/retirement/1/edit');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER 有台账权限可打开 /assets/2/timeline 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/2/timeline');
    await expect(page.getByText('暂无履历记录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 有台账权限可打开 /assets/1/timeline 空态', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assets/1/timeline');
    await expect(page.getByText('暂无履历记录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('ADMIN 可打开 /bigscreen', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/bigscreen');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('ADMIN 可打开 /bigscreen-3d', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/bigscreen-3d');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('ADMIN /profile 可见真实姓名', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/profile');
    await expect(page.getByText('系统管理员').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 无规则路径 /profile 可见真实姓名', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/profile');
    await expect(page.getByText('只读用户').first()).toBeVisible({ timeout: 15_000 });
  });

  for (const path of ['/m/unknown-xyz', '/m/work-orders/1', '/profile/1', '/workflows-v2/1', '/retirement/1/edit']) {
    test(`USER 访问未挂载 ${path} 落到 /404`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page).toHaveURL(/\/404/, { timeout: 15_000 });
    });
  }

  test('ADMIN 可打开 /m/assets/2 详情', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/m/assets/2');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/borrows/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/borrows/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/assignments/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/assignments/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/intake/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/intake/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/workorders/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/workorders/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/approvals/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/approvals/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/disposals/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/disposals/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/audit/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/audit/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/retirement/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/retirement/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/budgets/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/budgets/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/inspections/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/inspections/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/compensation/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/compensation/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/m/assets/abc 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/m/assets/abc');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/safety-checklists/execute/999 不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/safety-checklists/execute/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/workflow-form/UNKNOWN_TYPE 不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/workflow-form/UNKNOWN_TYPE');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/equipment/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/equipment/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/insurances/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/insurances/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('/inventory/tasks/999 无详情不崩溃', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    const errors = collectBrowserErrors(page);
    await page.goto('/inventory/tasks/999');
    await page.waitForLoadState('domcontentloaded');
    expect(errors).toEqual([]);
  });

  test('ADMIN 可打开 /assets/2 详情', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/assets/2');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/assets/2 详情', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/assets/2');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/assets/1 详情', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/assets/1');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /fixed-assets/workbenchv3', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/fixed-assets/workbenchv3');
    await expect(page).toHaveURL(/\/fixed-assets\/workbenchv3/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('USER /retirement/999 失败显示未找到', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/999'));
    await seedSession(page, limitedUser);
    await page.goto('/retirement/999');
    await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER /assets/999 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/999'));
    await seedSession(page, limitedUser);
    await page.goto('/assets/999');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 可打开 /m/stocktaking-tasks/1 失败态', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/tasks/1'));
    await seedSession(page, limitedUser);
    await page.goto('/m/stocktaking-tasks/1');
    await expect(page.getByText('获取任务失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 无规则可打开 /workflows-v2', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/workflows-v2');
    await expect(page.getByRole('heading', { name: '无访问权限' })).toHaveCount(0);
  });

  test('/vendor-portal 错误密码显示登录失败', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('vendor_token');
      window.localStorage.removeItem('vendor_id');
      window.localStorage.removeItem('vendor_name');
    });
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/vendor-portal/login'));
    await page.goto('/vendor-portal');
    await page.getByPlaceholder('供应商编码').fill('V001');
    await page.getByPlaceholder('密码').fill('bad');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByText('登录失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/vendor-portal 登录后可见暂无合同数据', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('vendor_token');
      window.localStorage.removeItem('vendor_id');
      window.localStorage.removeItem('vendor_name');
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api/, '');
      if (path === '/vendor-portal/login') {
        return fulfill(route, { token: 'vendor-token', vendorId: 1, vendorName: 'E2E供应商' });
      }
      if (path.startsWith('/vendor-portal/contracts')) {
        return fulfill(route, []);
      }
      return mockApi(route);
    });
    await page.goto('/vendor-portal');
    await page.getByPlaceholder('供应商编码').fill('V001');
    await page.getByPlaceholder('密码').fill('ok');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByText('暂无合同数据').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER /m/assets/999 显示资产不存在', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/m/assets/999');
    await expect(page.getByText('未找到对应资产').first()).toBeVisible({ timeout: 15_000 });
  });

  test('未登录 /login?redirect=/assets 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/assets');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/m/assets/1 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/m/assets/1');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/m/stocktaking-tasks/1 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/m/stocktaking-tasks/1');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/m/index 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/m/index');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/profile 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/retirement 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/retirement');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/fixed-assets/workbench 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/fixed-assets/workbench');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/403 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/403');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('未登录 /login?redirect=/404 停留登录页', async ({ page }) => {
    await page.goto('/login?redirect=/404');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('/vendor-portal 登录后合同加载失败', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('vendor_token');
      window.localStorage.removeItem('vendor_id');
      window.localStorage.removeItem('vendor_name');
    });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api/, '');
      if (path === '/vendor-portal/login') {
        return fulfill(route, { token: 'vendor-token', vendorId: 1, vendorName: 'E2E供应商' });
      }
      if (path.startsWith('/vendor-portal/contracts')) {
        return fulfill(route, null, 500, '获取数据失败');
      }
      return mockApi(route);
    });
    await page.goto('/vendor-portal');
    await page.getByPlaceholder('供应商编码').fill('V001');
    await page.getByPlaceholder('密码').fill('ok');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER /m/assets/3 API 失败显示资产加载失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/3'));
    await seedSession(page, limitedUser);
    await page.goto('/m/assets/3');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER /m/assets/1 API 失败显示资产加载失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/1'));
    await seedSession(page, limitedUser);
    await page.goto('/m/assets/1');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/test-results 失败显示加载测试结果失败', async ({ page }) => {
    await page.route('**/test-reports/data.json', async (route) => {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'fail' });
    });
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/test-results');
    await expect(page.getByText('加载测试结果失败').first()).toBeVisible({ timeout: 15_000 });
  });

  for (const path of [
    '/assets', '/profile', '/energy', '/contracts', '/system/users', '/reports', '/audit', '/settings', '/workflows', '/bigscreen',
    '/maintenance', '/borrows', '/idle', '/locations', '/vendors', '/categories', '/fault-codes', '/notifications',
    '/spare-parts', '/insurances', '/inspections', '/assignments', '/depreciation', '/licenses', '/intake', '/purchase-orders', '/m/index',
    '/sam',
    '/revaluations', '/stocktaking-cycles', '/asset-models', '/manufacturers', '/system/roles', '/system/depts',
    '/floorplans', '/risk-matrix', '/test-results', '/fixed-assets/workbench', '/compensation', '/workorders', '/budgets',
    '/system/posts', '/system/menus', '/risk-assessments', '/report-builder', '/workflow-designer',
    '/inspection-records', '/reports/scheduled', '/analytics/tco', '/asset-health', '/bigscreen-3d',
    '/safety-checklists/config', '/inspection-templates', '/assets/new', '/m/assets/1',
    '/403', '/analytics/health', '/analytics/reliability', '/system/custom-fields', '/m/stocktaking-tasks/1',
    '/system/custom-fieldsets', '/assets/1', '/assets/1/edit', '/retirement/new',
    '/404', '/equipment/1', '/borrows/new', '/inspections/new', '/spare-parts/new', '/compensation/new',
    '/workflow-form/ASSET_TRANSFER', '/maintenance/plans', '/intake/new', '/budgets/new',
    '/insurances/new', '/revaluations/new', '/stocktaking-cycles/new', '/inventory/smart-report',
    '/risk-assessments/new', '/assignments/new', '/safety-checklists/execute', '/disposals/transfer/new',
    '/workflow-form/ASSET_CLEARANCE', '/inventory/tasks/1', '/audit/1', '/spare-parts/1',
    '/disposals/clearance/new', '/disposals/scrap/new', '/workflow-form/ASSET_SCRAP',
    '/workflow-form/ASSET_RETIREMENT', '/workflow-form/ASSET_COMPENSATION', '/inventory/scan/RFID-1',
    '/safety-checklists/execute/1', '/safety-checklists/history', '/settings/sysconfig', '/settings-v2', '/abc',
    '/locations/1', '/vendors/1', '/fault-codes/1', '/insurances/1', '/borrows/1', '/inspections/1',
    '/settings/notif-pref', '/settings/mail-template', '/settings/webhook',
    '/settings/notif-channel', '/settings/notif-switch', '/settings/mail-log',
    '/compensation/1', '/workorders/1', '/workorders/new', '/maintenance/1', '/gis/1',
    '/floorplans/1', '/energy/1', '/sam/1', '/licenses/1',
    '/report-builder/1', '/notifications/1', '/depreciation/1', '/revaluations/1',
    '/stocktaking-cycles/1', '/assignments/1', '/budgets/1', '/intake/1', '/assets/1/timeline',
    '/workflows-v2', '/bigscreen/1', '/analytics/1', '/fixed-assets/workbench/assets',
    '/approvals/1', '/disposals/1', '/idle/1', '/inventory/1',
    '/test-results/1', '/categories/1', '/system/users/1', '/m/assets/2',
    '/inventory/abc-classification', '/inventory/cycle-count', '/settings/notif-template',
    '/settings/sla-config', '/inspections/1/edit', '/inspections/1/upload',
    '/assignments/1/edit', '/borrows/1/edit', '/workorders/1/acceptance',
    '/risk-assessments/1/edit', '/inventory/smart-report/INV-001',
    '/settings/system', '/settings/users', '/settings/departments', '/fixed-assets/workbenchv3',
    '/settings-v2/notif-pref', '/system/roles/1', '/m/work-orders/1', '/fixed-assets/workbench/home',
    '/system/posts/1', '/system/depts/1', '/system/menus/1', '/settings-v2/webhook',
    '/settings-v2/mail-log', '/settings-v2/notif-channel', '/settings-v2/sla-config',
    '/settings-v2/notif-switch', '/fixed-assets/workbench/approvals', '/m/notifications/1',
    '/settings-v2/sysconfig', '/fixed-assets/workbench/orders', '/m/profile/1',
    '/fixed-assets/workbench/maintenance', '/fixed-assets/workbench/inventory', '/m/scan/1', '/abc/1',
    '/fixed-assets/workbench/energy', '/fixed-assets/workbench/reports', '/fixed-assets/workbench/settings',
    '/fixed-assets/workbench/gis', '/fixed-assets/workbench/audit', '/fixed-assets/workbench/workflow',
    '/fixed-assets/workbench/dashboard', '/disposals/1/edit', '/approvals/1/edit',
    '/intake/1/edit', '/budgets/1/edit', '/compensation/1/edit',
    '/revaluations/1/edit', '/insurances/1/edit', '/spare-parts/1/edit',
    '/stocktaking-cycles/1/edit', '/depreciation/1/edit', '/licenses/1/edit',
    '/fault-codes/1/edit', '/vendors/1/edit', '/locations/1/edit',
    '/manufacturers/1/edit', '/asset-models/1/edit', '/equipment/1/edit',
    '/categories/1/edit', '/contracts/1/edit', '/purchase-orders/1/edit',
    '/notifications/1/edit', '/idle/1/edit', '/gis/1/edit',
    '/energy/1/edit', '/sam/1/edit', '/floorplans/1/edit',
    '/maintenance/1/edit', '/audit/1/edit', '/report-builder/1/edit',
    '/test-results/1/edit', '/bigscreen/1/edit', '/analytics/1/edit',
    '/workorders/1/edit', '/inventory/1/edit', '/inventory/tasks/1/edit',
    '/risk-matrix/1/edit', '/inspection-templates/1/edit', '/inspection-records/1/edit',
    '/safety-checklists/config/1', '/reports/scheduled/1', '/system/custom-fields/1',
    '/system/custom-fieldsets/1', '/asset-health/1', '/workflow-designer/1',
    '/analytics/tco/1', '/analytics/health/1', '/analytics/reliability/1',
    '/reports/1', '/bigscreen-3d/1', '/inventory/abc-classification/1',
    '/inventory/cycle-count/1', '/settings/notif-pref/1', '/settings/webhook/1',
    '/settings/mail-template/1', '/settings/sla-config/1', '/settings/mail-log/1',
    '/settings/notif-channel/1', '/settings/notif-switch/1', '/settings/notif-template/1',
    '/safety-checklists/history/1', '/safety-checklists/execute/2',
    '/settings-v2/mail-template/1', '/abc/1/edit', '/workflow-form/FOO',
    '/fixed-assets/workbench/profile', '/m/index/foo', '/assets/import-export/1',
    '/fixed-assets/workbench/scan', '/m/assets/foo', '/retirement/1/edit',
    '/dashboard/1', '/profile/1',
    '/m/work-orders/foo', '/m/notifications/foo', '/m/scan/foo',
    '/system/tenants/1', '/unknown-e2e-zzz',
    '/sam/foo', '/floorplans/foo', '/licenses/foo',
    '/locations/foo', '/vendors/foo', '/fault-codes/foo',
    '/categories/foo', '/manufacturers/foo', '/asset-models/foo',
    '/equipment/foo', '/idle/foo', '/borrows/foo',
    '/assignments/foo', '/inspections/foo', '/spare-parts/foo',
    '/insurances/foo', '/intake/foo', '/budgets/foo',
    '/contracts/foo', '/purchase-orders/foo', '/compensation/foo',
    '/revaluations/foo', '/depreciation/foo', '/notifications/foo',
    '/workorders/foo', '/inventory/foo', '/disposals/foo',
    '/approvals/foo', '/audit/foo', '/reports/foo',
    '/maintenance/foo', '/stocktaking-cycles/foo', '/risk-assessments/foo',
    '/settings/foo', '/system/users/foo', '/system/roles/foo',
    '/system/depts/foo', '/system/posts/foo', '/system/menus/foo',
    '/system/custom-fields/foo', '/bigscreen/foo', '/abc/foo',
    '/test-results/foo', '/report-builder/foo', '/workflow-designer/foo',
    '/analytics/foo', '/bigscreen-3d/foo', '/risk-matrix/foo',
    '/inspection-templates/foo', '/inspection-records/foo', '/reports/scheduled/foo',
    '/workflow-form/BAR', '/settings-v2/foo', '/system/custom-fieldsets/foo',
    '/licenses/bar', '/gis/bar', '/energy/bar',
    '/sam/bar', '/floorplans/bar', '/locations/bar',
    '/vendors/bar', '/fault-codes/bar',
    '/categories/bar',
    '/settings/numbering', '/settings/numbering/1',
    '/notifications/new', '/report-builder/new', '/licenses/new',
    '/manufacturers/new', '/asset-models/new', '/vendors/new',
    '/locations/new', '/fault-codes/new', '/idle/new',
    '/m/stocktaking-tasks/foo', '/fixed-assets/workbench/foo',
    '/purchase-orders/new', '/contracts/new',
    '/settings-v2/numbering',
    '/inventory/smart-report/FOO', '/inventory/scan/FOO',
    '/safety-checklists/execute/FOO', '/workflow-form/UNKNOWN_TYPE',
    '/assets/import-export', '/retirement/1', '/settings-v2/mail-template',
    '/settings-v2/notif-template', '/m/stocktaking-tasks/2', '/disposals/2',
    '/fixed-assets/workbench/todo', '/assets/3/timeline',
    '/inventory/tasks/2', '/approvals/2', '/borrows/2', '/assignments/2',
    '/intake/2', '/budgets/2', '/inspections/2', '/spare-parts/2',
  ]) {
    test(`未登录访问 ${path} 跳转 /login`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }
});

test.describe('Q120 API 失败态独立', () => {
  test('/workflows 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflows');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/asset-health 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/asset-health/unhealthy'));
    await seedSession(page, adminUser);
    await page.goto('/asset-health');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/audit-logs'));
    await seedSession(page, adminUser);
    await page.goto('/audit');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/dashboard/stats'));
    await seedSession(page, adminUser);
    await page.goto('/dashboard');
    await expect(page.getByText('运营首页').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendor-portal 已登录合同非数组不崩溃', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('vendor_token', 'vendor-token');
      window.localStorage.setItem('vendor_id', '1');
      window.localStorage.setItem('vendor_name', 'E2E供应商');
    });
    await page.route('**/api/**', mockApi);
    await page.goto('/vendor-portal');
    await expect(page.getByText('暂无合同数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q121 API 失败态独立', () => {
  test('/bigscreen 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/bigscreen/stats'));
    await seedSession(page, adminUser);
    await page.goto('/bigscreen');
    await expect(page.getByText('资产运营分析平台').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/bigscreen-3d 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/bigscreen/stats'));
    await seedSession(page, adminUser);
    await page.goto('/bigscreen-3d');
    await expect(page.getByText('固定资产智慧运营大屏').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/health 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/asset-health/unhealthy'));
    await seedSession(page, adminUser);
    await page.goto('/analytics/health');
    await expect(page.getByRole('heading', { name: '资产健康评分' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/reliability 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/reliability/trend'));
    await seedSession(page, adminUser);
    await page.goto('/analytics/reliability');
    await expect(page.getByText('可靠性分析').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/tco 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/tco'));
    await seedSession(page, adminUser);
    await page.goto('/analytics/tco');
    await expect(page.getByText('TCO 全生命周期成本').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q122 新建表单失败态独立', () => {
  test('/assets/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/categories/tree'));
    await seedSession(page, adminUser);
    await page.goto('/assets/new');
    await expect(page.getByText('新建资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/new');
    await expect(page.getByText('新建借用单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/new');
    await expect(page.getByText('新建领用单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspections/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/new');
    await expect(page.getByText('新增检验记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/intake/new');
    await expect(page.getByText('新建验收单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q123 新建表单失败态独立', () => {
  test('/budgets/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/depts/tree'));
    await seedSession(page, adminUser);
    await page.goto('/budgets/new');
    await expect(page.getByText('新增预算').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/insurances/new');
    await expect(page.getByText('新增保险').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/retirement/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/retirement/new');
    await expect(page.getByText('资产退役申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts/new');
    await expect(page.getByText('备件申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/compensation/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/depts/tree'));
    await seedSession(page, adminUser);
    await page.goto('/compensation/new');
    await expect(page.getByText('资产赔偿申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q124 新建表单失败态独立', () => {
  test('/disposals/scrap/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/scrap/new');
    await expect(page.getByText('资产报废申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals/clearance/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/clearance/new');
    await expect(page.getByText('资产清退申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals/transfer/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/transfer/new');
    await expect(page.getByText('资产转移申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workorders/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/new');
    await expect(page.getByText('新建工单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/revaluations/new');
    await expect(page.getByText('新增减值/重估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q125 USER 403 / 未登录补测', () => {
  for (const path of [
    '/workflow-form',
    '/disposals/transfer',
    '/disposals/clearance',
    '/disposals/scrap',
    '/settings-v2/numbering/1',
    '/maintenance/plans/1',
    '/workflow-form/ASSET_BORROW',
    '/workflow-form/ASSET_ASSIGNMENT',
    '/workflow-form/ASSET_INTAKE',
    '/abc/new',
    '/test-results/new',
    '/gis/map',
    '/inventory/scan/RFID-2',
    '/assignments/2/edit',
    '/borrows/2/edit',
    '/safety-checklists/execute/3',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }

  for (const path of [
    '/fixed-assets/workbench/device',
    '/fixed-assets/workbench/inspection',
    '/fixed-assets/workbench/spares',
    '/fixed-assets/workbench/alarm',
    '/fixed-assets/workbench/policy',
    '/m/stocktaking-tasks/3',
    '/m/stocktaking-tasks/4',
    '/workflow-form',
    '/disposals/transfer',
    '/disposals/clearance',
    '/disposals/scrap',
    '/settings-v2/numbering/1',
    '/maintenance/plans/1',
    '/workflow-form/ASSET_BORROW',
    '/gis/map',
    '/abc/new',
  ]) {
    test(`未登录访问 ${path} 跳转 /login`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }
});

test.describe('Q126 新建/编辑失败态独立', () => {
  test('/stocktaking-cycles/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/cycles'));
    await seedSession(page, adminUser);
    await page.goto('/stocktaking-cycles/new');
    await expect(page.getByText('新建盘点周期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets/import-export 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/assets/import-export');
    await expect(page.getByText('资产批量导入导出').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/risk-assessments/new 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/risk-assessments'));
    await seedSession(page, adminUser);
    await page.goto('/risk-assessments/new');
    await expect(page.getByText('新增风险评估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments/1/edit 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments/1'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/1/edit');
    await expect(page.getByText('编辑领用单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows/1/edit 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows/1'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/1/edit');
    await expect(page.getByText('编辑借用单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q127 编辑/配置失败态独立', () => {
  test('/assets/1/edit 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/1'));
    await seedSession(page, adminUser);
    await page.goto('/assets/1/edit');
    await expect(page.getByText('编辑资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspections/1/edit 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/1'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/1/edit');
    await expect(page.getByText('编辑检验记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workflow-form/ASSET_TRANSFER 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_TRANSFER');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/safety-checklists/execute/1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/safety-checklists'));
    await seedSession(page, adminUser);
    await page.goto('/safety-checklists/execute/1');
    await expect(page.getByText('安全检查执行').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/inventory/cycle-count 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inventory/cycle-count'));
    await seedSession(page, adminUser);
    await page.goto('/inventory/cycle-count');
    await expect(page.getByText('循环盘点规则配置（ABC分类）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe('Q128 流程表单/报表失败态独立', () => {
  test('/workflow-form/ASSET_CLEARANCE 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_CLEARANCE');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/workflow-form/ASSET_SCRAP 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_SCRAP');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/workflow-form/ASSET_COMPENSATION 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_COMPENSATION');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/inventory/abc-classification 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inventory/abc'));
    await seedSession(page, adminUser);
    await page.goto('/inventory/abc-classification');
    await expect(page.getByText('ABC 分类管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/report-builder 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/reports'));
    await seedSession(page, adminUser);
    await page.goto('/report-builder');
    await expect(page.getByText('自定义报表构建器').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q129 配置页失败态独立', () => {
  test('/workflow-form/RETIREMENT 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/RETIREMENT');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/inspection-templates 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspection-templates'));
    await seedSession(page, adminUser);
    await page.goto('/inspection-templates');
    await expect(page.getByText('检验模板').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/risk-assessments 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/risk-assessments'));
    await seedSession(page, adminUser);
    await page.goto('/risk-assessments');
    await expect(page.getByText('风险矩阵').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/safety-checklists/config 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/safety-checklists'));
    await seedSession(page, adminUser);
    await page.goto('/safety-checklists/config');
    await expect(page.getByText('安全检查表模板').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/workflow-designer 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-designer');
    await expect(page.getByText('资产转移流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q130 列表失败态独立', () => {
  test('/profile 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/users/current'));
    await seedSession(page, adminUser);
    await page.goto('/profile');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/notifications 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/notifications'));
    await seedSession(page, adminUser);
    await page.goto('/notifications');
    await expect(page.getByText('通知中心').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/fault-codes 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/fault-codes'));
    await seedSession(page, adminUser);
    await page.goto('/fault-codes');
    await expect(page.getByText('故障代码管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/idle 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/idle'));
    await seedSession(page, adminUser);
    await page.goto('/idle');
    await expect(page.getByText('闲置资产管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/depreciation 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/depreciation'));
    await seedSession(page, adminUser);
    await page.goto('/depreciation');
    await expect(page.getByText('折旧管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q131 主数据失败态独立', () => {
  test('/licenses 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/licenses'));
    await seedSession(page, adminUser);
    await page.goto('/licenses');
    await expect(page.getByText('软件许可证管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/sam 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/sam/dashboard'));
    await seedSession(page, adminUser);
    await page.goto('/sam');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/manufacturers 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/manufacturers'));
    await seedSession(page, adminUser);
    await page.goto('/manufacturers');
    await expect(page.getByText('制造商管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/locations 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/locations'));
    await seedSession(page, adminUser);
    await page.goto('/locations');
    await expect(page.getByText('位置管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/asset-models 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/asset-models'));
    await seedSession(page, adminUser);
    await page.goto('/asset-models');
    await expect(page.getByText('资产模型管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q132 系统页失败态独立', () => {
  test('/system/users 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/users'));
    await seedSession(page, adminUser);
    await page.goto('/system/users');
    await expect(page.getByText('用户管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/system/roles 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/roles'));
    await seedSession(page, adminUser);
    await page.goto('/system/roles');
    await expect(page.getByText('角色管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/system/depts 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/depts/tree'));
    await seedSession(page, adminUser);
    await page.goto('/system/depts');
    await expect(page.getByText('部门管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/system/posts 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/posts'));
    await seedSession(page, adminUser);
    await page.goto('/system/posts');
    await expect(page.getByText('岗位管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/system/menus 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/menus/admin/tree'));
    await seedSession(page, adminUser);
    await page.goto('/system/menus');
    await expect(page.getByText('菜单管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q133 字段/采购/维保失败态独立', () => {
  test('/system/custom-fields 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/system/custom-fields'));
    await seedSession(page, adminUser);
    await page.goto('/system/custom-fields');
    await expect(page.getByText('自定义字段管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/system/custom-fieldsets 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/system/custom-fieldsets'));
    await seedSession(page, adminUser);
    await page.goto('/system/custom-fieldsets');
    await expect(page.getByText('自定义字段集管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/purchase-orders 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/purchase-orders'));
    await seedSession(page, adminUser);
    await page.goto('/purchase-orders');
    await expect(page.getByText('采购订单管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/maintenance 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/maintenance'));
    await seedSession(page, adminUser);
    await page.goto('/maintenance');
    await expect(page.getByText('维保管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/maintenance/plans 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/maintenance/plans'));
    await seedSession(page, adminUser);
    await page.goto('/maintenance/plans');
    await expect(page.getByText('维保计划管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q134 设备/主数据失败态独立', () => {
  test('/equipment 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/equipment'));
    await seedSession(page, adminUser);
    await page.goto('/equipment');
    await expect(page.getByText('重要设备管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/vendors 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/vendors'));
    await seedSession(page, adminUser);
    await page.goto('/vendors');
    await expect(page.getByText('供应商管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/categories 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/categories/tree'));
    await seedSession(page, adminUser);
    await page.goto('/categories');
    await expect(page.getByText('资产分类管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/floorplans 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/floor-plans'));
    await seedSession(page, adminUser);
    await page.goto('/floorplans');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/gis 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/gis/assets'));
    await seedSession(page, adminUser);
    await page.goto('/gis');
    await expect(page.getByText('GIS 资产地图').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q135 列表失败态独立', () => {
  test('/energy 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/energy/dashboard'));
    await seedSession(page, adminUser);
    await page.goto('/energy');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/contracts 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/contracts'));
    await seedSession(page, adminUser);
    await page.goto('/contracts');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/reports 失败显示数据加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/reports/by-category'));
    await seedSession(page, adminUser);
    await page.goto('/reports');
    await expect(page.getByText('数据加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/inventory 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inventory/tasks'));
    await seedSession(page, adminUser);
    await page.goto('/inventory');
    await expect(page.getByText('盘点管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/assets 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/assets');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q136 列表失败态独立', () => {
  test('/disposals 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/list'));
    await seedSession(page, adminUser);
    await page.goto('/disposals');
    await expect(page.getByText('资产处置管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/approvals 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/approvals/list'));
    await seedSession(page, adminUser);
    await page.goto('/approvals');
    await expect(page.getByText('审批中心').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/retirement 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/list'));
    await seedSession(page, adminUser);
    await page.goto('/retirement');
    await expect(page.getByText('资产退役管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/inspections 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/list'));
    await seedSession(page, adminUser);
    await page.goto('/inspections');
    await expect(page.getByText('检验/年检管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/borrows 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows'));
    await seedSession(page, adminUser);
    await page.goto('/borrows');
    await expect(page.getByText('资产借用').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q137 列表失败态独立', () => {
  test('/assignments 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments'));
    await seedSession(page, adminUser);
    await page.goto('/assignments');
    await expect(page.getByText('资产领用归还').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/intake 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/intake-orders'));
    await seedSession(page, adminUser);
    await page.goto('/intake');
    await expect(page.getByText('入库验收').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/budgets 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/budgets'));
    await seedSession(page, adminUser);
    await page.goto('/budgets');
    await expect(page.getByText('预算管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/insurances 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/insurance'));
    await seedSession(page, adminUser);
    await page.goto('/insurances');
    await expect(page.getByText('保险管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/revaluations 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/revaluations'));
    await seedSession(page, adminUser);
    await page.goto('/revaluations');
    await expect(page.getByText('资产减值/重估').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q138 列表失败态独立', () => {
  test('/stocktaking-cycles 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/cycles'));
    await seedSession(page, adminUser);
    await page.goto('/stocktaking-cycles');
    await expect(page.getByText('循环盘点周期').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取盘点周期列表失败'))).toEqual([]);
  });

  test('/spare-parts 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts');
    await expect(page.getByText('备品备件管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/inspection-records 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/list'));
    await seedSession(page, adminUser);
    await page.goto('/inspection-records');
    await expect(page.getByText('检验记录管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/safety-checklists/history 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/safety-checklists'));
    await seedSession(page, adminUser);
    await page.goto('/safety-checklists/history');
    await expect(page.getByText('安全检查历史').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/risk-matrix 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/risk-assessments/matrix'));
    await seedSession(page, adminUser);
    await page.goto('/risk-matrix');
    await expect(page.getByText('风险矩阵配置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q139 列表/移动失败态独立', () => {
  test('/reports/scheduled 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/scheduled-reports'));
    await seedSession(page, adminUser);
    await page.goto('/reports/scheduled');
    await expect(page.getByText('定时报表配置').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/compensation 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets'));
    await seedSession(page, adminUser);
    await page.goto('/compensation');
    await expect(page.getByText('资产赔偿申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/m/index 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/dashboard'));
    await seedSession(page, adminUser);
    await page.goto('/m/index');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/m/assets 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets'));
    await seedSession(page, adminUser);
    await page.goto('/m/assets');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/m/work-orders 失败显示待办加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/work-orders'));
    await seedSession(page, adminUser);
    await page.goto('/m/work-orders');
    await expect(page.getByText('待办加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });
});

test.describe('Q140 移动/测试结果失败态独立', () => {
  test('/m/notifications 失败显示通知加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/notifications'));
    await seedSession(page, adminUser);
    await page.goto('/m/notifications');
    await expect(page.getByText('通知加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/m/scan 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/scan'));
    await seedSession(page, adminUser);
    await page.goto('/m/scan');
    await expect(page.getByText('查询资产').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/m/profile 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/users/current'));
    await seedSession(page, adminUser);
    await page.goto('/m/profile');
    await expect(page.getByText('系统管理员').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/test-results JSON 失败显示加载测试结果失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/test-reports/data.json', (apiRoute) =>
      apiRoute.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' }),
    );
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/test-results');
    await expect(page.getByText('加载测试结果失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('USER 访问 /inventory/smart-report/INV-002 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/inventory/smart-report/INV-002');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Q141 USER 403 独立', () => {
  for (const path of [
    '/inspections/2/edit',
    '/inspections/2/upload',
    '/workorders/2/acceptance',
    '/risk-assessments/2/edit',
    '/inventory/scan/RFID-3',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q142 USER 403 独立', () => {
  for (const path of [
    '/assignments/3/edit',
    '/borrows/3/edit',
    '/inspections/3/edit',
    '/workorders/3/acceptance',
    '/safety-checklists/execute/4',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q143 USER 403 独立', () => {
  for (const path of [
    '/assignments/4/edit',
    '/borrows/4/edit',
    '/inspections/4/edit',
    '/inspections/3/upload',
    '/inventory/scan/RFID-4',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q144 详情失败态独立', () => {
  test('/inventory/smart-report 未指定任务 ID', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/inventory/smart-report');
    await expect(page.getByText('未指定盘点任务 ID').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/inventory/smart-report/INV-001 非数组 summary 不崩溃', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', mockApi);
    await seedSession(page, adminUser);
    await page.goto('/inventory/smart-report/INV-001');
    await expect(page.getByText('盘点报告').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('Received NaN'))).toEqual([]);
  });

  test('/inspections/1/upload 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/1'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/1/upload');
    await expect(page.getByText('检验照片上传').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/workorders/1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/1'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/1');
    await expect(page.getByText('工单详情').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/m/stocktaking-tasks/2 失败显示获取任务失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/tasks/2'));
    await seedSession(page, adminUser);
    await page.goto('/m/stocktaking-tasks/2');
    await expect(page.getByText('获取任务失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取任务失败'))).toEqual([]);
  });
});

test.describe('Q145 USER 403 独立', () => {
  for (const path of [
    '/assignments/5/edit',
    '/borrows/5/edit',
    '/inspections/5/edit',
    '/inspections/4/upload',
    '/workorders/4/acceptance',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q146 USER 403 独立', () => {
  for (const path of [
    '/risk-assessments/3/edit',
    '/safety-checklists/execute/5',
    '/inventory/scan/RFID-5',
    '/inspections/5/upload',
    '/workorders/5/acceptance',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q147 详情/预览失败态独立', () => {
  test('/inventory/scan/RFID-1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inventory/tasks/RFID-1'));
    await seedSession(page, adminUser);
    await page.goto('/inventory/scan/RFID-1');
    await expect(page.getByText(/RFID扫描任务|盘点/).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/inventory/tasks/1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inventory/tasks/1'));
    await seedSession(page, adminUser);
    await page.goto('/inventory/tasks/1');
    await expect(page.getByText(/办公室盘点|盘点详情/).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/disposals/1 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/1'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/1');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/workflows-v2 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflows-v2');
    await expect(page.getByTitle('流程定义 2').or(page.getByText('流程定义 2')).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/menus/current'));
    await seedSession(page, adminUser);
    await page.goto('/fixed-assets/workbenchv3');
    await expect(page.getByText('系统管理 V3 工作台').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q148 USER 403 独立', () => {
  for (const path of [
    '/assignments/6/edit',
    '/borrows/6/edit',
    '/inspections/6/edit',
    '/risk-assessments/4/edit',
    '/safety-checklists/execute/6',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q149 详情失败态独立', () => {
  test('/approvals/1 失败显示工单不存在或已删除', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/approvals/1'));
    await seedSession(page, adminUser);
    await page.goto('/approvals/1');
    await expect(page.getByText('工单不存在或已删除').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/audit/1 失败显示未找到该审计记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/audit-logs/1'));
    await seedSession(page, adminUser);
    await page.goto('/audit/1');
    await expect(page.getByText('未找到该审计记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/spare-parts/1 失败显示备件不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts/1'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts/1');
    await expect(page.getByText('备件不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/insurances/1 失败显示未找到保险记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/insurance/1'));
    await seedSession(page, adminUser);
    await page.goto('/insurances/1');
    await expect(page.getByText('未找到保险记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/budgets/1 失败显示未找到预算信息', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/budgets/1'));
    await seedSession(page, adminUser);
    await page.goto('/budgets/1');
    await expect(page.getByText('未找到预算信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q150 USER 403 独立', () => {
  for (const path of [
    '/inventory/scan/RFID-6',
    '/assignments/7/edit',
    '/borrows/7/edit',
    '/inspections/7/edit',
    '/inspections/6/upload',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q151 详情失败态独立', () => {
  test('/retirement/1 失败显示未找到该退役申请记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/1'));
    await seedSession(page, adminUser);
    await page.goto('/retirement/1');
    await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/intake/1 失败显示验收单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/intake-orders/1'));
    await seedSession(page, adminUser);
    await page.goto('/intake/1');
    await expect(page.getByText('验收单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/borrows/1 失败显示借用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows/1'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/1');
    await expect(page.getByText('借用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assignments/1 失败显示领用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments/1'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/1');
    await expect(page.getByText('领用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/inspections/1 失败显示检验记录不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/1'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/1');
    await expect(page.getByText('检验记录不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q152 USER 403 独立', () => {
  for (const path of [
    '/workorders/6/acceptance',
    '/risk-assessments/5/edit',
    '/safety-checklists/execute/7',
    '/inventory/scan/RFID-7',
    '/inspections/7/upload',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q153 详情失败态独立', () => {
  test('/assets/1 失败显示获取数据失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/1'));
    await seedSession(page, adminUser);
    await page.goto('/assets/1');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/assets/1 失败显示资产加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/1'));
    await seedSession(page, adminUser);
    await page.goto('/m/assets/1');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/workorders/1/acceptance 失败显示工单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/1'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/1/acceptance');
    await expect(page.getByText('工单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/stocktaking-cycles/1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/cycles/1'));
    await seedSession(page, adminUser);
    await page.goto('/stocktaking-cycles/1');
    await expect(page.getByText('盘点周期不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取盘点周期'))).toEqual([]);
  });

  test('/compensation/1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/compensation/1'));
    await seedSession(page, adminUser);
    await page.goto('/compensation/1');
    await expect(page.getByText('资产赔偿申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q154 USER 403 独立', () => {
  for (const path of [
    '/assignments/8/edit',
    '/borrows/8/edit',
    '/inspections/8/edit',
    '/workorders/7/acceptance',
    '/risk-assessments/6/edit',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q155 失败态/403 独立', () => {
  test('/assets/1/timeline 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/1/history'));
    await seedSession(page, adminUser);
    await page.goto('/assets/1/timeline');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/stocktaking-tasks/3 失败显示获取任务失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/tasks/3'));
    await seedSession(page, adminUser);
    await page.goto('/m/stocktaking-tasks/3');
    await expect(page.getByText('获取任务失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取任务失败'))).toEqual([]);
  });

  test('USER 访问 /inventory/smart-report/INV-003 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/inventory/smart-report/INV-003');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /assignments/9/edit 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/assignments/9/edit');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('USER 访问 /borrows/9/edit 显示无访问权限', async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedSession(page, limitedUser);
    await page.goto('/borrows/9/edit');
    await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Q156 USER 403 独立', () => {
  for (const path of [
    '/inspections/9/edit',
    '/inspections/8/upload',
    '/workorders/8/acceptance',
    '/safety-checklists/execute/8',
    '/inventory/scan/RFID-8',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q157 USER 403 独立', () => {
  for (const path of [
    '/assignments/10/edit',
    '/borrows/10/edit',
    '/inspections/10/edit',
    '/risk-assessments/7/edit',
    '/inventory/smart-report/INV-004',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q158 流程表单失败态独立', () => {
  test('/workflow-form/ASSET_INTAKE 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_INTAKE');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/workflow-form/ASSET_BORROW 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_BORROW');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/workflow-form/ASSET_ASSIGNMENT 失败显示获取数据失败', async ({ page }) => {
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workflows'));
    await seedSession(page, adminUser);
    await page.goto('/workflow-form/ASSET_ASSIGNMENT');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
  });

  test('/assets/2/timeline 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/2/history'));
    await seedSession(page, adminUser);
    await page.goto('/assets/2/timeline');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/stocktaking-tasks/4 失败显示获取任务失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/tasks/4'));
    await seedSession(page, adminUser);
    await page.goto('/m/stocktaking-tasks/4');
    await expect(page.getByText('获取任务失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取任务失败'))).toEqual([]);
  });
});

test.describe('Q159 详情失败态独立', () => {
  test('/spare-parts/2 失败显示备件不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts/2'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts/2');
    await expect(page.getByText('备件不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/insurances/2 失败显示未找到保险记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/insurance/2'));
    await seedSession(page, adminUser);
    await page.goto('/insurances/2');
    await expect(page.getByText('未找到保险记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/budgets/2 失败显示未找到预算信息', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/budgets/2'));
    await seedSession(page, adminUser);
    await page.goto('/budgets/2');
    await expect(page.getByText('未找到预算信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/audit/2 失败显示未找到该审计记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/audit-logs/2'));
    await seedSession(page, adminUser);
    await page.goto('/audit/2');
    await expect(page.getByText('未找到该审计记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/retirement/2 失败显示未找到该退役申请记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/2'));
    await seedSession(page, adminUser);
    await page.goto('/retirement/2');
    await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q160 USER 403 独立', () => {
  for (const path of [
    '/assignments/11/edit',
    '/borrows/11/edit',
    '/inspections/11/edit',
    '/workorders/10/acceptance',
    '/safety-checklists/execute/10',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q161 详情失败态独立', () => {
  test('/approvals/2 失败显示工单不存在或已删除', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/approvals/2'));
    await seedSession(page, adminUser);
    await page.goto('/approvals/2');
    await expect(page.getByText('工单不存在或已删除').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/disposals/2 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/2'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/2');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/intake/2 失败显示验收单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/intake-orders/2'));
    await seedSession(page, adminUser);
    await page.goto('/intake/2');
    await expect(page.getByText('验收单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/borrows/2 失败显示借用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows/2'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/2');
    await expect(page.getByText('借用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assignments/2 失败显示领用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments/2'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/2');
    await expect(page.getByText('领用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q162 USER 403 独立', () => {
  for (const path of [
    '/inventory/scan/RFID-10',
    '/inspections/12/edit',
    '/inspections/10/upload',
    '/workorders/11/acceptance',
    '/risk-assessments/8/edit',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q163 详情失败态独立', () => {
  test('/inspections/2 失败显示检验记录不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/2'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/2');
    await expect(page.getByText('检验记录不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/spare-parts/3 失败显示备件不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts/3'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts/3');
    await expect(page.getByText('备件不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/workorders/2/acceptance 失败显示工单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/2'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/2/acceptance');
    await expect(page.getByText('工单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assets/3 失败显示获取数据失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/3'));
    await seedSession(page, adminUser);
    await page.goto('/assets/3');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/assets/3 失败显示资产加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/3'));
    await seedSession(page, adminUser);
    await page.goto('/m/assets/3');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q164 USER 403 独立', () => {
  for (const path of [
    '/assignments/12/edit',
    '/borrows/12/edit',
    '/inspections/13/edit',
    '/inventory/scan/RFID-11',
    '/safety-checklists/execute/11',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q165 详情失败态独立', () => {
  test('/budgets/3 失败显示未找到预算信息', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/budgets/3'));
    await seedSession(page, adminUser);
    await page.goto('/budgets/3');
    await expect(page.getByText('未找到预算信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/insurances/3 失败显示未找到保险记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/insurance/3'));
    await seedSession(page, adminUser);
    await page.goto('/insurances/3');
    await expect(page.getByText('未找到保险记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/audit/3 失败显示未找到该审计记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/audit-logs/3'));
    await seedSession(page, adminUser);
    await page.goto('/audit/3');
    await expect(page.getByText('未找到该审计记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/retirement/3 失败显示未找到该退役申请记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/3'));
    await seedSession(page, adminUser);
    await page.goto('/retirement/3');
    await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/approvals/3 失败显示工单不存在或已删除', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/approvals/3'));
    await seedSession(page, adminUser);
    await page.goto('/approvals/3');
    await expect(page.getByText('工单不存在或已删除').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q166 USER 403 独立', () => {
  for (const path of [
    '/assignments/13/edit',
    '/borrows/13/edit',
    '/inspections/11/upload',
    '/workorders/12/acceptance',
    '/inventory/smart-report/INV-005',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q167 详情失败态独立', () => {
  test('/disposals/3 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/3'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/3');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/intake/3 失败显示验收单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/intake-orders/3'));
    await seedSession(page, adminUser);
    await page.goto('/intake/3');
    await expect(page.getByText('验收单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/borrows/3 失败显示借用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows/3'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/3');
    await expect(page.getByText('借用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assignments/3 失败显示领用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments/3'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/3');
    await expect(page.getByText('领用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/inspections/3 失败显示检验记录不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/3'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/3');
    await expect(page.getByText('检验记录不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q168 USER 403 独立', () => {
  for (const path of [
    '/assignments/14/edit',
    '/borrows/14/edit',
    '/inspections/14/edit',
    '/inventory/scan/RFID-12',
    '/safety-checklists/execute/12',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q169 详情失败态独立', () => {
  test('/workorders/3/acceptance 失败显示工单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/3'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/3/acceptance');
    await expect(page.getByText('工单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assets/4 失败显示获取数据失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/4'));
    await seedSession(page, adminUser);
    await page.goto('/assets/4');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/assets/4 失败显示资产加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/4'));
    await seedSession(page, adminUser);
    await page.goto('/m/assets/4');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/spare-parts/4 失败显示备件不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts/4'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts/4');
    await expect(page.getByText('备件不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/budgets/4 失败显示未找到预算信息', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/budgets/4'));
    await seedSession(page, adminUser);
    await page.goto('/budgets/4');
    await expect(page.getByText('未找到预算信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q170 详情失败态独立', () => {
  test('/compensation/2 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/compensation/2'));
    await seedSession(page, adminUser);
    await page.goto('/compensation/2');
    await expect(page.getByText('资产赔偿申请').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/stocktaking-cycles/2 失败显示盘点周期不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/cycles/2'));
    await seedSession(page, adminUser);
    await page.goto('/stocktaking-cycles/2');
    await expect(page.getByText('盘点周期不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取盘点周期'))).toEqual([]);
  });

  test('/workorders/2 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/2'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/2');
    await expect(page.getByText('工单详情').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/inspections/3/upload 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/3'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/3/upload');
    await expect(page.getByText('检验照片上传').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => item !== '获取数据失败')).toEqual([]);
  });

  test('/inventory/tasks/3 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inventory/tasks/3'));
    await seedSession(page, adminUser);
    await page.goto('/inventory/tasks/3');
    await expect(page.getByText(/盘点详情|盘点/).first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q171 USER 403 独立', () => {
  for (const path of [
    '/assignments/15/edit',
    '/borrows/15/edit',
    '/inspections/15/edit',
    '/inventory/scan/RFID-13',
    '/safety-checklists/execute/13',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q172 详情失败态独立', () => {
  test('/insurances/4 失败显示未找到保险记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/insurance/4'));
    await seedSession(page, adminUser);
    await page.goto('/insurances/4');
    await expect(page.getByText('未找到保险记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/audit/4 失败显示未找到该审计记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/audit-logs/4'));
    await seedSession(page, adminUser);
    await page.goto('/audit/4');
    await expect(page.getByText('未找到该审计记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/retirement/4 失败显示未找到该退役申请记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/4'));
    await seedSession(page, adminUser);
    await page.goto('/retirement/4');
    await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/approvals/4 失败显示工单不存在或已删除', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/approvals/4'));
    await seedSession(page, adminUser);
    await page.goto('/approvals/4');
    await expect(page.getByText('工单不存在或已删除').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/disposals/4 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/4'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/4');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q173 USER 403 独立', () => {
  for (const path of [
    '/assignments/16/edit',
    '/borrows/16/edit',
    '/inspections/16/edit',
    '/inventory/scan/RFID-14',
    '/safety-checklists/execute/14',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q174 详情失败态独立', () => {
  test('/intake/4 失败显示验收单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/intake-orders/4'));
    await seedSession(page, adminUser);
    await page.goto('/intake/4');
    await expect(page.getByText('验收单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/borrows/4 失败显示借用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows/4'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/4');
    await expect(page.getByText('借用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assignments/4 失败显示领用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments/4'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/4');
    await expect(page.getByText('领用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/inspections/4 失败显示检验记录不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/4'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/4');
    await expect(page.getByText('检验记录不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/workorders/4/acceptance 失败显示工单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/4'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/4/acceptance');
    await expect(page.getByText('工单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q175 USER 403 独立', () => {
  for (const path of [
    '/assignments/17/edit',
    '/borrows/17/edit',
    '/inspections/17/edit',
    '/inventory/scan/RFID-15',
    '/safety-checklists/execute/15',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q176 详情失败态独立', () => {
  test('/assets/5 失败显示获取数据失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assets/5'));
    await seedSession(page, adminUser);
    await page.goto('/assets/5');
    await expect(page.getByText('获取数据失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/assets/5 失败显示资产加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/mobile/assets/5'));
    await seedSession(page, adminUser);
    await page.goto('/m/assets/5');
    await expect(page.getByText('资产加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/spare-parts/5 失败显示备件不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/spare-parts/5'));
    await seedSession(page, adminUser);
    await page.goto('/spare-parts/5');
    await expect(page.getByText('备件不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/budgets/5 失败显示未找到预算信息', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/budgets/5'));
    await seedSession(page, adminUser);
    await page.goto('/budgets/5');
    await expect(page.getByText('未找到预算信息').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/insurances/5 失败显示未找到保险记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/insurance/5'));
    await seedSession(page, adminUser);
    await page.goto('/insurances/5');
    await expect(page.getByText('未找到保险记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q177 USER 403 独立', () => {
  for (const path of [
    '/assignments/18/edit',
    '/borrows/18/edit',
    '/inspections/18/edit',
    '/inventory/scan/RFID-16',
    '/safety-checklists/execute/16',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q178 详情失败态独立', () => {
  test('/audit/5 失败显示未找到该审计记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/audit-logs/5'));
    await seedSession(page, adminUser);
    await page.goto('/audit/5');
    await expect(page.getByText('未找到该审计记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/retirement/5 失败显示未找到该退役申请记录', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/5'));
    await seedSession(page, adminUser);
    await page.goto('/retirement/5');
    await expect(page.getByText('未找到该退役申请记录').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/approvals/5 失败显示工单不存在或已删除', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/approvals/5'));
    await seedSession(page, adminUser);
    await page.goto('/approvals/5');
    await expect(page.getByText('工单不存在或已删除').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/disposals/5 失败显示加载失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/retirement/5'));
    await seedSession(page, adminUser);
    await page.goto('/disposals/5');
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/intake/5 失败显示验收单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/intake-orders/5'));
    await seedSession(page, adminUser);
    await page.goto('/intake/5');
    await expect(page.getByText('验收单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });
});

test.describe('Q179 USER 403 独立', () => {
  for (const path of [
    '/assignments/19/edit',
    '/borrows/19/edit',
    '/inspections/19/edit',
    '/inventory/scan/RFID-17',
    '/safety-checklists/execute/17',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q180 详情失败态独立', () => {
  test('/borrows/5 失败显示借用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/borrows/5'));
    await seedSession(page, adminUser);
    await page.goto('/borrows/5');
    await expect(page.getByText('借用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/assignments/5 失败显示领用单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/assignments/5'));
    await seedSession(page, adminUser);
    await page.goto('/assignments/5');
    await expect(page.getByText('领用单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/inspections/5 失败显示检验记录不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/inspections/5'));
    await seedSession(page, adminUser);
    await page.goto('/inspections/5');
    await expect(page.getByText('检验记录不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/workorders/5/acceptance 失败显示工单不存在', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/workorders/5'));
    await seedSession(page, adminUser);
    await page.goto('/workorders/5/acceptance');
    await expect(page.getByText('工单不存在').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败'))).toEqual([]);
  });

  test('/m/stocktaking-tasks/5 失败显示获取任务失败', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/stocktaking/tasks/5'));
    await seedSession(page, adminUser);
    await page.goto('/m/stocktaking-tasks/5');
    await expect(page.getByText('获取任务失败').first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((item) => !item.includes('获取数据失败') && !item.includes('获取任务失败'))).toEqual([]);
  });
});

test.describe('Q181 USER 403 独立', () => {
  for (const path of [
    '/assignments/20/edit',
    '/borrows/20/edit',
    '/inspections/20/edit',
    '/inventory/scan/RFID-18',
    '/safety-checklists/execute/18',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q182 USER 403 独立', () => {
  for (const path of [
    '/assignments/21/edit',
    '/workorders/13/acceptance',
    '/risk-assessments/9/edit',
    '/inspections/12/upload',
    '/inventory/smart-report/INV-006',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q183 USER 403 独立', () => {
  for (const path of [
    '/borrows/21/edit',
    '/inspections/21/edit',
    '/inventory/scan/RFID-19',
    '/safety-checklists/execute/19',
    '/workorders/14/acceptance',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q184 USER 403 独立', () => {
  for (const path of [
    '/assignments/22/edit',
    '/borrows/22/edit',
    '/inspections/22/edit',
    '/inventory/scan/RFID-20',
    '/safety-checklists/execute/20',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q185 USER 403 独立', () => {
  for (const path of [
    '/assignments/23/edit',
    '/borrows/23/edit',
    '/inspections/23/edit',
    '/inventory/scan/RFID-21',
    '/safety-checklists/execute/21',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q186 USER 403 独立', () => {
  for (const path of [
    '/assignments/24/edit',
    '/borrows/24/edit',
    '/inspections/24/edit',
    '/inventory/scan/RFID-22',
    '/safety-checklists/execute/22',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q187 USER 403 独立', () => {
  for (const path of [
    '/assignments/25/edit',
    '/borrows/25/edit',
    '/inspections/25/edit',
    '/inventory/scan/RFID-23',
    '/safety-checklists/execute/23',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q188 USER 403 独立', () => {
  for (const path of [
    '/assignments/26/edit',
    '/borrows/26/edit',
    '/inspections/26/edit',
    '/inventory/scan/RFID-24',
    '/safety-checklists/execute/24',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q189 USER 403 独立', () => {
  for (const path of [
    '/assignments/27/edit',
    '/borrows/27/edit',
    '/inspections/27/edit',
    '/inventory/scan/RFID-25',
    '/safety-checklists/execute/25',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q190 USER 403 独立', () => {
  for (const path of [
    '/assignments/28/edit',
    '/borrows/28/edit',
    '/inspections/28/edit',
    '/inventory/scan/RFID-26',
    '/safety-checklists/execute/26',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q191 USER 403 独立', () => {
  for (const path of [
    '/assignments/29/edit',
    '/borrows/29/edit',
    '/inspections/29/edit',
    '/inventory/scan/RFID-27',
    '/safety-checklists/execute/27',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q192 USER 403 独立', () => {
  for (const path of [
    '/assignments/30/edit',
    '/borrows/30/edit',
    '/inspections/30/edit',
    '/inventory/scan/RFID-28',
    '/safety-checklists/execute/28',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q193 USER 403 独立', () => {
  for (const path of [
    '/assignments/31/edit',
    '/borrows/31/edit',
    '/inspections/31/edit',
    '/inventory/scan/RFID-29',
    '/safety-checklists/execute/29',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q194 USER 403 独立', () => {
  for (const path of [
    '/assignments/32/edit',
    '/borrows/32/edit',
    '/inspections/32/edit',
    '/inventory/scan/RFID-30',
    '/safety-checklists/execute/30',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q195 USER 403 独立', () => {
  for (const path of [
    '/assignments/33/edit',
    '/borrows/33/edit',
    '/inspections/33/edit',
    '/inventory/scan/RFID-31',
    '/safety-checklists/execute/31',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q196 USER 403 独立', () => {
  for (const path of [
    '/assignments/34/edit',
    '/borrows/34/edit',
    '/inspections/34/edit',
    '/inventory/scan/RFID-32',
    '/safety-checklists/execute/32',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q197 USER 403 独立', () => {
  for (const path of [
    '/assignments/35/edit',
    '/borrows/35/edit',
    '/inspections/35/edit',
    '/inventory/scan/RFID-33',
    '/safety-checklists/execute/33',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q198 USER 403 独立', () => {
  for (const path of [
    '/assignments/36/edit',
    '/borrows/36/edit',
    '/inspections/36/edit',
    '/inventory/scan/RFID-34',
    '/safety-checklists/execute/34',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q199 USER 403 独立', () => {
  for (const path of [
    '/assignments/37/edit',
    '/borrows/37/edit',
    '/inspections/37/edit',
    '/inventory/scan/RFID-35',
    '/safety-checklists/execute/35',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q200 USER 403 独立', () => {
  for (const path of [
    '/assignments/38/edit',
    '/borrows/38/edit',
    '/inspections/38/edit',
    '/inventory/scan/RFID-36',
    '/safety-checklists/execute/36',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q201 USER 403 独立', () => {
  for (const path of [
    '/assignments/39/edit',
    '/borrows/39/edit',
    '/inspections/39/edit',
    '/inventory/scan/RFID-37',
    '/safety-checklists/execute/37',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q202 USER 403 独立', () => {
  for (const path of [
    '/assignments/40/edit',
    '/borrows/40/edit',
    '/inspections/40/edit',
    '/inventory/scan/RFID-38',
    '/safety-checklists/execute/38',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q203 USER 403 独立', () => {
  for (const path of [
    '/assignments/41/edit',
    '/borrows/41/edit',
    '/inspections/41/edit',
    '/inventory/scan/RFID-39',
    '/safety-checklists/execute/39',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q204 USER 403 独立', () => {
  for (const path of [
    '/assignments/42/edit',
    '/borrows/42/edit',
    '/inspections/42/edit',
    '/inventory/scan/RFID-40',
    '/safety-checklists/execute/40',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q205 USER 403 独立', () => {
  for (const path of [
    '/assignments/43/edit',
    '/borrows/43/edit',
    '/inspections/43/edit',
    '/inventory/scan/RFID-41',
    '/safety-checklists/execute/41',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q206 USER 403 独立', () => {
  for (const path of [
    '/assignments/44/edit',
    '/borrows/44/edit',
    '/inspections/44/edit',
    '/inventory/scan/RFID-42',
    '/safety-checklists/execute/42',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q207 USER 403 独立', () => {
  for (const path of [
    '/assignments/45/edit',
    '/borrows/45/edit',
    '/inspections/45/edit',
    '/inventory/scan/RFID-43',
    '/safety-checklists/execute/43',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q208 USER 403 独立', () => {
  for (const path of [
    '/assignments/46/edit',
    '/borrows/46/edit',
    '/inspections/46/edit',
    '/inventory/scan/RFID-44',
    '/safety-checklists/execute/44',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q209 USER 403 独立', () => {
  for (const path of [
    '/assignments/47/edit',
    '/borrows/47/edit',
    '/inspections/47/edit',
    '/inventory/scan/RFID-45',
    '/safety-checklists/execute/45',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q210 USER 403 独立', () => {
  for (const path of [
    '/assignments/48/edit',
    '/borrows/48/edit',
    '/inspections/48/edit',
    '/inventory/scan/RFID-46',
    '/safety-checklists/execute/46',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q211 USER 403 独立', () => {
  for (const path of [
    '/assignments/49/edit',
    '/borrows/49/edit',
    '/inspections/49/edit',
    '/inventory/scan/RFID-47',
    '/safety-checklists/execute/47',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q212 USER 403 独立', () => {
  for (const path of [
    '/assignments/50/edit',
    '/borrows/50/edit',
    '/inspections/50/edit',
    '/inventory/scan/RFID-48',
    '/safety-checklists/execute/48',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q213 USER 403 独立', () => {
  for (const path of [
    '/assignments/51/edit',
    '/borrows/51/edit',
    '/inspections/51/edit',
    '/inventory/scan/RFID-49',
    '/safety-checklists/execute/49',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q214 USER 403 独立', () => {
  for (const path of [
    '/assignments/52/edit',
    '/borrows/52/edit',
    '/inspections/52/edit',
    '/inventory/scan/RFID-50',
    '/safety-checklists/execute/50',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q215 USER 403 独立', () => {
  for (const path of [
    '/assignments/53/edit',
    '/borrows/53/edit',
    '/inspections/53/edit',
    '/inventory/scan/RFID-51',
    '/safety-checklists/execute/51',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q216 USER 403 独立', () => {
  for (const path of [
    '/assignments/54/edit',
    '/borrows/54/edit',
    '/inspections/54/edit',
    '/inventory/scan/RFID-52',
    '/safety-checklists/execute/52',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q217 USER 403 独立', () => {
  for (const path of [
    '/assignments/55/edit',
    '/borrows/55/edit',
    '/inspections/55/edit',
    '/inventory/scan/RFID-53',
    '/safety-checklists/execute/53',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q218 USER 403 独立', () => {
  for (const path of [
    '/assignments/56/edit',
    '/borrows/56/edit',
    '/inspections/56/edit',
    '/inventory/scan/RFID-54',
    '/safety-checklists/execute/54',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q219 USER 403 独立', () => {
  for (const path of [
    '/assignments/57/edit',
    '/borrows/57/edit',
    '/inspections/57/edit',
    '/inventory/scan/RFID-55',
    '/safety-checklists/execute/55',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q220 USER 403 独立', () => {
  for (const path of [
    '/assignments/58/edit',
    '/borrows/58/edit',
    '/inspections/58/edit',
    '/inventory/scan/RFID-56',
    '/safety-checklists/execute/56',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q221 USER 403 独立', () => {
  for (const path of [
    '/assignments/59/edit',
    '/borrows/59/edit',
    '/inspections/59/edit',
    '/inventory/scan/RFID-57',
    '/safety-checklists/execute/57',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q222 USER 403 独立', () => {
  for (const path of [
    '/assignments/60/edit',
    '/borrows/60/edit',
    '/inspections/60/edit',
    '/inventory/scan/RFID-58',
    '/safety-checklists/execute/58',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q223 USER 403 独立', () => {
  for (const path of [
    '/assignments/61/edit',
    '/borrows/61/edit',
    '/inspections/61/edit',
    '/inventory/scan/RFID-59',
    '/safety-checklists/execute/59',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q224 USER 403 独立', () => {
  for (const path of [
    '/assignments/62/edit',
    '/borrows/62/edit',
    '/inspections/62/edit',
    '/inventory/scan/RFID-60',
    '/safety-checklists/execute/60',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q225 USER 403 独立', () => {
  for (const path of [
    '/assignments/63/edit',
    '/borrows/63/edit',
    '/inspections/63/edit',
    '/inventory/scan/RFID-61',
    '/safety-checklists/execute/61',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q226 USER 403 独立', () => {
  for (const path of [
    '/assignments/64/edit',
    '/borrows/64/edit',
    '/inspections/64/edit',
    '/inventory/scan/RFID-62',
    '/safety-checklists/execute/62',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q227 USER 403 独立', () => {
  for (const path of [
    '/assignments/65/edit',
    '/borrows/65/edit',
    '/inspections/65/edit',
    '/inventory/scan/RFID-63',
    '/safety-checklists/execute/63',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q228 USER 403 独立', () => {
  for (const path of [
    '/assignments/66/edit',
    '/borrows/66/edit',
    '/inspections/66/edit',
    '/inventory/scan/RFID-64',
    '/safety-checklists/execute/64',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q229 USER 403 独立', () => {
  for (const path of [
    '/assignments/67/edit',
    '/borrows/67/edit',
    '/inspections/67/edit',
    '/inventory/scan/RFID-65',
    '/safety-checklists/execute/65',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q230 USER 403 独立', () => {
  for (const path of [
    '/assignments/68/edit',
    '/borrows/68/edit',
    '/inspections/68/edit',
    '/inventory/scan/RFID-66',
    '/safety-checklists/execute/66',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q231 USER 403 独立', () => {
  for (const path of [
    '/assignments/69/edit',
    '/borrows/69/edit',
    '/inspections/69/edit',
    '/inventory/scan/RFID-67',
    '/safety-checklists/execute/67',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q232 USER 403 独立', () => {
  for (const path of [
    '/assignments/70/edit',
    '/borrows/70/edit',
    '/inspections/70/edit',
    '/inventory/scan/RFID-68',
    '/safety-checklists/execute/68',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q233 USER 403 独立', () => {
  for (const path of [
    '/assignments/71/edit',
    '/borrows/71/edit',
    '/inspections/71/edit',
    '/inventory/scan/RFID-69',
    '/safety-checklists/execute/69',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q234 USER 403 独立', () => {
  for (const path of [
    '/assignments/72/edit',
    '/borrows/72/edit',
    '/inspections/72/edit',
    '/inventory/scan/RFID-70',
    '/safety-checklists/execute/70',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q235 USER 403 独立', () => {
  for (const path of [
    '/assignments/73/edit',
    '/borrows/73/edit',
    '/inspections/73/edit',
    '/inventory/scan/RFID-71',
    '/safety-checklists/execute/71',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q236 USER 403 独立', () => {
  for (const path of [
    '/assignments/74/edit',
    '/borrows/74/edit',
    '/inspections/74/edit',
    '/inventory/scan/RFID-72',
    '/safety-checklists/execute/72',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q237 USER 403 独立', () => {
  for (const path of [
    '/assignments/75/edit',
    '/borrows/75/edit',
    '/inspections/75/edit',
    '/inventory/scan/RFID-73',
    '/safety-checklists/execute/73',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q238 USER 403 独立', () => {
  for (const path of [
    '/assignments/76/edit',
    '/borrows/76/edit',
    '/inspections/76/edit',
    '/inventory/scan/RFID-74',
    '/safety-checklists/execute/74',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q239 USER 403 独立', () => {
  for (const path of [
    '/assignments/77/edit',
    '/borrows/77/edit',
    '/inspections/77/edit',
    '/inventory/scan/RFID-75',
    '/safety-checklists/execute/75',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q240 USER 403 独立', () => {
  for (const path of [
    '/assignments/78/edit',
    '/borrows/78/edit',
    '/inspections/78/edit',
    '/inventory/scan/RFID-76',
    '/safety-checklists/execute/76',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q241 USER 403 独立', () => {
  for (const path of [
    '/assignments/79/edit',
    '/borrows/79/edit',
    '/inspections/79/edit',
    '/inventory/scan/RFID-77',
    '/safety-checklists/execute/77',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q242 USER 403 独立', () => {
  for (const path of [
    '/assignments/80/edit',
    '/borrows/80/edit',
    '/inspections/80/edit',
    '/inventory/scan/RFID-78',
    '/safety-checklists/execute/78',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q243 USER 403 独立', () => {
  for (const path of [
    '/assignments/81/edit',
    '/borrows/81/edit',
    '/inspections/81/edit',
    '/inventory/scan/RFID-79',
    '/safety-checklists/execute/79',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q244 USER 403 独立', () => {
  for (const path of [
    '/assignments/82/edit',
    '/borrows/82/edit',
    '/inspections/82/edit',
    '/inventory/scan/RFID-80',
    '/safety-checklists/execute/80',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q245 USER 403 独立', () => {
  for (const path of [
    '/assignments/83/edit',
    '/borrows/83/edit',
    '/inspections/83/edit',
    '/inventory/scan/RFID-81',
    '/safety-checklists/execute/81',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q246 USER 403 独立', () => {
  for (const path of [
    '/assignments/84/edit',
    '/borrows/84/edit',
    '/inspections/84/edit',
    '/inventory/scan/RFID-82',
    '/safety-checklists/execute/82',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q247 USER 403 独立', () => {
  for (const path of [
    '/assignments/85/edit',
    '/borrows/85/edit',
    '/inspections/85/edit',
    '/inventory/scan/RFID-83',
    '/safety-checklists/execute/83',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q248 USER 403 独立', () => {
  for (const path of [
    '/assignments/86/edit',
    '/borrows/86/edit',
    '/inspections/86/edit',
    '/inventory/scan/RFID-84',
    '/safety-checklists/execute/84',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q249 USER 403 独立', () => {
  for (const path of [
    '/assignments/87/edit',
    '/borrows/87/edit',
    '/inspections/87/edit',
    '/inventory/scan/RFID-85',
    '/safety-checklists/execute/85',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q250 USER 403 独立', () => {
  for (const path of [
    '/assignments/88/edit',
    '/borrows/88/edit',
    '/inspections/88/edit',
    '/inventory/scan/RFID-86',
    '/safety-checklists/execute/86',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q251 USER 403 独立', () => {
  for (const path of [
    '/assignments/89/edit',
    '/borrows/89/edit',
    '/inspections/89/edit',
    '/inventory/scan/RFID-87',
    '/safety-checklists/execute/87',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q252 USER 403 独立', () => {
  for (const path of [
    '/assignments/90/edit',
    '/borrows/90/edit',
    '/inspections/90/edit',
    '/inventory/scan/RFID-88',
    '/safety-checklists/execute/88',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q253 USER 403 独立', () => {
  for (const path of [
    '/assignments/91/edit',
    '/borrows/91/edit',
    '/inspections/91/edit',
    '/inventory/scan/RFID-89',
    '/safety-checklists/execute/89',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q254 USER 403 独立', () => {
  for (const path of [
    '/assignments/92/edit',
    '/borrows/92/edit',
    '/inspections/92/edit',
    '/inventory/scan/RFID-90',
    '/safety-checklists/execute/90',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q255 USER 403 独立', () => {
  for (const path of [
    '/assignments/93/edit',
    '/borrows/93/edit',
    '/inspections/93/edit',
    '/inventory/scan/RFID-91',
    '/safety-checklists/execute/91',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q256 USER 403 独立', () => {
  for (const path of [
    '/assignments/94/edit',
    '/borrows/94/edit',
    '/inspections/94/edit',
    '/inventory/scan/RFID-92',
    '/safety-checklists/execute/92',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q257 USER 403 独立', () => {
  for (const path of [
    '/assignments/95/edit',
    '/borrows/95/edit',
    '/inspections/95/edit',
    '/inventory/scan/RFID-93',
    '/safety-checklists/execute/93',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q258 USER 403 独立', () => {
  for (const path of [
    '/assignments/96/edit',
    '/borrows/96/edit',
    '/inspections/96/edit',
    '/inventory/scan/RFID-94',
    '/safety-checklists/execute/94',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q259 USER 403 独立', () => {
  for (const path of [
    '/assignments/97/edit',
    '/borrows/97/edit',
    '/inspections/97/edit',
    '/inventory/scan/RFID-95',
    '/safety-checklists/execute/95',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q260 USER 403 独立', () => {
  for (const path of [
    '/assignments/98/edit',
    '/borrows/98/edit',
    '/inspections/98/edit',
    '/inventory/scan/RFID-96',
    '/safety-checklists/execute/96',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q261 USER 403 独立', () => {
  for (const path of [
    '/assignments/99/edit',
    '/borrows/99/edit',
    '/inspections/99/edit',
    '/inventory/scan/RFID-97',
    '/safety-checklists/execute/97',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q262 USER 403 独立', () => {
  for (const path of [
    '/assignments/100/edit',
    '/borrows/100/edit',
    '/inspections/100/edit',
    '/inventory/scan/RFID-98',
    '/safety-checklists/execute/98',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q263 USER 403 独立', () => {
  for (const path of [
    '/assignments/101/edit',
    '/borrows/101/edit',
    '/inspections/101/edit',
    '/inventory/scan/RFID-99',
    '/safety-checklists/execute/99',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q264 USER 403 独立', () => {
  for (const path of [
    '/assignments/102/edit',
    '/borrows/102/edit',
    '/inspections/102/edit',
    '/inventory/scan/RFID-100',
    '/safety-checklists/execute/100',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q265 USER 403 独立', () => {
  for (const path of [
    '/assignments/103/edit',
    '/borrows/103/edit',
    '/inspections/103/edit',
    '/inventory/scan/RFID-101',
    '/safety-checklists/execute/101',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q266 USER 403 独立', () => {
  for (const path of [
    '/assignments/104/edit',
    '/borrows/104/edit',
    '/inspections/104/edit',
    '/inventory/scan/RFID-102',
    '/safety-checklists/execute/102',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q267 USER 403 独立', () => {
  for (const path of [
    '/assignments/105/edit',
    '/borrows/105/edit',
    '/inspections/105/edit',
    '/inventory/scan/RFID-103',
    '/safety-checklists/execute/103',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q268 USER 403 独立', () => {
  for (const path of [
    '/assignments/106/edit',
    '/borrows/106/edit',
    '/inspections/106/edit',
    '/inventory/scan/RFID-104',
    '/safety-checklists/execute/104',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q269 USER 403 独立', () => {
  for (const path of [
    '/assignments/107/edit',
    '/borrows/107/edit',
    '/inspections/107/edit',
    '/inventory/scan/RFID-105',
    '/safety-checklists/execute/105',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q270 USER 403 独立', () => {
  for (const path of [
    '/assignments/108/edit',
    '/borrows/108/edit',
    '/inspections/108/edit',
    '/inventory/scan/RFID-106',
    '/safety-checklists/execute/106',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q271 USER 403 独立', () => {
  for (const path of [
    '/assignments/109/edit',
    '/borrows/109/edit',
    '/inspections/109/edit',
    '/inventory/scan/RFID-107',
    '/safety-checklists/execute/107',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q272 USER 403 独立', () => {
  for (const path of [
    '/assignments/110/edit',
    '/borrows/110/edit',
    '/inspections/110/edit',
    '/inventory/scan/RFID-108',
    '/safety-checklists/execute/108',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q273 USER 403 独立', () => {
  for (const path of [
    '/assignments/111/edit',
    '/borrows/111/edit',
    '/inspections/111/edit',
    '/inventory/scan/RFID-109',
    '/safety-checklists/execute/109',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q274 USER 403 独立', () => {
  for (const path of [
    '/assignments/112/edit',
    '/borrows/112/edit',
    '/inspections/112/edit',
    '/inventory/scan/RFID-110',
    '/safety-checklists/execute/110',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q275 USER 403 独立', () => {
  for (const path of [
    '/assignments/113/edit',
    '/borrows/113/edit',
    '/inspections/113/edit',
    '/inventory/scan/RFID-111',
    '/safety-checklists/execute/111',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q276 USER 403 独立', () => {
  for (const path of [
    '/assignments/114/edit',
    '/borrows/114/edit',
    '/inspections/114/edit',
    '/inventory/scan/RFID-112',
    '/safety-checklists/execute/112',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q277 USER 403 独立', () => {
  for (const path of [
    '/assignments/115/edit',
    '/borrows/115/edit',
    '/inspections/115/edit',
    '/inventory/scan/RFID-113',
    '/safety-checklists/execute/113',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q278 USER 403 独立', () => {
  for (const path of [
    '/assignments/116/edit',
    '/borrows/116/edit',
    '/inspections/116/edit',
    '/inventory/scan/RFID-114',
    '/safety-checklists/execute/114',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q279 USER 403 独立', () => {
  for (const path of [
    '/assignments/117/edit',
    '/borrows/117/edit',
    '/inspections/117/edit',
    '/inventory/scan/RFID-115',
    '/safety-checklists/execute/115',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q280 USER 403 独立', () => {
  for (const path of [
    '/assignments/118/edit',
    '/borrows/118/edit',
    '/inspections/118/edit',
    '/inventory/scan/RFID-116',
    '/safety-checklists/execute/116',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q281 USER 403 独立', () => {
  for (const path of [
    '/assignments/119/edit',
    '/borrows/119/edit',
    '/inspections/119/edit',
    '/inventory/scan/RFID-117',
    '/safety-checklists/execute/117',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q282 USER 403 独立', () => {
  for (const path of [
    '/assignments/120/edit',
    '/borrows/120/edit',
    '/inspections/120/edit',
    '/inventory/scan/RFID-118',
    '/safety-checklists/execute/118',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q283 USER 403 独立', () => {
  for (const path of [
    '/assignments/121/edit',
    '/borrows/121/edit',
    '/inspections/121/edit',
    '/inventory/scan/RFID-119',
    '/safety-checklists/execute/119',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q284 USER 403 独立', () => {
  for (const path of [
    '/assignments/122/edit',
    '/borrows/122/edit',
    '/inspections/122/edit',
    '/inventory/scan/RFID-120',
    '/safety-checklists/execute/120',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q285 USER 403 独立', () => {
  for (const path of [
    '/assignments/123/edit',
    '/borrows/123/edit',
    '/inspections/123/edit',
    '/inventory/scan/RFID-121',
    '/safety-checklists/execute/121',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Q286 USER 403 独立', () => {
  for (const path of [
    '/assignments/124/edit',
    '/borrows/124/edit',
    '/inspections/124/edit',
    '/inventory/scan/RFID-122',
    '/safety-checklists/execute/122',
  ]) {
    test(`USER 访问 ${path} 显示无访问权限`, async ({ page }) => {
      await page.route('**/api/**', mockApi);
      await seedSession(page, limitedUser);
      await page.goto(path);
      await expect(page.getByRole('heading', { name: '无访问权限' }).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  const ignored = [
    'downloadable font: download failed',
    'Image corrupt or truncated.',
    'Failed to load resource',
    'ResizeObserver loop',
    'Encountered two children with the same key',
    '[antd:',
    'Error creating WebGL context',
    '[ErrorBoundary]',
  ];
  const shouldIgnore = (text: string) => ignored.some((message) => text.includes(message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !shouldIgnore(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (!shouldIgnore(error.message)) {
      errors.push(error.message);
    }
  });
  return errors;
}

async function seedSession(page: Page, user: AuthUser) {
  await page.addInitScript(({ authUser }) => {
    window.localStorage.setItem('auth_token', 'empty-error-smoke-token');
    window.localStorage.setItem('user_info', JSON.stringify(authUser));
    window.sessionStorage.setItem('auth_token', 'empty-error-smoke-token');
    window.sessionStorage.setItem('user_info', JSON.stringify(authUser));
  }, { authUser: user });
}

async function mockApiWithFailure(route: Route, failPath: string) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');
  if (path === failPath || path.startsWith(`${failPath}/`) || (failPath === '/categories/tree' && path.startsWith('/categories'))) {
    return fulfill(route, null, 500, '获取数据失败');
  }
  return mockApi(route);
}

async function mockApi(route: Route) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/auth/login' || path === '/user-management/current' || path === '/users/current') {
    return fulfill(route, { token: 'empty-error-smoke-token', ...adminUser });
  }
  if (path === '/menus/current') {
    return fulfill(route, { menus: [], permissions: [], roles: adminUser.roles });
  }
  if (path === '/mobile/dashboard') {
    return fulfill(route, {
      totalAssets: 0,
      inUseAssets: 0,
      idleAssets: 0,
      scrapAssets: 0,
      pendingWorkOrders: 0,
      unreadNotifications: 0,
    });
  }
  if (path === '/mobile/notifications') {
    return fulfill(route, []);
  }
  if (/^\/mobile\/assets\/\d+$/.test(path)) {
    if (path.endsWith('/999')) {
      return fulfill(route, null);
    }
    return fulfill(route, {
      id: 1,
      assetNo: 'E2E-ASSET',
      assetName: 'E2E资产',
      status: 'IN_USE',
    });
  }
  if (/^\/assets\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      assetNo: 'E2E-ASSET',
      assetName: 'E2E资产',
      status: 'IN_USE',
    });
  }
  if (/^\/stocktaking\/cycles\/\d+$/.test(path)) {
    return fulfill(route, { id: 1, cycleName: 'E2E周期', status: 'PLANNED' });
  }
  if (/^\/stocktaking\/cycles\/\d+\/(tasks|stats)$/.test(path)) {
    return fulfill(route, path.endsWith('/tasks') ? [] : {});
  }
  if (/^\/spare-parts\/\d+\/usages$/.test(path)) {
    return fulfill(route, []);
  }
  if (/^\/spare-parts\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      partName: 'E2E备件',
      partNo: 'SP-001',
      currentStock: 1,
      safetyStock: 0,
    });
  }
  if (/\/inspections\/\d+\/photos$/.test(path)) {
    return fulfill(route, []);
  }
  if (/\/inspections\/\d+$/.test(path)) {
    return fulfill(route, { id: 1, inspectionNo: 'INSP-001', status: 'PENDING' });
  }
  if (/\/inventory\/tasks\/[^/]+\/summary$/.test(path)) {
    return fulfill(route, {
      surplusCount: 0,
      deficitCount: 0,
      surplusItems: [],
      deficitItems: [],
    });
  }
  if (path.endsWith('/inventory/tasks/INV-001') || path.endsWith('/inventory/tasks/1') || path.endsWith('/inventory/tasks/RFID-1')) {
    return fulfill(route, {
      task: {
        id: path.endsWith('/RFID-1') ? 'RFID-1' : path.endsWith('/1') ? 1 : 'INV-001',
        taskName: path.endsWith('/RFID-1') ? 'RFID扫描任务' : path.endsWith('/1') ? '办公室盘点' : 'E2E盘点任务',
        status: 'IN_PROGRESS',
        totalCount: 1,
        matchedCount: 0,
        createTime: '2026-05-01T00:00:00',
        updateTime: '2026-05-01T00:00:00',
      },
    });
  }
  if (
    path === '/energy/dashboard'
    || path === '/reliability/summary'
    || path === '/gis/stats'
    || path === '/bigscreen/stats'
    || path === '/dashboard/stats'
  ) {
    return fulfill(route, {});
  }
  if (
    path === '/risk-assessments/matrix'
    || path === '/categories/tree'
    || path === '/contracts/expiring'
    || path === '/stocktaking/cycles'
    || path === '/menus/admin/tree'
    || path === '/fault-codes/tree'
    || path === '/gis/assets'
    || path === '/maintenance/upcoming'
    || path === '/menus/admin'
    || path === '/reliability/trend'
    || path === '/reliability/ranking'
    || path === '/asset-health/unhealthy'
    || path === '/asset-health/batch'
    || path === '/manufacturers/options'
    || path === '/system/custom-fieldsets/all'
    || path === '/categories/all'
    || path === '/depts/tree'
    || path === '/roles/all'
    || path === '/posts/all'
    || path === '/locations/tree'
    || path === '/locations/cascade'
    || /\/assets\/[^/]+\/history$/.test(path)
    || /\/assets\/\d+\/(depreciation-schedule|attachments)$/.test(path)
  ) {
    return fulfill(route, []);
  }
  return fulfill(route, { records: [], total: 0, size: 10, current: 1, pages: 1 });
}

async function fulfill(route: Route, data: unknown, code = 200, message = 'OK') {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code, message, data }),
  });
}
