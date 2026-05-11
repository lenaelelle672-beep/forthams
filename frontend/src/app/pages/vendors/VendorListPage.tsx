/**
 * VendorListPage — 供应商列表管理页面
 *
 * 展示供应商列表，支持搜索过滤、新增、编辑和删除操作。
 * 数据通过后端 `/vendors` API 进行持久化。
 *
 * @module pages/vendors/VendorListPage
 * @since SWARM-022
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../../utils/api";

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 供应商记录接口
 *
 * @description 与后端 Vendor entity 对应的前端类型定义
 */
interface VendorRecord {
  /** 供应商 ID */
  id: number;
  /** 供应商名称 */
  name?: string;
  /** 供应商编码 */
  vendorCode?: string;
  /** 联系人 */
  contactPerson?: string;
  /** 联系电话 */
  contactPhone?: string;
  /** 联系邮箱 */
  contactEmail?: string;
  /** 地址 */
  address?: string;
  /** 状态 (0=禁用, 1=启用) */
  status?: number;
  /** 创建时间 */
  createTime?: string;
  /** 更新时间 */
  updateTime?: string;
  /** 允许扩展属性 */
  [key: string]: unknown;
}

/**
 * 创建/编辑供应商的表单数据
 *
 * @description 用于新增和编辑供应商的表单字段
 */
interface VendorFormData {
  /** 供应商名称 */
  name: string;
  /** 供应商编码 */
  vendorCode: string;
  /** 联系人 */
  contactPerson: string;
  /** 联系电话 */
  contactPhone: string;
  /** 联系邮箱 */
  contactEmail: string;
  /** 地址 */
  address: string;
  /** 状态 */
  status: number;
}

