/**
 * @module frontend/src/app/pages/workorders/WorkOrderDetailPage
 * @description Work Order Detail Page — real backend API driven with approval actions.
 *
 * Features:
 * - Fetches full work order detail via GET /api/workorders/{id}
 * - Displays all work order fields with status and priority badges
 * - Shows approval history timeline with step-by-step records
 * - Approve / Reject actions with comment modal (only for PENDING status)
 * - Edit button: only enabled for DRAFT/REJECTED status (state machine constraint)
 * - Submit button: submits draft for approval (DRAFT/REJECTED → PENDING)
 * - Lifecycle operations: start, complete, cancel based on current status
 * - Back navigation to work order list
 *
 * API endpoints used:
 *   GET    /api/workorders/{id}          — fetch work order detail
 *   POST   /api/workorders/{id}/approve  — approve with optional comment
 *   POST   /api/workorders/{id}/reject   — reject with optional comment
 *   POST   /api/workorders/{id}/submit   — submit for approval
 *   POST   /api/workorders/{id}/operate  — lifecycle operations
 *
 * State machine (backend enforced):
 *   DRAFT    → editable, submittable
 *   REJECTED → editable, submittable
 *   PENDING  → locked, approve/reject available
 *   APPROVED → can start execution
 *   EXECUTING → can complete
 *   COMPLETED → terminal
 *   CANCELLED → terminal
 *
 * @see frontend/src/app/hooks/useWorkOrderDetail.ts
 * @see frontend/src/app/services/workOrderApi.ts
 * @see frontend/src/app/services/workOrderService.ts
 */

import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Edit3,
  Send,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Package,
  DollarSign,
  Clock,
  FileText,
  CheckCircle2,
  XCircle as RejectIcon,
  History,
} from "lucide-react";
import { useWorkOrderDetail } from "../../hooks/useWorkOrderDetail";
import {
  workOrderService,
  getWorkOrderStatusLabel,
  getPriorityLabel,
  isEditableStatus,
  isSubmittableStatus,
  isCancellableStatus,
} from "../../services/workOrderService";

// ---------------------------------------------------------------------------
// Status / Priority badge helpers
// ---------------------------------------------------------------------------

/**
 * Get Tailwind CSS classes for status badge based on work order status.
 *
 * @param status — the backend status string
 * @returns CSS class string for the badge
 */
function getStatusBadgeClasses(status?: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-blue-50 text-gray-800";
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
      return "bg-blue-50 text-gray-500";
    default:
      return "bg-blue-50 text-gray-500";
  }
}

/**
 * Get priority badge CSS classes.
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
// Approval Comment Modal
// ---------------------------------------------------------------------------

interface ApprovalModalProps {
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
 * Renders a textarea for the comment and submit/cancel buttons.
 * For reject actions, comment is recommended but not required.
 *
 * @param props — modal configuration and callbacks
 */
