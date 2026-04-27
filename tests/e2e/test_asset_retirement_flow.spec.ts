import { test, expect } from '@playwright/test';
import { test as baseTest } from './test_base';

// ─── Helper ────────────────────────────────────────────────────────────────
async function loginUser(page: any, credentials: any): Promise<any> {
  await page.goto(`${TEST_BASE_URL}/login`);
  await page.fill('[data-testid="username-input"]', credentials.username);
  await page.fill('[data-testid="password-input"]', credentials.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL(`${TEST_BASE_URL}/dashboard`);

  return {
    userId: 'user-001',
    username: credentials.username,
    role: 'ASSET_MANAGER',
    token: 'mock-jwt-token',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────
test.describe('Asset Retirement Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('submit retirement request and track approval status', async ({ page }) => {
    // 1. Login
    const auth = await loginUser(page, { username: 'manager', password: 'pass' });

    // 2. Navigate to asset detail and submit retirement request
    await page.goto('/assets/A001');
    await page.click('[data-testid="retire-btn"]');
    await page.fill('[data-testid="retirement-reason"]', '设备老旧需报废处理，已使用10年');
    await page.click('[data-testid="submit-retirement"]');

    // 3. Verify pending state
    await expect(page.locator('[data-testid="status-badge"]')).toHaveText('待审批');

    // 4. Switch to approver perspective and approve
    await page.goto('/approval-pending');
    await page.click('[data-testid="approve-btn-001"]');
    await page.fill('[data-testid="approval-comment"]', '同意');
    await page.click('[data-testid="confirm-approve"]');

    // 5. Verify final status
    await expect(page.locator('[data-testid="final-status"]')).toHaveText('已报废');
  });

  test('block duplicate retirement request in PENDING_RETIREMENT', async ({ page }) => {
    await loginUser(page, { username: 'manager', password: 'pass' });
    await page.goto('/assets/A002');

    // First request
    await page.click('[data-testid="retire-btn"]');
    await page.fill('[data-testid="retirement-reason"]', '原因1');
    await page.click('[data-testid="submit-retirement"]');
    await expect(page.locator('[data-testid="status-badge"]')).toHaveText('待审批');

    // Second request should be blocked
    await page.click('[data-testid="retire-btn"]');
    await page.fill('[data-testid="retirement-reason"]', '原因2');
    const message = await page.locator('[data-testid="error-message"]').textContent();
    expect(message).toContain('已在待审批中');
  });

  test('retirement approval chain sequential progression', async ({ page }) => {
    await loginUser(page, { username: 'manager', password: 'pass' });
    await page.goto('/approval-chain/AC001/status');

    // Approver 1 approves
    await page.click('[data-testid="approve-level-1"]');
    await page.fill('[data-testid="comment"]', '通过');
    await page.click('[data-testid="confirm"]');
    await expect(page.locator('[data-testid="current-level"]')).toHaveText('2 / 3');

    // Approver 2 approves
    await page.click('[data-testid="approve-level-2"]');
    await page.fill('[data-testid="comment"]', '通过');
    await page.click('[data-testid="confirm"]');
    await expect(page.locator('[data-testid="current-level"]')).toHaveText('3 / 3');

    // Final approval triggers retirement
    await expect(page.locator('[data-testid="final-status"]')).toHaveText('已报废');
  });

  test('reject retirement request terminates chain', async ({ page }) => {
    await loginUser(page, { username: 'approver', password: 'pass' });
    await page.goto('/approval-chain/AC002/status');

    await page.click('[data-testid="reject-btn"]');
    await page.fill('[data-testid="reason"]', '资料不全');
    await page.click('[data-testid="confirm-reject"]');

    await expect(page.locator('[data-testid="status-badge"]')).toHaveText('已驳回');
    await expect(page.locator('[data-testid="notifications"]')).toContainText('已驳回');
  });
});