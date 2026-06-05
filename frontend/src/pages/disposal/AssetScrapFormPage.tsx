import { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText, Cog, Wrench,
  Plus, Trash2,
  ArrowLeft, AlertTriangle, ShieldCheck, CheckCircle, Info,
} from 'lucide-react';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import AssetPickerModal from '@/components/AssetPickerModal';
import { getAssetList } from '@/api/asset';
import { submitScrapApplication, saveScrapDraft } from '@/api/disposal';
import type { AssetListItem } from '@/types/asset';
import type { PaginatedResponse, PageData } from '@/types/common';

/** Step definitions for the scrap form wizard indicator */
const STEPS = [
  { key: 'fill-info', label: '填写信息', num: 1 },
  { key: 'select-assets', label: '选择资产', num: 2 },
  { key: 'configure', label: '报废配置', num: 3 },
  { key: 'confirm', label: '确认提交', num: 4 },
] as const;

/** Predefined scrap reason options */
const SCRAP_REASONS = [
  { value: 'aging', label: '设备老化', risk: 'medium' as const },
  { value: 'damaged', label: '损坏严重', risk: 'high' as const },
  { value: 'inefficient', label: '效率低下', risk: 'medium' as const },
  { value: 'other', label: '其他', risk: 'low' as const },
];

/** Disposal method options with irreversibility flags */
const DISPOSAL_METHODS = [
  { value: 'sell', label: '变卖处理', irreversible: true },
  { value: 'dismantle', label: '报废拆解', irreversible: true },
  { value: 'donate', label: '捐赠', irreversible: false },
];

/** Approval workflow presets */
const APPROVAL_FLOWS = [
  { value: 'standard-v2.1', label: '标准报废审批流 v2.1' },
  { value: 'urgent-v1.0', label: '紧急资产处理流程 v1.0' },
  { value: 'high-value', label: '高价值资产专项审批' },
];

/** Risk-level color mapping for scrap reasons */
const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-red-50', text: 'text-[#ba1a1a]', border: 'border-red-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  low: { bg: 'bg-[#f1f3ff]', text: 'text-[#424753]', border: 'border-[#e5e7eb]' },
};

interface SelectedAsset {
  id: string;
  assetNo: string;
  name: string;
  category: string;
  brand: string;
  originalValue: number;
  netValue: number;
  usedYears: number;
  status: string;
  statusColor: 'green' | 'blue';
}

/** Convert an API asset list item to a SelectedAsset for the table */
function toSelectedAsset(a: AssetListItem): SelectedAsset {
  const purchaseYear = a.purchaseDate ? new Date(a.purchaseDate).getFullYear() : 0;
  const usedYears = purchaseYear ? new Date().getFullYear() - purchaseYear : 0;
  const statusStr = String(a.status ?? '');
  const isBlue = statusStr === 'MAINTENANCE' || statusStr === 'IDLE';
  return {
    id: String(a.id),
    assetNo: a.assetNo,
    name: a.assetName,
    category: a.categoryName ?? '',
    brand: [a.brand, a.model].filter(Boolean).join(' ') || '-',
    originalValue: a.originalValue ?? 0,
    netValue: a.currentValue ?? 0,
    usedYears: Math.max(0, usedYears),
    status: statusStr,
    statusColor: isBlue ? 'blue' : 'green',
  };
}

/** Extract records from paginated response, handling both response shapes */
function getAssetRecords(
  response: PaginatedResponse<AssetListItem> | PageData<AssetListItem> | undefined,
): AssetListItem[] {
  if (!response) {
    return [];
  }

  return response.records;
}

