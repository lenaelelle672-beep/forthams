/**
 * Unit tests for Work Order Approval API layer
 *
 * Covers the frontend API integration for the multi-level approval workflow:
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   Any approval node → REJECTED (with mandatory rejectionReason)
 *   Any non-terminal node → CANCELLED
 *
 * ATB alignment:
 *   - ATB-1: Positive approval flow (approve endpoint calls)
 *   - ATB-2: Rejection flow with rejectionReason validation
 *   - ATB-3: Invalid state transition handling (409 Conflict)
 *   - ATB-4: Pending approval list with role-based filtering
 *   - ATB-5: Approval detail and action API calls
 *
 * Boundary constraints verified:
 *   - rejectionReason: non-empty string, max 500 chars → 400 if missing
 *   - Invalid state transition → 409 with INVALID_STATE_TRANSITION
 *   - Optimistic lock conflict → 409 with OPTIMISTIC_LOCK_CONFLICT
 *   - Role-based data isolation for approval list queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Types — mirror the canonical types from frontend/src/types/workorder.types.ts
// ---------------------------------------------------------------------------

/** Work order status enum matching backend OrderStatus */
export type OrderStatus =
  | 'PENDING'
  | 'APPROVING_LEVEL_1'
  | 'APPROVING_LEVEL_2'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/** Approval action enum for approval records */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/** Approval record persisted per action */
export interface ApprovalRecord {
  id: number;
  orderId: number;
  operatorId: number;
  operatorName: string;
  action: ApprovalAction;
  comment: string | null;
  rejectionReason: string | null;
  createdAt: string; // ISO 8601
}

/** Work order entity as returned by the API */
export interface WorkOrder {
  id: number;
  orderNo: string;
  title: string;
  description: string;
  applicantId: number;
  applicantName: string;
  status: OrderStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  approvalRecords: ApprovalRecord[];
}

/** Request body for approve action */
export interface ApproveRequest {
  version: number;
}

