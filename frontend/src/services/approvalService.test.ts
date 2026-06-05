/**
 * approvalService.test.ts
 *
 * Unit tests for the approval service module covering the core approval workflow
 * as specified in Phase 1 of the multi-level approval mechanism.
 *
 * Test coverage aligns with ATB-1 through ATB-5:
 * - ATB-1: Forward state transitions (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
 * - ATB-2: Rejection flow with mandatory rejection reason (HTTP 400 on missing reason)
 * - ATB-3: Invalid state transition interception (HTTP 409, INVALID_STATE_TRANSITION)
 * - ATB-4: Role-based pending approval list filtering
 * - ATB-5: Approval detail retrieval and operation validation
 *
 * Additional coverage:
 * - Optimistic locking conflict handling (HTTP 409, version mismatch)
 * - Rejection reason length constraint (max 500 characters)
 * - Cancelled state immutability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AxiosResponse, AxiosError } from 'axios';
import { approvalService } from './approvalService';
import type {
  OrderStatus,
  WorkOrder,
  ApprovalRecord,
  ApprovalActionResponse,
} from '../types/approval';

// ---------------------------------------------------------------------------
// Type aliases for test compatibility — map old names to actual types
// ---------------------------------------------------------------------------

/** @deprecated Use ApprovalListItem from workorder.types instead */
type PendingApprovalItem = any;
/** @deprecated Use ApproveWorkOrderRequest instead */
type ApprovalActionRequest = { version: number; comment?: string };
/** @deprecated Use RejectWorkOrderRequest instead */
type RejectActionRequest = { version: number; rejectionReason: string };
/** @deprecated Use PaginatedResponse<ApprovalListItem> instead */
type ApprovalListResponse = { items: PendingApprovalItem[]; total: number; page?: number; pageSize?: number };
/** @deprecated Use WorkOrderDetailResponse instead */
type ApprovalDetailResponse = { workOrder: WorkOrder; approvalRecords: ApprovalRecord[] };

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// We mock the internal http utility so no real network requests are made.
vi.mock('../utils/http', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '../utils/http';

const mockedHttp = vi.mocked(http);

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

/** ISO 8601 timestamp factory. */
function isoTime(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/** Build a minimal WorkOrder fixture. */
function buildWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'order-001',
    orderNo: 'WO-2025-0001',
    title: '测试工单',
    status: 'PENDING' as OrderStatus,
    version: 1,
    applicantId: 'user-100',
    applicantName: '张三',
    departmentId: 'dept-01',
    submittedAt: isoTime(),
    createdAt: isoTime(-86400000),
    updatedAt: isoTime(),
    ...overrides,
  };
}

/** Build a minimal ApprovalRecord fixture. */
function buildApprovalRecord(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: 'record-001',
    orderId: 'order-001',
    operatorId: 'user-200',
    operatorName: '李主管',
    action: 'APPROVE',
    level: 1,
    comment: '',
    createdAt: isoTime(),
    ...overrides,
  };
}

/** Build a pending approval list item. */
function buildPendingItem(overrides: Partial<PendingApprovalItem> = {}): PendingApprovalItem {
  return {
    id: 'order-001',
    orderNo: 'WO-2025-0001',
    applicantName: '张三',
    submittedAt: isoTime(),
    status: 'APPROVING_LEVEL_1',
    ...overrides,
  };
}

/** Create a successful AxiosResponse wrapper. */
function okResponse<T>(data: T, _status = 200): T {
  return data;
}

