import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Upload, Download, Plus,
  X, Loader2, Package, TrendingUp, AlertTriangle, Wrench,
  Filter, RefreshCw, Eye, Pencil, BarChart3, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAssetList, useCategoryTree } from '@/hooks/asset/useAssets';
import { AssetStatus } from '@/types/asset';
import type { AssetListQuery, AssetListItem, DashboardStats } from '@/types/asset';
import type { ApiResponse, PageData, Department } from '@/types/common';
import { getDeptList } from '@/api/base';
import { getDashboardStats } from '@/api/asset';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import http from '@/utils/http';

const STATUS_OPTIONS = [
  { key: AssetStatus.IN_USE,             label: '在用',   dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: AssetStatus.IDLE,               label: '闲置',   dot: 'bg-blue-400', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: AssetStatus.MAINTENANCE,        label: '维修中', dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: AssetStatus.PENDING_RETIREMENT, label: '待退役', dot: 'bg-violet-400', text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { key: AssetStatus.RETIRED,            label: '已退役', dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
  { key: AssetStatus.SCRAPPED,           label: '已报废', dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { key: AssetStatus.CLEARED,            label: '已清退', dot: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
];

function flattenCategoryTree(tree: { id: number; categoryName: string; children?: { id: number; categoryName: string; children?: unknown[] }[] }): { id: number; name: string }[] {
  const result: { id: number; name: string }[] = [];
  const walk = (nodes: typeof tree[]) => {
    for (const node of nodes) {
      result.push({ id: node.id, name: node.categoryName });
      if (node.children) walk(node.children as typeof tree[]);
    }
  };
  walk([tree]);
  return result;
}

interface StatCardDef {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

export default function AssetListPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [importantOnly, setImportantOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: categoryRes } = useCategoryTree();
  const { data: deptRes } = useQuery({
    queryKey: ['departments'],
    queryFn: getDeptList,
    staleTime: 1000 * 60 * 5,
  });

  const { data: statsRes } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5,
  });
  const stats = statsRes as unknown as DashboardStats | undefined;

  const categories = useMemo(() => {
    const tree = categoryRes?.data ?? [];
    if (!Array.isArray(tree) || tree.length === 0) return [];
    return tree.flatMap((n) => flattenCategoryTree(n as Parameters<typeof flattenCategoryTree>[0]));
  }, [categoryRes]);

  const departments = useMemo(() => {
    const raw = deptRes as unknown as Department[] | undefined;
    const list = Array.isArray(raw) ? raw : [];
    const flat: { id: number; name: string }[] = [];
    const walk = (nodes: Department[]) => {
      for (const node of nodes) {
        flat.push({ id: node.id, name: node.deptName });
        if (node.children) walk(node.children);
      }
    };
    walk(list);
    return flat;
  }, [deptRes]);

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(keywordInput), 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const apiQuery: AssetListQuery = useMemo(() => ({
    page,
    pageSize,
    keyword: keyword || undefined,
    categoryId: categoryId || undefined,
    deptId: deptId || undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined,
    isImportant: importantOnly ? 1 : undefined,
  }), [page, pageSize, keyword, categoryId, deptId, selectedStatuses, importantOnly]);

  const { data: res, isLoading, isFetching } = useAssetList(apiQuery);

  const pageData = res as unknown as PageData<AssetListItem> | undefined;
  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;

  const toggleStatus = useCallback((status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
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
    if (keyword) chips.push({ key: 'keyword', label: `"${keyword}"`, clearFn: () => { setKeywordInput(''); setKeyword(''); setPage(1); } });
    if (categoryId) chips.push({ key: 'category', label: categories.find(c => c.id === categoryId)?.name ?? '已选分类', clearFn: () => { setCategoryId(''); setPage(1); } });
    if (deptId) chips.push({ key: 'dept', label: departments.find(d => d.id === deptId)?.name ?? '已选部门', clearFn: () => { setDeptId(''); setPage(1); } });
    selectedStatuses.forEach(s => {
      const opt = STATUS_OPTIONS.find(o => o.key === s);
      chips.push({ key: `status-${s}`, label: opt?.label ?? s, clearFn: () => toggleStatus(s) });
    });
    if (importantOnly) chips.push({ key: 'important', label: '重要设备', clearFn: () => { setImportantOnly(false); setPage(1); } });
    return chips;
  }, [keyword, categoryId, deptId, selectedStatuses, importantOnly, categories, departments, toggleStatus]);

  const statCards: StatCardDef[] = [
    {
      label: '资产总净值',
      value: stats?.netValue != null ? `¥${stats.netValue.toLocaleString('zh-CN')}` : '—',
      unit: '',
      icon: Package,
      gradient: 'from-blue-600 to-cyan-500',
    },
    {
      label: '待处理维修',
      value: stats?.maintenanceAssets ?? '—',
      unit: '项',
      icon: Wrench,
      gradient: 'from-amber-500 to-orange-400',
    },
    {
      label: '闲置率',
      value: stats?.idleAssets != null && stats?.totalAssets
        ? `${((stats.idleAssets / stats.totalAssets) * 100).toFixed(1)}%`
        : stats?.idleAssets != null ? `${stats.idleAssets}` : '—',
      unit: stats?.idleAssets != null && !stats?.totalAssets ? '项' : '',
      icon: TrendingUp,
      gradient: 'from-violet-500 to-purple-400',
    },
    {
      label: '累计折旧',
      value: stats?.totalValue != null && stats?.netValue != null
        ? `¥${(stats.totalValue - stats.netValue).toLocaleString('zh-CN')}`
        : '—',
      unit: '',
      icon: BarChart3,
      gradient: 'from-emerald-500 to-teal-400',
    },
  ];

  const columns: Column<AssetListItem>[] = [
    {
      key: 'assetNo', title: '编号', width: 120,
      render: (v) => <span className="font-mono text-xs font-semibold text-blue-600">#{String(v)}</span>,
    },
    {
      key: 'assetName', title: '资产名称',
      render: (v, row) => (
        <div className="min-w-[160px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{String(v)}</span>
            {row.isImportant === 1 && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-200">重要</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{String(row.categoryName ?? '')}</div>
        </div>
      ),
    },
    {
      key: 'brand', title: '品牌/型号', width: 120,
      render: (v) => <span className="text-xs text-slate-500">{String(v)}</span>,
    },
    {
      key: 'deptName', title: '使用部门', width: 90,
      render: (v) => <span className="text-xs text-slate-600">{String(v ?? '—')}</span>,
    },
    {
      key: 'userName', title: '使用人', width: 80,
      render: (v) => <span className="text-xs text-slate-600">{String(v ?? '—')}</span>,
    },
    {
      key: 'location', title: '存放位置', width: 100,
      render: (v) => <span className="text-xs text-slate-500">{String(v ?? '—')}</span>,
    },
    {
      key: 'originalValue', title: '原值(¥)', width: 110, align: 'right',
      render: (v) => <span className="font-mono text-xs text-slate-600">{Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'currentValue', title: '净值(¥)', width: 110, align: 'right',
      render: (v) => <span className="font-mono text-xs font-semibold text-slate-800">{Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'status', title: '状态', width: 100,
      render: (v) => {
        const statusStr = String(v);
        const cfg = STATUS_OPTIONS.find(o => o.key === statusStr);
        if (!cfg) return <StatusBadge status={statusStr} />;
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
            onClick={(e) => { e.stopPropagation(); navigate(`/assets/${row.id}`); }}
          >
            <Eye className="h-3.5 w-3.5" />
            详情
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-blue-200 hover:text-blue-500"
            onClick={(e) => { e.stopPropagation(); navigate(`/assets/${row.id}/edit`); }}
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const handleReset = () => {
    setSelectedStatuses([]);
    setKeywordInput('');
    setKeyword('');
    setCategoryId('');
    setDeptId('');
    setImportantOnly(false);
    setPage(1);
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const allQuery: AssetListQuery = { page: 1, pageSize: 99999, keyword: keyword || undefined, categoryId: categoryId || undefined, deptId: deptId || undefined, status: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined, isImportant: importantOnly ? 1 : undefined };
      const allRes = await http.get('/assets', { params: allQuery });
      const allRecords = (allRes as any)?.records ?? [];
      if (allRecords.length === 0) { toast.info('暂无数据可导出'); return; }
      const csv = [
        ['资产编号', '资产名称', '分类', '状态', '原值', '存放位置'].join(','),
        ...allRecords.map((a: AssetListItem) => [a.assetNo ?? '', a.assetName ?? '', a.categoryName ?? '', a.status ?? '', String(a.originalValue ?? ''), a.location ?? ''].join(','))
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click(); URL.revokeObjectURL(url);
      toast.success(`已导出 ${allRecords.length} 条资产`);
    } catch {
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ① 紧凑头部 — 标题 + 指标条 */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">资产台账</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Package className="h-3 w-3" />
                台账
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="md" onClick={() => navigate('/assets/import-export')}>
                <Upload className="w-4 h-4" />
                导入/导出
              </Button>
              <Button variant="outline" size="md" disabled={exporting} onClick={handleExportCSV}>
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? '导出中...' : '导出全部'}
              </Button>
              <Button variant="primary" size="md" onClick={() => navigate('/assets/new')}>
                <Plus className="w-4 h-4" />
                新建资产
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

        {/* ② 主内容区域 — 全宽表格 */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* 工具栏 */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <Search className="h-3.5 w-3.5" />
                  资产列表
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  资产台账管理
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setFilterOpen((v) => !v)}>
                  <Filter className="h-3.5 w-3.5" />
                  高级筛选
                  <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                </Button>
                {isFetching && !isLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    刷新中
                  </span>
                )}
              </div>
            </div>

            {/* 快速筛选按钮 */}
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
              {STATUS_OPTIONS.map(({ key, label, dot }) => {
                const active = selectedStatuses.includes(key);
                const count = statusCounts[key] ?? 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleStatus(key)}
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

            {/* 高级筛选面板 */}
            {filterOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="搜索编号、名称..."
                    value={keywordInput}
                    onChange={(e) => { setKeywordInput(e.target.value); setPage(1); }}
                  />
                </div>
                <select
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
                >
                  <option value="">所有分类</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  value={deptId}
                  onChange={(e) => { setDeptId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
                >
                  <option value="">所属部门</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">重要设备</span>
                  <button
                    className={`relative h-5 w-10 rounded-full transition-colors ${importantOnly ? 'bg-blue-600' : 'bg-slate-200'}`}
                    onClick={() => { setImportantOnly(!importantOnly); setPage(1); }}
                  >
                    <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${importantOnly ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <button className="text-xs font-bold text-blue-600 hover:underline" onClick={handleReset}>重置</button>
              </div>
            )}
          </div>

          {/* 结果摘要条 */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {activeFilterChips.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                {activeFilterChips.length} 项筛选
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条资产
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {chip.label}
                    <button type="button" className="rounded-full p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); chip.clearFn(); }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
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
              onRowClick={(row) => navigate(`/assets/${row.id}`)}
              pagination={{
                page,
                pageSize,
                total,
                onChange: (p, ps) => { setPage(p); if (ps && ps !== pageSize) setPageSize(ps); },
              }}
              emptyText="暂无资产数据，点击「新建资产」开始录入"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
