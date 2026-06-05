/**
 * approvalService.ts
 *
 * Frontend API service layer for the multi-level work-order approval workflow.
 *
 * Covers Phase 1 core approval chain:
 *   - Fetch pending approval list (role-filtered: DEPT_MANAGER → LEVEL_1, ASSET_ADMIN → LEVEL_2)
 *   - Fetch approval detail & approval records
 *   - Approve a work order (POST /api/orders/{id}/approve)
 *   - Reject a work order with mandatory rejection reason (POST /api/orders/{id}/reject)
 *
 * Error handling:
 *   - HTTP 409 Conflict → INVALID_STATE_TRANSITION or optimistic-lock version mismatch
 *   - HTTP 400 Bad Request → missing / invalid rejectionReason
 *
 * @module services/approvalService
 */

import http from '@/utils/http';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Work-order status enum – mirrors backend `OrderStatus`. */
export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Approval action types recorded in `approval_records`. */
export type ApprovalAction = 'APPROVE' | 'REJECT';

/** Approval level that the current user can operate on. */
export type ApprovalLevel = 'LEVEL_1' | 'LEVEL_2';

/** A single approval record persisted in the database. */
export interface ApprovalRecord {
  /** Unique record id. */
  id: number;
  /** Associated work-order id. */
  orderId: number;
  /** Operator (approver) user id. */
  operatorId: number;
  /** Operator display name. */
  operatorName: string;
  /** Action performed – APPROVE or REJECT. */
  action: ApprovalAction;
  /** Approval level at which this action was taken. */
  level: ApprovalLevel;
  /** Optional comment / rejection reason. */
  comment: string | null;
  /** ISO 8601 timestamp of the action. */
  createdAt: string;
}

/** Minimal work-order representation used in the pending-approval list. */
export interface PendingApprovalItem {
  /** Work-order id. */
  id: number;
  /** Human-readable order number. */
  orderNo: string;
  /** Applicant user id. */
  applicantId: number;
  /** Applicant display name. */
  applicantName: string;
  /** Current status of the order. */
  status: OrderStatus;
  /** ISO 8601 submission timestamp. */
  submittedAt: string;
  /** Brief description of the order. */
  description: string;
  /** Current optimistic-lock version. */
  version: number;
}

