/**
 * DepreciationScheduleTable — Pure display component for depreciation schedules.
 *
 * Renders a paginated table with row selection support for batch operations.
 * All data is received via props — no direct API calls.
 *
 * Features:
 * - Multi-row selection via checkboxes (rowSelection)
 * - Terminal-state asset rows have disabled checkboxes (ATB-04)
 * - Formatted currency and percentage columns
 * - Depreciation method badge column (SWARM-067)
 * - Pagination controls
 * - Loading skeleton and empty state
 *
 * @module pages/depreciation/DepreciationScheduleTable
 * @since SWARM-055
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Checkbox } from '../../components/ui/checkbox';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { TrendingDown } from 'lucide-react';
import type { DepreciationScheduleItem } from '../../services/depreciationApi';
import { DepreciationMethodBadge } from './DepreciationMethodBadge';
import { formatStatusLabel } from '../../constants/assetStatus';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Pagination state passed from the parent container.
 */
export interface PaginationState {
  /** Current page number (1-based) */
  current: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  total: number;
}

/**
 * Props for the DepreciationScheduleTable component.
 */
export interface DepreciationScheduleTableProps {
  /** Schedule data rows to display */
  dataSource: DepreciationScheduleItem[];
  /** Loading state */
  loading: boolean;
  /** Pagination state */
  pagination: PaginationState;
  /** Callback when pagination changes */
  onChange: (page: number, pageSize: number) => void;
  /** Currently selected row keys (asset IDs) */
  selectedRowKeys: number[];
  /** Callback when row selection changes */
  onSelectChange: (selectedKeys: number[]) => void;
  /**
   * Callback when the user clicks the retry button after a load error.
   * If provided, an error-state UI with a retry button is rendered instead
   * of crashing or showing raw error stacks.
   */
  onRetry?: () => void;
  /**
   * Whether the table is in an error state (e.g. backend returned 500).
   * When true, renders the error/retry UI instead of the table body.
   */
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Asset lifecycle statuses that are terminal / non-depreciable.
 * Assets in these states must NOT be included in batch depreciation
 * calculation — their checkboxes are disabled per ATB-04.
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
const isTerminalAsset = (status?: string): boolean => {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status.toUpperCase());
};

/**
 * Format a number as zh-CN currency string.
 */
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DepreciationScheduleTable component
 *
 * Pure display component: receives all data and callbacks via props.
 * Does NOT call any API methods directly.
 *
 * @param props - Component props
 * @returns The table JSX
 */
export const DepreciationScheduleTable: React.FC<DepreciationScheduleTableProps> = ({
  dataSource,
  loading,
  pagination,
  onChange,
  selectedRowKeys,
  onSelectChange,
  onRetry,
  error,
}) => {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  /**
   * Selectable rows on the current page (excludes terminal-state assets).
   */
  const selectableRows = dataSource.filter((row) => !isTerminalAsset(row.assetStatus));

  /**
   * Determine if all *selectable* rows are selected.
   */
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedRowKeys.includes(row.id));

  /**
   * Toggle selection of a single row.
   */
  const handleRowToggle = (id: number) => {
    if (selectedRowKeys.includes(id)) {
      onSelectChange(selectedRowKeys.filter((key) => key !== id));
    } else {
      onSelectChange([...selectedRowKeys, id]);
    }
  };

  /**
   * Toggle selection of all *selectable* rows on the current page.
   */
  const handleSelectAll = () => {
    const selectableIds = new Set(selectableRows.map((r) => r.id));
    if (allSelected) {
      // Deselect only the current page's selectable rows
      onSelectChange(selectedRowKeys.filter((key) => !selectableIds.has(key)));
    } else {
      // Select all current page selectable rows (deduplicated)
      const merged = new Set([...selectedRowKeys, ...selectableRows.map((r) => r.id)]);
      onSelectChange(Array.from(merged));
    }
  };

  // ---- Error state (ATB-05) -----------------------------------------------
  if (error && dataSource.length === 0) {
    return (
      <div
        data-testid="depreciation-table-error"
        className="flex flex-col items-center py-12"
      >
        <p className="text-red-500 mb-4">{error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            data-testid="depreciation-retry-btn"
          >
            重试
          </Button>
        )}
      </div>
    );
  }

  // ---- Loading skeleton ---------------------------------------------------
  if (loading && dataSource.length === 0) {
    return (
      <div data-testid="depreciation-table-loading" className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // ---- Empty state --------------------------------------------------------
  if (dataSource.length === 0 && !loading) {
    return (
      <div
        data-testid="depreciation-table-empty"
        className="flex flex-col items-center py-12"
      >
        <TrendingDown className="h-10 w-10 text-slate-600 mb-3" />
        <p className="text-gray-400 empty-state">暂无折旧数据</p>
      </div>
    );
  }

  // ---- Main table ---------------------------------------------------------
  return (
    <div data-testid="depreciation-table-container">
      {/* Inline error banner for batch calculation failures (ATB-04) */}
      {error && (
        <div
          data-testid="depreciation-error-banner"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
        >
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="全选"
                data-testid="select-all-checkbox"
              />
            </TableHead>
            <TableHead>资产编号</TableHead>
            <TableHead>资产名称</TableHead>
            <TableHead>期间</TableHead>
            <TableHead className="text-right">本期折旧额</TableHead>
            <TableHead className="text-right">累计折旧</TableHead>
            <TableHead className="text-right">账面净值</TableHead>
            <TableHead>折旧方法</TableHead>
            <TableHead>资产状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataSource.map((item) => {
            const isSelected = selectedRowKeys.includes(item.id);
            const terminal = isTerminalAsset(item.assetStatus);
            return (
              <TableRow
                key={item.id}
                className={`depreciation-table-row ${isSelected ? 'bg-blue-50' : ''} ${terminal ? 'opacity-60' : ''}`}
                data-testid={`schedule-row-${item.id}`}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected && !terminal}
                    disabled={terminal}
                    onCheckedChange={() => handleRowToggle(item.id)}
                    aria-label={terminal ? `${item.assetNo} 已报废/退役，不可选择` : `选择 ${item.assetNo}`}
                    data-testid={`row-checkbox-${item.id}`}
                  />
                </TableCell>
                <TableCell className="font-mono">{item.assetNo}</TableCell>
                <TableCell>{item.assetName}</TableCell>
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
                <TableCell>
                  <DepreciationMethodBadge method={item.depreciationMethod} />
                </TableCell>
                <TableCell>
                  {terminal ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {formatStatusLabel(item.assetStatus)}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      正常
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination controls */}
      {pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-gray-400">
            共 {pagination.total} 条记录，第 {pagination.current} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current <= 1}
              onClick={() => onChange(pagination.current - 1, pagination.pageSize)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.current >= totalPages}
              onClick={() => onChange(pagination.current + 1, pagination.pageSize)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepreciationScheduleTable;
