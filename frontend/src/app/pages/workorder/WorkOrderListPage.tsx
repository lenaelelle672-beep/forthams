/**
 * @module frontend/src/app/pages/workorder/WorkOrderListPage
 * @description Work Order List Page — real backend API driven with pagination, search, and filters.
 *
 * Features:
 * - Server-side paginated list of work orders
 * - Status tab filter triggers backend query with status parameter
 * - Keyword search (debounced 300ms) triggers backend fuzzy query
 * - Skeleton loading state while fetching
 * - Action buttons per row (submit, start, complete, detail) based on state machine
 * - Navigate to create page via "新建工单" button
 *
 * API: GET /api/workorders?page=&pageSize=&status=&keyword=
 *
 * @see frontend/src/app/services/workOrderService.ts
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  Play,
  CheckCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  workOrderService,
  getWorkOrderStatusLabel,
  getPriorityLabel,
  isSubmittableStatus,
  isDeletableStatus,
  isCancellableStatus,
  type WorkOrderRecord,
} from "../../services/workOrderService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tab filter options matching backend status enum. */
type StatusTab =
  | "ALL"
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

/** Tab configuration with label and optional badge color. */
interface TabConfig {
  key: StatusTab;
  label: string;
}

const STATUS_TABS: TabConfig[] = [
  { key: "ALL", label: "全部" },
  { key: "DRAFT", label: "草稿" },
  { key: "PENDING", label: "待审批" },
  { key: "APPROVED", label: "待派工" },
  { key: "EXECUTING", label: "处理中" },
  { key: "COMPLETED", label: "已完成" },
  { key: "REJECTED", label: "已驳回" },
  { key: "CANCELLED", label: "已取消" },
];

/** Default page size for list queries. */
const DEFAULT_PAGE_SIZE = 10;

/** Debounce delay for keyword search (ms). */
const SEARCH_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

/**
 * Get Tailwind CSS classes for status badge based on work order status.
 *
 * @param status — the backend status string
 * @returns CSS class string for the badge
 */
function getStatusBadgeClasses(status?: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-blue-50 text-gray-800";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "APPROVED":
      return "bg-blue-100 text-blue-800";
    case "EXECUTING":
      return "bg-indigo-100 text-indigo-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "REJECTED":
      return "bg-red-100 text-red-800";
    case "CANCELLED":
      return "bg-blue-50 text-gray-500";
    default:
      return "bg-blue-50 text-gray-500";
  }
}

/**
 * Get Tailwind CSS classes for priority badge.
 *
 * @param priority — the backend priority string
 * @returns CSS class string for the badge
 */
