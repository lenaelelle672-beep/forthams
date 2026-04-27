/**
 * workOrderApi.ts
 *
 * Frontend API layer for Work Order management and multi-level approval workflow.
 *
 * Covers:
 * - Work order CRUD (list / detail / create / update / cancel)
 * - Two-level approval: Department Manager (Level 1) → Asset Manager (Level 2)
 * - Approval list with role-based status filtering
 * - Approval history / record retrieval
 * - Optimistic-lock version handling for concurrent approval safety
 *
 * Backend endpoints follow RESTful conventions:
 *   POST /api/orders/{id}/approve
 *   POST /api/orders/{id}/reject
 *   GET  /api/orders/pending-approvals
 *   GET  /api/orders/{id}/approval-records
 *
 * @module workOrderApi
 */

import { http } from '@/utils/http';

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

/**
 * Work order status enum – mirrors backend `OrderStatus`.
 *
 * Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * Reverse flow:  Any approval level → REJECTED
 * Terminal:       CANCELLED
 */
export enum OrderStatus {
  /** 工单已创建，等待提交审批 */
  DRAFT = 'DRAFT',
  /** 已提交，等待进入审批流程 */
  PENDING = 'PENDING',
  /** 一级审批中（部门主管） */
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  /** 二级审批中（资产管理员） */
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  /** 审批通过 */
  APPROVED = 'APPROVED',
  /** 已驳回 */
  REJECTED = 'REJECTED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
}

/** Approval action types recorded in `approval_records`. */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

/** Approval level identifiers. */
export enum ApprovalLevel {
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
}

/** Business error codes returned by the backend state machine. */
export const ApprovalErrorCode = {
  /** Illegal state transition (e.g. PENDING → APPROVING_LEVEL_2). */
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  /** Optimistic-lock version mismatch. */
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  /** Missing or empty rejection reason. */
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
} as const;

export type ApprovalErrorCodeType =
  (typeof ApprovalErrorCode)[keyof typeof ApprovalErrorCode];

// ---------------------------------------------------------------------------
// Request Types
// ---------------------------------------------------------------------------

/** Payload for approving a work order. */
export interface ApproveWorkOrderRequest {
  /** Current version of the work order (optimistic lock). */
  version: number;
}

/** Payload for rejecting a work order. */
export interface RejectWorkOrderRequest {
  /** Rejection reason – required, non-empty, max 500 characters. */
  rejectionReason: string;
  /** Current version of the work order (optimistic lock). */
  version: number;
}

/** Query parameters for the pending-approvals list. */
export interface PendingApprovalsQuery {
  /** Current page number (1-based). */
  page?: number;
  /** Page size. */
  pageSize?: number;
  /** Optional keyword filter (order number / applicant name). */
  keyword?: string;
}

/** Query parameters for approval records. */
export interface ApprovalRecordsQuery {
  /** Current page number (1-based). */
  page?: number;
  /** Page size. */
  pageSize?: number;
}

/** Query parameters for the work order list. */
export interface WorkOrderListQuery {
  /** Current page number (1-based). */
  page?: number;
  /** Page size. */
  pageSize?: number;
  /** Filter by status. */
  status?: OrderStatus | string;
  /** Optional keyword filter. */
  keyword?: string;
}

/** Payload for creating a new work order. */
export interface CreateWorkOrderRequest {
  /** Order title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Associated asset ID (optional). */
  assetId?: string;
  /** Priority level. */
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/** Payload for updating an existing work order. */
export interface UpdateWorkOrderRequest {
  /** Order title. */
  title?: string;
  /** Detailed description. */
  description?: string;
  /** Current version (optimistic lock). */
  version: number;
}

// ---------------------------------------------------------------------------
// Response Types
// ---------------------------------------------------------------------------

/** A single approval record entry. */
export interface ApprovalRecord {
  /** Record ID. */
  id: string;
  /** Associated work order ID. */
  orderId: string;
  /** Operator (approver) user ID. */
  operatorId: string;
  /** Operator display name. */
  operatorName: string;
  /** Action performed (APPROVE / REJECT). */
  action: ApprovalAction;
  /** Approval level at which this action was taken. */
  level: ApprovalLevel;
  /** Optional comment / rejection reason. */
  comment: string | null;
  /** ISO 8601 timestamp of the action. */
  createdAt: string;
}

/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
  /** List of items on the current page. */
  list: T[];
  /** Total number of items across all pages. */
  total: number;
  /** Current page number. */
  page: number;
  /** Page size. */
  pageSize: number;
}

