import { ArrowRight, FileText, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { businessFlowOptions, getDraftStorageKey } from "../constants/workflowBusiness";
import { workflowDefinitionService, type WorkflowDefinitionDTO } from "../services/workflowDefinitionService";

function readDraftStatus(businessType: (typeof businessFlowOptions)[number]["businessType"]) {
  if (typeof window === "undefined") {
    return { savedAt: null, nodeCount: null };
  }

  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(businessType));
    if (!raw) return { savedAt: null, nodeCount: null };

    const parsed = JSON.parse(raw) as { savedAt?: string; nodes?: unknown[] };
    return {
      savedAt: parsed.savedAt ?? null,
      nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : null,
    };
  } catch {
    return { savedAt: null, nodeCount: null };
  }
}

function formatSavedAt(value: string | null) {
  if (!value) return "未保存本地草稿";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "已保存本地草稿";

  return `最近保存：${date.toLocaleString("zh-CN", { hour12: false })}`;
}

export function WorkflowCenter() {
  const navigate = useNavigate();
  const [serverDefinitions, setServerDefinitions] = useState<WorkflowDefinitionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDefinitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const definitions = await workflowDefinitionService.list();
      setServerDefinitions(Array.isArray(definitions) ? definitions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载后端流程定义失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefinitions();
  }, []);

  const flows = useMemo(
    () =>
      businessFlowOptions.map((flow) => ({
        ...flow,
        draft: readDraftStatus(flow.businessType),
        server: serverDefinitions.find((item) => item.businessType === flow.businessType),
      })),
    [serverDefinitions],
  );

  const handlePublish = async (businessType: string, name: string) => {
    try {
      setError(null);
      const result = await workflowDefinitionService.publish(businessType);
      setMessage(`${name}已发布，当前版本 v${result.version}`);
      await loadDefinitions();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "发布流程失败");
    }
  };

  const handleToggleStatus = async (businessType: string, name: string, disabled: boolean) => {
    try {
      setError(null);
      const result = await workflowDefinitionService.updateStatus(businessType, disabled ? "ENABLED" : "DISABLED");
      setMessage(`${name}状态已更新为 ${result.status}`);
      await loadDefinitions();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "更新流程状态失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            <Workflow className="h-4 w-4" />
            流程管理中心
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">业务流程列表</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            资产处置当前包含 4 条业务流程。先在这里找到对应业务流程，再进入可视化流程设计器修改节点、审批角色和分支条件。
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/disposals")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FileText className="h-4 w-4" />
          返回资产处置
        </button>
      </div>

      {loading ? <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">正在加载后端流程定义...</div> : null}
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}；页面仍展示本地草稿状态。</div> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {flows.map((flow) => (
          <section key={flow.businessType} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className={`h-2 bg-gradient-to-r ${flow.accentClass}`} />
            <div className="space-y-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{flow.businessType}</div>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">{flow.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{flow.description}</p>
                </div>
                <div className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">{flow.stepCount} 步</div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">关联业务</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{flow.businessName}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 sm:col-span-2">
                  <div className="text-xs text-gray-500">流程状态</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {flow.server ? `${flow.server.status} · v${flow.server.version}` : formatSavedAt(flow.draft.savedAt)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/workflow-designer?businessType=${flow.businessType}`)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  打开设计器
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(flow.formPath)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  查看业务表单
                </button>
                <button
                  type="button"
                  disabled={!flow.server || flow.server.status === "UNCONFIGURED"}
                  onClick={() => handlePublish(flow.businessType, flow.name)}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  发布流程
                </button>
                <button
                  type="button"
                  disabled={!flow.server || flow.server.status === "UNCONFIGURED" || flow.server.version === 0}
                  onClick={() => handleToggleStatus(flow.businessType, flow.name, flow.server?.status === "DISABLED")}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {flow.server?.status === "DISABLED" ? "启用流程" : "停用流程"}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
        当前流程定义已接入后端草稿、发布和启停 API；浏览器 localStorage 仅作为后端不可用时的兜底副本。
      </div>
    </div>
  );
}
