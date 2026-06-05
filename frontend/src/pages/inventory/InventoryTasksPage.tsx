import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Edit2,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Radio,
  ShieldCheck,
  Wifi,
  AlertTriangle,
  Eye,
  Scan,
  ClipboardList,
  Zap,
  ChevronDown,
  FileCheck,
  FileClock,
  FilePen,
  CircleDot,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getInventoryTasks, createInventoryTask } from '@/api/inventory';
import type { InventoryTaskStatus, CreateTaskPayload, InventoryTask } from '@/types/inventory';
import type { PageData } from '@/types/common';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select, SelectItem } from '@/components/ui/Select';

// ── 类型 ─────────────────────────────────────────────────────────────────────

type TaskRecord = InventoryTask & Record<string, unknown>;

// ── 状态配置 ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  InventoryTaskStatus,
  {
    label: string;
    dot: string;
    text: string;
    bg: string;
    border: string;
    ring: string;
    iconBg: string;
    description: string;
  }
> = {
  draft: {
    label: '草稿',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    ring: 'ring-slate-200',
    iconBg: 'bg-slate-100 text-slate-500',
    description: '待启动',
  },
  in_progress: {
    label: '进行中',
    dot: 'bg-cyan-400',
    text: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    ring: 'ring-cyan-300',
    iconBg: 'bg-cyan-100 text-cyan-600',
    description: '正在盘点',
  },
  completed: {
    label: '已完成',
    dot: 'bg-emerald-400',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'ring-emerald-300',
    iconBg: 'bg-emerald-100 text-emerald-600',
    description: '盘点完成',
  },
  submitted: {
    label: '已提交',
    dot: 'bg-violet-400',
    text: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    ring: 'ring-violet-300',
    iconBg: 'bg-violet-100 text-violet-600',
    description: '已提交审核',
  },
};

/** 状态图标映射 */
function StatusIcon({ status, className }: { status: InventoryTaskStatus; className?: string }) {
  const cls = className ?? 'h-3.5 w-3.5';
  switch (status) {
    case 'draft':
      return <FilePen className={cls} />;
    case 'in_progress':
      return <CircleDot className={cls} />;
    case 'completed':
      return <FileCheck className={cls} />;
    case 'submitted':
      return <FileClock className={cls} />;
    default:
      return <FilePen className={cls} />;
  }
}

const QUICK_FILTERS: Array<{ key: InventoryTaskStatus; label: string }> = [
  { key: 'in_progress', label: '进行中' },
  { key: 'draft', label: '待开始' },
  { key: 'completed', label: '已完成' },
  { key: 'submitted', label: '已提交' },
];

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

