import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Send, CheckCircle, Clock, X, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  getIdleAssetList,
  publishIdleAsset,
  claimIdleAsset,
  approveIdleAssetClaim,
  rejectIdleAssetClaim,
  cancelIdleAssetPublish,
  type IdleAssetRecord,
} from '@/api/idleAsset';
import type { PageData } from '@/types/common';

type TabKey = 'pending' | 'published' | 'review' | 'claimed' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',   label: '待处理' },
  { key: 'published', label: '公告中' },
  { key: 'review',    label: '待审批' },
  { key: 'claimed',   label: '已认领' },
  { key: 'history',   label: '历史记录' },
];

const STATUS_TAB_MAP: Record<string, TabKey> = {
  '待发布': 'pending',
  'PENDING': 'pending',
  '已发布': 'published',
  'PUBLISHED': 'published',
  'CLAIM_PENDING': 'review',
  '已认领': 'claimed',
  'CLAIMED': 'claimed',
  '已处置': 'history',
  'DISPOSED': 'history',
  'CANCELLED': 'history',
};

function getTabKey(status: string): TabKey {
  return STATUS_TAB_MAP[status] ?? 'pending';
}

function getIdleDaysColor(days?: number): string {
  if (!days) return 'text-blue-600';
  if (days > 90) return 'text-red-600';
  if (days > 30) return 'text-orange-500';
  return 'text-blue-600';
}

function getStatusBadgeClasses(status: string): { container: string; dot: string } {
  switch (status) {
    case '已发布': case 'PUBLISHED':
      return { container: 'border-blue-200 bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500' };
    case 'CLAIM_PENDING':
      return { container: 'border-amber-200 bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' };
    case '已认领': case 'CLAIMED':
      return { container: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' };
    case '已处置': case 'DISPOSED': case 'CANCELLED':
      return { container: 'border-slate-200 bg-slate-50 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' };
    default:
      return { container: 'border-amber-200 bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' };
  }
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    '待发布': '待处理', 'PENDING': '待处理',
    '已发布': '公告中', 'PUBLISHED': '公告中',
    'CLAIM_PENDING': '待审批',
    '已认领': '已认领', 'CLAIMED': '已认领',
    '已处置': '已处置', 'DISPOSED': '已处置',
    'CANCELLED': '已取消',
  };
  return map[status] ?? status;
}

/* ------------------------------------------------------------------ */
/*  Status badge sub-component                                        */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: string }) {
  const { container, dot } = getStatusBadgeClasses(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${container}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {getStatusLabel(status)}
    </span>
  );
}

