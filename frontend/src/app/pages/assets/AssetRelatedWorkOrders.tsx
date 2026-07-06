/**
 * AssetRelatedWorkOrders — List of work orders associated with an asset.
 *
 * SWARM-069: Displays a table of work orders related to a specific asset,
 * including work order number, type, status badge, priority, and creation
 * time. Supports data-present and empty-state rendering.
 *
 * When there are no related work orders, a "暂无关联工单" empty-state
 * message is displayed.
 *
 * @module pages/assets/AssetRelatedWorkOrders
 * @since SWARM-069
 */

import React from 'react';
import {
  Card,
  CardContent,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ClipboardList } from 'lucide-react';
import type { RelatedWorkOrderItem } from '../../services/assetDetailApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the AssetRelatedWorkOrders component.
 */
export interface AssetRelatedWorkOrdersProps {
  /** List of related work order items */
  workOrders: RelatedWorkOrderItem[];
  /** Total count for display */
  total?: number;
  /** Optional CSS class name for the outer container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map work order status to badge variant and display label.
 *
 * @param status - Work order status string from backend
 * @returns Object with variant and label for badge rendering
 */
function getStatusBadge(status: string | undefined): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  label: string;
} {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
      return { variant: 'default', label: '已完成' };
    case 'PENDING':
      return { variant: 'outline', label: '待审批' };
    case 'APPROVED':
      return { variant: 'secondary', label: '已批准' };
    case 'EXECUTING':
      return { variant: 'secondary', label: '执行中' };
    case 'REJECTED':
      return { variant: 'destructive', label: '已驳回' };
    case 'CANCELLED':
      return { variant: 'outline', label: '已取消' };
    case 'DRAFT':
      return { variant: 'outline', label: '草稿' };
    default:
      return { variant: 'outline', label: status ?? '-' };
  }
}

/**
 * Map priority to display label.
 *
 * @param priority - Priority string
 * @returns Chinese display label
 */
function getPriorityLabel(priority: string | undefined): string {
  switch (priority?.toUpperCase()) {
    case 'URGENT':
      return '紧急';
    case 'EMERGENCY':
      return '特急';
    case 'NORMAL':
      return '普通';
    default:
      return priority ?? '-';
  }
}

/**
 * Format a date string for display.
 *
 * @param value - ISO date string or undefined
 * @returns Formatted date string
 */
function formatDate(value: string | undefined | null): string {
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
 * AssetRelatedWorkOrders component
 *
 * Renders a table of work orders related to a single asset.
 * When there are no work orders, shows a "暂无关联工单" empty state.
 *
 * @param props - Component props including work order items
 * @returns The related work orders JSX
 */
export const AssetRelatedWorkOrders: React.FC<AssetRelatedWorkOrdersProps> = ({
  workOrders,
  total,
  className,
}) => {
  // Empty state — show specific empty message
  if (!workOrders || workOrders.length === 0) {
    return (
      <div
        className={className ?? ''}
        data-testid="related-work-orders-empty"
      >
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <ClipboardList className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-muted-foreground">暂无关联工单</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={`asset-related-work-orders ${className ?? ''}`}
      data-testid="related-work-orders"
    >
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">工单号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-[100px]">类型</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[100px]">优先级</TableHead>
                  <TableHead className="w-[160px]">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((wo) => {
                  const badge = getStatusBadge(wo.status);
                  return (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-sm">
                        {wo.workOrderNo ?? `-#${wo.id}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.title ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.type ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant} className="text-xs">
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getPriorityLabel(wo.priority)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(wo.createTime)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Total count indicator */}
      {(total ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground text-center mt-3">
          共 {total} 条工单记录
        </p>
      )}
    </div>
  );
};

export default AssetRelatedWorkOrders;
