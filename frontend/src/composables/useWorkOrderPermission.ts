/**
 * useWorkOrderPermission
 *
 * Composable that encapsulates all work-order permission & state-machine
 * guard logic for the multi-level approval workflow.
 *
 * Supported status flow (enforced server-side, mirrored client-side):
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   Any approval node → REJECTED  (requires rejectionReason)
 *   Non-terminal → CANCELLED
 *
 * Role-based data isolation:
 *   DEPARTMENT_MANAGER  → only sees APPROVING_LEVEL_1 orders
 *   ASSET_MANAGER       → only sees APPROVING_LEVEL_2 orders
 */

import { computed, type Ref } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Work-order statuses that participate in the approval state machine. */
export enum WorkOrderStatus {
  PENDING = 'PENDING',
  APPROVING_LEVEL_1 = 'APPROVING_LEVEL_1',
  APPROVING_LEVEL_2 = 'APPROVING_LEVEL_2',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** User roles relevant to the approval workflow. */
export enum ApprovalRole {
  DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER',
  ASSET_MANAGER = 'ASSET_MANAGER',
}

/** Minimal shape of a work order consumed by permission helpers. */
export interface WorkOrderLike {
  id: string | number;
  status: WorkOrderStatus;
  /** Optimistic-lock version – included in approve/reject payloads. */
  version: number;
  /** The user who submitted the order (used for cancel permission). */
  applicantId?: string | number;
}

/** Minimal shape of the current authenticated user. */
export interface CurrentUser {
  id: string | number;
  roles: ApprovalRole[];
}

/** Actions that can be performed on a work order. */
export type WorkOrderAction = 'approve' | 'reject' | 'cancel' | 'view';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum length for a rejection reason (mirrors backend validation). */
export const REJECTION_REASON_MAX_LENGTH = 500;

/**
 * Mapping of which status each role is allowed to approve.
 * This enforces the "no skip-level approval" constraint.
 */
const ROLE_APPROVAL_STATUS: Record<ApprovalRole, WorkOrderStatus> = {
  [ApprovalRole.DEPARTMENT_MANAGER]: WorkOrderStatus.APPROVING_LEVEL_1,
  [ApprovalRole.ASSET_MANAGER]: WorkOrderStatus.APPROVING_LEVEL_2,
};

/**
 * Statuses from which a rejection is allowed.
 * Any active approval node can be rejected.
 */
const REJECTABLE_STATUSES: ReadonlySet<WorkOrderStatus> = new Set([
  WorkOrderStatus.APPROVING_LEVEL_1,
  WorkOrderStatus.APPROVING_LEVEL_2,
]);

/**
 * Statuses from which the order can be cancelled by the applicant.
 */
const CANCELLABLE_STATUSES: ReadonlySet<WorkOrderStatus> = new Set([
  WorkOrderStatus.PENDING,
  WorkOrderStatus.APPROVING_LEVEL_1,
  WorkOrderStatus.APPROVING_LEVEL_2,
]);

/** Terminal statuses – no further transitions allowed. */
const TERMINAL_STATUSES: ReadonlySet<WorkOrderStatus> = new Set([
  WorkOrderStatus.APPROVED,
  WorkOrderStatus.REJECTED,
  WorkOrderStatus.CANCELLED,
]);

/**
 * Mapping of statuses that each role should see in the pending-approval list.
 * Enforces data isolation: each role only sees orders at their approval level.
 */
const ROLE_VISIBLE_STATUSES: Record<ApprovalRole, ReadonlySet<WorkOrderStatus>> = {
  [ApprovalRole.DEPARTMENT_MANAGER]: new Set([WorkOrderStatus.APPROVING_LEVEL_1]),
  [ApprovalRole.ASSET_MANAGER]: new Set([WorkOrderStatus.APPROVING_LEVEL_2]),
};

// ---------------------------------------------------------------------------
// Pure helper functions (exported for unit-testing)
// ---------------------------------------------------------------------------

/**
 * Determine whether a given role can approve a work order in the given status.
 * Prevents cross-level approval (e.g. PENDING → APPROVING_LEVEL_2).
 *
 * @param role  - The user's approval role.
 * @param status - The current work-order status.
 * @returns `true` if the role is authorised to approve at this status.
 */
export function canApprove(role: ApprovalRole, status: WorkOrderStatus): boolean {
  return ROLE_APPROVAL_STATUS[role] === status;
}

/**
 * Determine whether a given role can reject a work order in the given status.
 * Rejection is allowed from any active approval node that the role owns.
 *
 * @param role  - The user's approval role.
 * @param status - The current work-order status.
 * @returns `true` if the role is authorised to reject at this status.
 */
export function canReject(role: ApprovalRole, status: WorkOrderStatus): boolean {
  return REJECTABLE_STATUSES.has(status) && ROLE_APPROVAL_STATUS[role] === status;
}

/**
 * Determine whether the given user (as the original applicant) can cancel
 * the work order.
 *
 * @param userId    - The current user's id.
 * @param applicantId - The work-order applicant's id.
 * @param status    - The current work-order status.
 * @returns `true` if the user is the applicant and the order is cancellable.
 */
export function canCancel(
  userId: string | number,
  applicantId: string | number | undefined,
  status: WorkOrderStatus,
): boolean {
  if (applicantId === undefined) return false;
  return String(userId) === String(applicantId) && CANCELLABLE_STATUSES.has(status);
}

/**
 * Check whether a work order is in a terminal (no further transitions) state.
 *
 * @param status - The current work-order status.
 * @returns `true` if the status is terminal.
 */
export function isTerminal(status: WorkOrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Validate a rejection reason string.
 * Returns an error message if invalid, or `null` if valid.
 *
 * @param reason - The rejection reason to validate.
 * @returns A human-readable error message, or `null` when valid.
 */
export function validateRejectionReason(reason: string | null | undefined): string | null {
  if (!reason || reason.trim().length === 0) {
    return '驳回原因不能为空';
  }
  if (reason.length > REJECTION_REASON_MAX_LENGTH) {
    return `驳回原因不能超过 ${REJECTION_REASON_MAX_LENGTH} 个字符`;
  }
  return null;
}

/**
 * Determine which statuses a role is allowed to see in the approval list.
 *
 * @param role - The user's approval role.
 * @returns Set of statuses visible to the role.
 */
export function getVisibleStatuses(role: ApprovalRole): ReadonlySet<WorkOrderStatus> {
  return ROLE_VISIBLE_STATUSES[role] ?? new Set();
}

/**
 * Compute the set of actions available to a user on a specific work order.
 *
 * @param user  - The current authenticated user.
 * @param order - The work order to evaluate.
 * @returns Array of actions the user may perform.
 */
export function computeAvailableActions(
  user: CurrentUser,
  order: WorkOrderLike,
): WorkOrderAction[] {
  const actions: WorkOrderAction[] = ['view'];

  for (const role of user.roles) {
    if (canApprove(role, order.status)) {
      actions.push('approve');
    }
    if (canReject(role, order.status)) {
      actions.push('reject');
    }
  }

  if (canCancel(user.id, order.applicantId, order.status)) {
    actions.push('cancel');
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface UseWorkOrderPermissionOptions {
  /** Reactive reference to the current authenticated user. */
  user: Ref<CurrentUser>;
  /** Reactive reference to the work order being inspected. */
  workOrder: Ref<WorkOrderLike | null>;
}

export interface UseWorkOrderPermissionReturn {
  /** Whether the current user can approve the work order. */
  canApproveOrder: Ref<boolean>;
  /** Whether the current user can reject the work order. */
  canRejectOrder: Ref<boolean>;
  /** Whether the current user can cancel the work order. */
  canCancelOrder: Ref<boolean>;
  /** Whether the work order is in a terminal state. */
  isOrderTerminal: Ref<boolean>;
  /** All actions available to the current user on this work order. */
  availableActions: Ref<WorkOrderAction[]>;
  /** The statuses the current user should see in the approval list. */
  visibleStatuses: Ref<ReadonlySet<WorkOrderStatus>>;
  /**
   * Validate a rejection reason.
   * @param reason - The reason text to validate.
   * @returns An error message string or `null` when valid.
   */
  validateReason: (reason: string | null | undefined) => string | null;
}

/**
 * React composable that exposes reactive permission flags for a work order
 * based on the current user's roles and the order's status.
 *
 * @example
 * ```tsx
 * const { canApproveOrder, canRejectOrder, validateReason } = useWorkOrderPermission({
 *   user: currentUserRef,
 *   workOrder: orderRef,
 * });
 *
 * if (canRejectOrder.value) {
 *   const error = validateReason('');
 *   // error === '驳回原因不能为空'
 * }
 * ```
 */
export function useWorkOrderPermission(
  options: UseWorkOrderPermissionOptions,
): UseWorkOrderPermissionReturn {
  const { user, workOrder } = options;

  /** Whether any of the user's roles can approve at the current status. */
  const canApproveOrder = computed<boolean>(() => {
    const order = workOrder.value;
    if (!order) return false;
    return user.value.roles.some((role) => canApprove(role, order.status));
  });

  /** Whether any of the user's roles can reject at the current status. */
  const canRejectOrder = computed<boolean>(() => {
    const order = workOrder.value;
    if (!order) return false;
    return user.value.roles.some((role) => canReject(role, order.status));
  });

  /** Whether the user (as applicant) can cancel the order. */
  const canCancelOrder = computed<boolean>(() => {
    const order = workOrder.value;
    if (!order) return false;
    return canCancel(user.value.id, order.applicantId, order.status);
  });

  /** Whether the order is in a terminal state. */
  const isOrderTerminal = computed<boolean>(() => {
    const order = workOrder.value;
    if (!order) return false;
    return isTerminal(order.status);
  });

  /** All actions the current user may perform on the work order. */
  const availableActions = computed<WorkOrderAction[]>(() => {
    const order = workOrder.value;
    if (!order) return ['view'];
    return computeAvailableActions(user.value, order);
  });

  /**
   * The statuses the current user is allowed to see in the approval list.
   * If the user has multiple roles, the union of all visible statuses is returned.
   */
  const visibleStatuses = computed<ReadonlySet<WorkOrderStatus>>(() => {
    const union = new Set<WorkOrderStatus>();
    for (const role of user.value.roles) {
      for (const s of getVisibleStatuses(role)) {
        union.add(s);
      }
    }
    return union;
  });

  return {
    canApproveOrder,
    canRejectOrder,
    canCancelOrder,
    isOrderTerminal,
    availableActions,
    visibleStatuses,
    validateReason: validateRejectionReason,
  };
}

export default useWorkOrderPermission;