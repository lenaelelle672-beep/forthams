/**
 * @file pages/budget/BudgetListPage.tsx
 * @description 预算列表页面
 *
 * UI 风格：现代设计系统（对标 DisposalListPage / InventoryTasksPage）
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet, Plus, AlertTriangle, TrendingUp, Eye,
  Clock, CheckCircle, XCircle, BarChart3, Search, X,
  DollarSign, PiggyBank, Receipt, Percent,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { getBudgets, getExecutionRate, getOverBudgetAlerts } from '@/api/budget';
import type { Budget, ExecutionRate, OverBudgetAlert } from '@/types/budget';

// ── 格式化工具 ──────────────────────────────────────────────────────────────────
function formatAmount(n?: number): string {
  if (n == null) return '-';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

function getTypeLabel(type?: string): string {
  const map: Record<string, string> = { PURCHASE: '采购', MAINTENANCE: '维保', OPERATION: '运营' };
  return map[type ?? ''] ?? (type ?? '-');
}

function getStatusLabel(status?: string): string {
  const map: Record<string, string> = { DRAFT: '草稿', APPROVED: '已审批', CLOSED: '已关闭' };
  return map[status ?? ''] ?? (status ?? '-');
}

// ── 状态样式配置 ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; ring: string }> = {
  DRAFT:    { label: '草稿',   dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200',   ring: 'ring-slate-200' },
  APPROVED: { label: '已审批', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  CLOSED:   { label: '已关闭', dot: 'bg-zinc-400',    text: 'text-zinc-500',    bg: 'bg-zinc-50',    border: 'border-zinc-200',    ring: 'ring-zinc-200' },
};

/** 现代状态徽章 */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', ring: 'ring-slate-200' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.ring}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── 类型标签配置 ─────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  PURCHASE:    { label: '采购', color: 'blue' },
  MAINTENANCE: { label: '维保', color: 'violet' },
  OPERATION:   { label: '运营', color: 'amber' },
};

