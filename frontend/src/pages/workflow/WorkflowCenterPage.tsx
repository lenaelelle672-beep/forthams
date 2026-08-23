import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Layers3,
  ListFilter,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Workflow,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  workflowApi,
  type WorkflowDefinitionDTO,
  type WorkflowDefinitionVersionDTO,
  type WorkflowStartAvailability,
} from '@/api/workflow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { businessFlowOptions, getDraftStorageKey, isBusinessType, isCustomBusinessType } from '@/constants/workflowBusiness';
import { useAuth, type AuthUser } from '@/context/AuthContext';
import { initialFlowEdges, initialFlowNodes } from '@/types/flow';

type WorkflowFilter = 'all' | 'PUBLISHED' | 'DRAFT' | 'DISABLED';

type WorkflowListItem = {
  businessType: string;
  name: string;
  description: string;
  businessName: string;
  formPath: string;
  stepCount: number;
  draft: { savedAt: string | null; nodeCount: number | null };
  server?: WorkflowDefinitionDTO;
  isCustom: boolean;
};

function readDraft(bt: string) {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(bt));
    if (!raw) return { savedAt: null, nodeCount: null };
    const p = JSON.parse(raw);
    return { savedAt: p.savedAt ?? null, nodeCount: Array.isArray(p.nodes) ? p.nodes.length : null };
  } catch {
    return { savedAt: null, nodeCount: null };
  }
}

function fmtDate(v?: string | null) {
  if (!v) return '未记录';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '已记录' : d.toLocaleString('zh-CN', { hour12: false });
}

function countApprovalNodes(definition: Record<string, unknown> | undefined): number {
  if (!definition?.nodes || !Array.isArray(definition.nodes)) return 0;
  return definition.nodes.filter((n: any) => n.type === 'approval' || n.type === 'task').length;
}

function countTotalNodes(definition: Record<string, unknown> | undefined): number {
  if (!definition?.nodes || !Array.isArray(definition.nodes)) return 0;
  return definition.nodes.length;
}

function statusLabel(s?: string) {
  const map: Record<string, string> = {
    UNCONFIGURED: '未配置',
    DRAFT: '草稿中',
    PUBLISHED: '已发布',
    ENABLED: '已启用',
    DISABLED: '已停用',
    FORBIDDEN: '无权限',
  };
  return map[s ?? ''] ?? s ?? '未知';
}

function versionActionLabel(action?: string) {
  if (action === 'ROLLBACK') return '回滚发布';
  if (action === 'PUBLISH') return '正式发布';
  return action || '版本快照';
}

function statusBadge(s?: string) {
  const map: Record<string, { dot: string; ring: string; text: string; bg: string }> = {
    UNCONFIGURED: { dot: 'bg-gray-400', ring: 'ring-gray-300', text: 'text-gray-700', bg: 'bg-gray-50' },
    DRAFT: { dot: 'bg-amber-400', ring: 'ring-amber-300', text: 'text-amber-700', bg: 'bg-amber-50' },
    PUBLISHED: { dot: 'bg-green-400', ring: 'ring-green-300', text: 'text-green-700', bg: 'bg-green-50' },
    ENABLED: { dot: 'bg-emerald-400', ring: 'ring-emerald-300', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    DISABLED: { dot: 'bg-gray-400', ring: 'ring-gray-300', text: 'text-gray-500', bg: 'bg-gray-50' },
  };
  return map[s ?? ''] ?? map.UNCONFIGURED;
}

function canEditWorkflowDefinitions(user: AuthUser | null) {
  if (!user) return true;
  const roles = user.roles ?? [];
  if (roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role.toUpperCase()))) return true;
  const permissions = user.permissions ?? [];
  if (permissions.length === 0) return true;
  return permissions.includes('*') || permissions.includes('*:*:*') || permissions.includes('workflow:definition:edit');
}

function matchesStatus(flow: WorkflowListItem, filter: WorkflowFilter) {
  if (filter === 'all') return true;
  const status = flow.server?.status;
  if (filter === 'PUBLISHED') return status === 'PUBLISHED' || status === 'ENABLED';
  if (filter === 'DRAFT') return status === 'DRAFT' || (!flow.server && flow.draft.savedAt);
  return status === filter;
}

