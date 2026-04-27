/**
 * E2E tests for Work Order Approval Workflow
 *
 * Covers ATB-1 through ATB-5 from the Phase 1 spec:
 *   ATB-1: Backend state machine forward flow (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
 *   ATB-2: Backend state machine reverse flow (rejection at any approval node)
 *   ATB-3: Backend illegal state transition interception
 *   ATB-4: Frontend pending approval list rendering (role-based filtering)
 *   ATB-5: Frontend approval detail & operations (approve / reject with validation)
 *
 * Tech stack: Playwright, React 18+, TypeScript 5.x
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';

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

/** Shape of a work order returned by the API */
interface WorkOrder {
  id: string;
  orderNo: string;
  applicant: string;
  status: OrderStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Shape of an approval record */
interface ApprovalRecord {
  id: string;
  orderId: string;
  operatorId: string;
  action: 'APPROVE' | 'REJECT';
  comment: string;
  createdAt: string;
}

/** API error response */
interface ApiError {
  errorCode: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = '/api';
const ORDERS_ENDPOINT = `${API_BASE}/orders`;
const APPROVALS_PENDING_ROUTE = '/approvals/pending';

/** Test user credentials – department supervisor (Level-1 approver) */
const DEPT_SUPERVISOR = {
  username: 'dept_supervisor_e2e',
  password: 'Test@1234',
  role: 'DEPT_SUPERVISOR' as const,
};

/** Test user credentials – asset manager (Level-2 approver) */
const ASSET_MANAGER = {
  username: 'asset_manager_e2e',
  password: 'Test@1234',
  role: 'ASSET_MANAGER' as const,
};

/** Test user credentials – regular applicant */
const APPLICANT = {
  username: 'applicant_e2e',
  password: 'Test@1234',
  role: 'APPLICANT' as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authenticate via the API and return the auth token.
 */
async function login(
  request: APIRequestContext,
  user: { username: string; password: string },
): Promise<string> {
  const resp = await request.post(`${API_BASE}/auth/login`, {
    data: { username: user.username, password: user.password },
  });
  expect(resp.ok(), `Login failed for ${user.username}`).toBeTruthy();
  const body = await resp.json();
  return body.token as string;
}

/**
 * Create a work order via API and return it.
 */
async function createWorkOrder(
  request: APIRequestContext,
  token: string,
): Promise<WorkOrder> {
  const resp = await request.post(ORDERS_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `E2E-Order-${Date.now()}`,
      description: 'Created by E2E test',
    },
  });
  expect(resp.status(), 'Create work order should return 200 or 201').toBeLessThan(300);
  return resp.json() as Promise<WorkOrder>;
}

/**
 * Submit a PENDING work order so it enters APPROVING_LEVEL_1.
 */
async function submitWorkOrder(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<WorkOrder> {
  const resp = await request.post(`${ORDERS_ENDPOINT}/${orderId}/submit`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok(), `Submit order ${orderId} should succeed`).toBeTruthy();
  return resp.json() as Promise<WorkOrder>;
}

/**
 * Approve a work order at the current approval level.
 */
async function approveOrder(
  request: APIRequestContext,
  token: string,
  orderId: string,
  version: number,
): Promise<WorkOrder> {
  const resp = await request.post(`${ORDERS_ENDPOINT}/${orderId}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { version },
  });
  expect(resp.ok(), `Approve order ${orderId} should succeed`).toBeTruthy();
  return resp.json() as Promise<WorkOrder>;
}

/**
 * Reject a work order at the current approval level.
 */
async function rejectOrder(
  request: APIRequestContext,
  token: string,
  orderId: string,
  version: number,
  rejectionReason: string,
): Promise<WorkOrder> {
  const resp = await request.post(`${ORDERS_ENDPOINT}/${orderId}/reject`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { version, rejectionReason },
  });
  expect(resp.ok(), `Reject order ${orderId} should succeed`).toBeTruthy();
  return resp.json() as Promise<WorkOrder>;
}

/**
 * Get a single work order by ID.
 */
async function getWorkOrder(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<WorkOrder> {
  const resp = await request.get(`${ORDERS_ENDPOINT}/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok(), `Get order ${orderId} should succeed`).toBeTruthy();
  return resp.json() as Promise<WorkOrder>;
}

/**
 * Get approval records for a work order.
 */
async function getApprovalRecords(
  request: APIRequestContext,
  token: string,
  orderId: string,
): Promise<ApprovalRecord[]> {
  const resp = await request.get(`${ORDERS_ENDPOINT}/${orderId}/approval-records`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok(), `Get approval records for order ${orderId} should succeed`).toBeTruthy();
  return resp.json() as Promise<ApprovalRecord[]>;
}

/**
 * Login via the UI and navigate to the pending approvals page.
 */
async function loginAsRole(page: Page, user: { username: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder(/用户名|username/i).fill(user.username);
  await page.getByPlaceholder(/密码|password/i).fill(user.password);
  await page.getByRole('button', { name: /登录|login/i }).click();
  // Wait for redirect after login
  await page.waitForURL(/\/(dashboard|approvals)/, { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Work Order Approval Workflow', () => {
  // -------------------------------------------------------------------------
  // ATB-1: Backend state machine forward flow
  // -------------------------------------------------------------------------
  test.describe('ATB-1: Forward state transition flow', () => {
    let applicantToken: string;
    let supervisorToken: string;
    let managerToken: string;
    let order: WorkOrder;

    test.beforeAll(async ({ request }) => {
      applicantToken = await login(request, APPLICANT);
      supervisorToken = await login(request, DEPT_SUPERVISOR);
      managerToken = await login(request, ASSET_MANAGER);
    });

    test('should transition PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED', async ({
      request,
    }) => {
      // Step 1: Create and submit order → PENDING
      order = await createWorkOrder(request, applicantToken);
      expect(order.status).toBe('PENDING');

      // Submit to enter approval pipeline → APPROVING_LEVEL_1
      order = await submitWorkOrder(request, applicantToken, order.id);
      expect(order.status).toBe('APPROVING_LEVEL_1');

      // Step 2: Level-1 approval (department supervisor) → APPROVING_LEVEL_2
      order = await approveOrder(request, supervisorToken, order.id, order.version);
      expect(order.status).toBe('APPROVING_LEVEL_2');

      // Step 3: Level-2 approval (asset manager) → APPROVED
      order = await approveOrder(request, managerToken, order.id, order.version);
      expect(order.status).toBe('APPROVED');

      // Verify approval records were persisted
      const records = await getApprovalRecords(request, applicantToken, order.id);
      expect(records.length).toBeGreaterThanOrEqual(2);

      const approveActions = records.filter((r) => r.action === 'APPROVE');
      expect(approveActions.length).toBe(2);
    });

    test('each transition should increment the version (optimistic lock)', async ({
      request,
    }) => {
      order = await createWorkOrder(request, applicantToken);
      const initialVersion = order.version;

      order = await submitWorkOrder(request, applicantToken, order.id);
      expect(order.version).toBe(initialVersion + 1);

      order = await approveOrder(request, supervisorToken, order.id, order.version);
      expect(order.version).toBe(initialVersion + 2);

      order = await approveOrder(request, managerToken, order.id, order.version);
      expect(order.version).toBe(initialVersion + 3);
    });
  });

  // -------------------------------------------------------------------------
  // ATB-2: Backend state machine reverse flow (rejection)
  // -------------------------------------------------------------------------
  test.describe('ATB-2: Rejection flow', () => {
    let applicantToken: string;
    let supervisorToken: string;
    let managerToken: string;

    test.beforeAll(async ({ request }) => {
      applicantToken = await login(request, APPLICANT);
      supervisorToken = await login(request, DEPT_SUPERVISOR);
      managerToken = await login(request, ASSET_MANAGER);
    });

    test('should reject at APPROVING_LEVEL_1 with valid rejectionReason', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);
      expect(order.status).toBe('APPROVING_LEVEL_1');

      // Reject with reason
      order = await rejectOrder(
        request,
        supervisorToken,
        order.id,
        order.version,
        '不合规',
      );
      expect(order.status).toBe('REJECTED');

      // Verify rejection record persisted
      const records = await getApprovalRecords(request, applicantToken, order.id);
      const rejectRecord = records.find((r) => r.action === 'REJECT');
      expect(rejectRecord).toBeDefined();
      expect(rejectRecord!.comment).toBe('不合规');
    });

    test('should reject at APPROVING_LEVEL_2 with valid rejectionReason', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);
      order = await approveOrder(request, supervisorToken, order.id, order.version);
      expect(order.status).toBe('APPROVING_LEVEL_2');

      // Reject at level 2
      order = await rejectOrder(
        request,
        managerToken,
        order.id,
        order.version,
        '资产信息不完整，需要补充材料',
      );
      expect(order.status).toBe('REJECTED');

      // Verify rejection record
      const records = await getApprovalRecords(request, applicantToken, order.id);
      const rejectRecord = records.find((r) => r.action === 'REJECT');
      expect(rejectRecord).toBeDefined();
      expect(rejectRecord!.comment).toContain('资产信息不完整');
    });

    test('should return 400 when rejectionReason is missing', async ({ request }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);

      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/reject`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        data: { version: order.version }, // no rejectionReason
      });

      expect(resp.status()).toBe(400);
      const body: ApiError = await resp.json();
      expect(body.errorCode).toBeDefined();
    });

    test('should return 400 when rejectionReason is empty string', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);

      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/reject`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        data: { version: order.version, rejectionReason: '' },
      });

      expect(resp.status()).toBe(400);
    });

