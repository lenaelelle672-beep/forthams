/**
 * E2E Tests for Work Order Approval List & Detail Pages
 *
 * Covers ATB-4 and ATB-5 from the Phase 1 approval workflow SPEC:
 *   - ATB-4: Pending approval list rendering (role-based filtering)
 *   - ATB-5: Approval detail page operations (approve / reject with validation)
 *
 * State machine flow:
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   Any approval node → REJECTED (requires rejectionReason)
 *
 * Constraints:
 *   - DEPT_SUPERVISOR only sees APPROVING_LEVEL_1 work orders
 *   - ASSET_ADMIN only sees APPROVING_LEVEL_2 work orders
 *   - Rejection requires non-empty rejectionReason (max 500 chars)
 *   - Optimistic locking via version field (HTTP 409 on conflict)
 */

import { test, expect, Page, Locator, Response } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mirrors backend OrderStatus enum */
type OrderStatus =
  | 'PENDING'
  | 'APPROVING_LEVEL_1'
  | 'APPROVING_LEVEL_2'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/** Work order list item as returned by the API */
interface WorkOrderListItem {
  id: string;
  orderNo: string;
  applicant: string;
  submittedAt: string;
  status: OrderStatus;
  version: number;
}

/** Approval record returned in detail response */
interface ApprovalRecord {
  id: string;
  orderId: string;
  operatorId: string;
  operatorName: string;
  action: 'APPROVE' | 'REJECT';
  comment: string;
  createdAt: string;
}

/** Full work order detail as returned by the API */
interface WorkOrderDetail {
  id: string;
  orderNo: string;
  applicant: string;
  submittedAt: string;
  status: OrderStatus;
  version: number;
  approvalRecords: ApprovalRecord[];
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_LEVEL_1_ORDERS: WorkOrderListItem[] = [
  {
    id: 'wo-001',
    orderNo: 'WO-2025-0001',
    applicant: '张三',
    submittedAt: '2025-06-01T09:00:00Z',
    status: 'APPROVING_LEVEL_1',
    version: 1,
  },
  {
    id: 'wo-002',
    orderNo: 'WO-2025-0002',
    applicant: '李四',
    submittedAt: '2025-06-02T10:30:00Z',
    status: 'APPROVING_LEVEL_1',
    version: 1,
  },
  {
    id: 'wo-003',
    orderNo: 'WO-2025-0003',
    applicant: '王五',
    submittedAt: '2025-06-03T14:15:00Z',
    status: 'APPROVING_LEVEL_1',
    version: 2,
  },
];

const MOCK_LEVEL_2_ORDERS: WorkOrderListItem[] = [
  {
    id: 'wo-010',
    orderNo: 'WO-2025-0010',
    applicant: '赵六',
    submittedAt: '2025-05-28T08:00:00Z',
    status: 'APPROVING_LEVEL_2',
    version: 2,
  },
];

const MOCK_PENDING_ORDER: WorkOrderListItem = {
  id: 'wo-099',
  orderNo: 'WO-2025-0099',
  applicant: '孙七',
  submittedAt: '2025-06-04T16:00:00Z',
  status: 'PENDING',
  version: 0,
};

const MOCK_REJECTED_ORDER: WorkOrderListItem = {
  id: 'wo-088',
  orderNo: 'WO-2025-0088',
  applicant: '周八',
  submittedAt: '2025-05-20T11:00:00Z',
  status: 'REJECTED',
  version: 1,
};

const MOCK_DETAIL: WorkOrderDetail = {
  id: 'wo-001',
  orderNo: 'WO-2025-0001',
  applicant: '张三',
  submittedAt: '2025-06-01T09:00:00Z',
  status: 'APPROVING_LEVEL_1',
  version: 1,
  approvalRecords: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate login by setting auth tokens in localStorage.
 * This avoids depending on a real auth flow in E2E tests.
 */
async function loginAs(page: Page, role: 'DEPT_SUPERVISOR' | 'ASSET_ADMIN'): Promise<void> {
  const userId = role === 'DEPT_SUPERVISOR' ? 'user-supervisor' : 'user-asset-admin';
  const userName = role === 'DEPT_SUPERVISOR' ? '部门主管' : '资产管理员';

  await page.evaluate(
    ({ tokenRole, tokenUserId, tokenUserName }) => {
      const tokenPayload = {
        sub: tokenUserId,
        name: tokenUserName,
        role: tokenRole,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      // Fake JWT – header.payload.signature
      const fakeToken =
        'eyJhbGciOiJIUzI1NiJ9.' +
        btoa(JSON.stringify(tokenPayload)) +
        '.fake-signature';
      localStorage.setItem('auth_token', fakeToken);
      localStorage.setItem('user_role', tokenRole);
      localStorage.setItem('user_id', tokenUserId);
      localStorage.setItem('user_name', tokenUserName);
    },
    { tokenRole: role, tokenUserId: userId, tokenUserName: userName },
  );
}

/**
 * Intercept the pending approvals list API and return mock data
 * filtered by the requester's role.
 */
function interceptApprovalListAPI(page: Page): void {
  page.route('**/api/orders/approvals/pending**', async (route) => {
    const userRole = await page.evaluate(() => localStorage.getItem('user_role'));

    let orders: WorkOrderListItem[];
    if (userRole === 'DEPT_SUPERVISOR') {
      // DEPT_SUPERVISOR only sees APPROVING_LEVEL_1
      orders = MOCK_LEVEL_1_ORDERS;
    } else if (userRole === 'ASSET_ADMIN') {
      // ASSET_ADMIN only sees APPROVING_LEVEL_2
      orders = MOCK_LEVEL_2_ORDERS;
    } else {
      orders = [];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: orders, total: orders.length }),
    });
  });
}

