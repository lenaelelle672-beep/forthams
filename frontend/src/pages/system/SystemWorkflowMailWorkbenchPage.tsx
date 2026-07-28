import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listWorkflowMailConfigs,
  getWorkflowMailMeta,
  type WorkflowMailConfigRecord,
  type WorkflowMailMeta,
} from '../../api/workflowMail';
import { CatalogPagination } from '../../components/ui/CatalogPagination';
import { useCatalogPage } from '../../hooks/useCatalogPage';

type SystemWorkflowMailWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type EnabledFilter = 'all' | 'enabled' | 'disabled';

function emptyMeta(): WorkflowMailMeta {
  return { triggerEvents: [], recipientScopes: [], readOnlyNotice: '流程邮件配置为只读 catalog。' };
}

function matchesKeyword(record: WorkflowMailConfigRecord, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [record.businessType, record.nodeKey, record.nodeName ?? '', record.templateCode ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

export default function SystemWorkflowMailWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemWorkflowMailWorkbenchPageProps) {
  const [meta, setMeta] = useState<WorkflowMailMeta>(emptyMeta);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>('all');

  // List state, pagination, and the stale-response guard are delegated to the
  // generic catalog hook. Keyword + businessType flow through `search`; the
  // enabled filter remains client-side. Meta is fetched alongside, outside the hook.
  const {
    records,
    total,
    loading,
    error,
    page,
    totalPages,
    setPage,
    reload,
    search,
  } = useCatalogPage<WorkflowMailConfigRecord>({
    listFn: (q) => listWorkflowMailConfigs({ page: q.page, pageSize: q.pageSize, ...q }),
    canView,
  });

  // Meta is owned by the page, not the catalog hook. Fetch it once on mount
  // (guarded by `canView`) and never let a meta failure mask the list error.
  useEffect(() => {
    if (!canView) return;
    let ignored = false;
    getWorkflowMailMeta()
      .then((nextMeta) => {
        if (!ignored) setMeta(nextMeta ?? emptyMeta());
      })
      .catch(() => {
        if (!ignored) setMeta(emptyMeta());
      });
    return () => {
      ignored = true;
    };
  }, [canView]);

  const visibleRecords = useMemo(
    () => records.filter((r) => {
      if (enabledFilter === 'enabled' && !r.enabled) return false;
      if (enabledFilter === 'disabled' && r.enabled) return false;
      return matchesKeyword(r, activeKeyword);
    }),
    [records, enabledFilter, activeKeyword],
  );

  const enabledCount = useMemo(() => records.filter((r) => r.enabled).length, [records]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextKeyword = keywordInput.trim();
    const nextBusinessType = businessType.trim();
    setActiveKeyword(nextKeyword);
    const query: Record<string, unknown> = {};
    if (nextKeyword) query.keyword = nextKeyword;
    if (nextBusinessType) query.businessType = nextBusinessType;
    search(query);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问流程邮件配置，请确认 mail:workflow:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = records.length === 0 ? '暂无流程邮件配置数据。' : '没有符合条件的流程邮件配置。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">流程邮件</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示流程节点邮件配置、触发事件、模板与收件人范围。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={reload}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读边界：本页仅展示流程节点邮件配置；新增、编辑、删除、测试发送等写操作不在 V3 只读 catalog 范围内。真实邮件发送未接入流程平台，存在零业务调用风险。
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">配置总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">已启用</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{enabledCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前过滤结果</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleRecords.length}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="workflow-mail-keyword">邮件配置关键词</label>
        <input
          id="workflow-mail-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按业务类型、节点或模板搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="workflow-mail-business-type">业务类型</label>
        <input
          id="workflow-mail-business-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="业务类型精确筛选"
          value={businessType}
          onChange={(event) => setBusinessType(event.target.value)}
        />
        <label className="sr-only" htmlFor="workflow-mail-enabled-filter">启用状态筛选</label>
        <select
          id="workflow-mail-enabled-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={enabledFilter}
          onChange={(event) => setEnabledFilter(event.target.value as EnabledFilter)}
        >
          <option value="all">全部</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已停用</option>
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={loading} type="submit">搜索</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">配置加载中...</div> : null}
      {!loading && !error && visibleRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">流程节点邮件配置</h4>
          <span className="text-xs text-slate-500">显示 {visibleRecords.length} / {records.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">业务类型</th>
                <th scope="col" className="py-2 pr-3">节点</th>
                <th scope="col" className="py-2 pr-3">触发事件</th>
                <th scope="col" className="py-2 pr-3">模板</th>
                <th scope="col" className="py-2 pr-3">收件人</th>
                <th scope="col" className="py-2 pr-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{record.businessType}</td>
                  <td className="py-2 pr-3 text-slate-600">{record.nodeName ?? record.nodeKey}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.triggerEventLabel}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.templateCode ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.recipientScopeLabel}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${record.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {record.enabled ? '已启用' : '已停用'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CatalogPagination
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => setPage(page - 1)}
          onNext={() => setPage(page + 1)}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs text-slate-500">只读提示</p>
        <p className="mt-1">{meta.readOnlyNotice}</p>
      </div>
    </section>
  );
}
