import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Search,
  Download,
  Filter,
  Columns3,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  Send,
  TrendingUp,
  ClipboardList,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import {
  getInventoryTaskDetail,
  getTaskAssets,
  confirmAsset,
  batchConfirmAssets,
  submitTask,
  getTaskSummary,
  approveTask,
} from '@/api/inventory';
import { getLocationTree, getDeptList } from '@/api/base';
import type { ActualStatus, InventoryTask, InventoryAsset, InventorySummary } from '@/types/inventory';
import type { ApiResponse, PaginatedResponse, PageData, Location, Department } from '@/types/common';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, SelectItem } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

const ACTUAL_STATUS_OPTIONS: Array<{ value: ActualStatus; label: string; variant: any }> = [
  { value: 'normal', label: '正常', variant: 'success' },
  { value: 'surplus', label: '盘盈', variant: 'default' },
  { value: 'deficit', label: '盘亏', variant: 'danger' },
  { value: 'damaged', label: '损坏', variant: 'warning' },
  { value: 'other', label: '其他', variant: 'gray' },
];

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ActualStatus | undefined;
  onChange: (v: ActualStatus) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={onChange as (v: string) => void}
      disabled={disabled}
      placeholder="选择实盘状态"
    >
      {ACTUAL_STATUS_OPTIONS.map((o) => (
        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
      ))}
    </Select>
  );
}

