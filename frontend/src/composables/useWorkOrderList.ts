/**
 * useWorkOrderList
 *
 * Composable for fetching, filtering, and managing work order lists
 * with multi-level approval support.
 *
 * Role-based data isolation:
 *   - DEPT_MANAGER  → only sees APPROVING_LEVEL_1 orders
 *   - ASSET_MANAGER → only sees APPROVING_LEVEL_2 orders
 *   - ADMIN         → sees all orders
 *
 * Provides reactive state for the list, pagination, filtering,
 * and approval/rejection actions that integrate with the backend
 * state machine (PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED,
 * any approval node → REJECTED, CANCELLED).
 */

import { ref, computed, watch, type Ref } from 'react';
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderListParams,
  PaginatedResponse,
  ApprovalActionRequest,
  RejectRequest,
} from '../types/workorder.types';
import { workOrderApi } from '../api/workorder';
import { useAuth } from '../composables/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sort direction for list queries. */
export type SortDirection = 'asc' | 'desc';

/** Sortable fields on the work order list. */
export type WorkOrderSortField = 'orderNo' | 'applicantName' | 'submittedAt' | 'status';

/** Filter criteria exposed to consumers. */
export interface WorkOrderListFilter {
  /** Restrict to specific statuses. When empty, role-based defaults apply. */
  statuses?: WorkOrderStatus[];
  /** Free-text search across order number and applicant name. */
  keyword?: string;
  /** Sort field. */
  sortBy?: WorkOrderSortField;
  /** Sort direction. */
  sortDir?: SortDirection;
}

