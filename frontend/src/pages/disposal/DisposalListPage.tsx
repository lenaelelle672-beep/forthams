/**
 * @file pages/disposal/DisposalListPage.tsx
 * @description 资产处置管理列表页
 *
 * UI 风格：现代设计系统（对标 InventoryTasksPage）
 *
 * 功能：
 * - 5 个处置类型 Tab（调拨 / 清退 / 报废 / 赔偿 / 工单）
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
  Eye, Clock, CheckCircle, XCircle, AlertCircle, ClipboardList,
  TrendingUp, BarChart3, Package, X, Download, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
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
import { getWorkOrderList } from '@/api/workorder';
import type { WorkOrderListItem } from '@/types/workorder';

// ── Tab 配置 ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'TRANSFER',     label: '资产调拨', icon: ArrowRightLeft, color: '#3b82f6', route: '/disposals/transfer/new' },
  { id: 'CLEARANCE',    label: '资产清退', icon: LogOut,         color: '#f59e0b', route: '/disposals/clearance/new' },
  { id: 'SCRAP',        label: '报废转让', icon: Trash2,         color: '#ef4444', route: '/disposals/scrap/new' },
  { id: 'COMPENSATION', label: '资产赔偿', icon: DollarSign,     color: '#10b981', route: '/compensation/new' },
  { id: 'WORK_ORDER',   label: '工单管理', icon: ClipboardList,  color: '#8b5cf6', route: '/workorders/new' },
] as const;

type TabId = typeof TABS[number]['id'];

// ── 状态配置 ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; ring: string; risk: 'none' | 'warning' | 'danger' }> = {
  PENDING:   { label: '待审批',  dot: 'bg-amber-400',  text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'ring-amber-200',  risk: 'warning' },
  APPROVED:  { label: '审批中',  dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'ring-blue-200',   risk: 'none' },
  COMPLETED: { label: '已完成',  dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200', risk: 'none' },
  REJECTED:  { label: '已拒绝',  dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    ring: 'ring-red-200',    risk: 'danger' },
  '待审批':   { label: '待审批',  dot: 'bg-amber-400',  text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'ring-amber-200',  risk: 'warning' },
  '审批中':   { label: '审批中',  dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'ring-blue-200',   risk: 'none' },
  '已完成':   { label: '已完成',  dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200', risk: 'none' },
  '已拒绝':   { label: '已拒绝',  dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    ring: 'ring-red-200',    risk: 'danger' },
  '草稿':     { label: '草稿',    dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  ring: 'ring-slate-200',  risk: 'none' },
  DRAFT:      { label: '草稿',    dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  ring: 'ring-slate-200',  risk: 'none' },
  APPROVING:  { label: '审批中',  dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'ring-blue-200',   risk: 'none' },
  WITHDRAWN:  { label: '已撤回',  dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  ring: 'ring-slate-200',  risk: 'none' },
  // 工单状态
  APPROVING_LEVEL_1: { label: '一级审批', dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'ring-blue-200',   risk: 'warning' },
  APPROVING_LEVEL_2: { label: '二级审批', dot: 'bg-indigo-400', text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', ring: 'ring-indigo-200', risk: 'warning' },
  CANCELLED:  { label: '已取消',  dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  ring: 'ring-slate-200',  risk: 'none' },
};

// ── 各处置类型风险提示文案 ──────────────────────────────────────────────────────
const TAB_RISK_HINT: Record<string, string> = {
  TRANSFER:     '调拨涉及资产归属变更，请核实转入方信息',
  CLEARANCE:    '清退操作将资产移出当前库存，需确认资产状态',
  SCRAP:        '报废操作不可逆，资产将被永久处置',
  COMPENSATION: '赔偿涉及财务责任认定，请核实损失金额',
  WORK_ORDER:   '',
};

/** 现代状态徽章 */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', ring: 'ring-slate-200', risk: 'none' as const };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
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

function workorderToRow(w: WorkOrderListItem): RowData {
  return {
    id: w.id,
    disposalNo: w.workOrderNo,
    assetName: w.title,
    assetNo: '',
    applicant: w.reporterName ?? '',
    applyDate: w.createTime?.split('T')[0] ?? '',
    currentStatus: w.status,
    reason: w.type ? String(w.type) : '',
  };
}

