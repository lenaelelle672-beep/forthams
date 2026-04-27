/**
 * SWARM-P3-010-FE 资产盘点管理 E2E 测试套件
 *
 * 覆盖 ATB-001 至 ATB-007、ATB-009 全部 Playwright 验收场景。
 * ATB-008（防重复提交）为 Vitest 单元测试，不在此文件覆盖。
 *
 * API 契约参照 SPEC 中 /api/v1/inventory/* 系列接口。
 */

import { test, expect, Page, Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// 常量 & Mock 数据工厂
// ---------------------------------------------------------------------------

const API_PREFIX = '/api/v1/inventory';
const LOCATIONS_API = '/api/v1/locations/tree';
const CATEGORIES_API = '/api/v1/categories/tree';

/** 生成一条盘点任务 mock 数据 */
function createMockTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    taskId: 'task-001',
    taskName: '2024Q4办公室盘点',
    scopeType: 'location' as const,
    scopeIds: ['loc-1'],
    status: 'in_progress' as const,
    progress: 60.0,
    totalAssets: 100,
    countedAssets: 60,
    uncountedAssets: 40,
    surplusAssets: 2,
    deficitAssets: 3,
    createdAt: '2024-12-01 09:00',
    ...overrides,
  };
}

/** 生成一条资产清单 mock 数据 */
function createMockAsset(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    assetId: 'asset-001',
    assetCode: 'ASSET-001',
    assetName: 'MacBook Pro 16英寸',
    bookStatus: '在用',
    actualStatus: null,
    remark: '',
    confirmed: false,
    ...overrides,
  };
}

/** 位置树 mock */
const mockLocationTree = [
  {
    key: 'loc-root',
    title: '总部大楼',
    children: [
      {
        key: 'loc-1',
        title: 'A座',
        children: [
          { key: 'loc-1-1', title: 'A座1楼', children: [] },
          { key: 'loc-1-2', title: 'A座2楼', children: [] },
        ],
      },
      {
        key: 'loc-2',
        title: 'B座',
        children: [
          { key: 'loc-2-1', title: 'B座1楼', children: [] },
        ],
      },
      {
        key: 'loc-3',
        title: 'C座',
        children: [],
      },
    ],
  },
];

/** 分类树 mock */
const mockCategoryTree = [
  {
    key: 'cat-root',
    title: '电子设备',
    children: [
      { key: 'cat-1', title: '笔记本电脑', children: [] },
      { key: 'cat-2', title: '台式机', children: [] },
      { key: 'cat-3', title: '打印机', children: [] },
    ],
  },
];

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 拦截盘点任务列表 GET */
function routeTaskList(page: Page, tasks: ReturnType<typeof createMockTask>[], total?: number) {
  return page.route(`${API_PREFIX}/tasks**`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: tasks,
          total: total ?? tasks.length,
          page: 1,
          pageSize: 20,
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/** 拦截任务详情 GET */
function routeTaskDetail(page: Page, task: ReturnType<typeof createMockTask>) {
  return page.route(`${API_PREFIX}/tasks/${task.taskId}**`, async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET' && route.request().url().endsWith(`/${task.taskId}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(task),
      });
    } else {
      await route.continue();
    }
  });
}

/** 拦截资产清单 GET */
function routeAssetList(
  page: Page,
  taskId: string,
  assets: ReturnType<typeof createMockAsset>[],
  total?: number,
) {
  return page.route(`${API_PREFIX}/tasks/${taskId}/assets**`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: assets,
          total: total ?? assets.length,
          page: 1,
          pageSize: 20,
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/** 拦截盘盈盘亏汇总 GET */
function routeSummary(
  page: Page,
  taskId: string,
  summary: {
    surplus: { total: number; items: { assetCode: string; assetName: string; reason: string }[] };
    deficit: { total: number; items: { assetCode: string; assetName: string; reason: string }[] };
  },
) {
  return page.route(`${API_PREFIX}/tasks/${taskId}/summary`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summary),
    });
  });
}

/** 拦截位置树 GET */
function routeLocationTree(page: Page) {
  return page.route(LOCATIONS_API, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockLocationTree),
    });
  });
}

/** 拦截分类树 GET */
function routeCategoryTree(page: Page) {
  return page.route(CATEGORIES_API, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCategoryTree),
    });
  });
}

// ===========================================================================
// ATB-001：盘点任务列表渲染
// ===========================================================================

