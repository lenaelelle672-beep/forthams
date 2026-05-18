/**
 * @module frontend/src/app/services/approval/types
 * @description Approval service type definitions.
 *
 * Defines the TypeScript types for the approval workflow SDK, including:
 * - ApprovalItem: a single approval process with its metadata and history
 * - ApprovalHistoryItem: an individual approval record (approve/reject action)
 * - ApprovalAction: parameters for submitting an approval decision
 * - ApprovalStatus / ApprovalType: enum-like unions for status and type fields
 * - PaginatedResult: generic pagination wrapper
 */

// ---------------------------------------------------------------------------
// Enums / Unions
// ---------------------------------------------------------------------------

/** Possible statuses of an approval process. */
export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

/** Supported approval process types. */
export type ApprovalType =
  | 'RETIREMENT'
  | 'WORK_ORDER'
  | 'ASSET_TRANSFER'
  | 'ASSET_CLEARANCE'
  | 'ASSET_SCRAP'
  | 'ASSET_COMPENSATION';

/** Approval decision result values. */
export type ApprovalResult = 'APPROVED' | 'REJECTED';

// ---------------------------------------------------------------------------
// Core Domain Types
// ---------------------------------------------------------------------------

/**
 * A single approval history record attached to a process.
 *
 * Maps to `ApprovalRecord` in the backend (approval_record table).
 */
export interface ApprovalHistoryItem {
  /** Unique record identifier */
  id: number;
  /** The approval process this record belongs to */
  processId: number;
  /** Step number in the multi-level approval chain (1-based) */
  stepNo: number;
  /** ID of the user who performed the approval action */
  operator: number;
  /** Result of this approval step: APPROVED or REJECTED */
  status: ApprovalResult;
  /** Timestamp when the approval action was performed */
  operatedAt: string;
  /** Optional comment / opinion provided by the approver */
  comment: string;
}

/**
 * Represents a single approval process (approval_process table).
 *
 * Combines the core process fields with its full approval history.
 */
export interface ApprovalItem {
  /** Unique process identifier */
  id: number;
  /** Auto-generated process number (e.g. APR-20250511-001) */
  processNo: string;
  /** Type of the approval process */
  type: ApprovalType;
  /** Business record ID associated with the process */
  businessId?: number | null;
  /** Short description parsed from business payload */
  businessSummary?: string;
  /** Raw business payload JSON for detail rendering */
  businessData?: string | null;
  /** ID of the user who submitted the approval request */
  applicant: number;
  /** Current status of the approval */
  status: ApprovalStatus;
  /** Current step in the multi-level approval chain */
  currentStep: number;
  /** Timestamp when the process was created */
  createdAt: string;
  /** Timestamp when the process was last updated */
  updatedAt: string;
  /** Full approval history for this process */
  history: ApprovalHistoryItem[];
}

/**
 * Parameters for submitting an approval decision (approve or reject).
 */
export interface ApprovalAction {
  /** The approval process ID to act on */
  approvalId: number;
  /** The decision: APPROVED or REJECTED */
  action: ApprovalResult;
  /** Optional comment / opinion (required when rejecting) */
  comment: string;
}

// ---------------------------------------------------------------------------
// API Request / Response Types
// ---------------------------------------------------------------------------

/** Query parameters for listing approval processes. */
export interface ApprovalListParams {
  /** Page number (1-based) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Filter by status */
  status?: ApprovalStatus;
  /** Filter by process type */
  processType?: ApprovalType;
  /** Keyword search */
  keyword?: string;
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResult<T> {
  /** Array of items for the current page */
  records: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  current: number;
  /** Page size */
  size: number;
}

/** Response shape for GET /approvals/{id} — process + records. */
export interface ApprovalDetailResponse {
  /** The approval process */
  process: ApprovalItem;
  /** Chronological approval records */
  records: ApprovalHistoryItem[];
}
