import { useState, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { getAssetList } from '@/api/asset';
import {
  MAX_COMPENSATION_DESCRIPTION_LENGTH,
  getCompensationAmountError,
  submitCompensationApplications,
  type BatchApplicationResult,
  type Compensation,
} from '@/api/disposal';
import { getDeptList } from '@/api/base';
import { toast } from 'sonner';

const schema = z.object({
  applyDate: z.string().min(1, '请选择申请日期'),
  damageType: z.string().min(1, '请选择损坏类型'),
  damageDesc: z.string().trim().min(1, '请填写赔偿事由').max(MAX_COMPENSATION_DESCRIPTION_LENGTH),
  damageDate: z.string().min(1, '请选择损坏日期'),
  responsiblePerson: z.coerce.number().int().positive('请输入有效责任人 ID'),
  responsibleDept: z.string().min(1, '请选择责任部门'),
  discoverer: z.string().trim().max(50).optional(),
  insured: z.enum(['yes', 'no']),
  compensationType: z.enum(['cash', 'equivalent', 'repair']),
  approvalProcess: z.string().min(1, '请选择审批流程'),
  remark: z.string().trim().max(MAX_COMPENSATION_DESCRIPTION_LENGTH).optional(),
});

type FormValues = z.infer<typeof schema>;

interface AssetRow {
  id: string;
  assetNo: string;
  assetName: string;
  category: string;
  originalValue: number;
  damageLevel: string;
  compensationAmount: number;
}

interface AssetValidationResult {
  selectionError?: string;
  errors: Record<string, string>;
}

const DAMAGE_LEVEL_OPTIONS = [
  { value: 'minor', label: '轻微' },
  { value: 'medium', label: '中度' },
  { value: 'severe', label: '严重' },
  { value: 'total', label: '全损' },
];

const DAMAGE_TYPE_OPTIONS = [
  { value: 'human', label: '人为损坏' },
  { value: 'neglect', label: '管理疏忽' },
  { value: 'damage', label: '损坏' },
  { value: 'lost', label: '丢失' },
  { value: 'stolen', label: '被盗' },
];

const APPROVAL_OPTIONS = [
  { value: 'standard_v1', label: '标准赔偿流程 v1.0' },
  { value: 'simple_v2', label: '简易赔偿流程 v2.1' },
  { value: 'major', label: '特大资产损坏审批流程' },
];

function formatCurrency(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 安全映射 API 资产记录到表格使用的 AssetRow。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toAssetRow(value: unknown): AssetRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readNumber(value.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return {
    id: String(id),
    assetNo: readString(value.assetNo),
    assetName: readString(value.assetName),
    category: readString(value.categoryName),
    originalValue: readNumber(value.originalValue),
    damageLevel: 'medium',
    compensationAmount: 0,
  };
}

function getAssetRows(response: unknown): AssetRow[] {
  if (!isRecord(response) || !Array.isArray(response.records)) {
    return [];
  }
  return response.records.flatMap((asset) => {
    const row = toAssetRow(asset);
    return row ? [row] : [];
  });
}

function getDepartmentOptions(response: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(response)) {
    return [];
  }
  return response.flatMap((department) => {
    if (!isRecord(department)) {
      return [];
    }
    const id = readNumber(department.id);
    const label = readString(department.deptName);
    return Number.isSafeInteger(id) && id > 0 && label ? [{ value: String(id), label }] : [];
  });
}

export function buildCompensationDescription(
  values: Pick<FormValues, 'damageType' | 'damageDesc' | 'discoverer' | 'insured' | 'remark'>,
): string {
  return [
    `损坏类型：${values.damageType}`,
    `赔偿事由：${values.damageDesc.trim()}`,
    values.discoverer?.trim() ? `发现人：${values.discoverer.trim()}` : null,
    `是否报险：${values.insured === 'yes' ? '是' : '否'}`,
    values.remark?.trim() ? `备注：${values.remark.trim()}` : null,
  ].filter((part): part is string => part !== null).join('；');
}

function validateSelectedAssets(assets: AssetRow[]): AssetValidationResult {
  if (assets.length === 0) {
    return { selectionError: '请至少选择一项资产', errors: {} };
  }

  const errors: Record<string, string> = {};
  assets.forEach((asset) => {
    const assetId = Number(asset.id);
    if (!Number.isSafeInteger(assetId) || assetId <= 0) {
      errors[asset.id] = '资产无效，请重新选择';
    } else {
      const amountError = getCompensationAmountError(asset.compensationAmount);
      if (amountError) {
        errors[asset.id] = `该资产的${amountError}`;
      }
    }
  });
  return { errors };
}

export function mergeCompensationSubmissionResult(
  previous: BatchApplicationResult<Compensation> | null,
  current: BatchApplicationResult<Compensation>,
): BatchApplicationResult<Compensation> {
  const successes = new Map(previous?.successes.map((result) => [result.assetId, result]) ?? []);
  const failures = new Map(previous?.failures.map((result) => [result.assetId, result]) ?? []);

  current.successes.forEach((result) => {
    successes.set(result.assetId, result);
    failures.delete(result.assetId);
  });
  current.failures.forEach((result) => {
    if (!successes.has(result.assetId)) {
      failures.set(result.assetId, result);
    }
  });
  return { successes: Array.from(successes.values()), failures: Array.from(failures.values()) };
}

function formatFailureReason(reason: unknown): string {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }
  return typeof reason === 'string' && reason ? reason : '提交失败，请检查后重试';
}

