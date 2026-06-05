import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Wallet,
  Clock,
  Recycle,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { getRetirementList } from '@/api/retirement';
import { getDeptList } from '@/api/base';
import type { RetirementStatus, RetirementApplication, RetirementListQuery } from '@/api/retirement';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import type { Department, PageData } from '@/types/common';
import { Input } from '@/components/ui/Input';

/**
 * Status visual configuration for retirement applications.
 * Maps each RetirementStatus to a label, badge variant, and optional custom CSS class.
 * The `dotColor` field ensures the status badge dot matches the semantic color
 * used in both the table column and the quick-filter summary bar.
 */
const STATUS_CONFIG: Record<
  RetirementStatus,
  { label: string; variant: 'gray' | 'default' | 'warning' | 'success' | 'danger' | 'purple'; cls?: string; dotColor: string; ring?: string; bg?: string }
> = {
  DRAFT: {
    label: '草稿',
    variant: 'gray',
    dotColor: 'bg-gray-400',
    ring: 'ring-gray-200',
    bg: 'bg-gray-50 text-gray-700 border-gray-200',
  },
  PENDING: {
    label: '待审批',
    variant: 'warning',
    cls: 'bg-[#fef3c7] text-[#d97706] border-[#d97706]/10',
    dotColor: 'bg-[#d97706]',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  APPROVING: {
    label: '审批中',
    variant: 'default',
    cls: 'bg-[#dbeafe] text-[#2563eb] border-[#2563eb]/10',
    dotColor: 'bg-[#2563eb]',
    ring: 'ring-blue-200',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  APPROVED: {
    label: '已通过',
    variant: 'success',
    dotColor: 'bg-green-500',
    ring: 'ring-green-200',
    bg: 'bg-green-50 text-green-700 border-green-200',
  },
  REJECTED: {
    label: '已驳回',
    variant: 'danger',
    cls: 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10',
    dotColor: 'bg-[#ba1a1a]',
    ring: 'ring-red-200',
    bg: 'bg-red-50 text-red-700 border-red-200',
  },
  WITHDRAWN: {
    label: '已撤回',
    variant: 'gray',
    dotColor: 'bg-gray-400',
    ring: 'ring-gray-200',
    bg: 'bg-gray-50 text-gray-600 border-gray-200',
  },
  COMPLETED: {
    label: '已完成',
    variant: 'gray',
    cls: 'bg-[#dee2f2] text-[#64748b] border-[#64748b]/10',
    dotColor: 'bg-[#64748b]',
    ring: 'ring-slate-200',
    bg: 'bg-slate-50 text-slate-600 border-slate-200',
  },
};

/**
 * Quick-filter tabs shown above the data table.
 * Each entry provides a status key, display label, and the same semantic dot
 * colour used in STATUS_CONFIG so the summary bar stays visually consistent
 * with the in-table status badges.
 */
const QUICK_FILTERS: { key: RetirementStatus | ''; label: string; dotColor: string }[] = [
  { key: '', label: '全部', dotColor: '' },
  { key: 'PENDING', label: '待审批', dotColor: STATUS_CONFIG.PENDING.dotColor },
  { key: 'APPROVING', label: '审批中', dotColor: STATUS_CONFIG.APPROVING.dotColor },
  { key: 'COMPLETED', label: '已完成', dotColor: STATUS_CONFIG.COMPLETED.dotColor },
  { key: 'REJECTED', label: '异常/已驳回', dotColor: STATUS_CONFIG.REJECTED.dotColor },
  { key: 'WITHDRAWN', label: '已撤回', dotColor: STATUS_CONFIG.WITHDRAWN.dotColor },
];

type FlatDepartment = { id: number; name: string; level: number };

function flattenDepartments(tree: Department[] = [], level = 0): FlatDepartment[] {
  return tree.flatMap((dept) => [
    {
      id: dept.id,
      name: dept.deptName || dept.name || `部门#${dept.id}`,
      level,
    },
    ...flattenDepartments(dept.children ?? [], level + 1),
  ]);
}

/**
 * Compute metric summary cards from the current page of retirement records.
 * Shows total value, pending count, residual recovery, and top retirement reason.
 */
function buildMetricCards(records: RetirementApplication[]) {
  const totalValue = records.reduce((sum, r) => sum + (Number((r as unknown as Record<string, unknown>).originalValue) || 0), 0);
  const pendingCount = records.filter((r) => r.status === 'PENDING').length;
  const totalResidual = records.reduce((sum, r) => sum + (Number(r.residualValue) || 0), 0);
  const residualRate = totalValue > 0 ? ((totalResidual / totalValue) * 100).toFixed(0) : '0';

  const reasonMap = new Map<string, number>();
  records.forEach((r) => {
    if (r.reason) reasonMap.set(r.reason, (reasonMap.get(r.reason) || 0) + 1);
  });
  let topReason = '—';
  let topReasonCount = 0;
  let totalReasons = 0;
  reasonMap.forEach((count, reason) => {
    totalReasons += count;
    if (count > topReasonCount) { topReasonCount = count; topReason = reason; }
  });
  const reasonPct = totalReasons > 0 ? ((topReasonCount / totalReasons) * 100).toFixed(0) : '0';

  return [
    { label: '退役总价值', value: `¥${totalValue.toLocaleString()}`, sub: `共 ${records.length} 条记录`, subColor: 'text-[#64748b]', icon: Wallet, iconGradient: 'from-blue-500 to-indigo-600' },
    { label: '待审核', value: `${pendingCount} 项申请`, sub: pendingCount > 0 ? '需要及时处理' : '暂无待审核', subColor: pendingCount > 0 ? 'text-[#d97706]' : 'text-[#64748b]', icon: Clock, iconGradient: 'from-amber-400 to-orange-500' },
    { label: '残值回收', value: `¥${totalResidual.toLocaleString()}`, sub: `回收率 ${residualRate}%`, subColor: 'text-[#64748b]', icon: Recycle, iconGradient: 'from-emerald-400 to-green-600' },
    { label: '主要退役原因', value: topReason, sub: `占全部退役的 ${reasonPct}%`, subColor: 'text-[#64748b]', icon: AlertTriangle, iconGradient: 'from-red-400 to-rose-600' },
  ];
}

/**
 * RetirementListPage — retirement application list with enhanced status filtering
 * and visual status differentiation for pending / in-progress / completed / anomaly items.
 */
export default function RetirementListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState<{ page: number; pageSize: number; keyword?: string; status?: string; deptId?: number; dateRange?: string }>({ page: 1, pageSize: 20 });

  const { data: res, isLoading } = useQuery({
    queryKey: ['retirement', 'list', params],
    queryFn: () => getRetirementList(params as RetirementListQuery),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records = (res as PageData<RetirementApplication> | undefined)?.records ?? [];
  const total = (res as PageData<RetirementApplication> | undefined)?.total ?? 0;

  const { data: deptRes = [] } = useQuery({
    queryKey: ['system', 'depts'],
    queryFn: getDeptList,
    staleTime: 1000 * 60,
  });

  const departments = useMemo(() => {
    const tree = Array.isArray(deptRes) ? (deptRes as Department[]) : [];
    return flattenDepartments(tree);
  }, [deptRes]);

  /** Compute per-status counts for the quick-filter summary bar */
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<RetirementStatus, number>> = {};
    records.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [records]);

  const metrics = useMemo(() => buildMetricCards(records), [records]);

  /** Active filter chips for the result summary bar */
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (params.status) {
      const cfg = STATUS_CONFIG[params.status as RetirementStatus];
      chips.push({
        label: `状态: ${cfg?.label ?? params.status}`,
        onRemove: () => setParams((p) => ({ ...p, status: undefined, page: 1 })),
      });
    }
    if (params.deptId) {
      const dept = departments.find((d) => d.id === params.deptId);
      chips.push({
        label: `部门: ${dept?.name ?? params.deptId}`,
        onRemove: () => setParams((p) => ({ ...p, deptId: undefined, page: 1 })),
      });
    }
    if (params.keyword) {
      chips.push({
        label: `搜索: ${params.keyword}`,
        onRemove: () => setParams((p) => ({ ...p, keyword: undefined, page: 1 })),
      });
    }
    return chips;
  }, [params.status, params.deptId, params.keyword, departments]);

  const columns: Column<any>[] = [
    {
      key: 'id',
      title: '申请编号',
      width: 150,
      render: (v) => <span className="text-[13px] font-semibold text-[#004191]">{String(v)}</span>,
    },
    {
      key: 'assetNo',
      title: '资产编号',
      width: 110,
      render: (v) => <span className="text-[11px] font-mono text-[#64748b]">{String(v)}</span>,
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (v) => <span className="text-[13px] font-medium text-[#161c27]">{String(v ?? '—')}</span>,
    },
    {
      key: 'categoryName',
      title: '分类',
      width: 100,
      render: (v) => (
        <span className="px-2 py-0.5 bg-[#dee2f2] text-[#64748b] text-[11px] font-bold rounded uppercase tracking-wider">
          {String(v ?? '—')}
        </span>
      ),
    },
    {
      key: 'originalValue',
      title: '原值',
      width: 120,
      align: 'right',
      render: (v) => (
        <span className="text-[13px] font-medium text-[#161c27]">
          {v != null ? `¥${Number(v).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'residualValue',
      title: '残值',
      width: 120,
      align: 'right',
      render: (v) => (
        <span className="text-[13px] text-[#64748b]">
          {v != null ? `¥${Number(v).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'reason',
      title: '退役原因',
      width: 140,
      render: (v) => <span className="text-[11px] text-[#64748b] line-clamp-1">{String(v ?? '—')}</span>,
    },
    {
      key: 'applicantName',
      title: '申请人',
      width: 110,
      render: (v) => <span className="text-[13px] text-[#161c27]">{String(v ?? '—')}</span>,
    },
    {
      key: 'status',
      title: '状态',
      width: 130,
      render: (v) => {
        const cfg = STATUS_CONFIG[v as RetirementStatus];
        if (!cfg) return <Badge>{String(v)}</Badge>;
        /** Status badge — modern ring-1 ring-inset pattern with colored dot */
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.ring ?? 'ring-gray-200'} ${cfg.bg ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'id',
      title: '操作',
      width: 90,
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-[#004191] transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/retirement/${row.id}`); }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>查看</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <nav className="mb-1.5 flex items-center text-[10px] text-[#64748b] space-x-2 uppercase tracking-wider">
                <a className="hover:text-[#004191] cursor-pointer" onClick={() => navigate('/dashboard')}>首页</a>
                <span className="text-[#94a3b8]">/</span>
                <span className="text-[#004191] font-bold">资产退役</span>
              </nav>
              <h1 className="text-xl font-bold text-[#161c27]">资产退役管理</h1>
              <p className="mt-0.5 text-xs text-[#64748b]">管理资产生命周期终止、处置流程和退役记录。</p>
            </div>
            <Button size="md" onClick={() => navigate('/retirement/new')}>
              <Plus className="w-4 h-4" />
              新建退役申请
            </Button>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {metrics.map(({ label, value, sub, subColor, icon: Icon, iconGradient }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-4">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${iconGradient} text-white shadow-sm`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">{label}</p>
                  <p className="truncate text-sm font-bold text-[#161c27]">{value}</p>
                  <p className={`truncate text-[10px] ${subColor}`}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Main content Card ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">

          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3">
                <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider font-medium">搜索申请</label>
                <Input
                  placeholder="搜索编号或资产..."
                  prefix={<Search className="w-4 h-4" />}
                  onChange={(e) => setParams((p) => ({ ...p, keyword: e.target.value, page: 1 }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider font-medium">状态</label>
                <select
                  className="w-full px-3 py-2 bg-white border border-[#e5e7eb] rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/10 focus:border-[#004191] outline-none transition-all"
                  value={params.status ?? ''}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      status: (e.target.value || undefined) as RetirementStatus | undefined,
                      page: 1,
                    }))
                  }
                >
                  <option value="">全部状态</option>
                  <option value="PENDING">待审批</option>
                  <option value="APPROVING">审批中</option>
                  <option value="COMPLETED">已完成</option>
                  <option value="REJECTED">已驳回</option>
                  <option value="WITHDRAWN">已撤回</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider font-medium">部门</label>
                <select
                  className="w-full px-3 py-2 bg-white border border-[#e5e7eb] rounded-lg text-[13px] focus:ring-2 focus:ring-[#004191]/10 focus:border-[#004191] outline-none transition-all"
                  value={params.deptId ?? ''}
                  onChange={(e) =>
                    setParams((p) => ({
                      ...p,
                      deptId: e.target.value ? Number(e.target.value) : undefined,
                      page: 1,
                    }))
                  }
                >
                  <option value="">全部部门</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {'—'.repeat(dept.level)} {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] text-[#64748b] mb-1.5 block uppercase tracking-wider font-medium">日期范围</label>
                <Input
                  placeholder="2024/05/01 - 2024/05/31"
                  prefix={<CalendarDays className="w-4 h-4" />}
                  onChange={(e) =>
                    setParams((p) => ({ ...p, dateRange: e.target.value, page: 1 }))
                  }
                />
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => setParams((p) => ({ ...p }))}
                >
                  <Filter className="w-3.5 h-3.5" /> 筛选
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setParams({ page: 1, pageSize: 20 })}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick filter pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            {QUICK_FILTERS.map((f) => {
              const isActive = (params.status ?? '') === f.key;
              const count = f.key ? (statusCounts[f.key as RetirementStatus] ?? 0) : records.length;
              return (
                <button
                  key={f.key || '__all__'}
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  onClick={() =>
                    setParams((p) => ({ ...p, status: f.key || undefined, page: 1 }))
                  }
                >
                  {f.dotColor && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white/80' : f.dotColor}`} />
                  )}
                  {f.label}
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Result summary bar with filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
              <span className="text-[11px] font-medium text-slate-400">当前筛选:</span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {chip.label}
                  <button
                    type="button"
                    className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    onClick={chip.onRemove}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                onClick={() => setParams({ page: 1, pageSize: 20 })}
              >
                清除全部
              </button>
            </div>
          )}

          {/* DataTable */}
          <DataTable
            columns={columns}
            data={records}
            loading={isLoading}
            rowKey="id"
            onRowClick={(row) => navigate(`/retirement/${row.id}`)}
            pagination={{
              page: params.page,
              pageSize: params.pageSize,
              total,
              onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
            }}
            emptyText="暂无退役申请记录"
          />
        </Card>
      </div>
    </div>
  );
}
