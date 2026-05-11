/**
 * @module frontend/src/app/components/approval/ApprovalFlowChart
 * @description Renders a visual flow chart of the approval history chain.
 *
 * Displays each ApprovalHistoryItem as a node showing the operator, status,
 * timestamp, and comment. The current / last node is highlighted. Shows an
 * empty-state prompt when the history array is empty.
 */

import React from 'react';
import type { ApprovalHistoryItem } from '../../services/approval/types';
import { cn } from '../ui/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ApprovalFlowChartProps {
  /** Ordered list of approval history records (oldest → newest). */
  approvalHistory: ApprovalHistoryItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp into a readable locale string. */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Map ApprovalResult to a display label. */
function statusLabel(status: string): string {
  switch (status) {
    case 'APPROVED':
      return '已通过';
    case 'REJECTED':
      return '已驳回';
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalFlowChart — renders a vertical timeline of approval steps.
 *
 * Each step shows:
 * - Step number badge
 * - Operator ID
 * - Status with colour coding
 * - Timestamp
 * - Comment (if present)
 *
 * The last node in the list is visually highlighted to indicate the current
 * state of the approval chain. When the history array is empty a placeholder
 * message is displayed instead.
 */
export const ApprovalFlowChart: React.FC<ApprovalFlowChartProps> = ({
  approvalHistory,
}) => {
  // ---- Empty state --------------------------------------------------------
  if (!approvalHistory || approvalHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <svg
          className="mb-2 h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="text-sm">暂无审批记录</span>
      </div>
    );
  }

  const lastStepIndex = approvalHistory.length - 1;

  return (
    <div className="flex flex-col">
      {approvalHistory.map((record, idx) => {
        const isLast = idx === lastStepIndex;
        const isApproved = record.status === 'APPROVED';
        const isRejected = record.status === 'REJECTED';

        return (
          <div key={record.id} className="flex items-start">
            {/* ---- Left: step indicator ---- */}
            <div className="flex flex-col items-center">
              {/* Step badge */}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  isLast && isApproved && 'bg-green-500 text-white',
                  isLast && isRejected && 'bg-red-500 text-white',
                  isLast && !isApproved && !isRejected && 'bg-blue-500 text-white',
                  !isLast && isApproved && 'border-2 border-green-500 text-green-600',
                  !isLast && isRejected && 'border-2 border-red-500 text-red-600',
                  !isLast && !isApproved && !isRejected && 'border-2 border-gray-300 text-gray-500',
                )}
              >
                {record.stepNo}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="h-full w-0.5 bg-gray-200" />
              )}
            </div>

            {/* ---- Right: step details ---- */}
            <div className={cn('ml-4 pb-6', isLast && 'pb-0')}>
              <div className="flex flex-wrap items-center gap-2">
                {/* Operator */}
                <span className={cn(
                  'text-sm font-medium',
                  isLast ? 'text-gray-900' : 'text-gray-700',
                )}>
                  操作人 #{record.operator}
                </span>

                {/* Status badge */}
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    isApproved && 'bg-green-50 text-green-700',
                    isRejected && 'bg-red-50 text-red-700',
                    !isApproved && !isRejected && 'bg-gray-100 text-gray-600',
                  )}
                >
                  {statusLabel(record.status)}
                </span>

                {/* Timestamp */}
                <span className="text-xs text-gray-400">
                  {formatTime(record.operatedAt)}
                </span>
              </div>

              {/* Comment */}
              {record.comment && (
                <p className={cn(
                  'mt-1 text-sm',
                  isLast ? 'text-gray-700' : 'text-gray-500',
                )}>
                  {record.comment}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovalFlowChart;
