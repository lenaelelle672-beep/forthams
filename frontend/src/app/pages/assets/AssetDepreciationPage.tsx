/**
 * AssetDepreciationPage — Standalone depreciation schedule browse page.
 *
 * SWARM-029: Real API integration for viewing depreciation calculation results
 * and historical depreciation records for assets.
 *
 * Features:
 * - Paginated list of assets with depreciation summaries
 * - Click an asset row to expand and view period-by-period depreciation details
 * - Search / filter by asset name, number, or depreciation method
 * - Currency-formatted values in zh-CN locale
 *
 * @module pages/assets/AssetDepreciationPage
 * @since SWARM-029
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  TrendingDown,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info,
  Filter,
} from 'lucide-react';
import {
  fetchDepreciationList,
  fetchAssetDepreciationDetail,
} from '../../services/assetDepreciationService';
import type {
  AssetDepreciationSummary,
  DepreciationListParams,
} from '../../services/assetDepreciationService';
import type {
  DepreciationScheduleDTO,
  DepreciationDetailItem,
} from '../../services/assetApi';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Page size options */
const PAGE_SIZE = 10;

/**
 * Asset status color mapping for badges
 */
const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  IN_USE: 'default',
  IDLE: 'secondary',
  MAINTENANCE: 'outline',
  SCRAPPED: 'destructive',
  TRANSFERRED: 'secondary',
};

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

/**
 * Depreciation method Chinese labels
 */
