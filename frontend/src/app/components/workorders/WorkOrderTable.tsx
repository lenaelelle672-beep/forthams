/**
 * @module components/workorders/WorkOrderTable
 * @description Reusable table component for displaying work orders with status badges,
 * priority indicators, and action buttons based on lifecycle state machine.
 *
 * @since SWARM-063
 */

import {
  Eye,
  Send,
  Play,
  CheckCircle,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  type WorkOrderRecord,
  getWorkOrderStatusLabel,
  getPriorityLabel,
  isSubmittableStatus,
  isDeletableStatus,
} from "../../services/workOrderService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status tab filter options matching backend status enum. */
export type StatusTab =
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

/** Props for WorkOrderTable. */
export interface WorkOrderTableProps {
  /** Array of work order records to display. */
  records: WorkOrderRecord[];
  /** Loading state flag. */
  loading: boolean;
  /** Current page number (1-based). */
  page: number;
  /** Total number of records across all pages. */
  total: number;
  /** Total number of pages. */
  totalPages: number;
  /** Currently active status tab filter. */
  activeTab: StatusTab;
  /** Current search keyword. */
  keyword: string;
  /** Currently operating work order ID (for action button spinners). */
  operating: number | null;
  /** Callback fired when page changes. */
  onPageChange: (page: number) => void;
  /** Callback fired when status tab changes. */
  onTabChange: (tab: StatusTab) => void;
  /** Callback fired when search keyword changes. */
  onKeywordChange: (keyword: string) => void;
  /** Callback to trigger a data refresh. */
  onRefresh: () => void;
  /** Callback fired when user clicks "view detail". */
  onView: (id: number) => void;
  /** Callback fired when user clicks "submit for approval". */
  onSubmit: (id: number) => void;
  /** Callback fired when user clicks "start execution". */
  onStart: (id: number) => void;
  /** Callback fired when user clicks "complete". */
  onComplete: (id: number) => void;
  /** Callback fired when user clicks "delete". */
  onDelete: (id: number) => void;
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

// ---------------------------------------------------------------------------
// Badge helpers
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
      return "bg-gray-100 text-gray-800";
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
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
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
    case "EMERGENCY":
      return "bg-red-100 text-red-800";
    case "URGENT":
      return "bg-orange-100 text-orange-800";
    case "NORMAL":
    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderTable — displays a paginated, filterable table of work orders.
 *
 * Renders status tabs, search bar, data table with action buttons,
 * and pagination controls. Actions are gated by the work order state machine.
 *
 * @param props - see WorkOrderTableProps
 * @returns the table section element
 */
export function WorkOrderTable({
  records,
  loading,
  page,
  total,
  totalPages,
  activeTab,
  keyword,
  operating,
  onPageChange,
  onTabChange,
  onKeywordChange,
  onRefresh,
  onView,
  onSubmit,
  onStart,
  onComplete,
  onDelete,
}: WorkOrderTableProps) {
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
    <div className="px-6 py-12 text-center text-gray-500 text-sm">
      暂无工单数据
    </div>
  );

  // -- render: pagination --------------------------------------------------
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          共 {total} 条记录，第 {page}/{totalPages} 页
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    onClick={() => onPageChange(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Status Tabs */}
      <div className="border-b border-gray-200 px-6 pt-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜索工单标题或编号..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="work-order-search-input"
          />
        </div>
        <button
          onClick={onRefresh}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="刷新"
        >
          <svg
            className="w-4 h-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  工单编号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  标题
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  关联资产
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  报修人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  优先级
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  指派给
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">
                    {order.workOrderNo || order.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">
                    {order.title || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {order.assetName || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {order.reporterName || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadgeClasses(order.priority)}`}
                    >
                      {getPriorityLabel(order.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
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
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {order.createTime || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-1">
                      {/* View detail */}
                      <button
                        onClick={() => onView(order.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Submit for approval */}
                      {isSubmittableStatus(order.status) && (
                        <button
                          onClick={() => onSubmit(order.id)}
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
                          onClick={() => onStart(order.id)}
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
                          onClick={() => onComplete(order.id)}
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
                          onClick={() => onDelete(order.id)}
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
  );
}

export default WorkOrderTable;