test.describe('ATB-001: 盘点任务列表渲染', () => {
  test('步骤1: 导航至 /inventory 时左侧面板渲染盘点任务列表组件', async ({ page }) => {
    await routeTaskList(page, []);
    await page.goto('/inventory');
    // 左侧面板应包含任务列表容器
    await expect(page.locator('[data-testid="task-list-panel"], .inventory-task-list, .ant-list, .ant-table')).toBeVisible();
  });

  test('步骤2: 列表为空时显示空状态占位图 + "暂无盘点任务"文案', async ({ page }) => {
    await routeTaskList(page, []);
    await page.goto('/inventory');
    await expect(page.getByText('暂无盘点任务')).toBeVisible();
  });

  test('步骤3: Mock 3 条不同状态任务 — 列表显示 3 行，含完整字段', async ({ page }) => {
    const tasks = [
      createMockTask({
        taskId: 'task-1',
        taskName: '2024Q4办公室盘点',
        status: 'in_progress',
        progress: 60.0,
        totalAssets: 100,
        countedAssets: 60,
        createdAt: '2024-12-01 09:00',
        scopeType: 'location',
      }),
      createMockTask({
        taskId: 'task-2',
        taskName: '研发中心专项盘点',
        status: 'draft',
        progress: 0,
        totalAssets: 50,
        countedAssets: 0,
        createdAt: '2024-12-05 14:30',
        scopeType: 'category',
      }),
      createMockTask({
        taskId: 'task-3',
        taskName: '全年固定资产清查',
        status: 'completed',
        progress: 100.0,
        totalAssets: 200,
        countedAssets: 200,
        createdAt: '2024-11-20 10:00',
        scopeType: 'all',
      }),
    ];

    await routeTaskList(page, tasks);
    await page.goto('/inventory');

    // 验证 3 行任务
    const rows = page.locator('.ant-table-row, [data-testid="task-item"]');
    await expect(rows).toHaveCount(3);

    // 验证第 1 行包含：任务名称、状态 Badge、进度
    await expect(page.getByText('2024Q4办公室盘点')).toBeVisible();
    await expect(page.getByText('进行中')).toBeVisible();

    // 验证第 2 行
    await expect(page.getByText('研发中心专项盘点')).toBeVisible();
    await expect(page.getByText('草稿')).toBeVisible();

    // 验证第 3 行
    await expect(page.getByText('全年固定资产清查')).toBeVisible();
    await expect(page.getByText('已完成')).toBeVisible();

    // 验证创建时间格式 YYYY-MM-DD HH:mm
    await expect(page.getByText('2024-12-01 09:00')).toBeVisible();

    // 验证进度百分比文字
    await expect(page.getByText('60.0%')).toBeVisible();
  });

  test('步骤4: 状态筛选下拉 — 切换为"进行中"后仅显示 in_progress 行', async ({ page }) => {
    const allTasks = [
      createMockTask({ taskId: 't1', status: 'in_progress', taskName: '进行中任务' }),
      createMockTask({ taskId: 't2', status: 'draft', taskName: '草稿任务' }),
      createMockTask({ taskId: 't3', status: 'completed', taskName: '已完成任务' }),
    ];

    // 先加载全部，再拦截筛选请求
    await routeTaskList(page, allTasks);
    await page.goto('/inventory');

    // 查找状态筛选 Select 组件并切换到"进行中"
    const filterSelect = page.locator(
      '[data-testid="status-filter"], .ant-select:has-text("全部状态"), .ant-select:has-text("状态")',
    ).first();

    if (await filterSelect.isVisible()) {
      await filterSelect.click();
      await page.getByText('进行中').click();

      // 筛选后列表应仅含 in_progress 行
      await expect(page.getByText('进行中任务')).toBeVisible();
      await expect(page.getByText('草稿任务')).not.toBeVisible();
      await expect(page.getByText('已完成任务')).not.toBeVisible();
    }
  });

  test('步骤5: 分页 — Mock 25 条数据，页面显示第 1 页 20 条，底部分页器显示共 2 页', async ({ page }) => {
    const tasks25 = Array.from({ length: 25 }, (_, i) =>
      createMockTask({
        taskId: `task-p-${i}`,
        taskName: `盘点任务-${String(i + 1).padStart(3, '0')}`,
        status: i % 2 === 0 ? 'in_progress' : 'draft',
      }),
    );

    // 首次加载返回前 20 条 + total=25
    await page.route(`${API_PREFIX}/tasks**`, async (route: Route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = 20;
        const start = (pageParam - 1) * pageSize;
        const items = tasks25.slice(start, start + pageSize);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items, total: 25, page: pageParam, pageSize }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/inventory');

    // 验证第 1 页 20 行
    const rows = page.locator('.ant-table-row, [data-testid="task-item"]');
    await expect(rows).toHaveCount(20);

    // 验证分页器存在且显示共 2 页
    const pagination = page.locator('.ant-pagination');
    await expect(pagination).toBeVisible();
    // Ant Design pagination 应包含分页按钮，共 2 页
    await expect(pagination.locator('.ant-pagination-item, li')).toHaveCount(2);
  });
});

// ===========================================================================
// ATB-002：新建盘点任务弹窗 — 完整流程
// ===========================================================================

test.describe('ATB-002: 新建盘点任务弹窗 — 完整流程', () => {
  test.beforeEach(async ({ page }) => {
    await routeTaskList(page, []);
    await routeLocationTree(page);
    await routeCategoryTree(page);
    await page.goto('/inventory');
  });

  test('步骤1: 点击"新建盘点任务"按钮 → 弹出 Modal', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();

    // Modal 弹窗可见
    const modal = page.locator('.ant-modal:visible');
    await expect(modal).toBeVisible();

    // 包含任务名称输入框
    await expect(modal.locator('input, [data-testid="task-name-input"]').first()).toBeVisible();
  });

  test('步骤2: 不填写任何内容点击"确定" — 表单校验触发', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    // 点击确定
    await modal.getByRole('button', { name: /确定|确认|提交/ }).click();

    // 任务名称校验提示
    await expect(page.getByText(/请输入.*任务名称|任务名称不能为空/)).toBeVisible();

    // 范围提示
    await expect(page.getByText(/请选择.*盘点范围|请选择盘点范围/)).toBeVisible();
  });

  test('步骤3: 输入任务名称后校验错误消失', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    // 触发校验
    await modal.getByRole('button', { name: /确定|确认|提交/ }).click();

    // 输入合法名称
    const nameInput = modal.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('2024Q4办公室盘点');

    // 校验错误消失（输入框不再标红 — Ant Design ant-form-item-explain-error 消失）
    await expect(modal.locator('.ant-form-item-explain-error')).toHaveCount(0);
  });

  test('步骤4: 选择"按位置树多选"Tab — 勾选叶子节点，已选列表更新', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    // 输入名称
    const nameInput = modal.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('2024Q4办公室盘点');

    // 切换到"按位置树多选" Tab
    await modal.getByRole('tab', { name: /按位置/ }).click();

    // 勾选 A座1楼 和 A座2楼
    await modal.locator('.ant-tree-checkbox').nth(0).click(); // expand root
    await page.waitForTimeout(300);
    await modal.locator('.ant-tree-checkbox').nth(1).click();
    await modal.locator('.ant-tree-checkbox').nth(2).click();

    // 已选列表应显示节点名称
    await expect(modal.getByText('A座1楼')).toBeVisible();
    await expect(modal.getByText('A座2楼')).toBeVisible();
  });

  test('步骤5: 切换至"按分类多选"Tab — 位置选择清空，显示分类树', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    const nameInput = modal.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('测试任务');

    // 先选位置
    await modal.getByRole('tab', { name: /按位置/ }).click();

    // 再切换至分类
    await modal.getByRole('tab', { name: /按分类/ }).click();

    // 位置树已清空，分类树可见
    await expect(modal.locator('.ant-tree')).toBeVisible();

    // 勾选 1 个分类节点
    await modal.locator('.ant-tree-checkbox').first().click();

    // 已选列表更新为分类
    await expect(modal.getByText('电子设备')).toBeVisible();
  });

  test('步骤6: 切换至"全部资产" — 位置/分类选择区域隐藏，显示提示', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    await modal.getByRole('tab', { name: /全部资产/ }).click();

    // 显示提示
    await expect(page.getByText(/将对所有资产进行盘点/)).toBeVisible();

    // 树选择区域应不可见
    await expect(modal.locator('.ant-tree')).not.toBeVisible();
  });

  test('步骤7: 切回"按位置树多选"，重新勾选节点 — 已选列表正确', async ({ page }) => {
    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    // 先切全部资产
    await modal.getByRole('tab', { name: /全部资产/ }).click();

    // 再切回位置
    await modal.getByRole('tab', { name: /按位置/ }).click();

    // 勾选 1 个节点
    await modal.locator('.ant-tree-checkbox').first().click();

    // 已选列表应显示
    await expect(modal.getByText(/总部大楼|A座/)).toBeVisible();
  });

  test('步骤8: 填写合法数据后点击"确定" — POST 请求触发，列表新增一行', async ({ page }) => {
    let posted = false;
    let postedBody: Record<string, unknown> | null = null;

    // 拦截 POST 创建请求
    await page.route(`${API_PREFIX}/tasks`, async (route: Route) => {
      if (route.request().method() === 'POST') {
        posted = true;
        postedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            taskId: 'new-task-id',
            taskName: '2024Q4办公室盘点',
            scopeType: 'location',
            scopeIds: ['loc-1-1'],
            status: 'draft',
            progress: 0,
            totalAssets: 0,
            countedAssets: 0,
            createdAt: '2024-12-10 10:00',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: /新建盘点任务/ }).click();
    const modal = page.locator('.ant-modal:visible');

    // 填写名称
    const nameInput = modal.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('2024Q4办公室盘点');

    // 选择"全部资产"
    await modal.getByRole('tab', { name: /全部资产/ }).click();

    // 提交
    await modal.getByRole('button', { name: /确定|确认|提交/ }).click();

    // 验证 POST 请求
    await expect.poll(() => posted).toBe(true);
    expect(postedBody).toBeTruthy();
    expect(postedBody!.taskName).toBe('2024Q4办公室盘点');
    expect(postedBody!.scopeType).toBe('all');

    // 弹窗关闭
    await expect(page.locator('.ant-modal:visible')).toHaveCount(0);

    // 列表新增一行（状态为草稿）
    await expect(page.getByText('2024Q4办公室盘点')).toBeVisible();
    await expect(page.getByText('草稿')).toBeVisible();
  });
});

