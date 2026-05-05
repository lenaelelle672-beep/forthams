/**
 * approvalStore.ts
 *
 * Pinia store for the multi-level approval workflow (Phase 1: Core Approval Flow & Basic Workbench).
 *
 * Supports:
 *  - Two-level approval: Department Manager (Level 1) → Asset Manager (Level 2).
 *  - State machine: PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED,
 *    with REJECTED and CANCELLED terminal states.
 *  - Role-based data isolation: department managers see only APPROVING_LEVEL_1 orders,
 *    asset managers see only APPROVING_LEVEL_2 orders.
 *  - Approval record persistence (operator, action, timestamp, rejection reason).
 *  - Optimistic locking via `version` field.
 *  - Rejection reason validation (non-empty, max 500 characters).
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  ApprovalOrder,
  ApprovalRecord,
  ApprovalAction,
  OrderStatus,
  ApprovalListParams,
  ApprovalListResponse,
  ApprovalDetailResponse,
  ApproveRequest,
  RejectRequest,
  ApiError,
} from '@/types/approval';
import { approvalApi } from '@/api/approval';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed length for rejection reason (matches backend constraint). */
export const MAX_REJECTION_REASON_LENGTH = 500;

/** All possible order statuses in the state machine. */
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  APPROVING_LEVEL_1: 'APPROVING_LEVEL_1',
  APPROVING_LEVEL_2: 'APPROVING_LEVEL_2',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

/** Terminal states — no further transitions allowed. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  ORDER_STATUS.APPROVED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CANCELLED,
]);

/** Role → visible approval status mapping for data isolation. */
export const ROLE_STATUS_MAP: Readonly<Record<string, OrderStatus>> = {
  DEPARTMENT_MANAGER: ORDER_STATUS.APPROVING_LEVEL_1,
  ASSET_MANAGER: ORDER_STATUS.APPROVING_LEVEL_2,
};

/** Human-readable status labels (zh-CN). */
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  [ORDER_STATUS.PENDING]: '待提交',
  [ORDER_STATUS.APPROVING_LEVEL_1]: '部门主管审批中',
  [ORDER_STATUS.APPROVING_LEVEL_2]: '资产管理员审批中',
  [ORDER_STATUS.APPROVED]: '已通过',
  [ORDER_STATUS.REJECTED]: '已驳回',
  [ORDER_STATUS.CANCELLED]: '已取消',
};

// ---------------------------------------------------------------------------
// Store Definition
// ---------------------------------------------------------------------------

