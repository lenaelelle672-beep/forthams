/**
 * @module frontend/src/app/components/approval/ApprovalActionPanel
 * @description Provides an action panel for submitting approval decisions.
 *
 * Renders a comment textarea together with Approve and Reject buttons.
 * Validates that a comment is provided before invoking the corresponding
 * callback. Supports disabled and loading states.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../ui/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalActionPayload {
  /** The ID of the approval process to act upon. */
  approvalId: string;
  /** The reviewer's comment / opinion. */
  comment: string;
}

export interface ApprovalActionPanelProps {
  /** The ID of the approval process being reviewed. */
  approvalId: string;
  /** Whether the panel controls are disabled. */
  disabled?: boolean;
  /** Whether an action is currently in progress. */
  loading?: boolean;
  /** Called when the user clicks Approve. */
  onApprove: (payload: ApprovalActionPayload) => void;
  /** Called when the user clicks Reject. */
  onReject: (payload: ApprovalActionPayload) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalActionPanel — a form for submitting an approval or rejection.
 *
 * Features:
 * - Textarea for entering an approval comment
 * - Approve button (green) and Reject button (red)
 * - Front-end validation: empty comment shows a warning message
 * - Supports `disabled` and `loading` states
 * - Does NOT call Axios directly; delegates action through callbacks
 */
export const ApprovalActionPanel: React.FC<ApprovalActionPanelProps> = ({
  approvalId,
  disabled = false,
  loading = false,
  onApprove,
  onReject,
}) => {
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(e.target.value);
      // Clear validation error once the user starts typing
      if (validationError) {
        setValidationError(null);
      }
    },
    [validationError],
  );

  const handleApprove = useCallback(() => {
    if (!comment.trim()) {
      setValidationError('请输入审批意见后再进行操作');
      return;
    }
    setValidationError(null);
    onApprove({ approvalId, comment: comment.trim() });
  }, [approvalId, comment, onApprove]);

  const handleReject = useCallback(() => {
    if (!comment.trim()) {
      setValidationError('请输入驳回理由后再进行操作');
      return;
    }
    setValidationError(null);
    onReject({ approvalId, comment: comment.trim() });
  }, [approvalId, comment, onReject]);

  const isDisabled = disabled || loading;

  return (
    <div className="flex flex-col gap-3">
      {/* ---- Comment input ---- */}
      <div>
        <label
          htmlFor="approval-comment"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          审批意见
        </label>
        <textarea
          id="approval-comment"
          className={cn(
            'w-full rounded-md border px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            validationError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500',
            isDisabled && 'cursor-not-allowed bg-gray-50 text-gray-400',
          )}
          rows={3}
          placeholder="请输入审批意见..."
          value={comment}
          onChange={handleCommentChange}
          disabled={isDisabled}
        />
      </div>

      {/* ---- Validation message ---- */}
      {validationError && (
        <p className="text-sm text-red-600">{validationError}</p>
      )}

      {/* ---- Action buttons ---- */}
      <div className="flex items-center gap-3">
        {/* Approve */}
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1',
            isDisabled
              ? 'cursor-not-allowed bg-green-300'
              : 'bg-green-600 hover:bg-green-700',
          )}
          onClick={handleApprove}
          disabled={isDisabled}
        >
          {loading ? (
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
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
          ) : null}
          通过
        </button>

        {/* Reject */}
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1',
            isDisabled
              ? 'cursor-not-allowed bg-red-300'
              : 'bg-red-600 hover:bg-red-700',
          )}
          onClick={handleReject}
          disabled={isDisabled}
        >
          驳回
        </button>
      </div>
    </div>
  );
};

export default ApprovalActionPanel;
