/**
 * @file pages/asset/AssetFormPage.tsx
 * @description 资产新建/编辑表单页
 * 使用 React Hook Form + Zod 校验
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useAssetDetail, useCreateAsset, useUpdateAsset, useCategoryTree } from '@/hooks/asset/useAssets';
import { getDeptList } from '@/api/base';
import { AssetStatus } from '@/types/asset';
import type { CreateAssetRequest, Asset, AssetCategory } from '@/types/asset';
import type { Department } from '@/types/common';
import type { ApiResponse } from '@/types/common';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectItem } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';

// ── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  assetName:       z.string().min(1, '资产名称不能为空').max(100),
  assetNo:         z.string().optional(),
  categoryId:      z.coerce.number().positive('请选择资产分类'),
  brand:           z.string().optional(),
  model:           z.string().optional(),
  serialNo:        z.string().optional(),
  supplier:        z.string().optional(),
  originalValue:   z.coerce.number().nonnegative('原值不能为负数').optional(),
  currentValue:    z.coerce.number().nonnegative('当前净值不能为负数').optional(),
  purchaseDate:    z.string().optional(),
  warrantyPeriod:  z.coerce.number().int().nonnegative().optional(),
  depreciationRate: z.coerce.number().min(0).max(1).optional(),
  status:          z.nativeEnum(AssetStatus).default(AssetStatus.IN_USE),
  deptId:          z.coerce.number().positive('请选择使用部门').optional(),
  location:        z.string().optional(),
  rfidTag:         z.string().optional(),
  isImportant:     z.coerce.number().int().min(0).max(1).default(0),
  description:     z.string().max(500).optional(),
  remark:          z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

export default function AssetFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id && id !== 'new';
  const assetId = isEdit ? Number(id) : null;

  const { data: assetRes, isLoading: assetLoading } = useAssetDetail(assetId);
  const { data: catRes } = useCategoryTree();
  const { data: deptRes } = useQuery({
    queryKey: ['departments'],
    queryFn: () => getDeptList(),
  });
  const departments: Department[] = (deptRes as ApiResponse<Department[]> | undefined)?.data ?? [];
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();

  const asset = (assetRes as ApiResponse<Asset> | undefined)?.data;
  const categories = (catRes as ApiResponse<AssetCategory[]> | undefined)?.data ?? [];

  const {
    register, handleSubmit, control, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: AssetStatus.IN_USE, isImportant: 0 },
  });

  const isLoadingDetail = isEdit && !asset && assetLoading;

  // 编辑模式：回填已有值
  useEffect(() => {
    if (asset) {
      reset({
        assetName:       asset.assetName,
        assetNo:         asset.assetNo ?? '',
        categoryId:      asset.categoryId,
        brand:           asset.brand ?? '',
        model:           asset.model ?? '',
        serialNo:        asset.serialNo ?? '',
        supplier:        asset.supplier ?? '',
        originalValue:   asset.originalValue,
        currentValue:    asset.currentValue,
        purchaseDate:    asset.purchaseDate?.substring(0, 10),
        warrantyPeriod:  asset.warrantyPeriod,
        depreciationRate: asset.depreciationRate,
        status:          asset.status,
        deptId:          asset.deptId,
        location:        asset.location ?? '',
        rfidTag:         asset.rfidTag ?? '',
        isImportant:     asset.isImportant ?? 0,
        description:     asset.description ?? '',
        remark:          asset.remark ?? '',
      });
    }
  }, [asset, reset]);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const payload: CreateAssetRequest = {
      assetName: values.assetName,
      assetNo: values.assetNo,
      categoryId: values.categoryId,
      brand: values.brand,
      model: values.model,
      serialNo: values.serialNo,
      supplier: values.supplier,
      originalValue: values.originalValue,
      currentValue: values.currentValue,
      purchaseDate: values.purchaseDate,
      warrantyPeriod: values.warrantyPeriod,
      depreciationRate: values.depreciationRate,
      status: values.status,
      deptId: values.deptId,
      location: values.location,
      rfidTag: values.rfidTag,
      isImportant: values.isImportant,
      description: values.description,
      remark: values.remark,
    };

    try {
      if (isEdit && assetId) {
        await updateMutation.mutateAsync({ id: assetId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate('/assets');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请重试';
      setSubmitError(msg);
    }
  };

  const flatCategories = (cats: any[]): any[] => cats.flatMap((c) => [c, ...flatCategories(c.children ?? [])]);

  if (isLoadingDetail) {
    return (
      <div className="p-6 space-y-5">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-blue-50 rounded" />
          <div className="h-64 bg-blue-50 rounded-lg" />
          <div className="h-48 bg-blue-50 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title={isEdit ? '编辑资产' : '新增资产'}
        breadcrumbs={[
          { label: '资产台账', href: '/assets' },
          { label: isEdit ? '编辑资产' : '新增资产' },
        ]}
        actions={
          <Button variant="ghost" size="md" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 基本信息 */}
        <Card>
          <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Input
              label="资产名称 *"
              placeholder="例：戴尔服务器 R740"
              error={errors.assetName?.message}
              {...register('assetName')}
            />
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  label="资产分类 *"
                  value={String(field.value ?? '')}
                  onValueChange={(v) => field.onChange(Number(v))}
                  error={errors.categoryId?.message}
                >
                  {flatCategories(categories).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {'　'.repeat((c.level ?? 1) - 1)}{c.categoryName}
                    </SelectItem>
                  ))}
                </Select>
              )}
            />
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  label="资产状态"
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  {Object.entries({
                    IN_USE: '在用', IDLE: '闲置', MAINTENANCE: '维修中',
                    PENDING_RETIREMENT: '待退役', SCRAPPED: '已报废', CLEARED: '已清退',
                  }).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </Select>
              )}
            />
            <Input label="品牌/厂商" placeholder="例：Dell" {...register('brand')} />
            <Input label="规格型号"  placeholder="例：PowerEdge R740" {...register('model')} />
            <Input label="序列号"    placeholder="例：SN-2024-001234" {...register('serialNo')} />
            <Input label="供应商"    placeholder="例：××科技公司" {...register('supplier')} />
          </CardContent>
        </Card>

        {/* 位置归属 */}
        <Card>
          <CardHeader><CardTitle>位置归属</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Controller
              name="deptId"
              control={control}
              render={({ field }) => (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">使用部门</label>
                  <select
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value == null ? '' : String(field.value)}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择部门</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.deptName}
                      </option>
                    ))}
                  </select>
                  {errors.deptId && <p className="text-xs text-red-500">{errors.deptId.message}</p>}
                </div>
              )}
            />
            <Input label="存放位置" placeholder="例：研发中心 3F 机房" {...register('location')} />
            <Input label="RFID 标签" placeholder="例：TAG-20240001" {...register('rfidTag')} />
            <Controller
              name="isImportant"
              control={control}
              render={({ field }) => (
                <Select
                  label="是否重要设备"
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectItem value="0">否（普通资产）</SelectItem>
                  <SelectItem value="1">是（重要设备）</SelectItem>
                </Select>
              )}
            />
          </CardContent>
        </Card>

        {/* 财务信息 */}
        <Card>
          <CardHeader><CardTitle>财务信息</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Input
              label="原值（元）"
              type="number"
              step="0.01"
              placeholder="例：15000.00"
              error={errors.originalValue?.message}
              {...register('originalValue')}
            />
            <Input
              label="当前净值（元）"
              type="number"
              step="0.01"
              placeholder="例：12000.00"
              error={errors.currentValue?.message}
              {...register('currentValue')}
            />
            <Input
              label="购置日期"
              type="date"
              {...register('purchaseDate')}
            />
            <Input
              label="保修期（月）"
              type="number"
              placeholder="例：24"
              {...register('warrantyPeriod')}
            />
            <Input
              label="折旧率（0~1）"
              type="number"
              step="0.001"
              placeholder="例：0.1 = 10%/年"
              {...register('depreciationRate')}
            />
          </CardContent>
        </Card>

        {/* 备注 */}
        <Card>
          <CardHeader><CardTitle>描述与备注</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">资产描述</label>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="资产用途、主要配置等..."
                className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none placeholder:text-[#94a3b8]"
                {...register('description')}
              />
              <p className="text-right text-xs text-[#94a3b8]">
                已输入 {(watch?.('description') ?? '').length} / 500 字
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">备注</label>
              <textarea
                rows={3}
                maxLength={200}
                placeholder="其他需要说明的信息..."
                className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none placeholder:text-[#94a3b8]"
                {...register('remark')}
              />
              <p className="text-right text-xs text-[#94a3b8]">
                已输入 {(watch?.('remark') ?? '').length} / 200 字
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        {submitError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {submitError}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Save className="w-4 h-4" />
            {isEdit ? '保存修改' : '创建资产'}
          </Button>
        </div>
      </form>
    </div>
  );
}
