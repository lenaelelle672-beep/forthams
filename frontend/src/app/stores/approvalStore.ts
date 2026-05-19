/**
 * @module frontend/src/app/stores/approvalStore
 * @description Approval store using React Context + useReducer for global state management.
 *
 * Manages the following state:
 * - pendingApprovals: list of pending approval items
 * - currentApproval: the currently selected approval with its full detail
 * - approvalHistory: history records for the currently selected process
 * - loading: global loading flag
 * - error: last error message
 *
 * Actions:
 * - fetchPending: loads pending approvals from API
 * - approve: approves a process and removes it from pending list
 * - reject: rejects a process and removes it from pending list
 * - setCurrent: sets the currently selected approval (pass null to clear)
 * - clearError: clears the current error
 * - getApprovalHistory: loads detail + history for a specific process
 * - subscribe: starts polling for pending approval updates
 * - unsubscribe: stops polling
 *
 * Uses React Context + useReducer for predictable state management
 * (no external state libraries required, consistent with project patterns).
 */

import {
  createContext,
  useContext,
  useReducer,
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
  /** Currently selected approval with full detail */
  currentApproval: ApprovalItem | null;
  /** Approval history for the currently selected process */
  approvalHistory: ApprovalHistoryItem[];
  /** Global loading indicator */
  loading: boolean;
  /** Last error encountered (null when no error) */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Store Actions Interface
// ---------------------------------------------------------------------------

/** Result shape returned by approve / reject actions. */
export interface ApprovalActionResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** The approval process ID (set when success is true) */
  approvalId?: number;
}

/** Actions exposed by the approval store. */
export interface ApprovalActions {
  /** Fetch the list of pending approvals */
  fetchPending: () => Promise<void>;
  /** Approve a process by ID, removes it from pending list, returns {success, approvalId} */
  approve: (processId: number, opinion?: string) => Promise<ApprovalActionResult>;
  /** Reject a process by ID (opinion is required), removes it from pending list, returns {success, approvalId} */
  reject: (processId: number, opinion: string) => Promise<ApprovalActionResult>;
  /** Set the currently selected approval (pass null to clear) */
  setCurrent: (approval: ApprovalItem | null) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Load the full history for a specific process */
  getApprovalHistory: (processId: number) => Promise<void>;
  /** Start polling for pending approvals at the given interval (ms) */
  subscribe: (intervalMs?: number) => void;
  /** Stop polling */
  unsubscribe: () => void;
}

// ---------------------------------------------------------------------------
// Combined Store Type
// ---------------------------------------------------------------------------

export type ApprovalStore = ApprovalState & ApprovalActions;

/**
 * Extended store type including backward-compatible aliases.
 *
 * These aliases exist so that existing consumers that reference the old names
 * (isLoading, currentHistory, fetchPendingApprovals, clearCurrent) continue
 * to work without modification.
 *
 * @deprecated Use the new canonical names: loading, approvalHistory, fetchPending, setCurrent(null).
 */
export interface ApprovalStoreCompat extends ApprovalStore {
  /** @deprecated Use `loading` */
  isLoading: boolean;
  /** @deprecated Use `approvalHistory` */
  currentHistory: ApprovalHistoryItem[];
  /** @deprecated Use `fetchPending` */
  fetchPendingApprovals: () => Promise<void>;
  /** @deprecated Use `setCurrent(null)` */
  clearCurrent: () => void;
}

// ---------------------------------------------------------------------------
// Reducer Actions
// ---------------------------------------------------------------------------

type ReducerAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_PENDING_APPROVALS'; payload: ApprovalItem[] }
  | { type: 'REMOVE_PENDING_APPROVAL'; payload: number }
  | { type: 'SET_CURRENT_APPROVAL'; payload: ApprovalItem | null }
  | { type: 'SET_APPROVAL_HISTORY'; payload: { approval: ApprovalItem; history: ApprovalHistoryItem[] } }
  | { type: 'CLEAR_CURRENT' };

// ---------------------------------------------------------------------------
// Default State
// ---------------------------------------------------------------------------

