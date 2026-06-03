import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  Plus, ListChecks, PlayCircle, CheckCircle2, ClipboardList,
} from 'lucide-react';

/* ---------- types ---------- */

interface StocktakingCycle {
  id: number;
  cycleName: string;
  cycleType: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

/* ---------- constants ---------- */

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; border: string; bg: string; text: string }
> = {
  PLANNED: {
    label: '已计划',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  IN_PROGRESS: {
    label: '进行中',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  PAUSED: {
    label: '已暂停',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  COMPLETED: {
    label: '已完成',
    dot: 'bg-slate-400',
    border: 'border-slate-200',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
  },
  CANCELLED: {
    label: '已取消',
    dot: 'bg-red-500',
    border: 'border-red-200',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
};

const DEFAULT_STATUS = {
  label: '',
  dot: 'bg-slate-400',
  border: 'border-slate-200',
  bg: 'bg-slate-50',
  text: 'text-slate-600',
};

const CYCLE_TYPE_LABELS: Record<string, string> = {
  FULL: '全盘点',
  ABC: 'ABC 分类盘点',
  PARTIAL: '部分盘点',
};

const STATUS_FILTERS = [
  { key: '', label: '全部状态' },
  { key: 'PLANNED', label: '已计划' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'PAUSED', label: '已暂停' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELLED', label: '已取消' },
];

/* ---------- component ---------- */

export default function StocktakingCycleListPage() {
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<StocktakingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchCycles();
  }, [filterStatus]);

  const fetchCycles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);

      const response = await fetch(`/api/stocktaking/cycles?${params}`);
      const data = await response.json();
      setCycles(data.data?.records || []);
    } catch (error) {
      console.error('获取盘点周期列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const s = { total: cycles.length, inProgress: 0, completed: 0, planned: 0 };
    cycles.forEach((c) => {
      if (c.status === 'IN_PROGRESS') s.inProgress++;
      else if (c.status === 'COMPLETED') s.completed++;
      else if (c.status === 'PLANNED') s.planned++;
    });
    return s;
  }, [cycles]);

  /* ---- columns ---- */

  const columns: Column<StocktakingCycle>[] = [
    {
      key: 'cycleName',
      title: '周期名称',
      render: (val) => <span className="font-medium text-slate-900">{val as string}</span>,
    },
    {
      key: 'cycleType',
      title: '类型',
      width: 150,
      render: (val) => (
        <span className="text-sm">
          {CYCLE_TYPE_LABELS[val as string] || (val as string)}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 130,
      render: (val) => {
        const cfg = STATUS_CONFIG[val as string] || {
          ...DEFAULT_STATUS,
          label: val as string,
        };
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.border} ${cfg.bg} ${cfg.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'startDate',
      title: '开始时间',
      width: 140,
      render: (val) => {
        const d = val as string | undefined;
        return (
          <span className="text-sm text-slate-500">
            {d ? new Date(d).toLocaleDateString('zh-CN') : '-'}
          </span>
        );
      },
    },
    {
      key: 'endDate',
      title: '结束时间',
      width: 140,
      render: (val) => {
        const d = val as string | undefined;
        return (
          <span className="text-sm text-slate-500">
            {d ? new Date(d).toLocaleDateString('zh-CN') : '-'}
          </span>
        );
      },
    },
    {
      key: '_actions',
      title: '操作',
      width: 100,
      align: 'right',
      render: (_v, row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/stocktaking-cycles/${row.id}`)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
            title="查看详情"
          >
            <ListChecks className="h-3.5 w-3.5" />
            详情
          </button>
        </div>
      ),
    },
  ];

  /* ---- stat items ---- */

  const statItems = [
    {
      label: '总周期',
      value: stats.total,
      gradient: 'from-blue-500 to-blue-600',
      Icon: ClipboardList,
    },
    {
      label: '进行中',
      value: stats.inProgress,
      gradient: 'from-emerald-500 to-emerald-600',
      Icon: PlayCircle,
    },
    {
      label: '已完成',
      value: stats.completed,
      gradient: 'from-sky-500 to-sky-600',
      Icon: CheckCircle2,
    },
    {
      label: '已计划',
      value: stats.planned,
      gradient: 'from-violet-500 to-violet-600',
      Icon: ListChecks,
    },
  ];

  /* ---- render ---- */

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Header + Stat Bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">循环盘点周期</h1>
              <p className="mt-0.5 text-sm text-slate-500">管理库存盘点计划与执行周期</p>
            </div>
            <button
              onClick={() => navigate('/stocktaking-cycles/new')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              新建周期
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
            {statItems.map(({ label, value, gradient, Icon }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
                >
                  <Icon className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="text-lg font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Main Content Card ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar: Quick filter pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-4">
            {STATUS_FILTERS.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setFilterStatus(pill.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  filterStatus === pill.key
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* DataTable */}
          <div className="p-5">
            <DataTable<StocktakingCycle>
              columns={columns}
              data={cycles}
              rowKey="id"
              loading={loading}
              onRowClick={(row) => navigate(`/stocktaking-cycles/${row.id}`)}
              emptyText="暂无盘点周期"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
