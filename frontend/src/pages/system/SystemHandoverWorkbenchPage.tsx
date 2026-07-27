import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listHandoverTasks,
  getHandoverMeta,
  type HandoverRecord,
  type HandoverMeta,
  type HandoverQuery,
} from '../../api/handover';

type SystemHandoverWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

function statusBadgeClass(status: string | null | undefined) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (value === 'IN_PROGRESS') return 'bg-blue-50 text-blue-700';
  if (value === 'CANCELLED') return 'bg-slate-100 text-slate-500';
  if (value === 'PENDING') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function matchesStatus(record: HandoverRecord, filter: StatusFilter) {
  if (filter === 'all') return true;
  return String(record.status ?? '').toUpperCase() === filter;
}

function matchesKeyword(record: HandoverRecord, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [record.title, record.outgoingUserName ?? '', record.incomingUserName ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function emptyMeta(): HandoverMeta {
  return { statuses: [], readOnlyNotice: '交接管理为只读 catalog。' };
}

export default function SystemHandoverWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemHandoverWorkbenchPageProps) {
  const [records, setRecords] = useState<HandoverRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<HandoverMeta>(emptyMeta);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = (): HandoverQuery => {
    const query: HandoverQuery = {};
    if (statusFilter !== 'all') query.status = statusFilter;
    return query;
  };

  const loadRecords = async (query: HandoverQuery = buildQuery(), nextPage: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const [data, nextMeta] = await Promise.all([
        listHandoverTasks({ page: nextPage, pageSize, ...query }),
        getHandoverMeta(),
      ]);
      setRecords(data?.records ?? []);
      setTotal(data?.total ?? 0);
      setMeta(nextMeta ?? emptyMeta());
      setPage(nextPage);
    } catch {
      setRecords([]);
      setTotal(0);
      setMeta(emptyMeta());
      setError('交接任务加载失败，敏感细节已脱敏');
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
      listHandoverTasks({ page, pageSize }),
      getHandoverMeta(),
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
          setError('交接任务加载失败，敏感细节已脱敏');
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

  const pendingCount = useMemo(() => records.filter((r) => ['PENDING', 'IN_PROGRESS'].includes(String(r.status ?? '').toUpperCase())).length, [records]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadRecords(buildQuery(), 1);
  };

  const handlePrevPage = () => {
    if (page <= 1 || loading) return;
    void loadRecords(buildQuery(), page - 1);
  };

  const handleNextPage = () => {
    if (page >= totalPages || loading) return;
    void loadRecords(buildQuery(), page + 1);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问交接管理，请确认 system:handover:query 权限。
        </div>
      </section>
    );
  }

  const emptyMessage = records.length === 0 ? '暂无交接任务数据。' : '没有符合条件的交接任务。';

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">交接管理</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示交接任务摘要、状态记录与未闭环风险提示。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={() => void loadRecords()}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读边界：本页仅展示交接任务摘要与状态；发起、推进、取消交接等写操作不在 V3 只读 catalog 范围内。真实资产/工单/审批对象转移未闭环，需后续专项处理。
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">交接任务总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">待处理/进行中</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前过滤结果</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleRecords.length}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="handover-keyword">交接任务关键词</label>
        <input
          id="handover-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按标题、交接人或接收人搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <label className="sr-only" htmlFor="handover-status-filter">交接状态筛选</label>
        <select
          id="handover-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="PENDING">待交接</option>
          <option value="IN_PROGRESS">交接中</option>
          <option value="COMPLETED">已完成</option>
          <option value="CANCELLED">已取消</option>
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
      {loading ? <div role="status" aria-live="polite" className="text-sm text-slate-500">交接任务加载中...</div> : null}
      {!loading && !error && visibleRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">{emptyMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">交接任务列表</h4>
          <span className="text-xs text-slate-500">显示 {visibleRecords.length} / {records.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3">标题</th>
                <th scope="col" className="py-2 pr-3">交接人</th>
                <th scope="col" className="py-2 pr-3">接收人</th>
                <th scope="col" className="py-2 pr-3">资产</th>
                <th scope="col" className="py-2 pr-3">工单</th>
                <th scope="col" className="py-2 pr-3">审批</th>
                <th scope="col" className="py-2 pr-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{record.title}</td>
                  <td className="py-2 pr-3 text-slate-600">{record.outgoingUserName ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-600">{record.incomingUserName ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.assetCount ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.workorderCount ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.approvalCount ?? 0}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(record.status)}`}>
                      {record.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-sm text-slate-600">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={page <= 1 || loading}
            onClick={handlePrevPage}
          >
            上一页
          </button>
          <span>第 {page} / {totalPages} 页</span>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={page >= totalPages || loading}
            onClick={handleNextPage}
          >
            下一页
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs text-slate-500">只读提示</p>
        <p className="mt-1">{meta.readOnlyNotice}</p>
      </div>
    </section>
  );
}
