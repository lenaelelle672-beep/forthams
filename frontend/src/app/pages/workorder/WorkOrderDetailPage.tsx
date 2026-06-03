/**
 * @module frontend/src/app/pages/workorder/WorkOrderDetailPage
 * @description Work Order Detail Page — real backend API driven with state machine constraints.
 *
 * Features:
 * - Fetches real work order data via GET /api/workorders/{id}
 * - Displays all work order fields with status badge
 * - Edit button: only enabled for DRAFT/REJECTED status (state machine constraint)
 * - Submit button: submits draft for approval (DRAFT/REJECTED → PENDING)
 * - Lifecycle operations: start, complete, cancel based on current status
 * - Route guard: if status is PENDING and user navigates to edit route, redirect to detail
 *
 * State machine (backend enforced):
 *   DRAFT    → editable, submittable
 *   REJECTED → editable, submittable
 *   PENDING  → locked (no edit allowed, displays "当前状态不允许编辑")
 *   APPROVED → can start execution
 *   EXECUTING → can complete
 *   COMPLETED → terminal
 *   CANCELLED → terminal
 *
 * @see frontend/src/app/services/workOrderService.ts
 */

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import {
  workOrderService,
  getWorkOrderStatusLabel,
  getPriorityLabel,
  isEditableStatus,
  isSubmittableStatus,
  isCancellableStatus,
  type WorkOrderRecord,
  type WorkOrderDTO,
} from "../../services/workOrderService";

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

/**
 * Get Tailwind CSS classes for status badge.
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
    case "CRITICAL":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800";
    case "LOW":
    default:
      return "bg-blue-50 text-blue-800";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderDetailPage — displays work order details with state-driven actions.
 *
 * Loads data from backend via workOrderService.getById().
 * Edit button is disabled when status === "PENDING" (ATB-03 compliance).
 * Route guard prevents direct navigation to edit route for PENDING orders.
 */
export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // -- state ---------------------------------------------------------------
  const [order, setOrder] = useState<WorkOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // -- data fetching -------------------------------------------------------
  /**
   * Fetch work order detail from backend.
   * Maps to GET /api/workorders/{id}
   */
  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await workOrderService.getById(id);
      setOrder(data);
    } catch (err: any) {
      setError(err?.message ?? "加载工单详情失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

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
      const updated = await workOrderService.submit(id);
      setOrder(updated);
      setNotice("工单已提交审批，状态已变更为待审批");
    } catch (err: any) {
      setError(err?.message ?? "提交失败");
    } finally {
      setOperating(false);
    }
  }, [id]);

  /**
   * Start executing an approved work order.
   * Calls POST /api/workorders/{id}/operate with operation "start"
   */
  const handleStart = useCallback(async () => {
    if (!id) return;
    try {
      setOperating(true);
      const updated = await workOrderService.operate(id, "start", "开始执行");
      setOrder(updated);
      setNotice("工单已开始执行");
    } catch (err: any) {
      setError(err?.message ?? "操作失败");
    } finally {
      setOperating(false);
    }
  }, [id]);

  /**
   * Complete an executing work order.
   * Calls POST /api/workorders/{id}/operate with operation "complete"
   */
  const handleComplete = useCallback(async () => {
    if (!id) return;
    try {
      setOperating(true);
      const updated = await workOrderService.operate(id, "complete", "处理完成");
      setOrder(updated);
      setNotice("工单已完成");
    } catch (err: any) {
      setError(err?.message ?? "操作失败");
    } finally {
      setOperating(false);
    }
  }, [id]);

  /**
   * Cancel a work order.
   * Calls POST /api/workorders/{id}/operate with operation "cancel"
   */
  const handleCancel = useCallback(async () => {
    if (!id) return;
    if (!window.confirm("确定要取消此工单吗？")) return;
    try {
      setOperating(true);
      const updated = await workOrderService.operate(id, "cancel", "取消工单");
      setOrder(updated);
      setNotice("工单已取消");
    } catch (err: any) {
      setError(err?.message ?? "取消失败");
    } finally {
      setOperating(false);
    }
  }, [id]);

  /**
   * Navigate to edit page.
   * State machine constraint: PENDING status cannot be edited.
   * If status is PENDING, show toast instead of navigating.
   */
  const handleEdit = useCallback(() => {
    if (!order) return;

    // ATB-03: PENDING status — block editing
    if (!isEditableStatus(order.status)) {
      setNotice("当前状态不允许编辑");
      return;
    }

    // Navigate to the WorkOrderForm edit mode (existing form in routes)
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
  const canStart = order.status === "APPROVED";
  const canComplete = order.status === "EXECUTING";
  const canCancel = isCancellableStatus(order.status);
  const isPending = order.status === "PENDING";

  // -- render: detail -------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/workorders")}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            type="button"
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
          {/* Edit button — disabled when PENDING (ATB-03) */}
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
            onClick={fetchOrder}
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
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* PENDING status warning (ATB-03) */}
      {isPending && (
        <div
          className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          role="alert"
          data-testid="work-order-pending-warning"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">当前状态不允许编辑</p>
            <p className="mt-1">
              工单正在审批中（状态：待审批/PENDING），无法进行编辑操作。
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
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={operating}
            className="px-4 py-2 text-sm font-medium text-gray-500 bg-blue-50 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消工单
          </button>
        )}

        {/* Submit for approval */}
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

        {/* Start execution */}
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

        {/* Complete */}
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
    </div>
  );
}

export default WorkOrderDetailPage;
