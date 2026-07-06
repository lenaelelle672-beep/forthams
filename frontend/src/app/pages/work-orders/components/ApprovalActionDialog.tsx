/**
 * @module frontend/src/app/pages/work-orders/components/ApprovalActionDialog
 * @description Modal confirmation dialog for work order approve/reject actions
 *              in the approval inbox view.
 *
 * Features:
 * - Controlled dialog driven by `isOpen` and `onConfirm` props
 * - Dynamic title based on action type (approve / reject)
 * - Comment textarea with required validation for reject action
 * - Validation error display when comment is required but empty
 * - Does NOT directly import or call workOrderService (data-flow boundary)
 *
 * @see frontend/src/app/pages/work-orders/WorkOrderApprovalInboxPage.tsx
 */

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for ApprovalActionDialog. */
export interface ApprovalActionDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Action type — determines title and whether comment is required. */
  type: "approve" | "reject";
  /** Called when the user confirms with a valid comment. */
  onConfirm: (comment: string) => void;
  /** Called when the dialog should close (cancel or backdrop click). */
  onClose: () => void;
  /** Whether a parent-level submission is in progress. */
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalActionDialog — controlled form dialog for approve/reject actions.
 *
 * Renders a modal with a comment textarea. For "reject" type, the comment is
 * required and validation prevents submission with an empty field.
 * For "approve" type, comment is optional.
 *
 * Does NOT call any API or hook directly — receives `onConfirm(comment)` prop.
 *
 * @param props — dialog configuration and callbacks
 */
export function ApprovalActionDialog({
  isOpen,
  type,
  onConfirm,
  onClose,
  isSubmitting = false,
}: ApprovalActionDialogProps) {
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  /** Reset internal state when dialog opens. */
  useEffect(() => {
    if (isOpen) {
      setComment("");
      setCommentError(null);
    }
  }, [isOpen]);

  /**
   * Handle confirm button click.
   * For "reject": validates that comment is non-empty before calling onConfirm.
   * For "approve": calls onConfirm directly (comment optional).
   */
  const handleConfirm = useCallback(() => {
    if (type === "reject" && !comment.trim()) {
      setCommentError("驳回原因不能为空");
      return;
    }
    setCommentError(null);
    onConfirm(comment.trim());
  }, [type, comment, onConfirm]);

  /**
   * Handle comment input change — clear validation error on input.
   */
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(e.target.value);
      if (commentError) {
        setCommentError(null);
      }
    },
    [commentError],
  );

  /** Handle backdrop click to close dialog. */
  const handleBackdropClick = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  // -----------------------------------------------------------------------
  // Render guard
  // -----------------------------------------------------------------------

  if (!isOpen) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const isReject = type === "reject";
  const dialogTitle = type === "approve" ? "审批通过" : "审批驳回";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
      data-testid={`approval-action-dialog-${type}`}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-lg font-semibold text-gray-900">{dialogTitle}</h2>

        {/* Body */}
        <div className="mt-4">
          <label
            htmlFor="input-approval-comment"
            className="block text-sm font-medium text-gray-700"
          >
            审批意见
          </label>
          <textarea
            id="input-approval-comment"
            name="comment"
            aria-label="审批意见"
            role="textbox"
            className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            placeholder={isReject ? "请输入驳回原因（必填）" : "请输入审批意见（选填）"}
            value={comment}
            onChange={handleCommentChange}
            disabled={isSubmitting}
            data-testid="input-approval-comment"
          />
        </div>

        {/* Comment validation error */}
        {commentError && (
          <p
            className="mt-2 text-sm text-red-600"
            data-testid="error-comment-required"
          >
            {commentError}
          </p>
        )}

        {/* Footer buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || (isReject && !comment.trim())}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              type === "approve"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isSubmitting ? "提交中..." : "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalActionDialog;
