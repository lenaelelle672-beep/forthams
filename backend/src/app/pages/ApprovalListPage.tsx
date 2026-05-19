/**
 * @module frontend/src/app/pages/ApprovalListPage
 * @description Approval List Page — fully refactored with shadcn/ui + Tailwind CSS.
 *
 * Features:
 * - Page load: reads pending approval list via useApproval hook.
 * - List browsing with empty state, loading skeleton, and error prompt.
 * - Click an approval item Card to expand inline detail with flow chart and action panel.
 * - Approve/reject actions refresh the list and collapse the expanded item.
 * - Status tab filtering and keyword search.
 * - All UI built with shadcn/ui components + lucide-react icons.
 *
 * @see frontend/src/app/hooks/useApproval.ts
 * @see frontend/src/app/components/approval/ApprovalFlowChart.tsx
 * @see frontend/src/app/components/approval/ApprovalActionPanel.tsx
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Inbox,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Workflow,
} from "lucide-react";

import { ApprovalStoreProvider, useApprovalStore } from "../stores/approvalStore";
import { ApprovalFlowChart } from "../components/approval/ApprovalFlowChart";
import { ApprovalActionPanel } from "../components/approval/ApprovalActionPanel";
import type { ApprovalItem } from "../services/approval/types";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { cn } from "../components/ui/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tab filter options. */
type StatusTab = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

/**
 * Get status badge display properties using shadcn Badge variant + Tailwind.
 */
function getStatusBadgeConfig(status?: string): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  text: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case "PENDING":
      return {
        variant: "outline",
        className: "border-yellow-300 bg-yellow-50 text-yellow-700",
        text: "待审批",
        icon: <Clock className="h-3 w-3" />,
      };
    case "APPROVED":
      return {
        variant: "outline",
        className: "border-green-300 bg-green-50 text-green-700",
        text: "已通过",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "REJECTED":
      return {
        variant: "destructive",
        className: "bg-red-50 text-red-700 border-red-300",
        text: "已拒绝",
        icon: <XCircle className="h-3 w-3" />,
      };
    case "CANCELLED":
      return {
        variant: "secondary",
        className: "bg-gray-100 text-gray-600",
        text: "已取消",
        icon: <Ban className="h-3 w-3" />,
      };
    case "COMPLETED":
      return {
        variant: "outline",
        className: "border-green-300 bg-green-50 text-green-700",
        text: "已完成",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "APPROVING":
    case "IN_PROGRESS":
      return {
        variant: "outline",
        className: "border-blue-300 bg-blue-50 text-blue-700",
        text: "审批中",
        icon: <Clock className="h-3 w-3" />,
      };
    default:
      return {
        variant: "secondary",
        className: "bg-gray-100 text-gray-600",
        text: status ?? "未知",
        icon: null,
      };
  }
}

/**
 * Get a human-readable Chinese label for a status tab value.
 */
