import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Work order status enum matching backend `OrderStatus`. */
type OrderStatus =
  | 'PENDING'
  | 'APPROVING_LEVEL_1'
  | 'APPROVING_LEVEL_2'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/** A single approval record persisted in `approval_records`. */
interface ApprovalRecord {
  id: number;
  orderId: number;
  operatorId: number;
  operatorName: string;
  action: 'APPROVE' | 'REJECT';
  comment: string | null;
  createdAt: string; // ISO 8601
}

/** The work order detail returned by the backend. */
interface WorkOrderDetail {
  id: number;
  orderNo: string;
  applicantId: number;
  applicantName: string;
  departmentName: string;
  title: string;
  description: string;
  status: OrderStatus;
  version: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  approvalRecords: ApprovalRecord[];
}

/** API error shape returned by the backend. */
interface ApiError {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REJECTION_REASON_MAX_LENGTH = 500;

/** Human-readable status labels. */
const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '待提交',
  APPROVING_LEVEL_1: '部门主管审批中',
  APPROVING_LEVEL_2: '资产管理员审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
};

/** Status → Tailwind colour token mapping. */
const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  APPROVING_LEVEL_1: 'bg-blue-100 text-blue-700',
  APPROVING_LEVEL_2: 'bg-indigo-100 text-indigo-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

/** Determine whether the current approval level can act on this order. */
function canActOnStatus(status: OrderStatus): boolean {
  return status === 'APPROVING_LEVEL_1' || status === 'APPROVING_LEVEL_2';
}

