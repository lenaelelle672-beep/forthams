import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts';
import {
  ArrowLeft, Edit, Trash2, Info, TrendingDown,
  History, QrCode,
  FileQuestion,
} from 'lucide-react';
import { getAssetById, getDepreciationSchedule, deleteAsset } from '@/api/asset';
import type { Asset } from '@/types/asset';
import type { ApiResponse } from '@/types/common';
import type { DepreciationScheduleItem } from '@/types/asset';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

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

  const asset: Asset | undefined = (assetRes as ApiResponse<Asset> | undefined)?.data;

  const { data: depRes } = useQuery({
    queryKey: ['asset-depreciation', id],
    queryFn: () => getDepreciationSchedule(Number(id!)),
    enabled: !!id,
    select: (res: ApiResponse<DepreciationScheduleItem[]>) =>
      (res.data ?? []).map((d) => ({ date: d.periodDate, value: d.endValue })),
  });

  const depreciationData = depRes ?? [];

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
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="p-2 hover:bg-[#f1f5f9] rounded-full transition-colors active:scale-95"
                onClick={() => navigate('/assets')}
              >
                <ArrowLeft className="w-5 h-5 text-[#0f172a]" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-[#0f172a]">资产详情</h1>
                <StatusBadge status={asset.status} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/assets/${id}/edit`)}
              >
                <Edit className="w-4 h-4" />
                编辑
              </Button>
              <Button
                variant="destructive"
                size="md"
                onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
                {deleteMutation.isPending ? '删除中...' : '删除'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#64748b] font-medium tracking-wide">资产名称</span>
              <span className="text-base font-semibold text-[#0f172a]">{asset.assetName ?? '—'}</span>
              <span className="text-[13px] text-[#64748b] mt-1">
                资产编号: <span className="text-[#0f172a] font-medium">{asset.assetNo ?? '—'}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-4 border-x border-[#e5e7eb]/60 px-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">分类</span>
                <span className="text-sm font-medium text-[#0f172a]">{asset.categoryName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">品牌</span>
                <span className="text-sm font-medium text-[#0f172a]">{asset.brand ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">型号</span>
                <span className="text-sm font-medium text-[#0f172a]">{asset.model ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">序列号</span>
                <span className="text-sm font-medium text-[#0f172a]">{asset.serialNo ?? '—'}</span>
              </div>
            </div>
            <div className="flex items-center justify-center p-2">
              <div className="w-full h-24 bg-[#f3f4f6] border border-dashed border-[#c3c6d7] rounded-lg flex flex-col items-center justify-center gap-1 opacity-60">
                <QrCode className="w-5 h-5 text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b]">RFID: {asset.rfidTag ?? '—'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold flex items-center gap-2 text-[#0f172a]">
                <Info className="w-5 h-5 text-[#004ac6]" />
                基本信息
              </h2>
              {asset.isImportant === 1 && (
                <span className="bg-[#dbe1ff] text-[#003ea8] px-3 py-1 rounded-full text-xs font-medium">重要设备</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-y-8">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">原值</span>
                <span className="text-sm font-semibold text-[#0f172a]">{formatCurrency(asset.originalValue)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">净值</span>
                <span className="text-sm font-semibold text-[#004ac6]">{formatCurrency(asset.currentValue)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">购置日期</span>
                <span className="text-sm text-[#0f172a]">{formatDate(asset.purchaseDate)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">保修期</span>
                <span className="text-sm text-[#0f172a]">{asset.warrantyPeriod ? `${asset.warrantyPeriod}个月` : '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">折旧率</span>
                <span className="text-sm text-[#0f172a]">{asset.depreciationRate != null ? `${asset.depreciationRate}/月` : '-'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">使用部门</span>
                <span className="text-sm text-[#0f172a]">{asset.deptName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">使用人</span>
                <span className="text-sm text-[#0f172a]">{asset.userName ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">存放位置</span>
                <span className="text-sm text-[#0f172a]">{asset.location ?? '—'}</span>
              </div>
              {asset.remark && (
                <div className="col-span-4 flex flex-col gap-1 border-t border-[#e5e7eb]/60 pt-4">
                  <span className="text-xs text-[#64748b] font-medium">备注</span>
                  <span className="text-sm text-[#0f172a]">{asset.remark}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-4 flex flex-col">
          <CardContent className="p-6 flex flex-col flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-6 text-[#0f172a]">
              <TrendingDown className="w-5 h-5 text-[#004ac6]" />
              折旧趋势
            </h2>
            {depreciationData.length > 0 ? (
              <div className="flex-1 relative mt-4 min-h-[200px]">
                <div className="absolute inset-0 rounded-lg border border-blue-100 bg-gradient-to-b from-blue-500/5 to-transparent" />
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={depreciationData} margin={{ top: 16, right: 8, left: -8, bottom: 24 }}>
                    <defs>
                      <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#depGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded shadow-sm border border-[#e5e7eb] text-[11px]">
                  <p className="font-bold text-[#004ac6]">当前净值</p>
                  <p>{formatCurrency(asset.currentValue)}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#94a3b8] text-sm min-h-[200px]">
                暂无折旧数据
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-8 text-[#0f172a]">
              <History className="w-5 h-5 text-[#004ac6]" />
              变更记录
            </h2>
            <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8] text-sm">
              暂无变更记录
            </div>
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
