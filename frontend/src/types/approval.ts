/**
 * @module types/approval
 * @description
 * Core TypeScript type definitions for the multi-level approval workflow system.
 *
 * Covers:
 * - Work order status state-machine (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED)
 * - Reverse transitions to REJECTED / CANCELLED
 * - Approval record persistence (operator, action, timestamp, rejection reason)
 * - RESTful API request / response DTOs
 * - Role-based data isolation types
 *
 * @since Phase 1 – Core Approval Flow & Basic Workbench
 */

// ---------------------------------------------------------------------------
// 1. Work Order Status – State Machine Enum
// ---------------------------------------------------------------------------

/**
 * All valid states a work order can be in.
 *
 * Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * Reverse flow:  Any APPROVING_* → REJECTED
 * Cancellation:  PENDING / APPROVING_LEVEL_1 → CANCELLED
 */
export enum OrderStatus {
  /** 工单已创建，等待进入审批流程 */
  PENDING = 'PENDING',

  /** 一级审批中（部门主管） */
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',

  /** 二级审批中（资产管理员） */
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',

  /** 审批通过，工单完成 */
  APPROVED = 'APPROVED',

  /** 审批驳回（终态） */
  REJECTED = 'REJECTED',

  /** 工单已取消（终态） */
  CANCELLED = 'CANCELLED',
}

/**
 * Mapping of each status to its human-readable Chinese label.
 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待提交',
  [OrderStatus.APPROVING_LEVEL_1]: '一级审批中',
  [OrderStatus.APPROVING_LEVEL_2]: '二级审批中',
  [OrderStatus.APPROVED]: '已通过',
  [OrderStatus.REJECTED]: '已驳回',
  [OrderStatus.CANCELLED]: '已取消',
};

/**
 * Set of terminal (non-transitionable) statuses.
 */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.APPROVED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
]);

// ---------------------------------------------------------------------------
// 2. Approval Action Enum
// ---------------------------------------------------------------------------

/** Actions an approver can perform on a work order. */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

// ---------------------------------------------------------------------------
// 3. Approval Level Enum
// ---------------------------------------------------------------------------

/** The two approval levels in the workflow. */
export enum ApprovalLevel {
  LEVEL_1 = 'LEVEL_1', // 部门主管
  LEVEL_2 = 'LEVEL_2', // 资产管理员
}

// ---------------------------------------------------------------------------
// 4. Approval Record – Persistence Entity
// ---------------------------------------------------------------------------

/**
 * A single approval record persisted in the `approval_records` table.
 *
 * Captures who performed what action, when, and optional rejection reason.
 */
export interface ApprovalRecord {
  /** Unique record identifier */
  id: string;

  /** Associated work order ID */
  orderId: string;

  /** ID of the operator (approver) who performed the action */
  operatorId: string;

  /** Display name of the operator */
  operatorName: string;

  /** The action taken (APPROVE / REJECT) */
  action: ApprovalAction;

  /** Approval level at which this action was taken */
  approvalLevel: ApprovalLevel;

  /** Optional comment / note from the approver */
  comment?: string;

  /**
   * Mandatory rejection reason when action is REJECT.
   * Non-empty string, max 500 characters.
   */
  rejectionReason?: string;

  /** ISO 8601 timestamp of when the action was performed */
  createdAt: string;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 5. Work Order – Extended with Approval Fields
// ---------------------------------------------------------------------------

/**
 * Work order entity as returned by the backend, enriched with approval-related
 * fields required by the frontend workbench.
 */
export interface WorkOrder {
  /** Unique work order identifier */
  id: string;

  /** Human-readable work order number, e.g. "WO-2025-0001" */
  orderNo: string;

  /** Current status in the state machine */
  status: OrderStatus;

  /** Applicant (creator) user ID */
  applicantId: string;

  /** Applicant display name */
  applicantName: string;

  /** Applicant department name */
  departmentName?: string;

  /** Brief description of the work order */
  description: string;

  /** ISO 8601 timestamp when the order was created */
  createdAt: string;

  /** ISO 8601 timestamp when the order was last updated */
  updatedAt: string;

  /** ISO 8601 timestamp when the order was submitted (entered PENDING) */
  submittedAt?: string;

