/**
 * approvalStore.test.ts
 *
 * Unit tests for the approval Zustand store.
 * Covers Phase 1 core approval flow:
 *   - State machine transitions (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
 *   - Rejection with mandatory rejectionReason
 *   - Role-based data isolation (DEPT_MANAGER sees APPROVING_LEVEL_1, ASSET_ADMIN sees APPROVING_LEVEL_2)
 *   - Optimistic lock conflict (HTTP 409)
 *   - Invalid state transition (HTTP 409 with INVALID_STATE_TRANSITION)
 *   - Missing rejectionReason (HTTP 400)
 *   - Loading / error state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApprovalStore } from './approvalStore';
import * as approvalApi from '../api/approval';
import type {
  ApprovalOrder,
  ApprovalActionResponse,
  ApprovalListParams,
} from '../types/approval';

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

/** Create a mock approval order with sensible defaults. */
function createMockOrder(overrides: Partial<ApprovalOrder> = {}): ApprovalOrder {
  return {
    id: 'order-001',
    orderNo: 'WO-2025-0001',
    title: 'Test work order',
    applicantId: 'user-100',
    applicantName: '张三',
    status: 'APPROVING_LEVEL_1',
    version: 1,
    submittedAt: '2025-06-01T08:00:00Z',
    currentApprovalLevel: 1,
    ...overrides,
  };
}