function numberFrom(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getTaskId(task: TaskRecord) {
  return String(task.taskId ?? task.id ?? task.taskNo ?? '');
}

function getTaskName(task: TaskRecord) {
  return String(task.taskName ?? task.name ?? '未命名盘点');
}

function getTaskProgress(task: TaskRecord) {
  const progress = task.progress ?? task.progressPercentage;
  if (progress !== undefined && progress !== null) return Math.min(Math.max(numberFrom(progress), 0), 100);
  const total = numberFrom(task.totalAssets ?? task.totalCount);
  const counted = numberFrom(task.countedAssets ?? task.scannedCount ?? task.matchCount);
  return total > 0 ? Math.round((counted / total) * 100) : 0;
}

function getTaskTotal(task: TaskRecord) {
  return numberFrom(task.totalAssets ?? task.totalCount);
}

function getTaskCounted(task: TaskRecord) {
  return numberFrom(task.countedAssets ?? task.scannedCount ?? task.matchCount);
}

function getTaskDeficit(task: TaskRecord) {
  return numberFrom(task.deficitAssets ?? task.lossCount ?? task.deficitCount);
}

function getTaskSurplus(task: TaskRecord) {
  return numberFrom(task.surplusAssets ?? task.surplusCount);
}

function formatShortDate(value: unknown) {
  const text = String(value ?? '');
  return text ? text.substring(0, 10) : '—';
}

/** 获取进度条颜色 — 根据完成度渐变 */
function progressColor(pct: number) {
  if (pct >= 90) return { bar: 'from-emerald-400 to-teal-400', glow: 'rgba(52,211,153,0.4)' };
  if (pct >= 50) return { bar: 'from-blue-400 via-cyan-400 to-emerald-400', glow: 'rgba(6,182,212,0.35)' };
  return { bar: 'from-blue-400 to-cyan-400', glow: 'rgba(59,130,246,0.3)' };
}

// ── 子组件 ───────────────────────────────────────────────────────────────────

/** 盘点任务状态徽章 — 增强版，带图标与描述 */
function TaskStatusBadge({ status, size = 'sm' }: { status: InventoryTaskStatus; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const isMd = size === 'md';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.ring} ${
        isMd ? 'px-3 py-1 text-xs' : ''
      }`}
    >
      <StatusIcon status={status} className={isMd ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      {cfg.label}
    </span>
  );
}

/** 增强版渐变色进度条 — 含数字与异常标识 */
function ProgressBar({
  value,
  counted,
  total,
  deficit,
}: {
  value: number;
  counted?: number;
  total?: number;
  deficit?: number;
}) {
  const pct = Math.min(Math.max(value, 0), 100);
  const colors = progressColor(pct);
  const hasDeficit = (deficit ?? 0) > 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.bar} shadow-[0_0_12px_${colors.glow}] transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`w-11 text-right text-[11px] font-bold ${
            pct >= 90 ? 'text-emerald-500' : pct >= 50 ? 'text-blue-500' : 'text-slate-500'
          }`}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      {/* 数值摘要行 */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        {counted !== undefined && total !== undefined && (
          <span>
            <span className="font-semibold text-slate-500">{counted}</span>/{total} 件
          </span>
        )}
        {hasDeficit && (
          <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
            <AlertTriangle className="h-2.5 w-2.5" />
            差异 {deficit}
          </span>
        )}
      </div>
    </div>
  );
}

/** 异常标记 — 当存在盘亏/盘盈时显示 */
function AnomalyTag({ deficit, surplus }: { deficit: number; surplus: number }) {
  if (deficit <= 0 && surplus <= 0) return null;
  return (
    <div className="mt-1 flex items-center gap-1.5">
      {deficit > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0 text-[10px] font-bold text-red-600 ring-1 ring-inset ring-red-100">
          <AlertTriangle className="h-2.5 w-2.5" />
          盘亏 {deficit}
        </span>
      )}
      {surplus > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0 text-[10px] font-bold text-amber-600 ring-1 ring-inset ring-amber-100">
          <TrendingUp className="h-2.5 w-2.5" />
          盘盈 {surplus}
        </span>
      )}
    </div>
  );
}

// ── 统计卡片配置 ─────────────────────────────────────────────────────────────

interface StatCardDef {
  label: string;
  value: number | string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function InventoryTasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [params, setParams] = useState<{
    page: number;
    pageSize: number;
    status?: string;
  }>({ page: 1, pageSize: 20 });

  const [filterOpen, setFilterOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<CreateTaskPayload>>({
    taskName: '',
    scopeType: 'all',
    scopeIds: [],
  });

  // ── 数据查询 ─────────────────────────────────────────────────────────────

  const { data: res, isLoading, isFetching } = useQuery({
    queryKey: ['inventory', 'tasks', params],
    queryFn: () => getInventoryTasks(params),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const createMutation = useMutation({
    mutationFn: createInventoryTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'tasks'] });
      setCreateOpen(false);
      setNewTask({ taskName: '', scopeType: 'all', scopeIds: [] });
    },
  });

  // ── 数据派生 ─────────────────────────────────────────────────────────────

  const records = ((res as PageData<InventoryTask> | undefined)?.records ?? []) as TaskRecord[];
  const total = (res as PageData<InventoryTask> | undefined)?.total ?? 0;

  const statusCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[String(r.status)] = (acc[String(r.status)] || 0) + 1;
    return acc;
  }, {});

  const totalAssets = records.reduce((sum, task) => sum + getTaskTotal(task), 0);
  const countedAssets = records.reduce((sum, task) => sum + getTaskCounted(task), 0);
  const deficitAssets = records.reduce((sum, task) => sum + getTaskDeficit(task), 0);
  const surplusAssets = records.reduce((sum, task) => sum + getTaskSurplus(task), 0);

  const averageProgress = records.length
    ? Math.round(records.reduce((sum, task) => sum + getTaskProgress(task), 0) / records.length)
    : 0;

  const reportTask = records.find(
    (task) => task.status === 'completed' || task.status === 'submitted',
  ) ?? records[0];

  const activeTask = records.find((task) => task.status === 'in_progress') ?? records[0];

  // ── 图表数据 ─────────────────────────────────────────────────────────────

  const chartData = useMemo(
    () =>
      records.slice(0, 8).map((task, index) => ({
        id: getTaskId(task) || String(index),
        label: getTaskName(task).substring(0, 6),
        progress: getTaskProgress(task),
        deficit: Math.min(getTaskDeficit(task), 100),
      })),
    [records],
  );

  // ── 统计卡片 ─────────────────────────────────────────────────────────────

  const statCards: StatCardDef[] = [
    {
      label: '任务总数',
      value: total || records.length,
      unit: '项',
      icon: ClipboardList,
      gradient: 'from-blue-600 to-cyan-500',
      iconBg: 'bg-blue-600/20 text-blue-100',
    },
    {
      label: '平均进度',
      value: averageProgress,
      unit: '%',
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-400',
      iconBg: 'bg-emerald-600/20 text-emerald-100',
    },
    {
      label: '已盘资产',
      value: countedAssets,
      unit: '件',
      icon: CheckCircle2,
      gradient: 'from-violet-500 to-purple-400',
      iconBg: 'bg-violet-600/20 text-violet-100',
    },
    {
      label: '差异预警',
      value: deficitAssets,
      unit: '项',
      icon: AlertTriangle,
      gradient: 'from-amber-500 to-rose-400',
      iconBg: 'bg-amber-600/20 text-amber-100',
    },
  ];

  // ── 筛选结果摘要文本 ─────────────────────────────────────────────────────

  const filterSummary = useMemo(() => {
    if (!params.status) return null;
    const cfg = STATUS_CONFIG[params.status as InventoryTaskStatus];
    const label = cfg?.label ?? params.status;
    const count = records.length;
    return { label, count, status: params.status };
  }, [params.status, records.length]);

  // ── CSV 导出 ─────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const headers = ['盘点编号', '盘点名称', '类型', '进度', '状态', '创建时间'];
    const rows = records.map((r) => [
      getTaskId(r),
      getTaskName(r),
      String(r.scopeType ?? ''),
      String(getTaskProgress(r)) + '%',
      String(r.status ?? ''),
      formatShortDate(r.createdAt ?? r.createTime),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── DataTable 列定义 ─────────────────────────────────────────────────────

  const columns: Column<TaskRecord>[] = [
    {
      key: 'taskId',
      title: '编号',
      width: 100,
      render: (_, row) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
          #{getTaskId(row) || '—'}
        </span>
      ),
    },
    {
      key: 'taskName',
      title: '盘点任务',
      render: (_, row) => {
        const deficit = getTaskDeficit(row);
        const surplus = getTaskSurplus(row);
        return (
          <div className="min-w-[160px]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {getTaskName(row)}
              </span>
              {/* 行内状态小标 — 进行中任务闪烁点 */}
              {row.status === 'in_progress' && (
                <span className="inline-flex h-2 w-2 items-center justify-center">
                  <span className="absolute h-2 w-2 animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
              <Wifi className="h-3 w-3 text-cyan-400" />
              {row.scopeName
                ? String(row.scopeName)
                : row.scopeType === 'all'
                  ? '全部资产'
                  : String(row.scopeType ?? '专项范围')}
            </div>
            <AnomalyTag deficit={deficit} surplus={surplus} />
          </div>
        );
      },
    },
    {
      key: 'scopeType',
      title: '范围',
      width: 100,
      render: (v) => {
        const map: Record<string, { label: string; cls: string }> = {
          all: { label: '全域', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
          location: { label: '点位', cls: 'bg-orange-50 text-orange-700 border-orange-100' },
          category: { label: '分类', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
        };
        const cfg = map[String(v)] ?? {
          label: String(v ?? '-'),
          cls: 'bg-slate-50 text-slate-600 border-slate-200',
        };
        return (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
          >
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      title: '时间',
      width: 110,
      render: (v, row) => (
        <span className="whitespace-nowrap text-xs font-medium text-slate-500">
          {formatShortDate(v ?? row.createTime)}
        </span>
      ),
    },
    {
      key: 'progress',
      title: '进度',
      width: 170,
      render: (_, row) => (
        <ProgressBar
          value={getTaskProgress(row)}
          counted={getTaskCounted(row)}
          total={getTaskTotal(row)}
          deficit={getTaskDeficit(row)}
        />
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (v) => <TaskStatusBadge status={(v as InventoryTaskStatus) ?? 'draft'} />,
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      align: 'right',
      render: (_, row) => {
        const taskId = getTaskId(row);
        const readonly = row.status === 'completed' || row.status === 'submitted';
        const inProgress = row.status === 'in_progress';
        return (
          <div className="flex justify-end gap-1.5">
            {/* 快捷：进行中任务可一键扫描 */}
            {inProgress && (
              <button
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/25 transition hover:shadow-lg hover:shadow-cyan-500/30"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/inventory/scan/${taskId}`);
                }}
                title="继续扫描"
              >
                <Zap className="h-3 w-3" />
                扫描
              </button>
            )}
            <button
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/inventory/tasks/${taskId}`);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              详情
            </button>
            {!readonly && !inProgress && (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/inventory/scan/${taskId}`);
                }}
                title="RFID 扫描"
              >
                <Radio className="h-3.5 w-3.5" />
              </button>
            )}
            {!readonly && (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-blue-200 hover:text-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/inventory/tasks/${taskId}`);
                }}
                title="编辑"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // ── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ================================================================ */}
        {/* ① 紧凑头部 — 标题 + 指标条                                       */}
        {/* ================================================================ */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">资产盘点管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <Radio className="h-3 w-3" />
                RFID
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                实时同步
              </span>
            </div>
            <Button size="md" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新建盘点任务
            </Button>
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
                      {typeof stat.value === 'number'
                        ? stat.value.toLocaleString('zh-CN')
                        : stat.value}
                      <span className="ml-0.5 text-xs font-medium text-slate-400">{stat.unit}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================ */}
        {/* ② 主内容区域 — 全宽表格                                          */}
        {/* ================================================================ */}
            <Card className="overflow-hidden rounded-[var(--surface-radius-lg)] border-slate-200/80 shadow-sm">
              {/* 工具栏 */}
              <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
                {/* 标题行 */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                      <Search className="h-3.5 w-3.5" />
                      任务列表
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      盘点任务队列
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSummaryOpen((v) => !v)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      决策摘要
                      <ChevronDown className={`h-3 w-3 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChartOpen((v) => !v)}
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      进度趋势
                      <ChevronDown className={`h-3 w-3 transition-transform ${chartOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    {activeTask && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/inventory/scan/${getTaskId(activeTask)}`)}
                      >
                        <Scan className="h-3.5 w-3.5" />
                        继续扫描
                      </Button>
                    )}
                    {deficitAssets > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setParams({ page: 1, pageSize: 20, status: 'completed' })}
                        className="!border-amber-200 !text-amber-700 hover:!bg-amber-50"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        差异 {deficitAssets}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterOpen((v) => !v)}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      筛选
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                      <Download className="h-3.5 w-3.5" />
                      导出
                    </Button>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      新建
                    </Button>
                  </div>
                </div>

                {/* 快速筛选按钮 */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setParams((p) => ({ ...p, status: undefined, page: 1 }))
                    }
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      !params.status
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    全部
                    <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0 text-[10px]">
                      {records.length}
                    </span>
                  </button>
                  {QUICK_FILTERS.map(({ key, label }) => {
                    const cfg = STATUS_CONFIG[key];
                    const active = params.status === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setParams((p) => ({
                            ...p,
                            status: active ? undefined : key,
                            page: 1,
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {label}
                        <span
                          className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {statusCounts[key] ?? 0}
                        </span>
                      </button>
                    );
                  })}

                  {/* 自定义筛选面板 */}
                  {(filterOpen || params.status) && (
                    <div className="ml-1 flex flex-wrap items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 shadow-sm">
                      <span className="text-xs font-bold text-blue-700">状态</span>
                      <select
                        className="h-7 rounded-full border border-blue-100 bg-white px-2.5 text-xs outline-none focus:border-blue-400"
                        value={params.status ?? ''}
                        onChange={(e) =>
                          setParams((p) => ({
                            ...p,
                            status: e.target.value || undefined,
                            page: 1,
                          }))
                        }
                      >
                        <option value="">全部</option>
                        <option value="in_progress">进行中</option>
                        <option value="draft">草稿</option>
                        <option value="completed">已完成</option>
                        <option value="submitted">已提交</option>
                      </select>
                      <button
                        type="button"
                        className="text-xs font-semibold text-slate-500 hover:text-blue-700"
                        onClick={() => {
                          setParams({ page: 1, pageSize: 20 });
                          setFilterOpen(false);
                        }}
                      >
                        重置
                      </button>
                    </div>
                  )}

                  {/* 加载指示 */}
                  {isFetching && !isLoading && (
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      刷新中
                    </span>
                  )}
                </div>
              </div>

              {/* 结果摘要条 — 始终可见，筛选时附加筛选标签 */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
                {filterSummary && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                    <Filter className="h-3 w-3" />
                    筛选: {filterSummary.label}
                    <button
                      type="button"
                      className="ml-0.5 rounded-full p-0.5 text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
                      onClick={() => setParams((p) => ({ ...p, status: undefined, page: 1 }))}
                      title="清除筛选"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  共 <span className="font-bold text-slate-700">{filterSummary?.count ?? records.length}</span> 条任务
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span>
                    已盘 <span className="font-semibold text-blue-600">{countedAssets}</span>
                    <span className="text-slate-300">/</span>{totalAssets} 件
                  </span>
                  {deficitAssets > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      差异 {deficitAssets} 项
                    </span>
                  )}
                  {surplusAssets > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-teal-600">
                      <TrendingUp className="h-3 w-3" />
                      盘盈 {surplusAssets} 项
                    </span>
                  )}
                </div>
              </div>

              {/* 决策摘要 — 可展开/收起 */}
              {summaryOpen && (
                <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/60 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-bold text-slate-800">决策摘要</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">规则校验</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>
                        进行中 <span className="font-bold text-slate-900">{statusCounts.in_progress ?? 0}</span>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>
                        待开始 <span className="font-bold text-slate-900">{statusCounts.draft ?? 0}</span>
                      </span>
                      {deficitAssets > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="font-semibold text-amber-700">
                            <AlertTriangle className="mr-0.5 inline h-3.5 w-3.5" />
                            差异 {deficitAssets} 项
                          </span>
                        </>
                      )}
                      {deficitAssets === 0 && surplusAssets === 0 && (
                        <span className="text-emerald-600">暂无异常，数据合规</span>
                      )}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!reportTask}
                        onClick={() => {
                          const taskId = reportTask ? getTaskId(reportTask) : '';
                          if (taskId) navigate(`/inventory/smart-report/${taskId}`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        查看智能报告
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setParams({ page: 1, pageSize: 20, status: 'in_progress' })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        聚焦进行中
                      </button>
                    </div>
                  </div>
                  {!reportTask && (
                    <p className="mt-2 text-xs text-slate-400">暂无可查看的盘点报告，请先创建并完成盘点任务。</p>
                  )}
                </div>
              )}

              {/* 进度趋势图表 — 可展开/收起 */}
              {chartOpen && (
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/60 via-white to-slate-50/60 px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-bold text-slate-800">任务进度趋势</span>
                    </div>
                    <span className="text-xs text-slate-400">最近 {chartData.length} 个任务</span>
                  </div>
                  {chartData.length === 0 ? (
                    <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                      暂无任务数据
                    </div>
                  ) : (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} unit="%" />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(15,23,42,0.08)', fontSize: 12 }}
                            formatter={(value: number) => [`${value}%`, '进度']}
                          />
                          <Bar dataKey="progress" fill="url(#progressGradient)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                          <defs>
                            <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* 表格 */}
              <div className="p-4 sm:p-5">
                <DataTable
                  columns={columns}
                  data={records}
                  loading={isLoading}
                  rowKey={(row) => getTaskId(row)}
                  onRowClick={(row) =>
                    navigate(`/inventory/tasks/${getTaskId(row)}`)
                  }
                  pagination={{
                    page: params.page,
                    pageSize: params.pageSize,
                    total,
                    onChange: (page, pageSize) =>
                      setParams((p) => ({ ...p, page, pageSize })),
                  }}
                  emptyText="暂无盘点任务，点击「新建」开始创建"
                />
              </div>
            </Card>

        {/* ================================================================ */}
        {/* ③ 新建任务 Dialog                                              */}
        {/* ================================================================ */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="overflow-hidden rounded-2xl">
            <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-blue-900">
              <DialogTitle className="flex items-center gap-2 text-white">
                <BarChart3 className="h-4 w-4 text-cyan-300" />
                新建 RFID 盘点任务
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-300">
                创建后将进入盘点任务队列，可在详情页继续配置范围。
              </p>
            </DialogHeader>
            <div className="space-y-4 px-6 py-5">
              <Input
                label="任务名称 *"
                placeholder="例：2026年5月全面盘点"
                value={newTask.taskName}
                onChange={(e) =>
                  setNewTask((t) => ({ ...t, taskName: e.target.value }))
                }
              />
              <Select
                label="盘点范围"
                value={newTask.scopeType}
                onValueChange={(v) =>
                  setNewTask((t) => ({
                    ...t,
                    scopeType: v as 'all' | 'location' | 'category',
                  }))
                }
              >
                <SelectItem value="all">全部资产</SelectItem>
                <SelectItem value="location">按存放位置</SelectItem>
                <SelectItem value="category">按资产分类</SelectItem>
              </Select>
              {newTask.scopeType !== 'all' && (
                <Input
                  label="范围 ID（逗号分隔）"
                  placeholder="例：1,2,3"
                  onChange={(e) =>
                    setNewTask((t) => ({
                      ...t,
                      scopeIds: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                disabled={!newTask.taskName?.trim()}
                loading={createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    taskName: newTask.taskName!,
                    scopeType: newTask.scopeType ?? 'all',
                    scopeIds: newTask.scopeIds ?? [],
                  } as any)
                }
              >
                创建任务
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
