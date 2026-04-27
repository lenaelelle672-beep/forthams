/**
 * E2E tests for the multi-level approval workflow.
 *
 * Covers ATB-1 through ATB-5 as defined in the Phase 1 SPEC:
 *   ATB-1 – Backend state machine forward transition (API-level)
 *   ATB-2 – Backend state machine rejection (API-level)
 *   ATB-3 – Backend illegal state transition interception (API-level)
 *   ATB-4 – Frontend pending approval list rendering (Playwright)
 *   ATB-5 – Frontend approval detail & operations (Playwright)
 *
 * Tech stack: Playwright, React 18+, TypeScript 5.x
 */

import { test, expect, Page, Locator, APIRequestContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080';
const APP_URL = process.env.APP_BASE_URL ?? 'http://localhost:5173';

/** Valid order statuses as defined by the backend state machine. */
const OrderStatus = {
  PENDING: 'PENDING',
  APPROVING_LEVEL_1: 'APPROVING_LEVEL_1',
  APPROVING_LEVEL_2: 'APPROVING_LEVEL_2',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

// ---------------------------------------------------------------------------
// Helpers – Authentication
// ---------------------------------------------------------------------------

/**
 * Obtain an authenticated API context for the given role.
 * Returns the context plus a decoded JWT payload (or null if unavailable).
 */
async function getAuthenticatedContext(
  request: APIRequestContext,
  role: 'DEPT_SUPERVISOR' | 'ASSET_ADMIN',
): Promise<{ token: string; headers: Record<string, string> }> {
  const credentials =
    role === 'DEPT_SUPERVISOR'
      ? { username: 'supervisor@test.com', password: 'Test@1234' }
      : { username: 'assetadmin@test.com', password: 'Test@1234' };

  const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
    data: credentials,
  });
  expect(loginRes.ok(), `Login as ${role} should succeed`).toBeTruthy();

  const loginBody = await loginRes.json();
  const token: string = loginBody.token ?? loginBody.data?.token ?? '';
  expect(token, `Token for ${role} should not be empty`).toBeTruthy();

  return {
    token,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Log in via the UI and store auth state.
 */
async function loginAsRole(page: Page, role: 'DEPT_SUPERVISOR' | 'ASSET_ADMIN'): Promise<void> {
  const credentials =
    role === 'DEPT_SUPERVISOR'
      ? { username: 'supervisor@test.com', password: 'Test@1234' }
      : { username: 'assetadmin@test.com', password: 'Test@1234' };

  await page.goto(`${APP_URL}/login`);
  await page.getByPlaceholder(/用户名|username/i).fill(credentials.username);
  await page.getByPlaceholder(/密码|password/i).fill(credentials.password);
  await page.getByRole('button', { name: /登录|login/i }).click();

  // Wait for navigation away from login page
  await page.waitForURL(/\/(dashboard|approvals)/, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Helpers – Work Order creation (API)
// ---------------------------------------------------------------------------

/**
 * Create a work order via the API and return its id.
 * The order is created in PENDING status.
 */
async function createWorkOrderViaApi(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const payload = {
    title: `E2E-审批测试工单-${Date.now()}`,
    description: 'E2E 自动创建的审批测试工单',
    category: 'ASSET_TRANSFER',
    ...overrides,
  };

  const res = await request.post(`${BASE_URL}/api/orders`, {
    headers: authHeaders,
    data: payload,
  });
  expect(res.ok(), 'Create work order should succeed').toBeTruthy();

  const body = await res.json();
  const orderId: string = body.data?.id ?? body.id ?? '';
  expect(orderId, 'Created order should have an id').toBeTruthy();
  return orderId;
}

/**
 * Submit a PENDING work order so it transitions to APPROVING_LEVEL_1.
 */
async function submitWorkOrderViaApi(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  orderId: string,
): Promise<void> {
  const res = await request.post(`${BASE_URL}/api/orders/${orderId}/submit`, {
    headers: authHeaders,
  });
  expect(res.ok(), `Submit order ${orderId} should succeed`).toBeTruthy();
}

/**
 * Approve a work order at the current level via the API.
 */
async function approveWorkOrderViaApi(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  orderId: string,
  version: number,
): Promise<void> {
  const res = await request.post(`${BASE_URL}/api/orders/${orderId}/approve`, {
    headers: authHeaders,
    data: { version },
  });
  expect(res.ok(), `Approve order ${orderId} should succeed`).toBeTruthy();
}

/**
 * Reject a work order at the current level via the API.
 */
async function rejectWorkOrderViaApi(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  orderId: string,
  version: number,
  rejectionReason: string,
): Promise<void> {
  const res = await request.post(`${BASE_URL}/api/orders/${orderId}/reject`, {
    headers: authHeaders,
    data: { version, rejectionReason },
  });
  expect(res.ok(), `Reject order ${orderId} should succeed`).toBeTruthy();
}

/**
 * Fetch a work order's current state via the API.
 */
async function getWorkOrderStatus(
  request: APIRequestContext,
  authHeaders: Record<string, string>,
  orderId: string,
): Promise<{ status: OrderStatusType; version: number }> {
  const res = await request.get(`${BASE_URL}/api/orders/${orderId}`, {
    headers: authHeaders,
  });
  expect(res.ok(), `Get order ${orderId} should succeed`).toBeTruthy();
  const body = await res.json();
  const data = body.data ?? body;
  return {
    status: data.status,
    version: data.version,
  };
}

// ---------------------------------------------------------------------------
// Test suite – API-level tests (ATB-1, ATB-2, ATB-3)
// ---------------------------------------------------------------------------

test.describe('审批流 API 测试', () => {
  let supervisorAuth: { token: string; headers: Record<string, string> };
  let assetAdminAuth: { token: string; headers: Record<string, string> };

  test.beforeAll(async ({ request }) => {
    supervisorAuth = await getAuthenticatedContext(request, 'DEPT_SUPERVISOR');
    assetAdminAuth = await getAuthenticatedContext(request, 'ASSET_ADMIN');
  });

  // -----------------------------------------------------------------------
  // ATB-1: Backend state machine forward transition
  // -----------------------------------------------------------------------

  test('ATB-1: 工单正向流转 PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED', async ({
    request,
  }) => {
    // Create & submit → APPROVING_LEVEL_1
    const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
    await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

    let state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.APPROVING_LEVEL_1);

    // Level-1 approve (dept supervisor) → APPROVING_LEVEL_2
    await approveWorkOrderViaApi(request, supervisorAuth.headers, orderId, state.version);

    state = await getWorkOrderStatus(request, assetAdminAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.APPROVING_LEVEL_2);

    // Level-2 approve (asset admin) → APPROVED
    await approveWorkOrderViaApi(request, assetAdminAuth.headers, orderId, state.version);

    state = await getWorkOrderStatus(request, assetAdminAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.APPROVED);
  });

  // -----------------------------------------------------------------------
  // ATB-2: Backend state machine rejection
  // -----------------------------------------------------------------------

  test('ATB-2: 审批驳回 – APPROVING_LEVEL_1 驳回至 REJECTED，缺失 rejectionReason 返回 400', async ({
    request,
  }) => {
    const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
    await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

    let state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.APPROVING_LEVEL_1);

    // Reject with valid reason → REJECTED
    await rejectWorkOrderViaApi(
      request,
      supervisorAuth.headers,
      orderId,
      state.version,
      '不合规',
    );

    state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.REJECTED);

    // Create another order and attempt reject WITHOUT reason → 400
    const orderId2 = await createWorkOrderViaApi(request, supervisorAuth.headers);
    await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId2);

    const res400 = await request.post(`${BASE_URL}/api/orders/${orderId2}/reject`, {
      headers: supervisorAuth.headers,
      data: { version: 1 }, // missing rejectionReason
    });
    expect(res400.status(), 'Missing rejectionReason should return 400').toBe(400);
  });

  // -----------------------------------------------------------------------
  // ATB-3: Backend illegal state transition interception
  // -----------------------------------------------------------------------

  test('ATB-3: 非法状态流转拦截 – PENDING 工单直接资产管理员审批返回 409', async ({
    request,
  }) => {
    const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
    // Order is in PENDING state – asset admin cannot approve yet

    const res = await request.post(`${BASE_URL}/api/orders/${orderId}/approve`, {
      headers: assetAdminAuth.headers,
      data: { version: 0 },
    });

    expect(res.status(), 'Illegal transition should return 409').toBe(409);
    const body = await res.json();
    expect(body.code ?? body.errorCode).toBe('INVALID_STATE_TRANSITION');

    // Verify status unchanged
    const state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.PENDING);
  });

  // -----------------------------------------------------------------------
  // Additional: Concurrency / optimistic lock test
  // -----------------------------------------------------------------------

  test('乐观锁并发冲突 – 同一工单并发审批返回 409', async ({ request }) => {
    const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
    await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

    const state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
    expect(state.status).toBe(OrderStatus.APPROVING_LEVEL_1);

    // First approve succeeds
    await approveWorkOrderViaApi(request, supervisorAuth.headers, orderId, state.version);

    // Second approve with stale version → 409
    const resConflict = await request.post(`${BASE_URL}/api/orders/${orderId}/approve`, {
      headers: assetAdminAuth.headers,
      data: { version: state.version }, // stale version
    });
    expect(resConflict.status(), 'Stale version should return 409').toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Test suite – Frontend E2E tests (ATB-4, ATB-5)
// ---------------------------------------------------------------------------

test.describe('审批工作台前端 E2E 测试', () => {
  // -----------------------------------------------------------------------
  // ATB-4: Pending approval list rendering
  // -----------------------------------------------------------------------

  test.describe('ATB-4: 待审批列表渲染', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('部门主管登录后，/approvals/pending 仅展示 APPROVING_LEVEL_1 工单', async ({
      page,
      request,
    }) => {
      // Prepare data: create & submit an order so it reaches APPROVING_LEVEL_1
      const supervisorAuth = await getAuthenticatedContext(request, 'DEPT_SUPERVISOR');
      const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
      await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

      // Login as dept supervisor via UI
      await loginAsRole(page, 'DEPT_SUPERVISOR');

      // Navigate to pending approvals page
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      // Verify the list is visible
      const listContainer = page.getByTestId('approval-pending-list');
      await expect(listContainer, 'Approval list container should be visible').toBeVisible();

      // Verify each row shows APPROVING_LEVEL_1 status
      const rows = page.getByTestId('approval-list-row');
      const rowCount = await rows.count();

      // At least the order we just created should appear
      expect(rowCount, 'There should be at least one pending order').toBeGreaterThanOrEqual(1);

      for (let i = 0; i < rowCount; i++) {
        const statusCell = rows.nth(i).getByTestId('row-status');
        await expect(statusCell).toHaveText(/APPROVING_LEVEL_1|一级审批中/);
      }

      // Verify required columns: order number, applicant, submission time
      const headerRow = page.getByTestId('approval-list-header');
      await expect(headerRow.getByText(/工单号|订单号|Order No/i)).toBeVisible();
      await expect(headerRow.getByText(/申请人|Applicant/i)).toBeVisible();
      await expect(headerRow.getByText(/提交时间|Submission Time/i)).toBeVisible();
    });

    test('资产管理员登录后，/approvals/pending 仅展示 APPROVING_LEVEL_2 工单', async ({
      page,
      request,
    }) => {
      // Prepare data: create, submit, and level-1 approve so it reaches APPROVING_LEVEL_2
      const supervisorAuth = await getAuthenticatedContext(request, 'DEPT_SUPERVISOR');
      const assetAdminAuth = await getAuthenticatedContext(request, 'ASSET_ADMIN');

      const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
      await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

      let state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
      await approveWorkOrderViaApi(request, supervisorAuth.headers, orderId, state.version);

      state = await getWorkOrderStatus(request, assetAdminAuth.headers, orderId);
      expect(state.status).toBe(OrderStatus.APPROVING_LEVEL_2);

      // Login as asset admin via UI
      await loginAsRole(page, 'ASSET_ADMIN');

      // Navigate to pending approvals page
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      // Verify each row shows APPROVING_LEVEL_2 status
      const rows = page.getByTestId('approval-list-row');
      const rowCount = await rows.count();
      expect(rowCount, 'There should be at least one pending order for asset admin').toBeGreaterThanOrEqual(1);

      for (let i = 0; i < rowCount; i++) {
        const statusCell = rows.nth(i).getByTestId('row-status');
        await expect(statusCell).toHaveText(/APPROVING_LEVEL_2|二级审批中/);
      }
    });
  });

  // -----------------------------------------------------------------------
  // ATB-5: Approval detail & operations
  // -----------------------------------------------------------------------

  test.describe('ATB-5: 审批详情与操作', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('驳回操作 – 空原因前端校验拦截，输入原因后驳回成功', async ({
      page,
      request,
    }) => {
      // Prepare data
      const supervisorAuth = await getAuthenticatedContext(request, 'DEPT_SUPERVISOR');
      const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
      await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

      // Login as dept supervisor
      await loginAsRole(page, 'DEPT_SUPERVISOR');
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      // Click the first order row to enter detail page
      const firstRow = page.getByTestId('approval-list-row').first();
      await firstRow.click();
      await page.waitForURL(/\/approvals\/\d+/, { timeout: 10_000 });

      // Verify detail page loaded
      const detailContainer = page.getByTestId('approval-detail');
      await expect(detailContainer, 'Approval detail page should be visible').toBeVisible();

      // Click "Reject" button
      const rejectBtn = page.getByRole('button', { name: /驳回|Reject/i });
      await expect(rejectBtn, 'Reject button should be visible').toBeVisible();
      await rejectBtn.click();

      // Rejection reason dialog/form should appear
      const rejectionForm = page.getByTestId('rejection-form');
      await expect(rejectionForm, 'Rejection form should appear').toBeVisible();

      // Try to confirm WITHOUT entering a reason
      const confirmBtn = page.getByRole('button', { name: /确认|Confirm/i });
      await confirmBtn.click();

      // Frontend validation should block submission
      const validationMsg = page.getByText(/请输入驳回原因|Rejection reason is required/i);
      await expect(validationMsg, 'Validation message for empty rejection reason should appear').toBeVisible();

      // Verify no API call was made (status should still be APPROVING_LEVEL_1)
      const stateBefore = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
      expect(stateBefore.status).toBe(OrderStatus.APPROVING_LEVEL_1);

      // Now enter a valid rejection reason
      const reasonInput = page.getByPlaceholder(/请输入驳回原因|Enter rejection reason/i);
      await reasonInput.fill('不合规');
      await confirmBtn.click();

      // Success toast/message should appear
      const successMsg = page.getByText(/驳回成功|Rejected successfully/i);
      await expect(successMsg, 'Success message should appear after rejection').toBeVisible({
        timeout: 10_000,
      });

      // Verify the order status changed to REJECTED via API
      const stateAfter = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
      expect(stateAfter.status).toBe(OrderStatus.REJECTED);

      // Navigate back to list – the rejected order should no longer appear
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      const remainingRows = page.getByTestId('approval-list-row');
      const remainingCount = await remainingRows.count();

      for (let i = 0; i < remainingCount; i++) {
        const rowText = await remainingRows.nth(i).textContent();
        expect(rowText, 'Rejected order should not appear in pending list').not.toContain(orderId);
      }
    });

    test('通过操作 – 部门主管审批通过后工单流转至 APPROVING_LEVEL_2，列表刷新后工单消失', async ({
      page,
      request,
    }) => {
      // Prepare data
      const supervisorAuth = await getAuthenticatedContext(request, 'DEPT_SUPERVISOR');
      const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
      await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

      // Login as dept supervisor
      await loginAsRole(page, 'DEPT_SUPERVISOR');
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      // Click the first order row to enter detail page
      const firstRow = page.getByTestId('approval-list-row').first();
      await firstRow.click();
      await page.waitForURL(/\/approvals\/\d+/, { timeout: 10_000 });

      // Click "Approve" button
      const approveBtn = page.getByRole('button', { name: /通过|Approve/i });
      await expect(approveBtn, 'Approve button should be visible').toBeVisible();
      await approveBtn.click();

      // Confirm approval if a confirmation dialog appears
      const confirmApproveBtn = page.getByRole('button', { name: /确认|Confirm/i });
      if (await confirmApproveBtn.isVisible()) {
        await confirmApproveBtn.click();
      }

      // Success toast/message should appear
      const successMsg = page.getByText(/审批通过|Approved successfully/i);
      await expect(successMsg, 'Success message should appear after approval').toBeVisible({
        timeout: 10_000,
      });

      // Verify the order status changed to APPROVING_LEVEL_2 via API
      const assetAdminAuth = await getAuthenticatedContext(request, 'ASSET_ADMIN');
      const state = await getWorkOrderStatus(request, assetAdminAuth.headers, orderId);
      expect(state.status).toBe(OrderStatus.APPROVING_LEVEL_2);

      // Navigate back to dept supervisor's pending list – the approved order should no longer appear
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      const remainingRows = page.getByTestId('approval-list-row');
      const remainingCount = await remainingRows.count();

      for (let i = 0; i < remainingCount; i++) {
        const rowText = await remainingRows.nth(i).textContent();
        expect(rowText, 'Approved order should not appear in dept supervisor pending list').not.toContain(orderId);
      }
    });

    test('资产管理员审批通过后工单流转至 APPROVED', async ({
      page,
      request,
    }) => {
      // Prepare data: create, submit, level-1 approve
      const supervisorAuth = await getAuthenticatedContext(request, 'DEPT_SUPERVISOR');
      const assetAdminAuth = await getAuthenticatedContext(request, 'ASSET_ADMIN');

      const orderId = await createWorkOrderViaApi(request, supervisorAuth.headers);
      await submitWorkOrderViaApi(request, supervisorAuth.headers, orderId);

      let state = await getWorkOrderStatus(request, supervisorAuth.headers, orderId);
      await approveWorkOrderViaApi(request, supervisorAuth.headers, orderId, state.version);

      // Login as asset admin
      await loginAsRole(page, 'ASSET_ADMIN');
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      // Click the first order row to enter detail page
      const firstRow = page.getByTestId('approval-list-row').first();
      await firstRow.click();
      await page.waitForURL(/\/approvals\/\d+/, { timeout: 10_000 });

      // Click "Approve" button
      const approveBtn = page.getByRole('button', { name: /通过|Approve/i });
      await approveBtn.click();

      // Confirm if dialog appears
      const confirmApproveBtn = page.getByRole('button', { name: /确认|Confirm/i });
      if (await confirmApproveBtn.isVisible()) {
        await confirmApproveBtn.click();
      }

      // Success message
      const successMsg = page.getByText(/审批通过|Approved successfully/i);
      await expect(successMsg, 'Success message should appear after level-2 approval').toBeVisible({
        timeout: 10_000,
      });

      // Verify final status is APPROVED
      const finalState = await getWorkOrderStatus(request, assetAdminAuth.headers, orderId);
      expect(finalState.status).toBe(OrderStatus.APPROVED);

      // The order should no longer appear in asset admin's pending list
      await page.goto(`${APP_URL}/approvals/pending`);
      await page.waitForLoadState('networkidle');

      const remainingRows = page.getByTestId('approval-list-row');
      const remainingCount = await remainingRows.count();

      for (let i = 0; i < remainingCount; i++) {
        const rowText = await remainingRows.nth(i).textContent();
        expect(rowText, 'Fully approved order should not appear in pending list').not.toContain(orderId);
      }
    });
  });
});