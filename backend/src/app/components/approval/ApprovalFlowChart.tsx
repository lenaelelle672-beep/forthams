/**
 * @module frontend/src/app/components/approval/ApprovalFlowChart
 * @description Renders a horizontal flow chart of the approval history chain.
 *
 * Displays each ApprovalHistoryItem as a node showing the operator, status,
 * timestamp, and comment. The current / last node is highlighted with a
 * ring animation. REJECTED nodes show a tooltip with the rejection reason.
 * Shows an empty-state prompt when the history array is empty.
 *
 * Uses shadcn/ui (Badge, Tooltip) + Tailwind CSS + lucide-react icons.
 * No MUI dependencies. All colours use CSS variable-based Tailwind tokens.
 */

import React from 'react';
import { CheckCircle2, Clock, XCircle, Ban, FileText } from 'lucide-react';

import type { ApprovalHistoryItem, ApprovalItem } from '../../services/approval/types';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
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
// Status colour mapping (CSS-variable based, matching project design tokens)
// ---------------------------------------------------------------------------

/** Maps an approval status to a display label. */
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

/** Returns Tailwind background classes for each status, using CSS-variable-safe tokens. */
function statusClasses(status: string): {
  dot: string;
  badge: string;
  ring: string;
} {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return {
        dot: 'bg-green-500',
        badge: 'bg-green-50 text-green-700 border-green-200',
        ring: 'ring-green-500/20',
      };
    case 'REJECTED':
      return {
        dot: 'bg-red-500',
        badge: 'bg-red-50 text-red-700 border-red-200',
        ring: 'ring-red-500/20',
      };
    case 'CANCELLED':
      return {
        dot: 'bg-gray-400',
        badge: 'bg-gray-50 text-gray-600 border-gray-200',
        ring: 'ring-gray-400/20',
      };
    case 'PENDING':
    default:
      return {
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        ring: 'ring-amber-500/20',
      };
  }
}

/** Returns the lucide icon component for a given status. */
function statusIcon(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return CheckCircle2;
    case 'REJECTED':
      return XCircle;
    case 'CANCELLED':
      return Ban;
    case 'PENDING':
    default:
      return Clock;
  }
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

/** Timeline entry kind — either a concrete record or a placeholder current step. */
type TimelineEntry =
  | { kind: 'record'; stepNo: number; status: string; record: ApprovalHistoryItem }
  | { kind: 'current'; stepNo: number; status: string; record: null };

/**
 * Build a sorted timeline from history records and the current approval process.
 * Inserts a placeholder "current" node if the process is still PENDING.
 */
