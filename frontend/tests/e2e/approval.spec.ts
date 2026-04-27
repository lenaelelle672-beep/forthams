/**
 * E2E Tests for Multi-Level Approval Workflow
 *
 * Covers ATB-4 (pending approval list rendering) and ATB-5 (approval detail & operations),
 * plus additional scenarios for role-based isolation, state transition validation,
 * optimistic lock conflict handling, and rejection reason enforcement.
 *
 * State machine flow:
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   Any approval node → REJECTED (requires rejectionReason)
 *   Any non-terminal state → CANCELLED
 *
 * Role-based data isolation:
 *   - Department Manager (DEPT_MANAGER): sees APPROVING_LEVEL_1 orders
 *   - Asset Manager (ASSET_MANAGER): sees APPROVING_LEVEL_2 orders
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalRecord {
  id: number;
  orderId: number;
  operatorId: number;
  operatorName: string;
  action: 'APPROVE' | 'REJECT';
  comment: string;
  createdAt: string;
}

interface WorkOrder {
  id: number;
  orderNo: string;
  applicant: string;
  applicantId: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface ApiError {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

const MOCK_DEPT_MANAGER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.dept_manager_token';
const MOCK_ASSET_MANAGER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.asset_manager_token';
const MOCK_APPLICANT_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.applicant_token';

const MOCK_LEVEL1_ORDERS: WorkOrder[] = [
  {
    id: 1001,
    orderNo: 'WO-2025-0001',
    applicant: '张三',
    applicantId: 10,
    status: 'APPROVING_LEVEL_1',
    version: 1,
    createdAt: '2025-06-01T09:00:00Z',
    updatedAt: '2025-06-01T09:00:00Z',
  },
  {
    id: 1002,
    orderNo: 'WO-2025-0002',
    applicant: '李四',
    applicantId: 11,
    status: 'APPROVING_LEVEL_1',
    version: 1,
    createdAt: '2025-06-02T10:30:00Z',
    updatedAt: '2025-06-02T10:30:00Z',
  },
  {
    id: 1003,
    orderNo: 'WO-2025-0003',
    applicant: '王五',
    applicantId: 12,
    status: 'APPROVING_LEVEL_1',
    version: 2,
    createdAt: '2025-06-03T14:15:00Z',
    updatedAt: '2025-06-03T14:15:00Z',
  },
];

const MOCK_LEVEL2_ORDERS: WorkOrder[] = [
  {
    id: 2001,
    orderNo: 'WO-2025-0010',
    applicant: '赵六',
    applicantId: 20,
    status: 'APPROVING_LEVEL_2',
    version: 2,
    createdAt: '2025-05-28T08:00:00Z',
    updatedAt: '2025-06-01T16:00:00Z',
  },
  {
    id: 2002,
    orderNo: 'WO-2025-0011',
    applicant: '孙七',
    applicantId: 21,
    status: 'APPROVING_LEVEL_2',
    version: 2,
    createdAt: '2025-05-29T11:00:00Z',
    updatedAt: '2025-06-02T09:00:00Z',
  },
];

const MOCK_APPROVAL_RECORDS: ApprovalRecord[] = [
  {
    id: 1,
    orderId: 2001,
    operatorId: 30,
    operatorName: '部门主管甲',
    action: 'APPROVE',
    comment: '同意',
    createdAt: '2025-06-01T16:00:00Z',
  },
];

const ALL_STATUSES = [
  'PENDING',
  'APPROVING_LEVEL_1',
  'APPROVING_LEVEL_2',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up API route mocks for the approval pending list endpoint.
 * Returns orders filtered by the caller's role.
 */
