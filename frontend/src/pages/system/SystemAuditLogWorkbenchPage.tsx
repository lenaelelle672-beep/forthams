import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getAuditActionTypeDistribution,
  getAuditLogDetail,
  getAuditLogs,
  getAuditMeta,
  getAuditOperatorRanking,
  getAuditStats,
  getAuditTrends,
  type AuditDistributionResponse,
  type AuditListQuery,
  type AuditLog,
  type AuditMetaResponse,
  type AuditOperatorRankingItem,
  type AuditStats,
  type AuditTrendResponse,
} from '../../api/audit';
import type { PageData } from '../../types/common';

type SystemAuditLogWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

const readonlyBoundary = '只读审计日志：真实调用 /audit-logs GET 族端点；不提供 POST/PUT/PATCH/DELETE，不采集审计写入，不生成真实导出文件。';
const nonClosureNotice = '本页不是全局审计采集闭环，不代表全模块审计覆盖、不可篡改合规归档或 SIEM/外部审计平台集成。';
const exportNotice = '导出能力仅展示脱敏快照与限制说明；不创建 Blob、不触发下载、不创建后台导出任务。';

const emptyPage: PageData<AuditLog> = { records: [], total: 0, size: 20, current: 1, pages: 0 };

export default function SystemAuditLogWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemAuditLogWorkbenchPageProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [operationTypeInput, setOperationTypeInput] = useState('');
  const [resourceTypeInput, setResourceTypeInput] = useState('');
  const [activeFilters, setActiveFilters] = useState<AuditListQuery>({ page: 1, pageSize: 20, granularity: 'daily' });
  const [page, setPage] = useState(emptyPage);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [trend, setTrend] = useState<AuditTrendResponse | null>(null);
  const [distribution, setDistribution] = useState<AuditDistributionResponse | null>(null);
  const [ranking, setRanking] = useState<AuditOperatorRankingItem[]>([]);
  const [meta, setMeta] = useState<AuditMetaResponse | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getAuditLogs(activeFilters),
      getAuditStats(activeFilters),
      getAuditTrends(activeFilters),
      getAuditActionTypeDistribution(activeFilters),
      getAuditOperatorRanking({ startTime: activeFilters.startTime, endTime: activeFilters.endTime, limit: 10 }),
      getAuditMeta(),
    ])
      .then(async ([listResult, statsResult, trendResult, distResult, rankingResult, metaResult]) => {
        if (ignored) {
          return;
        }
        setPage(listResult);
        setStats(statsResult);
        setTrend(trendResult);
        setDistribution(distResult);
        setRanking(rankingResult);
        setMeta(metaResult);
        const firstId = listResult.records[0]?.id;
        if (firstId) {
          try {
            const nextDetail = await getAuditLogDetail(firstId);
            if (!ignored) {
              setDetail(nextDetail);
            }
          } catch {
            if (!ignored) {
              setDetail(null);
            }
          }
        } else {
          setDetail(null);
        }
      })
      .catch(() => {
        if (!ignored) {
          setPage(emptyPage);
          setDetail(null);
          setError('审计日志加载失败，错误详情已脱敏');
        }
      })
      .finally(() => {
        if (!ignored) {
          setLoading(false);
        }
      });

    return () => {
      ignored = true;
    };
  }, [activeFilters, canView]);

  const operationTypeOptions = useMemo(
    () => meta?.operationTypes?.length ? meta.operationTypes : ['CREATE', 'UPDATE', 'DELETE', 'LOGIN'],
    [meta],
  );
  const resourceTypeOptions = useMemo(
    () => meta?.resourceTypes?.length ? meta.resourceTypes : ['ASSET', 'WORKFLOW', 'SYSTEM_CONFIG'],
    [meta],
  );

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      page: 1,
      pageSize: 20,
      keyword: keywordInput.trim() || undefined,
      operationType: operationTypeInput || undefined,
      resourceType: resourceTypeInput || undefined,
      granularity: 'daily',
    });
  };

  const openDetail = async (log: AuditLog) => {
    try {
      setDetail(await getAuditLogDetail(log.id));
    } catch {
      setError('审计日志详情加载失败，错误详情已脱敏');
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench} data-system-audit-log="workbench-v3">
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问审计日志，请确认 system:audit-log:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench} data-system-audit-log="workbench-v3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">审计日志</h3>
          <p className="mt-1 text-sm text-slate-500">真实调用 /audit-logs、/audit-logs/&#123;id&#125;、/audit-logs/stats、/audit-logs/trends、/audit-logs/action-type-distribution、/audit-logs/operator-ranking 与 /audit-logs/meta。</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">GET-only / tenant-scoped / masked</span>
      </div>

      <div role="note" className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">{readonlyBoundary}</p>
        <p>{nonClosureNotice}</p>
        <p>{exportNotice}</p>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={applyFilters}>
        <label className="sr-only" htmlFor="audit-log-keyword">审计日志关键词</label>
        <input
          id="audit-log-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按操作人、说明或资源类型搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="audit-log-operation-type">操作类型筛选</label>
        <select id="audit-log-operation-type" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={operationTypeInput} onChange={(event) => setOperationTypeInput(event.target.value)}>
          <option value="">全部操作类型</option>
          {operationTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="sr-only" htmlFor="audit-log-resource-type">资源类型筛选</label>
        <select id="audit-log-resource-type" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={resourceTypeInput} onChange={(event) => setResourceTypeInput(event.target.value)}>
          <option value="">全部资源类型</option>
          {resourceTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="submit" disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:bg-slate-300">查询</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">审计日志加载中...</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">命中日志</p><p className="mt-1 text-2xl font-semibold">{page.total}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">统计总数</p><p className="mt-1 text-2xl font-semibold">{stats?.totalCount ?? 0}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">操作类型</p><p className="mt-1 text-2xl font-semibold">{distribution?.distribution.length ?? 0}</p></div>
        <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">操作人排行</p><p className="mt-1 text-2xl font-semibold">{ranking.length}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="审计日志列表">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">只读审计事件</h4>
            <span className="text-xs text-slate-500">显示 {page.records.length} / {page.total} 条，before/after/raw 均为脱敏摘要</span>
          </div>
          {page.records.length === 0 && !loading ? <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无审计日志。</h3> : null}
          <div className="space-y-2">
            {page.records.map((log) => (
              <button key={log.id} type="button" className="w-full rounded-2xl border border-slate-200 p-4 text-left text-sm hover:border-blue-200 hover:bg-blue-50" onClick={() => openDetail(log)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{log.operationType} · {log.resourceType ?? 'UNKNOWN'}</span>
                  <span className="text-xs text-slate-500">{log.createdAt?.replace('T', ' ').slice(0, 16)}</span>
                </span>
                <span className="mt-1 block text-slate-600">操作人：{log.operatorName} · 资源：{log.resourceId ?? '已脱敏'}</span>
                <span className="mt-1 block text-xs text-slate-500">URI：{log.requestUri ?? '已脱敏'} · IP：{log.ipAddress ?? '已脱敏'}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-label="审计日志详情">
          <h4 className="font-semibold">追溯详情（脱敏）</h4>
          {detail ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>操作类型：{detail.operationType}</p>
              <p>资源 ID：{detail.resourceId ?? '已脱敏'}</p>
              <p>Request URI：{detail.requestUri ?? '已脱敏'}</p>
              <p>User-Agent：{detail.userAgent ?? '已脱敏'}</p>
              <p>beforeRecord 摘要：{detail.beforeRecordSummary ?? '无'}</p>
              <p>afterRecord 摘要：{detail.afterRecordSummary ?? '无'}</p>
              <p>raw payload 摘要：{detail.rawPayloadSummary ?? '无'}</p>
              <p>错误摘要：{detail.errorSummary ?? '无'}</p>
            </div>
          ) : <h3 className="text-sm font-medium text-slate-500">请选择一条审计日志查看脱敏详情。</h3>}
          <button type="button" disabled className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
            导出脱敏快照（禁用，不生成文件）
          </button>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="审计趋势">
          <h4 className="font-semibold">趋势</h4>
          <p className="mt-2 text-sm text-slate-600">粒度：{trend?.granularity ?? 'daily'} · 点数：{trend?.data.length ?? 0}</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            {(trend?.data ?? []).slice(0, 5).map((item) => <li key={item.date}>{item.date}：{item.count}</li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="操作类型分布">
          <h4 className="font-semibold">操作类型分布</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            {(distribution?.distribution ?? []).slice(0, 5).map((item) => <li key={item.actionType}>{item.actionType}：{item.count}（{item.percentage}%）</li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-4" aria-label="操作人排行">
          <h4 className="font-semibold">操作人排行</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            {ranking.slice(0, 5).map((item) => <li key={`${item.rank}-${item.operatorName}`}>#{item.rank} {item.operatorName}：{item.count}</li>)}
          </ul>
        </section>
      </div>
    </section>
  );
}
