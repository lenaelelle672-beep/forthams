import { FormEvent, useEffect, useMemo, useState } from 'react';
import { listLocations, listRootLocations, type LocationRecord } from '../../api/locations';

type SystemLocationManagementWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'enabled' | 'disabled';

function normalizeText(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function statusLabel(status: number | null | undefined) {
  if (status === 1) {
    return '启用';
  }
  if (status === 0) {
    return '停用';
  }
  return '未知';
}

function matchesStatus(status: number | null | undefined, filter: StatusFilter) {
  if (filter === 'enabled') {
    return status === 1;
  }
  if (filter === 'disabled') {
    return status === 0;
  }
  return true;
}

export default function SystemLocationManagementWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemLocationManagementWorkbenchPageProps) {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [rootLocations, setRootLocations] = useState<LocationRecord[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextLocations, nextRoots] = await Promise.all([listLocations(), listRootLocations()]);
      setLocations(nextLocations);
      setRootLocations(nextRoots);
    } catch {
      setLocations([]);
      setRootLocations([]);
      setError('位置加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadLocations();
  }, [canView]);

  const filteredLocations = useMemo(() => {
    const keyword = normalizeText(activeKeyword.trim());
    return locations.filter((location) => {
      const keywordMatched = keyword.length === 0 || [
        location.name,
        location.locationCode,
        location.description,
        location.parentId,
      ].some((value) => normalizeText(value).includes(keyword));
      return keywordMatched && matchesStatus(location.status, statusFilter);
    });
  }, [activeKeyword, locations, statusFilter]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveKeyword(keywordInput.trim());
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问位置管理，请确认 location:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = locations.length === 0 ? '暂无位置数据。' : '没有符合条件的位置。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">位置管理</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /locations/list 与 /locations/root 返回的位置，搜索与状态筛选在前端结果内完成。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={() => void loadLocations()}
        >
          重新加载
        </button>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="location-keyword">位置关键词</label>
        <input
          id="location-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按名称、编码、描述或父级搜索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="location-status-filter">状态筛选</label>
        <select
          id="location-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
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
      {loading ? <div className="text-sm text-slate-500">位置加载中...</div> : null}
      {!loading && !error && filteredLocations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">位置列表</h4>
            <span className="text-xs text-slate-500">显示 {filteredLocations.length} / {locations.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3">名称</th>
                  <th className="py-2 pr-3">编码</th>
                  <th className="py-2 pr-3">父级 ID</th>
                  <th className="py-2 pr-3">排序</th>
                  <th className="py-2 pr-3">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLocations.map((location) => (
                  <tr key={location.id}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{location.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{location.locationCode ?? '-'}</td>
                    <td className="py-2 pr-3 text-slate-500">{location.parentId ?? '根位置'}</td>
                    <td className="py-2 pr-3 text-slate-500">{location.sortOrder ?? '-'}</td>
                    <td className="py-2 pr-3 text-slate-500">{statusLabel(location.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 font-semibold">根位置摘要</h4>
          {rootLocations.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {rootLocations.map((location) => (
                <li key={location.id} className="rounded-xl bg-white px-3 py-2">
                  <span className="font-medium text-slate-800">{location.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{location.locationCode ?? '-'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">暂无根位置。</p>
          )}
        </div>
      </div>
    </section>
  );
}
