/**
 * ApprovalActions component
 *
 * Renders the approve / reject action panel for a single work-order.
 * Exposes `data-testid` attributes required by ATB-007 / ATB-008 / ATB-009.
 *
 * Props
 * ─────
 *  workOrderId  – numeric ID of the target work-order
 *  status       – current WorkOrderStatus; buttons are disabled when the
 *                 order is no longer PENDING_APPROVAL / APPROVING
 *  onActionDone – optional callback invoked after a successful approve /
 *                 reject so the parent can refresh its data
 */

import React, { useState, useCallback } from 'react';
import { approveWorkOrder, rejectWorkOrder } from '../api/workOrderApi';
import type { WorkOrderStatus } from '../types/workOrder';

// ─── types ────────────────────────────────────────────────────────────────────

export interface ApprovalActionsProps {
  /** Numeric work-order identifier. */
  workOrderId: number;
  /** Current lifecycle status – used to decide whether actions are enabled. */
  status: WorkOrderStatus;
  /** Callback executed after a successful approve or reject operation. */
  onActionDone?: () => void;
}

type ActionResult =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

// ─── constants ────────────────────────────────────────────────────────────────

/** Statuses that allow the current user to act on the work-order. */
const ACTIONABLE_STATUSES: WorkOrderStatus[] = [
  'PENDING_APPROVAL',
  'APPROVING',
];

// ─── component ────────────────────────────────────────────────────────────────

/**
 * ApprovalActions
 *
 * Displays an optional comment text-area plus "Approve" and "Reject"
 * buttons.  Buttons are disabled while a request is in flight or when
 * the work-order is already in a terminal state.
 */
const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  workOrderId,
  status,
  onActionDone,
}) => {
  const [comment, setComment] = useState<string>('');
  const [result, setResult] = useState<ActionResult>({ kind: 'idle' });

  const isActionable = ACTIONABLE_STATUSES.includes(status);
  const isLoading = result.kind === 'loading';
  const isDisabled = !isActionable || isLoading;

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Resets the toast after a short delay so repeated actions are visible.
   */
  const scheduleReset = useCallback(() => {
    setTimeout(() => setResult({ kind: 'idle' }), 4000);
  }, []);

  // ── handlers ───────────────────────────────────────────────────────────────

  /**
   * Submits an approve action for the current work-order.
   */
  const handleApprove = useCallback(async () => {
    setResult({ kind: 'loading' });
    try {
      await approveWorkOrder(workOrderId, comment.trim() || undefined);
      setResult({ kind: 'success', message: '审批成功' });
      setComment('');
      scheduleReset();
      onActionDone?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '审批操作失败，请稍后重试';
      setResult({ kind: 'error', message });
      scheduleReset();
    }
  }, [workOrderId, comment, onActionDone, scheduleReset]);

  /**
   * Submits a reject action for the current work-order.
   */
  const handleReject = useCallback(async () => {
    setResult({ kind: 'loading' });
    try {
      await rejectWorkOrder(workOrderId, comment.trim() || undefined);
      setResult({ kind: 'success', message: '已驳回工单' });
      setComment('');
      scheduleReset();
      onActionDone?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '驳回操作失败，请稍后重试';
      setResult({ kind: 'error', message });
      scheduleReset();
    }
  }, [workOrderId, comment, onActionDone, scheduleReset]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="approval-actions" data-testid="approval-actions">
      {/* ── toast ─────────────────────────────────────────────────────── */}
      {result.kind === 'success' && (
        <div
          className="approval-actions__toast approval-actions__toast--success"
          data-testid="success-toast"
          role="status"
          aria-live="polite"
        >
          {result.message}
        </div>
      )}

      {result.kind === 'error' && (
        <div
          className="approval-actions__toast approval-actions__toast--error"
          data-testid="error-toast"
          role="alert"
          aria-live="assertive"
        >
          {result.message}
        </div>
      )}

      {/* ── non-actionable notice ──────────────────────────────────────── */}
      {!isActionable && (
        <p
          className="approval-actions__notice"
          data-testid="non-actionable-notice"
        >
          当前工单状态（{status}）不支持审批操作。
        </p>
      )}

      {/* ── comment input ─────────────────────────────────────────────── */}
      <div className="approval-actions__field">
        <label
          htmlFor="approval-comment"
          className="approval-actions__label"
        >
          审批意见
          <span className="approval-actions__label-hint">（选填）</span>
        </label>
        <textarea
          id="approval-comment"
          className="approval-actions__textarea"
          data-testid="comment-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isDisabled}
          placeholder="请输入审批意见…"
          rows={3}
          maxLength={500}
          aria-label="审批意见"
        />
      </div>

      {/* ── action buttons ────────────────────────────────────────────── */}
      <div className="approval-actions__buttons">
        <button
          type="button"
          className="approval-actions__btn approval-actions__btn--approve"
          data-testid="approve-btn"
          disabled={isDisabled}
          onClick={handleApprove}
          aria-busy={isLoading}
        >
          {isLoading ? '处理中…' : '审批通过'}
        </button>

        <button
          type="button"
          className="approval-actions__btn approval-actions__btn--reject"
          data-testid="reject-btn"
          disabled={isDisabled}
          onClick={handleReject}
          aria-busy={isLoading}
        >
          {isLoading ? '处理中…' : '驳回'}
        </button>
      </div>
    </div>
  );
};

export default ApprovalActions;