/**
 * @file pages/borrow/BorrowListPage.tsx
 * @description 借用管理列表页
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Search, Eye, AlertTriangle, Handshake, Clock,
  AlertCircle, FileCheck, Filter, X, Loader2, Download,
  RefreshCw, User,
} from 'lucide-react';
import { useBorrows, useDeleteBorrow } from '@/hooks/borrow/useBorrows';
import { BorrowStatus, type AssetBorrow, type BorrowListQuery } from '@/types/borrow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

/* ── Status UI config (maps BorrowStatus → Tailwind classes for pills & badges) ── */

const STATUS_OPTIONS = [
  { key: BorrowStatus.DRAFT,            label: '草稿',   dot: 'bg-slate-400',   text: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200' },
  { key: BorrowStatus.PENDING_APPROVAL, label: '待审批', dot: 'bg-blue-400',    text: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  { key: BorrowStatus.APPROVED,         label: '已审批', dot: 'bg-emerald-400', text: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: BorrowStatus.REJECTED,         label: '已驳回', dot: 'bg-red-400',     text: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200' },
  { key: BorrowStatus.BORROWED,         label: '已借出', dot: 'bg-violet-400',  text: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-200' },
  { key: BorrowStatus.OVERDUE,          label: '已逾期', dot: 'bg-rose-400',    text: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-200' },
  { key: BorrowStatus.RETURNED,         label: '已归还', dot: 'bg-stone-400',   text: 'text-stone-500',  bg: 'bg-stone-50',   border: 'border-stone-200' },
  { key: BorrowStatus.CANCELLED,        label: '已取消', dot: 'bg-stone-400',   text: 'text-stone-500',  bg: 'bg-stone-50',   border: 'border-stone-200' },
] as const;

/* ── Stat card definition ── */

interface StatCardDef {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

export default function BorrowListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<BorrowListQuery>({ page: 1, pageSize: 10 });
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setKeyword(keywordInput); setQuery((prev) => ({ ...prev, keyword: keywordInput || undefined, page: 1 })); }, 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const { data: pageRes, isLoading, isFetching } = useBorrows(query);
  const pageData = pageRes as unknown as { records?: AssetBorrow[]; total?: number } | undefined;
  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [records]);

  const statCards: StatCardDef[] = useMemo(() => [
    { label: '借用总数', value: total, unit: '条', icon: Handshake, gradient: 'from-blue-600 to-cyan-500' },
    { label: '已借出', value: statusCounts[BorrowStatus.BORROWED] ?? 0, unit: '条', icon: FileCheck, gradient: 'from-violet-500 to-purple-400' },
    { label: '已逾期', value: statusCounts[BorrowStatus.OVERDUE] ?? 0, unit: '条', icon: AlertCircle, gradient: 'from-rose-500 to-red-400' },
    { label: '待审批', value: statusCounts[BorrowStatus.PENDING_APPROVAL] ?? 0, unit: '条', icon: Clock, gradient: 'from-amber-500 to-orange-400' },
  ], [total, statusCounts]);

  const handleStatusFilter = (status: string) => {
    const next = selectedStatus === status ? '' : status;
    setSelectedStatus(next);
    setQuery((prev) => ({ ...prev, status: next || undefined, page: 1 }));
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { getBorrows } = await import('@/api/borrow');
      const allData = await getBorrows({ page: 1, pageSize: 99999, status: selectedStatus || undefined, keyword: keyword || undefined });
      const allRecords = (allData as any)?.records ?? [];
      if (allRecords.length === 0) { toast.info('暂无数据可导出'); return; }
      const csv = [
        ['资产编号', '资产名称', '状态', '借用人', '借用日期', '预计归还', '用途'].join(','),
        ...allRecords.map((r: AssetBorrow) =>
          [r.assetNo ?? '', r.assetName ?? '', STATUS_OPTIONS.find(o => o.key === r.status)?.label ?? r.status, r.borrowerName ?? '', r.borrowDate ?? '', r.expectedReturnDate ?? '', r.purpose ?? ''].join(',')
        ),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `borrows-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click(); URL.revokeObjectURL(url);
      toast.success(`已导出 ${allRecords.length} 条借用记录`);
    } catch { toast.error('导出失败，请重试'); }
    finally { setExporting(false); }
  };

  /* ── Column definitions ── */

  const columns: Column<AssetBorrow>[] = [
    {
      key: 'assetNo', title: '资产编号', width: 120,
      render: (v) => <span className="font-mono text-xs font-semibold text-blue-600">{String(v || '—')}</span>,
    },
    {
      key: 'assetName', title: '资产名称',
      render: (v, row) => (
        <div className="flex items-center gap-2">
          {row.status === BorrowStatus.OVERDUE && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-semibold text-slate-900">{String(v || '—')}</span>
        </div>
      ),
    },
    {
      key: 'borrowerName', title: '借用人', width: 100,
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
            {v ? String(v).charAt(0) : '?'}
          </span>
          <span className="text-xs text-slate-600">{String(v || '—')}</span>
        </div>
      ),
    },
    {
      key: 'status', title: '状态', width: 110,
      render: (v) => {
        const statusStr = String(v);
        const cfg = STATUS_OPTIONS.find(o => o.key === statusStr);
        if (!cfg) return <span className="text-xs text-slate-500">{statusStr}</span>;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'borrowDate', title: '借用日期', width: 120,
      render: (v) => <span className="text-xs text-slate-500">{String(v || '—')}</span>,
    },
    {
      key: 'expectedReturnDate', title: '预计归还', width: 120,
      render: (v, row) => (
        <span className={row.status === BorrowStatus.OVERDUE ? 'text-xs font-medium text-red-600' : 'text-xs text-slate-500'}>
          {String(v || '—')}
        </span>
      ),
    },
    {
      key: 'purpose', title: '用途', width: 200,
      render: (v) => <span className="block max-w-[200px] truncate text-xs text-slate-500">{String(v || '—')}</span>,
    },
    {
      key: 'id', title: '操作', width: 100, align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-1.5">
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={(e) => { e.stopPropagation(); navigate(`/borrows/${row.id}`); }}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* Header with integrated stat bar */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">资产借用</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Handshake className="h-3 w-3" />
                借用管理
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={() => navigate('/borrows/new')}>
                <Plus className="w-4 h-4" />
                新建借用单
              </Button>
            </div>
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
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main content card */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  借用列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  借用记录管理
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索用途/备注..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" disabled={exporting} onClick={handleExportCSV}>
                  {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {exporting ? '导出中...' : '导出'}
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
                onClick={() => handleStatusFilter('')}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedStatus === ''
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                  {records.length}
                </span>
              </button>
              {STATUS_OPTIONS.map(({ key, label, dot }) => {
                const active = selectedStatus === key;
                const count = statusCounts[key] ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleStatusFilter(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {label}
                    <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {selectedStatus && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                1 项筛选
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条借用记录
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {selectedStatus && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const cfg = STATUS_OPTIONS.find(o => o.key === selectedStatus);
                  if (!cfg) return null;
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {cfg.label}
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700"
                        onClick={() => handleStatusFilter('')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={records}
              loading={isLoading}
              rowKey="id"
              onRowClick={(row) => navigate(`/borrows/${row.id}`)}
              pagination={{
                page: query.page ?? 1,
                pageSize: query.pageSize ?? 10,
                total,
                onChange: (p, ps) => setQuery((prev) => ({ ...prev, page: p, pageSize: ps })),
              }}
              emptyText="暂无借用记录，点击「新建借用单」开始申请"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