  /**
   * Optimistic-lock version field.
   * Must be sent back on approve/reject requests to prevent concurrent conflicts.
   */
  version: number;

  /** Ordered list of approval records for this work order */
  approvalRecords: ApprovalRecord[];

  /** Whether this order is flagged as critical / urgent */
  isCritical?: boolean;
}

// ---------------------------------------------------------------------------
// 6. API Request DTOs
// ---------------------------------------------------------------------------

/**
 * Request body for POST `/api/orders/{id}/approve`.
 */
export interface ApproveRequest {
  /**
   * Current version of the work order (optimistic lock).
   * Required to prevent concurrent approval conflicts.
   */
  version: number;

  /** Optional approval comment */
  comment?: string;
}

/**
 * Request body for POST `/api/orders/{id}/reject`.
 *
 * `rejectionReason` is mandatory (non-empty, max 500 chars).
 * Backend returns HTTP 400 if missing or empty.
 */
export interface RejectRequest {
  /**
   * Current version of the work order (optimistic lock).
   * Required to prevent concurrent approval conflicts.
   */
  version: number;

  /**
   * Mandatory rejection reason.
   * - Must be a non-empty string.
   * - Maximum 500 characters.
   */
  rejectionReason: string;

  /** Optional additional comment */
  comment?: string;
}

/**
 * Request body for POST `/api/orders/{id}/cancel`.
 */
export interface CancelRequest {
  /** Current version of the work order (optimistic lock) */
  version: number;

  /** Optional cancellation reason */
  reason?: string;
}

// ---------------------------------------------------------------------------
// 7. API Response DTOs
// ---------------------------------------------------------------------------

/**
 * Standard paginated list response wrapper.
 * 保留 items[] 字段以兼容本模块代码。
 * 其他模块请使用 types/common.ts 中的 PaginatedResponse<T>（使用 records[]）。
 */
export interface PaginatedResponse<T> {
  /** List of items in the current page */
  items: T[];

  /** Total number of items across all pages */
  total: number;

  /** Current page number (1-based) */
  page: number;

  /** Number of items per page */
  pageSize: number;

  /** Total number of pages */
  totalPages: number;
}

/**
 * Response returned after a successful approve / reject / cancel action.
 */
export interface ApprovalActionResponse {
  /** The updated work order */
  order: WorkOrder;

  /** The newly created approval record */
  record: ApprovalRecord;
}

// ---------------------------------------------------------------------------
// 8. Query Parameters for Approval List
// ---------------------------------------------------------------------------

/**
 * Query parameters for GET `/api/orders/approvals/pending`.
 *
 * The backend enforces role-based filtering:
 * - DEPARTMENT_MANAGER → only APPROVING_LEVEL_1 orders
 * - ASSET_ADMIN        → only APPROVING_LEVEL_2 orders
 */
export interface ApprovalListQuery {
  /** Page number (1-based), default 1 */
  page?: number;

  /** Page size, default 20 */
  pageSize?: number;

  /** Filter by work order number (fuzzy match) */
  orderNo?: string;

  /** Filter by applicant name (fuzzy match) */
  applicantName?: string;

  /** Filter by specific status */
  status?: OrderStatus;

  /** Filter by creation date range – start (ISO 8601) */
  createdFrom?: string;

  /** Filter by creation date range – end (ISO 8601) */
  createdTo?: string;

  /** Sort field, default 'createdAt' */
  sortBy?: 'createdAt' | 'updatedAt' | 'orderNo';

  /** Sort direction, default 'DESC' */
  sortOrder?: 'ASC' | 'DESC';
}

// ---------------------------------------------------------------------------
// 9. Approval Detail View Model
// ---------------------------------------------------------------------------

/**
 * Enriched view model used by the ApprovalDetail page.
 * Combines work order data with computed approval state information.
 */
export interface ApprovalDetailViewModel {
  /** The work order */
  order: WorkOrder;

  /** Current approval level (derived from status) */
  currentLevel: ApprovalLevel | null;

  /** Whether the current user can approve this order */
  canApprove: boolean;

  /** Whether the current user can reject this order */
  canReject: boolean;

  /** Whether the current user can cancel this order */
  canCancel: boolean;

