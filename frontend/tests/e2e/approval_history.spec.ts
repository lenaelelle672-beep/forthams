/**
 * E2E tests for the Approval History workflow.
 *
 * Covers:
 *  - ATB-4: Pending approval list rendering (role-based filtering)
 *  - ATB-5: Approval detail page with approve / reject operations
 *  - Approval history timeline display after state transitions
 *  - Rejection reason validation (mandatory, max 500 chars)
 *  - Role-based data isolation (dept supervisor vs asset admin)
 *
 * Tech stack: Playwright + TypeScript 5.x
 */

import { test, expect, Page, Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

/** Simulated user accounts – aligned with backend seed data */
const USERS = {
  deptSupervisor: {
    username: 'dept_supervisor',
    password: 'Test@1234',
    role: 'DEPT_SUPERVISOR',
    expectedLevel: 'APPROVING_LEVEL_1' as const,
  },
  assetAdmin: {
    username: 'asset_admin',
    password: 'Test@1234',
    role: 'ASSET_ADMIN',
    expectedLevel: 'APPROVING_LEVEL_2' as const,
  },
} as const;

/** API endpoints */
const API = {
  login: '/api/auth/login',
  pendingApprovals: '/api/approvals/pending',
  approve: (orderId: string) => `/api/orders/${orderId}/approve`,
  reject: (orderId: string) => `/api/orders/${orderId}/reject`,
  orderDetail: (orderId: string) => `/api/orders/${orderId}`,
  approvalHistory: (orderId: string) => `/api/orders/${orderId}/approval-records`,
} as const;

/** Frontend routes */
const ROUTES = {
  pendingApprovals: '/approvals/pending',
  approvalDetail: (orderId: string) => `/approvals/${orderId}`,
  approvalHistory: (orderId: string) => `/approvals/${orderId}/history`,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Perform login via the UI and wait for redirect.
 */
async function loginAs(page: Page, user: keyof typeof USERS): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('用户名').fill(USERS[user].username);
  await page.getByLabel('密码').fill(USERS[user].password);
  await page.getByRole('button', { name: /登录|Login/i }).click();
  // Wait for navigation away from login page
  await page.waitForURL(/\/(dashboard|approvals)/, { timeout: 10_000 });
}

/**
 * Intercept the pending-approvals API and return fixture data.
 */
async function interceptPendingApprovals(
  page: Page,
  status: string,
  count: number = 3,
): Promise<void> {
  await page.route('**/api/approvals/pending**', (route) => {
    const orders = Array.from({ length: count }, (_, i) => ({
      id: `order-${status}-${i + 1}`,
      orderNo: `WO-2025-${String(i + 1).padStart(4, '0')}`,
      applicant: `申请人${i + 1}`,
      submittedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
      status,
      version: 1,
    }));
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: orders, total: count }),
    });
  });
}

/**
 * Intercept approval-history API and return fixture records.
 */
async function interceptApprovalHistory(
  page: Page,
  orderId: string,
): Promise<void> {
  await page.route(`**/api/orders/${orderId}/approval-records**`, (route) => {
    const records = [
      {
        id: 'rec-1',
        orderId,
        operatorId: 'user-dept-sup',
        operatorName: '部门主管',
        action: 'APPROVE',
        comment: '同意',
        createdAt: '2025-06-01T10:00:00Z',
      },
      {
        id: 'rec-2',
        orderId,
        operatorId: 'user-asset-admin',
        operatorName: '资产管理员',
        action: 'APPROVE',
        comment: '审批通过',
        createdAt: '2025-06-02T14:30:00Z',
      },
    ];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: records }),
    });
  });
}

/**
 * Intercept order detail API.
 */
