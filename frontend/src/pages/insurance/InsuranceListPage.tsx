/**
 * @file pages/insurance/InsuranceListPage.tsx
 * @description 保险列表管理页面
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Plus, Search, RefreshCw, Eye, Pencil, Trash2,
  Shield, ShieldCheck, ShieldX, ShieldOff, DollarSign, Filter, X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { insuranceApi } from '../../api/insurance';
import type { Insurance, InsuranceTypeEnum, InsuranceStatusEnum } from '../../types/insurance';

/* ── Constants ──────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = [
  { key: 'ACTIVE',    label: '生效中', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'EXPIRED',   label: '已过期', dot: 'bg-red-400',     text: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
  { key: 'CANCELLED', label: '已取消', dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
];

const TYPE_OPTIONS = [
  { key: 'PROPERTY',  label: '财产险' },
  { key: 'LIABILITY', label: '责任险' },
  { key: 'VEHICLE',   label: '车险' },
];

const TYPE_LABEL_MAP: Record<string, string> = {
  PROPERTY: '财产险',
  LIABILITY: '责任险',
  VEHICLE: '车险',
};

/* ── Component ──────────────────────────────────────────────────────────────── */

const InsuranceListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useState({
    keyword: '',
    insuranceType: undefined as InsuranceTypeEnum | undefined,
    status: undefined as InsuranceStatusEnum | undefined,
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
    pageNum: 1,
    pageSize: 10,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<Insurance | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['insurances', params],
    queryFn: () => insuranceApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: insuranceApi.delete,
    onSuccess: () => {
      toast.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['insurances'] });
      setDeleteConfirm(null);
    },
  });

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const list: Insurance[] = (data as any)?.list || [];
  const total: number = (data as any)?.total || 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    list.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [list]);

  const statCards = useMemo(() => {
    const totalPremium = list.reduce((sum, r) => sum + (r.premium || 0), 0);
    const activeCount = list.filter(r => r.status === 'ACTIVE').length;
    const expiredCount = list.filter(r => r.status === 'EXPIRED').length;
    return [
      { label: '保单总数', value: total, unit: '份', icon: Shield, gradient: 'from-blue-600 to-cyan-500' },
      { label: '生效中',   value: activeCount, unit: '份', icon: ShieldCheck, gradient: 'from-emerald-500 to-teal-400' },
      { label: '已过期',   value: expiredCount, unit: '份', icon: ShieldX, gradient: 'from-red-500 to-rose-400' },
      { label: '总保费',   value: `¥${totalPremium.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, unit: '', icon: DollarSign, gradient: 'from-amber-500 to-orange-400' },
    ];
  }, [list, total]);

  /* ── Handlers (unchanged logic) ───────────────────────────────────────── */

  const handleSearch = () => {
    setParams({ ...params, pageNum: 1 });
  };

  const handleReset = () => {
    setParams({
      keyword: '',
      insuranceType: undefined,
      status: undefined,
      startDate: undefined,
      endDate: undefined,
      pageNum: 1,
      pageSize: 10,
    });
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setParams({
        ...params,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD'),
      });
    } else {
      setParams({ ...params, startDate: undefined, endDate: undefined });
    }
  };

  const handleDelete = (record: Insurance) => {
    setDeleteConfirm(record);
  };

  const confirmDelete = () => {
    if (deleteConfirm?.id) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  /* ── Quick filter helpers ─────────────────────────────────────────────── */

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clearFn: () => void }[] = [];
    if (params.keyword) {
      chips.push({ key: 'keyword', label: `"${params.keyword}"`, clearFn: () => setParams({ ...params, keyword: '', pageNum: 1 }) });
    }
    if (params.insuranceType) {
      const t = TYPE_OPTIONS.find(o => o.key === params.insuranceType);
      chips.push({ key: 'type', label: t?.label ?? params.insuranceType, clearFn: () => setParams({ ...params, insuranceType: undefined, pageNum: 1 }) });
    }
    if (params.status) {
      const s = STATUS_OPTIONS.find(o => o.key === params.status);
      chips.push({ key: 'status', label: s?.label ?? params.status, clearFn: () => setParams({ ...params, status: undefined, pageNum: 1 }) });
    }
    if (params.startDate && params.endDate) {
      chips.push({ key: 'date', label: `${params.startDate} ~ ${params.endDate}`, clearFn: () => setParams({ ...params, startDate: undefined, endDate: undefined, pageNum: 1 }) });
    }
    return chips;
  }, [params]);

  /* ── Columns ──────────────────────────────────────────────────────────── */

  const columns: Column<Insurance>[] = [
    {
      key: 'policyNo',
      title: '保单号',
      width: 140,
      render: (v) => <span className="font-mono text-xs font-semibold text-blue-600">{String(v)}</span>,
    },
    {
      key: 'insuranceName',
      title: '保险名称',
      render: (v, row) => (
        <div className="min-w-[140px]">
          <span className="text-sm font-semibold text-slate-900">{String(v)}</span>
          <div className="mt-0.5 text-xs text-slate-400">{TYPE_LABEL_MAP[row.insuranceType] ?? row.insuranceType}</div>
        </div>
      ),
    },
    {
      key: 'insuranceType',
      title: '保险类型',
      width: 100,
      render: (v) => {
        const label = TYPE_LABEL_MAP[String(v)] ?? String(v);
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset">
            {label}
          </span>
        );
      },
    },
    {
      key: 'insurer',
      title: '保险公司',
      width: 120,
      render: (v) => <span className="text-xs text-slate-600">{String(v ?? '—')}</span>,
    },
    {
      key: 'premium',
      title: '保费',
      width: 110,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          ¥{Number(v ?? 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'startDate',
      title: '开始日期',
      width: 110,
      render: (v) => <span className="text-xs text-slate-500">{String(v ?? '—')}</span>,
    },
    {
      key: 'endDate',
      title: '结束日期',
      width: 110,
      render: (v) => <span className="text-xs text-slate-500">{String(v ?? '—')}</span>,
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (v) => {
        const cfg = STATUS_OPTIONS.find(o => o.key === String(v));
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
      key: 'id',
      title: '操作',
      width: 180,
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-1.5">
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={(e) => { e.stopPropagation(); navigate(`/insurance/${row.id}`); }}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </button>
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-amber-200 hover:text-amber-600"
            onClick={(e) => { e.stopPropagation(); navigate(`/insurance/${row.id}/edit`); }}
          >
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </button>
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600"
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* Header with stat bar */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">保险管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Shield className="h-3 w-3" />
                保单
              </span>
            </div>
            <Button variant="primary" size="md" onClick={() => navigate('/insurance/create')}>
              <Plus className="w-4 h-4" />
              新增保险
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
                  保单列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">保险台账管理</h2>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="h-3.5 w-3.5" />
                重置筛选
              </Button>
            </div>

            {/* Status quick filter pills */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setParams({ ...params, status: undefined, pageNum: 1 })}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !params.status
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部状态
              </button>
              {STATUS_OPTIONS.map(({ key, label, dot }) => {
                const active = params.status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setParams({ ...params, status: params.status === key ? undefined : (key as InsuranceStatusEnum), pageNum: 1 })}
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

            {/* Type quick filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400">类型:</span>
              <button
                type="button"
                onClick={() => setParams({ ...params, insuranceType: undefined, pageNum: 1 })}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  !params.insuranceType
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部类型
              </button>
              {TYPE_OPTIONS.map(({ key, label }) => {
                const active = params.insuranceType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setParams({ ...params, insuranceType: params.insuranceType === key ? undefined : (key as InsuranceTypeEnum), pageNum: 1 })}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
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

          {/* Search & date range toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="保单号/保险名称/保险公司"
                value={params.keyword}
                onChange={(e) => setParams({ ...params, keyword: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>起始:</span>
              <input
                type="date"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={params.startDate ?? ''}
                onChange={(e) => {
                  const newStart = e.target.value || undefined;
                  if (newStart && params.endDate) {
                    handleDateChange([
                      { format: () => newStart },
                      { format: () => params.endDate },
                    ]);
                  } else {
                    setParams({ ...params, startDate: newStart, endDate: undefined });
                  }
                }}
              />
              <span className="mx-1">~</span>
              <span>结束:</span>
              <input
                type="date"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={params.endDate ?? ''}
                onChange={(e) => {
                  const newEnd = e.target.value || undefined;
                  if (params.startDate && newEnd) {
                    handleDateChange([
                      { format: () => params.startDate },
                      { format: () => newEnd },
                    ]);
                  } else {
                    setParams({ ...params, endDate: newEnd });
                  }
                }}
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleSearch}>
              <Search className="h-3.5 w-3.5" />
              搜索
            </Button>
          </div>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                {activeFilterChips.length} 项筛选
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
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
            </div>
          )}

          {/* Data table */}
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              data={list}
              loading={isLoading}
              rowKey="id"
              onRowClick={(row) => navigate(`/insurance/${row.id}`)}
              pagination={{
                page: params.pageNum,
                pageSize: params.pageSize,
                total,
                onChange: (page, pageSize) => setParams({ ...params, pageNum: page, pageSize }),
              }}
              emptyText="暂无保险数据，点击「新增保险」开始录入"
            />
          </div>
        </Card>

        {/* Delete confirmation dialog (replaces window.confirm) */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600">
                确定要删除保单「{deleteConfirm?.policyNo}」吗？此操作不可撤销。
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
              <Button
                variant="destructive"
                loading={deleteMutation.isPending}
                onClick={confirmDelete}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default InsuranceListPage;
