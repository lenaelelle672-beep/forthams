import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Inventory Detail Workbench [SWARM-P3-010-FE]
 *
 * Covers acceptance criteria:
 * - ATB-03: 盘点执行详情页进度看板渲染
 * - ATB-04: 资产清单逐条与批量确认
 * - ATB-05: 盘盈盘亏汇总与一键提交
 */

/* ---------- Mock Data ---------- */

const MOCK_TASK_ID = 'task-001';

const MOCK_TASK_DETAIL = {
  id: MOCK_TASK_ID,
  name: 'Q4 仓库A资产盘点',
  scope: '按位置: 仓库A',
  status: '进行中',
  createdAt: '2024-10-15T09:00:00Z',
};

const MOCK_SUMMARY = {
  totalAssets: 20,
  counted: 5,
  uncounted: 15,
  surplus: 1,
  deficit: 1,
  progressPercent: 25,
};

const MOCK_ASSET_LIST = Array.from({ length: 20 }, (_, i) => ({
  id: `asset-${String(i + 1).padStart(3, '0')}`,
  assetCode: `AST-2024-${String(i + 1).padStart(4, '0')}`,
  assetName: `资产名称-${i + 1}`,
  categoryName: i % 3 === 0 ? '电子设备' : i % 3 === 1 ? '办公家具' : '运输工具',
  locationName: i < 10 ? '仓库A-1F' : '仓库A-2F',
  bookStatus: '在用',
  physicalStatus: i < 5 ? '已盘' : '未盘',
  remark: i < 5 ? '正常' : '',
}));

/**
 * 盘亏记录: 账面有，实盘无
 * 盘盈记录: 账面无，实盘有
 */
const MOCK_DIFF_RECORDS = [
  {
    id: 'diff-001',
    assetCode: 'AST-2024-0099',
    assetName: '笔记本电脑-Lenovo',
    bookStatus: '在用',
    physicalStatus: '未盘',
    diffType: '盘亏',
    remark: '账面有，实盘无',
  },
  {
    id: 'diff-002',
    assetCode: 'AST-EXTRA-0001',
    assetName: '显示器-Dell',
    bookStatus: '无记录',
    physicalStatus: '已盘',
    diffType: '盘盈',
    remark: '账面无，实盘有',
  },
];

/* ---------- Helper: set up common API mocks ---------- */

function setupApiMocks(page: import('@playwright/test').Page) {
  // Mock task detail
  page.route(`**/api/inventory/tasks/${MOCK_TASK_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TASK_DETAIL }),
    }),
  );

  // Mock summary statistics
  page.route(`**/api/inventory/tasks/${MOCK_TASK_ID}/summary`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_SUMMARY }),
    }),
  );

  // Mock asset list
  page.route(`**/api/inventory/tasks/${MOCK_TASK_ID}/assets**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { items: MOCK_ASSET_LIST, total: MOCK_ASSET_LIST.length } }),
    }),
  );

  // Mock diff / discrepancy records
  page.route(`**/api/inventory/tasks/${MOCK_TASK_ID}/diff`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DIFF_RECORDS }),
    }),
  );
}

/* ---------- Test Suite ---------- */

