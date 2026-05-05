/**
 * approvalStore.ts
 *
 * Zustand store for the multi-level approval workflow (Phase 1: Core approval flow & basic workbench).
 *
 * State machine (enforced server-side):
 *   PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
 *   Any approval node → REJECTED   (requires rejectionReason)
 *   Any non-terminal  → CANCELLED
 *
 * Role-based visibility:
 *   DEPARTMENT_MANAGER  → sees APPROVING_LEVEL_1 orders
 *   ASSET_MANAGER       → sees APPROVING_LEVEL_2 orders
 *
 * Error handling:
 *   - 409 Conflict → INVALID_STATE_TRANSITION or optimistic-lock version mismatch
 *   - 400 Bad Request → missing / invalid rejectionReason
 */

import { create } from 'zustand';
import type {
  ApprovalRecord,
  ApprovalListItem,
  ApprovalDetail,
  ApproveRequest,
  RejectRequest,
  OrderStatus,
  ApprovalAction,
  ApprovalFilterParams,
  PaginatedResponse,
  ApiError,
} from '../types/approval';
import { approvalApi } from '../api/approval';

// ---------------------------------------------------------------------------
// Store State Shape
// ---------------------------------------------------------------------------

/** Pending approval list state. */
interface PendingListState {
  /** Items currently displayed in the pending-approval list. */
  items: ApprovalListItem[];
  /** Total number of items matching the current filter (for pagination). */
  total: number;
  /** Current page number (1-based). */
  page: number;
  /** Page size. */
  pageSize: number;
  loading: boolean;
  error: string | null;
}

/** Approval detail state for a single work order. */
interface DetailState {
  /** The work-order detail currently being viewed. */
  detail: ApprovalDetail | null;
  /** Chronological approval records for the current order. */
  records: ApprovalRecord[];
  loading: boolean;
  error: string | null;
}

/** State for approve / reject mutation operations. */
interface ActionState {
  /** Whether an approve or reject request is in-flight. */
  loading: boolean;
  /** Human-readable error from the last action (null when idle / success). */
  error: string | null;
}

/** Polling control state. */
interface PollingState {
  /** Interval handle returned by setInterval (null when not polling). */
  intervalId: ReturnType<typeof setInterval> | null;
  /** Polling interval in milliseconds. */
  intervalMs: number;
}

// ---------------------------------------------------------------------------
// Combined Store State
// ---------------------------------------------------------------------------

export interface ApprovalState {
  // -- Pending list --------------------------------------------------------
  pendingList: PendingListState;

  // -- Detail view ---------------------------------------------------------
  detail: DetailState;

  // -- Mutation (approve / reject) -----------------------------------------
  action: ActionState;

  // -- Polling -------------------------------------------------------------
  polling: PollingState;

  // -- Current user role (set after login) --------------------------------
  currentRole: 'DEPARTMENT_MANAGER' | 'ASSET_MANAGER' | null;