/** Work order detail returned by the API. */
export interface WorkOrderDetail {
  /** Work order ID. */
  id: string;
  /** Order number (human-readable). */
  orderNo: string;
  /** Order title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Current status. */
  status: OrderStatus;
  /** Applicant user ID. */
  applicantId: string;
  /** Applicant display name. */
  applicantName: string;
  /** Associated asset ID. */
  assetId: string | null;
  /** Priority level. */
  priority: string;
  /** Optimistic-lock version – must be sent back on mutation requests. */
  version: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-update timestamp. */
  updatedAt: string;
  /** Rejection reason (populated when status is REJECTED). */
  rejectionReason: string | null;
}

/** Lightweight work order item for list views. */
export interface WorkOrderListItem {
  /** Work order ID. */
  id: string;
  /** Order number. */
  orderNo: string;
  /** Order title. */
  title: string;
  /** Current status. */
  status: OrderStatus;
  /** Applicant display name. */
  applicantName: string;
  /** Priority level. */
  priority: string;
  /** ISO 8601 submission timestamp. */
  createdAt: string;
}

/** Pending-approval list item – extends the base list item with approval context. */
export interface PendingApprovalItem extends WorkOrderListItem {
  /** Current approval level (LEVEL_1 or LEVEL_2). */
  currentLevel: ApprovalLevel;
  /** ISO 8601 timestamp when the order entered the current approval level. */
  enteredLevelAt: string;
}

/** Standard API response wrapper used by the backend. */
export interface ApiResponse<T = unknown> {
  /** Whether the request succeeded. */
  success: boolean;
  /** Response payload. */
  data: T;
  /** Human-readable message. */
  message?: string;
  /** Business error code (present on failure). */
  errorCode?: string;
}

/** Error detail structure returned on 409 / 400 responses. */
export interface ApiErrorResponse {
  /** Whether the request succeeded (always false). */
  success: false;
  /** Business error code. */
  errorCode: ApprovalErrorCodeType | string;
  /** Human-readable error message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Custom Error Classes
// ---------------------------------------------------------------------------

/**
 * Thrown when the backend rejects a state transition (HTTP 409).
 * Carries the business error code for UI-level handling.
 */
export class StateTransitionError extends Error {
  /** Business error code from the backend. */
  public readonly errorCode: string;

  constructor(message: string, errorCode: string) {
    super(message);
    this.name = 'StateTransitionError';
    this.errorCode = errorCode;
  }
}

/**
 * Thrown when request validation fails (HTTP 400).
 * E.g. missing `rejectionReason` on a reject request.
 */
export class ValidationError extends Error {
  /** Business error code from the backend. */
  public readonly errorCode: string;

  constructor(message: string, errorCode: string) {
    super(message);
    this.name = 'ValidationError';
    this.errorCode = errorCode;
  }
}

/**
 * Thrown on optimistic-lock version conflict (HTTP 409 with VERSION_CONFLICT).
 */
export class VersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionConflictError';
  }
}

// ---------------------------------------------------------------------------
// Helper: extract error detail from Axios error response
// ---------------------------------------------------------------------------

/**
 * Parses an Axios error response and throws a domain-specific error class.
 *
 * @param error - The caught error from an Axios call.
 * @throws {StateTransitionError} On HTTP 409 with INVALID_STATE_TRANSITION.
 * @throws {VersionConflictError} On HTTP 409 with VERSION_CONFLICT.
 * @throws {ValidationError} On HTTP 400.
 * @throws {Error} Re-throws the original error for unexpected statuses.
 */
function parseApiError(error: unknown): never {
  const axiosError = error as {
    response?: {
      status: number;
      data?: ApiErrorResponse;
    };
    message?: string;
  };

  const status = axiosError.response?.status;
  const body = axiosError.response?.data;

  if (status === 409 && body?.errorCode) {
    if (body.errorCode === ApprovalErrorCode.VERSION_CONFLICT) {
      throw new VersionConflictError(body.message || '版本冲突，请刷新后重试');
    }
    throw new StateTransitionError(
      body.message || '状态流转不合法',
      body.errorCode,
    );
  }

  if (status === 400 && body?.errorCode) {
    throw new ValidationError(
      body.message || '请求参数校验失败',
      body.errorCode,
    );
  }

  // Fallback: re-throw with original message
  throw new Error(
    axiosError.message || '请求失败，请稍后重试',
  );
}

