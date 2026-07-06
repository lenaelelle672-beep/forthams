/**
 * @module frontend/src/app/hooks/useWorkOrderDetail
 * @description React Hook for work order detail fetching with approval history.
 *
 * Encapsulates the data fetching logic for the WorkOrderDetailPage, including:
 * - Fetching the work order record via GET /api/workorders/{id}
 * - Fetching the approval timeline/history
 * - Providing approve/reject mutation methods
 * - Loading and error state management
 *
 * All API calls use the workOrderApi service layer, which hits real backend endpoints.
 * No mock or stub data.
 *
 * @see frontend/src/app/services/workOrderApi.ts
 * @see frontend/src/app/pages/workorders/WorkOrderDetailPage.tsx
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchWorkOrderDetail,
  approveWorkOrder,
  rejectWorkOrder,
  type WorkOrderDetail,
  type ApprovalHistoryEntry,
} from "../services/workOrderApi";
import {
  type WorkOrderRecord,
} from "../services/workOrderService";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

/**
 * Return type for the useWorkOrderDetail hook.
 *
 * Provides the full work order detail (order + approval history),
 * loading/error state, approve/reject mutation functions, and a refetch method.
 */
export interface UseWorkOrderDetailReturn {
  /** The fetched work order record. */
  order: WorkOrderRecord | null;
  /** Chronological approval history entries for the work order. */
  approvalHistory: ApprovalHistoryEntry[];
  /** Whether data is being fetched. */
  loading: boolean;
  /** Whether an approve/reject mutation is in progress. */
  mutating: boolean;
  /** Error message if fetch or mutation failed. */
  error: string | null;
  /** Manually trigger a re-fetch of the full detail. */
  refetch: () => Promise<void>;
  /** Approve the work order with an optional comment. */
  approve: (comment?: string) => Promise<WorkOrderRecord>;
  /** Reject the work order with an optional comment. */
  reject: (comment?: string) => Promise<WorkOrderRecord>;
  /** Clear the current error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for fetching a single work order with its approval history and
 * performing approve/reject actions.
 *
 * Internally calls fetchWorkOrderDetail which invokes:
 *   GET /api/workorders/{id}
 *   GET /api/approvals/list + GET /api/approvals/{processId}
 *
 * Approve/reject mutations call:
 *   POST /api/workorders/{id}/approve
 *   POST /api/workorders/{id}/reject
 *
 * @param id - Work order ID (string from route params, or undefined)
 * @returns detail state, mutation functions, and loading/error state
 *
 * @example
 * ```tsx
 * const { order, approvalHistory, loading, approve, reject } = useWorkOrderDetail(id);
 *
 * if (loading) return <Spinner />;
 *
 * return (
 *   <div>
 *     <h1>{order.title}</h1>
 *     <Timeline items={approvalHistory} />
 *     <button onClick={() => approve("Looks good")}>Approve</button>
 *     <button onClick={() => reject("Needs revision")}>Reject</button>
 *   </div>
 * );
 * ```
 */
export function useWorkOrderDetail(
  id: string | undefined,
): UseWorkOrderDetailReturn {
  const [order, setOrder] = useState<WorkOrderRecord | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch work order detail and approval history from backend.
   * Maps to GET /api/workorders/{id} + approval history lookup.
   */
  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const detail: WorkOrderDetail = await fetchWorkOrderDetail(id);
      setOrder(detail.order);
      setApprovalHistory(detail.approvalHistory);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "加载工单详情失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /**
   * Approve the work order.
   *
   * Calls POST /api/workorders/{id}/approve with optional comment.
   * On success, updates the local order state and refreshes approval history.
   *
   * @param comment - Optional approval comment
   * @returns The updated work order record
   */
  const approve = useCallback(
    async (comment?: string): Promise<WorkOrderRecord> => {
      if (!id) throw new Error("工单 ID 不存在");
      try {
        setMutating(true);
        setError(null);
        const updated = await approveWorkOrder(id, comment);
        setOrder(updated);
        // Refresh approval history after mutation
        await refetch();
        return updated;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "审批通过失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [id, refetch],
  );

  /**
   * Reject the work order.
   *
   * Calls POST /api/workorders/{id}/reject with optional comment.
   * On success, updates the local order state and refreshes approval history.
   *
   * @param comment - Optional rejection reason
   * @returns The updated work order record
   */
  const reject = useCallback(
    async (comment?: string): Promise<WorkOrderRecord> => {
      if (!id) throw new Error("工单 ID 不存在");
      try {
        setMutating(true);
        setError(null);
        const updated = await rejectWorkOrder(id, comment);
        setOrder(updated);
        // Refresh approval history after mutation
        await refetch();
        return updated;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "审批拒绝失败";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [id, refetch],
  );

  /** Clear the current error state. */
  const clearError = useCallback(() => setError(null), []);

  return {
    order,
    approvalHistory,
    loading,
    mutating,
    error,
    refetch,
    approve,
    reject,
    clearError,
  };
}