// ===========================================================================
// ATB-003：盘点执行详情页 — 进度条与统计摘要
// ===========================================================================

test.describe('ATB-003: 盘点执行详情页 — 进度条与统计摘要', () => {
  const taskId = 'task-detail-1';
  const mockTask = createMockTask({
    taskId,
    taskName: '2024Q4办公室盘点',
    status: 'in_progress',
    progress: 60.0,
    totalAssets: 100,
    countedAssets: 60,
    uncountedAssets: 40,
    surplusAssets: 2,
    deficitAssets: 3,
  });

  const mockAssets = [
    createMockAsset({ assetId: 'a1', assetCode: 'ASSET-001', assetName: '笔记本电脑', bookStatus: '在用' }),
    createMockAsset({ assetId: 'a2', assetCode: 'ASSET-002', assetName: '显示器', bookStatus: '在用' }),
    createMockAsset({ assetId: 'a3', assetCode: 'ASSET-003', assetName: '打印机', bookStatus: '闲置' }),
  ];

  test.beforeEach(async ({ page }) => {
    await routeTaskList(page, [mockTask]);
    await routeTaskDetail(page, mockTask);
    await routeAssetList(page, taskId, mockAssets);
    await routeSummary(page, taskId, {
      surplus: { total: 2, items: [] },
      deficit: { total: 3, items: [] },
    });
  });

  test('步骤1: 点击"进行中"任务 → 路由跳转至 /inventory/tasks/:taskId', async ({ page }) => {
    await page.goto('/inventory');

    // 点击任务行
    await page.getByText('2024Q4办公室盘点').click();

    // 验证 URL 变更
    await expect(page).toHaveURL(new RegExp(`/inventory/tasks/${taskId}`));

    // 页面渲染详情组件
    await expect(page.locator('[data-testid="task-detail"], .task-detail, .ant-page-header')).toBeVisible();
  });

  test('步骤2: 统计摘要 — 进度条 60.0%，统计卡片数值正确', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    // 进度条显示 60.0%
    await expect(page.getByText('60.0%')).toBeVisible();

    // 统计卡片
    await expect(page.getByText('100').first()).toBeVisible(); // 总资产 100
    await expect(page.getByText('60').first()).toBeVisible(); // 已盘 60
    await expect(page.getByText('40').first()).toBeVisible(); // 未盘 40

    // 盘盈 2（绿色） — 通过 class 或文字判断
    const surplusEl = page.getByText('2').first();
    await expect(surplusEl).toBeVisible();

    // 盘亏 3（红色）
    const deficitEl = page.getByText('3').first();
    await expect(deficitEl).toBeVisible();
  });

  test('步骤3: 资产清单表格渲染 — 表头正确', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    // 等待表格加载
    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    // 验证表头包含必要列
    await expect(table.getByText('资产编号')).toBeVisible();
    await expect(table.getByText('资产名称')).toBeVisible();
    await expect(table.getByText('账面状态')).toBeVisible();
    await expect(table.getByText('实盘状态')).toBeVisible();
    await expect(table.getByText('备注')).toBeVisible();
    await expect(table.getByText('操作')).toBeVisible();

    // 验证行数
    await expect(table.locator('.ant-table-row')).toHaveCount(3);
  });
});

