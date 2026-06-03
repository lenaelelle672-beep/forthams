import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  ArrowLeft, Edit, Trash2, Info, TrendingDown,
  History, QrCode, Paperclip, GitBranch, BarChart3,
  FileQuestion,
} from 'lucide-react';
import { getAssetById, getDepreciationSchedule, deleteAsset, getAssetChildren, getAssetParent } from '@/api/asset';
import { getAssetTco, getTcoTrend, getTcoCompare } from '@/api/tco';
import { getAssetAuditLogs, type AuditLog } from '@/api/audit';
import { AssetStatus, type Asset } from '@/types/asset';
import type { PageData,  ApiResponse } from '@/types/common';
import type { DepreciationScheduleItem } from '@/types/asset';
import AssetAttachmentUpload from '@/components/asset/AssetAttachmentUpload';
import AssetGallery from '@/components/asset/AssetGallery';
import AttachmentList from '@/components/asset/AttachmentList';
import AssetRelationTree from '@/components/asset/AssetRelationTree';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

function formatCurrency(value: number | undefined | null): string {
  if (value == null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function formatDate(value: string | undefined | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('zh-CN');
  } catch {
    return value;
  }
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => deleteAsset(Number(id!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast.success('资产删除成功');
      navigate('/assets');
    },
    onError: (err: Error) => {
      setDeleteError(err.message || '删除失败');
      setShowDeleteConfirm(false);
    },
  });

  const { data: assetRes, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAssetById(Number(id!)),
    enabled: !!id,
  });

  const asset: Asset | undefined = assetRes as unknown as Asset | undefined;
  const { data: depRes } = useQuery({
    queryKey: ['asset-depreciation', id],
    queryFn: () => getDepreciationSchedule(Number(id!)),
    enabled: !!id,
    select: (res: unknown) =>
      ((res ?? []) as DepreciationScheduleItem[]).map((d) => ({ date: d.periodDate, value: d.endValue })),  });

  const depreciationData = depRes ?? [];

  // 关联资产查询
  const { data: childrenRes } = useQuery({
    queryKey: ['asset-children', id],
    queryFn: () => getAssetChildren(Number(id!)),
    enabled: !!id,
  });
  const children = Array.isArray(childrenRes) ? childrenRes : [];

  const { data: parentRes } = useQuery({
    queryKey: ['asset-parent', id],
    queryFn: () => getAssetParent(Number(id!)),
    enabled: !!id,
  });
  const parentAsset = parentRes && typeof parentRes === 'object' && 'id' in parentRes ? parentRes as Asset : undefined;

  const { data: auditRes } = useQuery({
    queryKey: ['asset-audit-logs', id],
    queryFn: async () => {
      const res = await getAssetAuditLogs(Number(id!), { page: 1, pageSize: 10 });
      return res as unknown as PageData<AuditLog>;    },
    enabled: !!id,
  });

  const auditLogs: AuditLog[] = auditRes?.records ?? [];

  // TCO 数据
  const { data: tcoResult } = useQuery({
    queryKey: ['asset-tco', id],
    queryFn: () => getAssetTco(Number(id!)),
    enabled: !!id,
  });

  const { data: tcoTrend } = useQuery({
    queryKey: ['asset-tco-trend', id],
    queryFn: () => getTcoTrend(Number(id!), 12),
    enabled: !!id,
  });

  const { data: tcoCompare } = useQuery({
    queryKey: ['asset-tco-compare', id],
    queryFn: () => getTcoCompare(Number(asset?.categoryId ?? 0)),
    enabled: !!id && !!asset?.categoryId,
  });

  const TCO_COLORS = ['#004ac6', '#16a34a', '#d97706', '#9333ea', '#dc2626'];
  const TCO_LABELS: Record<string, string> = {
    purchaseCost: '采购成本', maintenanceCost: '维保成本', workOrderCost: '工单成本',
    energyCost: '能耗成本', insuranceCost: '保险成本',
  };

  const pieData = tcoResult
    ? Object.entries(TCO_LABELS)
        .map(([k, name]) => ({ name, value: (tcoResult as any)[k] ?? 0 }))
        .filter(d => d.value > 0)
    : [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <FileQuestion className="w-12 h-12 text-[#94a3b8]" />
        <p className="text-[#64748b]">
          {error instanceof Error ? error.message : '未找到资产信息'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="md" onClick={() => navigate('/assets')}>
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* 头部导航 + 操作按钮区 - 增强视觉层次 */}
      <Card className="shadow-md border-[#e5e7eb] bg-gradient-to-r from-white to-[#f8fafc]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="p-2.5 hover:bg-[#004ac6]/10 rounded-full transition-all duration-200 active:scale-95 border border-transparent hover:border-[#dbe1ff] group"
                onClick={() => navigate('/assets')}
              >
                <ArrowLeft className="w-5 h-5 text-[#475569] group-hover:text-[#004ac6] transition-colors" />
              </button>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">资产详情</h1>
                  <div className="flex items-center gap-2 ml-3">
                    <StatusBadge status={asset.status} size="lg" />
                  </div>
                </div>
                <p className="text-sm text-[#64748b] font-medium">
                  {asset.assetNo ?? '—'} · {asset.assetName ?? '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/assets/${id}/edit`)}
                className="hover:bg-[#004ac6]/5 hover:border-[#dbe1ff] hover:text-[#004ac6] transition-all font-medium shadow-sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                编辑资产
              </Button>
              <Button
                variant="destructive"
                size="md"
                onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
                disabled={deleteMutation.isPending}
                className="bg-[#dc2626] hover:bg-[#b91c1c] transition-all font-medium shadow-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteMutation.isPending ? '删除中...' : '删除资产'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 资产核心信息 + 标签区域 */}
      <Card className="shadow-sm border-[#e5e7eb]">
        <CardContent className="p-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">资产名称</span>
              <span className="text-lg font-bold text-[#0f172a]">{asset.assetName ?? '—'}</span>
              <span className="text-sm text-[#64748b] mt-2">
                资产编号: <span className="text-[#334155] font-semibold">{asset.assetNo ?? '—'}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-4 border-x border-[#e5e7eb] px-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">分类</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.categoryName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">ABC 分类</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  (asset as any).abcClassification === 'A' ? 'bg-red-100 text-red-700' :
                  (asset as any).abcClassification === 'B' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {(asset as any).abcClassification ?? 'C'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">品牌</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.brand ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">型号</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.model ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">序列号</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.serialNo ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase"></span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-3 gap-3">
              <div className="w-full h-28 bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] border-2 border-dashed border-[#cbd5e1] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#94a3b8] transition-all">
                <QrCode className="w-6 h-6 text-[#64748b]" />
                <span className="text-xs font-semibold text-[#475569]">RFID 标签</span>
                <span className="text-xs text-[#94a3b8] font-mono">{asset.rfidTag ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* 资产标签区域 */}
          <div className="mt-6 pt-6 border-t border-[#e5e7eb]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">资产标签</span>
              <div className="flex items-center gap-2 flex-wrap">
                {asset.isImportant === 1 && (
                  <span className="inline-flex items-center gap-1.5 bg-[#dbe1ff] text-[#003ea8] px-3 py-1.5 rounded-full text-xs font-bold border border-[#b4c6ff]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#003ea8]" />
                    重要设备
                  </span>
                )}
                {asset.categoryName && (
                  <span className="inline-flex items-center gap-1.5 bg-[#dcfce7] text-[#166534] px-3 py-1.5 rounded-full text-xs font-bold border border-[#bbf7d0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                    {asset.categoryName}
                  </span>
                )}
                {asset.status === AssetStatus.IN_USE && (
                  <span className="inline-flex items-center gap-1.5 bg-[#fef3c7] text-[#92400e] px-3 py-1.5 rounded-full text-xs font-bold border border-[#fde68a]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#92400e]" />
                    使用中
                  </span>
                )}
                {asset.warrantyPeriod && asset.warrantyPeriod > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-[#fee2e2] text-[#991b1b] px-3 py-1.5 rounded-full text-xs font-bold border border-[#fecaca]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#991b1b]" />
                    保修期 {asset.warrantyPeriod} 个月
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        {/* 基本信息区 */}
        <Card className="col-span-8 shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2 text-[#0f172a]">
                <Info className="w-5 h-5 text-[#004ac6]" />
                基本信息
              </h2>
            </div>
            <div className="grid grid-cols-4 gap-x-6 gap-y-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">原值</span>
                <span className="text-base font-bold text-[#0f172a]">{formatCurrency(asset.originalValue)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">净值</span>
                <span className="text-base font-bold text-[#004ac6]">{formatCurrency(asset.currentValue)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">购置日期</span>
                <span className="text-sm font-semibold text-[#334155]">{formatDate(asset.purchaseDate)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">保修期</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.warrantyPeriod ? `${asset.warrantyPeriod}个月` : '-'}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">折旧率</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.depreciationRate != null ? `${asset.depreciationRate}/月` : '-'}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">使用部门</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.deptName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">使用人</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.userName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">存放位置</span>
                <span className="text-sm font-semibold text-[#334155]">{asset.location ?? '—'}</span>
              </div>
              {asset.remark && (
                <div className="col-span-4 flex flex-col gap-1.5 border-t border-[#e5e7eb] pt-4">
                  <span className="text-xs text-[#64748b] font-medium tracking-wide uppercase">备注</span>
                  <span className="text-sm text-[#334155] leading-relaxed">{asset.remark}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 折旧趋势区 */}
        <Card className="col-span-4 flex flex-col shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6 flex flex-col flex-1">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#0f172a]">
              <TrendingDown className="w-5 h-5 text-[#004ac6]" />
              折旧趋势
            </h2>
            {depreciationData.length > 0 ? (
              <div className="flex-1 relative min-h-[240px]">
                <div className="absolute inset-0 rounded-lg border-2 border-[#dbe1ff] bg-gradient-to-br from-blue-50/30 to-transparent" />
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={depreciationData} margin={{ top: 20, right: 12, left: -12, bottom: 24 }}>
                    <defs>
                      <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#004ac6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#004ac6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="value" stroke="#004ac6" strokeWidth={2.5} fill="url(#depGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-[#e5e7eb]">
                  <p className="text-xs text-[#64748b] font-medium mb-1">当前净值</p>
                  <p className="text-base font-bold text-[#004ac6]">{formatCurrency(asset.currentValue)}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#94a3b8] text-sm min-h-[240px] gap-2">
                <TrendingDown className="w-10 h-10 opacity-30" />
                <span>暂无折旧数据</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TCO 全生命周期成本 */}
        <Card className="col-span-12 shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#0f172a]">
              <BarChart3 className="w-5 h-5 text-[#004ac6]" />
              TCO 全生命周期成本
            </h2>
            {tcoResult ? (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-5">
                  <p className="text-sm font-semibold text-gray-600 mb-2">成本构成</p>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {pieData.map((_, i) => <Cell key={i} fill={TCO_COLORS[i % TCO_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-gray-400 text-sm text-center py-10">暂无成本数据</p>}
                </div>
                <div className="col-span-3">
                  <p className="text-sm font-semibold text-gray-600 mb-2">成本明细</p>
                  <div className="space-y-2">
                    {Object.entries(TCO_LABELS).map(([key, label]) => {
                      const val = (tcoResult as any)[key] ?? 0;
                      return (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-semibold">{formatCurrency(val)}</span>
                        </div>
                      );
                    })}
                    <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between text-sm font-bold">
                      <span className="text-gray-800">TCO 总成本</span>
                      <span className="text-blue-600 text-base">{formatCurrency(tcoResult.totalCost)}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-4">
                  <p className="text-sm font-semibold text-gray-600 mb-2">趋势 (近12个月)</p>
                  {tcoTrend && tcoTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={tcoTrend}>
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} hide />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Line type="monotone" dataKey="totalCost" stroke="#004ac6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-gray-400 text-sm text-center py-8">暂无趋势数据</p>}
                  {tcoCompare && tcoCompare.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-500 mb-1">同类对比 (前5)</p>
                      <div className="text-xs space-y-1">
                        {tcoCompare.slice(0, 5).map((c: any) => (
                          <div key={c.assetId} className="flex justify-between">
                            <span className="text-gray-600 truncate">{c.assetName}</span>
                            <span className="font-mono">{formatCurrency(c.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8] gap-2">
                <BarChart3 className="w-8 h-8 opacity-30" />
                <span className="text-sm">暂无 TCO 数据</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 关联资产 */}
        <Card className="col-span-12 shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#0f172a]">
              <svg className="w-5 h-5 text-[#004ac6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              关联资产
            </h2>
            {/* 父资产信息 */}
            {parentAsset && (
              <div className="mb-4 p-4 bg-[#f8fafc] rounded-lg border border-[#e5e7eb]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-[#64748b] font-medium">父资产</span>
                    <p className="text-sm font-semibold text-[#334155] mt-1">
                      {parentAsset.assetNo} · {parentAsset.assetName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/assets/${parentAsset.id}`)}
                  >
                    查看
                  </Button>
                </div>
              </div>
            )}
            {/* 子资产列表 */}
            {children.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">资产编号</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">资产名称</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">型号</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">位置</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">状态</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-[#64748b]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((child: Asset) => (
                      <tr key={child.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                        <td className="py-2.5 px-3 text-[#334155]">{child.assetNo || '—'}</td>
                        <td className="py-2.5 px-3 font-medium text-[#0f172a]">{child.assetName}</td>
                        <td className="py-2.5 px-3 text-[#64748b]">{child.model || '—'}</td>
                        <td className="py-2.5 px-3 text-[#64748b]">{child.location || '—'}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={child.status} size="sm" /></td>
                        <td className="py-2.5 px-3">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/assets/${child.id}`)}>
                            查看
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8] gap-2">
                <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="text-sm">暂无关联子资产</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 变更记录 Timeline */}
        <Card className="col-span-12 shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 text-[#0f172a]">
              <History className="w-5 h-5 text-[#004ac6]" />
              变更记录 Timeline
            </h2>
            {auditLogs.length > 0 ? (
              <div className="space-y-0">
                {auditLogs.map((log, index) => (
                  <div key={log.id || index} className="flex gap-4">
                    {/* timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 ${index === 0 ? 'bg-[#004ac6] border-[#004ac6]' : 'bg-white border-[#dbe1ff]'}`} />
                      {index < auditLogs.length - 1 && (
                        <div className="w-0.5 flex-1 bg-[#dbe1ff] mt-1" />
                      )}
                    </div>

                    {/* 变更详情 */}
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e5e7eb] hover:border-[#dbe1ff] hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-bold text-[#0f172a]">
                              {log.operatorName || `用户#${log.operatorId}`}
                            </span>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                              index === 0 ? 'bg-[#dbe1ff] text-[#003ea8] border border-[#b4c6ff]' : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {log.operationType}
                            </span>
                          </div>
                          <span className="text-xs text-[#94a3b8] font-medium whitespace-nowrap">{log.createdAt}</span>
                        </div>
                        {log.description && (
                          <p className="text-sm text-[#334155] mb-3 leading-relaxed">{log.description}</p>
                        )}
                        {log.changes && log.changes.length > 0 && (
                          <div className="space-y-2 mt-4 pt-4 border-t border-[#e5e7eb]">
                            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wide">字段变更</span>
                            <div className="grid grid-cols-1 gap-2">
                              {log.changes.map((change, idx) => (
                                <div key={idx} className="bg-white rounded-lg px-3 py-2 border border-[#e5e7eb] flex items-center gap-3 text-xs">
                                  <span className="font-bold text-[#334155] min-w-fit">{change.fieldLabel || change.field}:</span>
                                  <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded border border-red-100">{change.oldValue || '空'}</span>
                                  <span className="text-[#94a3b8]">→</span>
                                  <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-100">{change.newValue || '空'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-[#94a3b8] gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <History className="w-8 h-8 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium">暂无变更记录</p>
                  <p className="text-xs mt-1 opacity-70">资产的变更历史将在此处显示</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 附件区域 — 全宽 */}
        <Card className="col-span-12 shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#0f172a]">
              <Paperclip className="w-5 h-5 text-[#004ac6]" />
              附件
            </h2>
            <AssetAttachmentUpload assetId={Number(id)} readOnly />
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[#64748b] mb-3">图片</h3>
              <AssetGallery assetId={Number(id)} readOnly />
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[#64748b] mb-3">文件</h3>
              <AttachmentList assetId={Number(id)} readOnly />
            </div>
          </CardContent>
        </Card>

        {/* 主附属关系区域 — 全宽 */}
        <Card className="col-span-12 shadow-sm border-[#e5e7eb]">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#0f172a]">
              <GitBranch className="w-5 h-5 text-[#004ac6]" />
              主附属关系
            </h2>
            {id ? <AssetRelationTree assetId={Number(id)} readOnly /> : null}
          </CardContent>
        </Card>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">确认删除资产</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    确定要删除「{asset?.assetName || '此资产'}」吗？此操作不可撤销。
                  </p>
                </div>
              </div>
              {deleteError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