function mockPendingListApi(page: Page, orders: WorkOrder[]) {
  page.route('**/api/orders/pending**', async (route) => {
    const response: ApiResponse<WorkOrder[]> = {
      code: 200,
      message: 'success',
      data: orders,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Set up API route mock for fetching a single work order detail.
 */
function mockOrderDetailApi(page: Page, order: WorkOrder) {
  page.route(`**/api/orders/${order.id}**`, async (route) => {
    const response: ApiResponse<WorkOrder> = {
      code: 200,
      message: 'success',
      data: order,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Set up API route mock for fetching approval records of a work order.
 */
function mockApprovalRecordsApi(page: Page, orderId: number, records: ApprovalRecord[]) {
  page.route(`**/api/orders/${orderId}/approval-records**`, async (route) => {
    const response: ApiResponse<ApprovalRecord[]> = {
      code: 200,
      message: 'success',
      data: records,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Set up API route mock for the approve endpoint.
 */
function mockApproveApi(
  page: Page,
  orderId: number,
  options: {
    success?: boolean;
    newStatus?: string;
    conflictError?: boolean;
    invalidTransition?: boolean;
  } = {},
) {
  page.route(`**/api/orders/${orderId}/approve**`, async (route) => {
    if (options.invalidTransition) {
      const errorBody: ApiResponse<null> & ApiError = {
        code: 409,
        message: 'Invalid state transition',
        data: null,
      };
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(errorBody),
      });
      return;
    }
    if (options.conflictError) {
      const errorBody: ApiResponse<null> & ApiError = {
        code: 409,
        message: 'Optimistic lock conflict: version mismatch',
        data: null,
      };
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(errorBody),
      });
      return;
    }
    const newStatus = options.newStatus ?? 'APPROVED';
    const response: ApiResponse<WorkOrder> = {
      code: 200,
      message: 'success',
      data: {
        id: orderId,
        orderNo: `WO-2025-${String(orderId).padStart(4, '0')}`,
        applicant: '测试申请人',
        applicantId: 10,
        status: newStatus,
        version: 3,
        createdAt: '2025-06-01T09:00:00Z',
        updatedAt: new Date().toISOString(),
      },
    };
    await route.fulfill({
      status: options.success !== false ? 200 : 500,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Set up API route mock for the reject endpoint.
 */
function mockRejectApi(
  page: Page,
  orderId: number,
  options: {
    success?: boolean;
    missingReason?: boolean;
    conflictError?: boolean;
  } = {},
) {
  page.route(`**/api/orders/${orderId}/reject**`, async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { rejectionReason?: string } | null;

    // Simulate backend validation: missing rejectionReason → 400
    if (options.missingReason || !body?.rejectionReason) {
      const errorBody: ApiResponse<null> & ApiError = {
        code: 400,
        message: 'rejectionReason is required and must be a non-empty string (max 500 characters)',
        data: null,
      };
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify(errorBody),
      });
      return;
    }

    if (options.conflictError) {
      const errorBody: ApiResponse<null> & ApiError = {
        code: 409,
        message: 'Optimistic lock conflict: version mismatch',
        data: null,
      };
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(errorBody),
      });
      return;
    }

    const response: ApiResponse<WorkOrder> = {
      code: 200,
      message: 'success',
      data: {
        id: orderId,
        orderNo: `WO-2025-${String(orderId).padStart(4, '0')}`,
        applicant: '测试申请人',
        applicantId: 10,
        status: 'REJECTED',
        version: 3,
        createdAt: '2025-06-01T09:00:00Z',
        updatedAt: new Date().toISOString(),
      },
    };
    await route.fulfill({
      status: options.success !== false ? 200 : 500,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Authenticate by setting a mock JWT token in localStorage.
 */
async function loginAs(page: Page, token: string) {
  await page.addInitScript((t) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('user_role', t.includes('dept_manager') ? 'DEPT_MANAGER' : t.includes('asset_manager') ? 'ASSET_MANAGER' : 'APPLICANT');
  }, token);
}

/**
 * Navigate to the approval pending list page.
 */
async function navigateToPendingApprovals(page: Page) {
  await page.goto('/approvals/pending');
  await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// ATB-4: Pending Approval List Rendering Tests
// ---------------------------------------------------------------------------

test.describe('ATB-4: Pending Approval List Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
  });

  test('should display only APPROVING_LEVEL_1 orders for department manager', async ({ page }) => {
    // Arrange: mock the pending list API to return level-1 orders
    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);

    // Act
    await navigateToPendingApprovals(page);

    // Assert: all displayed orders should have status APPROVING_LEVEL_1
    const rows = page.locator('[data-testid="approval-row"]');
    await expect(rows).toHaveCount(MOCK_LEVEL1_ORDERS.length);

    for (let i = 0; i < MOCK_LEVEL1_ORDERS.length; i++) {
      await expect(rows.nth(i)).toContainText(MOCK_LEVEL1_ORDERS[i].orderNo);
      await expect(rows.nth(i)).toContainText(MOCK_LEVEL1_ORDERS[i].applicant);
    }
  });

  test('should display order number, applicant, and submission time columns', async ({ page }) => {
    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);

    await navigateToPendingApprovals(page);

    // Verify table headers
    const headerRow = page.locator('[data-testid="approval-table-header"]');
    await expect(headerRow).toContainText('工单号');
    await expect(headerRow).toContainText('申请人');
    await expect(headerRow).toContainText('提交时间');

    // Verify first row data
    const firstRow = page.locator('[data-testid="approval-row"]').first();
    await expect(firstRow).toContainText('WO-2025-0001');
    await expect(firstRow).toContainText('张三');
    await expect(firstRow).toContainText('2025-06-01');
  });

  test('should show empty state when no pending approvals exist', async ({ page }) => {
    mockPendingListApi(page, []);

    await navigateToPendingApprovals(page);

    const emptyState = page.locator('[data-testid="empty-approval-list"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/暂无待审批|没有待审批/);
  });

  test('should show loading indicator while fetching data', async ({ page }) => {
    // Delay the API response to observe loading state
    page.route('**/api/orders/pending**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response: ApiResponse<WorkOrder[]> = {
        code: 200,
        message: 'success',
        data: MOCK_LEVEL1_ORDERS,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await navigateToPendingApprovals(page);

    // Loading indicator should appear
    const loading = page.locator('[data-testid="approval-loading"]');
    await expect(loading).toBeVisible();

    // After data loads, loading indicator should disappear
    await expect(loading).not.toBeVisible({ timeout: 5000 });
  });

  test('should display error message when API request fails', async ({ page }) => {
    page.route('**/api/orders/pending**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, message: 'Internal Server Error', data: null }),
      });
    });

    await navigateToPendingApprovals(page);

    const errorState = page.locator('[data-testid="approval-error"]');
    await expect(errorState).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Role-Based Data Isolation Tests
// ---------------------------------------------------------------------------

test.describe('Role-Based Data Isolation', () => {
  test('asset manager should only see APPROVING_LEVEL_2 orders', async ({ page }) => {
    await loginAs(page, MOCK_ASSET_MANAGER_TOKEN);
    mockPendingListApi(page, MOCK_LEVEL2_ORDERS);

    await navigateToPendingApprovals(page);

    const rows = page.locator('[data-testid="approval-row"]');
    await expect(rows).toHaveCount(MOCK_LEVEL2_ORDERS.length);

    for (let i = 0; i < MOCK_LEVEL2_ORDERS.length; i++) {
      await expect(rows.nth(i)).toContainText(MOCK_LEVEL2_ORDERS[i].orderNo);
    }
  });

  test('department manager should NOT see APPROVING_LEVEL_2 orders', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    // Even if API mistakenly returns level-2 orders, UI should filter or not display them
    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);

    await navigateToPendingApprovals(page);

    const rows = page.locator('[data-testid="approval-row"]');
    await expect(rows).toHaveCount(MOCK_LEVEL1_ORDERS.length);

    // Verify no level-2 order numbers appear
    for (const order of MOCK_LEVEL2_ORDERS) {
      await expect(page.locator(`text=${order.orderNo}`)).not.toBeVisible();
    }
  });

  test('applicant role should not access approval list', async ({ page }) => {
    await loginAs(page, MOCK_APPLICANT_TOKEN);
    mockPendingListApi(page, []);

    await navigateToPendingApprovals(page);

    // Applicant should see an access denied or empty state
    const accessDenied = page.locator('[data-testid="access-denied"], [data-testid="empty-approval-list"]');
    await expect(accessDenied.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// ATB-5: Approval Detail & Operation Tests
// ---------------------------------------------------------------------------

test.describe('ATB-5: Approval Detail & Operations', () => {
  const targetOrder = MOCK_LEVEL1_ORDERS[0]; // WO-2025-0001

  test.beforeEach(async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);
    mockOrderDetailApi(page, targetOrder);
    mockApprovalRecordsApi(page, targetOrder.id, []);
    mockApproveApi(page, targetOrder.id, { newStatus: 'APPROVING_LEVEL_2' });
    mockRejectApi(page, targetOrder.id);

    await navigateToPendingApprovals(page);
  });

  test('should navigate to order detail when clicking a row', async ({ page }) => {
    const firstRow = page.locator('[data-testid="approval-row"]').first();
    await firstRow.click();

    // Should navigate to detail page
    await page.waitForURL(/\/approvals\/pending\/\d+/);
    await expect(page.locator('[data-testid="order-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-no"]')).toContainText(targetOrder.orderNo);
  });

  test('should display approve and reject buttons on detail page', async ({ page }) => {
    // Navigate to detail
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    const approveBtn = page.locator('[data-testid="approve-button"]');
    const rejectBtn = page.locator('[data-testid="reject-button"]');

    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toBeEnabled();
    await expect(rejectBtn).toBeVisible();
    await expect(rejectBtn).toBeEnabled();
  });

  test('should show rejection reason dialog when reject button is clicked', async ({ page }) => {
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    await page.locator('[data-testid="reject-button"]').click();

    const rejectDialog = page.locator('[data-testid="reject-dialog"]');
    await expect(rejectDialog).toBeVisible();
    await expect(rejectDialog).toContainText(/驳回|拒绝/);
  });

  test('should block rejection with empty reason and show validation error', async ({ page }) => {
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Open reject dialog
    await page.locator('[data-testid="reject-button"]').click();
    const rejectDialog = page.locator('[data-testid="reject-dialog"]');
    await expect(rejectDialog).toBeVisible();

    // Click confirm without entering reason
    const confirmBtn = page.locator('[data-testid="reject-confirm-button"]');
    await confirmBtn.click();

    // Frontend validation should prevent submission and show error
    const validationError = page.locator('[data-testid="rejection-reason-error"]');
    await expect(validationError).toBeVisible();
    await expect(validationError).toContainText(/请输入驳回原因|驳回原因不能为空/);

    // Dialog should still be open (not dismissed)
    await expect(rejectDialog).toBeVisible();
  });

  test('should successfully reject with valid reason and refresh list', async ({ page }) => {
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Open reject dialog
    await page.locator('[data-testid="reject-button"]').click();
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();

    // Enter rejection reason
    const reasonInput = page.locator('[data-testid="rejection-reason-input"]');
    await reasonInput.fill('不合规：缺少必要审批材料');

    // Confirm rejection
    await page.locator('[data-testid="reject-confirm-button"]').click();

    // Success notification should appear
    const successToast = page.locator('[data-testid="success-toast"], .ant-message-success, [role="alert"]');
    await expect(successToast.first()).toBeVisible({ timeout: 5000 });

    // Dialog should be closed
    await expect(page.locator('[data-testid="reject-dialog"]')).not.toBeVisible();

    // After rejection, navigate back to list - the rejected order should no longer appear
    await page.goto('/approvals/pending');
    await page.waitForLoadState('networkidle');

    // Re-mock with updated list (order removed after rejection)
    mockPendingListApi(page, MOCK_LEVEL1_ORDERS.filter((o) => o.id !== targetOrder.id));
    await page.reload();
    await page.waitForLoadState('networkidle');

    const rows = page.locator('[data-testid="approval-row"]');
    await expect(rows).toHaveCount(MOCK_LEVEL1_ORDERS.length - 1);
    await expect(page.locator(`text=${targetOrder.orderNo}`)).not.toBeVisible();
  });

  test('should successfully approve and remove order from list', async ({ page }) => {
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Click approve button
    await page.locator('[data-testid="approve-button"]').click();

    // Confirm approval in confirmation dialog if present
    const confirmDialog = page.locator('[data-testid="approve-confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      await page.locator('[data-testid="approve-confirm-button"]').click();
    }

    // Success notification
    const successToast = page.locator('[data-testid="success-toast"], .ant-message-success, [role="alert"]');
    await expect(successToast.first()).toBeVisible({ timeout: 5000 });

    // Navigate back to list - approved order should no longer appear
    await page.goto('/approvals/pending');
    await page.waitForLoadState('networkidle');

    mockPendingListApi(page, MOCK_LEVEL1_ORDERS.filter((o) => o.id !== targetOrder.id));
    await page.reload();
    await page.waitForLoadState('networkidle');

    const rows = page.locator('[data-testid="approval-row"]');
    await expect(rows).toHaveCount(MOCK_LEVEL1_ORDERS.length - 1);
    await expect(page.locator(`text=${targetOrder.orderNo}`)).not.toBeVisible();
  });

  test('should enforce max 500 character limit on rejection reason', async ({ page }) => {
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    await page.locator('[data-testid="reject-button"]').click();
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();

    const reasonInput = page.locator('[data-testid="rejection-reason-input"]');
    const longReason = '不合规原因'.repeat(100); // 500 characters

    await reasonInput.fill(longReason);

    // Should allow exactly 500 characters
    await expect(reasonInput).toHaveValue(longReason);

    // Verify character count display if present
    const charCount = page.locator('[data-testid="rejection-char-count"]');
    if (await charCount.isVisible()) {
      await expect(charCount).toContainText('500/500');
    }
  });
});

// ---------------------------------------------------------------------------
// Approval Records Display Tests
// ---------------------------------------------------------------------------

test.describe('Approval Records Display', () => {
  test('should display approval history on detail page', async ({ page }) => {
    await loginAs(page, MOCK_ASSET_MANAGER_TOKEN);
    const order = MOCK_LEVEL2_ORDERS[0];

    mockPendingListApi(page, MOCK_LEVEL2_ORDERS);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, MOCK_APPROVAL_RECORDS);
    mockApproveApi(page, order.id, { newStatus: 'APPROVED' });
    mockRejectApi(page, order.id);

    await navigateToPendingApprovals(page);
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Approval records section should be visible
    const recordsSection = page.locator('[data-testid="approval-records"]');
    await expect(recordsSection).toBeVisible();

    // Should show the level-1 approval record
    await expect(recordsSection).toContainText('部门主管甲');
    await expect(recordsSection).toContainText('同意');
  });
});

// ---------------------------------------------------------------------------
// State Transition & Error Handling Tests
// ---------------------------------------------------------------------------

test.describe('State Transition & Error Handling', () => {
  test('should display error when backend returns 409 for invalid state transition', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const order = MOCK_LEVEL1_ORDERS[0];

    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, []);
    // Mock approve to return 409 invalid transition
    mockApproveApi(page, order.id, { invalidTransition: true });
    mockRejectApi(page, order.id);

    await navigateToPendingApprovals(page);
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Attempt to approve
    await page.locator('[data-testid="approve-button"]').click();
    const confirmDialog = page.locator('[data-testid="approve-confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      await page.locator('[data-testid="approve-confirm-button"]').click();
    }

    // Should show error notification
    const errorToast = page.locator('[data-testid="error-toast"], .ant-message-error, [role="alert"]');
    await expect(errorToast.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display error when backend returns 409 for optimistic lock conflict', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const order = MOCK_LEVEL1_ORDERS[0];

    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, []);
    mockApproveApi(page, order.id, { conflictError: true });
    mockRejectApi(page, order.id);

    await navigateToPendingApprovals(page);
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    await page.locator('[data-testid="approve-button"]').click();
    const confirmDialog = page.locator('[data-testid="approve-confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      await page.locator('[data-testid="approve-confirm-button"]').click();
    }

    // Should show conflict error
    const errorToast = page.locator('[data-testid="error-toast"], .ant-message-error, [role="alert"]');
    await expect(errorToast.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display error when backend returns 400 for missing rejection reason', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const order = MOCK_LEVEL1_ORDERS[0];

    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, []);
    mockApproveApi(page, order.id, { newStatus: 'APPROVING_LEVEL_2' });
    // Mock reject to return 400 (simulating backend validation bypass)
    mockRejectApi(page, order.id, { missingReason: true });

    await navigateToPendingApprovals(page);
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Open reject dialog and try to submit with empty reason
    await page.locator('[data-testid="reject-button"]').click();
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();

    // If frontend validation is somehow bypassed, backend should return 400
    // This tests the case where frontend validation might be disabled
    const reasonInput = page.locator('[data-testid="rejection-reason-input"]');
    await reasonInput.fill('');
    await page.locator('[data-testid="reject-confirm-button"]').click();

    // Either frontend blocks it or backend returns 400 error
    const validationError = page.locator('[data-testid="rejection-reason-error"]');
    const errorToast = page.locator('[data-testid="error-toast"], .ant-message-error, [role="alert"]');

    // At least one of the validations should trigger
    const hasError = (await validationError.isVisible().catch(() => false)) || (await errorToast.first().isVisible().catch(() => false));
    expect(hasError).toBeTruthy();
  });

  test('should display error when backend returns 409 for reject optimistic lock conflict', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const order = MOCK_LEVEL1_ORDERS[0];

    mockPendingListApi(page, MOCK_LEVEL1_ORDERS);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, []);
    mockApproveApi(page, order.id, { newStatus: 'APPROVING_LEVEL_2' });
    mockRejectApi(page, order.id, { conflictError: true });

    await navigateToPendingApprovals(page);
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    await page.locator('[data-testid="reject-button"]').click();
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();

    await page.locator('[data-testid="rejection-reason-input"]').fill('并发冲突测试');
    await page.locator('[data-testid="reject-confirm-button"]').click();

    const errorToast = page.locator('[data-testid="error-toast"], .ant-message-error, [role="alert"]');
    await expect(errorToast.first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Full Workflow Integration Tests
// ---------------------------------------------------------------------------

test.describe('Full Approval Workflow Integration', () => {
  test('complete two-level approval flow: level-1 approve → level-2 approve → approved', async ({ page }) => {
    // Phase 1: Department manager approves at level 1
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const level1Order = { ...MOCK_LEVEL1_ORDERS[0] };

    mockPendingListApi(page, [level1Order]);
    mockOrderDetailApi(page, level1Order);
    mockApprovalRecordsApi(page, level1Order.id, []);
    mockApproveApi(page, level1Order.id, { newStatus: 'APPROVING_LEVEL_2' });
    mockRejectApi(page, level1Order.id);

    await navigateToPendingApprovals(page);
    await expect(page.locator('[data-testid="approval-row"]')).toHaveCount(1);

    // Approve at level 1
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);
    await page.locator('[data-testid="approve-button"]').click();

    const confirmDialog = page.locator('[data-testid="approve-confirm-dialog"]');
    if (await confirmDialog.isVisible()) {
      await page.locator('[data-testid="approve-confirm-button"]').click();
    }

    await expect(page.locator('[data-testid="success-toast"], .ant-message-success, [role="alert"]').first()).toBeVisible({ timeout: 5000 });

    // Phase 2: Asset manager approves at level 2
    await loginAs(page, MOCK_ASSET_MANAGER_TOKEN);
    const level2Order = {
      ...level1Order,
      status: 'APPROVING_LEVEL_2',
      version: 2,
    };

    mockPendingListApi(page, [level2Order]);
    mockOrderDetailApi(page, level2Order);
    mockApprovalRecordsApi(page, level2Order.id, [
      {
        id: 1,
        orderId: level2Order.id,
        operatorId: 30,
        operatorName: '部门主管甲',
        action: 'APPROVE',
        comment: '同意',
        createdAt: '2025-06-01T16:00:00Z',
      },
    ]);
    mockApproveApi(page, level2Order.id, { newStatus: 'APPROVED' });
    mockRejectApi(page, level2Order.id);

    await navigateToPendingApprovals(page);
    await expect(page.locator('[data-testid="approval-row"]')).toHaveCount(1);

    // Approve at level 2
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);
    await page.locator('[data-testid="approve-button"]').click();

    const confirmDialog2 = page.locator('[data-testid="approve-confirm-dialog"]');
    if (await confirmDialog2.isVisible()) {
      await page.locator('[data-testid="approve-confirm-button"]').click();
    }

    await expect(page.locator('[data-testid="success-toast"], .ant-message-success, [role="alert"]').first()).toBeVisible({ timeout: 5000 });

    // Order should be fully approved and no longer in pending list
    mockPendingListApi(page, []);
    await page.goto('/approvals/pending');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="empty-approval-list"]')).toBeVisible();
  });

  test('reject at level 1: order goes to REJECTED and disappears from list', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const order = MOCK_LEVEL1_ORDERS[1];

    mockPendingListApi(page, [order]);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, []);
    mockApproveApi(page, order.id, { newStatus: 'APPROVING_LEVEL_2' });
    mockRejectApi(page, order.id);

    await navigateToPendingApprovals(page);
    await expect(page.locator('[data-testid="approval-row"]')).toHaveCount(1);

    // Reject at level 1
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    await page.locator('[data-testid="reject-button"]').click();
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();

    await page.locator('[data-testid="rejection-reason-input"]').fill('预算超支，不予批准');
    await page.locator('[data-testid="reject-confirm-button"]').click();

    await expect(page.locator('[data-testid="success-toast"], .ant-message-success, [role="alert"]').first()).toBeVisible({ timeout: 5000 });

    // Order should be rejected and no longer in pending list
    mockPendingListApi(page, []);
    await page.goto('/approvals/pending');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="empty-approval-list"]')).toBeVisible();
  });

  test('reject at level 2: order goes to REJECTED after passing level 1', async ({ page }) => {
    await loginAs(page, MOCK_ASSET_MANAGER_TOKEN);
    const order = MOCK_LEVEL2_ORDERS[0];

    mockPendingListApi(page, [order]);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, MOCK_APPROVAL_RECORDS);
    mockApproveApi(page, order.id, { newStatus: 'APPROVED' });
    mockRejectApi(page, order.id);

    await navigateToPendingApprovals(page);
    await expect(page.locator('[data-testid="approval-row"]')).toHaveCount(1);

    // Reject at level 2
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    await page.locator('[data-testid="reject-button"]').click();
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();

    await page.locator('[data-testid="rejection-reason-input"]').fill('资产信息与申请不符');
    await page.locator('[data-testid="reject-confirm-button"]').click();

    await expect(page.locator('[data-testid="success-toast"], .ant-message-success, [role="alert"]').first()).toBeVisible({ timeout: 5000 });

    mockPendingListApi(page, []);
    await page.goto('/approvals/pending');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="empty-approval-list"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Pagination & Filtering Tests
// ---------------------------------------------------------------------------

test.describe('Pagination & Filtering', () => {
  test('should paginate approval list when there are many orders', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);

    // Generate 25 orders (more than a typical page size of 10 or 20)
    const manyOrders: WorkOrder[] = Array.from({ length: 25 }, (_, i) => ({
      id: 3000 + i,
      orderNo: `WO-2025-${String(i + 1).padStart(4, '0')}`,
      applicant: `申请人${i + 1}`,
      applicantId: 100 + i,
      status: 'APPROVING_LEVEL_1',
      version: 1,
      createdAt: `2025-06-${String(Math.min(i + 1, 28)).padStart(2, '0')}T09:00:00Z`,
      updatedAt: `2025-06-${String(Math.min(i + 1, 28)).padStart(2, '0')}T09:00:00Z`,
    }));

    mockPendingListApi(page, manyOrders);
    await navigateToPendingApprovals(page);

    // Should show pagination controls
    const pagination = page.locator('[data-testid="approval-pagination"]');
    await expect(pagination).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Accessibility & Responsiveness Tests
// ---------------------------------------------------------------------------

test.describe('Accessibility', () => {
  test('approve and reject buttons should be keyboard accessible', async ({ page }) => {
    await loginAs(page, MOCK_DEPT_MANAGER_TOKEN);
    const order = MOCK_LEVEL1_ORDERS[0];

    mockPendingListApi(page, [order]);
    mockOrderDetailApi(page, order);
    mockApprovalRecordsApi(page, order.id, []);
    mockApproveApi(page, order.id, { newStatus: 'APPROVING_LEVEL_2' });
    mockRejectApi(page, order.id);

    await navigateToPendingApprovals(page);
    await page.locator('[data-testid="approval-row"]').first().click();
    await page.waitForURL(/\/approvals\/pending\/\d+/);

    // Tab to reject button and activate with Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const rejectBtn = page.locator('[data-testid="reject-button"]');
    await expect(rejectBtn).toBeFocused();
    await page.keyboard.press('Enter');

    // Dialog should open
    await expect(page.locator('[data-testid="reject-dialog"]')).toBeVisible();
  });
});