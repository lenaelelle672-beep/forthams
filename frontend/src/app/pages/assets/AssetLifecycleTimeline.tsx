/**
 * AssetLifecycleTimeline — Vertical timeline of asset lifecycle events.
 *
 * SWARM-069: Displays a chronological timeline of all state transitions
 * for an asset (creation → assignment → maintenance → retirement → scrapped),
 * rendered as a vertical timeline with status-coded nodes.
 *
 * Terminal-state nodes (SCRAPPED, RETIRED, DISPOSED) are rendered with a
 * "terminal" visual indicator and no forward-action buttons, enforcing the
 * backend state machine's irreversibility constraint.
 *
 * @module pages/assets/AssetLifecycleTimeline
 * @since SWARM-069
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';
import type { LifecycleNode } from '../../services/assetDetailApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the AssetLifecycleTimeline component.
 */
export interface AssetLifecycleTimelineProps {
  /** Lifecycle nodes ordered by timestamp descending (newest first) */
  nodes: LifecycleNode[];
  /** Optional CSS class name for the outer container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a timestamp for display.
 *
 * @param value - ISO date string
 * @returns Formatted date string
 */
function formatTimestamp(value: string): string {
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

/**
 * Get the icon element for a node's visual status.
 *
 * @param nodeStatus - The visual status indicator
 * @returns Icon element
 */
function getNodeIcon(nodeStatus: LifecycleNode['nodeStatus']): React.ReactNode {
  switch (nodeStatus) {
    case 'terminal':
      return <CheckCircle2 className="w-4 h-4 text-gray-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'normal':
    default:
      return <Clock className="w-4 h-4 text-blue-500" />;
  }
}

/**
 * Get the CSS classes for the timeline dot based on node status.
 *
 * @param nodeStatus - The visual status indicator
 * @returns CSS class string for the dot element
 */
function getDotClasses(nodeStatus: LifecycleNode['nodeStatus']): string {
  switch (nodeStatus) {
    case 'terminal':
      return 'w-3 h-3 rounded-full bg-gray-400 border-2 border-white ring-2 ring-[#1e3a5f] flex-shrink-0';
    case 'warning':
      return 'w-3 h-3 rounded-full bg-yellow-400 border-2 border-white ring-2 ring-yellow-100 flex-shrink-0';
    case 'normal':
    default:
      return 'w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-2 ring-blue-100 flex-shrink-0';
  }
}

/**
 * Get badge variant for a status value.
 *
 * @param status - Status string
 * @returns Badge variant name
 */
function getStatusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const upper = status.toUpperCase();
  if (['RETIRED', 'COMPLETED', 'SCRAPPED', 'DISPOSED'].includes(upper)) return 'secondary';
  if (['REJECTED', 'CANCELLED'].includes(upper)) return 'destructive';
  if (['APPROVED', 'ACTIVE'].includes(upper)) return 'default';
  return 'outline';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetLifecycleTimeline component
 *
 * Renders a vertical timeline of asset lifecycle events. Each node shows
 * the event type, operator, timestamp, and status badges for the transition.
 * Nodes are sorted newest-first, with the latest event at the top.
 *
 * Terminal-state events render with a greyed-out dot icon to indicate
 * the irreversible nature of the state change.
 *
 * @param props - Component props including lifecycle nodes
 * @returns The lifecycle timeline JSX
 */
export const AssetLifecycleTimeline: React.FC<AssetLifecycleTimelineProps> = ({
  nodes,
  className,
}) => {
  // Empty state
  if (!nodes || nodes.length === 0) {
    return (
      <div className={className ?? ''} data-testid="lifecycle-timeline-empty">
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Activity className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-muted-foreground">暂无生命周期记录</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`asset-lifecycle-timeline ${className ?? ''}`}
      data-testid="lifecycle-timeline"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4" />
            生命周期时间线
            <Badge variant="secondary" className="ml-2">
              {nodes.length} 条记录
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {nodes.map((node, index) => (
              <div
                key={node.id ?? index}
                className="flex gap-3"
                data-testid={`lifecycle-node-${index}`}
              >
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className={`${getDotClasses(node.nodeStatus)} mt-1.5`} />
                  {index < nodes.length - 1 && (
                    <div className="w-px h-full bg-blue-50 min-h-[24px]" />
                  )}
                </div>
                {/* Content */}
                <div className="pb-4 min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getNodeIcon(node.nodeStatus)}
                    <span className="text-sm font-medium text-gray-900">
                      {node.eventLabel}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(node.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">
                      操作人: {node.operator}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {node.fromStatus}
                    </Badge>
                    <span className="text-gray-400">→</span>
                    <Badge variant={getStatusBadgeVariant(node.toStatus)} className="text-xs">
                      {node.toStatus}
                    </Badge>
                  </div>
                  {node.reason && (
                    <p className="text-xs text-gray-400 mt-1">{node.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetLifecycleTimeline;