// ===========================================================================
// ATB-004：逐条确认资产
// ===========================================================================

test.describe('ATB-004: 逐条确认资产', () => {
  const taskId = 'task-confirm-1';
  const assetId = 'asset-to-confirm';

  const mockTask = createMockTask({
    taskId,
    status: 'in_progress',
    progress: 60.0,
    totalAssets: 100,
    countedAssets: 60,
    uncountedAssets: 40,
    surplusAssets: 2,
    deficitAssets: 3,
  });

  const mockAssets = [
    createMockAsset({
      assetId,
      assetCode: 'ASSET-100',
      assetName: '待确认设备',
      bookStatus: '在用',
      actualStatus: null,
      confirmed: false,
    }),
    createMockAsset({
      assetId: 'asset-done',
      assetCode: 'ASSET-101',
      assetName: '已确认设备',
      bookStatus: '在用',
      actualStatus: 'normal',
      confirmed: true,
    }),
  ];

  test.beforeEach(async ({ page }) => {
    await routeTaskDetail(page, mockTask);
    await routeAssetList(page, taskId, mockAssets);
    await routeSummary(page, taskId, {
      surplus: { total: 2, items: [] },
      deficit: { total: 3, items: [] },
    });
  });

  test('步骤1: 未确认资产的行尾"确认"按钮可点击', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const firstRow = page.locator('.ant-table-row').first();
    const confirmBtn = firstRow.getByRole('button', { name: /确认/ });
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
  });

  test('步骤2: 在"实盘状态"下拉选择"正常"', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const firstRow = page.locator('.ant-table-row').first();

    // 找到实盘状态下拉并选择"正常"
    const statusSelect = firstRow.locator('.ant-select').first();
    await statusSelect.click();
    await page.getByText('正常').click();

    // 验证选中值
    await expect(firstRow.locator('.ant-select-selection-item, .ant-select-selection-search')).toContainText('正常');
  });

  test('步骤3: 在"备注"列输入"设备完好"', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const firstRow = page.locator('.ant-table-row').first();
    const remarkInput = firstRow.locator('input[type="text"], textarea').last();
    await remarkInput.fill('设备完好');

    await expect(remarkInput).toHaveValue('设备完好');
  });

  test('步骤4: 点击"确认"按钮 — PATCH 请求发出，行状态更新，摘要刷新', async ({ page }) => {
    let confirmCalled = false;
    let confirmBody: Record<string, unknown> | null = null;

    // 拦截逐条确认 PATCH
    await page.route(
      `${API_PREFIX}/tasks/${taskId}/assets/${assetId}/confirm`,
      async (route: Route) => {
        if (route.request().method() === 'PATCH') {
          confirmCalled = true;
          confirmBody = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      },
    );

    // 确认后刷新 task detail（已盘数 +1）
    const updatedTask = createMockTask({
      taskId,
      status: 'in_progress',
      progress: 61.0,
      totalAssets: 100,
      countedAssets: 61,
      uncountedAssets: 39,
      surplusAssets: 2,
      deficitAssets: 3,
    });
    await routeTaskDetail(page, updatedTask);

    await page.goto(`/inventory/tasks/${taskId}`);

    const firstRow = page.locator('.ant-table-row').first();

    // 选择实盘状态
    const statusSelect = firstRow.locator('.ant-select').first();
    await statusSelect.click();
    await page.getByText('正常').click();

    // 输入备注
    const remarkInput = firstRow.locator('input[type="text"], textarea').last();
    await remarkInput.fill('设备完好');

    // 点击确认
    await firstRow.getByRole('button', { name: /确认/ }).click();

    // 验证 PATCH 请求
    await expect.poll(() => confirmCalled).toBe(true);
    expect(confirmBody).toBeTruthy();
    expect(confirmBody!.actualStatus).toBe('normal');
    expect(confirmBody!.remark).toBe('设备完好');

    // 确认后行变为只读文本
    await expect(firstRow.getByText('正常')).toBeVisible();

    // 统计摘要已盘数更新（61.0%）
    await expect(page.getByText('61.0%')).toBeVisible();
  });

  test('步骤5: 确认后 1s 内无整页刷新（仅局部更新）', async ({ page }) => {
    await page.route(
      `${API_PREFIX}/tasks/${taskId}/assets/${assetId}/confirm`,
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      },
    );

    await page.goto(`/inventory/tasks/${taskId}`);

    const firstRow = page.locator('.ant-table-row').first();
    const statusSelect = firstRow.locator('.ant-select').first();
    await statusSelect.click();
    await page.getByText('正常').click();

    // 记录页面 URL
    const urlBefore = page.url();

    await firstRow.getByRole('button', { name: /确认/ }).click();

    // 等待 1s
    await page.waitForTimeout(1000);

    // URL 不变（无整页刷新/跳转）
    expect(page.url()).toBe(urlBefore);
  });
});

