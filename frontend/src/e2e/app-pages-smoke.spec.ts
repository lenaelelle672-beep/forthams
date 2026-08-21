import { expect, test, type Page, type Route } from '@playwright/test';

const authUser = {
  userId: 1,
  username: 'admin',
  realName: '系统管理员',
  roles: ['ADMIN', 'SUPER_ADMIN'],
  permissions: [],
};

const appPages: Array<{ path: string; heading: string }> = [
  { path: '/dashboard', heading: '运营首页' },
  { path: '/assets', heading: '资产台账' },
  { path: '/inventory', heading: '盘点管理' },
  { path: '/analytics', heading: '数据分析' },
  { path: '/retirement', heading: '资产退役管理' },
  { path: '/depreciation', heading: '折旧管理' },
  { path: '/revaluations', heading: '资产减值/重估' },
  { path: '/budgets', heading: '预算管理' },
  { path: '/assignments', heading: '资产领用归还' },
  { path: '/borrows', heading: '资产借用' },
  { path: '/intake', heading: '入库验收' },
  { path: '/purchase-orders', heading: '采购订单管理' },
  { path: '/contracts', heading: '合同管理' },
  { path: '/maintenance', heading: '维保管理' },
  { path: '/maintenance/plans', heading: '维保计划管理' },
  { path: '/fault-codes', heading: '故障代码管理' },
  { path: '/spare-parts', heading: '备品备件管理' },
  { path: '/insurances', heading: '保险管理' },
  { path: '/inspections', heading: '检验/年检管理' },
  { path: '/inspection-records', heading: '检验记录管理' },
  { path: '/stocktaking-cycles', heading: '循环盘点周期' },
  { path: '/inventory/abc-classification', heading: 'ABC 分类管理' },
  { path: '/risk-assessments', heading: '风险矩阵' },
  { path: '/risk-matrix', heading: '风险矩阵配置' },
  { path: '/safety-checklists/config', heading: '安全检查表模板' },
  { path: '/safety-checklists/history', heading: '安全检查历史' },
  { path: '/energy', heading: '能耗管理' },
  { path: '/gis', heading: 'GIS 资产地图' },
  { path: '/floorplans', heading: '2D/3D 平面图' },
  { path: '/licenses', heading: '软件许可证管理' },
  { path: '/sam', heading: 'SAM 合规管理' },
  { path: '/audit', heading: '审计日志' },
  { path: '/analytics/reliability', heading: '可靠性分析' },
  { path: '/analytics/tco', heading: 'TCO 全生命周期成本' },
  { path: '/analytics/health', heading: '资产健康评分' },
  { path: '/asset-health', heading: '资产健康评分' },
  { path: '/reports', heading: '报表中心' },
  { path: '/reports/scheduled', heading: '定时报表配置' },
  { path: '/report-builder', heading: '自定义报表构建器' },
  { path: '/notifications', heading: '通知中心' },
  { path: '/workflows', heading: '业务流程管理' },
  { path: '/categories', heading: '资产分类管理' },
  { path: '/manufacturers', heading: '制造商管理' },
  { path: '/vendors', heading: '供应商管理' },
  { path: '/locations', heading: '位置管理' },
  { path: '/asset-models', heading: '资产模型管理' },
  { path: '/system/menus', heading: '菜单管理' },
  { path: '/system/posts', heading: '岗位管理' },
  { path: '/system/custom-fields', heading: '自定义字段管理' },
  { path: '/system/custom-fieldsets', heading: '自定义字段集管理' },
  { path: '/system/users', heading: '用户管理' },
  { path: '/system/roles', heading: '角色管理' },
  { path: '/system/depts', heading: '部门管理' },
  { path: '/assets/new', heading: '新建资产' },
  { path: '/retirement/new', heading: '资产退役申请' },
  { path: '/borrows/new', heading: '新建借用单' },
  { path: '/assignments/new', heading: '新建领用单' },
  { path: '/intake/new', heading: '新建验收单' },
  { path: '/budgets/new', heading: '新增预算' },
  { path: '/revaluations/new', heading: '新增减值/重估' },
  { path: '/spare-parts/new', heading: '备件申请' },
  { path: '/compensation/new', heading: '资产赔偿申请' },
  { path: '/disposals/scrap/new', heading: '资产报废申请' },
  { path: '/disposals/clearance/new', heading: '资产清退申请' },
  { path: '/disposals/transfer/new', heading: '资产转移申请' },
  { path: '/workorders/new', heading: '新建工单' },
  { path: '/assets/import-export', heading: '资产批量导入导出' },
  { path: '/stocktaking-cycles/new', heading: '新建盘点周期' },
  { path: '/approvals/1', heading: '工单审批详情' },
  { path: '/inventory/smart-report/INV-001', heading: '盘点报告' },
  { path: '/workorders/1', heading: '工单详情' },
  { path: '/403', heading: '无访问权限' },
  { path: '/forbidden', heading: '无访问权限' },
  { path: '/workspace-preview', heading: '固定资产工作台设计' },
  { path: '/inventory/tasks/1', heading: '办公室盘点' },
  { path: '/equipment', heading: '重要设备管理' },
  { path: '/approvals', heading: '审批中心' },
  { path: '/disposals', heading: '资产处置管理' },
  { path: '/idle', heading: '闲置资产管理' },
  { path: '/assignments/1/edit', heading: '编辑领用单' },
  { path: '/borrows/1/edit', heading: '编辑借用单' },
  { path: '/assets/1/timeline', heading: '资产履历时间线' },
  { path: '/budgets/1', heading: '预算详情' },
  { path: '/assignments/1', heading: '领用单详情' },
  { path: '/borrows/1', heading: '借用详情' },
  { path: '/intake/1', heading: '验收单详情' },
  { path: '/audit/1', heading: '审计日志详情' },
  { path: '/workorders/1/acceptance', heading: '工单验收' },
  { path: '/retirement/1', heading: '退役申请 #1' },
  { path: '/compensation', heading: '资产赔偿申请' },
  { path: '/compensation/1', heading: '资产赔偿申请' },
  { path: '/equipment/1', heading: '重要设备管理' },
  { path: '/disposals/1', heading: '资产处置详情' },
  { path: '/test-results', heading: '测试结果' },
  { path: '/stocktaking-cycles/1', heading: '2026年度循环盘点' },
  { path: '/workflow-designer', heading: '资产转移流程' },
  { path: '/inventory/scan/RFID-1', heading: 'RFID扫描任务' },
  { path: '/workflow-form/ASSET_TRANSFER', heading: '资产转移流程' },
  { path: '/workflow-form/ASSET_CLEARANCE', heading: '资产清退流程' },
  { path: '/workflow-form/ASSET_SCRAP', heading: '资产报废转让流程' },
  { path: '/workflow-form/ASSET_COMPENSATION', heading: '资产赔偿流程' },
  { path: '/workflow-form/RETIREMENT', heading: '资产退役流程' },
  { path: '/spare-parts/1', heading: 'E2E备件' },
  { path: '/profile', heading: 'E2E管理员' },
  { path: '/403?reason=roles_missing', heading: '用户信息不完整' },
  { path: '/assets/1/edit', heading: '编辑资产' },
  { path: '/fixed-assets/workbenchv3', heading: '系统管理 V3 工作台' },
  { path: '/m/index', heading: '资产管理系统' },
  { path: '/m/assets', heading: '资产列表' },
  { path: '/m/scan', heading: '扫码查询' },
  { path: '/m/profile', heading: '个人中心' },
  { path: '/m/work-orders', heading: '待办工单' },
  { path: '/m/notifications', heading: '消息通知' },
  { path: '/m/assets/1', heading: '资产详情' },
  { path: '/m/stocktaking-tasks/1', heading: '盘点任务 #1' },
  { path: '/login2', heading: 'UNIVIEW 固定资产' },
  { path: '/login3', heading: '登录您的管理账户' },
  { path: '/login4', heading: 'UNIVIEW 固定资产' },
  { path: '/fixed-assets/workbench/overview', heading: '运营首页' },
  { path: '/fixed-assets/workbench/manufacturing', heading: '运营首页' },
  { path: '/fixed-assets/workbench/data', heading: '能耗管理' },
  { path: '/fixed-assets/workbench/asset', heading: '资产台账' },
  { path: '/fixed-assets/workbench/safety', heading: '通知中心' },
  { path: '/fixed-assets/workbench?menu=my-assets', heading: '资产台账' },
  { path: '/workspace-preview?tab=analytics', heading: '数据监控中心' },
  { path: '/workspace-preview?tab=assets', heading: '资产运维中心' },
  { path: '/workspace-preview?tab=security', heading: '风险预警中心' },
  { path: '/workflow-form/WORK_ORDER', heading: '工单申请' },
  { path: '/workflow-form/ASSET_INTAKE', heading: 'ASSET_INTAKE' },
  { path: '/workflow-form/ASSET_BORROW', heading: 'ASSET_BORROW' },
  { path: '/workflow-form/ASSET_ASSIGNMENT', heading: 'ASSET_ASSIGNMENT' },
];