export default function DisposalListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('CLEARANCE');
  const [statusFilter, setStatusFilter] = useState<DisposalStatus | ''>('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const CurrentTabIcon = currentTab.icon;
  const isCompensationTab = activeTab === 'COMPENSATION';
  const isWorkOrderTab = activeTab === 'WORK_ORDER';
  const isDisposalTab = !isCompensationTab && !isWorkOrderTab;

  // ── 统计数据 ──────────────────────────────────────────────────────────────
  const { data: statsRes } = useQuery({
    queryKey: ['disposal-stats'],
    queryFn: () => getDisposalStats(),
    staleTime: 60_000,
  });
  const stats: DisposalStats | null = statsRes as unknown as DisposalStats | undefined ?? null;

  // ── 统计卡片 ──────────────────────────────────────────────────────────────
  const statCards = useMemo(() => [
    {
      label: '本月处置总量',
      value: stats ? String(stats.totalThisMonth) : '—',
      unit: '项',
      icon: Package,
      gradient: 'from-blue-600 to-cyan-500',
      sub: stats ? `较上月 ${stats.monthOverMonthDelta >= 0 ? '+' : ''}${stats.monthOverMonthDelta}` : '加载中',
    },
    {
      label: '待审批',
      value: stats ? String(stats.pendingCount) : '—',
      unit: '项',
      icon: Clock,
      gradient: 'from-amber-500 to-orange-400',
      sub: '需及时处理',
    },
    {
      label: '已完成',
      value: stats ? String(stats.completedCount) : '—',
      unit: '项',
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-teal-400',
      sub: '本月已结案',
    },
    {
      label: '资产回收价值',
      value: stats ? `¥${stats.recoveredValue.toLocaleString()}` : '—',
      unit: '',
      icon: TrendingUp,
      gradient: 'from-violet-500 to-purple-400',
      sub: '本月合计',
    },
  ], [stats]);

  // ── 处置列表（TRANSFER / CLEARANCE / SCRAP）─────────────────────────────
  const { data: disposalRes, isLoading: disposalLoading, isFetching: disposalFetching } = useQuery({
    queryKey: ['disposals', isDisposalTab ? activeTab : 'inactive', statusFilter, page, keyword],
    queryFn: () =>
      getDisposalList({
        page,
        pageSize,
        type: activeTab as DisposalType,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      }),
    enabled: isDisposalTab,
    retry: false,
    staleTime: 30_000,
  });

  // ── 赔偿列表 ─────────────────────────────────────────────────────────────
  const { data: compensationRes, isLoading: compensationLoading, isFetching: compensationFetching } = useQuery({
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

  // ── 工单列表 ─────────────────────────────────────────────────────────────
  const { data: workorderRes, isLoading: workorderLoading, isFetching: workorderFetching } = useQuery({
    queryKey: ['workorders', statusFilter, page, keyword],
    queryFn: () =>
      getWorkOrderList({
        page,
        pageSize,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      }),
    enabled: isWorkOrderTab,
    retry: false,
    staleTime: 30_000,
  });

  // ── 解包列表数据 ─────────────────────────────────────────────────────────
  const records: RowData[] = useMemo(() => {
    if (isCompensationTab) {
      const pageData = (compensationRes as PageData<Compensation> | undefined);
      return pageData?.records?.map(compensationToRow) ?? [];
    }
    if (isWorkOrderTab) {
      const pageData = (workorderRes as PageData<WorkOrderListItem> | undefined);
      return pageData?.records?.map(workorderToRow) ?? [];
    }
    const pageData = (disposalRes as PageData<Disposal> | undefined);
    return pageData?.records?.map(disposalToRow) ?? [];
  }, [isCompensationTab, isWorkOrderTab, disposalRes, compensationRes, workorderRes]);

  const total: number = useMemo(() => {
    if (isCompensationTab) {
      return (compensationRes as PageData<Compensation> | undefined)?.total ?? 0;
    }
    if (isWorkOrderTab) {
      return (workorderRes as PageData<WorkOrderListItem> | undefined)?.total ?? 0;
    }
    return (disposalRes as PageData<Disposal> | undefined)?.total ?? 0;
  }, [isCompensationTab, isWorkOrderTab, disposalRes, compensationRes, workorderRes]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const loading = isCompensationTab ? compensationLoading : isWorkOrderTab ? workorderLoading : disposalLoading;
  const isFetching = isCompensationTab ? compensationFetching : isWorkOrderTab ? workorderFetching : disposalFetching;

  // ── CSV 导出 ───────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const api = await import('@/api/disposal');
      let rows: RowData[] = [];

      if (isCompensationTab) {
        const res = await api.getCompensationList({
          page: 1,
          pageSize: 9999,
          status: statusFilter || undefined,
          keyword: keyword || undefined,
        });
        const pageData = res as unknown as PageData<Compensation>;
        rows = pageData.records?.map(compensationToRow) ?? [];
      } else if (isWorkOrderTab) {
        const woApi = await import('@/api/workorder');
        const res = await woApi.getWorkOrderList({
          page: 1,
          pageSize: 9999,
          status: statusFilter || undefined,
          keyword: keyword || undefined,
        });
        const pageData = res as unknown as PageData<WorkOrderListItem>;
        rows = pageData.records?.map(workorderToRow) ?? [];
      } else {
        const res = await api.getDisposalList({
          page: 1,
          pageSize: 9999,
          type: activeTab as DisposalType,
          status: statusFilter || undefined,
          keyword: keyword || undefined,
        });
        const pageData = res as unknown as PageData<Disposal>;
        rows = pageData.records?.map(disposalToRow) ?? [];
      }

      const header = ['处置单号', '资产名称', '资产编号', '申请人', '申请日期', '状态', '原因'];
      const csvContent = [
        header.join(','),
        ...rows.map(r =>
          [r.disposalNo, r.assetName, r.assetNo, r.applicant, r.applyDate, r.currentStatus, r.reason]
            .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentTab.label}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${rows.length} 条${currentTab.label}记录`);
    } catch (err) {
      console.error('CSV export failed:', err);
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  // ── 筛选状态 ──────────────────────────────────────────────────────────────
  const hasActiveFilters = statusFilter !== '' || keyword !== '';

  // ── 高风险项计数 ─────────────────────────────────────────────────────────
  const highRiskCount = useMemo(
    () => records.filter(r => { const c = STATUS_CONFIG[r.currentStatus]; return c?.risk === 'danger' || c?.risk === 'warning'; }).length,
    [records],
  );

  // ── 状态计数（当前页） ──────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      counts[r.currentStatus] = (counts[r.currentStatus] || 0) + 1;
    });
    return counts;
  }, [records]);

  // ── 快速筛选配置 ─────────────────────────────────────────────────────────
  const quickFilters = useMemo(() => {
    if (isWorkOrderTab) {
      return [
        { key: 'DRAFT', label: '草稿' },
        { key: 'PENDING', label: '待审批' },
        { key: 'APPROVING_LEVEL_1', label: '一级审批' },
        { key: 'APPROVING_LEVEL_2', label: '二级审批' },
        { key: 'APPROVED', label: '已通过' },
        { key: 'REJECTED', label: '已拒绝' },
        { key: 'CANCELLED', label: '已取消' },
      ];
    }
    return [
      { key: 'PENDING', label: '待审批' },
      { key: 'APPROVED', label: '审批中' },
      { key: 'COMPLETED', label: '已完成' },
      { key: 'REJECTED', label: '已拒绝' },
    ];
  }, [isWorkOrderTab]);

  // ── 清除全部筛选 ─────────────────────────────────────────────────────────
  const clearAllFilters = () => { setKeyword(''); setStatusFilter(''); setPage(1); };

  // ── Tab 切换时重置筛选 ────────────────────────────────────────────────────
  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setPage(1);
    setKeyword('');
    setStatusFilter('');
  };

  // ── DataTable 列定义 ─────────────────────────────────────────────────────
  const columns: Column<RowData>[] = [
    {
      key: 'disposalNo',
      title: '处置单号',
      width: 150,
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
          {row.disposalNo}
        </span>
      ),
    },
    {
      key: 'assetName',
      title: '资产信息',
      render: (_, row) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-semibold text-slate-900 truncate">{row.assetName}</p>
          {row.assetNo && (
            <p className="mt-0.5 text-[11px] text-slate-400 font-mono">{row.assetNo}</p>
          )}
        </div>
      ),
    },
    {
      key: 'applicant',
      title: '申请人',
      width: 120,
      render: (v) => (
        <span className="text-sm text-slate-600">{String(v ?? '—')}</span>
      ),
    },
    {
      key: 'applyDate',
      title: '申请日期',
      width: 120,
      render: (v) => (
        <span className="whitespace-nowrap text-xs font-medium text-slate-500">
          {String(v ?? '—')}
        </span>
      ),
    },
    {
      key: 'currentStatus',
      title: '状态',
      width: 120,
      render: (v) => <StatusBadge status={String(v ?? '')} />,
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end">
          <button
            type="button"
            title={`查看${row.disposalNo}`}
            onClick={e => {
              e.stopPropagation();
              navigate(isWorkOrderTab ? `/workorders/${row.id}` : `/disposals/${row.id}`);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            <Eye className="h-3.5 w-3.5" />
            查看
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ================================================================ */}
        {/* Compact Header with integrated stat bar                          */}
        {/* ================================================================ */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          {/* Title row */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">资产处置管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <BarChart3 className="h-3 w-3" />
                全周期
              </span>
              {highRiskCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  {highRiskCount} 项待处理
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(currentTab.route)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              新建{currentTab.label}
            </Button>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">
                      {stat.value}
                      {stat.unit && <span className="ml-0.5 text-xs font-medium text-slate-400">{stat.unit}</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">{stat.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================ */}
        {/* Tab Navigation — Modern pill tabs                                */}
        {/* ================================================================ */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100/80 p-0.5">
          {TABS.map(({ id, label, icon: Icon, color }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={isActive ? { color } : {}} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.slice(0, 2)}</span>
                {isActive && total > 0 && (
                  <span
                    className="ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold"
                    style={{ backgroundColor: color + '18', color }}
                  >
                    {total}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* Main Content Card                                                */}
        {/* ================================================================ */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">

          {/* Risk hint bar */}
          {TAB_RISK_HINT[activeTab] && (
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/80 px-5 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs text-amber-700">{TAB_RISK_HINT[activeTab]}</span>
            </div>
          )}

          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            {/* Title row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  {currentTab.label}
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {currentTab.label}列表
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={e => { setKeyword(e.target.value); setPage(1); }}
                    placeholder={`搜索${currentTab.label}单号 / 资产名称`}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    <X className="h-3 w-3" />
                    清除筛选
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  导出 CSV
                </button>
              </div>
            </div>

            {/* Quick filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setStatusFilter(''); setPage(1); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !statusFilter
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                  {total}
                </span>
              </button>
              {quickFilters.map(({ key, label }) => {
                const cfg = STATUS_CONFIG[key];
                const isActive = statusFilter === key;
                const count = statusCounts[key] ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(isActive ? '' : key as DisposalStatus);
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    {cfg && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
                    {label}
                    {count > 0 && (
                      <span
                        className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {isFetching && !loading && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                <RefreshCw className="h-3 w-3 animate-spin" />
                刷新中
              </span>
            )}
            {hasActiveFilters && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Search className="h-3 w-3" />
                已筛选
                {keyword && <span>：{keyword}</span>}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
                  onClick={clearAllFilters}
                  title="清除筛选"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条记录
            </span>
            {highRiskCount > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <AlertCircle className="h-3 w-3" />
                {highRiskCount} 项待处理
              </span>
            )}
          </div>

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={records}
              loading={loading}
              rowKey={(row) => row.id}
              onRowClick={(row) =>
                navigate(isWorkOrderTab ? `/workorders/${row.id}` : `/disposals/${row.id}`)
              }
              pagination={{
                page,
                pageSize,
                total,
                onChange: (p, _ps) => setPage(p),
              }}
              emptyText={`暂无${currentTab.label}记录`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