function ApprovalCommentModal({
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
      data-testid="work-order-approval-modal"
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
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <RejectIcon className="w-5 h-5 text-red-600" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {isApprove ? "审批通过" : "审批拒绝"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-500 text-xl"
              disabled={submitting}
            >
              &times;
            </button>
          </div>

          {/* Comment input */}
          <div className="px-6 py-4">
            <label
              htmlFor="wo-approval-comment"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              审批意见
              {!isApprove && (
                <span className="ml-1 text-xs text-red-500">
                  （拒绝时建议填写原因）
                </span>
              )}
            </label>
            <textarea
              id="wo-approval-comment"
              data-testid="wo-approval-comment-input"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={4}
              maxLength={1000}
              placeholder={
                isApprove
                  ? "请输入审批意见（可选）..."
                  : "请输入拒绝原因..."
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
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || (!isApprove && !comment.trim())}
              data-testid={`btn-wo-confirm-${action}`}
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
// Approval Timeline
// ---------------------------------------------------------------------------

/**
 * ApprovalTimeline — renders the approval history as a vertical timeline.
 *
 * Each entry shows the approver, result (APPROVED/REJECTED), timestamp,
 * and any comment left by the approver.
 *
 * @param history - Array of approval history entries
 */
function ApprovalTimeline({
  history,
}: {
  history: Array<{
    id: number;
    stepNo: number;
    operatorId: number;
    operatorName?: string;
    result: string;
    operatedAt: string;
    comment: string;
  }>;
}) {
  if (history.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-gray-400 text-sm">
        暂无审批记录
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="approval-timeline">
      <div className="space-y-0">
        {history.map((entry, index) => {
          const isApproved = entry.result === "APPROVED";
          const isLast = index === history.length - 1;

          return (
            <div key={entry.id} className="flex gap-4">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isApproved
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {isApproved ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <RejectIcon className="w-4 h-4" />
                  )}
                </div>
                {!isLast && (
                  <div className="w-px h-full bg-blue-50 min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    审批人 #{entry.operatorId}
                    {entry.operatorName && ` — ${entry.operatorName}`}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      isApproved
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isApproved ? "已通过" : "已拒绝"}
                  </span>
                  <span className="text-xs text-gray-400">第 {entry.stepNo} 步</span>
                </div>
                {entry.comment && (
                  <p className="mt-1 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    {entry.comment}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {entry.operatedAt || "-"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderDetailPage — displays full work order details with approval actions.
 *
 * Uses the useWorkOrderDetail hook for data fetching and mutations.
 * Shows approval history timeline and provides approve/reject actions
 * for PENDING work orders via a comment modal.
 *
 * State machine actions:
 * - DRAFT/REJECTED: can edit, submit for approval
 * - PENDING: can approve or reject (with comment)
 * - APPROVED: can start execution
 * - EXECUTING: can complete
 * - CANCELLED/COMPLETED: terminal states
 */
export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // -- hook state ----------------------------------------------------------
  const {
    order,
    approvalHistory,
    loading,
    mutating,
    error,
    refetch,
    approve,
    reject,
    clearError,
  } = useWorkOrderDetail(id);

  // -- local state ---------------------------------------------------------
  const [notice, setNotice] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<"approve" | "reject" | null>(null);
  const [operating, setOperating] = useState(false);

  // -- lifecycle action handlers -------------------------------------------

  /**
   * Submit work order for approval.
   * Calls POST /api/workorders/{id}/submit
   * Only available for DRAFT/REJECTED status.
   */
  const handleSubmit = useCallback(async () => {
    if (!id) return;
    try {
      setOperating(true);
      clearError();
      await workOrderService.submit(id);
      setNotice("工单已提交审批，状态已变更为待审批");
      await refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "提交失败";
      setNotice(null);
      // Error is set by the hook indirectly; show inline
    } finally {
      setOperating(false);
    }
  }, [id, refetch, clearError]);

  /**
   * Start executing an approved work order.
   * Calls POST /api/workorders/{id}/operate with operation "start"
   */
  const handleStart = useCallback(async () => {
    if (!id) return;
    try {
      setOperating(true);
      clearError();
      await workOrderService.operate(id, "start", "开始执行");
      setNotice("工单已开始执行");
      await refetch();
    } catch (err: unknown) {
      // Error handled by service
    } finally {
      setOperating(false);
    }
  }, [id, refetch, clearError]);

  /**
   * Complete an executing work order.
   * Calls POST /api/workorders/{id}/operate with operation "complete"
   */
  const handleComplete = useCallback(async () => {
    if (!id) return;
    try {
      setOperating(true);
      clearError();
      await workOrderService.operate(id, "complete", "处理完成");
      setNotice("工单已完成");
      await refetch();
    } catch (err: unknown) {
      // Error handled by service
    } finally {
      setOperating(false);
    }
  }, [id, refetch, clearError]);

  /**
   * Cancel a work order.
   * Calls POST /api/workorders/{id}/operate with operation "cancel"
   */
  const handleCancel = useCallback(async () => {
    if (!id) return;
    if (!window.confirm("确定要取消此工单吗？")) return;
    try {
      setOperating(true);
      clearError();
      await workOrderService.operate(id, "cancel", "取消工单");
      setNotice("工单已取消");
      await refetch();
    } catch (err: unknown) {
      // Error handled by service
    } finally {
      setOperating(false);
    }
  }, [id, refetch, clearError]);

  /**
   * Handle approval/rejection confirmation from the modal.
   *
   * Calls the approve or reject method from the useWorkOrderDetail hook,
   * which invokes POST /api/workorders/{id}/approve or /reject.
   */
  const handleModalConfirm = useCallback(
    async (comment: string) => {
      try {
        if (modalAction === "approve") {
          await approve(comment);
          setNotice("工单已审批通过");
        } else {
          await reject(comment);
          setNotice("工单已拒绝");
        }
        setModalAction(null);
      } catch {
        // Error is captured by the hook
      }
    },
    [modalAction, approve, reject],
  );

  /**
   * Navigate to edit page.
   * State machine constraint: PENDING status cannot be edited.
   */
  const handleEdit = useCallback(() => {
    if (!order) return;
    if (!isEditableStatus(order.status)) {
      setNotice("当前状态不允许编辑");
      return;
    }
    navigate(`/workorders/${order.id}/edit`);
  }, [order, navigate]);

  // -- render: loading skeleton --------------------------------------------
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-blue-50 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-blue-50 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // -- render: error state -------------------------------------------------
  if (error && !order) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/workorders")}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900">工单详情</h2>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">加载失败</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // -- derived state -------------------------------------------------------
  const canEdit = isEditableStatus(order.status);
  const canSubmit = isSubmittableStatus(order.status);
  const canApproveReject = order.status === "PENDING";
  const canStart = order.status === "APPROVED";
  const canComplete = order.status === "EXECUTING";
  const canCancel = isCancellableStatus(order.status);
  const isPending = order.status === "PENDING";

  // -- render: detail -------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="work-order-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/workorders")}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            type="button"
            data-testid="work-order-back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">工单详情</h2>
            <p className="text-sm text-gray-400 mt-1">
              工单编号：{order.workOrderNo || order.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit button — disabled when PENDING */}
          <button
            onClick={handleEdit}
            disabled={!canEdit || operating}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canEdit
                ? "text-blue-700 bg-blue-50 hover:bg-blue-100"
                : "text-gray-400 bg-blue-50 cursor-not-allowed"
            }`}
            title={canEdit ? "编辑工单" : "当前状态不允许编辑"}
            data-testid="work-order-edit-btn"
          >
            <Edit3 className="w-4 h-4" />
            编辑
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
            onClick={clearError}
            className="text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* PENDING status warning */}
      {isPending && (
        <div
          className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          role="alert"
          data-testid="work-order-pending-warning"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">工单正在审批中</p>
            <p className="mt-1">
              当前状态为待审批（PENDING），您可以通过下方按钮进行审批通过或拒绝操作。
            </p>
          </div>
        </div>
      )}

      {/* Section: Status Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-lg font-semibold text-gray-900">状态概览</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">工单编号</p>
              <p className="text-lg font-semibold text-gray-900">
                {order.workOrderNo || order.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">状态</p>
              <span
                className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClasses(order.status)}`}
                data-testid="work-order-detail-status"
              >
                {getWorkOrderStatusLabel(order.status)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">优先级</p>
              <span
                className={`inline-block px-3 py-1 text-sm font-medium rounded ${getPriorityBadgeClasses(order.priority)}`}
              >
                {getPriorityLabel(order.priority)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Basic Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">基本信息</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <p className="text-sm text-gray-400 mb-1">标题</p>
              <p className="text-base font-medium text-gray-900">
                {order.title || "-"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-400 mb-1">描述</p>
              <p className="text-base text-gray-700 whitespace-pre-wrap">
                {order.description || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">报修人</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                {order.reporterName || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">创建时间</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                {order.createTime || "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Asset Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-purple-50/50 flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-purple-900">关联资产</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">资产ID</p>
              <p className="text-base text-gray-900">
                {order.assetId ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">资产名称</p>
              <p className="text-base text-gray-900">
                {order.assetName || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">资产编码</p>
              <p className="text-base text-gray-900">
                {order.assetCode || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">所属部门</p>
              <p className="text-base text-gray-900">
                {order.deptName || "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Schedule & Cost */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-blue-50/50 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-blue-900">排期与费用</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">指派给</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                {order.assigneeName || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">预估费用</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                {order.estimatedCost != null ? `¥${order.estimatedCost}` : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">计划开始日期</p>
              <p className="text-base text-gray-900">
                {order.plannedStartDate || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">计划结束日期</p>
              <p className="text-base text-gray-900">
                {order.plannedEndDate || "-"}
              </p>
            </div>
            {order.actualStartDate && (
              <div>
                <p className="text-sm text-gray-400 mb-1">实际开始日期</p>
                <p className="text-base text-gray-900">{order.actualStartDate}</p>
              </div>
            )}
            {order.actualEndDate && (
              <div>
                <p className="text-sm text-gray-400 mb-1">实际结束日期</p>
                <p className="text-base text-gray-900">{order.actualEndDate}</p>
              </div>
            )}
            {order.actualCost != null && (
              <div>
                <p className="text-sm text-gray-400 mb-1">实际费用</p>
                <p className="text-base text-gray-900">¥{order.actualCost}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Approval History Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50/50 flex items-center gap-2">
          <History className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">审批记录</h3>
        </div>
        <ApprovalTimeline history={approvalHistory} />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 sticky bottom-6 bg-white p-4 rounded-xl shadow-lg border border-gray-200">
        <button
          type="button"
          onClick={() => navigate("/workorders")}
          className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          返回列表
        </button>

        {/* Cancel button */}
        {canCancel && !isPending && (
          <button
            onClick={handleCancel}
            disabled={operating}
            className="px-4 py-2 text-sm font-medium text-gray-500 bg-blue-50 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消工单
          </button>
        )}

        {/* Submit for approval (DRAFT/REJECTED → PENDING) */}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={operating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="work-order-submit-btn"
          >
            {operating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            提交审批
          </button>
        )}

        {/* Approve button (only for PENDING) */}
        {canApproveReject && (
          <button
            onClick={() => setModalAction("approve")}
            disabled={mutating}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="work-order-approve-btn"
          >
            <CheckCircle className="w-4 h-4" />
            审批通过
          </button>
        )}

        {/* Reject button (only for PENDING) */}
        {canApproveReject && (
          <button
            onClick={() => setModalAction("reject")}
            disabled={mutating}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="work-order-reject-btn"
          >
            <XCircle className="w-4 h-4" />
            审批拒绝
          </button>
        )}

        {/* Start execution (APPROVED → EXECUTING) */}
        {canStart && (
          <button
            onClick={handleStart}
            disabled={operating}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {operating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            开始执行
          </button>
        )}

        {/* Complete (EXECUTING → COMPLETED) */}
        {canComplete && (
          <button
            onClick={handleComplete}
            disabled={operating}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {operating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            完成
          </button>
        )}
      </div>

      {/* Approval Comment Modal */}
      {modalAction && (
        <ApprovalCommentModal
          action={modalAction}
          onConfirm={handleModalConfirm}
          onCancel={() => setModalAction(null)}
          submitting={mutating}
        />
      )}
    </div>
  );
}

export default WorkOrderDetailPage;
