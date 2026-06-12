import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Download,
  Edit2,
  ArrowRight,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { getInventoryTasks, createInventoryTask } from '@/api/inventory';
import type { InventoryTaskStatus, InventoryTask, ScopeType } from '@/types/inventory';
import type { PaginatedResponse } from '@/types/common';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FilterBar } from '@/components/ui/FilterBar';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select, SelectItem } from '@/components/ui/Select';

const STATUS_CONFIG: Record<
  InventoryTaskStatus,
  { label: string; variant: 'gray' | 'default' | 'warning' | 'success' | 'danger' }
> = {
  draft: { label: '草稿', variant: 'gray' },
  in_progress: { label: '进行中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
  submitted: { label: '已提交', variant: 'default' },
};

const QUICK_FILTERS = [
  { key: 'in_progress', label: '进行中' },
  { key: 'draft', label: '草稿' },
  { key: 'completed', label: '已完成' },
  { key: 'submitted', label: '已提交' },
];

const SUMMARY_CARDS = [
  { label: '进行中任务', statusKey: 'in_progress' as const, color: 'text-[#2563eb]', bg: 'bg-blue-50', icon: RefreshCw },
  { label: '已完成', statusKey: 'completed' as const, color: 'text-[#16a34a]', bg: 'bg-green-50', icon: CheckCircle2 },
  { label: '待开始', statusKey: 'draft' as const, color: 'text-[#727784]', bg: 'bg-slate-50', icon: Clock },
] as const;

type InventoryTaskRow = InventoryTask & {
  id?: string | number;
  scopeName?: string;
  endDate?: string;
};

interface CreateTaskDraft {
  taskName: string;
  scopeType: ScopeType;
  scopeIds: string[];
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#2563eb] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-bold text-[#64748b] w-9 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function InventoryTasksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [params, setParams] = useState<{ page: number; pageSize: number; status?: string }>({ page: 1, pageSize: 20 });
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState<CreateTaskDraft>({
    taskName: '', scopeType: 'all', scopeIds: [],
  });

  const { data: res, isLoading } = useQuery({
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

  const records = (res as PaginatedResponse<InventoryTaskRow> | undefined)?.data?.records ?? [];
  const total = (res as PaginatedResponse<InventoryTaskRow> | undefined)?.data?.total ?? 0;

  const statusCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const chartData = records.slice(0, 5).map((r, i) => ({
    label: String(r.taskName ?? `任务${i + 1}`).substring(0, 4),
    counted: Number(r.progress ?? 0),
    deficit: 100 - Number(r.progress ?? 0),
    highlight: i === 3,
  }));
  const reportTask = records.find((task) => task.status === 'completed' || task.status === 'submitted') ?? records[0];

  const columns: Column<any>[] = [
    {
      key: 'taskId',
      title: '盘点编号',
      width: 140,
      render: (v) => <span className="font-medium text-[#2563eb] text-[13px]">{String(v)}</span>,
    },
    {
      key: 'taskName',
      title: '盘点名称',
      render: (v) => <span className="font-semibold text-[13px] text-[#0f172a]">{String(v)}</span>,
    },
    {
      key: 'scopeType',
      title: '盘点类型',
      width: 90,
      render: (v) => {
        const map: Record<string, { label: string; cls: string }> = {
          all: { label: '全面', cls: 'bg-blue-100 text-blue-700' },
          location: { label: '专项', cls: 'bg-orange-100 text-orange-700' },
          category: { label: '抽样', cls: 'bg-purple-100 text-purple-700' },
        };
        const cfg = map[String(v)] ?? { label: String(v), cls: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${cfg.cls}`}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'scopeName',
      title: '范围',
      width: 140,
      render: (v, row) => (
        <span className="text-[13px] text-[#64748b]">{row.scopeName ?? String(v)}</span>
      ),
    },
    {
      key: 'createdAt',
      title: '日期范围',
      width: 170,
      render: (v, row) => (
        <span className="text-[13px] text-[#64748b] whitespace-nowrap">
          {String(v ?? '').substring(0, 10)}
          <span className="mx-1 opacity-40">→</span>
          {row.endDate ? String(row.endDate).substring(0, 10) : '—'}
        </span>
      ),
    },
    {
      key: 'progress',
      title: '进度',
      width: 140,
      render: (v) => <ProgressBar value={Number(v)} />,
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (v) => {
        const cfg = STATUS_CONFIG[v as InventoryTaskStatus];
        if (v === 'in_progress') {
          return (
            <span className="flex items-center gap-1.5 text-[#2563eb] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
              {cfg?.label ?? String(v)}
            </span>
          );
        }
        if (v === 'completed') {
          return (
            <span className="flex items-center gap-1.5 text-[#16a34a] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
              {cfg?.label ?? String(v)}
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1.5 text-[#727784] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#727784]" />
            {cfg?.label ?? String(v)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-3">
          <button
            className="text-[#2563eb] hover:underline font-semibold text-xs"
            onClick={(e) => { e.stopPropagation(); navigate(`/inventory/tasks/${row.taskId}`); }}
          >
            详情
          </button>
          {row.status !== 'completed' && row.status !== 'submitted' && (
            <button
              className="text-[#64748b] hover:text-[#2563eb] transition-colors"
              onClick={(e) => { e.stopPropagation(); navigate(`/inventory/tasks/${row.taskId ?? row.id}`); }}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto w-full space-y-8">
      <PageHeader
        title="盘点任务列表"
        subtitle="管理和追踪企业资产盘点进度与准确率"
        breadcrumbs={[{ label: '仪表板', href: '/dashboard' }, { label: '盘点管理' }]}
        actions={
          <Button size="lg" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            新建盘点
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SUMMARY_CARDS.map(({ label, statusKey, color, bg, icon: Icon }) => (
          <div
            key={label}
            className="bg-white p-6 rounded-xl border border-[#e2e8f0] flex items-center justify-between group hover:border-[#2563eb] transition-all cursor-default"
          >
            <div>
              <p className="text-[#64748b] text-sm font-medium mb-1">{label}</p>
              <h3 className={`text-4xl font-bold ${color}`}>
                {isLoading ? '—' : (statusCounts[statusKey] ?? 0)}
              </h3>
            </div>
            <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]/30 flex items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" onClick={() => setFilterOpen((v) => !v)}>
              <Filter className="w-3.5 h-3.5" /> 筛选
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const headers = ['盘点编号', '盘点名称', '类型', '进度', '状态', '创建时间'];
                const rows = records.map((r) => [
                  String(r.taskId ?? r.id ?? ''),
                  String(r.taskName ?? ''),
                  String(r.scopeType ?? ''),
                  String(r.progress ?? 0) + '%',
                  String(r.status ?? ''),
                  String(r.createdAt ?? '').substring(0, 10),
                ]);
                const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `inventory-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3.5 h-3.5" /> 导出报表
            </Button>
            {filterOpen && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-[#64748b]">状态:</span>
                <select
                  className="h-8 bg-white border border-[#e2e8f0] rounded-lg px-2 text-sm focus:border-[#2563eb] outline-none"
                  value={params.status ?? ''}
                  onChange={(e) => setParams((p) => ({ ...p, status: e.target.value || undefined, page: 1 }))}
                >
                  <option value="">全部</option>
                  <option value="in_progress">进行中</option>
                  <option value="draft">草稿</option>
                  <option value="completed">已完成</option>
                  <option value="submitted">已提交</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setParams({ page: 1, pageSize: 20 }); setFilterOpen(false); }}
                >
                  重置
                </Button>
              </div>
            )}
          </div>
          <div className="text-[13px] text-[#64748b]">共 {total} 条盘点记录</div>
        </div>
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey="taskId"
          onRowClick={(row) => navigate(`/inventory/tasks/${row.taskId}`)}
          pagination={{
            page: params.page,
            pageSize: params.pageSize,
            total,
            onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
          }}
          emptyText="暂无盘点任务，点击「新建盘点」开始"
        />
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white border border-[#e2e8f0] rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-semibold text-[#0f172a]">盘点异常趋势</h4>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
              <span className="w-2 h-2 rounded-full bg-[#2563eb]" /> 已盘点
              <span className="w-2 h-2 rounded-full bg-[#dc2626] ml-2" /> 盘亏
            </div>
          </div>
          <div className="h-48 flex items-end justify-between gap-4 px-2">
            {isLoading ? (
              <div className="flex-1 text-center text-[#64748b] text-sm py-12">加载中...</div>
            ) : chartData.length === 0 ? (
              <div className="flex-1 text-center text-[#64748b] text-sm py-12">暂无数据</div>
            ) : (
              chartData.map(({ label, counted, deficit, highlight }) => (
                <div key={label} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full flex flex-col justify-end gap-1 h-32">
                    <div
                      className={`w-full rounded-t ${highlight ? 'bg-[#dc2626]/30' : 'bg-[#2563eb]/20'}`}
                      style={{ height: `${deficit}%` }}
                    />
                    <div className="w-full bg-[#2563eb] rounded-b" style={{ height: `${counted}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#64748b]">{label}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-[#2563eb] text-white rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <h4 className="text-lg font-bold mb-2">资产管理助手</h4>
            <p className="text-white/80 text-sm leading-relaxed">
              您当前有 <span className="text-white font-bold">{statusCounts['in_progress'] ?? 0}</span> 个进行中任务，
              <span className="text-white font-bold">{statusCounts['draft'] ?? 0}</span> 个待开始任务待处理。
              保持关注盘点进度，以确保数据合规。
            </p>
          </div>
          <div className="relative z-10 mt-4">
            <button
              type="button"
              disabled={!reportTask}
              onClick={() => {
                if (reportTask?.taskId) {
                  navigate(`/inventory/smart-report/${reportTask.taskId}`);
                }
              }}
              title={reportTask ? `查看 ${reportTask.taskName} 的智能报告` : '暂无可查看的盘点任务，请先创建或选择任务'}
              className="bg-white/10 hover:bg-white/20 disabled:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-white border border-white/30 px-4 py-2 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all"
            >
              查看智能报告
            </button>
            {!reportTask && (
              <p className="mt-2 text-xs text-white/70">暂无可查看的盘点任务，请先创建任务。</p>
            )}
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#0058be] rounded-full blur-xl border border-white/5" />
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              新建盘点任务
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <Input
              label="任务名称 *"
              placeholder="例：2026年5月全面盘点"
              value={newTask.taskName}
              onChange={(e) => setNewTask((t) => ({ ...t, taskName: e.target.value }))}
            />
            <Select
              label="盘点范围"
              value={newTask.scopeType}
              onValueChange={(v) => setNewTask((t) => ({ ...t, scopeType: v as 'all' | 'location' | 'category' }))}
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
                    scopeIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  }))
                }
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              disabled={!newTask.taskName?.trim()}
              loading={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  taskName: newTask.taskName!,
                  inventoryType: newTask.scopeType,
                  scope:
                    newTask.scopeType === 'all'
                      ? 'all'
                      : newTask.scopeIds.join(','),
                  location:
                    newTask.scopeType === 'location'
                      ? newTask.scopeIds.join(',')
                      : undefined,
                  deptIds:
                    newTask.scopeType === 'category'
                      ? newTask.scopeIds.join(',')
                      : undefined,
                })
              }
            >
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
