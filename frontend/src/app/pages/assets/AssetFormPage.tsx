/**
 * AssetFormPage — Unified asset create/edit form page with real API integration.
 *
 * SWARM-066: Combines asset creation and editing into a single page component.
 * Determines mode (create vs edit) based on the presence of an `id` route param.
 * Uses useAssetDetail for loading existing data and useAssetMutation for
 * creating/updating assets via the real backend API.
 *
 * @module pages/assets/AssetFormPage
 * @since SWARM-066
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
/*  Form types                                                         */
/* ------------------------------------------------------------------ */

/**
 * Asset form data structure shared between create and edit modes.
 *
 * @interface AssetFormData
 */
interface AssetFormData {
  /** Asset display name */
  assetName: string;
  /** Asset code / tag number */
  assetCode: string;
  /** Category ID */
  categoryId: string;
  /** Department ID */
  departmentId: string;
  /** Location name */
  locationName: string;
  /** Asset status */
  status: string;
  /** Purchase date (ISO date string) */
  purchaseDate: string;
  /** Purchase price */
  purchasePrice: string;
  /** Remarks / notes */
  remark: string;
}

/**
 * Form validation errors keyed by field name.
 *
 * @interface FormErrors
 */
interface FormErrors {
  assetName?: string;
  assetCode?: string;
  categoryId?: string;
  departmentId?: string;
  purchaseDate?: string;
  purchasePrice?: string;
}

/** Initial empty form values */
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * AssetFormPage — Unified asset create and edit form.
 *
 * When routed to `/assets/new`, renders a blank creation form.
 * When routed to `/assets/:id/edit`, loads the asset and pre-fills the form.
 * Validates required fields before submission and calls the appropriate
 * mutation hook method (create or update).
 *
 * @returns The asset form page JSX
 */
