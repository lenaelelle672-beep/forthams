import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * @file frontend/tests/e2e/inventory-tasks.spec.ts
 * @description E2E tests for Asset Inventory Management — SWARM-P3-010-FE
 *
 * Acceptance Test Bases covered:
 *   ATB-01 – Task list rendering
 *   ATB-02 – Create task modal & scope selector
 *   ATB-03 – Execution detail progress dashboard
 *   ATB-04 – Asset row single & batch confirmation
 *   ATB-05 – Discrepancy summary & one-click approval submission
 */

// ---------------------------------------------------------------------------
// Mock data constants
// ---------------------------------------------------------------------------

const MOCK_TASKS = [
  {
    id: 'task-001',
    name: '2024年Q3办公楼盘点',
    scope: '总部大楼 A/B 栋',
    status: 'IN_PROGRESS',
    createdAt: '2024-09-15T08:30:00Z',
    progress: 45,
    totalAssets: 120,
    scannedAssets: 54,
  },
  {
    id: 'task-002',
    name: '2024年Q3仓库盘点',
    scope: '华北仓库',
    status: 'COMPLETED',
    createdAt: '2024-09-10T10:00:00Z',
    progress: 100,
    totalAssets: 80,
    scannedAssets: 80,
  },
];

const MOCK_TASK_DETAIL = {
  id: 'task-001',
  name: '2024年Q3办公楼盘点',
  status: 'IN_PROGRESS',
  progress: 40,
  summary: {
    totalAssets: 10,
    scanned: 4,
    notScanned: 4,
    surplus: 1,
    deficit: 1,
  },
};

const MOCK_ASSET_LIST = [
  {
    id: 'asset-001',
    assetCode: 'IT-001',
    assetName: '笔记本电脑 ThinkPad X1',
    bookQuantity: 1,
    actualQuantity: null,
    inventoryStatus: 'PENDING',
    remark: '',
  },
  {
    id: 'asset-002',
    assetCode: 'IT-002',
    assetName: '显示器 Dell U2723QE',
    bookQuantity: 2,
    actualQuantity: null,
    inventoryStatus: 'PENDING',
    remark: '',
  },
  {
    id: 'asset-003',
    assetCode: 'IT-003',
    assetName: '机械键盘 Cherry MX',
    bookQuantity: 1,
    actualQuantity: null,
    inventoryStatus: 'PENDING',
    remark: '',
  },
  {
    id: 'asset-004',
    assetCode: 'IT-004',
    assetName: '投影仪 Epson EB-W06',
    bookQuantity: 1,
    actualQuantity: 1,
    inventoryStatus: 'SCANNED',
    remark: '',
  },
  {
    id: 'asset-005',
    assetCode: 'IT-005',
    assetName: '服务器 Dell R750',
    bookQuantity: 1,
    actualQuantity: 1,
    inventoryStatus: 'SCANNED',
    remark: '',
  },
  {
    id: 'asset-006',
    assetCode: 'IT-006',
    assetName: '交换机 H3C S6520',
    bookQuantity: 1,
    actualQuantity: 1,
    inventoryStatus: 'SCANNED',
    remark: '',
  },
  {
    id: 'asset-007',
    assetCode: 'IT-007',
    assetName: '打印机 HP LaserJet',
    bookQuantity: 1,
    actualQuantity: 1,
    inventoryStatus: 'SCANNED',
    remark: '',
  },
  // 盘亏: 账面有，实盘无
  {
    id: 'asset-008',
    assetCode: 'IT-008',
    assetName: 'iPad Pro 12.9',
    bookQuantity: 1,
    actualQuantity: 0,
    inventoryStatus: 'SCANNED',
    remark: '无法找到实物',
    diffType: 'DEFICIT',
  },
  // 盘盈: 账面无，实盘有
  {
    id: 'asset-009',
    assetCode: 'IT-009',
    assetName: '未知无线鼠标',
    bookQuantity: 0,
    actualQuantity: 1,
    inventoryStatus: 'SCANNED',
    remark: '发现的未登记资产',
    diffType: 'SURPLUS',
  },
  {
    id: 'asset-010',
    assetCode: 'IT-010',
    assetName: '白板 Steelcase',
    bookQuantity: 1,
    actualQuantity: null,
    inventoryStatus: 'PENDING',
    remark: '',
  },
];

const MOCK_DIFF_SUMMARY = [
  {
    assetId: 'asset-008',
    assetCode: 'IT-008',
    assetName: 'iPad Pro 12.9',
    diffType: 'DEFICIT',
    bookQuantity: 1,
    actualQuantity: 0,
    remark: '无法找到实物',
  },
  {
    assetId: 'asset-009',
    assetCode: 'IT-009',
    assetName: '未知无线鼠标',
    diffType: 'SURPLUS',
    bookQuantity: 0,
    actualQuantity: 1,
    remark: '发现的未登记资产',
  },
];

