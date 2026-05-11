/**
 * @module frontend/src/app/stores/approvalStore
 * @description Approval store using React Context for simple state management.
 *
 * Manages the following state:
 * - pendingApprovals: list of pending approval items
 * - currentApproval: the currently selected approval with its full history
 * - isLoading: global loading flag
 *
 * Actions:
 * - fetchPendingApprovals: loads pending approvals from API
 * - approve: approves a process and refreshes the list
 * - reject: rejects a process and refreshes the list
 * - getApprovalHistory: loads detail + history for a specific process
 * - subscribe: starts polling for pending approval updates
 * - unsubscribe: stops polling
 *
 * Uses React Context + useState for lightweight state management
 * (no external state libraries required, consistent with project patterns).
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  createElement,
  type ReactNode,
} from 'react';
import type {
  ApprovalItem,
  ApprovalHistoryItem,
} from '../services/approval/types';
import {
  fetchPendingApprovals as apiFetchPending,
  approve as apiApprove,
  reject as apiReject,
  getApprovalHistory as apiGetHistory,
} from '../services/approval/api';
import { ApprovalServiceError, createValidationError } from '../services/approval/errors';

// ---------------------------------------------------------------------------
// Store State Shape
// ---------------------------------------------------------------------------

/** State managed by the approval store. */
export interface ApprovalState {
  /** List of pending approvals for the current user */
  pendingApprovals: ApprovalItem[];
  /** Currently selected approval with full detail & history */
  currentApproval: ApprovalItem | null;
  /** Approval history for the currently selected process */
  currentHistory: ApprovalHistoryItem[];
  /** Global loading indicator */
  isLoading: boolean;
  /** Last error encountered (null when no error) */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Store Actions
// ---------------------------------------------------------------------------

/** Actions exposed by the approval store. */
export interface ApprovalActions {
  /** Fetch the list of pending approvals */
  fetchPendingApprovals: () => Promise<void>;
  /** Approve a process by ID */
  approve: (processId: number, opinion?: string) => Promise<boolean>;
  /** Reject a process by ID (opinion is required) */
  reject: (processId: number, opinion: string) => Promise<boolean>;
  /** Load the full history for a specific process */
  getApprovalHistory: (processId: number) => Promise<void>;
  /** Start polling for pending approvals at the given interval (ms) */
  subscribe: (intervalMs?: number) => void;
  /** Stop polling */
  unsubscribe: () => void;
  /** Clear the current error */
  clearError: () => void;
  /** Clear the currently selected approval */
  clearCurrent: () => void;
}

// ---------------------------------------------------------------------------
// Combined Store Type
// ---------------------------------------------------------------------------

export type ApprovalStore = ApprovalState & ApprovalActions;

// ---------------------------------------------------------------------------
// Default State
// ---------------------------------------------------------------------------

const DEFAULT_STATE: ApprovalState = {
  pendingApprovals: [],
  currentApproval: null,
  currentHistory: [],
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ApprovalStoreContext = createContext<ApprovalStore | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Approval store provider component.
 *
 * Wrap your component tree with this provider to access the approval store:
 *
 * @example
 * ```tsx
 * <ApprovalStoreProvider>
 *   <ApprovalPage />
 * </ApprovalStoreProvider>
 * ```
 */
export function ApprovalStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ApprovalState>(DEFAULT_STATE);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /** Clear the current error */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /** Clear the currently selected approval */
  const clearCurrent = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentApproval: null,
      currentHistory: [],
    }));
  }, []);

  /** Fetch pending approvals from the API */
  const fetchPendingApprovals = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const items = await apiFetchPending();
      setState((prev) => ({
        ...prev,
        pendingApprovals: items,
        isLoading: false,
      }));
    } catch (err) {
      const message =
        err instanceof ApprovalServiceError
          ? err.message
          : '获取待审批列表失败';
      setState((prev) => ({
        ...prev,
        pendingApprovals: [],
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  /** Approve an approval process */
  const approveAction = useCallback(
    async (processId: number, opinion: string = ''): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await apiApprove(processId, opinion);
        // Refresh the pending list after approval
        const items = await apiFetchPending();
        setState((prev) => ({
          ...prev,
          pendingApprovals: items,
          isLoading: false,
        }));
        return true;
      } catch (err) {
        const message =
          err instanceof ApprovalServiceError
            ? err.message
            : '审批操作失败';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        return false;
      }
    },
    [],
  );

  /** Reject an approval process */
  const rejectAction = useCallback(
    async (processId: number, opinion: string): Promise<boolean> => {
      // Client-side validation: rejection requires a non-empty opinion
      if (!opinion || opinion.trim().length === 0) {
        const validationErr = createValidationError('驳回原因不能为空');
        setState((prev) => ({
          ...prev,
          error: validationErr.message,
        }));
        return false;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await apiReject(processId, opinion);
        // Refresh the pending list after rejection
        const items = await apiFetchPending();
        setState((prev) => ({
          ...prev,
          pendingApprovals: items,
          isLoading: false,
        }));
        return true;
      } catch (err) {
        const message =
          err instanceof ApprovalServiceError
            ? err.message
            : '驳回操作失败';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        return false;
      }
    },
    [],
  );

  /** Get the approval history for a specific process */
  const getApprovalHistory = useCallback(
    async (processId: number): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await apiGetHistory(processId);
        setState((prev) => ({
          ...prev,
          currentApproval: result.process,
          currentHistory: result.records,
          isLoading: false,
        }));
      } catch (err) {
        const message =
          err instanceof ApprovalServiceError
            ? err.message
            : '获取审批历史失败';
        setState((prev) => ({
          ...prev,
          currentApproval: null,
          currentHistory: [],
          isLoading: false,
          error: message,
        }));
      }
    },
    [],
  );

  /** Start polling for pending approvals */
  const subscribe = useCallback(
    (intervalMs: number = 15_000) => {
      // Avoid duplicate intervals
      if (pollingRef.current !== null) {
        return;
      }

      // Fetch immediately on subscribe
      fetchPendingApprovals();

      pollingRef.current = setInterval(() => {
        fetchPendingApprovals();
      }, intervalMs);
    },
    [fetchPendingApprovals],
  );

  /** Stop polling */
  const unsubscribe = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Context Value
  // -----------------------------------------------------------------------

  const store: ApprovalStore = {
    ...state,
    fetchPendingApprovals,
    approve: approveAction,
    reject: rejectAction,
    getApprovalHistory,
    subscribe,
    unsubscribe,
    clearError,
    clearCurrent,
  };

  return createElement(
    ApprovalStoreContext.Provider,
    { value: store },
    children,
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the approval store from a component.
 *
 * Must be used within an <ApprovalStoreProvider>.
 *
 * @returns The full approval store (state + actions)
 *
 * @example
 * ```tsx
 * function ApprovalPage() {
 *   const { pendingApprovals, isLoading, fetchPendingApprovals, approve, reject } = useApprovalStore();
 *
 *   useEffect(() => {
 *     fetchPendingApprovals();
 *   }, [fetchPendingApprovals]);
 *
 *   // ...
 * }
 * ```
 */
export function useApprovalStore(): ApprovalStore {
  const store = useContext(ApprovalStoreContext);
  if (!store) {
    throw new Error(
      'useApprovalStore must be used within an <ApprovalStoreProvider>',
    );
  }
  return store;
}

export default ApprovalStoreContext;
