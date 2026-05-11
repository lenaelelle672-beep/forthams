/**
 * @module frontend/src/app/pages/workorders/WorkOrderApprovalPage
 * @description Work Order Approval Page — real backend API driven.
 *
 * Features:
 * - Paginated list of pending work orders fetched via GET /api/workorders?status=PENDING
 * - Approve / Reject actions per row with optional comment
 * - Approval comment modal dialog
 * - Status badge and priority badge per work order
 * - Keyword search (debounced) and pagination
 * - Real-time list refresh after each approval/rejection
 *
 * API endpoints used:
 *   GET  /api/workorders?status=PENDING&page=&pageSize=&keyword=
 *   POST /api/workorders/{id}/approve  — approve with optional comment
 *   POST /api/workorders/{id}/reject   — reject with optional comment
 *
 * @see frontend/src/app/services/workOrderService.ts
 * @see backend/src/main/java/com/ams/controller/WorkOrderController.java
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  Eye,
} from "lucide-react";
import {
  workOrderService,
  getWorkOrderStatusLabel,
  getPriorityLabel,
  type WorkOrderRecord,
  type WorkOrderListParams,
} from "../../services/workOrderService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default page size for list queries. */
const DEFAULT_PAGE_SIZE = 10;

/** Debounce delay for keyword search (ms). */
const SEARCH_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Status / Priority badge helpers
// ---------------------------------------------------------------------------

/**
 * Get Tailwind CSS classes for status badge based on work order status.
 */