  // -- Actions / Thunks ----------------------------------------------------
  /** Fetch the pending-approval list for the current user's role. */
  fetchPendingList: (params?: Partial<ApprovalFilterParams>) => Promise<void>;
  /** Reset the pending list to page 1 and re-fetch. */
  resetAndFetchPendingList: (params?: Partial<ApprovalFilterParams>) => Promise<void>;
  /** Fetch detail + approval records for a specific work order. */
  fetchDetail: (orderId: string) => Promise<void>;
  /** Clear the currently loaded detail. */
  clearDetail: () => void;
  /** Approve the given work order (optimistic-lock aware). */
  approve: (orderId: string, version: number) => Promise<boolean>;
  /** Reject the given work order with a mandatory reason. */
  reject: (orderId: string, version: number, rejectionReason: string) => Promise<boolean>;
  /** Cancel the given work order. */
  cancel: (orderId: string, version: number) => Promise<boolean>;
  /** Clear the action error. */
  clearActionError: () => void;
  /** Set the current user role (called after auth). */
  setCurrentRole: (role: 'DEPARTMENT_MANAGER' | 'ASSET_MANAGER' | null) => void;
  /** Start polling the pending list at the configured interval. */
  startPolling: (params?: Partial<ApprovalFilterParams>) => void;
  /** Stop polling the pending list. */
  stopPolling: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map the current user role to the order status they are allowed to approve. */
function roleToStatus(
  role: 'DEPARTMENT_MANAGER' | 'ASSET_MANAGER' | null,
): OrderStatus | null {
  switch (role) {
    case 'DEPARTMENT_MANAGER':
      return 'APPROVING_LEVEL_1';
    case 'ASSET_MANAGER':
      return 'APPROVING_LEVEL_2';
    default:
      return null;
  }
}

/** Validate that a rejection reason is non-empty and within the 500-char limit. */
function validateRejectionReason(reason: string): string | null {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length === 0) {
    return '驳回原因不能为空';
  }
  if (trimmed.length > 500) {
    return '驳回原因不能超过 500 个字符';
  }
  return null; // valid
}

/** Classify an API error into a user-friendly message. */
function classifyError(err: unknown): string {
  const apiErr = err as ApiError | undefined;
  if (!apiErr) return '未知错误';

  if (apiErr.response) {
    const { status, data } = apiErr.response;

    if (status === 409) {
      // Could be INVALID_STATE_TRANSITION or optimistic-lock conflict.
      const code = data?.code ?? data?.error ?? '';
      if (typeof code === 'string' && code.includes('INVALID_STATE_TRANSITION')) {
        return '状态流转不合法，该工单可能已被其他审批人处理';
      }
      return '数据冲突，该工单可能已被其他审批人处理，请刷新后重试';
    }

    if (status === 400) {
      const msg = data?.message ?? data?.error ?? '';
      if (typeof msg === 'string' && msg.length > 0) {
        return msg;
      }
      return '请求参数不合法';
    }

    if (status === 401) {
      return '登录已过期，请重新登录';
    }

    if (status === 403) {
      return '您没有执行此操作的权限';
    }

    return `服务器错误 (${status})`;
  }

  if (apiErr.message) {
    return apiErr.message;
  }

  return '网络异常，请稍后重试';
}