function TypeBadge({ type }: { type?: string }) {
  const cfg = TYPE_CONFIG[type ?? ''];
  if (!cfg) return <span className="text-xs text-slate-500">{type ?? '-'}</span>;
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${colorMap[cfg.color] ?? colorMap.blue}`}>
      {cfg.label}
    </span>
  );
}

// ── Tab 配置 ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'list',   label: '预算列表',  icon: Wallet,     color: '#3b82f6' },
  { key: 'rate',   label: '执行率',    icon: BarChart3,  color: '#8b5cf6' },
  { key: 'alerts', label: '超支告警',  icon: AlertTriangle, color: '#ef4444' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ── 主组件 ───────────────────────────────────────────────────────────────────────
export default function BudgetListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['budgets', page, yearFilter, typeFilter],
    queryFn: async () => {
      const params: any = { page, pageSize: 10 };
      if (yearFilter) params.budgetYear = parseInt(yearFilter);
      if (typeFilter) params.budgetType = typeFilter;
      const res = await getBudgets(params);
      return { data: res?.records ?? res?.data ?? [], total: res?.total ?? 0 };
    },
    enabled: activeTab === 'list',
  });

  const { data: execRates = [] } = useQuery({
    queryKey: ['budget-exec-rate', yearFilter],
    queryFn: () => getExecutionRate({ budgetYear: parseInt(yearFilter) || undefined }),
    enabled: activeTab === 'rate',
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['budget-alerts'],
    queryFn: () => getOverBudgetAlerts(),
    enabled: activeTab === 'alerts',
  });

  const dataSource = queryResult?.data ?? [];
  const total = queryResult?.total ?? 0;

  const totalBudget = dataSource.reduce((s: number, r: Budget) => s + (r.totalAmount || 0), 0);
  const totalUsed = dataSource.reduce((s: number, r: Budget) => s + (r.usedAmount || 0), 0);
  const totalCommitted = dataSource.reduce((s: number, r: Budget) => s + (r.committedAmount || 0), 0);
  const execRate = totalBudget > 0 ? ((totalUsed / totalBudget) * 100).toFixed(1) : '0.0';

  const alertCount = (alerts as OverBudgetAlert[]).length;

  // ── 统计卡片数据 ────────────────────────────────────────────────────────────────
  const statCards = useMemo(() => [
    { label: '总预算',   value: formatAmount(totalBudget),    icon: PiggyBank,  gradient: 'from-blue-600 to-cyan-500',    sub: `${dataSource.length} 项预算` },
    { label: '已使用',   value: formatAmount(totalUsed),      icon: DollarSign, gradient: 'from-amber-500 to-orange-400', sub: `占比 ${execRate}%` },
    { label: '已承诺',   value: formatAmount(totalCommitted), icon: Receipt,    gradient: 'from-violet-500 to-purple-400', sub: '合同锁定' },
    { label: '执行率',   value: `${execRate}%`,               icon: Percent,    gradient: 'from-emerald-500 to-teal-400', sub: totalBudget > 0 ? '预算使用效率' : '暂无数据' },
  ], [totalBudget, totalUsed, totalCommitted, execRate, dataSource.length]);

  // ── 类型快速筛选 ────────────────────────────────────────────────────────────────
  const typeFilters = [
    { key: '',            label: '全部' },
    { key: 'PURCHASE',    label: '采购' },
    { key: 'MAINTENANCE', label: '维保' },
    { key: 'OPERATION',   label: '运营' },
  ];

  // ── 预算列表 DataTable 列定义 ─────────────────────────────────────────────────
  const budgetColumns: Column<Budget>[] = [
    {
      key: 'budgetYear',
      title: '年度',
      width: 80,
      render: (v) => (
        <span className="font-mono text-sm font-semibold text-slate-900">{String(v ?? '-')}</span>
      ),
    },
    {
      key: 'budgetType',
      title: '类型',
      width: 100,
      render: (_, row) => <TypeBadge type={row.budgetType} />,
    },
    {
      key: 'totalAmount',
      title: '预算总额',
      width: 140,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm text-slate-900">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'usedAmount',
      title: '已使用',
      width: 130,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm text-slate-600">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'committedAmount',
      title: '已承诺',
      width: 130,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm text-slate-600">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'remaining',
      title: '剩余',
      width: 140,
      align: 'right',
      render: (_, row) => {
        const remaining = (row.totalAmount || 0) - (row.usedAmount || 0) - (row.committedAmount || 0);
        return (
          <span className={`font-mono text-sm font-semibold ${remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {formatAmount(remaining)}
          </span>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      width: 120,
      render: (_, row) => <StatusBadge status={row.status} />,
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
            onClick={e => { e.stopPropagation(); navigate(`/budgets/${row.id}`); }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            <Eye className="h-3.5 w-3.5" />
            查看
          </button>
        </div>
      ),
    },
  ];

  // ── 执行率 DataTable 列定义 ─────────────────────────────────────────────────────
  const rateColumns: Column<ExecutionRate>[] = [
    {
      key: 'budgetType',
      title: '类型',
      width: 120,
      render: (_, row) => <TypeBadge type={row.budgetType} />,
    },
    {
      key: 'totalAmount',
      title: '预算总额',
      width: 150,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm text-slate-900">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'usedAmount',
      title: '已使用',
      width: 150,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm text-slate-600">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'executionRate',
      title: '执行率',
      width: 180,
      align: 'right',
      render: (_, row) => {
        const rate = row.executionRate;
        const colorClass = rate > 100 ? 'text-red-600' : rate > 80 ? 'text-amber-500' : 'text-emerald-600';
        const barColor = rate > 100 ? 'bg-red-500' : rate > 80 ? 'bg-amber-400' : 'bg-emerald-500';
        return (
          <div className="flex flex-col items-end gap-1">
            <span className={`font-mono text-sm font-bold ${colorClass}`}>{rate}%</span>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${barColor} transition-all`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      width: 120,
      render: (_, row) => <StatusBadge status={row.status} />,
    },
  ];

  // ── Tab 切换处理 ────────────────────────────────────────────────────────────────
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setPage(1);
  };

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
              <h1 className="text-xl font-bold text-slate-900">预算管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <BarChart3 className="h-3 w-3" />
                资产预算
              </span>
              {alertCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {alertCount} 项超支告警
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/budgets/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              新增预算
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
                    <p className="text-lg font-bold text-slate-900">{stat.value}</p>
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
          {TABS.map(({ key, label, icon: Icon, color }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={isActive ? { color } : {}} />
                <span>{label}</span>
                {isActive && key === 'list' && total > 0 && (
                  <span
                    className="ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold"
                    style={{ backgroundColor: color + '18', color }}
                  >
                    {total}
                  </span>
                )}
                {isActive && key === 'alerts' && alertCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0 text-[10px] font-bold text-white">
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* List Tab — Main Content Card                                     */}
        {/* ================================================================ */}
        {activeTab === 'list' && (
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            {/* Toolbar */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
              {/* Title row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                    <Search className="h-3.5 w-3.5" />
                    预算列表
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {yearFilter} 年度预算
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-500">年度</label>
                    <input
                      type="number"
                      value={yearFilter}
                      onChange={e => { setYearFilter(e.target.value); setPage(1); }}
                      className="w-24 rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm shadow-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {(typeFilter || yearFilter !== new Date().getFullYear().toString()) && (
                    <button
                      type="button"
                      onClick={() => { setTypeFilter(''); setYearFilter(new Date().getFullYear().toString()); setPage(1); }}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      <X className="h-3 w-3" />
                      清除筛选
                    </button>
                  )}
                </div>
              </div>

              {/* Quick filter pills — type */}
              <div className="flex flex-wrap items-center gap-2">
                {typeFilters.map(({ key, label }) => {
                  const isActive = typeFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setTypeFilter(key); setPage(1); }}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Result summary bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
              <span className="text-xs text-slate-500">
                共 <span className="font-bold text-slate-700">{total}</span> 条记录
              </span>
              {typeFilter && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  类型：{getTypeLabel(typeFilter)}
                  <button
                    type="button"
                    className="ml-0.5 rounded-full p-0.5 text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
                    onClick={() => { setTypeFilter(''); setPage(1); }}
                    title="清除类型筛选"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            {/* DataTable */}
            <div className="p-4 sm:p-5">
              <DataTable
                columns={budgetColumns}
                data={dataSource}
                loading={isLoading}
                rowKey="id"
                onRowClick={(row) => navigate(`/budgets/${row.id}`)}
                pagination={{
                  page,
                  pageSize: 10,
                  total,
                  onChange: (p) => setPage(p),
                }}
                emptyText="暂无预算记录"
              />
            </div>
          </Card>
        )}

        {/* ================================================================ */}
        {/* Rate Tab                                                         */}
        {/* ================================================================ */}
        {activeTab === 'rate' && (
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            {/* Toolbar */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-violet-600">
                    <BarChart3 className="h-3.5 w-3.5" />
                    执行率分析
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {yearFilter} 年度预算执行率
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">年度</label>
                  <input
                    type="number"
                    value={yearFilter}
                    onChange={e => setYearFilter(e.target.value)}
                    className="w-24 rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm shadow-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* DataTable */}
            <div className="p-4 sm:p-5">
              <DataTable
                columns={rateColumns}
                data={execRates as ExecutionRate[]}
                rowKey={(_, index) => index}
                emptyText="暂无执行率数据"
              />
            </div>
          </Card>
        )}

        {/* ================================================================ */}
        {/* Alerts Tab                                                       */}
        {/* ================================================================ */}
        {activeTab === 'alerts' && (
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            {/* Toolbar */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                超支告警
              </div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                预算超支告警列表
                {alertCount > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {alertCount}
                  </span>
                )}
              </h2>
            </div>

            {/* Alert cards */}
            <div className="p-4 sm:p-5">
              {(alerts as OverBudgetAlert[]).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-500">暂无超支告警</p>
                  <p className="mt-1 text-xs text-slate-400">所有预算使用正常</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(alerts as OverBudgetAlert[]).map((alert: OverBudgetAlert, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-white px-5 py-4 transition hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-400 shadow-sm">
                          <AlertTriangle className="h-4 w-4 text-white" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-red-800">
                            {getTypeLabel(alert.budgetType)}预算超支
                          </p>
                          <p className="mt-0.5 text-xs text-red-600/80">
                            预算 {formatAmount(alert.totalAmount)}，已使用 {formatAmount(alert.usedAmount)}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        超支 {formatAmount(alert.overshoot)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