function makeTimeline(
  approval: ApprovalItem | null | undefined,
  history: ApprovalHistoryItem[],
): TimelineEntry[] {
  const records = [...(history || [])].sort((left, right) => left.stepNo - right.stepNo);

  const timeline: TimelineEntry[] = records.map((record) => ({
    kind: 'record' as const,
    stepNo: record.stepNo,
    status: record.status,
    record,
  }));

  if (!approval) {
    return timeline;
  }

  const hasCurrentRecord = records.some((record) => record.stepNo === approval.currentStep);
  if (approval.status === 'PENDING' && !hasCurrentRecord) {
    timeline.push({
      kind: 'current' as const,
      stepNo: approval.currentStep,
      status: 'PENDING' as const,
      record: null,
    });
  }
  if (timeline.length === 0) {
    timeline.push({
      kind: 'current' as const,
      stepNo: approval.currentStep || 1,
      status: approval.status,
      record: null,
    });
  }

  return timeline.sort((left, right) => left.stepNo - right.stepNo);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Connector arrow/line between nodes in the horizontal flow. */
function NodeConnector() {
  return (
    <div className="flex shrink-0 items-center" aria-hidden="true">
      <div className="h-0.5 w-6 bg-gray-200 sm:w-8" />
      <div className="h-0 w-0 border-t-[5px] border-r-[5px] border-b-[5px] border-l-[5px] border-transparent border-l-gray-300" />
    </div>
  );
}

/** Single approval node in the horizontal flow. */
function ApprovalNode({
  entry,
  isCurrent,
  approval,
}: {
  entry: TimelineEntry;
  isCurrent: boolean;
  approval: ApprovalItem | null | undefined;
}) {
  const record = entry.record;
  const colors = statusClasses(entry.status);
  const Icon = statusIcon(entry.status);
  const isRejected = entry.status === 'REJECTED' && record?.comment;

  const nodeContent = (
    <div
      data-testid={isCurrent ? 'approval-node-current' : 'approval-node'}
      className={cn(
        'flex min-w-[120px] max-w-[180px] flex-col items-center gap-2 rounded-xl border bg-white p-3 shadow-sm transition-all duration-200 sm:min-w-[140px] sm:max-w-[200px] sm:p-4',
        isCurrent && 'ring-2 ring-primary/20 shadow-md animate-pulse',
        !isCurrent && 'hover:shadow-md',
        colors.badge,
      )}
    >
      {/* Step indicator dot + icon */}
      <div
        className={cn(
          'flex size-8 items-center justify-center rounded-full sm:size-9',
          colors.dot,
          'text-white',
        )}
      >
        <Icon className="size-4 sm:size-5" />
      </div>

      {/* Step number badge */}
      <Badge
        variant="outline"
        className={cn('text-[10px] font-medium', colors.badge)}
      >
        第 {entry.stepNo} 步
      </Badge>

      {/* Operator */}
      <span className="text-xs font-medium text-gray-900">
        {record ? `操作人 #${record.operator}` : '待处理'}
      </span>

      {/* Status label */}
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
          colors.badge,
        )}
      >
        {statusLabel(entry.status)}
      </span>

      {/* Timestamp */}
      {record?.operatedAt ? (
        <span className="text-[10px] text-gray-400">
          {formatTime(record.operatedAt)}
        </span>
      ) : null}

      {/* Comment preview (truncated) */}
      {record?.comment ? (
        <p className="line-clamp-2 text-center text-[11px] text-gray-500">
          {record.comment}
        </p>
      ) : null}

      {/* Current step pending message */}
      {!record && approval ? (
        <p className="text-center text-[11px] text-gray-400">
          流程 #{approval.processNo || approval.id} 等待第 {entry.stepNo} 步审批
        </p>
      ) : null}
    </div>
  );

  // Wrap rejected nodes with a tooltip showing the rejection reason
  if (isRejected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{nodeContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          <p className="text-xs font-medium text-red-600">驳回原因</p>
          <p className="mt-1 text-xs text-gray-600">{record.comment}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return nodeContent;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * ApprovalFlowChart — renders a horizontal flow of approval steps.
 *
 * Each step shows:
 * - Status icon in a coloured circle
 * - Step number badge
 * - Operator ID
 * - Status with colour coding (amber/green/red/gray)
 * - Timestamp
 * - Comment (if present)
 *
 * The last node in the list is visually highlighted with a ring animation
 * to indicate the current state. When the history array is empty a
 * placeholder message is displayed instead.
 *
 * Layout uses flex flex-row with flex-wrap for responsive behaviour.
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
        <FileText className="mb-2 size-10" />
        <span className="text-sm">暂无审批流转数据</span>
      </div>
    );
  }

  const lastStepIndex = timeline.length - 1;

  return (
    <div className="flex flex-row flex-wrap items-center gap-3 overflow-x-hidden sm:gap-4">
      {timeline.map((entry, idx) => {
        const isCurrent = idx === lastStepIndex;
        const isLast = idx === lastStepIndex;

        return (
          <React.Fragment key={entry.record?.id ?? `current-${entry.stepNo}`}>
            <ApprovalNode
              entry={entry}
              isCurrent={isCurrent}
              approval={approval ?? null}
            />
            {!isLast && <NodeConnector />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ApprovalFlowChart;
