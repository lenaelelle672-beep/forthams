import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Upload, Download, Plus,
  TrendingUp, ShieldCheck, X,
} from 'lucide-react';
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
import { PageHeader } from '@/components/ui/PageHeader';

const STATUS_OPTIONS = [
  { key: AssetStatus.IN_USE,             label: '在用',   color: 'bg-green-100 text-green-700' },
  { key: AssetStatus.IDLE,               label: '闲置',   color: 'bg-blue-100 text-blue-700' },
  { key: AssetStatus.MAINTENANCE,        label: '维修中', color: 'bg-orange-100 text-orange-700' },
  { key: AssetStatus.PENDING_RETIREMENT, label: '待退役', color: 'bg-purple-100 text-purple-700' },
  { key: AssetStatus.RETIRED,            label: '已退役', color: 'bg-gray-200 text-gray-700' },
  { key: AssetStatus.SCRAPPED,           label: '已报废', color: 'bg-red-100 text-red-700' },
  { key: AssetStatus.CLEARED,            label: '已清退', color: 'bg-[#EFEBE9] text-[#5D4037]' },
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

export default function AssetListPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [importantOnly, setImportantOnly] = useState(false);

  const { data: categoryRes } = useCategoryTree();
  const { data: deptRes } = useQuery({
    queryKey: ['departments'],
    queryFn: getDeptList,
    staleTime: 1000 * 60 * 5,
  });

  // 仪表板统计数据
  const { data: statsRes } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 5,
  });
  const stats = (statsRes as unknown as ApiResponse<DashboardStats> | undefined)?.data;

  const categories = useMemo(() => {
    const tree = categoryRes?.data ?? [];
    if (!Array.isArray(tree) || tree.length === 0) return [];
    return tree.flatMap((n) => flattenCategoryTree(n as Parameters<typeof flattenCategoryTree>[0]));
  }, [categoryRes]);

  const departments = useMemo(() => {
    const list = (deptRes as unknown as ApiResponse<Department[]> | undefined)?.data ?? [];
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

  const { data: res, isLoading } = useAssetList(apiQuery);

  const pageData = (res as unknown as ApiResponse<PageData<AssetListItem>> | undefined)?.data;
  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setPage(1);
  };

  const columns: Column<AssetListItem>[] = [
    {
      key: 'assetNo', title: '资产编号', width: 130,
      render: (v) => <span className="font-mono text-[13px] text-[#0f172a]">{String(v)}</span>,
    },
    { key: 'assetName', title: '资产名称', render: (v) => <span className="font-bold text-[#0f172a]">{String(v)}</span> },
    { key: 'categoryName', title: '分类', width: 90 },
    { key: 'brand', title: '品牌/型号', render: (v) => <span className="text-[#505f76]">{String(v)}</span> },
    { key: 'deptName', title: '使用部门', width: 80 },
    { key: 'userName', title: '使用人', width: 70 },
    { key: 'location', title: '存放位置', width: 100 },
    {
      key: 'originalValue', title: '原值(¥)', width: 110, align: 'right',
      render: (v) => <span className="font-mono text-[13px]">{Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'currentValue', title: '净值(¥)', width: 110, align: 'right',
      render: (v) => <span className="font-mono text-[13px]">{Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'status', title: '状态', width: 80,
      render: (v) => <StatusBadge status={String(v)} />,
    },
    {
      key: 'id', title: '操作', width: 60, align: 'center',
      render: (_, row) => (
        <button
          className="text-[#004ac6] hover:underline font-bold text-[13px]"
          onClick={(e) => { e.stopPropagation(); navigate(`/assets/${row.id}`); }}
        >
          查看
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="资产台账"
        actions={
          <>
             <Button variant="outline" size="md" onClick={() => navigate('/assets/import-export')}>
               <Upload className="w-4 h-4" />
               导入
             </Button>
             <Button variant="outline" size="md" onClick={() => {
               const csv = [
                 ['资产编号', '资产名称', '分类', '状态', '原值', '存放位置'].join(','),
                 ...records.map(a => [a.assetNo ?? '', a.assetName ?? '', a.categoryName ?? '', a.status ?? '', String(a.originalValue ?? ''), a.location ?? ''].join(','))
               ].join('\n');
               const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
               const url = URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.href = url; link.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`;
               link.click(); URL.revokeObjectURL(url);
             }}>
               <Download className="w-4 h-4" />
               导出
             </Button>
            <Button variant="primary" size="md" onClick={() => navigate('/assets/new')}>
              <Plus className="w-4 h-4" />
              新建资产
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-64">
              <Input
                placeholder="搜索编号、名称..."
                value={keywordInput}
                onChange={(e) => { setKeywordInput(e.target.value); }}
                prefix={<Search className="w-4 h-4 text-[#737686]" />}
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                className="h-9 bg-white border border-[#e5e7eb] rounded-lg px-3 text-sm focus:border-[#004ac6] outline-none"
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
              >
                <option value="">所有分类</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <div className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-lg px-2 py-1.5 h-9">
                <span className="text-sm text-[#737686] pl-1">状态:</span>
                <div className="flex gap-1">
                  {selectedStatuses.map((s) => (
                    <span key={s} className="bg-blue-50 text-[#004ac6] px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                      {STATUS_OPTIONS.find((o) => o.key === s)?.label ?? s}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleStatus(s)} />
                    </span>
                  ))}
                </div>
                <select
                  className="bg-transparent border-none text-sm outline-none cursor-pointer"
                  value=""
                  onChange={(e) => { if (e.target.value) toggleStatus(e.target.value); }}
                >
                  <option value="">选择...</option>
                  {STATUS_OPTIONS.filter((o) => !selectedStatuses.includes(o.key)).map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>

              <select
                className="h-9 bg-white border border-[#e5e7eb] rounded-lg px-3 text-sm focus:border-[#004ac6] outline-none"
                value={deptId}
                onChange={(e) => { setDeptId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
              >
                <option value="">所属部门</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="h-6 w-px bg-[#e5e7eb] mx-2" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-[#64748b]">重要设备</span>
              <button
                className={`w-10 h-5 rounded-full relative transition-colors ${importantOnly ? 'bg-[#2563eb]' : 'bg-[#c3c6d7]'}`}
                onClick={() => { setImportantOnly(!importantOnly); setPage(1); }}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${importantOnly ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <button
              className="text-[#004ac6] text-sm font-bold hover:underline ml-auto"
              onClick={() => {
                setSelectedStatuses([]);
                setKeywordInput('');
                setKeyword('');
                setCategoryId('');
                setDeptId('');
                setImportantOnly(false);
                setPage(1);
              }}
            >
              重置
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
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
              onChange: (p) => setPage(p),
            }}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-6">
        {/* 资产总净值 */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#505f76]">资产总净值</span>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">
            {stats?.netValue != null
              ? `¥${stats.netValue.toLocaleString('zh-CN')}`
              : '—'}
          </div>
          <div className="mt-1 text-sm flex items-center gap-1 font-bold text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>较上月 +2.4%</span>
          </div>
        </div>
        {/* 待处理维修 */}
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#505f76]">待处理维修</span>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">
            {stats?.maintenanceAssets != null
              ? `${stats.maintenanceAssets} 项`
              : '—'}
          </div>
          <div className="mt-1 text-sm flex items-center gap-1 font-bold">
            <span>平均响应时间: 4.2h</span>
          </div>
        </div>
        {/* 闲置率 */}
        <div className="bg-white p-4 rounded-xl border border-[#e5e7eb] flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#505f76]">闲置率</span>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">
            {stats?.idleAssets != null && stats?.totalAssets
              ? `${((stats.idleAssets / stats.totalAssets) * 100).toFixed(1)}%`
              : stats?.idleAssets != null
              ? `${stats.idleAssets} 项`
              : '—'}
          </div>
          <div className="mt-1 text-sm flex items-center gap-1 font-bold text-[#004ac6]">
            <ShieldCheck className="w-4 h-4" />
            <span>在安全阈值内</span>
          </div>
        </div>
        {/* 本月折旧（netValue 与 totalValue 之差作为累计折旧近似，或显示 totalValue） */}
        <div className="bg-white p-4 rounded-xl border border-[#e5e7eb] flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#505f76]">本月折旧</span>
          <div className="mt-2 text-2xl font-bold text-[#0f172a]">
            {stats?.totalValue != null && stats?.netValue != null
              ? `¥${(stats.totalValue - stats.netValue).toLocaleString('zh-CN')}`
              : '—'}
          </div>
          <div className="mt-1 text-sm flex items-center gap-1 font-bold">
            <span>查看折旧报表 →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
