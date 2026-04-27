/**
 * E2E Test Suite for Asset Import/Export functionality
 * SPEC: [SWARM-P2-006-FE] 资产批量导入导出前端
 *
 * Covers ATB-001 through ATB-020 (except ATB-017 which is a Jest unit test for downloadBlob)
 *
 * API Endpoints:
 *   GET  /api/v1/assets/import/template       — 下载导入模板
 *   POST /api/v1/assets/import/parse           — 上传并解析 Excel (multipart/form-data, field: file)
 *   POST /api/v1/assets/import/commit          — 确认提交解析数据 (JSON body)
 *   POST /api/v1/assets/export                 — 按条件导出 (JSON body, returns file stream)
 *   GET  /api/v1/asset-categories/tree         — 获取分类树
 *   GET  /api/v1/asset-locations/cascade       — 获取位置级联数据
 */

import { test, expect, Page, Download, Route } from '@playwright/test';

/* ───────────────────────── helpers ───────────────────────── */

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEN_MB = 10 * 1024 * 1024; // 10,485,760 bytes

/** Generate a mock .xlsx File object for Playwright setInputFiles */
function mockXlsxFile(size = 1024, name = 'test-assets.xlsx') {
  return {
    name,
    mimeType: XLSX_MIME,
    buffer: Buffer.alloc(size),
  };
}

/** Build a mock parse response with `n` rows, `errorRowNumbers` receiving errors */
function buildParseResponse(n: number, errorRowNumbers: number[] = []) {
  const rows = Array.from({ length: n }, (_, i) => ({
    rowNumber: i + 1,
    name: `测试资产${i + 1}`,
    categoryCode: 'OFFICE',
    statusCode: 'IN_USE',
    locationCode: 'BJ-HD-001',
    purchaseDate: '2024-01-15',
    originalValue: 1000 + i * 100,
  }));

  // Inject empty name for error rows to make errors realistic
  for (const rn of errorRowNumbers) {
    if (rn <= n) rows[rn - 1].name = '';
  }

  const errors: Array<{ rowNumber: number; field: string; message: string }> =
    errorRowNumbers.map((rn) => ({
      rowNumber: rn,
      field: 'name',
      message: '资产名称不能为空',
    }));

  return { parseId: 'parse-mock-001', rows, errors };
}

/** Mock category tree data */
const MOCK_CATEGORY_TREE = [
  {
    title: '办公设备',
    value: 'OFFICE',
    key: 'OFFICE',
    children: [
      { title: '电脑', value: 'OFFICE_PC', key: 'OFFICE_PC' },
      { title: '打印机', value: 'OFFICE_PRINTER', key: 'OFFICE_PRINTER' },
    ],
  },
  {
    title: '家具',
    value: 'FURNITURE',
    key: 'FURNITURE',
  },
];

