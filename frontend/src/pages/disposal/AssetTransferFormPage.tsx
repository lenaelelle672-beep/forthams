import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Info, Package, GitBranch, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { getAssetList } from '@/api/asset';
import { submitTransferApplication } from '@/api/disposal';
import { getDeptTree, getLocationCascade } from '@/api/base';
import AssetPickerModal from '@/components/AssetPickerModal';
import type { AssetListItem } from '@/types/asset';
import type { Department, Location, PageData } from '@/types/common';

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
  const [draftSavedAt] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Fetch available assets from real API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const availableAssets: AssetListItem[] = (assetListData as PageData<AssetListItem> | undefined)?.records ?? [];

  // Fetch department tree
  const { data: deptData } = useQuery({
    queryKey: ['depts', 'tree'],
    queryFn: () => getDeptTree(),
  });
  const deptOptions = useMemo(
    () => flattenTree<Department>((deptData as Department[] | undefined) ?? [], 'deptName'),
    [deptData],
  );

  // Fetch location cascade
  const { data: locationData } = useQuery({
    queryKey: ['locations', 'cascade'],
    queryFn: () => getLocationCascade(),
  });
  const locationOptions = useMemo(
    () => flattenTree<Location>((locationData as Location[] | undefined) ?? [], 'name'),
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
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : '提交失败，请重试');
    },
  });

  /** Submit handler — validates form and asset selection before mutation */
  const onSubmit = (values: FormValues) => {
    if (selectedAssets.length === 0) {
      toast.error('请至少选择一项资产');
      return;
    }
    mutation.mutate(values);
  };

  /** Remove a single asset from the selected list */
  const removeAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  /** Add asset from picker into selected list */
  const addAsset = (ids: Set<string>) => {
    const newAssets = availableAssets.filter((a) => ids.has(String(a.id)));
    setSelectedAssets(
      newAssets.map((a) => ({
        id: String(a.id),
        assetNo: a.assetNo ?? '',
        name: a.assetName ?? '',
        category: a.categoryName ?? '',
        location: a.location ?? '',
        status: a.status ?? '',
      })),
    );
  };

  return (
    <div className="p-4 sm:p-6 pb-28 space-y-6">
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

      {/* ── Step Indicator ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 sm:p-6 overflow-x-auto">
        <div className="flex justify-between items-center min-w-[480px]">
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
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Card 1: 基本信息 ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#3b82f6]" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Sub-group A: 单据信息 */}
            <div>
              <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">单据信息</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
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
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-[#e5e7eb]" />

            {/* Sub-group B: 调拨方向 — from / to panels */}
            <div>
              <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">调拨方向</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 转出面板 */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">出</span>
                    转出方
                  </div>
                  <Controller
                    name="fromDept"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-1">
                        <Select label="调出部门" value={field.value} onValueChange={field.onChange} error={errors.fromDept?.message}>
                          {deptOptions.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {'　'.repeat(d.depth)}{d.label}
                            </SelectItem>
                          ))}
                        </Select>
                        <p className="text-[11px] text-amber-600">必填 · 资产当前所属部门</p>
                      </div>
                    )}
                  />
                  <Controller
                    name="fromLocation"
                    control={control}
                    render={({ field }) => (
                      <Select label="调出位置" value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? undefined : v)} error={errors.fromLocation?.message}>
                        <SelectItem value="__none__">不限</SelectItem>
                        {locationOptions.map((loc) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {'　'.repeat(loc.depth)}{loc.label}
                          </SelectItem>
                        ))}
                      </Select>
                    )}
                  />
                </div>

                {/* 转入面板 */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold">入</span>
                    转入方
                  </div>
                  <Controller
                    name="toDept"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-1">
                        <Select label="调入部门" value={field.value} onValueChange={field.onChange} error={errors.toDept?.message}>
                          {deptOptions.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {'　'.repeat(d.depth)}{d.label}
                            </SelectItem>
                          ))}
                        </Select>
                        <p className="text-[11px] text-emerald-600">必填 · 资产调拨目标部门</p>
                      </div>
                    )}
                  />
                  <Controller
                    name="toLocation"
                    control={control}
                    render={({ field }) => (
                      <Select label="调入位置" value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? undefined : v)} error={errors.toLocation?.message}>
                        <SelectItem value="__none__">不限</SelectItem>
                        {locationOptions.map((loc) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {'　'.repeat(loc.depth)}{loc.label}
                          </SelectItem>
                        ))}
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Card 2: 资产选择 ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#3b82f6]" />
              资产选择
              <span className="text-xs text-red-500 font-normal ml-1">* 必填</span>
            </CardTitle>
            <div className="flex items-center gap-3">
              <Button type="button" size="sm" onClick={() => setShowAssetPicker(true)}>
                <Plus className="w-4 h-4" /> 添加资产
              </Button>
              <span className="text-sm text-gray-500 whitespace-nowrap">已选 {selectedAssets.length} 项</span>
            </div>
          </CardHeader>
          {selectedAssets.length > 0 ? (
            <div className="px-4 sm:px-6 pb-6 overflow-x-auto">
              {/* Desktop table view */}
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] text-left text-[#64748b]">
                    <th className="pb-2 font-medium">资产编号</th>
                    <th className="pb-2 font-medium">名称</th>
                    <th className="pb-2 font-medium">类别</th>
                    <th className="pb-2 font-medium">位置</th>
                    <th className="pb-2 font-medium">状态</th>
                    <th className="pb-2 font-medium w-16">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-[#f1f5f9]">
                      <td className="py-2 text-[#3b82f6] font-mono text-xs">{asset.assetNo}</td>
                      <td className="py-2 text-[#374151]">{asset.name}</td>
                      <td className="py-2 text-[#64748b]">{asset.category}</td>
                      <td className="py-2 text-[#64748b]">{asset.location}</td>
                      <td className="py-2">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">{asset.status}</span>
                      </td>
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
                      <div className="text-xs text-[#94a3b8] mt-0.5">{asset.assetNo} · {asset.category}</div>
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
                暂无已选资产，点击上方「添加资产」按钮选择需要调拨的资产。
              </div>
            </div>
          )}
        </Card>

        {/* ── Card 3: 审批配置 ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#3b82f6]" />
              审批配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* 审批流程 */}
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
                    <p className="text-xs text-[#94a3b8]">选择此申请类型的预定义审批流程。标准流程需部门经理 → 资产管理员二级审批。</p>
                  </div>
                )}
              />

              {/* 紧急程度 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">紧急程度</label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center gap-6 h-9 flex-wrap">
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
                          <span className={`text-sm transition-colors ${
                            field.value === p ? 'text-[#3b82f6] font-semibold' : 'text-[#374151]'
                          } group-hover:text-[#3b82f6]`}>
                            {PRIORITY_LABELS[p]}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
                <p className="text-xs text-[#94a3b8]">高优先级申请将跳过非关键审批节点，加速流转。</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#f1f5f9]" />

            {/* 备注 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#374151]">
                备注
                <span className="text-xs text-[#94a3b8] font-normal ml-2">（选填）</span>
              </label>
              <textarea
                rows={4}
                placeholder="请输入调拨的具体说明或原因..."
                className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none placeholder:text-[#94a3b8]"
                {...register('notes')}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Error display ────────────────────────────────────────── */}
        {mutation.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {(mutation.error instanceof Error ? mutation.error.message : '提交失败，请重试')}
          </div>
        )}
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
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)} className="hidden sm:inline-flex">
              取消
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#3b82f6] text-[#3b82f6] hover:bg-blue-50 hidden sm:inline-flex"
              onClick={() => navigate('/disposals')}
            >
              保存草稿
            </Button>
            <Button
              type="button"
              size="sm"
              loading={isSubmitting || mutation.isPending}
              onClick={handleSubmit(onSubmit)}
              className="sm:hidden"
            >
              提交
            </Button>
            <Button
              type="button"
              loading={isSubmitting || mutation.isPending}
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
        selectedIds={selectedAssetIds}
        onSelectionChange={(ids) => {
          addAsset(ids);
        }}
      />
    </div>
  );
}
