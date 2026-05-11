/**
 * @module frontend/src/app/pages/ApprovalListPage
 * @description Approval List Page — integrated with useApproval hook,
 *              ApprovalFlowChart, and ApprovalActionPanel components.
 *
 * Features:
 * - Page load: reads pending approval list via useApproval hook.
 * - List browsing with empty state, loading skeleton, and error prompt.
 * - Click an approval item to display detail area with flow chart and action panel.
 * - Approve/reject actions refresh the list and clear the current selection.
 * - Status tab filtering and debounced keyword search.
 *
 * Types sourced from: frontend/src/app/services/approval/types.ts
 *
 * @see frontend/src/app/hooks/useApproval.ts
 * @see frontend/src/app/components/approval/ApprovalFlowChart.tsx
 * @see frontend/src/app/components/approval/ApprovalActionPanel.tsx
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, RefreshCw } from "lucide-react";
import { ApprovalStoreProvider, useApprovalStore } from "../stores/approvalStore";
import { ApprovalFlowChart } from "../components/approval/ApprovalFlowChart";
import { ApprovalActionPanel } from "../components/approval/ApprovalActionPanel";
import type { ApprovalItem } from "../services/approval/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tab filter options. */
type StatusTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

/**
 * Get status badge display properties from a backend status enum value.
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
// Inner component (uses store context)
// ---------------------------------------------------------------------------

/**
 * Inner page component that consumes the ApprovalStore via context.
 * Wrapped by ApprovalStoreProvider in the exported ApprovalListPage.
 */
