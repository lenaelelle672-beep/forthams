/**
 * useApprovalPermission
 *
 * Composable that encapsulates approval permission logic for the two-level
 * approval workflow (Department Manager → Asset Manager).
 *
 * Role-to-level mapping:
 *   - DEPT_MANAGER  → APPROVING_LEVEL_1
 *   - ASSET_MANAGER → APPROVING_LEVEL_2
 *
 * The composable exposes reactive permission flags and helpers so that
 * UI components (ApprovalList, ApprovalDetail, action buttons) can
 * conditionally render approve/reject controls without duplicating
 * role/status checks throughout the view layer.
 */

import { computed, type Ref } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Approval-related user roles recognised by the permission layer. */
export type ApprovalRole = 'DEPT_MANAGER' | 'ASSET_MANAGER';

/** All possible work-order statuses relevant to the approval flow. */
export type ApprovalOrderStatus =
  | 'PENDING'
  | 'APPROVING_LEVEL_1'
  | 'APPROVING_LEVEL_2'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/** Minimal shape of a work order consumed by permission checks. */
export interface ApprovalOrder {
  id: string | number;
  status: ApprovalOrderStatus;
  /** Optional – used for optimistic-lock conflict detection. */
  version?: number;
}

/** Minimal shape of the current user consumed by permission checks. */
export interface ApprovalUser {
  id: string | number;
  roles: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Mapping from approval role to the order status that role is allowed to act on.
 * A DEPT_MANAGER can only act on APPROVING_LEVEL_1 orders.
 * An ASSET_MANAGER can only act on APPROVING_LEVEL_2 orders.
 */
const ROLE_TO_STATUS: Record<ApprovalRole, ApprovalOrderStatus> = {
  DEPT_MANAGER: 'APPROVING_LEVEL_1',
  ASSET_MANAGER: 'APPROVING_LEVEL_2',
};

/** Terminal statuses – no approval actions are permitted. */
const TERMINAL_STATUSES: ReadonlySet<ApprovalOrderStatus> = new Set<
  ApprovalOrderStatus
>(['APPROVED', 'REJECTED', 'CANCELLED']);

/** Statuses that represent an active approval step. */
const APPROVAL_STATUSES: ReadonlySet<ApprovalOrderStatus> = new Set<
  ApprovalOrderStatus
>(['APPROVING_LEVEL_1', 'APPROVING_LEVEL_2']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the highest-priority approval role from a list of user roles.
 *
 * Priority order: ASSET_MANAGER > DEPT_MANAGER.
 * Returns `null` when the user has no approval-related role.
 */
export function resolveApprovalRole(userRoles: string[]): ApprovalRole | null {
  if (userRoles.includes('ASSET_MANAGER')) {
    return 'ASSET_MANAGER';
  }
  if (userRoles.includes('DEPT_MANAGER')) {
    return 'DEPT_MANAGER';
  }
  return null;
}

/**
 * Check whether a given status is an active approval step.
 */
export function isApprovalStatus(
  status: ApprovalOrderStatus,
): status is 'APPROVING_LEVEL_1' | 'APPROVING_LEVEL_2' {
  return APPROVAL_STATUSES.has(status);
}

/**
 * Check whether a given status is terminal (no further transitions allowed).
 */
export function isTerminalStatus(status: ApprovalOrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Determine whether a user with the given role can act on an order in the
 * given status.
 *
 * The user can act when:
 * 1. They hold an approval role, AND
 * 2. The order status matches the status mapped to their role.
 */
export function canActOnOrder(
  userRoles: string[],
  orderStatus: ApprovalOrderStatus,
): boolean {
  const role = resolveApprovalRole(userRoles);
  if (!role) {
    return false;
  }
  return ROLE_TO_STATUS[role] === orderStatus;
}

/**
 * Determine whether a user can approve an order.
 * Alias for `canActOnOrder` – kept for semantic clarity in call-sites.
 */
export function canApprove(
  userRoles: string[],
  orderStatus: ApprovalOrderStatus,
): boolean {
  return canActOnOrder(userRoles, orderStatus);
}

/**
 * Determine whether a user can reject an order.
 * Rejection is allowed under the same conditions as approval.
 */
export function canReject(
  userRoles: string[],
  orderStatus: ApprovalOrderStatus,
): boolean {
  return canActOnOrder(userRoles, orderStatus);
}

/**
 * Return the approval level (1 or 2) that corresponds to the given status,
 * or `null` if the status is not an approval step.
 */
export function getApprovalLevel(
  status: ApprovalOrderStatus,
): 1 | 2 | null {
  if (status === 'APPROVING_LEVEL_1') return 1;
  if (status === 'APPROVING_LEVEL_2') return 2;
  return null;
}

/**
 * Filter a list of orders to only those visible to a user with the given roles.
 *
 * Per the data-isolation constraint:
 * - DEPT_MANAGER  → only APPROVING_LEVEL_1 orders
 * - ASSET_MANAGER → only APPROVING_LEVEL_2 orders
 * - Other roles    → empty list (no approval visibility)
 */
export function filterOrdersByRole<T extends ApprovalOrder>(
  orders: T[],
  userRoles: string[],
): T[] {
  const role = resolveApprovalRole(userRoles);
  if (!role) {
    return [];
  }
  const targetStatus = ROLE_TO_STATUS[role];
  return orders.filter((order) => order.status === targetStatus);
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface UseApprovalPermissionOptions {
  /** The current authenticated user (reactive ref or plain object). */
  user: Ref<ApprovalUser> | ApprovalUser;
  /** The work order being inspected (reactive ref or plain object). */
  order: Ref<ApprovalOrder | null | undefined> | ApprovalOrder | null | undefined;
}

export interface UseApprovalPermissionReturn {
  /** The resolved approval role for the current user, or `null`. */
  approvalRole: computed<ApprovalRole | null>;
  /** The approval level (1 or 2) the current user is responsible for, or `null`. */
  approvalLevel: computed<1 | 2 | null>;
  /** Whether the current user can approve the current order. */
  canApproveOrder: computed<boolean>;
  /** Whether the current user can reject the current order. */
  canRejectOrder: computed<boolean>;
  /** Whether the current order is in an active approval step. */
  isOrderInApproval: computed<boolean>;
  /** Whether the current order has reached a terminal status. */
  isOrderTerminal: computed<boolean>;
  /** Whether the current user has any approval role at all. */
  hasApprovalRole: computed<boolean>;
  /**
   * Filter a list of orders to only those the current user is allowed to see.
   * Useful for the pending-approval list page.
   */
  filterVisibleOrders: <T extends ApprovalOrder>(orders: T[]) => T[];
}

/**
 * Reactively compute approval permissions for the given user and order.
 *
 * @example
 * ```tsx
 * const { canApproveOrder, canRejectOrder, approvalLevel } = useApprovalPermission({
 *   user: currentUser,
 *   order: selectedOrder,
 * });
 *
 * return (
 *   <>
 *     {canApproveOrder.value && <ApproveButton onClick={handleApprove} />}
 *     {canRejectOrder.value && <RejectButton onClick={handleReject} />}
 *   </>
 * );
 * ```
 */
export function useApprovalPermission(
  options: UseApprovalPermissionOptions,
): UseApprovalPermissionReturn {
  // Unwrap refs so the composable works with both reactive and plain values.
  const unwrapUser = (): ApprovalUser =>
    'value' in options.user ? options.user.value : options.user;

  const unwrapOrder = (): ApprovalOrder | null | undefined =>
    'value' in options.order ? options.order.value : options.order;

  const approvalRole = computed<ApprovalRole | null>(() => {
    const user = unwrapUser();
    return resolveApprovalRole(user?.roles ?? []);
  });

  const approvalLevel = computed<1 | 2 | null>(() => {
    const role = approvalRole.value;
    if (!role) return null;
    return role === 'DEPT_MANAGER' ? 1 : 2;
  });

  const canApproveOrder = computed<boolean>(() => {
    const user = unwrapUser();
    const order = unwrapOrder();
    if (!user || !order) return false;
    return canApprove(user.roles, order.status);
  });

  const canRejectOrder = computed<boolean>(() => {
    const user = unwrapUser();
    const order = unwrapOrder();
    if (!user || !order) return false;
    return canReject(user.roles, order.status);
  });

  const isOrderInApproval = computed<boolean>(() => {
    const order = unwrapOrder();
    if (!order) return false;
    return isApprovalStatus(order.status);
  });

  const isOrderTerminal = computed<boolean>(() => {
    const order = unwrapOrder();
    if (!order) return false;
    return isTerminalStatus(order.status);
  });

  const hasApprovalRole = computed<boolean>(() => {
    return approvalRole.value !== null;
  });

  const filterVisibleOrders = <T extends ApprovalOrder>(orders: T[]): T[] => {
    const user = unwrapUser();
    return filterOrdersByRole(orders, user?.roles ?? []);
  };

  return {
    approvalRole,
    approvalLevel,
    canApproveOrder,
    canRejectOrder,
    isOrderInApproval,
    isOrderTerminal,
    hasApprovalRole,
    filterVisibleOrders,
  };
}

export default useApprovalPermission;