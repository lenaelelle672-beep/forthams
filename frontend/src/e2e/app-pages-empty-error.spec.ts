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
    await expect(page.getByText('资产转移流程').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });

  test('/safety-checklists/execute/1 失败无 pageerror', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.route('**/api/**', (apiRoute) => mockApiWithFailure(apiRoute, '/safety-checklists'));
    await seedSession(page, adminUser);
    await page.goto('/safety-checklists/execute/1');
    await expect(page.getByText('安全检查执行').first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
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
