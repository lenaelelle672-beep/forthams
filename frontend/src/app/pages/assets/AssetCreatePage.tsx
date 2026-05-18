/**
 * AssetCreatePage — 新建资产页面（真实 API 集成）
 *
 * SWARM-049: 提供资产新建表单，通过 useAssetMutation hook
 * 与真实后端 API 对接完成资产创建。
 *
 * @module pages/assets/AssetCreatePage
 * @since SWARM-049
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAssetMutation } from '../../hooks/useAssets';

/* ------------------------------------------------------------------ */
/*  表单字段定义                                                       */
/* ------------------------------------------------------------------ */

/**
 * 资产创建表单数据结构
 */
interface AssetFormData {
  assetName: string;
  assetCode: string;
  categoryId: string;
  departmentId: string;
  locationName: string;
  status: string;
  purchaseDate: string;
  purchasePrice: string;
  remark: string;
}

/**
 * 表单验证错误
 */
interface FormErrors {
  assetName?: string;
  assetCode?: string;
  categoryId?: string;
  departmentId?: string;
  purchaseDate?: string;
  purchasePrice?: string;
}

/** 初始表单值 */
const INITIAL_FORM: AssetFormData = {
  assetName: '',
  assetCode: '',
  categoryId: '',
  departmentId: '',
  locationName: '',
  status: 'IN_USE',
  purchaseDate: '',
  purchasePrice: '',
  remark: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetCreatePage — 新建资产页面
 *
 * 提供完整的资产新建表单，包含字段验证、提交和取消操作。
 * 通过 useAssetMutation hook 与后端 API 进行真实对接。
 *
 * @returns React 组件
 */
export default function AssetCreatePage() {
  const navigate = useNavigate();

  // -- Mutation hook -------------------------------------------------------
  const { create, loading, error: mutationError } = useAssetMutation();

  // -- Form state ----------------------------------------------------------
  const [form, setForm] = useState<AssetFormData>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});

  /**
   * 验证表单字段
   *
   * @returns 表单是否通过验证
   */
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.assetName.trim()) {
      newErrors.assetName = '资产名称不能为空';
    }
    if (!form.assetCode.trim()) {
      newErrors.assetCode = '资产编号不能为空';
    }
    if (!form.categoryId) {
      newErrors.categoryId = '请选择资产分类';
    }
    if (!form.departmentId) {
      newErrors.departmentId = '请选择所属部门';
    }
    if (!form.purchaseDate) {
      newErrors.purchaseDate = '请选择购置日期';
    }
    if (form.purchasePrice && isNaN(Number(form.purchasePrice))) {
      newErrors.purchasePrice = '购置价格必须为数字';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  /**
   * 处理表单字段变更
   *
   * @param field - 字段名
   * @param value - 字段值
   */
  const handleChange = useCallback((field: keyof AssetFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    setErrors((prev) => {
      if (prev[field as keyof FormErrors]) {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      }
      return prev;
    });
  }, []);

  /**
   * 处理表单提交
   *
   * @param e - 表单事件
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const payload: Record<string, unknown> = {
      assetName: form.assetName.trim(),
      assetCode: form.assetCode.trim(),
      categoryId: form.categoryId,
      departmentId: form.departmentId,
      locationName: form.locationName.trim(),
      status: form.status,
      purchaseDate: form.purchaseDate,
      remark: form.remark.trim(),
    };

    if (form.purchasePrice) {
      payload.purchasePrice = Number(form.purchasePrice);
    }

    const result = await create(payload);
    if (result) {
      toast.success('资产创建成功');
      navigate(`/assets/${result.id}`);
    }
  }, [form, validate, create, navigate]);

  /**
   * 处理取消
   */
  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ---- Render ------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-create-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={handleCancel}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          data-testid="btn-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">新建资产</h1>
      </div>

      {/* Mutation error */}
      {mutationError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {mutationError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6" data-testid="asset-create-form">
        {/* 基本信息 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>

          {/* 资产名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="assetName">
              资产名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="assetName"
              type="text"
              value={form.assetName}
              onChange={(e) => handleChange('assetName', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.assetName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="请输入资产名称"
              data-testid="input-assetName"
            />
            {errors.assetName && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-assetName">{errors.assetName}</p>
            )}
          </div>

          {/* 资产编号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="assetCode">
              资产编号 <span className="text-red-500">*</span>
            </label>
            <input
              id="assetCode"
              type="text"
              value={form.assetCode}
              onChange={(e) => handleChange('assetCode', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.assetCode ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="请输入资产编号"
              data-testid="input-assetCode"
            />
            {errors.assetCode && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-assetCode">{errors.assetCode}</p>
            )}
          </div>

          {/* 分类 ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="categoryId">
              资产分类 <span className="text-red-500">*</span>
            </label>
            <input
              id="categoryId"
              type="text"
              value={form.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.categoryId ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="请输入分类 ID"
              data-testid="input-categoryId"
            />
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-categoryId">{errors.categoryId}</p>
            )}
          </div>

          {/* 部门 ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="departmentId">
              所属部门 <span className="text-red-500">*</span>
            </label>
            <input
              id="departmentId"
              type="text"
              value={form.departmentId}
              onChange={(e) => handleChange('departmentId', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.departmentId ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="请输入部门 ID"
              data-testid="input-departmentId"
            />
            {errors.departmentId && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-departmentId">{errors.departmentId}</p>
            )}
          </div>

          {/* 位置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="locationName">
              存放位置
            </label>
            <input
              id="locationName"
              type="text"
              value={form.locationName}
              onChange={(e) => handleChange('locationName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入存放位置"
              data-testid="input-locationName"
            />
          </div>
        </div>

        {/* 财务信息 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">财务信息</h2>

          {/* 购置日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="purchaseDate">
              购置日期 <span className="text-red-500">*</span>
            </label>
            <input
              id="purchaseDate"
              type="date"
              value={form.purchaseDate}
              onChange={(e) => handleChange('purchaseDate', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.purchaseDate ? 'border-red-300' : 'border-gray-300'
              }`}
              data-testid="input-purchaseDate"
            />
            {errors.purchaseDate && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-purchaseDate">{errors.purchaseDate}</p>
            )}
          </div>

          {/* 购置价格 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="purchasePrice">
              购置价格
            </label>
            <input
              id="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              value={form.purchasePrice}
              onChange={(e) => handleChange('purchasePrice', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.purchasePrice ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="请输入购置价格"
              data-testid="input-purchasePrice"
            />
            {errors.purchasePrice && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-purchasePrice">{errors.purchasePrice}</p>
            )}
          </div>
        </div>

        {/* 备注 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">其他信息</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="remark">
              备注
            </label>
            <textarea
              id="remark"
              value={form.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入备注信息"
              data-testid="input-remark"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700
              hover:bg-gray-50 transition-colors"
            data-testid="btn-cancel"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="btn-submit"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                提交
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
