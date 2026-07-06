/**
 * AssetSearchBar — Reusable search bar component for asset filtering.
 *
 * SWARM-066: Extracted from AssetListPage for reuse across asset pages.
 * Provides a keyword input, status filter dropdown, and action buttons.
 *
 * @module pages/assets/components/AssetSearchBar
 * @since SWARM-066
 */

import React, { useCallback, type FormEvent } from 'react';
import { Search, RefreshCw } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Status options                                                     */
/* ------------------------------------------------------------------ */

/**
 * Available status filter options.
 *
 * @constant STATUS_OPTIONS
 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'IN_USE', label: '在用' },
  { value: 'IDLE', label: '闲置' },
  { value: 'MAINTENANCE', label: '维保中' },
  { value: 'SCRAPPED', label: '已报废' },
  { value: 'RETIRED', label: '已退役' },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

/**
 * Props for the AssetSearchBar component.
 *
 * @interface AssetSearchBarProps
 * @property {string} keyword - Current search keyword
 * @property {function} onKeywordChange - Callback when keyword changes
 * @property {string} statusFilter - Current status filter value
 * @property {function} onStatusChange - Callback when status filter changes
 * @property {function} onSearch - Callback when search is submitted
 * @property {function} onRefresh - Callback when refresh button is clicked
 * @property {boolean} [loading] - Whether data is currently loading
 */
export interface AssetSearchBarProps {
  /** Current search keyword value */
  keyword: string;
  /** Callback fired when the keyword input value changes */
  onKeywordChange: (value: string) => void;
  /** Current status filter value */
  statusFilter: string;
  /** Callback fired when the status filter changes */
  onStatusChange: (value: string) => void;
  /** Callback fired when the search form is submitted */
  onSearch: () => void;
  /** Callback fired when the refresh button is clicked */
  onRefresh: () => void;
  /** Whether data is currently loading (disables refresh button) */
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * AssetSearchBar — Combined search input, status filter, and action buttons.
 *
 * Provides a unified search/filter bar for asset list pages.
 * The search form submits on Enter or button click. The status dropdown
 * triggers an immediate filter change. The refresh button reloads data.
 *
 * @param props - Component props
 * @returns A search bar form with filter and action controls
 *
 * @example
 * ```tsx
 * <AssetSearchBar
 *   keyword={keyword}
 *   onKeywordChange={setKeyword}
 *   statusFilter={statusFilter}
 *   onStatusChange={handleStatusChange}
 *   onSearch={() => setPage(1)}
 *   onRefresh={refresh}
 *   loading={loading}
 * />
 * ```
 */
export const AssetSearchBar: React.FC<AssetSearchBarProps> = ({
  keyword,
  onKeywordChange,
  statusFilter,
  onStatusChange,
  onSearch,
  onRefresh,
  loading = false,
}) => {
  /**
   * Handle form submission (search).
   *
   * @param e - Form event
   */
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onSearch();
    },
    [onSearch],
  );

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-center gap-4">
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索资产编号或名称..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200
            bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:border-blue-500 transition-colors"
          data-testid="input-search"
        />
      </div>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-gray-200
          bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        data-testid="select-status"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Search button */}
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
          rounded-lg bg-blue-600 text-white hover:bg-blue-700
          transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        data-testid="btn-search"
      >
        <Search className="w-4 h-4" />
        搜索
      </button>

      {/* Refresh button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
          rounded-lg border border-gray-200 bg-white text-gray-700
          hover:bg-gray-50 disabled:opacity-50 transition-colors"
        data-testid="btn-refresh"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        刷新
      </button>
    </form>
  );
};

export default AssetSearchBar;
