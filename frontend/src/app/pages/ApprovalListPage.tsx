/**
 * @module frontend/src/app/pages/ApprovalListPage
 * @description Approval List Page — real backend API data driven.
 *
 * Features:
 * - List browsing: fetches and renders real approval process data from backend.
 * - Status filter: Tab switching triggers backend query with status parameter.
 * - Keyword search: debounced (300ms) search input triggers backend fuzzy query.
 * - Status badges: dynamic rendering based on backend status enum values.
 * - Error/loading states: proper loading skeleton and error prompt UI.
 *
 * Allowed modification target per mutation contract.
 *
 * @see frontend/src/app/services/approvalService.ts — API service layer
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Clock, CheckCircle, XCircle, Ban, RefreshCw } from "lucide-react";
import { approvalService } from "../services/approvalService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Query parameters for the approval list API request. */
interface QueryParams {
  /** Current page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Status filter — undefined means "all". */
  status?: string;
  /** Keyword search string. */
  keyword?: string;
}

/** A single approval process record from the backend. */
interface ApprovalRecord {
  id: number;
  processNo?: string;
  processType?: string;
  status?: string;
  applicantId?: number;
  applyTime?: string;
  createTime?: string;
  updateTime?: string;
  [key: string]: unknown;
}

/** Tab filter options. */
type StatusTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

/**
 * Get status badge display properties from a backend status enum value.
 *
 * Maps backend status strings (PENDING, APPROVED, REJECTED, CANCELLED)
 * to human-readable Chinese labels and corresponding Tailwind color classes.
 *
 * @param status - The backend status enum string.
 * @returns An object with `text` (Chinese label) and `className` (CSS classes).
 */
function getStatusBadgeProps(status?: string): { text: string; className: string } {
  switch (status) {
    case "PENDING":
      return { text: "待审批", className: "bg-yellow-100 text-yellow-800" };
    case "APPROVED":
      return { text: "已通过", className: "bg-green-100 text-green-800" };
    case "REJECTED":
      return { text: "已拒绝", className: "bg-red-100 text-red-800" };
    case "CANCELLED":
      return { text: "已取消", className: "bg-gray-100 text-gray-800" };
    case "APPROVING":
    case "IN_PROGRESS":
      return { text: "审批中", className: "bg-blue-100 text-blue-800" };
    default:
      return { text: status ?? "未知", className: "bg-gray-100 text-gray-600" };
  }
}

/**
 * Get a human-readable Chinese label for a status tab value.
 *
 * @param tab - The status tab identifier.
 * @returns Chinese label string.
 */