// ---------------------------------------------------------------------------
// Helper: wire up API routes with mock data
// ---------------------------------------------------------------------------

async function setupApiRoutes(page: Page): Promise<void> {
  // Task list
  await page.route('**/api/inventory/tasks**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TASKS, total: MOCK_TASKS.length }),
    });
  });

  // Task detail
  await page.route('**/api/inventory/tasks/task-001**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TASK_DETAIL }),
    });
  });

  // Asset list for a given task
  await page.route('**/api/inventory/tasks/task-001/assets**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ASSET_LIST, total: MOCK_ASSET_LIST.length }),
    });
  });

  // Diff summary for a given task
  await page.route('**/api/inventory/tasks/task-001/diffs**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DIFF_SUMMARY }),
    });
  });

  // Location tree (for scope selector)
  await page.route('**/api/locations/tree**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'loc-001',
            label: '总部大楼',
            children: [
              { id: 'loc-001-01', label: 'A栋' },
              { id: 'loc-001-02', label: 'B栋' },
            ],
          },
          {
            id: 'loc-002',
            label: '华北仓库',
            children: [
              { id: 'loc-002-01', label: '1号库房' },
              { id: 'loc-002-02', label: '2号库房' },
            ],
          },
        ],
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

test.describe('Asset Inventory Management — Inventory Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiRoutes(page);
  });

  // =========================================================================
  // ATB-01: Task list rendering
  // =========================================================================
  test('ATB-01: should render task list with correct headers and mock data', async ({
    page,
  }) => {
    // Navigate to task list page
    await page.goto('/inventory/tasks');

    // Assert table renders within 2s (default timeout covers this)
    const taskTable = page.locator('[data-testid="inventory-task-table"]');
    await expect(taskTable).toBeVisible({ timeout: 2000 });

    // Verify table headers contain the required columns
    const headerTexts = await page
      .locator('[data-testid="inventory-task-table"] thead th')
      .allTextContents();
    const joined = headerTexts.join('|');
    expect(joined).toContain('任务名称');
    expect(joined).toContain('盘点范围');
    expect(joined).toContain('状态');
    expect(joined).toContain('创建时间');
    expect(joined).toContain('完成进度');

    // Verify at least 1 row of mock data is displayed
    const rows = page.locator('[data-testid="inventory-task-table"] tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Verify the first task name from mock data appears
    await expect(rows.first()).toContainText('2024年Q3办公楼盘点');
  });

  // =========================================================================
  // ATB-02: Create task modal & scope selector
  // =========================================================================
  test('ATB-02: should open create modal, switch scope to location tree, select nodes, and submit', async ({
    page,
  }) => {
    // Track POST request for task creation
    let postedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/inventory/tasks', async (route: Route) => {
      if (route.request().method() === 'POST') {
        postedPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'task-new-001', ...postedPayload },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/inventory/tasks');

    // Click "新建盘点" button
    const createBtn = page.getByRole('button', { name: /新建盘点/ });
    await createBtn.click();

    // Assert Modal appears
    const modal = page.locator('[data-testid="create-task-modal"]');
    await expect(modal).toBeVisible();

    // Fill in task name
    await modal.getByLabel(/任务名称/).fill('2024年Q4新增盘点');

    // Switch scope Radio to "按位置树"
    await modal.getByRole('radio', { name: /按位置树/ }).click();

    // Assert TreeSelect component renders
    const treeSelect = modal.locator('.ant-select, [data-testid="location-tree-select"]');
    await expect(treeSelect).toBeVisible();

    // Open the tree dropdown
    await treeSelect.click();

    // Select 2 location nodes
    const locA = page.getByText('A栋', { exact: true });
    const locB = page.getByText('B栋', { exact: true });
    await locA.click();
    await locB.click();

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');

    // Submit the form
    await modal.getByRole('button', { name: /提交|确认|创建/ }).click();

    // Verify POST payload contains correct locationIds
    expect(postedPayload).not.toBeNull();
    const payload = postedPayload!;
    expect(payload).toHaveProperty('locationIds');
    const locationIds = payload.locationIds as string[];
    expect(locationIds).toEqual(
      expect.arrayContaining(['loc-001-01', 'loc-001-02']),
    );
    expect(locationIds.length).toBe(2);
  });

  // =========================================================================
  // ATB-03: Execution detail page — progress dashboard
  // =========================================================================
  test('ATB-03: should render progress dashboard with correct stats when entering task detail', async ({
    page,
  }) => {
    await page.goto('/inventory/tasks');

    // Click the "进行中" (IN_PROGRESS) task row to enter detail
    const inProgressRow = page
      .locator('[data-testid="inventory-task-table"] tbody tr')
      .filter({ hasText: '进行中' });
    await inProgressRow.click();

    // Assert route navigated to detail page
    await expect(page).toHaveURL(/\/inventory\/tasks\/task-001/);

    // Assert top Progress component is visible and percentage matches mock (40%)
    const progressComponent = page.locator('[data-testid="inventory-progress"]');
    await expect(progressComponent).toBeVisible();
    await expect(progressComponent).toContainText('40');

    // Verify five stat cards with values matching mock data
    const expectedStats: Record<string, number> = {
      '总资产数': MOCK_TASK_DETAIL.summary.totalAssets, // 10
      '已盘': MOCK_TASK_DETAIL.summary.scanned, // 4
      '未盘': MOCK_TASK_DETAIL.summary.notScanned, // 4
      '盘盈': MOCK_TASK_DETAIL.summary.surplus, // 1
      '盘亏': MOCK_TASK_DETAIL.summary.deficit, // 1
    };

    for (const [label, value] of Object.entries(expectedStats)) {
      const statCard = page.locator(`[data-testid="stat-card-${label}"]`);
      await expect(statCard).toBeVisible();
      await expect(statCard).toContainText(String(value));
    }
  });

  // =========================================================================
  // ATB-04: Asset row single & batch confirmation
  // =========================================================================
  test('ATB-04: should update single asset status, highlight row, and batch confirm 3 assets', async ({
    page,
  }) => {
    // Navigate directly to task detail
    await page.goto('/inventory/tasks/task-001');

    // Wait for asset table to render
    const assetTable = page.locator('[data-testid="asset-table"]');
    await expect(assetTable).toBeVisible();

    // --- Single asset status change ---
    const firstRow = assetTable.locator('tbody tr').first();

    // Open the status dropdown in the first row and select "已盘"
    const statusDropdown = firstRow.locator('[data-testid="status-dropdown"]').first();
    await statusDropdown.click();
    await page.getByRole('option', { name: /已盘/ }).click();

    // Enter "正常" in the remark column of the first row
    const remarkInput = firstRow.locator('[data-testid="remark-input"]').first();
    await remarkInput.clear();
    await remarkInput.fill('正常');

    // Assert the row gets a highlight/background change (CSS class or inline style)
    await expect(firstRow).toHaveClass(/ant-table-row-selected|highlighted|status-scanned/);

    // --- Batch confirmation of 3 assets ---
    // Check the first 3 asset rows' checkboxes
    const checkboxes = assetTable.locator('tbody input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Record current "已盘" count
    const scannedCard = page.locator('[data-testid="stat-card-已盘"]');
    const scannedTextBefore = await scannedCard.textContent();
    const scannedBefore = parseInt(scannedTextBefore?.replace(/\D/g, '') || '0', 10);

    // Click "批量确认" button
    const batchBtn = page.getByRole('button', { name: /批量确认/ });
    await batchBtn.click();

    // Confirm in the popup dialog
    const confirmDialog = page.locator('[data-testid="batch-confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      await confirmDialog.getByRole('button', { name: /确认|确定/ }).click();
    }

    // Assert "已盘" stat card increased by 3
    const scannedTextAfter = await scannedCard.textContent();
    const scannedAfter = parseInt(scannedTextAfter?.replace(/\D/g, '') || '0', 10);
    expect(scannedAfter).toBe(scannedBefore + 3);
  });

  // =========================================================================
  // ATB-05: Discrepancy summary & one-click approval submission
  // =========================================================================
  test('ATB-05: should show 2 discrepancy records, submit for approval, and redirect to list', async ({
    page,
  }) => {
    // Track approval POST request
    let approvalRequested = false;
    await page.route('**/api/inventory/approve', async (route: Route) => {
      if (route.request().method() === 'POST') {
        approvalRequested = true;
        const body = route.request().postDataJSON();
        expect(body).toHaveProperty('taskId');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { success: true } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/inventory/tasks/task-001');

    // Scroll to bottom discrepancy panel
    const diffPanel = page.locator('[data-testid="diff-summary-panel"]');
    await diffPanel.scrollIntoViewIfNeeded();
    await expect(diffPanel).toBeVisible();

    // Assert 2 discrepancy records are shown
    const diffRows = diffPanel.locator('[data-testid="diff-record-row"]');
    await expect(diffRows).toHaveCount(2);

    // Verify the specific diff types
    await expect(diffRows.nth(0)).toContainText('盘亏');
    await expect(diffRows.nth(0)).toContainText('iPad Pro 12.9');
    await expect(diffRows.nth(1)).toContainText('盘盈');
    await expect(diffRows.nth(1)).toContainText('未知无线鼠标');

    // Click "一键提交核准" button
    const approveBtn = page.getByRole('button', { name: /一键提交核准/ });
    await approveBtn.click();

    // Confirm in any confirmation popup
    const confirmModal = page.locator('[data-testid="approve-confirm-modal"]');
    if (await confirmModal.isVisible()) {
      await confirmModal.getByRole('button', { name: /确认|确定/ }).click();
    }

    // Verify POST /api/inventory/approve was triggered
    expect(approvalRequested).toBe(true);

    // Verify page redirects back to task list
    await expect(page).toHaveURL(/\/inventory\/tasks$/, { timeout: 5000 });
  });
});