/** Return type of the composable. */
export interface UseWorkOrderListReturn {
  /** Current page of work orders. */
  orders: Ref<WorkOrder[]>;
  /** Total count across all pages. */
  total: Ref<number>;
  /** Whether a fetch is in progress. */
  loading: Ref<boolean>;
  /** Last error message (null when no error). */
  error: Ref<string | null>;
  /** Current page number (1-based). */
  page: Ref<number>;
  /** Page size. */
  pageSize: Ref<number>;
  /** Active filter criteria. */
  filter: Ref<WorkOrderListFilter>;
  /** Computed statuses derived from the current user's role. */
  roleStatuses: Ref<WorkOrderStatus[]>;
  /** Fetch / re-fetch the current page. */
  refresh: () => Promise<void>;
  /** Move to a specific page. */
  goToPage: (p: number) => Promise<void>;
  /** Update filter criteria and reset to page 1. */
  setFilter: (patch: Partial<WorkOrderListFilter>) => Promise<void>;
  /** Approve a work order by ID. */
  approve: (orderId: string) => Promise<boolean>;
  /** Reject a work order by ID with a mandatory reason. */
  reject: (orderId: string, rejectionReason: string) => Promise<boolean>;
  /** Whether an approve/reject action is in flight. */
  actionLoading: Ref<boolean>;
  /** Total number of pages. */
  totalPages: Ref<number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;

/**
 * Map user roles to the approval statuses they are allowed to view.
 * Enforces data isolation per SPEC boundary constraint #5.
 */
const ROLE_STATUS_MAP: Record<string, WorkOrderStatus[]> = {
  DEPT_MANAGER: ['APPROVING_LEVEL_1'],
  ASSET_MANAGER: ['APPROVING_LEVEL_2'],
  ADMIN: [
    'PENDING',
    'APPROVING_LEVEL_1',
    'APPROVING_LEVEL_2',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
  ],
};

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Provides reactive work order list management with role-based filtering,
 * pagination, and approval/rejection actions.
 *
 * @param initialFilter - Optional initial filter overrides.
 * @returns {@link UseWorkOrderListReturn}
 */
export function useWorkOrderList(
  initialFilter?: Partial<WorkOrderListFilter>,
): UseWorkOrderListReturn {
  // ---- Reactive state ----
  const orders = ref<WorkOrder[]>([]) as Ref<WorkOrder[]>;
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const page = ref(1);
  const pageSize = ref(DEFAULT_PAGE_SIZE);
  const actionLoading = ref(false);
  const filter = ref<WorkOrderListFilter>({
    statuses: undefined,
    keyword: undefined,
    sortBy: 'submittedAt',
    sortDir: 'desc',
    ...initialFilter,
  });

  // ---- Auth context (for role-based filtering) ----
  const auth = useAuth();

  /**
   * Derive the allowed statuses based on the current user's role.
   * Falls back to an empty array when the role is unknown.
   */
  const roleStatuses = computed<WorkOrderStatus[]>(() => {
    const role = auth?.user?.role;
    if (!role) return [];
    return ROLE_STATUS_MAP[role] ?? [];
  });

  /** Total pages derived from total count and page size. */
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(total.value / pageSize.value)),
  );

  // ---- Effective statuses for API query ----
  const effectiveStatuses = computed<WorkOrderStatus[] | undefined>(() => {
    // If the consumer explicitly set statuses, use those.
    if (filter.value.statuses && filter.value.statuses.length > 0) {
      return filter.value.statuses;
    }
    // Otherwise fall back to role-based defaults.
    return roleStatuses.value.length > 0 ? roleStatuses.value : undefined;
  });

  // ---- Fetch logic ----

  /**
   * Build the query parameters from current state and fetch one page
   * of work orders from the backend.
   */
  async function fetchPage(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const params: WorkOrderListParams = {
        page: page.value,
        pageSize: pageSize.value,
        statuses: effectiveStatuses.value,
        keyword: filter.value.keyword || undefined,
        sortBy: filter.value.sortBy,
        sortDir: filter.value.sortDir,
      };

      const response: PaginatedResponse<WorkOrder> =
        await workOrderApi.list(params);

      orders.value = response.items ?? [];
      total.value = response.total ?? 0;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch work orders';
      error.value = message;
      orders.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  }

  /** Public refresh helper – re-fetches the current page. */
  async function refresh(): Promise<void> {
    await fetchPage();
  }

  /** Navigate to a specific page (1-based, clamped to valid range). */
  async function goToPage(p: number): Promise<void> {
    const clamped = Math.max(1, Math.min(p, totalPages.value));
    if (clamped === page.value) return;
    page.value = clamped;
    await fetchPage();
  }

  /**
   * Merge filter criteria and reset pagination to page 1.
   * Triggers a fresh fetch with the updated filter.
   */
  async function setFilter(patch: Partial<WorkOrderListFilter>): Promise<void> {
    filter.value = { ...filter.value, ...patch };
    page.value = 1;
    await fetchPage();
  }

  // ---- Approval actions ----

  /**
   * Submit an approval for the given work order.
   *
   * On success the list is automatically refreshed so the approved
   * order disappears from the current role's pending view.
   *
   * @param orderId - The work order to approve.
   * @returns `true` on success, `false` on failure.
   */
  async function approve(orderId: string): Promise<boolean> {
    actionLoading.value = true;
    error.value = null;

    try {
      const payload: ApprovalActionRequest = { orderId };
      await workOrderApi.approve(payload);
      // Refresh list so the approved order disappears from the view.
      await fetchPage();
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Approval failed';
      error.value = message;
      return false;
    } finally {
      actionLoading.value = false;
    }
  }

  /**
   * Reject a work order with a mandatory rejection reason.
   *
   * The rejection reason is validated client-side (non-empty, max 500 chars)
   * before sending the request, matching the backend constraint.
   *
   * @param orderId - The work order to reject.
   * @param rejectionReason - Mandatory reason for rejection (1–500 chars).
   * @returns `true` on success, `false` on failure.
   * @throws {Error} If `rejectionReason` is empty or exceeds 500 characters.
   */
  async function reject(
    orderId: string,
    rejectionReason: string,
  ): Promise<boolean> {
    // Client-side validation mirrors backend constraint (SPEC #3).
    const trimmed = (rejectionReason ?? '').trim();
    if (trimmed.length === 0) {
      throw new Error('Rejection reason is required');
    }
    if (trimmed.length > 500) {
      throw new Error('Rejection reason must not exceed 500 characters');
    }

    actionLoading.value = true;
    error.value = null;

    try {
      const payload: RejectRequest = {
        orderId,
        rejectionReason: trimmed,
      };
      await workOrderApi.reject(payload);
      // Refresh list so the rejected order disappears from the view.
      await fetchPage();
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Rejection failed';
      error.value = message;
      return false;
    } finally {
      actionLoading.value = false;
    }
  }

  // ---- Initial fetch & watchers ----

  // Fetch on mount.
  fetchPage();

  // Re-fetch when the user role changes (e.g. after login).
  watch(
    () => auth?.user?.role,
    () => {
      page.value = 1;
      fetchPage();
    },
  );

  return {
    orders,
    total,
    loading,
    error,
    page,
    pageSize,
    filter,
    roleStatuses,
    refresh,
    goToPage,
    setFilter,
    approve,
    reject,
    actionLoading,
    totalPages,
  };
}

export default useWorkOrderList;