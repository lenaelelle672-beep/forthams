/**
 * DepreciationPage — Container page for the depreciation module (SWARM-055 / SWARM-067).
 *
 * Manages:
 * - Filter state (assetNo, period)
 * - Table data fetching via depreciationApi
 * - Pagination state
 * - Row selection for batch operations
 * - Batch depreciation calculation with error handling
 * - Error state with retry capability (ATB-05)
 * - Front-end terminal-state validation before batch calc (ATB-04)
 * - Client-side YYYY-MM period format validation (ATB-03)
 * - Depreciation method badge rendering via DepreciationMethodBadge (SWARM-067)
 *
 * All API calls happen here; child DepreciationScheduleTable is a pure
 * display component that receives data and callbacks via props.
 *
 * @module pages/depreciation/DepreciationPage
 * @since SWARM-055
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  TrendingDown,
  Search,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDepreciationSchedules,
  batchCalculateDepreciation,
  PERIOD_REGEX,
} from '../../services/depreciationApi';
import type {
  DepreciationScheduleItem,
  DepreciationFilter,
} from '../../services/depreciationApi';
import { DepreciationScheduleTable } from './DepreciationScheduleTable';
import type { PaginationState } from './DepreciationScheduleTable';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Asset lifecycle statuses that are terminal / non-depreciable.
 * Must stay in sync with the table component's TERMINAL_STATUSES.
 */
const TERMINAL_STATUSES = new Set([
  'RETIRED',
  'SCRAPPED',
  'DISPOSED',
  'WRITTEN_OFF',
]);

/**
 * Check whether an asset is in a terminal (non-depreciable) state.
 */
const isTerminalStatus = (status?: string): boolean => {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status.toUpperCase());
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DepreciationPage component
 *
 * Top-level container for the depreciation management module.
 * Handles data fetching, filtering, pagination, selection, and batch ops.
 *
 * @returns The depreciation page JSX
 */