/** Mock location cascade data */
const MOCK_LOCATION_CASCADE = [
  {
    label: '北京市',
    value: 'BJ',
    children: [
      {
        label: '海淀区',
        value: 'BJ-HD',
        children: [
          { label: '中关村大厦', value: 'BJ-HD-001' },
          { label: '软件园二期', value: 'BJ-HD-002' },
        ],
      },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
 *  ATB-001 : 页面路由与布局
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-001: 页面路由与布局', () => {
  test('页面加载成功，标题包含"资产批量导入导出"', async ({ page }) => {
    const response = await page.goto('/assets/import-export');
    expect(response!.status()).toBe(200);
    await expect(page.locator('text=资产批量导入导出')).toBeVisible();
  });

  test('页面顶部存在"导入"和"导出"两个 Tab', async ({ page }) => {
    await page.goto('/assets/import-export');
    await expect(page.getByRole('tab', { name: '导入' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '导出' })).toBeVisible();
  });

  test('默认选中"导入"Tab，点击可切换到"导出"', async ({ page }) => {
    await page.goto('/assets/import-export');

    // Default: import panel visible, export hidden
    const importTab = page.getByRole('tab', { name: '导入' });
    const exportTab = page.getByRole('tab', { name: '导出' });
    await expect(importTab).toHaveAttribute('aria-selected', 'true');

    // Switch to export
    await exportTab.click();
    await expect(exportTab).toHaveAttribute('aria-selected', 'true');
    await expect(importTab).toHaveAttribute('aria-selected', 'false');
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-002 : Excel 模板下载
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-002: Excel 模板下载', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
  });

  test('点击"下载导入模板"按钮触发浏览器下载，文件名含 asset_import_template', async ({
    page,
  }) => {
    // Mock backend returning 200 + file stream
    await page.route('**/api/v1/assets/import/template', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': XLSX_MIME,
          'Content-Disposition':
            'attachment; filename="asset_import_template.xlsx"',
        },
        body: Buffer.alloc(2048), // mock file content
      });
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /下载导入模板/ }).click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();
    expect(filename).toContain('asset_import_template');
    expect(filename).toMatch(/\.xlsx$/);

    // Verify file has content
    const filePath = await download.path();
    const fs = await import('fs');
    const stats = fs.statSync(filePath!);
    expect(stats.size).toBeGreaterThan(0);
  });

  test('后端返回 500 时页面出现错误 Toast，不触发下载', async ({ page }) => {
    await page.route('**/api/v1/assets/import/template', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    // Track downloads — should NOT fire
    let downloadFired = false;
    page.on('download', () => {
      downloadFired = true;
    });

    await page.getByRole('button', { name: /下载导入模板/ }).click();

    // Expect an error toast
    await expect(page.locator('.ant-message-error, .ant-notification-error')).toBeVisible({
      timeout: 5000,
    });

    // Give a small window for accidental downloads
    await page.waitForTimeout(500);
    expect(downloadFired).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-003 : 拖拽上传区域渲染与交互
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-003: 拖拽上传区域渲染与交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
  });

  test('上传区域显示提示文案"将 .xlsx 文件拖到此处，或点击选择文件"', async ({
    page,
  }) => {
    await expect(
      page.getByText(/将 \.xlsx 文件拖到此处.*点击选择文件/),
    ).toBeVisible();
  });

  test('上传区域内存在 Upload 图标', async ({ page }) => {
    // Ant Design Dragger renders an UploadOutlined icon (svg)
    const uploadIcon = page.locator(
      '.ant-upload-drag-icon svg, .ant-upload-drag-icon .anticon',
    );
    await expect(uploadIcon).toBeVisible();
  });

  test('点击上传区域触发文件选择对话框，input[accept=".xlsx"]', async ({
    page,
  }) => {
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await expect(fileInput).toBeAttached();

    // Verify accept attribute
    const accept = await fileInput.getAttribute('accept');
    expect(accept).toBe('.xlsx');
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-004 : 文件类型校验
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-004: 文件类型校验', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
  });

  test('上传 .csv 文件时出现错误提示"仅支持 .xlsx 格式文件"且不发 API 请求', async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      apiCalled = true;
      await route.abort();
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('a,b,c\n1,2,3'),
    });

    await expect(page.getByText(/仅支持 \.xlsx 格式文件/)).toBeVisible({
      timeout: 5000,
    });
    expect(apiCalled).toBe(false);
  });

  test('上传合法 .xlsx 文件不出现格式错误，触发 /import/parse 请求', async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildParseResponse(5)),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));

    // Should NOT show format error
    await expect(
      page.getByText(/仅支持 \.xlsx 格式文件/),
    ).not.toBeVisible({ timeout: 3000 });

    // API should have been called
    expect(apiCalled).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-005 : 文件大小校验
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-005: 文件大小校验', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
  });

  test('上传超过 10MB 的 .xlsx 文件出现错误提示且不发 API 请求', async ({
    page,
  }) => {
    let apiCalled = false;
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      apiCalled = true;
      await route.abort();
    });

    // Create file > 10MB (10,485,760 bytes)
    const oversizedFile = {
      name: 'huge-file.xlsx',
      mimeType: XLSX_MIME,
      buffer: Buffer.alloc(TEN_MB + 1),
    };

    await page.setInputFiles('input[type="file"]', oversizedFile);

    await expect(page.getByText(/文件大小不能超过 10MB/)).toBeVisible({
      timeout: 5000,
    });
    expect(apiCalled).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-006 : 上传进度条
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-006: 上传进度条', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
  });

  test('上传过程中进度条可见，完成后解析表格出现', async ({ page }) => {
    // Mock slow upload: delay before fulfilling
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildParseResponse(5)),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));

    // Progress bar should appear during upload
    const progressBar = page.locator(
      '.ant-progress, [data-testid="upload-progress"], .upload-progress',
    );
    await expect(progressBar).toBeVisible({ timeout: 3000 });

    // After upload completes, progress disappears and table appears
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await expect(progressBar).not.toBeVisible({ timeout: 5000 });
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-007 : 上传失败重试
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-007: 上传失败重试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
  });

  test('上传失败时进度条变红，出现重试按钮；点击重试后成功', async ({
    page,
  }) => {
    let callCount = 0;

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      callCount++;
      if (callCount === 1) {
        // First call: fail
        await route.fulfill({ status: 500, body: 'Server Error' });
      } else {
        // Second call: succeed
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildParseResponse(5)),
        });
      }
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));

    // Wait for failure state: red progress or error indicator + retry button
    await expect(page.getByText(/上传失败/)).toBeVisible({ timeout: 10000 });

    // Verify retry button exists
    const retryBtn = page.getByRole('button', { name: /重试/ });
    await expect(retryBtn).toBeVisible();

    // Click retry — second call succeeds
    await retryBtn.click();

    // Table should appear after successful retry
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    expect(callCount).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-008 : 解析结果预览表格渲染
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-008: 解析结果预览表格渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildParseResponse(50, [3, 7, 15, 28, 42])),
      });
    });
    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });

  test('表格列头包含：序号、资产名称、分类、状态、位置、购置日期、原值、校验状态', async ({
    page,
  }) => {
    const headerTexts = await page.locator('thead th').allTextContents();
    const joined = headerTexts.join('|');
    expect(joined).toContain('序号');
    expect(joined).toContain('资产名称');
    expect(joined).toContain('分类');
    expect(joined).toContain('状态');
    expect(joined).toContain('位置');
    expect(joined).toContain('购置日期');
    expect(joined).toContain('原值');
    expect(joined).toContain('校验状态');
  });

  test('默认每页 20 行，总计 50 行，分页器显示', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(20);

    // Pagination shows total 50
    const pagination = page.locator('.ant-pagination');
    await expect(pagination).toBeVisible();
    await expect(pagination).toContainText('50');
  });

  test('翻到第 3 页显示第 41-50 行', async ({ page }) => {
    // Go to page 3
    await page.locator('.ant-pagination .ant-pagination-item').nth(2).click();

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(10);

    // First row on page 3 should be rowNumber 41
    const firstRowFirstCell = rows.nth(0).locator('td').first();
    await expect(firstRowFirstCell).toContainText('41');
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-009 : 校验失败行高亮
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-009: 校验失败行高亮', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');

    // Row 3 has error on field "name": "资产名称不能为空"
    const mockResponse = buildParseResponse(10, [3]);

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });

  test('校验失败行（rowNumber=3）背景色为 #FFF2F0', async ({ page }) => {
    const rows = page.locator('tbody tr');
    // Row index 2 corresponds to rowNumber 3
    const errorRow = rows.nth(2);
    const bgColor = await errorRow.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgColor).toBe('rgb(255, 242, 240)'); // #FFF2F0
  });

  test('校验失败行的"资产名称"列显示红色错误文案"资产名称不能为空"', async ({
    page,
  }) => {
    const errorRow = page.locator('tbody tr').nth(2);
    const errorText = errorRow.locator('.cell-error, .ant-typography-danger, [class*="error"]');
    await expect(errorText).toContainText('资产名称不能为空');
  });

  test('校验通过行（rowNumber=1）背景色为 #F6FFED', async ({ page }) => {
    const validRow = page.locator('tbody tr').nth(0);
    const bgColor = await validRow.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgColor).toBe('rgb(246, 255, 237)'); // #F6FFED
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-010 : 行级错误内联修正
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-010: 行级错误内联修正', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');

    const mockResponse = buildParseResponse(10, [3]);

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });

  test('校验失败行的"资产名称"单元格可编辑（存在 Input 框或蓝色下划线）', async ({
    page,
  }) => {
    const errorRow = page.locator('tbody tr').nth(2); // rowNumber=3
    const nameCell = errorRow.locator('td').nth(1); // "资产名称" column

    // Should contain an input or editable indicator
    const input = nameCell.locator('input, .ant-input, [contenteditable="true"]');
    await expect(input).toBeVisible();
  });

  test('编辑后输入值更新，错误提示消失', async ({ page }) => {
    const errorRow = page.locator('tbody tr').nth(2); // rowNumber=3
    const nameCell = errorRow.locator('td').nth(1);
    const input = nameCell.locator('input, .ant-input, [contenteditable="true"]');

    await input.click();
    await input.fill('测试资产A');
    await input.blur();

    // Error message for that cell should disappear
    const errorText = nameCell.locator(
      '.cell-error, .ant-typography-danger, [class*="error"]',
    );
    await expect(errorText).not.toBeVisible({ timeout: 3000 });
  });

  test('校验通过行的单元格不可编辑', async ({ page }) => {
    const validRow = page.locator('tbody tr').nth(0); // rowNumber=1, no errors
    const nameCell = validRow.locator('td').nth(1);
    const input = nameCell.locator(
      'input, .ant-input, [contenteditable="true"]',
    );
    await expect(input).not.toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-011 : 确认提交
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-011: 确认提交', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');

    const mockResponse = buildParseResponse(5, [3]);
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  });

  test('点击"确认导入"按钮发送 /import/commit 请求，展示结果摘要', async ({
    page,
  }) => {
    let commitBody: any = null;

    await page.route('**/api/v1/assets/import/commit', async (route) => {
      const request = route.request();
      commitBody = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          importedCount: 4,
          failedCount: 1,
        }),
      });
    });

    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify commit request body contains parseId and rows
    expect(commitBody).not.toBeNull();
    expect(commitBody.parseId).toBe('parse-mock-001');
    expect(Array.isArray(commitBody.rows)).toBe(true);

    // Verify success summary
    await expect(
      page.getByText(/成功导入 4 条资产.*1 条失败/),
    ).toBeVisible({ timeout: 5000 });
  });

  test('提交成功后按钮文案变为"导入完成"且禁用', async ({ page }) => {
    await page.route('**/api/v1/assets/import/commit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          importedCount: 4,
          failedCount: 1,
        }),
      });
    });

    await page.getByRole('button', { name: /确认导入/ }).click();

    const doneBtn = page.getByRole('button', { name: /导入完成/ });
    await expect(doneBtn).toBeVisible({ timeout: 5000 });
    await expect(doneBtn).toBeDisabled();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-012 : 确认提交防重复
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-012: 确认提交防重复', () => {
  test('提交期间按钮 loading 且 disabled，不发送第二次请求', async ({
    page,
  }) => {
    await page.goto('/assets/import-export');

    const mockResponse = buildParseResponse(5);
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    let commitCallCount = 0;
    await page.route('**/api/v1/assets/import/commit', async (route) => {
      commitCallCount++;
      // Simulate slow server
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

    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await submitBtn.click();

    // Button should be disabled during loading
    await expect(submitBtn).toBeDisabled();

    // Attempt multiple clicks — only one request should be made
    await submitBtn.click({ timeout: 500 }).catch(() => {});
    await submitBtn.click({ timeout: 500 }).catch(() => {});

    // Wait for completion
    await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 });

    // Should have been called exactly once
    expect(commitCallCount).toBe(1);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-013 : 全部行校验失败时禁止提交
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-013: 全部行校验失败时禁止提交', () => {
  test('全部 50 行均有错误时"确认导入"按钮 disabled', async ({ page }) => {
    await page.goto('/assets/import-export');

    // All 50 rows have errors
    const allErrorRows = Array.from({ length: 50 }, (_, i) => i + 1);
    const mockResponse = buildParseResponse(50, allErrorRows);

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await expect(submitBtn).toBeDisabled();
  });

  test('修正 1 行后"确认导入"按钮变为 enabled', async ({ page }) => {
    await page.goto('/assets/import-export');

    // All rows have errors on 'name' field
    const allErrorRows = Array.from({ length: 50 }, (_, i) => i + 1);
    const mockResponse = buildParseResponse(50, allErrorRows);

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

    // Fix the first error row by filling in the name
    const firstRow = page.locator('tbody tr').nth(0);
    const nameCell = firstRow.locator('td').nth(1);
    const input = nameCell.locator('input, .ant-input, [contenteditable="true"]');
    await input.click();
    await input.fill('修正后的资产名称');
    await input.blur();

    // Submit button should now be enabled
    const submitBtn = page.getByRole('button', { name: /确认导入/ });
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-014 : 导出筛选面板渲染
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-014: 导出筛选面板渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');

    // Mock filter data endpoints
    await page.route('**/api/v1/asset-categories/tree', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CATEGORY_TREE),
      });
    });

    await page.route('**/api/v1/asset-locations/cascade', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LOCATION_CASCADE),
      });
    });

    // Switch to export tab
    await page.getByRole('tab', { name: '导出' }).click();
  });

  test('"资产分类"为 TreeSelect 组件，展开有层级结构', async ({ page }) => {
    // Click the TreeSelect to expand
    const categorySelect = page.locator('.ant-select, .ant-tree-select').first();
    await categorySelect.click();

    // Verify tree nodes appear
    await expect(page.getByText('办公设备')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('电脑')).toBeVisible();
  });

  test('"资产状态"为多选 Select，选项含：在用、闲置、维修中、报废', async ({
    page,
  }) => {
    // Find and click the status multi-select (should be the second select-like element)
    const statusSelects = page.locator('.ant-select');
    // Heuristic: the status select is one of the selects on the page
    // Try clicking each to find the one with status options
    const statusOptions = ['在用', '闲置', '维修中', '报废'];

    // Click on the dropdown that corresponds to status
    for (let i = 0; i < (await statusSelects.count()); i++) {
      await statusSelects.nth(i).click();
      const dropdown = page.locator('.ant-select-dropdown');
      const isVisible = await dropdown.isVisible().catch(() => false);
      if (isVisible) {
        const text = await dropdown.textContent();
        if (statusOptions.some((opt) => text?.includes(opt))) {
          for (const opt of statusOptions) {
            await expect(dropdown.getByText(opt)).toBeVisible();
          }
          break;
        }
      }
      // Close dropdown
      await page.keyboard.press('Escape');
    }
  });

  test('"存放位置"为 Cascader 组件，支持省/市/区级联', async ({ page }) => {
    const cascader = page.locator('.ant-cascader, [class*="cascader"]');
    await cascader.click();

    // First level: 北京市
    await expect(page.getByText('北京市')).toBeVisible({ timeout: 3000 });
    await page.getByText('北京市').click();

    // Second level: 海淀区
    await expect(page.getByText('海淀区')).toBeVisible({ timeout: 2000 });
    await page.getByText('海淀区').click();

    // Third level: 中关村大厦
    await expect(page.getByText('中关村大厦')).toBeVisible({ timeout: 2000 });
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-015 : 导出按钮 — 无条件导出确认
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-015: 无条件导出确认', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');

    await page.route('**/api/v1/asset-categories/tree', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.route('**/api/v1/asset-locations/cascade', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.getByRole('tab', { name: '导出' }).click();
  });

  test('不选任何筛选条件点击"导出"弹出确认对话框', async ({ page }) => {
    let exportCalled = false;
    await page.route('**/api/v1/assets/export', async (route) => {
      exportCalled = true;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.alloc(1024),
      });
    });

    await page.getByRole('button', { name: /导出/ }).click();

    // Confirm dialog should appear with specified text
    const modal = page.locator('.ant-modal-confirm, .ant-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(
      modal.getByText(/未设置筛选条件.*将导出全部资产.*是否继续/),
    ).toBeVisible();

    // Click "取消" — dialog closes, no API call
    await modal.getByRole('button', { name: /取消/ }).click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    expect(exportCalled).toBe(false);
  });

  test('点击"确定"发送 /export 请求 body 为空筛选数组', async ({ page }) => {
    let capturedBody: any = null;
    await page.route('**/api/v1/assets/export', async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition':
            'attachment; filename="assets_export.xlsx"',
        },
        body: Buffer.alloc(1024),
      });
    });

    await page.getByRole('button', { name: /导出/ }).click();

    const modal = page.locator('.ant-modal-confirm, .ant-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click "确定"
    await modal.getByRole('button', { name: /确定|确认/ }).click();

    // Wait for request
    await page.waitForTimeout(1000);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody).toEqual({
      categoryCodes: [],
      statusCodes: [],
      locationCodes: [],
    });
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-016 : 导出文件下载
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-016: 导出文件下载', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/assets/import-export');

    await page.route('**/api/v1/asset-categories/tree', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(MOCK_CATEGORY_TREE),
      });
    });
    await page.route('**/api/v1/asset-locations/cascade', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify(MOCK_LOCATION_CASCADE),
      });
    });

    await page.getByRole('tab', { name: '导出' }).click();
  });

  test('选择筛选条件后导出，文件名匹配 资产台账_YYYYMMDD_HHmmss.xlsx', async ({
    page,
  }) => {
    let capturedBody: any = null;

    await page.route('**/api/v1/assets/export', async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition':
            'attachment; filename="assets_export.xlsx"',
        },
        body: Buffer.alloc(2048),
      });
    });

    // Select category filter
    const categorySelect = page.locator('.ant-tree-select, .ant-select').first();
    await categorySelect.click();
    await page.getByText('办公设备').click();

    // Select status filter — click the status multi-select and choose "在用"
    const selects = page.locator('.ant-select');
    for (let i = 0; i < (await selects.count()); i++) {
      await selects.nth(i).click();
      const dropdown = page.locator('.ant-select-dropdown');
      const isVisible = await dropdown.isVisible().catch(() => false);
      if (isVisible) {
        const inUseOption = dropdown.getByText('在用');
        const optionVisible = await inUseOption.isVisible().catch(() => false);
        if (optionVisible) {
          await inUseOption.click();
          break;
        }
      }
      await page.keyboard.press('Escape');
    }

    // Trigger download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出/ }).click();

    // Handle possible confirmation dialog
    const modal = page.locator('.ant-modal-confirm, .ant-modal');
    if (await modal.isVisible().catch(() => false)) {
      await modal.getByRole('button', { name: /确定|确认/ }).click();
    }

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // Filename should match pattern: 资产台账_YYYYMMDD_HHmmss.xlsx
    expect(filename).toMatch(/资产台账_\d{8}_\d{6}\.xlsx/);

    // Verify file has content
    const filePath = await download.path();
    const fs = await import('fs');
    const stats = fs.statSync(filePath!);
    expect(stats.size).toBeGreaterThan(0);

    // Verify request body contains selected filters
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.categoryCodes).toContain('OFFICE');
    expect(capturedBody.statusCodes).toContain('IN_USE');
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-018 : Token 过期处理
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-018: Token 过期处理', () => {
  test('API 返回 401 时展示"登录已过期"Toast 并跳转 /login', async ({
    page,
  }) => {
    // Mock any API to return 401
    await page.route('**/api/v1/assets/import/template', async (route) => {
      await route.fulfill({ status: 401, body: 'Unauthorized' });
    });

    await page.goto('/assets/import-export');

    // Trigger the API call
    await page.getByRole('button', { name: /下载导入模板/ }).click();

    // Should show "登录已过期" toast
    await expect(page.getByText(/登录已过期/)).toBeVisible({ timeout: 5000 });

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-019 : 并发上传防护
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-019: 并发上传防护', () => {
  test('上传过程中拖入第二个文件不接收，显示 Toast 提示', async ({
    page,
  }) => {
    await page.goto('/assets/import-export');

    // Mock a slow upload
    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildParseResponse(5)),
      });
    });

    // Start first upload
    await page.setInputFiles('input[type="file"]', mockXlsxFile(1024));

    // Wait for upload to begin (progress bar or uploading state)
    await page.waitForTimeout(500);

    // Attempt to set a second file — should be blocked
    // The upload area should reject the second file
    await page.setInputFiles('input[type="file"]', mockXlsxFile(512, 'second.xlsx')).catch(() => {});

    // Should show a toast about ongoing upload
    await expect(
      page.getByText(/当前有文件正在上传.*请等待完成/),
    ).toBeVisible({ timeout: 5000 });
  });
});

/* ══════════════════════════════════════════════════════════════
 *  ATB-020 : 大数据量预览性能
 * ══════════════════════════════════════════════════════════════ */

test.describe('ATB-020: 大数据量预览性能', () => {
  test('1000 行数据表格渲染时间 < 3000ms', async ({ page }) => {
    await page.goto('/assets/import-export');

    const mockResponse = buildParseResponse(1000);

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(2048));

    // Measure time from response received to table rendered
    const startTime = Date.now();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30000 });
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(3000);
  });

  test('分页翻页渲染时间 < 500ms', async ({ page }) => {
    await page.goto('/assets/import-export');

    const mockResponse = buildParseResponse(1000);

    await page.route('**/api/v1/assets/import/parse', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await page.setInputFiles('input[type="file"]', mockXlsxFile(2048));
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30000 });

    // Navigate to page 2
    const page2Btn = page.locator('.ant-pagination .ant-pagination-item').nth(1);
    const startTime = Date.now();
    await page2Btn.click();

    // Wait for the table body to update (row count changes)
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(20, { timeout: 5000 });
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(500);
  });
});