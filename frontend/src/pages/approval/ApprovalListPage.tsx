import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Plus,
  GitBranch,
  AlertTriangle,
  MinusCircle,
  ArrowDownNarrowWide,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  getApprovalList,
  getApprovalDetail,
  getPendingCount,
  approveItem,
  rejectItem,
  getProcessStats,
  type ProcessTypeStat,
} from '@/api/approval';
import type { ApprovalItem } from '@/api/approval';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { workflowApi } from '@/api/workflow';
import type { WorkflowDefinitionDTO } from '@/api/workflow';
import { isCustomBusinessType } from '@/constants/workflowBusiness';
import { getUserList } from '@/api/base';
import ApprovalFlowTracker, { type FlowStep } from '@/components/ApprovalFlowTracker';

type ApprovalTab = 'pending' | 'submitted' | 'completed';

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: 'pending', label: '待我审批' },
  { key: 'submitted', label: '我发起的' },
  { key: 'completed', label: '已通过' },
];

const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  PENDING:     { label: '审批中', dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  APPROVING:   { label: '审批中', dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  IN_PROGRESS: { label: '审批中', dot: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  APPROVED:    { label: '已通过', dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED:    { label: '已驳回', dot: 'bg-red-400',    text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  CANCELLED:   { label: '已取消', dot: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  ASSET_TRANSFER:  { label: '资产调拨', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  ASSET_CLEARANCE: { label: '资产清退', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  ASSET_SCRAP:     { label: '资产报废', color: 'bg-red-50 text-red-600 border-red-200' },
  WORK_ORDER:      { label: '工单申请', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  transfer:        { label: '资产转移', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  dispose:         { label: '资产清退', color: 'bg-violet-50 text-violet-600 border-violet-200' },
  maintenance:     { label: '维保申请', color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
};

const TYPE_OPTIONS = [
  { value: 'ASSET_TRANSFER', label: '资产调拨' },
  { value: 'ASSET_CLEARANCE', label: '资产清退' },
  { value: 'ASSET_SCRAP', label: '资产报废' },
  { value: 'WORK_ORDER', label: '工单申请' },
];

const PAGE_SIZE = 10;

// ── Quick filter pill definitions for type filtering ──
const TYPE_FILTERS = [
  { value: 'ASSET_TRANSFER', label: '资产调拨', dot: 'bg-blue-400' },
  { value: 'ASSET_CLEARANCE', label: '资产清退', dot: 'bg-violet-400' },
  { value: 'ASSET_SCRAP', label: '资产报废', dot: 'bg-red-400' },
  { value: 'WORK_ORDER', label: '工单申请', dot: 'bg-amber-400' },
];

// ── Priority visual system ──
type PriorityLevel = 'urgent' | 'normal' | 'low';

const PRIORITY_MAP: Record<string, PriorityLevel> = {
  ASSET_CLEARANCE: 'urgent',
  ASSET_SCRAP: 'urgent',
  ASSET_COMPENSATION: 'urgent',
  RETIREMENT: 'urgent',
  ASSET_TRANSFER: 'normal',
  WORK_ORDER: 'low',
  maintenance: 'low',
  transfer: 'normal',
  dispose: 'urgent',
};

const PRIORITY_CONFIG: Record<PriorityLevel, {
  label: string;
  icon: typeof AlertTriangle;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  rowBg: string;
  order: number;
}> = {
  urgent: {
    label: '紧急',
    icon: AlertTriangle,
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    borderAccent: 'border-l-[3px] border-l-red-500',
    rowBg: 'bg-gradient-to-r from-red-50/20 to-transparent',
    order: 0,
  },
  normal: {
    label: '普通',
    icon: ArrowDownNarrowWide,
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
    borderAccent: 'border-l-[3px] border-l-blue-500',
    rowBg: '',
    order: 1,
  },
  low: {
    label: '低优先级',
    icon: MinusCircle,
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-500',
    borderAccent: '',
    rowBg: '',
    order: 2,
  },
};

function derivePriority(row: ApprovalItem): PriorityLevel {
  const t = row.processType ?? row.businessType ?? '';
  return PRIORITY_MAP[t] ?? 'normal';
}

// ── Stat card definitions ──
interface StatCardDef {
  label: string;
  icon: typeof ClipboardCheck;
  gradient: string;
}

const STAT_CARD_DEFS: StatCardDef[] = [
  { label: '待审批', icon: ClipboardCheck, gradient: 'from-blue-600 to-cyan-500' },
  { label: '我发起的', icon: Clock, gradient: 'from-violet-500 to-purple-400' },
  { label: '已通过', icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-400' },
  { label: '已驳回', icon: XCircle, gradient: 'from-red-500 to-orange-400' },
];

export default function ApprovalListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectDialogVersion, setRejectDialogVersion] = useState<number>(0);
  const [rejectReason, setRejectReason] = useState('');
  const [launchOpen, setLaunchOpen] = useState(false);

  // ── ENABLED 自定义流程列表（发起申请用）──
  const { data: allWorkflows, isError: workflowsError, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows', 'list', 'launch'],
    queryFn: () => workflowApi.list(),
    enabled: launchOpen,
    staleTime: 30_000,
  });
  const launchableFlows: WorkflowDefinitionDTO[] = Array.isArray(allWorkflows)
    ? (allWorkflows as WorkflowDefinitionDTO[]).filter(
        w => isCustomBusinessType(w.businessType) &&
             (w.status === 'ENABLED' || w.status === 'PUBLISHED')
      )
    : [];

  // Derive the status query param from activeTab + filterStatus
  const queryStatus = activeTab === 'pending' ? 'PENDING' : activeTab === 'completed' ? 'APPROVED' : filterStatus !== 'all' ? filterStatus.toUpperCase() : undefined;

  // ── Pending count for summary cards ──
  const { data: pendingCountRes } = useQuery({
    queryKey: ['approvals', 'pending-count'],
    queryFn: () => getPendingCount(),
    staleTime: 1000 * 30,
  });
  const pendingCount = (pendingCountRes as number | undefined) ?? 0;

  // ── Submitted count (mine) for stat bar ──
  const { data: submittedCountRes } = useQuery({
    queryKey: ['approvals', 'count', 'mine'],
    queryFn: () => getApprovalList({ mine: true, page: 1, pageSize: 1 }),
    staleTime: 1000 * 60,
  });
  const submittedCount = submittedCountRes?.total ?? 0;

  // ── Approved count for summary cards ──
  const { data: approvedCountRes } = useQuery({
    queryKey: ['approvals', 'count', 'APPROVED'],
    queryFn: () => getApprovalList({ status: 'APPROVED', page: 1, pageSize: 1 }),
    staleTime: 1000 * 60,
  });
  const approvedCount = approvedCountRes?.total ?? 0;

  // ── Rejected count for summary cards ──
  const { data: rejectedCountRes } = useQuery({
    queryKey: ['approvals', 'count', 'REJECTED'],
    queryFn: () => getApprovalList({ status: 'REJECTED', page: 1, pageSize: 1 }),
    staleTime: 1000 * 60,
  });
  const rejectedCount = rejectedCountRes?.total ?? 0;

  // ── Approval list ──
  const statusParam = filterStatus !== 'all' ? filterStatus.toUpperCase() : queryStatus;
  const trimmedKeyword = keyword.trim();
  const isMineTab = activeTab === 'submitted';
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['approvals', activeTab, filterType, statusParam, trimmedKeyword, page, startDate, endDate],
    queryFn: () =>
      getApprovalList({
        status: isMineTab ? undefined : statusParam,
        processType: filterType !== 'all' ? filterType : undefined,
        keyword: trimmedKeyword || undefined,
        mine: isMineTab ? true : undefined,
        page,
        pageSize: PAGE_SIZE,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    staleTime: 1000 * 30,
    placeholderData: (p) => p,
  });

  const records: ApprovalItem[] = data?.records ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Approve mutation ──
  const approveMutation = useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      approveItem(id, { version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: Error) => toast.error(err.message || '操作失败'),
  });

  // ── Reject mutation ──
  const rejectMutation = useMutation({
    mutationFn: ({ id, version, reason }: { id: number; version: number; reason: string }) =>
      rejectItem(id, { version, rejectionReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setRejectDialogId(null);
      setRejectReason('');
    },
    onError: (err: Error) => toast.error(err.message || '操作失败'),
  });

  // ── Detail query ──
  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['approvals', 'detail', detailId],
    queryFn: () => getApprovalDetail(detailId!),
    enabled: detailId !== null,
  });
  // 后端返回 { process: ApprovalProcess, records: [...] }
  const detailContainer = detailRes as { process?: ApprovalItem; records?: Record<string, unknown>[]; workflowRuntimePath?: Record<string, unknown>[] } | null | undefined;
  const detail: ApprovalItem | null = detailContainer?.process ?? null;
  const detailRecords: Record<string, unknown>[] = detailContainer?.records ?? [];
  const workflowPath: Record<string, unknown>[] = detailContainer?.workflowRuntimePath ?? [];

  // ── User name map for flow tracker ──
  const { data: userNameMapRes } = useQuery({
    queryKey: ['users', 'name-map'],
    queryFn: async () => {
      const r = await getUserList({ page: 1, pageSize: 200 });
      const records = (r as { records?: { id: number; realName?: string; username?: string }[] }).records ?? [];
      return new Map<number, string>(records.map(u => [u.id, u.realName || u.username || `用户${u.id}`]));
    },
    staleTime: 60000,
  });

  // ── Flow steps for visualization ──
  const flowSteps: FlowStep[] = (workflowPath as Array<Record<string, unknown>>).map((node: Record<string, unknown>, _i: number) => {
    const stepNo = typeof node.stepNo === 'number' ? node.stepNo : Number(node.stepNo ?? 1);
    const match = (detailRecords as Array<Record<string, unknown>>).find((r: Record<string, unknown>) => r.stepNo === stepNo);
    const approverId = match?.approverId as number | undefined;
    return {
      stepNo,
      nodeId: String(node.nodeId ?? node.nodeCode ?? ''),
      nodeCode: String(node.nodeCode ?? ''),
      label: String(node.label ?? ''),
      approverType: String(node.approverType ?? ''),
      approverRole: String(node.approverRole ?? ''),
      approverRoleName: String(node.approverRoleName ?? ''),
      approvalMode: String(node.approvalMode ?? 'sequence'),
      record: match ? {
        approverId: approverId ?? 0,
        approverName: approverId != null ? (userNameMapRes?.get(approverId) ?? `用户${approverId}`) : undefined,
        result: String(match.approveResult ?? ''),
        opinion: String(match.approveOpinion ?? ''),
        time: String(match.approveTime ?? ''),
      } : undefined,
    };
  });

  const handleTabChange = (tab: ApprovalTab) => {
    setActiveTab(tab);
    setPage(1);
    setFilterStatus('all');
    setKeyword('');
    setStartDate('');
    setEndDate('');
  };

  // Stat values mapped by index to STAT_CARD_DEFS
  const statValues = [pendingCount, submittedCount, approvedCount, rejectedCount];

  // ── Workflow process type stats ──
  const { data: processStats } = useQuery({
    queryKey: ['approvals', 'stats'],
    queryFn: () => getProcessStats(),
    staleTime: 60000,
  });
  const stats: ProcessTypeStat[] = (processStats as ProcessTypeStat[] | undefined) ?? [];

  const STAT_LABELS: Record<string, string> = {
    ASSET_TRANSFER: '资产调拨', ASSET_CLEARANCE: '资产清退',
    ASSET_SCRAP: '资产报废', ASSET_COMPENSATION: '资产赔偿',
    WORK_ORDER: '工单', RETIREMENT: '退役',
  };

  const getStatusInfo = (status: string) =>
    STATUS_MAP[status] ?? { label: status, dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' };

  const getTypeInfo = (type: string) =>
    TYPE_MAP[type] ?? { label: type, color: 'bg-slate-50 text-slate-500 border-slate-200' };

  const canApproveRow = (row: ApprovalItem) =>
    activeTab === 'pending' && (row.status === 'PENDING' || row.status === 'APPROVING' || row.status === 'IN_PROGRESS');

  // ── DataTable columns ──
  const columns: Column<ApprovalItem>[] = [
    {
      key: 'priority', title: '紧急程度', width: 100,
      render: (_v, row) => {
        const priority = derivePriority(row);
        const priConf = PRIORITY_CONFIG[priority];
        const PriIcon = priConf.icon;
        return (
          <span className={`inline-flex items-center gap-1 ${priConf.badgeBg} ${priConf.badgeText} rounded-md px-2 py-0.5 text-[11px] font-semibold`}>
            <PriIcon className="h-3 w-3" />
            {priConf.label}
          </span>
        );
      },
    },
    {
      key: 'processNo', title: '申请编号', width: 130,
      render: (_v, row) => {
        const displayId = row.processNo ?? String(row.id);
        return <span className="text-xs font-bold text-blue-600">{displayId}</span>;
      },
    },
    {
      key: 'title', title: '标题',
      render: (_v, row) => {
        const displayTitle = row.title ?? row.processType ?? '-';
        return <span className="text-sm text-slate-800">{displayTitle}</span>;
      },
    },
    {
      key: 'processType', title: '类型', width: 110,
      render: (_v, row) => {
        const typeInfo = getTypeInfo(row.processType ?? row.businessType ?? '');
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        );
      },
    },
    {
      key: 'applicantName', title: '发起人', width: 120,
      render: (_v, row) => {
        const displayApplicant = row.applicantName ?? (row.applicantId ? `用户${row.applicantId}` : '-');
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">
              {displayApplicant.charAt(0)}
            </div>
            <span className="text-sm text-slate-700">{displayApplicant}</span>
          </div>
        );
      },
    },
    {
      key: 'createTime', title: '发起时间', width: 150,
      render: (_v, row) => {
        const displayTime = row.createTime ?? row.applyTime ?? row.createdAt ?? row.submittedAt ?? '-';
        return <span className="text-xs text-slate-500">{displayTime}</span>;
      },
    },
    {
      key: 'status', title: '状态', width: 110,
      render: (_v, row) => {
        const statusInfo = getStatusInfo(row.status);
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.label}
          </span>
        );
      },
    },
    {
      key: 'id', title: '操作', width: 180, align: 'right',
      render: (_v, row) => {
        const approvable = canApproveRow(row);
        return (
          <div className="flex items-center justify-end gap-1.5">
            {approvable && (
              <>
                <button
                  className="inline-flex h-7 items-center rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                  disabled={approveMutation.isPending}
                  onClick={(e) => { e.stopPropagation(); approveMutation.mutate({ id: row.id, version: row.version ?? 0 }); }}
                >
                  {approveMutation.isPending ? '处理中...' : '通过'}
                </button>
                <button
                  className="inline-flex h-7 items-center rounded-lg border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); setRejectDialogId(row.id); setRejectReason(''); setRejectDialogVersion(row.version ?? 0); }}
                >
                  驳回
                </button>
              </>
            )}
            <button
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
              onClick={(e) => { e.stopPropagation(); setDetailId(row.id); }}
            >
              详情
            </button>
          </div>
        );
      },
    },
  ];

  const handleReset = () => {
    setFilterType('all');
    setFilterStatus('all');
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Active filter chips for result summary bar
  const activeFilterChips: { key: string; label: string; clearFn: () => void }[] = [];
  if (trimmedKeyword) {
    activeFilterChips.push({ key: 'keyword', label: `"${trimmedKeyword}"`, clearFn: () => { setKeyword(''); setPage(1); } });
  }
  if (filterType !== 'all') {
    const opt = TYPE_OPTIONS.find(o => o.value === filterType);
    activeFilterChips.push({ key: 'type', label: opt?.label ?? filterType, clearFn: () => { setFilterType('all'); setPage(1); } });
  }
  if (filterStatus !== 'all') {
    const statusLabelMap: Record<string, string> = { pending: '审批中', approved: '已通过', rejected: '已驳回' };
    activeFilterChips.push({ key: 'status', label: statusLabelMap[filterStatus] ?? filterStatus, clearFn: () => { setFilterStatus('all'); setPage(1); } });
  }
  if (startDate) {
    activeFilterChips.push({ key: 'startDate', label: `从 ${startDate}`, clearFn: () => { setStartDate(''); setPage(1); } });
  }
  if (endDate) {
    activeFilterChips.push({ key: 'endDate', label: `至 ${endDate}`, clearFn: () => { setEndDate(''); setPage(1); } });
  }

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* Header section with title + stat bar */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">审批中心</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                <ClipboardCheck className="h-3 w-3" />
                审批
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLaunchOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <Plus className="h-4 w-4" />
              发起申请
            </button>
          </div>

          {/* Stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {STAT_CARD_DEFS.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">{statValues[idx]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Main content Card */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            {/* Tabs + search row */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {/* Modern pill tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100/80 p-0.5">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                      activeTab === tab.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    {tab.key === 'pending' && pendingCount > 0 && (
                      <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search + filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={keyword}
                    onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                    placeholder="搜索编号、标题或发起人"
                    className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterStatus(val);
                    if (val === 'approved' || val === 'rejected') {
                      setActiveTab('completed');
                    } else if (val === 'pending') {
                      setActiveTab('pending');
                    }
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                >
                  <option value="all">全部状态</option>
                  <option value="pending">审批中</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已驳回</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) {
                        setEndDate('');
                        toast.info('结束日期已重置，不能早于开始日期');
                      }
                      setPage(1);
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  />
                  <span className="text-xs text-slate-400">至</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => {
                      if (startDate && e.target.value < startDate) {
                        toast.error('结束日期不能早于开始日期');
                        return;
                      }
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                {(filterType !== 'all' || filterStatus !== 'all' || trimmedKeyword || startDate || endDate) && (
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <X className="h-3.5 w-3.5" />
                    重置
                  </Button>
                )}
              </div>
            </div>

            {/* Quick filter pills for type */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setFilterType('all'); setPage(1); }}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  filterType === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                全部类型
              </button>
              {TYPE_FILTERS.map(({ value, label, dot }) => {
                const active = filterType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setFilterType(active ? 'all' : value); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : dot}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result summary bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/60 px-5 py-2">
            {activeFilterChips.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                <Filter className="h-3 w-3" />
                {activeFilterChips.length} 项筛选
              </span>
            )}
            <span className="text-xs text-slate-500">
              共 <span className="font-bold text-slate-700">{total}</span> 条
              {' · '}本页 <span className="font-bold text-slate-700">{records.length}</span> 条
            </span>
            {activeFilterChips.length > 0 && (
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
            )}
          </div>

          {/* Workflow process type stats */}
          {stats.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {stats.map((s) => {
                  const label = STAT_LABELS[s.processType] || s.processType;
                  const approveRate = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
                  return (
                    <div key={s.processType} className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-sm transition-colors hover:border-blue-200">
                      <p className="truncate text-[11px] font-medium text-slate-400">{label}</p>
                      <p className="text-base font-bold text-slate-800">{s.total}</p>
                      <div className="mt-0.5 flex justify-center gap-2 text-[10px]">
                        <span className="text-emerald-600">{s.approved}通过</span>
                        <span className="text-red-500">{s.rejected}驳回</span>
                        {s.pending > 0 && <span className="text-blue-500">{s.pending}待审</span>}
                      </div>
                      {s.total > 0 && (
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${approveRate}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error state */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500">
              <XCircle className="h-8 w-8 text-red-500" />
              <p className="font-semibold text-red-600">加载审批数据失败，请重试</p>
              <Button variant="outline" onClick={() => refetch()}>重新加载</Button>
            </div>
          )}

          {/* DataTable */}
          {!isError && (
            <div className="p-4 sm:p-5">
              <DataTable
                columns={columns}
                data={[...records].sort((a, b) => {
                  const pa = PRIORITY_CONFIG[derivePriority(a)].order;
                  const pb = PRIORITY_CONFIG[derivePriority(b)].order;
                  return pa - pb;
                })}
                loading={isLoading}
                rowKey="id"
                pagination={{
                  page,
                  pageSize: PAGE_SIZE,
                  total,
                  onChange: (p) => setPage(p),
                }}
                emptyText="暂无审批数据，试试调整搜索、状态或日期筛选"
              />
            </div>
          )}
        </Card>
      </div>

      {/* ── Launch dialog ── */}
      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发起申请</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            {workflowsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : workflowsError ? (
              <div className="py-8 text-center text-sm text-red-500">
                加载流程列表失败，请关闭后重试
              </div>
            ) : launchableFlows.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <GitBranch className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p>暂无可发起的自定义流程</p>
                <p className="mt-1 text-xs text-slate-400">请在工作流中心发布自定义流程后再来发起</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {launchableFlows.map(flow => (
                  <li key={flow.businessType}>
                    <button
                      type="button"
                      onClick={() => { setLaunchOpen(false); navigate(`/workflow-form/${flow.businessType}`); }}
                      className="group flex w-full items-center gap-4 rounded-lg border border-slate-200 px-4 py-3 text-left transition-all hover:border-blue-200 hover:bg-blue-50/50"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <GitBranch className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600">{flow.name}</p>
                        {flow.description && <p className="mt-0.5 truncate text-xs text-slate-500">{flow.description}</p>}
                      </div>
                      <span className="flex-shrink-0 text-xs font-medium text-blue-600">发起 &rarr;</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ── */}
      <Dialog open={rejectDialogId !== null} onOpenChange={(open) => { if (!open) setRejectDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回审批</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">驳回原因</label>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
              placeholder="请输入驳回原因..."
            />
            <p className="mt-1 text-right text-xs text-slate-400">{rejectReason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogId(null)}>取消</Button>
            <Button
              className="bg-red-600 text-white hover:opacity-90"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectDialogId !== null) {
                  rejectMutation.mutate({ id: rejectDialogId, version: rejectDialogVersion, reason: rejectReason });
                }
              }}
            >
              {rejectMutation.isPending ? '提交中...' : '确认驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail dialog ── */}
      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>审批详情</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : detail ? (
            <div className="space-y-5 px-6 py-4 text-sm">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-400">流程编号</p>
                  <p className="text-xs font-semibold text-slate-900">{detail.processNo ?? detail.id}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-400">流程类型</p>
                  <p className="text-xs font-semibold text-slate-900">{detail.processType ?? detail.businessType ?? '-'}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-400">发起人</p>
                  <p className="text-xs font-semibold text-slate-900">{detail.applicantName ?? (detail.applicantId ? `用户${detail.applicantId}` : '-')}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-slate-400">发起时间</p>
                  <p className="text-xs font-semibold text-slate-900">{detail.createTime ?? detail.applyTime ?? '-'}</p>
                </div>
              </div>

              {/* 流转图 */}
              <div>
                <p className="mb-3 text-[10px] font-semibold tracking-wide text-slate-400">审批流转</p>
                <ApprovalFlowTracker
                  currentStep={detail.currentStep ?? 1}
                  status={detail.status}
                  steps={flowSteps}
                />
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-slate-500">未找到审批详情</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