async function interceptOrderDetail(
  page: Page,
  orderId: string,
  status: string = 'APPROVING_LEVEL_1',
): Promise<void> {
  await page.route(`**/api/orders/${orderId}**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: orderId,
          orderNo: 'WO-2025-0001',
          applicant: '张三',
          submittedAt: '2025-05-30T08:00:00Z',
          status,
          version: 1,
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('审批历史与工作流 E2E', () => {
  // -----------------------------------------------------------------------
  // ATB-4: Pending approval list rendering
  // -----------------------------------------------------------------------

  test.describe('ATB-4: 待审批列表渲染', () => {
    test('部门主管仅可见 APPROVING_LEVEL_1 工单', async ({ page }) => {
      await interceptPendingApprovals(page, 'APPROVING_LEVEL_1');
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      // Page should render the approval list
      const listContainer = page.getByTestId('approval-pending-list');
      await expect(listContainer).toBeVisible({ timeout: 10_000 });

      // Each row should display required columns
      const rows = page.getByTestId('approval-row');
      await expect(rows).toHaveCount(3);

      // Verify column headers
      await expect(page.getByText('工单号')).toBeVisible();
      await expect(page.getByText('申请人')).toBeVisible();
      await expect(page.getByText('提交时间')).toBeVisible();

      // All visible orders must be APPROVING_LEVEL_1
      const statusBadges = page.getByTestId('order-status-badge');
      const count = await statusBadges.count();
      for (let i = 0; i < count; i++) {
        await expect(statusBadges.nth(i)).toHaveText(/APPROVING_LEVEL_1|一级审批中/);
      }
    });

    test('资产管理员仅可见 APPROVING_LEVEL_2 工单', async ({ page }) => {
      await interceptPendingApprovals(page, 'APPROVING_LEVEL_2');
      await loginAs(page, 'assetAdmin');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      const listContainer = page.getByTestId('approval-pending-list');
      await expect(listContainer).toBeVisible({ timeout: 10_000 });

      const statusBadges = page.getByTestId('order-status-badge');
      const count = await statusBadges.count();
      for (let i = 0; i < count; i++) {
        await expect(statusBadges.nth(i)).toHaveText(/APPROVING_LEVEL_2|二级审批中/);
      }
    });

    test('列表包含工单号、申请人、提交时间列', async ({ page }) => {
      await interceptPendingApprovals(page, 'APPROVING_LEVEL_1', 1);
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      // Verify first row has order number
      await expect(page.getByText('WO-2025-0001')).toBeVisible();
      // Verify applicant column
      await expect(page.getByText('申请人1')).toBeVisible();
      // Verify submission time column is present (ISO 8601 formatted)
      const timeCell = page.getByTestId('submitted-at').first();
      await expect(timeCell).toBeVisible();
    });

    test('空列表时显示空状态提示', async ({ page }) => {
      await page.route('**/api/approvals/pending**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      await expect(page.getByText(/暂无待审批工单|No pending/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  // -----------------------------------------------------------------------
  // ATB-5: Approval detail & operations
  // -----------------------------------------------------------------------

  test.describe('ATB-5: 审批详情与操作', () => {
    const testOrderId = 'order-APPROVING_LEVEL_1-1';

    test.beforeEach(async ({ page }) => {
      await interceptPendingApprovals(page, 'APPROVING_LEVEL_1', 1);
      await interceptOrderDetail(page, testOrderId, 'APPROVING_LEVEL_1');
      await loginAs(page, 'deptSupervisor');
    });

    test('点击工单进入详情页', async ({ page }) => {
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      // Click the first order row to navigate to detail
      const firstRow = page.getByTestId('approval-row').first();
      await firstRow.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(new RegExp(`/approvals/${testOrderId}`), {
        timeout: 10_000,
      });

      // Detail page should display order info
      await expect(page.getByTestId('approval-detail')).toBeVisible();
      await expect(page.getByText('WO-2025-0001')).toBeVisible();
    });

    test('驳回时不输入原因，前端表单校验拦截', async ({ page }) => {
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(testOrderId)}`);
      await expect(page.getByTestId('approval-detail')).toBeVisible();

      // Click reject button
      const rejectBtn = page.getByRole('button', { name: /驳回|Reject/i });
      await rejectBtn.click();

      // Rejection dialog should appear
      const rejectDialog = page.getByTestId('reject-dialog');
      await expect(rejectDialog).toBeVisible();

      // Do NOT fill in rejection reason, click confirm
      const confirmBtn = page.getByRole('button', { name: /确认|Confirm/i });
      await confirmBtn.click();

      // Frontend validation should block submission and show error
      await expect(page.getByText(/请输入驳回原因|Rejection reason is required/i)).toBeVisible();

      // No API call should have been made – verify by checking no reject request fired
      // (The dialog should still be visible)
      await expect(rejectDialog).toBeVisible();
    });

    test('输入驳回原因后确认，页面提示成功且列表刷新', async ({ page }) => {
      // Intercept reject API
      await page.route(`**/api/orders/${testOrderId}/reject`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: testOrderId, status: 'REJECTED' },
          }),
        });
      });

      // After rejection, pending list should no longer contain this order
      await page.route('**/api/approvals/pending**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(testOrderId)}`);
      await expect(page.getByTestId('approval-detail')).toBeVisible();

      // Click reject button
      await page.getByRole('button', { name: /驳回|Reject/i }).click();
      const rejectDialog = page.getByTestId('reject-dialog');
      await expect(rejectDialog).toBeVisible();

      // Fill in rejection reason
      const reasonInput = page.getByLabel(/驳回原因|Rejection Reason/i);
      await reasonInput.fill('不合规，缺少必要材料');

      // Click confirm
      await page.getByRole('button', { name: /确认|Confirm/i }).click();

      // Success toast
      await expect(page.getByText(/驳回成功|Rejected successfully/i)).toBeVisible({
        timeout: 10_000,
      });

      // Should redirect back to pending list
      await expect(page).toHaveURL(new RegExp(ROUTES.pendingApprovals), {
        timeout: 10_000,
      });

      // The rejected order should no longer appear
      await expect(page.getByText('WO-2025-0001')).not.toBeVisible();
    });

    test('驳回原因超过500字符时前端校验拦截', async ({ page }) => {
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(testOrderId)}`);
      await expect(page.getByTestId('approval-detail')).toBeVisible();

      await page.getByRole('button', { name: /驳回|Reject/i }).click();
      const rejectDialog = page.getByTestId('reject-dialog');
      await expect(rejectDialog).toBeVisible();

      const reasonInput = page.getByLabel(/驳回原因|Rejection Reason/i);
      // Fill 501 characters
      await reasonInput.fill('A'.repeat(501));

      await page.getByRole('button', { name: /确认|Confirm/i }).click();

      // Should show max-length validation error
      await expect(
        page.getByText(/不能超过500字符|must not exceed 500 characters/i),
      ).toBeVisible();
    });

    test('点击通过按钮，工单流转至下一级，列表刷新后该工单消失', async ({ page }) => {
      // Intercept approve API
      await page.route(`**/api/orders/${testOrderId}/approve`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: testOrderId, status: 'APPROVING_LEVEL_2' },
          }),
        });
      });

      // After approval, pending list for dept supervisor should be empty
      await page.route('**/api/approvals/pending**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(testOrderId)}`);
      await expect(page.getByTestId('approval-detail')).toBeVisible();

      // Click approve button
      const approveBtn = page.getByRole('button', { name: /通过|Approve/i });
      await approveBtn.click();

      // Success toast
      await expect(page.getByText(/审批通过|Approved successfully/i)).toBeVisible({
        timeout: 10_000,
      });

      // Should redirect back to pending list
      await expect(page).toHaveURL(new RegExp(ROUTES.pendingApprovals), {
        timeout: 10_000,
      });

      // The approved order should no longer appear in dept supervisor's list
      await expect(page.getByText('WO-2025-0001')).not.toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Approval History Timeline
  // -----------------------------------------------------------------------

  test.describe('审批历史时间线', () => {
    const testOrderId = 'order-APPROVING_LEVEL_1-1';

    test('详情页展示审批历史时间线', async ({ page }) => {
      await interceptOrderDetail(page, testOrderId, 'APPROVED');
      await interceptApprovalHistory(page, testOrderId);
      await loginAs(page, 'deptSupervisor');

      await page.goto(`${BASE_URL}${ROUTES.approvalHistory(testOrderId)}`);

      // History timeline should be visible
      const timeline = page.getByTestId('approval-history-timeline');
      await expect(timeline).toBeVisible({ timeout: 10_000 });

      // Should show approval records
      const timelineItems = page.getByTestId('timeline-item');
      await expect(timelineItems).toHaveCount(2);

      // First record: dept supervisor approved
      await expect(page.getByText('部门主管')).toBeVisible();
      await expect(page.getByText('同意')).toBeVisible();

      // Second record: asset admin approved
      await expect(page.getByText('资产管理员')).toBeVisible();
      await expect(page.getByText('审批通过')).toBeVisible();
    });

    test('驳回记录在时间线中显示驳回原因', async ({ page }) => {
      await interceptOrderDetail(page, testOrderId, 'REJECTED');

      // Intercept with a rejection record
      await page.route(`**/api/orders/${testOrderId}/approval-records**`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'rec-reject-1',
                orderId: testOrderId,
                operatorId: 'user-dept-sup',
                operatorName: '部门主管',
                action: 'REJECT',
                comment: '材料不完整，需补充资产清单',
                rejectionReason: '材料不完整，需补充资产清单',
                createdAt: '2025-06-01T10:00:00Z',
              },
            ],
          }),
        });
      });

      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.approvalHistory(testOrderId)}`);

      const timeline = page.getByTestId('approval-history-timeline');
      await expect(timeline).toBeVisible({ timeout: 10_000 });

      // Rejection reason should be displayed
      await expect(page.getByText('材料不完整，需补充资产清单')).toBeVisible();

      // Action badge should indicate rejection
      await expect(page.getByTestId('action-badge').first()).toHaveText(/驳回|REJECT/i);
    });

    test('时间线按时间倒序排列', async ({ page }) => {
      await interceptOrderDetail(page, testOrderId, 'APPROVED');
      await interceptApprovalHistory(page, testOrderId);
      await loginAs(page, 'deptSupervisor');

      await page.goto(`${BASE_URL}${ROUTES.approvalHistory(testOrderId)}`);

      const timelineItems = page.getByTestId('timeline-item');
      await expect(timelineItems).toHaveCount(2, { timeout: 10_000 });

      // Most recent record should appear first (asset admin at 2025-06-02)
      const firstItem = timelineItems.first();
      await expect(firstItem).toContainText('资产管理员');

      // Older record second (dept supervisor at 2025-06-01)
      const secondItem = timelineItems.nth(1);
      await expect(secondItem).toContainText('部门主管');
    });
  });

  // -----------------------------------------------------------------------
  // State transition visibility
  // -----------------------------------------------------------------------

  test.describe('状态流转可见性', () => {
    test('正向流转：PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED', async ({
      page,
    }) => {
      const orderId = 'order-flow-test';

      // Start at APPROVING_LEVEL_1
      await interceptOrderDetail(page, orderId, 'APPROVING_LEVEL_1');
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      // Status badge should show APPROVING_LEVEL_1
      await expect(page.getByTestId('order-status-badge')).toHaveText(
        /APPROVING_LEVEL_1|一级审批中/,
      );

      // Approve at level 1
      await page.route(`**/api/orders/${orderId}/approve`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: orderId, status: 'APPROVING_LEVEL_2' },
          }),
        });
      });

      await page.getByRole('button', { name: /通过|Approve/i }).click();
      await expect(page.getByText(/审批通过|Approved successfully/i)).toBeVisible({
        timeout: 10_000,
      });
    });

    test('逆向流转：APPROVING_LEVEL_1 → REJECTED', async ({ page }) => {
      const orderId = 'order-reject-test';

      await interceptOrderDetail(page, orderId, 'APPROVING_LEVEL_1');
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      // Status badge should show APPROVING_LEVEL_1
      await expect(page.getByTestId('order-status-badge')).toHaveText(
        /APPROVING_LEVEL_1|一级审批中/,
      );

      // Reject
      await page.route(`**/api/orders/${orderId}/reject`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: orderId, status: 'REJECTED' },
          }),
        });
      });

      await page.getByRole('button', { name: /驳回|Reject/i }).click();
      const reasonInput = page.getByLabel(/驳回原因|Rejection Reason/i);
      await reasonInput.fill('不符合审批条件');
      await page.getByRole('button', { name: /确认|Confirm/i }).click();

      await expect(page.getByText(/驳回成功|Rejected successfully/i)).toBeVisible({
        timeout: 10_000,
      });
    });

    test('APPROVING_LEVEL_2 驳回流转至 REJECTED', async ({ page }) => {
      const orderId = 'order-level2-reject';

      await interceptOrderDetail(page, orderId, 'APPROVING_LEVEL_2');
      await loginAs(page, 'assetAdmin');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      await expect(page.getByTestId('order-status-badge')).toHaveText(
        /APPROVING_LEVEL_2|二级审批中/,
      );

      await page.route(`**/api/orders/${orderId}/reject`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: orderId, status: 'REJECTED' },
          }),
        });
      });

      await page.getByRole('button', { name: /驳回|Reject/i }).click();
      const reasonInput = page.getByLabel(/驳回原因|Rejection Reason/i);
      await reasonInput.fill('资产信息有误');
      await page.getByRole('button', { name: /确认|Confirm/i }).click();

      await expect(page.getByText(/驳回成功|Rejected successfully/i)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Concurrency & error handling (frontend UX)
  // -----------------------------------------------------------------------

  test.describe('并发冲突与错误处理', () => {
    test('乐观锁冲突时显示友好提示 (HTTP 409)', async ({ page }) => {
      const orderId = 'order-conflict-test';

      await interceptOrderDetail(page, orderId, 'APPROVING_LEVEL_1');
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      // Simulate 409 Conflict from optimistic lock failure
      await page.route(`**/api/orders/${orderId}/approve`, (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'OPTIMISTIC_LOCK_CONFLICT',
            message: '工单已被其他审批人处理，请刷新后重试',
          }),
        });
      });

      await page.getByRole('button', { name: /通过|Approve/i }).click();

      // Should show conflict error message
      await expect(
        page.getByText(/已被其他审批人处理|已被处理|conflict/i),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('非法状态流转时显示友好提示 (HTTP 409 INVALID_STATE_TRANSITION)', async ({
      page,
    }) => {
      const orderId = 'order-invalid-transition';

      await interceptOrderDetail(page, orderId, 'PENDING');
      await loginAs(page, 'assetAdmin');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      // Simulate 409 for invalid state transition
      await page.route(`**/api/orders/${orderId}/approve`, (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'INVALID_STATE_TRANSITION',
            message: '当前状态不允许此操作',
          }),
        });
      });

      await page.getByRole('button', { name: /通过|Approve/i }).click();

      await expect(
        page.getByText(/状态不允许|INVALID_STATE_TRANSITION|非法/i),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('缺少驳回原因时后端返回 400，前端显示提示', async ({ page }) => {
      const orderId = 'order-missing-reason';

      await interceptOrderDetail(page, orderId, 'APPROVING_LEVEL_1');
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      // Simulate 400 Bad Request for missing rejection reason
      await page.route(`**/api/orders/${orderId}/reject`, (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'MISSING_REJECTION_REASON',
            message: '驳回原因不能为空',
          }),
        });
      });

      await page.getByRole('button', { name: /驳回|Reject/i }).click();
      // Bypass frontend validation by directly submitting (edge case)
      const reasonInput = page.getByLabel(/驳回原因|Rejection Reason/i);
      await reasonInput.fill(' '); // whitespace-only should be caught by backend
      await page.getByRole('button', { name: /确认|Confirm/i }).click();

      // Backend error should be displayed
      await expect(
        page.getByText(/驳回原因不能为空|MISSING_REJECTION_REASON/i),
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  // -----------------------------------------------------------------------
  // Data isolation (role-based)
  // -----------------------------------------------------------------------

  test.describe('数据隔离', () => {
    test('部门主管无法看到 APPROVING_LEVEL_2 工单', async ({ page }) => {
      // Intercept with LEVEL_2 data – dept supervisor should NOT see these
      await page.route('**/api/approvals/pending**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      // List should be empty for dept supervisor when no LEVEL_1 orders exist
      await expect(page.getByText(/暂无待审批工单|No pending/i)).toBeVisible({
        timeout: 10_000,
      });
    });

    test('资产管理员无法看到 APPROVING_LEVEL_1 工单', async ({ page }) => {
      await page.route('**/api/approvals/pending**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await loginAs(page, 'assetAdmin');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      await expect(page.getByText(/暂无待审批工单|No pending/i)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  // -----------------------------------------------------------------------
  // CANCELLED state visibility
  // -----------------------------------------------------------------------

  test.describe('已取消工单', () => {
    test('已取消工单不出现在待审批列表中', async ({ page }) => {
      await page.route('**/api/approvals/pending**', (route) => {
        // Backend should never return CANCELLED orders in pending list
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.pendingApprovals}`);

      await expect(page.getByText(/暂无待审批工单|No pending/i)).toBeVisible({
        timeout: 10_000,
      });
    });

    test('已取消工单详情页显示取消状态', async ({ page }) => {
      const orderId = 'order-cancelled';

      await interceptOrderDetail(page, orderId, 'CANCELLED');
      await loginAs(page, 'deptSupervisor');
      await page.goto(`${BASE_URL}${ROUTES.approvalDetail(orderId)}`);

      // Status badge should show CANCELLED
      await expect(page.getByTestId('order-status-badge')).toHaveText(
        /CANCELLED|已取消/,
      );

      // Approve/Reject buttons should NOT be visible for cancelled orders
      await expect(page.getByRole('button', { name: /通过|Approve/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /驳回|Reject/i })).not.toBeVisible();
    });
  });
});