/**
 * Intercept the work order detail API.
 */
function interceptDetailAPI(page: Page, detail?: WorkOrderDetail): void {
  const responseDetail = detail ?? MOCK_DETAIL;
  page.route('**/api/orders/wo-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: responseDetail }),
    });
  });
}

/**
 * Intercept the approve API endpoint.
 */
function interceptApproveAPI(page: Page): void {
  page.route('**/api/orders/wo-001/approve', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'wo-001',
          status: 'APPROVING_LEVEL_2',
          version: 2,
        },
      }),
    });
  });
}

/**
 * Intercept the reject API endpoint.
 * Validates that rejectionReason is present and non-empty.
 */
function interceptRejectAPI(page: Page): void {
  page.route('**/api/orders/wo-001/reject', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON();
    if (!body || !body.rejectionReason || typeof body.rejectionReason !== 'string' || body.rejectionReason.trim() === '') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          errorCode: 'MISSING_REJECTION_REASON',
          message: '驳回原因不能为空',
        }),
      });
      return;
    }

    if (body.rejectionReason.length > 500) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          errorCode: 'REJECTION_REASON_TOO_LONG',
          message: '驳回原因不能超过500字符',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'wo-001',
          status: 'REJECTED',
          version: 2,
        },
      }),
    });
  });
}

/**
 * Intercept the approve API for a level-2 order (asset admin).
 */
