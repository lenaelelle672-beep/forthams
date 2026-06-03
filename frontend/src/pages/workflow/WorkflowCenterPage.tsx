import { ArrowRight, Workflow, FileText, CheckCircle, Clock, XCircle, GitBranch, Plus, AlertTriangle, ChevronDown, X, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { workflowApi, type WorkflowDefinitionDTO } from '@/api/workflow';
import { businessFlowOptions, getDraftStorageKey, isBusinessType, isCustomBusinessType } from '@/constants/workflowBusiness';
import { initialFlowNodes, initialFlowEdges } from '@/types/flow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';

function readDraft(bt: string) {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(bt));
    if (!raw) return { savedAt: null, nodeCount: null };
    const p = JSON.parse(raw);
    return { savedAt: p.savedAt ?? null, nodeCount: Array.isArray(p.nodes) ? p.nodes.length : null };
  } catch { return { savedAt: null, nodeCount: null }; }
}

function fmtDate(v: string | null) {
  if (!v) return '未保存本地草稿';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '已保存本地草稿' : `最近保存：${d.toLocaleString('zh-CN', { hour12: false })}`;
}

/** 从流程定义 nodes 中统计审批节点数 */
function countApprovalNodes(definition: Record<string, unknown> | undefined): number {
  if (!definition?.nodes || !Array.isArray(definition.nodes)) return 0;
  return definition.nodes.filter((n: any) => n.type === 'approval').length;
}

/** 从流程定义 nodes 中统计总节点数 */
function countTotalNodes(definition: Record<string, unknown> | undefined): number {
  if (!definition?.nodes || !Array.isArray(definition.nodes)) return 0;
  return definition.nodes.length;
}

function statusLabel(s?: string) {
  const map: Record<string, string> = {
    UNCONFIGURED: '未配置', DRAFT: '草稿中', PUBLISHED: '已发布',
    DISABLED: '已停用', ENABLED: '已启用',
  };
  return map[s ?? ''] ?? s ?? '未知';
}

// ── Benchmark status badge: colored dot + ring-inset ──────────────────────────
function statusBadge(s?: string) {
  const map: Record<string, { dot: string; ring: string; text: string }> = {
    UNCONFIGURED: { dot: 'bg-gray-400',  ring: 'ring-gray-300',   text: 'text-gray-700' },
    DRAFT:        { dot: 'bg-amber-400', ring: 'ring-amber-300',  text: 'text-amber-700' },
    PUBLISHED:    { dot: 'bg-green-400', ring: 'ring-green-300',  text: 'text-green-700' },
    DISABLED:     { dot: 'bg-gray-400',  ring: 'ring-gray-300',   text: 'text-gray-500' },
    ENABLED:      { dot: 'bg-emerald-400', ring: 'ring-emerald-300', text: 'text-emerald-700' },
  };
  return map[s ?? ''] ?? map.UNCONFIGURED;
}

// accent color top bar for each business type
const ACCENT_COLORS: Record<string, string> = {
  ASSET_TRANSFER: 'bg-blue-500',
  ASSET_CLEARANCE: 'bg-emerald-500',
  ASSET_SCRAP: 'bg-amber-500',
  ASSET_COMPENSATION: 'bg-red-500',
  RETIREMENT: 'bg-purple-500',
};

// ── Quick filter pill base classes ────────────────────────────────────────────
const FILTER_PILL_BASE = 'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors';
const FILTER_PILL_ACTIVE = 'border-blue-600 bg-blue-600 text-white shadow-sm';
const FILTER_PILL_INACTIVE = 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

