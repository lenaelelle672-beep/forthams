import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Search,
  Package,
  Info,
  ChevronRight,
  Loader2,
  AlertTriangle,
  FileText,
  DollarSign,
  MessageSquare,
} from 'lucide-react';
import { createRetirement } from '@/api/retirement';
import { getAssetList } from '@/api/asset';
import type { AssetListItem } from '@/types/asset';
import type { PaginatedResponse, PageData } from '@/types/common';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';

const schema = z.object({
  assetId: z.coerce.number().positive('请输入资产 ID'),
  reason: z.string().min(10, '退役原因至少 10 个字').max(500),
  residualValue: z.coerce.number().nonnegative('残值不能为负数').optional(),
  notes: z.string().max(1000).optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const DEPRECIATION_BARS = [
  90, 80, 70, 60, 50, 45, 40, 35, 30, 28, 25, 20,
];

const getAssetRecords = (
  response: PaginatedResponse<AssetListItem> | PageData<AssetListItem> | undefined,
): AssetListItem[] => {
  if (!response) {
    return [];
  }

  return response.records;
};

export default function RetirementFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const prefilledAssetId = (location.state as { assetId?: number } | null)?.assetId;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, undefined, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      assetId: prefilledAssetId ?? undefined,
    },
  });

  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetListItem | null>(null);

  const mutation = useMutation({
    mutationFn: createRetirement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retirement'] });
      navigate('/retirement');
    },
    onError: (err: Error) => toast.error(err.message || '提交失败，请重试'),
  });

  // 资产搜索
  const { data: assetRes, isLoading: assetLoading } = useQuery({
    queryKey: ['assets', 'search', assetSearch],
    queryFn: () => getAssetList({ keyword: assetSearch, pageSize: 5 }),
    enabled: assetSearch.trim().length > 0,
    staleTime: 1000 * 30,
  });
  const assetResults = getAssetRecords(assetRes);

  const selectAsset = (asset: AssetListItem) => {
    setSelectedAsset(asset);
    setAssetSearch(`${asset.assetNo ?? ''} ${asset.assetName ?? ''}`.trim());
    setValue('assetId', Number(asset.id), { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      assetId: values.assetId,
      reason: values.reason,
      residualValue: values.residualValue,
      notes: values.notes,
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto w-full">
      <nav className="flex items-center gap-2 text-[#64748b] mb-2">
        <button
          className="text-[12px] hover:text-[#004191] transition-colors"
          onClick={() => navigate('/retirement')}
        >
          退役管理
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[12px] text-[#004191] font-semibold">新建申请</span>
      </nav>

      <PageHeader
        title="资产退役申请"
        breadcrumbs={[]}
        actions={
          <Button variant="ghost" size="md" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#004191]" />
                资产选择
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                placeholder="搜索资产编号或名称"
                prefix={<Search className="w-4 h-4 text-[#727784]" />}
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
              />

              <div className="bg-[#f9f9ff] border border-[#004191]/10 p-4 rounded-lg">
                {!assetSearch.trim() && !selectedAsset ? (
                  <div className="py-6 text-center text-sm text-[#94a3b8]">
                    请输入资产编号或名称搜索
                  </div>
                ) : assetLoading ? (
                  <div className="py-6 text-center text-sm text-[#64748b] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    搜索中...
                  </div>
                ) : selectedAsset ? (
                  <div className="flex gap-6">
                    <div className="w-32 h-32 bg-[#e3e8f8] rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <Package className="w-12 h-12 text-[#64748b]" />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
                      <div className="col-span-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] text-[#64748b] uppercase tracking-wider">已选资产</p>
                          <p className="text-xl font-bold text-[#161c27]">{selectedAsset.assetName ?? '—'}</p>
                          <p className="text-[12px] text-[#004191] font-mono">{selectedAsset.assetNo ?? '—'}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAsset(null)}
                        >
                          重新选择
                        </Button>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider">分类</p>
                        <p className="text-[13px] text-[#161c27]">{selectedAsset.categoryName ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider">品牌/型号</p>
                        <p className="text-[13px] text-[#161c27]">{selectedAsset.brand ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider">原值</p>
                        <p className="text-[13px] text-[#161c27] font-semibold">
                          {selectedAsset.originalValue != null ? `¥${Number(selectedAsset.originalValue).toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748b] uppercase tracking-wider">净值</p>
                        <p className="text-[13px] text-[#004191] font-semibold">
                          {selectedAsset.currentValue != null ? `¥${Number(selectedAsset.currentValue).toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div className="col-span-2 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3ff] text-[#64748b] border border-[#64748b]/10 text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]" />
                          {selectedAsset.status ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : assetResults.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[#94a3b8]">
                    未找到匹配的资产，请尝试其他关键词
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assetResults.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg bg-white border border-[#e5e7eb] hover:border-[#004191]/40 hover:bg-[#f1f3ff] transition-colors"
                        onClick={() => selectAsset(asset)}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-[#161c27]">{asset.assetName ?? '—'}</span>
                          <span className="block text-[11px] font-mono text-[#004191]">{asset.assetNo ?? '—'}</span>
                        </span>
                        <span className="text-[11px] text-[#64748b]">{asset.categoryName ?? asset.status ?? '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>折旧时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-24 flex items-end gap-1 px-2">
                {DEPRECIATION_BARS.map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${
                      i === 9
                        ? 'bg-[#004191]/30 border-t-2 border-[#004191]'
                        : i > 9
                        ? 'bg-[#e3e8f8] border border-dashed border-[#727784]'
                        : 'bg-[#004191]/20'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-[#64748b] uppercase tracking-wider">
                <span>2020</span>
                <span>2023 (当前)</span>
                <span>2025</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* ── 分组 1：退役原因 ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#004191]" />
                  退役原因
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                  <Input
                    label="资产 ID *"
                    type="number"
                    placeholder="请先搜索并选择资产"
                    readOnly={!!selectedAsset}
                    error={errors.assetId?.message}
                    {...register('assetId')}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#64748b] uppercase tracking-wider block font-semibold">
                    退役原因 *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="请输入退役原因（如技术过时、不可修复的损坏...）"
                    className={`w-full p-4 bg-[#f1f3ff] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/20 transition-all outline-none resize-none placeholder:text-[#94a3b8] ${
                      errors.reason ? 'ring-2 ring-red-200' : ''
                    }`}
                    {...register('reason')}
                  />
                  {errors.reason && (
                    <p className="text-xs text-red-500">{errors.reason.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── 分组 2：残值评估 ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#004191]" />
                  残值评估
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  prefix={<span className="text-[#004191] font-semibold">¥</span>}
                  error={errors.residualValue?.message}
                  {...register('residualValue')}
                />
                <p className="text-[11px] text-[#64748b] italic">
                  {selectedAsset
                    ? `基于净值的建议残值：${selectedAsset.currentValue != null ? `¥${Number(selectedAsset.currentValue).toLocaleString()}` : '—'}`
                    : '搜索并选择资产后显示建议残值'}
                </p>
              </CardContent>
            </Card>

            {/* ── 分组 3：备注与附件 ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#004191]" />
                  备注与说明
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  rows={3}
                  placeholder="可选的内部备注或附件说明"
                  className="w-full p-4 bg-[#f1f3ff] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/20 transition-all outline-none resize-none placeholder:text-[#94a3b8]"
                  {...register('notes')}
                />
              </CardContent>
            </Card>

            {/* ── 风险提示 ── */}
            <div className="p-4 bg-[#fef3c7] rounded-lg flex gap-3 border border-[#d97706]/20">
              <AlertTriangle className="w-5 h-5 text-[#d97706] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[13px] text-[#92400e] font-semibold">
                  退役操作不可逆
                </p>
                <p className="text-[12px] text-[#92400e]/80 leading-relaxed">
                  提交后将启动多级审批流程（部门负责人 → 财务总监），审批通过后资产将从在册清单中移除。请确认退役原因和残值信息无误。
                </p>
              </div>
            </div>

            {/* ── 审批流程提示 ── */}
            <div className="p-4 bg-[#dbeafe] rounded-lg flex gap-3 border border-[#2563eb]/10">
              <Info className="w-4 h-4 text-[#2563eb] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#2563eb]">
                提交此申请将启动多级审批流程，涉及部门负责人和财务总监。
              </p>
            </div>

            {/* ── 错误提示 ── */}
            {mutation.isError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {(mutation.error instanceof Error ? mutation.error.message : '提交失败，请重试')}
              </div>
            )}

            {/* ── 提交区域 ── */}
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting || mutation.isPending}
                >
                  <Send className="w-4 h-4" />
                  提交退役申请
                </Button>
              </CardContent>
            </Card>
          </form>
        </section>
      </div>
    </div>
  );
}
