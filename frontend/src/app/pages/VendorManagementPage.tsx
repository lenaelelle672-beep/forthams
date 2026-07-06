/**
 * @module frontend/src/app/pages/VendorManagementPage
 * @description Vendor Management Page — orchestration layer for CRUD operations.
 *
 * This page manages vendor data with real backend API integration.
 * Features:
 *   - List all vendors with search/filter (client-side debounced filtering)
 *   - Create new vendor via dialog form
 *   - Edit existing vendor via dialog form
 *   - Delete vendor with confirmation dialog
 *
 * No mock data or fake delays — all operations persist through the backend API.
 * Form fields strictly align with the Vendor entity 5-tuple:
 *   name, vendorCode, contactPerson, contactPhone, contactEmail
 *
 * @since SWARM-046
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Search, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../services/vendorApi";
import type { Vendor } from "../services/vendorApi";
import VendorTable from "../components/vendor/VendorTable";
import VendorFormDialog from "../components/vendor/VendorFormDialog";

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

/**
 * VendorManagementPage — main page for managing vendors.
 *
 * Orchestrates the VendorTable, VendorFormDialog, and delete confirmation dialog.
 * State management includes: vendor list, loading, search keyword, dialog controls,
 * and delete confirmation.
 *
 * Data lifecycle:
 *   1. On mount, fetches all vendors via GET /api/vendors/list
 *   2. Client-side search filtering with 300ms debounce
 *   3. Create/Edit via POST/PUT API calls
 *   4. Delete via DELETE API call with confirmation
 *
 * All API errors are caught and displayed via toast (sonner), never silently failing.
 *
 * @returns React component
 */
export default function VendorManagementPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** 供应商列表数据 */
  const [vendors, setVendors] = useState<Vendor[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 搜索关键词（已防抖后的值） */
  const [searchTerm, setSearchTerm] = useState("");

  /** 搜索输入值（防抖前的本地值） */
  const [searchInput, setSearchInput] = useState("");

  /** 搜索防抖定时器引用 */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 弹窗是否可见 */
  const [dialogOpen, setDialogOpen] = useState(false);

  /** 当前编辑的供应商（null 表示创建模式） */
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null);

  /** 表单提交中 */
  const [submitting, setSubmitting] = useState(false);

  /** 删除确认弹窗目标 ID */
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  /** 正在删除的供应商 ID */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch all vendors from the backend.
   *
   * Calls GET /api/vendors/list and updates the vendor list state.
   * Errors are caught and displayed via toast, never silently failing.
   */
  const fetchVendorList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVendors();
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "获取供应商列表失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load vendor data on mount.
   */
  useEffect(() => {
    fetchVendorList();
  }, [fetchVendorList]);

  // ---------------------------------------------------------------------------
  // Search / Filter
  // ---------------------------------------------------------------------------

  /**
   * Filtered vendor list based on search term.
   *
   * Performs client-side fuzzy matching on name, vendorCode, contactPerson, contactPhone.
   */
  const filteredVendors = searchTerm.trim()
    ? vendors.filter((v) => {
        const kw = searchTerm.toLowerCase();
        return (
          (v.name?.toLowerCase().includes(kw) ?? false) ||
          (v.vendorCode?.toLowerCase().includes(kw) ?? false) ||
          (v.contactPerson?.toLowerCase().includes(kw) ?? false) ||
          (v.contactPhone?.toLowerCase().includes(kw) ?? false)
        );
      })
    : vendors;

  /**
   * Handle search input change with 300ms debounce.
   *
   * @param value - search input value
   */
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
  }, []);

  // ---------------------------------------------------------------------------
  // Create / Edit Dialog
  // ---------------------------------------------------------------------------

  /**
   * Open dialog for creating a new vendor.
   */
  const handleOpenCreate = useCallback(() => {
    setCurrentVendor(null);
    setDialogOpen(true);
  }, []);

  /**
   * Open dialog for editing an existing vendor.
   *
   * @param vendor - the vendor to edit
   */
  const handleOpenEdit = useCallback((vendor: Vendor) => {
    setCurrentVendor(vendor);
    setDialogOpen(true);
  }, []);

  /**
   * Close dialog and reset state.
   */
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setCurrentVendor(null);
  }, []);

  /**
   * Handle form submission (create or update).
   *
   * Validates required fields, calls the appropriate API,
   * refreshes the list on success, shows error toast on failure.
   *
   * @param data - vendor form data (5 business fields, no id)
   */
  const handleSubmit = useCallback(
    async (data: Omit<Vendor, "id">) => {
      if (!data.name.trim()) {
        toast.error("供应商名称不能为空");
        return;
      }

      setSubmitting(true);
      try {
        if (currentVendor?.id) {
          await updateVendor(currentVendor.id, data);
          toast.success("供应商更新成功");
        } else {
          await createVendor(data);
          toast.success("供应商创建成功");
        }

        handleCloseDialog();
        await fetchVendorList();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "操作失败，请稍后重试";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [currentVendor, handleCloseDialog, fetchVendorList],
  );

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  /**
   * Open delete confirmation dialog for a vendor.
   *
   * @param id - vendor ID to delete
   */
  const handleRequestDelete = useCallback((id: number) => {
    setConfirmDeleteId(id);
  }, []);

  /**
   * Cancel delete confirmation.
   */
  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  /**
   * Confirm and execute vendor deletion.
   *
   * Calls DELETE /api/vendors/{id}, refreshes list on success,
   * shows error toast on failure.
   */
  const handleConfirmDelete = useCallback(async () => {
    if (confirmDeleteId === null) return;

    const targetId = confirmDeleteId;
    setDeletingId(targetId);
    setConfirmDeleteId(null);

    try {
      await deleteVendor(targetId);
      toast.success("供应商删除成功");
      await fetchVendorList();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "删除失败，请稍后重试";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId, fetchVendorList]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">供应商管理</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="btn-add-vendor"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4" />
            新增供应商
          </button>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索供应商名称、编码、联系人或电话..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={fetchVendorList}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-200 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {/* 供应商列表表格 */}
      <VendorTable
        vendors={filteredVendors}
        loading={loading}
        onEdit={handleOpenEdit}
        onDelete={handleRequestDelete}
        deletingId={deletingId}
      />

      {/* 统计信息 */}
      {!loading && filteredVendors.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            共 {filteredVendors.length} 条记录
            {searchTerm && ` (搜索: "${searchTerm}")`}
          </p>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <VendorFormDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        currentVendor={currentVendor}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {/* 删除确认弹窗 */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              确定要删除该供应商吗？此操作不可撤销。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200
                  bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white
                  hover:bg-red-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