export const useApprovalStore = defineStore('approval', () => {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** List of pending approval orders returned by the API. */
  const pendingOrders = ref<ApprovalOrder[]>([]);

  /** Total count of pending orders (for pagination). */
  const pendingTotal = ref<number>(0);

  /** Currently selected order for the detail view. */
  const currentOrder = ref<ApprovalOrder | null>(null);

  /** Approval history records for the current order. */
  const approvalRecords = ref<ApprovalRecord[]>([]);

  /** The current user's role (set after login / route guard). */
  const currentUserRole = ref<string>('');

  /** Loading flags. */
  const loadingList = ref(false);
  const loadingDetail = ref(false);
  const loadingAction = ref(false);

  /** Last error encountered (null when no error). */
  const error = ref<ApiError | null>(null);

  /** Pagination state. */
  const currentPage = ref<number>(1);
  const pageSize = ref<number>(10);

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  /**
   * Returns the approval status that the current user's role is allowed to see.
   * Falls back to `null` when the role is not recognised.
   */
  const visibleStatus = computed<OrderStatus | null>(() => {
    return ROLE_STATUS_MAP[currentUserRole.value] ?? null;
  });

  /**
   * Whether the store is currently performing any async operation.
   */
  const isLoading = computed<boolean>(() => {
    return loadingList.value || loadingDetail.value || loadingAction.value;
  });

  /**
   * Whether the current order can be approved by the logged-in user.
   * An order is approvable when:
   *  - There is a current order loaded.
   *  - The order is in a non-terminal state.
   *  - The order's current status matches the user's role-visible status.
   */
  const canApprove = computed<boolean>(() => {
    if (!currentOrder.value) return false;
    if (TERMINAL_STATUSES.has(currentOrder.value.status)) return false;
    return currentOrder.value.status === visibleStatus.value;
  });

  /**
   * Whether the current order can be rejected by the logged-in user.
   * Same conditions as `canApprove`.
   */
  const canReject = computed<boolean>(() => {
    return canApprove.value;
  });

  /**
   * Whether the current order can be cancelled by the applicant.
   * Only orders in PENDING or APPROVING_LEVEL_1 status can be cancelled.
   */
  const canCancel = computed<boolean>(() => {
    if (!currentOrder.value) return false;
    return (
      currentOrder.value.status === ORDER_STATUS.PENDING ||
      currentOrder.value.status === ORDER_STATUS.APPROVING_LEVEL_1
    );
  });

  /**
   * Human-readable label for the current order's status.
   */
  const currentStatusLabel = computed<string>(() => {
    if (!currentOrder.value) return '';
    return STATUS_LABELS[currentOrder.value.status] ?? currentOrder.value.status;
  });

  /**
   * The latest approval record (most recent action).
   */
  const latestRecord = computed<ApprovalRecord | null>(() => {
    if (approvalRecords.value.length === 0) return null;
    return approvalRecords.value[approvalRecords.value.length - 1];
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Clear the global error state.
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Set the global error state from an unknown thrown value.
   */
  function setError(err: unknown): void {
    if (err && typeof err === 'object' && 'response' in err) {
      error.value = err as ApiError;
    } else if (err instanceof Error) {
      error.value = {
        message: err.message,
        code: 'UNKNOWN_ERROR',
      } as ApiError;
    } else {
      error.value = {
        message: String(err),
        code: 'UNKNOWN_ERROR',
      } as ApiError;
    }
  }

  /**
   * Validate the rejection reason.
   * @returns An error message if invalid, or `null` if valid.
   */
  function validateRejectionReason(reason: string): string | null {
    if (!reason || reason.trim().length === 0) {
      return '驳回原因不能为空';
    }
    if (reason.length > MAX_REJECTION_REASON_LENGTH) {
      return `驳回原因不能超过 ${MAX_REJECTION_REASON_LENGTH} 个字符`;
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /**
   * Set the current user's role. Should be called after authentication.
   * @param role - The role identifier (e.g. 'DEPARTMENT_MANAGER', 'ASSET_MANAGER').
   */
  function setUserRole(role: string): void {
    currentUserRole.value = role;
  }

  /**
   * Fetch the list of pending approval orders for the current user's role.
   *
   * The API endpoint enforces role-based data isolation server-side:
   * - DEPARTMENT_MANAGER → only APPROVING_LEVEL_1 orders.
   * - ASSET_MANAGER → only APPROVING_LEVEL_2 orders.
   *
   * @param params - Optional query parameters (page, pageSize, etc.).
   */
  async function fetchPendingOrders(params?: Partial<ApprovalListParams>): Promise<void> {
    loadingList.value = true;
    clearError();

    try {
      const queryParams: ApprovalListParams = {
        page: params?.page ?? currentPage.value,
        pageSize: params?.pageSize ?? pageSize.value,
        status: visibleStatus.value ?? undefined,
        ...params,
      };

      const response: ApprovalListResponse = await approvalApi.getPendingOrders(queryParams);

      pendingOrders.value = response.items ?? response.data ?? [];
      pendingTotal.value = response.total ?? pendingOrders.value.length;

      if (params?.page !== undefined) {
        currentPage.value = params.page;
      }
    } catch (err: unknown) {
      setError(err);
      pendingOrders.value = [];
      pendingTotal.value = 0;
    } finally {
      loadingList.value = false;
    }
  }

  /**
   * Fetch the detail of a specific order, including its approval records.
   *
   * @param orderId - The unique identifier of the work order.
   */
  async function fetchOrderDetail(orderId: string): Promise<void> {
    loadingDetail.value = true;
    clearError();

    try {
      const response: ApprovalDetailResponse = await approvalApi.getOrderDetail(orderId);

      currentOrder.value = response.order ?? response;
      approvalRecords.value = response.records ?? response.approvalRecords ?? [];
    } catch (err: unknown) {
      setError(err);
      currentOrder.value = null;
      approvalRecords.value = [];
    } finally {
      loadingDetail.value = false;
    }
  }

  /**
   * Approve the current order (or a specified order by ID).
   *
   * Sends POST `/api/orders/{id}/approve` to the backend.
   * The backend state machine validates the transition; invalid transitions
   * return HTTP 409 with error code `INVALID_STATE_TRANSITION`.
   * Optimistic locking is enforced via the `version` field.
   *
   * @param orderId - Optional order ID. Defaults to `currentOrder.id`.
   * @param version - The expected version for optimistic locking.
   * @returns `true` if the approval succeeded.
   * @throws Error on failure (also stored in `error`).
   */
  async function approveOrder(orderId?: string, version?: number): Promise<boolean> {
    const targetId = orderId ?? currentOrder.value?.id;
    const targetVersion = version ?? currentOrder.value?.version;

    if (!targetId) {
      const msg = '无法审批：未选中任何工单';
      error.value = { message: msg, code: 'NO_ORDER_SELECTED' } as ApiError;
      return false;
    }

    loadingAction.value = true;
    clearError();

    try {
      const payload: ApproveRequest = {
        version: targetVersion,
      };

      await approvalApi.approveOrder(targetId, payload);

      // Refresh the detail to get updated status and records.
      await fetchOrderDetail(targetId);

      // Refresh the list so the approved order disappears from pending.
      await fetchPendingOrders();

      return true;
    } catch (err: unknown) {
      setError(err);
      return false;
    } finally {
      loadingAction.value = false;
    }
  }

  /**
   * Reject the current order (or a specified order by ID).
   *
   * Sends POST `/api/orders/{id}/reject` to the backend with a mandatory
   * `rejectionReason`. The backend validates:
   *  - `rejectionReason` is non-empty (HTTP 400 if missing).
   *  - State transition is valid (HTTP 409 if invalid).
   *  - Optimistic lock via `version` (HTTP 409 on conflict).
   *
   * Frontend validation is performed first to provide immediate feedback.
   *
   * @param rejectionReason - The reason for rejection (1–500 characters).
   * @param orderId - Optional order ID. Defaults to `currentOrder.id`.
   * @param version - The expected version for optimistic locking.
   * @returns `true` if the rejection succeeded.
   * @throws Error on validation failure or API error.
   */
  async function rejectOrder(
    rejectionReason: string,
    orderId?: string,
    version?: number,
  ): Promise<boolean> {
    // --- Frontend validation ---
    const validationError = validateRejectionReason(rejectionReason);
    if (validationError) {
      error.value = {
        message: validationError,
        code: 'VALIDATION_ERROR',
      } as ApiError;
      return false;
    }

    const targetId = orderId ?? currentOrder.value?.id;
    const targetVersion = version ?? currentOrder.value?.version;

    if (!targetId) {
      const msg = '无法驳回：未选中任何工单';
      error.value = { message: msg, code: 'NO_ORDER_SELECTED' } as ApiError;
      return false;
    }

    loadingAction.value = true;
    clearError();

    try {
      const payload: RejectRequest = {
        rejectionReason: rejectionReason.trim(),
        version: targetVersion,
      };

      await approvalApi.rejectOrder(targetId, payload);

      // Refresh detail and list.
      await fetchOrderDetail(targetId);
      await fetchPendingOrders();

      return true;
    } catch (err: unknown) {
      setError(err);
      return false;
    } finally {
      loadingAction.value = false;
    }
  }

  /**
   * Cancel the current order (applicant-initiated cancellation).
   *
   * @param orderId - Optional order ID. Defaults to `currentOrder.id`.
   * @param version - The expected version for optimistic locking.
   * @returns `true` if cancellation succeeded.
   */
  async function cancelOrder(orderId?: string, version?: number): Promise<boolean> {
    const targetId = orderId ?? currentOrder.value?.id;
    const targetVersion = version ?? currentOrder.value?.version;

    if (!targetId) {
      const msg = '无法取消：未选中任何工单';
      error.value = { message: msg, code: 'NO_ORDER_SELECTED' } as ApiError;
      return false;
    }

    loadingAction.value = true;
    clearError();

    try {
      await approvalApi.cancelOrder(targetId, { version: targetVersion });

      await fetchOrderDetail(targetId);
      await fetchPendingOrders();

      return true;
    } catch (err: unknown) {
      setError(err);
      return false;
    } finally {
      loadingAction.value = false;
    }
  }

  /**
   * Reset the store to its initial state.
   * Useful when the user logs out or navigates away from the approval module.
   */
  function $reset(): void {
    pendingOrders.value = [];
    pendingTotal.value = 0;
    currentOrder.value = null;
    approvalRecords.value = [];
    currentUserRole.value = '';
    loadingList.value = false;
    loadingDetail.value = false;
    loadingAction.value = false;
    error.value = null;
    currentPage.value = 1;
    pageSize.value = 10;
  }

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    // State
    pendingOrders,
    pendingTotal,
    currentOrder,
    approvalRecords,
    currentUserRole,
    loadingList,
    loadingDetail,
    loadingAction,
    error,
    currentPage,
    pageSize,

    // Getters
    visibleStatus,
    isLoading,
    canApprove,
    canReject,
    canCancel,
    currentStatusLabel,
    latestRecord,

    // Actions
    clearError,
    setError,
    validateRejectionReason,
    setUserRole,
    fetchPendingOrders,
    fetchOrderDetail,
    approveOrder,
    rejectOrder,
    cancelOrder,
    $reset,
  };
});