function getStatusBadgeClasses(status?: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-800";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "APPROVED":
      return "bg-blue-100 text-blue-800";
    case "EXECUTING":
      return "bg-indigo-100 text-indigo-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "REJECTED":
      return "bg-red-100 text-red-800";
    case "CANCELLED":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * Get Tailwind CSS classes for priority badge.
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
// Approval Comment Modal
// ---------------------------------------------------------------------------

interface ApprovalModalProps {
  /** Work order being acted upon */
  order: WorkOrderRecord;
  /** Action type: "approve" or "reject" */
  action: "approve" | "reject";
  /** Confirm callback with comment */
  onConfirm: (comment: string) => void;
  /** Cancel callback */
  onCancel: () => void;
  /** Whether the operation is in progress */
  submitting: boolean;
}

/**
 * ApprovalCommentModal — modal dialog for entering an approval/rejection comment.
 *
 * @param props — modal configuration and callbacks
 */
function ApprovalCommentModal({
  order,
  action,
  onConfirm,
  onCancel,
  submitting,
}: ApprovalModalProps) {
  const [comment, setComment] = useState("");

  const isApprove = action === "approve";

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onConfirm(comment);
    },
    [onConfirm, comment],
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
      data-testid="approval-comment-modal"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isApprove ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {isApprove ? "审批通过" : "审批拒绝"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-xl"
              disabled={submitting}
            >
              &times;
            </button>
          </div>

          {/* Work order summary */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm text-gray-500">工单信息</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              {order.workOrderNo || order.id} — {order.title || "-"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              关联资产: {order.assetName || "-"} | 报修人:{" "}
              {order.reporterName || "-"}
            </p>
          </div>

          {/* Comment input */}
          <div className="px-6 py-4">
            <label
              htmlFor="approval-action-comment"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              审批意见
              {!isApprove && (
                <span className="ml-1 text-xs text-red-500">（拒绝时建议填写原因）</span>
              )}
            </label>
            <textarea
              id="approval-action-comment"
              data-testid="approval-action-comment-input"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={4}
              maxLength={1000}
              placeholder={
                isApprove ? "请输入审批意见（可选）..." : "请输入拒绝原因..."
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {comment.length} / 1000
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || (!isApprove && !comment.trim())}
              data-testid={`btn-confirm-${action}`}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isApprove
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </span>
              ) : isApprove ? (
                "确认通过"
              ) : (
                "确认拒绝"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderApprovalPage — paginated list of pending work orders with
 * approve/reject capabilities.
 *
 * Fetches data from backend via workOrderService.list({ status: "PENDING" })
 * which calls GET /api/workorders?status=PENDING with pagination params.
 *
 * Approve: POST /api/workorders/{id}/approve
 * Reject:  POST /api/workorders/{id}/reject
 */
export function WorkOrderApprovalPage() {
  // -- state ---------------------------------------------------------------
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<WorkOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Currently active approval modal, if any */
  const [modalOrder, setModalOrder] = useState<WorkOrderRecord | null>(null);
  const [modalAction, setModalAction] = useState<"approve" | "reject">("approve");
  const [submitting, setSubmitting] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- debounced keyword search --------------------------------------------
  const handleKeywordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setKeyword(value);
      setPage(1);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        setDebouncedKeyword(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // -- data fetching -------------------------------------------------------
  /**
   * Fetch pending work orders from backend.
   * Always queries with status=PENDING to show only approval-pending items.
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: WorkOrderListParams = {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        status: "PENDING",
      };
      if (debouncedKeyword.trim()) {
        params.keyword = debouncedKeyword.trim();
      }

      const result = await workOrderService.list(params);
      setRecords(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || Math.ceil((result.total || 0) / DEFAULT_PAGE_SIZE));
    } catch (err: any) {
      setError(err?.message ?? "加载待审批工单失败");
      setRecords([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedKeyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- approval action handlers --------------------------------------------

  /**
   * Open the approval/rejection modal for a specific work order.
   */
  const openModal = useCallback(
    (order: WorkOrderRecord, action: "approve" | "reject") => {
      setModalOrder(order);
      setModalAction(action);
    },
    [],
  );

  /**
   * Close the approval/rejection modal.
   */
  const closeModal = useCallback(() => {
    if (!submitting) {
      setModalOrder(null);
    }
  }, [submitting]);

  /**
   * Execute the approval or rejection action after comment is confirmed.
   *
   * Calls:
   *   workOrderService.approve(id, comment) — POST /api/workorders/{id}/approve
   *   workOrderService.reject(id, comment)  — POST /api/workorders/{id}/reject
   */
  const handleConfirmAction = useCallback(
    async (comment: string) => {
      if (!modalOrder) return;

      try {
        setSubmitting(true);

        if (modalAction === "approve") {
          await workOrderService.approve(modalOrder.id, comment);
          setNotice(
            `工单 ${modalOrder.workOrderNo || modalOrder.id} 已审批通过`,
          );
        } else {
          await workOrderService.reject(modalOrder.id, comment);
          setNotice(
            `工单 ${modalOrder.workOrderNo || modalOrder.id} 已拒绝`,
          );
        }

        setModalOrder(null);
        // Refresh the list after action
        await fetchData();
      } catch (err: any) {
        setError(err?.message ?? `${modalAction === "approve" ? "审批通过" : "审批拒绝"}失败`);
      } finally {
        setSubmitting(false);
      }
    },
    [modalOrder, modalAction, fetchData],
  );

  // -- render helpers ------------------------------------------------------

  const renderSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="px-6 py-12 text-center text-gray-500 text-sm">
      暂无待审批工单
    </div>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          共 {total} 条待审批，第 {page}/{totalPages} 页
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev !== undefined && p - prev > 1;
              return (
                <span key={p} className="flex items-center">
                  {showEllipsis && (
                    <span className="px-1 text-gray-400 text-sm">...</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // -- render --------------------------------------------------------------
  return (
    <div className="space-y-6" data-testid="work-order-approval-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">工单审批</h2>
          <p className="text-gray-600 mt-1">
            查看待审批工单并进行审批操作
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full font-medium">
            待审批: {total}
          </span>
        </div>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-green-600 hover:text-green-800"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={handleKeywordChange}
              placeholder="搜索工单标题或编号..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="approval-search-input"
            />
          </div>
          <button
            onClick={() => fetchData()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          renderSkeleton()
        ) : records.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    工单编号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    标题
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    关联资产
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    报修人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    优先级
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    提交时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      {order.workOrderNo || order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">
                      {order.title || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.assetName || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.reporterName || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadgeClasses(order.priority)}`}
                      >
                        {getPriorityLabel(order.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeClasses(order.status)}`}
                        data-testid={`approval-status-${order.id}`}
                      >
                        {getWorkOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.updateTime || order.createTime || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        {/* View detail */}
                        <button
                          onClick={() =>
                            openModal(order, "approve")
                          }
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="查看并审批"
                          data-testid={`btn-view-approve-${order.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Approve */}
                        <button
                          onClick={() => openModal(order, "approve")}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="审批通过"
                          data-testid={`btn-approve-${order.id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>

                        {/* Reject */}
                        <button
                          onClick={() => openModal(order, "reject")}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="审批拒绝"
                          data-testid={`btn-reject-${order.id}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>

                        {/* Comment indicator */}
                        {order.description && (
                          <span className="ml-1 text-gray-400" title="有描述">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {renderPagination()}
      </div>

      {/* Approval Comment Modal */}
      {modalOrder && (
        <ApprovalCommentModal
          order={modalOrder}
          action={modalAction}
          onConfirm={handleConfirmAction}
          onCancel={closeModal}
          submitting={submitting}
        />
      )}
    </div>
  );
}

export default WorkOrderApprovalPage;
