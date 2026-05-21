/**
 * @file pages/disposal/DisposalListPage.tsx
 * @description 资产处置管理列表页
 *
 * 功能：
 * - 4 个处置类型 Tab（调拨 / 清退 / 报废 / 赔偿）
 * - 搜索 + 状态过滤（通过 API 参数传递）
 * - 新建各类处置单的入口
 * - 列表展示（通过 getDisposalList / getCompensationList / getDisposalStats 真实 API 对接）
 * - 分页绑定真实 total
 * - 统计卡片数据从 API 聚合
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightLeft, LogOut, Trash2, DollarSign, Plus, Search,
  Eye, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getDisposalList,
  getDisposalStats,
  getCompensationList,
  type Disposal,
  type DisposalType,
  type DisposalStatus,
  type DisposalStats,
  type Compensation,
} from '@/api/disposal';
import type { ApiResponse, PageData } from '@/types/common';

// ── Tab 配置 ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'TRANSFER',     label: '资产调拨', icon: ArrowRightLeft, color: '#3b82f6', route: '/disposals/transfer/new' },
  { id: 'CLEARANCE',    label: '资产清退', icon: LogOut,         color: '#f59e0b', route: '/disposals/clearance/new' },
  { id: 'SCRAP',        label: '报废转让', icon: Trash2,         color: '#ef4444', route: '/disposals/scrap/new' },
  { id: 'COMPENSATION', label: '资产赔偿', icon: DollarSign,     color: '#10b981', route: '/compensation/new' },
] as const;

type TabId = typeof TABS[number]['id'];

// ── 状态配置 ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  PENDING:   { label: '待审批',  bg: 'bg-amber-50',  text: 'text-amber-600',  icon: Clock },
  APPROVED:  { label: '审批中',  bg: 'bg-blue-50',   text: 'text-blue-600',   icon: AlertCircle },
  COMPLETED: { label: '已完成',  bg: 'bg-green-50',  text: 'text-green-600',  icon: CheckCircle },
  REJECTED:  { label: '已拒绝',  bg: 'bg-red-50',    text: 'text-red-600',    icon: XCircle },
  '待审批':   { label: '待审批',  bg: 'bg-amber-50',  text: 'text-amber-600',  icon: Clock },
  '审批中':   { label: '审批中',  bg: 'bg-blue-50',   text: 'text-blue-600',   icon: AlertCircle },
  '已完成':   { label: '已完成',  bg: 'bg-green-50',  text: 'text-green-600',  icon: CheckCircle },
  '已拒绝':   { label: '已拒绝',  bg: 'bg-red-50',    text: 'text-red-600',    icon: XCircle },
  '草稿':     { label: '草稿',    bg: 'bg-slate-50',  text: 'text-slate-500',  icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-slate-50', text: 'text-slate-500', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

/** 将 Disposal 记录映射为统一行数据 */
interface RowData {
  id: number;
  disposalNo: string;
  assetName: string;
  assetNo: string;
  applicant: string;
  applyDate: string;
  currentStatus: string;
  reason: string;
}

function disposalToRow(d: Disposal): RowData {
  return {
    id: d.id,
    disposalNo: `DSP-${String(d.id).padStart(6, '0')}`,
    assetName: d.assetName ?? '',
    assetNo: d.assetNo ?? '',
    applicant: d.applicantName ?? '',
    applyDate: d.createdAt?.split('T')[0] ?? '',
    currentStatus: d.status,
    reason: d.reason ?? '',
  };
}

function compensationToRow(c: Compensation): RowData {
  return {
    id: c.id,
    disposalNo: `CMP-${String(c.id).padStart(6, '0')}`,
    assetName: c.assetName ?? '',
    assetNo: c.assetNo ?? '',
    applicant: c.responsibleUserName ?? '',
    applyDate: c.createdAt?.split('T')[0] ?? '',
    currentStatus: c.status,
    reason: c.reason,
  };
}