// ---------------------------------------------------------------------------
// Store Implementation
// ---------------------------------------------------------------------------

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  // -- Initial state -------------------------------------------------------

  pendingList: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    loading: false,
    error: null,
  },

  detail: {
    detail: null,
    records: [],
    loading: false,
    error: null,
  },

  action: {
    loading: false,
    error: null,
  },

  polling: {
    intervalId: null,
    intervalMs: 15_000, // 15 seconds default polling interval
  },

  currentRole: null,

  // -- Actions -------------------------------------------------------------

  fetchPendingList: async (params?: Partial<ApprovalFilterParams>) => {
    const { currentRole, pendingList } = get();
    const status = params?.status ?? roleToStatus(currentRole);

    if (!status) {
      set((s) => ({
        pendingList: { ...s.pendingList, error: '无法确定当前用户角色，无法加载待审批列表' },
      }));
      return;
    }

    set((s) => ({
      pendingList: { ...s.pendingList, loading: true, error: null },
    }));

    try {
      const response: PaginatedResponse<ApprovalListItem> = await approvalApi.getPendingList({
        status,
        page: params?.page ?? pendingList.page,
        pageSize: params?.pageSize ?? pendingList.pageSize,
        ...params,
      });

      set((s) => ({
        pendingList: {
          ...s.pendingList,
          items: response.items ?? response.content ?? [],
          total: response.total ?? response.totalElements ?? 0,
          page: params?.page ?? s.pendingList.page,
          loading: false,
        },
      }));
    } catch (err) {
      set((s) => ({
        pendingList: {
          ...s.pendingList,
          loading: false,
          error: classifyError(err),
        },
      }));
    }
  },

  resetAndFetchPendingList: async (params?: Partial<ApprovalFilterParams>) => {
    set((s) => ({
      pendingList: { ...s.pendingList, page: 1, items: [], total: 0, error: null },
    }));
    await get().fetchPendingList({ ...params, page: 1 });
  },

  fetchDetail: async (orderId: string) => {
    set((s) => ({
      detail: { ...s.detail, loading: true, error: null },
    }));

    try {
      const [detailRes, recordsRes] = await Promise.all([
        approvalApi.getDetail(orderId),
        approvalApi.getRecords(orderId),
      ]);

      set((s) => ({
        detail: {
          detail: detailRes,
          records: recordsRes ?? [],
          loading: false,
        },
      }));
    } catch (err) {
      set((s) => ({
        detail: {
          ...s.detail,
          loading: false,
          error: classifyError(err),
        },
      }));
    }
  },

  clearDetail: () => {
    set((s) => ({
      detail: { detail: null, records: [], loading: false, error: null },
    }));
  },

  approve: async (orderId: string, version: number): Promise<boolean> => {
    set((s) => ({ action: { loading: true, error: null } }));

    try {
      const request: ApproveRequest = { orderId, version };
      await approvalApi.approve(request);

      // On success, refresh the pending list so the approved item disappears.
      await get().fetchPendingList();

      set((s) => ({ action: { loading: false, error: null } }));
      return true;
    } catch (err) {
      const message = classifyError(err);
      set((s) => ({ action: { loading: false, error: message } }));
      return false;
    }
  },

  reject: async (
    orderId: string,
    version: number,
    rejectionReason: string,
  ): Promise<boolean> => {
    // Client-side validation first (spec: rejectionReason is required, max 500 chars).
    const validationError = validateRejectionReason(rejectionReason);
    if (validationError) {
      set((s) => ({ action: { loading: false, error: validationError } }));
      return false;
    }

    set((s) => ({ action: { loading: true, error: null } }));

    try {
      const request: RejectRequest = {
        orderId,
        version,
        rejectionReason: rejectionReason.trim(),
      };
      await approvalApi.reject(request);

      // On success, refresh the pending list so the rejected item disappears.
      await get().fetchPendingList();

      set((s) => ({ action: { loading: false, error: null } }));
      return true;
    } catch (err) {
      const message = classifyError(err);
      set((s) => ({ action: { loading: false, error: message } }));
      return false;
    }
  },

  cancel: async (orderId: string, version: number): Promise<boolean> => {
    set((s) => ({ action: { loading: true, error: null } }));

    try {
      await approvalApi.cancel(orderId, version);

      // Refresh pending list after cancellation.
      await get().fetchPendingList();

      set((s) => ({ action: { loading: false, error: null } }));
      return true;
    } catch (err) {
      const message = classifyError(err);
      set((s) => ({ action: { loading: false, error: message } }));
      return false;
    }
  },

  clearActionError: () => {
    set((s) => ({ action: { ...s.action, error: null } }));
  },

  setCurrentRole: (role) => {
    set({ currentRole: role });
  },

  startPolling: (params?: Partial<ApprovalFilterParams>) => {
    const { polling } = get();

    // Avoid duplicate intervals.
    if (polling.intervalId !== null) {
      return;
    }

    // Fetch immediately on start.
    get().fetchPendingList(params);

    const id = setInterval(() => {
      get().fetchPendingList(params);
    }, polling.intervalMs);

    set((s) => ({
      polling: { ...s.polling, intervalId: id },
    }));
  },

  stopPolling: () => {
    const { polling } = get();
    if (polling.intervalId !== null) {
      clearInterval(polling.intervalId);
    }
    set((s) => ({
      polling: { ...s.polling, intervalId: null },
    }));
  },
}));

export default useApprovalStore;