/**
 * API 响应包装
 *
 * @description 后端统一响应结构
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 空表单默认值 */
const EMPTY_FORM: VendorFormData = {
  name: "",
  vendorCode: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  status: 1,
};

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * VendorListPage — 供应商列表管理页面
 *
 * 提供供应商的 CRUD 功能：浏览列表、关键词搜索、新增供应商、
 * 编辑供应商信息、删除供应商。
 * 数据通过后端 `/vendors` REST API 持久化。
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

  /** 供应商列表数据 */
  const [vendors, setVendors] = useState<VendorRecord[]>([]);

  /** 列表加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 搜索关键词 */
  const [keyword, setKeyword] = useState("");

  /** 搜索防抖定时器引用 */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 搜索输入值（防抖前的本地值） */
  const [searchInput, setSearchInput] = useState("");

  /** 新增/编辑弹窗是否可见 */
  const [modalOpen, setModalOpen] = useState(false);

  /** 当前编辑的供应商 ID，null 表示新增模式 */
  const [editingId, setEditingId] = useState<number | null>(null);

  /** 表单数据 */
  const [formData, setFormData] = useState<VendorFormData>(EMPTY_FORM);

  /** 表单提交中 */
  const [submitting, setSubmitting] = useState(false);

  /** 删除确认中 */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据获取                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 从后端获取供应商列表
   *
   * @description 调用 GET /vendors/list 获取全部供应商数据，
   * 支持按关键词在客户端进行搜索过滤
   */
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ApiResponse<VendorRecord[]>>(
        "/vendors/list",
      );
      const data = response.data?.data ?? response.data;
      const list = Array.isArray(data) ? data : [];
      setVendors(list);
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
   * @description 在客户端对 name、vendorCode、contactPerson 字段进行模糊匹配
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
  /*  新增/编辑弹窗                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * 打开新增供应商弹窗
   */
  const handleOpenCreate = useCallback(() => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  /**
   * 打开编辑供应商弹窗
   *
   * @param vendor - 待编辑的供应商记录
   */
  const handleOpenEdit = useCallback((vendor: VendorRecord) => {
    setEditingId(vendor.id);
    setFormData({
      name: vendor.name ?? "",
      vendorCode: vendor.vendorCode ?? "",
      contactPerson: vendor.contactPerson ?? "",
      contactPhone: vendor.contactPhone ?? "",
      contactEmail: vendor.contactEmail ?? "",
      address: vendor.address ?? "",
      status: vendor.status ?? 1,
    });
    setModalOpen(true);
  }, []);

  /**
   * 关闭弹窗
   */
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }, []);

  /**
   * 处理表单字段变化
   *
   * @param field - 字段名
   * @param value - 字段值
   */
  const handleFieldChange = useCallback(
    (field: keyof VendorFormData, value: string | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /**
   * 提交表单（新增或编辑）
   *
   * @description 根据是否有 editingId 判断是新增还是编辑，
   * 调用对应的 POST 或 PUT API
   */
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error("供应商名称不能为空");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        vendorCode: formData.vendorCode.trim() || undefined,
        contactPerson: formData.contactPerson.trim() || undefined,
        contactPhone: formData.contactPhone.trim() || undefined,
        contactEmail: formData.contactEmail.trim() || undefined,
        address: formData.address.trim() || undefined,
        status: formData.status,
      };

      if (editingId !== null) {
        await apiClient.put(`/vendors/${editingId}`, payload);
        toast.success("供应商更新成功");
      } else {
        await apiClient.post("/vendors", payload);
        toast.success("供应商创建成功");
      }

      handleCloseModal();
      await fetchVendors();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "操作失败，请稍后重试";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingId, handleCloseModal, fetchVendors]);

  /* ------------------------------------------------------------------ */
  /*  删除操作                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 确认删除供应商
   *
   * @param id - 待删除的供应商 ID
   */
  const handleDelete = useCallback(
    async (id: number) => {
      setDeletingId(id);
      try {
        await apiClient.delete(`/vendors/${id}`);
        toast.success("供应商删除成功");
        await fetchVendors();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "删除失败，请稍后重试";
        toast.error(message);
      } finally {
        setDeletingId(null);
      }
    },
    [fetchVendors],
  );

  /* ------------------------------------------------------------------ */
  /*  渲染辅助                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 渲染状态徽标
   *
   * @param vendorStatus - 供应商状态值
   * @returns React 节点
   */
  const renderStatusBadge = (vendorStatus: number | undefined) => {
    if (vendorStatus === 1) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          启用
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        禁用
      </span>
    );
  };

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
                地址
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
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
                  colSpan={8}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : filteredVendors.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
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
                    {vendor.vendorCode ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {vendor.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vendor.contactPerson ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vendor.contactPhone ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {vendor.contactEmail ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate"
                    title={vendor.address}
                  >
                    {vendor.address ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {renderStatusBadge(vendor.status)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(vendor)}
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
                        onClick={() => handleDelete(vendor.id)}
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

      {/* 新增/编辑弹窗 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseModal}
          />

          {/* 弹窗内容 */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            {/* 弹窗标题 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId !== null ? "编辑供应商" : "新增供应商"}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 表单 */}
            <div className="space-y-4">
              {/* 供应商名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  供应商名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="请输入供应商名称"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>

              {/* 供应商编码 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  供应商编码
                </label>
                <input
                  type="text"
                  value={formData.vendorCode}
                  onChange={(e) =>
                    handleFieldChange("vendorCode", e.target.value)
                  }
                  placeholder="请输入供应商编码"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>

              {/* 联系人 + 联系电话 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    联系人
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      handleFieldChange("contactPerson", e.target.value)
                    }
                    placeholder="请输入联系人"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                      bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                      focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    联系电话
                  </label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      handleFieldChange("contactPhone", e.target.value)
                    }
                    placeholder="请输入联系电话"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                      bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                      focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* 联系邮箱 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  联系邮箱
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    handleFieldChange("contactEmail", e.target.value)
                  }
                  placeholder="请输入联系邮箱"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>

              {/* 地址 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  地址
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    handleFieldChange("address", e.target.value)
                  }
                  placeholder="请输入地址"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>

              {/* 状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    handleFieldChange("status", Number(e.target.value))
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>启用</option>
                  <option value={0}>禁用</option>
                </select>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300
                  bg-white text-gray-700 hover:bg-gray-50
                  disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white
                  hover:bg-blue-700 disabled:opacity-50
                  disabled:cursor-not-allowed transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    提交中...
                  </span>
                ) : editingId !== null ? (
                  "保存修改"
                ) : (
                  "创建供应商"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
