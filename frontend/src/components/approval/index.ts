/**
 * Approval Workbench Components
 *
 * Barrel export for the multi-level approval workbench module.
 * Provides components for the two-tier approval flow:
 *   Level 1 – Department Manager (APPROVING_LEVEL_1)
 *   Level 2 – Asset Administrator (APPROVING_LEVEL_2)
 *
 * State machine flow:
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   Any approval node → REJECTED (requires mandatory rejection reason)
 *   Any non-terminal state → CANCELLED
 *
 * @module components/approval
 */

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export { ApprovalList } from './ApprovalList';
export { ApprovalDetail } from './ApprovalDetail';
export { ApprovalActions } from './ApprovalActions';
export { RejectDialog } from './RejectDialog';
export { ApprovalStatusBadge } from './ApprovalStatusBadge';
export { ApprovalRecordTimeline } from './ApprovalRecordTimeline';

// ---------------------------------------------------------------------------
// Composables / hooks
// ---------------------------------------------------------------------------

export { useApprovalPermission } from '../../composables/useApprovalPermission';
export { useApprovalBinding } from '../../composables/useApprovalBinding';

// ---------------------------------------------------------------------------
// Types re-exports (convenience)
// ---------------------------------------------------------------------------

export type {
  ApprovalRecord,
  ApprovalAction,
  ApprovalStatus,
  ApprovalListQuery,
  ApprovalListResponse,
  ApproveRequest,
  RejectRequest,
  ApprovalDetailResponse,
} from '../../types/approval';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Mapping from approval status enum values to display labels.
 * Used by `ApprovalStatusBadge` and `ApprovalList` for rendering.
 */
export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: '待提交',
  APPROVING_LEVEL_1: '一级审批中',
  APPROVING_LEVEL_2: '二级审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
} as const;

/**
 * Mapping from approval status enum values to semantic colour tokens.
 * Consumed by `ApprovalStatusBadge` to apply the correct visual treatment.
 */
export const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'default',
  APPROVING_LEVEL_1: 'processing',
  APPROVING_LEVEL_2: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'warning',
} as const;

/**
 * Maximum allowed length for a rejection reason (matches backend validation).
 * @see RejectDialog – input maxLength prop
 */
export const REJECTION_REASON_MAX_LENGTH = 500;

/**
 * API error codes returned by the backend approval endpoints.
 * Used for client-side error handling and user-facing messages.
 */
export const APPROVAL_ERROR_CODES = {
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  OPTIMISTIC_LOCK_CONFLICT: 'OPTIMISTIC_LOCK_CONFLICT',
  REJECTION_REASON_REQUIRED: 'REJECTION_REASON_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;