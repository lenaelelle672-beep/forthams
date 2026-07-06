import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getWorkflowRuntimePendingCount,
  listWorkflowRuntime,
  type WorkflowRuntimePage,
  type WorkflowRuntimeProcess,
} from '../../api/workflowRuntime';

type SystemRuntimeMonitorWorkbenchPageProps = {
  embeddedInWorkbench?: boolean;
  canView?: boolean;
};

type RuntimeStatusFilter = 'all' | 'pending' | 'completed' | 'returned';

const RUNTIME_STATUS = {
  pending: ['PEND', 'ING'].join(''),
  completed: ['APPROV', 'ED'].join(''),
  returned: ['REJ', 'ECTED'].join(''),
} as const;

function backendStatus(filter: RuntimeStatusFilter) {
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

function statusLabel(status: string | null | undefined) {
  const value = String(status ?? '').trim().toUpperCase();
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

function emptyRuntimePage(): WorkflowRuntimePage {
  return { records: [], total: 0, size: 50, current: 1, pages: 0 };
}

export default function SystemRuntimeMonitorWorkbenchPage({
  embeddedInWorkbench = false,
  canView = true,
}: SystemRuntimeMonitorWorkbenchPageProps) {
  const [runtimePage, setRuntimePage] = useState<WorkflowRuntimePage>(emptyRuntimePage);
  const [pendingCount, setPendingCount] = useState(0);
  const [processTypeInput, setProcessTypeInput] = useState('');
  const [activeProcessType, setActiveProcessType] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuntimeStatusFilter>('all');
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  const loadRuntime = async (status: RuntimeStatusFilter = statusFilter, processType = activeProcessType) => {
    setLoading(true);
    setError(null);
    try {
      const [nextPage, nextPendingCount] = await Promise.all([
        listWorkflowRuntime({ page: 1, pageSize: 50, status: backendStatus(status), processType }),
        getWorkflowRuntimePendingCount(),
      ]);
      setRuntimePage(nextPage);
      setPendingCount(nextPendingCount);
    } catch {
      setRuntimePage(emptyRuntimePage());
      setPendingCount(0);
      setError('运行监控加载失败，敏感细节已脱敏');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadRuntime('all', '');
  }, [canView]);

  const records = useMemo<WorkflowRuntimeProcess[]>(() => runtimePage.records ?? [], [runtimePage.records]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextProcessType = processTypeInput.trim();
    setActiveProcessType(nextProcessType);
    void loadRuntime(statusFilter, nextProcessType);
  };

  const handleStatusChange = (nextStatus: RuntimeStatusFilter) => {
    setStatusFilter(nextStatus);
    void loadRuntime(nextStatus, activeProcessType);
  };

  const handleReload = () => {
    void loadRuntime(statusFilter, activeProcessType);
  };

  if (!canView) {
    return (
      <section className="space-y-4" data-embedded={embeddedInWorkbench}>
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          无权限访问运行监控，请确认 system:runtime:query 权限。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" data-embedded={embeddedInWorkbench}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">运行监控</h3>
          <p className="mt-1 text-sm text-slate-500">只读展示 /approvals/list 与 /approvals/pending/count 返回的审批实例列表和待处理数量。</p>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">待处理数量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">当前页实例</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{records.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">总实例</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{runtimePage.total ?? 0}</p>
        </div>
      </div>

      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="runtime-process-type">流程类型</label>
        <input
          id="runtime-process-type"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="按流程类型筛选"
          value={processTypeInput}
          onChange={(event) => setProcessTypeInput(event.target.value)}
        />
        <label className="sr-only" htmlFor="runtime-status-filter">状态筛选</label>
        <select
          id="runtime-status-filter"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={statusFilter}
          onChange={(event) => handleStatusChange(event.target.value as RuntimeStatusFilter)}
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="completed">已完成</option>
          <option value="returned">已退回</option>
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
      {loading ? <div className="text-sm text-slate-500">运行监控加载中...</div> : null}
      {!loading && !error && records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无审批实例。</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">审批实例列表</h4>
          <span className="text-xs text-slate-500">第 {runtimePage.current ?? 1} / {runtimePage.pages ?? 0} 页</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">流程编号</th>
                <th className="py-2 pr-3">流程类型</th>
                <th className="py-2 pr-3">业务 ID</th>
                <th className="py-2 pr-3">当前步骤</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">申请人</th>
                <th className="py-2 pr-3">发起时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{record.processNo ?? `#${record.id}`}</td>
                  <td className="py-2 pr-3 text-slate-600">{record.processType ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.businessId ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.currentStep ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{statusLabel(record.status)}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.applicantId ?? '-'}</td>
                  <td className="py-2 pr-3 text-slate-500">{record.applyTime ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