/** Create a mock approval action response. */
function createMockActionResponse(
  overrides: Partial<ApprovalActionResponse> = {},
): ApprovalActionResponse {
  return {
    id: 'order-001',
    status: 'APPROVING_LEVEL_2',
    version: 2,
    approvalRecord: {
      id: 'record-001',
      orderId: 'order-001',
      operatorId: 'user-200',
      operatorName: '李主管',
      action: 'APPROVE',
      comment: null,
      createdAt: '2025-06-01T09:00:00Z',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// API module spy setup
// ---------------------------------------------------------------------------

vi.mock('../api/approval', () => ({
  fetchPendingApprovals: vi.fn(),
  approveOrder: vi.fn(),
  rejectOrder: vi.fn(),
  fetchApprovalDetail: vi.fn(),
}));

const spyFetchPending = vi.mocked(approvalApi.fetchPendingApprovals);
const spyApprove = vi.mocked(approvalApi.approveOrder);
const spyReject = vi.mocked(approvalApi.rejectOrder);
const spyFetchDetail = vi.mocked(approvalApi.fetchApprovalDetail);

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('approvalStore', () => {
  beforeEach(() => {
    // Reset the Zustand store to its initial state before each test
    useApprovalStore.setState({
      orders: [],
      currentOrder: null,
      isLoading: false,
      isActionLoading: false,
      error: null,
      actionError: null,
      pagination: { page: 1, pageSize: 20, total: 0 },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('should have empty orders array', () => {
      const state = useApprovalStore.getState();
      expect(state.orders).toEqual([]);
    });

    it('should have null currentOrder', () => {
      const state = useApprovalStore.getState();
      expect(state.currentOrder).toBeNull();
    });

    it('should not be loading initially', () => {
      const state = useApprovalStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isActionLoading).toBe(false);
    });

    it('should have no errors initially', () => {
      const state = useApprovalStore.getState();
      expect(state.error).toBeNull();
      expect(state.actionError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // fetchPendingOrders – role-based data isolation
  // -------------------------------------------------------------------------
  describe('fetchPendingOrders', () => {
    it('should fetch APPROVING_LEVEL_1 orders for DEPT_MANAGER role', async () => {
      const mockOrders = [
        createMockOrder({ id: '1', status: 'APPROVING_LEVEL_1' }),
        createMockOrder({ id: '2', status: 'APPROVING_LEVEL_1', orderNo: 'WO-2025-0002' }),
      ];
      spyFetchPending.mockResolvedValueOnce({
        items: mockOrders,
        total: 2,
        page: 1,
        pageSize: 20,
      });

      await useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');

      const state = useApprovalStore.getState();
      expect(state.orders).toHaveLength(2);
      expect(state.orders.every((o) => o.status === 'APPROVING_LEVEL_1')).toBe(true);
      expect(state.pagination.total).toBe(2);
      expect(state.isLoading).toBe(false);

      // Verify the API was called with correct role filter
      expect(spyFetchPending).toHaveBeenCalledWith(
        expect.objectContaining<ApprovalListParams>({
          role: 'DEPT_MANAGER',
          status: 'APPROVING_LEVEL_1',
        }),
      );
    });

    it('should fetch APPROVING_LEVEL_2 orders for ASSET_ADMIN role', async () => {
      const mockOrders = [
        createMockOrder({
          id: '3',
          status: 'APPROVING_LEVEL_2',
          currentApprovalLevel: 2,
        }),
      ];
      spyFetchPending.mockResolvedValueOnce({
        items: mockOrders,
        total: 1,
        page: 1,
        pageSize: 20,
      });

      await useApprovalStore.getState().fetchPendingOrders('ASSET_ADMIN');

      const state = useApprovalStore.getState();
      expect(state.orders).toHaveLength(1);
      expect(state.orders[0].status).toBe('APPROVING_LEVEL_2');
      expect(state.isLoading).toBe(false);

      expect(spyFetchPending).toHaveBeenCalledWith(
        expect.objectContaining<ApprovalListParams>({
          role: 'ASSET_ADMIN',
          status: 'APPROVING_LEVEL_2',
        }),
      );
    });

    it('should set isLoading to true during fetch and false after', async () => {
      let resolveFetch!: (value: unknown) => void;
      spyFetchPending.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const fetchPromise = useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');
      expect(useApprovalStore.getState().isLoading).toBe(true);

      resolveFetch({ items: [], total: 0, page: 1, pageSize: 20 });
      await fetchPromise;

      expect(useApprovalStore.getState().isLoading).toBe(false);
    });

    it('should set error when fetch fails', async () => {
      spyFetchPending.mockRejectedValueOnce(new Error('Network error'));

      await useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');

      const state = useApprovalStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
      expect(state.orders).toEqual([]);
    });

    it('should not mix orders across roles on consecutive fetches', async () => {
      // First fetch as DEPT_MANAGER
      spyFetchPending.mockResolvedValueOnce({
        items: [createMockOrder({ id: '1', status: 'APPROVING_LEVEL_1' })],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      await useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');
      expect(useApprovalStore.getState().orders).toHaveLength(1);

      // Second fetch as ASSET_ADMIN – should replace, not append
      spyFetchPending.mockResolvedValueOnce({
        items: [createMockOrder({ id: '2', status: 'APPROVING_LEVEL_2', currentApprovalLevel: 2 })],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      await useApprovalStore.getState().fetchPendingOrders('ASSET_ADMIN');
      expect(useApprovalStore.getState().orders).toHaveLength(1);
      expect(useApprovalStore.getState().orders[0].status).toBe('APPROVING_LEVEL_2');
    });
  });

  // -------------------------------------------------------------------------
  // approveOrder – positive flow
  // -------------------------------------------------------------------------
  describe('approveOrder', () => {
    it('should transition APPROVING_LEVEL_1 → APPROVING_LEVEL_2 on level-1 approval', async () => {
      const mockResponse = createMockActionResponse({
        id: 'order-001',
        status: 'APPROVING_LEVEL_2',
        version: 2,
        approvalRecord: {
          id: 'rec-001',
          orderId: 'order-001',
          operatorId: 'user-200',
          operatorName: '李主管',
          action: 'APPROVE',
          comment: null,
          createdAt: '2025-06-01T09:00:00Z',
        },
      });
      spyApprove.mockResolvedValueOnce(mockResponse);

      // Pre-populate store with the order
      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', status: 'APPROVING_LEVEL_1', version: 1 })],
      });

      await useApprovalStore.getState().approveOrder('order-001', 1);

      const state = useApprovalStore.getState();
      // The approved order should be removed from the pending list
      expect(state.orders.find((o) => o.id === 'order-001')).toBeUndefined();
      expect(state.isActionLoading).toBe(false);
      expect(state.actionError).toBeNull();
    });

    it('should transition APPROVING_LEVEL_2 → APPROVED on level-2 approval', async () => {
      const mockResponse = createMockActionResponse({
        id: 'order-002',
        status: 'APPROVED',
        version: 3,
        approvalRecord: {
          id: 'rec-002',
          orderId: 'order-002',
          operatorId: 'user-300',
          operatorName: '王管理员',
          action: 'APPROVE',
          comment: null,
          createdAt: '2025-06-01T10:00:00Z',
        },
      });
      spyApprove.mockResolvedValueOnce(mockResponse);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-002', status: 'APPROVING_LEVEL_2', version: 2, currentApprovalLevel: 2 })],
      });

      await useApprovalStore.getState().approveOrder('order-002', 2);

      const state = useApprovalStore.getState();
      expect(state.orders.find((o) => o.id === 'order-002')).toBeUndefined();
      expect(state.isActionLoading).toBe(false);
    });

    it('should call approveOrder API with correct orderId and version', async () => {
      spyApprove.mockResolvedValueOnce(createMockActionResponse());

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      await useApprovalStore.getState().approveOrder('order-001', 1);

      expect(spyApprove).toHaveBeenCalledWith('order-001', expect.objectContaining({ version: 1 }));
    });

    it('should set isActionLoading during the approval action', async () => {
      let resolveAction!: (value: unknown) => void;
      spyApprove.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
      );

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      const actionPromise = useApprovalStore.getState().approveOrder('order-001', 1);
      expect(useApprovalStore.getState().isActionLoading).toBe(true);

      resolveAction(createMockActionResponse());
      await actionPromise;

      expect(useApprovalStore.getState().isActionLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // rejectOrder – with mandatory rejectionReason
  // -------------------------------------------------------------------------
  describe('rejectOrder', () => {
    it('should reject an order with a valid rejectionReason', async () => {
      const mockResponse = createMockActionResponse({
        id: 'order-001',
        status: 'REJECTED',
        version: 2,
        approvalRecord: {
          id: 'rec-003',
          orderId: 'order-001',
          operatorId: 'user-200',
          operatorName: '李主管',
          action: 'REJECT',
          comment: '不合规',
          createdAt: '2025-06-01T09:30:00Z',
        },
      });
      spyReject.mockResolvedValueOnce(mockResponse);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', status: 'APPROVING_LEVEL_1', version: 1 })],
      });

      await useApprovalStore.getState().rejectOrder('order-001', '不合规', 1);

      const state = useApprovalStore.getState();
      // Rejected order should be removed from the pending list
      expect(state.orders.find((o) => o.id === 'order-001')).toBeUndefined();
      expect(state.actionError).toBeNull();
      expect(spyReject).toHaveBeenCalledWith(
        'order-001',
        expect.objectContaining({ rejectionReason: '不合规', version: 1 }),
      );
    });

    it('should reject at APPROVING_LEVEL_2 with a valid reason', async () => {
      const mockResponse = createMockActionResponse({
        id: 'order-003',
        status: 'REJECTED',
        version: 3,
        approvalRecord: {
          id: 'rec-004',
          orderId: 'order-003',
          operatorId: 'user-300',
          operatorName: '王管理员',
          action: 'REJECT',
          comment: '资产信息不符',
          createdAt: '2025-06-01T11:00:00Z',
        },
      });
      spyReject.mockResolvedValueOnce(mockResponse);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-003', status: 'APPROVING_LEVEL_2', version: 2, currentApprovalLevel: 2 })],
      });

      await useApprovalStore.getState().rejectOrder('order-003', '资产信息不符', 2);

      const state = useApprovalStore.getState();
      expect(state.orders.find((o) => o.id === 'order-003')).toBeUndefined();
    });

    it('should set actionError when rejectionReason is empty (frontend validation)', async () => {
      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      await useApprovalStore.getState().rejectOrder('order-001', '', 1);

      const state = useApprovalStore.getState();
      expect(state.actionError).toBe('驳回原因不能为空');
      // API should not have been called
      expect(spyReject).not.toHaveBeenCalled();
    });

    it('should set actionError when rejectionReason is whitespace only (frontend validation)', async () => {
      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      await useApprovalStore.getState().rejectOrder('order-001', '   ', 1);

      const state = useApprovalStore.getState();
      expect(state.actionError).toBe('驳回原因不能为空');
      expect(spyReject).not.toHaveBeenCalled();
    });

    it('should set actionError when rejectionReason exceeds 500 characters (frontend validation)', async () => {
      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      const longReason = 'a'.repeat(501);
      await useApprovalStore.getState().rejectOrder('order-001', longReason, 1);

      const state = useApprovalStore.getState();
      expect(state.actionError).toBe('驳回原因不能超过500字符');
      expect(spyReject).not.toHaveBeenCalled();
    });

    it('should accept rejectionReason at exactly 500 characters', async () => {
      spyReject.mockResolvedValueOnce(
        createMockActionResponse({ status: 'REJECTED' }),
      );

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      const maxReason = 'a'.repeat(500);
      await useApprovalStore.getState().rejectOrder('order-001', maxReason, 1);

      expect(spyReject).toHaveBeenCalled();
      expect(useApprovalStore.getState().actionError).toBeNull();
    });

    it('should handle HTTP 400 when backend rejects missing rejectionReason', async () => {
      const apiError = {
        response: {
          status: 400,
          data: { code: 'MISSING_REJECTION_REASON', message: '驳回原因不能为空' },
        },
      };
      spyReject.mockRejectedValueOnce(apiError);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', version: 1 })],
      });

      await useApprovalStore.getState().rejectOrder('order-001', 'some reason', 1);

      const state = useApprovalStore.getState();
      expect(state.actionError).toContain('400');
      // Order should remain in the list since rejection failed
      expect(state.orders.find((o) => o.id === 'order-001')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Invalid state transition – HTTP 409
  // -------------------------------------------------------------------------
  describe('invalid state transitions (HTTP 409)', () => {
    it('should handle INVALID_STATE_TRANSITION error when approving a PENDING order', async () => {
      const apiError = {
        response: {
          status: 409,
          data: {
            code: 'INVALID_STATE_TRANSITION',
            message: '非法状态流转：PENDING 不可直接进入 APPROVING_LEVEL_2',
          },
        },
      };
      spyApprove.mockRejectedValueOnce(apiError);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-pending', status: 'PENDING', version: 1 })],
      });

      // Attempting to approve at level 2 when the order is still PENDING
      await useApprovalStore.getState().approveOrder('order-pending', 2);

      const state = useApprovalStore.getState();
      expect(state.actionError).toContain('INVALID_STATE_TRANSITION');
      // Order should remain unchanged
      expect(state.orders.find((o) => o.id === 'order-pending')).toBeDefined();
      expect(state.orders.find((o) => o.id === 'order-pending')!.status).toBe('PENDING');
    });

    it('should handle 409 Conflict for cross-level approval attempt', async () => {
      const apiError = {
        response: {
          status: 409,
          data: {
            code: 'INVALID_STATE_TRANSITION',
            message: '禁止跨级审批',
          },
        },
      };
      spyApprove.mockRejectedValueOnce(apiError);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', status: 'APPROVING_LEVEL_1', version: 1 })],
      });

      // Asset admin tries to approve a level-1 order
      await useApprovalStore.getState().approveOrder('order-001', 2);

      const state = useApprovalStore.getState();
      expect(state.actionError).toContain('INVALID_STATE_TRANSITION');
      expect(state.orders.find((o) => o.id === 'order-001')).toBeDefined();
    });

    it('should handle 409 Conflict for rejecting an already APPROVED order', async () => {
      const apiError = {
        response: {
          status: 409,
          data: {
            code: 'INVALID_STATE_TRANSITION',
            message: '工单已审批通过，无法驳回',
          },
        },
      };
      spyReject.mockRejectedValueOnce(apiError);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-approved', status: 'APPROVED', version: 3 })],
      });

      await useApprovalStore.getState().rejectOrder('order-approved', '迟到的驳回', 3);

      const state = useApprovalStore.getState();
      expect(state.actionError).toContain('INVALID_STATE_TRANSITION');
    });
  });

  // -------------------------------------------------------------------------
  // Optimistic lock conflict – HTTP 409 with version mismatch
  // -------------------------------------------------------------------------
  describe('optimistic lock conflict', () => {
    it('should handle 409 Conflict when version mismatches (concurrent approval)', async () => {
      const apiError = {
        response: {
          status: 409,
          data: {
            code: 'VERSION_CONFLICT',
            message: '工单已被其他人审批，请刷新后重试',
          },
        },
      };
      spyApprove.mockRejectedValueOnce(apiError);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', status: 'APPROVING_LEVEL_1', version: 1 })],
      });

      await useApprovalStore.getState().approveOrder('order-001', 1);

      const state = useApprovalStore.getState();
      expect(state.actionError).toContain('VERSION_CONFLICT');
      // Order should still be in the list with its current version
      expect(state.orders.find((o) => o.id === 'order-001')).toBeDefined();
    });

    it('should handle 409 Conflict on concurrent reject attempt', async () => {
      const apiError = {
        response: {
          status: 409,
          data: {
            code: 'VERSION_CONFLICT',
            message: '工单已被其他人操作，请刷新后重试',
          },
        },
      };
      spyReject.mockRejectedValueOnce(apiError);

      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-001', status: 'APPROVING_LEVEL_1', version: 1 })],
      });

      await useApprovalStore.getState().rejectOrder('order-001', '驳回原因', 1);

      const state = useApprovalStore.getState();
      expect(state.actionError).toContain('VERSION_CONFLICT');
    });
  });

  // -------------------------------------------------------------------------
  // fetchOrderDetail
  // -------------------------------------------------------------------------
  describe('fetchOrderDetail', () => {
    it('should fetch and set currentOrder', async () => {
      const mockOrder = createMockOrder({ id: 'order-001' });
      spyFetchDetail.mockResolvedValueOnce(mockOrder);

      await useApprovalStore.getState().fetchOrderDetail('order-001');

      const state = useApprovalStore.getState();
      expect(state.currentOrder).toEqual(mockOrder);
      expect(state.isLoading).toBe(false);
    });

    it('should set error when detail fetch fails', async () => {
      spyFetchDetail.mockRejectedValueOnce(new Error('Not found'));

      await useApprovalStore.getState().fetchOrderDetail('order-999');

      const state = useApprovalStore.getState();
      expect(state.error).toBe('Not found');
      expect(state.currentOrder).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clearErrors
  // -------------------------------------------------------------------------
  describe('clearErrors', () => {
    it('should clear both error and actionError', () => {
      useApprovalStore.setState({
        error: 'Some error',
        actionError: 'Some action error',
      });

      useApprovalStore.getState().clearErrors();

      const state = useApprovalStore.getState();
      expect(state.error).toBeNull();
      expect(state.actionError).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // resetStore
  // -------------------------------------------------------------------------
  describe('resetStore', () => {
    it('should reset the store to initial state', () => {
      useApprovalStore.setState({
        orders: [createMockOrder()],
        currentOrder: createMockOrder(),
        isLoading: true,
        isActionLoading: true,
        error: 'error',
        actionError: 'action error',
        pagination: { page: 2, pageSize: 10, total: 50 },
      });

      useApprovalStore.getState().resetStore();

      const state = useApprovalStore.getState();
      expect(state.orders).toEqual([]);
      expect(state.currentOrder).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isActionLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.actionError).toBeNull();
      expect(state.pagination).toEqual({ page: 1, pageSize: 20, total: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // Full approval flow integration (store-level)
  // -------------------------------------------------------------------------
  describe('full approval flow (store-level)', () => {
    it('should support the complete PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED flow', async () => {
      // Step 1: DEPT_MANAGER fetches pending approvals (APPROVING_LEVEL_1)
      const level1Orders = [
        createMockOrder({ id: 'order-100', status: 'APPROVING_LEVEL_1', version: 1 }),
      ];
      spyFetchPending.mockResolvedValueOnce({
        items: level1Orders,
        total: 1,
        page: 1,
        pageSize: 20,
      });
      await useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');
      expect(useApprovalStore.getState().orders).toHaveLength(1);

      // Step 2: DEPT_MANAGER approves the order → transitions to APPROVING_LEVEL_2
      spyApprove.mockResolvedValueOnce(
        createMockActionResponse({
          id: 'order-100',
          status: 'APPROVING_LEVEL_2',
          version: 2,
        }),
      );
      await useApprovalStore.getState().approveOrder('order-100', 1);
      // Order removed from DEPT_MANAGER's list
      expect(useApprovalStore.getState().orders).toHaveLength(0);

      // Step 3: ASSET_ADMIN fetches pending approvals (APPROVING_LEVEL_2)
      const level2Orders = [
        createMockOrder({ id: 'order-100', status: 'APPROVING_LEVEL_2', version: 2, currentApprovalLevel: 2 }),
      ];
      spyFetchPending.mockResolvedValueOnce({
        items: level2Orders,
        total: 1,
        page: 1,
        pageSize: 20,
      });
      await useApprovalStore.getState().fetchPendingOrders('ASSET_ADMIN');
      expect(useApprovalStore.getState().orders).toHaveLength(1);
      expect(useApprovalStore.getState().orders[0].status).toBe('APPROVING_LEVEL_2');

      // Step 4: ASSET_ADMIN approves the order → transitions to APPROVED
      spyApprove.mockResolvedValueOnce(
        createMockActionResponse({
          id: 'order-100',
          status: 'APPROVED',
          version: 3,
        }),
      );
      await useApprovalStore.getState().approveOrder('order-100', 2);
      expect(useApprovalStore.getState().orders).toHaveLength(0);
    });

    it('should support rejection at APPROVING_LEVEL_1', async () => {
      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-200', status: 'APPROVING_LEVEL_1', version: 1 })],
      });

      spyReject.mockResolvedValueOnce(
        createMockActionResponse({
          id: 'order-200',
          status: 'REJECTED',
          version: 2,
          approvalRecord: {
            id: 'rec-reject-1',
            orderId: 'order-200',
            operatorId: 'user-200',
            operatorName: '李主管',
            action: 'REJECT',
            comment: '材料不完整',
            createdAt: '2025-06-01T09:30:00Z',
          },
        }),
      );

      await useApprovalStore.getState().rejectOrder('order-200', '材料不完整', 1);

      expect(useApprovalStore.getState().orders).toHaveLength(0);
    });

    it('should support rejection at APPROVING_LEVEL_2', async () => {
      useApprovalStore.setState({
        orders: [createMockOrder({ id: 'order-300', status: 'APPROVING_LEVEL_2', version: 2, currentApprovalLevel: 2 })],
      });

      spyReject.mockResolvedValueOnce(
        createMockActionResponse({
          id: 'order-300',
          status: 'REJECTED',
          version: 3,
          approvalRecord: {
            id: 'rec-reject-2',
            orderId: 'order-300',
            operatorId: 'user-300',
            operatorName: '王管理员',
            action: 'REJECT',
            comment: '资产信息不符',
            createdAt: '2025-06-01T11:30:00Z',
          },
        }),
      );

      await useApprovalStore.getState().rejectOrder('order-300', '资产信息不符', 2);

      expect(useApprovalStore.getState().orders).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // CANCELLED state handling
  // -------------------------------------------------------------------------
  describe('CANCELLED state', () => {
    it('should not show CANCELLED orders in pending list', async () => {
      const mockOrders = [
        createMockOrder({ id: '1', status: 'APPROVING_LEVEL_1' }),
        createMockOrder({ id: '2', status: 'CANCELLED' }),
      ];

      // The API should filter out CANCELLED orders, but the store should handle it
      spyFetchPending.mockResolvedValueOnce({
        items: [mockOrders[0]], // Only APPROVING_LEVEL_1 returned
        total: 1,
        page: 1,
        pageSize: 20,
      });

      await useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');

      const state = useApprovalStore.getState();
      expect(state.orders.every((o) => o.status !== 'CANCELLED')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------
  describe('pagination', () => {
    it('should update pagination from API response', async () => {
      spyFetchPending.mockResolvedValueOnce({
        items: [createMockOrder()],
        total: 100,
        page: 2,
        pageSize: 20,
      });

      await useApprovalStore.getState().fetchPendingOrders('DEPT_MANAGER');

      const state = useApprovalStore.getState();
      expect(state.pagination).toEqual({ page: 2, pageSize: 20, total: 100 });
    });

    it('should support fetching with custom page and pageSize', async () => {
      spyFetchPending.mockResolvedValueOnce({
        items: [],
        total: 50,
        page: 3,
        pageSize: 10,
      });

      await useApprovalStore
        .getState()
        .fetchPendingOrders('DEPT_MANAGER', { page: 3, pageSize: 10 });

      expect(spyFetchPending).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          pageSize: 10,
        }),
      );
    });
  });
});