/**
 * 资产赔偿申请表单页面
 *
 * 提供资产赔偿申请的完整录入流程，包括：
 * - 基本信息填写（申请日期、损坏类型）
 * - 损坏详情录入（描述、责任人、责任部门、发现人、是否报险）
 * - 资产选择与赔偿金额配置
 * - 赔偿方式与审批流程选择
 * - 提交至后端审批流
 */
export default function AssetCompensationFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assetData, setAssetData] = useState<AssetRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});
  const [assetSelectionError, setAssetSelectionError] = useState<string>();
  const [submissionResult, setSubmissionResult] = useState<BatchApplicationResult<Compensation> | null>(null);

  // Fetch assets from real API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  // Fetch department list from API
  const { data: deptRes } = useQuery({
    queryKey: ['depts', 'list'],
    queryFn: () => getDeptList(),
    staleTime: 5 * 60 * 1000,
  });
  const deptOptions = getDepartmentOptions(deptRes);

  // Derive the full asset list from API response
  const apiAssets = useMemo(() => getAssetRows(assetListData), [assetListData]);

  // Keep assetData in sync with the API list; preserve user edits
  const syncedAssetData = useMemo(() => {
    if (apiAssets.length === 0) return assetData;
    // Merge: keep user-edited rows, add new API rows
    const existingMap = new Map(assetData.map((a) => [a.id, a]));
    return apiAssets.map((api) => existingMap.get(api.id) ?? api);
  }, [apiAssets, assetData]);

  // Use the synced data for display
  const displayAssets = syncedAssetData;

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      applyDate: new Date().toISOString().split('T')[0],
      damageType: 'human',
      insured: 'no',
      compensationType: 'cash',
      responsibleDept: '',
      approvalProcess: 'standard_v1',
    },
  });

  const filteredAssets = useMemo(() => {
    if (!searchTerm) return displayAssets;
    const lower = searchTerm.toLowerCase();
    return displayAssets.filter(
      (a) => a.assetNo.toLowerCase().includes(lower) || a.assetName.toLowerCase().includes(lower),
    );
  }, [displayAssets, searchTerm]);

  const totalCompensation = useMemo(() => {
    return displayAssets
      .filter((a) => selectedIds.has(a.id))
      .reduce((sum, a) => sum + a.compensationAmount, 0);
  }, [displayAssets, selectedIds]);

  const toggleAsset = (id: string) => {
    setAssetSelectionError(undefined);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
      setAssetSelectionError(undefined);
    }
  };

  const updateAsset = (id: string, field: keyof AssetRow, value: string | number) => {
    if (field === 'compensationAmount' && typeof value === 'number') {
      const amountError = getCompensationAmountError(value);
      setAssetErrors((current) => {
        const { [id]: _, ...rest } = current;
        return amountError ? { ...rest, [id]: `该资产的${amountError}` } : rest;
      });
    }
    setAssetData((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      const existing = map.get(id);
      if (existing) {
        map.set(id, { ...existing, [field]: value });
      } else {
        // Find from apiAssets and apply edit
        const apiRow = apiAssets.find((a) => a.id === id);
        if (apiRow) {
          map.set(id, { ...apiRow, [field]: value });
        }
      }
      return Array.from(map.values());
    });
  };

  // Add selected assets from search results to the working set
  const addSelectedAssets = useCallback(() => {
    const filtered = filteredAssets;
    setAssetSelectionError(undefined);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((a) => next.add(a.id));
      return next;
    });
    // Ensure these assets are in assetData
    setAssetData((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      filtered.forEach((a) => {
        if (!map.has(a.id)) {
          map.set(a.id, a);
        }
      });
      return Array.from(map.values());
    });
  }, [filteredAssets]);

  const mutation = useMutation({
    mutationFn: (data: FormValues & { assets: AssetRow[]; description: string }) => {
      return submitCompensationApplications({
        assets: data.assets.map((asset) => ({
          assetId: Number(asset.id),
          compensationAmount: asset.compensationAmount,
        })),
        compensationType: data.compensationType,
        description: data.description,
        incidentDate: data.damageDate,
        responsibleUserId: data.responsiblePerson,
        responsibleDeptId: Number(data.responsibleDept),
      });
    },
    onSuccess: (result) => {
      setSubmissionResult((previous) => mergeCompensationSubmissionResult(previous, result));
      if (result.successes.length > 0) {
        const successfulIds = new Set(result.successes.map(({ assetId }) => String(assetId)));
        setSelectedIds((current) => new Set(
          Array.from(current).filter((assetId) => !successfulIds.has(assetId)),
        ));
        qc.invalidateQueries({ queryKey: ['compensations'] });
      }
      if (result.failures.length === 0) {
        toast.success(`已成功提交 ${result.successes.length} 项赔偿申请`);
      } else if (result.successes.length > 0) {
        toast.success(`已成功提交 ${result.successes.length} 项赔偿申请`);
        toast.error(`${result.failures.length} 项提交失败，已保留失败资产以便重试`);
      } else {
        toast.error('所选资产均未提交成功，请检查后重试');
      }
    },
    onError: () => toast.error('提交失败，请重试'),
  });

  const onSubmit = (values: FormValues) => {
    const selectedAssets = displayAssets.filter((a) => selectedIds.has(a.id));
    const validation = validateSelectedAssets(selectedAssets);
    setAssetSelectionError(validation.selectionError);
    setAssetErrors(validation.errors);
    if (validation.selectionError || Object.keys(validation.errors).length > 0) {
      return;
    }

    const description = buildCompensationDescription(values);
    if (description.length > MAX_COMPENSATION_DESCRIPTION_LENGTH) {
      setError('damageDesc', {
        type: 'manual',
        message: `赔偿事由及附加信息不能超过 ${MAX_COMPENSATION_DESCRIPTION_LENGTH} 个字符`,
      });
      return;
    }
    clearErrors('damageDesc');
    mutation.mutate({
      ...values,
      assets: selectedAssets,
      description,
    });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-8">
      <PageHeader
        title="资产赔偿申请"
        breadcrumbs={[
          { label: '资产处置', href: '/disposals' },
          { label: '赔偿申请' },
        ]}
        actions={
          <Button variant="ghost" size="md" onClick={() => navigate(-1)}>
            返回
          </Button>
        }
      />

      {/* Progress Steps */}
      <div className="mb-12 max-w-4xl mx-auto">
        <div className="flex justify-between items-center relative">
          {[
            { num: 1, label: '填写信息', active: true },
            { num: 2, label: '选择资产', active: false },
            { num: 3, label: '赔偿配置', active: false },
            { num: 4, label: '确认提交', active: false },
          ].map((step, idx) => (
            <div key={step.num} className="flex flex-col items-center gap-2 relative z-10 w-full">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                  step.active
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-[#e1e2ed] text-[#434655] font-medium'
                }`}
              >
                {step.num}
              </div>
              <span
                className={`text-xs font-semibold ${
                  step.active ? 'text-[#004ac6]' : 'text-[#434655]'
                }`}
              >
                {step.label}
              </span>
              {idx < 3 && (
                <div
                  className={`absolute top-3 left-1/2 w-full h-[2px] ${
                    step.active ? 'bg-[#2563eb]' : 'bg-[#e1e2ed]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 border-l-4 border-[#2563eb] pl-3">
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
              <Input label="赔偿编号" value="COMP-20240520-001" readOnly className="bg-[#f3f3fe] cursor-not-allowed border-[#e2e8f0] text-[#505f76]" />
              <Input label="申请人" value="系统管理员" readOnly className="bg-[#f3f3fe] cursor-not-allowed border-[#e2e8f0] text-[#505f76]" />
              <Input label="申请日期" type="date" error={errors.applyDate?.message} {...register('applyDate')} />
              <Controller
                name="damageType"
                control={control}
                render={({ field }) => (
                  <Select
                    label="损坏类型"
                    value={field.value}
                    onValueChange={field.onChange}
                    error={errors.damageType?.message}
                  >
                    {DAMAGE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Damage Details — 强化损坏描述、责任人、赔偿金额的视觉层次 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 border-l-4 border-[#2563eb] pl-3">
              损坏详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 资产损失说明 — 顶层高亮区块 */}
            <div className="mb-6 p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg">
              <label className="block text-sm font-semibold text-[#1e40af] mb-1.5">
                资产损失说明 <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="请详细描述资产损坏情况、发生经过及损失范围..."
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white transition-all placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-[#3b82f6] resize-none ${
                  errors.damageDesc ? 'border-red-400 ring-2 ring-red-100' : 'border-[#93c5fd]'
                }`}
                {...register('damageDesc')}
              />
              {errors.damageDesc && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  <p className="text-xs font-medium text-red-600">{errors.damageDesc.message}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
              <Input label="损坏日期" type="date" error={errors.damageDate?.message} {...register('damageDate')} />

              {/* 责任人 — 高可读性强调字段 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[#1e293b]">
                  责任人 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="输入责任人 ID"
                  className={`w-full px-3 py-2 text-sm font-medium border rounded-lg bg-white transition-all placeholder:text-[#94a3b8] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] ${
                    errors.responsiblePerson ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'
                  }`}
                  {...register('responsiblePerson')}
                />
                {errors.responsiblePerson && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    <p className="text-xs font-medium text-red-600">{errors.responsiblePerson.message}</p>
                  </div>
                )}
              </div>

              <Controller
                name="responsibleDept"
                control={control}
                render={({ field }) => (
                  <Select
                    label="责任部门"
                    value={field.value}
                    onValueChange={field.onChange}
                    error={errors.responsibleDept?.message}
                    placeholder={deptOptions.length > 0 ? '请选择责任部门' : '暂无可选部门'}
                    disabled={deptOptions.length === 0}
                  >
                    {deptOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Input label="发现人" placeholder="输入发现人姓名" error={errors.discoverer?.message} {...register('discoverer')} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#434655]">是否报险</label>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="yes"
                      className="w-4 h-4 text-[#2563eb] focus:ring-[#2563eb]"
                      {...register('insured')}
                    />
                    <span className="text-sm">是</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="no"
                      className="w-4 h-4 text-[#2563eb] focus:ring-[#2563eb]"
                      {...register('insured')}
                    />
                    <span className="text-sm">否</span>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Asset Selection */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2 border-l-4 border-[#2563eb] pl-3">
              <CardTitle>资产选择</CardTitle>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Input
                  placeholder="搜索资产编号/名称"
                  className="w-64 pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="primary" size="md" type="button" onClick={addSelectedAssets}>
                添加资产
              </Button>
            </div>
          </CardHeader>
          {assetSelectionError && (
            <p role="alert" className="px-6 pb-3 text-sm text-red-600">{assetSelectionError}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f3f3fe] border-b border-[#e2e8f0]">
                <tr>
                  <th className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="rounded border-[#c3c6d7] text-[#2563eb] focus:ring-[#2563eb]"
                      checked={selectedIds.size === filteredAssets.length && filteredAssets.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#434655]">资产编号</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#434655]">资产名称</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#434655]">分类</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#434655]">原值 (¥)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#434655]">损坏程度</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#434655] text-right">预估赔偿金额 (¥)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-white transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-[#c3c6d7] text-[#2563eb] focus:ring-[#2563eb]"
                        checked={selectedIds.has(asset.id)}
                        onChange={() => toggleAsset(asset.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">{asset.assetNo}</td>
                    <td className="px-6 py-4 text-sm font-medium">{asset.assetName}</td>
                    <td className="px-6 py-4 text-sm">{asset.category}</td>
                    <td className="px-6 py-4 text-sm text-[#505f76]">{formatCurrency(asset.originalValue)}</td>
                    <td className="px-6 py-4">
                      <select
                        className="border-[#e2e8f0] rounded text-sm py-1 px-2 focus:ring-1 focus:ring-[#2563eb] outline-none"
                        value={asset.damageLevel}
                        onChange={(e) => updateAsset(asset.id, 'damageLevel', e.target.value)}
                      >
                        {DAMAGE_LEVEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <input
                         type="number"
                         min="0.01"
                         max="99999999.99"
                         step="0.01"
                        aria-label={`${asset.assetName || asset.assetNo || asset.id}赔偿金额`}
                        className="w-36 border border-[#bfdbfe] bg-[#eff6ff] rounded-md text-sm text-right font-semibold text-[#1e40af] py-1.5 px-3 focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] outline-none"
                        value={asset.compensationAmount || ''}
                        onChange={(e) => {
                          updateAsset(asset.id, 'compensationAmount', e.target.valueAsNumber || 0);
                        }}
                      />
                      {assetErrors[asset.id] && (
                        <p role="alert" className="mt-1 text-xs font-medium text-red-600">{assetErrors[asset.id]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Section 4: Compensation Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 border-l-4 border-[#2563eb] pl-3">
              赔偿配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#434655]">赔偿方式</label>
                <div className="flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="cash"
                      className="w-4 h-4 text-[#2563eb] focus:ring-[#2563eb]"
                      {...register('compensationType')}
                    />
                    <span className="text-sm">现金赔偿</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="equivalent"
                      className="w-4 h-4 text-[#2563eb] focus:ring-[#2563eb]"
                      {...register('compensationType')}
                    />
                    <span className="text-sm">等价物赔偿</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="repair"
                      className="w-4 h-4 text-[#2563eb] focus:ring-[#2563eb]"
                      {...register('compensationType')}
                    />
                    <span className="text-sm">维修恢复</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[#1e293b]">总赔偿金额 (¥)</label>
                <div className="flex items-center bg-gradient-to-r from-[#eff6ff] to-[#dbeafe] border border-[#93c5fd] rounded-lg px-4 py-3">
                  <span className="text-lg font-bold text-[#1e40af] tracking-wide">
                    ¥ {formatCurrency(totalCompensation)}
                  </span>
                  <span className="ml-auto text-xs text-[#3b82f6]">合计</span>
                </div>
              </div>
              <Controller
                name="approvalProcess"
                control={control}
                render={({ field }) => (
                  <Select
                    label="审批流程"
                    value={field.value}
                    onValueChange={field.onChange}
                    error={errors.approvalProcess?.message}
                  >
                    {APPROVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </Select>
                )}
              />
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#434655]">备注</label>
                <textarea
                  rows={2}
                  placeholder="补充说明事项..."
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white transition-all placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none border-[#e2e8f0]"
                  {...register('remark')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {mutation.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {(mutation.error instanceof Error ? mutation.error.message : '提交失败，请重试')}
          </div>
        )}

        {submissionResult && (
          <div role="status" aria-live="polite" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            {submissionResult.successes.length > 0 && (
              <div>
                <p className="font-semibold text-emerald-700">已成功提交的赔偿申请</p>
                <ul className="mt-1 list-disc pl-5 text-emerald-700">
                  {submissionResult.successes.map(({ assetId, response }) => (
                    <li key={assetId}>资产 {assetId}：{response.compensationNo}</li>
                  ))}
                </ul>
              </div>
            )}
            {submissionResult.failures.length > 0 && (
              <div>
                <p className="font-semibold text-red-700">仍待重试的资产</p>
                <ul className="mt-1 list-disc pl-5 text-red-700">
                  {submissionResult.failures.map(({ assetId, reason }) => (
                    <li key={assetId}>资产 {assetId}：{formatFailureReason(reason)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions — 主次分明 */}
        <div className="mt-12 flex justify-end items-center gap-3 py-6 border-t border-[#e2e8f0]">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            取消
          </Button>
           <Button type="button" variant="outline" onClick={() => navigate('/disposals')}>
             保存草稿
           </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting || mutation.isPending}
            className="min-w-[120px] font-semibold shadow-md hover:shadow-lg transition-shadow"
          >
            提交申请
          </Button>
        </div>
      </form>
    </div>
  );
}