    test('should return 400 when rejectionReason exceeds 500 characters', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);

      const longReason = 'A'.repeat(501);
      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/reject`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        data: { version: order.version, rejectionReason: longReason },
      });

      expect(resp.status()).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // ATB-3: Backend illegal state transition interception
  // -------------------------------------------------------------------------
  test.describe('ATB-3: Illegal state transition interception', () => {
    let applicantToken: string;
    let supervisorToken: string;
    let managerToken: string;

    test.beforeAll(async ({ request }) => {
      applicantToken = await login(request, APPLICANT);
      supervisorToken = await login(request, DEPT_SUPERVISOR);
      managerToken = await login(request, ASSET_MANAGER);
    });

    test('should return 409 when asset manager approves a PENDING order (skip level)', async ({
      request,
    }) => {
      const order = await createWorkOrder(request, applicantToken);
      expect(order.status).toBe('PENDING');

      // Asset manager tries to approve a PENDING order – should be blocked
      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/approve`, {
        headers: { Authorization: `Bearer ${managerToken}` },
        data: { version: order.version },
      });

      expect(resp.status()).toBe(409);
      const body: ApiError = await resp.json();
      expect(body.errorCode).toBe('INVALID_STATE_TRANSITION');

      // Verify status unchanged
      const refreshed = await getWorkOrder(request, applicantToken, order.id);
      expect(refreshed.status).toBe('PENDING');
    });

    test('should return 409 when approving an already APPROVED order', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);
      order = await approveOrder(request, supervisorToken, order.id, order.version);
      order = await approveOrder(request, managerToken, order.id, order.version);
      expect(order.status).toBe('APPROVED');

      // Try to approve again
      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/approve`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        data: { version: order.version },
      });

      expect(resp.status()).toBe(409);
      const body: ApiError = await resp.json();
      expect(body.errorCode).toBe('INVALID_STATE_TRANSITION');
    });

    test('should return 409 when approving a REJECTED order', async ({ request }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);
      order = await rejectOrder(request, supervisorToken, order.id, order.version, '驳回');
      expect(order.status).toBe('REJECTED');

      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/approve`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        data: { version: order.version },
      });

      expect(resp.status()).toBe(409);
      const body: ApiError = await resp.json();
      expect(body.errorCode).toBe('INVALID_STATE_TRANSITION');
    });

    test('should return 409 on concurrent approval (optimistic lock conflict)', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);

      // Two concurrent approve requests with the same version
      const [resp1, resp2] = await Promise.all([
        request.post(`${ORDERS_ENDPOINT}/${order.id}/approve`, {
          headers: { Authorization: `Bearer ${supervisorToken}` },
          data: { version: order.version },
        }),
        request.post(`${ORDERS_ENDPOINT}/${order.id}/approve`, {
          headers: { Authorization: `Bearer ${supervisorToken}` },
          data: { version: order.version },
        }),
      ]);

      // One should succeed (200) and the other should fail (409)
      const statuses = [resp1.status(), resp2.status()].sort();
      expect(statuses).toContain(409);

      const conflictResp = resp1.status() === 409 ? resp1 : resp2;
      const body: ApiError = await conflictResp.json();
      expect(body.errorCode).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });

    test('should return 409 when department supervisor tries to approve at APPROVING_LEVEL_2', async ({
      request,
    }) => {
      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);
      order = await approveOrder(request, supervisorToken, order.id, order.version);
      expect(order.status).toBe('APPROVING_LEVEL_2');

      // Department supervisor should not be able to approve at level 2
      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/approve`, {
        headers: { Authorization: `Bearer ${supervisorToken}` },
        data: { version: order.version },
      });

      expect(resp.status()).toBe(409);
      const body: ApiError = await resp.json();
      expect(body.errorCode).toBe('INVALID_STATE_TRANSITION');
    });
  });

  // -------------------------------------------------------------------------
  // ATB-4: Frontend pending approval list rendering (role-based filtering)
  // -------------------------------------------------------------------------
  test.describe('ATB-4: Pending approval list rendering', () => {
    test('department supervisor sees only APPROVING_LEVEL_1 orders', async ({
      page,
      request,
    }) => {
      // Setup: create orders in different states via API
      const applicantToken = await login(request, APPLICANT);
      const supervisorToken = await login(request, DEPT_SUPERVISOR);

      // Order A: in APPROVING_LEVEL_1
      const orderA = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, orderA.id);

      // Order B: already approved to APPROVING_LEVEL_2
      const orderB = await createWorkOrder(request, applicantToken);
      let b = await submitWorkOrder(request, applicantToken, orderB.id);
      await approveOrder(request, supervisorToken, orderB.id, b.version);

      // Login as department supervisor via UI
      await loginAsRole(page, DEPT_SUPERVISOR);

      // Navigate to pending approvals page
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // Verify the list contains only APPROVING_LEVEL_1 orders
      const rows = page.getByRole('row').filter({ hasText: /WO-/ });
      const rowCount = await rows.count();

      // At least orderA should be visible
      expect(rowCount).toBeGreaterThanOrEqual(1);

      // Order A (APPROVING_LEVEL_1) should be in the list
      await expect(rows.filter({ hasText: orderA.orderNo })).toBeVisible();

      // Order B (APPROVING_LEVEL_2) should NOT be in the list
      await expect(rows.filter({ hasText: orderB.orderNo })).not.toBeVisible();

      // Verify required columns are present
      const headerRow = page.getByRole('row').first();
      await expect(headerRow).toContainText(/工单号|订单号|Order/i);
      await expect(headerRow).toContainText(/申请人|Applicant/i);
      await expect(headerRow).toContainText(/提交时间|Submitted/i);
    });

    test('asset manager sees only APPROVING_LEVEL_2 orders', async ({
      page,
      request,
    }) => {
      const applicantToken = await login(request, APPLICANT);
      const supervisorToken = await login(request, DEPT_SUPERVISOR);

      // Order C: in APPROVING_LEVEL_2
      const orderC = await createWorkOrder(request, applicantToken);
      let c = await submitWorkOrder(request, applicantToken, orderC.id);
      await approveOrder(request, supervisorToken, orderC.id, c.version);

      // Order D: still in APPROVING_LEVEL_1
      const orderD = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, orderD.id);

      // Login as asset manager via UI
      await loginAsRole(page, ASSET_MANAGER);

      // Navigate to pending approvals page
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      const rows = page.getByRole('row').filter({ hasText: /WO-/ });

      // Order C (APPROVING_LEVEL_2) should be visible
      await expect(rows.filter({ hasText: orderC.orderNo })).toBeVisible();

      // Order D (APPROVING_LEVEL_1) should NOT be visible to asset manager
      await expect(rows.filter({ hasText: orderD.orderNo })).not.toBeVisible();
    });

    test('pending list displays order number, applicant, and submission time columns', async ({
      page,
      request,
    }) => {
      const applicantToken = await login(request, APPLICANT);
      const order = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, order.id);

      await loginAsRole(page, DEPT_SUPERVISOR);
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // Verify the order row contains the required data
      const orderRow = page.getByRole('row').filter({ hasText: order.orderNo });
      await expect(orderRow).toBeVisible();

      // Applicant name should be displayed
      await expect(orderRow).toContainText(order.applicant);

      // Submission time should be displayed (ISO 8601 or localized format)
      const timePattern = /\d{4}[-/]\d{2}[-/]\d{2}/;
      await expect(orderRow).toContainText(timePattern);
    });
  });

  // -------------------------------------------------------------------------
  // ATB-5: Frontend approval detail & operations
  // -------------------------------------------------------------------------
  test.describe('ATB-5: Approval detail and operations', () => {
    test('reject without reason shows validation error; reject with reason succeeds', async ({
      page,
      request,
    }) => {
      const applicantToken = await login(request, APPLICANT);
      const supervisorToken = await login(request, DEPT_SUPERVISOR);

      // Create an order in APPROVING_LEVEL_1
      const order = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, order.id);

      // Login as department supervisor
      await loginAsRole(page, DEPT_SUPERVISOR);
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // Click on the order to enter detail page
      const orderRow = page.getByRole('row').filter({ hasText: order.orderNo });
      await orderRow.click();

      // Wait for detail page to load
      await page.waitForURL(/\/approvals\/\d+/);
      await page.waitForLoadState('networkidle');

      // Click "Reject" button
      const rejectBtn = page.getByRole('button', { name: /驳回|Reject/i });
      await rejectBtn.click();

      // A dialog/form should appear with a rejection reason field
      const reasonField = page.getByPlaceholder(/驳回原因|rejection reason/i);

      // Click confirm without entering a reason
      const confirmBtn = page.getByRole('button', { name: /确认|Confirm|提交|Submit/i });
      await confirmBtn.click();

      // Frontend validation should block submission and show error
      const validationMsg = page.getByText(/请输入驳回原因|rejection reason is required|不能为空/i);
      await expect(validationMsg).toBeVisible();

      // Now enter a valid rejection reason
      await reasonField.fill('不合规');

      // Click confirm again
      await confirmBtn.click();

      // Should show success message
      const successMsg = page.getByText(/驳回成功|rejected successfully|操作成功/i);
      await expect(successMsg).toBeVisible({ timeout: 10000 });

      // After success, navigate back to pending list
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // The rejected order should no longer appear in the pending list
      const rows = page.getByRole('row').filter({ hasText: order.orderNo });
      await expect(rows).not.toBeVisible();
    });

    test('approve action moves order to next level and removes from list', async ({
      page,
      request,
    }) => {
      const applicantToken = await login(request, APPLICANT);
      const supervisorToken = await login(request, DEPT_SUPERVISOR);

      // Create an order in APPROVING_LEVEL_1
      const order = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, order.id);

      // Login as department supervisor
      await loginAsRole(page, DEPT_SUPERVISOR);
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // Click on the order to enter detail page
      const orderRow = page.getByRole('row').filter({ hasText: order.orderNo });
      await orderRow.click();

      await page.waitForURL(/\/approvals\/\d+/);
      await page.waitForLoadState('networkidle');

      // Click "Approve" button
      const approveBtn = page.getByRole('button', { name: /通过|Approve/i });
      await approveBtn.click();

      // May need to confirm the approval
      const confirmApproveBtn = page.getByRole('button', { name: /确认|Confirm/i });
      if (await confirmApproveBtn.isVisible()) {
        await confirmApproveBtn.click();
      }

      // Should show success message
      const successMsg = page.getByText(/审批通过|approved successfully|操作成功/i);
      await expect(successMsg).toBeVisible({ timeout: 10000 });

      // Navigate back to pending list
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // The approved order should no longer appear (it moved to APPROVING_LEVEL_2)
      const rows = page.getByRole('row').filter({ hasText: order.orderNo });
      await expect(rows).not.toBeVisible();

      // Verify via API that the order is now APPROVING_LEVEL_2
      const refreshed = await getWorkOrder(request, applicantToken, order.id);
      expect(refreshed.status).toBe('APPROVING_LEVEL_2');
    });

    test('full two-level approval flow via UI', async ({ page, request }) => {
      const applicantToken = await login(request, APPLICANT);
      const supervisorToken = await login(request, DEPT_SUPERVISOR);
      const managerToken = await login(request, ASSET_MANAGER);

      // Create an order and submit it
      const order = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, order.id);

      // ---- Level 1: Department Supervisor approves ----
      await loginAsRole(page, DEPT_SUPERVISOR);
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // Find and click the order
      const orderRowL1 = page.getByRole('row').filter({ hasText: order.orderNo });
      await orderRowL1.click();
      await page.waitForURL(/\/approvals\/\d+/);
      await page.waitForLoadState('networkidle');

      // Approve
      await page.getByRole('button', { name: /通过|Approve/i }).click();
      const confirmBtnL1 = page.getByRole('button', { name: /确认|Confirm/i });
      if (await confirmBtnL1.isVisible()) {
        await confirmBtnL1.click();
      }

      const successL1 = page.getByText(/审批通过|approved successfully|操作成功/i);
      await expect(successL1).toBeVisible({ timeout: 10000 });

      // ---- Level 2: Asset Manager approves ----
      await loginAsRole(page, ASSET_MANAGER);
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      // Find the order (now in APPROVING_LEVEL_2)
      const orderRowL2 = page.getByRole('row').filter({ hasText: order.orderNo });
      await orderRowL2.click();
      await page.waitForURL(/\/approvals\/\d+/);
      await page.waitForLoadState('networkidle');

      // Approve
      await page.getByRole('button', { name: /通过|Approve/i }).click();
      const confirmBtnL2 = page.getByRole('button', { name: /确认|Confirm/i });
      if (await confirmBtnL2.isVisible()) {
        await confirmBtnL2.click();
      }

      const successL2 = page.getByText(/审批通过|approved successfully|操作成功/i);
      await expect(successL2).toBeVisible({ timeout: 10000 });

      // Verify final state via API
      const finalOrder = await getWorkOrder(request, applicantToken, order.id);
      expect(finalOrder.status).toBe('APPROVED');

      // Verify two approval records exist
      const records = await getApprovalRecords(request, applicantToken, order.id);
      const approveRecords = records.filter((r) => r.action === 'APPROVE');
      expect(approveRecords.length).toBe(2);
    });

    test('approval detail page displays approval history', async ({
      page,
      request,
    }) => {
      const applicantToken = await login(request, APPLICANT);
      const supervisorToken = await login(request, DEPT_SUPERVISOR);

      // Create and submit an order, then approve at level 1
      const order = await createWorkOrder(request, applicantToken);
      await submitWorkOrder(request, applicantToken, order.id);
      let o = await getWorkOrder(request, applicantToken, order.id);
      await approveOrder(request, supervisorToken, order.id, o.version);

      // Login as asset manager and view the order detail
      await loginAsRole(page, ASSET_MANAGER);
      await page.goto(APPROVALS_PENDING_ROUTE);
      await page.waitForLoadState('networkidle');

      const orderRow = page.getByRole('row').filter({ hasText: order.orderNo });
      await orderRow.click();
      await page.waitForURL(/\/approvals\/\d+/);
      await page.waitForLoadState('networkidle');

      // Approval history section should be visible
      const historySection = page.getByText(/审批记录|Approval History|审批历史/i);
      await expect(historySection).toBeVisible();

      // Level-1 approval record should be shown
      const level1Record = page.getByText(/部门主管.*通过|Level 1.*Approved|APPROVE/i);
      await expect(level1Record).toBeVisible();
    });
  });

  // -------------------------------------------------------------------------
  // CANCELLED state coverage
  // -------------------------------------------------------------------------
  test.describe('CANCELLED state', () => {
    let applicantToken: string;

    test.beforeAll(async ({ request }) => {
      applicantToken = await login(request, APPLICANT);
    });

    test('should allow cancelling a PENDING order', async ({ request }) => {
      const order = await createWorkOrder(request, applicantToken);
      expect(order.status).toBe('PENDING');

      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/cancel`, {
        headers: { Authorization: `Bearer ${applicantToken}` },
        data: { version: order.version },
      });

      expect(resp.ok(), 'Cancel should succeed for PENDING order').toBeTruthy();
      const cancelled = (await resp.json()) as WorkOrder;
      expect(cancelled.status).toBe('CANCELLED');
    });

    test('should not allow cancelling an APPROVED order', async ({ request }) => {
      const supervisorToken = await login(request, DEPT_SUPERVISOR);
      const managerToken = await login(request, ASSET_MANAGER);

      let order = await createWorkOrder(request, applicantToken);
      order = await submitWorkOrder(request, applicantToken, order.id);
      order = await approveOrder(request, supervisorToken, order.id, order.version);
      order = await approveOrder(request, managerToken, order.id, order.version);
      expect(order.status).toBe('APPROVED');

      const resp = await request.post(`${ORDERS_ENDPOINT}/${order.id}/cancel`, {
        headers: { Authorization: `Bearer ${applicantToken}` },
        data: { version: order.version },
      });

      expect(resp.status()).toBe(409);
      const body: ApiError = await resp.json();
      expect(body.errorCode).toBe('INVALID_STATE_TRANSITION');
    });
  });
});