function workflowSearchText(flow: WorkflowListItem) {
  return [
    flow.name,
    flow.businessType,
    flow.description,
    flow.businessName,
    flow.server?.status,
    flow.server?.version,
  ].filter(Boolean).join(' ').toLowerCase();
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const VERSION_PAGE_SIZE = 5;
const FILTER_OPTIONS: Array<{ key: WorkflowFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'PUBLISHED', label: '已发布' },
  { key: 'DRAFT', label: '草稿中' },
  { key: 'DISABLED', label: '已停用' },
];

const ACCENT_COLORS: Record<string, string> = {
  ASSET_TRANSFER: 'bg-blue-500',
  ASSET_CLEARANCE: 'bg-emerald-500',
  ASSET_SCRAP: 'bg-amber-500',
  ASSET_COMPENSATION: 'bg-red-500',
  RETIREMENT: 'bg-purple-500',
};

function buildPageWindow(current: number, total: number) {
  const windowSize = 5;
  if (total <= windowSize) return Array.from({ length: total }, (_, index) => index + 1);
  const half = Math.floor(windowSize / 2);
  const start = Math.max(1, Math.min(current - half, total - windowSize + 1));
  return Array.from({ length: windowSize }, (_, index) => start + index);
}

export default function WorkflowCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [defs, setDefs] = useState<WorkflowDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState<WorkflowFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedBusinessType, setSelectedBusinessType] = useState<string | null>(null);
  const [detailVersions, setDetailVersions] = useState<WorkflowDefinitionVersionDTO[]>([]);
  const [detailAvailability, setDetailAvailability] = useState<WorkflowStartAvailability | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [versionPage, setVersionPage] = useState(1);
  const [selectedVersionDetail, setSelectedVersionDetail] = useState<WorkflowDefinitionVersionDTO | null>(null);
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);
  const [versionDetailErr, setVersionDetailErr] = useState<string | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<WorkflowDefinitionVersionDTO | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState('');
  const [rollingBack, setRollingBack] = useState(false);
  const canEditWorkflow = useMemo(() => canEditWorkflowDefinitions(user), [user]);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const list = await workflowApi.list();
      setDefs(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const flows = useMemo<WorkflowListItem[]>(() => {
    const predefined = businessFlowOptions.map((f) => ({
      ...f,
      draft: readDraft(f.businessType),
      server: defs.find((d) => d.businessType === f.businessType),
      isCustom: false,
    }));
    const customDefs = defs.filter((d) => d.businessType && !isBusinessType(d.businessType) && isCustomBusinessType(d.businessType));
    const custom = customDefs.map((d) => ({
      businessType: d.businessType,
      name: d.name || d.businessType,
      description: d.description || '自定义流程',
      businessName: '自定义',
      formPath: '',
      stepCount: countApprovalNodes(d.definition) || 4,
      draft: { savedAt: null, nodeCount: null },
      server: d,
      isCustom: true,
    }));
    return [...predefined, ...custom];
  }, [defs]);

  const kpiCards = useMemo(() => [
    { label: '流程总数', value: flows.length, sub: '全部业务流程', icon: GitBranch, iconClass: 'text-blue-600 bg-blue-50', filterKey: 'all' as WorkflowFilter },
    { label: '已发布', value: flows.filter((f) => f.server?.status === 'PUBLISHED' || f.server?.status === 'ENABLED').length, sub: '可用于发起', icon: CheckCircle, iconClass: 'text-green-600 bg-green-50', filterKey: 'PUBLISHED' as WorkflowFilter },
    { label: '草稿中', value: flows.filter((f) => f.server?.status === 'DRAFT' || (!f.server && f.draft.savedAt)).length, sub: '待完善发布', icon: Clock, iconClass: 'text-amber-600 bg-amber-50', filterKey: 'DRAFT' as WorkflowFilter },
    { label: '已停用', value: flows.filter((f) => f.server?.status === 'DISABLED').length, sub: '暂停发起', icon: XCircle, iconClass: 'text-slate-500 bg-slate-100', filterKey: 'DISABLED' as WorkflowFilter },
  ], [flows]);

  const filteredFlows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return flows
      .filter((flow) => matchesStatus(flow, activeFilter))
      .filter((flow) => !normalized || workflowSearchText(flow).includes(normalized));
  }, [activeFilter, flows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredFlows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedFlows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredFlows.slice(start, start + pageSize);
  }, [filteredFlows, pageSize, safePage]);
  const resultStart = filteredFlows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const resultEnd = filteredFlows.length === 0 ? 0 : Math.min(filteredFlows.length, safePage * pageSize);
  const pageNumbers = useMemo(() => buildPageWindow(safePage, totalPages), [safePage, totalPages]);
  const selectedFlow = useMemo(() => {
    if (!pagedFlows.length) return null;
    return pagedFlows.find((flow) => flow.businessType === selectedBusinessType) ?? pagedFlows[0];
  }, [pagedFlows, selectedBusinessType]);
  const selectedVersionFromList = useMemo(() => (
    detailVersions.find((version) => version.version === selectedVersionNumber) ?? detailVersions[0] ?? null
  ), [detailVersions, selectedVersionNumber]);
  const selectedVersion = useMemo(() => {
    if (selectedVersionDetail && selectedVersionDetail.version === selectedVersionFromList?.version) {
      return selectedVersionDetail;
    }
    return selectedVersionFromList;
  }, [selectedVersionDetail, selectedVersionFromList]);
  const versionTotalPages = Math.max(1, Math.ceil(detailVersions.length / VERSION_PAGE_SIZE));
  const safeVersionPage = Math.min(versionPage, versionTotalPages);
  const pagedVersions = useMemo(() => {
    const start = (safeVersionPage - 1) * VERSION_PAGE_SIZE;
    return detailVersions.slice(start, start + VERSION_PAGE_SIZE);
  }, [detailVersions, safeVersionPage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    if (!selectedFlow) {
      setSelectedBusinessType(null);
      return;
    }
    if (selectedBusinessType !== selectedFlow.businessType) {
      setSelectedBusinessType(selectedFlow.businessType);
    }
  }, [selectedBusinessType, selectedFlow]);

  useEffect(() => {
    let cancelled = false;
    setDetailVersions([]);
    setDetailAvailability(null);
    setSelectedVersionNumber(null);
    setVersionPage(1);
    setDetailErr(null);
    if (!selectedFlow?.server) {
      setDetailLoading(false);
      return () => { cancelled = true; };
    }
    setDetailLoading(true);
    Promise.allSettled([
      workflowApi.listVersions(selectedFlow.businessType),
      workflowApi.getStartAvailability(selectedFlow.businessType),
    ]).then(([versionsResult, availabilityResult]) => {
      if (cancelled) return;
      if (versionsResult.status === 'fulfilled') {
        const versions = Array.isArray(versionsResult.value) ? versionsResult.value : [];
        setDetailVersions(versions);
        setSelectedVersionNumber(versions[0]?.version ?? null);
        setVersionPage(1);
      }
      if (availabilityResult.status === 'fulfilled') setDetailAvailability(availabilityResult.value);
      if (versionsResult.status === 'rejected' || availabilityResult.status === 'rejected') {
        setDetailErr('部分流程详情暂不可用');
      }
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedFlow?.businessType, selectedFlow?.server]);

  useEffect(() => {
    if (versionPage !== safeVersionPage) setVersionPage(safeVersionPage);
  }, [safeVersionPage, versionPage]);

  useEffect(() => {
    let cancelled = false;
    setSelectedVersionDetail(null);
    setVersionDetailErr(null);
    if (!selectedFlow?.server || selectedVersionNumber == null) {
      setVersionDetailLoading(false);
      return () => { cancelled = true; };
    }
    setVersionDetailLoading(true);
    workflowApi.getVersion(selectedFlow.businessType, selectedVersionNumber)
      .then((version) => {
        if (!cancelled) setSelectedVersionDetail(version);
      })
      .catch(() => {
        if (!cancelled) setVersionDetailErr('版本完整快照暂不可用');
      })
      .finally(() => {
        if (!cancelled) setVersionDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedFlow?.businessType, selectedFlow?.server, selectedVersionNumber]);

  const resetFilters = () => {
    setActiveFilter('all');
    setQuery('');
    setPage(1);
  };

  const setFilter = (filter: WorkflowFilter) => {
    setActiveFilter(filter);
    setPage(1);
  };

  const setVersionHistoryPage = (nextPage: number) => {
    const normalized = Math.max(1, Math.min(nextPage, versionTotalPages));
    setVersionPage(normalized);
    const firstVersion = detailVersions[(normalized - 1) * VERSION_PAGE_SIZE];
    if (firstVersion) setSelectedVersionNumber(firstVersion.version);
  };

  const handlePublish = async (bt: string, name: string) => {
    try {
      setErr(null);
      const result = await workflowApi.publish(bt);
      setMsg(`${name}已发布，当前版本 v${result.version}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '发布失败');
    }
  };

  const handleRollback = async () => {
    if (!rollbackTarget || !selectedFlow) return;
    setRollingBack(true);
    try {
      setErr(null);
      const result = await workflowApi.rollback(selectedFlow.businessType, rollbackTarget.version, {
        reason: rollbackReason.trim() || `回滚到 v${rollbackTarget.version}`,
        impactScope: '影响后续新发起审批，已发起实例保持原版本快照',
        rollbackPlan: rollbackPlan.trim() || '如回滚后发现问题，可在版本历史中再次回滚到其他已发布快照',
      });
      setMsg(`${selectedFlow.name}已回滚，当前版本 v${result.version}`);
      setRollbackTarget(null);
      setRollbackReason('');
      setRollbackPlan('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '回滚失败');
    } finally {
      setRollingBack(false);
    }
  };

  const handleToggle = async (bt: string, name: string, isDisabled: boolean) => {
    try {
      setErr(null);
      await workflowApi.updateStatus(bt, isDisabled ? 'ENABLED' : 'DISABLED');
      setMsg(`${name}已${isDisabled ? '启用' : '停用'}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '更新状态失败');
    }
  };

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <section className="rounded-xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">业务流程管理</h1>
              <h3 className="mt-1 text-sm font-medium text-slate-500">集中维护审批流程、发布状态、版本快照和业务入口。</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/disposals')}>
                <FileText className="h-4 w-4" />
                返回资产处置
              </Button>
              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  disabled={!canEditWorkflow}
                  title={!canEditWorkflow ? '缺少 workflow:definition:edit 权限' : undefined}
                  onClick={() => setShowNewDropdown((v) => !v)}
                >
                  <Plus className="h-4 w-4" />
                  新建流程
                  <ChevronDown className={`h-3 w-3 transition-transform ${showNewDropdown ? 'rotate-180' : ''}`} />
                </Button>
                {canEditWorkflow && showNewDropdown && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--surface-border)] bg-white py-2 shadow-[var(--shadow-card-hover)]">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">从模板创建</div>
                    {businessFlowOptions.map((f) => (
                      <button
                        key={f.businessType}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-blue-50"
                        onClick={async () => {
                          setShowNewDropdown(false);
                          try {
                            await workflowApi.saveDraft(f.businessType, {
                              name: f.name,
                              description: f.description,
                              definition: { nodes: initialFlowNodes, edges: initialFlowEdges },
                            });
                            setMsg(`"${f.name}"草稿已创建，跳转设计器中...`);
                            navigate(`/workflow-designer?businessType=${f.businessType}`);
                          } catch (e) {
                            const errMsg = e instanceof Error ? e.message : String(e);
                            setErr(`"${f.name}"初始化失败${errMsg ? '：' + errMsg : '，请稍后手动发布'}`);
                          }
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <Dialog open={!!rollbackTarget} onOpenChange={(open) => {
          if (!open && !rollingBack) {
            setRollbackTarget(null);
            setRollbackReason('');
            setRollbackPlan('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>回滚流程版本</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                即将把「{selectedFlow?.name ?? '-'}」按 v{rollbackTarget?.version ?? '-'} 快照重新发布为新版本，已发起实例保持原版本快照。
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">回滚原因</label>
                <textarea
                  aria-label="回滚原因"
                  rows={2}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="flex w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="例如：恢复上一个稳定发布版本"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">回滚后预案</label>
                <textarea
                  aria-label="回滚后预案"
                  rows={2}
                  value={rollbackPlan}
                  onChange={(e) => setRollbackPlan(e.target.value)}
                  className="flex w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="例如：观察新发起实例，异常时回滚到其他快照"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                disabled={rollingBack}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => {
                  setRollbackTarget(null);
                  setRollbackReason('');
                  setRollbackPlan('');
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={rollingBack}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                onClick={handleRollback}
              >
                {rollingBack ? '回滚中...' : '确认回滚'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {msg && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <span className="truncate">{msg}</span>
            <button type="button" onClick={() => setMsg(null)} className="flex-shrink-0 text-green-500 hover:text-green-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {err && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="truncate">{err}</span>
            <button type="button" onClick={() => setErr(null)} className="flex-shrink-0 text-amber-500 hover:text-amber-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {!canEditWorkflow && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            当前账号只有流程查看权限，无法新建、发布或编辑流程。
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            const active = activeFilter === card.filterKey;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => setFilter(card.filterKey)}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{card.sub}</p>
                  </div>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="搜索流程名称、编码、说明或业务对象"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
                <ListFilter className="h-4 w-4 text-slate-400" />
                <select
                  value={activeFilter}
                  onChange={(e) => setFilter(e.target.value as WorkflowFilter)}
                  className="h-10 bg-transparent text-sm text-slate-700 outline-none"
                >
                  {FILTER_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
              </div>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>每页 {size}</option>)}
              </select>
            </div>
            <div className="text-sm text-slate-500">
              共 <span className="font-semibold text-slate-800">{filteredFlows.length}</span> 条结果
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-400 shadow-sm">
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 align-[-2px]" />
            正在加载流程定义...
          </div>
        ) : (
          <div className="space-y-5">
            {selectedFlow ? (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className={`h-1.5 w-full ${ACCENT_COLORS[selectedFlow.businessType] ?? 'bg-slate-400'}`} />
                <div className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <Workflow className="h-3.5 w-3.5" />
                          当前选中流程
                        </h3>
                        <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">{selectedFlow.businessType}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadge(selectedFlow.server?.status).bg} ${statusBadge(selectedFlow.server?.status).ring} ${statusBadge(selectedFlow.server?.status).text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusBadge(selectedFlow.server?.status).dot}`} />
                          {statusLabel(selectedFlow.server?.status)}
                        </span>
                      </div>
                      <h2 className="mt-3 break-words text-2xl font-semibold text-slate-950">{selectedFlow.name}</h2>
                      <p className="mt-2 max-w-5xl break-words text-sm leading-6 text-slate-600">{selectedFlow.description || '未填写流程描述'}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {!selectedFlow.server || selectedFlow.server.status === 'UNCONFIGURED' ? (
                        <button
                          type="button"
                          disabled={!canEditWorkflow}
                          onClick={() => handlePublish(selectedFlow.businessType, selectedFlow.name)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {canEditWorkflow ? '创建并发布默认流程' : '需要编辑权限'}
                        </button>
                      ) : (
                        <>
                          {canEditWorkflow && (
                            <button
                              type="button"
                              onClick={() => navigate(`/workflow-designer?businessType=${selectedFlow.businessType}`)}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                            >
                              <Layers3 className="h-4 w-4" />
                              打开设计器
                            </button>
                          )}
                          {detailAvailability?.canStart && detailAvailability.entryUrl && (
                            <button
                              type="button"
                              onClick={() => navigate(detailAvailability.entryUrl)}
                              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <ExternalLink className="h-4 w-4" />
                              打开发起入口
                            </button>
                          )}
                          {(selectedFlow.formPath || (selectedFlow.isCustom && selectedFlow.server?.definition && (selectedFlow.server.definition as Record<string, unknown>)?.formSource)) ? (
                            <button
                              type="button"
                              onClick={() => navigate(selectedFlow.formPath || `/workflow-form/${selectedFlow.businessType}`)}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-4 w-4" />
                              查看业务表单
                            </button>
                          ) : selectedFlow.isCustom && canEditWorkflow && (
                            <button
                              type="button"
                              onClick={() => navigate(`/workflow-designer?businessType=${selectedFlow.businessType}`)}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              配置表单源码
                            </button>
                          )}
                          {canEditWorkflow && selectedFlow.server?.status !== 'DISABLED' && (
                            <button
                              type="button"
                              onClick={() => handlePublish(selectedFlow.businessType, selectedFlow.name)}
                              className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                            >
                              {selectedFlow.server?.status === 'DRAFT' ? '发布流程' : '重新发布'}
                            </button>
                          )}
                          {canEditWorkflow && selectedFlow.server && selectedFlow.server.version > 0 && (
                            <button
                              type="button"
                              onClick={() => handleToggle(selectedFlow.businessType, selectedFlow.name, selectedFlow.server?.status === 'DISABLED')}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                              {selectedFlow.server?.status === 'DISABLED' ? '启用流程' : '停用流程'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">当前版本</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">v{selectedFlow.server?.version ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">发布快照</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{detailVersions.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">审批/办理</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{countApprovalNodes(selectedFlow.server?.definition as Record<string, unknown>) || selectedFlow.stepCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">总节点</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{countTotalNodes(selectedFlow.server?.definition as Record<string, unknown>) || selectedFlow.draft.nodeCount || '-'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">本地草稿</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{fmtDate(selectedFlow.draft.savedAt)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">可发起状态</p>
                      <p className={`mt-1 truncate text-sm font-semibold ${detailAvailability?.canStart ? 'text-green-700' : 'text-amber-700'}`}>
                        {detailLoading ? '读取中' : detailAvailability ? (detailAvailability.canStart ? '可发起' : detailAvailability.blockReason || '不可发起') : '未读取'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                    <div className="rounded-xl border border-slate-200">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">流程信息</h3>
                      </div>
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <dt className="text-xs text-slate-400">业务对象</dt>
                          <dd className="mt-1 break-words font-medium text-slate-700">{selectedFlow.businessName}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">更新时间</dt>
                          <dd className="mt-1 break-words text-slate-700">{fmtDate(selectedFlow.server?.updateTime ?? selectedFlow.draft.savedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">发布时间</dt>
                          <dd className="mt-1 break-words text-slate-700">{fmtDate(selectedFlow.server?.publishedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">创建时间</dt>
                          <dd className="mt-1 break-words text-slate-700">{fmtDate(selectedFlow.server?.createTime)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">更新人</dt>
                          <dd className="mt-1 break-words text-slate-700">{selectedFlow.server?.updatedBy ?? '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">发布人</dt>
                          <dd className="mt-1 break-words text-slate-700">{selectedFlow.server?.publishedBy ?? '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">发起入口</dt>
                          <dd className="mt-1 break-words font-medium text-slate-700">{detailAvailability?.entryUrl || selectedFlow.formPath || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">契约状态</dt>
                          <dd className="mt-1 break-words text-slate-700">
                            {detailAvailability ? `${statusLabel(detailAvailability.status)} · v${detailAvailability.version ?? 0}` : '未读取'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-400">阻断原因</dt>
                          <dd className="mt-1 break-words text-slate-700">
                            {detailAvailability?.blockReason || (detailAvailability?.canStart ? '无阻断，可发起' : '-')}
                          </dd>
                        </div>
                      </dl>
                      {(detailErr || !selectedFlow.server || selectedFlow.server.status === 'UNCONFIGURED') && (
                        <div className="border-t border-slate-100 p-4">
                          {detailErr && (
                            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              {detailErr}
                            </div>
                          )}
                          {(!selectedFlow.server || selectedFlow.server.status === 'UNCONFIGURED') && (
                            <div className="flex gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                              <span>该流程尚未形成可发布版本，业务入口会被阻断。</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200" aria-label="流程版本历史与回滚">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <History className="h-4 w-4 text-slate-500" />
                          版本历史与回滚
                        </h3>
                        {detailLoading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                      </div>
                      <div className="space-y-4 p-4">
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {pagedVersions.map((version) => {
                            const canRollbackVersion = canEditWorkflow && selectedFlow.server
                              && version.version < (selectedFlow.server.version ?? 0);
                            const activeVersion = selectedVersion?.version === version.version;
                            return (
                              <div
                                key={`${version.version}-${version.actionType}`}
                                className={`rounded-lg border text-sm ${activeVersion ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white'}`}
                              >
                                <button
                                  type="button"
                                  aria-label={`查看版本 v${version.version} ${versionActionLabel(version.actionType)}`}
                                  onClick={() => setSelectedVersionNumber(version.version)}
                                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-slate-700">v{version.version} · {versionActionLabel(version.actionType)}</p>
                                    <p className="text-xs text-slate-400">{fmtDate(version.publishedAt ?? version.createTime)}</p>
                                  </div>
                                  {version.rollbackSourceVersion != null && (
                                    <span className="flex-shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">源 v{version.rollbackSourceVersion}</span>
                                  )}
                                </button>
                                {canRollbackVersion && (
                                  <div className="border-t border-slate-100 px-3 py-2">
                                    <button
                                      type="button"
                                      aria-label={`回滚到版本 v${version.version}`}
                                      onClick={() => {
                                        setSelectedVersionNumber(version.version);
                                        setRollbackTarget(version);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      回滚到此版本
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {!detailLoading && detailVersions.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                              暂无发布快照
                            </div>
                          )}
                        </div>

                        {detailVersions.length > VERSION_PAGE_SIZE && (
                          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            <span>版本第 {safeVersionPage} / {versionTotalPages} 页 · 共 {detailVersions.length} 个快照</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={safeVersionPage <= 1}
                                onClick={() => setVersionHistoryPage(safeVersionPage - 1)}
                                className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                上一页
                              </button>
                              <button
                                type="button"
                                disabled={safeVersionPage >= versionTotalPages}
                                onClick={() => setVersionHistoryPage(safeVersionPage + 1)}
                                className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                下一页
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedVersion && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-slate-900">v{selectedVersion.version} · {versionActionLabel(selectedVersion.actionType)}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{fmtDate(selectedVersion.publishedAt ?? selectedVersion.createTime)}</p>
                              </div>
                              {selectedFlow.server && selectedVersion.version === selectedFlow.server.version ? (
                                <span className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700">当前发布头</span>
                              ) : canEditWorkflow && selectedFlow.server && selectedVersion.version < (selectedFlow.server.version ?? 0) ? (
                                <button
                                  type="button"
                                  aria-label={`回滚到版本 v${selectedVersion.version}`}
                                  onClick={() => setRollbackTarget(selectedVersion)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  回滚
                                </button>
                              ) : null}
                            </div>
                            {(versionDetailLoading || versionDetailErr || selectedVersion.definition) && (
                              <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                {versionDetailLoading ? (
                                  <span>正在读取完整版本快照...</span>
                                ) : versionDetailErr ? (
                                  <span className="text-amber-700">{versionDetailErr}</span>
                                ) : (
                                  <span>完整快照已回读，可核对节点模型。</span>
                                )}
                              </div>
                            )}
                            <dl className="mt-3 space-y-2 text-xs">
                              <div>
                                <dt className="text-slate-400">发布说明</dt>
                                <dd className="mt-0.5 break-words text-slate-700">{selectedVersion.publishNote || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-400">影响范围</dt>
                                <dd className="mt-0.5 break-words text-slate-700">{selectedVersion.impactScope || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-slate-400">回滚预案</dt>
                                <dd className="mt-0.5 break-words text-slate-700">{selectedVersion.rollbackPlan || '-'}</dd>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <dt className="text-slate-400">操作人</dt>
                                  <dd className="mt-0.5 text-slate-700">{selectedVersion.operatorId ?? '-'}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-400">状态</dt>
                                  <dd className="mt-0.5 text-slate-700">{statusLabel(selectedVersion.status)}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-400">快照总节点</dt>
                                  <dd className="mt-0.5 text-slate-700">{countTotalNodes(selectedVersion.definition as Record<string, unknown>) || '-'}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-400">审批/办理节点</dt>
                                  <dd className="mt-0.5 text-slate-700">{countApprovalNodes(selectedVersion.definition as Record<string, unknown>) || '-'}</dd>
                                </div>
                              </div>
                            </dl>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <Card className="rounded-xl border-slate-200 p-8 text-center text-sm text-slate-400">
                请选择一个流程查看详情
              </Card>
            )}

            <section className="space-y-3">
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">流程定义</h2>
                  <p className="mt-1 text-xs text-slate-500">显示第 {resultStart}-{resultEnd} 条 / 共 {filteredFlows.length} 条</p>
                </div>
                <div className="text-xs text-slate-500">第 {safePage} / {totalPages} 页</div>
              </div>

              {pagedFlows.length === 0 ? (
                <Card className="rounded-xl border-slate-200 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-800">没有匹配的流程</p>
                  <p className="mt-1 text-sm text-slate-500">调整关键词或状态筛选后重试。</p>
                  <button type="button" onClick={resetFilters} className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                    清除筛选
                  </button>
                </Card>
              ) : pagedFlows.map((flow) => {
                const status = flow.server?.status;
                const version = flow.server?.version ?? 0;
                const isUnconfigured = !flow.server || status === 'UNCONFIGURED';
                const isDraft = status === 'DRAFT';
                const isDisabled = status === 'DISABLED';
                const badge = statusBadge(status);
                const selected = selectedFlow?.businessType === flow.businessType;
                return (
                  <Card
                    key={flow.businessType}
                    className={`relative overflow-hidden rounded-xl border p-0 shadow-sm transition ${selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200 hover:shadow-md'} ${isDisabled ? 'opacity-70' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedBusinessType(flow.businessType)}
                      className="block w-full text-left"
                    >
                      <div className={`h-1.5 w-full ${isDisabled ? 'bg-gray-300' : ACCENT_COLORS[flow.businessType] ?? 'bg-slate-400'}`} />
                      <div className="p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words text-base font-semibold text-slate-900">{flow.name}</h3>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{flow.businessType}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{flow.description}</p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.bg} ${badge.ring} ${badge.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                              {statusLabel(status)}
                            </span>
                            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs text-slate-400">v{version}</span>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-4">
                          <span className="rounded-lg bg-slate-50 px-2 py-1">业务：{flow.businessName}</span>
                          <span className="rounded-lg bg-slate-50 px-2 py-1">审批/办理：{countApprovalNodes(flow.server?.definition as Record<string, unknown>) || flow.stepCount}</span>
                          <span className="rounded-lg bg-slate-50 px-2 py-1">总节点：{countTotalNodes(flow.server?.definition as Record<string, unknown>) || flow.draft.nodeCount || '-'}</span>
                          <span className="rounded-lg bg-slate-50 px-2 py-1">更新：{fmtDate(flow.server?.updateTime ?? flow.draft.savedAt)}</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
                      {isUnconfigured ? (
                        <button
                          type="button"
                          disabled={!canEditWorkflow}
                          onClick={() => handlePublish(flow.businessType, flow.name)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {canEditWorkflow ? '创建并发布默认流程' : '需要编辑权限'}
                        </button>
                      ) : (
                        <>
                          {canEditWorkflow && (
                            <button
                              type="button"
                              onClick={() => navigate(`/workflow-designer?businessType=${flow.businessType}`)}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                            >
                              打开设计器
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                          {(flow.formPath || (flow.isCustom && flow.server?.definition && (flow.server.definition as Record<string, unknown>)?.formSource)) ? (
                            <button
                              type="button"
                              onClick={() => navigate(flow.formPath || `/workflow-form/${flow.businessType}`)}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              查看业务表单
                            </button>
                          ) : flow.isCustom && canEditWorkflow && (
                            <button
                              type="button"
                              onClick={() => navigate(`/workflow-designer?businessType=${flow.businessType}`)}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              配置表单源码
                            </button>
                          )}
                          {canEditWorkflow && !isDisabled && (
                            <button
                              type="button"
                              onClick={() => handlePublish(flow.businessType, flow.name)}
                              className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                            >
                              {isDraft ? '发布流程' : '重新发布'}
                            </button>
                          )}
                          {canEditWorkflow && flow.server && flow.server.version > 0 && (
                            <button
                              type="button"
                              onClick={() => handleToggle(flow.businessType, flow.name, isDisabled)}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                              {isDisabled ? '启用流程' : '停用流程'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}

              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <span>第 {resultStart}-{resultEnd} 条 / 共 {filteredFlows.length} 条，当前页 {safePage} / {totalPages}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage(1)}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    首页
                  </button>
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </button>
                  {pageNumbers[0] > 1 && (
                    <>
                      <button type="button" onClick={() => setPage(1)} className="h-8 min-w-8 rounded-lg border border-slate-200 px-2 text-sm hover:bg-slate-50">1</button>
                      {pageNumbers[0] > 2 && <span className="px-1 text-slate-400">...</span>}
                    </>
                  )}
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`h-8 min-w-8 rounded-lg border px-2 text-sm ${pageNumber === safePage ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}
                      <button type="button" onClick={() => setPage(totalPages)} className="h-8 min-w-8 rounded-lg border border-slate-200 px-2 text-sm hover:bg-slate-50">{totalPages}</button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(totalPages)}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    末页
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
