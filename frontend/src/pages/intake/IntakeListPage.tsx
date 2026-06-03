/**
 * @file pages/intake/IntakeListPage.tsx
 * @description 入库验收列表页 — 设计系统 V3
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Search, Eye, Pencil, Download, Loader2,
  ClipboardCheck, X, Filter, RefreshCw, FileCheck,
  Clock, AlertCircle, CheckCircle2, XCircle, Ban,
  Package, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useIntakeOrders,
  useDeleteIntakeOrder,
} from '@/hooks/intake/useIntakeOrders';
import {
  IntakeStatus,
  INTAKE_STATUS_CONFIG,
  type IntakeOrder,
  type IntakeOrderListQuery,
} from '@/types/intake';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';

/* ──────────────────────────────
   Status visual config (design-system V3 pattern)
   ────────────────────────────── */

interface StatusVisual {
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUS_VISUALS: Record<IntakeStatus, StatusVisual> = {
  [IntakeStatus.DRAFT]: {
    label: '草稿', dot: 'bg-slate-400', text: 'text-slate-600',
    bg: 'bg-slate-50', border: 'border-slate-200', icon: FileCheck,
  },
  [IntakeStatus.PENDING_INSPECT]: {
    label: '待质检', dot: 'bg-blue-400', text: 'text-blue-700',
    bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock,
  },
  [IntakeStatus.INSPECTING]: {
    label: '质检中', dot: 'bg-amber-400', text: 'text-amber-700',
    bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertCircle,
  },
  [IntakeStatus.PARTIAL_ACCEPTED]: {
    label: '部分验收', dot: 'bg-violet-400', text: 'text-violet-700',
    bg: 'bg-violet-50', border: 'border-violet-200', icon: Package,
  },
  [IntakeStatus.ACCEPTED]: {
    label: '已验收', dot: 'bg-emerald-400', text: 'text-emerald-700',
    bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2,
  },
  [IntakeStatus.REJECTED]: {
    label: '已驳回', dot: 'bg-red-400', text: 'text-red-700',
    bg: 'bg-red-50', border: 'border-red-200', icon: XCircle,
  },
  [IntakeStatus.CANCELLED]: {
    label: '已取消', dot: 'bg-stone-400', text: 'text-stone-500',
    bg: 'bg-stone-50', border: 'border-stone-200', icon: Ban,
  },
};

const ALL_STATUSES = Object.values(IntakeStatus);

/* ──────────────────────────────
   Stat card definitions
   ────────────────────────────── */

interface StatCardDef {
  label: string;
  getValue: (records: IntakeOrder[], total: number) => string | number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

const STAT_CARDS: StatCardDef[] = [
  {
    label: '验收总数', unit: '单',
    getValue: (_, total) => total,
    icon: ClipboardCheck, gradient: 'from-blue-600 to-cyan-500',
  },
  {
    label: '待质检', unit: '单',
    getValue: (r) => r.filter(o => o.status === IntakeStatus.PENDING_INSPECT || o.status === IntakeStatus.INSPECTING).length,
    icon: Clock, gradient: 'from-amber-500 to-orange-400',
  },
  {
    label: '已验收', unit: '单',
    getValue: (r) => r.filter(o => o.status === IntakeStatus.ACCEPTED || o.status === IntakeStatus.PARTIAL_ACCEPTED).length,
    icon: TrendingUp, gradient: 'from-emerald-500 to-teal-400',
  },
  {
    label: '已驳回', unit: '单',
    getValue: (r) => r.filter(o => o.status === IntakeStatus.REJECTED).length,
    icon: XCircle, gradient: 'from-red-500 to-rose-400',
  },
];

/* ──────────────────────────────
   Component
   ────────────────────────────── */

export default function IntakeListPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntakeOrder | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(keywordInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const apiQuery: IntakeOrderListQuery = useMemo(() => ({
    page,
    pageSize,
    keyword: keyword || undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }), [page, pageSize, keyword, selectedStatuses, startDate, endDate]);

  const { data: pageRes, isLoading, isFetching } = useIntakeOrders(apiQuery);
  const deleteMutation = useDeleteIntakeOrder();

  const pageData = pageRes as unknown as {
    records?: IntakeOrder[]; total?: number; current?: number; pages?: number;
  } | undefined;
  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;

  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
    setPage(1);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => { counts[String(r.status)] = (counts[String(r.status)] || 0) + 1; });
    return counts;
  }, [records]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clearFn: () => void }[] = [];
    if (keyword) chips.push({
      key: 'keyword', label: `"${keyword}"`,
      clearFn: () => { setKeywordInput(''); setKeyword(''); setPage(1); },
    });
    selectedStatuses.forEach((s) => {
      chips.push({
        key: `status-${s}`, label: STATUS_VISUALS[s as IntakeStatus]?.label ?? s,
        clearFn: () => toggleStatus(s),
      });
    });
    if (startDate) chips.push({
      key: 'startDate', label: `起始: ${startDate}`,
      clearFn: () => { setStartDate(''); setPage(1); },
    });
    if (endDate) chips.push({
      key: 'endDate', label: `截止: ${endDate}`,
      clearFn: () => { setEndDate(''); setPage(1); },
    });
    return chips;
  }, [keyword, selectedStatuses, startDate, endDate, toggleStatus]);

  const handleReset = () => {
    setSelectedStatuses([]);
    setKeywordInput('');
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const allQuery: IntakeOrderListQuery = {
        page: 1, pageSize: 99999,
        keyword: keyword || undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const allRes = await useIntakeOrders as unknown as { queryFn: () => Promise<unknown> };
      const { getIntakeOrders } = await import('@/api/intake');
      const allData = await getIntakeOrders(allQuery);
      const allRecords = (allData as any)?.records ?? [];
      if (allRecords.length === 0) { toast.info('暂无数据可导出'); return; }
      const csv = [
        ['验收单号', '状态', '验收日期', '总金额', '创建时间'].join(','),
        ...allRecords.map((o: IntakeOrder) =>
          [
            o.orderNo ?? '',
            STATUS_VISUALS[o.status]?.label ?? o.status,
            o.orderDate ?? '',
            String(o.totalAmount ?? ''),
            o.createTime ?? '',
          ].join(',')
        ),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `intake-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${allRecords.length} 条验收单`);
    } catch {
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  /* ── Columns ── */

  const columns: Column<IntakeOrder>[] = [
    {
      key: 'orderNo', title: '验收单号', width: 140,
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
          {String(v)}
        </span>
      ),
    },
    {
      key: 'status', title: '状态', width: 120,
      render: (v) => {
        const cfg = STATUS_VISUALS[v as IntakeStatus];
        if (!cfg) return <span className="text-xs text-slate-400">{String(v)}</span>;
        const Icon = cfg.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'orderDate', title: '验收日期', width: 120,
      render: (v) => (
        <span className="text-xs text-slate-500">
          {(v as string) || '\u2014'}
        </span>
      ),
    },
    {
      key: 'totalAmount', title: '总金额', width: 130, align: 'right',
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {v != null ? `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '\u2014'}
        </span>
      ),
    },
    {
      key: 'createTime', title: '创建时间', width: 160,
      render: (v) => (
        <span className="text-xs text-slate-400">
          {(v as string) || '\u2014'}
        </span>
      ),
    },
    {
      key: 'id', title: '操作', width: 130, align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={() => navigate(`/intake/${row.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </button>
          {row.status === IntakeStatus.DRAFT && (
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDeleteTarget(row)}
              title="删除"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  /* ── Render ── */

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ① Compact header + stat strip */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">入库验收</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <ClipboardCheck className="h-3 w-3" />
                验收
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="md" disabled={exporting} onClick={handleExportCSV}>
                {exporting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                {exporting ? '导出中...' : '导出'}
              </Button>
              <Button variant="primary" size="md" onClick={() => navigate('/intake/new')}>
                <Plus className="w-4 h-4" />
                新建验收单
              </Button>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {STAT_CARDS.map((stat) => {
              const Icon = stat.icon;
              const val = stat.getValue(records, total);
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">
                      {val}
                      {stat.unit && <span className="ml-0.5 text-xs font-medium text-slate-400">{stat.unit}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ② Main content card */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">

          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  验收列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">入库验收管理</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setFilterOpen((v) => !v)}>
                  <Filter className="h-3.5 w-3.5" />
                  高级筛选
                  <span className={`ml-1 inline-block transition-transform ${filterOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </Button>
                {isFetching && !isLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    刷新中
                  </span>
                )}
              </div>
            </div>

            {/* Quick filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setSelectedStatuses([]); setPage(1); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedStatuses.length === 0
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                  {records.length}
                </span>
              </button>
              {ALL_STATUSES.map((status) => {
                const cfg = STATUS_VISUALS[status];
                const active = selectedStatuses.includes(status);
                const count = statusCounts[status] ?? 0;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                    <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Advanced filter panel */}
            {filterOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="搜索验收单号..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                  />
                </div>
                <input
                  type="date"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                />
                <span className="text-xs text-slate-400">至</span>
                <input
                  type="date"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                />
                <button className="text-xs font-bold text-blue-600 hover:underline" onClick={handleReset}>
                  重置
                </button>
              </div>
            )}
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {activeFilterChips.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                {activeFilterChips.length} 项筛选
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条验收单
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                  >
                    {chip.label}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700"
                      onClick={(e) => { e.stopPropagation(); chip.clearFn(); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* DataTable */}
          <div className="p-4 sm:p-5">
            <DataTable<IntakeOrder>
              columns={columns}
              data={records}
              loading={isLoading}
              rowKey="id"
              onRowClick={(row) => navigate(`/intake/${row.id}`)}
              pagination={{
                page,
                pageSize,
                total,
                onChange: (p, ps) => { setPage(p); if (ps && ps !== pageSize) setPageSize(ps); },
              }}
              emptyText="暂无验收单，点击「新建验收单」开始"
            />
          </div>
        </Card>
      </div>

      {/* ③ Delete confirm dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="确认删除"
        variant="destructive"
      >
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600">
            确定删除验收单 <span className="font-mono font-bold text-slate-900">{deleteTarget?.orderNo}</span> 吗？此操作不可恢复。
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
            取消
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={handleConfirmDelete}
          >
            {deleteMutation.isPending ? '删除中...' : '确认删除'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
