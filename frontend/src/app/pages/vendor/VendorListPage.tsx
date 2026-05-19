/**
 * VendorListPage — 供应商列表管理页面
 *
 * 展示供应商列表，支持搜索过滤、新增、编辑和删除操作。
 * 数据通过 vendorService 调用真实后端 API，无本地伪数据逻辑。
 * 表单字段严格对齐 Vendor.java 六元组：name, vendorCode, contactPerson, contactPhone, contactEmail。
 *
 * @module pages/vendor/VendorListPage
 * @since SWARM-034
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "../../services/vendorService";
import type { VendorRecord } from "../../services/vendorService";

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * VendorListPage — 供应商列表管理页面
 *
 * 提供供应商的 CRUD 功能：浏览列表、关键词搜索、新增供应商、
 * 编辑供应商信息、删除供应商。
 * 数据通过 vendorService 调用真实后端 REST API 持久化。
 *
 * 搜索采用客户端模糊匹配（后端 list 接口返回全量数据后在前端过滤）。
 * 编辑操作跳转至 /vendors/:id/edit 表单页，新增跳转至 /vendors/new。
 * 删除操作在当前页面执行，带二次确认弹窗。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/vendors" element={<VendorListPage />} />
 * ```
 */
export default function VendorListPage() {
  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  const navigate = useNavigate();

  /** 供应商列表数据 */
  const [vendors, setVendors] = useState<VendorRecord[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 搜索关键词（已防抖后的值） */
  const [keyword, setKeyword] = useState("");

  /** 搜索防抖定时器引用 */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 搜索输入值（防抖前的本地值） */
  const [searchInput, setSearchInput] = useState("");

  /** 删除确认中的供应商 ID */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /** 删除确认弹窗目标 */
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据获取                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 从后端获取供应商列表
   *
   * 调用 vendorService.getVendors() (GET /api/vendors/list) 获取全部供应商数据
   */
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vendorService.getVendors();
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "获取供应商列表失败";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 初始加载数据
   */
  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  /* ------------------------------------------------------------------ */
  /*  搜索过滤                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 按关键词过滤后的供应商列表
   *
   * 在客户端对 name、vendorCode、contactPerson、contactPhone 字段进行模糊匹配
   */
  const filteredVendors = keyword.trim()
    ? vendors.filter((v) => {
        const kw = keyword.toLowerCase();
        return (
          (v.name?.toLowerCase().includes(kw) ?? false) ||
          (v.vendorCode?.toLowerCase().includes(kw) ?? false) ||
          (v.contactPerson?.toLowerCase().includes(kw) ?? false) ||
          (v.contactPhone?.toLowerCase().includes(kw) ?? false)
        );
      })
    : vendors;

  /**
   * 处理搜索输入变化（防抖 300ms）
   *
   * @param value - 搜索输入值
   */
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setKeyword(value);
    }, 300);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  导航操作                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 跳转至新增供应商页面
   */
  const handleGoCreate = useCallback(() => {
    navigate("/vendors/new");
  }, [navigate]);

  /**
   * 跳转至编辑供应商页面
   *
   * @param vendorId - 待编辑的供应商 ID
   */
  const handleGoEdit = useCallback(
    (vendorId: number) => {
      navigate(`/vendors/${vendorId}/edit`);
    },
    [navigate],
  );

  /* ------------------------------------------------------------------ */
  /*  删除操作                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 打开删除确认弹窗
   *
   * @param vendorId - 待删除的供应商 ID
   */
  const handleConfirmDelete = useCallback((vendorId: number) => {
    setConfirmDeleteId(vendorId);
  }, []);

  /**
   * 取消删除
   */
  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  /**
   * 确认删除供应商
   *
   * 调用 vendorService.deleteVendor() (DELETE /api/vendors/{id})，
   * 成功后 toast 提示并刷新列表。异常捕获后弹出错误提示。
   */
  const handleDelete = useCallback(async () => {
    if (confirmDeleteId === null) return;

    const targetId = confirmDeleteId;
    setDeletingId(targetId);
    setConfirmDeleteId(null);

    try {
      await vendorService.deleteVendor(targetId);
      toast.success("供应商删除成功");
      await fetchVendors();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "删除失败，请稍后重试";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId, fetchVendors]);

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">供应商管理</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoCreate}
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
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索供应商名称、编码、联系人或电话..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 刷新 */}
        <button
          type="button"
          onClick={fetchVendors}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-300 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 供应商列表表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                供应商编码
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                供应商名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                联系人
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                联系电话
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                联系邮箱
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : filteredVendors.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  {keyword ? "未找到匹配的供应商" : "暂无供应商数据"}
                </td>
              </tr>
            ) : (
              filteredVendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                    {vendor.vendorCode || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {vendor.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vendor.contactPerson || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vendor.contactPhone || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vendor.contactEmail || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGoEdit(vendor.id!)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs
                          rounded border border-gray-300 bg-white text-gray-700
                          hover:bg-gray-50 transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(vendor.id!)}
                        disabled={deletingId === vendor.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs
                          rounded border border-red-300 bg-white text-red-600
                          hover:bg-red-50 disabled:opacity-50
                          disabled:cursor-not-allowed transition-colors"
                        title="删除"
                      >
                        {deletingId === vendor.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 统计信息 */}
      {!loading && filteredVendors.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            共 {filteredVendors.length} 条记录
            {keyword && ` (搜索: "${keyword}")`}
          </p>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div className="absolute inset-0 bg-black/50" />

          {/* 弹窗内容 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              确定要删除该供应商吗？此操作不可撤销。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300
                  bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
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
