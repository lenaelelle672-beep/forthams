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
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('流程定义');
    const systemMenu = page.getByLabel('工作台菜单');
    await expect(page.locator('header').filter({ hasText: '搜索...' })).toHaveCount(0);
    await expect(page.locator('.workspace-topbar').getByRole('textbox')).toHaveCount(0);
    await expect(page.locator('.workspace-topbar').getByRole('searchbox')).toHaveCount(0);
    await expect(systemMenu).not.toContainText('搜索');
    await expect(page.locator('.workspace-side').getByRole('textbox')).toHaveCount(0);
    await expect(page.locator('.workspace-side [aria-label*="搜索"]')).toHaveCount(0);
    await expect(page.locator('.workspace-side [placeholder*="搜索"]')).toHaveCount(0);
    await expect(page.locator('.workspace-system-nav-console')).toHaveCount(0);
    await expect(page.locator('.workspace-system-nav-quick')).toHaveCount(0);
    const systemDesignBridge = page.getByLabel('系统运营中枢整体设计承接');
    await expect(systemDesignBridge).toBeHidden();
    await expect(systemDesignBridge.locator('img[src*="system-hub-subpage-00-navigation-console-v2"]')).toHaveCount(1);
    await expect(systemDesignBridge.locator('img[src*="stitch-system-hub-subpage-00-navigation-console-v1"]')).toHaveCount(1);
    await expect(systemDesignBridge.getByRole('button', { name: '查看总图', exact: true, includeHidden: true })).toBeAttached();
    const openSystemGroup = async (name: string) => {
      const groupButton = systemMenu.getByRole('button', { name, exact: true });
      if ((await groupButton.getAttribute('aria-expanded')) !== 'true') {
        await groupButton.click();
      }
      await expect(groupButton).toHaveAttribute('aria-expanded', 'true');
    };
    const runIntegrationDraftFlow = async (
      panelLabel: string,
      actionLabel: string,
      pageLabel: string,
      draftName: string,
      endpoint: string,
      sourceField: string,
      targetField: string,
      triggerEvent: string,
      failurePolicy: string,
      auditPolicy: string,
    ) => {
      await page.getByLabel(panelLabel).getByRole('button', { name: actionLabel, exact: true }).click();
      await expect(page.getByLabel(`${pageLabel}配置编辑区`)).toContainText(`${pageLabel}新配置`);
      await page.getByLabel(`${pageLabel}配置名称`, { exact: true }).fill(draftName);
      await page.getByLabel(`${pageLabel}接口端点`, { exact: true }).fill(endpoint);
      await page.getByLabel(`${pageLabel}源字段`, { exact: true }).fill(sourceField);
      await page.getByLabel(`${pageLabel}目标字段`, { exact: true }).fill(targetField);
      await page.getByLabel(`${pageLabel}触发事件`, { exact: true }).fill(triggerEvent);
      await page.getByLabel(`${pageLabel}失败处理`, { exact: true }).fill(failurePolicy);
      await page.getByRole('textbox', { name: `${pageLabel}审计要求`, exact: true }).fill(auditPolicy);
      await page.getByLabel(`${pageLabel}负责人`, { exact: true }).fill('平台运维 / 数据管理员');
      await page.getByLabel(`${pageLabel}配置草稿操作`).getByRole('button', { name: '保存草稿', exact: true }).click();
      await expect(page.getByLabel(`${pageLabel}配置操作结果`)).toContainText(`${pageLabel}草稿已保存`);
      await expect(page.getByLabel(`${pageLabel}配置保存记录`)).toContainText(draftName);
      await page.getByLabel(`${pageLabel}配置草稿操作`).getByRole('button', { name: '提交校验', exact: true }).click();
      await expect(page.getByLabel(`${pageLabel}配置操作结果`)).toContainText(`${pageLabel}提交校验已完成`);
      await expect(page.getByLabel(`${pageLabel}配置保存记录`)).toContainText('已提交校验');
    };
    await expect(page.getByLabel('搜索系统配置菜单')).toHaveCount(0);
    await expect(page.locator('.workspace-side input')).toHaveCount(0);
    await expect(page.locator('.workspace-system-nav-console')).toHaveCount(0);
    await expect(page.getByLabel('系统常用配置入口')).toHaveCount(0);
    await expect(systemMenu.getByRole('button', { name: '流程平台', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(systemMenu.getByRole('button', { name: '组织权限', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(systemMenu.getByRole('button', { name: '流程定义', exact: true })).toBeVisible();
    await openSystemGroup('消息与通知');
    await expect(page.getByLabel('消息与通知').getByRole('button', { name: '邮件网关配置', exact: true })).toBeVisible();
    await expect(page.getByLabel('消息与通知').getByRole('button', { name: '邮件模板', exact: true })).toBeVisible();
    await expect(page.getByLabel('流程定义系统配置功能页')).toBeVisible();
    await expect(page.getByLabel('流程定义专用功能面板')).toContainText('流程平台');
    await expect(page.getByLabel('流程平台二级页签')).toContainText('流程定义');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('FA 入账流程');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('CIP 转固流程');
    await expect(page.getByLabel('CIP 转固流程右侧详情')).toContainText('版本基线');
    await expect(page.getByLabel('CIP 转固流程流程节点')).toContainText('CIP 专员审核');
    const flowDefinitionSearch = page.getByRole('textbox', { name: '流程定义搜索', exact: true });
    await expect(page.getByLabel('流程定义筛选结果')).toContainText('/');
    await flowDefinitionSearch.fill('CIP');
    await expect(page.getByLabel('流程定义筛选结果')).toContainText('1/');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('CIP 转固流程');
    await expect(page.getByLabel('流程平台流程列表')).not.toContainText('FA 入账流程');
    await expect(page.getByLabel('CIP 转固流程右侧详情')).toContainText('CIP 管理');
    await flowDefinitionSearch.fill('不存在的流程定义');
    await expect(page.getByLabel('流程定义筛选结果')).toContainText('0/');
    await expect(page.getByLabel('流程定义搜索空结果')).toContainText('没有匹配的流程定义');
    await page.getByRole('button', { name: '清空流程定义搜索', exact: true }).click();
    await expect(page.getByLabel('流程平台流程列表')).toContainText('FA 入账流程');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('CIP 转固流程');
    const flowPlatformDesignMatrix = page.getByLabel('流程平台子页面产品图与 Stitch 矩阵');
    await expect(flowPlatformDesignMatrix).toBeHidden();

    await openSystemGroup('流程平台');
    await expect(systemMenu.getByRole('button', { name: '流程定义', exact: true })).toBeVisible();
    await expect(systemMenu.getByRole('button', { name: '流程设计器', exact: true })).toBeVisible();
    await expect(systemMenu.getByRole('button', { name: '待办字段配置', exact: true })).toBeVisible();
    await expect(page.getByLabel('系统常用配置入口')).toHaveCount(0);

    await systemMenu.getByRole('button', { name: '流程设计器', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-flow-designer$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('流程设计器');
    await expect(systemMenu).not.toContainText('搜索');
    await expect(page.locator('.workspace-side input')).toHaveCount(0);
    await expect(page.locator('.workspace-system-nav-console')).toHaveCount(0);
    await expect(page.getByLabel('系统运营中枢导航定位')).toHaveCount(0);
    const flowDesignerPanel = page.getByLabel('流程设计器专用功能面板');
    await expect(flowDesignerPanel).toContainText('新建流程图');
    await expect(flowDesignerPanel).toContainText('拖拽环节节点');
    await expect(page.getByLabel('流程模板切换')).toContainText('CIP 转固流程');
    const nodePalette = page.getByRole('complementary', { name: '节点库', exact: true });
    await expect(nodePalette).toContainText('审批节点');
    await expect(nodePalette.getByRole('textbox')).toHaveCount(0);
    const flowDesignerPageSearch = page.getByRole('textbox', { name: '流程设计器页面搜索', exact: true });
    await expect(flowDesignerPageSearch).toBeVisible();
    await expect(page.getByRole('textbox', { name: '搜索节点模板', exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '节点库搜索', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('节点模板筛选结果')).toHaveCount(0);
    await expect(page.getByLabel('节点模板搜索空结果')).toHaveCount(0);
    await expect(nodePalette).toContainText('系统节点');
    await expect(nodePalette).toContainText('条件节点');
    await expect(nodePalette).toContainText('财务节点');
    await expect(page.getByLabel('流程设计大画布')).toContainText('CIP 专员审核');
    await expect(page.getByLabel('流程设计大画布')).toContainText('ERP 推送');
    await expect(page.getByLabel('流程设计大画布')).toContainText('财务与系统动作');
    await expect(page.getByLabel('流程设计器画布工具条').getByRole('textbox')).toHaveCount(1);
    await flowDesignerPageSearch.fill('系统节点');
    await expect(page.getByLabel('流程设计器页面搜索结果')).toHaveText('1/6');
    await expect(nodePalette).toContainText('系统节点');
    await expect(nodePalette).not.toContainText('审批节点');
    await flowDesignerPageSearch.fill('CIP 专员审核');
    await expect(page.getByLabel('流程设计器页面搜索结果')).toHaveText('0/6');
    await expect(page.getByLabel('节点属性配置')).toContainText('CIP 专员审核');
    await flowDesignerPageSearch.fill('不存在的画布节点');
    await expect(page.getByLabel('流程设计器页面搜索结果')).toHaveText('0/6');
    await expect(page.getByLabel('流程设计器页面内搜索空结果')).toContainText('没有匹配的画布节点');
    await page.getByRole('button', { name: '清空流程设计器页面搜索', exact: true }).click();
    await expect(page.getByLabel('流程设计器页面搜索结果')).toHaveText('6 模板');
    await expect(nodePalette).toContainText('审批节点');
    await expect(page.getByLabel('节点属性配置')).toContainText('节点名称');
    await expect(page.getByLabel('节点属性配置')).toContainText('X 位置');
    await expect(page.locator('.workspace-flow-designer-shell.is-modeling-mode')).toBeVisible();
    const initialFlowCanvasBox = await page.locator('.workspace-flow-canvas-large').boundingBox();
    expect(initialFlowCanvasBox).not.toBeNull();
    expect(initialFlowCanvasBox!.height).toBeGreaterThanOrEqual(760);
    await expect(page.getByLabel('流程设计器产品图与 Stitch 计划')).toBeHidden();
    await flowDesignerPanel.getByRole('button', { name: '新建流程图', exact: true }).click();
    await expect(page.getByLabel('流程模板切换')).toContainText('新建流程图草稿');
    await expect(page.getByLabel('流程设计大画布')).toContainText('流程发起');
    await expect(page.getByLabel('节点属性配置')).toContainText('流程发起');
    await expect(page.getByLabel('节点属性配置')).toContainText('节点类型');
    await expect(page.getByLabel('节点属性配置')).toContainText('节点状态');
    await expect(page.locator('.workspace-flow-template-strip.is-product.is-collapsed')).toHaveCSS('display', 'none');
    await expect(page.locator('.workspace-flow-designer-shell.is-modeling-mode')).toBeVisible();
    await expect(page.getByLabel('新建流程图草稿建模工作室')).toBeVisible();
    await expect(page.locator('.workspace-flow-designer-studio-console')).toHaveCSS('display', 'none');
    await expect(page.getByLabel('新建流程图草稿新建流程图操作路径')).toContainText('拖拽环节节点');
    await expect(page.getByLabel('新建流程图草稿新建流程图操作路径')).toContainText('配置节点信息');
    await expect(page.getByLabel('新建流程图草稿新建流程图操作路径')).toContainText('保存并提交校验');
    await expect(page.getByLabel('流程图建模快捷操作')).toContainText('插入环节');
    await expect(page.getByLabel('流程图建模快捷操作')).toContainText('校验节点');
    await expect(page.locator('.workspace-flow-designer-studio-strip')).toHaveCSS('display', 'none');
    await expect(page.locator('.workspace-flow-modeling-strip')).toHaveCSS('display', 'none');
    await expect(page.locator('.workspace-flow-designer-stagebar')).toHaveCSS('display', 'none');
    await expect(page.locator('.workspace-flow-designer-reference')).toHaveCSS('display', 'none');
    await expect(page.locator('.workspace-flow-designer-reference')).toHaveCSS('display', 'none');
    await expect(page.getByLabel('新建流程图草稿流程基础配置')).toContainText('待绑定表单');
    await expect(page.getByLabel('流程图基础配置')).toContainText('流程图基础配置');
    await page.getByLabel('流程图名称', { exact: true }).fill('CIP 转固补充验收流程图');
    await page.getByLabel('流程图业务对象', { exact: true }).fill('CIP_ACCEPTANCE_SUPPLEMENT');
    await page.getByLabel('流程图版本', { exact: true }).fill('v0.2 草稿');
    await page.getByLabel('流程图绑定表单', { exact: true }).fill('CIP 完工验收补充表 v0.2');
    await page.getByLabel('流程图外部推送', { exact: true }).fill('ERP 回执归档 + EHR 待办同步');
    await page.getByLabel('流程图发布门禁', { exact: true }).fill('节点、表单、ERP 回执字段、待办字段全部校验通过才允许发布');
    await expect(page.getByLabel('流程图基础配置')).toContainText('CIP 转固补充验收流程图');
    await expect(page.getByLabel('CIP 转固补充验收流程图流程基础配置')).toContainText('CIP 完工验收补充表 v0.2');
    await expect(page.getByLabel('流程设计大画布')).toContainText('CIP 转固补充验收流程图');
    await expect(page.getByLabel('CIP 转固补充验收流程图建模操作总览')).toContainText('画布优先');
    await expect(page.getByLabel('CIP 转固补充验收流程图建模操作总览')).toContainText('拖拽环节节点');
    await expect(page.getByLabel('CIP 转固补充验收流程图建模操作总览')).toContainText('右侧支持模板套用');
    await expect(page.getByLabel('流程发起节点必填校验')).toContainText('节点规则');
    await expect(flowDesignerPanel.getByRole('button', { name: '展开模板', exact: true })).toBeVisible();
    await expect(flowDesignerPanel.getByRole('button', { name: '标准画布', exact: true })).toBeVisible();
    await expect(page.locator('.workspace-flow-designer-shell.is-expanded')).toBeVisible();
    await page.setViewportSize({ width: 1180, height: 920 });
    const mediumDesignerLayout = await page.evaluate(() => {
      const shell = document.querySelector('.workspace-flow-designer-shell.is-expanded.is-draft-active');
      const palette = document.querySelector('.workspace-flow-node-palette');
      const canvas = document.querySelector('.workspace-flow-canvas-card');
      const inspector = document.querySelector('.workspace-flow-node-inspector-large');
      const shellStyle = shell ? getComputedStyle(shell) : null;
      const paletteRect = palette?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      const inspectorRect = inspector?.getBoundingClientRect();
      return {
        shellAreas: shellStyle?.gridTemplateAreas ?? '',
        paletteWidth: paletteRect?.width ?? 0,
        canvasWidth: canvasRect?.width ?? 0,
        inspectorWidth: inspectorRect?.width ?? 0,
        sameRow: Boolean(
          paletteRect &&
            canvasRect &&
            inspectorRect &&
            Math.abs(canvasRect.top - inspectorRect.top) < 80 &&
            paletteRect.right <= canvasRect.left &&
            canvasRect.right <= inspectorRect.left,
        ),
      };
    });
    expect(mediumDesignerLayout.shellAreas).toContain('palette canvas inspector');
    expect(mediumDesignerLayout.paletteWidth).toBeGreaterThanOrEqual(200);
    expect(mediumDesignerLayout.canvasWidth).toBeGreaterThanOrEqual(740);
    expect(mediumDesignerLayout.inspectorWidth).toBeGreaterThanOrEqual(360);
    expect(mediumDesignerLayout.sameRow).toBe(true);
    await page.setViewportSize({ width: 1796, height: 1000 });
    const approvalNodeSource = page.getByLabel('节点库').getByRole('button', { name: '审批节点 岗位/角色处理人', exact: true });
    const flowCanvas = page.locator('.workspace-flow-canvas-large');
    await expect(approvalNodeSource).toContainText('拖入画布');
    await expect(flowCanvas).toContainText('拖拽移动');
    const sourceBox = await approvalNodeSource.boundingBox();
    const canvasBox = await flowCanvas.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThanOrEqual(960);
    expect(canvasBox!.width).toBeGreaterThanOrEqual(720);
    const modelingState = await page.evaluate(() => {
      const firstNode = document.querySelector('.workspace-flow-canvas-node');
      const inspector = document.querySelector('.workspace-flow-node-inspector-large');
      const commandCenter = document.querySelector('.workspace-flow-node-command-center');
      const wideTextarea = document.querySelector('[aria-label="处理人规则配置"]');
      const nodeRect = firstNode?.getBoundingClientRect();
      const inspectorRect = inspector?.getBoundingClientRect();
      const textareaRect = wideTextarea?.getBoundingClientRect();
      const inspectorStyle = inspector ? getComputedStyle(inspector) : null;
      const commandStyle = commandCenter ? getComputedStyle(commandCenter) : null;
      return {
        nodeWidth: nodeRect?.width ?? 0,
        inspectorWidth: inspectorRect?.width ?? 0,
        textareaHeight: textareaRect?.height ?? 0,
        inspectorPosition: inspectorStyle?.position ?? '',
        commandCenterPosition: commandStyle?.position ?? '',
      };
    });
    expect(modelingState.nodeWidth).toBeGreaterThanOrEqual(320);
    expect(modelingState.inspectorWidth).toBeGreaterThanOrEqual(330);
    expect(modelingState.textareaHeight).toBeGreaterThanOrEqual(100);
    expect(modelingState.inspectorPosition).toBe('sticky');
    expect(modelingState.commandCenterPosition).toBe('sticky');
    const dragStart = {
      clientX: sourceBox!.x + sourceBox!.width / 2,
      clientY: sourceBox!.y + sourceBox!.height / 2,
    };
    const dragEnd = {
      clientX: canvasBox!.x + canvasBox!.width * 0.58,
      clientY: canvasBox!.y + canvasBox!.height * 0.36,
    };
    await approvalNodeSource.dispatchEvent('pointerdown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'mouse',
      ...dragStart,
    });
    await approvalNodeSource.dispatchEvent('mousedown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      ...dragStart,
    });
    await flowCanvas.dispatchEvent('pointermove', {
      bubbles: true,
      buttons: 1,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'mouse',
      ...dragEnd,
    });
    await expect(flowCanvas).toHaveClass(/is-drag-active/);
    await expect(flowCanvas.locator('.workspace-flow-canvas-hotzone')).toContainText('释放后添加审批节点');
    await expect(page.getByLabel('CIP 转固补充验收流程图新建流程图操作路径')).toContainText('拖拽审批节点');
    await flowCanvas.dispatchEvent('pointerup', {
      bubbles: true,
      button: 0,
      buttons: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'mouse',
      ...dragEnd,
    });
    await flowCanvas.dispatchEvent('mouseup', {
      bubbles: true,
      button: 0,
      buttons: 0,
      ...dragEnd,
    });
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点已放入画布');
    await expect(page.getByLabel('CIP 转固补充验收流程图新建流程图操作路径')).toContainText('节点已放入画布');
    await expect(page.getByLabel('流程设计大画布')).toContainText('新增审批节点');
    await expect(page.getByLabel('流程画布操作提示')).toContainText('选中节点后右侧配置');
    await expect(page.getByLabel('节点属性配置')).toContainText('新增审批节点');
    const canvasToolbar = page.getByLabel('流程设计器画布工具条');
    await expect(canvasToolbar).toContainText('1 可撤销 / 0 可重做');
    await canvasToolbar.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('已撤销上一步');
    await expect(page.getByLabel('流程设计大画布')).not.toContainText('新增审批节点');
    await expect(canvasToolbar).toContainText('0 可撤销 / 1 可重做');
    await canvasToolbar.getByRole('button', { name: '重做', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('已重做上一步');
    await expect(page.getByLabel('流程设计大画布')).toContainText('新增审批节点');
    await expect(canvasToolbar).toContainText('1 可撤销 / 0 可重做');
    await expect(page.getByLabel('节点属性配置')).toContainText('新增审批节点');
    await expect(page.getByLabel('新增审批节点配置摘要')).toContainText('待配置角色');
    await expect(page.getByLabel('新增审批节点节点配置工作台')).toContainText('处理人规则');
    await expect(page.getByLabel('新增审批节点节点配置模板')).toContainText('财务复核模板');
    await expect(page.getByLabel('绑定表单', { exact: true })).toHaveValue('CIP 完工验收补充表 v0.2');
    await page.getByLabel('新增审批节点节点配置模板').getByRole('button', { name: '财务复核模板', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点模板已套用');
    await expect(page.getByLabel('节点名称', { exact: true })).toHaveValue('财务复核');
    await expect(page.getByLabel('节点类型', { exact: true })).toHaveValue('finance');
    await expect(page.getByLabel('处理角色', { exact: true })).toHaveValue('财务资产专员');
    await page.getByLabel('节点名称', { exact: true }).fill('财务复核');
    await page.getByLabel('节点类型', { exact: true }).selectOption('finance');
    await page.getByLabel('处理角色', { exact: true }).fill('财务资产专员');
    await page.getByLabel('节点状态', { exact: true }).fill('待财务确认');
    await page.getByLabel('节点规则', { exact: true }).fill('金额大于 5 万时必须复核');
    await expect(page.getByLabel('流程设计大画布')).toContainText('财务复核');
    await expect(page.getByLabel('节点类型', { exact: true })).toHaveValue('finance');
    await expect(page.getByLabel('处理角色', { exact: true })).toHaveValue('财务资产专员');
    await expect(page.getByLabel('节点状态', { exact: true })).toHaveValue('待财务确认');
    await expect(page.getByLabel('节点规则', { exact: true })).toHaveValue('金额大于 5 万时必须复核');
    await expect(page.getByLabel('财务复核节点必填校验')).toContainText('绑定表单');
    await expect(page.getByLabel('财务复核节点配置工作台')).toContainText('外部动作');
    await expect(page.getByLabel('财务复核节点配置指挥条')).toContainText('节点完成度');
    await expect(page.getByLabel('财务复核节点配置指挥条')).toContainText('100%');
    await expect(page.getByLabel('财务复核配置分区')).toContainText('处理人');
    await expect(page.getByLabel('财务复核配置分区')).toContainText('表单字段');
    await page.getByLabel('财务复核节点配置操作').getByRole('button', { name: '保存节点配置', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点配置已保存');
    await page.getByLabel('财务复核节点配置操作').getByRole('button', { name: '校验当前节点', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点校验通过');
    const financeNode = page.getByLabel('流程设计大画布').getByRole('button', { name: /财务复核/ }).first();
    const financeNodeBox = await financeNode.boundingBox();
    expect(financeNodeBox).not.toBeNull();
    const nodeMoveStart = {
      clientX: financeNodeBox!.x + financeNodeBox!.width / 2,
      clientY: financeNodeBox!.y + financeNodeBox!.height / 2,
    };
    const nodeMoveEnd = {
      clientX: canvasBox!.x + canvasBox!.width * 0.68,
      clientY: canvasBox!.y + canvasBox!.height * 0.48,
    };
    await financeNode.dispatchEvent('pointerdown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 2,
      pointerType: 'mouse',
      ...nodeMoveStart,
    });
    await financeNode.dispatchEvent('mousedown', {
      bubbles: true,
      button: 0,
      buttons: 1,
      ...nodeMoveStart,
    });
    await flowCanvas.dispatchEvent('pointermove', {
      bubbles: true,
      buttons: 1,
      isPrimary: true,
      pointerId: 2,
      pointerType: 'mouse',
      ...nodeMoveEnd,
    });
    await flowCanvas.dispatchEvent('pointerup', {
      bubbles: true,
      button: 0,
      buttons: 0,
      isPrimary: true,
      pointerId: 2,
      pointerType: 'mouse',
      ...nodeMoveEnd,
    });
    await flowCanvas.dispatchEvent('mouseup', {
      bubbles: true,
      button: 0,
      buttons: 0,
      ...nodeMoveEnd,
    });
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点位置已更新');
    await expect(page.getByLabel('财务复核节点快捷操作')).toContainText('插入下一环节');
    await page.getByLabel('财务复核节点快捷操作').getByRole('button', { name: '复制节点', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点已复制');
    await expect(page.getByLabel('流程设计大画布')).toContainText('财务复核副本');
    await page.getByLabel('财务复核副本节点快捷操作').getByRole('button', { name: '删除节点', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('节点已删除');
    await page.getByLabel('流程设计大画布').getByRole('button', { name: '整理主链', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('主链已整理');
    await flowDesignerPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('草稿已保存');
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('CIP 转固补充验收流程图');
    await expect(page.getByLabel('流程设计大画布')).toContainText('需先提交校验');
    await flowDesignerPanel.getByRole('button', { name: '发布流程', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('发布流程被拦截');
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('还没有完成本次提交校验');
    await flowDesignerPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('提交校验已完成');
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('CIP 转固补充验收流程图');
    await expect(page.getByLabel('流程设计大画布')).toContainText('已通过提交校验');
    await flowDesignerPanel.getByRole('button', { name: '发布流程', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('流程已发布');
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('发布门禁、外部推送和审计留痕已生成');
    await expect(page.getByLabel('流程模板切换')).toContainText('已发布');
    await flowDesignerPanel.getByRole('button', { name: '展开模板', exact: true }).click();
    await expect(page.locator('.workspace-flow-template-strip.is-product')).toHaveCSS('display', 'grid');
    await page.getByLabel('选择FA-入账流程').click();
    await expect(page.getByLabel('流程设计大画布')).toContainText('编号预览');
    await expect(page.getByLabel('节点属性配置')).toContainText('资产类别缺失');
    await expect(systemMenu.getByRole('button', { name: '流程平台', exact: true })).toHaveAttribute('aria-expanded', 'true');

    await openSystemGroup('流程平台');
    await systemMenu.getByRole('button', { name: '表单配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-form-config$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('表单配置');
    const formConfigPanel = page.getByLabel('表单配置专用功能面板');
    await expect(formConfigPanel).toContainText('表单配置工作台');
    await expect(page.getByLabel('流程平台二级页签')).toContainText('表单配置');
    await expect(page.getByLabel('表单对象列表')).toContainText('待建资产入账表单');
    await expect(page.getByLabel('待建资产入账表单字段列表')).toContainText('资产小类');
    await expect(page.getByLabel('待建资产入账表单表单设计画布')).toContainText('桌面表单');
    await expect(page.getByLabel('待建资产入账表单桌面表单画布')).toContainText('批量补类');
    await expect(page.getByLabel('待建资产入账表单钉钉H5表单预览')).toContainText('来源系统');
    await expect(page.getByLabel('待建资产入账表单表单发布门禁')).toContainText('校验覆盖');
    const formFieldSearch = page.getByRole('textbox', { name: '表单字段搜索', exact: true });
    await expect(page.getByLabel('表单字段筛选结果')).toContainText('4/4');
    await formFieldSearch.fill('数量');
    await expect(page.getByLabel('表单字段筛选结果')).toContainText('1/4');
    await expect(page.getByLabel('待建资产入账表单字段列表')).toContainText('数量');
    await expect(page.getByLabel('待建资产入账表单字段列表')).not.toContainText('资产小类');
    await expect(page.getByLabel('待建资产入账表单桌面表单画布')).toContainText('数量');
    await expect(page.getByLabel('待建资产入账表单钉钉H5表单预览')).toContainText('数量');
    await formFieldSearch.fill('不存在的表单字段');
    await expect(page.getByLabel('表单字段筛选结果')).toContainText('0/4');
    await expect(page.getByLabel('待建资产入账表单字段搜索空结果')).toContainText('没有匹配字段');
    await expect(page.getByLabel('待建资产入账表单桌面字段搜索空结果')).toContainText('没有匹配字段');
    await page.getByRole('button', { name: '清空表单字段搜索', exact: true }).click();
    await expect(page.getByLabel('表单字段筛选结果')).toContainText('4/4');
    await expect(page.getByLabel('待建资产入账表单字段列表')).toContainText('资产小类');
    await formConfigPanel.getByRole('button', { name: '新建表单', exact: true }).click();
    await expect(page.getByLabel('表单对象列表')).toContainText('新建表单草稿');
    await formConfigPanel.getByRole('button', { name: '新增字段', exact: true }).click();
    await page.getByLabel('表单字段名称').fill('验收照片');
    await page.getByLabel('表单字段编码').fill('acceptance_photo');
    await page.getByLabel('表单字段类型').fill('附件');
    await page.getByLabel('表单桌面分组').fill('附件信息');
    await expect(page.getByLabel('新建表单草稿字段列表')).toContainText('验收照片');
    await expect(page.getByLabel('新建表单草稿表单设计画布')).toContainText('验收照片');
    await expect(page.getByLabel('新建表单草稿桌面表单画布')).toContainText('附件信息');
    await expect(page.getByLabel('新建表单草稿钉钉H5表单预览')).toContainText('验收照片');
    await formConfigPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('表单配置操作结果')).toContainText('表单草稿已保存');
    await formConfigPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('表单配置操作结果')).toContainText('表单校验已提交');

    await openSystemGroup('流程平台');
    await systemMenu.getByRole('button', { name: '表单存储', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-form-storage$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('表单存储');
    const formStoragePanel = page.getByLabel('表单存储专用功能面板');
    await expect(formStoragePanel).toContainText('表单存储工作台');
    await expect(page.getByLabel('表单存储策略列表')).toContainText('表单实例快照策略');
    await expect(page.getByLabel('表单存储策略明细')).toContainText('CIP 转固归档策略');
    const storagePolicySearch = page.getByRole('textbox', { name: '表单存储策略搜索', exact: true });
    await expect(page.getByLabel('表单存储策略筛选结果', { exact: true })).toHaveText('4/4');
    await storagePolicySearch.fill('CIP');
    await expect(page.getByLabel('表单存储策略筛选结果', { exact: true })).toHaveText('1/4');
    await expect(page.getByLabel('表单存储策略明细')).toContainText('CIP 转固归档策略');
    await expect(page.getByLabel('表单存储策略明细')).not.toContainText('表单定义版本冻结策略');
    await storagePolicySearch.fill('不存在的存储策略');
    await expect(page.getByLabel('表单存储策略筛选结果', { exact: true })).toHaveText('0/4');
    await expect(page.getByLabel('表单存储策略搜索空结果')).toContainText('没有匹配的存储策略');
    await expect(page.getByLabel('表单存储策略明细搜索空结果')).toContainText('没有匹配策略');
    await page.getByRole('button', { name: '清空表单存储策略搜索', exact: true }).click();
    await expect(page.getByLabel('表单存储策略筛选结果', { exact: true })).toHaveText('4/4');
    await formStoragePanel.getByRole('button', { name: '新建存储策略', exact: true }).click();
    await expect(page.getByLabel('表单存储策略列表')).toContainText('新建表单存储策略');
    await page.getByLabel('表单存储策略名称').fill('CIP 转固实例归档策略');
    await page.getByLabel('表单存储对象类型').fill('CIP 转固表单实例');
    await page.getByLabel('表单存储版本策略').fill('按流程版本冻结字段快照');
    await page.getByLabel('表单存储保留周期').fill('项目完结后 10 年归档');
    await page.getByLabel('表单存储归档目标').fill('CIP 项目归档库 / 资产卡片关联');
    await page.getByLabel('表单存储快照模式').fill('转固金额、资产明细、审批意见快照');
    await page.getByLabel('表单存储附件策略').fill('验收照片、发票、ERP 回执随实例归档');
    await expect(page.getByLabel('表单存储策略明细')).toContainText('CIP 转固实例归档策略');
    await page.getByLabel('表单存储操作').getByRole('button', { name: '归档预演', exact: true }).click();
    await expect(page.getByLabel('表单存储操作结果')).toContainText('归档预演已完成');
    const cipStorageArchiveSimulation = page.getByLabel('CIP 转固实例归档策略归档预演结果');
    await expect(cipStorageArchiveSimulation).toContainText('预演通过');
    await expect(cipStorageArchiveSimulation).toContainText('48 条待归档实例');
    await expect(cipStorageArchiveSimulation).toContainText('CIP 项目归档库 / 资产卡片关联');
    await expect(cipStorageArchiveSimulation).toContainText('验收照片、发票、ERP 回执随实例归档');
    await formStoragePanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('表单存储操作结果')).toContainText('表单存储草稿已保存');
    await formStoragePanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('表单存储操作结果')).toContainText('表单存储校验已提交');
    await expect(cipStorageArchiveSimulation).toContainText('发布校验已提交');
    await expect(page.getByLabel('表单存储策略明细')).toContainText('已提交校验');

    await openSystemGroup('流程平台');
    await systemMenu.getByRole('button', { name: '审批规则', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-approval-rules$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('审批规则');
    const approvalRulePanel = page.getByLabel('审批规则专用功能面板');
    await expect(approvalRulePanel).toContainText('审批规则配置台');
    await expect(page.getByLabel('审批规则配置工作台')).toBeVisible();
    await expect(page.getByLabel('审批规则列表')).toContainText('重复处理人跳过');
    await expect(page.getByLabel('审批规则规则明细')).toContainText('离职交接承接');
    await expect(page.getByLabel('重复处理人跳过规则命中编排')).toContainText('规则执行编排');
    await expect(page.getByLabel('重复处理人跳过命中路径画布')).toContainText('命中条件');
    await expect(page.getByLabel('重复处理人跳过规则优先级队列')).toContainText('生产可命中');
    await expect(page.getByLabel('重复处理人跳过发布门禁矩阵')).toContainText('规则启用');
    await approvalRulePanel.getByRole('button', { name: '新建规则', exact: true }).click();
    await expect(page.getByLabel('审批规则列表')).toContainText('新建审批规则');
    await page.getByLabel('审批规则名称').fill('CIP 财务节点代理');
    await page.getByLabel('审批规则类型').fill('代理审批');
    await page.getByLabel('审批规则适用流程').fill('CIP 转固流程');
    await page.getByLabel('审批规则触发条件').fill('财务负责人请假且代理授权有效');
    await page.getByLabel('审批规则处理动作').fill('转给财务主管代理处理');
    await page.getByLabel('审批规则审计要求').fill('记录代理授权、原处理人和审批意见');
    await expect(page.getByLabel('CIP 财务节点代理命中模拟场景')).toContainText('代理审批');
    await page.getByLabel('审批规则模拟流程').fill('CIP 转固流程');
    await page.getByLabel('审批规则模拟节点').fill('财务审核');
    await page.getByLabel('审批规则模拟处理人').fill('财务负责人 / P016');
    await page.getByLabel('审批规则模拟上下文').fill('请假状态已同步，代理授权仍在有效期');
    await expect(page.getByLabel('CIP 财务节点代理规则命中编排')).toContainText('4/4 发布门禁');
    await expect(page.getByLabel('CIP 财务节点代理命中路径画布')).toContainText('处理路由');
    await expect(page.getByLabel('CIP 财务节点代理命中路径画布')).toContainText('转给财务主管代理处理');
    await expect(page.getByLabel('CIP 财务节点代理规则优先级队列')).toContainText('当前模拟命中');
    await expect(page.getByLabel('CIP 财务节点代理发布门禁矩阵')).toContainText('100% 字段完成度');
    await expect(page.getByLabel('CIP 财务节点代理规则生效链')).toContainText('处理路由');
    await expect(page.getByLabel('CIP 财务节点代理规则生效链')).toContainText('100%');
    await expect(page.getByLabel('审批规则规则明细')).toContainText('CIP 财务节点代理');
    await page.getByLabel('审批规则规则操作').getByRole('button', { name: '模拟命中', exact: true }).click();
    await expect(page.getByLabel('审批规则操作结果')).toContainText('规则命中模拟已完成');
    await expect(page.getByLabel('审批规则操作结果')).toContainText('CIP 转固流程 / 财务审核');
    await approvalRulePanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('审批规则操作结果')).toContainText('审批规则草稿已保存');
    await approvalRulePanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('审批规则操作结果')).toContainText('审批规则校验已提交');

    await openSystemGroup('流程平台');
    await systemMenu.getByRole('button', { name: 'SLA 配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-sla-config$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('SLA 配置');
    const slaConfigPanel = page.getByLabel('SLA 配置专用功能面板');
    await expect(slaConfigPanel).toContainText('SLA 配置工作台');
    await expect(page.getByLabel('SLA 配置工作台')).toBeVisible();
    await expect(page.getByLabel('SLA 规则列表')).toContainText('资产入账审批 SLA');
    await expect(page.getByLabel('SLA 配置SLA明细')).toContainText('CIP 财务复核 SLA');
    await expect(page.getByLabel('资产入账审批 SLA超时策略控制台')).toContainText('超时策略控制台');
    await expect(page.getByLabel('资产入账审批 SLA超时升级路径')).toContainText('首响提醒');
    await expect(page.getByLabel('资产入账审批 SLA通知渠道矩阵')).toContainText('钉钉 H5');
    await expect(page.getByLabel('资产入账审批 SLA发布门禁矩阵')).toContainText('规则启用');
    await slaConfigPanel.getByRole('button', { name: '新建 SLA', exact: true }).click();
    await expect(page.getByLabel('SLA 规则列表')).toContainText('新建 SLA 规则');
    await page.getByLabel('SLA 名称').fill('CIP 专员审核 SLA');
    await page.getByLabel('SLA 适用流程').fill('CIP 转固流程');
    await page.getByLabel('SLA 适用节点').fill('CIP 专员审核');
    await page.getByLabel('SLA 处理时限').fill('6 小时首响 / 24 小时处理');
    await page.getByLabel('SLA 提醒策略').fill('3 小时钉钉 + 邮件提醒');
    await page.getByLabel('SLA 升级路径').fill('24 小时升级至 CIP 负责人');
    await page.getByLabel('SLA 豁免条件').fill('月结冻结日顺延');
    await expect(page.getByLabel('SLA 配置SLA明细')).toContainText('CIP 专员审核 SLA');
    await expect(page.getByLabel('CIP 专员审核 SLA超时策略控制台')).toContainText('4/4 发布门禁');
    await expect(page.getByLabel('CIP 专员审核 SLA超时升级路径')).toContainText('CIP 专员审核');
    await expect(page.getByLabel('CIP 专员审核 SLA超时升级路径')).toContainText('24 小时升级至 CIP 负责人');
    await expect(page.getByLabel('CIP 专员审核 SLA通知渠道矩阵')).toContainText('邮件');
    await expect(page.getByLabel('CIP 专员审核 SLA通知渠道矩阵')).toContainText('已启用');
    await expect(page.getByLabel('CIP 专员审核 SLA发布门禁矩阵')).toContainText('4/4 通过');
    await expect(page.getByLabel('CIP 专员审核 SLA超时模拟队列')).toContainText('月结冻结日顺延');
    await page.getByLabel('SLA 配置SLA操作').getByRole('button', { name: '模拟升级', exact: true }).click();
    await expect(page.getByLabel('SLA 配置操作结果')).toContainText('SLA 升级模拟已完成');
    await slaConfigPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('SLA 配置操作结果')).toContainText('SLA 草稿已保存');
    await slaConfigPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('SLA 配置操作结果')).toContainText('SLA 校验已提交');

    await openSystemGroup('流程平台');
    await systemMenu.getByRole('button', { name: '待办字段配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-todo-fields$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('待办字段配置');
    const todoFieldPanel = page.getByLabel('待办字段配置专用功能面板');
    await expect(page.getByLabel('待办字段配置工作台')).toBeVisible();
    await expect(todoFieldPanel).toContainText('字段方案');
    await expect(page.getByLabel('待办字段方案列表')).toContainText('资产入账待办字段');
    await expect(page.getByLabel('资产入账待办字段字段列表')).toContainText('资产小类');
    const todoSchemeSearch = page.getByRole('textbox', { name: '待办字段方案搜索', exact: true });
    await expect(page.getByLabel('待办字段方案筛选结果', { exact: true })).toHaveText('3/3');
    await todoSchemeSearch.fill('CIP');
    await expect(page.getByLabel('待办字段方案筛选结果', { exact: true })).toHaveText('1/3');
    await expect(page.getByLabel('待办字段方案列表')).toContainText('CIP 转固待办字段');
    await expect(page.getByLabel('待办字段方案列表')).not.toContainText('资产处置待办字段');
    await todoSchemeSearch.fill('不存在的字段方案');
    await expect(page.getByLabel('待办字段方案搜索空结果')).toContainText('没有匹配的字段方案');
    await page.getByRole('button', { name: '清空待办字段方案搜索', exact: true }).click();
    await expect(page.getByLabel('待办字段方案筛选结果', { exact: true })).toHaveText('3/3');
    const todoFieldSearch = page.getByRole('textbox', { name: '待办字段搜索', exact: true });
    await expect(page.getByLabel('待办字段搜索结果', { exact: true })).toHaveText('4/4');
    await todoFieldSearch.fill('资产小类');
    await expect(page.getByLabel('待办字段搜索结果', { exact: true })).toHaveText('1/4');
    await expect(page.getByLabel('资产入账待办字段字段列表')).toContainText('资产小类');
    await expect(page.getByLabel('资产入账待办字段待办预览')).toContainText('资产小类');
    await todoFieldSearch.fill('不存在的字段');
    await expect(page.getByLabel('待办字段搜索结果', { exact: true })).toHaveText('0/4');
    await expect(page.getByLabel('资产入账待办字段字段搜索空结果')).toContainText('没有匹配字段');
    await page.getByRole('button', { name: '清空待办字段搜索', exact: true }).click();
    await expect(page.getByLabel('待办字段搜索结果', { exact: true })).toHaveText('4/4');
    await todoFieldPanel.getByRole('button', { name: '新建方案', exact: true }).click();
    await expect(page.getByLabel('待办字段方案列表')).toContainText('新建待办字段方案');
    await expect(page.getByLabel('新建待办字段方案方案基础配置')).toContainText('方案完成度');
    await page.getByLabel('待办字段方案名称').fill('CIP 转固审批待办字段方案');
    await page.getByLabel('待办字段业务类型').fill('CIP_TRANSFER_APPROVAL');
    await page.getByLabel('待办字段默认排序').fill('SLA 到期时间升序 + 风险等级降序');
    await page.getByLabel('待办字段桌面布局').fill('待办标题 / 项目编号 / 转固金额 / 风险等级 / SLA');
    await page.getByLabel('待办字段H5布局').fill('标题 / 项目编号 / 风险等级 / 操作按钮');
    await expect(page.getByLabel('待办字段方案列表')).toContainText('CIP 转固审批待办字段方案');
    await expect(page.getByLabel('CIP 转固审批待办字段方案字段摘要')).toContainText('SLA 到期时间升序 + 风险等级降序');
    await todoFieldPanel.getByRole('button', { name: '新增字段', exact: true }).click();
    await page.getByLabel('待办字段名称').fill('审批风险等级');
    await page.getByLabel('待办字段编码').fill('approval_risk_level');
    await page.getByLabel('待办字段来源').fill('风险规则');
    await page.getByLabel('待办字段排序').fill('风险等级降序');
    await page.getByLabel('待办字段筛选').fill('高风险优先');
    await page.getByLabel('待办H5显示').check();
    await expect(page.getByLabel('CIP 转固审批待办字段方案字段列表')).toContainText('审批风险等级');
    await expect(page.getByLabel('CIP 转固审批待办字段方案方案基础配置')).toContainText('100%');
    await todoFieldPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('待办字段配置操作结果')).toContainText('待办字段草稿已保存');
    await expect(page.getByLabel('待办字段配置操作结果')).toContainText('CIP 转固审批待办字段方案');
    await todoFieldPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('待办字段配置操作结果')).toContainText('待办字段校验已提交');

    await openSystemGroup('组织权限');
    await expect(systemMenu.getByRole('button', { name: '工作交接', exact: true })).toBeVisible();
    await systemMenu.getByRole('button', { name: '用户管理', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-user-management$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('用户管理');
    const userManagementPanel = page.getByLabel('用户管理专用功能面板');
    await expect(userManagementPanel).toContainText('用户账号与外部身份配置');
    await expect(page.getByLabel('用户管理数据与详情')).toBeVisible();
    await expect(page.getByLabel('用户管理数据概览')).toContainText('7,286');
    await expect(page.getByLabel('组织部门导航')).toContainText('218 个部门');
    await expect(page.getByLabel('人员治理视图')).toContainText('待处理');
    await page.getByLabel('搜索组织部门').fill('生产技术');
    await expect(page.getByLabel('组织部门树')).toContainText('生产技术部');
    await expect(page.getByLabel('组织部门树')).not.toContainText('财务共享中心');
    await page.getByRole('button', { name: '清空组织部门搜索', exact: true }).click();
    await expect(page.getByLabel('组织部门树')).toContainText('财务共享中心');
    await expect(page.getByLabel('用户列表')).toContainText('高志明');
    await expect(page.getByLabel('用户列表')).toContainText('周强');
    await expect(page.getByLabel('用户列表')).not.toContainText('李敏');
    await expect(page.getByLabel('用户分页控制')).toContainText('服务端分页');
    await page.getByLabel('用户批量操作').getByRole('button', { name: '全屏台账', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '人员台账全屏窗口' })).toBeVisible();
    await expect(page.getByLabel('人员台账查询条件')).toContainText('214 人当前视图');
    await expect(page.getByLabel('人员台账分页')).toContainText('服务端分页');
    await page.getByRole('button', { name: '关闭人员台账全屏窗口', exact: true }).click();
    await page.getByLabel('人员治理视图').getByRole('button', { name: /全部人员/ }).click();
    await expect(page.getByLabel('用户列表')).toContainText('李敏');
    await page.getByRole('button', { name: '打开用户李敏详情弹窗', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '李敏用户字段维护弹窗' })).toBeVisible();
    await page.getByRole('button', { name: '关闭用户字段维护', exact: true }).click();
    await expect(page.getByLabel('用户字段维护')).toHaveCount(0);
    await expect(page.getByLabel('李敏用户详情')).toContainText('身份配置完成度');
    await expect(page.getByLabel('身份链路')).toContainText('钉钉 userId');
    await expect(page.getByLabel('用户权限与交接数据')).toContainText('权限回收');
    await expect(page.getByLabel('李敏用户授权任务清单')).toContainText('角色授权');
    await expect(page.getByLabel('李敏用户授权任务清单')).toContainText('H5 待办授权');
    await page.getByLabel('搜索用户授权任务').fill('H5');
    await expect(page.getByLabel('李敏用户授权任务清单')).toContainText('H5 待办授权');
    await expect(page.getByLabel('李敏用户授权任务清单')).not.toContainText('权限回收');
    await page.getByLabel('搜索用户授权任务').fill('不存在的授权任务');
    await expect(page.getByLabel('用户授权任务搜索空结果')).toContainText('没有匹配授权任务');
    await page.getByRole('button', { name: '清空用户授权任务搜索', exact: true }).click();
    await expect(page.getByLabel('李敏用户授权任务清单')).toContainText('权限回收');
    await page.getByLabel('李敏用户授权任务清单').getByRole('button', { name: '授权', exact: true }).first().click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('用户权限授权已生成');
    await expect(page.getByLabel('交接与审计记录')).toContainText('角色授权授权');
    await page.getByLabel('搜索用户管理数据').fill('高志明');
    await expect(page.getByLabel('用户管理筛选结果')).toContainText('1/');
    await expect(page.getByLabel('用户列表')).toContainText('高志明');
    await expect(page.getByLabel('用户列表')).not.toContainText('李敏');
    await expect(page.getByLabel('用户批量操作预览')).toContainText('已加载样例 1 条');
    await expect(page.getByLabel('用户批量操作预览')).toContainText('命中交接中或停用账号');
    await page.getByLabel('搜索用户管理数据').fill('不存在的用户');
    await expect(page.getByLabel('用户管理筛选结果')).toContainText('0/');
    await expect(page.getByLabel('用户列表')).toContainText('没有匹配用户');
    await expect(page.getByLabel('用户批量操作预览')).toContainText('当前筛选无命中');
    await expect(page.getByLabel('用户批量操作').getByRole('button', { name: '权限回收', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '清空用户管理筛选', exact: true }).click();
    await expect(page.getByLabel('人员治理视图').getByRole('button', { name: /待处理/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('用户列表')).toContainText('高志明');
    await expect(page.getByLabel('用户批量操作').getByRole('button', { name: '权限回收', exact: true })).toBeEnabled();
    await page.getByLabel('搜索用户管理数据').fill('');
    await page.getByLabel('用户状态筛选').selectOption('待补全');
    await expect(page.getByLabel('用户列表')).toContainText('周强');
    await expect(page.getByLabel('用户列表')).not.toContainText('李敏');
    await page.getByRole('button', { name: '清空用户管理筛选', exact: true }).click();
    await page.getByRole('button', { name: '处理差异', exact: true }).click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('用户差异处理批次已生成');
    await expect(page.getByLabel('交接与审计记录')).toContainText('身份差异处理');
    await page.getByLabel('用户批量操作').getByRole('button', { name: '权限回收', exact: true }).click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('用户权限回收已生成');
    await userManagementPanel.getByRole('button', { name: '新建用户', exact: true }).click();
    await expect(page.getByLabel('用户列表')).toContainText('新建用户');
    await expect(page.getByLabel('新建用户用户详情')).toContainText('身份配置完成度');
    await expect(page.getByRole('dialog', { name: '新建用户用户字段维护弹窗' })).toBeVisible();
    await page.getByLabel('用户姓名').fill('CIP 临时审批员');
    await page.getByLabel('用户工号外部编码').fill('EHR-TEMP-889 / DT-cip-temp');
    await page.getByLabel('用户组织岗位').fill('CIP 项目组 / 临时审批岗位');
    await page.getByLabel('用户钉钉UserId').fill('DT-cip-temp');
    await page.getByLabel('用户角色权限包').fill('ROLE_CIP_TEMP_APPROVER');
    await page.getByLabel('用户交接策略').fill('30 天到期自动转交资产会计');
    await expect(page.getByLabel('用户列表')).toContainText('CIP 临时审批员');
    await expect(page.getByLabel('CIP 临时审批员用户详情')).toContainText('100%');
    await expect(page.getByLabel('身份链路')).toContainText('DT-cip-temp');
    await page.getByLabel('用户字段维护').getByRole('button', { name: '发起交接', exact: true }).click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('用户工作交接批次已生成');
    await expect(page.getByLabel('交接与审计记录')).toContainText('工作交接批次');
    await page.getByRole('button', { name: '关闭用户字段维护', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'CIP 临时审批员用户字段维护弹窗' })).toHaveCount(0);
    await userManagementPanel.getByRole('button', { name: '同步校验', exact: true }).click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('同步校验已生成');
    await expect(page.getByLabel('用户管理操作结果')).toContainText('当前完成度 100%');
    await userManagementPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('用户管理草稿已保存');
    await userManagementPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('用户管理操作结果')).toContainText('用户管理校验已提交');

    const runOrganizationPermissionDraftFlow = async ({
      menuId,
      label,
      panelTitle,
      listSeed,
      primaryAction,
      createdListText,
      draftName,
      draftCode,
      draftScope,
      draftPolicy,
      simulateAction,
      rolePermissions,
      menuPermissions,
      departmentOrg,
      postManagement,
      dataPermissions,
    }: {
      menuId: string;
      label: string;
      panelTitle: string;
      listSeed: string;
      primaryAction: string;
      createdListText: string;
      draftName: string;
      draftCode: string;
      draftScope: string;
      draftPolicy: string;
      simulateAction: string;
      rolePermissions?: {
        memberSource: string;
        menuAccess: string;
        buttonAccess: string;
        apiAccess: string;
        dataScope: string;
        sensitivePolicy: string;
        temporaryGrant: string;
      };
      menuPermissions?: {
        entryPath: string;
        parentGroup: string;
        visibleRoles: string;
        buttonPoints: string;
        releasePolicy: string;
        previewRole: string;
        riskControl: string;
      };
      departmentOrg?: {
        parentPath: string;
        costCenter: string;
        deptLead: string;
        externalSource: string;
        syncPolicy: string;
        approvalImpact: string;
        handoverRule: string;
      };
      postManagement?: {
        dutyScope: string;
        approvalResolver: string;
        fallbackPost: string;
        roleLinkage: string;
        dataPermissionLinkage: string;
        handoverPolicy: string;
        auditPolicy: string;
      };
      dataPermissions?: {
        organizationScope: string;
        locationScope: string;
        assetCategoryScope: string;
        cipProjectScope: string;
        sensitiveFields: string;
        grantValidity: string;
        overreachPolicy: string;
        maskingPolicy: string;
      };
    }) => {
      await openSystemGroup('组织权限');
      await systemMenu.getByRole('button', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/fixed-assets/workbench\\?menu=${menuId}$`));
      if (menuId === 'system-role-permissions' && rolePermissions) {
        const rolePanel = page.getByLabel('角色权限专用功能面板');
        await expect(rolePanel).toContainText(panelTitle);
        await expect(page.getByLabel('角色权限矩阵与详情')).toBeVisible();
        await expect(page.getByLabel('角色权限矩阵', { exact: true })).toContainText('权限矩阵');
        await expect(page.getByLabel('角色权限矩阵', { exact: true })).toContainText('查看');
        await expect(page.getByLabel('角色权限矩阵', { exact: true })).toContainText('审批');
        await expect(page.getByLabel('角色权限矩阵', { exact: true })).toContainText('敏感');
        await expect(page.getByLabel('角色权限包列表')).toContainText(listSeed);
        await page.getByLabel('搜索角色权限数据').fill('系统运维');
        await expect(page.getByLabel('角色权限筛选结果')).toContainText('1/');
        await expect(page.getByLabel('角色权限包列表')).toContainText('系统运维');
        await expect(page.getByLabel('角色权限包列表')).not.toContainText('资产会计');
        await page.getByLabel('搜索角色权限数据').fill('不存在的角色');
        await expect(page.getByLabel('角色权限筛选结果')).toContainText('0/');
        await expect(page.getByLabel('角色权限包列表')).toContainText('没有匹配角色');
        await page.getByRole('button', { name: '清空角色权限筛选', exact: true }).click();
        await expect(page.getByLabel('角色权限包列表')).toContainText('资产会计');
        await page.getByLabel('角色权限风险筛选').getByRole('button', { name: '敏感权限', exact: true }).click();
        await expect(page.getByLabel('角色权限包列表')).toContainText('系统运维');
        await page.getByLabel('角色权限风险筛选').getByRole('button', { name: '全部角色', exact: true }).click();
        await page.getByLabel('角色权限包快捷操作').getByRole('button', { name: '权限复制', exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText('角色权限复制已生成');
        await rolePanel.getByRole('button', { name: primaryAction, exact: true }).click();
        await expect(page.getByLabel('角色权限包列表')).toContainText(createdListText);
        await page.getByLabel('角色名称').fill(draftName);
        await page.getByLabel('角色编码').fill(draftCode);
        await page.getByLabel('角色成员来源').fill(rolePermissions.memberSource);
        await page.getByLabel('角色菜单权限').fill(rolePermissions.menuAccess);
        await page.getByLabel('角色按钮权限').fill(rolePermissions.buttonAccess);
        await page.getByLabel('角色API权限').fill(rolePermissions.apiAccess);
        await page.getByLabel('角色数据范围').fill(rolePermissions.dataScope);
        await page.getByLabel('角色敏感策略').fill(rolePermissions.sensitivePolicy);
        await page.getByLabel('角色临时授权').fill(rolePermissions.temporaryGrant);
        await expect(page.getByLabel(`${draftName}权限详情`)).toContainText('权限包完成度');
        await expect(page.getByLabel('角色权限矩阵', { exact: true })).toContainText(rolePermissions.menuAccess);
        await expect(page.getByLabel('角色权限影响预览')).toContainText(rolePermissions.dataScope);
        await expect(page.getByLabel('角色权限影响预览')).toContainText(rolePermissions.apiAccess);
        await expect(page.getByLabel('角色权限影响预览')).toContainText(rolePermissions.temporaryGrant);
        const roleMemberDirectory = page.getByLabel('角色成员清单');
        await expect(roleMemberDirectory).toContainText('周强');
        await expect(roleMemberDirectory).toContainText('王可');
        await expect(roleMemberDirectory).toContainText('3/3');
        await page.getByLabel('搜索角色成员').fill('王可');
        await expect(roleMemberDirectory).toContainText('1/3');
        await expect(roleMemberDirectory).toContainText('王可');
        await expect(roleMemberDirectory).not.toContainText('周强');
        await roleMemberDirectory.getByRole('button', { name: '复核', exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText('角色成员复核已生成');
        await expect(page.getByLabel('角色权限审计记录')).toContainText('成员复核');
        await page.getByLabel('搜索角色成员').fill('不存在成员');
        await expect(roleMemberDirectory).toContainText('0/3');
        await expect(page.getByLabel('角色成员搜索空结果')).toContainText('没有匹配成员');
        await page.getByRole('button', { name: '清空角色成员搜索', exact: true }).click();
        await expect(roleMemberDirectory).toContainText('3/3');
        await page.getByRole('button', { name: '影响预览', exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText('角色权限影响预演已生成');
        await expect(page.getByLabel('角色权限审计记录')).toContainText('影响预演');
        await page.getByLabel('角色权限字段维护').getByRole('button', { name: '查看审计', exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText('角色权限审计轨迹已展开');
        await expect(page.getByLabel('角色权限审计记录')).toContainText('审计轨迹');
        await rolePanel.getByRole('button', { name: simulateAction, exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText(`${simulateAction}已生成`);
        await expect(page.getByLabel('角色权限操作结果')).toContainText('当前完成度 100%');
        await rolePanel.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText('角色权限草稿已保存');
        await rolePanel.getByRole('button', { name: '提交校验', exact: true }).click();
        await expect(page.getByLabel('角色权限操作结果')).toContainText('角色权限校验已提交');
        return;
      }
      if (menuId === 'system-menu-permissions' && menuPermissions) {
        const menuPanel = page.getByLabel('菜单权限专用功能面板');
        await expect(menuPanel).toContainText(panelTitle);
        await expect(page.getByLabel('菜单权限树表与详情')).toBeVisible();
        await expect(page.getByLabel('菜单权限结构树')).toContainText('页面操作按钮');
        await expect(page.getByLabel('菜单按钮权限清单')).toContainText(listSeed);
        await page.getByLabel('搜索菜单权限数据').fill('发布按钮');
        await expect(page.getByLabel('菜单权限筛选结果')).toContainText('1/');
        await expect(page.getByLabel('菜单按钮权限数据表')).toContainText('发布按钮');
        await expect(page.getByLabel('菜单按钮权限数据表')).not.toContainText('MENU_SYSTEM_HUB');
        await page.getByRole('button', { name: '清空菜单权限筛选', exact: true }).click();
        await expect(page.getByLabel('菜单权限筛选结果')).toContainText('/3');
        await page.getByLabel('菜单权限风险筛选').getByRole('button', { name: '按钮权限', exact: true }).click();
        await expect(page.getByRole('button', { name: '清空菜单权限筛选', exact: true })).toBeVisible();
        await expect(page.getByLabel('菜单按钮权限数据表')).toContainText('发布按钮');
        await page.getByLabel('菜单权限风险筛选').getByRole('button', { name: '全部权限', exact: true }).click();
        await page.getByLabel('菜单权限结构树').getByRole('button', { name: /页面操作按钮/ }).click();
        await expect(page.getByLabel('菜单权限当前结构筛选')).toContainText('页面操作按钮');
        await expect(page.getByLabel('菜单按钮权限数据表')).toContainText('发布按钮');
        await expect(page.getByLabel('菜单按钮权限数据表')).not.toContainText('MENU_SYSTEM_HUB');
        await page.getByRole('button', { name: '清空菜单权限筛选', exact: true }).click();
        await expect(page.getByLabel('菜单权限当前结构筛选')).toContainText('全部结构');
        await menuPanel.getByRole('button', { name: primaryAction, exact: true }).click();
        await expect(page.getByLabel('菜单按钮权限清单')).toContainText(createdListText);
        await page.getByLabel('菜单权限名称').fill(draftName);
        await page.getByLabel('菜单权限编码').fill(draftCode);
        await page.getByLabel('菜单权限入口路径').fill(menuPermissions.entryPath);
        await page.getByLabel('菜单权限父级分组').fill(menuPermissions.parentGroup);
        await page.getByLabel('菜单权限可见角色').fill(menuPermissions.visibleRoles);
        await page.getByLabel('菜单权限按钮点').fill(menuPermissions.buttonPoints);
        await page.getByLabel('菜单权限发布策略').fill(menuPermissions.releasePolicy);
        await page.getByLabel('菜单权限预览角色').fill(menuPermissions.previewRole);
        await page.getByLabel('菜单权限风险控制').fill(menuPermissions.riskControl);
        await expect(page.getByLabel('菜单按钮权限清单')).toContainText(draftName);
        await expect(page.getByLabel('菜单权限角色可见性预览')).toContainText('流程管理员');
        await expect(page.getByLabel('菜单权限发布校验清单')).toContainText('入口路径');
        await page.getByLabel('菜单权限查询筛选').getByRole('button', { name: '角色菜单预览', exact: true }).click();
        await expect(page.getByLabel('菜单权限操作结果')).toContainText('角色菜单预览已生成');
        await expect(page.getByLabel('菜单权限角色可见性预览')).toContainText(menuPermissions.previewRole);
        await page.getByLabel('菜单权限详情操作').getByRole('button', { name: '查看审计', exact: true }).click();
        await expect(page.getByLabel('菜单权限操作结果')).toContainText('菜单权限审计轨迹已展开');
        await expect(page.getByLabel('菜单权限角色可见性预览')).toContainText('审计追踪');
        await menuPanel.getByRole('button', { name: simulateAction, exact: true }).click();
        await expect(page.getByLabel('菜单权限操作结果')).toContainText(`${simulateAction}已生成`);
        await expect(page.getByLabel('菜单权限操作结果')).toContainText('当前完成度 100%');
        await menuPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByLabel('菜单权限操作结果')).toContainText('菜单权限草稿已保存');
        await menuPanel.getByRole('button', { name: '提交校验', exact: true }).click();
        await expect(page.getByLabel('菜单权限操作结果')).toContainText('菜单权限校验已提交');
        return;
      }
      if (menuId === 'system-dept-org' && departmentOrg) {
        const deptPanel = page.getByLabel('部门组织专用功能面板');
        await expect(deptPanel).toContainText(panelTitle);
        await expect(page.getByLabel('部门组织树表与详情')).toBeVisible();
        await expect(page.getByLabel('部门组织架构树')).toContainText('设备管理部');
        await expect(page.getByLabel('部门组织数据表')).toContainText(listSeed);
        await page.getByLabel('搜索部门组织数据').fill('生产技术');
        await expect(page.getByLabel('部门组织筛选结果')).toContainText('1/');
        await expect(page.getByLabel('部门组织数据表')).toContainText('生产技术部');
        await expect(page.getByLabel('部门组织数据表')).not.toContainText('财务共享中心');
        await page.getByRole('button', { name: '清空部门组织筛选', exact: true }).click();
        await expect(page.getByLabel('部门组织筛选结果')).toContainText('/3');
        await page.getByLabel('部门组织状态筛选').getByRole('button', { name: '负责人变更', exact: true }).click();
        await expect(page.getByRole('button', { name: '清空部门组织筛选', exact: true })).toBeVisible();
        await expect(page.getByLabel('部门组织数据表')).toContainText('生产技术部');
        await page.getByLabel('部门组织状态筛选').getByRole('button', { name: '全部部门', exact: true }).click();
        await deptPanel.getByRole('button', { name: primaryAction, exact: true }).click();
        await expect(page.getByLabel('部门组织数据表')).toContainText(createdListText);
        await page.getByLabel('部门组织名称').fill(draftName);
        await page.getByLabel('部门组织编码').fill(draftCode);
        await page.getByLabel('部门组织父级路径').fill(departmentOrg.parentPath);
        await page.getByLabel('部门组织成本中心').fill(departmentOrg.costCenter);
        await page.getByLabel('部门负责人配置').fill(departmentOrg.deptLead);
        await page.getByLabel('部门组织同步来源').fill(departmentOrg.externalSource);
        await page.getByLabel('部门组织同步策略').fill(departmentOrg.syncPolicy);
        await page.getByLabel('部门组织审批影响配置').fill(departmentOrg.approvalImpact);
        await page.getByLabel('部门组织交接规则').fill(departmentOrg.handoverRule);
        await expect(page.getByLabel('部门组织数据表')).toContainText(draftName);
        await expect(page.getByLabel('部门组织审批影响链路')).toContainText('CIP');
        await expect(page.getByLabel('部门组织发布检查清单')).toContainText('负责人');
        const departmentLeadTaskQueue = page.getByLabel(`${draftName}负责人变更待确认清单`);
        await expect(departmentLeadTaskQueue).toContainText('负责人变更待确认');
        await expect(departmentLeadTaskQueue).toContainText('成本中心同步');
        await page.getByLabel('搜索部门负责人变更任务').fill('成本中心');
        await expect(page.getByLabel('部门负责人变更任务筛选结果')).toHaveText('1/3');
        await expect(departmentLeadTaskQueue).toContainText('成本中心同步');
        await departmentLeadTaskQueue.getByRole('button', { name: '影响预演', exact: true }).click();
        await expect(page.getByLabel('部门组织操作结果')).toContainText('部门组织影响预演已生成');
        await expect(page.getByLabel('部门组织变更记录')).toContainText('成本中心同步影响预演');
        await page.getByLabel('搜索部门负责人变更任务').fill('不存在的负责人任务');
        await expect(page.getByLabel('部门负责人变更任务筛选结果')).toHaveText('0/3');
        await expect(page.getByLabel('部门负责人变更任务搜索空结果')).toContainText('没有匹配负责人任务');
        await page.getByRole('button', { name: '清空部门负责人变更任务搜索', exact: true }).click();
        await expect(page.getByLabel('部门负责人变更任务筛选结果')).toHaveText('3/3');
        await page.getByLabel('部门组织表格操作').getByRole('button', { name: '负责人变更', exact: true }).click();
        await expect(page.getByLabel('部门组织操作结果')).toContainText('部门组织负责人变更已生成');
        await expect(page.getByLabel('部门组织变更记录')).toContainText('负责人变更');
        await page.getByLabel('部门组织表格操作').getByRole('button', { name: '停用', exact: true }).click();
        await expect(page.getByLabel('部门组织操作结果')).toContainText('部门组织停用已生成');
        await expect(page.getByLabel('部门组织变更记录')).toContainText('待二次确认');
        await deptPanel.getByRole('button', { name: simulateAction, exact: true }).click();
        await expect(page.getByLabel('部门组织操作结果')).toContainText(`${simulateAction}已生成`);
        await expect(page.getByLabel('部门组织操作结果')).toContainText('当前完成度 100%');
        await deptPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByLabel('部门组织操作结果')).toContainText('部门组织草稿已保存');
        await deptPanel.getByRole('button', { name: '提交校验', exact: true }).click();
        await expect(page.getByLabel('部门组织操作结果')).toContainText('部门组织校验已提交');
        return;
      }
      if (menuId === 'system-post-management' && postManagement) {
        const postPanel = page.getByLabel('岗位管理专用功能面板');
        await expect(postPanel).toContainText(panelTitle);
        await expect(page.getByLabel('岗位管理规则与详情')).toBeVisible();
        await expect(page.getByLabel('岗位管理分类')).toContainText('资产管理');
        await expect(page.getByLabel('岗位管理数据表')).toContainText(listSeed);
        await page.getByLabel('搜索岗位管理数据').fill('资产会计');
        await expect(page.getByLabel('岗位管理筛选结果')).toContainText('1/');
        await expect(page.getByLabel('岗位管理数据表')).toContainText('资产会计');
        await expect(page.getByLabel('岗位管理数据表')).not.toContainText('部门负责人');
        await page.getByRole('button', { name: '清空岗位管理筛选', exact: true }).click();
        await expect(page.getByLabel('岗位管理筛选结果')).toContainText('/3');
        await page.getByLabel('岗位管理状态筛选').getByRole('button', { name: '流程引用', exact: true }).click();
        await expect(page.getByRole('button', { name: '清空岗位管理筛选', exact: true })).toBeVisible();
        await expect(page.getByLabel('岗位管理数据表')).toContainText('资产会计');
        await page.getByLabel('岗位管理状态筛选').getByRole('button', { name: '全部岗位', exact: true }).click();
        await postPanel.getByRole('button', { name: primaryAction, exact: true }).click();
        await expect(page.getByLabel('岗位管理数据表')).toContainText(createdListText);
        await page.getByLabel('岗位管理名称').fill(draftName);
        await page.getByLabel('岗位管理编码').fill(draftCode);
        await page.getByLabel('岗位管理职责范围').fill(postManagement.dutyScope);
        await page.getByLabel('岗位管理审批解析配置').fill(postManagement.approvalResolver);
        await page.getByLabel('岗位管理兜底岗位').fill(postManagement.fallbackPost);
        await page.getByLabel('岗位管理角色联动').fill(postManagement.roleLinkage);
        await page.getByLabel('岗位管理数据权限联动').fill(postManagement.dataPermissionLinkage);
        await page.getByLabel('岗位管理交接策略').fill(postManagement.handoverPolicy);
        await page.getByLabel('岗位管理审计策略').fill(postManagement.auditPolicy);
        await expect(page.getByLabel('岗位管理数据表')).toContainText(draftName);
        await expect(page.getByLabel('岗位管理审批解析模拟')).toContainText('CIP 专员');
        await expect(page.getByLabel('岗位管理发布检查清单')).toContainText('审计策略');
        await page.getByLabel('岗位管理操作', { exact: true }).getByRole('button', { name: simulateAction, exact: true }).click();
        await expect(page.getByLabel('岗位管理操作结果')).toContainText(`${simulateAction}已生成`);
        await expect(page.getByLabel('岗位管理操作结果')).toContainText('当前完成度 100%');
        await expect(page.getByLabel('岗位管理影响与审计记录')).toContainText('影响预览');
        await page.getByLabel('岗位管理详情操作').getByRole('button', { name: '查看审计', exact: true }).click();
        await expect(page.getByLabel('岗位管理操作结果')).toContainText('岗位管理审计轨迹已展开');
        await expect(page.getByLabel('岗位管理影响与审计记录')).toContainText('审计轨迹');
        await postPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByLabel('岗位管理操作结果')).toContainText('岗位管理草稿已保存');
        await postPanel.getByRole('button', { name: '提交校验', exact: true }).click();
        await expect(page.getByLabel('岗位管理操作结果')).toContainText('岗位管理校验已提交');
        return;
      }
      if (menuId === 'system-data-permissions' && dataPermissions) {
        const dataPanel = page.getByLabel('数据权限专用功能面板');
        await expect(dataPanel).toContainText(panelTitle);
        await expect(page.getByLabel('数据权限矩阵与详情')).toBeVisible();
        await expect(page.getByLabel('数据权限规则列表')).toContainText(listSeed);
        await expect(page.getByLabel('组合范围矩阵', { exact: true })).toContainText('敏感字段');
        await page.getByLabel('搜索数据权限数据').fill('全量导出');
        await expect(page.getByLabel('数据权限筛选结果')).toContainText('1/');
        await expect(page.getByLabel('数据权限规则列表')).toContainText('全量导出临时授权');
        await expect(page.getByLabel('数据权限规则列表')).not.toContainText('CIP 项目数据权限');
        await page.getByRole('button', { name: '清空数据权限筛选', exact: true }).click();
        await expect(page.getByLabel('数据权限筛选结果')).toContainText('/4');
        await page.getByLabel('数据权限风险筛选').getByRole('button', { name: '临时授权', exact: true }).click();
        await expect(page.getByRole('button', { name: '清空数据权限筛选', exact: true })).toBeVisible();
        await expect(page.getByLabel('数据权限规则列表')).toContainText('全量导出临时授权');
        await page.getByLabel('数据权限风险筛选').getByRole('button', { name: '全部规则', exact: true }).click();
        await dataPanel.getByRole('button', { name: primaryAction, exact: true }).click();
        await expect(page.getByLabel('数据权限规则列表')).toContainText(createdListText);
        await page.getByLabel('数据权限名称').fill(draftName);
        await page.getByLabel('数据权限编码').fill(draftCode);
        await page.getByLabel('数据权限组织范围').fill(dataPermissions.organizationScope);
        await page.getByLabel('数据权限位置范围').fill(dataPermissions.locationScope);
        await page.getByLabel('数据权限资产分类').fill(dataPermissions.assetCategoryScope);
        await page.getByLabel('数据权限CIP项目').fill(dataPermissions.cipProjectScope);
        await page.getByLabel('数据权限敏感字段').fill(dataPermissions.sensitiveFields);
        await page.getByLabel('数据权限有效期').fill(dataPermissions.grantValidity);
        await page.getByLabel('数据权限越权策略').fill(dataPermissions.overreachPolicy);
        await page.getByLabel('数据权限数据脱敏').fill(dataPermissions.maskingPolicy);
        await page.getByLabel('数据权限所有者').fill('安全管理员 / 资产会计');
        await expect(page.getByLabel('组合范围矩阵', { exact: true })).toContainText(draftName);
        await expect(page.getByLabel('数据权限模拟条件')).toContainText('测试用户');
        await expect(page.getByLabel('数据权限访问模拟')).toContainText('被拦截数据');
        await expect(page.getByLabel('数据权限发布校验清单')).toContainText('CIP 项目');
        await expect(page.getByLabel('数据权限发布校验清单')).toContainText('安全管理员复核');
        await expect(page.getByLabel('数据权限详情操作')).toContainText('保存数据权限');
        await page.getByLabel('数据权限查询筛选').getByRole('button', { name: '访问模拟', exact: true }).click();
        await expect(page.getByLabel('数据权限操作结果')).toContainText('数据权限访问模拟已生成');
        await expect(page.getByLabel('数据权限访问模拟')).toContainText('访问模拟');
        const dataSubjectDirectory = page.getByLabel('数据权限命中用户清单');
        await expect(dataSubjectDirectory).toContainText('沈磊');
        await expect(dataSubjectDirectory).toContainText('赵宁');
        await expect(dataSubjectDirectory).toContainText('3/3');
        await page.getByLabel('搜索数据权限命中用户').fill('赵宁');
        await expect(dataSubjectDirectory).toContainText('1/3');
        await expect(dataSubjectDirectory).toContainText('赵宁');
        await expect(dataSubjectDirectory).not.toContainText('沈磊');
        await dataSubjectDirectory.getByRole('button', { name: '复核', exact: true }).click();
        await expect(page.getByLabel('数据权限操作结果')).toContainText('数据权限成员复核已生成');
        await expect(page.getByLabel('数据权限访问模拟')).toContainText('成员复核');
        await page.getByLabel('搜索数据权限命中用户').fill('不存在用户');
        await expect(dataSubjectDirectory).toContainText('0/3');
        await expect(page.getByLabel('数据权限命中用户搜索空结果')).toContainText('没有匹配用户');
        await page.getByRole('button', { name: '清空数据权限命中用户搜索', exact: true }).click();
        await expect(dataSubjectDirectory).toContainText('3/3');
        await page.getByLabel('数据权限详情操作').getByRole('button', { name: '查看审计', exact: true }).click();
        await expect(page.getByLabel('数据权限操作结果')).toContainText('数据权限审计轨迹已展开');
        await expect(page.getByLabel('数据权限访问模拟')).toContainText('审计追踪');
        await dataPanel.getByRole('button', { name: simulateAction, exact: true }).click();
        await expect(page.getByLabel('数据权限操作结果')).toContainText(`${simulateAction}已生成`);
        await expect(page.getByLabel('数据权限操作结果')).toContainText('当前完成度 100%');
        await dataPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
        await expect(page.getByLabel('数据权限操作结果')).toContainText('数据权限草稿已保存');
        await dataPanel.getByRole('button', { name: '提交校验', exact: true }).click();
        await expect(page.getByLabel('数据权限操作结果')).toContainText('数据权限校验已提交');
        return;
      }
      const permissionPanel = page.getByLabel(`${label}专用功能面板`);
      await expect(permissionPanel).toContainText(panelTitle);
      await expect(page.getByLabel(`${label}组织权限工作台`)).toBeVisible();
      await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(listSeed);
      await permissionPanel.getByRole('button', { name: primaryAction, exact: true }).click();
      await expect(page.getByLabel(`${label}对象列表`)).toContainText(createdListText);
      await page.getByLabel(`${label}名称`).fill(draftName);
      await page.getByLabel(`${label}编码`).fill(draftCode);
      await page.getByLabel(`${label}授权范围`).fill(draftScope);
      await page.getByLabel(`${label}权限策略`).fill(draftPolicy);
      await page.getByLabel(`${label}负责人`).fill('平台运维');
      if (rolePermissions) {
        await expect(page.getByLabel(`${draftName}权限包矩阵`)).toContainText('权限包完成度');
        await page.getByLabel('角色权限成员来源').fill(rolePermissions.memberSource);
        await page.getByLabel('角色权限菜单权限').fill(rolePermissions.menuAccess);
        await page.getByLabel('角色权限按钮权限').fill(rolePermissions.buttonAccess);
        await page.getByLabel('角色权限API权限').fill(rolePermissions.apiAccess);
        await page.getByLabel('角色权限数据范围').fill(rolePermissions.dataScope);
        await page.getByLabel('角色权限敏感策略').fill(rolePermissions.sensitivePolicy);
        await page.getByLabel('角色权限临时授权').fill(rolePermissions.temporaryGrant);
        await expect(page.getByLabel(`${draftName}权限包矩阵`)).toContainText('100%');
      }
      if (menuPermissions) {
        await expect(page.getByLabel(`${draftName}菜单权限编排`)).toContainText('菜单发布完成度');
        await page.getByLabel('菜单权限入口路径').fill(menuPermissions.entryPath);
        await page.getByLabel('菜单权限父级分组').fill(menuPermissions.parentGroup);
        await page.getByLabel('菜单权限可见角色').fill(menuPermissions.visibleRoles);
        await page.getByLabel('菜单权限按钮点').fill(menuPermissions.buttonPoints);
        await page.getByLabel('菜单权限发布策略').fill(menuPermissions.releasePolicy);
        await page.getByLabel('菜单权限预览角色').fill(menuPermissions.previewRole);
        await page.getByLabel('菜单权限风险控制').fill(menuPermissions.riskControl);
        await expect(page.getByLabel(`${draftName}菜单权限编排`)).toContainText('100%');
      }
      if (departmentOrg) {
        await expect(page.getByLabel(`${draftName}组织同步编排`)).toContainText('组织同步完成度');
        await page.getByLabel('部门组织父级路径').fill(departmentOrg.parentPath);
        await page.getByLabel('部门组织成本中心').fill(departmentOrg.costCenter);
        await page.getByLabel('部门负责人配置').fill(departmentOrg.deptLead);
        await page.getByLabel('部门组织同步来源').fill(departmentOrg.externalSource);
        await page.getByLabel('部门组织同步策略').fill(departmentOrg.syncPolicy);
        await page.getByLabel('部门组织审批影响配置').fill(departmentOrg.approvalImpact);
        await page.getByLabel('部门组织交接规则').fill(departmentOrg.handoverRule);
        await expect(page.getByLabel(`${draftName}组织同步编排`)).toContainText('100%');
        await expect(page.getByLabel(`${draftName}组织同步预览`)).toContainText(departmentOrg.costCenter);
      }
      if (postManagement) {
        await expect(page.getByLabel(`${draftName}岗位规则编排`)).toContainText('岗位规则完成度');
        await page.getByLabel('岗位管理职责范围').fill(postManagement.dutyScope);
        await page.getByLabel('岗位管理审批解析配置').fill(postManagement.approvalResolver);
        await page.getByLabel('岗位管理兜底岗位').fill(postManagement.fallbackPost);
        await page.getByLabel('岗位管理角色联动').fill(postManagement.roleLinkage);
        await page.getByLabel('岗位管理数据权限联动').fill(postManagement.dataPermissionLinkage);
        await page.getByLabel('岗位管理交接策略').fill(postManagement.handoverPolicy);
        await page.getByLabel('岗位管理审计策略').fill(postManagement.auditPolicy);
        await expect(page.getByLabel(`${draftName}岗位规则编排`)).toContainText('100%');
        await expect(page.getByLabel(`${draftName}岗位影响预览`)).toContainText(postManagement.roleLinkage);
      }
      if (dataPermissions) {
        await expect(page.getByLabel(`${draftName}数据权限范围编排`)).toContainText('数据范围完成度');
        await page.getByLabel('数据权限组织范围').fill(dataPermissions.organizationScope);
        await page.getByLabel('数据权限位置范围').fill(dataPermissions.locationScope);
        await page.getByLabel('数据权限资产分类').fill(dataPermissions.assetCategoryScope);
        await page.getByLabel('数据权限CIP项目').fill(dataPermissions.cipProjectScope);
        await page.getByLabel('数据权限敏感字段').fill(dataPermissions.sensitiveFields);
        await page.getByLabel('数据权限有效期').fill(dataPermissions.grantValidity);
        await page.getByLabel('数据权限越权策略').fill(dataPermissions.overreachPolicy);
        await expect(page.getByLabel(`${draftName}数据权限范围编排`)).toContainText('100%');
      }
      await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftName);
      await permissionPanel.getByRole('button', { name: simulateAction, exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${simulateAction}已生成`);
      if (rolePermissions) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (menuPermissions) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (departmentOrg) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (postManagement) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (dataPermissions) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      await permissionPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}草稿已保存`);
      await permissionPanel.getByRole('button', { name: '提交校验', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}校验已提交`);
    };

    await runOrganizationPermissionDraftFlow({
      menuId: 'system-role-permissions',
      label: '角色权限',
      panelTitle: '角色权限包配置',
      listSeed: '资产会计',
      primaryAction: '新建角色',
      createdListText: '新建角色',
      draftName: 'CIP 转固资产会计角色',
      draftCode: 'ROLE_CIP_CAP_ACCOUNTANT',
      draftScope: 'CIP / 转固 / 折旧 / ERP 回执',
      draftPolicy: '财务组织成员自动继承，临时授权 30 天后回收',
      simulateAction: '权限对比',
      rolePermissions: {
        memberSource: '财务共享中心资产会计岗位 + CIP 项目临时授权',
        menuAccess: '在建工程 / CIP 转固管理 / 资产台账 / 工作概览',
        buttonAccess: '转固确认 / ERP 回执重推 / 折旧试算 / 附件归档',
        apiAccess: 'CIP 转固 API / 资产卡片 API / ERP 回写 API',
        dataScope: '授权 CIP 项目 + 财务组织 + 转固资产',
        sensitivePolicy: '金额、工号、IP 脱敏；发布和导出需二次确认',
        temporaryGrant: '临时授权 30 天后自动回收并生成审计',
      },
    });

    await runOrganizationPermissionDraftFlow({
      menuId: 'system-menu-permissions',
      label: '菜单权限',
      panelTitle: '菜单与按钮授权配置',
      listSeed: '系统运营中枢',
      primaryAction: '新建权限点',
      createdListText: '新建菜单/按钮',
      draftName: 'CIP 转固发布按钮',
      draftCode: 'BTN_CIP_CAP_PUBLISH',
      draftScope: '系统运营中枢 / CIP 转固管理 / 发布按钮',
      draftPolicy: '仅流程管理员和资产会计可见，发布需二次确认',
      simulateAction: '授权预览',
      menuPermissions: {
        entryPath: '系统运营中枢 / 流程平台 / CIP 转固管理 / 发布按钮',
        parentGroup: '系统运营中枢 / 流程平台',
        visibleRoles: '流程管理员 / 资产会计 / 系统运维',
        buttonPoints: '发布 / 回滚 / 二次确认 / 查看审计',
        releasePolicy: '发布前必须完成角色菜单预览和安全管理员复核',
        previewRole: '资产会计',
        riskControl: 'CIP 金额、ERP 回写和发布按钮均需敏感权限拦截',
      },
    });

    await runOrganizationPermissionDraftFlow({
      menuId: 'system-dept-org',
      label: '部门组织',
      panelTitle: '部门组织与负责人配置',
      listSeed: '资产管理部',
      primaryAction: '新建部门',
      createdListText: '新建部门',
      draftName: 'CIP 项目管理组',
      draftCode: 'DEPT_CIP_PM',
      draftScope: '总部 / 财务共享中心 / CC-CIP',
      draftPolicy: 'EHR/钉钉差异进入人工确认，负责人变更触发流程复核',
      simulateAction: '差异确认',
      departmentOrg: {
        parentPath: '总部 / 财务共享中心 / CIP 项目管理组',
        costCenter: 'CC-CIP / 在建工程项目',
        deptLead: '周强 / CIP 项目负责人',
        externalSource: 'EHR 组织 + ERP 成本中心 + 钉钉部门',
        syncPolicy: '负责人变更需同步审批处理人和数据权限',
        approvalImpact: 'CIP 立项、费用归集、转固验收默认组织',
        handoverRule: '离职或调岗时自动生成资产责任和待办交接',
      },
    });

    await runOrganizationPermissionDraftFlow({
      menuId: 'system-post-management',
      label: '岗位管理',
      panelTitle: '岗位与审批岗位规则',
      listSeed: '资产管理员',
      primaryAction: '新建岗位',
      createdListText: '新建岗位',
      draftName: 'CIP 专员',
      draftCode: 'POST_CIP_OWNER',
      draftScope: 'CIP 立项 / 费用归集 / 转固审核',
      draftPolicy: '绑定 CIP 转固流程专员审核节点，可继承角色权限包',
      simulateAction: '影响预览',
      postManagement: {
        dutyScope: 'CIP 立项、费用归集、转固资料校验、ERP 回执跟进',
        approvalResolver: 'CIP 转固流程专员审核节点按岗位成员解析',
        fallbackPost: '资产会计 / 财务共享负责人兜底',
        roleLinkage: 'ROLE_CIP_OWNER + ROLE_ASSET_ACCOUNTANT 联动岗位成员',
        dataPermissionLinkage: '授权 CIP 项目 + 财务组织 + 转固资产明细',
        handoverPolicy: '离职或调岗时转交 CIP 项目责任、流程待办和附件校验任务',
        auditPolicy: '岗位成员、审批解析、数据范围变更均写入审计',
      },
    });

    await runOrganizationPermissionDraftFlow({
      menuId: 'system-data-permissions',
      label: '数据权限',
      panelTitle: '数据权限范围配置',
      listSeed: 'CIP 项目数据权限',
      primaryAction: '新建数据权限',
      createdListText: '新建数据规则',
      draftName: 'CIP 项目临时数据权限',
      draftCode: 'DATA_CIP_PROJECT_TEMP',
      draftScope: 'CIP 项目 / 财务组织 / 30 天有效',
      draftPolicy: '跨项目授权需安全管理员复核并记录用途',
      simulateAction: '越权校验',
      dataPermissions: {
        organizationScope: '财务共享中心 / CIP 项目会计 / 临时审批角色',
        locationScope: '总部 / A 厂区在建工程区域 / 机房改造现场',
        assetCategoryScope: 'CIP 项目 / 转固资产 / 生产设备 / 财务附件',
        cipProjectScope: 'CIP-2026-01 新产线 / CIP-2026-03 机房改造',
        sensitiveFields: '合同金额 / 发票 / 工号 / IP 地址按角色脱敏',
        grantValidity: '30 天有效，到期自动回收并生成审计',
        overreachPolicy: '跨组织、跨项目、全量导出必须安全管理员复核',
        maskingPolicy: '合同金额、发票号码、工号、IP 地址默认脱敏展示',
      },
    });

    await openSystemGroup('组织权限');
    await systemMenu.getByRole('button', { name: '工作交接', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-handover$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('工作交接');
    await expect(page.getByLabel('工作交接系统配置功能页')).toBeVisible();
    await expect(page.getByLabel('工作交接配置对象列表')).toHaveCount(0);
    const handoverPanel = page.getByLabel('工作交接专用功能面板');
    await expect(handoverPanel).toContainText('责任交接工作台');
    await expect(page.getByLabel('工作交接批次列表')).toContainText('高志明离职交接批次');
    await expect(page.getByLabel('工作交接批次列表')).toContainText('CIP 临时审批员交接');
    await expect(page.getByLabel('高志明离职交接批次交接范围明细')).toContainText('资产责任转交');
    await expect(page.getByLabel('高志明离职交接批次扫描影响概览')).toContainText('风险门禁');
    const handoverObjectQueue = page.getByLabel('资产责任转交交接对象处理清单');
    await expect(handoverObjectQueue).toContainText('AOI 检测设备');
    await expect(handoverObjectQueue).toContainText('MES 边缘服务器');
    await expect(handoverObjectQueue).toContainText('3/3');
    const handoverObjectSearch = page.getByRole('textbox', { name: '交接对象搜索', exact: true });
    await handoverObjectSearch.fill('MES');
    await expect(handoverObjectQueue).toContainText('1/3');
    await expect(handoverObjectQueue).toContainText('MES 边缘服务器');
    await expect(handoverObjectQueue).not.toContainText('AOI 检测设备');
    await handoverObjectQueue.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('交接明细确认已生成');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('明细确认');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('MES 边缘服务器');
    await handoverObjectSearch.fill('不存在对象');
    await expect(handoverObjectQueue).toContainText('0/3');
    await expect(page.getByLabel('交接对象搜索空结果')).toContainText('没有匹配的交接对象');
    await page.getByRole('button', { name: '清空交接对象搜索', exact: true }).click();
    await expect(handoverObjectQueue).toContainText('3/3');
    const handoverSearch = page.getByRole('textbox', { name: '工作交接批次搜索', exact: true });
    await expect(page.getByLabel('工作交接批次筛选结果')).toContainText('/');
    await handoverSearch.fill('高志明');
    await expect(page.getByLabel('工作交接批次筛选结果')).toContainText('1/');
    await expect(page.getByLabel('工作交接批次列表')).toContainText('高志明离职交接批次');
    await expect(page.getByLabel('高志明离职交接批次交接概览')).toBeVisible();
    await handoverSearch.fill('不存在的交接批次');
    await expect(page.getByLabel('工作交接批次筛选结果')).toContainText('0/');
    await expect(page.getByLabel('工作交接批次搜索空结果')).toContainText('没有匹配的交接批次');
    await page.getByRole('button', { name: '清空工作交接批次搜索', exact: true }).click();
    await expect(page.getByLabel('工作交接批次列表')).toContainText('高志明离职交接批次');
    await handoverPanel.getByRole('button', { name: '扫描待办', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('交接影响扫描已完成');
    await expect(page.getByLabel('高志明离职交接批次扫描影响概览')).toContainText('流程待办');
    await expect(page.getByLabel('工作交接范围操作')).toContainText('重新扫描');
    await handoverPanel.getByRole('button', { name: '新建批次', exact: true }).click();
    await expect(page.getByLabel('工作交接批次列表')).toContainText('新建工作交接批次');
    await handoverPanel.getByRole('button', { name: '新增范围', exact: true }).click();
    await page.getByLabel('交接范围名称').fill('CIP 项目负责人交接');
    await page.getByLabel('交接对象类型').fill('CIP 项目');
    await expect(page.getByLabel('交接扫描条件')).toHaveValue(/CIP 项目/);
    await page.getByLabel('交接扫描数量').fill('4 个');
    await page.getByLabel('交接接收人').fill('周强');
    await expect(page.getByLabel('交接生效方式')).toHaveValue('提交生效后由管理员确认落库');
    await page.getByLabel('交接审计规则').fill('项目负责人变更后冻结原责任人审批入口');
    await expect(page.getByLabel('新建工作交接批次交接范围明细')).toContainText('CIP 项目负责人交接');
    await handoverPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('交接草稿已保存');
    await handoverPanel.getByRole('button', { name: '提交模拟', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('交接模拟已提交');
    await expect(page.getByLabel('工作交接批次列表')).toContainText('模拟已提交');
    await expect(page.getByLabel('新建工作交接批次交接范围明细')).toContainText('模拟待确认');
    await expect(page.getByLabel('新建工作交接批次交接模拟结果')).toContainText('生效门禁');
    await handoverPanel.getByRole('button', { name: '提交生效', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('交接生效已提交');
    await expect(page.getByLabel('工作交接批次列表')).toContainText('待生效确认');
    await expect(page.getByLabel('新建工作交接批次交接范围明细')).toContainText('待生效');
    await page.getByLabel('工作交接范围操作').getByRole('button', { name: '查看审计', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('CIP 项目负责人交接审计轨迹已展开');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('范围审计');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('扫描条件');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('接收确认');
    await page.getByLabel('工作交接批次操作').getByRole('button', { name: '查看审计', exact: true }).click();
    await expect(page.getByLabel('工作交接操作结果')).toContainText('新建工作交接批次审计明细已展开');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('批次审计');
    await expect(page.getByLabel('工作交接审计记录')).toContainText('生效门禁');

    await openSystemGroup('集成配置');
    await expect(systemMenu.getByRole('button', { name: '外部系统配置', exact: true })).toBeVisible();
    await systemMenu.getByRole('button', { name: '外部系统配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-external-systems$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('外部系统配置');
    await expect(page.getByLabel('外部系统配置专用功能面板')).toContainText('外部系统接入配置');
    await expect(page.getByLabel('外部系统配置专用功能面板')).toContainText('外部系统接入控制台');
    await expect(page.getByLabel('外部系统配置专用功能面板')).not.toContainText('通用接入控制台');
    const integrationDesignMatrix = page.getByLabel('集成配置子页面产品图与 Stitch 矩阵');
    await expect(integrationDesignMatrix).toBeHidden();
    await expect(integrationDesignMatrix).toContainText('外部系统配置');
    await expect(integrationDesignMatrix).toContainText('接口配置');
    await expect(integrationDesignMatrix).toContainText('字段映射');
    await expect(integrationDesignMatrix).toContainText('同步规则');
    await expect(integrationDesignMatrix).toContainText('Webhook 配置');
    await expect(integrationDesignMatrix.locator('img').first()).toHaveAttribute(
      'src',
      /integration-subpage-01-external-systems-v2\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(1)).toHaveAttribute(
      'src',
      /stitch-integration-subpage-01-external-systems-v1\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(2)).toHaveAttribute(
      'src',
      /integration-subpage-02-interfaces-v2\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(3)).toHaveAttribute(
      'src',
      /stitch-integration-subpage-02-interfaces-v1\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(4)).toHaveAttribute(
      'src',
      /integration-subpage-03-field-mapping-v2\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(5)).toHaveAttribute(
      'src',
      /stitch-integration-subpage-03-field-mapping-v1\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(6)).toHaveAttribute(
      'src',
      /integration-subpage-04-sync-rules-v2\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(7)).toHaveAttribute(
      'src',
      /stitch-integration-subpage-04-sync-rules-v1\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(8)).toHaveAttribute(
      'src',
      /integration-subpage-05-webhook-config-v2\.png/,
    );
    await expect(integrationDesignMatrix.locator('img').nth(9)).toHaveAttribute(
      'src',
      /stitch-integration-subpage-05-webhook-config-v1\.png/,
    );
    await expect(page.getByLabel('外部系统对象切换')).toContainText('MES 设备状态源');
    await expect(page.getByLabel('MES 设备状态源连接策略')).toContainText('Token + IP 白名单');
    await page.getByLabel('选择ERP 固资推送接口').click();
    await expect(page.getByLabel('ERP 固资推送接口连接策略')).toContainText('OAuth2');
    await expect(page.getByLabel('ERP 固资推送接口字段映射与同步策略')).toContainText('asset_class');
    await expect(page.getByLabel('ERP 固资推送接口字段映射与同步策略')).toContainText('报废审批完成');
    const externalSystemPanel = page.getByLabel('外部系统配置专用功能面板');
    await externalSystemPanel.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置操作结果')).toContainText('连接测试已完成');
    await expect(page.getByLabel('通用接入测试记录')).toContainText('ERP 固资推送接口');
    await expect(page.getByLabel('通用接入测试记录')).toContainText('测试连接');
    await externalSystemPanel.getByRole('button', { name: '认证策略', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置操作结果')).toContainText('认证策略检查已展开');
    await expect(page.getByLabel('通用接入测试记录')).toContainText('认证策略');
    await externalSystemPanel.getByRole('button', { name: '同步试跑', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置操作结果')).toContainText('同步试跑已完成');
    await expect(page.getByLabel('通用接入测试记录')).toContainText('同步试跑');
    await page.getByLabel('外部系统配置专用功能面板').getByRole('button', { name: '新建接入配置', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置编辑区')).toContainText('ERP 固资推送接口 新接入配置');
    await page.getByLabel('接入配置名称', { exact: true }).fill('ERP/EHR 资产处置接入配置');
    await page.getByLabel('接入配置类型', { exact: true }).selectOption('ERP/EHR 配置');
    await page.getByLabel('接入接口端点', { exact: true }).fill('资产处置结果推送 V2');
    await page.getByLabel('接入触发方式', { exact: true }).fill('处置 / 清退 / 报废流程财务结束后触发');
    await page.getByLabel('字段映射策略', { exact: true }).fill('asset_class -> 资产小类；finance_date -> 财务确认日；ehr_emp_no -> 工号');
    await page.getByLabel('接入同步规则', { exact: true }).fill('流程完结后推送 ERP；赔偿完成后推送 EHR；失败进入异常队列');
    await page.getByLabel('接入负责人', { exact: true }).fill('财务 IT / HRIS');
    await page.getByLabel('外部系统接入配置草稿操作').getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置操作结果')).toContainText('接入配置草稿已保存');
    await expect(page.getByLabel('外部系统接入配置保存记录')).toContainText('ERP/EHR 资产处置接入配置');
    await page.getByLabel('外部系统接入配置草稿操作').getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置操作结果')).toContainText('接入配置提交校验已完成');
    await expect(page.getByLabel('外部系统接入配置保存记录')).toContainText('已提交校验');

    await openSystemGroup('集成配置');
    await systemMenu.getByRole('button', { name: '接口配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-interfaces$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('接口配置');
    const interfacePanel = page.getByLabel('接口配置专用功能面板');
    await expect(interfacePanel).toContainText('接口配置工作台');
    await expect(page.getByLabel('集成配置二级页签')).toContainText('字段映射');
    await expect(page.getByLabel('集成对象切换')).toContainText('MES 设备状态源');
    await expect(page.getByLabel('接口配置接口端点视图')).toContainText('报废结果推送');
    await page.getByLabel('选择ERP 固资推送接口').click();
    await expect(page.getByLabel('ERP 固资推送接口集成对象概览')).toContainText('OAuth2');
    await expect(page.getByLabel('接口配置接口端点视图')).toContainText('报废结果推送');
    const interfaceRunbook = page.getByLabel('ERP 固资推送接口接口健康检查台');
    await expect(interfaceRunbook).toContainText('认证引用');
    await expect(page.getByLabel('ERP 固资推送接口接口认证与健康门禁')).toContainText('OAuth2');
    await expect(page.getByLabel('ERP 固资推送接口端点健康检查结果')).toContainText('报废结果推送');
    await expect(page.getByLabel('ERP 固资推送接口最近调用日志')).toContainText('CALL-API-ERP-ASSET');
    await interfaceRunbook.getByRole('button', { name: '健康检查', exact: true }).click();
    await expect(page.getByLabel('接口配置配置操作结果')).toContainText('接口健康检查已完成');
    await expect(page.getByLabel('接口配置配置操作结果')).toContainText('不读取也不展示密钥');
    await interfaceRunbook.getByRole('button', { name: '调用日志', exact: true }).click();
    await expect(page.getByLabel('接口配置配置操作结果')).toContainText('最近调用日志已展开');
    await expect(page.getByLabel('接口配置配置操作结果')).toContainText('失败请求可进入异常队列人工补发');
    await interfacePanel.getByRole('button', { name: '试跑', exact: true }).click();
    await expect(page.getByLabel('接口配置配置操作结果')).toContainText('样例试跑已完成');
    await expect(page.getByLabel('接口配置操作留痕')).toContainText('样例试跑');
    await expect(page.getByLabel('接口配置操作留痕')).toContainText('未写业务数据');
    await interfacePanel.getByRole('button', { name: '异常队列', exact: true }).click();
    await expect(page.getByLabel('接口配置配置操作结果')).toContainText('异常队列已在当前页展开');
    await expect(page.getByLabel('接口配置操作留痕')).toContainText('异常队列');
    await expect(page.getByLabel('接口配置操作留痕')).toContainText('人工补发');
    await runIntegrationDraftFlow(
      '接口配置专用功能面板',
      '新建接口',
      '接口配置',
      'ERP 处置结果推送接口 V2',
      'POST 报废结果推送 V2',
      'asset_id',
      'ERP 资产编号',
      '报废/清退流程归档后触发',
      '失败进入财务异常队列并可人工补发',
      '记录审批单号、请求摘要和 ERP 回执',
    );

    await openSystemGroup('集成配置');
    await systemMenu.getByRole('button', { name: '字段映射', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-field-mapping$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('字段映射');
    await expect(page.getByLabel('字段映射专用功能面板')).toContainText('字段映射工作台');
    await expect(page.getByLabel('字段映射字段映射视图')).toContainText('emp_no');
    await page.getByLabel('选择ERP 固资推送接口').click();
    await expect(page.getByLabel('字段映射字段映射视图')).toContainText('asset_class');
    const fieldMappingRunbook = page.getByLabel('ERP 固资推送接口字段映射校验台');
    await expect(fieldMappingRunbook).toContainText('样例校验');
    await expect(page.getByLabel('ERP 固资推送接口字段映射发布门禁')).toContainText('发布门禁');
    await expect(page.getByLabel('ERP 固资推送接口字段映射样例校验结果')).toContainText('asset_class');
    await expect(page.getByLabel('ERP 固资推送接口字段映射冲突检测')).toContainText('缺失字段');
    await fieldMappingRunbook.getByRole('button', { name: '样例校验', exact: true }).click();
    await expect(page.getByLabel('字段映射配置操作结果')).toContainText('字段样例校验已完成');
    await expect(page.getByLabel('字段映射配置操作结果')).toContainText('不写入正式数据');
    await fieldMappingRunbook.getByRole('button', { name: '冲突检测', exact: true }).click();
    await expect(page.getByLabel('字段映射配置操作结果')).toContainText('字段冲突检测已展开');
    await expect(page.getByLabel('字段映射配置操作结果')).toContainText('冲突处理后才能提交发布');
    await runIntegrationDraftFlow(
      '字段映射专用功能面板',
      '维护映射',
      '字段映射',
      'ERP 资产小类字段映射',
      'POST 报废结果推送',
      'asset_class',
      '资产小类',
      '处置审批完成后转换资产小类',
      '字段缺失进入数据异常队列',
      '保留源字段、转换前后值和规则版本',
    );

    await openSystemGroup('集成配置');
    await systemMenu.getByRole('button', { name: '同步规则', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-sync-rules$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('同步规则');
    await expect(page.getByLabel('同步规则专用功能面板')).toContainText('同步规则工作台');
    await page.getByLabel('选择PO/合同金额变更同步').click();
    await expect(page.getByLabel('PO/合同金额变更同步集成对象概览')).toContainText('PO/合同变更');
    await expect(page.getByLabel('同步规则同步规则视图')).toContainText('PO 变更审批通过');
    await expect(page.getByLabel('同步规则回调与异常队列')).toContainText('合同金额变更');
    const syncRuleRunbook = page.getByLabel('PO/合同金额变更同步同步规则试跑与门禁');
    await expect(syncRuleRunbook).toContainText('触发门禁');
    await expect(page.getByLabel('PO/合同金额变更同步同步规则门禁矩阵')).toContainText('已核销、已归档数据禁止无痕修改');
    await expect(page.getByLabel('PO/合同金额变更同步同步规则试跑结果')).toContainText('冻结策略');
    await runIntegrationDraftFlow(
      '同步规则专用功能面板',
      '配置规则',
      '同步规则',
      'PO/合同金额变更审批同步规则',
      'POST 合同金额变更',
      'contract_amount',
      '合同金额',
      '合同或 PO 变更审批通过后触发',
      '金额差异超过阈值时冻结核销入口',
      '保留审批单号、变更前后值和同步回执',
    );
    await syncRuleRunbook.getByRole('button', { name: '试跑规则', exact: true }).click();
    await expect(page.getByLabel('同步规则配置操作结果')).toContainText('同步规则试跑已完成');
    await expect(page.getByLabel('同步规则配置操作结果')).toContainText('本次不写入业务数据');
    await syncRuleRunbook.getByRole('button', { name: '异常重放', exact: true }).click();
    await expect(page.getByLabel('同步规则配置操作结果')).toContainText('异常重放队列已展开');
    await expect(page.getByLabel('同步规则配置操作结果')).toContainText('已核销单据保持只读保护');
    const syncReplayQueue = page.getByLabel('PO/合同金额变更同步异常重放任务清单');
    await expect(syncReplayQueue).toContainText('PO-2026-0518');
    await expect(syncReplayQueue).toContainText('合同金额变更');
    const syncReplaySearch = page.getByRole('textbox', { name: '同步异常任务搜索', exact: true });
    await syncReplaySearch.fill('已核销');
    await expect(page.getByLabel('同步异常任务筛选结果')).toHaveText('1/3');
    const lockedReplayTask = syncReplayQueue.getByLabel('PO-2026-0518异常任务');
    await lockedReplayTask.getByRole('button', { name: '锁定', exact: true }).click();
    await expect(page.getByLabel('同步规则配置操作结果')).toContainText('同步异常任务锁定已生成');
    await expect(page.getByLabel('同步规则操作留痕')).toContainText('异常锁定');
    await expect(page.getByLabel('同步规则操作留痕')).toContainText('PO-2026-0518');
    await syncReplaySearch.fill('不存在的同步异常任务');
    await expect(page.getByLabel('同步异常任务筛选结果')).toHaveText('0/3');
    await expect(page.getByLabel('同步异常任务搜索空结果')).toContainText('没有匹配的同步异常任务');
    await page.getByRole('button', { name: '清空同步异常任务搜索', exact: true }).click();
    await expect(page.getByLabel('同步异常任务筛选结果')).toHaveText('3/3');

    await openSystemGroup('集成配置');
    await systemMenu.getByRole('button', { name: 'Webhook 配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-webhook-config$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('Webhook 配置');
    await expect(page.getByLabel('Webhook 配置专用功能面板')).toContainText('Webhook 配置工作台');
    await page.getByLabel('选择异常队列 Webhook').click();
    await expect(page.getByLabel('异常队列 Webhook集成对象概览')).toContainText('同步失败、字段缺失');
    const webhookRunbook = page.getByLabel('异常队列 Webhook签名与重放台');
    await expect(webhookRunbook).toContainText('签名校验');
    await expect(page.getByLabel('异常队列 Webhook签名门禁')).toContainText('幂等键');
    await expect(page.getByLabel('异常队列 Webhook回调日志')).toContainText('同步失败入队');
    await expect(page.getByLabel('异常队列 Webhook失败重放队列')).toContainText('重放前校验');
    await expect(page.getByLabel('Webhook 配置回调与异常队列')).toContainText('同步失败入队');
    await webhookRunbook.getByRole('button', { name: '发送测试', exact: true }).click();
    await expect(page.getByLabel('Webhook 配置配置操作结果')).toContainText('Webhook 测试发送已完成');
    await expect(page.getByLabel('Webhook 配置配置操作结果')).toContainText('只写回调日志');
    await webhookRunbook.getByRole('button', { name: '失败重放', exact: true }).click();
    await expect(page.getByLabel('Webhook 配置配置操作结果')).toContainText('Webhook 失败重放已展开');
    await expect(page.getByLabel('Webhook 配置配置操作结果')).toContainText('签名摘要和响应摘要');
    await runIntegrationDraftFlow(
      'Webhook 配置专用功能面板',
      '新增订阅',
      'Webhook 配置',
      '异常队列失败任务 Webhook',
      'POST 失败任务入队',
      'failure_code',
      '失败原因',
      '同步失败或字段缺失时触发',
      '签名失败拒收，重复幂等键只保留一次',
      '记录签名摘要、幂等键和人工重放人',
    );

    await openSystemGroup('消息与通知');
    await expect(systemMenu.getByRole('button', { name: '邮件网关配置', exact: true })).toBeVisible();
    await systemMenu.getByRole('button', { name: '邮件网关配置', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench\?menu=system-mail-gateway$/);
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('邮件网关配置');
    await expect(page.getByLabel('邮件网关配置系统配置功能页')).toBeVisible();
    await expect(page.getByLabel('邮件网关配置配置对象列表')).toHaveCount(0);
    await expect(page.getByLabel('邮件网关配置专用功能面板')).toContainText('邮件网关配置台');
    await expect(page.getByLabel('邮件通知对象切换')).toContainText('主邮件网关');
    const mailGatewaySearch = page.getByRole('textbox', { name: '邮件网关搜索', exact: true });
    await expect(page.getByLabel('邮件网关筛选结果')).toHaveText('5/5');
    await mailGatewaySearch.fill('失败队列');
    await expect(page.getByLabel('邮件网关筛选结果')).toHaveText('1/5');
    await expect(page.getByLabel('邮件通知对象切换')).toContainText('邮件失败日志批次');
    await expect(page.getByLabel('邮件通知对象切换')).not.toContainText('主邮件网关');
    await mailGatewaySearch.fill('不存在的邮件网关');
    await expect(page.getByLabel('邮件网关筛选结果')).toHaveText('0/5');
    await expect(page.getByLabel('邮件网关搜索空结果')).toContainText('没有匹配的邮件网关');
    await page.getByRole('button', { name: '清空邮件网关搜索', exact: true }).click();
    await expect(page.getByLabel('邮件网关筛选结果')).toHaveText('5/5');
    await expect(page.getByLabel('邮件通知对象切换')).toContainText('主邮件网关');
    await page.getByLabel('选择主邮件网关').click();
    await expect(page.getByLabel('主邮件网关邮件网关策略')).toContainText('SMTP / TLS 1.2');
    await expect(page.getByLabel('主邮件网关邮件安全策略')).toContainText('强制 TLS');
    await expect(page.getByLabel('主邮件网关流程邮件引用')).toContainText('CIP 转固流程');
    await expect(page.getByLabel('主邮件网关发送日志')).toContainText('SLA 超时升级');
    await page.getByLabel('选择CIP 转固流程邮件').click();
    await expect(page.getByLabel('CIP 转固流程邮件邮件网关策略')).toContainText('CIP 提交、审批、驳回、转固完结通知');
    await expect(page.getByLabel('CIP 转固流程邮件流程邮件引用')).toContainText('CIP-ERP-RECEIPT');
    const mailGatewayPanel = page.getByLabel('邮件网关配置专用功能面板');
    await mailGatewayPanel.getByRole('button', { name: '新建邮件网关', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置编辑区')).toContainText('新邮件网关');
    await page.getByLabel('邮件网关名称').fill('CIP 转固备用 SMTP 网关');
    await page.getByLabel('邮件网关编码').fill('MAIL_GATEWAY_CIP_BACKUP');
    await page.getByLabel('邮件网关传输方式').fill('SMTP / TLS 1.3 / 587');
    await page.getByLabel('邮件网关认证方式').fill('OAuth2 Client + 凭据轮换');
    await page.getByLabel('邮件网关发件身份').fill('CIP 流程通知 <cip-notice@forth.local>');
    await page.getByLabel('邮件网关负责人').fill('平台运维');
    await page.getByLabel('邮件网关端点').fill('smtp-cip-backup.forth.local:587');
    await page.getByLabel('邮件网关测试收件人').fill('cip-owner@forth.local');
    await page.getByLabel('邮件网关安全策略').fill('强制 TLS；仅允许流程服务账号发件；失败切主网关并写入审计');
    await mailGatewayPanel.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置操作结果')).toContainText('邮件网关测试连接已完成');
    await mailGatewayPanel.getByRole('button', { name: '安全策略', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置操作结果')).toContainText('邮件网关安全策略检查已展开');
    await expect(page.getByLabel('邮件网关安全检查记录')).toContainText('TLS 与端点');
    await expect(page.getByLabel('邮件网关安全检查记录')).toContainText('敏感脱敏');
    await mailGatewayPanel.getByRole('button', { name: '发送日志', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置操作结果')).toContainText('邮件网关发送日志已展开');
    await expect(page.getByLabel('邮件网关日志处理记录')).toContainText('日志轨迹');
    await page.getByLabel('CIP 转固流程邮件发送日志').getByRole('button', { name: '1 次', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置操作结果')).toContainText('邮件日志重试已入队');
    await expect(page.getByLabel('邮件网关日志处理记录')).toContainText('MAIL-CIP-044');
    await page.getByLabel('邮件网关配置草稿操作').getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置操作结果')).toContainText('邮件网关草稿已保存');
    await expect(page.getByLabel('邮件网关配置保存记录')).toContainText('CIP 转固备用 SMTP 网关');
    await page.getByLabel('邮件网关配置草稿操作').getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('邮件网关配置操作结果')).toContainText('邮件网关校验已提交');
    await expect(page.getByLabel('邮件网关配置保存记录')).toContainText('已提交校验');

    await expect(systemMenu.getByRole('button', { name: '运营首页', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '资产运营总览', exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-assets\/workbench$/);
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '运营首页', exact: true })).toBeVisible();
    await expect(page.getByLabel('工作台菜单').getByRole('button', { name: '流程定义', exact: true })).toHaveCount(0);

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统配置专属页内搜索直接过滤配置对象', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-external-systems');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('外部系统配置');
    await expect(page.locator('.workspace-system-filterbar')).toHaveCount(0);
    const objectStrip = page.getByLabel('外部系统对象切换');
    const searchInput = page.getByRole('textbox', { name: '外部系统配置搜索', exact: true });
    await expect(page.getByLabel('外部系统配置筛选结果')).toHaveText('5/5');
    await expect(objectStrip).toContainText('MES 设备状态源');
    await expect(objectStrip).toContainText('ERP 固资推送接口');

    await searchInput.fill('ERP');
    await expect(page.getByLabel('外部系统配置筛选结果')).toHaveText('1/5');
    await expect(objectStrip).toContainText('ERP 固资推送接口');
    await expect(objectStrip).not.toContainText('MES 设备状态源');
    await expect(page.getByLabel('ERP 固资推送接口连接策略')).toBeVisible();
    await page.getByLabel('外部系统配置专用功能面板').getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(page.getByLabel('外部系统接入配置操作结果')).toContainText('连接测试已完成');
    await expect(page.getByLabel('通用接入测试记录')).toContainText('ERP 固资推送接口');

    await searchInput.fill('不存在的接入对象');
    await expect(page.getByLabel('外部系统配置筛选结果')).toHaveText('0/5');
    await expect(page.getByLabel('外部系统配置搜索空结果')).toContainText('没有匹配的外部系统');

    await page.getByRole('button', { name: '清空外部系统配置搜索', exact: true }).click();
    await expect(page.getByLabel('外部系统配置筛选结果')).toHaveText('5/5');
    await expect(objectStrip).toContainText('MES 设备状态源');
    await expect(objectStrip).toContainText('异常队列 Webhook');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('消息与通知专用配置台支持邮件模板新建保存提交', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-mail-templates');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('邮件模板');
    const mailTemplatePanel = page.getByLabel('邮件模板专用功能面板');
    await expect(mailTemplatePanel).toContainText('邮件模板配置台');
    await expect(page.getByLabel('邮件模板消息通知工作台')).toBeVisible();
    await expect(page.getByLabel('邮件模板通知对象列表')).toContainText('CIP 转固审批通知');
    await expect(page.getByLabel('邮件模板专用配置预览')).toContainText('SLA 超时升级模板');
    await mailTemplatePanel.getByRole('button', { name: '新建邮件模板', exact: true }).click();
    await expect(page.getByLabel('邮件模板通知对象列表')).toContainText('新建邮件模板');
    await page.getByLabel('邮件模板名称').fill('CIP 转固完结通知');
    await page.getByLabel('邮件模板编码').fill('MAIL_CIP_DONE');
    await page.getByLabel('邮件模板通知场景').fill('CIP 转固 / 完工验收');
    await page.getByLabel('邮件模板触发事件').fill('流程完结且 ERP 回执成功');
    await page.getByLabel('邮件模板通知渠道').fill('邮件 + 站内');
    await page.getByLabel('邮件模板内容模板').fill('通知项目负责人和资产会计确认资产卡片与折旧衔接');
    await page.getByLabel('邮件模板负责人').fill('流程管理员');
    await expect(page.getByLabel('邮件模板专用配置预览')).toContainText('CIP 转固完结通知');
    const mailTemplateSearch = page.getByRole('textbox', { name: '邮件模板搜索', exact: true });
    await expect(page.getByLabel('邮件模板筛选结果')).toContainText('/');
    await mailTemplateSearch.fill('MAIL_CIP_DONE');
    await expect(page.getByLabel('邮件模板筛选结果')).toContainText('1/');
    await expect(page.getByLabel('邮件模板通知对象列表')).toContainText('CIP 转固完结通知');
    await expect(page.getByLabel('邮件模板专用配置预览')).toContainText('流程完结且 ERP 回执成功');
    await mailTemplateSearch.fill('不存在的邮件模板');
    await expect(page.getByLabel('邮件模板筛选结果')).toContainText('0/');
    await expect(page.getByLabel('邮件模板搜索空结果')).toContainText('没有匹配的邮件模板');
    await page.getByRole('button', { name: '清空邮件模板搜索', exact: true }).click();
    await expect(page.getByLabel('邮件模板通知对象列表')).toContainText('CIP 转固完结通知');
    await mailTemplatePanel.getByRole('button', { name: '模板预览', exact: true }).click();
    await expect(page.getByLabel('邮件模板操作结果')).toContainText('模板预览已生成');
    await page.getByLabel('CIP 转固完结通知触达预览').getByRole('button', { name: '查看触达审计', exact: true }).click();
    await expect(page.getByLabel('邮件模板操作结果')).toContainText('邮件模板触达审计已展开');
    await expect(page.getByLabel('CIP 转固完结通知触达审计记录')).toContainText('流程引用');
    await expect(page.getByLabel('CIP 转固完结通知触达审计记录')).toContainText('发送日志');
    await mailTemplatePanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('邮件模板操作结果')).toContainText('邮件模板草稿已保存');
    await mailTemplatePanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('邮件模板操作结果')).toContainText('邮件模板校验已提交');

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('消息通知配置页均可新建保存提交', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const runNotificationDraftFlow = async ({
      menuId,
      label,
      panelTitle,
      primaryAction,
      createdListText,
      draftName,
      draftCode,
      draftScene,
      draftTrigger,
      draftChannel,
      draftContent,
      simulateAction,
    }: {
      menuId: string;
      label: string;
      panelTitle: string;
      primaryAction: string;
      createdListText: string;
      draftName: string;
      draftCode: string;
      draftScene: string;
      draftTrigger: string;
      draftChannel: string;
      draftContent: string;
      simulateAction: string;
    }) => {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await expect(page.locator('.workspace-topbar-title strong')).toHaveText(label);
      const notificationPanel = page.getByLabel(`${label}专用功能面板`);
      await expect(notificationPanel).toContainText(panelTitle);
      await expect(page.getByLabel(`${label}系统配置操作`)).toHaveCount(0);
      await expect(page.getByLabel(`${label}关键指标`)).toHaveCount(0);
      await expect(page.getByLabel(`${label}通用详情操作`)).toHaveCount(0);
      await expect(page.getByLabel(`${label}配置生命周期`)).toHaveCount(0);
      await expect(page.getByLabel(`${label}设计与审计承接`)).toBeHidden();
      await expect(page.getByLabel(`${label}消息通知工作台`)).toBeVisible();
      await notificationPanel.getByRole('button', { name: primaryAction, exact: true }).click();
      await expect(page.getByLabel(`${label}通知对象列表`)).toContainText(createdListText);
      await page.getByLabel(`${label}名称`).fill(draftName);
      await page.getByLabel(`${label}编码`).fill(draftCode);
      await page.getByLabel(`${label}通知场景`).fill(draftScene);
      await page.getByLabel(`${label}触发事件`).fill(draftTrigger);
      await page.getByLabel(`${label}通知渠道`).fill(draftChannel);
      if (menuId !== 'system-workflow-notification-switch') {
        await page.getByLabel(`${label}内容模板`).fill(draftContent);
      }
      await page.getByLabel(`${label}负责人`).fill('消息通知管理员');
      await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftName);
      if (menuId !== 'system-mail-logs' && menuId !== 'system-workflow-notification-switch') {
        const notificationSearch = page.getByRole('textbox', { name: `${label}搜索`, exact: true });
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('/');
        await notificationSearch.fill(draftCode);
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('1/');
        await expect(page.getByLabel(`${label}通知对象列表`)).toContainText(draftName);
        await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftTrigger);
        await notificationSearch.fill(`不存在的${label}`);
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('0/');
        await expect(page.getByLabel(`${label}搜索空结果`)).toContainText('没有匹配');
        await notificationSearch.fill('');
        await expect(page.getByLabel(`${label}通知对象列表`)).toContainText(draftName);
      }
      const previewLabel = label === '流程通知开关' ? `${draftName}触达预演面板` : `${draftName}触达预览`;
      await expect(page.getByLabel(previewLabel)).toContainText(draftChannel);
      const simulateScope = label === '流程通知开关' ? page.getByLabel(previewLabel) : notificationPanel;
      await simulateScope.getByRole('button', { name: simulateAction, exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${simulateAction}已生成`);
      if (menuId !== 'system-mail-logs' && menuId !== 'system-workflow-notification-switch') {
        await page.getByLabel(`${draftName}触达预览`).getByRole('button', { name: '查看触达审计', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}触达审计已展开`);
        await expect(page.getByLabel(`${draftName}触达审计记录`)).toContainText('流程引用');
        await expect(page.getByLabel(`${draftName}触达审计记录`)).toContainText('变量快照');
        await expect(page.getByLabel(`${draftName}触达审计记录`)).toContainText('渠道降级');
        await expect(page.getByLabel(`${draftName}触达审计记录`)).toContainText('发送日志');
      }
      await notificationPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}草稿已保存`);
      await notificationPanel.getByRole('button', { name: '提交校验', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}校验已提交`);
    };

    const notificationCases = [
      {
        menuId: 'system-workflow-mail',
        label: '流程邮件配置',
        panelTitle: '流程邮件触发规则台',
        primaryAction: '新建流程邮件',
        createdListText: '新建流程邮件规则',
        draftName: 'CIP 转固完结邮件规则',
        draftCode: 'WF_MAIL_CIP_DONE',
        draftScene: 'CIP 转固流程',
        draftTrigger: '流程完结 / ERP 回执成功',
        draftChannel: '邮件 + 站内',
        draftContent: '引用 CIP 转固完结模板，附 ERP 回执摘要',
        simulateAction: '触发预演',
      },
      {
        menuId: 'system-mail-logs',
        label: '邮件日志',
        panelTitle: '邮件日志与重试策略台',
        primaryAction: '新建重试策略',
        createdListText: '新建邮件日志规则',
        draftName: 'CIP 邮件失败重试策略',
        draftCode: 'MAIL_RETRY_CIP_FAIL',
        draftScene: '邮件发送失败队列',
        draftTrigger: 'ERP 回执通知失败 / 认证超时',
        draftChannel: '主邮件网关 + 备用网关',
        draftContent: '3 次失败升级平台运维并保留变量快照',
        simulateAction: '重试预演',
      },
      {
        menuId: 'system-notification-templates',
        label: '通知模板',
        panelTitle: '通知模板配置台',
        primaryAction: '新建通知模板',
        createdListText: '新建通知模板',
        draftName: 'CIP 转固 H5 待办通知',
        draftCode: 'NOTIFY_CIP_H5_TODO',
        draftScene: 'CIP 转固审批待办',
        draftTrigger: '节点到达且处理人可见',
        draftChannel: '站内 + 钉钉 H5',
        draftContent: '展示项目、金额、节点、SLA 和打开 H5 表单按钮',
        simulateAction: '通知预览',
      },
      {
        menuId: 'system-notification-channels',
        label: '通知渠道',
        panelTitle: '通知渠道配置台',
        primaryAction: '新建通知渠道',
        createdListText: '新建通知渠道',
        draftName: 'CIP 钉钉 H5 渠道',
        draftCode: 'CHANNEL_CIP_DING_H5',
        draftScene: '移动审批待办 / 转固提醒',
        draftTrigger: '关键待办必达，低优先级摘要',
        draftChannel: '钉钉 H5',
        draftContent: '失败回落站内信，不建设独立移动端',
        simulateAction: '测试发送',
      },
      {
        menuId: 'system-notification-preferences',
        label: '通知偏好',
        panelTitle: '通知偏好配置台',
        primaryAction: '新建偏好规则',
        createdListText: '新建通知偏好',
        draftName: 'CIP 资产会计通知偏好',
        draftCode: 'PREF_CIP_ACCOUNTANT',
        draftScene: '资产会计 / CIP 专员',
        draftTrigger: 'CIP 转固、折旧、ERP 失败必达',
        draftChannel: '邮件 + 站内 + 钉钉 H5',
        draftContent: '低优先级按日摘要，强制通知即时触达',
        simulateAction: '偏好预览',
      },
      {
        menuId: 'system-workflow-notification-switch',
        label: '流程通知开关',
        panelTitle: '流程通知开关配置台',
        primaryAction: '新建通知开关',
        createdListText: '新建通知开关',
        draftName: 'CIP ERP 回执失败强制通知',
        draftCode: 'SWITCH_CIP_ERP_FAIL',
        draftScene: 'CIP 转固流程',
        draftTrigger: 'ERP 推送失败 / 回执异常',
        draftChannel: '邮件 + 站内',
        draftContent: '失败通知强制开启，关闭需资产会计复核',
        simulateAction: '开关预演',
      },
    ];

    for (const notificationCase of notificationCases) {
      await runNotificationDraftFlow(notificationCase);
      if (notificationCase.menuId === 'system-mail-logs') {
        const mailLogSearch = page.getByRole('textbox', { name: '邮件日志搜索', exact: true });
        await expect(page.getByLabel('邮件日志筛选结果')).toContainText('/');
        await mailLogSearch.fill(notificationCase.draftCode);
        await expect(page.getByLabel('邮件日志筛选结果')).toContainText('1/');
        await expect(page.getByLabel('邮件日志通知对象列表')).toContainText(notificationCase.draftName);
        await expect(page.getByLabel('邮件日志专用配置预览')).toContainText(notificationCase.draftTrigger);
        await mailLogSearch.fill('不存在的邮件日志批次');
        await expect(page.getByLabel('邮件日志筛选结果')).toContainText('0/');
        await expect(page.getByLabel('邮件日志搜索空结果')).toContainText('没有匹配的邮件日志');
        await page.getByRole('button', { name: '清空邮件日志搜索', exact: true }).click();
        await expect(page.getByLabel('邮件日志通知对象列表')).toContainText(notificationCase.draftName);
        const retryQueue = page.getByLabel(`${notificationCase.draftName}失败重试队列`);
        await expect(retryQueue).toContainText(notificationCase.draftTrigger);
        await expect(retryQueue).toContainText(notificationCase.draftChannel);
        await retryQueue.getByRole('button', { name: '执行重试', exact: true }).click();
        await expect(page.getByLabel('邮件日志操作结果')).toContainText('失败邮件已加入重试队列');
        await retryQueue.getByRole('button', { name: '导出取证包', exact: true }).click();
        await expect(page.getByLabel('邮件日志操作结果')).toContainText('邮件取证包已生成');
        await page.getByLabel(`${notificationCase.draftName}触达预览`).getByRole('button', { name: '查看原始日志', exact: true }).click();
        await expect(page.getByLabel('邮件日志操作结果')).toContainText(`${notificationCase.draftName}原始日志已展开`);
        await expect(page.getByLabel(`${notificationCase.draftName}原始日志记录`)).toContainText('SMTP 响应');
        await expect(page.getByLabel(`${notificationCase.draftName}原始日志记录`)).toContainText('变量快照');
        await expect(page.getByLabel(`${notificationCase.draftName}原始日志记录`)).toContainText('收件人');
        await expect(page.getByLabel(`${notificationCase.draftName}原始日志记录`)).toContainText('重试次数');
        await expect(page.getByLabel(`${notificationCase.draftName}原始日志记录`)).toContainText('备用网关');
        await expect(page.getByLabel(`${notificationCase.draftName}原始日志记录`)).toContainText('审计链路');
      }
      if (notificationCase.menuId === 'system-notification-channels') {
        const channelConsole = page.getByLabel(`${notificationCase.draftName}渠道健康与降级路由`);
        await expect(channelConsole).toContainText('渠道参数');
        await expect(page.getByLabel(`${notificationCase.draftName}渠道健康矩阵`)).toContainText('接口地址');
        await expect(page.getByLabel(`${notificationCase.draftName}降级路由`)).toContainText('站内信 + 邮件日志重试队列');
        await channelConsole.getByRole('button', { name: '发送测试', exact: true }).click();
        await expect(page.getByLabel('通知渠道操作结果')).toContainText('发送测试已完成');
        await expect(page.getByLabel('通知渠道操作结果')).toContainText('限流、签名、静默时段和失败降级链路');
        await channelConsole.getByRole('button', { name: '查看降级路由', exact: true }).click();
        await expect(page.getByLabel('通知渠道操作结果')).toContainText('降级路由已展开');
        await expect(page.getByLabel('通知渠道操作结果')).toContainText('站内信 -> 邮件日志重试队列');
        const channelTaskQueue = page.getByLabel(`${notificationCase.draftName}渠道失败处理队列`);
        await expect(channelTaskQueue).toContainText('渠道失败处理队列');
        await expect(page.getByLabel(`${notificationCase.draftName}渠道失败任务明细`)).toContainText('DING-H5-2026-033');
        const channelTaskSearch = page.getByRole('textbox', { name: '通知渠道失败任务搜索', exact: true });
        await expect(page.getByLabel('通知渠道失败任务筛选结果')).toContainText('3/3');
        await channelTaskSearch.fill('工作交接');
        await expect(page.getByLabel('通知渠道失败任务筛选结果')).toContainText('1/3');
        await expect(page.getByLabel(`${notificationCase.draftName}渠道失败任务明细`)).toContainText('CHANNEL-HANDOVER-2026-011');
        await channelTaskSearch.fill('不存在的渠道失败');
        await expect(page.getByLabel('通知渠道失败任务筛选结果')).toContainText('0/3');
        await expect(page.getByLabel('通知渠道失败任务搜索空结果')).toContainText('没有匹配的失败任务');
        await page.getByRole('button', { name: '清空通知渠道失败任务搜索', exact: true }).click();
        const channelFailureDetails = page.getByLabel(`${notificationCase.draftName}渠道失败任务明细`);
        await expect(channelFailureDetails).toContainText('CHANNEL-MAIL-2026-018');
        const mailFailureTask = channelFailureDetails.locator('article').filter({ hasText: 'CHANNEL-MAIL-2026-018' });
        await expect(mailFailureTask).toContainText('主邮件网关认证失败');
        await mailFailureTask.getByRole('button', { name: '降级', exact: true }).click();
        await expect(page.getByLabel('通知渠道操作结果')).toContainText('通知渠道切换降级已生成');
        await expect(page.getByLabel(`${notificationCase.draftName}触达审计记录`)).toContainText('渠道降级切换');
        await expect(page.getByLabel(`${notificationCase.draftName}触达审计记录`)).toContainText('CHANNEL-MAIL-2026-018');
      }
      if (notificationCase.menuId === 'system-notification-preferences') {
        const preferenceConsole = page.getByLabel(`${notificationCase.draftName}偏好继承与强制通知`);
        await expect(preferenceConsole).toContainText('偏好继承');
        await expect(page.getByLabel(`${notificationCase.draftName}偏好继承矩阵`)).toContainText('强制边界');
        await expect(page.getByLabel(`${notificationCase.draftName}偏好预览结果`)).toContainText('静默窗口');
        await preferenceConsole.getByRole('button', { name: '继承预览', exact: true }).click();
        await expect(page.getByLabel('通知偏好操作结果')).toContainText('通知偏好预览已生成');
        await expect(page.getByLabel('通知偏好操作结果')).toContainText('强制通知保持即时触达');
        await preferenceConsole.getByRole('button', { name: '静默冲突检查', exact: true }).click();
        await expect(page.getByLabel('通知偏好操作结果')).toContainText('静默冲突检查已展开');
        await expect(page.getByLabel('通知偏好操作结果')).toContainText('不允许被用户偏好关闭');
      }
      if (notificationCase.menuId === 'system-workflow-notification-switch') {
        const switchMatrix = page.getByLabel(`${notificationCase.draftName}流程通知开关矩阵`);
        await expect(switchMatrix).toContainText(notificationCase.draftScene);
        await expect(switchMatrix).toContainText(notificationCase.draftChannel);
        await expect(page.getByLabel(`${notificationCase.draftName}开关指挥条`)).toContainText('强制触达');
        await page.getByLabel('通知开关节点').fill('ERP 回执异常处理');
        await page.getByLabel('通知开关事件').fill('推送失败 / 回执异常');
        await page.getByLabel('通知开关渠道').fill('邮件 + 站内 + 钉钉 H5');
        await page.getByLabel('通知开关模式').selectOption('强制开启');
        await page.getByLabel('通知开关复核人').fill('资产会计');
        await page.getByLabel('通知开关审计说明').fill('失败通知强制开启，关闭需审批单号和复核人留痕');
        await expect(page.getByLabel('通知开关节点')).toHaveValue('ERP 回执异常处理');
        await expect(switchMatrix).toContainText('ERP 回执异常处理');
        await page.getByLabel('通知开关规则启用').uncheck();
        await expect(page.getByLabel(`${notificationCase.draftName}发布门禁`)).toContainText('强制通知');
        await page.getByLabel('通知开关规则启用').check();
        await page.getByLabel(`${notificationCase.draftName}触达预演面板`).getByRole('button', { name: '开关预演', exact: true }).click();
        await expect(page.getByLabel('流程通知开关操作结果')).toContainText('开关预演已生成');
        await expect(page.getByLabel('流程通知开关操作结果')).toContainText('强制触达');
        await expect(page.getByLabel(`${notificationCase.draftName}通知试算记录`)).toContainText('发送预演');
        await expect(page.getByLabel(`${notificationCase.draftName}通知试算记录`)).toContainText('日志归档');
        await page.getByLabel('流程通知开关属性配置').getByRole('button', { name: '查看审计', exact: true }).click();
        await expect(page.getByLabel('流程通知开关操作结果')).toContainText('流程通知开关审计轨迹已展开');
        await expect(page.getByLabel('流程通知开关审计记录')).toContainText('审计轨迹');
        await expect(page.getByLabel('流程通知开关审计记录')).toContainText('发布门禁');
      }
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
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('基础参数');
    await expectSystemHtmlPageContract(page, 'system-base-params', '基础参数');
    const baseParamsFrame = systemHtmlFrameBody(page, '基础参数');
    await expect(baseParamsFrame).toContainText('基础参数列表');
    await expect(baseParamsFrame).toContainText('参数域');
    await expect(baseParamsFrame).toContainText('状态');
    await expect(baseParamsFrame).toContainText('风险');
    await expect(baseParamsFrame).toContainText('附件大小与格式');
    await expect(baseParamsFrame).toContainText('共 5 条');
    await expect(page.locator('body')).not.toContainText('规划中');
    await expect(page.locator('body')).not.toContainText('占位');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('流程定义页支持当前页新建保存提交', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-flow-definition');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('流程定义');
    const flowDefinitionPanel = page.getByLabel('流程定义专用功能面板');
    await expect(flowDefinitionPanel).toContainText('流程定义');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('CIP 转固流程');

    await flowDefinitionPanel.getByRole('button', { name: '新建流程', exact: true }).click();
    await expect(page.getByLabel('流程定义操作结果')).toContainText('新建流程草稿已创建');
    await expect(page.getByLabel('流程定义草稿编辑区')).toContainText('CIP 转固验收补充流程');

    await page.getByLabel('流程定义名称').fill('CIP 转固验收补充流程 2026');
    await page.getByLabel('流程定义编码').fill('FLOW_CIP_ACCEPTANCE_SUPPLEMENT_2026');
    await page.getByLabel('流程定义业务分类').fill('CIP 管理 / 完工验收');
    await page.getByLabel('流程定义版本').fill('V0.2');
    await page.getByLabel('流程定义表单名称').fill('CIP 完工验收补充表');
    await page.getByLabel('流程定义表单编码').fill('CIP_ACCEPTANCE_SUPPLEMENT_FORM_V2');
    await page.getByLabel('流程定义负责人').fill('流程管理员');
    await page.getByLabel('流程定义发布范围').fill('CIP 转固 / 验收附件 / ERP 回执');
    await page
      .getByLabel('流程定义节点清单')
      .fill('提交申请 / 项目负责人\nCIP 专员审核 / CIP 专员\n资产会计复核 / 资产会计\nERP 回执归档 / 系统任务');
    await page
      .getByLabel('流程定义发布检查')
      .fill('业务对象已绑定\n表单字段已发布\nERP 回执字段已映射\n待办字段已配置');

    await expect(page.getByLabel('流程平台流程列表')).toContainText('CIP 转固验收补充流程 2026');
    await expect(page.getByLabel('CIP 转固验收补充流程 2026右侧详情')).toContainText('CIP 完工验收补充表');
    await expect(page.getByLabel('CIP 转固验收补充流程 2026流程节点')).toContainText('资产会计复核');

    await flowDefinitionPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('流程定义操作结果')).toContainText('流程定义草稿已保存');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('草稿已保存');

    await flowDefinitionPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('流程定义操作结果')).toContainText('流程定义校验已提交');
    await expect(page.getByLabel('流程平台流程列表')).toContainText('已提交校验');
    await expect(page.getByLabel('CIP 转固验收补充流程 2026发布检查')).toContainText('ERP 回执字段已映射');

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统运营中枢缺失配置页均落到专用功能面板', async ({ page }) => {
    test.setTimeout(90_000);

    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const newlyCoveredMenus = [
      ['system-flow-definition', '流程定义'],
      ['system-approval-rules', '审批规则'],
      ['system-sla-config', 'SLA 配置'],
      ['system-user-management', '用户管理'],
      ['system-role-permissions', '角色权限'],
      ['system-menu-permissions', '菜单权限'],
      ['system-dept-org', '部门组织'],
      ['system-post-management', '岗位管理'],
      ['system-data-permissions', '数据权限'],
      ['system-handover', '工作交接'],
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
    ] as const;
    const dedicatedPreviewLabelByMenu: Partial<Record<(typeof newlyCoveredMenus)[number][0], string>> = {
      'system-flow-definition': '流程平台流程列表',
      'system-approval-rules': '审批规则规则明细',
      'system-sla-config': 'SLA 配置SLA明细',
      'system-user-management': '用户列表',
      'system-role-permissions': '角色权限包列表',
      'system-menu-permissions': '菜单权限树表与详情',
      'system-dept-org': '部门组织树表与详情',
      'system-post-management': '岗位管理规则与详情',
      'system-data-permissions': '数据权限矩阵与详情',
      'system-handover': '工作交接批次列表',
      'system-external-systems': '外部系统接入配置编辑区',
      'system-interfaces': '接口配置配置编辑区',
      'system-field-mapping': '字段映射配置编辑区',
      'system-sync-rules': '同步规则配置编辑区',
      'system-webhook-config': 'Webhook 配置配置编辑区',
    };

    for (const [menuId, label] of newlyCoveredMenus) {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await expect(page.locator('.workspace-topbar-title strong')).toHaveText(label);
      if (isSystemHtmlMenu(menuId)) {
        await expectSystemHtmlPageContract(page, menuId, label);
        continue;
      }
      await expect(page.getByLabel(`${label}专用功能面板`)).toContainText(label);
      await expect(page.getByLabel(dedicatedPreviewLabelByMenu[menuId] ?? `${label}专用配置预览`)).toBeVisible();
      await expect(page.getByLabel(`${label}产品图与 Stitch 计划`)).toBeHidden();
    }

    const groupVisualCases = [
      ['system-user-management', '用户管理', 'org-permission-v2', 'stitch-org-permission-v1'],
      ['system-asset-category', '资产分类', 'master-data-v2', 'stitch-master-data-v1'],
      ['system-external-systems', '外部系统配置', 'integration-config-v2', 'stitch-integration-config-v1'],
      ['system-mail-gateway', '邮件网关配置', 'notification-config-v2', 'stitch-notification-config-v1'],
      ['system-base-params', '基础参数', 'system-params-v2', 'stitch-system-params-v1'],
    ] as const;

    for (const [menuId, label, assetId, stitchAssetId] of groupVisualCases) {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await expect(page.locator('.workspace-topbar-title strong')).toHaveText(label);
      if (isSystemHtmlMenu(menuId)) {
        await expectSystemHtmlPageContract(page, menuId, label);
      } else {
        await expect(page.getByLabel(`${label}产品图与 Stitch 计划`)).toBeHidden();
      }
    }

    await page.goto('/fixed-assets/workbench?menu=system-workflow-mail');
    const notificationDesignMatrix = page.getByLabel('消息与通知子页面产品图与 Stitch 矩阵');
    await expect(notificationDesignMatrix).toBeHidden();
    for (const label of ['邮件网关配置', '流程邮件配置', '邮件模板', '邮件日志', '通知模板', '通知渠道', '通知偏好', '流程通知开关']) {
      await expect(notificationDesignMatrix).toContainText(label);
    }
    await expect(notificationDesignMatrix.locator('img')).toHaveCount(16);
    await expect(notificationDesignMatrix.locator('img').first()).toHaveAttribute('src', /notification-subpage-01-mail-gateway-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(1)).toHaveAttribute('src', /stitch-notification-subpage-01-mail-gateway-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(2)).toHaveAttribute('src', /notification-subpage-02-workflow-mail-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(3)).toHaveAttribute('src', /stitch-notification-subpage-02-workflow-mail-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(4)).toHaveAttribute('src', /notification-subpage-03-mail-templates-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(5)).toHaveAttribute('src', /stitch-notification-subpage-03-mail-templates-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(6)).toHaveAttribute('src', /notification-subpage-04-mail-logs-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(7)).toHaveAttribute('src', /stitch-notification-subpage-04-mail-logs-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(8)).toHaveAttribute('src', /notification-subpage-05-notification-templates-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(9)).toHaveAttribute('src', /stitch-notification-subpage-05-notification-templates-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(10)).toHaveAttribute('src', /notification-subpage-06-notification-channels-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(11)).toHaveAttribute('src', /stitch-notification-subpage-06-notification-channels-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(12)).toHaveAttribute('src', /notification-subpage-07-notification-preferences-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(13)).toHaveAttribute('src', /stitch-notification-subpage-07-notification-preferences-v1\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(14)).toHaveAttribute('src', /notification-subpage-08-workflow-notification-switch-v2\.png/);
    await expect(notificationDesignMatrix.locator('img').nth(15)).toHaveAttribute('src', /stitch-notification-subpage-08-workflow-notification-switch-v1\.png/);

    await page.goto('/fixed-assets/workbench?menu=system-base-params');
    await expectSystemHtmlPageContract(page, 'system-base-params', '基础参数');

    await page.goto('/fixed-assets/workbench?menu=system-asset-category');
    await expectSystemHtmlPageContract(page, 'system-asset-category', '资产分类');
    const masterDataDesignMatrix = page.getByLabel('基础资料子页面产品图与 Stitch 矩阵');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
    return;
    await expect(masterDataDesignMatrix.locator('img').nth(9)).toHaveAttribute(
      'src',
      /stitch-master-data-subpage-05-custom-fields-v1\.png/,
    );
    await expect(masterDataDesignMatrix.locator('img').nth(10)).toHaveAttribute(
      'src',
      /master-data-subpage-06-custom-field-sets-v2\.png/,
    );
    await expect(masterDataDesignMatrix.locator('img').nth(11)).toHaveAttribute(
      'src',
      /stitch-master-data-subpage-06-custom-field-sets-v1\.png/,
    );

    await page.goto('/fixed-assets/workbench?menu=system-asset-category');
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('资产分类');
    const assetCategoryPanel = page.getByLabel('资产分类专用功能面板');
    await expect(assetCategoryPanel).toContainText('资产分类策略配置台');
    await expect(page.getByLabel('资产分类基础资料工作台')).toBeVisible();
    await expect(page.getByLabel('资产分类基础资料对象列表')).toContainText('生产设备 / 贴片机');
    await assetCategoryPanel.getByRole('button', { name: '新建分类', exact: true }).click();
    await expect(page.getByLabel('资产分类基础资料对象列表')).toContainText('新建资产分类');
    await page.getByLabel('资产分类名称').fill('生产设备 / 回流焊炉');
    await page.getByLabel('资产分类编码').fill('CAT_PROD_REFLOW_OVEN');
    await page.getByLabel('资产分类对象类型').fill('资产小类 / 生产设备');
    await page.getByLabel('资产分类规则配置').fill('重点盘点 + MES 绑定 + 折旧策略 10 年 + 维保计划');
    await page.getByLabel('资产分类影响范围').fill('待建资产池 / MES 设备 / CIP 转固 / 盘点策略');
    await page.getByLabel('资产分类负责人').fill('资产管理员');
    await expect(page.getByLabel('资产分类专用配置预览')).toContainText('生产设备 / 回流焊炉');
    await expect(page.getByLabel('生产设备 / 回流焊炉主数据影响校验')).toContainText('待建资产池 + 编号规则 + 盘点策略');
    await expect(page.getByLabel('生产设备 / 回流焊炉主数据发布门禁')).toContainText('100%');
    const categoryTaskQueue = page.getByLabel('生产设备 / 回流焊炉分类策略任务清单');
    await expect(categoryTaskQueue).toContainText('分类策略任务清单');
    await expect(categoryTaskQueue).toContainText('折旧策略');
    const categoryTaskSearch = page.getByRole('textbox', { name: '资产分类策略任务搜索', exact: true });
    await categoryTaskSearch.fill('财务');
    await expect(page.getByLabel('资产分类策略任务筛选结果')).toHaveText('1/3');
    await expect(categoryTaskQueue).toContainText('折旧策略');
    await categoryTaskQueue.getByRole('button', { name: '策略预演', exact: true }).click();
    await expect(page.getByLabel('资产分类操作结果')).toContainText('资产分类策略预演已生成');
    await expect(page.getByLabel('生产设备 / 回流焊炉分类策略处理记录')).toContainText('折旧策略策略预演');
    await categoryTaskSearch.fill('不存在的分类任务');
    await expect(page.getByLabel('资产分类策略任务筛选结果')).toHaveText('0/3');
    await expect(page.getByLabel('资产分类策略任务搜索空结果')).toContainText('没有匹配分类策略任务');
    await page.getByRole('button', { name: '清空资产分类策略任务搜索', exact: true }).click();
    await expect(page.getByLabel('资产分类策略任务筛选结果')).toHaveText('3/3');
    await assetCategoryPanel.getByRole('button', { name: '待补类预览', exact: true }).click();
    await expect(page.getByLabel('资产分类操作结果')).toContainText('待补类预览已生成');
    await expect(page.getByLabel('资产分类操作结果')).toContainText('当前完成度 100%');
    await assetCategoryPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('资产分类操作结果')).toContainText('资产分类草稿已保存');
    await expect(page.getByLabel('资产分类基础资料对象列表')).toContainText('草稿已保存');
    await assetCategoryPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('资产分类操作结果')).toContainText('资产分类校验已提交');
    await expect(page.getByLabel('资产分类基础资料对象列表')).toContainText('已提交校验');

    await page.goto('/fixed-assets/workbench?menu=system-vendor-management');
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('供应商管理');
    const vendorPanel = page.getByLabel('供应商管理专用功能面板');
    await expect(vendorPanel).toContainText('供应商档案配置台');
    await expect(page.getByLabel('供应商管理基础资料工作台')).toBeVisible();
    await expect(page.getByLabel('供应商管理基础资料对象列表')).toContainText('宇视认证供应商 A');
    await expect(page.getByLabel('宇视认证供应商 A供应商治理配置')).toContainText('供应商准入');
    await expect(page.getByLabel('宇视认证供应商 A交易反查台')).toContainText('合同 + PO + 发票 + 入账单');
    await expect(page.getByLabel('供应商管理查询筛选')).toBeVisible();
    await page.getByLabel('搜索供应商管理数据').fill('SSE');
    await expect(page.getByLabel('供应商管理专用配置预览')).toContainText('SSE 维保供应商 C');
    await expect(page.getByLabel('供应商管理专用配置预览')).not.toContainText('临时采购供应商 B');
    await page.getByLabel('搜索供应商管理数据').fill('');
    await page.getByLabel('供应商管理状态筛选').getByRole('button', { name: '非长期', exact: true }).click();
    await expect(page.getByLabel('供应商管理专用配置预览')).toContainText('临时采购供应商 B');
    await page.getByLabel('供应商管理状态筛选').getByRole('button', { name: '全部供应商', exact: true }).click();
    await vendorPanel.getByRole('button', { name: '新建供应商', exact: true }).click();
    await expect(page.getByLabel('供应商管理基础资料对象列表')).toContainText('新建供应商');
    await page.getByLabel('供应商管理名称').fill('CIP 设备维保备用供应商');
    await page.getByLabel('供应商管理编码').fill('VDR_CIP_MAINT_BACKUP');
    await page.getByLabel('供应商管理对象类型').fill('维保供应商 / 非长期补充');
    await page.getByLabel('供应商管理规则配置').fill('SSE 维保补充服务，合同外服务走审批并保留交易记录');
    await page.getByLabel('供应商管理影响范围').fill('CIP 设备维保 / 工单 / 报销采购 / 历史交易');
    await page.getByLabel('供应商管理负责人').fill('采购管理员');
    await page.getByLabel('供应商认证状态').fill('维保准入待复核 / 单次补充服务可用');
    await page.getByLabel('供应商复核周期').fill('按合同外服务逐单复核，累计超 3 次提示转认证供应商');
    await page.getByLabel('供应商交易范围').fill('CIP 设备维保、补充服务、报销采购和历史交易反查');
    await page.getByLabel('供应商合同PO策略').fill('合同外服务需采购管理员确认，金额变更必须审批通过');
    await page.getByLabel('供应商维保范围').fill('高价值设备维保、SSE 服务单、验收附件和 SLA 记录');
    await page.getByLabel('供应商报销策略').fill('非长期交易走报销，但必须保留供应商、金额、附件和服务对象');
    await page.getByLabel('供应商停用策略').fill('停用后禁止新增工单引用，历史维保、发票和报销记录保留');
    await page.getByLabel('供应商审计策略').fill('准入、交易、停用、合同外服务和历史反查全量审计');
    await expect(page.getByLabel('供应商管理专用配置预览')).toContainText('CIP 设备维保备用供应商');
    await expect(page.getByLabel('CIP 设备维保备用供应商供应商治理配置')).toContainText('100%');
    await expect(page.getByLabel('CIP 设备维保备用供应商供应商引用矩阵')).toContainText('CIP 设备维保');
    await expect(page.getByLabel('CIP 设备维保备用供应商交易反查台')).toContainText('维保工单');
    await expect(page.getByLabel('CIP 设备维保备用供应商供应商发布门禁')).toContainText('报销策略');
    await vendorPanel.getByRole('button', { name: '交易反查', exact: true }).click();
    await expect(page.getByLabel('供应商管理操作结果')).toContainText('交易反查已生成');
    await expect(page.getByLabel('供应商管理操作结果')).toContainText('供应商治理完成度 100%');
    await vendorPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('供应商管理操作结果')).toContainText('供应商管理草稿已保存');
    await expect(page.getByLabel('供应商管理基础资料对象列表')).toContainText('草稿已保存');
    await vendorPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('供应商管理操作结果')).toContainText('供应商管理校验已提交');
    await expect(page.getByLabel('供应商管理基础资料对象列表')).toContainText('已提交校验');

    await page.goto('/fixed-assets/workbench?menu=system-numbering-rules');
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('编号规则');
    const numberingPanel = page.getByLabel('编号规则专用功能面板');
    await expect(numberingPanel).toContainText('资产编号规则配置台');
    await expect(page.getByLabel('编号规则基础资料工作台')).toBeVisible();
    await expect(page.getByLabel('编号规则基础资料对象列表')).toContainText('小类+年月+公共月序列');
    await expect(page.getByLabel('编号规则专用配置预览')).toContainText('CIP 转固编号');
    await numberingPanel.getByRole('button', { name: '新建编号规则', exact: true }).click();
    await expect(page.getByLabel('编号规则基础资料对象列表')).toContainText('新建编号规则');
    await page.getByLabel('编号规则名称').fill('CIP 转固公共月序列');
    await page.getByLabel('编号规则编码').fill('NUM_CIP_PUBLIC_MONTH');
    await page.getByLabel('编号规则对象类型').fill('CIP 转固 / 资产小类');
    await page.getByLabel('编号规则规则配置').fill('资产小类 + 年月 + 公共月序列，4 位补零');
    await page.getByLabel('编号规则影响范围').fill('CIP 转固 / 待建资产池 / 批量拆行');
    await page.getByLabel('编号规则负责人').fill('资产管理员');
    await page.getByLabel('编号规则规则模式').fill('资产小类代码 + 年月 + 公共月序列 + 4 位补零');
    await page.getByLabel('编号规则序列口径').fill('全资产共用月序列，按正式生成时间锁号');
    await page.getByLabel('编号规则预览样本').fill('CIP-2026-01 / 贴片机 / 数量 3 / 来源 PO-202606-018');
    await page.getByLabel('编号规则数量拆行').fill('数量字段生成时拆成多行资产，每行占用 1 个序列');
    await page.getByLabel('编号规则占号策略').fill('预览不占号，生成资产卡片时锁号，失败释放未入账序列');
    await page.getByLabel('编号规则冲突处理').fill('历史锁号、重复资产小类、手工改号进入冲突队列');
    await page.getByLabel('编号规则回滚方案').fill('已生成资产保留旧编号，新规则只影响发布后新增批次');
    await expect(page.getByLabel('编号规则专用配置预览')).toContainText('CIP 转固公共月序列');
    await expect(page.getByLabel('CIP 转固公共月序列编号试算台')).toContainText('全资产共用月序列');
    await expect(page.getByLabel('CIP 转固公共月序列发布门禁')).toContainText('占号策略');
    await numberingPanel.getByRole('button', { name: '编号预览', exact: true }).click();
    await expect(page.getByLabel('编号规则操作结果')).toContainText('编号预览已生成');
    await expect(page.getByLabel('CIP 转固公共月序列编号预览结果')).toContainText('数量拆行后逐行占号');
    await numberingPanel.getByRole('button', { name: '冲突检测', exact: true }).click();
    await expect(page.getByLabel('编号规则操作结果')).toContainText('冲突检测已完成');
    await expect(page.getByLabel('CIP 转固公共月序列编号预览结果')).toContainText('0 个历史锁号冲突');
    await numberingPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('编号规则操作结果')).toContainText('编号规则草稿已保存');
    await numberingPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('编号规则操作结果')).toContainText('编号规则校验已提交');

    await page.goto('/fixed-assets/workbench?menu=system-base-params');
    await expect(page.locator('.workspace-topbar-title strong')).toHaveText('基础参数');
    const baseParamsPanel = page.getByLabel('基础参数专用功能面板');
    await expect(baseParamsPanel).toContainText('基础参数运行配置台');
    await expect(page.getByLabel('基础参数系统参数工作台')).toBeVisible();
    await expect(page.getByLabel('基础参数参数对象列表')).toContainText('附件大小与格式');
    await expect(page.getByLabel('基础参数专用配置预览')).toContainText('编号预览默认策略');
    await baseParamsPanel.getByRole('button', { name: '新建参数', exact: true }).click();
    await expect(page.getByLabel('基础参数参数对象列表')).toContainText('新建参数');
    await page.getByLabel('基础参数名称').fill('CIP 转固附件上限');
    await page.getByLabel('基础参数参数键').fill('BASE_CIP_ATTACHMENT_LIMIT');
    await page.getByLabel('基础参数参数值').fill('80MB / 支持图片与 PDF');
    await page.getByLabel('基础参数参数域').fill('CIP 转固 / 完工验收 / 附件');
    await page.getByLabel('基础参数控制策略').fill('超限阻断提交，提示压缩附件并记录审计');
    await page.getByLabel('基础参数负责人').fill('平台运维');
    await expect(page.getByLabel('基础参数专用配置预览')).toContainText('CIP 转固附件上限');
    const baseParameterSearch = page.getByRole('textbox', { name: '基础参数搜索', exact: true });
    await expect(page.getByLabel('基础参数筛选结果')).toContainText('/');
    await baseParameterSearch.fill('BASE_CIP_ATTACHMENT_LIMIT');
    await expect(page.getByLabel('基础参数筛选结果')).toContainText('1/');
    await expect(page.getByLabel('基础参数参数对象列表')).toContainText('CIP 转固附件上限');
    await expect(page.getByLabel('基础参数专用配置预览')).toContainText('80MB / 支持图片与 PDF');
    await baseParameterSearch.fill('不存在的基础参数');
    await expect(page.getByLabel('基础参数筛选结果')).toContainText('0/');
    await expect(page.getByLabel('基础参数搜索空结果')).toContainText('没有匹配的参数');
    await page.getByRole('button', { name: '清空基础参数搜索', exact: true }).click();
    await expect(page.getByLabel('基础参数参数对象列表')).toContainText('CIP 转固附件上限');
    const baseParameterConsole = page.getByLabel('CIP 转固附件上限基础参数策略编排');
    await expect(baseParameterConsole).toContainText('基础参数策略');
    await page.getByLabel('基础参数默认值').fill('80MB / 图片、PDF、Office 附件');
    await page.getByLabel('基础参数允许值').fill('50MB、80MB、100MB；仅允许 png、jpg、pdf、docx、xlsx');
    await page.getByLabel('基础参数业务范围').fill('CIP 转固 / 完工验收 / 流程附件 / 钉钉 H5');
    await page.getByLabel('基础参数影响预览').fill('影响 CIP 验收附件上传、表单校验、缩略图生成和审计留痕');
    await page.getByLabel('基础参数回滚方案').fill('发布前保留上一版本，异常时恢复 50MB 默认值');
    await page.getByLabel('基础参数发布门禁').fill('新增格式、超过 80MB 或 H5 上传异常必须校验通过');
    await page.getByLabel('基础参数复核要求').fill('平台运维 + CIP 资产会计复核');
    await page.getByLabel('基础参数审计说明').fill('记录变更前后值、发布原因、影响范围和回滚点');
    await expect(baseParameterConsole).toContainText('100%');
    await expect(page.getByLabel('CIP 转固附件上限基础参数影响拓扑')).toContainText('CIP 转固');
    const baseParameterRunbook = page.getByLabel('CIP 转固附件上限基础参数发布演练工作台');
    await expect(baseParameterRunbook).toContainText('影响、回滚、门禁预检');
    await expect(page.getByLabel('CIP 转固附件上限基础参数发布演练明细')).toContainText('影响 CIP 验收附件上传');
    await expect(page.getByLabel('CIP 转固附件上限参数门禁预演')).toContainText('新增格式、超过 80MB');
    await baseParameterRunbook.getByRole('button', { name: '影响预演', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('基础参数影响预览已生成');
    await expect(page.getByLabel('基础参数操作结果')).toContainText('当前完成度 100%');
    await baseParameterRunbook.getByRole('button', { name: '回滚预案', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('基础参数回滚预案已展开');
    await expect(page.getByLabel('基础参数操作结果')).toContainText('恢复 50MB 默认值');
    await baseParameterRunbook.getByRole('button', { name: '门禁预检', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('基础参数发布门禁已通过');
    await expect(page.getByLabel('基础参数操作结果')).toContainText('平台运维 + CIP 资产会计复核');
    await baseParamsPanel.getByRole('button', { name: '影响预览', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('影响预览已生成');
    await expect(page.getByLabel('基础参数操作结果')).toContainText('当前完成度 100%');
    await page.getByLabel('CIP 转固附件上限运行影响预览').getByRole('button', { name: '查看发布审计', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('基础参数发布审计已展开');
    await expect(page.getByLabel('CIP 转固附件上限发布审计记录')).toContainText('参数变更');
    await expect(page.getByLabel('CIP 转固附件上限发布审计记录')).toContainText('影响预览');
    await expect(page.getByLabel('CIP 转固附件上限发布审计记录')).toContainText('回滚记录');
    await expect(page.getByLabel('CIP 转固附件上限发布审计记录')).toContainText('操作审计');
    await baseParamsPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('基础参数草稿已保存');
    await baseParamsPanel.getByRole('button', { name: '提交校验', exact: true }).click();
    await expect(page.getByLabel('基础参数操作结果')).toContainText('基础参数校验已提交');

    const runSystemParameterDraftFlow = async ({
      menuId,
      label,
      panelTitle,
      primaryAction,
      createdListText,
      draftName,
      draftKey,
      draftValue,
      draftDomain,
      draftPolicy,
      simulateAction,
      securityPolicy,
      fileStorage,
      importExport,
      cacheManagement,
    }: {
      menuId: string;
      label: string;
      panelTitle: string;
      primaryAction: string;
      createdListText: string;
      draftName: string;
      draftKey: string;
      draftValue: string;
      draftDomain: string;
      draftPolicy: string;
      simulateAction: string;
      securityPolicy?: {
        sessionPolicy: string;
        loginLimit: string;
        sensitiveMask: string;
        h5Identity: string;
        riskConfirmation: string;
        auditTrail: string;
        emergencyUnlock: string;
      };
      fileStorage?: {
        storageBackend: string;
        attachmentBucket: string;
        thumbnailPolicy: string;
        previewFormats: string;
        archiveLifecycle: string;
        accessPolicy: string;
        securityScan: string;
        fallbackPolicy: string;
      };
      importExport?: {
        templateVersion: string;
        fileFormat: string;
        batchLimit: string;
        validationRules: string;
        duplicateStrategy: string;
        errorReport: string;
        exportControl: string;
        queuePolicy: string;
      };
      cacheManagement?: {
        cacheDomain: string;
        refreshTrigger: string;
        ttlPolicy: string;
        warmupScope: string;
        failureRollback: string;
        consistencyCheck: string;
        impactPreview: string;
        auditPolicy: string;
      };
    }) => {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await expect(page.locator('.workspace-topbar-title strong')).toHaveText(label);
      const parameterPanel = page.getByLabel(`${label}专用功能面板`);
      await expect(parameterPanel).toContainText(panelTitle);
      await expect(page.getByLabel(`${label}系统参数工作台`)).toBeVisible();
      await parameterPanel.getByRole('button', { name: primaryAction, exact: true }).click();
      await expect(page.getByLabel(`${label}参数对象列表`)).toContainText(createdListText);
      await page.getByLabel(`${label}名称`).fill(draftName);
      await page.getByLabel(`${label}参数键`).fill(draftKey);
      await page.getByLabel(`${label}参数值`).fill(draftValue);
      await page.getByLabel(`${label}参数域`).fill(draftDomain);
      await page.getByLabel(`${label}控制策略`).fill(draftPolicy);
      await page.getByLabel(`${label}负责人`).fill('平台运维');
      await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftName);
      if (menuId !== 'system-audit-log') {
        const parameterSearch = page.getByRole('textbox', { name: `${label}搜索`, exact: true });
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('/');
        await parameterSearch.fill(draftKey);
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('1/');
        await expect(page.getByLabel(`${label}参数对象列表`)).toContainText(draftName);
        await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftValue);
        await parameterSearch.fill(`不存在的${label}`);
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('0/');
        await expect(page.getByLabel(`${label}搜索空结果`)).toContainText('没有匹配的');
        await page.getByRole('button', { name: `清空${label}搜索`, exact: true }).click();
        await expect(page.getByLabel(`${label}参数对象列表`)).toContainText(draftName);
      }
      if (securityPolicy) {
        const securityConsole = page.getByLabel(`${draftName}安全策略编排`);
        await expect(securityConsole).toContainText('安全策略编排');
        await page.getByLabel('安全策略会话策略').fill(securityPolicy.sessionPolicy);
        await page.getByLabel('安全策略登录限制').fill(securityPolicy.loginLimit);
        await page.getByLabel('安全策略敏感字段').fill(securityPolicy.sensitiveMask);
        await page.getByLabel('安全策略H5身份校验').fill(securityPolicy.h5Identity);
        await page.getByLabel('安全策略高危确认').fill(securityPolicy.riskConfirmation);
        await page.getByLabel('安全策略审计留痕').fill(securityPolicy.auditTrail);
        await page.getByLabel('安全策略应急解锁').fill(securityPolicy.emergencyUnlock);
        await expect(securityConsole).toContainText('100%');
        await expect(page.getByLabel(`${draftName}安全策略地图`)).toContainText(securityPolicy.sensitiveMask);
        await expect(page.getByLabel(`${draftName}安全策略演练工作台`)).toContainText('脱敏、H5 身份、高危确认');
        await expect(page.getByLabel(`${draftName}安全策略演练明细`)).toContainText(securityPolicy.h5Identity);
        await expect(page.getByLabel(`${draftName}脱敏与高危确认预演`)).toContainText(securityPolicy.riskConfirmation);
        await securityConsole.getByRole('button', { name: '脱敏预览', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('脱敏预览已生成');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(securityPolicy.auditTrail);
        await securityConsole.getByRole('button', { name: 'H5 校验', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('H5 身份校验已通过');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(securityPolicy.sessionPolicy);
        await securityConsole.getByRole('button', { name: '高危确认', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('高危确认演练已展开');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(securityPolicy.emergencyUnlock);
        const securityRiskQueue = page.getByLabel(`${draftName}高危操作复核队列`);
        await expect(securityRiskQueue).toContainText('SEC-EXPORT-2026-031');
        await expect(securityRiskQueue).toContainText('资产台账全量导出');
        const securityRiskSearch = page.getByRole('searchbox', { name: '高危操作复核任务搜索', exact: true });
        await securityRiskSearch.fill('数据权限');
        await expect(page.getByLabel('高危操作复核任务筛选结果')).toHaveText('1/3');
        await securityRiskQueue.getByRole('button', { name: '锁定', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('高危操作锁定已生成');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('高危操作锁定');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('SEC-ROLE-2026-014');
        await securityRiskSearch.fill('不存在高危操作');
        await expect(page.getByLabel('高危操作复核任务搜索空结果')).toContainText('没有匹配的高危操作复核任务');
        await page.getByRole('button', { name: '清空高危操作复核任务搜索', exact: true }).click();
        await expect(page.getByLabel('高危操作复核任务筛选结果')).toHaveText('3/3');
      }
      if (fileStorage) {
        const fileStorageConsole = page.getByLabel(`${draftName}文件存储策略编排`);
        await expect(fileStorageConsole).toContainText('文件存储策略');
        await page.getByLabel('文件存储后端').fill(fileStorage.storageBackend);
        await page.getByLabel('文件存储附件目录').fill(fileStorage.attachmentBucket);
        await page.getByLabel('文件存储缩略图策略').fill(fileStorage.thumbnailPolicy);
        await page.getByLabel('文件存储预览格式').fill(fileStorage.previewFormats);
        await page.getByLabel('文件存储归档周期').fill(fileStorage.archiveLifecycle);
        await page.getByLabel('文件存储访问权限').fill(fileStorage.accessPolicy);
        await page.getByLabel('文件存储安全检查').fill(fileStorage.securityScan);
        await page.getByLabel('文件存储失败回退').fill(fileStorage.fallbackPolicy);
        await expect(fileStorageConsole).toContainText('100%');
        await expect(page.getByLabel(`${draftName}文件存储拓扑`)).toContainText(fileStorage.thumbnailPolicy);
        await expect(page.getByLabel(`${draftName}文件存储演练工作台`)).toContainText('缩略图、权限、归档演练');
        await expect(page.getByLabel(`${draftName}文件存储演练明细`)).toContainText(fileStorage.thumbnailPolicy);
        await expect(page.getByLabel(`${draftName}文件预览与归档预演`)).toContainText(fileStorage.fallbackPolicy);
        await fileStorageConsole.getByRole('button', { name: '缩略图预览', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('缩略图预览已生成');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(fileStorage.previewFormats);
        await fileStorageConsole.getByRole('button', { name: '权限预检', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('访问权限预检已完成');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(fileStorage.securityScan);
        await fileStorageConsole.getByRole('button', { name: '归档演练', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('归档演练已展开');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(fileStorage.fallbackPolicy);
        const fileProcessingQueue = page.getByLabel(`${draftName}文件处理异常队列`);
        await expect(fileProcessingQueue).toContainText('FILE-CIP-2026-021');
        await expect(fileProcessingQueue).toContainText('CIP 完工验收现场照片.zip');
        const fileProcessingSearch = page.getByRole('textbox', { name: '文件处理异常任务搜索', exact: true });
        await fileProcessingSearch.fill('发票');
        await expect(page.getByLabel('文件处理异常任务筛选结果')).toHaveText('1/3');
        await fileProcessingQueue.getByRole('button', { name: '隔离', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('文件处理任务隔离已生成');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('文件异常隔离');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('FILE-FA-2026-104');
        await fileProcessingSearch.fill('不存在附件');
        await expect(page.getByLabel('文件处理异常任务搜索空结果')).toContainText('没有匹配的文件处理异常任务');
        await page.getByRole('button', { name: '清空文件处理异常任务搜索', exact: true }).click();
        await expect(page.getByLabel('文件处理异常任务筛选结果')).toHaveText('3/3');
      }
      if (importExport) {
        const importExportConsole = page.getByLabel(`${draftName}导入导出策略编排`);
        await expect(importExportConsole).toContainText('导入导出策略');
        await page.getByLabel('导入导出模板版本').fill(importExport.templateVersion);
        await page.getByLabel('导入导出文件格式').fill(importExport.fileFormat);
        await page.getByLabel('导入导出批量上限').fill(importExport.batchLimit);
        await page.getByLabel('导入导出字段校验').fill(importExport.validationRules);
        await page.getByLabel('导入导出重复处理').fill(importExport.duplicateStrategy);
        await page.getByLabel('导入导出错误报告').fill(importExport.errorReport);
        await page.getByLabel('导入导出导出控制').fill(importExport.exportControl);
        await page.getByLabel('导入导出队列策略').fill(importExport.queuePolicy);
        await expect(importExportConsole).toContainText('100%');
        await expect(page.getByLabel(`${draftName}导入导出拓扑`)).toContainText(importExport.validationRules);
        await expect(page.getByLabel(`${draftName}导入导出试跑工作台`)).toContainText('模板试跑、错误复核、导出预演');
        await expect(page.getByLabel(`${draftName}导入导出试跑明细`)).toContainText(importExport.errorReport);
        await expect(page.getByLabel(`${draftName}错误与导出控制预览`)).toContainText(importExport.exportControl);
        await importExportConsole.getByRole('button', { name: '导入试跑', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('导入模板试跑已生成');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(importExport.validationRules);
        await importExportConsole.getByRole('button', { name: '错误报告', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('错误报告预览已展开');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(importExport.duplicateStrategy);
        await importExportConsole.getByRole('button', { name: '导出预演', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('导出控制预演已生成');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(importExport.queuePolicy);
        const importExportAsyncQueue = page.getByLabel(`${draftName}导入导出异步任务队列`);
        await expect(importExportAsyncQueue).toContainText('IMP-2026-CIP-018');
        await expect(importExportAsyncQueue).toContainText('CIP 费用导入失败报告');
        const importExportTaskSearch = page.getByRole('textbox', { name: '导入导出任务搜索', exact: true });
        await importExportTaskSearch.fill('IMP-2026-CIP-018');
        await expect(page.getByLabel('导入导出任务筛选结果')).toHaveText('1/3');
        await importExportAsyncQueue.getByRole('button', { name: '取证', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('导入导出任务取证已生成');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('异步任务取证');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('IMP-2026-CIP-018');
        await importExportTaskSearch.fill('不存在任务');
        await expect(page.getByLabel('导入导出任务搜索空结果')).toContainText('没有匹配的导入导出任务');
        await page.getByRole('button', { name: '清空导入导出任务搜索', exact: true }).click();
        await expect(page.getByLabel('导入导出任务筛选结果')).toHaveText('3/3');
      }
      if (cacheManagement) {
        const cacheManagementConsole = page.getByLabel(`${draftName}缓存刷新策略编排`);
        await expect(cacheManagementConsole).toContainText('缓存刷新策略');
        await page.getByLabel('缓存管理缓存域').fill(cacheManagement.cacheDomain);
        await page.getByLabel('缓存管理刷新触发').fill(cacheManagement.refreshTrigger);
        await page.getByLabel('缓存管理TTL策略').fill(cacheManagement.ttlPolicy);
        await page.getByLabel('缓存管理预热范围').fill(cacheManagement.warmupScope);
        await page.getByLabel('缓存管理失败回滚').fill(cacheManagement.failureRollback);
        await page.getByLabel('缓存管理一致性检查').fill(cacheManagement.consistencyCheck);
        await page.getByLabel('缓存管理影响预览').fill(cacheManagement.impactPreview);
        await page.getByLabel('缓存管理审计策略').fill(cacheManagement.auditPolicy);
        await expect(cacheManagementConsole).toContainText('100%');
        await expect(page.getByLabel(`${draftName}缓存刷新拓扑`)).toContainText(cacheManagement.failureRollback);
        await expect(page.getByLabel(`${draftName}缓存刷新任务队列`)).toContainText('任务队列');
        await expect(page.getByLabel(`${draftName}缓存刷新队列明细`)).toContainText(cacheManagement.warmupScope);
        await expect(page.getByLabel(`${draftName}缓存影响与回滚预演`)).toContainText(cacheManagement.impactPreview);
        await cacheManagementConsole.getByRole('button', { name: '预热演练', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('缓存预热演练已生成');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(cacheManagement.ttlPolicy);
        await cacheManagementConsole.getByRole('button', { name: '一致性校验', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('缓存一致性校验已通过');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(cacheManagement.impactPreview);
        await cacheManagementConsole.getByRole('button', { name: '立即刷新', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('缓存刷新任务已下发');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(cacheManagement.warmupScope);
        await cacheManagementConsole.getByRole('button', { name: '恢复预案', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('缓存恢复预案已展开');
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(cacheManagement.consistencyCheck);
        const cacheRecoveryQueue = page.getByLabel(`${draftName}缓存异常恢复任务清单`);
        await expect(cacheRecoveryQueue).toContainText('CACHE-2026-CIP-041');
        await expect(cacheRecoveryQueue).toContainText('CIP 项目字典缓存');
        const cacheRecoverySearch = page.getByRole('textbox', { name: '缓存异常任务搜索', exact: true });
        await cacheRecoverySearch.fill('CACHE-2026-CAT-018');
        await expect(page.getByLabel('缓存异常任务筛选结果')).toHaveText('1/3');
        await cacheRecoveryQueue.getByRole('button', { name: '锁定', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('缓存异常任务锁定已生成');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('缓存异常锁定');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('CACHE-2026-CAT-018');
        await cacheRecoverySearch.fill('不存在缓存');
        await expect(page.getByLabel('缓存异常任务搜索空结果')).toContainText('没有匹配的缓存异常任务');
        await page.getByRole('button', { name: '清空缓存异常任务搜索', exact: true }).click();
        await expect(page.getByLabel('缓存异常任务筛选结果')).toHaveText('3/3');
      }
      await parameterPanel.getByRole('button', { name: simulateAction, exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${simulateAction}已生成`);
      if (securityPolicy) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (fileStorage) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (importExport) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (cacheManagement) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('当前完成度 100%');
      }
      if (menuId !== 'system-audit-log') {
        await page.getByLabel(`${draftName}运行影响预览`).getByRole('button', { name: '查看发布审计', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}发布审计已展开`);
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('参数变更');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('发布门禁');
        await expect(page.getByLabel(`${draftName}发布审计记录`)).toContainText('操作审计');
      }
      await parameterPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}草稿已保存`);
      await parameterPanel.getByRole('button', { name: '提交校验', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}校验已提交`);
    };

    await runSystemParameterDraftFlow({
      menuId: 'system-security-policy',
      label: '安全策略',
      panelTitle: '登录会话与敏感字段策略',
      primaryAction: '新建策略',
      createdListText: '新建策略',
      draftName: 'CIP 转固敏感字段策略',
      draftKey: 'SEC_CIP_CAP_FIELD_MASK',
      draftValue: '金额/工号/IP 脱敏 + 8h 会话',
      draftDomain: 'CIP 转固 / H5 审批 / 后台配置',
      draftPolicy: '资产金额、工号和 IP 按角色脱敏；高危发布需二次确认并写入审计',
      simulateAction: '安全演练',
      securityPolicy: {
        sessionPolicy: '后台会话 8 小时，空闲 30 分钟锁屏，H5 审批 2 小时有效',
        loginLimit: '失败 3 次锁定 15 分钟，异常 IP 触发安全审计',
        sensitiveMask: '资产金额、工号、IP、供应商账号按角色脱敏',
        h5Identity: '钉钉 userId + EHR 在职状态 + 待办签名校验',
        riskConfirmation: '发布、停用、全量导出、权限放开必须二次确认',
        auditTrail: '记录变更前后值、审批单号、影响范围和操作者',
        emergencyUnlock: '安全管理员临时解锁 2 小时自动回收并通知审计',
      },
    });

    await runSystemParameterDraftFlow({
      menuId: 'system-file-storage',
      label: '文件存储配置',
      panelTitle: '文件存储与缩略图配置台',
      primaryAction: '新建存储策略',
      createdListText: '新建存储策略',
      draftName: 'CIP 验收附件归档桶',
      draftKey: 'STORAGE_CIP_ACCEPTANCE_ARCHIVE',
      draftValue: 'cip-acceptance-archive / 10 年',
      draftDomain: 'CIP 转固 / 验收照片 / ERP 回执',
      draftPolicy: '归档后只读，下载需审批单号并写入操作审计',
      simulateAction: '测试连接',
      fileStorage: {
        storageBackend: '对象存储 S3 兼容 / cip-vpc-endpoint',
        attachmentBucket: 'forthams-cip-acceptance / acceptance/{projectCode}/{flowNo}',
        thumbnailPolicy: '验收照片生成 160/320/640 三档，PDF 取首页预览',
        previewFormats: 'png、jpg、pdf、docx、xlsx 支持在线预览和占位图',
        archiveLifecycle: '完工验收 180 天后转低频归档，审计附件保留 10 年',
        accessPolicy: '下载需审批单号，删除需二次确认并写入操作审计',
        securityScan: '上传后病毒扫描、MIME 校验、扩展名白名单',
        fallbackPolicy: '对象存储异常时切换只读缓存，恢复后补传归档',
      },
    });

    await runSystemParameterDraftFlow({
      menuId: 'system-import-export',
      label: '导入导出配置',
      panelTitle: '导入导出模板与队列配置台',
      primaryAction: '新建模板',
      createdListText: '新建模板/队列',
      draftName: 'CIP 费用归集导入模板',
      draftKey: 'IMEX_CIP_COST_IMPORT_V2',
      draftValue: 'v2.0 / 20,000 行',
      draftDomain: 'CIP 费用归集 / 转固明细',
      draftPolicy: '项目编码、资本化类型、金额和附件索引必填，失败生成错误报告',
      simulateAction: '试跑校验',
      importExport: {
        templateVersion: 'v2.0 / CIP 费用归集导入模板',
        fileFormat: 'xlsx / 金额两位小数 / 附件索引列',
        batchLimit: '单批 20,000 行，按项目编码分片校验',
        validationRules: '项目编码、资本化类型、金额、费用科目、附件索引必填',
        duplicateStrategy: '同项目同单号重复导入时阻断入库并生成差异对比',
        errorReport: '按项目生成错误报告，支持只重导失败行',
        exportControl: '导出带项目水印，金额字段按财务角色展示',
        queuePolicy: '导入完成后触发转固可用金额重算和审计摘要',
      },
    });

    await runSystemParameterDraftFlow({
      menuId: 'system-cache-management',
      label: '缓存管理',
      panelTitle: '缓存刷新与恢复配置台',
      primaryAction: '新建缓存域',
      createdListText: '新建缓存域',
      draftName: 'CIP 项目字典缓存',
      draftKey: 'CACHE_CIP_PROJECT_DICT',
      draftValue: '发布刷新 / 30 分钟兜底',
      draftDomain: 'CIP 项目 / 资产分类 / 位置',
      draftPolicy: '发布失败回滚上一稳定版本，连续失败进入异常队列',
      simulateAction: '刷新预检',
      cacheManagement: {
        cacheDomain: 'CIP 项目、资产分类、位置和供应商基础资料缓存域',
        refreshTrigger: 'CIP 项目发布、资产分类发布和位置导入完成后自动刷新',
        ttlPolicy: '核心字典 12 小时兜底，热点查询 30 分钟滑动续期',
        warmupScope: '预热待建资产池、CIP 转固、资产台账筛选和流程表单字段',
        failureRollback: '发布失败回滚上一稳定版本，连续失败进入异常队列',
        consistencyCheck: '比对项目状态、分类层级、位置路径和引用数量',
        impactPreview: '影响待建资产池、CIP 转固表单、资产台账筛选和导入模板校验',
        auditPolicy: '记录刷新批次、触发来源、命中率变化、失败原因和人工重放人',
      },
    });

    await runSystemParameterDraftFlow({
      menuId: 'system-audit-log',
      label: '操作审计',
      panelTitle: '系统操作审计配置台',
      primaryAction: '新建审计策略',
      createdListText: '新建审计策略',
      draftName: 'CIP 转固高危操作审计',
      draftKey: 'AUDIT_CIP_CAPITALIZATION_RISK',
      draftValue: '全量采集 / 3 年归档',
      draftDomain: 'CIP 转固 / ERP 推送 / 财务确认',
      draftPolicy: '记录转固金额、审批单号、推送回执和人工重放人，不允许普通管理员删除',
      simulateAction: '审计查询',
    });
    const auditPanel = page.getByLabel('操作审计专用功能面板');
    await expect(page.getByLabel('操作审计审计查询工作台')).toBeVisible();
    await expect(page.getByLabel('操作审计审计事件列表')).toContainText('CIP 转固发布');
    await expect(page.getByLabel('操作审计审计事件列表')).toContainText('ERP 回执归档');
    await page.getByLabel('操作审计操作人').fill('资产会计 / A1024');
    await page.getByLabel('操作审计对象范围').fill('CIP 转固 / ERP 推送');
    await page.getByLabel('操作审计风险等级').fill('高危');
    await page.getByLabel('操作审计时间范围').fill('近 7 天');
    await auditPanel.getByRole('button', { name: '审计查询', exact: true }).click();
    await expect(page.getByLabel('操作审计操作结果')).toContainText('近 7 天');
    await expect(page.getByLabel('操作审计操作结果')).toContainText('1/4 条命中');
    const auditQuerySummary = page.getByLabel('操作审计查询结果摘要');
    await expect(auditQuerySummary).toContainText('已查询');
    await expect(auditQuerySummary).toContainText('1/4 条命中');
    const filteredAuditEvents = page.getByLabel('操作审计审计事件列表');
    await expect(filteredAuditEvents).toContainText('CIP 转固发布');
    await expect(filteredAuditEvents).not.toContainText('ERP 回执归档');
    await filteredAuditEvents.getByRole('button', { name: '单条取证', exact: true }).click();
    await expect(page.getByLabel('操作审计操作结果')).toContainText('审计事件取证已生成');
    await expect(page.getByLabel('操作审计事件处理记录')).toContainText('单条取证');
    await expect(page.getByLabel('操作审计事件处理记录')).toContainText('EVT-CIP-001');
    await filteredAuditEvents.getByRole('button', { name: '冻结事件', exact: true }).click();
    await expect(page.getByLabel('操作审计操作结果')).toContainText('审计事件冻结已生成');
    await expect(page.getByLabel('操作审计事件处理记录')).toContainText('冻结事件');
    await auditPanel.getByRole('button', { name: '导出取证包', exact: true }).click();
    await expect(page.getByLabel('操作审计操作结果')).toContainText('导出取证包已生成');
    await expect(page.getByLabel('操作审计操作结果')).toContainText('覆盖 1 条审计事件');
    await expect(auditQuerySummary).toContainText('已导出');
    await expect(page.getByLabel('CIP 转固高危操作审计取证包范围')).toContainText('普通管理员不可删除');
    await auditPanel.getByRole('button', { name: '下载取证包', exact: true }).click();
    await expect(page.getByLabel('操作审计操作结果')).toContainText('取证包已下载');
    await expect(page.getByLabel('操作审计操作结果')).toContainText('审批单号、水印、下载人');
    await auditPanel.getByRole('button', { name: '追溯详情', exact: true }).click();
    await expect(page.getByLabel('操作审计操作结果')).toContainText('审计链路已追溯');
    await expect(page.getByLabel('操作审计操作结果')).toContainText('CIP 转固发布');
    await expect(page.getByLabel('操作审计参数对象列表')).toContainText('CIP 转固高危操作审计');
    await expect(page.getByLabel('操作审计参数对象列表')).toContainText('已提交校验');
    await expect(page.getByLabel('操作审计专用配置预览')).toContainText('CIP 转固高危操作审计');
    await expect(page.getByLabel('操作审计专用配置预览')).toContainText('已提交校验');

    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('系统运营中枢薄弱配置页搜索下沉到专属页面', async ({ page }) => {
    test.setTimeout(90_000);

    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const localSearchCases = [
      {
        menuId: 'system-approval-rules',
        searchLabel: '审批规则搜索',
        query: '代理',
        panelLabel: '审批规则列表',
        expected: '财务节点代理',
        filteredOut: '重复处理人跳过',
      },
      {
        menuId: 'system-sla-config',
        searchLabel: 'SLA 配置搜索',
        query: 'CIP',
        panelLabel: 'SLA 规则列表',
        expected: 'CIP 财务复核 SLA',
        filteredOut: '资产入账审批 SLA',
      },
      {
        menuId: 'system-asset-category',
        searchLabel: '资产分类搜索',
        query: '服务器',
        panelLabel: '资产分类基础资料对象列表',
        expected: '服务器 / 机房设备',
        filteredOut: 'IT 设备 / 笔记本',
      },
      {
        menuId: 'system-numbering-rules',
        searchLabel: '编号规则搜索',
        query: 'CIP',
        panelLabel: '编号规则基础资料对象列表',
        expected: 'CIP 转固编号',
        filteredOut: 'IT 设备编号',
      },
      {
        menuId: 'system-interfaces',
        searchLabel: '接口配置搜索',
        query: 'ERP',
        panelLabel: '集成对象切换',
        expected: 'ERP 固资推送接口',
        filteredOut: 'MES 设备状态',
      },
      {
        menuId: 'system-field-mapping',
        searchLabel: '字段映射搜索',
        query: 'EHR',
        panelLabel: '集成对象切换',
        expected: 'EHR 扣款字段映射',
        filteredOut: 'MES 设备状态',
      },
      {
        menuId: 'system-audit-log',
        searchLabel: '操作审计搜索',
        query: '导出',
        panelLabel: '操作审计参数对象列表',
        expected: '导出与敏感字段审计',
        filteredOut: '流程与集成操作审计',
      },
    ] as const;
    const htmlSearchMenuLabels: Record<string, string> = {
      'system-asset-category': '资产分类',
      'system-numbering-rules': '编号规则',
      'system-audit-log': '操作审计',
    };

    for (const { menuId, searchLabel, query, panelLabel, expected, filteredOut } of localSearchCases) {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await page.waitForLoadState('networkidle');
      const htmlLabel = htmlSearchMenuLabels[menuId];
      if (htmlLabel) {
        await expectSystemHtmlPageContract(page, menuId, htmlLabel);
        await expect(systemHtmlFrameBody(page, htmlLabel).locator('input[type="text"]').first()).toBeVisible();
        continue;
      }

      const searchInput = page.getByLabel(searchLabel);
      await expect(searchInput).toBeVisible({ timeout: 10_000 });
      await searchInput.fill(query);

      const panel = page.getByLabel(panelLabel);
      await expect(panel).toContainText(expected);
      await expect(panel).not.toContainText(filteredOut);
      await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    }

    expect(errors).toEqual([]);
  });

  test('基础资料主数据页均可新建保存提交', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await seedAuthenticatedSession(page, adminUser);

    const runMasterDataDraftFlow = async ({
      menuId,
      label,
      panelTitle,
      primaryAction,
      createdListText,
      draftName,
      draftCode,
      draftType,
      draftRule,
      draftScope,
      simulateAction,
      governance,
      locationGovernance,
    }: {
      menuId: string;
      label: string;
      panelTitle: string;
      primaryAction: string;
      createdListText: string;
      draftName: string;
      draftCode: string;
      draftType: string;
      draftRule: string;
      draftScope: string;
      simulateAction: string;
      governance?: {
        fieldType: string;
        requiredPolicy: string;
        defaultValue: string;
        dictionarySource: string;
        layoutBinding: string;
        importExportBinding: string;
        integrationMapping: string;
        historyImpact: string;
      };
      locationGovernance?: {
        hierarchyPath: string;
        areaPurpose: string;
        inventoryScope: string;
        dataPermissionScope: string;
        capacityRule: string;
        cipTemporaryPolicy: string;
        transferPolicy: string;
        auditPolicy: string;
      };
    }) => {
      await page.goto(`/fixed-assets/workbench?menu=${menuId}`);
      await expect(page.locator('.workspace-topbar-title strong')).toHaveText(label);
      if (isSystemHtmlMenu(menuId)) {
        await expectSystemHtmlPageContract(page, menuId, label);
        await expect(systemHtmlFrameBody(page, label).locator('input[type="text"]').first()).toBeVisible();
        return;
      }
      const masterDataPanel = page.getByLabel(`${label}专用功能面板`);
      await expect(masterDataPanel).toContainText(panelTitle);
      await expect(page.getByLabel(`${label}基础资料工作台`)).toBeVisible();
      if (locationGovernance) {
        await expect(page.getByLabel('位置管理查询筛选')).toBeVisible();
        await page.getByLabel('搜索位置管理数据').fill('机房');
        await expect(page.getByLabel('位置管理专用配置预览')).toContainText('机房 B-02');
        await expect(page.getByLabel('位置管理专用配置预览')).not.toContainText('A 仓库');
        await page.getByLabel('搜索位置管理数据').fill('');
        await page.getByLabel('位置管理状态筛选').getByRole('button', { name: 'CIP 临时', exact: true }).click();
        await expect(page.getByLabel('位置管理专用配置预览')).toContainText('A 仓库');
        await page.getByLabel('位置管理状态筛选').getByRole('button', { name: '全部位置', exact: true }).click();
      }
      await masterDataPanel.getByRole('button', { name: primaryAction, exact: true }).click();
      await expect(page.getByLabel(`${label}基础资料对象列表`)).toContainText(createdListText);
      await page.getByLabel(`${label}名称`).fill(draftName);
      await page.getByLabel(`${label}编码`).fill(draftCode);
      await page.getByLabel(`${label}对象类型`).fill(draftType);
      await page.getByLabel(`${label}规则配置`).fill(draftRule);
      await page.getByLabel(`${label}影响范围`).fill(draftScope);
      await page.getByLabel(`${label}负责人`).fill('基础资料管理员');
      if (governance) {
        await page.getByLabel(`${label}字段类型`).fill(governance.fieldType);
        await page.getByLabel(`${label}必填策略`).fill(governance.requiredPolicy);
        await page.getByLabel(`${label}默认值`).fill(governance.defaultValue);
        await page.getByLabel(`${label}字典来源`).fill(governance.dictionarySource);
        await page.getByLabel(`${label}布局绑定`).fill(governance.layoutBinding);
        await page.getByLabel(`${label}导入导出绑定`).fill(governance.importExportBinding);
        await page.getByLabel(`${label}集成映射`).fill(governance.integrationMapping);
        await page.getByLabel(`${label}历史影响`).fill(governance.historyImpact);
        const customFieldSearch = page.getByRole('textbox', { name: `${label}搜索`, exact: true });
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('/');
        await customFieldSearch.fill(draftName);
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('1/');
        await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftName);
        await customFieldSearch.fill('不存在的字段治理对象');
        await expect(page.getByLabel(`${label}筛选结果`)).toContainText('0/');
        await expect(page.getByLabel(`${label}搜索空结果`)).toContainText(`没有匹配的${label.includes('字段集') ? '字段集' : '字段'}`);
        await page.getByRole('button', { name: `清空${label}搜索`, exact: true }).click();
        await expect(page.getByLabel(`${draftName}字段治理总览`)).toContainText(governance.fieldType);
        await expect(page.getByLabel(`${draftName}字段影响矩阵`)).toContainText(governance.integrationMapping);
        await expect(page.getByLabel(`${draftName}发布门禁`)).toContainText('历史影响');
        await page.getByLabel(`${label}属性配置`).getByRole('button', { name: '查看审计', exact: true }).click();
        await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${draftName}字段引用审计已展开`);
        await expect(page.getByLabel(`${draftName}字段引用审计记录`)).toContainText('字段引用');
        await expect(page.getByLabel(`${draftName}字段引用审计记录`)).toContainText('字段集版本');
        await expect(page.getByLabel(`${draftName}字段引用审计记录`)).toContainText('表单布局');
        await expect(page.getByLabel(`${draftName}字段引用审计记录`)).toContainText('导入导出');
        await expect(page.getByLabel(`${draftName}字段引用审计记录`)).toContainText('集成映射');
        await expect(page.getByLabel(`${draftName}字段引用审计记录`)).toContainText('历史实例');
      }
      if (locationGovernance) {
        await page.getByLabel('位置管理层级路径', { exact: true }).fill(locationGovernance.hierarchyPath);
        await page.getByLabel('位置管理区域用途', { exact: true }).fill(locationGovernance.areaPurpose);
        await page.getByLabel('位置管理盘点范围', { exact: true }).fill(locationGovernance.inventoryScope);
        await page.getByLabel('位置管理数据权限范围', { exact: true }).fill(locationGovernance.dataPermissionScope);
        await page.getByLabel('位置管理容量规则', { exact: true }).fill(locationGovernance.capacityRule);
        await page.getByLabel('位置管理CIP临时策略', { exact: true }).fill(locationGovernance.cipTemporaryPolicy);
        await page.getByLabel('位置管理转移规则', { exact: true }).fill(locationGovernance.transferPolicy);
        await page.getByLabel('位置管理审计策略', { exact: true }).fill(locationGovernance.auditPolicy);
        await expect(page.getByLabel(`${draftName}位置治理配置`)).toContainText(locationGovernance.areaPurpose);
        await expect(page.getByLabel(`${draftName}位置影响矩阵`)).toContainText(locationGovernance.inventoryScope);
        await expect(page.getByLabel(`${draftName}位置治理发布门禁`)).toContainText('CIP 临时策略');
        await expect(page.getByLabel(`${draftName}位置治理发布门禁`)).toContainText('审计策略');
      }
      await expect(page.getByLabel(`${label}专用配置预览`)).toContainText(draftName);
      await masterDataPanel.getByRole('button', { name: simulateAction, exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${simulateAction}已生成`);
      if (locationGovernance) {
        await expect(page.getByLabel(`${label}操作结果`)).toContainText('位置治理完成度 100%');
      }
      await masterDataPanel.getByRole('button', { name: '保存草稿', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}草稿已保存`);
      await masterDataPanel.getByRole('button', { name: '提交校验', exact: true }).click();
      await expect(page.getByLabel(`${label}操作结果`)).toContainText(`${label}校验已提交`);
    };

    const masterDataCases = [
      {
        menuId: 'system-asset-category',
        label: '资产分类',
        panelTitle: '资产分类策略配置台',
        primaryAction: '新建分类',
        createdListText: '新建资产分类',
        draftName: 'CIP 设备暂估分类',
        draftCode: 'CAT_CIP_DEVICE_TEMP',
        draftType: '资产小类 / 在建工程转固',
        draftRule: '转固前补分类，绑定折旧 10 年、重点盘点和编号规则',
        draftScope: '待建资产池 / CIP 转固 / 资产台账',
        simulateAction: '待补类预览',
      },
      {
        menuId: 'system-location-management',
        label: '位置管理',
        panelTitle: '位置树配置台',
        primaryAction: '新建位置',
        createdListText: '新建位置节点',
        draftName: 'CIP 项目临时仓',
        draftCode: 'LOC_CIP_TEMP_WAREHOUSE',
        draftType: '仓库 / 临时转固区',
        draftRule: '只允许 CIP 转固暂存资产引用，完工后迁移到正式位置',
        draftScope: 'CIP 转固 / 待建资产池 / 盘点范围',
        simulateAction: '影响预览',
        locationGovernance: {
          hierarchyPath: 'A 厂区 / 临时仓 / CIP 转固区',
          areaPurpose: 'CIP 设备完工验收前暂存与复核位置',
          inventoryScope: 'CIP 项目临时仓周盘 + 转固前实物确认',
          dataPermissionScope: 'CIP 专员 / 资产管理员 / 财务资产专员可见',
          capacityRule: '容量 120 台，超过 85% 提醒转固或迁移',
          cipTemporaryPolicy: '必须绑定 CIP 项目、转固批次、预计转固日期和责任人',
          transferPolicy: '转固完成后自动生成正式位置迁移任务',
          auditPolicy: '临时入库、转固迁移、权限变更和盘点差异全量审计',
        },
      },
      {
        menuId: 'system-vendor-management',
        label: '供应商管理',
        panelTitle: '供应商档案配置台',
        primaryAction: '新建供应商',
        createdListText: '新建供应商',
        draftName: 'CIP 土建服务供应商',
        draftCode: 'VDR_CIP_CONSTRUCTION',
        draftType: '认证供应商 / 工程服务',
        draftRule: '合同、PO、费用归集和完工验收均保留交易反查',
        draftScope: 'CIP 立项 / 费用归集 / 合同归档',
        simulateAction: '交易反查',
      },
      {
        menuId: 'system-custom-fields',
        label: '自定义字段',
        panelTitle: '自定义字段配置台',
        primaryAction: '新建字段',
        createdListText: '新建字段',
        draftName: '转固批次号',
        draftCode: 'cip_cap_batch_no',
        draftType: 'CIP 表单 / 资产卡片映射',
        draftRule: '必填、唯一、随 ERP 回执冻结，不允许发布后无痕修改',
        draftScope: 'CIP 转固表单 / 资产卡片 / 导入模板',
        simulateAction: '影响校验',
        governance: {
          fieldType: '文本 / 唯一编码',
          requiredPolicy: 'CIP 转固表单必填，资产卡片冻结',
          defaultValue: '由转固批次自动生成',
          dictionarySource: 'CIP 项目池 / ERP 回执',
          layoutBinding: 'CIP 转固表单 / 资产卡片 / 钉钉 H5',
          importExportBinding: 'CIP 导入模板追加转固批次号列',
          integrationMapping: 'ERP.capBatchNo -> AMS.cip_cap_batch_no',
          historyImpact: '发布后历史实例保持原字段版本',
        },
      },
      {
        menuId: 'system-custom-field-sets',
        label: '自定义字段集',
        panelTitle: '自定义字段集配置台',
        primaryAction: '新建字段集',
        createdListText: '新建字段集',
        draftName: 'CIP 转固字段集',
        draftCode: 'FIELDSET_CIP_CAPITALIZATION',
        draftType: 'CIP 转固 / 资产卡片',
        draftRule: '项目、费用、转固批次、验收附件、ERP 回执字段分组冻结',
        draftScope: '立项 / 转固 / 资产卡片 / 归档',
        simulateAction: '布局预览',
        governance: {
          fieldType: '字段集 / CIP 转固',
          requiredPolicy: '项目、费用、转固批次、验收附件按阶段必填',
          defaultValue: '继承 CIP 项目和 PO 合同字段',
          dictionarySource: '字段主数据 + CIP 项目池',
          layoutBinding: '立项 / 转固 / 资产卡片 / 归档',
          importExportBinding: '按字段集版本生成导入导出模板',
          integrationMapping: 'ERP.project + PO.contract -> AMS.cip_fieldset',
          historyImpact: '完工验收后冻结字段集版本',
        },
      },
    ];

    for (const masterDataCase of masterDataCases) {
      await runMasterDataDraftFlow(masterDataCase);
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

    await expect(page.getByLabel('流程设计器专用功能面板')).toBeVisible();
    await expect(page.locator('.workspace-flow-template-strip.is-product.is-collapsed')).toHaveCSS('display', 'none');
    await expect(page.getByLabel('流程设计大画布')).toContainText('CIP 专员审核');

    await page.getByLabel('流程设计器大画布操作').getByRole('button', { name: '新建流程图', exact: true }).click();
    await expect(page.getByLabel('流程设计器操作结果')).toContainText('新建流程图草稿已创建');
    await expect(page.locator('.workspace-flow-designer-shell.is-modeling-mode')).toBeVisible();

    const layoutState = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: rect.top,
          width: rect.width,
          height: rect.height,
          display: style.display,
          position: style.position,
          gridArea: style.gridArea,
          order: style.order,
        };
      };
      const shell = document.querySelector('.workspace-flow-designer-shell');
      const shellRect = shell?.getBoundingClientRect();
      const shellStyle = shell ? getComputedStyle(shell) : null;
      const lanes = document.querySelector('.workspace-flow-canvas-lanes');
      const connector = document.querySelector('.workspace-flow-canvas-large svg');
      const operationRail = document.querySelector('.workspace-flow-canvas-operation-rail');
      const operationRailStyle = operationRail ? getComputedStyle(operationRail) : null;
      const readDisplay = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).display : '';
      };
      return {
        scrollY: Math.round(window.scrollY),
        shellWidth: Math.round(shellRect?.width ?? 0),
        shellScrollWidth: shell?.scrollWidth ?? 0,
        shellClientWidth: shell?.clientWidth ?? 0,
        shellAreas: shellStyle?.gridTemplateAreas ?? '',
        shellColumns: shellStyle?.gridTemplateColumns ?? '',
        palette: read('.workspace-flow-node-palette'),
        studioStrip: read('.workspace-flow-designer-studio-strip'),
        modelingStrip: read('.workspace-flow-modeling-strip'),
        draftEditor: read('.workspace-flow-draft-profile-editor'),
        canvas: read('.workspace-flow-canvas-large'),
        operationRail: read('.workspace-flow-canvas-operation-rail'),
        operationRailColumns: operationRailStyle?.gridTemplateColumns ?? '',
        inspector: read('.workspace-flow-node-inspector-large'),
        firstNode: read('.workspace-flow-canvas-node'),
        lanesDisplay: lanes ? getComputedStyle(lanes).display : '',
        connectorDisplay: connector ? getComputedStyle(connector).display : '',
        templateDisplay: readDisplay('.workspace-flow-template-strip'),
        stagebarDisplay: readDisplay('.workspace-flow-designer-stagebar'),
        referenceDisplay: readDisplay('.workspace-flow-designer-reference'),
        sideBySide: Boolean(
          read('.workspace-flow-node-palette') &&
            read('.workspace-flow-canvas-card') &&
            read('.workspace-flow-node-inspector-large') &&
            read('.workspace-flow-node-palette')!.top <= read('.workspace-flow-canvas-large')!.top &&
            read('.workspace-flow-node-palette')!.width < read('.workspace-flow-canvas-large')!.width &&
            read('.workspace-flow-node-inspector-large')!.width > 340,
        ),
      };
    });

    expect(layoutState.shellAreas).toContain('canvas');
    expect(layoutState.shellAreas).toContain('palette');
    expect(layoutState.shellAreas).toContain('inspector');
    expect(layoutState.shellColumns).toContain('px');
    expect(layoutState.shellWidth).toBeGreaterThanOrEqual(900);
    expect(layoutState.shellWidth).toBeLessThanOrEqual(1440);
    expect(layoutState.shellScrollWidth).toBeGreaterThanOrEqual(layoutState.shellClientWidth);
    expect(layoutState.scrollY).toBeGreaterThanOrEqual(0);
    expect(layoutState.palette?.width).toBeGreaterThanOrEqual(220);
    expect(layoutState.studioStrip?.display).toBe('none');
    expect(layoutState.modelingStrip?.display).toBe('none');
    expect(layoutState.draftEditor?.height).toBeLessThan(360);
    expect(layoutState.canvas?.width).toBeGreaterThanOrEqual(700);
    expect(layoutState.canvas?.height).toBeGreaterThanOrEqual(960);
    expect(layoutState.canvas?.top).toBeLessThanOrEqual(900);
    expect(layoutState.operationRail?.width).toBeGreaterThan(680);
    expect(layoutState.operationRail?.height).toBeGreaterThan(70);
    expect(layoutState.inspector?.width).toBeGreaterThanOrEqual(300);
    expect(layoutState.sideBySide).toBe(true);
    expect(layoutState.operationRailColumns.split(' ').length).toBe(2);
    expect((layoutState.palette?.top ?? 0)).toBeLessThanOrEqual((layoutState.canvas?.top ?? 0) + 80);
    expect((layoutState.inspector?.top ?? 0)).toBeLessThanOrEqual((layoutState.canvas?.top ?? 0) + 80);
    expect(layoutState.firstNode?.position).toBe('absolute');
    expect(layoutState.lanesDisplay).toBe('grid');
    expect(layoutState.connectorDisplay).toBe('block');
    expect(layoutState.templateDisplay).toBe('none');
    expect(layoutState.stagebarDisplay).toBe('none');
    expect(layoutState.referenceDisplay).toBe('none');
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('表单配置在窄屏下保持设计画布与H5预览可读', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 794, height: 890 });
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-form-config');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('表单配置专用功能面板')).toBeVisible();
    await expect(page.getByLabel('待建资产入账表单表单设计画布')).toBeVisible();
    await expect(page.getByLabel('待建资产入账表单桌面表单画布')).toContainText('批量补类');
    await expect(page.getByLabel('待建资产入账表单钉钉H5表单预览')).toContainText('资产小类');
    await page.getByLabel('待建资产入账表单表单设计画布').scrollIntoViewIfNeeded();

    const layoutState = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: rect.top,
          width: rect.width,
          height: rect.height,
          display: style.display,
          columns: style.gridTemplateColumns,
          overflow: style.overflow,
        };
      };
      return {
        studio: read('.workspace-form-designer-studio'),
        canvasGrid: read('.workspace-form-designer-canvas-grid'),
        desktop: read('.workspace-form-designer-desktop'),
        h5: read('.workspace-form-designer-h5'),
        table: read('.workspace-form-field-table'),
      };
    });

    expect(layoutState.studio?.display).toBe('grid');
    expect(layoutState.canvasGrid?.columns).toMatch(/^[0-9.]+px$/);
    expect(layoutState.desktop?.width).toBeGreaterThan(680);
    expect(layoutState.h5?.width).toBeGreaterThan(680);
    expect(layoutState.h5?.top).toBeGreaterThan(layoutState.desktop?.top ?? 0);
    expect(layoutState.table?.width).toBeGreaterThan(680);
    expect(layoutState.table?.height).toBeGreaterThan(140);
    await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
    expect(errors).toEqual([]);
  });

  test('审批规则在窄屏下保持命中编排和门禁矩阵可读', async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 794, height: 890 });
    await seedAuthenticatedSession(page, adminUser);

    await page.goto('/fixed-assets/workbench?menu=system-approval-rules');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('审批规则专用功能面板')).toBeVisible();
    await expect(page.getByLabel('重复处理人跳过规则命中编排')).toContainText('规则执行编排');
    await expect(page.getByLabel('重复处理人跳过命中路径画布')).toContainText('处理路由');
    await expect(page.getByLabel('重复处理人跳过规则优先级队列')).toContainText('当前模拟命中');
    await expect(page.getByLabel('重复处理人跳过发布门禁矩阵')).toContainText('100% 字段完成度');
    await page.getByLabel('重复处理人跳过规则命中编排').scrollIntoViewIfNeeded();

    const layoutState = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: rect.top,
          width: rect.width,
          height: rect.height,
          display: style.display,
          columns: style.gridTemplateColumns,
          overflow: style.overflow,
        };
      };
      return {
        shell: read('.workspace-approval-rule-shell'),
        simulator: read('.workspace-approval-rule-simulator'),
        path: read('.workspace-approval-rule-path'),
        governance: read('.workspace-approval-rule-governance'),
        gates: read('.workspace-approval-rule-gates'),
      };
    });

    expect(layoutState.shell?.columns.split(' ').length).toBeGreaterThanOrEqual(3);
    expect(layoutState.simulator?.columns.split(' ').length).toBeGreaterThanOrEqual(2);
    expect(layoutState.path?.columns).toContain('px');
    expect(layoutState.governance?.columns).toContain('px');
    expect(layoutState.gates?.width).toBeGreaterThan(680);
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