export const DepreciationPage: React.FC = () => {
  // -- Filter state ---------------------------------------------------------
  const [assetNoFilter, setAssetNoFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [periodError, setPeriodError] = useState<string | null>(null);

  // -- Table data state -----------------------------------------------------
  const [dataSource, setDataSource] = useState<DepreciationScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // -- Selection state ------------------------------------------------------
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  /**
   * Fetch depreciation schedule data from the backend.
   *
   * @param page - Page number to fetch
   * @param pageSize - Page size
   * @param assetNo - Optional assetNo filter (exact match)
   * @param period - Optional period filter in YYYY-MM format
   */
  const fetchData = useCallback(
    async (
      page: number = 1,
      pageSize: number = 10,
      assetNo?: string,
      period?: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const filters: DepreciationFilter = { page, pageSize };
        if (assetNo) filters.assetNo = assetNo;
        if (period) filters.period = period;

        const response = await getDepreciationSchedules(filters);
        // Deduplicate by row id to prevent duplicate assetNo display (SWARM-055 fix)
        const seenIds = new Set<number>();
        const dedupedData = response.data.filter((item) => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });
        setDataSource(dedupedData);
        setPagination({
          current: response.page,
          pageSize: response.pageSize,
          total: response.total,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载折旧数据失败';
        setError(message);
        setDataSource([]);
        setPagination((prev) => ({ ...prev, total: 0 }));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Initial data load on mount.
   */
  useEffect(() => {
    fetchData(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  // -- Debounced filter ref (ATB-03: 300ms debounce) --------------------------
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Debounced filter effect (ATB-03).
   * When assetNoFilter or periodFilter changes, waits 300ms before
   * automatically triggering a GET request to reload data.
   * Skips the initial mount (handled above) and invalid period formats.
   */
  useEffect(() => {
    // Skip if period format is invalid — wait for user to correct it
    if (periodFilter && !PERIOD_REGEX.test(periodFilter)) {
      return;
    }

    // Clear any pending debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSelectedRowKeys([]);
      setError(null);
      fetchData(1, pagination.pageSize, assetNoFilter || undefined, periodFilter || undefined);
    }, 300);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [assetNoFilter, periodFilter, fetchData, pagination.pageSize]);

  /**
   * Handle search/filter submit.
   * Validates period format before sending request (ATB-03).
   */
  const handleSearch = useCallback(() => {
    setSelectedRowKeys([]);
    setError(null);

    // ATB-03: Client-side period format validation
    if (periodFilter && !PERIOD_REGEX.test(periodFilter)) {
      setPeriodError('期间格式不正确，请使用 YYYY-MM 格式（如 2023-10）');
      return;
    }
    setPeriodError(null);

    fetchData(1, pagination.pageSize, assetNoFilter, periodFilter);
  }, [fetchData, pagination.pageSize, assetNoFilter, periodFilter]);

  /**
   * Handle pagination change from the table.
   */
  const handleTableChange = useCallback(
    (page: number, pageSize: number) => {
      fetchData(page, pageSize, assetNoFilter, periodFilter);
    },
    [fetchData, assetNoFilter, periodFilter],
  );

  /**
   * Handle row selection change from the table.
   */
  const handleSelectChange = useCallback((selectedKeys: number[]) => {
    setSelectedRowKeys(selectedKeys);
  }, []);

  /**
   * Retry handler passed to the table for error-state retry button (ATB-05).
   */
  const handleRetry = useCallback(() => {
    fetchData(pagination.current, pagination.pageSize, assetNoFilter, periodFilter);
  }, [fetchData, pagination.current, pagination.pageSize, assetNoFilter, periodFilter]);

  /**
   * Handle batch depreciation calculation.
   *
   * Front-end validation (ATB-04):
   * Before sending the request, checks that none of the selected rows
   * belong to assets in a terminal state. If any are terminal, the
   * request is blocked and a clear error message is shown.
   *
   * Backend 400/409 errors are also caught and displayed.
   */
  const handleBatchCalculate = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('请至少选择一条记录');
      return;
    }

    // ATB-04: Front-end terminal-state validation
    const terminalRows = dataSource.filter(
      (row) => selectedRowKeys.includes(row.id) && isTerminalStatus(row.assetStatus),
    );
    if (terminalRows.length > 0) {
      const terminalNos = terminalRows.map((r) => r.assetNo).join(', ');
      const msg = `以下资产已报废/退役，不可执行折旧计算: ${terminalNos}`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setBatchLoading(true);
    setError(null);
    try {
      // Deduplicate assetIds — multiple schedule rows may share the same assetId
      const uniqueAssetIds = Array.from(
        new Set(
          dataSource
            .filter((row) => selectedRowKeys.includes(row.id))
            .map((row) => row.assetId),
        ),
      );
      await batchCalculateDepreciation({ assetIds: uniqueAssetIds });
      toast.success('计算任务已下发');
      // Clear selection and refresh data
      setSelectedRowKeys([]);
      fetchData(pagination.current, pagination.pageSize, assetNoFilter, periodFilter);
    } catch (err) {
      // Global error catch for scrapped/retired asset errors (400/409)
      const message = err instanceof Error ? err.message : '批量计算失败';
      setError(message);
      toast.error(message);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedRowKeys, dataSource, fetchData, pagination.current, pagination.pageSize, assetNoFilter, periodFilter]);

  /**
   * Handle Enter key in filter inputs.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch],
  );

  /**
   * Handle period input change.
   * Clears the format error when user modifies the value (ATB-03).
   */
  const handlePeriodChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPeriodFilter(e.target.value);
      // Clear error when user starts editing
      if (periodError) {
        setPeriodError(null);
      }
    },
    [periodError],
  );

  /**
   * Handle reset — clears all filters and reloads data.
   */
  const handleReset = useCallback(() => {
    setAssetNoFilter('');
    setPeriodFilter('');
    setPeriodError(null);
    setSelectedRowKeys([]);
    setError(null);
    fetchData(1, 10);
  }, [fetchData]);

  // ---- Render -------------------------------------------------------------
  return (
    <div className="depreciation-page-container max-w-7xl mx-auto space-y-6 pb-12" data-testid="depreciation-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <TrendingDown className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">资产折旧计算</h1>
            <p className="text-sm text-gray-400 mt-1">
              查看资产折旧明细计划表，按资产编号与会计期间筛选，触发批量折旧计算
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Asset number filter (exact match per ATB-02) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">资产编号</label>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <Input
                  placeholder="输入资产编号..."
                  value={assetNoFilter}
                  onChange={(e) => setAssetNoFilter(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-[180px]"
                  data-testid="filter-asset-no"
                />
              </div>
            </div>

            {/* Period filter (YYYY-MM, ATB-03) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">会计期间</label>
              <Input
                type="month"
                placeholder="YYYY-MM"
                value={periodFilter}
                onChange={handlePeriodChange}
                onKeyDown={handleKeyDown}
                className="w-[160px]"
                data-testid="filter-period"
              />
              {/* ATB-03: Format error display */}
              {periodError && (
                <p className="text-xs text-red-500 mt-1" data-testid="period-format-error">
                  {periodError}
                </p>
              )}
            </div>

            {/* Search button */}
            <Button
              variant="default"
              size="sm"
              onClick={handleSearch}
              data-testid="filter-search-btn"
            >
              <Search className="w-4 h-4 mr-1" />
              查询
            </Button>

            {/* Reset button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              data-testid="filter-reset-btn"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch actions bar */}
      <div className="flex items-center gap-4">
        <Button
          variant="default"
          size="sm"
          disabled={selectedRowKeys.length === 0 || batchLoading}
          onClick={handleBatchCalculate}
          data-testid="batch-calculate-btn"
        >
          {batchLoading ? (
            <>计算中...</>
          ) : (
            <>
              <Calculator className="w-4 h-4 mr-1" />
              批量计算
            </>
          )}
        </Button>
        {selectedRowKeys.length > 0 && (
          <span className="text-sm text-gray-400">
            已选择 {selectedRowKeys.length} 条记录
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            fetchData(pagination.current, pagination.pageSize, assetNoFilter, periodFilter)
          }
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
      </div>

      {/* Depreciation schedule table */}
      <Card>
        <CardContent className="pt-6">
          <DepreciationScheduleTable
            dataSource={dataSource}
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            selectedRowKeys={selectedRowKeys}
            onSelectChange={handleSelectChange}
            error={error}
            onRetry={handleRetry}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default DepreciationPage;
