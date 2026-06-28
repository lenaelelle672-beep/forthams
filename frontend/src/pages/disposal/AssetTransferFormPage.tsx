import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Info, Package, GitBranch, CheckCircle, Users, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { getAssetList } from '@/api/asset';
import { submitTransferApplication } from '@/api/disposal';
import { workflowApi, type WorkflowStartAvailability } from '@/api/workflow';
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

function toSelectedAsset(asset: AssetListItem): SelectedAsset {
  return {
    id: String(asset.id),
    assetNo: asset.assetNo ?? '',
    name: asset.assetName ?? '',
    category: asset.categoryName ?? '',
    location: asset.location ?? '',
    status: asset.status ?? '',
  };
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

const ASSET_TRANSFER_WORKFLOW = 'ASSET_TRANSFER';
const WORKFLOW_PERMISSION_BLOCKED: WorkflowStartAvailability = {
  businessType: ASSET_TRANSFER_WORKFLOW,
  canStart: false,
  status: 'FORBIDDEN',
  version: 0,
  definitionId: null,
  entryUrl: '/disposals/transfer/new',
  blockReason: '无审批发起权限或资产转移流程不可用',
};

type RuntimeBusinessDataValues = Partial<Record<
  'transferType' | 'fromDept' | 'toDept' | 'fromLocation' | 'toLocation' | 'priority' | 'notes',
  string | undefined
>>;

export function buildAssetTransferRuntimeBusinessData(
  values: RuntimeBusinessDataValues,
  assets: Array<{ id: string | number }>,
) {
  const notes = values.notes ?? '';
  const toDept = values.toDept ?? '';
  const assetIds = assets.map((asset) => String(asset.id));
  return {
    transferType: values.transferType ?? '',
    fromDept: values.fromDept ?? '',
    toDept,
    fromLocation: values.fromLocation ?? '',
    toLocation: values.toLocation ?? '',
    priority: values.priority ?? 'NORMAL',
    notes,
    assetIds,
    assetCount: assetIds.length,
    targetDeptId: toDept,
    reason: notes,
    description: notes,
  };
}

/** Flatten tree nodes into a flat list for dropdown rendering */
function flattenTree<T extends { children?: T[]; id: number; [key: string]: unknown }>(
  nodes: T[],
  labelKey: string,
  depth = 0,
): Array<{ id: number; label: string; depth: number }> {
  const result: Array<{ id: number; label: string; depth: number }> = [];
  for (const node of nodes) {
    const id = Number((node as Record<string, unknown>).id);
    const label = (node as Record<string, unknown>)[labelKey] as string;
    if (Number.isFinite(id)) {
      result.push({ id, label, depth });
    }
    if (node.children?.length) {
      result.push(...flattenTree(node.children, labelKey, depth + 1));
    }
  }
  return result;
}

export default function AssetTransferFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [appliedPreselectKey, setAppliedPreselectKey] = useState<string | null>(null);
  const [draftSavedAt] = useState(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const preselectAssetId = searchParams.get('assetId')?.trim();
  const preselectAssetNo = (searchParams.get('assetNo') ?? searchParams.get('assetCode'))?.trim();
  const preselectKey = preselectAssetId ? `id:${preselectAssetId}` : preselectAssetNo ? `code:${preselectAssetNo}` : '';

  // Fetch available assets from real API
  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const availableAssets: AssetListItem[] = (assetListData as PageData<AssetListItem> | undefined)?.records ?? [];

  useEffect(() => {
    if (!preselectKey || appliedPreselectKey === preselectKey || availableAssets.length === 0) {
      return;
    }

    const matchedAsset = availableAssets.find((asset) => {
      const assetCodes = asset as AssetListItem & { assetCode?: string; code?: string };
      const idMatches = preselectAssetId ? String(asset.id) === preselectAssetId : false;
      const codeMatches = preselectAssetNo
        ? [asset.assetNo, assetCodes.assetCode, assetCodes.code].some((code) => String(code ?? '') === preselectAssetNo)
        : false;
      return idMatches || codeMatches;
    });

    if (matchedAsset) {
      setSelectedAssets((current) => {
        const selected = toSelectedAsset(matchedAsset);
        if (current.some((asset) => asset.id === selected.id)) {
          return current;
        }
        return [...current, selected];
      });
    }

    setAppliedPreselectKey(preselectKey);
  }, [appliedPreselectKey, availableAssets, preselectAssetId, preselectAssetNo, preselectKey]);

  const {
    data: startAvailability,
    isLoading: isStartAvailabilityLoading,
    isError: isStartAvailabilityError,
  } = useQuery({
    queryKey: ['workflow-runtime', 'start-availability', ASSET_TRANSFER_WORKFLOW],
    queryFn: () => workflowApi.getStartAvailability(ASSET_TRANSFER_WORKFLOW),
    retry: false,
  });
  const workflowAvailability = startAvailability ?? (isStartAvailabilityError ? WORKFLOW_PERMISSION_BLOCKED : undefined);
  const workflowCanStart = Boolean(workflowAvailability?.canStart);
  const workflowBlockReason = isStartAvailabilityLoading
    ? '正在校验资产转移流程发布状态'
    : workflowAvailability?.blockReason || (workflowCanStart ? '' : '请先发布资产转移流程后再提交审批');
  const submitBlocked = isStartAvailabilityLoading || !workflowCanStart;

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
      priority: 'NORMAL',
    },
  });
  const [transferType, fromDept, toDept, fromLocation, toLocation, priority, notes] = useWatch({
    control,
    name: ['transferType', 'fromDept', 'toDept', 'fromLocation', 'toLocation', 'priority', 'notes'],
  });
  const runtimePreviewBusinessData = useMemo(
    () => buildAssetTransferRuntimeBusinessData({
      transferType,
      fromDept,
      toDept,
      fromLocation,
      toLocation,
      priority,
      notes,
    }, selectedAssets),
    [transferType, fromDept, toDept, fromLocation, toLocation, priority, notes, selectedAssets],
  );
  const {
    data: assigneePreview,
    isFetching: isAssigneePreviewLoading,
    isError: isAssigneePreviewError,
    error: assigneePreviewError,
    refetch: refetchAssigneePreview,
  } = useQuery({
    queryKey: ['workflow-runtime', 'assignees-preview', ASSET_TRANSFER_WORKFLOW, runtimePreviewBusinessData],
    queryFn: () => workflowApi.previewRuntimeAssignees(ASSET_TRANSFER_WORKFLOW, {
      businessData: runtimePreviewBusinessData,
    }),
    enabled: workflowCanStart,
    retry: false,
  });
  const assigneePreviewReason = !workflowCanStart
    ? workflowBlockReason
    : isAssigneePreviewError
      ? (assigneePreviewError instanceof Error ? assigneePreviewError.message : '处理人预览服务暂不可用')
      : assigneePreview?.reason;
  const shouldHideAssigneeList = !workflowCanStart || isAssigneePreviewError || (assigneePreview != null && !assigneePreview.calculable);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!workflowAvailability?.canStart || workflowAvailability.definitionId == null || workflowAvailability.version == null) {
        throw new Error(workflowBlockReason || '请先发布资产转移流程后再提交审批');
      }
      return submitTransferApplication({
        assetIds: selectedAssets.map((a) => a.id),
        transferType: data.transferType,
        fromDept: data.fromDept,
        toDept: data.toDept,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        expectedWorkflowDefinitionId: workflowAvailability.definitionId,
        expectedWorkflowVersion: workflowAvailability.version,
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
    if (submitBlocked) {
      toast.error(workflowBlockReason);
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
    setSelectedAssets(newAssets.map(toSelectedAsset));
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
                          {deptOptions.map((d, index) => (
                            <SelectItem key={`${d.id}-${d.depth}-${index}`} value={String(d.id)}>
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
                        {locationOptions.map((loc, index) => (
                          <SelectItem key={`${loc.id}-${loc.depth}-${index}`} value={String(loc.id)}>
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
                          {deptOptions.map((d, index) => (
                            <SelectItem key={`${d.id}-${d.depth}-${index}`} value={String(d.id)}>
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
                        {locationOptions.map((loc, index) => (
                          <SelectItem key={`${loc.id}-${loc.depth}-${index}`} value={String(loc.id)}>
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">发布流程</label>
                <div className={`min-h-16 rounded-lg border px-3 py-2 text-sm ${
                  workflowCanStart
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="font-semibold">资产转移流程</span>
                    <span className="font-mono text-xs">
                      {workflowCanStart ? `v${workflowAvailability?.version ?? 0}` : (workflowAvailability?.status ?? 'CHECKING')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 break-words">
                    {workflowCanStart
                      ? `按已发布版本 ${workflowAvailability?.definitionId ?? '-'} / v${workflowAvailability?.version ?? 0} 发起审批`
                      : workflowBlockReason}
                  </p>
                </div>
              </div>

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

            <div
              aria-label="处理人预览面板"
              className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#374151]">
                  <Users className="w-4 h-4 text-[#3b82f6]" />
                  处理人预览
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!workflowCanStart || isAssigneePreviewLoading}
                  loading={isAssigneePreviewLoading}
                  onClick={() => refetchAssigneePreview()}
                >
                  <RefreshCw className="w-4 h-4" />
                  {assigneePreview ? '重新计算处理人' : '计算处理人'}
                </Button>
              </div>

              {isAssigneePreviewLoading && !assigneePreview ? (
                <p className="text-xs text-[#64748b]">正在计算处理人</p>
              ) : null}

              {assigneePreview?.calculable && !isAssigneePreviewError ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-700">已解析处理人</p>
                  <div className="space-y-2">
                    {assigneePreview.nodes.map((node) => {
                      const assigneeCount = node.assigneeCount ?? (Array.isArray(node.assignees) ? node.assignees.length : 0);
                      return (
                        <div
                          key={`${node.stepNo}-${node.nodeId}`}
                          className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-[#374151]"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium">{node.label || node.nodeCode || node.nodeId}</span>
                            <span className="text-[#64748b]">第 {node.stepNo} 步</span>
                          </div>
                          <p className="mt-1 font-semibold text-[#0f766e]">
                            已解析 {assigneeCount} 名候选处理人
                          </p>
                          <p className="mt-1 text-[#64748b]">具体处理人名单已隐藏</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-100 bg-white px-3 py-2 text-xs text-amber-800 space-y-1">
                  <p>{assigneePreviewReason || '处理人暂不可计算'}</p>
                  {assigneePreview?.missingFields?.length ? (
                    <p>缺少字段：{assigneePreview.missingFields.join('、')}</p>
                  ) : null}
                  {shouldHideAssigneeList ? <p>处理人名单已隐藏</p> : null}
                </div>
              )}
            </div>

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
              disabled={submitBlocked}
              loading={isSubmitting || mutation.isPending}
              onClick={handleSubmit(onSubmit)}
              className="sm:hidden"
            >
              提交
            </Button>
            <Button
              type="button"
              disabled={submitBlocked}
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
