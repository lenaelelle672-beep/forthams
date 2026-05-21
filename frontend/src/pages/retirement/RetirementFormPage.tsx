import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Send,
  Search,
  Package,
  CalendarDays,
  Info,
  ChevronRight,
} from 'lucide-react';
import { createRetirement } from '@/api/retirement';
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

type FormValues = z.infer<typeof schema>;

const DEPRECIATION_BARS = [
  90, 80, 70, 60, 50, 45, 40, 35, 30, 28, 25, 20,
];

export default function RetirementFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const prefilledAssetId = (location.state as { assetId?: number } | null)?.assetId;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      assetId: prefilledAssetId ?? undefined,
    },
  });

  const [assetSearch, setAssetSearch] = useState('');

  const mutation = useMutation({
    mutationFn: createRetirement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retirement'] });
      navigate('/retirement');
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      assetId: values.assetId,
      reason: values.reason,
      residualValue: values.residualValue,
    });
  };

  const currentYear = 2024;

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
                <div className="flex gap-6">
                  <div className="w-32 h-32 bg-[#e3e8f8] rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <Package className="w-12 h-12 text-[#64748b]" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8">
                    <div className="col-span-2">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">资产名称 & 编号</p>
                      <p className="text-xl font-bold text-[#161c27]">
                        {assetSearch || 'Precision Lathe X1'}
                      </p>
                      <p className="text-[12px] text-[#004191] font-mono">AST-2023-0891</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">分类</p>
                      <p className="text-[13px] text-[#161c27]">工业加工设备</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">制造商</p>
                      <p className="text-[13px] text-[#161c27]">DMG Mori</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">原值</p>
                      <p className="text-[13px] text-[#161c27] font-semibold">¥420,000</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">净值</p>
                      <p className="text-[13px] text-[#004191] font-semibold">¥120,000</p>
                    </div>
                    <div className="col-span-2 mt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dcfce7] text-[#16a34a] border border-[#16a34a]/10 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                        运行中
                      </span>
                    </div>
                  </div>
                </div>
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

        <section className="col-span-12 lg:col-span-5 flex flex-col gap-3">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#004191]" />
                  退役信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Input
                  label="资产 ID *"
                  type="number"
                  placeholder="输入需要退役的资产 ID"
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

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#64748b] uppercase tracking-wider block font-semibold">
                    预计残值
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    prefix={<span className="text-[#004191] font-semibold">¥</span>}
                    error={errors.residualValue?.message}
                    {...register('residualValue')}
                  />
                  <p className="text-[11px] text-[#64748b] italic">
                    基于净值的建议残值：¥120,000
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#64748b] uppercase tracking-wider block font-semibold">
                    备注说明
                  </label>
                  <textarea
                    rows={3}
                    placeholder="可选的内部备注"
                    className="w-full p-4 bg-[#f1f3ff] border-none rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/20 transition-all outline-none resize-none placeholder:text-[#94a3b8]"
                    {...register('notes')}
                  />
                </div>

                <div className="p-4 bg-[#dbeafe] rounded-lg flex gap-3 border border-[#2563eb]/10">
                  <Info className="w-4 h-4 text-[#2563eb] flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#2563eb]">
                    提交此申请将启动多级审批流程，涉及部门负责人和财务总监。
                  </p>
                </div>
              </CardContent>
            </Card>

            {mutation.isError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {(mutation.error instanceof Error ? mutation.error.message : '提交失败，请重试')}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                取消
              </Button>
              <Button type="submit" loading={isSubmitting || mutation.isPending}>
                <Send className="w-4 h-4" />
                提交申请
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