const METHOD_LABELS: Record<string, string> = {
  straight_line: '直线法',
  double_declining_balance: '双倍余额递减法',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetDepreciationPage component
 *
 * Renders a browseable, paginated list of assets with their depreciation
 * summaries. Each row is expandable to show the full period-by-period
 * depreciation schedule fetched from the real backend API.
 *
 * @returns The depreciation page JSX
 */
export const AssetDepreciationPage: React.FC = () => {
  const navigate = useNavigate();

  // -- List state ----------------------------------------------------------
  const [records, setRecords] = useState<AssetDepreciationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Filters -------------------------------------------------------------
  const [searchName, setSearchName] = useState('');
  const [searchNo, setSearchNo] = useState('');
  const [searchMethod, setSearchMethod] = useState('');

  // -- Expanded detail state -----------------------------------------------
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<DepreciationScheduleDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * Load the depreciation summary list from the API.
   */
  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: DepreciationListParams = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (searchName.trim()) params.assetName = searchName.trim();
    if (searchNo.trim()) params.assetNo = searchNo.trim();
    if (searchMethod) params.method = searchMethod;

    try {
      const data = await fetchDepreciationList(params);
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取折旧列表失败';
      setError(message);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchName, searchNo, searchMethod]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * Toggle expansion of an asset row to show depreciation detail.
   *
   * @param assetId - The asset ID to expand / collapse
   */
  const handleToggleExpand = useCallback(
    async (assetId: number) => {
      if (expandedAssetId === assetId) {
        setExpandedAssetId(null);
        setDetailSchedule(null);
        return;
      }

      setExpandedAssetId(assetId);
      setDetailLoading(true);
      setDetailSchedule(null);

      try {
        const schedule = await fetchAssetDepreciationDetail(String(assetId));
        setDetailSchedule(schedule);
      } catch {
        setDetailSchedule(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedAssetId],
  );

  /** Total number of pages */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ---- Loading skeleton ---------------------------------------------------
  if (loading && records.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12" data-testid="depreciation-page-loading">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-blue-50 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-blue-50 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state --------------------------------------------------------
  if (error && records.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-12" data-testid="depreciation-page-error">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">加载折旧数据失败：{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadList}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Main render --------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12" data-testid="depreciation-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <TrendingDown className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">资产折旧计划</h2>
            <p className="text-sm text-gray-400 mt-1">
              查看资产折旧计算结果与历史折旧记录
            </p>
          </div>
        </div>
      </div>

      {/* Search / Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索资产名称..."
                value={searchName}
                onChange={(e) => {
                  setSearchName(e.target.value);
                  setPage(1);
                }}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索资产编号..."
                value={searchNo}
                onChange={(e) => {
                  setSearchNo(e.target.value);
                  setPage(1);
                }}
                className="max-w-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadList}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={searchMethod}
                onChange={(e) => {
                  setSearchMethod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部折旧方法</option>
                <option value="straight_line">直线法</option>
                <option value="double_declining_balance">双倍余额递减法</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">资产总数</p>
            <p className="text-xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-400">当前页</p>
            <p className="text-xl font-bold">
              {page} / {totalPages}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Asset list table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">折旧汇总列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>资产编号</TableHead>
                  <TableHead>资产名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>折旧方法</TableHead>
                  <TableHead className="text-right">资产原值</TableHead>
                  <TableHead className="text-right">月折旧额</TableHead>
                  <TableHead className="text-right">累计折旧</TableHead>
                  <TableHead className="text-right">账面净值</TableHead>
                  <TableHead className="text-right">折旧年限</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const isExpanded = expandedAssetId === record.assetId;
                  return (
                    <React.Fragment key={record.assetId}>
                      {/* Summary row */}
                      <TableRow
                        className="cursor-pointer hover:bg-blue-50/50"
                        onClick={() => handleToggleExpand(record.assetId)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.assetNo}
                        </TableCell>
                        <TableCell className="font-medium">{record.assetName}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_COLORS[record.assetStatus] || 'outline'}>
                            {record.assetStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {METHOD_LABELS[record.methodName] || record.methodName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.originalValue)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {formatCurrency(record.monthlyDepreciation)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {formatCurrency(record.accumulatedDepreciation)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(record.currentNetValue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.usefulLifeYears} 年
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-gray-50/50 p-0">
                            <div className="p-4" data-testid={`depreciation-detail-${record.assetId}`}>
                              {detailLoading ? (
                                <div className="space-y-2 py-4">
                                  {[...Array(3)].map((_, i) => (
                                    <Skeleton key={i} className="h-8 w-full" />
                                  ))}
                                </div>
                              ) : detailSchedule && detailSchedule.details.length > 0 ? (
                                <div className="space-y-3">
                                  {/* Detail parameter summary */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <span className="text-gray-400">折旧方法：</span>
                                      <span className="font-medium">
                                        {METHOD_LABELS[detailSchedule.method] || detailSchedule.methodName}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">资产原值：</span>
                                      <span className="font-medium">
                                        {formatCurrency(detailSchedule.originalValue)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">预计残值：</span>
                                      <span className="font-medium">
                                        {formatCurrency(detailSchedule.salvageValue)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">折旧年限：</span>
                                      <span className="font-medium">
                                        {detailSchedule.usefulLifeYears} 年
                                      </span>
                                    </div>
                                    {detailSchedule.salvageRate !== undefined && (
                                      <div>
                                        <span className="text-gray-400">残值率：</span>
                                        <span className="font-medium">
                                          {formatRate(detailSchedule.salvageRate)}
                                        </span>
                                      </div>
                                    )}
                                    {detailSchedule.startDate && (
                                      <div>
                                        <span className="text-gray-400">折旧开始日期：</span>
                                        <span className="font-medium">
                                          {detailSchedule.startDate}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Period detail table */}
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[100px]">期间</TableHead>
                                        <TableHead className="text-right">本期折旧额</TableHead>
                                        <TableHead className="text-right">累计折旧</TableHead>
                                        <TableHead className="text-right">账面净值</TableHead>
                                        {detailSchedule.details.some(
                                          (d) => d.depreciationRate !== undefined,
                                        ) && (
                                          <TableHead className="text-right">折旧率</TableHead>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {detailSchedule.details.map((item: DepreciationDetailItem) => (
                                        <TableRow key={item.id || item.period}>
                                          <TableCell className="font-mono text-sm">
                                            {item.period}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {formatCurrency(item.depreciationAmount)}
                                          </TableCell>
                                          <TableCell className="text-right text-orange-600">
                                            {formatCurrency(item.accumulatedDepreciation)}
                                          </TableCell>
                                          <TableCell className="text-right font-semibold">
                                            {formatCurrency(item.netValue)}
                                          </TableCell>
                                          {detailSchedule.details.some(
                                            (d) => d.depreciationRate !== undefined,
                                          ) && (
                                            <TableCell className="text-right">
                                              {formatRate(item.depreciationRate)}
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>

                                  {/* Navigate to asset detail */}
                                  <div className="flex justify-end">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigate(`/assets/${record.assetId}`)}
                                    >
                                      查看资产详情
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center py-8 text-gray-400">
                                  <TrendingDown className="w-5 h-5 mr-2" />
                                  该资产暂无折旧明细数据
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}

                {records.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-gray-400">
                      <TrendingDown className="w-8 h-8 mx-auto mb-2" />
                      暂无折旧数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination controls */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-400">
                共 {total} 条记录，第 {page} / {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

export default AssetDepreciationPage;
