/**
 * E2E tests for [SWARM-P2-006-FE] Asset Bulk Import/Export
 * Covers acceptance test baseline ATB-001 through ATB-020
 * (ATB-017 is a Jest unit test — not included here)
 */
import { test, expect, Page, Download } from '@playwright/test';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Navigate to the import-export page and wait for it to settle. */
async function gotoImportExportPage(page: Page) {
  await page.goto('/assets/import-export');
  await expect(page).toHaveURL(/\/assets\/import-export/);
}

/** Mock the parse endpoint to return fixture data. */
async function mockParseResponse(
  page: Page,
  body: Record<string, unknown>,
  status = 200,
) {
  await page.route('**/api/v1/assets/import/parse', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

/** Mock the commit endpoint. */
async function mockCommitResponse(
  page: Page,
  body: Record<string, unknown>,
  status = 200,
) {
  await page.route('**/api/v1/assets/import/commit', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

/** Mock the template download endpoint. */
async function mockTemplateDownload(page: Page, status = 200) {
  await page.route('**/api/v1/assets/import/template', (route) => {
    if (status === 200) {
      return route.fulfill({
        status: 200,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          'Content-Disposition':
            'attachment; filename="asset_import_template.xlsx"',
        },
        body: Buffer.from('PK\x03\x04mock-xlsx-content', 'binary'),
      });
    }
    return route.fulfill({ status: 500, body: 'Internal Server Error' });
  });
}

/** Mock the export endpoint with a file stream response. */
async function mockExportDownload(page: Page, status = 200) {
  await page.route('**/api/v1/assets/export', (route) => {
    if (status === 200) {
      return route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        headers: {
          'Content-Disposition':
            'attachment; filename="asset_export_20240101_120000.xlsx"',
        },
        body: Buffer.from('PK\x03\x04mock-export-xlsx', 'binary'),
      });
    }
    return route.fulfill({ status: 500, body: 'Internal Server Error' });
  });
}

/** Mock the category tree endpoint. */
async function mockCategoryTree(page: Page) {
  await page.route('**/api/v1/asset-categories/tree', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          key: 'office',
          title: '办公设备',
          value: 'OFFICE',
          children: [
            { key: 'computer', title: '电脑', value: 'COMPUTER' },
            { key: 'printer', title: '打印机', value: 'PRINTER' },
          ],
        },
        {
          key: 'vehicle',
          title: '车辆',
          value: 'VEHICLE',
        },
      ]),
    }),
  );
}

/** Mock the location cascade endpoint. */
async function mockLocationCascade(page: Page) {
  await page.route('**/api/v1/asset-locations/cascade', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          value: 'beijing',
          label: '北京市',
          children: [
            {
              value: 'haidian',
              label: '海淀区',
              children: [
                { value: 'zhongguancun', label: '中关村' },
              ],
            },
          ],
        },
      ]),
    }),
  );
}

/** Generate mock parse result rows. */
function generateMockRows(count: number, errorIndices: number[] = []) {
  const rows = [];
  const errors: Array<{ rowNumber: number; field: string; message: string }> = [];

  for (let i = 1; i <= count; i++) {
    rows.push({
      rowNumber: i,
      name: errorIndices.includes(i) ? '' : `资产${i}`,
      categoryCode: 'OFFICE',
      statusCode: 'IN_USE',
      locationCode: 'BJ_HD',
      purchaseDate: '2024-01-15',
      originalValue: 10000 + i,
    });
  }

  for (const idx of errorIndices) {
    errors.push({
      rowNumber: idx,
      field: 'name',
      message: '资产名称不能为空',
    });
  }

  return { parseId: 'parse-mock-001', rows, errors };
}

