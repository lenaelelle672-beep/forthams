/**
 * AssetEditPage — 编辑资产页面（真实 API 集成）
 *
 * SWARM-049: 提供资产编辑表单，通过 useAssetDetail 和 useAssetMutation hooks
 * 与真实后端 API 对接完成资产详情加载和更新。
 *
 * @module pages/assets/AssetEditPage
 * @since SWARM-049
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAssetDetail, useAssetMutation } from '../../hooks/useAssets';

/* ------------------------------------------------------------------ */
/*  表单字段定义                                                       */
/* ------------------------------------------------------------------ */

/**
 * 资产编辑表单数据结构
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
 * AssetEditPage — 编辑资产页面
 *
 * 加载现有资产数据并填充表单，支持字段验证、提交保存和取消操作。
 * 通过 useAssetDetail hook 加载数据，useAssetMutation hook 提交更新。
 *
 * @returns React 组件
 */
export default function AssetEditPage() {
  const navigate = useNavigate();
  const { id: assetId } = useParams<{ id: string }>();

  // -- Detail hook (auto-fetch by assetId) ---------------------------------
  const { asset, loading: detailLoading, error: detailError, refresh } = useAssetDetail(assetId);

  // -- Mutation hook -------------------------------------------------------
  const { update, loading: saving, error: mutationError, reset } = useAssetMutation();

  // -- Form state ----------------------------------------------------------
  const [form, setForm] = useState<AssetFormData>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [initialized, setInitialized] = useState(false);

  /**
   * 同步后端数据到本地表单
   */
  useEffect(() => {
    if (asset && !initialized) {
      setForm({
        assetName: (asset.assetName as string) ?? '',
        assetCode: (asset.assetCode as string) ?? '',
        categoryId: (asset.categoryId as string) ?? '',
        departmentId: (asset.departmentId as string) ?? '',
        locationName: (asset.locationName as string) ?? '',
        status: (asset.status as string) ?? 'IN_USE',
        purchaseDate: (asset.purchaseDate as string) ?? '',
        purchasePrice: asset.purchasePrice != null ? String(asset.purchasePrice) : '',
        remark: (asset.remark as string) ?? '',
      });
      setInitialized(true);
    }
  }, [asset, initialized]);

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
    setErrors((prev) => {
      if (prev[field as keyof FormErrors]) {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      }
      return prev;
    });
    reset();
  }, [reset]);

  /**
   * 处理表单提交
   *
   * @param e - 表单事件
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !assetId) return;

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

    const result = await update(assetId, payload);
    if (result) {
      toast.success('资产更新成功');
      navigate(`/assets/${result.id}`);
    }
  }, [form, validate, update, assetId, navigate]);

  /**
   * 处理取消
   */
  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ---- Loading state -----------------------------------------------------
  if (detailLoading && !initialized) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-edit-loading">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-400">加载资产信息...</span>
        </div>
      </div>
    );
  }

  // ---- Error state -------------------------------------------------------
  if (detailError && !asset) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-edit-error">
        <div className="flex flex-col items-center py-16">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-gray-500 mb-4">{detailError}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              返回
            </button>
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render form -------------------------------------------------------
  const displayError = mutationError || detailError;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-edit-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          data-testid="btn-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">编辑资产</h1>
        {asset && (
          <span className="text-sm text-gray-400">
            #{asset.assetCode ?? assetId}
          </span>
        )}
      </div>

      {/* Error */}
      {displayError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {displayError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6" data-testid="asset-edit-form">
        {/* 基本信息 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>

          {/* 资产名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-assetName">
              资产名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-assetName"
              type="text"
              value={form.assetName}
              onChange={(e) => handleChange('assetName', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.assetName ? 'border-red-300' : 'border-gray-200'
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-assetCode">
              资产编号 <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-assetCode"
              type="text"
              value={form.assetCode}
              onChange={(e) => handleChange('assetCode', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.assetCode ? 'border-red-300' : 'border-gray-200'
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-categoryId">
              资产分类 <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-categoryId"
              type="text"
              value={form.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.categoryId ? 'border-red-300' : 'border-gray-200'
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-departmentId">
              所属部门 <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-departmentId"
              type="text"
              value={form.departmentId}
              onChange={(e) => handleChange('departmentId', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.departmentId ? 'border-red-300' : 'border-gray-200'
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-locationName">
              存放位置
            </label>
            <input
              id="edit-locationName"
              type="text"
              value={form.locationName}
              onChange={(e) => handleChange('locationName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入存放位置"
              data-testid="input-locationName"
            />
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-status">
              资产状态
            </label>
            <select
              id="edit-status"
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-status"
            >
              <option value="IN_USE">在用</option>
              <option value="IDLE">闲置</option>
              <option value="MAINTENANCE">维保中</option>
              <option value="SCRAPPED">已报废</option>
              <option value="RETIRED">已退役</option>
            </select>
          </div>
        </div>

        {/* 财务信息 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">财务信息</h2>

          {/* 购置日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-purchaseDate">
              购置日期 <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-purchaseDate"
              type="date"
              value={form.purchaseDate}
              onChange={(e) => handleChange('purchaseDate', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.purchaseDate ? 'border-red-300' : 'border-gray-200'
              }`}
              data-testid="input-purchaseDate"
            />
            {errors.purchaseDate && (
              <p className="mt-1 text-xs text-red-500" data-testid="error-purchaseDate">{errors.purchaseDate}</p>
            )}
          </div>

          {/* 购置价格 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-purchasePrice">
              购置价格
            </label>
            <input
              id="edit-purchasePrice"
              type="number"
              step="0.01"
              min="0"
              value={form.purchasePrice}
              onChange={(e) => handleChange('purchasePrice', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.purchasePrice ? 'border-red-300' : 'border-gray-200'
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
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-remark">
              备注
            </label>
            <textarea
              id="edit-remark"
              value={form.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700
              hover:bg-gray-50 transition-colors"
            data-testid="btn-cancel"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="btn-submit"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