const schema = z.object({
  scrapDate: z.string().min(1, '请选择申请日期'),
  scrapReason: z.string().min(1, '请选择报废原因'),
  disposalMethod: z.string().min(1, '请选择处置方式'),
  estimatedResidualValue: z.string().optional(),
  approvalFlow: z.string().min(1, '请选择审批流程'),
  remark: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Step progress indicator shown at top of form */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 sm:p-6 overflow-x-auto">
      <div className="flex items-center justify-between min-w-[480px]">
        {STEPS.map((step, idx) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className={`flex items-center gap-3 ${idx > currentStep - 1 ? 'opacity-40' : ''}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx < currentStep - 1
                    ? 'bg-green-500 text-white'
                    : idx === currentStep - 1
                      ? 'bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20'
                      : 'bg-[#f1f5f9] text-[#64748b]'
                }`}
              >
                {idx < currentStep - 1 ? <CheckCircle className="w-5 h-5" /> : step.num}
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-sm ${
                    idx === currentStep - 1
                      ? 'font-semibold text-[#3b82f6]'
                      : 'text-[#374151]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 mx-4">
                <div
                  className={`h-px ${
                    idx < currentStep - 1 ? 'bg-[#3b82f6]' : 'bg-[#e5e7eb]'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Asset status badge with color coding */
function StatusBadge({ status, color }: { status: string; color: 'green' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-100 text-emerald-600 border border-emerald-600/10',
    blue: 'bg-blue-100 text-blue-600 border border-blue-600/10',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {status}
    </span>
  );
}

export default function AssetScrapFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [draftSavedAt] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  // Fetch available assets from the real API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const availableAssets: AssetListItem[] = getAssetRecords(assetListData);

  const {
    register, handleSubmit, control, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      scrapDate: new Date().toISOString().split('T')[0],
      disposalMethod: 'sell',
      approvalFlow: 'standard-v2.1',
    },
  });

  const selectedReason = watch('scrapReason');
  const selectedDisposalMethod = watch('disposalMethod');

  /** Get risk level for current scrap reason */
  const reasonRisk = SCRAP_REASONS.find((r) => r.value === selectedReason)?.risk ?? 'low';
  const riskStyle = RISK_COLORS[reasonRisk];

  const submitMutation = useMutation({
    mutationFn: async (data: FormValues & { assetIds: string[] }) => {
      return submitScrapApplication({
        assetIds: data.assetIds,
        scrapDate: data.scrapDate,
        scrapReason: data.scrapReason,
        disposalMethod: data.disposalMethod,
        estimatedResidualValue: data.estimatedResidualValue ?? '',
        approvalFlow: data.approvalFlow,
        remark: data.remark ?? '',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disposals'] });
      toast.success('报废申请提交成功');
      navigate('/disposals');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : '提交失败，请重试');
    },
  });

  /** Remove a single asset from the selected list */
  const removeAsset = (id: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  /** Save current form data as a draft */
  const handleSaveDraft = useCallback(() => {
    const formData = {
      scrapDate: (document.querySelector<HTMLInputElement>('input[name="scrapDate"]')?.value) ?? '',
      scrapReason: (document.querySelector<HTMLSelectElement>('select[name="scrapReason"]')?.value) ?? '',
      disposalMethod: (document.querySelector<HTMLInputElement>('input[name="disposalMethod"]:checked')?.value) ?? '',
      estimatedResidualValue: (document.querySelector<HTMLInputElement>('input[name="estimatedResidualValue"]')?.value) ?? '',
      approvalFlow: (document.querySelector<HTMLSelectElement>('select[name="approvalFlow"]')?.value) ?? '',
      remark: (document.querySelector<HTMLTextAreaElement>('textarea[name="remark"]')?.value) ?? '',
      assetIds: selectedAssets.map((a) => a.id),
    };
    saveScrapDraft(formData);
    toast.success('草稿保存成功');
  }, [selectedAssets]);

  /** Form submit handler — validates asset selection before mutation */
  const onSubmit = (values: FormValues) => {
    if (selectedAssets.length === 0) {
      toast.error('请至少选择一项资产');
      return;
    }
    submitMutation.mutate({
      ...values,
      assetIds: selectedAssets.map((a) => a.id),
    });
  };

  /** Format a number as CNY currency */
  const formatCurrency = (val: number) =>
    val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Sum of original values for selected assets */
  const totalOriginalValue = selectedAssets.reduce((sum, a) => sum + a.originalValue, 0);
  const totalNetValue = selectedAssets.reduce((sum, a) => sum + a.netValue, 0);

  /** Determine overall risk level for the dynamic banner */
  const overallRisk = useMemo<'high' | 'medium' | 'low'>(() => {
    if (reasonRisk === 'high') return 'high';
    const isIrreversible = selectedDisposalMethod === 'sell' || selectedDisposalMethod === 'dismantle';
    if (reasonRisk === 'medium' && isIrreversible) return 'high';
    if (reasonRisk === 'medium') return 'medium';
    if (isIrreversible) return 'medium';
    return 'low';
  }, [reasonRisk, selectedDisposalMethod]);

  const bannerStyle = RISK_COLORS[overallRisk];

  return (
    <div className="p-4 sm:p-6 pb-28 space-y-5 max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="资产报废申请"
        subtitle="发起资产报废处置流程，提交后将进入审批环节。"
        breadcrumbs={[
          { label: '资产管理', href: '/assets' },
          { label: '资产报废', href: '/disposals' },
          { label: '新建申请' },
        ]}
        actions={
          <Button variant="ghost" size="md" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
        }
      />

      <StepIndicator currentStep={currentStep} />

      {/* ── 动态风险提示横幅 ────────────────────────────────────────────── */}
      <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${bannerStyle.bg} ${bannerStyle.border}`}>
        <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${overallRisk === 'high' ? 'text-red-500' : overallRisk === 'medium' ? 'text-amber-500' : 'text-blue-400'}`} />
        <div className={`text-sm leading-relaxed ${bannerStyle.text}`}>
          <span className="font-semibold">
            {overallRisk === 'high' ? '高风险警告：' : overallRisk === 'medium' ? '风险提示：' : '提示：'}
          </span>
          {overallRisk === 'high' && '当前报废原因与处置方式组合风险较高，资产报废后不可恢复。请仔细确认报废原因、残值评估及处置方式。'}
          {overallRisk === 'medium' && '资产报废操作一旦提交审批，所选资产将进入处置流程。提交前请仔细确认报废原因、残值评估及处置方式。'}
          {overallRisk === 'low' && '请如实填写报废原因和残值评估，提交后将进入审批环节。'}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── Card 1: 基本信息 ─────────────────────────────────────── */}
        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center bg-[#f1f3ff] rounded-t-xl">
            <FileText className="w-5 h-5 text-[#004191] mr-2" />
            <CardTitle>基本信息</CardTitle>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  报废编号
                </label>
                <input
                  type="text"
                  value="SCRAP-20240520-001"
                  readOnly
                  className="w-full bg-[#f1f3ff] border-none rounded-lg text-sm py-3 px-4 text-[#535f74] cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  申请人
                </label>
                <input
                  type="text"
                  value="系统管理员"
                  readOnly
                  className="w-full bg-[#f1f3ff] border-none rounded-lg text-sm py-3 px-4 text-[#535f74] cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  申请日期
                </label>
                <input
                  type="date"
                  className={`w-full bg-[#f1f3ff] focus:ring-2 focus:ring-[#004191]/20 border-none rounded-lg text-sm py-3 px-4 ${
                    errors.scrapDate ? 'ring-2 ring-red-300' : ''
                  }`}
                  {...register('scrapDate')}
                />
                {errors.scrapDate && (
                  <p className="text-xs text-[#ba1a1a]">{errors.scrapDate.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  报废原因
                  <span className="text-[#ba1a1a] ml-1">*</span>
                </label>
                <Controller
                  name="scrapReason"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label=""
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        // Advance step on selection
                        if (v && currentStep === 1) setCurrentStep(2);
                      }}
                      error={errors.scrapReason?.message}
                    >
                      {SCRAP_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </Select>
                  )}
                />
                {/* Risk-level indicator for selected reason */}
                {selectedReason && (
                  <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs ${riskStyle.bg} ${riskStyle.text} border ${riskStyle.border}`}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {reasonRisk === 'high' && '高风险：资产严重损坏，报废后不可恢复'}
                    {reasonRisk === 'medium' && '中风险：资产老化或效率下降，请确认残值评估'}
                    {reasonRisk === 'low' && '低风险：请补充报废说明'}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: 资产选择 ─────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between bg-[#f1f3ff] rounded-t-xl">
            <div className="flex items-center">
              <Cog className="w-5 h-5 text-[#004191] mr-2" />
              <CardTitle>资产选择</CardTitle>
              {selectedAssets.length > 0 && (
                <span className="ml-3 px-2 py-0.5 rounded-full bg-[#dbeafe] text-[#2563eb] text-xs font-semibold">
                  已选 {selectedAssets.length} 项
                </span>
              )}
            </div>
            <Button type="button" size="sm" onClick={() => setShowAssetPicker(true)}>
              <Plus className="w-4 h-4" /> 添加资产
            </Button>
          </div>
          {selectedAssets.length > 0 ? (
            <div className="px-4 sm:px-6 pb-6">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-4 py-2.5 my-3 rounded-lg bg-[#f8fafc] border border-[#e5e7eb] text-sm text-[#64748b]">
                <span>原值合计：<span className="font-semibold text-[#0f172a]">¥{formatCurrency(totalOriginalValue)}</span></span>
                <span>净值合计：<span className="font-semibold text-[#0f172a]">¥{formatCurrency(totalNetValue)}</span></span>
                <span>贬值：<span className="font-semibold text-amber-600">¥{formatCurrency(totalOriginalValue - totalNetValue)}</span></span>
              </div>
              {/* Desktop table view */}
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] text-left text-[#64748b]">
                    <th className="pb-2 font-medium">资产编号</th>
                    <th className="pb-2 font-medium">名称</th>
                    <th className="pb-2 font-medium">类别/品牌</th>
                    <th className="pb-2 font-medium text-right">原值</th>
                    <th className="pb-2 font-medium text-right">净值</th>
                    <th className="pb-2 font-medium text-right">已用年限</th>
                    <th className="pb-2 font-medium">状态</th>
                    <th className="pb-2 font-medium w-16">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                      <td className="py-2 text-[#3b82f6] font-mono text-xs">{asset.assetNo}</td>
                      <td className="py-2 text-[#374151] font-medium">{asset.name}</td>
                      <td className="py-2 text-[#64748b]">{asset.category} · {asset.brand}</td>
                      <td className="py-2 text-right">¥{formatCurrency(asset.originalValue)}</td>
                      <td className="py-2 text-right text-[#64748b]">¥{formatCurrency(asset.netValue)}</td>
                      <td className="py-2 text-right text-[#64748b]">{asset.usedYears} 年</td>
                      <td className="py-2"><StatusBadge status={asset.status} color={asset.statusColor} /></td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeAsset(asset.id)}
                          className="text-[#94a3b8] hover:text-red-500 transition-colors"
                          title="移除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-2">
                {selectedAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#f8fafc] border border-[#e5e7eb]">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#374151] truncate">{asset.name}</div>
                      <div className="text-xs text-[#94a3b8] mt-0.5">{asset.assetNo} · 原值 ¥{formatCurrency(asset.originalValue)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAsset(asset.id)}
                      className="text-[#94a3b8] hover:text-red-500 transition-colors shrink-0"
                      title="移除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <div className="text-center text-sm text-[#94a3b8] py-8 border-2 border-dashed border-[#e5e7eb] rounded-xl">
                暂无已选资产，点击上方「添加资产」按钮选择需要报废的资产。
              </div>
            </div>
          )}
        </Card>

        {/* ── Card 3: 报废配置 ─────────────────────────────────────── */}
        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center bg-[#f1f3ff] rounded-t-xl">
            <Wrench className="w-5 h-5 text-[#004191] mr-2" />
            <CardTitle>报废配置</CardTitle>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* 处置方式 */}
              <div className="space-y-3">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  处置方式
                  <span className="text-[#ba1a1a] ml-1">*</span>
                </label>
                <div className="flex items-center gap-6">
                  {DISPOSAL_METHODS.map((method) => (
                    <label key={method.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        value={method.value}
                        {...register('disposalMethod')}
                        className={`w-4 h-4 border-[#c2c6d5] ${
                          method.irreversible
                            ? 'text-[#ba1a1a] focus:ring-[#ba1a1a]'
                            : 'text-[#3b82f6] focus:ring-[#3b82f6]'
                        }`}
                      />
                      <span
                        className={`text-sm group-hover:text-[#3b82f6] transition-colors ${
                          method.irreversible && selectedDisposalMethod === method.value
                            ? 'text-[#ba1a1a] font-medium'
                            : ''
                        }`}
                      >
                        {method.label}
                      </span>
                      {method.irreversible && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-[#ba1a1a] border border-red-200">
                          不可逆
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                {/* Warning when irreversible method selected */}
                {(selectedDisposalMethod === 'sell' || selectedDisposalMethod === 'dismantle') && (
                  <p className="text-xs text-[#ba1a1a] flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {selectedDisposalMethod === 'sell'
                      ? '变卖处理后资产将从台账中永久移除，此操作不可撤销'
                      : '报废拆解后资产不可恢复，请确认已无再利用价值'}
                  </p>
                )}
              </div>

              {/* 预估残值 — enhanced with risk visual layer */}
              <div className={`space-y-1 p-3 rounded-lg border ${overallRisk === 'high' ? 'border-red-200 bg-red-50/30' : overallRisk === 'medium' ? 'border-amber-200 bg-amber-50/30' : 'border-[#e5e7eb]'}`}>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                    预估残值 (¥)
                  </label>
                  {overallRisk !== 'low' && (
                    <Info className={`w-3 h-3 ${overallRisk === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
                  )}
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full bg-white focus:ring-2 focus:ring-[#004191]/20 border border-[#e5e7eb] rounded-lg text-sm py-3 px-4"
                  {...register('estimatedResidualValue')}
                />
                <div className={`flex items-start gap-1.5 text-xs ${overallRisk === 'high' ? 'text-[#ba1a1a]' : 'text-[#94a3b8]'}`}>
                  {overallRisk === 'high' && <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />}
                  <span>
                    {overallRisk === 'high'
                      ? '高风险报废请务必准确评估残值，此数据将纳入审批决策依据。'
                      : '残值评估将影响审批路径，高价值资产需走专项审批。'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-[#e5e7eb]" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* 审批流程 */}
              <Controller
                name="approvalFlow"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      label="审批流程"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.approvalFlow?.message}
                    >
                      {APPROVAL_FLOWS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </Select>
                    <p className="text-xs text-[#94a3b8]">
                      标准流程需部门经理 → 资产管理员 → 财务三级审批。
                    </p>
                  </div>
                )}
              />

              {/* 占位/说明区 */}
              <div className="space-y-1">
                <label className="text-[10px] leading-3 tracking-wider font-semibold text-[#424753] uppercase">
                  备注
                  <span className="text-[#94a3b8] font-normal ml-2">（选填）</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="请输入报废申请相关的补充说明..."
                  className="w-full px-4 py-3 text-sm border border-[#e5e7eb] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none placeholder:text-[#94a3b8]"
                  {...register('remark')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Error display ────────────────────────────────────────── */}
        {submitMutation.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {(submitMutation.error instanceof Error ? submitMutation.error.message : '提交失败，请重试')}
          </div>
        )}

        {/* ── 确认提交区 ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#e5e7eb] bg-white">
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center bg-[#f1f3ff] rounded-t-xl">
            <ShieldCheck className="w-5 h-5 text-[#004191] mr-2" />
            <CardTitle>确认提交</CardTitle>
            {selectedAssets.length > 0 && (
              <span className="ml-3 text-sm text-[#424753]">
                即将对 <span className="font-semibold text-[#004191]">{selectedAssets.length}</span> 项资产发起报废审批
              </span>
            )}
          </div>
          {selectedAssets.length > 0 && (
            <div className="px-6 py-4 space-y-3">
              {/* Risk summary bar */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${bannerStyle.bg} ${bannerStyle.text} border ${bannerStyle.border}`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 ${overallRisk === 'high' ? 'text-red-500' : overallRisk === 'medium' ? 'text-amber-500' : 'text-blue-400'}`} />
                <span className="font-semibold">综合风险等级：{overallRisk === 'high' ? '高' : overallRisk === 'medium' ? '中' : '低'}</span>
                <span className="text-[#64748b]">· 资产 {selectedAssets.length} 项 · 净值 ¥{formatCurrency(totalNetValue)}</span>
              </div>
            </div>
          )}
          {selectedAssets.length === 0 && (
            <div className="px-6 py-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border-b border-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              请先选择至少一项资产后再提交
            </div>
          )}
        </div>
      </form>

      {/* ── Sticky Footer: Submit Area ─────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e7eb] z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between px-4 sm:px-10 h-20 gap-4">
          {/* Draft info */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#94a3b8] shrink-0">
            <CheckCircle className="w-4 h-4" />
            <span className="hidden sm:inline">草稿已于 {draftSavedAt} 自动保存</span>
            <span className="sm:hidden">草稿已保存</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/disposals')} className="hidden sm:inline-flex">
              取消
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#3b82f6] text-[#3b82f6] hover:bg-blue-50 hidden sm:inline-flex"
              onClick={handleSaveDraft}
            >
              保存草稿
            </Button>
            <Button
              type="button"
              size="sm"
              loading={isSubmitting || submitMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              className="sm:hidden"
            >
              提交
            </Button>
            <Button
              type="button"
              loading={isSubmitting || submitMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              className="hidden sm:inline-flex"
            >
              提交申请
            </Button>
          </div>
        </div>
      </footer>

      {/* ── Asset Picker Modal ─────────────────────────────────────── */}
      <AssetPickerModal
        open={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        selectedIds={new Set(selectedAssets.map((a) => a.id))}
        onSelectionChange={(ids) => {
          const newSelected = availableAssets
            .filter((a) => ids.has(String(a.id)))
            .map((a) => toSelectedAsset(a));
          setSelectedAssets(newSelected);
          if (newSelected.length > 0 && currentStep < 3) setCurrentStep(3);
        }}
      />
    </div>
  );
}
