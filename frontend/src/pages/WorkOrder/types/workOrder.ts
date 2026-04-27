/**
 * Work Order & Multi-Level Approval Type Definitions
 *
 * Supports the two-level approval workflow:
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * with REJECTED and CANCELLED terminal states.
 *
 * All date fields follow ISO 8601 format.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Work order lifecycle status.
 *
 * Forward flow:  PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 * Reverse flow:  Any approval level → REJECTED (requires rejectionReason)
 * Cancellation:  PENDING / any approval level → CANCELLED
 */
export enum WorkOrderStatus {
  /** Initial state after creation / submission. */
  PENDING = 'PENDING',
  /** Awaiting Level-1 (department manager) approval. */
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  /** Awaiting Level-2 (asset administrator) approval. */
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  /** Fully approved – terminal state. */
  APPROVED = 'APPROVED',
  /** Rejected by an approver – terminal state. */
  REJECTED = 'REJECTED',
  /** Cancelled by the applicant – terminal state. */
  CANCELLED = 'CANCELLED',
}

/**
 * Human-readable labels mapped to each WorkOrderStatus value.
 * Useful for UI rendering without maintaining a separate i18n layer.
 */
export const WorkOrderStatusLabel: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.PENDING]: '待提交',
  [WorkOrderStatus.APPROVING_LEVEL_1]: '一级审批中',
  [WorkOrderStatus.APPROVING_LEVEL_2]: '二级审批中',
  [WorkOrderStatus.APPROVED]: '已通过',
  [WorkOrderStatus.REJECTED]: '已驳回',
  [WorkOrderStatus.CANCELLED]: '已取消',
};

/**
 * Approval level identifiers used for role-based data isolation.
 * - Department managers see only LEVEL_1 orders.
 * - Asset administrators see only LEVEL_2 orders.
 */
export enum ApprovalLevel {
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
}

/**
 * The action performed by an approver on a work order.
 */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

/**
 * Business error codes returned by the backend approval API.
 */
export enum ApprovalErrorCode {
  /** Attempted an illegal state transition (e.g. PENDING → APPROVING_LEVEL_2). */
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  /** Optimistic lock conflict – another user updated the order concurrently. */
  OPTIMISTIC_LOCK_CONFLICT = 'OPTIMISTIC_LOCK_CONFLICT',
  /** Missing or empty rejectionReason on a reject request. */
  MISSING_REJECTION_REASON = 'MISSING_REJECTION_REASON',
  /** The current user does not have permission for this approval action. */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** The target work order was not found. */
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
}

// ---------------------------------------------------------------------------
// Core Domain Interfaces
// ---------------------------------------------------------------------------

/**
 * Represents a single work order entity returned by the backend.
 */
export interface WorkOrder {
  /** Unique identifier. */
  id: string;
  /** Human-readable order number (e.g. "WO-2025-0001"). */
  orderNo: string;
  /** Order title / summary. */
  title: string;
  /** Detailed description of the work order. */
  description: string;
  /** ID of the user who created the order. */
  applicantId: string;
  /** Display name of the applicant. */
  applicantName: string;
  /** Department of the applicant. */
  department: string;
  /** Current lifecycle status. */
  status: WorkOrderStatus;
  /**
   * Optimistic-lock version field.
   * Must be sent back on approve/reject requests to prevent concurrent conflicts.
   */
  version: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-update timestamp. */
  updatedAt: string;
  /** Rejection reason – populated only when status is REJECTED. */
  rejectionReason: string | null;
  /** Whether this order is flagged as critical / high-priority. */
  isCritical: boolean;
}

/**
 * A single approval record persisted in the `approval_records` table.
 */
export interface ApprovalRecord {
  /** Unique record identifier. */
  id: string;
  /** The work order this record belongs to. */
  orderId: string;
  /** ID of the operator (approver) who performed the action. */
  operatorId: string;
  /** Display name of the operator. */
  operatorName: string;
  /** Role of the operator at the time of action. */
  operatorRole: string;
  /** The action taken (APPROVE or REJECT). */
  action: ApprovalAction;
  /** Approval level at which this action was taken. */
  approvalLevel: ApprovalLevel;
  /** Optional comment / note from the approver. */
  comment: string | null;
  /** Rejection reason – required when action is REJECT, max 500 chars. */
  rejectionReason: string | null;
  /** ISO 8601 timestamp of the action. */
  actionTime: string;
}

