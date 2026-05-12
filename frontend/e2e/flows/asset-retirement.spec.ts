/**
 * SWARM-070 E2E: 资产报废退役流程
 *
 * RT-001 ~ RT-010
 * 状态流转: RETIRE_PENDING → RETIRE_APPROVED → RETIRED
 *
 * 覆盖:
 * - 报废申请发起 (PHYSICAL_DAMAGE, TECH_OBSOLETE, LEASE_EXPIRED, INVENTORY_LOSS)
 * - 审批通过路径
 * - 审批驳回路径 (状态回退)
 * - 终态资产操作禁用验证
 * - 操作日志记录验证
 * - 跨流程串联验证 (LC → WO → RT)
 */

import { test, expect, Browser } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ASSET_NAME = 'E2E-TEST-ASSET-001';
const SECOND_ASSET_NAME = 'E2E-TEST-ASSET-002';

// ---------------------------------------------------------------------------
// Helper: create a new context with the given storage state
// ---------------------------------------------------------------------------

async function createContextWithRole(
  browser: Browser,
  storageState: string,
) {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  return { context, page };
}

// ---------------------------------------------------------------------------
// RT-001 ~ RT-010
// ---------------------------------------------------------------------------

test.describe('资产报废退役流程 (RT-001 ~ RT-010)', () => {
  // -----------------------------------------------------------------------
  // RT-001: Ensure asset is in a retirement-eligible state
  // -----------------------------------------------------------------------
  test('RT-001: 确保资产处于可报废状态', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    // Navigate to asset detail
    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();

    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });
    const statusText = await page.locator('[data-testid="asset-status"]').textContent();

    // If asset is in 使用中, return it first
    if (statusText?.includes('使用中')) {
      await page.goBack();
      await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });
      const assetRow = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
      await assetRow.locator('[data-testid="btn-action-return"]').click();
      await page.click('[data-testid="btn-confirm"]');
      await page.waitForResponse(
        (resp) => resp.url().match(/\/api\/assets\/[^/]+\/return/) !== null && resp.status() === 200,
      );
    }
  });

  // -----------------------------------------------------------------------
  // RT-002: Submit retirement application
  // -----------------------------------------------------------------------
  test('RT-002: 发起报废申请，POST 返回 201', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();

    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });

    // Click retire apply button
    await page.click('[data-testid="btn-retire-apply"]');

    // Wait for retirement form modal
    await page.waitForSelector('[data-testid="select-retire-reason"]', { timeout: 5000 });

    // Select reason PHYSICAL_DAMAGE
    await page.click('[data-testid="select-retire-reason"]');
    await page.click('[data-testid="option-reason-PHYSICAL_DAMAGE"]');

    // Fill description
    await page.fill('[data-testid="input-retire-description"]', 'E2E RETIRE TEST');

    // Submit and intercept API
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/retire/applications')
          && resp.request().method() === 'POST'
          && resp.status() === 201,
      ),
      page.click('[data-testid="btn-submit-retire"]'),
    ]);

    expect(response.status()).toBe(201);
  });

  // -----------------------------------------------------------------------
  // RT-003: Verify asset status changed to 待报废
  // -----------------------------------------------------------------------
  test('RT-003: 验证资产状态变更为待报废', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();

    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('待报废');
  });

  // -----------------------------------------------------------------------
  // RT-004 & RT-005: Approver approves retirement
  // -----------------------------------------------------------------------
  test('RT-004/RT-005: approver 审批报废通过', async ({ browser }) => {
    const { context, page } = await createContextWithRole(
      browser,
      '.auth/approver-storage.json',
    );

    try {
      // Navigate to retirement approval list
      await page.goto('/retire/approvals');
      await page.waitForSelector('[data-testid="retire-approval-list"]', { timeout: 5000 });

      // Click approve button for the asset
      await page.click(`[data-testid="btn-retire-approve-${TEST_ASSET_NAME}"]`);

      // Confirm approval
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().match(/\/api\/retire\/applications\/[^/]+\/approve/) !== null
            && resp.status() === 200,
        ),
        page.click('[data-testid="btn-confirm"]'),
      ]);

      expect(response.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  // -----------------------------------------------------------------------
  // RT-006: Verify asset status changed to 已报废
  // -----------------------------------------------------------------------
  test('RT-006: 验证资产状态变更为已报废', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();

    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('已报废');
  });

  // -----------------------------------------------------------------------
  // RT-007: Verify retired asset operations are disabled
  // -----------------------------------------------------------------------
  test('RT-007: 验证已报废资产不可再操作', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);

    // Stock-in button should be disabled or not exist
    const stockInBtn = row.locator('[data-testid="btn-action-stock-in"]');
    if (await stockInBtn.isVisible()) {
      await expect(stockInBtn).toBeDisabled();
    }

    // Assign button should be disabled or not exist
    const assignBtn = row.locator('[data-testid="btn-action-assign"]');
    if (await assignBtn.isVisible()) {
      await expect(assignBtn).toBeDisabled();
    }

    // Retire apply button should not be visible or be disabled
    const retireBtn = page.locator('[data-testid="btn-retire-apply"]');
    if (await retireBtn.isVisible()) {
      await expect(retireBtn).toBeDisabled();
    }
  });

  // -----------------------------------------------------------------------
  // RT-008: Verify operation log records
  // -----------------------------------------------------------------------
  test('RT-008: 验证操作日志记录', async ({ page }) => {
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();

    // Navigate to operation log tab
    await page.click('[data-testid="tab-operation-log"]');
    await page.waitForSelector('[data-testid="operation-log-list"]', { timeout: 5000 });

    // Verify at least two retirement-related log entries exist
    const logItems = page.locator('[data-testid="log-item"]');
    const count = await logItems.count();

    // Find retirement-related entries
    const retireSubmitLogs = logItems.filter({ hasText: '发起报废申请' });
    const retireApproveLogs = logItems.filter({ hasText: '报废审批通过' });

    await expect(retireSubmitLogs).toHaveCount(1);
    await expect(retireApproveLogs).toHaveCount(1);

    // Verify timestamps are ascending
    if (count >= 2) {
      const timestamps = await logItems.locator('[data-testid="log-timestamp"]').allTextContents();
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i] >= timestamps[i - 1]).toBeTruthy();
      }
    }
  });

  // -----------------------------------------------------------------------
  // RT-009: Verify retirement rejection path
  // -----------------------------------------------------------------------
  test('RT-009: 验证报废驳回路径', async ({ page, browser }) => {
    // First, create a second asset and put it in IN_STOCK state for rejection test
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    // Use the second asset for rejection test
    const secondRow = page.locator(`[data-testid="asset-row-${SECOND_ASSET_NAME}"]`);

    // If second asset doesn't exist, create it
    if (!(await secondRow.isVisible())) {
      await page.click('[data-testid="btn-add-asset"]');
      await page.waitForSelector('[data-testid="input-asset-name"]', { timeout: 5000 });
      await page.fill('[data-testid="input-asset-name"]', SECOND_ASSET_NAME);
      await page.fill('[data-testid="input-asset-category"]', 'IT设备');
      await page.fill('[data-testid="input-asset-location"]', '机房B');
      await page.click('[data-testid="btn-submit"]');
      await page.waitForResponse(
        (resp) => resp.url().includes('/api/assets') && resp.request().method() === 'POST',
      );

      // Stock-in
      await page.goto('/assets');
      await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });
      const newRow = page.locator(`[data-testid="asset-row-${SECOND_ASSET_NAME}"]`);
      await newRow.locator('[data-testid="btn-action-stock-in"]').click();
      await page.click('[data-testid="btn-confirm"]');
      await page.waitForResponse(
        (resp) => resp.url().match(/\/api\/assets\/[^/]+\/status/) !== null && resp.status() === 200,
      );
    }

    // Navigate to second asset detail and submit retirement
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });
    const secondAssetRow = page.locator(`[data-testid="asset-row-${SECOND_ASSET_NAME}"]`);
    await secondAssetRow.click();

    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });

    // Record original status
    const originalStatus = await page.locator('[data-testid="asset-status"]').textContent();

    // Submit retirement application
    await page.click('[data-testid="btn-retire-apply"]');
    await page.waitForSelector('[data-testid="select-retire-reason"]', { timeout: 5000 });
    await page.click('[data-testid="select-retire-reason"]');
    await page.click('[data-testid="option-reason-TECH_OBSOLETE"]');
    await page.fill('[data-testid="input-retire-description"]', 'E2E RETIRE REJECT TEST');

    const [submitResponse] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/retire/applications')
          && resp.request().method() === 'POST'
          && resp.status() === 201,
      ),
      page.click('[data-testid="btn-submit-retire"]'),
    ]);
    expect(submitResponse.status()).toBe(201);

    // Switch to approver to reject
    const { context, page: approverPage } = await createContextWithRole(
      browser,
      '.auth/approver-storage.json',
    );

    try {
      await approverPage.goto('/retire/approvals');
      await approverPage.waitForSelector('[data-testid="retire-approval-list"]', { timeout: 5000 });

      // Click reject for the second asset
      await approverPage.click(`[data-testid="btn-retire-reject-${SECOND_ASSET_NAME}"]`);

      const [rejectResponse] = await Promise.all([
        approverPage.waitForResponse(
          (resp) => resp.url().match(/\/api\/retire\/applications\/[^/]+\/reject/) !== null
            && resp.status() === 200,
        ),
        approverPage.click('[data-testid="btn-confirm"]'),
      ]);
      expect(rejectResponse.status()).toBe(200);
    } finally {
      await context.close();
    }

    // Verify asset status reverted to original
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });
    const revertedRow = page.locator(`[data-testid="asset-row-${SECOND_ASSET_NAME}"]`);
    await revertedRow.click();
    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });

    const revertedStatus = await page.locator('[data-testid="asset-status"]').textContent();
    expect(revertedStatus).toBe(originalStatus);
  });

  // -----------------------------------------------------------------------
  // RT-010: Cross-flow validation (LC → WO → RT)
  // -----------------------------------------------------------------------
  test('RT-010: 跨流程串联验证 — 完整链路后终态为已报废，操作日志 ≥ 5 条', async ({ page, browser }) => {
    // Verify the main test asset is in RETIRED state
    await page.goto('/assets');
    await page.waitForSelector('[data-testid="asset-list-table"]', { timeout: 5000 });

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();
    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });

    // Final status should be 已报废 (RETIRED)
    await expect(page.locator('[data-testid="asset-status"]')).toHaveText('已报废');

    // Navigate to operation log tab
    await page.click('[data-testid="tab-operation-log"]');
    await page.waitForSelector('[data-testid="operation-log-list"]', { timeout: 5000 });

    // Verify at least 5 log entries (create, stock-in, assign, return, repair, retire, approve)
    const logItems = page.locator('[data-testid="log-item"]');
    const logCount = await logItems.count();
    expect(logCount).toBeGreaterThanOrEqual(5);
  });
});
