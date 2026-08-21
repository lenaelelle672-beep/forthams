/**
 * @file pages/spare-parts/SparePartDetailPage.tsx
 * @description 备品备件详情页面
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, AlertTriangle, Package, ClipboardList, Save, ShieldCheck, Truck } from 'lucide-react';
import { message } from 'antd';
import { createSparePart, getSparePartDetail, getUsageBySparePart } from '@/api/sparePart';
import type { SparePart, SparePartUsage, CreateSparePartRequest } from '@/types/sparePart';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

type WorkbenchSparePrefill = {
  source: string;
  sourceLabel: string;
  partNo: string;
  partName: string;
  specification: string;
  unit: string;
  currentStock: number;
  safetyStock: number;
  unitPrice?: number;
  relatedWorkOrder: string;
  assetName: string;
  supplier: string;
  arrivalDate: string;
  note: string;
};

const SPARE_SOURCE_LABELS: Record<string, string> = {
  'spare-request': '固定资产工作台 / 备件申请',
};

const getSearchValue = (params: URLSearchParams, key: string, fallback = '') =>
  params.get(key)?.trim() || fallback;

const parseNumber = (value?: string | null) => {
  if (value == null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getWorkbenchSparePrefill = (params: URLSearchParams): WorkbenchSparePrefill | null => {
  const source = getSearchValue(params, 'source');

  if (!source) {
    return null;
  }

  return {
    source,
    sourceLabel: SPARE_SOURCE_LABELS[source] ?? '工作台带入',
    partNo: getSearchValue(params, 'partNo', 'SP-TEMP-201'),
    partName: getSearchValue(params, 'partName', '温控模块传感器'),
    specification: getSearchValue(params, 'specification', 'PT100-M201 / 0-120°C'),
    unit: getSearchValue(params, 'unit', '件'),
    currentStock: parseNumber(params.get('currentStock')) ?? 0,
    safetyStock: parseNumber(params.get('safetyStock')) ?? 0,
    unitPrice: parseNumber(params.get('unitPrice')),
    relatedWorkOrder: getSearchValue(params, 'relatedWorkOrder', 'WO-20250612001'),
    assetName: getSearchValue(params, 'assetName', '注塑机 M-201'),
    supplier: getSearchValue(params, 'supplier', 'UNIVIEW 备件仓'),
    arrivalDate: getSearchValue(params, 'arrivalDate', '2026-06-18'),
    note: getSearchValue(params, 'note', '来自固定资产工作台：低储备件已关联预测维保工单，建议优先本仓调拨。'),
  };
};

const buildCreateForm = (prefill: WorkbenchSparePrefill | null): CreateSparePartRequest => ({
  partNo: prefill?.partNo ?? '',
  partName: prefill?.partName ?? '',
  specification: prefill?.specification ?? '',
  unit: prefill?.unit ?? '件',
  currentStock: prefill?.currentStock ?? 0,
  safetyStock: prefill?.safetyStock ?? 0,
  unitPrice: prefill?.unitPrice,
});

export default function SparePartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isCreateMode = id === 'new' || location.pathname.endsWith('/spare-parts/new');
  const sparePartId = isCreateMode ? undefined : Number(id);
  const canLoadDetail = !isCreateMode && Number.isFinite(sparePartId) && Number(sparePartId) > 0;
  const workbenchSparePrefill = useMemo(() => getWorkbenchSparePrefill(searchParams), [searchParams]);
  const [form, setForm] = useState<CreateSparePartRequest>(() => buildCreateForm(workbenchSparePrefill));

  useEffect(() => {
    if (isCreateMode) {
      setForm(buildCreateForm(workbenchSparePrefill));
    }
  }, [isCreateMode, workbenchSparePrefill]);

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['spare-part', sparePartId],
    queryFn: () => getSparePartDetail(sparePartId!),
    enabled: canLoadDetail,
  });

  const { data: usageRes } = useQuery({
    queryKey: ['spare-part', sparePartId, 'usages'],
    queryFn: () => getUsageBySparePart(sparePartId!),
    enabled: canLoadDetail,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateSparePartRequest) => createSparePart(payload),
    onSuccess: (created) => {
      message.success('备件申请已创建');
      navigate(`/spare-parts/${created.id}`);
    },
    onError: () => {
      message.error('备件申请提交失败，请稍后重试');
    },
  });

  const sparePart: SparePart | undefined = detailRes;
  const usages: SparePartUsage[] = Array.isArray(usageRes)
    ? usageRes
    : Array.isArray((usageRes as { records?: SparePartUsage[] } | undefined)?.records)
      ? (usageRes as { records: SparePartUsage[] }).records
      : [];

  const updateForm = <K extends keyof CreateSparePartRequest>(key: K, value: CreateSparePartRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateNumberForm = (key: 'currentStock' | 'safetyStock' | 'unitPrice', value: string) => {
    updateForm(key, value === '' ? undefined : Number(value));
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.partNo.trim() || !form.partName.trim() || !form.unit.trim()) {
      message.warning('请补全备件编码、名称和单位');
      return;
    }

    createMutation.mutate({
      ...form,
      currentStock: form.currentStock ?? 0,
      safetyStock: form.safetyStock ?? 0,
      unitPrice: form.unitPrice || undefined,
    });
  };

  if (isCreateMode) {
    const currentStock = Number(form.currentStock ?? 0);
    const safetyStock = Number(form.safetyStock ?? 0);
    const stockGap = Math.max(safetyStock - currentStock, 0);

    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="备件申请"
          description="按维保工单、库存下限和供应商交期创建备件保障记录"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> 返回
              </Button>
            </div>
          }
        />

        {workbenchSparePrefill && (
          <Card
            data-testid="workbench-spare-prefill"
            className="border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50"
          >
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {workbenchSparePrefill.sourceLabel}
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">{workbenchSparePrefill.partName}</h2>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600">{workbenchSparePrefill.note}</p>
                </div>
                <div className="grid min-w-[280px] grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="text-xs text-slate-400">关联工单</div>
                    <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill.relatedWorkOrder}</div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="text-xs text-slate-400">关联资产</div>
                    <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill.assetName}</div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="text-xs text-slate-400">供应来源</div>
                    <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill.supplier}</div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="text-xs text-slate-400">预计到货</div>
                    <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill.arrivalDate}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{currentStock}</div>
                <div className="text-xs text-gray-400">当前库存 ({form.unit || '件'})</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{safetyStock}</div>
                <div className="text-xs text-gray-400">安全库存 ({form.unit || '件'})</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{stockGap}</div>
                <div className="text-xs text-gray-400">建议补足缺口</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Truck className="w-8 h-8 text-cyan-500" />
              <div>
                <div className="text-lg font-bold">{workbenchSparePrefill?.arrivalDate ?? '待确认'}</div>
                <div className="text-xs text-gray-400">预计到货时间</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>申请信息</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Input
                  label="备件编码"
                  required
                  value={form.partNo}
                  onChange={(event) => updateForm('partNo', event.target.value)}
                  placeholder="请输入备件编码"
                />
                <Input
                  label="备件名称"
                  required
                  value={form.partName}
                  onChange={(event) => updateForm('partName', event.target.value)}
                  placeholder="请输入备件名称"
                />
                <Input
                  label="规格型号"
                  value={form.specification ?? ''}
                  onChange={(event) => updateForm('specification', event.target.value)}
                  placeholder="请输入规格型号"
                />
                <Input
                  label="计量单位"
                  required
                  value={form.unit}
                  onChange={(event) => updateForm('unit', event.target.value)}
                  placeholder="件"
                />
                <Input
                  label="当前库存"
                  type="number"
                  min="0"
                  value={form.currentStock ?? ''}
                  onChange={(event) => updateNumberForm('currentStock', event.target.value)}
                />
                <Input
                  label="安全库存"
                  type="number"
                  min="0"
                  value={form.safetyStock ?? ''}
                  onChange={(event) => updateNumberForm('safetyStock', event.target.value)}
                />
                <Input
                  label="单价"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice ?? ''}
                  onChange={(event) => updateNumberForm('unitPrice', event.target.value)}
                  prefix="¥"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-400">关联工单</div>
                  <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill?.relatedWorkOrder ?? '待选择'}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-400">关联资产</div>
                  <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill?.assetName ?? '待选择'}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-400">供应来源</div>
                  <div className="mt-1 font-semibold text-slate-900">{workbenchSparePrefill?.supplier ?? '待确认'}</div>
                </div>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[#374151]">
                申请说明
                <textarea
                  className="min-h-[96px] rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none transition-all placeholder:text-[#94a3b8] focus:border-[#3b82f6] focus:ring-2 focus:ring-blue-200"
                  value={workbenchSparePrefill?.note ?? ''}
                  readOnly
                />
              </label>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/spare-parts')}>
                  取消
                </Button>
                <Button type="submit" loading={createMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" /> 提交申请
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  if (!sparePart) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">备件不存在</div>;
  }

  const isLowStock = sparePart.currentStock < sparePart.safetyStock;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={sparePart.partName}
        description={`编码: ${sparePart.partNo}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> 返回
            </Button>
            <Button onClick={() => navigate(`/spare-parts/${sparePartId}/edit`)} className="gap-2">
              <Edit className="w-4 h-4" /> 编辑
            </Button>
          </div>
        }
      />

      {/* 库存概况 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{sparePart.currentStock}</div>
              <div className="text-xs text-gray-400">当前库存 ({sparePart.unit})</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{sparePart.safetyStock}</div>
              <div className="text-xs text-gray-400">安全库存 ({sparePart.unit})</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={`p-4 flex items-center gap-3 ${isLowStock ? 'bg-red-50' : ''}`}>
            <AlertTriangle className={`w-8 h-8 ${isLowStock ? 'text-red-500' : 'text-green-500'}`} />
            <div>
              <div className={`text-lg font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                {isLowStock ? `缺货 ${(sparePart.safetyStock - sparePart.currentStock).toFixed(2)}` : '库存正常'}
              </div>
              <div className="text-xs text-gray-400">库存状态</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">备件编码：</span>{sparePart.partNo}</div>
            <div><span className="text-gray-400">规格型号：</span>{sparePart.specification || '-'}</div>
            <div><span className="text-gray-400">计量单位：</span>{sparePart.unit}</div>
            <div><span className="text-gray-400">单价：</span>{sparePart.unitPrice ? `¥${sparePart.unitPrice}` : '-'}</div>
            <div><span className="text-gray-400">状态：</span>
              <Badge variant={sparePart.status === 'ENABLED' ? 'success' : 'gray'}>
                {sparePart.status === 'ENABLED' ? '启用' : '停用'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 领用记录 */}
      <Card>
        <CardHeader><CardTitle>领用记录</CardTitle></CardHeader>
        <CardContent>
          {usages.length > 0 ? (
            <div className="space-y-2">
              {usages.map((usage: SparePartUsage) => (
                <div key={usage.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="text-sm">
                    <span className="font-medium">工单 #{usage.workOrderId}</span>
                    <span className="text-gray-400 ml-2">{usage.usageDate ? new Date(usage.usageDate).toLocaleString('zh-CN') : '-'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 font-medium">-{usage.quantity}</span>
                    {usage.note && <span className="text-xs text-gray-400">{usage.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">暂无领用记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
