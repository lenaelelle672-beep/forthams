import { useEffect, useState } from 'react';
import {
  listCacheNamespaces,
  refreshAllCacheNamespaces,
  refreshCacheNamespace,
  type CacheNamespaceStatus,
  type CacheRefreshResult,
} from '../../api/cacheManagement';

type SystemCacheManagementWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
  canRefresh?: boolean;
};

function resultPrefix(result: CacheRefreshResult) {
  if (result.status === 'CLEARED') {
    return '刷新成功';
  }
  if (result.status === 'CLEARED_EMPTY') {
    return '刷新空缓存';
  }
  return '刷新失败';
}

export default function SystemCacheManagementWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
  canRefresh = true,
}: SystemCacheManagementWorkbenchPageProps) {
  const [namespaces, setNamespaces] = useState<CacheNamespaceStatus[]>([]);
  const [loading, setLoading] = useState(canView);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<CacheRefreshResult[]>([]);

  const reload = async () => {
    const records = await listCacheNamespaces();
    setNamespaces(records);
    setError(null);
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    listCacheNamespaces()
      .then((records) => {
        if (mounted) {
          setNamespaces(records);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('缓存命名空间加载失败，敏感细节已脱敏');
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [canView]);

  const applyResults = (nextResults: CacheRefreshResult[]) => {
    setResults(nextResults);
    setNotice(nextResults.map((result) => `${resultPrefix(result)}：${result.namespace}`).join('；'));
  };

  const handleRefreshNamespace = async (namespace: string) => {
    if (!canRefresh) {
      setNotice('缺少 system:cache:refresh 权限，不能刷新缓存。');
      return;
    }
    setRefreshing(namespace);
    try {
      const result = await refreshCacheNamespace(namespace);
      applyResults([result]);
      await reload();
    } catch {
      setNotice(`刷新失败：${namespace}`);
    } finally {
      setRefreshing(null);
    }
  };

  const handleRefreshAll = async () => {
    if (!canRefresh) {
      setNotice('缺少 system:cache:refresh 权限，不能刷新缓存。');
      return;
    }
    setRefreshing('*');
    try {
      const nextResults = await refreshAllCacheNamespaces();
      applyResults(nextResults);
      await reload();
    } catch {
      setNotice('刷新全部白名单命名空间失败，敏感细节已脱敏');
    } finally {
      setRefreshing(null);
    }
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问缓存管理，请确认 system:cache:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">缓存管理</h3>
          <h3 className="mt-1 text-sm font-medium text-slate-500">只管理应用内白名单 CacheManager 命名空间，空缓存不会被报告为普通成功。</h3>
        </div>
        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canRefresh || namespaces.length === 0 || refreshing === '*'}
          type="button"
          onClick={handleRefreshAll}
        >
          刷新全部白名单命名空间
        </button>
      </div>

      {notice ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">缓存命名空间加载中...</div> : null}
      {!loading && !error && namespaces.length === 0 ? (
        <h3 className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-medium text-slate-500">暂无可管理缓存命名空间。</h3>
      ) : null}

      <div className="grid gap-3">
        {namespaces.map((item) => (
          <article key={item.namespace} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold">{item.displayName}</h4>
                <p className="text-sm text-slate-500">{item.namespace}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.empty ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {item.empty ? '空缓存' : '可刷新'}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>可观测：{item.observable ? '是' : '否'}</p>
              <p>条目数：{item.observable ? item.entryCount : '不可观测'}</p>
              <p>原因：{item.reason}</p>
              <p>最后刷新：{item.lastRefreshTime ?? '暂无'}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                disabled={!canRefresh || refreshing === item.namespace}
                type="button"
                onClick={() => handleRefreshNamespace(item.namespace)}
              >
                刷新命名空间
              </button>
              {!canRefresh ? <span className="text-xs text-amber-600">缺少 system:cache:refresh 权限。</span> : null}
            </div>
          </article>
        ))}
      </div>

      {results.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <h4 className="font-semibold">最近刷新结果</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {results.map((result) => (
              <li key={`${result.namespace}-${result.status}`}>
                {resultPrefix(result)}：{result.namespace} · {result.status} · {result.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