function getTabLabel(tab: StatusTab): string {
  switch (tab) {
    case "ALL":
      return "全部";
    case "PENDING":
      return "待审批";
    case "APPROVED":
      return "已通过";
    case "REJECTED":
      return "已拒绝";
    case "CANCELLED":
      return "已取消";
    default:
      return tab;
  }
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const STATUS_TABS: StatusTab[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

const WORKFLOW_MANAGED_TYPES = new Set([
  "ASSET_TRANSFER",
  "ASSET_CLEARANCE",
  "ASSET_SCRAP",
  "ASSET_COMPENSATION",
]);

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
    const payload =
      parsed._approvalPayload &&
      typeof parsed._approvalPayload === "object" &&
      !Array.isArray(parsed._approvalPayload)
        ? (parsed._approvalPayload as Record<string, unknown>)
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
// Loading skeleton component
// ---------------------------------------------------------------------------

function ApprovalListSkeleton() {
  return (
    <div className="space-y-4" data-testid="loading-skeleton">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state component
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state"
    >
      <div className="mb-4 rounded-full bg-muted p-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">暂无审批数据</p>
      <p className="mt-1 text-xs text-muted-foreground">
        当前筛选条件下没有找到审批记录
      </p>
    </div>
  );
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
  const { pendingApprovals, currentApproval, currentHistory, isLoading, error } =
    store;

  // ---- Local UI state ----
  const [searchInput, setSearchInput] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");
  const [filteredApprovals, setFilteredApprovals] = useState<ApprovalItem[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
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
        return (
          no.includes(keyword) ||
          type.includes(keyword) ||
          id.includes(keyword) ||
          businessId.includes(keyword) ||
          summary.includes(keyword)
        );
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
  // Select an approval item to toggle expand/collapse
  // -----------------------------------------------------------------------

  const handleToggleExpand = useCallback(
    async (item: ApprovalItem) => {
      store.clearError();
      if (expandedItemId === item.id) {
        setExpandedItemId(null);
        store.clearCurrent();
        return;
      }
      setExpandedItemId(item.id);
      await store.getApprovalHistory(item.id);
    },
    [store, expandedItemId],
  );

  // -----------------------------------------------------------------------
  // Collapse expanded item
  // -----------------------------------------------------------------------

  const handleCollapse = useCallback(() => {
    setExpandedItemId(null);
    store.clearCurrent();
    store.clearError();
  }, [store]);

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
        handleCollapse();
      }
    },
    [store, handleCollapse],
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
        handleCollapse();
      }
    },
    [store, handleCollapse],
  );

  // -----------------------------------------------------------------------
  // Retry handler
  // -----------------------------------------------------------------------

  const handleRetry = useCallback(() => {
    store.fetchPendingApprovals();
  }, [store]);

  const activeDetail =
    currentApproval?.id === expandedItemId ? currentApproval : null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header — align with WorkflowCenter style */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <Workflow className="h-4 w-4" />
            审批管理
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">
            审批列表
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            浏览和管理所有审批流程，点击卡片展开查看详情和审批流转图。
          </p>
        </div>
      </div>

      {/* Notice banner */}
      {notice && (
        <div
          className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          data-testid="notice-banner"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </span>
          <button
            onClick={() => setNotice(null)}
            className="text-green-500 hover:text-green-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Search bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索审批编号、类型..."
              className="pl-10"
              data-testid="approval-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tab status filter + content */}
      <Card>
        <div className="border-b">
          <div className="flex">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                data-testid={`tab-${tab.toLowerCase()}`}
              >
                {getTabLabel(tab)}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="p-6">
          {/* Loading state */}
          {isLoading && expandedItemId === null && <ApprovalListSkeleton />}

          {/* Error state */}
          {!isLoading && error && (
            <div
              className="flex flex-col items-center justify-center py-12 text-center"
              data-testid="error-prompt"
            >
              <div className="mb-3 rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="mb-3 text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                onClick={handleRetry}
                data-testid="retry-button"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
            </div>
          )}

          {/* Data list */}
          {!isLoading && !error && (
            <div className="space-y-4">
              {filteredApprovals.length === 0 ? (
                <EmptyState />
              ) : (
                filteredApprovals.map((item) => {
                  const badge = getStatusBadgeConfig(item.status);
                  const isExpanded = expandedItemId === item.id;
                  const itemDetail =
                    activeDetail?.id === item.id ? activeDetail : null;
                  const itemHistory =
                    currentApproval?.id === item.id ? currentHistory : [];
                  const itemBusiness = itemDetail
                    ? parseBusinessDetails(itemDetail.businessData)
                    : [];

                  return (
                    <Collapsible
                      key={item.id}
                      open={isExpanded}
                      onOpenChange={() => {
                        if (isExpanded) {
                          handleCollapse();
                        } else {
                          void handleToggleExpand(item);
                        }
                      }}
                    >
                      <Card
                        className={cn(
                          "cursor-pointer overflow-hidden transition-colors",
                          isExpanded && "ring-2 ring-primary/20",
                        )}
                        data-testid="approval-list-item"
                      >
                        {/* Collapsible trigger = card header */}
                        <CollapsibleTrigger asChild>
                          <button className="w-full text-left">
                            <CardHeader className="pb-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  {isExpanded ? (
                                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                                  )}
                                  <CardTitle className="truncate text-lg">
                                    {item.processNo || item.id}
                                  </CardTitle>
                                  <Badge
                                    variant={badge.variant}
                                    className={cn("shrink-0", badge.className)}
                                    data-testid="status-badge"
                                  >
                                    {badge.icon}
                                    {badge.text}
                                  </Badge>
                                  {item.type && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-purple-200 bg-purple-50 text-purple-700"
                                    >
                                      {item.type}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                          </button>
                        </CollapsibleTrigger>

                        {/* Summary row — always visible */}
                        <CardContent className="pt-2">
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground md:grid-cols-4">
                            <div>
                              <span className="text-muted-foreground/70">
                                审批编号:
                              </span>{" "}
                              {item.processNo || item.id}
                            </div>
                            <div>
                              <span className="text-muted-foreground/70">
                                业务ID:
                              </span>{" "}
                              {item.businessId ?? "-"}
                            </div>
                            <div>
                              <span className="text-muted-foreground/70">
                                申请人ID:
                              </span>{" "}
                              {item.applicant ?? "-"}
                            </div>
                            <div>
                              <span className="text-muted-foreground/70">
                                提交时间:
                              </span>{" "}
                              {item.createdAt || "-"}
                            </div>
                          </div>
                          {item.businessSummary && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              <span className="text-muted-foreground/70">
                                业务摘要:
                              </span>{" "}
                              {item.businessSummary}
                            </p>
                          )}
                        </CardContent>

                        {/* Expanded detail content */}
                        <CollapsibleContent>
                          <div className="border-t">
                            <ScrollArea className="max-h-[60vh]">
                              <div className="space-y-6 p-6">
                                {/* Process info */}
                                <div>
                                  <h4 className="mb-3 text-sm font-medium text-foreground">
                                    流程信息
                                  </h4>
                                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                                    {itemDetail ? (
                                      <>
                                        <div className="rounded-lg bg-muted/50 p-3">
                                          <div className="text-xs text-muted-foreground">
                                            审批编号
                                          </div>
                                          <div className="mt-1 font-medium">
                                            {itemDetail.processNo ||
                                              itemDetail.id}
                                          </div>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-3">
                                          <div className="text-xs text-muted-foreground">
                                            类型
                                          </div>
                                          <div className="mt-1 font-medium">
                                            {itemDetail.type || "-"}
                                          </div>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-3">
                                          <div className="text-xs text-muted-foreground">
                                            当前步骤
                                          </div>
                                          <div className="mt-1 font-medium">
                                            {itemDetail.currentStep}
                                          </div>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 p-3">
                                          <div className="text-xs text-muted-foreground">
                                            更新时间
                                          </div>
                                          <div className="mt-1 font-medium">
                                            {itemDetail.updatedAt || "-"}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                                        {error ? (
                                          <span className="text-destructive">
                                            {error}
                                          </span>
                                        ) : (
                                          "正在加载审批详情..."
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Business fields */}
                                {itemBusiness.length > 0 && (
                                  <>
                                    <Separator />
                                    <div>
                                      <h4 className="mb-3 text-sm font-medium text-foreground">
                                        业务字段
                                      </h4>
                                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                        {itemBusiness.map((field) => (
                                          <div
                                            key={field.key}
                                            className="rounded-lg bg-muted/50 p-3"
                                          >
                                            <div className="text-xs text-muted-foreground">
                                              {field.label}
                                            </div>
                                            <div className="mt-1 break-all font-medium">
                                              {field.value}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Approval flow chart */}
                                {itemDetail && (
                                  <>
                                    <Separator />
                                    <div>
                                      <h4 className="mb-3 text-sm font-medium text-foreground">
                                        审批流转
                                      </h4>
                                      <ApprovalFlowChart
                                        approval={itemDetail}
                                        approvalHistory={itemHistory}
                                      />
                                    </div>
                                  </>
                                )}

                                {/* Approval action panel — only for PENDING */}
                                {itemDetail && itemDetail.status === "PENDING" && (
                                  <>
                                    <Separator />
                                    <div>
                                      <h4 className="mb-3 text-sm font-medium text-foreground">
                                        审批操作
                                      </h4>
                                      <ApprovalActionPanel
                                        approvalId={String(itemDetail.id)}
                                        disabled={
                                          itemDetail.status !== "PENDING"
                                        }
                                        loading={actionLoading}
                                        errorMessage={error}
                                        onApprove={handleApprove}
                                        onReject={handleReject}
                                      />
                                    </div>
                                  </>
                                )}

                                {/* Workflow config link for managed types */}
                                {itemDetail?.type &&
                                  WORKFLOW_MANAGED_TYPES.has(itemDetail.type) && (
                                    <div className="flex justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          navigate(
                                            `/workflow-designer?businessType=${itemDetail.type}`,
                                          )
                                        }
                                      >
                                        编辑流程配置
                                      </Button>
                                    </div>
                                  )}
                              </div>
                            </ScrollArea>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
