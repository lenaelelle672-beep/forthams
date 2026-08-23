import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getWorkflowDefinition,
  listWorkflowDefinitions,
  type WorkflowDefinitionRecord,
  type WorkflowDefinitionShape,
} from '../../api/workflowDefinitions';

type SystemFlowDefinitionWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type FlowStatusFilter = 'all' | 'configured' | 'unconfigured' | 'disabled';

const FLOW_UNCONFIGURED_STATUS = 'UNCONFIGURED';
const FLOW_DISABLED_STATUS = 'DISABLED';
const FLOW_PUBLISHED_STATUS = 'PUBLISHED';

function statusValue(status: string | null | undefined) {
  return String(status ?? '').trim().toUpperCase();
}

/** 已发布流程可发起；未配置/草稿/停用一律阻断。与后端 /workflow-runtime/{bt}/start-availability 的判定一致。 */
function canStart(status: string | null | undefined) {
  return statusValue(status) === FLOW_PUBLISHED_STATUS;
}

function statusLabel(status: string | null | undefined) {
  const value = statusValue(status);
  if (value === FLOW_UNCONFIGURED_STATUS || value === '') {
    return '未配置';
  }
  if (value === FLOW_DISABLED_STATUS) {
    return '已停用';
  }
  return '已配置';
}

function matchesStatus(definition: WorkflowDefinitionRecord, filter: FlowStatusFilter) {
  const value = statusValue(definition.status);
  if (filter === 'unconfigured') {
    return value === FLOW_UNCONFIGURED_STATUS || value === '';
  }
  if (filter === 'disabled') {
    return value === FLOW_DISABLED_STATUS;
  }
  if (filter === 'configured') {
    return value !== '' && value !== FLOW_UNCONFIGURED_STATUS && value !== FLOW_DISABLED_STATUS;
  }
  return true;
}

function matchesKeyword(definition: WorkflowDefinitionRecord, keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalizedKeyword = keyword.toLowerCase();
  return [definition.businessType, definition.name, definition.description ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

function countItems(items: unknown) {
  return Array.isArray(items) ? items.length : 0;
}

function nodeCount(definition: WorkflowDefinitionShape | null | undefined) {
  return countItems(definition?.nodes);
}

function edgeCount(definition: WorkflowDefinitionShape | null | undefined) {
  return countItems(definition?.edges);
}

export default function SystemFlowDefinitionWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemFlowDefinitionWorkbenchPageProps) {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionRecord[]>([]);
  const [selectedDefinition, setSelectedDefinition] = useState<WorkflowDefinitionRecord | null>(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<FlowStatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDefinitions = async (preferredBusinessType = selectedBusinessType) => {
    setLoading(true);
    setError(null);
    try {
      const nextDefinitions = await listWorkflowDefinitions();
      setDefinitions(nextDefinitions);
      const nextBusinessType = preferredBusinessType && nextDefinitions.some((item) => item.businessType === preferredBusinessType)
        ? preferredBusinessType
        : nextDefinitions[0]?.businessType ?? null;
      setSelectedBusinessType(nextBusinessType);
      if (nextBusinessType) {
        const nextDetail = await getWorkflowDefinition(nextBusinessType);
        setSelectedDefinition(nextDetail);
      } else {
        setSelectedDefinition(null);
      }
    } catch {
      setDefinitions([]);
      setSelectedDefinition(null);
      setError('流程定义加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  const loadDefinitionDetail = async (businessType: string) => {
    setDetailLoading(true);
    setError(null);
    setSelectedBusinessType(businessType);
    try {
      const nextDetail = await getWorkflowDefinition(businessType);
      setSelectedDefinition(nextDetail);
    } catch {
      setSelectedDefinition(null);
      setError('流程定义加载失败，敏感细节已脱敏');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadDefinitions();
  }, [canView]);

  const visibleDefinitions = useMemo(
    () => definitions.filter((definition) => matchesStatus(definition, statusFilter) && matchesKeyword(definition, activeKeyword)),
    [definitions, statusFilter, activeKeyword],
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveKeyword(keywordInput.trim());
  };

  const handleReload = () => {
    void loadDefinitions(selectedBusinessType);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问流程定义，请确认 system:flow:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = definitions.length === 0 ? '暂无流程定义模板。' : '没有符合条件的流程定义。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">流程定义</h3>
          <p className="mt-1 text-sm text-slate-500">{'只读展示 /workflows 与 /workflows/{businessType} 返回的流程模板、版本状态和节点摘要。'}</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading || detailLoading}
          type="button"
          onClick={handleReload}
        >
          重新加载
        </button>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="flow-definition-keyword">业务类型关键词</label>
        <input
          id="flow-definition-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按业务类型或名称搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="flow-definition-status-filter">状态筛选</label>
        <select
          id="flow-definition-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as FlowStatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="configured">已配置</option>
          <option value="unconfigured">未配置</option>
          <option value="disabled">已停用</option>
        </select>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading || detailLoading}
          type="submit"
        >
          搜索
        </button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">流程定义加载中...</div> : null}
      {!loading && !error && visibleDefinitions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">流程模板列表</h4>
            <span className="text-xs text-slate-500">显示 {visibleDefinitions.length} / {definitions.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-3">业务类型</th>
                  <th scope="col" className="py-2 pr-3">名称</th>
                  <th scope="col" className="py-2 pr-3">版本</th>
                  <th scope="col" className="py-2 pr-3">状态</th>
                  <th scope="col" className="py-2 pr-3">可发起</th>
                  <th scope="col" className="py-2 pr-3">节点</th>
                  <th scope="col" className="py-2 pr-3">摘要</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDefinitions.map((definition) => {
                  const startable = canStart(definition.status);
                  return (
                  <tr key={definition.businessType}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{definition.businessType}</td>
                    <td className="py-2 pr-3 text-slate-600">{definition.name}</td>
                    <td className="py-2 pr-3 text-slate-500">v{definition.version ?? 0}</td>
                    <td className="py-2 pr-3 text-slate-500">{statusLabel(definition.status)}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${startable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {startable ? '可发起' : '不可发起'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{nodeCount(definition.definition)} 个</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={detailLoading}
                        onClick={() => void loadDefinitionDetail(definition.businessType)}
                      >
                        查看摘要
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold">详情摘要</h4>
          {detailLoading ? <p role="status" aria-live="polite" className="text-sm text-slate-500">流程详情加载中...</p> : null}
          {!detailLoading && selectedDefinition ? (
            <dl className="space-y-2 text-sm text-slate-600">
              <div>
                <dt className="text-xs text-slate-500">业务类型</dt>
                <dd className="font-medium text-slate-800">{selectedDefinition.businessType}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">说明</dt>
                <dd>{selectedDefinition.description ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">节点 / 连线</dt>
                <dd>{nodeCount(selectedDefinition.definition)} / {edgeCount(selectedDefinition.definition)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">最后更新时间</dt>
                <dd>{selectedDefinition.updateTime ?? '-'}</dd>
              </div>
            </dl>
          ) : null}
          {!detailLoading && !selectedDefinition ? <h3 className="text-sm font-medium text-slate-500">暂无可展示的流程摘要。</h3> : null}
        </aside>
      </div>
    </section>
  );
}
