/**
 * @module frontend/src/app/hooks/useApproval
 * @description React Hook for approval workflow interactions.
 *
 * Encapsulates approval flow core interaction logic, exposing four atomic capabilities:
 * - fetchPendingApprovals: fetches pending approvals and syncs to Store
 * - approve: approves a process
 * - reject: rejects a process
 * - subscribe: establishes a polling subscription for data refresh
 *
 * All list data flows through the ApprovalStore (React Context).
 * Errors bubble up to the caller; they are not silently handled at this layer.
 *
 * Must be used within an <ApprovalStoreProvider>.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useApprovalStore } from '../stores/approvalStore';

/** Default polling interval in milliseconds. */
const DEFAULT_POLL_INTERVAL = 15_000;

/**
 * Approval workflow React Hook.
 *
 * Returns named methods for components to call directly.
 * Must be used within an <ApprovalStoreProvider>.
 *
 * @returns Object with fetchPendingApprovals, approve, reject, subscribe, and unsubscribe methods.
 *
 * @example
 * ```tsx
 * function ApprovalPage() {
 *   const { fetchPendingApprovals, approve, reject, subscribe, unsubscribe } = useApproval();
 *
 *   useEffect(() => {
 *     fetchPendingApprovals();
 *     const cancel = subscribe();
 *     return cancel;
 *   }, []);
 *
 *   // ...
 * }
 * ```
 */
export function useApproval() {
  const store = useApprovalStore();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Fetch pending approvals and sync to the Store.
   */
  const fetchPendingApprovals = useCallback(async () => {
    await store.fetchPendingApprovals();
  }, [store.fetchPendingApprovals]);

  /**
   * Approve an approval process.
   *
   * @param processId - The approval process ID to approve
   * @param opinion   - Optional approval comment
   * @returns true if approval succeeded, false otherwise
   */
  const approve = useCallback(
    async (processId: number, opinion: string = ''): Promise<boolean> => {
      return await store.approve(processId, opinion);
    },
    [store.approve],
  );

  /**
   * Reject an approval process.
   *
   * @param processId - The approval process ID to reject
   * @param opinion   - Mandatory rejection reason
   * @returns true if rejection succeeded, false otherwise
   */
  const reject = useCallback(
    async (processId: number, opinion: string): Promise<boolean> => {
      return await store.reject(processId, opinion);
    },
    [store.reject],
  );

  /**
   * Load the full approval history for a specific process.
   *
   * @param processId - The approval process ID
   */
  const getApprovalHistory = useCallback(
    async (processId: number): Promise<void> => {
      await store.getApprovalHistory(processId);
    },
    [store.getApprovalHistory],
  );

  /**
   * Start polling for pending approvals at the given interval.
   *
   * Fetches immediately on first call, then at regular intervals.
   * Returns a cleanup function to stop polling.
   *
   * @param intervalMs - Polling interval in milliseconds (default 15s)
   * @returns Cleanup function to stop polling
   */
  const subscribe = useCallback(
    (intervalMs: number = DEFAULT_POLL_INTERVAL): (() => void) => {
      // Start the store's polling
      store.subscribe(intervalMs);

      // Return a cleanup function
      return () => {
        store.unsubscribe();
      };
    },
    [store.subscribe, store.unsubscribe],
  );

  /**
   * Stop polling for pending approvals.
   */
  const unsubscribe = useCallback(() => {
    store.unsubscribe();
  }, [store.unsubscribe]);

  // Auto-unsubscribe on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return {
    /** Fetch pending approvals list */
    fetchPendingApprovals,
    /** Approve a process by ID */
    approve,
    /** Reject a process by ID */
    reject,
    /** Load approval history for a process */
    getApprovalHistory,
    /** Start polling subscription */
    subscribe,
    /** Stop polling subscription */
    unsubscribe,
    /** Pending approvals list from store */
    pendingApprovals: store.pendingApprovals,
    /** Currently selected approval */
    currentApproval: store.currentApproval,
    /** Current approval history records */
    currentHistory: store.currentHistory,
    /** Loading state */
    isLoading: store.isLoading,
    /** Last error message */
    error: store.error,
    /** Clear the current error */
    clearError: store.clearError,
    /** Clear the currently selected approval */
    clearCurrent: store.clearCurrent,
  };
}
