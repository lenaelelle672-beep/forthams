/**
 * @file pages/spare-parts/SparePartListPage.tsx
 * @description 备品备件列表页面
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, AlertTriangle, Search, Package, ShieldAlert,
  CheckCircle2, Banknote, Eye, Filter, Trash2,
} from 'lucide-react';
import { getSparePartList, deleteSparePart } from '@/api/sparePart';
import type { SparePart } from '@/types/sparePart';
import type { PageData } from '@/types/common';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';

/* ── Status UI config ── */

const STATUS_OPTIONS = [
  { key: 'ENABLED',  label: '启用', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'DISABLED', label: '停用', dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
] as const;

/* ── Stat card definition ── */

interface StatCardDef {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

export default function SparePartListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState({ page: 1, pageSize: 20, keyword: '' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [keywordInput, setKeywordInput] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['spare-parts', 'list', params],
    queryFn: () => getSparePartList(params),
    placeholderData: (p) => p,
  });

  const pageData = (res as any)?.data as PageData<SparePart> | undefined;
  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;

  /* ── Derived stats ── */

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [records]);

  const lowStockCount = useMemo(
    () => records.filter((r) => Number(r.currentStock) < Number(r.safetyStock)).length,
    [records],
  );

  const statCards: StatCardDef[] = useMemo(() => [
    {
      label: '备件总数',
      value: total,
      unit: '项',
      icon: Package,
      gradient: 'from-blue-600 to-cyan-500',
    },
    {
      label: '库存告警',
      value: lowStockCount,
      unit: '项',
      icon: ShieldAlert,
      gradient: 'from-rose-500 to-red-400',
    },
    {
      label: '已启用',
      value: statusCounts['ENABLED'] ?? 0,
      unit: '项',
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-teal-400',
    },
    {
      label: '库存总价值',
      value: (() => {
        const sum = records.reduce(
          (acc, r) => acc + Number(r.currentStock) * Number(r.unitPrice ?? 0),
          0,
        );
        return sum > 0 ? `¥${sum.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '—';
      })(),
      unit: '',
      icon: Banknote,
      gradient: 'from-amber-500 to-orange-400',
    },
  ], [total, lowStockCount, statusCounts, records]);

  /* ── Status filter handler ── */

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setParams((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearch = () => {
    setParams((prev) => ({ ...prev, keyword: keywordInput, page: 1 }));
  };

  /* ── Column definitions ── */

  const columns: Column<SparePart>[] = [
    {
      key: 'partNo', title: '备件编码', width: 130,
      render: (v) => <span className="font-mono text-xs font-semibold text-blue-600">#{String(v)}</span>,
    },
    {
      key: 'partName', title: '备件名称',
      render: (v, row) => (
        <div className="min-w-[160px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{String(v)}</span>
            {Number(row.currentStock) < Number(row.safetyStock) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0 text-[10px] font-bold text-red-600 ring-1 ring-inset ring-red-200">
                <AlertTriangle className="h-2.5 w-2.5" />
                低库存
              </span>
            )}
          </div>
          {row.specification && (
            <div className="mt-0.5 text-xs text-slate-400">{row.specification}</div>
          )}
        </div>
      ),
    },
    {
      key: 'currentStock', title: '当前库存', width: 110,
      render: (v, row) => {
        const stock = Number(v);
        const safety = Number(row.safetyStock);
        const isLow = stock < safety;
        return (
          <span className={`inline-flex items-center gap-1.5 ${isLow ? 'font-semibold text-red-600' : 'text-slate-700'}`}>
            {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            <span className="text-sm">{stock}</span>
            <span className="text-xs text-slate-400">{row.unit}</span>
          </span>
        );
      },
    },
    {
      key: 'safetyStock', title: '安全库存', width: 100,
      render: (v, row) => (
        <span className="text-xs text-slate-500">{String(v)} {row.unit}</span>
      ),
    },
    {
      key: 'unitPrice', title: '单价', width: 100, align: 'right',
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">
          {v ? `¥${Number(v).toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (v) => {
        const statusStr = String(v);
        const cfg = STATUS_OPTIONS.find((o) => o.key === statusStr);
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
      key: 'id', title: '操作', width: 120, align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-1.5">
          <button
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
            onClick={(e) => { e.stopPropagation(); navigate(`/spare-parts/${row.id}`); }}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
            onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  /* ── Delete handler ── */

  const handleDelete = async (id: number) => {
    try {
      await deleteSparePart(id);
      toast.success('删除成功');
      setDeleteId(null);
      setParams(prev => ({ ...prev }));
    } catch (err: any) {
      toast.error(err?.message || '删除失败');
    }
  };

  /* ── Filtered records (client-side status filter) ── */

  const filteredRecords = useMemo(() => {
    if (!selectedStatus) return records;
    return records.filter((r) => r.status === selectedStatus);
  }, [records, selectedStatus]);

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* Header with integrated stat bar */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">备品备件管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Package className="h-3 w-3" />
                备件
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={() => navigate('/spare-parts/new')}>
                <Plus className="w-4 h-4" />
                新增备件
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
                  备件列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  备件库存管理
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索备件编码/名称..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch}>搜索</Button>
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
              共 <span className="font-bold text-slate-700">{total}</span> 条备件
              {' · '}本页 <span className="font-bold text-slate-700">{filteredRecords.length}</span> 条
            </span>
            {selectedStatus && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const cfg = STATUS_OPTIONS.find((o) => o.key === selectedStatus);
                  if (!cfg) return null;
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {cfg.label}
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700"
                        onClick={() => handleStatusFilter('')}
                      >
                        <span className="sr-only">清除</span>
                        &times;
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
              data={filteredRecords}
              loading={isLoading}
              rowKey="id"
              onRowClick={(row) => navigate(`/spare-parts/${row.id}`)}
              pagination={{
                page: params.page,
                pageSize: params.pageSize,
                total,
                onChange: (p, ps) => setParams((prev) => ({ ...prev, page: p, pageSize: ps })),
              }}
              emptyText="暂无备件数据，点击「新增备件」开始录入"
            />
          </div>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">确定要删除此备件吗？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
