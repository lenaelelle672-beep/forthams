/**
 * AssetWorkOrdersTab — Related work orders tab for the asset detail page.
 *
 * Displays a list of work orders associated with the current asset,
 * including work order number, type, status badge, creation time, etc.
 *
 * For terminal-state assets (SCRAPPED/RETIRED/DISPOSED), only historical
 * records are displayed — no "create work order" action is rendered.
 *
 * SWARM-057: Pure presentational controlled component; data fetching is
 * encapsulated internally via useEffect + fetchRelatedWorkOrders.
 *
 * @module pages/assets/tabs/AssetWorkOrdersTab
 * @since SWARM-057
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
} from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { ClipboardList, Info, RefreshCw } from 'lucide-react';
import { fetchRelatedWorkOrders } from '../../../services/assetDetailService';
import type { WorkOrderRecord } from '../../../services/workOrderService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the AssetWorkOrdersTab component.
 */
interface AssetWorkOrdersTabProps {
  /** The asset ID used to fetch related work orders */
  assetId: string;
  /** Whether the asset is in a terminal state (hide create actions) */
  isTerminal?: boolean;
}

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

/**
 * Map work order status to badge variant and display label.
 *
 * @param status - Work order status string from backend
 * @returns Object with variant, label, and CSS class name for badge
 */
const getStatusBadge = (
  status: string | undefined,
): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className: string } => {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
      return { variant: 'default', label: '已完成', className: 'badge-success' };
    case 'PENDING':
      return { variant: 'outline', label: '待审批', className: 'badge-warning' };
    case 'APPROVED':
      return { variant: 'secondary', label: '已批准', className: 'badge-info' };
    case 'EXECUTING':
      return { variant: 'secondary', label: '执行中', className: 'badge-info' };
    case 'REJECTED':
      return { variant: 'destructive', label: '已驳回', className: 'badge-error' };
    case 'CANCELLED':
      return { variant: 'outline', label: '已取消', className: 'badge-muted' };
    case 'DRAFT':
      return { variant: 'outline', label: '草稿', className: 'badge-muted' };
    default:
      return { variant: 'outline', label: status ?? '-', className: '' };
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date string for display.
 *
 * @param value - ISO date string or undefined
 * @returns Formatted date string
 */
const formatDate = (value: string | undefined | null): string => {
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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetWorkOrdersTab component
 *
 * Renders the list of work orders related to a single asset. Fetches data
 * internally using the assetId prop. Supports loading, error, and empty states.
 *
 * @param props - Component props including assetId and isTerminal flag
 * @returns The work orders tab JSX
 */
export const AssetWorkOrdersTab: React.FC<AssetWorkOrdersTabProps> = ({
  assetId,
  isTerminal = false,
}) => {
  const [records, setRecords] = useState<WorkOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch related work orders from the backend API.
   */
  const loadWorkOrders = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchRelatedWorkOrders(assetId, {
        page: 1,
        pageSize: 20,
      });
      setRecords(result.records ?? []);
      setTotal(result.total ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取工单列表失败';
      setError(message);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-4" data-testid="work-orders-tab-loading">
        <Card>
          <CardContent className="p-6 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state with retry ----
  if (error) {
    return (
      <div
        className="error-state flex items-center justify-center py-12"
        data-testid="work-orders-tab-error"
      >
        <Card className="w-full">
          <CardContent className="flex flex-col items-center py-8">
            <Info className="h-10 w-10 text-destructive mb-3" />
            <p className="text-muted-foreground mb-4">
              加载失败，请重试
            </p>
            <Button variant="outline" onClick={loadWorkOrders}>
              <RefreshCw className="w-4 h-4 mr-1" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Empty state ----
  if (records.length === 0) {
    return (
      <div
        className="empty-state flex items-center justify-center py-12"
        data-testid="work-orders-tab-empty"
      >
        <Card className="w-full border-0 shadow-none">
          <CardContent className="flex flex-col items-center py-8">
            <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">暂无数据</p>
            <p className="text-sm text-muted-foreground mt-1">
              该资产暂无关联工单记录
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="asset-work-orders-tab space-y-4" data-testid="work-orders-tab">
      {/* Terminal state frozen indicator */}
      {isTerminal && (
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
          <Info className="h-4 w-4" />
          <span>该资产已处于终结状态，仅展示历史工单记录</span>
        </div>
      )}

      {/* Work orders table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">工单号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[100px]">优先级</TableHead>
                  <TableHead className="w-[160px]">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((wo) => {
                  const badge = getStatusBadge(wo.status);
                  return (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-sm">
                        {wo.workOrderNo ?? `-#${wo.id}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.title ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={badge.variant}
                          className={`${badge.className} text-xs`}
                        >
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {wo.priority === 'URGENT'
                          ? '紧急'
                          : wo.priority === 'EMERGENCY'
                            ? '特急'
                            : '普通'}
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
      {total > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          共 {total} 条工单记录
        </p>
      )}
    </div>
  );
};

export default AssetWorkOrdersTab;
