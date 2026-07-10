import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listImportExportTasks,
  getImportExportMeta,
  type ImportExportTaskRecord,
  type ImportExportMeta,
  type ImportExportQuery,
} from '../../api/importExport';

type SystemImportExportWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type TypeFilter = 'all' | 'IMPORT' | 'EXPORT';
type StatusFilter = 'all' | 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING' | 'CANCELLED';

function statusBadgeClass(status: string | null | undefined) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'SUCCESS') return 'bg-emerald-50 text-emerald-700';
  if (value === 'FAILED') return 'bg-red-50 text-red-700';
  if (value === 'RUNNING' || value === 'PENDING') return 'bg-blue-50 text-blue-700';
  if (value === 'CANCELLED') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}

function statusLabel(status: string | null | undefined) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'SUCCESS') return '成功';
  if (value === 'FAILED') return '失败';
  if (value === 'RUNNING') return '运行中';
  if (value === 'PENDING') return '等待中';
  if (value === 'CANCELLED') return '已取消';
  return value || '未知';
}

function matchesType(task: ImportExportTaskRecord, filter: TypeFilter) {
  if (filter === 'all') return true;
  return String(task.taskType ?? '').toUpperCase() === filter;
}

function matchesStatus(task: ImportExportTaskRecord, filter: StatusFilter) {
  if (filter === 'all') return true;
  return String(task.status ?? '').toUpperCase() === filter;
}

function matchesKeyword(task: ImportExportTaskRecord, keyword: string) {
  if (!keyword) return true;
  const normalized = keyword.toLowerCase();
  return [task.businessObject, task.operatorName ?? '', String(task.id)].join(' ').toLowerCase().includes(normalized);
}

function emptyMeta(): ImportExportMeta {
  return { supportedObjects: [], supportedFormats: [], statuses: [], importRowLimit: 0, exportRowLimit: 0, readOnlyNotice: '导入导出为只读 catalog。' };
}

export default function SystemImportExportWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemImportExportWorkbenchPageProps) {
  const [tasks, setTasks] = useState<ImportExportTaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<ImportExportMeta>(emptyMeta);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = async (query: ImportExportQuery = {}) => {
    setLoading(true);
    setError(null);
    try {
      const [data, nextMeta] = await Promise.all([
        listImportExportTasks({ page: 1, pageSize: 50, ...query }),
        getImportExportMeta(),
      ]);
      setTasks(data?.records ?? []);
      setTotal(data?.total ?? 0);
      setMeta(nextMeta ?? emptyMeta());
    } catch {
      setTasks([]);
      setTotal(0);
      setMeta(emptyMeta());
      setError('导入导出任务加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadTasks();
  }, [canView]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => matchesType(t, typeFilter) && matchesStatus(t, statusFilter) && matchesKeyword(t, keyword)),
    [tasks, typeFilter, statusFilter, keyword],
  );

  const failedCount = useMemo(() => tasks.filter((t) => String(t.status ?? '').toUpperCase() === 'FAILED').length, [tasks]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query: ImportExportQuery = {};
    if (typeFilter !== 'all') query.taskType = typeFilter;
    if (statusFilter !== 'all') query.status = statusFilter;
    void loadTasks(query);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问导入导出，请确认 system:import-export:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">导入导出</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示导入导出任务历史、错误报告摘要与只读边界。</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={loading}
          type="button"
          onClick={() => void loadTasks()}
        >
          重新加载
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        只读边界：本页仅展示任务历史与脱敏错误摘要；执行导入、导出、重试、取消等写操作不在 V3 只读 catalog 范围内。导入上限 {meta.importRowLimit} 行，导出上限 {meta.exportRowLimit} 行。
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">任务总数</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">失败任务</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{failedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前过滤结果</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleTasks.length}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]" onSubmit={handleSearch}>
        <input
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按业务对象或操作人搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
        >
          <option value="all">全部类型</option>
          <option value="IMPORT">导入</option>
          <option value="EXPORT">导出</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="SUCCESS">成功</option>
          <option value="FAILED">失败</option>
          <option value="RUNNING">运行中</option>
          <option value="PENDING">等待中</option>
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
      {loading ? <div className="text-sm text-slate-500">任务加载中...</div> : null}
      {!loading && !error && visibleTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无导入导出任务记录。</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">任务历史</h4>
          <span className="text-xs text-slate-500">显示 {visibleTasks.length} / {tasks.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">类型</th>
                <th className="py-2 pr-3">业务对象</th>
                <th className="py-2 pr-3">格式</th>
                <th className="py-2 pr-3">成功/失败</th>
                <th className="py-2 pr-3">操作人</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">错误摘要</th>
                <th className="py-2 pr-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTasks.map((task) => (
                <tr key={task.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">#{task.id}</td>
                  <td className="py-2 pr-3 text-slate-600">{task.taskType === 'IMPORT' ? '导入' : task.taskType === 'EXPORT' ? '导出' : task.taskType}</td>
                  <td className="py-2 pr-3 text-slate-500">{task.businessObject}</td>
                  <td className="py-2 pr-3 text-slate-500">{task.fileFormat}</td>
                  <td className="py-2 pr-3 text-slate-500">{task.successRows ?? 0}/{task.failedRows ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-500">{task.operatorName ?? '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(task.status)}`}>
                      {statusLabel(task.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500 max-w-[200px] truncate" title={task.errorSummary ?? ''}>{task.errorSummary ?? '-'}</td>
                  <td className="py-2 pr-3 text-xs text-slate-400">{task.finishedAt ?? task.createdAt ?? '-'}</td>
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
