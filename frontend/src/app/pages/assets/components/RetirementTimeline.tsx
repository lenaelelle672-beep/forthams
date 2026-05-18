/**
 * RetirementTimeline — Pure presentational component that renders the
 * retirement application workflow as a vertical timeline.
 *
 * SWARM-053: Accepts an array of status nodes (timeline entries) and renders
 * each one with an appropriate icon and color. This component performs NO
 * business write operations (mutations); it is purely display-only.
 *
 * @module pages/assets/components/RetirementTimeline
 * @since SWARM-053
 */

import React from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single node in the retirement timeline.
 *
 * @description Represents a status change or action taken during the
 * retirement workflow lifecycle.
 */
export interface TimelineNode {
  /** Unique identifier for this node */
  id: string;
  /** Action or status label (e.g. 'SUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'COMPLETE') */
  action: string;
  /** Display label for the action */
  label?: string;
  /** Operator or actor who performed the action */
  operator?: string;
  /** Optional comment or reason */
  comment?: string;
  /** Timestamp of the action (ISO 8601) */
  timestamp?: string;
  /** Whether this node represents the current active step */
  isCurrent?: boolean;
}

/**
 * Props for the RetirementTimeline component.
 */
export interface RetirementTimelineProps {
  /** Ordered array of timeline nodes to render */
  nodes: TimelineNode[];
  /** Optional additional CSS class name */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map action types to Chinese display labels.
 *
 * @param action - The action string from backend
 * @returns Display label in Chinese
 */
function getActionLabel(action: string): string {
  const labelMap: Record<string, string> = {
    SUBMIT: '已提交',
    APPROVE: '已审批',
    REJECT: '已驳回',
    CANCEL: '已取消',
    COMPLETE: '已完成',
    PENDING: '待审批',
    INITIATE: '发起退役',
    // Lowercase variants
    submit: '已提交',
    approve: '已审批',
    reject: '已驳回',
    cancel: '已取消',
    complete: '已完成',
    pending: '待审批',
    initiate: '发起退役',
  };
  return labelMap[action] ?? action;
}

/**
 * Determine the badge variant based on action type.
 *
 * @param action - The action string
 * @returns Badge variant string
 */
function getBadgeVariant(
  action: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const upper = action.toUpperCase();
  if (upper === 'APPROVE' || upper === 'COMPLETE') return 'secondary';
  if (upper === 'REJECT' || upper === 'CANCEL') return 'destructive';
  if (upper === 'PENDING') return 'outline';
  return 'default';
}

/**
 * Format a date-time string for display.
 *
 * @param value - ISO date string or undefined
 * @returns Formatted date string
 */
function formatDateTime(value: string | undefined | null): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RetirementTimeline component
 *
 * Renders a vertical timeline of retirement workflow status changes.
 * Each node displays an icon, action label, operator, comment, and timestamp.
 *
 * @param props - Component props with nodes array
 * @returns The timeline JSX
 */
export const RetirementTimeline: React.FC<RetirementTimelineProps> = ({
  nodes,
  className = '',
}) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 text-gray-400 text-sm py-4 ${className}`}
        data-testid="retirement-timeline-empty"
      >
        <Clock className="w-4 h-4" />
        <span>暂无审批记录</span>
      </div>
    );
  }

  return (
    <div
      className={`space-y-0 ${className}`}
      data-testid="retirement-timeline"
    >
      {nodes.map((node, idx) => {
        const upper = node.action.toUpperCase();
        const isSuccess = upper === 'APPROVE' || upper === 'COMPLETE';
        const isReject = upper === 'REJECT';
        const isCancel = upper === 'CANCEL';
        const isPending = upper === 'PENDING';
        const isSubmit = upper === 'SUBMIT' || upper === 'INITIATE';
        const isLast = idx === nodes.length - 1;

        return (
          <div
            key={node.id ?? idx}
            className="flex gap-3"
            data-testid="retirement-timeline-node"
          >
            {/* Timeline track */}
            <div className="flex flex-col items-center">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isSuccess ? (
                  <CheckCircle className="w-5 h-5 text-green-500" data-testid="node-icon-success" />
                ) : isReject ? (
                  <XCircle className="w-5 h-5 text-red-500" data-testid="node-icon-reject" />
                ) : isCancel ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" data-testid="node-icon-cancel" />
                ) : isPending ? (
                  <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" data-testid="node-icon-pending" />
                ) : isSubmit ? (
                  <FileText className="w-5 h-5 text-blue-500" data-testid="node-icon-submit" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" data-testid="node-icon-default" />
                )}
              </div>

              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`w-px flex-1 min-h-6 ${
                    isSuccess ? 'bg-green-200' : isReject || isCancel ? 'bg-red-200' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {node.operator ?? `审批节点 ${idx + 1}`}
                </span>
                <Badge
                  variant={getBadgeVariant(node.action)}
                  className="text-xs"
                  data-testid="node-badge"
                >
                  {node.label ?? getActionLabel(node.action)}
                </Badge>
              </div>
              {node.comment && (
                <p className="text-sm text-gray-500 mt-1">
                  {node.comment}
                </p>
              )}
              {node.timestamp && (
                <p className="text-xs text-gray-400 mt-1">
                  {formatDateTime(node.timestamp)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RetirementTimeline;