export default function DisposalListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('TRANSFER');
  const [statusFilter, setStatusFilter] = useState<DisposalStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const isCompensationTab = activeTab === 'COMPENSATION';

  // ── 统计数据 ──────────────────────────────────────────────────────────────
  const { data: statsRes } = useQuery({
    queryKey: ['disposal-stats'],
    queryFn: () => getDisposalStats(),
    staleTime: 60_000,
  });
  const stats: DisposalStats | null = (statsRes as ApiResponse<DisposalStats> | undefined)?.data ?? null;

  const STATS_CONFIG = useMemo(() => [
    {
      label: '本月处置总量',
      value: stats ? String(stats.totalThisMonth) : '—',
      sub: stats ? `较上月 ${stats.monthOverMonthDelta >= 0 ? '+' : ''}${stats.monthOverMonthDelta}` : '加载中',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: '待审批',
      value: stats ? String(stats.pendingCount) : '—',
      sub: '需及时处理',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: '已完成',
      value: stats ? String(stats.completedCount) : '—',
      sub: '本月已结案',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
    },
    {
      label: '资产回收价值',
      value: stats ? `¥${stats.recoveredValue.toLocaleString()}` : '—',
      sub: '本月合计',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
  ], [stats]);

  // ── 处置列表（TRANSFER / CLEARANCE / SCRAP）─────────────────────────────
  const { data: disposalRes, isLoading: disposalLoading } = useQuery({
    queryKey: ['disposals', activeTab, statusFilter, page, keyword],
    queryFn: () =>
      getDisposalList({
        page,
        pageSize,
        type: activeTab as DisposalType,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      }),
    enabled: !isCompensationTab,
    retry: false,
    staleTime: 30_000,
  });

  // ── 赔偿列表 ─────────────────────────────────────────────────────────────
  const { data: compensationRes, isLoading: compensationLoading } = useQuery({
    queryKey: ['compensations', statusFilter, page, keyword],
    queryFn: () =>
      getCompensationList({
        page,
        pageSize,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      }),
    enabled: isCompensationTab,
    retry: false,
    staleTime: 30_000,
  });

  // ── 解包列表数据 ─────────────────────────────────────────────────────────
  const records: RowData[] = useMemo(() => {
    if (isCompensationTab) {
      const pageData = (compensationRes as ApiResponse<PageData<Compensation>> | undefined)?.data;
      return pageData?.records?.map(compensationToRow) ?? [];
    }
    const pageData = (disposalRes as ApiResponse<PageData<Disposal>> | undefined)?.data;
    return pageData?.records?.map(disposalToRow) ?? [];
  }, [isCompensationTab, disposalRes, compensationRes]);

  const total: number = useMemo(() => {
    if (isCompensationTab) {
      return (compensationRes as ApiResponse<PageData<Compensation>> | undefined)?.data?.total ?? 0;
    }
    return (disposalRes as ApiResponse<PageData<Disposal>> | undefined)?.data?.total ?? 0;
  }, [isCompensationTab, disposalRes, compensationRes]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const loading = isCompensationTab ? compensationLoading : disposalLoading;

  // ── Tab 切换时重置筛选 ────────────────────────────────────────────────────
  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setPage(1);
    setKeyword('');
    setStatusFilter('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="资产处置管理"
        description="统一管理资产调拨、清退、报废、赔偿等全生命周期处置流程"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate(currentTab.route)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建{currentTab.label}
          </Button>
        }
      />

      {/* ── 统计卡片 ── */}
      <div className="grid grid-cols-4 gap-4">
        {STATS_CONFIG.map(({ label, value, sub, color, bg, border }) => (
          <Card key={label} className={`${bg} ${border} border`}>
            <CardContent className="py-4 px-5">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tab + 内容 ── */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
        {/* Tab Bar */}
        <div className="flex border-b border-[#e5e7eb]">
          {TABS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === id
                  ? 'border-current text-[#0f172a] bg-[#f8fafc]'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              style={activeTab === id ? { color } : {}}
            >
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === id && total > 0 && (
                <span
                  className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: color + '18', color }}
                >
                  {total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 搜索栏 + 状态筛选 */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f1f5f9] bg-[#f8fafc]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={e => { setKeyword(e.target.value); setPage(1); }}
              placeholder={`搜索${currentTab.label}单号 / 资产名称 / 申请人`}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 placeholder:text-slate-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as DisposalStatus | ''); setPage(1); }}
            className="px-3 py-2 text-sm bg-white border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-slate-600"
          >
            <option value="">全部状态</option>
            <option value="PENDING">待审批</option>
            <option value="APPROVED">审批中</option>
            <option value="COMPLETED">已完成</option>
            <option value="REJECTED">已拒绝</option>
          </select>
          <span className="text-xs text-slate-400">共 {total} 条记录</span>
        </div>

        {/* 列表 */}
        <div className="divide-y divide-[#f1f5f9]">
          {/* 表头 */}
          <div className="grid grid-cols-[180px_1fr_120px_100px_120px_80px] gap-4 px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-[#f8fafc]">
            <span>处置单号</span>
            <span>资产信息</span>
            <span>申请人</span>
            <span>申请日期</span>
            <span>状态</span>
            <span className="text-center">操作</span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">加载中…</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <currentTab.icon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">暂无{currentTab.label}记录</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(currentTab.route)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                创建第一条{currentTab.label}
              </Button>
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="grid grid-cols-[180px_1fr_120px_100px_120px_80px] gap-4 px-5 py-3.5 items-center hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                onClick={() => navigate(`/disposals/${record.id}`)}
              >
                <span className="font-mono text-[12px] text-[#0f172a] font-semibold">{record.disposalNo}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0f172a] truncate">{record.assetName}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{record.assetNo}</p>
                </div>
                <span className="text-sm text-slate-600">{record.applicant}</span>
                <span className="text-sm text-slate-500">{record.applyDate}</span>
                <StatusBadge status={record.currentStatus} />
                <div className="flex justify-center">
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/disposals/${record.id}`); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f1f5f9] bg-[#f8fafc]">
            <span className="text-xs text-slate-400">第 {page} / {totalPages} 页</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