test.describe('AppLayout 真页列表 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await page.route('**/test-reports/data.json', mockTestResults);
    await seedAuthenticatedSession(page);
  });

  for (const route of appPages) {
    test(`${route.path} 渲染 heading「${route.heading}」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);

      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
  }
});

const cardPages: Array<{ path: string; landmark: string }> = [
  { path: '/insurances/new', landmark: '新增保险' },
  { path: '/inspection-templates', landmark: '检验模板管理' },
  { path: '/risk-assessments/new', landmark: '新增风险评估' },
  { path: '/safety-checklists/execute', landmark: '开始安全检查' },
  { path: '/inventory/cycle-count', landmark: '循环盘点规则配置（ABC分类）' },
  { path: '/insurances/1', landmark: '保险详情' },
  { path: '/inspections/1', landmark: '检验详情' },
  { path: '/inspections/1/upload', landmark: '上传新照片' },
  { path: '/risk-assessments/1/edit', landmark: '编辑风险评估' },
  { path: '/inspections/1/edit', landmark: '编辑检验记录' },
  { path: '/inspections/new', landmark: '新增检验记录' },
  { path: '/safety-checklists/execute/1', landmark: '安全检查执行' },
  { path: '/inventory/smart-report', landmark: '未指定盘点任务 ID' },
  { path: '/404', landmark: '404 — 页面不存在' },
  { path: '/vendor-portal', landmark: '供应商门户' },
  { path: '/sso-callback', landmark: 'Token 缺失，SSO 登录失败' },
  { path: '/assets/1', landmark: 'E2E-ASSET' },
  { path: '/workflows-v2', landmark: '流程定义 2' },
  { path: '/settings/sysconfig', landmark: '基础参数系统设置复刻页' },
  { path: '/settings/numbering', landmark: '编号规则系统设置复刻页' },
  { path: '/settings/webhook', landmark: 'Webhook 配置系统设置复刻页' },
  { path: '/settings/sla-config', landmark: 'SLA 配置系统设置复刻页' },
  { path: '/settings/mail-template', landmark: '邮件模板系统设置复刻页' },
  { path: '/settings/mail-log', landmark: '邮件日志系统设置复刻页' },
  { path: '/settings/notif-pref', landmark: '通知偏好系统设置复刻页' },
  { path: '/settings/notif-template', landmark: '通知模板系统设置复刻页' },
  { path: '/settings/notif-channel', landmark: '通知渠道系统设置复刻页' },
  { path: '/settings/notif-switch', landmark: '流程通知开关系统设置复刻页' },
  { path: '/settings', landmark: '基础参数系统设置复刻页' },
  { path: '/settings-v2', landmark: '邮件模板系统设置复刻页' },
  { path: '/workorders', landmark: '资产处置管理' },
  { path: '/settings/system', landmark: '基础参数系统设置复刻页' },
  { path: '/settings/users', landmark: '用户管理' },
  { path: '/settings/departments', landmark: '部门管理' },
  { path: '/settings-v2/mail-template', landmark: '邮件模板系统设置复刻页' },
  { path: '/bigscreen', landmark: '资产运营分析平台' },
  { path: '/bigscreen-3d', landmark: '固定资产智慧运营大屏' },
  { path: '/login5', landmark: '登录并进入工作台' },
  { path: '/fixed-assets/workbench?menu=system-security-policy', landmark: '安全策略系统设置复刻页' },
  { path: '/fixed-assets/workbench?menu=system-audit-log', landmark: '操作审计系统设置复刻页' },
  { path: '/fixed-assets/workbench?menu=system-flow-definition', landmark: '导航控制台系统设置复刻页' },
  { path: '/fixed-assets/workbench?menu=system-user-management', landmark: '用户管理系统设置复刻页' },
];

test.describe('AppLayout Card 标题页 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedAuthenticatedSession(page);
  });

  for (const route of cardPages) {
    test(`${route.path} 可见「${route.landmark}」`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      await page.goto(route.path);
      await page.waitForLoadState('domcontentloaded');
      const landmark = page.getByText(route.landmark)
        .or(page.getByRole('main', { name: route.landmark }))
        .or(page.getByTitle(route.landmark));
      await expect(landmark.first()).toBeVisible({ timeout: 15_000 });
      expect(errors).toEqual([]);
    });
  }
});

test.describe('非数组 mock 不崩溃', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', mockApi);
    await seedAuthenticatedSession(page);
  });

  test('/contracts expiring 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/contracts/expiring*', async (apiRoute) => {
      await fulfill(apiRoute, { unexpected: true });
    });
    await page.goto('/contracts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '合同管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets/1 折旧非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets/*/depreciation-schedule*', async (apiRoute) => {
      await fulfill(apiRoute, { unexpected: true });
    });
    await page.goto('/assets/1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route(/\/inventory\/tasks(\?|$)/, async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inventory');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '盘点管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/abc-classification assets 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route(/\/assets(\?|$)/, async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inventory/abc-classification');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'ABC 分类管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/scan/RFID-1 assets 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inventory/tasks/*/assets*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inventory/scan/RFID-1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'RFID扫描任务' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/maintenance/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/maintenance');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '维保管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/maintenance/plans records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/maintenance/plans/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/maintenance/plans');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '维保计划管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/approvals records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/approvals/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/approvals');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '审批中心' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets' || path.startsWith('/assets?')) {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/assets');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产台账' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/notifications records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/notifications*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/notifications') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '通知中心' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/retirement records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/retirement/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/retirement');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产退役管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspections records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inspections/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inspections');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '检验/年检管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/equipment records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.route('**/maintenance/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/equipment');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '重要设备管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/spare-parts records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/spare-parts*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/spare-parts') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/spare-parts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '备品备件管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/vendors records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/vendors*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/vendors') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/vendors');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '供应商管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/borrows*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/borrows') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/borrows');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产借用' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assignments*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assignments') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/assignments');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产领用归还' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/intake-orders*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/intake-orders') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/intake');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '入库验收' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/purchase-orders records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/purchase-orders*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/purchase-orders') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/purchase-orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '采购订单管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/manufacturers records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/manufacturers*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/manufacturers') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/manufacturers');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '制造商管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/licenses records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/licenses*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/licenses') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/licenses');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '软件许可证管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/budgets records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/budgets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/budgets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/budgets');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '预算管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/revaluations records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/revaluations*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/revaluations') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/revaluations');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产减值/重估' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/m/assets records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets' || path.startsWith('/assets?')) {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/m/assets');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('暂无资产数据').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/retirement/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/disposals');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产处置管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/asset-models records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/asset-models*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/asset-models') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/asset-models');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产模型管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/posts records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/posts/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/system/posts');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '岗位管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/roles records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/roles/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/system/roles');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '角色管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspection-templates records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inspection-templates/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inspection-templates');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('检验模板管理').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/cycle-count records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/cycle-count/rules*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/cycle-count/rules') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/inventory/cycle-count');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('循环盘点规则配置（ABC分类）').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/insurance/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/insurances');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '保险管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspection-records records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inspections/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inspection-records');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '检验记录管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fields records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/system/custom-fields*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/system/custom-fields') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/system/custom-fields');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '自定义字段管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/custom-fieldsets records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/system/custom-fieldsets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/system/custom-fieldsets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/system/custom-fieldsets');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '自定义字段集管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/reports/scheduled records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/scheduled-reports*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/scheduled-reports') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/reports/scheduled');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '定时报表配置' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/system/users records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/user-management/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/system/users');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '用户管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/safety-checklists/history records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/safety-checklists/executions*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/safety-checklists/executions') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/safety-checklists/history');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '安全检查历史' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/safety-checklists/config records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/safety-checklists/templates*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/safety-checklists/templates') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/safety-checklists/config');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '安全检查表模板' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/floorplans records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/floor-plans*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/floor-plans') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/floorplans');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '2D/3D 平面图' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/m/work-orders records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/mobile/work-orders*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/mobile/work-orders') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/m/work-orders');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('暂无待办工单').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/risk-assessments records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/risk-assessments/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/risk-assessments');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '风险矩阵' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/sam history records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/sam/history*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/sam');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'SAM 合规管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/tasks/1 assets records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inventory/tasks/*/assets*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inventory/tasks/1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '办公室盘点' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/insurances/1 claims records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/insurance/*/claims*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/insurances/1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('保险详情').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/analytics/health records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/analytics/health');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产健康评分' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/dashboard workorders records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/workorders*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/workorders') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '运营首页' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/report-builder records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/report-builder');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '自定义报表构建器' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inventory/smart-report/INV-001 records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inventory/tasks/*/assets*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inventory/smart-report/INV-001');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '盘点报告' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/gis records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/gis');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'GIS 资产地图' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/compensation/new records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/compensation/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产赔偿申请' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assignments/new records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/assignments/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '新建领用单' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/borrows/new records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/borrows/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '新建借用单' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/intake/new records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/vendors*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/vendors') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/intake/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '新建验收单' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/workorders/new records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/user-management/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/workorders/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '新建工单' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/disposals/transfer/new records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/assets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/assets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/disposals/transfer/new');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '资产转移申请' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/risk-matrix records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/risk-matrix/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/risk-matrix');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '风险矩阵配置' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/assets/1 audit records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/audit-logs*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/assets/1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('E2E-ASSET').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/audit records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/audit-logs*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/audit');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '审计日志' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/inspection-records templates records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/inspection-templates/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/inspection-records');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '检验记录管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/settings records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**/system/configs*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/system/configs') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('main', { name: '基础参数系统设置复刻页' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fault-codes tree 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/fault-codes/tree*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true } });
    });
    await page.goto('/fault-codes');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '故障代码管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/depreciation data 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/depreciation/schedules*', async (apiRoute) => {
      await fulfill(apiRoute, { data: { unexpected: true }, total: 0 });
    });
    await page.goto('/depreciation');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '折旧管理' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/stocktaking-cycles records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/stocktaking/cycles*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/stocktaking/cycles') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/stocktaking-cycles');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '循环盘点周期' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 mail-templates records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/mail-templates/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-mail-templates');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 mail-logs records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/mail-logs/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-mail-logs');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 mail-gateway records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/system/mail-gateways*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/system/mail-gateways') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-mail-gateway');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 notif-templates records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/notification-templates/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-notification-templates');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 posts records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/system/posts*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/system/posts') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-post-management');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 audit-log records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/audit-logs*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/audit-logs') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-audit-log');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 custom-field-sets records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/system/custom-fieldsets*', async (apiRoute) => {
      const path = new URL(apiRoute.request().url()).pathname.replace(/^\/api(?:\/v1)?/, '');
      if (path === '/system/custom-fieldsets') {
        await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
        return;
      }
      await mockApi(apiRoute);
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-custom-field-sets');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/fixed-assets/workbenchv3 asset-category records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/categories/list*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/fixed-assets/workbenchv3?menu=system-asset-category');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '系统管理 V3 工作台' }).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/m/index work-orders records 非数组无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/mobile/work-orders*', async (apiRoute) => {
      await fulfill(apiRoute, { records: { unexpected: true }, total: 0 });
    });
    await page.goto('/m/index');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('暂无待办事项').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    window.localStorage.setItem('auth_token', 'app-pages-smoke-token');
    window.localStorage.setItem('user_info', JSON.stringify(user));
    window.sessionStorage.setItem('auth_token', 'app-pages-smoke-token');
    window.sessionStorage.setItem('user_info', JSON.stringify(user));
  }, { user: authUser });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  const ignoredResourceNoise = [
    'downloadable font: download failed',
    'Image corrupt or truncated.',
    'Failed to load resource',
    'ResizeObserver loop',
    'Encountered two children with the same key',
    '[antd:',
    'Error creating WebGL context',
    'WebGL context could not be created',
    'THREE.WebGLRenderer',
    '[ErrorBoundary]',
    'ForwardRef(Canvas)',
  ];
  const shouldIgnoreError = (text: string) =>
    ignoredResourceNoise.some((message) => text.includes(message));

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!shouldIgnoreError(text)) {
        errors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    if (!shouldIgnoreError(error.message)) {
      errors.push(error.message);
    }
  });

  return errors;
}

async function mockApi(route: Route) {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) {
    return route.fallback();
  }
  const path = url.pathname.replace(/^\/api/, '');

  if (path === '/auth/login' || path === '/user-management/current' || path === '/users/current') {
    return fulfill(route, { token: 'app-pages-smoke-token', ...authUser });
  }

  if (path === '/menus/current') {
    return fulfill(route, { menus: [], permissions: [], roles: authUser.roles });
  }

  if (/^\/mobile\/assets\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      assetNo: 'E2E-ASSET',
      assetName: 'E2E资产',
      status: 'IN_USE',
    });
  }

  if (path === '/mobile/notifications') {
    return fulfill(route, []);
  }

  if (path === '/mobile/dashboard') {
    return fulfill(route, {
      totalAssets: 128,
      inUseAssets: 96,
      idleAssets: 18,
      scrapAssets: 5,
      pendingWorkOrders: 2,
      unreadNotifications: 0,
    });
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
      inventoryProgress: 40,
      criticalAlerts: 1,
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
    ]);
  }

  if (path === '/dashboard/maintenance-stats' || path === '/dashboard/pending-approvals') {
    return fulfill(route, path.endsWith('pending-approvals') ? 3 : {
      totalMaintenanceCount: 12,
      avgMaintenanceCost: 460,
      monthlyMaintenanceCount: 4,
      upcomingCount: 2,
      overdueCount: 0,
      alerts: [],
    });
  }

  if (path === '/energy/dashboard') {
    return fulfill(route, {
      byType: { ELECTRICITY: 1200, WATER: 80, GAS: 40 },
      trend: { '2026-01': 100, '2026-02': 110 },
      assetRanking: [{ assetId: 1, consumption: 50 }],
      total: 1320,
    });
  }

  if (path === '/risk-assessments/matrix') {
    return fulfill(route, []);
  }

  if (path === '/categories/tree' || path.startsWith('/categories')) {
    return fulfill(route, []);
  }

  if (path === '/workflows') {
    return fulfill(route, [
      { businessType: 'ASSET_TRANSFER', name: '资产转移流程', description: '资产转移审批', definition: {}, status: 'DRAFT', version: 0 },
    ]);
  }

  if (/^\/workflows\/[A-Z][A-Z0-9_]*$/.test(path)) {
    const businessType = path.split('/').pop() ?? 'ASSET_TRANSFER';
    const workflowNames: Record<string, string> = {
      ASSET_TRANSFER: '资产转移流程',
      ASSET_CLEARANCE: '资产清退流程',
      ASSET_SCRAP: '资产报废转让流程',
      ASSET_COMPENSATION: '资产赔偿流程',
      RETIREMENT: '资产退役流程',
      WORK_ORDER: '工单申请',
    };
    return fulfill(route, {
      businessType,
      name: workflowNames[businessType] ?? businessType,
      description: '',
      definition: {},
      status: 'DRAFT',
      version: 0,
    });
  }

  if (
    path === '/contracts/expiring'
    || path === '/stocktaking/cycles'
    || path === '/menus/admin'
    || path === '/menus/admin/tree'
    || path === '/fault-codes/tree'
    || path === '/reliability/trend'
    || path === '/reliability/ranking'
    || path === '/asset-health/unhealthy'
    || path === '/asset-health/batch'
    || path === '/gis/assets'
    || path === '/manufacturers/options'
    || path === '/system/custom-fieldsets/all'
    || path === '/categories/all'
    || path === '/maintenance/upcoming'
    || path === '/depts/tree'
    || path === '/roles/all'
    || path === '/posts/all'
    || path === '/locations/tree'
    || path === '/locations/cascade'
  ) {
    return fulfill(route, []);
  }

  if (path === '/reliability/summary' || path === '/gis/stats') {
    return fulfill(route, {});
  }

  if (path.endsWith('/inventory/tasks/INV-001/summary')) {
    return fulfill(route, {
      surplusCount: 0,
      deficitCount: 0,
      surplusItems: [],
      deficitItems: [],
    });
  }

  if (/\/assets\/[^/]+\/history$/.test(path) || /\/assets\/\d+\/(depreciation-schedule|attachments)$/.test(path)) {
    return fulfill(route, []);
  }

  if (/\/assets\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      assetNo: 'E2E-ASSET',
      assetName: 'E2E资产',
      status: 'IN_USE',
    });
  }

  if (/^\/inspections\/\d+\/photos$/.test(path)) {
    return fulfill(route, []);
  }

  if (/^\/inspections\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      inspectionNo: 'INSP-001',
      assetId: 1,
      inspectionType: 'ANNUAL',
      result: 'PASS',
    });
  }

  if (/^\/insurance\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      policyNo: 'POL-001',
      insuranceName: '财产险',
      insuranceType: 'PROPERTY',
      status: 'ACTIVE',
      premium: 100,
      coverage: 10000,
    });
  }

  if (/^\/risk-assessments\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      assetId: 1,
      probability: 2,
      impact: 2,
    });
  }

  if (/^\/stocktaking\/tasks\/[^/]+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      expectedQuantity: 1,
      status: 'PENDING',
    });
  }

  if (/^\/stocktaking\/cycles\/\d+\/tasks$/.test(path)) {
    return fulfill(route, []);
  }

  if (/^\/stocktaking\/cycles\/\d+\/stats$/.test(path)) {
    return fulfill(route, {
      totalCount: 0,
      pendingCount: 0,
      countedCount: 0,
      adjustedCount: 0,
      completedCount: 0,
    });
  }

  if (/^\/user-management\/\d+\/detail$/.test(path)) {
    return fulfill(route, {
      id: 1,
      username: 'admin',
      realName: 'E2E管理员',
      roles: [],
      status: 0,
    });
  }

  if (/^\/safety-checklists\/executions\/\d+\/(photos|results)$/.test(path)) {
    return fulfill(route, []);
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

  if (/^\/stocktaking\/cycles\/\d+$/.test(path)) {
    return fulfill(route, {
      id: 1,
      cycleName: '2026年度循环盘点',
      cycleType: 'YEARLY',
      status: 'PLANNED',
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

async function mockTestResults(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      summary: {
        total: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        executionTime: 1,
        timestamp: '2026-08-21T00:00:00Z',
      },
      modules: [],
    }),
  });
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, message: 'OK', data }),
  });
}
