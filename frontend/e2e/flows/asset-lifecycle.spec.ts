/**
 * SWARM-070 E2E: 资产生命周期流程
 *
 * LC-001 ~ LC-010
 * 状态流转: DRAFT → IN_STOCK → IN_USE → RETURNED → UNDER_REPAIR
 *
 * 约束:
 * - 优先使用 data-testid 选择器
 * - 使用 waitForResponse / waitForSelector 显式等待
 * - 同时校验 UI 文本与 API 响应
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TEST_ASSET_NAME = 'E2E-TEST-ASSET-001';
const TEST_ASSET_CATEGORY = 'IT设备';
const TEST_ASSET_LOCATION = '机房A';

// ---------------------------------------------------------------------------
// LC-001 ~ LC-010: Asset lifecycle serial tests
// ---------------------------------------------------------------------------

test.describe('资产生命周期全流程 (LC-001 ~ LC-010)', () => {
  let createdAssetId: string;

  // -----------------------------------------------------------------------
  // LC-001: Navigate to asset list page
  // -----------------------------------------------------------------------
  test('LC-001: 导航至资产列表页，表格可见', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="asset-list-table"]')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // LC-002: Open asset creation form
  // -----------------------------------------------------------------------
  test('LC-002: 点击新增资产按钮，表单可见', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    await page.click('[data-testid="btn-add-asset"]');

    // Either route changes or a modal appears
    const modal = page.locator('[data-testid="modal-asset-form"]');
    const isNewRoute = page.url().includes('/assets/new');

    await expect(
      modal.isVisible().then((v) => v || isNewRoute),
    ).resolves.toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // LC-003: Fill form and submit, verify API returns 201
  // -----------------------------------------------------------------------
  test('LC-003: 填写资产表单并提交，POST 返回 201', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });
    await page.click('[data-testid="btn-add-asset"]');

    // Wait for the form to appear
    await page.waitForSelector('[data-testid="input-asset-name"]', { timeout: 5000 });

    await page.fill('[data-testid="input-asset-name"]', TEST_ASSET_NAME);
    await page.fill('[data-testid="input-asset-category"]', TEST_ASSET_CATEGORY);
    await page.fill('[data-testid="input-asset-location"]', TEST_ASSET_LOCATION);

    // Submit and intercept API
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/assets') && resp.request().method() === 'POST' && resp.status() === 201,
      ),
      page.click('[data-testid="btn-submit"]'),
    ]);

    const body = await response.json();
    expect(body.data?.id || body.id).toBeTruthy();
    createdAssetId = String(body.data?.id ?? body.id);
  });

  // -----------------------------------------------------------------------
  // LC-004: Verify the new row appears in the list with status 草稿
  // -----------------------------------------------------------------------
  test('LC-004: 列表新增记录存在，状态为草稿', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await expect(row).toBeVisible();

    const statusCell = row.locator('[data-testid="asset-status"]');
    await expect(statusCell).toHaveText('草稿');
  });

  // -----------------------------------------------------------------------
  // LC-005: Stock-in operation
  // -----------------------------------------------------------------------
  test('LC-005: 执行入库操作', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await expect(row).toBeVisible();

    // Click the stock-in action button
    await row.locator('[data-testid="btn-action-stock-in"]').click();

    // Confirm the modal
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().match(/\/api\/assets\/[^/]+\/status/) !== null
          && resp.request().method() === 'PUT'
          && resp.status() === 200,
      ),
      page.click('[data-testid="btn-confirm"]'),
    ]);

    const body = await response.json();
    const requestBody = response.request().postDataJSON?.() ?? {};
    expect(requestBody.targetStatus ?? body.data?.status).toContain('IN_STOCK');
  });

  // -----------------------------------------------------------------------
  // LC-006: Verify status changed to 在库
  // -----------------------------------------------------------------------
  test('LC-006: 验证状态变更为在库', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    const statusCell = row.locator('[data-testid="asset-status"]');
    await expect(statusCell).toHaveText('在库');
  });

  // -----------------------------------------------------------------------
  // LC-007: Assign asset to operator
  // -----------------------------------------------------------------------
  test('LC-007: 执行领用操作', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.locator('[data-testid="btn-action-assign"]').click();

    // Fill assignee
    await page.waitForSelector('[data-testid="input-assignee"]', { timeout: 5000 });
    await page.fill('[data-testid="input-assignee"]', 'operator');

    // Submit and intercept API
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().match(/\/api\/assets\/[^/]+\/assign/) !== null
          && resp.status() === 200,
      ),
      page.click('[data-testid="btn-submit"]'),
    ]);

    expect(response.status()).toBe(200);
  });

  // -----------------------------------------------------------------------
  // LC-008: Verify status changed to 使用中
  // -----------------------------------------------------------------------
  test('LC-008: 验证状态变更为使用中', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    const statusCell = row.locator('[data-testid="asset-status"]');
    await expect(statusCell).toHaveText('使用中');
  });

  // -----------------------------------------------------------------------
  // LC-009: Return the asset
  // -----------------------------------------------------------------------
  test('LC-009: 执行归还操作，状态变为已归还', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.locator('[data-testid="btn-action-return"]').click();

    // Confirm return
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().match(/\/api\/assets\/[^/]+\/return/) !== null
          && resp.status() === 200,
      ),
      page.click('[data-testid="btn-confirm"]'),
    ]);

    expect(response.status()).toBe(200);

    // Verify status changed
    const statusCell = row.locator('[data-testid="asset-status"]');
    await expect(statusCell).toHaveText('已归还');
  });

  // -----------------------------------------------------------------------
  // LC-010: Register for repair
  // -----------------------------------------------------------------------
  test('LC-010: 执行维修登记，状态变为维修中', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.locator('[data-testid="btn-action-repair"]').click();

    // Fill fault description
    await page.waitForSelector('[data-testid="input-fault-desc"]', { timeout: 5000 });
    await page.fill('[data-testid="input-fault-desc"]', 'E2E测试-模拟故障');

    // Submit and intercept
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().match(/\/api\/assets\/[^/]+\/repair/) !== null
          && resp.status() === 200,
      ),
      page.click('[data-testid="btn-submit"]'),
    ]);

    expect(response.status()).toBe(200);

    // Verify status changed
    const statusCell = row.locator('[data-testid="asset-status"]');
    await expect(statusCell).toHaveText('维修中');
  });
});