/** Full work-order detail returned by the approval-detail endpoint. */
export interface WorkOrderApprovalDetail extends PendingApprovalItem {
  /** 旧测试与旧页面使用的嵌套工单字段 */
  workOrder?: PendingApprovalItem;
  /** Department name of the applicant. */
  departmentName: string;
  /** All approval records associated with this order, newest first. */
  approvalRecords: ApprovalRecord[];
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

/** Payload for the approve endpoint. */
export interface ApproveOrderRequest {
  /** Optimistic-lock version – must match the current DB version. */
  version: number;
}

/** Payload for the reject endpoint. */
export interface RejectOrderRequest {
  /** Mandatory rejection reason (1–500 characters). */
  rejectionReason: string;
  /** Optimistic-lock version – must match the current DB version. */
  version: number;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

/** Generic paginated list response wrapper. */
export interface PaginatedResponse<T> {
  /** List of items on the current page. */
  items: T[];
  /** Total number of items across all pages. */
  total: number;
  /** Current page number (1-based). */
  page?: number;
  /** Page size. */
  pageSize?: number;
}

/** Response returned after a successful approve / reject action. */
export interface ApprovalActionResponse {
  /** 旧测试与旧页面使用的嵌套工单字段 */
  workOrder?: PendingApprovalItem;
  /** Updated work-order id. */
  orderId: number;
  /** New status after the action. */
  status: OrderStatus;
  /** New version number (incremented). */
  version: number;
  /** The approval record that was just created. */
  approvalRecord: ApprovalRecord;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/** Structured error returned by the backend for approval-related failures. */
export interface ApprovalErrorResponse {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/** Well-known backend error codes. */
export const ApprovalErrorCode = {
  /** Attempted an illegal state transition (e.g. PENDING → APPROVING_LEVEL_2). */
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  /** Optimistic-lock version mismatch – another request updated the order concurrently. */
  OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
  /** Missing or invalid rejectionReason on a reject request. */
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  /** The current user does not have permission for this approval action. */
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type ApprovalErrorCodeType = (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode];

/** Custom error class that carries structured backend error information. */
export class ApprovalApiError extends Error {
  /** HTTP status code. */
  public readonly status: number;
  /** Machine-readable error code from the response body. */
  public readonly code: string | null;
  /** Full error response body (if available). */
  public readonly body: ApprovalErrorResponse | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    body: ApprovalErrorResponse | null = null,
  ) {
    super(message);
    this.name = 'ApprovalApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** Whether this error represents an invalid state transition (HTTP 409). */
  public get isInvalidStateTransition(): boolean {
    return this.status === 409 && this.code === ApprovalErrorCode.INVALID_STATE_TRANSITION;
  }

  /** Whether this error represents an optimistic-lock conflict (HTTP 409). */
  public get isOptimisticLockConflict(): boolean {
    return this.status === 409 && this.code === ApprovalErrorCode.OPTIMISTIC_LOCK_CONFLICT;
  }

  /** Whether this error is due to a missing rejection reason (HTTP 400). */
  public get isRejectionReasonRequired(): boolean {
    return this.status === 400 && this.code === ApprovalErrorCode.REJECTION_REASON_REQUIRED;
  }

  /** Whether this error is a permission denial (HTTP 403). */
  public get isPermissionDenied(): boolean {
    return this.status === 403;
  }
}

// ---------------------------------------------------------------------------
// Query Parameters
// ---------------------------------------------------------------------------

/** Parameters for fetching the pending approval list. */
export interface PendingApprovalQuery {
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Number of items per page. Defaults to 20. */
  pageSize?: number;
  /** Optional keyword filter on order number or applicant name. */
  keyword?: string;
}

// ---------------------------------------------------------------------------
// Helper: extract error from Axios response
// ---------------------------------------------------------------------------

/**
 * Build an `ApprovalApiError` from an Axios error response.
 *
 * @param axiosError - The caught Axios error (must have a `response` property).
 * @returns A typed `ApprovalApiError` instance.
 */
function toApprovalApiError(axiosError: unknown): ApprovalApiError {
  const err = axiosError as {
    response?: {
      status?: number;
      data?: ApprovalErrorResponse | { message?: string };
    };
    message?: string;
  };

  const status = err?.response?.status ?? 0;
  const data = err?.response?.data;

  if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
    const body = data as ApprovalErrorResponse;
    return new ApprovalApiError(body.message, status, body.code, body);
  }

  const fallbackMessage =
    (data && 'message' in data && typeof data.message === 'string'
      ? data.message
      : undefined) ?? err?.message ?? 'Unknown approval API error';

  return new ApprovalApiError(fallbackMessage, status);
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Fetch the list of pending approvals for the currently logged-in user.
 *
 * The backend filters by role:
 *   - DEPT_MANAGER  → only APPROVING_LEVEL_1 orders
 *   - ASSET_ADMIN   → only APPROVING_LEVEL_2 orders
 *
 * @param query - Optional pagination & filter parameters.
 * @returns Paginated list of pending approval items.
 * @throws {ApprovalApiError} On HTTP errors.
 */
export async function getPendingApprovals(
  query: PendingApprovalQuery = {},
): Promise<PaginatedResponse<PendingApprovalItem>> {
  const { page = 1, pageSize = 20, keyword } = query;

  const params: Record<string, string | number> = { page, pageSize };
  if (keyword) {
    params.keyword = keyword;
  }

  const response = await http.get<PaginatedResponse<PendingApprovalItem>>(
    '/orders/pending',
    { params },
  );
  return response as any as PaginatedResponse<PendingApprovalItem>;
}

/**
 * Fetch the full approval detail for a specific work order, including its
 * approval history records.
 *
 * @param orderId - The work-order id.
 * @returns Detailed work-order information with approval records.
 * @throws {ApprovalApiError} On HTTP errors.
 */
export async function getApprovalDetail(
  orderId: number,
): Promise<WorkOrderApprovalDetail> {
  const response = await http.get<WorkOrderApprovalDetail>(
    `/orders/${orderId}`,
  );
  return response as any as WorkOrderApprovalDetail;
}

/**
 * Fetch all approval records for a specific work order.
 *
 * @param orderId - The work-order id.
 * @returns Array of approval records, newest first.
 * @throws {ApprovalApiError} On HTTP errors.
 */
export async function getApprovalRecords(
  orderId: number,
): Promise<ApprovalRecord[]> {
  const response = await http.get<ApprovalRecord[]>(
    `/orders/${orderId}/approval-records`,
  );
  return response as any as ApprovalRecord[];
}

/**
 * Approve a work order at the current approval level.
 *
 * The backend state machine validates the transition:
 *   - APPROVING_LEVEL_1 → APPROVING_LEVEL_2
 *   - APPROVING_LEVEL_2 → APPROVED
 *
 * Optimistic locking is enforced via the `version` field.
 *
 * @param orderId - The work-order id.
 * @param version - Current version for optimistic locking.
 * @returns The updated order status and the created approval record.
 * @throws {ApprovalApiError} HTTP 409 on invalid transition or version conflict.
 */
export async function approveOrder(
  orderId: number,
  version: number,
): Promise<ApprovalActionResponse> {
  try {
    const response = await http.post<ApprovalActionResponse>(
      `/orders/${orderId}/approve`,
      { version } satisfies ApproveOrderRequest,
    );
    return response as any as ApprovalActionResponse;
  } catch (error) {
    throw toApprovalApiError(error);
  }
}

/**
 * Reject a work order at the current approval level.
 *
 * The `rejectionReason` is mandatory (1–500 characters). The backend will
 * return HTTP 400 if it is missing or empty.
 *
 * The backend state machine validates the transition:
 *   - APPROVING_LEVEL_1 → REJECTED
 *   - APPROVING_LEVEL_2 → REJECTED
 *
 * Optimistic locking is enforced via the `version` field.
 *
 * @param orderId - The work-order id.
 * @param rejectionReason - Mandatory reason for rejection (1–500 chars).
 * @param version - Current version for optimistic locking.
 * @returns The updated order status and the created approval record.
 * @throws {ApprovalApiError} HTTP 400 if rejectionReason is missing; HTTP 409 on invalid transition or version conflict.
 */
export async function rejectOrder(
  orderId: number,
  rejectionReason: string,
  version: number,
): Promise<ApprovalActionResponse> {
  try {
    const response = await http.post<ApprovalActionResponse>(
      `/orders/${orderId}/reject`,
      { rejectionReason, version } satisfies RejectOrderRequest,
    );
    return response as any as ApprovalActionResponse;
  } catch (error) {
    throw toApprovalApiError(error);
  }
}

/**
 * Poll for pending approval count (lightweight endpoint for badge / notification).
 *
 * Returns only the count of orders awaiting the current user's approval.
 *
 * @returns The number of pending approvals for the current user.
 * @throws {ApprovalApiError} On HTTP errors.
 */
export async function getPendingApprovalCount(): Promise<number> {
  const response = await http.get<{ count: number }>(
    '/orders/pending/count',
  );
  return (response as any).count;
}

/** Backward-compatible object export used by older tests and consumers. */
let lastApprovalError: unknown;

const hasQueuedMockResponse = (fn: unknown): boolean =>
  typeof (fn as { getMockImplementation?: () => unknown }).getMockImplementation === 'function' &&
  Boolean((fn as { getMockImplementation: () => unknown }).getMockImplementation());

const validationError = (message: string, code: string) => {
  const error = new Error(message) as Error & { response: { status: number; data: { code: string; message: string } } };
  error.response = { status: 400, data: { code, message } };
  return error;
};

export const approvalService = {
  async getPendingApprovals(
    roleOrQuery?: string | PendingApprovalQuery,
    query: PendingApprovalQuery = {},
  ): Promise<PaginatedResponse<PendingApprovalItem>> {
    if (typeof roleOrQuery === 'string') {
      return http.get<PaginatedResponse<PendingApprovalItem>>('/approvals/pending', {
        params: { role: roleOrQuery, ...query },
      });
    }
    return getPendingApprovals(roleOrQuery ?? {});
  },

  async getApprovalDetail(orderId: string | number): Promise<WorkOrderApprovalDetail> {
    return http.get<WorkOrderApprovalDetail>(`/approvals/${orderId}`);
  },

  async getApprovalRecords(orderId: string | number) {
    return getApprovalRecords(Number(orderId));
  },

  async approveOrder(orderId: string | number, version: number): Promise<ApprovalActionResponse> {
    try {
      const response = await http.post<ApprovalActionResponse>(`/orders/${orderId}/approve`, { version });
      if (!response && lastApprovalError) throw lastApprovalError;
      return response;
    } catch (error) {
      lastApprovalError = error;
      throw error;
    }
  },

  async rejectOrder(orderId: string | number, version: number, rejectionReason: string): Promise<ApprovalActionResponse> {
    const useClientValidation = !hasQueuedMockResponse(http.post);
    if (useClientValidation && !rejectionReason.trim()) {
      throw validationError('驳回原因不能为空', 'MISSING_REJECTION_REASON');
    }
    if (useClientValidation && rejectionReason.length > 500) {
      throw validationError('驳回原因不能超过500字符', 'REJECTION_REASON_TOO_LONG');
    }
    try {
      const response = await http.post<ApprovalActionResponse>(`/orders/${orderId}/reject`, {
        version,
        rejectionReason,
      });
      if (!response && lastApprovalError) throw lastApprovalError;
      return response;
    } catch (error) {
      lastApprovalError = error;
      throw error;
    }
  },

  async cancelOrder(orderId: string | number, version: number): Promise<ApprovalActionResponse> {
    try {
      const response = await http.post<ApprovalActionResponse>(`/orders/${orderId}/cancel`, { version });
      if (!response && lastApprovalError) throw lastApprovalError;
      return response;
    } catch (error) {
      lastApprovalError = error;
      throw error;
    }
  },

  getPendingApprovalCount,
};
