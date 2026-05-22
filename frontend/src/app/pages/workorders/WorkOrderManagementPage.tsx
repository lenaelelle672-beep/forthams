/**
 * @module pages/workorders/WorkOrderManagementPage
 * @description Work Order Management Page — centralized page for creating, browsing,
 * searching, filtering, and managing the complete work order lifecycle.
 *
 * Features:
 * - Server-side paginated list with status tabs and keyword search
 * - Inline "new work order" creation form (toggleable)
 * - Lifecycle action buttons per row (submit, start, complete, delete)
 * - Real backend API integration via workOrderService
 *
 * API:
 *   GET    /api/workorders              — paginated list
 *   POST   /api/workorders              — create work order
 *   POST   /api/workorders/{id}/submit  — submit for approval
 *   POST   /api/workorders/{id}/operate — lifecycle operations
 *   DELETE /api/workorders/{id}         — delete work order
 *
 * @since SWARM-063
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Plus, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import {
  workOrderService,
  type WorkOrderRecord,
} from "../../services/workOrderService";
import { WorkOrderTable, type StatusTab } from "../../components/workorders/WorkOrderTable";
import { WorkOrderCreateForm } from "../../components/workorders/WorkOrderCreateForm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default page size for list queries. */
const DEFAULT_PAGE_SIZE = 10;

/** Debounce delay for keyword search (ms). */
const SEARCH_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * WorkOrderManagementPage — full lifecycle work order management.
 *
 * Renders a list view with filtering/searching and an inline creation form
 * that replaces the table view when toggled. On successful creation,
 * navigates to the work order detail page.
 *
 * State machine:
 *   - "list" mode: shows WorkOrderTable with filters and pagination
 *   - "create" mode: shows WorkOrderCreateForm
 *
 * @returns the management page element
 */
export function WorkOrderManagementPage() {
  const navigate = useNavigate();

  // -- view mode -----------------------------------------------------------
  const [mode, setMode] = useState<"list" | "create">("list");

  // -- list state ----------------------------------------------------------
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
  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    setPage(1);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

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

  // -- create form callbacks -----------------------------------------------

  /** Navigate to detail page after successful creation. */
  const handleCreateSuccess = useCallback(
    (created: WorkOrderRecord) => {
      navigate(`/workorders/${created.id}`);
    },
    [navigate],
  );

  /** Cancel creation — return to list mode. */
  const handleCreateCancel = useCallback(() => {
    setMode("list");
  }, []);

  // -- CSV export ----------------------------------------------------------

  const handleExportCSV = useCallback(() => {
    if (records.length === 0) {
      toast.info("暂无数据可导出");
      return;
    }
    const headers = ["工单编号", "标题", "关联资产", "报修人", "优先级", "指派给", "状态", "创建时间"];
    const rows = records.map((r) => [
      r.workOrderNo ?? r.id,
      r.title ?? "",
      r.assetName ?? "",
      r.reporterName ?? "",
      r.priority ?? "",
      r.assigneeName ?? "",
      r.status ?? "",
      r.createTime ?? "",
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `workorders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  }, [records]);

  // -- render: list mode ---------------------------------------------------
  if (mode === "create") {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCreateCancel}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
              type="button"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">新建工单</h2>
              <p className="text-sm text-gray-400 mt-1">
                创建后状态为草稿，可从详情页提交审批
              </p>
            </div>
          </div>
        </div>

        <WorkOrderCreateForm
          onSuccess={handleCreateSuccess}
          onCancel={handleCreateCancel}
        />
      </div>
    );
  }

  // -- render: list mode ---------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">工单管理</h2>
          <p className="text-gray-500 mt-1">创建、查看和管理所有工单</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors shadow-sm"
            data-testid="work-order-export-btn"
          >
            <Download className="w-4 h-4" />
            导出CSV
          </button>
          <button
            onClick={() => setMode("create")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            data-testid="work-order-create-nav-btn"
          >
            <Plus className="w-4 h-4" />
            新建工单
          </button>
        </div>
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

      {/* Work Order Table */}
      <WorkOrderTable
        records={records}
        loading={loading}
        page={page}
        total={total}
        totalPages={totalPages}
        activeTab={activeTab}
        keyword={keyword}
        operating={operating}
        onPageChange={setPage}
        onTabChange={handleTabChange}
        onKeywordChange={handleKeywordChange}
        onRefresh={fetchData}
        onView={(id) => navigate(`/workorders/${id}`)}
        onSubmit={handleSubmit}
        onStart={handleStart}
        onComplete={handleComplete}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default WorkOrderManagementPage;
