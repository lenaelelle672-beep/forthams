/**
 * DepreciationScheduleTable — Paginated depreciation schedule display.
 *
 * Features:
 * - Fetches period-by-period depreciation data from the real API
 * - Server-side pagination (no client-side data slicing)
 * - Loading skeleton, error state with retry, and empty state
 * - Currency-formatted values in zh-CN locale
 *
 * @module components/depreciation/DepreciationScheduleTable
 * @since SWARM-042
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { TrendingDown, Info } from 'lucide-react';
import { getSchedule } from '../../services/depreciationService';
import type { DepreciationScheduleDetail } from '../../services/depreciationService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the DepreciationScheduleTable component.
 */
export interface DepreciationScheduleTableProps {
  /** Asset ID whose depreciation schedule to display */
  assetId: string;
  /** Optional initial page number (1-based), default 1 */
  initialPage?: number;
  /** Optional page size, default 10 */
  pageSize?: number;
  /** Optional callback when page changes */
  onPageChange?: (page: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a number as zh-CN currency string.
 *
 * @param value - Numeric value to format
 * @returns Formatted currency string, e.g. "¥12,345.00"
 */
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format a depreciation rate as percentage string.
 *
 * @param rate - Rate value (e.g. 0.15 = 15%)
 * @returns Formatted percentage string
 */
const formatRate = (rate: number | undefined): string => {
  if (rate === undefined || rate === null) return '-';
  return `${(rate * 100).toFixed(2)}%`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DepreciationScheduleTable component
 *
 * Renders a paginated table of depreciation period details for a given asset.
 * Data is fetched from the backend using server-side pagination.
 *
 * @param props - Component props
 * @returns The depreciation schedule table JSX
 */
export const DepreciationScheduleTable: React.FC<DepreciationScheduleTableProps> = ({
  assetId,
  initialPage = 1,
  pageSize = 10,
  onPageChange,
}) => {
  const [records, setRecords] = useState<DepreciationScheduleDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch schedule data from the backend.
   */
  const loadSchedule = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getSchedule(assetId, page, pageSize);
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败，请重试';
      setError(message);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [assetId, page, pageSize]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  /** Total number of pages */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /**
   * Navigate to a specific page.
   *
   * @param newPage - Target page number
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      onPageChange?.(newPage);
    },
    [onPageChange],
  );

  // ---- Loading skeleton ---------------------------------------------------
  if (loading && records.length === 0) {
    return (
      <Card data-testid="depreciation-table-loading">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Error state with retry ---------------------------------------------
  if (error) {
    return (
      <Card data-testid="depreciation-table-error">
        <CardContent className="flex flex-col items-center py-8">
          <Info className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-2">加载失败，请重试</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={loadSchedule}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Empty state --------------------------------------------------------
  if (records.length === 0 && !loading) {
    return (
      <Card data-testid="depreciation-table-empty">
        <CardContent className="flex flex-col items-center py-8">
          <TrendingDown className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">暂无折旧明细数据</p>
        </CardContent>
      </Card>
    );
  }

  // ---- Main table ---------------------------------------------------------
  return (
    <div data-testid="depreciation-table-container">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            折旧明细表
            <Badge variant="secondary" className="ml-2">
              {total} 期
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">期间</TableHead>
                  <TableHead className="text-right">本期折旧额</TableHead>
                  <TableHead className="text-right">累计折旧</TableHead>
                  <TableHead className="text-right">账面净值</TableHead>
                  {records.some((d) => d.depreciationRate !== undefined) && (
                    <TableHead className="text-right">折旧率</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((item) => (
                  <TableRow key={item.id || item.period}>
                    <TableCell className="font-mono">{item.period}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.depreciationAmount)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {formatCurrency(item.accumulatedDepreciation)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.netValue)}
                    </TableCell>
                    {records.some((d) => d.depreciationRate !== undefined) && (
                      <TableCell className="text-right">
                        {formatRate(item.depreciationRate)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Server-side pagination controls */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                共 {total} 条记录，第 {page} / {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DepreciationScheduleTable;