// ---------------------------------------------------------------------------
// API Request Types
// ---------------------------------------------------------------------------

/**
 * Payload for POST /api/orders/{id}/approve.
 */
export interface ApproveRequest {
  /**
   * Optimistic-lock version.
   * Must match the current version on the server; otherwise HTTP 409 is returned.
   */
  version: number;
  /** Optional approval comment. */
  comment?: string;
}

/**
 * Payload for POST /api/orders/{id}/reject.
 */
export interface RejectRequest {
  /**
   * Optimistic-lock version.
   * Must match the current version on the server; otherwise HTTP 409 is returned.
   */
  version: number;
  /**
   * Mandatory rejection reason.
   * - Non-empty string, max 500 characters.
   * - Missing or empty → HTTP 400 Bad Request.
   */
  rejectionReason: string;
  /** Optional additional comment. */
  comment?: string;
}

/**
 * Payload for POST /api/orders/{id}/cancel.
 */
export interface CancelRequest {
  /** Optimistic-lock version. */
  version: number;
  /** Optional cancellation reason. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

/**
 * Standard paginated list response wrapper.
 */
export interface PaginatedResponse<T> {
  /** List of items in the current page. */
  items: T[];
  /** Total number of items across all pages. */
  total: number;
  /** Current page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Total number of pages. */
  totalPages: number;
}

/**
 * Response returned after a successful approve / reject / cancel action.
 */
export interface ApprovalActionResponse {
  /** The updated work order entity. */
  workOrder: WorkOrder;
  /** The approval record that was created for this action. */
  approvalRecord: ApprovalRecord;
}

/**
 * Detailed work order view that includes its full approval history.
 */
export interface WorkOrderDetail extends WorkOrder {
  /** Chronological list of all approval records for this order. */
  approvalRecords: ApprovalRecord[];
}

// ---------------------------------------------------------------------------
// Query / Filter Types
// ---------------------------------------------------------------------------

/**
 * Query parameters for fetching the approval list (role-filtered).
 *
 * - Department managers (LEVEL_1) only see APPROVING_LEVEL_1 orders.
 * - Asset administrators (LEVEL_2) only see APPROVING_LEVEL_2 orders.
 */
export interface ApprovalListQuery {
  /** Current approval level (determined by the logged-in user's role). */
  approvalLevel: ApprovalLevel;
  /** 1-based page number. Defaults to 1. */
  page?: number;
  /** Items per page. Defaults to 10. */
  pageSize?: number;
  /** Optional keyword search across orderNo, title, applicantName. */
  keyword?: string;
  /** Optional filter by specific status. */
  status?: WorkOrderStatus;
  /** Optional filter by applicant department. */
  department?: string;
  /** Optional start of date range (ISO 8601). */
  startDate?: string;
  /** Optional end of date range (ISO 8601). */
  endDate?: string;
  /** Sort field. Defaults to 'createdAt'. */
  sortBy?: 'createdAt' | 'updatedAt' | 'orderNo';
  /** Sort direction. Defaults to 'desc'. */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Query parameters for fetching the applicant's own work order list.
 */
export interface WorkOrderListQuery {
  /** 1-based page number. */
  page?: number;
  /** Items per page. */
  pageSize?: number;
  /** Filter by status. */
  status?: WorkOrderStatus;
  /** Keyword search. */
  keyword?: string;
  /** Sort field. */
  sortBy?: 'createdAt' | 'updatedAt' | 'orderNo';
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Structured error response returned by the backend on approval failures.
 */
export interface ApprovalErrorResponse {
  /** HTTP status code (mirrored for client-side handling). */
  statusCode: number;
  /** Machine-readable business error code. */
  errorCode: ApprovalErrorCode;
  /** Human-readable error message. */
  message: string;
  /** Optional additional details (e.g. current status, expected transitions). */
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// UI / Component Props Types
// ---------------------------------------------------------------------------

/**
 * Props for the approval action buttons (Approve / Reject).
 */
export interface ApprovalActionProps {
  /** The work order being acted upon. */
  workOrder: WorkOrder;
  /** Whether an API request is in progress. */
  loading?: boolean;
  /** Callback invoked after a successful approve action. */
  onApprove?: (response: ApprovalActionResponse) => void;
  /** Callback invoked after a successful reject action. */
  onReject?: (response: ApprovalActionResponse) => void;
  /** Callback invoked when an error occurs. */
  onError?: (error: ApprovalErrorResponse) => void;
}

/**
 * Props for the rejection reason dialog / form.
 */
export interface RejectionDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Callback to close the dialog without submitting. */
  onClose: () => void;
  /** Callback invoked with the entered rejection reason on confirm. */
  onConfirm: (rejectionReason: string) => void;
  /** Whether a submission is in progress. */
  loading?: boolean;
  /** Maximum character length for the rejection reason. Defaults to 500. */
  maxLength?: number;
}

/**
 * Status badge display configuration.
 */
export interface StatusBadgeConfig {
  /** The status value. */
  status: WorkOrderStatus;
  /** Human-readable label. */
  label: string;
  /** CSS color variant for the badge. */
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
}

/**
 * Mapping from WorkOrderStatus to badge display configuration.
 */
export const WorkOrderStatusBadgeMap: Record<WorkOrderStatus, StatusBadgeConfig> = {
  [WorkOrderStatus.PENDING]: {
    status: WorkOrderStatus.PENDING,
    label: WorkOrderStatusLabel[WorkOrderStatus.PENDING],
    variant: 'default',
  },
  [WorkOrderStatus.APPROVING_LEVEL_1]: {
    status: WorkOrderStatus.APPROVING_LEVEL_1,
    label: WorkOrderStatusLabel[WorkOrderStatus.APPROVING_LEVEL_1],
    variant: 'primary',
  },
  [WorkOrderStatus.APPROVING_LEVEL_2]: {
    status: WorkOrderStatus.APPROVING_LEVEL_2,
    label: WorkOrderStatusLabel[WorkOrderStatus.APPROVING_LEVEL_2],
    variant: 'warning',
  },
  [WorkOrderStatus.APPROVED]: {
    status: WorkOrderStatus.APPROVED,
    label: WorkOrderStatusLabel[WorkOrderStatus.APPROVED],
    variant: 'success',
  },
  [WorkOrderStatus.REJECTED]: {
    status: WorkOrderStatus.REJECTED,
    label: WorkOrderStatusLabel[WorkOrderStatus.REJECTED],
    variant: 'danger',
  },
  [WorkOrderStatus.CANCELLED]: {
    status: WorkOrderStatus.CANCELLED,
    label: WorkOrderStatusLabel[WorkOrderStatus.CANCELLED],
    variant: 'secondary',
  },
};

// ---------------------------------------------------------------------------
// Utility Types
// ---------------------------------------------------------------------------

/**
 * Set of terminal (non-transitionable) statuses.
 */
export const TERMINAL_STATUSES: ReadonlySet<WorkOrderStatus> = new Set([
  WorkOrderStatus.APPROVED,
  WorkOrderStatus.REJECTED,
  WorkOrderStatus.CANCELLED,
]);

/**
 * Set of statuses that are currently in an approval pipeline.
 */
export const APPROVAL_PENDING_STATUSES: ReadonlySet<WorkOrderStatus> = new Set([
  WorkOrderStatus.APPROVING_LEVEL_1,
  WorkOrderStatus.APPROVING_LEVEL_2,
]);

/**
 * Type guard: checks whether a work order is in a terminal state.
 */
export function isTerminalStatus(status: WorkOrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Type guard: checks whether a work order is awaiting approval at any level.
 */
export function isAwaitingApproval(status: WorkOrderStatus): boolean {
  return APPROVAL_PENDING_STATUSES.has(status);
}

/**
 * Determines the approval level for a given work order status.
 * Returns undefined if the status is not an approval-pending status.
 */
export function getApprovalLevel(
  status: WorkOrderStatus,
): ApprovalLevel | undefined {
  switch (status) {
    case WorkOrderStatus.APPROVING_LEVEL_1:
      return ApprovalLevel.LEVEL_1;
    case WorkOrderStatus.APPROVING_LEVEL_2:
      return ApprovalLevel.LEVEL_2;
    default:
      return undefined;
  }
}

/**
 * Maximum allowed length for rejection reason (matches backend constraint).
 */
export const REJECTION_REASON_MAX_LENGTH = 500;