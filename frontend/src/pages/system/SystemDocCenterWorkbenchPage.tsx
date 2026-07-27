import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listDocArticles,
  getDocCenterMeta,
  type DocArticleRecord,
  type DocCenterMeta,
  type DocArticleQuery,
} from '../../api/docCenter';
import { CatalogPagination } from '../../components/ui/CatalogPagination';

type SystemDocCenterWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

function statusBadgeClass(status: string | null | undefined) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'PUBLISHED') return 'bg-emerald-50 text-emerald-700';
  if (value === 'ARCHIVED') return 'bg-slate-100 text-slate-500';
  if (value === 'DRAFT') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function matchesStatus(record: DocArticleRecord, filter: StatusFilter) {
  if (filter === 'all') return true;
  return String(record.status ?? '').toUpperCase() === filter;
}

function matchesKeyword(record: DocArticleRecord, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [record.title, record.summary ?? '', record.authorName ?? ''].join(' ').toLowerCase().includes(normalized);
}

function emptyMeta(): DocCenterMeta {
  return { categories: [], statuses: [], readOnlyNotice: '文档中心为只读 catalog。' };
}

export default function SystemDocCenterWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemDocCenterWorkbenchPageProps) {
  const [records, setRecords] = useState<DocArticleRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<DocCenterMeta>(emptyMeta);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = (): DocArticleQuery => {
    const query: DocArticleQuery = {};
    if (category.trim()) query.category = category.trim();
    if (statusFilter !== 'all') query.status = statusFilter;
    return query;
  };

  const loadArticles = async (query: DocArticleQuery = buildQuery(), nextPage: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const [data, nextMeta] = await Promise.all([
        listDocArticles({ page: nextPage, pageSize, ...query }),
        getDocCenterMeta(),
      ]);
      setRecords(data?.records ?? []);
      setTotal(data?.total ?? 0);
      setMeta(nextMeta ?? emptyMeta());
      setPage(nextPage);
    } catch {
      setRecords([]);
      setTotal(0);
      setMeta(emptyMeta());
      setError('文档中心加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let ignored = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listDocArticles({ page, pageSize }),
      getDocCenterMeta(),
    ])
      .then(([data, nextMeta]) => {
        if (ignored) {
          return;
        }
        setRecords(data?.records ?? []);
        setTotal(data?.total ?? 0);
        setMeta(nextMeta ?? emptyMeta());
      })
      .catch(() => {
        if (!ignored) {
          setRecords([]);
          setTotal(0);
          setMeta(emptyMeta());
          setError('文档中心加载失败，敏感细节已脱敏');
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
  }, [canView, page, pageSize]);

  const visibleRecords = useMemo(
    () => records.filter((r) => matchesStatus(r, statusFilter) && matchesKeyword(r, keyword)),
    [records, statusFilter, keyword],
  );

  const publishedCount = useMemo(() => records.filter((r) => String(r.status ?? '').toUpperCase() === 'PUBLISHED').length, [records]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadArticles(buildQuery(), 1);
  };

  const handlePrevPage = () => {
    if (page <= 1 || loading) return;
    void loadArticles(buildQuery(), page - 1);
  };

  const handleNextPage = () => {
    if (page >= totalPages || loading) return;
    void loadArticles(buildQuery(), page + 1);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问文档中心，请确认 system:doc-center:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = records.length === 0 ? '暂无文档数据。' : '没有符合条件的文档。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">文档中心</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示文档标题、分类、版本、发布状态与附件计数。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={() => void loadArticles()}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读边界：本页仅展示文档目录；编辑、发布、归档、删除、附件上传等写操作不在 V3 只读 catalog 范围内。附件安全与删除留痕需后续专项处理。
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">文档总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">已发布</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{publishedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前过滤结果</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleRecords.length}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="doc-center-keyword">文档关键词</label>
        <input
          id="doc-center-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按标题、摘要或作者搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <label className="sr-only" htmlFor="doc-center-category">文档分类</label>
        <input
          id="doc-center-category"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="分类精确筛选"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <label className="sr-only" htmlFor="doc-center-status-filter">文档状态筛选</label>
        <select
          id="doc-center-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">已发布</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={loading} type="submit">搜索</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">文档加载中...</div> : null}
      {!loading && !error && visibleRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">文档列表</h4>
          <span className="text-xs text-slate-500">显示 {visibleRecords.length} / {records.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">标题</th>
                <th scope="col" className="py-2 pr-3">分类</th>
                <th scope="col" className="py-2 pr-3">版本</th>
                <th scope="col" className="py-2 pr-3">作者</th>
                <th scope="col" className="py-2 pr-3">附件</th>
                <th scope="col" className="py-2 pr-3">状态</th>
                <th scope="col" className="py-2 pr-3">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{record.title}</td>
                  <td className="py-2 pr-3 text-slate-600">{record.categoryLabel}</td>
                  <td className="py-2 pr-3 text-slate-500">v{record.version}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.authorName ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.attachmentCount}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(record.status)}`}>
                      {record.statusLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{record.updatedAt ?? record.publishedAt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CatalogPagination
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs text-slate-500">只读提示</p>
        <p className="mt-1">{meta.readOnlyNotice}</p>
      </div>
    </section>
  );
}
