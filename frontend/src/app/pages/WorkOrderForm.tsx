/**
 * WorkOrderForm — Create / Edit Work Order page.
 *
 * SWARM-012: Real API integration for work order persistence.
 *
 * State machine:
 *   idle    → form editable, submit enabled
 *   loading → form locked, submit disabled (prevent double-submit)
 *   error   → form editable, error banner shown, user data preserved
 *   success → reset form (create) or redirect (edit)
 *
 * API endpoints (aligned with WorkOrderController.java):
 *   POST   /api/workorders          — create
 *   PUT    /api/workorders/{id}     — update
 *   GET    /api/workorders/{id}     — fetch for edit mode
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { api } from "../utils/api";
import type { WorkOrderRecord } from "../services/workOrderService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Form field values matching WorkOrderDTO on the backend */
interface WorkOrderFormData {
  title: string;
  description: string;
  priority: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  reporterName: string;
  assigneeName: string;
  deptName: string;
  plannedStartDate: string;
  plannedEndDate: string;
  estimatedCost: string;
}

const INITIAL_FORM: WorkOrderFormData = {
  title: "",
  description: "",
  priority: "NORMAL",
  assetId: "",
  assetName: "",
  assetCode: "",
  reporterName: "",
  assigneeName: "",
  deptName: "",
  plannedStartDate: "",
  plannedEndDate: "",
  estimatedCost: "",
};