function ApprovalListPageInner() {
  const store = useApprovalStore();

  // ---- Derived state from store ----
  const { pendingApprovals, currentApproval, currentHistory, isLoading, error } = store;

  // ---- Local UI state ----
  const [searchInput, setSearchInput] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");
  const [filteredApprovals, setFilteredApprovals] = useState<ApprovalItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching on mount
  // -----------------------------------------------------------------------

  useEffect(() => {
    store.fetchPendingApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Client-side tab + keyword filtering
  // -----------------------------------------------------------------------

  useEffect(() => {
    let items = pendingApprovals;

    // Status tab filter
    if (activeTab !== "ALL") {
      items = items.filter((item) => item.status === activeTab);
    }

    // Keyword filter
    const keyword = searchInput.trim().toLowerCase();
    if (keyword) {
      items = items.filter((item) => {
        const no = item.processNo?.toLowerCase() ?? "";
        const type = item.type?.toLowerCase() ?? "";
        const id = String(item.id);
        return no.includes(keyword) || type.includes(keyword) || id.includes(keyword);
      });
    }

    setFilteredApprovals(items);
  }, [pendingApprovals, activeTab, searchInput]);

  // -----------------------------------------------------------------------
  // Tab change handler
  // -----------------------------------------------------------------------

  const handleTabChange = useCallback((tab: StatusTab) => {
    setActiveTab(tab);
  }, []);

  // -----------------------------------------------------------------------
  // Debounced search handler
  // -----------------------------------------------------------------------

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Select an approval item to view details
  // -----------------------------------------------------------------------

  const handleSelectItem = useCallback(
    async (item: ApprovalItem) => {
      setSelectedItemId(item.id);
      await store.getApprovalHistory(item.id);
    },
    [store],
  );

  // -----------------------------------------------------------------------
  // Clear selection
  // -----------------------------------------------------------------------

  const handleClearSelection = useCallback(() => {
    setSelectedItemId(null);
    store.clearCurrent();
  }, [store]);

  // -----------------------------------------------------------------------
  // Approve / Reject handlers
  // -----------------------------------------------------------------------

  const handleApprove = useCallback(
    async (payload: { approvalId: string; comment: string }) => {
      setActionLoading(true);
      const success = await store.approve(Number(payload.approvalId), payload.comment);
      setActionLoading(false);
      if (success) {
        setNotice("审批已通过");
        handleClearSelection();
      }
    },
    [store, handleClearSelection],
  );

  const handleReject = useCallback(
    async (payload: { approvalId: string; comment: string }) => {
      setActionLoading(true);
      const success = await store.reject(Number(payload.approvalId), payload.comment);
      setActionLoading(false);
      if (success) {
        setNotice("审批已驳回");
        handleClearSelection();
      }
    },
    [store, handleClearSelection],
  );

  // -----------------------------------------------------------------------
  // Retry handler
  // -----------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    store.fetchPendingApprovals();
  }, [store]);

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
        <div
          className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between"
          data-testid="notice-banner"
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            className="text-green-500 hover:text-green-700"
          >
            &times;
          </button>
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
        {isLoading && !selectedItemId && (
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
        {!isLoading && error && (
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
        {!isLoading && !error && (
          <div className="p-6 space-y-4">
            {filteredApprovals.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500" data-testid="empty-state">
                暂无审批数据
              </div>
            ) : (
              filteredApprovals.map((item) => {
                const badge = getStatusBadgeProps(item.status);
                const isSelected = selectedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-5 transition-colors cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                    onClick={() => handleSelectItem(item)}
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
                        {item.type && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            {item.type}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item);
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
                        {item.applicant ?? "-"}
                      </div>
                      <div>
                        <span className="text-gray-500">提交时间:</span>{" "}
                        {item.createdAt || "-"}
                      </div>
                      <div>
                        <span className="text-gray-500">更新时间:</span>{" "}
                        {item.updatedAt || "-"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ---- Detail panel: shown when an item is selected ---- */}
      {selectedItemId && currentApproval && (
        <div className="bg-white rounded-lg border border-blue-200 shadow-sm" data-testid="approval-detail-panel">
          {/* Detail header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              审批详情 — {currentApproval.processNo || currentApproval.id}
            </h3>
            <button
              onClick={handleClearSelection}
              className="text-gray-400 hover:text-gray-600 text-xl"
              data-testid="close-detail-btn"
            >
              &times;
            </button>
          </div>

          {/* Process info */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">审批编号:</span>{" "}
                <span className="text-gray-900">{currentApproval.processNo || currentApproval.id}</span>
              </div>
              <div>
                <span className="text-gray-500">类型:</span>{" "}
                <span className="text-gray-900">{currentApproval.type || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">状态:</span>{" "}
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeProps(currentApproval.status).className}`}>
                  {getStatusBadgeProps(currentApproval.status).text}
                </span>
              </div>
              <div>
                <span className="text-gray-500">当前步骤:</span>{" "}
                <span className="text-gray-900">{currentApproval.currentStep}</span>
              </div>
              <div>
                <span className="text-gray-500">申请人ID:</span>{" "}
                <span className="text-gray-900">{currentApproval.applicant ?? "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">创建时间:</span>{" "}
                <span className="text-gray-900">{currentApproval.createdAt || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">更新时间:</span>{" "}
                <span className="text-gray-900">{currentApproval.updatedAt || "-"}</span>
              </div>
            </div>
          </div>

          {/* Approval flow chart */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">审批流转</h4>
            <ApprovalFlowChart approvalHistory={currentHistory} />
          </div>

          {/* Approval action panel — only for PENDING items */}
          {currentApproval.status === "PENDING" && (
            <div className="px-6 py-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">审批操作</h4>
              <ApprovalActionPanel
                approvalId={String(currentApproval.id)}
                disabled={false}
                loading={actionLoading}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component with store provider wrapper
// ---------------------------------------------------------------------------

/**
 * ApprovalListPage — main component for browsing approval processes.
 *
 * Wraps the inner page with an ApprovalStoreProvider so the useApprovalStore
 * hook (and by extension the useApproval hook) can access shared state.
 *
 * @returns The rendered approval list page.
 */
export function ApprovalListPage() {
  return (
    <ApprovalStoreProvider>
      <ApprovalListPageInner />
    </ApprovalStoreProvider>
  );
}

export default ApprovalListPage;