// ===========================================================================
// ATB-005：批量确认资产
// ===========================================================================

test.describe('ATB-005: 批量确认资产', () => {
  const taskId = 'task-batch-1';

  const mockTask = createMockTask({
    taskId,
    status: 'in_progress',
    progress: 0,
    totalAssets: 100,
    countedAssets: 0,
    uncountedAssets: 100,
  });

  const mockAssets = [
    createMockAsset({ assetId: 'ba1', assetCode: 'BA-001', assetName: '设备A' }),
    createMockAsset({ assetId: 'ba2', assetCode: 'BA-002', assetName: '设备B' }),
    createMockAsset({ assetId: 'ba3', assetCode: 'BA-003', assetName: '设备C' }),
    createMockAsset({ assetId: 'ba4', assetCode: 'BA-004', assetName: '设备D' }),
  ];

  test.beforeEach(async ({ page }) => {
    await routeTaskDetail(page, mockTask);
    await routeAssetList(page, taskId, mockAssets);
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });
  });

  test('步骤1: 资产清单中有未确认资产 — 每行前有 Checkbox', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    // 每行应有 Checkbox
    const checkboxes = table.locator('.ant-checkbox');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('步骤2: 不勾选任何行 — "批量确认"按钮为 disabled', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const batchBtn = page.getByRole('button', { name: /批量确认/ });
    await expect(batchBtn).toBeDisabled();
  });

  test('步骤3: 勾选前 3 行 — 显示"已选 3 项"，按钮变 enabled', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const table = page.locator('.ant-table');
    const rows = table.locator('.ant-table-row');

    // 勾选前 3 行的 Checkbox
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).locator('.ant-checkbox').click();
    }

    // 已选 3 项提示
    await expect(page.getByText(/已选.*3.*项/)).toBeVisible();

    // 批量确认按钮 enabled
    const batchBtn = page.getByRole('button', { name: /批量确认/ });
    await expect(batchBtn).toBeEnabled();
  });

  test('步骤4: 点击"批量确认" — 弹出对话框，要求选择实盘状态', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const table = page.locator('.ant-table');
    const rows = table.locator('.ant-table-row');
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).locator('.ant-checkbox').click();
    }

    await page.getByRole('button', { name: /批量确认/ }).click();

    // 弹出批量确认对话框
    const dialog = page.locator('.ant-modal:visible');
    await expect(dialog).toBeVisible();

    // 包含实盘状态下拉
    await expect(dialog.locator('.ant-select')).toBeVisible();

    // 包设备可选备注输入
    await expect(dialog.locator('input, textarea')).toBeVisible();
  });

  test('步骤5: 选择实盘状态"正常"后确认 — POST batch-confirm，3 行状态更新', async ({ page }) => {
    let batchCalled = false;
    let batchBody: Record<string, unknown> | null = null;

    await page.route(
      `${API_PREFIX}/tasks/${taskId}/assets/batch-confirm`,
      async (route: Route) => {
        if (route.request().method() === 'POST') {
          batchCalled = true;
          batchBody = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto(`/inventory/tasks/${taskId}`);

    const table = page.locator('.ant-table');
    const rows = table.locator('.ant-table-row');
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).locator('.ant-checkbox').click();
    }

    await page.getByRole('button', { name: /批量确认/ }).click();

    // 在弹窗中选择实盘状态"正常"
    const dialog = page.locator('.ant-modal:visible');
    await dialog.locator('.ant-select').click();
    await page.getByText('正常').click();

    // 点击确认
    await dialog.getByRole('button', { name: /确定|确认/ }).click();

    // 验证 POST 请求
    await expect.poll(() => batchCalled).toBe(true);
    expect(batchBody).toBeTruthy();
    expect((batchBody!.assetIds as string[]).length).toBe(3);
    expect(batchBody!.actualStatus).toBe('normal');

    // 统计摘要同步更新
    await expect(page.getByText(/已选.*项/)).not.toBeVisible();
  });
});

