/**
 * @module frontend/src/app/components/vendor/VendorFormDialog
 * @description Vendor form dialog component for creating and editing vendors.
 *
 * Supports both "create" and "edit" modes based on the `currentVendor` prop.
 * Uses React Hook Form + Zod for real-time field-level validation.
 * Form fields strictly align with the Vendor entity:
 *   name, vendorCode, contactPerson, contactPhone, contactEmail, address
 *
 * @since SWARM-046
 */

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import type { Vendor } from "../../services/vendorService";

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const vendorFormSchema = z.object({
  name: z.string().min(1, "供应商名称不能为空").max(100, "供应商名称不能超过100字"),
  vendorCode: z.string().max(50, "供应商编码不能超过50字").optional().or(z.literal("")),
  contactPerson: z.string().max(50, "联系人不能超过50字").optional().or(z.literal("")),
  contactPhone: z.string().max(20, "联系电话不能超过20字").optional().or(z.literal("")),
  contactEmail: z.string().max(100, "联系邮箱不能超过100字").email("邮箱格式不正确").optional().or(z.literal("")),
  address: z.string().max(200, "地址不能超过200字").optional().or(z.literal("")),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

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
// Component
// ---------------------------------------------------------------------------

/**
 * VendorFormDialog — modal dialog for creating or editing a vendor.
 *
 * When `currentVendor` is provided, the form is pre-populated for editing.
 * When `currentVendor` is null/undefined, the form starts empty for creation.
 * Uses react-hook-form + zodResolver for field-level validation.
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: "",
      vendorCode: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      address: "",
    },
  });

  /**
   * When dialog opens or currentVendor changes, populate form data.
   */
  useEffect(() => {
    if (open) {
      if (currentVendor) {
        reset({
          name: currentVendor.name ?? "",
          vendorCode: currentVendor.vendorCode ?? "",
          contactPerson: currentVendor.contactPerson ?? "",
          contactPhone: currentVendor.contactPhone ?? "",
          contactEmail: currentVendor.contactEmail ?? "",
          address: currentVendor.address ?? "",
        });
      } else {
        reset({
          name: "",
          vendorCode: "",
          contactPerson: "",
          contactPhone: "",
          contactEmail: "",
          address: "",
        });
      }
    }
  }, [open, currentVendor, reset]);

  /**
   * Handle form submission with RHF validation.
   */
  const onFormSubmit = (values: VendorFormValues) => {
    onSubmit({
      name: values.name.trim(),
      vendorCode: (values.vendorCode ?? "").trim(),
      contactPerson: (values.contactPerson ?? "").trim(),
      contactPhone: (values.contactPhone ?? "").trim(),
      contactEmail: (values.contactEmail ?? "").trim(),
      address: (values.address ?? "").trim(),
    });
  };

  const inputClass = (fieldError?: string) =>
    `w-full px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 transition-colors ${
      fieldError
        ? "border-red-300 focus:ring-red-500"
        : "border-gray-200 focus:ring-blue-500 focus:border-blue-500"
    }`;

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
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* 供应商名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              供应商名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="请输入供应商名称"
              className={inputClass(errors.name?.message)}
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* 供应商编码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              供应商编码
            </label>
            <input
              type="text"
              placeholder="请输入供应商编码"
              className={inputClass(errors.vendorCode?.message)}
              {...register("vendorCode")}
            />
            {errors.vendorCode && (
              <p className="mt-1 text-xs text-red-500">{errors.vendorCode.message}</p>
            )}
          </div>

          {/* 联系人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系人
            </label>
            <input
              type="text"
              placeholder="请输入联系人"
              className={inputClass(errors.contactPerson?.message)}
              {...register("contactPerson")}
            />
            {errors.contactPerson && (
              <p className="mt-1 text-xs text-red-500">{errors.contactPerson.message}</p>
            )}
          </div>

          {/* 联系电话 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系电话
            </label>
            <input
              type="text"
              placeholder="请输入联系电话"
              className={inputClass(errors.contactPhone?.message)}
              {...register("contactPhone")}
            />
            {errors.contactPhone && (
              <p className="mt-1 text-xs text-red-500">{errors.contactPhone.message}</p>
            )}
          </div>

          {/* 联系邮箱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系邮箱
            </label>
            <input
              type="email"
              placeholder="请输入联系邮箱"
              className={inputClass(errors.contactEmail?.message)}
              {...register("contactEmail")}
            />
            {errors.contactEmail && (
              <p className="mt-1 text-xs text-red-500">{errors.contactEmail.message}</p>
            )}
          </div>

          {/* 地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地址
            </label>
            <input
              type="text"
              placeholder="请输入地址"
              className={inputClass(errors.address?.message)}
              {...register("address")}
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
            )}
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