function interceptLevel2ApproveAPI(page: Page): void {
  page.route('**/api/orders/wo-010/approve', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'wo-010',
          status: 'APPROVED',
          version: 3,
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('工单审批列表与详情 (ATB-4 / ATB-5)', () => {
  // -----------------------------------------------------------------------
  // ATB-4: Pending Approval List Rendering
  // -----------------------------------------------------------------------

  test.describe('ATB-4: 待审批列表渲染', () => {
    test('部门主管登录后，待审批列表仅展示 APPROVING_LEVEL_1 状态的工单', async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');
      interceptApprovalListAPI(page);

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Verify the list is rendered
      const listItems = page.locator('[data-testid="approval-list-item"]');
      await expect(listItems).toHaveCount(3);

      // Verify each item shows APPROVING_LEVEL_1 status
      const statusBadges = page.locator('[data-testid="approval-list-item"] [data-testid="order-status"]');
      const statusTexts = await statusBadges.allTextContents();
      for (const text of statusTexts) {
        expect(text.trim()).toBe('待部门主管审批');
      }

      // Verify required columns: order number, applicant, submission time
      for (let i = 0; i < MOCK_LEVEL_1_ORDERS.length; i++) {
        const item = listItems.nth(i);
        await expect(item.locator('[data-testid="order-no"]')).toHaveText(
          MOCK_LEVEL_1_ORDERS[i].orderNo,
        );
        await expect(item.locator('[data-testid="order-applicant"]')).toHaveText(
          MOCK_LEVEL_1_ORDERS[i].applicant,
        );
        // Submission time is displayed (format may vary by locale, just check it's non-empty)
        const timeText = await item.locator('[data-testid="order-submitted-at"]').textContent();
        expect(timeText).toBeTruthy();
      }
    });

    test('部门主管的待审批列表不包含 APPROVING_LEVEL_2 / PENDING / REJECTED 状态的工单', async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');

      // Return a mixed list from the API – the page should still only show LEVEL_1 items
      page.route('**/api/orders/approvals/pending**', async (route) => {
        const mixedOrders: WorkOrderListItem[] = [
          ...MOCK_LEVEL_1_ORDERS,
          MOCK_LEVEL_2_ORDERS[0],
          MOCK_PENDING_ORDER,
          MOCK_REJECTED_ORDER,
        ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: mixedOrders, total: mixedOrders.length }),
        });
      });

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Even if the API returns mixed data, the frontend must filter by role
      const listItems = page.locator('[data-testid="approval-list-item"]');
      const count = await listItems.count();

      for (let i = 0; i < count; i++) {
        const statusText = await listItems
          .nth(i)
          .locator('[data-testid="order-status"]')
          .textContent();
        // Only APPROVING_LEVEL_1 items should be rendered
        expect(statusText?.trim()).toBe('待部门主管审批');
      }
    });

    test('资产管理员登录后，待审批列表仅展示 APPROVING_LEVEL_2 状态的工单', async ({ page }) => {
      await loginAs(page, 'ASSET_ADMIN');
      interceptApprovalListAPI(page);

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      const listItems = page.locator('[data-testid="approval-list-item"]');
      await expect(listItems).toHaveCount(1);

      const statusBadge = listItems.first().locator('[data-testid="order-status"]');
      await expect(statusBadge).toHaveText('待资产管理员审批');

      // Verify required columns
      await expect(listItems.first().locator('[data-testid="order-no"]')).toHaveText('WO-2025-0010');
      await expect(listItems.first().locator('[data-testid="order-applicant"]')).toHaveText('赵六');
      const timeText = await listItems.first().locator('[data-testid="order-submitted-at"]').textContent();
      expect(timeText).toBeTruthy();
    });

    test('列表列包含工单号、申请人、提交时间', async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');
      interceptApprovalListAPI(page);

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Verify table headers
      const table = page.locator('[data-testid="approval-list-table"]');
      if (await table.isVisible()) {
        await expect(table.locator('th').filter({ hasText: '工单号' })).toBeVisible();
        await expect(table.locator('th').filter({ hasText: '申请人' })).toBeVisible();
        await expect(table.locator('th').filter({ hasText: '提交时间' })).toBeVisible();
      } else {
        // Card-based layout: verify data-testid attributes exist
        const firstItem = page.locator('[data-testid="approval-list-item"]').first();
        await expect(firstItem.locator('[data-testid="order-no"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="order-applicant"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="order-submitted-at"]')).toBeVisible();
      }
    });
  });

  // -----------------------------------------------------------------------
  // ATB-5: Approval Detail & Operations
  // -----------------------------------------------------------------------

  test.describe('ATB-5: 审批详情与操作', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');
      interceptApprovalListAPI(page);
      interceptDetailAPI(page);
      interceptApproveAPI(page);
      interceptRejectAPI(page);
    });

    test('点击列表中的工单可进入详情页', async ({ page }) => {
      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Click the first work order
      await page.locator('[data-testid="approval-list-item"]').first().click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/approvals\/wo-001/);
      await expect(page.locator('[data-testid="approval-detail"]')).toBeVisible();
    });

    test('详情页展示工单基本信息与审批操作按钮', async ({ page }) => {
      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      // Verify detail info
      await expect(page.locator('[data-testid="detail-order-no"]')).toHaveText('WO-2025-0001');
      await expect(page.locator('[data-testid="detail-applicant"]')).toHaveText('张三');

      // Verify action buttons
      await expect(page.locator('[data-testid="btn-approve"]')).toBeVisible();
      await expect(page.locator('[data-testid="btn-reject"]')).toBeVisible();
    });

    test('驳回时不输入原因，前端表单校验拦截并提示', async ({ page }) => {
      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      // Click reject button to open rejection dialog/form
      await page.locator('[data-testid="btn-reject"]').click();

      // Rejection form should be visible
      await expect(page.locator('[data-testid="rejection-form"]')).toBeVisible();

      // Click confirm without entering a reason
      await page.locator('[data-testid="btn-reject-confirm"]').click();

      // Frontend validation should show an error message
      await expect(page.locator('[data-testid="rejection-reason-error"]')).toBeVisible();
      const errorText = await page.locator('[data-testid="rejection-reason-error"]').textContent();
      expect(errorText).toContain('驳回原因不能为空');

      // The rejection form should still be open (not submitted)
      await expect(page.locator('[data-testid="rejection-form"]')).toBeVisible();

      // No API call should have been made
      // (The intercept would have returned 400, but we verify the form is still open)
    });

    test('输入驳回原因后确认，页面提示成功，列表刷新后该工单消失', async ({ page }) => {
      // After rejection, the list should no longer contain the rejected order
      let listCallCount = 0;
      page.route('**/api/orders/approvals/pending**', async (route) => {
        listCallCount++;
        const orders =
          listCallCount <= 1
            ? MOCK_LEVEL_1_ORDERS
            : MOCK_LEVEL_1_ORDERS.filter((o) => o.id !== 'wo-001');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: orders, total: orders.length }),
        });
      });

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Initially 3 items
      await expect(page.locator('[data-testid="approval-list-item"]')).toHaveCount(3);

      // Navigate to detail
      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      // Open rejection form and enter reason
      await page.locator('[data-testid="btn-reject"]').click();
      await expect(page.locator('[data-testid="rejection-form"]')).toBeVisible();

      await page.locator('[data-testid="rejection-reason-input"]').fill('设备信息不合规，需补充材料');

      // Confirm rejection
      await page.locator('[data-testid="btn-reject-confirm"]').click();

      // Wait for the reject API call
      const rejectResponse = await page.waitForResponse('**/api/orders/wo-001/reject');
      expect(rejectResponse.status()).toBe(200);

      // Success message should appear
      await expect(page.locator('[data-testid="approval-success-message"]')).toBeVisible();
      const successText = await page.locator('[data-testid="approval-success-message"]').textContent();
      expect(successText).toContain('驳回成功');

      // Page should redirect back to list or list should refresh
      // After refresh, the rejected order should no longer appear
      await page.waitForResponse('**/api/orders/approvals/pending**');
      await expect(page.locator('[data-testid="approval-list-item"]')).toHaveCount(2);

      // Verify the rejected order is gone
      const remainingOrderNos = await page
        .locator('[data-testid="approval-list-item"] [data-testid="order-no"]')
        .allTextContents();
      expect(remainingOrderNos).not.toContain('WO-2025-0001');
    });

    test('点击"通过"按钮后，工单流转至下一级，列表刷新后该工单消失', async ({ page }) => {
      // After approval, the list should no longer contain the approved order
      let listCallCount = 0;
      page.route('**/api/orders/approvals/pending**', async (route) => {
        listCallCount++;
        const orders =
          listCallCount <= 1
            ? MOCK_LEVEL_1_ORDERS
            : MOCK_LEVEL_1_ORDERS.filter((o) => o.id !== 'wo-001');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: orders, total: orders.length }),
        });
      });

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Initially 3 items
      await expect(page.locator('[data-testid="approval-list-item"]')).toHaveCount(3);

      // Navigate to detail
      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      // Click approve button
      await page.locator('[data-testid="btn-approve"]').click();

      // Wait for the approve API call
      const approveResponse = await page.waitForResponse('**/api/orders/wo-001/approve');
      expect(approveResponse.status()).toBe(200);

      // Verify the response indicates transition to APPROVING_LEVEL_2
      const approveBody = await approveResponse.json();
      expect(approveBody.data.status).toBe('APPROVING_LEVEL_2');

      // Success message should appear
      await expect(page.locator('[data-testid="approval-success-message"]')).toBeVisible();
      const successText = await page.locator('[data-testid="approval-success-message"]').textContent();
      expect(successText).toContain('审批通过');

      // After list refresh, the approved order should no longer appear
      await page.waitForResponse('**/api/orders/approvals/pending**');
      await expect(page.locator('[data-testid="approval-list-item"]')).toHaveCount(2);

      // Verify the approved order is gone
      const remainingOrderNos = await page
        .locator('[data-testid="approval-list-item"] [data-testid="order-no"]')
        .allTextContents();
      expect(remainingOrderNos).not.toContain('WO-2025-0001');
    });

    test('资产管理员通过审批后，工单流转至 APPROVED 状态', async ({ page }) => {
      await loginAs(page, 'ASSET_ADMIN');

      let listCallCount = 0;
      page.route('**/api/orders/approvals/pending**', async (route) => {
        listCallCount++;
        const orders = listCallCount <= 1 ? MOCK_LEVEL_2_ORDERS : [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: orders, total: orders.length }),
        });
      });

      // Detail for level-2 order
      page.route('**/api/orders/wo-010', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'wo-010',
              orderNo: 'WO-2025-0010',
              applicant: '赵六',
              submittedAt: '2025-05-28T08:00:00Z',
              status: 'APPROVING_LEVEL_2',
              version: 2,
              approvalRecords: [
                {
                  id: 'ar-001',
                  orderId: 'wo-010',
                  operatorId: 'user-supervisor',
                  operatorName: '部门主管',
                  action: 'APPROVE',
                  comment: '',
                  createdAt: '2025-05-29T10:00:00Z',
                },
              ],
            },
          }),
        });
      });

      interceptLevel2ApproveAPI(page);

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Click the level-2 order
      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-010');

      // Approve
      await page.locator('[data-testid="btn-approve"]').click();

      const approveResponse = await page.waitForResponse('**/api/orders/wo-010/approve');
      expect(approveResponse.status()).toBe(200);

      const approveBody = await approveResponse.json();
      expect(approveBody.data.status).toBe('APPROVED');

      // Success message
      await expect(page.locator('[data-testid="approval-success-message"]')).toBeVisible();

      // List should be empty after refresh
      await page.waitForResponse('**/api/orders/approvals/pending**');
      await expect(page.locator('[data-testid="approval-list-item"]')).toHaveCount(0);
    });
  });

  // -----------------------------------------------------------------------
  // Additional Edge Cases
  // -----------------------------------------------------------------------

  test.describe('边界与异常场景', () => {
    test('驳回原因超过500字符时，前端校验拦截', async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');
      interceptApprovalListAPI(page);
      interceptDetailAPI(page);
      interceptRejectAPI(page);

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      await page.locator('[data-testid="btn-reject"]').click();
      await expect(page.locator('[data-testid="rejection-form"]')).toBeVisible();

      // Fill with a string longer than 500 characters
      const longReason = 'A'.repeat(501);
      await page.locator('[data-testid="rejection-reason-input"]').fill(longReason);

      await page.locator('[data-testid="btn-reject-confirm"]').click();

      // Frontend validation should show length error
      await expect(page.locator('[data-testid="rejection-reason-error"]')).toBeVisible();
      const errorText = await page.locator('[data-testid="rejection-reason-error"]').textContent();
      expect(errorText).toContain('500');
    });

    test('并发审批冲突时，页面提示冲突错误', async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');
      interceptApprovalListAPI(page);
      interceptDetailAPI(page);

      // Simulate 409 Conflict (optimistic lock failure)
      page.route('**/api/orders/wo-001/approve', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            errorCode: 'CONCURRENT_CONFLICT',
            message: '工单已被其他审批人处理，请刷新后重试',
          }),
        });
      });

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      await page.locator('[data-testid="btn-approve"]').click();

      const approveResponse = await page.waitForResponse('**/api/orders/wo-001/approve');
      expect(approveResponse.status()).toBe(409);

      // Error message should be displayed
      await expect(page.locator('[data-testid="approval-error-message"]')).toBeVisible();
      const errorText = await page.locator('[data-testid="approval-error-message"]').textContent();
      expect(errorText).toContain('冲突');
    });

    test('非法状态流转时，后端返回409并显示错误', async ({ page }) => {
      await loginAs(page, 'DEPT_SUPERVISOR');
      interceptApprovalListAPI(page);

      // Detail returns a PENDING order (not yet at APPROVING_LEVEL_1)
      page.route('**/api/orders/wo-001', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'wo-001',
              orderNo: 'WO-2025-0001',
              applicant: '张三',
              submittedAt: '2025-06-01T09:00:00Z',
              status: 'PENDING',
              version: 0,
              approvalRecords: [],
            },
          }),
        });
      });

      // Approve attempt on PENDING order should return 409
      page.route('**/api/orders/wo-001/approve', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            errorCode: 'INVALID_STATE_TRANSITION',
            message: '当前状态不允许此操作',
          }),
        });
      });

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      await page.locator('[data-testid="approval-list-item"]').first().click();
      await page.waitForResponse('**/api/orders/wo-001');

      await page.locator('[data-testid="btn-approve"]').click();

      const approveResponse = await page.waitForResponse('**/api/orders/wo-001/approve');
      expect(approveResponse.status()).toBe(409);

      const body = await approveResponse.json();
      expect(body.errorCode).toBe('INVALID_STATE_TRANSITION');

      // Error message on page
      await expect(page.locator('[data-testid="approval-error-message"]')).toBeVisible();
    });

    test('空列表时显示无数据提示', async ({ page }) => {
      await loginAs(page, 'ASSET_ADMIN');

      // Return empty list
      page.route('**/api/orders/approvals/pending**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await page.goto('/approvals/pending');
      await page.waitForResponse('**/api/orders/approvals/pending**');

      // Should show empty state
      await expect(page.locator('[data-testid="approval-list-empty"]')).toBeVisible();
      const emptyText = await page.locator('[data-testid="approval-list-empty"]').textContent();
      expect(emptyText).toContain('暂无待审批工单');
    });
  });
});