import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Search, Trash2, Info, Package, GitBranch, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';

const schema = z.object({
  transferType: z.string().min(1, '请选择调拨类型'),
  fromDept: z.string().min(1, '请选择调出部门'),
  toDept: z.string().min(1, '请选择调入部门'),
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  workflow: z.string().min(1, '请选择审批流程'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SelectedAsset {
  id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  statusColor: string;
}

const MOCK_SELECTED_ASSETS: SelectedAsset[] = [
  { id: 'AST-99042', name: '精密车床 X1', category: '工业加工', location: 'Bay B-12', status: '在用', statusColor: 'bg-blue-50 text-blue-600' },
  { id: 'AST-008122', name: '服务器集群 B-12', category: 'IT基础设施', location: 'Floor 2', status: '运行中', statusColor: 'bg-blue-50 text-blue-700' },
];

const STEPS = [
  { num: 1, title: '基本信息', subtitle: '基础信息填写' },
  { num: 2, title: '选择资产', subtitle: '选择调拨资产' },
  { num: 3, title: '审批配置', subtitle: '流程配置' },
  { num: 4, title: '完成', subtitle: '提交状态' },
];

const PRIORITY_LABELS: Record<string, string> = {
  LOW: '低',
  NORMAL: '普通',
  HIGH: '高',
};

export default function AssetTransferFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>(MOCK_SELECTED_ASSETS);
  const [assetSearch, setAssetSearch] = useState('');
  const [draftSavedAt] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  const {
    register, handleSubmit, control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transferType: 'INTERNAL',
      fromDept: 'MANUFACTURING',
      toDept: 'RD_CENTER',
      workflow: 'STANDARD_V2',
      priority: 'NORMAL',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      setCurrentStep(3);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const removeAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  return (
    <div className="p-6 pb-28 space-y-6">
      <PageHeader
        title="资产调拨申请"
        subtitle="发起部门或位置之间的正式资产调拨申请。"
        breadcrumbs={[
          { label: '资产管理', href: '/assets' },
          { label: '调拨申请', href: '/disposals' },
          { label: '新建' },
        ]}
        actions={
          <Button variant="ghost" size="md" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
        }
      />

      <div className="bg-white border border-[#e5e7eb] rounded-xl p-6 flex justify-between items-center">
        {STEPS.map((step, idx) => (
          <div key={step.num} className="flex items-center flex-1">
            <div className={`flex items-center gap-3 ${idx > currentStep ? 'opacity-40' : ''}`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx < currentStep
                    ? 'bg-green-500 text-white'
                    : idx === currentStep
                      ? 'bg-[#3b82f6] text-white'
                      : 'bg-[#f1f5f9] text-[#64748b]'
                }`}
              >
                {idx < currentStep ? <CheckCircle className="w-5 h-5" /> : step.num}
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${idx === currentStep ? 'text-[#3b82f6]' : 'text-[#374151]'}`}>
                  {step.title}
                </span>
                <span className="text-xs text-[#94a3b8]">{step.subtitle}</span>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 mx-4">
                <div className="h-px bg-[#e5e7eb]" />
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#3b82f6]" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <Input label="调拨编号" value="ATR-20231027-001" readOnly className="bg-[#f8fafc] cursor-not-allowed text-[#94a3b8]" />
              <Input label="申请人" value="Admin" readOnly className="bg-[#f8fafc] cursor-not-allowed text-[#94a3b8]" />
              <Input label="调拨日期" value={new Date().toISOString().split('T')[0]} readOnly className="bg-[#f8fafc] cursor-not-allowed text-[#94a3b8]" />
              <Controller
                name="transferType"
                control={control}
                render={({ field }) => (
                  <Select label="调拨类型" value={field.value} onValueChange={field.onChange} error={errors.transferType?.message}>
                    <SelectItem value="INTERNAL">内部调拨</SelectItem>
                    <SelectItem value="EXTERNAL">外部调拨</SelectItem>
                  </Select>
                )}
              />
              <Controller
                name="fromDept"
                control={control}
                render={({ field }) => (
                  <Select label="调出部门" value={field.value} onValueChange={field.onChange} error={errors.fromDept?.message}>
                    <SelectItem value="MANUFACTURING">制造部</SelectItem>
                    <SelectItem value="IT_SERVICES">IT服务部</SelectItem>
                    <SelectItem value="OPERATIONS">运营部</SelectItem>
                  </Select>
                )}
              />
              <Controller
                name="toDept"
                control={control}
                render={({ field }) => (
                  <Select label="调入部门" value={field.value} onValueChange={field.onChange} error={errors.toDept?.message}>
                    <SelectItem value="RD_CENTER">研发中心</SelectItem>
                    <SelectItem value="MAINTENANCE">维修中心</SelectItem>
                    <SelectItem value="LOGISTICS">物流部</SelectItem>
                  </Select>
                )}
              />
              <Input label="调出位置" placeholder="例如：仓库A，货架4" error={errors.fromLocation?.message} {...register('fromLocation')} />
              <Input label="调入位置" placeholder="例如：工厂B，1层" error={errors.toLocation?.message} {...register('toLocation')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#3b82f6]" />
              资产选择
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  className="h-8 w-64 border border-[#e5e7eb] rounded-lg pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]"
                  placeholder="搜索资产..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                />
              </div>
              <Button type="button" size="sm" variant="primary">
                <Plus className="w-4 h-4" />
                添加资产
              </Button>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e5e7eb]">
                  <th className="px-5 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">资产编号</th>
                  <th className="px-5 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">名称</th>
                  <th className="px-5 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">分类</th>
                  <th className="px-5 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">原始位置</th>
                  <th className="px-5 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider">状态</th>
                  <th className="px-5 py-2 text-xs font-medium text-[#64748b] uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {selectedAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3 text-sm text-[#3b82f6] font-medium">{asset.id}</td>
                    <td className="px-5 py-3 text-sm text-[#374151]">{asset.name}</td>
                    <td className="px-5 py-3 text-sm text-[#64748b]">{asset.category}</td>
                    <td className="px-5 py-3 text-sm text-[#64748b]">{asset.location}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${asset.statusColor}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => removeAsset(asset.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {selectedAssets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#94a3b8]">
                      暂无已选资产，点击"添加资产"搜索并添加。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#3b82f6]" />
              审批配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-8">
              <Controller
                name="workflow"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      label="审批流程"
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.workflow?.message}
                    >
                      <SelectItem value="STANDARD_V2">标准资产调拨流程 v2.1</SelectItem>
                      <SelectItem value="FAST_TRACK">快速审批通道</SelectItem>
                      <SelectItem value="CROSS_ENTITY">跨实体调拨流程</SelectItem>
                    </Select>
                    <p className="text-xs text-[#94a3b8]">选择此申请类型的预定义审批流程。</p>
                  </div>
                )}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">紧急程度</label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-6 h-9">
                      {(['LOW', 'NORMAL', 'HIGH'] as const).map((p) => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="priority"
                            value={p}
                            checked={field.value === p}
                            onChange={() => field.onChange(p)}
                            className="w-4 h-4 text-[#3b82f6] focus:ring-[#3b82f6] border-[#e5e7eb]"
                          />
                          <span className="text-sm text-[#374151] group-hover:text-[#3b82f6] transition-colors">
                            {PRIORITY_LABELS[p]}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">备注</label>
              <textarea
                rows={4}
                placeholder="请输入调拨的具体说明或原因..."
                className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none placeholder:text-[#94a3b8]"
                {...register('notes')}
              />
            </div>
          </CardContent>
        </Card>

        {mutation.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {(mutation.error as any)?.response?.data?.message ?? '提交失败，请重试'}
          </div>
        )}
      </form>

      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-[#e5e7eb] z-50 flex items-center justify-between px-10 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <CheckCircle className="w-4 h-4" />
          草稿已于 {draftSavedAt} 自动保存
        </div>
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            取消
          </Button>
          <Button type="button" variant="outline" className="border-[#3b82f6] text-[#3b82f6] hover:bg-blue-50">
            保存草稿
          </Button>
          <Button
            type="button"
            loading={isSubmitting || mutation.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            提交申请
          </Button>
        </div>
      </footer>
    </div>
  );
}
