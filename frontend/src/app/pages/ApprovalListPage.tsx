/**
 * @module frontend/src/app/pages/ApprovalListPage
 * @description Approval List Page — integrated with useApproval hook,
 *              ApprovalFlowChart, and ApprovalActionPanel components.
 *
 * Features:
 * - Page load: reads pending approval list via useApproval hook.
 * - List browsing with empty state, loading skeleton, and error prompt.
 * - Click an approval item to open a scrollable detail modal with flow chart and action panel.
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
import { useNavigate } from "react-router";
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
      return { text: "已取消", className: "bg-blue-50 text-gray-800" };
    case "COMPLETED":
      return { text: "已完成", className: "bg-green-100 text-green-800" };
    case "APPROVING":
    case "IN_PROGRESS":
      return { text: "审批中", className: "bg-blue-100 text-blue-800" };
    default:
      return { text: status ?? "未知", className: "bg-blue-50 text-gray-500" };
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

const WORKFLOW_MANAGED_TYPES = new Set(["ASSET_TRANSFER", "ASSET_CLEARANCE", "ASSET_SCRAP", "ASSET_COMPENSATION"]);

const BUSINESS_FIELD_LABELS: Record<string, string> = {
  processId: "流程编号",
  applicant: "申请人",
  applicantId: "申请人ID",
  applicantName: "申请人姓名",
  applyDate: "申请日期",
  assetId: "资产ID",
  assetIds: "资产ID",
  assetName: "资产名称",
  assetLedger: "资产账套",
  modelSpec: "型号规格",
  productCode: "产品编码",
  attachedItems: "附属物品",
  missingAccessories: "所缺配件",
  associatedCompany: "关联公司",
  transferor: "转出人",
  transferDeptCode: "转出部门编码",
  transferDept: "转出部门",
  transferLedger: "转出账套",
  transferArea: "转出区域",
  transferDeptAdmin: "转出部门资产管理员",
  receiver: "转入人ID",
  targetDeptId: "转入部门ID",
  targetUserId: "转入人ID",
  targetLocation: "转入位置",
  receiveDeptCode: "转入部门ID",
  receiveDept: "转入部门",
  receiveLedger: "转入账套",
  receiveArea: "转入区域",
  receiveDeptAdmin: "转入部门资产管理员",
  transferType: "转移类型",
  transferReason: "转移原因说明",
  reason: "原因",
  description: "说明",
  user: "使用人",
  userId: "使用人ID",
  userEmpId: "使用人工号",
  userName: "使用人姓名",
  userPhone: "使用人联系电话",
  userChineseName: "使用人中文名",
  firstUsageDate: "首次领用日期",
  startUseTime: "开始使用时间",
  startTime: "启用时间",
  deptCode: "部门编码",
  department: "使用部门",
  deptName: "部门名称",
  directManager: "直接主管",
  directManagerId: "直接主管ID",
  level1Admin: "一级资产管理员",
  level1ResourceDeptId: "一级资源管理部门ID",
  idleAssetType: "闲置资产类型",
  clearanceReason: "清退原因",
  storageLocation: "存放地点",
  assetLocation: "资产存放地点",
  foreignTradeContract: "外贸合同号",
  supervisionDate: "监管日期",
  isPersonalLaptopTransfer: "是否个人便携机转个人",
  isRemoteScrap: "是否异地报废",
  hasStorageMedia: "是否有存储介质",
  isRnD: "是否研发",
  scrapReason: "报废原因",
  attachmentLinks: "附件链接",
  contactPhone: "联系电话",
  operatorId: "经办人ID",
  operatorName: "经办人姓名",
  operatorPhone: "经办人联系电话",
  attachmentCount: "附件张数",
  responsibleUserId: "责任人ID",
  responsibleId: "赔偿责任人ID",
  responsibleName: "赔偿责任人姓名",
  responsibleDeptId: "责任部门ID",
  compensationType: "赔偿类型",
  incidentDate: "发生日期",
  lossLocation: "损失地点",
  lossDescription: "损失情况说明",
  lossDate: "损失日期",
  needSecDeclaration: "是否需要信息安全申报",
  hasBootPwd: "是否有开机密码",
  hasHddPwd: "是否有硬盘密码",
  secretFileList: "秘密级以上文件清单",
  deptAssetAdminId: "部门资产管理员ID",
  deptManagerId: "部门直接主管ID",
  officeAssetAdmin: "资产管理处管理员",
  mgmtOfficeSupport: "管理处支持人员",
};

function parseBusinessDetails(businessData?: string | null) {
  if (!businessData) return [];

  try {
    const parsed = JSON.parse(businessData) as Record<string, unknown>;
    const payload = parsed._approvalPayload && typeof parsed._approvalPayload === "object" && !Array.isArray(parsed._approvalPayload)
      ? parsed._approvalPayload as Record<string, unknown>
      : parsed;

    return Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => ({
        key,
        label: BUSINESS_FIELD_LABELS[key] ?? key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      }));
  } catch {
    return [{ key: "businessData", label: "业务数据", value: businessData }];
  }
}

// ---------------------------------------------------------------------------
// Inner component (uses store context)
// ---------------------------------------------------------------------------

/**
 * Inner page component that consumes the ApprovalStore via context.
 * Wrapped by ApprovalStoreProvider in the exported ApprovalListPage.
 */