  /** Timeline of all approval actions taken so far */
  timeline: ApprovalRecord[];

  /** Next expected status if approved */
  nextStatusOnApprove: OrderStatus | null;

  /** Status the order will transition to if rejected */
  statusOnReject: OrderStatus.REJECTED;
}

// ---------------------------------------------------------------------------
// 10. Error Response Types
// ---------------------------------------------------------------------------

/** Business error codes returned by the approval API. */
export enum ApprovalErrorCode {
  /** Attempted an illegal state transition (HTTP 409) */
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',

  /** Optimistic lock conflict – version mismatch (HTTP 409) */
  OPTIMISTIC_LOCK_CONFLICT = 'OPTIMISTIC_LOCK_CONFLICT',

  /** Missing or empty rejectionReason on reject (HTTP 400) */
  REJECTION_REASON_REQUIRED = 'REJECTION_REASON_REQUIRED',

  /** Rejection reason exceeds 500 characters (HTTP 400) */
  REJECTION_REASON_TOO_LONG = 'REJECTION_REASON_TOO_LONG',

  /** Current user lacks permission for this approval action (HTTP 403) */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** Work order not found (HTTP 404) */
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
}

/**
 * Standard error response body from the approval API.
 */
export interface ApprovalErrorResponse {
  /** Machine-readable error code */
  code: ApprovalErrorCode | string;

  /** Human-readable error message */
  message: string;

  /** ISO 8601 timestamp of the error */
  timestamp: string;

  /** Optional field-level validation errors */
  fieldErrors?: Array<{
    field: string;
    message: string;
    rejectedValue?: unknown;
  }>;
}

// ---------------------------------------------------------------------------
// 11. Role Types for Data Isolation
// ---------------------------------------------------------------------------

/** User roles relevant to the approval workflow. */
export enum ApprovalRole {
  /** 部门主管 – can approve at LEVEL_1 */
  DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER',

  /** 资产管理员 – can approve at LEVEL_2 */
  ASSET_ADMIN = 'ASSET_ADMIN',

  /** 普通用户 – can only create/view own orders */
  USER = 'USER',
}

/**
 * Mapping from role to the approval statuses they are allowed to see
 * in the pending approval list.
 */
export const ROLE_VISIBLE_STATUSES: Record<ApprovalRole, OrderStatus[]> = {
  [ApprovalRole.DEPARTMENT_MANAGER]: [OrderStatus.APPROVING_LEVEL_1],
  [ApprovalRole.ASSET_ADMIN]: [OrderStatus.APPROVING_LEVEL_2],
  [ApprovalRole.USER]: [],
};

// ---------------------------------------------------------------------------
// 12. Utility / Helper Types
// ---------------------------------------------------------------------------

/**
 * Type guard: checks if a value is a valid OrderStatus.
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

/**
 * Type guard: checks if a value is a valid ApprovalAction.
 */
export function isApprovalAction(value: string): value is ApprovalAction {
  return Object.values(ApprovalAction).includes(value as ApprovalAction);
}

/**
 * Derives the approval level from a given order status.
 * Returns `null` for non-approving statuses.
 */
export function getApprovalLevel(status: OrderStatus): ApprovalLevel | null {
  switch (status) {
    case OrderStatus.APPROVING_LEVEL_1:
      return ApprovalLevel.LEVEL_1;
    case OrderStatus.APPROVING_LEVEL_2:
      return ApprovalLevel.LEVEL_2;
    default:
      return null;
  }
}

/**
 * Returns the next status after a successful approval at the current level.
 * Returns `null` if the status is not an approving status.
 */
export function getNextStatusOnApprove(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case OrderStatus.APPROVING_LEVEL_1:
      return OrderStatus.APPROVING_LEVEL_2;
    case OrderStatus.APPROVING_LEVEL_2:
      return OrderStatus.APPROVED;
    default:
      return null;
  }
}

/**
 * Validates a rejection reason string.
 * Returns an error message if invalid, or `null` if valid.
 */
export function validateRejectionReason(reason: string): string | null {
  if (!reason || reason.trim().length === 0) {
    return '驳回原因不能为空';
  }
  if (reason.length > 500) {
    return '驳回原因不能超过 500 个字符';
  }
  return null;
}