/** Create an AxiosError for non-2xx responses. */
function axiosError(
  status: number,
  code: string,
  message: string,
  data: Record<string, unknown> = {},
): AxiosError {
  const error = new Error(message) as AxiosError;
  error.isAxiosError = true;
  error.response = {
    data: { code, message, ...data },
    status,
    statusText: status === 400 ? 'Bad Request' : status === 409 ? 'Conflict' : 'Error',
    headers: {},
    config: {} as any,
  };
  return error;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('approvalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. getPendingApprovals — ATB-4: Role-based list filtering
  // =========================================================================
  describe('getPendingApprovals', () => {
    it('should fetch APPROVING_LEVEL_1 orders for DEPARTMENT_MANAGER role', async () => {
      const items = [
        buildPendingItem({ id: 'order-001', status: 'APPROVING_LEVEL_1' }),
        buildPendingItem({ id: 'order-002', orderNo: 'WO-2025-0002', status: 'APPROVING_LEVEL_1' }),
      ];
      const response: ApprovalListResponse = { items, total: 2 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getPendingApprovals('DEPARTMENT_MANAGER');

      expect(mockedHttp.get).toHaveBeenCalledWith('/approvals/pending', {
        params: { role: 'DEPARTMENT_MANAGER' },
      });
      expect(result.items).toHaveLength(2);
      expect(result.items.every((i) => i.status === 'APPROVING_LEVEL_1')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should fetch APPROVING_LEVEL_2 orders for ASSET_MANAGER role', async () => {
      const items = [
        buildPendingItem({ id: 'order-003', status: 'APPROVING_LEVEL_2' }),
      ];
      const response: ApprovalListResponse = { items, total: 1 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getPendingApprovals('ASSET_MANAGER');

      expect(mockedHttp.get).toHaveBeenCalledWith('/approvals/pending', {
        params: { role: 'ASSET_MANAGER' },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('APPROVING_LEVEL_2');
    });

    it('should return empty list when no pending approvals exist for the role', async () => {
      const response: ApprovalListResponse = { items: [], total: 0 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getPendingApprovals('DEPARTMENT_MANAGER');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should include order number, applicant name, and submitted time in list items', async () => {
      const item = buildPendingItem({
        orderNo: 'WO-2025-0099',
        applicantName: '王五',
        submittedAt: '2025-06-15T08:30:00Z',
      });
      const response: ApprovalListResponse = { items: [item], total: 1 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getPendingApprovals('DEPARTMENT_MANAGER');
      const listItem = result.items[0];

      expect(listItem.orderNo).toBe('WO-2025-0099');
      expect(listItem.applicantName).toBe('王五');
      expect(listItem.submittedAt).toBe('2025-06-15T08:30:00Z');
    });

    it('should support pagination parameters', async () => {
      const response: ApprovalListResponse = { items: [], total: 50 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      await approvalService.getPendingApprovals('DEPARTMENT_MANAGER', { page: 2, pageSize: 10 });

      expect(mockedHttp.get).toHaveBeenCalledWith('/approvals/pending', {
        params: { role: 'DEPARTMENT_MANAGER', page: 2, pageSize: 10 },
      });
    });
  });

  // =========================================================================
  // 2. getApprovalDetail — ATB-5: Detail page data
  // =========================================================================
  describe('getApprovalDetail', () => {
    it('should fetch approval detail for a given order ID', async () => {
      const workOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_1' });
      const records = [
        buildApprovalRecord({ action: 'APPROVE', level: 1, operatorName: '李主管' }),
      ];
      const response: ApprovalDetailResponse = { workOrder, approvalRecords: records };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getApprovalDetail('order-001');

      expect(mockedHttp.get).toHaveBeenCalledWith('/approvals/order-001');
      expect(result.workOrder.id).toBe('order-001');
      expect(result.approvalRecords).toHaveLength(1);
    });

    it('should return approval records with operator, action, time, and comment', async () => {
      const workOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_1' });
      const records = [
        buildApprovalRecord({
          operatorId: 'user-200',
          operatorName: '李主管',
          action: 'REJECT',
          level: 1,
          comment: '材料不合规',
          createdAt: '2025-06-15T10:00:00Z',
        }),
      ];
      const response: ApprovalDetailResponse = { workOrder, approvalRecords: records };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getApprovalDetail('order-001');
      const record = result.approvalRecords[0];

      expect(record.operatorId).toBe('user-200');
      expect(record.operatorName).toBe('李主管');
      expect(record.action).toBe('REJECT');
      expect(record.comment).toBe('材料不合规');
      expect(record.createdAt).toBe('2025-06-15T10:00:00Z');
    });
  });

  // =========================================================================
  // 3. approveOrder — ATB-1: Forward state transitions
  // =========================================================================
  describe('approveOrder', () => {
    it('should transition PENDING → APPROVING_LEVEL_1 on first approval', async () => {
      const updatedOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_1', version: 2 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'APPROVE', level: 1 }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.approveOrder('order-001', 1);

      expect(mockedHttp.post).toHaveBeenCalledWith('/orders/order-001/approve', {
        version: 1,
      });
      expect(result.workOrder.status).toBe('APPROVING_LEVEL_1');
      expect(result.approvalRecord.action).toBe('APPROVE');
    });

    it('should transition APPROVING_LEVEL_1 → APPROVING_LEVEL_2 on second approval', async () => {
      const updatedOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_2', version: 3 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'APPROVE', level: 2 }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.approveOrder('order-001', 2);

      expect(mockedHttp.post).toHaveBeenCalledWith('/orders/order-001/approve', {
        version: 2,
      });
      expect(result.workOrder.status).toBe('APPROVING_LEVEL_2');
    });

    it('should transition APPROVING_LEVEL_2 → APPROVED on final approval', async () => {
      const updatedOrder = buildWorkOrder({ status: 'APPROVED', version: 4 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'APPROVE', level: 2 }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.approveOrder('order-001', 3);

      expect(result.workOrder.status).toBe('APPROVED');
    });

    it('should send version field for optimistic locking', async () => {
      const updatedOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_1', version: 5 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord(),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      await approvalService.approveOrder('order-001', 4);

      expect(mockedHttp.post).toHaveBeenCalledWith('/orders/order-001/approve', {
        version: 4,
      });
    });

    it('should throw on HTTP 409 for invalid state transition (ATB-3)', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '非法状态流转');

      mockedHttp.post.mockRejectedValueOnce(error);

      await expect(approvalService.approveOrder('order-001', 1)).rejects.toThrow();

      try {
        await approvalService.approveOrder('order-001', 1);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should throw on HTTP 409 for optimistic locking conflict (concurrent approval)', async () => {
      const error = axiosError(409, 'VERSION_CONFLICT', '乐观锁冲突，工单已被他人操作');

      mockedHttp.post.mockRejectedValueOnce(error);

      await expect(approvalService.approveOrder('order-001', 1)).rejects.toThrow();

      try {
        await approvalService.approveOrder('order-001', 1);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('VERSION_CONFLICT');
      }
    });
  });

  // =========================================================================
  // 4. rejectOrder — ATB-2: Rejection with mandatory reason
  // =========================================================================
  describe('rejectOrder', () => {
    it('should reject an order at APPROVING_LEVEL_1 with a valid reason', async () => {
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 2 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({
          action: 'REJECT',
          level: 1,
          comment: '不合规',
        }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 1, '不合规');

      expect(mockedHttp.post).toHaveBeenCalledWith('/orders/order-001/reject', {
        version: 1,
        rejectionReason: '不合规',
      });
      expect(result.workOrder.status).toBe('REJECTED');
      expect(result.approvalRecord.action).toBe('REJECT');
      expect(result.approvalRecord.comment).toBe('不合规');
    });

    it('should reject an order at APPROVING_LEVEL_2 with a valid reason', async () => {
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 3 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({
          action: 'REJECT',
          level: 2,
          comment: '资产信息有误',
        }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 2, '资产信息有误');

      expect(result.workOrder.status).toBe('REJECTED');
      expect(result.approvalRecord.level).toBe(2);
    });

    it('should throw on HTTP 400 when rejectionReason is missing (ATB-2)', async () => {
      const error = axiosError(400, 'MISSING_REJECTION_REASON', '驳回原因不能为空');

      mockedHttp.post.mockRejectedValueOnce(error);

      await expect(approvalService.rejectOrder('order-001', 1, '')).rejects.toThrow();

      try {
        await approvalService.rejectOrder('order-001', 1, '');
      } catch (e: any) {
        expect(e.response.status).toBe(400);
        expect(e.response.data.code).toBe('MISSING_REJECTION_REASON');
      }
    });

    it('should throw on HTTP 400 when rejectionReason exceeds 500 characters', async () => {
      const longReason = 'a'.repeat(501);
      const error = axiosError(400, 'REJECTION_REASON_TOO_LONG', '驳回原因不能超过500字符');

      mockedHttp.post.mockRejectedValueOnce(error);

      await expect(approvalService.rejectOrder('order-001', 1, longReason)).rejects.toThrow();

      try {
        await approvalService.rejectOrder('order-001', 1, longReason);
      } catch (e: any) {
        expect(e.response.status).toBe(400);
        expect(e.response.data.code).toBe('REJECTION_REASON_TOO_LONG');
      }
    });

    it('should accept rejectionReason of exactly 500 characters', async () => {
      const maxReason = 'a'.repeat(500);
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 2 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'REJECT', comment: maxReason }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 1, maxReason);

      expect(result.workOrder.status).toBe('REJECTED');
    });

    it('should throw on HTTP 409 for invalid state transition during reject', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '当前状态不允许驳回');

      mockedHttp.post.mockRejectedValueOnce(error);

      await expect(approvalService.rejectOrder('order-001', 1, '原因')).rejects.toThrow();

      try {
        await approvalService.rejectOrder('order-001', 1, '原因');
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should throw on HTTP 409 for optimistic locking conflict during reject', async () => {
      const error = axiosError(409, 'VERSION_CONFLICT', '乐观锁冲突');

      mockedHttp.post.mockRejectedValueOnce(error);

      await expect(approvalService.rejectOrder('order-001', 1, '原因')).rejects.toThrow();

      try {
        await approvalService.rejectOrder('order-001', 1, '原因');
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('VERSION_CONFLICT');
      }
    });
  });

  // =========================================================================
  // 5. Client-side validation — ATB-5: Frontend form validation
  // =========================================================================
  describe('client-side validation', () => {
    it('should not send reject request when rejectionReason is empty (frontend guard)', async () => {
      // The service should perform client-side validation before making the API call
      // to avoid unnecessary network requests for obviously invalid input.
      await expect(approvalService.rejectOrder('order-001', 1, '')).rejects.toThrow(
        '驳回原因不能为空',
      );

      expect(mockedHttp.post).not.toHaveBeenCalled();
    });

    it('should not send reject request when rejectionReason is only whitespace', async () => {
      await expect(approvalService.rejectOrder('order-001', 1, '   ')).rejects.toThrow(
        '驳回原因不能为空',
      );

      expect(mockedHttp.post).not.toHaveBeenCalled();
    });

    it('should not send reject request when rejectionReason exceeds 500 characters (frontend guard)', async () => {
      const longReason = 'x'.repeat(501);

      await expect(approvalService.rejectOrder('order-001', 1, longReason)).rejects.toThrow(
        '驳回原因不能超过500字符',
      );

      expect(mockedHttp.post).not.toHaveBeenCalled();
    });

    it('should accept rejectionReason with exactly 500 characters (frontend guard)', async () => {
      const maxReason = 'y'.repeat(500);
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 2 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'REJECT', comment: maxReason }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 1, maxReason);

      expect(mockedHttp.post).toHaveBeenCalled();
      expect(result.workOrder.status).toBe('REJECTED');
    });
  });

  // =========================================================================
  // 6. Full forward transition sequence — ATB-1 end-to-end simulation
  // =========================================================================
  describe('full forward transition sequence', () => {
    it('should simulate complete PENDING → APPROVED flow with three approvals', async () => {
      // Step 1: PENDING → APPROVING_LEVEL_1 (submit/first-level approve)
      const step1Order = buildWorkOrder({ status: 'APPROVING_LEVEL_1', version: 2 });
      const step1Response: ApprovalActionResponse = {
        workOrder: step1Order,
        approvalRecord: buildApprovalRecord({ action: 'APPROVE', level: 1 }),
      };
      mockedHttp.post.mockResolvedValueOnce(okResponse(step1Response));

      const result1 = await approvalService.approveOrder('order-001', 1);
      expect(result1.workOrder.status).toBe('APPROVING_LEVEL_1');

      // Step 2: APPROVING_LEVEL_1 → APPROVING_LEVEL_2 (department manager approves)
      const step2Order = buildWorkOrder({ status: 'APPROVING_LEVEL_2', version: 3 });
      const step2Response: ApprovalActionResponse = {
        workOrder: step2Order,
        approvalRecord: buildApprovalRecord({ action: 'APPROVE', level: 1, operatorName: '李主管' }),
      };
      mockedHttp.post.mockResolvedValueOnce(okResponse(step2Response));

      const result2 = await approvalService.approveOrder('order-001', 2);
      expect(result2.workOrder.status).toBe('APPROVING_LEVEL_2');

      // Step 3: APPROVING_LEVEL_2 → APPROVED (asset manager approves)
      const step3Order = buildWorkOrder({ status: 'APPROVED', version: 4 });
      const step3Response: ApprovalActionResponse = {
        workOrder: step3Order,
        approvalRecord: buildApprovalRecord({ action: 'APPROVE', level: 2, operatorName: '赵管理员' }),
      };
      mockedHttp.post.mockResolvedValueOnce(okResponse(step3Response));

      const result3 = await approvalService.approveOrder('order-001', 3);
      expect(result3.workOrder.status).toBe('APPROVED');

      // Verify all three calls were made with correct version progression
      expect(mockedHttp.post).toHaveBeenCalledTimes(3);
      expect(mockedHttp.post).toHaveBeenNthCalledWith(1, '/orders/order-001/approve', {
        version: 1,
      });
      expect(mockedHttp.post).toHaveBeenNthCalledWith(2, '/orders/order-001/approve', {
        version: 2,
      });
      expect(mockedHttp.post).toHaveBeenNthCalledWith(3, '/orders/order-001/approve', {
        version: 3,
      });
    });
  });

  // =========================================================================
  // 7. Rejection at different levels — ATB-2 extended
  // =========================================================================
  describe('rejection at different approval levels', () => {
    it('should allow rejection at APPROVING_LEVEL_1', async () => {
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 2 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'REJECT', level: 1, comment: '不合规' }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 1, '不合规');

      expect(result.workOrder.status).toBe('REJECTED');
      expect(result.approvalRecord.level).toBe(1);
    });

    it('should allow rejection at APPROVING_LEVEL_2', async () => {
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 3 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'REJECT', level: 2, comment: '资产信息有误' }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 2, '资产信息有误');

      expect(result.workOrder.status).toBe('REJECTED');
      expect(result.approvalRecord.level).toBe(2);
    });
  });

  // =========================================================================
  // 8. Invalid transitions — ATB-3: Cross-level and terminal state
  // =========================================================================
  describe('invalid state transitions', () => {
    it('should reject cross-level approval (PENDING → APPROVING_LEVEL_2 directly)', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '禁止跨级审批');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.approveOrder('order-001', 1);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should reject approval on an already APPROVED order', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '工单已审批通过，不可重复审批');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.approveOrder('order-001', 4);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should reject approval on a REJECTED order', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '工单已驳回，不可审批');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.approveOrder('order-001', 2);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should reject approval on a CANCELLED order', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '工单已取消，不可审批');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.approveOrder('order-001', 2);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should reject rejection on a CANCELLED order', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '工单已取消，不可驳回');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.rejectOrder('order-001', 2, '原因');
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });

  // =========================================================================
  // 9. Cancel order
  // =========================================================================
  describe('cancelOrder', () => {
    it('should cancel a PENDING order', async () => {
      const updatedOrder = buildWorkOrder({ status: 'CANCELLED', version: 2 });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: buildApprovalRecord({ action: 'CANCEL' }),
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.cancelOrder('order-001', 1);

      expect(mockedHttp.post).toHaveBeenCalledWith('/orders/order-001/cancel', {
        version: 1,
      });
      expect(result.workOrder.status).toBe('CANCELLED');
    });

    it('should reject cancellation of an APPROVED order', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '已审批工单不可取消');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.cancelOrder('order-001', 4);
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });

  // =========================================================================
  // 10. Approval record persistence verification
  // =========================================================================
  describe('approval record persistence', () => {
    it('should return approval record with operator info after approve', async () => {
      const updatedOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_1', version: 2 });
      const record = buildApprovalRecord({
        id: 'record-new',
        orderId: 'order-001',
        operatorId: 'user-200',
        operatorName: '李主管',
        action: 'APPROVE',
        level: 1,
        comment: '',
        createdAt: isoTime(),
      });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: record,
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.approveOrder('order-001', 1);

      expect(result.approvalRecord.operatorId).toBe('user-200');
      expect(result.approvalRecord.operatorName).toBe('李主管');
      expect(result.approvalRecord.action).toBe('APPROVE');
      expect(result.approvalRecord.createdAt).toBeTruthy();
    });

    it('should return approval record with rejection reason after reject', async () => {
      const updatedOrder = buildWorkOrder({ status: 'REJECTED', version: 2 });
      const record = buildApprovalRecord({
        id: 'record-reject',
        orderId: 'order-001',
        operatorId: 'user-200',
        operatorName: '李主管',
        action: 'REJECT',
        level: 1,
        comment: '材料不合规，请补充后重新提交',
        createdAt: isoTime(),
      });
      const response: ApprovalActionResponse = {
        workOrder: updatedOrder,
        approvalRecord: record,
      };

      mockedHttp.post.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.rejectOrder('order-001', 1, '材料不合规，请补充后重新提交');

      expect(result.approvalRecord.action).toBe('REJECT');
      expect(result.approvalRecord.comment).toBe('材料不合规，请补充后重新提交');
    });

    it('should accumulate multiple approval records in detail view', async () => {
      const workOrder = buildWorkOrder({ status: 'APPROVING_LEVEL_2' });
      const records = [
        buildApprovalRecord({
          id: 'rec-1',
          action: 'APPROVE',
          level: 1,
          operatorName: '李主管',
          createdAt: '2025-06-15T09:00:00Z',
        }),
        buildApprovalRecord({
          id: 'rec-2',
          action: 'APPROVE',
          level: 2,
          operatorName: '赵管理员',
          createdAt: '2025-06-15T10:00:00Z',
        }),
      ];
      const response: ApprovalDetailResponse = { workOrder, approvalRecords: records };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getApprovalDetail('order-001');

      expect(result.approvalRecords).toHaveLength(2);
      expect(result.approvalRecords[0].action).toBe('APPROVE');
      expect(result.approvalRecords[1].action).toBe('APPROVE');
    });
  });

  // =========================================================================
  // 11. Error response structure consistency
  // =========================================================================
  describe('error response structure', () => {
    it('should preserve error code and message from 409 responses', async () => {
      const error = axiosError(409, 'INVALID_STATE_TRANSITION', '非法状态流转：PENDING → APPROVED');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.approveOrder('order-001', 1);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.response.status).toBe(409);
        expect(e.response.data.code).toBe('INVALID_STATE_TRANSITION');
        expect(e.response.data.message).toContain('非法状态流转');
      }
    });

    it('should preserve error code and message from 400 responses', async () => {
      const error = axiosError(400, 'MISSING_REJECTION_REASON', '驳回原因为必填项');

      mockedHttp.post.mockRejectedValueOnce(error);

      try {
        await approvalService.rejectOrder('order-001', 1, '');
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.response.status).toBe(400);
        expect(e.response.data.code).toBe('MISSING_REJECTION_REASON');
      }
    });
  });

  // =========================================================================
  // 12. Data isolation — ATB-4: Role-based visibility
  // =========================================================================
  describe('data isolation by role', () => {
    it('should pass DEPARTMENT_MANAGER role to filter APPROVING_LEVEL_1 orders', async () => {
      const response: ApprovalListResponse = { items: [], total: 0 };
      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      await approvalService.getPendingApprovals('DEPARTMENT_MANAGER');

      expect(mockedHttp.get).toHaveBeenCalledWith('/approvals/pending', {
        params: { role: 'DEPARTMENT_MANAGER' },
      });
    });

    it('should pass ASSET_MANAGER role to filter APPROVING_LEVEL_2 orders', async () => {
      const response: ApprovalListResponse = { items: [], total: 0 };
      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      await approvalService.getPendingApprovals('ASSET_MANAGER');

      expect(mockedHttp.get).toHaveBeenCalledWith('/approvals/pending', {
        params: { role: 'ASSET_MANAGER' },
      });
    });

    it('should not mix APPROVING_LEVEL_1 orders into ASSET_MANAGER results', async () => {
      // Simulate server correctly filtering — only LEVEL_2 items returned
      const items = [
        buildPendingItem({ id: 'order-010', status: 'APPROVING_LEVEL_2' }),
      ];
      const response: ApprovalListResponse = { items, total: 1 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getPendingApprovals('ASSET_MANAGER');

      const hasLevel1 = result.items.some((i) => i.status === 'APPROVING_LEVEL_1');
      expect(hasLevel1).toBe(false);
    });

    it('should not mix APPROVING_LEVEL_2 orders into DEPARTMENT_MANAGER results', async () => {
      const items = [
        buildPendingItem({ id: 'order-011', status: 'APPROVING_LEVEL_1' }),
      ];
      const response: ApprovalListResponse = { items, total: 1 };

      mockedHttp.get.mockResolvedValueOnce(okResponse(response));

      const result = await approvalService.getPendingApprovals('DEPARTMENT_MANAGER');

      const hasLevel2 = result.items.some((i) => i.status === 'APPROVING_LEVEL_2');
      expect(hasLevel2).toBe(false);
    });
  });
});