export default function WorkflowCenterPage() {
  const navigate = useNavigate();
  const [defs, setDefs] = useState<WorkflowDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'PUBLISHED' | 'DRAFT' | 'DISABLED'>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ businessType: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true); setErr(null);
      const list = await workflowApi.list();
      setDefs(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNewDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const flows = useMemo(() => {
    const predefined = businessFlowOptions.map((f) => ({
      ...f,
      draft: readDraft(f.businessType),
      server: defs.find((d) => d.businessType === f.businessType),
      isCustom: false as const,
    }));
    // 自定义流程（不在预定义模板中的数据库记录）
    const customDefs = defs.filter((d) => d.businessType && !isBusinessType(d.businessType) && isCustomBusinessType(d.businessType));
    const custom = customDefs.map((d) => ({
      businessType: d.businessType,
      name: d.name || d.businessType,
      description: d.description || '自定义流程',
      businessName: '自定义',
      formPath: '',
      stepCount: countApprovalNodes(d.definition) || 4,
      accentClass: 'from-gray-500 to-slate-500',
      draft: { savedAt: null, nodeCount: null },
      server: d,
      isCustom: true as const,
    }));
    return [...predefined, ...custom];
  }, [defs]);

  const kpiCards: { label: string; value: number; sub: string; icon: typeof GitBranch; iconClass: string; filterKey: 'all' | 'PUBLISHED' | 'DRAFT' | 'DISABLED' | null }[] = [
    { label: '流程总数', value: flows.length, sub: '业务流程', icon: GitBranch, iconClass: 'text-blue-500 bg-blue-50', filterKey: null },
    { label: '已发布', value: flows.filter(f => f.server?.status === 'PUBLISHED' || f.server?.status === 'ENABLED').length, sub: '线上运行中', icon: CheckCircle, iconClass: 'text-green-600 bg-green-50', filterKey: 'PUBLISHED' },
    { label: '草稿中', value: flows.filter(f => f.server?.status === 'DRAFT' || (!f.server && f.draft.savedAt)).length, sub: '待发布', icon: Clock, iconClass: 'text-amber-600 bg-amber-50', filterKey: 'DRAFT' },
    { label: '已停用', value: flows.filter(f => f.server?.status === 'DISABLED').length, sub: '暂停使用', icon: XCircle, iconClass: 'text-gray-500 bg-gray-100', filterKey: 'DISABLED' },
  ];

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      setErr(null);
      await workflowApi.delete(deleteTarget.businessType);
      setMsg(`「${deleteTarget.name}」已删除`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '删除失败');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Benchmark stat bar items (inline in header) ────────────────────────────
  const statBarItems = [
    { label: '全部', count: flows.length, filterKey: 'all' as const, color: 'bg-slate-400' },
    { label: '已发布', count: kpiCards[1].value, filterKey: 'PUBLISHED' as const, color: 'bg-green-400' },
    { label: '草稿', count: kpiCards[2].value, filterKey: 'DRAFT' as const, color: 'bg-amber-400' },
    { label: '停用', count: kpiCards[3].value, filterKey: 'DISABLED' as const, color: 'bg-gray-400' },
  ];

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

        {/* ── Compact header with stat bar ───────────────────────────────────── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            {/* Left: title + subtitle */}
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">业务流程管理</h1>
              <p className="mt-1 text-sm text-slate-500">
                集中维护审批流程、发布状态和本地草稿，保持处置业务链路可控。
              </p>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/disposals')}
              >
                <FileText className="h-4 w-4" />
                返回资产处置
              </Button>
              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  onClick={() => setShowNewDropdown((v) => !v)}
                >
                  <Plus className="h-4 w-4" />
                  新建流程
                  <ChevronDown className={`h-3 w-3 transition-transform ${showNewDropdown ? 'rotate-180' : ''}`} />
                </Button>
                {showNewDropdown && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--surface-border)] bg-white py-2 shadow-[var(--shadow-card-hover)]">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">从模板创建</div>
                    {businessFlowOptions.map((f) => (
                      <button
                        key={f.businessType}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-blue-50"
                        onClick={async () => { setShowNewDropdown(false);
                        try {
                          await workflowApi.saveDraft(f.businessType, { name: f.name, description: f.description, definition: { nodes: initialFlowNodes, edges: initialFlowEdges } });
                          setMsg(`"${f.name}"草稿已创建，跳转设计器中…`);
                          navigate(`/workflow-designer?businessType=${f.businessType}`);
                        } catch (e) {
                          const errMsg = e instanceof Error ? e.message : String(e);
                          console.warn(`[WorkflowCenterPage] 从模板创建"${f.name}"失败:`, e);
                          setErr(`"${f.name}"初始化失败${errMsg ? '：' + errMsg : '，请稍后手动发布'}`);
                        } }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {f.name}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      onClick={async () => { setShowNewDropdown(false); setShowCustomDialog(true); }}
                    >
                      <Plus className="h-4 w-4" />
                      自定义流程
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stat bar divider */}
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="flex flex-wrap items-center gap-6">
              {statBarItems.map((item) => {
                const isActive = activeFilter === item.filterKey;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveFilter(isActive && item.filterKey !== 'all' ? 'all' : item.filterKey)}
                    className={`flex items-center gap-2 transition-colors ${isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${item.color}`} />
                    <span className="text-sm font-semibold text-slate-700">{item.count}</span>
                    <span className="text-xs text-slate-400">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Custom workflow creation dialog (benchmark Dialog) ─────────────── */}
        <Dialog open={showCustomDialog} onOpenChange={(open) => { if (!open) { setShowCustomDialog(false); setCustomName(''); setCustomCode(''); setCustomDesc(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建自定义流程</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">流程编码 *</label>
                <input
                  className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="至少2个字符，如 MY_APPROVAL"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                />
                <p className="text-[11px] text-gray-400">创建后不可修改，将作为流程的唯一标识</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">流程名称</label>
                <input
                  className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="可输入中文，如我的审批流程"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">流程描述</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
                  placeholder="请描述流程用途（可选）"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowCustomDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={creating || customCode.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (!customCode.trim()) return;
                  setCreating(true);
                  try {
                    setErr(null);
                    const bt = `CUSTOM_${customCode.trim().toUpperCase()}`;
                    const result = await workflowApi.createCustomWorkflow(bt, customName.trim() || customCode.trim(), customDesc.trim());
                    setMsg(`自定义流程「${result.name}」创建成功`);
                    setShowCustomDialog(false);
                    setCustomName('');
                    setCustomCode('');
                    setCustomDesc('');
                    await load();
                    navigate(`/workflow-designer?businessType=${result.businessType}`);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : '创建失败');
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? '创建中...' : '确认创建'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete confirmation dialog (benchmark Dialog) ──────────────────── */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">此操作不可撤销</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                即将删除流程「<span className="font-medium text-gray-900">{deleteTarget?.name}</span>」，删除后无法恢复。
              </p>
            </div>
            <DialogFooter>
              <button
                type="button"
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setDeleteTarget(null)}
              >取消</button>
              <button
                type="button"
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 shadow-sm disabled:opacity-50"
                onClick={handleDelete}
              >{deleting ? '删除中...' : '确认删除'}</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Toast / Loading messages ───────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-sm">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
              正在加载流程定义...
            </div>
            {/* Skeleton cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="h-28 p-5 animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                    <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                  </div>
                  <div className="mt-4 h-7 w-12 bg-gray-200 rounded" />
                </Card>
              ))}
            </div>
          </div>
        )}
        {msg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <span className="truncate">{msg}</span>
            <button type="button" onClick={() => setMsg(null)} className="text-green-500 hover:text-green-700 flex-shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}
        {err && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <span className="truncate">{err}；页面仍展示本地草稿状态。</span>
            <button type="button" onClick={() => setErr(null)} className="text-amber-500 hover:text-amber-700 flex-shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── Quick filter pills ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`${FILTER_PILL_BASE} ${activeFilter === 'all' ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'PUBLISHED' ? 'all' : 'PUBLISHED')}
            className={`${FILTER_PILL_BASE} ${activeFilter === 'PUBLISHED' ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-400 align-middle" />
            已发布
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'DRAFT' ? 'all' : 'DRAFT')}
            className={`${FILTER_PILL_BASE} ${activeFilter === 'DRAFT' ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
            草稿中
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter(activeFilter === 'DISABLED' ? 'all' : 'DISABLED')}
            className={`${FILTER_PILL_BASE} ${activeFilter === 'DISABLED' ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}`}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-400 align-middle" />
            已停用
          </button>
        </div>

        {/* ── Active filter indicator ────────────────────────────────────────── */}
        {activeFilter !== 'all' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {activeFilter === 'PUBLISHED' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {activeFilter === 'DRAFT' && <Clock className="h-4 w-4 text-amber-500" />}
            {activeFilter === 'DISABLED' && <XCircle className="h-4 w-4 text-gray-400" />}
            <span>仅显示{activeFilter === 'PUBLISHED' ? '已发布' : activeFilter === 'DRAFT' ? '草稿中' : '已停用'}流程</span>
            <button type="button" onClick={() => setActiveFilter('all')} className="text-blue-600 hover:underline ml-1">查看全部</button>
          </div>
        )}

        {/* ── Workflow Cards Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {flows.filter(flow => {
            if (activeFilter === 'all') return true;
            if (activeFilter === 'PUBLISHED') return flow.server?.status === 'PUBLISHED' || flow.server?.status === 'ENABLED';
            return flow.server?.status === activeFilter;
          }).map((flow) => {
            const status = flow.server?.status;
            const version = flow.server?.version;
            const isUnconfigured = !flow.server || status === 'UNCONFIGURED';
            const isDraft = status === 'DRAFT';
            const isDisabled = status === 'DISABLED';
            const accentColor = ACCENT_COLORS[flow.businessType] ?? 'bg-gray-400';
            const badge = statusBadge(status);

            return (
              <Card
                key={flow.businessType}
                className={`overflow-hidden rounded-2xl border-slate-200/80 shadow-sm transition duration-200
                  ${isDisabled ? 'opacity-65' : 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]'}`}
              >
                {/* Colored top accent bar */}
                <div className={`h-1.5 w-full ${isDisabled ? 'bg-gray-300' : accentColor}`} />
                {flow.server?.status === 'ENABLED' && (
                  <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                )}

                <div className="flex flex-1 flex-col space-y-4 bg-gradient-to-b from-white to-[#fbfdff] p-6">
                  {/* Header: type badge + name + status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded">
                        {flow.businessType}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold text-gray-900 line-clamp-1">{flow.name}</h3>
                      <p className="mt-1 text-sm text-gray-500 leading-relaxed line-clamp-2">{flow.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {flow.server ? (
                        <>
                          {/* Benchmark status badge */}
                          <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.ring} ${badge.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                            {statusLabel(status)}
                          </span>
                          <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                            v{version}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-gray-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          未配置
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info chips */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Workflow className="h-3.5 w-3.5" />
                      {flow.businessName}
                    </span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {flow.stepCount} 审批节点
                    </span>
                    {flow.server?.definition && (
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {countTotalNodes(flow.server.definition as Record<string, unknown>)} 总节点
                      </span>
                    )}
                    {flow.server?.updateTime && (
                      <span className="text-gray-400 hidden sm:inline">
                        更新：{fmtDate(flow.server.updateTime)}
                      </span>
                    )}
                    {!flow.server && (
                      <span className="text-gray-400">{fmtDate(flow.draft.savedAt)}</span>
                    )}
                  </div>

                  {/* Unconfigured warning */}
                  {isUnconfigured && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 shadow-sm">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      该核心业务缺失对应的审批工作流定义，可能导致业务阻塞。
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {isUnconfigured ? (
                      <button
                        type="button"
                        onClick={() => handlePublish(flow.businessType, flow.name)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
                      >
                        创建并发布默认流程
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/workflow-designer?businessType=${flow.businessType}`)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
                        >
                          打开设计器
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        {(flow.formPath || (flow.isCustom && flow.server?.definition && (flow.server.definition as Record<string, unknown>)?.formSource)) ? (
                          <button
                            type="button"
                            onClick={() => navigate(flow.formPath || `/workflow-form/${flow.businessType}`)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            查看业务表单
                          </button>
                        ) : flow.isCustom && (
                          <button
                            type="button"
                            onClick={() => navigate(`/workflow-designer?businessType=${flow.businessType}`)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            配置表单源码
                          </button>
                        )}
                        {!isDisabled && (
                          <button
                            type="button"
                            onClick={() => handlePublish(flow.businessType, flow.name)}
                            className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
                          >
                            {isDraft ? '发布流程' : '重新发布'}
                          </button>
                        )}
                        {flow.server && flow.server.version > 0 && (
                          <button
                            type="button"
                            onClick={() => handleToggle(flow.businessType, flow.name, isDisabled)}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                          >
                            {isDisabled ? '启用流程' : '停用流程'}
                          </button>
                        )}
                        {(isDisabled || isDraft) && flow.isCustom && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ businessType: flow.businessType, name: flow.name })}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}
