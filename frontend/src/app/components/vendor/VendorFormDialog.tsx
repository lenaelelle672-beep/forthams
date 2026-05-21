/**
 * @module frontend/src/app/components/vendor/VendorFormDialog
 * @description Vendor form dialog component for creating and editing vendors.
 *
 * Supports both "create" and "edit" modes based on the `currentVendor` prop.
 * Form fields strictly align with the Vendor entity 5-tuple:
 *   name, vendorCode, contactPerson, contactPhone, contactEmail
 *
 * @since SWARM-046
 */

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import type { Vendor } from "../../services/vendorApi";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * VendorFormDialog component props
 *
 * @param open - whether the dialog is visible
 * @param onClose - callback to close the dialog
 * @param currentVendor - vendor data for edit mode, null/undefined for create mode
 * @param onSubmit - callback with form data when submitted
 * @param submitting - whether the form is currently being submitted
 */
interface VendorFormDialogProps {
  /** 弹窗是否可见 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 当前编辑的供应商（null/undefined 表示创建模式） */
  currentVendor?: Vendor | null;
  /** 提交回调 */
  onSubmit: (data: Omit<Vendor, "id">) => void;
  /** 是否提交中 */
  submitting: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 空表单初始值 */
const EMPTY_FORM: Omit<Vendor, "id"> = {
  name: "",
  vendorCode: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VendorFormDialog — modal dialog for creating or editing a vendor.
 *
 * When `currentVendor` is provided, the form is pre-populated for editing.
 * When `currentVendor` is null/undefined, the form starts empty for creation.
 * Includes basic validation: name and vendorCode are required.
 *
 * @param props - VendorFormDialogProps
 * @returns React component
 */
export default function VendorFormDialog({
  open,
  onClose,
  currentVendor,
  onSubmit,
  submitting,
}: VendorFormDialogProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** 表单数据 */
  const [form, setForm] = useState<Omit<Vendor, "id">>(EMPTY_FORM);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  /**
   * When dialog opens or currentVendor changes, populate form data.
   * Edit mode: fill with currentVendor data.
   * Create mode: reset to empty.
   */
  useEffect(() => {
    if (open) {
      if (currentVendor) {
        setForm({
          name: currentVendor.name ?? "",
          vendorCode: currentVendor.vendorCode ?? "",
          contactPerson: currentVendor.contactPerson ?? "",
          contactPhone: currentVendor.contactPhone ?? "",
          contactEmail: currentVendor.contactEmail ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, currentVendor]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle form field change.
   *
   * @param field - field name
   * @param value - new value
   */
  const handleChange = (field: keyof Omit<Vendor, "id">, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Handle form submission with validation.
   *
   * @param e - form event
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    onSubmit({
      name: form.name.trim(),
      vendorCode: form.vendorCode.trim(),
      contactPerson: form.contactPerson.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!open) return null;

  const isEditMode = currentVendor != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        {/* 弹窗标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? "编辑供应商" : "新增供应商"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 供应商编码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              供应商编码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.vendorCode}
              onChange={(e) => handleChange("vendorCode", e.target.value)}
              placeholder="请输入供应商编码"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200
                bg-white text-gray-700 hover:bg-gray-50
                disabled:opacity-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              data-testid="btn-submit-vendor"
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
              ) : isEditMode ? (
                "保存修改"
              ) : (
                "创建供应商"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