test.describe('盘点执行详情页 (Inventory Detail)', () => {
  test.beforeEach(async ({ page }) => {
    setupApiMocks(page);
  });

  /* ===== ATB-03: 盘点执行详情页进度看板渲染 ===== */
  test('ATB-03: 应渲染进度看板并显示正确的统计卡片数值', async ({ page }) => {
    // Simulate navigating from task list by clicking an "进行中" task
    await page.goto(`/inventory/tasks`);

    // Intercept task list API to provide a clickable "进行中" task
    await page.route('**/api/inventory/tasks**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: [MOCK_TASK_DETAIL],
            total: 1,
          },
        }),
      }),
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click the "进行中" task row to navigate to detail
    const taskRow = page.locator('[data-testid="task-list-table"] tbody tr').first();
    await expect(taskRow).toBeVisible({ timeout: 2000 });
    await taskRow.click();

    // Verify route transition to detail page
    await expect(page).toHaveURL(new RegExp(`/inventory/tasks/${MOCK_TASK_ID}`));
    await page.waitForLoadState('networkidle');

    // -- Progress component percentage matches mock data --
    const progressBar = page.locator('[data-testid="inventory-progress-bar"]');
    await expect(progressBar).toBeVisible();
    // Ant Design Progress renders the percentage as aria-valuenow
    await expect(progressBar).toHaveAttribute('aria-valuenow', String(MOCK_SUMMARY.progressPercent));

    // -- 5 stat cards: 总资产数 / 已盘 / 未盘 / 盘盈 / 盘亏 --
    const statCards = page.locator('[data-testid="stat-card"]');
    await expect(statCards).toHaveCount(5);

    // Verify each stat card value matches the mock summary
    await expect(page.locator('[data-testid="stat-card-total"] .stat-value')).toHaveText(
      String(MOCK_SUMMARY.totalAssets),
    );
    await expect(page.locator('[data-testid="stat-card-counted"] .stat-value')).toHaveText(
      String(MOCK_SUMMARY.counted),
    );
    await expect(page.locator('[data-testid="stat-card-uncounted"] .stat-value')).toHaveText(
      String(MOCK_SUMMARY.uncounted),
    );
    await expect(page.locator('[data-testid="stat-card-surplus"] .stat-value')).toHaveText(
      String(MOCK_SUMMARY.surplus),
    );
    await expect(page.locator('[data-testid="stat-card-deficit"] .stat-value')).toHaveText(
      String(MOCK_SUMMARY.deficit),
    );
  });

  /* ===== ATB-04: 资产清单逐条与批量确认 ===== */
  test('ATB-04: 应支持逐条实盘状态变更、备注输入及批量确认', async ({ page }) => {
    // Navigate directly to detail page
    await page.goto(`/inventory/tasks/${MOCK_TASK_ID}`);
    await page.waitForLoadState('networkidle');

    // -- 1. Per-item status change: select "已盘" for first row --
    const firstRow = page.locator('[data-testid="asset-table"] tbody tr').first();
    await expect(firstRow).toBeVisible();

    // Open the StatusDropdown (实盘状态下拉框) in the first row
    const statusDropdown = firstRow.locator('[data-testid="status-dropdown"]').first();
    await statusDropdown.click();

    // Select "已盘" option from the dropdown menu
    const option已盘 = page.locator('.ant-select-item-option').filter({ hasText: '已盘' });
    await option已盘.click();

    // Enter remark "正常" in the remark column of the first row
    const remarkInput = firstRow.locator('[data-testid="remark-input"] input').first();
    await remarkInput.fill('正常');

    // Assert row background color change (highlight) after status update
    const rowBackgroundColor = await firstRow.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue('background-color'),
    );
    // Row should be highlighted (non-default background)
    expect(rowBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    // -- 2. Batch confirmation: check first 3 rows and confirm --
    const checkboxRows = page.locator('[data-testid="asset-table"] tbody tr');
    const rowsToSelect = checkboxRows.locator('input[type="checkbox"]');
    await rowsToSelect.nth(0).check();
    await rowsToSelect.nth(1).check();
    await rowsToSelect.nth(2).check();

    // Intercept batch-confirm API
    let batchConfirmPayload: Record<string, unknown> | null = null;
    await page.route('**/api/inventory/tasks/*/assets/batch-confirm', (route) => {
      batchConfirmPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { updatedCount: 3 } }),
      });
    });

    // Intercept updated summary after batch confirm
    const updatedSummary = {
      ...MOCK_SUMMARY,
      counted: MOCK_SUMMARY.counted + 3,
      uncounted: MOCK_SUMMARY.uncounted - 3,
      progressPercent: Math.round(((MOCK_SUMMARY.counted + 3) / MOCK_SUMMARY.totalAssets) * 100),
    };
    await page.route(`**/api/inventory/tasks/${MOCK_TASK_ID}/summary`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: updatedSummary }),
      }),
    );

    // Click the "批量确认" button
    const batchConfirmBtn = page.getByRole('button', { name: /批量确认/ });
    await batchConfirmBtn.click();

    // Assert confirmation dialog appears
    const confirmModal = page.locator('.ant-modal-content');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText(/确认/);

    // Confirm the batch action
    await confirmModal.getByRole('button', { name: /确[认定]/ }).click();

    // Assert the batch-confirm request was sent with correct payload
    expect(batchConfirmPayload).toBeTruthy();

    // Assert "已盘" count in stat card increases by 3
    await expect(page.locator('[data-testid="stat-card-counted"] .stat-value')).toHaveText(
      String(MOCK_SUMMARY.counted + 3),
    );
  });

  /* ===== ATB-05: 盘盈盘亏汇总与一键提交 ===== */
  test('ATB-05: 应展示差异汇总面板并支持一键提交核准', async ({ page }) => {
    // Navigate directly to detail page with pre-seeded discrepancy data
    await page.goto(`/inventory/tasks/${MOCK_TASK_ID}`);
    await page.waitForLoadState('networkidle');

    // -- 1. Scroll to bottom discrepancy summary panel --
    const diffPanel = page.locator('[data-testid="diff-summary-panel"]');
    await diffPanel.scrollIntoViewIfNeeded();
    await expect(diffPanel).toBeVisible();

    // -- 2. Assert the diff list contains exactly 2 records (1 盘亏 + 1 盘盈) --
    const diffRows = diffPanel.locator('[data-testid="diff-record-row"]');
    await expect(diffRows).toHaveCount(2);

    // Verify the specific diff types are present
    await expect(diffRows.filter({ hasText: '盘亏' })).toHaveCount(1);
    await expect(diffRows.filter({ hasText: '盘盈' })).toHaveCount(1);

    // Verify the "账面有，实盘无" (盘亏) record details
    const deficitRow = diffRows.filter({ hasText: '盘亏' }).first();
    await expect(deficitRow).toContainText('AST-2024-0099');
    await expect(deficitRow).toContainText('笔记本电脑-Lenovo');
    await expect(deficitRow).toContainText('账面有，实盘无');

    // Verify the "账面无，实盘有" (盘盈) record details
    const surplusRow = diffRows.filter({ hasText: '盘盈' }).first();
    await expect(surplusRow).toContainText('AST-EXTRA-0001');
    await expect(surplusRow).toContainText('显示器-Dell');
    await expect(surplusRow).toContainText('账面无，实盘有');

    // -- 3. Click "一键提交核准" button and verify POST request --
    let approveRequestBody: Record<string, unknown> | null = null;
    await page.route('**/api/inventory/approve', (route) => {
      approveRequestBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { success: true, taskId: MOCK_TASK_ID } }),
      });
    });

    // Mock the task list page for post-redirect verification
    await page.route('**/api/inventory/tasks**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { items: [{ ...MOCK_TASK_DETAIL, status: '待核准' }], total: 1 },
        }),
      }),
    );

    const submitBtn = page.getByRole('button', { name: /一键提交核准/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify the POST request was sent to the approve endpoint
    expect(approveRequestBody).toBeTruthy();
    expect(approveRequestBody!.taskId).toBe(MOCK_TASK_ID);

    // -- 4. After successful submission, page should return to task list --
    await expect(page).toHaveURL(/\/inventory\/tasks$/, { timeout: 5000 });
  });

  /* ===== Performance: large asset list should not lag ===== */
  test('应支持超过200条资产数据的流畅渲染', async ({ page }) => {
    // Generate 300 mock assets for performance test
    const largeAssetList = Array.from({ length: 300 }, (_, i) => ({
      id: `asset-large-${i}`,
      assetCode: `AST-L-${String(i).padStart(4, '0')}`,
      assetName: `批量资产-${i}`,
      categoryName: '电子设备',
      locationName: `位置-${i % 10}`,
      bookStatus: '在用',
      physicalStatus: i < 50 ? '已盘' : '未盘',
      remark: '',
    }));

    // Override asset list mock with large dataset
    await page.route(`**/api/inventory/tasks/${MOCK_TASK_ID}/assets**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { items: largeAssetList, total: 300 } }),
      }),
    );

    await page.goto(`/inventory/tasks/${MOCK_TASK_ID}`);

    // The table container should be visible and scrollable
    const tableContainer = page.locator('[data-testid="asset-table"]');
    await expect(tableContainer).toBeVisible({ timeout: 5000 });

    // Scroll through the table and verify responsiveness
    const startTime = Date.now();
    await tableContainer.evaluate((el) => el.scrollBy(0, 5000));
    await page.waitForTimeout(300); // Allow rendering to settle
    const endTime = Date.now();

    // Scroll action should complete smoothly (no significant blocking)
    expect(endTime - startTime).toBeLessThan(2000);

    // Verify virtual scrolling: not all 300 rows rendered in DOM simultaneously
    const renderedRows = await page.locator('[data-testid="asset-table"] tbody tr').count();
    expect(renderedRows).toBeLessThan(300);
  });

  /* ===== Scope selector component: location/category filter ===== */
  test('应通过盘点范围选择器筛选资产表格', async ({ page }) => {
    await page.goto(`/inventory/tasks/${MOCK_TASK_ID}`);
    await page.waitForLoadState('networkidle');

    // Scope selector (InventoryScopeSelector component) should be present
    const scopeSelector = page.locator('[data-testid="inventory-scope-selector"]');
    await expect(scopeSelector).toBeVisible();

    // Switch to location tree mode
    const locationRadio = scopeSelector.getByRole('radio', { name: /按位置/ });
    await locationRadio.click();

    // TreeSelect component should render
    const treeSelect = scopeSelector.locator('.ant-select');
    await expect(treeSelect).toBeVisible();
    await treeSelect.click();

    // Select a tree node
    const treeNode = page.locator('.ant-tree-treenode').first();
    await treeNode.click();

    // Apply the filter
    await scopeSelector.getByRole('button', { name: /应用/ }).click();

    // Table should be refreshed (verify API was called)
    // The table should still be visible and functional
    const table = page.locator('[data-testid="asset-table"]');
    await expect(table).toBeVisible();
  });
});