type SubmitState = "idle" | "loading" | "error" | "success";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  // -- state ---------------------------------------------------------------
  const [formData, setFormData] = useState<WorkOrderFormData>(INITIAL_FORM);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(isEditMode);

  // -- fetch existing order in edit mode -----------------------------------
  useEffect(() => {
    if (!isEditMode || !id) return;

    let cancelled = false;

    async function fetchOrder() {
      try {
        setPageLoading(true);
        const order: WorkOrderRecord = await api.get(`/workorders/${id}`);
        if (cancelled) return;

        // Map API response to form fields
        setFormData({
          title: order.title ?? "",
          description: order.description ?? "",
          priority: order.priority ?? "NORMAL",
          assetId: order.assetId != null ? String(order.assetId) : "",
          assetName: order.assetName ?? "",
          assetCode: order.assetCode ?? "",
          reporterName: order.reporterName ?? "",
          assigneeName: order.assigneeName ?? "",
          deptName: (order as any).deptName ?? "",
          plannedStartDate: (order as any).plannedStartDate ?? "",
          plannedEndDate: (order as any).plannedEndDate ?? "",
          estimatedCost: (order as any).estimatedCost != null
            ? String((order as any).estimatedCost)
            : "",
        });
      } catch (err: any) {
        if (!cancelled) {
          setApiError(err?.message ?? "加载工单数据失败");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    fetchOrder();
    return () => {
      cancelled = true;
    };
  }, [id, isEditMode]);

  // -- handlers ------------------------------------------------------------
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Clear error on user interaction
      if (apiError) setApiError(null);
    },
    [apiError],
  );

  /**
   * Submit handler — POST for create, PUT for edit.
   * Follows idle → loading → (success|error) state machine.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Prevent double-submit
      if (submitState === "loading") return;

      setSubmitState("loading");
      setApiError(null);

      // Build payload — omit empty optional fields
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
      };
      if (formData.assetId) payload.assetId = Number(formData.assetId);
      if (formData.assetName) payload.assetName = formData.assetName;
      if (formData.assetCode) payload.assetCode = formData.assetCode;
      if (formData.reporterName) payload.reporterName = formData.reporterName;
      if (formData.assigneeName) payload.assigneeName = formData.assigneeName;
      if (formData.deptName) payload.deptName = formData.deptName;
      if (formData.plannedStartDate) payload.plannedStartDate = formData.plannedStartDate;
      if (formData.plannedEndDate) payload.plannedEndDate = formData.plannedEndDate;
      if (formData.estimatedCost) payload.estimatedCost = Number(formData.estimatedCost);

      try {
        if (isEditMode && id) {
          // PUT /api/workorders/{id}
          await api.put(`/workorders/${id}`, payload);
          setSubmitState("success");
          navigate("/approval");
        } else {
          // POST /api/workorders
          await api.post("/workorders", payload);
          setSubmitState("success");
          // Reset form on successful create
          setFormData(INITIAL_FORM);
          navigate("/approval");
        }
      } catch (err: any) {
        // Error state: preserve user data, show error, unlock form
        setSubmitState("error");
        setApiError(err?.message ?? "提交失败，请稍后重试");
      } finally {
        // Always reset loading guard so form is re-usable
        setSubmitState((prev) => (prev === "loading" ? "idle" : prev));
      }
    },
    [formData, isEditMode, id, navigate, submitState],
  );

  const isLoading = submitState === "loading";

  // -- render: loading skeleton for edit mode ------------------------------
  if (pageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // -- render: form --------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditMode ? "编辑工单" : "新建工单"}
            </h2>
            {isEditMode && id && (
              <p className="text-sm text-gray-500 mt-1">工单编号：{id}</p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error banner */}
        {apiError && (
          <div
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
            data-testid="work-order-error"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">提交失败</p>
              <p className="mt-1">{apiError}</p>
            </div>
          </div>
        )}

        {/* Success banner (briefly visible before redirect) */}
        {submitState === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <p className="font-medium">
              {isEditMode ? "工单更新成功" : "工单创建成功"}
            </p>
          </div>
        )}

        {/* Section: Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">基本信息</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="请输入工单标题"
                />
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  优先级 <span className="text-red-500">*</span>
                </label>
                <select
                  id="priority"
                  name="priority"
                  required
                  value={formData.priority}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="NORMAL">中</option>
                  <option value="URGENT">高</option>
                  <option value="EMERGENCY">紧急</option>
                </select>
              </div>

              <div>
                <label htmlFor="reporterName" className="block text-sm font-medium text-gray-700 mb-1">
                  报修人
                </label>
                <input
                  id="reporterName"
                  type="text"
                  name="reporterName"
                  value={formData.reporterName}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="报修人姓名"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="请详细描述工单内容..."
              />
            </div>
          </div>
        </div>

        {/* Section: Asset Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-purple-50/50">
            <h3 className="text-lg font-semibold text-purple-900">关联资产</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="assetId" className="block text-sm font-medium text-gray-700 mb-1">
                资产ID
              </label>
              <input
                id="assetId"
                type="text"
                name="assetId"
                value={formData.assetId}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="关联资产ID"
              />
            </div>

            <div>
              <label htmlFor="assetName" className="block text-sm font-medium text-gray-700 mb-1">
                资产名称
              </label>
              <input
                id="assetName"
                type="text"
                name="assetName"
                value={formData.assetName}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="资产名称"
              />
            </div>

            <div>
              <label htmlFor="assetCode" className="block text-sm font-medium text-gray-700 mb-1">
                资产编码
              </label>
              <input
                id="assetCode"
                type="text"
                name="assetCode"
                value={formData.assetCode}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="资产编码"
              />
            </div>

            <div>
              <label htmlFor="deptName" className="block text-sm font-medium text-gray-700 mb-1">
                所属部门
              </label>
              <input
                id="deptName"
                type="text"
                name="deptName"
                value={formData.deptName}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="部门名称"
              />
            </div>
          </div>
        </div>

        {/* Section: Assignment & Schedule */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50/50">
            <h3 className="text-lg font-semibold text-blue-900">派工与排期</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="assigneeName" className="block text-sm font-medium text-gray-700 mb-1">
                指派给
              </label>
              <input
                id="assigneeName"
                type="text"
                name="assigneeName"
                value={formData.assigneeName}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="执行人姓名"
              />
            </div>

            <div>
              <label htmlFor="estimatedCost" className="block text-sm font-medium text-gray-700 mb-1">
                预估费用
              </label>
              <input
                id="estimatedCost"
                type="number"
                name="estimatedCost"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="plannedStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                计划开始日期
              </label>
              <input
                id="plannedStartDate"
                type="datetime-local"
                name="plannedStartDate"
                value={formData.plannedStartDate}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="plannedEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                计划结束日期
              </label>
              <input
                id="plannedEndDate"
                type="datetime-local"
                name="plannedEndDate"
                value={formData.plannedEndDate}
                onChange={handleChange}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 sticky bottom-6 bg-white p-4 rounded-xl shadow-lg border border-gray-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="work-order-submit-btn"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? "保存修改" : "创建工单"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default WorkOrderForm;
