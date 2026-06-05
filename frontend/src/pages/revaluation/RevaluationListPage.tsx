/**
 * @file pages/revaluation/RevaluationListPage.tsx
 * @description 资产减值/重估列表页面
 *
 * UI 风格：现代设计系统（对标 DisposalListPage / InventoryTasksPage）
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Plus, Search, Eye, X,
  Clock, CheckCircle, XCircle, BarChart3,
  Package, ArrowDownRight, ArrowUpRight, FileCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { getRevaluations } from '@/api/revaluation';
import type { AssetRevaluation } from '@/types/revaluation';

// ── 格式化工具 ──────────────────────────────────────────────────────────────────
function formatAmount(n: number | undefined | null): string {
  if (n == null) return '-';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}
function formatDate(d: string | undefined | null): string {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('zh-CN'); } catch { return d; }
}

function getTypeLabel(type?: string): string {
  return type === 'IMPAIRMENT' ? '减值' : '重估';
}
function getStatusLabel(status?: string): string {
  const map: Record<string, string> = { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已拒绝' };
  return map[status ?? ''] ?? (status ?? '-');
}

// ── 状态样式配置 ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; ring: string }> = {
  PENDING:  { label: '待审批', dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   ring: 'ring-amber-200' },
  APPROVED: { label: '已通过', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  REJECTED: { label: '已拒绝', dot: 'bg-red-400',     text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     ring: 'ring-red-200' },
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

/** 类型徽章 */
function TypeBadge({ type }: { type?: string }) {
  const isImpairment = type === 'IMPAIRMENT';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${
        isImpairment
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-violet-200 bg-violet-50 text-violet-700'
      }`}
    >
      {isImpairment ? (
        <ArrowDownRight className="h-3 w-3" />
      ) : (
        <ArrowUpRight className="h-3 w-3" />
      )}
      {getTypeLabel(type)}
    </span>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────────────────────
export default function RevaluationListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['revaluations', page, statusFilter],
    queryFn: async () => {
      const params: any = { page, pageSize: 10 };
      if (statusFilter) params.status = statusFilter;
      const res = await getRevaluations(params);
      return { data: res?.records ?? res?.data ?? [], total: res?.total ?? 0 };
    },
  });

  const dataSource = queryResult?.data ?? [];
  const total = queryResult?.total ?? 0;

  // ── 状态计数（当前页） ──────────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dataSource.forEach((r: AssetRevaluation) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [dataSource]);

  const pendingCount  = statusCounts['PENDING']  ?? 0;
  const approvedCount = statusCounts['APPROVED'] ?? 0;
  const rejectedCount = statusCounts['REJECTED'] ?? 0;

  // ── 统计卡片 ────────────────────────────────────────────────────────────────────
  const statCards = useMemo(() => [
    { label: '总记录',   value: String(total),        icon: Package,    gradient: 'from-blue-600 to-cyan-500',    sub: '减值/重估合计' },
    { label: '待审批',   value: String(pendingCount), icon: Clock,      gradient: 'from-amber-500 to-orange-400', sub: '需及时处理' },
    { label: '已通过',   value: String(approvedCount), icon: CheckCircle, gradient: 'from-emerald-500 to-teal-400', sub: '本期已审批' },
    { label: '已拒绝',   value: String(rejectedCount), icon: XCircle,    gradient: 'from-red-500 to-rose-400',    sub: '本期驳回' },
  ], [total, pendingCount, approvedCount, rejectedCount]);

  // ── 快速筛选配置 ────────────────────────────────────────────────────────────────
  const quickFilters = [
    { key: 'PENDING',  label: '待审批' },
    { key: 'APPROVED', label: '已通过' },
    { key: 'REJECTED', label: '已拒绝' },
  ];

  // ── DataTable 列定义 ────────────────────────────────────────────────────────────
  const columns: Column<AssetRevaluation>[] = [
    {
      key: 'assetNo',
      title: '资产编号',
      width: 130,
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
          {row.assetNo || '-'}
        </span>
      ),
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (_, row) => (
        <span className="text-sm font-semibold text-slate-900 truncate">
          {row.assetName || '-'}
        </span>
      ),
    },
    {
      key: 'revaluationType',
      title: '类型',
      width: 100,
      render: (_, row) => <TypeBadge type={row.revaluationType} />,
    },
    {
      key: 'previousValue',
      title: '原值',
      width: 130,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm text-slate-600">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'newValue',
      title: '新值',
      width: 130,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-sm font-semibold text-slate-900">{formatAmount(v as number)}</span>
      ),
    },
    {
      key: 'diff',
      title: '差额',
      width: 140,
      align: 'right',
      render: (_, row) => {
        const diff = (row.newValue || 0) - (row.previousValue || 0);
        const isPositive = diff >= 0;
        return (
          <span className={`inline-flex items-center gap-0.5 font-mono text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {isPositive ? '+' : ''}{formatAmount(diff)}
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
            onClick={e => { e.stopPropagation(); navigate(`/revaluations/new?id=${row.id}`); }}
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
              <h1 className="text-xl font-bold text-slate-900">资产减值/重估</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                <TrendingUp className="h-3 w-3" />
                价值调整
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  <Clock className="h-3 w-3" />
                  {pendingCount} 项待审批
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/revaluations/new')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              新增减值/重估
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
        {/* Main Content Card                                                */}
        {/* ================================================================ */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">

          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            {/* Title row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-violet-600">
                  <Search className="h-3.5 w-3.5" />
                  减值/重估列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  资产价值调整记录
                </h2>
              </div>
              {statusFilter && (
                <button
                  type="button"
                  onClick={() => { setStatusFilter(''); setPage(1); }}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <X className="h-3 w-3" />
                  清除筛选
                </button>
              )}
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
                const isActive = statusFilter === key;
                const cfg = STATUS_CONFIG[key];
                const count = statusCounts[key] ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(isActive ? '' : key);
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
            {statusFilter && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Search className="h-3 w-3" />
                已筛选：{getStatusLabel(statusFilter)}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
                  onClick={() => { setStatusFilter(''); setPage(1); }}
                  title="清除筛选"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条记录
            </span>
            {pendingCount > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Clock className="h-3 w-3" />
                {pendingCount} 项待审批
              </span>
            )}
          </div>

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={dataSource}
              loading={isLoading}
              rowKey="id"
              onRowClick={(row) => navigate(`/revaluations/new?id=${row.id}`)}
              pagination={{
                page,
                pageSize: 10,
                total,
                onChange: (p) => setPage(p),
              }}
              emptyText="暂无减值/重估记录"
            />
          </div>
        </Card>

      </div>
    </div>
  );
}
