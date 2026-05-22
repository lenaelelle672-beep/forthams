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
import { createCompensation } from '@/api/disposal';
import { getDeptList } from '@/api/base';
import type { AssetListItem } from '@/types/asset';
import type { ApiResponse, PageData, Department } from '@/types/common';
import { toast } from 'sonner';

const schema = z.object({
  applyDate: z.string().min(1, '请选择申请日期'),
  damageType: z.string().min(1, '请选择损坏类型'),
  damageDesc: z.string().min(10, '损坏描述至少 10 个字').max(500),
  damageDate: z.string().min(1, '请选择损坏日期'),
  responsiblePerson: z.string().min(1, '请输入责任人').max(50),
  responsibleDept: z.string().min(1, '请选择责任部门'),
  discoverer: z.string().max(50).optional(),
  insured: z.enum(['yes', 'no']),
  compensationType: z.enum(['cash', 'equivalent', 'repair']),
  approvalProcess: z.string().min(1, '请选择审批流程'),
  remark: z.string().max(500).optional(),
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

/** Map an API AssetListItem to the local AssetRow used in the table */
function toAssetRow(a: AssetListItem): AssetRow {
  return {
    id: String(a.id),
    assetNo: a.assetNo ?? '',
    assetName: a.assetName ?? '',
    category: a.categoryName ?? '',
    originalValue: a.originalValue ?? 0,
    damageLevel: 'medium',
    compensationAmount: 0,
  };
}

export default function AssetCompensationFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assetData, setAssetData] = useState<AssetRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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
  const deptOptions: { value: string; label: string }[] = (
    (deptRes as ApiResponse<Department[]> | undefined)?.data ?? []
  ).map((d) => ({ value: String(d.id), label: d.deptName }));

  // Derive the full asset list from API response
  const apiAssets: AssetRow[] = useMemo(
    () => ((assetListData as ApiResponse<PageData<AssetListItem>> | undefined)?.data?.records ?? []).map(toAssetRow),
    [assetListData],
  );

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
    }
  };

  const updateAsset = (id: string, field: keyof AssetRow, value: string | number) => {
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
    mutationFn: async (data: FormValues & { assets: AssetRow[]; totalCompensation: number }) => {
      // Submit each selected asset as a compensation request via the approval flow
      const results = await Promise.all(
        data.assets.map((asset) =>
          createCompensation({
            assetId: Number(asset.id),
            compensationType: data.compensationType,
            compensationAmount: asset.compensationAmount,
            description: data.damageDesc,
            incidentDate: data.damageDate,
          }),
        ),
      );
      return results;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compensation'] });
      navigate('/disposals');
    },
    onError: () => toast.error('提交失败，请重试'),
  });

  const onSubmit = (values: FormValues) => {
    const selectedAssets = displayAssets.filter((a) => selectedIds.has(a.id));
    mutation.mutate({
      ...values,
      assets: selectedAssets,
      totalCompensation,
    });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-8">
      <PageHeader
        title="资产赔偿申请"
        breadcrumbs={[
          { label: '资产处置', href: '/disposal' },
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

        {/* Section 2: Damage Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 border-l-4 border-[#2563eb] pl-3">
              损坏详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
              <div className="md:col-span-3 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#434655]">损坏描述 *</label>
                <textarea
                  rows={3}
                  placeholder="请详细描述资产损坏情况及发生经过..."
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white transition-all placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6] resize-none ${
                    errors.damageDesc ? 'border-red-300' : 'border-[#e2e8f0]'
                  }`}
                  {...register('damageDesc')}
                />
                {errors.damageDesc && (
                  <p className="text-xs text-red-500">{errors.damageDesc.message}</p>
                )}
              </div>
              <Input label="损坏日期" type="date" error={errors.damageDate?.message} {...register('damageDate')} />
              <Input label="责任人" placeholder="输入姓名" error={errors.responsiblePerson?.message} {...register('responsiblePerson')} />
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
                        type="text"
                        className="w-32 border-[#e2e8f0] rounded text-sm text-right py-1 px-2 focus:ring-1 focus:ring-[#2563eb] outline-none"
                        value={formatCurrency(asset.compensationAmount)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.]/g, '');
                          const num = parseFloat(raw) || 0;
                          updateAsset(asset.id, 'compensationAmount', num);
                        }}
                      />
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
                <label className="text-sm font-medium text-[#434655]">总赔偿金额 (¥)</label>
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(totalCompensation)}
                  className="w-full bg-[#f3f3fe] font-bold text-[#004ac6] border-[#e2e8f0] rounded-lg text-sm py-2 px-3 focus:ring-0 cursor-not-allowed"
                />
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

        {/* Footer Actions */}
        <div className="mt-12 flex justify-end items-center gap-4 py-6 border-t border-[#e2e8f0]">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            取消
          </Button>
           <Button type="button" variant="outline" onClick={() => navigate('/disposals')}>
             保存草稿
           </Button>
          <Button type="submit" variant="primary" loading={isSubmitting || mutation.isPending}>
            提交申请
          </Button>
        </div>
      </form>
    </div>
  );
}