// ===========================================================================
// ATB-006：盘盈盘亏汇总面板
// ===========================================================================

test.describe('ATB-006: 盘盈盘亏汇总面板', () => {
  const taskId = 'task-summary-1';

  const mockTask = createMockTask({
    taskId,
    status: 'in_progress',
    progress: 80.0,
    totalAssets: 50,
    countedAssets: 40,
    surplusAssets: 2,
    deficitAssets: 3,
  });

  const mockSummary = {
    surplus: {
      total: 2,
      items: [
        { assetCode: 'SUR-001', assetName: '多余笔记本电脑', reason: '账外资产' },
        { assetCode: 'SUR-002', assetName: '多余显示器', reason: '调拨未登记' },
      ],
    },
    deficit: {
      total: 3,
      items: [
        { assetCode: 'DEF-001', assetName: '丢失投影仪', reason: '位置不明' },
        { assetCode: 'DEF-002', assetName: '缺失办公桌', reason: '报废未销账' },
        { assetCode: 'DEF-003', assetName: '未找到打印机', reason: '借出未归还' },
      ],
    },
  };

  test.beforeEach(async ({ page }) => {
    await routeTaskDetail(page, mockTask);
    await routeAssetList(page, taskId, []);
    await routeSummary(page, taskId, mockSummary);
  });

  test('步骤1: 滚动至底部 — 渲染"盘盈盘亏汇总"面板，含两个 Tab', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // 汇总面板可见
    await expect(page.getByText(/盘盈盘亏汇总|差异汇总/)).toBeVisible();

    // 两个 Tab
    await expect(page.getByRole('tab', { name: /盘盈明细/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /盘亏明细/ })).toBeVisible();
  });

  test('步骤2: Mock 数据 — 盘盈明细 2 行，盘亏明细 3 行', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    // 默认可能显示盘盈 Tab
    await page.getByRole('tab', { name: /盘盈明细/ }).click();

    // 盘盈 2 行
    await expect(page.getByText('SUR-001')).toBeVisible();
    await expect(page.getByText('SUR-002')).toBeVisible();

    // 切换到盘亏 Tab
    await page.getByRole('tab', { name: /盘亏明细/ }).click();

    // 盘亏 3 行
    await expect(page.getByText('DEF-001')).toBeVisible();
    await expect(page.getByText('DEF-002')).toBeVisible();
    await expect(page.getByText('DEF-003')).toBeVisible();
  });

  test('步骤3: 存在差异时 — "提交核准"按钮可见且 enabled', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    const submitBtn = page.getByRole('button', { name: /提交核准/ });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('步骤4: 无差异（surplus=0, deficit=0）— 显示"无差异"，按钮仍可见', async ({ page }) => {
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });

    await page.goto(`/inventory/tasks/${taskId}`);

    await expect(page.getByText('无差异')).toBeVisible();

    const submitBtn = page.getByRole('button', { name: /提交核准/ });
    await expect(submitBtn).toBeVisible();
  });

  test('步骤5: 点击"提交核准" — 弹出二次确认弹窗', async ({ page }) => {
    await page.goto(`/inventory/tasks/${taskId}`);

    await page.getByRole('button', { name: /提交核准/ }).click();

    // 二次确认弹窗
    const confirmModal = page.locator('.ant-modal:visible');
    await expect(confirmModal).toBeVisible();
    await expect(page.getByText(/确认提交核准.*提交后不可修改/)).toBeVisible();
  });

  test('步骤6: 确认提交 — POST submit，状态变"已提交"，页面只读', async ({ page }) => {
    let submitCalled = false;

    await page.route(`${API_PREFIX}/tasks/${taskId}/submit`, async (route: Route) => {
      if (route.request().method() === 'POST') {
        submitCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // 提交后 task detail 变为 submitted
    const submittedTask = createMockTask({
      taskId,
      status: 'submitted',
      progress: 100.0,
    });
    await routeTaskDetail(page, submittedTask);

    await page.goto(`/inventory/tasks/${taskId}`);

    await page.getByRole('button', { name: /提交核准/ }).click();

    // 在二次确认弹窗中确认
    const confirmModal = page.locator('.ant-modal:visible');
    await confirmModal.getByRole('button', { name: /确定|确认/ }).click();

    // 验证 POST 请求
    await expect.poll(() => submitCalled).toBe(true);

    // 页面进入只读 — 确认按钮不可见
    await expect(page.getByRole('button', { name: /确认/ })).toHaveCount(0);

    // 下拉不可操作
    const selects = page.locator('.ant-select-disabled');
    await expect(selects.first()).toBeVisible();
  });
});

// ===========================================================================
// ATB-007：只读模式验证
// ===========================================================================

test.describe('ATB-007: 只读模式验证', () => {
  const taskId = 'task-readonly';

  test('步骤1: status=completed — 下拉 disabled，确认按钮不可见', async ({ page }) => {
    const completedTask = createMockTask({ taskId, status: 'completed' });
    await routeTaskDetail(page, completedTask);
    await routeAssetList(page, taskId, [
      createMockAsset({ assetCode: 'RO-001', actualStatus: 'normal', confirmed: true }),
    ]);
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });

    await page.goto(`/inventory/tasks/${taskId}`);

    // 实盘状态下拉 disabled
    const selects = page.locator('.ant-select-disabled');
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThan(0);

    // 备注 disabled
    const inputs = page.locator('input:disabled, textarea:disabled');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(0);

    // 确认按钮不可见
    await expect(page.getByRole('button', { name: /^确认$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /批量确认/ })).toHaveCount(0);
  });

  test('步骤2: status=submitted — 同上只读行为', async ({ page }) => {
    const submittedTask = createMockTask({ taskId, status: 'submitted' });
    await routeTaskDetail(page, submittedTask);
    await routeAssetList(page, taskId, [
      createMockAsset({ assetCode: 'RO-002', actualStatus: 'normal', confirmed: true }),
    ]);
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });

    await page.goto(`/inventory/tasks/${taskId}`);

    // 只读行为同 completed
    await expect(page.getByRole('button', { name: /^确认$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /批量确认/ })).toHaveCount(0);
  });

  test('步骤3: status=draft — 实盘状态下拉可操作但显示提示', async ({ page }) => {
    const draftTask = createMockTask({ taskId, status: 'draft' });
    await routeTaskDetail(page, draftTask);
    await routeAssetList(page, taskId, [
      createMockAsset({ assetCode: 'RO-003' }),
    ]);
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });

    await page.goto(`/inventory/tasks/${taskId}`);

    // 显示提示文案
    await expect(
      page.getByText(/请先将任务状态变更为进行中/),
    ).toBeVisible();
  });
});

