import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listSupportTickets,
  getTechSupportMeta,
  type SupportTicketRecord,
  type TechSupportMeta,
  type SupportTicketQuery,
} from '../../api/techSupport';

type SystemTechSupportWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type StatusFilter = 'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type PriorityFilter = 'all' | 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

function statusBadgeClass(status: string | null | undefined) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'OPEN') return 'bg-blue-50 text-blue-700';
  if (value === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700';
  if (value === 'RESOLVED') return 'bg-emerald-50 text-emerald-700';
  if (value === 'CLOSED') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}

function priorityBadgeClass(priority: string | null | undefined) {
  const value = String(priority ?? '').toUpperCase();
  if (value === 'URGENT') return 'bg-red-50 text-red-700';
  if (value === 'HIGH') return 'bg-orange-50 text-orange-700';
  return 'bg-slate-100 text-slate-600';
}

function matchesStatus(record: SupportTicketRecord, filter: StatusFilter) {
  if (filter === 'all') return true;
  return String(record.status ?? '').toUpperCase() === filter;
}

function matchesPriority(record: SupportTicketRecord, filter: PriorityFilter) {
  if (filter === 'all') return true;
  return String(record.priority ?? '').toUpperCase() === filter;
}

function matchesKeyword(record: SupportTicketRecord, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [record.title, record.summary ?? '', record.requesterName ?? ''].join(' ').toLowerCase().includes(normalized);
}

function emptyMeta(): TechSupportMeta {
  return { priorities: [], statuses: [], readOnlyNotice: '技术支持为只读 catalog。' };
}

export default function SystemTechSupportWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemTechSupportWorkbenchPageProps) {
  const [records, setRecords] = useState<SupportTicketRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<TechSupportMeta>(emptyMeta);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async (query: SupportTicketQuery = {}) => {
    setLoading(true);
    setError(null);
    try {
      const [data, nextMeta] = await Promise.all([
        listSupportTickets({ page: 1, pageSize: 50, ...query }),
        getTechSupportMeta(),
      ]);
      setRecords(data?.records ?? []);
      setTotal(data?.total ?? 0);
      setMeta(nextMeta ?? emptyMeta());
    } catch {
      setRecords([]);
      setTotal(0);
      setMeta(emptyMeta());
      setError('技术支持工单加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadTickets();
  }, [canView]);

  const visibleRecords = useMemo(
    () => records.filter((r) => matchesStatus(r, statusFilter) && matchesPriority(r, priorityFilter) && matchesKeyword(r, keyword)),
    [records, statusFilter, priorityFilter, keyword],
  );

  const openCount = useMemo(() => records.filter((r) => ['OPEN', 'IN_PROGRESS'].includes(String(r.status ?? '').toUpperCase())).length, [records]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query: SupportTicketQuery = {};
    if (statusFilter !== 'all') query.status = statusFilter;
    if (priorityFilter !== 'all') query.priority = priorityFilter;
    void loadTickets(query);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问技术支持，请确认 system:tech-support:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">技术支持</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示技术支持工单、优先级、处理状态与诊断包脱敏标记。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={() => void loadTickets()}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        安全边界：诊断包必须脱敏，禁止导出敏感配置原值。本页仅展示工单只读 catalog；创建、分配、处理、关闭工单与导出诊断包等写操作不在 V3 只读 catalog 范围内。
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">工单总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">待处理/处理中</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前过滤结果</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleRecords.length}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="tech-support-keyword">工单关键词</label>
        <input
          id="tech-support-keyword"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按标题、摘要或提单人搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <label className="sr-only" htmlFor="tech-support-status-filter">工单状态筛选</label>
        <select
          id="tech-support-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="OPEN">待处理</option>
          <option value="IN_PROGRESS">处理中</option>
          <option value="RESOLVED">已解决</option>
          <option value="CLOSED">已关闭</option>
        </select>
        <label className="sr-only" htmlFor="tech-support-priority-filter">工单优先级筛选</label>
        <select
          id="tech-support-priority-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
        >
          <option value="all">全部优先级</option>
          <option value="URGENT">紧急</option>
          <option value="HIGH">高</option>
          <option value="NORMAL">普通</option>
          <option value="LOW">低</option>
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={loading} type="submit">搜索</button>
      </form>

      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">工单加载中...</div> : null}
      {!loading && !error && visibleRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无技术支持工单记录。</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">工单列表</h4>
          <span className="text-xs text-slate-500">显示 {visibleRecords.length} / {records.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">标题</th>
                <th className="py-2 pr-3">优先级</th>
                <th className="py-2 pr-3">提单人</th>
                <th className="py-2 pr-3">处理人</th>
                <th className="py-2 pr-3">诊断包</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{record.title}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(record.priority)}`}>
                      {record.priorityLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{record.requesterName ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.assigneeName ?? '-'}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {record.diagnosticPackageAttached ? (record.diagnosticPackageMasked ? '已脱敏' : '未脱敏⚠') : '无'}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(record.status)}`}>
                      {record.statusLabel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-400">{record.updatedAt ?? record.createdAt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="text-xs text-slate-400">只读提示</p>
        <p className="mt-1">{meta.readOnlyNotice}</p>
      </div>
    </section>
  );
}
