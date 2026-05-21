/**
 * @module frontend/src/app/pages/work-orders/WorkOrderApprovalInboxPage
 * @description Work Order Approval Inbox Page — displays a list of work orders
 *              pending the current user's approval, with approve/reject actions.
 *
 * Features:
 * - List of pending approval items fetched from backend API
 * - ApprovalStatusBadge for visual status differentiation
 * - Row-level approve/reject buttons triggering ApprovalActionDialog
 * - Empty state rendering when no pending approvals exist
 * - isSubmitting guard prevents double-submit
 * - Auto-refresh list after successful approve/reject action
 *
 * Data flow: This page is the sole owner of approval state. It encapsulates
 * the approval hook logic (fetch, approve, reject, isSubmitting) and passes
 * callbacks down to child components via props. Child components do NOT call
 * workOrderService directly.
 *
 * API endpoints:
 *   GET  /api/work-orders/approval/pending       — fetch pending approvals
 *   POST /api/work-orders/{id}/approve           — approve with comment
 *   POST /api/work-orders/{id}/reject            — reject with comment
 *
 * @see frontend/src/app/services/workOrderService.ts
 * @see frontend/src/app/pages/work-orders/components/ApprovalStatusBadge.tsx
 * @see frontend/src/app/pages/work-orders/components/ApprovalActionDialog.tsx
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  workOrderService,
  type PendingApprovalItem,
  getPriorityLabel,
} from "../../services/workOrderService";
import { ApprovalStatusBadge } from "./components/ApprovalStatusBadge";
import { ApprovalActionDialog } from "./components/ApprovalActionDialog";

// ---------------------------------------------------------------------------
// Inline hook logic: useWorkOrderApproval
// Encapsulated here because the hook file is managed by a separate task.
// ---------------------------------------------------------------------------

/**
 * Manage pending approvals list and approve/reject mutations.
 * Implements isSubmitting lock via ref for double-submit prevention (ATB-05).
 *
 * @returns approval state and action handlers
 */
function useApprovalInbox() {
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ref to track in-flight submission for double-submit guard. */
  const submittingRef = useRef(false);

  /**
   * Fetch the list of pending approvals from backend.
   * Maps to GET /api/work-orders/approval/pending
   */
  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workOrderService.getPendingApprovals();
      setItems(data ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "加载待审批列表失败";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /**
   * Approve a work order with comment.
   * Prevents double-submit via submittingRef.
   */
  const approve = useCallback(
    async (id: number, comment: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        setError(null);
        await workOrderService.approveWorkOrder(id, { comment });
        await refetch();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "审批通过操作失败";
        setError(message);
        throw err;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [refetch],
  );

  /**
   * Reject a work order with comment.
   * Prevents double-submit via submittingRef.
   */
  const reject = useCallback(
    async (id: number, comment: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        setError(null);
        await workOrderService.rejectWorkOrder(id, { comment });
        await refetch();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "审批驳回操作失败";
        setError(message);
        throw err;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [refetch],
  );

  return { items, loading, isSubmitting, error, refetch, approve, reject };
}

// ---------------------------------------------------------------------------
// Dialog state
// ---------------------------------------------------------------------------

/** Shape of the dialog control state. Null means dialog is closed. */
interface DialogState {
  type: "approve" | "reject";
  item: PendingApprovalItem;
}

// ---------------------------------------------------------------------------
// Priority badge helper
// ---------------------------------------------------------------------------

/**
 * Get Tailwind CSS classes for priority badge.
 *
 * @param priority — the backend priority string
 * @returns CSS class string for the badge
 */
function getPriorityBadgeClasses(priority?: string): string {
  switch (priority) {
    case "EMERGENCY":
      return "bg-red-100 text-red-800";
    case "URGENT":
      return "bg-orange-100 text-orange-800";
    case "NORMAL":
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderApprovalInboxPage — displays pending work orders for approval.
 *
 * Composes ApprovalStatusBadge, ApprovalActionDialog, and the inline
 * approval hook logic to provide a complete approval inbox view.
 */
export function WorkOrderApprovalInboxPage() {
  const { items, loading, isSubmitting, error, approve, reject } =
    useApprovalInbox();

  /** Dialog state — null when closed. */
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  // -----------------------------------------------------------------------
  // Dialog handlers
  // -----------------------------------------------------------------------

  /**
   * Open the approve dialog for a specific work order.
   */
  const handleOpenApprove = useCallback((item: PendingApprovalItem) => {
    setDialogState({ type: "approve", item });
  }, []);

  /**
   * Open the reject dialog for a specific work order.
   */
  const handleOpenReject = useCallback((item: PendingApprovalItem) => {
    setDialogState({ type: "reject", item });
  }, []);

  /**
   * Close the dialog.
   */
  const handleCloseDialog = useCallback(() => {
    if (!isSubmitting) {
      setDialogState(null);
    }
  }, [isSubmitting]);

  /**
   * Handle dialog confirmation — calls approve or reject and closes dialog.
   */
  const handleConfirm = useCallback(
    async (comment: string) => {
      if (!dialogState) return;
      try {
        if (dialogState.type === "approve") {
          await approve(dialogState.item.id, comment);
        } else {
          await reject(dialogState.item.id, comment);
        }
        setDialogState(null);
      } catch {
        // Error is set in the hook; keep dialog open on failure
      }
    },
    [dialogState, approve, reject],
  );

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  /** Render loading skeleton. */
  const renderSkeleton = () => (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />
      ))}
    </div>
  );

  /** Render empty state when no pending approvals. */
  const renderEmpty = () => (
    <div
      className="px-6 py-12 text-center text-sm text-gray-400"
      data-testid="approval-inbox-empty"
    >
      暂无待审批工单
    </div>
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6" data-testid="approval-inbox-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">审批收件箱</h2>
          <p className="mt-1 text-gray-500">
            查看待您审批的工单，执行通过或驳回操作
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-yellow-100 px-3 py-1.5 font-medium text-yellow-800">
            待审批: {items.length}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* Table Card */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {/* Table */}
        {loading ? (
          renderSkeleton()
        ) : items.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    工单编号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    标题
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    关联资产
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    报修人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    优先级
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    审批状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    创建时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e3a5f]">
                {items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      {item.workOrderNo ?? item.id}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-4 text-sm text-gray-900">
                      {item.title ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.assetName ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.reporterName ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadgeClasses(item.priority)}`}
                      >
                        {getPriorityLabel(item.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ApprovalStatusBadge
                        status={item.approvalStatus}
                        data-testid={`approval-status-${item.id}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.createTime ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.approvalStatus === "pending" ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenApprove(item)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                            data-testid={`btn-approve-${index}`}
                          >
                            通过
                          </button>
                          <button
                            onClick={() => handleOpenReject(item)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                            data-testid={`btn-reject-${index}`}
                          >
                            驳回
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ApprovalActionDialog — controlled by dialogState */}
      {dialogState && (
        <ApprovalActionDialog
          isOpen={true}
          type={dialogState.type}
          onConfirm={handleConfirm}
          onClose={handleCloseDialog}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}

export default WorkOrderApprovalInboxPage;
