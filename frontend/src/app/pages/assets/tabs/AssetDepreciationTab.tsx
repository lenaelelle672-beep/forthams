/**
 * AssetDepreciationTab — Depreciation history tab for the asset detail page.
 *
 * Displays the depreciation schedule with per-period detail table,
 * summary statistics, and handles loading/error/empty states.
 *
 * For terminal-state assets (SCRAPPED/RETIRED/DISPOSED), the depreciation
 * history is shown as frozen — no "adjust depreciation" actions are rendered.
 *
 * SWARM-057: Pure presentational controlled component; data fetching is
 * encapsulated internally via useEffect + fetchDepreciationSchedule.
 *
 * @module pages/assets/tabs/AssetDepreciationTab
 * @since SWARM-057
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { TrendingDown, Info, RefreshCw } from 'lucide-react';
import { fetchDepreciationSchedule } from '../../../services/assetDetailService';
import type {
  DepreciationScheduleDTO,
  DepreciationDetailItem,
} from '../../../services/assetApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the AssetDepreciationTab component.
 */
interface AssetDepreciationTabProps {
  /** The asset ID used to fetch depreciation data */
  assetId: string;
  /** Whether the asset is in a terminal state (frozen display) */
  isTerminal?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a numeric value as Chinese currency.
 *
 * @param value - Numeric amount
 * @returns Formatted currency string, e.g. "¥12,345.00"
 */
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format a depreciation rate as a percentage string.
 *
 * @param rate - Rate value (e.g. 0.15 means 15%)
 * @returns Formatted percentage string
 */
const formatRate = (rate: number | undefined): string => {
  if (rate === undefined || rate === null) return '-';
  return `${(rate * 100).toFixed(2)}%`;
};

/**
 * Chinese labels for depreciation methods.
 */
const METHOD_LABELS: Record<string, string> = {
  straight_line: '直线法',
  double_declining_balance: '双倍余额递减法',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetDepreciationTab component
 *
 * Renders the depreciation history for a single asset. Fetches data internally
 * using the assetId prop. Supports loading, error, empty, and frozen states.
 *
 * @param props - Component props including assetId and isTerminal flag
 * @returns The depreciation tab JSX
 */
export const AssetDepreciationTab: React.FC<AssetDepreciationTabProps> = ({
  assetId,
  isTerminal = false,
}) => {
  const [schedule, setSchedule] = useState<DepreciationScheduleDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch depreciation schedule from the backend API.
   */
  const loadSchedule = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchDepreciationSchedule(assetId);
      setSchedule(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取折旧计划失败';
      setError(message);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-4" data-testid="depreciation-tab-loading">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
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
        data-testid="depreciation-tab-error"
      >
        <Card className="w-full">
          <CardContent className="flex flex-col items-center py-8">
            <Info className="h-10 w-10 text-destructive mb-3" />
            <p className="text-muted-foreground mb-4">
              加载失败，请重试
            </p>
            <Button variant="outline" onClick={loadSchedule}>
              <RefreshCw className="w-4 h-4 mr-1" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- No depreciation data (empty state) ----
  if (!schedule || !schedule.details || schedule.details.length === 0) {
    return (
      <div
        className="empty-state flex items-center justify-center py-12"
        data-testid="depreciation-tab-empty"
      >
        <Card className="w-full border-0 shadow-none">
          <CardContent className="flex flex-col items-center py-8">
            <TrendingDown className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">暂无数据</p>
            <p className="text-sm text-muted-foreground mt-1">
              土地类资产或未配置折旧参数的资产不会产生折旧记录
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Summary statistics ----
  const finalAccumulated =
    schedule.details.length > 0
      ? schedule.details[schedule.details.length - 1].accumulatedDepreciation
      : 0;
  const finalNetValue =
    schedule.details.length > 0
      ? schedule.details[schedule.details.length - 1].netValue
      : schedule.originalValue;

  return (
    <div className="asset-depreciation-tab space-y-4" data-testid="depreciation-tab">
      {/* Terminal state frozen indicator */}
      {isTerminal && (
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
          <Info className="h-4 w-4" />
          <span>该资产已处于终结状态，折旧记录已固化</span>
        </div>
      )}

      {/* Parameter overview card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            折旧参数概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">折旧方法</p>
              <Badge variant="outline">
                {METHOD_LABELS[schedule.method] || schedule.methodName}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">资产原值</p>
              <p className="font-semibold">{formatCurrency(schedule.originalValue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">预计残值</p>
              <p className="font-semibold">{formatCurrency(schedule.salvageValue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">折旧年限</p>
              <p className="font-semibold">{schedule.usefulLifeYears} 年</p>
            </div>
            {schedule.salvageRate !== undefined && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">残值率</p>
                <p className="font-semibold">{formatRate(schedule.salvageRate)}</p>
              </div>
            )}
            {schedule.startDate && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">折旧开始日期</p>
                <p className="font-semibold">{schedule.startDate}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">累计折旧总额</p>
              <p className="font-semibold text-orange-600">
                {formatCurrency(finalAccumulated)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">当前账面净值</p>
              <p className="font-semibold">{formatCurrency(finalNetValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Depreciation detail table */}
      {schedule.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              逐期折旧明细
              <Badge variant="secondary" className="ml-2">
                {schedule.details.length} 期
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
                    {schedule.details.some((d) => d.depreciationRate !== undefined) && (
                      <TableHead className="text-right">折旧率</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.details.map((item: DepreciationDetailItem) => (
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
                      {schedule.details.some((d) => d.depreciationRate !== undefined) && (
                        <TableCell className="text-right">
                          {formatRate(item.depreciationRate)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AssetDepreciationTab;
