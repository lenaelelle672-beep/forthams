/**
 * VendorFormPage — 供应商创建/编辑表单页面
 *
 * 使用 React Hook Form + Zod 实现实时字段级校验。
 * 根据 URL 路由参数判断创建模式或编辑模式：
 * - /vendors/new          → 创建模式（空表单）
 * - /vendors/:id/edit     → 编辑模式（回显数据）
 *
 * 数据通过 vendorService 调用真实后端 API，无本地伪数据逻辑。
 * 表单字段严格对齐后端 VendorCreateDTO：name, vendorCode, contactPerson,
 * contactPhone, contactEmail, address。
 *
 * @module pages/vendor/VendorFormPage
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "../../services/vendorService";
import type { Vendor } from "../../services/vendorService";

/* ------------------------------------------------------------------ */
/*  Zod Schema                                                         */
/* ------------------------------------------------------------------ */

const vendorSchema = z.object({
  name: z.string().min(1, "供应商名称不能为空").max(100, "供应商名称不能超过100字"),
  vendorCode: z.string().max(50, "供应商编码不能超过50字").optional().or(z.literal("")),
  contactPerson: z.string().max(50, "联系人不能超过50字").optional().or(z.literal("")),
  contactPhone: z.string().max(20, "联系电话不能超过20字").optional().or(z.literal("")),
  contactEmail: z.string().max(100, "联系邮箱不能超过100字").email("邮箱格式不正确").optional().or(z.literal("")),
  address: z.string().max(200, "地址不能超过200字").optional().or(z.literal("")),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

export default function VendorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      vendorCode: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      address: "",
    },
  });

  const [loading, setLoading] = useState(isEditMode);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据回填（编辑模式）                                               */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadVendor() {
      setLoading(true);
      setFetchError(null);
      try {
        const vendor = await vendorService.getVendorById(id);
        if (!cancelled) {
          reset({
            name: vendor.name ?? "",
            vendorCode: vendor.vendorCode ?? "",
            contactPerson: vendor.contactPerson ?? "",
            contactPhone: vendor.contactPhone ?? "",
            contactEmail: vendor.contactEmail ?? "",
            address: vendor.address ?? "",
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "获取供应商信息失败";
          setFetchError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVendor();
    return () => { cancelled = true; };
  }, [id, reset]);

  /* ------------------------------------------------------------------ */
  /*  表单提交                                                           */
  /* ------------------------------------------------------------------ */

  const onSubmit = useCallback(
    async (values: VendorFormValues) => {
      try {
        const payload: Omit<Vendor, "id"> = {
          name: values.name.trim(),
          vendorCode: values.vendorCode?.trim() ?? "",
          contactPerson: values.contactPerson?.trim() ?? "",
          contactPhone: values.contactPhone?.trim() ?? "",
          contactEmail: values.contactEmail?.trim() ?? "",
          address: values.address?.trim() ?? "",
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
        const message = err instanceof Error ? err.message : "操作失败，请稍后重试";
        toast.error(message);
      }
    },
    [isEditMode, id, navigate],
  );

  const handleGoBack = useCallback(() => {
    navigate("/vendors");
  }, [navigate]);

  /* ------------------------------------------------------------------ */
  /*  字段样式辅助                                                       */
  /* ------------------------------------------------------------------ */

  const inputClass = (fieldError?: string) =>
    `w-full px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 transition-colors ${
      fieldError
        ? "border-red-300 focus:ring-red-500"
        : "border-gray-200 focus:ring-blue-500 focus:border-blue-500"
    }`;

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-400 text-sm">加载供应商信息...</p>
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
          className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
          title="返回列表"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? "编辑供应商" : "新增供应商"}
        </h1>
      </div>

      {/* 获取数据错误提示 */}
      {fetchError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {fetchError}
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleGoBack}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200
              bg-white text-gray-700 hover:bg-gray-50
              disabled:opacity-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isSubmitting ? (
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
