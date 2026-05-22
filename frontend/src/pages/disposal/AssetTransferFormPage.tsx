import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Search, Trash2, Info, Package, GitBranch, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { getAssetList } from '@/api/asset';
import { submitTransferApplication } from '@/api/disposal';
import { getDeptTree, getLocationCascade } from '@/api/base';
import type { AssetListItem } from '@/types/asset';
import type { Department, Location, ApiResponse, PageData } from '@/types/common';

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
  assetNo: string;
  name: string;
  category: string;
  location: string;
  status: string;
}

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

/** Flatten tree nodes into a flat list for dropdown rendering */
function flattenTree<T extends { children?: T[]; id: number; [key: string]: unknown }>(
  nodes: T[],
  labelKey: string,
  depth = 0,
): Array<{ id: number; label: string; depth: number }> {
  const result: Array<{ id: number; label: string; depth: number }> = [];
  for (const node of nodes) {
    const label = (node as Record<string, unknown>)[labelKey] as string;
    result.push({ id: node.id, label, depth });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, labelKey, depth + 1));
    }
  }
  return result;
}

export default function AssetTransferFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [draftSavedAt] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

  // Fetch available assets from real API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const availableAssets: AssetListItem[] = (assetListData as ApiResponse<PageData<AssetListItem>> | undefined)?.data?.records ?? [];

  // Filter assets by search keyword
  const filteredAssets = useMemo(() => {
    if (!assetSearch.trim()) return availableAssets;
    const kw = assetSearch.toLowerCase();
    return availableAssets.filter(
      (a) =>
        a.assetNo?.toLowerCase().includes(kw) ||
        a.assetName?.toLowerCase().includes(kw) ||
        a.categoryName?.toLowerCase().includes(kw),
    );
  }, [availableAssets, assetSearch]);

  // Fetch department tree
  const { data: deptData } = useQuery({
    queryKey: ['depts', 'tree'],
    queryFn: () => getDeptTree(),
  });
  const deptOptions = useMemo(
    () => flattenTree<Department>((deptData as ApiResponse<Department[]> | undefined)?.data ?? [], 'deptName'),
    [deptData],
  );

  // Fetch location cascade
  const { data: locationData } = useQuery({
    queryKey: ['locations', 'cascade'],
    queryFn: () => getLocationCascade(),
  });
  const locationOptions = useMemo(
    () => flattenTree<Location>((locationData as ApiResponse<Location[]> | undefined)?.data ?? [], 'locationName'),
    [locationData],
  );

  const selectedAssetIds = useMemo(() => new Set(selectedAssets.map((a) => a.id)), [selectedAssets]);

  const {
    register, handleSubmit, control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transferType: 'INTERNAL',
      workflow: 'STANDARD_V2',
      priority: 'NORMAL',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return submitTransferApplication({
        assetIds: selectedAssets.map((a) => a.id),
        transferType: data.transferType,
        fromDept: data.fromDept,
        toDept: data.toDept,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        workflow: data.workflow,
        priority: data.priority,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['disposals'] });
      toast.success('调拨申请提交成功');
      navigate('/disposals');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message ?? '提交失败，请重试');
    },
  });

  const onSubmit = (values: FormValues) => {
    if (selectedAssets.length === 0) {
      toast.error('请至少选择一项资产');
      return;
    }
    mutation.mutate(values);
  };

  const addAsset = (asset: AssetListItem) => {
    if (selectedAssetIds.has(String(asset.id))) return;
    setSelectedAssets((prev) => [
      ...prev,
      {
        id: String(asset.id),
        assetNo: asset.assetNo ?? '',
        name: asset.assetName ?? '',
        category: asset.categoryName ?? '',
        location: asset.location ?? '',
        status: asset.status ?? '',
      },
    ]);
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
              <Input label="申请人" value="系统管理员" readOnly className="bg-[#f8fafc] cursor-not-allowed text-[#94a3b8]" />
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
                    {deptOptions.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {'　'.repeat(d.depth)}{d.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Controller
                name="toDept"
                control={control}
                render={({ field }) => (
                  <Select label="调入部门" value={field.value} onValueChange={field.onChange} error={errors.toDept?.message}>
                    {deptOptions.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {'　'.repeat(d.depth)}{d.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Controller
                name="fromLocation"
                control={control}
                render={({ field }) => (
                  <Select label="调出位置" value={field.value ?? ''} onValueChange={field.onChange} error={errors.fromLocation?.message}>
                    <SelectItem value="">不限</SelectItem>
                    {locationOptions.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {'　'.repeat(loc.depth)}{loc.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
              <Controller
                name="toLocation"
                control={control}
                render={({ field }) => (
                  <Select label="调入位置" value={field.value ?? ''} onValueChange={field.onChange} error={errors.toLocation?.message}>
                    <SelectItem value="">不限</SelectItem>
                    {locationOptions.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {'　'.repeat(loc.depth)}{loc.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
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
            </div>
          </CardHeader>
          {/* Available assets list for selection */}
          {assetSearch.trim() && filteredAssets.length > 0 && (
            <div className="mx-6 border border-[#e5e7eb] rounded-lg max-h-48 overflow-y-auto">
              {filteredAssets
                .filter((a) => !selectedAssetIds.has(String(a.id)))
                .slice(0, 20)
                .map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-[#f8fafc] cursor-pointer border-b border-[#e5e7eb] last:border-b-0"
                    onClick={() => addAsset(asset)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-[#3b82f6] font-medium">{asset.assetNo}</span>
                      <span className="text-sm text-[#374151]">{asset.assetName}</span>
                      <span className="text-xs text-[#64748b]">{asset.categoryName}</span>
                    </div>
                    <Button type="button" size="sm" variant="ghost">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
          {/* Selected assets table */}
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
                    <td className="px-5 py-3 text-sm text-[#3b82f6] font-medium">{asset.assetNo}</td>
                    <td className="px-5 py-3 text-sm text-[#374151]">{asset.name}</td>
                    <td className="px-5 py-3 text-sm text-[#64748b]">{asset.category}</td>
                    <td className="px-5 py-3 text-sm text-[#64748b]">{asset.location}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                        {asset.status ?? '—'}
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
                      暂无已选资产，在上方搜索框中搜索并添加。
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
            {(mutation.error instanceof Error ? mutation.error.message : '提交失败，请重试')}
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
           <Button type="button" variant="outline" className="border-[#3b82f6] text-[#3b82f6] hover:bg-blue-50" onClick={() => navigate('/disposals')}>
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
