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
    'asset:ledger:create',
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

type SystemHtmlPageContract = {
  title: string;
  actions: string[];
  landmark: string;
};

const systemHtmlPageContracts: Record<string, SystemHtmlPageContract> = {
  'system-asset-category': {
    title: '资产分类策略配置台',
    actions: ['新建资产分类', '保存草稿', '提交校验'],
    landmark: '编号规则引用',
  },
  'system-numbering-rules': {
    title: '资产编号规则配置台',
    actions: ['新建编号规则', '保存草稿', '提交校验'],
    landmark: '编号规则明细表',
  },
  'system-location-management': {
    title: '位置管理与资产空间绑定',
    actions: ['新建位置', '保存草稿', '提交校验'],
    landmark: '机房 B-02',
  },
  'system-vendor-management': {
    title: '供应商档案与交易反查',
    actions: ['新建供应商', '保存草稿', '提交校验'],
    landmark: '供应商引用矩阵',
  },
  'system-custom-fields': {
    title: '自定义字段治理台',
    actions: ['新建字段', '保存草稿', '提交校验'],
    landmark: '字段影响矩阵',
  },
  'system-custom-field-sets': {
    title: '自定义字段集编排台',
    actions: ['新建字段集', '保存草稿', '提交校验'],
    landmark: 'CIP转固字段集',
  },
  'system-base-params': {
    title: '基础参数运行配置台',
    actions: ['新建参数', '保存草稿', '提交校验'],
    landmark: '附件大小与格式',
  },
  'system-security-policy': {
    title: '登录会话与敏感字段策略',
    actions: ['新建策略', '保存草稿', '提交校验'],
    landmark: '安全策略列表',
  },
  'system-file-storage': {
    title: '文件存储与缩略图配置台',
    actions: ['新建存储策略', '保存草稿', '提交校验'],
    landmark: '文件存储策略编排',
  },
  'system-import-export': {
    title: '导入导出模板与队列配置台',
    actions: ['新建模板', '保存草稿', '提交校验'],
    landmark: '导入导出策略编排',
  },
  'system-cache-management': {
    title: '缓存刷新与恢复配置台',
    actions: ['新建缓存域', '保存草稿', '提交校验'],
    landmark: '缓存域与刷新规则',
  },
  'system-audit-log': {
    title: '系统操作审计配置台',
    actions: ['新建审计策略', '保存草稿', '提交校验'],
    landmark: '审计策略编排',
  },
};

const isSystemHtmlMenu = (menuId: string) => Object.prototype.hasOwnProperty.call(systemHtmlPageContracts, menuId);

const systemHtmlFrameBody = (page: Page, label: string) =>
  page.getByLabel(`${label}完整系统设置页面`).frameLocator('iframe').locator('body');

const futureSystemHtmlFrame = (page: Page) => page.frameLocator('.workspace-system-html-frame-canvas iframe');
const futureSystemHtmlFrameBody = (page: Page) => futureSystemHtmlFrame(page).locator('body');

async function expectFutureSystemFrameContract(
  page: Page,
  texts: Array<string | RegExp>,
  options: { placeholders?: string[]; pageCanScroll?: boolean } = {},
) {
  await expect(page.locator('.workspace-system-html-frame-canvas')).toBeVisible({ timeout: 10_000 });
  const frameBody = futureSystemHtmlFrameBody(page);
  await expect(frameBody).not.toContainText('Unexpected Application Error');
  for (const text of texts) {
    await expect(frameBody).toContainText(text, { timeout: 10_000 });
  }
  for (const placeholder of options.placeholders ?? []) {
    await expect(futureSystemHtmlFrame(page).getByPlaceholder(placeholder).first()).toBeVisible();
  }
  if (options.pageCanScroll) {
    await expect
      .poll(() =>
        futureSystemHtmlFrameBody(page).evaluate(
          (body) => document.documentElement.scrollHeight > window.innerHeight || body.scrollHeight > window.innerHeight,
        ),
      )
      .toBe(true);
  }
}

async function expectFutureSettingsNavigationCenter(page: Page) {
  await expectFutureSystemFrameContract(page, [
    '全量页面导航中心',
    '流程平台',
    '组织权限',
    '基础资料',
    '集成配置',
    '消息与通知',
    '系统参数',
    '导航控制台',
    '流程设计器',
    '表单配置',
    '审批规则',
    '外部系统配置',
    '邮件模板',
    '基础参数',
    '返回业务工作台',
  ]);
}