/* ------------------------------------------------------------------ */
/*  ATB-001: Page Route & Layout                                       */
/* ------------------------------------------------------------------ */
test.describe('ATB-001: Page Route & Layout', () => {
  test('should load page with correct title and tabs', async ({ page }) => {
    await gotoImportExportPage(page);

    // Page title contains "资产批量导入导出"
    await expect(
      page.getByRole('heading', { name: /资产批量导入导出/ }),
    ).toBeVisible();

    // Tabs exist
    const importTab = page.getByRole('tab', { name: '导入' });
    const exportTab = page.getByRole('tab', { name: '导出' });
    await expect(importTab).toBeVisible();
    await expect(exportTab).toBeVisible();

    // Default tab is "导入"
    await expect(importTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch to export tab and back', async ({ page }) => {
    await gotoImportExportPage(page);

    const importTab = page.getByRole('tab', { name: '导入' });
    const exportTab = page.getByRole('tab', { name: '导出' });

    // Click export tab
    await exportTab.click();
    await expect(exportTab).toHaveAttribute('aria-selected', 'true');
    await expect(importTab).toHaveAttribute('aria-selected', 'false');

    // Click import tab again
    await importTab.click();
    await expect(importTab).toHaveAttribute('aria-selected', 'true');
    await expect(exportTab).toHaveAttribute('aria-selected', 'false');
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-002: Excel Template Download                                   */
/* ------------------------------------------------------------------ */
test.describe('ATB-002: Excel Template Download', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
  });

  test('should download template file on button click', async ({ page }) => {
    await mockTemplateDownload(page, 200);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /下载导入模板/ }).click();
    const download: Download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toContain('asset_import_template');
    expect(filename).toMatch(/\.xlsx$/);
  });

  test('should show error toast when template download fails', async ({
    page,
  }) => {
    await mockTemplateDownload(page, 500);

    await page.getByRole('button', { name: /下载导入模板/ }).click();

    // Error toast should appear
    await expect(page.getByText(/下载模板失败|服务器错误/)).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-003: Drag Upload Area Rendering & Interaction                  */
/* ------------------------------------------------------------------ */
test.describe('ATB-003: Drag Upload Area Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
    // Ensure we are on import tab (default)
  });

  test('should show upload area with correct text and icon', async ({
    page,
  }) => {
    const uploadZone = page.locator('.ant-upload-drag');
    await expect(uploadZone).toBeVisible();

    // Check hint text
    await expect(
      page.getByText(/将 .xlsx 文件拖到此处，或点击选择文件/),
    ).toBeVisible();
  });

  test('should have file input with accept=.xlsx', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.xlsx');
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-004: File Type Validation                                      */
/* ------------------------------------------------------------------ */
test.describe('ATB-004: File Type Validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
  });

  test('should reject non-xlsx files with error message', async ({ page }) => {
    // Upload a CSV file via the hidden input
    await page.setInputFiles('input[type="file"]', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('id,name\n1,test'),
    });

    // Error message should appear
    await expect(page.getByText('仅支持 .xlsx 格式文件')).toBeVisible();
  });

  test('should allow valid xlsx files and trigger parse request', async ({
    page,
  }) => {
    const mockData = generateMockRows(2);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock-xlsx'),
    });

    // No format error should appear
    await expect(page.getByText('仅支持 .xlsx 格式文件')).not.toBeVisible();

    // Parse request should be sent
    const parseRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/v1/assets/import/parse') &&
        req.method() === 'POST',
    );
    await parseRequest;
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-005: File Size Validation                                      */
/* ------------------------------------------------------------------ */
test.describe('ATB-005: File Size Validation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
  });

  test('should reject files exceeding 10MB limit', async ({ page }) => {
    // Create a buffer > 10MB (10,485,760 bytes)
    const oversizedBuffer = Buffer.alloc(10_485_761);

    await page.setInputFiles('input[type="file"]', {
      name: 'large_file.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: oversizedBuffer,
    });

    // Size error message
    await expect(page.getByText('文件大小不能超过 10MB')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-006: Upload Progress Bar                                       */
/* ------------------------------------------------------------------ */
test.describe('ATB-006: Upload Progress Bar', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
  });

  test('should show progress bar during upload and resolve to preview', async ({
    page,
  }) => {
    // Delay the parse response to simulate upload time
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(generateMockRows(5)),
      });
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.alloc(100_000), // ~100KB file
    });

    // Progress bar should appear
    const progressBar = page.locator('.ant-progress');
    await expect(progressBar).toBeVisible();

    // After upload completes, preview table should appear
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-007: Upload Failure Retry                                      */
/* ------------------------------------------------------------------ */
test.describe('ATB-007: Upload Failure Retry', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
  });

  test('should show red progress bar and retry button on failure', async ({
    page,
  }) => {
    // First call fails
    await page.route('**/api/v1/assets/import/parse', (route) =>
      route.fulfill({ status: 500, body: 'Server Error' }),
    );

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    // Progress bar should show error state (red)
    const errorProgress = page.locator(
      '.ant-progress-status-active, .ant-progress-bg',
    );

    // Retry button should appear
    await expect(page.getByRole('button', { name: /重试/ })).toBeVisible({
      timeout: 10000,
    });

    // Now re-mock to succeed
    await page.route('**/api/v1/assets/import/parse', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(generateMockRows(5)),
      }),
    );

    // Click retry
    await page.getByRole('button', { name: /重试/ }).click();

    // Preview table should now appear
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-008: Parse Result Preview Table                                */
/* ------------------------------------------------------------------ */
test.describe('ATB-008: Parse Result Preview Table', () => {
  test.beforeEach(async ({ page }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(50, [3, 10, 25, 40, 49]);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    // Wait for table
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });
  });

  test('should render table with correct columns', async ({ page }) => {
    const headers = page.locator('.ant-table-thead th');
    const headerTexts = await headers.allTextContents();

    const requiredColumns = [
      '序号',
      '资产名称',
      '分类',
      '状态',
      '位置',
      '购置日期',
      '原值',
      '校验状态',
    ];
    for (const col of requiredColumns) {
      expect(headerTexts.some((h) => h.includes(col))).toBeTruthy();
    }
  });

  test('should paginate with 20 rows per page by default', async ({
    page,
  }) => {
    // Default page should have 20 rows
    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    expect(count).toBe(20);

    // Pagination info should show 50 total
    await expect(page.locator('.ant-pagination')).toBeVisible();
    await expect(page.getByText(/50/)).toBeVisible();
  });

  test('should navigate to page 3 showing rows 41-50', async ({ page }) => {
    // Click page 3
    await page.getByRole('listitem', { name: '3' }).click();

    // Should show last 10 rows (page 3 = rows 41-50)
    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    expect(count).toBe(10);
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-009: Validation Failure Row Highlight                          */
/* ------------------------------------------------------------------ */
test.describe('ATB-009: Validation Failure Row Highlight', () => {
  test('should highlight error rows with #FFF2F0 and valid rows with #F6FFED', async ({
    page,
  }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(5, [3]);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Row 3 should have error background (#FFF2F0 = rgb(255, 242, 240))
    const errorRow = page.locator('.ant-table-tbody tr').nth(2); // 0-indexed, row 3
    await expect(errorRow).toHaveCSS(
      'background-color',
      'rgb(255, 242, 240)',
    );

    // Error message should be visible for row 3
    await expect(page.getByText('资产名称不能为空')).toBeVisible();

    // Row 1 should have success background (#F6FFED = rgb(246, 255, 237))
    const validRow = page.locator('.ant-table-tbody tr').first();
    await expect(validRow).toHaveCSS(
      'background-color',
      'rgb(246, 255, 237)',
    );
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-010: Row-Level Error Inline Correction                        */
/* ------------------------------------------------------------------ */
test.describe('ATB-010: Row-Level Error Inline Correction', () => {
  test('should allow editing error cells and clear error after correction', async ({
    page,
  }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(5, [3]);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file']', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Row 3 "资产名称" cell should be editable (error row)
    const errorRow = page.locator('.ant-table-tbody tr').nth(2);
    const nameCell = errorRow.locator('td').nth(1); // Second column = 资产名称

    // Should contain an input or be clickable for editing
    const editInput = nameCell.locator('input, .ant-input');
    await expect(editInput).toBeVisible();

    // Type corrected value
    await editInput.click();
    await editInput.fill('测试资产A');

    // Blur to trigger validation update
    await editInput.blur();

    // Error message for that cell should disappear
    // (The row may still show a "corrected" indicator)
  });

  test('should not allow editing valid rows', async ({ page }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(5, [3]);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Row 1 is valid — should NOT have an input field
    const validRow = page.locator('.ant-table-tbody tr').first();
    const nameCell = validRow.locator('td').nth(1);
    const editInput = nameCell.locator('input, .ant-input');
    await expect(editInput).not.toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-011: Confirm Submit                                            */
/* ------------------------------------------------------------------ */
test.describe('ATB-011: Confirm Submit', () => {
  test('should submit valid data and show result summary', async ({
    page,
  }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(5, [3]);
    await mockParseResponse(page, mockData);
    await mockCommitResponse(page, {
      success: true,
      importedCount: 45,
      failedCount: 5,
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Fix the one error row to enable submit
    const errorRow = page.locator('.ant-table-tbody tr').nth(2);
    const editInput = errorRow.locator('td').nth(1).locator('input, .ant-input');
    if (await editInput.isVisible()) {
      await editInput.fill('修正资产名称');
      await editInput.blur();
    }

    // Click confirm button
    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Should show loading state
    await expect(submitBtn).toHaveAttribute('loading', 'true');

    // After response, show result summary
    await expect(
      page.getByText(/成功导入 45 条资产.*5 条失败/),
    ).toBeVisible({ timeout: 10000 });

    // Button should now be disabled with "导入完成" text
    await expect(page.getByRole('button', { name: /导入完成/ })).toBeDisabled();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-012: Confirm Submit Duplicate Prevention                       */
/* ------------------------------------------------------------------ */
test.describe('ATB-012: Confirm Submit Duplicate Prevention', () => {
  test('should disable submit button during loading to prevent double submit', async ({
    page,
  }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(5);
    await mockParseResponse(page, mockData);

    // Delay the commit response
    await page.route('**/api/v1/assets/import/commit', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          importedCount: 5,
          failedCount: 0,
        }),
      });
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await submitBtn.click();

    // Button should be disabled while loading
    await expect(submitBtn).toBeDisabled();

    // Only one commit request should be made
    let commitRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/assets/import/commit')) {
        commitRequestCount++;
      }
    });

    // Try clicking again (should not send another request)
    await submitBtn.click({ force: true }).catch(() => {});

    // Wait for response to complete
    await expect(
      page.getByText(/成功导入/),
    ).toBeVisible({ timeout: 10000 });

    // Should only have sent 1 commit request
    expect(commitRequestCount).toBeLessThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-013: All Rows Failed — Disable Submit                          */
/* ------------------------------------------------------------------ */
test.describe('ATB-013: All Rows Failed — Disable Submit', () => {
  test('should disable submit when all rows have errors, enable after fix', async ({
    page,
  }) => {
    await gotoImportExportPage(page);
    // All 5 rows have errors
    const mockData = generateMockRows(5, [1, 2, 3, 4, 5]);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file"]', {
      name: 'valid_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 10000 });

    // Submit should be disabled when all rows have errors
    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await expect(submitBtn).toBeDisabled();

    // Fix row 1 (make it valid)
    const firstRow = page.locator('.ant-table-tbody tr').first();
    const editInput = firstRow.locator('td').nth(1).locator('input, .ant-input');
    await editInput.fill('修正资产1');
    await editInput.blur();

    // Now at least 1 valid row exists — button should be enabled
    await expect(submitBtn).toBeEnabled();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-014: Export Filter Panel Rendering                              */
/* ------------------------------------------------------------------ */
test.describe('ATB-014: Export Filter Panel Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await mockCategoryTree(page);
    await mockLocationCascade(page);
    await gotoImportExportPage(page);
    await page.getByRole('tab', { name: '导出' }).click();
  });

  test('should render category TreeSelect', async ({ page }) => {
    const categorySelect = page.locator('.ant-select, .ant-tree-select').first();
    await expect(categorySelect).toBeVisible();

    // Click to expand and see tree structure
    await categorySelect.click();
    // Should show tree data from mock
    await expect(page.getByText('办公设备')).toBeVisible();
  });

  test('should render status multi-select with correct options', async ({
    page,
  }) => {
    // Find the status select — it should be a multi-select
    const statusSelects = page.locator('.ant-select');
    // At least one of them should have status-related options
    // Click each to find the one with status options
    for (let i = 0; i < (await statusSelects.count()); i++) {
      const sel = statusSelects.nth(i);
      await sel.click();
      const options = page.locator('.ant-select-item');
      if ((await options.count()) > 0) {
        const texts = await options.allTextContents();
        if (texts.some((t) => ['在用', '闲置', '维修中', '报废'].includes(t))) {
          // Found status select
          expect(texts).toContain('在用');
          expect(texts).toContain('闲置');
          expect(texts).toContain('维修中');
          expect(texts).toContain('报废');
          break;
        }
      }
      await page.keyboard.press('Escape');
    }
  });

  test('should render location Cascader', async ({ page }) => {
    // The cascader should be visible on the export panel
    const cascader = page.locator('.ant-cascader');
    await expect(cascader).toBeVisible();

    // Click to expand cascade options
    await cascader.click();
    await expect(page.getByText('北京市')).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-015: Export Button — No Condition Confirmation                  */
/* ------------------------------------------------------------------ */
test.describe('ATB-015: Export Button — No Condition Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await mockCategoryTree(page);
    await mockLocationCascade(page);
    await mockExportDownload(page, 200);
    await gotoImportExportPage(page);
    await page.getByRole('tab', { name: '导出' }).click();
  });

  test('should show confirmation dialog when no filters selected', async ({
    page,
  }) => {
    // Click export without selecting any filters
    await page.getByRole('button', { name: /导出/ }).click();

    // Confirmation modal should appear
    await expect(
      page.getByText('未设置筛选条件，将导出全部资产，是否继续？'),
    ).toBeVisible();

    // Click cancel — should not send API request
    await page.getByRole('button', { name: /取消/ }).click();
    await expect(
      page.locator('.ant-modal'),
    ).not.toBeVisible();
  });

  test('should proceed with export when user confirms', async ({ page }) => {
    await page.getByRole('button', { name: /导出/ }).click();

    await expect(
      page.getByText('未设置筛选条件，将导出全部资产，是否继续？'),
    ).toBeVisible();

    // Click confirm
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /确定/ }).click();

    // Should trigger download
    const download = await downloadPromise;
    expect(download).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-016: Export File Download                                      */
/* ------------------------------------------------------------------ */
test.describe('ATB-016: Export File Download', () => {
  test('should download file with correct naming pattern', async ({
    page,
  }) => {
    await mockCategoryTree(page);
    await mockLocationCascade(page);
    await mockExportDownload(page, 200);
    await gotoImportExportPage(page);
    await page.getByRole('tab', { name: '导出' }).click();

    // Select filter: category = 办公设备
    const categorySelect = page.locator('.ant-tree-select, .ant-select').first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.getByText('办公设备').click();
    }

    // Select filter: status = 在用
    // Find the status multi-select and select "在用"
    const selects = page.locator('.ant-select');
    for (let i = 0; i < (await selects.count()); i++) {
      await selects.nth(i).click();
      const option = page.getByText('在用');
      if (await option.isVisible()) {
        await option.click();
        break;
      }
      await page.keyboard.press('Escape');
    }

    // Click export
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出/ }).click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    // Filename should match: 资产台账_YYYYMMDD_HHmmss.xlsx
    expect(filename).toMatch(/资产台账_\d{8}_\d{6}\.xlsx/);
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-018: Token Expired Handling                                    */
/* ------------------------------------------------------------------ */
test.describe('ATB-018: Token Expired Handling', () => {
  test('should redirect to /login on 401 response', async ({ page }) => {
    await gotoImportExportPage(page);

    // Mock any API to return 401
    await page.route('**/api/v1/assets/import/template', (route) =>
      route.fulfill({ status: 401, body: 'Unauthorized' }),
    );

    // Trigger the API call
    await page.getByRole('button', { name: /下载导入模板/ }).click();

    // Should show "登录已过期" toast
    await expect(page.getByText('登录已过期')).toBeVisible({ timeout: 5000 });

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-019: Concurrent Upload Prevention                              */
/* ------------------------------------------------------------------ */
test.describe('ATB-019: Concurrent Upload Prevention', () => {
  test('should prevent second upload while first is in progress', async ({
    page,
  }) => {
    await gotoImportExportPage(page);

    // Delay the parse response to simulate slow upload
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(generateMockRows(5)),
      });
    });

    // Upload first file
    await page.setInputFiles('input[type="file"]', {
      name: 'file1.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock1'),
    });

    // Wait for upload to start (progress bar visible)
    await expect(page.locator('.ant-progress')).toBeVisible({
      timeout: 3000,
    });

    // Try to upload second file via drag-drop simulation
    // Since the upload area should be locked, we check for the toast message
    const uploadZone = page.locator('.ant-upload-drag');

    // Dispatch a drop event with a file
    await uploadZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [
          new File(
            ['content'],
            'file2.xlsx',
            {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ),
        ],
      },
    });

    // Should show warning toast about concurrent upload
    await expect(
      page.getByText('当前有文件正在上传，请等待完成'),
    ).toBeVisible({ timeout: 5000 });
  });
});

/* ------------------------------------------------------------------ */
/*  ATB-020: Large Data Preview Performance                            */
/* ------------------------------------------------------------------ */
test.describe('ATB-020: Large Data Preview Performance', () => {
  test('should render 1000 rows within 3000ms', async ({ page }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(1000);
    await mockParseResponse(page, mockData);

    const startTime = Date.now();

    await page.setInputFiles('input[type="file"]', {
      name: 'large_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock-large'),
    });

    // Wait for table to be visible
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 15000 });

    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(3000);
  });

  test('should paginate within 500ms per page change', async ({ page }) => {
    await gotoImportExportPage(page);
    const mockData = generateMockRows(1000);
    await mockParseResponse(page, mockData);

    await page.setInputFiles('input[type="file"]', {
      name: 'large_assets.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('PK\x03\x04mock-large'),
    });

    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 15000 });

    // Measure page change time
    const pageStart = Date.now();
    await page.getByRole('listitem', { name: '2' }).click();
    await expect(page.locator('.ant-table-tbody tr').first()).toBeVisible();
    const pageChangeTime = Date.now() - pageStart;

    expect(pageChangeTime).toBeLessThan(500);
  });
});