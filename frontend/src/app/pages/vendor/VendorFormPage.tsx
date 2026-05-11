/**
 * VendorFormPage — 供应商创建/编辑表单页面
 *
 * 根据 URL 路由参数判断创建模式或编辑模式：
 * - /vendors/new          → 创建模式（空表单）
 * - /vendors/edit/:id     → 编辑模式（回显数据）
 *
 * 数据通过 vendorService 调用真实后端 API，无 Mock 逻辑。
 * 表单字段严格对齐 Vendor.java 六元组：name, vendorCode, contactPerson, contactPhone, contactEmail。
 *
 * @module pages/vendor/VendorFormPage
 * @since SWARM-034
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "../../services/vendorService";
import type { Vendor } from "../../services/vendorService";

/* ------------------------------------------------------------------ */
/*  类型与常量                                                         */
/* ------------------------------------------------------------------ */

/** 表单字段接口，严格对齐 Vendor.java 六元组（不含 id） */
interface VendorFormState {
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
}

/** 空表单初始值 */
const INITIAL_FORM: VendorFormState = {
  name: "",
  vendorCode: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
};

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * VendorFormPage — 供应商创建/编辑表单页面
 *
 * 通过 `useParams` 读取路由中的 `id` 判断当前模式：
 * - 有 id → 编辑模式，挂载时调用 `getVendorById` 回填表单
 * - 无 id → 创建模式，初始化空表单
 *
 * 提交时调用 `createVendor` 或 `updateVendor`，成功后跳转至列表页。
 * 网络异常和后端业务异常（如 vendorCode 唯一性冲突）均会弹出错误提示，
 * 阻断跳转，禁止静默失败。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/vendors/new" element={<VendorFormPage />} />
 * <Route path="/vendors/edit/:id" element={<VendorFormPage />} />
 * ```
 */
export default function VendorFormPage() {
  /* ------------------------------------------------------------------ */
  /*  路由与导航                                                         */
  /* ------------------------------------------------------------------ */

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  /** 是否为编辑模式 */
  const isEditMode = Boolean(id);

  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  /** 表单数据 */
  const [form, setForm] = useState<VendorFormState>(INITIAL_FORM);

  /** 页面加载状态（编辑模式下回显数据） */
  const [loading, setLoading] = useState(isEditMode);

  /** 表单提交中 */
  const [submitting, setSubmitting] = useState(false);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据回填（编辑模式）                                               */
  /* ------------------------------------------------------------------ */

  /**
   * 编辑模式下，挂载时通过 `getVendorById` 拉取供应商数据回填表单
   */
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadVendor() {
      setLoading(true);
      setError(null);
      try {
        const vendor = await vendorService.getVendorById(id);
        if (!cancelled) {
          setForm({
            name: vendor.name ?? "",
            vendorCode: vendor.vendorCode ?? "",
            contactPerson: vendor.contactPerson ?? "",
            contactPhone: vendor.contactPhone ?? "",
            contactEmail: vendor.contactEmail ?? "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "获取供应商信息失败";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVendor();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ------------------------------------------------------------------ */
  /*  表单交互                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 处理表单字段变化
   *
   * @param field - 字段名
   * @param value - 新值
   */
  const handleChange = useCallback(
    (field: keyof VendorFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (error) setError(null);
    },
    [error],
  );

  /**
   * 表单提交处理器
   *
   * 验证必填字段后调用 createVendor 或 updateVendor。
   * 成功后 toast 提示并导航回列表页。
   * 异常捕获后弹出错误提示，阻断跳转。
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.name.trim()) {
        toast.error("供应商名称不能为空");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        /** 构建严格对齐六元组的 payload（不含 id） */
        const payload: Omit<Vendor, "id"> = {
          name: form.name.trim(),
          vendorCode: form.vendorCode.trim(),
          contactPerson: form.contactPerson.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
        };

        if (isEditMode && id) {
          await vendorService.updateVendor(id, payload);
          toast.success("供应商更新成功");
        } else {
          await vendorService.createVendor(payload);
          toast.success("供应商创建成功");
        }

        navigate("/vendors");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "操作失败，请稍后重试";
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [form, isEditMode, id, navigate],
  );

  /**
   * 返回列表页
   */
  const handleGoBack = useCallback(() => {
    navigate("/vendors");
  }, [navigate]);

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-500 text-sm">加载供应商信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleGoBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="返回列表"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? "编辑供应商" : "新增供应商"}
        </h1>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 供应商名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            供应商名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="请输入供应商名称"
            required
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
            value={form.vendorCode}
            onChange={(e) => handleChange("vendorCode", e.target.value)}
            placeholder="请输入供应商编码"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 联系人 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            联系人
          </label>
          <input
            type="text"
            value={form.contactPerson}
            onChange={(e) => handleChange("contactPerson", e.target.value)}
            placeholder="请输入联系人"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 联系电话 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            联系电话
          </label>
          <input
            type="text"
            value={form.contactPhone}
            onChange={(e) => handleChange("contactPhone", e.target.value)}
            placeholder="请输入联系电话"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 联系邮箱 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            联系邮箱
          </label>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => handleChange("contactEmail", e.target.value)}
            placeholder="请输入联系邮箱"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleGoBack}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300
              bg-white text-gray-700 hover:bg-gray-50
              disabled:opacity-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? "保存修改" : "创建供应商"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