function getTabLabel(tab: StatusTab): string {
  switch (tab) {
    case "ALL": return "全部";
    case "PENDING": return "待审批";
    case "APPROVED": return "已通过";
    case "REJECTED": return "已拒绝";
    case "CANCELLED": return "已取消";
    default: return tab;
  }
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const STATUS_TABS: StatusTab[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ApprovalListPage — main component for browsing approval processes.
 *
 * Data is fetched from the backend via `approvalService.list()` with
 * pagination, status filter, and debounced keyword search.
 *
 * @returns The rendered approval list page.
 */
export function ApprovalListPage() {
  // ---- Data state ----
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Query parameters ----
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 1,
    pageSize: 10,
  });

  // ---- Search input (local, before debounce) ----
  const [searchInput, setSearchInput] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Active tab ----
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");

  // ---- Detail modal ----
  const [detailItem, setDetailItem] = useState<ApprovalRecord | null>(null);

  // ---- Notice banner ----
  const [notice, setNotice] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  /**
   * Fetch approval list from the backend using current query parameters.
   *
   * Sets `loading` and `error` states accordingly. On success, updates
   * `records` and `total`. On failure, sets `error` with a user-facing
   * message and does not crash the page.
   */
  const fetchData = useCallback(async (params: QueryParams) => {
    try {
      setLoading(true);
      setError(null);

      const requestParams: Record<string, unknown> = {
        page: params.page,
        pageSize: params.pageSize,
      };

      if (params.status) {
        requestParams.status = params.status;
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword;
      }

      const result = await approvalService.list(requestParams) as unknown as {
        records: ApprovalRecord[];
        total: number;
      };

      if (Array.isArray(result)) {
        // Backend returned a plain array
        setRecords(result);
        setTotal(result.length);
      } else if (result && typeof result === "object") {
        setRecords(Array.isArray(result.records) ? result.records : []);
        setTotal(typeof result.total === "number" ? result.total : 0);
      } else {
        setRecords([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Failed to load approval list:", err);
      setError("数据加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when queryParams change
  useEffect(() => {
    fetchData(queryParams);
  }, [queryParams, fetchData]);

  // -----------------------------------------------------------------------
  // Tab change handler
  // -----------------------------------------------------------------------

  /**
   * Handle tab change to filter by approval status.
   *
   * Updates `activeTab` state and resets page to 1 with the selected
   * status filter applied to query parameters.
   *
   * @param tab - The status tab to switch to.
   */
  const handleTabChange = useCallback((tab: StatusTab) => {
    setActiveTab(tab);
    setQueryParams((prev) => ({
      ...prev,
      page: 1,
      status: tab === "ALL" ? undefined : tab,
    }));
  }, []);

  // -----------------------------------------------------------------------
  // Debounced search handler
  // -----------------------------------------------------------------------

  /**
   * Handle search input change with 300ms debounce.
   *
   * Clears any pending debounce timer, updates local input state immediately,
   * and schedules a `queryParams.keyword` update after 300ms of inactivity.
   *
   * @param value - The current search input value.
   */
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Schedule debounced update
    debounceTimerRef.current = setTimeout(() => {
      setQueryParams((prev) => ({
        ...prev,
        page: 1,
        keyword: value.trim() || undefined,
      }));
    }, 300);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Retry handler
  // -----------------------------------------------------------------------

  /**
   * Retry loading data with the current query parameters.
   */
  const handleRetry = useCallback(() => {
    fetchData(queryParams);
  }, [fetchData, queryParams]);

  // -----------------------------------------------------------------------
  // Pagination helpers
  // -----------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(total / queryParams.pageSize));

  /**
   * Navigate to a specific page number.
   *
   * @param page - The target page number (1-based).
   */
  const handlePageChange = useCallback((page: number) => {
    setQueryParams((prev) => ({ ...prev, page }));
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">审批列表</h2>
        <p className="text-gray-600 mt-1">浏览和管理所有审批流程</p>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
          {notice}
        </div>
      )}

      {/* Search bar */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="搜索审批编号、类型..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="approval-search-input"
          />
        </div>
      </div>

      {/* Tab status filter */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
                data-testid={`tab-${tab.toLowerCase()}`}
              >
                {getTabLabel(tab)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="p-6 space-y-4" data-testid="loading-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse border border-gray-100 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                  <div className="h-5 bg-gray-200 rounded-full w-16" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="p-12 text-center" data-testid="error-prompt">
            <div className="text-red-500 mb-2 text-sm">{error}</div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              data-testid="retry-button"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
          </div>
        )}

        {/* Data list */}
        {!loading && !error && (
          <div className="p-6 space-y-4">
            {records.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500" data-testid="empty-state">
                暂无审批数据
              </div>
            ) : (
              records.map((item) => {
                const badge = getStatusBadgeProps(item.status);
                return (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => setDetailItem(item)}
                    data-testid="approval-list-item"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {item.processNo || item.id}
                        </h4>
                        <span
                          className={`status-badge px-2.5 py-0.5 text-xs font-medium rounded-full ${badge.className}`}
                          data-testid="status-badge"
                        >
                          {badge.text}
                        </span>
                        {item.processType && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            {item.processType}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailItem(item);
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                      >
                        详情
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-500">审批编号:</span>{" "}
                        {item.processNo || item.id}
                      </div>
                      <div>
                        <span className="text-gray-500">申请人ID:</span>{" "}
                        {item.applicantId ?? "-"}
                      </div>
                      <div>
                        <span className="text-gray-500">提交时间:</span>{" "}
                        {item.applyTime || item.createTime || "-"}
                      </div>
                      <div>
                        <span className="text-gray-500">更新时间:</span>{" "}
                        {item.updateTime || "-"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination */}
            {records.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  共 {total} 条记录，第 {queryParams.page}/{totalPages} 页
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(queryParams.page - 1)}
                    disabled={queryParams.page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => handlePageChange(queryParams.page + 1)}
                    disabled={queryParams.page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">审批详情</h3>
              <button
                onClick={() => setDetailItem(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(detailItem).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-500 min-w-[120px]">{key}:</span>
                  <span className="text-gray-900">
                    {value === null || value === undefined
                      ? "-"
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalListPage;
