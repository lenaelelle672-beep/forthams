/**
 * SWARM-070 E2E: 工单审批流程
 *
 * WO-001 ~ WO-011
 * 状态流转: PENDING → APPROVED/REJECTED → EXECUTING → COMPLETED
 *
 * 覆盖:
 * - 角色切换 (operator / approver) 时的 context 隔离
 * - 审批通过 & 驳回路径
 * - 工单执行 & 完成
 * - 关联资产状态联动
 */

import { test, expect, Browser, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ASSET_NAME = 'E2E-TEST-ASSET-001';
const TEST_ORDER_TITLE = 'E2E-REPAIR-ORDER-001';

async function waitForAssetListPage(page: Page) {
  await expect(page).toHaveURL(/\/assets(?:[?#].*)?$/);
  await expect(page.getByRole('heading', { name: '资产台账' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建资产' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
}

async function gotoWorkOrderCreatePage(page: Page) {
  await page.goto('/workorders/new');
  await expect(page).toHaveURL(/\/workorders\/new(?:[?#].*)?$/);
  await expect(page.getByRole('heading', { name: '新建工单' })).toBeVisible();
  await expect(page.getByLabel('标题 *')).toBeVisible();
}

async function gotoWorkOrderListPage(page: Page) {
  await page.goto('/disposals');
  await expect(page.getByRole('heading', { name: '资产处置管理' })).toBeVisible();
  await page.getByRole('button', { name: /工单管理/ }).click();
  await expect(page.getByRole('button', { name: '新建工单管理' })).toBeVisible();
}

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
// WO-001 ~ WO-011
// ---------------------------------------------------------------------------

test.describe('工单审批流程 (WO-001 ~ WO-011)', () => {
  // -----------------------------------------------------------------------
  // WO-001: Operator creates a work order
  // -----------------------------------------------------------------------
  test('WO-001: operator 创建工单', async ({ page }) => {
    // 当前路由中工单列表合并到资产处置，创建入口为 /workorders/new。
    await gotoWorkOrderCreatePage(page);
  });

  // -----------------------------------------------------------------------
  // WO-002: Associate asset and submit work order
  // -----------------------------------------------------------------------
  test('WO-002: 关联资产并提交工单，POST 返回 201', async ({ page }) => {
    await gotoWorkOrderCreatePage(page);

    // Fill work order details
    await page.getByLabel('标题 *').fill(TEST_ORDER_TITLE);

    // Select type
    await page.locator('select').first().selectOption('REPAIR');

    // Associate asset
    await page.getByPlaceholder('搜索资产编号或名称...').fill(TEST_ASSET_NAME);
    await page.getByRole('button', { name: new RegExp(TEST_ASSET_NAME) }).first().click();

    // Submit and intercept API
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/workorders')
          && resp.request().method() === 'POST'
          && resp.status() === 201,
      ),
      page.getByRole('button', { name: '提交工单' }).click(),
    ]);

    expect(response.status()).toBe(201);
  });

  // -----------------------------------------------------------------------
  // WO-003: Verify work order status is 待审批
  // -----------------------------------------------------------------------
  test('WO-003: 验证工单状态为待审批', async ({ page }) => {
    await gotoWorkOrderListPage(page);

    // Navigate to the order detail
    await page.click(`[data-testid="work-order-row-${TEST_ORDER_TITLE}"]`);
    await page.waitForSelector('[data-testid="work-order-status"]', { timeout: 5000 });

    await expect(page.locator('[data-testid="work-order-status"]')).toHaveText('待审批');
  });

  // -----------------------------------------------------------------------
  // WO-004 & WO-005: Approver approves the work order
  // -----------------------------------------------------------------------
  test('WO-004/WO-005: approver 审批通过工单', async ({ browser }) => {
    // Switch to approver context
    const { context, page } = await createContextWithRole(
      browser,
      '.auth/approver-storage.json',
    );

    try {
      // Navigate to work order detail
      await gotoWorkOrderListPage(page);

      await page.click(`[data-testid="work-order-row-${TEST_ORDER_TITLE}"]`);
      await page.waitForSelector('[data-testid="work-order-status"]', { timeout: 5000 });

      // Click approve button
      await page.click('[data-testid="btn-approve"]');

      // Fill approval comment
      await page.waitForSelector('[data-testid="input-approval-comment"]', { timeout: 5000 });
      await page.fill('[data-testid="input-approval-comment"]', 'E2E APPROVED');

      // Submit approval
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().match(/\/api\/workorders\/[^/]+\/approve/) !== null
            && resp.status() === 200,
        ),
        page.click('[data-testid="btn-confirm-approve"]'),
      ]);

      expect(response.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  // -----------------------------------------------------------------------
  // WO-006: Verify work order status changed to 已审批
  // -----------------------------------------------------------------------
  test('WO-006: 验证工单状态变更为已审批', async ({ page }) => {
    await gotoWorkOrderListPage(page);

    await page.click(`[data-testid="work-order-row-${TEST_ORDER_TITLE}"]`);
    await page.waitForSelector('[data-testid="work-order-status"]', { timeout: 5000 });

    await expect(page.locator('[data-testid="work-order-status"]')).toHaveText('已审批');
  });

  // -----------------------------------------------------------------------
  // WO-007 & WO-008: Operator executes the work order
  // -----------------------------------------------------------------------
  test('WO-007/WO-008: operator 执行工单，状态变为执行中', async ({ browser }) => {
    const { context, page } = await createContextWithRole(
      browser,
      '.auth/operator-storage.json',
    );

    try {
      await gotoWorkOrderListPage(page);

      await page.click(`[data-testid="work-order-row-${TEST_ORDER_TITLE}"]`);
      await page.waitForSelector('[data-testid="work-order-status"]', { timeout: 5000 });

      // Click execute button
      await page.click('[data-testid="btn-execute"]');

      // Fill execution result
      await page.waitForSelector('[data-testid="input-execution-result"]', { timeout: 5000 });
      await page.fill('[data-testid="input-execution-result"]', 'E2E维修执行中');

      // Submit
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().match(/\/api\/workorders\/[^/]+\/execute/) !== null
            && resp.status() === 200,
        ),
        page.getByRole('button', { name: '提交工单' }).click(),
      ]);

      expect(response.status()).toBe(200);

      // Verify status
      await expect(page.locator('[data-testid="work-order-status"]')).toHaveText('执行中');
    } finally {
      await context.close();
    }
  });

  // -----------------------------------------------------------------------
  // WO-009: Complete the work order
  // -----------------------------------------------------------------------
  test('WO-009: 完成工单', async ({ page }) => {
    await gotoWorkOrderListPage(page);

    await page.click(`[data-testid="work-order-row-${TEST_ORDER_TITLE}"]`);
    await page.waitForSelector('[data-testid="work-order-status"]', { timeout: 5000 });

    // Click complete button
    await page.click('[data-testid="btn-complete"]');

    // Fill completion report
    await page.waitForSelector('[data-testid="input-completion-report"]', { timeout: 5000 });
    await page.fill('[data-testid="input-completion-report"]', 'E2E维修完成');

    // Submit
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().match(/\/api\/workorders\/[^/]+\/complete/) !== null
          && resp.status() === 200,
      ),
      page.getByRole('button', { name: '提交工单' }).click(),
    ]);

    expect(response.status()).toBe(200);

    // Verify status
    await expect(page.locator('[data-testid="work-order-status"]')).toHaveText('已完成');
  });

  // -----------------------------------------------------------------------
  // WO-010: Verify linked asset status transition
  // -----------------------------------------------------------------------
  test('WO-010: 验证关联资产状态联动', async ({ page }) => {
    // Navigate to asset detail
    await page.goto('/assets');
    await waitForAssetListPage(page);

    const row = page.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
    await row.click();

    // On asset detail page, status should have transitioned from 维修中
    await page.waitForSelector('[data-testid="asset-status"]', { timeout: 5000 });

    const statusText = await page.locator('[data-testid="asset-status"]').textContent();
    // After work order completion, asset should be back to 在库 or 使用中
    expect(statusText).toMatch(/在库|使用中/);
  });

  // -----------------------------------------------------------------------
  // WO-011: Verify rejection path
  // -----------------------------------------------------------------------
  test('WO-011: 验证审批驳回路径', async ({ browser }) => {
    // Use operator to create a new order for rejection test
    const { context: opCtx, page: opPage } = await createContextWithRole(
      browser,
      '.auth/operator-storage.json',
    );

    try {
      // Create work order for rejection
      await gotoWorkOrderCreatePage(opPage);

      await opPage.getByLabel('标题 *').fill('E2E-REJECT-ORDER-001');
      await opPage.locator('select').first().selectOption('REPAIR');
      await opPage.getByPlaceholder('搜索资产编号或名称...').fill(TEST_ASSET_NAME);
      await opPage.getByRole('button', { name: new RegExp(TEST_ASSET_NAME) }).first().click();

      const [createResponse] = await Promise.all([
        opPage.waitForResponse(
          (resp) => resp.url().includes('/api/workorders')
            && resp.request().method() === 'POST'
            && resp.status() === 201,
        ),
        opPage.getByRole('button', { name: '提交工单' }).click(),
      ]);
      expect(createResponse.status()).toBe(201);
    } finally {
      await opCtx.close();
    }

    // Switch to approver to reject
    const { context: appCtx, page: appPage } = await createContextWithRole(
      browser,
      '.auth/approver-storage.json',
    );

    try {
      await gotoWorkOrderListPage(appPage);

      await appPage.click('[data-testid="work-order-row-E2E-REJECT-ORDER-001"]');
      await appPage.waitForSelector('[data-testid="work-order-status"]', { timeout: 5000 });

      // Click reject
      await appPage.click('[data-testid="btn-reject"]');

      // Fill rejection reason
      await appPage.waitForSelector('[data-testid="input-rejection-reason"]', { timeout: 5000 });
      await appPage.fill('[data-testid="input-rejection-reason"]', 'E2E测试驳回');

      const [rejectResponse] = await Promise.all([
        appPage.waitForResponse(
          (resp) => resp.url().match(/\/api\/workorders\/[^/]+\/reject/) !== null
            && resp.status() === 200,
        ),
        appPage.click('[data-testid="btn-confirm-reject"]'),
      ]);
      expect(rejectResponse.status()).toBe(200);

      // Verify status is 已驳回
      await expect(appPage.locator('[data-testid="work-order-status"]')).toHaveText('已驳回');
    } finally {
      await appCtx.close();
    }

    // Verify asset status did NOT change (still 在库/使用中)
    const { context: verifyCtx, page: verifyPage } = await createContextWithRole(
      browser,
      '.auth/admin-storage.json',
    );

    try {
      await verifyPage.goto('/assets');
      await waitForAssetListPage(verifyPage);

      const row = verifyPage.locator(`[data-testid="asset-row-${TEST_ASSET_NAME}"]`);
      const statusText = await row.locator('[data-testid="asset-status"]').textContent();
      expect(statusText).toMatch(/在库|使用中/);
    } finally {
      await verifyCtx.close();
    }
  });
});
