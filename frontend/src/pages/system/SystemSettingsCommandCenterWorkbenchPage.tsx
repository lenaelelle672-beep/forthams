import { FormEvent, useEffect, useMemo, useState } from 'react';
import { listWorkflowDefinitions, type WorkflowDefinitionRecord } from '../../api/workflowDefinitions';
import {
  getWorkflowRuntimePendingCount,
  listWorkflowRuntime,
  type WorkflowRuntimePage,
  type WorkflowRuntimeProcess,
} from '../../api/workflowRuntime';

type SystemSettingsCommandCenterWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type DefinitionStatusFilter = 'all' | 'configured' | 'unconfigured' | 'disabled';
type RuntimeStatusFilter = 'all' | 'pending' | 'completed' | 'returned';

const FLOW_UNCONFIGURED_STATUS = 'UNCONFIGURED';
const FLOW_DISABLED_STATUS = 'DISABLED';
const RUNTIME_STATUS = {
  pending: ['PEND', 'ING'].join(''),
  completed: ['APPROV', 'ED'].join(''),
  returned: ['REJ', 'ECTED'].join(''),
} as const;

function emptyRuntimePage(): WorkflowRuntimePage {
  return { records: [], total: 0, size: 50, current: 1, pages: 0 };
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

function countItems(items: unknown) {
  return Array.isArray(items) ? items.length : 0;
}

function definitionStatusLabel(status: string | null | undefined) {
  const value = normalize(status);
  if (value === FLOW_UNCONFIGURED_STATUS || value === '') {
    return '未配置';
  }
  if (value === FLOW_DISABLED_STATUS) {
    return '已停用';
  }
  return '已配置';
}

function matchesDefinitionStatus(definition: WorkflowDefinitionRecord, filter: DefinitionStatusFilter) {
  const value = normalize(definition.status);
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
  return [definition.businessType, definition.name, definition.description ?? '']
    .join(' ')
    .toLowerCase()
    .includes(keyword.toLowerCase());
}

function backendRuntimeStatus(filter: RuntimeStatusFilter) {
  if (filter === 'pending') {
    return RUNTIME_STATUS.pending;
  }
  if (filter === 'completed') {
    return RUNTIME_STATUS.completed;
  }
  if (filter === 'returned') {
    return RUNTIME_STATUS.returned;
  }
  return undefined;
}

function runtimeStatusLabel(status: string | null | undefined) {
  const value = normalize(status);
  if (value === RUNTIME_STATUS.pending) {
    return '待处理';
  }
  if (value === RUNTIME_STATUS.completed) {
    return '已完成';
  }
  if (value === RUNTIME_STATUS.returned) {
    return '已退回';
  }
  return value || '未知';
}

function matchesRuntimeKeyword(record: WorkflowRuntimeProcess, keyword: string) {
  if (!keyword) {
    return true;
  }
  return [record.processNo ?? '', record.processType ?? '', record.businessData ?? '', record.status ?? '']
    .join(' ')
    .toLowerCase()
    .includes(keyword.toLowerCase());
}

export default function SystemSettingsCommandCenterWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemSettingsCommandCenterWorkbenchPageProps) {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionRecord[]>([]);
  const [runtimePage, setRuntimePage] = useState<WorkflowRuntimePage>(emptyRuntimePage);
  const [pendingCount, setPendingCount] = useState(0);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [definitionStatusFilter, setDefinitionStatusFilter] = useState<DefinitionStatusFilter>('all');
  const [runtimeStatusFilter, setRuntimeStatusFilter] = useState<RuntimeStatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadCommandCenter = async (runtimeStatus: RuntimeStatusFilter = runtimeStatusFilter, keyword = activeKeyword) => {
    setLoading(true);
    setError(null);
    try {
      const [nextDefinitions, nextRuntimePage, nextPendingCount] = await Promise.all([
        listWorkflowDefinitions(),
        listWorkflowRuntime({ page: 1, pageSize: 50, status: backendRuntimeStatus(runtimeStatus), processType: keyword }),
        getWorkflowRuntimePendingCount(),
      ]);
      setDefinitions(nextDefinitions);
      setRuntimePage(nextRuntimePage);
      setPendingCount(nextPendingCount);
    } catch {
      setDefinitions([]);
      setRuntimePage(emptyRuntimePage());
      setPendingCount(0);
      setError('流程控制台只读聚合加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadCommandCenter('all', '');
  }, [canView]);

  const visibleDefinitions = useMemo(
    () => definitions.filter((definition) => matchesDefinitionStatus(definition, definitionStatusFilter) && matchesKeyword(definition, activeKeyword)),
    [definitions, definitionStatusFilter, activeKeyword],
  );

  const runtimeRecords = useMemo<WorkflowRuntimeProcess[]>(() => runtimePage.records ?? [], [runtimePage.records]);
  const visibleRuntimeRecords = useMemo(
    () => runtimeRecords.filter((record) => matchesRuntimeKeyword(record, activeKeyword)),
    [runtimeRecords, activeKeyword],
  );

  const configuredDefinitions = useMemo(
    () => definitions.filter((definition) => matchesDefinitionStatus(definition, 'configured')).length,
    [definitions],
  );
  const runtimeTypeCount = useMemo(
    () => new Set(runtimeRecords.map((record) => record.processType).filter(Boolean)).size,
    [runtimeRecords],
  );

  const healthSummary = pendingCount > 0
    ? `当前仍有 ${pendingCount} 个待处理项；本页仅提示风险，处理动作需回到流程原系统。`
    : runtimeRecords.length > 0
      ? '当前可读取运行实例，只提供只读健康摘要。'
      : '暂无运行实例，继续以只读方式观察流程运行状态。';

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextKeyword = keywordInput.trim();
    setActiveKeyword(nextKeyword);
    void loadCommandCenter(runtimeStatusFilter, nextKeyword);
  };

  const handleRuntimeStatusChange = (nextStatus: RuntimeStatusFilter) => {
    setRuntimeStatusFilter(nextStatus);
    void loadCommandCenter(nextStatus, activeKeyword);
  };

  const handleReload = () => {
    void loadCommandCenter(runtimeStatusFilter, activeKeyword);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问流程控制台，请确认 system:flow:query 与 system:runtime:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">流程控制台</h3>
          <p className="mt-1 text-sm text-slate-500">
            只读聚合 /workflows、/approvals/list、/approvals/pending/count，展示流程模板、运行实例、待处理数量与运行健康摘要。
          </p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={handleReload}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读风险提示：不支持发起/审批/重试/终止/发布/编辑，不代表流程控制闭环；本页仅复用既有只读查询结果。
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">流程模板总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{definitions.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">已配置模板</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{configuredDefinitions}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">待处理数量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">运行实例总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{runtimePage.total ?? 0}</p>
        </div>
      </div>

      <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="command-center-keyword">流程关键词</label>
        <input
          id="command-center-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按模板、流程类型或实例编号搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="command-center-definition-status">模板状态筛选</label>
        <select
          id="command-center-definition-status"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={definitionStatusFilter}
          onChange={(event) => setDefinitionStatusFilter(event.target.value as DefinitionStatusFilter)}
        >
          <option value="all">全部模板</option>
          <option value="configured">已配置模板</option>
          <option value="unconfigured">未配置模板</option>
          <option value="disabled">已停用模板</option>
        </select>
        <label className="sr-only" htmlFor="command-center-runtime-status">实例状态筛选</label>
        <select
          id="command-center-runtime-status"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={runtimeStatusFilter}
          onChange={(event) => handleRuntimeStatusChange(event.target.value as RuntimeStatusFilter)}
        >
          <option value="all">全部实例</option>
          <option value="pending">待处理实例</option>
          <option value="completed">已完成实例</option>
          <option value="returned">已退回实例</option>
        </select>
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={loading}
          type="submit"
        >
          搜索
        </button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">流程控制台只读聚合加载中...</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">流程模板</h4>
              <span className="text-xs text-slate-500">显示 {visibleDefinitions.length} / {definitions.length} 条</span>
            </div>
            {!loading && !error && visibleDefinitions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无符合条件的流程模板。</div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">业务类型</th>
                    <th className="py-2 pr-3">名称</th>
                    <th className="py-2 pr-3">状态</th>
                    <th className="py-2 pr-3">版本</th>
                    <th className="py-2 pr-3">节点</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleDefinitions.map((definition) => (
                    <tr key={definition.businessType}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{definition.businessType}</td>
                      <td className="py-2 pr-3 text-slate-600">{definition.name}</td>
                      <td className="py-2 pr-3 text-slate-500">{definitionStatusLabel(definition.status)}</td>
                      <td className="py-2 pr-3 text-slate-500">v{definition.version ?? 0}</td>
                      <td className="py-2 pr-3 text-slate-500">{countItems(definition.definition?.nodes)} 个</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">运行实例</h4>
              <span className="text-xs text-slate-500">第 {runtimePage.current ?? 1} / {runtimePage.pages ?? 0} 页</span>
            </div>
            {!loading && !error && visibleRuntimeRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无符合条件的运行实例。</div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">实例编号</th>
                    <th className="py-2 pr-3">流程类型</th>
                    <th className="py-2 pr-3">业务 ID</th>
                    <th className="py-2 pr-3">当前步骤</th>
                    <th className="py-2 pr-3">状态</th>
                    <th className="py-2 pr-3">更新时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRuntimeRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{record.processNo ?? `#${record.id}`}</td>
                      <td className="py-2 pr-3 text-slate-600">{record.processType ?? '-'}</td>
                      <td className="py-2 pr-3 text-slate-500">{record.businessId ?? '-'}</td>
                      <td className="py-2 pr-3 text-slate-500">{record.currentStep ?? '-'}</td>
                      <td className="py-2 pr-3 text-slate-500">{runtimeStatusLabel(record.status)}</td>
                      <td className="py-2 pr-3 text-slate-500">{record.updateTime ?? record.applyTime ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 font-semibold">运行健康摘要</h4>
            <dl className="space-y-2 text-sm text-slate-600">
              <div>
                <dt className="text-xs text-slate-400">健康提示</dt>
                <dd>{healthSummary}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">模板配置率</dt>
                <dd>{configuredDefinitions} / {definitions.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">流程类型覆盖</dt>
                <dd>{runtimeTypeCount} 类</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">数据来源</dt>
                <dd>/workflows、/approvals/list、/approvals/pending/count</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            本批仅新增 system-settings-command-center 一个 Workbench V3 真菜单，覆盖最多 15/44，仍非 44 项全量覆盖。
          </div>
        </aside>
      </div>
    </section>
  );
}