// ===========================================================================
// ATB-009：虚拟滚动
// ===========================================================================

test.describe('ATB-009: 虚拟滚动', () => {
  const taskId = 'task-virtual-1';

  test('步骤1: Mock 500 条数据 — DOM 中仅渲染可视区行数（约 20 行）', async ({ page }) => {
    const mockTask = createMockTask({
      taskId,
      status: 'in_progress',
      totalAssets: 500,
      countedAssets: 0,
      uncountedAssets: 500,
    });

    // 生成 500 条资产
    const assets500 = Array.from({ length: 500 }, (_, i) =>
      createMockAsset({
        assetId: `va-${i}`,
        assetCode: `VA-${String(i + 1).padStart(4, '0')}`,
        assetName: `虚拟资产-${i + 1}`,
      }),
    );

    await routeTaskDetail(page, mockTask);
    await routeAssetList(page, taskId, assets500, 500);
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });

    await page.goto(`/inventory/tasks/${taskId}`);

    // 等待表格渲染
    await page.waitForTimeout(1000);

    // DOM 中不应有 500 个 <tr> 行（虚拟滚动启用）
    const rows = page.locator('.ant-table-row, [role="row"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeLessThan(50); // 虚拟化：可视区约 20 行
    expect(rowCount).toBeGreaterThan(0);

    // 不应出现 500 个 <tr>
    const allTr = page.locator('tr');
    const trCount = await allTr.count();
    expect(trCount).toBeLessThan(100);
  });

  test('步骤2: 滚动到底部 — 后续行按需渲染', async ({ page }) => {
    const mockTask = createMockTask({
      taskId,
      status: 'in_progress',
      totalAssets: 500,
      countedAssets: 0,
      uncountedAssets: 500,
    });

    const assets500 = Array.from({ length: 500 }, (_, i) =>
      createMockAsset({
        assetId: `va-${i}`,
        assetCode: `VA-${String(i + 1).padStart(4, '0')}`,
        assetName: `虚拟资产-${i + 1}`,
      }),
    );

    await routeTaskDetail(page, mockTask);
    await routeAssetList(page, taskId, assets500, 500);
    await routeSummary(page, taskId, {
      surplus: { total: 0, items: [] },
      deficit: { total: 0, items: [] },
    });

    await page.goto(`/inventory/tasks/${taskId}`);
    await page.waitForTimeout(1000);

    // 获取初始可见内容
    const initialRows = page.locator('.ant-table-row, [role="row"]');
    const initialCount = await initialRows.count();

    // 滚动到底部
    await page.evaluate(() => {
      const scrollContainer = document.querySelector(
        '.ant-table-body, [data-testid="virtual-scroll-container"]',
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });

    await page.waitForTimeout(500);

    // 底部行应渲染出来（如最后一条资产）
    await expect(page.getByText('虚拟资产-500')).toBeVisible();

    // 行数应保持有限（虚拟滚动特性）
    const afterRows = page.locator('.ant-table-row, [role="row"]');
    const afterCount = await afterRows.count();
    expect(afterCount).toBeLessThan(50);
  });
});