function numberFrom(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const STATUS_MAP: Record<string, string> = {
  PENDING: 'draft',
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SUBMITTED: 'submitted',
  PENDING_APPROVAL: 'submitted',
  APPROVED: 'submitted',
};

export default function InventoryDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [assetParams, setAssetParams] = useState({ page: 1, pageSize: 20 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState<ActualStatus>('normal');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: taskRes, isLoading: taskLoading } = useQuery({
    queryKey: ['inventory', 'task', taskId],
    queryFn: () => getInventoryTaskDetail(taskId!),
    enabled: !!taskId,
  });

  const { data: assetsRes, isLoading: assetsLoading } = useQuery({
    queryKey: ['inventory', 'assets', taskId, assetParams],
    queryFn: () => getTaskAssets(taskId!, assetParams),
    enabled: !!taskId,
    staleTime: 1000 * 15,
  });

  const { data: summaryRes } = useQuery({
    queryKey: ['inventory', 'summary', taskId],
    queryFn: () => getTaskSummary(taskId!),
    enabled: !!taskId,
  });

  // 获取位置和部门名称映射
  const { data: locations } = useQuery({
    queryKey: ['base', 'locations', 'tree'],
    queryFn: () => getLocationTree(),
    enabled: !!taskId,
  });

  const { data: departments } = useQuery({
    queryKey: ['base', 'departments'],
    queryFn: () => getDeptList(),
    enabled: !!taskId,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ assetId, status }: { assetId: string; status: ActualStatus }) =>
      confirmAsset(taskId!, assetId, { actualStatus: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'assets', taskId] }),
  });

  const batchConfirmMutation = useMutation({
    mutationFn: () =>
      batchConfirmAssets(taskId!, {
        assetIds: Array.from(selected),
        actualStatus: batchStatus,
      }),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['inventory', 'assets', taskId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitTask(taskId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      navigate('/inventory');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTask(taskId!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['inventory', 'task', taskId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'summary', taskId] });
      toast.success(
        `调账完成：盘盈 ${res.surplusCreated} 项，盘亏 ${res.deficitMarked} 项，损坏 ${res.damagedMarked} 项`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || '审批调账失败');
    },
  });

  const rawDetail = taskRes as unknown as { task?: Record<string, any>; details?: any[] } | undefined;
  const rawTask = rawDetail?.task;
  const task: InventoryTask | undefined = rawTask
    ? (() => {
        const total = numberFrom(rawTask.totalCount ?? rawTask.totalAssets);
        const counted = numberFrom(rawTask.scannedCount ?? rawTask.countedAssets);
        const rawStatus = String(rawTask.status ?? 'draft');
        const status = (STATUS_MAP[rawStatus] ?? rawStatus.toLowerCase()) as InventoryTask['status'];
        return {
          taskId: String(rawTask.id ?? rawTask.taskId ?? taskId ?? ''),
          taskName: rawTask.taskName ?? '未命名盘点',
          scopeType: rawTask.scopeType ?? (rawTask.deptIds ? 'category' : 'all'),
          scopeIds: rawTask.scopeIds
            ? (Array.isArray(rawTask.scopeIds) ? rawTask.scopeIds : String(rawTask.scopeIds).split(',').filter(Boolean))
            : rawTask.deptIds
              ? String(rawTask.deptIds).split(',').filter(Boolean)
              : [],
          status,
          progress: total > 0 ? Math.round((counted / total) * 100) : 0,
          totalAssets: total,
          countedAssets: counted,
          uncountedAssets: Math.max(total - counted, 0),
          surplusAssets: numberFrom(rawTask.surplusCount ?? rawTask.surplusAssets),
          deficitAssets: numberFrom(rawTask.lossCount ?? rawTask.deficitCount ?? rawTask.deficitAssets),
          createdAt: rawTask.createTime ?? rawTask.createdAt ?? '',
          updatedAt: rawTask.updateTime ?? rawTask.updatedAt ?? '',
          assigneeName: rawTask.assigneeName,
        } satisfies InventoryTask;
      })()
    : undefined;
  const rawStatus = rawTask ? String(rawTask.status ?? '') : '';
  const records = (assetsRes as PageData<InventoryAsset> | undefined)?.records ?? [];
  const total = (assetsRes as PageData<InventoryAsset> | undefined)?.total ?? 0;
  const summary = summaryRes as unknown as InventorySummary | undefined;
  const canSubmit = task?.status === 'completed' || task?.progress >= 100;
  const progressPct = task?.progress ?? 0;
  const countedAssets = task?.countedAssets ?? 0;
  const totalAssets = task?.totalAssets ?? 0;
  const normalCount = summary?.normalCount ?? 0;
  const abnormalCount = summary?.abnormalCount ?? 0;
  const surplusCount = summary?.surplusCount ?? task?.surplusAssets ?? 0;
  const deficitCount = summary?.deficitCount ?? task?.deficitAssets ?? 0;
  /** 异常待处理 = 损坏 + 其他 + 未确认异常 */
  const pendingAbnormal = abnormalCount - surplusCount - deficitCount;
  const matchRate = countedAssets > 0 ? ((normalCount / countedAssets) * 100) : 0;

  /**
   * 将位置/部门树展平为 id→name 映射
   * 用于将 scopeIds 中的裸 ID 渲染为有意义的名称
   */
  const nameMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};

    const flattenLocations = (items: Location[]) => {
      if (!items) return;
      for (const item of items) {
        if (item.id != null) map[String(item.id)] = item.name;
        if (item.children && item.children.length > 0) {
          flattenLocations(item.children);
        }
      }
    };

    const flattenDepartments = (items: Department[]) => {
      if (!items) return;
      for (const item of items) {
        if (item.id != null) map[String(item.id)] = item.deptName || item.name || '';
        if (item.children && item.children.length > 0) {
          flattenDepartments(item.children);
        }
      }
    };

    if (locations) flattenLocations(locations as unknown as Location[]);
    if (departments) flattenDepartments(departments as unknown as Department[]);

    return map;
  }, [locations, departments]);

  const columns: Column<any>[] = [
    {
      key: 'assetCode',
      title: '资产编号',
      width: 140,
      render: (v, row) => {
        /** 根据实盘状态渲染左侧色条，提供快速视觉锚点 */
        const status: ActualStatus | undefined = row.actualStatus;
        let barColor = 'bg-slate-200';
        if (status === 'normal') barColor = 'bg-emerald-400';
        else if (status === 'surplus') barColor = 'bg-amber-400';
        else if (status === 'deficit') barColor = 'bg-red-400';
        else if (status === 'damaged') barColor = 'bg-orange-400';
        else if (status === 'other') barColor = 'bg-orange-300';
        return (
          <span className="inline-flex items-center gap-2">
            <span className={`w-1.5 h-5 rounded-full shrink-0 ${barColor} transition-colors`} />
            <span className="font-mono text-[13px] text-blue-600 font-bold tracking-tight">
              {String(v)}
            </span>
          </span>
        );
      },
    },
    {
      key: 'assetName',
      title: '资产名称',
      render: (v) => <span className="text-[13px] text-slate-900 font-medium">{String(v)}</span>,
    },
    {
      key: 'categoryName',
      title: '分类',
      width: 100,
      render: (v) => <span className="text-[13px] text-slate-500">{String(v)}</span>,
    },
    {
      key: 'locationPath',
      title: '应存位置',
      width: 140,
      render: (v) => <span className="text-[13px] text-slate-500">{String(v)}</span>,
    },
    {
      key: 'actualLocation',
      title: '实存位置',
      width: 140,
      render: (v, row) => {
        if (row.actualStatus === 'deficit') {
          return <span className="text-[13px] text-red-600 italic">未找到</span>;
        }
        if (v && v !== row.locationPath) {
          return <span className="text-[13px] text-red-500 font-semibold">{String(v)}</span>;
        }
        return <span className="text-[13px] text-slate-500">{String(v ?? row.locationPath)}</span>;
      },
    },
    {
      key: 'actualStatus',
      title: '盘点状态',
      width: 120,
      render: (v) => {
        if (v === 'normal') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[12px] font-semibold rounded-md border border-emerald-200/60 shadow-sm">
              <CheckCircle2 className="w-3 h-3" />
              账实一致
            </span>
          );
        }
        if (v === 'surplus') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[12px] font-semibold rounded-md border border-amber-200/60 shadow-sm">
              <ArrowUpRight className="w-3 h-3" />
              盘盈
            </span>
          );
        }
        if (v === 'deficit') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-[12px] font-semibold rounded-md border border-red-300/60 shadow-sm ring-1 ring-red-200/40">
              <ArrowDownRight className="w-3 h-3" />
              盘亏
            </span>
          );
        }
        if (v === 'damaged') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-[12px] font-semibold rounded-md border border-orange-200/60 shadow-sm">
              <AlertTriangle className="w-3 h-3" />
              损坏
            </span>
          );
        }
        if (v === 'other') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 text-[12px] font-semibold rounded-md border border-slate-200/60 shadow-sm">
              异常待处理
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-400 text-[12px] font-medium rounded-md border border-slate-200/60">
            待确认
          </span>
        );
      },
    },
    {
      key: 'confirmedBy',
      title: '盘点人',
      width: 100,
      render: (v) => <span className="text-[13px] text-slate-800">{String(v ?? '—')}</span>,
    },
    {
      key: 'confirmedAt',
      title: '盘点时间',
      width: 140,
      render: (v) => (
        <span className="text-[13px] text-slate-500">
          {v ? String(v).substring(0, 16) : '—'}
        </span>
      ),
    },
  ];

  if (taskLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/10 to-indigo-50/20 p-6">
        <div className="max-w-[1440px] mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/10 to-indigo-50/20">
      <div className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* ======== 页面顶栏 ======== */}
        <PageHeader
          title={task?.taskName ?? '盘点详情'}
          subtitle={`任务编号: ${taskId ?? '—'}`}
          breadcrumbs={[
            { label: '仪表板', href: '/dashboard' },
            { label: '资产盘点', href: '/inventory' },
            { label: '执行详情' },
          ]}
          actions={
            <div className="flex items-center gap-3">
              <Button variant="outline" size="md" onClick={() => navigate('/inventory')}>
                <Download className="w-4 h-4" /> 导出报告
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/inventory')}
                className="hover:bg-slate-100 active:scale-95 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
          }
        />

        {/* ======== 进度监控 + 盘点范围 ======== */}
        <div className="grid grid-cols-12 gap-6">
          {/* ---------- 进度监控区 ---------- */}
          <div className="col-span-12 lg:col-span-8 bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-bold text-slate-900">盘点进度实时监控</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
                  <span className="text-[11px] text-slate-500 font-medium">已完成</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-slate-200 to-slate-300" />
                  <span className="text-[11px] text-slate-500 font-medium">待完成</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* ---- 环形进度 ---- */}
              <div className="relative w-44 h-44 shrink-0">
                {/* 脉冲光晕 */}
                <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-blue-400/20 via-violet-400/20 to-blue-400/20 animate-pulse blur-sm" />
                {/* 旋转光环 */}
                <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-blue-500/10 animate-spin [animation-duration:6s]" />
                {/* 主圆环 */}
                <div
                  className="w-full h-full rounded-full relative z-10"
                  style={{
                    background: `conic-gradient(#2563eb 0%, #7c3aed ${progressPct}%, #e2e8f0 ${progressPct}%, #e2e8f0 100%)`,
                    boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.8)',
                  }}
                >
                  <div className="absolute inset-4 bg-white/95 backdrop-blur-sm rounded-full flex flex-col items-center justify-center shadow-inner">
                    <span className="text-3xl font-extrabold bg-gradient-to-br from-blue-600 via-blue-700 to-violet-600 bg-clip-text text-transparent">
                      {progressPct.toFixed(0)}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 tracking-wide">
                      总完成率
                    </span>
                    <span className="text-[9px] text-slate-400 mt-1">
                      {countedAssets}/{totalAssets.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* ---- 统计卡片 ---- */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {/* 已盘 / 总数 */}
                <div className="group relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
                  <p className="text-[10px] text-blue-100/80 uppercase tracking-widest font-medium mb-2 relative z-10">
                    已盘 / 总数
                  </p>
                  <p className="text-2xl font-bold text-white relative z-10">
                    {countedAssets}
                    <span className="text-sm font-medium text-blue-200/80 ml-1">
                      / {totalAssets.toLocaleString()}
                    </span>
                  </p>
                  <div className="w-full bg-white/15 h-1.5 rounded-full mt-4 overflow-hidden relative z-10">
                    <div
                      className="h-full bg-white/50 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* 正常状态 */}
                <div className="group relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
                  <p className="text-[10px] text-emerald-100/80 uppercase tracking-widest font-medium mb-2 relative z-10">
                    正常状态
                  </p>
                  <p className="text-2xl font-bold text-white relative z-10">{normalCount}</p>
                  <div className="flex items-center gap-1.5 mt-3 relative z-10">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[12px] text-emerald-100 font-medium">验证通过</span>
                  </div>
                </div>

                {/* 异常发现 */}
                <div className="group relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-md shadow-rose-500/20 hover:shadow-xl hover:shadow-rose-500/30 hover:-translate-y-0.5 transition-all duration-300">
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
                  <p className="text-[10px] text-rose-100/80 uppercase tracking-widest font-medium mb-2 relative z-10">
                    异常发现
                  </p>
                  <p className="text-2xl font-bold text-white relative z-10">{abnormalCount}</p>
                  <div className="flex items-center gap-1.5 mt-3 relative z-10">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[12px] text-rose-100 font-medium">需要人工核查</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- 盘点范围面板 ---------- */}
          <div className="col-span-12 lg:col-span-4 bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-900">盘点范围</h3>
            </div>
            <div className="space-y-6">
              {/* 责任部门 */}
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> 责任部门
                </p>
                <div className="flex flex-wrap gap-2">
                  {task?.scopeType === 'location' || task?.scopeType === 'all' || !task ? (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-500 text-[12px] font-medium rounded-full border border-slate-200/60">
                      全部门
                    </span>
                  ) : (task.scopeIds ?? []).length > 0 ? (
                    task.scopeIds.map((id) => (
                      <span
                        key={id}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-[12px] font-medium rounded-full border border-blue-200/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default"
                      >
                        {nameMap[id] || id}
                      </span>
                    ))
                  ) : (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-500 text-[12px] font-medium rounded-full border border-slate-200/60">
                      未指定
                    </span>
                  )}
                </div>
              </div>

              {/* 关键点位 */}
              <div className="pt-5 border-t border-slate-100">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> 关键点位
                </p>
                <ul className="space-y-3">
                  {task?.scopeType === 'location' && task.scopeIds && task.scopeIds.length > 0
                    ? task.scopeIds.map((id, idx) => (
                        <li
                          key={id}
                          className="flex items-center justify-between text-[13px] text-slate-800 group hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[9px] font-bold shadow-sm">
                              {idx + 1}
                            </span>
                            {nameMap[id] || id}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
                            点位
                          </Badge>
                        </li>
                      ))
                    : (
                        <li className="text-[13px] text-slate-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          全范围
                        </li>
                      )
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ======== 盘点结果对比 ======== */}
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-900">盘点结果对比</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 账实一致 */}
            <div className="relative overflow-hidden p-4 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-green-50/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[11px] text-emerald-600/70 uppercase tracking-wider font-medium">账实一致</p>
                  <p className="text-2xl font-bold text-emerald-700">{normalCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${matchRate}%` }}
                  />
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold">{matchRate.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-emerald-500/70 mt-2">账面与实盘核对一致</p>
            </div>

            {/* 盘盈 */}
            <div className="relative overflow-hidden p-4 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-yellow-50/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100">
                  <ArrowUpRight className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[11px] text-amber-600/70 uppercase tracking-wider font-medium">盘盈</p>
                  <p className="text-2xl font-bold text-amber-700">{surplusCount}</p>
                </div>
              </div>
              {summary?.surplusItems && summary.surplusItems.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {summary.surplusItems.slice(0, 3).map((item) => (
                    <li key={item.assetCode} className="text-[11px] text-amber-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-400" />
                      {item.assetName}
                    </li>
                  ))}
                  {summary.surplusItems.length > 3 && (
                    <li className="text-[10px] text-amber-500">+{summary.surplusItems.length - 3} 项</li>
                  )}
                </ul>
              ) : (
                <p className="text-[10px] text-amber-500/70 mt-2">暂无盘盈记录</p>
              )}
            </div>

            {/* 盘亏 */}
            <div className="relative overflow-hidden p-4 rounded-xl border border-red-200/60 bg-gradient-to-br from-red-50/80 to-rose-50/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100">
                  <ArrowDownRight className="w-4.5 h-4.5 text-red-600" />
                </div>
                <div>
                  <p className="text-[11px] text-red-600/70 uppercase tracking-wider font-medium">盘亏</p>
                  <p className="text-2xl font-bold text-red-700">{deficitCount}</p>
                </div>
              </div>
              {summary?.deficitItems && summary.deficitItems.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {summary.deficitItems.slice(0, 3).map((item) => (
                    <li key={item.assetCode} className="text-[11px] text-red-600 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-red-400" />
                      {item.assetName}
                    </li>
                  ))}
                  {summary.deficitItems.length > 3 && (
                    <li className="text-[10px] text-red-500">+{summary.deficitItems.length - 3} 项</li>
                  )}
                </ul>
              ) : (
                <p className="text-[10px] text-red-500/70 mt-2">暂无盘亏记录</p>
              )}
            </div>

            {/* 异常待处理 */}
            <div className="relative overflow-hidden p-4 rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-gray-50/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100">
                  <AlertTriangle className="w-4.5 h-4.5 text-slate-500" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500/70 uppercase tracking-wider font-medium">异常待处理</p>
                  <p className="text-2xl font-bold text-slate-700">{Math.max(pendingAbnormal, 0)}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                含损坏、其他状态及未确认异常项
              </p>
              {pendingAbnormal > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-[11px] text-orange-600 font-medium">需人工核查</span>
                </div>
              )}
            </div>
          </div>
          {/* ---- 比例分布条 ---- */}
          {countedAssets > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 mb-2 font-medium">盘点结果比例分布</p>
              <div className="flex h-3 rounded-full overflow-hidden gap-[2px]">
                <div
                  className="bg-emerald-400 rounded-l-full transition-all duration-500"
                  style={{ width: `${countedAssets > 0 ? (normalCount / countedAssets) * 100 : 0}%` }}
                  title={`账实一致: ${normalCount}`}
                />
                <div
                  className="bg-amber-400 transition-all duration-500"
                  style={{ width: `${countedAssets > 0 ? (surplusCount / countedAssets) * 100 : 0}%` }}
                  title={`盘盈: ${surplusCount}`}
                />
                <div
                  className="bg-red-400 transition-all duration-500"
                  style={{ width: `${countedAssets > 0 ? (deficitCount / countedAssets) * 100 : 0}%` }}
                  title={`盘亏: ${deficitCount}`}
                />
                {pendingAbnormal > 0 && (
                  <div
                    className="bg-slate-300 rounded-r-full transition-all duration-500"
                    style={{ width: `${(Math.max(pendingAbnormal, 0) / countedAssets) * 100}%` }}
                    title={`异常待处理: ${Math.max(pendingAbnormal, 0)}`}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2.5">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> 一致 {matchRate.toFixed(0)}%
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> 盘盈 {countedAssets > 0 ? ((surplusCount / countedAssets) * 100).toFixed(0) : 0}%
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> 盘亏 {countedAssets > 0 ? ((deficitCount / countedAssets) * 100).toFixed(0) : 0}%
                </span>
                {pendingAbnormal > 0 && (
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-slate-300" /> 异常 {((Math.max(pendingAbnormal, 0) / countedAssets) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ======== 批量确认条 (粘性底部) ======== */}
        <div
          className={`sticky bottom-4 z-20 transition-all duration-500 ease-out ${
            selected.size > 0
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0 pointer-events-none absolute'
          }`}
        >
          {selected.size > 0 && (
            <div className="bg-white/95 backdrop-blur-xl rounded-xl border border-blue-200/60 shadow-xl shadow-blue-900/10 p-4 flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  已选 <span className="text-blue-600">{selected.size}</span> 条
                </span>
              </div>
              <div className="w-44">
                <StatusSelect value={batchStatus} onChange={setBatchStatus} />
              </div>
              <Button
                size="md"
                loading={batchConfirmMutation.isPending}
                onClick={() => batchConfirmMutation.mutate()}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md shadow-blue-500/20"
              >
                批量确认
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelected(new Set())}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                取消选择
              </Button>
            </div>
          )}
        </div>

        {/* ======== 资产明细表 ======== */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-blue-900/5 overflow-hidden">
          {/* 表头：Tabs + 操作按钮 */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <ClipboardList className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">资产明细</h3>
              </div>

              {/* 现代 Tabs */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg">
                {[
                  { key: 'all', label: '全部', count: totalAssets },
                  { key: 'pending', label: '待盘', count: totalAssets - countedAssets },
                  { key: 'counted', label: '已盘', count: countedAssets },
                  { key: 'abnormal', label: '异常', count: abnormalCount },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all duration-200 ${
                      activeTab === key
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    {label}
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                        activeTab === key
                          ? 'bg-blue-100 text-blue-700'
                          : key === 'abnormal' && abnormalCount > 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-200/70 text-slate-500'
                      }`}
                    >
                      {count.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索资产..."
                  className="pl-8 pr-3 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all w-40 lg:w-48"
                />
              </div>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className={`p-2 rounded-lg transition-all ${
                  filterOpen
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
                title="切换筛选"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                title="列设置"
              >
                <Columns3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 表格 */}
          <div className="px-0">
            <DataTable
              columns={columns}
              data={records}
              loading={assetsLoading}
              rowKey="assetId"
              pagination={{
                page: assetParams.page,
                pageSize: assetParams.pageSize,
                total,
                onChange: (page, pageSize) => setAssetParams({ page, pageSize }),
              }}
              emptyText="暂无盘点资产"
            />
          </div>
        </div>

        {/* ======== 审批调账结果 ======== */}
        {(rawStatus === 'APPROVED' || (task as any)?.surplusCount != null) && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-emerald-200/60 shadow-lg shadow-emerald-900/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-900">调账执行结果</h3>
              {(task as any)?.approvedAt && (
                <span className="text-xs text-slate-400 ml-auto">
                  审批时间: {(task as any).approvedAt}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-green-50/60 border border-emerald-200/60">
                <p className="text-[11px] text-emerald-600/70 uppercase tracking-wider font-medium mb-1">盘盈创建</p>
                <p className="text-2xl font-bold text-emerald-700">{(task as any)?.surplusCount ?? 0}</p>
                <p className="text-[10px] text-emerald-500/70 mt-1">新资产已入库</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-50/80 to-rose-50/60 border border-red-200/60">
                <p className="text-[11px] text-red-600/70 uppercase tracking-wider font-medium mb-1">盘亏标记</p>
                <p className="text-2xl font-bold text-red-700">{(task as any)?.deficitCount ?? 0}</p>
                <p className="text-[10px] text-red-500/70 mt-1">资产已标记 LOST</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50/80 to-amber-50/60 border border-orange-200/60">
                <p className="text-[11px] text-orange-600/70 uppercase tracking-wider font-medium mb-1">损坏标记</p>
                <p className="text-2xl font-bold text-orange-700">{(task as any)?.damageCount ?? 0}</p>
                <p className="text-[10px] text-orange-500/70 mt-1">资产已标记 MAINTENANCE</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200/60">
                <p className="text-[11px] text-blue-600/70 uppercase tracking-wider font-medium mb-1">任务状态</p>
                <p className="text-2xl font-bold text-blue-700">已核准</p>
                <p className="text-[10px] text-blue-500/70 mt-1">调账完成</p>
              </div>
            </div>
          </div>
        )}

        {/* ======== 底部操作区 ======== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-violet-50/60 border border-slate-200/60 shadow-lg shadow-blue-900/5 p-6">
          {/* 装饰性背景元素 */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-200/20 to-violet-200/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-emerald-200/20 to-blue-200/20 rounded-full blur-2xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
                  <RefreshCw className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                    最后更新
                  </span>
                  <span className="text-[13px] font-semibold text-slate-800">
                    {task?.updatedAt ?? '—'}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block w-px h-10 bg-slate-200/80" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                    当前盘点人
                  </span>
                  <span className="text-[13px] text-slate-800 font-medium">
                    {task?.assigneeName ?? '—'} 等人正在作业
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {rawStatus === 'PENDING_APPROVAL' ? (
                <Button
                  size="md"
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate()}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-300 flex-1 sm:flex-initial"
                >
                  <CheckCircle2 className="w-4 h-4" /> 审批通过并自动调账
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => navigate('/inventory')}
                    className="border-slate-200 text-slate-600 hover:bg-white/80 flex-1 sm:flex-initial"
                  >
                    保存草稿
                  </Button>
                  <Button
                    size="md"
                    loading={submitMutation.isPending}
                    disabled={!canSubmit || task?.status === 'submitted' || rawStatus === 'PENDING_APPROVAL'}
                    onClick={() => submitMutation.mutate()}
                    className="bg-gradient-to-r from-blue-600 via-blue-700 to-violet-600 hover:from-blue-700 hover:via-blue-800 hover:to-violet-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300 flex-1 sm:flex-initial"
                  >
                    <Send className="w-4 h-4" /> 提交盘点审核
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
