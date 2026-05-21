import { ArrowRight, Workflow, FileText, CheckCircle, Clock, XCircle, GitBranch, Plus, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { workflowApi, type WorkflowDefinitionDTO } from '@/api/workflow';
import { businessFlowOptions, getDraftStorageKey, type BusinessType } from '@/constants/workflowBusiness';

function readDraft(bt: BusinessType) {
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

function statusLabel(s?: string) {
  const map: Record<string, string> = {
    UNCONFIGURED: '未配置', DRAFT: '草稿中', PUBLISHED: '已发布',
    DISABLED: '已停用', ENABLED: '已启用',
  };
  return map[s ?? ''] ?? s ?? '未知';
}

function statusBadge(s?: string) {
  const map: Record<string, string> = {
    UNCONFIGURED: 'bg-gray-100 text-gray-600 border-gray-200',
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    PUBLISHED: 'bg-green-50 text-green-700 border-green-200',
    DISABLED: 'bg-gray-100 text-gray-500 border-gray-200',
    ENABLED: 'bg-green-50 text-green-700 border-green-200',
  };
  return map[s ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

// accent color top bar for each business type
const ACCENT_COLORS: Record<string, string> = {
  ASSET_TRANSFER: 'bg-blue-500',
  ASSET_CLEARANCE: 'bg-emerald-500',
  ASSET_SCRAP: 'bg-amber-500',
  ASSET_COMPENSATION: 'bg-red-500',
};

export default function WorkflowCenterPage() {
  const navigate = useNavigate();
  const [defs, setDefs] = useState<WorkflowDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  const flows = useMemo(() =>
    businessFlowOptions.map((f) => ({
      ...f,
      draft: readDraft(f.businessType),
      server: defs.find((d) => d.businessType === f.businessType),
    })),
    [defs],
  );

  const kpiCards = [
    { label: '流程总数', value: flows.length, sub: '业务流程', icon: GitBranch, iconClass: 'text-blue-500 bg-blue-50' },
    { label: '已发布', value: flows.filter(f => f.server?.status === 'PUBLISHED' || f.server?.status === 'ENABLED').length, sub: '线上运行中', icon: CheckCircle, iconClass: 'text-green-600 bg-green-50' },
    { label: '草稿中', value: flows.filter(f => f.server?.status === 'DRAFT' || (!f.server && f.draft.savedAt)).length, sub: '待发布', icon: Clock, iconClass: 'text-amber-600 bg-amber-50' },
    { label: '已停用', value: flows.filter(f => f.server?.status === 'DISABLED').length, sub: '暂停使用', icon: XCircle, iconClass: 'text-gray-500 bg-gray-100' },
  ];

  const handlePublish = async (bt: string, name: string) => {
    try {
      setErr(null);
      const r = await workflowApi.publish(bt);
      setMsg(`${name}已发布，当前版本 v${r.version}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '发布失败');
    }
  };

  const handleToggle = async (bt: string, name: string, isDisabled: boolean) => {
    try {
      setErr(null);
      const r = await workflowApi.updateStatus(bt, isDisabled ? 'ENABLED' : 'DISABLED');
      setMsg(`${name}状态已更新为 ${statusLabel(r.status)}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '更新状态失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">流程管理 / 工作流中心</p>
          <h1 className="text-2xl font-semibold text-gray-900">业务流程管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/disposals')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            返回资产处置
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            新建流程
          </button>
        </div>
      </div>

      {/* Toast messages */}
      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          正在加载流程定义...
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {err}；页面仍展示本地草稿状态。
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-gray-200 rounded-[10px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between h-28">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-gray-500">{card.label}</span>
                <div className={`p-1.5 rounded-lg ${card.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-gray-900 leading-none">{card.value}</span>
                <span className="text-xs text-gray-400">{card.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workflow Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {flows.map((flow) => {
          const status = flow.server?.status;
          const version = flow.server?.version;
          const isUnconfigured = !flow.server || status === 'UNCONFIGURED';
          const isDraft = status === 'DRAFT';
          const isDisabled = status === 'DISABLED';
          const accentColor = ACCENT_COLORS[flow.businessType] ?? 'bg-gray-400';

          return (
            <section
              key={flow.businessType}
              className="relative overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col"
            >
              {/* Colored top accent bar */}
              <div className={`h-1 w-full ${accentColor}`} />

              <div className="flex flex-col flex-1 p-6 space-y-4">
                {/* Header: type badge + name + status */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded">
                      {flow.businessType}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900">{flow.name}</h3>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">{flow.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {flow.server ? (
                      <>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusBadge(status)}`}>
                          {statusLabel(status)}
                        </span>
                        <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                          v{version}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200">
                        未配置
                      </span>
                    )}
                  </div>
                </div>

                {/* Info chips */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Workflow className="h-3.5 w-3.5" />
                    关联业务：{flow.businessName}
                  </span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {flow.stepCount} 步骤
                  </span>
                  {!flow.server && (
                    <span className="text-gray-400">{fmtDate(flow.draft.savedAt)}</span>
                  )}
                </div>

                {/* Unconfigured warning */}
                {isUnconfigured && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    该核心业务缺失对应的审批工作流定义，可能导致业务阻塞。
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 mt-auto">
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
                      <button
                        type="button"
                        onClick={() => navigate(flow.formPath)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        查看业务表单
                      </button>
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
                    </>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Info bar */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        流程定义已接入后端 API，草稿保存到服务端，本地 localStorage 作为兜底副本。
      </div>
    </div>
  );
}