export default function AssetFormPage() {
  const navigate = useNavigate();
  const { id: assetId } = useParams<{ id: string }>();

  /** Whether we are in edit mode (assetId present in URL) */
  const isEditMode = Boolean(assetId && assetId !== 'new');

  // -- Detail hook (edit mode only) --------------------------------------
  const { asset, loading: detailLoading, error: detailError, refresh } = useAssetDetail(
    isEditMode ? assetId : null,
  );

  // -- Mutation hook -----------------------------------------------------
  const { create, update, loading: saving, error: mutationError, reset } = useAssetMutation();

  // -- Form state --------------------------------------------------------
  const [form, setForm] = useState<AssetFormData>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [initialized, setInitialized] = useState(false);

  /**
   * Synchronize backend data to local form on first load (edit mode).
   */
  useEffect(() => {
    if (asset && !initialized) {
      setForm({
        assetName: asset.assetName ?? '',
        assetCode: asset.assetCode ?? '',
        categoryId: (asset.categoryId as string) ?? '',
        departmentId: (asset.departmentId as string) ?? '',
        locationName: asset.locationName ?? '',
        status: asset.status ?? 'IN_USE',
        purchaseDate: asset.purchaseDate ?? '',
        purchasePrice: asset.purchasePrice != null ? String(asset.purchasePrice) : '',
        remark: (asset.remark as string) ?? '',
      });
      setInitialized(true);
    }
  }, [asset, initialized]);

  /**
   * Validate form fields and return whether the form is valid.
   *
   * @returns True if all required fields are valid
   */
  const validateForm = useCallback((): boolean => {
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
      newErrors.purchasePrice = '采购价格必须为数字';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  /**
   * Handle form field value changes.
   *
   * @param field - Form field name
   * @param value - New field value
   */
  const handleChange = useCallback((field: keyof AssetFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  /**
   * Handle form submission (create or update).
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      reset();

      if (!validateForm()) return;

      const payload: Record<string, unknown> = {
        assetName: form.assetName.trim(),
        assetCode: form.assetCode.trim(),
        categoryId: form.categoryId,
        departmentId: form.departmentId,
        locationName: form.locationName.trim(),
        status: form.status,
        purchaseDate: form.purchaseDate,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        remark: form.remark.trim(),
      };

      if (isEditMode && assetId) {
        const result = await update(assetId, payload);
        if (result) {
          toast.success('资产更新成功');
          navigate(`/assets/${assetId}`);
        }
      } else {
        const result = await create(payload);
        if (result) {
          toast.success('资产创建成功');
          navigate('/assets');
        }
      }
    },
    [form, isEditMode, assetId, validateForm, create, update, reset, navigate],
  );

  // ---- Loading skeleton (edit mode) ------------------------------------
  if (isEditMode && detailLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-form-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  // ---- Error state (edit mode) -----------------------------------------
  if (isEditMode && (detailError || (!asset && !detailLoading))) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-form-error">
        <div className="text-center py-12">
          <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">{detailError ?? '未找到资产信息'}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300
                bg-white hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              返回
            </button>
            <button
              type="button"
              onClick={refresh}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300
                bg-white hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main render -----------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto px-4 py-8" data-testid="asset-form-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          data-testid="btn-back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? '编辑资产' : '新建资产'}
        </h1>
      </div>

      {/* Mutation error */}
      {mutationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
          data-testid="mutation-error"
        >
          {mutationError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {/* Row: Asset Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              资产名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.assetName}
              onChange={(e) => handleChange('assetName', e.target.value)}
              className={`w-full px-3 py-2 text-sm rounded-lg border
                ${errors.assetName ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                focus:outline-none focus:ring-2 transition-colors`}
              placeholder="请输入资产名称"
              data-testid="input-asset-name"
            />
            {errors.assetName && (
              <p className="mt-1 text-xs text-red-600">{errors.assetName}</p>
            )}
          </div>

          {/* Row: Asset Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              资产编号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.assetCode}
              onChange={(e) => handleChange('assetCode', e.target.value)}
              className={`w-full px-3 py-2 text-sm rounded-lg border
                ${errors.assetCode ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                focus:outline-none focus:ring-2 transition-colors`}
              placeholder="请输入资产编号"
              data-testid="input-asset-code"
            />
            {errors.assetCode && (
              <p className="mt-1 text-xs text-red-600">{errors.assetCode}</p>
            )}
          </div>

          {/* Row: Category + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                资产分类 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg border
                  ${errors.categoryId ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2 transition-colors`}
                placeholder="请输入分类 ID"
                data-testid="input-category-id"
              />
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                所属部门 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.departmentId}
                onChange={(e) => handleChange('departmentId', e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg border
                  ${errors.departmentId ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2 transition-colors`}
                placeholder="请输入部门 ID"
                data-testid="input-department-id"
              />
              {errors.departmentId && (
                <p className="mt-1 text-xs text-red-600">{errors.departmentId}</p>
              )}
            </div>
          </div>

          {/* Row: Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              存放位置
            </label>
            <input
              type="text"
              value={form.locationName}
              onChange={(e) => handleChange('locationName', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              placeholder="请输入存放位置"
              data-testid="input-location-name"
            />
          </div>

          {/* Row: Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              资产状态
            </label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              data-testid="select-status"
            >
              <option value="IN_USE">在用</option>
              <option value="IDLE">闲置</option>
              <option value="MAINTENANCE">维保中</option>
              <option value="SCRAPPED">已报废</option>
              <option value="RETIRED">已退役</option>
            </select>
          </div>

          {/* Row: Purchase Date + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                购置日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => handleChange('purchaseDate', e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg border
                  ${errors.purchaseDate ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2 transition-colors`}
                data-testid="input-purchase-date"
              />
              {errors.purchaseDate && (
                <p className="mt-1 text-xs text-red-600">{errors.purchaseDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                采购价格
              </label>
              <input
                type="text"
                value={form.purchasePrice}
                onChange={(e) => handleChange('purchasePrice', e.target.value)}
                className={`w-full px-3 py-2 text-sm rounded-lg border
                  ${errors.purchasePrice ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2 transition-colors`}
                placeholder="请输入采购价格"
                data-testid="input-purchase-price"
              />
              {errors.purchasePrice && (
                <p className="mt-1 text-xs text-red-600">{errors.purchasePrice}</p>
              )}
            </div>
          </div>

          {/* Row: Remark */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              value={form.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-y"
              placeholder="请输入备注信息"
              data-testid="input-remark"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="btn-submit"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? '保存中...' : isEditMode ? '更新资产' : '创建资产'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 text-sm rounded-lg border border-gray-300
              bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            data-testid="btn-cancel"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