async function expectSystemHtmlPageContract(page: Page, menuId: string, label: string) {
  const contract = systemHtmlPageContracts[menuId];
  if (!contract) {
    throw new Error(`${menuId} should have a system HTML page contract`);
  }
  await expect(page.getByLabel(`${label}完整系统设置页面`)).toBeVisible({ timeout: 10_000 });
  const frameBody = systemHtmlFrameBody(page, label);
  await expect(frameBody).toContainText(contract.title, { timeout: 10_000 });
  for (const action of contract.actions) {
    await expect(frameBody).toContainText(action);
  }
  await expect(frameBody).toContainText(contract.landmark);
  await expect(page.getByLabel(`${label}产品图与 Stitch 计划`)).toBeHidden();
}

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
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '运营首页', exact: true })).toBeVisible();
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '流程待办', exact: true })).toBeVisible();
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '巡检管理', exact: true })).toBeVisible();
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '基础维护', exact: true })).toBeVisible();

    for (const tab of ['资产运营总览', '数据监控中心', '资产运维中心', '风险预警中心']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    for (const duplicateMenu of ['报表大屏', '平台配置', '维保计划']) {
      await expect(page.getByRole('button', { name: duplicateMenu, exact: true })).toHaveCount(0);
    }

    await page.getByRole('button', { name: '风险预警中心', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\/security$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('风险预警中心');
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '告警中心', exact: true })).not.toHaveClass(/is-active/);
    await expect(page.getByText('安全态势总览')).toBeVisible();
    await expect(page.getByRole('heading', { name: '安全告警研判处置' })).toHaveCount(0);

    await page.getByRole('button', { name: '旧版仪表板' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统运营中枢切换为系统配置左侧导航并可回到业务视角', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: '系统运营中枢', exact: true })).toBeVisible();
    await expect(page.locator('header').filter({ hasText: '搜索...' })).toHaveCount(0);
    await expect(page.locator('header [aria-label="搜索"]')).toHaveCount(0);
    await expect(page.locator('.workspace-topbar').getByRole('textbox')).toHaveCount(0);
    await expect(page.locator('.workspace-topbar').getByRole('searchbox')).toHaveCount(0);
    await expect(page.locator('.workspace-actions').getByRole('button', { name: /搜索/ })).toHaveCount(0);
    await expect(page.locator('.workspace-side input')).toHaveCount(0);
    await expect(page.locator('.workspace-side [aria-label*="搜索"]')).toHaveCount(0);
    await expect(page.locator('.workspace-side [placeholder*="搜索"]')).toHaveCount(0);
    await expect(page.locator('.workspace-side').getByRole('button', { name: /搜索/ })).toHaveCount(0);
    await expect(page.locator('.workspace-side').getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByLabel('运营首页搜索')).toHaveCount(0);
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '运营首页', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '系统运营中枢', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-flow-definition$/);
    await expectFutureSettingsNavigationCenter(page);
    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '运营首页', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统配置专属页内搜索直接过滤配置对象', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-external-systems');
    await page.waitForLoadState('networkidle');

    await expectFutureSystemFrameContract(page, [
      '外部系统配置',
      '集成拓扑与接口映射',
      'Systems Active',
      'ERP Core',
      'Field Mapping Matrix',
      '返回业务工作台',
    ]);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('消息与通知专用配置台支持邮件模板新建保存提交', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-mail-templates');
    await page.waitForLoadState('networkidle');
    await expectFutureSystemFrameContract(
      page,
      ['邮件模板', '新建模板', 'TPL-AST-001', '新资产入库通知', 'HTML 预览', '变量占位符', '返回业务工作台'],
      { placeholders: ['搜索模板ID/名称'] },
    );
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('消息通知配置页均可新建保存提交', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const notificationContracts = [
      {
        menuId: 'system-workflow-mail',
        texts: ['流程邮件配置', '绑定流程', '资产报修审批', '模板缺失警告', '返回业务工作台'],
        placeholders: ['搜索流程...'],
      },
      {
        menuId: 'system-mail-logs',
        texts: ['邮件日志', '状态筛选', '时间范围', 'SMTP', 'Manual Retry', '返回业务工作台'],
        placeholders: ['搜索收件人或主题...'],
      },
      {
        menuId: 'system-notification-templates',
        texts: ['通知模板', '消息与通知', '通知模板编辑', '钉钉通知', '返回业务工作台'],
        placeholders: ['Search templates...'],
      },
      {
        menuId: 'system-notification-channels',
        texts: ['通知渠道管理', '消息下发', '通道链路', '返回业务工作台'],
      },
      {
        menuId: 'system-notification-preferences',
        texts: ['通知事件矩阵配置', '当前高风险配置', '系统', '返回业务工作台'],
      },
      {
        menuId: 'system-workflow-notification-switch',
        texts: ['流程通知开关', '消息与通知', '流程通知开关', '返回业务工作台'],
      },
    ] as const;

    for (const contract of notificationContracts) {
      await page.goto(`/fixed-assets/workbench?menu=${contract.menuId}`);
      await page.waitForLoadState('networkidle');
      await expectFutureSystemFrameContract(page, contract.texts, {
        placeholders: 'placeholders' in contract ? contract.placeholders : undefined,
      });
    }
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('顶部文字密度设置进入系统基础参数配置', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '文字设置', exact: true }).click();
    const densityDialog = page.getByRole('dialog', { name: '文字与密度设置' });
    await expect(densityDialog).toBeVisible();
    await expect(densityDialog).toContainText('基础参数配置');
    await expect(densityDialog.locator('.workspace-action-route strong')).toContainText('/fixed-assets/workbench?menu=system-base-params');
    await expect(densityDialog.getByText('已接入')).toBeVisible();

    await densityDialog.getByRole('button', { name: '打开偏好配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-base-params$/);
    await expectFutureSystemFrameContract(
      page,
      ['基础参数配置', '系统参数', '管理全局系统变量', 'CORE_API_TIMEOUT', 'MAX_CONCURRENT_SESSIONS', '返回业务工作台'],
      { placeholders: ['QUERY PARAM_NAME OR RISK_LEVEL...'] },
    );
    await expect(page.locator('body')).not.toContainText('规划中');
    await expect(page.locator('body')).not.toContainText('占位');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('导航控制台页支持当前页新建保存提交', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-flow-definition');
    await page.waitForLoadState('networkidle');

    await expectFutureSettingsNavigationCenter(page);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统运营中枢全量配置页均落到 Future OS iframe 页面', async ({ page }) => {
    test.setTimeout(180_000);

    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const futureMenuContracts = [
      ['system-flow-definition', '导航控制台'],
      ['system-settings-command-center', '设置中心'],
      ['system-runtime-monitor', '运行监测'],
      ['system-approval-rules', '审批规则'],
      ['system-sla-config', 'SLA 配置'],
      ['system-user-management', '用户管理'],
      ['system-role-permissions', '角色权限'],
      ['system-menu-permissions', '菜单权限'],
      ['system-dept-org', '部门组织'],
      ['system-post-management', '岗位管理'],
      ['system-data-permissions', '数据权限'],
      ['system-handover', '工作交接'],
      ['system-tenant-management', '租户管理'],
      ['system-asset-category', '资产分类'],
      ['system-numbering-rules', '编号规则'],
      ['system-location-management', '位置管理'],
      ['system-vendor-management', '供应商管理'],
      ['system-custom-fields', '自定义字段'],
      ['system-custom-field-sets', '自定义字段集'],
      ['system-external-systems', '外部系统配置'],
      ['system-interfaces', '接口配置'],
      ['system-field-mapping', '字段映射'],
      ['system-sync-rules', '同步规则'],
      ['system-webhook-config', 'Webhook 配置'],
      ['system-workflow-mail', '流程邮件配置'],
      ['system-mail-templates', '邮件模板'],
      ['system-mail-logs', '邮件日志'],
      ['system-notification-templates', '通知模板'],
      ['system-notification-channels', '通知渠道'],
      ['system-notification-preferences', '通知偏好'],
      ['system-workflow-notification-switch', '流程通知开关'],
      ['system-base-params', '基础参数'],
      ['system-security-policy', '安全策略'],
      ['system-file-storage', '文件存储配置'],
      ['system-import-export', '导入导出配置'],
      ['system-cache-management', '缓存管理'],
      ['system-audit-log', '操作审计'],
      ['system-doc-center', '文档中心'],
      ['system-tech-support', '技术支持'],
    ] as const;

    for (const [menuId, label] of futureMenuContracts) {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await page.waitForLoadState('domcontentloaded');
      if (menuId === 'system-flow-definition') {
        await expectFutureSettingsNavigationCenter(page);
      } else {
        await expectFutureSystemFrameContract(page, [label, '返回业务工作台']);
      }
    }
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统运营中枢薄弱配置页搜索下沉到专属页面', async ({ page }) => {
    test.setTimeout(90_000);

    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const futureSearchContracts = [
      {
        menuId: 'system-approval-rules',
        texts: ['审批规则 (Approval Rules)', 'Rule Name / Code', 'High-Value Expense Routing'],
        placeholders: ['Search rules...'],
      },
      {
        menuId: 'system-sla-config',
        texts: ['SLA 配置', '响应与处理基准策略', '核心系统故障响应', 'SLA-REQ-001'],
        placeholders: ['搜索策略名称、适用流程...'],
      },
      {
        menuId: 'system-asset-category',
        texts: ['资产分类', '分类目录', '五轴加工中心'],
        placeholders: ['搜索分类...'],
      },
      {
        menuId: 'system-numbering-rules',
        texts: ['编号规则引擎', '基础资料', '版本历史'],
      },
      {
        menuId: 'system-interfaces',
        texts: ['接口配置', '活跃接口', '警告 / 高延迟'],
        placeholders: ['按路径筛选...'],
      },
      {
        menuId: 'system-field-mapping',
        texts: ['SAP ERP Asset Integration', 'Active Mappings', 'Review Required'],
        placeholders: ['Search fields...'],
      },
      {
        menuId: 'system-audit-log',
        texts: ['操作审计 Live Monitor', '审计日志', '系统参数'],
      },
    ] as const;

    for (const contract of futureSearchContracts) {
      await page.goto(`/fixed-assets/workbench?menu=${contract.menuId}`);
      await page.waitForLoadState('networkidle');
      await expectFutureSystemFrameContract(page, contract.texts, {
        placeholders: 'placeholders' in contract ? contract.placeholders : undefined,
      });
    }
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('基础资料主数据页均可新建保存提交', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const masterDataContracts = [
      {
        menuId: 'system-asset-category',
        texts: ['资产分类', '分类目录', '五轴加工中心', '编号规则配置'],
        placeholders: ['搜索分类...'],
      },
      {
        menuId: 'system-numbering-rules',
        texts: ['编号规则引擎', '基础资料', '版本历史'],
      },
      {
        menuId: 'system-location-management',
        texts: ['位置管理', 'LOCATION_HIERARCHY', '子位置列表'],
        placeholders: ['CMD: SEARCH_LOCATION...'],
      },
      {
        menuId: 'system-vendor-management',
        texts: ['供应商目录与状态审计', 'SYNC_STATUS: OK'],
        placeholders: ['搜索供应商名称、统一社会信用代码、或系统ID...'],
      },
      {
        menuId: 'system-custom-fields',
        texts: ['自定义字段配置 (Custom Fields)', 'PROD_ENV'],
        placeholders: ['CMD: Search fields...'],
      },
      {
        menuId: 'system-custom-field-sets',
        texts: ['自定义字段集配置矩阵', '业务场景', '渲染顺序'],
      },
    ] as const;

    for (const contract of masterDataContracts) {
      await page.goto(`/fixed-assets/workbench?menu=${contract.menuId}`);
      await page.waitForLoadState('networkidle');
      await expectFutureSystemFrameContract(page, contract.texts, {
        placeholders: 'placeholders' in contract ? contract.placeholders : undefined,
      });
    }
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('顶部主导航页保留产品承接区且不误落入左侧业务页', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    const stageCases = [
      {
        route: '/fixed-assets/workbench',
        title: '资产运营总览',
        bridge: '资产运营总览产品承接区',
        forbiddenHeading: '运营首页',
        assetPath: '/mock/workspace-preview/asset-kit-v7/top-nav/top-nav-manufacturing-overview-v1.png',
      },
      {
        route: '/fixed-assets/workbench/analytics',
        title: '数据监控中心',
        bridge: '数据监控中心产品承接区',
        forbiddenHeading: '数据监控',
        assetPath: '/mock/workspace-preview/asset-kit-v7/top-nav/top-nav-data-monitoring-v1.png',
      },
      {
        route: '/fixed-assets/workbench/assets',
        title: '资产运维中心',
        bridge: '资产运维中心产品承接区',
        forbiddenHeading: '资产总览',
        assetPath: '/mock/workspace-preview/asset-kit-v7/top-nav/top-nav-asset-operations-v1.png',
      },
      {
        route: '/fixed-assets/workbench/security',
        title: '风险预警中心',
        bridge: '风险预警中心产品承接区',
        forbiddenHeading: '告警中心',
        assetPath: '/mock/workspace-preview/asset-kit-v7/top-nav/top-nav-security-posture-v1.png',
      },
    ];

    for (const item of stageCases) {
      await page.goto(item.route);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.workspace-topbar-title strong')).toHaveText(item.title);
      await expect(page.locator('.workspace-brand-mark img')).toHaveAttribute(
        'src',
        '/mock/workspace-preview/asset-kit-v7/top-nav/workbench-brand-badge-v1.png',
      );
      await expect(page.getByLabel(item.bridge)).toBeVisible();
      await expect(page.getByLabel(item.bridge)).toContainText(item.title);
      await expect(page.getByLabel(item.bridge).locator('.workspace-stage-bridge-visual img')).toHaveAttribute('src', item.assetPath);
      await expect(page.getByRole('heading', { name: item.forbiddenHeading, exact: true })).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    }

    expect(errors).toEqual([]);
  });

  test('Workbench 关键动作展示真实目标、预填上下文并进入业务页', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench?menu=todo');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: '流程待办', exact: true })).toHaveClass(/is-active/);
    await page.getByLabel('流程待办顶部操作').getByRole('button', { name: '批量处理' }).click();
    const todoDialog = page.getByRole('dialog', { name: '处理审批队列' });
    await expect(todoDialog).toBeVisible();
    await expect(todoDialog.getByText('/approvals?source=workbench&status=PENDING').first()).toBeVisible();
    await expect(todoDialog.getByText('预填字段')).toBeVisible();
    const todoPrimaryButton = todoDialog.locator('.workspace-action-buttons button').last();
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
        label: '资产总览',
        route: '/fixed-assets/workbench/assets?menu=asset',
        action: '新建资产',
        dialogName: '新增资产',
        targetIncludes: ['/assets/new?source=workbench&from=asset-overview'],
      },
      {
        label: '设备管理',
        route: '/fixed-assets/workbench/assets?menu=device',
        action: '打开设备台账',
        dialogName: '打开设备台账',
        targetIncludes: ['/equipment?source=workbench'],
      },
      {
        label: '工单管理',
        route: '/fixed-assets/workbench/assets?menu=orders',
        action: '新建工单',
        dialogName: '创建预测工单',
        targetIncludes: ['/workorders/new?', 'source=quick-action', 'riskScore=92', 'priority=HIGH'],
      },
      {
        label: '巡检管理',
        route: '/fixed-assets/workbench/assets?menu=inspection',
        action: '导出',
        dialogName: '导出巡检计划',
        targetIncludes: ['/inspections?source=workbench&export=plan'],
      },
      {
        label: '备件管理',
        route: '/fixed-assets/workbench/assets?menu=spares',
        action: '查看备件库存',
        dialogName: '查看备件库存',
        targetIncludes: ['/spare-parts?source=workbench&stock=LOW'],
      },
      {
        label: '数据监控',
        route: '/fixed-assets/workbench/analytics?menu=energy',
        action: '刷新',
        dialogName: '刷新数据链路',
        targetIncludes: ['/energy?source=workbench&scope=data-monitoring&refresh=true'],
      },
      {
        label: '报表分析',
        route: '/fixed-assets/workbench/analytics?menu=report',
        action: '导出',
        dialogName: '导出资产趋势',
        targetIncludes: ['/reports?source=workbench&view=asset-trend&export=csv'],
      },
      {
        label: '告警中心',
        route: '/fixed-assets/workbench/security?menu=alarm',
        action: '自动刷新（30s）',
        dialogName: '自动刷新告警',
        targetIncludes: ['/notifications?source=workbench&menu=alarm&refresh=30s'],
      },
      {
        label: '组织策略',
        route: '/fixed-assets/workbench/security?menu=policy',
        action: '导出',
        dialogName: '导出组织策略',
        targetIncludes: ['/risk-matrix?source=workbench&scope=policy&export=rules'],
      },
      {
        label: '基础维护',
        route: '/fixed-assets/workbench/assets?menu=settings',
        action: '新建分类',
        dialogName: '新建基础分类',
        targetIncludes: ['/settings/sysconfig/new?source=workbench'],
      },
    ];

    for (const actionCase of actionCases) {
      await page.goto(actionCase.route);
      await page.waitForLoadState('networkidle');

      await page.getByLabel(`${actionCase.label}顶部操作`).getByRole('button', { name: actionCase.action, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: actionCase.dialogName });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('预填字段')).toBeVisible();

      const routeTarget = await dialog.locator('.workspace-action-route strong').innerText();
      for (const expectedFragment of actionCase.targetIncludes) {
        expect(routeTarget).toContain(expectedFragment);
      }

      await expect(dialog.locator('.workspace-action-buttons button').last()).toBeEnabled();
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
      await expect(page.getByLabel(`${pageLabel}产品页主体`)).toBeVisible();
      await expect(page.locator('.workspace-product-page')).toHaveCount(0);
      await expect(page.locator('.workspace-orders-page')).toBeVisible();
      if (pageLabel === '运营首页') {
        await expect(page.getByLabel('运营首页任务墙')).toBeVisible();
      } else if (pageLabel === '数据监控') {
        await expect(page.getByLabel('数据监控列表')).toBeVisible();
      } else if (pageLabel === '组织策略') {
        await expect(page.getByLabel('组织策略规则列表')).toBeVisible();
      } else if (pageLabel === '基础维护') {
        await expect(page.getByLabel('基础维护配置对象列表')).toBeVisible();
      } else if (pageLabel === '巡检管理') {
        await expect(page.getByLabel('巡检任务列表')).toBeVisible();
      } else {
        await expect(page.locator('.workspace-orders-table')).toBeVisible();
      }

      if (pageLabel === '备件管理') {
        await expect(page.getByLabel('备件管理批量操作')).toBeVisible();
        await expect(page.getByLabel('备件保障流程')).toBeHidden();
        await expect(page.locator('.workspace-orders-table-row')).toHaveCount(8);
      }
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
    await expect(page.getByLabel('运营首页产品页主体').getByRole('heading', { name: '运营首页' })).toBeVisible();
    await expect(page.getByText('上午好，张三丰')).toBeVisible();
    await expect(page.getByLabel('运营首页指挥入口')).toBeHidden();
    await expect(page.getByLabel('运营首页核心指标')).toContainText('资产健康');
    await expect(page.getByLabel('运营首页核心指标').getByRole('button')).toHaveCount(5);
    await expect(page.getByLabel('运营首页核心指标')).toContainText('资产价值');
    await expect(page.getByLabel('运营首页搜索')).toHaveCount(0);
    const filterBeforeKpi = await page.evaluate(() => {
      const filterTop = document.querySelector('[aria-label="运营首页查询筛选栏"]')?.getBoundingClientRect().top ?? 0;
      const kpiTop = document.querySelector('[aria-label="运营首页核心指标"]')?.getBoundingClientRect().top ?? 0;
      return filterTop < kpiTop;
    });
    expect(filterBeforeKpi).toBe(true);
    await expect(page.getByLabel('运营首页洞察看板')).toContainText('最近工单');
    await expect(page.getByLabel('运营首页运营图表')).toContainText('资产在线率');
    await expect(page.getByLabel('运营首页流程阶段')).toBeHidden();
    await expect(page.getByLabel('运营首页顶部操作')).toContainText('新建预测工单');
    await expect(page.getByLabel('运营首页快捷发起')).toContainText('处理流程待办');
    await expect(page.getByLabel('运营首页查询筛选栏')).toContainText('处理时间');
    await expect(page.getByLabel('运营首页任务墙')).toContainText('OPS-20240614-001');
    await expect(page.getByLabel('运营首页详情抽屉')).toContainText('主轴振动异常');
    await expect(page.getByLabel('当前运营事项信息')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('今日运营洞察')).toContainText('CN-301 振动异常优先派工');
    await expect(page.getByLabel('维保预警队列')).toContainText('CN-301');
    await expect(page.getByLabel('运营首页详情标签')).toContainText('维保预警');
    await expect(page.getByLabel('运营首页权限反馈')).toContainText('关键操作入口可用');
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
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/approvals/OPS-20240614-002/process?source=workbench');
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

  test('运营首页在窄屏分辨率下不裁切主体信息', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 794, height: 890 });
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('运营首页产品页主体')).toBeVisible();
    await expect(page.getByLabel('运营首页任务墙')).toBeVisible();
    await page.getByLabel('维保预警队列').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('维保预警队列')).toBeVisible();
    await page.getByLabel('运营首页详情操作').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('运营首页详情操作')).toContainText('新建工单');

    const responsiveState = await page.evaluate(() => {
      const center = document.querySelector('[aria-label="运营首页产品页主体"]');
      const product = document.querySelector('.workspace-home-product');
      const centerStyle = center ? getComputedStyle(center) : null;
      const productStyle = product ? getComputedStyle(product) : null;
      return {
        centerOverflowY: centerStyle?.overflowY,
        productOverflow: productStyle?.overflow,
        pageCanScroll: document.documentElement.scrollHeight > window.innerHeight,
        centerHeight: center?.getBoundingClientRect().height ?? 0,
      };
    });

    expect(responsiveState.centerOverflowY).toBe('visible');
    expect(responsiveState.productOverflow).toBe('visible');
    expect(responsiveState.pageCanScroll).toBe(true);
    expect(responsiveState.centerHeight).toBeGreaterThan(900);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('流程设计器在窄屏下保持大画布建模态', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 794, height: 890 });
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-flow-designer');
    await page.waitForLoadState('networkidle');

    await expectFutureSystemFrameContract(page, [
      '流程设计器',
      '采购审批流程_V2.1',
      '部门主管审批',
      '金额条件判断',
      '环节属性配置',
      '保存草稿',
    ]);
    const flowDesignerFrameState = await futureSystemHtmlFrameBody(page).evaluate((body) => ({
      contentVisible: body.getBoundingClientRect().height > 0,
      contentReadable: body.getBoundingClientRect().width > 0 && body.scrollWidth >= body.clientWidth,
    }));
    expect(flowDesignerFrameState.contentVisible).toBe(true);
    expect(flowDesignerFrameState.contentReadable).toBe(true);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('表单配置在窄屏下保持设计画布与H5预览可读', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 794, height: 890 });
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-form-config');
    await page.waitForLoadState('networkidle');

    await expectFutureSystemFrameContract(
      page,
      ['表单字段权限配置', 'Matrix ID: FRM-PRM-2023-A9', '采购申请单表单 V2.4', '可写(W)', '只读(R)', '隐藏(H)'],
    );
    const formConfigFrameState = await futureSystemHtmlFrameBody(page).evaluate((body) => ({
      contentVisible: body.getBoundingClientRect().height > 0,
      contentReadable: body.getBoundingClientRect().width > 0 && body.scrollWidth >= body.clientWidth,
    }));
    expect(formConfigFrameState.contentVisible).toBe(true);
    expect(formConfigFrameState.contentReadable).toBe(true);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('审批规则在窄屏下保持命中编排和门禁矩阵可读', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 794, height: 890 });
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-approval-rules');
    await page.waitForLoadState('networkidle');

    await expectFutureSystemFrameContract(
      page,
      ['审批规则 (Approval Rules)', 'Rule Name / Code', 'High-Value Expense Routing', 'Rule Inspector', 'AI Suggestion'],
      { placeholders: ['Search rules...'] },
    );
    const approvalRulesFrameState = await futureSystemHtmlFrameBody(page).evaluate((body) => ({
      contentVisible: body.getBoundingClientRect().height > 0,
      contentReadable: body.getBoundingClientRect().width > 0 && body.scrollWidth >= body.clientWidth,
    }));
    expect(approvalRulesFrameState.contentVisible).toBe(true);
    expect(approvalRulesFrameState.contentReadable).toBe(true);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('运营首页在桌面分辨率下不被固定高度截断', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 1796, height: 1000 });
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench?menu=home');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('运营首页产品页主体')).toBeVisible();
    await expect(page.getByLabel('运营首页任务墙')).toBeVisible();
    await expect(page.getByLabel('运营首页详情抽屉')).toContainText('主轴振动异常');

    const desktopState = await page.evaluate(() => {
      const product = document.querySelector('.workspace-home-product');
      const taskWall = document.querySelector('[aria-label="运营首页任务墙"]');
      const detail = document.querySelector('[aria-label="运营首页详情抽屉"]');
      const productRect = product?.getBoundingClientRect();
      const taskRect = taskWall?.getBoundingClientRect();
      const detailRect = detail?.getBoundingClientRect();
      const productStyle = product ? getComputedStyle(product) : null;

      return {
        productHeight: productRect?.height ?? 0,
        productBottomGap: productRect ? window.innerHeight - productRect.bottom : 0,
        productMaxHeight: productStyle?.maxHeight,
        productOverflow: productStyle?.overflow,
        taskHeight: taskRect?.height ?? 0,
        detailHeight: detailRect?.height ?? 0,
      };
    });

    expect(desktopState.productHeight).toBeGreaterThan(900);
    expect(desktopState.productBottomGap).toBeGreaterThanOrEqual(0);
    expect(desktopState.productBottomGap).toBeLessThan(24);
    expect(desktopState.productMaxHeight).toBe('none');
    expect(desktopState.productOverflow).toBe('hidden');
    expect(desktopState.taskHeight).toBeGreaterThan(220);
    expect(desktopState.detailHeight).toBeGreaterThan(880);
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
    await expect(page.getByText('资产健康与生命周期管理')).toBeVisible();
    await expect(page.getByLabel('资产总览查询筛选栏')).toContainText('更多筛选');
    await expect(page.getByLabel('资产总览核心指标')).toContainText('资产总价值');
    await expect(page.getByLabel('资产总览核心指标')).toContainText('12,856 台');
    await expect(page.getByLabel('资产生命周期', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('资产总览图表')).toContainText('资产健康分布');
    await expect(page.getByLabel('资产总览图表')).toContainText('资产生命周期分布');
    await expect(page.getByLabel('资产总览图表')).toContainText('资产分类分布（按价值）');
    await expect(page.getByLabel('资产总览图表')).toContainText('生产设备');
    await expect(page.getByLabel('资产总览顶部操作')).toContainText('新建资产');
    await expect(page.getByLabel('资产总览列表')).toContainText('AS-2024-06014-0001');
    await expect(page.getByLabel('资产总览列表')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('资产总览列表')).toContainText('详情');
    await expect(page.getByLabel('资产详情抽屉')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('资产详情标签')).toContainText('资产信息');
    await expect(page.getByLabel('资产详情操作')).toContainText('调拨/转移');
    await expect(page.locator('body')).not.toContainText('workbench-menu-asset-v1');

    await page.getByRole('button', { name: /生成风险工单/ }).click();
    const riskDialog = page.getByRole('dialog', { name: '生成风险工单' });
    await expect(riskDialog).toBeVisible();
    await expect(riskDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await page.keyboard.press('Escape');
    await expect(riskDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'AS-2024-06014-0002', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开资产详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/assets/AS-2024-06014-0002');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('资产详情抽屉')).toContainText('立式加工中心 VM-205');

    await page.getByRole('button', { name: '调拨/转移' }).click();
    const transferDialog = page.getByRole('dialog', { name: '调拨/转移' });
    await expect(transferDialog).toBeVisible();
    await expect(transferDialog.locator('.workspace-action-route strong')).toContainText('/disposals/transfer/new?source=workbench&assetId=AS-2024-06014-0002');
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
    await expect(page.getByLabel('设备筛选条件')).toContainText('设备名称');
    await expect(page.getByLabel('设备筛选条件')).toContainText('采集延迟');
    await expect(page.getByLabel('设备管理核心指标')).toContainText('在线设备');
    await expect(page.getByLabel('设备实时监测')).toContainText('选中设备实时监测');
    await expect(page.getByLabel('设备健康趋势')).toContainText('数控车床 CN-301');
    await expect(page.getByLabel('产线设备状态分布')).toContainText('CNC 区域 A线');
    await expect(page.getByLabel('异常设备队列')).toContainText('DEV-CN-301');
    await expect(page.getByLabel('设备快捷操作')).toContainText('创建设备工单');
    await expect(page.getByLabel('设备运维阶段')).toBeHidden();
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

  test('资产设备告警数据监控桌面承载不被固定高度截断', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 1796, height: 1000 });
    await seedAuthenticatedSession(page, operationsUser);

    const cases = [
      {
        url: '/fixed-assets/workbench/assets?menu=asset',
        root: '.workspace-asset-page',
        shell: '[aria-label="资产总览产品页主体"]',
        detail: '[aria-label="资产详情抽屉"]',
        table: '[aria-label="资产总览列表"]',
      },
      {
        url: '/fixed-assets/workbench/assets?menu=device',
        root: '.workspace-device-page',
        shell: '[aria-label="设备管理产品页主体"]',
        detail: '[aria-label="设备详情抽屉"]',
        table: '[aria-label="设备管理列表"]',
      },
      {
        url: '/fixed-assets/workbench/security?menu=alarm',
        root: '.workspace-alarm-page',
        shell: '[aria-label="告警中心产品页主体"]',
        detail: '[aria-label="告警详情抽屉"]',
        table: '[aria-label="告警中心列表"]',
      },
      {
        url: '/fixed-assets/workbench/analytics?menu=energy',
        root: '.workspace-energy-page',
        shell: '[aria-label="数据监控产品页主体"]',
        detail: '[aria-label="数据监控详情抽屉"]',
        table: '[aria-label="数据监控列表"]',
      },
    ];

    for (const layoutCase of cases) {
      await page.goto(layoutCase.url);
      await page.waitForLoadState('networkidle');
      await page.locator(layoutCase.root).waitFor({ state: 'visible' });

      const metrics = await page.evaluate((selectors) => {
        const getRect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
        const getStyle = (selector: string) => {
          const element = document.querySelector(selector);
          return element ? getComputedStyle(element) : null;
        };
        const product = getRect(selectors.root);
        const shell = getRect(selectors.shell);
        const detail = getRect(selectors.detail);
        const table = getRect(selectors.table);
        const viewport = window.innerHeight;

        return {
          productHeight: product?.height ?? 0,
          productBottomGap: viewport - (product?.bottom ?? 0),
          productOverflow: getStyle(selectors.root)?.overflow ?? '',
          shellHeight: shell?.height ?? 0,
          shellBottomGap: viewport - (shell?.bottom ?? 0),
          shellOverflow: getStyle(selectors.shell)?.overflow ?? '',
          detailHeight: detail?.height ?? 0,
          detailBottomGap: viewport - (detail?.bottom ?? 0),
          detailOverflow: getStyle(selectors.detail)?.overflow ?? '',
          tableHeight: table?.height ?? 0,
          tableOverflow: getStyle(selectors.table)?.overflow ?? '',
        };
      }, layoutCase);

      expect(metrics.productHeight).toBeGreaterThan(880);
      expect(metrics.productBottomGap).toBeGreaterThanOrEqual(0);
      expect(metrics.productBottomGap).toBeLessThan(32);
      expect(metrics.productOverflow).toBe('hidden');
      expect(metrics.shellHeight).toBeGreaterThan(880);
      expect(metrics.shellBottomGap).toBeGreaterThanOrEqual(0);
      expect(metrics.shellBottomGap).toBeLessThan(40);
      expect(metrics.shellOverflow).toBe('hidden');
      expect(metrics.detailHeight).toBeGreaterThan(880);
      expect(metrics.detailBottomGap).toBeGreaterThanOrEqual(0);
      expect(metrics.detailBottomGap).toBeLessThan(40);
      expect(metrics.detailOverflow).toBe('hidden');
      expect(metrics.tableHeight).toBeGreaterThan(320);
      expect(metrics.tableOverflow).toMatch(/auto|scroll/);
      await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    }

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
    await expect(page.getByLabel('流程待办详情卡片')).toContainText('基本信息');
    await expect(page.getByLabel('流程待办详情卡片')).toContainText('审批流程');
    await expect(page.getByLabel('流程待办详情卡片')).toContainText('维修报告.pdf');
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

    await page.getByRole('button', { name: '转交' }).click();
    const assignDialog = page.getByRole('dialog', { name: '转交待办' });
    await expect(assignDialog).toBeVisible();
    await expect(assignDialog.locator('.workspace-action-route strong')).toContainText('/assign?source=workbench');
    await page.keyboard.press('Escape');
    await expect(assignDialog).toHaveCount(0);

    await page.getByRole('button', { name: '驳回' }).click();
    const rejectDialog = page.getByRole('dialog', { name: '驳回待办' });
    await expect(rejectDialog).toBeVisible();
    await expect(rejectDialog.locator('.workspace-action-route strong')).toContainText('/reject?source=workbench');
    await page.keyboard.press('Escape');
    await expect(rejectDialog).toHaveCount(0);

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
    await expect(page.getByLabel('工单管理核心指标')).toContainText('预测工单');
    await expect(page.getByLabel('工单管理核心指标')).toContainText('SLA 逾期');
    await expect(page.getByLabel('工单管理核心指标')).toContainText('今日闭环');
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

  test('巡检管理左侧菜单按产品图渲染任务、路线、异常和详情闭环', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, operationsUser);

    await page.goto('/fixed-assets/workbench/assets?menu=inspection');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('巡检管理真实产品页')).toBeVisible();
    await expect(page.locator('.workspace-product-page')).toHaveCount(0);
    await expect(page.getByLabel('巡检管理产品页主体')).toBeVisible();
    await expect(page.getByLabel('巡检管理二级菜单')).toContainText('巡检计划');
    await expect(page.getByLabel('巡检管理二级菜单')).toContainText('异常管理');
    await expect(page.getByLabel('巡检管理顶部操作')).toContainText('扫码签到');
    await expect(page.getByLabel('巡检管理顶部操作')).toContainText('新建巡检任务');
    await expect(page.getByLabel('巡检管理核心指标')).toContainText('今日计划');
    await expect(page.getByLabel('巡检管理核心指标')).toContainText('待转工单');
    await expect(page.getByLabel('巡检管理查询筛选栏')).toContainText('路线全部');
    await expect(page.getByLabel('巡检日历')).toContainText('2026年6月');
    await expect(page.getByLabel('路线执行概览')).toContainText('生产一部日常巡检路线');
    await expect(page.getByLabel('巡检任务列表')).toContainText('XR-20260614-0001');
    await expect(page.getByLabel('巡检异常队列')).toContainText('空压机 CP-101');
    await expect(page.getByLabel('巡检详情抽屉')).toContainText('巡检详情');
    await expect(page.getByLabel('点位清单')).toContainText('主轴振动传感器');
    await expect(page.getByLabel('点位详情')).toContainText('6.2 mm/s');
    await expect(page.locator('body')).not.toContainText('workbench-menu-inspection-v1');

    await page.getByLabel('巡检管理顶部操作').getByRole('button', { name: '导出' }).click();
    const exportDialog = page.getByRole('dialog', { name: '导出巡检计划' });
    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.locator('.workspace-action-route strong')).toContainText('/inspections?source=workbench&export=plan');
    await page.keyboard.press('Escape');
    await expect(exportDialog).toHaveCount(0);

    await page.getByRole('button', { name: /动力站设备巡检路线/ }).first().click();
    const routeDialog = page.getByRole('dialog', { name: '打开巡检详情' });
    await expect(routeDialog).toBeVisible();
    await expect(routeDialog.locator('.workspace-action-route strong')).toContainText('/inspections/XR-20260614-0002?source=workbench&menu=inspection');
    await page.keyboard.press('Escape');
    await expect(routeDialog).toHaveCount(0);
    await expect(page.getByLabel('巡检详情抽屉')).toContainText('动力站设备巡检路线');

    await page.getByLabel('巡检详情操作').getByRole('button', { name: '转工单' }).click();
    const workOrderDialog = page.getByRole('dialog', { name: '巡检异常转工单' });
    await expect(workOrderDialog).toBeVisible();
    await expect(workOrderDialog.locator('.workspace-action-route strong')).toContainText('/workorders/new?');
    await expect(workOrderDialog.locator('.workspace-action-route strong')).toContainText('source=asset-risk');
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
    await expect(page.getByLabel('备件库存概览')).toContainText('最小库存');
    await expect(page.getByLabel('备件快捷操作')).toContainText('申请备件');
    await expect(page.getByLabel('备件危险操作')).toContainText('删除备件会影响库存');
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
    await expect(page.getByLabel('数据监控产品页主体').getByRole('heading', { name: '数据监控' })).toBeVisible();
    await expect(page.getByLabel('数据监控链路域')).toBeHidden();
    await expect(page.getByLabel('数据监控页面分栏')).toContainText('数据链路总览');
    await expect(page.getByLabel('数据监控页面分栏')).toContainText('数据源管理');
    await expect(page.getByLabel('数据监控页面分栏')).toContainText('数据事件');
    await expect(page.getByLabel('数据监控核心指标')).toContainText('数据链路状态');
    await expect(page.getByLabel('数据监控核心指标')).toContainText('今日数据量');
    await expect(page.getByLabel('数据监控驾驶舱')).toContainText('数据链路状态');
    await expect(page.getByLabel('数据链路状态')).toContainText('IoT 连接层');
    await expect(page.getByLabel('数据源健康 TOP5')).toContainText('设备运行数据源');
    await expect(page.getByLabel('数据监控趋势图')).toContainText('4.3s');
    await expect(page.getByLabel('数据监控流程阶段')).toBeHidden();
    await expect(page.getByLabel('数据监控顶部操作')).toContainText('订阅 / 导出');
    await expect(page.getByLabel('数据监控顶部操作')).toContainText('自动刷新 30s');
    await expect(page.getByLabel('数据监控查询筛选栏')).toContainText('2026-06-14');
    await expect(page.getByLabel('数据监控列表')).toContainText('采集延迟超过阈值');
    await expect(page.getByLabel('数据监控详情抽屉')).toContainText('采集延迟事件');
    await expect(page.getByLabel('当前数据监控信息')).toContainText('EVT-20240614-0001');
    await expect(page.getByLabel('数据监控详情抽屉')).toContainText('影响范围');
    await expect(page.getByLabel('数据监控详情标签')).toContainText('趋势图');
    await expect(page.getByLabel('数据监控详情操作')).toContainText('重试采集');
    await expect(page.locator('body')).not.toContainText('workbench-menu-energy-v1');

    await page.getByLabel('数据监控顶部操作').getByRole('button', { name: '刷新', exact: true }).click();
    const refreshDialog = page.getByRole('dialog', { name: '刷新数据链路' });
    await expect(refreshDialog).toBeVisible();
    await expect(refreshDialog.locator('.workspace-action-route strong')).toContainText('refresh=true');
    await page.keyboard.press('Escape');
    await expect(refreshDialog).toHaveCount(0);

    await page.getByLabel('数据监控列表').getByRole('button', { name: '2026-06-14 10:26:01', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开数据监控详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/energy/EVT-20240614-0002?source=workbench&menu=energy');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('数据监控详情抽屉')).toContainText('能耗数据源');

    await page.getByLabel('数据监控详情操作').getByRole('button', { name: '重试采集' }).click();
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
    await expect(page.getByLabel('报表分析页面分栏')).toContainText('模板中心');
    await expect(page.getByLabel('报表分析查询筛选栏')).toContainText('资产价值信息总览');
    await expect(page.getByLabel('报表分析查询筛选栏')).toContainText('近30天');
    await expect(page.getByLabel('报表分析核心指标')).toContainText('资产总价值');
    await expect(page.getByLabel('报表分析核心指标')).toContainText('¥98,760.25 万');
    await expect(page.getByLabel('报表分析图表区')).toContainText('资产价值趋势');
    await expect(page.getByLabel('报表趋势图')).toContainText('¥98,760.25 万');
    await expect(page.getByLabel('资产分类环图')).toContainText('生产设备');
    await expect(page.getByLabel('部门资产排行')).toContainText('制造一部');
    await expect(page.getByLabel('导出历史摘要')).toContainText('资产价值总览_20260614.xlsx');
    await expect(page.getByLabel('报表分析流程')).toHaveCount(0);
    await expect(page.getByLabel('报表分析顶部操作')).toContainText('导出');
    await expect(page.getByLabel('报表分析列表')).toContainText('制造一部');
    await expect(page.getByLabel('报表分析列表')).toContainText('风险资产');
    await expect(page.getByLabel('报表详情抽屉')).toContainText('资产价值信息总览');
    await expect(page.getByLabel('报表详情标签')).toContainText('审计追溯');
    await expect(page.getByLabel('报表详情操作')).toContainText('订阅此报表');
    await expect(page.locator('body')).not.toContainText('workbench-menu-report-v1');

    await page.getByRole('button', { name: '导出', exact: true }).click();
    const exportDialog = page.getByRole('dialog', { name: '导出资产趋势' });
    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.locator('.workspace-action-route strong')).toContainText('/reports?source=workbench&view=asset-trend&export=csv');
    await page.keyboard.press('Escape');
    await expect(exportDialog).toHaveCount(0);

    await page.getByLabel('报表分析列表').getByRole('button', { name: '查看详情' }).first().click();
    const departmentDialog = page.getByRole('dialog', { name: '制造一部资产统计详情' });
    await expect(departmentDialog).toBeVisible();
    await expect(departmentDialog.locator('.workspace-action-route strong')).toContainText('department=');
    await page.keyboard.press('Escape');
    await expect(departmentDialog).toHaveCount(0);
    await expect(page.getByLabel('报表详情抽屉')).toContainText('资产价值信息总览');

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
    await expect(page.getByText('告警识别 · 策略命中 · 处置闭环')).toBeVisible();
    await expect(page.getByLabel('告警中心核心指标')).toContainText('高危');
    await expect(page.getByLabel('告警中心核心指标')).toContainText('策略命中');
    await expect(page.getByLabel('告警状态分组')).toContainText('全部告警');
    await expect(page.getByLabel('告警中心顶部操作')).toContainText('自动刷新');
    await expect(page.getByLabel('告警中心查询筛选栏')).toContainText('高级筛据');
    await expect(page.getByLabel('告警中心列表')).toContainText('主轴异常振动');
    await expect(page.getByLabel('告警详情抽屉')).toContainText('主轴异常振动');
    await expect(page.getByLabel('告警详情抽屉')).toContainText('ALT-20240614-0001');
    await expect(page.getByLabel('告警策略命中分析')).toContainText('趋势预览');
    await expect(page.getByLabel('告警处置动作')).toContainText('转工单');
    await expect(page.getByLabel('告警闭环进度')).toContainText('25%');
    await expect(page.getByLabel('告警详情标签')).toContainText('策略命中');
    await expect(page.getByLabel('告警详情操作')).toContainText('创建工单');
    await expect(page.locator('body')).not.toContainText('workbench-menu-alert-v1');

    await page.getByLabel('告警处置动作').getByRole('button', { name: '转工单' }).click();
    const dispatchDialog = page.getByRole('dialog', { name: '转工单告警' });
    await expect(dispatchDialog).toBeVisible();
    await expect(dispatchDialog.locator('.workspace-action-route strong')).toContainText('/notifications/ALT-20240614-0001/process?');
    await expect(dispatchDialog.locator('.workspace-action-route strong')).toContainText('mode=workorder');
    await page.keyboard.press('Escape');
    await expect(dispatchDialog).toHaveCount(0);

    await page.getByRole('button', { name: '主电机过温报警', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开告警详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/notifications/ALT-20240614-0002');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('告警详情抽屉')).toContainText('主电机过温报警');

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
    await expect(page.getByText('统一管理风险规则、角色策略与审批边界')).toBeVisible();
    await expect(page.getByLabel('组织策略治理域')).toHaveCount(0);
    await expect(page.getByLabel('组织策略二级策略域')).toHaveCount(0);
    await expect(page.getByLabel('组织策略核心指标')).toContainText('风险规则');
    await expect(page.getByLabel('组织策略规则标签')).toContainText('风险规则');
    await expect(page.getByLabel('组织策略规则标签')).toContainText('角色策略');
    await expect(page.getByLabel('组织策略规则标签')).toContainText('审批边界');
    await expect(page.getByLabel('组织策略顶部操作')).toContainText('新建规则');
    await expect(page.getByLabel('组织策略查询筛选栏')).toContainText('查询');
    await expect(page.getByLabel('组织策略查询筛选栏')).toContainText('重置');
    await expect(page.getByLabel('组织策略规则列表')).toContainText('RR-2024-00068');
    await expect(page.getByLabel('组织策略规则列表')).toContainText('设备停机超过阈值');
    await expect(page.getByLabel('组织策略规则列表')).toContainText('命中次数（近7天）');
    await expect(page.getByLabel('组织策略规则列表')).toContainText('查看');
    await expect(page.getByLabel('组织策略详情抽屉')).toContainText('设备停机超过阈值');
    await expect(page.getByLabel('当前组织策略规则信息')).toContainText('2026-06-14 10:20');
    await expect(page.getByLabel('适用范围')).toContainText('关键设备，生产设备');
    await expect(page.getByLabel('审批策略')).toContainText('三级审批');
    await expect(page.getByLabel('策略命中趋势')).toContainText('32 次');
    await expect(page.getByLabel('组织策略详情标签')).toContainText('触发条件');
    await expect(page.getByLabel('策略权限申请')).toContainText('高危规则变更需通过审批流程');
    await expect(page.getByLabel('组织策略详情操作')).toContainText('编辑规则');
    await expect(page.getByLabel('组织策略详情操作')).toContainText('发起复核');
    await expect(page.locator('body')).not.toContainText('workbench-menu-policy-v1');

    await page.getByLabel('组织策略顶部操作').getByRole('button', { name: '新建规则' }).click();
    const createDialog = page.getByRole('dialog', { name: '新建规则' });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.locator('.workspace-action-route strong')).toContainText('/risk-assessments/new?source=workbench&scope=policy');
    await expect(createDialog.getByRole('status')).toContainText('当前账号缺少访问该业务页面的权限');
    await expect(createDialog.getByRole('button', { name: /暂无权限/ })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(createDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'RR-2024-00065', exact: true }).click();
    const detailDialog = page.getByRole('dialog', { name: '打开组织策略详情' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/risk-matrix?source=workbench&scope=policy&rule=RR-2024-00065');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);
    await expect(page.getByLabel('组织策略详情抽屉')).toContainText('工单超期未处理');
    await expect(page.getByLabel('当前组织策略规则信息')).toContainText('超期时长 > 2 小时');

    await page.getByLabel('组织策略详情操作').getByRole('button', { name: '停用规则' }).click();
    const dangerDialog = page.getByRole('dialog', { name: '停用策略规则' });
    await expect(dangerDialog).toBeVisible();
    await expect(dangerDialog.locator('.workspace-action-route strong')).toContainText('/risk-matrix?source=workbench&scope=policy&danger=disable');
    await page.keyboard.press('Escape');
    await expect(dangerDialog).toHaveCount(0);

    await page.getByLabel('策略权限申请').getByRole('button', { name: '申请权限' }).click();
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
    await expect(page.getByText('维护基础数据与系统配置，保障平台数据标准与稳定运行。')).toBeVisible();
    await expect(page.getByLabel('基础维护分类树')).toBeHidden();
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('资产分类');
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('位置管理');
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('供应商管理');
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('资产型号');
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('编号规则');
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('集成源管理');
    await expect(page.getByLabel('基础维护页面分栏')).toContainText('系统配置');
    await expect(page.getByLabel('基础维护核心指标')).toContainText('全部分类');
    await expect(page.getByLabel('基础维护核心指标')).toContainText('关联资产');
    await expect(page.getByLabel('基础维护顶部操作')).toContainText('新建分类');
    await expect(page.getByLabel('基础维护顶部操作')).toContainText('批量导入');
    await expect(page.getByLabel('基础维护顶部操作')).toContainText('批量删除');
    await expect(page.getByLabel('基础维护顶部操作').getByRole('button', { name: '批量删除' })).toBeDisabled();
    await expect(page.getByLabel('基础维护查询筛选栏')).toContainText('父级分类');
    await expect(page.getByLabel('基础维护配置对象列表')).toContainText('生产设备');
    await expect(page.getByLabel('基础维护配置对象列表')).toContainText('交通设备');
    await expect(page.getByLabel('基础维护配置对象列表').locator('.workspace-settings-table-row')).toHaveCount(8);
    await expect(page.getByLabel('配置健康总览')).toContainText('待处理变更');
    await expect(page.getByLabel('基础维护详情抽屉')).toContainText('生产设备分类配置');
    await expect(page.getByLabel('基础维护详情抽屉')).toContainText('关联资产');
    await expect(page.getByLabel('基础维护详情抽屉')).toContainText('资产型号 Top 5');
    await expect(page.getByLabel('基础维护详情标签')).toContainText('变更记录');
    await expect(page.getByLabel('基础维护危险变更确认')).toContainText('停用分类将影响关联资产');
    await expect(page.getByLabel('基础维护详情操作')).toContainText('停用');
    await expect(page.getByLabel('基础维护详情操作')).toContainText('删除');
    await expect(page.locator('body')).not.toContainText('workbench-menu-settings-v1');

    await page.getByLabel('基础维护顶部操作').getByRole('button', { name: '新建分类' }).click();
    const categoryDialog = page.getByRole('dialog', { name: '新建基础分类' });
    await expect(categoryDialog).toBeVisible();
    await expect(categoryDialog.locator('.workspace-action-route strong')).toContainText('/settings/sysconfig/new?source=workbench');
    await page.keyboard.press('Escape');
    await expect(categoryDialog).toHaveCount(0);

    await page.getByLabel('基础维护页面分栏').getByRole('button', { name: /供应商/ }).click();
    await expect(page.getByLabel('基础维护配置对象列表')).toContainText('VDR-018');
    await expect(page.getByLabel('基础维护详情抽屉')).toContainText('UNIVIEW 备件仓资质');
    await page.getByLabel('基础维护详情操作').getByRole('button', { name: '复制' }).click();
    const detailDialog = page.getByRole('dialog', { name: '复制基础维护配置' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('.workspace-action-route strong')).toContainText('/settings/sysconfig/copy?source=workbench');
    await page.keyboard.press('Escape');
    await expect(detailDialog).toHaveCount(0);

    await page.getByLabel('基础维护详情操作').getByRole('button', { name: '停用' }).click();
    const dangerDialog = page.getByRole('dialog', { name: '危险变更确认' });
    await expect(dangerDialog).toBeVisible();
    await expect(dangerDialog.locator('.workspace-action-route strong')).toContainText('/settings/sysconfig/danger?source=workbench');
    await page.keyboard.press('Escape');
    await expect(dangerDialog).toHaveCount(0);

    await page.getByLabel('基础维护危险变更确认').getByRole('button', { name: '确认停用' }).click();
    const confirmDialog = page.getByRole('dialog', { name: '危险变更确认' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.locator('.workspace-action-route strong')).toContainText('/settings/sysconfig/danger?source=workbench');
    await page.keyboard.press('Escape');
    await expect(confirmDialog).toHaveCount(0);

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
    await expect(page.locator('.workspace-stitch-stats')).toContainText('7');
    await expect(page.locator('.workspace-stitch-stats')).toContainText('系统配置');

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

    const systemDesignCards = [
      ['系统运营中枢总览', '/fixed-assets/workbench?menu=system-flow-definition', 'system-hub-overview-v3.png'],
      ['流程平台系统稿', '/fixed-assets/workbench?menu=system-flow-definition', 'flow-platform-v2.png'],
      ['组织权限系统稿', '/fixed-assets/workbench?menu=system-user-management', 'org-permission-v2.png'],
      ['基础资料系统稿', '/fixed-assets/workbench?menu=system-asset-category', 'master-data-v2.png'],
      ['集成配置系统稿', '/fixed-assets/workbench?menu=system-external-systems', 'integration-config-v2.png'],
      ['消息通知系统稿', '/fixed-assets/workbench?menu=system-mail-gateway', 'notification-config-v2.png'],
      ['系统参数系统稿', '/fixed-assets/workbench?menu=system-base-params', 'system-params-v2.png'],
    ];

    for (const [title, route, imageName] of systemDesignCards) {
      const card = page.locator('.workspace-stitch-card').filter({ hasText: title });
      await expect(card).toBeVisible();
      await expect(card.getByText(route, { exact: true })).toBeVisible();
      await expect(card.getByRole('link', { name: '进入系统配置' })).toHaveAttribute('href', route);
      await expect(card.locator('img')).toHaveAttribute('src', new RegExp(`/asset-kit-v8/system-hub/${imageName}`));
    }

    const overviewCard = page.locator('.workspace-stitch-card').filter({ hasText: '资产运营总览' }).first();
    await expect(overviewCard.getByText('/fixed-assets/workbench', { exact: true })).toBeVisible();
    await expect(overviewCard).not.toContainText('/fixed-assets/workbench?menu=home');

    expect(errors).toEqual([]);
  });

  test('Workbench 抽屉对缺少业务权限的目标给出禁用反馈', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, workbenchOnlyUser);

    await page.goto('/fixed-assets/workbench/analytics?menu=report');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '导出', exact: true }).click();
    const reportDialog = page.getByRole('dialog', { name: '导出资产趋势' });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.getByText('/reports?source=workbench&view=asset-trend&export=csv').first()).toBeVisible();
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
  const ignoredResourceNoise = [
    'downloadable font: download failed',
    'Image corrupt or truncated.',
    'Failed to load resource',
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
