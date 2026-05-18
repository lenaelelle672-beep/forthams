/**
 * @module frontend/src/app/components/approval/ApprovalFlowChart
 * @description Renders a visual flow chart of the approval history chain.
 *
 * Displays each ApprovalHistoryItem as a node showing the operator, status,
 * timestamp, and comment. The current / last node is highlighted. Shows an
 * empty-state prompt when the history array is empty.
 */

import React from 'react';
import type { ApprovalHistoryItem, ApprovalItem } from '../../services/approval/types';
import { cn } from '../ui/utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ApprovalFlowChartProps {
  /** Current approval process returned by the backend detail API. */
  approval?: ApprovalItem | null;
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
    case 'PENDING':
      return '待审批';
    case 'APPROVED':
      return '已通过';
    case 'REJECTED':
      return '已驳回';
    case 'COMPLETED':
      return '已完成';
    case 'CANCELLED':
      return '已取消';
    default:
      return status;
  }
}

function statusClasses(status: string, isCurrent: boolean): string {
  if (status === 'APPROVED' || status === 'COMPLETED') {
    return isCurrent ? 'bg-green-500 text-white' : 'border-2 border-green-500 text-green-600';
  }
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return isCurrent ? 'bg-red-500 text-white' : 'border-2 border-red-500 text-red-600';
  }
  if (status === 'PENDING') {
    return isCurrent ? 'bg-blue-500 text-white' : 'border-2 border-blue-300 text-blue-600';
  }
  return isCurrent ? 'bg-gray-500 text-white' : 'border-2 border-gray-300 text-gray-500';
}

function makeTimeline(approval: ApprovalItem | null | undefined, history: ApprovalHistoryItem[]) {
  const records = [...(history || [])].sort((left, right) => left.stepNo - right.stepNo);
  if (!approval) {
    return records.map((record) => ({ kind: 'record' as const, stepNo: record.stepNo, status: record.status, record }));
  }

  const timeline = records.map((record) => ({ kind: 'record' as const, stepNo: record.stepNo, status: record.status, record }));
  const hasCurrentRecord = records.some((record) => record.stepNo === approval.currentStep);
  if (approval.status === 'PENDING' && !hasCurrentRecord) {
    timeline.push({ kind: 'current' as const, stepNo: approval.currentStep, status: 'PENDING' as const, record: null });
  }
  if (timeline.length === 0) {
    timeline.push({ kind: 'current' as const, stepNo: approval.currentStep || 1, status: approval.status, record: null });
  }
  return timeline.sort((left, right) => left.stepNo - right.stepNo);
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
  approval,
  approvalHistory,
}) => {
  const timeline = makeTimeline(approval, approvalHistory);

  // ---- Empty state --------------------------------------------------------
  if (timeline.length === 0) {
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
        <span className="text-sm">暂无审批流转数据</span>
      </div>
    );
  }

  const lastStepIndex = timeline.length - 1;

  return (
    <div className="flex flex-col">
      {timeline.map((item, idx) => {
        const isLast = idx === lastStepIndex;
        const record = item.record;
        const key = record?.id ? `record-${record.id}` : `current-${item.stepNo}`;

        return (
          <div key={key} className="flex items-start">
            {/* ---- Left: step indicator ---- */}
            <div className="flex flex-col items-center">
              {/* Step badge */}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  statusClasses(item.status, isLast),
                )}
              >
                {item.stepNo}
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
                  {record ? `操作人 #${record.operator}` : '当前待处理节点'}
                </span>

                {/* Status badge */}
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    (item.status === 'APPROVED' || item.status === 'COMPLETED') && 'bg-green-50 text-green-700',
                    (item.status === 'REJECTED' || item.status === 'CANCELLED') && 'bg-red-50 text-red-700',
                    item.status === 'PENDING' && 'bg-blue-50 text-blue-700',
                    !['APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'PENDING'].includes(item.status) && 'bg-gray-100 text-gray-600',
                  )}
                >
                  {statusLabel(item.status)}
                </span>

                {/* Timestamp */}
                {record?.operatedAt ? (
                  <span className="text-xs text-gray-400">
                    {formatTime(record.operatedAt)}
                  </span>
                ) : null}
              </div>

              {/* Comment */}
              {record?.comment ? (
                <p className={cn(
                  'mt-1 text-sm',
                  isLast ? 'text-gray-700' : 'text-gray-500',
                )}>
                  {record.comment}
                </p>
              ) : null}
              {!record && approval ? (
                <p className="mt-1 text-sm text-gray-500">
                  流程 {approval.processNo || approval.id} 正在等待第 {item.stepNo} 步审批。
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovalFlowChart;