function getPriorityBadgeClasses(priority?: string): string {
  switch (priority) {
    case "CRITICAL":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800";
    case "LOW":
    default:
      return "bg-blue-50 text-blue-800";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderListPage — paginated, searchable, filterable list of work orders.
 *
 * Fetches data from backend via workOrderService.list() which calls
 * GET /api/workorders with query parameters.
 */
export function WorkOrderListPage() {
  const navigate = useNavigate();

  // -- state ---------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<WorkOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operating, setOperating] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- debounced keyword search --------------------------------------------
  const handleKeywordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setKeyword(value);
      setPage(1);

      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        setDebouncedKeyword(value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // -- data fetching -------------------------------------------------------
  /**
   * Fetch work orders from backend with current filters.
   * Maps to GET /api/workorders?page=&pageSize=&status=&keyword=
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      };
      if (activeTab !== "ALL") {
        params.status = activeTab;
      }
      if (debouncedKeyword.trim()) {
        params.keyword = debouncedKeyword.trim();
      }

      const result = await workOrderService.list(params);
      setRecords(result.records || []);
      setTotal(result.total || 0);
      setTotalPages(result.pages || Math.ceil((result.total || 0) / DEFAULT_PAGE_SIZE));
    } catch (err: any) {
      setError(err?.message ?? "加载工单列表失败");
      setRecords([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, debouncedKeyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- tab change handler --------------------------------------------------
  const handleTabChange = useCallback((tab: StatusTab) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  // -- lifecycle action handlers -------------------------------------------

  /**
   * Submit a draft work order for approval.
   * Calls POST /api/workorders/{id}/submit
   */
  const handleSubmit = useCallback(
    async (id: number) => {
      try {
        setOperating(id);
        await workOrderService.submit(id);
        setNotice("工单已提交审批");
        await fetchData();
      } catch (err: any) {
        setError(err?.message ?? "提交失败");
      } finally {
        setOperating(null);
      }
    },
    [fetchData],
  );

  /**
   * Start executing an approved work order.
   * Calls POST /api/workorders/{id}/operate with operation "start"
   */
  const handleStart = useCallback(
    async (id: number) => {
      try {
        setOperating(id);
        await workOrderService.operate(id, "start", "开始执行");
        setNotice("工单已开始执行");
        await fetchData();
      } catch (err: any) {
        setError(err?.message ?? "操作失败");
      } finally {
        setOperating(null);
      }
    },
    [fetchData],
  );

  /**
   * Complete an executing work order.
   * Calls POST /api/workorders/{id}/operate with operation "complete"
   */
  const handleComplete = useCallback(
    async (id: number) => {
      try {
        setOperating(id);
        await workOrderService.operate(id, "complete", "处理完成");
        setNotice("工单已完成");
        await fetchData();
      } catch (err: any) {
        setError(err?.message ?? "操作失败");
      } finally {
        setOperating(null);
      }
    },
    [fetchData],
  );

  /**
   * Delete a work order.
   * Calls DELETE /api/workorders/{id}
   * Only available for DRAFT, REJECTED, CANCELLED status.
   */
  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm("确定要删除此工单吗？")) return;
      try {
        setOperating(id);
        await workOrderService.delete(id);
        setNotice("工单已删除");
        await fetchData();
      } catch (err: any) {
        setError(err?.message ?? "删除失败");
      } finally {
        setOperating(null);
      }
    },
    [fetchData],
  );

  // -- render: loading skeleton --------------------------------------------
  const renderSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
      ))}
    </div>
  );

  // -- render: empty state -------------------------------------------------
  const renderEmpty = () => (
    <div className="px-6 py-12 text-center text-gray-400 text-sm">
      暂无工单数据
    </div>
  );

  // -- render: pagination --------------------------------------------------
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          共 {total} 条记录，第 {page}/{totalPages} 页
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev !== undefined && p - prev > 1;
              return (
                <span key={p} className="flex items-center">
                  {showEllipsis && (
                    <span className="px-1 text-gray-400 text-sm">...</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // -- render --------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">工单管理</h2>
          <p className="text-gray-500 mt-1">创建、查看和管理所有工单</p>
        </div>
        <button
          onClick={() => navigate("/workorders/create")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          data-testid="work-order-create-nav-btn"
        >
          <Plus className="w-4 h-4" />
          新建工单
        </button>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800">
            &times;
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Status Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-6 pt-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={handleKeywordChange}
              placeholder="搜索工单标题或编号..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="work-order-search-input"
            />
          </div>
          <button
            onClick={() => fetchData()}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-blue-50 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          renderSkeleton()
        ) : records.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    工单编号
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    标题
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    关联资产
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    报修人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    优先级
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    指派给
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    创建时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e3a5f]">
                {records.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      {order.workOrderNo || order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">
                      {order.title || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.assetName || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.reporterName || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadgeClasses(order.priority)}`}
                      >
                        {getPriorityLabel(order.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.assigneeName || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeClasses(order.status)}`}
                        data-testid={`work-order-status-${order.id}`}
                      >
                        {getWorkOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.createTime || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        {/* View detail */}
                        <button
                          onClick={() => navigate(`/workorders/${order.id}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Submit for approval */}
                        {isSubmittableStatus(order.status) && (
                          <button
                            onClick={() => handleSubmit(order.id)}
                            disabled={operating === order.id}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                            title="提交审批"
                          >
                            {operating === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Start execution */}
                        {order.status === "APPROVED" && (
                          <button
                            onClick={() => handleStart(order.id)}
                            disabled={operating === order.id}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                            title="开始执行"
                          >
                            {operating === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Complete */}
                        {order.status === "EXECUTING" && (
                          <button
                            onClick={() => handleComplete(order.id)}
                            disabled={operating === order.id}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="完成"
                          >
                            {operating === order.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Delete */}
                        {isDeletableStatus(order.status) && (
                          <button
                            onClick={() => handleDelete(order.id)}
                            disabled={operating === order.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {renderPagination()}
      </div>
    </div>
  );
}

export default WorkOrderListPage;
