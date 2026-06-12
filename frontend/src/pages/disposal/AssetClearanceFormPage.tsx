import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Info, ListChecks, Wrench, Search, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { getAssetList } from '@/api/asset';
import { submitClearanceApplication, saveClearanceDraft } from '@/api/disposal';
import type { ClearanceDraftData } from '@/api/disposal';
import type { AssetListItem } from '@/types/asset';
import type { ApiResponse, PageData } from '@/types/common';

const optionalResidualValueSchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().nonnegative('残值不能为负数').optional(),
);

const schema = z.object({
  clearanceNo: z.string(),
  applicant: z.string(),
  applicationDate: z.string().min(1, '请选择申请日期'),
  clearanceReason: z.string().min(1, '请选择清退原因'),
  disposalMethod: z.enum(['storage', 'sell', 'donate'], { message: '请选择处理方式' }),
  estimatedResidualValue: optionalResidualValueSchema,
  approvalFlow: z.string().min(1, '请选择审批流程'),
  urgency: z.enum(['normal', 'urgent'], { message: '请选择紧急程度' }),
  remark: z.string().max(500).optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const CLEARANCE_REASONS = ['设备老化', '技术淘汰', '闲置超过期限', '其他'] as const;
const APPROVAL_FLOWS = ['标准清退审批流 v2.1', '紧急资产清退流程', '高价值资产清退流程'] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  IDLE: { label: '闲置', bg: 'bg-[#fef3c7]', text: 'text-[#d97706]' },
  IN_USE: { label: '使用中', bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },
  RUNNING: { label: '运行中', bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },
  MAINTENANCE: { label: '维修中', bg: 'bg-[#dbeafe]', text: 'text-[#2563eb]' },
};

const DISPOSAL_METHOD_OPTIONS = [
  { value: 'storage' as const, label: '入库保管' },
  { value: 'sell' as const, label: '变卖处理' },
  { value: 'donate' as const, label: '捐赠' },
];

const URGENCY_OPTIONS = [
  { value: 'normal' as const, label: '普通' },
  { value: 'urgent' as const, label: '紧急' },
];

const STEPS = ['填写信息', '选择资产', '清退配置', '确认提交'];

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`;
}

interface AssetRow {
  id: string;
  assetNo: string;
  name: string;
  category: string;
  brand: string;
  originalValue: number;
  netValue: number;
  status: string;
}

function toAssetRow(a: AssetListItem): AssetRow {
  return {
    id: String(a.id),
    assetNo: a.assetNo,
    name: a.assetName,
    category: a.categoryName ?? '',
    brand: [a.brand, a.model].filter(Boolean).join(' ') || '-',
    originalValue: a.originalValue ?? 0,
    netValue: a.currentValue ?? 0,
    status: String(a.status ?? ''),
  };
}

export default function AssetClearanceFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [assetSearch, setAssetSearch] = useState('');

  // Fetch real assets from API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const assetRows: AssetRow[] = useMemo(() => {
    const records = (assetListData as ApiResponse<PageData<AssetListItem>> | undefined)?.data?.records ?? [];
    return records.map(toAssetRow);
  }, [assetListData]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clearanceNo: 'CLR-20231124-001',
      applicant: '系统管理员',
      applicationDate: new Date().toISOString().split('T')[0],
      clearanceReason: '',
      disposalMethod: 'sell',
      approvalFlow: APPROVAL_FLOWS[0],
      urgency: 'normal',
      remark: '',
    },
  });

  const disposalMethod = watch('disposalMethod');
  const urgency = watch('urgency');

  const filteredAssets = useMemo(() => {
    if (!assetSearch.trim()) return assetRows;
    const q = assetSearch.toLowerCase();
    return assetRows.filter(
      (a) =>
        a.assetNo.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q),
    );
  }, [assetSearch, assetRows]);

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAssetIds.size === filteredAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormValues & { assetIds: string[] }) => {
      return submitClearanceApplication({
        assetIds: data.assetIds,
        clearanceReason: data.clearanceReason,
        disposalMethod: data.disposalMethod,
        estimatedResidualValue: data.estimatedResidualValue,
        approvalFlow: data.approvalFlow,
        urgency: data.urgency,
        remark: data.remark ?? '',
        applicationDate: data.applicationDate,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clearance'] });
      qc.invalidateQueries({ queryKey: ['disposals'] });
      toast.success('清退申请提交成功');
      navigate('/disposals');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? '提交失败，请重试');
    },
  });

  const handleSaveDraft = useCallback(() => {
    const values = getValues();
    const residualValue = optionalResidualValueSchema.safeParse(values.estimatedResidualValue);
    if (!residualValue.success) {
      toast.error(residualValue.error.issues[0]?.message ?? '残值格式不正确');
      return;
    }

    const draft: ClearanceDraftData = {
      clearanceReason: values.clearanceReason,
      disposalMethod: values.disposalMethod,
      approvalFlow: values.approvalFlow,
      urgency: values.urgency,
      remark: values.remark ?? '',
      applicationDate: values.applicationDate,
      assetIds: Array.from(selectedAssetIds),
    };
    if (residualValue.data !== undefined) {
      draft.estimatedResidualValue = residualValue.data;
    }

    const ok = saveClearanceDraft(draft);
    if (ok) {
      toast.success('草稿保存成功');
    } else {
      toast.error('草稿保存失败');
    }
  }, [getValues, selectedAssetIds]);

  const onSubmit = (values: FormValues) => {
    if (selectedAssetIds.size === 0) {
      toast.error('请至少选择一项资产');
      return;
    }
    mutation.mutate({
      ...values,
      assetIds: Array.from(selectedAssetIds),
    } as FormValues & { assetIds: string[] });
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="资产清退申请"
        breadcrumbs={[
          { label: '仪表板', href: '/dashboard' },
          { label: '资产处置', href: '/disposals' },
          { label: '清退申请' },
        ]}
        actions={
          <>
            <Button variant="outline" size="md" type="button" onClick={() => navigate('/workflow-designer?businessType=ASSET_CLEARANCE')}>
              配置流程
            </Button>
            <Button variant="ghost" size="md" type="button" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" /> 返回
            </Button>
          </>
        }
      />

      <div className="flex items-center justify-between w-full relative">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-[#dee2f2] -z-0" />
        <div className="absolute top-5 left-0 w-1/4 h-0.5 bg-[#004191] -z-0" />
        {STEPS.map((step, i) => (
          <div key={step} className="relative z-10 flex flex-col items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white mb-2 shadow-lg ${
                i === 0
                  ? 'bg-[#004191] shadow-[#004191]/20'
                  : 'bg-[#dee2f2] text-[#424753]'
              }`}
            >
              <span className="text-base font-semibold">{i + 1}</span>
            </div>
            <span
              className={`text-sm ${
                i === 0 ? 'font-semibold text-[#004191]' : 'text-[#424753]'
              }`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center bg-[#f1f3ff] rounded-t-xl">
            <Info className="w-5 h-5 text-[#004191] mr-2" />
            <CardTitle>基本信息</CardTitle>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  清退编号
                </label>
                <input
                  type="text"
                  readOnly
                  className="w-full bg-[#f1f3ff] border-none rounded-lg text-sm py-3 px-4 text-[#424753] cursor-not-allowed"
                  {...register('clearanceNo')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  申请人
                </label>
                <input
                  type="text"
                  readOnly
                  className="w-full bg-[#f1f3ff] border-none rounded-lg text-sm py-3 px-4 text-[#424753] cursor-not-allowed"
                  {...register('applicant')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  申请日期
                </label>
                <input
                  type="date"
                  className={`w-full bg-[#f1f3ff] focus:ring-2 focus:ring-[#004191]/20 border-none rounded-lg text-sm py-3 px-4 ${
                    errors.applicationDate ? 'ring-2 ring-red-300' : ''
                  }`}
                  {...register('applicationDate')}
                />
                {errors.applicationDate && (
                  <p className="text-xs text-[#ba1a1a]">{errors.applicationDate.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  清退原因
                </label>
                <select
                  className={`w-full bg-[#f1f3ff] focus:ring-2 focus:ring-[#004191]/20 border-none rounded-lg text-sm py-3 px-4 ${
                    errors.clearanceReason ? 'ring-2 ring-red-300' : ''
                  }`}
                  {...register('clearanceReason')}
                >
                  <option value="">请选择...</option>
                  {CLEARANCE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.clearanceReason && (
                  <p className="text-xs text-[#ba1a1a]">{errors.clearanceReason.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between bg-[#f1f3ff] rounded-t-xl">
            <div className="flex items-center">
              <ListChecks className="w-5 h-5 text-[#004191] mr-2" />
              <CardTitle>资产选择</CardTitle>
              {selectedAssetIds.size > 0 && (
                <span className="ml-3 px-2 py-0.5 rounded-full bg-[#dbeafe] text-[#2563eb] text-xs font-semibold">
                  已选 {selectedAssetIds.size} 项
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#424753]" />
                <input
                  type="text"
                  placeholder="搜索资产..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="w-full bg-white border border-[#e5e7eb] rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[#004191]"
                />
              </div>
              <Button type="button" size="sm" onClick={() => setAssetSearch(' ')}>
                <Plus className="w-4 h-4" /> 添加资产
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#f1f3ff]/50 border-b border-[#e5e7eb]">
                  <tr>
                    <th className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0}
                        onChange={toggleAll}
                        className="rounded border-[#c2c6d5] text-[#004191] focus:ring-[#004191]"
                      />
                    </th>
                    <th className="px-4 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                      资产编号
                    </th>
                    <th className="px-4 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                      资产名称
                    </th>
                    <th className="px-4 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                      分类
                    </th>
                    <th className="px-4 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                      品牌/型号
                    </th>
                    <th className="px-4 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase text-right">
                      原值
                    </th>
                    <th className="px-4 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase text-right">
                      净值
                    </th>
                    <th className="px-6 py-4 text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {filteredAssets.map((asset) => {
                    const sc = STATUS_CONFIG[asset.status] ?? STATUS_CONFIG['IN_USE'];
                    return (
                      <tr
                        key={asset.id}
                        className="hover:bg-[#f1f3ff] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedAssetIds.has(asset.id)}
                            onChange={() => toggleAsset(asset.id)}
                            className="rounded border-[#c2c6d5] text-[#004191] focus:ring-[#004191]"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-[#161c27]">
                          {asset.assetNo}
                        </td>
                        <td className="px-4 py-4 text-sm">{asset.name}</td>
                        <td className="px-4 py-4 text-sm text-[#424753]">{asset.category}</td>
                        <td className="px-4 py-4 text-sm text-[#424753]">{asset.brand}</td>
                        <td className="px-4 py-4 text-sm text-right">
                          {formatCurrency(asset.originalValue)}
                        </td>
                        <td className="px-4 py-4 text-sm text-right">
                          {formatCurrency(asset.netValue)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${sc.bg} ${sc.text}`}
                          >
                            {sc.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAssets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-sm text-[#424753]">
                        未找到匹配的资产
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center bg-[#f1f3ff] rounded-t-xl">
            <Wrench className="w-5 h-5 text-[#004191] mr-2" />
            <CardTitle>清退配置</CardTitle>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  处理方式
                </label>
                <div className="flex items-center space-x-6">
                  {DISPOSAL_METHOD_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={disposalMethod === opt.value}
                        onChange={() => setValue('disposalMethod', opt.value, { shouldValidate: true })}
                        className="w-4 h-4 text-[#004191] focus:ring-[#004191] border-[#c2c6d5]"
                      />
                      <span className="ml-2 text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {errors.disposalMethod && (
                  <p className="text-xs text-[#ba1a1a]">{errors.disposalMethod.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  预估残值 (¥)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  className={`w-full bg-[#f1f3ff] focus:ring-2 focus:ring-[#004191]/20 border-none rounded-lg text-sm py-3 px-4 ${
                    errors.estimatedResidualValue ? 'ring-2 ring-red-300' : ''
                  }`}
                  {...register('estimatedResidualValue')}
                />
                {errors.estimatedResidualValue && (
                  <p className="text-xs text-[#ba1a1a]">{errors.estimatedResidualValue.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  审批流程
                </label>
                <select
                  className={`w-full bg-[#f1f3ff] focus:ring-2 focus:ring-[#004191]/20 border-none rounded-lg text-sm py-3 px-4 ${
                    errors.approvalFlow ? 'ring-2 ring-red-300' : ''
                  }`}
                  {...register('approvalFlow')}
                >
                  <option value="">请选择...</option>
                  {APPROVAL_FLOWS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                {errors.approvalFlow && (
                  <p className="text-xs text-[#ba1a1a]">{errors.approvalFlow.message}</p>
                )}
              </div>
              <div className="space-y-3">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  紧急程度
                </label>
                <div className="flex items-center space-x-6">
                  {URGENCY_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={urgency === opt.value}
                        onChange={() => setValue('urgency', opt.value, { shouldValidate: true })}
                        className={`w-4 h-4 focus:ring-[#004191] border-[#c2c6d5] ${
                          opt.value === 'urgent' ? 'text-[#ba1a1a] focus:ring-[#ba1a1a]' : 'text-[#004191]'
                        }`}
                      />
                      <span
                        className={`ml-2 text-sm ${
                          opt.value === 'urgent' ? 'text-[#ba1a1a] font-medium' : ''
                        }`}
                      >
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                备注
              </label>
              <textarea
                rows={3}
                placeholder="请输入清退相关的额外说明..."
                className="w-full bg-[#f1f3ff] focus:ring-2 focus:ring-[#004191]/20 border-none rounded-lg text-sm py-3 px-4 resize-none"
                {...register('remark')}
              />
            </div>
          </CardContent>
        </Card>

        {mutation.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {(mutation.error instanceof Error ? mutation.error.message : '提交失败，请重试')}
          </div>
        )}

        <footer className="flex items-center justify-between py-6">
          <Button type="button" variant="outline" onClick={() => navigate('/disposals')}>
            取消
          </Button>
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              className="bg-[#d4e0f9] text-[#576378] hover:brightness-95 border-0"
              onClick={handleSaveDraft}
            >
              保存草稿
            </Button>
            <Button
              type="submit"
              loading={isSubmitting || mutation.isPending}
              className="bg-[#2563eb] hover:bg-blue-700 shadow-lg shadow-blue-500/20"
            >
              提交申请
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