/* ================================================================== */
/*  Page                                                              */
/* ================================================================== */
export default function IdleAssetsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [showPublish, setShowPublish] = useState(false);
  const [publishTarget, setPublishTarget] = useState<IdleAssetRecord | null>(null);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDeadline, setPublishDeadline] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canApproveClaims = permissions.includes('*') || permissions.includes('idle:approve');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: assetsRes, isLoading, error } = useQuery({
    queryKey: ['idle-assets'],
    queryFn: () => getIdleAssetList(),
    retry: 1,
  });

  // 后端 /idle-assets/list 返回 ApiResponse<Page<IdleAssetNotice>>，即 { code, data: { records: [...] } }
  // 需要从 data.records 提取数组，兼容 data 直接为数组的情况，兜底 []
  const raw = assetsRes as unknown as unknown | undefined;
  const assets: IdleAssetRecord[] = Array.isArray(raw)
    ? (raw as IdleAssetRecord[])
    : Array.isArray((raw as PageData<IdleAssetRecord> | undefined)?.records)
      ? (raw as PageData<IdleAssetRecord>).records
      : [];

  // 发布公告表单校验 schema
  const publishSchema = z.object({
    title: z.string().min(1, '公告标题不能为空'),
    deadline: z.string().min(1, '认领截止日期不能为空').refine(val => {
      if (!val) return false;
      const d = new Date(val);
      return !isNaN(d.getTime()) && d > new Date();
    }, '认领截止日期必须在今天之后'),
  });

  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});

  const validatePublishForm = (): boolean => {
    const result = publishSchema.safeParse({ title: publishTitle, deadline: publishDeadline });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!errs[field]) errs[field] = issue.message;
      }
      setPublishErrors(errs);
      return false;
    }
    setPublishErrors({});
    return true;
  };

  const publishMutation = useMutation({
    mutationFn: (asset: IdleAssetRecord) =>
      publishIdleAsset({
        assetId: asset.assetId ?? asset.id,
        idleDays: asset.idleDays,
        title: publishTitle.trim(),
        reason: publishTitle.trim(),
        claimDeadline: publishDeadline,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '公告发布成功');
      setShowPublish(false);
      setPublishTarget(null);
      setPublishTitle('');
      setPublishDeadline('');
      setPublishErrors({});
    },
    onError: (err: Error) => {
      showToast('error', `发布失败：${err.message}`);
    },
  });

  const claimMutation = useMutation({
    mutationFn: (asset: IdleAssetRecord) => claimIdleAsset(asset.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '认领申请已提交，等待资产管理员审批');
    },
    onError: (err: Error) => {
      showToast('error', `认领失败：${err.message}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (asset: IdleAssetRecord) => approveIdleAssetClaim(asset.id, { opinion: '同意认领' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '认领申请已通过');
    },
    onError: (err: Error) => {
      showToast('error', `审批失败：${err.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (asset: IdleAssetRecord) => rejectIdleAssetClaim(asset.id, { opinion: '不符合认领条件' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '认领申请已驳回，公告恢复为可认领');
    },
    onError: (err: Error) => {
      showToast('error', `驳回失败：${err.message}`);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (asset: IdleAssetRecord) => cancelIdleAssetPublish(asset.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '公告已取消');
    },
    onError: (err: Error) => {
      showToast('error', `取消失败：${err.message}`);
    },
  });

  const tabAssets: Record<TabKey, IdleAssetRecord[]> = {
    pending:   assets.filter(a => getTabKey(a.status) === 'pending'),
    published: assets.filter(a => getTabKey(a.status) === 'published'),
    review:    assets.filter(a => getTabKey(a.status) === 'review'),
    claimed:   assets.filter(a => getTabKey(a.status) === 'claimed'),
    history:   assets.filter(a => getTabKey(a.status) === 'history'),
  };

  const displayAssets = tabAssets[activeTab];
  const totalCount     = assets.length;
  const publishedCount = tabAssets.published.length;
  const reviewCount    = tabAssets.review.length;
  const claimedCount   = tabAssets.claimed.length;

  /* ---- DataTable column definitions ---- */
  const columns: Column<IdleAssetRecord>[] = [
    {
      key: 'assetId',
      title: '资产编号',
      width: 120,
      render: (_v, row) => (
        <span className="font-medium text-blue-600">
          {String(row.assetId ?? row.id)}
        </span>
      ),
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (_v, row) => (
        <div>
          <p className="font-medium text-gray-900">{row.assetName ?? row.name ?? '—'}</p>
          <p className="text-xs text-gray-400">{row.category ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'originalDept',
      title: '部门',
      render: (_v, row) => <span className="text-gray-500">{row.originalDept ?? '—'}</span>,
    },
    {
      key: 'idleDays',
      title: '闲置天数',
      width: 110,
      render: (_v, row) => (
        <span className={`font-medium ${getIdleDaysColor(row.idleDays)}`}>
          {row.idleDays ?? '—'} 天
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 130,
      render: (_v, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      title: '操作',
      width: 240,
      render: (_v, asset) => (
        <div className="flex flex-wrap gap-2">
          {getTabKey(asset.status) === 'pending' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => { setPublishTarget(asset); setPublishTitle(`${asset.assetName ?? asset.name ?? ''} 闲置公告`); setShowPublish(true); }}
            >
              发布公告
            </Button>
          )}
          {getTabKey(asset.status) === 'published' && (
            <>
              <Button size="sm" variant="primary" onClick={() => claimMutation.mutate(asset)}>
                申请认领
              </Button>
              <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(asset)}>
                取消公告
              </Button>
            </>
          )}
          {getTabKey(asset.status) === 'review' && (
            canApproveClaims ? (
              <>
                <Button size="sm" variant="primary" onClick={() => approveMutation.mutate(asset)}>
                  通过
                </Button>
                <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(asset)}>
                  驳回
                </Button>
              </>
            ) : (
              <span className="text-xs text-orange-600 font-medium">等待资产管理员审批</span>
            )
          )}
          {getTabKey(asset.status) === 'claimed' && (
            <span className="text-xs text-green-600 font-medium">
              {asset.claimDept ? `认领部门：${asset.claimDept}` : '认领已通过'}
            </span>
          )}
          {getTabKey(asset.status) === 'history' && (
            <span className="text-xs text-gray-400">已处置</span>
          )}
        </div>
      ),
    },
  ];

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[var(--app-background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  /* ---- Stat definitions ---- */
  const stats = [
    {
      label: '闲置总量',
      value: totalCount,
      icon: Archive,
      gradient: 'from-amber-500 to-yellow-400',
      bg: 'bg-amber-50',
    },
    {
      label: '已发布公告',
      value: publishedCount,
      icon: Send,
      gradient: 'from-blue-600 to-blue-400',
      bg: 'bg-blue-50',
    },
    {
      label: '待审批认领',
      value: reviewCount,
      icon: Clock,
      gradient: 'from-orange-500 to-amber-400',
      bg: 'bg-orange-50',
    },
    {
      label: '已完成认领',
      value: claimedCount,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-green-400',
      bg: 'bg-emerald-50',
    },
  ] as const;

  /* ---- Render ---- */
  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ---- Header + Stat bar ---- */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">闲置资产管理</h1>
              <p className="mt-0.5 text-sm text-gray-500">闲置资产公告发布与认领流程管理</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowPublish(true)}
              disabled={tabAssets.pending.length === 0}
            >
              <Send className="mr-1.5 h-4 w-4" />
              发布公告
            </Button>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, gradient, bg }) => (
              <div key={label} className="flex items-center gap-3.5 px-5 py-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="text-xl font-bold tracking-tight text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Toast / Error banners ---- */}
        {toast && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {toast.msg}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
            后端服务暂不可用，请稍后重试。
          </div>
        )}

        {/* ---- Main content card ---- */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar: filter pills + result summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {TABS.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-gray-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 ${active ? 'text-blue-200' : 'text-gray-400'}`}>
                      {tabAssets[tab.key].length}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              共 <span className="font-semibold text-gray-600">{displayAssets.length}</span> 条结果
            </p>
          </div>

          {/* DataTable */}
          <div className="p-5">
            <DataTable<IdleAssetRecord>
              columns={columns}
              data={displayAssets}
              rowKey={(row) => String(row.id)}
              emptyText="暂无数据"
            />
          </div>
        </Card>

        {/* ---- Publish modal ---- */}
        {showPublish && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-semibold text-gray-900">发布闲置资产公告</h3>
                <button
                  onClick={() => { setShowPublish(false); setPublishTarget(null); setPublishTitle(''); setPublishDeadline(''); setPublishErrors({}); }}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-slate-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="space-y-5 px-6 py-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">选择闲置资产 *</label>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
                    {tabAssets.pending.map(asset => (
                      <label key={asset.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-slate-50">
                        <input
                          type="radio"
                          name="publishTarget"
                          checked={publishTarget?.id === asset.id}
                          onChange={() => { setPublishTarget(asset); setPublishTitle(`${asset.assetName ?? asset.name ?? ''} 闲置公告`); }}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-900">
                          {asset.assetName ?? asset.name} — {String(asset.assetValue ?? asset.value ?? '—')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">公告标题 *</label>
                  <input
                    type="text"
                    className={`w-full rounded-xl border px-3.5 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      publishErrors.title ? 'border-red-400 focus:ring-red-200' : 'border-slate-200'
                    }`}
                    placeholder="例：办公设备闲置资产处置公告"
                    value={publishTitle}
                    onChange={(e) => { setPublishTitle(e.target.value); setPublishErrors(p => ({ ...p, title: '' })); }}
                  />
                  {publishErrors.title && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" /> {publishErrors.title}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">认领截止日期 *</label>
                  <input
                    type="date"
                    className={`w-full rounded-xl border px-3.5 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      publishErrors.deadline ? 'border-red-400 focus:ring-red-200' : 'border-slate-200'
                    }`}
                    value={publishDeadline}
                    onChange={(e) => { setPublishDeadline(e.target.value); setPublishErrors(p => ({ ...p, deadline: '' })); }}
                  />
                  {publishErrors.deadline && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" /> {publishErrors.deadline}
                    </p>
                  )}
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowPublish(false); setPublishTarget(null); setPublishTitle(''); setPublishDeadline(''); setPublishErrors({}); }}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!publishTarget || publishMutation.isPending}
                  onClick={() => { if (validatePublishForm() && publishTarget) publishMutation.mutate(publishTarget); }}
                >
                  {publishMutation.isPending ? '发布中...' : '发布公告'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
