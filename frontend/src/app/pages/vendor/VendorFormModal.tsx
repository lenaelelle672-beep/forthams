/**
 * VendorFormModal — 供应商创建/编辑弹窗表单组件
 *
 * 以模态框形式提供供应商的新增和编辑功能。
 * 表单字段严格对齐 Vendor.java 六元组：name, vendorCode, contactPerson, contactPhone, contactEmail。
 * 数据通过 vendorService 调用真实后端 API 持久化。
 *
 * @module pages/vendor/VendorFormModal
 * @since SWARM-058
 */

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "../../services/vendorService";
import type { Vendor, VendorRecord } from "../../services/vendorService";

/* ------------------------------------------------------------------ */
/*  类型与常量                                                         */
/* ------------------------------------------------------------------ */

/** 弹窗组件的 Props 定义 */
interface VendorFormModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 编辑模式下传入的供应商 ID，null 表示创建模式 */
  vendorId: number | null;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 操作成功后的回调（用于刷新列表等） */
  onSuccess: () => void;
}

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
/*  弹窗组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * VendorFormModal — 供应商创建/编辑弹窗表单组件
 *
 * 通过 `vendorId` prop 判断当前模式：
 * - `vendorId === null` → 创建模式（空表单）
 * - `vendorId` 有值 → 编辑模式（挂载时回填数据）
 *
 * 提交时调用 `createVendor` 或 `updateVendor`，成功后 toast 提示
 * 并触发 `onSuccess` 回调刷新列表。
 * 网络异常和后端业务异常均会弹出错误提示，禁止静默失败。
 *
 * @param props - 弹窗组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <VendorFormModal
 *   visible={showModal}
 *   vendorId={editingId}
 *   onClose={() => setShowModal(false)}
 *   onSuccess={fetchVendors}
 * />
 * ```
 */
export default function VendorFormModal({
  visible,
  vendorId,
  onClose,
  onSuccess,
}: VendorFormModalProps) {
  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  /** 表单数据 */
  const [form, setForm] = useState<VendorFormState>(INITIAL_FORM);

  /** 数据加载状态（编辑模式下回显数据） */
  const [loading, setLoading] = useState(false);

  /** 表单提交中 */
  const [submitting, setSubmitting] = useState(false);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /** 是否为编辑模式 */
  const isEditMode = vendorId !== null;

  /* ------------------------------------------------------------------ */
  /*  弹窗打开时重置 / 回填                                              */
  /* ------------------------------------------------------------------ */

  /**
   * 当弹窗打开或 vendorId 变化时，初始化表单
   *
   * 创建模式：重置为空表单
   * 编辑模式：通过 `getVendorById` 拉取数据回填
   */
  useEffect(() => {
    if (!visible) return;

    if (vendorId === null) {
      // 创建模式：重置空表单
      setForm(INITIAL_FORM);
      setError(null);
      return;
    }

    // 编辑模式：加载供应商数据
    let cancelled = false;

    async function loadVendor() {
      setLoading(true);
      setError(null);
      try {
        const vendor: VendorRecord = await vendorService.getVendorById(vendorId);
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
  }, [visible, vendorId]);

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
   * 成功后 toast 提示并触发 onSuccess 回调。
   * 异常捕获后弹出错误提示，阻断关闭。
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

        if (isEditMode && vendorId !== null) {
          await vendorService.updateVendor(vendorId, payload);
          toast.success("供应商更新成功");
        } else {
          await vendorService.createVendor(payload);
          toast.success("供应商创建成功");
        }

        onSuccess();
        onClose();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "操作失败，请稍后重试";
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [form, isEditMode, vendorId, onSuccess, onClose],
  );

  /**
   * 处理 ESC 键关闭弹窗
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    },
    [submitting, onClose],
  );

  /* ------------------------------------------------------------------ */
  /*  不渲染                                                             */
  /* ------------------------------------------------------------------ */

  if (!visible) return null;

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={submitting ? undefined : onClose} />

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditMode ? "编辑供应商" : "新增供应商"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 加载状态 */}
        {loading ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">加载供应商信息...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

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
                autoFocus
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
                onClick={onClose}
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
        )}
      </div>
    </div>
  );
}
