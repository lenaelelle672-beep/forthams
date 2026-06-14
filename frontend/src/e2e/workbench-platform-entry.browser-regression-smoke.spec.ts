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

    await page.getByRole('button', { name: '安全态势工作台', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\/security$/);
    await expect(page.getByText('安全态势总览')).toBeVisible();
    await expect(page.getByRole('heading', { name: '安全告警研判处置' })).toHaveCount(0);

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

  test('Workbench 左侧菜单均渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    const pageCases = [
      ['运营首页', '/fixed-assets/workbench?menu=home'],
      ['流程待办', '/fixed-assets/workbench?menu=todo'],
      ['资产总览', '/fixed-assets/workbench/assets?menu=asset'],
      ['设备管理', '/fixed-assets/workbench/assets?menu=device'],
      ['工单管理', '/fixed-assets/workbench/assets?menu=orders'],
      ['巡检管理', '/fixed-assets/workbench/assets?menu=inspection'],
      ['备件管理', '/fixed-assets/workbench/assets?menu=spares'],
      ['数据监控', '/fixed-assets/workbench/analytics?menu=energy'],
      ['报表分析', '/fixed-assets/workbench/analytics?menu=report'],
      ['告警中心', '/fixed-assets/workbench/security?menu=alarm'],
      ['组织策略', '/fixed-assets/workbench/security?menu=policy'],
      ['基础维护', '/fixed-assets/workbench/assets?menu=settings'],
    ];

    for (const [pageLabel, route] of pageCases) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      await expect(page.getByLabel(`${pageLabel}真实产品页`)).toBeVisible();
      await expect(page.locator('.workspace-product-page')).toHaveCount(0);
      await expect(page.locator('.workspace-orders-page')).toBeVisible();
      await expect(page.locator('.workspace-orders-table')).toBeVisible();
    }

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('运营首页左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('运营首页真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '运营首页' })).toBeVisible();
    await expect(page.getByText('KPI 下钻 · 待办联动 · 维保预警')).toBeVisible();
    await expect(page.getByLabel('运营首页核心指标')).toContainText('资产健康');
    await expect(page.getByLabel('运营首页流程阶段')).toContainText('聚合');
    await expect(page.getByLabel('运营首页顶部操作')).toContainText('新建预测工单');
    await expect(page.getByLabel('运营首页查询筛选栏')).toContainText('处理时间');
    await expect(page.getByLabel('运营首页列表')).toContainText('OPS-20240614-001');
    await expect(page.getByLabel('运营首页详情抽屉')).toContainText('主轴振动异常');
    await expect(page.getByLabel('运营首页详情标签')).toContainText('维保预警');
    await expect(page.getByLabel('运营首页详情操作')).toContainText('查看报表');
    await expect(page.locator('body')).not.toContainText('workbench-menu-home-v1');

    await page.getByLabel('运营首页顶部操作').getByRole('button', { name: '新建预测工单' }).click();
    const createDialog = page.getByRole('dialog', { name: '新建预测工单' });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'OPS-20240614-002', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开运营首页详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/fixed-assets/workbench/OPS-20240614-002');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('运营首页详情抽屉')).toContainText('CN-301 跨车间调拨');

    await page.getByLabel('运营首页详情操作').getByRole('button', { name: '查看报表' }).click();
    const reportDialog = page.getByRole('dialog', { name: '查看经营报表' });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.locator('.workspace-action-route strong')).toContainText('/reports?source=workbench&view=operations-home');
    await page.keyboard.press('Escape');
    await expect(reportDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('资产总览左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=asset');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('资产总览真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '资产总览' })).toBeVisible();
    await expect(page.getByText('健康台账 · 生命周期 · 处置流转')).toBeVisible();
    await expect(page.getByLabel('资产总览核心指标')).toContainText('资产总数');
    await expect(page.getByLabel('资产生命周期', { exact: true })).toContainText('建账');
    await expect(page.getByLabel('资产总览顶部操作')).toContainText('生成风险工单');
    await expect(page.getByLabel('资产总览查询筛选栏')).toContainText('处置流转');
    await expect(page.getByLabel('资产总览列表')).toContainText('FA-CN-301');
    await expect(page.getByLabel('资产详情抽屉')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('资产详情标签')).toContainText('生命周期');
    await expect(page.getByLabel('资产详情操作')).toContainText('发起调拨');
    await expect(page.locator('body')).not.toContainText('workbench-menu-asset-v1');

    await page.getByRole('button', { name: /生成风险工单/ }).click();
    const riskDialog = page.getByRole('dialog', { name: '生成风险工单' });
    await expect(riskDialog).toBeVisible();
    await expect(riskDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(riskDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'FA-M-201', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开资产详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/assets/FA-M-201');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('资产详情抽屉')).toContainText('注塑机 M-201');

    await page.getByRole('button', { name: '发起调拨' }).click();
    const transferDialog = page.getByRole('dialog', { name: '发起资产调拨' });
    await expect(transferDialog).toBeVisible();
    await expect(transferDialog.locator('.workspace-action-route strong')).toContainText('/disposals/transfer/new?source=workbench&assetId=FA-M-201');
    await page.keyboard.press('Escape');
    await expect(transferDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('设备管理左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=device');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('设备管理真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '设备管理' })).toBeVisible();
    await expect(page.getByText('在线监测 · 遥测异常 · 现场派工')).toBeVisible();
    await expect(page.getByLabel('设备管理核心指标')).toContainText('在线设备');
    await expect(page.getByLabel('设备运维阶段')).toContainText('接入');
    await expect(page.getByLabel('设备管理顶部操作')).toContainText('链路诊断');
    await expect(page.getByLabel('设备管理查询筛选栏')).toContainText('采集时间');
    await expect(page.getByLabel('设备管理列表')).toContainText('DEV-CN-301');
    await expect(page.getByLabel('设备详情抽屉')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('设备详情标签')).toContainText('采集链路');
    await expect(page.getByLabel('设备详情操作')).toContainText('创建工单');
    await expect(page.locator('body')).not.toContainText('workbench-menu-device-v1');

    await page.getByRole('button', { name: /创建复核工单/ }).click();
    const createDialog = page.getByRole('dialog', { name: '创建温度复核工单' });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'DEV-M-201', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开设备详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/equipment/DEV-M-201');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('设备详情抽屉')).toContainText('注塑机 M-201');

    await page.getByRole('button', { name: '创建工单' }).click();
    const workOrderDialog = page.getByRole('dialog', { name: '创建复核工单' });
    await expect(workOrderDialog).toBeVisible();
    await expect(workOrderDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(workOrderDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('流程待办左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench?menu=todo');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('流程待办真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '流程待办' })).toBeVisible();
    await expect(page.getByText('审批 · 派工 · 预警队列')).toBeVisible();
    await expect(page.getByLabel('流程待办核心指标')).toContainText('待审批');
    await expect(page.getByLabel('流程待办核心指标').locator('button')).toHaveCount(5);
    await expect(page.getByLabel('流程待办核心指标')).toContainText('今日完成');
    await expect(page.getByLabel('流程待办状态切换')).toContainText('全部待办');
    await expect(page.getByLabel('流程待办状态切换')).toContainText('逾期');
    await expect(page.getByLabel('流程待办状态切换')).not.toContainText('收敛');
    await expect(page.getByLabel('流程待办顶部操作')).toContainText('批量处理');
    await expect(page.getByLabel('流程待办查询筛选栏')).toContainText('创建时间');
    await expect(page.getByLabel('流程待办查询筛选栏')).toContainText('筛选');
    await expect(page.getByLabel('流程待办列表')).toContainText('APR-20240614-0012');
    await expect(page.getByLabel('流程待办列表')).toContainText('设备维修费用报销申请');
    await expect(page.getByLabel('流程待办列表')).toContainText('关联对象');
    await expect(page.getByLabel('流程待办详情抽屉')).toContainText('待处理项详情');
    await expect(page.getByLabel('流程待办详情抽屉')).toContainText('设备维修费用报销申请');
    await expect(page.getByLabel('流程待办详情抽屉')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('流程待办详情标签')).toContainText('附件');
    await expect(page.getByLabel('流程待办详情操作')).toContainText('同意');
    await expect(page.getByLabel('流程待办详情操作')).toBeInViewport();
    await expect(page.locator('body')).not.toContainText('workbench-menu-todo-v1');

    await page.getByRole('button', { name: /创建预测工单/ }).click();
    const createDialog = page.getByRole('dialog', { name: '派发预测工单' });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    await page.getByLabel('流程待办列表').getByRole('button', { name: /预测维保工单待派工.*PM-20240614-0021/ }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开待办详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/approvals/PM-20240614-0021');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('流程待办详情抽屉')).toContainText('加工中心 MC-502');

    await page.getByRole('button', { name: '同意' }).click();
    const processDialog = page.getByRole('dialog', { name: '同意待办' });
    await expect(processDialog).toBeVisible();
    await expect(processDialog.locator('.workspace-action-route strong')).toContainText('/approve?source=workbench');
    await page.keyboard.press('Escape');
    await expect(processDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('工单管理左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=orders');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('工单管理真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '工单管理' })).toBeVisible();
    await expect(page.getByText('预测工单 · 派工执行 · 验收闭环')).toBeVisible();
    await expect(page.getByLabel('工单管理核心指标')).toContainText('全部工单');
    await expect(page.getByLabel('工单流程阶段')).toContainText('预测');
    await expect(page.getByLabel('工单管理顶部操作')).toContainText('高级筛选');
    await expect(page.getByLabel('工单查询筛选栏')).toContainText('创建时间');
    await expect(page.getByLabel('工单管理列表')).toContainText('WO-20240614-0012');
    await expect(page.getByLabel('工单详情抽屉')).toContainText('主轴振动异常预测维保');
    await expect(page.getByLabel('工单详情标签')).toContainText('备件与物料');
    await expect(page.getByLabel('工单详情操作')).toContainText('开始执行');
    await expect(page.locator('body')).not.toContainText('workbench-menu-orders-v1');

    await page.getByRole('button', { name: /新建工单/ }).click();
    const createDialog = page.getByRole('dialog', { name: '创建预测工单' });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'WO-20240614-0011', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开工单详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/workorders/WO-20240614-0011');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('工单详情抽屉')).toContainText('换刀机构卡滞');

    await page.getByRole('button', { name: '开始执行' }).click();
    const executeDialog = page.getByRole('dialog', { name: '开始执行' });
    await expect(executeDialog).toBeVisible();
    await expect(executeDialog.locator('.workspace-action-route strong')).toContainText('/execute?source=workbench');
    await page.keyboard.press('Escape');
    await expect(executeDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('巡检管理左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=inspection');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('巡检管理真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '巡检管理' })).toBeVisible();
    await expect(page.getByText('路线排程 · 扫码执行 · 异常转派')).toBeVisible();
    await expect(page.getByLabel('巡检管理核心指标')).toContainText('今日计划');
    await expect(page.getByLabel('巡检执行阶段')).toContainText('排程');
    await expect(page.getByLabel('巡检管理顶部操作')).toContainText('转派巡检异常');
    await expect(page.getByLabel('巡检管理查询筛选栏')).toContainText('执行时间');
    await expect(page.getByLabel('巡检管理列表')).toContainText('INSP-20260614-M201');
    await expect(page.getByLabel('巡检详情抽屉')).toContainText('高温点位连续越限');
    await expect(page.getByLabel('巡检详情标签')).toContainText('现场证据');
    await expect(page.getByLabel('巡检详情操作')).toContainText('转工单');
    await expect(page.locator('body')).not.toContainText('workbench-menu-inspection-v1');

    await page.getByRole('button', { name: /转派巡检异常/ }).click();
    const transferDialog = page.getByRole('dialog', { name: '转派巡检异常' });
    await expect(transferDialog).toBeVisible();
    await expect(transferDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(transferDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'INSP-20260614-CN301', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开巡检详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/inspections/INSP-20260614-CN301');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('巡检详情抽屉')).toContainText('主轴振动读数偏高');

    await page.getByRole('button', { name: '转工单', exact: true }).click();
    const workOrderDialog = page.getByRole('dialog', { name: '转派巡检异常' });
    await expect(workOrderDialog).toBeVisible();
    await expect(workOrderDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(workOrderDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('备件管理左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=spares');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('备件管理真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '备件管理' })).toBeVisible();
    await expect(page.getByText('低储预警 · 采购领用 · 工单回写')).toBeVisible();
    await expect(page.getByLabel('备件管理核心指标')).toContainText('低储备件');
    await expect(page.getByLabel('备件保障流程')).toContainText('识别');
    await expect(page.getByLabel('备件管理顶部操作')).toContainText('采购申请');
    await expect(page.getByLabel('备件管理查询筛选栏')).toContainText('到货时间');
    await expect(page.getByLabel('备件管理列表')).toContainText('SP-6205-2RS');
    await expect(page.getByLabel('备件详情抽屉')).toContainText('轴承 6205-2RS');
    await expect(page.getByLabel('备件详情标签')).toContainText('供应商 ETA');
    await expect(page.getByLabel('备件详情操作')).toContainText('采购申请');
    await expect(page.locator('body')).not.toContainText('workbench-menu-spares-v1');

    await page.getByLabel('备件管理顶部操作').getByRole('button', { name: '采购申请' }).click();
    const purchaseDialog = page.getByRole('dialog', { name: '采购申请' });
    await expect(purchaseDialog).toBeVisible();
    await expect(purchaseDialog.locator('.workspace-action-route strong')).toContainText('/spare-parts/new?source=workbench&mode=purchase&stock=LOW');
    await page.keyboard.press('Escape');
    await expect(purchaseDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'SP-PT100-M201', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开备件详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/spare-parts/SP-PT100-M201');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('备件详情抽屉')).toContainText('温控模块传感器');

    await page.getByLabel('备件详情操作').getByRole('button', { name: '领用', exact: true }).click();
    const requestDialog = page.getByRole('dialog', { name: '领用备件' });
    await expect(requestDialog).toBeVisible();
    await expect(requestDialog.locator('.workspace-action-route strong')).toContainText('/spare-parts/SP-PT100-M201/request?source=workbench');
    await page.keyboard.press('Escape');
    await expect(requestDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('数据监控左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/analytics?menu=energy');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('数据监控真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '数据监控' })).toBeVisible();
    await expect(page.getByText('数据链路 · 采集事件 · 指标服务')).toBeVisible();
    await expect(page.getByLabel('数据监控核心指标')).toContainText('链路健康度');
    await expect(page.getByLabel('数据监控流程阶段')).toContainText('采集');
    await expect(page.getByLabel('数据监控顶部操作')).toContainText('重试采集任务');
    await expect(page.getByLabel('数据监控查询筛选栏')).toContainText('处理时间');
    await expect(page.getByLabel('数据监控列表')).toContainText('DATA-IOT-GW-A01');
    await expect(page.getByLabel('数据监控详情抽屉')).toContainText('设备点位采集延迟');
    await expect(page.getByLabel('数据监控详情标签')).toContainText('异常事件');
    await expect(page.getByLabel('数据监控详情操作')).toContainText('重试任务');
    await expect(page.locator('body')).not.toContainText('workbench-menu-energy-v1');

    await page.getByLabel('数据监控顶部操作').getByRole('button', { name: '重试采集任务' }).click();
    const retryDialog = page.getByRole('dialog', { name: '重试采集任务' });
    await expect(retryDialog).toBeVisible();
    await expect(retryDialog.locator('.workspace-action-route strong')).toContainText('retry=true');
    await page.keyboard.press('Escape');
    await expect(retryDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'DATA-MES-SYNC-08', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开数据监控详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/energy/DATA-MES-SYNC-08');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('数据监控详情抽屉')).toContainText('工单状态与设备采集批次');

    await page.getByLabel('数据监控详情操作').getByRole('button', { name: '重试任务' }).click();
    const detailRetryDialog = page.getByRole('dialog', { name: '重试采集任务' });
    await expect(detailRetryDialog).toBeVisible();
    await expect(detailRetryDialog.locator('.workspace-action-route strong')).toContainText('retry=true');
    await page.keyboard.press('Escape');
    await expect(detailRetryDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('报表分析左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/analytics?menu=report');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('报表分析真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '报表分析' })).toBeVisible();
    await expect(page.getByText('模板中心 · 分析视图 · 导出订阅')).toBeVisible();
    await expect(page.getByLabel('报表分析核心指标')).toContainText('资产总价值');
    await expect(page.getByLabel('报表分析流程')).toContainText('模板');
    await expect(page.getByLabel('报表分析顶部操作')).toContainText('导出资产趋势');
    await expect(page.getByLabel('报表分析查询筛选栏')).toContainText('生成时间');
    await expect(page.getByLabel('报表分析列表')).toContainText('RPT-ASSET-VALUE-001');
    await expect(page.getByLabel('报表详情抽屉')).toContainText('资产价值信息总览');
    await expect(page.getByLabel('报表详情标签')).toContainText('审计追溯');
    await expect(page.getByLabel('报表详情操作')).toContainText('订阅此报表');
    await expect(page.locator('body')).not.toContainText('workbench-menu-report-v1');

    await page.getByRole('button', { name: /导出资产趋势/ }).click();
    const exportDialog = page.getByRole('dialog', { name: '导出资产趋势' });
    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.locator('.workspace-action-route strong')).toContainText('/reports?source=workbench&view=asset-trend&export=csv');
    await page.keyboard.press('Escape');
    await expect(exportDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'RPT-MAINT-COST-008', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开报表详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/reports/RPT-MAINT-COST-008');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('报表详情抽屉')).toContainText('预测维保成本分析');

    await page.getByRole('button', { name: '订阅此报表' }).click();
    const subscribeDialog = page.getByRole('dialog', { name: '订阅此报表' });
    await expect(subscribeDialog).toBeVisible();
    await expect(subscribeDialog.locator('.workspace-action-route strong')).toContainText('/subscribe?source=workbench');
    await page.keyboard.press('Escape');
    await expect(subscribeDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('告警中心左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/security?menu=alarm');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('告警中心真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '告警中心' })).toBeVisible();
    await expect(page.getByText('等级研判 · 策略命中 · 处置复盘')).toBeVisible();
    await expect(page.getByLabel('告警中心核心指标')).toContainText('安全评分');
    await expect(page.getByLabel('告警处置流程')).toContainText('发现');
    await expect(page.getByLabel('告警中心顶部操作')).toContainText('转派处置工单');
    await expect(page.getByLabel('告警中心查询筛选栏')).toContainText('响应时间');
    await expect(page.getByLabel('告警中心列表')).toContainText('ALM-20240614-0012');
    await expect(page.getByLabel('告警详情抽屉')).toContainText('主轴振动异常触发高危策略');
    await expect(page.getByLabel('告警详情标签')).toContainText('策略命中');
    await expect(page.getByLabel('告警详情操作')).toContainText('创建工单');
    await expect(page.locator('body')).not.toContainText('workbench-menu-alert-v1');

    await page.getByRole('button', { name: /转派处置工单/ }).click();
    const dispatchDialog = page.getByRole('dialog', { name: '转派处置工单' });
    await expect(dispatchDialog).toBeVisible();
    await expect(dispatchDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await expect(dispatchDialog.locator('.workspace-action-route strong')).toContainText('priority=CRITICAL');
    await page.keyboard.press('Escape');
    await expect(dispatchDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'ALM-20240614-0011', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开告警详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/notifications/ALM-20240614-0011');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('告警详情抽屉')).toContainText('温度边界连续越限');

    await page.getByRole('button', { name: '创建工单' }).click();
    const workOrderDialog = page.getByRole('dialog', { name: '创建告警处置工单' });
    await expect(workOrderDialog).toBeVisible();
    await expect(workOrderDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(workOrderDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('组织策略左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/security?menu=policy');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('组织策略真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '组织策略' })).toBeVisible();
    await expect(page.getByText('风险规则 · 角色策略 · 审批边界')).toBeVisible();
    await expect(page.getByLabel('组织策略核心指标')).toContainText('风险规则');
    await expect(page.getByLabel('组织策略流程阶段')).toContainText('定义');
    await expect(page.getByLabel('组织策略顶部操作')).toContainText('新建风险评估');
    await expect(page.getByLabel('组织策略查询筛选栏')).toContainText('处理时间');
    await expect(page.getByLabel('组织策略列表')).toContainText('POL-RISK-PORT-001');
    await expect(page.getByLabel('组织策略详情抽屉')).toContainText('端口暴露命中高危策略');
    await expect(page.getByLabel('组织策略详情标签')).toContainText('审批边界');
    await expect(page.getByLabel('组织策略详情操作')).toContainText('新建评估');
    await expect(page.locator('body')).not.toContainText('workbench-menu-policy-v1');

    await page.getByLabel('组织策略顶部操作').getByRole('button', { name: '新建风险评估' }).click();
    const createDialog = page.getByRole('dialog', { name: '新建风险评估' });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.locator('.workspace-action-route strong')).toContainText('/risk-assessments/new?source=workbench&scope=policy');
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'POL-MAINT-SLA-008', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开组织策略详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/risk-matrix/POL-MAINT-SLA-008');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('组织策略详情抽屉')).toContainText('逾期维保自动转工单');

    await page.getByLabel('组织策略详情操作').getByRole('button', { name: '权限申请' }).click();
    const applyDialog = page.getByRole('dialog', { name: '申请策略权限' });
    await expect(applyDialog).toBeVisible();
    await expect(applyDialog.locator('.workspace-action-route strong')).toContainText('/approvals/new?source=workbench&type=policy');
    await page.keyboard.press('Escape');
    await expect(applyDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('基础维护左侧菜单渲染真实页面级组件而非通用产品壳', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('基础维护真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '基础维护' })).toBeVisible();
    await expect(page.getByText('分类位置 · 供应商 · 集成配置')).toBeVisible();
    await expect(page.getByLabel('基础维护核心指标')).toContainText('资产分类');
    await expect(page.getByLabel('基础维护流程阶段')).toContainText('分类');
    await expect(page.getByLabel('基础维护顶部操作')).toContainText('维护资产分类');
    await expect(page.getByLabel('基础维护查询筛选栏')).toContainText('处理时间');
    await expect(page.getByLabel('基础维护列表')).toContainText('CFG-CAT-ASSET');
    await expect(page.getByLabel('基础维护详情抽屉')).toContainText('生产设备、动力设备');
    await expect(page.getByLabel('基础维护详情标签')).toContainText('集成源');
    await expect(page.getByLabel('基础维护详情操作')).toContainText('供应商');
    await expect(page.locator('body')).not.toContainText('workbench-menu-settings-v1');

    await page.getByLabel('基础维护顶部操作').getByRole('button', { name: '维护资产分类' }).click();
    const categoryDialog = page.getByRole('dialog', { name: '维护资产分类' });
    await expect(categoryDialog).toBeVisible();
    await expect(categoryDialog.locator('.workspace-action-route strong')).toContainText('/categories?source=workbench');
    await page.keyboard.press('Escape');
    await expect(categoryDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'CFG-VDR-SPARE', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开基础维护详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/settings/sysconfig/CFG-VDR-SPARE');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('基础维护详情抽屉')).toContainText('备件供应商资质');

    await page.getByLabel('基础维护详情操作').getByRole('button', { name: '供应商' }).click();
    const vendorDialog = page.getByRole('dialog', { name: '维护供应商' });
    await expect(vendorDialog).toBeVisible();
    await expect(vendorDialog.locator('.workspace-action-route strong')).toContainText('/vendors?source=workbench');
    await page.keyboard.press('Escape');
    await expect(vendorDialog).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('设计稿总览展示 Round 1/2 业务菜单设计页并对应正式路由', async ({ page }) => {
    const errors = collectBrowserErrors(page);

    await page.goto('/workspace-preview?tab=stitch');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.workspace-stitch-grid')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.workspace-stitch-stats')).toContainText('12');
    await expect(page.locator('.workspace-stitch-stats')).toContainText('业务菜单');

    const designCards = [
      ['运营首页', '/fixed-assets/workbench?menu=home'],
      ['流程待办', '/fixed-assets/workbench?menu=todo'],
      ['资产总览', '/fixed-assets/workbench/assets?menu=asset'],
      ['设备管理', '/fixed-assets/workbench/assets?menu=device'],
      ['工单管理', '/fixed-assets/workbench/assets?menu=orders'],
      ['巡检管理', '/fixed-assets/workbench/assets?menu=inspection'],
      ['备件管理', '/fixed-assets/workbench/assets?menu=spares'],
      ['数据监控', '/fixed-assets/workbench/analytics?menu=energy'],
      ['报表分析', '/fixed-assets/workbench/analytics?menu=report'],
      ['告警中心', '/fixed-assets/workbench/security?menu=alarm'],
      ['组织策略', '/fixed-assets/workbench/security?menu=policy'],
      ['基础维护', '/fixed-assets/workbench/assets?menu=settings'],
    ];

    for (const [title, route] of designCards) {
      const card = page.locator('.workspace-stitch-card').filter({ hasText: route });
      await expect(card).toBeVisible();
      await expect(card.getByText(title, { exact: true })).toBeVisible();
      await expect(card.getByText(route, { exact: true })).toBeVisible();
      await expect(card.getByRole('link', { name: '进入业务菜单' })).toHaveAttribute('href', route);
      await expect(card.locator('img')).toBeVisible();
    }

    const overviewCard = page.locator('.workspace-stitch-card').filter({ hasText: '智能制造总览' }).first();
    await expect(overviewCard.getByText('/fixed-assets/workbench', { exact: true })).toBeVisible();
    await expect(overviewCard).not.toContainText('/fixed-assets/workbench?menu=home');

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
