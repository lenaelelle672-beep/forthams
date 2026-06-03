/**
 * @file pages/assignment/AssignmentListPage.tsx
 * @description 领用归还列表页
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Search, Eye, Filter, X, Loader2, Download, RefreshCw,
  ClipboardList, Clock, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { useAssignments, useDeleteAssignment } from '@/hooks/assignment/useAssignments';
import {
  AssignmentStatus,
  ASSIGNMENT_STATUS_CONFIG,
  AllocationType,
  type AssetAssignment,
  type AssignmentListQuery,
} from '@/types/assignment';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { toast } from 'sonner';

// ── 状态筛选选项 ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { key: AssignmentStatus.DRAFT,            label: '草稿',   dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  { key: AssignmentStatus.PENDING_APPROVAL, label: '待审批', dot: 'bg-blue-400',    text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  { key: AssignmentStatus.APPROVED,         label: '已审批', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: AssignmentStatus.REJECTED,         label: '已驳回', dot: 'bg-red-400',     text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  { key: AssignmentStatus.CHECKED_OUT,      label: '已签收', dot: 'bg-violet-400',  text: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  { key: AssignmentStatus.RETURN_REQUESTED, label: '待归还', dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  { key: AssignmentStatus.RETURNED,         label: '已归还', dot: 'bg-stone-400',   text: 'text-stone-500',   bg: 'bg-stone-50',   border: 'border-stone-200' },
  { key: AssignmentStatus.CANCELLED,        label: '已取消', dot: 'bg-stone-400',   text: 'text-stone-500',   bg: 'bg-stone-50',   border: 'border-stone-200' },
];

// ── 领用类型筛选选项 ──────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { key: AllocationType.ASSIGNMENT, label: '长期领用', dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: AllocationType.BORROW,     label: '短期借用', dot: 'bg-amber-400',  text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { key: AllocationType.RETURN,     label: '归还入库', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: AllocationType.TRANSFER,   label: '调拨转移', dot: 'bg-violet-400', text: 'text-violet-600',  bg: 'bg-violet-50', border: 'border-violet-200' },
];

// ── 指标卡定义 ────────────────────────────────────────────────────────────────

interface StatCardDef {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

export default function AssignmentListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<AssignmentListQuery>({ page: 1, pageSize: 10 });
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(keywordInput);
      setQuery((prev) => ({ ...prev, keyword: keywordInput || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const { data: pageRes, isLoading, isFetching } = useAssignments(query);
  const deleteMutation = useDeleteAssignment();

  const pageData = pageRes as unknown as { records?: AssetAssignment[]; total?: number } | undefined;
  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;

  const handleSearch = () => {
    setQuery((prev) => ({
      ...prev,
      keyword,
      status: statusFilter || undefined,
      allocationType: typeFilter || undefined,
      page: 1,
    }));
  };

  const handleReset = () => {
    setKeywordInput('');
    setKeyword('');
    setStatusFilter('');
    setTypeFilter('');
    setQuery({ page: 1, pageSize: 10 });
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { getAssignments } = await import('@/api/assignment');
      const allData = await getAssignments({ page: 1, pageSize: 99999, status: statusFilter || undefined, allocationType: typeFilter || undefined, keyword: keyword || undefined });
      const allRecords = (allData as any)?.records ?? [];
      if (allRecords.length === 0) { toast.info('暂无数据可导出'); return; }
      const csv = [
        ['资产编号', '资产名称', '领用类型', '状态', '预计归还', '创建时间'].join(','),
        ...allRecords.map((r: AssetAssignment) =>
          [r.assetNo ?? '', r.assetName ?? '', TYPE_OPTIONS.find(o => o.key === r.allocationType)?.label ?? r.allocationType ?? '', STATUS_OPTIONS.find(o => o.key === r.status)?.label ?? r.status ?? '', r.expectedReturnDate ?? '', r.createTime ?? ''].join(',')
        ),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `assignments-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click(); URL.revokeObjectURL(url);
      toast.success(`已导出 ${allRecords.length} 条领用记录`);
    } catch { toast.error('导出失败，请重试'); }
    finally { setExporting(false); }
  };

  // ── 快捷状态筛选 ──────────────────────────────────────────────────────────

  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilter((prev) => (prev === status ? '' : status));
    setQuery((prev) => ({
      ...prev,
      keyword,
      status: (statusFilter === status ? '' : status) || undefined,
      allocationType: typeFilter || undefined,
      page: 1,
    }));
  }, [keyword, statusFilter, typeFilter]);

  const toggleTypeFilter = useCallback((type: string) => {
    setTypeFilter((prev) => (prev === type ? '' : type));
    setQuery((prev) => ({
      ...prev,
      keyword,
      status: statusFilter || undefined,
      allocationType: (typeFilter === type ? '' : type) || undefined,
      page: 1,
    }));
  }, [keyword, statusFilter, typeFilter]);

  // ── 统计指标 ────────────────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[String(r.status)] = (counts[String(r.status)] || 0) + 1;
    });
    return counts;
  }, [records]);

  const statCards: StatCardDef[] = useMemo(() => {
    const checkedOut = records.filter((r) => r.status === AssignmentStatus.CHECKED_OUT).length;
    const pending = records.filter(
      (r) => r.status === AssignmentStatus.PENDING_APPROVAL || r.status === AssignmentStatus.RETURN_REQUESTED,
    ).length;
    const returned = records.filter((r) => r.status === AssignmentStatus.RETURNED).length;
    return [
      { label: '总记录', value: total, icon: ClipboardList, gradient: 'from-blue-600 to-cyan-500' },
      { label: '已签收', value: checkedOut, icon: Clock, gradient: 'from-violet-500 to-purple-400' },
      { label: '待处理', value: pending, icon: CheckCircle2, gradient: 'from-amber-500 to-orange-400' },
      { label: '已归还', value: returned, icon: RotateCcw, gradient: 'from-emerald-500 to-teal-400' },
    ];
  }, [records, total]);

  // ── 列定义 ──────────────────────────────────────────────────────────────────

  const columns: Column<AssetAssignment>[] = useMemo(() => [
    {
      key: 'assetNo',
      title: '资产编号',
      width: 120,
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
          {v ? String(v) : '—'}
        </span>
      ),
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (v) => (
        <span className="text-sm font-semibold text-slate-900">{v ? String(v) : '—'}</span>
      ),
    },
    {
      key: 'allocationType',
      title: '领用类型',
      width: 110,
      render: (v) => {
        if (!v) return <span className="text-slate-400">—</span>;
        const cfg = TYPE_OPTIONS.find((o) => o.key === v);
        if (!cfg) return <span className="text-xs text-slate-500">{String(v)}</span>;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (v) => {
        const statusStr = String(v);
        const cfg = STATUS_OPTIONS.find((o) => o.key === statusStr);
        if (!cfg) {
          const fallback = ASSIGNMENT_STATUS_CONFIG[statusStr as AssignmentStatus];
          return fallback ? (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ color: fallback.color, backgroundColor: fallback.bgColor }}
            >
              {fallback.label}
            </span>
          ) : <span className="text-xs text-slate-400">{statusStr}</span>;
        }
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'expectedReturnDate',
      title: '预计归还',
      width: 120,
      render: (v) => (
        <span className="text-xs text-slate-500">{v ? String(v) : '—'}</span>
      ),
    },
    {
      key: 'createTime',
      title: '创建时间',
      width: 120,
      render: (v) => (
        <span className="text-xs text-slate-500">{v ? String(v) : '—'}</span>
      ),
    },
    {
      key: 'id',
      title: '操作',
      width: 80,
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end">
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/assignments/${row.id}`);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </button>
        </div>
      ),
    },
  ], [navigate]);

  // ── 渲染 ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── 紧凑头部 + 指标条 ───────────────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">资产领用归还</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <ClipboardList className="h-3 w-3" />
                领用
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={() => navigate('/assignments/new')}>
                <Plus className="w-4 h-4" />
                新建领用单
              </Button>
            </div>
          </div>

          {/* 指标条 */}
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
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 主内容区域 ──────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* 工具栏 */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  领用列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  领用归还管理
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索编号、名称..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" disabled={exporting} onClick={handleExportCSV}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {exporting ? '导出中...' : '导出'}
                </Button>
                {isFetching && !isLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    刷新中
                  </span>
                )}
                {(statusFilter || typeFilter || keywordInput) && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <Filter className="h-3.5 w-3.5" />
                    重置
                  </Button>
                )}
              </div>
            </div>

            {/* 状态快捷筛选 */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">状态</span>
              <button
                type="button"
                onClick={() => { setStatusFilter(''); setQuery((prev) => ({ ...prev, keyword, status: undefined, allocationType: typeFilter || undefined, page: 1 })); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !statusFilter
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
              </button>
              {STATUS_OPTIONS.map(({ key, label, dot }) => {
                const active = statusFilter === key;
                const count = statusCounts[key] ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleStatusFilter(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {label}
                    {count > 0 && (
                      <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 领用类型快捷筛选 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">类型</span>
              <button
                type="button"
                onClick={() => { setTypeFilter(''); setQuery((prev) => ({ ...prev, keyword, status: statusFilter || undefined, allocationType: undefined, page: 1 })); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !typeFilter
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部
              </button>
              {TYPE_OPTIONS.map(({ key, label, dot }) => {
                const active = typeFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTypeFilter(key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 结果摘要条 */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {(statusFilter || typeFilter) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                {(statusFilter ? 1 : 0) + (typeFilter ? 1 : 0)} 项筛选
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条记录
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {(statusFilter || typeFilter) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {statusFilter && (() => {
                  const cfg = STATUS_OPTIONS.find((o) => o.key === statusFilter);
                  return cfg ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {cfg.label}
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700"
                        onClick={() => { setStatusFilter(''); setQuery((prev) => ({ ...prev, keyword, allocationType: typeFilter || undefined, page: 1 })); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null;
                })()}
                {typeFilter && (() => {
                  const cfg = TYPE_OPTIONS.find((o) => o.key === typeFilter);
                  return cfg ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {cfg.label}
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700"
                        onClick={() => { setTypeFilter(''); setQuery((prev) => ({ ...prev, keyword, status: statusFilter || undefined, page: 1 })); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* 表格 */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={records}
              loading={isLoading}
              rowKey="id"
              onRowClick={(row) => navigate(`/assignments/${row.id}`)}
              pagination={{
                page: query.page || 1,
                pageSize: query.pageSize || 10,
                total,
                onChange: (p) => {
                  setQuery((prev) => ({ ...prev, page: p }));
                },
              }}
              emptyText="暂无领用记录"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