// ---------------------------------------------------------------------------
// API Functions – Work Order CRUD
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of work orders.
 *
 * @param query - Pagination and filter parameters.
 * @returns Paginated list of work order items.
 */
export async function fetchWorkOrders(
  query: WorkOrderListQuery = {},
): Promise<PaginatedResponse<WorkOrderListItem>> {
  try {
    const { data } = await http.get<ApiResponse<PaginatedResponse<WorkOrderListItem>>>(
      '/api/orders',
      { params: query },
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Fetch the full detail of a single work order.
 *
 * @param orderId - The work order ID.
 * @returns Complete work order detail including version for optimistic locking.
 */
export async function fetchWorkOrderDetail(
  orderId: string,
): Promise<WorkOrderDetail> {
  try {
    const { data } = await http.get<ApiResponse<WorkOrderDetail>>(
      `/api/orders/${orderId}`,
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Create a new work order.
 *
 * @param payload - Work order creation payload.
 * @returns The created work order detail.
 */
export async function createWorkOrder(
  payload: CreateWorkOrderRequest,
): Promise<WorkOrderDetail> {
  try {
    const { data } = await http.post<ApiResponse<WorkOrderDetail>>(
      '/api/orders',
      payload,
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Update an existing work order (only allowed in DRAFT status).
 *
 * @param orderId - The work order ID.
 * @param payload - Update payload including the current version.
 * @returns The updated work order detail.
 */
export async function updateWorkOrder(
  orderId: string,
  payload: UpdateWorkOrderRequest,
): Promise<WorkOrderDetail> {
  try {
    const { data } = await http.put<ApiResponse<WorkOrderDetail>>(
      `/api/orders/${orderId}`,
      payload,
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Cancel a work order.
 * Only allowed when the order is in PENDING or DRAFT status.
 *
 * @param orderId - The work order ID.
 * @param version - Current version for optimistic locking.
 * @returns The updated work order detail.
 */
export async function cancelWorkOrder(
  orderId: string,
  version: number,
): Promise<WorkOrderDetail> {
  try {
    const { data } = await http.post<ApiResponse<WorkOrderDetail>>(
      `/api/orders/${orderId}/cancel`,
      { version },
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

// ---------------------------------------------------------------------------
// API Functions – Approval Workflow
// ---------------------------------------------------------------------------

/**
 * Approve a work order at the current approval level.
 *
 * The backend state machine enforces:
 * - APPROVING_LEVEL_1 → APPROVING_LEVEL_2 (department manager approves)
 * - APPROVING_LEVEL_2 → APPROVED (asset manager approves)
 *
 * Requires the current `version` for optimistic locking.
 *
 * @param orderId - The work order ID.
 * @param version - Current version of the work order.
 * @returns The updated work order detail with new status.
 * @throws {StateTransitionError} If the state transition is illegal (HTTP 409).
 * @throws {VersionConflictError} If the version is stale (HTTP 409).
 */
export async function approveWorkOrder(
  orderId: string,
  version: number,
): Promise<WorkOrderDetail> {
  try {
    const payload: ApproveWorkOrderRequest = { version };
    const { data } = await http.post<ApiResponse<WorkOrderDetail>>(
      `/api/orders/${orderId}/approve`,
      payload,
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Reject a work order at the current approval level.
 *
 * The backend state machine enforces:
 * - APPROVING_LEVEL_1 → REJECTED
 * - APPROVING_LEVEL_2 → REJECTED
 *
 * The `rejectionReason` is mandatory (non-empty, max 500 chars).
 * Missing or empty reason results in HTTP 400 with REJECTION_REASON_REQUIRED.
 *
 * @param orderId - The work order ID.
 * @param rejectionReason - Mandatory reason for rejection (1–500 chars).
 * @param version - Current version of the work order.
 * @returns The updated work order detail with REJECTED status.
 * @throws {ValidationError} If rejectionReason is missing/empty (HTTP 400).
 * @throws {StateTransitionError} If the state transition is illegal (HTTP 409).
 * @throws {VersionConflictError} If the version is stale (HTTP 409).
 */
export async function rejectWorkOrder(
  orderId: string,
  rejectionReason: string,
  version: number,
): Promise<WorkOrderDetail> {
  try {
    const payload: RejectWorkOrderRequest = { rejectionReason, version };
    const { data } = await http.post<ApiResponse<WorkOrderDetail>>(
      `/api/orders/${orderId}/reject`,
      payload,
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

// ---------------------------------------------------------------------------
// API Functions – Approval List & Records
// ---------------------------------------------------------------------------

/**
 * Fetch the pending-approval work order list for the current user.
 *
 * The backend enforces role-based data isolation:
 * - Department Manager (部门主管) sees only APPROVING_LEVEL_1 orders.
 * - Asset Manager (资产管理员) sees only APPROVING_LEVEL_2 orders.
 *
 * @param query - Pagination and optional keyword filter.
 * @returns Paginated list of pending-approval items.
 */
export async function fetchPendingApprovals(
  query: PendingApprovalsQuery = {},
): Promise<PaginatedResponse<PendingApprovalItem>> {
  try {
    const { data } = await http.get<ApiResponse<PaginatedResponse<PendingApprovalItem>>>(
      '/api/orders/pending-approvals',
      { params: query },
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

/**
 * Fetch the approval history records for a specific work order.
 *
 * Each record contains the operator, action (APPROVE/REJECT),
 * approval level, timestamp, and optional comment/rejection reason.
 *
 * @param orderId - The work order ID.
 * @param query - Pagination parameters.
 * @returns Paginated list of approval records in chronological order.
 */
export async function fetchApprovalRecords(
  orderId: string,
  query: ApprovalRecordsQuery = {},
): Promise<PaginatedResponse<ApprovalRecord>> {
  try {
    const { data } = await http.get<ApiResponse<PaginatedResponse<ApprovalRecord>>>(
      `/api/orders/${orderId}/approval-records`,
      { params: query },
    );
    return data.data;
  } catch (error) {
    throw parseApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Convenience: status display helpers
// ---------------------------------------------------------------------------

/** Human-readable Chinese labels for each order status. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: '草稿',
  [OrderStatus.PENDING]: '待提交',
  [OrderStatus.APPROVING_LEVEL_1]: '一级审批中',
  [OrderStatus.APPROVING_LEVEL_2]: '二级审批中',
  [OrderStatus.APPROVED]: '已通过',
  [OrderStatus.REJECTED]: '已驳回',
  [OrderStatus.CANCELLED]: '已取消',
};

/** Human-readable Chinese labels for approval levels. */
export const APPROVAL_LEVEL_LABEL: Record<ApprovalLevel, string> = {
  [ApprovalLevel.LEVEL_1]: '部门主管审批',
  [ApprovalLevel.LEVEL_2]: '资产管理员审批',
};

/**
 * Determine whether a given status represents an in-progress approval state.
 *
 * @param status - The work order status.
 * @returns `true` if the order is currently awaiting approval at some level.
 */
export function isApprovalInProgress(status: OrderStatus): boolean {
  return (
    status === OrderStatus.APPROVING_LEVEL_1 ||
    status === OrderStatus.APPROVING_LEVEL_2
  );
}

/**
 * Determine whether a work order can be approved at the current level.
 *
 * @param status - The work order status.
 * @returns `true` if the order is in an approval-pending state.
 */
export function canApprove(status: OrderStatus): boolean {
  return isApprovalInProgress(status);
}

/**
 * Determine whether a work order can be rejected at the current level.
 *
 * @param status - The work order status.
 * @returns `true` if the order is in an approval-pending state.
 */
export function canReject(status: OrderStatus): boolean {
  return isApprovalInProgress(status);
}

/**
 * Determine whether a work order can be cancelled by the applicant.
 *
 * @param status - The work order status.
 * @returns `true` if the order is in DRAFT or PENDING status.
 */
export function canCancel(status: OrderStatus): boolean {
  return status === OrderStatus.DRAFT || status === OrderStatus.PENDING;
}