const DEFAULT_STATE: ApprovalState = {
  pendingApprovals: [],
  currentApproval: null,
  approvalHistory: [],
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function approvalReducer(state: ApprovalState, action: ReducerAction): ApprovalState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: action.payload ? null : state.error };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_PENDING_APPROVALS':
      return { ...state, pendingApprovals: action.payload, loading: false, error: null };
    case 'REMOVE_PENDING_APPROVAL':
      return {
        ...state,
        pendingApprovals: state.pendingApprovals.filter(
          (item) => item.id !== action.payload,
        ),
        loading: false,
      };
    case 'SET_CURRENT_APPROVAL':
      return {
        ...state,
        currentApproval: action.payload,
        approvalHistory: action.payload === null ? [] : state.approvalHistory,
      };
    case 'SET_APPROVAL_HISTORY':
      return {
        ...state,
        currentApproval: action.payload.approval,
        approvalHistory: action.payload.history,
        loading: false,
        error: null,
      };
    case 'CLEAR_CURRENT':
      return {
        ...state,
        currentApproval: null,
        approvalHistory: [],
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ApprovalStoreContext = createContext<ApprovalStoreCompat | null>(null);

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
  const [state, dispatch] = useReducer(approvalReducer, DEFAULT_STATE);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /** Clear the current error */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  /** Set the currently selected approval (pass null to clear) */
  const setCurrent = useCallback((approval: ApprovalItem | null) => {
    if (approval === null) {
      dispatch({ type: 'CLEAR_CURRENT' });
    } else {
      dispatch({ type: 'SET_CURRENT_APPROVAL', payload: approval });
    }
  }, []);

  /** Fetch pending approval processes from the API via GET /approvals/pending. */
  const fetchPending = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const items = await apiFetchPending();
      dispatch({ type: 'SET_PENDING_APPROVALS', payload: items });
    } catch (err) {
      const message =
        err instanceof ApprovalServiceError
          ? err.message
          : '获取审批列表失败';
      dispatch({ type: 'SET_ERROR', payload: message });
    }
  }, []);

  /** Approve an approval process */
  const approveAction = useCallback(
    async (processId: number, opinion: string = ''): Promise<ApprovalActionResult> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const approved = await apiApprove(processId, opinion);
        // Remove the approved item from the pending list
        dispatch({ type: 'REMOVE_PENDING_APPROVAL', payload: processId });
        return { success: true, approvalId: approved.id };
      } catch (err) {
        const message =
          err instanceof ApprovalServiceError
            ? err.message
            : '审批操作失败';
        dispatch({ type: 'SET_ERROR', payload: message });
        return { success: false };
      }
    },
    [],
  );

  /** Reject an approval process */
  const rejectAction = useCallback(
    async (processId: number, opinion: string): Promise<ApprovalActionResult> => {
      // Client-side validation: rejection requires a non-empty opinion
      if (!opinion || opinion.trim().length === 0) {
        const validationErr = createValidationError('驳回原因不能为空');
        dispatch({ type: 'SET_ERROR', payload: validationErr.message });
        return { success: false };
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const rejected = await apiReject(processId, opinion);
        // Remove the rejected item from the pending list
        dispatch({ type: 'REMOVE_PENDING_APPROVAL', payload: processId });
        return { success: true, approvalId: rejected.id };
      } catch (err) {
        const message =
          err instanceof ApprovalServiceError
            ? err.message
            : '驳回操作失败';
        dispatch({ type: 'SET_ERROR', payload: message });
        return { success: false };
      }
    },
    [],
  );

  /** Get the approval history for a specific process */
  const getApprovalHistory = useCallback(
    async (processId: number): Promise<void> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const result = await apiGetHistory(processId);
        dispatch({
          type: 'SET_APPROVAL_HISTORY',
          payload: { approval: result.process, history: result.records },
        });
      } catch (err) {
        const message =
          err instanceof ApprovalServiceError
            ? err.message
            : '获取审批历史失败';
        dispatch({ type: 'SET_ERROR', payload: message });
        dispatch({ type: 'CLEAR_CURRENT' });
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
      fetchPending();

      pollingRef.current = setInterval(() => {
        fetchPending();
      }, intervalMs);
    },
    [fetchPending],
  );

  /** Stop polling */
  const unsubscribe = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /** Clear the currently selected approval (alias for backward compat) */
  const clearCurrent = useCallback(() => {
    dispatch({ type: 'CLEAR_CURRENT' });
  }, []);

  // -----------------------------------------------------------------------
  // Context Value (includes backward-compatible aliases)
  // -----------------------------------------------------------------------

  const store: ApprovalStoreCompat = {
    ...state,
    fetchPending,
    approve: approveAction,
    reject: rejectAction,
    setCurrent,
    clearError,
    getApprovalHistory,
    subscribe,
    unsubscribe,
    // Backward-compatible aliases for existing consumers
    isLoading: state.loading,
    currentHistory: state.approvalHistory,
    fetchPendingApprovals: fetchPending,
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
 *   const { pendingApprovals, loading, fetchPending, approve, reject } = useApprovalStore();
 *
 *   useEffect(() => {
 *     fetchPending();
 *   }, [fetchPending]);
 *
 *   // ...
 * }
 * ```
 */
export function useApprovalStore(): ApprovalStoreCompat {
  const store = useContext(ApprovalStoreContext);
  if (!store) {
    throw new Error(
      'useApprovalStore must be used within an <ApprovalStoreProvider>',
    );
  }
  return store;
}

export default ApprovalStoreContext;
