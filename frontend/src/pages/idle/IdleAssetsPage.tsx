/**
 * @file pages/idle/IdleAssetsPage.tsx
 * @description 闲置资产管理页（新 Design System 版本）
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Archive, Send, CheckCircle, Clock, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// ── 类型定义 ─────────────────────────────────────────────────────────────────

interface IdleAsset {
  id: number | string;
  assetId?: number | string;
  name?: string;
  assetName?: string;
  category?: string;
  originalDept?: string;
  idleDays?: number;
  value?: string | number;
  assetValue?: string | number;
  status: string;
  reason?: string;
  viewCount?: number;
  claimDept?: string;
  condition?: string;
  publishDate?: string;
  deadline?: string;
}

// ── Mock 数据 ─────────────────────────────────────────────────────────────────

const MOCK_IDLE_ASSETS: IdleAsset[] = [
  {
    id: 1,
    assetId: 'AST-2024-001',
    name: '联想笔记本电脑 ThinkPad X1',
    category: '办公设备',
    originalDept: '市场部',
    idleDays: 120,
    value: '¥8,500',
    status: '待发布',
    reason: '部门精简，人员减少导致闲置',
    condition: '良好',
  },
  {
    id: 2,
    assetId: 'AST-2024-002',
    name: '惠普激光打印机 LaserJet Pro',
    category: '办公设备',
    originalDept: '行政部',
    idleDays: 45,
    value: '¥3,200',
    status: '已发布',
    reason: '已采购新型号，旧款闲置',
    viewCount: 12,
    condition: '一般',
    publishDate: '2024-01-15',
    deadline: '2024-02-15',
  },
  {
    id: 3,
    assetId: 'AST-2024-003',
    name: '会议室投影仪 Epson EB-X49',
    category: '多媒体设备',
    originalDept: '研发部',
    idleDays: 200,
    value: '¥5,800',
    status: '已认领',
    reason: '改用视频会议系统，投影仪不再使用',
    claimDept: '培训部',
    condition: '良好',
  },
  {
    id: 4,
    assetId: 'AST-2024-004',
    name: '办公桌椅套装（6件）',
    category: '家具',
    originalDept: '财务部',
    idleDays: 30,
    value: '¥2,400',
    status: '待发布',
    reason: '办公室搬迁，家具数量过剩',
    condition: '良好',
  },
];

// ── Tab 类型 ─────────────────────────────────────────────────────────────────

type TabKey = 'pending' | 'published' | 'claimed' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',   label: '待处理' },
  { key: 'published', label: '公告中' },
  { key: 'claimed',   label: '已认领' },
  { key: 'history',   label: '历史记录' },
];

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function getIdleDaysColor(days?: number): string {
  if (!days) return 'text-blue-600';
  if (days > 90) return 'text-red-600';
  if (days > 30) return 'text-orange-500';
  return 'text-blue-600';
}

function getStatusBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'gray' {
  switch (status) {
    case '已发布': return 'default';
    case '已认领': return 'success';
    case '已处置': return 'gray';
    default:       return 'warning';
  }
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    '待发布': '待处理',
    '已发布': '公告中',
    '已认领': '已认领',
    '已处置': '已处置',
  };
  return map[status] ?? status;
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function IdleAssetsPage() {
  const [assets, setAssets]           = useState<IdleAsset[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [message, setMessage]         = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<TabKey>('pending');
  const [showPublish, setShowPublish] = useState(false);
  const [publishTarget, setPublishTarget] = useState<IdleAsset | null>(null);

  // ── 数据加载 ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/idle-assets');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: IdleAsset[] = Array.isArray(json) ? json : json?.records ?? json?.data ?? [];
      setAssets(list.length > 0 ? list : MOCK_IDLE_ASSETS);
    } catch {
      // API 失败降级使用 Mock
      setAssets(MOCK_IDLE_ASSETS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 统计 ────────────────────────────────────────────────────────────────────

  const totalCount     = assets.length;
  const publishedCount = assets.filter(a => a.status === '已发布').length;
  const claimingCount  = assets.filter(a => a.status === '已发布').length; // 进行中认领
  const disposedCount  = assets.filter(a => a.status === '已认领' || a.status === '已处置').length;

  // ── Tab 过滤 ─────────────────────────────────────────────────────────────────

  const tabAssets: Record<TabKey, IdleAsset[]> = {
    pending:   assets.filter(a => a.status === '待发布'),
    published: assets.filter(a => a.status === '已发布'),
    claimed:   assets.filter(a => a.status === '已认领'),
    history:   assets.filter(a => a.status === '已处置' || a.status === '已认领'),
  };

  const displayAssets = tabAssets[activeTab];

  // ── 发布公告 ─────────────────────────────────────────────────────────────────

  const handlePublish = async (asset: IdleAsset) => {
    try {
      setError(null);
      setMessage(null);
      const res = await fetch(`/api/idle-assets/${asset.id}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage('公告发布成功。');
      setShowPublish(false);
      setPublishTarget(null);
      await loadData();
    } catch {
      // Mock 降级：本地更新
      setAssets(prev =>
        prev.map(a => a.id === asset.id ? { ...a, status: '已发布' } : a)
      );
      setMessage('公告发布成功（本地模拟）。');
      setShowPublish(false);
      setPublishTarget(null);
    }
  };

  const handleClaim = async (asset: IdleAsset) => {
    try {
      setError(null);
      setMessage(null);
      const res = await fetch(`/api/idle-assets/${asset.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimantId: 1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage('认领申请已提交。');
      await loadData();
    } catch {
      setAssets(prev =>
        prev.map(a => a.id === asset.id ? { ...a, status: '已认领' } : a)
      );
      setMessage('认领申请已提交（本地模拟）。');
    }
  };

  const handleDispose = async (asset: IdleAsset) => {
    setAssets(prev =>
      prev.map(a => a.id === asset.id ? { ...a, status: '已处置' } : a)
    );
    setMessage('资产已标记为已处置。');
  };

  // ── 渲染 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <PageHeader
        title="闲置资产管理"
        subtitle="闲置资产公告发布与认领流程管理"
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowPublish(true)}
            disabled={!assets.some(a => a.status === '待发布')}
          >
            <Send className="w-4 h-4 mr-1" />
            发布公告
          </Button>
        }
      />

      {/* 消息提示 */}
      {loading && <p className="text-sm text-gray-400">加载中…</p>}
      {error   && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      {/* 统计卡 */}
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

      {/* Tab + 列表 */}
      <Card>
        {/* Tab 栏 */}
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

        {/* 表格 */}
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
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  displayAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-blue-600">
                        {String(asset.assetId ?? asset.id)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">{asset.name ?? asset.assetName}</p>
                        <p className="text-xs text-gray-400">{asset.category}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-500">{asset.originalDept ?? '-'}</td>
                      <td className="px-5 py-4">
                        <span className={`font-medium ${getIdleDaysColor(asset.idleDays)}`}>
                          {asset.idleDays ?? '-'} 天
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={getStatusBadgeVariant(asset.status)}>
                          {getStatusLabel(asset.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {asset.status === '待发布' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => { setPublishTarget(asset); setShowPublish(true); }}
                            >
                              发布公告
                            </Button>
                          )}
                          {asset.status === '已发布' && (
                            <>
                              <Button size="sm" variant="default" onClick={() => handleClaim(asset)}>
                                认领
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDispose(asset)}>
                                处置
                              </Button>
                            </>
                          )}
                          {asset.status === '已认领' && (
                            <span className="text-xs text-green-600 font-medium">
                              {asset.claimDept ?? '已认领'}
                            </span>
                          )}
                          {asset.status === '已处置' && (
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

      {/* 发布公告对话框（useState 控制） */}
      {showPublish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">发布闲置资产公告</h3>
              <button
                onClick={() => { setShowPublish(false); setPublishTarget(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4">
              {/* 选择资产 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择闲置资产 *</label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {assets.filter(a => a.status === '待发布').map(asset => (
                    <label key={asset.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="radio"
                        name="publishTarget"
                        checked={publishTarget?.id === asset.id}
                        onChange={() => setPublishTarget(asset)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-900">
                        {asset.name ?? asset.assetName} — {String(asset.value ?? asset.assetValue ?? '-')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 公告标题 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公告标题 *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例：办公设备闲置资产处置公告"
                  defaultValue={publishTarget ? `${publishTarget.name ?? publishTarget.assetName} 闲置公告` : ''}
                />
              </div>

              {/* 认领截止 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">认领截止日期 *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <Button variant="outline" size="sm" onClick={() => { setShowPublish(false); setPublishTarget(null); }}>
                取消
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!publishTarget}
                onClick={() => publishTarget && handlePublish(publishTarget)}
              >
                发布公告
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
