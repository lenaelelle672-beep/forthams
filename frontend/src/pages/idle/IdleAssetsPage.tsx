import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Send, CheckCircle, Clock, X, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getIdleAssetList,
  publishIdleAsset,
  claimIdleAsset,
  cancelIdleAssetPublish,
  type IdleAssetRecord,
} from '@/api/idleAsset';
import type { ApiResponse, PageData } from '@/types/common';

type TabKey = 'pending' | 'published' | 'claimed' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',   label: '待处理' },
  { key: 'published', label: '公告中' },
  { key: 'claimed',   label: '已认领' },
  { key: 'history',   label: '历史记录' },
];

const STATUS_TAB_MAP: Record<string, TabKey> = {
  '待发布': 'pending',
  'PENDING': 'pending',
  '已发布': 'published',
  'PUBLISHED': 'published',
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

function getStatusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'gray' {
  switch (status) {
    case '已发布': case 'PUBLISHED': return 'default';
    case '已认领': case 'CLAIMED': return 'success';
    case '已处置': case 'DISPOSED': case 'CANCELLED': return 'gray';
    default: return 'warning';
  }
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    '待发布': '待处理', 'PENDING': '待处理',
    '已发布': '公告中', 'PUBLISHED': '公告中',
    '已认领': '已认领', 'CLAIMED': '已认领',
    '已处置': '已处置', 'DISPOSED': '已处置',
    'CANCELLED': '已取消',
  };
  return map[status] ?? status;
}

function getCurrentUserId(): number {
  try {
    const raw = sessionStorage.getItem('user_info') || localStorage.getItem('user_info');
    if (!raw) return 0;
    const user = JSON.parse(raw);
    return Number(user.id ?? user.userId ?? 0);
  } catch { return 0; }
}

export default function IdleAssetsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [showPublish, setShowPublish] = useState(false);
  const [publishTarget, setPublishTarget] = useState<IdleAssetRecord | null>(null);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDeadline, setPublishDeadline] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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
  const raw = (assetsRes as ApiResponse<unknown> | undefined)?.data;
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
      publishIdleAsset({ assetId: asset.assetId ?? asset.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '公告发布成功');
      setShowPublish(false);
      setPublishTarget(null);
    },
    onError: (err: Error) => {
      showToast('error', `发布失败：${err.message}`);
    },
  });

  const claimMutation = useMutation({
    mutationFn: (asset: IdleAssetRecord) => {
      const userId = getCurrentUserId();
      if (!userId) throw new Error('请先登录');
      return claimIdleAsset(asset.id, userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idle-assets'] });
      showToast('success', '认领申请已提交');
    },
    onError: (err: Error) => {
      showToast('error', `认领失败：${err.message}`);
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
    claimed:   assets.filter(a => getTabKey(a.status) === 'claimed'),
    history:   assets.filter(a => getTabKey(a.status) === 'history'),
  };

  const displayAssets = tabAssets[activeTab];
  const totalCount     = assets.length;
  const publishedCount = tabAssets.published.length;
  const claimingCount  = tabAssets.claimed.length;
  const disposedCount  = tabAssets.history.length;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="闲置资产管理"
        subtitle="闲置资产公告发布与认领流程管理"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowPublish(true)}
            disabled={tabAssets.pending.length === 0}
          >
            <Send className="w-4 h-4 mr-1" />
            发布公告
          </Button>
        }
      />

      {toast && (
        <div className={`p-3 rounded-lg text-sm ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
          后端服务暂不可用，请稍后重试。
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '闲置总量',   value: totalCount,     icon: Archive,      color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: '已发布公告', value: publishedCount,  icon: Send,         color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: '进行中认领', value: claimingCount,   icon: Clock,        color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: '本月处置',   value: disposedCount,   icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50'  },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b border-gray-200 px-4 flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-gray-400">
                ({tabAssets[tab.key].length})
              </span>
            </button>
          ))}
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">资产编号</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">资产名称</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">部门</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">闲置天数</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400">暂无数据</td>
                  </tr>
                ) : (
                  displayAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-blue-600">
                        {String(asset.assetId ?? asset.id)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">{asset.assetName ?? asset.name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{asset.category ?? '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-500">{asset.originalDept ?? '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`font-medium ${getIdleDaysColor(asset.idleDays)}`}>
                          {asset.idleDays ?? '—'} 天
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={getStatusBadgeVariant(asset.status)}>
                          {getStatusLabel(asset.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
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
                                认领
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(asset)}>
                                取消公告
                              </Button>
                            </>
                          )}
                          {getTabKey(asset.status) === 'claimed' && (
                            <span className="text-xs text-green-600 font-medium">
                              {asset.claimDept ? `认领部门：${asset.claimDept}` : '已认领'}
                            </span>
                          )}
                          {getTabKey(asset.status) === 'history' && (
                            <span className="text-xs text-gray-400">已处置</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showPublish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">发布闲置资产公告</h3>
              <button
                onClick={() => { setShowPublish(false); setPublishTarget(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择闲置资产 *</label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {tabAssets.pending.map(asset => (
                    <label key={asset.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="radio"
                        name="publishTarget"
                        checked={publishTarget?.id === asset.id}
                        onChange={() => { setPublishTarget(asset); setPublishTitle(`${asset.assetName ?? asset.name ?? ''} 闲置公告`); }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-900">
                        {asset.assetName ?? asset.name} — {String(asset.assetValue ?? asset.value ?? '—')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公告标题 *</label>
                 <input
                   type="text"
                   className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${publishErrors.title ? 'border-red-400 focus:ring-red-200' : 'border-gray-200'}`}
                   placeholder="例：办公设备闲置资产处置公告"
                   value={publishTitle}
                   onChange={(e) => { setPublishTitle(e.target.value); setPublishErrors(p => ({ ...p, title: '' })); }}
                 />
                  {publishErrors.title && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {publishErrors.title}
                    </p>
                  )}
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">认领截止日期 *</label>
                 <input
                   type="date"
                   className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${publishErrors.deadline ? 'border-red-400 focus:ring-red-200' : 'border-gray-200'}`}
                   value={publishDeadline}
                   onChange={(e) => { setPublishDeadline(e.target.value); setPublishErrors(p => ({ ...p, deadline: '' })); }}
                 />
                  {publishErrors.deadline && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {publishErrors.deadline}
                    </p>
                  )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <Button variant="outline" size="sm"                 onClick={() => { setShowPublish(false); setPublishTarget(null); setPublishTitle(''); setPublishDeadline(''); setPublishErrors({}); }}>
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
  );
}