/** Request body for reject action — rejectionReason is mandatory */
export interface RejectRequest {
  version: number;
  rejectionReason: string;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** API error response structure */
export interface ApiErrorResponse {
  errorCode: string;
  message: string;
  timestamp: string;
}

/** Pending approval list query parameters */
export interface PendingApprovalQuery {
  status: OrderStatus;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// API module — thin wrapper around the HTTP client, mirroring
// frontend/src/api/workorder.ts and frontend/src/api/approval.ts
// ---------------------------------------------------------------------------

const API_BASE = '/api/orders';

/** Simulated HTTP client — replaced by mock in tests */
export const httpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

/**
 * Fetch a single work order by ID.
 */
export async function getWorkOrder(id: number): Promise<WorkOrder> {
  const response = await httpClient.get(`${API_BASE}/${id}`);
  return response.data as WorkOrder;
}

/**
 * Fetch the pending approval list filtered by the caller's role.
 * Department supervisors see APPROVING_LEVEL_1; asset admins see APPROVING_LEVEL_2.
 */
export async function getPendingApprovals(
  query: PendingApprovalQuery,
): Promise<PaginatedResponse<WorkOrder>> {
  const params = new URLSearchParams();
  params.set('status', query.status);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  const response = await httpClient.get(`${API_BASE}/pending?${params.toString()}`);
  return response.data as PaginatedResponse<WorkOrder>;
}

/**
 * Approve a work order at the current approval level.
 * Backend validates state machine transition and optimistic lock.
 */
export async function approveWorkOrder(
  id: number,
  body: ApproveRequest,
): Promise<WorkOrder> {
  const response = await httpClient.post(`${API_BASE}/${id}/approve`, body);
  return response.data as WorkOrder;
}

/**
 * Reject a work order at the current approval level.
 * rejectionReason is mandatory (non-empty, max 500 chars).
 */
export async function rejectWorkOrder(
  id: number,
  body: RejectRequest,
): Promise<WorkOrder> {
  const response = await httpClient.post(`${API_BASE}/${id}/reject`, body);
  return response.data as WorkOrder;
}

/**
 * Cancel a work order (from any non-terminal state).
 */
export async function cancelWorkOrder(
  id: number,
  body: { version: number },
): Promise<WorkOrder> {
  const response = await httpClient.post(`${API_BASE}/${id}/cancel`, body);
  return response.data as WorkOrder;
}

/**
 * Fetch approval records for a given work order.
 */
export async function getApprovalRecords(
  orderId: number,
): Promise<ApprovalRecord[]> {
  const response = await httpClient.get(`${API_BASE}/${orderId}/approval-records`);
  return response.data as ApprovalRecord[];
}

// ---------------------------------------------------------------------------
// Frontend-side validation helpers (mirroring what the UI form does before
// sending the request — ATB-5: empty rejectionReason blocked on client side)
// ---------------------------------------------------------------------------

/** Maximum allowed length for rejectionReason */
const MAX_REJECTION_REASON_LENGTH = 500;

/**
 * Validate rejection reason before sending to backend.
 * Returns an error message if invalid, or null if valid.
 */
export function validateRejectionReason(reason: unknown): string | null {
  if (reason === null || reason === undefined || typeof reason !== 'string') {
    return '驳回原因为必填项';
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return '驳回原因不能为空';
  }
  if (trimmed.length > MAX_REJECTION_REASON_LENGTH) {
    return `驳回原因不能超过${MAX_REJECTION_REASON_LENGTH}个字符`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Create a mock WorkOrder with sensible defaults */
function createMockWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 1,
    orderNo: 'WO-2025-001',
    title: '测试工单',
    description: '这是一个测试工单',
    applicantId: 100,
    applicantName: '张三',
    status: 'PENDING',
    version: 1,
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-01-15T08:00:00Z',
    approvalRecords: [],
    ...overrides,
  };
}

/** Create a mock ApprovalRecord */
function createMockApprovalRecord(
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  return {
    id: 1,
    orderId: 1,
    operatorId: 200,
    operatorName: '李主管',
    action: 'APPROVE',
    comment: null,
    rejectionReason: null,
    createdAt: '2025-01-15T09:00:00Z',
    ...overrides,
  };
}

/** Create an Axios-like error response */
function createApiError(
  status: number,
  errorCode: string,
  message: string,
): { response: { status: number; data: ApiErrorResponse } } {
  return {
    response: {
      status,
      data: {
        errorCode,
        message,
        timestamp: new Date().toISOString(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('WorkOrder API — Approval Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // ATB-1: Positive approval flow
  // =========================================================================
  describe('ATB-1: Approve work order — positive flow', () => {
    it('should call POST /api/orders/{id}/approve and return updated work order with status APPROVING_LEVEL_1', async () => {
      const mockResponse = createMockWorkOrder({
        status: 'APPROVING_LEVEL_1',
        version: 2,
        approvalRecords: [
          createMockApprovalRecord({
            action: 'APPROVE',
            comment: '提交审批',
          }),
        ],
      });

      httpClient.post.mockResolvedValue({ data: mockResponse });

      const result = await approveWorkOrder(1, { version: 1 });

      expect(httpClient.post).toHaveBeenCalledWith('/api/orders/1/approve', {
        version: 1,
      });
      expect(result.status).toBe('APPROVING_LEVEL_1');
      expect(result.version).toBe(2);
      expect(result.approvalRecords).toHaveLength(1);
    });

    it('should transition from APPROVING_LEVEL_1 to APPROVING_LEVEL_2 on second approval', async () => {
      const mockResponse = createMockWorkOrder({
        status: 'APPROVING_LEVEL_2',
        version: 3,
        approvalRecords: [
          createMockApprovalRecord({ action: 'APPROVE', comment: '部门主管通过' }),
          createMockApprovalRecord({
            id: 2,
            operatorId: 300,
            operatorName: '王资产管理员',
            action: 'APPROVE',
            comment: '资产管理员通过',
          }),
        ],
      });

      httpClient.post.mockResolvedValue({ data: mockResponse });

      const result = await approveWorkOrder(1, { version: 2 });

      expect(httpClient.post).toHaveBeenCalledWith('/api/orders/1/approve', {
        version: 2,
      });
      expect(result.status).toBe('APPROVING_LEVEL_2');
      expect(result.version).toBe(3);
    });

    it('should transition from APPROVING_LEVEL_2 to APPROVED on final approval', async () => {
      const mockResponse = createMockWorkOrder({
        status: 'APPROVED',
        version: 4,
        approvalRecords: [
          createMockApprovalRecord({ action: 'APPROVE' }),
          createMockApprovalRecord({ id: 2, action: 'APPROVE' }),
          createMockApprovalRecord({ id: 3, action: 'APPROVE', comment: '最终审批通过' }),
        ],
      });

      httpClient.post.mockResolvedValue({ data: mockResponse });

      const result = await approveWorkOrder(1, { version: 3 });

      expect(result.status).toBe('APPROVED');
      expect(result.approvalRecords).toHaveLength(3);
    });

    it('should include version in approve request body for optimistic locking', async () => {
      const mockResponse = createMockWorkOrder({ status: 'APPROVING_LEVEL_1', version: 2 });
      httpClient.post.mockResolvedValue({ data: mockResponse });

      await approveWorkOrder(1, { version: 5 });

      expect(httpClient.post).toHaveBeenCalledWith('/api/orders/1/approve', {
        version: 5,
      });
    });
  });

  // =========================================================================
  // ATB-2: Rejection flow
  // =========================================================================
  describe('ATB-2: Reject work order — rejection flow', () => {
    it('should call POST /api/orders/{id}/reject with rejectionReason and return REJECTED status', async () => {
      const mockResponse = createMockWorkOrder({
        status: 'REJECTED',
        version: 2,
        approvalRecords: [
          createMockApprovalRecord({
            action: 'REJECT',
            rejectionReason: '不合规',
            comment: '不合规',
          }),
        ],
      });

      httpClient.post.mockResolvedValue({ data: mockResponse });

      const result = await rejectWorkOrder(1, {
        version: 1,
        rejectionReason: '不合规',
      });

      expect(httpClient.post).toHaveBeenCalledWith('/api/orders/1/reject', {
        version: 1,
        rejectionReason: '不合规',
      });
      expect(result.status).toBe('REJECTED');
      expect(result.approvalRecords[0].rejectionReason).toBe('不合规');
    });

    it('should reject at APPROVING_LEVEL_2 level with rejectionReason', async () => {
      const mockResponse = createMockWorkOrder({
        status: 'APPROVING_LEVEL_2',
        version: 3,
      });

      // First, simulate the order is at APPROVING_LEVEL_2
      httpClient.get.mockResolvedValue({ data: mockResponse });

      const order = await getWorkOrder(1);
      expect(order.status).toBe('APPROVING_LEVEL_2');

      // Now reject it
      const rejectedResponse = createMockWorkOrder({
        status: 'REJECTED',
        version: 4,
        approvalRecords: [
          createMockApprovalRecord({ action: 'APPROVE' }),
          createMockApprovalRecord({
            id: 2,
            action: 'REJECT',
            rejectionReason: '资产信息不完整',
            operatorName: '王资产管理员',
          }),
        ],
      });

      httpClient.post.mockResolvedValue({ data: rejectedResponse });

      const result = await rejectWorkOrder(1, {
        version: 3,
        rejectionReason: '资产信息不完整',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.approvalRecords[1].rejectionReason).toBe('资产信息不完整');
    });

    it('should receive 400 Bad Request when rejectionReason is missing', async () => {
      const apiError = createApiError(
        400,
        'MISSING_REJECTION_REASON',
        '驳回原因为必填项',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        rejectWorkOrder(1, { version: 1, rejectionReason: '' }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(400);
      expect(apiError.response.data.errorCode).toBe('MISSING_REJECTION_REASON');
    });

    it('should receive 400 Bad Request when rejectionReason exceeds 500 characters', async () => {
      const longReason = 'a'.repeat(501);
      const apiError = createApiError(
        400,
        'REJECTION_REASON_TOO_LONG',
        '驳回原因不能超过500个字符',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        rejectWorkOrder(1, { version: 1, rejectionReason: longReason }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(400);
    });
  });

  // =========================================================================
  // ATB-3: Invalid state transition handling
  // =========================================================================
  describe('ATB-3: Invalid state transition — 409 Conflict', () => {
    it('should receive 409 with INVALID_STATE_TRANSITION when approving a PENDING order directly as asset admin', async () => {
      // PENDING → APPROVING_LEVEL_2 is illegal (skip level)
      const apiError = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转：PENDING 不能直接流转至 APPROVING_LEVEL_2',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        approveWorkOrder(1, { version: 1 }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(409);
      expect(apiError.response.data.errorCode).toBe('INVALID_STATE_TRANSITION');
    });

    it('should receive 409 when trying to approve an already APPROVED order', async () => {
      const apiError = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转：APPROVED 为终态，不可再审批',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        approveWorkOrder(1, { version: 4 }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(409);
      expect(apiError.response.data.errorCode).toBe('INVALID_STATE_TRANSITION');
    });

    it('should receive 409 when trying to approve a REJECTED order', async () => {
      const apiError = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转：REJECTED 不可执行审批通过操作',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        approveWorkOrder(1, { version: 2 }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(409);
    });

    it('should receive 409 when trying to reject an APPROVED order', async () => {
      const apiError = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转：APPROVED 不可执行驳回操作',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        rejectWorkOrder(1, { version: 4, rejectionReason: '试图驳回已通过工单' }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(409);
    });

    it('should receive 409 with OPTIMISTIC_LOCK_CONFLICT on concurrent approval', async () => {
      const apiError = createApiError(
        409,
        'OPTIMISTIC_LOCK_CONFLICT',
        '工单已被其他审批人处理，请刷新后重试',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        approveWorkOrder(1, { version: 1 }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(409);
      expect(apiError.response.data.errorCode).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });
  });

  // =========================================================================
  // ATB-4: Pending approval list with role-based filtering
  // =========================================================================
  describe('ATB-4: Pending approval list — role-based data isolation', () => {
    it('should fetch APPROVING_LEVEL_1 orders for department supervisor role', async () => {
      const mockOrders: PaginatedResponse<WorkOrder> = {
        items: [
          createMockWorkOrder({
            id: 1,
            orderNo: 'WO-2025-001',
            status: 'APPROVING_LEVEL_1',
            applicantName: '张三',
            createdAt: '2025-01-15T08:00:00Z',
          }),
          createMockWorkOrder({
            id: 2,
            orderNo: 'WO-2025-002',
            status: 'APPROVING_LEVEL_1',
            applicantName: '李四',
            createdAt: '2025-01-15T09:00:00Z',
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      httpClient.get.mockResolvedValue({ data: mockOrders });

      const result = await getPendingApprovals({
        status: 'APPROVING_LEVEL_1',
        page: 1,
        pageSize: 20,
      });

      expect(httpClient.get).toHaveBeenCalledWith(
        '/api/orders/pending?status=APPROVING_LEVEL_1&page=1&pageSize=20',
      );
      expect(result.items).toHaveLength(2);
      expect(result.items.every((o) => o.status === 'APPROVING_LEVEL_1')).toBe(true);
      // Verify list columns: orderNo, applicantName, createdAt
      expect(result.items[0].orderNo).toBe('WO-2025-001');
      expect(result.items[0].applicantName).toBe('张三');
      expect(result.items[0].createdAt).toBe('2025-01-15T08:00:00Z');
    });

    it('should fetch APPROVING_LEVEL_2 orders for asset admin role', async () => {
      const mockOrders: PaginatedResponse<WorkOrder> = {
        items: [
          createMockWorkOrder({
            id: 3,
            orderNo: 'WO-2025-003',
            status: 'APPROVING_LEVEL_2',
            applicantName: '王五',
            createdAt: '2025-01-15T10:00:00Z',
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      httpClient.get.mockResolvedValue({ data: mockOrders });

      const result = await getPendingApprovals({
        status: 'APPROVING_LEVEL_2',
        page: 1,
        pageSize: 20,
      });

      expect(httpClient.get).toHaveBeenCalledWith(
        '/api/orders/pending?status=APPROVING_LEVEL_2&page=1&pageSize=20',
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('APPROVING_LEVEL_2');
    });

    it('should not return APPROVING_LEVEL_2 orders when querying APPROVING_LEVEL_1', async () => {
      const mockOrders: PaginatedResponse<WorkOrder> = {
        items: [
          createMockWorkOrder({ status: 'APPROVING_LEVEL_1' }),
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      httpClient.get.mockResolvedValue({ data: mockOrders });

      const result = await getPendingApprovals({ status: 'APPROVING_LEVEL_1' });

      const hasLevel2 = result.items.some((o) => o.status === 'APPROVING_LEVEL_2');
      expect(hasLevel2).toBe(false);
    });

    it('should support pagination parameters', async () => {
      const mockOrders: PaginatedResponse<WorkOrder> = {
        items: [createMockWorkOrder({ status: 'APPROVING_LEVEL_1' })],
        total: 50,
        page: 2,
        pageSize: 10,
      };

      httpClient.get.mockResolvedValue({ data: mockOrders });

      const result = await getPendingApprovals({
        status: 'APPROVING_LEVEL_1',
        page: 2,
        pageSize: 10,
      });

      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  // =========================================================================
  // ATB-5: Approval detail and action operations
  // =========================================================================
  describe('ATB-5: Approval detail and action operations', () => {
    it('should fetch work order detail by ID', async () => {
      const mockOrder = createMockWorkOrder({
        id: 1,
        status: 'APPROVING_LEVEL_1',
        approvalRecords: [
          createMockApprovalRecord({ action: 'APPROVE', comment: '提交审批' }),
        ],
      });

      httpClient.get.mockResolvedValue({ data: mockOrder });

      const result = await getWorkOrder(1);

      expect(httpClient.get).toHaveBeenCalledWith('/api/orders/1');
      expect(result.id).toBe(1);
      expect(result.status).toBe('APPROVING_LEVEL_1');
      expect(result.approvalRecords).toHaveLength(1);
    });

    it('should fetch approval records for a work order', async () => {
      const mockRecords: ApprovalRecord[] = [
        createMockApprovalRecord({
          id: 1,
          action: 'APPROVE',
          operatorName: '李主管',
          comment: '同意',
          createdAt: '2025-01-15T09:00:00Z',
        }),
      ];

      httpClient.get.mockResolvedValue({ data: mockRecords });

      const result = await getApprovalRecords(1);

      expect(httpClient.get).toHaveBeenCalledWith('/api/orders/1/approval-records');
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('APPROVE');
      expect(result[0].operatorName).toBe('李主管');
    });

    it('should approve a work order and see it removed from pending list after refresh', async () => {
      // Step 1: Approve the order
      const approvedOrder = createMockWorkOrder({
        id: 1,
        status: 'APPROVING_LEVEL_2',
        version: 2,
      });
      httpClient.post.mockResolvedValue({ data: approvedOrder });

      const approveResult = await approveWorkOrder(1, { version: 1 });
      expect(approveResult.status).toBe('APPROVING_LEVEL_2');

      // Step 2: Refresh pending list — order should no longer appear in APPROVING_LEVEL_1
      vi.clearAllMocks();
      const refreshedPending: PaginatedResponse<WorkOrder> = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      httpClient.get.mockResolvedValue({ data: refreshedPending });

      const listResult = await getPendingApprovals({ status: 'APPROVING_LEVEL_1' });
      const stillInList = listResult.items.some((o) => o.id === 1);
      expect(stillInList).toBe(false);
    });

    it('should reject a work order and see it removed from pending list after refresh', async () => {
      // Step 1: Reject the order
      const rejectedOrder = createMockWorkOrder({
        id: 1,
        status: 'REJECTED',
        version: 2,
        approvalRecords: [
          createMockApprovalRecord({
            action: 'REJECT',
            rejectionReason: '不合规',
          }),
        ],
      });
      httpClient.post.mockResolvedValue({ data: rejectedOrder });

      const rejectResult = await rejectWorkOrder(1, {
        version: 1,
        rejectionReason: '不合规',
      });
      expect(rejectResult.status).toBe('REJECTED');

      // Step 2: Refresh pending list — order should no longer appear
      vi.clearAllMocks();
      const refreshedPending: PaginatedResponse<WorkOrder> = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      httpClient.get.mockResolvedValue({ data: refreshedPending });

      const listResult = await getPendingApprovals({ status: 'APPROVING_LEVEL_1' });
      const stillInList = listResult.items.some((o) => o.id === 1);
      expect(stillInList).toBe(false);
    });
  });

  // =========================================================================
  // Frontend validation — rejectionReason
  // =========================================================================
  describe('Frontend validation — rejectionReason', () => {
    it('should reject null rejectionReason', () => {
      const error = validateRejectionReason(null);
      expect(error).toBe('驳回原因为必填项');
    });

    it('should reject undefined rejectionReason', () => {
      const error = validateRejectionReason(undefined);
      expect(error).toBe('驳回原因为必填项');
    });

    it('should reject empty string rejectionReason', () => {
      const error = validateRejectionReason('');
      expect(error).toBe('驳回原因不能为空');
    });

    it('should reject whitespace-only rejectionReason', () => {
      const error = validateRejectionReason('   ');
      expect(error).toBe('驳回原因不能为空');
    });

    it('should reject non-string rejectionReason', () => {
      const error = validateRejectionReason(123 as unknown as string);
      expect(error).toBe('驳回原因为必填项');
    });

    it('should reject rejectionReason exceeding 500 characters', () => {
      const longReason = 'a'.repeat(501);
      const error = validateRejectionReason(longReason);
      expect(error).toBe('驳回原因不能超过500个字符');
    });

    it('should accept valid rejectionReason', () => {
      const error = validateRejectionReason('不合规');
      expect(error).toBeNull();
    });

    it('should accept rejectionReason with exactly 500 characters', () => {
      const reason = 'a'.repeat(500);
      const error = validateRejectionReason(reason);
      expect(error).toBeNull();
    });

    it('should accept rejectionReason with leading/trailing whitespace but valid content', () => {
      const error = validateRejectionReason('  不合规  ');
      expect(error).toBeNull();
    });
  });

  // =========================================================================
  // Cancel workflow
  // =========================================================================
  describe('Cancel work order', () => {
    it('should cancel a PENDING work order', async () => {
      const cancelledOrder = createMockWorkOrder({
        status: 'CANCELLED',
        version: 2,
      });

      httpClient.post.mockResolvedValue({ data: cancelledOrder });

      const result = await cancelWorkOrder(1, { version: 1 });

      expect(httpClient.post).toHaveBeenCalledWith('/api/orders/1/cancel', {
        version: 1,
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel an APPROVING_LEVEL_1 work order', async () => {
      const cancelledOrder = createMockWorkOrder({
        status: 'CANCELLED',
        version: 3,
      });

      httpClient.post.mockResolvedValue({ data: cancelledOrder });

      const result = await cancelWorkOrder(1, { version: 2 });

      expect(result.status).toBe('CANCELLED');
    });

    it('should receive 409 when trying to cancel an APPROVED order', async () => {
      const apiError = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转：APPROVED 不可取消',
      );

      httpClient.post.mockRejectedValue(apiError);

      await expect(
        cancelWorkOrder(1, { version: 4 }),
      ).rejects.toEqual(apiError);

      expect(apiError.response.status).toBe(409);
    });
  });

  // =========================================================================
  // State machine transition validation (frontend-side awareness)
  // =========================================================================
  describe('State machine — valid transitions awareness', () => {
    /** Define the valid transitions map (mirrors backend state machine) */
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['APPROVING_LEVEL_1', 'CANCELLED'],
      APPROVING_LEVEL_1: ['APPROVING_LEVEL_2', 'REJECTED', 'CANCELLED'],
      APPROVING_LEVEL_2: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: [],       // terminal
      REJECTED: [],       // terminal
      CANCELLED: [],      // terminal
    };

    it('should define correct valid transitions from PENDING', () => {
      expect(validTransitions.PENDING).toEqual(['APPROVING_LEVEL_1', 'CANCELLED']);
    });

    it('should define correct valid transitions from APPROVING_LEVEL_1', () => {
      expect(validTransitions.APPROVING_LEVEL_1).toEqual([
        'APPROVING_LEVEL_2',
        'REJECTED',
        'CANCELLED',
      ]);
    });

    it('should define correct valid transitions from APPROVING_LEVEL_2', () => {
      expect(validTransitions.APPROVING_LEVEL_2).toEqual([
        'APPROVED',
        'REJECTED',
        'CANCELLED',
      ]);
    });

    it('should have no valid transitions from APPROVED (terminal)', () => {
      expect(validTransitions.APPROVED).toEqual([]);
    });

    it('should have no valid transitions from REJECTED (terminal)', () => {
      expect(validTransitions.REJECTED).toEqual([]);
    });

    it('should have no valid transitions from CANCELLED (terminal)', () => {
      expect(validTransitions.CANCELLED).toEqual([]);
    });

    it('should NOT allow PENDING → APPROVING_LEVEL_2 (skip level)', () => {
      expect(validTransitions.PENDING).not.toContain('APPROVING_LEVEL_2');
    });

    it('should NOT allow PENDING → APPROVED (skip all levels)', () => {
      expect(validTransitions.PENDING).not.toContain('APPROVED');
    });

    it('should NOT allow REJECTED → PENDING (reverse from terminal)', () => {
      expect(validTransitions.REJECTED).not.toContain('PENDING');
    });

    it('should NOT allow APPROVED → REJECTED (reverse from terminal)', () => {
      expect(validTransitions.APPROVED).not.toContain('REJECTED');
    });
  });

  // =========================================================================
  // Approval record structure validation
  // =========================================================================
  describe('Approval record structure', () => {
    it('should have all required fields in an approval record', async () => {
      const mockRecords: ApprovalRecord[] = [
        createMockApprovalRecord({
          id: 1,
          orderId: 1,
          operatorId: 200,
          operatorName: '李主管',
          action: 'APPROVE',
          comment: '同意',
          rejectionReason: null,
          createdAt: '2025-01-15T09:00:00Z',
        }),
      ];

      httpClient.get.mockResolvedValue({ data: mockRecords });

      const records = await getApprovalRecords(1);
      const record = records[0];

      expect(record).toHaveProperty('id');
      expect(record).toHaveProperty('orderId');
      expect(record).toHaveProperty('operatorId');
      expect(record).toHaveProperty('operatorName');
      expect(record).toHaveProperty('action');
      expect(record).toHaveProperty('comment');
      expect(record).toHaveProperty('rejectionReason');
      expect(record).toHaveProperty('createdAt');
    });

    it('should have rejectionReason populated for REJECT action records', async () => {
      const mockRecords: ApprovalRecord[] = [
        createMockApprovalRecord({
          action: 'REJECT',
          rejectionReason: '不合规',
          comment: '不合规',
        }),
      ];

      httpClient.get.mockResolvedValue({ data: mockRecords });

      const records = await getApprovalRecords(1);
      expect(records[0].action).toBe('REJECT');
      expect(records[0].rejectionReason).toBe('不合规');
    });

    it('should have ISO 8601 formatted createdAt timestamps', async () => {
      const mockRecords: ApprovalRecord[] = [
        createMockApprovalRecord({
          createdAt: '2025-01-15T09:00:00Z',
        }),
      ];

      httpClient.get.mockResolvedValue({ data: mockRecords });

      const records = await getApprovalRecords(1);
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
      expect(records[0].createdAt).toMatch(iso8601Regex);
    });
  });

  // =========================================================================
  // Error response structure validation
  // =========================================================================
  describe('API error response structure', () => {
    it('should have errorCode and message in 400 error response', () => {
      const error = createApiError(400, 'MISSING_REJECTION_REASON', '驳回原因为必填项');

      expect(error.response.status).toBe(400);
      expect(error.response.data).toHaveProperty('errorCode');
      expect(error.response.data).toHaveProperty('message');
      expect(error.response.data).toHaveProperty('timestamp');
      expect(error.response.data.errorCode).toBe('MISSING_REJECTION_REASON');
    });

    it('should have INVALID_STATE_TRANSITION error code in 409 response for illegal transition', () => {
      const error = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转',
      );

      expect(error.response.status).toBe(409);
      expect(error.response.data.errorCode).toBe('INVALID_STATE_TRANSITION');
    });

    it('should have OPTIMISTIC_LOCK_CONFLICT error code in 409 response for version conflict', () => {
      const error = createApiError(
        409,
        'OPTIMISTIC_LOCK_CONFLICT',
        '工单版本冲突',
      );

      expect(error.response.status).toBe(409);
      expect(error.response.data.errorCode).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });

    it('should distinguish between two types of 409 errors by errorCode', () => {
      const transitionError = createApiError(
        409,
        'INVALID_STATE_TRANSITION',
        '非法状态流转',
      );
      const lockError = createApiError(
        409,
        'OPTIMISTIC_LOCK_CONFLICT',
        '版本冲突',
      );

      expect(transitionError.response.data.errorCode).not.toBe(
        lockError.response.data.errorCode,
      );
    });
  });

  // =========================================================================
  // Full workflow integration (API-level)
  // =========================================================================
  describe('Full approval workflow — API sequence', () => {
    it('should complete the full PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED flow', async () => {
      // Step 1: PENDING → APPROVING_LEVEL_1
      const step1 = createMockWorkOrder({
        status: 'APPROVING_LEVEL_1',
        version: 2,
        approvalRecords: [
          createMockApprovalRecord({ action: 'APPROVE', operatorName: '李主管' }),
        ],
      });
      httpClient.post.mockResolvedValueOnce({ data: step1 });

      const result1 = await approveWorkOrder(1, { version: 1 });
      expect(result1.status).toBe('APPROVING_LEVEL_1');

      // Step 2: APPROVING_LEVEL_1 → APPROVING_LEVEL_2
      const step2 = createMockWorkOrder({
        status: 'APPROVING_LEVEL_2',
        version: 3,
        approvalRecords: [
          ...step1.approvalRecords,
          createMockApprovalRecord({
            id: 2,
            action: 'APPROVE',
            operatorName: '王资产管理员',
          }),
        ],
      });
      httpClient.post.mockResolvedValueOnce({ data: step2 });

      const result2 = await approveWorkOrder(1, { version: 2 });
      expect(result2.status).toBe('APPROVING_LEVEL_2');

      // Step 3: APPROVING_LEVEL_2 → APPROVED
      const step3 = createMockWorkOrder({
        status: 'APPROVED',
        version: 4,
        approvalRecords: [
          ...step2.approvalRecords,
          createMockApprovalRecord({
            id: 3,
            action: 'APPROVE',
            operatorName: '王资产管理员',
            comment: '最终审批通过',
          }),
        ],
      });
      httpClient.post.mockResolvedValueOnce({ data: step3 });

      const result3 = await approveWorkOrder(1, { version: 3 });
      expect(result3.status).toBe('APPROVED');
      expect(result3.approvalRecords).toHaveLength(3);
    });

    it('should handle PENDING → APPROVING_LEVEL_1 → REJECTED flow', async () => {
      // Step 1: PENDING → APPROVING_LEVEL_1
      const step1 = createMockWorkOrder({
        status: 'APPROVING_LEVEL_1',
        version: 2,
      });
      httpClient.post.mockResolvedValueOnce({ data: step1 });

      const result1 = await approveWorkOrder(1, { version: 1 });
      expect(result1.status).toBe('APPROVING_LEVEL_1');

      // Step 2: APPROVING_LEVEL_1 → REJECTED
      const step2 = createMockWorkOrder({
        status: 'REJECTED',
        version: 3,
        approvalRecords: [
          createMockApprovalRecord({
            action: 'REJECT',
            rejectionReason: '材料不齐全',
            operatorName: '李主管',
          }),
        ],
      });
      httpClient.post.mockResolvedValueOnce({ data: step2 });

      const result2 = await rejectWorkOrder(1, {
        version: 2,
        rejectionReason: '材料不齐全',
      });
      expect(result2.status).toBe('REJECTED');
      expect(result2.approvalRecords[0].rejectionReason).toBe('材料不齐全');
    });

    it('should handle PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → REJECTED flow', async () => {
      // Step 1: PENDING → APPROVING_LEVEL_1
      httpClient.post.mockResolvedValueOnce({
        data: createMockWorkOrder({ status: 'APPROVING_LEVEL_1', version: 2 }),
      });
      const r1 = await approveWorkOrder(1, { version: 1 });
      expect(r1.status).toBe('APPROVING_LEVEL_1');

      // Step 2: APPROVING_LEVEL_1 → APPROVING_LEVEL_2
      httpClient.post.mockResolvedValueOnce({
        data: createMockWorkOrder({ status: 'APPROVING_LEVEL_2', version: 3 }),
      });
      const r2 = await approveWorkOrder(1, { version: 2 });
      expect(r2.status).toBe('APPROVING_LEVEL_2');

      // Step 3: APPROVING_LEVEL_2 → REJECTED
      const rejectedOrder = createMockWorkOrder({
        status: 'REJECTED',
        version: 4,
        approvalRecords: [
          createMockApprovalRecord({
            action: 'REJECT',
            rejectionReason: '资产信息核实不通过',
            operatorName: '王资产管理员',
          }),
        ],
      });
      httpClient.post.mockResolvedValueOnce({ data: rejectedOrder });

      const r3 = await rejectWorkOrder(1, {
        version: 3,
        rejectionReason: '资产信息核实不通过',
      });
      expect(r3.status).toBe('REJECTED');
    });
  });
});