function ApprovalListPageInner() {
  const navigate = useNavigate();
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
        const businessId = String(item.businessId ?? "");
        const summary = item.businessSummary?.toLowerCase() ?? "";
        return no.includes(keyword) || type.includes(keyword) || id.includes(keyword)
          || businessId.includes(keyword) || summary.includes(keyword);
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
      store.clearError();
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
    store.clearError();
  }, [store]);

  useEffect(() => {
    if (!selectedItemId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClearSelection, selectedItemId]);

  // -----------------------------------------------------------------------
  // Approve / Reject handlers
  // -----------------------------------------------------------------------

  const handleApprove = useCallback(
    async (payload: { approvalId: string; comment: string }) => {
      store.clearError();
      setActionLoading(true);
      let success = false;
      try {
        success = await store.approve(Number(payload.approvalId), payload.comment);
      } finally {
        setActionLoading(false);
      }
      if (success) {
        setNotice("审批已通过");
        handleClearSelection();
      }
    },
    [store, handleClearSelection],
  );

  const handleReject = useCallback(
    async (payload: { approvalId: string; comment: string }) => {
      store.clearError();
      setActionLoading(true);
      let success = false;
      try {
        success = await store.reject(Number(payload.approvalId), payload.comment);
      } finally {
        setActionLoading(false);
      }
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

  const activeDetail = currentApproval?.id === selectedItemId ? currentApproval : null;
  const businessDetails = activeDetail ? parseBusinessDetails(activeDetail.businessData) : [];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">审批列表</h2>
        <p className="text-gray-500 mt-1">浏览和管理所有审批流程</p>
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
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    : "border-transparent text-gray-500 hover:text-gray-900"
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
              <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-5 bg-blue-50 rounded w-1/3" />
                  <div className="h-5 bg-blue-50 rounded-full w-16" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="h-4 bg-blue-50 rounded w-3/4" />
                  <div className="h-4 bg-blue-50 rounded w-1/2" />
                  <div className="h-4 bg-blue-50 rounded w-2/3" />
                  <div className="h-4 bg-blue-50 rounded w-1/2" />
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
              <div className="py-12 text-center text-sm text-gray-400" data-testid="empty-state">
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
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleSelectItem(item);
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                      >
                        详情
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                      <div>
                        <span className="text-gray-400">审批编号:</span>{" "}
                        {item.processNo || item.id}
                      </div>
                      <div>
                        <span className="text-gray-400">业务ID:</span>{" "}
                        {item.businessId ?? "-"}
                      </div>
                      <div>
                        <span className="text-gray-400">申请人ID:</span>{" "}
                        {item.applicant ?? "-"}
                      </div>
                      <div>
                        <span className="text-gray-400">提交时间:</span>{" "}
                        {item.createdAt || "-"}
                      </div>
                      <div>
                        <span className="text-gray-400">更新时间:</span>{" "}
                        {item.updatedAt || "-"}
                      </div>
                    </div>
                    {item.businessSummary && (
                      <p className="mt-3 text-sm text-gray-500">
                        <span className="text-gray-400">业务摘要:</span> {item.businessSummary}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ---- Detail modal: shown when an item is selected ---- */}
      {selectedItemId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
          onClick={handleClearSelection}
          data-testid="approval-detail-modal"
        >
          <div
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Detail header */}
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div>
                <h3 id="approval-detail-title" className="text-lg font-semibold text-gray-900">
                  审批详情{activeDetail ? ` — ${activeDetail.processNo || activeDetail.id}` : ""}
                </h3>
                <p className="mt-1 text-sm text-gray-400">详情在弹窗内独立滚动，长流程不会影响列表位置。</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {activeDetail?.type && WORKFLOW_MANAGED_TYPES.has(activeDetail.type) ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/workflow-designer?businessType=${activeDetail.type}`)}
                    className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    编辑流程配置
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-gray-400 hover:text-gray-500 text-xl"
                  data-testid="close-detail-btn"
                  aria-label="关闭审批详情"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="approval-detail-panel">
              {!activeDetail ? (
                <div className="flex min-h-[360px] items-center justify-center px-6 text-sm">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700" data-testid="approval-detail-error">
                      {error}
                    </div>
                  ) : (
                    <span className="text-gray-400">正在加载审批详情...</span>
                  )}
                </div>
              ) : (
                <>
                  {/* Process info */}
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">审批编号:</span>{" "}
                        <span className="text-gray-900">{activeDetail.processNo || activeDetail.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">类型:</span>{" "}
                        <span className="text-gray-900">{activeDetail.type || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">状态:</span>{" "}
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeProps(activeDetail.status).className}`}>
                          {getStatusBadgeProps(activeDetail.status).text}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">当前步骤:</span>{" "}
                        <span className="text-gray-900">{activeDetail.currentStep}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">申请人ID:</span>{" "}
                        <span className="text-gray-900">{activeDetail.applicant ?? "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">业务ID:</span>{" "}
                        <span className="text-gray-900">{activeDetail.businessId ?? "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">业务摘要:</span>{" "}
                        <span className="text-gray-900">{activeDetail.businessSummary ?? "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">创建时间:</span>{" "}
                        <span className="text-gray-900">{activeDetail.createdAt || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">更新时间:</span>{" "}
                        <span className="text-gray-900">{activeDetail.updatedAt || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {businessDetails.length > 0 ? (
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">业务字段</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {businessDetails.map((item) => (
                          <div key={item.key} className="rounded-lg bg-gray-50 px-3 py-2">
                            <span className="text-gray-400">{item.label}:</span>{" "}
                            <span className="text-gray-900 break-all">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Approval flow chart */}
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">审批流转</h4>
                    <ApprovalFlowChart approval={activeDetail} approvalHistory={currentHistory} />
                  </div>

                  {/* Approval action panel — only for PENDING items */}
                  {activeDetail.status === "PENDING" && (
                    <div className="px-6 py-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">审批操作</h4>
                      <ApprovalActionPanel
                        approvalId={String(activeDetail.id)}
                        disabled={activeDetail.status !== "PENDING"}
                        loading={actionLoading}
                        errorMessage={error}
                        onApprove={handleApprove}
                        onReject={handleReject}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
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