/** Determine whether the order is in a terminal state. */
function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO 8601 date string to a locale-friendly display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Spinner shown during data fetching or action submission. */
function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-5 w-5 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** A single row in the approval history timeline. */
function ApprovalRecordRow({ record }: { record: ApprovalRecord }) {
  const isApprove = record.action === 'APPROVE';
  return (
    <div className="flex items-start gap-3 py-3">
      {/* Icon */}
      <span
        className={`mt-0.5 flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full ${
          isApprove ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        }`}
      >
        {isApprove ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {record.operatorName}
          <span className="ml-2 font-normal text-gray-500">
            {isApprove ? '审批通过' : '审批驳回'}
          </span>
        </p>
        {record.comment && (
          <p className="mt-1 text-sm text-gray-600 break-words">{record.comment}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">{formatDate(record.createdAt)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reject Dialog
// ---------------------------------------------------------------------------

interface RejectDialogProps {
  open: boolean;
  loading: boolean;
  /** Called when the user confirms rejection. */
  onConfirm: (reason: string) => void;
  /** Called when the user cancels or closes the dialog. */
  onCancel: () => void;
}

/**
 * Modal dialog for entering a rejection reason.
 *
 * Enforces the SPEC constraint: `rejectionReason` is a non-empty string
 * with a maximum of 500 characters. Frontend validation blocks submission
 * when the reason is empty and shows an inline error message.
 */
function RejectDialog({ open, loading, onConfirm, onCancel }: RejectDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const isEmpty = reason.trim().length === 0;
  const isTooLong = reason.length > REJECTION_REASON_MAX_LENGTH;
  const showError = touched && (isEmpty || isTooLong);

  const handleConfirm = useCallback(() => {
    setTouched(true);
    if (isEmpty || isTooLong) return;
    onConfirm(reason.trim());
  }, [reason, isEmpty, isTooLong, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [handleConfirm],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-dialog-title"
        className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl p-6"
      >
        <h2 id="reject-dialog-title" className="text-lg font-semibold text-gray-900">
          驳回工单
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          请填写驳回原因（必填，最多 {REJECTION_REASON_MAX_LENGTH} 字）。
        </p>

        {/* Textarea */}
        <div className="mt-4">
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={handleKeyDown}
            placeholder="请输入驳回原因…"
            rows={4}
            maxLength={REJECTION_REASON_MAX_LENGTH + 1}
            className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 resize-none ${
              showError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
            }`}
            aria-invalid={showError}
            aria-describedby={showError ? 'reject-error' : undefined}
          />
          <div className="mt-1 flex items-center justify-between">
            {showError && (
              <p id="reject-error" className="text-xs text-red-500" role="alert">
                {isEmpty ? '驳回原因不能为空' : `驳回原因不能超过 ${REJECTION_REASON_MAX_LENGTH} 字`}
              </p>
            )}
            <span
              className={`ml-auto text-xs ${
                reason.length > REJECTION_REASON_MAX_LENGTH ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {reason.length} / {REJECTION_REASON_MAX_LENGTH}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading && <Spinner className="h-4 w-4 text-white" />}
            确认驳回
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component: ApprovalDetail
// ---------------------------------------------------------------------------

/**
 * ApprovalDetail — displays the full detail of a work order awaiting (or
 * having undergone) approval, together with the approval history timeline
 * and action buttons (approve / reject).
 *
 * ## SPEC alignment
 * - **ATB-5**: Approve transitions the order to the next level; reject
 *   requires a non-empty reason (max 500 chars) and transitions to REJECTED.
 * - **State machine**: Only orders in `APPROVING_LEVEL_1` or
 *   `APPROVING_LEVEL_2` expose action buttons.
 * - **Error handling**: HTTP 409 (conflict / invalid transition) and
 *   HTTP 400 (missing rejection reason) are surfaced to the user.
 * - **Optimistic lock**: The current `version` is sent with every action
 *   request to satisfy the backend concurrency constraint.
 */
const ApprovalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ---- Local state ----
  const [order, setOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Success / error toasts (simple banner approach)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ---- Derived ----
  const orderId = useMemo(() => Number(id), [id]);
  const actionable = useMemo(() => order !== null && canActOnStatus(order.status), [order]);
  const terminal = useMemo(() => order !== null && isTerminalStatus(order.status), [order]);

  // ---- Data fetching ----
  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.message ?? `请求失败 (${res.status})`);
      }
      const data = (await res.json()) as WorkOrderDetail;
      setOrder(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!Number.isNaN(orderId)) {
      fetchOrder();
    }
  }, [orderId, fetchOrder]);

  // ---- Toast auto-dismiss ----
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ---- Actions ----

  /** POST /api/orders/{id}/approve */
  const handleApprove = useCallback(async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: order.version }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        if (res.status === 409) {
          throw new Error(body?.message ?? '状态冲突：工单可能已被其他人处理，请刷新后重试');
        }
        throw new Error(body?.message ?? `审批通过失败 (${res.status})`);
      }
      setToast({ type: 'success', message: '审批通过，工单已流转至下一级' });
      await fetchOrder();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '操作失败' });
    } finally {
      setActionLoading(false);
    }
  }, [order, orderId, fetchOrder]);

  /** POST /api/orders/{id}/reject with mandatory rejectionReason. */
  const handleReject = useCallback(
    async (reason: string) => {
      if (!order) return;
      setActionLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: order.version,
            rejectionReason: reason,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiError | null;
          if (res.status === 400) {
            throw new Error(body?.message ?? '驳回原因不合法，请检查后重试');
          }
          if (res.status === 409) {
            throw new Error(body?.message ?? '状态冲突：工单可能已被其他人处理，请刷新后重试');
          }
          throw new Error(body?.message ?? `驳回失败 (${res.status})`);
        }
        setToast({ type: 'success', message: '已驳回工单' });
        setRejectDialogOpen(false);
        await fetchOrder();
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : '操作失败' });
      } finally {
        setActionLoading(false);
      }
    },
    [order, orderId, fetchOrder],
  );

  // ---- Render helpers ----

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8 text-blue-500" />
        <span className="ml-3 text-gray-500">加载中…</span>
      </div>
    );
  }

  if (fetchError || !order) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium">加载工单详情失败</p>
          <p className="mt-1 text-sm text-red-500">{fetchError ?? '工单不存在'}</p>
          <button
            type="button"
            onClick={() => navigate('/approvals/pending')}
            className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
          >
            返回审批列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Toast banner */}
      {toast && (
        <div
          role="alert"
          className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium shadow-sm ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-3 float-right text-current opacity-60 hover:opacity-100"
            aria-label="关闭提示"
          >
            ✕
          </button>
        </div>
      )}

      {/* Back navigation */}
      <button
        type="button"
        onClick={() => navigate('/approvals/pending')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        返回审批列表
      </button>

      {/* ---- Order info card ---- */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">{order.title}</h1>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLOR[order.status]}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </div>

        {/* Meta fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 px-6 py-5 text-sm">
          <InfoRow label="工单编号" value={order.orderNo} />
          <InfoRow label="当前状态" value={STATUS_LABEL[order.status]} />
          <InfoRow label="申请人" value={order.applicantName} />
          <InfoRow label="所属部门" value={order.departmentName} />
          <InfoRow label="提交时间" value={formatDate(order.createdAt)} />
          <InfoRow label="最后更新" value={formatDate(order.updatedAt)} />
        </div>

        {/* Description */}
        {order.description && (
          <div className="border-t border-gray-100 px-6 py-4">
            <h2 className="text-sm font-medium text-gray-700 mb-2">工单描述</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {order.description}
            </p>
          </div>
        )}

        {/* Action buttons */}
        {actionable && (
          <div className="border-t border-gray-100 px-6 py-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? <Spinner className="h-4 w-4 text-white" /> : null}
              通过
            </button>
            <button
              type="button"
              onClick={() => setRejectDialogOpen(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              驳回
            </button>
          </div>
        )}

        {/* Terminal state notice */}
        {terminal && (
          <div className="border-t border-gray-100 px-6 py-4">
            <p className="text-sm text-gray-500">
              该工单已结束审批流程（{STATUS_LABEL[order.status]}），无法继续操作。
            </p>
          </div>
        )}
      </section>

      {/* ---- Approval history timeline ---- */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">审批记录</h2>
        </div>

        {order.approvalRecords.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            暂无审批记录
          </div>
        ) : (
          <div className="divide-y divide-gray-50 px-6">
            {order.approvalRecords.map((record) => (
              <ApprovalRecordRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Reject dialog ---- */}
      <RejectDialog
        open={rejectDialogOpen}
        loading={actionLoading}
        onConfirm={handleReject}
        onCancel={() => setRejectDialogOpen(false)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny utility components
// ---------------------------------------------------------------------------

/** Renders a label + value pair for the order meta grid. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400 text-xs">{label}</dt>
      <dd className="mt-0.5 text-gray-900 font-medium">{value}</dd>
    </div>
  );
}

export default ApprovalDetail;