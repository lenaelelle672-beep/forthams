import { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText, Cog, Wrench, Search,
  Plus, Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { getAssetList } from '@/api/asset';
import { submitScrapApplication, saveScrapDraft } from '@/api/disposal';
import type { AssetListItem } from '@/types/asset';
import type { ApiResponse, PageData } from '@/types/common';

const STEPS = [
  { key: 'fill-info', label: '填写信息', num: 1 },
  { key: 'select-assets', label: '选择资产', num: 2 },
  { key: 'configure', label: '报废配置', num: 3 },
  { key: 'confirm', label: '确认提交', num: 4 },
] as const;

const SCRAP_REASONS = [
  { value: 'aging', label: '设备老化' },
  { value: 'damaged', label: '损坏严重' },
  { value: 'inefficient', label: '效率低下' },
  { value: 'other', label: '其他' },
];

const DISPOSAL_METHODS = [
  { value: 'sell', label: '变卖处理' },
  { value: 'dismantle', label: '报废拆解' },
  { value: 'donate', label: '捐赠' },
];

const APPROVAL_FLOWS = [
  { value: 'standard-v2.1', label: '标准报废审批流 v2.1' },
  { value: 'urgent-v1.0', label: '紧急资产处理流程 v1.0' },
  { value: 'high-value', label: '高价值资产专项审批' },
];

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

const schema = z.object({
  scrapDate: z.string().min(1, '请选择申请日期'),
  scrapReason: z.string().min(1, '请选择报废原因'),
  disposalMethod: z.string().min(1, '请选择处置方式'),
  estimatedResidualValue: z.string().optional(),
  approvalFlow: z.string().min(1, '请选择审批流程'),
  remark: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-6 px-12 relative">
      {STEPS.map((step, idx) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${
              idx < currentStep
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#dee2f2] text-[#535f74]'
            }`}>
              {step.num}
            </div>
            <span className={`mt-2 text-sm ${
              idx < currentStep
                ? 'text-[#3b82f6] font-semibold'
                : 'text-[#535f74]'
            }`}>
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={`flex-1 h-[2px] mx-4 -mt-6 ${
              idx < currentStep - 1 ? 'bg-[#3b82f6]' : 'bg-[#c2c6d5]'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

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
  const [assetSearch, setAssetSearch] = useState('');

  // Fetch available assets from the real API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const availableAssets: AssetListItem[] = (assetListData as ApiResponse<PageData<AssetListItem>> | undefined)?.data?.records ?? [];

  const {
    register, handleSubmit, control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      scrapDate: new Date().toISOString().split('T')[0],
      disposalMethod: 'sell',
      approvalFlow: 'standard-v2.1',
    },
  });

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
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? '提交失败，请重试');
    },
  });

  const removeAsset = (id: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const addAsset = useCallback((asset: AssetListItem) => {
    const selected = toSelectedAsset(asset);
    setSelectedAssets((prev) => {
      if (prev.some((a) => a.id === selected.id)) return prev;
      return [...prev, selected];
    });
  }, []);

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

  const formatCurrency = (val: number) =>
    val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filter available assets that are not already selected
  const unselectedAssets = availableAssets.filter(
    (a) => !selectedAssets.some((s) => s.id === String(a.id)),
  );
  const filteredUnselected = unselectedAssets.filter(
    (a) =>
      !assetSearch ||
      a.assetNo.toLowerCase().includes(assetSearch.toLowerCase()) ||
      a.assetName.toLowerCase().includes(assetSearch.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="资产报废申请"
        breadcrumbs={[
          { label: '资产管理', href: '/assets' },
          { label: '资产报废', href: '/disposals' },
          { label: '新建申请' },
        ]}
      />

      <StepIndicator currentStep={currentStep} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3b82f6]" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <Input
                label="报废编号"
                value="SCRAP-20240520-001"
                readOnly
                className="bg-[#f1f3ff] cursor-not-allowed text-[#535f74]"
              />
              <Input
                label="申请人"
                value="Admin"
                readOnly
                className="bg-[#f1f3ff] cursor-not-allowed text-[#535f74]"
              />
              <Input
                label="申请日期"
                type="date"
                error={errors.scrapDate?.message}
                {...register('scrapDate')}
              />
              <Controller
                name="scrapReason"
                control={control}
                render={({ field }) => (
                  <Select
                    label="报废原因"
                    value={field.value}
                    onValueChange={field.onChange}
                    error={errors.scrapReason?.message}
                  >
                    {SCRAP_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 资产选择 */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="w-4 h-4 text-[#3b82f6]" />
              资产选择
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="搜索资产..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="h-8 pl-9 pr-4 rounded-lg border border-[#e5e7eb] bg-[#e9edfe] text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-72"
                />
              </div>
            </div>
          </CardHeader>
          {/* Available assets to add */}
          {assetSearch && filteredUnselected.length > 0 && (
            <div className="border-t border-[#e5e7eb] bg-[#f8faff]">
              <div className="px-6 py-2 text-xs font-semibold text-[#535f74] uppercase tracking-wider">
                可添加资产
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-[#e5e7eb]">
                {filteredUnselected.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between px-6 py-2 hover:bg-[#f1f3ff]/70 transition-colors cursor-pointer"
                    onClick={() => addAsset(asset)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-[#3b82f6]">{asset.assetNo}</span>
                      <span>{asset.assetName}</span>
                      <span className="text-[#535f74]">{asset.categoryName}</span>
                    </div>
                    <Plus className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f1f3ff] text-[#424753] text-[10px] font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3 border-b border-[#e5e7eb]">资产编号</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb]">资产名称</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb]">分类</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb]">品牌/型号</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb] text-right">原值 (¥)</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb] text-right">净值 (¥)</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb]">已用年限</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb]">状态</th>
                  <th className="px-6 py-3 border-b border-[#e5e7eb] text-center">操作</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[#e5e7eb]">
                {selectedAssets
                  .filter((a) =>
                    !assetSearch ||
                    a.assetNo.toLowerCase().includes(assetSearch.toLowerCase()) ||
                    a.name.toLowerCase().includes(assetSearch.toLowerCase())
                  )
                  .map((asset) => (
                    <tr key={asset.id} className="hover:bg-[#f1f3ff]/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-[#3b82f6]">{asset.assetNo}</td>
                      <td className="px-6 py-4">{asset.name}</td>
                      <td className="px-6 py-4">{asset.category}</td>
                      <td className="px-6 py-4 text-[#535f74]">{asset.brand}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(asset.originalValue)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(asset.netValue)}</td>
                        <td className="px-6 py-4">{asset.usedYears} 年</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={asset.status} color={asset.statusColor} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => removeAsset(asset.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                {selectedAssets.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-[#94a3b8]">
                      暂无选中资产，请搜索并添加资产
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 报废配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#3b82f6]" />
              报废配置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#424753]">
                  处置方式
                </label>
                <div className="flex items-center gap-6">
                  {DISPOSAL_METHODS.map((method) => (
                    <label key={method.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        value={method.value}
                        {...register('disposalMethod')}
                        className="w-5 h-5 text-[#3b82f6] border-[#c2c6d5] focus:ring-blue-200"
                      />
                      <span className="text-sm group-hover:text-[#3b82f6] transition-colors">
                        {method.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label="预估残值 (¥)"
                type="number"
                placeholder="0.00"
                prefix={<span className="text-sm">¥</span>}
                {...register('estimatedResidualValue')}
              />

              <Controller
                name="approvalFlow"
                control={control}
                render={({ field }) => (
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
                )}
              />

              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#424753]">
                  备注
                </label>
                <textarea
                  rows={3}
                  placeholder="请输入报废申请相关的补充说明..."
                  className="w-full px-4 py-3 text-sm border border-[#e5e7eb] rounded-lg bg-[#f1f3ff] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none placeholder:text-[#94a3b8]"
                  {...register('remark')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {submitMutation.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {(submitMutation.error instanceof Error ? submitMutation.error.message : '提交失败，请重试')}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-between items-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => navigate('/disposals')}
          >
            取消
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleSaveDraft}
            >
              保存草稿
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={submitMutation.isPending}
            >
              提交申请
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
